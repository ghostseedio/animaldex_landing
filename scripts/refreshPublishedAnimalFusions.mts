/**
 * Rebuild src/data/published-animal-fusions.json: every published animal that
 * can be fused (has a species profile and a behavior principle) and every
 * active species-pair fusion recipe between two of them.
 *
 * Operator-run, hooked from `npm run refresh:published-seo`. Do NOT add to
 * Next prebuild: the build reads only the snapshot.
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
        const match = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
        if (!match || line.trim().startsWith("#")) {
            continue;
        }
        let value = match[2] ?? "";
        if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        process.env[match[1]] ??= value;
    }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const {createSupabaseServiceClient} = await import("../src/lib/supabase/server.ts");
const {fetchAllSpeciesPairRecipes, fusionEntryFromRow} = await import("../src/lib/animal-fusions-server.ts");
const {getPublishedSpeciesForContent} = await import("../src/lib/static-species-overlay.ts");
const publishedSlugs = JSON.parse(readFileSync(join(root, "src/data/published-seo-slugs.json"), "utf8")).animals as string[];

const admin = createSupabaseServiceClient();
if (!admin) {
    throw new Error("SUPABASE_URL and a service key are required");
}

async function fetchAll<T>(table: string, columns: string, orderBy: string, apply: (query: any) => any = (query) => query): Promise<T[]> {
    const rows: T[] = [];
    for (let from = 0; ; from += 1000) {
        const {data, error} = await apply(admin!.from(table).select(columns)).order(orderBy, {ascending: true}).range(from, from + 999);
        if (error) throw new Error(`${table}: ${error.message}`);
        rows.push(...data);
        if (data.length < 1000) return rows;
    }
}

/**
 * Thin generic pages whose animal has no species-level page that can fuse:
 * borrow the canonical DB species (by landing slug). Generic pages with a
 * fusable species-level twin (owl → barn owl) are left out on purpose, so a
 * pair never gets two URLs.
 */
const PROFILE_ALIASES: Record<string, string> = {
    lion: "african-lion",
    leopard: "persian-leopard",
    coati: "ring-tailed-coati"
};

const published = new Set(publishedSlugs);
const profiles = await fetchAll<{id: string; landing_page_slug: string | null; display_name: string | null; catalog_status: string | null}>(
    "species_profiles",
    "id,landing_page_slug,display_name,catalog_status",
    "id"
);
const principles = new Map(
    (await fetchAll<{species_profile_id: string; principle_name: string | null}>(
        "species_behavior_principles",
        "species_profile_id,principle_name",
        "species_profile_id"
    )).map((row) => [row.species_profile_id, row.principle_name?.trim() ?? ""])
);

const nameKey = (value: string) => value.toLowerCase().replace(/[^a-z]/g, "");
const withPrinciple = profiles.filter((profile) => principles.get(profile.id));
const byLandingSlug = new Map<string, typeof profiles[number]>();
const byName = new Map<string, typeof profiles[number]>();
// Active rows first, so a hidden duplicate never shadows the live profile.
for (const profile of [...withPrinciple].sort((left, right) => Number(right.catalog_status === "active") - Number(left.catalog_status === "active"))) {
    if (profile.landing_page_slug && !byLandingSlug.has(profile.landing_page_slug)) byLandingSlug.set(profile.landing_page_slug, profile);
    const key = nameKey(profile.display_name ?? "");
    if (key && !byName.has(key)) byName.set(key, profile);
}

const species: Record<string, {id: string; name: string; principle: string}> = {};
const bySpeciesProfileId = new Map<string, {slug: string; name: string; speciesProfileId: string; principle: string}>();
function claim(slug: string, profile: typeof profiles[number] | undefined, name: string) {
    if (!profile || species[slug] || bySpeciesProfileId.has(profile.id)) return;
    const principle = principles.get(profile.id)!;
    species[slug] = {id: profile.id, name, principle};
    bySpeciesProfileId.set(profile.id, {slug, name, speciesProfileId: profile.id, principle});
}

const names = new Map(publishedSlugs.map((slug) => [slug, getPublishedSpeciesForContent(slug)?.name ?? null]));
// Pass 1, the page's own profile; pass 2, a profile with the same name; pass 3, aliases.
for (const slug of publishedSlugs) claim(slug, byLandingSlug.get(slug), names.get(slug) ?? "");
for (const slug of publishedSlugs) if (names.get(slug)) claim(slug, byName.get(nameKey(names.get(slug)!)), names.get(slug)!);
for (const [slug, target] of Object.entries(PROFILE_ALIASES)) if (published.has(slug) && names.get(slug)) claim(slug, byLandingSlug.get(target), names.get(slug)!);
for (const slug of Object.keys(species)) if (!species[slug].name) delete species[slug];

const fusions = (await fetchAllSpeciesPairRecipes(admin))
    .flatMap((row) => {
        const receiver = bySpeciesProfileId.get(row.receiver_species_profile_id);
        const donor = bySpeciesProfileId.get(row.donor_species_profile_id);
        return receiver && donor && receiver.slug !== donor.slug ? [fusionEntryFromRow(row, receiver, donor)] : [];
    })
    .filter((entry, index, all) => all.findIndex((item) => item.slug === entry.slug) === index)
    .sort((left, right) => left.slug.localeCompare(right.slug));

const sortedSpecies = Object.fromEntries(Object.entries(species).sort(([left], [right]) => left.localeCompare(right)));
const outputPath = join(root, "src/data/published-animal-fusions.json");
writeFileSync(outputPath, `${JSON.stringify({
    generatedAt: new Date().toISOString().slice(0, 10),
    source: "species_profiles + species_behavior_principles + species_principle_fusion_recipes",
    note: "Build-time fusion snapshot. Pairs fused after this date render from the DB as noindex until the next `npm run refresh:published-seo`.",
    species: sortedSpecies,
    fusions
}, null, 1)}\n`);

console.log(`wrote ${outputPath}`);
console.log(`fusable species ${Object.keys(sortedSpecies).length} of ${publishedSlugs.length} published`);
console.log(`fusions ${fusions.length}`);
