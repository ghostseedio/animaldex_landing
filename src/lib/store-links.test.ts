import assert from "node:assert/strict";
import test from "node:test";
import {appStoreLink, googlePlayLink, pageStorePlacement, shareReferralCode, storeHref} from "./store-links";

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

test("a shared link's referral code rides in the Play install referrer, not on the App Store link", () => {
    assert.equal(
        googlePlayLink("share_sheet", "a1b2c3d4"),
        "https://play.google.com/store/apps/details?id=app.animaldex&referrer=utm_source%3Dweb%26utm_campaign%3Dshare_sheet%26ref%3Da1b2c3d4"
    );
    // Without a code the link is exactly what it was.
    assert.equal(storeHref("google_play", "share_sheet", null), googlePlayLink("share_sheet"));
    assert.equal(storeHref("app_store", "share_sheet", "a1b2c3d4"), appStoreLink("share_sheet"));
});

test("only a plausible referral code is read from a query string", () => {
    assert.equal(shareReferralCode("?ref=a1b2c3d4"), "a1b2c3d4");
    assert.equal(shareReferralCode("?utm_source=x&ref=Lenny_42"), "Lenny_42");
    assert.equal(shareReferralCode("?ref=%20a1b2c3d4%20"), "a1b2c3d4");
    assert.equal(shareReferralCode(""), null);
    assert.equal(shareReferralCode(null), null);
    assert.equal(shareReferralCode("?other=1"), null);
    assert.equal(shareReferralCode("?ref="), null);
    assert.equal(shareReferralCode("?ref=ab"), null);
    // Nothing that could add another key to the install referrer.
    assert.equal(shareReferralCode("?ref=abc%26utm_campaign%3Dx"), null);
    assert.equal(shareReferralCode(`?ref=${"a".repeat(41)}`), null);
});
