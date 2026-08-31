import "server-only";

import type {SpeciesEntry} from "@/data/species";
import {speciesEntries} from "@/data/species";
import {
    getBiologyAnchorSlugsToExclude,
    getLegendaryCatalogSeedByBeastSlug,
    getLegendaryCatalogSeedByBiologyLandingSlug
} from "@/data/legendary-earth-beasts-catalog-seed";
import {enrichLegendaryEarthBeastSpeciesEntry, legendaryEarthBeastSpeciesSlugs} from "@/data/legendary-earth-beasts-species";
import {mergeCatalogMetadata} from "@/lib/animaldex-number";
import {dedupeCatalogSpeciesEntries, speciesCatalogIdentityKey} from "@/lib/catalog-species-dedupe";
import {resolveCollectionIdentityToken, setRuntimeSpeciesIdentityAliases} from "@/lib/collection-identity-aliases";
import {isNonCanonicalLifeStageCatalogIdentity, resolveCanonicalSlugFromIdentity} from "@/lib/species-life-stage-policy";
import {logDevPerfEvent} from "@/lib/dev-request-timing";
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
    canonical_species_profile_id: string | null;
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
    "normalized_identity_key", "scientific_name", "identity_kind", "canonical_species_profile_id",
    "canonical_game_stats", "size_scale_score",
    "landing_page_slug", "catalog_status", "generation_status", "generation_metadata", "species_subtitle",
    "species_subtitle_story", "principle_name", "principle_expression", "core_lesson", "biological_basis",
    "short_motto", "best_use_cases", "application_example", "created_at", "updated_at"
].join(",");

const SPECIFIC_IDENTITY_KINDS = new Set(["breed", "cross_breed", "subspecies"]);

/** Common capture identity keys that should fall through to the domestic parent row. */
const PRINCIPLE_IDENTITY_ALIASES: Record<string, string> = {
    domestic_dog: "dog",
    domestic_cat: "cat",
    canis_lupus_familiaris: "dog",
    felis_catus: "cat",
    felis_silvestris_catus: "cat"
};

const GUIDE_SELECT = [
    "species_profile_id", "species_spotlight", "species_subtitle_story", "signature_traits", "interesting_facts",
    "typical_habitat", "diet_summary", "predators_summary", "sleep_pattern", "lifespan_estimate",
    "female_offspring_notes", "sex_difference_notes", "field_guide_version", "updated_at"
].join(",");

const INDEXED_PROFILE_SELECT = "id,animaldex_number,catalog_status";

export type CatalogBehaviorPrinciple = {
    principleName: string;
    coreLesson: string | null;
    bestUseCases: string[];
};

type PrincipleCatalogMeta = {
    profileId: string;
    identityKey: string | null;
    scientificName: string | null;
    identityKind: string | null;
    canonicalSpeciesProfileId: string | null;
    animalDexNumber: number | null;
    principle: CatalogBehaviorPrinciple | null;
};

export type CatalogBehaviorPrincipleIndex = {
    byProfileId: Map<string, PrincipleCatalogMeta>;
    byIdentityKey: Map<string, PrincipleCatalogMeta>;
    byScientificSpeciesKey: Map<string, PrincipleCatalogMeta[]>;
};

function emptyBehaviorPrincipleIndex(): CatalogBehaviorPrincipleIndex {
    return {
        byProfileId: new Map(),
        byIdentityKey: new Map(),
        byScientificSpeciesKey: new Map()
    };
}

export {emptyBehaviorPrincipleIndex};

type CatalogCacheEntry = {
    expiresAt: number;
    entries: SpeciesEntry[];
    behaviorPrinciples: CatalogBehaviorPrincipleIndex;
};

let catalogCache: CatalogCacheEntry | null = null;
let catalogLoadPromise: Promise<CatalogCacheEntry> | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000;

type GlobalCatalogCache = typeof globalThis & {
    __adexCatalogCache?: CatalogCacheEntry;
};

function readCatalogCache(): CatalogCacheEntry | null {
    const globalCache = (globalThis as GlobalCatalogCache).__adexCatalogCache;
    if (globalCache && globalCache.expiresAt > Date.now()) {
        return globalCache;
    }
    if (catalogCache && catalogCache.expiresAt > Date.now()) {
        return catalogCache;
    }
    return null;
}

function writeCatalogCache(value: CatalogCacheEntry) {
    catalogCache = value;
    (globalThis as GlobalCatalogCache).__adexCatalogCache = value;
}

function parseBestUseCases(value: unknown) {
    if (!Array.isArray(value)) return [] as string[];
    return value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean);
}

function behaviorPrincipleFromRow(row: CatalogRow): CatalogBehaviorPrinciple | null {
    const principleName = clean(row.principle_name);
    if (!principleName) return null;

    return {
        principleName,
        coreLesson: clean(row.core_lesson),
        bestUseCases: parseBestUseCases(row.best_use_cases)
    };
}

function normalizeRankingTerm(raw: string | null | undefined) {
    const folded = clean(raw)
        ?.normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/'/g, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
    return folded || null;
}

/** Matches iOS AnimalRankingCohort.scientificSpeciesKey — binomial key for parent lookup. */
function scientificSpeciesKey(scientificName: string | null | undefined) {
    const normalized = normalizeRankingTerm(scientificName);
    if (!normalized) return null;
    const tokens = normalized.split(/\s+/).filter(Boolean);
    if (tokens.length < 2) return null;
    if (tokens.includes("sp") || tokens.includes("spp") || tokens.includes("unknown")) return null;
    return `species:${tokens.slice(0, 2).join(" ")}`;
}

function parentPrincipleScore(meta: PrincipleCatalogMeta) {
    let score = 0;
    const identityKind = clean(meta.identityKind)?.toLowerCase() ?? null;

    if (identityKind === "domestic_parent" || identityKind === "generic_parent") {
        score += 80;
    } else if (!identityKind || identityKind === "species") {
        score += 50;
    } else if (SPECIFIC_IDENTITY_KINDS.has(identityKind)) {
        score -= 20;
    }

    if ((meta.animalDexNumber ?? 0) >= 1) score += 25;
    if (meta.principle) score += 30;
    return score;
}

function buildBehaviorPrincipleIndex(catalogRows: CatalogRow[]): CatalogBehaviorPrincipleIndex {
    const byProfileId = new Map<string, PrincipleCatalogMeta>();
    const byIdentityKey = new Map<string, PrincipleCatalogMeta>();
    const byScientificSpeciesKey = new Map<string, PrincipleCatalogMeta[]>();

    for (const row of catalogRows) {
        const profileId = clean(row.species_profile_id)?.toLowerCase();
        if (!profileId) continue;

        const meta: PrincipleCatalogMeta = {
            profileId,
            identityKey: clean(row.normalized_identity_key)?.toLowerCase() ?? null,
            scientificName: clean(row.scientific_name),
            identityKind: clean(row.identity_kind),
            canonicalSpeciesProfileId: clean(row.canonical_species_profile_id)?.toLowerCase() ?? null,
            animalDexNumber: typeof row.animaldex_number === "number" ? row.animaldex_number : null,
            principle: behaviorPrincipleFromRow(row)
        };

        byProfileId.set(profileId, meta);

        if (meta.identityKey) {
            const existing = byIdentityKey.get(meta.identityKey);
            // Prefer rows that carry a principle when identity keys collide.
            if (!existing || (!existing.principle && meta.principle)) {
                byIdentityKey.set(meta.identityKey, meta);
            }
        }

        const speciesKey = scientificSpeciesKey(meta.scientificName);
        if (speciesKey && meta.principle) {
            const cohort = byScientificSpeciesKey.get(speciesKey) ?? [];
            cohort.push(meta);
            byScientificSpeciesKey.set(speciesKey, cohort);
        }
    }

    return {byProfileId, byIdentityKey, byScientificSpeciesKey};
}

function catalogEntryMeta(
    index: CatalogBehaviorPrincipleIndex,
    speciesProfileId: string | null | undefined,
    normalizedIdentityKey: string | null | undefined
) {
    const profileId = clean(speciesProfileId)?.toLowerCase();
    if (profileId && index.byProfileId.has(profileId)) {
        return index.byProfileId.get(profileId) ?? null;
    }

    const identityKey = clean(normalizedIdentityKey)?.toLowerCase();
    if (identityKey && index.byIdentityKey.has(identityKey)) {
        return index.byIdentityKey.get(identityKey) ?? null;
    }

    if (identityKey) {
        const alias = PRINCIPLE_IDENTITY_ALIASES[identityKey];
        if (alias && index.byIdentityKey.has(alias)) {
            return index.byIdentityKey.get(alias) ?? null;
        }
    }

    return null;
}

function principleFollowingCanonicalChain(
    index: CatalogBehaviorPrincipleIndex,
    start: PrincipleCatalogMeta
) {
    const visited = new Set<string>([start.profileId]);
    let currentId = start.canonicalSpeciesProfileId;

    while (currentId && !visited.has(currentId)) {
        visited.add(currentId);
        const entry = index.byProfileId.get(currentId);
        if (!entry) break;
        if (entry.principle) return entry.principle;
        currentId = entry.canonicalSpeciesProfileId;
    }

    return null;
}

function parentPrincipleSharingScientificSpecies(
    index: CatalogBehaviorPrincipleIndex,
    scientificName: string | null | undefined,
    excludingProfileId: string | null | undefined
) {
    const speciesKey = scientificSpeciesKey(scientificName);
    if (!speciesKey) return null;

    const cohort = index.byScientificSpeciesKey.get(speciesKey);
    if (!cohort?.length) return null;

    const excluded = clean(excludingProfileId)?.toLowerCase() ?? null;
    let bestPrinciple: CatalogBehaviorPrinciple | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const entry of cohort) {
        if (excluded && entry.profileId === excluded) continue;
        if (!entry.principle) continue;
        const score = parentPrincipleScore(entry);
        if (score > bestScore) {
            bestScore = score;
            bestPrinciple = entry.principle;
        }
    }

    return bestPrinciple;
}

/**
 * Matches iOS SpeciesCatalogRankingIndex.behaviorPrinciple:
 * direct entry → canonical parent chain → scientific-species parent
 * (e.g. French Bulldog / Domestic Dog → Companion Readiness).
 */
export function resolveCatalogBehaviorPrinciple(
    index: CatalogBehaviorPrincipleIndex,
    speciesProfileId: string | null | undefined,
    normalizedIdentityKey: string | null | undefined,
    scientificName?: string | null
): CatalogBehaviorPrinciple | null {
    const entry = catalogEntryMeta(index, speciesProfileId, normalizedIdentityKey);
    if (entry) {
        if (entry.principle) return entry.principle;

        const viaCanonical = principleFollowingCanonicalChain(index, entry);
        if (viaCanonical) return viaCanonical;

        const viaScientific = parentPrincipleSharingScientificSpecies(
            index,
            entry.scientificName ?? scientificName,
            entry.profileId
        );
        if (viaScientific) return viaScientific;
    }

    return parentPrincipleSharingScientificSpecies(
        index,
        scientificName,
        speciesProfileId
    );
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

/** Nullable throughout: callers outside the loader read rows that may be missing any of the three. */
export function databaseSpeciesCanonicalSlug(row: {
    landing_page_slug: string | null;
    normalized_identity_key: string | null;
    animaldex_number: number | null;
}) {
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
    const seoIndexable = true;
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
    const queryStartedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
    for (let offset = 0; ; offset += pageSize) {
        params.set("offset", String(offset));
        const pageStartedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
        const response = await fetch(`${url}/rest/v1/${table}?${params}`, {
            headers: getSupabaseHeaders(key),
            next: {revalidate: 3600}
        });
        const pageMs = (typeof performance !== "undefined" ? performance.now() : Date.now()) - pageStartedAt;
        if (process.env.NODE_ENV !== "production" && pageMs >= 250) {
            logDevPerfEvent("catalog.fetch", `SLOW ${table}`, {offset, pageMs: Math.round(pageMs), status: response.status});
        }
        if (!response.ok) {
            throw new Error(`Failed to load ${table} page at offset ${offset}: ${response.status}`);
        }
        const data = await response.json();
        if (!Array.isArray(data)) {
            throw new Error(`Invalid ${table} response at offset ${offset}`);
        }
        rows.push(...data as T[]);
        if (data.length < pageSize) {
            if (process.env.NODE_ENV !== "production") {
                const totalMs = (typeof performance !== "undefined" ? performance.now() : Date.now()) - queryStartedAt;
                logDevPerfEvent("catalog.fetch", `${table} complete`, {rows: rows.length, totalMs: Math.round(totalMs)});
            }
            return rows;
        }
    }
}

type IdentityAliasRow = {
    alias_identity_key: string;
    canonical_identity_key: string;
};

async function loadSpeciesIdentityAliases() {
    try {
        const rows = await fetchRows<IdentityAliasRow>(
            "species_identity_aliases",
            "alias_identity_key,canonical_identity_key",
            {order: "alias_identity_key.asc"}
        );
        if (!rows.length) {
            setRuntimeSpeciesIdentityAliases(null);
            return;
        }

        const aliases = Object.fromEntries(
            rows
                .map((row) => [row.alias_identity_key?.trim().toLowerCase(), row.canonical_identity_key?.trim().toLowerCase()] as const)
                .filter(([alias, canonical]) => Boolean(alias && canonical))
        );
        setRuntimeSpeciesIdentityAliases(aliases);
    } catch {
        setRuntimeSpeciesIdentityAliases(null);
    }
}

async function loadDatabaseEntries() {
    await loadSpeciesIdentityAliases();
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
        if (isNonCanonicalLifeStageCatalogIdentity(row.normalized_identity_key)) {
            continue;
        }

        const animalDexNumber = indexedNumbers.get(row.species_profile_id);
        if (animalDexNumber === undefined) continue;
        const slug = databaseSpeciesCanonicalSlug(row);
        if (!slug || bySlug.has(slug)) continue;
        bySlug.set(slug, mapDatabaseSpecies(
            {...row, animaldex_number: animalDexNumber},
            guides.get(row.species_profile_id) ?? null
        ));
    }
    return {
        entries: Array.from(bySlug.values()),
        behaviorPrinciples: buildBehaviorPrincipleIndex(catalogRows)
    };
}

export function invalidateDatabaseSpeciesCache() {
    catalogCache = null;
    catalogLoadPromise = null;
    delete (globalThis as GlobalCatalogCache).__adexCatalogCache;
}

async function ensureCatalogCache() {
    const cached = readCatalogCache();
    if (cached) {
        if (process.env.NODE_ENV !== "production") {
            logDevPerfEvent("catalog.cache", "hit", {entries: cached.entries.length});
        }
        return cached;
    }

    if (!catalogLoadPromise) {
        if (process.env.NODE_ENV !== "production") {
            logDevPerfEvent("catalog.cache", "miss");
        }
        catalogLoadPromise = loadDatabaseEntries()
            .then(({entries, behaviorPrinciples}) => {
                const value = {entries, behaviorPrinciples, expiresAt: Date.now() + CACHE_TTL_MS};
                writeCatalogCache(value);
                return value;
            })
            .finally(() => {
                catalogLoadPromise = null;
            });
    }

    return catalogLoadPromise;
}

export async function getDatabaseSpeciesEntries() {
    const cached = await ensureCatalogCache();
    return cached.entries;
}

function resolveDatabaseEntryForStatic(
    staticEntry: SpeciesEntry,
    databaseBySlug: Map<string, SpeciesEntry>,
    databaseEntries: SpeciesEntry[]
) {
    const directMatch = databaseBySlug.get(staticEntry.slug);
    if (directMatch) {
        return directMatch;
    }

    const canonicalKey = speciesCatalogIdentityKey(staticEntry);
    return databaseEntries.find((entry) => speciesCatalogIdentityKey(entry) === canonicalKey) ?? null;
}

export async function getCatalogBehaviorPrincipleIndex() {
    const cached = await ensureCatalogCache();
    return cached.behaviorPrinciples;
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

function resolveLegendaryCatalogEntry(staticEntry: SpeciesEntry, databaseEntries: SpeciesEntry[]) {
    const seed = getLegendaryCatalogSeedByBeastSlug(staticEntry.slug);
    if (!seed) {
        return staticEntry;
    }

    const biologyCatalogEntry = databaseEntries.find((entry) => entry.slug === seed.biologyLandingSlug) ?? null;
    return enrichLegendaryEarthBeastSpeciesEntry(staticEntry, biologyCatalogEntry);
}

export async function getResolvedSpeciesBySlug(slug: string) {
    const normalized = slug.trim().toLowerCase();
    const identityKey = normalized.replace(/-/g, "_");
    const canonicalIdentity = resolveCollectionIdentityToken(identityKey);
    const canonicalSlug = resolveCanonicalSlugFromIdentity(canonicalIdentity) ?? canonicalIdentity.replace(/_/g, "-");
    const slugCandidates = canonicalSlug === normalized
        ? [normalized]
        : [canonicalSlug, normalized];
    const databaseEntries = await getDatabaseSpeciesEntries();

    for (const candidate of slugCandidates) {
        const staticEntry = speciesEntries.find((entry) => entry.slug === candidate) ?? null;
        const databaseEntry = databaseEntries.find((entry) => entry.slug === candidate) ?? null;

        if (staticEntry && legendaryEarthBeastSpeciesSlugs.has(staticEntry.slug)) {
            return resolveLegendaryCatalogEntry(staticEntry, databaseEntries);
        }

        if (staticEntry) {
            return mergeCatalogMetadata(staticEntry, databaseEntry);
        }

        const biologySeed = getLegendaryCatalogSeedByBiologyLandingSlug(candidate);
        if (biologySeed) {
            const beastStaticEntry = speciesEntries.find((entry) => entry.slug === biologySeed.beastSlug) ?? null;
            if (beastStaticEntry) {
                return resolveLegendaryCatalogEntry(beastStaticEntry, databaseEntries);
            }
        }

        if (databaseEntry) {
            return databaseEntry;
        }
    }

    return null;
}

export async function getUnifiedSpeciesEntries() {
    const databaseEntries = await getDatabaseSpeciesEntries();
    const databaseBySlug = new Map(databaseEntries.map((entry) => [entry.slug, entry]));
    const staticSlugs = new Set(speciesEntries.map((entry) => entry.slug));
    const biologyAnchorSlugs = getBiologyAnchorSlugsToExclude();
    const enrichedStatic = speciesEntries.map((entry) => {
        if (legendaryEarthBeastSpeciesSlugs.has(entry.slug)) {
            const seed = getLegendaryCatalogSeedByBeastSlug(entry.slug);
            const biologyCatalogEntry = seed ? databaseBySlug.get(seed.biologyLandingSlug) ?? null : null;
            return enrichLegendaryEarthBeastSpeciesEntry(entry, biologyCatalogEntry);
        }

        return mergeCatalogMetadata(entry, resolveDatabaseEntryForStatic(entry, databaseBySlug, databaseEntries));
    });

    return dedupeCatalogSpeciesEntries(
        [
            ...enrichedStatic,
            ...databaseEntries.filter((entry) => !staticSlugs.has(entry.slug) && !biologyAnchorSlugs.has(entry.slug))
        ]
    ).sort((left, right) => left.name.localeCompare(right.name));
}
