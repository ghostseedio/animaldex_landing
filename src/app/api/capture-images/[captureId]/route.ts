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

/**
 * Serve the bytes ourselves instead of redirecting to storage.
 *
 * The redirect is right for public pages: it costs no bandwidth and the CDN
 * does the work. It is wrong for the admin panel, where every failure so far
 * has lived in the hop — a cached redirect outliving its signed token, and
 * whatever it is in a given browser that quietly declines a cross-origin
 * image redirect. Proxying keeps the request on this origin from start to
 * finish, so an <img> either gets the picture or an error we can see.
 *
 * Deliberately not the default: the traffic that would move onto this app is
 * only worth spending where reliability matters more than cost.
 */
async function proxyImage(signedUrl: string) {
    const upstream = await fetch(signedUrl, {cache: "no-store"});

    if (!upstream.ok || !upstream.body) {
        return NextResponse.json({error: `Storage returned ${upstream.status}`}, {status: 502});
    }

    return new NextResponse(upstream.body, {
        status: 200,
        headers: {
            "Content-Type": upstream.headers.get("content-type") ?? "image/jpeg",
            ...(upstream.headers.get("content-length")
                ? {"Content-Length": upstream.headers.get("content-length")!}
                : {}),
            // Safe to hold: the URL is keyed on the capture id, and a capture's
            // primary image does not change underneath it.
            "Cache-Control": "private, max-age=3600"
        }
    });
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

        return request.nextUrl.searchParams.get("proxy") === "1"
            ? await proxyImage(signedUrl)
            : redirectWithBrowserCache(signedUrl);
    } catch {
        return redirectWithBrowserCache(buildFallbackUrl(request));
    }
}

export const dynamic = "force-dynamic";
