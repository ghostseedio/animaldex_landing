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

function postgrestInList(values: string[]) {
    const unique = Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
    if (!unique.length) return null;
    return `(${unique.map((value) => `"${value.replace(/"/g, "")}"`).join(",")})`;
}

function postgrestEqValue(value: string) {
    return `"${value.replace(/"/g, "")}"`;
}

function animalDexNumberIndexFromRows(
    indexedProfiles: IndexedProfileRow[],
    catalogRows: CatalogRow[]
) {
    const index = new Map<string, number>();
    const indexedNumbers = new Map(
        indexedProfiles
            .filter((row) => row.catalog_status !== "hidden" && typeof row.animaldex_number === "number" && row.animaldex_number >= 1)
            .map((row) => [row.id.toLowerCase(), row.animaldex_number])
    );

    indexedNumbers.forEach((animalDexNumber, profileId) => {
        index.set(profileId, animalDexNumber);
    });

    for (const row of catalogRows) {
        const profileId = clean(row.species_profile_id)?.toLowerCase();
        if (!profileId) continue;
        const animalDexNumber = indexedNumbers.get(profileId);
        if (animalDexNumber == null) continue;

        const slug = databaseSpeciesCanonicalSlug({...row, animaldex_number: animalDexNumber});
        if (slug) {
            index.set(slug.toLowerCase(), animalDexNumber);
        }

        const identityKey = clean(row.normalized_identity_key)?.toLowerCase();
        if (identityKey) {
            index.set(identityKey, animalDexNumber);
            index.set(identityKey.replace(/_/g, "-"), animalDexNumber);
        }
    }

    return index;
}

function expandIdentityKeysForPrincipleLookup(identityKeys: string[]) {
    const expanded = new Set<string>();
    for (const raw of identityKeys) {
        const key = clean(raw)?.toLowerCase();
        if (!key) continue;
        expanded.add(key);
        const alias = PRINCIPLE_IDENTITY_ALIASES[key];
        if (alias) expanded.add(alias);
    }
    return Array.from(expanded);
}

async function fetchCatalogRowsForCaptureKeys(options: {
    speciesProfileIds: string[];
    identityKeys: string[];
}) {
    const profileIn = postgrestInList(options.speciesProfileIds.map((id) => id.toLowerCase()));
    const identityIn = postgrestInList(expandIdentityKeysForPrincipleLookup(options.identityKeys));
    if (!profileIn && !identityIn) return [] as CatalogRow[];

    const orParts = [
        profileIn ? `species_profile_id.in.${profileIn}` : null,
        identityIn ? `normalized_identity_key.in.${identityIn}` : null
    ].filter((part): part is string => Boolean(part));

    return fetchRows<CatalogRow>("species_catalog_v1", CATALOG_SELECT, {
        or: `(${orParts.join(",")})`,
        order: "species_profile_id.asc"
    });
}

async function fetchCatalogRowsByProfileIds(profileIds: string[]) {
    const profileIn = postgrestInList(profileIds.map((id) => id.toLowerCase()));
    if (!profileIn) return [] as CatalogRow[];
    return fetchRows<CatalogRow>("species_catalog_v1", CATALOG_SELECT, {
        species_profile_id: `in.${profileIn}`,
        order: "species_profile_id.asc"
    });
}

async function fetchCatalogRowsByScientificNames(scientificNames: string[]) {
    const uniqueNames = Array.from(new Set(scientificNames.map((name) => clean(name)).filter((name): name is string => Boolean(name))));
    if (!uniqueNames.length) return [] as CatalogRow[];

    const batches = await Promise.all(uniqueNames.map((scientificName) =>
        fetchRows<CatalogRow>("species_catalog_v1", CATALOG_SELECT, {
            scientific_name: `eq.${postgrestEqValue(scientificName)}`,
            order: "species_profile_id.asc"
        })
    ));
    return batches.flat();
}

async function fetchIndexedProfilesByIds(profileIds: string[]) {
    const profileIn = postgrestInList(profileIds.map((id) => id.toLowerCase()));
    if (!profileIn) return [] as IndexedProfileRow[];
    return fetchRows<IndexedProfileRow>("species_profiles", INDEXED_PROFILE_SELECT, {
        id: `in.${profileIn}`,
        animaldex_number: "not.is.null",
        order: "animaldex_number.asc"
    });
}

function mergeCatalogRowsByProfileId(rows: CatalogRow[]) {
    const byProfileId = new Map<string, CatalogRow>();
    for (const row of rows) {
        const profileId = clean(row.species_profile_id)?.toLowerCase();
        if (!profileId || byProfileId.has(profileId)) continue;
        byProfileId.set(profileId, row);
    }
    return Array.from(byProfileId.values());
}

/**
 * Card-scoped catalog enrichment for a handful of captures.
 * Avoids downloading the full ~2k-row species catalog just to resolve AnimalDex
 * numbers and behavior lessons on the homepage.
 */
export async function getCaptureCardCatalogEnrichment(options: {
    speciesProfileIds: string[];
    identityKeys: string[];
}) {
    const cached = readCatalogCache();
    if (cached) {
        if (process.env.NODE_ENV !== "production") {
            logDevPerfEvent("catalog.card-enrichment", "full-cache-hit", {
                profileIds: options.speciesProfileIds.length,
                identityKeys: options.identityKeys.length
            });
        }

        const animalDexNumbers = new Map<string, number>();
        for (const entry of cached.entries) {
            const animalDexNumber = entry.databaseSource?.animalDexNumber;
            if (typeof animalDexNumber !== "number" || animalDexNumber < 1) continue;

            animalDexNumbers.set(entry.slug.toLowerCase(), animalDexNumber);
            if (entry.normalizedIdentityKey) {
                const identityKey = entry.normalizedIdentityKey.toLowerCase();
                animalDexNumbers.set(identityKey, animalDexNumber);
                animalDexNumbers.set(identityKey.replace(/_/g, "-"), animalDexNumber);
            }
            if (entry.speciesProfileId) {
                animalDexNumbers.set(entry.speciesProfileId.toLowerCase(), animalDexNumber);
            }
        }

        return {
            animalDexNumbers,
            behaviorPrinciples: cached.behaviorPrinciples
        };
    }

    const startedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
    const seedRows = await fetchCatalogRowsForCaptureKeys({
        speciesProfileIds: options.speciesProfileIds,
        identityKeys: options.identityKeys
    });

    const seedProfileIds = new Set(
        seedRows
            .map((row) => clean(row.species_profile_id)?.toLowerCase())
            .filter((id): id is string => Boolean(id))
    );
    for (const id of options.speciesProfileIds) {
        const normalized = clean(id)?.toLowerCase();
        if (normalized) seedProfileIds.add(normalized);
    }

    const parentIds = Array.from(new Set(
        seedRows
            .map((row) => clean(row.canonical_species_profile_id)?.toLowerCase())
            .filter((id): id is string => {
                if (!id) return false;
                return !seedProfileIds.has(id);
            })
    ));

    const seedAndParentIds = Array.from(seedProfileIds).concat(parentIds);
    const [parentRows, indexedSeedProfiles] = await Promise.all([
        fetchCatalogRowsByProfileIds(parentIds),
        fetchIndexedProfilesByIds(seedAndParentIds)
    ]);
    const rowsWithParents = mergeCatalogRowsByProfileId([...seedRows, ...parentRows]);
    const principleIndexProbe = buildBehaviorPrincipleIndex(rowsWithParents);

    const scientificNamesNeedingFallback = Array.from(new Set(
        rowsWithParents
            .filter((row) => {
                const profileId = clean(row.species_profile_id);
                const identityKey = clean(row.normalized_identity_key);
                const scientificName = clean(row.scientific_name);
                if (!scientificName) return false;
                return !resolveCatalogBehaviorPrinciple(
                    principleIndexProbe,
                    profileId,
                    identityKey,
                    scientificName
                );
            })
            .map((row) => clean(row.scientific_name))
            .filter((name): name is string => Boolean(name))
    ));

    const scientificRows = scientificNamesNeedingFallback.length
        ? await fetchCatalogRowsByScientificNames(scientificNamesNeedingFallback)
        : [];

    const catalogRows = mergeCatalogRowsByProfileId([...rowsWithParents, ...scientificRows]);
    const knownProfileIds = new Set(seedAndParentIds);
    const extraProfileIds = Array.from(new Set(
        catalogRows
            .map((row) => clean(row.species_profile_id)?.toLowerCase())
            .filter((id): id is string => {
                if (!id) return false;
                return !knownProfileIds.has(id);
            })
    ));
    const indexedExtraProfiles = extraProfileIds.length
        ? await fetchIndexedProfilesByIds(extraProfileIds)
        : [];
    const indexedProfiles = [...indexedSeedProfiles, ...indexedExtraProfiles];

    const indexedNumbers = new Map(
        indexedProfiles
            .filter((row) => row.catalog_status !== "hidden")
            .map((row) => [row.id.toLowerCase(), row.animaldex_number])
    );
    const numberedRows = catalogRows.map((row) => {
        const animalDexNumber = indexedNumbers.get(row.species_profile_id.toLowerCase());
        return animalDexNumber == null ? row : {...row, animaldex_number: animalDexNumber};
    });

    if (process.env.NODE_ENV !== "production") {
        const totalMs = (typeof performance !== "undefined" ? performance.now() : Date.now()) - startedAt;
        logDevPerfEvent("catalog.card-enrichment", "targeted", {
            seedRows: seedRows.length,
            parentRows: parentRows.length,
            scientificFallbackNames: scientificNamesNeedingFallback.length,
            catalogRows: numberedRows.length,
            indexedProfiles: indexedProfiles.length,
            totalMs: Math.round(totalMs)
        });
    }

    return {
        animalDexNumbers: animalDexNumberIndexFromRows(indexedProfiles, numberedRows),
        behaviorPrinciples: buildBehaviorPrincipleIndex(numberedRows)
    };
}

const SINGLE_SPECIES_CATALOG_SELECT = [
    "species_profile_id", "animaldex_number", "display_name", "animal_name", "refined_identity",
    "normalized_identity_key", "scientific_name", "identity_kind",
    "landing_page_slug", "created_at", "updated_at"
].join(",");

const SINGLE_SPECIES_GUIDE_SELECT = [
    "species_profile_id", "species_spotlight", "species_subtitle_story", "signature_traits",
    "interesting_facts", "typical_habitat", "diet_summary", "predators_summary",
    "sleep_pattern", "lifespan_estimate", "female_offspring_notes", "sex_difference_notes",
    "field_guide_version", "updated_at"
].join(",");

async function fetchSingleSpeciesFromCatalog(slug: string): Promise<SpeciesEntry | null> {
    const normalized = slug.trim().toLowerCase();
    const identity = normalized.replace(/-/g, "_");
    const url = getSupabaseUrl();
    const key = getSupabaseServerReadKey();
    if (!url || !key) return null;

    const orFilter = `landing_page_slug.eq.${postgrestEqValue(normalized)},normalized_identity_key.eq.${postgrestEqValue(identity)}`;
    const catalogParams = new URLSearchParams({
        select: SINGLE_SPECIES_CATALOG_SELECT,
        or: `(${orFilter})`,
        limit: "2",
        order: "animaldex_number.asc"
    });

    try {
        const catalogResponse = await fetch(`${url}/rest/v1/species_catalog_v1?${catalogParams}`, {
            headers: getSupabaseHeaders(key),
            next: {revalidate: 3600}
        });
        if (!catalogResponse.ok) return null;
        const catalogRows = await catalogResponse.json() as CatalogRow[];
        if (!catalogRows.length) return null;

        const row = catalogRows.find((r) => {
            const rowSlug = databaseSpeciesCanonicalSlug({
                landing_page_slug: r.landing_page_slug,
                normalized_identity_key: r.normalized_identity_key,
                animaldex_number: r.animaldex_number
            });
            if (rowSlug === normalized) return true;
            return stripCatalogNumberSuffix(rowSlug, r.animaldex_number) === normalized;
        }) ?? catalogRows[0];

        const guideResponse = await fetch(
            `${url}/rest/v1/species_field_guide?species_profile_id=eq.${postgrestEqValue(row.species_profile_id)}&select=${SINGLE_SPECIES_GUIDE_SELECT}&limit=1`,
            {headers: getSupabaseHeaders(key), next: {revalidate: 3600}}
        );
        const guideRows = guideResponse.ok ? await guideResponse.json() as FieldGuideRow[] : [];
        const guide = guideRows[0] ?? null;

        const profileResponse = await fetch(
            `${url}/rest/v1/species_profiles?id=eq.${postgrestEqValue(row.species_profile_id)}&select=id,animaldex_number,catalog_status&limit=1`,
            {headers: getSupabaseHeaders(key), next: {revalidate: 3600}}
        );
        const profileRows = profileResponse.ok ? await profileResponse.json() as IndexedProfileRow[] : [];
        const profile = profileRows[0];
        const animalDexNumber = profile?.catalog_status !== "hidden" && typeof profile?.animaldex_number === "number"
            ? profile.animaldex_number
            : row.animaldex_number;

        return mapDatabaseSpecies(
            {...row, animaldex_number: animalDexNumber},
            guide
        );
    } catch {
        return null;
    }
}

export async function getDatabaseSpeciesBySlug(slug: string) {
    const normalized = slug.trim().toLowerCase();
    const identity = normalized.replace(/-/g, "_");

    const cached = readCatalogCache();
    if (cached) {
        return cached.entries.find((entry) => {
            if (entry.slug === normalized || entry.normalizedIdentityKey === identity) {
                return true;
            }
            const catalogNumber = entry.databaseSource?.animalDexNumber;
            return catalogNumber
                ? stripCatalogNumberSuffix(entry.slug, catalogNumber) === normalized
                : false;
        }) ?? null;
    }

    const directResult = await fetchSingleSpeciesFromCatalog(slug);
    if (directResult) return directResult;

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

export type SitemapSpeciesEntry = {
    slug: string;
    updatedAt: string;
};

const SITEMAP_CATALOG_SELECT = [
    "species_profile_id", "landing_page_slug", "normalized_identity_key",
    "animaldex_number", "updated_at"
].join(",");

async function loadSitemapDatabaseSpecies(): Promise<SitemapSpeciesEntry[]> {
    const [indexedProfileRows, catalogRows] = await Promise.all([
        fetchRows<IndexedProfileRow>("species_profiles", INDEXED_PROFILE_SELECT, {animaldex_number: "not.is.null", order: "animaldex_number.asc"}),
        fetchRows<Pick<CatalogRow, "species_profile_id" | "landing_page_slug" | "normalized_identity_key" | "animaldex_number" | "updated_at">>(
            "species_catalog_v1",
            SITEMAP_CATALOG_SELECT,
            {animaldex_number: "not.is.null", order: "animaldex_number.asc"}
        )
    ]);
    const indexedNumbers = new Map(
        indexedProfileRows
            .filter((row) => row.catalog_status !== "hidden")
            .map((row) => [row.id, row.animaldex_number])
    );
    const bySlug = new Map<string, SitemapSpeciesEntry>();

    for (const row of catalogRows) {
        if (isNonCanonicalLifeStageCatalogIdentity(row.normalized_identity_key)) {
            continue;
        }

        const animalDexNumber = indexedNumbers.get(row.species_profile_id);
        if (animalDexNumber === undefined) continue;

        const slug = databaseSpeciesCanonicalSlug({...row, animaldex_number: animalDexNumber});
        if (!slug || bySlug.has(slug)) continue;

        bySlug.set(slug, {
            slug,
            updatedAt: clean(row.updated_at) ?? new Date(0).toISOString()
        });
    }

    return Array.from(bySlug.values());
}

/** Slug + updatedAt only — avoids field-guide hydration used by full catalog pages. */
export async function getSitemapSpeciesEntries(): Promise<SitemapSpeciesEntry[]> {
    try {
        const databaseEntries = await loadSitemapDatabaseSpecies();
        const databaseBySlug = new Map(databaseEntries.map((entry) => [entry.slug, entry]));
        const staticSlugs = new Set(speciesEntries.map((entry) => entry.slug));
        const biologyAnchorSlugs = getBiologyAnchorSlugsToExclude();
        const fromStatic = speciesEntries
            .filter((entry) => !biologyAnchorSlugs.has(entry.slug))
            .map((entry) => ({
                slug: entry.slug,
                updatedAt: databaseBySlug.get(entry.slug)?.updatedAt ?? entry.updatedAt
            }));
        const fromDatabase = databaseEntries.filter((entry) => !staticSlugs.has(entry.slug) && !biologyAnchorSlugs.has(entry.slug));
        const bySlug = new Map<string, SitemapSpeciesEntry>();

        for (const entry of [...fromStatic, ...fromDatabase]) {
            if (!bySlug.has(entry.slug)) {
                bySlug.set(entry.slug, entry);
            }
        }

        return Array.from(bySlug.values());
    } catch (error) {
        console.error("Unable to load sitemap species entries. Falling back to static species entries.", error);
        return speciesEntries.map((entry) => ({slug: entry.slug, updatedAt: entry.updatedAt}));
    }
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
