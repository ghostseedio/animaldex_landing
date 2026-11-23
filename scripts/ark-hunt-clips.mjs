#!/usr/bin/env node
/**
 * The hunt acts' harness (signature behaviours, theme `hunt_tactic`; `src/ark-scene/hunt-acts.ts`): builds
 * `src/ark-scene/hunt-entry.ts` into `.ark-golden/hunt/` (gitignored), serves it with the scene's art, and drives Chrome
 * through a made-up server record (a meal that ends in a catch, or an escape that ends in a miss) on the page's
 * controlled clock. Frames at the act's moments (before the strike, at it, after it) and a contact strip per scene.
 *
 *   node scripts/ark-hunt-clips.mjs --out <dir> [--scenes cat,fox,heron,...|all] [--modes catch,miss]
 *   node scripts/ark-behaviours-clips.mjs --out <dir> --scenes hunt-cat,hunt-heron   (the same, from the behaviours harness)
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
const out = path.resolve(arg("out", path.join(root, ".ark-golden", "hunt-shots")));
const ALL = ["cat", "fox", "tiger", "jumper", "gecko", "wolf", "mantis", "toad", "web", "orb", "cobweb", "sheet", "heron", "blackbird", "croc", "owl", "kestrel", "osprey", "kingfisher", "kite", "skimmer", "swallow"];
const wanted = arg("scenes", "all");
const scenes = wanted === "all" ? ALL : wanted.split(",").map((s) => s.replace(/^hunt-/, "")).filter(Boolean);
const modes = arg("modes", "catch,miss").split(",");
mkdirSync(out, {recursive: true});
const site = path.join(root, ".ark-golden", "hunt");
mkdirSync(site, {recursive: true});
await build({entryPoints: [path.join(root, "src/ark-scene/hunt-entry.ts")], outfile: path.join(site, "scene.js"), bundle: true, format: "iife", platform: "browser", target: ["es2020"], minify: true, tsconfig: path.join(root, "tsconfig.json"), define: {"process.env.NODE_ENV": JSON.stringify("development")}, logLevel: "warning"});
writeFileSync(path.join(site, "index.html"), `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Ark hunt acts</title>
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
for (const name of scenes) {
    for (const mode of modes) {
        // (--distance D: every shot from D m, the key suffixed: a phone's viewing distance against the close-up.)
        const distArg = process.argv.includes("--distance") ? Number(process.argv[process.argv.indexOf("--distance") + 1]) : null;
        const key = `${name}-${mode}${distArg ? `-d${distArg}` : ""}`;
        // (--phone: a phone's portrait screen, as the page is mostly seen.)
        const context = await browser.newContext(process.argv.includes("--phone") ? {viewport: {width: 390, height: 844}, deviceScaleFactor: 2} : {viewport: {width: 1000, height: 640}});
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", (e) => errors.push(e.message));
        page.on("console", (m) => {
            if (m.type() === "error") errors.push(m.text().slice(0, 300));
            if (m.text().startsWith("[hunt]")) console.log(key, m.text().slice(0, 400));
        });
        await page.goto(`${base}?scene=${name}&mode=${mode}&quality=high`, {waitUntil: "domcontentloaded", timeout: 120000});
        try {
            await page.waitForFunction(() => window.__hunt || window.__huntError, null, {timeout: 300000});
        } catch (error) {
            console.log(key, "no harness:", error.message.split("\n")[0], errors.slice(0, 5));
            await context.close();
            continue;
        }
        const failed = await page.evaluate(() => window.__huntError ?? null);
        if (failed) {
            console.log(key, "failed:", failed.slice(0, 600));
            await context.close();
            continue;
        }
        const info = await page.evaluate(() => window.__hunt.info());
        const tc = (mode === "catch" ? info.catchAt : info.missAt) ?? null;
        if (tc === null) {
            console.log(key, "no act built", JSON.stringify(info));
            summary[key] = {info, errors: errors.slice(0, 10)};
            await context.close();
            continue;
        }
        // The moments: the approach, the wait, the strike's run-up, the strike, what follows.
        // (A web's catch: the insect in, held and struggling, the run out, the bite, the wrap, the carry home, the feed.)
        const webTimes = info.act === "web" && mode === "catch" ? [0.5, 1.3, 2.2, tc - 4.6, tc - 3.9, tc - 3.3, tc - 2.6, tc - 1.9, tc - 0.9, tc, tc + 4, tc + 12] : null;
        const times = webTimes ?? [0.3, tc * 0.25, tc * 0.5, tc * 0.7, tc - 1.2, tc - 0.7, tc - 0.4, tc - 0.2, tc - 0.08, tc, tc + 0.4, tc + (mode === "miss" ? 1.6 : 1.0)].map((t) => Math.max(Math.round(t * 100) / 100, 0.1));
        const uniq = [...new Set(times)].sort((a, b) => a - b);
        const dir = path.join(out, key);
        rmSync(dir, {recursive: true, force: true});
        mkdirSync(dir, {recursive: true});
        const labels = [];
        for (let i = 0; i < uniq.length; i++) {
            const note = await page.evaluate(async (s) => {
                const text = await window.__hunt.shot(s[0], s[1] ?? undefined);
                document.getElementById("note").textContent = text;
                return text;
            }, [uniq[i], distArg]);
            labels.push(`${String(i).padStart(2, "0")} ${note}`);
            await page.screenshot({path: path.join(dir, `${String(i).padStart(2, "0")}.jpg`), type: "jpeg", quality: 85});
        }
        writeFileSync(path.join(dir, "labels.txt"), `${JSON.stringify(info)}\n${labels.join("\n")}\n`);
        execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", "1", "-i", path.join(dir, "%02d.jpg"), "-vf", `scale=500:-1,tile=4x${Math.ceil(uniq.length / 4)}:padding=4:color=black`, "-frames:v", "1", path.join(out, `${key}-strip.jpg`)]);
        summary[key] = {info, errors: errors.slice(0, 10), shots: labels};
        console.log(key, JSON.stringify(info), "\n" + labels.join("\n"));
        if (errors.length) console.log(key, "errors:", errors.slice(0, 5));
        await context.close();
    }
}
writeFileSync(path.join(out, "summary.json"), JSON.stringify(summary, null, 1));
await browser.close();
server.close();
