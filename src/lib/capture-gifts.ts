/** Ark care (GIFTS M2): what a care gift does for the living animal the card brought aboard. */
export type GiftCareKind = "meal" | "shelter" | "nest";

/** Which catalog the definitions came from: v1 `get_gift_catalog()`, or v2 `get_gift_catalog_v2(p_capture_id)`. */
export type GiftCatalogSource = "v1" | "v2";

export type GiftDefinition = {
    id: string;
    slug: string;
    /** The name to show: localised for the Ark care slugs, else the server's `display_name` (never a hardcoded name). */
    displayName: string;
    /** The line to show: localised for the Ark care slugs, else the server's `description`. */
    description: string;
    creditCost: number;
    iconKey: string;
    sortOrder: number;
    careKind: GiftCareKind | null;
    /** v2: false when this gift would do nothing for this animal right now. v1 rows are always offered. */
    available: boolean;
    reason: string | null;
};

export type GiftCatalog = {
    enabled: boolean;
    definitions: GiftDefinition[];
    source: GiftCatalogSource;
};

export type CaptureGiftItem = {
    id: string;
    definitionId: string;
    slug: string;
    displayName: string;
    iconKey: string;
    senderUserId: string;
    senderDisplayName: string | null;
};

/** The three Ark care gifts' own words (DESIGN §0). Everything else comes from the server, as sent. */
const ARK_CARE_GIFTS: Record<string, {name: string; description: string}> = {
    ark_meal: {name: "A meal", description: "A meal for this animal on the Ark today."},
    ark_shelter: {name: "Shelter", description: "Keeps this animal safe from one hunt, for one day."},
    ark_nest: {name: "Nesting help", description: "Helps this animal's pair raise their young."}
};

/** The empty catalog's calm state: shown when there is no gift to offer (gifts are dark from M1 until Ark care). */
export const GIFTS_COMING_TITLE = "Gifts are coming to the Ark";
export const GIFTS_COMING_BODY = "Soon, gifts will bring food, shelter and nesting help to animals living on the Ark.";

/**
 * A Gift's name: the Ark care slugs by their own words, any other slug by the server's `display_name`, else the
 * plain word "Gift". No legacy name is written here (GIFTS-M1: names come from the server).
 */
export function giftDisplayName(slug: string | null | undefined, serverName?: string | null): string {
    const care = ARK_CARE_GIFTS[slug?.trim() ?? ""];
    if (care) return care.name;
    const name = serverName?.trim();
    return name || "Gift";
}

/** A Gift's one line: the Ark care slugs by their own words, else the server's `description`. */
export function giftDescription(slug: string | null | undefined, serverDescription?: string | null): string {
    const care = ARK_CARE_GIFTS[slug?.trim() ?? ""];
    if (care) return care.description;
    return serverDescription?.trim() ?? "";
}

/** The gifts the sheet offers: only those that would work now (`available !== false`), cheapest order kept. */
export function offeredGifts(catalog: GiftCatalog | null | undefined): GiftDefinition[] {
    if (!catalog?.enabled) return [];
    return catalog.definitions.filter((definition) => definition.available);
}

/** Whether the Gift button shows: the switch is on, even with nothing to offer (the sheet then says gifts are coming). */
export function showsGiftButton(catalog: GiftCatalog | null | undefined): boolean {
    return catalog?.enabled === true;
}

/** PostgREST's "no such function" (v2 not deployed yet): PGRST202, or a 404. */
export function isMissingFunctionError(error: {code?: string | null; message?: string | null; status?: number | null} | null | undefined): boolean {
    if (!error) return false;
    if (error.code === "PGRST202" || error.code === "42883") return true;
    if (error.status === 404) return true;
    return /could not find the function/i.test(error.message ?? "");
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
    if (text.includes("gift_not_available")) return "This Gift isn't available right now.";
    return "Unable to send this Gift right now.";
}

/** `/api/app/gifts/catalog`'s body, read (v1 or v2 shape; v2's extra fields are optional). */
export function parseGiftCatalog(json: unknown): GiftCatalog {
    const body = json as {enabled?: unknown; definitions?: unknown; source?: unknown} | null;
    const source: GiftCatalogSource = body?.source === "v2" ? "v2" : "v1";
    if (!body || typeof body.enabled !== "boolean") return {enabled: false, definitions: [], source};
    const rows = Array.isArray(body.definitions) ? (body.definitions as Array<Record<string, unknown>>) : [];
    return {
        enabled: body.enabled,
        source,
        definitions: rows
            .map((item) => {
                const slug = String(item.slug ?? "");
                const care = item.care_kind;
                return {
                    id: String(item.id ?? ""),
                    slug,
                    displayName: giftDisplayName(slug, typeof item.display_name === "string" ? item.display_name : null),
                    description: giftDescription(slug, typeof item.description === "string" ? item.description : null),
                    creditCost: Number(item.credit_cost ?? 0),
                    iconKey: String(item.icon_key ?? "gift"),
                    sortOrder: Number(item.sort_order ?? 0),
                    careKind: care === "meal" || care === "shelter" || care === "nest" ? care : null,
                    available: item.available !== false,
                    reason: typeof item.reason === "string" ? item.reason : null
                };
            })
            .filter((definition) => definition.id)
            .sort((a, b) => a.sortOrder - b.sortOrder || a.creditCost - b.creditCost)
    };
}

/**
 * `GET /api/app/gifts`'s body, read: the Gifts on a capture. After M1 the server sends the rows only to the owner
 * (and a sender their own); anyone else gets `gifts: []` and a `gift_count`. `community_stats` is ignored: the
 * display-only stat bonus is gone.
 */
export function parseGiftList(json: unknown): {gifts: CaptureGiftItem[]; giftCount: number} {
    const body = json as {gifts?: unknown; gift_count?: unknown} | null;
    const rows = Array.isArray(body?.gifts) ? (body?.gifts as Array<Record<string, unknown>>) : [];
    const gifts = rows.map((item) => {
        const slug = String(item.slug ?? "");
        return {
            id: String(item.id ?? ""),
            definitionId: String(item.definition_id ?? ""),
            slug,
            displayName: giftDisplayName(slug, typeof item.display_name === "string" ? item.display_name : null),
            iconKey: String(item.icon_key ?? "gift"),
            senderUserId: String(item.sender_user_id ?? ""),
            senderDisplayName: (item.sender_display_name as string | null) ?? null
        };
    });
    const counted = Number(body?.gift_count);
    return {gifts, giftCount: Math.max(gifts.length, Number.isFinite(counted) ? Math.trunc(counted) : 0)};
}

export type GiftSendResult = {giftId: string; creditCost: number; senderBalance: number | null};

/** `POST /api/app/gifts`'s body, read leniently: only `gift_id` is needed (v1 and v2 send results). */
export function parseGiftSendResult(json: unknown, fallbackCost: number): GiftSendResult {
    const body = (json ?? {}) as Record<string, unknown>;
    const balance = Number(body.sender_balance);
    return {
        giftId: String(body.gift_id ?? ""),
        creditCost: body.credit_cost != null && Number.isFinite(Number(body.credit_cost)) ? Number(body.credit_cost) : fallbackCost,
        senderBalance: Number.isFinite(balance) && body.sender_balance != null ? balance : null
    };
}
