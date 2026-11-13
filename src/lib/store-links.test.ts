import assert from "node:assert/strict";
import test from "node:test";
import {
    appStoreCampaignToken,
    appStoreLink,
    buildStoreUrl,
    googlePlayLink,
    isWebsiteStoreSource,
    pageStorePlacement,
    shareReferralCode,
    SOCIAL_BIO_PLATFORMS,
    socialBioStoreUrl,
    storeHref,
    storeLinkPage
} from "./store-links";

const PLAY = "https://play.google.com/store/apps/details?id=app.animaldex&referrer=";

test("buildStoreUrl: the App Store link carries pt, ct (the surface) and mt, and nothing without the provider token", () => {
    assert.equal(buildStoreUrl({store: "app_store", surface: "home_hero", page: "/", button: "badge", providerToken: ""}), "https://apps.apple.com/app/6761607780");
    assert.equal(
        buildStoreUrl({store: "app_store", surface: "home_hero", page: "/", button: "badge", providerToken: "123456"}),
        "https://apps.apple.com/app/6761607780?pt=123456&ct=home_hero&mt=8"
    );
    assert.equal(appStoreCampaignToken("animaldex_web", "home_hero"), "home_hero");
    assert.equal(appStoreCampaignToken("tiktok", "bio"), "tiktok_bio");
    // Apple's charset: lower-case letters, digits, _ and -, at most 40 characters.
    assert.equal(appStoreCampaignToken("animaldex_web", "Tier List/Apex!"), "tier_list_apex");
    assert.equal(appStoreCampaignToken("animaldex_web", "x".repeat(50)).length, 40);
});

test("buildStoreUrl: the Play install referrer names the source, the surface, the page and the button", () => {
    assert.equal(
        buildStoreUrl({store: "google_play", surface: "home_hero", page: "/", button: "badge"}),
        `${PLAY}utm_source%3Danimaldex_web%26utm_medium%3Dhome_hero%26utm_campaign%3D%252F%26utm_content%3Dbadge`
    );
    // Another branch's buttons (CC 2: tier lists, the Ask limit) go through the same helper.
    assert.equal(
        buildStoreUrl({store: "google_play", surface: "page_tier-list", page: "/tier-list/apex-predators", button: "tierlist_apex-predators"}),
        `${PLAY}utm_source%3Danimaldex_web%26utm_medium%3Dpage_tier-list%26utm_campaign%3D%252Ftier-list%252Fapex-predators%26utm_content%3Dtierlist_apex-predators`
    );
    // Without a page there is no utm_campaign.
    assert.equal(buildStoreUrl({store: "google_play", surface: "chat_limit", button: "ask_limit"}), `${PLAY}utm_source%3Danimaldex_web%26utm_medium%3Dchat_limit%26utm_content%3Dask_limit`);
    // A shared link's referral code rides along; an implausible one is dropped.
    assert.equal(
        buildStoreUrl({store: "google_play", surface: "share_sheet", page: "/p/abc", button: "link", referral: "a1b2c3d4"}),
        `${PLAY}utm_source%3Danimaldex_web%26utm_medium%3Dshare_sheet%26utm_campaign%3D%252Fp%252Fabc%26utm_content%3Dlink%26ref%3Da1b2c3d4`
    );
    assert.equal(
        buildStoreUrl({store: "google_play", surface: "share_sheet", page: "/p/abc", button: "link", referral: "abc&utm_campaign=x"}),
        buildStoreUrl({store: "google_play", surface: "share_sheet", page: "/p/abc", button: "link"})
    );
});

test("the social bio links: utm_source is the platform, utm_medium bio", () => {
    assert.deepEqual([...SOCIAL_BIO_PLATFORMS], ["tiktok", "instagram", "youtube", "x"]);
    for (const platform of SOCIAL_BIO_PLATFORMS) {
        assert.equal(socialBioStoreUrl(platform, "google_play", ""), `${PLAY}utm_source%3D${platform}%26utm_medium%3Dbio%26utm_campaign%3Dprofile%26utm_content%3Dlink_in_bio`);
        assert.equal(socialBioStoreUrl(platform, "app_store", "123456"), `https://apps.apple.com/app/6761607780?pt=123456&ct=${platform}_bio&mt=8`);
        assert.equal(socialBioStoreUrl(platform, "app_store", ""), "https://apps.apple.com/app/6761607780");
    }
});

test("older callers build the same links: a surface alone, or a surface and the page", () => {
    assert.equal(appStoreLink("species_hero", ""), "https://apps.apple.com/app/6761607780");
    assert.equal(appStoreLink("home_download", "123456"), "https://apps.apple.com/app/6761607780?pt=123456&ct=home_download&mt=8");
    assert.equal(googlePlayLink("chat_limit"), `${PLAY}utm_source%3Danimaldex_web%26utm_medium%3Dchat_limit%26utm_content%3Dlink`);
    assert.equal(
        googlePlayLink("page_animals", null, "/animals/red-fox"),
        `${PLAY}utm_source%3Danimaldex_web%26utm_medium%3Dpage_animals%26utm_campaign%3D%252Fanimals%252Fred-fox%26utm_content%3Dlink`
    );
    assert.equal(googlePlayLink("share_sheet", "a1b2c3d4"), `${PLAY}utm_source%3Danimaldex_web%26utm_medium%3Dshare_sheet%26utm_content%3Dlink%26ref%3Da1b2c3d4`);
    assert.equal(storeHref("google_play", "share_sheet"), googlePlayLink("share_sheet"));
    assert.equal(storeHref("app_store", "page_animals", null, "/animals/red-fox"), appStoreLink("page_animals"));
    assert.equal(storeHref("app_store", "share_sheet", "a1b2c3d4"), appStoreLink("share_sheet"));
});

test("the admin's web-install gate accepts the new source and the old one", () => {
    assert.equal(isWebsiteStoreSource("animaldex_web"), true);
    assert.equal(isWebsiteStoreSource("web"), true);
    assert.equal(isWebsiteStoreSource("tiktok"), false);
    assert.equal(isWebsiteStoreSource(null), false);
});

test("the page a store link is on is the path without the locale prefix", () => {
    assert.equal(storeLinkPage("/id/animals/fox"), "/animals/fox");
    assert.equal(storeLinkPage("/animals/fox/"), "/animals/fox");
    assert.equal(storeLinkPage("/"), "/");
    assert.equal(storeLinkPage(null), "/");
});

test("a generic store button is named after the page's section", () => {
    assert.equal(pageStorePlacement("/comparisons/tiger-vs-lion"), "page_comparisons");
    assert.equal(pageStorePlacement("/id/animal-powers/wolf"), "page_animal-powers");
    assert.equal(pageStorePlacement("/"), "page_home");
    assert.equal(pageStorePlacement(null), "page_home");
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
