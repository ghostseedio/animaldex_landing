/**
 * How well the daily content engine works, for /admin/metrics → Content:
 * blog posts (mostly the daily generator) against Google search, page views
 * and signups, and auto-shared social posts against views and the signups
 * that say they came from that platform. Pure, like product-analytics.
 */
import { buildBuckets, dayKeyOf, type Grain } from "./product-analytics";

export type BlogPostInput = {
  slug: string;
  title: string;
  publishedAt: string;
  /** Written by the daily blog generator (a logged run published it). */
  generated: boolean;
  /** Where the post lives: the daily generator, Content Studio (database), or the repo. */
  source: "generator" | "studio" | "repo";
  costUsd: number | null;
};
export type GeneratorRun = { at: string; outcome: "published" | "draft" | "failed"; costUsd: number | null };
export type SocialPostInput = {
  id: string;
  platform: string;
  status: string;
  createdAt: string;
  title: string;
  pageSlug: string | null;
  url: string | null;
  views: number | null;
  likes: number | null;
  shares: number | null;
  follows: number | null;
  ageHours: number | null;
};
export type SocialGenerationInput = { kind: string; createdAt: string; usd: number; status: string };
export type SignupSource = { createdAt: string; channelKey: string; landing: string | null };

export type ContentInput = {
  from: string;
  to: string;
  grain: Grain;
  blogPosts: BlogPostInput[];
  generatorRuns: GeneratorRun[];
  /** Search Console clicks/impressions for the range, by URL path. */
  search: Map<string, { clicks: number; impressions: number; position: number }>;
  searchConnected: boolean;
  /** Lifetime view counter per blog slug. */
  views: Map<string, number>;
  socialPosts: SocialPostInput[];
  socialGenerations: SocialGenerationInput[];
  signups: SignupSource[];
};

/** The social platform a signup came from: what they said in the app, or the site that referred their web visit. */
export function socialPlatformOfChannel(key: string): string | null {
  const match = /^(?:said:|web_)(tiktok|instagram|youtube|facebook|x|pinterest|reddit)$/.exec(key);
  return match ? match[1] : null;
}

/** "Published “…” …, $1.82 (Research …)" → 1.82 */
export function generatorCost(summary: string | null | undefined) {
  const match = /\$(\d+(?:\.\d+)?)/.exec(summary ?? "");
  return match ? Number(match[1]) : null;
}

function inRange(time: string, from: string, to: string) {
  const day = time.length === 10 ? time : dayKeyOf(time);
  return day >= from && day <= to;
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

const round2 = (value: number) => Math.round(value * 100) / 100;

export function buildContentReport(input: ContentInput) {
  const { from, to } = input;
  const buckets = buildBuckets(from, to, input.grain);
  const bucketOf = (time: string) => {
    const day = time.length === 10 ? time : dayKeyOf(time);
    return buckets.findIndex((bucket) => bucket.from <= day && day <= bucket.to);
  };

  // ---- Blog ----
  const signupsByLanding = new Map<string, number>();
  for (const signup of input.signups) {
    if (!signup.landing || !inRange(signup.createdAt, from, to)) continue;
    signupsByLanding.set(signup.landing, (signupsByLanding.get(signup.landing) ?? 0) + 1);
  }
  const socialBySlug = new Map<string, number>();
  for (const post of input.socialPosts) {
    if (post.pageSlug && post.status === "published") socialBySlug.set(post.pageSlug, (socialBySlug.get(post.pageSlug) ?? 0) + 1);
  }
  const posts = input.blogPosts
    .filter((post) => inRange(post.publishedAt.slice(0, 10), from, to))
    .map((post) => {
      // Localised copies (/id/blog/…) count toward the same post.
      let clicks = 0;
      let impressions = 0;
      let weighted = 0;
      for (const [path, row] of Array.from(input.search)) {
        if (path === `/blog/${post.slug}` || path.endsWith(`/blog/${post.slug}`)) {
          clicks += row.clicks;
          impressions += row.impressions;
          weighted += row.position * row.impressions;
        }
      }
      return {
        ...post,
        publishedAt: post.publishedAt.slice(0, 10),
        clicks,
        impressions,
        position: impressions ? Math.round((weighted / impressions) * 10) / 10 : null,
        views: input.views.get(post.slug) ?? 0,
        signups: signupsByLanding.get(`/blog/${post.slug}`) ?? 0,
        socialPosts: socialBySlug.get(post.slug) ?? 0,
      };
    })
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const runs = input.generatorRuns.filter((run) => inRange(run.at, from, to));
  const generated = posts.filter((post) => post.generated);
  const spend = round2(runs.reduce((sum, run) => sum + (run.costUsd ?? 0), 0));
  const generatedClicks = generated.reduce((sum, post) => sum + post.clicks, 0);
  const blog = {
    summary: {
      published: posts.length,
      generated: generated.length,
      drafts: runs.filter((run) => run.outcome === "draft").length,
      failed: runs.filter((run) => run.outcome === "failed").length,
      spendUsd: spend,
      clicks: posts.reduce((sum, post) => sum + post.clicks, 0),
      impressions: posts.reduce((sum, post) => sum + post.impressions, 0),
      generatedClicks,
      postsWithClicks: posts.filter((post) => post.clicks > 0).length,
      views: posts.reduce((sum, post) => sum + post.views, 0),
      signups: posts.reduce((sum, post) => sum + post.signups, 0),
      costPerClick: generatedClicks > 0 ? round2(spend / generatedClicks) : null,
      searchConnected: input.searchConnected,
    },
    posts,
    series: buckets.map((bucket, index) => ({
      key: bucket.key,
      label: bucket.label,
      published: posts.filter((post) => bucketOf(post.publishedAt) === index).length,
      clicks: posts.filter((post) => bucketOf(post.publishedAt) === index).reduce((sum, post) => sum + post.clicks, 0),
    })),
  };

  // ---- Social ----
  const social = input.socialPosts.filter((post) => inRange(post.createdAt, from, to));
  const socialSignups = input.signups.filter((signup) => inRange(signup.createdAt, from, to) && socialPlatformOfChannel(signup.channelKey));
  const platforms = Array.from(new Set([...social.map((post) => post.platform), ...socialSignups.map((s) => socialPlatformOfChannel(s.channelKey)!)])).sort();
  const byPlatform = platforms
    .map((platform) => {
      const all = social.filter((post) => post.platform === platform);
      const published = all.filter((post) => post.status === "published");
      const measured = published.filter((post) => post.views != null);
      const views = measured.reduce((sum, post) => sum + (post.views ?? 0), 0);
      const signups = socialSignups.filter((signup) => socialPlatformOfChannel(signup.channelKey) === platform).length;
      return {
        platform,
        posts: published.length,
        failed: all.filter((post) => post.status === "failed").length,
        measured: measured.length,
        views,
        avgViews: measured.length ? Math.round(views / measured.length) : null,
        medianViews: median(measured.map((post) => post.views ?? 0)),
        likes: measured.reduce((sum, post) => sum + (post.likes ?? 0), 0),
        shares: measured.reduce((sum, post) => sum + (post.shares ?? 0), 0),
        follows: measured.reduce((sum, post) => sum + (post.follows ?? 0), 0),
        medianAgeHours: median(measured.map((post) => post.ageHours ?? 0)),
        signups,
        viewsPerSignup: signups > 0 && views > 0 ? Math.round(views / signups) : null,
      };
    })
    .sort((a, b) => b.views - a.views || b.posts - a.posts);
  const generations = input.socialGenerations.filter((item) => inRange(item.createdAt, from, to));
  const generationKinds = new Map<string, { kind: string; made: number; usd: number }>();
  for (const item of generations) {
    const entry = generationKinds.get(item.kind) ?? { kind: item.kind, made: 0, usd: 0 };
    entry.made += 1;
    entry.usd = round2(entry.usd + item.usd);
    generationKinds.set(item.kind, entry);
  }
  const published = social.filter((post) => post.status === "published");
  const socialReport = {
    summary: {
      posts: published.length,
      failed: social.filter((post) => post.status === "failed").length,
      views: published.reduce((sum, post) => sum + (post.views ?? 0), 0),
      measured: published.filter((post) => post.views != null).length,
      medianViews: median(published.filter((post) => post.views != null).map((post) => post.views ?? 0)),
      signups: socialSignups.length,
      generated: generations.length,
      generationUsd: round2(generations.reduce((sum, item) => sum + item.usd, 0)),
    },
    byPlatform,
    generations: Array.from(generationKinds.values()).sort((a, b) => b.made - a.made),
    top: [...published]
      .filter((post) => post.views != null)
      .sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
      .slice(0, 12),
    series: buckets.map((bucket, index) => ({
      key: bucket.key,
      label: bucket.label,
      posts: published.filter((post) => bucketOf(post.createdAt) === index).length,
      views: published.filter((post) => bucketOf(post.createdAt) === index).reduce((sum, post) => sum + (post.views ?? 0), 0),
      signups: socialSignups.filter((signup) => bucketOf(signup.createdAt) === index).length,
    })),
  };

  return { blog, social: socialReport };
}

export type ContentReport = ReturnType<typeof buildContentReport>;
