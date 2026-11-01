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


/** "Intelligence", "Size", …: a stat's title (iOS `CaptureEndorsementStat.title`). */
export function giftStatTitle(stat: EndorsedStat | null | undefined): string {
    return stat ? stat.charAt(0).toUpperCase() + stat.slice(1) : "this animal";
}

const GIFT_IMAGE_SLUGS = new Set(["big_brain", "great_capture", "electric_find", "wild", "legendary_capture"]);
const GIFT_IMAGE_BY_ICON: Record<string, string> = {brain: "big_brain", camera: "great_capture", bolt: "electric_find", flame: "wild", trophy: "legendary_capture"};

/** The Gift's picture, the iOS asset catalog's art (`public/images/gifts`), by slug, else by icon key. */
export function giftImageSrc(slug: string | null | undefined, iconKey?: string | null): string | null {
    const key = slug?.trim() ?? "";
    if (GIFT_IMAGE_SLUGS.has(key)) return `/images/gifts/${key}.webp`;
    const byIcon = GIFT_IMAGE_BY_ICON[iconKey?.trim() ?? ""];
    return byIcon ? `/images/gifts/${byIcon}.webp` : null;
}

/** Each Gift's glow (iOS `GiftPresentation.accentColor`). */
export function giftAccent(iconKey: string | null | undefined): string {
    switch (iconKey) {
        case "brain":
            return "rgb(140 199 255)";
        case "camera":
            return "rgb(250 184 71)";
        case "bolt":
            return "rgb(250 235 71)";
        case "flame":
            return "rgb(250 107 56)";
        case "trophy":
            return "rgb(250 209 71)";
        default:
            return "rgb(167 244 50)";
    }
}

/** What a failed send says (iOS `giftErrorMessage`). */
export function giftErrorMessage(raw: string | null | undefined): string {
    const text = (raw ?? "").toLowerCase();
    if (text.includes("insufficient_credits")) return "You need more Credits to send this Gift.";
    if (text.includes("gifts_disabled")) return "Gifts are turned off right now.";
    if (text.includes("self_gift_blocked")) return "You cannot send a Gift to your own capture.";
    if (text.includes("gift_rate_limited")) return "You have sent the maximum Gifts for now. Try again later.";
    if (text.includes("users_blocked")) return "Gifts are not available between these accounts.";
    return "Unable to send this Gift right now.";
}

/** `/api/app/gifts/catalog`'s body, read. */
export function parseGiftCatalog(json: unknown): GiftCatalog {
    const body = json as {enabled?: unknown; definitions?: unknown} | null;
    if (!body || typeof body.enabled !== "boolean") return {enabled: false, definitions: []};
    const rows = Array.isArray(body.definitions) ? (body.definitions as Array<Record<string, unknown>>) : [];
    return {
        enabled: body.enabled,
        definitions: rows
            .map((item) => {
                const slug = String(item.slug ?? "");
                return {
                    id: String(item.id ?? ""),
                    slug,
                    displayName: String(item.display_name ?? giftDisplayName(slug)),
                    description: String(item.description ?? ""),
                    creditCost: Number(item.credit_cost ?? 0),
                    captureXpGrant: Number(item.capture_xp_grant ?? 0),
                    iconKey: String(item.icon_key ?? "gift"),
                    endorsedStat: (item.endorsed_stat as EndorsedStat | undefined) ?? endorsedStatForSlug(slug) ?? undefined,
                    sortOrder: Number(item.sort_order ?? 0)
                };
            })
            .sort((a, b) => a.sortOrder - b.sortOrder || a.creditCost - b.creditCost)
    };
}

/** `GET /api/app/gifts`'s body, read: the Gifts on a capture and its community support. */
export function parseGiftList(json: unknown): {gifts: CaptureGiftItem[]; communityStats: CommunityStatTotals | null} {
    const body = json as {gifts?: unknown; community_stats?: unknown} | null;
    const rows = Array.isArray(body?.gifts) ? (body?.gifts as Array<Record<string, unknown>>) : [];
    const gifts = rows.map((item) => {
        const slug = String(item.slug ?? "");
        return {
            id: String(item.id ?? ""),
            definitionId: String(item.definition_id ?? ""),
            slug,
            displayName: String(item.display_name ?? giftDisplayName(slug)),
            iconKey: String(item.icon_key ?? "gift"),
            endorsedStat: (item.endorsed_stat as EndorsedStat | undefined) ?? endorsedStatForSlug(slug) ?? undefined,
            senderUserId: String(item.sender_user_id ?? ""),
            senderDisplayName: (item.sender_display_name as string | null) ?? null,
            xpGranted: Number(item.xp_granted ?? 0)
        };
    });
    const stats = body?.community_stats as Record<string, unknown> | null | undefined;
    const communityStats = stats && typeof stats === "object"
        ? {
            intelligence: communityStatPoints(Number(stats.intelligence ?? 0)),
            speed: communityStatPoints(Number(stats.speed ?? 0)),
            size: communityStatPoints(Number(stats.size ?? 0)),
            dominance: communityStatPoints(Number(stats.dominance ?? 0)),
            rarity: communityStatPoints(Number(stats.rarity ?? 0))
        }
        : null;
    return {gifts, communityStats};
}

export type GiftSendResult = {giftId: string; creditCost: number; senderBalance: number | null; xpGranted: number};

/** `POST /api/app/gifts`'s body, read (iOS `CaptureGiftSendResult`). */
export function parseGiftSendResult(json: unknown, fallbackCost: number): GiftSendResult {
    const body = (json ?? {}) as Record<string, unknown>;
    const balance = Number(body.sender_balance);
    return {
        giftId: String(body.gift_id ?? ""),
        creditCost: Number.isFinite(Number(body.credit_cost)) ? Number(body.credit_cost) : fallbackCost,
        senderBalance: Number.isFinite(balance) && body.sender_balance != null ? balance : null,
        xpGranted: Number(body.xp_granted ?? 0)
    };
}
