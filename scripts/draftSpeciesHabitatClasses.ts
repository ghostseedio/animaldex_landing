/**
 * One-off helper: drafts a habitat class for every species the location guides list, so
 * the curated table in scripts/species-habitat-classes.ts starts from the catalog's own
 * habitat text instead of from nothing.
 *
 * Usage: npx tsx scripts/draftSpeciesHabitatClasses.ts
 */
import "dotenv/config";
import dotenv from "dotenv";
import {createRequire} from "node:module";

dotenv.config({path: ".env.local"});

const require = createRequire(import.meta.url);
require.cache[require.resolve("server-only")] = {
    id: "server-only",
    filename: "server-only",
    loaded: true,
    exports: {}
} as never;

const RULES: Array<[string, string[]]> = [
    ["marine", ["reef", "coral", "ocean", "pelagic", "open water", "kelp", "seagrass", "saltwater", "marine", "deep water"]],
    ["coast", ["shoreline", "coastal", "beach", "intertidal", "tidal", "sea cliff", "estuary", "mangrove", "fjord", "bay", "coast"]],
    ["wetland", ["wetland", "marsh", "swamp", "lake", "river", "pond", "floodplain", "reed", "freshwater", "delta", "riverbank", "stream"]],
    ["cold", ["tundra", "arctic", "glacier", "boreal", "taiga", "polar", "permafrost", "sea ice", "snowfield"]],
    ["montane", ["mountain", "alpine", "montane", "highland", "cliff", "rocky", "ridge", "volcanic", "plateau", "crag"]],
    ["arid", ["desert", "arid", "semi arid", "steppe", "thorn", "scrub", "bushland", "dune", "sand"]],
    ["grassland", ["savanna", "savannah", "grassland", "plains", "prairie", "meadow", "pasture", "veld", "open country", "rangeland"]],
    ["forest", ["forest", "rainforest", "jungle", "canopy", "woodland", "leaf litter", "understory", "bamboo", "rotting logs", "tree"]],
    ["urban", ["urban", "city", "town", "village", "house", "building", "garden", "farm", "crop", "plantation", "indoors", "human", "kitchen", "stores"]]
];

function normalise(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, " ");
}

function contains(text: string, phrase: string) {
    return ` ${text} `.includes(` ${phrase} `);
}

(async () => {
    const {locationPages} = await import("../src/data/locations");
    const {getUnifiedSpeciesEntries, getResolvedSpeciesBySlug} = await import("../src/data/database-species-pages");
    const unified = await getUnifiedSpeciesEntries();
    const byslug = new Map(unified.map((entry) => [entry.slug, entry]));
    const slugs = Array.from(new Set(locationPages.flatMap((page) => page.animalsToSpot.map((animal) => animal.speciesSlug)))).sort();

    for (const slug of slugs) {
        const entry = byslug.get(slug) ?? await getResolvedSpeciesBySlug(slug);
        const habitat = normalise(entry?.analysis.habitat ?? "");
        const scores = RULES
            .map(([name, keywords]) => [name, keywords.filter((keyword) => contains(habitat, normalise(keyword).trim())).length] as const)
            .filter(([, score]) => score > 0)
            .sort((a, b) => b[1] - a[1]);

        console.log(`${slug}\t${scores[0]?.[0] ?? "unknown"}\t${scores.map(([name, score]) => `${name}:${score}`).join(",")}\t${(entry?.analysis.habitat ?? "").slice(0, 90)}`);
    }
})();
