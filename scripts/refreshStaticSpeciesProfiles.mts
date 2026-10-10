/**
 * Links hand-coded /animals pages (src/data/species*.ts) to the catalog, as a
 * build-time snapshot: src/data/published-seo-static-species-profiles.json.
 *
 * Hand-coded pages never had a species_profile_id, so everything keyed on it
 * (the Play tab's Trial and powers, System Dynamics, Ask grounding) silently
 * rendered nothing. For each page:
 *   - its own indexed profile (page slug, landing slug or identity key match);
 *   - else the canonical profile a hidden duplicate was folded into;
 *   - else, for broad group pages with no indexed group profile (octopus,
 *     fox, owl...), the indexed species it covers: page slugs ending in
 *     "-<slug>" (sumatran-tiger for tiger; not tiger-shark), so the Play tab
 *     can list them with their Trials.
 * The production build reads only this file; it never queries Supabase.
 *
 * Run: npx tsx scripts/refreshStaticSpeciesProfiles.mts (part of
 * `npm run refresh:published-seo`). Needs SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY (read from .env / .env.local).
 */
import {readFileSync, writeFileSync} from "node:fs";
import {join} from "node:path";
import {speciesEntries} from "../src/data/species";

const root = join(import.meta.dirname, "..");

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
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";
if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
const headers = {apikey: key, Authorization: `Bearer ${key}`};

type CatalogRow = {
    species_profile_id: string;
    animaldex_number: number | null;
    landing_page_slug: string | null;
    normalized_identity_key: string | null;
    display_name: string | null;
    catalog_status: string | null;
};

async function fetchAll<T>(path: string, select: string, orderColumn: string): Promise<T[]> {
    const rows: T[] = [];
    for (let offset = 0; ; offset += 1000) {
        const response = await fetch(`${url}/rest/v1/${path}?select=${select}&order=${orderColumn}.asc&limit=1000&offset=${offset}`, {headers});
        if (!response.ok) throw new Error(`${path} ${response.status}: ${await response.text()}`);
        const page = await response.json() as T[];
        rows.push(...page);
        if (page.length < 1000) return rows;
    }
}

/** The /animals URL slug for a catalog row: mirrors scripts/refreshPublishedSeoSlugs.mjs. */
function pageSlugOf(row: CatalogRow) {
    const landing = row.landing_page_slug?.trim() ?? "";
    const suffix = row.animaldex_number == null ? null : `-${row.animaldex_number}`;
    const stripped = suffix && landing.endsWith(suffix) ? landing.slice(0, -suffix.length) : landing;
    return (stripped || (row.normalized_identity_key ?? "").trim().replace(/_/g, "-"))
        .toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

const catalog = await fetchAll<CatalogRow>(
    "species_catalog_v1",
    "species_profile_id,animaldex_number,landing_page_slug,normalized_identity_key,display_name,catalog_status",
    "species_profile_id"
);
const profiles = await fetchAll<{id: string; catalog_status: string | null; canonical_species_profile_id: string | null}>(
    "species_profiles",
    "id,catalog_status,canonical_species_profile_id",
    "id"
);
const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
const publishedSlugs = new Set<string>(JSON.parse(readFileSync(join(root, "src/data/published-seo-slugs.json"), "utf8")).animals);

const isHidden = (row: CatalogRow) => (profileById.get(row.species_profile_id)?.catalog_status ?? row.catalog_status) === "hidden";
const isIndexed = (row: CatalogRow) => typeof row.animaldex_number === "number" && row.animaldex_number > 0 && !isHidden(row);
const rowByProfileId = new Map(catalog.map((row) => [row.species_profile_id, row]));

// Every published, indexed catalog species by its page slug: candidates for group membership.
const indexedByPageSlug = new Map<string, CatalogRow>();
for (const row of catalog) {
    if (!isIndexed(row)) continue;
    const slug = pageSlugOf(row);
    if (slug && publishedSlugs.has(slug) && !indexedByPageSlug.has(slug)) indexedByPageSlug.set(slug, row);
}

type Member = {slug: string; name: string; animalDexNumber: number};

/** Slug endings that end in a group word but are other animals: a sea lion is a seal, a flying fox a bat. */
const NOT_GROUP_MEMBERS = ["sea-lion", "flying-fox", "iridescent-shark", "red-tailed-black-shark", "horseshoe-crab", "mouse-deer"];
const isNamedLikeButNot = (memberSlug: string) => NOT_GROUP_MEMBERS.some((ending) => memberSlug === ending || memberSlug.endsWith(`-${ending}`));
type Entry = {speciesProfileId: string; source: "own" | "canonical"} | {members: Member[]};

const staticSlugs = [...new Set(speciesEntries.map((entry) => entry.slug))].sort();
const entries: Record<string, Entry> = {};
let own = 0;
let canonical = 0;
let grouped = 0;
const unlinked: string[] = [];

for (const slug of staticSlugs) {
    const identityKey = slug.replace(/-/g, "_");
    const matches = catalog.filter((row) => pageSlugOf(row) === slug || row.landing_page_slug === slug || row.normalized_identity_key === identityKey);

    const indexedMatch = matches.find(isIndexed);
    if (indexedMatch) {
        entries[slug] = {speciesProfileId: indexedMatch.species_profile_id, source: "own"};
        own += 1;
        continue;
    }

    const folded = matches
        .map((row) => profileById.get(row.species_profile_id)?.canonical_species_profile_id)
        .map((id) => (id ? rowByProfileId.get(id) : undefined))
        .find((row): row is CatalogRow => Boolean(row && isIndexed(row)));
    if (folded) {
        entries[slug] = {speciesProfileId: folded.species_profile_id, source: "canonical"};
        canonical += 1;
        continue;
    }

    const members = [...indexedByPageSlug.entries()]
        .filter(([memberSlug]) => memberSlug !== slug && memberSlug.endsWith(`-${slug}`) && !isNamedLikeButNot(memberSlug))
        .map(([memberSlug, row]) => ({slug: memberSlug, name: row.display_name?.trim() || memberSlug, animalDexNumber: row.animaldex_number as number}))
        .sort((a, b) => a.animalDexNumber - b.animalDexNumber);
    if (members.length > 0) {
        entries[slug] = {members};
        grouped += 1;
    } else {
        unlinked.push(slug);
    }
}

const output = {
    generatedAt: new Date().toISOString().slice(0, 10),
    note: "Hand-coded /animals pages linked to the catalog: their own indexed species_profile_id, a folded duplicate's canonical profile, or, for group pages with no indexed group profile, the indexed species they cover. Written by scripts/refreshStaticSpeciesProfiles.mts; the build never queries Supabase.",
    entries
};
writeFileSync(join(root, "src/data/published-seo-static-species-profiles.json"), `${JSON.stringify(output, null, 2)}\n`);
console.log(`static pages ${staticSlugs.length}: own profile ${own}, canonical ${canonical}, group members ${grouped}, unlinked ${unlinked.length}`);
console.log(`unlinked: ${unlinked.join(" ")}`);
