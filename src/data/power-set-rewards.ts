import type {AppCapture} from "@/data/authenticated-app";
import type {PowerSetTierName} from "@/data/power-sets";

export type PowerSetRewardBreakdown = {
    basePoints: number;
    habitatAdjustment: number;
    wildBonus: number;
    totalPoints: number;
    wildCaptureCount: number;
    totalCaptureCount: number;
};

function setContextMultiplier(contextLabel: string | null) {
    switch (contextLabel) {
        case "Wild":
            return 1;
        case "Zoo":
            return 0.7;
        case "Domestic":
            return 0.5;
        case "Farm":
            return 0.6;
        default:
            return 0.7;
    }
}

function tierBasePoints(
    tier: PowerSetTierName,
    targetCount: number,
    catalogLinkedCount: number
) {
    switch (tier) {
        case "bronze":
            return 38;
        case "silver":
            return 72;
        case "gold": {
            const silverTarget = catalogLinkedCount > 0
                ? Math.min(
                    Math.max(3, Math.ceil(catalogLinkedCount * 0.5)),
                    Math.max(1, Math.ceil(catalogLinkedCount * 0.15)) + 1,
                    catalogLinkedCount
                )
                : 7;
            const scale = Math.min(1, Math.max(targetCount - silverTarget, 0) / 24);

            return 96 + Math.round(scale * 48);
        }
    }
}

export function powerSetTierRewardBreakdown(
    tier: PowerSetTierName,
    captures: AppCapture[],
    targetCount: number,
    catalogLinkedCount: number
): PowerSetRewardBreakdown {
    const basePoints = tierBasePoints(tier, targetCount, catalogLinkedCount);

    if (captures.length === 0) {
        return {
            basePoints,
            habitatAdjustment: 0,
            wildBonus: 0,
            totalPoints: basePoints,
            wildCaptureCount: 0,
            totalCaptureCount: 0
        };
    }

    const contextAverage = captures
        .map((capture) => setContextMultiplier(capture.contextLabel))
        .reduce((sum, value) => sum + value, 0) / captures.length;
    const contextPoints = Math.round(basePoints * contextAverage);
    const wildCaptureCount = captures.filter((capture) => capture.contextLabel === "Wild").length;
    const wildRatio = wildCaptureCount / captures.length;
    const wildBonusMultiplier = 1 + (wildRatio * (tier === "gold" ? 0.75 : 0.6));
    const totalPoints = Math.round(basePoints * contextAverage * wildBonusMultiplier);

    return {
        basePoints,
        habitatAdjustment: contextPoints - basePoints,
        wildBonus: totalPoints - contextPoints,
        totalPoints,
        wildCaptureCount,
        totalCaptureCount: captures.length
    };
}
