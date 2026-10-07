import assert from "node:assert/strict";
import {existsSync, readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";

import {resolveClosedSeoNamespacePath} from "@/lib/closed-seo-namespaces";
import {isCollapsedEnglishDetailPath, matchCollapsedIdDetailPath} from "@/lib/english-detail-routes";
import {matchDefaultLocalePrefixedPath, splitLocalePath} from "@/lib/request-routing";
import {
    getTierListHubLanguageAlternates,
    getTranslatedTierListHub,
    getTranslatedTierListHubPath,
    getTranslatedTierListHubPaths,
    TIER_LIST_HUB_ANSWER_SLUGS,
    TRANSLATED_TIER_LIST_HUB_LANGUAGES
} from "@/data/tier-list-hub-translations";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function readRepo(...parts: string[]) {
    return readFileSync(join(repoRoot, ...parts), "utf8");
}

const HUB_COMPONENT = "src/app/[locale]/(composited)/rankings/_components/translated-tier-list-hub.tsx";

test("translated hubs exist at /pt, /es and /fr tier-list as default-locale routes", () => {
    assert.deepEqual(getTranslatedTierListHubPaths(), ["/pt/tier-list", "/es/tier-list", "/fr/tier-list"]);

    for (const language of TRANSLATED_TIER_LIST_HUB_LANGUAGES) {
        const route = join(repoRoot, "src/app/[locale]/(composited)", language, "tier-list", "page.tsx");
        assert.ok(existsSync(route), route);
        const source = readFileSync(route, "utf8");
        assert.match(source, new RegExp(`buildTranslatedTierListHubMetadata\\("${language}"\\)`));
        assert.match(source, new RegExp(`<TranslatedTierListHub language="${language}" />`));
        assert.match(source, /assertTranslatedHubLocale\(params\.locale\)/);
        assert.match(source, /export const revalidate = 86400/);
        assert.doesNotMatch(source, /searchParams|cookies\(|headers\(|force-dynamic/);
    }
});

test("translated hub URLs are not redirected, blocked or re-prefixed by routing", () => {
    for (const path of getTranslatedTierListHubPaths()) {
        assert.equal(matchDefaultLocalePrefixedPath(path), null, path);
        assert.equal(matchCollapsedIdDetailPath(path), null, path);
        assert.equal(isCollapsedEnglishDetailPath(path), false, path);
        assert.equal(resolveClosedSeoNamespacePath(path), null, path);
        // Not a next-intl locale: served by the default locale at its literal path.
        assert.deepEqual(splitLocalePath(path), {locale: "en", appPath: path});
    }

    const redirectsBlock = readRepo("next.config.js").split("async redirects()")[1]?.split("async rewrites()")[0] ?? "";
    assert.doesNotMatch(redirectsBlock, /source: ["`]\/(pt|es|fr)\//);
});

test("translated hubs are self-canonical with hreflang for every hub and x-default English", () => {
    assert.deepEqual(getTierListHubLanguageAlternates(), {
        en: "/tier-list",
        id: "/id/tier-list",
        pt: "/pt/tier-list",
        es: "/es/tier-list",
        fr: "/fr/tier-list",
        "x-default": "/tier-list"
    });

    const component = readRepo(HUB_COMPONENT);
    assert.match(component, /const path = getTranslatedTierListHubPath\(language\)/);
    assert.match(component, /canonical: path/);
    assert.match(component, /languages: getTierListHubLanguageAlternates\(\)/);
    assert.match(component, /lang=\{copy\.htmlLang\}/);
    assert.match(component, /"@type": "FAQPage"|buildTierListHubFaqSchema/);

    const englishHub = readRepo("src/app/[locale]/(composited)/rankings/page.tsx");
    assert.match(englishHub, /canonical: getLocalePath\(locale, RANKING_CANONICAL_BASE_PATH\)/);
    assert.match(englishHub, /languages: getTierListHubLanguageAlternates\(\)/);
    assert.match(englishHub, /buildTierListHubFaqSchema/);
    assert.match(englishHub, /TierListHubQuickAnswers/);
});

test("translated hub copy targets each language's query and covers every list and category", () => {
    assert.equal(getTranslatedTierListHub("pt").metaTitle, "Tier List de Animais: Os Mais Rápidos, Fortes e Inteligentes");
    assert.match(getTranslatedTierListHub("es").metaTitle, /^Tier List de Animales: /);
    assert.match(getTranslatedTierListHub("fr").metaTitle, /^Tier List des Animaux : /);

    const rankings = readRepo("src/data/rankings.ts");
    const featured = rankings.split("FEATURED_TIER_LIST_SLUGS = [")[1]?.split("]")[0] ?? "";
    for (const slug of TIER_LIST_HUB_ANSWER_SLUGS) {
        assert.match(featured, new RegExp(`"${slug}"`), `${slug} is a featured tier list`);
        assert.match(rankings, new RegExp(`slug: "${slug}"`), `${slug} exists`);
    }

    const categoryUnion = rankings.split("export type RankingCategory =")[1]?.split(";")[0] ?? "";
    const categories = Array.from(categoryUnion.matchAll(/"([a-z_]+)"/g), (match) => match[1]);
    assert.ok(categories.length > 10);

    for (const language of TRANSLATED_TIER_LIST_HUB_LANGUAGES) {
        const copy = getTranslatedTierListHub(language);
        assert.equal(getTranslatedTierListHubPath(language), `/${language}/tier-list`);
        for (const slug of TIER_LIST_HUB_ANSWER_SLUGS) {
            assert.ok(copy.lists[slug]?.question, `${language} ${slug}`);
        }
        for (const category of categories) {
            assert.ok(copy.categories[category], `${language} category ${category}`);
        }
        const answer = copy.faqAnswer("A", "B", "C", copy.lists["fastest-animals"].listName);
        assert.match(answer, /^A .*B.*C\.$/);
    }
});

test("sitemap lists the translated hubs", () => {
    const sitemap = readRepo("src/lib/build-sitemap.ts");
    assert.match(sitemap, /getTranslatedTierListHubPaths\(\)\.map\(\(path\) => \(\{url: getAbsoluteUrl\(locale, path\)\}\)\)/);
    const englishBranch = sitemap.slice(sitemap.indexOf("const staticEntries"));
    assert.match(englishBranch, /getTranslatedTierListHubPaths/);
});
