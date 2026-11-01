/**
 * The Power each hand-coded /animals page shows, from the rows the chat is
 * grounded in: src/data/published-species-powers.json.
 *
 * Hand-coded pages carry a local "principle" that is a browse cluster
 * ("Adaptability", "Precision"), while Talk and the chat answer from the
 * catalog's authored Power (`species_behavior_principles`, which
 * `species_catalog_v1.principle_name` mirrors): the Red Fox was
 * "Adaptability" on its page and "Cunning" in its chat (WEB-7). The page now
 * reads this snapshot first, so both say the same Power. DB-only pages already
 * read the catalog through the lesson snapshot.
 *
 * Also records how many animals the catalog holds (the Talk picker's filter)
 * in src/data/catalog-animal-count.json: the one count the site quotes
 * ("2,600 animals", WEB-29).
 *
 * Run: npx tsx scripts/refreshSpeciesPowerSnapshot.mts (part of
 * `npm run refresh:published-seo`, after refreshStaticSpeciesProfiles). Needs
 * SUPABASE_URL and a read key (read from .env / .env.local). The production
 * build reads only this file.
 */
import {readFileSync, writeFileSync} from "node:fs";
import {join} from "node:path";

const root = join(import.meta.dirname, "..");
const OUTPUT = join(root, "src/data/published-species-powers.json");
// Tiny on purpose: client code may import the count, never the 200 KB of Powers.
const COUNT_OUTPUT = join(root, "src/data/catalog-animal-count.json");

function loadEnv() {
    for (const file of [".env", ".env.local"]) {
        try {
            for (const line of readFileSync(join(root, file), "utf8").split("\n")) {
                const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
                if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
            }
        } catch {
            // optional file
        }
    }
}

loadEnv();
const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
if (!url || !key) throw new Error("SUPABASE_URL and a Supabase read key are required");
const headers = {apikey: key, Authorization: `Bearer ${key}`};

type PrincipleRow = {
    species_profile_id: string;
    principle_name: string | null;
    principle_expression: string | null;
    core_lesson: string | null;
    short_motto: string | null;
};

function clean(value: string | null | undefined): string | null {
    const text = value?.replace(/\s+/g, " ").trim();
    return text ? text : null;
}

const staticProfiles = JSON.parse(readFileSync(join(root, "src/data/published-seo-static-species-profiles.json"), "utf8")) as {
    entries: Record<string, {speciesProfileId?: string}>;
};
const profileBySlug = new Map<string, string>();
for (const [slug, entry] of Object.entries(staticProfiles.entries)) {
    if (entry.speciesProfileId) profileBySlug.set(slug, entry.speciesProfileId);
}
const profileIds = [...new Set(profileBySlug.values())];

const principles = new Map<string, PrincipleRow>();
for (let index = 0; index < profileIds.length; index += 80) {
    const ids = profileIds.slice(index, index + 80);
    const params = new URLSearchParams({
        select: "species_profile_id,principle_name,principle_expression,core_lesson,short_motto",
        species_profile_id: `in.(${ids.join(",")})`
    });
    const response = await fetch(`${url}/rest/v1/species_behavior_principles?${params}`, {headers});
    if (!response.ok) throw new Error(`species_behavior_principles ${response.status}: ${await response.text()}`);
    for (const row of await response.json() as PrincipleRow[]) {
        if (clean(row.principle_name)) principles.set(row.species_profile_id, row);
    }
}

// The Talk picker's own filter (src/data/talk-animals.ts).
const countResponse = await fetch(`${url}/rest/v1/species_catalog_v1?select=species_profile_id&catalog_status=in.(active,seeded)&animaldex_number=gte.1&landing_page_slug=not.is.null`, {
    headers: {...headers, Prefer: "count=exact", Range: "0-0", "Range-Unit": "items"}
});
if (!countResponse.ok) throw new Error(`species_catalog_v1 count ${countResponse.status}`);
const catalogAnimals = Number(countResponse.headers.get("content-range")?.split("/").pop());
if (!Number.isFinite(catalogAnimals) || catalogAnimals < 1000) throw new Error(`implausible catalog count ${catalogAnimals}`);

const powers: Record<string, {name: string; expression: string | null; lesson: string | null; motto: string | null}> = {};
for (const [slug, profileId] of [...profileBySlug.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const row = principles.get(profileId);
    if (!row) continue;
    powers[slug] = {
        name: clean(row.principle_name)!,
        expression: clean(row.principle_expression),
        lesson: clean(row.core_lesson),
        motto: clean(row.short_motto)
    };
}
if (Object.keys(powers).length < 500) throw new Error(`only ${Object.keys(powers).length} Powers resolved; refusing to write`);

writeFileSync(OUTPUT, `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    source: "species_behavior_principles by the static pages' species_profile_id",
    note: "Refresh with `npx tsx scripts/refreshSpeciesPowerSnapshot.mts`. Read at build time by src/lib/species-power.ts.",
    powers
}, null, 2)}\n`);
writeFileSync(COUNT_OUTPUT, `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    source: "species_catalog_v1: catalog_status active or seeded, animaldex_number >= 1, with a landing page (the Talk picker's filter)",
    catalogAnimals
}, null, 2)}\n`);
console.log(`wrote ${OUTPUT}: ${Object.keys(powers).length} Powers of ${profileBySlug.size} linked pages; catalog ${catalogAnimals} animals`);
