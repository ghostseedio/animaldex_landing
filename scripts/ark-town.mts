#!/usr/bin/env -S npx tsx
/**
 * The town island's workbench (docs/ark/town-island.md): builds the town's page (`src/ark-scene/islands/town/entry.ts`),
 * serves it, and drives it in headless Chromium.
 *
 *   npx tsx scripts/ark-town.mts stills  [--out dir] [--quality high] [--size 1280x720] [--only id,id] [--gpu metal|swiftshader]
 *   npx tsx scripts/ark-town.mts fly     [--out dir] [--seconds 48] [--fps 24] [--quality high]   frames → mp4 (ffmpeg)
 *   npx tsx scripts/ark-town.mts perf    [--out dir] [--seconds 20]                               per tier and device
 *   npx tsx scripts/ark-town.mts visual  [--update]                                                SwiftShader, compare
 *                                                                                                   with tests/ark-visual/town
 * Run under `nice -n 10` on the shared Mac.
 */

import {execFileSync} from "node:child_process";
import {createServer} from "node:http";
import {existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import os from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {build} from "esbuild";
import sharp from "sharp";
import {compareImages, diffPicture, toleranceFor, type VisualTolerance} from "../src/ark-scene/runtime/visual-compare";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const command = argv[0] && !argv[0].startsWith("--") ? argv[0] : "stills";
const arg = (name: string, fallback: string) => {
    const at = argv.indexOf(`--${name}`);
    return at >= 0 && argv[at + 1] && !argv[at + 1].startsWith("--") ? argv[at + 1] : fallback;
};
const flag = (name: string) => argv.includes(`--${name}`);
const log = (...parts: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...parts);

const site = path.join(root, ".ark-golden", "town-site");
mkdirSync(site, {recursive: true});
await build({
    entryPoints: [path.join(root, "src/ark-scene/islands/town/entry.ts")],
    outfile: path.join(site, "town.js"),
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["es2020"],
    minify: true,
    tsconfig: path.join(root, "tsconfig.json"),
    define: {"process.env.NODE_ENV": JSON.stringify("production")},
    logLevel: "warning",
    metafile: true
}).then((result) => {
    const bytes = Object.values(result.metafile!.outputs).reduce((sum, o) => sum + o.bytes, 0);
    log(`town.js ${(bytes / 1024).toFixed(0)} KB`);
});
writeFileSync(path.join(site, "town.html"), `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><style>html,body{margin:0;height:100%;background:#9fb6cc;overflow:hidden}#ark-town{width:100vw;height:100vh}</style></head><body><div id="ark-town"></div><script src="town.js"></script></body></html>`);

const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    const fromPublic = url.pathname.startsWith("/ark/graphics/");
    const folder = fromPublic ? path.join(root, "public") : site;
    const file = path.join(folder, path.normalize(url.pathname).replace(/^\/+/, "") || "town.html");
    if (!file.startsWith(folder) || !existsSync(file)) return void response.writeHead(404).end();
    const type = file.endsWith(".html") ? "text/html" : file.endsWith(".js") ? "text/javascript" : "application/octet-stream";
    response.writeHead(200, {"Content-Type": type}).end(readFileSync(file));
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${(server.address() as {port: number}).port}`;

/** The Chromium playwright-core pins, on the Mac or on Linux (CI), as `scripts/ark-visual.mts` finds it. */
function cachedChromium(): string | undefined {
    if (process.env.ARK_CHROMIUM) return process.env.ARK_CHROMIUM;
    const cache = process.platform === "darwin" ? path.join(os.homedir(), "Library", "Caches", "ms-playwright") : path.join(os.homedir(), ".cache", "ms-playwright");
    if (!existsSync(cache)) return undefined;
    for (const name of readdirSync(cache).filter((entry) => /^chromium-\d+$/.test(entry)).sort().reverse()) {
        const found = [
            path.join(cache, name, "chrome-mac-arm64", "Google Chrome for Testing.app", "Contents", "MacOS", "Google Chrome for Testing"),
            path.join(cache, name, "chrome-linux64", "chrome"),
            path.join(cache, name, "chrome-linux", "chrome")
        ].find((candidate) => existsSync(candidate));
        if (found) return found;
    }
    return undefined;
}
const {chromium} = await import("playwright-core");
const gpu = arg("gpu", command === "visual" ? "swiftshader" : "metal");
const gpuArgs = gpu === "swiftshader" ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--use-gl=angle"] : ["--enable-gpu", "--ignore-gpu-blocklist", ...(process.platform === "darwin" ? ["--use-angle=metal"] : [])];
const browser = await chromium.launch({
    executablePath: cachedChromium(),
    headless: true,
    args: ["--headless=new", "--enable-precise-memory-info", ...gpuArgs, "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--font-render-hinting=none", "--force-color-profile=srgb"]
});

type Device = {width: number; height: number; scale: number; mobile: boolean};
async function open(quality: string, device: Device, extra = "") {
    const context = await browser.newContext({viewport: {width: device.width, height: device.height}, deviceScaleFactor: device.scale, isMobile: device.mobile, hasTouch: device.mobile});
    const page = await context.newPage();
    // SwiftShader on the shared Mac under load: a frame of the town can take minutes.
    page.setDefaultTimeout(900_000);
    page.on("pageerror", (error) => log("page error:", error.message));
    page.on("console", (message) => {
        if (message.type() === "error") log("console:", message.text());
    });
    await page.goto(`${base}/town.html?quality=${quality}${extra}`, {waitUntil: "domcontentloaded", timeout: 1_800_000});
    await page.waitForFunction(() => window.__arkTown?.ready, null, {timeout: 1_800_000});
    // The day sky (HDR) loads after mount: give it a moment.
    await page.waitForTimeout(2500);
    return {context, page};
}

const [width, height] = arg("size", "1280x720").split("x").map(Number);
const quality = arg("quality", "high");

if (command === "stills") {
    const out = path.resolve(arg("out", path.join(root, ".ark-golden", "town", "stills")));
    mkdirSync(out, {recursive: true});
    const {context, page} = await open(quality, {width, height, scale: 1, mobile: false});
    const ids = (await page.evaluate(() => window.__arkTown!.shots.map((s) => s.id))) as string[];
    const only = arg("only", "") ? new Set(arg("only", "").split(",")) : null;
    for (const id of ids) {
        if (only && !only.has(id)) continue;
        await page.evaluate((shot) => {
            window.__arkTown!.shot(shot);
            window.__arkTown!.render(3);
        }, id);
        const png = await page.screenshot({type: "png"});
        await sharp(png).jpeg({quality: 88}).toFile(path.join(out, `${id}.jpg`));
        log("still", id);
    }
    const stats = await page.evaluate(() => window.__arkTown!.stats());
    writeFileSync(path.join(out, "stats.json"), JSON.stringify(stats, null, 2));
    log(JSON.stringify(stats));
    await context.close();
}

if (command === "fly") {
    const out = path.resolve(arg("out", path.join(root, ".ark-golden", "town", "fly")));
    const frames = path.join(out, "frames");
    rmSync(frames, {recursive: true, force: true});
    mkdirSync(frames, {recursive: true});
    const seconds = Number(arg("seconds", "48"));
    const fps = Number(arg("fps", "24"));
    const {context, page} = await open(quality, {width, height, scale: 1, mobile: false});
    const total = Math.round(seconds * fps);
    for (let i = 0; i < total; i++) {
        await page.evaluate(({t, time}) => {
            const pose = window.__arkTown!.flyPose(t);
            (window as unknown as {__townTime?: number}).__townTime = time;
            window.__arkTown!.view(pose.eye, pose.target, pose.hours);
        }, {t: i / total, time: i / fps});
        const png = await page.screenshot({type: "jpeg", quality: 90});
        writeFileSync(path.join(frames, `${String(i).padStart(5, "0")}.jpg`), png);
        if (i % 60 === 0) log(`frame ${i}/${total}`);
    }
    await context.close();
    const video = path.join(out, `town-flythrough-${quality}.mp4`);
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(fps), "-i", path.join(frames, "%05d.jpg"), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", video]);
    log("video", video);
}

if (command === "perf") {
    const out = path.resolve(arg("out", path.join(root, ".ark-golden", "town", "perf")));
    mkdirSync(out, {recursive: true});
    const seconds = Number(arg("seconds", "20"));
    const runs = [
        {device: "desktop", quality: "high"},
        {device: "desktop", quality: "medium"},
        {device: "desktop", quality: "low"},
        {device: "phone", quality: "medium"},
        {device: "phone", quality: "low"}
    ];
    const results: unknown[] = [];
    for (const run of runs) {
        const phone = run.device === "phone";
        const t0 = Date.now();
        const {context, page} = await open(run.quality, phone ? {width: 360, height: 800, scale: 2, mobile: true} : {width: 1280, height: 720, scale: 1, mobile: false});
        if (phone) await (await context.newCDPSession(page)).send("Emulation.setCPUThrottlingRate", {rate: 4});
        const mountMs = await page.evaluate(() => window.__arkTown!.mountMs);
        const perf = await page.evaluate((s) => window.__arkTown!.perf(s), seconds);
        const stats = await page.evaluate(() => window.__arkTown!.stats());
        const result = {...run, mountMs: Math.round(mountMs), openMs: Date.now() - t0, perf, stats};
        results.push(result);
        log(JSON.stringify(result));
        await context.close();
    }
    writeFileSync(path.join(out, "perf.json"), JSON.stringify({gpu, machineLoad: os.loadavg(), results}, null, 2));
}

if (command === "visual") {
    // A small set at the CI's size on SwiftShader, compared with tests/ark-visual/town/<id>.webp.
    const dir = path.join(root, "tests", "ark-visual", "town");
    mkdirSync(dir, {recursive: true});
    const out = path.join(root, ".ark-golden", "town", "visual");
    mkdirSync(path.join(out, "actual"), {recursive: true});
    mkdirSync(path.join(out, "diff"), {recursive: true});
    const config = JSON.parse(readFileSync(path.join(dir, "config.json"), "utf8")) as {shots: string[]; width: number; height: number; quality: string; tolerance?: Partial<VisualTolerance>};
    const {context, page} = await open(config.quality, {width: config.width, height: config.height, scale: 1, mobile: false}, "&sky=0");
    let failed = 0;
    const report: string[] = ["| shot | result | changed | mean | block |", "|---|---|---|---|---|"];
    for (const id of config.shots) {
        await page.evaluate((shot) => {
            window.__arkTown!.shot(shot, 20406);
            window.__arkTown!.render(3);
        }, id);
        const png = await page.screenshot({type: "png"});
        const file = path.join(dir, `${id}.webp`);
        await sharp(png).webp({nearLossless: true, quality: 60, effort: 5}).toFile(path.join(out, "actual", `${id}.webp`));
        if (flag("update") || !existsSync(file)) {
            await sharp(png).webp({nearLossless: true, quality: 60, effort: 5}).toFile(file);
            report.push(`| ${id} | ${existsSync(file) && !flag("update") ? "new" : "accepted"} | | | |`);
            continue;
        }
        const raw = async (input: Buffer | string) => {
            const {data, info} = await sharp(input).ensureAlpha().raw().toBuffer({resolveWithObject: true});
            return {data, width: info.width, height: info.height};
        };
        const a = await raw(png);
        const b = await raw(file);
        const tolerance = toleranceFor(id, {tolerance: config.tolerance});
        const mask = new Uint8Array(a.width * a.height);
        const diff = compareImages(a.data, b.data, a.width, a.height, tolerance, mask);
        if (!diff.pass) {
            failed++;
            const picture = diffPicture(a.data, mask, a.width, a.height);
            await sharp(Buffer.from(picture), {raw: {width: a.width, height: a.height, channels: 4}}).png().toFile(path.join(out, "diff", `${id}.png`));
        }
        report.push(`| ${id} | ${diff.pass ? "pass" : "FAIL"} | ${(diff.changed * 100).toFixed(2)}% | ${diff.mean.toFixed(2)} | ${(diff.block * 100).toFixed(1)}% |`);
        log(id, diff.pass ? "pass" : "FAIL", JSON.stringify(diff));
    }
    writeFileSync(path.join(out, "report.md"), report.join("\n") + "\n");
    await context.close();
    await browser.close();
    server.close();
    process.exit(failed ? 1 : 0);
}

await browser.close();
server.close();
