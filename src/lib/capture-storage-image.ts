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
type SignedUrlCacheEntry = {expiresAt: number; promise: Promise<string | null>};
const signedUrlCacheHost = globalThis as typeof globalThis & {
    __animalDexSignedUrlCache?: Map<string, SignedUrlCacheEntry>;
};
const signedUrlCache = signedUrlCacheHost.__animalDexSignedUrlCache
    ?? (signedUrlCacheHost.__animalDexSignedUrlCache = new Map<string, SignedUrlCacheEntry>());

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
    expiresInSeconds = 60 * 60,
    transform?: {width: number; height: number; quality: number; resize: "cover" | "contain"}
): Promise<string | null> {
    const supabaseUrl = getSupabaseUrl();
    const serviceRoleKey = getSupabaseServiceKey();

    if (!supabaseUrl || !serviceRoleKey || !bucket || !path) {
        return null;
    }

    const cacheKey = [bucket, path, expiresInSeconds, transform ? JSON.stringify(transform) : "original"].join("|");
    const now = Date.now();
    const cached = signedUrlCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
        return cached.promise;
    }

    if (signedUrlCache.size > 1000) {
        for (const [key, entry] of Array.from(signedUrlCache.entries())) {
            if (entry.expiresAt <= now) signedUrlCache.delete(key);
        }
        while (signedUrlCache.size > 1000) {
            const oldestKey = signedUrlCache.keys().next().value as string | undefined;
            if (!oldestKey) break;
            signedUrlCache.delete(oldestKey);
        }
    }

    const signEndpoint = `${supabaseUrl}/storage/v1/object/sign/${bucket}/${encodeStoragePath(path)}`;
    const promise = (async () => {
        try {
            const signResponse = await fetch(signEndpoint, {
                method: "POST",
                headers: getSupabaseHeaders(serviceRoleKey, {"Content-Type": "application/json"}),
                body: JSON.stringify({expiresIn: expiresInSeconds, ...(transform ? {transform} : {})}),
                cache: "no-store",
                signal: AbortSignal.timeout(SIGN_TIMEOUT_MS)
            });

            if (!signResponse.ok) return null;
            const signBody = await signResponse.json() as {signedURL?: string; signedUrl?: string};
            const signedUrl = signBody.signedURL ?? signBody.signedUrl;
            return signedUrl ? toAbsoluteSignedUrl(supabaseUrl, signedUrl) : null;
        } catch {
            return null;
        }
    })();
    const safeLifetimeSeconds = Math.max(30, Math.min(expiresInSeconds - 60, 3300));
    signedUrlCache.set(cacheKey, {expiresAt: now + safeLifetimeSeconds * 1000, promise});
    const signedUrl = await promise;
    if (!signedUrl) signedUrlCache.delete(cacheKey);
    return signedUrl;
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
        gradeBreakdown: null,
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
