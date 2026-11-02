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
    verdict: "Decline: two cats on one garden wall keep their own hours and never take charge."
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
    assert.ok(prompt.includes("that is the answer they can get anywhere"));
    assert.ok(!prompt.includes(".."));
    assert.ok(!/wolf|dog|dolphin|octopus/i.test(prompt));
});

test("the Power is read at its word first and wins where the kind's life points both ways", () => {
    const prompt = buildAskKindVerdictPrompt(input);
    assert.ok(prompt.includes("3. If decision is true, power_says: its Power is the part of its life it lives by"));
    assert.ok(prompt.includes("4. verdict: which way it goes on their question, its Power's way"));
    assert.ok(prompt.includes("the side\n   its Power lives by wins, and no other habit of its kind overturns it"));
    assert.ok(prompt.includes('"power_says": "max 8 words"'));
    const unanchored = buildAskKindVerdictPrompt({...input, powerName: null});
    assert.ok(!/power_says|its Power/.test(unanchored));
    assert.ok(unanchored.includes("3. If decision is true, verdict: which way it goes on their question, and the one thing its kind actually does"));
});

test("the verdict is two short fields on one line, with room for no more", () => {
    const prompt = buildAskKindVerdictPrompt(input);
    const json = prompt.slice(prompt.indexOf("Return JSON only, on one line"));
    assert.ok(!/usual_advice|their_problem|nearest_situation|what_it_does|their_move/.test(json));
    assert.ok(json.includes('"verdict": "the side, then the one thing its kind does, max 15 words"'));
    assert.ok(ASK_KIND_VERDICT_MAX_TOKENS >= 120 && ASK_KIND_VERDICT_MAX_TOKENS <= 200);
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
    assert.deepEqual(parseAskKindVerdict({...raw, usual_advice: "Take it.", their_problem: "Their clock.", nearest_situation: "A wall.", what_it_does: "Keeps its hours.", their_move: "Say no."}), verdict);
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
    assert.ok(!/the_moment_in_your_life|what_your_kind_does|the_problem_as_you_see_it|your_move_in_their_life|what_everyone_else/.test(section));
});

test("the move in their life is the animal's own, in the shape of what its kind does, never the usual advice", () => {
    const section = askKindVerdictPromptSection(verdict);
    assert.ok(section.includes("That one real thing has the same shape as what your kind does, done literally in their life this week"));
    assert.ok(section.includes("Leave out any step\nanother animal could have given"));
    assert.ok(section.includes("never make what everyone else would tell them one of your steps"));
});

test("the request runs with thinking off and a short cap, and a failure gives no verdict", async () => {
    let sent: Record<string, unknown> = {};
    const ok = (async (_url: unknown, init?: RequestInit) => {
        sent = JSON.parse(String(init?.body));
        return new Response(JSON.stringify({
            id: "msg_1", type: "message", role: "assistant", model: "claude-haiku-5-5",
            content: [{type: "text", text: JSON.stringify({decision: true, safety: false, ...verdict})}],
            stop_reason: "end_turn", stop_sequence: null, usage: {input_tokens: 700, output_tokens: 80}
        }), {status: 200, headers: {"Content-Type": "application/json"}});
    }) as typeof fetch;
    assert.deepEqual(await requestAskKindVerdict({key: "k", input, model: "claude-haiku-5-5", fetchImpl: ok}), verdict);
    assert.deepEqual(sent.thinking, {type: "disabled"});
    assert.equal(sent.max_tokens, ASK_KIND_VERDICT_MAX_TOKENS);
    const failing = (async () => new Response("{}", {status: 500})) as typeof fetch;
    assert.equal(await requestAskKindVerdict({key: "k", input, model: "claude-haiku-5-5", fetchImpl: failing}), null);
});
