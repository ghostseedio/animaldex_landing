import assert from "node:assert/strict";
import test from "node:test";
import {
    captureEntryFromParam,
    captureSourceForEntry,
    libraryNeedsPlace,
    needsCaptureRules,
    plusItemInput,
    takePhotoOpensCameraApp
} from "@/lib/capture-entry";

// The chat's "+" (the owner, 2026-11-06): the same statements the iOS and
// Android entry tests make.

test("only the two plus entries are read from the query", () => {
    assert.equal(captureEntryFromParam("camera"), "camera");
    assert.equal(captureEntryFromParam("library"), "library");
    assert.equal(captureEntryFromParam(["library"]), "library");
    assert.equal(captureEntryFromParam("scanner"), null);
    assert.equal(captureEntryFromParam(undefined), null);
});

test("a camera-app still is a live capture; a roll pick is a library upload", () => {
    assert.equal(captureSourceForEntry("camera"), "live_camera");
    assert.equal(captureSourceForEntry("library"), "camera_roll");
});

test("Take a photo opens the camera app only where there is one", () => {
    assert.equal(takePhotoOpensCameraApp(true), true);
    assert.equal(takePhotoOpensCameraApp(false), false);
});

test("the rules are asked before a library pick, never before a live shot", () => {
    assert.equal(needsCaptureRules("library", null, 1), true);
    assert.equal(needsCaptureRules("library", 0, 1), true);
    assert.equal(needsCaptureRules("library", 1, 1), false);
    assert.equal(needsCaptureRules("camera", null, 1), false);
});

test("a library photo waits for a confirmed place; a live shot does not", () => {
    assert.equal(libraryNeedsPlace("camera_roll", false), true);
    assert.equal(libraryNeedsPlace("camera_roll", true), false);
    assert.equal(libraryNeedsPlace("live_camera", false), false);
});

test("the camera item asks the camera app; the roll item takes photos only", () => {
    assert.deepEqual(plusItemInput("camera"), {accept: "image/*", capture: "environment"});
    assert.equal(plusItemInput("library").capture, undefined);
    assert.match(plusItemInput("library").accept, /image\/jpeg/);
    assert.doesNotMatch(plusItemInput("library").accept, /video/);
});
