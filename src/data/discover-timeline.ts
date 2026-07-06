import "server-only";

import {getSpeciesBySlug} from "@/data/species";
import {getSpeciesImageRoute} from "@/data/species-images";
import {getAnimalDexNumberFromEntry} from "@/lib/animaldex-number";
import {createSupabaseServerClient} from "@/lib/supabase/server";

type QueryRow = Record<string, unknown>;

export type DiscoverCollectorRef = {
    userId: string;
    name: string;
    username: string | null;
    avatarUrl: string | null;
    href: string | null;
};

export type DiscoverCaptureItem = {
    kind: "capture";
    id: string;
    captureId: string;
    date: string;
    sortRank: 2;
    animalName: string;
    speciesSlug: string | null;
    score: number;
    endorsementCount: number;
    rarity: number;
    contextLabel: string | null;
    locationLabel: string | null;
    collector: DiscoverCollectorRef;
    imageSrc: string;
    href: string;
    scientificName: string | null;
    breedGuess: string | null;
    conservationTier: string | null;
    totalProgressionXP: number;
    animalDexNumber: number | null;
    mediaCount: number;
    gameStats: Record<string, number>;
};

export type DiscoverAlignmentItem = {
    kind: "alignment";
    id: string;
    proofId: string;
    date: string;
    sortRank: 0;
    summary: string | null;
    moveTodayText: string | null;
    statBoostStat: string | null;
    rewardedCaptureId: string;
    rewardedAnimalName: string;
    collector: DiscoverCollectorRef;
    imageSrc: string;
    href: string;
};

export type DiscoverFusionItem = {
    kind: "fusion";
    id: string;
    fusionId: string;
    date: string;
    sortRank: 1;
    receiverAnimalName: string;
    donorAnimalName: string;
    receiverCaptureId: string;
    donorCaptureId: string | null;
    learnedPrinciple: string | null;
    learnedExpression: string | null;
    collector: DiscoverCollectorRef;
    receiverImageSrc: string;
    donorImageSrc: string | null;
    href: string;
};

export type DiscoverChallengeItem = {
    kind: "challenge";
    id: string;
    date: string;
    sortRank: 3;
    scenarioTitle: string | null;
    scenarioDomain: string | null;
    chosenStat: string | null;
    winnerCaptureId: string | null;
    attacker: {captureId: string; animalName: string; username: string | null; imageSrc: string};
    defender: {captureId: string; animalName: string; username: string | null; imageSrc: string};
};

export type DiscoverTradeItem = {
    kind: "trade";
    id: string;
    date: string;
    sortRank: 4;
    offerer: {userId: string; name: string; username: string | null; animalName: string; imageSrc: string; href: string | null};
    receiver: {userId: string; name: string; username: string | null; animalName: string; imageSrc: string; href: string | null};
};

export type DiscoverTimelineItem =
    | DiscoverCaptureItem
    | DiscoverAlignmentItem
    | DiscoverFusionItem
    | DiscoverChallengeItem
    | DiscoverTradeItem;

export type DiscoverFeaturedItem = {
    captureId: string;
    animalName: string;
    imageSrc: string;
    href: string;
    kind: "endorsed" | "rare";
    endorsementCount: number;
    rarity: number;
};

const PLACEHOLDER_IMAGE = "/images/placeholders/species-no-image.svg";
const DUPLICATE_CAPTURE_WINDOW_MS = 120_000;

function readString(row: QueryRow, key: string) {
    const value = row[key];
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNumber(row: QueryRow, key: string) {
    const value = Number(row[key] ?? 0);
    return Number.isFinite(value) ? value : 0;
}

function readStats(row: QueryRow) {
    const stats = row.game_stats;
    return stats && typeof stats === "object" && !Array.isArray(stats) ? stats as Record<string, number> : {};
}

function toSpeciesSlug(identityKey: string | null) {
    if (!identityKey) return null;
    const slug = identityKey.trim().toLowerCase().replace(/_/g, "-");
    return slug || null;
}

function getContextLabel(row: QueryRow) {
    const setting = readString(row, "zoo_or_wild");
    if (setting && setting !== "Unknown") return setting;

    switch (readString(row, "human_context")) {
        case "Pet":
            return "Domestic";
        case "Livestock":
            return "Farm";
        case "Captive":
            return "Zoo";
        case "Free-ranging":
            return "Wild";
        default:
            return null;
    }
}

function collectorFromRow(row: QueryRow, prefix = "profile"): DiscoverCollectorRef {
    const userId = readString(row, prefix === "profile" ? "user_id" : `${prefix}_user_id`) ?? "";
    const username = readString(row, `${prefix}_username`) ?? readString(row, "profile_username");
    const displayName = readString(row, `${prefix}_display_name`) ?? readString(row, "profile_display_name");
    const avatarUrl = readString(row, `${prefix}_avatar_url`) ?? readString(row, "profile_avatar_url");

    return {
        userId,
        name: displayName || (username ? `@${username}` : "AnimalDex collector"),
        username,
        avatarUrl,
        href: username ? `/u/${encodeURIComponent(username)}` : null
    };
}

function resolveImageSrc(captureId: string, slug: string | null) {
    if (slug) {
        const species = getSpeciesBySlug(slug);
        if (species) return getSpeciesImageRoute(species.slug, captureId);
    }

    if (captureId) {
        const searchParams = new URLSearchParams({captureId});
        return `/api/species-images/capture?${searchParams.toString()}`;
    }

    return PLACEHOLDER_IMAGE;
}

function resolveHref(slug: string | null) {
    if (!slug) return "/animals";
    const species = getSpeciesBySlug(slug);
    return species ? `/animals/${species.slug}` : "/animals";
}

function endorsementCount(row: QueryRow) {
    return readNumber(row, "dominance_endorsements")
        + readNumber(row, "speed_endorsements")
        + readNumber(row, "size_endorsements")
        + readNumber(row, "intelligence_endorsements")
        + readNumber(row, "rarity_endorsements");
}

function parseDate(value: string | null) {
    if (!value) return 0;
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : 0;
}

function mapCaptureRow(row: QueryRow): DiscoverCaptureItem {
    const captureId = readString(row, "capture_id") ?? "";
    const slug = toSpeciesSlug(readString(row, "normalized_identity_key"));
    const stats = readStats(row);
    const species = slug ? getSpeciesBySlug(slug) : null;
    const mediaAssets = Array.isArray(row.media_assets) ? row.media_assets : [];

    return {
        kind: "capture",
        id: `capture-${captureId}`,
        captureId,
        date: readString(row, "feed_activity_at") ?? readString(row, "capture_created_at") ?? new Date(0).toISOString(),
        sortRank: 2,
        animalName: readString(row, "animal_name") ?? "Animal",
        speciesSlug: slug,
        score: readNumber(row, "score"),
        endorsementCount: endorsementCount(row),
        rarity: readNumber(stats, "rarity"),
        contextLabel: getContextLabel(row),
        locationLabel: readString(row, "location_display_label"),
        collector: collectorFromRow(row),
        imageSrc: resolveImageSrc(captureId, slug),
        href: resolveHref(slug),
        scientificName: readString(row, "scientific_name"),
        breedGuess: readString(row, "breed_guess"),
        conservationTier: readString(row, "conservation_tier"),
        totalProgressionXP: readNumber(row, "total_progression_xp"),
        animalDexNumber: species ? getAnimalDexNumberFromEntry(species) : null,
        mediaCount: Math.max(1, mediaAssets.length),
        gameStats: stats
    };
}

function mapAlignmentRow(row: QueryRow): DiscoverAlignmentItem {
    const proofId = readString(row, "proof_id") ?? "";
    const rewardedCaptureId = readString(row, "rewarded_capture_id") ?? "";
    const slug = toSpeciesSlug(readString(row, "normalized_identity_key"));

    return {
        kind: "alignment",
        id: `alignment-${proofId}`,
        proofId,
        date: readString(row, "completed_at") ?? new Date(0).toISOString(),
        sortRank: 0,
        summary: readString(row, "timeline_summary"),
        moveTodayText: readString(row, "move_today_text"),
        statBoostStat: readString(row, "stat_boost_stat"),
        rewardedCaptureId,
        rewardedAnimalName: readString(row, "rewarded_animal_name") ?? "Animal",
        collector: collectorFromRow(row),
        imageSrc: resolveImageSrc(rewardedCaptureId, slug),
        href: resolveHref(slug)
    };
}

function mapFusionRow(row: QueryRow): DiscoverFusionItem {
    const fusionId = readString(row, "fusion_id") ?? "";
    const receiverCaptureId = readString(row, "receiver_capture_id") ?? "";
    const donorCaptureId = readString(row, "public_donor_capture_id");

    return {
        kind: "fusion",
        id: `fusion-${fusionId}`,
        fusionId,
        date: readString(row, "created_at") ?? new Date(0).toISOString(),
        sortRank: 1,
        receiverAnimalName: readString(row, "receiver_animal_name") ?? "Animal",
        donorAnimalName: readString(row, "donor_animal_name") ?? "teacher",
        receiverCaptureId,
        donorCaptureId,
        learnedPrinciple: readString(row, "learned_sub_principle_name"),
        learnedExpression: readString(row, "learned_sub_principle_expression"),
        collector: collectorFromRow(row),
        receiverImageSrc: resolveImageSrc(receiverCaptureId, null),
        donorImageSrc: donorCaptureId ? resolveImageSrc(donorCaptureId, null) : null,
        href: resolveHref(null)
    };
}

function mapChallengeRow(row: QueryRow): DiscoverChallengeItem {
    const id = readString(row, "id") ?? "";
    const attackerCaptureId = readString(row, "attacker_capture_id") ?? "";
    const defenderCaptureId = readString(row, "defender_capture_id") ?? "";

    return {
        kind: "challenge",
        id: `challenge-${id}`,
        date: readString(row, "created_at") ?? new Date(0).toISOString(),
        sortRank: 3,
        scenarioTitle: readString(row, "scenario_title"),
        scenarioDomain: readString(row, "scenario_domain"),
        chosenStat: readString(row, "chosen_stat"),
        winnerCaptureId: readString(row, "winner_capture_id"),
        attacker: {
            captureId: attackerCaptureId,
            animalName: readString(row, "attacker_animal_name") ?? "Animal",
            username: readString(row, "attacker_profile_username"),
            imageSrc: resolveImageSrc(attackerCaptureId, null)
        },
        defender: {
            captureId: defenderCaptureId,
            animalName: readString(row, "defender_animal_name") ?? "Animal",
            username: readString(row, "defender_profile_username"),
            imageSrc: resolveImageSrc(defenderCaptureId, null)
        }
    };
}

function mapTradeRow(row: QueryRow): DiscoverTradeItem {
    const id = readString(row, "id") ?? "";
    const offererCaptureId = readString(row, "offerer_capture_id") ?? "";
    const receiverCaptureId = readString(row, "receiver_capture_id") ?? "";
    const offererUsername = readString(row, "offerer_profile_username");
    const receiverUsername = readString(row, "receiver_profile_username");

    return {
        kind: "trade",
        id: `trade-${id}`,
        date: readString(row, "completed_at") ?? readString(row, "created_at") ?? new Date(0).toISOString(),
        sortRank: 4,
        offerer: {
            userId: readString(row, "offerer_user_id") ?? "",
            name: readString(row, "offerer_profile_display_name") ?? (offererUsername ? `@${offererUsername}` : "Collector"),
            username: offererUsername,
            animalName: readString(row, "offerer_animal_name") ?? "Animal",
            imageSrc: resolveImageSrc(offererCaptureId, null),
            href: offererUsername ? `/u/${encodeURIComponent(offererUsername)}` : null
        },
        receiver: {
            userId: readString(row, "receiver_user_id") ?? "",
            name: readString(row, "receiver_profile_display_name") ?? (receiverUsername ? `@${receiverUsername}` : "Collector"),
            username: receiverUsername,
            animalName: readString(row, "receiver_animal_name") ?? "Animal",
            imageSrc: resolveImageSrc(receiverCaptureId, null),
            href: receiverUsername ? `/u/${encodeURIComponent(receiverUsername)}` : null
        }
    };
}

function excludedCaptureIds(
    captures: DiscoverCaptureItem[],
    alignments: DiscoverAlignmentItem[],
    fusions: DiscoverFusionItem[]
) {
    const captureById = new Map(captures.map((item) => [item.captureId, item]));
    const excluded = new Set<string>();

    for (const proof of alignments) {
        const capture = captureById.get(proof.rewardedCaptureId);
        if (!capture) continue;
        if (Math.abs(parseDate(capture.date) - parseDate(proof.date)) < DUPLICATE_CAPTURE_WINDOW_MS) {
            excluded.add(proof.rewardedCaptureId);
        }
    }

    for (const fusion of fusions) {
        const capture = captureById.get(fusion.receiverCaptureId);
        if (!capture) continue;
        if (Math.abs(parseDate(capture.date) - parseDate(fusion.date)) < DUPLICATE_CAPTURE_WINDOW_MS) {
            excluded.add(fusion.receiverCaptureId);
        }
    }

    return excluded;
}

export function buildDiscoverTimeline(
    captures: DiscoverCaptureItem[],
    alignments: DiscoverAlignmentItem[],
    fusions: DiscoverFusionItem[],
    challenges: DiscoverChallengeItem[],
    trades: DiscoverTradeItem[],
    limit = 60
): DiscoverTimelineItem[] {
    const excluded = excludedCaptureIds(captures, alignments, fusions);
    const captureItems = captures
        .filter((item) => !excluded.has(item.captureId))
        .map((item) => item as DiscoverTimelineItem);

    const items: DiscoverTimelineItem[] = [
        ...captureItems,
        ...alignments,
        ...fusions,
        ...challenges,
        ...trades
    ];

    return items
        .sort((left, right) => {
            const leftDate = parseDate(left.date);
            const rightDate = parseDate(right.date);
            if (leftDate === rightDate) return left.sortRank - right.sortRank;
            return rightDate - leftDate;
        })
        .slice(0, limit);
}

export function buildDiscoverFeatured(captures: DiscoverCaptureItem[]): DiscoverFeaturedItem[] {
    const topEndorsed = [...captures]
        .filter((item) => item.endorsementCount > 0)
        .sort((left, right) => {
            if (left.endorsementCount !== right.endorsementCount) return right.endorsementCount - left.endorsementCount;
            if (left.rarity !== right.rarity) return right.rarity - left.rarity;
            return parseDate(left.date) - parseDate(right.date);
        })
        .map((item) => ({
            captureId: item.captureId,
            animalName: item.animalName,
            imageSrc: item.imageSrc,
            href: item.href,
            kind: "endorsed" as const,
            endorsementCount: item.endorsementCount,
            rarity: item.rarity
        }));

    const rareFinds = [...captures]
        .sort((left, right) => {
            if (left.rarity !== right.rarity) return right.rarity - left.rarity;
            if (left.endorsementCount !== right.endorsementCount) return right.endorsementCount - left.endorsementCount;
            return parseDate(left.date) - parseDate(right.date);
        })
        .map((item) => ({
            captureId: item.captureId,
            animalName: item.animalName,
            imageSrc: item.imageSrc,
            href: item.href,
            kind: "rare" as const,
            endorsementCount: item.endorsementCount,
            rarity: item.rarity
        }));

    const seen = new Set<string>();
    const result: DiscoverFeaturedItem[] = [];

    for (const item of topEndorsed.slice(0, 6)) {
        if (seen.has(item.captureId)) continue;
        seen.add(item.captureId);
        result.push(item);
    }

    const rareLimit = result.length === 0 ? 10 : 8;
    for (const item of rareFinds.slice(0, rareLimit)) {
        if (seen.has(item.captureId)) continue;
        seen.add(item.captureId);
        result.push(item);
        if (result.length >= 12) break;
    }

    return result;
}

export async function getDiscoverTimelineBundle(limit = 60) {
    const supabase = createSupabaseServerClient();
    if (!supabase) {
        return {timeline: [] as DiscoverTimelineItem[], featured: [] as DiscoverFeaturedItem[]};
    }

    const feedSelect = [
        "capture_id",
        "user_id",
        "feed_activity_at",
        "capture_created_at",
        "animal_name",
        "scientific_name",
        "breed_guess",
        "conservation_tier",
        "normalized_identity_key",
        "score",
        "human_context",
        "zoo_or_wild",
        "location_display_label",
        "profile_display_name",
        "profile_username",
        "profile_avatar_url",
        "dominance_endorsements",
        "speed_endorsements",
        "size_endorsements",
        "intelligence_endorsements",
        "rarity_endorsements",
        "game_stats",
        "total_progression_xp",
        "media_assets"
    ].join(",");

    const [
        feedResult,
        alignmentResult,
        fusionResult,
        challengeResult,
        tradeResult
    ] = await Promise.all([
        supabase.from("discover_feed_v1").select(feedSelect).order("feed_activity_at", {ascending: false}).limit(Math.max(limit, 40)),
        supabase.from("discover_alignment_timeline_v1").select("*").order("completed_at", {ascending: false}).limit(30),
        supabase.from("discover_principle_fusion_timeline_v1").select("*").order("created_at", {ascending: false}).limit(30),
        supabase.from("discover_challenge_history_v1").select("id,created_at,scenario_title,scenario_domain,chosen_stat,winner_user_id,winner_capture_id,attacker_capture_id,defender_capture_id,attacker_animal_name,defender_animal_name,attacker_profile_username,defender_profile_username").order("created_at", {ascending: false}).limit(30),
        supabase.from("discover_trade_history_v1").select("id,completed_at,created_at,offerer_user_id,receiver_user_id,offerer_capture_id,receiver_capture_id,offerer_profile_display_name,offerer_profile_username,receiver_profile_display_name,receiver_profile_username,offerer_animal_name,receiver_animal_name").order("completed_at", {ascending: false}).limit(30)
    ]);

    const captures = ((feedResult.data ?? []) as unknown as QueryRow[]).map(mapCaptureRow);
    const alignments = ((alignmentResult.data ?? []) as unknown as QueryRow[]).map(mapAlignmentRow);
    const fusions = ((fusionResult.data ?? []) as unknown as QueryRow[]).map(mapFusionRow);
    const challenges = ((challengeResult.data ?? []) as unknown as QueryRow[]).map(mapChallengeRow);
    const trades = ((tradeResult.data ?? []) as unknown as QueryRow[]).map(mapTradeRow);

    return {
        timeline: buildDiscoverTimeline(captures, alignments, fusions, challenges, trades, limit),
        featured: buildDiscoverFeatured(captures)
    };
}
