import assert from "node:assert/strict";
import test from "node:test";
import {askDebateComplete, askDebateSchedule, nextAskDebateTurn, streamAskDebate, type AskDebateTurn} from "@/lib/ask-animaldex/debate-flow";
import {askDebateTurnInstruction, askDebateWordBudget} from "@/lib/ask-animaldex/debate-rules";

// The apps' animal-debate.test.ts plan, held to the same order.

test("a debate is everyone's opening, one answer each, one closing line each, the host closing last", () => {
    assert.deepEqual(askDebateSchedule([2, 0, 1]).map((step) => `${step.phase}:${step.seat}`), [
        "open:0", "open:1", "open:2",
        "react:0", "react:1", "react:2",
        "close:1", "close:2", "close:0"
    ]);
    for (const seats of [[0, 1], [0, 1, 2, 3]]) {
        const counts = new Map<number, number>();
        for (const step of askDebateSchedule(seats)) counts.set(step.seat, (counts.get(step.seat) ?? 0) + 1);
        assert.ok(Array.from(counts.values()).every((count) => count === 3));
    }
    assert.deepEqual(askDebateSchedule([0]), []);
});

test("the next turn skips what was said and animals sitting out; an answer goes to whoever spoke last", () => {
    const seats = [0, 1, 2];
    assert.deepEqual(nextAskDebateTurn({seats, said: []}), {seat: 0, phase: "open", replyTo: null});
    const opened = [{seat: 0, phase: "open" as const}, {seat: 1, phase: "open" as const}, {seat: 2, phase: "open" as const}];
    assert.deepEqual(nextAskDebateTurn({seats, said: opened}), {seat: 0, phase: "react", replyTo: 2});
    assert.deepEqual(nextAskDebateTurn({seats, said: [...opened, {seat: 0, phase: "react"}]}), {seat: 1, phase: "react", replyTo: 0});
    // Seat 1 sits this run out: its turns are skipped and the debate stays incomplete.
    assert.deepEqual(nextAskDebateTurn({seats, said: opened, out: new Set([0])}), {seat: 1, phase: "react", replyTo: 2});
    const all = askDebateSchedule(seats);
    assert.equal(nextAskDebateTurn({seats, said: all}), null);
    assert.equal(askDebateComplete(seats, all), true);
    assert.equal(askDebateComplete(seats, opened), false);
});

test("each phase has its own job and length; no turn decides for the person", () => {
    assert.equal(askDebateWordBudget("open", 95), 60);
    assert.equal(askDebateWordBudget("close", 0), 15);
    assert.ok(askDebateWordBudget("react", 60) > askDebateWordBudget("close", 60));
    const close = askDebateTurnInstruction({plan: {seat: 1, phase: "close", replyTo: null}, words: 18, replyToName: null}).join(" ");
    assert.match(close, /Do not decide for them/);
});

async function readFrames(response: Response): Promise<Array<Record<string, unknown>>> {
    const text = await response.text();
    return text.split("\n\n").filter((chunk) => chunk.startsWith("data: ")).map((chunk) => JSON.parse(chunk.slice(6)) as Record<string, unknown>);
}

const member = (id: string, name: string) => ({captureId: id, animalName: name, nickname: null, powerName: "P"});
const speakers = [
    {seat: 0, member: member("p0", "Gray Wolf"), persona: {pace: "measured"}},
    {seat: 1, member: member("p1", "Koala"), persona: {pace: "slow"}}
];

test("stream: resumes after the saved turns, one more try for an empty turn, saved indexes without gaps, the report last", async () => {
    const saved: Array<AskDebateTurn & {turnIndex: number}> = [];
    const tries = new Map<string, number>();
    const response = streamAskDebate({
        debateId: "d",
        speakers,
        // Picked up after a reload: the host's opening is already saved.
        existing: [{seat: 0, phase: "open", text: "Stay with your pack.", turnIndex: 0}],
        sourceFor: (plan) => async (emit) => {
            const key = `${plan.seat}:${plan.phase}`;
            tries.set(key, (tries.get(key) ?? 0) + 1);
            // The Koala's answer comes back empty once.
            if (key === "1:react" && tries.get(key) === 1) return;
            emit(`${plan.phase} by ${plan.seat} `);
            emit("[[settled]]");
        },
        record: async (turn) => {
            saved.push(turn);
            return true;
        },
        finish: async () => ({report: {problem: "Moving"}, debate: {id: "d", status: "private_done"}}),
        incomplete: async () => ({id: "d"}),
        headers: {}
    });
    const frames = await readFrames(response);
    assert.equal(frames[0].flow, "debate");
    assert.equal(frames[0].debate_id, "d");
    const starts = frames.filter((frame) => frame.turn).map((frame) => frame.turn as {seat: number; phase: string; index: number});
    assert.deepEqual(starts.map((start) => `${start.phase}:${start.seat}:${start.index}`), [
        "open:1:1", "react:0:2", "react:1:3", "react:1:4", "close:1:5", "close:0:6"
    ]);
    assert.ok(frames.some((frame) => frame.error === "speaker_failed" && frame.participant === "p1"));
    assert.ok(!frames.some((frame) => typeof frame.delta === "string" && frame.delta.includes("[[")));
    assert.deepEqual(saved.map((turn) => `${turn.phase}:${turn.seat}:${turn.turnIndex}`), ["open:1:1", "react:0:2", "react:1:3", "close:1:4", "close:0:5"]);
    assert.ok(frames.some((frame) => frame.report_pending === true));
    assert.deepEqual(frames.find((frame) => frame.report)?.report, {problem: "Moving"});
    const done = frames[frames.length - 1];
    assert.equal(done.done, true);
    assert.equal((done.debate as {status: string}).status, "private_done");
});

test("stream: an animal that fails twice sits out, and the debate ends incomplete", async () => {
    const response = streamAskDebate({
        debateId: "d",
        speakers,
        existing: [],
        sourceFor: (plan) => async (emit) => {
            if (plan.seat === 1) throw new Error("model down");
            emit("a line ");
        },
        record: async () => true,
        finish: async () => {
            throw new Error("never");
        },
        incomplete: async () => ({id: "d", status: "debating"}),
        headers: {}
    });
    const frames = await readFrames(response);
    assert.equal(frames.filter((frame) => frame.error === "speaker_failed").length, 2);
    const done = frames[frames.length - 1];
    assert.equal((done.debate as {incomplete: boolean}).incomplete, true);
});

test("stream: when the page leaves, the turns stop; a debate whose last turn is in still asks for its report", async () => {
    const gone = new AbortController();
    let finished = false;
    const response = streamAskDebate({
        debateId: "d",
        speakers,
        existing: askDebateSchedule([0, 1]).slice(0, 5).map((step, index) => ({...step, text: "said", turnIndex: index})),
        sourceFor: () => async (emit) => {
            emit("the host's last line ");
        },
        record: async () => {
            gone.abort();
            return true;
        },
        finish: async () => {
            finished = true;
            return {report: null, debate: null};
        },
        incomplete: async () => null,
        headers: {},
        signal: gone.signal
    });
    await response.text().catch(() => "");
    // Give the stream's start() its turn to run to the end.
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(finished, true);
});
