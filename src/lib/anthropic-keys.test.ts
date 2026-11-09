import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {anthropicApiKey, anthropicApiKeys, anthropicClient, anthropicKeyFallbackFetch, isKeyRefusal} from "./anthropic-keys";

const envOf = (values: Record<string, string>) => (name: string) => values[name];
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {status, headers: {"content-type": "application/json"}});

function recorder(responses: Record<string, () => Response>) {
    const sent: string[] = [];
    const fetchImpl = ((_input: RequestInfo | URL, init?: RequestInit) => {
        const key = new Headers(init?.headers).get("x-api-key") ?? "";
        sent.push(key);
        return Promise.resolve(responses[key]());
    }) as typeof fetch;
    return {sent, fetchImpl};
}

const env2 = envOf({CLAUDE_API_KEY: "one", CLAUDE_API_KEY_2: "two"});
const init = (key: string): RequestInit => ({method: "POST", headers: {"x-api-key": key}, body: "{}"});
const URL_ = "https://api.anthropic.com/v1/messages";

describe("anthropic keys", () => {
    it("orders the keys primary first and drops blanks and repeats", () => {
        assert.deepEqual(anthropicApiKeys(envOf({CLAUDE_API_KEY: "a", CLAUDE_API_KEY_2: "b"})), ["a", "b"]);
        assert.deepEqual(anthropicApiKeys(envOf({ANTHROPIC_API_KEY: "a", CLAUDE_API_KEY_2: "a"})), ["a"]);
        assert.equal(anthropicApiKey(envOf({CLAUDE_API_KEY_2: "b"})), "b");
        assert.equal(anthropicApiKey(envOf({})), undefined);
    });

    it("treats key problems as refusals and request problems as answers", async () => {
        assert.equal(await isKeyRefusal(json(401, {error: {type: "authentication_error"}})), true);
        assert.equal(await isKeyRefusal(json(429, {error: {type: "rate_limit_error"}})), true);
        assert.equal(await isKeyRefusal(json(400, {error: {type: "invalid_request_error", message: "Your credit balance is too low to access the Anthropic API."}})), true);
        assert.equal(await isKeyRefusal(json(400, {error: {type: "invalid_request_error", message: "max_tokens"}})), false);
        assert.equal(await isKeyRefusal(json(529, {error: {type: "overloaded_error"}})), false);
    });

    it("re-sends with the second key when the first is out of credit", async () => {
        const {sent, fetchImpl} = recorder({
            one: () => json(400, {error: {type: "invalid_request_error", message: "Your credit balance is too low"}}),
            two: () => json(200, {ok: true})
        });
        const response = await anthropicKeyFallbackFetch(fetchImpl, env2)(URL_, init("one"));
        assert.equal(response.status, 200);
        assert.deepEqual(sent, ["one", "two"]);
    });

    it("does not re-send a bad request or a working key", async () => {
        const bad = recorder({one: () => json(400, {error: {type: "invalid_request_error", message: "bad"}}), two: () => json(200, {})});
        assert.equal((await anthropicKeyFallbackFetch(bad.fetchImpl, env2)(URL_, init("one"))).status, 400);
        assert.deepEqual(bad.sent, ["one"]);
        const good = recorder({one: () => json(200, {}), two: () => json(200, {})});
        await anthropicKeyFallbackFetch(good.fetchImpl, env2)(URL_, init("one"));
        assert.deepEqual(good.sent, ["one"]);
    });

    it("returns the last refusal when every key is refused", async () => {
        const {sent, fetchImpl} = recorder({one: () => json(401, {}), two: () => json(429, {})});
        assert.equal((await anthropicKeyFallbackFetch(fetchImpl, env2)(URL_, init("one"))).status, 429);
        assert.deepEqual(sent, ["one", "two"]);
    });

    it("falls back through the SDK", async () => {
        const saved = {a: process.env.CLAUDE_API_KEY, b: process.env.CLAUDE_API_KEY_2, c: process.env.ANTHROPIC_API_KEY};
        process.env.CLAUDE_API_KEY = "one";
        process.env.CLAUDE_API_KEY_2 = "two";
        delete process.env.ANTHROPIC_API_KEY;
        try {
            const {sent, fetchImpl} = recorder({
                one: () => json(401, {type: "error", error: {type: "authentication_error", message: "invalid x-api-key"}}),
                two: () => json(200, {id: "msg_1", type: "message", role: "assistant", model: "claude-haiku-5-5", content: [{type: "text", text: "hi"}], stop_reason: "end_turn", stop_sequence: null, usage: {input_tokens: 1, output_tokens: 1}})
            });
            const message = await anthropicClient({fetch: fetchImpl, maxRetries: 0}).messages.create({model: "claude-haiku-5-5", max_tokens: 10, messages: [{role: "user", content: "hi"}]});
            assert.equal(message.content[0].type === "text" ? message.content[0].text : "", "hi");
            assert.deepEqual(sent, ["one", "two"]);
        } finally {
            for (const [name, value] of [["CLAUDE_API_KEY", saved.a], ["CLAUDE_API_KEY_2", saved.b], ["ANTHROPIC_API_KEY", saved.c]] as const) {
                if (value === undefined) delete process.env[name];
                else process.env[name] = value;
            }
        }
    });
});
