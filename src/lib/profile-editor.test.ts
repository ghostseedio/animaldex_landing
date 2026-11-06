import assert from "node:assert/strict";
import test from "node:test";
import {
    captureGridChoices,
    captureGridSortToSave,
    clampBio,
    moderationRejection,
    normalizeInstagramUrl,
    normalizeUsername,
    parseCaptureGridSort,
    usernameFormatProblem
} from "@/lib/profile-editor";

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

test("every grid sort the apps save reads back as itself (iOS ProfileCaptureGridSort.parse)", () => {
    assert.equal(parseCaptureGridSort("stars"), "stars");
    assert.equal(parseCaptureGridSort(" Custom "), "custom");
    assert.equal(parseCaptureGridSort("index"), "index");
    assert.equal(parseCaptureGridSort(null), "recent");
    assert.equal(parseCaptureGridSort("shuffle"), "recent");
});

test("a save writes only a grid sort the apps know, and leaves the stored one otherwise", () => {
    assert.equal(captureGridSortToSave("stars"), "stars");
    assert.equal(captureGridSortToSave("custom"), "custom");
    assert.equal(captureGridSortToSave("RECENT"), "recent");
    // Missing or unknown: null, so the update leaves capture_grid_sort as it is.
    assert.equal(captureGridSortToSave(undefined), null);
    assert.equal(captureGridSortToSave(""), null);
    assert.equal(captureGridSortToSave("shuffle"), null);
});

test("Edit profile offers recent, index and stars, and custom only while it is the saved grid", () => {
    assert.deepEqual(captureGridChoices("recent"), ["recent", "index", "stars"]);
    assert.deepEqual(captureGridChoices("stars"), ["recent", "index", "stars"]);
    assert.deepEqual(captureGridChoices("custom"), ["recent", "index", "stars", "custom"]);
});
