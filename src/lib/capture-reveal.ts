/**
 * What a newly identified capture opens with, ported from the iOS source of
 * truth (`SightingNovelty`, `RewardScoring` and `CaptureRewardShowcaseBuilder`).
 *
 * NOVELTY IS FROZEN AT CLAIM TIME. By the time the card opens the capture is
 * already in the collection, so asking "has this person seen this species?"
 * there would always answer yes. The answer is worked out once, the moment the
 * analysis lands, and carried to the card.
 */

import {getBattlePower, type SpeciesStats} from "@/lib/battle-tier";

/** The reward cards' words (`appCapture.reveal`), English by default. */
export type RevealRewardWords = {
    captureReward: string;
    basePoints: string;
    wildBonus: string;
    zooContext: string;
    domesticAdjustment: string;
    farmAdjustment: string;
    unknownContext: string;
    newSpeciesBonus: string;
    freeCreditLine: string;
    total: string;
    totalRewards: string;
    plusCredit: string;
    /** "{setting}" */
    addedToScore: string;
    /** "{setting}" */
    addedToScoreAndCredits: string;
    wildEducation: string;
    /** "{animal}" */
    firstInCollection: string;
    wild: string;
    zoo: string;
    domestic: string;
    farm: string;
    unknown: string;
};

export const REVEAL_REWARD_WORDS_EN: RevealRewardWords = {
    captureReward: "Capture Reward",
    basePoints: "Base Points",
    wildBonus: "Wild bonus",
    zooContext: "Zoo context",
    domesticAdjustment: "Domestic adjustment",
    farmAdjustment: "Farm adjustment",
    unknownContext: "Unknown context",
    newSpeciesBonus: "New Species Bonus",
    freeCreditLine: "Free Credit (First Wild Species)",
    total: "Total",
    totalRewards: "Total Rewards",
    plusCredit: "+1 credit",
    addedToScore: "{setting} capture added to your score",
    addedToScoreAndCredits: "{setting} capture added to your score and credits",
    wildEducation: "Wild animals give bonus points",
    firstInCollection: "This is the first {animal} in your collection.",
    wild: "Wild",
    zoo: "Zoo",
    domestic: "Domestic",
    farm: "Farm",
    unknown: "Unknown"
};

function fillReveal(template: string, values: Record<string, string>) {
    return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? values[key] : match));
}

export type SightingNovelty = {
    isNewSpecies: boolean;
    /** Sightings of this species in the collection, including this capture. */
    totalSightings: number;
};

/** What the capture flow hands to the card it opens. */
export type CaptureReveal = SightingNovelty & {
    captureId: string;
    /** True only when this capture earned the one free credit for a first wild species. */
    awardedWildUniqueCredit: boolean;
};

export type RewardBreakdownLine = {
    title: string;
    points: number;
};

export type RewardShowcaseItem = {
    title: string;
    lines: RewardBreakdownLine[];
    totalLabel: string;
    totalValueText: string;
    subtitle: string;
    educationChip: string | null;
};

export const NEW_SPECIES_BONUS = 50;

export function sightingNovelty(input: {
    priorSightingCount: number;
    isEligibleCapture: boolean;
    hasUncertaintyFallback: boolean;
}): SightingNovelty {
    const prior = Math.max(0, Math.floor(input.priorSightingCount));
    return {
        // An uncertain or ineligible capture is never a discovery, however
        // empty the collection is.
        isNewSpecies: input.isEligibleCapture && !input.hasUncertaintyFallback && prior === 0,
        totalSightings: prior + 1
    };
}

export function noveltyLabel(novelty: SightingNovelty) {
    return novelty.isNewSpecies ? "New species" : `Seen ×${Math.max(1, novelty.totalSightings)}`;
}

function settingKey(settingTag: string | null | undefined) {
    const value = settingTag?.trim().toLowerCase() ?? "";
    return value === "wild" || value === "zoo" || value === "domestic" || value === "farm" ? value : "unknown";
}

/** "Wild", "Zoo", … as the subtitle names the capture. */
function settingShortLabel(settingTag: string | null | undefined, words: RevealRewardWords) {
    return words[settingKey(settingTag) as "wild" | "zoo" | "domestic" | "farm" | "unknown"];
}

export function captureContextMultiplier(settingTag: string | null | undefined) {
    switch (settingKey(settingTag)) {
        case "wild": return 3.0;
        case "domestic": return 0.55;
        case "farm": return 0.7;
        default: return 0.5;
    }
}

function contextLabel(settingTag: string | null | undefined, words: RevealRewardWords) {
    switch (settingKey(settingTag)) {
        case "wild": return words.wildBonus;
        case "zoo": return words.zooContext;
        case "domestic": return words.domesticAdjustment;
        case "farm": return words.farmAdjustment;
        default: return words.unknownContext;
    }
}

export type CaptureRewardBreakdown = {
    settingTag: string | null;
    basePoints: number;
    contextPoints: number;
    newSpeciesBonus: number;
    totalPoints: number;
};

export function captureRewardBreakdown(input: {
    baseGameStats: SpeciesStats;
    settingTag: string | null | undefined;
    isEligibleCapture: boolean;
    hasUncertaintyFallback: boolean;
    isNewSpecies: boolean;
}): CaptureRewardBreakdown {
    const settingTag = input.settingTag ?? null;

    if (!input.isEligibleCapture || input.hasUncertaintyFallback) {
        return {settingTag, basePoints: 0, contextPoints: 0, newSpeciesBonus: 0, totalPoints: 0};
    }

    const basePoints = getBattlePower(input.baseGameStats);
    const contextPoints = Math.round(basePoints * captureContextMultiplier(settingTag));
    const newSpeciesBonus = input.isNewSpecies ? NEW_SPECIES_BONUS : 0;

    return {settingTag, basePoints, contextPoints, newSpeciesBonus, totalPoints: contextPoints + newSpeciesBonus};
}

/**
 * The cards the result screen plays, once. Empty when the capture scored
 * nothing, so an uncertain capture opens without a reward it did not earn.
 */
export function captureRewardShowcase(
    breakdown: CaptureRewardBreakdown,
    awardedWildUniqueCredit: boolean,
    words: RevealRewardWords = REVEAL_REWARD_WORDS_EN
): RewardShowcaseItem[] {
    if (breakdown.totalPoints <= 0) return [];

    const lines: RewardBreakdownLine[] = [
        {title: words.basePoints, points: breakdown.basePoints},
        {title: contextLabel(breakdown.settingTag, words), points: breakdown.contextPoints - breakdown.basePoints}
    ];
    if (breakdown.newSpeciesBonus > 0) {
        lines.push({title: words.newSpeciesBonus, points: breakdown.newSpeciesBonus});
    }
    if (awardedWildUniqueCredit) {
        lines.push({title: words.freeCreditLine, points: 1});
    }

    const setting = settingShortLabel(breakdown.settingTag, words);

    return [{
        title: words.captureReward,
        lines,
        totalLabel: awardedWildUniqueCredit ? words.totalRewards : words.total,
        totalValueText: awardedWildUniqueCredit
            ? `+${breakdown.totalPoints} • ${words.plusCredit}`
            : `+${breakdown.totalPoints}`,
        subtitle: fillReveal(awardedWildUniqueCredit ? words.addedToScoreAndCredits : words.addedToScore, {setting}),
        educationChip: settingKey(breakdown.settingTag) === "wild" ? words.wildEducation : null
    }];
}

export function newSpeciesMessage(animalName: string, words: Pick<RevealRewardWords, "firstInCollection"> = REVEAL_REWARD_WORDS_EN) {
    return fillReveal(words.firstInCollection, {animal: animalName.trim().toLowerCase()});
}

export const CONTINUATION_NOTE = "Already saved to your collection.";

// MARK: - Handing the reveal to the card

const REVEAL_KEY_PREFIX = "animaldex:capture-reveal:";
/** A reveal nobody opened within this long is stale, and is dropped unread. */
const REVEAL_MAX_AGE_MS = 1000 * 60 * 10;

type RevealStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function storeCaptureReveal(storage: RevealStorage | null, reveal: CaptureReveal, now = Date.now()) {
    try {
        storage?.setItem(`${REVEAL_KEY_PREFIX}${reveal.captureId.toLowerCase()}`, JSON.stringify({...reveal, storedAt: now}));
    } catch {
        // No storage, no reveal: the card still opens, just without ceremony.
    }
}

/**
 * Reads the reveal for one capture and spends it. It plays once: reopening the
 * card, or reloading it, finds nothing here.
 */
export function claimCaptureReveal(storage: RevealStorage | null, captureId: string, now = Date.now()): CaptureReveal | null {
    const key = `${REVEAL_KEY_PREFIX}${captureId.toLowerCase()}`;
    try {
        const raw = storage?.getItem(key);
        if (!raw) return null;
        storage?.removeItem(key);
        const parsed = JSON.parse(raw) as Partial<CaptureReveal> & {storedAt?: number};
        if (typeof parsed.storedAt !== "number" || now - parsed.storedAt > REVEAL_MAX_AGE_MS) return null;
        if (parsed.captureId?.toLowerCase() !== captureId.toLowerCase()) return null;
        return {
            captureId: parsed.captureId,
            isNewSpecies: parsed.isNewSpecies === true,
            totalSightings: Math.max(1, Math.floor(Number(parsed.totalSightings) || 1)),
            awardedWildUniqueCredit: parsed.awardedWildUniqueCredit === true
        };
    } catch {
        return null;
    }
}
