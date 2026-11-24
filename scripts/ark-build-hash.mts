/**
 * A bit-exact hash of what the world build makes: the wild island's ground (sampled on its own and through `world.ts`),
 * its terrain cache, world and zone sites, every rock shape, the landscape; the town's plan, areas, ground grid,
 * scenery and buildings, zoo, zoo houses, solids and the animals' places (the town fixture). For a change that must not
 * change the output (load-alloc: the build's allocation cut): run it before and after on the same machine and diff.
 * The floats are hashed by their exact bits (no rounding: `ark-town-prebuild-speed.test.ts`'s digest rounds, for CI
 * across machines; this is for one machine).
 *
 *   npx tsx scripts/ark-build-hash.mts > before.txt   (then after the change: > after.txt; diff before.txt after.txt)
 */
import {createHash} from "node:crypto";

const seen = new WeakSet<object>();
function hashOf(value: unknown): string {
    const hash = createHash("sha256");
    const f64 = new Float64Array(1);
    const walk = (v: unknown, depth: number): void => {
        if (depth > 12) return void hash.update("…");
        if (typeof v === "number") {
            f64[0] = v;
            hash.update(new Uint8Array(f64.buffer));
        } else if (typeof v === "function") hash.update("fn;");
        else if (v === null || typeof v !== "object") hash.update(`${typeof v}:${String(v)};`);
        else if (ArrayBuffer.isView(v)) {
            hash.update(`<${v.constructor.name}:`);
            hash.update(new Uint8Array(v.buffer, v.byteOffset, v.byteLength));
            hash.update(">");
        } else {
            if (seen.has(v)) return void hash.update("@");
            seen.add(v);
            if (v instanceof Map) {
                hash.update("M{");
                v.forEach((x, k) => {
                    walk(k, depth + 1);
                    walk(x, depth + 1);
                });
                hash.update("}");
            } else if (v instanceof Set) {
                hash.update("S{");
                v.forEach((x) => walk(x, depth + 1));
                hash.update("}");
            } else if (Array.isArray(v)) {
                hash.update(`[${v.length}:`);
                for (const x of v) walk(x, depth + 1);
                hash.update("]");
            } else {
                hash.update("{");
                for (const k of Object.keys(v)) {
                    if (k === "uuid" || k === "id" && typeof (v as Record<string, unknown>)[k] === "number") continue;
                    hash.update(k + ":");
                    walk((v as Record<string, unknown>)[k], depth + 1);
                }
                hash.update("}");
            }
        }
    };
    walk(value, 0);
    return hash.digest("hex").slice(0, 20);
}

const out: Record<string, string> = {};
const time = async (name: string, f: () => unknown | Promise<unknown>) => {
    const t = performance.now();
    out[name] = hashOf(await f());
    console.error(`${name} ${Math.round(performance.now() - t)} ms`);
};

const {setArkWorld} = await import("@/ark-scene/world");
setArkWorld("v2");
const {sampleWildGround} = await import("@/ark-scene/islands/wild/ground");
const {gridHeight, gridSlope} = await import("@/ark-scene/islands/wild/terrain-cache");
const {wildWorldV2} = await import("@/ark-scene/islands/wild/world-v2");
const {wildZoneSites} = await import("@/ark-scene/islands/wild/zone-sites");
const {sampleGround} = await import("@/ark-scene/world");
const {rockMesh, ROCK_VARIANTS} = await import("@/ark-scene/rock-shapes");

await time("wild.sample", () => {
    const rows: unknown[] = [];
    for (let x = -264; x <= 264; x += 1.37) for (let z = -264; z <= 264; z += 1.37) rows.push(sampleWildGround(x, z));
    return rows;
});
await time("wild.grid", () => {
    const rows: number[] = [];
    for (let x = -260; x <= 260; x += 0.93) for (let z = -260; z <= 260; z += 3.1) rows.push(gridHeight(x, z), gridSlope(x, z));
    return rows;
});
await time("wild.world", () => wildWorldV2());
await time("wild.sites", () => wildZoneSites());
await time("world.sampleGround", () => {
    const rows: unknown[] = [];
    for (let x = -264; x <= 264; x += 2.9) for (let z = -264; z <= 264; z += 2.9) rows.push(sampleGround(x, z));
    return rows;
});
await time("rocks", () => {
    const rows: unknown[] = [];
    for (const style of Object.keys(ROCK_VARIANTS) as Array<keyof typeof ROCK_VARIANTS>) for (let v = 0; v < ROCK_VARIANTS[style]; v++) for (const d of [0, 1, 2, 3]) for (const worn of [false, true]) rows.push(rockMesh(style, v, d, worn));
    return rows;
});
await time("landscape", async () => {
    const {buildLandscape} = await import("@/ark-scene/terrain");
    return buildLandscape();
});
await time("town", async () => {
    const base = (await import("@/ark-scene/fixtures/snapshot-v2.json")).default;
    const {withArkIslandsFixture} = await import("@/ark-scene/fixtures/islands");
    const {decodeArkSnapshot} = await import("@/ark-scene/snapshot");
    const {arkIslandSnapshot} = await import("@/lib/ark-islands");
    const {townPlan} = await import("@/ark-scene/islands/town/plan");
    const {townAreas, enclosuresIn, launchEnclosures} = await import("@/ark-scene/islands/town/areas");
    const {townBuildData} = await import("@/ark-scene/islands/town/render/index");
    const {placeTownAnimals} = await import("@/ark-scene/islands/town/placement");
    const snapshot = decodeArkSnapshot(withArkIslandsFixture(base))!;
    const animals = arkIslandSnapshot(snapshot, "town").animals;
    const found = enclosuresIn(animals);
    const open = found.length ? found : launchEnclosures();
    const built = townBuildData(open);
    const placed = placeTownAnimals(animals);
    out["town.plan"] = hashOf(townPlan());
    out["town.areas"] = hashOf(townAreas());
    out["town.grid"] = hashOf(built.grid);
    out["town.scenery"] = hashOf([built.scenery, built.perChunk]);
    out["town.zoo"] = hashOf(built.zoo);
    const {zooLayout} = await import("@/ark-scene/islands/town/areas");
    const {buildZooHouses} = await import("@/ark-scene/islands/town/render/zoo-houses");
    const {townSolids} = await import("@/ark-scene/islands/town/solids");
    const houses = buildZooHouses(zooLayout(open).enclosures);
    out["town.houses"] = hashOf(houses);
    out["town.solids"] = hashOf(townSolids(open));
    return [Array.from(placed.places.entries()), Array.from(placed.town.entries()), placed.open];
});
for (const [k, v] of Object.entries(out)) console.log(`${k} ${v}`);
