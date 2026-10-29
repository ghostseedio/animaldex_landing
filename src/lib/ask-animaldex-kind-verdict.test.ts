import assert from "node:assert/strict";
import {test} from "node:test";
import {
    askKindVerdictEnabled,
    askKindVerdictPromptSection,
    buildAskKindVerdictPrompt,
    parseAskKindVerdict
} from "@/lib/ask-animaldex/kind-verdict";
import {requestAskKindVerdict} from "@/lib/ask-animaldex/kind-verdict-server";

const input = {
    animalName: "Domestic Cat",
    scientificName: "Felis catus",
    powerName: "Self-chosen Rhythm",
    coreLesson: "Move when the timing is yours.",
    adviceStyle: "Engage fully when the timing belongs to you.",
    message: "My manager offered me a promotion over my two closest friends. Should I take it?"
};

const verdict = {
    nearest_situation: "Two cats sharing one garden wall.",
    what_it_does: "Keeps its own hours and never takes charge of the others.",
    verdict: "Decline the role."
};

test("the verdict prompt asks for natural history, not advice, and names only this animal", () => {
    const prompt = buildAskKindVerdictPrompt(input);
    assert.ok(prompt.includes("field biologist who knows Domestic Cat (Felis catus)"));
    assert.ok(prompt.includes('its Power is "Self-chosen Rhythm": Move when the timing is yours.'));
    assert.ok(prompt.includes("How it would tell anyone to act: Engage fully when the timing belongs to you."));
    assert.ok(prompt.includes("Never pick the middle"));
    assert.ok(!/wolf|dog|dolphin|octopus/i.test(prompt));
});

test("only a decision with nothing dangerous in it gives a verdict", () => {
    const raw = {decision: true, safety: false, ...verdict};
    assert.deepEqual(parseAskKindVerdict(raw), verdict);
    assert.equal(parseAskKindVerdict({...raw, decision: false}), null);
    assert.equal(parseAskKindVerdict({...raw, safety: true}), null);
    assert.equal(parseAskKindVerdict({...raw, safety: undefined}), null);
});

test("the verdict can be switched off", () => {
    assert.equal(askKindVerdictEnabled({}), true);
    assert.equal(askKindVerdictEnabled({ANIMAL_CHAT_KIND_VERDICT: "off"}), false);
});

test("the animal reads its verdict as its own, and never calls it one", () => {
    const section = askKindVerdictPromptSection(verdict);
    assert.ok(section.startsWith("your_kinds_verdict"));
    assert.ok(section.includes('"verdict":"Decline the role."'));
    assert.ok(section.includes("never call it a verdict"));
});

test("the request runs with thinking off, and a failure gives no verdict", async () => {
    let sent: Record<string, unknown> = {};
    const ok = (async (_url: unknown, init?: RequestInit) => {
        sent = JSON.parse(String(init?.body));
        return new Response(JSON.stringify({
            id: "msg_1", type: "message", role: "assistant", model: "claude-haiku-5-5",
            content: [{type: "text", text: JSON.stringify({decision: true, safety: false, ...verdict})}],
            stop_reason: "end_turn", stop_sequence: null, usage: {input_tokens: 700, output_tokens: 120}
        }), {status: 200, headers: {"Content-Type": "application/json"}});
    }) as typeof fetch;
    assert.deepEqual(await requestAskKindVerdict({key: "k", input, model: "claude-haiku-5-5", fetchImpl: ok}), verdict);
    assert.deepEqual(sent.thinking, {type: "disabled"});
    const failing = (async () => new Response("{}", {status: 500})) as typeof fetch;
    assert.equal(await requestAskKindVerdict({key: "k", input, model: "claude-haiku-5-5", fetchImpl: failing}), null);
});
