#!/usr/bin/env node
/**
 * Life so far (lane BIO, `src/lib/ark-life-so-far.ts`): pictures of the card's "Life so far" line and of the list in its
 * life story (closed, then "More"), composed in the real embed (`public/ark/embed.html?lifestory`, built by
 * `node scripts/build-ark-bundle.mjs`), at phone and desktop width.
 *
 * The data are the live public reads (`/api/ark/*` from the site, read only). Until `voyage_animal_moments_v1` is applied,
 * `--moments <dir>` serves `/api/ark/moments/<id>` from `<dir>/<id>.json`: the function's answer for that animal as the
 * migration's body gave it on production in a read-only transaction (AnimalDex migration 20270102100000). Never made up.
 * `--redact` blurs the people on the card (the "Brought by" line, the photo) for pictures that go anywhere public.
 *
 *   node scripts/ark-life-so-far-shots.mjs --out <dir> --moments <dir> --ids <id,id,...> [--site https://animaldex.app] [--redact]
 */
import {createServer} from "node:http";
import {existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync} from "node:fs";
import os from "node:os";
import path from "node:path";
import {createRequire} from "node:module";
import {fileURLToPath} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name, fallback) => {
    const at = process.argv.indexOf(`--${name}`);
    return at > 0 && process.argv[at + 1] ? process.argv[at + 1] : fallback;
};
const out = path.resolve(arg("out", path.join(root, ".ark-golden", "life-so-far-shots")));
mkdirSync(out, {recursive: true});
const site = arg("site", "https://animaldex.app");
const momentsDir = arg("moments", null);
const ids = (arg("ids", "") || "").split(",").filter(Boolean);
const redact = process.argv.includes("--redact");
if (!ids.length) throw new Error("--ids <animal id,...> is required");

const cache = new Map();
async function live(url) {
    if (!cache.has(url)) cache.set(url, fetch(`${site}${url}`, {headers: {"User-Agent": "ark-shots"}}).then(async (r) => ({status: r.status, type: r.headers.get("content-type") ?? "application/json", body: Buffer.from(await r.arrayBuffer())})));
    return cache.get(url);
}

const server = createServer(async (request, response) => {
    const url = new URL(request.url, "http://localhost");
    try {
        const moments = url.pathname.match(/^\/api\/ark\/moments\/([0-9a-f-]{36})$/);
        if (moments) {
            const file = momentsDir ? path.join(momentsDir, `${moments[1]}.json`) : null;
            const body = file && existsSync(file) ? JSON.stringify({moments: JSON.parse(readFileSync(file, "utf8"))}) : null;
            if (body) return void response.writeHead(200, {"Content-Type": "application/json", "Cache-Control": "no-store"}).end(body);
            const answer = await live(url.pathname);
            return void response.writeHead(answer.status, {"Content-Type": answer.type, "Cache-Control": "no-store"}).end(answer.body);
        }
        if (url.pathname.startsWith("/api/")) {
            const answer = await live(url.pathname + url.search);
            response.writeHead(answer.status, {"Content-Type": answer.type, "Cache-Control": "no-store"}).end(answer.body);
            return;
        }
        const folder = path.join(root, "public");
        const file = path.join(folder, path.normalize(url.pathname).replace(/^\/+/, ""));
        if (!file.startsWith(folder) || !existsSync(file)) return void response.writeHead(404).end();
        const ext = path.extname(file);
        const type = {".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webp": "image/webp", ".png": "image/png", ".glb": "model/gltf-binary", ".ktx2": "image/ktx2", ".jpg": "image/jpeg", ".wasm": "application/wasm"}[ext] ?? "application/octet-stream";
        response.writeHead(200, {"Content-Type": type, "Cache-Control": "no-store"}).end(readFileSync(file));
    } catch (error) {
        response.writeHead(502).end(String(error));
    }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;

const snapshot = JSON.parse((await live("/api/ark/voyage")).body.toString("utf8")).snapshot;
const animals = ids.map((id) => snapshot.animals.find((a) => a.id === id) ?? null);
animals.forEach((a, i) => { if (!a) console.log(`not in the live snapshot (skipped): ${ids[i]}`); });

const {chromium} = createRequire(path.join(root, "node_modules", "x.js"))("playwright-core");
let browser;
try {
    browser = await chromium.launch({channel: "chrome", headless: true, args: ["--use-angle=metal", "--ignore-gpu-blocklist"]});
} catch {
    const dir = path.join(os.homedir(), "Library", "Caches", "ms-playwright");
    const chromiumDir = readdirSync(dir).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse()[0];
    browser = await chromium.launch({executablePath: path.join(dir, chromiumDir, "chrome-mac-arm64", "Google Chrome for Testing.app", "Contents", "MacOS", "Google Chrome for Testing"), headless: true, args: ["--use-angle=metal", "--ignore-gpu-blocklist"]});
}
const REDACT = "[data-testid=ark-card-by], [data-testid=ark-card-life-so-far] li .text-ink-300, [data-testid=ark-animal-card] img:not([src*='icon']) { filter: blur(6px) !important; }";
const log = [];
try {
    const views = [["phone", {width: 390, height: 844}, 2], ["desktop", {width: 1280, height: 800}, 1]];
    await live("/api/ark/words?lang=en");
    for (const [label, viewport, scale] of views) {
        const page = await browser.newPage({viewport, deviceScaleFactor: scale});
        page.on("pageerror", (e) => console.log("pageerror", String(e).slice(0, 200)));
        await page.goto(`${base}/ark/embed.html?lifestory&hud=bars&lang=en`);
        await page.waitForFunction(() => document.querySelector("canvas") && document.getElementById("ark-loader")?.style.display === "none", null, {timeout: 300000}).catch(() => null);
        await page.waitForTimeout(4000);
        if (redact) await page.addStyleTag({content: REDACT});
        for (const animal of animals) {
            if (!animal) continue;
            const slug = `${label}-${animal.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
            await page.evaluate((id) => window.postMessage({type: "ark:select", id, closeUp: true}, "*"), animal.id);
            await page.waitForSelector("[data-testid=ark-card-life-so-far-line]", {timeout: 60000}).catch(() => null);
            await page.waitForTimeout(5000);
            const line = await page.evaluate(() => document.querySelector("[data-testid=ark-card-life-so-far-line]")?.textContent ?? null);
            await page.screenshot({path: path.join(out, `${slug}-1-card.png`)});
            await page.click("[data-testid=ark-card-life-so-far-line]").catch(() => null);
            await page.waitForSelector("[data-testid=ark-card-life-so-far] li", {timeout: 20000}).catch(() => null);
            await page.waitForTimeout(1200);
            const list = await page.evaluate(() => [...document.querySelectorAll("[data-testid=ark-card-life-so-far] li")].map((li) => li.textContent));
            await page.screenshot({path: path.join(out, `${slug}-2-story.png`)});
            const more = await page.$("[data-testid=ark-card-life-so-far-more]");
            let all = null;
            if (more) {
                await more.click();
                await page.waitForTimeout(800);
                await page.evaluate(() => document.querySelector("[data-testid=ark-card-life-so-far-more]")?.scrollIntoView({block: "end"}));
                await page.waitForTimeout(400);
                all = await page.evaluate(() => document.querySelectorAll("[data-testid=ark-card-life-so-far] li").length);
                await page.screenshot({path: path.join(out, `${slug}-3-more.png`)});
                await page.click("[data-testid=ark-card-life-so-far-more]").catch(() => null);
            }
            // Close the life story again for the next animal.
            await page.evaluate(() => (document.querySelector("[data-testid=ark-animal-card] button[aria-expanded=true]:not([data-testid])"))?.click());
            log.push({label, id: animal.id, name: animal.name, line, list, all});
            console.log(label, animal.name, JSON.stringify({line, shown: list.length, all}));
        }
        await page.close();
    }
} finally {
    await browser.close();
    server.close();
}
writeFileSync(path.join(out, "shots.json"), JSON.stringify({site, moments: momentsDir ? "migration body, read-only on production" : "live", redact, log}, null, 1));
