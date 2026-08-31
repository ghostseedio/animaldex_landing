import "server-only";

import type {DiscoverCaptureItem} from "@/data/discover-timeline";
import {createSignedStorageUrl} from "@/lib/capture-storage-image";
import {timeDevAsync} from "@/lib/dev-request-timing";

function parseCaptureImageQuery(imageSrc: string) {
    try {
        const url = new URL(imageSrc, "https://animaldex.app");
        const bucket = url.searchParams.get("bucket")?.trim() ?? "";
        const path = url.searchParams.get("path")?.trim() ?? "";
        return bucket && path ? {bucket, path} : null;
    } catch {
        return null;
    }
}

/**
 * Home feature cards should not fan out into /api/capture-images during dev.
 * Sign storage URLs once on the server and hand the browser a direct image src.
 */
export async function signHomeFeatureCaptureImages(captures: DiscoverCaptureItem[]) {
    return timeDevAsync("home.images", "sign-feature-captures", async () =>
        Promise.all(captures.map(async (capture) => {
            const reference = parseCaptureImageQuery(capture.imageSrc);
            if (!reference) return capture;

            const signed = await createSignedStorageUrl(reference.bucket, reference.path);
            return signed ? {...capture, imageSrc: signed} : capture;
        })),
        {count: captures.length}
    );
}
