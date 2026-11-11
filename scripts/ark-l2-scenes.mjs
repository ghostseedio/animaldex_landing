#!/usr/bin/env node
/**
 * Lane L2's scene recordings (flight, swimming, legless): builds `src/ark-scene/l2-scenes-entry.ts` into
 * `.ark-golden/l2/` (gitignored), serves it on localhost with the scene's art and a local rig set, and drives
 * Playwright's cached Chromium through each scene: a video (mp4, from the DevTools screencast and the system's ffmpeg),
 * a contact sheet of frames (one every `--every` seconds, for reviewing frame by frame), and every watched animal's
 * rig and L2 state sampled every 100 ms (json). `--perf` adds the frame times per scene.
 *
 *   node scripts/ark-l2-scenes.mjs --set <publish dir> --out <dir> [--scenes a,b] [--seconds 16] [--every 0.25] [--device desktop|phone] [--before] [--perf]
 *
 * `--before`: lane L2 switched off in the page (`__arkL2Motion = false`: every L2 hook falls back to the scene as it was).
 *
 * Nothing is uploaded; the models come read-only from the live model set.
 */

import {execFileSync} from "node:child_process";
import {createServer} from "node:http";
import {existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import os from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {build} from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name, fallback) => {
    const at = process.argv.indexOf(`--${name}`);
    return at > 0 && process.argv[at + 1] && !process.argv[at + 1].startsWith("--") ? process.argv[at + 1] : fallback;
};
const flag = (name) => process.argv.includes(`--${name}`);
const out = path.resolve(arg("out", path.join(root, ".ark-golden", "l2-shots")));
const set = arg("set", null) ? path.resolve(arg("set")) : null;
const seconds = Number(arg("seconds", "16"));
const every = Number(arg("every", "0.25"));
const deviceName = arg("device", "desktop");
mkdirSync(out, {recursive: true});

const site = path.join(root, ".ark-golden", "l2");
mkdirSync(site, {recursive: true});
await build({
    entryPoints: [path.join(root, "src/ark-scene/l2-scenes-entry.ts")],
    outfile: path.join(site, "l2-scene.js"),
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["es2020"],
    minify: true,
    tsconfig: path.join(root, "tsconfig.json"),
    define: {"process.env.NODE_ENV": JSON.stringify("development")},
    logLevel: "warning"
});
writeFileSync(path.join(site, "l2.html"), `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover">
<title>Ark L2 scenes</title>
<style>html,body{margin:0;height:100%;background:#ecdcc4;overflow:hidden}#ark{position:fixed;inset:0}</style>
</head><body><div id="ark"></div><script src="./l2-scene.js"></script></body></html>
`);

const SLUG = /^[a-z0-9][a-z0-9-]{0,120}$/;
const server = createServer((request, response) => {
    const url = new URL(request.url, "http://localhost");
    const parts = url.pathname.split("/").filter(Boolean);
    let file = null;
    let type = "application/octet-stream";
    if (parts[0] === "ark-rig" && parts[1] === "v2" && set) {
        if (parts.length === 3 && parts[2] === "manifest.json") {
            file = path.join(set, "manifest.json");
            type = "application/json";
        } else if (parts.length === 4 && SLUG.test(parts[2]) && /^[0-9a-f]{12}\.rig\.glb$/.test(parts[3])) {
            file = path.join(set, parts[2], parts[3]);
            type = "model/gltf-binary";
        }
    } else {
        const fromPublic = url.pathname.startsWith("/ark/");
        const folder = fromPublic ? path.join(root, "public") : site;
        const candidate = path.join(folder, path.normalize(url.pathname).replace(/^\/+/, "") || "l2.html");
        if (candidate.startsWith(folder)) file = candidate;
        type = candidate.endsWith(".html") ? "text/html" : candidate.endsWith(".js") ? "text/javascript" : candidate.endsWith(".webp") ? "image/webp" : candidate.endsWith(".json") ? "application/json" : type;
    }
    if (!file || !existsSync(file)) {
        response.writeHead(404).end();
        return;
    }
    response.writeHead(200, {"Content-Type": type, "Cache-Control": "no-store"}).end(readFileSync(file));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;

function cachedChromium() {
    const cache = path.join(os.homedir(), "Library", "Caches", "ms-playwright");
    if (!existsSync(cache)) return null;
    for (const name of readdirSync(cache).filter((entry) => /^chromium-\d+$/.test(entry)).sort().reverse()) {
        const candidate = path.join(cache, name, "chrome-mac-arm64", "Google Chrome for Testing.app", "Contents", "MacOS", "Google Chrome for Testing");
        if (existsSync(candidate)) return candidate;
    }
    return null;
}

const DEVICES = {
    desktop: {viewport: {width: 1280, height: 720}, deviceScaleFactor: 1, isMobile: false, hasTouch: false, cpuThrottle: 1},
    phone: {viewport: {width: 360, height: 800}, deviceScaleFactor: 2, isMobile: true, hasTouch: true, cpuThrottle: 4, userAgent: "Mozilla/5.0 (Linux; Android 14; SM-A356B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36"}
};

const {chromium} = await import("playwright-core");
const browser = await chromium.launch({
    executablePath: process.env.ARK_CHROMIUM || cachedChromium() || undefined,
    headless: !flag("headed"),
    args: [...(flag("headed") ? [] : ["--headless=new"]), "--enable-gpu", "--ignore-gpu-blocklist", ...(process.platform === "darwin" ? ["--use-angle=metal"] : []), "--disable-background-timer-throttling", "--disable-renderer-backgrounding"]
});
const log = (...parts) => console.log(new Date().toISOString().slice(11, 19), ...parts);

async function open(name, query) {
    const device = DEVICES[name];
    const context = await browser.newContext({viewport: device.viewport, deviceScaleFactor: device.deviceScaleFactor, isMobile: device.isMobile, hasTouch: device.hasTouch, userAgent: device.userAgent});
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    page.on("console", (message) => {
        if (message.type() === "error" || /\[ark\]/.test(message.text())) errors.push(message.text());
    });
    const cdp = await context.newCDPSession(page);
    if (device.cpuThrottle > 1) await cdp.send("Emulation.setCPUThrottlingRate", {rate: device.cpuThrottle});
    await page.goto(`${base}/l2.html?${query}`);
    await page.waitForFunction(() => window.__arkL2 || window.__arkL2Error, null, {timeout: 180_000});
    const failed = await page.evaluate(() => window.__arkL2Error);
    if (failed) throw new Error(failed);
    return {context, page, errors, cdp};
}

async function record(cdp, name) {
    const dir = path.join(out, `.frames-${name}`);
    rmSync(dir, {recursive: true, force: true});
    mkdirSync(dir, {recursive: true});
    let n = 0;
    let stopped = false;
    const stamps = [];
    cdp.on("Page.screencastFrame", async (frame) => {
        if (stopped) return;
        writeFileSync(path.join(dir, `f${String(n++).padStart(5, "0")}.jpg`), Buffer.from(frame.data, "base64"));
        stamps.push(frame.metadata.timestamp);
        await cdp.send("Page.screencastFrameAck", {sessionId: frame.sessionId}).catch(() => undefined);
    });
    // (A smaller frame keeps the screencast near the page's own rate: a 10 Hz wing beat needs 30+ frames a second.)
    await cdp.send("Page.startScreencast", {format: "jpeg", quality: 80, everyNthFrame: 1, maxWidth: Number(arg("cast-width", "960")), maxHeight: Number(arg("cast-height", "540"))});
    return async () => {
        stopped = true;
        await cdp.send("Page.stopScreencast").catch(() => undefined);
        if (n < 2) return null;
        const fps = Math.max(Math.min((stamps.length - 1) / (stamps[stamps.length - 1] - stamps[0] || 1), 60), 4);
        const file = path.join(out, `${name}.mp4`);
        execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", fps.toFixed(2), "-i", path.join(dir, "f%05d.jpg"), "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", "-pix_fmt", "yuv420p", "-c:v", "libx264", "-crf", "22", file]);
        // The review sheet: one frame every `every` seconds of the screencast's own clock, 4 across, numbered.
        const picks = [];
        for (let t = stamps[0]; t <= stamps[stamps.length - 1]; t += every) {
            let best = 0;
            for (let i = 0; i < stamps.length; i++) if (Math.abs(stamps[i] - t) < Math.abs(stamps[best] - t)) best = i;
            picks.push(best);
        }
        const sheetDir = path.join(out, `.sheet-${name}`);
        rmSync(sheetDir, {recursive: true, force: true});
        mkdirSync(sheetDir, {recursive: true});
        picks.forEach((i, k) => writeFileSync(path.join(sheetDir, `s${String(k).padStart(4, "0")}.jpg`), readFileSync(path.join(dir, `f${String(i).padStart(5, "0")}.jpg`))));
        const per = 16;
        for (let page = 0; page * per < picks.length; page++) {
            execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-start_number", String(page * per), "-i", path.join(sheetDir, "s%04d.jpg"), "-frames:v", "1", "-vf", "scale=480:-2,tile=4x4:padding=4", path.join(out, `${name}-sheet${page + 1}.jpg`)]);
        }
        rmSync(sheetDir, {recursive: true, force: true});
        rmSync(dir, {recursive: true, force: true});
        return {file, frames: n, fps: Math.round(fps * 10) / 10, sheets: Math.ceil(picks.length / per)};
    };
}

const query = [set ? "rig=/ark-rig/v2" : "", arg("quality", "") ? `quality=${arg("quality", "")}` : "", flag("before") ? "before=1" : "", arg("hours", "") ? `hours=${arg("hours", "")}` : ""].filter(Boolean).join("&");
const summary = [];
const wanted = arg("scenes", "takeoff_land,bank_circle,soar,bound_hop,hover_walk,flutter,swim_orca,swim_humpback,swim_shark,swim_salmon,swim_manta,swim_stingray,swim_reef,swim_eel,snake_lateral,snake_sidewind,snake_python");
for (const name of wanted.split(",").filter(Boolean)) {
    const {context, page, errors, cdp} = await open(deviceName, query);
    const prepared = await page.evaluate(() => window.__arkL2.prepare());
    log(name, "prepared", JSON.stringify({settled: prepared.settled, tier: prepared.stats.tier}));
    const info = await page.evaluate((n) => window.__arkL2.setup(n), name);
    const stop = await record(cdp, name);
    const samples = [];
    const started = Date.now();
    const frameGaps = [];
    while (Date.now() - started < seconds * 1000) {
        const t = (Date.now() - started) / 1000;
        samples.push({t, s: await page.evaluate((watch) => window.__arkL2.sample(watch), info.watch)});
        await page.waitForTimeout(100);
    }
    if (flag("perf")) frameGaps.push(...(await page.evaluate(() => new Promise((resolve) => {
        const gaps = [];
        let last = performance.now();
        const step = (now) => {
            gaps.push(now - last);
            last = now;
            if (gaps.length < 180) requestAnimationFrame(step);
            else resolve(gaps);
        };
        requestAnimationFrame(step);
    }))));
    const video = await stop();
    const stats = await page.evaluate(() => window.__arkL2.stats());
    await context.close();
    writeFileSync(path.join(out, `${name}.json`), JSON.stringify({name, ...info, samples, stats}, null, 1));
    const clips = {};
    for (const {s} of samples) for (const r of s) if (r.clip) (clips[r.slug] ??= new Set()).add(r.clip);
    const sorted = frameGaps.slice().sort((a, b) => a - b);
    const row = {
        name,
        note: info.note,
        video: video ? path.basename(video.file) : null,
        fps: video?.fps ?? null,
        sheets: video?.sheets ?? 0,
        clips: Object.fromEntries(Object.entries(clips).map(([k, v]) => [k, [...v]])),
        rigged: stats.rigged,
        ...(sorted.length ? {frameP50: Math.round(sorted[Math.floor(sorted.length / 2)] * 10) / 10, frameP95: Math.round(sorted[Math.floor(sorted.length * 0.95)] * 10) / 10} : {}),
        errors: errors.filter((e) => !/Failed to load resource/.test(e)).slice(0, 5)
    };
    summary.push(row);
    log(name, JSON.stringify(row).slice(0, 500));
}
writeFileSync(path.join(out, "summary.json"), JSON.stringify(summary, null, 1));
await browser.close();
server.close();
log("done", out);
