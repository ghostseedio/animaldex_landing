/**
 * A card's star grade (iOS `CaptureStarRating`): the photo grade, where it
 * was seen, the card's level and its tier, each a share of full points,
 * averaged and read as one to five stars. The reveal shows it under the
 * Power; the tier itself is never shown (JRN-8).
 */

import {getBattleTier, type AnimalBattleTier, type SpeciesStats} from "@/lib/battle-tier";
import {animalLevel} from "@/lib/animal-level";
import {isFreeRangingDomestic} from "@/lib/capture-card-chips";

export const MIN_STARS = 1;
export const MAX_STARS = 5;
/** Levels above this earn full level points. */
const FULL_POINTS_LEVEL_THRESHOLD = 20;

const TIER_RANK: Record<AnimalBattleTier, number> = {E: 0, D: 1, C: 2, B: 3, A: 4, S: 5};

export function gradeShare(grade: number | null | undefined): number {
    if (grade == null || !Number.isFinite(grade)) return 0;
    return (Math.min(10, Math.max(1, Math.round(grade))) - 1) / 9;
}

/** Wild, then farm, then domestic, then zoo. */
export function settingShare(settingTag: string | null | undefined): number {
    switch (settingTag?.trim().toLowerCase()) {
        case "wild": return 1;
        case "farm": return 2 / 3;
        case "domestic": return 1 / 3;
        default: return 0;
    }
}

export function levelShare(level: number): number {
    const threshold = FULL_POINTS_LEVEL_THRESHOLD + 1;
    const clamped = Math.min(threshold, Math.max(1, Math.floor(level)));
    return (clamped - 1) / (threshold - 1);
}

export function tierShare(tier: AnimalBattleTier): number {
    return TIER_RANK[tier] / TIER_RANK.S;
}

export function captureStarCount(input: {
    grade: number | null | undefined;
    settingTag: string | null | undefined;
    humanContext?: string | null;
    totalProgressionXP: number;
    stats: SpeciesStats;
}): number {
    // A free-ranging domestic animal tagged Wild scores as domestic.
    const setting = isFreeRangingDomestic(input.settingTag, input.humanContext) ? "domestic" : input.settingTag;
    const factors = [
        gradeShare(input.grade),
        settingShare(setting),
        levelShare(animalLevel(Math.max(0, input.totalProgressionXP))),
        tierShare(getBattleTier(input.stats))
    ];
    const score = factors.reduce((sum, value) => sum + value, 0) / factors.length;
    return MIN_STARS + Math.round(score * (MAX_STARS - MIN_STARS));
}
