#!/usr/bin/env node
/**
 * PERF-WEB audit (drag lane, 2026-11-27), untracked helper: the page's overlays' cost during a drag, A/B in ONE page load.
 *
 * Opens a page (default the live https://animaldex.app/ark?perf=1) on a pinned tier (`--quality`, default low, so the
 * main thread is not the bottleneck and the compositor's share can show), waits for the world, then drags (rotate, one
 * move every 16 ms) in phases, each with a different injected stylesheet:
 *   asis    : the page as it is
 *   noblur  : every backdrop-filter off (`backdrop-filter: none !important` on everything)
 *   hidden  : noblur + the page's overlay grid and the scene's DOM overlays hidden (visibility: hidden)
 * in the order asis, noblur, hidden, asis, noblur, hidden. A Chrome trace (devtools.timeline + GPU) is taken across all
 * phases; per phase it reports the rAF interval and callback time (main thread), the GPU process's GPUTask ms per second
 * (the compositor's and WebGL's GPU work), the renderer main thread's style/layout/paint ms per second, and the
 * forced-layout JS callers.
 *
 *   node scripts/.audit-drag-overlays.mjs --url <url> --label <name> [--quality low] [--dpr 2] [--phase-s 10]
 * Output: <out>/result.json, printed summary. Nothing else written.
 */
import {mkdirSync, writeFileSync, existsSync, readdirSync, createWriteStream} from "node:fs";
import os from "node:os";
import path from "node:path";

const arg = (name, fallback) => {
    const at = process.argv.indexOf(`--${name}`);
    return at > 0 && process.argv[at + 1] !== undefined && !process.argv[at + 1].startsWith("--") ? process.argv[at + 1] : fallback;
};
const url = arg("url", "https://animaldex.app/ark?perf=1");
const label = arg("label", "overlays");
const dpr = Number(arg("dpr", "2"));
const quality = arg("quality", "low");
const phaseS = Number(arg("phase-s", "10"));
const noTrace = process.argv.includes("--no-trace");
const settleS = Number(arg("settle", "12"));
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
const context = await browser.newContext({viewport: {width: 1440, height: 900}, deviceScaleFactor: dpr, isMobile: false, hasTouch: false});
if (quality) await context.addInitScript((q) => { window.__arkQuality = q; }, quality);
await context.addInitScript(() => { try { Object.defineProperty(window, "PressureObserver", {value: undefined, configurable: true, writable: true}); } catch {} });
await context.addInitScript(() => {
    const rec = {frames: [], cbMs: []};
    window.__probe = rec;
    const raf = window.requestAnimationFrame.bind(window);
    let last = -1;
    let cb = 0;
    window.requestAnimationFrame = (fn) => raf((ts) => {
        if (ts !== last) {
            if (last >= 0) rec.cbMs.push([last, cb]);
            rec.frames.push(ts);
            last = ts;
            cb = 0;
        }
        const t0 = performance.now();
        try { fn(ts); } finally { cb += performance.now() - t0; }
    });
});
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
const t0 = Date.now();
log("open", url);
await page.goto(url, {waitUntil: "domcontentloaded", timeout: 120000});
let inViewAt = null;
while (Date.now() - t0 < 150000) {
    inViewAt = await page.evaluate(() => (typeof window.__arkPerfReport === "function" ? window.__arkPerfReport()?.inViewAt ?? null : null)).catch(() => null);
    if (inViewAt) break;
    await sleep(1000);
}
log("in view at", inViewAt, "ms; settling", settleS, "s");
await sleep(settleS * 1000);
const box = await page.evaluate(() => {
    const c = Array.from(document.querySelectorAll("canvas")).sort((a, b) => b.width * b.height - a.width * a.height)[0];
    const r = c.getBoundingClientRect();
    return {x: r.x, y: r.y, width: r.width, height: r.height};
});
// The desktop /ark page's glass, emulated for a page without it (the local embed): at md+ the population panel is open by
// default (ark-population-hud.tsx 266-267, 273: column 2, rows 1-2, self-start, max-h-full; 288: .ark-glass, md:w-[19rem])
// and fills the right column to the grid's bottom padding (ark-view.tsx 1267: p-3, pb 4rem) = 304 x 824 CSS px at
// 1440 x 900; the world tools bar (ark-world-tools.tsx 137: .ark-glass, max-w-[34rem], rounded-2xl) top left, 544 x 52.
// Hidden unless a phase shows it; never takes the pointer.
await page.evaluate(() => {
    const host = document.createElement("div");
    host.id = "__audit_glass";
    host.style.cssText = "display:none;position:fixed;inset:0;pointer-events:none;z-index:5;";
    const glass = "position:absolute;background:rgba(20,24,22,0.55);-webkit-backdrop-filter:blur(22px) saturate(160%);backdrop-filter:blur(22px) saturate(160%);box-shadow:inset 0 1px 0 rgba(255,255,255,0.07),0 12px 32px -14px rgba(0,0,0,0.6);border:1px solid rgba(255,255,255,0.14);border-radius:16px;";
    for (const css of ["right:12px;top:12px;width:304px;height:824px;", "left:12px;top:12px;width:544px;height:52px;"]) {
        const d = document.createElement("div");
        d.style.cssText = glass + css;
        host.appendChild(d);
    }
    document.body.appendChild(host);
});
const OFF = "{ -webkit-backdrop-filter: none !important; backdrop-filter: none !important; }";
const STYLES = {
    asis: "",
    noblur: `*, *::before, *::after ${OFF}`,
    hidden: `*, *::before, *::after ${OFF} .pointer-events-none.absolute.inset-0, [data-ark-live], #ark-ui, #ark-sound, .cursor-trail, div[aria-hidden='true'][style*='pointer-events: none'] { visibility: hidden !important; }`,
    // The page's own glass (globals.css .ark-glass / .ark-card-glass, Tailwind backdrop-blur-*), outside the scene's element.
    pageoff: `.ark-glass, .ark-card-glass, [class*='backdrop-blur'] ${OFF}`,
    // The scene's own DOM (badges, labels, its runtime and live panels): everything inside the canvas's own parent.
    sceneoff: `:has(> canvas) *:not(canvas) ${OFF}`,
    // The emulated page glass shown (blurred), and shown flat (the same fill, no backdrop-filter).
    glass: "#__audit_glass { display: block !important; }",
    flat: `#__audit_glass { display: block !important; } #__audit_glass * ${OFF}`
};
const setStyle = (css) => page.evaluate((text) => {
    let el = document.getElementById("__audit_style");
    if (!el) { el = document.createElement("style"); el.id = "__audit_style"; document.head.appendChild(el); }
    el.textContent = text;
}, css);
// The trace: the timeline's own events (style, layout, paint, GPU tasks), with JS stacks for forced layouts.
const traceFile = path.join(outDir, "trace.json");
const categories = ["devtools.timeline", "disabled-by-default-devtools.timeline", "disabled-by-default-devtools.timeline.stack"].join(",");
if (!noTrace) await cdp.send("Tracing.start", {transferMode: "ReturnAsStream", traceConfig: {recordMode: "recordContinuously", includedCategories: categories.split(","), excludedCategories: ["*"]}});
const phases = [];
const order = arg("phases", "asis,noblur,hidden,asis,noblur,hidden").split(",");
const cx = box.x + box.width * 0.5;
const cy = box.y + box.height * 0.55;
for (const [k, name] of order.entries()) {
    await setStyle(STYLES[name]);
    await sleep(500);
    const blurred = await page.evaluate(() => {
        let n = 0, area = 0;
        for (const el of document.querySelectorAll("*")) {
            const cs = getComputedStyle(el);
            const f = cs.backdropFilter && cs.backdropFilter !== "none" ? cs.backdropFilter : cs.webkitBackdropFilter && cs.webkitBackdropFilter !== "none" ? cs.webkitBackdropFilter : null;
            if (!f || cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) === 0) continue;
            const r = el.getBoundingClientRect();
            const w = Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0));
            const h = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0));
            if (w * h <= 0) continue;
            n++;
            area += w * h;
        }
        return {n, cssPx: Math.round(area), share: Math.round((area / (innerWidth * innerHeight)) * 1000) / 10};
    });
    const at = await page.evaluate((n) => { console.timeStamp(`audit:${n}:start`); return performance.now(); }, `${name}${k >= order.length / 2 ? "2" : "1"}`);
    const wall0 = Date.now();
    await page.mouse.move(cx - 200, cy);
    await page.mouse.down();
    let step = 0;
    const lat = [];
    while (Date.now() - wall0 < phaseS * 1000) {
        const s = step++;
        const x = cx + Math.sin(s / 40) * 260;
        const y = cy + Math.sin(s / 97) * 60;
        const m0 = Date.now();
        await page.mouse.move(x, y);
        lat.push(Date.now() - m0);
        await sleep(Math.max(0, 16 - (Date.now() - m0)));
    }
    await page.mouse.up();
    const end = await page.evaluate((n) => { console.timeStamp(`audit:${n}:end`); return performance.now(); }, `${name}${k >= order.length / 2 ? "2" : "1"}`);
    phases.push({name: `${name}${k >= order.length / 2 ? "2" : "1"}`, kind: name, at, end, moves: step, ack: lat, blurred});
    log("phase", name, "moves", step);
}
await setStyle("");
// Trace out.
if (!noTrace) {
const done = new Promise((resolve) => cdp.once("Tracing.tracingComplete", resolve));
await cdp.send("Tracing.end");
const {stream} = await done;
const out = createWriteStream(traceFile);
for (;;) {
    const chunk = await cdp.send("IO.read", {handle: stream, size: 1 << 20});
    out.write(chunk.base64Encoded ? Buffer.from(chunk.data, "base64") : chunk.data);
    if (chunk.eof) break;
}
await new Promise((r) => out.end(r));
await cdp.send("IO.close", {handle: stream});
}
const rec = await page.evaluate(() => window.__probe);
const report = await page.evaluate(() => (typeof window.__arkPerfReport === "function" ? window.__arkPerfReport() : null)).catch(() => null);
const navStart = await page.evaluate(() => performance.timeOrigin);
await browser.close();

// Per phase: rAF.
const q = (list, p) => {
    const s = [...list].sort((a, b) => a - b);
    return s.length ? Math.round(s[Math.min(s.length - 1, Math.floor(p * s.length))] * 10) / 10 : null;
};
const result = {url, quality, dpr, inViewAt, tier: report?.tier, reportDpr: report?.dpr, phases: []};
// Trace events: parse (one JSON object with traceEvents, or an array).
const {readFileSync} = await import("node:fs");
let events = noTrace ? [] : JSON.parse(readFileSync(traceFile, "utf8"));
events = Array.isArray(events) ? events : events.traceEvents;
// Process names.
const procName = new Map();
for (const e of events) if (e.ph === "M" && e.name === "process_name") procName.set(e.pid, e.args?.name);
const threadName = new Map();
for (const e of events) if (e.ph === "M" && e.name === "thread_name") threadName.set(`${e.pid}:${e.tid}`, e.args?.name);
// The renderer main thread: the one with the most rAF ("FireAnimationFrame") events.
const fire = new Map();
for (const e of events) if (e.name === "FireAnimationFrame") fire.set(`${e.pid}:${e.tid}`, (fire.get(`${e.pid}:${e.tid}`) ?? 0) + 1);
const mainKey = Array.from(fire.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
// Phase windows in trace time, from the page's own console.timeStamp markers.
const marks = new Map();
for (const e of events) {
    const msg = e.name === "TimeStamp" ? e.args?.data?.message : null;
    if (msg && msg.startsWith("audit:")) marks.set(msg, e.ts / 1000);
}
const offset = marks.size ? 0 : null;
const sumIn = (filter, a, b) => {
    let ms = 0, n = 0;
    for (const e of events) {
        if (e.ph !== "X" || !filter(e)) continue;
        const t = e.ts / 1000;
        if (t < a || t > b) continue;
        ms += (e.dur ?? 0) / 1000;
        n++;
    }
    return {ms, n};
};
const gpuPids = new Set(Array.from(procName.entries()).filter(([, n]) => /GPU/i.test(n ?? "")).map(([pid]) => pid));
const forced = new Map();
for (const ph of phases) {
    const frames = rec.frames.filter((t) => t >= ph.at && t <= ph.end);
    const intervals = frames.slice(1).map((t, i) => t - frames[i]);
    const cbs = rec.cbMs.filter(([t]) => t >= ph.at && t <= ph.end).map(([, ms]) => ms);
    const secs = (ph.end - ph.at) / 1000;
    const row = {
        phase: ph.name,
        seconds: Math.round(secs * 10) / 10,
        fps: Math.round((frames.length / secs) * 10) / 10,
        intervalMs: {p50: q(intervals, 0.5), p95: q(intervals, 0.95), max: q(intervals, 1)},
        rafCallbackMs: {p50: q(cbs, 0.5), p95: q(cbs, 0.95)},
        moveAckMs: {p50: q(ph.ack, 0.5), p95: q(ph.ack, 0.95)},
        blurred: ph.blurred
    };
    const ta = marks.get(`audit:${ph.name}:start`), tb = marks.get(`audit:${ph.name}:end`);
    if (ta !== undefined && tb !== undefined) {
        const tsecs = (tb - ta) / 1000;
        const per = (x) => Math.round((x.ms / tsecs) * 10) / 10;
        const onMain = (names) => (e) => `${e.pid}:${e.tid}` === mainKey && names.includes(e.name);
        row.mainMsPerSecond = {
            style: per(sumIn(onMain(["UpdateLayoutTree", "RecalculateStyles"]), ta, tb)),
            layout: per(sumIn(onMain(["Layout"]), ta, tb)),
            paint: per(sumIn(onMain(["Paint", "PaintImage"]), ta, tb)),
            prePaint: per(sumIn(onMain(["PrePaint", "UpdateLayerTree", "Layerize", "Commit"]), ta, tb))
        };
        row.gpuTaskMsPerSecond = per(sumIn((e) => e.name === "GPUTask", ta, tb));
        row.gpuTaskMsPerFrame = row.fps ? Math.round((row.gpuTaskMsPerSecond / row.fps) * 100) / 100 : null;
        row.layoutCount = sumIn(onMain(["Layout"]), ta, tb).n;
        row.styleCount = sumIn(onMain(["UpdateLayoutTree", "RecalculateStyles"]), ta, tb).n;
    }
    result.phases.push(row);
}
// Forced layouts/styles and who forced them (the JS stack's top frame), whole drag.
if (offset !== null) {
    const a = marks.get(`audit:${phases[0].name}:start`), b = marks.get(`audit:${phases[phases.length - 1].name}:end`);
    for (const e of events) {
        if (e.ph !== "X" || `${e.pid}:${e.tid}` !== mainKey || !["Layout", "UpdateLayoutTree"].includes(e.name)) continue;
        const t = e.ts / 1000;
        if (t < a || t > b) continue;
        const stack = e.args?.beginData?.stackTrace ?? e.args?.data?.stackTrace;
        const top = stack && stack.length ? `${stack[0].functionName || "(anon)"} ${String(stack[0].url).split("/").pop()}:${stack[0].lineNumber}` : "(not forced: the frame's own)";
        const key = `${e.name} <- ${top}`;
        const v = forced.get(key) ?? {n: 0, ms: 0};
        v.n++;
        v.ms += (e.dur ?? 0) / 1000;
        forced.set(key, v);
    }
    result.forced = Array.from(forced.entries()).sort((x, y) => y[1].ms - x[1].ms).slice(0, 15).map(([k, v]) => ({who: k, n: v.n, ms: Math.round(v.ms)}));
}
result.marks = marks.size;
result.gpuProcesses = Array.from(gpuPids).map((pid) => procName.get(pid));
result.gpuTaskEvents = events.filter((e) => e.name === "GPUTask").length;
writeFileSync(path.join(outDir, "result.json"), JSON.stringify(result, null, 1));
console.log(JSON.stringify(result, null, 1));
