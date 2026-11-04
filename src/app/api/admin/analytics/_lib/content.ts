import "server-only";
import { fetchRows, isMissingTableError } from "@/app/api/admin/growth/_lib/rows";
import { getManagedBlogPosts } from "@/lib/admin-content";
import { getIndexedBlogPosts } from "@/data/blog";
import { dayStartMs } from "@/lib/product-analytics";
import {
  generatorCost,
  type BlogPostInput,
  type GeneratorRun,
  type SocialGenerationInput,
  type SocialPostInput,
} from "@/lib/content-analytics";

async function rows<T>(table: string, query: string): Promise<T[]> {
  try {
    return await fetchRows<T>(table, query);
  } catch (error) {
    if (isMissingTableError(error, table)) return [];
    throw error;
  }
}

function runOutcome(summary: string, outcome: string): GeneratorRun["outcome"] | null {
  if (outcome === "failed" || /^(failed|error)/i.test(summary)) return "failed";
  if (/^published/i.test(summary)) return "published";
  if (/^saved .* as a draft/i.test(summary)) return "draft";
  // Progress lines ("Writing a search-led article…") aren't a result.
  return null;
}

/** Blog posts, generator runs, page views and social posts since `since`, for the Content tab. */
export async function loadContent(since: string) {
  const sinceIso = encodeURIComponent(new Date(dayStartMs(since)).toISOString());
  const [posts, entries, runRows, viewRows, socialRows, metricRows, generationRows] = await Promise.all([
    getManagedBlogPosts().catch(() => []),
    rows<{ slug: string }>("admin_content_entries", "select=slug&content_type=eq.blog&is_published=eq.true"),
    rows<{ outcome: string; ref: string | null; summary: string | null; created_at: string }>(
      "admin_automation_runs",
      `select=outcome,ref,summary,created_at&job=eq.blog-auto-generate&created_at=gte.${sinceIso}&order=created_at.asc`,
    ),
    rows<{ slug: string; view_count: number }>("content_page_views", "select=slug,view_count&content_type=eq.blog"),
    rows<{ id: string; platform: string; status: string; created_at: string; title: string | null; caption: string | null; page_slug: string | null; external_url: string | null }>(
      "admin_social_posts",
      `select=id,platform,status,created_at,title,caption,page_slug,external_url&mode=eq.post&created_at=gte.${sinceIso}`,
    ),
    rows<{ post_id: string; views: number | null; likes: number | null; shares: number | null; follows: number | null; age_hours: number | null }>(
      "admin_social_post_metrics",
      "select=post_id,views,likes,shares,follows,age_hours",
    ),
    rows<{ kind: string; created_at: string; estimated_usd: number | string | null; status: string }>(
      "admin_social_content",
      `select=kind,created_at,estimated_usd,status&created_at=gte.${sinceIso}`,
    ),
  ]);

  // Compiled posts live in the repo; the generator's (and Content Studio's) live in the database.
  const compiled = new Set(getIndexedBlogPosts().map((post) => post.slug));
  const databasePosts = new Set(entries.map((entry) => entry.slug).filter((slug) => !compiled.has(slug)));
  const generatorRuns: GeneratorRun[] = [];
  const costBySlug = new Map<string, number>();
  for (const run of runRows) {
    const outcome = runOutcome(run.summary ?? "", run.outcome);
    if (!outcome) continue;
    const costUsd = generatorCost(run.summary);
    generatorRuns.push({ at: run.created_at, outcome, costUsd });
    const slug = run.ref?.startsWith("/blog/") ? run.ref.slice(6) : null;
    if (slug && costUsd != null) costBySlug.set(slug, costUsd);
  }
  const blogPosts: BlogPostInput[] = posts.map((post) => ({
    slug: post.slug,
    title: post.title,
    publishedAt: post.publishedAt,
    generated: costBySlug.has(post.slug),
    source: costBySlug.has(post.slug) ? ("generator" as const) : databasePosts.has(post.slug) ? ("studio" as const) : ("repo" as const),
    costUsd: costBySlug.get(post.slug) ?? null,
  }));

  const metrics = new Map(metricRows.map((row) => [row.post_id, row]));
  const socialPosts: SocialPostInput[] = socialRows.map((row) => {
    const metric = metrics.get(row.id);
    return {
      id: row.id,
      platform: row.platform,
      status: row.status,
      createdAt: row.created_at,
      title: (row.title || row.caption || "").split("\n")[0].slice(0, 140),
      pageSlug: row.page_slug,
      url: row.external_url,
      views: metric?.views ?? null,
      likes: metric?.likes ?? null,
      shares: metric?.shares ?? null,
      follows: metric?.follows ?? null,
      ageHours: metric?.age_hours ?? null,
    };
  });
  const socialGenerations: SocialGenerationInput[] = generationRows.map((row) => ({
    kind: row.kind,
    createdAt: row.created_at,
    usd: Number(row.estimated_usd ?? 0) || 0,
    status: row.status,
  }));

  return {
    blogPosts,
    generatorRuns,
    views: new Map(viewRows.map((row) => [row.slug, Number(row.view_count) || 0])),
    socialPosts,
    socialGenerations,
  };
}
