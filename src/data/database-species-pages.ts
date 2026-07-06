import "server-only";

import type {SpeciesEntry} from "@/data/species";
import {speciesEntries} from "@/data/species";
import {mergeCatalogMetadata} from "@/lib/animaldex-number";
import {getSupabaseHeaders, getSupabaseServerReadKey, getSupabaseUrl} from "@/lib/supabase-http";

type CatalogRow = {
    species_profile_id: string;
    animaldex_number: number;
    display_name: string | null;
    animal_name: string | null;
    refined_identity: string | null;
    normalized_identity_key: string;
    scientific_name: string | null;
    identity_kind: string | null;
    canonical_game_stats: Record<string, number> | null;
    size_scale_score: number | null;
    landing_page_slug: string | null;
    catalog_status: string | null;
    generation_status: string | null;
    generation_metadata: Record<string, any> | null;
    species_subtitle: string | null;
    species_subtitle_story: string | null;
    principle_name: string | null;
    principle_expression: string | null;
    core_lesson: string | null;
    biological_basis: string | null;
    short_motto: string | null;
    best_use_cases: string[] | null;
    application_example: string | null;
    created_at: string;
    updated_at: string;
};

type IndexedProfileRow = {
    id: string;
    animaldex_number: number;
    catalog_status: string | null;
};

type FieldGuideRow = {
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
    updated_at: string;
};

const CATALOG_SELECT = [
    "species_profile_id", "animaldex_number", "display_name", "animal_name", "refined_identity",
    "normalized_identity_key", "scientific_name", "identity_kind", "canonical_game_stats", "size_scale_score",
    "landing_page_slug", "catalog_status", "generation_status", "generation_metadata", "species_subtitle",
    "species_subtitle_story", "principle_name", "principle_expression", "core_lesson", "biological_basis",
    "short_motto", "best_use_cases", "application_example", "created_at", "updated_at"
].join(",");

const GUIDE_SELECT = [
    "species_profile_id", "species_spotlight", "species_subtitle_story", "signature_traits", "interesting_facts",
    "typical_habitat", "diet_summary", "predators_summary", "sleep_pattern", "lifespan_estimate",
    "female_offspring_notes", "sex_difference_notes", "field_guide_version", "updated_at"
].join(",");

const INDEXED_PROFILE_SELECT = "id,animaldex_number,catalog_status";

let catalogCache: {expiresAt: number; entries: SpeciesEntry[]} | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000;

function clean(value: string | null | undefined) {
    const trimmed = value?.trim();
    return trimmed || null;
}

function stripCatalogNumberSuffix(slug: string, animalDexNumber?: number) {
    if (!animalDexNumber) {
        return slug;
    }

    const suffix = `-${animalDexNumber}`;

    return slug.endsWith(suffix) ? slug.slice(0, -suffix.length) : slug;
}

export function databaseSpeciesCanonicalSlug(row: Pick<CatalogRow, "landing_page_slug" | "normalized_identity_key" | "animaldex_number">) {
    const landingSlug = clean(row.landing_page_slug);
    const identitySlug = clean(row.normalized_identity_key)?.replace(/_/g, "-") ?? "";
    const normalizedLanding = landingSlug
        ? stripCatalogNumberSuffix(landingSlug, row.animaldex_number)
        : "";
    const value = normalizedLanding || identitySlug;
    return value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

function inferCategory(row: CatalogRow) {
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

function metadataRange(row: CatalogRow) {
    const metadata = row.generation_metadata ?? {};
    const nativeRange = metadata.native_range ?? metadata.nativeRange;
    if (typeof nativeRange === "string") return nativeRange;
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

function mapDatabaseSpecies(row: CatalogRow, guide: FieldGuideRow | null): SpeciesEntry {
    const slug = databaseSpeciesCanonicalSlug(row);
    const name = clean(row.display_name) ?? clean(row.refined_identity) ?? clean(row.animal_name) ?? slug.replace(/-/g, " ");
    const gameStats = readCatalogGameStats(row.canonical_game_stats);
    const rarityScore = Math.max(0, Math.min(100, Number(gameStats?.rarity ?? 0)));
    const signatureTraits = (guide?.signature_traits ?? []).filter(Boolean);
    const interestingFacts = (guide?.interesting_facts ?? []).filter(Boolean);
    const subtitle = clean(guide?.species_subtitle_story) ?? clean(row.species_subtitle_story) ?? clean(row.species_subtitle);
    const summary = clean(guide?.species_spotlight) ?? subtitle ?? `${name} is an indexed AnimalDex species with a field profile connected to live captures, canonical stats, and collection progress.`;
    const habitat = clean(guide?.typical_habitat) ?? metadataRange(row) ?? `${name} habitat data is maintained in the live AnimalDex field guide.`;
    const nativeRange = metadataRange(row) ?? habitat;
    const scientificName = clean(row.scientific_name) ?? "Scientific classification under review";
    const hasStrongGuide = Boolean(
        guide && guide.field_guide_version !== "v1_pending" &&
        (clean(guide.species_spotlight) || clean(guide.species_subtitle_story)) &&
        (signatureTraits.length >= 2 || interestingFacts.length >= 2)
    );
    const hasPrinciple = Boolean(clean(row.principle_name) && clean(row.core_lesson) && clean(row.biological_basis));
    const seoIndexable = hasStrongGuide && hasPrinciple;
    const publishedAt = row.created_at || new Date().toISOString();
    const updatedAt = [row.updated_at, guide?.updated_at].filter(Boolean).sort().at(-1) ?? publishedAt;

    return {
        slug,
        name,
        speciesProfileId: row.species_profile_id,
        normalizedIdentityKey: row.normalized_identity_key,
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
            seoIndexable,
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

async function fetchRows<T>(table: string, select: string, filters: Record<string, string> = {}) {
    const url = getSupabaseUrl();
    const key = getSupabaseServerReadKey();
    if (!url || !key) return [] as T[];
    // Keep each response below Next.js 13's 2 MB incremental-fetch cache limit.
    const pageSize = 250;
    const params = new URLSearchParams({select, limit: String(pageSize)});
    for (const [name, value] of Object.entries(filters)) params.set(name, value);
    if (!params.has("order")) params.set("order", "species_profile_id.asc");

    const rows: T[] = [];
    for (let offset = 0; ; offset += pageSize) {
        params.set("offset", String(offset));
        const response = await fetch(`${url}/rest/v1/${table}?${params}`, {
            headers: getSupabaseHeaders(key),
            next: {revalidate: 3600}
        });
        if (!response.ok) {
            throw new Error(`Failed to load ${table} page at offset ${offset}: ${response.status}`);
        }
        const data = await response.json();
        if (!Array.isArray(data)) {
            throw new Error(`Invalid ${table} response at offset ${offset}`);
        }
        rows.push(...data as T[]);
        if (data.length < pageSize) return rows;
    }
}

async function loadDatabaseEntries() {
    const [indexedProfileRows, catalogRows, guideRows] = await Promise.all([
        fetchRows<IndexedProfileRow>("species_profiles", INDEXED_PROFILE_SELECT, {animaldex_number: "not.is.null", order: "animaldex_number.asc"}),
        fetchRows<CatalogRow>("species_catalog_v1", CATALOG_SELECT, {animaldex_number: "not.is.null", order: "animaldex_number.asc"}),
        fetchRows<FieldGuideRow>("species_field_guide", GUIDE_SELECT)
    ]);
    const indexedNumbers = new Map(
        indexedProfileRows
            .filter((row) => row.catalog_status !== "hidden")
            .map((row) => [row.id, row.animaldex_number])
    );
    const guides = new Map(guideRows.map((row) => [row.species_profile_id, row]));
    const bySlug = new Map<string, SpeciesEntry>();
    for (const row of catalogRows) {
        const animalDexNumber = indexedNumbers.get(row.species_profile_id);
        if (animalDexNumber === undefined) continue;
        const slug = databaseSpeciesCanonicalSlug(row);
        if (!slug || bySlug.has(slug)) continue;
        bySlug.set(slug, mapDatabaseSpecies(
            {...row, animaldex_number: animalDexNumber},
            guides.get(row.species_profile_id) ?? null
        ));
    }
    return Array.from(bySlug.values());
}

export async function getDatabaseSpeciesEntries() {
    if (catalogCache && catalogCache.expiresAt > Date.now()) return catalogCache.entries;
    const entries = await loadDatabaseEntries();
    catalogCache = {entries, expiresAt: Date.now() + CACHE_TTL_MS};
    return entries;
}

export async function getDatabaseSpeciesBySlug(slug: string) {
    const normalized = slug.trim().toLowerCase();
    const identity = normalized.replace(/-/g, "_");
    const entries = await getDatabaseSpeciesEntries();
    return entries.find((entry) => {
        if (entry.slug === normalized || entry.normalizedIdentityKey === identity) {
            return true;
        }

        const catalogNumber = entry.databaseSource?.animalDexNumber;

        return catalogNumber
            ? stripCatalogNumberSuffix(entry.slug, catalogNumber) === normalized
            : false;
    }) ?? null;
}

export async function getResolvedSpeciesBySlug(slug: string) {
    const normalized = slug.trim().toLowerCase();
    const staticEntry = speciesEntries.find((entry) => entry.slug === normalized) ?? null;
    const databaseEntry = await getDatabaseSpeciesBySlug(normalized);

    if (staticEntry) {
        return mergeCatalogMetadata(staticEntry, databaseEntry);
    }

    return databaseEntry;
}

export async function getUnifiedSpeciesEntries() {
    const databaseEntries = await getDatabaseSpeciesEntries();
    const databaseBySlug = new Map(databaseEntries.map((entry) => [entry.slug, entry]));
    const staticSlugs = new Set(speciesEntries.map((entry) => entry.slug));
    const enrichedStatic = speciesEntries.map((entry) => mergeCatalogMetadata(entry, databaseBySlug.get(entry.slug)));

    return [...enrichedStatic, ...databaseEntries.filter((entry) => !staticSlugs.has(entry.slug))]
        .sort((left, right) => left.name.localeCompare(right.name));
}
