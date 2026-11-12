import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import test from "node:test";
import base from "@/ark-scene/fixtures/snapshot-v2.json";
import {withArkIslandsFixture} from "@/ark-scene/fixtures/islands";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import {arkIslandSnapshot} from "@/lib/ark-islands";
import {hashText, hashTextOn, hashTextPrefix, polylineDistance, polylineNearest, polylineWithin, type Poly, type Pt} from "@/ark-scene/islands/town/geom";
import {CANAL, CANAL_WIDTH, townPlan} from "@/ark-scene/islands/town/plan";

/**
 * The town's prebuild made fast (T3, after the islands release: the town's worker took 35-102 s on the dev page under
 * load): the same town, to the bit. The polyline searches skip by bounds and must answer exactly as the plain scan
 * did; FNV-1a's shared prefixes are hashed once and must hash the same; and the town's prebuild (plan, areas, ground,
 * scenery and buildings, zoo, places) on the fixture must digest as it did before the change.
 */

/** The plain scan `polylineNearest` was before (ark-next bcb5eca9): the definition the fast one must match to the bit. */
function plainNearest(line: Poly, x: number, z: number): {distance: number; along: number; dir: Pt; point: Pt} {
    let best = {distance: Infinity, along: 0, dir: {x: 1, z: 0}, point: {x: line[0].x, z: line[0].z}};
    let walked = 0;
    for (let i = 1; i < line.length; i++) {
        const a = line[i - 1];
        const b = line[i];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const length = Math.hypot(dx, dz);
        const t = length > 0 ? Math.min(Math.max(((x - a.x) * dx + (z - a.z) * dz) / (length * length), 0), 1) : 0;
        const px = a.x + dx * t;
        const pz = a.z + dz * t;
        const distance = Math.hypot(x - px, z - pz);
        if (distance < best.distance) best = {distance, along: walked + length * t, dir: {x: dx / (length || 1), z: dz / (length || 1)}, point: {x: px, z: pz}};
        walked += length;
    }
    return best;
}

/** The town's lines: the canal and every street, path and track. */
function townLines(): Array<{id: string; line: Poly; limits: number[]}> {
    const plan = townPlan();
    return [
        {id: "canal", line: CANAL, limits: [CANAL_WIDTH / 2 + 0.55, CANAL_WIDTH / 2 + 0.6, CANAL_WIDTH / 2 + 6, CANAL_WIDTH / 2]},
        ...plan.streets.map((s) => ({id: s.id, line: s.line, limits: [s.width / 2 + s.pavement + 0.4, s.width / 2 + s.pavement + 3, s.width / 2 + s.pavement]}))
    ];
}

/** Points to ask about: a grid over the town, each vertex and middle, and points just off them. */
function pointsNear(line: Poly): Pt[] {
    const out: Pt[] = [];
    for (let i = 0; i < line.length; i++) {
        const p = line[i];
        out.push({x: p.x, z: p.z});
        for (const d of [1e-9, 0.01, 0.37, 1.9, 4.6, 11]) out.push({x: p.x + d, z: p.z - d * 0.7}, {x: p.x - d * 0.4, z: p.z + d});
        if (i > 0) {
            const q = line[i - 1];
            out.push({x: (p.x + q.x) / 2, z: (p.z + q.z) / 2}, {x: (p.x + q.x) / 2 + 0.8, z: (p.z + q.z) / 2 - 2.2});
        }
    }
    return out;
}

const GRID: Pt[] = [];
for (let x = -230; x <= 230; x += 3.7) for (let z = -230; z <= 230; z += 3.7) GRID.push({x, z});

test("the fast polyline searches answer exactly as the plain scan, on every town line", () => {
    let asked = 0;
    const misses: string[] = [];
    for (const {id, line, limits} of townLines()) {
        for (const p of [...GRID, ...pointsNear(line)]) {
            const plain = plainNearest(line, p.x, p.z);
            const fast = polylineNearest(line, p.x, p.z);
            asked++;
            if (!Object.is(fast.distance, plain.distance) || !Object.is(fast.along, plain.along) || !Object.is(fast.dir.x, plain.dir.x) || !Object.is(fast.dir.z, plain.dir.z) || !Object.is(fast.point.x, plain.point.x) || !Object.is(fast.point.z, plain.point.z)) misses.push(`${id} nearest at ${p.x},${p.z}`);
            if (!Object.is(polylineDistance(line, p.x, p.z), plain.distance)) misses.push(`${id} distance at ${p.x},${p.z}`);
            // The limits the town asks with, and the answer's own distance (and either side of it): the edge itself.
            const edge = plain.distance;
            for (const limit of [...limits, edge, edge + 1e-12, edge - 1e-12, edge * (1 + Number.EPSILON), 0, -1]) {
                if (polylineWithin(line, p.x, p.z, limit) !== plain.distance < limit) misses.push(`${id} within ${limit} at ${p.x},${p.z}`);
            }
        }
        if (misses.length > 20) break;
    }
    assert.deepEqual(misses.slice(0, 20), [], `${misses.length} of ${asked} points answered differently`);
    assert.ok(asked > 300_000, `asked at ${asked} points`);
});

test("the fast polyline searches on odd lines: one point, repeated points, zero-length segments, NaN", () => {
    const lines: Poly[] = [
        [{x: 3, z: 4}],
        [{x: 0, z: 0}, {x: 0, z: 0}],
        [{x: 0, z: 0}, {x: 0, z: 0}, {x: 5, z: 0}, {x: 5, z: 0}, {x: 5, z: 5}],
        [{x: -2, z: 1}, {x: 2, z: 1}, {x: -2, z: 1}, {x: 2, z: 1}],
        [{x: 0, z: 0}, {x: NaN, z: 1}, {x: 4, z: 4}],
        [{x: 1e6, z: -1e6}, {x: 1e6 + 1e-7, z: -1e6}]
    ];
    const points: Pt[] = [{x: 0, z: 0}, {x: 3, z: 4}, {x: 2.5, z: 0}, {x: -7, z: 9}, {x: NaN, z: 0}, {x: 1e6, z: -1e6}, {x: 0, z: 1}];
    for (const line of lines) {
        for (const p of points) {
            const plain = plainNearest(line, p.x, p.z);
            assert.deepStrictEqual(polylineNearest(line, p.x, p.z), plain, `nearest on ${JSON.stringify(line)} at ${p.x},${p.z}`);
            assert.ok(Object.is(polylineDistance(line, p.x, p.z), plain.distance), `distance on ${JSON.stringify(line)} at ${p.x},${p.z}`);
            for (const limit of [0, 0.5, 3, 1e9, Infinity, NaN, -2]) assert.equal(polylineWithin(line, p.x, p.z, limit), plain.distance < limit, `within ${limit} on ${JSON.stringify(line)} at ${p.x},${p.z}`);
        }
    }
    assert.throws(() => polylineNearest([], 0, 0), "an empty line throws, as before");
});

test("a shared prefix hashed once hashes exactly as the whole text", () => {
    const words = ["", "a", "fox", "e7c1a2b4-0000-4f00-8000-00000000abcd", "house-12#3", "zoo|penguin_pool-2", "Ünïcödé✓", "x".repeat(300)];
    for (const prefix of words) {
        const state = hashTextPrefix(prefix);
        for (const rest of words) assert.equal(hashTextOn(state, rest), hashText(prefix + rest), `${prefix} + ${rest}`);
    }
});

/** A digest of a value, typed arrays by their bytes and numbers by their bits. */
function digest(value: unknown): string {
    const hash = createHash("sha256");
    const walk = (v: unknown): void => {
        if (ArrayBuffer.isView(v)) {
            hash.update(`<${v.constructor.name}:`);
            hash.update(new Uint8Array(v.buffer, v.byteOffset, v.byteLength));
            hash.update(">");
        } else if (v instanceof Map) {
            hash.update("M{");
            v.forEach((x, k) => {
                walk(k);
                walk(x);
            });
            hash.update("}");
        } else if (Array.isArray(v)) {
            hash.update(`[${v.length}:`);
            for (const x of v) walk(x);
            hash.update("]");
        } else if (v && typeof v === "object") {
            hash.update("{");
            for (const k of Object.keys(v)) {
                hash.update(k + ":");
                walk((v as Record<string, unknown>)[k]);
            }
            hash.update("}");
        } else if (typeof v === "number") {
            hash.update(new Uint8Array(new Float64Array([v]).buffer));
        } else hash.update(`${typeof v}:${String(v)};`);
    };
    walk(value);
    return hash.digest("hex").slice(0, 16);
}

/**
 * The town's prebuild on the fixture, digested before the speed work (ark-next bcb5eca9, the plain scans): the same
 * town after it. When the town is changed on purpose (the town lane), these are updated with the change.
 * Lane GA (town-ground): the ground's texture weights and no per-vertex shade, the street surfaces and furniture, the
 * drapes' tags (the plan, areas and places are unchanged: nothing moved).
 */
const TOWN_DIGESTS = {
    plan: "ad0b6e3a149e2362",
    areas: "7a26937a126da351",
    // (Merged on ark-next: GA's newer ground and street surfaces with TB's zoo houses, displays and places.)
    ground: "9f6d9fa1b00ec782",
    // (Lane GA's street surfaces; lane TB: the zoo houses drawn with the zoo's day, `render/zoo-houses.ts`; the pets
    // kept at home in their displays, the aquarium's in its tanks, the ground animals clear of buildings.)
    sceneryAndBuildings: "f1d58d27bdb4abdf",
    zoo: "f38cd89b62c1d0ec",
    places: "fb1159793f083105"
};

test("the town's prebuild on the fixture: the same plan, areas, ground, scenery, buildings, zoo and places as before", async () => {
    const {townAreas} = await import("@/ark-scene/islands/town/areas");
    const {townBuildData} = await import("@/ark-scene/islands/town/render/index");
    const {placeTownAnimals} = await import("@/ark-scene/islands/town/placement");
    const {enclosuresIn, launchEnclosures} = await import("@/ark-scene/islands/town/areas");
    const snapshot = decodeArkSnapshot(withArkIslandsFixture(base))!;
    const animals = arkIslandSnapshot(snapshot, "town").animals;
    const found = enclosuresIn(animals);
    const open = found.length ? found : launchEnclosures();
    const built = townBuildData(open);
    const placed = placeTownAnimals(animals);
    const got = {
        plan: digest(townPlan()),
        areas: digest(townAreas()),
        ground: digest(built.grid),
        sceneryAndBuildings: digest([built.scenery, built.perChunk]),
        zoo: digest(built.zoo),
        places: digest([Array.from(placed.places.entries()), Array.from(placed.town.entries()), placed.open])
    };
    assert.ok(animals.length > 0, "the fixture has town animals");
    assert.deepEqual(got, TOWN_DIGESTS);
});
