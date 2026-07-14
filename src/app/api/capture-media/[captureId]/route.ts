import {NextRequest, NextResponse} from "next/server";
import {SPECIES_NO_IMAGE_SRC} from "@/data/species-images";
import {createSignedStorageUrl} from "@/lib/capture-storage-image";

function buildFallbackUrl(request: NextRequest) {
    return new URL(SPECIES_NO_IMAGE_SRC, request.url);
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
        return NextResponse.redirect(buildFallbackUrl(request), 307);
    }

    try {
        const signedUrl = await createSignedStorageUrl(bucket, path);
        if (!signedUrl) {
            return NextResponse.redirect(buildFallbackUrl(request), 307);
        }

        return NextResponse.redirect(signedUrl, 307);
    } catch {
        return NextResponse.redirect(buildFallbackUrl(request), 307);
    }
}

export const dynamic = "force-dynamic";
