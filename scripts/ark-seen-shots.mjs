#!/usr/bin/env node
/**
 * V1's harness ("hunting and mating you can see", `src/ark-scene/seen/README.md`): builds
 * `src/ark-scene/seen/harness-entry.ts` into `.ark-golden/seen/` (gitignored), serves it with the scene's art and a
 * saved read of the real Ark and its public event log, and films LIVE LINES: for each, the record arrives at the live
 * log's own controller, the line is tapped and the act is watched on a running clock at the event's own time. Per
 * line: a short clip, a strip of eight frames, the still at the watch's telling moment and, in `summary.json`, the
 * watch's own account (who stood in, whether the layer acted it, how often each of the cast was drawn) and the line
 * in words (Ark Lite's). Per kind: a contact sheet of the stills (`sheet-<kind>.jpg`).
 *
 *   node scripts/ark-seen-shots.mjs --data <dir with voyage.json + events.json> --out <dir>
 *        [--kinds meal,escaped,mated,birth,death] [--count 20] [--events <id,id,…>] [--width 720 --height 1280]
 *        [--quality high|medium|low] [--step 3] [--no-clips] [--trace] (where each of the cast is, once a second)
 *
 * mated, birth and death are the record's own events; meal and escaped are made by the page from animals really
 * aboard while production has none (the first hunts come after the launch grace). The saved reads hold usernames:
 * keep them out of the repository.
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
const out = path.resolve(arg("out", path.join(root, ".ark-golden", "seen-shots")));
const kinds = arg("kinds", "meal,escaped,mated,birth,death").split(",");
const count = Number(arg("count", "20"));
const only = arg("events", "").split(",").filter(Boolean);
const width = Number(arg("width", "720"));
const height = Number(arg("height", "1280"));
const quality = arg("quality", "high");
const step = Number(arg("step", "3"));
const clips = !process.argv.includes("--no-clips");
mkdirSync(out, {recursive: true});

const site = path.join(root, ".ark-golden", "seen");
mkdirSync(site, {recursive: true});
await build({
    entryPoints: [path.join(root, "src/ark-scene/seen/harness-entry.ts")],
    outfile: path.join(site, "seen-scene.js"),
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["es2020"],
    minify: true,
    tsconfig: path.join(root, "tsconfig.json"),
    define: {"process.env.NODE_ENV": JSON.stringify("development")},
    logLevel: "warning"
});
writeFileSync(path.join(site, "seen.html"), `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Ark seen</title>
<style>html,body{margin:0;height:100%;background:#0b1020;overflow:hidden}#ark{position:fixed;inset:0}#log{position:fixed;inset:0;pointer-events:none}</style>
</head><body><div id="ark"></div><div id="log"></div><script>window.__ARK_WORLD__="v2"</script><script src="./seen-scene.js"></script></body></html>`);
const server = createServer((request, response) => {
    const url = new URL(request.url, "http://localhost");
    const folder = url.pathname.startsWith("/ark/") ? path.join(root, "public") : url.pathname.startsWith("/data/") ? data : site;
    const rel = url.pathname.startsWith("/data/") ? url.pathname.slice(6) : path.normalize(url.pathname).replace(/^\/+/, "") || "seen.html";
    const file = path.join(folder, rel);
    if (!file.startsWith(folder) || !existsSync(file)) {
        response.writeHead(404).end();
        return;
    }
    const type = file.endsWith(".html") ? "text/html" : file.endsWith(".js") ? "text/javascript" : file.endsWith(".webp") ? "image/webp" : file.endsWith(".json") ? "application/json" : "application/octet-stream";
    response.writeHead(200, {"Content-Type": type, "Cache-Control": "no-store"}).end(readFileSync(file));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}/seen.html`;

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
const slugOf = (text) => String(text).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

const context = await browser.newContext({viewport: {width, height}, deviceScaleFactor: 1});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message.slice(0, 300)));
page.on("console", (m) => {
    if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 300));
    if (m.text().startsWith("[seen]")) log(m.text().slice(0, 800));
});
log(`opening ${base}?quality=${quality} at ${width}×${height}`);
await page.goto(`${base}?quality=${quality}${process.argv.includes("--trace") ? "&trace=1" : ""}`, {waitUntil: "domcontentloaded", timeout: 180000});
await page.waitForFunction(() => window.__seen?.ready || window.__seenError, null, {timeout: 600000, polling: 500});
const failed = await page.evaluate(() => window.__seenError ?? null);
if (failed) {
    console.error("the harness page failed:", failed);
    await browser.close();
    server.close();
    process.exit(1);
}
log("mounted:", JSON.stringify(await page.evaluate(() => window.__seen.counts())));
// (The world's own loading first: the made lines ask where the animals are.)
for (let i = 0; i < 240; i++) {
    if (!(await page.evaluate(() => window.__seen.counts().loading))) break;
    await page.waitForTimeout(500);
}

const summary = [];
const film = async (kind, id, n) => {
    const entry = {kind, id, n, ok: false};
    summary.push(entry);
    let prepared;
    try {
        prepared = await page.evaluate((id) => window.__seen.prepare(id), id);
    } catch (error) {
        entry.error = String(error?.message ?? error).split("\n")[0];
        log(kind, id, "could not be prepared:", entry.error);
        return;
    }
    Object.assign(entry, {plan: prepared, text: await page.evaluate((id) => window.__seen.lite(id), id)});
    if (prepared.skipped) {
        entry.skipped = true;
        log(`${kind} ${id}: the layer does not act it (the two on different islands, or one on the wing): nothing to film; "${entry.text?.[0] ?? ""}"`);
        return;
    }
    const name = `${kind}-${String(n).padStart(2, "0")}-${id}-${slugOf(prepared.cast[0]?.name ?? kind)}`;
    entry.name = name;
    if (!prepared.watching) {
        log(`${name}: NOT watched (line ${JSON.stringify(prepared.line)}, ${prepared.lines} line(s), tap at ${prepared.tapAt} s)`);
        return;
    }
    const dir = path.join(out, `.frames-${name}`);
    rmSync(dir, {recursive: true, force: true});
    mkdirSync(dir, {recursive: true});
    const started = Date.now();
    let frames = 0;
    const times = [];
    let report = null;
    for (;;) {
        const frame = await page.evaluate(([q, s]) => {
            const f = window.__seen.frame(q, s);
            return {...f, kept: window.__seen.keep()};
        }, [0.86, step]);
        if (frame.kept) report = frame.kept;
        const comma = frame.image.indexOf(",");
        if (comma > 0) {
            writeFileSync(path.join(dir, `${String(frames).padStart(4, "0")}.jpg`), Buffer.from(frame.image.slice(comma + 1), "base64"));
            times.push(frame.t);
            frames++;
        }
        if (frame.done || frames > 1800) break;
    }
    const after = await page.evaluate(() => window.__seen.report());
    const seen = Object.fromEntries(Object.entries(report?.seen ?? {}).map(([castId, s]) => [castId, {role: s.role, shown: s.frames ? Math.round((s.shown / s.frames) * 100) : null}]));
    Object.assign(entry, {frames, seconds: times[times.length - 1] ?? 0, wall: Math.round((Date.now() - started) / 1000), report: report ? {acted: report.acted, reason: report.reason, notes: report.notes, keyAt: report.keyAt, hour: report.hour, night: report.night, gain: report.gain, standIns: report.standIns, pins: report.pins.length, sight: report.sight} : null, seen, cast: after.seen});
    const fps = 30 / step;
    const at = (seconds) => Math.min(Math.max(Math.round(seconds * fps), 0), frames - 1);
    // The still: the watch's own telling moment; without one, two thirds of the way through.
    // (Never during the camera's way in from where the viewer was: the watch's first second and a half.)
    // (A line tapped when its telling moment had passed: once the camera is in and has settled on what is still going on.)
    const key = at(typeof report?.keyAt === "number" ? (report.keyAt < 2.6 ? 5.5 : report.keyAt) : Math.max((times[times.length - 1] ?? 0) * 0.66, 2.6));
    execFileSync("cp", [path.join(dir, `${String(key).padStart(4, "0")}.jpg`), path.join(out, `${name}.jpg`)]);
    const last = times[times.length - 1] ?? 0;
    const picks = Array.from({length: 8}, (_, i) => at(1.5 + ((last - 2.5) * i) / 7));
    const strip = path.join(dir, "strip");
    mkdirSync(strip, {recursive: true});
    picks.forEach((frame, i) => execFileSync("cp", [path.join(dir, `${String(frame).padStart(4, "0")}.jpg`), path.join(strip, `${String(i).padStart(2, "0")}.jpg`)]));
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", "1", "-i", path.join(strip, "%02d.jpg"), "-vf", "scale=360:-1,tile=4x2:padding=4:color=black", "-frames:v", "1", path.join(out, `${name}-strip.jpg`)]);
    if (clips) execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(fps), "-i", path.join(dir, "%04d.jpg"), "-c:v", "libx264", "-preset", "veryfast", "-crf", "25", "-pix_fmt", "yuv420p", "-r", "30", path.join(out, `${name}.mp4`)]);
    rmSync(dir, {recursive: true, force: true});
    entry.ok = Boolean(report?.acted);
    log(`${name}: ${frames} frames (${entry.seconds.toFixed(1)} s) in ${entry.wall} s; ${report?.acted ? "acted" : `NOT acted: ${report?.reason}`}; key ${report?.keyAt}; stand-ins ${report?.standIns.length ?? 0}; seen ${Object.values(seen).map((s) => `${s.role} ${s.shown}%`).join(", ")}; sight ${report?.sight ? `${report.sight.searches} searches, ${report.sight.blocked} not clear ${JSON.stringify(report.sight.met)}` : "-"}; "${entry.text?.[0] ?? ""}"`);
};

for (const kind of kinds) {
    const ids = only.length ? only : await page.evaluate(([k, n]) => window.__seen.lines(k, n), [kind, count]);
    log(`${kind}: ${ids.length} line(s): ${ids.join(", ") || "none"}`);
    let n = 0;
    for (const id of ids) {
        // (A line the layer does not act is one of the lines all the same: counted, and not readable.)
        if (!only.length && summary.filter((e) => e.kind === kind).length >= count) break;
        await film(only.length ? await page.evaluate((id) => window.__seen.plan(id).kind, id).catch(() => kind) : kind, id, n + 1);
        n++;
    }
    // The kind's contact sheet: its stills, five to a row.
    const stills = summary.filter((e) => e.kind === kind && e.name && existsSync(path.join(out, `${e.name}.jpg`))).map((e) => path.join(out, `${e.name}.jpg`));
    if (stills.length && !only.length) {
        const tmp = path.join(out, `.sheet-${kind}`);
        rmSync(tmp, {recursive: true, force: true});
        mkdirSync(tmp, {recursive: true});
        stills.forEach((file, i) => execFileSync("cp", [file, path.join(tmp, `${String(i).padStart(2, "0")}.jpg`)]));
        for (let page = 0; page * 10 < stills.length; page++) {
            execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", "1", "-start_number", String(page * 10), "-i", path.join(tmp, "%02d.jpg"), "-vf", `scale=360:-1,tile=5x2:padding=6:color=black`, "-frames:v", "1", path.join(out, `sheet-${kind}-${page + 1}.jpg`)]);
        }
        rmSync(tmp, {recursive: true, force: true});
    }
    if (only.length) break;
}
// The departure fade: animals that leave the Ark between two reads (taken out of the read), a strip each.
const departs = Number(arg("departs", only.length ? "0" : "2"));
for (let n = 0; n < departs; n++) {
    const who = await page.evaluate((n) => window.__seen.depart(n), n);
    if (!who) continue;
    const dir = path.join(out, `.frames-depart-${n}`);
    rmSync(dir, {recursive: true, force: true});
    mkdirSync(dir, {recursive: true});
    let frames = 0;
    for (;;) {
        const frame = await page.evaluate(() => window.__seen.frame(0.86, 3));
        const comma = frame.image.indexOf(",");
        if (comma > 0) writeFileSync(path.join(dir, `${String(frames++).padStart(4, "0")}.jpg`), Buffer.from(frame.image.slice(comma + 1), "base64"));
        if (frame.done || frames > 120) break;
    }
    const name = `depart-${n + 1}-${slugOf(who.name)}`;
    // (As it stood, then every half second: the hold, the fade, gone.)
    const picks = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45].filter((i) => i < frames);
    const strip = path.join(dir, "strip");
    mkdirSync(strip, {recursive: true});
    picks.forEach((frame, i) => execFileSync("cp", [path.join(dir, `${String(frame).padStart(4, "0")}.jpg`), path.join(strip, `${String(i).padStart(2, "0")}.jpg`)]));
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", "1", "-i", path.join(strip, "%02d.jpg"), "-vf", "scale=240:-1,tile=10x1:padding=4:color=black", "-frames:v", "1", path.join(out, `${name}-strip.jpg`)]);
    rmSync(dir, {recursive: true, force: true});
    summary.push({kind: "depart", name, who, frames});
    log(`${name}: ${frames} frames`);
}
// The marks, from a fixture of the reads that are not live yet (E4's crises read, E3's `lone`), on a real animal: the page as a viewer sees it.
if (!only.length && !process.argv.includes("--no-marks")) {
    for (const what of ["last", "lone"]) {
        const got = await page.evaluate((what) => window.__seen.mark(what), what).catch((error) => ({error: String(error?.message ?? error)}));
        await page.screenshot({path: path.join(out, `mark-${what}.jpg`), type: "jpeg", quality: 88});
        summary.push({kind: "mark", what, got});
        log(`mark ${what}:`, JSON.stringify(got).slice(0, 300));
    }
}
writeFileSync(path.join(out, `summary${only.length ? `-${only.join("-")}` : ""}.json`), JSON.stringify({at: new Date().toISOString(), width, height, quality, step, errors: errors.slice(0, 40), events: summary}, null, 1));
if (errors.length) log("page errors:", errors.slice(0, 8));
await browser.close();
server.close();
