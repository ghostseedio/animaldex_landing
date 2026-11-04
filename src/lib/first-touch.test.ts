import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {firstTouchFromLocation, parseFirstTouch, serializeFirstTouch} from "./first-touch";

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
});
