#!/usr/bin/env node
/**
 * Carers (AnimalDex decision 418): pictures of the keepers, farmers and pet owners at work, from the humans harness
 * (`src/ark-scene/humans-entry.ts` with `?kept=1&carers=1`: kept animals of the fixture's kinds and the carers drawn as
 * if the server's switch were on). Each kind is framed at the first hour it is at work in the pose asked.
 *
 *   node scripts/ark-carers-shots.mjs --out <dir>
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
    return at > 0 && process.argv[at + 1] ? process.argv[at + 1] : fallback;
};
const out = path.resolve(arg("out", path.join(root, ".ark-golden", "carers-shots")));
mkdirSync(out, {recursive: true});
const site = path.join(root, ".ark-golden", "carers");
mkdirSync(site, {recursive: true});
await build({entryPoints: [path.join(root, "src/ark-scene/humans-entry.ts")], outfile: path.join(site, "scene.js"), bundle: true, format: "iife", platform: "browser", target: ["es2020"], minify: true, tsconfig: path.join(root, "tsconfig.json"), define: {"process.env.NODE_ENV": JSON.stringify("development")}, logLevel: "warning"});
writeFileSync(path.join(site, "index.html"), `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Ark carers</title>
<style>html,body{margin:0;height:100%;background:#0b1020;overflow:hidden}#ark{position:fixed;inset:0}</style></head><body><div id="ark"></div><script src="./scene.js"></script></body></html>`);
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
try {
    const page = await browser.newPage({viewport: {width: 1280, height: 800}});
    page.on("pageerror", (e) => console.log("pageerror", String(e).slice(0, 300)));
    await page.goto(`${base}?kept=1&carers=1&humans=12&dogs=0&hours=7.5`);
    await page.waitForFunction(() => window.__humansReady === true, null, {timeout: 400000});
    // [name, kind, from, to, pose, distance, polar, turn, nth]
    const shots = [
        ["keeper-round", "keeper", 7.5, 9, "plant", 7, 1.15, 0.6, 0],
        ["keeper-feed", "keeper", 9, 19.5, "plant", 9, 1.05, 0.9, 1],
        ["farmer", "farmer", 6.9, 9, "plant", 7, 1.15, 0.6, 0],
        ["owner-tank", "owner", 6.9, 9.5, "stand", 4.5, 1.2, 0.5, 0],
        ["owner-evening", "owner", 17.9, 20, "stand", 5, 1.2, -0.6, 1]
    ];
    const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1].split(",") : null;
    const log = [];
    for (const [name, kind, from, to, pose, distance, polar, turn, nth] of shots) {
        if (only && !only.includes(name)) continue;
        const hour = await page.evaluate(([k, f, t, p]) => window.__humans.carerHour(k, f, t, p), [kind, from, to, pose]);
        if (hour === null) {
            log.push({name, none: true});
            continue;
        }
        const state = await page.evaluate(([h, k, d, p, t, n]) => window.__humans.carers(h, k, d, p, t, n), [hour, kind, distance, polar, turn, nth]);
        await page.screenshot({path: path.join(out, `${name}.png`)});
        log.push({name, hour, state: JSON.parse(state)});
        console.log(name, hour, state.slice(0, 200));
    }
    const heap = await page.evaluate(() => (performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null));
    writeFileSync(path.join(out, "shots.json"), JSON.stringify({log, heapMB: heap}, null, 1));
} finally {
    await browser.close();
    server.close();
}
