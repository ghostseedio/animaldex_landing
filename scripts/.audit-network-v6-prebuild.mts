/**
 * Audit helper (lane PERF-WEB, verifier for NET-6): times one prebuild worker's job in a fresh Node process, as a fresh
 * worker would run it: module load, then the job. Run each job in its own process.
 *   ARK_WORLD=v2 npx tsx scripts/.audit-network-v6-prebuild.mts <voyage.json> scenery|places
 * Prints JSON: {job, loadMs, jobMs, totalMs}.
 */
import {readFileSync} from "node:fs";

const started = performance.now();
const file = process.argv[2];
const job = process.argv[3];
const raw = JSON.parse(readFileSync(file, "utf8")) as {snapshot?: unknown};
const {decodeArkSnapshot} = await import("@/ark-scene/snapshot");
const {arkIslandSnapshot, arkTwoIslands} = await import("@/lib/ark-islands");
const {arkWorld} = await import("@/ark-scene/world");
const snapshot = decodeArkSnapshot(raw.snapshot ?? raw);
if (!snapshot) throw new Error("no snapshot");
const two = arkTwoIslands(snapshot);
const wild = arkIslandSnapshot(snapshot, "wild");
const before = performance.now();
let loadMs = 0;
let jobMs = 0;
let size = 0;
if (job === "scenery") {
    const {computeScenery} = await import("@/ark-scene/runtime/prebuild-scenery");
    const {setNoHamlet} = await import("@/ark-scene/no-hamlet");
    loadMs = performance.now() - before;
    const t = performance.now();
    setNoHamlet(two);
    const result = computeScenery(56000, "high");
    jobMs = performance.now() - t;
    size = result.decor.length + result.fill.length;
} else if (job === "places") {
    const {placeAnimals} = await import("@/ark-scene/placement");
    const {zoneCapacities} = await import("@/ark-scene/map/capacity");
    const {setNoHamlet} = await import("@/ark-scene/no-hamlet");
    loadMs = performance.now() - before;
    const t = performance.now();
    setNoHamlet(two);
    const places = Array.from(placeAnimals(wild.animals).entries());
    const capacities = Array.from(zoneCapacities().entries());
    jobMs = performance.now() - t;
    size = places.length + capacities.length;
} else {
    throw new Error("job: scenery|places");
}
console.log(JSON.stringify({job, world: arkWorld(), two, wildAnimals: wild.animals.length, size, loadMs: Math.round(loadMs), jobMs: Math.round(jobMs), totalMs: Math.round(performance.now() - started)}));
