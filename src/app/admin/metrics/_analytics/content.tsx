"use client";

import { Badge, Card, CardContent, CardHeader, EmptyState, TD, TH, Table } from "@/components/admin/ui";
import { TrendChart } from "./charts";
import { markersFor } from "./overview";
import { Tile, TileGrid } from "./tabs";
import { num, pct, share, singleSeriesColor, usd } from "./format";
import type { AnalyticsResponse } from "./types";

const socialLabels: Record<string, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "YouTube",
  facebook: "Facebook",
  x: "X",
  pinterest: "Pinterest",
  threads: "Threads",
  bluesky: "Bluesky",
  reddit: "Reddit",
};

function SingleChart({ data, title, description, values, format }: { data: AnalyticsResponse; title: string; description?: string; values: number[]; format: (value: number | null) => string }) {
  return (
    <Card>
      <CardHeader title={title} description={description} />
      <CardContent>
        <TrendChart
          label={title}
          labels={data.series.map((row) => row.label)}
          series={[{ key: "value", label: title, color: singleSeriesColor, values }]}
          format={format}
          markers={markersFor(data)}
          height={200}
          compact
          partialLast={data.series[data.series.length - 1]?.partial}
        />
      </CardContent>
    </Card>
  );
}

/** Is the daily content engine paying off? Blog posts against search, social posts against views and signups. */
export function Content({ data }: { data: AnalyticsResponse }) {
  const { blog, social } = data.content;
  const s = blog.summary;
  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <h2 className="font-display text-xl text-white">Blog posts</h2>
        <TileGrid>
          <Tile
            label="Posts published"
            value={num(s.published)}
            hint={`${num(s.generated)} by the daily generator · ${num(s.drafts)} it held back as drafts`}
            info="Daily generator posts are the ones a logged generator run published (runs are logged from Oct 20 2026); the rest were written in Content Studio or the repo."
          />
          <Tile label="Generator spend" value={usd(s.spendUsd)} hint={s.published ? `${usd(s.spendUsd / Math.max(1, s.generated))} per published post` : undefined} />
          <Tile
            label="Google clicks"
            value={s.searchConnected ? num(s.clicks) : "—"}
            hint={s.searchConnected ? `${num(s.impressions)} impressions · on posts published in range` : "Search Console not connected here"}
            info="Search clicks during the selected range on the posts published in it. A post takes weeks to rank, so recent posts read low: compare older ranges for the settled number."
          />
          <Tile label="Posts with a click" value={s.searchConnected ? pct(share(s.postsWithClicks, s.published)) : "—"} hint={`${num(s.postsWithClicks)} of ${num(s.published)}`} />
          <Tile label="Cost per click" value={usd(s.costPerClick)} info="Generator spend in the range ÷ Google clicks on the generated posts." />
          <Tile label="Signups landed on a post" value={num(s.signups)} hint={`${num(s.views)} page views (all time)`} info="Web signups whose first visit was the post. Tracked from this release on." />
        </TileGrid>
        <div className="grid gap-3 xl:grid-cols-2">
          <SingleChart data={data} title={`Posts published by ${data.range.grain}`} values={blog.series.map((row) => row.published)} format={num} />
          <SingleChart
            data={data}
            title={`Google clicks on those posts by publish ${data.range.grain}`}
            description="Clicks in the range, grouped by when each post went live."
            values={blog.series.map((row) => row.clicks)}
            format={num}
          />
        </div>
        <Card>
          <CardHeader title="Every post in the range" description="Newest first. Clicks and impressions are for the selected range; views are the post's all-time counter." />
          {blog.posts.length ? (
            <Table minWidth={980}>
              <thead>
                <tr>
                  <TH>Published</TH>
                  <TH>Post</TH>
                  <TH numeric>Clicks</TH>
                  <TH numeric>Impressions</TH>
                  <TH numeric>Avg position</TH>
                  <TH numeric>Views</TH>
                  <TH numeric>Signups</TH>
                  <TH numeric>Social posts</TH>
                  <TH numeric>Cost</TH>
                </tr>
              </thead>
              <tbody>
                {blog.posts.map((post) => (
                  <tr key={post.slug} className="hover:bg-white/[.02]">
                    <TD className="whitespace-nowrap">{post.publishedAt}</TD>
                    <TD className="max-w-[380px]">
                      <a href={`/blog/${post.slug}`} target="_blank" rel="noreferrer" className="font-bold text-white hover:text-primary-200">
                        {post.title}
                      </a>{" "}
                      {post.source === "generator" ? <Badge tone="good">daily generator</Badge> : post.source === "studio" ? <Badge tone="neutral">studio</Badge> : null}
                    </TD>
                    <TD numeric className="font-bold text-white">
                      {s.searchConnected ? num(post.clicks) : "—"}
                    </TD>
                    <TD numeric>{s.searchConnected ? num(post.impressions) : "—"}</TD>
                    <TD numeric>{post.position ?? "—"}</TD>
                    <TD numeric>{num(post.views)}</TD>
                    <TD numeric>{num(post.signups)}</TD>
                    <TD numeric>{num(post.socialPosts)}</TD>
                    <TD numeric>{usd(post.costUsd)}</TD>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <EmptyState className="m-4 py-8" title="No blog posts published in this range." />
          )}
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-xl text-white">Social posts</h2>
        <TileGrid>
          <Tile label="Posts shared" value={num(social.summary.posts)} hint={`${num(social.summary.failed)} failed`} />
          <Tile
            label="Views"
            value={num(social.summary.views)}
            hint={`${num(social.summary.measured)} posts measured`}
            info="Each post's latest synced views (synced every 6 hours, so a post's age at measurement varies; see the platform table)."
          />
          <Tile label="Median views / post" value={num(social.summary.medianViews)} />
          <Tile
            label="Signups from social"
            value={num(social.summary.signups)}
            info="New users who said TikTok, Instagram, YouTube, Facebook, X or Reddit in “Where did you hear about AnimalDex?”, or whose web visit came from one."
          />
          <Tile label="Views per signup" value={social.summary.signups ? num(Math.round(social.summary.views / social.summary.signups)) : "—"} />
          <Tile label="Carousels & text made" value={num(social.summary.generated)} hint={`${usd(social.summary.generationUsd)} generation cost`} />
        </TileGrid>
        <div className="grid gap-3 xl:grid-cols-3">
          <SingleChart data={data} title={`Posts by ${data.range.grain}`} values={social.series.map((row) => row.posts)} format={num} />
          <SingleChart data={data} title={`Views by post ${data.range.grain}`} values={social.series.map((row) => row.views)} format={num} />
          <SingleChart data={data} title={`Signups from social by ${data.range.grain}`} values={social.series.map((row) => row.signups)} format={num} />
        </div>
        <Card>
          <CardHeader title="By platform" description="Does each platform's posting turn into views and signups? Signups are self-reported (or the web referrer), so they undercount." />
          {social.byPlatform.length ? (
            <Table minWidth={900}>
              <thead>
                <tr>
                  <TH>Platform</TH>
                  <TH numeric>Posts</TH>
                  <TH numeric>Failed</TH>
                  <TH numeric>Views</TH>
                  <TH numeric>Avg / post</TH>
                  <TH numeric>Median</TH>
                  <TH numeric>Likes</TH>
                  <TH numeric>Shares</TH>
                  <TH numeric>Follows</TH>
                  <TH numeric>Measured at</TH>
                  <TH numeric>Signups</TH>
                  <TH numeric>Views / signup</TH>
                </tr>
              </thead>
              <tbody>
                {social.byPlatform.map((row) => (
                  <tr key={row.platform} className="hover:bg-white/[.02]">
                    <TD className="font-bold text-white">{socialLabels[row.platform] ?? row.platform}</TD>
                    <TD numeric>{num(row.posts)}</TD>
                    <TD numeric className={row.failed ? "text-red-300" : undefined}>
                      {num(row.failed)}
                    </TD>
                    <TD numeric className="font-bold text-white">
                      {row.measured ? num(row.views) : "—"}
                    </TD>
                    <TD numeric>{num(row.avgViews)}</TD>
                    <TD numeric>{num(row.medianViews)}</TD>
                    <TD numeric>{row.measured ? num(row.likes) : "—"}</TD>
                    <TD numeric>{row.measured ? num(row.shares) : "—"}</TD>
                    <TD numeric>{row.measured ? num(row.follows) : "—"}</TD>
                    <TD numeric className="text-ink-400">
                      {row.medianAgeHours == null ? "—" : row.medianAgeHours >= 48 ? `${Math.round(row.medianAgeHours / 24)} days` : `${Math.round(row.medianAgeHours)}h`}
                    </TD>
                    <TD numeric>{num(row.signups)}</TD>
                    <TD numeric>{num(row.viewsPerSignup)}</TD>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <EmptyState className="m-4 py-8" title="No social posts in this range." />
          )}
        </Card>
        <div className="grid gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader title="Top posts by views" />
            {social.top.length ? (
              <Table minWidth={640}>
                <thead>
                  <tr>
                    <TH>Shared</TH>
                    <TH>Post</TH>
                    <TH numeric>Views</TH>
                    <TH numeric>Likes</TH>
                    <TH numeric>Shares</TH>
                  </tr>
                </thead>
                <tbody>
                  {social.top.map((post) => (
                    <tr key={post.id}>
                      <TD className="whitespace-nowrap">
                        {post.createdAt.slice(5, 10)} · {socialLabels[post.platform] ?? post.platform}
                      </TD>
                      <TD className="max-w-[360px]">
                        {post.url ? (
                          <a href={post.url} target="_blank" rel="noreferrer" className="font-bold text-white hover:text-primary-200">
                            {post.title || "(no caption)"}
                          </a>
                        ) : (
                          <span className="font-bold text-white">{post.title || "(no caption)"}</span>
                        )}
                        {post.pageSlug ? <span className="block text-[11px] text-ink-500">{post.pageSlug}</span> : null}
                      </TD>
                      <TD numeric className="font-bold text-white">
                        {num(post.views)}
                      </TD>
                      <TD numeric>{num(post.likes)}</TD>
                      <TD numeric>{num(post.shares)}</TD>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <EmptyState className="m-4 py-8" title="No measured posts in this range." />
            )}
          </Card>
          <Card>
            <CardHeader title="Generated carousels & text" description="Made by the social content generator in the range." />
            {social.generations.length ? (
              <Table minWidth={280}>
                <thead>
                  <tr>
                    <TH>Kind</TH>
                    <TH numeric>Made</TH>
                    <TH numeric>Cost</TH>
                  </tr>
                </thead>
                <tbody>
                  {social.generations.map((row) => (
                    <tr key={row.kind}>
                      <TD className="font-bold text-white">{row.kind}</TD>
                      <TD numeric>{num(row.made)}</TD>
                      <TD numeric>{usd(row.usd)}</TD>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <EmptyState className="m-4 py-8" title="Nothing generated in this range." />
            )}
          </Card>
        </div>
      </section>
    </div>
  );
}
