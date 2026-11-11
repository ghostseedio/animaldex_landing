#!/usr/bin/env node
/**
 * The behaviour intelligence pass's scenario recordings and perf numbers
 * (docs/ark/intelligence.md). Builds `src/ark-scene/intelligence-entry.ts`
 * into `.ark-golden/intel/` (gitignored), serves it on localhost with the
 * scene's art, and drives Playwright's cached Chromium (playwright-core,
 * Apache-2.0, an existing dev dependency) through each scenario: a video
 * (mp4, from the DevTools screencast and the system's ffmpeg), key frames (png) and the reactive layer's states sampled every
 * 200 ms (json). With --perf, frame intervals and the reactive layer's cost
 * per tier on the desktop and the phone proxy (360×800, DPR 2, 4× CPU
 * throttle), the golden-shot harness's devices.
 *
 *   node scripts/ark-intelligence-scenarios.mjs --out <dir> [--scenarios a,b] [--seconds 20] [--perf] [--headed]
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
const out = path.resolve(arg("out", path.join(root, ".ark-golden", "intel-shots")));
const seconds = Number(arg("seconds", "20"));
const perfOnly = flag("perf-only");
mkdirSync(out, {recursive: true});

const site = path.join(root, ".ark-golden", "intel");
mkdirSync(site, {recursive: true});
await build({
    entryPoints: [path.join(root, "src/ark-scene/intelligence-entry.ts")],
    outfile: path.join(site, "intel-scene.js"),
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["es2020"],
    minify: true,
    tsconfig: path.join(root, "tsconfig.json"),
    define: {"process.env.NODE_ENV": JSON.stringify("development")},
    logLevel: "warning"
});
writeFileSync(path.join(site, "intel.html"), `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover">
<title>Ark intelligence scenarios</title>
<style>html,body{margin:0;height:100%;background:#ecdcc4;overflow:hidden}#ark{position:fixed;inset:0}</style>
</head><body><div id="ark"></div><script src="./intel-scene.js"></script></body></html>
`);

const server = createServer((request, response) => {
    const url = new URL(request.url, "http://localhost");
    const fromPublic = url.pathname.startsWith("/ark/");
    const folder = fromPublic ? path.join(root, "public") : site;
    const file = path.join(folder, path.normalize(url.pathname).replace(/^\/+/, "") || "intel.html");
    if (!file.startsWith(folder) || !existsSync(file)) {
        response.writeHead(404).end();
        return;
    }
    const type = file.endsWith(".html") ? "text/html" : file.endsWith(".js") ? "text/javascript" : file.endsWith(".webp") ? "image/webp" : "application/octet-stream";
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

async function open(deviceName, query, video) {
    const device = DEVICES[deviceName];
    const context = await browser.newContext({
        viewport: device.viewport,
        deviceScaleFactor: device.deviceScaleFactor,
        isMobile: device.isMobile,
        hasTouch: device.hasTouch,
        userAgent: device.userAgent
    });
    if (deviceName === "phone") {
        await context.addInitScript(() => {
            Object.defineProperty(navigator, "hardwareConcurrency", {get: () => 8});
            Object.defineProperty(navigator, "deviceMemory", {get: () => 4});
        });
    }
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
    });
    const cdp = await context.newCDPSession(page);
    if (device.cpuThrottle > 1) await cdp.send("Emulation.setCPUThrottlingRate", {rate: device.cpuThrottle});
    void video;
    await page.goto(`${base}/intel.html?${query}`);
    await page.waitForFunction(() => window.__arkIntel || window.__arkIntelError, null, {timeout: 180_000});
    const failed = await page.evaluate(() => window.__arkIntelError);
    if (failed) throw new Error(failed);
    return {context, page, errors, cdp};
}

/** Records the page through the DevTools screencast into numbered JPEGs, then an mp4 (system ffmpeg). */
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
    await cdp.send("Page.startScreencast", {format: "jpeg", quality: 82, everyNthFrame: 1});
    return async () => {
        stopped = true;
        await cdp.send("Page.stopScreencast").catch(() => undefined);
        if (n < 2) return null;
        const fps = Math.max(Math.min((stamps.length - 1) / (stamps[stamps.length - 1] - stamps[0] || 1), 60), 4);
        const file = path.join(out, `${name}.mp4`);
        // Each frame held for as long as it was on screen (the screencast's own timestamps), so the video's clock is
        // the page's: a frame that took 200 ms to draw lasts 200 ms, and "8 s in" in the note is 8 s into the video.
        const list = stamps.map((stamp, i) => `file 'f${String(i).padStart(5, "0")}.jpg'\nduration ${Math.max((stamps[i + 1] ?? stamp + 1 / fps) - stamp, 0.001).toFixed(4)}`).join("\n");
        writeFileSync(path.join(dir, "frames.txt"), `${list}\nfile 'f${String(stamps.length - 1).padStart(5, "0")}.jpg'\n`);
        execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", path.join(dir, "frames.txt"), "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", "-fps_mode", "vfr", "-pix_fmt", "yuv420p", "-c:v", "libx264", "-crf", "24", file]);
        rmSync(dir, {recursive: true, force: true});
        return {file, frames: n, fps: Math.round(fps * 10) / 10, first: stamps[0]};
    };
}

const summary = [];
if (!perfOnly) {
    const wanted = arg("scenarios", "");
    for (const name of wanted ? wanted.split(",") : ["predator_herd", "pack_hunt", "squirrel_cache", "avoid_spot", "parents_shield", "storm", "curious_camera", "sentinel_raptor", "heads_closeup"]) {
        const {context, page, errors, cdp} = await open("desktop", "quality=high", true);
        const prepared = await page.evaluate(() => window.__arkIntel.prepare());
        log(name, "prepared", JSON.stringify({settled: prepared.settled, tier: prepared.stats.tier}));
        const info = await page.evaluate((n) => window.__arkIntel.setup(n), name);
        const stop = await record(cdp, name);
        const samples = [];
        const started = Date.now();
        // (The video starts with the first screencast frame, a moment after this: `videoStartsS` below.)
        let shot = 0;
        // A scenario may ask for longer (the squirrel's return comes after 20 s); --seconds sets the rest.
        const length = arg("seconds", null) ? seconds : info.seconds ?? seconds;
        while (Date.now() - started < length * 1000) {
            samples.push(await page.evaluate((watch) => window.__arkIntel.sample(watch), info.watch));
            const k = Math.floor((Date.now() - started) / ((length * 1000) / 5));
            if (k >= shot) {
                await page.screenshot({path: path.join(out, `${name}-${String(shot).padStart(2, "0")}.png`)});
                shot++;
            }
            await page.waitForTimeout(200);
        }
        const video = await stop();
        await context.close();
        writeFileSync(path.join(out, `${name}.json`), JSON.stringify({name, ...info, samples}, null, 1));
        // The numbers the report reads: actions seen per animal, first reaction, calls, head movement.
        const actions = {};
        const firstAt = {};
        let calls = 0;
        const headRange = {};
        for (const s of samples) {
            for (const [id, r] of Object.entries(s.out)) {
                if (!r) continue;
                (actions[id] ??= new Set()).add(r.action);
                if (["alert", "flee", "freeze", "shield_young", "threat_display", "hide_behind_parent", "stalk", "watch_prey", "investigate_camera", "shelter", "cache_bury", "cache_return", "sentinel"].includes(r.action) && firstAt[id] === undefined) firstAt[id] = Math.round((s.t - samples[0].t) * 10) / 10;
                if (r.called) calls++;
                const h = (headRange[id] ??= [Infinity, -Infinity]);
                h[0] = Math.min(h[0], r.headYaw);
                h[1] = Math.max(h[1], r.headYaw);
            }
        }
        const row = {
            name,
            note: info.note,
            video: video ? path.basename(video.file) : null,
            videoFps: video?.fps ?? null,
            // Seconds from the scenario's start (its first sample) to the video's first frame: subtract it from a note's times.
            videoStartsS: video ? Math.round((video.first - started / 1000) * 10) / 10 : null,
            animals: info.watch.length,
            actions: Object.fromEntries(Object.entries(actions).map(([id, set]) => [id.slice(-4), [...set]])),
            firstReactionS: Object.fromEntries(Object.entries(firstAt).map(([id, t]) => [id.slice(-4), t])),
            callsSampled: calls,
            headYawRange: Object.fromEntries(Object.entries(headRange).map(([id, [a, b]]) => [id.slice(-4), Math.round((b - a) * 100) / 100])),
            errors: errors.filter((e) => !/Failed to load resource/.test(e)).slice(0, 3)
        };
        summary.push(row);
        log(name, JSON.stringify(row).slice(0, 400));
    }
}

const perf = [];
if (flag("perf") || perfOnly) {
    for (const deviceName of ["desktop", "phone"]) {
        for (const quality of ["high", "medium", "low"]) {
            const {context, page} = await open(deviceName, `quality=${quality}`, false);
            await page.evaluate(() => window.__arkIntel.prepare());
            await page.evaluate(() => window.__arkIntel.setup("predator_herd"));
            await page.waitForTimeout(3000);
            const m = await page.evaluate(() => window.__arkIntel.measure(5000));
            perf.push({device: deviceName, quality, ...m});
            log("perf", deviceName, quality, JSON.stringify(m));
            await context.close();
        }
    }
}

await browser.close();
server.close();
writeFileSync(path.join(out, "summary.json"), JSON.stringify({summary, perf}, null, 2));
log("wrote", out);
