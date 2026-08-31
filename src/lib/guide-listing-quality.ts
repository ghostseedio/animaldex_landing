const GUIDE_CATEGORY_IDS = new Set([
    "general_wildlife",
    "birding",
    "herping",
    "insects_macro",
    "marine_wildlife",
    "wildlife_photography",
    "night_wildlife"
]);

const GENERIC_TITLE_PROPER_NOUNS = new Set([
    "after",
    "birding",
    "birds",
    "dark",
    "dawn",
    "evening",
    "experience",
    "frogs",
    "group",
    "guide",
    "herping",
    "insects",
    "lizards",
    "local",
    "macro",
    "marine",
    "morning",
    "night",
    "photography",
    "snakes",
    "tour",
    "trip",
    "walk",
    "wildlife"
]);

export const GUIDE_LISTING_INDEX_MIN_TITLE = 8;
export const GUIDE_LISTING_INDEX_MIN_SUMMARY = 20;
export const GUIDE_LISTING_INDEX_MIN_DESCRIPTION = 40;

export const LIVE_CONTRADICTORY_LISTING_ID = "1df4dd8e-05a1-4f08-bba8-909ade817e36";

export type GuideStructuredPlace = {
    publicAreaLabel: string;
    publicLocality?: string | null;
    publicAdminArea?: string | null;
    publicPlaceName?: string | null;
};

export function titlePlaceCandidates(title: string) {
    const matches = title.match(/\b[A-Z][A-Za-z]{3,}\b/g) || [];
    const seen = new Set<string>();
    const candidates: string[] = [];
    for (let index = 0; index < matches.length; index += 1) {
        const word = matches[index];
        const key = word.toLowerCase();
        if (GENERIC_TITLE_PROPER_NOUNS.has(key) || seen.has(key)) continue;
        seen.add(key);
        candidates.push(word);
    }
    return candidates;
}

export function structuredPlaceTokens(place: GuideStructuredPlace) {
    const parts = [
        place.publicAreaLabel,
        place.publicLocality || "",
        place.publicAdminArea || "",
        place.publicPlaceName || ""
    ].join(" ");
    return new Set(
        parts
            .toLowerCase()
            .split(/[^a-z]+/)
            .filter((token) => token.length >= 3)
    );
}

export function titleStructuredLocationLooksInconsistent(
    title: string,
    place: GuideStructuredPlace | string
) {
    const structured = typeof place === "string" ? {publicAreaLabel: place} : place;
    const candidates = titlePlaceCandidates(title);
    const tokens = structuredPlaceTokens(structured);
    if (candidates.length === 0 || tokens.size === 0) return false;
    for (let index = 0; index < candidates.length; index += 1) {
        if (tokens.has(candidates[index].toLowerCase())) return false;
    }
    return true;
}

export function titlePublicAreaLooksInconsistent(title: string, publicAreaLabel: string) {
    return titleStructuredLocationLooksInconsistent(title, publicAreaLabel);
}

export function locationMismatchMessage(title: string, publicAreaLabel: string) {
    const mentioned = titlePlaceCandidates(title).join(", ");
    const area = publicAreaLabel.replace(/\s+/g, " ").trim() || "the selected area";
    if (!mentioned) {
        return `Confirm where this experience actually takes place before publishing. The selected experience area is ${area}.`;
    }
    return `Your title mentions ${mentioned}, but the selected experience area is ${area}. Confirm where this experience actually takes place before publishing.`;
}

export function isGuideListingIndexable(listing: {
    title: string;
    public_area_label: string;
    public_summary: string;
    description: string;
    service_category: string;
    duration_minutes: number;
    amount_minor: number;
}) {
    const title = listing.title.replace(/\s+/g, " ").trim();
    const area = listing.public_area_label.replace(/\s+/g, " ").trim();
    const summary = listing.public_summary.replace(/\s+/g, " ").trim();
    const description = listing.description.replace(/\s+/g, " ").trim();
    return (
        title.length >= GUIDE_LISTING_INDEX_MIN_TITLE
        && area.length >= 2
        && summary.length >= GUIDE_LISTING_INDEX_MIN_SUMMARY
        && description.length >= GUIDE_LISTING_INDEX_MIN_DESCRIPTION
        && GUIDE_CATEGORY_IDS.has(listing.service_category)
        && listing.duration_minutes >= 30
        && listing.amount_minor > 0
    );
}
