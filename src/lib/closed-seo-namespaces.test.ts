import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";

import closedSeoNamespaceSlugs from "@/data/closed-seo-namespace-slugs.json";
import {
    englishOnlyDetailLinkHeader,
    isClosedSeoNamespaceFamily,
    isPublishedClosedSeoSlug,
    resolveClosedSeoNamespacePath
} from "@/lib/closed-seo-namespaces";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

test("closed SEO namespaces treat unknown detail slugs as blocked", () => {
    assert.equal(isClosedSeoNamespaceFamily("animals"), true);
    assert.equal(isClosedSeoNamespaceFamily("animal-lessons"), true);
    assert.equal(isClosedSeoNamespaceFamily("pokemon-animals"), true);
    assert.equal(isClosedSeoNamespaceFamily("animal-hybrids"), true);
    assert.equal(isClosedSeoNamespaceFamily("powers"), true);
    assert.equal(isClosedSeoNamespaceFamily("blog"), false);

    assert.deepEqual(resolveClosedSeoNamespacePath("/animals/mata-mata"), {
        action: "allow",
        reason: "published",
        family: "animals",
        slug: "mata-mata"
    });
    assert.deepEqual(resolveClosedSeoNamespacePath("/animals/definitely-not-real-928341"), {
        action: "block",
        reason: "unknown-slug",
        family: "animals",
        slug: "definitely-not-real-928341"
    });
    assert.deepEqual(resolveClosedSeoNamespacePath("/animal-lessons/definitely-not-real-928341"), {
        action: "block",
        reason: "unknown-slug",
        family: "animal-lessons",
        slug: "definitely-not-real-928341"
    });
    assert.deepEqual(resolveClosedSeoNamespacePath("/powers/definitely-not-real-928341"), {
        action: "block",
        reason: "unknown-slug",
        family: "powers",
        slug: "definitely-not-real-928341"
    });
    assert.deepEqual(resolveClosedSeoNamespacePath("/pokemon-animals/definitely-not-real-928341"), {
        action: "block",
        reason: "unknown-slug",
        family: "pokemon-animals",
        slug: "definitely-not-real-928341"
    });
    assert.deepEqual(resolveClosedSeoNamespacePath("/animal-hybrids/definitely-not-real-928341"), {
        action: "block",
        reason: "unknown-slug",
        family: "animal-hybrids",
        slug: "definitely-not-real-928341"
    });
    assert.deepEqual(resolveClosedSeoNamespacePath("/animals/search"), {
        action: "allow",
        reason: "reserved",
        family: "animals",
        slug: "search"
    });
    assert.equal(resolveClosedSeoNamespacePath("/animals")?.action, "allow");
    assert.deepEqual(resolveClosedSeoNamespacePath("/powers/resilience"), {
        action: "allow",
        reason: "published",
        family: "powers",
        slug: "resilience"
    });
    assert.equal(resolveClosedSeoNamespacePath("/blog/animal-symbolism"), null);
    assert.equal(resolveClosedSeoNamespacePath("/comparisons/aardwolf-vs-nurse-shark"), null);
    assert.equal(resolveClosedSeoNamespacePath("/animals/tiger/extra")?.action, "block");
});

test("closed SEO slug index covers local Pokemon and hybrid catalogs", () => {
    assert.ok(closedSeoNamespaceSlugs.pokemon.length >= 1000);
    assert.ok(closedSeoNamespaceSlugs.hybrids.length >= 500);
    assert.equal(isPublishedClosedSeoSlug("powers", "resilience"), true);
    assert.equal(isPublishedClosedSeoSlug("powers", "definitely-not-real-928341"), false);
    assert.equal(isPublishedClosedSeoSlug("pokemon-animals", "naganadel"), true);
    assert.equal(isPublishedClosedSeoSlug("animal-hybrids", "zebra-rhino-hybrid"), true);
    assert.equal(isPublishedClosedSeoSlug("pokemon-animals", "definitely-not-real-928341"), false);
});

test("collapsed detail Link headers never advertise redirected /id URLs", () => {
    const header = englishOnlyDetailLinkHeader("https://animaldex.app", "/animals/mata-mata");
    assert.match(header, /hreflang="en"/);
    assert.match(header, /hreflang="x-default"/);
    assert.doesNotMatch(header, /hreflang="id"/);
    assert.doesNotMatch(header, /\/id\/animals\//);

    const middleware = readFileSync(join(root, "middleware.ts"), "utf8");
    const i18n = readFileSync(join(root, "i18n.ts"), "utf8");
    assert.match(middleware, /applyEnglishOnlyDetailLinkHeader/);
    assert.match(i18n, /alternateLinks: false/);
});
