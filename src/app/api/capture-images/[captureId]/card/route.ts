import {NextRequest, NextResponse} from "next/server";
import {SPECIES_NO_IMAGE_SRC} from "@/data/species-images";
import {CAPTURE_CARD_THUMBNAIL_TRANSFORM} from "@/lib/capture-card-thumbnail";
import {createSignedStorageUrl, resolveCaptureImageReference} from "@/lib/capture-storage-image";
import {isServableCaptureMediaReference} from "@/lib/capture-storage-reference";
import {createDevRequestTimer, finishDevRequestTimer, timeDevStep} from "@/lib/dev-request-timing";
import {getSiteUrl} from "@/lib/site";

/**
 * The card-sized rendition of a capture's photo: the parent route's redirect,
 * but to a storage render URL (see CAPTURE_CARD_THUMBNAIL_TRANSFORM) instead of
 * the original. Same query (bucket, path, mime, kind), same reference check,
 * same browser-cached 307 whose max-age + stale window sit well inside the
 * signed token's day of validity.
 */
function buildFallbackUrl(request: NextRequest) {
    return new URL(SPECIES_NO_IMAGE_SRC, getSiteUrl());
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
    const timer = createDevRequestTimer("api.capture-images.card", {captureId: params.captureId});
    try {
        const captureId = params.captureId?.trim();
        if (!captureId) {
            return redirectWithBrowserCache(buildFallbackUrl(request));
        }

        const requestedBucket = request.nextUrl.searchParams.get("bucket");
        const requestedPath = request.nextUrl.searchParams.get("path");
        // Same rule as the parent route: a query reference is signed with the
        // service role, so only capture buckets inside a capture folder pass;
        // anything else is dropped and the capture's own image is looked up.
        const isServable = isServableCaptureMediaReference(requestedBucket, requestedPath);
        const imageBucket = isServable ? requestedBucket : null;
        const imagePath = isServable ? requestedPath : null;
        const hasDirectReference = Boolean(imageBucket?.trim() && imagePath?.trim());

        const reference = await timeDevStep(
            timer,
            hasDirectReference ? "resolve.direct" : "resolve.lookup",
            () => resolveCaptureImageReference({
                captureId,
                imageBucket,
                imagePath,
                imageMimeType: request.nextUrl.searchParams.get("mime"),
                imageMediaKind: request.nextUrl.searchParams.get("kind")
            }),
            {hasDirectReference}
        );

        if (!reference?.imageBucket || !reference.imagePath) {
            return redirectWithBrowserCache(buildFallbackUrl(request));
        }

        const signedUrl = await timeDevStep(timer, "storage.sign", () =>
            createSignedStorageUrl(
                reference.imageBucket!,
                reference.imagePath!,
                undefined,
                {...CAPTURE_CARD_THUMBNAIL_TRANSFORM}
            )
        );
        if (!signedUrl) {
            return redirectWithBrowserCache(buildFallbackUrl(request));
        }

        return redirectWithBrowserCache(signedUrl);
    } catch {
        return redirectWithBrowserCache(buildFallbackUrl(request));
    } finally {
        finishDevRequestTimer(timer);
    }
}

export const dynamic = "force-dynamic";
