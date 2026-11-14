#!/usr/bin/env node
/**
 * The Ark runtime's load and memory numbers (docs/ark/runtime.md): builds `src/ark-scene/runtime/measure-entry.ts`
 * into `.ark-golden/runtime/` (gitignored), serves it with the scene's art on 127.0.0.1, and opens it in
 * Playwright's cached Chromium (playwright-core, already a dev dependency) on the golden-shot devices:
 *
 *   desktop  1440×900, DPR 1, the host GPU
 *   phone    360×800, DPR 2, touch + Android UA, 8 cores / 4 GB reported (the tier logic picks medium), 4× CPU throttle
 *
 * Per run: the time to the first frame, how long mountArk held the main thread, the long tasks (> 50 ms) and the
 * longest, when the models in view were in, the JS heap, the scene's GPU estimate and the model counts over time.
 *
 *   node scripts/ark-runtime-measure.mjs --label before [--devices desktop,phone] [--runs 3] [--seconds 20]
 *        [--network 4g|none] [--quality auto|high|medium|low] [--gpu metal|swiftshader] [--headed] [--profile]
 *        [--walk] (the camera flies animal to animal) [--budget <MB>] (a small skin ceiling, to watch the drops)
 *        [--population 1x|3x] (a scale fixture) or [--population-file <path>] (any snapshot file, read where it is on
 *        every request and never copied: a local snapshot of the real Ark, real usernames and all)
 *
 * The models come from the public model bucket (read only), as on the site; `--network 4g` throttles them to a
 * mid 4G link (9 Mbit/s down, 60 ms) through the DevTools protocol.
 *
 * Part C: `--islands` mounts both islands on the live default wild island (v2, `ARK_LIVE_WILD_ISLAND`) unless `--world v1`;
 * `--world v2` alone the bigger wild island by itself (`world.ts` reads the world before anything builds:
 * `runtime/measure-world.ts`). Every row says which world it measured (`world`).
 *
 * Decision 292's heap budget: `--gc-points` forces a collection (DevTools `HeapProfiler.collectGarbage`, twice) at the
 * first frame and in steady play (`--gc-steady <s>` from the navigation, default 80) and reports the JS heap just before
 * and after each (`gc`). Each forced collection is a long frame in the frame numbers. `--production` builds the page as
 * the site's production build (no `__arkDebug`: no scene memory estimate, no library counts).
 *
 * Part B (docs/ark/streaming.md): `--render <m>` / `--render-scale <share>` set the render distance; `--tour` takes
 * the camera down into each region and back; `--mem <GB>` is the app's memory figure; `--models-dir <dir>` serves a
 * local model set (the far-model pack, the far-ark files: scripts/ark-model-pack.mjs) at /models/ after
 * `--latency <ms>` (default 180, the bucket's measured time to first byte); `--serve <port>` serves the page on
 * the loopback for a WebView (the iOS Simulator, an Android emulator) without a browser of its own: the page posts its
 * result to /report and it is written to the output folder (open `/measure.html?…&report=/report&label=<name>`).
 *
 * Mobile performance lane (docs/ark/perf-audit-mobile-2026-11.md):
 *   --devices phone-low       a low phone: 360×800 at DPR 2, 6× CPU throttle, 4 cores / 3 GB reported (the low tier)
 *   --throttle <n>            the CPU throttle for every device in the run (default: the device's own)
 *   --interact                a reader touching the world throughout (a pointer move every 200 ms: the full frame rate,
 *                             the idle drift still turning the view) instead of an untouched page (30 fps after 5 s)
 *   --page embed|hero         `/ark/embed.html` (the apps' panel, the archipelago mount with its workers; the bundle is
 *                             built first) or the home page's hero (the embed in an iframe the hero's size, its
 *                             refresh=600&idle=900) instead of the measurement page; with `--population-file` as the snapshot
 *   --perf                    `?perf=1`: the scene's own frame profiler (runtime/perf.ts), its sections in the report
 *   --network slow4g          Lighthouse's slow 4G (1.6 Mbit/s, 150 ms); text is served gzipped as the site's CDN does
 *                             (`--raw`: as is)
 * Town performance lane (docs/ark/town-draws-2026-11.md), the embed or the hero only:
 *   --view town               open on the town (the archipelago's `openOn`, as a reader whose animals live there): its
 *                             island view, every town chunk drawn in full
 *   --view town-close         and once the town has joined (+10 s), a close-up of one of its animals (`--select <id>`,
 *                             the host's `ark:select` with closeUp), followed
 * Interaction scenarios (the graphics and performance pass, scripts/ark-runtime-scenarios.mjs), the embed or the hero only:
 *   --scenario zoom|arrive|pan|select|hide|resize|weather|long
 *                             a reader using the world, after the town has joined and `--settle <s>` (default 25) more:
 *                             each action leaves a mark, and each phase's frames are reported with what the page asked of
 *                             the GPU meanwhile (programs linked and the wait on them, texture and buffer uploads, render
 *                             targets made); `--animals <n>` (default 12) species to visit; `long` runs `--seconds`;
 *                             `--shots` saves the picture at each stop (not for timing: a screenshot is a hitch)
 * Every page: each drawn frame's main-thread time and interval (requestAnimationFrame wrapped before the page's own
 * script), the heap's growth between frames (allocation per second), and the bytes received before the first frame.
 */

import {createServer} from "node:http";
import {existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync} from "node:fs";
import os from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {build} from "esbuild";
import {gzipSync} from "node:zlib";
import {createHash} from "node:crypto";
import {analysePhases, GL_KEYS, groupPhases, pickAnimals, SCENARIOS, scenarioInit, scenarioTable, scenarioTools} from "./ark-runtime-scenarios.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name, fallback) => {
    const at = process.argv.indexOf(`--${name}`);
    return at > 0 && process.argv[at + 1] && !process.argv[at + 1].startsWith("--") ? process.argv[at + 1] : fallback;
};
const flag = (name) => process.argv.includes(`--${name}`);
const log = (...parts) => console.log(new Date().toISOString().slice(11, 19), ...parts);

const DEVICES = {
    desktop: {viewport: {width: 1440, height: 900}, deviceScaleFactor: 1, isMobile: false, hasTouch: false, cpuThrottle: 1},
    phone: {
        viewport: {width: 360, height: 800},
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        cpuThrottle: 4,
        userAgent: "Mozilla/5.0 (Linux; Android 14; SM-A356B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36",
        cores: 8,
        memoryGB: 4
    },
    // A low phone (a 3 GB Android, an older iPhone's class of CPU): the low tier from its memory, 6× throttle.
    "phone-low": {
        viewport: {width: 360, height: 800},
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        cpuThrottle: 6,
        userAgent: "Mozilla/5.0 (Linux; Android 13; SM-A145F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36",
        cores: 4,
        memoryGB: 3
    }
};
const NETWORKS = {
    none: null,
    "4g": {offline: false, latency: 60, downloadThroughput: (9 * 1024 * 1024) / 8, uploadThroughput: (3 * 1024 * 1024) / 8},
    // Slow 4G (Lighthouse's mobile throttle): 1.6 Mbit/s down, 750 kbit/s up, 150 ms round trip.
    slow4g: {offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8}
};

const label = arg("label", "run");
const out = path.resolve(arg("out", path.join(root, ".ark-golden", "runtime", label)));
const devices = arg("devices", "desktop,phone").split(",").filter((name) => DEVICES[name]);
const runs = Number(arg("runs", "3"));
const seconds = Number(arg("seconds", "20"));
const network = NETWORKS[arg("network", "none")] ?? null;
const quality = arg("quality", "auto");
const gpu = arg("gpu", "metal");

const buildEnv = flag("production") ? "production" : "development";
const throttle = Number(arg("throttle", "0"));
const interact = flag("interact");
const pageKind = arg("page", "measure");
const perfOn = flag("perf");
const gcPoints = flag("gc-points");
const gcSteadyMs = Number(arg("gc-steady", "80")) * 1000;
const view = arg("view", "default");
const scenario = arg("scenario", "");
if (scenario && !SCENARIOS[scenario]) throw new Error(`--scenario ${scenario}: one of ${Object.keys(SCENARIOS).join(", ")}`);
if (scenario && pageKind === "measure") throw new Error("--scenario needs --page embed or --page hero");
const settleMs = Number(arg("settle", "25")) * 1000;
const selectId = arg("select", "");
if (view === "town-close" && !selectId) throw new Error("--view town-close needs --select <animal id>");

const site = path.join(root, ".ark-golden", "runtime-site");
mkdirSync(site, {recursive: true});
mkdirSync(out, {recursive: true});
await build({
    entryPoints: [path.join(root, "src/ark-scene/runtime/measure-entry.ts")],
    outfile: path.join(site, "measure.js"),
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["es2020"],
    // --profile: names kept, so the CPU profile reads.
    minify: !flag("profile"),
    tsconfig: path.join(root, "tsconfig.json"),
    // Development: the scene exposes __arkDebug (its three.js scene), which the memory estimate walks (`--production`:
    // the site's build, as decision 292's heap budget is judged).
    define: {"process.env.NODE_ENV": JSON.stringify(buildEnv)},
    logLevel: "warning"
});
// The prebuild worker (`--prebuild`), and the scale populations (`--population 1x`, from scripts/ark-scale-fixture.mts).
for (const [entry, out] of [["prebuild-worker.ts", "ark-prebuild-worker.js"], ["prebuild-places-worker.ts", "ark-prebuild-places-worker.js"]]) {
    await build({entryPoints: [path.join(root, "src/ark-scene/runtime", entry)], outfile: path.join(site, out), bundle: true, format: "iife", platform: "browser", target: ["es2020"], minify: true, tsconfig: path.join(root, "tsconfig.json"), define: {"process.env.NODE_ENV": JSON.stringify(buildEnv)}, logLevel: "warning"});
}
for (const scale of ["1x", "3x"]) {
    const from = path.join(root, ".ark-golden", "site", `population-${scale}.json`);
    if (existsSync(from)) writeFileSync(path.join(site, `population-${scale}.json`), readFileSync(from));
}
writeFileSync(path.join(site, "measure.html"), `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover">
<title>Ark runtime</title>
<style>html,body{margin:0;height:100%;background:#ecdcc4;overflow:hidden}#ark{position:fixed;inset:0}</style>
</head><body><div id="ark"></div><script src="./measure.js"></script></body></html>
`);

// `--page embed|hero`: the apps' bundle and workers into public/ark/ (gitignored), as the site's build makes them.
if (pageKind !== "measure") {
    const {execFileSync} = await import("node:child_process");
    execFileSync(process.execPath, [path.join(root, "scripts/build-ark-bundle.mjs"), ...(buildEnv === "production" ? [] : ["--dev"]), ...(flag("profile") || flag("names") ? ["--names"] : [])], {stdio: "inherit"});
    // The home page's hero (home-ark-hero.tsx): the embed in a frame the hero's size (the viewport less the 4rem header).
    writeFileSync(path.join(site, "hero.html"), `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ark hero</title>
<style>html,body{margin:0;background:#0b1d2e}header{height:64px}section{position:relative;height:calc(100svh - 64px);max-height:60rem;min-height:34rem}iframe{position:absolute;inset:0;width:100%;height:100%;border:0}</style>
</head><body><header></header><section><iframe id="hero" title="Ark"></iframe></section>
<div style="height:200vh"></div>
<script>document.getElementById("hero").src = "/ark/embed.html" + location.search;</script></body></html>
`);
}

const populationFile = arg("population-file", "");
if (populationFile && !existsSync(populationFile)) throw new Error(`--population-file ${populationFile}: no such file`);
// `--cdn-sim <dir>`: the model bucket through a local cache on disk, served `public, max-age=31536000, immutable` after
// a CDN edge's ~25 ms: what the model files cost once the bucket's cache headers are fixed (a warm-up run fills the disk).
const cdnDir = arg("cdn-sim", "");
const BUCKET = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public";
async function cdn(request, response, pathname) {
    const rel = pathname.replace(/^\/cdn\//, "");
    const file = path.join(cdnDir, rel);
    if (!file.startsWith(cdnDir)) return response.writeHead(404).end();
    if (!existsSync(file)) {
        const upstream = await fetch(`${BUCKET}/${rel}`);
        if (!upstream.ok) return response.writeHead(upstream.status).end();
        mkdirSync(path.dirname(file), {recursive: true});
        writeFileSync(file, Buffer.from(await upstream.arrayBuffer()));
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
    response.writeHead(200, {"Content-Type": "application/octet-stream", "Cache-Control": rel.endsWith("manifest.json") ? "public, max-age=60" : "public, max-age=31536000, immutable", "Access-Control-Allow-Origin": "*"}).end(readFileSync(file));
}
const modelsDir = arg("models-dir", "") ? path.resolve(arg("models-dir", "")) : "";
const latency = Number(arg("latency", "180"));
const reports = [];
/** The snapshot file's reads: answered whole, or 304 (unchanged). */
const reads = {full: 0, notModified: 0};
const server = createServer((request, response) => {
    if (request.method === "POST" && request.url.startsWith("/report")) {
        const chunks = [];
        request.on("data", (chunk) => chunks.push(chunk));
        request.on("end", () => {
            try {
                const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
                const name = `${(body.label || "webview").replace(/[^a-z0-9_.-]/gi, "_")}-${Date.now()}.json`;
                writeFileSync(path.join(out, name), JSON.stringify(body, null, 2));
                reports.push(name);
                log("report", name, body.result ? `heap ${body.result.peakHeapMB} MB peak, GPU ${body.result.peakGpuMB} MB peak, ${body.result.frameRate?.fps} fps, in view ${body.result.inViewMs} ms, mount ${body.result.mountMs} ms, tier ${body.result.stats?.tier}` : body.error);
            } catch (error) {
                log("bad report", String(error));
            }
            response.writeHead(204, {"Access-Control-Allow-Origin": "*"}).end();
        });
        return;
    }
    if (modelsDir && request.url.startsWith("/models/")) {
        const rel = decodeURIComponent(new URL(request.url, "http://localhost").pathname.replace(/^\/models\//, ""));
        const file = path.join(modelsDir, rel);
        if (!file.startsWith(modelsDir) || !existsSync(file)) return response.writeHead(404, {"Access-Control-Allow-Origin": "*"}).end();
        setTimeout(() => {
            response.writeHead(200, {"Content-Type": file.endsWith(".json") ? "application/json" : "application/octet-stream", "Cache-Control": rel.endsWith("manifest.json") ? "no-store" : flag("repeat") ? "public, max-age=31536000, immutable" : "no-store", "Access-Control-Allow-Origin": "*"}).end(readFileSync(file));
        }, latency);
        return;
    }
    if (cdnDir && request.url.startsWith("/cdn/")) {
        void cdn(request, response, new URL(request.url, "http://localhost").pathname).catch(() => response.writeHead(502).end());
        return;
    }
    const url = new URL(request.url, "http://localhost");
    if (populationFile && url.pathname === "/population-file.json") {
        // (Compressed as the site's CDN serves the read: `/api/ark/voyage` goes out brotli'd, gzip here. With a validator
        // as the anonymous voyage read has one: an unchanged file answers 304, counted in `reads`.)
        const body = readFileSync(populationFile);
        const tag = `W/"pop-${createHash("sha1").update(body).digest("base64url")}"`;
        if (String(request.headers["if-none-match"] ?? "").split(",").some((t) => t.trim().replace(/^W\//, "") === tag.replace(/^W\//, ""))) {
            reads.notModified++;
            response.writeHead(304, {ETag: tag, "Cache-Control": "public, s-maxage=30"}).end();
            return;
        }
        reads.full++;
        sendText(request, response, body, "application/json", {ETag: tag, "Cache-Control": "public, s-maxage=30"});
        return;
    }
    const fromPublic = url.pathname.startsWith("/ark/");
    const folder = fromPublic ? path.join(root, "public") : site;
    const file = path.join(folder, path.normalize(url.pathname).replace(/^\/+/, "") || "measure.html");
    if (!file.startsWith(folder) || !existsSync(file)) {
        response.writeHead(404).end();
        return;
    }
    const type = file.endsWith(".html") ? "text/html" : file.endsWith(".js") ? "text/javascript" : file.endsWith(".webp") ? "image/webp" : file.endsWith(".json") ? "application/json" : "application/octet-stream";
    if (/^(text\/|application\/json)/.test(type)) return sendText(request, response, readFileSync(file), type);
    response.writeHead(200, {"Content-Type": type, "Cache-Control": "no-store"}).end(readFileSync(file));
});

/**
 * Text (the bundle, the workers, the page, the read) gzipped when the browser asks, as the site's CDN does (Cloudflare:
 * gzip for the scripts, brotli for the API's JSON), so the bytes over the throttled link are the site's; `--raw` sends
 * them as they are. Compressed once per file and kept.
 */
const gzipped = new Map();
function sendText(request, response, body, type, headers = {"Cache-Control": "no-store"}) {
    if (flag("raw") || !/\bgzip\b/.test(String(request.headers["accept-encoding"] ?? ""))) {
        response.writeHead(200, {"Content-Type": type, ...headers}).end(body);
        return;
    }
    const key = `${type}:${body.length}:${body.subarray(0, 64).toString("base64")}`;
    let zipped = gzipped.get(key);
    if (!zipped) gzipped.set(key, (zipped = gzipSync(body, {level: 6})));
    response.writeHead(200, {"Content-Type": type, "Content-Encoding": "gzip", "Vary": "Accept-Encoding", ...headers}).end(zipped);
}
const servePort = Number(arg("serve", "0"));
// (Loopback only, also for the WebViews: the iOS Simulator shares the Mac's loopback, and an Android emulator reaches
// it as 10.0.2.2.)
await new Promise((resolve) => server.listen(servePort, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
if (servePort) {
    // WebView mode: no browser here; the page posts its result to /report. Runs until stopped.
    log(`serving ${base}/measure.html (an Android emulator: http://10.0.2.2:${servePort}/measure.html); reports to ${out}`);
    await new Promise(() => undefined);
}

function cachedChromium() {
    const cache = path.join(os.homedir(), "Library", "Caches", "ms-playwright");
    if (!existsSync(cache)) return null;
    for (const name of readdirSync(cache).filter((entry) => /^chromium-\d+$/.test(entry)).sort().reverse()) {
        const candidate = path.join(cache, name, "chrome-mac-arm64", "Google Chrome for Testing.app", "Contents", "MacOS", "Google Chrome for Testing");
        if (existsSync(candidate)) return candidate;
    }
    return null;
}

const {chromium} = await import("playwright-core");
const gpuArgs = gpu === "swiftshader"
    ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--use-gl=angle"]
    : ["--enable-gpu", "--ignore-gpu-blocklist", ...(process.platform === "darwin" ? ["--use-angle=metal"] : [])];
const browser = await chromium.launch({
    executablePath: process.env.ARK_CHROMIUM || cachedChromium() || undefined,
    headless: !flag("headed"),
    args: [...(flag("headed") ? [] : ["--headless=new"]), ...gpuArgs, "--enable-precise-memory-info", "--disable-background-timer-throttling", "--disable-renderer-backgrounding"]
});

/**
 * Decision 292's reading: the JS heap (`performance.memory`, precise) just before and after a forced full collection
 * (twice: what one leaves for finalizers), seconds from the navigation. A phone cannot collect what is still held, so
 * the budget is judged on `afterGcMB`.
 */
const heapMBOf = async (page) => Math.round(((await page.evaluate(() => performance.memory?.usedJSHeapSize ?? 0)) / 2 ** 20) * 10) / 10;
async function forcedGc(page, cdp, since) {
    const t = Math.round((Date.now() - since) / 100) / 10;
    const beforeGcMB = await heapMBOf(page);
    await cdp.send("HeapProfiler.collectGarbage");
    await cdp.send("HeapProfiler.collectGarbage");
    const afterGcMB = await heapMBOf(page);
    return {t, beforeGcMB, afterGcMB};
}

const results = [];
for (const deviceName of devices) {
    const device = DEVICES[deviceName];
    for (let run = 0; run < runs; run++) {
        // A fresh context each run: nothing cached (as a first visit).
        const context = await browser.newContext({viewport: device.viewport, deviceScaleFactor: device.deviceScaleFactor, isMobile: device.isMobile, hasTouch: device.hasTouch, userAgent: device.userAgent});
        if (scenario) await context.addInitScript(scenarioInit);
        await context.addInitScript(() => {
            const tasks = [];
            window.__arkLongTasks = tasks;
            try {
                new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) tasks.push({start: Math.round(entry.startTime), ms: Math.round(entry.duration)});
                }).observe({type: "longtask", buffered: true});
            } catch {
                // No long-task timing here.
            }
            const frames = [];
            window.__arkLongFrames = frames;
            try {
                new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        const scripts = (entry.scripts ?? []).map((script) => ({ms: Math.round(script.duration), what: `${script.invokerType ?? ""} ${script.invoker ?? ""} ${script.sourceFunctionName ?? ""}`.trim().slice(0, 120)})).sort((a, b) => b.ms - a.ms).slice(0, 3);
                        if (frames.length < 4000) frames.push({start: Math.round(entry.startTime), ms: Math.round(entry.duration), blocking: Math.round(entry.blockingDuration ?? 0), scripts});
                    }
                }).observe({type: "long-animation-frame", buffered: true});
            } catch {
                // No long-animation-frame timing here.
            }
        });
        if (device.cores) {
            await context.addInitScript(([cores, memoryGB]) => {
                Object.defineProperty(navigator, "hardwareConcurrency", {get: () => cores});
                Object.defineProperty(navigator, "deviceMemory", {get: () => memoryGB});
            }, [device.cores, device.memoryGB]);
        }
        // Every page and frame: each display frame's requestAnimationFrame work (the scene's frame is one callback),
        // the heap at its end; the host messages an app would get (`ark:ready`, `ark:tier`) through `AndroidArk`; and,
        // with `interact=1` in the URL, a pointer move on the world every 200 ms (the runtime's input: the full rate).
        await context.addInitScript(() => {
            const MAX = window.__arkGl ? 120000 : 40000;
            const rec = {n: 0, t: new Float64Array(MAX), cpu: new Float64Array(MAX), heap: new Float64Array(MAX), ready: 0, tier: null, progress: 0, gl: null};
            window.__arkRec = rec;
            // (`--scenario`: the GL counters' running totals at each frame's end.)
            const glNow = window.__arkGl ?? null;
            const glKeys = glNow ? Object.keys(glNow) : [];
            if (glNow) rec.gl = Object.fromEntries(glKeys.map((key) => [key, new Float64Array(MAX)]));
            const native = window.requestAnimationFrame.bind(window);
            let frameTs = -1;
            window.requestAnimationFrame = (callback) => native((ts) => {
                const s = performance.now();
                try {
                    callback(ts);
                } finally {
                    const d = performance.now() - s;
                    if (ts !== frameTs) {
                        frameTs = ts;
                        if (rec.n < MAX) {
                            rec.t[rec.n] = ts;
                            rec.cpu[rec.n] = 0;
                            rec.n++;
                        }
                    }
                    if (rec.n && rec.n <= MAX) {
                        rec.cpu[rec.n - 1] += d;
                        rec.heap[rec.n - 1] = performance.memory?.usedJSHeapSize ?? 0;
                        if (glNow) for (let k = 0; k < glKeys.length; k++) rec.gl[glKeys[k]][rec.n - 1] = glNow[glKeys[k]];
                    }
                }
            });
            window.AndroidArk = {postMessage: (text) => {
                try {
                    const message = JSON.parse(text);
                    if (message.type === "ark:ready" && !rec.ready) rec.ready = performance.now();
                    if (message.type === "ark:progress" && !rec.progress) rec.progress = performance.now();
                    if (message.type === "ark:tier") {
                        rec.tier = message.tier;
                        (rec.tiers ??= []).push({t: Math.round(performance.now()), tier: message.tier, lite: message.lite});
                    }
                } catch {
                    // Not ours.
                }
            }};
            if (/[?&]interact=1/.test(location.search)) {
                setInterval(() => {
                    const canvas = document.querySelector("canvas");
                    canvas?.dispatchEvent(new PointerEvent("pointermove", {bubbles: true, clientX: 100, clientY: 100, pointerType: "touch"}));
                }, 200);
            }
        });
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", (error) => errors.push(String(error)));
        page.on("console", (message) => {
            if (message.type() === "error") errors.push(message.text());
        });
        const cdp = await context.newCDPSession(page);
        const cpuThrottle = throttle > 0 ? throttle : device.cpuThrottle;
        if (cpuThrottle > 1) await cdp.send("Emulation.setCPUThrottlingRate", {rate: cpuThrottle});
        // The bytes received, as each response finishes (node's clock), for the bytes before the first frame.
        const received = [];
        const urls = new Map();
        const started = new Map();
        /** Every chunk of every response as it arrives (node's clock): the bytes over the link before the first frame, in flight too. */
        const chunks = [];
        await cdp.send("Network.enable");
        cdp.on("Network.requestWillBeSent", (event) => {
            urls.set(event.requestId, event.request?.url ?? "");
            started.set(event.requestId, Date.now());
        });
        cdp.on("Network.responseReceived", (event) => urls.set(event.requestId, event.response?.url ?? urls.get(event.requestId) ?? ""));
        cdp.on("Network.dataReceived", (event) => chunks.push({at: Date.now(), bytes: event.encodedDataLength ?? 0, url: urls.get(event.requestId) ?? ""}));
        cdp.on("Network.loadingFinished", (event) => received.push({at: Date.now(), bytes: event.encodedDataLength ?? 0, url: urls.get(event.requestId) ?? "", start: started.get(event.requestId) ?? null}));
        if (network) await cdp.send("Network.emulateNetworkConditions", network);
        if (flag("profile")) {
            await cdp.send("Profiler.enable");
            await cdp.send("Profiler.setSamplingInterval", {interval: 500});
            await cdp.send("Profiler.start");
        }
        const extra = `${arg("render", "") ? `&render=${arg("render", "")}` : ""}${arg("render-scale", "") ? `&renderScale=${arg("render-scale", "")}` : ""}${flag("tour") ? "&tour=1" : ""}${arg("focus", "") ? `&focus=${arg("focus", "")}` : ""}${flag("islands") ? "&islands=1" : ""}${arg("world", "") ? `&world=${arg("world", "")}` : ""}${arg("pan", "") ? `&pan=${arg("pan", "")}` : ""}${arg("mem", "") ? `&mem=${arg("mem", "")}` : ""}${arg("budget", "") ? `&budget=${arg("budget", "")}` : ""}${flag("walk") ? "&walk=1" : ""}${flag("prebuild") ? "&prebuild=1" : ""}${populationFile ? "&population=population-file.json" : arg("population", "") ? `&population=population-${arg("population", "")}.json` : ""}`;
        const modelsParam = modelsDir ? `&models=${encodeURIComponent(`${base}/models`)}` : cdnDir ? `&models=${encodeURIComponent(`${base}/cdn/talking-models/v1/ark`)}` : "";
        let navigated = Date.now();
        const lane = `${interact ? "&interact=1" : ""}${perfOn ? "&perf=1" : ""}`;
        if (pageKind === "measure") {
            await page.goto(`${base}/measure.html?seconds=${seconds}${quality === "auto" ? "" : `&quality=${quality}`}${extra}${modelsParam}${lane}`, {waitUntil: "commit", timeout: 120_000});
        } else {
            // The embed (the apps' panel) or the hero: the snapshot file as the API's answer; the tier pinned with --quality
            // (the embed reads `__arkQuality` as the measurement page does: set before its script runs).
            if (quality !== "auto") await context.addInitScript((q) => { window.__arkQuality = q; }, quality);
            // `--view town`: the archipelago opens on the town (its `openOn`), as for a reader whose animals live there.
            if (scenario && (view === "town" || view === "town-close")) await context.addInitScript(() => { window.__arkOpenOn = "town"; });
            else if (view === "town" || view === "town-close") {
                await context.addInitScript(() => {
                    let ark;
                    Object.defineProperty(window, "AnimalDexArk", {configurable: true, get: () => ark, set: (value) => {
                        const mount = value.mountArchipelago;
                        if (mount) value.mountArchipelago = (el, options) => mount(el, {...options, openOn: "town"});
                        ark = value;
                    }});
                });
            }
            const query = `snapshot=${encodeURIComponent(populationFile ? "/population-file.json" : "/ark-missing.json")}${pageKind === "hero" ? "&refresh=600&idle=900" : ""}${modelsDir ? `&models=${encodeURIComponent(`${base}/models`)}` : ""}${lane}`;
            await page.goto(`${base}/${pageKind === "hero" ? "hero.html" : "ark/embed.html"}?${query}`, {waitUntil: "commit", timeout: 120_000});
        }
        // The Mac running this is busy with other work: its CPU pressure is not the device's (the browser's Compute
        // Pressure reading would cap the rate and ask for the low tier). The host's word wins, as an app's would:
        // calm power unless `--power saver|serious|critical|browser`.
        if (pageKind !== "measure" && arg("power", "") !== "browser") {
            const power = arg("power", "");
            const message = {type: "ark:power", saver: power === "saver", thermal: power === "serious" || power === "critical" ? power : "nominal", battery: 1, charging: true};
            const told = async () => {
                for (let i = 0; i < 400; i++) {
                    const frames = page.frames().filter((f) => pageKind !== "hero" || f.url().includes("/ark/embed.html"));
                    for (const f of frames) if (await f.evaluate((m) => (window.AnimalDexArkHost ? (window.AnimalDexArkHost.send(m), true) : false), message).catch(() => false)) return;
                    await page.waitForTimeout(50);
                }
            };
            await told();
        }
        /** The frame the scene runs in (the hero's iframe). */
        const sceneFrame = async () => (pageKind === "hero" ? page.frames().find((f) => f.url().includes("/ark/embed.html")) ?? page.mainFrame() : page.mainFrame());
        // `--repeat`: this load only primes the page's caches; the measured one is a second visit in the same browser.
        if (flag("repeat")) {
            await page.waitForFunction(() => window.__arkMeasure?.done, null, {timeout: (seconds + 120) * 1000, polling: 500});
            navigated = Date.now();
            await page.reload({waitUntil: "commit", timeout: 120_000});
        }
        // `--gc-points`: the first frame (the page notes it when the scene first drew, after the prebuild), then steady play.
        let gc = null;
        if (pageKind !== "measure") {
            // No measurement page: the first frame is the embed's `ark:ready`; then `seconds` of play.
            const deadline = Date.now() + 240_000;
            let readyAt = 0;
            while (!readyAt && Date.now() < deadline) {
                await page.waitForTimeout(250);
                readyAt = await (await sceneFrame()).evaluate(() => window.__arkRec?.ready ?? 0).catch(() => 0);
            }
            if (!readyAt) throw new Error(`${pageKind}: no ark:ready in 240 s`);
            // `--view town-close`: once the town has joined (and 10 s more), the host selects one of its animals, close up.
            if (view === "town-close") {
                const frame = await sceneFrame();
                await frame.waitForFunction(() => performance.getEntriesByName("ark:town:joined").length > 0, null, {timeout: 240_000, polling: 500}).catch(() => log("the town did not join in 240 s"));
                await page.waitForTimeout(10_000);
                await frame.evaluate((id) => window.postMessage({type: "ark:select", id, closeUp: true}, "*"), selectId);
                log(`selected ${selectId} (close up) at ${Math.round((Date.now() - navigated) / 1000)} s`);
            }
        }
        if (gcPoints) {
            await cdp.send("HeapProfiler.enable");
            if (pageKind === "measure") await page.waitForFunction(() => Boolean(window.__arkMeasure?.firstFrameAt || window.__arkMeasure?.done), null, {timeout: 180_000, polling: 100});
            const firstFrame = await forcedGc(page, cdp, navigated);
            const wait = gcSteadyMs - (Date.now() - navigated);
            if (wait > 0) await page.waitForTimeout(wait);
            gc = {firstFrame, steady: await forcedGc(page, cdp, navigated)};
            log(deviceName, `run ${run}: forced GC at the first frame (${firstFrame.t} s) ${firstFrame.beforeGcMB} -> ${firstFrame.afterGcMB} MB, in steady play (${gc.steady.t} s) ${gc.steady.beforeGcMB} -> ${gc.steady.afterGcMB} MB`);
        }
        // The scene's own profiler (`--perf`): its rolling report every 5 s from 20 s after the first frame, averaged.
        const perfReports = [];
        const frame = await sceneFrame();
        const pollPerf = async () => {
            if (!perfOn) return;
            const report = await frame.evaluate(() => window.__arkPerfReport?.() ?? null).catch(() => null);
            if (report) perfReports.push({...report, at: Date.now() - navigated});
        };
        let measured;
        let scenarioExtra = null;
        const scenarioTimeline = [];
        if (pageKind === "measure") {
            const until = Date.now() + (seconds + 120) * 1000;
            while (!(await page.evaluate(() => window.__arkMeasure?.done)) && Date.now() < until) {
                await page.waitForTimeout(5000);
                const firstAt = await page.evaluate(() => window.__arkMeasure?.firstFrameAt ?? 0);
                if (firstAt) await pollPerf();
            }
            measured = await page.evaluate(() => window.__arkMeasure);
        } else {
            const readyAt = await frame.evaluate(() => window.__arkRec.ready);
            if (scenario) {
                // The world as a reader meets it a little after opening it: the town joined, the first view's models in.
                const snapshotBody = populationFile ? JSON.parse(readFileSync(populationFile, "utf8")) : null;
                const animals = pickAnimals(snapshotBody?.snapshot ?? snapshotBody, Number(arg("animals", "12")));
                // Once a second: the scene's counts (programs, textures, geometries alive), the heap, the tier and scale.
                const poller = setInterval(() => {
                    void frame.evaluate(() => {
                        const r = window.__arkPerfReport?.() ?? null;
                        const live = window.__arkLive ?? null;
                        let scene = null;
                        try {
                            const st = window.__arkHandle?.stats?.();
                            const rt = window.__arkHandle?.runtime?.();
                            if (st) scene = {renderScale: st.streaming?.renderScale ?? null, renderDistance: st.streaming?.renderDistance ?? null, memory: st.streaming?.memory ?? null, chunks: st.streaming?.chunks ?? null, models: st.modelsLoaded, near: st.near, far: st.far, placeholders: st.placeholders, rigs: st.rigsLoaded, rigMB: Math.round((st.rigBytes ?? 0) / 2 ** 20), closeUps: st.closeUpSkins, fur: st.furShells, modelTexMB: rt?.modelTextureMB ?? null, evicted: rt?.evicted ?? null, farSkins: rt?.farSkins ?? null, pending: rt?.pending ?? null, shaders: rt?.shaders ?? null, power: rt?.powerTier ?? null, hold: rt?.shaderHold ?? null, display: rt?.display ?? null, tripsHeld: st.tripsHeld ?? null};
                        } catch {
                            // No handle (a build without the mount hook).
                        }
                        return {scene, at: Math.round(performance.now()), heapMB: Math.round((performance.memory?.usedJSHeapSize ?? 0) / 2 ** 20), fps: r?.fps ?? null, cpu: r?.cpu.mean ?? null, gpu: r?.gpu ?? null, tier: r?.tier ?? null, dpr: r?.dpr ?? null, scale: r?.scale ?? null, mode: r?.mode ?? null, drawn: r?.drawn ?? null, rigged: r?.rigged ?? null, sections: r?.sections ?? null, live: live ? {...live} : null};
                    }).then((sample) => scenarioTimeline.push(sample)).catch(() => undefined);
                }, 1000);
                await frame.waitForFunction(() => performance.getEntriesByName("ark:town:joined").length > 0, null, {timeout: 240_000, polling: 500}).catch(() => log("the town did not join in 240 s"));
                await page.waitForTimeout(settleMs);
                const tools = scenarioTools({page, frame, cdp, device, offset: pageKind === "hero" ? {x: 0, y: 64} : {x: 0, y: 0}, log});
                const gcAt = [];
                const startedScenario = Date.now();
                log(deviceName, `run ${run}: scenario ${scenario} from ${Math.round((Date.now() - navigated) / 1000)} s, ${animals.length} animals`);
                try {
                    const shot = flag("shots") ? async (name) => {
                        await page.screenshot({path: path.join(out, `${deviceName}-${run}-${name}.png`)}).catch(() => undefined);
                    } : null;
                    scenarioExtra = await SCENARIOS[scenario](tools, {page, frame, cdp, device, animals, seconds, shot, gc: gcPoints || scenario === "long" ? async (name) => {
                        await cdp.send("HeapProfiler.enable").catch(() => undefined);
                        const reading = await forcedGc(page, cdp, navigated);
                        const memory = await frame.evaluate(() => window.__arkPerfReport?.()?.gpu ?? null).catch(() => null);
                        gcAt.push({name, ...reading, gpu: memory});
                        log(deviceName, `  ${name}: heap ${reading.beforeGcMB} -> ${reading.afterGcMB} MB after GC${memory ? `, programs ${memory.programs}, textures ${memory.textures}, geometries ${memory.geometries}` : ""}`);
                    } : null});
                } finally {
                    clearInterval(poller);
                }
                scenarioExtra = {...(scenarioExtra ?? {}), animals, gcAt, seconds: Math.round((Date.now() - startedScenario) / 1000)};
            } else {
                const end = navigated + readyAt + seconds * 1000;
                while (Date.now() < end) {
                    await page.waitForTimeout(5000);
                    await pollPerf();
                }
            }
            const stats = await frame.evaluate(() => window.__arkPerfReport?.() ?? null).catch(() => null);
            measured = {result: {firstFrameMs: readyAt, firstFrameFromNavigation: readyAt, mountMs: null, inViewMs: null, world: null, stats: {tier: await frame.evaluate(() => window.__arkRec.tier), modelsLoaded: null, drawCalls: stats?.gpu.calls ?? null, triangles: stats?.gpu.triangles ?? null}, memory: null, heapMB: stats?.heapMB ?? null}};
        }
        // Drawn frames: display frames whose callbacks took over 1 ms (a skipped frame returns at once), from 20 s after the
        // first frame (past the opening and the first models) to the end.
        const rec = await frame.evaluate(() => {
            const r = window.__arkRec;
            return {n: r.n, t: Array.from(r.t.subarray(0, r.n)), cpu: Array.from(r.cpu.subarray(0, r.n)), heap: Array.from(r.heap.subarray(0, r.n)), gl: r.gl ? Object.fromEntries(Object.entries(r.gl).map(([key, values]) => [key, Array.from(values.subarray(0, r.n))])) : null};
        });
        // `--scenario`: each phase's frames, grouped; the profiler's slow frames (which section a hitch was in).
        let scenarioReport = null;
        if (scenario && rec.gl) {
            const marks = await frame.evaluate(() => window.__arkMarks ?? []);
            const slow = await frame.evaluate(() => window.__arkPerfSlow?.() ?? []).catch(() => []);
            const phases = analysePhases(rec, marks, GL_KEYS);
            // (The slow frames of each phase, the costliest three, by section.)
            for (const [m, phase] of phases.entries()) {
                const mine = slow.filter((f) => f.at >= marks[m].t && f.at < marks[m + 1].t).sort((a, b) => b.ms - a.ms);
                phase.slow = mine.slice(0, 3);
                // (Every one over 60 ms, for the by-section totals.)
                phase.slowAll = mine.filter((f) => f.ms >= 60).slice(0, 80);
            }
            const groups = groupPhases(phases);
            // The programs linked from the scenario's start, with the state that made each variant and the wait on it.
            const from = marks[0]?.t ?? 0;
            const programs = (await frame.evaluate(() => (window.__arkPrograms ?? []).map((p) => ({t: Math.round(p.t), type: p.type, name: p.name, waitMs: Math.round(p.waitMs * 10) / 10, defs: p.defs}))).catch(() => [])).filter((p) => p.t >= from);
            const tiers = await frame.evaluate(() => window.__arkRec.tiers ?? []).catch(() => []);
            // The long animation frames inside the scenario (work outside the scene's own frame shows only here).
            const loaf = (await page.evaluate(() => window.__arkLongFrames ?? []).catch(() => [])).concat(pageKind === "hero" ? await frame.evaluate(() => window.__arkLongFrames ?? []).catch(() => []) : []).filter((f) => f.start >= from).sort((a, b) => b.ms - a.ms).slice(0, 60);
            const bigTextures = (await frame.evaluate(() => window.__arkBigTex ?? []).catch(() => [])).filter((u) => u.t >= from);
            scenarioReport = {name: scenario, groups, phases, slowFrames: slow.length, programs, tiers, loaf, bigTextures, extra: scenarioExtra, timeline: scenarioTimeline};
            writeFileSync(path.join(out, `scenario-${scenario}-${deviceName}-${run}.md`), `Scenario ${scenario}, ${deviceName} (${pageKind}, ${throttle > 0 ? throttle : device.cpuThrottle}x CPU, ${buildEnv} build), run ${run}.\n\n${scenarioTable(groups)}\n`);
            console.log(scenarioTable(groups));
        }
        const firstFrameAt = measured.result?.firstFrameFromNavigation ?? 0;
        // The page's first paint and first contentful paint, and when it first told its host it was showing (`ark:progress`).
        const paints = await frame.evaluate(() => Object.fromEntries(performance.getEntriesByType("paint").map((e) => [e.name, Math.round(e.startTime)]))).catch(() => ({}));
        const firstProgress = await frame.evaluate(() => Math.round(window.__arkRec?.progress ?? 0)).catch(() => 0);
        const steadyFrom = firstFrameAt + Number(arg("steady-from", "20")) * 1000;
        const drawnFrames = [];
        for (let i = 0; i < rec.n; i++) if (rec.t[i] >= steadyFrom && rec.cpu[i] > 1) drawnFrames.push(i);
        const intervals = [];
        let alloc = 0;
        let gcs = 0;
        for (let k = 1; k < drawnFrames.length; k++) {
            const a = drawnFrames[k - 1];
            const b = drawnFrames[k];
            intervals.push(rec.t[b] - rec.t[a]);
            const grew = rec.heap[b] - rec.heap[a];
            if (grew > 0) alloc += grew;
            else if (grew < -1024 * 1024) gcs++;
        }
        const steadySeconds = drawnFrames.length > 1 ? (rec.t[drawnFrames[drawnFrames.length - 1]] - rec.t[drawnFrames[0]]) / 1000 : 0;
        const q = (list, share) => {
            const sorted = [...list].sort((x, y) => x - y);
            return sorted.length ? Math.round(sorted[Math.min(sorted.length - 1, Math.floor(share * sorted.length))] * 10) / 10 : null;
        };
        const cpuList = drawnFrames.map((i) => rec.cpu[i]);
        const steady = {
            seconds: Math.round(steadySeconds),
            frames: drawnFrames.length,
            fps: steadySeconds ? Math.round((drawnFrames.length / steadySeconds) * 10) / 10 : null,
            interval: {p50: q(intervals, 0.5), p95: q(intervals, 0.95), p99: q(intervals, 0.99), over16: intervals.length ? Math.round((intervals.filter((v) => v > 17.7).length / intervals.length) * 1000) / 10 : null, over33: intervals.length ? Math.round((intervals.filter((v) => v > 34.4).length / intervals.length) * 1000) / 10 : null},
            cpu: {p50: q(cpuList, 0.5), p95: q(cpuList, 0.95), p99: q(cpuList, 0.99), mean: cpuList.length ? Math.round((cpuList.reduce((s, v) => s + v, 0) / cpuList.length) * 10) / 10 : null},
            allocMBps: steadySeconds ? Math.round((alloc / 2 ** 20 / steadySeconds) * 10) / 10 : null,
            gcDrops: gcs
        };
        const receivedBeforeFirst = received.filter((r) => r.at <= navigated + firstFrameAt);
        // (The page's own requests; a dedicated worker's script is the page's request too. In flight at the first frame:
        // what had arrived of it.)
        const wireBeforeFirst = chunks.filter((c) => c.at <= navigated + firstFrameAt).reduce((sum, c) => sum + c.bytes, 0);
        const requests = received.map((r) => ({url: r.url.replace(/^https?:\/\/[^/]+/, "").slice(0, 120), start: r.start ? r.start - navigated : null, end: r.at - navigated, kb: Math.round(r.bytes / 1024)})).sort((a, b) => (a.start ?? 0) - (b.start ?? 0));
        const bytesBeforeFirstFrame = receivedBeforeFirst.reduce((sum, r) => sum + r.bytes, 0);
        // What they were, by kind (the page's own files, the snapshot, the model pack and models, icons, the rest).
        const kindOf = (url) => (/\/ark\/[^/]*\.js(\?|$)/.test(url) ? `script ${url.split("/").pop().split("?")[0]}` : /population-file|voyage|snapshot/.test(url) ? "snapshot" : /pack/.test(url) ? "model pack" : /\.glb|\.ark\.json|talking-models/.test(url) ? "models" : /\.webp|\.png|\.jpg|\.ktx2|basis/.test(url) ? "images and textures" : /atlas/.test(url) ? "positions atlas" : "other");
        const bytesByKind = {};
        for (const r of receivedBeforeFirst) bytesByKind[kindOf(r.url)] = (bytesByKind[kindOf(r.url)] ?? 0) + r.bytes;
        // The profiler's sections and counts, averaged over its reports.
        const perfAvg = perfReports.length ? (() => {
            const sections = {};
            const late = perfReports.filter((r) => r.at >= steadyFrom);
            const used = late.length ? late : perfReports.slice(-1);
            for (const report of used) for (const [name, ms] of Object.entries(report.sections)) sections[name] = (sections[name] ?? 0) + ms / used.length;
            for (const name of Object.keys(sections)) sections[name] = Math.round(sections[name] * 100) / 100;
            const last = perfReports[perfReports.length - 1];
            const first = perfReports[0];
            return {reports: perfReports.length, inViewAt: last.inViewAt ?? null, timeline: perfReports.map((r) => ({at: r.at, fps: r.fps, cpu: r.cpu.mean, drawn: r.drawn, tier: r.tier, dpr: r.dpr, world: r.sections.world ?? 0, schedule: r.sections.schedule ?? 0, scenery: r.sections.scenery ?? 0, resting: r.sections.resting ?? 0, render: r.sections.render ?? 0, heapMB: r.heapMB})), sections, gpu: last.gpu, tier: last.tier, dpr: last.dpr, scale: last.scale, drawn: last.drawn, rigged: last.rigged, mode: last.mode, hudRendersPerSecond: perfReports.length > 1 ? Math.round(((last.hudRenders - first.hudRenders) / ((perfReports.length - 1) * 5)) * 10) / 10 : null};
        })() : null;
        if (flag("profile")) {
            const {profile} = await cdp.send("Profiler.stop");
            writeFileSync(path.join(out, `${deviceName}-${run}.cpuprofile`), JSON.stringify(profile));
            // Self time by function (and the call tree's total for the scene's own functions), the top 40.
            const byId = new Map(profile.nodes.map((node) => [node.id, node]));
            const self = new Map();
            const deltas = profile.timeDeltas;
            profile.samples.forEach((id, i) => {
                const node = byId.get(id);
                const key = `${node.callFrame.functionName || "(anonymous)"} ${node.callFrame.url.split("/").pop()}:${node.callFrame.lineNumber + 1}`;
                self.set(key, (self.get(key) ?? 0) + (deltas[i] ?? 0) / 1000);
            });
            const top = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([key, ms]) => `${Math.round(ms)} ms  ${key}`);
            writeFileSync(path.join(out, `${deviceName}-${run}-self.txt`), top.join("\n") + "\n");
        }
        if (measured.error) throw new Error(measured.error);
        const tasks = await page.evaluate(() => window.__arkLongTasks ?? []);
        const frames = await page.evaluate(() => window.__arkLongFrames ?? []);
        const metrics = Object.fromEntries((await cdp.send("Performance.getMetrics").catch(() => ({metrics: []}))).metrics?.map((m) => [m.name, m.value]) ?? []);
        const r = measured.result;
        const longest = tasks.reduce((max, task) => Math.max(max, task.ms), 0);
        const beforeFirst = tasks.filter((task) => r.firstFrameFromNavigation && task.start < r.firstFrameFromNavigation);
        const after = tasks.filter((task) => r.firstFrameFromNavigation && task.start >= r.firstFrameFromNavigation);
        const row = {
            device: deviceName,
            page: pageKind,
            view,
            throttle: cpuThrottle,
            interact,
            steady,
            perf: perfAvg,
            scenario: scenarioReport,
            bytesBeforeFirstFrame,
            bytesByKind,
            wireBeforeFirstFrame: wireBeforeFirst,
            paints,
            firstProgress,
            requests: requests.slice(0, 400),
            run,
            world: r.world ?? null,
            build: buildEnv,
            gpu,
            network: arg("network", "none"),
            firstFrameMs: r.firstFrameMs,
            firstFrameFromNavigation: r.firstFrameFromNavigation,
            mountMs: r.mountMs,
            inViewMs: r.inViewMs,
            inViewBy: r.inViewBy ?? null,
            gc,
            frameRate: r.frameRate ?? null,
            longestTaskMs: longest,
            longTasks: tasks.length,
            longTaskMsTotal: tasks.reduce((sum, task) => sum + task.ms, 0),
            longestAfterFirstFrameMs: after.reduce((max, task) => Math.max(max, task.ms), 0),
            longTasksAfterFirstFrame: after.length,
            longTasksBeforeFirstFrame: beforeFirst.length,
            heapMB: r.heapMB,
            peakHeapMB: r.peakHeapMB ?? null,
            peakGpuMB: r.peakGpuMB ?? null,
            inViewRequests: r.inViewRequests ?? null,
            library: r.library ?? null,
            streaming: r.streaming ?? null,
            jsHeapUsedMB: metrics.JSHeapUsedSize ? Math.round(metrics.JSHeapUsedSize / 2 ** 20) : null,
            memory: r.memory,
            tier: r.stats?.tier ?? null,
            models: r.stats?.modelsLoaded ?? null,
            drawCalls: r.stats?.drawCalls ?? null,
            triangles: r.stats?.triangles ?? null,
            runtime: r.runtime,
            prepared: r.prepared,
            animals: r.animals,
            tasks,
            longFrames: frames.filter((frame) => frame.blocking > 0 || frame.ms > 100).slice(0, 40),
            samples: r.samples ?? null,
            errors: errors.filter((e) => !/Failed to load resource/.test(e)).slice(0, 8)
        };
        results.push(row);
        log(deviceName, `run ${run} [${pageKind}, ${cpuThrottle}x, ${interact ? "touched" : "untouched"}, ${row.tier}] steady ${steady.fps} fps, interval p50/p95/p99 ${steady.interval.p50}/${steady.interval.p95}/${steady.interval.p99} ms, >16.7 ${steady.interval.over16}%, >33 ${steady.interval.over33}%, cpu p50/p95 ${steady.cpu.p50}/${steady.cpu.p95} ms, alloc ${steady.allocMBps} MB/s (${steady.gcDrops} GC drops), ${Math.round(bytesBeforeFirstFrame / 1024)} KB before the first frame${perfAvg ? `, sections ${JSON.stringify(perfAvg.sections)}, calls ${perfAvg.gpu.calls}, tris ${perfAvg.gpu.triangles}, programs ${perfAvg.gpu.programs}, textures ${perfAvg.gpu.textures}, dpr ${perfAvg.dpr}, drawn ${perfAvg.drawn}, rigged ${perfAvg.rigged}, mode ${perfAvg.mode}` : ""}`);
        log(deviceName, `run ${run} (world ${row.world}):`, `first frame ${row.firstFrameMs} ms (mount ${row.mountMs}), in view ${row.inViewMs} ms (${row.inViewBy ?? "-"}), frames ${row.frameRate ? `${row.frameRate.fps} fps (p50 ${row.frameRate.p50Ms} ms, p95 ${row.frameRate.p95Ms} ms, ${row.frameRate.over50Ms} over 50 ms)` : "-"}, longest task ${row.longestTaskMs} ms (${row.longTasks} long, ${row.longTasksAfterFirstFrame} after the first frame, longest after ${row.longestAfterFirstFrameMs}), heap ${row.heapMB} MB (peak ${row.peakHeapMB}), GPU peak ${row.peakGpuMB} MB, requests to view ${row.inViewRequests} (pack ${row.library?.packHits ?? "-"}/${(row.library?.packHits ?? 0) + (row.library?.fileHits ?? 0)}), chunks in ${row.streaming?.chunks?.in ?? "-"}, skipped ${row.streaming?.animalsSkipped ?? "-"}, GPU est ${row.memory?.geometryMB}+${row.memory?.textureMB} MB, ${row.models} models, ${row.tier}${row.prepared ? `, prebuild ${row.prepared.where} ${row.prepared.ms} ms (worker ${row.prepared.workerMs} ms)${row.prepared.error ? ` ${row.prepared.error}` : ""}` : ""}, ${row.animals} animals`);
        await context.close();
    }
}
await browser.close();
server.close();

const median = (values) => {
    const list = values.filter((v) => typeof v === "number").sort((a, b) => a - b);
    return list.length ? list[Math.floor(list.length / 2)] : null;
};
writeFileSync(path.join(out, "runtime.json"), JSON.stringify(results, null, 2));
const lines = [
    `Ark runtime "${label}", ${new Date().toISOString()}, world ${[...new Set(results.map((r) => r.world))].join("/")}, ${buildEnv} build, GPU ${gpu}, network ${arg("network", "none")}, quality ${quality}, ${runs} runs × ${seconds} s per device (medians).`,
    "",
    `| device | first frame ms | mount ms | in view ms | requests to view | longest task ms | long tasks | longest after 1st frame | heap MB | peak heap MB | peak GPU MB | fps | p50 ms | p95 ms | GPU geometry MB | GPU textures MB | models | tier |${gcPoints ? " heap after GC, first frame MB | heap after GC, steady MB |" : ""}`,
    `|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|${gcPoints ? "---|---|" : ""}`
];
for (const deviceName of devices) {
    const rows = results.filter((r) => r.device === deviceName);
    lines.push(`| ${deviceName} | ${median(rows.map((r) => r.firstFrameMs))} | ${median(rows.map((r) => r.mountMs))} | ${median(rows.map((r) => r.inViewMs))} | ${median(rows.map((r) => r.inViewRequests))} | ${median(rows.map((r) => r.longestTaskMs))} | ${median(rows.map((r) => r.longTasks))} | ${median(rows.map((r) => r.longestAfterFirstFrameMs))} | ${median(rows.map((r) => r.heapMB))} | ${median(rows.map((r) => r.peakHeapMB))} | ${median(rows.map((r) => r.peakGpuMB))} | ${median(rows.map((r) => r.frameRate?.fps))} | ${median(rows.map((r) => r.frameRate?.p50Ms))} | ${median(rows.map((r) => r.frameRate?.p95Ms))} | ${median(rows.map((r) => r.memory?.geometryMB))} | ${median(rows.map((r) => r.memory?.textureMB))} | ${median(rows.map((r) => r.models))} | ${rows[0]?.tier} |${gcPoints ? ` ${median(rows.map((r) => r.gc?.firstFrame.afterGcMB))} | ${median(rows.map((r) => r.gc?.steady.afterGcMB))} |` : ""}`);
}
// The lane's steady-play table (frames from 20 s after the first frame).
lines.push("", `| device | page | throttle | touched | tier | fps | interval p50 / p95 / p99 ms | > 16.7 ms % | > 33 ms % | frame CPU p50 / p95 ms | alloc MB/s | GC drops | KB before 1st frame | first frame ms |${perfOn ? " calls | triangles | programs | textures | top sections (ms/frame) |" : ""}`, `|---|---|---|---|---|---|---|---|---|---|---|---|---|---|${perfOn ? "---|---|---|---|---|" : ""}`);
for (const deviceName of devices) {
    const rows = results.filter((r) => r.device === deviceName);
    const m = (pick) => median(rows.map(pick));
    const top = rows[0]?.perf ? Object.entries(rows[0].perf.sections).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k} ${v}`).join(", ") : "";
    lines.push(`| ${deviceName} | ${pageKind} | ${rows[0]?.throttle}x | ${interact ? "yes" : "no"} | ${rows[0]?.tier ?? rows[0]?.perf?.tier} | ${m((r) => r.steady.fps)} | ${m((r) => r.steady.interval.p50)} / ${m((r) => r.steady.interval.p95)} / ${m((r) => r.steady.interval.p99)} | ${m((r) => r.steady.interval.over16)} | ${m((r) => r.steady.interval.over33)} | ${m((r) => r.steady.cpu.p50)} / ${m((r) => r.steady.cpu.p95)} | ${m((r) => r.steady.allocMBps)} | ${m((r) => r.steady.gcDrops)} | ${Math.round((m((r) => r.bytesBeforeFirstFrame) ?? 0) / 1024)} | ${m((r) => r.firstFrameMs)} |${perfOn ? ` ${m((r) => r.perf?.gpu.calls)} | ${m((r) => r.perf?.gpu.triangles)} | ${m((r) => r.perf?.gpu.programs)} | ${m((r) => r.perf?.gpu.textures)} | ${top} |` : ""}`);
}
writeFileSync(path.join(out, "runtime.md"), lines.join("\n") + "\n");
log("wrote", path.join(out, "runtime.md"));
if (populationFile) log(`snapshot reads: ${reads.full} whole, ${reads.notModified} unchanged (304)`);
console.log(lines.join("\n"));
