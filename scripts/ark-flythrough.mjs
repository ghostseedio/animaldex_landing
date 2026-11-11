#!/usr/bin/env node
/**
 * The graphics pass's 60-second flythrough: builds the golden page (ark-golden-shots.mjs does; run it once first,
 * or pass --build), flies the route of golden places from morning to night in real time per tier, records the
 * desktop high-tier flight as a video, and reports frame intervals per tier and device.
 *   node scripts/ark-flythrough.mjs [--seconds 60] [--out dir]
 */
import {createServer} from "node:http";
import {existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync} from "node:fs";
import os from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name, fallback) => {
    const at = process.argv.indexOf(`--${name}`);
    return at > 0 ? process.argv[at + 1] : fallback;
};
const seconds = Number(arg("seconds", "60"));
const out = path.resolve(arg("out", path.join(root, ".ark-golden", "flythrough")));
mkdirSync(out, {recursive: true});
const site = path.join(root, ".ark-golden", "site");
const server = createServer((request, response) => {
    const url = new URL(request.url, "http://localhost");
    const fromPublic = url.pathname.startsWith("/ark/graphics/") || url.pathname.startsWith("/ark/assets/");
    const folder = fromPublic ? path.join(root, "public") : site;
    const file = path.join(folder, path.normalize(url.pathname).replace(/^\/+/, "") || "golden.html");
    if (!file.startsWith(folder) || !existsSync(file)) return void response.writeHead(404).end();
    const type = file.endsWith(".html") ? "text/html" : file.endsWith(".js") ? "text/javascript" : file.endsWith(".webp") ? "image/webp" : file.endsWith(".glb") ? "model/gltf-binary" : "application/octet-stream";
    response.writeHead(200, {"Content-Type": type}).end(readFileSync(file));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const cache = path.join(os.homedir(), "Library", "Caches", "ms-playwright");
const build = readdirSync(cache).filter((n) => /^chromium-\d+$/.test(n)).sort().reverse()[0];
const {chromium} = await import("playwright-core");
const browser = await chromium.launch({executablePath: path.join(cache, build, "chrome-mac-arm64", "Google Chrome for Testing.app", "Contents", "MacOS", "Google Chrome for Testing"), headless: true, args: ["--headless=new", "--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=metal"]});
const runs = [
    {device: "desktop", quality: "high"},
    {device: "desktop", quality: "medium"},
    {device: "desktop", quality: "low"},
    {device: "phone", quality: "medium"},
    {device: "phone", quality: "low"}
];
const results = [];
for (const run of runs) {
    const phone = run.device === "phone";
    const context = await browser.newContext({
        viewport: phone ? {width: 360, height: 800} : {width: 1280, height: 720},
        deviceScaleFactor: phone ? 2 : 1,
        isMobile: phone,
        hasTouch: phone,
    });
    if (phone) await context.addInitScript(() => {
        Object.defineProperty(navigator, "hardwareConcurrency", {get: () => 8});
        Object.defineProperty(navigator, "deviceMemory", {get: () => 4});
    });
    const page = await context.newPage();
    if (phone) await (await context.newCDPSession(page)).send("Emulation.setCPUThrottlingRate", {rate: 4});
    await page.goto(`${base}/golden.html?quality=${run.quality}`, {waitUntil: "domcontentloaded", timeout: 180_000});
    await page.waitForFunction(() => window.__arkGolden, null, {timeout: 180_000});
    await page.evaluate(() => window.__arkGolden.prepare());
    const result = await page.evaluate((s) => window.__arkGolden.flythrough(s), seconds);
    await context.close();
    results.push({...run, ...result, stats: {drawCalls: result.stats.drawCalls, triangles: result.stats.triangles, tier: result.stats.tier}});
    console.log(run.device, run.quality, `${result.fps} fps, p50 ${result.p50} ms, p95 ${result.p95}, p99 ${result.p99}, last view ${result.stats.drawCalls} calls / ${result.stats.triangles} tris`);
}
writeFileSync(path.join(out, "flythrough.json"), JSON.stringify(results, null, 2));

// The video: the same flight frame by frame (30 fps, desktop high tier, 1280x720), encoded with the system ffmpeg.
if (!process.argv.includes("--no-video")) {
    const frames = path.join(out, "frames");
    mkdirSync(frames, {recursive: true});
    const context = await browser.newContext({viewport: {width: 1280, height: 720}});
    const page = await context.newPage();
    await page.goto(`${base}/golden.html?quality=high`, {waitUntil: "domcontentloaded", timeout: 180_000});
    await page.waitForFunction(() => window.__arkGolden, null, {timeout: 180_000});
    await page.evaluate(() => window.__arkGolden.prepare());
    const total = Math.round(seconds * 30);
    for (let i = 0; i < total; i++) {
        await page.evaluate((t) => {
            window.__arkGolden.flyAt(t);
            return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        }, i / (total - 1));
        await page.screenshot({path: path.join(frames, `f${String(i).padStart(5, "0")}.jpg`), type: "jpeg", quality: 85});
    }
    await context.close();
    const {execFileSync} = await import("node:child_process");
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", "30", "-i", path.join(frames, "f%05d.jpg"), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", path.join(out, "ark-flythrough-60s.mp4")]);
    console.log("video", path.join(out, "ark-flythrough-60s.mp4"));
}
await browser.close();
server.close();
