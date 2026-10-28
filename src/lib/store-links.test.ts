import assert from "node:assert/strict";
import test from "node:test";
import {appStoreLink, googlePlayLink, pageStorePlacement, storeHref} from "./store-links";

test("App Store links carry the placement, and the provider token once it is set", () => {
    assert.equal(appStoreLink("species_hero", ""), "https://apps.apple.com/app/6761607780?ct=species_hero");
    assert.equal(
        appStoreLink("home_download", "123456"),
        "https://apps.apple.com/app/6761607780?pt=123456&ct=home_download&mt=8"
    );
});

test("Play links carry the placement in the install referrer", () => {
    assert.equal(
        googlePlayLink("chat_limit"),
        "https://play.google.com/store/apps/details?id=app.animaldex&referrer=utm_source%3Dweb%26utm_campaign%3Dchat_limit"
    );
    assert.equal(storeHref("google_play", "share_sheet"), googlePlayLink("share_sheet"));
});

test("a generic store button is named after the page's section", () => {
    assert.equal(pageStorePlacement("/comparisons/tiger-vs-lion"), "page_comparisons");
    assert.equal(pageStorePlacement("/id/animal-powers/wolf"), "page_animal-powers");
    assert.equal(pageStorePlacement("/"), "page_home");
    assert.equal(pageStorePlacement(null), "page_home");
});
