import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {
    acquisitionTouch,
    FIRST_TOUCH_MAX_AGE_SECONDS,
    firstTouchCookie,
    firstTouchFromLocation,
    firstTouchRemainingSeconds,
    parseFirstTouch,
    serializeFirstTouch,
    withHeroAssignment
} from "./first-touch";

const now = new Date("2026-11-04T00:00:00Z");

describe("first touch", () => {
    it("keeps the landing page, the referring site and campaign tags", () => {
        const touch = firstTouchFromLocation("https://animaldex.app/animals/red-fox?utm_source=tiktok&utm_campaign=fox", "https://www.google.com/", now);
        assert.deepEqual(touch, {landing_path: "/animals/red-fox", referrer_host: "google.com", at: now.toISOString(), utm_source: "tiktok", utm_campaign: "fox"});
    });

    it("ignores our own site as a referrer: that is a later page of the same visit", () => {
        assert.equal(firstTouchFromLocation("https://animaldex.app/talk", "https://www.animaldex.app/animals/fox", now), null);
    });

    it("round-trips through the cookie and rejects junk", () => {
        const touch = firstTouchFromLocation("https://animaldex.app/", "", now)!;
        assert.deepEqual(parseFirstTouch(serializeFirstTouch(touch)), touch);
        assert.equal(parseFirstTouch("not json"), null);
        assert.equal(parseFirstTouch(encodeURIComponent(JSON.stringify({landing_path: "https://evil.example"}))), null);
    });

    it("keeps the hero variant and the funnel's visitor id, and only valid ones", () => {
        const touch = firstTouchFromLocation("https://animaldex.app/", "https://www.tiktok.com/", now)!;
        const assigned = withHeroAssignment(touch, "b", "abcdefgh12345678abcd");
        assert.equal(assigned.hero, "b");
        assert.equal(assigned.vid, "abcdefgh12345678abcd");
        assert.deepEqual(parseFirstTouch(serializeFirstTouch(assigned)), assigned);
        // Assigned once: a later view keeps the first variant and id.
        assert.deepEqual(withHeroAssignment(assigned, "a", "zzzzzzzzzzzzzzzzzzzz"), assigned);
        const junk = parseFirstTouch(encodeURIComponent(JSON.stringify({landing_path: "/", at: "", hero: "c", vid: "x<y"})));
        assert.equal(junk?.hero, undefined);
        assert.equal(junk?.vid, undefined);
    });

    it("hands record_user_acquisition the attribution only", () => {
        const touch = withHeroAssignment(
            firstTouchFromLocation("https://animaldex.app/?utm_source=tiktok", "https://www.tiktok.com/", now)!,
            "a",
            "abcdefgh12345678abcd"
        );
        assert.deepEqual(acquisitionTouch(touch), {landing_path: "/", referrer_host: "tiktok.com", utm_source: "tiktok"});
    });

    it("rewriting the cookie keeps the first visit's expiry", () => {
        const touch = firstTouchFromLocation("https://animaldex.app/", "", now)!;
        assert.equal(firstTouchRemainingSeconds(touch, now.getTime()), FIRST_TOUCH_MAX_AGE_SECONDS);
        assert.equal(firstTouchRemainingSeconds(touch, now.getTime() + 10 * 86_400_000), FIRST_TOUCH_MAX_AGE_SECONDS - 10 * 86_400);
        assert.equal(firstTouchRemainingSeconds(touch, now.getTime() + 400 * 86_400_000), 86_400, "never less than a day");
        assert.match(firstTouchCookie(touch, {secure: true, maxAgeSeconds: 60}), /^adx_ft=%7B.*; Max-Age=60; Path=\/; SameSite=Lax; Secure$/);
        assert.doesNotMatch(firstTouchCookie(touch, {secure: false}), /Secure/);
    });
});
