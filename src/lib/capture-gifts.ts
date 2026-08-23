export type EndorsedStat = "intelligence" | "speed" | "size" | "dominance" | "rarity";

export type GiftDefinition = {
    id: string;
    slug: string;
    displayName: string;
    description: string;
    creditCost: number;
    captureXpGrant: number;
    iconKey: string;
    endorsedStat?: EndorsedStat;
    sortOrder: number;
};

export type GiftCatalog = {
    enabled: boolean;
    definitions: GiftDefinition[];
};

export type CaptureGiftItem = {
    id: string;
    definitionId: string;
    slug: string;
    displayName: string;
    iconKey: string;
    endorsedStat?: EndorsedStat;
    senderUserId: string;
    senderDisplayName: string | null;
    xpGranted: number;
};

export type CommunityStatTotals = {
    intelligence: number;
    speed: number;
    size: number;
    dominance: number;
    rarity: number;
};

/** Fallback display names. Backend catalog remains authoritative when present. */
export function giftDisplayName(slug: string | null | undefined): string {
    switch (slug?.trim()) {
        case "big_brain":
            return "Big Brain";
        case "great_capture":
            return "Absolute Unit";
        case "electric_find":
            return "Lightning Bolt";
        case "wild":
            return "Powerhouse";
        case "legendary_capture":
            return "Legendary";
        default:
            return slug?.replaceAll("_", " ").replace(/\b\w/g, (ch) => ch.toUpperCase()) || "Gift";
    }
}

export function endorsedStatForSlug(slug: string | null | undefined): EndorsedStat | null {
    switch (slug?.trim()) {
        case "big_brain":
            return "intelligence";
        case "electric_find":
            return "speed";
        case "great_capture":
            return "size";
        case "wild":
            return "dominance";
        case "legendary_capture":
            return "rarity";
        default:
            return null;
    }
}

export function communityStatPoints(uniqueSenders: number): number {
    return Math.max(0, Math.min(8, Math.trunc(uniqueSenders)));
}

export function communitySupportSenderPoints(giftCount: number, captureCount: number): number {
    if (giftCount <= 0) return 0;
    const diversity = 2 * Math.min(2, Math.max(0, captureCount - 1));
    const repeats = Math.min(2, Math.max(0, giftCount - 1));
    return Math.min(12, 8 + diversity + repeats);
}

export function communitySupportScore(
    senders: Array<{giftCount: number; captureCount: number}>
): number {
    const total = senders.reduce(
        (sum, sender) => sum + communitySupportSenderPoints(sender.giftCount, sender.captureCount),
        0
    );
    return Math.min(2000, total);
}

/** Fixture only — never use for live pricing. */
export const LAUNCH_GIFT_CATALOG = [
    {slug: "big_brain", creditCost: 5, captureXpGrant: 5},
    {slug: "great_capture", creditCost: 10, captureXpGrant: 8},
    {slug: "electric_find", creditCost: 25, captureXpGrant: 16},
    {slug: "wild", creditCost: 50, captureXpGrant: 28},
    {slug: "legendary_capture", creditCost: 100, captureXpGrant: 45}
] as const;

