import "server-only";

import {getSpeciesArtworkRoute, getSpeciesArtworkThumbnailUrl, getSpeciesArtworkUrl} from "@/data/species-artwork";
import {getSupabaseHeaders, getSupabaseServerReadKey, getSupabaseUrl} from "@/lib/supabase-http";

const SPECIES_ARTWORK_BUCKET = "animals";
const INDEX_TTL_MS = 30 * 60 * 1000;
const LIST_PAGE_SIZE = 1000;
const LIST_MAX_PAGES = 20;

type ArtworkIndex = {
    /** Artwork file name keyed by its slug (file name without the extension). */
    bySlug: Map<string, string>;
    /** Candidate file names keyed by each hyphen-delimited token they contain. */
    byToken: Map<string, string[]>;
};

let indexPromise: Promise<ArtworkIndex> | null = null;
let indexExpiresAt = 0;
const resolved = new Map<string, string | null>();

const EMPTY_INDEX: ArtworkIndex = {bySlug: new Map(), byToken: new Map()};

function tokenize(value: string) {
    return value.split("-").filter(Boolean);
}

/**
 * Matchup composites (`lion-vs-gorilla.webp`) live in the same bucket as the
 * per-species icons. They must never stand in for a single animal's artwork.
 */
function isSpeciesArtwork(fileName: string) {
    return fileName.endsWith(".webp") && !tokenize(fileName).includes("vs");
}

async function listBucketFiles(): Promise<string[]> {
    const supabaseUrl = getSupabaseUrl();
    const key = getSupabaseServerReadKey();
    if (!supabaseUrl || !key) return [];

    const names: string[] = [];

    for (let page = 0; page < LIST_MAX_PAGES; page += 1) {
        const response = await fetch(`${supabaseUrl}/storage/v1/object/list/${SPECIES_ARTWORK_BUCKET}`, {
            method: "POST",
            headers: getSupabaseHeaders(key, {"Content-Type": "application/json"}),
            body: JSON.stringify({
                prefix: "",
                limit: LIST_PAGE_SIZE,
                offset: page * LIST_PAGE_SIZE,
                sortBy: {column: "name", order: "asc"}
            }),
            cache: "no-store"
        });

        if (!response.ok) break;

        const rows = (await response.json().catch(() => [])) as Array<{name?: unknown}>;
        if (!Array.isArray(rows) || rows.length === 0) break;

        for (const row of rows) {
            if (typeof row.name === "string" && row.name) names.push(row.name);
        }

        if (rows.length < LIST_PAGE_SIZE) break;
    }

    return names;
}

async function buildIndex(): Promise<ArtworkIndex> {
    const files = await listBucketFiles();
    if (files.length === 0) return EMPTY_INDEX;

    const index: ArtworkIndex = {bySlug: new Map(), byToken: new Map()};

    for (const file of files) {
        if (!isSpeciesArtwork(file)) continue;

        const slug = file.slice(0, -".webp".length);
        index.bySlug.set(slug, file);

        for (const token of Array.from(new Set(tokenize(slug)))) {
            const bucket = index.byToken.get(token);
            if (bucket) bucket.push(file);
            else index.byToken.set(token, [file]);
        }
    }

    return index;
}

async function getIndex(): Promise<ArtworkIndex> {
    if (!indexPromise || indexExpiresAt <= Date.now()) {
        indexExpiresAt = Date.now() + INDEX_TTL_MS;
        resolved.clear();
        indexPromise = buildIndex().catch(() => EMPTY_INDEX);
    }

    return indexPromise;
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
 * Artwork file name for a species slug.
 *
 * Falls back to the closest relative already in the bucket when the slug has no
 * file of its own — `tiger` has no icon but `bengal-tiger` does, and a real
 * tiger illustration beats a broken image. Returns null when nothing matches.
 */
export async function resolveSpeciesArtworkFile(slug: string): Promise<string | null> {
    const normalized = slug.trim().toLowerCase();
    if (!normalized) return null;

    const cached = resolved.get(normalized);
    if (cached !== undefined) return cached;

    const index = await getIndex();
    const exact = index.bySlug.get(normalized);

    if (exact) {
        resolved.set(normalized, exact);
        return exact;
    }

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

    resolved.set(normalized, best);
    return best;
}

export type SpeciesArtworkResolution = {
    /** Object the bucket holds for this slug, exact or borrowed. */
    file: string | null;
    /** Object path the slug is looked up under first. */
    expectedPath: string;
    /** Bucket the lookup runs against. */
    bucket: string;
    matchedVia: "exact" | "relative" | null;
};

/**
 * How a slug's artwork resolved, rather than merely whether it did.
 *
 * A missing icon is fixed by uploading a file, so the path being looked for is
 * the part worth saying out loud; and a slug wearing a relative's illustration
 * looks present on every surface while still being the wrong picture.
 */
export async function describeSpeciesArtwork(slug: string): Promise<SpeciesArtworkResolution> {
    const normalized = slug.trim().toLowerCase();
    const expectedFile = `${normalized}.webp`;
    const file = await resolveSpeciesArtworkFile(normalized);

    return {
        file,
        expectedPath: `${SPECIES_ARTWORK_BUCKET}/${expectedFile}`,
        bucket: SPECIES_ARTWORK_BUCKET,
        matchedVia: !file ? null : file === expectedFile ? "exact" : "relative"
    };
}

/** Batch form of {@link resolveSpeciesArtworkFile} for list surfaces. */
export async function resolveSpeciesArtworkFiles(slugs: string[]): Promise<Map<string, string | null>> {
    await getIndex();
    const entries = await Promise.all(
        Array.from(new Set(slugs)).map(async (slug) => [slug, await resolveSpeciesArtworkFile(slug)] as const)
    );

    return new Map(entries);
}

/**
 * Image src for a slug whose artwork file has already been resolved in bulk.
 *
 * Unresolved slugs go through the route rather than a guessed storage path, so
 * they redirect to the placeholder instead of rendering a broken image.
 */
export function buildSpeciesArtworkSrc(slug: string, artworkFile: string | null | undefined) {
    return artworkFile ? getSpeciesArtworkUrl(slug, artworkFile) : getSpeciesArtworkRoute(slug);
}

/** Artwork URL that points at a file the bucket actually holds. */
export async function getResolvedSpeciesArtworkUrl(slug: string) {
    return buildSpeciesArtworkSrc(slug, await resolveSpeciesArtworkFile(slug));
}

/** Thumbnail URL that points at a file the bucket actually holds. */
export async function getResolvedSpeciesArtworkThumbnailUrl(slug: string, size = 240) {
    return getSpeciesArtworkThumbnailUrl(slug, await resolveSpeciesArtworkFile(slug), size);
}
