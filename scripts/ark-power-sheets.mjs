#!/usr/bin/env node
/**
 * Powers you can see (AnimalDex decision 420): contact sheets of each mechanism at prime and at ordinary, by day and
 * by night, and of a hunter passing a prime animal over. Builds `src/ark-scene/power-harness-entry.ts` into
 * `.ark-golden/powers/` (gitignored), serves it with the scene's art and a saved read of the real Ark, and films it in
 * headless Chrome.
 *
 *   node scripts/ark-power-sheets.mjs --data <dir with voyage.json> --out <dir> [--width 540 --height 720]
 *        [--quality high|medium|low] [--day 10.5] [--night 22.5] [--kinds slug,slug]
 *
 * A mechanism's sheet (`sheet-<mechanism>.jpg`) is one row: prime by day, ordinary by day, prime by night, ordinary by
 * night, the same animal at the same spot; the pass's (`sheet-pass-<day|night>.jpg`) nine moments 1.5 s apart.
 *
 * The saved read holds usernames: keep it out of the repository.
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
const data = path.resolve(arg("data", "."));
const out = path.resolve(arg("out", path.join(root, ".ark-golden", "power-sheets")));
const width = Number(arg("width", "540"));
const height = Number(arg("height", "720"));
const quality = arg("quality", "high");
const day = Number(arg("day", "10.5"));
const night = Number(arg("night", "22.5"));
const kinds = arg("kinds", "");
mkdirSync(out, {recursive: true});

const site = path.join(root, ".ark-golden", "powers");
mkdirSync(site, {recursive: true});
await build({
    entryPoints: [path.join(root, "src/ark-scene/power-harness-entry.ts")],
    outfile: path.join(site, "powers-scene.js"),
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["es2020"],
    minify: true,
    tsconfig: path.join(root, "tsconfig.json"),
    define: {"process.env.NODE_ENV": JSON.stringify("development")},
    logLevel: "warning"
});
writeFileSync(path.join(site, "powers.html"), `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Ark powers</title>
<style>html,body{margin:0;height:100%;background:#0b1020;overflow:hidden}#ark{position:fixed;inset:0}</style>
</head><body><div id="ark"></div><script>window.__ARK_WORLD__="v2"</script><script src="./powers-scene.js"></script></body></html>`);
const server = createServer((request, response) => {
    const url = new URL(request.url, "http://localhost");
    const folder = url.pathname.startsWith("/ark/") ? path.join(root, "public") : url.pathname.startsWith("/data/") ? data : site;
    const rel = url.pathname.startsWith("/data/") ? url.pathname.slice(6) : path.normalize(url.pathname).replace(/^\/+/, "") || "powers.html";
    const file = path.join(folder, rel);
    if (!file.startsWith(folder) || !existsSync(file)) {
        response.writeHead(404).end();
        return;
    }
    const type = file.endsWith(".html") ? "text/html" : file.endsWith(".js") ? "text/javascript" : file.endsWith(".webp") ? "image/webp" : file.endsWith(".json") ? "application/json" : "application/octet-stream";
    response.writeHead(200, {"Content-Type": type, "Cache-Control": "no-store"}).end(readFileSync(file));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}/powers.html`;

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
const log = (...parts) => console.log(new Date().toISOString().slice(11, 19), ...parts);
const save = (file, dataUrl) => {
    const comma = dataUrl.indexOf(",");
    if (comma > 0) writeFileSync(file, Buffer.from(dataUrl.slice(comma + 1), "base64"));
    return comma > 0;
};
const open = async (query) => {
    const context = await browser.newContext({viewport: {width, height}, deviceScaleFactor: 1});
    const page = await context.newPage();
    page.on("pageerror", (e) => log("page error:", e.message.slice(0, 300)));
    await page.goto(`${base}?quality=${quality}${query}`, {waitUntil: "domcontentloaded", timeout: 180000});
    await page.waitForFunction(() => window.__ps?.ready || window.__psError, null, {timeout: 600000, polling: 500});
    const failed = await page.evaluate(() => window.__psError ?? null);
    if (failed) throw new Error(failed);
    return {page, context};
};
const summary = {picks: [], pass: null};
{
    const {page, context} = await open(kinds ? `&kinds=${kinds}` : "");
    const picks = await page.evaluate(() => window.__ps.picks);
    log("picks:", picks.map((p) => `${p.mechanism}:${p.slug}`).join(" "));
    const tiles = [];
    for (const pick of picks) {
        const row = [];
        for (const [hours, when] of [[day, "day"], [night, "night"]]) {
            for (const band of ["prime", "ordinary"]) {
                const file = path.join(out, `${pick.mechanism}-${pick.slug}-${band}-${when}.jpg`);
                const ok = save(file, await page.evaluate(([ids, h, b]) => window.__ps.shoot(ids, h, b), [pick.group, hours, band]));
                if (ok) row.push(file);
            }
        }
        log(pick.mechanism, pick.slug, row.length, "frames", JSON.stringify(await page.evaluate(() => window.__ps.stats())));
        summary.picks.push({...pick, frames: row.map((f) => path.basename(f))});
        tiles.push(...row);
        if (row.length === 4) {
            const tmp = path.join(out, `.row-${pick.mechanism}`);
            rmSync(tmp, {recursive: true, force: true});
            mkdirSync(tmp, {recursive: true});
            row.forEach((f, i) => execFileSync("cp", [f, path.join(tmp, `${i}.jpg`)]));
            execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", "1", "-i", path.join(tmp, "%d.jpg"), "-vf", "scale=400:-1,tile=4x1:padding=4:color=black", "-frames:v", "1", path.join(out, `sheet-${pick.mechanism}.jpg`)]);
            rmSync(tmp, {recursive: true, force: true});
        }
    }
    await context.close();
}
{
    const {page, context} = await open("&allprime=1");
    for (const [hours, when] of [[day, "day"], [night, "night"]]) {
        const result = await page.evaluate((h) => window.__ps.pass(h), hours);
        log("pass", when, JSON.stringify(result.pair));
        if (!result.pair) continue;
        const tmp = path.join(out, `.pass-${when}`);
        rmSync(tmp, {recursive: true, force: true});
        mkdirSync(tmp, {recursive: true});
        result.images.forEach((img, i) => save(path.join(tmp, `${i}.jpg`), img));
        execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", "1", "-i", path.join(tmp, "%d.jpg"), "-vf", "scale=400:-1,tile=3x3:padding=4:color=black", "-frames:v", "1", path.join(out, `sheet-pass-${when}.jpg`)]);
        rmSync(tmp, {recursive: true, force: true});
        summary.pass = {...(summary.pass ?? {}), [when]: result.pair};
    }
    await context.close();
}
writeFileSync(path.join(out, "summary.json"), JSON.stringify(summary, null, 2));
await browser.close();
server.close();
log("done:", out);
