import {NextRequest, NextResponse} from "next/server";
import {SPECIES_NO_IMAGE_SRC} from "@/data/species-images";
import {createSignedStorageUrl} from "@/lib/capture-storage-image";
import {isServableCaptureMediaReference} from "@/lib/capture-storage-reference";

function buildFallbackUrl(request: NextRequest) {
    return new URL(SPECIES_NO_IMAGE_SRC, request.url);
}

function redirectWithBrowserCache(url: URL | string) {
    const response = NextResponse.redirect(url, 307);
    response.headers.set("Cache-Control", "private, max-age=300, stale-while-revalidate=1800");
    return response;
}

function isAllowedMediaKind(value: string | null) {
    const kind = value?.trim().toLowerCase();
    return kind === "video" || kind === "loop";
}

export async function GET(
    request: NextRequest,
    {params}: {params: {captureId: string}}
) {
    const captureId = params.captureId?.trim();
    const bucket = request.nextUrl.searchParams.get("bucket")?.trim();
    const path = request.nextUrl.searchParams.get("path")?.trim();
    const kind = request.nextUrl.searchParams.get("kind");

    // The reference comes from the query string and is signed with the service
    // role, so it is checked here: capture buckets only, inside a capture folder.
    if (!captureId || !bucket || !path || !isAllowedMediaKind(kind) || !isServableCaptureMediaReference(bucket, path)) {
        return redirectWithBrowserCache(buildFallbackUrl(request));
    }

    try {
        const signedUrl = await createSignedStorageUrl(bucket, path);
        if (!signedUrl) {
            return redirectWithBrowserCache(buildFallbackUrl(request));
        }

        return redirectWithBrowserCache(signedUrl);
    } catch {
        return redirectWithBrowserCache(buildFallbackUrl(request));
    }
}

export const dynamic = "force-dynamic";
