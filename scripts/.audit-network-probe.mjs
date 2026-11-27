#!/usr/bin/env node
/**
 * PERF-WEB audit, area "loading and the network": records every request of an /ark load (and, with --warm, of a
 * second load in the same browser, its HTTP cache warm), from navigation to "in view" and N s after.
 *
 * Per request: URL, CDP resource type, initiator type and top frames, priority (initial and changes), start / response /
 * end time relative to the document request, encoded bytes, status, protocol, from-cache flags, and the cache headers
 * (cf-cache-status, cache-control, age, content-encoding, etag, last-modified, retry-after, cf-ray). Requests from
 * dedicated workers come from Playwright's own events (merged in, marked `worker`).
 * Per load: navigation and paint timing, LCP, the page's `ark:load:*` marks, the profiler's `inViewAt` (?perf=1).
 *
 * Usage (from a landing worktree, for playwright-core):
 *   bash ~/AnimalDex-work/heavy.sh node scripts/.audit-network-probe.mjs --url "https://animaldex.app/ark?perf=1" \
 *        --out ~/AnimalDex-work/ark-perf-web/scratch/network/live-run --after 30 --warm --warm-after 15
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
const outDir = path.resolve(arg("out", path.join(os.homedir(), "AnimalDex-work/ark-perf-web/scratch/network/live-run")));
const afterS = Number(arg("after", "30"));
const warm = flag("warm");
const warmAfterS = Number(arg("warm-after", "15"));
const timeoutS = Number(arg("timeout", "90"));
const width = Number(arg("width", "1440"));
const height = Number(arg("height", "900"));
const dpr = Number(arg("dpr", "2"));
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
const major = browser.version().split(".")[0];
// A desktop Chrome's own UA (the headless one says HeadlessChrome, which an edge rule may treat apart).
const userAgent = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Safari/537.36`;
const context = await browser.newContext({viewport: {width, height}, deviceScaleFactor: dpr, isMobile: false, hasTouch: false, userAgent, locale: "en-US"});
await context.addInitScript(() => {
    try {
        performance.setResourceTimingBufferSize(10000);
    } catch {}
    window.__lcp = [];
    try {
        new PerformanceObserver((list) => {
            for (const e of list.getEntries()) window.__lcp.push({t: e.startTime, size: e.size, url: e.url || null, el: e.element ? e.element.tagName : null});
        }).observe({type: "largest-contentful-paint", buffered: true});
    } catch {}
    window.__long = [];
    try {
        new PerformanceObserver((list) => {
            for (const e of list.getEntries()) window.__long.push([Math.round(e.startTime), Math.round(e.duration)]);
        }).observe({type: "longtask", buffered: true});
    } catch {}
});
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
await cdp.send("Network.enable", {});

let phase = null;
const phases = [];
const byId = new Map();
const pick = (headers, name) => {
    if (!headers) return null;
    for (const [k, v] of Object.entries(headers)) if (k.toLowerCase() === name) return String(v);
    return null;
};
const frames = (stack) => {
    const out = [];
    for (let s = stack; s && out.length < 4; s = s.parent) {
        for (const f of s.callFrames || []) {
            if (out.length >= 4) break;
            out.push(`${(f.url || "").replace(/^https?:\/\/[^/]+/, "")}:${f.lineNumber}:${f.columnNumber} ${f.functionName || "(anon)"}`);
        }
    }
    return out;
};
cdp.on("Network.requestWillBeSent", (e) => {
    if (!phase) return;
    const prior = byId.get(e.requestId);
    if (prior && e.redirectResponse) {
        prior.redirects.push({url: prior.url, status: e.redirectResponse.status});
        prior.url = e.request.url;
        return;
    }
    const rec = {
        id: e.requestId,
        phase: phase.name,
        url: e.request.url,
        method: e.request.method,
        type: e.type || null,
        initiator: e.initiator?.type || null,
        initiatorUrl: e.initiator?.url ? e.initiator.url.replace(/^https?:\/\/[^/]+/, "") : null,
        stack: e.initiator?.stack ? frames(e.initiator.stack) : [],
        priority: e.request.initialPriority || null,
        priorityChanges: [],
        ts: e.timestamp,
        wall: e.wallTime,
        redirects: [],
        status: null,
        protocol: null,
        responseTs: null,
        endTs: null,
        bytes: null,
        failed: null,
        fromCache: null,
        mime: null,
        h: {},
        timing: null,
        source: "cdp"
    };
    byId.set(e.requestId, rec);
    phase.requests.push(rec);
    if (!phase.docTs && e.type === "Document") {
        phase.docTs = e.timestamp;
        phase.docWall = e.wallTime;
    }
});
cdp.on("Network.resourceChangedPriority", (e) => {
    const rec = byId.get(e.requestId);
    if (rec) rec.priorityChanges.push({to: e.newPriority, ts: e.timestamp});
});
cdp.on("Network.requestServedFromCache", (e) => {
    const rec = byId.get(e.requestId);
    if (rec) rec.fromCache = "memory-or-disk";
});
cdp.on("Network.responseReceived", (e) => {
    const rec = byId.get(e.requestId);
    if (!rec) return;
    const r = e.response;
    rec.status = r.status;
    rec.protocol = r.protocol || null;
    rec.responseTs = e.timestamp;
    rec.mime = r.mimeType || null;
    if (r.fromDiskCache) rec.fromCache = "disk";
    if (r.fromPrefetchCache) rec.fromCache = "prefetch";
    if (r.fromServiceWorker) rec.fromCache = "service-worker";
    rec.remote = r.remoteIPAddress || null;
    rec.connectionId = r.connectionId ?? null;
    rec.connectionReused = r.connectionReused ?? null;
    for (const name of ["cf-cache-status", "cache-control", "age", "content-encoding", "content-length", "etag", "last-modified", "retry-after", "cf-ray", "server", "x-nextjs-cache", "server-timing", "vary", "content-type"]) {
        const v = pick(r.headers, name);
        if (v !== null) rec.h[name] = name === "server-timing" ? v.slice(0, 200) : v;
    }
    if (r.timing) {
        const t = r.timing;
        rec.timing = {requestTime: t.requestTime, dns: t.dnsEnd >= 0 ? t.dnsEnd - t.dnsStart : null, connect: t.connectEnd >= 0 ? t.connectEnd - t.connectStart : null, ssl: t.sslEnd >= 0 ? t.sslEnd - t.sslStart : null, sendStart: t.sendStart, headers: t.receiveHeadersEnd};
    }
});
cdp.on("Network.loadingFinished", (e) => {
    const rec = byId.get(e.requestId);
    if (!rec) return;
    rec.endTs = e.timestamp;
    rec.bytes = e.encodedDataLength;
});
cdp.on("Network.loadingFailed", (e) => {
    const rec = byId.get(e.requestId);
    if (!rec) return;
    rec.endTs = e.timestamp;
    rec.failed = `${e.errorText}${e.canceled ? " (canceled)" : ""}${e.blockedReason ? ` blocked:${e.blockedReason}` : ""}`;
});

// Playwright's own view: worker requests (which the page's CDP session does not report) and a cross-check.
const pwList = [];
const onDone = async (request, failed) => {
    if (!phase) return;
    let worker = false;
    try {
        request.frame();
    } catch {
        worker = true;
    }
    let response = null;
    try {
        response = failed ? null : await request.response();
    } catch {}
    let sizes = null;
    try {
        sizes = failed ? null : await request.sizes();
    } catch {}
    const timing = request.timing();
    const h = {};
    if (response) {
        let headers = {};
        try {
            headers = await response.allHeaders();
        } catch {
            headers = response.headers();
        }
        for (const name of ["cf-cache-status", "cache-control", "age", "content-encoding", "content-length", "etag", "last-modified", "retry-after", "cf-ray", "content-type"]) {
            const v = pick(headers, name);
            if (v !== null) h[name] = v;
        }
    }
    pwList.push({phase: phase.name, url: request.url(), type: request.resourceType(), worker, start: timing.startTime, responseEnd: timing.responseEnd, status: response ? response.status() : null, failed: failed ? request.failure()?.errorText ?? "failed" : null, bytes: sizes ? sizes.responseBodySize + sizes.responseHeadersSize : null, h, fromCache: response ? await response.fromServiceWorker() : null});
};
context.on("requestfinished", (r) => void onDone(r, false));
context.on("requestfailed", (r) => void onDone(r, true));
const workers = [];
page.on("worker", (w) => workers.push({phase: phase?.name, url: w.url(), at: Date.now()}));
const errors = [];
page.on("pageerror", (error) => errors.push(String(error).slice(0, 300)));
page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") errors.push(`${msg.type()}: ${msg.text().slice(0, 300)}`);
});

async function run(name, afterSeconds) {
    phase = {name, requests: [], docTs: null, docWall: null, startedWall: Date.now() / 1000, loadavg: os.loadavg()};
    phases.push(phase);
    log(name, "open", url, `${width}x${height}@${dpr}`, `load ${os.loadavg().map((v) => v.toFixed(1)).join(" ")}`);
    const t0 = Date.now();
    await page.goto(url, {waitUntil: "domcontentloaded", timeout: 120000});
    let inViewAt = null;
    while (Date.now() - t0 < timeoutS * 1000) {
        inViewAt = await page.evaluate(() => (typeof window.__arkPerfReport === "function" ? window.__arkPerfReport()?.inViewAt ?? null : null)).catch(() => null);
        if (inViewAt) break;
        await sleep(1000);
    }
    log(name, "in view", inViewAt ? `${inViewAt} ms` : "not reported", `then ${afterSeconds} s`);
    await sleep(afterSeconds * 1000);
    phase.page = await page.evaluate(() => {
        const nav = performance.getEntriesByType("navigation")[0];
        const report = typeof window.__arkPerfReport === "function" ? window.__arkPerfReport() : null;
        return {
            timeOrigin: performance.timeOrigin,
            nav: nav ? {responseStart: nav.responseStart, responseEnd: nav.responseEnd, domInteractive: nav.domInteractive, dcl: nav.domContentLoadedEventEnd, load: nav.loadEventEnd, transferSize: nav.transferSize} : null,
            paint: performance.getEntriesByType("paint").map((p) => ({name: p.name, t: p.startTime})),
            lcp: window.__lcp || [],
            marks: performance.getEntriesByType("mark").filter((m) => /^ark/.test(m.name)).map((m) => ({name: m.name, t: m.startTime})),
            longTasks: (window.__long || []).length,
            longTaskMs: (window.__long || []).reduce((s, [, d]) => s + d, 0),
            resources: performance.getEntriesByType("resource").map((r) => ({name: r.name, initiatorType: r.initiatorType, start: r.startTime, end: r.responseEnd, transfer: r.transferSize, encoded: r.encodedBodySize, decoded: r.decodedBodySize, blocking: r.renderBlockingStatus, deliveryType: r.deliveryType, nextHop: r.nextHopProtocol})),
            report: report ? {inViewAt: report.inViewAt, tier: report.tier, dpr: report.dpr, fps: report.fps, drawn: report.drawn, mode: report.mode} : null
        };
    }).catch((error) => ({error: String(error)}));
    phase.inViewAt = inViewAt;
    phase.endedWall = Date.now() / 1000;
    phase.loadavgEnd = os.loadavg();
}

await run("cold", afterS);
if (warm) await run("warm", warmAfterS);
await sleep(1500);
phase = null;

const result = {url, userAgent, browser: browser.version(), viewport: {width, height, dpr}, phases, playwright: pwList, workers, errors: errors.slice(0, 80)};
writeFileSync(path.join(outDir, "network.json"), JSON.stringify(result));
log("saved", path.join(outDir, "network.json"), phases.map((p) => `${p.name}: ${p.requests.length} cdp requests, in view ${p.inViewAt}`).join("; "), `playwright ${pwList.length}`);
await browser.close();
