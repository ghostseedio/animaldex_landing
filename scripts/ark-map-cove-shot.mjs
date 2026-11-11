#!/usr/bin/env node
/**
 * The map lane's look at a species on its place (first: the cold cove's penguins, the owner's "penguins floating in the
 * ocean"): builds the golden page (`src/ark-scene/golden-entry.ts`, the v2 fixture) as the graphics lane's harness does
 * (`scripts/ark-golden-shots.mjs`), lets every model load, then frames the animals whose slug matches and saves PNGs.
 *
 *   node scripts/ark-map-cove-shot.mjs --out <dir> [--match penguin] [--hour 11]
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
    return at > 0 && process.argv[at + 1] ? process.argv[at + 1] : fallback;
};
const out = path.resolve(arg("out", path.join(root, ".ark-golden", "map-shots")));
const match = new RegExp(arg("match", "penguin"));
const hour = Number(arg("hour", "11"));

const site = path.join(root, ".ark-golden", "site-map");
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
writeFileSync(path.join(site, "golden.html"), `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Ark map shot</title>
<style>html,body{margin:0;height:100%;background:#ecdcc4;overflow:hidden}#ark{position:fixed;inset:0}</style></head>
<body><div id="ark"></div><script src="./golden-scene.js"></script></body></html>`);
const server = createServer((request, response) => {
    const url = new URL(request.url, "http://localhost");
    const fromPublic = url.pathname.startsWith("/ark/graphics/") || url.pathname.startsWith("/ark/assets/");
    const folder = fromPublic ? path.join(root, "public") : site;
    const file = path.join(folder, path.normalize(url.pathname).replace(/^\/+/, "") || "golden.html");
    if (!file.startsWith(folder) || !existsSync(file)) {
        response.writeHead(404).end();
        return;
    }
    const type = file.endsWith(".html") ? "text/html" : file.endsWith(".js") ? "text/javascript" : file.endsWith(".webp") ? "image/webp" : file.endsWith(".glb") ? "model/gltf-binary" : file.endsWith(".json") ? "application/json" : "application/octet-stream";
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
    headless: true,
    args: ["--headless=new", "--enable-gpu", "--ignore-gpu-blocklist", ...(process.platform === "darwin" ? ["--use-angle=metal"] : []), "--disable-background-timer-throttling", "--disable-renderer-backgrounding"]
});
try {
    const context = await browser.newContext({viewport: {width: 1440, height: 900}, deviceScaleFactor: 1});
    const page = await context.newPage();
    page.on("pageerror", (error) => console.log("page error:", error.message));
    await page.goto(`${base}/golden.html?quality=high`);
    await page.waitForFunction(() => window.__arkGolden || window.__arkGoldenError, null, {timeout: 180_000});
    const error = await page.evaluate(() => window.__arkGoldenError);
    if (error) throw new Error(error);
    console.log("prepare", JSON.stringify(await page.evaluate(() => window.__arkGolden.prepare().then((r) => r.settled))));
    // A golden shot first (pins the calm weather, the sea's clock and the light), then the hour asked for.
    await page.evaluate(() => window.__arkGolden.shoot("coast_rocks", "day"));
    const found = await page.evaluate(({source, hour}) => {
        const re = new RegExp(source);
        const debug = window.__arkDebug;
        const list = debug.entries().filter((entry) => re.test(entry.animal.model_slug));
        return {hour, animals: list.map((entry) => ({slug: entry.animal.model_slug, x: entry.place.x, z: entry.place.z, y: entry.place.ground, water: entry.place.water, shore: entry.place.map?.shore ?? null, middle: entry.middle ? {x: entry.middle.x, y: entry.middle.y, z: entry.middle.z} : null}))};
    }, {source: match.source, hour});
    console.log(JSON.stringify(found));
    if (!found.animals.length) throw new Error(`no animal matches ${match}`);
    const cx = found.animals.reduce((s, a) => s + a.x, 0) / found.animals.length;
    const cz = found.animals.reduce((s, a) => s + a.z, 0) / found.animals.length;
    const cy = found.animals.reduce((s, a) => s + a.y, 0) / found.animals.length;
    for (const [name, distance, height, turn] of [["close", 7, 3, 0.6], ["wide", 22, 10, 0.9]]) {
        await page.evaluate(({cx, cy, cz, distance, height, turn}) => {
            const {camera, controls} = window.__arkDebug;
            controls.target.set(cx, cy + 0.5, cz);
            camera.position.set(cx + Math.sin(turn) * distance, cy + height, cz + Math.cos(turn) * distance);
            camera.lookAt(cx, cy + 0.5, cz);
            controls.update?.();
        }, {cx, cy, cz, distance, height, turn});
        for (let i = 0; i < 90; i++) await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
        const file = path.join(out, `cove-${name}.png`);
        await page.screenshot({path: file});
        console.log("saved", file);
    }
} finally {
    await browser.close();
    server.close();
}
