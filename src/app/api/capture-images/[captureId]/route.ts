import {NextRequest, NextResponse} from "next/server";
import {SPECIES_NO_IMAGE_SRC} from "@/data/species-images";
import {createSignedStorageUrl, resolveCaptureImageReference} from "@/lib/capture-storage-image";

function buildFallbackUrl(request: NextRequest) {
    return new URL(SPECIES_NO_IMAGE_SRC, request.url);
}

export async function GET(
    request: NextRequest,
    {params}: {params: {captureId: string}}
) {
    const captureId = params.captureId?.trim();
    if (!captureId) {
        return NextResponse.redirect(buildFallbackUrl(request), 307);
    }

    const imageBucket = request.nextUrl.searchParams.get("bucket");
    const imagePath = request.nextUrl.searchParams.get("path");
    const imageMimeType = request.nextUrl.searchParams.get("mime");
    const imageMediaKind = request.nextUrl.searchParams.get("kind");

    try {
        const reference = await resolveCaptureImageReference({
            captureId,
            imageBucket,
            imagePath,
            imageMimeType,
            imageMediaKind
        });

        if (!reference?.imageBucket || !reference.imagePath) {
            return NextResponse.redirect(buildFallbackUrl(request), 307);
        }

        const signedUrl = await createSignedStorageUrl(reference.imageBucket, reference.imagePath);
        if (!signedUrl) {
            return NextResponse.redirect(buildFallbackUrl(request), 307);
        }

        return NextResponse.redirect(signedUrl, 307);
    } catch {
        return NextResponse.redirect(buildFallbackUrl(request), 307);
    }
}

export const dynamic = "force-dynamic";
