#!/usr/bin/env node
/**
 * Grounding's before-and-after shots (motion 100x pass, lane L3): the live scene on a snapshot (the real one, read
 * in place and served only to the local page), each chosen animal framed from its side, a still with the old rules
 * (`legacy`) and one with grounding's (`grounded`) a second apart on the same running scene, side by side, and a few
 * seconds of video with grounding's; then the runtime check's counts over a tour of the island, both rule sets.
 *
 *   node scripts/ark-grounding-shots.mjs --snapshot <real.json> --out <dir> [--kinds slope,perch,cling,hang,cliff] [--per 3] [--seconds 6]
 *
 * Nothing is uploaded; the models and rigs are read from the public bucket.
 */

import {execFileSync} from "node:child_process";
import {createServer} from "node:http";
import {existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import os from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {build} from "esbuild";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name, fallback) => {
    const at = process.argv.indexOf(`--${name}`);
    return at > 0 && process.argv[at + 1] && !process.argv[at + 1].startsWith("--") ? process.argv[at + 1] : fallback;
};
const snapshotFile = arg("snapshot");
if (!snapshotFile) throw new Error("--snapshot <file> is required");
const out = path.resolve(arg("out", path.join(root, ".ark-golden", "grounding-shots")));
const kinds = arg("kinds", "slope,perch,cling,hang,cliff").split(",").filter((kind) => kind && kind !== "none");
const per = Number(arg("per", "3"));
const seconds = Number(arg("seconds", "6"));
mkdirSync(out, {recursive: true});

const site = path.join(root, ".ark-golden", "grounding");
mkdirSync(site, {recursive: true});
await build({
    entryPoints: [path.join(root, "src/ark-scene/grounding/shots-entry.ts")],
    outfile: path.join(site, "shots.js"),
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["es2020"],
    minify: true,
    tsconfig: path.join(root, "tsconfig.json"),
    define: {"process.env.NODE_ENV": JSON.stringify("development")},
    logLevel: "warning"
});
writeFileSync(path.join(site, "shots.html"), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ark grounding shots</title>
<style>html,body{margin:0;height:100%;background:#ecdcc4;overflow:hidden}#ark{position:fixed;inset:0}</style>
</head><body><div id="ark"></div><script src="./shots.js"></script></body></html>
`);

const server = createServer((request, response) => {
    const url = new URL(request.url, "http://localhost");
    let file = null;
    let type = "application/octet-stream";
    if (url.pathname === "/snapshot.json") {
        file = snapshotFile;
        type = "application/json";
    } else {
        const fromPublic = url.pathname.startsWith("/ark/");
        const folder = fromPublic ? path.join(root, "public") : site;
        const candidate = path.join(folder, path.normalize(url.pathname).replace(/^\/+/, "") || "shots.html");
        if (candidate.startsWith(folder)) file = candidate;
        type = candidate.endsWith(".html") ? "text/html" : candidate.endsWith(".js") ? "text/javascript" : candidate.endsWith(".webp") ? "image/webp" : candidate.endsWith(".json") ? "application/json" : candidate.endsWith(".glb") ? "model/gltf-binary" : type;
    }
    if (!file || !existsSync(file)) return void response.writeHead(404).end();
    response.writeHead(200, {"Content-Type": type, "Cache-Control": "no-store"}).end(readFileSync(file));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;

function cachedChromium() {
    const cache = path.join(os.homedir(), "Library", "Caches", "ms-playwright");
    for (const name of readdirSync(cache).filter((entry) => /^chromium-\d+$/.test(entry)).sort().reverse()) {
        const candidate = path.join(cache, name, "chrome-mac-arm64", "Google Chrome for Testing.app", "Contents", "MacOS", "Google Chrome for Testing");
        if (existsSync(candidate)) return candidate;
    }
    return null;
}
const {chromium} = await import("playwright-core");
const browser = await chromium.launch({executablePath: process.env.ARK_CHROMIUM || cachedChromium() || undefined, headless: true, args: ["--headless=new", "--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=metal", "--disable-background-timer-throttling", "--disable-renderer-backgrounding"]});
const log = (...parts) => console.log(new Date().toISOString().slice(11, 19), ...parts);
const context = await browser.newContext({viewport: {width: 1280, height: 720}});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(String(error)));
const cdp = await context.newCDPSession(page);
await page.goto(`${base}/shots.html?hour=${arg("hour", "10")}`);
await page.waitForFunction(() => window.__arkGroundShots || window.__arkGroundShotsError, null, {timeout: 240_000});
const failed = await page.evaluate(() => window.__arkGroundShotsError);
if (failed) throw new Error(failed);
log("mounted; settling");
await page.evaluate(() => window.__arkGroundShots.settle(120_000));

async function record(name, ms) {
    const dir = path.join(out, `.frames-${name}`);
    rmSync(dir, {recursive: true, force: true});
    mkdirSync(dir, {recursive: true});
    let n = 0;
    let stopped = false;
    const stamps = [];
    const onFrame = async (frame) => {
        if (stopped) return;
        writeFileSync(path.join(dir, `f${String(n++).padStart(5, "0")}.jpg`), Buffer.from(frame.data, "base64"));
        stamps.push(frame.metadata.timestamp);
        await cdp.send("Page.screencastFrameAck", {sessionId: frame.sessionId}).catch(() => undefined);
    };
    cdp.on("Page.screencastFrame", onFrame);
    await cdp.send("Page.startScreencast", {format: "jpeg", quality: 85, everyNthFrame: 1});
    await page.waitForTimeout(ms);
    stopped = true;
    await cdp.send("Page.stopScreencast");
    cdp.off("Page.screencastFrame", onFrame);
    const fps = stamps.length > 1 ? (stamps.length - 1) / (stamps[stamps.length - 1] - stamps[0]) : 30;
    const file = path.join(out, `${name}.mp4`);
    if (n > 2) execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", fps.toFixed(2), "-i", path.join(dir, "f%05d.jpg"), "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", "-pix_fmt", "yuv420p", "-c:v", "libx264", "-crf", "24", file]);
    // Every 10th frame kept for the frame-by-frame review.
    const keep = path.join(out, `${name}-frames`);
    rmSync(keep, {recursive: true, force: true});
    mkdirSync(keep, {recursive: true});
    for (let i = 0; i < n; i += 10) writeFileSync(path.join(keep, `f${String(i).padStart(5, "0")}.jpg`), readFileSync(path.join(dir, `f${String(i).padStart(5, "0")}.jpg`)));
    rmSync(dir, {recursive: true, force: true});
    return {file, frames: n, fps};
}

/** Before and after side by side, each labelled (sharp: the system's ffmpeg has no text filter). */
async function pair(before, after, file, title) {
    const label = (text) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="44"><rect width="640" height="44" fill="black" fill-opacity="0.55"/><text x="14" y="30" font-family="Helvetica" font-size="24" fill="white">${text}</text></svg>`);
    const half = async (src, text) => sharp(await sharp(src).resize(640, 360).toBuffer()).composite([{input: label(text), top: 0, left: 0}]).toBuffer();
    await sharp({create: {width: 1280, height: 360, channels: 3, background: "#000"}})
        .composite([{input: await half(before, `before: ${title}`), left: 0, top: 0}, {input: await half(after, "after (grounding)"), left: 640, top: 0}])
        .jpeg({quality: 88})
        .toFile(file);
}

const shots = [];
for (const kind of kinds) {
    const rows = await page.evaluate(([k, c]) => window.__arkGroundShots.find(k, c), [kind, per * 3]);
    log(kind, rows.length, "found:", rows.slice(0, per).map((r) => `${r.slug}(${r.tag || "-"}, ${r.score.toFixed(2)})`).join(" "));
    // Distinct species first.
    const picked = [];
    for (const row of rows) if (picked.length < per && !picked.some((p) => p.slug === row.slug)) picked.push(row);
    for (const [i, row] of picked.entries()) {
        const name = `${kind}-${i + 1}-${row.slug}`;
        const distance = Math.min(Math.max(row.length * (kind === "perch" || kind === "hang" ? 3.2 : 2.6), 0.9), 9);
        // From its side (along the slope's contour), or facing the wall it clings to, a little round.
        // (A slope from along its contour, so its fall is across the frame and the feet stand on its line.)
        const around = kind === "cling" ? Math.atan2(row.nx, row.nz) + 0.7 : (kind === "perch" || kind === "hang") && row.out !== null ? row.out + 0.35 : kind === "slope" ? Math.atan2(row.gx, row.gz) + Math.PI / 2 : row.yaw + Math.PI / 2;
        const polar = kind === "cling" ? 1.45 : kind === "hang" ? 1.75 : kind === "perch" ? 1.4 : 1.42;
        const side = await page.evaluate(([id, d, p, a]) => window.__arkGroundShots.clearSide(id, d, p, a), [row.id, distance, polar, around]);
        await page.evaluate(([id, d, p, a]) => window.__arkGroundShots.frame(id, d, p, a), [row.id, distance, polar, side]);
        await page.waitForTimeout(1500);
        await page.evaluate(() => window.__arkGroundShots.settle(30_000));
        await page.evaluate(() => window.__arkGroundShots.rules("legacy"));
        await page.waitForTimeout(900);
        const before = path.join(out, `${name}-before.png`);
        await page.screenshot({path: before});
        await page.evaluate(() => window.__arkGroundShots.rules("grounded"));
        await page.waitForTimeout(900);
        const after = path.join(out, `${name}-after.png`);
        await page.screenshot({path: after});
        await pair(before, after, path.join(out, `${name}-pair.jpg`), `${row.slug} (${row.tag || kind})`);
        const video = await record(name, seconds * 1000);
        shots.push({kind, name, slug: row.slug, tag: row.tag, score: row.score, video: path.basename(video.file), frames: video.frames});
        log(name, "done");
    }
}

// The runtime check over a tour of the island: each rule set, the same views.
const tour = [[0, 0, 60, 0.3, 0.95], [-40, -60, 30, 1.2, 1.1], [-30, 0, 25, 2.2, 1.1], [30, 20, 25, 3.4, 1.1], [10, -30, 20, 4.4, 1.15], [-55, -30, 20, 5.2, 1.15]];
const counts = {};
for (const rules of ["legacy", "grounded"]) {
    // (The rules switched, a moment for every schedule pose to be worked out again under them, then counted.)
    await page.evaluate((r) => window.__arkGroundShots.rules(r), rules);
    await page.waitForTimeout(1500);
    await page.evaluate(() => window.__arkGroundShots.reset());
    for (const [x, z, d, azimuth, polar] of tour) {
        await page.evaluate(([x, z, d, a, p]) => window.__arkGroundShots.view(x, z, d, a, p), [x, z, d, azimuth, polar]);
        await page.waitForTimeout(3500);
    }
    counts[rules] = await page.evaluate(() => window.__arkGroundShots.report());
    log(rules, JSON.stringify({animals: counts[rules].animals, floating: counts[rules].floating, sinking: counts[rules].sinking, floatingMostly: counts[rules].floatingMostly, sinkingMostly: counts[rules].sinkingMostly}));
}
writeFileSync(path.join(out, "shots.json"), JSON.stringify({shots, runtime: counts, errors: errors.slice(0, 20)}, null, 1));
log("errors:", errors.length);
await browser.close();
server.close();
