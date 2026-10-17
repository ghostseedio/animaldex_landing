/**
 * Slug → artwork-file resolution over a listing of the `animals` storage bucket.
 *
 * Pure: the listing comes from a live bucket call at request time
 * (species-artwork-index.ts) or from the committed snapshot
 * (species-artwork-snapshot.json) during SEO static generation, where remote
 * reads are forbidden. Both paths must agree on which file a slug gets, so the
 * matching rules live here, once.
 */

export type ArtworkIndex = {
    /** Artwork file name keyed by its slug (file name without the extension). */
    bySlug: Map<string, string>;
    /** Candidate file names keyed by each hyphen-delimited token they contain. */
    byToken: Map<string, string[]>;
    byCompact: Map<string, string>;
};

export const EMPTY_ARTWORK_INDEX: ArtworkIndex = {bySlug: new Map(), byToken: new Map(), byCompact: new Map()};

/** Letters only: "secretary-bird" and "secretarybird", "harriss-hawk" and "harris-s-hawk" meet. */
export function compactKey(value: string) {
    return value.toLowerCase().replace(/[^a-z]/g, "");
}

/**
 * Catalog slugs whose artwork file uses another spelling or name: possessives
 * the catalog drops ("Pallas's cat" → pallass-cat), single-word file names and
 * common synonyms. Value is the file name without ".webp".
 */
export const ARTWORK_ALIASES: Record<string, string> = {
    "pallas-cat": "pallass-cat",
    "xantus-murrelet": "xantuss-murrelet",
    "kirk-dik-dik": "kirks-dik-dik",
    "reeves-muntjac": "reevess-muntjac",
    "common-tailorbird": "tailorbird",
    "drill-monkey": "drill",
    "striped-polecat": "zorilla",
    "domestic-pig": "pig"
};

export function tokenize(value: string) {
    return value.split("-").filter(Boolean);
}

/**
 * Matchup composites (`lion-vs-gorilla.webp`) live in the same bucket as the
 * per-species icons. They must never stand in for a single animal's artwork.
 */
export function isSpeciesArtwork(fileName: string) {
    return fileName.endsWith(".webp") && !tokenize(fileName).includes("vs");
}

/** Index a bucket listing; an empty listing yields the shared empty index. */
export function buildArtworkIndex(files: readonly string[]): ArtworkIndex {
    if (files.length === 0) return EMPTY_ARTWORK_INDEX;

    const index: ArtworkIndex = {bySlug: new Map(), byToken: new Map(), byCompact: new Map()};

    for (const file of files) {
        if (!isSpeciesArtwork(file)) continue;

        const slug = file.slice(0, -".webp".length);
        index.bySlug.set(slug, file);
        if (!index.byCompact.has(compactKey(slug))) index.byCompact.set(compactKey(slug), file);

        for (const token of Array.from(new Set(tokenize(slug)))) {
            const bucket = index.byToken.get(token);
            if (bucket) bucket.push(file);
            else index.byToken.set(token, [file]);
        }
    }

    return index;
}

/** Index of the first contiguous run of `needle` inside `haystack`, or -1. */
function tokenRunIndex(haystack: string[], needle: string[]) {
    for (let start = 0; start + needle.length <= haystack.length; start += 1) {
        if (needle.every((token, offset) => haystack[start + offset] === token)) return start;
    }

    return -1;
}

/**
 * A relative name ranks higher the more it reads as "a kind of <slug>".
 * `bengal-tiger` is a tiger; `tiger-swallowtail` is a butterfly that merely
 * borrows the word, so trailing matches beat leading ones. Returns 0 for names
 * that do not contain the slug's words at all.
 */
function scoreCandidate(candidateSlug: string, slugTokens: string[]) {
    const candidateTokens = tokenize(candidateSlug);
    const runIndex = tokenRunIndex(candidateTokens, slugTokens);
    if (runIndex < 0) return 0;

    const endsWithSlug = runIndex + slugTokens.length === candidateTokens.length;
    const extraTokens = candidateTokens.length - slugTokens.length;

    return (endsWithSlug ? 1000 : 500) - extraTokens;
}

/**
 * Artwork file name for a species slug within `index`.
 *
 * Exact file, then the alias table, then the letters-only spelling; failing
 * those, the closest relative already in the bucket — `tiger` has no icon but
 * `bengal-tiger` does, and a real tiger illustration beats a broken image.
 * Returns null when nothing matches.
 */
export function resolveArtworkFileInIndex(index: ArtworkIndex, slug: string): string | null {
    const normalized = slug.trim().toLowerCase();
    if (!normalized) return null;

    const alias = ARTWORK_ALIASES[normalized];
    const exact = index.bySlug.get(normalized)
        ?? (alias ? index.bySlug.get(alias) : undefined)
        ?? index.byCompact.get(compactKey(normalized));

    if (exact) return exact;

    const slugTokens = tokenize(normalized);
    // Any name containing the whole slug must contain its rarest word, so the
    // shortest token bucket is a complete candidate set.
    const candidates = slugTokens
        .map((token) => index.byToken.get(token) ?? [])
        .reduce<string[] | null>((smallest, bucket) => (!smallest || bucket.length < smallest.length ? bucket : smallest), null);

    let best: string | null = null;
    let bestScore = 0;

    for (const file of candidates ?? []) {
        const score = scoreCandidate(file.slice(0, -".webp".length), slugTokens);
        // Alphabetical tiebreak keeps the pick stable across rebuilds.
        if (score > bestScore || (score === bestScore && score > 0 && best !== null && file < best)) {
            best = file;
            bestScore = score;
        }
    }

    return best;
}
