import assert from "node:assert/strict";
import {test} from "node:test";
import {
    feedbackPollAnswerPayload,
    feedbackPollCanSend,
    feedbackPollWords,
    parseFeedbackPoll,
    placeFeedbackPoll,
    toggleFeedbackPollChoice
} from "./feedback-polls";

const row = {
    poll_id: "8b0f6d2e-2a7c-4b8e-9d55-1a2b3c4d5e6f",
    slug: "build-next-1",
    topic: "build_next",
    title: "What should we build next?",
    intro: "Pick what you would use most.",
    questions: [
        {id: "q1", prompt: "Which would you use most?", multiple: false, options: [{id: "talk", label: "Talk"}, {id: "ark", label: "Ark"}]},
        {id: "q2", prompt: "Where?", multiple: true, options: [{id: "a", label: "A"}, {id: "b", label: "B"}, {id: "c", label: "C"}]}
    ],
    free_text_prompt: "Anything else?",
    translations: {es: {title: "¿Qué construimos?", questions: {q1: {prompt: "¿Cuál usarías?", options: {ark: "Arca"}}}}, "pt-br": {title: "O que fazemos?"}},
    slot: 6,
    closes_at: null,
    my_choices: null,
    my_free_text: null
};

test("translations resolve exact tag, then base language, field by field", () => {
    const es = parseFeedbackPoll(row, "es-MX")!;
    assert.equal(es.title, "¿Qué construimos?");
    assert.equal(es.intro, "Pick what you would use most.");
    assert.equal(es.questions[0].prompt, "¿Cuál usarías?");
    assert.deepEqual(es.questions[0].options.map((o) => o.label), ["Talk", "Arca"]);
    assert.equal(es.questions[1].prompt, "Where?");
    assert.equal(parseFeedbackPoll(row, "pt-BR")!.title, "O que fazemos?");
    assert.equal(parseFeedbackPoll(row, "en")!.title, "What should we build next?");
    assert.equal(parseFeedbackPoll({...row, questions: "nope"}, "en"), null);
});

test("choices: single swaps, multiple toggles in option order; payload drops empties and trims text", () => {
    const poll = parseFeedbackPoll(row, "en")!;
    let c = toggleFeedbackPollChoice({}, poll.questions[0], "talk");
    c = toggleFeedbackPollChoice(c, poll.questions[0], "ark");
    assert.deepEqual(c, {q1: ["ark"]});
    c = toggleFeedbackPollChoice(c, poll.questions[1], "c");
    c = toggleFeedbackPollChoice(c, poll.questions[1], "a");
    assert.deepEqual(c.q2, ["a", "c"]);
    c = toggleFeedbackPollChoice(c, poll.questions[1], "a");
    c = toggleFeedbackPollChoice(c, poll.questions[1], "c");
    assert.equal(c.q2, undefined);
    assert.deepEqual(feedbackPollAnswerPayload(poll, {q1: ["ark"], q9: ["x"]}, "  hi  "), {p_poll_id: poll.id, p_choices: {q1: ["ark"]}, p_free_text: "hi"});
    assert.equal(feedbackPollCanSend(poll, {}, "   "), false);
    assert.equal(feedbackPollCanSend(poll, {}, "x"), true);
});

test("the card goes after `slot` posts, never displacing other kinds; last when the list is short", () => {
    const poll = parseFeedbackPoll(row, "en")!;
    type S = {kind: string; n: number};
    const slots: S[] = [1, 2, 3, 4, 5, 6, 7].map((n) => ({kind: n === 2 ? "debate" : "post", n}));
    const placed = placeFeedbackPoll(slots, {...poll, slot: 4}, () => ({kind: "poll", n: 0}));
    assert.deepEqual(placed.map((s) => s.kind), ["post", "debate", "post", "post", "post", "poll", "post", "post"]);
    const short = placeFeedbackPoll(slots.slice(0, 3), poll, () => ({kind: "poll", n: 0}));
    assert.equal(short[short.length - 1].kind, "poll");
    assert.equal(placeFeedbackPoll(slots, null, () => ({kind: "poll", n: 0})).length, 7);
});

test("chrome words fall back to English", () => {
    assert.equal(feedbackPollWords("id").send, "Kirim");
    assert.equal(feedbackPollWords("fr").send, "Send");
});
