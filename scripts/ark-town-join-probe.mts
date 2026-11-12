// The town's join time in the apps' embed (Part C, decision 153): from the page's start to the first frame, the town's
// worker asked, its answer, the sliced build and the attach, with each worker step (`ark:town:joined`, a User Timing
// mark that a production bundle sets too) and the long main-thread tasks around them. Development only: run against a
// static server of the built `public/ark/` (or `next start`) with a local snapshot and T1's routing.
//
//   ARK_BASE=http://localhost:3410 ARK_PROFILE=phone npx tsx scripts/ark-town-join-probe.mts
//
// ARK_PROFILE: desktop (1440x900) or phone (360x800, DPR 2, touch, 4x CPU: the runtime docs' phone profile).
// ARK_THROTTLE: the phone's CPU rate (default 4; 1 for none). ARK_QUERY: the embed's query.
import {existsSync, readdirSync} from "node:fs";
import os from "node:os";
import path from "node:path";

const base = process.env.ARK_BASE ?? "http://localhost:3410";
const profile = process.env.ARK_PROFILE === "phone" ? "phone" : "desktop";
const rate = Number(process.env.ARK_THROTTLE ?? (profile === "phone" ? "4" : "1"));
const query = process.env.ARK_QUERY ?? "snapshot=/ark-local/live.json&islands=/ark-local/islands-routing.json&regions=1&lang=en";
const cache = path.join(os.homedir(), "Library", "Caches", "ms-playwright");
const chrome = readdirSync(cache).filter((e) => /^chromium-\d+$/.test(e)).sort().reverse().map((n) => path.join(cache, n, "chrome-mac-arm64", "Google Chrome for Testing.app", "Contents", "MacOS", "Google Chrome for Testing")).find((p) => existsSync(p));
const {chromium} = await import("playwright-core");
const browser = await chromium.launch({executablePath: chrome, headless: true, args: ["--headless=new", "--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=metal", "--disable-background-timer-throttling", "--disable-renderer-backgrounding"]});
const context = await browser.newContext(profile === "phone" ? {viewport: {width: 360, height: 800}, deviceScaleFactor: 2, isMobile: true, hasTouch: true} : {viewport: {width: 1440, height: 900}, deviceScaleFactor: 1});
const page = await context.newPage();
if (rate > 1) await (await context.newCDPSession(page)).send("Emulation.setCPUThrottlingRate", {rate});
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
// (Strings, not functions: tsx's helpers do not exist in the page.) The host bridge, timed; the long tasks.
await page.addInitScript(`
  window.__told = [];
  window.AndroidArk = {postMessage: function (text) { try { window.__told.push({type: JSON.parse(text).type, at: Math.round(performance.now())}); } catch (e) {} }};
  window.__longTasks = [];
  try { new PerformanceObserver(function (list) { list.getEntries().forEach(function (e) { window.__longTasks.push({at: Math.round(e.startTime), ms: Math.round(e.duration)}); }); }).observe({type: "longtask", buffered: true}); } catch (e) {}
`);
await page.goto(`${base}/ark/embed.html?${query}`, {waitUntil: "domcontentloaded"});
const deadline = Date.now() + 15 * 60_000;
let joined: {startTime: number; detail: Record<string, unknown> | null} | null = null;
while (!joined && Date.now() < deadline) {
    await page.waitForTimeout(500);
    joined = await page.evaluate(() => {
        const mark = performance.getEntriesByName("ark:town:joined")[0] as PerformanceMark | undefined;
        return mark ? {startTime: Math.round(mark.startTime), detail: (mark.detail as Record<string, unknown>) ?? null} : null;
    });
}
await page.waitForTimeout(3000);
const told = (await page.evaluate(() => (window as any).__told)) as Array<{type: string; at: number}>;
const tasks = (await page.evaluate(() => (window as any).__longTasks)) as Array<{at: number; ms: number}>;
const firstFrame = told.find((m) => m.type === "ark:ready")?.at ?? null;
const d = (joined?.detail ?? {}) as {askedAt?: number; builtAt?: number; attachAt?: number; joinedAt?: number; worker?: {ms: number; steps: Record<string, number>; collectedAfter: number; waited: number; prime: number}; build?: number; attach?: number; load?: unknown; loadWall?: number; meshesAt?: number; afterFirstFrame?: unknown; wildPreparedAt?: number; colliders?: number; sampler?: number};
const longest = (from: number, to: number) => {
    const inside = tasks.filter((t) => t.at >= from && t.at < to);
    return {count: inside.length, longest: inside.reduce((m, t) => Math.max(m, t.ms), 0)};
};
const result = {
    profile,
    rate,
    errors,
    firstFrame,
    joined: joined?.startTime ?? null,
    askedAt: d.askedAt ?? null,
    worker: d.worker ?? null,
    build: d.build ?? null,
    load: d.load ?? null,
    loadWall: d.loadWall ?? null,
    meshesAt: d.meshesAt ?? null,
    wildPreparedAt: d.wildPreparedAt ?? null,
    afterFirstFrame: d.afterFirstFrame ?? null,
    colliders: d.colliders ?? null,
    sampler: d.sampler ?? null,
    attach: d.attach ?? null,
    tasksBeforeFirstFrame: firstFrame === null ? null : longest(0, firstFrame),
    tasksFirstFrameToJoined: firstFrame === null || !joined ? null : longest(firstFrame, joined.startTime + (d.attach ?? 0) + 1),
    hardwareConcurrency: await page.evaluate(() => navigator.hardwareConcurrency)
};
console.log(JSON.stringify(result));
await browser.close();
