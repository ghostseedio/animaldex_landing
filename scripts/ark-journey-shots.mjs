#!/usr/bin/env node
/**
 * MATE-FINDING (AnimalDex decision 432): pictures of trips to a far mate, from `src/ark-scene/live/journey-harness-entry.ts`
 * over a saved read of the real Ark. Per pair, frames along the trip (the camera following the traveller), and a contact
 * sheet (`sheet.jpg`, needs ImageMagick's `montage`). The saved reads hold usernames: keep them out of the repository.
 *
 *   node scripts/ark-journey-shots.mjs --data <dir with voyage.json> --out <dir> [--pairs 3]
 */
import {execFileSync} from "node:child_process";
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
const data = path.resolve(arg("data", "."));
const out = path.resolve(arg("out", path.join(root, ".ark-golden", "journey-shots")));
const pairs = Number(arg("pairs", "3"));
mkdirSync(out, {recursive: true});
const site = path.join(root, ".ark-golden", "journey");
mkdirSync(site, {recursive: true});
await build({entryPoints: [path.join(root, "src/ark-scene/live/journey-harness-entry.ts")], outfile: path.join(site, "scene.js"), bundle: true, format: "iife", platform: "browser", target: ["es2020"], minify: true, tsconfig: path.join(root, "tsconfig.json"), define: {"process.env.NODE_ENV": JSON.stringify("development")}, loader: {".json": "json"}, logLevel: "warning"});
writeFileSync(path.join(site, "index.html"), `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Ark journeys</title>
<style>html,body{margin:0;height:100%;background:#0b1020;overflow:hidden}#ark{position:fixed;inset:0}</style></head><body><div id="ark"></div><script>window.__ARK_WORLD__="v2"</script><script src="./scene.js"></script></body></html>`);
const server = createServer((request, response) => {
    const url = new URL(request.url, "http://localhost");
    const folder = url.pathname.startsWith("/ark/") ? path.join(root, "public") : url.pathname.startsWith("/data/") ? data : site;
    const rel = url.pathname.startsWith("/data/") ? url.pathname.slice(6) : path.normalize(url.pathname).replace(/^\/+/, "") || "index.html";
    const file = path.join(folder, rel);
    if (!file.startsWith(folder) || !existsSync(file)) return void response.writeHead(404).end();
    const type = file.endsWith(".html") ? "text/html" : file.endsWith(".js") ? "text/javascript" : file.endsWith(".webp") ? "image/webp" : file.endsWith(".json") ? "application/json" : "application/octet-stream";
    response.writeHead(200, {"Content-Type": type, "Cache-Control": "no-store"}).end(readFileSync(file));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}/index.html`;
const {chromium} = createRequire(path.join(root, "node_modules", "x.js"))("playwright-core");
const flags = ["--use-angle=metal", "--ignore-gpu-blocklist", "--enable-gpu"];
let browser;
try {
    browser = await chromium.launch({channel: "chrome", headless: true, args: flags});
} catch {
    const cache = path.join(os.homedir(), "Library", "Caches", "ms-playwright");
    const dir = readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse()[0];
    browser = await chromium.launch({executablePath: path.join(cache, dir, "chrome-mac-arm64", "Google Chrome for Testing.app", "Contents", "MacOS", "Google Chrome for Testing"), headless: true, args: flags});
}
const summary = [];
try {
    const page = await browser.newPage({viewport: {width: 720, height: 960}});
    page.on("pageerror", (e) => console.log("pageerror", String(e).slice(0, 300)));
    page.on("console", (m) => m.text().startsWith("[journey]") && console.log(m.text()));
    await page.goto(base, {waitUntil: "domcontentloaded", timeout: 180000});
    await page.waitForFunction(() => window.__journey?.ready || window.__journeyError, null, {timeout: 600000, polling: 500});
    const failed = await page.evaluate(() => window.__journeyError ?? null);
    if (failed) throw new Error(failed);
    for (let i = 0; i < 240 && (await page.evaluate(() => window.__journey.loading())); i++) await page.waitForTimeout(500);
    const list = await page.evaluate((n) => window.__journey.pairs(n), pairs);
    console.log("pairs", JSON.stringify(list));
    for (let i = 0; i < list.length; i++) {
        const info = await page.evaluate((k) => window.__journey.start(k), i);
        const frames = [];
        // (Settle, then along the trip; a frame every few seconds until the trip is surely over.)
        await page.evaluate(() => window.__journey.frame(1.5));
        for (let f = 0; f < 8; f++) {
            for (let w = 0; w < 6 && (await page.evaluate(() => window.__journey.loading())); w++) await page.waitForTimeout(400);
            const shot = await page.evaluate((s) => window.__journey.frame(s), f === 0 ? 0.1 : 11);
            const file = path.join(out, `pair${i}-f${f}.jpg`);
            writeFileSync(file, Buffer.from(shot.image.split(",")[1] ?? "", "base64"));
            frames.push({file, at: shot.at && {x: +shot.at.x.toFixed(1), z: +shot.at.z.toFixed(1), act: shot.at.act ?? null}, partner: shot.partner && {x: +shot.partner.x.toFixed(1), z: +shot.partner.z.toFixed(1)}});
        }
        summary.push({...info, frames});
        console.log(JSON.stringify(summary[summary.length - 1]));
    }
} finally {
    await browser.close();
    server.close();
}
writeFileSync(path.join(out, "summary.json"), JSON.stringify(summary, null, 1));
try {
    execFileSync("montage", [...readdirSync(out).filter((f) => f.endsWith(".jpg") && f.startsWith("pair")).sort().map((f) => path.join(out, f)), "-tile", "8x", "-geometry", "270x360+4+4", path.join(out, "sheet.jpg")]);
} catch (e) {
    console.log("no contact sheet:", String(e).slice(0, 120));
}
