import assert from "node:assert/strict";
import test from "node:test";
import {clampBio, moderationRejection, normalizeInstagramUrl, normalizeUsername, usernameFormatProblem} from "@/lib/profile-editor";

test("usernames are trimmed, lose their @ and are lowercased", () => {
    assert.equal(normalizeUsername("  @Red.Fox_99 "), "red.fox_99");
});

test("username rules match iOS", () => {
    assert.deepEqual(usernameFormatProblem(""), {kind: "invalid", message: "Username is required."});
    assert.deepEqual(usernameFormatProblem("red fox"), {kind: "invalid", message: "Use letters, numbers, underscores, or dots."});
    assert.deepEqual(usernameFormatProblem("animaldex"), {kind: "taken"});
    assert.equal(usernameFormatProblem("rubah.merah"), null);
});

test("a bare Instagram handle becomes a profile URL", () => {
    assert.equal(normalizeInstagramUrl("@wild.lens"), "https://instagram.com/wild.lens");
    assert.equal(normalizeInstagramUrl("https://instagram.com/x"), "https://instagram.com/x");
    assert.equal(normalizeInstagramUrl("  "), null);
});

test("bios stop at 160 characters and abusive text is refused", () => {
    assert.equal(clampBio("a".repeat(200)).length, 160);
    assert.match(moderationRejection("Go Die") ?? "", /objectionable/);
    assert.equal(moderationRejection("I photograph herons"), null);
});
