import "server-only";

import {getCatalogBehaviorPrincipleIndex, getUnifiedSpeciesEntries, resolveCatalogBehaviorPrinciple} from "@/data/database-species-pages";
import {getLegendaryEarthBeast} from "@/data/legendary-earth-beasts";
import {fetchPowerSetCompletions} from "@/data/power-set-completions";
import {getAuthenticatedPublicProfileCard, resolveProfileSettingCounts, resolvePublicOverallScore, type PublicProfileCapture} from "@/data/public-profiles";
import {getBehavioralPrincipleProfile} from "@/data/species-behavioral-principles";
import {getSpeciesBySlug, speciesEntries, type SpeciesEntry} from "@/data/species";
import {getSpeciesImageRoute} from "@/data/species-images";
import {speciesSystemsIntelligence} from "@/data/species-systems-intelligence";
import {getAuthenticatedUserProfile, getUserCaptureSettingCounts, getUserCaptureStats, getUserCaptures, UserCaptureSummary} from "@/data/user-captures";
import {getAnimalDexNumberFromEntry} from "@/lib/animaldex-number";
import {collectionIdentityMatchKeys} from "@/lib/collection-identity-aliases";
import {createSupabaseServerClient} from "@/lib/supabase/server";

export type AppProfile = NonNullable<Awaited<ReturnType<typeof getAuthenticatedUserProfile>>>;

export type AppCapture = UserCaptureSummary & {
    scientificName: string | null;
    category: string | null;
    displayName: string;
    principle: string | null;
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

export type AppNotification = {
    id: string;
    captureId: string;
    tradeOfferId: string | null;
    creditOfferId: string | null;
    eventType: string;
    likeCount: number | null;
    endorsedStat: string | null;
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
        const staticMatch = findSpeciesForCaptureIdentity(identity);
        if (staticMatch) {
            return staticMatch;
        }

        const catalogMatch = catalog.find((entry) => speciesEntryMatchesIdentity(entry, identity));
        if (catalogMatch) {
            return catalogMatch;
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
        species.normalizedIdentityKey
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
    return {
        ...capture,
        scientificName: species?.analysis.scientificName ?? capture.scientificName ?? null,
        category: species?.analysis.category ?? null,
        displayName: species?.name ?? capture.animalName,
        principle,
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

export type AppCaptureDetail = {
    id: string;
    status: string;
    createdAt: string;
    locationLabel: string | null;
    animalName: string;
    scientificName: string | null;
    speciesSlug: string | null;
    breed: string | null;
    context: string | null;
    conservationTier: string | null;
    confidence: number | null;
    typeTags: string[];
    gameStats: Record<string, number>;
    premiumDetails: Record<string, any> | null;
    imageSrc: string;
};

type QueryRow = Record<string, any>;

async function getAuthenticatedSupabaseUser() {
    const supabase = createSupabaseServerClient();
    if (!supabase) return null;

    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return null;

    return {supabase, user};
}

export function mapPublicProfileCaptureToAppCapture(capture: PublicProfileCapture): AppCapture {
    return {
        captureId: capture.id,
        animalName: capture.animalName,
        scientificName: null,
        speciesSlug: capture.speciesSlug,
        speciesProfileId: null,
        confidence: null,
        score: capture.score,
        captureValidity: null,
        learnedScenarioTags: [],
        capturedAt: capture.capturedAt,
        imageBucket: null,
        imagePath: null,
        contextLabel: capture.contextLabel,
        locationDisplayLabel: null,
        displayName: capture.animalName,
        category: null,
        principle: null,
        indexNumber: null,
        href: capture.href,
        imageSrc: capture.imageSrc
    };
}

export function decorateCapture(capture: UserCaptureSummary): AppCapture {
    const species = findSpeciesForCaptureIdentity(capture.speciesSlug);
    const principle = resolveCapturePrinciple(species, {byProfileId: new Map(), byIdentityKey: new Map()});
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

export async function getAppCreditBalance() {
    const supabase = createSupabaseServerClient();
    if (!supabase) return null;

    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return null;

    const {data} = await supabase
        .from("credit_balances")
        .select("balance")
        .eq("user_id", user.id)
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
        domestic: 0
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
            domestic: stats.domestic
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
        domestic: Number(row.domestic_captures ?? 0)
    };
}

export async function getAppProfileSettingCounts() {
    const [summary, captureSettings] = await Promise.all([
        getAppProfileSummary(),
        getUserCaptureSettingCounts()
    ]);

    return resolveProfileSettingCounts(
        {wild: summary.wild, zoo: summary.zoo, domestic: summary.domestic},
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

export async function getAppNotifications(limit = 40): Promise<AppNotification[]> {
    const supabase = createSupabaseServerClient();
    if (!supabase) return [];
    const {data} = await supabase.from("user_notifications")
        .select("id,capture_id,trade_offer_id,credit_offer_id,event_type,like_count,endorsed_stat,created_at,read_at")
        .order("created_at", {ascending: false}).limit(limit);
    return ((data ?? []) as QueryRow[]).map((row) => ({
        id: row.id,
        captureId: row.capture_id,
        tradeOfferId: row.trade_offer_id ?? null,
        creditOfferId: row.credit_offer_id ?? null,
        eventType: row.event_type,
        likeCount: row.like_count ?? null,
        endorsedStat: row.endorsed_stat ?? null,
        createdAt: row.created_at,
        readAt: row.read_at ?? null
    }));
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
    const {data} = await supabase.from("captures")
        .select("id,status,created_at,location_display_label,analysis_results(animal_name,scientific_name,normalized_identity_key,breed_guess,human_context,zoo_or_wild,conservation_tier,confidence,type_tags,game_stats,premium_details,error_message,completed_at)")
        .eq("id", id).eq("user_id", user.id).maybeSingle();
    if (!data) return null;
    const row = data as QueryRow;
    const analysis = Array.isArray(row.analysis_results) ? row.analysis_results[0] : row.analysis_results;
    if (!analysis || analysis.error_message || !analysis.completed_at) return null;
    const slug = analysis.normalized_identity_key ?? null;
    const species = slug ? getSpeciesBySlug(slug) : null;
    const stats = analysis.game_stats && typeof analysis.game_stats === "object" ? analysis.game_stats : {};
    return {
        id: row.id,
        status: row.status,
        createdAt: row.created_at,
        locationLabel: row.location_display_label ?? null,
        animalName: analysis.animal_name || "Animal",
        scientificName: analysis.scientific_name ?? null,
        speciesSlug: slug,
        breed: analysis.breed_guess ?? null,
        context: analysis.zoo_or_wild && analysis.zoo_or_wild !== "Unknown" ? analysis.zoo_or_wild : analysis.human_context ?? null,
        conservationTier: analysis.conservation_tier ?? null,
        confidence: analysis.confidence ?? null,
        typeTags: Array.isArray(analysis.type_tags) ? analysis.type_tags : [],
        gameStats: stats,
        premiumDetails: analysis.premium_details ?? null,
        imageSrc: species ? getSpeciesImageRoute(species.slug, id) : "/images/placeholders/species-no-image.svg"
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
