import "server-only";

import type {
    ChallengeComparisonType,
    ChallengeEntry,
    ChallengeFAQ,
    ChallengeScenario,
    ChallengeStatCategory
} from "@/data/challenges";
import {getChallenge as getStaticChallenge, isChallengeComparisonType} from "@/data/challenges";
import type {SystemsIntelligenceEntry} from "@/data/content-schema";
import type {SpeciesEntry} from "@/data/species";
import {
    getSupabaseHeaders,
    getSupabasePublicKey,
    getSupabaseServerReadKey,
    getSupabaseUrl
} from "@/lib/supabase-http";

const CHALLENGE_IMAGE_BASE_URL = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals";
const COMPARISON_TYPES: ChallengeComparisonType[] = [
    "battle",
    "speed",
    "strength",
    "intelligence",
    "stealth",
    "durability",
    "agility"
];

type SpeciesComparisonRow = {
    id: string;
    slug: string;
    pair_key: string;
    animal_a_slug: string;
    animal_b_slug: string;
    animal_a_display_name: string;
    animal_b_display_name: string;
    comparison_type: string;
    title: string;
    description: string;
    quick_verdict: string;
    short_answer: unknown;
    why_people_disagree: unknown;
    stat_categories: unknown;
    scenario_breakdown: unknown;
    final_take: unknown;
    faq: unknown;
    search_intents: unknown;
    related_slugs?: unknown;
    systems_intelligence?: unknown;
    winner_side: "animalA" | "animalB";
    winner_display_name: string;
    confidence_percent: number;
    featured_image_url: string | null;
    published_at: string;
    updated_at: string;
};

type SpeciesComparisonFeedRow = {
    id: string;
    slug: string;
    animal_a_slug: string;
    animal_b_slug: string;
    animal_a_display_name: string;
    animal_b_display_name: string;
    comparison_type: string;
    title: string;
    description: string;
    quick_verdict: string;
    winner_side: "animalA" | "animalB";
    winner_display_name: string;
    confidence_percent: number;
    featured_image_url: string | null;
    published_at: string;
    updated_at?: string;
};

function getReadConfig() {
    const supabaseUrl = getSupabaseUrl();
    const key = getSupabaseServerReadKey();
    if (!supabaseUrl || !key) return null;
    return {supabaseUrl, key};
}

function asStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean);
}

function asStatCategories(value: unknown): ChallengeStatCategory[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((row) => {
        if (!row || typeof row !== "object") return [];
        const item = row as Record<string, unknown>;
        const advantageRaw = String(item.advantage ?? "even");
        const advantage =
            advantageRaw === "animalA" || advantageRaw === "animalB" || advantageRaw === "even" || advantageRaw === "depends"
                ? advantageRaw
                : "even";
        return [
            {
                key: String(item.key ?? item.label ?? "trait"),
                label: String(item.label ?? "Trait"),
                animalAValue: String(item.animalAValue ?? item.animal_a_value ?? "—"),
                animalBValue: String(item.animalBValue ?? item.animal_b_value ?? "—"),
                advantage,
                takeaway: String(item.takeaway ?? "")
            }
        ];
    });
}

function asScenarios(value: unknown): ChallengeScenario[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((row) => {
        if (!row || typeof row !== "object") return [];
        const item = row as Record<string, unknown>;
        const winnerRaw = String(item.winner ?? "depends");
        const winner =
            winnerRaw === "animalA" || winnerRaw === "animalB" || winnerRaw === "draw" || winnerRaw === "depends"
                ? winnerRaw
                : "depends";
        return [
            {
                slug: String(item.slug ?? item.title ?? "scenario"),
                title: String(item.title ?? "Scenario"),
                winner,
                verdict: String(item.verdict ?? ""),
                explanation: String(item.explanation ?? "")
            }
        ];
    });
}

function asFaq(value: unknown): ChallengeFAQ[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((row) => {
        if (!row || typeof row !== "object") return [];
        const item = row as Record<string, unknown>;
        const question = String(item.question ?? "").trim();
        const answer = String(item.answer ?? "").trim();
        if (!question || !answer) return [];
        return [{question, answer}];
    });
}

function asSystemsIntelligence(
    value: unknown
): Array<{slug: string; entry: SystemsIntelligenceEntry}> {
    if (!Array.isArray(value)) return [];
    return value.flatMap((row) => {
        if (!row || typeof row !== "object") return [];
        const item = row as Record<string, unknown>;
        const slug = String(item.slug ?? "").trim();
        const roleTitle = String(item.roleTitle ?? item.role_title ?? "").trim();
        const specializedHardware = String(item.specializedHardware ?? item.specialized_hardware ?? "").trim();
        const systemsScript = String(item.systemsScript ?? item.systems_script ?? "").trim();
        const strategicInsight = String(item.strategicInsight ?? item.strategic_insight ?? "").trim();
        if (!slug || !roleTitle || !specializedHardware || !systemsScript || !strategicInsight) {
            return [];
        }
        return [{
            slug,
            entry: {roleTitle, specializedHardware, systemsScript, strategicInsight}
        }];
    });
}

function featuredImageForSlug(slug: string, comparisonType: ChallengeComparisonType, featuredImageURL?: string | null) {
    if (featuredImageURL) {
        return {
            src: featuredImageURL,
            alt: `${slug} comparison image on AnimalDex`,
            width: 1672,
            height: 941,
            caption: "Comparison image source: AnimalDex CDN."
        };
    }

    const comparisonTypeSuffix = `-${comparisonType}`;
    const imageSlug = slug.endsWith(comparisonTypeSuffix)
        ? slug.slice(0, -comparisonTypeSuffix.length)
        : slug;

    return {
        src: `${CHALLENGE_IMAGE_BASE_URL}/${imageSlug}.webp`,
        alt: `${slug} comparison image on AnimalDex`,
        width: 1672,
        height: 941,
        caption: "Comparison image source: AnimalDex CDN."
    };
}

export function mapSpeciesComparisonRowToChallengeEntry(row: SpeciesComparisonRow): ChallengeEntry {
    const comparisonType = isChallengeComparisonType(row.comparison_type) ? row.comparison_type : "battle";
    const relatedSlugs = asStringArray(row.related_slugs);

    return {
        slug: row.slug,
        animalASlug: row.animal_a_slug,
        animalBSlug: row.animal_b_slug,
        animalADisplayName: row.animal_a_display_name,
        animalBDisplayName: row.animal_b_display_name,
        comparisonType,
        title: row.title,
        description: row.description,
        quickVerdict: row.quick_verdict,
        shortAnswer: asStringArray(row.short_answer),
        whyThisMatchupIsInteresting: asStringArray(row.why_people_disagree),
        statCategories: asStatCategories(row.stat_categories),
        scenarioBreakdown: asScenarios(row.scenario_breakdown),
        finalTake: asStringArray(row.final_take),
        faq: asFaq(row.faq),
        searchIntents: asStringArray(row.search_intents),
        speciesSlugs: [row.animal_a_slug, row.animal_b_slug],
        systemsSpeciesSlugs: [row.animal_a_slug, row.animal_b_slug],
        relatedChallengeSlugs: relatedSlugs.length ? relatedSlugs : undefined,
        systemsIntelligenceEntries: asSystemsIntelligence(row.systems_intelligence),
        publishedAt: row.published_at,
        updatedAt: row.updated_at || row.published_at,
        featuredImage: featuredImageForSlug(row.slug, comparisonType, row.featured_image_url)
    };
}

function mapFeedRowToChallengeEntry(row: SpeciesComparisonFeedRow): ChallengeEntry {
    const comparisonType = isChallengeComparisonType(row.comparison_type) ? row.comparison_type : "battle";
    return {
        slug: row.slug,
        animalASlug: row.animal_a_slug,
        animalBSlug: row.animal_b_slug,
        animalADisplayName: row.animal_a_display_name,
        animalBDisplayName: row.animal_b_display_name,
        comparisonType,
        title: row.title,
        description: row.description,
        quickVerdict: row.quick_verdict,
        shortAnswer: [row.quick_verdict],
        whyThisMatchupIsInteresting: [row.description],
        statCategories: [],
        scenarioBreakdown: [],
        finalTake: [`${row.winner_display_name} takes the clear edge at ${row.confidence_percent}% confidence.`],
        faq: [],
        searchIntents: [
            `${row.animal_a_display_name} vs ${row.animal_b_display_name} who wins`.toLowerCase(),
            `who would win ${row.animal_a_display_name} or ${row.animal_b_display_name}`.toLowerCase()
        ],
        speciesSlugs: [row.animal_a_slug, row.animal_b_slug],
        systemsSpeciesSlugs: [row.animal_a_slug, row.animal_b_slug],
        publishedAt: row.published_at,
        updatedAt: row.updated_at || row.published_at,
        featuredImage: featuredImageForSlug(row.slug, comparisonType, row.featured_image_url)
    };
}

export function parseComparisonSlug(slug: string): {
    animalASlug: string;
    animalBSlug: string;
    comparisonType: ChallengeComparisonType;
} | null {
    const normalized = slug.trim().toLowerCase();
    if (!normalized.includes("-vs-")) return null;

    for (const type of COMPARISON_TYPES) {
        if (type === "battle") continue;
        const suffix = `-${type}`;
        if (normalized.endsWith(suffix)) {
            const base = normalized.slice(0, -suffix.length);
            const [animalASlug, animalBSlug] = base.split("-vs-");
            if (!animalASlug || !animalBSlug) return null;
            return {animalASlug, animalBSlug, comparisonType: type};
        }
    }

    const [animalASlug, animalBSlug] = normalized.split("-vs-");
    if (!animalASlug || !animalBSlug) return null;
    return {animalASlug, animalBSlug, comparisonType: "battle"};
}

export async function fetchSpeciesComparisonBySlug(slug: string): Promise<ChallengeEntry | null> {
    const config = getReadConfig();
    if (!config) return null;

    const url = new URL(`${config.supabaseUrl}/rest/v1/species_comparisons`);
    url.searchParams.set("select", "*");
    url.searchParams.set("slug", `eq.${slug}`);
    url.searchParams.set("generation_status", "eq.ready");
    url.searchParams.set("limit", "1");

    const response = await fetch(url, {
        headers: getSupabaseHeaders(config.key),
        next: {revalidate: 300}
    });
    if (!response.ok) return null;
    const rows = (await response.json()) as SpeciesComparisonRow[];
    const row = rows[0];
    return row ? mapSpeciesComparisonRowToChallengeEntry(row) : null;
}

const FEED_PAGE_SIZE = 100;
const FEED_HARD_CAP = 2000;

export type SpeciesComparisonSummary = {
    id: string;
    slug: string;
    animalASlug: string;
    animalBSlug: string;
    animalADisplayName: string;
    animalBDisplayName: string;
    comparisonType: ChallengeComparisonType;
    title: string;
    description: string;
    quickVerdict: string;
    winnerSide: "animalA" | "animalB";
    winnerDisplayName: string;
    confidencePercent: number;
    featuredImageUrl: string | null;
    publishedAt: string;
};

function mapFeedRowToSummary(row: SpeciesComparisonFeedRow): SpeciesComparisonSummary {
    const comparisonType = isChallengeComparisonType(row.comparison_type) ? row.comparison_type : "battle";
    return {
        id: row.id,
        slug: row.slug,
        animalASlug: row.animal_a_slug,
        animalBSlug: row.animal_b_slug,
        animalADisplayName: row.animal_a_display_name,
        animalBDisplayName: row.animal_b_display_name,
        comparisonType,
        title: row.title,
        description: row.description,
        quickVerdict: row.quick_verdict,
        winnerSide: row.winner_side,
        winnerDisplayName: row.winner_display_name,
        confidencePercent: row.confidence_percent,
        featuredImageUrl: row.featured_image_url,
        publishedAt: row.published_at
    };
}

export async function fetchSpeciesComparisonSummaries(limit = 12): Promise<SpeciesComparisonSummary[]> {
    const config = getReadConfig();
    if (!config) return [];

    const capped = Math.max(1, Math.min(24, limit));
    const url = new URL(`${config.supabaseUrl}/rest/v1/species_comparisons_feed_v1`);
    url.searchParams.set("select", "*");
    url.searchParams.set("order", "published_at.desc");
    url.searchParams.set("limit", String(capped));

    const response = await fetch(url, {
        headers: getSupabaseHeaders(config.key),
        next: {revalidate: 180}
    });
    if (!response.ok) return [];
    const rows = (await response.json()) as SpeciesComparisonFeedRow[];
    return rows.map(mapFeedRowToSummary);
}

export async function fetchRecentSpeciesComparisons(limit = 24): Promise<ChallengeEntry[]> {
    const config = getReadConfig();
    if (!config) return [];

    const capped = Math.max(1, Math.min(FEED_HARD_CAP, limit));
    const url = new URL(`${config.supabaseUrl}/rest/v1/species_comparisons_feed_v1`);
    url.searchParams.set("select", "*");
    url.searchParams.set("order", "published_at.desc");
    url.searchParams.set("limit", String(capped));

    const response = await fetch(url, {
        headers: getSupabaseHeaders(config.key),
        next: {revalidate: 180}
    });
    if (!response.ok) return [];
    const rows = (await response.json()) as SpeciesComparisonFeedRow[];
    return rows.map(mapFeedRowToChallengeEntry);
}

/**
 * Pages through the public feed view so every ready AI comparison can appear
 * in the website directory / sitemap (not just the newest N).
 */
export async function fetchAllSpeciesComparisons(): Promise<ChallengeEntry[]> {
    const config = getReadConfig();
    if (!config) return [];

    const collected: ChallengeEntry[] = [];
    let offset = 0;

    while (offset < FEED_HARD_CAP) {
        const url = new URL(`${config.supabaseUrl}/rest/v1/species_comparisons_feed_v1`);
        url.searchParams.set("select", "*");
        url.searchParams.set("order", "published_at.desc");
        url.searchParams.set("limit", String(FEED_PAGE_SIZE));
        url.searchParams.set("offset", String(offset));

        const response = await fetch(url, {
            headers: getSupabaseHeaders(config.key),
            next: {revalidate: 180}
        });
        if (!response.ok) break;

        const rows = (await response.json()) as SpeciesComparisonFeedRow[];
        if (!rows.length) break;
        collected.push(...rows.map(mapFeedRowToChallengeEntry));
        if (rows.length < FEED_PAGE_SIZE) break;
        offset += FEED_PAGE_SIZE;
    }

    return collected;
}

export async function fetchSpeciesComparisonsForAnimal(
    speciesSlug: string,
    limit = 8
): Promise<ChallengeEntry[]> {
    const config = getReadConfig();
    if (!config) return [];

    const normalized = speciesSlug.trim().toLowerCase();
    if (!normalized) return [];

    const url = new URL(`${config.supabaseUrl}/rest/v1/species_comparisons_feed_v1`);
    url.searchParams.set("select", "*");
    url.searchParams.set(
        "or",
        `(animal_a_slug.eq.${normalized},animal_b_slug.eq.${normalized})`
    );
    url.searchParams.set("order", "published_at.desc");
    url.searchParams.set("limit", String(Math.max(1, Math.min(50, limit))));

    const response = await fetch(url, {
        headers: getSupabaseHeaders(config.key),
        next: {revalidate: 180}
    });
    if (!response.ok) return [];
    const rows = (await response.json()) as SpeciesComparisonFeedRow[];
    return rows.map(mapFeedRowToChallengeEntry);
}

function isGeneratedVsFeaturedImage(src: string | null | undefined): boolean {
    if (!src) return false;
    return src.includes("/storage/v1/object/public/animals/comparisons/");
}

export async function getOrGenerateSpeciesComparison(params: {
    animalASlug: string;
    animalBSlug: string;
    comparisonType?: ChallengeComparisonType;
    forceRegenerateImage?: boolean;
}): Promise<ChallengeEntry | null> {
    const supabaseUrl = getSupabaseUrl();
    // Generation requires a user JWT or service role; prefer service key on the server.
    const apiKey = getSupabaseServerReadKey() ?? getSupabasePublicKey();
    if (!supabaseUrl || !apiKey) return null;

    const response = await fetch(`${supabaseUrl}/functions/v1/get-or-generate-species-comparison`, {
        method: "POST",
        headers: {
            ...getSupabaseHeaders(apiKey),
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            animal_a_slug: params.animalASlug,
            animal_b_slug: params.animalBSlug,
            comparison_type: params.comparisonType ?? "battle",
            force_regenerate: false,
            force_regenerate_image: params.forceRegenerateImage === true
        }),
        cache: "no-store"
    });

    if (!response.ok) return null;
    const payload = (await response.json()) as {comparison?: SpeciesComparisonRow};
    return payload.comparison ? mapSpeciesComparisonRowToChallengeEntry(payload.comparison) : null;
}

/**
 * Resolve a comparison page:
 * 1) static editorial (keeps existing SEO pages stable)
 * 2) DB ready row
 * 3) AI generate-on-miss for parseable `a-vs-b` slugs
 */
export async function resolveChallengeEntry(slug: string): Promise<ChallengeEntry | null> {
    const staticEntry = getStaticChallenge(slug);
    if (staticEntry) return staticEntry;

    const fromDb = await fetchSpeciesComparisonBySlug(slug);
    if (fromDb) {
        // AI rows created before VS-hero generation still point at placeholder artwork.
        // Ask the edge function to backfill a cinematic comparisons/{slug}.webp once.
        if (!isGeneratedVsFeaturedImage(fromDb.featuredImage?.src)) {
            const parsed = parseComparisonSlug(slug);
            if (parsed) {
                const withImage = await getOrGenerateSpeciesComparison({
                    ...parsed,
                    forceRegenerateImage: true
                });
                if (withImage) return withImage;
            }
        }
        return fromDb;
    }

    const parsed = parseComparisonSlug(slug);
    if (!parsed) return null;

    return getOrGenerateSpeciesComparison(parsed);
}

export async function listMergedChallengeEntries(limit = FEED_HARD_CAP): Promise<ChallengeEntry[]> {
    const {challengeEntries} = await import("@/data/challenges");
    const dbEntries = limit >= FEED_HARD_CAP
        ? await fetchAllSpeciesComparisons()
        : await fetchRecentSpeciesComparisons(limit);
    const bySlug = new Map<string, ChallengeEntry>();

    for (const entry of challengeEntries) {
        bySlug.set(entry.slug, entry);
    }
    for (const entry of dbEntries) {
        if (!bySlug.has(entry.slug)) {
            bySlug.set(entry.slug, entry);
        }
    }

    return Array.from(bySlug.values());
}

function scoreRelatedChallenge(current: ChallengeEntry, candidate: ChallengeEntry) {
    const sharedSpecies = candidate.speciesSlugs.filter((speciesSlug) =>
        current.speciesSlugs.includes(speciesSlug)
    ).length;
    const sameComparisonType = candidate.comparisonType === current.comparisonType ? 1 : 0;
    const sharedSystemsSpecies = (candidate.systemsSpeciesSlugs || [])
        .filter((speciesSlug) =>
            (current.systemsSpeciesSlugs || current.speciesSlugs).includes(speciesSlug)
        ).length;

    return sharedSpecies * 4 + sameComparisonType * 2 + sharedSystemsSpecies;
}

/** Related matchups across static + generated comparisons. */
export async function getRelatedMergedChallenges(slug: string, limit = 4): Promise<ChallengeEntry[]> {
    const allEntries = await listMergedChallengeEntries();
    const current = allEntries.find((entry) => entry.slug === slug);
    if (!current) return [];

    const explicit: ChallengeEntry[] = [];
    for (const relatedSlug of current.relatedChallengeSlugs || []) {
        const hit = allEntries.find((entry) => entry.slug === relatedSlug)
            ?? await fetchSpeciesComparisonBySlug(relatedSlug);
        if (hit) explicit.push(hit);
    }
    const explicitSlugs = new Set(explicit.map((entry) => entry.slug));

    const scored = allEntries
        .filter((entry) => entry.slug !== slug && !explicitSlugs.has(entry.slug))
        .map((entry) => ({entry, score: scoreRelatedChallenge(current, entry)}))
        .filter((item) => item.score > 0)
        .sort((left, right) =>
            right.score - left.score
            || (right.entry.updatedAt || right.entry.publishedAt).localeCompare(
                left.entry.updatedAt || left.entry.publishedAt
            )
            || left.entry.title.localeCompare(right.entry.title)
        )
        .map((item) => item.entry);

    return [...explicit, ...scored].slice(0, limit);
}

/** Static + generated comparisons that feature a given species. */
export async function getMergedChallengesForSpecies(
    speciesSlug: string,
    limit = 4
): Promise<ChallengeEntry[]> {
    const {getChallengesForSpecies} = await import("@/data/challenges");
    const staticEntries = getChallengesForSpecies(speciesSlug, limit + 4);
    const dbEntries = await fetchSpeciesComparisonsForAnimal(speciesSlug, limit + 4).catch(() => [] as ChallengeEntry[]);
    const bySlug = new Map<string, ChallengeEntry>();

    for (const entry of staticEntries) bySlug.set(entry.slug, entry);
    for (const entry of dbEntries) {
        if (!bySlug.has(entry.slug)) bySlug.set(entry.slug, entry);
    }

    return Array.from(bySlug.values())
        .sort((left, right) =>
            (right.updatedAt || right.publishedAt).localeCompare(left.updatedAt || left.publishedAt)
            || left.title.localeCompare(right.title)
        )
        .slice(0, limit);
}

export function animalOptionsFromChallengeEntries(entries: ChallengeEntry[]) {
    return Array.from(
        new Map(
            entries.flatMap((entry) => entry.speciesSlugs).map((speciesSlug) => [speciesSlug, speciesSlug])
        ).keys()
    ).sort((left, right) => left.localeCompare(right));
}

function titleCaseFromSlug(slug: string) {
    return slug
        .split("-")
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

/**
 * Minimal species card used when a generated comparison references a slug that
 * is not yet in the website catalog (e.g. broad `spider`).
 */
export function buildComparisonSpeciesFallback(
    slug: string,
    displayName?: string | null
): SpeciesEntry {
    const name = displayName?.trim() || titleCaseFromSlug(slug);
    return {
        slug,
        name,
        normalizedIdentityKey: slug.replace(/-/g, "_"),
        heroTitle: `${name} — Identification, Habitat, Rarity & Facts`,
        publishedAt: "2026-07-26",
        updatedAt: "2026-07-26",
        featuredImage: {
            src: "/images/og.png",
            alt: `${name} on AnimalDex`,
            width: 1200,
            height: 630
        },
        searchIntents: [`${name.toLowerCase()} facts`],
        analysis: {
            summary: `${name} appears in this AnimalDex comparison from generated matchup data.`,
            scientificName: "—",
            category: "Animal",
            identification: [`Recognized in this matchup as ${name}.`],
            habitat: "Habitat details are not published on a dedicated AnimalDex species page yet.",
            nativeRange: "—",
            rarityScore: 40,
            rarityReason: "Catalog metadata for this identity is still catching up to the comparison generator."
        },
        premiumDetails: {
            behaviorTraits: [],
            whyInteresting: [],
            respectfulSpotting: [],
            lookalikes: []
        },
        relatedSpecies: []
    };
}
