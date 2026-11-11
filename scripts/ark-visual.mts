#!/usr/bin/env -S npx tsx
/**
 * The Ark's visual-regression check (docs/ark/visual-ci.md).
 *
 *   npx tsx scripts/ark-visual.mts                 render the set in tests/ark-visual/config.json, compare with the
 *                                                  baselines, write .ark-golden/visual/ (report.md, report.json,
 *                                                  actual/*.webp, diff/*.png); exit 1 on any failure
 *   npx tsx scripts/ark-visual.mts --update        render and write the results as the new baselines (accept)
 *   npx tsx scripts/ark-visual.mts accept --from <dir> [--only id,id]
 *                                                  accept a run's pictures (a CI artifact's actual/) as baselines
 *   npx tsx scripts/ark-visual.mts hooks           run the other lanes' checks in tests/ark-visual/hooks.json
 *   options: --only id,id  --devices desktop,phone  --gpu swiftshader|metal  --out <dir>  --headed
 *
 * The page is the golden-shot page (`src/ark-scene/golden-entry.ts`, the same shots and framing as
 * scripts/ark-golden-shots.mjs), with two things added before it runs: WebGL on SwiftShader (the same software
 * renderer on a Mac and on the CI's Linux, so a baseline taken on one holds on the other), and a clock that the
 * harness freezes at a fixed time for each shot, so the water, grass, clouds, light and the animals' schedules are
 * the same on every run. What still moves between runs (an animal looping on its own) is inside the tolerances.
 */

import {execSync, spawnSync} from "node:child_process";
import {createServer} from "node:http";
import {copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync} from "node:fs";
import os from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {build} from "esbuild";
import sharp from "sharp";
import {compareImages, diffPicture, toleranceFor, type VisualDiff, type VisualTolerance} from "../src/ark-scene/runtime/visual-compare";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const arg = (name: string, fallback: string) => {
    const at = argv.indexOf(`--${name}`);
    return at >= 0 && argv[at + 1] && !argv[at + 1].startsWith("--") ? argv[at + 1] : fallback;
};
const flag = (name: string) => argv.includes(`--${name}`);
const command = argv[0] && !argv[0].startsWith("--") ? argv[0] : "check";

type Device = {width: number; height: number; deviceScaleFactor: number; mobile: boolean; quality: "high" | "medium" | "low"};
type Shot = {device: string; place: string; time: "day" | "dusk" | "night"};
type Config = {devices: Record<string, Device>; shots: Shot[]; tolerance?: Partial<VisualTolerance>; overrides?: Record<string, Partial<VisualTolerance>>};
type Hook = {name: string; lane?: string; requires: string[]; command: string; artifacts?: string; enabled?: boolean};

const visualDir = path.join(root, "tests", "ark-visual");
const baselines = path.join(visualDir, "baselines");
const config = JSON.parse(readFileSync(path.join(visualDir, "config.json"), "utf8")) as Config;
const idOf = (shot: Shot) => `${shot.device}-${shot.place}-${shot.time}`;
const only = arg("only", "") ? new Set(arg("only", "").split(",")) : null;
const log = (...parts: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...parts);

/** A baseline: near-lossless WebP (small in git, every pixel within a few levels of the render). */
async function writeBaseline(png: Buffer, file: string) {
    await sharp(png).webp({nearLossless: true, quality: 60, effort: 5}).toFile(file);
}

async function raw(file: Buffer | string): Promise<{data: Buffer; width: number; height: number}> {
    const {data, info} = await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject: true});
    return {data, width: info.width, height: info.height};
}

// MARK: accept and hooks

if (command === "accept") {
    const from = path.resolve(arg("from", path.join(root, ".ark-golden", "visual")));
    const folder = existsSync(path.join(from, "actual")) ? path.join(from, "actual") : from;
    mkdirSync(baselines, {recursive: true});
    let accepted = 0;
    for (const name of readdirSync(folder).filter((entry) => entry.endsWith(".webp"))) {
        const id = name.replace(/\.webp$/, "");
        if (only && !only.has(id)) continue;
        if (!config.shots.some((shot) => idOf(shot) === id)) continue;
        copyFileSync(path.join(folder, name), path.join(baselines, name));
        accepted++;
        log("accepted", id);
    }
    log(`${accepted} baselines accepted from ${folder}; commit tests/ark-visual/baselines.`);
    process.exit(accepted ? 0 : 1);
}

if (command === "hooks") {
    const {hooks} = JSON.parse(readFileSync(path.join(visualDir, "hooks.json"), "utf8")) as {hooks: Hook[]};
    let failed = 0;
    for (const hook of hooks) {
        const missing = hook.requires.filter((file) => !existsSync(path.join(root, file)));
        if (hook.enabled === false || missing.length) {
            log(`skip  ${hook.name}${missing.length ? ` (not landed: ${missing.join(", ")})` : " (disabled)"}`);
            continue;
        }
        log(`run   ${hook.name}: ${hook.command}`);
        const result = spawnSync(hook.command, {cwd: root, shell: true, stdio: "inherit"});
        if (result.status !== 0) {
            failed++;
            log(`FAIL  ${hook.name} (exit ${result.status})`);
        } else {
            log(`pass  ${hook.name}`);
        }
    }
    process.exit(failed ? 1 : 0);
}

// MARK: build + serve the golden page

const out = path.resolve(arg("out", path.join(root, ".ark-golden", "visual")));
const site = path.join(root, ".ark-golden", "visual-site");
for (const folder of [site, out, path.join(out, "actual"), path.join(out, "diff"), baselines]) mkdirSync(folder, {recursive: true});
await build({
    entryPoints: [path.join(root, "src/ark-scene/golden-entry.ts")],
    outfile: path.join(site, "golden-scene.js"),
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["es2020"],
    minify: true,
    tsconfig: path.join(root, "tsconfig.json"),
    define: {"process.env.NODE_ENV": JSON.stringify("development")},
    logLevel: "warning"
});
writeFileSync(path.join(site, "golden.html"), `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover">
<title>Ark visual check</title>
<style>html,body{margin:0;height:100%;background:#ecdcc4;overflow:hidden}#ark{position:fixed;inset:0}</style>
</head><body><div id="ark"></div><script src="./golden-scene.js"></script></body></html>
`);
const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    const fromPublic = url.pathname.startsWith("/ark/");
    const folder = fromPublic ? path.join(root, "public") : site;
    const file = path.join(folder, path.normalize(url.pathname).replace(/^\/+/, "") || "golden.html");
    if (!file.startsWith(folder) || !existsSync(file)) {
        response.writeHead(404).end();
        return;
    }
    const type = file.endsWith(".html") ? "text/html" : file.endsWith(".js") ? "text/javascript" : file.endsWith(".webp") ? "image/webp" : file.endsWith(".json") ? "application/json" : "application/octet-stream";
    response.writeHead(200, {"Content-Type": type, "Cache-Control": "no-store"}).end(readFileSync(file));
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
const base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;

// MARK: browser

function cachedChromium(): string | undefined {
    if (process.env.ARK_CHROMIUM) return process.env.ARK_CHROMIUM;
    const cache = process.platform === "darwin" ? path.join(os.homedir(), "Library", "Caches", "ms-playwright") : path.join(os.homedir(), ".cache", "ms-playwright");
    if (!existsSync(cache)) return undefined;
    for (const name of readdirSync(cache).filter((entry) => /^chromium-\d+$/.test(entry)).sort().reverse()) {
        const candidates = [
            path.join(cache, name, "chrome-mac-arm64", "Google Chrome for Testing.app", "Contents", "MacOS", "Google Chrome for Testing"),
            path.join(cache, name, "chrome-linux64", "chrome"),
            path.join(cache, name, "chrome-linux", "chrome")
        ];
        const found = candidates.find((candidate) => existsSync(candidate));
        if (found) return found;
    }
    return undefined;
}

const {chromium} = await import("playwright-core");
const gpu = arg("gpu", "swiftshader");
const gpuArgs = gpu === "swiftshader"
    ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--use-gl=angle"]
    : ["--enable-gpu", "--ignore-gpu-blocklist", ...(process.platform === "darwin" ? ["--use-angle=metal"] : [])];
const browser = await chromium.launch({
    executablePath: cachedChromium(),
    headless: !flag("headed"),
    args: [...(flag("headed") ? [] : ["--headless=new"]), ...gpuArgs, "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--font-render-hinting=none", "--force-color-profile=srgb"]
});
const chromiumVersion = browser.version();

/**
 * Before the page's own script: a clock the harness can freeze (performance.now and Date.now). A string, not a
 * function: tsx keeps function names with a helper the page does not have.
 */
const CLOCK = `(() => {
    const real = performance.now.bind(performance);
    // A fixed epoch: the island clock's days and the schedules' trips are the same on every run.
    const epoch = Date.UTC(2026, 5, 21, 9, 0, 0);
    let frozen = null;
    let offset = 0;
    const now = () => (frozen === null ? real() + offset : frozen);
    performance.now = now;
    Date.now = () => Math.round(epoch + now());
    window.__arkClock = {
        freeze: (ms) => { frozen = ms; },
        run: () => { if (frozen === null) return; offset = frozen - real(); frozen = null; }
    };
})();`;

/** Draw `n` frames, then resolve (a string for the same reason). */
const FRAMES = (n: number) => `new Promise((resolve) => { let k = 0; const step = () => (++k >= ${n} ? resolve(true) : requestAnimationFrame(step)); requestAnimationFrame(step); })`;

type GoldenWindow = Window & {
    __arkGolden?: {prepare: () => Promise<{settled: boolean; stats: {tier: string}}>; shoot: (place: string, time: string) => Promise<{anchor: string}>};
    __arkGoldenError?: string;
    __arkClock: {freeze: (ms: number) => void; run: () => void};
};

type Row = {id: string; device: string; place: string; time: string; anchor: string; status: "pass" | "fail" | "new"; diff: VisualDiff | null; tolerance: VisualTolerance; ms: number};
const rows: Row[] = [];
const devices = arg("devices", Object.keys(config.devices).join(",")).split(",").filter((name) => config.devices[name]);
const shots = config.shots.filter((shot) => devices.includes(shot.device) && (!only || only.has(idOf(shot))));
const update = flag("update");
const errors: string[] = [];

for (const deviceName of devices) {
    const device = config.devices[deviceName];
    const list = shots.filter((shot) => shot.device === deviceName);
    if (!list.length) continue;
    const context = await browser.newContext({viewport: {width: device.width, height: device.height}, deviceScaleFactor: device.deviceScaleFactor, isMobile: device.mobile, hasTouch: device.mobile});
    await context.addInitScript({content: CLOCK});
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(`${deviceName}: ${String(error)}`));
    page.on("console", (message) => {
        if (message.type() === "error" && !/Failed to load resource/.test(message.text())) errors.push(`${deviceName}: ${message.text()}`);
    });
    await page.goto(`${base}/golden.html?quality=${device.quality}`);
    await page.waitForFunction(() => (window as unknown as GoldenWindow).__arkGolden || (window as unknown as GoldenWindow).__arkGoldenError, null, {timeout: 180_000});
    const failed = await page.evaluate(() => (window as unknown as GoldenWindow).__arkGoldenError);
    if (failed) throw new Error(failed);
    const prepared = await page.evaluate(() => (window as unknown as GoldenWindow).__arkGolden!.prepare());
    log(deviceName, "prepared", JSON.stringify({settled: prepared.settled, tier: prepared.stats.tier}));
    for (const shot of list) {
        const started = Date.now();
        const id = idOf(shot);
        const index = config.shots.findIndex((s) => idOf(s) === id);
        const framed = await page.evaluate(([place, time]) => (window as unknown as GoldenWindow).__arkGolden!.shoot(place, time), [shot.place, shot.time] as const);
        // The clock frozen at this shot's own time (an hour apart per shot, always ahead of the page's), then a few
        // frames drawn at it: everything that follows the clock is where it is on every run.
        await page.evaluate((ms) => (window as unknown as GoldenWindow).__arkClock.freeze(ms), 4e7 + index * 3.6e6);
        await page.evaluate(FRAMES(6));
        const png = await page.screenshot({type: "png"});
        await page.evaluate(() => (window as unknown as GoldenWindow).__arkClock.run());
        const tolerance = toleranceFor(id, config);
        const baselineFile = path.join(baselines, `${id}.webp`);
        await writeBaseline(png, path.join(out, "actual", `${id}.webp`));
        let diff: VisualDiff | null = null;
        let status: Row["status"] = "new";
        if (update) {
            await writeBaseline(png, baselineFile);
        } else if (existsSync(baselineFile)) {
            const a = await raw(png);
            const b = await raw(baselineFile);
            const mask = new Uint8Array(a.width * a.height);
            diff = a.width === b.width && a.height === b.height ? compareImages(a.data, b.data, a.width, a.height, tolerance, mask) : compareImages(a.data, new Uint8Array(0), a.width, a.height, tolerance);
            status = diff.pass ? "pass" : "fail";
            if (!diff.pass && !diff.failed.includes("size")) {
                await sharp(Buffer.from(diffPicture(a.data, mask, a.width, a.height)), {raw: {width: a.width, height: a.height, channels: 4}}).png().toFile(path.join(out, "diff", `${id}.png`));
            }
        }
        rows.push({id, device: deviceName, place: shot.place, time: shot.time, anchor: framed.anchor, status, diff, tolerance, ms: Date.now() - started});
        log(deviceName, id, update ? "written as baseline" : status, diff ? `changed ${(diff.changed * 100).toFixed(2)}%, mean ${diff.mean}, worst tile ${(diff.block * 100).toFixed(1)}%` : "", `${((Date.now() - started) / 1000).toFixed(1)} s`);
    }
    await context.close();
}
await browser.close();
server.close();

// MARK: report

const fails = rows.filter((row) => row.status === "fail");
const fresh = rows.filter((row) => row.status === "new");
let commit = "";
try {
    commit = execSync("git rev-parse --short HEAD", {cwd: root}).toString().trim();
} catch {
    commit = "?";
}
writeFileSync(path.join(out, "report.json"), JSON.stringify({commit, chromium: chromiumVersion, gpu, update, rows, errors}, null, 2));
const lines = [
    `# Ark visual check: ${update ? "baselines written" : fails.length ? `${fails.length} of ${rows.length} shots differ` : fresh.length ? `${rows.length - fresh.length} pass, ${fresh.length} without a baseline` : `all ${rows.length} shots pass`}`,
    "",
    `Commit ${commit}, Chromium ${chromiumVersion}, WebGL on ${gpu}. Tolerances: a pixel counts as changed past ${config.tolerance?.pixel ?? 24}/255 in any channel; see tests/ark-visual/config.json. Diff pictures (changed pixels magenta) in \`diff/\`, this run's pictures in \`actual/\` (accept with \`npx tsx scripts/ark-visual.mts accept --from <this folder>\`).`,
    "",
    "| shot | result | changed | mean | worst tile | anchor |",
    "|---|---|---|---|---|---|",
    ...rows.map((row) => `| ${row.id} | ${row.status === "fail" ? `**fail** (${row.diff?.failed.join(", ")})` : row.status} | ${row.diff ? `${(row.diff.changed * 100).toFixed(2)}% / ${(row.tolerance.changed * 100).toFixed(1)}%` : "–"} | ${row.diff ? `${row.diff.mean} / ${row.tolerance.mean}` : "–"} | ${row.diff ? `${(row.diff.block * 100).toFixed(1)}% / ${(row.tolerance.block * 100).toFixed(0)}%` : "–"} | ${row.anchor} |`),
    "",
    errors.length ? `Page errors (${errors.length}):\n\n${errors.slice(0, 20).map((e) => `- ${e.split("\n")[0].slice(0, 300)}`).join("\n")}` : "No page errors.",
    ""
];
writeFileSync(path.join(out, "report.md"), lines.join("\n"));
console.log(lines.join("\n"));
if (process.env.GITHUB_STEP_SUMMARY) writeFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join("\n"), {flag: "a"});
process.exit(!update && fails.length ? 1 : 0);
