import assert from "node:assert/strict";
import test from "node:test";
import {appStoreLink, detectStorePlatform, googlePlayLink, orderedStores, pageStorePlacement, shareReferralCode, storeHref} from "./store-links";

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

test("a Play link clicked on a page names that page in utm_content", () => {
    assert.equal(
        googlePlayLink("page_animals", null, "/animals/red-fox"),
        "https://play.google.com/store/apps/details?id=app.animaldex&referrer=utm_source%3Dweb%26utm_campaign%3Dpage_animals%26utm_content%3D%252Fanimals%252Fred-fox"
    );
    assert.equal(storeHref("app_store", "page_animals", null, "/animals/red-fox"), appStoreLink("page_animals"));
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

test("a fixed utm_content wins over the page path, on both stores, and a hand-off rides the Play referrer (CC 2)", () => {
    assert.equal(
        googlePlayLink("tierlist", null, "/tier-list/strongest-animals", {content: "tierlist_strongest-animals"}),
        "https://play.google.com/store/apps/details?id=app.animaldex&referrer=utm_source%3Dweb%26utm_campaign%3Dtierlist%26utm_content%3Dtierlist_strongest-animals"
    );
    assert.equal(appStoreLink("tierlist", "", {content: "tierlist_strongest-animals"}), "https://apps.apple.com/app/6761607780?ct=tierlist&utm_content=tierlist_strongest-animals");
    const id = "6f1d2c3b-4a5e-4f60-8b7c-9d0e1f2a3b4c";
    assert.equal(
        storeHref("google_play", "ask_limit", null, "/animals/blue-whale", {content: "ask_limit", handoff: id}),
        `https://play.google.com/store/apps/details?id=app.animaldex&referrer=utm_source%3Dweb%26utm_campaign%3Dask_limit%26utm_content%3Dask_limit%26handoff%3D${id}`
    );
    // A bad id, or none, changes nothing; the existing links are byte for byte what they were.
    assert.equal(storeHref("google_play", "ask_limit", null, null, {handoff: "<script>"}), googlePlayLink("ask_limit"));
    assert.equal(storeHref("app_store", "ask_limit", null, null, {}), appStoreLink("ask_limit"));
    assert.equal(googlePlayLink("page_animals", null, "/animals/red-fox", {content: "  "}), googlePlayLink("page_animals", null, "/animals/red-fox"));
});

test("the store is chosen from the user agent after hydration: iOS to the App Store, Android to Play, a desktop to neither", () => {
    assert.equal(detectStorePlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15"), "app_store");
    assert.equal(detectStorePlatform("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)"), "app_store");
    // iPadOS Safari says Macintosh; touch gives it away.
    assert.equal(detectStorePlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15", 5), "app_store");
    assert.equal(detectStorePlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15", 0), null);
    assert.equal(detectStorePlatform("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36"), "google_play");
    assert.equal(detectStorePlatform("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130"), null);
    assert.equal(detectStorePlatform(null), null);
    assert.deepEqual(orderedStores("google_play"), ["google_play", "app_store"]);
    assert.deepEqual(orderedStores("app_store"), ["app_store", "google_play"]);
    assert.deepEqual(orderedStores(null), ["app_store", "google_play"]);
});
