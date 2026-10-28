import assert from "node:assert/strict";
import test from "node:test";

import {
    EMPTY_ASK_GROUP_QUEUE,
    askGroupColor,
    askGroupHistoryForSending,
    askGroupPauseSeconds,
    askGroupQueueCurrent,
    askGroupQueueFail,
    askGroupQueueFinish,
    askGroupQueueFinishStream,
    askGroupQueueIsFinished,
    askGroupQueueMarkRevealed,
    askGroupQueueReceive,
    askGroupQueueStart,
    askGroupQueueWaiting,
    askGroupThreadKey,
    askGroupTurnReadyToType,
    loadAskGroupThreads,
    parseAskGroupFrame,
    saveAskGroupThreads,
    type AskGroupMessage,
    type AskGroupTurnStart
} from "@/lib/ask-animaldex/group-thread";

// The iOS suite (AnimalGroupConversationTests): the frames, the order turns
// appear in, the pause between speakers, and the thread.

const wolf = "11111111-1111-1111-1111-111111111111";
const koala = "22222222-2222-2222-2222-222222222222";

test("a conversation decodes turn by turn", () => {
    const frames: Array<Record<string, unknown>> = [
        {flow: "conversation", speakers: [{capture_id: wolf, animal_name: "Gray Wolf", nickname: "Luna", power_name: "Cooperation", persona: {pace: "measured", typing_cps: 14}}]},
        {turn: {index: 0, participant: wolf, phase: "open", reply_to: null, persona: {pace: "quick", typing_cps: 16}}},
        {participant: wolf, turn_index: 0, delta: "Go in steady."},
        {participant: wolf, turn_index: 0, participant_done: true, settled: false},
        {turn: {index: 1, participant: koala, phase: "react", reply_to: wolf}},
        {participant: koala, turn_index: 1, error: "speaker_failed"},
        {done: true, follow_up_prompts: ["Carry on"], turns: 1, remaining: 3, limit: 10}
    ];
    const events = frames.map(parseAskGroupFrame);
    assert.equal(events.filter(Boolean).length, 7);
    assert.equal(events[0]?.kind === "speakers" && events[0].speakers[0].persona?.pace, "measured");
    assert.deepEqual(events[1], {kind: "turnStarted", start: {index: 0, captureId: wolf, phase: "open", replyTo: null, persona: {pace: "quick", typing_cps: 16, build: "medium", presence: "steady", intellect: "practical", tagline: null}}});
    assert.deepEqual(events[2], {kind: "turnDelta", index: 0, captureId: wolf, text: "Go in steady."});
    assert.deepEqual(events[3], {kind: "turnDone", index: 0, captureId: wolf, settled: false});
    assert.equal(events[4]?.kind === "turnStarted" && events[4].start.replyTo, wolf);
    assert.deepEqual(events[5], {kind: "turnFailed", index: 1, captureId: koala});
    assert.equal(events[6]?.kind === "done" && events[6].done.followUps[0], "Carry on");
    assert.equal(events[6]?.kind === "done" && events[6].done.remaining, 3);
});

test("an unknown phase still plays", () => {
    const event = parseAskGroupFrame({turn: {index: 3, participant: wolf, phase: "interject"}});
    assert.equal(event?.kind === "turnStarted" && event.start.phase, "unknown");
});

const start = (index: number, who: string, phase: AskGroupTurnStart["phase"] = "react"): AskGroupTurnStart =>
    ({index, captureId: who, phase, replyTo: null, persona: null});

test("one animal at a time, with the next one waiting", () => {
    let queue = askGroupQueueStart(EMPTY_ASK_GROUP_QUEUE, start(0, wolf, "open"));
    queue = askGroupQueueStart(queue, start(1, koala));
    assert.equal(askGroupQueueCurrent(queue)?.index, 0);
    assert.equal(askGroupQueueWaiting(queue)?.index, 1);
    queue = askGroupQueueMarkRevealed(queue, 0);
    assert.equal(askGroupQueueCurrent(queue)?.index, 1);
    assert.equal(askGroupQueueWaiting(queue), null);
});

test("a turn types only once a whole word has arrived", () => {
    let queue = askGroupQueueStart(EMPTY_ASK_GROUP_QUEUE, start(0, wolf));
    queue = askGroupQueueReceive(queue, 0, "Hel");
    assert.equal(askGroupTurnReadyToType(askGroupQueueCurrent(queue)!), false);
    queue = askGroupQueueReceive(queue, 0, "lo there");
    assert.equal(askGroupTurnReadyToType(askGroupQueueCurrent(queue)!), true);
});

test("a failed turn is skipped and an empty one never shows", () => {
    let queue = askGroupQueueStart(EMPTY_ASK_GROUP_QUEUE, start(0, wolf));
    queue = askGroupQueueStart(queue, start(1, koala));
    queue = askGroupQueueFail(queue, 0);
    assert.equal(askGroupQueueCurrent(queue)?.index, 1);
    queue = askGroupQueueFinish(queue, 1, false);
    assert.equal(askGroupQueueCurrent(queue), null);
});

test("the round ends when the stream has and everything is shown", () => {
    let queue = askGroupQueueStart(EMPTY_ASK_GROUP_QUEUE, start(0, wolf));
    queue = askGroupQueueReceive(queue, 0, "Yes. ");
    queue = askGroupQueueFinishStream(queue);
    assert.equal(askGroupQueueIsFinished(queue), false);
    queue = askGroupQueueMarkRevealed(queue, 0);
    assert.equal(askGroupQueueIsFinished(queue), true);
});

test("slow talkers take a longer breath before speaking", () => {
    assert.ok(askGroupPauseSeconds("slow", 0) > askGroupPauseSeconds("quick", 1));
    assert.ok(askGroupPauseSeconds(null, 0.5) > 0.3);
});

test("each animal keeps its colour, in the order they were picked", () => {
    assert.equal(askGroupColor(wolf, [wolf, koala]), "#A7F432");
    assert.equal(askGroupColor(koala, [wolf, koala]), "#5ED6CC");
});

test("the same animals in any order reopen the same conversation", () => {
    assert.equal(askGroupThreadKey([koala, wolf]), askGroupThreadKey([wolf.toUpperCase(), koala]));
});

const message = (overrides: Partial<AskGroupMessage>): AskGroupMessage => ({
    id: Math.random().toString(36).slice(2),
    role: "assistant",
    text: "x",
    status: "complete",
    createdAt: new Date().toISOString(),
    ...overrides
});

test("the history sent says who said what, and stops before the question", () => {
    const question = message({id: "q", role: "user", text: "Now?"});
    const messages = [
        message({role: "user", text: "Hi"}),
        message({text: "Hello", speakerCaptureId: wolf}),
        message({text: "Sorry", status: "failed"}),
        question,
        message({text: "later", speakerCaptureId: koala})
    ];
    assert.deepEqual(askGroupHistoryForSending(messages, "q"), [
        {role: "user", content: "Hi", speakerCaptureId: null},
        {role: "assistant", content: "Hello", speakerCaptureId: wolf}
    ]);
});

test("threads keep what was said, never a failure or an unanswered question", () => {
    const stored = new Map<string, string>();
    const storage = {
        getItem: (key: string) => stored.get(key) ?? null,
        setItem: (key: string, value: string) => void stored.set(key, value),
        removeItem: (key: string) => void stored.delete(key)
    };
    const key = askGroupThreadKey([wolf, koala]);
    saveAskGroupThreads(storage, {
        [key]: [
            message({role: "user", text: "Hi"}),
            message({text: "We agree.", speakerCaptureId: wolf, phase: "converge", followUpPrompts: ["Carry on"]}),
            message({text: "No answer", status: "failed"}),
            message({role: "user", text: "Still there?"})
        ]
    });
    const loaded = loadAskGroupThreads(storage)[key];
    assert.equal(loaded.length, 2);
    assert.equal(loaded[1].phase, "converge");
    assert.deepEqual(loaded[1].followUpPrompts, ["Carry on"]);
    assert.equal(loadAskGroupThreads({getItem: () => { throw new Error("blocked"); }, setItem: () => undefined, removeItem: () => undefined})[key], undefined);
});
