// Pure halves of the per-post metrics sync (metrics.ts): turning each
// platform's answer into one row of admin_social_post_metrics. Kept free of
// fetch and keys so node:test can import it.

export type MetricsRow = {
    post_id: string;
    platform: string;
    fetched_at: string;
    age_hours: number | null;
    views: number | null;
    likes: number | null;
    comments: number | null;
    shares: number | null;
    saves: number | null;
    follows: number | null;
    hold_1s: number | null;
    hold_3s: number | null;
    completion: number | null;
    avg_watch_seconds: number | null;
    avg_view_pct: number | null;
    raw: Record<string, unknown> | null;
};

export type MetricsInput = Partial<Omit<MetricsRow, "post_id" | "platform" | "fetched_at" | "age_hours" | "raw">> & {raw?: Record<string, unknown> | null};

export function num(value: unknown): number | null {
    if (value === null || value === undefined || value === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

/** A share in [0, 1]: Zernio sends 0.034 or 3.4 depending on the field. */
export function ratio(value: unknown): number | null {
    const parsed = num(value);
    if (parsed === null || parsed < 0) return null;
    return parsed > 1 ? Math.min(parsed / 100, 1) : parsed;
}

export function metricsRow(postId: string, platform: string, publishedAt: string | null, input: MetricsInput, now = new Date()): MetricsRow {
    const published = publishedAt ? Date.parse(publishedAt) : NaN;
    return {
        post_id: postId,
        platform,
        fetched_at: now.toISOString(),
        age_hours: Number.isFinite(published) ? Math.round((now.getTime() - published) / 36_000) / 100 : null,
        views: input.views ?? null,
        likes: input.likes ?? null,
        comments: input.comments ?? null,
        shares: input.shares ?? null,
        saves: input.saves ?? null,
        follows: input.follows ?? null,
        hold_1s: input.hold_1s ?? null,
        hold_3s: input.hold_3s ?? null,
        completion: input.completion ?? null,
        avg_watch_seconds: input.avg_watch_seconds ?? null,
        avg_view_pct: input.avg_view_pct ?? null,
        raw: input.raw ?? null
    };
}

/** One post from Zernio's GET /v1/analytics list (TikTok, Pinterest, Threads, Bluesky). */
export function fromZernioAnalytics(post: any): MetricsInput {
    const analytics = post?.analytics ?? {};
    const curve = analytics.retentionCurve && typeof analytics.retentionCurve === "object" ? analytics.retentionCurve as Record<string, unknown> : null;
    const watchMs = num(analytics.igReelsAvgWatchTime);
    return {
        views: num(analytics.views) ?? num(analytics.impressions),
        likes: num(analytics.likes),
        comments: num(analytics.comments),
        shares: num(analytics.shares) ?? num(analytics.reposts),
        saves: num(analytics.saves),
        follows: num(analytics.follows),
        hold_1s: curve ? ratio(curve["1"]) : null,
        hold_3s: curve ? ratio(curve["3"]) : null,
        completion: ratio(analytics.completionRate),
        avg_watch_seconds: watchMs !== null ? Math.round(watchMs / 10) / 100 : null,
        raw: {
            impressions: num(analytics.impressions),
            reach: num(analytics.reach),
            clicks: num(analytics.clicks),
            profileViews: num(analytics.profileViews),
            engagementRate: num(analytics.engagementRate),
            impressionSources: analytics.impressionSources ?? null,
            retentionCurve: curve
        }
    };
}

/** The ids a Zernio analytics post can be matched by: its own id, the Late id, and the platform URL's numeric id. */
export function zernioAnalyticsKeys(post: any): string[] {
    const keys = [post?._id, post?.latePostId, post?.id].filter((value): value is string => typeof value === "string" && value.length > 0);
    const url = typeof post?.platformPostUrl === "string" ? post.platformPostUrl : "";
    const match = url.match(/\/(\d{8,})(?:[/?#]|$)/);
    if (match) keys.push(match[1]);
    return keys;
}

/** YouTube: Data API statistics plus, when present, the Analytics row for the video. */
export function fromYouTube(statistics: any, analytics: {views?: number; averageViewPercentage?: number; averageViewDuration?: number; shares?: number; subscribersGained?: number} | null): MetricsInput {
    return {
        views: num(statistics?.viewCount) ?? num(analytics?.views),
        likes: num(statistics?.likeCount),
        comments: num(statistics?.commentCount),
        shares: num(analytics?.shares),
        follows: num(analytics?.subscribersGained),
        avg_view_pct: num(analytics?.averageViewPercentage),
        avg_watch_seconds: num(analytics?.averageViewDuration),
        raw: analytics ? {analytics} : null
    };
}

/** Instagram: the media's fields plus its insights (`data: [{name, values:[{value}]}]`). */
export function fromInstagram(fields: any, insights: any): MetricsInput {
    const insight = (name: string) => {
        const entry = Array.isArray(insights?.data) ? insights.data.find((item: any) => item?.name === name) : null;
        return num(entry?.values?.[0]?.value ?? entry?.total_value?.value);
    };
    const watchMs = insight("ig_reels_avg_watch_time");
    return {
        views: insight("views") ?? insight("reach"),
        likes: num(fields?.like_count),
        comments: num(fields?.comments_count),
        shares: insight("shares"),
        saves: insight("saved"),
        avg_watch_seconds: watchMs !== null ? Math.round(watchMs / 10) / 100 : null,
        raw: {reach: insight("reach"), totalInteractions: insight("total_interactions")}
    };
}

/** X: a tweet's public_metrics. */
export function fromX(tweet: any): MetricsInput {
    const metrics = tweet?.public_metrics ?? {};
    return {
        views: num(metrics.impression_count),
        likes: num(metrics.like_count),
        comments: num(metrics.reply_count),
        shares: num(metrics.retweet_count) !== null || num(metrics.quote_count) !== null ? (num(metrics.retweet_count) ?? 0) + (num(metrics.quote_count) ?? 0) : null,
        saves: num(metrics.bookmark_count)
    };
}

/** Facebook: a Reel's video_insights (`data: [{name, values:[{value}]}]`) or a post's reactions/comments/shares summary. */
export function fromFacebook(insights: any, post: any): MetricsInput {
    const insight = (name: string) => {
        const entry = Array.isArray(insights?.data) ? insights.data.find((item: any) => item?.name === name) : null;
        return num(entry?.values?.[0]?.value);
    };
    const avgMs = insight("post_video_avg_time_watched");
    return {
        views: insight("fb_reels_total_plays") ?? insight("blue_reels_play_count") ?? insight("post_impressions_unique") ?? insight("post_impressions"),
        likes: num(post?.reactions?.summary?.total_count) ?? num(post?.likes?.summary?.total_count),
        comments: num(post?.comments?.summary?.total_count),
        shares: num(post?.shares?.count),
        avg_watch_seconds: avgMs !== null ? Math.round(avgMs / 10) / 100 : null
    };
}
