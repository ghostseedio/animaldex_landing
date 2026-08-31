import "server-only";

import {emptyBehaviorPrincipleIndex, getCatalogBehaviorPrincipleIndex, getUnifiedSpeciesEntries, resolveCatalogBehaviorPrinciple} from "@/data/database-species-pages";
import {getLegendaryEarthBeast} from "@/data/legendary-earth-beasts";
import {fetchPowerSetCompletions} from "@/data/power-set-completions";
import {getAuthenticatedPublicProfileCard, resolveProfileSettingCounts, resolvePublicOverallScore, type PublicProfileCapture} from "@/data/public-profiles";
import type {DiscoverCaptureItem} from "@/data/discover-timeline";
import {getBehavioralPrincipleProfile} from "@/data/species-behavioral-principles";
import {getSpeciesBySlug, speciesEntries, type SpeciesEntry} from "@/data/species";
import {getSpeciesImageRoute} from "@/data/species-images";
import {speciesSystemsIntelligence} from "@/data/species-systems-intelligence";
import {getDirectMessageUnreadCountForUser} from "@/data/direct-messages";
import {getAuthenticatedUserProfile, getUserCaptureSettingCounts, getUserCaptureStats, getUserCaptures, UserCaptureSummary} from "@/data/user-captures";
import {getAnimalDexNumberFromEntry} from "@/lib/animaldex-number";
import {discoverPostPath} from "@/lib/discover-post";
import {collectionIdentityMatchKeys} from "@/lib/collection-identity-aliases";
import {computeCaptureGradeBreakdown, type CaptureGradeBreakdown, type CaptureGradeSource} from "@/lib/capture-grade";
import {resolveCaptureVariantDisplay} from "@/lib/species-life-stage-policy";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {hasAuthCookie} from "@/lib/viewer";

export type AppProfile = NonNullable<Awaited<ReturnType<typeof getAuthenticatedUserProfile>>>;

export type AppCapture = UserCaptureSummary & {
    scientificName: string | null;
    category: string | null;
    displayName: string;
    lifeStageChip: string | null;
    countsAsLine: string | null;
    capturedAsLine: string | null;
    sameSpeciesHelper: string | null;
    principle: string | null;
    coreLesson: string | null;
    gameStats: AppCaptureGameStats | null;
    battleTier: "E" | "D" | "C" | "B" | "A" | "S" | null;
    captureGrade: number | null;
    gradeBreakdown: CaptureGradeBreakdown | null;
    indexNumber: number | null;
    href: string;
    imageSrc: string;
};

export type AppProfileSummary = {
    captureCount: number;
    uniqueSpecies: number;
    indexedSpeciesCount: number;
    overallScore: number;
    wild: number;
    zoo: number;
    domestic: number;
    farm: number;
};

export type AppMission = {
    slug: string;
    tier: string;
    title: string;
    detail: string;
    rewardCredits: number;
    targetCount: number;
    progressCount: number;
    completedCount: number;
    isRepeatable: boolean;
    isLocked: boolean;
};

export type AppProgression = {
    /** Verified overall score from `user_progression_summary_v1` (matches iOS profile). */
    overallScore: number;
    tradeUnlockScore: number;
    tradeUnlocked: boolean;
    referralCode: string | null;
    qualifiedReferrals: number;
    missions: AppMission[];
};

export type AppSponsoredCampaign = {
    id: string;
    slug: string;
    title: string;
    publicSummary: string;
    description: string;
    presenterName: string | null;
    sponsorOrganizationId: string | null;
    status: string;
    startsAt: string;
    endsAt: string;
    timezoneIdentifier: string;
    objectiveType: string;
    targetCount: number;
    requiredTypeTag: string | null;
    requiredSettingTag: string | null;
    minimumCaptureGrade: number | null;
    liveOnly: boolean;
    externalImportsAllowed: boolean;
    rulesVersion: number;
    officialRules: string;
    rewardTerms: string;
    thumbnailUrl: string | null;
    thumbnailAltText: string | null;
    participant: {
        status: string;
        progressCount: number;
        completedAt: string | null;
        rewardedAt: string | null;
    } | null;
    reward: {
        title: string;
        detail: string | null;
    } | null;
    cashReward: {
        amountMinor: number;
        currencyCode: string;
        remainingRecipients: number;
    } | null;
};

export type AppNotification = {
    id: string;
    captureId: string | null;
    actorUserId: string | null;
    actorDisplayName: string | null;
    actorUsername: string | null;
    tradeOfferId: string | null;
    creditOfferId: string | null;
    comparisonSlug: string | null;
    campaignId: string | null;
    challengeId: string | null;
    eventType: string;
    likeCount: number | null;
    endorsedStat: string | null;
    giftSlug: string | null;
    subjectAnimalName: string | null;
    subjectAnimalDexNumber: number | null;
    sourceKey: string | null;
    serverTitle: string | null;
    serverBody: string | null;
    createdAt: string;
    readAt: string | null;
};

export type AppTrade = {
    id: string;
    offererUserId: string;
    receiverUserId: string;
    offererCaptureId: string;
    receiverCaptureId: string;
    offererName: string;
    receiverName: string;
    offererValue: number;
    receiverValue: number;
    status: string;
    createdAt: string;
    expiresAt: string;
    offererSlug: string | null;
    receiverSlug: string | null;
};

export type AppCreditOffer = {
    id: string;
    bidderUserId: string;
    targetOwnerUserId: string;
    targetCaptureId: string;
    targetAnimalName: string;
    bidderName: string;
    ownerName: string;
    amount: number;
    status: string;
    createdAt: string;
    expiresAt: string;
};

export type AppAlbum = {
    id: string;
    name: string;
    captureIds: string[];
};

export type AppPowerSet = {
    key: string;
    title: string;
    total: number;
    found: number;
    captureIds: string[];
};

function speciesEntryMatchesIdentity(
    entry: {slug: string; normalizedIdentityKey?: string | null; speciesProfileId?: string | null},
    identity: string
) {
    const normalized = identity.trim().toLowerCase();
    const slugCandidates = collectionIdentityMatchKeys(normalized.replace(/-/g, "_"));

    if (slugCandidates.includes(entry.slug.replace(/-/g, "_"))) {
        return true;
    }

    const entryIdentity = entry.normalizedIdentityKey?.toLowerCase();

    if (entryIdentity && slugCandidates.includes(entryIdentity)) {
        return true;
    }

    return entry.slug === normalized
        || entry.slug === normalized.replace(/_/g, "-")
        || entryIdentity === normalized
        || entry.speciesProfileId?.toLowerCase() === normalized;
}

function findSpeciesForCaptureIdentity(identity: string | null | undefined) {
    if (!identity) {
        return null;
    }

    const normalized = identity.trim().toLowerCase();

    return speciesEntries.find((entry) => speciesEntryMatchesIdentity(entry, normalized)) ?? null;
}

async function findSpeciesForCaptureIdentityAsync(identity: string | null | undefined) {
    if (!identity) {
        return null;
    }

    const normalized = identity.trim().toLowerCase();
    const staticMatch = findSpeciesForCaptureIdentity(normalized);

    if (staticMatch) {
        return staticMatch;
    }

    const unified = await getUnifiedSpeciesEntries();

    return unified.find((entry) => speciesEntryMatchesIdentity(entry, normalized)) ?? null;
}

function findSpeciesForCapture(capture: UserCaptureSummary, catalog: SpeciesEntry[]) {
    const profileId = capture.speciesProfileId?.trim().toLowerCase();

    if (profileId) {
        const byProfile = catalog.find((entry) => entry.speciesProfileId?.trim().toLowerCase() === profileId);
        if (byProfile) {
            return byProfile;
        }
    }

    const identity = capture.speciesSlug?.trim().toLowerCase();

    if (identity) {
        const identityKeys = new Set(collectionIdentityMatchKeys(identity));
        const catalogMatch = catalog.find((entry) => {
            const entryIdentity = (entry.normalizedIdentityKey ?? entry.slug.replace(/-/g, "_")).toLowerCase();
            return identityKeys.has(entryIdentity) || speciesEntryMatchesIdentity(entry, identity);
        });
        if (catalogMatch) {
            return catalogMatch;
        }

        const staticMatch = findSpeciesForCaptureIdentity(identity);
        if (staticMatch) {
            return staticMatch;
        }
    }

    return null;
}

function resolveCapturePrinciple(species: SpeciesEntry | null, behaviorPrinciples: Awaited<ReturnType<typeof getCatalogBehaviorPrincipleIndex>>) {
    if (!species) {
        return null;
    }

    const legendaryBeast = getLegendaryEarthBeast(species.slug);
    const catalogPrinciple = resolveCatalogBehaviorPrinciple(
        behaviorPrinciples,
        species.speciesProfileId,
        species.normalizedIdentityKey,
        species.analysis.scientificName
    );
    const staticPrinciple = getBehavioralPrincipleProfile(
        species.slug,
        speciesSystemsIntelligence[species.slug],
        speciesSystemsIntelligence
    );

    return legendaryBeast?.power
        ?? catalogPrinciple?.principleName
        ?? staticPrinciple?.principle
        ?? null;
}

function buildAppCapture(
    capture: UserCaptureSummary,
    species: SpeciesEntry | null,
    principle: string | null = null
): AppCapture {
    const variant = resolveCaptureVariantDisplay({
        animalName: capture.animalName,
        lifeStage: capture.lifeStage,
        normalizedIdentityKey: capture.speciesSlug,
        canonicalSpecies: species
            ? {
                name: species.name,
                slug: species.slug,
                normalizedIdentityKey: species.normalizedIdentityKey,
                speciesProfileId: species.speciesProfileId,
                animalDexNumber: getAnimalDexNumberFromEntry(species)
            }
            : null
    });

    return {
        ...capture,
        scientificName: species?.analysis.scientificName ?? capture.scientificName ?? null,
        category: species?.analysis.category ?? null,
        displayName: variant.title,
        lifeStageChip: variant.lifeStageChip,
        countsAsLine: variant.countsAsLine,
        capturedAsLine: variant.capturedAsLine,
        sameSpeciesHelper: variant.sameSpeciesHelper,
        principle,
        coreLesson: null,
        gameStats: null,
        battleTier: null,
        captureGrade: null,
        gradeBreakdown: null,
        indexNumber: getAnimalDexNumberFromEntry(species),
        href: species ? `/animals/${species.slug}` : "/animals",
        imageSrc: species
            ? getSpeciesImageRoute(species.slug, capture.captureId)
            : "/images/placeholders/species-no-image.svg"
    };
}

async function enrichAppCaptures(captures: UserCaptureSummary[]): Promise<AppCapture[]> {
    const [catalog, behaviorPrinciples] = await Promise.all([
        getUnifiedSpeciesEntries(),
        getCatalogBehaviorPrincipleIndex()
    ]);

    return captures.map((capture) => {
        const species = findSpeciesForCapture(capture, catalog);
        const principle = resolveCapturePrinciple(species, behaviorPrinciples);
        return buildAppCapture(capture, species, principle);
    });
}

export type AppJournalEntry = {
    id: string;
    date: string;
    problem: string;
    insight: string | null;
    score: number | null;
    tier: string | null;
    state: string;
};

export type AppDiscoverItem = {
    captureId: string;
    animalName: string;
    speciesSlug: string | null;
    score: number;
    createdAt: string | null;
    contextLabel: string | null;
    locationLabel: string | null;
    collectorName: string;
    collectorUsername: string | null;
    ownerUserId: string;
    likeCount: number;
    href: string;
    imageSrc: string;
};

export type AppCaptureGameStats = {
    dominance: number;
    speed: number;
    size: number;
    intelligence: number;
    rarity: number;
};

export type AppCaptureTrainingBoosts = Pick<AppCaptureGameStats, "dominance" | "speed" | "intelligence">;

export type AppCaptureDetail = {
    id: string;
    status: string;
    createdAt: string;
    locationLabel: string | null;
    locationLat: number | null;
    locationLng: number | null;
    animalName: string;
    scientificName: string | null;
    speciesSlug: string | null;
    breed: string | null;
    context: string | null;
    conservationTier: string | null;
    confidence: number | null;
    typeTags: string[];
    /** Compatibility alias for consumers that predate the base/effective split. */
    gameStats: AppCaptureGameStats;
    baseGameStats: AppCaptureGameStats;
    effectiveGameStats: AppCaptureGameStats;
    statDeltas: AppCaptureGameStats;
    trainingBoosts: AppCaptureTrainingBoosts;
    comparisonStatBoosts: AppCaptureGameStats;
    endorsementBonuses: AppCaptureGameStats;
    settingTag: string | null;
    humanContext: string | null;
    captureValidity: string | null;
    authenticityStatus: string | null;
    signals: Record<string, any> | null;
    premiumDetails: Record<string, any> | null;
    imageSrc: string;
    captureGrade: number | null;
    gradeBreakdown: CaptureGradeBreakdown | null;
    totalProgressionXP: number;
    challengeHealth: number;
    challengeStake: number;
    isChallengeReady: boolean;
    isDiscoverable: boolean;
    recentProgressionSource: string | null;
    hasChallengeGameStats: boolean;
    isZooComparisonBanned: boolean;
    isChallengeAnalysisEligible: boolean;
    isEligibleCapture: boolean;
    hasUncertaintyFallback: boolean;
};

type QueryRow = Record<string, any>;

const APP_CAPTURE_GAME_STAT_KEYS = ["dominance", "speed", "size", "intelligence", "rarity"] as const;

function asQueryRow(value: unknown): QueryRow | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }

    return value as QueryRow;
}

function normalizedOptionalString(value: unknown) {
    if (typeof value !== "string") {
        return null;
    }

    const normalized = value.trim();
    return normalized || null;
}

function finiteInteger(value: unknown, fallback = 0) {
    const number = typeof value === "number" ? value : Number(value);
    return Number.isFinite(number) ? Math.round(number) : fallback;
}

function nullableFiniteNumber(value: unknown) {
    if (value === null || value === undefined || value === "") return null;
    const number = typeof value === "number" ? value : Number(value);
    return Number.isFinite(number) ? number : null;
}

function clampGameStat(value: unknown) {
    return Math.min(100, Math.max(0, finiteInteger(value)));
}

function canonicalGameStats(value: unknown): AppCaptureGameStats {
    const row = asQueryRow(value);

    return {
        dominance: clampGameStat(row?.dominance),
        speed: clampGameStat(row?.speed),
        size: clampGameStat(row?.size),
        intelligence: clampGameStat(row?.intelligence),
        rarity: clampGameStat(row?.rarity)
    };
}

function hasCanonicalGameStats(value: unknown) {
    const row = asQueryRow(value);
    if (!row) {
        return false;
    }

    return APP_CAPTURE_GAME_STAT_KEYS.every((key) => {
        const number = typeof row[key] === "number" ? row[key] : Number(row[key]);
        return row[key] !== null && row[key] !== "" && Number.isFinite(number);
    });
}

function normalizedEligibilityToken(value: unknown) {
    const raw = normalizedOptionalString(value);
    if (!raw) {
        return null;
    }

    return raw
        .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
}

function analysisRawModel(analysis: QueryRow) {
    const raw = asQueryRow(analysis.raw_json);
    return {
        root: raw,
        model: asQueryRow(raw?.model),
        rawOpenAI: asQueryRow(raw?.raw_openai)
    };
}

function resolvedAnalysisToken(analysis: QueryRow, key: "capture_validity" | "authenticity_status") {
    const raw = analysisRawModel(analysis);
    return normalizedOptionalString(analysis[key])
        ?? normalizedOptionalString(raw.model?.[key])
        ?? normalizedOptionalString(raw.root?.[key])
        ?? normalizedOptionalString(raw.rawOpenAI?.[key]);
}

function resolvedStoredGameStats(analysis: QueryRow) {
    const raw = analysisRawModel(analysis);
    const candidates = [
        asQueryRow(analysis.game_stats),
        asQueryRow(raw.model?.game_stats),
        asQueryRow(raw.rawOpenAI?.game_stats)
    ].filter((candidate): candidate is QueryRow => candidate !== null);

    return candidates.find(hasCanonicalGameStats) ?? candidates[0] ?? null;
}

function looksLikeGarbageDescriptiveIdentity(value: string) {
    const anatomyTokens = new Set([
        "antenna", "antennae", "antler", "antlers", "beak", "bill", "claw", "claws",
        "coat", "color", "colour", "eye", "eyes", "feather", "feathers", "fin", "fins",
        "fur", "horn", "horns", "leg", "legs", "marking", "markings", "paw", "paws",
        "plumage", "scale", "scales", "shell", "spot", "spots", "stripe", "stripes",
        "tail", "toe", "toes", "wing", "wings"
    ]);
    const descriptorTokens = new Set([
        "angle", "appearance", "count", "detail", "details", "length", "number", "numbers",
        "pair", "pairs", "pattern", "patterns", "profile", "shape", "silhouette", "size",
        "structure", "view"
    ]);
    const taxonTokens = new Set([
        "ant", "bee", "beetle", "bird", "butterfly", "cat", "cattle", "cicada", "cockroach",
        "crab", "dog", "dragonfly", "fish", "fly", "frog", "gecko", "grasshopper", "horse",
        "insect", "lizard", "mantis", "moth", "passerine", "sheep", "snail", "snake",
        "spider", "toad", "turtle", "wasp"
    ]);
    const tokens = value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((token) => token && token !== "of");

    return tokens.length >= 2
        && tokens.some((token) => anatomyTokens.has(token))
        && tokens.some((token) => descriptorTokens.has(token))
        && !tokens.some((token) => taxonTokens.has(token));
}

export async function getAuthenticatedSupabaseUser() {
    if (!hasAuthCookie()) return null;

    const supabase = createSupabaseServerClient();
    if (!supabase) return null;

    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return null;

    return {supabase, user};
}

export function mapPublicProfileCaptureToAppCapture(capture: PublicProfileCapture): AppCapture {
    const summary: UserCaptureSummary = {
        captureId: capture.id,
        animalName: capture.animalName,
        scientificName: null,
        speciesSlug: capture.speciesSlug,
        speciesProfileId: null,
        lifeStage: null,
        confidence: null,
        score: capture.score,
        captureValidity: null,
        learnedScenarioTags: [],
        capturedAt: capture.capturedAt,
        imageBucket: null,
        imagePath: null,
        contextLabel: capture.contextLabel,
        locationDisplayLabel: null
    };
    const species = findSpeciesForCaptureIdentity(capture.speciesSlug);
    const built = buildAppCapture(summary, species, null);

    return {
        ...built,
        href: capture.href,
        imageSrc: capture.imageSrc
    };
}

export function mapDiscoverCaptureToAppCapture(item: DiscoverCaptureItem): AppCapture {
    const effectiveStats = item.effectiveGameStats ?? item.gameStats;

    return {
        captureId: item.captureId,
        animalName: item.animalName,
        scientificName: item.scientificName,
        speciesSlug: item.speciesSlug,
        speciesProfileId: item.speciesProfileId,
        lifeStage: item.lifeStage,
        confidence: item.confidence,
        score: item.score,
        captureValidity: null,
        learnedScenarioTags: item.bestForTags,
        capturedAt: item.capturedAt,
        imageBucket: null,
        imagePath: null,
        contextLabel: item.contextLabel,
        locationDisplayLabel: item.locationLabel,
        category: null,
        displayName: item.animalName,
        lifeStageChip: item.lifeStageChip,
        countsAsLine: item.sameSpeciesHelper,
        capturedAsLine: null,
        sameSpeciesHelper: item.sameSpeciesHelper,
        principle: item.learnedPrinciple,
        coreLesson: item.coreLesson,
        gameStats: canonicalGameStats(effectiveStats),
        battleTier: item.battleTier,
        captureGrade: item.captureGrade,
        gradeBreakdown: item.gradeBreakdown,
        indexNumber: item.animalDexNumber,
        href: discoverPostPath(item.id),
        imageSrc: item.imageSrc
    };
}

export function decorateCapture(capture: UserCaptureSummary): AppCapture {
    const species = findSpeciesForCaptureIdentity(capture.speciesSlug);
    const principle = resolveCapturePrinciple(species, emptyBehaviorPrincipleIndex());
    return buildAppCapture(capture, species, principle);
}

export async function decorateCaptureAsync(capture: UserCaptureSummary): Promise<AppCapture> {
    const species = await findSpeciesForCaptureIdentityAsync(capture.speciesSlug);
    const [behaviorPrinciples] = await Promise.all([getCatalogBehaviorPrincipleIndex()]);
    const principle = resolveCapturePrinciple(species, behaviorPrinciples);
    return buildAppCapture(capture, species, principle);
}

export async function getAuthenticatedAppContext() {
    const profile = await getAuthenticatedUserProfile();
    if (!profile) return null;
    return {profile};
}

export async function getAuthenticatedAppShellData() {
    const session = await getAuthenticatedSupabaseUser();
    if (!session) {
        return {
            context: null,
            notifications: [] as AppNotification[],
            unreadMessageCount: 0,
            creditBalance: null as number | null
        };
    }

    const fullSelect = "id,capture_id,actor_user_id,actor_display_name,actor_username,trade_offer_id,credit_offer_id,comparison_slug,campaign_id,challenge_id,event_type,like_count,endorsed_stat,gift_slug,subject_animal_name,subject_animaldex_number,source_key,title,body,created_at,read_at";
    const fallbackSelect = "id,capture_id,trade_offer_id,credit_offer_id,event_type,like_count,endorsed_stat,created_at,read_at";

    const [profileRow, notificationsResult, unreadMessageCount, creditBalance] = await Promise.all([
        session.supabase
            .from("profiles")
            .select("display_name,username,avatar_url")
            .eq("id", session.user.id)
            .maybeSingle(),
        session.supabase.from("user_notifications")
            .select(fullSelect)
            .order("created_at", {ascending: false})
            .limit(40),
        getDirectMessageUnreadCountForUser(session.supabase, session.user.id),
        getAppCreditBalance(session)
    ]);

    const notifications = notificationsResult.error
        ? ((await session.supabase.from("user_notifications").select(fallbackSelect).order("created_at", {ascending: false}).limit(40)).data ?? [])
        : (notificationsResult.data ?? []);

    return {
        context: {
            profile: {
                id: session.user.id,
                email: session.user.email ?? null,
                displayName: profileRow.data?.display_name?.trim() ?? null,
                username: profileRow.data?.username?.trim() ?? null,
                avatarUrl: profileRow.data?.avatar_url?.trim() ?? null
            }
        },
        notifications: mapAppNotificationRows(notifications as QueryRow[]),
        unreadMessageCount,
        creditBalance
    };
}

export async function getAppCreditBalance(session?: Awaited<ReturnType<typeof getAuthenticatedSupabaseUser>>) {
    const activeSession = session ?? await getAuthenticatedSupabaseUser();
    if (!activeSession) return null;

    const {data} = await activeSession.supabase
        .from("credit_balances")
        .select("balance")
        .eq("user_id", activeSession.user.id)
        .maybeSingle();

    return data?.balance == null ? 0 : Number(data.balance);
}

export async function getAppCaptures(limit = 2000) {
    const captures = await getUserCaptures(limit);

    return enrichAppCaptures(captures);
}

export async function getAppTopCaptures(limit = 6) {
    const session = await getAuthenticatedSupabaseUser();
    if (!session) return [];

    const {data, error} = await session.supabase
        .from("discover_feed_v1")
        .select("capture_id,animal_name,normalized_identity_key,species_profile_id,score,capture_created_at,human_context,zoo_or_wild,location_display_label")
        .eq("user_id", session.user.id)
        .order("score", {ascending: false})
        .order("capture_created_at", {ascending: false})
        .limit(limit);

    if (error || !data?.length) {
        return [];
    }

    const captures: UserCaptureSummary[] = (data as QueryRow[]).map((row) => ({
        captureId: row.capture_id,
        animalName: row.animal_name?.trim() || "Animal",
        scientificName: null,
        speciesSlug: row.normalized_identity_key?.trim() ?? null,
        speciesProfileId: row.species_profile_id?.trim() ?? null,
        lifeStage: null,
        confidence: null,
        score: Number(row.score ?? 0),
        captureValidity: null,
        learnedScenarioTags: [],
        capturedAt: row.capture_created_at ?? null,
        imageBucket: null,
        imagePath: null,
        contextLabel: row.zoo_or_wild && row.zoo_or_wild !== "Unknown"
            ? row.zoo_or_wild
            : row.human_context ?? null,
        locationDisplayLabel: row.location_display_label?.trim() ?? null
    }));

    return enrichAppCaptures(captures);
}

export async function getAppProfileSummary(): Promise<AppProfileSummary> {
    const fallback: AppProfileSummary = {
        captureCount: 0,
        uniqueSpecies: 0,
        indexedSpeciesCount: 0,
        overallScore: 0,
        wild: 0,
        zoo: 0,
        domestic: 0,
        farm: 0
    };
    const session = await getAuthenticatedSupabaseUser();

    if (!session) {
        return fallback;
    }

    const {data, error} = await session.supabase
        .from("member_profile_summaries_v1")
        .select("overall_score,capture_count,unique_species,indexed_species_count,wild_captures,zoo_captures,domestic_captures")
        .eq("user_id", session.user.id)
        .maybeSingle();

    if (error || !data) {
        const stats = await getUserCaptureStats();
        return {
            captureCount: stats.captureCount,
            uniqueSpecies: stats.uniqueSpecies,
            indexedSpeciesCount: stats.uniqueSpecies,
            overallScore: stats.collectorScore,
            wild: stats.wild,
            zoo: stats.zoo,
            domestic: stats.domestic,
            farm: stats.farm
        };
    }

    const row = data as QueryRow;

    return {
        captureCount: Number(row.capture_count ?? 0),
        uniqueSpecies: Number(row.unique_species ?? 0),
        indexedSpeciesCount: Number(row.indexed_species_count ?? row.unique_species ?? 0),
        overallScore: Number(row.overall_score ?? 0),
        wild: Number(row.wild_captures ?? 0),
        zoo: Number(row.zoo_captures ?? 0),
        domestic: Number(row.domestic_captures ?? 0),
        farm: 0
    };
}

export async function getAppProfileSettingCounts() {
    const [summary, captureSettings] = await Promise.all([
        getAppProfileSummary(),
        getUserCaptureSettingCounts()
    ]);

    return resolveProfileSettingCounts(
        {wild: summary.wild, zoo: summary.zoo, domestic: summary.domestic, farm: captureSettings.farm},
        captureSettings
    );
}

export async function getAppCollectorScore() {
    const publicCard = await getAuthenticatedPublicProfileCard();
    if (publicCard) {
        return publicCard.collectorScore;
    }

    const session = await getAuthenticatedSupabaseUser();
    if (!session) return 0;

    const [summary, powerSetResult] = await Promise.all([
        getAppProfileSummary(),
        session.supabase
            .from("public_profile_power_set_completions_v1")
            .select("reward_points")
            .eq("user_id", session.user.id)
    ]);

    if (powerSetResult.data?.length) {
        return resolvePublicOverallScore(summary.overallScore, powerSetResult.data as Array<{reward_points: number | null}>);
    }

    const powerSetCompletions = await fetchPowerSetCompletions();
    return resolvePublicOverallScore(
        summary.overallScore,
        powerSetCompletions.map((completion) => ({reward_points: completion.rewardPoints}))
    );
}

export function getCaptureStats(captures: AppCapture[]) {
    const uniqueSpecies = new Set(captures.map((capture) => capture.speciesSlug || capture.animalName.toLowerCase())).size;
    return {
        captureCount: captures.length,
        uniqueSpecies,
        collectorScore: captures.reduce((sum, capture) => sum + capture.score, 0),
        wild: captures.filter((capture) => capture.contextLabel === "Wild").length,
        zoo: captures.filter((capture) => capture.contextLabel === "Zoo").length,
        domestic: captures.filter((capture) => capture.contextLabel === "Domestic" || capture.contextLabel === "Farm").length,
        catalogSize: speciesEntries.length
    };
}

export async function getAppCaptureStats() {
    const stats = await getUserCaptureStats();

    return {
        ...stats,
        catalogSize: speciesEntries.length
    };
}

async function loadProgressionSummary(supabase: ReturnType<typeof createSupabaseServerClient>, userId: string) {
    const viewResult = await supabase!
        .from("user_progression_summary_v1")
        .select("verified_overall_score,trade_unlock_score,trade_unlocked_at,referral_code,qualified_referral_count")
        .maybeSingle();

    if (viewResult.data) {
        return viewResult.data as QueryRow;
    }

    const [profileResult, referralResult] = await Promise.all([
        supabase!
            .from("profiles")
            .select("verified_overall_score,trade_unlocked_at,referral_code")
            .eq("id", userId)
            .maybeSingle(),
        supabase!
            .from("user_referrals")
            .select("id", {count: "exact", head: true})
            .eq("inviter_user_id", userId)
            .not("qualified_at", "is", null)
    ]);

    const profile = profileResult.data as QueryRow | null;

    return {
        verified_overall_score: profile?.verified_overall_score ?? 0,
        trade_unlock_score: 1000,
        trade_unlocked_at: profile?.trade_unlocked_at ?? null,
        referral_code: profile?.referral_code ?? null,
        qualified_referral_count: referralResult.count ?? 0
    } satisfies QueryRow;
}

async function loadMissionStatus(supabase: ReturnType<typeof createSupabaseServerClient>, userId: string) {
    const viewResult = await supabase!
        .from("user_mission_status_v1")
        .select("slug,tier,sort_order,title,detail,reward_credits,target_count,progress_count,unlock_score_min,requires_trade_unlocked,is_repeatable,completed_count")
        .order("sort_order", {ascending: true});

    if (viewResult.data?.length) {
        return viewResult.data as QueryRow[];
    }

    const [definitionsResult, progressResult] = await Promise.all([
        supabase!
            .from("mission_definitions")
            .select("slug,tier,sort_order,title,detail,reward_credits,target_count,unlock_score_min,requires_trade_unlocked,is_repeatable")
            .order("sort_order", {ascending: true}),
        supabase!
            .from("user_mission_progress")
            .select("mission_slug,progress_count,completed_count")
            .eq("user_id", userId)
    ]);

    const progressBySlug = new Map(
        ((progressResult.data ?? []) as QueryRow[]).map((row) => [String(row.mission_slug), row])
    );

    return ((definitionsResult.data ?? []) as QueryRow[]).map((row) => {
        const progress = progressBySlug.get(String(row.slug));
        return {
            ...row,
            progress_count: Number(progress?.progress_count ?? 0),
            completed_count: Number(progress?.completed_count ?? 0)
        };
    });
}

export async function getAppProgression(): Promise<AppProgression> {
    const fallback: AppProgression = {
        overallScore: 0,
        tradeUnlockScore: 1000,
        tradeUnlocked: false,
        referralCode: null,
        qualifiedReferrals: 0,
        missions: []
    };
    const session = await getAuthenticatedSupabaseUser();
    if (!session) return fallback;

    await session.supabase.rpc("refresh_user_progression", {});
    const [summary, rows] = await Promise.all([
        loadProgressionSummary(session.supabase, session.user.id),
        loadMissionStatus(session.supabase, session.user.id)
    ]);
    const overallScore = Number(summary?.verified_overall_score ?? 0);
    const tradeUnlocked = Boolean(summary?.trade_unlocked_at);

    return {
        overallScore,
        tradeUnlockScore: Number(summary?.trade_unlock_score ?? 1000),
        tradeUnlocked,
        referralCode: summary?.referral_code ?? null,
        qualifiedReferrals: Number(summary?.qualified_referral_count ?? 0),
        missions: rows.map((row) => ({
            slug: row.slug,
            tier: row.tier,
            title: row.title,
            detail: row.detail,
            rewardCredits: Number(row.reward_credits ?? 0),
            targetCount: Number(row.target_count ?? 1),
            progressCount: Number(row.progress_count ?? 0),
            completedCount: Number(row.completed_count ?? 0),
            isRepeatable: Boolean(row.is_repeatable),
            isLocked: overallScore < Number(row.unlock_score_min ?? 0) || (Boolean(row.requires_trade_unlocked) && !tradeUnlocked)
        }))
    };
}

function sponsoredThumbnailUrl(path: string | null | undefined) {
    const trimmed = path?.trim();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
    if (!trimmed || !supabaseUrl) return null;
    return `${supabaseUrl}/storage/v1/object/public/sponsored-challenges/${trimmed.split("/").map(encodeURIComponent).join("/")}`;
}

async function safeRpcRows<T = QueryRow>(supabase: ReturnType<typeof createSupabaseServerClient>, name: string, params?: Record<string, unknown>): Promise<T[]> {
    if (!supabase) return [];
    const {data, error} = await supabase.rpc(name, params);
    if (error) return [];
    return Array.isArray(data) ? data as T[] : data ? [data as T] : [];
}

export async function getAppSponsoredCampaigns(): Promise<AppSponsoredCampaign[]> {
    const supabase = createSupabaseServerClient();
    if (!supabase) return [];

    const [campaignRows, participantRows] = await Promise.all([
        safeRpcRows<QueryRow>(supabase, "list_sponsored_campaigns", {p_country_code: null}),
        safeRpcRows<QueryRow>(supabase, "list_my_sponsored_campaigns")
    ]);

    const campaigns = campaignRows.length ? campaignRows : participantRows;
    const campaignIds = campaigns.map((row) => row.id ?? row.campaign_id).filter(Boolean);
    const [participantsResult, rewardsResult, cashRewards] = await Promise.all([
        supabase.from("campaign_participants")
            .select("campaign_id,status,progress_count,completed_at,rewarded_at")
            .in("campaign_id", campaignIds),
        supabase.from("campaign_rewards")
            .select("campaign_id,reward_type,achievement_definitions(title,detail)")
            .in("campaign_id", campaignIds),
        safeRpcRows<QueryRow>(supabase, "list_sponsored_campaign_cash_rewards", {p_campaign_ids: campaignIds})
    ]);

    const participantsByCampaign = new Map(
        ((participantsResult.data ?? []) as QueryRow[]).map((row) => [row.campaign_id, row])
    );
    const rewardsByCampaign = new Map(
        ((rewardsResult.data ?? []) as QueryRow[]).map((row) => [row.campaign_id, row])
    );
    const cashByCampaign = new Map(
        cashRewards.map((row) => [row.campaign_id, row])
    );

    return campaigns.map((row) => {
        const id = row.id ?? row.campaign_id;
        const participant = participantsByCampaign.get(id);
        const rewardRow = rewardsByCampaign.get(id);
        const achievement = rewardRow?.achievement_definitions && typeof rewardRow.achievement_definitions === "object"
            ? rewardRow.achievement_definitions as QueryRow
            : null;
        const cash = cashByCampaign.get(id);
        return {
            id,
            slug: row.slug ?? id,
            title: row.title ?? "Sponsored Challenge",
            publicSummary: row.public_summary ?? "",
            description: row.description ?? "",
            presenterName: row.presenter_name ?? null,
            sponsorOrganizationId: row.sponsor_organization_id ?? null,
            status: row.status ?? "live",
            startsAt: row.starts_at ?? "",
            endsAt: row.ends_at ?? "",
            timezoneIdentifier: row.timezone_identifier ?? "UTC",
            objectiveType: row.objective_type ?? "eligible_capture_count",
            targetCount: Number(row.target_count ?? 0),
            requiredTypeTag: row.required_type_tag ?? null,
            requiredSettingTag: row.required_setting_tag ?? null,
            minimumCaptureGrade: row.minimum_capture_grade == null ? null : Number(row.minimum_capture_grade),
            liveOnly: Boolean(row.live_only),
            externalImportsAllowed: Boolean(row.external_imports_allowed),
            rulesVersion: Number(row.rules_version ?? 1),
            officialRules: row.official_rules ?? "",
            rewardTerms: row.reward_terms ?? "",
            thumbnailUrl: sponsoredThumbnailUrl(row.thumbnail_storage_path),
            thumbnailAltText: row.thumbnail_alt_text ?? null,
            participant: participant ? {
                status: participant.status ?? "joined",
                progressCount: Number(participant.progress_count ?? 0),
                completedAt: participant.completed_at ?? null,
                rewardedAt: participant.rewarded_at ?? null
            } : null,
            reward: achievement ? {
                title: achievement.title ?? "Achievement",
                detail: achievement.detail ?? null
            } : null,
            cashReward: cash ? {
                amountMinor: Number(cash.amount_minor ?? 0),
                currencyCode: cash.currency_code ?? "USD",
                remainingRecipients: Number(cash.remaining_recipients ?? 0)
            } : null
        };
    });
}

function mapAppNotificationRows(rows: QueryRow[]): AppNotification[] {
    return rows.map((row) => ({
        id: row.id,
        captureId: row.capture_id ?? null,
        actorUserId: row.actor_user_id ?? null,
        actorDisplayName: row.actor_display_name ?? null,
        actorUsername: row.actor_username ?? null,
        tradeOfferId: row.trade_offer_id ?? null,
        creditOfferId: row.credit_offer_id ?? null,
        comparisonSlug: row.comparison_slug ?? null,
        campaignId: row.campaign_id ?? null,
        challengeId: row.challenge_id ?? null,
        eventType: row.event_type,
        likeCount: row.like_count ?? null,
        endorsedStat: row.endorsed_stat ?? null,
        giftSlug: row.gift_slug ?? null,
        subjectAnimalName: row.subject_animal_name ?? null,
        subjectAnimalDexNumber: row.subject_animaldex_number == null ? null : Number(row.subject_animaldex_number),
        sourceKey: row.source_key ?? null,
        serverTitle: row.title ?? null,
        serverBody: row.body ?? null,
        createdAt: row.created_at,
        readAt: row.read_at ?? null
    }));
}

export async function getAppNotifications(limit = 40): Promise<AppNotification[]> {
    const supabase = createSupabaseServerClient();
    if (!supabase) return [];
    const fullSelect = "id,capture_id,actor_user_id,actor_display_name,actor_username,trade_offer_id,credit_offer_id,comparison_slug,campaign_id,challenge_id,event_type,like_count,endorsed_stat,gift_slug,subject_animal_name,subject_animaldex_number,source_key,title,body,created_at,read_at";
    const fallbackSelect = "id,capture_id,trade_offer_id,credit_offer_id,event_type,like_count,endorsed_stat,created_at,read_at";
    const result = await supabase.from("user_notifications")
        .select(fullSelect)
        .order("created_at", {ascending: false}).limit(limit);
    const {data} = result.error
        ? await supabase.from("user_notifications").select(fallbackSelect).order("created_at", {ascending: false}).limit(limit)
        : result;
    return mapAppNotificationRows((data ?? []) as QueryRow[]);
}

export async function getAppDiscoverFeed(limit = 18): Promise<AppDiscoverItem[]> {
    const supabase = createSupabaseServerClient();
    if (!supabase) return [];
    const {data} = await supabase.from("discover_feed_v1")
        .select("capture_id,user_id,animal_name,normalized_identity_key,score,capture_created_at,human_context,zoo_or_wild,location_display_label,profile_display_name,profile_username")
        .order("capture_created_at", {ascending: false}).limit(limit);
    return ((data ?? []) as QueryRow[]).map((row) => {
        const slug = row.normalized_identity_key?.trim() || null;
        const species = slug ? getSpeciesBySlug(slug) : null;
        return {
            captureId: row.capture_id,
            animalName: row.animal_name || "Animal",
            speciesSlug: slug,
            score: Number(row.score ?? 0),
            createdAt: row.capture_created_at ?? null,
            contextLabel: row.zoo_or_wild && row.zoo_or_wild !== "Unknown" ? row.zoo_or_wild : row.human_context ?? null,
            locationLabel: row.location_display_label ?? null,
            collectorName: row.profile_display_name || (row.profile_username ? `@${row.profile_username}` : "AnimalDex collector"),
            collectorUsername: row.profile_username?.trim() ?? null,
            ownerUserId: row.user_id,
            likeCount: 0,
            href: species ? `/animals/${species.slug}` : "/animals",
            imageSrc: species ? getSpeciesImageRoute(species.slug, row.capture_id) : "/images/placeholders/species-no-image.svg"
        };
    });
}

export async function getAppCaptureDetail(id: string): Promise<AppCaptureDetail | null> {
    const supabase = createSupabaseServerClient();
    if (!supabase) return null;
    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return null;
    const [captureResult, comparisonResult, progressionResult] = await Promise.all([
        supabase.from("captures")
            .select("id,status,created_at,location_display_label,location_lat,location_lng,challenge_health,challenge_stake,is_challenge_ready,is_discoverable,dominance_boost,speed_boost,intelligence_boost,dominance_endorsements,speed_endorsements,size_endorsements,intelligence_endorsements,rarity_endorsements,analysis_results(animal_name,scientific_name,normalized_identity_key,breed_guess,breed_confidence,human_context,zoo_or_wild,conservation_tier,confidence,type_tags,game_stats,premium_details,signals,observed_market_modifiers,raw_json,error_message,completed_at)")
            .eq("id", id)
            .eq("user_id", user.id)
            .maybeSingle(),
        supabase.from("capture_comparison_stat_boost_totals_v1")
            .select("capture_id,comparison_dominance_boost,comparison_speed_boost,comparison_size_boost,comparison_intelligence_boost,comparison_rarity_boost")
            .eq("capture_id", id)
            .maybeSingle(),
        supabase.from("capture_progression_totals_v1")
            .select("capture_id,total_progression_xp,recent_progression_source")
            .eq("capture_id", id)
            .maybeSingle()
    ]);
    const data = captureResult.data;
    if (!data) return null;
    const row = data as QueryRow;
    const comparison = (comparisonResult.data ?? {}) as QueryRow;
    const progression = (progressionResult.data ?? {}) as QueryRow;
    const analysis = Array.isArray(row.analysis_results) ? row.analysis_results[0] : row.analysis_results;
    if (!analysis || analysis.error_message || !analysis.completed_at) return null;
    const slug = analysis.normalized_identity_key ?? null;
    const species = slug ? getSpeciesBySlug(slug) : null;
    const storedStats = resolvedStoredGameStats(analysis);
    const hasChallengeGameStats = hasCanonicalGameStats(storedStats);
    const baseGameStats = canonicalGameStats(storedStats);
    const trainingBoosts: AppCaptureTrainingBoosts = {
        dominance: finiteInteger(row.dominance_boost),
        speed: finiteInteger(row.speed_boost),
        intelligence: finiteInteger(row.intelligence_boost)
    };
    const comparisonStatBoosts: AppCaptureGameStats = {
        dominance: finiteInteger(comparison.comparison_dominance_boost),
        speed: finiteInteger(comparison.comparison_speed_boost),
        size: finiteInteger(comparison.comparison_size_boost),
        intelligence: finiteInteger(comparison.comparison_intelligence_boost),
        rarity: finiteInteger(comparison.comparison_rarity_boost)
    };
    const endorsementBonuses: AppCaptureGameStats = {
        dominance: finiteInteger(row.dominance_endorsements),
        speed: finiteInteger(row.speed_endorsements),
        size: finiteInteger(row.size_endorsements),
        intelligence: finiteInteger(row.intelligence_endorsements),
        rarity: finiteInteger(row.rarity_endorsements)
    };
    const effectiveGameStats: AppCaptureGameStats = {
        dominance: clampGameStat(baseGameStats.dominance + trainingBoosts.dominance + comparisonStatBoosts.dominance + endorsementBonuses.dominance),
        speed: clampGameStat(baseGameStats.speed + trainingBoosts.speed + comparisonStatBoosts.speed + endorsementBonuses.speed),
        size: clampGameStat(baseGameStats.size + comparisonStatBoosts.size + endorsementBonuses.size),
        intelligence: clampGameStat(baseGameStats.intelligence + trainingBoosts.intelligence + comparisonStatBoosts.intelligence + endorsementBonuses.intelligence),
        rarity: clampGameStat(baseGameStats.rarity + comparisonStatBoosts.rarity + endorsementBonuses.rarity)
    };
    const statDeltas: AppCaptureGameStats = {
        dominance: effectiveGameStats.dominance - baseGameStats.dominance,
        speed: effectiveGameStats.speed - baseGameStats.speed,
        size: effectiveGameStats.size - baseGameStats.size,
        intelligence: effectiveGameStats.intelligence - baseGameStats.intelligence,
        rarity: effectiveGameStats.rarity - baseGameStats.rarity
    };
    const settingTag = normalizedOptionalString(analysis.zoo_or_wild);
    const humanContext = normalizedOptionalString(analysis.human_context);
    const rawAnimalName = normalizedOptionalString(analysis.animal_name);
    const animalName = rawAnimalName ?? "Animal";
    const hasKnownAnimal = rawAnimalName !== null && rawAnimalName.toLowerCase() !== "unknown animal";
    const captureValidity = resolvedAnalysisToken(analysis, "capture_validity")
        ?? (hasKnownAnimal ? "unclear_capture" : "no_animal_detected");
    const authenticityStatus = resolvedAnalysisToken(analysis, "authenticity_status");
    const signals = asQueryRow(analysis.signals);
    const settingToken = normalizedEligibilityToken(settingTag);
    const captureValidityToken = normalizedEligibilityToken(captureValidity);
    const authenticityToken = normalizedEligibilityToken(authenticityStatus);
    const isZooComparisonBanned = Boolean(
        settingToken?.includes("zoo")
        || signals?.zoo_context_likely === true
        || signals?.zooContextLikely === true
        || signals?.likely_near_zoo === true
    );
    const confidenceNumber = analysis.confidence == null || analysis.confidence === ""
        ? Number.NaN
        : Number(analysis.confidence);
    const confidence = Number.isFinite(confidenceNumber) ? confidenceNumber : null;
    const hasUncertaintyFallback = !hasKnownAnimal
        || looksLikeGarbageDescriptiveIdentity(animalName)
        || (confidence ?? 0) < 0.4;
    const isValidLiveCapture = captureValidityToken === "valid_live_capture"
        || captureValidityToken === "valid_live"
        || captureValidityToken === "live_capture";
    const isLikelyNonLiveSource = authenticityToken === "likely_non_live_source"
        || captureValidityToken === "likely_non_live_source";
    const isEligibleCapture = isValidLiveCapture || captureValidityToken === "unclear_capture";
    const isChallengeAnalysisEligible = isValidLiveCapture
        && !isLikelyNonLiveSource
        && !hasUncertaintyFallback
        && !isZooComparisonBanned;
    const gradeSource: CaptureGradeSource = {
        raw_json: analysis.raw_json ?? null,
        animal_name: analysis.animal_name ?? null,
        scientific_name: analysis.scientific_name ?? null,
        breed_guess: analysis.breed_guess ?? null,
        human_context: analysis.human_context ?? null,
        zoo_or_wild: analysis.zoo_or_wild ?? null,
        confidence: analysis.confidence ?? null,
        breed_confidence: analysis.breed_confidence ?? null,
        signals: analysis.signals ?? null,
        premium_details: analysis.premium_details ?? null,
        observed_market_modifiers: analysis.observed_market_modifiers ?? null,
        dominance_endorsements: row.dominance_endorsements ?? null,
        speed_endorsements: row.speed_endorsements ?? null,
        size_endorsements: row.size_endorsements ?? null,
        intelligence_endorsements: row.intelligence_endorsements ?? null,
        rarity_endorsements: row.rarity_endorsements ?? null
    };
    const gradeBreakdown = computeCaptureGradeBreakdown(gradeSource);
    return {
        id: row.id,
        status: row.status,
        createdAt: row.created_at,
        locationLabel: row.location_display_label ?? null,
        locationLat: nullableFiniteNumber(row.location_lat),
        locationLng: nullableFiniteNumber(row.location_lng),
        animalName,
        scientificName: analysis.scientific_name ?? null,
        speciesSlug: slug,
        breed: analysis.breed_guess ?? null,
        context: settingTag && settingToken !== "unknown" ? settingTag : humanContext,
        conservationTier: analysis.conservation_tier ?? null,
        confidence,
        typeTags: Array.isArray(analysis.type_tags) ? analysis.type_tags : [],
        gameStats: baseGameStats,
        baseGameStats,
        effectiveGameStats,
        statDeltas,
        trainingBoosts,
        comparisonStatBoosts,
        endorsementBonuses,
        settingTag,
        humanContext,
        captureValidity,
        authenticityStatus,
        signals,
        premiumDetails: analysis.premium_details ?? null,
        imageSrc: species ? getSpeciesImageRoute(species.slug, id) : "/images/placeholders/species-no-image.svg",
        captureGrade: gradeBreakdown?.grade ?? null,
        gradeBreakdown,
        totalProgressionXP: Math.max(0, finiteInteger(progression.total_progression_xp)),
        challengeHealth: Math.min(3, Math.max(0, finiteInteger(row.challenge_health, 3))),
        challengeStake: Math.min(25, Math.max(5, finiteInteger(row.challenge_stake, 5))),
        isChallengeReady: row.is_challenge_ready === true,
        isDiscoverable: row.is_discoverable === true,
        recentProgressionSource: normalizedOptionalString(progression.recent_progression_source),
        hasChallengeGameStats,
        isZooComparisonBanned,
        isChallengeAnalysisEligible,
        isEligibleCapture,
        hasUncertaintyFallback
    };
}

export async function getAppTrades(limit = 40): Promise<AppTrade[]> {
    const supabase = createSupabaseServerClient();
    if (!supabase) return [];
    const {data} = await supabase.from("trade_offer_detail_v1")
        .select("id,offerer_user_id,receiver_user_id,offerer_capture_id,receiver_capture_id,offerer_trade_value,receiver_trade_value,status,created_at,expires_at,offerer_animal_name,receiver_animal_name")
        .order("created_at", {ascending: false}).limit(limit);
    return ((data ?? []) as QueryRow[]).map((row) => ({
        id: row.id,
        offererUserId: row.offerer_user_id,
        receiverUserId: row.receiver_user_id,
        offererCaptureId: row.offerer_capture_id,
        receiverCaptureId: row.receiver_capture_id,
        offererName: row.offerer_animal_name || "Animal",
        receiverName: row.receiver_animal_name || "Animal",
        offererValue: Number(row.offerer_trade_value ?? 0),
        receiverValue: Number(row.receiver_trade_value ?? 0),
        status: row.status,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
        offererSlug: speciesEntries.find((entry) => entry.name.toLowerCase() === String(row.offerer_animal_name || "").toLowerCase())?.slug ?? null,
        receiverSlug: speciesEntries.find((entry) => entry.name.toLowerCase() === String(row.receiver_animal_name || "").toLowerCase())?.slug ?? null
    }));
}

export async function getAppCreditOffers(limit = 40): Promise<AppCreditOffer[]> {
    const supabase = createSupabaseServerClient();
    if (!supabase) return [];
    const {data} = await supabase.from("capture_credit_offer_detail_v1")
        .select("id,bidder_user_id,target_owner_user_id,target_capture_id,amount,status,created_at,expires_at,target_animal_name,bidder_profile_display_name,owner_profile_display_name")
        .order("created_at", {ascending: false}).limit(limit);
    return ((data ?? []) as QueryRow[]).map((row) => ({
        id: row.id,
        bidderUserId: row.bidder_user_id,
        targetOwnerUserId: row.target_owner_user_id,
        targetCaptureId: row.target_capture_id,
        targetAnimalName: row.target_animal_name || "Animal",
        bidderName: row.bidder_profile_display_name || "Collector",
        ownerName: row.owner_profile_display_name || "Collector",
        amount: Number(row.amount ?? 0),
        status: row.status,
        createdAt: row.created_at,
        expiresAt: row.expires_at
    }));
}

export async function getAppAlbums(): Promise<AppAlbum[]> {
    const supabase = createSupabaseServerClient();
    if (!supabase) return [];
    const {data} = await supabase.from("albums").select("id,name,sort_order,album_items(capture_id,sort_order)").order("sort_order", {ascending: true});
    return ((data ?? []) as QueryRow[]).map((row) => ({
        id: row.id,
        name: row.name,
        captureIds: (row.album_items ?? []).sort((a: QueryRow, b: QueryRow) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0)).map((item: QueryRow) => item.capture_id)
    }));
}

export {getAppPowerSets} from "@/data/power-sets";

export async function getAppJournalEntries(limit = 20): Promise<AppJournalEntry[]> {
    const supabase = createSupabaseServerClient();
    if (!supabase) return [];
    const {data} = await supabase.from("daily_journal_logs")
        .select("id,log_date,user_problem,generated_insight,alignment_score,alignment_tier,completion_state")
        .order("log_date", {ascending: false}).limit(limit);
    return ((data ?? []) as QueryRow[]).map((row) => ({
        id: row.id,
        date: row.log_date,
        problem: row.user_problem,
        insight: row.generated_insight ?? null,
        score: row.alignment_score ?? null,
        tier: row.alignment_tier ?? null,
        state: row.completion_state
    }));
}
