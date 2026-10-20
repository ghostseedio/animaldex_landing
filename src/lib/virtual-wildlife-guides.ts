/**
 * Virtual Wildlife Guides: one guide per place, built by the server from the
 * author's own wild captures and sold as advice (notes for every animal, a
 * chat with the author, introductions to local people). Not a tour.
 *
 * Shapes mirror the iOS models (AnimalDex/Models/WildlifeGuide.swift). The
 * server strips null fields, so anything that can be absent is optional.
 * Pure helpers only: this file is imported by client and server code.
 */

export type GuideRarity = "common" | "uncommon" | "rare" | "very_rare";

export type GuideMedia = {
    id?: string;
    captureImageId?: string;
    captureId: string;
    kind?: string;
    width?: number;
    height?: number;
    durationMs?: number;
    bucket?: string;
    path?: string;
    mimeType?: string;
    posterBucket?: string;
    posterPath?: string;
    thumb320Bucket?: string;
    thumb320Path?: string;
    card640Bucket?: string;
    card640Path?: string;
    feed1200Bucket?: string;
    feed1200Path?: string;
    hidden?: boolean;
    origin?: string;
};

export type GuideSeller = {userId: string; displayName?: string; username?: string; avatarUrl?: string};

export type GuideStatus = "draft" | "pending_review" | "published" | "paused" | "rejected" | "archived";

/** A card on a profile or in a list. Owner-only fields come from get_my_wildlife_guides. */
export type GuideCard = {
    id: string;
    slug?: string;
    title: string;
    summary?: string;
    areaLabel: string;
    placeName?: string;
    countryCode?: string;
    latitude?: number;
    longitude?: number;
    serviceCategory?: string;
    currencyCode: string;
    amountMinor: number;
    speciesCount: number;
    rareSpeciesCount: number;
    publishedAt?: string;
    updatedAt?: string;
    seller?: GuideSeller;
    topSpecies?: {speciesProfileId: string; name: string; rarity: GuideRarity}[];
    coverMedia?: GuideMedia[];
    status?: GuideStatus;
    pausedBy?: string;
    generationStatus?: string;
    priceAuto?: boolean;
    publiclyVisible?: boolean;
};

export type GuideGrowingPlace = {
    placeId: string;
    areaLabel?: string;
    speciesCount: number;
    photoCount: number;
    speciesNeeded: number;
};

export type MyWildlifeGuides = {
    settings: {autoPublish: boolean; noticeAcknowledgedAt?: string; locationVisibility?: string};
    publicEnabled: boolean;
    minSpecies: number;
    guides: GuideCard[];
    growing: GuideGrowingPlace[];
};

export type GuideSpecies = {
    speciesProfileId: string;
    name: string;
    scientificName?: string;
    landingPageSlug?: string;
    animalDexNumber?: number;
    rarity: GuideRarity;
    rarityScore?: number;
    conservationTier?: string;
    threatened?: boolean;
    captureCount: number;
    firstSeenMonth?: string;
    lastSeenMonth?: string;
    photo?: GuideMedia;
    origin?: string;
    hidden?: boolean;
    note?: string;
    noteIsDraft?: boolean;
};

export type GuideContact = {name: string; role?: string; contact?: string; note?: string};

export type GuideStats = {
    visitDayCount?: number;
    captureCount?: number;
    firstVisitMonth?: string;
    lastVisitMonth?: string;
    monthCounts?: number[];
    daypartCounts?: Record<string, number>;
};

export type GuideOwnerState = {
    status: GuideStatus;
    pausedBy?: string;
    generationStatus: string;
    priceAuto: boolean;
    sellerEditedFields?: string[];
    publiclyVisible: boolean;
    /** Paid and not refunded purchases (migration 20261020100000). */
    salesCount?: number;
};

/** The viewer's own purchase of a guide (migration 20261020100000). */
export type GuidePurchase = {
    id: string;
    status: "paid" | "released" | "refunded" | string;
    channel?: "credits" | "web_card" | string;
    paidAt?: string;
    replyDueAt?: string;
    sellerRepliedAt?: string;
    refundWindowEndsAt?: string;
    refundStatus?: "none" | "review" | "processing" | "done" | string;
    refundReason?: string;
    canRequestRefund?: boolean;
};

/** A guide this person bought (get_my_wildlife_guide_purchases). */
export type GuideBought = {
    purchaseId: string;
    status: string;
    refundStatus?: string;
    paidAt?: string;
    guide: Pick<GuideCard, "id" | "title" | "areaLabel" | "currencyCode" | "amountMinor" | "speciesCount" | "rareSpeciesCount" | "coverMedia">;
    seller?: GuideSeller;
};

/** Paid and not refunded: the notes and the chat are open. */
export function purchaseIsActive(purchase: GuidePurchase | null | undefined) {
    return purchase?.status === "paid" || purchase?.status === "released";
}

export function purchaseIsRefunded(purchase: GuidePurchase | null | undefined) {
    return purchase?.status === "refunded";
}

/** "Bought once." / "Bought N times." before the owner note, as on iOS. */
export function guideSalesLine(salesCount: number | null | undefined) {
    const base = "Buyers see this page. Only buyers see your notes and contacts.";
    if (!salesCount || salesCount <= 0) return base;
    return `${salesCount === 1 ? "Bought once." : `Bought ${salesCount} times.`} ${base}`;
}

/** "Oct 22, 2026, 3:04 PM": the reply deadline, in the viewer's time zone. */
export function formatGuideDateTime(value: string | null | undefined, locale = "en") {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat(locale, {dateStyle: "medium", timeStyle: "short"}).format(date);
}

/** "Oct 27, 2026". */
export function formatGuideDate(value: string | null | undefined, locale = "en") {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat(locale, {dateStyle: "medium"}).format(date);
}

export function isValidBuyerEmail(value: string) {
    const email = value.trim();
    return email.length >= 6 && email.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

/** Guide prices are USD cents; the card charge is the same amount in USD. */
export function guideCardCharge(guide: Pick<GuideDetail, "amountMinor" | "currencyCode">) {
    const currency = (guide.currencyCode || "USD").toUpperCase();
    if (currency !== "USD" || !Number.isInteger(guide.amountMinor) || guide.amountMinor <= 0) return null;
    return {currency: "USD" as const, amountMinor: guide.amountMinor};
}

export type GuideDetail = {
    id: string;
    slug?: string;
    title: string;
    summary: string;
    overview: string;
    seasonLine?: string;
    areaLabel: string;
    placeName?: string;
    locality?: string;
    adminArea?: string;
    countryCode: string;
    latitude?: number;
    longitude?: number;
    serviceCategory?: string;
    currencyCode: string;
    amountMinor: number;
    /** What the guide costs in Credits. */
    creditsPrice?: number;
    /** The viewer's own purchase, when they bought it. */
    purchase?: GuidePurchase;
    publishedAt?: string;
    updatedAt?: string;
    disclaimerVersion?: number;
    speciesCount: number;
    rareSpeciesCount: number;
    stats?: GuideStats;
    seller?: GuideSeller;
    species: GuideSpecies[];
    media: GuideMedia[];
    hasPrivateAccess?: boolean;
    private?: {contacts?: GuideContact[]; notes?: string};
    owner?: GuideOwnerState;
};

/** Price steps the server accepts, in USD cents. Mirrors wildlife_guide_price_is_step. */
export const GUIDE_PRICE_STEPS = [99, 199, 299, 499, 799, 999, 1499, 1999, 2999, 4999] as const;

export const GUIDE_MAX_CONTACTS = 10;
export const GUIDE_NOTE_MAX = 1000;

/** Field limits the server enforces in update_my_wildlife_guide. */
export const GUIDE_FIELD_LIMITS = {
    title: {min: 5, max: 100},
    areaLabel: {min: 2, max: 120},
    summary: {min: 20, max: 500},
    overview: {min: 40, max: 5000},
    seasonLine: {min: 0, max: 300},
    privateNotes: {min: 0, max: 4000}
} as const;

/** What a guide is mostly about; set by the server from its animals. */
export const GUIDE_CATEGORIES: Record<string, string> = {
    general_wildlife: "General wildlife",
    birding: "Birding",
    herping: "Reptiles and amphibians",
    insects_macro: "Insects and small wildlife",
    marine_wildlife: "Marine wildlife",
    wildlife_photography: "Wildlife photography",
    night_wildlife: "Night wildlife"
};

export function isGuideCategory(value: string | null | undefined): value is string {
    return Boolean(value && Object.prototype.hasOwnProperty.call(GUIDE_CATEGORIES, value));
}

export function guideCategoryLabel(category: string | null | undefined) {
    return (category && GUIDE_CATEGORIES[category]) || "Wildlife";
}

export const GUIDE_DISCLAIMER =
    "This is a virtual guide: advice from someone who has been there, not a tour. The author is not with you. Wildlife is never guaranteed. Any local guide or operator the author introduces is independent of AnimalDex; agree terms with them directly. Respect wildlife and local rules.";

export const GUIDE_INCLUDED = [
    "The author's notes for every animal: where, when and how they found it",
    "A direct chat with the author to ask anything",
    "Introductions to local people the author met, where they can help"
] as const;

/* ------------------------------------------------------------------ *
 * Routes
 * ------------------------------------------------------------------ */

const UUID_PATTERN = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

export function isUuid(value: string | null | undefined) {
    return new RegExp(`^${UUID_PATTERN}$`, "i").test(value?.trim() ?? "");
}

export function normalizeSlug(value: string) {
    return value.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100);
}

/** `{slug}-{id}`; a guide with no slug falls back to its title. */
export function guidePath(guide: {id: string; slug?: string; title?: string}) {
    const slug = normalizeSlug(guide.slug || guide.title || "") || "wildlife-guide";
    return `/guides/${slug}-${guide.id.toLowerCase()}`;
}

export function parseGuideRouteSegment(segment: string) {
    const match = new RegExp(`^(.+)-(${UUID_PATTERN})$`, "i").exec(segment.trim());
    if (!match) return null;
    return {slug: normalizeSlug(match[1]), listingId: match[2].toLowerCase()};
}

/* ------------------------------------------------------------------ *
 * Money
 * ------------------------------------------------------------------ */

/**
 * Currencies whose minor unit is not 1/100, pinned rather than asked of the
 * runtime: Node's ICU and browsers disagree on IDR, which would render the
 * same price 100x apart on server and client.
 */
const CURRENCY_FRACTION_DIGITS: Record<string, number> = {
    BIF: 0, CLP: 0, DJF: 0, GNF: 0, IDR: 0, ISK: 0, JPY: 0, KMF: 0, KRW: 0,
    PYG: 0, RWF: 0, UGX: 0, VND: 0, VUV: 0, XAF: 0, XOF: 0, XPF: 0,
    BHD: 3, IQD: 3, JOD: 3, KWD: 3, LYD: 3, OMR: 3, TND: 3
};

export function currencyFractionDigits(currencyCode: string, locale = "en") {
    const code = currencyCode.toUpperCase();
    const pinned = CURRENCY_FRACTION_DIGITS[code];
    if (pinned !== undefined) return pinned;
    try {
        return new Intl.NumberFormat(locale, {style: "currency", currency: code}).resolvedOptions().maximumFractionDigits ?? 2;
    } catch {
        return 2;
    }
}

export function formatGuidePrice(amountMinor: number, currencyCode: string, locale = "en") {
    const code = (currencyCode || "USD").toUpperCase();
    const digits = currencyFractionDigits(code, locale);
    const value = amountMinor / 10 ** digits;
    try {
        return new Intl.NumberFormat(locale, {
            style: "currency",
            currency: code,
            minimumFractionDigits: digits,
            maximumFractionDigits: digits
        }).format(value);
    } catch {
        return `${code} ${value.toLocaleString(locale)}`;
    }
}

/** Schema.org price string in major units, e.g. "4.99". */
export function guideOfferPrice(amountMinor: number, currencyCode: string) {
    const digits = currencyFractionDigits(currencyCode);
    return (amountMinor / 10 ** digits).toFixed(digits);
}

/* ------------------------------------------------------------------ *
 * Text
 * ------------------------------------------------------------------ */

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const MONTH_LETTERS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
export const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "2026-03" → "Mar 2026". Fixed English names, so server and client agree. */
export function guideMonthLabel(yearMonth: string | null | undefined) {
    const match = /^(\d{4})-(\d{2})$/.exec(yearMonth?.trim() ?? "");
    if (!match) return null;
    const month = Number(match[2]);
    if (month < 1 || month > 12) return null;
    return `${MONTH_SHORT[month - 1]} ${match[1]}`;
}

/** "Mar 2026", "Mar – Oct 2026" or "Mar 2025 – Oct 2026". */
export function guideMonthRange(first: string | null | undefined, last: string | null | undefined) {
    const start = guideMonthLabel(first);
    const end = guideMonthLabel(last);
    if (!start) return end;
    if (!end || end === start) return start;
    const [startMonth, startYear] = start.split(" ");
    const [, endYear] = end.split(" ");
    return startYear === endYear ? `${startMonth} – ${end}` : `${start} – ${end}`;
}

export function speciesCountLabel(count: number) {
    return count === 1 ? "1 species" : `${count} species`;
}

/** "5 species · 2 rare" (rare only when there are any). */
export function guideSpeciesLine(speciesCount: number, rareCount: number) {
    const species = speciesCountLabel(speciesCount);
    return rareCount > 0 ? `${species} · ${rareCount} rare` : species;
}

/** "5 species · 2 rare · 3 days there · Mar – Oct 2026". */
export function guideStatsLine(guide: Pick<GuideDetail, "speciesCount" | "rareSpeciesCount" | "stats">) {
    const parts = [guideSpeciesLine(guide.speciesCount, guide.rareSpeciesCount)];
    const days = guide.stats?.visitDayCount ?? 0;
    if (days > 0) parts.push(days === 1 ? "1 day there" : `${days} days there`);
    const range = guideMonthRange(guide.stats?.firstVisitMonth, guide.stats?.lastVisitMonth);
    if (range) parts.push(range);
    return parts.join(" · ");
}

export function growingDetail(place: Pick<GuideGrowingPlace, "speciesCount" | "speciesNeeded">) {
    const species = speciesCountLabel(place.speciesCount);
    if (place.speciesNeeded > 0) {
        const needed = place.speciesNeeded === 1 ? "1 more to make a guide" : `${place.speciesNeeded} more to make a guide`;
        return `${species} · ${needed}`;
    }
    return `${species} · needs a public photo`;
}

export const RARITY_LABELS: Record<GuideRarity, string> = {
    common: "Common",
    uncommon: "Uncommon",
    rare: "Rare",
    very_rare: "Very rare"
};

/** Common and uncommon read as plain text; rare is star gold, very rare orange. */
export const RARITY_COLORS: Record<GuideRarity, string> = {
    common: "rgba(255,255,255,0.45)",
    uncommon: "rgba(255,255,255,0.65)",
    rare: "#FFD60A",
    very_rare: "#FF9F0A"
};

export function normalizeSeoText(value: string, maxLength: number) {
    const clean = value.replace(/<[^>]*>/g, " ").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
    if (clean.length <= maxLength) return clean;
    return `${clean.slice(0, Math.max(0, maxLength - 1)).replace(/\s+\S*$/, "")}…`;
}

export function guideAuthorName(seller: GuideSeller | null | undefined) {
    if (seller?.username?.trim()) return `@${seller.username.trim().replace(/^@/, "")}`;
    if (seller?.displayName?.trim()) return seller.displayName.trim();
    return "an explorer";
}

/* ------------------------------------------------------------------ *
 * Owner status (iOS ProfileWildlifeGuidesSection.ownerStatus)
 * ------------------------------------------------------------------ */

export type GuideStatusTone = "neutral" | "muted" | "caution" | "live";
export type GuideStatusKey = "writing" | "notShared" | "paused" | "public" | "notPublic" | "ready" | "hidden";

const STATUS_LABELS: Record<GuideStatusKey, string> = {
    writing: "Writing…",
    notShared: "Not shared",
    paused: "Paused",
    public: "Public",
    notPublic: "Not public",
    ready: "Ready",
    hidden: "Hidden"
};

export function ownerGuideStatus(
    card: Pick<GuideCard, "generationStatus" | "status" | "pausedBy" | "publiclyVisible">,
    mine: {publicEnabled: boolean; locationIsPublic: boolean}
): {key: GuideStatusKey; label: string; tone: GuideStatusTone} {
    const status = (key: GuideStatusKey, tone: GuideStatusTone) => ({key, label: STATUS_LABELS[key], tone});
    if (card.generationStatus === "pending") return status("writing", "muted");
    if (card.status === "paused") {
        return card.pausedBy === "author_off" ? status("notShared", "muted") : status("paused", "caution");
    }
    if (card.status === "published") {
        if (card.publiclyVisible) return status("public", "live");
        return mine.publicEnabled && mine.locationIsPublic ? status("notPublic", "muted") : status("ready", "neutral");
    }
    return status("hidden", "muted");
}

export function locationIsPublic(settings: MyWildlifeGuides["settings"] | null | undefined) {
    return (settings?.locationVisibility ?? "everyone") === "everyone";
}

/* ------------------------------------------------------------------ *
 * Media
 * ------------------------------------------------------------------ */

function captureImageUrl(captureId: string, bucket: string, path: string) {
    return `/api/capture-images/${encodeURIComponent(captureId)}?${new URLSearchParams({bucket, path})}`;
}

/**
 * The best rendition for a size through the capture image proxy. Videos and
 * loops show their poster; nothing ever goes through next/image.
 */
export function guideMediaSrc(media: GuideMedia | null | undefined, size: "thumb" | "card" | "hero" = "card") {
    if (!media?.captureId) return null;
    const renditions: [string | undefined, string | undefined][] = size === "thumb"
        ? [[media.thumb320Bucket, media.thumb320Path], [media.card640Bucket, media.card640Path], [media.feed1200Bucket, media.feed1200Path]]
        : size === "card"
            ? [[media.card640Bucket, media.card640Path], [media.feed1200Bucket, media.feed1200Path], [media.thumb320Bucket, media.thumb320Path]]
            : [[media.feed1200Bucket, media.feed1200Path], [media.card640Bucket, media.card640Path]];
    for (const [bucket, path] of renditions) {
        if (bucket && path) return captureImageUrl(media.captureId, bucket, path);
    }
    const isPhoto = !media.kind || media.kind === "photo";
    if (isPhoto && media.bucket && media.path) {
        return size === "hero"
            ? captureImageUrl(media.captureId, media.bucket, media.path)
            : `/api/capture-images/${encodeURIComponent(media.captureId)}/card?${new URLSearchParams({bucket: media.bucket, path: media.path})}`;
    }
    if (media.posterBucket && media.posterPath) return captureImageUrl(media.captureId, media.posterBucket, media.posterPath);
    return `/api/capture-images/${encodeURIComponent(media.captureId)}/card`;
}

/* ------------------------------------------------------------------ *
 * Editor (iOS WildlifeGuideEditorView)
 * ------------------------------------------------------------------ */

export type GuideForm = {
    title: string;
    areaLabel: string;
    summary: string;
    overview: string;
    seasonLine: string;
    priceAuto: boolean;
    amountMinor: number;
    isShared: boolean;
    contacts: GuideContact[];
    privateNotes: string;
};

export type GuidePatch = Partial<{
    title: string;
    summary: string;
    overview: string;
    seasonLine: string;
    areaLabel: string;
    amountMinor: number;
    priceAuto: boolean;
    visibility: "published" | "paused";
    contacts: GuideContact[];
    privateNotes: string;
}>;

export function guideFormFrom(guide: GuideDetail): GuideForm {
    return {
        title: guide.title ?? "",
        areaLabel: guide.areaLabel ?? "",
        summary: guide.summary ?? "",
        overview: guide.overview ?? "",
        seasonLine: guide.seasonLine ?? "",
        priceAuto: guide.owner?.priceAuto ?? true,
        amountMinor: guide.amountMinor,
        isShared: guide.owner?.status === "published",
        contacts: (guide.private?.contacts ?? []).map((contact) => ({...contact})),
        privateNotes: guide.private?.notes ?? ""
    };
}

const trimmed = (value: string | undefined | null) => (value ?? "").trim();

export function cleanContacts(contacts: GuideContact[]): GuideContact[] {
    return contacts.map((contact) => {
        const clean: GuideContact = {name: trimmed(contact.name)};
        for (const key of ["role", "contact", "note"] as const) {
            const value = trimmed(contact[key]);
            if (value) clean[key] = value;
        }
        return clean;
    });
}

function sameContacts(left: GuideContact[], right: GuideContact[]) {
    if (left.length !== right.length) return false;
    return left.every((contact, index) => {
        const other = right[index];
        return contact.name === other.name
            && (contact.role ?? null) === (other.role ?? null)
            && (contact.contact ?? null) === (other.contact ?? null)
            && (contact.note ?? null) === (other.note ?? null);
    });
}

export function guideValidationProblem(form: GuideForm) {
    const length = (value: string) => trimmed(value).length;
    const {title, areaLabel, summary, overview, seasonLine} = GUIDE_FIELD_LIMITS;
    if (length(form.title) < title.min || length(form.title) > title.max) return "The title needs 5 to 100 characters.";
    if (length(form.areaLabel) < areaLabel.min || length(form.areaLabel) > areaLabel.max) return "The place needs 2 to 120 characters.";
    if (length(form.summary) < summary.min || length(form.summary) > summary.max) return "The search summary needs 20 to 500 characters.";
    if (length(form.overview) < overview.min || length(form.overview) > overview.max) return "About this place needs 40 to 5,000 characters.";
    if (length(form.seasonLine) > seasonLine.max) return "Best time can be at most 300 characters.";
    if (length(form.privateNotes) > GUIDE_FIELD_LIMITS.privateNotes.max) return "Notes for buyers can be at most 4,000 characters.";
    if (form.contacts.length > GUIDE_MAX_CONTACTS) return "A guide can have at most 10 contacts.";
    if (form.contacts.some((contact) => !trimmed(contact.name))) return "Every contact needs a name.";
    if (!form.priceAuto && !(GUIDE_PRICE_STEPS as readonly number[]).includes(form.amountMinor)) return "Choose one of the guide prices.";
    return null;
}

/** Only the fields that changed, so the server leaves everything else (and the author's edit marks) alone. */
export function buildGuidePatch(guide: GuideDetail, form: GuideForm): GuidePatch {
    const patch: GuidePatch = {};
    if (trimmed(form.title) !== guide.title) patch.title = trimmed(form.title);
    if (trimmed(form.areaLabel) !== guide.areaLabel) patch.areaLabel = trimmed(form.areaLabel);
    if (trimmed(form.summary) !== guide.summary) patch.summary = trimmed(form.summary);
    if (trimmed(form.overview) !== guide.overview) patch.overview = trimmed(form.overview);
    if (trimmed(form.seasonLine) !== (guide.seasonLine ?? "")) patch.seasonLine = trimmed(form.seasonLine);
    const wasAuto = guide.owner?.priceAuto ?? true;
    if (form.priceAuto && !wasAuto) {
        patch.priceAuto = true;
    } else if (!form.priceAuto && (form.amountMinor !== guide.amountMinor || wasAuto)) {
        patch.amountMinor = form.amountMinor;
    }
    const wasShared = guide.owner?.status === "published";
    if (form.isShared !== wasShared) patch.visibility = form.isShared ? "published" : "paused";
    const contacts = cleanContacts(form.contacts);
    if (!sameContacts(contacts, cleanContacts(guide.private?.contacts ?? [])) || trimmed(form.privateNotes) !== (guide.private?.notes ?? "")) {
        patch.contacts = contacts;
        patch.privateNotes = trimmed(form.privateNotes);
    }
    return patch;
}

/** Validates a PATCH body for update_my_wildlife_guide; returns the clean patch or an error. */
export function sanitizeGuidePatch(input: Record<string, unknown>): {patch: GuidePatch} | {error: string} {
    const patch: GuidePatch = {};
    for (const key of ["title", "summary", "overview", "seasonLine", "areaLabel"] as const) {
        if (input[key] === undefined) continue;
        if (typeof input[key] !== "string") return {error: `${key} must be text.`};
        const value = (input[key] as string).trim();
        const {min, max} = GUIDE_FIELD_LIMITS[key];
        if (value.length < min || value.length > max) return {error: `${key} needs ${min} to ${max} characters.`};
        patch[key] = value;
    }
    if (input.visibility !== undefined) {
        if (input.visibility !== "published" && input.visibility !== "paused") return {error: "Visibility must be published or paused."};
        patch.visibility = input.visibility;
    }
    if (input.priceAuto !== undefined) {
        if (input.priceAuto !== true) return {error: "Choose a price step to turn off the automatic price."};
        patch.priceAuto = true;
    }
    if (input.amountMinor !== undefined) {
        if (!(GUIDE_PRICE_STEPS as readonly number[]).includes(input.amountMinor as number)) return {error: "Choose one of the guide prices."};
        patch.amountMinor = input.amountMinor as number;
    }
    if (input.contacts !== undefined) {
        if (!Array.isArray(input.contacts) || input.contacts.length > GUIDE_MAX_CONTACTS) return {error: "A guide can have at most 10 contacts."};
        const contacts: GuideContact[] = [];
        for (const raw of input.contacts) {
            if (!raw || typeof raw !== "object") return {error: "Each contact needs a name."};
            const row = raw as Record<string, unknown>;
            const contact: GuideContact = {name: typeof row.name === "string" ? row.name.trim() : ""};
            if (!contact.name || contact.name.length > 120) return {error: "Each contact needs a name of up to 120 characters."};
            for (const key of ["role", "contact", "note"] as const) {
                if (row[key] === undefined || row[key] === null) continue;
                if (typeof row[key] !== "string") return {error: `Contact ${key} must be text.`};
                const value = (row[key] as string).trim();
                if (value.length > 500) return {error: `Contact ${key} is too long.`};
                if (value) contact[key] = value;
            }
            contacts.push(contact);
        }
        patch.contacts = contacts;
    }
    if (input.privateNotes !== undefined) {
        if (typeof input.privateNotes !== "string") return {error: "Notes for buyers must be text."};
        const value = input.privateNotes.trim();
        if (value.length > GUIDE_FIELD_LIMITS.privateNotes.max) return {error: "Notes for buyers can be at most 4,000 characters."};
        patch.privateNotes = value;
    }
    if (!Object.keys(patch).length) return {error: "There are no guide changes to save."};
    return {patch};
}

/** A species patch: hidden, and a note where null (or empty) brings back the draft. */
export function sanitizeSpeciesPatch(input: Record<string, unknown>): {patch: {hidden?: boolean; note?: string | null}} | {error: string} {
    const patch: {hidden?: boolean; note?: string | null} = {};
    if (input.hidden !== undefined) {
        if (typeof input.hidden !== "boolean") return {error: "hidden must be true or false."};
        patch.hidden = input.hidden;
    }
    if (Object.prototype.hasOwnProperty.call(input, "note")) {
        if (input.note === null) {
            patch.note = null;
        } else if (typeof input.note === "string") {
            const value = input.note.trim();
            if (value.length > GUIDE_NOTE_MAX) return {error: "A note can be at most 1,000 characters."};
            patch.note = value || null;
        } else {
            return {error: "The note must be text."};
        }
    }
    if (!Object.keys(patch).length) return {error: "There are no animal changes to save."};
    return {patch};
}

/* ------------------------------------------------------------------ *
 * SEO
 * ------------------------------------------------------------------ */

/** A location/category list page needs this many guides before it is indexed. */
export const MIN_INDEXABLE_GUIDE_LIST = 2;

export function guideSeo(guide: Pick<GuideDetail, "title" | "summary" | "areaLabel" | "speciesCount">) {
    const title = normalizeSeoText(`${guide.title}: Virtual Wildlife Guide | AnimalDex`, 70);
    const description = normalizeSeoText(
        guide.summary || `A virtual wildlife guide to ${guide.areaLabel} with ${speciesCountLabel(guide.speciesCount)} found there.`,
        160
    );
    return {title, description};
}

export function guideStructuredData(guide: GuideDetail, canonicalUrl: string, image?: string | null) {
    return {
        "@context": "https://schema.org",
        "@type": "Product",
        "@id": canonicalUrl,
        url: canonicalUrl,
        name: normalizeSeoText(guide.title, 120),
        description: normalizeSeoText(guide.summary || guide.overview, 300),
        category: "Virtual wildlife guide",
        ...(image ? {image} : {}),
        ...(guide.seller ? {brand: {"@type": "Person", name: guideAuthorName(guide.seller)}} : {}),
        offers: {
            "@type": "Offer",
            url: canonicalUrl,
            price: guideOfferPrice(guide.amountMinor, guide.currencyCode),
            priceCurrency: guide.currencyCode.toUpperCase(),
            availability: "https://schema.org/PreOrder"
        }
    };
}
