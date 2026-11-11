#!/usr/bin/env node
/**
 * The map lane's look at a species on its place (first: the cold cove's penguins, the owner's "penguins floating in the
 * ocean"): builds the golden page (`src/ark-scene/golden-entry.ts`, the v2 fixture) as the graphics lane's harness does
 * (`scripts/ark-golden-shots.mjs`), lets every model load, then frames the animals whose slug matches and saves PNGs.
 *
 *   node scripts/ark-map-cove-shot.mjs --out <dir> [--match penguin] [--hour 11] [--add african-penguin:seashore:5] [--name warm] [--time day|dusk|night]
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
// Extra animals for the shot (`--add african-penguin:seashore:5`): a colony of that species in that zone, on a slot of its own.
const adds = arg("add", "").split(",").filter(Boolean).map((spec) => {
    const [slug, zone, count] = spec.split(":");
    return {slug, zone, count: Number(count || 1)};
});
const name = arg("name", "cove");
const time = arg("time", "day");

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
    logLevel: "warning",
    plugins: adds.length ? [{
        name: "ark-map-shot-fixture",
        setup(builder) {
            // The golden page's v2 fixture with the extra colonies (the page's own file is not touched).
            builder.onLoad({filter: /fixtures[\/]snapshot-v2\.json$/}, (args) => {
                const fixture = JSON.parse(readFileSync(args.path, "utf8"));
                const template = fixture.animals[0];
                for (const add of adds) {
                    const slot = 1 + Math.max(-1, ...fixture.animals.filter((a) => a.zone === add.zone).map((a) => a.slot ?? 0));
                    for (let rank = 0; rank < add.count; rank++) {
                        fixture.animals.push({...template, id: `00000000-0000-4000-8000-${String(slot * 100 + rank).padStart(12, "0")}`, species_profile_id: `shot-${add.slug}`, name: add.slug, scientific_name: null, model_slug: add.slug, zone: add.zone, slot, slot_rank: rank, sociality: "group", activity: "diurnal", mine: false});
                    }
                }
                return {contents: JSON.stringify(fixture), loader: "json"};
            });
        }
    }] : []
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
    await page.evaluate((when) => window.__arkGolden.shoot("coast_rocks", when), time);
    // A few seconds for the animals' schedules to settle at that hour (a colony walks home to rest at dusk).
    for (let i = 0; i < 240; i++) await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
    const found = await page.evaluate(({source, hour}) => {
        const re = new RegExp(source);
        const debug = window.__arkDebug;
        const list = debug.entries().filter((entry) => re.test(entry.animal.model_slug));
        return {hour, animals: list.map((entry) => ({slug: entry.animal.model_slug, x: entry.place.x, z: entry.place.z, y: entry.place.ground, water: entry.place.water, shore: entry.place.map?.shore ?? null, middle: entry.middle ? {x: entry.middle.x, y: entry.middle.y, z: entry.middle.z} : null}))};
    }, {source: match.source, hour});
    console.log(JSON.stringify(found));
    if (!found.animals.length) throw new Error(`no animal matches ${match}`);
    // Where they are drawn now (their schedule may have them out swimming or walking), else their places.
    const now = found.animals.filter((a) => a.middle).map((a) => ({x: a.middle.x, y: a.middle.y, z: a.middle.z}));
    const at = now.length ? now : found.animals.map((a) => ({x: a.x, y: a.y, z: a.z}));
    const cx = at.reduce((s, a) => s + a.x, 0) / at.length;
    const cz = at.reduce((s, a) => s + a.z, 0) / at.length;
    const cy = Math.max(at.reduce((s, a) => s + a.y, 0) / at.length, 0);
    for (const [shot, distance, height, turn] of [["close", 7, 3, 0.6], ["wide", 22, 10, 0.9]]) {
        await page.evaluate(({cx, cy, cz, distance, height, turn}) => {
            const {camera, controls} = window.__arkDebug;
            controls.target.set(cx, cy + 0.5, cz);
            camera.position.set(cx + Math.sin(turn) * distance, cy + height, cz + Math.cos(turn) * distance);
            camera.lookAt(cx, cy + 0.5, cz);
            controls.update?.();
        }, {cx, cy, cz, distance, height, turn});
        for (let i = 0; i < 90; i++) await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
        const file = path.join(out, `${name}-${shot}.png`);
        await page.screenshot({path: file});
        console.log("saved", file);
    }
} finally {
    await browser.close();
    server.close();
}
