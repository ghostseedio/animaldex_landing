#!/usr/bin/env tsx
/**
 * Hunt geometry pictures (AnimalDex decision 500, `voyage_config.hunt_geometry`, default off): the apps' embed
 * (`/ark/embed.html`, a development bundle from `scripts/build-ark-bundle.mjs --dev`) at 390x844, the server's reads
 * stubbed on localhost (the kills harness's way, `ark-kills-embed.mjs`): a PICTURE FIXTURE (labelled on every sheet, not
 * the Ark's population) of one hunter and four of its prey, the hunting read with `hunt_geometry: true` and the hunter's
 * lean. The lean is worked out here by the engine's rule (`geometry.ts` chooseLean: the nearest prey home, clamped to its
 * foray radius, an ambusher's less a body length), from the shared module's homes. The world clock is jumped through an
 * Ark day (`setClockScale(1, at)`); at each step the scene's own position of the hunter is read (`locate`), and frames
 * are taken from above. One sheet per scene: the frames, and a map of the hunter's path in the scene (on) next to the
 * module's path for today's foray (off, `forayAt`: what the scene draws with the flag off, src/lib/ark-hunting.test.ts).
 *
 *   npx tsx scripts/ark-hunt-geometry-clips.mts --out <dir> [--scenes fox,gecko,turtle]
 */
import {execFileSync} from "node:child_process";
import {createServer} from "node:http";
import {existsSync, mkdirSync, readFileSync, writeFileSync} from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";
import {fileURLToPath} from "node:url";
import sharp from "sharp";
import {ARK_DAY_MS, decodeAtlas, forayAt, forayRadius, homeOf, huntGeometryOf, sheetOf, stepIndex, type HuntGeometryTable} from "../src/ark-scene/positions/positions";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name: string, fallback: string) => {
    const at = process.argv.indexOf(`--${name}`);
    return at > 0 && process.argv[at + 1] && !process.argv[at + 1].startsWith("--") ? process.argv[at + 1] : fallback;
};
const out = path.resolve(arg("out", path.join(root, ".ark-golden", "hunt-geometry")));
mkdirSync(out, {recursive: true});
const atlas = decodeAtlas(JSON.parse(readFileSync(path.join(root, "src/ark-scene/positions/atlas.json"), "utf8")));
const GEO = JSON.parse(readFileSync(path.join(root, "src/ark-scene/positions/hunt-geometry.json"), "utf8")) as HuntGeometryTable;

type Scene = {key: string; hunter: [string, string]; prey: [string, string]; zone: string; title: string};
const ALL: Scene[] = [
    {key: "fox", hunter: ["red-fox", "Red Fox"], prey: ["bank-vole", "Bank Vole"], zone: "woodland", title: "Red Fox (pounce: searcher) works towards the voles' homes, never past its range"},
    {key: "gecko", hunter: ["common-house-gecko", "Common House Gecko"], prey: ["house-cricket", "House Cricket"], zone: "farm_garden", title: "Common House Gecko (dash: sit-and-wait) keeps to one spot"},
    {key: "turtle", hunter: ["alligator-snapping-turtle", "Alligator Snapping Turtle"], prey: ["common-toad", "Common Toad"], zone: "river_lake", title: "Alligator Snapping Turtle (lunge with its tongue lure) keeps to one spot"}
];
const scenes = arg("scenes", "fox,gecko,turtle").split(",").map((k) => ALL.find((s) => s.key === k)!).filter(Boolean);

execFileSync("node", [path.join(root, "scripts/build-ark-bundle.mjs"), "--dev"], {stdio: "inherit"});
const fixture = JSON.parse(readFileSync(path.join(root, "src/ark-scene/fixtures/snapshot-v2.json"), "utf8"));
const en = JSON.parse(readFileSync(path.join(root, "src/data/locales/en.json"), "utf8"));
const START = Date.parse("2026-08-01T00:00:00Z");
const id = (k: number, i: number) => `0000feed-0000-4000-8000-${(k * 256 + i).toString(16).padStart(12, "0")}`;
const sp = (k: number) => `5bec1e50-0000-4000-8000-${k.toString(16).padStart(12, "0")}`;
const HUNTER_SLOT = 3;

const state: {snapshot: unknown; hunting: unknown} = {snapshot: null, hunting: null};
const server = createServer((request, response) => {
    const url = new URL(request.url!, "http://localhost");
    const json = (body: unknown) => response.writeHead(200, {"Content-Type": "application/json", "Cache-Control": "no-store"}).end(JSON.stringify(body));
    if (url.pathname === "/api/ark/voyage") return json(state.snapshot);
    if (url.pathname === "/api/ark/words") return json({ark: en.ark, language: "en", dir: "ltr"});
    if (url.pathname === "/api/ark/hunting") return json({available: true, hunting: state.hunting});
    if (url.pathname === "/api/ark/events") return json({events: []});
    if (url.pathname.startsWith("/api/")) return json({available: false});
    const file = path.join(root, "public", path.normalize(url.pathname).replace(/^\/+/, ""));
    if (!file.startsWith(path.join(root, "public")) || !existsSync(file)) return response.writeHead(404).end();
    const type = file.endsWith(".html") ? "text/html" : file.endsWith(".js") ? "text/javascript" : file.endsWith(".webp") ? "image/webp" : file.endsWith(".json") ? "application/json" : "application/octet-stream";
    response.writeHead(200, {"Content-Type": type, "Cache-Control": "no-store"}).end(readFileSync(file));
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${(server.address() as {port: number}).port}`;
const {chromium} = createRequire(path.join(root, "node_modules", "x.js"))("playwright-core");
const browser = await chromium.launch({channel: "chrome", headless: true, args: ["--use-angle=metal", "--ignore-gpu-blocklist"]});

const report: string[] = [];
for (const s of scenes) {
    const hunterSlug = s.hunter[0];
    const cls = huntGeometryOf(GEO, hunterSlug);
    const sheet = sheetOf(atlas, hunterSlug)!;
    const home = homeOf(atlas, {zone: s.zone, slug: hunterSlug, speciesId: sp(0), slot: HUNTER_SLOT, rank: 0})!;
    // Four prey at the slots whose homes are nearest beyond its own range (so a searcher has somewhere to work towards).
    const R = forayRadius(sheet);
    const preyHomes = Array.from({length: 40}, (_, slot) => ({slot, h: homeOf(atlas, {zone: s.zone, slug: s.prey[0], speciesId: sp(1), slot, rank: 0})!}))
        .filter((p) => p.h)
        .map((p) => ({...p, d: Math.hypot(p.h.x - home.x, p.h.z - home.z)}))
        .sort((a, b) => a.d - b.d)
        .slice(0, 4);
    const animals = [
        {...fixture.animals[0], id: id(0, 0), species_profile_id: sp(0), name: s.hunter[1], scientific_name: s.hunter[1], model_slug: hunterSlug, zone: s.zone, activity: "any", sociality: null, slot: HUNTER_SLOT, slot_rank: 0},
        ...preyHomes.map((p, i) => ({...fixture.animals[0], id: id(1, i), species_profile_id: sp(1), name: s.prey[1], scientific_name: s.prey[1], model_slug: s.prey[0], zone: s.zone, activity: "any", sociality: null, slot: p.slot, slot_rank: 0}))
    ];
    state.snapshot = {...fixture, animals, counts: {animals: animals.length, species: 2, founders: 0}};
    // The engine's lean rule: the nearest prey home (edge first), clamped to R (an ambusher: R less a body length).
    const near = preyHomes.slice().sort((a, b) => (a.d - a.h.r) - (b.d - b.h.r) || a.d - b.d)[0];
    const lim = cls === 1 ? R : Math.max(R - Math.max(0.5, sheet.len), 0);
    const k = near.d > lim ? lim / near.d : 1;
    const lean = {x: home.x + (near.h.x - home.x) * k, z: home.z + (near.h.z - home.z) * k};
    const now = Date.now();
    const k0 = stepIndex((now - START) / ARK_DAY_MS) + 2;
    const leans = [[Math.round(lean.x * 100) / 100, Math.round(lean.z * 100) / 100, k0 - 200, Math.round(R * 100) / 100]];
    state.hunting = {hunting: "encounter", hunt_geometry: true, started_at: new Date(START).toISOString(), ark_day: (now - START) / ARK_DAY_MS, ticked_to: (now - START) / ARK_DAY_MS, predators: [[id(0, 0), 0, leans]], meals: []};

    const context = await browser.newContext({viewport: {width: 390, height: 844}, deviceScaleFactor: 2, isMobile: true, hasTouch: true});
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e: Error) => errors.push(e.message));
    await page.goto(`${base}/ark/embed.html?lang=en`, {waitUntil: "domcontentloaded"});
    await page.waitForFunction((who: string) => {
        const w = window as unknown as {__arkScene?: {locate: (id: string) => unknown; loading: () => boolean}};
        return w.__arkScene && w.__arkScene.locate(who) && !w.__arkScene.loading();
    }, id(0, 0), {timeout: 300000});
    await page.waitForTimeout(3000);
    const at = (step: number) => START + (step / 96) * ARK_DAY_MS;
    const locateAt = async (step: number) => {
        await page.evaluate((ms: number) => (window as unknown as {__arkScene: {setClockScale: (s: number, at: number) => void}}).__arkScene.setClockScale(1, ms), at(step));
        await page.waitForTimeout(250);
        return page.evaluate((who: string) => (window as unknown as {__arkScene: {locate: (id: string) => {x: number; z: number}}}).__arkScene.locate(who), id(0, 0));
    };
    // The path through one Ark day, step by step: the scene's (on) and the module's foray (off).
    const onPath: Array<{x: number; z: number}> = [];
    const offPath: Array<{x: number; z: number}> = [];
    for (let i = 0; i < 96; i++) {
        onPath.push(await locateAt(k0 + i));
        offPath.push(forayAt(atlas, home, id(0, 0), k0 + i));
    }
    // Frames from above, every three Ark hours, centred between its home and its lean.
    const span = Math.max(R * 2.6, 6);
    const cx = (home.x + lean.x) / 2, cz = (home.z + lean.z) / 2;
    const frames: string[] = [];
    for (let f = 0; f < 4; f++) {
        await locateAt(k0 + f * 24);
        await page.evaluate((v: unknown) => (window as unknown as {__arkScene: {setView: (v: unknown) => void}}).__arkScene.setView(v), {target: {x: cx, y: 0, z: cz}, distance: span, polar: 0.35, azimuth: 0});
        await page.waitForTimeout(1200);
        const file = path.join(out, `${s.key}-frame-${f}.jpg`);
        await page.screenshot({path: file, type: "jpeg", quality: 82});
        frames.push(file);
    }
    await context.close();

    // The map: home, foray radius, prey homes, the lean, the two paths.
    const W = 780, H = 1688, pad = 60;
    const xs = [...onPath, ...offPath, ...preyHomes.map((p) => p.h), home].map((p) => p.x), zs = [...onPath, ...offPath, ...preyHomes.map((p) => p.h), home].map((p) => p.z);
    const minX = Math.min(...xs, home.x - R) - 1, maxX = Math.max(...xs, home.x + R) + 1, minZ = Math.min(...zs, home.z - R) - 1, maxZ = Math.max(...zs, home.z + R) + 1;
    const sc = Math.min((W - 2 * pad) / (maxX - minX), (H - 400 - 2 * pad) / (maxZ - minZ));
    const X = (x: number) => pad + (x - minX) * sc, Z = (z: number) => 300 + pad + (z - minZ) * sc;
    const line = (pts: Array<{x: number; z: number}>, colour: string, dash = "") => `<polyline fill="none" stroke="${colour}" stroke-width="3" ${dash} points="${pts.map((p) => `${X(p.x).toFixed(1)},${Z(p.z).toFixed(1)}`).join(" ")}"/>`;
    const spread = (pts: Array<{x: number; z: number}>, c: {x: number; z: number}) => Math.max(...pts.map((p) => Math.hypot(p.x - c.x, p.z - c.z)));
    const onSpread = spread(onPath, lean), offSpread = spread(offPath, home);
    const toPrey = (pts: Array<{x: number; z: number}>) => pts.reduce((m, p) => m + Math.min(...preyHomes.map((q) => Math.hypot(p.x - q.h.x, p.z - q.h.z))), 0) / pts.length;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#10151f"/>
<text x="30" y="50" fill="#fff" font-family="Helvetica" font-size="26" font-weight="700">${s.title}</text>
<text x="30" y="90" fill="#cbd5e1" font-family="Helvetica" font-size="20">PICTURE FIXTURE: 1 ${s.hunter[1]}, 4 ${s.prey[1]} (not the Ark's population)</text>
<text x="30" y="122" fill="#cbd5e1" font-family="Helvetica" font-size="20">one Ark day, 96 steps of 15 Ark min; scene positions read with locate()</text>
<text x="30" y="160" fill="#7ccf62" font-family="Helvetica" font-size="20">green: the scene, hunt_geometry on (furthest from its spot ${onSpread.toFixed(2)} m)</text>
<text x="30" y="192" fill="#94a3b8" font-family="Helvetica" font-size="20">grey dashed: today's foray, flag off (furthest from home ${offSpread.toFixed(2)} m)</text>
<text x="30" y="224" fill="#f0b43c" font-family="Helvetica" font-size="20">mean distance to the nearest prey home: on ${toPrey(onPath).toFixed(2)} m, off ${toPrey(offPath).toFixed(2)} m</text>
<text x="30" y="256" fill="#cbd5e1" font-family="Helvetica" font-size="20">white ring: its foray cap R ${R.toFixed(2)} m; orange: prey homes; star: its lean</text>
<circle cx="${X(home.x)}" cy="${Z(home.z)}" r="${R * sc}" fill="none" stroke="#e2e8f0" stroke-width="2" stroke-dasharray="6 6"/>
${preyHomes.map((p) => `<circle cx="${X(p.h.x)}" cy="${Z(p.h.z)}" r="${Math.max(p.h.r * sc, 4)}" fill="#f0b43c33" stroke="#f0b43c" stroke-width="2"/>`).join("")}
${line(offPath, "#94a3b8", `stroke-dasharray="8 6"`)}
${line(onPath, "#7ccf62")}
<circle cx="${X(home.x)}" cy="${Z(home.z)}" r="7" fill="#e2e8f0"/>
<text x="${X(lean.x) - 12}" y="${Z(lean.z) + 10}" fill="#fff" font-size="30">*</text>
</svg>`;
    const map = path.join(out, `${s.key}-map.png`);
    await sharp(Buffer.from(svg)).png().toFile(map);
    const sheetFile = path.join(out, `${s.key}-sheet.jpg`);
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...frames.flatMap((f) => ["-i", f]), "-i", map, "-filter_complex", `${[0, 1, 2, 3, 4].map((i) => `[${i}:v]scale=390:844[v${i}]`).join(";")};${[0, 1, 2, 3, 4].map((i) => `[v${i}]`).join("")}hstack=inputs=5`, "-frames:v", "1", sheetFile]);
    const line1 = `${s.key}: class ${cls}, R ${R.toFixed(2)} m, lean (${lean.x.toFixed(2)}, ${lean.z.toFixed(2)}), on: furthest from spot ${onSpread.toFixed(2)} m, mean to prey ${toPrey(onPath).toFixed(2)} m; off: furthest from home ${offSpread.toFixed(2)} m, mean to prey ${toPrey(offPath).toFixed(2)} m; errors ${errors.length} -> ${sheetFile}`;
    report.push(line1);
    console.log(line1);
}
writeFileSync(path.join(out, "report.txt"), report.join("\n") + "\n");
await browser.close();
server.close();
