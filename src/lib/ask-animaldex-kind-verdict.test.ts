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
    principleExpression: "Garden-wall timing",
    shortMotto: "Move on your own clock.",
    biologicalBasis: "Cats hunt alone and choose when to engage.",
    applicationExample: "A writer who answers email only at four.",
    message: "My manager offered me a promotion over my two closest friends. Should I take it?"
};

const verdict = {
    power_says: "Keep your own hours; do not take charge of others.",
    nearest_situation: "Two cats sharing one garden wall.",
    what_it_does: "Keeps its own hours and never takes charge of the others.",
    verdict: "Decline the role.",
    their_problem: "The role puts their friends on someone else's clock.",
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
    assert.ok(prompt.includes("6. Then find the moment"));
    assert.ok(prompt.includes("the side its Power lives by wins, and no other habit of its kind overturns it"));
    assert.ok(prompt.includes('"power_says": "max 20 words"'));
    const unanchored = buildAskKindVerdictPrompt({...input, powerName: null});
    assert.ok(!/power_says|its Power/.test(unanchored));
    assert.ok(unanchored.includes("5. Then find the moment"));
});

test("the sensible answer is named first, and the move is the Power's own shape, not that answer", () => {
    const prompt = buildAskKindVerdictPrompt(input);
    assert.ok(prompt.includes("3. If decision is true, usual_advice: what a careful, sensible human adviser would tell them."));
    assert.ok(prompt.includes("Which part does this Power go to first"));
    assert.ok(prompt.includes("7. their_move: the Power's own way, done literally in their life, on that part"));
    assert.ok(prompt.includes("if it borrows, they borrow"));
    // The JSON is written in this order, so the move comes after the answer it departs from.
    const json = prompt.slice(prompt.indexOf("Return JSON only"));
    const order = ["usual_advice", "power_says", "their_problem", "verdict", "their_move"].map((key) => json.indexOf(`"${key}"`));
    assert.ok(order.every((at, i) => at > 0 && (i === 0 || at > order[i - 1])));
});

test("only a decision with nothing dangerous in it gives a verdict", () => {
    const raw = {decision: true, safety: false, ...verdict};
    assert.deepEqual(parseAskKindVerdict(raw), verdict);
    assert.equal(parseAskKindVerdict({...raw, power_says: undefined})?.power_says, "");
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
    assert.ok(section.includes('"what_your_power_says":"Keep your own hours; do not take charge of others."'));
    assert.ok(!askKindVerdictPromptSection({...verdict, power_says: ""}).includes("what_your_power_says"));
});

test("the move in their life reaches the animal, and the usual advice is never its step", () => {
    const section = askKindVerdictPromptSection(verdict);
    assert.ok(section.includes('"your_move_in_their_life":"Tell the manager no this week'));
    assert.ok(section.includes('"what_everyone_else_will_tell_them":"Take it, and set clear boundaries'));
    const older = askKindVerdictPromptSection({...verdict, their_problem: "", their_move: "", usual_advice: ""});
    assert.ok(!/your_move_in_their_life|what_everyone_else|turns into what everyone/.test(older));
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
