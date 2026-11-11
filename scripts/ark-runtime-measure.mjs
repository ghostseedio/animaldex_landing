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
 * Part B (docs/ark/streaming.md): `--render <m>` / `--render-scale <share>` set the render distance; `--tour` takes
 * the camera down into each region and back; `--mem <GB>` is the app's memory figure; `--models-dir <dir>` serves a
 * local model set (the far-model pack, the far-ark files: scripts/ark-model-pack.mjs) at /models/ after
 * `--latency <ms>` (default 180, the bucket's measured time to first byte); `--serve <port>` serves the page on
 * the loopback for a WebView (the iOS Simulator, an Android emulator) without a browser of its own: the page posts its
 * result to /report and it is written to the output folder (open `/measure.html?…&report=/report&label=<name>`).
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
        userAgent: "Mozilla/5.0 (Linux; Android 14; SM-A356B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36"
    }
};
const NETWORKS = {
    none: null,
    "4g": {offline: false, latency: 60, downloadThroughput: (9 * 1024 * 1024) / 8, uploadThroughput: (3 * 1024 * 1024) / 8}
};

const label = arg("label", "run");
const out = path.resolve(arg("out", path.join(root, ".ark-golden", "runtime", label)));
const devices = arg("devices", "desktop,phone").split(",").filter((name) => DEVICES[name]);
const runs = Number(arg("runs", "3"));
const seconds = Number(arg("seconds", "20"));
const network = NETWORKS[arg("network", "none")] ?? null;
const quality = arg("quality", "auto");
const gpu = arg("gpu", "metal");

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
    // Development: the scene exposes __arkDebug (its three.js scene), which the memory estimate walks.
    define: {"process.env.NODE_ENV": JSON.stringify("development")},
    logLevel: "warning"
});
// The prebuild worker (`--prebuild`), and the scale populations (`--population 1x`, from scripts/ark-scale-fixture.mts).
for (const [entry, out] of [["prebuild-worker.ts", "ark-prebuild-worker.js"], ["prebuild-places-worker.ts", "ark-prebuild-places-worker.js"]]) {
    await build({entryPoints: [path.join(root, "src/ark-scene/runtime", entry)], outfile: path.join(site, out), bundle: true, format: "iife", platform: "browser", target: ["es2020"], minify: true, tsconfig: path.join(root, "tsconfig.json"), define: {"process.env.NODE_ENV": JSON.stringify("development")}, logLevel: "warning"});
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
        response.writeHead(200, {"Content-Type": "application/json", "Cache-Control": "no-store"}).end(readFileSync(populationFile));
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
    response.writeHead(200, {"Content-Type": type, "Cache-Control": "no-store"}).end(readFileSync(file));
});
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

const results = [];
for (const deviceName of devices) {
    const device = DEVICES[deviceName];
    for (let run = 0; run < runs; run++) {
        // A fresh context each run: nothing cached (as a first visit).
        const context = await browser.newContext({viewport: device.viewport, deviceScaleFactor: device.deviceScaleFactor, isMobile: device.isMobile, hasTouch: device.hasTouch, userAgent: device.userAgent});
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
                        const scripts = (entry.scripts ?? []).map((script) => ({ms: Math.round(script.duration), what: `${script.invoker ?? ""} ${script.sourceFunctionName ?? ""}`.trim()})).sort((a, b) => b.ms - a.ms).slice(0, 3);
                        frames.push({start: Math.round(entry.startTime), ms: Math.round(entry.duration), blocking: Math.round(entry.blockingDuration ?? 0), scripts});
                    }
                }).observe({type: "long-animation-frame", buffered: true});
            } catch {
                // No long-animation-frame timing here.
            }
        });
        if (deviceName === "phone") {
            await context.addInitScript(() => {
                Object.defineProperty(navigator, "hardwareConcurrency", {get: () => 8});
                Object.defineProperty(navigator, "deviceMemory", {get: () => 4});
            });
        }
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", (error) => errors.push(String(error)));
        page.on("console", (message) => {
            if (message.type() === "error") errors.push(message.text());
        });
        const cdp = await context.newCDPSession(page);
        if (device.cpuThrottle > 1) await cdp.send("Emulation.setCPUThrottlingRate", {rate: device.cpuThrottle});
        if (network) {
            await cdp.send("Network.enable");
            await cdp.send("Network.emulateNetworkConditions", network);
        }
        if (flag("profile")) {
            await cdp.send("Profiler.enable");
            await cdp.send("Profiler.setSamplingInterval", {interval: 500});
            await cdp.send("Profiler.start");
        }
        const extra = `${arg("render", "") ? `&render=${arg("render", "")}` : ""}${arg("render-scale", "") ? `&renderScale=${arg("render-scale", "")}` : ""}${flag("tour") ? "&tour=1" : ""}${arg("focus", "") ? `&focus=${arg("focus", "")}` : ""}${arg("mem", "") ? `&mem=${arg("mem", "")}` : ""}${arg("budget", "") ? `&budget=${arg("budget", "")}` : ""}${flag("walk") ? "&walk=1" : ""}${flag("prebuild") ? "&prebuild=1" : ""}${populationFile ? "&population=population-file.json" : arg("population", "") ? `&population=population-${arg("population", "")}.json` : ""}`;
        const modelsParam = modelsDir ? `&models=${encodeURIComponent(`${base}/models`)}` : cdnDir ? `&models=${encodeURIComponent(`${base}/cdn/talking-models/v1/ark`)}` : "";
        await page.goto(`${base}/measure.html?seconds=${seconds}${quality === "auto" ? "" : `&quality=${quality}`}${extra}${modelsParam}`, {waitUntil: "commit", timeout: 120_000});
        // `--repeat`: this load only primes the page's caches; the measured one is a second visit in the same browser.
        if (flag("repeat")) {
            await page.waitForFunction(() => window.__arkMeasure?.done, null, {timeout: (seconds + 120) * 1000, polling: 500});
            await page.reload({waitUntil: "commit", timeout: 120_000});
        }
        await page.waitForFunction(() => window.__arkMeasure?.done, null, {timeout: (seconds + 120) * 1000, polling: 500});
        const measured = await page.evaluate(() => window.__arkMeasure);
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
            run,
            gpu,
            network: arg("network", "none"),
            firstFrameMs: r.firstFrameMs,
            firstFrameFromNavigation: r.firstFrameFromNavigation,
            mountMs: r.mountMs,
            inViewMs: r.inViewMs,
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
            tier: r.stats.tier,
            models: r.stats.modelsLoaded,
            drawCalls: r.stats.drawCalls,
            triangles: r.stats.triangles,
            runtime: r.runtime,
            prepared: r.prepared,
            animals: r.animals,
            tasks,
            longFrames: frames.filter((frame) => frame.blocking > 0 || frame.ms > 100).slice(0, 40),
            samples: r.samples,
            errors: errors.filter((e) => !/Failed to load resource/.test(e)).slice(0, 8)
        };
        results.push(row);
        log(deviceName, `run ${run}:`, `first frame ${row.firstFrameMs} ms (mount ${row.mountMs}), in view ${row.inViewMs} ms, frames ${row.frameRate ? `${row.frameRate.fps} fps (p50 ${row.frameRate.p50Ms} ms, p95 ${row.frameRate.p95Ms} ms, ${row.frameRate.over50Ms} over 50 ms)` : "-"}, longest task ${row.longestTaskMs} ms (${row.longTasks} long, ${row.longTasksAfterFirstFrame} after the first frame, longest after ${row.longestAfterFirstFrameMs}), heap ${row.heapMB} MB (peak ${row.peakHeapMB}), GPU peak ${row.peakGpuMB} MB, requests to view ${row.inViewRequests} (pack ${row.library?.packHits ?? "-"}/${(row.library?.packHits ?? 0) + (row.library?.fileHits ?? 0)}), chunks in ${row.streaming?.chunks?.in ?? "-"}, skipped ${row.streaming?.animalsSkipped ?? "-"}, GPU est ${row.memory?.geometryMB}+${row.memory?.textureMB} MB, ${row.models} models, ${row.tier}${row.prepared ? `, prebuild ${row.prepared.where} ${row.prepared.ms} ms (worker ${row.prepared.workerMs} ms)${row.prepared.error ? ` ${row.prepared.error}` : ""}` : ""}, ${row.animals} animals`);
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
    `Ark runtime "${label}", ${new Date().toISOString()}, GPU ${gpu}, network ${arg("network", "none")}, quality ${quality}, ${runs} runs × ${seconds} s per device (medians).`,
    "",
    "| device | first frame ms | mount ms | in view ms | requests to view | longest task ms | long tasks | longest after 1st frame | heap MB | peak heap MB | peak GPU MB | fps | p50 ms | p95 ms | GPU geometry MB | GPU textures MB | models | tier |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|"
];
for (const deviceName of devices) {
    const rows = results.filter((r) => r.device === deviceName);
    lines.push(`| ${deviceName} | ${median(rows.map((r) => r.firstFrameMs))} | ${median(rows.map((r) => r.mountMs))} | ${median(rows.map((r) => r.inViewMs))} | ${median(rows.map((r) => r.inViewRequests))} | ${median(rows.map((r) => r.longestTaskMs))} | ${median(rows.map((r) => r.longTasks))} | ${median(rows.map((r) => r.longestAfterFirstFrameMs))} | ${median(rows.map((r) => r.heapMB))} | ${median(rows.map((r) => r.peakHeapMB))} | ${median(rows.map((r) => r.peakGpuMB))} | ${median(rows.map((r) => r.frameRate?.fps))} | ${median(rows.map((r) => r.frameRate?.p50Ms))} | ${median(rows.map((r) => r.frameRate?.p95Ms))} | ${median(rows.map((r) => r.memory?.geometryMB))} | ${median(rows.map((r) => r.memory?.textureMB))} | ${median(rows.map((r) => r.models))} | ${rows[0]?.tier} |`);
}
writeFileSync(path.join(out, "runtime.md"), lines.join("\n") + "\n");
log("wrote", path.join(out, "runtime.md"));
console.log(lines.join("\n"));
