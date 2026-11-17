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
const which = arg("page", "forest");
await build({entryPoints: [path.join(root, which === "humans" ? "src/ark-scene/humans-entry.ts" : "src/ark-scene/forest-entry.ts")], outfile: path.join(site, "scene.js"), bundle: true, format: "iife", platform: "browser", target: ["es2020"], minify: true, tsconfig: path.join(root, "tsconfig.json"), define: {"process.env.NODE_ENV": JSON.stringify("development")}, logLevel: "warning"});
writeFileSync(path.join(site, "index.html"), `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Ark forestry</title>
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
    const dir = readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse()[0];
    browser = await chromium.launch({executablePath: path.join(cache, dir, "chrome-mac-arm64", "Google Chrome for Testing.app", "Contents", "MacOS", "Google Chrome for Testing"), headless: true, args: ["--use-angle=metal", "--ignore-gpu-blocklist"]});
}

/** [name, Ark days after the logging began, distance, azimuth, polar, dx, dz] */
const SHOTS = [
    ["0-before", -0.6, 38, 0.7, 1.05, 0, 0],
    ["1-felling", 0.45, 26, 0.7, 1.15, 0, 0],
    ["2-felling-close", 0.45, 8, 0.7, 1.3, "crew", 0],
    ["2-saw-close", 0.45, 5, 1.2, 1.05, "crew", 0],
    ["2-logs-down", 0.95, 16, 0.4, 1.0, 0, 0],
    ["2-log-close", 0.95, 9, 2.6, 1.2, "log", 0],
    ["3-pile", 2.2, 12, 0.5, 1.15, "pile", 0],
    ["3-body", "body", 9, 0.7, 1.2, "body", 0],
    ["3-body-wide", "body", 24, 2.2, 1.1, "body", 0],
    ["3-cleared", 1.35, 24, 0.7, 1.1, 0, 0],
    ["4-planting", 4.5, 22, 1.4, 1.15, 0, 0],
    ["5-saplings", 15, 26, 0.7, 1.1, 0, 0],
    ["6-habitat-back", 24, 30, 0.7, 1.1, 0, 0],
    ["7-regrown", 42, 38, 0.7, 1.05, 0, 0]
];
const page = await browser.newPage({viewport: {width: 1280, height: 800}});
if (which === "humans") {
    // `--page humans`: dog walks in the whole scene (the town beside the wild island): a morning walk on a pavement,
    // close and from a little back, and an evening one.
    page.on("pageerror", (e) => console.log("pageerror", String(e).slice(0, 300)));
    await page.goto(base + "?world=v2&hours=7.8" + (arg("people", "") ? `&people=${arg("people", "")}` : ""));
    await page.waitForFunction(() => window.__humansReady === true, null, {timeout: 400000});
    // p6 (people): `--shots people`: the town's people by kind, near and far (`window.__humans.people`), then stop.
    if (arg("shots", "") === "people") {
        const views = [["p1-beach-near", 13.6, "sun", 6, 1.05, 0.8, 0], ["p1-beach-near-b", 13.6, "sun", 6, 1.05, 2.4, 2], ["p2-beach-far", 13.6, "sun", 32, 1.0, 0.8, 0], ["p3-paddle-near", 13.6, "paddle", 6, 1.2, 0.9, 0], ["p4-bench-near", 14.4, "bench", 5, 1.2, 0.5, 0], ["p5-pavement-near", 8.4, "pavement", 6, 1.25, 0.9, 0], ["p6-pavement-far", 8.4, "pavement", 28, 1.05, 0.9, 1], ["p7-car-near", 14.4, "car", 5, 1.05, 1.2, 0], ["p8-boat-near", 14.4, "boat", 7, 1.1, 1.2, 0], ["p9-dogwalk-near", 7.8, "dogwalk", 5, 1.25, 0.9, 0]];
        for (const [name, hours, kind, distance, polar, turn, nth] of views.filter(([n]) => !arg("only", "") || arg("only", "").split(",").some((o) => n.startsWith(o)))) {
            const state = await page.evaluate(([h, k, d, p, t, n]) => window.__humans.people(h, k, d, p, t, n), [hours, kind, distance, polar, turn, nth]);
            await page.screenshot({path: path.join(out, `${name}.png`)});
            console.log(name, String(state).slice(0, 400));
        }
        await browser.close();
        server.close();
        process.exit(0);
    }
    // (Quality pass: the beach walk: the first hour a walked dog is out on the sand.)
    const beach = await page.evaluate(() => window.__humans.beachHour());
    console.log("beach", JSON.stringify(beach));
    const shots = [["d1-morning-walk", 7.8, 6, 1.25, 0.9, 0], ["d2-morning-walk-wide", 7.8, 16, 1.1, 2.2, 0], ["d3-another", 8.3, 6, 1.25, -0.9, 1], ["d4-evening-walk", 18.6, 6, 1.25, 0.9, 0], ["d5-evening-wide", 18.9, 22, 1.0, 2.4, 2]];
    if (beach) shots.push(["d6-beach-walk", beach.hours, 7, 1.2, 1.2, beach.nth], ["d7-beach-walk-wide", beach.hours, 18, 1.05, 2.0, beach.nth]);
    for (const [name, hours, distance, polar, turn, nth] of shots) {
        const state = await page.evaluate(([h, d, p, t, n]) => window.__humans.walk(h, d, p, t, n), [hours, distance, polar, turn, nth]);
        await page.screenshot({path: path.join(out, `${name}.png`)});
        console.log(name, String(state).slice(0, 400));
    }
    await browser.close();
    server.close();
    process.exit(0);
}
page.on("console", (m) => (m.text().startsWith("[forest]") || m.type() === "error") && console.log(m.type(), m.text().slice(0, 300)));
page.on("pageerror", (e) => console.log("pageerror", String(e).slice(0, 300)));
await page.goto(base + "?world=v2&hours=" + arg("hours", "10") + (arg("people", "") ? `&people=${arg("people", "")}` : "") + (arg("humanbase", "") ? `&humanbase=${arg("humanbase", "")}` : ""));
await page.waitForFunction(() => window.__forestReady === true, null, {timeout: 240000});
console.log("stand", JSON.stringify(await page.evaluate(() => window.__forest.stand())));
const info = await page.evaluate(() => window.__forest.stand());
// (`--only a,b`: just the shots whose names start with these.)
const only = arg("only", "").split(",").filter(Boolean);
for (const [name, when, distance, azimuth, polar, dx] of SHOTS.filter(([n]) => !only.length || only.some((o) => n.startsWith(o)))) {
    // (The body: a few minutes after the front reached its home, framed on it.)
    const offset = when === "body" ? info.dieDay - info.start + 0.04 : when;
    if (dx === "body") {
        const state = await page.evaluate(([o, d, a, p, x, z]) => window.__forest.at(o, d, a, p, x, z), [offset, distance, azimuth, polar, info.spot.x - info.stand.x, info.spot.z - info.stand.z]);
        await page.screenshot({path: path.join(out, `${name}.png`)});
        console.log(name, state.slice(0, 300), JSON.stringify(await page.evaluate(() => window.__arkDebug.deaths())));
        continue;
    }
    // (The pile: at the stand's edge on the crew's way in.)
    // (A log: framed on the first felled tree's top end, where its limbs lie.)
    const pile = dx === "log" ? [info.stand.r * 0.25, -info.stand.r * 0.1] : dx === "pile" ? [Math.cos(info.bearing) * Math.max(info.stand.r - 3, 2), Math.sin(info.bearing) * Math.max(info.stand.r - 3, 2)] : [0, 0];
    let state = await page.evaluate(([o, d, a, p, x, z]) => window.__forest.at(o, d, a, p, x, z), [offset, distance, azimuth, polar, pile[0], pile[1]]);
    if (dx === "crew") {
        const st = JSON.parse(state);
        const m = st?.crew?.[0];
        const stand = (await page.evaluate(() => window.__forest.stand())).stand;
        // (From behind the feller's shoulder, away from the tree it faces: azimuth is the camera's bearing from the target.)
        if (m) state = await page.evaluate(([o, d, a, p, x, z]) => window.__forest.at(o, d, a, p, x, z), [offset, distance, m.yaw + Math.PI + azimuth, polar, m.x - stand.x, m.z - stand.z]);
    }
    await page.screenshot({path: path.join(out, `${name}.png`)});
    console.log(name, state.slice(0, 600));
}
await browser.close();
server.close();
