#!/usr/bin/env node
/**
 * Ark scale runs (AnimalDex docs/ark/captures-backfill-dry-run.md section 4): the live scene on
 * the captures-backfill population (1x) and 3x, per device, with load time, frame interval
 * p50/p95, draw calls, triangles, JS heap, long tasks and the herd/near/far counts.
 *
 * Builds the golden page (src/ark-scene/golden-entry.ts, `?population=`) into .ark-golden/site,
 * serves it with the population snapshots from scripts/ark-scale-fixture.mts, and drives
 * Playwright's cached Chromium, ONE browser at a time.
 *
 *   npx tsx scripts/ark-scale-fixture.mts <AnimalDex>/scripts/ark/fixtures/captures-population.json
 *   nice -n 10 node scripts/ark-scale-run.mjs --label scale --populations fixture,1x,3x --devices desktop,phone
 *   options: --places island_far,house_fields,...  --measure 3000  --port 3216  --desktop-quality high
 *            --phone-quality auto  --gpu metal|swiftshader  --out <dir>
 *
 * On a real phone (the owner's mid-range Android, same Wi-Fi as this Mac): build and serve only, on every interface:
 *   node scripts/ark-scale-run.mjs --serve-only --host 0.0.0.0
 *   then open http://<this Mac's LAN IP>:3216/golden.html?population=population-1x.json (or -3x, or no query for the
 *   130-animal fixture) in Chrome, or in the app's WebView. window.__arkGolden.measure(3000) and .timing() give the
 *   numbers in remote DevTools (chrome://inspect).
 *
 * Devices (as scripts/ark-golden-shots.mjs):
 *   desktop  1440x900 DPR 1, no throttle, host GPU, quality pinned (default high)
 *   phone    360x800 DPR 2, Android UA, 8 cores / 4 GB reported, 4x CPU throttle, the tier the scene picks
 */

import {createServer} from "node:http";
import {existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync} from "node:fs";
import os from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {build} from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name, fallback) => {
    const at = process.argv.indexOf(`--${name}`);
    return at > 0 && process.argv[at + 1] && !process.argv[at + 1].startsWith("--") ? process.argv[at + 1] : fallback;
};
const DEVICES = {
    desktop: {viewport: {width: 1440, height: 900}, deviceScaleFactor: 1, isMobile: false, hasTouch: false, cpuThrottle: 1},
    phone: {
        viewport: {width: 360, height: 800}, deviceScaleFactor: 2, isMobile: true, hasTouch: true, cpuThrottle: 4,
        userAgent: "Mozilla/5.0 (Linux; Android 14; SM-A356B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36"
    }
};
const log = (...parts) => console.log(new Date().toISOString().slice(11, 19), ...parts);
const label = arg("label", "scale");
const out = path.resolve(arg("out", path.join(root, ".ark-golden", "scale", label)));
const devices = arg("devices", "desktop,phone").split(",").filter((d) => DEVICES[d]);
const populations = arg("populations", "fixture,1x,3x").split(",");
const places = arg("places", "island_far,house_fields,forest_floor,river_pond").split(",");
const measureMs = Number(arg("measure", "3000"));
const port = Number(arg("port", "3216"));
const gpu = arg("gpu", "metal");
const quality = {desktop: arg("desktop-quality", "high"), phone: arg("phone-quality", "auto")};

const site = path.join(root, ".ark-golden", "site");
mkdirSync(site, {recursive: true});
mkdirSync(out, {recursive: true});
await build({
    entryPoints: [path.join(root, "src/ark-scene/golden-entry.ts")],
    outfile: path.join(site, "golden-scene.js"),
    bundle: true, format: "iife", platform: "browser", target: ["es2020"], minify: true,
    tsconfig: path.join(root, "tsconfig.json"),
    define: {"process.env.NODE_ENV": JSON.stringify("development")},
    logLevel: "warning"
});
writeFileSync(path.join(site, "golden.html"), `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover">
<title>Ark scale run</title>
<style>html,body{margin:0;height:100%;background:#ecdcc4;overflow:hidden}#ark{position:fixed;inset:0}</style>
</head><body><div id="ark"></div><script src="./golden-scene.js"></script></body></html>
`);
for (const p of populations) {
    if (p !== "fixture" && !existsSync(path.join(site, `population-${p}.json`))) throw new Error(`missing ${site}/population-${p}.json (run scripts/ark-scale-fixture.mts)`);
}

const server = createServer((request, response) => {
    const url = new URL(request.url, "http://localhost");
    const fromPublic = url.pathname.startsWith("/ark/graphics/") || url.pathname.startsWith("/ark/assets/");
    const folder = fromPublic ? path.join(root, "public") : site;
    const file = path.join(folder, path.normalize(url.pathname).replace(/^\/+/, "") || "golden.html");
    if (!file.startsWith(folder) || !existsSync(file)) {
        response.writeHead(404).end();
        return;
    }
    const type = file.endsWith(".html") ? "text/html" : file.endsWith(".js") ? "text/javascript" : file.endsWith(".json") ? "application/json" : file.endsWith(".webp") ? "image/webp" : file.endsWith(".glb") ? "model/gltf-binary" : "application/octet-stream";
    response.writeHead(200, {"Content-Type": type, "Cache-Control": "no-store"}).end(readFileSync(file));
});
const host = arg("host", "127.0.0.1");
await new Promise((resolve) => server.listen(port, host, resolve));
const base = `http://127.0.0.1:${port}`;
if (process.argv.includes("--serve-only")) {
    log("serving", site, "on", `${host}:${port}`, "- open /golden.html?population=population-1x.json; Ctrl-C to stop");
    await new Promise(() => {});
}

function cachedChromium() {
    const cache = path.join(os.homedir(), "Library", "Caches", "ms-playwright");
    if (!existsSync(cache)) return null;
    for (const name of readdirSync(cache).filter((e) => /^chromium-\d+$/.test(e)).sort().reverse()) {
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
    headless: true,
    args: ["--headless=new", ...gpuArgs, "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--enable-precise-memory-info"]
});
const results = [];
const loads = [];

for (const deviceName of devices) {
    for (const population of populations) {
        const device = DEVICES[deviceName];
        const context = await browser.newContext({viewport: device.viewport, deviceScaleFactor: device.deviceScaleFactor, isMobile: device.isMobile, hasTouch: device.hasTouch, userAgent: device.userAgent});
        await context.addInitScript((phone) => {
            if (phone) {
                Object.defineProperty(navigator, "hardwareConcurrency", {get: () => 8});
                Object.defineProperty(navigator, "deviceMemory", {get: () => 4});
            }
            window.__longTasks = [];
            try {
                new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) window.__longTasks.push([Math.round(entry.startTime), Math.round(entry.duration)]);
                }).observe({type: "longtask", buffered: true});
            } catch {}
        }, deviceName === "phone");
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", (error) => errors.push(String(error)));
        page.on("console", (message) => {
            if (message.type() === "error") errors.push(message.text());
        });
        const cdp = await context.newCDPSession(page);
        await cdp.send("Performance.enable");
        if (device.cpuThrottle > 1) await cdp.send("Emulation.setCPUThrottlingRate", {rate: device.cpuThrottle});
        const query = [population === "fixture" ? "" : `population=population-${population}.json`, quality[deviceName] === "auto" ? "" : `quality=${quality[deviceName]}`].filter(Boolean).join("&");
        const started = Date.now();
        await page.goto(`${base}/golden.html?${query}`, {waitUntil: "domcontentloaded", timeout: 300_000});
        await page.waitForFunction(() => window.__arkGolden || window.__arkGoldenError, null, {timeout: 300_000, polling: 250});
        const failed = await page.evaluate(() => window.__arkGoldenError);
        if (failed) {
            log(deviceName, population, "FAILED", failed);
            loads.push({device: deviceName, population, error: failed});
            await context.close();
            continue;
        }
        const apiMs = Date.now() - started;
        const settle = await page.evaluate(() => window.__arkGolden.settle(1500, 240_000));
        const loadMs = Date.now() - started;
        const timing = await page.evaluate(() => window.__arkGolden.timing());
        const stats = await page.evaluate(() => window.__arkGolden.stats());
        const metrics = Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((m) => [m.name, m.value]));
        const longAtLoad = await page.evaluate(() => window.__longTasks.slice());
        const load = {
            device: deviceName, population, quality: quality[deviceName], tier: stats.tier, lite: stats.lite, animals: timing.animals,
            apiMs, settleMs: settle.ms, settled: settle.settled, loadMs, fetchMs: Math.round(timing.fetchMs), decodeMs: Math.round(timing.decodeMs),
            mountMs: Math.round(timing.mountMs), readyMs: Math.round(timing.readyMs ?? -1), heapMb: Math.round(metrics.JSHeapUsedSize / 1048576),
            heapTotalMb: Math.round(metrics.JSHeapTotalSize / 1048576), behaviourBuildMs: stats.behaviourBuildMs, modelsLoaded: stats.modelsLoaded,
            longTasksAtLoad: longAtLoad.length, longestTaskAtLoadMs: Math.max(0, ...longAtLoad.map((t) => t[1])), longTaskTotalAtLoadMs: longAtLoad.reduce((s, t) => s + t[1], 0)
        };
        loads.push(load);
        log(deviceName, population, "loaded", JSON.stringify(load));
        for (const place of places) {
            await page.evaluate(() => { window.__longTasks.length = 0; });
            await page.evaluate(([p]) => window.__arkGolden.shoot(p, "day"), [place]);
            await page.evaluate(() => { window.__longTasks.length = 0; });
            const numbers = await page.evaluate((ms) => window.__arkGolden.measure(ms), measureMs);
            const s = await page.evaluate(() => window.__arkGolden.stats());
            const longs = await page.evaluate(() => window.__longTasks.slice());
            const m = Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((x) => [x.name, x.value]));
            const file = `${deviceName}-${population}-${place}.png`;
            await page.screenshot({path: path.join(out, file)});
            const row = {device: deviceName, population, place, file, ...numbers, live: s.live, herdFigures: s.herdFigures, herdSpecks: s.herdSpecks, sprites: s.sprites,
                scheduled: s.scheduled, behaviourMs: s.behaviourMs, rigged: s.rigged, heapMb: Math.round(m.JSHeapUsedSize / 1048576), longTasks: longs.length, longestTaskMs: Math.max(0, ...longs.map((t) => t[1]))};
            results.push(row);
            log(deviceName, population, place, `${numbers.intervalP50}/${numbers.intervalP95} ms, cpu ${numbers.cpuMs}, drain ${numbers.gpuDrainMs}, ${numbers.drawCalls} calls, ${numbers.triangles} tris, near ${numbers.near} far ${numbers.far} live ${s.live} herd ${s.herdFigures}/${s.herdSpecks}, heap ${row.heapMb} MB, long tasks ${longs.length}`);
        }
        if (errors.length) writeFileSync(path.join(out, `errors-${deviceName}-${population}.txt`), errors.join("\n\n"));
        await context.close();
    }
}
await browser.close();
server.close();

const loadavg = os.loadavg().map((x) => x.toFixed(1)).join(" / ");
writeFileSync(path.join(out, "numbers.json"), JSON.stringify({loadavg, loads, results}, null, 2));
const md = [
    `Ark scale run "${label}", ${new Date().toISOString()}, GPU ${gpu}, ${measureMs} ms per view, Mac load average at the end ${loadavg}.`, "",
    "| device | population | tier | animals | load to quiet s | ready ms | decode ms | behaviour build ms | JS heap MB | long tasks at load (longest ms) |",
    "|---|---|---|---:|---:|---:|---:|---:|---:|---|",
    ...loads.map((l) => l.error ? `| ${l.device} | ${l.population} | FAILED | | | | | | | ${l.error} |` : `| ${l.device} | ${l.population} | ${l.tier}${l.lite ? " lite" : ""} | ${l.animals} | ${(l.loadMs / 1000).toFixed(1)}${l.settled ? "" : " (not quiet)"} | ${l.readyMs} | ${l.decodeMs} | ${l.behaviourBuildMs ?? "-"} | ${l.heapMb} | ${l.longTasksAtLoad} (${l.longestTaskAtLoadMs}) |`),
    "", "| device | population | view | interval p50 ms | p95 ms | fps | scene CPU ms | GPU drain ms | draw calls | triangles | near / far / live | herd figures / specks | heap MB | long tasks (longest ms) |",
    "|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|---:|---|",
    ...results.map((r) => `| ${r.device} | ${r.population} | ${r.place} | ${r.intervalP50} | ${r.intervalP95} | ${r.fps} | ${r.cpuMs} | ${r.gpuDrainMs} | ${r.drawCalls} | ${r.triangles} | ${r.near} / ${r.far} / ${r.live} | ${r.herdFigures} / ${r.herdSpecks} | ${r.heapMb} | ${r.longTasks} (${r.longestTaskMs}) |`), ""
].join("\n");
writeFileSync(path.join(out, "numbers.md"), md);
log("wrote", out);
