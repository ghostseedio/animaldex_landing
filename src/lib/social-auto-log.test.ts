import {test} from "node:test";
import assert from "node:assert/strict";
import {buildAutoOrganic, countPublishTimes, countSharedPosts, dailyViews, maxPostCounts, mergeOrganicEntries, viewsFromSnapshots} from "./social/auto-log";
import {todayKey} from "./growth-command-center";

test("only published direct posts count, dated by the growth day they went live", () => {
    const counts = countSharedPosts([
        {platform: "tiktok", mode: "post", status: "published", updated_at: "2026-10-09T19:01:46Z"},
        {platform: "tiktok", mode: "draft", status: "published", updated_at: "2026-10-09T19:02:00Z"},
        {platform: "tiktok", mode: "post", status: "failed", updated_at: "2026-10-09T18:23:25Z"},
        {platform: "youtube", mode: "post", status: "published", updated_at: "2026-10-09T11:02:22Z"},
        {platform: "x", mode: "post", status: "published", updated_at: "2026-10-09T12:36:23Z"}
    ], todayKey);
    // 19:01 UTC is already the 10th in Jakarta; 11:02 UTC is still the 9th.
    assert.deepEqual(counts, {"2026-10-10": {tiktok: 1}, "2026-10-09": {youtube: 1, x: 1}});
});

test("daily views come only from snapshots on consecutive days, never negative", () => {
    const views = viewsFromSnapshots([
        {platform: "x", views: 100, recorded_at: "2026-10-08T03:00:00Z"},
        {platform: "x", views: 130, recorded_at: "2026-10-08T09:00:00Z"},
        {platform: "x", views: 180, recorded_at: "2026-10-09T09:00:00Z"},
        {platform: "x", views: 400, recorded_at: "2026-10-12T09:00:00Z"},
        {platform: "tiktok", views: 50, recorded_at: "2026-10-08T09:00:00Z"},
        {platform: "tiktok", views: 40, recorded_at: "2026-10-09T09:00:00Z"},
        {platform: "youtube", views: null, recorded_at: "2026-10-09T09:00:00Z"}
    ], todayKey);
    // The 12th follows a gap, so it isn't credited with three days of views.
    assert.deepEqual(views, {"2026-10-09": {x: 50}});
});

test("exact daily views win over snapshot deltas", () => {
    const auto = buildAutoOrganic({"2026-10-09": {youtube: 1}}, [{"2026-10-09": {youtube: 75}}, {"2026-10-09": {youtube: 60, x: 5}}]);
    assert.deepEqual(auto, {"2026-10-09": [{platform: "youtube", posts: 1, views: 75}, {platform: "x", posts: 0, views: 5}]});
});

test("hand-entered posts add to auto posts; hand-entered views replace auto views", () => {
    const merged = mergeOrganicEntries(
        [{platform: "tiktok", posts: 1, views: 4200}, {platform: "youtube", posts: 0, views: 0}, {platform: "reddit", posts: 2, views: 90}],
        [{platform: "tiktok", posts: 1, views: 3900}, {platform: "youtube", posts: 1, views: 75}, {platform: "x", posts: 1, views: 0}]
    );
    assert.deepEqual(merged, [
        {platform: "tiktok", posts: 2, views: 4200},
        {platform: "youtube", posts: 1, views: 75},
        {platform: "reddit", posts: 2, views: 90},
        {platform: "x", posts: 1, views: 0}
    ]);
});

test("platform upload lists and the share log overlap, so the larger count wins", () => {
    const shared = countSharedPosts([
        {platform: "youtube", mode: "post", status: "published", updated_at: "2026-10-09T11:02:22Z"}
    ], todayKey);
    const uploads = countPublishTimes("youtube", ["2026-10-09T10:00:00Z", "2026-10-09T11:02:00Z", "not a date"], todayKey);
    const tiktok = countPublishTimes("tiktok", ["2026-10-01T03:00:00Z"], todayKey);
    assert.deepEqual(maxPostCounts(shared, uploads, tiktok), {"2026-10-09": {youtube: 2}, "2026-10-01": {tiktok: 1}});
});

test("exact daily views fill past days and win over snapshot deltas", () => {
    const exact = dailyViews("youtube", {"2026-10-02": 120, "2026-10-03": 0});
    const snapshots = viewsFromSnapshots([
        {platform: "youtube", views: 1000, recorded_at: "2026-10-01T09:00:00Z"},
        {platform: "youtube", views: 1500, recorded_at: "2026-10-02T09:00:00Z"}
    ], todayKey);
    assert.deepEqual(buildAutoOrganic({}, [exact, snapshots]), {"2026-10-02": [{platform: "youtube", posts: 0, views: 120}]});
});
