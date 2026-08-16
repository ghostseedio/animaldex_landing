import {NextRequest, NextResponse} from "next/server";
import {
    getPublicCaptureImageReference,
    getSpeciesRepresentativeImageReference,
    SPECIES_NO_IMAGE_SRC
} from "@/data/species-images";
import {SIGNED_URL_LIFETIME_SECONDS, createSignedStorageUrl} from "@/lib/capture-storage-image";
import {getSpeciesBySlug} from "@/data/species";
import {getDatabaseSpeciesBySlug} from "@/data/database-species-pages";

function buildFallbackUrl(request: NextRequest) {
    return new URL(SPECIES_NO_IMAGE_SRC, request.url);
}

export async function GET(request: NextRequest, {params}: {params: {slug: string}}) {
    const captureId = request.nextUrl.searchParams.get("captureId");
    // A capture ID is already the exact media identity. Resolving the species
    // first walks the database catalog/alias chain and can add seconds to every
    // thumbnail request without changing which image is returned.
    const reference = captureId
        ? await getPublicCaptureImageReference(captureId, null, false)
        : await getSpeciesRepresentativeImageReference(
            params.slug,
            getSpeciesBySlug(params.slug) ?? await getDatabaseSpeciesBySlug(params.slug)
        );

    if (!reference?.imageBucket || !reference.imagePath) {
        return NextResponse.redirect(buildFallbackUrl(request), 307);
    }

    try {
        const isThumbnail = request.nextUrl.searchParams.get("thumbnail") === "1";
        const signedUrl = await createSignedStorageUrl(
            reference.imageBucket,
            reference.imagePath,
            // This route caches the redirect in the browser for an hour and
            // serves it stale for a day, so the token has to outlast both.
            SIGNED_URL_LIFETIME_SECONDS,
            isThumbnail ? {width: 320, height: 320, quality: 76, resize: "cover"} : undefined
        );
        if (!signedUrl) {
            return NextResponse.redirect(buildFallbackUrl(request), 307);
        }

        const response = NextResponse.redirect(signedUrl, 307);
        response.headers.set("Cache-Control", "private, max-age=3600, stale-while-revalidate=86400");
        return response;
    } catch {
        return NextResponse.redirect(buildFallbackUrl(request), 307);
    }
}

export function generateStaticParams() {
    return [];
}

export const dynamic = "force-dynamic";
