// Builds the footage library the video generator plays our own clips from
// (src/lib/content-video/footage.ts): every shot in a decisions file is cut
// from its source video, cropped to vertical 1080x1920, converted from the
// iPhone's HDR (HLG) to SDR, re-encoded with NO sound and NO metadata (the
// iPhone's GPS location is stripped), given a poster frame, uploaded to the
// content-videos bucket under footage/, and indexed in
// src/data/footage-library.json (merged by id, so re-running adds shots).
//
// The decisions file is tab-separated, one shot per line:
//   <source video path>  <kind: scan|result|reaction|animal|intro>  <start s>  <end s>  <species slug or empty>  <label>  [pre-cut file]
// A pre-cut file (already trimmed to 1080x1920) is used as is, after the same metadata check.
// Only our own footage: never someone else's video, never a recognisable
// stranger, never a child.
//
// Run: npx tsx --env-file=.env scripts/build-footage-library.mts <decisions.tsv> [--dry-run]

import {createHash} from "node:crypto";
import {spawnSync} from "node:child_process";
import {existsSync, mkdirSync, readFileSync, writeFileSync} from "node:fs";
import os from "node:os";
import path from "node:path";

type Kind = "scan" | "result" | "reaction" | "animal" | "intro";
type Clip = {id: string; kind: Kind; species: string | null; label: string | null; seconds: number; path: string; poster: string; filmed: string | null};

const [decisionsPath, ...flags] = process.argv.slice(2);
if (!decisionsPath) throw new Error("Usage: build-footage-library.mts <decisions.tsv> [--dry-run]");
const dryRun = flags.includes("--dry-run");
const KINDS = new Set<Kind>(["scan", "result", "reaction", "animal", "intro"]);
const BUCKET = "content-videos";
const libraryPath = path.join(process.cwd(), "src", "data", "footage-library.json");
const workDir = path.join(os.tmpdir(), "animaldex-footage");
mkdirSync(workDir, {recursive: true});

function run(command: string, args: string[]) {
    const result = spawnSync(command, args, {encoding: "utf8", maxBuffer: 64 * 1024 * 1024});
    if (result.status !== 0) throw new Error(`${command} failed: ${(result.stderr || result.stdout).slice(-400)}`);
    return result.stdout;
}

function probe(file: string) {
    const json = JSON.parse(run("ffprobe", ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file]));
    const video = json.streams.find((stream: {codec_type: string}) => stream.codec_type === "video") ?? {};
    const tags = Object.fromEntries(Object.entries(json.format?.tags ?? {}).map(([key, value]) => [key.toLowerCase(), value]));
    return {
        hdr: ["arib-std-b67", "smpte2084"].includes(video.color_transfer),
        seconds: Number(json.format?.duration ?? 0),
        created: (tags["com.apple.quicktime.creationdate"] ?? tags.creation_time ?? null) as string | null
    };
}

/** Trim, crop to 9:16, HDR to SDR, no audio, no metadata. HLG reads well as SDR once its BT.2020 colour is mapped to BT.709. */
function exportShot(source: string, start: number, end: number, hdr: boolean, out: string) {
    const colour = hdr ? "colorspace=all=bt709:iall=bt2020:itrc=bt709:fast=1:format=yuv420p,eq=saturation=1.12:contrast=1.05," : "";
    run("ffmpeg", [
        "-v", "error", "-y", "-ss", String(start), "-t", (end - start).toFixed(2), "-i", source,
        "-vf", `${colour}scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos,crop=1080:1920,setsar=1,format=yuv420p`,
        "-an", "-map_metadata", "-1", "-map_chapters", "-1",
        "-c:v", "libx264", "-preset", "medium", "-crf", "22", "-movflags", "+faststart", "-threads", "2", out
    ]);
    // Nothing identifying may survive: no location, no device, no creation date.
    const left = run("ffprobe", ["-v", "error", "-show_entries", "format_tags", "-of", "json", out]);
    if (/location|iso6709|com\.apple|creation_time/i.test(left)) throw new Error(`${out} still carries metadata: ${left}`);
}

async function upload(storagePath: string, file: string, contentType: string) {
    const url = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are needed to upload");
    const response = await fetch(`${url}/storage/v1/object/${BUCKET}/${storagePath}`, {
        method: "POST",
        headers: {apikey: key, Authorization: `Bearer ${key}`, "Content-Type": contentType, "x-upsert": "true", "Cache-Control": "max-age=31536000"},
        body: readFileSync(file)
    });
    if (!response.ok) throw new Error(`Upload of ${storagePath} failed (${response.status}): ${(await response.text()).slice(0, 200)}`);
}

const existing: {clips: Clip[]} = existsSync(libraryPath) ? JSON.parse(readFileSync(libraryPath, "utf8")) : {clips: []};
const byId = new Map(existing.clips.map((clip) => [clip.id, clip]));
const lines = readFileSync(decisionsPath, "utf8").split("\n").map((line) => line.trimEnd()).filter((line) => line && !line.startsWith("#"));
let made = 0;
for (const line of lines) {
    const [rawSource, kind, startText, endText, species = "", label = "", preCut = ""] = line.split("\t");
    const source = rawSource.replace(/^~(?=\/)/, os.homedir());
    if (!KINDS.has(kind as Kind)) throw new Error(`Unknown kind "${kind}" in: ${line}`);
    const info = probe(source);
    const start = Number(startText);
    const end = Math.min(Number(endText), info.seconds - 0.05);
    if (!(end - start >= 1.5)) {
        console.warn(`skip (under 1.5 s): ${line}`);
        continue;
    }
    // The id names the shot, never the file it came from (no personal paths in the repo).
    const id = `${kind}-${species || "any"}-${createHash("sha1").update(`${path.basename(source)}:${start}`).digest("hex").slice(0, 6)}`;
    if (byId.has(id)) continue;
    const out = path.join(workDir, `${id}.mp4`);
    const poster = path.join(workDir, `${id}.jpg`);
    if (preCut && existsSync(preCut)) {
        const left = run("ffprobe", ["-v", "error", "-show_entries", "format_tags", "-of", "json", preCut]);
        if (/location|iso6709|com\.apple|creation_time/i.test(left)) throw new Error(`${preCut} still carries metadata`);
        writeFileSync(out, readFileSync(preCut));
    } else if (!existsSync(out)) exportShot(source, start, end, info.hdr, out);
    run("ffmpeg", ["-v", "error", "-y", "-ss", String(Math.min(1, (end - start) / 2)), "-i", out, "-frames:v", "1", "-vf", "scale=360:-2", "-q:v", "4", poster]);
    const clip: Clip = {
        id,
        kind: kind as Kind,
        species: species || null,
        label: label || null,
        seconds: Math.round((end - start) * 100) / 100,
        path: `footage/${id}.mp4`,
        poster: `footage/${id}.jpg`,
        filmed: info.created ? info.created.slice(0, 7) : null
    };
    if (!dryRun) {
        await upload(clip.path, out, "video/mp4");
        await upload(clip.poster, poster, "image/jpeg");
    }
    byId.set(id, clip);
    made += 1;
    console.log(`${dryRun ? "would add" : "added"} ${id} (${clip.seconds}s)`);
}
const clips = Array.from(byId.values()).sort((a, b) => a.id.localeCompare(b.id));
if (!dryRun) writeFileSync(libraryPath, `${JSON.stringify({note: existing && "note" in existing ? (existing as {note?: string}).note : undefined, clips}, null, 2)}\n`);
console.log(`${made} new shots; ${clips.length} in the library${dryRun ? " (dry run: nothing uploaded or written)" : ""}`);
