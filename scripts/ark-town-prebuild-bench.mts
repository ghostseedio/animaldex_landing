// The town's prebuild worker, step by step, in Node (one fresh process per run: the town's module memos start empty).
// Development only: ARK_SNAPSHOT (a local read) and ARK_ROUTING (T1's routing) are read in place, never copied.
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {performance} from "node:perf_hooks";
import {mergeArkIslandsRouting} from "@/lib/ark-islands-local";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import {arkIslandSnapshot} from "@/lib/ark-islands";
import {enclosuresIn, launchEnclosures, townAreas} from "@/ark-scene/islands/town/areas";
import {townWorldOrigin} from "@/ark-scene/islands";
import {townPlan} from "@/ark-scene/islands/town/plan";
import {groundGrid} from "@/ark-scene/islands/town/render/index";
import {buildScenery, buildZooScenery} from "@/ark-scene/islands/town/render/scenery";
import {buildBuilding} from "@/ark-scene/islands/town/render/buildings";
import {Geo} from "@/ark-scene/islands/town/render/kit";
import {townChunkOf} from "@/ark-scene/islands/town/chunks";
import {zooLayout} from "@/ark-scene/islands/town/areas";
import {placeTownAnimals} from "@/ark-scene/islands/town/placement";
import {townSamplerData} from "@/ark-scene/islands/town/sampler";
import {townColliderList} from "@/ark-scene/islands/town/colliders";
import {packTownBuild} from "@/ark-scene/islands/town/prebuild";

const body = JSON.parse(readFileSync(process.env.ARK_SNAPSHOT!, "utf8"));
const routing = JSON.parse(readFileSync(process.env.ARK_ROUTING!, "utf8"));
const merged = mergeArkIslandsRouting(body, routing).merged as {snapshot?: unknown};
const snapshot = decodeArkSnapshot(merged && merged.snapshot ? merged.snapshot : merged);
const animals = arkIslandSnapshot(snapshot, "town").animals;
const found = enclosuresIn(animals);
const open = found.length ? found : launchEnclosures();
const origin = townWorldOrigin();
const ms: Record<string, number> = {};
const time = <T>(name: string, f: () => T): T => {
    const t = performance.now();
    const out = f();
    ms[name] = Math.round(performance.now() - t);
    return out;
};
const all = performance.now();
const plan = time("plan", () => townPlan());
const areas = time("areas", () => townAreas());
const grid = time("groundGrid", () => groundGrid());
const scenery = time("scenery", () => buildScenery(plan));
const perChunk = time("buildings", () => {
    const out = new Map<number, {solid: Geo; glass: Geo; windows: unknown[]}>();
    for (const b of plan.buildings) {
        const key = townChunkOf(b.at.x, b.at.z);
        let c = out.get(key);
        if (!c) {
            const sc = scenery.chunks.get(key);
            c = {solid: sc?.solid ?? new Geo(), glass: sc?.glass ?? new Geo(), windows: []};
            out.set(key, c);
        }
        buildBuilding(c as never, b);
    }
    return out;
});
const zoo = time("zoo", () => buildZooScenery(zooLayout(open, plan)));
const placed = time("places", () => placeTownAnimals(animals));
const sampler = time("behaviourRaster", () => townSamplerData(placed.open, origin));
const colliders = time("colliders", () => townColliderList(placed.open, origin));
const built = {grid, scenery, perChunk, zoo, zooOpen: [...open]};
const transfer = time("pack", () => packTownBuild(built as never));
transfer.push(sampler.solid.buffer as ArrayBuffer);
// (ARK_DIGEST=1: a digest of each part, typed arrays by their bytes: the same town before and after a change.)
const digest = (value: unknown): string => {
    const hash = createHash("sha256");
    const walk = (v: unknown): void => {
        if (ArrayBuffer.isView(v)) {
            hash.update(`<${v.constructor.name}:`);
            hash.update(new Uint8Array(v.buffer, v.byteOffset, v.byteLength));
            hash.update(">");
        } else if (v instanceof Map) {
            hash.update("M{");
            for (const [k, x] of v) {
                walk(k);
                walk(x);
            }
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
            const f = new Float64Array([v]);
            hash.update(new Uint8Array(f.buffer));
        } else hash.update(`${typeof v}:${String(v)};`);
    };
    walk(value);
    return hash.digest("hex").slice(0, 16);
};
const digests = process.env.ARK_DIGEST === "1" ? {plan: digest(plan), areas: digest(areas), grid: digest(grid), scenery: digest(scenery), buildings: digest(perChunk), zoo: digest(zoo), places: digest([Array.from(placed.places.entries()), Array.from(placed.town.entries()), placed.open]), sampler: digest(sampler), colliders: digest(colliders)} : null;
const answer = {plan, areas, built, placed: {places: Array.from(placed.places.entries()), town: Array.from(placed.town.entries()), open: placed.open}, sampler, colliders};
time("clone", () => structuredClone(answer, {transfer}));
ms.total = Math.round(performance.now() - all);
console.log(JSON.stringify({animals: animals.length, open: open.length, ms, ...(digests ? {digests} : {})}));
