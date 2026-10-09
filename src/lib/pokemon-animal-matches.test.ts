import assert from "node:assert/strict";
import {existsSync} from "node:fs";
import {dirname, join} from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";

import publishedSeoSlugs from "@/data/published-seo-slugs.json";
import {pokemonAnimalEntries} from "@/data/pokemon-animal-counterparts";
import {pokemonAnimalMatches} from "@/data/pokemon-animal-matches";
import {getPublishedSpeciesForContent} from "@/lib/static-species-overlay";

const here = dirname(fileURLToPath(import.meta.url));
const iconDir = join(here, "..", "..", "public", "images", "pokemon-animals", "icons");
const artDir = join(here, "..", "..", "public", "images", "pokemon-animals", "art");
const publishedAnimals = new Set<string>(publishedSeoSlugs.animals);

test("every Pokemon has exactly one match and every match is a Pokemon", () => {
    const slugs = new Set(pokemonAnimalEntries.map((entry) => entry.slug));
    assert.equal(pokemonAnimalEntries.length, 1025);
    assert.deepEqual(Object.keys(pokemonAnimalMatches).filter((slug) => !slugs.has(slug)), []);
});

test("the closest animal is one published species, named as on its page", () => {
    for (const entry of pokemonAnimalEntries) {
        assert.ok(publishedAnimals.has(entry.speciesSlug), `${entry.slug}: /animals/${entry.speciesSlug} is not published`);
        assert.equal(entry.animal, getPublishedSpeciesForContent(entry.speciesSlug)?.name, `${entry.slug}: animal name drifted from its species page`);
        assert.doesNotMatch(entry.animal, /\bor\b/i, `${entry.slug}: "${entry.animal}" names two animals`);
        for (const slug of entry.speciesSlugs) {
            assert.ok(publishedAnimals.has(slug), `${entry.slug}: secondary /animals/${slug} is not published`);
        }
    }
});

test("every Pokemon has a self-hosted icon and hero artwork", () => {
    for (const dir of [iconDir, artDir]) {
        const missing = pokemonAnimalEntries.filter((entry) => !existsSync(join(dir, `${entry.slug}.webp`))).map((entry) => entry.slug);
        assert.deepEqual(missing, [], `missing in ${dir}; run: npx tsx scripts/fetch-pokemon-icons.mts`);
    }
});
