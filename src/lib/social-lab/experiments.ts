import "server-only";
import {listContentVideos, type ContentVideoRow} from "@/lib/content-video/store";
import type {VideoPlan} from "@/lib/content-video/plan";
import {armLabel, type Dimension, type Experiment, EXPERIMENT_VERSION, type ExperimentKind} from "@/lib/social-lab/arms";
import {armStats, chanceBest, chooseExperiment, itemScores, learningKinds, type ItemScore, type ScoredShare, scoreShares} from "@/lib/social-lab/bandit";
import {listPostMetrics} from "@/lib/social-lab/metrics";
import type {MetricsRow} from "@/lib/social-lab/metrics-core";
import {CAROUSEL_MEDIA_KIND, TEXT_MEDIA_KIND} from "@/lib/social/auto-share-plan";
import {listPosts} from "@/lib/social/store";
import {CONTENT_VIDEO_MEDIA_KIND} from "@/lib/content-video/store";
import {listSocialContent} from "@/lib/social-content/store";
import {contentIdFromMediaPath, type SocialContentRow} from "@/lib/social-content/types";

// Server half of the hook lab: joins every published share with its numbers
// and the item it came from, scores them (bandit.ts), and picks the arms for
// the next video / carousel / text post. Read once per few minutes: picking is
// cheap, loading is not.

const CACHE_MS = 10 * 60_000;
let cache: {at: number; items: ItemScore[]; shares: number} | null = null;

/**
 * Videos made before the hook lab still teach it something: their length and
 * their ending (all had the end card), and a battle's / reveal's card-first
 * opening. Their hook style was never recorded.
 */
export function inferredExperiment(video: Pick<ContentVideoRow, "plan" | "duration_seconds">): Experiment | null {
    const plan = video.plan as (VideoPlan & {experiment?: Experiment}) | null;
    if (plan?.experiment) return plan.experiment;
    if (!plan) return null;
    const format = plan.format ?? "editorial";
    const seconds = Number(video.duration_seconds ?? 0);
    if (format === "editorial") {
        if (!seconds) return null;
        return {version: EXPERIMENT_VERSION, length: seconds < 20 ? "short" : seconds < 30 ? "medium" : "long", ending: "cta_card"};
    }
    return {version: EXPERIMENT_VERSION, opener: "card_first", ending: "cta_card"};
}

function videoKind(video: ContentVideoRow): ExperimentKind {
    const format = (video.plan as VideoPlan | null)?.format;
    return format === "battle" || format === "creature" ? format : "editorial";
}

/** Every judged share, joined to its item. Exported for the admin panel's post table. */
export async function loadScoredShares(): Promise<ScoredShare[]> {
    const [posts, metrics, videos, content] = await Promise.all([
        listPosts(3000),
        listPostMetrics().catch((): MetricsRow[] => []),
        listContentVideos(1000).catch((): ContentVideoRow[] => []),
        listSocialContent(undefined, 2000).catch((): SocialContentRow[] => [])
    ]);
    const metricsByPost = new Map(metrics.map((row) => [row.post_id, row]));
    const videoByPath = new Map(videos.filter((video) => video.video_path).map((video) => [video.video_path!, video]));
    const contentById = new Map(content.map((row) => [row.id, row]));
    const shares: ScoredShare[] = [];
    for (const post of posts) {
        const row = metricsByPost.get(post.id);
        if (!row || post.status !== "published" || post.mode !== "post") continue;
        const metricsOf = {views: row.views, likes: row.likes, comments: row.comments, shares: row.shares, saves: row.saves, hold_3s: row.hold_3s, completion: row.completion, avg_view_pct: row.avg_view_pct};
        const ageHours = Number(row.age_hours ?? 0);
        if (post.media_kind === CONTENT_VIDEO_MEDIA_KIND) {
            const video = videoByPath.get(post.media_path);
            if (!video) continue;
            shares.push({itemId: video.id, itemKind: videoKind(video), family: "video", platform: post.platform, experiment: inferredExperiment(video), ageHours, metrics: metricsOf});
        } else if (post.media_kind === CAROUSEL_MEDIA_KIND || post.media_kind === TEXT_MEDIA_KIND) {
            const id = post.options?.content ?? contentIdFromMediaPath(post.media_path);
            const item = id ? contentById.get(id) : undefined;
            if (!item) continue;
            const kind = item.kind === "carousel" ? "carousel" : "text";
            shares.push({itemId: item.id, itemKind: kind, family: kind, platform: post.platform, experiment: item.experiment, ageHours, metrics: metricsOf});
        }
    }
    return shares;
}

async function scoredItems() {
    if (cache && Date.now() - cache.at < CACHE_MS) return cache.items;
    const shares = await loadScoredShares();
    const items = itemScores(scoreShares(shares));
    cache = {at: Date.now(), items, shares: shares.length};
    return items;
}

/** The arms the next item of `kind` uses. Never throws: with no data it explores uniformly. */
export async function nextExperiment(kind: ExperimentKind): Promise<Experiment> {
    const items = await scoredItems().catch(() => [] as ItemScore[]);
    return chooseExperiment(kind, items);
}

export type LabArm = {arm: string; label: string; items: number; mean: number | null; chanceBest: number};
export type LabDimension = {kind: string; dimension: Dimension; arms: LabArm[]};

/** What the lab has learned so far, per kind of item and dimension: for /admin/story-videos. */
export async function labReport(): Promise<{dimensions: LabDimension[]; judgedItems: number}> {
    cache = null;
    const items = await scoredItems();
    const groups: Array<{kind: string; kinds: readonly ExperimentKind[]; dimension: Dimension}> = [
        {kind: "Videos", kinds: learningKinds("editorial", "hookStyle"), dimension: "hookStyle"},
        {kind: "Videos (narrated)", kinds: ["editorial"], dimension: "length"},
        {kind: "Videos", kinds: learningKinds("editorial", "ending"), dimension: "ending"},
        {kind: "Battles & reveals", kinds: ["battle", "creature"], dimension: "opener"},
        {kind: "Carousels", kinds: ["carousel"], dimension: "hookStyle"},
        {kind: "Text posts", kinds: ["text"], dimension: "textFormat"}
    ];
    const dimensions = groups.map(({kind, kinds, dimension}) => {
        const stats = armStats(items, dimension, kinds);
        const best = chanceBest(stats);
        return {
            kind,
            dimension,
            arms: stats.map((entry) => ({arm: entry.arm, label: armLabel(dimension, entry.arm), items: entry.items, mean: entry.mean, chanceBest: best[entry.arm] ?? 0}))
                .sort((a, b) => b.chanceBest - a.chanceBest)
        };
    });
    return {dimensions, judgedItems: items.length};
}
