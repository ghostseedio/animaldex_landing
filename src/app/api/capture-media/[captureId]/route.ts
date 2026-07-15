import {NextRequest, NextResponse} from "next/server";
import {SPECIES_NO_IMAGE_SRC} from "@/data/species-images";
import {createSignedStorageUrl} from "@/lib/capture-storage-image";

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

    if (!captureId || !bucket || !path || !isAllowedMediaKind(kind)) {
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
