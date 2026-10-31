import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import {
    askDoneStepIds,
    askSameStep,
    askStepCarrierId,
    askStepResolution,
    askThreadStep,
    askThreadStepIndex
} from "@/lib/ask-animaldex/special-messages";
import {createAskMessage, loadAskThreads, persistableAskMessages, saveAskThreads, type AskMessage} from "@/lib/ask-animaldex/thread";
import {askConversationHistory} from "@/lib/ask-animaldex/grounding";
import {decodeAnimalStep, type AnimalStep} from "@/lib/your-step";

// The open step lives in the conversation (owner, 2026-10-30; docs/your-step/
// INLINE.md): when no reply in the loaded thread carries it, the thread shows
// one more animal message holding only its step section, where the
// conversation picks up. Never pinned above the thread, never stored, never
// history, and one step never shows twice. iOS and Android follow the same rule.

const STEP = "5d6e7f80-1a2b-4c3d-8e9f-0a1b2c3d4e5f";
const NEW_STEP = "6e7f8091-2b3c-4d4e-9f0a-1b2c3d4e5f60";
const STEP_TEXT = "Say one thing in the first five minutes of Monday's meeting";
const OPENED_AT = Date.parse("2026-10-30T12:00:00.000Z");
const before = (minutes: number) => new Date(OPENED_AT - minutes * 60e3).toISOString();
const after = (minutes: number) => new Date(OPENED_AT + minutes * 60e3).toISOString();

function memoryStorage() {
    const store = new Map<string, string>();
    return {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
        removeItem: (key: string) => void store.delete(key)
    };
}

const openStep = decodeAnimalStep({id: STEP, step: STEP_TEXT, accepted_at: before(60)}) as AnimalStep;
/** What the chat opened on: earlier talk, none of it the reply that set the step. */
const history = (): AskMessage[] => [
    createAskMessage("assistant", "Hello again.", {isGreeting: true, createdAt: before(30)}),
    createAskMessage("user", "The snow is deep today.", {createdAt: before(29)}),
    createAskMessage("assistant", "It is. My kind walks in the tracks of the one ahead.", {createdAt: before(28)})
];
const placement = (messages: AskMessage[], step = askThreadStep({shown: null, openStep, messages}), extra: Partial<Parameters<typeof askThreadStepIndex>[0]> = {}) =>
    askThreadStepIndex({step, messages, openedAt: OPENED_AT, greetingPending: false, revealingId: null, ...extra});

test("a step set in an earlier conversation shows as one animal message of its own, with only its step", () => {
    const thread = history();
    const shown = askThreadStep({shown: null, openStep, messages: thread});
    assert.deepEqual(shown, {id: STEP, step: STEP_TEXT});
    // Live, with its buttons, like the section of the reply that would have set it.
    assert.deepEqual(askStepResolution({stepSet: shown!, openStep, loaded: true, doneStepIds: new Set()}), {kind: "live", step: openStep});
    // A Trial step keeps its Trial (its difficulty and loop).
    const trialStep = {...openStep, trialFrequency: "MID" as const};
    assert.deepEqual(askThreadStep({shown: null, openStep: trialStep, messages: thread}), {id: STEP, step: STEP_TEXT, trialFrequency: "MID"});
    // No open step, nothing; the same step again is the same message, not a new one.
    assert.equal(askThreadStep({shown: null, openStep: null, messages: thread}), null);
    assert.equal(askThreadStep({shown, openStep, messages: thread}), shown);
});

test("it goes where the conversation picks up: after the history the chat opened on, before anything said this visit", () => {
    const thread = history();
    assert.equal(placement(thread), 3);
    // What is said in this visit arrives below it; it stays where it was.
    const said = [...thread, createAskMessage("user", "I did not speak yet.", {createdAt: after(1)}), createAskMessage("assistant", "Then Monday.", {createdAt: after(2)})];
    assert.equal(placement(said), 3);
    // The animal's own message written while they were away is history too, and joins above it.
    const away = createAskMessage("assistant", "I thought of you on the ridge.", {createdAt: before(5), animalMessageId: "m1"});
    assert.equal(placement([...thread, away, ...said.slice(3)]), 4);
    // A referral's hello in this visit is said after it.
    assert.equal(placement([...thread, createAskMessage("assistant", "Pip sent you.", {isGreeting: true, createdAt: after(0)})]), 3);
});

test("with no history (a new or cleared thread) it goes right after the animal's hello, once that is all shown", () => {
    const hello = createAskMessage("assistant", "Hello.", {isGreeting: true, createdAt: after(0)});
    assert.equal(placement([hello]), 1);
    assert.equal(placement([hello, createAskMessage("user", "Hi!", {createdAt: after(1)})]), 1);
    // Not while the hello is still coming or being typed out: it never sits under a typing bubble.
    assert.equal(placement([{...hello, status: "thinking", text: ""}]), null);
    assert.equal(placement([{...hello, status: "streaming"}]), null);
    assert.equal(placement([hello], undefined, {revealingId: hello.id}), null);
    assert.equal(placement([], undefined, {greetingPending: true}), null);
    // No hello to come (it failed, or they spoke over it): first, before anything said.
    assert.equal(placement([]), 0);
    assert.equal(placement([createAskMessage("user", "Hi!", {createdAt: after(1)})]), 0);
});

test("one step never shows twice: a reply that carries it is where it shows, and only the newest such reply has its buttons", () => {
    const setter = createAskMessage("assistant", "So try this.", {createdAt: before(28), companionEvent: {stepSet: {id: STEP, step: STEP_TEXT}}});
    const loaded = [...history().slice(0, 2), setter];
    // The reply that set it is in the loaded thread: no message of its own.
    assert.equal(askStepCarrierId(loaded, openStep), setter.id);
    assert.equal(askThreadStep({shown: null, openStep, messages: loaded}), null);
    assert.equal(placement(loaded, {id: STEP, step: STEP_TEXT}), null);
    // An older server's anchor without an id is matched by its words.
    const byWords = {...setter, companionEvent: {stepSet: {id: null, step: ` ${STEP_TEXT} `}}};
    assert.equal(askStepCarrierId([byWords], openStep), setter.id);
    assert.equal(askThreadStep({shown: null, openStep, messages: [byWords]}), null);
    // Still arriving, a reply carries nothing yet.
    assert.equal(askStepCarrierId([{...setter, status: "streaming"}], openStep), null);

    // Shown from history, then a reply this visit sets the same step again: that reply carries it, this goes.
    const thread = history();
    const shown = askThreadStep({shown: null, openStep, messages: thread});
    const again = createAskMessage("assistant", "Still this one.", {createdAt: after(2), companionEvent: {stepSet: {id: STEP, step: STEP_TEXT}}});
    assert.equal(placement([...thread, again], shown), null);

    // Two replies that set the same step: only the newest is live.
    const both = [setter, again];
    const carrier = askStepCarrierId(both, openStep);
    const live = both.filter((message) => askStepResolution({
        stepSet: message.companionEvent!.stepSet!,
        openStep,
        loaded: true,
        doneStepIds: new Set(),
        carriedLater: carrier !== null && carrier !== message.id
    }).kind === "live");
    assert.deepEqual(live.map((message) => message.id), [again.id]);
    assert.equal(askSameStep({id: STEP, step: "a"}, {id: NEW_STEP, step: "a"}), false);
    assert.equal(askSameStep({id: null, step: "a "}, {id: NEW_STEP, step: "a"}), true);
});

test("it resolves as older step sections do: dropped, replaced by a step a reply set, or done together", () => {
    const thread = history();
    const shown = askThreadStep({shown: null, openStep, messages: thread})!;
    // "A different step": dropped, the message stays with the words alone, and their ask goes below it.
    const asked = [...thread, createAskMessage("user", "Can I have a different step?", {createdAt: after(1)})];
    assert.equal(askThreadStep({shown, openStep: null, messages: asked}), shown);
    assert.deepEqual(askStepResolution({stepSet: shown, openStep: null, loaded: true, doneStepIds: askDoneStepIds(asked)}), {kind: "closed"});
    assert.equal(placement(asked, shown), 3);

    // The new step the reply set is carried by that reply; this one stays, closed.
    const newStep = decodeAnimalStep({id: NEW_STEP, step: "Ask one question before you answer", accepted_at: null}) as AnimalStep;
    const setNew = [...asked, createAskMessage("assistant", "Then this.", {createdAt: after(2), companionEvent: {stepSet: {id: NEW_STEP, step: newStep.step}}})];
    assert.equal(askThreadStep({shown, openStep: newStep, messages: setNew}), shown);
    assert.deepEqual(askStepResolution({stepSet: shown, openStep: newStep, loaded: true, doneStepIds: new Set()}), {kind: "closed"});
    assert.equal(placement(setNew, shown), 3);

    // "I did it", the report, and the animal saw it done: "Done together".
    const reported = [
        ...thread,
        createAskMessage("user", "I said the plan first.", {createdAt: after(1), stepReportId: STEP}),
        createAskMessage("assistant", "You moved first.", {createdAt: after(2), companionEvent: {stepDone: {id: STEP, step: STEP_TEXT, powerEarned: false, xp: 5}}})
    ];
    assert.equal(askThreadStep({shown, openStep: null, messages: reported}), shown);
    assert.deepEqual(askStepResolution({stepSet: shown, openStep: null, loaded: true, doneStepIds: askDoneStepIds(reported)}), {kind: "done"});
    assert.equal(placement(reported, shown), 3);

    // A step made outside a reply (the Bond tab) while none carries it: the one message shows that step instead.
    assert.deepEqual(askThreadStep({shown, openStep: newStep, messages: asked}), {id: NEW_STEP, step: newStep.step});
});

test("the step's own message is drawn, never stored and never sent as history", () => {
    const thread = history();
    const copy = JSON.parse(JSON.stringify(thread));
    assert.ok(askThreadStep({shown: null, openStep, messages: thread}));
    assert.ok(placement(thread) !== null);
    // Deciding it leaves the thread as it was.
    assert.deepEqual(thread, copy);
    // What the next message sends as history, and what is kept, are the thread's own messages only.
    const sent = askConversationHistory(thread);
    assert.equal(sent.length, 3);
    assert.equal(sent.some((turn) => turn.content.includes(STEP_TEXT)), false);
    const storage = memoryStorage();
    saveAskThreads(storage, {"capture:x": persistableAskMessages(thread)});
    const restored = loadAskThreads(storage)["capture:x"];
    assert.deepEqual(restored.map((message) => message.id), thread.map((message) => message.id));
    assert.equal(restored.some((message) => message.text.includes(STEP_TEXT)), false);
});

test("the chat draws it in the thread and pins nothing above it", () => {
    const drawer = readFileSync(join(process.cwd(), "src/components/ask-animaldex/ask-conversation.tsx"), "utf8");
    assert.doesNotMatch(drawer, /variant="pinned"/);
    assert.doesNotMatch(drawer, /<StepCard\b/);
    assert.doesNotMatch(drawer, /showsPinnedStep/);
    // Inside the thread's list, at its place, and after the last message when that is where it goes.
    assert.match(drawer, /index === threadStepAt \? threadStepMessage : null/);
    assert.match(drawer, /threadStepAt === messages\.length \? threadStepMessage : null/);
    // The same section as the reply's, in the animal's special bubble with its face.
    assert.match(drawer, /<AskSpecialBubble avatarUrl=\{faceUrl\}>\{stepSection\(threadStep, false\)\}<\/AskSpecialBubble>/);
    const views = readFileSync(join(process.cwd(), "src/components/companions/step-views.tsx"), "utf8");
    assert.doesNotMatch(views, /"pinned"/);
});
