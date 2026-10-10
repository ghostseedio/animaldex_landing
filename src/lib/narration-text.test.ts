import assert from "node:assert/strict";
import {test} from "node:test";
import {narrationCachePath, narrationLanguageCode, splitNarrationText} from "@/lib/narration-text";

test("narration pieces stay under the byte limit and keep every word", () => {
    const sentence = "The axolotl regrows limbs, hearts and even parts of its brain without scarring. ";
    const text = sentence.repeat(200);
    const pieces = splitNarrationText(text, 1_000);
    assert.ok(pieces.length > 1);
    for (const piece of pieces) assert.ok(Buffer.byteLength(piece, "utf8") <= 1_000);
    assert.equal(pieces.join(" "), text.trim());
});

test("a run-on sentence longer than a piece is cut on words", () => {
    const text = Array.from({length: 600}, (_, index) => `word${index}`).join(" ");
    const pieces = splitNarrationText(text, 500);
    for (const piece of pieces) assert.ok(Buffer.byteLength(piece, "utf8") <= 500);
    assert.equal(pieces.join(" "), text);
});

test("the same text in the same voice is the same saved file", () => {
    const voice = "en-US-Chirp3-HD-Charon";
    assert.equal(narrationCachePath("Hello  world.\n", voice), narrationCachePath("Hello world.", voice));
    assert.notEqual(narrationCachePath("Hello world.", voice), narrationCachePath("Hello world!", voice));
    assert.notEqual(narrationCachePath("Hello world.", voice), narrationCachePath("Hello world.", "fr-FR-Chirp3-HD-Charon"));
    assert.match(narrationCachePath("Hello world.", voice), /^en-us-chirp3-hd-charon\/[0-9a-f]{40}\.mp3$/);
});

test("site locales map to Google voice locales", () => {
    assert.equal(narrationLanguageCode("en"), "en-US");
    assert.equal(narrationLanguageCode("pt"), "pt-BR");
    assert.equal(narrationLanguageCode("xx"), "en-US");
});
