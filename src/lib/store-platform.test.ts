import assert from "node:assert/strict";
import test from "node:test";
import {otherStore, storePlatformFromUserAgent} from "./store-platform";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Mobile/15E148 Safari/604.1";
const IPAD_AS_MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Safari/605.1.15";
const ANDROID = "Mozilla/5.0 (Linux; Android 16; Pixel 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0 Mobile Safari/537.36";
const WINDOWS = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0 Safari/537.36";

test("the device's own store: iPhone and iPad to the App Store, Android to Google Play, a desktop to neither", () => {
    assert.equal(storePlatformFromUserAgent(IPHONE), "app_store");
    assert.equal(storePlatformFromUserAgent(IPHONE.replace("iPhone", "iPad")), "app_store");
    // iPadOS reports itself as a Mac: the touch screen tells it apart.
    assert.equal(storePlatformFromUserAgent(IPAD_AS_MAC, 5), "app_store");
    assert.equal(storePlatformFromUserAgent(IPAD_AS_MAC, 0), null);
    assert.equal(storePlatformFromUserAgent(ANDROID), "google_play");
    assert.equal(storePlatformFromUserAgent(WINDOWS), null);
    assert.equal(storePlatformFromUserAgent(null), null);
    assert.equal(storePlatformFromUserAgent(""), null);
});

test("the other store, for the text link", () => {
    assert.equal(otherStore("app_store"), "google_play");
    assert.equal(otherStore("google_play"), "app_store");
});
