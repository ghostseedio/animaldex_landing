import {NextRequest, NextResponse} from "next/server";
import {
    getSpeciesImageReferences,
    getSpeciesRepresentativeImageReference,
    SPECIES_NO_IMAGE_SRC
} from "@/data/species-images";
import {
    getSupabaseHeaders,
    getSupabasePublicKey,
    getSupabaseServiceKey,
    getSupabaseUrl
} from "@/lib/supabase-http";

function encodeStoragePath(path: string) {
    return path
        .split("/")
        .map((segment) => encodeURIComponent(segment))
        .join("/");
}

function buildFallbackUrl(request: NextRequest) {
    return new URL(SPECIES_NO_IMAGE_SRC, request.url);
}

function getSupabaseConfig() {
    const supabaseUrl = getSupabaseUrl();
    const anonKey = getSupabasePublicKey();
    const serviceRoleKey = getSupabaseServiceKey();

    return {
        supabaseUrl,
        anonKey,
        serviceRoleKey
    };
}

function toAbsoluteSignedUrl(supabaseUrl: string, signedUrl: string) {
    if (signedUrl.startsWith("http://") || signedUrl.startsWith("https://")) {
        return signedUrl;
    }

    if (signedUrl.startsWith("/")) {
        return `${supabaseUrl}/storage/v1${signedUrl}`;
    }

    return `${supabaseUrl}/storage/v1/${signedUrl.replace(/^storage\/v1\//, "")}`;
}

export async function GET(request: NextRequest, {params}: {params: {slug: string}}) {
    const captureId = request.nextUrl.searchParams.get("captureId");
    const reference = captureId
        ? (await getSpeciesImageReferences(params.slug)).find((item) => item.captureId === captureId) ?? null
        : await getSpeciesRepresentativeImageReference(params.slug);
    const {supabaseUrl, anonKey, serviceRoleKey} = getSupabaseConfig();

    if (!reference || !supabaseUrl || !reference.imageBucket || !reference.imagePath) {
        return NextResponse.redirect(buildFallbackUrl(request), 307);
    }

    try {
        let response: Response | null = null;

        if (serviceRoleKey) {
            const signEndpoint = `${supabaseUrl}/storage/v1/object/sign/${reference.imageBucket}/${encodeStoragePath(reference.imagePath)}`;
            const signResponse = await fetch(signEndpoint, {
                method: "POST",
                headers: getSupabaseHeaders(serviceRoleKey, {"Content-Type": "application/json"}),
                body: JSON.stringify({expiresIn: 60 * 60}),
                cache: "no-store"
            });

            if (!signResponse.ok) {
                const signError = await signResponse.text();
                console.error("[species-images-route] Signed URL creation failed", {
                    slug: params.slug,
                    status: signResponse.status,
                    error: signError
                });
            } else {
                const signBody = await signResponse.json() as {signedURL?: string; signedUrl?: string};
                const signedUrl = signBody.signedURL ?? signBody.signedUrl;

                if (!signedUrl) {
                    console.error("[species-images-route] Signed URL missing from response", {slug: params.slug});
                } else {
                    response = await fetch(toAbsoluteSignedUrl(supabaseUrl, signedUrl), {
                        headers: {
                            Accept: reference.mimeType ?? "image/*"
                        },
                        cache: "no-store"
                    });
                }
            }
        }

        if (!response && anonKey) {
            const objectEndpoint = `${supabaseUrl}/storage/v1/object/authenticated/${reference.imageBucket}/${encodeStoragePath(reference.imagePath)}`;
            response = await fetch(objectEndpoint, {
                headers: getSupabaseHeaders(anonKey, {Accept: reference.mimeType ?? "image/*"}),
                cache: "no-store"
            });
        }

        if (!response) {
            console.error("[species-images-route] No storage fetch could be attempted", {
                slug: params.slug,
                hasServiceRoleKey: Boolean(serviceRoleKey),
                hasAnonKey: Boolean(anonKey)
            });
            return NextResponse.redirect(buildFallbackUrl(request), 307);
        }

        if (!response.ok || !response.body) {
            const storageError = await response.text();
            console.error("[species-images-route] Storage fetch failed", {
                slug: params.slug,
                status: response.status,
                error: storageError
            });
            return NextResponse.redirect(buildFallbackUrl(request), 307);
        }

        const headers = new Headers({
            "Content-Type": response.headers.get("Content-Type") ?? reference.mimeType ?? "image/jpeg",
            "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400"
        });
        const contentLength = response.headers.get("Content-Length");

        if (contentLength) {
            headers.set("Content-Length", contentLength);
        }

        return new NextResponse(response.body, {
            status: 200,
            headers: {
                ...Object.fromEntries(headers.entries())
            }
        });
    } catch {
        console.error("[species-images-route] Unexpected error", {
            slug: params.slug
        });
        return NextResponse.redirect(buildFallbackUrl(request), 307);
    }
}

export function generateStaticParams() {
    return [];
}

export const dynamic = "force-dynamic";
