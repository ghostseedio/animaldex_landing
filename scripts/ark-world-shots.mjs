#!/usr/bin/env node
/**
 * The world-props lane's proof frames (ark-world, decision 447): the vegetation lane's harness (below) with views in the
 * town's own frame (`town: true`, `x`, `z`, `dy`) and no model downloads (the animals stay specks, so the pictures are the
 * props and the ground alone). Views: {name: {town?: true, x, z, dy?, distance, polar, azimuth}} or the handle's own view.
 *
 * (Was: the vegetation lane's proof frames (graphics pass 1, lane VEG, 2026-11-16): both islands mounted as the measure page
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
const out = path.resolve(arg("out", path.join(root, ".ark-golden", "world", label)));
const quality = arg("quality", "high");
const repeat = Number(arg("repeat", "1"));
const gap = Number(arg("gap", "2"));
const hour = arg("hour", "10.5");
const width = Number(arg("width", "1440"));
const height = Number(arg("height", "900"));
const extra = arg("views-file", "") ? JSON.parse(readFileSync(arg("views-file", ""), "utf8")) : {};
const VIEWS = {home: null, ...extra};
const views = arg("views", Object.keys(VIEWS).join(",")).split(",").filter((name) => name in VIEWS);

const site = path.join(root, ".ark-golden", "world-site");
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
// `--population-file <path>`: a local snapshot of the Ark (the real one, so the safari and the zoo's houses are open), served at /population.json.
const populationFile = arg("population-file", "");
const server = createServer((request, response) => {
    const url = new URL(request.url, "http://localhost");
    if (populationFile && url.pathname === "/population.json") return response.writeHead(200, {"Content-Type": "application/json", "Cache-Control": "no-store"}).end(readFileSync(populationFile));
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
await page.goto(`${base}/measure.html?islands=1&seconds=900&hour=${hour}&quality=${quality}&models=${encodeURIComponent(base + "/nomodels")}${populationFile ? "&population=" + encodeURIComponent(base + "/population.json") : ""}`, {waitUntil: "domcontentloaded", timeout: 180_000});
await page.waitForFunction(() => window.__arkMeasure?.firstFrameAt || window.__arkMeasure?.error, null, {timeout: 240_000, polling: 500});
const failed = await page.evaluate(() => window.__arkMeasure?.error);
if (failed) throw new Error(failed);
await page.waitForTimeout(Number(arg("settle", "12000")));
// `--eval <js>`: run in the page before the shots (a probe: a light off, a level forced).
if (arg("eval", "")) console.log("eval", JSON.stringify(await page.evaluate(arg("eval", ""))));
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
const results = [];
for (const name of views) {
    const asked = VIEWS[name];
    const shot = await page.evaluate(async ([viewIn, windArg]) => {
        const handle = window.__arkMeasureHandle;
        // A view in the town's own frame: moved by the town's world origin (601.2, -249 on the v2 island), its target on the ground.
        let view = viewIn;
        if (view && view.town) {
            const x = view.x + 601.2;
            const z = view.z - 249;
            view = {target: {x, y: handle.heightAt(x, z) + (view.dy ?? 0.6), z}, distance: view.distance, polar: view.polar, azimuth: view.azimuth};
        } else if (view && view.wild) {
            view = {target: {x: view.x, y: handle.heightAt(view.x, view.z) + (view.dy ?? 0.6), z: view.z}, distance: view.distance, polar: view.polar, azimuth: view.azimuth};
        }
        handle.setEnvironment?.({seaLevel: 0, storm: 0, windDirection: 0.41, wetness: 0, snow: 0, wind: Number(windArg)});
        const target = view ?? handle.homeView();
        const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));
        for (let i = 0; i < 90; i++) {
            if (target.distance < 2) window.__arkDebug.controls.minDistance = 0.05;
            handle.setView(target);
            await frame();
        }
        await new Promise((resolve) => setTimeout(resolve, 2500));
        for (let i = 0; i < 6; i++) {
            if (target.distance < 2) window.__arkDebug.controls.minDistance = 0.05;
            handle.setView(target);
            await frame();
        }
        return {asked: target, actual: handle.view()};
    }, [asked, arg("wind", "0.35")]);
    for (let k = 0; k < repeat; k++) {
        const file = repeat > 1 ? `${name}-${k}.png` : `${name}.png`;
        if (k > 0) await page.evaluate(async ([n, view, free]) => {
            const handle = window.__arkMeasureHandle;
            for (let i = 0; i < n; i++) {
                if (!free) handle.setView(view);
                await new Promise((resolve) => requestAnimationFrame(() => resolve()));
            }
        }, [gap, shot.asked, process.argv.includes("--free")]);
        await page.screenshot({path: path.join(out, file)});
    }
    const stats = await page.evaluate(() => window.__arkMeasureHandle.stats());
    results.push({view: name, ...shot, drawCalls: stats.drawCalls, triangles: stats.triangles, tier: stats.tier});
    console.log(name, `${stats.drawCalls} calls, ${stats.triangles} tris, ${stats.tier}`);
}
if (errors.length) console.log(errors.length, "page errors:", errors.slice(0, 4).join(" | ").slice(0, 600));
writeFileSync(path.join(out, "numbers.json"), JSON.stringify({home: origin, results}, null, 2));
await browser.close();
server.close();
console.log("wrote", results.length, "views to", out);
