/**
 * Fusion pages live in the hybrid namespace as
 * `/animal-hybrids/<receiver>-learns-from-<donor>`. Kept apart from
 * `@/data/animal-fusions` so Edge middleware can check the shape without
 * bundling the fusion snapshot.
 */
const SLUG_JOINER = "-learns-from-";

export function buildAnimalFusionSlug(receiverSlug: string, donorSlug: string) {
    return `${receiverSlug}${SLUG_JOINER}${donorSlug}`;
}

export function parseAnimalFusionSlug(slug: string): {receiverSlug: string; donorSlug: string} | null {
    const parts = slug.split(SLUG_JOINER);
    if (parts.length !== 2 || !parts[0] || !parts[1] || parts[0] === parts[1]) {
        return null;
    }
    return {receiverSlug: parts[0], donorSlug: parts[1]};
}
