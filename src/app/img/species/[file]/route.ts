import {NextResponse} from "next/server";
import {getSpeciesArtworkUrl} from "@/data/species-artwork";
import {getExactSpeciesArtworkFile} from "@/data/species-artwork-index";
import {parseSpeciesImageFile} from "@/lib/species-image-path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Larger than any species artwork in the bucket; anything bigger is refused rather than relayed. */
const MAX_BYTES = 8 * 1024 * 1024;
/** Raster types only: an SVG could carry script on this origin. */
const IMAGE_TYPES = new Set(["image/webp", "image/png", "image/jpeg", "image/avif"]);

/**
 * A species' own artwork from animaldex.app: `/img/species/<slug>.webp`.
 *
 * Supabase storage sends `x-robots-tag: none` with every public object, which
 * keeps the pictures out of Google Images. This route relays the same file with
 * no robots header and long cache headers, so Cloudflare holds it and the app
 * is asked about once a month per image.
 *
 * Not an open proxy: the host is the project's storage, the bucket is the
 * public `animals` bucket only, and the file must be exactly the slug's own
 * entry in the bucket listing (no relative stands in). Anything else is a 404.
 */
export async function GET(_request: Request, {params}: {params: {file: string}}) {
    const slug = parseSpeciesImageFile(decodeURIComponent(params.file));
    const file = slug ? await getExactSpeciesArtworkFile(slug).catch(() => null) : null;
    if (!slug || !file) return notFound();

    const upstream = await fetch(getSpeciesArtworkUrl(slug, file), {cache: "no-store"}).catch(() => null);
    const type = (upstream?.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    const length = Number(upstream?.headers.get("content-length") ?? 0);
    if (!upstream?.ok || !IMAGE_TYPES.has(type) || length > MAX_BYTES) return notFound();

    const body = await upstream.arrayBuffer();
    if (body.byteLength > MAX_BYTES) return notFound();

    const cache = "public, max-age=604800, s-maxage=2592000, stale-while-revalidate=2592000";
    return new NextResponse(body, {
        status: 200,
        headers: {
            "Content-Type": type,
            "Content-Length": String(body.byteLength),
            "Cache-Control": cache,
            "CDN-Cache-Control": cache,
            "X-Content-Type-Options": "nosniff"
        }
    });
}

function notFound() {
    return new NextResponse(null, {status: 404, headers: {"Cache-Control": "public, max-age=3600"}});
}
