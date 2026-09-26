import {NextRequest, NextResponse} from "next/server";
import {
    getPublicCaptureImageReference,
    SPECIES_NO_IMAGE_SRC
} from "@/data/species-images";
import {getSpeciesArtworkRoute} from "@/data/species-artwork";
import {SIGNED_URL_LIFETIME_SECONDS, createSignedStorageUrl} from "@/lib/capture-storage-image";

/**
 * A cached redirect must expire well before the signed URL it points at, or the
 * CDN keeps handing out a signature storage has already rejected — which renders
 * as a permanently black tile. One tenth of the signature lifetime leaves ample
 * headroom for a response served at the very end of its own TTL.
 */
const SIGNED_REDIRECT_CACHE_SECONDS = Math.floor(SIGNED_URL_LIFETIME_SECONDS / 10);
const SIGNED_IMAGE_CACHE = `public, s-maxage=${SIGNED_REDIRECT_CACHE_SECONDS}, stale-while-revalidate=${SIGNED_REDIRECT_CACHE_SECONDS}`;
/** Redirects to a static asset carry no signature, so they can be cached hard. */
const STATIC_IMAGE_CACHE = "public, s-maxage=86400, stale-while-revalidate=604800";

function redirectPublic(url: URL | string, cacheControl = STATIC_IMAGE_CACHE) {
    const response = NextResponse.redirect(url, 307);
    response.headers.set("Cache-Control", cacheControl);
    response.headers.set("CDN-Cache-Control", cacheControl.replace("s-maxage=", "max-age="));
    return response;
}

export async function GET(request: NextRequest, {params}: {params: {slug: string}}) {
    const captureId = request.nextUrl.searchParams.get("captureId")?.trim();
    if (!captureId) {
        return redirectPublic(new URL(getSpeciesArtworkRoute(params.slug), request.url));
    }

    const reference = await getPublicCaptureImageReference(captureId, null, false);
    if (!reference?.imageBucket || !reference.imagePath) {
        return redirectPublic(new URL(SPECIES_NO_IMAGE_SRC, request.url));
    }

    try {
        const isThumbnail = request.nextUrl.searchParams.get("thumbnail") === "1";
        const signedUrl = await createSignedStorageUrl(
            reference.imageBucket,
            reference.imagePath,
            SIGNED_URL_LIFETIME_SECONDS,
            isThumbnail ? {width: 320, height: 320, quality: 76, resize: "cover"} : undefined
        );
        if (!signedUrl) {
            return redirectPublic(new URL(SPECIES_NO_IMAGE_SRC, request.url));
        }

        return redirectPublic(signedUrl, SIGNED_IMAGE_CACHE);
    } catch {
        return redirectPublic(new URL(SPECIES_NO_IMAGE_SRC, request.url));
    }
}

export const revalidate = 86400;
