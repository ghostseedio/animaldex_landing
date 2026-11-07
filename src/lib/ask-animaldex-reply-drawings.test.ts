import assert from "node:assert/strict";
import test from "node:test";
import {drawingKind, replyDrawings} from "./ask-animaldex/reply-drawings";
import {askTimingLine} from "./ask-animaldex/ask-timing";

// The drawing flag (2026-11-07): the same table as the apps'
// supabase/functions/_shared/reply-drawings.test.ts, then the web's timing line.

test("a reply with no fence drew nothing", () => {
    assert.deepEqual(replyDrawings(""), {});
    assert.deepEqual(replyDrawings("Close all but two → finish one ✓ → open the next."), {});
    // Inline code is not a drawing.
    assert.deepEqual(replyDrawings("Type `two` and stop."), {});
});

test("a text diagram is counted as text, whatever language it names", () => {
    assert.deepEqual(replyDrawings("Here.\n\n```text\nA → B\n```\n\nDone."), {text: 1});
    assert.deepEqual(replyDrawings("```\n┌─┐\n└─┘\n```"), {text: 1});
    assert.deepEqual(replyDrawings("```Mermaid\ngraph LR\n```"), {text: 1});
    assert.deepEqual(replyDrawings("  ```text\nindented\n  ```"), {text: 1});
});

test("animaldex blocks are counted by their kind", () => {
    const reply = [
        "Close all but two.",
        "```animaldex-loop",
        '{"frequency":"MID"}',
        "```",
        "And look at the fox.",
        "```animaldex-image",
        '{"of":"species","name":"Red Fox"}',
        "```",
        "```animaldex-image",
        '{"of":"power"}',
        "```",
        "```text",
        "A → B",
        "```"
    ].join("\n");
    assert.deepEqual(replyDrawings(reply), {loop: 1, image: 2, text: 1});
    assert.deepEqual(replyDrawings('```animaldex-flow\n{"steps":[]}\n```'), {flow: 1});
    assert.deepEqual(replyDrawings('```ANIMALDEX-Card\n{"kind":"warmup"}\n```'), {card: 1});
});

test("only the marker is read: a closing line, a payload or a weird language never becomes a kind", () => {
    assert.deepEqual(replyDrawings("```text\nanimaldex-loop\n```"), {text: 1});
    assert.equal(drawingKind("```animaldex-this is not a kind"), "this");
    assert.equal(drawingKind("```animaldex-" + "x".repeat(40)), "other");
    assert.equal(drawingKind("```animaldex-é"), "other");
    assert.equal(drawingKind("```animaldex-"), "other");
    assert.equal(drawingKind("```animaldex-photo-callout"), "photo_callout");
});

test("an unclosed last fence still counts once (the clients draw it)", () => {
    assert.deepEqual(replyDrawings("Look.\n```animaldex-scale\n{\"low\":"), {scale: 1});
    assert.deepEqual(replyDrawings("```text\nA\n```\n```text\nB"), {text: 2});
});

test("the web's timing line reads like the apps': label, length, times and what it drew, never the words", () => {
    const answer = "Close all but two.\n\n```animaldex-loop\n{\"frequency\":\"MID\"}\n```";
    const line = askTimingLine({answer, totalMs: 2345.67, firstFrameMs: 1234.56, smallTalk: false});
    assert.ok(line.startsWith("animal_chat_timing "));
    const report = JSON.parse(line.slice("animal_chat_timing ".length));
    assert.deepEqual(report, {
        label: "ask_stream",
        answer_chars: answer.length,
        total_ms: 2345.7,
        marks: [{name: "first_frame", at_ms: 1234.6}],
        notes: {drew: {loop: 1}}
    });
    assert.equal(line.includes("Close all"), false);
    // Small talk is flagged; no first frame, no mark; nothing drawn is {}.
    const hello = JSON.parse(askTimingLine({answer: "Hey!", totalMs: 900, firstFrameMs: null, smallTalk: true}).slice(19));
    assert.deepEqual(hello.marks, []);
    assert.deepEqual(hello.notes, {drew: {}, small_talk: true});
});
