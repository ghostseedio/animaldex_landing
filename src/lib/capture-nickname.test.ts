import assert from "node:assert/strict";
import test from "node:test";
import {CAPTURE_NICKNAME_MAX, normalizeCaptureNickname} from "@/lib/capture-nickname";

test("a card's name is one trimmed line of at most 40 characters, blank is no name", () => {
    assert.equal(normalizeCaptureNickname("  Luna  "), "Luna");
    assert.equal(normalizeCaptureNickname("Big\n  Red\tBen"), "Big Red Ben");
    assert.equal(normalizeCaptureNickname("   "), null);
    assert.equal(normalizeCaptureNickname(""), null);
    assert.equal(normalizeCaptureNickname(null), null);
    assert.equal(normalizeCaptureNickname(42), null);
    const long = "a".repeat(39) + " bcdef";
    assert.equal(normalizeCaptureNickname(long), "a".repeat(39));
    assert.equal(normalizeCaptureNickname("é".repeat(60))?.length, CAPTURE_NICKNAME_MAX);
    // Counted in characters, so an emoji is never cut in half.
    assert.equal(Array.from(normalizeCaptureNickname("🐺".repeat(50)) ?? "").length, CAPTURE_NICKNAME_MAX);
});
