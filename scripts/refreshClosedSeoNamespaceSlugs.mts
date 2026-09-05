/**
 * Rebuild src/data/closed-seo-namespace-slugs.json from local Pokemon and
 * hybrid catalogs. Animals and lessons stay in published-seo-slugs.json.
 *
 * Used by Edge middleware to close static SEO namespaces.
 * Hooked from `yarn refresh:published-seo`. Do NOT add to Next prebuild.
 */

import {writeFileSync} from "node:fs";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";
import {animalHybridEntries} from "../src/data/animal-hybrids.ts";
import {
    pokemonAnimalEntries,
    pokemonAnimalGenerations
} from "../src/data/pokemon-animal-counterparts.ts";
import {getLocalPrincipleSlugs} from "../src/data/species-behavior-lessons.ts";

const here = dirname(fileURLToPath(import.meta.url));
const outputPath = join(here, "..", "src/data/closed-seo-namespace-slugs.json");

const pokemon = [
    ...pokemonAnimalGenerations.map((generation) => generation.slug),
    ...pokemonAnimalEntries.map((entry) => entry.slug)
]
    .filter((slug, index, all) => all.indexOf(slug) === index)
    .sort((left, right) => left.localeCompare(right));

const hybrids = animalHybridEntries
    .map((entry) => entry.slug)
    .sort((left, right) => left.localeCompare(right));

const powers = getLocalPrincipleSlugs();

writeFileSync(outputPath, `${JSON.stringify({
    generatedAt: new Date().toISOString().slice(0, 10),
    source: "local pokemon-animal-counterparts + animal-hybrids + species-behavior-lessons",
    note: "Used by Edge middleware to close static SEO namespaces. Refresh with yarn refresh:published-seo.",
    pokemon,
    hybrids,
    powers
}, null, 2)}\n`);

console.log(`wrote ${outputPath}`);
console.log(`pokemon ${pokemon.length}`);
console.log(`hybrids ${hybrids.length}`);
console.log(`powers ${powers.length}`);
