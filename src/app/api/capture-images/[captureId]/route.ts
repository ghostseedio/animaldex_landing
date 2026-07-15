import {NextRequest, NextResponse} from "next/server";
import {SPECIES_NO_IMAGE_SRC} from "@/data/species-images";
import {createSignedStorageUrl, resolveCaptureImageReference} from "@/lib/capture-storage-image";

function buildFallbackUrl(request: NextRequest) {
    return new URL(SPECIES_NO_IMAGE_SRC, request.url);
}

function redirectWithBrowserCache(url: URL | string) {
    const response = NextResponse.redirect(url, 307);
    response.headers.set("Cache-Control", "private, max-age=300, stale-while-revalidate=1800");
    return response;
}

export async function GET(
    request: NextRequest,
    {params}: {params: {captureId: string}}
) {
    const captureId = params.captureId?.trim();
    if (!captureId) {
        return redirectWithBrowserCache(buildFallbackUrl(request));
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
            return redirectWithBrowserCache(buildFallbackUrl(request));
        }

        const signedUrl = await createSignedStorageUrl(reference.imageBucket, reference.imagePath);
        if (!signedUrl) {
            return redirectWithBrowserCache(buildFallbackUrl(request));
        }

        return redirectWithBrowserCache(signedUrl);
    } catch {
        return redirectWithBrowserCache(buildFallbackUrl(request));
    }
}

export const dynamic = "force-dynamic";
