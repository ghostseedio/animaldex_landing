#!/usr/bin/env node
/**
 * Grazed grass proof frames (AnimalDex decision 417 (1), lane ARK-FOOD-B), on `ark-veg-shots.mjs`'s mount: the same
 * grassland spot shot lush (no record), thinning (0.3) and grazed bare (0.08), as the record's vegetation would set
 * every wild zone (`grass-grazed.ts`), at `--hour` (10.5 day, 22 night).
 *
 *   node scripts/ark-grazed-shots.mjs --label day [--hour 10.5] [--quality high]
 *
 * (From ark-veg-shots.mjs:) The vegetation lane's proof frames (graphics pass 1, lane VEG, 2026-11-16): both islands mounted as the measure page
 * mounts them (`runtime/measure-entry.ts ?islands=1`, the live v2 wild island with the town across the strait), the
 * hour pinned, then each named view held and shot, `--repeat <n>` times `--gap <frames>` frames apart (the far-view
 * flicker check: the same view, a few frames later, should be the same picture).
 *
 *   node scripts/ark-veg-shots.mjs --label before [--views home,town_trees] [--quality high] [--repeat 3 --gap 2]
 *   --views-file <json>: extra views {name: {target:{x,y,z}, distance, polar, azimuth, town?: true}} (town: target in
 *   the town's own frame, moved by its world origin).
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
const label = arg("label", "run");
const out = path.resolve(arg("out", path.join(root, ".ark-golden", "grazed", label)));
const quality = arg("quality", "high");
const repeat = Number(arg("repeat", "1"));
const gap = Number(arg("gap", "2"));
const hour = arg("hour", "10.5");
const width = Number(arg("width", "1440"));
const height = Number(arg("height", "900"));
const extra = arg("views-file", "") ? JSON.parse(readFileSync(arg("views-file", ""), "utf8")) : {};
const VIEWS = {home: null, ...extra};
const views = arg("views", Object.keys(VIEWS).join(",")).split(",").filter((name) => name in VIEWS);

const site = path.join(root, ".ark-golden", "grazed-site");
mkdirSync(site, {recursive: true});
mkdirSync(out, {recursive: true});
await build({
    entryPoints: [path.join(root, "src/ark-scene/runtime/measure-entry.ts")],
    outfile: path.join(site, "measure.js"),
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["es2020"],
    minify: true,
    tsconfig: path.join(root, "tsconfig.json"),
    define: {"process.env.NODE_ENV": JSON.stringify("development")},
    logLevel: "warning"
});
writeFileSync(path.join(site, "measure.html"), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ark veg shots</title>
<style>html,body{margin:0;height:100%;background:#ecdcc4;overflow:hidden}#ark{position:fixed;inset:0}</style>
</head><body><div id="ark"></div><script src="./measure.js"></script></body></html>
`);
const server = createServer((request, response) => {
    const url = new URL(request.url, "http://localhost");
    const fromPublic = url.pathname.startsWith("/ark/");
    const folder = fromPublic ? path.join(root, "public") : site;
    const file = path.join(folder, path.normalize(url.pathname).replace(/^\/+/, "") || "measure.html");
    if (!file.startsWith(folder) || !existsSync(file)) return response.writeHead(404).end();
    const type = file.endsWith(".html") ? "text/html" : file.endsWith(".js") ? "text/javascript" : file.endsWith(".webp") ? "image/webp" : file.endsWith(".wasm") ? "application/wasm" : file.endsWith(".glb") ? "model/gltf-binary" : file.endsWith(".json") ? "application/json" : file.endsWith(".ktx2") ? "image/ktx2" : "application/octet-stream";
    response.writeHead(200, {"Content-Type": type, "Cache-Control": "no-store"}).end(readFileSync(file));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;

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
const browser = await chromium.launch({
    executablePath: process.env.ARK_CHROMIUM || cachedChromium() || undefined,
    args: ["--headless=new", "--enable-gpu", "--ignore-gpu-blocklist", ...(process.platform === "darwin" ? ["--use-angle=metal"] : []), "--disable-background-timer-throttling", "--disable-renderer-backgrounding"]
});
const context = await browser.newContext({viewport: {width, height}, deviceScaleFactor: 1});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(String(error)));
page.on("console", (message) => {
    if (message.type() === "error" && !/Failed to load resource/.test(message.text())) errors.push(message.text());
});
await page.goto(`${base}/measure.html?islands=1&seconds=900&hour=${hour}&quality=${quality}`, {waitUntil: "domcontentloaded", timeout: 180_000});
await page.waitForFunction(() => window.__arkMeasure?.firstFrameAt || window.__arkMeasure?.error, null, {timeout: 240_000, polling: 500});
const failed = await page.evaluate(() => window.__arkMeasure?.error);
if (failed) throw new Error(failed);
await page.waitForTimeout(Number(arg("settle", "12000")));
// `--eval <js>`: run in the page before the shots (a probe: a light off, a level forced).
if (arg("eval", "")) await page.evaluate(arg("eval", ""));
const origin = await page.evaluate(() => window.__arkMeasureHandle.homeView());
// `--census <frames>`: from the home view, the camera left to its idle drift, how often the trees' levels change: per
// frame, every asset-tree mesh's drawn count (a tree that moves from one level to another changes two of them).
if (arg("census", "")) {
    const census = await page.evaluate(async (n) => {
        const scene = window.__arkDebug.scene;
        const meshes = [];
        scene.traverse((o) => {
            if (o.isInstancedMesh && (o.userData.kind === "asset-tree" || String(o.userData.kind).startsWith("town:"))) meshes.push(o);
        });
        const read = () => meshes.map((m) => (m.visible ? m.count : 0));
        const cam = window.__arkDebug.camera.position;
        let last = read();
        let changes = 0;
        let changedFrames = 0;
        const eye = [];
        for (let i = 0; i < n; i++) {
            await new Promise((resolve) => requestAnimationFrame(() => resolve()));
            const now = read();
            let c = 0;
            for (let k = 0; k < now.length; k++) c += Math.abs(now[k] - last[k]);
            if (c) changedFrames++;
            changes += c;
            last = now;
            if (i % 30 === 0) eye.push([Math.round(cam.x), Math.round(cam.y), Math.round(cam.z)]);
        }
        const levels = {};
        for (const m of meshes) if (m.visible && m.count) {
            const level = m.name.split(":").pop();
            const tris = (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3;
            const key = `${m.userData.kind}:${level}`;
            levels[key] = levels[key] ?? {instances: 0, tris: 0, calls: 0};
            levels[key].instances += m.count;
            levels[key].tris += m.count * tris;
            levels[key].calls += 1;
        }
        return {meshes: meshes.length, frames: n, changedFrames, changes, eye, levels};
    }, Number(arg("census", "")));
    console.log("census", JSON.stringify(census));
}
const zonesAt = (level) => Object.fromEntries(["grassland", "woodland", "farm_garden", "river_lake", "wetland", "rainforest", "mountains", "seashore", "desert"].map((zone) => [`wild|${zone}`, {level}]));
// A grassland spot with grass round it, near the home view: from the grass tufts' own zone attribute (set by the first level).
await page.evaluate((zones) => window.__arkMeasureHandle.setVegetation({day: 0, zones}), zonesAt(0.999));
const spot = await page.evaluate(async () => {
    for (let i = 0; i < 10; i++) await new Promise((resolve) => requestAnimationFrame(() => resolve()));
    let grass = null;
    window.__arkDebug.scene.traverse((o) => {
        if (o.isInstancedMesh && o.geometry.getAttribute("arkGrassZone")) grass = o;
    });
    if (!grass) return null;
    const zone = grass.geometry.getAttribute("arkGrassZone").array;
    const m = grass.instanceMatrix.array;
    const home = window.__arkMeasureHandle.homeView();
    const want = 7; // "grassland" in ARK_ZONES
    let best = null;
    let bestScore = Infinity;
    for (let i = 0; i < grass.count; i++) {
        if (Math.round(zone[i]) !== want) continue;
        const x = m[i * 16 + 12], y = m[i * 16 + 13], z = m[i * 16 + 14];
        // Dense: count grassland neighbours within 3 m (a sample), nearer the home target first.
        let n = 0;
        for (let j = Math.max(0, i - 400); j < Math.min(grass.count, i + 400); j++) if (Math.hypot(m[j * 16 + 12] - x, m[j * 16 + 14] - z) < 3) n++;
        const score = Math.hypot(x - home.target.x, z - home.target.z) / 40 - n;
        if (score < bestScore) {
            bestScore = score;
            best = {x, y, z};
        }
    }
    return best && {target: best, distance: 7, polar: 1.18, azimuth: home.azimuth};
});
if (!spot) throw new Error("no grassland grass drawn (quality low?)");
const results = [];
for (const [name, level, far] of [["lush", null, false], ["thinning", 0.3, false], ["bare", 0.08, false], ["lush-wide", null, true], ["thinning-wide", 0.3, true], ["bare-wide", 0.08, true]]) {
    await page.evaluate(([zones]) => window.__arkMeasureHandle.setVegetation(zones ? {day: 0, zones} : null), [level === null ? null : zonesAt(level)]);
    const shot = await page.evaluate(async ([view, windArg]) => {
        const handle = window.__arkMeasureHandle;
        handle.setEnvironment?.({seaLevel: 0, storm: 0, windDirection: 0.41, wetness: 0, snow: 0, wind: Number(windArg)});
        const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));
        for (let i = 0; i < 90; i++) {
            handle.setView(view);
            await frame();
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
        for (let i = 0; i < 6; i++) {
            handle.setView(view);
            await frame();
        }
        return {actual: handle.view()};
    }, [far ? {...spot, distance: 24, polar: 1.05} : spot, arg("wind", "0.35")]);
    await page.screenshot({path: path.join(out, `${name}.png`)});
    const stats = await page.evaluate(() => window.__arkMeasureHandle.stats());
    results.push({state: name, level, ...shot, drawCalls: stats.drawCalls, triangles: stats.triangles, tier: stats.tier});
    console.log(name, `${stats.drawCalls} calls, ${stats.triangles} tris, ${stats.tier}`);
}
if (errors.length) console.log(errors.length, "page errors:", errors.slice(0, 4).join(" | ").slice(0, 600));
writeFileSync(path.join(out, "numbers.json"), JSON.stringify({home: origin, spot, results}, null, 2));
await browser.close();
server.close();
console.log("wrote", results.length, "shots to", out);
