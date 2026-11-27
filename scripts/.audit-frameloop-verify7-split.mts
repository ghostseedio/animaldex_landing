/**
 * PERF-WEB audit (verifier of FRAME-7): where the startup work FRAME-7 would move to a worker goes, headless, on the real
 * snapshot (v2 wild island, islands mode, the town at its world origin), as the scene builds it:
 *   1. the attach points (cold), then nestSpots over the wild island's nest plans (as the props' first homes build), and
 *      over the whole Ark's (wild + town birds: the homes build after the town joins, `setSnapshot(whole)`);
 *   2. the wild behaviour world: sceneSamplerTasks (per task) and navCellTasks (heights / walkable / clearance);
 *   3. the town's navCellTasks over its own sampler (heights / walkable / clearance).
 * Untracked helper; reads only.
 *   npx tsx scripts/.audit-frameloop-verify7-split.mts --snapshot <voyage.json>
 */
// @ts-nocheck
import {readFileSync} from "node:fs";
import {execSync} from "node:child_process";
import {createRequire} from "node:module";
const req = createRequire(import.meta.url);
const arg = (name: string, fallback: string) => {
    const at = process.argv.indexOf(`--${name}`);
    return at >= 0 && process.argv[at + 1] && !process.argv[at + 1].startsWith("--") ? process.argv[at + 1] : fallback;
};
const {setArkWorld} = req("@/ark-scene/world");
setArkWorld("v2");
const {setNoHamlet} = req("@/ark-scene/no-hamlet");
setNoHamlet(true);
const now = () => performance.now();
const {decodeArkSnapshot} = req("@/ark-scene/snapshot");
const {arkIslandSnapshot} = req("@/lib/ark-islands");
const {placeAnimals} = req("@/ark-scene/placement");
const {propsPresence} = req("@/ark-scene/props/presence");
const {nestRadius} = req("@/ark-scene/props/nest-kinds");
const {arkBody} = req("@/ark-scene/stats");
const {nestSpots} = req("@/ark-scene/props/nest-sites");
const sampler = req("@/ark-scene/sampler");
const {worldDecor, forestFill} = req("@/ark-scene/decor");
const {drawnRocks} = req("@/ark-scene/map/rocks");
const {floorObstacles} = req("@/ark-scene/floor-assets");
const {hamletPlotsFor} = req("@/ark-scene/map/hamlet");
const {sceneSamplerTasks, setBehaviourHomePlots} = req("@/ark-scene/world-sampler");
const {navCellTasks} = req("@/ark-scene/behaviour-nav");
const {isHumanAnimal} = req("@/ark-scene/humans/town-humans");
const {placeTownAnimals} = req("@/ark-scene/islands/town/placement");
const {townColliderSet} = req("@/ark-scene/islands/town/colliders");
const {townWorldSampler} = req("@/ark-scene/islands/town/sampler");
const {townWorldOrigin} = req("@/ark-scene/islands");

const load = () => execSync("uptime").toString().trim().replace(/.*load averages?: /, "load ");
const raw = JSON.parse(readFileSync(arg("snapshot", ""), "utf8"));
const whole0 = decodeArkSnapshot(raw.snapshot ?? raw);
const noHumans = (s) => ({...s, animals: s.animals.filter((a) => !isHumanAnimal(a))});
const whole = noHumans(whole0);
const wild = noHumans(arkIslandSnapshot(whole0, "wild"));
const town = noHumans(arkIslandSnapshot(whole0, "town"));
console.log(`${load()} | animals: whole ${whole.animals.length}, wild ${wild.animals.length}, town ${town.animals.length}`);

// The scene's order: the hamlet's plots for the wild residents (islands mode), then the places.
const plots = hamletPlotsFor(wild.animals);
sampler.setAttachHomePlots(plots);
setBehaviourHomePlots(plots);
console.log(`plots for the wild residents: ${plots.length}`);
// (Primed in the browser by the scenery worker: built here first, untimed.)
let t = now();
worldDecor();
forestFill();
drawnRocks();
floorObstacles();
console.log(`(untimed in the browser, primed: decor/fill/rocks/floor ${(now() - t).toFixed(0)} ms)`);
t = now();
const places = placeAnimals(wild.animals);
console.log(`(primed in the browser: wild places ${(now() - t).toFixed(0)} ms)`);
const origin = townWorldOrigin();
const placedTown = placeTownAnimals(town.animals);
const townPlaces = new Map();
placedTown.places.forEach((p, id) => townPlaces.set(id, {...p, x: p.x + origin.x, z: p.z + origin.z}));
const allPlaces = new Map([...places, ...townPlaces]);

// 1. The attach points, cold (the browser: prepareAttachPoints' slices), then the nests.
t = now();
const points = sampler.allAttachPoints();
const attachMs = now() - t;
console.log(`\n1. attach points: ${points.length} in ${attachMs.toFixed(0)} ms (cold)`);
const SAT_ON = new Set(["ground", "shore", "water_margin"]);
const plansOf = (snapshot) => propsPresence({animals: snapshot.animals, ark_day: snapshot.ark_day, nests: snapshot.nests}).nests.map((plan) => {
    const body = arkBody({model_slug: plan.slug}, "bird");
    const drawn = SAT_ON.has(plan.profile.site) ? body.display : Math.max(body.metres * 1.35, body.display * 0.3);
    return {plan, radius: nestRadius(plan.profile, drawn)};
});
const pct = (list, q) => {
    const s = [...list].sort((a, b) => a - b);
    return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : 0;
};
const runNests = (label, plans, placeOf) => {
    const used = new Set();
    const each = [];
    const bySite = new Map();
    let sites = 0;
    const t0 = now();
    for (const {plan, radius} of plans) {
        const s = now();
        const spots = nestSpots(plan, radius, placeOf, used);
        const ms = now() - s;
        each.push(ms);
        sites += spots.length;
        const key = plan.profile.site;
        const row = bySite.get(key) ?? {n: 0, ms: 0, max: 0};
        row.n++;
        row.ms += ms;
        row.max = Math.max(row.max, ms);
        bySite.set(key, row);
    }
    const total = now() - t0;
    console.log(`   ${label}: ${plans.length} plans, ${sites} sites, ${total.toFixed(0)} ms; per plan p50 ${pct(each, 0.5).toFixed(1)} p90 ${pct(each, 0.9).toFixed(1)} max ${Math.max(...each).toFixed(1)} ms; used ${used.size}`);
    for (const [site, row] of [...bySite].sort((a, b) => b[1].ms - a[1].ms)) console.log(`      ${site.padEnd(12)} ${String(row.n).padStart(4)} plans ${row.ms.toFixed(0).padStart(6)} ms (max ${row.max.toFixed(0)})`);
    return total;
};
const wildPlans = plansOf(wild);
const wholePlans = plansOf(whole);
const townSitters = wholePlans.filter(({plan}) => plan.sitter && townPlaces.has(plan.sitter)).length;
console.log(`   nest plans: wild ${wildPlans.length}, whole ${wholePlans.length} (town sitters ${townSitters}) [planOf: none, as before the models load]`);
runNests("wild, first build (cold ground memo)", wildPlans, (id) => places.get(id) ?? null);
runNests("whole, after the town joins (memo warm)", wholePlans, (id) => allPlaces.get(id) ?? null);
runNests("wild again (warm)", wildPlans, (id) => places.get(id) ?? null);

// 2. The wild behaviour world (sampler tasks, then the nav cells), each task timed.
const timeTasks = (tasks, names) => {
    const ms = tasks.map(() => 0);
    const wrapped = tasks.map((task, i) => () => {
        const s = now();
        const r = task();
        ms[i] += now() - s;
        return r;
    });
    for (let i = 0; i < wrapped.length; i++) while (!wrapped[i]()) {}
    return ms;
};
console.log(`\n2. wild behaviour world (${load()})`);
const job = sceneSamplerTasks();
const samplerMs = timeTasks(job.tasks);
t = now();
const wildSampler = job.finish();
const finishMs = now() - t;
console.log(`   sampler tasks ${samplerMs.reduce((a, b) => a + b, 0).toFixed(0)} ms over ${samplerMs.length} tasks (largest: ${samplerMs.map((v, i) => [i, v]).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([i, v]) => `#${i} ${v.toFixed(0)}`).join(", ")}); finish ${finishMs.toFixed(0)} ms`);
const nav = navCellTasks(wildSampler);
const navMs = timeTasks(nav.tasks);
console.log(`   nav cells (size ${nav.cells.size}, ${nav.cells.size ** 2} cells): heights ${navMs[0].toFixed(0)} ms, walkable ${navMs[1].toFixed(0)} ms, clearance ${(navMs[2] ?? 0).toFixed(0)} ms; total ${navMs.reduce((a, b) => a + b, 0).toFixed(0)} ms`);
const bytes = (c) => c.walk.byteLength + c.steep.byteLength + c.depth.byteLength + c.height.byteLength + (c.clear?.byteLength ?? 0);
console.log(`   cells' bytes ${(bytes(nav.cells) / 1e6).toFixed(2)} MB; version ${wildSampler.version.slice(0, 80)}...`);

// 3. The town's nav cells over its own sampler.
console.log(`\n3. town behaviour world (${load()})`);
t = now();
const set = townColliderSet(placedTown.open, origin);
const townSampler = townWorldSampler(placedTown.open, origin, set);
console.log(`   (town colliders + sampler ${(now() - t).toFixed(0)} ms: the town worker's raster + the main thread's built.sampler())`);
const townNav = navCellTasks(townSampler);
const townMs = timeTasks(townNav.tasks);
console.log(`   nav cells (size ${townNav.cells.size}, ${townNav.cells.size ** 2} cells): heights ${townMs[0].toFixed(0)} ms, walkable ${townMs[1].toFixed(0)} ms, clearance ${(townMs[2] ?? 0).toFixed(0)} ms; total ${townMs.reduce((a, b) => a + b, 0).toFixed(0)} ms; bytes ${(bytes(townNav.cells) / 1e6).toFixed(2)} MB`);
console.log(`\n${load()}`);
