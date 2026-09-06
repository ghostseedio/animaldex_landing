import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function readRepo(...parts: string[]) {
    return readFileSync(join(repoRoot, ...parts), "utf8");
}

test("tier-list tables omit legendary earth beasts such as stone-whale-pod", () => {
    const rankings = readRepo("src/data/rankings.ts");
    const beasts = readRepo("src/data/legendary-earth-beasts.ts");
    const rankingPage = readRepo("src/app/[locale]/(composited)/rankings/[slug]/page.tsx");

    assert.match(beasts, /slug: "stone-whale-pod"/);
    assert.match(rankings, /import \{isLegendaryEarthBeastSpeciesSlug\} from "@\/data\/legendary-earth-beasts"/);
    assert.match(rankings, /function getRankableSpeciesEntries\(entries: SpeciesEntry\[\]\) \{/);
    assert.match(rankings, /return entries\.filter\(\(entry\) => !isLegendaryEarthBeastSpeciesSlug\(entry\.slug\)\)/);
    assert.match(rankings, /const rankableEntries = getRankableSpeciesEntries\(entries\)/);
    assert.match(rankings, /return getStatRankingEntries\(page, rankableEntries\)/);
    assert.match(rankings, /const scoredSpecies = rankableEntries/);
    assert.match(rankingPage, /getExpandedRankingEntries\(ranking/);
});

test("encyclopedia directory omits legendary earth beasts unless Tier S is selected", () => {
    const species = readRepo("src/data/species.ts");
    const animalsPage = readRepo("src/app/[locale]/(composited)/animals/page.tsx");
    const directory = readRepo("src/app/[locale]/(composited)/animals/species-directory.tsx");
    const seed = readRepo("src/data/legendary-earth-beasts-catalog-seed.ts");

    assert.match(seed, /beastSlug: "fairy-tomb-elephant"/);
    assert.match(seed, /animaldexNumber: 1811/);
    assert.match(species, /const isLegendary = Boolean\(getLegendaryEarthBeast\(entry\.slug\)\)/);
    assert.match(species, /if \(normalizedTier === "S"\) \{/);
    assert.match(species, /\} else if \(isLegendary\) \{/);
    assert.match(animalsPage, /filter\(\(entry\) => !getLegendaryEarthBeast\(entry\.slug\)\)/);
    assert.match(directory, /void applyDirectoryFilters\(filters\)/);
    assert.match(directory, /useSearchParams/);
    assert.match(directory, /directorySearchKey/);
});
