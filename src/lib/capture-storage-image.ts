import "server-only";

import type {SpeciesImageReference} from "@/data/species-images";
import {getPublicCaptureImageReference} from "@/data/species-images";
import {
    getSupabaseHeaders,
    getSupabaseServiceKey,
    getSupabaseUrl
} from "@/lib/supabase-http";

const SIGN_TIMEOUT_MS = 12_000;
const FETCH_TIMEOUT_MS = 15_000;

export function encodeStoragePath(path: string) {
    return path
        .split("/")
        .map((segment) => encodeURIComponent(segment))
        .join("/");
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

export async function createSignedStorageUrl(
    bucket: string,
    path: string,
    expiresInSeconds = 60 * 60
): Promise<string | null> {
    const supabaseUrl = getSupabaseUrl();
    const serviceRoleKey = getSupabaseServiceKey();

    if (!supabaseUrl || !serviceRoleKey || !bucket || !path) {
        return null;
    }

    const signEndpoint = `${supabaseUrl}/storage/v1/object/sign/${bucket}/${encodeStoragePath(path)}`;

    try {
        const signResponse = await fetch(signEndpoint, {
            method: "POST",
            headers: getSupabaseHeaders(serviceRoleKey, {"Content-Type": "application/json"}),
            body: JSON.stringify({expiresIn: expiresInSeconds}),
            cache: "no-store",
            signal: AbortSignal.timeout(SIGN_TIMEOUT_MS)
        });

        if (!signResponse.ok) {
            return null;
        }

        const signBody = await signResponse.json() as {signedURL?: string; signedUrl?: string};
        const signedUrl = signBody.signedURL ?? signBody.signedUrl;
        return signedUrl ? toAbsoluteSignedUrl(supabaseUrl, signedUrl) : null;
    } catch {
        return null;
    }
}

export async function resolveCaptureImageReference(input: {
    captureId: string;
    imageBucket?: string | null;
    imagePath?: string | null;
    imageMimeType?: string | null;
    imageMediaKind?: string | null;
}): Promise<SpeciesImageReference | null> {
    const directReference = await getPublicCaptureImageReference(input.captureId);

    if (directReference?.imageBucket && directReference.imagePath) {
        return directReference;
    }

    const bucket = input.imageBucket?.trim();
    const path = input.imagePath?.trim();
    const mediaKind = input.imageMediaKind?.trim().toLowerCase();

    if (!bucket || !path || (mediaKind && mediaKind !== "photo")) {
        return null;
    }

    return {
        captureId: input.captureId,
        imageBucket: bucket,
        imagePath: path,
        mimeType: input.imageMimeType ?? null,
        mediaKind: input.imageMediaKind ?? "photo",
        imageGrade: null,
        animalName: null,
        username: null,
        contextLabel: null,
        locationDisplayLabel: null
    };
}

export function getCaptureImageRoute(captureId: string) {
    return `/api/capture-images/${encodeURIComponent(captureId)}`;
}

export {FETCH_TIMEOUT_MS};
