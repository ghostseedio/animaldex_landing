import "server-only";

import {
    apexQualityKey,
    buildApexChallengeRequest,
    evaluateApexGrowth,
    type ApexGrowthCaptureCandidate,
    type ApexGrowthMatch,
    type WildProfileApexProgress
} from "@/data/apex-growth";
import type {ResolvedSpeciesBehaviorProfile} from "@/data/species-behavior-lessons";
import {resolveSpeciesBehaviorProfile} from "@/data/species-behavior-lessons";
import type {SpeciesEntry} from "@/data/species";
import {getSpeciesImageRoute} from "@/data/species-images";
import {getAuthenticatedUserId, getUserCaptures, getUserCapturesForSpecies, type UserCaptureSummary} from "@/data/user-captures";
import {createSupabaseServerClient} from "@/lib/supabase/server";

export type CaptureLearnedSubPrinciple = {
    id: string;
    learnedSubPrincipleName: string;
    learnedSubPrincipleExpression: string;
    scenarioTags: string[];
    statBoostSummary: string;
    sourceDisplayName: string | null;
    isEquipped: boolean;
};

export type FusionDonorCapture = {
    captureId: string;
    animalName: string;
    speciesSlug: string | null;
    speciesProfileId: string | null;
    challengeHealth: number;
    imageSrc: string;
    principleName: string | null;
    principleExpression: string | null;
};

export type ApexGrowthChallengeSummary = {
    id: string;
    status: string;
    challengeTitle: string;
    challengeInstruction: string;
    whyThisHelps: string | null;
    proofPrompt: string;
    targetQualityTag: string;
    rewardXP: number;
    rewardStat: string | null;
    proofValidationReason: string | null;
    qualityProgressAward: number;
    captureXPAward: number;
};

export type CaptureComparisonState = {
    captureId: string;
    challengeHealth: number;
    isChallengeReady: boolean;
    challengeStake: number;
    isDiscoverable: boolean;
    isOwnedByCurrentUser: boolean;
};

import type {CaptureProgressState} from "@/data/species-growth-types";

export type {CaptureProgressState};

export type SpeciesGrowthContext = {
    isAuthenticated: boolean;
    hasCapture: boolean;
    speciesCaptures: UserCaptureSummary[];
    primaryCaptureId: string | null;
    primaryCaptureImageSrc: string | null;
    principle: ResolvedSpeciesBehaviorProfile | null;
    wildProfile: WildProfileApexProgress | null;
    hasWildProfile: boolean;
    wildProfileHref: string;
    match: ApexGrowthMatch | null;
    challenge: ApexGrowthChallengeSummary | null;
    learnedPrinciples: CaptureLearnedSubPrinciple[];
    learnedPrincipleCount: number;
    fusionDonors: FusionDonorCapture[];
    fusionCost: number;
    creditBalance: number | null;
    comparison: CaptureComparisonState | null;
    progress: CaptureProgressState | null;
    challengeRequest: {
        capture_id: string;
        wild_profile_id: string;
        target_quality_tag: string;
        matched_quality_tags: string[];
    } | null;
};

type QueryRow = Record<string, any>;

function clean(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}

function parseStringArray(value: unknown) {
    if (!Array.isArray(value)) {
        return [] as string[];
    }

    return value.map((item) => clean(item)).filter(Boolean);
}

function statTitle(stat: string | null) {
    if (!stat) {
        return null;
    }

    return stat.charAt(0).toUpperCase() + stat.slice(1);
}

function statBoostSummary(
    primaryStat: string | null,
    secondaryStat: string | null,
    primaryBoost: number,
    secondaryBoost: number
) {
    const lines = [
        primaryStat && primaryBoost > 0 ? `+${primaryBoost} ${statTitle(primaryStat)}` : null,
        secondaryStat && secondaryBoost > 0 ? `+${secondaryBoost} ${statTitle(secondaryStat)}` : null
    ].filter(Boolean);

    return lines.length > 0 ? lines.join(" · ") : "Scenario fit only";
}

function fusionTeacherKey(capture: {
    speciesProfileId: string | null;
    speciesSlug: string | null;
    animalName: string;
}) {
    if (capture.speciesProfileId) {
        return `profile:${capture.speciesProfileId.toLowerCase()}`;
    }

    if (capture.speciesSlug) {
        return `identity:${capture.speciesSlug.toLowerCase()}`;
    }

    return `name:${capture.animalName.trim().toLowerCase()}`;
}

function fusionCost(learnedCount: number) {
    const exponent = Math.min(learnedCount + 1, 5);

    return Math.min(2 ** exponent, 32);
}

async function fetchWildProfileApexProgress(userId: string): Promise<WildProfileApexProgress | null> {
    const supabase = createSupabaseServerClient();

    if (!supabase) {
        return null;
    }

    const {data} = await supabase
        .from("user_identity_profiles")
        .select("id,public_summary")
        .eq("user_id", userId)
        .eq("status", "active")
        .order("generated_at", {ascending: false})
        .limit(1)
        .maybeSingle();

    if (!data?.id) {
        return null;
    }

    const summary = data.public_summary;

    if (!summary || typeof summary !== "object") {
        return {
            profileId: String(data.id),
            apexAnimalName: null,
            targets: []
        };
    }

    const reports = [
        (summary as Record<string, unknown>).active,
        (summary as Record<string, unknown>).apex
    ];

    for (const report of reports) {
        if (!report || typeof report !== "object") {
            continue;
        }

        const progress = (report as Record<string, unknown>).apex_quality_progress;

        if (!progress || typeof progress !== "object") {
            continue;
        }

        const rawTargets = (progress as Record<string, unknown>).targets;

        if (!Array.isArray(rawTargets) || rawTargets.length === 0) {
            continue;
        }

        const targets = rawTargets
            .map((target) => {
                if (!target || typeof target !== "object") {
                    return null;
                }

                const record = target as Record<string, unknown>;
                const label = clean(record.quality) || clean(record.tag_key) || clean(record.tag_label);
                const key = apexQualityKey(clean(record.tag_key) || label);

                if (!key || !label) {
                    return null;
                }

                return {
                    key,
                    label,
                    currentScore: Number(record.current_score ?? 0),
                    targetScore: Number(record.target_score ?? 0),
                    remaining: Number(record.remaining ?? 0)
                };
            })
            .filter((target): target is NonNullable<typeof target> => Boolean(target));

        return {
            profileId: String(data.id),
            apexAnimalName: clean((progress as Record<string, unknown>).animal) || clean(rawTargets[0]?.animal) || null,
            targets
        };
    }

    return {
        profileId: String(data.id),
        apexAnimalName: null,
        targets: []
    };
}

async function fetchCaptureGrowthDetails(captureId: string, userId: string) {
    const supabase = createSupabaseServerClient();

    if (!supabase) {
        return null;
    }

    const [{data: captureRow}, {data: analysisRow}, {data: learnedRows}, {data: lastChallenge}, {data: progressionRow}] = await Promise.all([
        supabase
            .from("captures")
            .select("id,user_id,challenge_health,is_challenge_ready,challenge_stake,is_discoverable,dominance_endorsements,speed_endorsements,size_endorsements,intelligence_endorsements,rarity_endorsements")
            .eq("id", captureId)
            .maybeSingle(),
        supabase
            .from("analysis_results")
            .select("species_profile_id,game_stats")
            .eq("capture_id", captureId)
            .maybeSingle(),
        supabase
            .from("capture_learned_sub_principles")
            .select("id,learned_sub_principle_name,learned_sub_principle_expression,scenario_tags,primary_stat,secondary_stat,stat_boost_primary,stat_boost_secondary,is_equipped,source_species_display_name,source_animal_name,source_breed_guess")
            .eq("capture_id", captureId)
            .order("created_at", {ascending: false}),
        supabase
            .from("apex_growth_challenges")
            .select("id,status,challenge_title,challenge_instruction,why_this_helps,proof_prompt,target_quality_tag,reward_xp,reward_stat,proof_validation_reason,quality_progress_award,capture_xp_award")
            .eq("capture_id", captureId)
            .eq("source", "animal_card")
            .in("status", ["generated", "accepted", "proof_submitted", "approved", "rejected"])
            .order("created_at", {ascending: false})
            .limit(1)
            .maybeSingle(),
        supabase
            .from("capture_progression_totals_v1")
            .select("total_progression_xp")
            .eq("capture_id", captureId)
            .maybeSingle()
    ]);

    if (!captureRow) {
        return null;
    }

    const gameStats = analysisRow?.game_stats && typeof analysisRow.game_stats === "object"
        ? analysisRow.game_stats as Record<string, unknown>
        : {};

    const learnedPrinciples = ((learnedRows ?? []) as QueryRow[]).map((row) => ({
        id: String(row.id),
        learnedSubPrincipleName: clean(row.learned_sub_principle_name),
        learnedSubPrincipleExpression: clean(row.learned_sub_principle_expression),
        scenarioTags: parseStringArray(row.scenario_tags),
        statBoostSummary: statBoostSummary(
            clean(row.primary_stat) || null,
            clean(row.secondary_stat) || null,
            Number(row.stat_boost_primary ?? 0),
            Number(row.stat_boost_secondary ?? 0)
        ),
        sourceDisplayName: clean(row.source_breed_guess)
            || clean(row.source_species_display_name)
            || clean(row.source_animal_name)
            || null,
        isEquipped: row.is_equipped !== false
    }));

    const challenge = lastChallenge ? {
        id: String(lastChallenge.id),
        status: clean(lastChallenge.status),
        challengeTitle: clean(lastChallenge.challenge_title),
        challengeInstruction: clean(lastChallenge.challenge_instruction),
        whyThisHelps: clean(lastChallenge.why_this_helps) || null,
        proofPrompt: clean(lastChallenge.proof_prompt),
        targetQualityTag: clean(lastChallenge.target_quality_tag),
        rewardXP: Number(lastChallenge.reward_xp ?? 0),
        rewardStat: clean(lastChallenge.reward_stat) || null,
        proofValidationReason: clean(lastChallenge.proof_validation_reason) || null,
        qualityProgressAward: Number(lastChallenge.quality_progress_award ?? 0),
        captureXPAward: Number(lastChallenge.capture_xp_award ?? 0)
    } satisfies ApexGrowthChallengeSummary : null;

    return {
        captureId: String(captureRow.id),
        speciesProfileId: clean(analysisRow?.species_profile_id) || null,
        challengeHealth: Number(captureRow.challenge_health ?? 3),
        isChallengeReady: captureRow.is_challenge_ready !== false,
        rarity: Number(gameStats.rarity ?? gameStats.Rarity ?? 50),
        level: Number(gameStats.level ?? gameStats.Level ?? 1),
        learnedPrinciples,
        challenge,
        comparison: comparisonStateFromRow(captureRow, userId),
        progress: progressStateFromRow({...captureRow, total_progression_xp: progressionRow?.total_progression_xp}, userId),
        lastGrowthUseAt: null as string | null
    };
}

async function fetchDonorPrinciples(speciesProfileIds: string[]) {
    const supabase = createSupabaseServerClient();

    if (!supabase || speciesProfileIds.length === 0) {
        return new Map<string, {name: string; expression: string | null}>();
    }

    const {data} = await supabase
        .from("species_behavior_principles")
        .select("species_profile_id,principle_name,principle_expression")
        .in("species_profile_id", speciesProfileIds);

    return new Map(
        ((data ?? []) as QueryRow[])
            .map((row) => [String(row.species_profile_id), {
                name: clean(row.principle_name),
                expression: clean(row.principle_expression) || null
            }] as const)
            .filter(([, principle]) => Boolean(principle.name))
    );
}

async function fetchCaptureEligibility(captureIds: string[]) {
    const supabase = createSupabaseServerClient();
    const map = new Map<string, {speciesProfileId: string | null; challengeHealth: number}>();

    if (!supabase || captureIds.length === 0) {
        return map;
    }

    const [{data: captureRows}, {data: analysisRows}] = await Promise.all([
        supabase
            .from("captures")
            .select("id,challenge_health")
            .in("id", captureIds),
        supabase
            .from("analysis_results")
            .select("capture_id,species_profile_id")
            .in("capture_id", captureIds)
    ]);

    const analysisByCapture = new Map(
        ((analysisRows ?? []) as QueryRow[]).map((row) => [String(row.capture_id), clean(row.species_profile_id) || null])
    );

    for (const row of (captureRows ?? []) as QueryRow[]) {
        map.set(String(row.id), {
            speciesProfileId: analysisByCapture.get(String(row.id)) ?? null,
            challengeHealth: Number(row.challenge_health ?? 0)
        });
    }

    return map;
}

function buildGrowthCandidate(
    capture: UserCaptureSummary,
    principle: ResolvedSpeciesBehaviorProfile,
    details: NonNullable<Awaited<ReturnType<typeof fetchCaptureGrowthDetails>>>
): ApexGrowthCaptureCandidate {
    const powerText = [
        principle.principle,
        principle.principleExpression,
        principle.coreLesson,
        principle.biologicalBasis,
        principle.motto
    ].filter(Boolean).join(" ");

    return {
        captureId: capture.captureId,
        displayName: capture.animalName,
        animalPowerName: principle.principle,
        animalPowerText: powerText,
        bestForUses: principle.bestFor,
        level: details.level,
        rarity: details.rarity,
        lastGrowthUseAt: details.lastGrowthUseAt
    };
}

function buildPublicGrowthCandidate(
    entry: SpeciesEntry,
    principle: ResolvedSpeciesBehaviorProfile
): ApexGrowthCaptureCandidate {
    const powerText = [
        principle.principle,
        principle.principleExpression,
        principle.coreLesson,
        principle.biologicalBasis,
        principle.motto
    ].filter(Boolean).join(" ");

    return {
        // Public species pages do not represent an owned capture. This stable local
        // identifier lets the shared Apex evaluator describe the power without
        // making the species eligible for a challenge.
        captureId: `species:${entry.slug}`,
        displayName: entry.name,
        animalPowerName: principle.principle,
        animalPowerText: powerText,
        bestForUses: principle.bestFor,
        level: 0,
        rarity: entry.analysis.rarityScore,
        lastGrowthUseAt: null
    };
}

function comparisonStateFromRow(row: QueryRow, userId: string | null): CaptureComparisonState {
    return {
        captureId: String(row.id),
        challengeHealth: Math.min(3, Math.max(0, Number(row.challenge_health ?? 3))),
        isChallengeReady: row.is_challenge_ready === true,
        challengeStake: Math.min(100, Math.max(2, Number(row.challenge_stake ?? 2))),
        isDiscoverable: row.is_discoverable === true,
        isOwnedByCurrentUser: Boolean(userId && String(row.user_id) === userId)
    };
}

function progressStateFromRow(row: QueryRow, userId: string | null, viewerEndorsementStat: string | null = null): CaptureProgressState {
    return {
        captureId: String(row.id),
        totalProgressionXP: Math.max(0, Number(row.total_progression_xp ?? 0)),
        endorsementCount: [
            row.dominance_endorsements,
            row.speed_endorsements,
            row.size_endorsements,
            row.intelligence_endorsements,
            row.rarity_endorsements
        ].reduce((total, value) => total + Math.max(0, Number(value ?? 0)), 0),
        viewerEndorsementStat,
        isOwnedByCurrentUser: Boolean(userId && String(row.user_id) === userId)
    };
}

async function fetchPublicComparisonState(captureId: string | null, userId: string | null) {
    if (!captureId) {
        return null;
    }

    const supabase = createSupabaseServerClient();

    if (!supabase) {
        return null;
    }

    const {data} = await supabase
        .from("captures")
        .select("id,user_id,challenge_health,is_challenge_ready,challenge_stake,is_discoverable")
        .eq("id", captureId)
        .eq("is_discoverable", true)
        .maybeSingle();

    return data ? comparisonStateFromRow(data, userId) : null;
}

async function fetchPublicProgressState(captureId: string | null, userId: string | null) {
    if (!captureId) {
        return null;
    }

    const supabase = createSupabaseServerClient();

    if (!supabase) {
        return null;
    }

    const [{data: capture}, {data: progression}, endorsementResult] = await Promise.all([
        supabase
            .from("captures")
            .select("id,user_id,dominance_endorsements,speed_endorsements,size_endorsements,intelligence_endorsements,rarity_endorsements")
            .eq("id", captureId)
            .eq("is_discoverable", true)
            .maybeSingle(),
        supabase
            .from("capture_progression_totals_v1")
            .select("total_progression_xp")
            .eq("capture_id", captureId)
            .maybeSingle(),
        userId
            ? supabase.from("capture_endorsements").select("endorsed_stat").eq("capture_id", captureId).eq("user_id", userId).maybeSingle()
            : Promise.resolve({data: null})
    ]);

    if (!capture) {
        return null;
    }

    return progressStateFromRow({...capture, total_progression_xp: progression?.total_progression_xp}, userId, clean(endorsementResult.data?.endorsed_stat) || null);
}

async function buildFusionDonors(
    allCaptures: UserCaptureSummary[],
    receiverCaptureId: string,
    speciesSlug: string
) {
    const otherCaptures = allCaptures.filter((capture) => capture.captureId !== receiverCaptureId);
    const eligibility = await fetchCaptureEligibility(otherCaptures.map((capture) => capture.captureId));
    const seen = new Set<string>();
    const donors: FusionDonorCapture[] = [];

    for (const capture of otherCaptures) {
        const meta = eligibility.get(capture.captureId);

        if (!meta?.speciesProfileId || meta.challengeHealth <= 0) {
            continue;
        }

        const teacherKey = fusionTeacherKey({
            speciesProfileId: meta.speciesProfileId,
            speciesSlug: capture.speciesSlug,
            animalName: capture.animalName
        });

        if (seen.has(teacherKey)) {
            continue;
        }

        seen.add(teacherKey);
        donors.push({
            captureId: capture.captureId,
            animalName: capture.animalName,
            speciesSlug: capture.speciesSlug,
            speciesProfileId: meta.speciesProfileId,
            challengeHealth: meta.challengeHealth,
            imageSrc: getSpeciesImageRoute(capture.speciesSlug?.replace(/_/g, "-") ?? speciesSlug, capture.captureId),
            principleName: null,
            principleExpression: null
        });
    }

    donors.sort((left, right) => {
        if (left.challengeHealth !== right.challengeHealth) {
            return right.challengeHealth - left.challengeHealth;
        }

        return left.animalName.localeCompare(right.animalName);
    });

    const principleMap = await fetchDonorPrinciples(
        donors.map((donor) => donor.speciesProfileId).filter((value): value is string => Boolean(value))
    );

    return donors.map((donor) => ({
        ...donor,
        principleName: donor.speciesProfileId ? principleMap.get(donor.speciesProfileId)?.name ?? null : null,
        principleExpression: donor.speciesProfileId ? principleMap.get(donor.speciesProfileId)?.expression ?? null : null
    }));
}

async function fetchCreditBalance(userId: string) {
    const supabase = createSupabaseServerClient();

    if (!supabase) {
        return null;
    }

    const {data} = await supabase
        .from("credit_balances")
        .select("balance")
        .eq("user_id", userId)
        .maybeSingle();

    return data?.balance == null ? null : Number(data.balance);
}

function canGenerateApexChallenge(match: ApexGrowthMatch | null) {
    return match?.strength === "strong" || match?.strength === "partial";
}

export async function getSpeciesGrowthContext(entry: SpeciesEntry, publicCaptureId: string | null = null): Promise<SpeciesGrowthContext> {
    const userId = await getAuthenticatedUserId();
    const empty: SpeciesGrowthContext = {
        isAuthenticated: Boolean(userId),
        hasCapture: false,
        speciesCaptures: [],
        primaryCaptureId: null,
        primaryCaptureImageSrc: null,
        principle: null,
        wildProfile: null,
        hasWildProfile: false,
        wildProfileHref: "/app/train/wild-profile",
        match: null,
        challenge: null,
        learnedPrinciples: [],
        learnedPrincipleCount: 0,
        fusionDonors: [],
        fusionCost: 2,
        creditBalance: null,
        comparison: null,
        progress: null,
        challengeRequest: null
    };

    const [principle, speciesCaptures] = await Promise.all([
        resolveSpeciesBehaviorProfile(entry.slug),
        userId ? getUserCapturesForSpecies(entry) : Promise.resolve([])
    ]);

    if (!userId) {
        const [comparison, progress] = await Promise.all([
            fetchPublicComparisonState(publicCaptureId, null),
            fetchPublicProgressState(publicCaptureId, null)
        ]);
        return {
            ...empty,
            principle,
            match: principle
                ? evaluateApexGrowth(null, buildPublicGrowthCandidate(entry, principle))
                : null,
            comparison,
            progress
        };
    }

    const requestedOwnedCapture = publicCaptureId
        ? speciesCaptures.find((capture) => capture.captureId === publicCaptureId) ?? null
        : null;

    // A species page can display somebody else's featured card even when the
    // viewer owns the same species. Keep all detail state scoped to the card
    // being viewed; never silently substitute the viewer's newest capture.
    if (speciesCaptures.length === 0 || (publicCaptureId && !requestedOwnedCapture)) {
        const [wildProfile, comparison, progress, creditBalance] = await Promise.all([
            fetchWildProfileApexProgress(userId),
            fetchPublicComparisonState(publicCaptureId, userId),
            fetchPublicProgressState(publicCaptureId, userId),
            fetchCreditBalance(userId)
        ]);

        return {
            ...empty,
            principle,
            wildProfile,
            hasWildProfile: Boolean(wildProfile && wildProfile.targets.length > 0),
            match: principle
                ? evaluateApexGrowth(wildProfile, buildPublicGrowthCandidate(entry, principle))
                : null,
            creditBalance,
            comparison,
            progress
        };
    }

    const primaryCapture = requestedOwnedCapture ?? speciesCaptures[0];
    const [wildProfile, growthDetails, allCaptures, creditBalance] = await Promise.all([
        fetchWildProfileApexProgress(userId),
        fetchCaptureGrowthDetails(primaryCapture.captureId, userId),
        getUserCaptures(160),
        fetchCreditBalance(userId)
    ]);

    if (!growthDetails || !principle) {
        return {
            ...empty,
            hasCapture: true,
            speciesCaptures,
            primaryCaptureId: primaryCapture.captureId,
            primaryCaptureImageSrc: getSpeciesImageRoute(entry.slug, primaryCapture.captureId),
            principle,
            wildProfile,
            hasWildProfile: Boolean(wildProfile && wildProfile.targets.length > 0),
            creditBalance
        };
    }

    const candidate = buildGrowthCandidate(primaryCapture, principle, growthDetails);
    const match = evaluateApexGrowth(wildProfile, candidate);
    const fusionDonors = await buildFusionDonors(allCaptures, primaryCapture.captureId, entry.slug);
    const equippedPrinciples = growthDetails.learnedPrinciples.filter((principleItem) => principleItem.isEquipped);
    const challengeRequest = canGenerateApexChallenge(match) && wildProfile
        ? buildApexChallengeRequest(match, primaryCapture.captureId, wildProfile.profileId)
        : null;

    return {
        isAuthenticated: true,
        hasCapture: true,
        speciesCaptures,
        primaryCaptureId: primaryCapture.captureId,
        primaryCaptureImageSrc: getSpeciesImageRoute(entry.slug, primaryCapture.captureId),
        principle,
        wildProfile,
        hasWildProfile: Boolean(wildProfile && wildProfile.targets.length > 0),
        wildProfileHref: "/app/train/wild-profile",
        match,
        challenge: growthDetails.challenge,
        learnedPrinciples: equippedPrinciples,
        learnedPrincipleCount: growthDetails.learnedPrinciples.length,
        fusionDonors,
        fusionCost: fusionCost(growthDetails.learnedPrinciples.length),
        creditBalance,
        comparison: growthDetails.comparison,
        progress: growthDetails.progress,
        challengeRequest
    };
}
