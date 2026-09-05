import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";

import publishedSeoSlugs from "@/data/published-seo-slugs.json";
import {
    isPublishedAnimalSlug,
    isPublishedLessonSlug,
    getNextPublishedLessonSlug
} from "@/lib/published-seo-slugs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

function read(relativePath: string) {
    return readFileSync(join(root, relativePath), "utf8");
}

test("published SEO slug index covers the live sitemap surface and rejects unknown animals", () => {
    assert.ok(publishedSeoSlugs.animals.length >= 2300);
    assert.ok(publishedSeoSlugs.lessons.length >= 2400);
    assert.equal(isPublishedAnimalSlug("mata-mata"), true);
    assert.equal(isPublishedAnimalSlug("tiger"), true);
    assert.equal(isPublishedAnimalSlug("rhyticeros-undulatus"), false);
    assert.equal(isPublishedLessonSlug("osprey"), true);
    assert.equal(isPublishedLessonSlug("not-a-real-lesson-slug"), false);
    assert.ok(getNextPublishedLessonSlug("osprey"));
});

test("public animal and lesson detail pages do not fan out remote SEO work", () => {
    const animals = read("app/[locale]/(composited)/animals/[slug]/page.tsx");
    const lessons = read("app/[locale]/(composited)/(answers)/animal-lessons/[slug]/page.tsx");
    const catalog = read("data/database-species-pages.ts");
    const behavior = read("data/species-behavior-lessons.ts");

    assert.match(animals, /export const revalidate = 86400/);
    assert.match(animals, /resolveLocalSpeciesStats/);
    assert.match(animals, /resolveLocalSpeciesBehaviorProfile/);
    assert.match(animals, /getChallengesForSpecies/);
    assert.match(animals, /createEmptyPublicSpeciesGrowthContext/);
    assert.doesNotMatch(animals, /getSpeciesImageReferences/);
    assert.doesNotMatch(animals, /getMergedChallengesForSpecies/);
    assert.doesNotMatch(animals, /getEnhancedAnimalPowerProfile/);
    assert.doesNotMatch(animals, /getSpeciesRankings\(/);
    assert.doesNotMatch(animals, /getSpeciesGrowthContext/);
    assert.doesNotMatch(animals, /from ["']@\/data\/species-subtitles["']/);
    assert.doesNotMatch(animals, /resolveSpeciesStats\(/);
    assert.doesNotMatch(animals, /getDatabaseSpeciesBySlug/);

    assert.match(lessons, /export const revalidate = 86400/);
    assert.match(lessons, /getBehaviorLessonBySlug/);
    assert.match(lessons, /getLocalRelatedBehaviorLessons/);
    assert.match(lessons, /getNextPublishedLessonSlug/);
    assert.doesNotMatch(lessons, /getBehaviorLessonIndex/);
    assert.doesNotMatch(lessons, /getPrincipleHubBySlug/);
    assert.doesNotMatch(lessons, /getRelatedBehaviorLessons/);
    assert.doesNotMatch(lessons, /resolveSpeciesBehaviorProfile/);

    assert.match(catalog, /isPublishedAnimalSlug/);
    assert.match(catalog, /next: \{revalidate: 86400\}/);
    assert.doesNotMatch(
        catalog.slice(
            catalog.indexOf("async function resolveSpeciesBySlugOnce"),
            catalog.indexOf("export async function getResolvedSpeciesBySlug")
        ),
        /fetchCanonicalIdentityAlias/
    );

    assert.match(behavior, /isPublishedLessonSlug/);
    assert.match(behavior, /resolveLocalSpeciesBehaviorProfile/);
    assert.match(behavior, /BEHAVIOR_LESSONS_REVALIDATE_SECONDS = 86400/);
    assert.doesNotMatch(
        behavior.slice(
            behavior.indexOf("async function fetchCatalogLessonBySlug"),
            behavior.indexOf("async function fetchApplicationExamplesFromSupabase")
        ),
        /fetchApplicationExamplesFromSupabase/
    );
});
