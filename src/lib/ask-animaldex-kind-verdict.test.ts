import assert from "node:assert/strict";
import {test} from "node:test";
import {
    ASK_HELD_MATCH_FLOOR,
    ASK_KIND_VERDICT_MAX_TOKENS,
    askHeldStances,
    askKindVerdictEnabled,
    askKindVerdictPromptSection,
    askProblemSimilarity,
    askStanceMemoryConfig,
    buildAskKindVerdictPrompt,
    parseAskKindVerdict,
    type AskHeldStance
} from "@/lib/ask-animaldex/kind-verdict";
import {requestAskKindVerdict} from "@/lib/ask-animaldex/kind-verdict-server";

const input = {
    animalName: "Domestic Cat",
    scientificName: "Felis catus",
    powerName: "Self-chosen Rhythm",
    coreLesson: "Move when the timing is yours.",
    adviceStyle: "Engage fully when the timing belongs to you.",
    principleExpression: "Garden-wall timing",
    shortMotto: "Move on your own clock.",
    biologicalBasis: "Cats hunt alone and choose when to engage.",
    applicationExample: "A writer who answers email only at four.",
    stance: "waits on the wall until the moment is its own",
    firstQuestion: "Whose clock are you running on right now?",
    message: "My manager offered me a promotion over my two closest friends. Should I take it?"
};

const verdict = {
    power_says: "Keep your own hours; do not take charge of others.",
    verdict: "Decline, and ask for one project of your own, on your own clock.",
    obvious: "Take it and set boundaries with your friends.",
    angle: "The offer runs on the manager's clock.",
    problem: "Promotion over close friends at work"
};

const held: AskHeldStance[] = [
    {id: "s1", problem: "Promotion over close friends at work", power_says: "Keep your own hours.", verdict: "Decline it.", angle: "Their clock."},
    {id: "s2", problem: "Teenage son withdrawn, barely talks", verdict: "Sit on the wall where he passes."}
];

/** The prompt with its line breaks and indents taken out, to check wording. */
const flat = (text: string) => text.replace(/\s+/g, " ");

function answer(body: Record<string, unknown>) {
    return new Response(JSON.stringify({
        id: "msg_1", type: "message", role: "assistant", model: "claude-haiku-5-5",
        content: [{type: "text", text: JSON.stringify(body)}],
        stop_reason: "end_turn", stop_sequence: null, usage: {input_tokens: 900, output_tokens: 120}
    }), {status: 200, headers: {"Content-Type": "application/json"}});
}

test("the verdict prompt asks for natural history, not advice, and names only this animal", () => {
    const prompt = buildAskKindVerdictPrompt(input);
    assert.ok(prompt.includes("field biologist who knows Domestic Cat (Felis catus)"));
    assert.ok(prompt.includes('its Power is "Self-chosen Rhythm": Move when the timing is yours.'));
    assert.ok(prompt.includes("How it would tell anyone to act: Engage fully when the timing belongs to you."));
    assert.ok(prompt.includes('In its life: Garden-wall timing. Its motto: "Move on your own clock."'));
    assert.ok(prompt.includes("Never pick the middle"));
    assert.ok(!prompt.includes(".."));
    assert.ok(!/wolf|dog|dolphin|octopus/i.test(prompt));
});

test("its own lens finds the detail, and the move is never an obvious one, in any words", () => {
    const prompt = flat(buildAskKindVerdictPrompt(input));
    assert.ok(prompt.includes('The question it asks first, about anything: "Whose clock are you running on right now?"'));
    assert.ok(prompt.includes("With a person it waits on the wall until the moment is its own."));
    assert.ok(prompt.includes("obvious: the two or three moves any sensible adviser, or ChatGPT, would give them"));
    assert.ok(prompt.includes("Never one of the obvious moves in any words, even when its kind does that too"));
    assert.ok(prompt.includes("problem, angle and verdict never name a person, place, company or product."));
    const json = prompt.slice(prompt.indexOf("Return JSON only, on one line"));
    const order = ["problem", "obvious", "power_says", "angle", "verdict"].map((key) => json.indexOf(`"${key}"`));
    assert.ok(order.every((at, i) => at > 0 && (i === 0 || at > order[i - 1])));
    assert.ok(ASK_KIND_VERDICT_MAX_TOKENS >= 200 && ASK_KIND_VERDICT_MAX_TOKENS <= 320);
});

test("the one exception: the only kind or safe move for someone vulnerable is kept, with its own twist", () => {
    assert.ok(flat(buildAskKindVerdictPrompt(input)).includes("keep it, and make the verdict the reason and the twist only this animal would add"));
    assert.ok(flat(askKindVerdictPromptSection(verdict)).includes("lead with your own reason for it and the twist only you would add."));
});

test("the Power is read at its word and wins where the kind's life points both ways", () => {
    const prompt = flat(buildAskKindVerdictPrompt(input));
    assert.ok(prompt.includes("4. power_says: its Power is the part of its life it lives by"));
    assert.ok(prompt.includes("the side its Power lives by wins"));
    const unanchored = buildAskKindVerdictPrompt({...input, powerName: null});
    assert.ok(!/power_says|its Power/.test(unanchored));
});

test("held stances are listed and same_as follows the problem", () => {
    const prompt = buildAskKindVerdictPrompt({...input, held});
    assert.ok(prompt.includes("1. Promotion over close friends at work: Decline it."));
    assert.ok(flat(prompt).includes("Same kind means the same situation and the same question, not a shared topic or word"));
    const json = prompt.slice(prompt.indexOf("Return JSON only, on one line"));
    assert.ok(json.indexOf('"problem"') < json.indexOf('"same_as"') && json.indexOf('"same_as"') < json.indexOf('"obvious"'));
    assert.ok(!buildAskKindVerdictPrompt(input).includes("same_as"));
});

test("only a decision with nothing dangerous in it gives a verdict, and same_as keeps a held stance", () => {
    const raw = {decision: true, safety: false, ...verdict};
    assert.deepEqual(parseAskKindVerdict(raw), verdict);
    assert.equal(parseAskKindVerdict({...raw, decision: false}), null);
    assert.equal(parseAskKindVerdict({...raw, safety: true}), null);
    assert.equal(parseAskKindVerdict({...raw, verdict: "  "}), null);
    const kept = parseAskKindVerdict({decision: true, safety: false, problem: "Promotion over two friends", same_as: 1}, held);
    assert.equal(kept?.held_id, "s1");
    assert.equal(kept?.verdict, "Decline it.");
    assert.equal(kept?.asked_problem, "Promotion over two friends");
    assert.equal(parseAskKindVerdict({decision: true, safety: true, same_as: 1}, held), null);
});

test("problem similarity and its floor match the apps'", () => {
    assert.equal(askProblemSimilarity("App unseen", "App unseen"), 1);
    assert.equal(askProblemSimilarity("", ""), 0);
    assert.ok(askProblemSimilarity("Product unnoticed after budget spent on redesign", "Product struggles to gain visibility; budget exhausted") >= ASK_HELD_MATCH_FLOOR);
    assert.ok(askProblemSimilarity("Losing sales to a larger, cheaper competitor", "Product struggles to gain visibility after budget exhausted") < ASK_HELD_MATCH_FLOOR);
});

test("held rows are read safely from the database's shape", () => {
    assert.deepEqual(askHeldStances([{id: "s1", problem: "P", stance: {verdict: "V", angle: "A"}}, {id: 2, problem: "bad"}, {id: "s3", problem: "No verdict", stance: {}}]),
        [{id: "s1", problem: "P", verdict: "V", power_says: undefined, obvious: undefined, angle: "A"}]);
    assert.deepEqual(askHeldStances(null), []);
});

test("the verdict and the stance memory can each be switched off", () => {
    assert.equal(askKindVerdictEnabled({}), true);
    assert.equal(askKindVerdictEnabled({ANIMAL_CHAT_KIND_VERDICT: "off"}), false);
    assert.deepEqual(askStanceMemoryConfig({}), {source: "app"});
    assert.deepEqual(askStanceMemoryConfig({ANIMAL_STANCE_SOURCE: "lab"}), {source: "lab"});
    assert.equal(askStanceMemoryConfig({ANIMAL_STANCE_MEMORY: "off"}), null);
});

test("the animal leads with what it noticed, and never calls its verdict one", () => {
    const section = flat(askKindVerdictPromptSection(verdict));
    assert.ok(section.startsWith("your_kinds_verdict"));
    assert.ok(section.includes('"what_you_noticed":"The offer runs on the manager\'s clock."'));
    assert.ok(section.includes("Lead with what you noticed"));
    assert.ok(section.includes("Your move is never what everyone else will tell them, in any words"));
    assert.ok(section.includes("never call it a verdict"));
    assert.ok(!/what_you_noticed|Lead with what you noticed/.test(askKindVerdictPromptSection({power_says: "", verdict: "V"})));
});

test("the request runs with thinking off, and a failure gives no verdict", async () => {
    let sent: Record<string, unknown> = {};
    const ok = (async (_url: unknown, init?: RequestInit) => {
        sent = JSON.parse(String(init?.body));
        return answer({decision: true, safety: false, ...verdict});
    }) as typeof fetch;
    assert.deepEqual(await requestAskKindVerdict({key: "k", input, model: "claude-haiku-5-5", fetchImpl: ok}), verdict);
    assert.deepEqual(sent.thinking, {type: "disabled"});
    assert.equal(sent.max_tokens, ASK_KIND_VERDICT_MAX_TOKENS);
    const failing = (async () => new Response("{}", {status: 500})) as typeof fetch;
    assert.equal(await requestAskKindVerdict({key: "k", input, model: "claude-haiku-5-5", fetchImpl: failing}), null);
});

test("a same kind that reads unlike the held one is asked again without the held stances", async () => {
    const prompts: string[] = [];
    const fetchImpl = (async (_url: unknown, init?: RequestInit) => {
        prompts.push(JSON.parse(String(init?.body)).messages[0].content);
        return prompts.length === 1
            ? answer({decision: true, safety: false, problem: "Losing sales to a cheaper rival", same_as: 1})
            : answer({decision: true, safety: false, ...verdict});
    }) as typeof fetch;
    const result = await requestAskKindVerdict({key: "k", input: {...input, held}, model: "m", fetchImpl});
    assert.equal(prompts.length, 2);
    assert.ok(!prompts[1].includes("already settled its answer"));
    assert.equal(result?.held_id, undefined);
    const kept = await requestAskKindVerdict({key: "k", input: {...input, held}, model: "m",
        fetchImpl: (async () => answer({decision: true, safety: false, problem: "Promotion over my close friends", same_as: 1})) as typeof fetch});
    assert.equal(kept?.held_id, "s1");
});
