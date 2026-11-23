#!/usr/bin/env node
/**
 * The mammals' signature behaviours, pictured (sig2, mammals; AnimalDex docs/ark/behaviours-plan.md decision 369):
 * builds `src/ark-scene/sig2-mammals-entry.ts` into `.ark-golden/sig2-mammals/` (gitignored), serves it with the scene's art
 * and drives Chrome through each scene on the page's controlled clock: a group asleep (huddle, pile, cluster) from two
 * sides, or a recipe episode (a stone hammer, a worm drawn out of the litter, a drey) frame by frame. Frames, a label file
 * with the numbers, and a contact strip per scene.
 *
 *   node scripts/ark-sig2-mammals-clips.mjs --out <dir> [--scenes sleep-ring-tailed-lemur,stone-long-tailed-macaque,...]
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
const out = path.resolve(arg("out", path.join(root, ".ark-golden", "sig2-mammals-shots")));
const scenes = arg("scenes", "sleep-ring-tailed-lemur,stone-long-tailed-macaque").split(",");
const width = Number(arg("width", "1280"));
const height = Number(arg("height", "720"));
mkdirSync(out, {recursive: true});
// (A folder to each run: two runs at once do not write each other's bundle.)
const site = path.join(root, ".ark-golden", `sig2-mammals-${process.pid}`);
mkdirSync(site, {recursive: true});
// `--before <ref>`: the same scenes with the sleep layer's table as it was at a git ref (the kinds' own sleeping together before the signature rows).
const before = arg("before", null);
const beforePlugins = [];
if (before) {
    const old = path.join(site, "sleep.before.json");
    writeFileSync(old, execFileSync("git", ["-C", root, "show", `${before}:src/ark-scene/sleep.json`], {maxBuffer: 1 << 26}));
    beforePlugins.push({name: "sleep-before", setup: (b) => b.onResolve({filter: /\/sleep\.json$/}, () => ({path: old}))});
}
await build({entryPoints: [path.join(root, "src/ark-scene/sig2-mammals-entry.ts")], outfile: path.join(site, before ? "scene.before.js" : "scene.js"), bundle: true, format: "iife", platform: "browser", target: ["es2020"], minify: true, tsconfig: path.join(root, "tsconfig.json"), define: {"process.env.NODE_ENV": JSON.stringify("development")}, plugins: beforePlugins, logLevel: "warning"});
writeFileSync(path.join(site, before ? "index.before.html" : "index.html"), `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Ark sig2 mammals</title>
<style>html,body{margin:0;height:100%;background:#0b1020;overflow:hidden}#ark{position:fixed;inset:0}#note{position:fixed;left:10px;top:8px;z-index:9;font:600 13px/1.35 ui-sans-serif,system-ui;color:#fff;text-shadow:0 1px 3px #000;white-space:pre}</style>
</head><body><div id="ark"></div><div id="note"></div><script src="./${before ? "scene.before.js" : "scene.js"}"></script></body></html>`);
const server = createServer((request, response) => {
    const url = new URL(request.url, "http://localhost");
    const folder = url.pathname.startsWith("/ark/") ? path.join(root, "public") : site;
    const file = path.join(folder, path.normalize(url.pathname).replace(/^\/+/, "") || "index.html");
    if (!file.startsWith(folder) || !existsSync(file)) return void response.writeHead(404).end();
    const type = file.endsWith(".html") ? "text/html" : file.endsWith(".js") ? "text/javascript" : file.endsWith(".webp") ? "image/webp" : file.endsWith(".json") ? "application/json" : "application/octet-stream";
    response.writeHead(200, {"Content-Type": type, "Cache-Control": "no-store"}).end(readFileSync(file));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}/${before ? "index.before.html" : "index.html"}`;
const {chromium} = createRequire(path.join(root, "node_modules", "x.js"))("playwright-core");
let browser;
try {
    browser = await chromium.launch({channel: "chrome", headless: true, args: ["--use-angle=metal", "--ignore-gpu-blocklist"]});
} catch {
    const cache = path.join(os.homedir(), "Library", "Caches", "ms-playwright");
    const dir = readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse()[0];
    browser = await chromium.launch({executablePath: path.join(cache, dir, "chrome-mac-arm64", "Google Chrome for Testing.app", "Contents", "MacOS", "Google Chrome for Testing"), headless: true, args: ["--use-angle=metal", "--ignore-gpu-blocklist"]});
}

const strip = (dir, name, count, cols) => {
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", "1", "-i", path.join(dir, "%02d.jpg"), "-vf", `scale=640:-1,tile=${cols}x${Math.ceil(count / cols)}:padding=4:color=black`, "-frames:v", "1", path.join(out, `${name}-strip.jpg`)]);
};

const summary = {};
for (const name of scenes) {
    const context = await browser.newContext({viewport: {width, height}});
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text().slice(0, 300));
        if (m.text().startsWith("[sig2]")) console.log(name, m.text().slice(0, 500));
    });
    try {
        await page.goto(`${base}?scene=${name}&quality=high`, {waitUntil: "domcontentloaded", timeout: 120000});
        await page.waitForFunction(() => window.__sig2 || window.__sig2Error, null, {timeout: 600000});
    } catch (error) {
        console.log(name, "no harness:", error.message.split("\n")[0], errors.slice(0, 5));
        await context.close();
        continue;
    }
    const failed = await page.evaluate(() => window.__sig2Error ?? null);
    if (failed) {
        console.log(name, "failed:", failed.slice(0, 600));
        await context.close();
        continue;
    }
    const head = await page.evaluate(() => ({social: window.__sig2.social, ownNest: window.__sig2.ownNest, scene: window.__sig2.scene, moment: window.__sig2.moment, nest: window.__sig2.nest ?? null}));
    console.log(name, JSON.stringify({social: head.social, ownNest: head.ownNest, moment: head.moment?.note ?? null, nest: head.nest}));
    const dir = path.join(out, before ? `${name}-before` : name);
    rmSync(dir, {recursive: true, force: true});
    mkdirSync(dir, {recursive: true});
    const labels = [];
    let i = 0;
    const shoot = async (label, text) => {
        await page.evaluate((t) => (document.getElementById("note").textContent = t), `${label}\n${text}`);
        labels.push(`${String(i).padStart(2, "0")} ${label}: ${text}`);
        await page.screenshot({path: path.join(dir, `${String(i).padStart(2, "0")}.jpg`), type: "jpeg", quality: 88});
        i++;
    };
    if (head.scene.kind === "sleep") {
        const t0 = head.scene.date + head.scene.hours * 3600;
        // Three moments, each from two sides: asleep settled, a while on, a longer while on.
        for (const [s, label] of [[1200, "twenty minutes in"], [3600, "an hour in"]]) {
            for (const [azimuth, polar, side] of [[0.7, 1.15, "side, low"], [2.4, 0.95, "behind, higher"], [4.2, 0.7, "other side, from above"]]) {
                const text = await page.evaluate(async ([epoch, azimuth, polar]) => window.__sig2.sleeping(epoch, 2.4, polar, azimuth), [t0 + s, azimuth, polar]);
                await shoot(`${label}, ${side}`, text);
            }
        }
        strip(dir, before ? `${name}-before` : name, i, 3);
    } else if (head.moment) {
        const {start, seconds} = head.moment;
        const n = 12;
        const follow = head.scene.recipe !== "nest_build";
        for (let k = 0; k < n; k++) {
            const epoch = start + (k / (n - 1)) * seconds;
            const text = await page.evaluate(async ([epoch, follow, dist]) => window.__sig2.look(epoch, dist, follow), [epoch, follow, follow ? 2.4 : 3.4]);
            await shoot(`+${(epoch - start).toFixed(1)} s`, text);
        }
        strip(dir, before ? `${name}-before` : name, i, 4);
    } else {
        console.log(name, "no episode of that recipe in the window");
    }
    writeFileSync(path.join(dir, "labels.txt"), labels.join("\n") + "\n");
    summary[name] = {head, errors: errors.slice(0, 10), shots: labels};
    console.log(name, labels.join("\n"));
    if (errors.length) console.log(name, "errors:", errors.slice(0, 5));
    await context.close();
}
writeFileSync(path.join(out, "summary.json"), JSON.stringify(summary, null, 1));
await browser.close();
server.close();
rmSync(site, {recursive: true, force: true});
