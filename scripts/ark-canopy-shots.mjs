#!/usr/bin/env node
/**
 * The canopy harness (p5 monkeys): builds `src/ark-scene/canopy-entry.ts` into `.ark-golden/canopy/` (gitignored),
 * serves it with the scene's art and the real snapshot (read in place from `--snapshot`, served as `real.json`, never
 * copied), and frames the shots of a plan on the page's controlled clock: the same moments before and after a change.
 *
 *   node scripts/ark-canopy-shots.mjs --snapshot <real.json> --plan <shots.json> --out <dir> [--quality high]
 *
 * A plan is `[{name, epoch, id?, target?: {x, y, z}, distance, azimuth?, polar?, lift?, hours?}]`.
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
const snapshotFile = path.resolve(arg("snapshot", path.join(root, "public/ark-local/real.json")));
const plan = JSON.parse(readFileSync(path.resolve(arg("plan", "")), "utf8"));
const out = path.resolve(arg("out", path.join(root, ".ark-golden", "canopy-shots")));
mkdirSync(out, {recursive: true});
const site = path.join(root, ".ark-golden", "canopy");
mkdirSync(site, {recursive: true});
await build({entryPoints: [path.join(root, "src/ark-scene/canopy-entry.ts")], outfile: path.join(site, "scene.js"), bundle: true, format: "iife", platform: "browser", target: ["es2020"], minify: true, tsconfig: path.join(root, "tsconfig.json"), define: {"process.env.NODE_ENV": JSON.stringify("development")}, logLevel: "warning"});
writeFileSync(path.join(site, "index.html"), `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Ark canopy</title>
<style>html,body{margin:0;height:100%;background:#0b1020;overflow:hidden}#ark{position:fixed;inset:0}</style>
</head><body><div id="ark"></div><script src="./scene.js"></script></body></html>`);
const server = createServer((request, response) => {
    const url = new URL(request.url, "http://localhost");
    if (url.pathname === "/real.json") return void response.writeHead(200, {"Content-Type": "application/json"}).end(readFileSync(snapshotFile));
    const folder = url.pathname.startsWith("/ark/") ? path.join(root, "public") : site;
    const file = path.join(folder, path.normalize(url.pathname).replace(/^\/+/, "") || "index.html");
    if (!file.startsWith(folder) || !existsSync(file)) return void response.writeHead(404).end();
    const type = file.endsWith(".html") ? "text/html" : file.endsWith(".js") ? "text/javascript" : file.endsWith(".webp") ? "image/webp" : file.endsWith(".json") ? "application/json" : file.endsWith(".hdr") ? "application/octet-stream" : "application/octet-stream";
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
const context = await browser.newContext({viewport: {width: Number(arg("width", "1280")), height: Number(arg("height", "720"))}});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${base}?world=v2&quality=${arg("quality", "high")}&epoch=${plan[0]?.epoch ?? ""}`, {waitUntil: "domcontentloaded", timeout: 120000});
const started = Date.now();
while (Date.now() - started < 240000) {
    const state = await page.evaluate(() => ({ok: Boolean(window.__canopy?.ready?.()), error: window.__canopyError ?? null}));
    if (state.error) throw new Error(state.error);
    if (state.ok) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
}
const notes = [];
for (const shot of plan) {
    if (shot.find) {
        // (A moment found on the page's own schedule: the first climb of these kinds from `from`, `after` seconds into it.)
        // (Or, with `phases`, the first moment one of them is swinging, leaping or in flight on its canopy route.)
        const found = await page.evaluate(async (f) => (f.phases ? window.__canopy.findCanopy(f.pattern, f.phases, f.from, f.seconds ?? 1800, f.step ?? 1, f.skip ?? []) : window.__canopy.findClimb(f.pattern, f.from, f.seconds ?? 1800, f.step ?? 2, f.skip ?? [])), shot.find);
        console.log(shot.name, "found", JSON.stringify(found));
        if (!found) continue;
        shot.epoch = found.epoch + (shot.find.after ?? 1);
        shot.id = found.id;
    }
    const note = await page.evaluate(async (s) => {
        const c = window.__canopy;
        if (s.hours !== undefined) c.hours(s.hours);
        await c.at(s.epoch, s.run ?? 2);
        if (s.id) return JSON.stringify(await c.frame(s.id, s.distance, s.azimuth ?? 0.7, s.polar ?? 1.3, s.lift ?? 0));
        await c.look(s.target, s.distance, s.azimuth ?? 0.7, s.polar ?? 1.3);
        return "view";
    }, shot);
    await page.screenshot({path: path.join(out, `${shot.name}.jpg`), type: "jpeg", quality: 88});
    notes.push(`${shot.name}: epoch ${shot.epoch} id ${shot.id ?? "-"} ${note}`);
    console.log(shot.name, note);
}
writeFileSync(path.join(out, "notes.txt"), notes.concat(errors.map((e) => `error: ${e}`)).join("\n") + "\n");
if (errors.length) console.log("page errors:", errors.slice(0, 5));
await browser.close();
server.close();
