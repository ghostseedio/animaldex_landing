#!/usr/bin/env node
/**
 * The ground lane's bug-scale proof frames (graphics pass 2, lane GROUND, 2026-11-16): both islands mounted as
 * `ark-veg-shots.mjs` mounts them, then the camera brought down to the small animals standing on the ground (the
 * fixture's own: body under `--max-length` m, not aloft, not in water), `--bugs <n>` of them, one per species, each shot
 * at `--distance` m, so a viewer's frame shows whether a beetle or a frog sits in the sward and stays seen.
 *
 *   node scripts/ark-ground-shots.mjs --label after --bugs 6 [--distance 0.5] [--quality high]
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
const out = path.resolve(arg("out", path.join(root, ".ark-golden", "ground", label)));
const quality = arg("quality", "high");
const repeat = Number(arg("repeat", "1"));
const gap = Number(arg("gap", "2"));
const hour = arg("hour", "10.5");
const width = Number(arg("width", "1440"));
const height = Number(arg("height", "900"));
const extra = arg("views-file", "") ? JSON.parse(readFileSync(arg("views-file", ""), "utf8")) : {};
const VIEWS = {home: null, ...extra};
const views = arg("views", Object.keys(VIEWS).join(",")).split(",").filter((name) => name in VIEWS);

const site = path.join(root, ".ark-golden", "veg-site");
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
const results = [];
const bugs = await page.evaluate(([maxLength]) => {
    const seen = new Set();
    const out = [];
    for (const e of window.__arkDebug.entries()) {
        const pose = e.sched?.pose;
        const at = pose ?? e.place;
        if (!at || e.visitor || e.place.water || e.air > 0.01 || pose?.aloft || pose?.afloat) continue;
        if (!(e.trueLength < maxLength) || seen.has(e.animal.model_slug)) continue;
        seen.add(e.animal.model_slug);
        out.push({slug: e.animal.model_slug, id: e.animal.id, x: at.x, y: pose?.base ?? e.place.ground, z: at.z, length: e.trueLength});
    }
    return out;
}, [Number(arg("max-length", "0.25"))]);
console.log("small ground animals", bugs.length);
for (const bug of bugs.slice(0, Number(arg("bugs", "6")))) {
    const view = {target: {x: bug.x, y: bug.y, z: bug.z}, distance: Number(arg("distance", "0.5")), polar: 1.05, azimuth: 0.6};
    const shot = await page.evaluate(async ([id, view]) => {
        const handle = window.__arkMeasureHandle;
        const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));
        const entry = () => window.__arkDebug.entries().find((e) => e.animal.id === id);
        for (let i = 0; i < 150; i++) {
            const e = entry();
            const at = e?.sched?.pose ?? e?.place;
            if (at) view.target = {x: at.x, y: e.sched?.pose?.base ?? e.place.ground, z: at.z};
            window.__arkDebug.controls.minDistance = 0.05;
            handle.setView(view);
            await frame();
        }
        const e = entry();
        return {drawn: Boolean(e?.middle), view: handle.view()};
    }, [bug.id, view]);
    await page.screenshot({path: path.join(out, `${bug.slug}.png`)});
    const stats = await page.evaluate(() => window.__arkMeasureHandle.stats());
    results.push({bug, ...shot, drawCalls: stats.drawCalls, triangles: stats.triangles, tier: stats.tier});
    console.log(bug.slug, bug.length.toFixed(3), shot.drawn ? "drawn" : "NOT drawn", `${stats.drawCalls} calls, ${stats.triangles} tris, ${stats.tier}`);
}
if (errors.length) console.log(errors.length, "page errors:", errors.slice(0, 4).join(" | ").slice(0, 600));
writeFileSync(path.join(out, "numbers.json"), JSON.stringify({home: origin, results}, null, 2));
await browser.close();
server.close();
console.log("wrote", results.length, "views to", out);
