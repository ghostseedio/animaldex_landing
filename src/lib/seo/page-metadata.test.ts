import assert from "node:assert/strict";
import test from "node:test";
import {buildPageMetadata, clampMetaDescription, languageAlternates, META_DESCRIPTION_MAX} from "@/lib/seo/page-metadata";

test("clampMetaDescription keeps short text, whole sentences, else cuts at a word", () => {
    assert.equal(clampMetaDescription("  A short   one. "), "A short one.");
    const two = "The Ark is one shared world of animals that everyone sees the same way and nobody places by hand at all. Animals come aboard when people capture them in real life and from then on rules run their lives.";
    const kept = clampMetaDescription(two);
    assert.equal(kept, "The Ark is one shared world of animals that everyone sees the same way and nobody places by hand at all.");
    const long = "word ".repeat(80);
    const cut = clampMetaDescription(long);
    assert.ok(cut.length <= META_DESCRIPTION_MAX, `${cut.length}`);
    assert.ok(cut.endsWith("…"));
    assert.doesNotMatch(cut, /wor…$/);
});

test("languageAlternates: every site locale plus x-default, English only where the page is", () => {
    assert.deepEqual(languageAlternates("/ark/how-it-works"), {en: "/ark/how-it-works", id: "/id/ark/how-it-works", "x-default": "/ark/how-it-works"});
    assert.deepEqual(languageAlternates("/legal/privacy", {englishOnly: true}), {en: "/legal/privacy", "x-default": "/legal/privacy"});
    // A collapsed English detail family never advertises an /id twin that redirects.
    assert.deepEqual(languageAlternates("/animals/red-fox"), {en: "/animals/red-fox", "x-default": "/animals/red-fox"});
    assert.deepEqual(languageAlternates("/"), {en: "/", id: "/id", "x-default": "/"});
});

test("buildPageMetadata: canonical per locale, one image on both cards, the brand once", () => {
    const en = buildPageMetadata({locale: "en", path: "/ark/food-chain", title: "The Ark's Food Chain: Who Eats Whom", description: "x ".repeat(120), image: "/images/og/ark.jpg", imageAlt: "The Ark"});
    assert.equal(en.alternates?.canonical, "/ark/food-chain");
    assert.equal(en.title, "The Ark's Food Chain: Who Eats Whom");
    assert.ok(String(en.description).length <= META_DESCRIPTION_MAX);
    const og = en.openGraph as {title: string; url: string; images: Array<{url: string; width: number; height: number}>};
    assert.equal(og.title, "The Ark's Food Chain: Who Eats Whom | AnimalDex");
    assert.match(og.images[0].url, /^https?:\/\/[^/]+\/images\/og\/ark\.jpg$/);
    assert.equal(og.images[0].width, 1200);
    const twitter = en.twitter as {card: string; images: Array<{url: string}>};
    assert.equal(twitter.card, "summary_large_image");
    assert.equal(twitter.images[0].url, og.images[0].url);
    assert.equal(en.robots, undefined);

    const id = buildPageMetadata({locale: "id", path: "/about", title: "Tentang AnimalDex: Dunia Riset", description: "d", image: "/a.jpg", imageAlt: "a"});
    assert.equal(id.alternates?.canonical, "/id/about");
    // A title that names the brand is used as is, never "… | AnimalDex" twice.
    assert.deepEqual(id.title, {absolute: "Tentang AnimalDex: Dunia Riset"});
    assert.deepEqual((id.alternates?.languages as Record<string, string>)["x-default"], "/about");

    const hidden = buildPageMetadata({locale: "en", path: "/x", title: "X", description: "d", image: "/a.jpg", imageAlt: "a", noindex: true});
    assert.deepEqual(hidden.robots, {index: false, follow: true});
});
