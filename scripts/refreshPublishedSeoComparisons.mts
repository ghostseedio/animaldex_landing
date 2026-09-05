/**
 * Rebuild comparison slug index + DB-only page snapshot.
 * Operator-run. Do NOT add to Next prebuild.
 */

import {existsSync, readFileSync, writeFileSync} from "node:fs";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";
import Module from "node:module";

const origLoad = Module._load;
Module._load = function (request: string, parent, isMain) {
    if (request === "server-only") {
        return {};
    }
    return origLoad.apply(this, arguments as unknown as Parameters<typeof origLoad>);
};

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

function loadEnvFile(fileName: string) {
    const filePath = join(root, fileName);
    if (!existsSync(filePath)) {
        return;
    }

    for (const line of readFileSync(filePath, "utf8").split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) {
            continue;
        }
        const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
        if (!match) {
            continue;
        }
        const key = match[1];
        let value = match[2] ?? "";
        if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        if (!process.env[key]) {
            process.env[key] = value;
        }
    }
}

loadEnvFile(".env.local");
loadEnvFile(".env");
loadEnvFile(".env.example");

const {challengeEntries} = await import("../src/data/challenges.ts");
const {fetchAllReadySpeciesComparisonEntries} = await import("../src/data/species-comparisons.ts");
const closedPath = join(root, "src/data/closed-seo-namespace-slugs.json");
const snapshotPath = join(root, "src/data/published-seo-comparison-pages.json");

const localSlugs = new Set(challengeEntries.map((entry) => entry.slug));
let dbEntries = [];
try {
    dbEntries = await fetchAllReadySpeciesComparisonEntries();
} catch (error) {
    console.warn("comparison DB fetch failed; snapshot will be local-only", error);
}

const snapshotEntries = dbEntries
    .filter((entry) => !localSlugs.has(entry.slug))
    .sort((left, right) => left.slug.localeCompare(right.slug));

const comparisons = Array.from(new Set([
    ...challengeEntries.map((entry) => entry.slug),
    ...snapshotEntries.map((entry) => entry.slug)
])).sort((left, right) => left.localeCompare(right));

const closed = JSON.parse(readFileSync(closedPath, "utf8"));
closed.generatedAt = new Date().toISOString().slice(0, 10);
closed.comparisons = comparisons;
writeFileSync(closedPath, `${JSON.stringify(closed, null, 2)}\n`);

writeFileSync(snapshotPath, `${JSON.stringify({
    generatedAt: new Date().toISOString().slice(0, 10),
    source: "local challengeEntries plus ready species_comparisons rows not already editorial",
    note: "Used for English comparison SSG. Refresh with yarn refresh:published-seo. Do not add to prebuild.",
    entries: snapshotEntries
}, null, 2)}\n`);

console.log(`local editorial ${localSlugs.size}`);
console.log(`db rows ${dbEntries.length}`);
console.log(`snapshot extras ${snapshotEntries.length}`);
console.log(`closed comparisons ${comparisons.length}`);
console.log(`wrote ${snapshotPath}`);
