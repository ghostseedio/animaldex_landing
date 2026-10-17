import "server-only";

import {getSpeciesArtworkRoute, getSpeciesArtworkThumbnailUrl, getSpeciesArtworkUrl} from "@/data/species-artwork";
import {
    ArtworkIndex,
    EMPTY_ARTWORK_INDEX,
    buildArtworkIndex,
    resolveArtworkFileInIndex
} from "@/data/species-artwork-resolution";
import artworkSnapshot from "@/data/species-artwork-snapshot.json";
import {isSeoSsgRemoteForbidden} from "@/lib/seo-ssg-remote-guard";
import {getSupabaseHeaders, getSupabaseServerReadKey, getSupabaseUrl} from "@/lib/supabase-http";
import {SPECIES_NO_IMAGE_SRC} from "@/lib/species-image-public";

const SPECIES_ARTWORK_BUCKET = "animals";
const INDEX_TTL_MS = 30 * 60 * 1000;
const LIST_PAGE_SIZE = 1000;
const LIST_MAX_PAGES = 20;

let indexPromise: Promise<ArtworkIndex> | null = null;
let indexExpiresAt = 0;
const resolved = new Map<string, string | null>();

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
            next: {revalidate: 1800}
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

async function getIndex(): Promise<ArtworkIndex> {
    if (!indexPromise || indexExpiresAt <= Date.now()) {
        indexExpiresAt = Date.now() + INDEX_TTL_MS;
        resolved.clear();
        indexPromise = listBucketFiles().then(buildArtworkIndex).catch(() => EMPTY_ARTWORK_INDEX);
    }

    return indexPromise;
}

let snapshotIndex: ArtworkIndex | null = null;

/**
 * The bucket listing committed by scripts/refreshSpeciesArtworkSnapshot.mts.
 * It is what SEO static generation resolves against: the production build
 * forbids remote reads (ADEX_SEO_SSG_NO_REMOTE), and a `next.revalidate` fetch
 * inside a `revalidate = false` page would silently turn it into ISR.
 */
function getSnapshotIndex(): ArtworkIndex {
    snapshotIndex ??= buildArtworkIndex(artworkSnapshot.files);

    return snapshotIndex;
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

    const best = resolveArtworkFileInIndex(await getIndex(), normalized);

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

/** Largest thumbnail the storage image renderer is asked for; mirrors the artwork route. */
const MAX_THUMBNAIL_SIZE = 1024;

function buildDirectArtworkUrl(slug: string, artworkFile: string, size?: number) {
    return Number.isFinite(size) && (size as number) > 0
        ? getSpeciesArtworkThumbnailUrl(slug, artworkFile, Math.min(MAX_THUMBNAIL_SIZE, Math.round(size as number)))
        : getSpeciesArtworkUrl(slug, artworkFile);
}

/**
 * Final image URLs for many slugs, resolved as the `/api/species-artwork` route
 * would redirect them, so server-rendered markup can skip the 307 hop. Keys are
 * the slugs exactly as passed; the value is the storage file (or its thumbnail
 * rendition when `size` is given), or the placeholder when the live bucket has
 * nothing for the slug.
 *
 * A slug is left out of the map when it cannot be resolved here, and callers
 * fall back to the route, which resolves again at request time:
 * - the live listing is unavailable (no Supabase credentials, listing failure);
 * - during SEO static generation (`isSeoSsgRemoteForbidden`), where no remote
 *   read may run, the committed snapshot is used instead and a slug it does not
 *   cover (artwork uploaded after the last refresh) keeps the route rather than
 *   baking a placeholder into a page that never revalidates.
 */
export async function getSpeciesArtworkDirectUrls(slugs: Iterable<string>, size?: number): Promise<Map<string, string>> {
    const unique = Array.from(new Set(Array.from(slugs).filter((slug) => typeof slug === "string" && slug.trim())));
    const urls = new Map<string, string>();
    if (unique.length === 0) return urls;

    const fromSnapshot = isSeoSsgRemoteForbidden();
    const index = fromSnapshot ? getSnapshotIndex() : await getIndex();
    if (index.bySlug.size === 0) return urls;

    for (const slug of unique) {
        const file = resolveArtworkFileInIndex(index, slug);

        if (file) urls.set(slug, buildDirectArtworkUrl(slug, file, size));
        else if (!fromSnapshot) urls.set(slug, SPECIES_NO_IMAGE_SRC);
    }

    return urls;
}

/** Single-slug form of {@link getSpeciesArtworkDirectUrls}; the route when unresolved. */
export async function getSpeciesArtworkDirectUrl(slug: string, size?: number): Promise<string> {
    const urls = await getSpeciesArtworkDirectUrls([slug], size);

    return urls.get(slug) ?? getSpeciesArtworkRoute(slug, size);
}
