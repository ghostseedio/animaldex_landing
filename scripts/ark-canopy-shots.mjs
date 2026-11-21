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
import {appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync} from "node:fs";
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
// --local-set DIR: a local Ark build (DIR/ark/manifest.json + DIR/ark/<slug>/{near.glb,far.glb,ark.json}, and
// DIR/rig/publish-v3/{manifest.json,<slug>/<version>.rig.glb}) laid over the live sets, to look at re-made models and
// rigs before anything is uploaded (ARK-CANOPY's re-rigged gibbons).
const localSet = arg("local-set", null);
if (localSet) {
    const arkLocal = JSON.parse(readFileSync(path.join(localSet, "ark", "manifest.json"), "utf8")).models ?? {};
    const rigLocal = JSON.parse(readFileSync(path.join(localSet, "rig", "publish-v3", "manifest.json"), "utf8")).species ?? {};
    const files = {"near.glb": "near.glb", "far.glb": "far.glb", "ark.json": "ark.json"};
    await page.route(/talking-models\/(v1\/ark|ark-rig\/v3)\//, async (route) => {
        const url = route.request().url();
        if (/v1\/ark\/manifest(\.json)?(\?|$)/.test(url) || /ark-rig\/v3\/manifest(\.json)?(\?|$)/.test(url)) {
            const live = await route.fetch();
            const doc = await live.json();
            if (url.includes("/v1/ark/")) Object.assign(doc.models, arkLocal);
            else Object.assign(doc.species, rigLocal);
            return route.fulfill({response: live, json: doc});
        }
        const m = /v1\/ark\/([^/]+)\/([0-9a-f]+)\.(near\.glb|far\.glb|ark\.json)/.exec(url);
        if (m && arkLocal[m[1]] === m[2]) return route.fulfill({path: path.join(localSet, "ark", m[1], files[m[3]])});
        const r = /ark-rig\/v3\/([^/]+)\/([0-9a-f]+)\.rig\.glb/.exec(url);
        if (r && rigLocal[r[1]] === r[2]) return route.fulfill({path: path.join(localSet, "rig", "publish-v3", r[1], `${r[2]}.rig.glb`)});
        return route.continue();
    });
}
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.stack ?? e.message).slice(0, 600)));
await page.goto(`${base}?world=v2&island=${arg("island", "wild")}&quality=${arg("quality", "high")}&epoch=${plan[0]?.epoch ?? ""}`, {waitUntil: "domcontentloaded", timeout: 120000});
const started = Date.now();
while (Date.now() - started < 240000) {
    const state = await page.evaluate(() => ({ok: Boolean(window.__canopy?.ready?.()), error: window.__canopyError ?? null}));
    if (state.error) throw new Error(state.error);
    if (state.ok) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
}
const notes = [];
for (const shot of plan) {
    if (shot.prefocus) {
        // (Its rig loads only near the camera, and a brachiator travels the crowns only once its rig's hands can hold:
        // framed first, at the plan's epoch, so its rig is in before the search.)
        await page.evaluate(async (s) => {
            await window.__canopy.at(s.epoch, 2);
            await window.__canopy.frame(s.prefocus, 3, 0.7, 1.3, 0);
        }, shot);
    }
    if (shot.find) {
        // (A moment found on the page's own schedule: the first climb of these kinds from `from`, `after` seconds into it.)
        // (Or, with `phases`, the first moment one of them is swinging, leaping or in flight on its canopy route.)
        const found = await page.evaluate(async (f) => (f.ledge || f.zoo ? window.__canopy.findLedge(f.pattern, f.ledge ?? f.zoo, f.from, f.seconds ?? 1800, f.step ?? 1, Boolean(f.zoo)) : f.phases ? window.__canopy.findCanopy(f.pattern, f.phases, f.from, f.seconds ?? 1800, f.step ?? 1, f.skip ?? []) : window.__canopy.findClimb(f.pattern, f.from, f.seconds ?? 1800, f.step ?? 2, f.skip ?? [], f.beat ?? "climb")), shot.find);
        console.log(shot.name, "found", JSON.stringify(found));
        if (!found) continue;
        shot.epoch = found.epoch + (shot.find.after ?? 1);
        shot.id = found.id;
    }
    if (shot.pick) {
        // (`pick`: the first of these kinds drawn one by one at that moment, `skip` of them passed over; lane ark-sleep.)
        const found = await page.evaluate(async (s) => {
            // (Entries are made near the camera: look at `nearTo` first.)
            if (s.nearTo) await window.__canopy.look({x: s.nearTo.x, y: s.nearTo.y ?? 0, z: s.nearTo.z}, 20, 0.7, 1.0);
            await window.__canopy.at(s.epoch, s.run ?? 2);
            const found = window.__canopy.where(s.pick).filter((w) => w.at);
            // (`nearTo`: the one nearest that point first.)
            if (s.nearTo) found.sort((a, b) => Math.hypot(a.at.x - s.nearTo.x, a.at.z - s.nearTo.z) - Math.hypot(b.at.x - s.nearTo.x, b.at.z - s.nearTo.z));
            return found.slice(s.skip ?? 0)[0] ?? null;
        }, shot);
        console.log(shot.name, "picked", JSON.stringify(found));
        if (!found) continue;
        shot.id = found.id;
    }
    if (shot.young) {
        const at = await page.evaluate(async (s) => {
            await window.__canopy.at(s.epoch, s.run ?? 2);
            return s.young.map((id) => window.__canopy.young(id));
        }, shot);
        notes.push(`${shot.name}: ${JSON.stringify(at)}`);
        console.log(shot.name, JSON.stringify(at));
        continue;
    }
    if (shot.climbs) {
        const log = await page.evaluate((c) => window.__canopy.climbLog(c.pattern, c.from, c.seconds, c.step ?? 2), shot.climbs);
        writeFileSync(path.join(out, `${shot.name}.json`), JSON.stringify(log, null, 1));
        console.log(shot.name, log.length, "climbs");
        continue;
    }
    if (shot.where) {
        // (Where the animals of these kinds are at that moment: no picture.)
        const at = await page.evaluate(async (s) => {
            await window.__canopy.at(s.epoch, s.run ?? 2);
            return window.__canopy.where(s.where);
        }, shot);
        notes.push(`${shot.name}: ${JSON.stringify(at)}`);
        console.log(shot.name, JSON.stringify(at));
        continue;
    }
    if (shot.clip) {
        // A short clip: `clip.seconds` of the page's clock at `clip.fps`, the camera following the animal (or held on the
        // target), each frame a still; ffmpeg makes them an mp4 when it is on the path.
        const dir = path.join(out, `${shot.name}.frames`);
        mkdirSync(dir, {recursive: true});
        const fps = shot.clip.fps ?? 15;
        const count = Math.round((shot.clip.seconds ?? 4) * fps);
        await page.evaluate(async (s) => {
            if (s.hours !== undefined) window.__canopy.hours(s.hours);
            // (`lead`: begun this many seconds early and played up to the moment, so its rig is posing when the clip starts)
            await window.__canopy.at(s.epoch - (s.lead ?? 0), s.run ?? 2);
            if (s.id && s.clear) {
                const v = await window.__canopy.clearFrame(s.id, s.distance, s.polar ?? 1.2, s.lift ?? 0);
                if (v) {
                    s.azimuth = v.azimuth;
                    s.polar = v.polar;
                }
            } else if (s.id) await window.__canopy.frame(s.id, s.distance, s.azimuth ?? 0.7, s.polar ?? 1.3, s.lift ?? 0);
            else await window.__canopy.look(s.target, s.distance, s.azimuth ?? 0.7, s.polar ?? 1.3);
            // (`hands`: the clip waits for that species' rig, so no frame shows the still model before it)
            if (s.hands) s.handsIn = await window.__canopy.handsReady(s.hands);
            for (let t = 0; t < (s.lead ?? 0) - 1e-6; t += 1 / (s.clip.fps ?? 15)) {
                await window.__canopy.step(1 / (s.clip.fps ?? 15));
                if (s.id) await window.__canopy.follow(s.id, s.distance, s.azimuth ?? 0.7, s.polar ?? 1.3, s.lift ?? 0);
            }
            return s;
        }, shot).then((s) => Object.assign(shot, {azimuth: s.azimuth, polar: s.polar, handsIn: s.handsIn}));
        for (let k = 0; k < count; k++) {
            await page.evaluate(async ({s, dt}) => {
                if (dt > 0) await window.__canopy.step(dt);
                // (`reclear`: each frame from its own clearest side, for a sheet of stills where the crowns would hide it)
                if (s.id && s.clip.reclear) await window.__canopy.clearFrame(s.id, s.distance, s.polar ?? 1.2, s.lift ?? 0);
                else if (s.id && s.clip.follow !== false) await window.__canopy.follow(s.id, s.distance, s.azimuth ?? 0.7, s.polar ?? 1.3, s.lift ?? 0);
                if (s.id && s.cut) await window.__canopy.cut(s.id, s.cut === "leaves");
            }, {s: shot, dt: k ? 1 / fps : 0});
            await page.screenshot({path: path.join(dir, `f${String(k).padStart(4, "0")}.jpg`), type: "jpeg", quality: 85});
            // (each frame: its canopy phase and, for a brachiator, how far its holding hand is from its hold)
            const probe = await page.evaluate((id) => {
                const miss = window.__canopy.handMiss?.() ?? null;
                // (each hold on the screen, px: through the camera's own matrices)
                const cam = window.__arkDebug?.camera;
                if (cam && miss) {
                    for (const m of Object.values(miss)) {
                        if (!m.hold) continue;
                        const v = m.hold, a = cam.matrixWorldInverse.elements, b = cam.projectionMatrix.elements;
                        const e = [0, 1, 2, 3].map((r) => a[r] * v[0] + a[4 + r] * v[1] + a[8 + r] * v[2] + a[12 + r]);
                        const c = [0, 1, 2, 3].map((r) => b[r] * e[0] + b[4 + r] * e[1] + b[8 + r] * e[2] + b[12 + r] * e[3]);
                        m.screen = [(c[0] / c[3] + 1) / 2 * innerWidth, (1 - c[1] / c[3]) / 2 * innerHeight];
                    }
                }
                return {phase: id ? window.__canopy.who(id)?.canopy ?? null : null, miss};
            }, shot.id ?? null);
            appendFileSync(path.join(dir, "probe.jsonl"), JSON.stringify({k, ...probe}) + "\n");
        }
        try {
            const {execFileSync} = await import("node:child_process");
            execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(fps), "-i", path.join(dir, "f%04d.jpg"), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", path.join(out, `${shot.name}.mp4`)]);
        } catch (e) {
            console.log(shot.name, "no mp4:", String(e).slice(0, 120));
        }
        notes.push(`${shot.name}: clip ${count} frames from ${shot.epoch} id ${shot.id ?? "-"}`);
        console.log(shot.name, "clip", count);
        continue;
    }
    const note = await page.evaluate(async (s) => {
        const c = window.__canopy;
        if (s.hours !== undefined) c.hours(s.hours);
        // (`light`: the light alone pinned to that hour, lane ark-sleep; the schedule keeps the world's hour.)
        c.light(s.light ?? null);
        // (`near`: the camera there first, so a far animal's entry is made and drawn before it is framed; lane ark-sleep.)
        if (s.near) {
            await c.look(s.near, s.distance ?? 8, s.azimuth ?? 0.7, s.polar ?? 1.3);
            await c.at(s.epoch, s.run ?? 2);
        }
        // (`pin`: followed, so the live budget draws it though it rests this turn; lane ark-sleep.)
        if (s.pin && s.id) {
            c.pin(s.id);
            await c.at(s.epoch, 4);
        }
        await c.at(s.epoch, s.run ?? 2);
        if (s.id && s.clear) return JSON.stringify({view: await c.clearFrame(s.id, s.distance, s.polar ?? 1.2, s.lift ?? 0), at: c.locate(s.id), cut: s.cut ? await c.cut(s.id) : 0});
        if (s.id) {
            const framed = await c.frame(s.id, s.distance, s.azimuth ?? 0.7, s.polar ?? 1.3, s.lift ?? 0);
            return JSON.stringify({framed, cut: s.cut ? await c.cut(s.id) : 0});
        }
        await c.look(s.target, s.distance, s.azimuth ?? 0.7, s.polar ?? 1.3);
        return "view";
    }, shot);
    await page.screenshot({path: path.join(out, `${shot.name}.jpg`), type: "jpeg", quality: 88});
    if (shot.pin) await page.evaluate(() => window.__canopy.pin(null));
    const scan = await page.evaluate((id) => JSON.stringify({...window.__canopy.nanScan(), who: id ? window.__canopy.who(id) : null}), shot.id ?? null);
    notes.push(`${shot.name}: epoch ${shot.epoch} id ${shot.id ?? "-"} ${note} ${scan}`);
    console.log(shot.name, note, scan);
}
writeFileSync(path.join(out, "notes.txt"), notes.concat(errors.map((e) => `error: ${e}`)).join("\n") + "\n");
if (errors.length) console.log("page errors:", errors.slice(0, 5));
await browser.close();
server.close();
