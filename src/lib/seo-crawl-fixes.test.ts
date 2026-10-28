import {test} from "node:test";
import assert from "node:assert/strict";
import {closedSeoRedirectPath} from "./closed-seo-namespaces";
import publishedSeoSlugs from "../data/published-seo-slugs.json";
import {analyticsEventParameters, storeForHref} from "./analytics";

// Oct 2026 Search Console: 1,322 404s, mostly retired /qualities slugs and
// lesson URLs that kept their catalog number. They now 308 to a live page.

test("retired qualities go to the hub, numbered animal and lesson slugs to their base", () => {
    assert.equal(closedSeoRedirectPath("/qualities/distinctive-design"), "/qualities");
    assert.equal(closedSeoRedirectPath("/id/qualities/acceleration"), "/id/qualities");
    const lesson = publishedSeoSlugs.lessons.find((slug) => !/-\d+$/.test(slug))!;
    assert.equal(closedSeoRedirectPath(`/animal-powers/${lesson}-1674`), `/animal-powers/${lesson}`);
    const animal = publishedSeoSlugs.animals.find((slug) => !/-\d+$/.test(slug))!;
    assert.equal(closedSeoRedirectPath(`/animals/${animal}-42`), `/animals/${animal}`);
    assert.equal(closedSeoRedirectPath("/animals/no-such-animal-at-all"), null);
    assert.equal(closedSeoRedirectPath(`/animals/${animal}`), null);
});

test("store clicks are recognised for both stores and nothing else", () => {
    assert.equal(storeForHref("https://apps.apple.com/app/6761607780"), "app_store");
    assert.equal(storeForHref("https://play.google.com/store/apps/details?id=app.animaldex"), "google_play");
    assert.equal(storeForHref("https://animaldex.app/talk-to-animals"), null);
    assert.equal(storeForHref(null), null);
});

test("UI labels never reach GA4 as traffic-source parameters", () => {
    assert.deepEqual(analyticsEventParameters({source: "drawer", species: "cheetah", medium: "x"}), {ui_source: "drawer", species: "cheetah", ui_medium: "x"});
});
