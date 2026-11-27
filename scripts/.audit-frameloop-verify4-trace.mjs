#!/usr/bin/env node
/**
 * FRAME-4 verifier (PERF-WEB audit, 2026-11-27): is there main-thread idle BETWEEN frames during the start's
 * background builds, with no sampling profiler on? A Chrome trace (toplevel + devtools.timeline) of an auto start of the
 * local embed, from navigation for `--seconds`, plus the scene's own 2 s report. No GPU timer queries, no profiler,
 * PressureObserver removed (as probe-drag.mjs does).
 *
 *   node scripts/.audit-frameloop-verify4-trace.mjs --url <embed url> --out <dir> [--seconds 60] [--dpr 2]
 */
import {mkdirSync, writeFileSync, existsSync, readdirSync} from "node:fs";
import os from "node:os";
import path from "node:path";

const arg = (name, fallback) => {
    const at = process.argv.indexOf(`--${name}`);
    return at > 0 && process.argv[at + 1] !== undefined ? process.argv[at + 1] : fallback;
};
const url = arg("url", "http://127.0.0.1:3390/ark/embed.html?snapshot=/population-file.json&perf=1");
const outDir = path.resolve(arg("out", "."));
const seconds = Number(arg("seconds", "60"));
const dpr = Number(arg("dpr", "2"));
mkdirSync(outDir, {recursive: true});
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const log = (...parts) => console.log(new Date().toISOString().slice(11, 19), ...parts);

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
    args: ["--headless=new", "--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=metal", "--enable-precise-memory-info", "--disable-background-timer-throttling", "--disable-renderer-backgrounding"]
});
const context = await browser.newContext({viewport: {width: 1440, height: 900}, deviceScaleFactor: dpr, isMobile: false, hasTouch: false});
await context.addInitScript(() => {
    try {
        Object.defineProperty(window, "PressureObserver", {value: undefined, configurable: true, writable: true});
    } catch {}
});
const page = await context.newPage();
const timeline = [];
await browser.startTracing(page, {screenshots: false, categories: ["toplevel", "devtools.timeline", "disabled-by-default-devtools.timeline.frame"]});
const t0 = Date.now();
let sampling = true;
const poller = (async () => {
    while (sampling) {
        const r = await page
            .evaluate(() => {
                if (typeof window.__arkPerfReport !== "function") return null;
                const x = window.__arkPerfReport();
                const s = x.sections || {};
                const now = performance.now();
                // (A trace marker to line the report up with the trace's clock.)
                console.timeStamp(`v4:${Math.round(now)}`);
                return {now, fps: x.fps, cpu50: x.cpu?.p50, cpu95: x.cpu?.p95, tier: x.tier, dpr: x.dpr, mode: x.mode, inViewAt: x.inViewAt ?? null, world: s.world, render: s.render, town: s.town, schedule: s.schedule, resting: s.resting, interval: x.interval};
            })
            .catch(() => null);
        if (r) timeline.push({t: Math.round((Date.now() - t0) / 100) / 10, ...r});
        await sleep(2000);
    }
})();
log("open", url);
await page.goto(url, {waitUntil: "domcontentloaded", timeout: 120000});
while (Date.now() - t0 < seconds * 1000) await sleep(250);
sampling = false;
await poller;
const buffer = await browser.stopTracing();
writeFileSync(path.join(outDir, "trace.json"), buffer);
writeFileSync(path.join(outDir, "timeline.json"), JSON.stringify(timeline, null, 1));
log("trace", (buffer.length / 1e6).toFixed(1), "MB; timeline", timeline.length);
await browser.close();
