import assert from "node:assert/strict";
import test from "node:test";

import {ASK_PACER_BUDGET_SECONDS, ASK_PACER_DEFAULT, askPacerStep, askPacerTimeline, askPacerWordShown, type AskPacerInput} from "@/lib/ask-animaldex/pacer";

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
    // A floor of 6 cps, so a broken frame cannot stall the reply (and no
    // pause runs past 0.9 s).
    assert.ok(Math.abs(step("Gently now", 0, {typingCps: 0.5}).pause - 0.9) < 1e-9);
    assert.ok(Math.abs(step("Go now", 0, {typingCps: 0.5}).pause - 2 / 6) < 1e-9);
});

test("a sentence ends on a breath, a clause on a shorter one, a paragraph on a longer one", () => {
    const plain = step("Hi there friend", 0).pause;
    const clause = step("Hi, there friend", 0).pause;
    const sentence = step("Hi. There friend", 0).pause;
    assert.ok(clause > plain && sentence > clause);
    assert.ok(Math.abs(sentence - (3 / 13.5 + 0.2)) < 1e-9);
    const paragraph = step("Hi.\n\nThere", 0).pause;
    assert.ok(Math.abs(paragraph - (3 / 13.5 + 0.2 + 0.16)) < 1e-9);
    // A slow animal lingers longer at the same full stop, a quick one less.
    const slowStop = step("Hi. There", 0, {pace: "slow"}).pause;
    const quickStop = step("Hi. There", 0, {pace: "quick"}).pause;
    assert.ok(slowStop > sentence && quickStop < sentence);
    // No pause runs past 0.9 s.
    assert.ok(step(`${"x".repeat(60)}.\n\nNext`, 0).pause <= 0.9);
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

test("a long reply settles into reading speed after its opening", () => {
    const text = `${"word ".repeat(120)}end`;
    const opening = step(text, 0).pause;
    const later = step(text, 300).pause;
    const deep = step(text, 550).pause;
    assert.ok(Math.abs(later - opening / 1.3) < 1e-9);
    assert.ok(Math.abs(deep - opening / 1.6) < 1e-9);
});

test("the default pace is the apps' 21 characters a second", () => {
    assert.equal(ASK_PACER_DEFAULT.typingCps, 21);
    assert.equal(ASK_PACER_DEFAULT.pace, "measured");
});

test("a sound follows a word, not a card or a space, and knows when a sentence ends", () => {
    assert.deepEqual(askPacerWordShown(" there"), {endsSentence: false});
    assert.deepEqual(askPacerWordShown(" there."), {endsSentence: true});
    assert.deepEqual(askPacerWordShown(" go!"), {endsSentence: true});
    assert.equal(askPacerWordShown("   "), null);
    assert.equal(askPacerWordShown(" 42"), null);
    assert.equal(askPacerWordShown("\n```animaldex-flow\n{\"title\":\"Trail\"}\n```"), null);
});

// The pace is bounded (UX pass 2026-11-01, DECISIONS section 6; WEB-15: a
// 1,700-character answer took 45 s to type after its first words).

const total = (steps: Array<{pause: number}>) => steps.reduce((sum, item) => sum + item.pause, 0);

/** A rich answer the size of the one the audit timed: a verdict, headings, steps and a table. */
function longRichAnswer(): string {
    const paragraph = "I'd take it, but on my terms: I hunt alone at dusk, and nobody tells me which field to work. ".repeat(4);
    return [
        paragraph,
        "## 🧭 What I would do",
        "1. **Say yes in writing**, with the one thing you need changed before you start.",
        "2. **Tell your friends first**, before the announcement does it for you.",
        "3. **Keep one lunch a week** that has nothing to do with work.",
        "",
        "| Choice | What it gives | What it costs |",
        "|---|---|---|",
        "| Take it | Room to lead | Some distance |",
        "| Turn it down | Easy days | Another year waiting |",
        "",
        "## ⚠️ The price",
        paragraph,
        paragraph,
        "What would you ask for, if you knew they'd say yes?"
    ].join("\n");
}

test("a whole reply finishes revealing within twelve seconds of its first words, however long", () => {
    assert.equal(ASK_PACER_BUDGET_SECONDS, 12);
    const reply = longRichAnswer();
    assert.ok(reply.length > 1500, String(reply.length));
    for (const pace of [{typingCps: 10, pace: "slow" as const}, ASK_PACER_DEFAULT, {typingCps: 17, pace: "quick" as const}]) {
        const unbounded = askPacerTimeline(reply, {...pace, budget: null});
        const bounded = askPacerTimeline(reply, pace);
        assert.ok(total(unbounded) > 30, `unbounded ${total(unbounded)}`);
        // Every step but the last waits; the last word is on screen within the budget.
        const beforeLast = total(bounded.slice(0, -1));
        assert.ok(beforeLast <= ASK_PACER_BUDGET_SECONDS + 1e-6, `${pace.typingCps} cps: ${beforeLast}`);
        assert.equal(bounded[bounded.length - 1].next, reply.length);
        // Sped up evenly, not dumped at the end: the first half still takes a fair share of the time.
        const half = bounded.findIndex((item) => item.next >= reply.length / 2);
        assert.ok(total(bounded.slice(0, half)) > ASK_PACER_BUDGET_SECONDS * 0.25);
    }
});

test("a short reply keeps the animal's own pace: the budget only ever speeds a reply up", () => {
    const reply = "I wait. Then I move, all at once.\n\nThat's the whole trick.";
    const unbounded = askPacerTimeline(reply, {typingCps: 10, pace: "slow", budget: null});
    const bounded = askPacerTimeline(reply, {typingCps: 10, pace: "slow"});
    assert.deepEqual(bounded, unbounded);
});

test("the first words show as soon as they arrive; past the budget, what has arrived shows at once", () => {
    // Nothing on screen yet: no clock, the first word goes now.
    assert.equal(step("Hello there", 0).next, 5);
    // Out of time: everything received, even a word still arriving.
    assert.deepEqual(step("Hello there frie", 5, {elapsed: 12.5}), {next: 16, pause: 0});
    // Near the end of the budget, a step waits no longer than its share of the time left.
    const late = step(`Hello ${"word ".repeat(40)}`, 0, {elapsed: 11});
    assert.ok(late.pause < 0.05, String(late.pause));
});

test("a table appears whole, once it has ended: a block, never a cell at a time", () => {
    const lead = "Weigh it:\n\n";
    const rows = "| Choice | Gives |\n|---|---|\n| Take it | Room |";
    const afterLead = step(`${lead}${rows}`, step(`${lead}${rows}`, 0).next).next;
    assert.equal(`${lead}${rows}`.slice(0, afterLead), "Weigh it:");
    // Its last row may not be its last: wait for the line after it.
    assert.equal(step(`${lead}${rows}`, afterLead).next, afterLead);
    assert.equal(step(`${lead}${rows}\n| Turn`, afterLead).next, afterLead);
    // The line after it has arrived: the whole table at once.
    const ended = `${lead}${rows}\n\nSo take it.`;
    const table = step(ended, afterLead);
    assert.equal(ended.slice(afterLead, table.next).trim(), rows);
    assert.equal(table.pause, 0.3);
    // The reply ends with the table: it is shown whole.
    assert.equal(step(`${lead}${rows}`, afterLead, {sourceDone: true}).next, `${lead}${rows}`.length);
    // A pipe inside a sentence is just a word.
    assert.equal("Go | stay".slice(0, step("Go | stay", 2).next), "Go |");
});
