#!/usr/bin/env node
/**
 * ARK-SEAT's audit (the owner, 2026-11-21: "i need guaranteed fixes on animals not properly interacting with their
 * environments from bugs to mammals"): the real scene (the apps' embed, a development bundle:
 * `node scripts/build-ark-bundle.mjs --dev`), headless, on a snapshot, at several hours of the day on both islands.
 * The camera goes to every animal in turn (near enough that it and its neighbours are drawn as models and rigs), and
 * each one drawn is measured by the scene's probe (`src/ark-scene/seat/audit-probe.ts`): every vertex of its body as
 * posed, against the scene's own meshes with three's Raycaster, not the seat pass's index.
 *
 * It fails (exit 1, with `--gate`) when an animal that is not flying, swimming, hanging, carried or in its den is
 *   - more than 3 cm over the drawn surface it rests on (hovering),
 *   - more than 3 cm under it (sunk), or
 *   - inside a rock, a wall or any closed solid (its middle, or two or more of its body's inner points).
 *
 *   node scripts/ark-seat-audit.mjs --public public --snapshot /ark-local/live.json --out <dir>
 *        [--fixture]                 the committed development fixture instead of a snapshot (CI)
 *        [--hours 3,7,11,15,19,23] [--islands wild,town]
 *        [--stops 400]               camera stops per island and hour at most (0: until every animal is seen)
 *        [--seat off]                the pass off (the "before" numbers)
 *        [--gl swiftshader]          software WebGL (GitHub's runners)
 *        [--gate]                    exit 1 on any failure
 *        [--label after]
 *
 * Writes <out>/<label>.json (every row) and <out>/<label>.md (the tables). Nothing is uploaded; the models are read
 * from the public bucket.
 */
import {createReadStream, existsSync, mkdirSync, statSync, writeFileSync} from "node:fs";
import {createServer} from "node:http";
import path from "node:path";

const has = (name) => process.argv.includes(`--${name}`);
const arg = (name, fallback) => {
    const at = process.argv.indexOf(`--${name}`);
    return at >= 0 && process.argv[at + 1] && !process.argv[at + 1].startsWith("--") ? process.argv[at + 1] : fallback;
};
const publicDir = path.resolve(arg("public", "public"));
const out = path.resolve(arg("out", ".ark-golden/seat"));
const label = arg("label", "after");
const hours = arg("hours", "3,7,11,15,19,23").split(",").map(Number);
const islands = arg("islands", "wild,town").split(",");
const maxStops = Number(arg("stops", "0"));
const seatOff = arg("seat", "on") === "off";
const gl = arg("gl", "metal");
const TOLERANCE = 0.03;
mkdirSync(out, {recursive: true});

const TYPES = {".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".wasm": "application/wasm", ".webp": "image/webp", ".png": "image/png", ".glb": "model/gltf-binary", ".bin": "application/octet-stream", ".m4a": "audio/mp4", ".hdr": "application/octet-stream", ".ktx2": "image/ktx2", ".map": "application/json", ".css": "text/css"};
const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    const file = path.join(publicDir, decodeURIComponent(url.pathname));
    if (!file.startsWith(publicDir) || !existsSync(file) || !statSync(file).isFile()) return void response.writeHead(404).end();
    response.writeHead(200, {"content-type": TYPES[path.extname(file)] ?? "application/octet-stream", "cache-control": "no-cache"});
    createReadStream(file).pipe(response);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;

const {chromium} = await import("playwright-core");
const browser = await chromium.launch(
    gl === "swiftshader"
        ? {headless: true, args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]}
        : {channel: "chrome", headless: true, args: ["--headless=new", "--enable-gpu", "--ignore-gpu-blocklist", `--use-angle=${gl}`]}
);
const context = await browser.newContext({viewport: {width: 900, height: 640}, deviceScaleFactor: 1});
const page = await context.newPage();
page.setDefaultTimeout(900_000);
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
// The clock: from a fixed moment, running at real speed (the same animals in the same places run to run).
await page.addInitScript(() => {
    const realDate = Date.now.bind(Date);
    const start = Date.UTC(2026, 10, 20, 3, 0, 0);
    const date0 = realDate();
    Date.now = () => start + (realDate() - date0);
});
const wait = (ms) => page.waitForTimeout(ms);
const source = has("fixture") ? "fixture=1" : `snapshot=${arg("snapshot", "/ark-local/live.json")}`;
await page.goto(`${base}/ark/embed.html?${source}&hud=0&lang=en${seatOff ? "&seat=off" : ""}`, {waitUntil: "domcontentloaded"});
await page.waitForFunction(() => Boolean(window.__arkScene), null, {timeout: 900_000});
await page.evaluate(() => window.__arkScene.mounted());
await page.waitForFunction(() => !window.__arkScene.attached || window.__arkScene.attached(), null, {timeout: 900_000}).catch(() => undefined);
await page.waitForFunction(() => Boolean(window.__arkSeatProbe), null, {timeout: 120_000});
const calm = (hour) =>
    page.evaluate((hour) => {
        window.__arkScene.setHours?.(hour);
        // (Still air: the trees stand where their meshes are, so a perch is measured against the branch as drawn.)
        window.__arkScene.setEnvironment?.({rain: 0, wetness: 0, fog: 0, storm: 0, snow: 0, cloud: 0.15, wind: 0});
    }, hour);
await calm(hours[0]);
await wait(6000);
console.log("mounted", JSON.stringify(await page.evaluate(() => ({island: window.__arkScene.island?.(), two: window.__arkScene.twoIslands?.(), entries: window.__arkDebug?.entries().length}))));

const REPTILE = /lizard|gecko|snake|python|\bboa\b|-boa|boa-|viper|cobra|monitor|komodo|iguana|chameleon|skink|tortoise|turtle|terrapin|crocodile|alligator|caiman|gharial|anole|agama|mamba|adder|rattlesnake|tegu|basilisk|slow-worm|tuatara|gila|bearded-dragon|water-dragon|racer|kingsnake|anaconda|taipan|krait|copperhead|cottonmouth|sidewinder|uromastyx|chuckwalla/;
const AMPHIBIAN = /frog|toad|newt|salamander|axolotl|caecilian|mudpuppy|hellbender|olm/;
const INSECT_PLANS = new Set(["flying_insect", "arthropod", "insect", "spider", "worm", "slow_invertebrate", "sessile", "crab", "snail", "mollusc"]);
const FISH_PLANS = new Set(["fish", "eel", "ray", "flatfish", "cephalopod", "jellyfish", "shark", "whale", "dolphin"]);
/** Insects (and the other small invertebrates), reptiles, birds, mammals; amphibians and fish apart. */
const categoryOf = (row) => {
    if (row.plan === "bird") return "birds";
    if (INSECT_PLANS.has(row.plan)) return "insects";
    if (REPTILE.test(row.slug)) return "reptiles";
    if (AMPHIBIAN.test(row.slug)) return "amphibians";
    if (FISH_PLANS.has(row.plan)) return "fish";
    return "mammals";
};

/** Wait until the animals drawn as models have stopped changing (their models in) and their seats have arrived. */
const settle = async () => {
    let last = "";
    let same = 0;
    for (let i = 0; i < 24; i++) {
        await wait(400);
        const now = await page.evaluate(() => {
            const rows = window.__arkSeatProbe.drawn(2);
            const entries = new Map(window.__arkDebug.entries().map((e) => [e.animal.id, e]));
            let moving = 0;
            for (const row of rows) {
                const s = entries.get(row.id)?.seat;
                if (!s || !["stand", "lie", "perch", "cling"].includes(row.kind)) continue;
                if (!s.solved || s.x !== s.tx || s.y !== s.ty || s.z !== s.tz) moving++;
            }
            return `${rows.length}|${rows.filter((r) => r.level !== "far").length}|${moving}|${window.__arkSeat.solids.stats().pending}`;
        });
        const [, , moving, pending] = now.split("|");
        if (now === last && (seatOff || (moving === "0" && pending === "0"))) {
            if (++same >= 2) return;
        } else same = 0;
        last = now;
    }
};

const rows = [];
const coverage = [];
for (const island of islands) {
    if ((await page.evaluate(() => window.__arkScene.island?.())) !== island) {
        await page.evaluate((island) => window.__arkScene.crossTo?.(island), island);
        await wait(8000);
    }
    for (const hour of hours) {
        await calm(hour);
        await wait(2500);
        // Every animal of this island with a place, in an order that keeps the camera's moves short (by 16 m cell).
        const all = await page.evaluate(() => window.__arkDebug.entries().filter((e) => !e.ghost && !e.visitor).map((e) => ({id: e.animal.id, slug: e.animal.model_slug, length: e.length})));
        const todo = new Map(all.map((a) => [a.id, a]));
        const seen = new Set();
        let stops = 0;
        let absent = 0;
        const started = Date.now();
        while (todo.size && (!maxStops || stops < maxStops)) {
            // The next one: the nearest to where the camera is now among those left.
            const next = await page.evaluate((ids) => {
                const t = window.__arkDebug.controls.target;
                let best = null;
                let least = Infinity;
                for (const id of ids) {
                    const at = window.__arkScene.locate(id);
                    if (!at) continue;
                    const d = (at.x - t.x) ** 2 + (at.z - t.z) ** 2;
                    if (d < least) {
                        least = d;
                        best = {id, at};
                    }
                }
                return best;
            }, Array.from(todo.keys()));
            if (!next) {
                absent += todo.size;
                break;
            }
            const target = todo.get(next.id);
            stops++;
            await page.evaluate(({at, distance, azimuth}) => {
                window.__arkDebug.controls.minDistance = 0.05;
                window.__arkScene.setView({target: {x: at.x, y: at.y, z: at.z}, distance, polar: 1.05, azimuth});
            }, {at: next.at, distance: Math.min(Math.max(3 + 8 * target.length, 3), 16), azimuth: (stops * 2.399) % (Math.PI * 2)});
            await settle();
            const measured = await page.evaluate(({skip, target}) => {
                const probe = window.__arkSeatProbe;
                const seen = new Set(skip);
                // (One drawn far is measured when its own turn brings the camera to it.)
                const drawn = probe.drawn(2).filter((row) => !seen.has(row.id) && (row.level !== "far" || row.id === target));
                probe.begin();
                const out = [];
                try {
                    for (const row of drawn) {
                        const m = probe.measure(row.id);
                        if (m) out.push({...row, ...m});
                    }
                } finally {
                    probe.end();
                }
                return out;
            }, {skip: Array.from(seen), target: next.id});
            for (const row of measured) {
                seen.add(row.id);
                todo.delete(row.id);
                rows.push({island, hour, ...row, category: categoryOf(row)});
            }
            if (todo.delete(next.id)) absent++;
            if (stops % 25 === 0) console.log(`${island} ${hour}h: stop ${stops}, ${seen.size} measured, ${todo.size} left, ${Math.round((Date.now() - started) / 1000)} s`);
        }
        coverage.push({island, hour, animals: all.length, measured: seen.size, notDrawn: absent, left: todo.size, stops, seconds: Math.round((Date.now() - started) / 1000)});
        console.log("done", JSON.stringify(coverage[coverage.length - 1]));
    }
}
const seatStats = await page.evaluate(() => ({...window.__arkSeat.solids.stats(), solves: window.__arkSeat.solves, ms: window.__arkSeat.ms}));
await browser.close();
server.close();

// MARK: The verdict

const SEATED = new Set(["stand", "lie", "perch", "cling"]);
const verdict = (row) => {
    if (!SEATED.has(row.kind)) return "exempt";
    if (row.middle || row.inside >= 2) return "inside";
    if (row.gap === null) return "nothing";
    if (row.gap > TOLERANCE) return "above";
    if (row.gap < -TOLERANCE) return "below";
    return "ok";
};
for (const row of rows) row.verdict = verdict(row);
const gated = rows.filter((row) => row.level !== "far");
const categories = ["insects", "reptiles", "birds", "mammals", "amphibians", "fish"];
const table = categories.map((category) => {
    const mine = gated.filter((row) => row.category === category);
    const count = (v) => mine.filter((row) => row.verdict === v).length;
    return {category, measured: mine.length, ok: count("ok"), above: count("above"), below: count("below"), inside: count("inside"), nothing: count("nothing"), exempt: count("exempt")};
});
const failures = gated.filter((row) => row.verdict === "above" || row.verdict === "below" || row.verdict === "inside" || row.verdict === "nothing");
const bySpecies = new Map();
for (const row of failures) {
    const key = `${row.slug}|${row.kind}|${row.verdict}`;
    const it = bySpecies.get(key) ?? {slug: row.slug, kind: row.kind, verdict: row.verdict, count: 0, worst: 0, on: new Set(), example: row};
    it.count++;
    if (Math.abs(row.gap ?? 0) >= Math.abs(it.worst)) {
        it.worst = row.gap ?? 0;
        it.example = row;
    }
    it.on.add(row.verdict === "inside" ? row.insideOf : row.on);
    bySpecies.set(key, it);
}
const exempt = {};
for (const row of gated) if (row.verdict === "exempt") exempt[`${row.category}:${row.kind}`] = (exempt[`${row.category}:${row.kind}`] ?? 0) + 1;
const summary = {label, seat: seatOff ? "off" : "on", tolerance: TOLERANCE, hours, islands, coverage, table, failures: failures.length, exempt, seatStats, errors: errors.slice(0, 10)};
writeFileSync(path.join(out, `${label}.json`), JSON.stringify({summary, rows}, null, 1));
const md = [
    `# Ark seat audit: ${label} (seat pass ${seatOff ? "off" : "on"})`,
    "",
    `Hours ${hours.join(", ")}; islands ${islands.join(", ")}; tolerance ±${TOLERANCE * 100} cm; near and rig levels.`,
    "",
    "| category | measured | seated ok | above > 3 cm | below > 3 cm | inside a solid | nothing under it | left alone (flying, swimming, …) |",
    "|---|---|---|---|---|---|---|---|",
    ...table.map((r) => `| ${r.category} | ${r.measured} | ${r.ok} | ${r.above} | ${r.below} | ${r.inside} | ${r.nothing} | ${r.exempt} |`),
    "",
    "## Coverage",
    "",
    "| island | hour | animals | measured | not drawn | left | stops | seconds |",
    "|---|---|---|---|---|---|---|---|",
    ...coverage.map((c) => `| ${c.island} | ${c.hour} | ${c.animals} | ${c.measured} | ${c.notDrawn} | ${c.left} | ${c.stops} | ${c.seconds} |`),
    "",
    `## Failures by species and state (${failures.length})`,
    "",
    "| species | state | verdict | count | worst gap (cm) | on |",
    "|---|---|---|---|---|---|",
    ...Array.from(bySpecies.values()).sort((a, b) => b.count - a.count).slice(0, 200).map((it) => `| ${it.slug} | ${it.kind} | ${it.verdict} | ${it.count} | ${(it.worst * 100).toFixed(1)} | ${Array.from(it.on).slice(0, 3).join(", ")} |`),
    "",
    "## Left alone, by category and state",
    "",
    ...Object.entries(exempt).sort().map(([k, v]) => `- ${k}: ${v}`),
    ""
].join("\n");
writeFileSync(path.join(out, `${label}.md`), md);
console.log(md.split("\n").slice(0, 14).join("\n"));
console.log(`failures: ${failures.length}; rows: ${rows.length}; wrote ${path.join(out, `${label}.json`)}`);
if (errors.length) console.log("page errors:", JSON.stringify(errors.slice(0, 6)));
if (has("gate") && (failures.length || !gated.length)) process.exit(1);
