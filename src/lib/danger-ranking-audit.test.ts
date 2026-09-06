import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function readRepo(...parts: string[]) {
    return readFileSync(join(repoRoot, ...parts), "utf8");
}

test("most-dangerous-animals uses threat-aware danger scoring instead of generic claw boosts", () => {
    const rankings = readRepo("src/data/rankings.ts");
    const speciesStats = readRepo("src/data/species-stats.ts");

    assert.match(rankings, /function getDangerCategoryScore\(stats: SpeciesStats, entry: SpeciesEntry\)/);
    assert.match(rankings, /function isGentleOrLowThreatSpecies\(entry: SpeciesEntry\)/);
    assert.match(rankings, /case "danger":\s*\n\s*return getDangerCategoryScore\(stats, entry\)/);
    assert.match(rankings, /digging claw\|burrowing claw\|digging foreclaw/);
    assert.match(rankings, /function qualifiesForDangerRanking\(entry: SpeciesEntry, score: number\)/);
    assert.match(rankings, /page\.category !== "danger" \|\| qualifiesForDangerRanking\(item\.entry, item\.score\)/);
    assert.match(rankings, /function matchesDangerTaxon\(entry: SpeciesEntry\)/);
    assert.match(rankings, /wolf eel\|sea lion\|elephant beetle/);

    assert.match(speciesStats, /const isDiggingClaw = hasKeyword\(/);
    assert.match(speciesStats, /const isGentleProfile = hasKeyword\(/);
    assert.doesNotMatch(speciesStats, /hasKeyword\(\/apex\|predator\|hunter\|ambush\|venom\|fang\|claw\|talon\|stalk\|kills\/\)/);
});
