import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import test from "node:test";
import {isCaptureMediaBucket, isCaptureMediaPath, isServableCaptureMediaReference} from "@/lib/capture-storage-reference";

const OWNER = "138bd2bc-af58-4e51-ac92-3df6161d53db";
const CAPTURE = "fff28a92-e96e-4e55-9ccb-eae132282f13";

test("every shape capture media is actually stored under is servable", () => {
    for (const [bucket, file] of [
        ["captures", "primary.jpg"],
        ["captures", `extra-${CAPTURE}.jpg`],
        ["captures", "extra-1758900000-8218.jpg"],
        ["capture-media", `extra-${CAPTURE}.mp4`],
        ["capture-media", "extra-1758900000-8218.mp4"],
        ["capture-media", "loop.mov"]
    ]) {
        assert.equal(isServableCaptureMediaReference(bucket, `${OWNER}/${CAPTURE}/${file}`), true, `${bucket}/${file}`);
    }
    assert.equal(isServableCaptureMediaReference("captures", `${OWNER.toUpperCase()}/${CAPTURE.toUpperCase()}/primary.jpg`), true);
});

test("no other bucket is ever signed, whatever the path", () => {
    const path = `${OWNER}/${CAPTURE}/primary.jpg`;
    for (const bucket of ["journal-proofs", "payout-documents", "avatars", "admin-assets", "Captures", "captures/", "", null, undefined]) {
        assert.equal(isServableCaptureMediaReference(bucket, path), false, String(bucket));
        assert.equal(isCaptureMediaBucket(bucket), false, String(bucket));
    }
});

test("a path outside an owner's capture folder is refused", () => {
    for (const path of [
        `${OWNER}/animal-trials/${CAPTURE}-low/clip.mp4`,
        `${OWNER}/primary.jpg`,
        `primary.jpg`,
        `${OWNER}/${CAPTURE}`,
        `${OWNER}/${CAPTURE}/`,
        `/${OWNER}/${CAPTURE}/primary.jpg`,
        `${OWNER}/${CAPTURE}/../${CAPTURE}/primary.jpg`,
        `${OWNER}/${CAPTURE}/..%2Fsecret.jpg`,
        `${OWNER}/${CAPTURE}/a/b/c/d.jpg`,
        `${OWNER}/${CAPTURE}/.hidden`,
        `${OWNER}/${CAPTURE}/pri mary.jpg`,
        `${OWNER}\\${CAPTURE}\\primary.jpg`,
        `${OWNER}/${CAPTURE}/${"a".repeat(600)}.jpg`,
        "",
        null
    ]) {
        assert.equal(isCaptureMediaPath(path), false, String(path));
    }
});

test("both public routes check the reference before signing it", () => {
    const root = join(__dirname, "..");
    const images = readFileSync(join(root, "app/api/capture-images/[captureId]/route.ts"), "utf8");
    const media = readFileSync(join(root, "app/api/capture-media/[captureId]/route.ts"), "utf8");

    for (const [name, source] of [["capture-images", images], ["capture-media", media]] as const) {
        assert.match(source, /isServableCaptureMediaReference/, name);
        assert.ok(
            source.indexOf("isServableCaptureMediaReference(") < source.indexOf("createSignedStorageUrl("),
            `${name} must refuse before it signs`
        );
    }
});
