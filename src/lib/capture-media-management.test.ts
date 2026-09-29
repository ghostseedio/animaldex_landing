import assert from "node:assert/strict";
import test from "node:test";
import {
    type ManagedCaptureMedia,
    canBecomeCover,
    deleteConfirmAction,
    deleteConfirmTitle,
    galleryTitle,
    isDeletableMedia,
    isEligibleToMarkAsPet,
    mediaDaySections,
    mediaKindBadge,
    mediaMutationMessage
} from "@/lib/capture-media-management";

function media(overrides: Partial<ManagedCaptureMedia> & {id: string}): ManagedCaptureMedia {
    return {kind: "photo", sortOrder: 1, mediaRowId: overrides.id, ...overrides};
}

const cover = media({id: "cover", sortOrder: 0});
const extra = media({id: "extra", sortOrder: 1});
const merged = media({id: "merged", sortOrder: 2, hasIndependentAnalysis: true});
const video = media({id: "video", kind: "video", sortOrder: 3});

test("the analysis photo is never deletable; everything above it is", () => {
    assert.equal(isDeletableMedia(cover), false);
    assert.equal(isDeletableMedia(extra), true);
    assert.equal(isDeletableMedia(merged), true);
    assert.equal(isDeletableMedia(video), true);
});

test("media without a row behind it cannot be changed at all", () => {
    const placeholder = media({id: "fallback", sortOrder: 1, mediaRowId: null, hasIndependentAnalysis: true});
    assert.equal(isDeletableMedia(placeholder), false);
    assert.equal(canBecomeCover(placeholder, 1), false);
});

test("only an analysed shot can become the cover, and never page zero", () => {
    assert.equal(canBecomeCover(merged, 2), true);
    assert.equal(canBecomeCover(extra, 1), false, "an unanalysed extra");
    assert.equal(canBecomeCover(video, 3), false, "an unanalysed video");
    assert.equal(canBecomeCover(cover, 0), false, "already the cover");
    assert.equal(canBecomeCover(merged, 0), false, "already page zero");
});

test("a merged re-capture is an analysis image, not extra media", () => {
    assert.equal(mediaKindBadge(cover), "Analysis image");
    assert.equal(mediaKindBadge(merged), "Analysis image");
    assert.equal(mediaKindBadge(extra), "Extra media");
});

test("titles and confirmations count what they describe", () => {
    assert.equal(galleryTitle(1, {isSelecting: false, selectedCount: 0}), "1 Photo");
    assert.equal(galleryTitle(7, {isSelecting: false, selectedCount: 0}), "7 Items");
    assert.equal(galleryTitle(7, {isSelecting: true, selectedCount: 0}), "Select Media");
    assert.equal(galleryTitle(7, {isSelecting: true, selectedCount: 3}), "3 Selected");
    assert.equal(deleteConfirmTitle(1), "Remove this media?");
    assert.equal(deleteConfirmTitle(4), "Remove 4 items?");
    assert.equal(deleteConfirmAction(1), "Delete Media");
    assert.equal(deleteConfirmAction(4), "Delete 4 Items");
});

test("the grid groups by day, newest first, and keeps each item's carousel page", () => {
    const sections = mediaDaySections([
        media({id: "a", sortOrder: 0, createdAt: "2026-09-20T10:00:00"}),
        media({id: "b", sortOrder: 1, createdAt: "2026-09-25T09:00:00"}),
        media({id: "c", sortOrder: 2, createdAt: "2026-09-25T18:00:00"}),
        media({id: "d", sortOrder: 3, createdAt: null}),
        media({id: "e", sortOrder: 4, createdAt: "not a date"})
    ], (date) => `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`);

    assert.deepEqual(sections.map((section) => section.title), ["Recently added", "2026-9-25", "2026-9-20"]);
    assert.deepEqual(sections[0].entries.map((entry) => entry.asset.id), ["d", "e"]);
    assert.deepEqual(sections[1].entries.map((entry) => [entry.asset.id, entry.index]), [["b", 1], ["c", 2]]);
});

test("a wild or zoo animal is never a pet, whatever else the analysis says", () => {
    assert.equal(isEligibleToMarkAsPet({settingTag: "Wild", humanContext: "Pet", typeTags: ["Pet"]}), false);
    assert.equal(isEligibleToMarkAsPet({settingTag: "zoo", signals: {domestic_context_likely: true}}), false);
});

test("any one domestic signal makes a capture eligible", () => {
    assert.equal(isEligibleToMarkAsPet({settingTag: "Unknown", humanContext: "Pet"}), true);
    assert.equal(isEligibleToMarkAsPet({settingTag: "Domestic"}), true);
    assert.equal(isEligibleToMarkAsPet({settingTag: "farm"}), true);
    assert.equal(isEligibleToMarkAsPet({typeTags: ["Mammal", "Farm Animal"]}), true);
    assert.equal(isEligibleToMarkAsPet({typeTags: ["farm_animal"]}), true);
    assert.equal(isEligibleToMarkAsPet({signals: {indoorHomeLikely: true}}), true);
    assert.equal(isEligibleToMarkAsPet({signals: {indoor_home_likely: true}}), true);
    assert.equal(isEligibleToMarkAsPet({settingTag: "Unknown", typeTags: ["Bird"], signals: {likely_near_zoo: true}}), false);
    assert.equal(isEligibleToMarkAsPet({}), false);
});

test("a refusal is explained, never shown as a code", () => {
    assert.match(mediaMutationMessage("cover_requires_analysis_image"), /analysed photo/);
    assert.match(mediaMutationMessage("P0001: media_locked_or_unavailable"), /locked/);
    assert.doesNotMatch(mediaMutationMessage("something_new"), /something_new/);
});
