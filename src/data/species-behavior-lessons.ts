import {getSpeciesBySlug, speciesEntries} from "@/data/species";
import {
    BehavioralPrincipleProfile,
    getBehavioralPrincipleProfile
} from "@/data/species-behavioral-principles";
import {getSystemsIntelligenceBySpeciesSlug, speciesSystemsIntelligence} from "@/data/species-systems-intelligence";
import {getSupabaseHeaders, getSupabaseServerReadKey, getSupabaseUrl} from "@/lib/supabase-http";

const BEHAVIOR_LESSONS_REVALIDATE_SECONDS = 3600;

export type SpeciesBehaviorLesson = {
    slug: string;
    displayName: string;
    normalizedIdentityKey: string;
    principleName: string;
    principleExpression: string | null;
    coreLesson: string;
    biologicalBasis: string;
    shortMotto: string;
    bestUseCases: string[];
};

export type ResolvedSpeciesBehaviorProfile = BehavioralPrincipleProfile & {
    hasCatalogLesson: boolean;
    clusterPrinciple: string | null;
    clusterPrincipleSlug: string | null;
};

function toPrincipleSlug(principle: string) {
    return principle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function getClusterProfile(localProfile: BehavioralPrincipleProfile | null) {
    if (!localProfile) {
        return {clusterPrinciple: null, clusterPrincipleSlug: null};
    }

    return {
        clusterPrinciple: localProfile.browseCluster,
        clusterPrincipleSlug: localProfile.browseClusterSlug
    };
}

type SpeciesCatalogLessonRow = {
    landing_page_slug?: string | null;
    display_name?: string | null;
    normalized_identity_key?: string | null;
    principle_name?: string | null;
    principle_expression?: string | null;
    core_lesson?: string | null;
    biological_basis?: string | null;
    short_motto?: string | null;
    best_use_cases?: unknown;
};

const websiteSlugs = new Set(speciesEntries.map((entry) => entry.slug));

function parseBestUseCases(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function normalizeLessonRow(row: SpeciesCatalogLessonRow): SpeciesBehaviorLesson | null {
    const slug = row.landing_page_slug?.trim();

    if (!slug || !websiteSlugs.has(slug) || !row.core_lesson?.trim() || !row.principle_name?.trim()) {
        return null;
    }

    const speciesEntry = getSpeciesBySlug(slug);

    return {
        slug,
        displayName: speciesEntry?.name ?? row.display_name?.trim() ?? slug,
        normalizedIdentityKey: row.normalized_identity_key?.trim() ?? slug.replace(/-/g, "_"),
        principleName: row.principle_name.trim(),
        principleExpression: row.principle_expression?.trim() || null,
        coreLesson: row.core_lesson.trim(),
        biologicalBasis: row.biological_basis?.trim() ?? "",
        shortMotto: row.short_motto?.trim() ?? "",
        bestUseCases: parseBestUseCases(row.best_use_cases)
    };
}

function getSupabaseConfig() {
    const supabaseUrl = getSupabaseUrl();
    const readKey = getSupabaseServerReadKey();

    if (!supabaseUrl || !readKey) {
        return null;
    }

    return {supabaseUrl, headers: getSupabaseHeaders(readKey)};
}

async function fetchBehaviorLessonsFromSupabase(): Promise<SpeciesBehaviorLesson[]> {
    const config = getSupabaseConfig();

    if (!config) {
        return [];
    }

    const rows: SpeciesCatalogLessonRow[] = [];
    let offset = 0;

    while (true) {
        const searchParams = new URLSearchParams({
            select: "landing_page_slug,display_name,normalized_identity_key,principle_name,principle_expression,core_lesson,biological_basis,short_motto,best_use_cases",
            core_lesson: "not.is.null",
            principle_name: "not.is.null",
            landing_page_slug: "not.is.null",
            order: "display_name.asc",
            limit: "1000",
            offset: String(offset)
        });

        const response = await fetch(`${config.supabaseUrl}/rest/v1/species_catalog_v1?${searchParams.toString()}`, {
            headers: config.headers,
            next: {revalidate: BEHAVIOR_LESSONS_REVALIDATE_SECONDS}
        });

        if (!response.ok) {
            throw new Error(`Supabase behavior lesson fetch failed with status ${response.status}`);
        }

        const batch = await response.json() as SpeciesCatalogLessonRow[];

        if (!Array.isArray(batch) || batch.length === 0) {
            break;
        }

        rows.push(...batch);

        if (batch.length < 1000) {
            break;
        }

        offset += 1000;
    }

    return rows
        .map(normalizeLessonRow)
        .filter((lesson): lesson is SpeciesBehaviorLesson => Boolean(lesson))
        .sort((left, right) => left.displayName.localeCompare(right.displayName));
}

let behaviorLessonIndexPromise: Promise<SpeciesBehaviorLesson[]> | null = null;

export async function getBehaviorLessonIndex(): Promise<SpeciesBehaviorLesson[]> {
    if (!behaviorLessonIndexPromise) {
        behaviorLessonIndexPromise = fetchBehaviorLessonsFromSupabase().catch(() => []);
    }

    return behaviorLessonIndexPromise;
}

export async function getBehaviorLessonBySlug(slug: string): Promise<SpeciesBehaviorLesson | null> {
    const config = getSupabaseConfig();

    if (!config || !websiteSlugs.has(slug)) {
        return null;
    }

    const searchParams = new URLSearchParams({
        select: "landing_page_slug,display_name,normalized_identity_key,principle_name,principle_expression,core_lesson,biological_basis,short_motto,best_use_cases",
        landing_page_slug: `eq.${slug}`,
        core_lesson: "not.is.null",
        limit: "1"
    });

    try {
        const response = await fetch(`${config.supabaseUrl}/rest/v1/species_catalog_v1?${searchParams.toString()}`, {
            headers: config.headers,
            next: {revalidate: BEHAVIOR_LESSONS_REVALIDATE_SECONDS}
        });

        if (!response.ok) {
            return null;
        }

        const [row] = await response.json() as SpeciesCatalogLessonRow[];
        return row ? normalizeLessonRow(row) : null;
    } catch {
        return null;
    }
}

export async function getRelatedBehaviorLessons(slug: string, limit = 3): Promise<SpeciesBehaviorLesson[]> {
    const current = await getBehaviorLessonBySlug(slug);

    if (!current) {
        return [];
    }

    const index = await getBehaviorLessonIndex();

    return index
        .filter((lesson) => lesson.slug !== slug && lesson.principleName === current.principleName)
        .slice(0, limit);
}

export async function resolveSpeciesBehaviorProfile(slug: string): Promise<ResolvedSpeciesBehaviorProfile | null> {
    const systemsEntry = getSystemsIntelligenceBySpeciesSlug(slug);
    const localProfile = getBehavioralPrincipleProfile(slug, systemsEntry, speciesSystemsIntelligence);
    const catalogLesson = await getBehaviorLessonBySlug(slug);
    const clusterProfile = getClusterProfile(localProfile);

    if (catalogLesson) {
        const relatedLessons = await getRelatedBehaviorLessons(slug, 4);
        const relatedSpeciesSlugs = relatedLessons.length > 0
            ? relatedLessons.map((lesson) => lesson.slug)
            : (localProfile?.relatedSpeciesSlugs ?? []);

        return {
            principle: catalogLesson.principleName,
            principleSlug: toPrincipleSlug(catalogLesson.principleName),
            browseCluster: localProfile?.browseCluster ?? clusterProfile.clusterPrinciple ?? catalogLesson.principleName,
            browseClusterSlug: localProfile?.browseClusterSlug ?? clusterProfile.clusterPrincipleSlug ?? toPrincipleSlug(catalogLesson.principleName),
            motto: catalogLesson.shortMotto || localProfile?.motto || catalogLesson.coreLesson,
            coreLesson: catalogLesson.coreLesson,
            biologicalBasis: catalogLesson.biologicalBasis || localProfile?.biologicalBasis || "",
            bestFor: catalogLesson.bestUseCases.length > 0
                ? catalogLesson.bestUseCases
                : (localProfile?.bestFor ?? []),
            relatedSpeciesSlugs,
            source: "catalog_db",
            hasCatalogLesson: true,
            clusterPrinciple: clusterProfile.clusterPrinciple,
            clusterPrincipleSlug: clusterProfile.clusterPrincipleSlug
        };
    }

    if (!localProfile) {
        return null;
    }

    return {
        ...localProfile,
        hasCatalogLesson: false,
        clusterPrinciple: clusterProfile.clusterPrinciple,
        clusterPrincipleSlug: clusterProfile.clusterPrincipleSlug
    };
}
