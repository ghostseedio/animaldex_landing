import {isGuideListingIndexable} from "./guide-listing-quality";

export const GUIDE_CATEGORIES = {
    general_wildlife: "General wildlife",
    birding: "Birding",
    herping: "Herping",
    insects_macro: "Insects / macro",
    marine_wildlife: "Marine wildlife",
    wildlife_photography: "Wildlife photography",
    night_wildlife: "Night wildlife"
} as const;

export type GuideCategory = keyof typeof GUIDE_CATEGORIES;

export type PublicGuideListing = {
    id: string;
    slug: string;
    title: string;
    description: string;
    public_summary: string;
    service_category: GuideCategory;
    public_area_label: string;
    region_code: string | null;
    country_code: string;
    duration_minutes: number;
    max_guests: number;
    currency_code: string;
    amount_minor: number;
    pricing_unit: "per_person";
    seller_user_id: string;
    seller_display_name: string | null;
    seller_username: string | null;
    seller_avatar_url: string | null;
    published_at: string;
    updated_at: string;
    qualifying_wild_capture_count: number;
    qualifying_wild_species_count: number;
    cover_image_url?: string | null;
    public_place_name?: string | null;
    public_locality?: string | null;
    public_admin_area?: string | null;
};

const UUID_PATTERN = "[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";

export function parseGuideRouteSegment(segment: string) {
    const match = new RegExp(`^(.+)-(${UUID_PATTERN})$`, "i").exec(segment.trim());
    if (!match) return null;
    return {slug: normalizeSlug(match[1]), listingId: match[2].toLowerCase()};
}

export function normalizeSlug(value: string) {
    return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100);
}

export function guidePath(listing: Pick<PublicGuideListing, "id" | "slug">) {
    return `/guides/${normalizeSlug(listing.slug)}-${listing.id.toLowerCase()}`;
}

/**
 * Canonical geographic truth for Guide marketplace listings is the structured
 * public-area selection (`public_locality` / `public_place_name` /
 * `public_admin_area` / fallback `public_area_label`).
 *
 * The seller title is marketing/display copy only. Never derive geography,
 * areaServed, location filters, location URLs, or location metadata from title
 * text. Never infer a place with AI or rewrite the title to match the area.
 */
export function guideNormalizedLocality(
    listing: Pick<PublicGuideListing, "public_locality" | "public_place_name">
) {
    return (listing.public_locality || listing.public_place_name || "").replace(/\s+/g, " ").trim();
}

export function guideAreaServedName(
    listing: Pick<PublicGuideListing, "public_area_label" | "public_locality" | "public_admin_area" | "public_place_name">
) {
    const locality = (listing.public_locality || listing.public_place_name || "").replace(/\s+/g, " ").trim();
    const admin = (listing.public_admin_area || "").replace(/\s+/g, " ").trim();
    if (locality && admin && locality.toLowerCase() !== admin.toLowerCase()) return `${locality}, ${admin}`;
    if (locality) return locality;
    return listing.public_area_label.replace(/\s+/g, " ").trim();
}

export function guideLocationSlug(
    listing: Pick<PublicGuideListing, "public_area_label" | "public_locality" | "public_place_name" | "region_code" | "country_code">
) {
    const structured = guideNormalizedLocality(listing);
    return normalizeSlug(structured || listing.public_area_label);
}

export function guideLocationFilterKey(
    listing: Pick<PublicGuideListing, "public_area_label" | "public_locality" | "public_place_name" | "public_admin_area" | "region_code" | "country_code">
) {
    const locality = guideNormalizedLocality(listing);
    const admin = (listing.public_admin_area || listing.region_code || "").replace(/\s+/g, " ").trim();
    if (locality) return normalizeSlug([locality, admin, listing.country_code].filter(Boolean).join(" "));
    return normalizeSlug([listing.public_area_label, listing.country_code].filter(Boolean).join(" "));
}

export function hasStructuredPublicLocality(
    listing: Pick<PublicGuideListing, "public_locality" | "public_place_name">
) {
    return Boolean(guideNormalizedLocality(listing));
}

export function categoryLabel(category: GuideCategory) {
    return GUIDE_CATEGORIES[category] || "Wildlife guide";
}

export function isGuideCategory(value: string | null | undefined): value is GuideCategory {
    return Boolean(value && value in GUIDE_CATEGORIES);
}

export function guideHostName(listing: Pick<PublicGuideListing, "seller_display_name" | "seller_username">) {
    if (listing.seller_display_name?.trim()) return listing.seller_display_name.trim();
    if (listing.seller_username?.trim()) return `@${listing.seller_username.replace(/^@/, "")}`;
    return "AnimalDex Guide";
}

export function formatDuration(minutes: number) {
    if (minutes >= 60 && minutes % 60 === 0) {
        const hours = minutes / 60;
        return `${hours} hour${hours === 1 ? "" : "s"}`;
    }
    return `${minutes} minutes`;
}

export function currencyFractionDigits(currencyCode: string, locale = "en") {
    try {
        return new Intl.NumberFormat(locale, {style: "currency", currency: currencyCode.toUpperCase()})
            .resolvedOptions().maximumFractionDigits;
    } catch {
        return 2;
    }
}

export function formatGuidePrice(amountMinor: number, currencyCode: string, locale = "en") {
    const code = currencyCode.toUpperCase();
    const divisor = 10 ** currencyFractionDigits(code, locale);
    try {
        return new Intl.NumberFormat(locale, {style: "currency", currency: code, maximumFractionDigits: currencyFractionDigits(code, locale)})
            .format(amountMinor / divisor);
    } catch {
        return `${code} ${(amountMinor / divisor).toLocaleString(locale)}`;
    }
}

export function normalizeSeoText(value: string, maxLength: number) {
    const clean = value.replace(/<[^>]*>/g, " ").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
    if (clean.length <= maxLength) return clean;
    return `${clean.slice(0, Math.max(0, maxLength - 1)).replace(/\s+\S*$/, "")}…`;
}

export function guideSeo(listing: PublicGuideListing) {
    const title = normalizeSeoText(`${listing.title} Wildlife Guide | AnimalDex`, 65);
    const duration = formatDuration(listing.duration_minutes);
    const summary = normalizeSeoText(listing.public_summary || listing.description, 105);
    const area = guideAreaServedName(listing);
    const description = normalizeSeoText(`Join a ${duration} guided wildlife experience around ${area} with an approved AnimalDex Guide. ${summary}`, 160);
    return {title, description};
}

export function guideStructuredData(listing: PublicGuideListing, canonicalUrl: string, locale = "en") {
    const providerName = listing.seller_display_name || (listing.seller_username ? `@${listing.seller_username.replace(/^@/, "")}` : "AnimalDex Guide");
    const digits = currencyFractionDigits(listing.currency_code, locale);
    return {
        "@context": "https://schema.org",
        "@type": "Service",
        "@id": canonicalUrl,
        url: canonicalUrl,
        name: normalizeSeoText(listing.title, 120),
        description: normalizeSeoText(listing.public_summary || listing.description, 300),
        serviceType: categoryLabel(listing.service_category),
        areaServed: {"@type": "Place", name: guideAreaServedName(listing)},
        provider: {"@type": "Person", name: providerName},
        offers: {
            "@type": "Offer",
            price: (listing.amount_minor / (10 ** digits)).toFixed(digits),
            priceCurrency: listing.currency_code.toUpperCase(),
            unitText: "per person"
        }
    };
}

export const MIN_LOCATION_GUIDE_INVENTORY = 2;
export const MIN_EXPERIENCES_LOCATION_INVENTORY = 3;

export function isExperiencesLocationRouteEligible(listings: PublicGuideListing[]) {
    const indexable = listings.filter((listing) => isGuideListingIndexable(listing) && hasStructuredPublicLocality(listing));
    if (indexable.length === 0) return false;
    const key = guideLocationSlug(indexable[0]);
    if (!key) return false;
    const samePlace = indexable.filter((listing) => guideLocationSlug(listing) === key);
    return samePlace.length >= MIN_EXPERIENCES_LOCATION_INVENTORY;
}

export function locationInventory(listings: PublicGuideListing[], locationSlug: string, category?: GuideCategory) {
    return listings.filter((listing) => guideLocationSlug(listing) === locationSlug && (!category || listing.service_category === category));
}

export function isLocationPageIndexable(listings: PublicGuideListing[]) {
    return listings.length >= MIN_LOCATION_GUIDE_INVENTORY;
}

export function buildGuideSitemapPaths(listings: PublicGuideListing[]) {
    const indexable = listings.filter(isGuideListingIndexable);
    const paths = indexable.map(guidePath);
    const byLocation = new Map<string, PublicGuideListing[]>();
    indexable.forEach((listing) => {
        const slug = guideLocationSlug(listing);
        byLocation.set(slug, [...(byLocation.get(slug) || []), listing]);
    });
    for (const [location, rows] of Array.from(byLocation.entries())) {
        if (!isLocationPageIndexable(rows)) continue;
        paths.push(`/wildlife-guides/${location}`);
        for (const category of Object.keys(GUIDE_CATEGORIES) as GuideCategory[]) {
            if (isLocationPageIndexable(rows.filter((listing: PublicGuideListing) => listing.service_category === category))) {
                paths.push(`/wildlife-guides/${location}/${category}`);
            }
        }
    }
    return Array.from(new Set(paths));
}
