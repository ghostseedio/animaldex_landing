import "server-only";
import {contentVideoIdFromPath} from "@/lib/content-video/fix";
import {CONTENT_VIDEO_MEDIA_KIND, listContentVideos, type ContentVideoRow} from "@/lib/content-video/store";
import type {VideoPlan} from "@/lib/content-video/plan";
import {listPostMetrics} from "@/lib/social-lab/metrics";
import type {MetricsRow} from "@/lib/social-lab/metrics-core";
import {buildFormatBoard, formatOfPost, type BoardPost, type FormatBoard, type FormatKey, type Verdict} from "@/lib/social-lab/format-board";
import {listPosts} from "@/lib/social/store";
import {listSocialContent} from "@/lib/social-content/store";
import {contentIdFromMediaPath, type SocialContentRow} from "@/lib/social-content/types";

// Server half of the format leaderboard (format-board.ts): every published
// post, its latest numbers, and the format of the item it came from. Cached
// for a few minutes, like the hook lab: the generators ask for verdicts on
// every run.

const CACHE_MS = 10 * 60_000;
let cache: {at: number; board: FormatBoard} | null = null;

function clicksOf(row: MetricsRow) {
    const clicks = row.raw?.clicks;
    return typeof clicks === "number" && Number.isFinite(clicks) ? clicks : null;
}

export async function loadBoardPosts(): Promise<BoardPost[]> {
    const [posts, metrics, videos, content] = await Promise.all([
        listPosts(5000),
        listPostMetrics().catch((): MetricsRow[] => []),
        listContentVideos(2000).catch((): ContentVideoRow[] => []),
        listSocialContent(undefined, 3000).catch((): SocialContentRow[] => [])
    ]);
    const metricsByPost = new Map(metrics.map((row) => [row.post_id, row]));
    const videoById = new Map(videos.map((video) => [video.id, video]));
    const contentById = new Map(content.map((row) => [row.id, row]));
    const result: BoardPost[] = [];
    for (const post of posts) {
        const row = metricsByPost.get(post.id);
        if (!row || post.status !== "published" || post.mode !== "post") continue;
        let format: FormatKey | null = null;
        let itemId = post.media_path;
        if (post.media_kind === CONTENT_VIDEO_MEDIA_KIND) {
            const videoId = contentVideoIdFromPath(post.media_path);
            const video = videoId ? videoById.get(videoId) : undefined;
            if (!video) continue;
            itemId = video.id;
            format = formatOfPost({mediaKind: post.media_kind, videoFormat: (video.plan as VideoPlan | null)?.format ?? null, sourceType: video.source_type});
        } else if (post.media_kind === "carousel" || post.media_kind === "text_post") {
            const id = post.options?.content ?? contentIdFromMediaPath(post.media_path);
            const item = id ? contentById.get(id) : undefined;
            if (!item) continue;
            itemId = item.id;
            format = formatOfPost({mediaKind: post.media_kind, contentKind: item.kind, carouselFormat: item.experiment?.carouselFormat ?? null});
        } else {
            format = formatOfPost({mediaKind: post.media_kind});
        }
        if (!format) continue;
        result.push({
            itemId,
            format,
            platform: post.platform,
            ageHours: Number(row.age_hours ?? 0),
            views: row.views,
            hold3s: row.hold_3s,
            shares: row.shares,
            clicks: clicksOf(row),
            url: post.external_url,
            title: post.title ?? post.species_name ?? null
        });
    }
    return result;
}

export async function formatBoard(fresh = false): Promise<FormatBoard> {
    if (!fresh && cache && Date.now() - cache.at < CACHE_MS) return cache.board;
    const board = buildFormatBoard(await loadBoardPosts());
    cache = {at: Date.now(), board};
    return board;
}

/** Each format's verdict, for the generators. Never throws: with no data every format is "test". */
export async function formatVerdicts(): Promise<Partial<Record<FormatKey, Verdict>>> {
    try {
        const board = await formatBoard();
        return Object.fromEntries(board.formats.map((row) => [row.format, row.verdict]));
    } catch (error) {
        console.warn("[format-board] verdicts unavailable", error);
        return {};
    }
}
