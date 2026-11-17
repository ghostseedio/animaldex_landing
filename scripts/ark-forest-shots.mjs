#!/usr/bin/env node
/**
 * The forestry harness (p5 humans; AnimalDex decision 379), from the behaviours harness: builds
 * `src/ark-scene/forest-entry.ts`, serves it with the scene's art, and frames logging 0's stand through its cycle on the
 * page's controlled clock: before, mid-felling (a tree falling, the crew), cleared with stumps and the body, planting,
 * saplings, regrown.
 *
 *   node scripts/ark-forest-shots.mjs --out <dir>
 *
 * (The behaviours harness (behaviours plan P1, AnimalDex docs/ark/behaviours-plan.md): builds
 * `src/ark-scene/forest-entry.ts` into `.ark-golden/behaviours/` (gitignored), serves it with the scene's art, and
 * drives Chrome through made-up record events on the page's controlled clock: a birth in the open, a den birth, a
 * contest before a mating, a herd's dung. Frames at each act's moments and a contact strip per scene.
 *
 *   node scripts/ark-behaviours-clips.mjs --out <dir> [--scenes birth,den,contest,dung]
 */
import {execFileSync} from "node:child_process";
import {createServer} from "node:http";
import {existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import os from "node:os";
import path from "node:path";
import {createRequire} from "node:module";
import {fileURLToPath} from "node:url";
import {build} from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name, fallback) => {
    const at = process.argv.indexOf(`--${name}`);
    return at > 0 && process.argv[at + 1] && !process.argv[at + 1].startsWith("--") ? process.argv[at + 1] : fallback;
};
const out = path.resolve(arg("out", path.join(root, ".ark-golden", "forest-shots")));
mkdirSync(out, {recursive: true});
const site = path.join(root, ".ark-golden", "forest");
mkdirSync(site, {recursive: true});
await build({entryPoints: [path.join(root, "src/ark-scene/forest-entry.ts")], outfile: path.join(site, "scene.js"), bundle: true, format: "iife", platform: "browser", target: ["es2020"], minify: true, tsconfig: path.join(root, "tsconfig.json"), define: {"process.env.NODE_ENV": JSON.stringify("development")}, logLevel: "warning"});
writeFileSync(path.join(site, "index.html"), `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Ark behaviours</title>
<style>html,body{margin:0;height:100%;background:#0b1020;overflow:hidden}#ark{position:fixed;inset:0}#note{position:fixed;left:10px;top:8px;z-index:9;font:600 13px/1.35 ui-sans-serif,system-ui;color:#fff;text-shadow:0 1px 3px #000;white-space:pre}</style>
</head><body><div id="ark"></div><div id="note"></div><script src="./scene.js"></script></body></html>`);
const server = createServer((request, response) => {
    const url = new URL(request.url, "http://localhost");
    const folder = url.pathname.startsWith("/ark/") ? path.join(root, "public") : site;
    const file = path.join(folder, path.normalize(url.pathname).replace(/^\/+/, "") || "index.html");
    if (!file.startsWith(folder) || !existsSync(file)) return void response.writeHead(404).end();
    const type = file.endsWith(".html") ? "text/html" : file.endsWith(".js") ? "text/javascript" : file.endsWith(".webp") ? "image/webp" : file.endsWith(".json") ? "application/json" : "application/octet-stream";
    response.writeHead(200, {"Content-Type": type, "Cache-Control": "no-store"}).end(readFileSync(file));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}/index.html`;
const {chromium} = createRequire(path.join(root, "node_modules", "x.js"))("playwright-core");
let browser;
try {
    browser = await chromium.launch({channel: "chrome", headless: true, args: ["--use-angle=metal", "--ignore-gpu-blocklist"]});
} catch {
    const cache = path.join(os.homedir(), "Library", "Caches", "ms-playwright");

/** [name, Ark days after the logging began, distance, azimuth, polar, dx, dz] */
const SHOTS = [
    ["0-before", -0.6, 38, 0.7, 1.05, 0, 0],
    ["1-felling", 0.45, 26, 0.7, 1.15, 0, 0],
    ["2-felling-close", 0.45, 12, 0.7, 1.25, "crew", 0],
    ["3-cleared-body", 1.35, 24, 0.7, 1.1, 0, 0],
    ["4-planting", 4.5, 22, 1.4, 1.15, 0, 0],
    ["5-saplings", 15, 26, 0.7, 1.1, 0, 0],
    ["6-habitat-back", 24, 30, 0.7, 1.1, 0, 0],
    ["7-regrown", 42, 38, 0.7, 1.05, 0, 0]
];
const page = await browser.newPage({viewport: {width: 1280, height: 800}});
page.on("console", (m) => (m.text().startsWith("[forest]") || m.type() === "error") && console.log(m.type(), m.text().slice(0, 300)));
page.on("pageerror", (e) => console.log("pageerror", String(e).slice(0, 300)));
await page.goto(base + "?hours=" + arg("hours", "10"));
await page.waitForFunction(() => window.__forestReady === true, null, {timeout: 240000});
console.log("stand", JSON.stringify(await page.evaluate(() => window.__forest.stand())));
for (const [name, offset, distance, azimuth, polar, dx, dz] of SHOTS) {
    let state = await page.evaluate(([o, d, a, p]) => window.__forest.at(o, d, a, p, 0, 0), [offset, distance, azimuth, polar]);
    if (dx === "crew") {
        const st = JSON.parse(state);
        const m = st?.crew?.[0];
        const stand = (await page.evaluate(() => window.__forest.stand())).stand;
        if (m) state = await page.evaluate(([o, d, a, p, x, z]) => window.__forest.at(o, d, a, p, x, z), [offset, distance, azimuth, polar, m.x - stand.x, m.z - stand.z]);
    }
    await page.screenshot({path: path.join(out, `${name}.png`)});
    console.log(name, state.slice(0, 600));
}
await browser.close();
server.close();
