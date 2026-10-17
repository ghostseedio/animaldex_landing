import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import test from "node:test";

import {CAPTURE_CARD_THUMBNAIL_TRANSFORM, toCaptureCardThumbnailRoute} from "./capture-card-thumbnail";

const root = join(__dirname, "..");

test("the card route is the image route with /card before the query", () => {
    assert.equal(
        toCaptureCardThumbnailRoute("/api/capture-images/abc-123?bucket=captures&path=o%2Fc%2Fprimary.jpg&kind=photo"),
        "/api/capture-images/abc-123/card?bucket=captures&path=o%2Fc%2Fprimary.jpg&kind=photo"
    );
    assert.equal(toCaptureCardThumbnailRoute("/api/capture-images/abc-123"), "/api/capture-images/abc-123/card");
});

test("anything that is not a capture image route is left alone", () => {
    for (const src of [
        "/images/placeholders/species-no-image.svg",
        "https://example.supabase.co/storage/v1/object/sign/captures/x.jpg?token=t",
        "/api/capture-images/abc-123/card?bucket=captures",
        "/api/capture-media/abc-123?kind=video",
        ""
    ]) {
        assert.equal(toCaptureCardThumbnailRoute(src), src, src);
    }
});

test("the card is a bounded render, not the original", () => {
    assert.equal(CAPTURE_CARD_THUMBNAIL_TRANSFORM.width, 640);
    assert.equal(CAPTURE_CARD_THUMBNAIL_TRANSFORM.height, 480);
    assert.ok(CAPTURE_CARD_THUMBNAIL_TRANSFORM.quality < 100);
});

test("the card route checks the reference before it signs, and only signs the transform", () => {
    const source = readFileSync(join(root, "app/api/capture-images/[captureId]/card/route.ts"), "utf8");
    assert.match(source, /isServableCaptureMediaReference/);
    assert.ok(source.indexOf("isServableCaptureMediaReference(") < source.indexOf("createSignedStorageUrl("));
    assert.match(source, /CAPTURE_CARD_THUMBNAIL_TRANSFORM/);
    assert.match(source, /export const dynamic = "force-dynamic"/);
    assert.doesNotMatch(source, /proxy/);
});

test("the home page's recent-capture data never signs storage inside the render", () => {
    // A `cache: "no-store"` fetch during an ISR render sets the route's
    // revalidate to 0 (Next 13.5 patch-fetch), so signing belongs in the
    // request-time route, not in the data layer the home page calls.
    const timeline = readFileSync(join(root, "data/discover-timeline.ts"), "utf8");
    assert.doesNotMatch(timeline, /createSignedStorageUrl|signHomeFeatureCaptureImages|cache:\s*["']no-store["']/);
    assert.match(timeline, /toCaptureCardThumbnailRoute/);
});
