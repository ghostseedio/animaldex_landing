/** Matches iOS IdentityKind short labels and chip tones. */

const IDENTITY_KIND_LABELS: Record<string, string> = {
    species: "Species-level ID",
    subspecies: "Subspecies-level ID",
    genus: "Genus-level ID",
    family: "Family-level ID",
    group: "Group-level ID",
    breed: "Breed-level ID",
    variant: "Breed-level ID",
    cross_breed: "Hybrid-level ID",
    hybrid: "Hybrid-level ID",
    domestic_parent: "Domestic animal",
    generic_parent: "Group-level ID",
    broad_fallback: "Broad fallback ID"
};

const HIDDEN_IDENTITY_KINDS = new Set(["recognition_bucket", "unknown", ""]);

/** Matches iOS IdentityKind.needsSpeciesEvidence / defaultsToRefinableWhenUnspecified. */
const REFINABLE_IDENTITY_KINDS = new Set([
    "genus",
    "family",
    "group",
    "generic_parent",
    "broad_fallback"
]);

export type IdentityKindTone = "species" | "group" | "breed" | "fallback" | "neutral";

export type IdentityKindExplanation = {
    title: string;
    body: string;
    retakeGuidance?: string;
};

export function normalizeIdentityKind(raw: string | null | undefined) {
    return raw?.trim().toLowerCase() ?? "";
}

export function identityKindShortLabel(raw: string | null | undefined) {
    const kind = normalizeIdentityKind(raw);
    if (!kind || HIDDEN_IDENTITY_KINDS.has(kind)) return null;
    return IDENTITY_KIND_LABELS[kind] ?? null;
}

export function isUserVisibleIdentityKind(raw: string | null | undefined) {
    return identityKindShortLabel(raw) != null;
}

/** Matches iOS IdentityKindChip palette groups. */
export function identityKindTone(raw: string | null | undefined): IdentityKindTone {
    const kind = normalizeIdentityKind(raw);
    switch (kind) {
        case "species":
        case "subspecies":
            return "species";
        case "genus":
        case "family":
        case "group":
        case "generic_parent":
            return "group";
        case "breed":
        case "variant":
        case "cross_breed":
        case "hybrid":
        case "domestic_parent":
            return "breed";
        case "broad_fallback":
            return "fallback";
        default:
            return "neutral";
    }
}

/**
 * Builds the Identity level sheet/tooltip copy, matching iOS IdentityKindInfoResolver
 * fallbacks when no catalog/capture explanation is supplied.
 */
export function resolveIdentityKindExplanation({
    identityKind,
    animalName,
    explanation,
    retakeGuidance,
    label
}: {
    identityKind?: string | null;
    animalName?: string | null;
    explanation?: string | null;
    retakeGuidance?: string | null;
    label?: string | null;
}): IdentityKindExplanation | null {
    const title = identityKindShortLabel(identityKind) ?? label?.trim() ?? null;
    if (!title) return null;

    const kind = normalizeIdentityKind(identityKind);
    const displayName = animalName?.trim() || "This animal";
    const catalogOrCaptureExplanation = explanation?.trim() || null;
    const body = catalogOrCaptureExplanation
        ?? (REFINABLE_IDENTITY_KINDS.has(kind)
            ? `${displayName} is currently at ${title}. A sharper, closer capture with more diagnostic detail visible may allow a more specific identification.`
            : `${displayName} is identified at ${title}.`);

    return {
        title,
        body,
        retakeGuidance: retakeGuidance?.trim() || undefined
    };
}
