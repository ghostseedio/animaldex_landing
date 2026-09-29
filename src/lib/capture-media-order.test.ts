import assert from "node:assert/strict";
import test from "node:test";
import {
    type OrderableCaptureMedia,
    coverFirstMediaOrder,
    isAnalysisSourceStill,
    timelineMediaOrder
} from "@/lib/capture-media-order";

const at = (time: string) => Date.parse(`2026-09-25T${time}Z`);

function media(id: string, kind: OrderableCaptureMedia["kind"], sortOrder: number, createdAt: number | null): OrderableCaptureMedia {
    return {id, kind, sortOrder, createdAt};
}

const ids = (assets: OrderableCaptureMedia[]) => assets.map((asset) => asset.id);

test("a photo-only card leads with its newest extra and ends on the analysis still", () => {
    const ordered = timelineMediaOrder([
        media("cover", "photo", 0, at("06:40:00")),
        media("first-extra", "photo", 1, at("06:41:54")),
        media("second-extra", "photo", 2, at("06:48:23"))
    ]);
    assert.deepEqual(ids(ordered), ["second-extra", "first-extra", "cover"]);
});

test("recency decides between extras, not the numbering a writer happened to use", () => {
    const ordered = timelineMediaOrder([
        media("numbered-high-but-old", "photo", 5, at("06:00:00")),
        media("numbered-low-but-new", "photo", 1, at("07:00:00"))
    ]);
    assert.deepEqual(ids(ordered), ["numbered-low-but-new", "numbered-high-but-old"]);
});

test("moving media leads, and the analysis still is not a page beside it", () => {
    const ordered = timelineMediaOrder([
        media("cover", "photo", 0, at("06:40:00")),
        media("loop", "loop", 1, at("06:41:00")),
        media("video", "video", 2, at("06:42:00")),
        media("extra", "photo", 3, at("06:43:00"))
    ]);
    assert.deepEqual(ids(ordered), ["video", "loop", "extra"]);
});

test("a row with a timestamp sorts ahead of one without", () => {
    const ordered = timelineMediaOrder([
        media("undated", "photo", 2, null),
        media("dated", "photo", 1, at("06:00:00"))
    ]);
    assert.deepEqual(ids(ordered), ["dated", "undated"]);
});

test("the detail carousel keeps the persisted cover first and drops nothing", () => {
    const ordered = coverFirstMediaOrder([
        media("video", "video", 2, at("06:42:00")),
        media("extra", "photo", 1, at("06:43:00")),
        media("cover", "photo", 0, at("06:40:00"))
    ]);
    assert.deepEqual(ids(ordered), ["cover", "extra", "video"]);
});

test("a single asset is returned as it came, in either order", () => {
    const only = [media("cover", "photo", 0, null)];
    assert.equal(timelineMediaOrder(only), only);
    assert.equal(coverFirstMediaOrder(only), only);
});

test("only the photo at position zero is the analysis still", () => {
    assert.equal(isAnalysisSourceStill({kind: "photo", sortOrder: 0}), true);
    assert.equal(isAnalysisSourceStill({kind: "photo", sortOrder: 1}), false);
    assert.equal(isAnalysisSourceStill({kind: "video", sortOrder: 0}), false);
});
