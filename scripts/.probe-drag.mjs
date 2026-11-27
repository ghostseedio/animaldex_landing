#!/usr/bin/env node
/**
 * Desktop drag probe for the Ark (perf sprint 2026-11-27).
 * Opens a page (default: the live https://animaldex.app/ark?perf=1), waits for the world to be in view, then drags it
 * with a real mouse cadence (one move every 16 ms) and records, per phase:
 *   - every animation frame's interval (rAF wrapped before the page's own script) and the rAF callbacks' own time
 *   - long tasks (> 50 ms)
 *   - input latency: how long each CDP mouse move takes to be acknowledged by the page (blocked main thread = lag)
 *   - the scene's own profiler (`__arkPerfReport()`, `__arkPerfSlow()`) when ?perf=1
 *   - optionally a CPU profile of the drag (`--profile`)
 *
 * Usage (run from a landing worktree so playwright-core resolves):
 *   node ~/AnimalDex-work/ark-perf-web/probe-drag.mjs --url https://animaldex.app/ark?perf=1 --label live-chrome-dpr2 \
 *        [--dpr 2] [--width 1440 --height 900] [--browser chromium|webkit] [--profile] [--headed] [--settle 15]
 */
import {mkdirSync, writeFileSync, existsSync, readdirSync} from "node:fs";
import os from "node:os";
import path from "node:path";

const arg = (name, fallback) => {
    const at = process.argv.indexOf(`--${name}`);
    return at > 0 && process.argv[at + 1] !== undefined && !process.argv[at + 1].startsWith("--") ? process.argv[at + 1] : fallback;
};
const flag = (name) => process.argv.includes(`--${name}`);
const url = arg("url", "https://animaldex.app/ark?perf=1");
const label = arg("label", "probe");
const dpr = Number(arg("dpr", "2"));
const width = Number(arg("width", "1440"));
const height = Number(arg("height", "900"));
const browserName = arg("browser", "chromium");
const settleMs = Number(arg("settle", "15")) * 1000;
const inViewTimeout = Number(arg("timeout", "90")) * 1000;
const outDir = path.resolve(arg("out", path.join(os.homedir(), "AnimalDex-work/ark-perf-web/runs", label)));
mkdirSync(outDir, {recursive: true});
const log = (...parts) => console.log(new Date().toISOString().slice(11, 19), ...parts);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function cachedChromium() {
    const cache = path.join(os.homedir(), "Library", "Caches", "ms-playwright");
    if (!existsSync(cache)) return null;
    for (const name of readdirSync(cache).filter((entry) => /^chromium-\d+$/.test(entry)).sort().reverse()) {
        const candidate = path.join(cache, name, "chrome-mac-arm64", "Google Chrome for Testing.app", "Contents", "MacOS", "Google Chrome for Testing");
        if (existsSync(candidate)) return candidate;
    }
    return null;
}

const pw = await import("playwright-core");
let browser;
if (browserName === "webkit") {
    browser = await pw.webkit.launch({headless: !flag("headed")});
} else {
    browser = await pw.chromium.launch({
        executablePath: process.env.ARK_CHROMIUM || (flag("real-chrome") ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : cachedChromium()) || undefined,
        headless: !flag("headed"),
        args: [...(flag("headed") ? [] : ["--headless=new"]), "--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=metal", "--enable-precise-memory-info", "--disable-background-timer-throttling", "--disable-renderer-backgrounding"]
    });
}
const context = await browser.newContext({viewport: {width, height}, deviceScaleFactor: dpr, isMobile: false, hasTouch: false});
// A pinned tier (`--quality high|medium|low`: the scene's own development override, read at mount).
const quality = arg("quality", "");
if (quality) await context.addInitScript((q) => { window.__arkQuality = q; }, quality);
// Frame recorder, before the page's own script.
await context.addInitScript(() => {
    const rec = {frames: [], cbMs: [], long: [], longSeen: new Set(), marks: [], pointer: []};
    window.__probe = rec;
    const raf = window.requestAnimationFrame.bind(window);
    let lastFrameTs = -1;
    let frameCb = 0;
    window.requestAnimationFrame = (cb) => raf((ts) => {
        if (ts !== lastFrameTs) {
            if (lastFrameTs >= 0) rec.cbMs.push(frameCb);
            rec.frames.push(ts);
            lastFrameTs = ts;
            frameCb = 0;
        }
        const t0 = performance.now();
        try {
            cb(ts);
        } finally {
            frameCb += performance.now() - t0;
        }
    });
    try {
        new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                const key = `${entry.startTime}:${entry.duration}`;
                if (rec.longSeen.has(key)) continue;
                rec.longSeen.add(key);
                rec.long.push([entry.startTime, entry.duration]);
            }
        }).observe({type: "longtask", buffered: true});
    } catch {}
    // Pointer handlers' own time (all listeners on the target, summed per event type).
    const add = EventTarget.prototype.addEventListener;
    const wrapped = new WeakMap();
    EventTarget.prototype.addEventListener = function (type, listener, options) {
        if ((type === "pointermove" || type === "pointerdown" || type === "pointerup" || type === "wheel" || type === "mousemove") && typeof listener === "function") {
            let w = wrapped.get(listener);
            if (!w) {
                w = function (event) {
                    const t0 = performance.now();
                    try {
                        return listener.call(this, event);
                    } finally {
                        const ms = performance.now() - t0;
                        if (ms > 0.05) rec.pointer.push([type, t0, ms]);
                    }
                };
                wrapped.set(listener, w);
            }
            return add.call(this, type, w, options);
        }
        return add.call(this, type, listener, options);
    };
    const remove = EventTarget.prototype.removeEventListener;
    EventTarget.prototype.removeEventListener = function (type, listener, options) {
        return remove.call(this, type, wrapped.get(listener) ?? listener, options);
    };
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(String(error)));
const bad = [];
page.on("response", (response) => {
    if (response.status() >= 400) bad.push(`${response.status()} ${response.url().slice(0, 200)}`);
});
page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console: ${msg.text().slice(0, 300)}`);
});
const cdp = browserName === "chromium" ? await context.newCDPSession(page) : null;
// `--profile-startup <s>`: a CPU profile from the navigation for that many seconds (then the drags as usual).
const startupProfileS = Number(arg("profile-startup", "0"));
if (startupProfileS > 0 && cdp) {
    await cdp.send("Profiler.enable");
    await cdp.send("Profiler.setSamplingInterval", {interval: 250});
    await cdp.send("Profiler.start");
}
const t0 = Date.now();
const timeline = [];
let sampling = true;
(async () => {
    while (sampling) {
        const r = await page.evaluate(() => {
            if (typeof window.__arkPerfReport !== "function") return null;
            const x = window.__arkPerfReport();
            const top = Object.entries(x.sections || {}).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k}:${Math.round(v * 10) / 10}`).join(" ");
            return {fps: x.fps, cpu50: x.cpu?.p50, cpu95: x.cpu?.p95, tier: x.tier, dpr: x.dpr, drawn: x.drawn, rigged: x.rigged, mode: x.mode, calls: x.gpu?.calls, tris: x.gpu?.triangles, heap: x.heapMB, hud: x.hudRenders, top};
        }).catch(() => null);
        if (r) timeline.push({t: Math.round((Date.now() - t0) / 100) / 10, ...r});
        await sleep(2000);
    }
})();
log("open", url, `${width}x${height}@${dpr}`, browserName);
await page.goto(url, {waitUntil: "domcontentloaded", timeout: 120000});

// Wait for the world: the profiler's inViewAt, or a canvas + 40 s.
let inViewAt = null;
while (Date.now() - t0 < inViewTimeout) {
    inViewAt = await page.evaluate(() => (typeof window.__arkPerfReport === "function" ? window.__arkPerfReport()?.inViewAt ?? null : null)).catch(() => null);
    if (inViewAt) break;
    await sleep(1000);
}
if (startupProfileS > 0 && cdp) {
    const left = startupProfileS * 1000 - (Date.now() - t0);
    if (left > 0) await sleep(left);
    const {profile} = await cdp.send("Profiler.stop");
    writeFileSync(path.join(outDir, "startup.cpuprofile"), JSON.stringify(profile));
    log("startup cpu profile saved");
}
log("in view", inViewAt ? `${Math.round(inViewAt)} ms` : "not reported", "settle", settleMs, "ms");
await sleep(settleMs);

const canvasBox = await page.evaluate(() => {
    const canvases = [...document.querySelectorAll("canvas")].map((c) => ({r: c.getBoundingClientRect(), w: c.width, h: c.height}));
    canvases.sort((a, b) => b.r.width * b.r.height - a.r.width * a.r.height);
    const c = canvases[0];
    return c ? {x: c.r.x, y: c.r.y, width: c.r.width, height: c.r.height, bufferW: c.w, bufferH: c.h, count: canvases.length} : null;
});
log("canvas", JSON.stringify(canvasBox));
if (!canvasBox) throw new Error("no canvas");

const phases = [];
const mark = async (name) => {
    const at = await page.evaluate(() => performance.now());
    phases.push({name, at});
    return at;
};
const inputLatency = [];
async function drag(from, to, ms, button = "left") {
    const steps = Math.max(2, Math.round(ms / 16));
    const P = (f) => [canvasBox.x + canvasBox.width * f[0], canvasBox.y + canvasBox.height * f[1]];
    const [x0, y0] = P(from);
    const [x1, y1] = P(to);
    await page.mouse.move(x0, y0);
    await page.mouse.down({button});
    for (let i = 1; i <= steps; i++) {
        const k = i / steps;
        const s = performance.now();
        await page.mouse.move(x0 + (x1 - x0) * k, y0 + (y1 - y0) * k);
        const took = performance.now() - s;
        inputLatency.push(took);
        const wait = 16 - took;
        if (wait > 0) await sleep(wait);
    }
    await page.mouse.up({button});
}
const report = async () => page.evaluate(() => (typeof window.__arkPerfReport === "function" ? window.__arkPerfReport() : null)).catch(() => null);
const reports = {};

if (flag("shots")) await page.screenshot({path: path.join(outDir, "before-drag.png")}).catch(() => {});
await mark("idle");
await sleep(6000);
reports.idle = await report();

if (flag("profile") && cdp) {
    await cdp.send("Profiler.enable");
    await cdp.send("Profiler.setSamplingInterval", {interval: 200});
    await cdp.send("Profiler.start");
}
if (flag("idle-only")) {
    await sleep(Number(arg("idle-seconds", "30")) * 1000);
    sampling = false;
    const result = {label, url, quality, viewport: {width, height, dpr}, inViewAt, timeline, report: await report(), errors: errors.slice(0, 30), badCount: bad.length};
    writeFileSync(path.join(outDir, "result.json"), JSON.stringify(result, null, 2));
    log("idle-only done");
    await browser.close();
    process.exit(0);
}
const latStart = inputLatency.length;
await mark("rotate");
for (let i = 0; i < 3; i++) {
    await drag([0.3, 0.5], [0.7, 0.52], 1600);
    await sleep(300);
    await drag([0.7, 0.52], [0.3, 0.48], 1600);
    await sleep(300);
}
reports.rotate = await report();
const latRotate = inputLatency.slice(latStart);
await mark("pan");
const latPanStart = inputLatency.length;
for (let i = 0; i < 2; i++) {
    await drag([0.35, 0.5], [0.65, 0.6], 1600, "right");
    await sleep(300);
    await drag([0.65, 0.6], [0.35, 0.5], 1600, "right");
    await sleep(300);
}
reports.pan = await report();
const latPan = inputLatency.slice(latPanStart);
await mark("wheel");
for (let i = 0; i < 10; i++) {
    await page.mouse.move(canvasBox.x + canvasBox.width * 0.5, canvasBox.y + canvasBox.height * 0.5);
    await page.mouse.wheel(0, -120);
    await sleep(120);
}
await sleep(800);
for (let i = 0; i < 10; i++) {
    await page.mouse.wheel(0, 120);
    await sleep(120);
}
reports.wheel = await report();
await mark("after");
await sleep(3000);
await mark("end");
if (flag("profile") && cdp) {
    const {profile} = await cdp.send("Profiler.stop");
    writeFileSync(path.join(outDir, "drag.cpuprofile"), JSON.stringify(profile));
    log("cpu profile saved");
}

sampling = false;
const rec = await page.evaluate(() => ({...window.__probe, longSeen: null}));
const slow = await page.evaluate(() => (typeof window.__arkPerfSlow === "function" ? window.__arkPerfSlow() : null)).catch(() => null);
const q = (list, share) => {
    if (!list.length) return null;
    const sorted = [...list].sort((a, b) => a - b);
    return Math.round(sorted[Math.min(sorted.length - 1, Math.floor(share * sorted.length))] * 10) / 10;
};
const summary = {};
for (let i = 0; i < phases.length - 1; i++) {
    const {name, at} = phases[i];
    const end = phases[i + 1].at;
    const idx = [];
    for (let f = 1; f < rec.frames.length; f++) if (rec.frames[f] >= at && rec.frames[f] < end) idx.push(f);
    const intervals = idx.map((f) => rec.frames[f] - rec.frames[f - 1]);
    const cb = idx.map((f) => rec.cbMs[f - 1] ?? 0);
    const long = rec.long.filter(([s]) => s >= at && s < end);
    const ptr = rec.pointer.filter(([, s]) => s >= at && s < end);
    const ptrByType = {};
    for (const [type, , ms] of ptr) {
        ptrByType[type] ??= {n: 0, total: 0, max: 0};
        ptrByType[type].n++;
        ptrByType[type].total += ms;
        ptrByType[type].max = Math.max(ptrByType[type].max, ms);
    }
    for (const v of Object.values(ptrByType)) {
        v.total = Math.round(v.total);
        v.max = Math.round(v.max * 10) / 10;
    }
    const secs = (end - at) / 1000;
    summary[name] = {
        seconds: Math.round(secs * 10) / 10,
        fps: Math.round((intervals.length / secs) * 10) / 10,
        interval: {p50: q(intervals, 0.5), p95: q(intervals, 0.95), p99: q(intervals, 0.99), max: q(intervals, 1)},
        over33: intervals.filter((v) => v > 33.4).length,
        over50: intervals.filter((v) => v > 50).length,
        over100: intervals.filter((v) => v > 100).length,
        rafCallbackMs: {p50: q(cb, 0.5), p95: q(cb, 0.95), max: q(cb, 1)},
        longTasks: long.length,
        longTaskMs: Math.round(long.reduce((s, [, d]) => s + d, 0)),
        pointerHandlers: ptrByType
    };
}
summary.inputAckMs = {rotate: {p50: q(latRotate, 0.5), p95: q(latRotate, 0.95), max: q(latRotate, 1)}, pan: {p50: q(latPan, 0.5), p95: q(latPan, 0.95), max: q(latPan, 1)}};
const result = {label, url, browser: browserName, viewport: {width, height, dpr}, canvas: canvasBox, inViewAt, summary, reports, slowFrames: slow ? slow.slice(-80) : null, errors: errors.slice(0, 30), badResponses: bad.slice(0, 200), badCount: bad.length, timeline};
writeFileSync(path.join(outDir, "result.json"), JSON.stringify(result, null, 2));
await page.screenshot({path: path.join(outDir, "end.png")}).catch(() => {});
log(JSON.stringify({summary, tier: reports.rotate?.tier, dpr: reports.rotate?.dpr, scale: reports.rotate?.scale, gpu: reports.rotate?.gpu, sections: reports.rotate?.sections}, null, 1));
await browser.close();
