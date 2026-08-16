import {NextRequest, NextResponse} from "next/server";
import {getSpeciesArtworkThumbnailUrl, getSpeciesArtworkUrl} from "@/data/species-artwork";
import {resolveSpeciesArtworkFile} from "@/data/species-artwork-index";
import {SPECIES_NO_IMAGE_SRC} from "@/lib/species-image-public";

export const runtime = "nodejs";

/**
 * Redirects to the catalog artwork a species actually has.
 *
 * Artwork is stored one file per slug, but plenty of catalog slugs are broader
 * than any single illustration (`tiger` has none; `bengal-tiger` does). Going
 * through this route means every surface — server or client — lands on a real
 * file instead of a broken image.
 */
export async function GET(request: NextRequest, {params}: {params: {slug: string}}) {
    const size = Number(request.nextUrl.searchParams.get("size"));
    const artworkFile = await resolveSpeciesArtworkFile(params.slug).catch(() => null);

    if (!artworkFile) {
        return NextResponse.redirect(new URL(SPECIES_NO_IMAGE_SRC, request.url), 307);
    }

    const target = Number.isFinite(size) && size > 0
        ? getSpeciesArtworkThumbnailUrl(params.slug, artworkFile, Math.min(1024, Math.round(size)))
        : getSpeciesArtworkUrl(params.slug, artworkFile);

    const response = NextResponse.redirect(target, 307);
    // The slug-to-file mapping only changes when artwork is added to the bucket.
    response.headers.set("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
    return response;
}

export const dynamic = "force-dynamic";
