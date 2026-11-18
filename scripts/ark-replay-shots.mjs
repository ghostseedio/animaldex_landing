#!/usr/bin/env node
/**
 * The replay harness (V2 replay, `src/ark-scene/replay/README.md`): builds `src/ark-scene/replay/harness-entry.ts` into
 * `.ark-golden/replay/` (gitignored), serves it with the scene's art and a saved read of the real Ark and its public
 * event log, and has the recorder's own director film recorded events at their own time, several per page load. Per
 * event: a short clip, a strip of its frames, its key still and the shot's own account (who stood in, the cuts, whether
 * the scene's layer acted it, how often each of the cast was drawn).
 *
 *   node scripts/ark-replay-shots.mjs --data <dir with voyage.json + events.json> --out <dir>
 *        [--kinds mated,birth,death,extinct,meal,escaped,last_stand,released] [--count 5] [--events <id,id,…>]
 *        [--width 720 --height 1280] [--quality high|medium|low] [--step 3] [--hour <0-24>] [--mount show] [--no-clips]
 *
 * `voyage.json`: `/api/ark/voyage`'s answer; `events.json`: `{events: [...]}`, the rows of `/api/ark/events` (both public
 * reads; they hold usernames, so they stay out of the repository). mated, birth, death and extinct are the record's
 * own events; meal, escaped, last_stand and released are made by the page from animals really aboard while production
 * has none (the first hunts come after the launch grace; the last two kinds are not written by the server yet).
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
const out = path.resolve(arg("out", path.join(root, ".ark-golden", "replay-shots")));
const kinds = arg("kinds", "mated,birth,death,extinct,meal,escaped,last_stand,released").split(",");
let count = Number(arg("count", "5"));
const only = arg("events", "").split(",").filter(Boolean);
const width = Number(arg("width", "720"));
const height = Number(arg("height", "1280"));
const quality = arg("quality", "high");
const step = Number(arg("step", "3"));
const hour = arg("hour", null);
const mount = arg("mount", "cutaway");
const clips = !process.argv.includes("--no-clips");
const MADE = new Set(["meal", "escaped", "last_stand", "released"]);
mkdirSync(out, {recursive: true});

const site = path.join(root, ".ark-golden", "replay");
mkdirSync(site, {recursive: true});
await build({
    entryPoints: [path.join(root, "src/ark-scene/replay/harness-entry.ts")],
    outfile: path.join(site, "replay-scene.js"),
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["es2020"],
    minify: true,
    tsconfig: path.join(root, "tsconfig.json"),
    define: {"process.env.NODE_ENV": JSON.stringify("development")},
    logLevel: "warning"
});
writeFileSync(path.join(site, "replay.html"), `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Ark replay</title>
<style>html,body{margin:0;height:100%;background:#0b1020;overflow:hidden}#ark{position:fixed;inset:0}</style>
</head><body><div id="ark"></div><script>window.__ARK_WORLD__="v2"</script><script src="./replay-scene.js"></script></body></html>`);
const server = createServer((request, response) => {
    const url = new URL(request.url, "http://localhost");
    const folder = url.pathname.startsWith("/ark/") ? path.join(root, "public") : url.pathname.startsWith("/data/") ? data : site;
    const rel = url.pathname.startsWith("/data/") ? url.pathname.slice(6) : path.normalize(url.pathname).replace(/^\/+/, "") || "replay.html";
    const file = path.join(folder, rel);
    if (!file.startsWith(folder) || !existsSync(file)) {
        response.writeHead(404).end();
        return;
    }
    const type = file.endsWith(".html") ? "text/html" : file.endsWith(".js") ? "text/javascript" : file.endsWith(".webp") ? "image/webp" : file.endsWith(".json") ? "application/json" : "application/octet-stream";
    response.writeHead(200, {"Content-Type": type, "Cache-Control": "no-store"}).end(readFileSync(file));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}/replay.html`;

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
    if (m.text().startsWith("[replay]")) log(m.text().slice(0, 800));
});
log(`opening ${base}?quality=${quality} at ${width}×${height}`);
await page.goto(`${base}?quality=${quality}`, {waitUntil: "domcontentloaded", timeout: 180000});
await page.waitForFunction(() => window.__replay?.ready || window.__replayError, null, {timeout: 600000, polling: 500});
const failed = await page.evaluate(() => window.__replayError ?? null);
if (failed) {
    console.error("the harness page failed:", failed);
    await browser.close();
    server.close();
    process.exit(1);
}
log("mounted:", JSON.stringify(await page.evaluate(() => window.__replay.counts())));

/** Whether the scene's layer takes an event up (a few seconds past its time, no pictures): a pair in a tank or on two islands is skipped by the layer itself. */
async function acts(id) {
    try {
        await page.evaluate(([id, o]) => window.__replay.prepare(id, o), [id, {mount, hour: hour === null ? null : Number(hour)}]);
        for (let i = 0; i < 14; i++) await page.evaluate(() => window.__replay.frame(0, 12));
        const report = await page.evaluate(() => window.__replay.report());
        const live = report?.acts;
        if (!live) return false;
        return live.matings.some((m) => m.phase === "acting") || live.births.some((b) => b.phase === "acting") || live.deaths.some((d) => d.drawn) || live.meals.some((m) => m.catchAt > 0) || live.escapes.some((e) => e.missAt !== null);
    } catch {
        return false;
    }
}

const SEA = new Set(["open_ocean", "coral_reef", "river_lake", "seashore", "wetland"]);
/**
 * Which events of a kind to film: the record's own; on the wild island's land first and the bigger animals first (what a
 * picture can show: most of the record is insects), a species once; two with a stand-in first; for a mating or a live
 * birth, ones the scene's layer takes up, and one it does not when there is one (the failure is then on film too).
 */
async function pick(kind) {
    if (MADE.has(kind)) return (await page.evaluate(([k, n]) => window.__replay.make(k, n), [kind, count])).map((id) => ({id, made: true}));
    const all = await page.evaluate((k) => window.__replay.events(k, 2000), kind);
    const chosen = [];
    const species = new Set();
    // (Half of a birth's picks are hatchings when there are any: the two are acted by different layers.)
    const plans = [];
    const rank = (e) => (e.island === "wild" ? 2 : 0) + (SEA.has(e.zone) ? 0 : 1);
    for (const event of all.sort((a, b) => rank(b) - rank(a) || b.length - a.length || Date.parse(b.at) - Date.parse(a.at)).slice(0, 80)) {
        const plan = await page.evaluate((id) => {
            try {
                const p = window.__replay.plan(id);
                return {ok: true, standIns: p.cast.filter((m) => !m.aboard).length, hatch: Boolean(p.feed.play), cast: p.cast.length};
            } catch (error) {
                return {ok: false, why: String(error?.message ?? error)};
            }
        }, event.id);
        if (plan.ok) plans.push({...event, ...plan});
    }
    let skippedOnes = 0;
    const take = async (list, probe = false) => {
        for (const event of list) {
            if (chosen.length >= count) return;
            if (species.has(event.species)) continue;
            if (probe && !(await acts(event.id))) {
                // (One the layer does not take up is kept, the last pick: its reason is in the summary.)
                if (skippedOnes++ === 0) held = {id: event.id, made: false};
                continue;
            }
            species.add(event.species);
            chosen.push({id: event.id, made: false});
        }
    };
    let held = null;
    if (kind === "birth") {
        const live = plans.filter((p) => !p.hatch);
        const hatch = plans.filter((p) => p.hatch);
        const room = count;
        count = Math.min(room, hatch.length ? Math.ceil(room / 2) : room);
        await take(live.filter((p) => p.standIns > 0).slice(0, 12), true);
        await take(live.slice(0, 30), true);
        count = room;
        await take(hatch);
        await take(live.slice(30), true);
    } else {
        // (Two with a stand-in first, where the record has them: the case the replay is for.)
        const probe = kind === "mated";
        const room = count;
        count = Math.min(2, room);
        await take(plans.filter((p) => p.standIns > 0).slice(0, 14), probe);
        count = room;
        await take(plans, probe);
    }
    if (held && chosen.length >= count) chosen[chosen.length - 1] = held;
    else if (held) chosen.push(held);
    return chosen;
}

const summary = [];
const film = async (kind, id, made, n) => {
    const entry = {kind, id, made, n, ok: false};
    summary.push(entry);
    let prepared;
    try {
        prepared = await page.evaluate(([id, o]) => window.__replay.prepare(id, o), [id, {mount, hour: hour === null ? null : Number(hour)}]);
    } catch (error) {
        entry.error = String(error?.message ?? error).split("\n")[0];
        log(kind, id, "could not be prepared:", entry.error);
        return;
    }
    Object.assign(entry, {plan: prepared});
    const name = `${kind}-${n}-${id}-${slugOf(prepared.cast[0]?.name ?? kind)}`;
    const dir = path.join(out, `.frames-${name}`);
    rmSync(dir, {recursive: true, force: true});
    mkdirSync(dir, {recursive: true});
    const started = Date.now();
    let frames = 0;
    const times = [];
    for (;;) {
        const frame = await page.evaluate(([q, s]) => window.__replay.frame(q, s), [0.86, step]);
        const comma = frame.image.indexOf(",");
        if (comma > 0) {
            writeFileSync(path.join(dir, `${String(frames).padStart(4, "0")}.jpg`), Buffer.from(frame.image.slice(comma + 1), "base64"));
            times.push(frame.t);
            frames++;
        }
        if (frame.done || frames > 900) break;
    }
    const [marks, report] = await page.evaluate(() => [window.__replay.marks(), window.__replay.report()]);
    const seen = Object.fromEntries(Object.entries(report?.seen ?? {}).map(([castId, s]) => [castId, {role: s.role, shown: s.frames ? Math.round((s.shown / s.frames) * 100) : null}]));
    Object.assign(entry, {frames, seconds: times[times.length - 1] ?? 0, wall: Math.round((Date.now() - started) / 1000), marks, report: report ? {acted: report.acted, reason: report.reason, standIns: report.standIns, pins: report.pins.length, dropped: report.dropped, cuts: report.cuts, seen} : null, name});
    // The key still: the middle of the act (after the lead, before the linger); a strip of eight across the clip; the clip.
    const fps = 30 / step;
    const at = (seconds) => Math.min(Math.max(Math.round(seconds * fps), 0), frames - 1);
    const key = at(marks.act + (marks.actEnd - marks.act) * (kind === "death" || kind === "extinct" ? 0.45 : kind === "released" ? 0.5 : 0.6));
    execFileSync("cp", [path.join(dir, `${String(key).padStart(4, "0")}.jpg`), path.join(out, `${name}.jpg`)]);
    const picks = Array.from({length: 8}, (_, i) => at(marks.act - 1 + ((Math.max(marks.actEnd, marks.act + 2) + 1.5 - (marks.act - 1)) * i) / 7));
    const strip = path.join(dir, "strip");
    mkdirSync(strip, {recursive: true});
    picks.forEach((frame, i) => execFileSync("cp", [path.join(dir, `${String(frame).padStart(4, "0")}.jpg`), path.join(strip, `${String(i).padStart(2, "0")}.jpg`)]));
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", "1", "-i", path.join(strip, "%02d.jpg"), "-vf", "scale=360:-1,tile=4x2:padding=4:color=black", "-frames:v", "1", path.join(out, `${name}-strip.jpg`)]);
    if (clips) execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(fps), "-i", path.join(dir, "%04d.jpg"), "-c:v", "libx264", "-preset", "veryfast", "-crf", "24", "-pix_fmt", "yuv420p", "-r", "30", path.join(out, `${name}.mp4`)]);
    rmSync(dir, {recursive: true, force: true});
    entry.ok = Boolean(report?.acted);
    log(`${name}: ${frames} frames (${entry.seconds.toFixed(1)} s) in ${entry.wall} s; ${report?.acted ? "acted" : `NOT acted: ${report?.reason}`}; stand-ins ${report?.standIns.length ?? 0}; seen ${Object.values(seen).map((s) => `${s.role} ${s.shown}%`).join(", ")}; cuts ${report?.cuts.length ?? 0}`);
};

for (const kind of kinds) {
    const events = only.length ? only.map((id) => ({id, made: false})) : await pick(kind);
    log(`${kind}: ${events.length} event(s): ${events.map((e) => e.id).join(", ") || "none"}`);
    let n = 0;
    for (const event of events) await film(only.length ? await page.evaluate((id) => window.__replay.plan(id).kind, event.id).catch(() => kind) : kind, event.id, event.made, ++n);
    // The kind in words, as Ark Lite shows it: its first event's card.
    if (events[0]) {
        const text = await page.evaluate((id) => {
            try {
                return window.__replay.card(id);
            } catch (error) {
                return {error: String(error?.message ?? error)};
            }
        }, events[0].id);
        // (A phone's width: Ark Lite is for phones with 2 GB or less.)
        await page.setViewportSize({width: 390, height: 844});
        await page.waitForTimeout(1500);
        await page.screenshot({path: path.join(out, `lite-${kind}-${events[0].id}.jpg`), type: "jpeg", quality: 88});
        await page.evaluate(() => document.getElementById("lite-card")?.remove());
        await page.setViewportSize({width, height});
        summary.push({kind, id: events[0].id, lite: text});
    }
    if (only.length) break;
}
writeFileSync(path.join(out, `summary${only.length ? `-${only.join("-")}` : ""}.json`), JSON.stringify({at: new Date().toISOString(), width, height, quality, step, errors: errors.slice(0, 40), events: summary}, null, 1));
if (errors.length) log("page errors:", errors.slice(0, 8));
await browser.close();
server.close();
