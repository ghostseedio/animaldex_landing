/**
 * Explore › Battles › History › Powers: every Power the player has earned,
 * their animals' own and fused ones, newest first.
 *
 * What is left of the web twin of iOS `PlayJourney` once 3.2 removed the
 * Powers page (docs/your-step/SPEC.md, section 5): a Power is earned with the
 * animal, one step at a time in its chat, so there is no loop to sort the
 * animals into any more. Pure; the reads are `/api/app/play-journey`'s.
 */

import type {PowerGateStatus} from "@/lib/animal-powers";

/** One of the player's own cards, as the history needs it. */
export type PlayJourneyCard = {
    captureId: string;
    /** Canonical. Null when the capture never resolved to a species. */
    speciesProfileId: string | null;
    animalName: string;
    /** ISO timestamp; null sorts as the distant past. */
    capturedAt: string | null;
    imageSrc: string | null;
    /** The animal's Power, when one is written. */
    powerName: string | null;
    gate: PowerGateStatus;
};

/** A fused Power row on one of the player's cards (`capture_learned_sub_principles`). */
export type PlayJourneyFused = {
    id: string;
    captureId: string;
    name: string;
    createdAt: string;
    earnedAt: string | null;
};

/** One Power earned: the animal's own, or a fused one. */
export type PlayPowerHistoryItem = {
    id: string;
    speciesProfileId: string;
    captureId: string | null;
    animalName: string;
    imageSrc: string | null;
    powerName: string;
    isFused: boolean;
    /** "Earned in your own life" etc. */
    route: string | null;
    earnedAt: string | null;
};

export const POWER_HISTORY_COPY = {fused: "FUSED"} as const;

function time(value: string | null | undefined) {
    const parsed = value ? Date.parse(value) : NaN;
    return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

export function powerHistoryDetailLine(item: PlayPowerHistoryItem) {
    const parts = [item.animalName];
    if (item.route) parts.push(item.route);
    if (item.earnedAt && Number.isFinite(Date.parse(item.earnedAt))) {
        parts.push(new Date(item.earnedAt).toLocaleDateString(undefined, {day: "numeric", month: "short", year: "numeric"}));
    }
    return parts.join(" · ");
}

export function sortPowerHistory(items: PlayPowerHistoryItem[]) {
    return [...items].sort((left, right) => time(right.earnedAt) - time(left.earnedAt));
}

/**
 * Where a row goes: an animal's own Power to its card's Bond tab, where the
 * Power and the record of the step that earned it are; a fused one to the
 * Battle tab, where its card's fused Powers are.
 */
export function powerHistoryHref(item: Pick<PlayPowerHistoryItem, "captureId" | "isFused">): string | null {
    if (!item.captureId) return null;
    return `/app/capture/${encodeURIComponent(item.captureId)}?tab=${item.isFused ? "battle" : "bond"}`;
}

/**
 * Where a Trial history row goes when it is not a Discover post (3.2: the old
 * full Trial screen is no place to start or submit): the animal on the newest
 * card of it, its record on the Bond tab for a completed Trial, else its
 * chat. Null when no card of it is held.
 */
export function trialHistoryHref(
    trial: {speciesProfileId: string; status: string},
    cards: Pick<PlayJourneyCard, "captureId" | "speciesProfileId" | "capturedAt">[]
): string | null {
    const species = trial.speciesProfileId.toLowerCase();
    const newest = cards
        .filter((card) => card.speciesProfileId?.toLowerCase() === species)
        .sort((left, right) => time(right.capturedAt) - time(left.capturedAt))[0];
    if (!newest) return null;
    return `/app/capture/${encodeURIComponent(newest.captureId)}?${trial.status === "completed" ? "tab=bond" : "talk=1"}`;
}
