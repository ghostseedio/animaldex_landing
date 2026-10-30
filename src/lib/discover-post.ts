/**
 * `animal-trial` is checked before the others only by convention; no other
 * kind's prefix is a prefix of it. Its entity id is the deterministic
 * `md5(user:species:frequency)::uuid` the database view publishes as `post_id`.
 */
export const DISCOVER_POST_KINDS = ["capture", "alignment", "fusion", "challenge", "trade", "animal-trial"] as const;

export type DiscoverPostKind = (typeof DISCOVER_POST_KINDS)[number];

export type ParsedDiscoverPostId = {
    kind: DiscoverPostKind;
    entityId: string;
    postId: string;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function discoverPostPath(postId: string) {
    return `/p/${encodeURIComponent(postId)}`;
}

export function normalizeDiscoverPostId(raw: string | null | undefined): string | null {
    const value = raw?.trim();
    if (!value) return null;
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
}

export function parseDiscoverPostId(raw: string | null | undefined): ParsedDiscoverPostId | null {
    const value = normalizeDiscoverPostId(raw);
    if (!value) return null;

    for (const kind of DISCOVER_POST_KINDS) {
        const prefix = `${kind}-`;
        if (value.startsWith(prefix) && value.length > prefix.length) {
            return {kind, entityId: value.slice(prefix.length), postId: value};
        }
    }

    // Bare capture UUIDs are accepted so shared IDs stay short.
    if (UUID_PATTERN.test(value)) {
        return {kind: "capture", entityId: value, postId: `capture-${value}`};
    }

    return null;
}

export function discoverPostShareTitle(input: {
    kind: DiscoverPostKind | string;
    animalName?: string | null;
    collectorName?: string | null;
    contextLabel?: string | null;
}) {
    const animal = input.animalName?.trim() || "Animal";
    const collector = input.collectorName?.trim();
    const context = input.contextLabel?.trim().toLowerCase();

    if (input.kind === "capture") {
        if (context === "wild") return `${animal} in the wild`;
        if (context === "zoo") return `${animal} at the zoo`;
        if (context === "domestic" || context === "farm") return `${animal} (domestic)`;
        return collector ? `${animal} · AnimalDex capture by ${collector}` : `${animal} · AnimalDex capture`;
    }

    // An old battle post (before 3.2's Debates), still shared by its link.
    if (input.kind === "challenge") {
        return collector ? `${animal} on AnimalDex · ${collector}` : `${animal} on AnimalDex`;
    }

    if (input.kind === "alignment") {
        return collector ? `Daily alignment · ${collector}` : "Daily alignment on AnimalDex";
    }

    if (input.kind === "fusion") {
        return "Principle fusion on AnimalDex";
    }

    if (input.kind === "animal-trial") {
        return collector ? `${animal} Trial · ${collector}` : `${animal} Trial on AnimalDex`;
    }

    return "AnimalDex trade";
}

export function discoverPostShareDescription(input: {
    kind: DiscoverPostKind | string;
    animalName?: string | null;
    collectorName?: string | null;
    collectorUsername?: string | null;
    contextLabel?: string | null;
    locationLabel?: string | null;
    hasVideoMedia?: boolean;
    scientificName?: string | null;
}) {
    const animal = input.animalName?.trim() || "an animal";
    const handle = input.collectorUsername?.trim()
        ? `@${input.collectorUsername.trim()}`
        : input.collectorName?.trim() || "a collector";
    const context = input.contextLabel?.trim().toLowerCase();
    const location = input.locationLabel?.trim();
    const scientific = input.scientificName?.trim();

    if (input.kind === "capture") {
        const setting = context === "wild"
            ? "in the wild"
            : context === "zoo"
                ? "at the zoo"
                : context === "domestic" || context === "farm"
                    ? "in a domestic setting"
                    : "on AnimalDex";
        const media = input.hasVideoMedia ? " Watch the short video capture." : "";
        const where = location ? ` Spotted near ${location}.` : "";
        const taxonomy = scientific ? ` (${scientific})` : "";
        return `${animal}${taxonomy} ${setting}, shared by ${handle} on AnimalDex.${where}${media}`;
    }

    if (input.kind === "challenge") {
        return `${animal} and another animal on AnimalDex, shared by ${handle}.`;
    }

    if (input.kind === "alignment") {
        return `${handle} completed a Daily Alignment with ${animal} on AnimalDex.`;
    }

    if (input.kind === "fusion") {
        return `${handle} fused a behavior principle on AnimalDex.`;
    }

    if (input.kind === "animal-trial") {
        return `${handle} took the ${animal} Animal Trial on AnimalDex.`;
    }

    return `A completed AnimalDex trade involving ${animal}.`;
}

/** A species page, `/animals/<slug>`, and nothing else. */
const SPECIES_PAGE_PATH = /^\/animals\/([a-z0-9][a-z0-9-]*)$/;

export type DiscoverPostAnimal = {name: string; slug: string; href: string};

/**
 * The one animal a post is about, when it has a species page: what a shared
 * post's page links on to ("More about the …") and lets a visitor speak to.
 * None for an uncertain capture, or for posts about two animals or none.
 */
export function discoverPostAnimal(item: {
    kind: string;
    animalName?: string | null;
    speciesName?: string | null;
    isUncertain?: boolean;
    href?: string | null;
}): DiscoverPostAnimal | null {
    if (item.kind !== "capture" && item.kind !== "animal-trial") return null;
    if (item.isUncertain) return null;
    const name = (item.kind === "capture" ? item.animalName : item.speciesName)?.trim();
    const slug = item.href ? SPECIES_PAGE_PATH.exec(item.href)?.[1] : null;
    if (!name || !slug) return null;
    return {name, slug, href: `/animals/${slug}`};
}

/**
 * Where a feed card's title goes. A signed-in reader opens the capture, as on
 * iOS; anybody else (a shared post opened from a link) gets the public species
 * page, because the capture view is behind sign-in.
 */
export function discoverCaptureTitleHref(item: {captureId: string; href: string}, viewerUserId: string | null) {
    return viewerUserId ? `/app/capture/${encodeURIComponent(item.captureId)}` : item.href;
}
