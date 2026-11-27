#!/usr/bin/env node
/**
 * The broods harness (AnimalDex docs/ark/broods.md 7; lane BROODS-SCENE): builds `src/ark-scene/broods-entry.ts` into
 * `.ark-golden/broods/` (gitignored), serves it with the scene's art, and drives Chrome through a brood's life on the
 * page's controlled clock from a brood read made by hand in the engine's contract shape (a development fixture, never
 * the real Ark): laid, sat on, raided, hatched, taken, lost with no cause, failed, recruited. Frames at each moment
 * and a contact strip per scene, AFTER (the read on) and BEFORE (no read: today's scene, the same clock and camera).
 *
 *   node scripts/ark-behaviours-clips.mjs --out <dir> --scenes broodnest,broodduck,broodchick,broodfrog,broodtoad,broodfish,broodcroc,broodden,broodspider
 *   (or this file itself; `--modes on,none,off`: which rows to make; `--quality high|medium|low`)
 */
import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
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
const out = path.resolve(arg("out", path.join(root, ".ark-golden", "broods-shots")));
const scenes = arg("scenes", "broodnest,broodduck,broodchick,broodfrog,broodtoad,broodfish,broodcroc,broodden,broodspider").split(",").filter((name) => name.startsWith("brood"));
const modes = arg("modes", "on,none").split(",");
const quality = arg("quality", "high");
mkdirSync(out, {recursive: true});
const site = path.join(root, ".ark-golden", "broods");
mkdirSync(site, {recursive: true});
await build({entryPoints: [path.join(root, "src/ark-scene/broods-entry.ts")], outfile: path.join(site, "scene.js"), bundle: true, format: "iife", platform: "browser", target: ["es2020"], minify: true, tsconfig: path.join(root, "tsconfig.json"), define: {"process.env.NODE_ENV": JSON.stringify("development")}, logLevel: "warning"});
writeFileSync(path.join(site, "index.html"), `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Ark broods</title>
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
const summary = {};
const views = {};
for (const name of scenes) {
    summary[name] = {};
    for (const mode of modes) {
        const context = await browser.newContext({viewport: {width: 1280, height: 720}});
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", (e) => errors.push(e.message));
        page.on("console", (m) => {
            if (m.type() === "error") errors.push(m.text().slice(0, 300));
            if (m.text().startsWith("[broods]")) console.log(name, mode, m.text().slice(0, 600));
        });
        await page.goto(`${base}?scene=${name}&broods=${mode}&quality=${quality}${arg("grass", "") === "0" ? "&grass=0" : ""}`, {waitUntil: "domcontentloaded", timeout: 120000});
        try {
            await page.waitForFunction(() => window.__broods || window.__broodsError, null, {timeout: 300000});
        } catch (error) {
            console.log(name, mode, "no harness:", error.message.split("\n")[0], errors.slice(0, 5));
            await context.close();
            continue;
        }
        const failed = await page.evaluate(() => window.__broodsError ?? null);
        if (failed) {
            console.log(name, mode, "failed:", failed.slice(0, 800));
            await context.close();
            continue;
        }
        const plan = await page.evaluate(() => window.__broods.plan());
        const dir = path.join(out, name, mode);
        rmSync(dir, {recursive: true, force: true});
        mkdirSync(dir, {recursive: true});
        const labels = [];
        const hashes = [];
        for (let i = 0; i < plan.length; i++) {
            // (The `on` run's own views are the others': the same camera before and after.)
            const [note, shown] = await page.evaluate(async ([k, given]) => {
                const text = await window.__broods.shot(k, given);
                document.getElementById("note").textContent = text.split("\n").slice(0, 3).join("\n");
                return [text, window.__broods.lastView];
            }, [i, mode === "on" ? null : views[name]?.[i] ?? null]);
            if (mode === "on") (views[name] ??= [])[i] = shown;
            labels.push(`${String(i).padStart(2, "0")} ${note.replace(/\n/g, " | ")}`);
            const file = path.join(dir, `${String(i).padStart(2, "0")}.jpg`);
            // (The same frame without the note, hashed: `off` must be `none`'s picture.)
            await page.evaluate(() => (document.getElementById("note").style.visibility = "hidden"));
            hashes.push(createHash("md5").update(await page.screenshot({type: "png"})).digest("hex"));
            await page.evaluate(() => (document.getElementById("note").style.visibility = "visible"));
            await page.screenshot({path: file, type: "jpeg", quality: 88});
        }
        writeFileSync(path.join(dir, "labels.txt"), labels.join("\n") + "\n");
        const cols = 4;
        execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", "1", "-i", path.join(dir, "%02d.jpg"), "-vf", `scale=640:-1,tile=${cols}x${Math.ceil(plan.length / cols)}:padding=4:color=black`, "-frames:v", "1", path.join(out, `${name}-${mode === "on" ? "after" : mode === "none" ? "before" : mode}-strip.jpg`)]);
        summary[name][mode] = {errors: errors.slice(0, 10), shots: labels, hashes};
        console.log(name, mode, "\n" + labels.join("\n"));
        if (errors.length) console.log(name, mode, "errors:", errors.slice(0, 5));
        await context.close();
    }
    const s = summary[name];
    if (s.off && s.none) {
        const same = s.off.hashes.filter((h, i) => h === s.none.hashes[i]).length;
        s.offSameAsNone = `${same}/${s.off.hashes.length}`;
        console.log(name, "off vs none: identical frames", s.offSameAsNone);
    }
    // (The control: the same scene with no read, loaded twice.)
    if (s.none2 && s.none) {
        const same = s.none2.hashes.filter((h, i) => h === s.none.hashes[i]).length;
        s.noneSameAsNone = `${same}/${s.none2.hashes.length}`;
        console.log(name, "none vs none again (control): identical frames", s.noneSameAsNone);
    }
}
writeFileSync(path.join(out, "summary.json"), JSON.stringify(summary, null, 1));
await browser.close();
server.close();
