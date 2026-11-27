#!/usr/bin/env node
/**
 * PERF-WEB audit (drag lane, 2026-11-27), untracked helper: what ONE re-layout (setSnapshot -> wireSchedules ->
 * forgetSchedules) costs the main thread while the reader drags, on the local embed (no live feeds: nothing else
 * re-lays out). The embed's host message `ark:snapshot` with the same Ark a tenth of a day later (over the read's day
 * tolerance, 0.05) takes the path a changed 45 s read takes on /ark (update -> placeRead -> layRead -> setSnapshot).
 *
 * Pinned tier (`--quality`, default high: every 8-core desktop's), a slow continuous rotate drag throughout; the scene's
 * profiler (`__arkPerfReport`) read every 2 s; rAF callbacks and long tasks recorded. `--before` s of drag, the push,
 * `--after` s of drag.
 *
 *   node scripts/.audit-drag-rewire.mjs --url <embed url> --label <name> [--quality high] [--before 30] [--after 60]
 */
import {mkdirSync, writeFileSync, existsSync, readdirSync} from "node:fs";
import os from "node:os";
import path from "node:path";

const arg = (name, fallback) => {
    const at = process.argv.indexOf(`--${name}`);
    return at > 0 && process.argv[at + 1] !== undefined && !process.argv[at + 1].startsWith("--") ? process.argv[at + 1] : fallback;
};
const url = arg("url", "http://127.0.0.1:3391/ark/embed.html?snapshot=/population-file.json&perf=1");
const label = arg("label", "rewire");
const quality = arg("quality", "high");
const beforeS = Number(arg("before", "30"));
const afterS = Number(arg("after", "60"));
const settleS = Number(arg("settle", "45"));
const outDir = path.resolve(arg("out", path.join(os.homedir(), "AnimalDex-work/ark-perf-web/scratch/drag", label)));
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
const browser = await pw.chromium.launch({
    executablePath: process.env.ARK_CHROMIUM || cachedChromium() || undefined,
    headless: true,
    args: ["--headless=new", "--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=metal", "--disable-background-timer-throttling", "--disable-renderer-backgrounding"]
});
const context = await browser.newContext({viewport: {width: 1440, height: 900}, deviceScaleFactor: 2, isMobile: false, hasTouch: false});
if (quality) await context.addInitScript((q) => { window.__arkQuality = q; }, quality);
await context.addInitScript(() => { try { Object.defineProperty(window, "PressureObserver", {value: undefined, configurable: true, writable: true}); } catch {} });
await context.addInitScript(() => {
    const rec = {frames: [], cb: [], long: []};
    window.__probe = rec;
    const raf = window.requestAnimationFrame.bind(window);
    let last = -1;
    let cb = 0;
    window.requestAnimationFrame = (fn) => raf((ts) => {
        if (ts !== last) {
            if (last >= 0) rec.cb.push([last, cb]);
            rec.frames.push(ts);
            last = ts;
            cb = 0;
        }
        const t0 = performance.now();
        try { fn(ts); } finally { cb += performance.now() - t0; }
    });
    try {
        new PerformanceObserver((list) => { for (const e of list.getEntries()) rec.long.push([e.startTime, e.duration]); }).observe({type: "longtask", buffered: true});
    } catch {}
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(String(error).slice(0, 300)));
const t0 = Date.now();
await page.goto(url, {waitUntil: "domcontentloaded", timeout: 120000});
let inViewAt = null;
while (Date.now() - t0 < 180000) {
    inViewAt = await page.evaluate(() => (typeof window.__arkPerfReport === "function" ? window.__arkPerfReport()?.inViewAt ?? null : null)).catch(() => null);
    if (inViewAt) break;
    await sleep(1000);
}
log("in view at", inViewAt, "; settle", settleS, "s");
await sleep(settleS * 1000);
const box = await page.evaluate(() => {
    const c = Array.from(document.querySelectorAll("canvas")).sort((a, b) => b.width * b.height - a.width * a.height)[0];
    const r = c.getBoundingClientRect();
    return {x: r.x, y: r.y, width: r.width, height: r.height};
});
// The same Ark a tenth of a day later, ready to push (fetched now, outside the measured window).
await page.evaluate(async () => {
    const body = await (await fetch("/population-file.json", {cache: "no-store"})).json();
    const raw = body.snapshot ?? body;
    raw.ark_day = (raw.ark_day ?? 0) + 0.1;
    if (raw.as_of) raw.as_of = new Date(Date.parse(raw.as_of) + 0.1 * 86400000).toISOString();
    window.__auditPush = {type: "ark:snapshot", snapshot: raw, founders: body.founders};
});
const samples = [];
const cx = box.x + box.width * 0.5;
const cy = box.y + box.height * 0.55;
const startAt = await page.evaluate(() => performance.now());
let pushedAt = null;
let step = 0;
let nextSample = Date.now() + 2000;
const wall0 = Date.now();
await page.mouse.move(cx - 150, cy);
await page.mouse.down();
while (Date.now() - wall0 < (beforeS + afterS) * 1000) {
    if (pushedAt === null && Date.now() - wall0 >= beforeS * 1000) {
        pushedAt = await page.evaluate(() => { window.AnimalDexArkHost.send(window.__auditPush); return performance.now(); });
        log("pushed the read at", Math.round(pushedAt), "ms");
    }
    const s = step++;
    await page.mouse.move(cx + Math.sin(s / 60) * 220, cy + Math.sin(s / 131) * 40);
    if (Date.now() >= nextSample) {
        nextSample += 2000;
        const r = await page.evaluate(() => (typeof window.__arkPerfReport === "function" ? window.__arkPerfReport() : null)).catch(() => null);
        const at = await page.evaluate(() => performance.now());
        if (r) samples.push({at, fps: r.fps, cpu: r.cpu, tier: r.tier, dpr: r.dpr, drawn: r.drawn, sections: r.sections});
    }
    await sleep(16);
}
await page.mouse.up();
const endAt = await page.evaluate(() => performance.now());
const rec = await page.evaluate(() => window.__probe);
await browser.close();
const q = (list, p) => {
    const s = [...list].sort((a, b) => a - b);
    return s.length ? Math.round(s[Math.min(s.length - 1, Math.floor(p * s.length))] * 10) / 10 : null;
};
// 5 s bins relative to the push.
const bins = [];
for (let a = startAt; a < endAt; a += 5000) {
    const b = Math.min(a + 5000, endAt);
    const frames = rec.frames.filter((t) => t >= a && t < b);
    const cbs = rec.cb.filter(([t]) => t >= a && t < b).map(([, ms]) => ms);
    const long = rec.long.filter(([t]) => t >= a && t < b);
    bins.push({fromPushS: Math.round((a - pushedAt) / 100) / 10, fps: Math.round((frames.length / ((b - a) / 1000)) * 10) / 10, rafCbMs: {p50: q(cbs, 0.5), p95: q(cbs, 0.95), max: q(cbs, 1), sum: Math.round(cbs.reduce((x, y) => x + y, 0))}, longTasks: long.length, longMs: Math.round(long.reduce((x, [, d]) => x + d, 0))});
}
const result = {url, quality, inViewAt, pushedAtMs: pushedAt, bins, perf: samples.map((s) => ({fromPushS: Math.round((s.at - pushedAt) / 100) / 10, fps: s.fps, cpuP50: s.cpu?.p50, cpuP95: s.cpu?.p95, tier: s.tier, dpr: s.dpr, drawn: s.drawn, schedule: s.sections?.schedule, resting: s.sections?.resting, town: s.sections?.town, animals: s.sections?.animals, world: s.sections?.world, render: s.sections?.render})), errors: errors.slice(0, 10)};
writeFileSync(path.join(outDir, "result.json"), JSON.stringify(result, null, 1));
console.log(JSON.stringify(result, null, 1));
