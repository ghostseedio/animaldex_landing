import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildContentReport, generatorCost, socialPlatformOfChannel, type ContentInput } from "./content-analytics";

const base: ContentInput = {
  from: "2026-10-01",
  to: "2026-10-31",
  grain: "week",
  blogPosts: [],
  generatorRuns: [],
  search: new Map(),
  searchConnected: true,
  views: new Map(),
  socialPosts: [],
  socialGenerations: [],
  signups: [],
};

describe("content analytics", () => {
  it("reads the generator's cost from its run summary", () => {
    assert.equal(generatorCost("Published “Fox” (/blog/fox), editor 8/10, $1.82 (Research $0.67, …)"), 1.82);
    assert.equal(generatorCost("Writing a search-led article"), null);
  });

  it("maps signups to the social platform they came from", () => {
    assert.equal(socialPlatformOfChannel("said:tiktok"), "tiktok");
    assert.equal(socialPlatformOfChannel("web_instagram"), "instagram");
    assert.equal(socialPlatformOfChannel("said:google_search"), null);
  });

  it("credits a blog post with search clicks on every language copy, views, landing signups and social posts", () => {
    const report = buildContentReport({
      ...base,
      blogPosts: [
        { slug: "fox", title: "Fox", publishedAt: "2026-10-05", generated: true, source: "generator", costUsd: 1.8 },
        { slug: "old", title: "Old", publishedAt: "2026-09-01", generated: true, source: "generator", costUsd: 1.8 },
      ],
      generatorRuns: [
        { at: "2026-10-05T01:00:00Z", outcome: "published", costUsd: 1.8 },
        { at: "2026-10-06T01:00:00Z", outcome: "draft", costUsd: 1.7 },
      ],
      search: new Map([
        ["/blog/fox", { clicks: 10, impressions: 400, position: 8 }],
        ["/id/blog/fox", { clicks: 2, impressions: 100, position: 12 }],
      ]),
      views: new Map([["fox", 55]]),
      signups: [{ createdAt: "2026-10-07T03:00:00Z", channelKey: "web_google", landing: "/blog/fox" }],
      socialPosts: [{ id: "1", platform: "tiktok", status: "published", createdAt: "2026-10-06T00:00:00Z", title: "", pageSlug: "fox", url: null, views: 900, likes: 9, shares: 1, follows: 2, ageHours: 48 }],
    });
    const [post] = report.blog.posts;
    assert.equal(report.blog.posts.length, 1);
    assert.equal(post.clicks, 12);
    assert.equal(post.position, 8.8);
    assert.equal(post.views, 55);
    assert.equal(post.signups, 1);
    assert.equal(post.socialPosts, 1);
    assert.equal(report.blog.summary.drafts, 1);
    assert.equal(report.blog.summary.spendUsd, 3.5);
    assert.equal(report.blog.summary.costPerClick, 0.29);
  });

  it("totals social views and signups per platform", () => {
    const report = buildContentReport({
      ...base,
      socialPosts: [
        { id: "1", platform: "tiktok", status: "published", createdAt: "2026-10-06T00:00:00Z", title: "a", pageSlug: null, url: null, views: 1000, likes: 0, shares: 0, follows: 0, ageHours: 48 },
        { id: "2", platform: "tiktok", status: "published", createdAt: "2026-10-07T00:00:00Z", title: "b", pageSlug: null, url: null, views: 200, likes: 0, shares: 0, follows: 0, ageHours: 24 },
        { id: "3", platform: "tiktok", status: "failed", createdAt: "2026-10-07T00:00:00Z", title: "c", pageSlug: null, url: null, views: null, likes: null, shares: null, follows: null, ageHours: null },
      ],
      signups: [{ createdAt: "2026-10-08T00:00:00Z", channelKey: "said:tiktok", landing: null }],
    });
    const [tiktok] = report.social.byPlatform;
    assert.equal(tiktok.posts, 2);
    assert.equal(tiktok.failed, 1);
    assert.equal(tiktok.views, 1200);
    assert.equal(tiktok.medianViews, 600);
    assert.equal(tiktok.signups, 1);
    assert.equal(tiktok.viewsPerSignup, 1200);
    assert.equal(report.social.top[0].id, "1");
  });
});
