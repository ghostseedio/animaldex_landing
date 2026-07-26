export const DISCOVER_POST_KINDS = ["capture", "alignment", "fusion", "challenge", "trade"] as const;

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

    if (input.kind === "challenge") {
        return collector ? `AnimalDex challenge · ${collector}` : "AnimalDex challenge";
    }

    if (input.kind === "alignment") {
        return collector ? `Daily alignment · ${collector}` : "Daily alignment on AnimalDex";
    }

    if (input.kind === "fusion") {
        return "Principle fusion on AnimalDex";
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
        return `A live AnimalDex challenge result shared by ${handle}.`;
    }

    if (input.kind === "alignment") {
        return `${handle} completed a Daily Alignment with ${animal} on AnimalDex.`;
    }

    if (input.kind === "fusion") {
        return `${handle} fused a behavior principle on AnimalDex.`;
    }

    return `A completed AnimalDex trade involving ${animal}.`;
}
