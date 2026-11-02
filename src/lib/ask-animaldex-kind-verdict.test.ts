import assert from "node:assert/strict";
import {test} from "node:test";
import {
    ASK_KIND_VERDICT_MAX_TOKENS,
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
    principleExpression: "Garden-wall timing",
    shortMotto: "Move on your own clock.",
    biologicalBasis: "Cats hunt alone and choose when to engage.",
    applicationExample: "A writer who answers email only at four.",
    message: "My manager offered me a promotion over my two closest friends. Should I take it?"
};

const verdict = {
    power_says: "Keep your own hours; do not take charge of others.",
    verdict: "Decline: two cats on one garden wall keep their own hours and never take charge.",
    their_move: "Tell the manager no this week, and keep your own hours beside your friends.",
    usual_advice: "Take it, and set clear boundaries with your friends."
};

test("the verdict prompt asks for natural history, not advice, and names only this animal", () => {
    const prompt = buildAskKindVerdictPrompt(input);
    assert.ok(prompt.includes("field biologist who knows Domestic Cat (Felis catus)"));
    assert.ok(prompt.includes('its Power is "Self-chosen Rhythm": Move when the timing is yours.'));
    assert.ok(prompt.includes("How it would tell anyone to act: Engage fully when the timing belongs to you."));
    assert.ok(prompt.includes('In its life: Garden-wall timing. Its motto: "Move on your own clock."'));
    assert.ok(prompt.includes("The biology: Cats hunt alone and choose when to engage."));
    assert.ok(prompt.includes("One person living by it: A writer who answers email only at four."));
    assert.ok(prompt.includes("Never pick the middle"));
    assert.ok(!prompt.includes(".."));
    assert.ok(!/wolf|dog|dolphin|octopus/i.test(prompt));
});

test("the Power is read at its word first and wins where the kind's life points both ways", () => {
    const prompt = buildAskKindVerdictPrompt(input);
    assert.ok(prompt.includes("4. power_says: its Power is the part of its life it lives by"));
    assert.ok(prompt.includes("5. verdict: which way it goes on their question, its Power's way"));
    assert.ok(prompt.includes("the side\n   its Power lives by wins, and no other habit of its kind overturns it"));
    assert.ok(prompt.includes('"power_says": "max 12 words"'));
    const unanchored = buildAskKindVerdictPrompt({...input, powerName: null});
    assert.ok(!/power_says|its Power/.test(unanchored));
    assert.ok(unanchored.includes("4. verdict: which way it goes on their question, and the one thing its kind actually does"));
    assert.ok(unanchored.includes("5. their_move: what this animal does, done literally in their life"));
});

test("the sensible answer is named first, and the move is the Power's own shape, not that answer", () => {
    const prompt = buildAskKindVerdictPrompt(input);
    assert.ok(prompt.includes("3. If decision is true, usual_advice: what a careful, sensible human adviser would tell them."));
    assert.ok(prompt.includes("6. their_move: the Power's own way, done literally in their life, in the same shape, on the\n   part of their problem this Power goes to first"));
    assert.ok(prompt.includes("if it borrows, they borrow"));
    // The JSON is written in this order, so the move comes after the answer it departs from.
    const json = prompt.slice(prompt.indexOf("Return JSON only"));
    const order = ["usual_advice", "power_says", "verdict", "their_move"].map((key) => json.indexOf(`"${key}"`));
    assert.ok(order.every((at, i) => at > 0 && (i === 0 || at > order[i - 1])));
});

test("the verdict is short: four short fields, one line, and room for no more", () => {
    const json = buildAskKindVerdictPrompt(input).slice(buildAskKindVerdictPrompt(input).indexOf("Return JSON only, on one line"));
    assert.ok(!/nearest_situation|what_it_does|their_problem/.test(json));
    assert.ok(json.includes('"usual_advice": "max 8 words"'));
    assert.ok(json.includes('"verdict": "the side and the one thing its kind does, max 20 words"'));
    assert.ok(json.includes('"their_move": "max 20 words"'));
    assert.ok(ASK_KIND_VERDICT_MAX_TOKENS >= 200 && ASK_KIND_VERDICT_MAX_TOKENS <= 300);
});

test("only a decision with nothing dangerous in it gives a verdict", () => {
    const raw = {decision: true, safety: false, ...verdict};
    assert.deepEqual(parseAskKindVerdict(raw), verdict);
    assert.equal(parseAskKindVerdict({...raw, power_says: undefined})?.power_says, "");
    assert.equal(parseAskKindVerdict({...raw, decision: false}), null);
    assert.equal(parseAskKindVerdict({...raw, safety: true}), null);
    assert.equal(parseAskKindVerdict({...raw, safety: undefined}), null);
    assert.equal(parseAskKindVerdict({...raw, verdict: "  "}), null);
    // The old eight-field answer still reads: the fields the prompt no longer asks for are ignored.
    assert.deepEqual(parseAskKindVerdict({...raw, nearest_situation: "Two cats on a wall.", what_it_does: "Keeps its hours.", their_problem: "Their clock."}), verdict);
});

test("the verdict can be switched off", () => {
    assert.equal(askKindVerdictEnabled({}), true);
    assert.equal(askKindVerdictEnabled({ANIMAL_CHAT_KIND_VERDICT: "off"}), false);
});

test("the animal reads its verdict as its own, and never calls it one", () => {
    const section = askKindVerdictPromptSection(verdict);
    assert.ok(section.startsWith("your_kinds_verdict"));
    assert.ok(section.includes('"verdict":"Decline: two cats on one garden wall keep their own hours and never take charge."'));
    assert.ok(section.includes("never call it a verdict"));
    assert.ok(section.includes('"what_your_power_says":"Keep your own hours; do not take charge of others."'));
    assert.ok(!askKindVerdictPromptSection({...verdict, power_says: ""}).includes("what_your_power_says"));
    assert.ok(!/the_moment_in_your_life|what_your_kind_does|the_problem_as_you_see_it/.test(section));
});

test("the move in their life reaches the animal, and the usual advice is never its step", () => {
    const section = askKindVerdictPromptSection(verdict);
    assert.ok(section.includes('"your_move_in_their_life":"Tell the manager no this week'));
    assert.ok(section.includes('"what_everyone_else_will_tell_them":"Take it, and set clear boundaries'));
    const older = askKindVerdictPromptSection({...verdict, their_move: "", usual_advice: ""});
    assert.ok(!/your_move_in_their_life|what_everyone_else|it leads/.test(older));
});

test("the request runs with thinking off and a short cap, and a failure gives no verdict", async () => {
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
    assert.equal(sent.max_tokens, ASK_KIND_VERDICT_MAX_TOKENS);
    const failing = (async () => new Response("{}", {status: 500})) as typeof fetch;
    assert.equal(await requestAskKindVerdict({key: "k", input, model: "claude-haiku-5-5", fetchImpl: failing}), null);
});
