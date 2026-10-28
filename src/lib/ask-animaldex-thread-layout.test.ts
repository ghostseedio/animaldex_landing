import assert from "node:assert/strict";
import test from "node:test";

import {askLabelledIndices, askPlainBubbleText, askReplyPieces, askTimeLabel} from "@/lib/ask-animaldex/thread-layout";

// The iOS suite (AnimalChatThreadTests), with the website's drawings in place
// of the app's step cards: the website has no cards.
const flow = "```animaldex-flow\n{\"title\":\"How the trail builds\",\"steps\":[{\"label\":\"An ant finds food\"},{\"label\":\"It leaves a scent\"}]}\n```";

test("each paragraph is its own bubble", () => {
    assert.deepEqual(askReplyPieces("We don't vote.\n\nIt looks like following.", true), [
        {kind: "bubble", text: "We don't vote.", isPlain: true},
        {kind: "bubble", text: "It looks like following.", isPlain: true}
    ]);
});

test("a list stays with the sentence that introduces it", () => {
    const pieces = askReplyPieces("Settle three things:\n\n- who leads\n- who helps\n\nThen go.", true);
    assert.equal(pieces.length, 2);
    assert.deepEqual(pieces[0], {kind: "bubble", text: "Settle three things:\n\n- who leads\n- who helps", isPlain: false});
    assert.deepEqual(pieces[1], {kind: "bubble", text: "Then go.", isPlain: true});
});

test("a heading keeps the paragraph under it", () => {
    assert.deepEqual(askReplyPieces("### At dawn\n\nWe move first.\n\nLater, we rest.", true), [
        {kind: "bubble", text: "### At dawn\n\nWe move first.", isPlain: false},
        {kind: "bubble", text: "Later, we rest.", isPlain: true}
    ]);
});

test("a drawing sits outside the bubbles", () => {
    assert.deepEqual(askReplyPieces(`It goes like this.\n\n${flow}\n\nThat's the whole trick.`, true), [
        {kind: "bubble", text: "It goes like this.", isPlain: true},
        {kind: "visual", source: flow},
        {kind: "bubble", text: "That's the whole trick.", isPlain: true}
    ]);
});

test("a drawing that does not decode leaves no gap", () => {
    const broken = "```animaldex-flow\n{\"title\":\"nothing\"}\n```";
    assert.deepEqual(askReplyPieces(`Here.\n\n${broken}`, true), [{kind: "bubble", text: "Here.", isPlain: true}]);
});

test("an unfinished drawing waits while the reply is arriving", () => {
    const partial = "Look:\n\n```animaldex-flow\n{\"title\":\"Tra";
    const arriving = askReplyPieces(partial, false);
    assert.equal(arriving.length, 2);
    assert.equal(arriving[1].kind, "visual");
    // Once the reply is complete, a drawing that never closed and never decodes is dropped.
    assert.deepEqual(askReplyPieces(partial, true), [{kind: "bubble", text: "Look:", isPlain: true}]);
});

test("code keeps its blank lines inside one bubble", () => {
    assert.deepEqual(askReplyPieces("Try this:\n```\nstep one\n\nstep two\n```", true), [
        {kind: "bubble", text: "Try this:\n```\nstep one\n\nstep two\n```", isPlain: false}
    ]);
});

test("a numbered step and a quote join the bubble before them; a year does not", () => {
    const pieces = askReplyPieces("Two moves:\n\n1. wait\n2. pounce\n\n> Patience pays.\n\n2026 was a dry year.", true);
    assert.equal(pieces.length, 2);
    assert.equal(pieces[0].kind === "bubble" && pieces[0].text.endsWith("> Patience pays."), true);
    assert.deepEqual(pieces[1], {kind: "bubble", text: "2026 was a dry year.", isPlain: true});
});

test("a plain bubble reads as one run", () => {
    assert.equal(askPlainBubbleText("Start early,\n  before the trail fills."), "Start early, before the trail fills.");
});

test("nothing said is no pieces", () => {
    assert.deepEqual(askReplyPieces("", false), []);
    assert.deepEqual(askReplyPieces(" \n\n ", true), []);
});

// MARK: - Time labels

const now = new Date(2026, 9, 28, 15, 0, 0);
const ago = (ms: number) => new Date(now.getTime() - ms);
const HOUR = 60 * 60 * 1000;

test("one sitting today shows no time", () => {
    assert.deepEqual(Array.from(askLabelledIndices([ago(600_000), ago(540_000), ago(60_000)], now)), []);
});

test("a conversation picked up later marks every sitting", () => {
    const dates = [ago(3 * HOUR), ago(3 * HOUR - 30_000), ago(120_000), ago(60_000)];
    assert.deepEqual(Array.from(askLabelledIndices(dates, now)).sort(), [0, 2]);
});

test("an older conversation is dated from the start", () => {
    assert.deepEqual(Array.from(askLabelledIndices([ago(30 * HOUR), ago(30 * HOUR - 20_000)], now)), [0]);
});

test("the label names the day and the time, in the reader's words", () => {
    const words = {locale: "en-GB", today: "Today", yesterday: "Yesterday", now};
    assert.equal(askTimeLabel(ago(HOUR), words), "Today 14:00");
    assert.equal(askTimeLabel(ago(24 * HOUR), words), "Yesterday 15:00");
    assert.match(askTimeLabel(ago(3 * 24 * HOUR), words), /^Sunday 15:00$/);
    assert.match(askTimeLabel(ago(20 * 24 * HOUR), words), /^Thu,? 8 Oct 15:00$/);
});
