import {NextRequest, NextResponse} from "next/server";
import {
    getPublicCaptureImageReference,
    getSpeciesRepresentativeImageReference,
    SPECIES_NO_IMAGE_SRC
} from "@/data/species-images";
import {createSignedStorageUrl} from "@/lib/capture-storage-image";
import {getSpeciesBySlug} from "@/data/species";
import {getDatabaseSpeciesBySlug} from "@/data/database-species-pages";

function buildFallbackUrl(request: NextRequest) {
    return new URL(SPECIES_NO_IMAGE_SRC, request.url);
}

export async function GET(request: NextRequest, {params}: {params: {slug: string}}) {
    const captureId = request.nextUrl.searchParams.get("captureId");
    const entry = getSpeciesBySlug(params.slug) ?? await getDatabaseSpeciesBySlug(params.slug);
    const reference = captureId
        ? await getPublicCaptureImageReference(captureId, entry)
        : await getSpeciesRepresentativeImageReference(params.slug, entry);

    if (!reference?.imageBucket || !reference.imagePath) {
        return NextResponse.redirect(buildFallbackUrl(request), 307);
    }

    try {
        const signedUrl = await createSignedStorageUrl(reference.imageBucket, reference.imagePath);
        if (!signedUrl) {
            return NextResponse.redirect(buildFallbackUrl(request), 307);
        }

        return NextResponse.redirect(signedUrl, 307);
    } catch {
        return NextResponse.redirect(buildFallbackUrl(request), 307);
    }
}

export function generateStaticParams() {
    return [];
}

export const dynamic = "force-dynamic";
