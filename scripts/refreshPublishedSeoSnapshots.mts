/**
 * Rebuild checked-in SEO page snapshots for DB-only published animals and
 * catalog-only published lessons.
 *
 * Operator-run only. Do NOT add this to Next prebuild.
 *
 * Newly published database content does not become an SEO page until
 * `yarn refresh:published-seo` is run and the result is deployed.
 *
 * Usage:
 *   yarn refresh:published-seo
 *   tsx scripts/refreshPublishedSeoSnapshots.mts
 */

import {existsSync, readFileSync, writeFileSync} from "node:fs";
import Module from "node:module";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";

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

function readTrimmedEnv(name: string) {
    const value = process.env[name]?.trim();
    return value || null;
}

function supabaseUrl() {
    const raw = readTrimmedEnv("SUPABASE_URL")
        ?? readTrimmedEnv("NEXT_PUBLIC_SUPABASE_URL");
    if (!raw) {
        return null;
    }
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
        return raw.replace(/\/$/, "");
    }
    if (raw.includes(".supabase.co")) {
        return `https://${raw}`;
    }
    return null;
}

function supabaseKey() {
    return readTrimmedEnv("SUPABASE_SERVICE_ROLE_KEY")
        ?? readTrimmedEnv("SUPABASE_SECRET_KEY")
        ?? readTrimmedEnv("SUPABASE_SERVICE_KEY")
        ?? readTrimmedEnv("SUPABASE_ANON_KEY")
        ?? readTrimmedEnv("SUPABASE_PUBLISHABLE_KEY")
        ?? readTrimmedEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
        ?? readTrimmedEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
}

function supabaseHeaders(key: string) {
    const headers: Record<string, string> = {apikey: key};
    if (key.startsWith("eyJ")) {
        headers.Authorization = `Bearer ${key}`;
    }
    return headers;
}

function clean(value: string | null | undefined) {
    const trimmed = value?.trim();
    return trimmed || null;
}

function stripCatalogNumberSuffix(slug: string, animalDexNumber?: number | null) {
    if (!animalDexNumber) {
        return slug;
    }
    const suffix = `-${animalDexNumber}`;
    return slug.endsWith(suffix) ? slug.slice(0, -suffix.length) : slug;
}

function canonicalSlug(row: {
    landing_page_slug?: string | null;
    normalized_identity_key?: string | null;
    animaldex_number?: number | null;
}) {
    const landingSlug = clean(row.landing_page_slug);
    const identitySlug = clean(row.normalized_identity_key)?.replace(/_/g, "-") ?? "";
    const normalizedLanding = landingSlug
        ? stripCatalogNumberSuffix(landingSlug, row.animaldex_number)
        : "";
    const value = normalizedLanding || identitySlug;
    return value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

function inferCategory(row: {display_name?: string | null; animal_name?: string | null; scientific_name?: string | null}) {
    const text = `${row.display_name ?? ""} ${row.animal_name ?? ""} ${row.scientific_name ?? ""}`.toLowerCase();
    const categories: [RegExp, string][] = [
        [/\b(owl|eagle|hawk|falcon|parrot|penguin|duck|goose|swan|bird|finch|warbler|myna|pigeon|dove|crane|heron|stork|shrike|pheasant|turkey|chicken|albatross)\b/, "Bird"],
        [/\b(shark|ray|fish|trout|salmon|tuna|seahorse|eel|carp|gar|goby|wrasse|catfish)\b/, "Fish"],
        [/\b(frog|toad|salamander|newt|caecilian|amphibian)\b/, "Amphibian"],
        [/\b(snake|lizard|gecko|skink|tortoise|turtle|crocodile|alligator|iguana|chameleon|reptile|tegu|dragon)\b/, "Reptile"],
        [/\b(spider|scorpion|harvestman|tick|mite|arachnid)\b/, "Arachnid"],
        [/\b(ant|bee|wasp|moth|butterfly|beetle|fly|cricket|grasshopper|cockroach|dragonfly|insect|caterpillar|centipede|millipede)\b/, "Invertebrate"],
        [/\b(octopus|squid|jellyfish|crab|lobster|shrimp|snail|slug|urchin|starfish|sea star|anemone|coral|worm|mollusc)\b/, "Marine invertebrate"],
        [/\b(whale|dolphin|seal|sea lion|otter|bear|wolf|fox|cat|dog|monkey|macaque|ape|gorilla|elephant|deer|pig|cow|cattle|goat|sheep|horse|rabbit|rat|mouse|bat|mammal|kangaroo|sloth|armadillo|rhinoceros|rhino)\b/, "Mammal"]
    ];
    return categories.find(([pattern]) => pattern.test(text))?.[1] ?? "Animal";
}

function metadataRange(row: {generation_metadata?: Record<string, any> | null}) {
    const metadata = row.generation_metadata ?? {};
    const nativeRange = metadata.native_range ?? metadata.nativeRange;
    if (typeof nativeRange === "string") {
        return nativeRange;
    }
    if (nativeRange && typeof nativeRange === "object") {
        return clean(nativeRange.range_text) ?? clean(nativeRange.rangeText) ?? clean(nativeRange.habitat);
    }
    return clean(metadata.range_text) ?? clean(metadata.native_range_text) ?? null;
}

function readCatalogGameStats(value: Record<string, number> | null | undefined) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }
    const keys = ["dominance", "speed", "size", "intelligence", "rarity"] as const;
    if (!keys.every((key) => Number.isFinite(Number(value[key])))) {
        return null;
    }
    return value;
}

function parseBestUseCases(value: unknown) {
    if (Array.isArray(value)) {
        return value.map((item) => String(item).trim()).filter(Boolean);
    }
    if (typeof value === "string" && value.trim()) {
        return value.split(/[,;|]/).map((item) => item.trim()).filter(Boolean);
    }
    return [];
}

function buildFallbackApplicationExample(
    slug: string,
    principleName: string | null,
    principleExpression: string | null,
    coreLesson: string | null,
    biologicalBasis: string | null,
    shortMotto: string | null
) {
    return [
        shortMotto,
        principleExpression,
        coreLesson,
        biologicalBasis,
        principleName ? `Apply ${principleName} the way ${slug.replace(/-/g, " ")} does.` : null
    ].find((item) => item && item.trim()) ?? `${slug.replace(/-/g, " ")} offers a practical behavior lesson.`;
}

type CatalogRow = {
    species_profile_id: string;
    animaldex_number: number | null;
    display_name: string | null;
    animal_name: string | null;
    refined_identity: string | null;
    normalized_identity_key: string | null;
    scientific_name: string | null;
    identity_kind: string | null;
    landing_page_slug: string | null;
    catalog_status: string | null;
    species_subtitle: string | null;
    species_subtitle_story: string | null;
    principle_name: string | null;
    principle_expression: string | null;
    core_lesson: string | null;
    biological_basis: string | null;
    short_motto: string | null;
    best_use_cases: string[] | null;
    application_example: string | null;
    generation_metadata: Record<string, any> | null;
    canonical_game_stats?: Record<string, number> | null;
    created_at: string | null;
    updated_at: string | null;
};

type ProfileRow = {
    id: string;
    animaldex_number: number | null;
    catalog_status: string | null;
    canonical_game_stats?: Record<string, number> | null;
    generation_metadata?: Record<string, any> | null;
};

type GuideRow = {
    species_profile_id: string;
    species_spotlight: string | null;
    species_subtitle_story: string | null;
    signature_traits: string[] | null;
    interesting_facts: string[] | null;
    typical_habitat: string | null;
    diet_summary: string | null;
    predators_summary: string | null;
    sleep_pattern: string | null;
    lifespan_estimate: string | null;
    female_offspring_notes: string | null;
    sex_difference_notes: string | null;
    field_guide_version: string | null;
    updated_at: string | null;
};

function mapAnimal(row: CatalogRow, guide: GuideRow | null) {
    const slug = canonicalSlug(row);
    const name = clean(row.display_name) ?? clean(row.refined_identity) ?? clean(row.animal_name) ?? slug.replace(/-/g, " ");
    const gameStats = readCatalogGameStats(row.canonical_game_stats as Record<string, number> | null);
    const rarityScore = Math.max(0, Math.min(100, Number(gameStats?.rarity ?? 0)));
    const signatureTraits = (guide?.signature_traits ?? []).filter(Boolean);
    const interestingFacts = (guide?.interesting_facts ?? []).filter(Boolean);
    const subtitle = clean(guide?.species_subtitle_story) ?? clean(row.species_subtitle_story) ?? clean(row.species_subtitle);
    const summary = clean(guide?.species_spotlight) ?? subtitle ?? `${name} is an indexed AnimalDex species with a field profile connected to live captures, canonical stats, and collection progress.`;
    const habitat = clean(guide?.typical_habitat) ?? metadataRange(row) ?? `${name} habitat data is maintained in the live AnimalDex field guide.`;
    const nativeRange = metadataRange(row) ?? habitat;
    const scientificName = clean(row.scientific_name) ?? "Scientific classification under review";
    const publishedAt = row.created_at || new Date().toISOString();
    const updatedAt = [row.updated_at, guide?.updated_at].filter(Boolean).sort().at(-1) ?? publishedAt;

    return {
        slug,
        name,
        speciesProfileId: row.species_profile_id,
        normalizedIdentityKey: row.normalized_identity_key ?? slug.replace(/-/g, "_"),
        heroTitle: `${name} — Identification, Habitat, Animal Power & Facts`,
        publishedAt,
        updatedAt,
        featuredImage: {src: `/api/species-images/${slug}`, alt: `${name} AnimalDex species guide`, width: 1200, height: 1500},
        searchIntents: [name, scientificName, `${name} facts`, `${name} habitat`, `${name} animal power`, `${name} identification`],
        analysis: {
            summary,
            scientificName,
            category: inferCategory(row),
            identification: signatureTraits.length ? signatureTraits : [`Recognized in AnimalDex as ${name}`, `Indexed profile #${row.animaldex_number}`],
            habitat,
            nativeRange,
            rarityScore,
            rarityReason: `AnimalDex canonical rarity score: ${rarityScore}/100, maintained by the live indexed species profile.`
        },
        premiumDetails: {
            behaviorTraits: signatureTraits.length ? signatureTraits : [clean(row.principle_expression) ?? clean(row.core_lesson) ?? summary],
            whyInteresting: interestingFacts,
            respectfulSpotting: [
                "Observe from a respectful distance and avoid changing the animal's behavior.",
                "Do not block feeding, shelter, nesting, or travel routes.",
                "Use a live camera capture without handling or staging wildlife."
            ],
            lookalikes: []
        },
        relatedSpecies: [],
        databaseSource: {
            animalDexNumber: row.animaldex_number,
            identityKind: clean(row.identity_kind),
            canonicalGameStats: gameStats,
            seoIndexable: true,
            fieldGuideVersion: guide?.field_guide_version ?? null,
            fieldGuide: {
                dietSummary: clean(guide?.diet_summary),
                predatorsSummary: clean(guide?.predators_summary),
                sleepPattern: clean(guide?.sleep_pattern),
                lifespanEstimate: clean(guide?.lifespan_estimate),
                femaleOffspringNotes: clean(guide?.female_offspring_notes),
                sexDifferenceNotes: clean(guide?.sex_difference_notes)
            }
        }
    };
}

function mapLesson(row: CatalogRow) {
    const slug = canonicalSlug(row);
    if (!slug || !row.core_lesson?.trim() || !row.principle_name?.trim()) {
        return null;
    }

    return {
        slug,
        displayName: clean(row.display_name) ?? slug.replace(/-/g, " "),
        normalizedIdentityKey: clean(row.normalized_identity_key) ?? slug.replace(/-/g, "_"),
        principleName: row.principle_name.trim(),
        principleExpression: row.principle_expression?.trim() || null,
        coreLesson: row.core_lesson.trim(),
        biologicalBasis: row.biological_basis?.trim() ?? "",
        shortMotto: row.short_motto?.trim() ?? "",
        bestUseCases: parseBestUseCases(row.best_use_cases),
        applicationExample: clean(row.application_example) ?? buildFallbackApplicationExample(
            slug,
            row.principle_name,
            row.principle_expression,
            row.core_lesson,
            row.biological_basis,
            row.short_motto
        ),
        imageFile: null,
        source: "catalog" as const
    };
}

function chunk<T>(items: T[], size: number) {
    const batches: T[][] = [];
    for (let index = 0; index < items.length; index += size) {
        batches.push(items.slice(index, index + size));
    }
    return batches;
}

async function fetchJson<T>(url: string, headers: Record<string, string>): Promise<T[]> {
    const response = await fetch(url, {headers});
    if (!response.ok) {
        throw new Error(`${url} failed: ${response.status} ${await response.text()}`);
    }
    const payload = await response.json();
    return Array.isArray(payload) ? payload as T[] : [];
}

function quoteIn(values: string[]) {
    return values.map((value) => `"${value.replace(/"/g, "")}"`).join(",");
}

async function main() {
    const url = supabaseUrl();
    const key = supabaseKey();
    if (!url || !key) {
        throw new Error("Missing SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL and a read key. Operator refresh needs production credentials.");
    }

    const {speciesEntries} = await import("../src/data/species.ts");
    const published = JSON.parse(readFileSync(join(root, "src/data/published-seo-slugs.json"), "utf8")) as {
        animals: string[];
        lessons: string[];
    };

    const localSlugs = new Set(speciesEntries.map((entry) => entry.slug));
    const missingAnimals = published.animals.filter((slug) => !localSlugs.has(slug));
    const missingLessons = published.lessons.filter((slug) => !localSlugs.has(slug));
    const neededSlugs = [...new Set([...missingAnimals, ...missingLessons])].sort((a, b) => a.localeCompare(b));

    const headers = supabaseHeaders(key);
    const catalogSelect = [
        "species_profile_id", "animaldex_number", "display_name", "animal_name", "refined_identity",
        "normalized_identity_key", "scientific_name", "identity_kind", "landing_page_slug",
        "catalog_status", "species_subtitle", "species_subtitle_story", "principle_name",
        "principle_expression", "core_lesson", "biological_basis", "short_motto",
        "best_use_cases", "application_example", "created_at", "updated_at"
    ].join(",");
    const rowsBySlug = new Map<string, CatalogRow>();

    for (const slugs of chunk(neededSlugs, 80)) {
        const landingParams = new URLSearchParams({
            select: catalogSelect,
            landing_page_slug: `in.(${quoteIn(slugs)})`
        });
        const identityParams = new URLSearchParams({
            select: catalogSelect,
            normalized_identity_key: `in.(${quoteIn(slugs.map((slug) => slug.replace(/-/g, "_")))})`
        });
        const [byLanding, byIdentity] = await Promise.all([
            fetchJson<CatalogRow>(`${url}/rest/v1/species_catalog_v1?${landingParams}`, headers),
            fetchJson<CatalogRow>(`${url}/rest/v1/species_catalog_v1?${identityParams}`, headers)
        ]);
        for (const row of [...byLanding, ...byIdentity]) {
            const slug = canonicalSlug(row);
            if (slug && !rowsBySlug.has(slug)) {
                rowsBySlug.set(slug, row);
            }
        }
    }

    const profileIds = [...new Set(
        [...rowsBySlug.values()].map((row) => row.species_profile_id).filter(Boolean)
    )];
    const profilesById = new Map<string, ProfileRow>();
    for (const ids of chunk(profileIds, 80)) {
        const params = new URLSearchParams({
            select: "id,animaldex_number,catalog_status,canonical_game_stats,generation_metadata",
            id: `in.(${quoteIn(ids)})`
        });
        const profiles = await fetchJson<ProfileRow>(`${url}/rest/v1/species_profiles?${params}`, headers);
        for (const profile of profiles) {
            profilesById.set(profile.id, profile);
        }
    }

    const guidesByProfileId = new Map<string, GuideRow>();
    for (const ids of chunk(profileIds, 80)) {
        const params = new URLSearchParams({
            select: [
                "species_profile_id", "species_spotlight", "species_subtitle_story", "signature_traits",
                "interesting_facts", "typical_habitat", "diet_summary", "predators_summary",
                "sleep_pattern", "lifespan_estimate", "female_offspring_notes", "sex_difference_notes",
                "field_guide_version", "updated_at"
            ].join(","),
            species_profile_id: `in.(${quoteIn(ids)})`
        });
        const guides = await fetchJson<GuideRow>(`${url}/rest/v1/species_field_guide?${params}`, headers);
        for (const guide of guides) {
            guidesByProfileId.set(guide.species_profile_id, guide);
        }
    }

    const animalEntries = missingAnimals
        .map((slug) => {
            const row = rowsBySlug.get(slug);
            if (!row) {
                return null;
            }
            const profile = profilesById.get(row.species_profile_id);
            if (profile?.catalog_status === "hidden") {
                return null;
            }
            const merged: CatalogRow = {
                ...row,
                animaldex_number: typeof profile?.animaldex_number === "number"
                    ? profile.animaldex_number
                    : row.animaldex_number,
                generation_metadata: profile?.generation_metadata ?? row.generation_metadata,
                canonical_game_stats: profile?.canonical_game_stats ?? row.canonical_game_stats
            };
            if (typeof merged.animaldex_number !== "number" || merged.animaldex_number < 1) {
                return null;
            }
            return mapAnimal(merged, guidesByProfileId.get(row.species_profile_id) ?? null);
        })
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
        .sort((left, right) => left.slug.localeCompare(right.slug));

    const lessonEntries = missingLessons
        .map((slug) => {
            const row = rowsBySlug.get(slug);
            return row ? mapLesson(row) : null;
        })
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
        .sort((left, right) => left.slug.localeCompare(right.slug));

    const uniqueAnimals = new Map(animalEntries.map((entry) => [entry.slug, entry]));
    const uniqueLessons = new Map(lessonEntries.map((entry) => [entry.slug, entry]));
    const note = "Newly published DB content does not become an SEO page until this snapshot is refreshed and deployed. The production build consumes this file only and never fetches Supabase.";
    const generatedAt = new Date().toISOString().slice(0, 10);
    const source = "operator refresh from production catalog; local species/lessons stay in source files";

    const animalPath = join(root, "src/data/published-seo-animal-pages.json");
    const lessonPath = join(root, "src/data/published-seo-lesson-pages.json");
    writeFileSync(animalPath, `${JSON.stringify({
        generatedAt,
        source,
        note,
        entries: [...uniqueAnimals.values()]
    }, null, 2)}\n`);
    writeFileSync(lessonPath, `${JSON.stringify({
        generatedAt,
        source,
        note,
        entries: [...uniqueLessons.values()]
    }, null, 2)}\n`);

    const missingAnimalGaps = missingAnimals.filter((slug) => !uniqueAnimals.has(slug));
    const missingLessonGaps = missingLessons.filter((slug) => !uniqueLessons.has(slug));

    console.log(`wrote ${animalPath}`);
    console.log(`animal snapshots ${uniqueAnimals.size} / ${missingAnimals.length} DB-only published`);
    console.log(`wrote ${lessonPath}`);
    console.log(`lesson snapshots ${uniqueLessons.size} / ${missingLessons.length} catalog-only published`);
    if (missingAnimalGaps.length) {
        console.warn(`missing animal snapshots: ${missingAnimalGaps.slice(0, 20).join(", ")}${missingAnimalGaps.length > 20 ? "…" : ""}`);
    }
    if (missingLessonGaps.length) {
        console.warn(`missing lesson snapshots: ${missingLessonGaps.slice(0, 20).join(", ")}${missingLessonGaps.length > 20 ? "…" : ""}`);
    }
    console.log("Do not add this command to Next prebuild.");
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
