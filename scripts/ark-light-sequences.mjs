#!/usr/bin/env node
/**
 * The Ark's light over time (the lighting lane, 2026-11-14): frame sequences of the apps' panel (`/ark/embed.html`, a
 * development build of the bundle, `node scripts/build-ark-bundle.mjs --dev` first) on the measure script's device
 * profiles, and what changed between consecutive frames. Light is temporal: a still cannot show a flicker, a pop or
 * a crawling shadow edge.
 *
 *   node scripts/ark-light-sequences.mjs --scenarios <file.mjs> --out <dir> --snapshot <voyage.json>
 *        [--device desktop|phone|phone-low] [--quality high|medium|low|auto] [--only <name,name>] [--port <n>]
 *        [--throttle <n>] [--page embed|hero] [--bundle <dir>] (the scene's script and workers from another build)
 *        [--from-start <frames>] [--start-every <n>] (the load's own frames, from the first drawn) [--slow-sky <ms>]
 *
 * The snapshot is a file fetched from the live public read (`/api/ark/voyage`), served where it is, never copied.
 *
 * A scenario file's default export is a list of
 *   {name, frames, reduced?, hour?, env?, settle?, setup?: string, step?: string, scale?, every?}
 * `setup` and `step` are function bodies run in the page: `setup` once (async, before the frames; `ark` is the
 * scene's handle, `debug` is `__arkDebug`, `tools` the helpers below), `step` before every captured frame with
 * `(i, n, ark, debug, tools, state)`. `reduced` holds the water, wind and animals still (the scene's reduced motion),
 * so with a still camera any change between frames is the light's own. `every` captures every n-th drawn frame.
 *
 * Out, per scenario: `<name>/f-000.png …`, `<name>/metrics.json` (per frame: mean colour, the change from the frame
 * before, the share of pixels that flickered: changed one way and straight back), `<name>/flicker.png` (where),
 * `<name>/sheet.png` (a contact sheet) and a summary line.
 */

import {createServer} from "node:http";
import {existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import os from "node:os";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import {gzipSync} from "node:zlib";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name, fallback) => {
    const at = process.argv.indexOf(`--${name}`);
    return at > 0 && process.argv[at + 1] && !process.argv[at + 1].startsWith("--") ? process.argv[at + 1] : fallback;
};
const flag = (name) => process.argv.includes(`--${name}`);
const log = (...parts) => console.log(new Date().toISOString().slice(11, 19), ...parts);

const DEVICES = {
    desktop: {viewport: {width: 1440, height: 900}, deviceScaleFactor: 1, isMobile: false, hasTouch: false},
    phone: {viewport: {width: 360, height: 800}, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: "Mozilla/5.0 (Linux; Android 14; SM-A356B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36", cores: 8, memoryGB: 4},
    "phone-low": {viewport: {width: 360, height: 800}, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: "Mozilla/5.0 (Linux; Android 13; SM-A145F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36", cores: 4, memoryGB: 3}
};

const deviceName = arg("device", "desktop");
const device = DEVICES[deviceName];
if (!device) throw new Error(`--device ${deviceName}: desktop, phone or phone-low`);
const quality = arg("quality", "auto");
const out = path.resolve(arg("out", path.join(root, ".ark-golden", "lights")));
const snapshotFile = arg("snapshot", "");
const live = arg("live", "");
if (!live && (!snapshotFile || !existsSync(snapshotFile))) throw new Error("--snapshot <file>: a snapshot fetched from the live public read");
const scenarioFile = arg("scenarios", "");
if (!scenarioFile) throw new Error("--scenarios <file.mjs>");
const only = arg("only", "").split(",").filter(Boolean);
const scenarios = (await import(pathToFileURL(path.resolve(scenarioFile)).href)).default.filter((s) => !only.length || only.includes(s.name));
const pageKind = arg("page", "embed");
const throttle = Number(arg("throttle", "0"));
const bundleDir = arg("bundle", "") ? path.resolve(arg("bundle", "")) : "";
const slowSky = Number(arg("slow-sky", "0"));
mkdirSync(out, {recursive: true});

const gz = new Map();
const server = createServer((request, response) => {
    const url = new URL(request.url, "http://localhost");
    const send = (body, type) => {
        if (/^(text\/|application\/json)/.test(type) && /\bgzip\b/.test(String(request.headers["accept-encoding"] ?? ""))) {
            const key = `${url.pathname}:${body.length}`;
            let zipped = gz.get(key);
            if (!zipped) gz.set(key, (zipped = gzipSync(body, {level: 1})));
            response.writeHead(200, {"Content-Type": type, "Content-Encoding": "gzip", "Cache-Control": "no-store"}).end(zipped);
            return;
        }
        response.writeHead(200, {"Content-Type": type, "Cache-Control": "no-store"}).end(body);
    };
    if (url.pathname === "/population-file.json") return send(readFileSync(snapshotFile), "application/json");
    if (url.pathname === "/hero.html") {
        return send(Buffer.from(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Ark hero</title>
<style>html,body{margin:0;background:#0b1d2e}header{height:64px}section{position:relative;height:calc(100svh - 64px);max-height:60rem;min-height:34rem}iframe{position:absolute;inset:0;width:100%;height:100%;border:0}</style>
</head><body><header></header><section><iframe id="hero" title="Ark"></iframe></section><script>document.getElementById("hero").src = "/ark/embed.html" + location.search;</script></body></html>`), "text/html");
    }
    // `--bundle <dir>`: the scene's script and workers from another build (a before/after pair on one set of art).
    const other = bundleDir && url.pathname.startsWith("/ark/") ? path.join(bundleDir, path.basename(url.pathname)) : "";
    const folder = other && existsSync(other) ? bundleDir : path.join(root, "public");
    const file = other && existsSync(other) ? other : path.join(folder, path.normalize(url.pathname).replace(/^\/+/, ""));
    if (!file.startsWith(folder) || !existsSync(file)) return response.writeHead(404).end();
    const type = file.endsWith(".html") ? "text/html" : file.endsWith(".js") ? "text/javascript" : file.endsWith(".webp") ? "image/webp" : file.endsWith(".json") ? "application/json" : "application/octet-stream";
    // `--slow-sky <ms>`: the photographed sky's file held back (a slow link), to see it arrive in a world already drawn.
    if (slowSky > 0 && file.endsWith("sky-day.hdr")) return void setTimeout(() => send(readFileSync(file), type), slowSky);
    send(readFileSync(file), type);
});
await new Promise((resolve) => server.listen(Number(arg("port", "0")), "127.0.0.1", resolve));
const base = live || `http://127.0.0.1:${server.address().port}`;

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
const browser = await chromium.launch({
    executablePath: process.env.ARK_CHROMIUM || cachedChromium() || undefined,
    headless: true,
    args: ["--headless=new", "--enable-gpu", "--ignore-gpu-blocklist", ...(process.platform === "darwin" ? ["--use-angle=metal"] : []), "--disable-background-timer-throttling", "--disable-renderer-backgrounding"]
});

/** In the page, before its own script: the frame hook (a step before each frame, a copy of the canvas after each drawn one). */
function installCapture() {
    const cap = {on: false, frames: [], step: null, i: 0, n: 0, every: 1, drawn: 0, lastFrame: -1, scale: 1, state: {}, ready: 0, tier: null, errors: []};
    window.__cap = cap;
    // `--from-start <frames>`: every drawn frame from the first (the load: the poster's cross-fade, the sky arriving).
    if (window.__capFromStart) {
        cap.on = true;
        cap.n = window.__capFromStart.frames;
        cap.every = window.__capFromStart.every;
        cap.scale = window.__capFromStart.scale;
        cap.fromStart = true;
    }
    const native = window.requestAnimationFrame.bind(window);
    const rendererOf = () => window.__arkDebug?.lighting?.renderer ?? null;
    window.requestAnimationFrame = (callback) => native((ts) => {
        const renderer = rendererOf();
        if (cap.on && cap.step && cap.i < cap.n) {
            try {
                cap.step(cap.i, cap.n);
            } catch (error) {
                cap.errors.push(String(error));
            }
        }
        // (Only a frame the scene drew in this very callback: the canvas is cleared once a frame is shown.)
        const before = renderer ? renderer.info.render.frame : -1;
        callback(ts);
        if (!cap.on || !renderer) return;
        if (renderer.info.render.frame === before) return;
        cap.drawn++;
        if (cap.drawn % cap.every !== 0) return;
        if (cap.i >= cap.n) {
            cap.on = false;
            return;
        }
        const source = renderer.domElement;
        const w = Math.max(1, Math.round(source.width * cap.scale));
        const h = Math.max(1, Math.round(source.height * cap.scale));
        const copy = new OffscreenCanvas(w, h);
        copy.getContext("2d").drawImage(source, 0, 0, w, h);
        cap.frames.push({canvas: copy, t: performance.now(), env: window.__arkDebug?.scene?.environmentIntensity ?? null});
        cap.i++;
        if (cap.i >= cap.n) cap.on = false;
    });
    window.AndroidArk = {postMessage: (text) => {
        try {
            const message = JSON.parse(text);
            if (message.type === "ark:ready" && !cap.ready) cap.ready = performance.now();
            if (message.type === "ark:tier") cap.tier = message.tier;
        } catch {
            // Not ours.
        }
    }};
}

async function analyse(dir, count, summary) {
    const frames = [];
    for (let i = 0; i < count; i++) frames.push(await sharp(path.join(dir, `f-${String(i).padStart(3, "0")}.png`)).removeAlpha().raw().toBuffer({resolveWithObject: true}));
    const {width, height} = frames[0].info;
    const pixels = width * height;
    const luma = frames.map(({data}) => {
        const l = new Float32Array(pixels);
        for (let p = 0, q = 0; p < pixels; p++, q += 3) l[p] = 0.2126 * data[q] + 0.7152 * data[q + 1] + 0.0722 * data[q + 2];
        return l;
    });
    const per = [];
    const heat = new Uint8Array(pixels);
    const changeHeat = new Uint8Array(pixels);
    for (let i = 0; i < count; i++) {
        const {data} = frames[i];
        let r = 0, g = 0, b = 0;
        for (let q = 0; q < data.length; q += 3) {
            r += data[q];
            g += data[q + 1];
            b += data[q + 2];
        }
        const row = {i, mean: [r / pixels, g / pixels, b / pixels].map((v) => Math.round(v * 100) / 100)};
        if (i > 0) {
            let sum = 0, over = 0, big = 0;
            const a = luma[i - 1], c = luma[i];
            for (let p = 0; p < pixels; p++) {
                const d = Math.abs(c[p] - a[p]);
                sum += d;
                if (d > 6) over++;
                if (d > 24) big++;
                if (d > changeHeat[p]) changeHeat[p] = Math.min(255, d);
            }
            row.change = Math.round((sum / pixels) * 1000) / 1000;
            row.changed = Math.round((over / pixels) * 100000) / 1000;
            row.changedBig = Math.round((big / pixels) * 100000) / 1000;
        }
        if (i > 0 && i < count - 1) {
            // A flicker: a pixel that went one way by more than 10 and came straight back (the frames either side agree).
            let flick = 0;
            const a = luma[i - 1], b2 = luma[i], c = luma[i + 1];
            for (let p = 0; p < pixels; p++) {
                const d1 = b2[p] - a[p];
                const d2 = c[p] - b2[p];
                if (Math.abs(d1) > 10 && Math.abs(d2) > 10 && d1 * d2 < 0 && Math.abs(c[p] - a[p]) < Math.min(Math.abs(d1), Math.abs(d2)) * 0.5) {
                    flick++;
                    heat[p] = Math.min(255, Math.max(heat[p], Math.abs(d1) * 2));
                }
            }
            row.flicker = Math.round((flick / pixels) * 100000) / 1000;
        }
        per.push(row);
    }
    const changes = per.slice(1).map((row) => row.change);
    const sorted = [...changes].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
    const lumaMean = per.map((row) => 0.2126 * row.mean[0] + 0.7152 * row.mean[1] + 0.0722 * row.mean[2]);
    let step = 0, stepAt = 0;
    for (let i = 1; i < count; i++) {
        const d = Math.abs(lumaMean[i] - lumaMean[i - 1]);
        if (d > step) {
            step = d;
            stepAt = i;
        }
    }
    const result = {
        ...summary,
        size: [width, height],
        frames: count,
        // The typical change between consecutive frames (0–255), the largest, and where; the picture's largest brightness step.
        changeMedian: median,
        changeMax: Math.max(0, ...changes),
        changeMaxAt: changes.indexOf(Math.max(0, ...changes)) + 1,
        changedPctMax: Math.max(0, ...per.slice(1).map((row) => row.changed)),
        flickerPctMean: Math.round((per.reduce((sum, row) => sum + (row.flicker ?? 0), 0) / Math.max(count - 2, 1)) * 1000) / 1000,
        flickerPctMax: Math.max(0, ...per.map((row) => row.flicker ?? 0)),
        brightnessStepMax: Math.round(step * 100) / 100,
        brightnessStepAt: stepAt,
        brightnessFirstLast: [Math.round(lumaMean[0] * 100) / 100, Math.round(lumaMean[count - 1] * 100) / 100],
        per
    };
    writeFileSync(path.join(dir, "metrics.json"), JSON.stringify(result, null, 1));
    await sharp(Buffer.from(heat), {raw: {width, height, channels: 1}}).png().toFile(path.join(dir, "flicker.png"));
    await sharp(Buffer.from(changeHeat.map((v) => Math.min(255, v * 4))), {raw: {width, height, channels: 1}}).png().toFile(path.join(dir, "change.png"));
    // A contact sheet: 8 frames across the sequence.
    const picks = Array.from({length: Math.min(8, count)}, (_, k) => Math.round((k * (count - 1)) / Math.max(Math.min(8, count) - 1, 1)));
    const tw = Math.round(width > height ? 480 : 240);
    const th = Math.round((tw * height) / width);
    const cols = width > height ? 4 : 8;
    const tiles = await Promise.all(picks.map((i) => sharp(path.join(dir, `f-${String(i).padStart(3, "0")}.png`)).resize(tw, th).toBuffer()));
    await sharp({create: {width: tw * cols, height: th * Math.ceil(tiles.length / cols), channels: 3, background: "#000"}})
        .composite(tiles.map((input, k) => ({input, left: (k % cols) * tw, top: Math.floor(k / cols) * th})))
        .png()
        .toFile(path.join(dir, "sheet.png"));
    return result;
}

const summaries = [];
const context = await browser.newContext({viewport: device.viewport, deviceScaleFactor: device.deviceScaleFactor, isMobile: device.isMobile, hasTouch: device.hasTouch, userAgent: device.userAgent});
const fromStart = Number(arg("from-start", "0"));
if (fromStart > 0) await context.addInitScript((config) => { window.__capFromStart = config; }, {frames: fromStart, every: Number(arg("start-every", "2")), scale: Number(arg("start-scale", "0.5"))});
await context.addInitScript(installCapture);
if (device.cores) {
    await context.addInitScript(([cores, memoryGB]) => {
        Object.defineProperty(navigator, "hardwareConcurrency", {get: () => cores});
        Object.defineProperty(navigator, "deviceMemory", {get: () => memoryGB});
    }, [device.cores, device.memoryGB]);
}
if (quality !== "auto") await context.addInitScript((q) => { window.__arkQuality = q; }, quality);
const extraInit = arg("init", "");
if (extraInit) await context.addInitScript(readFileSync(extraInit, "utf8"));
const page = await context.newPage();
const errors = [];
const failed = [];
page.on("pageerror", (error) => errors.push(String(error)));
page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
    if (flag("console") && message.type() !== "error") log("page:", message.text().slice(0, 300));
});
page.on("requestfailed", (request) => failed.push(`${request.failure()?.errorText ?? "failed"} ${request.url().slice(0, 140)}`));
page.on("response", (response) => {
    if (response.status() >= 400) failed.push(`${response.status()} ${response.url().slice(0, 140)}`);
});
if (throttle > 1) {
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", {rate: throttle});
}
const query = live ? arg("query", "") : `snapshot=${encodeURIComponent("/population-file.json")}${pageKind === "hero" ? "&refresh=600&idle=900" : ""}${arg("query", "") ? `&${arg("query", "")}` : ""}`;
const openAt = Date.now();
await page.goto(`${base}/${pageKind === "hero" ? "hero.html" : "ark/embed.html"}?${query}`, {waitUntil: "commit", timeout: 120_000});
const frameOf = () => (pageKind === "hero" ? page.frames().find((f) => f.url().includes("/ark/embed.html")) ?? page.mainFrame() : page.mainFrame());
// The scene up, the town in the world, then the first view's models.
await page.waitForTimeout(500);
for (let waited = 0; waited < 240_000; waited += 500) {
    const state = await frameOf().evaluate(() => ({ready: window.__cap?.ready ?? 0, attached: Boolean(window.__arkScene?.attached?.())})).catch(() => ({ready: 0, attached: false}));
    if (state.ready && state.attached) break;
    await page.waitForTimeout(500);
}
await page.waitForTimeout(Number(arg("warm", "25")) * 1000);
const tier = await frameOf().evaluate(() => window.__arkTier?.() ?? window.__cap?.tier ?? null);
log(`${deviceName} ${quality} → tier ${tier}; up in ${((Date.now() - openAt) / 1000).toFixed(1)} s`);

/** The frames the page holds, written out and analysed. */
async function collect(frame, dir, summary, scenario = {}) {
    const info = await frame.evaluate(() => ({count: window.__cap.frames.length, times: window.__cap.frames.map((f) => Math.round(f.t)), envs: window.__cap.frames.map((f) => f.env), errors: window.__cap.errors.splice(0), tier: window.__arkTier?.() ?? null, state: (() => { try { return JSON.parse(JSON.stringify(window.__cap.state)); } catch { return null; } })()}));
    for (let i = 0; i < info.count; i++) {
        const data = await frame.evaluate(async (k) => {
            const blob = await window.__cap.frames[k].canvas.convertToBlob({type: "image/png"});
            const bytes = new Uint8Array(await blob.arrayBuffer());
            let text = "";
            for (let at = 0; at < bytes.length; at += 32768) text += String.fromCharCode(...bytes.subarray(at, at + 32768));
            window.__cap.frames[k].canvas = null;
            return btoa(text);
        }, i);
        writeFileSync(path.join(dir, `f-${String(i).padStart(3, "0")}.png`), Buffer.from(data, "base64"));
    }
    await frame.evaluate(() => { window.__cap.frames = []; });
    if (info.count < 3) throw new Error(`only ${info.count} frames drawn`);
    const spanMs = info.times[info.count - 1] - info.times[0];
    const result = await analyse(dir, info.count, {...summary, tier: info.tier, fps: Math.round(((info.count - 1) / Math.max(spanMs, 1)) * 10000) / 10, stepErrors: info.errors.slice(0, 3), state: info.state, times: info.times, envs: info.envs});
    const {per, ...line} = result;
    // Kept: the first and last frames and those round the largest change and the worst flicker (`--keep-all`: every frame).
    if (!flag("keep-all") && !scenario.keepAll) {
        const worst = per.reduce((best, row) => ((row.flicker ?? 0) > (per[best].flicker ?? 0) ? row.i : best), 0);
        const keep = new Set([0, info.count - 1, line.changeMaxAt - 1, line.changeMaxAt, line.brightnessStepAt - 1, line.brightnessStepAt, worst - 1, worst, worst + 1, ...(scenario.keep ?? [])]);
        for (let i = 0; i < info.count; i++) if (!keep.has(i)) rmSync(path.join(dir, `f-${String(i).padStart(3, "0")}.png`), {force: true});
    }
    summaries.push(line);
    return {line, info};
}

if (fromStart > 0) {
    // The load's own frames: until they are all taken (or 60 s on).
    for (let waited = 0; waited < 60_000; waited += 500) {
        if (!(await frameOf().evaluate(() => window.__cap.on))) break;
        await page.waitForTimeout(500);
    }
    await frameOf().evaluate(() => { window.__cap.on = false; });
    const dir = path.join(out, "load");
    mkdirSync(dir, {recursive: true});
    try {
        const {line, info} = await collect(frameOf(), dir, {name: "load", device: deviceName, quality}, {keepAll: flag("keep-all")});
        log(`load: ${info.count} frames over ${((info.times[info.count - 1] - info.times[0]) / 1000).toFixed(1)} s · change median ${line.changeMedian} max ${line.changeMax} (frame ${line.changeMaxAt}) · brightness step ${line.brightnessStepMax} at ${line.brightnessStepAt}`);
    } catch (error) {
        log(`load: FAILED ${String(error).slice(0, 300)}`);
    }
}

for (const scenario of scenarios) {
    const dir = path.join(out, scenario.name);
    mkdirSync(dir, {recursive: true});
    let frame = frameOf();
    const started = Date.now();
    try {
        if (scenario.contextLoss) {
            // The WebGL context lost and handed back (`WEBGL_lose_context`); a page that reloads for it is waited for.
            const mark = await frame.evaluate(() => {
                window.__lostMark = true;
                const gl = window.__arkDebug.lighting.renderer.getContext();
                const ext = gl.getExtension("WEBGL_lose_context");
                ext.loseContext();
                setTimeout(() => ext.restoreContext(), 800);
                return true;
            });
            void mark;
            await page.waitForTimeout(2500);
            let reloaded = false;
            for (let waited = 0; waited < 240_000; waited += 500) {
                const state = await frameOf().evaluate(() => ({marked: Boolean(window.__lostMark), ready: window.__cap?.ready ?? 0, attached: Boolean(window.__arkScene?.attached?.())})).catch(() => null);
                if (state && !state.marked) reloaded = true;
                if (state && (state.marked || (state.ready && state.attached))) break;
                await page.waitForTimeout(500);
            }
            log(`${scenario.name}: context lost and restored; the page ${reloaded ? "reloaded" : "stayed"}`);
            if (reloaded) await page.waitForTimeout(Number(arg("warm", "25")) * 1000);
            else await page.waitForTimeout(4000);
            frame = frameOf();
            scenario.reloaded = reloaded;
        }
        await frame.evaluate(async ({scenario}) => {
            const ark = window.__arkScene;
            const debug = window.__arkDebug;
            const cap = window.__cap;
            const tools = {
                sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
                /** `frames` drawn frames from now. */
                frames: (count) => new Promise((resolve) => {
                    const from = debug.lighting.renderer.info.render.frame;
                    const tick = () => (debug.lighting.renderer.info.render.frame - from >= count ? resolve() : requestAnimationFrame(tick));
                    tick();
                }),
                mix: (a, b, t) => a + (b - a) * t,
                smooth: (t) => t * t * (3 - 2 * t)
            };
            cap.state = {};
            ark.setReducedMotion(Boolean(scenario.reduced));
            ark.setHours(typeof scenario.hour === "number" ? scenario.hour : null);
            ark.setEnvironment(scenario.env ?? null);
            if (scenario.setup) await new Function("ark", "debug", "tools", "state", `return (async () => { ${scenario.setup} })();`)(ark, debug, tools, cap.state);
            await tools.sleep(scenario.settle ?? 1500);
            const step = scenario.step ? new Function("i", "n", "ark", "debug", "tools", "state", scenario.step) : null;
            cap.frames = [];
            cap.i = 0;
            cap.n = scenario.frames;
            cap.every = scenario.every ?? 1;
            cap.drawn = 0;
            cap.scale = scenario.scale ?? 1;
            cap.step = step ? (i, n) => step(i, n, ark, debug, tools, cap.state) : null;
            cap.on = true;
            // (Awake throughout: the runtime's idle cap would halve the rate.)
            const poke = setInterval(() => document.querySelector("canvas")?.dispatchEvent(new PointerEvent("pointermove", {bubbles: true, clientX: 5, clientY: 5})), 200);
            const deadline = performance.now() + 120000;
            while (cap.on && performance.now() < deadline) await tools.sleep(50);
            clearInterval(poke);
            cap.on = false;
        }, {scenario});
        const {line, info} = await collect(frame, dir, {name: scenario.name, device: deviceName, quality, hour: scenario.hour ?? null, reduced: Boolean(scenario.reduced)}, scenario);
        log(`${scenario.name}: ${info.count} frames in ${((Date.now() - started) / 1000).toFixed(1)} s · change median ${line.changeMedian} max ${line.changeMax} (frame ${line.changeMaxAt}) · flicker mean ${line.flickerPctMean}% max ${line.flickerPctMax}% · brightness step ${line.brightnessStepMax} at ${line.brightnessStepAt}${info.errors.length ? ` · step errors: ${info.errors[0]}` : ""}`);
    } catch (error) {
        log(`${scenario.name}: FAILED ${String(error).slice(0, 400)}`);
        summaries.push({name: scenario.name, error: String(error)});
    }
}
writeFileSync(path.join(out, "summary.json"), JSON.stringify({device: deviceName, quality, tier, page: pageKind, base: live || "local dev bundle", summaries, pageErrors: errors, badRequests: failed}, null, 1));
log(`page errors ${errors.length}${errors.length ? `: ${errors.slice(0, 3).join(" | ").slice(0, 400)}` : ""}; bad requests ${failed.length}${failed.length ? `: ${failed.slice(0, 3).join(" | ")}` : ""}`);
await browser.close();
server.close();
