import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function readRepo(...parts: string[]) {
    return readFileSync(join(repoRoot, ...parts), "utf8");
}

function rankingBlock(source: string, slug: string) {
    const marker = `slug: "${slug}"`;
    const start = source.indexOf(marker);
    assert.ok(start >= 0, slug);
    const next = source.indexOf("createRankingPage({", start + marker.length);
    return source.slice(start, next === -1 ? undefined : next);
}

test("canonical ranking path stays /tier-list and is not revived as /rankings", () => {
    const rankings = readRepo("src/data/rankings.ts");
    const detail = readRepo("src/app/[locale]/(composited)/rankings/[slug]/page.tsx");
    const hub = readRepo("src/app/[locale]/(composited)/rankings/page.tsx");
    const related = readRepo("src/app/[locale]/(composited)/rankings/_components/related-rankings-section.tsx");

    assert.match(rankings, /RANKING_CANONICAL_BASE_PATH = "\/tier-list"/);
    assert.match(detail, /pathname: `\$\{RANKING_CANONICAL_BASE_PATH\}\/\$\{ranking\.slug\}`/);
    assert.match(hub, /canonical: getLocalePath\(locale, RANKING_CANONICAL_BASE_PATH\)/);
    assert.match(related, /href=\{`\/tier-list\/\$\{item\.slug\}`\}/);
    assert.doesNotMatch(related, /\/rankings\//);
    assert.doesNotMatch(detail, /canonical.*\/rankings/);
    assert.doesNotMatch(hub, /"\/en/);
});

test("optimized ranking pages have Top 100 SEO titles, headlines, and questions", () => {
    const rankings = readRepo("src/data/rankings.ts");
    const expected: Array<[string, string, string]> = [
        ["most-dangerous-animals", "Top 100 Most Dangerous Animals in the World, Ranked", "100 Most Dangerous Animals in the World"],
        ["strongest-animals", "Top 100 Strongest Animals in the World, Ranked", "100 Strongest Animals in the World"],
        ["smartest-animals", "Top 100 Smartest Animals — Animal Intelligence Ranked", "100 Smartest Animals Ranked"],
        ["most-adaptable-animals", "Most Adaptable Animals — Top 100 Ranked", "100 Most Adaptable Animals"],
        ["most-agile-animals", "Most Agile Animals — Top 100 Ranked", "100 Most Agile Animals"],
        ["fastest-animals", "Fastest Animals in the World — Top 100 Ranked", "100 Fastest Animals in the World"],
        ["animals-with-strongest-armor", "Animals with the Strongest Armor — Top 100 Ranked", "100 Animals with the Strongest Armor"],
        ["animals-with-best-teamwork", "Animals with the Best Teamwork — Top 100 Ranked", "100 Animals with the Best Teamwork"],
        ["most-resilient-animals", "Most Resilient Animals — Top 100 Ranked", "100 Most Resilient Animals"]
    ];

    for (const [slug, seoTitle, headline] of expected) {
        const block = rankingBlock(rankings, slug);
        assert.match(block, new RegExp(`seoTitle: "${seoTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
        assert.match(block, new RegExp(`headline: "${headline.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
        assert.match(block, /immediateQuestion:/);
        assert.match(block, /rankingFactors:/);
        assert.doesNotMatch(block, /seoTitle: ".*AnimalDex/);
    }

    const dangerous = rankingBlock(rankings, "most-dangerous-animals");
    assert.doesNotMatch(dangerous, /statRankingKey:/);
    assert.match(rankingBlock(rankings, "fastest-animals"), /statRankingLimit: MIN_RANKING_TABLE_ENTRIES/);
    assert.match(rankingBlock(rankings, "smartest-animals"), /statRankingLimit: MIN_RANKING_TABLE_ENTRIES/);
});

test("editorial related rankings follow the GSC clusters", () => {
    const rankings = readRepo("src/data/rankings.ts");

    assert.match(
        rankingBlock(rankings, "strongest-animals"),
        /relatedRankingSlugs: \["animals-with-strongest-armor", "most-dangerous-animals", "most-resilient-animals"\]/
    );
    assert.match(
        rankingBlock(rankings, "smartest-animals"),
        /relatedRankingSlugs: \["most-adaptable-animals", "animals-with-best-teamwork"\]/
    );
    assert.match(rankingBlock(rankings, "fastest-animals"), /relatedRankingSlugs: \["most-agile-animals"/);
    assert.match(rankingBlock(rankings, "animals-with-strongest-armor"), /relatedRankingSlugs: \["strongest-animals", "most-resilient-animals"\]/);
});

test("canonical /tier-list wrappers export static segment config", () => {
    const hub = readRepo("src/app/[locale]/(composited)/tier-list/page.tsx");
    const detail = readRepo("src/app/[locale]/(composited)/tier-list/[slug]/page.tsx");

    assert.match(hub, /export const revalidate = 86400/);
    assert.match(hub, /generateStaticParams/);
    assert.match(hub, /return \[\];/);
    assert.match(detail, /export const revalidate = false/);
    assert.match(detail, /export const dynamicParams = false/);
    assert.match(detail, /rankingPages\.flatMap/);
    for (const source of [hub, detail]) {
        assert.doesNotMatch(source, /searchParams/);
        assert.doesNotMatch(source, /force-dynamic/);
        assert.doesNotMatch(source, /cookies\(|headers\(|draftMode\(|noStore\(/);
        assert.doesNotMatch(source, /getUnifiedSpeciesEntries/);
    }
});

test("hub metadata drops the double AnimalDex suffix and surfaces GSC winners first", () => {
    const en = readRepo("src/data/locales/en.json");
    const hub = readRepo("src/app/[locale]/(composited)/rankings/page.tsx");
    const detail = readRepo("src/app/[locale]/(composited)/rankings/[slug]/page.tsx");

    assert.match(en, /"metaTitle": "Animal Tier List — Animal Rankings & Top 100 Lists"/);
    assert.match(en, /"title": "Animal Tier Lists"/);
    assert.doesNotMatch(en, /"metaTitle": "Animal Tier Lists \| AnimalDex"/);
    assert.match(hub, /sortRankingPagesForHub/);
    assert.match(hub, /FEATURED_TIER_LIST_SLUGS|sortRankingPagesForHub\(rankingPages\)/);
    assert.match(detail, /getRankingSeoTitle/);
    assert.match(detail, /ranking\.immediateQuestion/);
    assert.match(detail, /ranking\.introduction/);
    assert.match(detail, /fastestByEnvironmentTitle/);
    assert.match(detail, /export const revalidate = 86400/);
});
