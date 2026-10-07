import assert from "node:assert/strict";
import test from "node:test";

import {getExpandedRankingEntries, getRankingSeoTitle, QUALITY_RANKING_TABLE_ENTRIES, rankingPages} from "@/data/rankings";
import {resolveSpeciesBehaviorProfileForPage} from "@/data/species-behavior-lessons";
import {getQualityPositionScore} from "@/data/quality-rankings";
import publishedSeoSlugs from "@/data/published-seo-slugs.json";

const QUALITY_LIST_SLUGS = [
    "most-patient-animals",
    "most-loyal-animals",
    "bravest-animals",
    "most-curious-animals",
    "most-gentle-animals",
    "most-protective-animals",
    "animals-that-work-together",
    "most-disciplined-animals",
    "calmest-animals",
    "most-resourceful-animals"
];

const qualityPages = rankingPages.filter((page) => page.qualityRanking);
const publishedAnimals = new Set(publishedSeoSlugs.animals);

test("every character-trait list exists once as a quality ranking", () => {
    assert.deepEqual(qualityPages.map((page) => page.slug).sort(), [...QUALITY_LIST_SLUGS].sort());
    assert.equal(new Set(rankingPages.map((page) => page.slug)).size, rankingPages.length);
});

test("position weights: 3/2/1 summed over matched qualities, nothing past third", () => {
    assert.deepEqual(getQualityPositionScore(["A", "B", "C"], ["A"]), {score: 3, matchedQuality: "A"});
    assert.deepEqual(getQualityPositionScore(["X", "B", "C"], ["C", "B"]), {score: 3, matchedQuality: "B"});
    assert.deepEqual(getQualityPositionScore(["X", "Y", "Z", "A"], ["A"]), {score: 0, matchedQuality: null});
});

for (const page of qualityPages) {
    test(`${page.slug}: >= 20 ranked entries, 1..n, each backed by the animal's own quality data`, () => {
        const qualities = page.qualityRanking!.qualities;
        const entries = getExpandedRankingEntries(page);

        assert.ok(entries.length >= 20, `${page.slug} has ${entries.length} entries`);
        assert.ok(entries.length <= QUALITY_RANKING_TABLE_ENTRIES);
        assert.deepEqual(entries.map((entry) => entry.rank), entries.map((_, index) => index + 1));
        assert.equal(new Set(entries.map((entry) => entry.speciesSlug)).size, entries.length);

        for (const entry of entries) {
            assert.ok(publishedAnimals.has(entry.speciesSlug), `${entry.speciesSlug} is published`);
            const bestFor = resolveSpeciesBehaviorProfileForPage(entry.speciesSlug)?.bestFor ?? [];
            const matched = bestFor.slice(0, 3).filter((quality) => qualities.includes(quality));
            assert.ok(matched.length > 0, `${page.slug}: ${entry.speciesSlug} bestFor ${bestFor.join(", ")}`);
            assert.ok(qualities.includes(entry.primaryMetric), `${entry.speciesSlug} metric ${entry.primaryMetric}`);
            assert.ok(entry.shortReason.trim().length > 0);
        }

        // The whole curated top 10 survives (no curated pick lacks the data) and leads the table.
        const curated = [...page.entries].sort((left, right) => left.rank - right.rank).map((entry) => entry.speciesSlug);
        assert.equal(curated.length, 10);
        assert.deepEqual(entries.slice(0, 10).map((entry) => entry.speciesSlug), curated);
        assert.deepEqual(entries.slice(0, 2).map((entry) => entry.tier), ["S", "S"]);
        assert.ok(entries.slice(10).every((entry) => ["C", "D", "E"].includes(entry.tier)));
    });

    test(`${page.slug}: SEO copy fits and links resolve`, () => {
        assert.equal(page.category, "character");
        assert.ok(getRankingSeoTitle(page).length <= 60, getRankingSeoTitle(page));
        assert.ok(page.description.length <= 155, `${page.description.length}: ${page.description}`);
        assert.ok(page.immediateQuestion);
        assert.ok((page.faq?.length ?? 0) >= 4);
        assert.equal(page.introduction.length, 2);
        assert.ok(page.lifeLessons);
        assert.ok(page.lifeLessons.apply.length >= 4 && page.lifeLessons.apply.length <= 6);
        for (const card of page.lifeLessons.apply) {
            assert.ok(card.speciesSlug && publishedAnimals.has(card.speciesSlug), `${page.slug} card ${card.speciesSlug}`);
        }
        for (const related of page.relatedRankingSlugs ?? []) {
            assert.ok(rankingPages.some((candidate) => candidate.slug === related), `${page.slug} -> ${related}`);
        }
    });
}
