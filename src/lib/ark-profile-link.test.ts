import assert from "node:assert/strict";
import test from "node:test";
import {arkOpenProfileMessage, arkProfileHref, postArkOpenProfile} from "./ark-profile-link";

test("a bringer's @username reaches the app: the bridge message on iOS and Android, a real /u/{handle} link everywhere", () => {
    assert.deepEqual(arkOpenProfileMessage("@lendawg"), {type: "ark:open-profile", handle: "lendawg"});
    // iOS (WKWebView): the message object, through the same handler as the embed.
    const ios: unknown[] = [];
    assert.equal(postArkOpenProfile({webkit: {messageHandlers: {ark: {postMessage: (message) => ios.push(message)}}}}, "lendawg"), true);
    assert.deepEqual(ios, [{type: "ark:open-profile", handle: "lendawg"}]);
    // Android (the JavaScript interface takes text): the same message as JSON.
    const android: string[] = [];
    assert.equal(postArkOpenProfile({AndroidArk: {postMessage: (text) => android.push(text)}}, "mayachen"), true);
    assert.deepEqual(JSON.parse(android[0]), {type: "ark:open-profile", handle: "mayachen"});
    // The open web (no bridge), or a bridge that throws: nothing posted, the real link navigates.
    assert.equal(postArkOpenProfile({}, "lendawg"), false);
    assert.equal(postArkOpenProfile(null, "lendawg"), false);
    assert.equal(postArkOpenProfile({AndroidArk: {postMessage: () => { throw new Error("gone"); }}}, "lendawg"), false);
    // The real link the apps intercept: /u/{handle} (the site's locale prefix for Indonesian), never a client-side route.
    assert.equal(arkProfileHref("lendawg"), "/u/lendawg");
    assert.equal(arkProfileHref("@ana.rios", "en"), "/u/ana.rios");
    assert.equal(arkProfileHref("ana.rios", "id"), "/id/u/ana.rios");
});
