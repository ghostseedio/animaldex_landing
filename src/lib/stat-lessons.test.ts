import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import {getRankingPage, rankingPages} from "@/data/rankings";
import {tierListPagination} from "@/data/hub-pagination";
import {STAT_LESSONS, statForRanking} from "@/lib/stat-lessons";

test("the five stats are the app's five, in radar order, each with a low and a high example", () => {
    assert.deepEqual(STAT_LESSONS.map((lesson) => lesson.key), ["speed", "dominance", "size", "intelligence", "rarity"]);
    for (const lesson of STAT_LESSONS) {
        assert.ok(lesson.low.value < 50 && lesson.high.value > 50, `${lesson.key} examples sit at opposite ends`);
    }
});

test("the lists that rank well in search read the stat they are about", () => {
    const expected: Record<string, string> = {
        "fastest-animals": "speed",
        "strongest-animals": "dominance",
        "biggest-animals": "size",
        "smartest-animals": "intelligence",
        "rarest-animals": "rarity",
        "most-dangerous-animals": "dominance"
    };
    for (const [slug, stat] of Object.entries(expected)) {
        const ranking = getRankingPage(slug);
        assert.ok(ranking, slug);
        assert.equal(statForRanking(ranking), stat, slug);
    }
});

test("every stat string exists in English and Indonesian", () => {
    for (const locale of ["en", "id"]) {
        const copy = JSON.parse(readFileSync(`src/data/locales/${locale}.json`, "utf8")).rankings.statLessons;
        for (const lesson of STAT_LESSONS) {
            for (const field of ["name", "question", "recorded", "high", "low"]) {
                assert.equal(typeof copy.stats[lesson.key][field], "string", `${locale} ${lesson.key}.${field}`);
            }
        }
        for (const key of ["eyebrow", "title", "description", "sectionTitle", "recordedOne", "recordedTwo", "listTitle", "listGenericTitle", "faqQuestion", "faqAnswer"]) {
            assert.equal(typeof copy[key], "string", `${locale} ${key}`);
        }
    }
});

test("the tier-list hub pages its grid at /tier-list/page/<n>, with page 1 as the hub", () => {
    assert.equal(tierListPagination.pagePath(1), "/tier-list");
    assert.equal(tierListPagination.pagePath(2), "/tier-list/page/2");
    const pages = tierListPagination.pageCount(rankingPages.length);
    assert.ok(pages >= 2);
    const config = readFileSync("next.config.js", "utf8");
    assert.match(config, /\["\/tier-list", "\/tier-list"\]/, "/tier-list/page/1 308s to the hub");
    const wrapper = readFileSync("src/app/[locale]/(composited)/tier-list/page/[page]/page.tsx", "utf8");
    assert.match(wrapper, /export const revalidate = 86400/);
    assert.doesNotMatch(wrapper, /searchParams|cookies\(|headers\(|force-dynamic/);
});
