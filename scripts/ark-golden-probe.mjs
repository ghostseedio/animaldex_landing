#!/usr/bin/env node
/**
 * Development probe for the graphics pass: serves the golden page (already built by ark-golden-shots.mjs into
 * .ark-golden/site), frames one golden shot, runs a snippet against window.__arkDebug, and screenshots.
 *   node scripts/ark-golden-probe.mjs <place> <time> <out.png> [js snippet run after the shot, with `d` = __arkDebug]
 */
import {createServer} from "node:http";
import {existsSync, readFileSync, readdirSync} from "node:fs";
import os from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const site = path.join(root, ".ark-golden", "site");
const [place, time, out, snippet = ""] = process.argv.slice(2);
const server = createServer((request, response) => {
    const url = new URL(request.url, "http://localhost");
    const folder = url.pathname.startsWith("/ark/graphics/") ? path.join(root, "public") : site;
    const file = path.join(folder, path.normalize(url.pathname).replace(/^\/+/, "") || "golden.html");
    if (!file.startsWith(folder) || !existsSync(file)) return void response.writeHead(404).end();
    response.writeHead(200, {"Content-Type": file.endsWith(".html") ? "text/html" : file.endsWith(".js") ? "text/javascript" : file.endsWith(".webp") ? "image/webp" : "application/octet-stream"}).end(readFileSync(file));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const cache = path.join(os.homedir(), "Library", "Caches", "ms-playwright");
const build = readdirSync(cache).filter((n) => /^chromium-\d+$/.test(n)).sort().reverse()[0];
const {chromium} = await import("playwright-core");
const browser = await chromium.launch({executablePath: path.join(cache, build, "chrome-mac-arm64", "Google Chrome for Testing.app", "Contents", "MacOS", "Google Chrome for Testing"), headless: true, args: ["--headless=new", "--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=metal"]});
const page = await browser.newPage({viewport: {width: 1440, height: 900}});
await page.goto(`http://127.0.0.1:${server.address().port}/golden.html`);
await page.waitForFunction(() => window.__arkGolden, null, {timeout: 120000});
await page.evaluate(() => window.__arkGolden.prepare());
await page.evaluate(([p, t]) => window.__arkGolden.shoot(p, t), [place, time]);
const result = snippet ? await page.evaluate(`(async () => { const d = window.__arkDebug; ${snippet} })()`) : null;
await page.waitForTimeout(600);
await page.screenshot({path: out});
console.log(JSON.stringify(result));
await browser.close();
server.close();
