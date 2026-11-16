#!/usr/bin/env node
/**
 * The sea's proof frames (3.3 batch, lane E): the same golden scene as `ark-golden-shots.mjs` (its entry, its fixture,
 * its pinned light and sea clock), at the sea's own views: over the reef from above, under the surface near shore,
 * the deep, a vent's bubbles, a cave's mouth, each by day and by night.
 *
 *   node scripts/ark-sea-shots.mjs --label after [--out <dir>] [--views vent,cave] [--times day,night] [--quality low]
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
const VIEWS = ["reef_above", "shore_under", "deep", "vent", "cave", "cave_inside", "seabed"];
const label = arg("label", "run");
const out = path.resolve(arg("out", path.join(root, ".ark-golden", "sea", label)));
const views = arg("views", VIEWS.join(",")).split(",").filter((name) => VIEWS.includes(name));
const times = arg("times", "day,night").split(",");
const quality = arg("quality", "auto");

const site = path.join(root, ".ark-golden", "site");
mkdirSync(site, {recursive: true});
mkdirSync(out, {recursive: true});
await build({
    entryPoints: [path.join(root, "src/ark-scene/golden-entry.ts")],
    outfile: path.join(site, "golden-scene.js"),
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["es2020"],
    minify: true,
    tsconfig: path.join(root, "tsconfig.json"),
    define: {"process.env.NODE_ENV": JSON.stringify("development")},
    logLevel: "warning"
});
writeFileSync(path.join(site, "golden.html"), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ark sea shots</title>
<style>html,body{margin:0;height:100%;background:#ecdcc4;overflow:hidden}#ark{position:fixed;inset:0}</style>
</head><body><div id="ark"></div><script src="./golden-scene.js"></script></body></html>
`);
const server = createServer((request, response) => {
    const url = new URL(request.url, "http://localhost");
    const fromPublic = url.pathname.startsWith("/ark/graphics/") || url.pathname.startsWith("/ark/basis/") || url.pathname.startsWith("/ark/assets/");
    const folder = fromPublic ? path.join(root, "public") : site;
    const file = path.join(folder, path.normalize(url.pathname).replace(/^\/+/, "") || "golden.html");
    if (!file.startsWith(folder) || !existsSync(file)) return response.writeHead(404).end();
    const type = file.endsWith(".html") ? "text/html" : file.endsWith(".js") ? "text/javascript" : file.endsWith(".webp") ? "image/webp" : file.endsWith(".wasm") ? "application/wasm" : file.endsWith(".glb") ? "model/gltf-binary" : file.endsWith(".json") ? "application/json" : "application/octet-stream";
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
const context = await browser.newContext({viewport: {width: 1440, height: 900}, deviceScaleFactor: 1});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(String(error)));
page.on("console", (message) => {
    if (message.type() === "error" && !/Failed to load resource/.test(message.text())) errors.push(message.text());
});
await page.goto(`${base}/golden.html?${quality === "auto" ? "" : `quality=${quality}`}`, {waitUntil: "domcontentloaded", timeout: 180_000});
await page.waitForFunction(() => window.__arkGolden || window.__arkGoldenError, null, {timeout: 120_000});
await page.evaluate(() => window.__arkGolden.prepare());
const results = [];
for (const time of times) {
    for (const name of views) {
        const shot = await page.evaluate(async ([view, light]) => {
            const golden = window.__arkGolden;
            const sea = golden.sea();
            const ground = sea.groundAt;
            const toward = (from, k) => ({x: from.x * k, z: from.z * k});
            const outward = (p) => Math.atan2(p.x, p.z);
            let plan = null;
            if (view === "reef_above") plan = {anchor: "over the reef", view: {target: {x: sea.reef.x, y: 0, z: sea.reef.z}, distance: 26, polar: 1.05, azimuth: outward(sea.reef)}};
            if (view === "shore_under") {
                // In from the reef toward the island until the water is about 2 m deep.
                let at = sea.reef;
                for (let k = 1; k > 0.3; k -= 0.01) {
                    at = toward(sea.reef, k);
                    if (ground(at.x, at.z) > -2.1) break;
                }
                plan = {anchor: `shallows, bed ${ground(at.x, at.z).toFixed(1)} m`, view: {target: {x: at.x, y: -1, z: at.z}, distance: 5, polar: 1.55, azimuth: outward(at) + 0.5}};
            }
            if (view === "deep") {
                const bed = ground(sea.ocean.x, sea.ocean.z);
                plan = {anchor: `open ocean, bed ${bed.toFixed(1)} m`, view: {target: {x: sea.ocean.x, y: bed + 1.4, z: sea.ocean.z}, distance: 8, polar: 1.5, azimuth: outward(sea.ocean)}};
            }
            if (view === "vent") {
                const vent = [...sea.vents].sort((a, b) => Math.abs(a.depth - 5) - Math.abs(b.depth - 5))[0];
                if (vent) plan = {anchor: `vent in ${vent.depth.toFixed(1)} m (${sea.vents.length} vents)`, view: {target: {x: vent.x, y: vent.y + 1.6, z: vent.z}, distance: 4.5, polar: 1.5, azimuth: outward(vent) + 0.8}};
            }
            if (view === "seabed") {
                const vent = [...sea.vents].sort((a, b) => Math.abs(a.depth - 4) - Math.abs(b.depth - 4))[1];
                if (vent) plan = {anchor: `bare bed in ${vent.depth.toFixed(1)} m`, view: {target: {x: vent.x + 6, y: vent.y + 0.4, z: vent.z + 3}, distance: 4, polar: 1.25, azimuth: outward(vent)}};
            }
            const cave = (sea.caves ?? [])[0];
            if (view === "cave" && cave) plan = {anchor: `cave in ${cave.depth.toFixed(1)} m (${sea.caves.length} caves)`, view: {target: {x: cave.x, y: cave.y + cave.height * 0.5, z: cave.z}, distance: 7, polar: 1.45, azimuth: cave.yaw}};
            if (view === "cave_inside" && cave) plan = {anchor: "at the cave's mouth, looking in", view: {target: {x: cave.x, y: cave.y + cave.height * 0.35, z: cave.z}, distance: 3.2, polar: 1.5, azimuth: cave.yaw}};
            if (!plan) return null;
            // The golden scene's own pinned light, calm weather and sea clock, then this view held as its shots hold theirs.
            await golden.shoot("reef_underwater", light);
            const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));
            window.__arkGoldenCamera = {free: true, maxPolar: 1.62};
            for (let i = 0; i < 40; i++) {
                if (i < 12) golden.handle.setView(plan.view);
                await frame();
            }
            await new Promise((resolve) => setTimeout(resolve, 1200));
            return {anchor: plan.anchor, actual: golden.handle.view()};
        }, [name, time]);
        if (!shot) {
            console.log(name, time, "no such place");
            continue;
        }
        const file = `${name}-${time}.png`;
        await page.screenshot({path: path.join(out, file)});
        const numbers = await page.evaluate((ms) => window.__arkGolden.measure(ms), 400);
        results.push({view: name, time, file, ...shot, drawCalls: numbers.drawCalls, triangles: numbers.triangles, tier: numbers.tier, cpuMs: numbers.cpuMs});
        console.log(name, time, shot.anchor, `${numbers.drawCalls} calls, ${numbers.triangles} tris, cpu ${numbers.cpuMs}, ${numbers.tier}`);
    }
}
if (errors.length) console.log(errors.length, "page errors:", errors.slice(0, 4).join(" | ").slice(0, 600));
writeFileSync(path.join(out, "numbers.json"), JSON.stringify(results, null, 2));
await browser.close();
server.close();
console.log("wrote", results.length, "shots to", out);
