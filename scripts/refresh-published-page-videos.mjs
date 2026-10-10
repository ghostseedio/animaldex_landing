// Snapshots every published page video (admin_content_videos) into
// src/data/published-page-videos.json, so static pages (comparisons, hybrids,
// tier lists, locations) render their video and VideoObject markup in the
// HTML without calling Supabase at build time. Pages also ask
// /api/page-videos for anything published after the snapshot.
//
// Run: node --env-file=.env scripts/refresh-published-page-videos.mjs
import {writeFileSync} from "node:fs";

const url = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");

const headers = {apikey: key, ...(key.startsWith("eyJ") ? {Authorization: `Bearer ${key}`} : {})};
const response = await fetch(`${url}/rest/v1/admin_content_videos?select=source_type,source_slug,video_path,poster_path,duration_seconds,plan,timeline,published_at&archived_at=is.null&published_at=not.is.null&video_path=not.is.null&order=source_type,source_slug`, {headers});
if (!response.ok) throw new Error(`admin_content_videos ${response.status}: ${await response.text()}`);
const rows = await response.json();
const publicUrl = (path) => `${url}/storage/v1/object/public/content-videos/${path.split("/").map(encodeURIComponent).join("/")}`;

const videos = Object.fromEntries(rows.map((row) => [`${row.source_type}:${row.source_slug}`, {
    videoUrl: publicUrl(row.video_path),
    posterUrl: row.poster_path ? publicUrl(row.poster_path) : null,
    durationSeconds: row.duration_seconds === null ? null : Number(row.duration_seconds),
    title: row.plan?.title ?? "",
    hookText: row.plan?.hookText ?? "",
    timeline: Array.isArray(row.timeline) ? row.timeline : [],
    publishedAt: row.published_at
}]));

writeFileSync("src/data/published-page-videos.json", `${JSON.stringify({generatedAt: new Date().toISOString(), note: "Published page videos baked into static pages at build time. Refresh with: npm run refresh:page-videos", videos}, null, 4)}\n`);
console.log(`snapshotted ${rows.length} published page videos`);
