import {getSpeciesBySlug, speciesEntries, SpeciesEntry} from "@/data/species";
import {
    buildLegendaryBehaviorLessonFromSeed,
    getLegendaryCatalogSeedByBeastSlug,
    getLegendaryCatalogSeedByBiologyLandingSlug
} from "@/data/legendary-earth-beasts-catalog-seed";
import {
    BehavioralPrincipleProfile,
    getBehavioralPrincipleProfile
} from "@/data/species-behavioral-principles";
import {getSystemsIntelligenceBySpeciesSlug, speciesSystemsIntelligence} from "@/data/species-systems-intelligence";
import {buildUsefulApplicationSentence} from "@/data/species-useful-application";
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
    applicationExample: string;
    imageFile: string | null;
    source: "catalog" | "local";
};

export type PrincipleHub = {
    principle: string;
    principleSlug: string;
    speciesCount: number;
    speciesSlugs: string[];
    sampleMotto: string;
    lessons: SpeciesBehaviorLesson[];
    catalogLessonCount: number;
};

export type ResolvedSpeciesBehaviorProfile = BehavioralPrincipleProfile & {
    hasCatalogLesson: boolean;
    hasLessonPage: boolean;
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
    generation_metadata?: unknown;
};

type SpeciesBehaviorPrincipleRow = {
    species_profile_id?: string | null;
    application_example?: string | null;
};

type SpeciesProfileLessonIdentityRow = {
    id?: string | null;
    landing_page_slug?: string | null;
};

const websiteSlugs = new Set(speciesEntries.map((entry) => entry.slug));

function parseBestUseCases(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function parseImageFile(value: unknown): string | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }

    const imageFile = (value as {image_file?: unknown}).image_file;
    return typeof imageFile === "string" && imageFile.trim() ? imageFile.trim() : null;
}

function buildFallbackApplicationExample(slug: string, ...lessonText: Array<string | null | undefined>) {
    return buildUsefulApplicationSentence(slug, lessonText.filter(Boolean).join(" "));
}

function normalizeLessonRow(
    row: SpeciesCatalogLessonRow,
    applicationExamples: ReadonlyMap<string, string> = new Map()
): SpeciesBehaviorLesson | null {
    const slug = row.landing_page_slug?.trim()
        ?? row.normalized_identity_key?.trim().replace(/_/g, "-");

    if (!slug || !row.core_lesson?.trim() || !row.principle_name?.trim()) {
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
        bestUseCases: parseBestUseCases(row.best_use_cases),
        applicationExample: applicationExamples.get(slug) ?? buildFallbackApplicationExample(
            slug,
            row.principle_name,
            row.principle_expression,
            row.core_lesson,
            row.biological_basis,
            row.short_motto
        ),
        imageFile: parseImageFile(row.generation_metadata),
        source: "catalog"
    };
}

function buildLocalBehaviorLesson(entry: SpeciesEntry, profile: BehavioralPrincipleProfile): SpeciesBehaviorLesson {
    return {
        slug: entry.slug,
        displayName: entry.name,
        normalizedIdentityKey: entry.normalizedIdentityKey ?? entry.slug.replace(/-/g, "_"),
        principleName: profile.principle,
        principleExpression: profile.principleExpression ?? null,
        coreLesson: profile.coreLesson,
        biologicalBasis: profile.biologicalBasis,
        shortMotto: profile.motto,
        bestUseCases: profile.bestFor,
        applicationExample: profile.applicationExample ?? buildFallbackApplicationExample(
            entry.slug,
            profile.principle,
            profile.principleExpression,
            profile.coreLesson,
            profile.biologicalBasis,
            profile.motto
        ),
        imageFile: null,
        source: "local"
    };
}

function buildLocalBehaviorLessonsForWebsite(): SpeciesBehaviorLesson[] {
    return speciesEntries
        .map((entry) => {
            const systemsEntry = getSystemsIntelligenceBySpeciesSlug(entry.slug);
            const profile = getBehavioralPrincipleProfile(entry.slug, systemsEntry, speciesSystemsIntelligence);
            return profile ? buildLocalBehaviorLesson(entry, profile) : null;
        })
        .filter((lesson): lesson is SpeciesBehaviorLesson => Boolean(lesson));
}

function mergeCatalogAndLocalLessons(catalogLessons: SpeciesBehaviorLesson[]): SpeciesBehaviorLesson[] {
    const catalogSlugs = new Set(catalogLessons.map((lesson) => lesson.slug));
    const localLessons = buildLocalBehaviorLessonsForWebsite().filter((lesson) => !catalogSlugs.has(lesson.slug));

    return [...catalogLessons, ...localLessons].sort((left, right) => left.displayName.localeCompare(right.displayName));
}

function buildLegendarySeedBehaviorLesson(seed: ReturnType<typeof getLegendaryCatalogSeedByBeastSlug>) {
    if (!seed) return null;

    const lesson = buildLegendaryBehaviorLessonFromSeed(seed);

    return {
        slug: seed.beastSlug,
        displayName: seed.displayName,
        normalizedIdentityKey: seed.normalizedIdentityKey,
        principleName: lesson.principleName,
        principleExpression: lesson.principleExpression,
        coreLesson: lesson.coreLesson,
        biologicalBasis: lesson.biologicalBasis,
        shortMotto: lesson.shortMotto,
        bestUseCases: lesson.bestUseCases,
        applicationExample: buildFallbackApplicationExample(
            seed.beastSlug,
            lesson.principleName,
            lesson.principleExpression,
            lesson.coreLesson,
            lesson.biologicalBasis,
            lesson.shortMotto
        ),
        imageFile: null,
        source: "catalog" as const
    };
}

async function fetchCatalogLessonBySlug(slug: string): Promise<SpeciesBehaviorLesson | null> {
    const legendarySeed = getLegendaryCatalogSeedByBeastSlug(slug) ?? getLegendaryCatalogSeedByBiologyLandingSlug(slug);
    const legendaryLesson = buildLegendarySeedBehaviorLesson(legendarySeed);

    if (legendaryLesson) {
        return legendaryLesson;
    }

    const config = getSupabaseConfig();

    if (!config) {
        return null;
    }

    const searchParams = new URLSearchParams({
        select: "landing_page_slug,display_name,normalized_identity_key,principle_name,principle_expression,core_lesson,biological_basis,short_motto,best_use_cases",
        or: `(landing_page_slug.eq.${slug},normalized_identity_key.eq.${slug.replace(/-/g, "_")})`,
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
        if (!row) {
            return null;
        }

        const applicationExamples = await fetchApplicationExamplesFromSupabase(config, slug);
        return normalizeLessonRow(row, applicationExamples);
    } catch {
        return null;
    }
}

async function fetchApplicationExamplesFromSupabase(
    config: NonNullable<ReturnType<typeof getSupabaseConfig>>,
    slug?: string
): Promise<Map<string, string>> {
    const examples = new Map<string, string>();
    const profileSlugs = new Map<string, string>();
    let offset = 0;

    try {
        while (true) {
            const profileSearchParams = new URLSearchParams({
                select: "id,landing_page_slug",
                landing_page_slug: slug ? `eq.${slug}` : "not.is.null",
                order: "landing_page_slug.asc",
                limit: slug ? "1" : "1000",
                offset: slug ? "0" : String(offset)
            });
            const profileResponse = await fetch(`${config.supabaseUrl}/rest/v1/species_profiles?${profileSearchParams.toString()}`, {
                headers: config.headers,
                next: {revalidate: BEHAVIOR_LESSONS_REVALIDATE_SECONDS}
            });

            if (!profileResponse.ok) {
                return examples;
            }

            const profiles = await profileResponse.json() as SpeciesProfileLessonIdentityRow[];
            if (!Array.isArray(profiles) || profiles.length === 0) {
                return examples;
            }

            for (const profile of profiles) {
                const profileId = profile.id?.trim();
                const profileSlug = profile.landing_page_slug?.trim();
                if (profileId && profileSlug) {
                    profileSlugs.set(profileId, profileSlug);
                }
            }

            if (slug || profiles.length < 1000) {
                break;
            }

            offset += 1000;
        }

        offset = 0;
        const speciesProfileId = slug ? profileSlugs.keys().next().value as string | undefined : undefined;
        if (slug && !speciesProfileId) {
            return examples;
        }

        while (true) {
            const searchParams = new URLSearchParams({
                select: "species_profile_id,application_example",
                application_example: "not.is.null",
                order: "species_profile_id.asc",
                limit: slug ? "1" : "1000",
                offset: slug ? "0" : String(offset)
            });

            if (speciesProfileId) {
                searchParams.set("species_profile_id", `eq.${speciesProfileId}`);
            }

            const response = await fetch(`${config.supabaseUrl}/rest/v1/species_behavior_principles?${searchParams.toString()}`, {
                headers: config.headers,
                next: {revalidate: BEHAVIOR_LESSONS_REVALIDATE_SECONDS}
            });

            if (!response.ok) {
                return examples;
            }

            const batch = await response.json() as SpeciesBehaviorPrincipleRow[];
            if (!Array.isArray(batch) || batch.length === 0) {
                break;
            }

            for (const row of batch) {
                const profileId = row.species_profile_id?.trim();
                const applicationExample = row.application_example?.trim();
                const profileSlug = profileId ? profileSlugs.get(profileId) : null;
                if (profileSlug && applicationExample) {
                    examples.set(profileSlug, applicationExample);
                }
            }

            if (slug || batch.length < 1000) {
                break;
            }

            offset += 1000;
        }
    } catch {
        return examples;
    }

    return examples;
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

    const applicationExamples = await fetchApplicationExamplesFromSupabase(config);

    return rows
        .map((row) => normalizeLessonRow(row, applicationExamples))
        .filter((lesson): lesson is SpeciesBehaviorLesson => Boolean(lesson));
}

let behaviorLessonIndexPromise: Promise<SpeciesBehaviorLesson[]> | null = null;

export async function getBehaviorLessonIndex(): Promise<SpeciesBehaviorLesson[]> {
    if (!behaviorLessonIndexPromise) {
        behaviorLessonIndexPromise = fetchBehaviorLessonsFromSupabase()
            .then(mergeCatalogAndLocalLessons)
            .catch(() => mergeCatalogAndLocalLessons([]));
    }

    return behaviorLessonIndexPromise;
}

export async function getBehaviorLessonBySlug(slug: string): Promise<SpeciesBehaviorLesson | null> {
    const catalogLesson = await fetchCatalogLessonBySlug(slug);
    if (catalogLesson) {
        return catalogLesson;
    }

    const entry = getSpeciesBySlug(slug);
    if (!entry) {
        return null;
    }

    const systemsEntry = getSystemsIntelligenceBySpeciesSlug(slug);
    const profile = getBehavioralPrincipleProfile(slug, systemsEntry, speciesSystemsIntelligence);

    return profile ? buildLocalBehaviorLesson(entry, profile) : null;
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

function pickHubMotto(lessons: SpeciesBehaviorLesson[]) {
    return lessons.find((lesson) => lesson.shortMotto.trim())?.shortMotto
        ?? lessons.find((lesson) => lesson.principleExpression?.trim())?.principleExpression
        ?? lessons[0]?.coreLesson
        ?? "";
}

function getLessonHubQualities(lesson: SpeciesBehaviorLesson) {
    const qualities = lesson.bestUseCases
        .map((quality) => quality.trim())
        .filter(Boolean);

    if (qualities.length > 0) {
        return Array.from(new Map(
            qualities.map((quality) => [toPrincipleSlug(quality), quality] as const)
        ).values());
    }

    const systemsEntry = getSystemsIntelligenceBySpeciesSlug(lesson.slug);
    const localProfile = getBehavioralPrincipleProfile(lesson.slug, systemsEntry, speciesSystemsIntelligence);
    return [localProfile?.browseCluster || lesson.principleName];
}

export async function getPrincipleHubIndex(): Promise<PrincipleHub[]> {
    const lessons = await getBehaviorLessonIndex();
    const grouped = new Map<string, PrincipleHub>();

    for (const lesson of lessons) {
        for (const principle of getLessonHubQualities(lesson)) {
            const principleSlug = toPrincipleSlug(principle);
            if (!principleSlug) {
                continue;
            }

            const current = grouped.get(principleSlug) ?? {
                principle,
                principleSlug,
                speciesCount: 0,
                speciesSlugs: [],
                sampleMotto: "",
                lessons: [],
                catalogLessonCount: 0
            };

            if (!current.speciesSlugs.includes(lesson.slug)) {
                current.speciesCount += 1;
                current.speciesSlugs.push(lesson.slug);
                current.lessons.push(lesson);
                if (lesson.source === "catalog") {
                    current.catalogLessonCount += 1;
                }
            }

            grouped.set(principleSlug, current);
        }
    }

    return Array.from(grouped.values())
        .map((hub) => ({
            ...hub,
            lessons: hub.lessons.sort((left, right) => left.displayName.localeCompare(right.displayName)),
            speciesSlugs: Array.from(new Set(hub.speciesSlugs)),
            sampleMotto: pickHubMotto(hub.lessons)
        }))
        .sort((left, right) => right.speciesCount - left.speciesCount || left.principle.localeCompare(right.principle));
}

export async function getPrincipleHubBySlug(slug: string): Promise<PrincipleHub | null> {
    const hubs = await getPrincipleHubIndex();
    return hubs.find((hub) => hub.principleSlug === slug) ?? null;
}

export async function resolveSpeciesBehaviorProfile(slug: string): Promise<ResolvedSpeciesBehaviorProfile | null> {
    const systemsEntry = getSystemsIntelligenceBySpeciesSlug(slug);
    const localProfile = getBehavioralPrincipleProfile(slug, systemsEntry, speciesSystemsIntelligence);
    const catalogLesson = await fetchCatalogLessonBySlug(slug);
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
            principleExpression: catalogLesson.principleExpression ?? localProfile?.principleExpression,
            coreLesson: catalogLesson.coreLesson,
            biologicalBasis: catalogLesson.biologicalBasis || localProfile?.biologicalBasis || "",
            applicationExample: catalogLesson.applicationExample ?? localProfile?.applicationExample,
            bestFor: catalogLesson.bestUseCases.length > 0
                ? catalogLesson.bestUseCases
                : (localProfile?.bestFor ?? []),
            relatedSpeciesSlugs,
            source: "catalog_db",
            hasCatalogLesson: true,
            hasLessonPage: true,
            clusterPrinciple: clusterProfile.clusterPrinciple ?? catalogLesson.principleName,
            clusterPrincipleSlug: clusterProfile.clusterPrincipleSlug ?? toPrincipleSlug(catalogLesson.principleName)
        };
    }

    if (!localProfile) {
        return null;
    }

    return {
        ...localProfile,
        hasCatalogLesson: false,
        hasLessonPage: true,
        clusterPrinciple: clusterProfile.clusterPrinciple,
        clusterPrincipleSlug: clusterProfile.clusterPrincipleSlug
    };
}
