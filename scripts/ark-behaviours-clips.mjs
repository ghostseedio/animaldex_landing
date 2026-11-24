#!/usr/bin/env node
/**
 * The behaviours harness (behaviours plan P1, AnimalDex docs/ark/behaviours-plan.md): builds
 * `src/ark-scene/behaviours-entry.ts` into `.ark-golden/behaviours/` (gitignored), serves it with the scene's art, and
 * drives Chrome through made-up record events on the page's controlled clock: a birth in the open, a den birth, a
 * contest before a mating, a herd's dung. Frames at each act's moments and a contact strip per scene.
 *
 *   node scripts/ark-behaviours-clips.mjs --out <dir> [--scenes birth,den,contest,dung]
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
const out = path.resolve(arg("out", path.join(root, ".ark-golden", "behaviours-shots")));
const scenes = arg("scenes", "birth,den,contest,dung").split(",");
// The hunt acts (`hunt-acts.ts`): their own page and moments, `scripts/ark-hunt-clips.mjs` (`--scenes hunt-cat,hunt-heron`).
if (scenes.some((name) => name.startsWith("hunt"))) {
    await import("./ark-hunt-clips.mjs");
    process.exit(0);
}
mkdirSync(out, {recursive: true});
const site = path.join(root, ".ark-golden", "behaviours");
mkdirSync(site, {recursive: true});
await build({entryPoints: [path.join(root, "src/ark-scene/behaviours-entry.ts")], outfile: path.join(site, "scene.js"), bundle: true, format: "iife", platform: "browser", target: ["es2020"], minify: true, tsconfig: path.join(root, "tsconfig.json"), define: {"process.env.NODE_ENV": JSON.stringify("development")}, logLevel: "warning"});
writeFileSync(path.join(site, "index.html"), `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Ark behaviours</title>
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

/** Each scene's moments (s after the event), framing distance (m) and who to frame. */
const PLANS = {
    birth: {distance: 6, shots: [[1, "she settles"], [9, "born"], [15, "licked"], [27, "getting up"], [31, "up on wobbly legs"], [38, "to her flank"], [50, "suckling"], [72, "back to their day"]]},
    den: {distance: 5, shots: [[1, "she settles"], [9, "the first cub"], [13, "both born"], [22, "licked"], [40, "suckling at her belly"], [70, "back to their day"]]},
    contest: {distance: 9, shots: [[1, "the rival comes"], [8, "closing"], ["walk+2.1", "a clash"], ["walk+4", "backing off"], ["walk+7.3", "another clash"], ["end-3", "the rival runs"], ["end+6", "the pair: courtship"], ["end+40", "the mating"]]},
    // 3.3 batch (B)
    mob: {distance: 13, shots: [[0.2, "going up (2.3 s)"], [1.8, "the first dive (3.9 s)"], [4.4, "past its head (6.5 s)"], [5.2, "climbing away (7.3 s)"], [7.0, "the next one's turn (9.1 s)"], [9.6, "and the next (11.7 s)"], [12.2, "again (14.3 s)"], [17.4, "still at it (19.5 s)"], [14.4, "one of them, close (16.5 s)"], [15.2, "close, on the ring (17.3 s)"], [24.4, "breaking off (26.5 s)"], [34, "back to their day"]]},
    // 3.3 batch (B): each bird close from its side (the third value: which of the cast), a pump's four quarters 0.11 s apart.
    tail: {distance: 0.55, shots: [[5, "wagtail: the pump", 0], [0.11, "wagtail +0.11 s", 0, "tick"], [0.11, "wagtail +0.22 s", 0, "tick"], [0.11, "wagtail +0.33 s", 0, "tick"], [6, "wren: tail cocked", 1], [1.2, "wren +1.2 s", 1, "tick"], [7, "swamphen: the flick", 2], [0.5, "swamphen +0.5 s", 2, "tick"], [0.5, "swamphen +1.0 s", 2, "tick"], [0.5, "swamphen +1.5 s", 2, "tick"], [9, "water tyrant: the fan", 3], [1.4, "water tyrant +1.4 s", 3, "tick"], [1.4, "water tyrant +2.8 s", 3, "tick"], [11, "sandpiper: the bob", 4], [0.28, "sandpiper +0.28 s", 4, "tick"], [12, "a sparrow: no habit", 5], [0.2, "a sparrow +0.2 s", 5, "tick"]]},
    lure: {distance: 1.6, shots: [[-1.2, "close: the run off the nest (0.9 s)"], [-0.3, "close: a fluttering hop (1.8 s)"], [0.4, "close: dragging, looking back (2.5 s)"], [1.1, "close: the next hop (3.2 s)"], [1.8, "close: dragging (3.9 s)"], [5.3, "close: further on (7.4 s)"], [11.2, "close: still leading (13.3 s)"], [14.6, "close: it stands up whole (16.7 s)"], [17.3, "close: the flight back (19.4 s)"], [21.5, "close: back where its day has it"]]},
    // (The shot adds 2.1 s after its time: the young jump at 7.8 s, 10.4 s, 13 s, 15.6 s after the hatch.)
    drop: {distance: 6, shots: [[1, "she comes to the tree (3.1 s)"], [5.3, "the first at the mouth (7.4 s)"], [5.9, "it jumps (8.0 s)"], [6.3, "falling (8.4 s)"], [6.8, "the bounce (8.9 s)"], [8.6, "the second jumps (10.7 s)"], [11.1, "the third (13.2 s)"], [13.7, "the fourth (15.8 s)"], [18, "gathered at her (20.1 s)"], [26, "still gathered (28.1 s)"], [48, "back to their day"]]},
    dung: {distance: 5, shots: [[600, "the herd, ten minutes on"], [900, "a mark, close"], [1500, "marks fading"]]},
    dungusers: {distance: 0.35, shots: [[600, "the herd, ten minutes on", undefined], [900, "a mark, close"], [900, "a dung beetle at a fresh mark", 1], [930, "the beetle 30 s on", 1], [900, "a yellow dung fly (the page's own close-up)", 2, undefined, "fly"], [1500, "marks fading"], [930, "the beetle chosen, 2.5 m back: before (true size)", 1, undefined, "off"], [930, "the beetle chosen, 2.5 m back: after (tiny lift)", 1, undefined, "on"]]}
};
/**
 * 3.3 batch (A): the defence moves' scenes. A predator is stood beside the animal (its shared pose pinned), left there,
 * then taken away: [what the harness does, seconds the world runs on, label]. Each scene: how many body lengths away
 * it is framed from, and the camera's azimuth and polar angle when the default hides the move (a flat coil is seen from above).
 */
const DEFENCE = {curl: [5], pangolin: [4], pill: [7, 2.4, 0.5], coil: [3, 2.4, 0.5], millipede: [4, 2.4, 0.5], shell: [5], snail: [7], hermit: [7], puff: [6], monitor: [3.5], puffer: [5], flash: [7, 2.4, 0.5], eyes: [5, 2.4, 0.5], peacock: [6, 2.4, 0.5], owl: [5, 2.4, 0.5], harnessed: [7, 2.4, 0.5], blotched: [6, 2.4, 0.5], lubber: [6, 5.4, 0.7], tail: [5, 2.4, 0.6], salamander: [5, 2.4, 0.6], rear: [3.5, 1.6, 1.25], crab: [4, 1.6, 1.2], scorpion: [3.5, 1.6, 1.2], tamandua: [3.5, 1.6, 1.3], whirl: [4, 2.4, 0.9], webshake: [4, 1.6, 1.1], thump: [3, 2.6, 1.25], thumpdomestic: [3, 2.6, 1.25], cottontail: [4, 2.8, 1.2], stamp: [3, 1.6, 1.3], slug: [3, 1.6, 1.0], tuck: [3.5, 2.4, 0.8], beard: [2.4, 1.2, 1.3], spines: [3, 2.4, 0.6], gecko: [5, 2.4, 0.6]};
/** SIG-DEFENCE: a scene acted at a disturbance the day's schedule gives (a deer's stamp), not at a predator. */
const DISTURB_STEPS = [["none", 2, "before: about its day"], ["disturb", 0.4, "a disturbance: 0.4 s in"], ["hold", 0.3, "0.7 s"], ["hold", 0.25, "0.95 s"], ["hold", 0.2, "1.15 s"], ["hold", 1.5, "2.65 s"], ["hold", 4, "6.65 s: over"], ["hold", 10, "calm again"]];
const DEFENCE_STEPS = [["none", 2, "before: about its day"], ["near", 0.5, "a predator beside it, half a second"], ["hold", 0.5, "one second"], ["hold", 1, "two seconds"], ["hold", 3, "five seconds"], ["away", 4, "the predator gone, four seconds"], ["hold", 12, "sixteen seconds on"], ["hold", 30, "calm again"]];
/**
 * Group life (lane SIG-GROUP; `behaviour-group.ts`): a group's act, seen from the cast's real animals. `act` scenes are
 * shot round the act's own windows (before, in it, near its end, after); the others at fixed seconds from the start.
 */
const GROUPS = {
    gsentinel: {act: "sentinel", distance: 3.2, polar: 1.25},
    ghuddle: {act: "huddle", distance: 6},
    glick: {act: "lick", distance: 3, polar: 1.2},
    gchorus: {act: "chorus", distance: 3.5, polar: 1.25},
    gfeast: {act: "feast", distance: 5, polar: 1.3},
    gbask: {act: "basking", distance: 4},
    ggather: {times: [3, 330], distance: 14, polar: 1.35},
    groost: {times: [3, 600], distance: 14, polar: 1.35},
    gcommute: {times: [10, 120, 300, 600, 1200, 2400], distance: 40, polar: 0.9},
    gpairs: {times: [10, 120, 400, 800, 1300, 2000, 3000, 4200], distance: 14}
};
const summary = {};
for (const name of scenes) {
    const context = await browser.newContext({viewport: {width: 1280, height: 720}});
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text().slice(0, 300));
        if (m.text().startsWith("[behaviours]")) console.log(name, m.text().slice(0, 600));
    });
    await page.goto(`${base}?scene=${name}&quality=high${arg("grass", "") === "0" ? "&grass=0" : ""}${arg("query", "") ? `&${arg("query", "")}` : ""}`, {waitUntil: "domcontentloaded", timeout: 120000});
    try {
        await page.waitForFunction(() => window.__behaviours || window.__behavioursError, null, {timeout: 300000});
    } catch (error) {
        console.log(name, "no harness:", error.message.split("\n")[0], errors.slice(0, 5));
        await context.close();
        continue;
    }
    const failed = await page.evaluate(() => window.__behavioursError ?? null);
    if (failed) {
        console.log(name, "failed:", failed.slice(0, 500));
        await context.close();
        continue;
    }
    if (GROUPS[name]) {
        const cfg = GROUPS[name];
        let times = cfg.times;
        if (cfg.act) {
            const windows = await page.evaluate(([act]) => window.__behaviours.groupWindows(act, 3), [cfg.act]);
            console.log(name, "windows", JSON.stringify(windows));
            times = windows.slice(0, 2).flatMap((w) => [Math.max(w.s - 40, 4), w.s + 100, w.s + Math.max(w.len - 20, 110), w.s + w.len + 150]);
            if (!times.length) times = [10, 300, 900];
        }
        const dir = path.join(out, name);
        rmSync(dir, {recursive: true, force: true});
        mkdirSync(dir, {recursive: true});
        const labels = [];
        for (let i = 0; i < times.length; i++) {
            const note = await page.evaluate(async ([s, d, polar]) => {
                const text = await window.__behaviours.groupShot(s, d, 0.7, polar ?? 1.1, 0);
                document.getElementById("note").textContent = text.split("\n").slice(0, 8).join("\n");
                return text;
            }, [times[i], cfg.distance, cfg.polar ?? null]);
            labels.push(`${String(i).padStart(2, "0")} ${note.replace(/\n/g, " | ")}`);
            await page.screenshot({path: path.join(dir, `${String(i).padStart(2, "0")}.jpg`), type: "jpeg", quality: 88});
        }
        writeFileSync(path.join(dir, "labels.txt"), labels.join("\n") + "\n");
        const cols = 4;
        execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", "1", "-i", path.join(dir, "%02d.jpg"), "-vf", `scale=640:-1,tile=${cols}x${Math.ceil(times.length / cols)}:padding=4:color=black`, "-frames:v", "1", path.join(out, `${name}-strip.jpg`)]);
        summary[name] = {errors: errors.slice(0, 10), shots: labels};
        console.log(name, labels.join("\n"));
        if (errors.length) console.log(name, "errors:", errors.slice(0, 5));
        await context.close();
        continue;
    }
    if (name.startsWith("rt_")) {
        // Reptile signatures (lane SIG2-REPTILES): the recipe's episode of the cast, found from the schedule: a frame at the
        // middle of each of its steps (the long holds at their start and end too), each framed close from the animal's side.
        const found = await page.evaluate(() => window.__behaviours.episode());
        const dir = path.join(out, name);
        rmSync(dir, {recursive: true, force: true});
        mkdirSync(dir, {recursive: true});
        const episode = (found ?? [])[Number(arg("pick", "0"))];
        if (!episode) {
            console.log(name, "no episode of the recipe in the search window", JSON.stringify(found));
            summary[name] = {errors: ["no episode"]};
            await context.close();
            continue;
        }
        console.log(name, "episode", JSON.stringify({id: episode.id.slice(-3), t0: episode.t0, t1: episode.t1, keys: episode.keys.map((k) => `${k.b} ${(k.t1 - k.t0).toFixed(1)}s${k.caught === null ? "" : k.caught ? " caught" : " missed"}${k.to ? ` y${k.to.y.toFixed(2)}` : ""}`)}));
        let moments = [];
        for (const k of episode.keys) {
            if (k.b === "turn") continue;
            const d = k.t1 - k.t0;
            if (d > 9) moments.push([k.t0 + 1.2, `${k.b} start`], [k.t0 + d / 2, `${k.b} middle`], [k.t1 - 1.2, `${k.b} end`]);
            else if (d > 3) moments.push([k.t0 + d * 0.25, `${k.b} early`], [k.t0 + d * 0.75, `${k.b} late`]);
            else moments.push([k.t0 + d / 2, k.b]);
        }
        const cap = Number(arg("max", "16"));
        if (moments.length > cap) moments = Array.from({length: cap}, (_, i) => moments[Math.round((i * (moments.length - 1)) / (cap - 1))]);
        const labels = [];
        for (let i = 0; i < moments.length; i++) {
            const [at, label] = moments[i];
            const note = await page.evaluate(async ([id, at, lengths, azimuth, polar]) => window.__behaviours.recipeShot(id, at, lengths, azimuth, polar), [episode.id, at, Number(arg("lengths", "0")) || null, arg("azimuth", "") === "" ? undefined : Number(arg("azimuth", "")), arg("polar", "") === "" ? undefined : Number(arg("polar", ""))]);
            await page.evaluate((t) => (document.getElementById("note").textContent = t), `${name}  ${label} (+${(at - episode.t0).toFixed(1)} s)`);
            labels.push(`${String(i).padStart(2, "0")} ${label} (+${(at - episode.t0).toFixed(1)} s): ${note}`);
            await page.screenshot({path: path.join(dir, `${String(i).padStart(2, "0")}.jpg`), type: "jpeg", quality: 88});
        }
        writeFileSync(path.join(dir, "labels.txt"), labels.join("\n") + "\n");
        const rows = Math.ceil(moments.length / 4);
        execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", "1", "-i", path.join(dir, "%02d.jpg"), "-vf", `scale=640:-1,tile=4x${rows}:padding=4:color=black`, "-frames:v", "1", path.join(out, `${name}-strip.jpg`)]);
        summary[name] = {errors: errors.slice(0, 10), episode: {id: episode.id, t0: episode.t0, t1: episode.t1}, shots: labels};
        console.log(name, labels.join("\n"));
        if (errors.length) console.log(name, "errors:", errors.slice(0, 5));
        await context.close();
        continue;
    }
    if (name.startsWith("mi_")) {
        // Reptile signatures (lane SIG2-REPTILES): a small clinger's sit-and-wait bout (`micro-ambush.ts`): the first of the cast with one,
        // framed close from in front of its wall or from its side on a rock, at the bout's moments (s from the dash's start).
        const found = await page.evaluate(() => window.__behaviours.microBouts());
        const dir = path.join(out, name);
        rmSync(dir, {recursive: true, force: true});
        mkdirSync(dir, {recursive: true});
        if (!found) {
            console.log(name, "no bout in four minutes");
            summary[name] = {errors: ["no bout"]};
            await context.close();
            continue;
        }
        const bout = found.bouts[0];
        console.log(name, "bout", JSON.stringify({id: found.id.slice(-3), length: found.length, bout}));
        const moments = [[bout.tv + 0.6, "the insect settles"], [bout.td - 0.6, "waiting"], [bout.td + 0.2, "the dash"], [bout.td + 0.5, "the snap begins"], [bout.td + 0.85, "the snap"], [bout.td + 1.25, "eating"], [bout.td + 2.6, "turning"], [bout.td + 3.2, "walking back"], [bout.te - 0.1, "back, turned"], [bout.te + 4, "still on its spot"]];
        const labels = [];
        for (let i = 0; i < moments.length; i++) {
            const [at, label] = moments[i];
            const note = await page.evaluate(async ([id, at, lengths]) => window.__behaviours.microShot(id, at, lengths), [found.id, at, Number(arg("lengths", "0")) || null]);
            await page.evaluate((t) => (document.getElementById("note").textContent = t), `${name}  ${label} (td ${(at - bout.td).toFixed(2)} s)`);
            labels.push(`${String(i).padStart(2, "0")} ${label} (td ${(at - bout.td).toFixed(2)} s): ${note}`);
            await page.screenshot({path: path.join(dir, `${String(i).padStart(2, "0")}.jpg`), type: "jpeg", quality: 88});
        }
        writeFileSync(path.join(dir, "labels.txt"), labels.join("\n") + "\n");
        execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", "1", "-i", path.join(dir, "%02d.jpg"), "-vf", "scale=640:-1,tile=4x3:padding=4:color=black", "-frames:v", "1", path.join(out, `${name}-strip.jpg`)]);
        summary[name] = {errors: errors.slice(0, 10), bout, shots: labels};
        console.log(name, labels.join("\n"));
        if (errors.length) console.log(name, "errors:", errors.slice(0, 5));
        await context.close();
        continue;
    }
    if (["sally", "sallyb", "patrol", "display"].includes(name)) {
        // Lane SIG-OTHER (flights): wait for a male in the recipe's act, then follow him: frames 1 s apart from a few body lengths.
        const recipe = {sally: "sally_chase", sallyb: "sally_chase", patrol: "patrol_low", display: "display_flight"}[name];
        const distance = Number(arg("distance", name === "display" ? "9" : "1.6"));
        const count = Number(arg("frames", "12"));
        const step = Number(arg("step", name === "display" ? "1.6" : "0.9"));
        const dir = path.join(out, name);
        rmSync(dir, {recursive: true, force: true});
        mkdirSync(dir, {recursive: true});
        const found = await page.evaluate(([recipe, limit]) => window.__behaviours.flightWatch(recipe, limit), [recipe, Number(arg("limit", "900"))]);
        console.log(name, "found", JSON.stringify(found));
        const labels = [];
        if (found.id) {
            for (let i = 0; i < count; i++) {
                const note = await page.evaluate(async ([id, seconds, distance, azimuth, label]) => {
                    const text = await window.__behaviours.flightFrame(id, seconds, distance, azimuth);
                    document.getElementById("note").textContent = `${label}\n${text}`;
                    return text;
                }, [found.id, i === 0 ? 0.1 : step, distance, 0.7 + (i % 3) * 0.25, `${recipe} +${(i * step).toFixed(1)} s`]);
                await page.screenshot({path: path.join(dir, `${String(i).padStart(2, "0")}.jpg`), type: "jpeg", quality: 88});
                labels.push(`${String(i).padStart(2, "0")} +${(i * step).toFixed(1)} s: ${note}`);
            }
            writeFileSync(path.join(dir, "labels.txt"), labels.join("\n") + "\n");
            execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", "1", "-i", path.join(dir, "%02d.jpg"), "-vf", "scale=640:-1,tile=4x3:padding=4:color=black", "-frames:v", "1", path.join(out, `${name}-strip.jpg`)]);
        }
        summary[name] = {errors: errors.slice(0, 10), found, shots: labels};
        console.log(name, labels.join("\n"));
        if (errors.length) console.log(name, "errors:", errors.slice(0, 5));
        await context.close();
        continue;
    }
    if (name === "tails") {
        // Lane SIG-OTHER (tail postures, `tail-posture.ts`): each species of the cast framed from its side and from behind, its posture off and on.
        const plan = await page.evaluate(() => window.__behaviours.tailPlan());
        const dir = path.join(out, name);
        rmSync(dir, {recursive: true, force: true});
        mkdirSync(dir, {recursive: true});
        const labels = [];
        const lengths = Number(arg("lengths", "2.4"));
        const WANT = {"domestic-dog": [{label: "calm, side", social: 0, moving: false, azimuth: Math.PI / 2}, {label: "greeting, side", social: 1, moving: false, azimuth: Math.PI / 2}, {label: "greeting, from behind", social: 1, moving: false, azimuth: Math.PI}, {label: "greeting, from behind +0.12 s", social: 1, moving: false, azimuth: Math.PI, run: 0.12}]};
        for (const sp of plan) {
            const steps = WANT[sp.slug] ?? [{label: "side", social: null, moving: true, azimuth: Math.PI / 2}, {label: "from behind", social: null, moving: true, azimuth: Math.PI}, {label: "three-quarters behind", social: null, moving: true, azimuth: Math.PI * 0.75}];
            const files = [];
            for (let i = 0; i < steps.length; i++) {
                const step = steps[i];
                const note = await page.evaluate(async ([id, step, lengths, label]) => {
                    const text = await window.__behaviours.tailShot(id, {social: step.social, moving: step.moving, lengths, azimuth: step.azimuth, run: step.run});
                    document.getElementById("note").textContent = `${label}: ${step.label}\n${text}`;
                    return text;
                }, [sp.ids[0], step, lengths, sp.name]);
                const file = path.join(dir, `${sp.slug}-${i}.jpg`);
                await page.screenshot({path: file, type: "jpeg", quality: 88});
                files.push(file);
                labels.push(`${sp.slug} ${step.label}: ${note}`);
            }
            const cols = files.length <= 3 ? files.length : 2;
            execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", "1", "-i", path.join(dir, `${sp.slug}-%d.jpg`), "-vf", `scale=640:-1,tile=${cols}x${Math.ceil(files.length / cols)}:padding=4:color=black`, "-frames:v", "1", path.join(out, `${name}-${sp.slug}.jpg`)]);
        }
        writeFileSync(path.join(dir, "labels.txt"), labels.join("\n") + "\n");
        summary[name] = {errors: errors.slice(0, 10), shots: labels};
        console.log(name, labels.join("\n"));
        if (errors.length) console.log(name, "errors:", errors.slice(0, 5));
        await context.close();
        continue;
    }
    if (name.startsWith("ls")) {
        // Lane SIG-OTHER (look states, `look-state.ts`): each species of the cast close up, its state off and on. `night`: by the island's hour
        // (12:00, then 01:00 the next day), `season`: the strength forced off and on, `display`: forced off and on, from the side, three-quarters and front.
        const kind = /^ls(fish|land)/.test(name) ? "night" : name === "lsglow" ? "glow" : name === "lsindividual" ? "individual" : name.startsWith("lsseason") ? "season" : "display";
        const lengths = Number(arg("lengths", kind === "night" ? "2.2" : kind === "season" || kind === "individual" ? "1.9" : kind === "glow" ? "1.6" : name === "lscheek" ? "0.9" : "1.2"));
        const SIDE = Math.PI / 2;
        const STEPS = {
            night: [{label: "day, 12:00", k: null, hour: 12, azimuth: SIDE}, {label: "night, 01:00", k: null, hour: 25, azimuth: SIDE}, {label: "night, three-quarters", k: null, hour: 25, azimuth: Math.PI / 4}],
            season: [{label: "state off (k 0)", k: 0, azimuth: SIDE}, {label: "state on (k 1)", k: 1, azimuth: SIDE}, {label: "state on, three-quarters", k: 1, azimuth: Math.PI / 4}],
            glow: [{label: "night, state off", k: 0, hour: 25, azimuth: SIDE}, {label: "night, state on", k: 1, hour: 25, azimuth: SIDE}, {label: "night, on, three-quarters", k: 1, hour: 25, azimuth: Math.PI / 4}],
            individual: [{label: "its own pattern, side", k: null, azimuth: SIDE}, {label: "its own pattern, three-quarters", k: null, azimuth: Math.PI / 4}],
            display: [{label: "off (k 0), side", k: 0, azimuth: SIDE}, {label: "on (k 1), side", k: 1, azimuth: SIDE}, {label: "on, three-quarters", k: 1, azimuth: Math.PI / 4}, {label: "on, front", k: 1, azimuth: 0.05}]
        }[kind];
        const only = arg("only", "").split(",").filter(Boolean);
        const plan = await page.evaluate(() => window.__behaviours.lsPlan());
        const dir = path.join(out, name);
        mkdirSync(dir, {recursive: true});
        const labels = [];
        const subjects = kind === "individual" ? plan.flatMap((sp) => sp.ids.map((id, n) => ({...sp, ids: [id], slug: `${sp.slug}-${n}`}))) : plan;
        for (const sp of subjects) {
            if (only.length && !only.includes(sp.slug)) continue;
            const files = [];
            for (let i = 0; i < STEPS.length; i++) {
                const step = STEPS[i];
                const note = await page.evaluate(async ([id, step, lengths, label]) => {
                    const text = await window.__behaviours.lsShot(id, {k: step.k, lengths, azimuth: step.azimuth, hour: step.hour ?? null, month: step.month ?? null, run: step.hour ? 3 : 1.5, lift: Number(label.lift ?? 0)});
                    document.getElementById("note").textContent = `${label.name}: ${step.label}\n${text}`;
                    return text;
                }, [sp.ids[0], step, lengths, {name: sp.name, lift: arg("lift", "0")}]);
                const file = path.join(dir, `${sp.slug}-${i}.jpg`);
                await page.screenshot({path: file, type: "jpeg", quality: 88});
                files.push(file);
                labels.push(`${sp.slug} ${step.label}: ${note.replace(/\n/g, " | ")}`);
            }
            const cols = files.length <= 3 ? files.length : 2;
            execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", "1", "-i", path.join(dir, `${sp.slug}-%d.jpg`), "-vf", `scale=640:-1,tile=${cols}x${Math.ceil(files.length / cols)}:padding=4:color=black`, "-frames:v", "1", path.join(out, `${name}-${sp.slug}.jpg`)]);
        }
        writeFileSync(path.join(dir, "labels.txt"), labels.join("\n") + "\n");
        summary[name] = {errors: errors.slice(0, 10), shots: labels};
        console.log(name, labels.join("\n"));
        if (errors.length) console.log(name, "errors:", errors.slice(0, 5));
        await context.close();
        continue;
    }
    if (DEFENCE[name]) {
        const dir = path.join(out, name);
        rmSync(dir, {recursive: true, force: true});
        mkdirSync(dir, {recursive: true});
        const labels = [];
        const steps = name === "stamp" ? DISTURB_STEPS : DEFENCE_STEPS;
        for (let i = 0; i < steps.length; i++) {
            const [what, seconds, label] = steps[i];
            const note = await page.evaluate(async ([what, seconds, lengths, label, gap, azimuth, polar]) => {
                if (what === "disturb") await window.__behaviours.disturb(0);
                if (what === "near") window.__behaviours.threat(gap);
                if (what === "away") window.__behaviours.threat(null);
                const text = await window.__behaviours.run(seconds, lengths, Number(azimuth), Number(polar));
                document.getElementById("note").textContent = `${label}\n${text}`;
                return text;
            }, [what, seconds, DEFENCE[name][0], label, Number(arg("gap", "1.6")), arg("azimuth", String(DEFENCE[name][1] ?? 0.7)), arg("polar", String(DEFENCE[name][2] ?? 1.1))]);
            labels.push(`${String(i).padStart(2, "0")} ${label}: ${note}`);
            await page.screenshot({path: path.join(dir, `${String(i).padStart(2, "0")}.jpg`), type: "jpeg", quality: 88});
        }
        writeFileSync(path.join(dir, "labels.txt"), labels.join("\n") + "\n");
        execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", "1", "-i", path.join(dir, "%02d.jpg"), "-vf", "scale=640:-1,tile=4x2:padding=4:color=black", "-frames:v", "1", path.join(out, `${name}-strip.jpg`)]);
        summary[name] = {errors: errors.slice(0, 10), shots: labels};
        console.log(name, labels.join("\n"));
        if (errors.length) console.log(name, "errors:", errors.slice(0, 5));
        await context.close();
        continue;
    }
    if (name.startsWith("shake")) {
        // p3 (shake): the cast's first climb out of the water on its own schedule: [s from its arrival on the bank, label].
        const STEPS = [[-2.2, "climbing out"], [0.05, "on the bank"], [0.35, "the shake starts"], [0.5, "shaking"], [0.62, "shaking"], [0.75, "shaking"], [0.9, "shaking"], [1.05, "shaking"], [1.25, "after the body shake"], [1.45, "the wings"], [1.6, "the wings"], [1.75, "the wings"], [2.0, "the wings"], [2.4, "settling"], [3.2, "back to its day"], [6, "on with its day"]];
        const outs = await page.evaluate(() => window.__behaviours.outs());
        console.log(name, "outs", JSON.stringify(outs.slice(0, 4)));
        const dir = path.join(out, name);
        rmSync(dir, {recursive: true, force: true});
        mkdirSync(dir, {recursive: true});
        const pick = outs[Number(arg("pick", "0"))];
        if (!pick) {
            summary[name] = {errors: ["no climb out of the water in a day"]};
            await context.close();
            continue;
        }
        const labels = [];
        for (let i = 0; i < STEPS.length; i++) {
            const [s, label] = STEPS[i];
            const note = await page.evaluate(async ([id, epoch, lengths, azimuth]) => window.__behaviours.shakeShot(id, epoch, lengths, azimuth === "" ? null : Number(azimuth)), [pick.id, pick.arrive + s, Number(arg("lengths", "3.2")), arg("azimuth", "")]);
            await page.evaluate((t) => (document.getElementById("note").textContent = t), `${label} (+${s} s)\n${note}`);
            labels.push(`${String(i).padStart(2, "0")} ${label} (+${s} s): ${note}`);
            await page.screenshot({path: path.join(dir, `${String(i).padStart(2, "0")}.jpg`), type: "jpeg", quality: 88});
        }
        writeFileSync(path.join(dir, "labels.txt"), labels.join("\n") + "\n");
        execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", "1", "-i", path.join(dir, "%02d.jpg"), "-vf", "scale=640:-1,tile=4x4:padding=4:color=black", "-frames:v", "1", path.join(out, `${name}-strip.jpg`)]);
        summary[name] = {errors: errors.slice(0, 10), shots: labels};
        console.log(name, labels.join("\n"));
        if (errors.length) console.log(name, "errors:", errors.slice(0, 5));
        await context.close();
        continue;
    }
    if (name === "death") {
        // 3.3 fix (log): [s after the death, which death, label, the tap from the overview]. Framed on where it lies.
        const STEPS = [[-1, "death:harness", "before: alive"], [0.6, "death:harness", "falling onto its side"], [5, "death:harness", "lying where it died"], [600, "death:harness", "ten minutes on"], [1110, "death:harness", "fading"], [1230, "death:harness", "gone"], [5, "death:gone", "a hawk no longer in the roster, lying where it died"], [30, "death:harness", "the line's tap, from the overview", true], [30, "death:gone", "the hawk's line's tap", true]];
        const dir = path.join(out, name);
        rmSync(dir, {recursive: true, force: true});
        mkdirSync(dir, {recursive: true});
        const labels = [];
        for (let i = 0; i < STEPS.length; i++) {
            const [s, key, label, tap] = STEPS[i];
            const note = await page.evaluate(async ([s, key, label, tap]) => {
                const b = window.__behaviours;
                let text = await b.shot(s, 6);
                const death = b.deaths().find((d) => d.key === key);
                if (tap) text = `tap: ${JSON.stringify(await b.tapDeath(key))}`;
                else if (death?.spot) text = await b.shot(s, key === "death:gone" ? 3 : 6, undefined, death.spot);
                text += `\n${JSON.stringify(death ?? null)}`;
                document.getElementById("note").textContent = `${label}\n${text}`;
                return text;
            }, [s, key, label, tap ?? false]);
            labels.push(`${String(i).padStart(2, "0")} ${label}: ${note.replace(/\n/g, " | ")}`);
            await page.screenshot({path: path.join(dir, `${String(i).padStart(2, "0")}.jpg`), type: "jpeg", quality: 85});
        }
        writeFileSync(path.join(dir, "labels.txt"), labels.join("\n") + "\n");
        execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", "1", "-i", path.join(dir, "%02d.jpg"), "-vf", "scale=640:-1,tile=3x3:padding=4:color=black", "-frames:v", "1", path.join(out, `${name}-strip.jpg`)]);
        summary[name] = {errors: errors.slice(0, 10), shots: labels};
        console.log(name, labels.join("\n"));
        if (errors.length) console.log(name, "errors:", errors.slice(0, 5));
        await context.close();
        continue;
    }
    if (name.startsWith("breed")) {
        // 3.3 fix (breeding taps): the line's tap as it is now made, at moments after the event; each frame 3 s after the tap.
        const dir = path.join(out, name);
        rmSync(dir, {recursive: true, force: true});
        mkdirSync(dir, {recursive: true});
        const labels = [];
        const mode = name === "breedclutch" ? "clutch" : name === "breedfly" ? "pair" : "young";
        const moments = mode === "clutch" ? [5, 30, 90, 120] : [5, 30, 90, 160];
        for (let i = 0; i < moments.length; i++) {
            const note = await page.evaluate(async ([s, mode]) => {
                const text = await window.__behaviours.breedTap(s, mode);
                document.getElementById("note").textContent = text;
                return text;
            }, [moments[i], mode]);
            labels.push(`${String(i).padStart(2, "0")} ${note}`);
            await page.screenshot({path: path.join(dir, `${String(i).padStart(2, "0")}.jpg`), type: "jpeg", quality: 85});
        }
        if (mode === "clutch") {
            // And the clutch itself, close (the tap's frame is the pair's; the eggs are a lizard's, about a centimetre).
            await page.evaluate(async () => {
                const clutch = window.__arkDebug.liveClutch();
                if (clutch?.at) window.__behaviours.handle.setView({target: {x: clutch.at.x, y: clutch.at.y + 0.02, z: clutch.at.z}, distance: 0.45, polar: 0.8, azimuth: 0.7});
                await new Promise((r) => setTimeout(r, 400));
            });
            await page.screenshot({path: path.join(dir, "clutch-close.jpg"), type: "jpeg", quality: 85});
        }
        writeFileSync(path.join(dir, "labels.txt"), labels.join("\n") + "\n");
        execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", "1", "-i", path.join(dir, "%02d.jpg"), "-vf", "scale=640:-1,tile=2x2:padding=4:color=black", "-frames:v", "1", path.join(out, `${name}-strip.jpg`)]);
        summary[name] = {errors: errors.slice(0, 10), shots: labels};
        console.log(name, labels.join("\n"));
        if (errors.length) console.log(name, "errors:", errors.slice(0, 5));
        await context.close();
        continue;
    }
    if (name.startsWith("tap")) {
        // 3.3 fix (mating tap): the line tapped at moments after the mating's time (the log's line reaches a viewer 5 to
        // 55 s after it and stays 15 s), the old tap or the new; each frame is what the tap shows 3 s later.
        const dir = path.join(out, name);
        rmSync(dir, {recursive: true, force: true});
        mkdirSync(dir, {recursive: true});
        const labels = [];
        const moments = [5, 20, 35, 50, 70, 100, 160, 260];
        for (let i = 0; i < moments.length; i++) {
            const note = await page.evaluate(async ([s, pair]) => {
                const text = await window.__behaviours.tap(s, pair);
                document.getElementById("note").textContent = text.split("; [")[0];
                return text;
            }, [moments[i], name.endsWith("pair")]);
            labels.push(`${String(i).padStart(2, "0")} ${note}`);
            await page.screenshot({path: path.join(dir, `${String(i).padStart(2, "0")}.jpg`), type: "jpeg", quality: 85});
        }
        writeFileSync(path.join(dir, "labels.txt"), labels.join("\n") + "\n");
        execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", "1", "-i", path.join(dir, "%02d.jpg"), "-vf", "scale=640:-1,tile=4x2:padding=4:color=black", "-frames:v", "1", path.join(out, `${name}-strip.jpg`)]);
        summary[name] = {errors: errors.slice(0, 10), shots: labels};
        console.log(name, labels.join("\n"));
        if (errors.length) console.log(name, "errors:", errors.slice(0, 5));
        await context.close();
        continue;
    }
    if (name.startsWith("sm-")) {
        // sig2-small (signature behaviours, wave 2, the small bodies): the scene's recipe found in the day by the engine's own
        // functions (`behaviours-small.ts`), then a frame at each of its blocks (the pair framed together), 1280x720.
        const meta = await page.evaluate(() => window.__behaviours.smInfo());
        const moments = await page.evaluate((r) => window.__behaviours.recipeMoments(r), meta.recipe);
        const dir = path.join(out, name);
        rmSync(dir, {recursive: true, force: true});
        mkdirSync(dir, {recursive: true});
        writeFileSync(path.join(dir, "moments.json"), JSON.stringify(moments.slice(0, 12), null, 1));
        console.log(name, meta.recipe, `${moments.length} moments`, JSON.stringify(moments.slice(0, 3).map((m) => ({id: m.id.slice(-3), other: m.other?.slice(-3), start: Math.round(m.start), len: Math.round(m.end - m.start), blocks: m.blocks.map((b) => b.block).join(">")}))));
        for (const pickAt of arg("picks", arg("pick", "0")).split(",").map(Number)) {
        const pick = moments[pickAt];
        if (!pick) {
            summary[name] = {errors: ["no episode " + pickAt + " of " + meta.recipe + " in the day"]};
            continue;
        }
        const tag = arg("picks", "").includes(",") ? `${name}-p${pickAt}` : name;
        const dirOf = path.join(out, tag);
        rmSync(dirOf, {recursive: true, force: true});
        mkdirSync(dirOf, {recursive: true});
        // Moments: before, then each distinct block at 35% (and 80% when it is long), then after.
        const shots = [[pick.start - 1.5, "before"]];
        const seen = new Set();
        for (const b of pick.blocks) {
            const len = b.t1 - b.t0;
            if (len < 0.4) continue;
            shots.push([b.t0 + len * 0.35, `${b.block} (${len.toFixed(1)} s)`]);
            if (len >= 3.5 && !seen.has(b.block)) shots.push([b.t0 + len * 0.8, `${b.block} again`]);
            seen.add(b.block);
        }
        shots.push([pick.end + 3, "after"]);
        const picked = shots.slice(0, Number(arg("max", "12")));
        const labels = [];
        for (let i = 0; i < picked.length; i++) {
            const [epoch, label] = picked[i];
            const note = await page.evaluate(async ([ids, epoch, lengths, azimuth, polar]) => window.__behaviours.smShot(ids, epoch, lengths, azimuth === "" ? null : Number(azimuth), polar), [pick.other ? [pick.id, pick.other] : [pick.id], epoch, Number(arg("lengths", String(meta.lengths))), arg("azimuth", ""), Number(arg("polar", String(meta.polar)))]);
            await page.evaluate((t) => (document.getElementById("note").textContent = t), `${label} (+${(epoch - pick.start).toFixed(1)} s)\n${note}`);
            labels.push(`${String(i).padStart(2, "0")} ${label} (+${(epoch - pick.start).toFixed(1)} s): ${note}`);
            await page.screenshot({path: path.join(dirOf, `${String(i).padStart(2, "0")}.jpg`), type: "jpeg", quality: 88});
        }
        writeFileSync(path.join(dirOf, "labels.txt"), labels.join("\n") + "\n");
        const cols = picked.length > 8 ? 4 : picked.length > 4 ? 3 : 2;
        execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", "1", "-i", path.join(dirOf, "%02d.jpg"), "-vf", `scale=640:-1,tile=${cols}x${Math.ceil(picked.length / cols)}:padding=4:color=black`, "-frames:v", "1", path.join(out, `${tag}-strip.jpg`)]);
        summary[name] = {errors: errors.slice(0, 10), shots: labels};
        console.log(tag, labels.join("\n"));
        if (errors.length) console.log(tag, "errors:", errors.slice(0, 5));
        }
        await context.close();
        continue;
    }
    const info = await page.evaluate(() => window.__behaviours.info());
    console.log(name, JSON.stringify({births: info.births, matings: info.matings}));
    const plan = PLANS[name];
    const mating = info.matings[0];
    // (A contest's moments are from its own script: its walk is told by its end, 14–22 s of bouts and 5 s to run.)
    const end = mating?.contestEnd ?? 0;
    const at = (s) => (typeof s === "number" ? s : s.startsWith("end") ? end + Number(s.slice(3)) : Math.max(end - 27, 2) + Number(s.slice(4)));
    const dir = path.join(out, name);
    rmSync(dir, {recursive: true, force: true});
    mkdirSync(dir, {recursive: true});
    const labels = [];
    for (let i = 0; i < plan.shots.length; i++) {
        const [when, label, castK, tick, chosen] = plan.shots[i];
        const s = tick ? when : at(when);
        const note = await page.evaluate(async ([s, d, label, name, rival, who, close, tick, chosen]) => {
            if (chosen && close) {
                await window.__behaviours.shot(s, 30, close);
                const text = await window.__behaviours.chosen(close, chosen === "fly" ? null : 2.5, chosen !== "off");
                document.getElementById("note").textContent = `${label}\n${text}`;
                return text;
            }
            if (tick) {
                const ticked = await window.__behaviours.tick(s);
                document.getElementById("note").textContent = `${label}\n${ticked}`;
                return ticked;
            }
            let point;
            if (name.startsWith("dung") && label.includes("close")) {
                await window.__behaviours.shot(s, d);
                const marks = window.__behaviours.dung().sort((p, q) => q.alpha - p.alpha);
                if (marks[0]) point = {x: marks[0].x, z: marks[0].z};
            }
            if (close) {
                await window.__behaviours.shot(s, 30, close);
                const found = await window.__behaviours.find(close, d);
                document.getElementById("note").textContent = `${label}\n${found}`;
                return found;
            }
            // (The drop: side on to the tree, between its hole and the foot, low, under the leaves.)
            const hole = name === "drop" ? window.__behaviours.info().drops?.[0]?.hole : null;
            if (hole) {
                const text = await window.__behaviours.shot(s, 6.5, undefined, {x: hole.x + hole.nx * 1.1, z: hole.z + hole.nz * 1.1}, Math.atan2(hole.nx, hole.nz) + Math.PI / 2, 1.42);
                const h = window.__behaviours.handle;
                const fx = hole.x + hole.nx * 1.3;
                const fz = hole.z + hole.nz * 1.3;
                h.setView({target: {x: fx, y: (hole.y + h.heightAt(fx, fz)) / 2, z: fz}, distance: 9, polar: 1.3, azimuth: Math.atan2(hole.nx, hole.nz) + 0.5});
                console.log("[behaviours] view", JSON.stringify(h.view()), h.heightAt(fx, fz));
                await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
                document.getElementById("note").textContent = `${label}\n${text}`;
                return text;
            }
            const text = await window.__behaviours.shot(s, point ? 2.2 : label.includes("close") && !name.startsWith("dung") ? 2.6 : d, name === "contest" && label.includes("runs") ? rival : label.includes("close") && !name.startsWith("dung") ? window.__behaviours.info().a : who, point, name === "contest" ? 2.4 : 0.7, name === "contest" ? 0.85 : 1.15);
            if (label.includes("close") && !name.startsWith("dung")) await window.__behaviours.closeOn(window.__behaviours.info().a, name === "lure" ? d : 2.4);
            document.getElementById("note").textContent = `${label}\n${text}`;
            return text;
        }, [s, plan.distance, label, name, mating?.rival, info.births[0]?.mother ?? info.drops?.[0]?.mother ?? (name === "contest" ? info.a : name === "mob" ? info.c : undefined), castK === undefined ? null : info.ids[castK], tick ?? null, chosen ?? null]);
        labels.push(`${String(i).padStart(2, "0")} ${label}: ${note.replace(/\n/g, " | ")}`);
        await page.screenshot({path: path.join(dir, `${String(i).padStart(2, "0")}.jpg`), type: "jpeg", quality: 85});
    }
    writeFileSync(path.join(dir, "labels.txt"), labels.join("\n") + "\n");
    const cols = 4;
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", "1", "-i", path.join(dir, "%02d.jpg"), "-vf", `scale=640:-1,tile=${cols}x${Math.ceil(plan.shots.length / cols)}:padding=4:color=black`, "-frames:v", "1", path.join(out, `${name}-strip.jpg`)]);
    summary[name] = {info, errors: errors.slice(0, 10), shots: labels};
    console.log(name, labels.join("\n"));
    if (errors.length) console.log(name, "errors:", errors.slice(0, 5));
    await context.close();
}
writeFileSync(path.join(out, "summary.json"), JSON.stringify(summary, null, 1));
await browser.close();
server.close();
