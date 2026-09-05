import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";

import publishedSeoSlugs from "@/data/published-seo-slugs.json";
import animalSnapshot from "@/data/published-seo-animal-pages.json";
import lessonSnapshot from "@/data/published-seo-lesson-pages.json";
import {
    isCollapsedEnglishDetailPath,
    matchCollapsedIdDetailPath
} from "@/lib/english-detail-routes";
import {isPublishedAnimalSlug, isPublishedLessonSlug} from "@/lib/published-seo-slugs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

function read(relativePath: string) {
    return readFileSync(join(root, relativePath), "utf8");
}

test("published EN animal and lesson static params cover the slug index", () => {
    const pageData = read("lib/published-seo-page-data.ts");

    assert.ok(publishedSeoSlugs.animals.length >= 2300);
    assert.ok(publishedSeoSlugs.lessons.length >= 2400);
    assert.equal(animalSnapshot.entries.length, 1334);
    assert.equal(lessonSnapshot.entries.length, 1477);
    assert.deepEqual(
        animalSnapshot.entries.map((entry) => entry.slug),
        [...animalSnapshot.entries.map((entry) => entry.slug)].sort((a, b) => a.localeCompare(b))
    );
    assert.deepEqual(
        lessonSnapshot.entries.map((entry) => entry.slug),
        [...lessonSnapshot.entries.map((entry) => entry.slug)].sort((a, b) => a.localeCompare(b))
    );
    assert.match(pageData, /getPublishedEnglishAnimalStaticParams/);
    assert.match(pageData, /publishedSeoSlugs\.animals\.map/);
    assert.match(pageData, /getPublishedEnglishLessonStaticParams/);
    assert.match(pageData, /publishedSeoSlugs\.lessons\.map/);
    assert.equal(isPublishedAnimalSlug("mata-mata"), true);
    assert.equal(isPublishedAnimalSlug("definitely-not-a-real-animaldex-slug"), false);
    assert.equal(isPublishedLessonSlug("osprey"), true);
    assert.equal(isPublishedLessonSlug("definitely-not-a-real-animaldex-slug"), false);
});

test("stable SEO detail pages are static English SSG with dynamicParams=false", () => {
    const animals = read("app/[locale]/(composited)/animals/[slug]/page.tsx");
    const lessons = read("app/[locale]/(composited)/(answers)/animal-lessons/[slug]/page.tsx");
    const pokemon = read("app/[locale]/(composited)/pokemon-animals/[slug]/page.tsx");
    const hybrids = read("app/[locale]/(composited)/animal-hybrids/[slug]/page.tsx");
    const tierList = read("app/[locale]/(composited)/tier-list/[slug]/page.tsx");
    const legendary = read("app/[locale]/(composited)/legendary-earth-beasts/[slug]/page.tsx");
    const locations = read("app/[locale]/(composited)/locations/[slug]/page.tsx");

    for (const source of [animals, lessons, pokemon, hybrids, tierList, legendary, locations]) {
        assert.match(source, /export const dynamicParams = false/);
        assert.match(source, /export const revalidate = false/);
        assert.match(source, /export function generateStaticParams/);
    }

    assert.match(animals, /getPublishedEnglishAnimalStaticParams/);
    assert.match(lessons, /getPublishedEnglishLessonStaticParams/);
    assert.match(pokemon, /pokemonAnimalEntries/);
    assert.match(hybrids, /animalHybridEntries/);
    assert.match(tierList, /rankingPages\.flatMap/);
    assert.match(legendary, /legendaryEarthBeastEntries\.flatMap/);
    assert.match(locations, /locationPages\.flatMap/);
});

test("unknown published-SEO slugs cannot invoke Supabase from the resolve path", () => {
    const catalog = read("data/database-species-pages.ts");
    const behavior = read("data/species-behavior-lessons.ts");
    const resolveSlice = catalog.slice(
        catalog.indexOf("async function resolveSpeciesBySlugOnce"),
        catalog.indexOf("export async function getResolvedSpeciesBySlug")
    );
    const lessonSlice = behavior.slice(
        behavior.indexOf("async function resolveBehaviorLessonBySlugOnce"),
        behavior.indexOf("export async function getBehaviorLessonBySlug")
    );

    assert.match(resolveSlice, /getSnapshotSpeciesBySlug/);
    assert.doesNotMatch(resolveSlice, /getDatabaseSpeciesBySlug/);
    assert.doesNotMatch(resolveSlice, /fetchSingleSpeciesFromCatalog/);
    assert.doesNotMatch(resolveSlice, /fetchCanonicalIdentityAlias/);
    assert.match(lessonSlice, /getSnapshotLessonBySlug/);
    assert.doesNotMatch(lessonSlice, /fetchCatalogLessonBySlug/);
    assert.match(catalog, /assertNoRemoteDuringSeoSsg/);
    assert.match(behavior, /assertNoRemoteDuringSeoSsg/);
    assert.doesNotMatch(catalog, /cache:\s*["']no-store["']/);
    assert.doesNotMatch(behavior, /cache:\s*["']no-store["']/);
});

test("collapsed /id detail families redirect to English and are not advertised", () => {
    const nextConfig = readFileSync(join(root, "..", "next.config.js"), "utf8");
    const middleware = read("middleware.ts");
    const metadata = read("lib/content-metadata.ts");
    const site = read("lib/site.ts");
    const toggle = read("app/[locale]/(composited)/_components/locale-toggle.tsx");
    const link = read("app/[locale]/_components/link.tsx");
    const sitemap = read("lib/build-sitemap.ts");

    assert.match(nextConfig, /source: "\/id\/animals\/:slug"/);
    assert.match(nextConfig, /destination: "\/animals\/:slug"/);
    assert.match(nextConfig, /source: "\/id\/animal-lessons\/:slug"/);
    assert.match(nextConfig, /source: "\/id\/pokemon-animals\/:slug"/);
    assert.match(nextConfig, /source: "\/id\/animal-hybrids\/:slug"/);
    assert.match(nextConfig, /source: "\/id\/comparisons\/:slug"/);
    assert.match(nextConfig, /source: "\/id\/powers\/:slug"/);
    assert.match(nextConfig, /destination: "\/powers\/:slug"/);
    assert.match(nextConfig, /destination: "\/comparisons\/:slug"/);
    assert.match(middleware, /matchCollapsedIdDetailPath/);
    assert.match(middleware, /NextResponse.redirect\(destination, 308\)/);
    assert.match(middleware, /resolveClosedSeoNamespacePath/);
    assert.match(middleware, /closedSeoNamespaceNotFoundResponse/);
    assert.match(middleware, /applyEnglishOnlyDetailLinkHeader/);
    assert.match(read("i18n.ts"), /alternateLinks: false/);
    assert.match(metadata, /isCollapsedEnglishDetailPath/);
    assert.match(metadata, /hreflangLocales/);
    assert.match(site, /isCollapsedEnglishDetailPath/);
    assert.match(toggle, /collapsedEnglishDetail/);
    assert.match(link, /isCollapsedEnglishDetailPath/);
    assert.match(sitemap, /308 to English/);
    assert.equal(isCollapsedEnglishDetailPath("/animals/tiger"), true);
    assert.equal(isCollapsedEnglishDetailPath("/animals"), false);
    assert.equal(isCollapsedEnglishDetailPath("/id/animals/tiger"), false);
    assert.deepEqual(matchCollapsedIdDetailPath("/id/animals/tiger"), {
        family: "animals",
        englishPath: "/animals/tiger"
    });
    assert.deepEqual(matchCollapsedIdDetailPath("/id/comparisons/aardwolf-vs-nurse-shark"), {
        family: "comparisons",
        englishPath: "/comparisons/aardwolf-vs-nurse-shark"
    });
    assert.deepEqual(matchCollapsedIdDetailPath("/id/powers/resilience"), {
        family: "powers",
        englishPath: "/powers/resilience"
    });
    assert.equal(isCollapsedEnglishDetailPath("/comparisons/aardwolf-vs-nurse-shark"), true);
    assert.equal(matchCollapsedIdDetailPath("/id/animals"), null);
});

test("operator SEO snapshot refresh is not part of prebuild", () => {
    const packageJson = readFileSync(join(root, "..", "package.json"), "utf8");
    const refresh = readFileSync(join(root, "..", "scripts/refreshPublishedSeoSnapshots.mts"), "utf8");

    assert.match(packageJson, /"refresh:published-seo"/);
    assert.doesNotMatch(packageJson, /prebuild.*refresh:published-seo/);
    assert.match(refresh, /Do NOT add this to Next prebuild/);
    assert.match(refresh, /never fetches Supabase/);
});
