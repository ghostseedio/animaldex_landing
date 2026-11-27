/**
 * PERF-WEB audit (area: geometric queries): every nest plan of the real snapshot's wild island through props/nest-sites.ts
 * nestSpots and through the reordered copy (.audit-geom-nest-sites.mts), the sites compared by their exact bits, each
 * timed (best of 3 alternating passes, after one untimed pass of each). Untracked helper.
 *   npx tsx scripts/.audit-geom-nests.mts --snapshot <voyage.json>
 */
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
const {decodeArkSnapshot} = req("@/ark-scene/snapshot");
const {arkIslandSnapshot} = req("@/lib/ark-islands");
const {placeAnimals} = req("@/ark-scene/placement");
const {propsPresence} = req("@/ark-scene/props/presence");
const {nestRadius} = req("@/ark-scene/props/nest-kinds");
const {arkBody} = req("@/ark-scene/stats");
const original = req("@/ark-scene/props/nest-sites");
const sampler = req("@/ark-scene/sampler");
const world = req("@/ark-scene/world");
const copy = await import("./.audit-geom-nest-sites.mts");

const raw = JSON.parse(readFileSync(arg("snapshot", ""), "utf8"));
const snapshot = decodeArkSnapshot(raw.snapshot ?? raw);
const wild = arkIslandSnapshot(snapshot, "wild");
const places = placeAnimals(wild.animals);
const presence = propsPresence({animals: wild.animals, ark_day: snapshot.ark_day, nests: snapshot.nests});
const SAT_ON = new Set(["ground", "shore", "water_margin"]);
const plans = presence.nests.map((plan: any) => {
    const body = arkBody({model_slug: plan.slug}, "bird");
    const drawn = SAT_ON.has(plan.profile.site) ? body.display : Math.max(body.metres * 1.35, body.display * 0.3);
    return {plan, radius: nestRadius(plan.profile, drawn)};
});
const placeOf = (id: string) => places.get(id) ?? null;
console.log(`load: ${execSync("uptime").toString().trim()}`);
const bySite = new Map<string, number>();
for (const {plan} of plans) bySite.set(plan.profile.site, (bySite.get(plan.profile.site) ?? 0) + 1);
console.log(`wild animals ${wild.animals.length}, nest plans ${plans.length}: ${[...bySite].map(([k, v]) => `${k} ${v}`).join(", ")}`);

const exact = (v: unknown): string => JSON.stringify(v, (_k, x) => (typeof x === "number" ? (Object.is(x, -0) ? "-0" : `n${x}`) : x));
const runAll = (fn: typeof original.nestSpots) => {
    const used = new Set<string>();
    return plans.map(({plan, radius}: any) => fn(plan, radius, placeOf, used));
};
// (Counting the ground samples each makes: sampleGround is the module's export, read by both through the module.)
const t0 = performance.now();
const a0 = runAll(original.nestSpots);
const firstMs = performance.now() - t0;
const t1 = performance.now();
const b0 = runAll(copy.nestSpots);
const firstCopyMs = performance.now() - t1;
const same = exact(a0) === exact(b0);
let sites = 0;
for (const list of a0) sites += list.length;
console.log(`first pass (cold: attach points, decor, caches): original ${firstMs.toFixed(0)} ms, reordered ${firstCopyMs.toFixed(0)} ms; ${sites} sites; identical: ${same}`);
const time = (fn: typeof original.nestSpots) => {
    const t = performance.now();
    runAll(fn);
    return performance.now() - t;
};
let bestA = Infinity, bestB = Infinity;
for (let pass = 0; pass < 3; pass++) {
    bestA = Math.min(bestA, time(original.nestSpots));
    bestB = Math.min(bestB, time(copy.nestSpots));
}
console.log(`warm: original ${bestA.toFixed(0)} ms, reordered ${bestB.toFixed(0)} ms (${(bestA / bestB).toFixed(2)}x)`);
// Per site kind, warm.
for (const site of bySite.keys()) {
    const subset = plans.filter((p: any) => p.plan.profile.site === site);
    const run = (fn: typeof original.nestSpots) => {
        const used = new Set<string>();
        const t = performance.now();
        for (const {plan, radius} of subset) fn(plan, radius, placeOf, used);
        return performance.now() - t;
    };
    let a = Infinity, b = Infinity;
    for (let pass = 0; pass < 2; pass++) {
        a = Math.min(a, run(original.nestSpots));
        b = Math.min(b, run(copy.nestSpots));
    }
    console.log(`  ${site.padEnd(12)} ${subset.length} plans: original ${a.toFixed(1)} ms, reordered ${b.toFixed(1)} ms`);
}
void sampler;
void world;
