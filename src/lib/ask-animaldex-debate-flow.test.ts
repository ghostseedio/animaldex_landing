import assert from "node:assert/strict";
import test from "node:test";
import {askDebateSchedule, nextAskDebateTurn, streamAskDebate, type AskDebateTurn} from "@/lib/ask-animaldex/debate-flow";
import {askDebateTurnInstruction, askDebateWordBudget} from "@/lib/ask-animaldex/debate-rules";

test("a debate is everyone's opening, one answer each, one closing line each: three turns per animal at most", () => {
    const schedule = askDebateSchedule([2, 0, 1]);
    assert.deepEqual(schedule.map((plan) => `${plan.phase}:${plan.seat}`), [
        "open:0", "open:1", "open:2",
        "react:0", "react:1", "react:2",
        "close:0", "close:1", "close:2"
    ]);
    // The host answers the last opener; each other animal answers the one before it.
    assert.deepEqual(schedule.filter((plan) => plan.phase === "react").map((plan) => plan.replyTo), [2, 0, 1]);
    assert.ok(schedule.every((plan) => plan.phase !== "react" ? plan.replyTo === null : true));
    for (const seats of [[0, 1], [0, 1, 2, 3]]) {
        const counts = new Map<number, number>();
        for (const plan of askDebateSchedule(seats)) counts.set(plan.seat, (counts.get(plan.seat) ?? 0) + 1);
        assert.ok(Array.from(counts.values()).every((count) => count === 3));
    }
});

test("the next turn skips what was said and the animals that fell silent; one animal alone ends it", () => {
    const schedule = askDebateSchedule([0, 1, 2]);
    assert.deepEqual(nextAskDebateTurn({schedule, said: []}), {seat: 0, phase: "open", replyTo: null});
    const said = [{seat: 0, phase: "open" as const}, {seat: 1, phase: "open" as const}];
    assert.deepEqual(nextAskDebateTurn({schedule, said}), {seat: 2, phase: "open", replyTo: null});
    // Seat 2 fell silent: the host answers the last one who spoke instead.
    assert.deepEqual(nextAskDebateTurn({schedule, said, out: new Set([2])}), {seat: 0, phase: "react", replyTo: 1});
    assert.equal(nextAskDebateTurn({schedule, said, out: new Set([1, 2])}), null);
    const all = schedule.map((plan) => ({seat: plan.seat, phase: plan.phase}));
    assert.equal(nextAskDebateTurn({schedule, said: all}), null);
});

test("each phase has its own job and length; no turn decides for the person", () => {
    assert.ok(askDebateWordBudget("open", 60) > askDebateWordBudget("react", 60));
    assert.ok(askDebateWordBudget("react", 60) > askDebateWordBudget("close", 60));
    const close = askDebateTurnInstruction({plan: {seat: 1, phase: "close", replyTo: null}, words: 18, replyToName: null}).join(" ");
    assert.match(close, /Do not decide for them/);
    const react = askDebateTurnInstruction({plan: {seat: 1, phase: "react", replyTo: 0}, words: 30, replyToName: "Wolf"}).join(" ");
    assert.match(react, /answer Wolf once/);
});

async function readFrames(response: Response): Promise<Array<Record<string, unknown>>> {
    const text = await response.text();
    return text.split("\n\n").filter((chunk) => chunk.startsWith("data: ")).map((chunk) => JSON.parse(chunk.slice(6)) as Record<string, unknown>);
}

const member = (id: string, name: string) => ({captureId: id, animalName: name, nickname: null, powerName: "P"});

test("stream: the remaining turns in order, each kept, a silent animal skipped, the report last", async () => {
    const kept: AskDebateTurn[] = [];
    let finishedWith = 0;
    const response = streamAskDebate({
        speakers: [
            {seat: 0, member: member("a", "Gray Wolf"), persona: {pace: "measured"}},
            {seat: 1, member: member("b", "Koala"), persona: {pace: "slow"}},
            {seat: 2, member: member("c", "Owl"), persona: {pace: "slow"}}
        ],
        // Picked up after a reload: the host's opening is already kept.
        said: [{seat: 0, phase: "open", text: "Stay with your pack."}],
        sourceFor: (plan, turns) => async (emit) => {
            if (plan.seat === 2) throw new Error("model down");
            emit(`${plan.phase} by ${plan.seat} after ${turns.length} `);
            emit("[[settled]]");
        },
        onTurn: async (turn, index) => {
            kept.push(turn);
            assert.equal(index >= 0, true);
        },
        finish: async (turns) => {
            finishedWith = turns.length;
            return {report_written: true, debate: {id: "d"}};
        },
        headers: {}
    });
    const frames = await readFrames(response);
    assert.equal(frames[0].flow, "debate");
    assert.deepEqual((frames[0].speakers as Array<{seat: number}>).map((speaker) => speaker.seat), [0, 1, 2]);
    const starts = frames.filter((frame) => frame.turn).map((frame) => frame.turn as {seat: number; phase: string; index: number});
    // Each turn's index is its place in the schedule, gaps and all.
    assert.deepEqual(starts.map((start) => start.index), [1, 2, 3, 4, 6, 7]);
    assert.deepEqual(starts.map((start) => `${start.phase}:${start.seat}`), ["open:1", "open:2", "react:0", "react:1", "close:0", "close:1"]);
    assert.ok(frames.some((frame) => frame.error === "speaker_failed" && frame.participant === "c"));
    // Markers never reach the page, and every finished turn is kept.
    assert.ok(!frames.some((frame) => typeof frame.delta === "string" && frame.delta.includes("[[")));
    assert.deepEqual(kept.map((turn) => `${turn.phase}:${turn.seat}`), ["open:1", "react:0", "react:1", "close:0", "close:1"]);
    assert.equal(finishedWith, 6);
    const done = frames[frames.length - 1];
    assert.equal(done.done, true);
    assert.equal(done.report_written, true);
});

test("stream: the debate carries on to its report after the page goes away", async () => {
    const gone = new AbortController();
    let finished = false;
    const response = streamAskDebate({
        speakers: [
            {seat: 0, member: member("a", "Gray Wolf"), persona: {}},
            {seat: 1, member: member("b", "Koala"), persona: {}}
        ],
        said: [],
        sourceFor: () => async (emit) => {
            gone.abort();
            emit("a line ");
        },
        onTurn: async () => undefined,
        finish: async (turns) => {
            finished = turns.length === 6;
            return {};
        },
        headers: {},
        signal: gone.signal
    });
    await response.text();
    assert.equal(finished, true);
});
