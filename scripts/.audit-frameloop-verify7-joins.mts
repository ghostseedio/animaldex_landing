/**
 * PERF-WEB audit (verifier of FRAME-7): the props' homes builds of one visit, as the scene asks for them, headless on the
 * real snapshot (v2, islands mode): the first build for the wild island's read (props module built with
 * `withoutHumans(options.snapshot)`), then one per town join batch (`attachIsland` join: 450 town animals at a time,
 * `setSnapshot(...)` -> modules' setSnapshot -> props rebuildHomes, a new build whenever the homes key changes). Each
 * build's nestSpots work is timed on its own (its own `used` set, the shared ground memo, as in the page). Also where the
 * town sitters' nests land. Untracked helper; reads only.
 *   npx tsx scripts/.audit-frameloop-verify7-joins.mts --snapshot <voyage.json>
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
const {propsPresence, presenceKey} = req("@/ark-scene/props/presence");
const {nestRadius} = req("@/ark-scene/props/nest-kinds");
const {arkBody} = req("@/ark-scene/stats");
const {nestSpots} = req("@/ark-scene/props/nest-sites");
const sampler = req("@/ark-scene/sampler");
const {hamletPlotsFor} = req("@/ark-scene/map/hamlet");
const {isHumanAnimal} = req("@/ark-scene/humans/town-humans");
const {placeTownAnimals} = req("@/ark-scene/islands/town/placement");
const {townWorldOrigin} = req("@/ark-scene/islands");
const {TERRAIN_HALF} = req("@/ark-scene/world");

const load = () => execSync("uptime").toString().trim().replace(/.*load averages?: /, "load ");
const raw = JSON.parse(readFileSync(arg("snapshot", ""), "utf8"));
const whole0 = decodeArkSnapshot(raw.snapshot ?? raw);
const noHumans = (s) => ({...s, animals: s.animals.filter((a) => !isHumanAnimal(a))});
const whole = noHumans(whole0);
const wild = noHumans(arkIslandSnapshot(whole0, "wild"));
const townIds = new Set(arkIslandSnapshot(whole0, "town").animals.map((a) => a.id));
const plots = hamletPlotsFor(wild.animals);
sampler.setAttachHomePlots(plots);
const places = placeAnimals(wild.animals);
const origin = townWorldOrigin();
const fullTown = placeTownAnimals(whole.animals.filter((a) => townIds.has(a.id)));
console.log(`${load()} | wild ${wild.animals.length}, town ${whole.animals.filter((a) => townIds.has(a.id)).length}, origin ${origin.x},${origin.z}, wild half ${TERRAIN_HALF}`);
sampler.allAttachPoints();

const SAT_ON = new Set(["ground", "shore", "water_margin"]);
const buildOf = (snapshot, placeOf) => {
    const presence = propsPresence({animals: snapshot.animals, ark_day: snapshot.ark_day, nests: snapshot.nests});
    // (props/index.ts rebuildHomes' key: the presence and the sitters' and group members' places.)
    const placed = [...presence.nests.map((nest) => nest.sitter), ...Array.from(presence.groups.values()).flat().map((animal) => animal.id)]
        .map((id) => (id ? placeOf(id) : null))
        .map((at) => (at ? `${at.x.toFixed(2)},${at.z.toFixed(2)}` : "-"))
        .join(";");
    const key = `${presenceKey(presence)}|${placed}`;
    const plans = presence.nests.map((plan) => {
        const body = arkBody({model_slug: plan.slug}, "bird");
        const drawn = SAT_ON.has(plan.profile.site) ? body.display : Math.max(body.metres * 1.35, body.display * 0.3);
        return {plan, radius: nestRadius(plan.profile, drawn)};
    });
    return {key, plans};
};
const runBuild = (plans, placeOf) => {
    const used = new Set();
    const t0 = now();
    const all = plans.map(({plan, radius}) => ({plan, spots: nestSpots(plan, radius, placeOf, used)}));
    return {ms: now() - t0, all};
};

// The visit's builds: the wild read, then each join batch (index.ts attachIsland `join`).
const builds = [];
builds.push({label: "wild read", snapshot: wild, placeOf: (id) => places.get(id) ?? null});
const townAnimals = whole.animals.filter((a) => townIds.has(a.id));
const wildAnimals = whole.animals.filter((a) => !townIds.has(a.id));
for (let joined = 0; joined < townAnimals.length; ) {
    joined = Math.min(joined + 450, townAnimals.length);
    const done = joined >= townAnimals.length;
    const animals = done ? whole.animals : [...wildAnimals, ...townAnimals.slice(0, joined)].sort((a, b) => a.arrived_at.localeCompare(b.arrived_at));
    const town = animals.filter((a) => townIds.has(a.id));
    // (islands/scene.ts place: the town's plan of the animals joined so far, in the world frame; the zoo's enclosures as opened.)
    const placedTown = placeTownAnimals(town, fullTown.open);
    const map = new Map(places);
    placedTown.places.forEach((p, id) => map.set(id, {...p, x: p.x + origin.x, z: p.z + origin.z}));
    builds.push({label: `join ${joined}${done ? " (whole)" : ""}`, snapshot: {...whole, animals}, placeOf: (id) => map.get(id) ?? null});
}
let lastKey = "";
let total = 0;
let finalMs = 0;
let finalAll = null;
let finalPlaceOf = null;
for (const b of builds) {
    const {key, plans} = buildOf(b.snapshot, b.placeOf);
    const rebuilt = key !== lastKey;
    lastKey = key;
    if (!rebuilt) {
        console.log(`  ${b.label.padEnd(18)} same homes key: no rebuild`);
        continue;
    }
    const {ms, all} = runBuild(plans, b.placeOf);
    total += ms;
    finalMs = ms;
    finalAll = all;
    finalPlaceOf = b.placeOf;
    console.log(`  ${b.label.padEnd(18)} ${String(plans.length).padStart(4)} plans, nestSpots ${ms.toFixed(0).padStart(6)} ms`);
}
console.log(`builds' nestSpots total ${total.toFixed(0)} ms; the last build alone ${finalMs.toFixed(0)} ms (${load()})`);

// Where the town sitters' nests land (the last build).
let townPlans = 0, townSpots = 0, onWild = 0, nearSitter = 0, none = 0;
const bySite = new Map();
for (const {plan, spots} of finalAll) {
    if (!plan.sitter || !townIds.has(plan.sitter)) continue;
    townPlans++;
    if (!spots.length) none++;
    const sitter = finalPlaceOf(plan.sitter);
    for (const spot of spots) {
        townSpots++;
        if (Math.abs(spot.x) <= TERRAIN_HALF && Math.abs(spot.z) <= TERRAIN_HALF) onWild++;
        if (sitter && Math.hypot(spot.x - sitter.x, spot.z - sitter.z) < 30) nearSitter++;
        const row = bySite.get(plan.profile.site) ?? {spots: 0, onWild: 0};
        row.spots++;
        if (Math.abs(spot.x) <= TERRAIN_HALF && Math.abs(spot.z) <= TERRAIN_HALF) row.onWild++;
        bySite.set(plan.profile.site, row);
    }
}
console.log(`town sitters' plans ${townPlans}: ${townSpots} nest spots, ${onWild} of them inside the wild island's square, ${nearSitter} within 30 m of their sitter; ${none} plans with no spot`);
for (const [site, row] of bySite) console.log(`   ${site.padEnd(12)} ${row.spots} spots, ${row.onWild} on the wild island`);
