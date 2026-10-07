import assert from "node:assert/strict";
import test from "node:test";
import {rankingLifeLessons, RankingLifeLessons} from "@/data/ranking-life-lessons";
import {getRankingPage, rankingPages} from "@/data/rankings";
import {isPublishedAnimalSlug} from "@/lib/published-seo-slugs";

function allLessons(): Array<[string, RankingLifeLessons]> {
    return [
        ...Object.entries(rankingLifeLessons),
        ...rankingPages.flatMap((page): Array<[string, RankingLifeLessons]> => (page.lifeLessons ? [[page.slug, page.lifeLessons]] : []))
    ];
}

test("every rankingLifeLessons key is an existing tier-list page", () => {
    for (const slug of Object.keys(rankingLifeLessons)) {
        assert.ok(getRankingPage(slug), `rankingLifeLessons["${slug}"] has no ranking page`);
    }
});

test("life-lesson cards link only to published animals from the same list", () => {
    for (const [slug, lessons] of allLessons()) {
        const page = getRankingPage(slug);
        assert.ok(page, slug);
        const listed = new Set(page.entries.map((entry) => entry.speciesSlug));
        const handWritten = rankingLifeLessons[slug] === lessons;

        if (handWritten) {
            assert.ok(lessons.apply.length >= 4 && lessons.apply.length <= 6, `${slug}: expected 4-6 apply cards`);
            assert.ok(lessons.why.length >= 2 && lessons.why.length <= 3, `${slug}: expected 2-3 why paragraphs`);
        }

        for (const card of lessons.apply) {
            if (!card.speciesSlug) {
                continue;
            }

            assert.ok(isPublishedAnimalSlug(card.speciesSlug), `${slug}: card species ${card.speciesSlug} is not published`);
            if (handWritten) {
                assert.ok(listed.has(card.speciesSlug), `${slug}: card species ${card.speciesSlug} is not in the list`);
            }
        }
    }
});

test("hand-written life lessons stay plain: no exclamation marks, no duplicate FAQ questions", () => {
    for (const [slug, lessons] of Object.entries(rankingLifeLessons)) {
        const page = getRankingPage(slug);
        const text = [lessons.whyTitle, ...lessons.why, lessons.applyTitle, lessons.applyIntro, ...lessons.apply.flatMap((card) => [card.title, card.body]), ...(lessons.faq || []).flatMap((item) => [item.question, item.answer])].join(" ");

        assert.doesNotMatch(text, /!/, `${slug}: exclamation mark`);
        const existing = new Set((page?.faq || []).map((item) => item.question.toLowerCase()));
        for (const item of lessons.faq || []) {
            assert.ok(!existing.has(item.question.toLowerCase()), `${slug}: FAQ "${item.question}" duplicates an existing question`);
        }
    }
});
