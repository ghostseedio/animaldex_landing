#!/usr/bin/env node
/**
 * FRAME-3 verifier probe (PERF-WEB audit 2026-11-27, untracked helper; not product code).
 *
 * Question: in the first minute on the high tier at DPR 2, is the main thread idle between frames (a GPU bound, as
 * FRAME-3 claims) or full (a main-thread bound)? And what does the same start give on the low tier (`--quality low`),
 * the best case of an early tier drop?
 *
 * Per 2 s window from navigation: the browser's animation-frame ticks; the ticks the scene drew in (any WebGL draw call in
 * the tick); the summed time of every rAF callback in the window (the scene's frame AND the props/attach slices that run
 * as their own rAF callbacks); long animation frames (LoAF: all main-thread work of frames over 50 ms); long tasks; the
 * scene's own `__arkPerfReport` (tier, dpr, mode, its frame callback's cpu). An optional rotate drag from `--start-after`
 * for `--drag-seconds` (the reader who drags at once), with each CDP mouse move's ack time.
 * No JS profiler and no GPU timer queries (both perturb the main thread).
 *
 *   node scripts/.audit-frameloop-v3-probe.mjs --label high --start-after 12 [--quality low] [--seconds 70]
 */
import {mkdirSync, writeFileSync, existsSync, readdirSync} from "node:fs";
import {execSync} from "node:child_process";
import os from "node:os";
import path from "node:path";

const arg = (name, fallback) => {
    const at = process.argv.indexOf(`--${name}`);
    return at > 0 && process.argv[at + 1] !== undefined && !process.argv[at + 1].startsWith("--") ? process.argv[at + 1] : fallback;
};
const url = arg("url", "http://127.0.0.1:3390/ark/embed.html?snapshot=/population-file.json&perf=1");
const label = arg("label", "frame3");
const dpr = Number(arg("dpr", "2"));
const width = Number(arg("width", "1440"));
const height = Number(arg("height", "900"));
const quality = arg("quality", "");
const startAfter = Number(arg("start-after", "12"));
const dragSeconds = Number(arg("drag-seconds", "22"));
const totalS = Number(arg("seconds", "70"));
const outDir = path.resolve(arg("out", path.join(os.homedir(), "AnimalDex-work/ark-perf-web/scratch/frameloop-verify-frame3", label)));
mkdirSync(outDir, {recursive: true});
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const load = () => {
    try {
        return execSync("uptime").toString().trim();
    } catch {
        return "";
    }
};
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

const loadAtStart = load();
const pw = await import("playwright-core");
const browser = await pw.chromium.launch({
    executablePath: cachedChromium() || undefined,
    headless: true,
    args: ["--headless=new", "--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=metal", "--enable-precise-memory-info", "--disable-background-timer-throttling", "--disable-renderer-backgrounding"]
});
const context = await browser.newContext({viewport: {width, height}, deviceScaleFactor: dpr, isMobile: false, hasTouch: false});
if (quality) await context.addInitScript((q) => { window.__arkQuality = q; }, quality);
// Measuring the scene, not this shared Mac's load: no Compute Pressure (as probe-drag.mjs).
await context.addInitScript(() => { try { Object.defineProperty(window, "PressureObserver", {value: undefined, configurable: true, writable: true}); } catch {} });
await context.addInitScript(() => {
    const rec = {ticks: [], loaf: [], long: [], drew: false, loafOk: false};
    window.__f3 = rec;
    for (const proto of [window.WebGL2RenderingContext?.prototype, window.WebGLRenderingContext?.prototype]) {
        if (!proto) continue;
        for (const name of ["drawElements", "drawArrays", "drawElementsInstanced", "drawArraysInstanced", "drawRangeElements"]) {
            const original = proto[name];
            if (typeof original !== "function") continue;
            proto[name] = function (...args) {
                rec.drew = true;
                return original.apply(this, args);
            };
        }
    }
    const raf = window.requestAnimationFrame.bind(window);
    let tickTs = -1;
    let tickCb = 0;
    let tickDrew = false;
    window.requestAnimationFrame = (cb) => raf((ts) => {
        if (ts !== tickTs) {
            if (tickTs >= 0) rec.ticks.push([tickTs, tickCb, tickDrew ? 1 : 0]);
            tickTs = ts;
            tickCb = 0;
            tickDrew = false;
        }
        rec.drew = false;
        const t0 = performance.now();
        try {
            cb(ts);
        } finally {
            tickCb += performance.now() - t0;
            if (rec.drew) tickDrew = true;
        }
    });
    try {
        new PerformanceObserver((list) => {
            for (const e of list.getEntries()) {
                let scripts = 0;
                let rafScripts = 0;
                for (const s of e.scripts || []) {
                    scripts += s.duration;
                    if (s.invokerType === "user-callback") rafScripts += s.duration;
                }
                rec.loaf.push([e.startTime, e.duration, e.blockingDuration ?? 0, e.renderStart ?? 0, e.styleAndLayoutStart ?? 0, scripts, rafScripts]);
            }
        }).observe({type: "long-animation-frame", buffered: true});
        rec.loafOk = true;
    } catch {}
    try {
        new PerformanceObserver((list) => {
            for (const e of list.getEntries()) rec.long.push([e.startTime, e.duration]);
        }).observe({type: "longtask", buffered: true});
    } catch {}
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(String(error)));
const timeline = [];
let sampling = true;
const navAt = Date.now();
(async () => {
    while (sampling) {
        const r = await page.evaluate(() => {
            if (typeof window.__arkPerfReport !== "function") return null;
            const x = window.__arkPerfReport();
            const top = Object.entries(x.sections || {}).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k}:${Math.round(v * 10) / 10}`).join(" ");
            return {now: performance.now(), inViewAt: x.inViewAt ?? null, fps: x.fps, cpu50: x.cpu?.p50, cpuMean: x.cpu?.mean, tier: x.tier, dpr: x.dpr, mode: x.mode, calls: x.gpu?.calls, tris: x.gpu?.triangles, heap: x.heapMB, top};
        }).catch(() => null);
        if (r) timeline.push({t: Math.round(r.now / 100) / 10, ...r});
        await sleep(2000);
    }
})();
log("open", url, `${width}x${height}@${dpr}`, quality ? `pinned ${quality}` : "unpinned", "|", loadAtStart);
await page.goto(url, {waitUntil: "domcontentloaded", timeout: 120000});
const navNow = await page.evaluate(() => performance.now());
const inputAcks = [];
const waitUntil = async (s) => {
    while ((await page.evaluate(() => performance.now())) < s * 1000) await sleep(100);
};
await waitUntil(startAfter);
if (dragSeconds > 0) {
    const box = await page.evaluate(() => {
        const cs = [...document.querySelectorAll("canvas")].map((c) => c.getBoundingClientRect());
        cs.sort((a, b) => b.width * b.height - a.width * a.height);
        return cs[0] ? {x: cs[0].x, y: cs[0].y, w: cs[0].width, h: cs[0].height} : null;
    });
    if (box) {
        log("drag from", startAfter, "s for", dragSeconds, "s");
        const until = Date.now() + dragSeconds * 1000;
        let dir = 1;
        while (Date.now() < until) {
            const y = box.y + box.h * 0.5;
            const xa = box.x + box.w * (dir > 0 ? 0.3 : 0.7);
            const xb = box.x + box.w * (dir > 0 ? 0.7 : 0.3);
            await page.mouse.move(xa, y);
            await page.mouse.down();
            const steps = 100;
            for (let i = 1; i <= steps && Date.now() < until; i++) {
                const s = performance.now();
                await page.mouse.move(xa + ((xb - xa) * i) / steps, y);
                const took = performance.now() - s;
                inputAcks.push([Date.now() - navAt, took]);
                if (took < 16) await sleep(16 - took);
            }
            await page.mouse.up();
            dir = -dir;
            await sleep(150);
        }
    }
}
await waitUntil(totalS);
sampling = false;
const rec = await page.evaluate(() => ({ticks: window.__f3.ticks, loaf: window.__f3.loaf, long: window.__f3.long, loafOk: window.__f3.loafOk}));
const loadAtEnd = load();
await browser.close();

// Per 2 s window (ms from navigation: rAF timestamps, LoAF and long tasks share performance.now's origin).
const W = 2000;
const q = (list, share) => {
    if (!list.length) return null;
    const s = [...list].sort((a, b) => a - b);
    return Math.round(s[Math.min(s.length - 1, Math.floor(share * s.length))] * 10) / 10;
};
const clip = (start, dur, a, b) => Math.max(0, Math.min(start + dur, b) - Math.max(start, a));
const windows = [];
const drawnTs = rec.ticks.filter((t) => t[2]).map((t) => t[0]);
for (let a = 0; a < totalS * 1000; a += W) {
    const b = a + W;
    const ticks = rec.ticks.filter((t) => t[0] >= a && t[0] < b);
    if (!ticks.length) continue;
    const cbSum = ticks.reduce((s, t) => s + t[1], 0);
    const drawn = ticks.filter((t) => t[2]);
    const drawnIntervals = [];
    for (let i = 1; i < drawnTs.length; i++) if (drawnTs[i] >= a && drawnTs[i] < b) drawnIntervals.push(drawnTs[i] - drawnTs[i - 1]);
    const loafSum = rec.loaf.reduce((s, e) => s + clip(e[0], e[1], a, b), 0);
    const longSum = rec.long.reduce((s, e) => s + clip(e[0], e[1], a, b), 0);
    const tl = timeline.filter((e) => e.now >= a && e.now < b + 1000).at(-1) ?? timeline.filter((e) => e.now < b).at(-1);
    const acks = inputAcks.filter(([t]) => t >= a && t < b).map(([, ms]) => ms);
    // The finding's early verdict, as it would judge this window: drawn intervals' median > 40 ms and the main thread's
    // busy share of the window < 0.5 (busy from the rAF callbacks; and from LoAF, which also holds the other tasks).
    const med = q(drawnIntervals, 0.5);
    windows.push({
        t: a / 1000,
        tier: tl ? `${tl.tier}/${tl.dpr}` : "",
        mode: tl?.mode ?? "",
        ticks: ticks.length,
        drawnFps: Math.round((drawn.length / (W / 1000)) * 10) / 10,
        drawnInt50: med,
        rafCbShare: Math.round((cbSum / W) * 1000) / 10,
        rafCbPerDrawn: drawn.length ? Math.round((cbSum / drawn.length) * 10) / 10 : null,
        loafShare: Math.round((loafSum / W) * 1000) / 10,
        longShare: Math.round((longSum / W) * 1000) / 10,
        sceneCpu50: tl?.cpu50 ?? null,
        sceneCpuMean: tl?.cpuMean ?? null,
        ack50: q(acks, 0.5),
        ack95: q(acks, 0.95),
        earlyVerdictByRaf: med !== null && med > 40 && cbSum / W < 0.5,
        earlyVerdictByLoaf: med !== null && med > 40 && loafSum / W < 0.5,
        earlyVerdictBySceneCpu: med !== null && med > 40 && tl?.cpu50 != null && tl.cpu50 < 0.5 * med,
        top: tl?.top ?? ""
    });
}
const result = {label, url, quality, viewport: {width, height, dpr}, startAfter, dragSeconds, loadAtStart, loadAtEnd, loafOk: rec.loafOk, navNow, windows, timeline, errors: errors.slice(0, 20), ticks: rec.ticks.length, loafCount: rec.loaf.length};
writeFileSync(path.join(outDir, "result.json"), JSON.stringify(result, null, 1));
console.log(`${label} (${quality || "unpinned"}) load start: ${loadAtStart}\n  end: ${loadAtEnd}\n  LoAF ${rec.loafOk ? "on" : "off"}, ${rec.loaf.length} entries`);
console.log("   t  tier       mode  ticks drawnFps int50 rafCb% cb/drawn loaf% long% cpu50 cpuMean ack50 ack95  verdict(raf/loaf/sceneCpu)  top");
for (const w of windows) {
    console.log(`${String(w.t).padStart(4)}  ${w.tier.padEnd(10)} ${String(w.mode).padEnd(5)} ${String(w.ticks).padStart(5)} ${String(w.drawnFps).padStart(8)} ${String(w.drawnInt50).padStart(5)} ${String(w.rafCbShare).padStart(6)} ${String(w.rafCbPerDrawn).padStart(8)} ${String(w.loafShare).padStart(5)} ${String(w.longShare).padStart(5)} ${String(w.sceneCpu50).padStart(5)} ${String(w.sceneCpuMean).padStart(7)} ${String(w.ack50).padStart(5)} ${String(w.ack95).padStart(5)}  ${w.earlyVerdictByRaf ? "Y" : "n"}/${w.earlyVerdictByLoaf ? "Y" : "n"}/${w.earlyVerdictBySceneCpu ? "Y" : "n"}  ${w.top}`);
}
