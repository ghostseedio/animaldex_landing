import {getFreshConnection} from "@/lib/social/oauth";
import {publishers} from "@/lib/social/publishers";
import {findAdminStoryVideo} from "@/lib/social/story-videos";
import {updatePost} from "@/lib/social/store";
import type {SocialPostRow} from "@/lib/social/types";

// Runs queued shares in the background of the (long-lived, self-hosted) Node
// server: the request that queued them returns at once and the admin page
// polls the log. A container restart mid-upload leaves a row "processing";
// the page shows it as stale and it can be retried.

const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

async function download(url: string) {
    const response = await fetch(url, {cache: "no-store", signal: AbortSignal.timeout(5 * 60_000)});
    if (!response.ok) throw new Error(`Downloading the video failed (${response.status})`);
    const length = Number(response.headers.get("content-length"));
    if (length > MAX_VIDEO_BYTES) throw new Error(`Video is ${Math.round(length / 1e6)} MB, over the ${MAX_VIDEO_BYTES / 1e6} MB limit`);
    return Buffer.from(await response.arrayBuffer());
}

function errorText(error: unknown) {
    return (error instanceof Error ? error.message : String(error)).slice(0, 1000);
}

/** Publishes one video to every platform in `rows` (all the same video), one download shared. */
export async function runShareJob(rows: SocialPostRow[]) {
    const [first] = rows;
    if (!first) return;
    await Promise.all(rows.map((row) => updatePost(row.id, {status: "processing"}).catch(() => undefined)));

    let video: Buffer;
    let videoUrl: string;
    try {
        if (!first.species_profile_id) throw new Error("Share has no species");
        // Re-read from the endpoint: the file must still be served (the capture
        // still public) at the moment of sharing, and this gives a fresh URL.
        const current = await findAdminStoryVideo(first.species_profile_id, first.media_path);
        if (!current) throw new Error("The video is no longer served by species-story-media (deleted or made private)");
        videoUrl = current.signedUrl ?? current.stableUrl;
        video = await download(videoUrl);
    } catch (error) {
        const message = errorText(error);
        await Promise.all(rows.map((row) => updatePost(row.id, {status: "failed", error: message}).catch(() => undefined)));
        return;
    }

    await Promise.all(rows.map(async (row) => {
        try {
            const connection = await getFreshConnection(row.platform);
            const result = await publishers[row.platform](connection, {
                video,
                videoUrl,
                caption: row.caption,
                title: row.title ?? row.caption.split("\n")[0] ?? "",
                mode: row.mode,
                options: row.options ?? null
            });
            await updatePost(row.id, {status: "published", external_id: result.externalId, external_url: result.externalUrl, error: null});
        } catch (error) {
            await updatePost(row.id, {status: "failed", error: errorText(error)}).catch(() => undefined);
        }
    }));
}
