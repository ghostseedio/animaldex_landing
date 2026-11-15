#!/usr/bin/env node
/**
 * The kills harness in the apps' embed (lane ark-kills-real): `/ark/embed.html` at 390×844 (a phone, DPR 2) on a
 * development bundle (`scripts/build-ark-bundle.mjs --dev`), with the server's reads stubbed on localhost (a made-up
 * Ark of a lion, an impala and vultures; the hunting read and the event log with one meal, its encounter where the
 * scene has the two). The embed's own refresh reads the meal; frames of the meal, the marker chip, and the camera's
 * flight after a tap on it. Nothing leaves localhost but the model files.
 *
 *   node scripts/ark-kills-embed.mjs --out <dir>
 */
import {execFileSync} from "node:child_process";
import {createServer} from "node:http";
import {existsSync, mkdirSync, readFileSync, writeFileSync} from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";
import {fileURLToPath} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name, fallback) => {
    const at = process.argv.indexOf(`--${name}`);
    return at > 0 && process.argv[at + 1] ? process.argv[at + 1] : fallback;
};
const out = path.resolve(arg("out", path.join(root, ".ark-golden", "kills-embed")));
mkdirSync(out, {recursive: true});
execFileSync("node", [path.join(root, "scripts/build-ark-bundle.mjs"), "--dev"], {stdio: "inherit"});

const fixture = JSON.parse(readFileSync(path.join(root, "src/ark-scene/fixtures/snapshot-v2.json"), "utf8"));
const en = JSON.parse(readFileSync(path.join(root, "src/data/locales/en.json"), "utf8"));
const id = (k, i) => `0000feed-0000-4000-8000-${(k * 256 + i).toString(16).padStart(12, "0")}`;
const sp = (k) => `5bec1e50-0000-4000-8000-${k.toString(16).padStart(12, "0")}`;
const cast = [["african-lion", "African Lion", 1, "any"], ["impala", "Impala", 1, "diurnal"], ["white-backed-vulture", "White-backed Vulture", 2, "diurnal"]];
const animals = cast.flatMap(([slug, name, n, activity], k) => Array.from({length: n}, (_, i) => ({...fixture.animals[0], id: id(k, i), species_profile_id: sp(k), name, scientific_name: name, model_slug: slug, zone: "grassland", activity, sociality: null, slot: 90 + k, slot_rank: i})));
const snapshot = {...fixture, animals, counts: {animals: animals.length, species: cast.length, founders: 0}};
const record = (k, status) => ({id: id(k, 0), species_profile_id: sp(k), name: cast[k][1], model_slug: cast[k][0], zone: "grassland", arrived_at: "2026-11-12T00:00:00Z", origin: "arrived", generation: 0, slot: 90 + k, slot_rank: 0, activity: cast[k][3], sociality: null, status});
const state = {meal: null};

const server = createServer((request, response) => {
    const url = new URL(request.url, "http://localhost");
    const json = (body) => response.writeHead(200, {"Content-Type": "application/json", "Cache-Control": "no-store"}).end(JSON.stringify(body));
    if (url.pathname === "/api/ark/voyage") return json(snapshot);
    if (url.pathname === "/api/ark/words") return json({ark: en.ark, language: "en", dir: "ltr"});
    if (url.pathname === "/api/ark/hunting") return json({available: true, hunting: {hunting: "encounter", started_at: "2026-08-01T00:00:00Z", ark_day: 0, ticked_to: 0, predators: [], meals: state.meal ? [{id: 900, ark_day: 1, predator: id(0, 0), prey: id(1, 0), encounter: state.meal.encounter}] : []}});
    if (url.pathname === "/api/ark/events") return json({events: state.meal ? [{id: 900, kind: "meal", at: new Date(state.meal.encounter.t * 1000).toISOString(), ark_day: 1, species_profile_id: sp(0), species: "African Lion", animal: record(0, "present"), other: record(1, "eaten"), phrase: "impala", parents: [], bringers: [], encounter: state.meal.encounter}] : []});
    if (url.pathname.startsWith("/api/")) return json({available: false});
    const file = path.join(root, "public", path.normalize(url.pathname).replace(/^\/+/, ""));
    if (!file.startsWith(path.join(root, "public")) || !existsSync(file)) return response.writeHead(404).end();
    const type = file.endsWith(".html") ? "text/html" : file.endsWith(".js") ? "text/javascript" : file.endsWith(".webp") ? "image/webp" : file.endsWith(".json") ? "application/json" : "application/octet-stream";
    response.writeHead(200, {"Content-Type": type, "Cache-Control": "no-store"}).end(readFileSync(file));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;

const {chromium} = createRequire(path.join(root, "node_modules", "x.js"))("playwright-core");
const browser = await chromium.launch({channel: "chrome", headless: true, args: ["--use-angle=metal", "--ignore-gpu-blocklist"]});
const context = await browser.newContext({viewport: {width: 390, height: 844}, deviceScaleFactor: 2, isMobile: true, hasTouch: true});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${base}/ark/embed.html?lang=en`, {waitUntil: "domcontentloaded"});
await page.waitForFunction(() => window.__arkScene && window.__arkScene.locate && window.__arkScene.locate("0000feed-0000-4000-8000-000000000000") && !window.__arkScene.loading(), null, {timeout: 300000});
await page.waitForTimeout(3000);
const where = await page.evaluate(() => [window.__arkScene.locate("0000feed-0000-4000-8000-000000000000"), window.__arkScene.locate("0000feed-0000-4000-8000-000000000100")]);
const [h, q] = where;
const d = Math.hypot(q.x - h.x, q.z - h.z);
const k = d > 22 ? 22 / d : 1;
// The meal's step a little after the next refresh (the embed reads every 45 s): its chase and meal play live.
const t = Date.now() / 1000 + 2;
state.meal = {encounter: {t, step: 1, predator: {x: q.x + (h.x - q.x) * k, z: q.z + (h.z - q.z) * k}, prey: {x: q.x, z: q.z, r: 0.5}, d: Math.min(d, 22)}};
console.log("meal at", new Date(t * 1000).toISOString(), "distance", d.toFixed(1));
// The embed's own refresh (45 s) reads the hunting read and the event log.
await page.waitForFunction(() => window.__arkScene.liveHunt && window.__arkScene.liveHunt(), null, {timeout: 120000, polling: 1000});
const shots = [];
const shot = async (name, view) => {
    if (view) await page.evaluate((v) => window.__arkScene.setView(v), view);
    await page.waitForTimeout(900);
    const file = path.join(out, `${String(shots.length).padStart(2, "0")}-${name}.jpg`);
    await page.screenshot({path: file, type: "jpeg", quality: 80});
    const chip = await page.evaluate(() => {
        const b = document.getElementById("ark-hunt");
        return b && !b.hidden ? `${b.textContent} [${b.getAttribute("aria-label")}]` : "no chip";
    });
    shots.push(`${name}: ${chip}`);
};
const close = (s) => ({target: {x: q.x, y: s.y ?? 0.6, z: q.z}, distance: s.distance, polar: 1.1, azimuth: 0.7});
await shot("marker-from-afar");
await page.click("#ark-hunt");
await page.waitForTimeout(3500);
await shot("after-tap-flown-there");
await shot("eating-close", close({distance: 8}));
await page.waitForTimeout(25000);
await shot("eating-25s-later", close({distance: 8}));
writeFileSync(path.join(out, "shots.txt"), shots.join("\n") + `\nerrors: ${JSON.stringify(errors.slice(0, 5))}\n`);
console.log(shots.join("\n"), "errors", errors.length);
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-pattern_type", "glob", "-i", path.join(out, "*.jpg"), "-vf", "scale=390:-1,tile=4x1:padding=4:color=black", "-frames:v", "1", path.join(out, "..", "embed-strip.jpg")]);
await browser.close();
server.close();
