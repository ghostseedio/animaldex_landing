import assert from "node:assert/strict";
import test from "node:test";

import {askPacerStep, askPacerTimeline, type AskPacerInput} from "@/lib/ask-animaldex/pacer";

const measured = {typingCps: 13.5, pace: "measured" as const};

function step(target: string, shown: number, overrides: Partial<AskPacerInput> = {}) {
    return askPacerStep({target, shown, sourceDone: false, instant: false, ...measured, ...overrides});
}

test("a word appears only once what follows it has arrived: never a half word", () => {
    // "wor" may be the start of "world"; it waits.
    assert.equal(step("Hello wor", 0).next, 5);
    const waiting = step("Hello wor", 5);
    assert.equal(waiting.next, 5);
    assert.ok(waiting.pause > 0);
    // Once the reply is complete, the last word is a word.
    assert.equal(step("Hello wor", 5, {sourceDone: true}).next, 9);
    // The step includes the space before the word, so text is never trimmed.
    assert.equal("Hello world here".slice(0, step("Hello world here", 5).next), "Hello world");
});

test("words come at the animal's typing speed", () => {
    const slow = step("Gently now", 0, {typingCps: 10, pace: "slow"});
    const quick = step("Gently now", 0, {typingCps: 17, pace: "quick"});
    assert.equal(slow.next, 6);
    assert.ok(Math.abs(slow.pause - 6 / 10) < 1e-9);
    assert.ok(Math.abs(quick.pause - 6 / 17) < 1e-9);
    // A floor of 6 cps, so a broken frame cannot stall the reply.
    assert.ok(Math.abs(step("Gently now", 0, {typingCps: 0.5}).pause - 1) < 1e-9);
});

test("a sentence ends on a breath, a clause on a shorter one, a paragraph on a longer one", () => {
    const plain = step("Hi there friend", 0).pause;
    const clause = step("Hi, there friend", 0).pause;
    const sentence = step("Hi. There friend", 0).pause;
    assert.ok(clause > plain && sentence > clause);
    assert.ok(Math.abs(sentence - (3 / 13.5 + 0.34)) < 1e-9);
    const paragraph = step("Hi.\n\nThere", 0).pause;
    assert.ok(Math.abs(paragraph - (3 / 13.5 + 0.34 + 0.3)) < 1e-9);
    // A slow animal lingers longer at the same full stop, a quick one less.
    const slowStop = step("Hi. There", 0, {pace: "slow"}).pause;
    const quickStop = step("Hi. There", 0, {pace: "quick"}).pause;
    assert.ok(slowStop > sentence && quickStop < sentence);
    // No pause runs past 1.4 s.
    assert.ok(step(`${"x".repeat(60)}.\n\nNext`, 0).pause <= 1.4);
});

test("a card or drawing appears whole, once its closing fence has arrived", () => {
    const open = "Like this:\n\n```animaldex-flow\n{\"title\":\"Trail\",\"steps\":[";
    const afterLead = step(open, step(open, 0).next).next;
    assert.equal(open.slice(0, afterLead), "Like this:");
    // The fence has not closed: nothing of it is shown.
    assert.equal(step(open, afterLead).next, afterLead);
    const closed = `${open}{"label":"Find food"}]}\n\`\`\`\nAnd then?`;
    const fence = step(closed, afterLead);
    assert.equal(closed.slice(afterLead, fence.next).trim().endsWith("```"), true);
    assert.equal(closed.slice(afterLead, fence.next).includes("Find food"), true);
    assert.equal(fence.pause, 0.3);
    // A fence that never closes is shown as it is once the reply is complete.
    assert.equal(step(open, afterLead, {sourceDone: true}).next, open.length);
});

test("a bold phrase appears whole, so ** never waits for its other half", () => {
    const text = "Remember **the one clean opening** and wait.";
    const first = step(text, 0).next;
    assert.equal(text.slice(0, first), "Remember");
    const bold = step(text, first).next;
    assert.equal(text.slice(first, bold), " **the one clean opening**");
    // Its closing ** has not arrived: wait for it.
    assert.equal(step("Remember **the one clean", first).next, first);
    // A bold word on its own is just a word.
    assert.equal("A **big** day".slice(0, step("A **big** day", 1).next), "A **big**");
});

test("instant shows everything received at once: a click, Stop, reduced motion", () => {
    assert.deepEqual(step("Half a wor", 0, {instant: true}), {next: 10, pause: 0});
});

test("a whole reply types out in order, and a slow animal takes longer than a quick one", () => {
    const reply = "I wait. Then I move, all at once.\n\nThat's the whole trick.";
    const slow = askPacerTimeline(reply, {typingCps: 10, pace: "slow"});
    const quick = askPacerTimeline(reply, {typingCps: 17, pace: "quick"});
    assert.equal(slow[slow.length - 1].next, reply.length);
    assert.equal(slow.length, reply.trim().split(/\s+/).length);
    for (let index = 1; index < slow.length; index += 1) assert.ok(slow[index].next > slow[index - 1].next);
    const total = (steps: Array<{pause: number}>) => steps.reduce((sum, item) => sum + item.pause, 0);
    assert.ok(total(slow) > total(quick) * 1.5);
});
