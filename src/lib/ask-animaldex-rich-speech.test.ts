import assert from "node:assert/strict";
import test from "node:test";

// Rich answers are looked at, not heard (docs/rich-chat/SPEC.md, section
// 1.3): the server's `speakableText` drops fenced blocks, table rows, emoji
// and stray box-drawing lines, and the words lit as the voice says them skip
// exactly the same, so the lit word stays in step. One sample, the same on
// every platform.
import {speakableText, withoutSpokenEmoji} from "@/lib/ask-animaldex/call-speech";
import {askMatchSpokenWords, askReplyWords, askReplyWordsOf, askWordRanges, askWords} from "@/lib/ask-animaldex/spoken-words";
import {askReplyPieces} from "@/lib/ask-animaldex/thread-layout";

const RICH_SPEECH_SAMPLE = [
    "Take it, but not the way they offered it. 🌙",
    "",
    "## 🧭 What I would do",
    "1. **Ask for a trial month** before you say yes.",
    "2. **Name one person** you will learn from.",
    "",
    "| Option | Gives | Costs |",
    "|---|---|---|",
    "| Take it | Room to grow | Your evenings |",
    "",
    "```text",
    "THE FORK",
    "┌──────┐   ┌──────┐",
    "│ Stay │ → │ Lead │",
    "└──────┘   └──────┘",
    "```",
    "┌ a stray line ┐",
    "Keep your nights 1️⃣ free 👍."
].join("\n");

test("the sample is said without its table, its diagram, its emoji or a stray box line", () => {
    assert.equal(
        speakableText(RICH_SPEECH_SAMPLE),
        "Take it, but not the way they offered it. What I would do. Ask for a trial month before you say yes. "
            + "Name one person you will learn from. Keep your nights free ."
    );
});

test("emoji go whole: keycaps, pictographs, variation selectors and joiners", () => {
    assert.equal(withoutSpokenEmoji("1️⃣ Go 👩‍💻 now ✌️ #️⃣"), " Go  now  ");
    // Arrows and box-drawing are not emoji: a diagram keeps them.
    assert.equal(withoutSpokenEmoji("A → B ─ C"), "A → B ─ C");
});

test("the words lit on screen are the words said, in step to the last", () => {
    const shown = askReplyWordsOf(RICH_SPEECH_SAMPLE);
    assert.deepEqual(shown, [
        "Take", "it,", "but", "not", "the", "way", "they", "offered", "it.",
        "What", "I", "would", "do",
        "Ask", "for", "a", "trial", "month", "before", "you", "say", "yes.",
        "Name", "one", "person", "you", "will", "learn", "from.",
        "Keep", "your", "nights", "free"
    ]);
    const spoken = askWords(speakableText(RICH_SPEECH_SAMPLE));
    assert.deepEqual(askMatchSpokenWords(spoken, shown), shown.map((_, index) => index));
});

test("a table or a diagram holds no words, so the bubbles after it keep their place", () => {
    const pieces = askReplyPieces(RICH_SPEECH_SAMPLE, true);
    const {pieceStarts, words} = askReplyWords(pieces);
    assert.equal(pieces.length, pieceStarts.length);
    // The last bubble's words start right after the list's.
    assert.equal(words[pieceStarts[pieceStarts.length - 1]], "Keep");
    // An emoji alone, or a keycap, is never a word to light.
    assert.deepEqual(askWordRanges("Go 🌙 1️⃣ now"), [[0, 2], [10, 13]]);
});
