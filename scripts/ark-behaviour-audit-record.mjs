/**
 * Short clips of the owner's 7 Ark behaviour problems (docs/ark/behaviour-audit.md), from a running dev server
 * of any tree, on the v2 fixture (`/ark?fixture=1`, the same 130 animals on every tree):
 *
 *   node scripts/ark-behaviour-audit-record.mjs --base http://localhost:3312 --label release --out <dir> [--only 1,6]
 *
 * Each clip is its own page, filmed with the DevTools screencast (frames with their timestamps, joined by ffmpeg), the camera driven through the development
 * `window.__arkDebug` (camera, controls, entries): it follows or frames the animals the problem is about. Out: <out>/<label>/<n>-<name>.webm plus a 4-frame contact sheet .jpg each.
 * Local only. GPU kept short: about 10 s a clip.
 */

import {execFileSync} from "node:child_process";
import {existsSync, mkdirSync, readdirSync, rmSync, writeFileSync} from "node:fs";
import {createRequire} from "node:module";
import os from "node:os";
import path from "node:path";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : fallback;
};
const base = opt("base", "http://localhost:3312");
const label = opt("label", "tree");
const out = path.resolve(opt("out", "ark-audit-clips"), label);
const only = opt("only") ? new Set(opt("only").split(",").map(Number)) : null;
const hour = opt("hour", "9.5");
mkdirSync(out, {recursive: true});

const require = createRequire(path.join(process.cwd(), "package.json"));
const {chromium} = require("playwright-core");
const cache = path.join(os.homedir(), "Library/Caches/ms-playwright");
const cached = existsSync(cache)
    ? readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse().map((d) => path.join(cache, d, "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing")).find(existsSync)
    : undefined;
const browser = await chromium.launch({executablePath: process.env.ARK_CHROMIUM || cached, headless: true, args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=metal"]});

/**
 * The shots. `pick` runs in the page: (entries) => the entries to frame (the first one is followed when `follow`).
 * `view`: the camera's offset from the subject (m): [side, up, back] in the subject's frame, or "overhead".
 */
const SHOTS = [
    {n: 1, name: "flight-no-flap", seconds: 9, hour, follow: true, view: [5, 2.5, -7], pick: `(e) => e.filter((x) => (x.state?.airborne || x.air > 0.9) && x.middle).sort((a, b) => (b.animal.model_slug === "golden-eagle") - (a.animal.model_slug === "golden-eagle"))`},
    {n: 2, name: "roaming-circles", seconds: 14, hour, follow: false, view: "overhead", height: 55, pick: `(e) => e.filter((x) => (x.state?.airborne || x.air > 0.9) && x.middle)`},
    {n: 3, name: "grazers-dont-graze", seconds: 10, hour, follow: false, view: [7, 3.5, 9], pick: `(e) => e.filter((x) => x.animal.model_slug === "plains-zebra" && x.middle)`},
    {n: 4, name: "ducks-land-water", seconds: 12, hour, follow: false, view: [8, 5, 10], pick: `(e) => e.filter((x) => x.animal.model_slug === "mallard" && x.middle)`},
    {n: 5, name: "no-head-movement", seconds: 9, hour, follow: true, view: [2.2, 1.0, 2.6], pick: `(e) => e.filter((x) => x.animal.model_slug === "roe-deer" && x.middle && !(x.state?.airborne))`},
    {n: 6, name: "wolf-and-deer", seconds: 12, hour, follow: false, view: [10, 9, 14], pick: `(e) => [...e.filter((x) => x.animal.model_slug === "eurasian-wolf" && x.middle), ...e.filter((x) => x.animal.model_slug === "roe-deer" && x.middle)]`},
    {n: 7, name: "same-thing-same-time", seconds: 10, hour, follow: false, view: [9, 6, 12], pick: `(e) => e.filter((x) => x.animal.model_slug === "plains-zebra" && x.middle)`}
];

const ffmpeg = (argv) => execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...argv]);

for (const shot of SHOTS) {
    if (only && !only.has(shot.n)) continue;
    const dir = path.join(out, `tmp-${shot.n}`);
    rmSync(dir, {recursive: true, force: true});
    const context = await browser.newContext({viewport: {width: 1280, height: 720}, deviceScaleFactor: 1});
    const page = await context.newPage();
    await page.goto(`${base}/ark?fixture=1&hour=${shot.hour}`, {waitUntil: "domcontentloaded", timeout: 300000});
    await page.waitForFunction(() => window.__arkDebug && window.__arkDebug.entries().filter((e) => e.middle).length > 60, null, {timeout: 300000, polling: 500});
    await page.addStyleTag({content: "header, footer, nav {display:none!important}"});
    // Let models load and the schedule settle.
    await page.waitForTimeout(6000);
    const found = await page.evaluate(({pick, view, follow, height}) => {
        const debug = window.__arkDebug;
        const chosen = eval(pick)(debug.entries());
        if (!chosen.length) return null;
        const camera = debug.camera;
        const controls = debug.controls;
        const centre = () => {
            const list = follow ? [chosen[0]] : chosen;
            const m = list.reduce((s, e) => ({x: s.x + e.middle.x, y: s.y + e.middle.y, z: s.z + e.middle.z}), {x: 0, y: 0, z: 0});
            return {x: m.x / list.length, y: m.y / list.length, z: m.z / list.length};
        };
        const spread = Math.max(...chosen.map((e) => Math.hypot(e.middle.x - chosen[0].middle.x, e.middle.z - chosen[0].middle.z)), 1);
        const scale = follow ? 1 : Math.max(1, spread / 10);
        let yaw0 = chosen[0].yawNow ?? 0;
        const place = () => {
            const c = centre();
            const yaw = follow ? chosen[0].yawNow ?? yaw0 : yaw0;
            if (view === "overhead") {
                camera.position.set(c.x + 0.01, c.y + (height ?? 50), c.z + 6);
            } else {
                const [side, up, back] = view;
                const s = Math.sin(yaw);
                const k = Math.cos(yaw);
                camera.position.set(c.x + (side * k - back * s) * scale, c.y + up * scale, c.z + (-side * s - back * k) * scale);
            }
            controls.target.set(c.x, c.y, c.z);
            camera.lookAt(c.x, c.y, c.z);
            controls.update?.();
        };
        window.__auditCam = true;
        const loop = () => {
            if (!window.__auditCam) return;
            place();
            requestAnimationFrame(loop);
        };
        loop();
        return {slugs: [...new Set(chosen.map((e) => e.animal.model_slug))], count: chosen.length, states: chosen.slice(0, 8).map((e) => e.state?.doing ?? e.state?.kind ?? (e.awake ? "awake" : "asleep"))};
    }, {pick: shot.pick, view: shot.view, follow: shot.follow, height: shot.height});
    mkdirSync(dir, {recursive: true});
    const frames = [];
    const cdp = await context.newCDPSession(page);
    cdp.on("Page.screencastFrame", async (frame) => {
        frames.push({data: frame.data, at: frame.metadata.timestamp});
        await cdp.send("Page.screencastFrameAck", {sessionId: frame.sessionId}).catch(() => {});
    });
    await cdp.send("Page.startScreencast", {format: "jpeg", quality: 85, maxWidth: 1280, maxHeight: 720, everyNthFrame: 1});
    await page.waitForTimeout(shot.seconds * 1000 + 300);
    await cdp.send("Page.stopScreencast").catch(() => {});
    await context.close();
    const file = path.join(out, `${shot.n}-${shot.name}.webm`);
    if (found && frames.length > 2) {
        // The frames as they came, each held until the next (a concat list with durations).
        const list = [];
        frames.forEach((f, i) => {
            const name = path.join(dir, `f${String(i).padStart(5, "0")}.jpg`);
            writeFileSync(name, Buffer.from(f.data, "base64"));
            const next = frames[i + 1]?.at ?? f.at + 1 / 30;
            list.push(`file '${name}'`, `duration ${Math.max(next - f.at, 1 / 120).toFixed(4)}`);
        });
        list.push(`file '${path.join(dir, `f${String(frames.length - 1).padStart(5, "0")}.jpg`)}'`);
        writeFileSync(path.join(dir, "list.txt"), list.join("\n"));
        ffmpeg(["-f", "concat", "-safe", "0", "-i", path.join(dir, "list.txt"), "-vf", "fps=30,format=yuv420p", "-c:v", "libvpx-vp9", "-b:v", "2M", "-an", file]);
        ffmpeg(["-i", file, "-vf", `fps=4/${shot.seconds},scale=640:-1,tile=4x1`, "-frames:v", "1", file.replace(/\.webm$/, ".jpg")]);
    }
    rmSync(dir, {recursive: true, force: true});
    found && (found.frames = frames.length);
    console.log(JSON.stringify({shot: shot.n, name: shot.name, file, found}));
}
await browser.close();
