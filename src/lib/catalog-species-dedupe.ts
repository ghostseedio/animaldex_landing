import type {SpeciesEntry} from "@/data/species";
import {getAnimalDexNumberFromEntry} from "@/lib/animaldex-number";
import {COLLECTION_IDENTITY_ALIASES, resolveCollectionIdentityToken} from "@/lib/collection-identity-aliases";

function normalizeIdentityToken(value: string) {
    return value.trim().toLowerCase().replace(/-/g, "_");
}

export function speciesCatalogIdentityKey(entry: Pick<SpeciesEntry, "slug" | "normalizedIdentityKey">) {
    const raw = normalizeIdentityToken(entry.normalizedIdentityKey ?? entry.slug);

    return resolveCollectionIdentityToken(raw);
}

function isAliasCatalogEntry(entry: Pick<SpeciesEntry, "slug" | "normalizedIdentityKey">, canonicalKey: string) {
    const raw = normalizeIdentityToken(entry.normalizedIdentityKey ?? entry.slug);

    return resolveCollectionIdentityToken(raw) === canonicalKey && raw !== canonicalKey;
}

function catalogEntryPriority(entry: SpeciesEntry, canonicalKey: string) {
    const canonicalSlug = canonicalKey.replace(/_/g, "-");
    const rawIdentity = normalizeIdentityToken(entry.normalizedIdentityKey ?? entry.slug);
    let score = 0;

    if (entry.slug === canonicalSlug) {
        score += 1_000;
    }

    if (rawIdentity === canonicalKey) {
        score += 500;
    }

    if (!COLLECTION_IDENTITY_ALIASES[rawIdentity]) {
        score += 100;
    }

    if (isAliasCatalogEntry(entry, canonicalKey)) {
        score -= 2_000;
    }

    const animalDexNumber = getAnimalDexNumberFromEntry(entry);

    if (animalDexNumber != null) {
        score -= animalDexNumber * 0.001;
    }

    return score;
}

function pickCanonicalCatalogEntry(canonicalKey: string, group: SpeciesEntry[]) {
    return group
        .slice()
        .sort((left, right) => {
            const scoreDelta = catalogEntryPriority(right, canonicalKey) - catalogEntryPriority(left, canonicalKey);

            if (scoreDelta !== 0) {
                return scoreDelta;
            }

            return left.name.localeCompare(right.name);
        })[0];
}

/** Collapse alias catalog rows (e.g. african_lion + lion) onto one canonical species entry. */
export function dedupeCatalogSpeciesEntries(entries: SpeciesEntry[]) {
    const groups = new Map<string, SpeciesEntry[]>();

    for (const entry of entries) {
        const canonicalKey = speciesCatalogIdentityKey(entry);
        const group = groups.get(canonicalKey) ?? [];
        group.push(entry);
        groups.set(canonicalKey, group);
    }

    return Array.from(groups.entries())
        .map(([canonicalKey, group]) => pickCanonicalCatalogEntry(canonicalKey, group));
}
