import {NextRequest, NextResponse} from "next/server";
import {
    getPublicCaptureImageReference,
    SPECIES_NO_IMAGE_SRC
} from "@/data/species-images";
import {getSpeciesArtworkRoute} from "@/data/species-artwork";
import {SIGNED_URL_LIFETIME_SECONDS, createSignedStorageUrl} from "@/lib/capture-storage-image";

const PUBLIC_IMAGE_CACHE = "public, s-maxage=86400, stale-while-revalidate=604800";

function redirectPublic(url: URL | string) {
    const response = NextResponse.redirect(url, 307);
    response.headers.set("Cache-Control", PUBLIC_IMAGE_CACHE);
    response.headers.set("CDN-Cache-Control", "max-age=86400, stale-while-revalidate=604800");
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

        return redirectPublic(signedUrl);
    } catch {
        return redirectPublic(new URL(SPECIES_NO_IMAGE_SRC, request.url));
    }
}

export const revalidate = 86400;
