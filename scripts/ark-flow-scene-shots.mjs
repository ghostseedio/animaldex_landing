#!/usr/bin/env node
/**
 * Behaviour flows in the scene (docs/ark/behaviour-flows.md 8): the behaviours harness (`behaviours-entry.ts`, scenes
 * flowdeer / flowsparrow / flowjay / flowfox) with the flows switched on (`?flows=1`) and, at the same moments, off.
 * Each picture is captioned with the flow's card line, the beat the pose plays and the card's activity.
 *
 *   node scripts/ark-flow-scene-shots.mjs --out <dir> [--scenes flowdeer,flowfox]
 */
import {createServer} from "node:http";
import {existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync} from "node:fs";
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
const out = path.resolve(arg("out", path.join(root, ".ark-golden", "flow-scene-shots")));
mkdirSync(out, {recursive: true});
const site = path.join(root, ".ark-golden", "flows");
mkdirSync(site, {recursive: true});
await build({entryPoints: [path.join(root, "src/ark-scene/behaviours-entry.ts")], outfile: path.join(site, "scene.js"), bundle: true, format: "iife", platform: "browser", target: ["es2020"], minify: true, tsconfig: path.join(root, "tsconfig.json"), define: {"process.env.NODE_ENV": JSON.stringify("development")}, logLevel: "warning"});
writeFileSync(path.join(site, "index.html"), `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Ark flows</title>
<style>html,body{margin:0;height:100%;background:#0b1020;overflow:hidden}#ark{position:fixed;inset:0}#note{position:fixed;left:0;right:0;bottom:0;z-index:9;padding:10px 14px;font:600 16px/1.4 ui-sans-serif,system-ui;color:#fff;background:rgba(0,0,0,.55);white-space:pre}</style>
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
const ID = "0000feed-0000-4000-8000-000000000000";
/** Each scene: framing distance (m), and the flow moments to find: [label, kinds, from s, to s]. */
const PLANS = {
    flowdeer: {distance: 7, polar: 0.95, finds: [["eating (background food)", ["eat"], 0, 1500], ["searching", ["search", "movePatch"], 0, 1500], ["eating, later", ["eat"], 900, 3000]]},
    flowsparrow: {distance: 2.2, polar: 0.9, finds: [["eating (background food)", ["eat"], 0, 1500], ["searching", ["search"], 0, 1500], ["resting", ["rest", "digest", "groom"], 0, 2400]]},
    flowjay: {distance: 2, polar: 1.0, finds: [["eating (background food)", ["eat"], 0, 1500], ["searching", ["search"], 0, 1500]]},
    flowfox: {distance: 4, polar: 1.0, finds: [["the server's kill", ["catch"], 1100, 1300, 1], ["eating its kill", ["eat"], 1200, 1800], ["listening for prey", ["search"], 0, 1150]]}
};
const scenes = arg("scenes", Object.keys(PLANS).join(",")).split(",");
const summary = {};
for (const name of scenes) {
    const plan = PLANS[name];
    const times = [];
    for (const flows of arg("only-on", "") ? [1] : [1, 0]) {
        const context = await browser.newContext({viewport: {width: 1280, height: 720}});
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", (e) => errors.push(e.message));
        page.on("console", (m) => m.text().startsWith("[behaviours]") && console.log(name, m.text().slice(0, 400)));
        await page.goto(`${base}?scene=${name}&quality=high&flows=${flows}`, {waitUntil: "domcontentloaded", timeout: 120000});
        await page.waitForFunction(() => window.__behaviours || window.__behavioursError, null, {timeout: 300000});
        const failed = await page.evaluate(() => window.__behavioursError ?? null);
        if (failed) {
            console.log(name, "failed", failed.slice(0, 400));
            await context.close();
            break;
        }
        for (let i = 0; i < plan.finds.length; i++) {
            const [label, kinds, from, to, every] = plan.finds[i];
            if (flows === 1) times[i] = await page.evaluate(([id, k, f, t, e]) => window.__behaviours.flowFind(id, k, f, t, e ?? 4), [ID, kinds, from, to, every]);
            const s = times[i];
            if (s === null || s === undefined) {
                console.log(name, label, "not found");
                continue;
            }
            await page.evaluate(async ([s2, d, id, polar]) => {
                await window.__behaviours.shot(s2, d, id);
                await window.__behaviours.closeOn(id, d, polar);
            }, [s, plan.distance, ID, plan.polar ?? 1.1]);
            // (A flock: each member's line, the flock foraging together.)
            const ids = name === "flowsparrow" ? [0, 1, 2].map((i) => ID.slice(0, -1) + i) : [ID];
            const caption = (await page.evaluate((list) => list.map((id) => window.__behaviours.flowCaption(id)), ids)).map((line, i) => (ids.length > 1 ? `#${i} ` : "") + line).join("\n");
            const text = `${name} · flows ${flows ? "ON" : "OFF (today)"} · +${Math.round(s)} s · ${label}\n${caption}`;
            await page.evaluate((t) => (document.getElementById("note").textContent = t), text);
            const file = path.join(out, `${name}-${i + 1}-${flows ? "on" : "off"}.png`);
            await page.screenshot({path: file});
            console.log(file, "|", caption);
            (summary[name] ??= []).push({flows, label, s, caption});
        }
        if (errors.length) console.log(name, "errors", errors.slice(0, 3));
        await context.close();
    }
}
writeFileSync(path.join(out, "shots.json"), JSON.stringify(summary, null, 1));
await browser.close();
server.close();
