#!/usr/bin/env node
/**
 * True-scale comparison shots (motion pass §3, `docs/ark/true-scale.md`): builds `src/ark-scene/true-scale-entry.ts`
 * into `.ark-golden/true-scale/` (gitignored), serves it, and screenshots each lineup before (the old compressed
 * length, `clamp(1.2 · L^0.6, 0.18, 9)` from origin/main's species-stats.json) and after (true scale).
 *
 *   node scripts/ark-true-scale-shots.mjs --out <dir> [--shots giants,large,human,small,insect] [--old <old species-stats.json>]
 */
import {createServer} from "node:http";
import {execFileSync} from "node:child_process";
import {existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync} from "node:fs";
import os from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {build} from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name, fallback) => {
    const at = process.argv.indexOf(`--${name}`);
    return at > 0 ? process.argv[at + 1] : fallback;
};
const out = path.resolve(arg("out", path.join(root, ".ark-golden", "true-scale", "shots")));
const shots = arg("shots", "giants,large,human,small,insect").split(",");
mkdirSync(out, {recursive: true});

// The old drawn lengths: origin/main's table through the old curve.
const oldTable = JSON.parse(arg("old") ? readFileSync(arg("old"), "utf8") : execFileSync("git", ["show", "origin/main:src/ark-scene/species-stats.json"], {cwd: root, encoding: "utf8"})).species;
const ANCHORS = [[0.000003, 1], [0.0001, 2], [0.02, 5], [0.1, 9], [0.4, 13], [1, 17], [3, 22], [5, 26], [15, 30], [40, 42], [80, 47], [150, 55], [250, 62], [500, 70], [1000, 78], [3000, 84], [6000, 92], [30000, 95], [150000, 100]];
const mass = (size) => {
    if (size <= ANCHORS[0][1]) return ANCHORS[0][0];
    if (size >= ANCHORS.at(-1)[1]) return ANCHORS.at(-1)[0];
    for (let i = 1; i < ANCHORS.length; i++) {
        const [um, us] = ANCHORS[i];
        if (size > us) continue;
        const [lm, ls] = ANCHORS[i - 1];
        const t = (size - ls) / (us - ls);
        return 10 ** (Math.log10(lm) + t * (Math.log10(um) - Math.log10(lm)));
    }
    return ANCHORS.at(-1)[0];
};
const oldDrawn = {};
for (const [slug, row] of Object.entries(oldTable)) {
    const L = row.length > 5 && row[5] > 0 ? row[5] : 0.33 * Math.cbrt(mass(row[0]));
    oldDrawn[slug] = Math.min(Math.max(1.2 * L ** 0.6, 0.18), 9);
}

const site = path.join(root, ".ark-golden", "true-scale", "site");
mkdirSync(site, {recursive: true});
await build({entryPoints: [path.join(root, "src/ark-scene/true-scale-entry.ts")], outfile: path.join(site, "true-scale.js"), bundle: true, format: "iife", platform: "browser", target: ["es2020"], minify: true, tsconfig: path.join(root, "tsconfig.json"), define: {"process.env.NODE_ENV": JSON.stringify("development")}, logLevel: "warning"});
writeFileSync(path.join(site, "true-scale.html"), `<!doctype html><html><head><meta charset="utf-8"><title>Ark true scale</title><style>html,body{margin:0;height:100%;overflow:hidden;background:#cfe0ec}</style></head><body><script>window.__oldDrawn=${JSON.stringify(oldDrawn)}</script><script src="./true-scale.js"></script></body></html>`);
const server = createServer((request, response) => {
    const url = new URL(request.url, "http://localhost");
    const fromPublic = url.pathname.startsWith("/ark/assets/");
    const folder = fromPublic ? path.join(root, "public") : site;
    const file = path.join(folder, path.normalize(url.pathname).replace(/^\/+/, "") || "true-scale.html");
    if (!file.startsWith(folder) || !existsSync(file)) return response.writeHead(404).end();
    const type = file.endsWith(".html") ? "text/html" : file.endsWith(".js") ? "text/javascript" : file.endsWith(".glb") ? "model/gltf-binary" : file.endsWith(".webp") ? "image/webp" : "application/octet-stream";
    response.writeHead(200, {"Content-Type": type}).end(readFileSync(file));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;

function cachedChromium() {
    const cache = path.join(os.homedir(), "Library", "Caches", "ms-playwright");
    if (!existsSync(cache)) return null;
    for (const name of readdirSync(cache).filter((entry) => /^chromium-\d+$/.test(entry)).sort().reverse()) {
        const candidate = path.join(cache, name, "chrome-mac-arm64", "Google Chrome for Testing.app", "Contents", "MacOS", "Google Chrome for Testing");
        if (existsSync(candidate)) return candidate;
    }
    return null;
}
const {chromium} = await import("playwright-core");
const browser = await chromium.launch({executablePath: process.env.ARK_CHROMIUM || cachedChromium() || undefined, headless: true, args: ["--headless=new", "--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=metal"]});
const numbers = {};
for (const shot of shots) {
    for (const mode of ["before", "after"]) {
        const page = await browser.newPage({viewport: {width: 1600, height: 900}});
        page.on("pageerror", (error) => console.error(shot, mode, String(error)));
        await page.goto(`${base}/true-scale.html?shot=${shot}&mode=${mode}`, {timeout: 180_000});
        await page.waitForFunction(() => window.__trueScale?.ready, null, {timeout: 240_000});
        const state = await page.evaluate(() => window.__trueScale);
        if (state.error) console.error(shot, mode, state.error);
        await page.waitForTimeout(400);
        await page.screenshot({path: path.join(out, `${shot}-${mode}.png`)});
        numbers[`${shot}-${mode}`] = state.drawn;
        console.log(shot, mode, JSON.stringify(state.drawn));
        await page.close();
    }
}
writeFileSync(path.join(out, "drawn.json"), JSON.stringify(numbers, null, 1));
await browser.close();
server.close();
