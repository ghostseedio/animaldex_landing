/**
 * The town's vehicles (lane GB, docs/ark/town-island.md §4): parked cars and bicycles, and a few cars moving slowly
 * round the town's roads. People are implied, never shown: no drivers, no riders.
 *
 * - **Models**: Quaternius's CC0 cars and bicycle (docs/ark-credits.md), made by `scripts/ark-town-vehicles.mts` into
 *   `public/ark/assets/town-v1/vehicles.bin`: six cars (saloon, hatchback, city car, SUV, coupe, estate) and a bicycle,
 *   true size, two levels each, read once (`loadVehicles`). Beyond the middle distance every car is a proxy made here
 *   from its model's own box and glass line; until the file is in (or if it fails), every car is its proxy.
 * - **Parked** (`townParking`): every house's drive, kerb bays 6 m apart along the streets (one side, both on streets no
 *   car drives down; never within a junction's mouth, by a drive's dropped kerb, on a crossing or a bridge), the farms'
 *   yards and the harbour's car park. Who is parked is `people.ts` `carAt` (drives full at night, a third in working
 *   hours; kerbs busier in the evening); the model and colour by the spot and the day (kerbs) or the month (drives).
 * - **Moving** (`townTraffic`, `TrafficSim`): a few cars on three loops of the plan's road graph, driving on the left,
 *   slowly (17-23 km/h, slower round corners), giving way at junctions and stopping at the zebra crossings
 *   (`TOWN_CROSSINGS`), on the shared clock. Each car keeps to its loop's timetable; it stops short of anything in its
 *   way (an animal, through the scene's `setAnimals` query of the animals' shared poses with L5's bodies; another car)
 *   and catches up after. The run is worked out from a fixed moment every `TRAFFIC_WINDOW` seconds (where every car is
 *   on its timetable), so every viewer sees the same cars in the same places. The lanes never cross a building, wall or
 *   fence (L5's colliders: `src/lib/ark-town-vehicles.test.ts`).
 * - **Bicycles** left out by front doors, gates and the shops, by the day (people implied).
 *
 * Everything is in the town's own frame (x east, z south, metres).
 */

import {BufferAttribute, BufferGeometry, Color, DynamicDrawUsage, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshStandardMaterial, Object3D, Quaternion, Vector3, type Camera, type Material} from "three";
import {hashText, local, polylineAt, polylineLength, polylineNearest, polylineWithin, type Box, type Poly, type Pt} from "@/ark-scene/islands/town/geom";
import {townHeight} from "@/ark-scene/islands/town/ground";
import {CANAL, CANAL_WIDTH, TOWN_LEVEL, townPlan, type Street, type TownPlan} from "@/ark-scene/islands/town/plan";
import {carAt, chance, weekday, type CarSpot, type TownClock} from "@/ark-scene/islands/town/people";
import {townChunkOf} from "@/ark-scene/islands/town/chunks";
import {townColliderSet} from "@/ark-scene/islands/town/colliders";
import {launchEnclosures} from "@/ark-scene/islands/town/areas";
import {Geo, tone, type Frame} from "@/ark-scene/islands/town/render/kit";
import {townWeather} from "@/ark-scene/islands/town/render/materials";
import {CROSSINGS} from "@/ark-scene/islands/town/render/streets";
import {BUS_STOPS} from "@/ark-scene/islands/town/render/furniture";

// MARK: - The models

export const VEHICLE_FILE = "/ark/assets/town-v1/vehicles.bin";
export const CAR_KINDS = ["saloon", "hatchback", "citycar", "suv", "coupe", "estate"] as const;
export type CarKind = (typeof CAR_KINDS)[number];

/** The car classes' own colours (the paint is white here: each car's colour tints it). */
const CLASS_COLOUR = ["#ffffff", "#1d1e20", "#64676b", "#1c242c", "#ece6d0", "#9c1e18", "#2a2420"];

export type VehicleLevel = {positions: Float32Array; classes: Uint8Array; indices: Uint16Array};
export type VehicleModel = {name: string; size: [number, number, number]; glass: [number, number, number, number]; levels: VehicleLevel[]};

/** The binary from `scripts/ark-town-vehicles.mts`: "ARKV", version, header length, the JSON header, then each level's arrays. */
export function parseVehicles(buffer: ArrayBuffer): Map<string, VehicleModel> {
    const view = new DataView(buffer);
    const magic = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
    if (magic !== "ARKV") throw new Error("not a town vehicles file");
    const headerLength = view.getUint32(8, true);
    const header = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 12, headerLength))) as {models: Array<{name: string; size: [number, number, number]; glass: [number, number, number, number]; levels: Array<{vertices: number; indices: number}>}>};
    let at = 12 + headerLength;
    const take = (bytes: number) => {
        const start = at;
        at += bytes + ((4 - (bytes % 4)) % 4);
        return start;
    };
    const out = new Map<string, VehicleModel>();
    for (const m of header.models) {
        const levels = m.levels.map((l) => {
            const quantised = new Int16Array(buffer, take(l.vertices * 6), l.vertices * 3);
            const classes = new Uint8Array(buffer, take(l.vertices), l.vertices).slice();
            const indices = new Uint16Array(buffer, take(l.indices * 2), l.indices).slice();
            const positions = new Float32Array(l.vertices * 3);
            for (let i = 0; i < positions.length; i++) positions[i] = quantised[i] / 1000;
            return {positions, classes, indices};
        });
        out.set(m.name, {name: m.name, size: m.size, glass: m.glass, levels});
    }
    return out;
}

/** One level as geometry: positions, the class colours, which vertices take the paint (`aPaint`) and the lamps (`aLamp`). */
export function vehicleGeometry(level: VehicleLevel): BufferGeometry {
    const n = level.classes.length;
    const colours = new Float32Array(n * 3);
    const paint = new Float32Array(n);
    const lamp = new Float32Array(n);
    const c = new Color();
    for (let i = 0; i < n; i++) {
        const k = level.classes[i];
        c.set(CLASS_COLOUR[k] ?? "#808080");
        colours[i * 3] = c.r;
        colours[i * 3 + 1] = c.g;
        colours[i * 3 + 2] = c.b;
        paint[i] = k === 0 ? 1 : 0;
        lamp[i] = k === 4 ? 1 : k === 5 ? 2 : 0;
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(level.positions, 3));
    g.setAttribute("color", new BufferAttribute(colours, 3));
    g.setAttribute("aPaint", new BufferAttribute(paint, 1));
    g.setAttribute("aLamp", new BufferAttribute(lamp, 1));
    g.setIndex(new BufferAttribute(level.indices, 1));
    // (Flat shaded on screen; the normals are for the town's weather: how much a face turned up to the sky shines wet.)
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
}

/** A car seen from afar: its body, cabin, glass, wheels and lamps from its model's box and glass line (~90 triangles). */
export function proxyGeometry(model: Pick<VehicleModel, "size" | "glass">): BufferGeometry {
    const geo = new Geo();
    const [sw, h, l] = model.size;
    const w = sw * 0.92;
    const [gy0, , gz0, gz1] = model.glass;
    const belt = gy0 > 0 ? gy0 : h * 0.62;
    const f: Frame = {x: 0, y: 0, z: 0, rot: 0};
    const paint = tone("#ffffff");
    const dark = tone(CLASS_COLOUR[1]);
    const glass = tone(CLASS_COLOUR[3]);
    geo.tag = 1;
    geo.box(f, 0, 0.2, 0, w, belt - 0.2, l, paint);
    // The cabin: glass sides, the screens raked, a painted roof.
    const front = gz1 > gz0 ? gz1 : l * 0.2;
    const back = gz1 > gz0 ? gz0 : -l * 0.32;
    const topFront = front - (front - back) * 0.3;
    const topBack = back + (front - back) * 0.1;
    const bw = w / 2 - 0.02;
    const tw = w / 2 - 0.16;
    const P = (x: number, y: number, z: number): [number, number, number] => [x, y, z];
    const b = [P(-bw, belt, back), P(bw, belt, back), P(bw, belt, front), P(-bw, belt, front)];
    const t = [P(-tw, h, topBack), P(tw, h, topBack), P(tw, h, topFront), P(-tw, h, topFront)];
    geo.quad(b[3], b[2], t[2], t[3], glass);
    geo.quad(b[1], b[0], t[0], t[1], glass);
    geo.quad(b[2], b[1], t[1], t[2], glass);
    geo.quad(b[0], b[3], t[3], t[0], glass);
    geo.quad(t[3], t[2], t[1], t[0], paint);
    geo.tag = 0;
    for (const [x, z] of [[-1, 1], [1, 1], [-1, -1], [1, -1]] as const) geo.box(f, x * (w / 2 - 0.1), 0, z * l * 0.32, 0.24, 0.64, 0.64, dark);
    geo.tag = 2;
    geo.box(f, 0, belt - 0.32, l / 2 - 0.01, w * 0.8, 0.14, 0.04, tone(CLASS_COLOUR[4]));
    geo.tag = 3;
    geo.box(f, 0, belt - 0.28, -l / 2 + 0.01, w * 0.8, 0.12, 0.04, tone(CLASS_COLOUR[5]));
    const g = geo.toGeometry(true);
    // (`aTag`: 1 the paint, 2 a headlamp, 3 a tail lamp.)
    const tag = g.getAttribute("aTag") as BufferAttribute;
    const n = tag.count;
    const paintAttr = new Float32Array(n);
    const lampAttr = new Float32Array(n);
    for (let i = 0; i < n; i++) {
        const k = tag.getX(i);
        paintAttr[i] = k === 1 ? 1 : 0;
        lampAttr[i] = k === 2 ? 1 : k === 3 ? 2 : 0;
    }
    g.deleteAttribute("aTag");
    g.setAttribute("aPaint", new BufferAttribute(paintAttr, 1));
    g.setAttribute("aLamp", new BufferAttribute(lampAttr, 1));
    return g;
}

/** Before the models are in: each kind's box and glass line (the converter's numbers), so the proxies are right from the start. */
export const CAR_BOXES: Record<CarKind, Pick<VehicleModel, "size" | "glass">> = {
    saloon: {size: [1.97, 1.29, 4.6], glass: [0.833, 1.232, -1.473, 0.938]},
    hatchback: {size: [1.778, 1.157, 4.15], glass: [0.751, 1.111, -1.328, 0.846]},
    citycar: {size: [1.782, 1.246, 3.6], glass: [0.845, 1.211, -1.334, 0.827]},
    suv: {size: [1.94, 1.633, 4.5], glass: [1.106, 1.569, -1.95, 1.017]},
    coupe: {size: [1.878, 1.266, 4.35], glass: [0.863, 1.221, -1.483, 0.863]},
    estate: {size: [2.014, 1.348, 4.4], glass: [0.93, 1.304, -1.568, 0.945]}
};

/**
 * The cars' material: flat shaded (the town's low-poly look), the paint tinted by each instance's colour, the lamps lit
 * by `aLights` (moving cars at night: headlamps on, the tail lamps brighter when braking). `lit`: with the lamps' attribute.
 */
export function vehicleMaterial(lit: boolean): MeshStandardMaterial {
    const material = new MeshStandardMaterial({vertexColors: true, flatShading: true, roughness: 0.42, metalness: 0.18});
    material.customProgramCacheKey = () => `town-vehicle:${lit ? 1 : 0}`;
    material.onBeforeCompile = (shader) => {
        shader.vertexShader = shader.vertexShader
            .replace("#include <common>", `#include <common>\nattribute float aPaint;\nattribute float aLamp;\nvarying float vCarLamp;\nvarying float vCarPaint;${lit ? "\nattribute vec2 aLights;\nvarying vec2 vCarLights;" : ""}`)
            .replace(
                "#include <color_vertex>",
                `vColor = vec3(1.0);\n#ifdef USE_COLOR\nvColor *= color;\n#endif\n#ifdef USE_INSTANCING_COLOR\nvColor = mix(vColor, vColor * instanceColor.xyz, aPaint);\n#endif\nvCarLamp = aLamp;\nvCarPaint = aPaint;${lit ? "\nvCarLights = aLights;" : ""}`
            );
        shader.fragmentShader = shader.fragmentShader
            .replace("#include <common>", `#include <common>\nvarying float vCarLamp;\nvarying float vCarPaint;${lit ? "\nvarying vec2 vCarLights;" : ""}`)
            .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor *= mix(1.48, 0.81, vCarPaint);")
            .replace(
                "#include <emissivemap_fragment>",
                `#include <emissivemap_fragment>${lit ? "\nfloat carHead = step(0.5, vCarLamp) * step(vCarLamp, 1.5);\nfloat carTail = step(1.5, vCarLamp);\ntotalEmissiveRadiance += vec3(1.0, 0.93, 0.78) * carHead * vCarLights.x * 2.6 + vec3(1.0, 0.12, 0.08) * carTail * (vCarLights.x * 0.9 + vCarLights.y * 2.2);" : ""}`
            );
    };
    // The town's weather (lane GA's kit): paint, glass and plastic never soak; wet, they shine; lit by the street lamps.
    return townWeather(material, {soak: 0, wetRoughness: 0.18});
}

let library: Promise<Map<string, VehicleModel> | null> | null = null;

/** The models, read once for the page (null if the file is missing or broken: the proxies stay). */
export function loadVehicles(url = VEHICLE_FILE): Promise<Map<string, VehicleModel> | null> {
    if (!library) {
        library =
            typeof fetch === "undefined"
                ? Promise.resolve(null)
                : fetch(url)
                      .then((response) => (response.ok ? response.arrayBuffer() : null))
                      .then((buffer) => (buffer ? parseVehicles(buffer) : null))
                      .catch(() => null);
    }
    return library;
}

// MARK: - Colours

/** Car colours as a British town has them: greys, silvers, black and white most, then blues, reds, greens, a few bright ones. */
export const CAR_PAINTS: Array<[string, number]> = [
    ["#c9ccd0", 14], ["#8d9196", 12], ["#3d4146", 11], ["#16181b", 13], ["#f2f2ee", 13], ["#1f3358", 7], ["#3c5f8e", 4], ["#7d1418", 5], ["#b3241e", 3],
    ["#2c4a35", 3], ["#5b6d4a", 1], ["#c5b58f", 2], ["#6a4a34", 1], ["#e0a92c", 1], ["#d86a1e", 1], ["#5e2a4a", 1], ["#8fb3c7", 2], ["#4c3a2c", 1]
];
const PAINT_TOTAL = CAR_PAINTS.reduce((n, [, w]) => n + w, 0);

export function carPaint(roll: number): string {
    let r = roll * PAINT_TOTAL;
    for (const [hex, w] of CAR_PAINTS) {
        if (r < w) return hex;
        r -= w;
    }
    return CAR_PAINTS[0][0];
}

/** The kinds by how common they are (hatchbacks and saloons most); the low tier draws only the first three. */
const KIND_WEIGHT: Record<CarKind, number> = {hatchback: 30, saloon: 22, suv: 18, citycar: 14, estate: 10, coupe: 6};
export const LOW_TIER_KINDS: readonly CarKind[] = ["hatchback", "saloon", "suv"];

export function carKind(roll: number, kinds: readonly CarKind[] = CAR_KINDS): CarKind {
    const total = kinds.reduce((n, k) => n + KIND_WEIGHT[k], 0);
    let r = roll * total;
    for (const k of kinds) {
        if (r < KIND_WEIGHT[k]) return k;
        r -= KIND_WEIGHT[k];
    }
    return kinds[0];
}

// MARK: - The street's surface

/** The carriageway's height under a point: the ground's, held at the bank's level on a bridge over the canal. */
export function roadHeight(x: number, z: number): number {
    if (polylineWithin(CANAL, x, z, CANAL_WIDTH / 2 + 0.6)) return TOWN_LEVEL;
    return townHeight(x, z);
}

// MARK: - The road graph and its loops

/** A loop's leg: along a street from one junction to the next, with (+1) or against (-1) the street's line. */
type Leg = {street: string; dir: 1 | -1};

/**
 * The loops the moving cars drive (the plan's road graph: each leg runs from its junction with the leg before to its
 * junction with the next). Driving on the left; each loop clockwise or not as its streets allow.
 */
export const TOWN_LOOPS: Array<{id: string; legs: Leg[]; cars: number; night: number}> = [
    // The old town: the High Street from West Street to Park Road, down Park Road, back along Harbour Road (one way west).
    {id: "old_town", legs: [{street: "high_street", dir: 1}, {street: "park_road", dir: 1}, {street: "harbour_road", dir: -1}, {street: "west_street", dir: -1}], cars: 3, night: 1},
    // The new town's south block: High Street east, East Road, Harbour Road east, Park Road (north).
    {id: "east_south", legs: [{street: "high_street_east", dir: 1}, {street: "east_road", dir: 1}, {street: "harbour_road_east", dir: -1}, {street: "park_road", dir: -1}], cars: 2, night: 1},
    // The north block: Park Road (north), Mill Lane east, East Road (south), High Street east (west).
    {id: "east_north", legs: [{street: "park_road", dir: -1}, {street: "mill_lane_east", dir: 1}, {street: "east_road", dir: 1}, {street: "high_street_east", dir: -1}], cars: 1, night: 0}
];

/**
 * The traffic signals (lane GA's, `render/furniture.ts`): where the High Street meets Park Road, the two roads on
 * opposite phases of a 60 s cycle on the shared clock (green 26 s, amber 3 s, red 31 s; Park Road 30 s behind).
 */
export const SIGNAL_CYCLE = {period: 60, green: 26, offset: 30} as const;

/** Whether a signal shows green to a road's phase at a moment (epoch seconds; the island clock's whole minutes are the same). */
export function signalGreen(phase: number, epochSeconds: number): boolean {
    const t = (((epochSeconds + phase * SIGNAL_CYCLE.offset) % SIGNAL_CYCLE.period) + SIGNAL_CYCLE.period) % SIGNAL_CYCLE.period;
    return t < SIGNAL_CYCLE.green;
}

/** The signalled junctions: their middle, and each road's phase by the way it runs (x: the High Street, z: Park Road). */
export function townSignals(plan: TownPlan = townPlan()): Array<{x: number; z: number; phaseAlongX: number; phaseAlongZ: number}> {
    const high = plan.streets.find((s) => s.id === "high_street");
    if (!high || !plan.streets.some((s) => s.id === "park_road")) return [];
    const end = high.line[high.line.length - 1];
    return [{x: end.x, z: end.z, phaseAlongX: 0, phaseAlongZ: 1}];
}

export type Crossing = {street: string; along: number; x: number; z: number; dir: Pt; width: number};

function streetOf(plan: TownPlan, id: string): Street {
    const s = plan.streets.find((q) => q.id === id);
    if (!s) throw new Error(`no street ${id}`);
    return s;
}

/** The zebra crossings on their streets (lane GA's `CROSSINGS`, drawn with their beacons): the cars stop at each. */
export function townCrossings(plan: TownPlan = townPlan()): Crossing[] {
    const out: Crossing[] = [];
    for (const c of CROSSINGS) {
        const s = plan.streets.find((q) => q.id === c.street);
        if (!s) continue;
        const {point, dir} = polylineAt(s.line, c.at);
        out.push({street: c.street, along: c.at, x: point.x, z: point.z, dir, width: s.width});
    }
    return out;
}

/** Where two streets meet: the distance along `a` nearest `b` (its crossing, or the end of one on the other). */
function junctionAlong(a: Street, b: Street): number {
    let best = Infinity;
    let along = 0;
    // Each of b's vertices and segment crossings against a.
    const la = polylineLength(a.line);
    for (let s = 0; s <= la; s += 0.5) {
        const p = polylineAt(a.line, s).point;
        const d = polylineNearest(b.line, p.x, p.z).distance;
        if (d < best) {
            best = d;
            along = s;
        }
    }
    return along;
}

/** What each street's carriageway holds at a point: its parking side (-1 left of its line, +1 right) and the traffic. */
type StreetUse = {plus: Array<[number, number]>; minus: Array<[number, number]>};

export type TrafficPath = {
    id: string;
    /** Samples every `step` m: position, heading (unit), the street (or -1 on a corner), cruise speed (m/s). */
    step: number;
    x: Float32Array;
    z: Float32Array;
    dx: Float32Array;
    dz: Float32Array;
    speed: Float32Array;
    /** How far a car may stand off its lane here (m, + to its right), to pass something at the kerb: within the carriageway, clear of the parked cars and the oncoming lane. */
    offLo: Float32Array;
    offHi: Float32Array;
    /** On a two-way stretch, how far it may go over into the oncoming lane when that is empty (to pass a sleeping cat). */
    offOver: Float32Array;
    length: number;
    /** Where cars stop (m along) and for how long (s): give way before a turn, zebra crossings. */
    stops: Array<{at: number; seconds: number; kind: "give_way" | "crossing" | "signal"; phase?: number}>;
    /** The timetable: seconds to reach each sample (including the stops); one lap's time (whole minutes). */
    time: Float64Array;
    lap: number;
};

const STEP = 0.5;
const LANE_HALF = 0.95;
const KERB_GAP = 0.25;
const PARK_STRIP = 2.15;

/** The town's traffic: each loop's path and timetable, each street's use (for the parking), built once per plan. */
export type TownTraffic = {paths: TrafficPath[]; use: Map<string, StreetUse>; crossings: Crossing[]; cars: Array<{loop: number; phase: number; night: boolean}>};

let trafficMemo: {plan: TownPlan; traffic: TownTraffic} | null = null;

export function townTraffic(plan: TownPlan = townPlan()): TownTraffic {
    if (trafficMemo && trafficMemo.plan === plan) return trafficMemo.traffic;
    const use = new Map<string, StreetUse>();
    const crossings = townCrossings(plan);
    const legsOf = TOWN_LOOPS.map((loop) => {
        const legs = loop.legs.map((leg, i) => {
            const s = streetOf(plan, leg.street);
            const prev = streetOf(plan, loop.legs[(i + loop.legs.length - 1) % loop.legs.length].street);
            const next = streetOf(plan, loop.legs[(i + 1) % loop.legs.length].street);
            const from = junctionAlong(s, prev);
            const to = junctionAlong(s, next);
            const u = use.get(s.id) ?? {plus: [], minus: []};
            (leg.dir > 0 ? u.plus : u.minus).push([Math.min(from, to), Math.max(from, to)]);
            use.set(s.id, u);
            return {leg, street: s, from, to, prev, next};
        });
        return legs;
    });
    const paths = legsOf.map((legs, li) => buildPath(TOWN_LOOPS[li].id, legs, use, crossings, plan));
    const cars: TownTraffic["cars"] = [];
    TOWN_LOOPS.forEach((loop, li) => {
        const path = paths[li];
        // When on its timetable a car reaches its signal's line (the lap's time there), and that road's phase.
        const signal = path.stops.find((s) => s.kind === "signal");
        const atSignal = signal ? path.time[Math.min(path.time.length - 1, Math.round(signal.at / STEP))] : 0;
        for (let k = 0; k < loop.cars; k++) {
            const jitter = (hashText(`${loop.id}:${k}`) % 1000) / 1000;
            let phase = ((k + 0.35 * jitter) / loop.cars) * path.lap;
            if (signal) {
                // Shift it (under half a minute) so it reaches the line 10 s into its road's green, lap after lap.
                // (Each car of a loop its own moment in the green, 8 s apart: 5, 13, 21 s in.)
                const into = 5 + 8 * (k % 3);
                const want = (((atSignal + (signal.phase ?? 0) * SIGNAL_CYCLE.offset - into) % SIGNAL_CYCLE.period) + SIGNAL_CYCLE.period) % SIGNAL_CYCLE.period;
                const now = ((phase % SIGNAL_CYCLE.period) + SIGNAL_CYCLE.period) % SIGNAL_CYCLE.period;
                let shift = want - now;
                if (shift > SIGNAL_CYCLE.period / 2) shift -= SIGNAL_CYCLE.period;
                if (shift < -SIGNAL_CYCLE.period / 2) shift += SIGNAL_CYCLE.period;
                phase = (((phase + shift) % path.lap) + path.lap) % path.lap;
            }
            cars.push({loop: li, phase, night: k < loop.night});
        }
    });
    const traffic = {paths, use, crossings, cars};
    trafficMemo = {plan, traffic};
    return traffic;
}

/** Inside an interval list (with a margin, m). */
function within(list: Array<[number, number]>, along: number, margin = 0): boolean {
    return list.some(([a, b]) => along >= a - margin && along <= b + margin);
}

/**
 * Which kerbs have parking at a point: none on the high streets (double yellow lines); on a two-way stretch only the
 * left kerb (-1, left of the street's line) and only where the carriageway is 7 m; on a one-way stretch the kerb on the
 * traffic's right (so it keeps left, as in Britain); where no car drives, both.
 */
export function parkingSides(street: Street, use: StreetUse | undefined, along: number): Array<-1 | 1> {
    // (The high streets have double yellow lines along both kerbs, lane GA's: no parking there at all.)
    if (street.kind === "high") return [];
    const plus = Boolean(use && within(use.plus, along, 8));
    const minus = Boolean(use && within(use.minus, along, 8));
    if (plus && minus) return street.width >= 7 ? [-1] : [];
    if (plus) return [1];
    if (minus) return [-1];
    return [-1, 1];
}

/** The lane's offset (m, + to the right of the street's line) for a car going `dir` along it at `along`. */
export function laneOffset(street: Street, use: StreetUse | undefined, along: number, dir: 1 | -1): number {
    const half = street.width / 2;
    const sides = parkingSides(street, use, along);
    const lo = -half + (sides.includes(-1) ? PARK_STRIP : 0);
    const hi = half - (sides.includes(1) ? PARK_STRIP : 0);
    const twoWay = Boolean(use && within(use.plus, along, 8) && within(use.minus, along, 8));
    // One way: the middle of what the parked cars leave (on the traffic's left); two way: driving on the left.
    if (!twoWay) return (lo + hi) / 2;
    return dir > 0 ? lo + (hi - lo) / 4 : lo + ((hi - lo) * 3) / 4;
}

type LegBuild = {leg: Leg; street: Street; from: number; to: number; prev: Street; next: Street};

function buildPath(id: string, legs: LegBuild[], use: Map<string, StreetUse>, crossings: Crossing[], plan: TownPlan): TrafficPath {
    const xs: number[] = [];
    const zs: number[] = [];
    const sp: number[] = [];
    const los: number[] = [];
    const his: number[] = [];
    const overs: number[] = [];
    const stops: TrafficPath["stops"] = [];
    const CORNER = 7.5;
    const cruiseOf = (s: Street) => (s.kind === "high" ? 4.8 : 6.2);
    const legPoints = legs.map((l) => {
        const dir = l.leg.dir;
        const start = l.from + dir * CORNER;
        const end = l.to - dir * CORNER;
        const pts: Array<{x: number; z: number; dx: number; dz: number; lo: number; hi: number; over: number}> = [];
        const length = Math.abs(end - start);
        const n = Math.max(1, Math.ceil(length / STEP));
        for (let k = 0; k <= n; k++) {
            const along = start + ((end - start) * k) / n;
            const {point, dir: d} = polylineAt(l.street.line, along);
            const u = use.get(l.street.id);
            const off = laneOffset(l.street, u, along, dir);
            // What the car may stand off its lane: the carriageway less the parked cars, and on a two-way stretch no
            // nearer the oncoming lane than a car's width and a quarter metre.
            const sides = parkingSides(l.street, u, along);
            const half = l.street.width / 2;
            const nLo = -half + (sides.includes(-1) ? PARK_STRIP : 0) + CAR_HALF_WIDTH + 0.12;
            const nHi = half - (sides.includes(1) ? PARK_STRIP : 0) - CAR_HALF_WIDTH - 0.12;
            const twoWay = Boolean(u && within(u.plus, along, 8) && within(u.minus, along, 8));
            let lo = dir > 0 ? nLo - off : -(nHi - off);
            let hi = dir > 0 ? nHi - off : -(nLo - off);
            const over = Math.max(hi, 0);
            if (twoWay) hi = Math.min(hi, Math.max((nHi - nLo + 2 * CAR_HALF_WIDTH + 0.24) / 2 - 2 * CAR_HALF_WIDTH - 0.25, 0));
            lo = Math.min(lo, 0);
            hi = Math.max(hi, 0);
            // (+ to the right of the line: the right normal of (dx, dz) is (-dz, dx).)
            pts.push({x: point.x - d.z * off, z: point.z + d.x * off, dx: d.x * dir, dz: d.z * dir, lo, hi, over});
        }
        return {pts, cruise: cruiseOf(l.street), leg: l};
    });
    legPoints.forEach((lp, i) => {
        const startAt = xs.length * STEP;
        for (const p of lp.pts) {
            if (xs.length) {
                const lx = xs[xs.length - 1];
                const lz = zs[zs.length - 1];
                const d = Math.hypot(p.x - lx, p.z - lz);
                if (d < STEP * 0.5) continue;
            }
            xs.push(p.x);
            zs.push(p.z);
            sp.push(lp.cruise);
            los.push(p.lo);
            his.push(p.hi);
            overs.push(p.over);
        }
        // Crossings on this leg (the car stops 3 m short of the stripes).
        for (const c of crossings) {
            if (c.street !== lp.leg.street.id) continue;
            const lo = Math.min(lp.leg.from, lp.leg.to);
            const hi = Math.max(lp.leg.from, lp.leg.to);
            if (c.along < lo + 9 || c.along > hi - 9) continue;
            const into = Math.abs(c.along - (lp.leg.from + lp.leg.leg.dir * CORNER)) - 3 - 2.2;
            stops.push({at: startAt + Math.max(into, 0), seconds: 3.5, kind: "crossing"});
        }
        // The corner to the next leg: a curve between this leg's end and the next one's start; give way before it.
        const next = legPoints[(i + 1) % legPoints.length].pts[0];
        const end = lp.pts[lp.pts.length - 1];
        // (At a signalled junction the signal decides, not a give-way.)
        const signalled = townSignals(plan).some((g) => Math.hypot(end.x - g.x, end.z - g.z) < 14);
        if (!signalled) stops.push({at: xs.length * STEP - STEP * 2, seconds: 1.8, kind: "give_way"});
        const chord = Math.hypot(next.x - end.x, next.z - end.z);
        const k = chord * 0.55;
        const b0 = {x: end.x, z: end.z};
        const b1 = {x: end.x + end.dx * k, z: end.z + end.dz * k};
        const b2 = {x: next.x - next.dx * k, z: next.z - next.dz * k};
        const b3 = {x: next.x, z: next.z};
        const m = Math.max(4, Math.ceil((chord * 1.3) / STEP));
        for (let j = 1; j < m; j++) {
            const t = j / m;
            const u = 1 - t;
            const x = u * u * u * b0.x + 3 * u * u * t * b1.x + 3 * u * t * t * b2.x + t * t * t * b3.x;
            const z = u * u * u * b0.z + 3 * u * u * t * b1.z + 3 * u * t * t * b2.z + t * t * t * b3.z;
            const d = Math.hypot(x - xs[xs.length - 1], z - zs[zs.length - 1]);
            if (d < STEP * 0.5) continue;
            xs.push(x);
            zs.push(z);
            sp.push(2.8);
            los.push(0);
            his.push(0);
            overs.push(0);
        }
    });
    // Resample at even steps (so the index is the distance along).
    const raw = xs.length;
    const cum = new Float32Array(raw + 1);
    for (let i = 1; i <= raw; i++) cum[i] = cum[i - 1] + Math.hypot(xs[i % raw] - xs[i - 1], zs[i % raw] - zs[i - 1]);
    const length = cum[raw];
    // (A whole number of samples round the loop, so it closes evenly: sample i is i × STEP along, near enough.)
    const n = Math.max(8, Math.round(length / STEP));
    const spacing = length / n;
    const X = new Float32Array(n);
    const Z = new Float32Array(n);
    const DX = new Float32Array(n);
    const DZ = new Float32Array(n);
    const S = new Float32Array(n);
    const LO = new Float32Array(n);
    const HI = new Float32Array(n);
    const OVER = new Float32Array(n);
    let j = 0;
    const scale = raw * STEP > 0 ? (n * STEP) / (raw * STEP) : 1;
    for (let i = 0; i < n; i++) {
        const s = i * spacing;
        while (j < raw - 1 && cum[j + 1] < s) j++;
        const seg = cum[j + 1] - cum[j] || 1;
        const t = (s - cum[j]) / seg;
        const a = j;
        const b = (j + 1) % raw;
        X[i] = xs[a] + (xs[b] - xs[a]) * t;
        Z[i] = zs[a] + (zs[b] - zs[a]) * t;
        S[i] = sp[a];
        LO[i] = Math.max(los[a], los[b]);
        HI[i] = Math.min(his[a], his[b]);
        OVER[i] = Math.min(overs[a], overs[b]);
    }
    for (let i = 0; i < n; i++) {
        const a = (i + n - 1) % n;
        const b = (i + 1) % n;
        const dx = X[b] - X[a];
        const dz = Z[b] - Z[a];
        const l = Math.hypot(dx, dz) || 1;
        DX[i] = dx / l;
        DZ[i] = dz / l;
    }
    // The signals' stop lines: 9 m short of the junction's middle, coming towards it; the phase by the way the car runs.
    const stopAt = stops.map((s) => ({...s, at: s.at * scale}));
    for (const g of townSignals(plan)) {
        for (let i = 1; i < n; i++) {
            const d0 = Math.hypot(X[i - 1] - g.x, Z[i - 1] - g.z);
            const d1 = Math.hypot(X[i] - g.x, Z[i] - g.z);
            if (d0 >= 9 && d1 < 9) {
                const alongX = Math.abs(DX[i]) > Math.abs(DZ[i]);
                stopAt.push({at: i * STEP, seconds: 0, kind: "signal", phase: alongX ? g.phaseAlongX : g.phaseAlongZ});
            }
        }
    }
    stopAt.sort((a, b) => a.at - b.at);
    // Slow into corners and stops (and out of them): no faster than a gentle braking curve allows (a signal only when red).
    const BRAKE = 1.1;
    const limit = new Float32Array(n);
    for (let i = 0; i < n; i++) limit[i] = S[i];
    for (const s of stopAt) {
        if (s.kind === "signal") continue;
        const i0 = Math.round(s.at / STEP);
        for (let k = 0; k < 40; k++) {
            const i = (i0 - k + n) % n;
            const d = k * STEP;
            limit[i] = Math.min(limit[i], Math.sqrt(0.36 + 2 * BRAKE * d));
            const o = (i0 + k) % n;
            limit[o] = Math.min(limit[o], Math.sqrt(0.36 + 2 * BRAKE * 0.9 * d));
        }
    }
    for (let pass = 0; pass < 2; pass++) {
        for (let i = n - 2; i >= 0; i--) limit[i] = Math.min(limit[i], Math.sqrt(limit[i + 1] * limit[i + 1] + 2 * BRAKE * STEP));
        for (let i = 1; i < n; i++) limit[i] = Math.min(limit[i], Math.sqrt(limit[i - 1] * limit[i - 1] + 2 * BRAKE * STEP));
    }
    // (In doubles: a lap's time is counted from 1970, so a float's rounding would drift the cars off the signals' minute.)
    const time = new Float64Array(n + 1);
    const stopIndex = new Map<number, number>();
    for (const s of stopAt) if (s.seconds > 0) stopIndex.set(Math.min(n - 1, Math.round(s.at / STEP)), (stopIndex.get(Math.min(n - 1, Math.round(s.at / STEP))) ?? 0) + s.seconds);
    // A lap a whole number of the signals' minutes (the spare seconds as a longer wait at the first give-way), so each
    // car meets the lights at the same point of their cycle every lap (its phase is chosen for a green: `townTraffic`).
    let drive = 0;
    for (let i = 0; i < n; i++) drive += STEP / Math.max(limit[i], 0.4) + (stopIndex.get(i) ?? 0);
    const spare = Math.ceil(drive / SIGNAL_CYCLE.period) * SIGNAL_CYCLE.period - drive;
    const giveWay = stopAt.find((s) => s.kind === "give_way");
    if (giveWay) {
        const i = Math.min(n - 1, Math.round(giveWay.at / STEP));
        stopIndex.set(i, (stopIndex.get(i) ?? 0) + spare);
        giveWay.seconds += spare;
    }
    for (let i = 0; i < n; i++) time[i + 1] = time[i] + STEP / Math.max(limit[i], 0.4) + (stopIndex.get(i) ?? 0);
    return {id, step: STEP, x: X, z: Z, dx: DX, dz: DZ, speed: limit, offLo: LO, offHi: HI, offOver: OVER, length: n * STEP, stops: stopAt, time, lap: Math.round(time[n] / SIGNAL_CYCLE.period) * SIGNAL_CYCLE.period};
}

/** On its timetable: how far round its loop a car is (m) at a lap time (s). */
export function timetableAt(path: TrafficPath, lapTime: number): number {
    const t = ((lapTime % path.lap) + path.lap) % path.lap;
    const time = path.time;
    let lo = 0;
    let hi = time.length - 1;
    while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (time[mid] <= t) lo = mid;
        else hi = mid;
    }
    const span = time[lo + 1] - time[lo];
    const stepTime = STEP / Math.max(path.speed[Math.min(lo, path.speed.length - 1)], 0.4);
    // (A stop's wait is at the end of its sample's time: the car waits at the sample's start, then drives on.)
    const wait = span - stepTime;
    const into = t - time[lo];
    const frac = into <= wait ? 0 : (into - wait) / stepTime;
    return (lo + Math.min(Math.max(frac, 0), 1)) * STEP;
}

/** How far a car may stand off its lane at a distance round its loop (m, + to its right). */
export function offRange(path: TrafficPath, s: number, over = false): [number, number] {
    const n = path.x.length;
    const i = Math.floor((((s / STEP) % n) + n) % n);
    return [path.offLo[i], over ? Math.max(path.offHi[i], path.offOver[i]) : path.offHi[i]];
}

/** A point on a path at a distance round it (m): position and heading. */
export function pathAt(path: TrafficPath, s: number): {x: number; z: number; dx: number; dz: number} {
    const n = path.x.length;
    const f = (((s / STEP) % n) + n) % n;
    const i = Math.floor(f);
    const t = f - i;
    const j = (i + 1) % n;
    const dx = path.dx[i] + (path.dx[j] - path.dx[i]) * t;
    const dz = path.dz[i] + (path.dz[j] - path.dz[i]) * t;
    const l = Math.hypot(dx, dz) || 1;
    return {x: path.x[i] + (path.x[j] - path.x[i]) * t, z: path.z[i] + (path.z[j] - path.z[i]) * t, dx: dx / l, dz: dz / l};
}

// MARK: - The run (shared clock)

/**
 * An animal in the way, as the scene answers (its shared pose and L5's body radius, and its height: one lower than a
 * car's underside, a slug or a beetle, may be under a car between its wheels), in the town's frame.
 */
export type TrafficAnimal = {x: number; z: number; r: number; h?: number};

/** A car's underside clears this (m): anything lower may pass under it between the wheels. */
export const CAR_CLEARANCE = 0.16;

/**
 * How far a car (its body, or for a low animal only its wheels) is from an animal: m, negative when they overlap.
 * The car is a box of `CAR_HALF_LENGTH` × `CAR_HALF_WIDTH` round (x, z), heading (dx, dz).
 */
export function carAnimalGap(car: {x: number; z: number; dx: number; dz: number}, a: TrafficAnimal): number {
    const lx = (a.x - car.x) * car.dx + (a.z - car.z) * car.dz;
    const lz = -(a.x - car.x) * car.dz + (a.z - car.z) * car.dx;
    if ((a.h ?? 1) < CAR_CLEARANCE) {
        let best = Infinity;
        for (const wx of [-1, 1]) for (const wz of [-1, 1]) {
            const ex = Math.max(Math.abs(lx - wx * (CAR_HALF_LENGTH - 0.85)) - 0.34, 0);
            const ez = Math.max(Math.abs(lz - wz * (CAR_HALF_WIDTH - 0.15)) - 0.13, 0);
            best = Math.min(best, Math.hypot(ex, ez) - a.r);
        }
        return best;
    }
    return Math.hypot(Math.max(Math.abs(lx) - CAR_HALF_LENGTH, 0), Math.max(Math.abs(lz) - CAR_HALF_WIDTH, 0)) - a.r;
}
/** The animals near a point at a moment (town frame, epoch seconds); null while their poses are not known yet. */
export type TrafficAnimals = (x: number, z: number, radius: number, epochSeconds: number) => TrafficAnimal[] | null;

/** The run is worked out from the timetable afresh every this many seconds (every car on its timetable then). */
export const TRAFFIC_WINDOW = 600;
const TICK = 0.25;
const ACCEL = 1.2;
const DECEL = 2.6;
export const CAR_HALF_WIDTH = 0.98;
export const CAR_HALF_LENGTH = 2.3;

export type MovingCar = {index: number; loop: number; x: number; z: number; dx: number; dz: number; speed: number; braking: boolean; s: number; active: boolean; lag: number; served: number; dwell: number; off: number};

/** Where a car's nose region starts (m ahead of its middle): only what is ahead of it stops the car. */
const NOSE = CAR_HALF_LENGTH - 0.4;

/** How fast a car moves across (m/s) to pass something at the kerb, and back. */
const LATERAL = 0.7;

/** A car's lap: which lap it is on at a moment and whether it drives that lap (fewer cars late at night). */
function lapOf(path: TrafficPath, car: {phase: number; night: boolean}, epoch: number, offsetHours: number): {lap: number; active: boolean} {
    const lap = Math.floor((epoch + car.phase) / path.lap);
    const start = lap * path.lap - car.phase;
    const hours = (((start / 3600 + offsetHours) % 24) + 24) % 24;
    const quiet = hours >= 0.5 && hours < 5.5;
    return {lap, active: car.night || !quiet};
}

/**
 * The moving cars, stepped on the shared clock: from the window's start (every car on its timetable), each tick each car
 * drives towards where its timetable has it, no faster than its road allows plus a quarter to catch up, never closer than
 * a car's length to anything in its way (animals, other cars), and always stopping at its stops.
 */
export class TrafficSim {
    private window = Number.NaN;
    private at = 0;
    private cars: MovingCar[] = [];
    private blockedSeconds = 0;
    /** Ticks worked out since the start (for the measurements). */
    ticks = 0;
    /** Each car's last answer about the animals near it (now, and in a moment). */
    private asked: Array<{found: TrafficAnimal[]; soon: TrafficAnimal[]} | undefined> = [];
    /** What last held each car up (for the measurements): "car", "animal", "animal soon", "signal", "stop". */
    readonly heldBy: string[] = [];
    constructor(
        readonly traffic: TownTraffic,
        private animals: TrafficAnimals | null = null,
        readonly offsetHours = 0
    ) {}

    setAnimals(query: TrafficAnimals | null) {
        this.animals = query;
        this.window = Number.NaN;
    }

    /**
     * The cars at a moment (epoch seconds). Null while the animals' poses are not known, or while the run is still being
     * worked out up to now within `budgetMs` a call (a page opening mid-window: the rest next call); cars are not drawn then.
     */
    at_(epoch: number, budgetMs = Infinity): MovingCar[] | null {
        const window = Math.floor(epoch / TRAFFIC_WINDOW) * TRAFFIC_WINDOW;
        if (window !== this.window || epoch < this.at - 1e-6) {
            if (!this.start(window)) return null;
        }
        const started = budgetMs < Infinity && typeof performance !== "undefined" ? performance.now() : 0;
        let n = 0;
        while (this.at + TICK <= epoch + 1e-9) {
            if (!this.tick()) return null;
            if (started && ++n % 4 === 0 && performance.now() - started > budgetMs) return null;
        }
        // Between ticks: ease forward along the path.
        const dt = epoch - this.at;
        return this.cars.map((c) => {
            if (!c.active) return c;
            const path = this.traffic.paths[c.loop];
            const p = pathAt(path, c.s + c.speed * dt);
            return {...c, x: p.x - p.dz * c.off, z: p.z + p.dx * c.off, dx: p.dx, dz: p.dz};
        });
    }

    private start(window: number): boolean {
        this.window = window;
        this.asked = [];
        this.at = window;
        this.cars = this.traffic.cars.map((car, index) => {
            const path = this.traffic.paths[car.loop];
            const {lap, active} = lapOf(path, car, window, this.offsetHours);
            const s = timetableAt(path, window + car.phase) + lap * path.length;
            const p = pathAt(path, s);
            const ahead = timetableAt(path, window + car.phase + 1) + lap * path.length;
            return {index, loop: car.loop, x: p.x, z: p.z, dx: p.dx, dz: p.dz, speed: Math.max(0, Math.min(ahead - s, path.speed[Math.floor((s % path.length) / STEP)])), braking: false, s, active, lag: 0, served: -1, dwell: 0, off: 0};
        });
        return true;
    }

    /**
     * Free distance ahead of a car (m) before something is in its way, looking `reach` m along its path, and where it
     * should stand off its lane (m) to pass an animal at the kerb (its own lane's room only; never into parked cars or
     * the oncoming lane). An animal it cannot pass blocks it.
     */
    private freeAhead(car: MovingCar, reach: number, epoch: number): {free: number; off: number; lockLo: number; lockHi: number} | null {
        const path = this.traffic.paths[car.loop];
        let free = reach;
        // Other cars (as they are this tick): one in the corridor ahead blocks, unless both block each other and it is behind in order.
        for (const other of this.cars) {
            if (other === car || !other.active) continue;
            const gap = this.gapTo(path, car.s, car.off, reach, other.x, other.z, CAR_HALF_WIDTH + 0.25, CAR_HALF_LENGTH + 0.6);
            if (gap === null || gap.gap >= free) continue;
            const otherPath = this.traffic.paths[other.loop];
            const mutual = this.gapTo(otherPath, other.s, other.off, reach, car.x, car.z, CAR_HALF_WIDTH + 0.25, CAR_HALF_LENGTH + 0.6);
            if (mutual !== null && other.index > car.index) continue;
            free = gap.gap;
            this.heldBy[car.index] = "car";
        }
        let off = 0;
        // What is alongside fixes how far across it may move (never sideways into an animal beside it).
        let lockLo = -Infinity;
        let lockHi = Infinity;
        if (this.animals) {
            const mid = pathAt(path, car.s + reach / 2);
            // (Asked every other tick, 0.5 s, about a slightly wider circle, and kept for the tick between: the
            // scene's poses cost it a schedule look-up each. Which ticks ask is fixed by the clock, so the same for all.)
            const ask = Math.round(epoch / TICK) % 2 === 0 || !this.asked[car.index];
            if (ask) {
                const found = this.animals(mid.x, mid.z, reach / 2 + CAR_HALF_LENGTH + 5, epoch);
                if (found === null) return null;
                // Where they will be in a moment only when something is near now (nothing near: nothing can arrive by then).
                const soon = found.length ? this.animals(mid.x, mid.z, reach / 2 + CAR_HALF_LENGTH + 5, epoch + 1.2) ?? [] : [];
                this.asked[car.index] = {found, soon};
            }
            const {found, soon} = this.asked[car.index]!;
            // Those ahead or alongside, nearest first: pass each by standing off the lane if the lane has room.
            // (And where each will be in a moment, too: a dog trotting out into the road is passed, or waited for, now.)
            const ahead: Array<{a: TrafficAnimal; gap: number; across: number; at: number}> = [];
            for (const [list, ends] of [[found, 0.4], [soon, 0.7]] as const) {
                for (const a of list) {
                    const g = this.gapTo(path, car.s, 0, reach, a.x, a.z, CAR_HALF_WIDTH + a.r + 3, a.r + ends, -CAR_HALF_LENGTH - 0.6);
                    if (g) ahead.push({a, gap: g.gap, across: g.across, at: g.at});
                }
            }
            ahead.sort((p, q) => p.gap - q.gap);
            // The oncoming lane is free when no car coming the other way is within 45 m: then it may go over into it to pass.
            const over = !this.cars.some((o) => o !== car && o.active && o.dx * car.dx + o.dz * car.dz < -0.3 && Math.hypot(o.x - car.x, o.z - car.z) < 45);
            let lo = -Infinity;
            let hi = Infinity;
            for (const h of ahead) {
                const d = h.at - car.s;
                if (d < NOSE) {
                    // Alongside (or under its front): it may not move across towards it, nor on if it is against it.
                    const s2 = CAR_HALF_WIDTH + h.a.r + 0.05;
                    if (car.off <= h.across - s2) lockHi = Math.min(lockHi, h.across - s2);
                    else if (car.off >= h.across + s2) lockLo = Math.max(lockLo, h.across + s2);
                    else {
                        lockLo = Math.max(lockLo, car.off);
                        lockHi = Math.min(lockHi, car.off);
                        if (d >= 0) free = 0;
                    }
                    continue;
                }
                const side = CAR_HALF_WIDTH + h.a.r + 0.15;
                // Already clear at the lane's own line.
                if (Math.abs(h.across) >= side && lo <= 0 && hi >= 0) continue;
                const [rLo, rHi] = offRange(path, h.at, over);
                // The offsets that clear it: left of it or right of it, within the lane's room and what earlier ones need.
                const left: [number, number] = [Math.max(rLo, lo), Math.min(h.across - side, rHi, hi)];
                const right: [number, number] = [Math.max(h.across + side, rLo, lo), Math.min(rHi, hi)];
                const options = [left, right].filter(([a, b]) => a <= b);
                if (!options.length) {
                    // (Only what is ahead of its nose stops it: beside it, stopping helps nothing; driving on does.)
                    if (h.at - car.s >= NOSE && h.gap < free) {
                        free = h.gap;
                        this.heldBy[car.index] = "animal";
                    }
                    continue;
                }
                // The one nearer where the car stands now.
                const pick = options.map(([a, b]) => ({a, b, to: Math.min(Math.max(car.off, a), b)})).sort((p, q) => Math.abs(p.to - car.off) - Math.abs(q.to - car.off))[0];
                lo = pick.a;
                hi = pick.b;
                off = pick.to;
                // Not across in time: slow so the step aside is done before the nose reaches it.
                const need = Math.abs(off - car.off);
                if (need > 0.03 && h.at - car.s >= NOSE) free = Math.min(free, Math.max(h.gap - 0.2, 0) + (need < 0.15 ? 1 : 0));
            }
        }
        return {free, off, lockLo, lockHi};
    }

    /**
     * Something at (x, z) ahead of a car on its path at `s`, the car `off` its lane: how far its nose may go before the
     * thing is within `side` of the car's line and `ends` of its nose, where it is across the lane's line (m, + right)
     * and how far round the loop it is (null: not within `side`, or not within `reach`). `from`: look from here (m,
     * negative: alongside the car too).
     */
    private gapTo(path: TrafficPath, s: number, off: number, reach: number, x: number, z: number, side: number, ends: number, from = 0): {gap: number; across: number; at: number} | null {
        const here = pathAt(path, s);
        if (Math.hypot(x - here.x, z - here.z) > reach + CAR_HALF_LENGTH + 6) return null;
        for (let d = from; d <= reach + CAR_HALF_LENGTH; d += 0.5) {
            const p = pathAt(path, s + d);
            const along = (x - p.x) * p.dx + (z - p.z) * p.dz;
            const across = -(x - p.x) * p.dz + (z - p.z) * p.dx;
            if (Math.abs(across - off) < side && Math.abs(along) < 0.5) return {gap: Math.max(d - CAR_HALF_LENGTH - ends, 0), across, at: s + d};
        }
        return null;
    }

    private tick(): boolean {
        const epoch = this.at + TICK;
        for (const car of this.cars) {
            const path = this.traffic.paths[car.loop];
            const spec = this.traffic.cars[car.index];
            const {lap, active} = lapOf(path, spec, epoch, this.offsetHours);
            if (!active) {
                car.active = false;
                continue;
            }
            if (!car.active) {
                // Joining on its timetable at its lap's start.
                car.active = true;
                car.s = timetableAt(path, epoch + spec.phase) + lap * path.length;
                car.speed = 0;
            }
            const due = timetableAt(path, epoch + spec.phase) + lap * path.length;
            // (Across a lap's end the timetable wraps: keep the target within a lap of the car.)
            let target = due;
            while (target - car.s > path.length / 2) target -= path.length;
            while (car.s - target > path.length / 2) target += path.length;
            car.lag = target - car.s;
            let pace = timetableAt(path, epoch + spec.phase + 1) - timetableAt(path, epoch + spec.phase);
            if (pace < -path.length / 2) pace += path.length;
            const i = Math.floor((((car.s % path.length) + path.length) % path.length) / STEP);
            const road = path.speed[Math.min(i, path.speed.length - 1)];
            // Its timetable's pace, eased onto the timetable: behind, up to a quarter faster than its road allows.
            let want = Math.min(Math.max(pace + car.lag * 0.6, 0), road * (car.lag > 1 ? 1.25 : 1.05));
            // The timetable waiting (a stop's dwell) and the car just short of it: it stops there, crisply.
            if (pace < 0.05 && car.lag < 1.5) want = 0;
            const reach = Math.max((car.speed * car.speed) / (2 * DECEL) + 4, 6);
            const ahead = this.freeAhead(car, reach, epoch);
            if (ahead === null) return false;
            const free = ahead.free;
            // Its stops: a car behind its timetable still stops at each (for a moment), never runs through.
            const into = ((car.s % path.length) + path.length) % path.length;
            const lapNow = Math.floor(car.s / path.length);
            for (let k = 0; k < path.stops.length; k++) {
                const stop = path.stops[k];
                let ahead = stop.at - into;
                if (ahead < -1) ahead += path.length;
                // A signal: red or amber, the car stops at its line (unless too close to stop); green, it goes.
                if (stop.kind === "signal") {
                    const look = (car.speed * car.speed) / (2 * 1.4) + 10;
                    if (ahead > look || ahead < 0 || signalGreen(stop.phase ?? 0, epoch)) continue;
                    // (Just turned amber and too close to stop gently: it goes on, as drivers do.)
                    const gentle = Math.sqrt(2 * 1.6 * Math.max(ahead - 0.3, 0));
                    if (signalGreen(stop.phase ?? 0, epoch - 2.5) && car.speed > gentle + 0.4) continue;
                    want = Math.min(want, gentle);
                    this.heldBy[car.index] = "signal";
                    continue;
                }
                const key = (lapNow + (stop.at - into < -1 ? 1 : 0)) * 1000 + k;
                if (car.served === key || ahead > reach || car.lag <= 2) continue;
                if (ahead < 0.6 && car.speed < 0.15) {
                    car.dwell += TICK;
                    if (car.dwell >= Math.min(stop.seconds, 1.2)) {
                        car.served = key;
                        car.dwell = 0;
                    }
                    want = 0;
                    continue;
                }
                want = Math.min(want, Math.sqrt(2 * DECEL * Math.max(ahead - 0.3, 0)));
            }
            want = Math.min(want, Math.sqrt(2 * DECEL * Math.max(free - 0.8, 0)));
            const before = car.speed;
            car.speed = want > car.speed ? Math.min(want, car.speed + ACCEL * TICK) : Math.max(want, car.speed - DECEL * 1.6 * TICK);
            car.braking = car.speed < before - 0.05 || (car.speed < 0.1 && free < reach);
            if (free < reach && car.speed < 0.1) this.blockedSeconds += TICK;
            car.s += car.speed * TICK;
            // Standing off the lane to pass, and back, at walking pace across; never beyond the lane's room here.
            const [rLo, rHi] = offRange(path, car.s, true);
            const was = car.off;
            car.off += Math.min(Math.max(ahead.off - car.off, -LATERAL * TICK), LATERAL * TICK);
            car.off = Math.min(Math.max(car.off, rLo), rHi);
            // (Never sideways into what is alongside: within its locks, or where it was.)
            car.off = Math.min(Math.max(car.off, Math.min(ahead.lockLo, was)), Math.max(ahead.lockHi, was));
            const p = pathAt(path, car.s);
            car.x = p.x - p.dz * car.off;
            car.z = p.z + p.dx * car.off;
            car.dx = p.dx;
            car.dz = p.dz;
        }
        this.at = epoch;
        this.ticks++;
        return true;
    }

    stats(): {blockedSeconds: number; ticks: number} {
        return {blockedSeconds: this.blockedSeconds, ticks: this.ticks};
    }
}

// MARK: - Parking

export type ParkingSpot = CarSpot & {street?: string; side?: number};

/** Every parking place: drives, kerb bays, the farms' yards, the harbour's car park (pure in the plan). */
export function townParking(plan: TownPlan = townPlan()): ParkingSpot[] {
    if (parkingMemo && parkingMemo.plan === plan) return parkingMemo.spots;
    const traffic = townTraffic(plan);
    const raw: ParkingSpot[] = [];
    const out = raw;
    const drives: Pt[] = [];
    for (const p of plan.parcels) {
        if (!p.drive) continue;
        const nose = chance(p.id, "nose") < 0.55 ? 0 : Math.PI;
        const s = local(p.drive, 0, 0.2);
        out.push({id: `drive:${p.id}`, kind: "drive", x: s.x, z: s.z, turn: p.drive.rot + nose});
        drives.push(local(p.drive, 0, p.drive.d / 2));
    }
    const roads = plan.streets.filter((s) => s.kind === "road" || s.kind === "high");
    const crossings = traffic.crossings;
    for (const s of roads) {
        const length = polylineLength(s.line);
        const use = traffic.use.get(s.id);
        for (let a = 11; a < length - 11; a += 6) {
            const {point, dir} = polylineAt(s.line, a);
            for (const side of parkingSides(s, use, a)) {
                const off = side * (s.width / 2 - KERB_GAP - LANE_HALF);
                const x = point.x - dir.z * off;
                const z = point.z + dir.x * off;
                // Not in a junction's mouth, on a crossing, by a drive's dropped kerb, on a bridge or by the harbour's quay.
                if (plan.streets.some((o) => o.id !== s.id && o.kind !== "path" && o.kind !== "zoo_path" && o.kind !== "towpath" && polylineWithin(o.line, x, z, o.width / 2 + o.pavement + 7))) continue;
                if (crossings.some((c) => Math.hypot(c.x - x, c.z - z) < 9)) continue;
                if (BUS_STOPS.some((b) => b.street === s.id && Math.abs(b.at - a) < 15)) continue;
                if (drives.some((d) => Math.hypot(d.x - x, d.z - z) < 3.6)) continue;
                if (polylineWithin(CANAL, x, z, CANAL_WIDTH / 2 + 8)) continue;
                // Facing the way the traffic on that side goes (the left side along the line).
                const turn = Math.atan2(dir.x, dir.z) + (side < 0 ? 0 : Math.PI);
                out.push({id: `kerb:${s.id}:${Math.round(a)}:${side}`, kind: "kerb", x, z, turn, street: s.id, side});
            }
        }
    }
    for (const f of plan.farms) {
        const s = local(f.yard, f.yard.w / 4, 0);
        out.push({id: `farm:${f.id}`, kind: "farm", x: s.x, z: s.z, turn: f.at.rot + Math.PI / 2});
    }
    for (let i = 0; i < 8; i++) out.push({id: `harbour:${i}`, kind: "harbour", x: 31.5 + (i % 4) * 2.7, z: 109 + Math.floor(i / 4) * 6.2, turn: Math.floor(i / 4) ? Math.PI : 0});
    // Every car clear of what stands round it (L5's colliders: a garden's tree, a front fence, a wall): slid along its
    // bay up to 0.6 m, else the spot is left empty.
    const set = townColliderSet(launchEnclosures(), {x: 0, z: 0});
    const clear = (x: number, z: number, turn: number) => {
        const dx = Math.sin(turn);
        const dz = Math.cos(turn);
        const g = townHeight(x, z);
        for (const t of [-1.4, -0.47, 0.47, 1.4]) if (set.blocked(x + dx * t, z + dz * t, CAR_HALF_WIDTH - 0.05, g + 0.1, 1.4)) return false;
        return true;
    };
    const spots: ParkingSpot[] = [];
    for (const s of raw) {
        const dx = Math.sin(s.turn);
        const dz = Math.cos(s.turn);
        const shift = [0, 0.3, -0.3, 0.6, -0.6].find((d) => clear(s.x + dx * d, s.z + dz * d, s.turn));
        if (shift === undefined) continue;
        spots.push({...s, x: s.x + dx * shift, z: s.z + dz * shift});
    }
    parkingMemo = {plan, spots};
    return spots;
}

let parkingMemo: {plan: TownPlan; spots: ParkingSpot[]} | null = null;

/** A parked car now: there or not, its kind and colour (by the spot and the day for kerbs, the month for drives). */
export function parkedCar(spot: ParkingSpot, clock: TownClock, kinds: readonly CarKind[] = CAR_KINDS): {parked: boolean; kind: CarKind; paint: string} {
    const {parked} = carAt(spot, clock);
    const era = spot.kind === "kerb" || spot.kind === "harbour" ? clock.day : Math.floor(clock.day / 30);
    return {parked, kind: carKind(chance(spot.id, era, "kind"), kinds), paint: carPaint(chance(spot.id, era, "paint"))};
}

// MARK: - Bicycles (people implied)

export type BikeSpot = {id: string; x: number; z: number; turn: number; lean: number; always: boolean};

/** Bicycles left out: by some front doors and gates, by the flats' doors, at the shops and the pub. */
export function townBikeSpots(plan: TownPlan = townPlan()): BikeSpot[] {
    const out: BikeSpot[] = [];
    for (const b of plan.buildings) {
        const r = chance(b.id, "bike");
        const front = (u: number, out_: number): Pt => local(b.at, u, b.at.d / 2 + out_);
        if (b.kind === "house" && r < 0.32) {
            const p = front(-b.at.w / 2 + 0.6, 0.5);
            out.push({id: `bike:${b.id}`, x: p.x, z: p.z, turn: b.at.rot + Math.PI / 2, lean: -0.15, always: r < 0.08});
        } else if (b.kind === "terrace" && r < 0.7) {
            const k = Math.floor(chance(b.id, "bike-home") * b.households);
            const u = -b.at.w / 2 + (b.at.w / b.households) * (k + 0.5) + 1.4;
            const p = front(u, 0.5);
            out.push({id: `bike:${b.id}:${k}`, x: p.x, z: p.z, turn: b.at.rot + Math.PI / 2, lean: -0.15, always: r < 0.2});
        } else if (b.kind === "flats") {
            for (let k = 0; k < 3; k++) {
                if (chance(b.id, "rack", k) < 0.35) continue;
                const p = front(2.6 + k * 0.7, 0.5);
                out.push({id: `bike:${b.id}:${k}`, x: p.x, z: p.z, turn: b.at.rot + Math.PI / 2, lean: -0.14, always: k === 0});
            }
        } else if ((b.kind === "shop" || b.kind === "pub" || b.shopfront) && r < 0.45) {
            const p = front(b.at.w / 2 - 0.9, 0.55);
            out.push({id: `bike:${b.id}`, x: p.x, z: p.z, turn: b.at.rot + Math.PI / 2, lean: -0.14, always: false});
        }
    }
    return out;
}

/** A bike left out now: the always-out ones, plus daytime ones on dry days and evenings at the pub. */
export function bikeOut(spot: BikeSpot, clock: TownClock): boolean {
    if (spot.always) return true;
    const h = clock.hours;
    const weekend = weekday(clock) === 0 || weekday(clock) === 6;
    const roll = chance(spot.id, clock.day, "out");
    if (h >= 8 && h < 19) return roll < (weekend ? 0.55 : 0.3);
    return h >= 19 && h < 23 && roll < 0.12;
}

// MARK: - Drawing them

/** Per tier: how near (m) a car is drawn at its full model and at its second level; beyond, the proxy up to `far`. */
export const VEHICLE_TIERS = {
    high: {full: 30, mid: 80, far: 900, bikes: 45, kinds: CAR_KINDS as readonly CarKind[]},
    medium: {full: 22, mid: 60, far: 700, bikes: 32, kinds: CAR_KINDS as readonly CarKind[]},
    low: {full: 12, mid: 36, far: 480, bikes: 18, kinds: LOW_TIER_KINDS}
} as const;
export type VehicleTier = keyof typeof VEHICLE_TIERS;

/** The camera's place each frame, for the levels (three calls `update(camera)` on an LOD-like object when it renders). */
class EyeProbe extends Object3D {
    readonly isLOD = true;
    autoUpdate = true;
    readonly eye = new Vector3(Number.NaN, 0, 0);
    private readonly inverse = new Matrix4();
    update(camera: Camera) {
        this.eye.setFromMatrixPosition(camera.matrixWorld);
        if (this.parent) {
            this.inverse.copy(this.parent.matrixWorld).invert();
            this.eye.applyMatrix4(this.inverse);
        }
    }
}

/** One instanced set (a kind at a level): its matrices and colours written each time the set changes. */
class CarSet {
    readonly mesh: InstancedMesh;
    private n = 0;
    readonly lights: InstancedBufferAttribute | null;
    constructor(geometry: BufferGeometry, material: Material, readonly capacity: number, lit: boolean, name: string) {
        let g = geometry;
        if (lit) {
            // (Its own geometry object sharing the same buffers, with the per-car lamps.)
            g = new BufferGeometry();
            for (const [key, value] of Object.entries(geometry.attributes)) g.setAttribute(key, value);
            g.setIndex(geometry.index);
            g.boundingSphere = geometry.boundingSphere;
        }
        this.mesh = new InstancedMesh(g, material, Math.max(capacity, 1));
        this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
        this.mesh.setColorAt(0, new Color(1, 1, 1));
        this.mesh.instanceColor!.setUsage(DynamicDrawUsage);
        this.lights = lit ? new InstancedBufferAttribute(new Float32Array(Math.max(capacity, 1) * 2), 2) : null;
        if (this.lights) {
            this.lights.setUsage(DynamicDrawUsage);
            g.setAttribute("aLights", this.lights);
        }
        this.mesh.count = 0;
        this.mesh.frustumCulled = false;
        // (Hidden while empty: three still sets up an empty instanced mesh's program and uniforms every frame.)
        this.mesh.visible = false;
        this.mesh.name = name;
    }
    begin() {
        this.n = 0;
    }
    push(matrix: Matrix4, colour: Color, lights?: [number, number]) {
        if (this.n >= this.capacity) return;
        this.mesh.setMatrixAt(this.n, matrix);
        this.mesh.setColorAt(this.n, colour);
        if (this.lights && lights) this.lights.setXY(this.n, lights[0], lights[1]);
        this.n++;
    }
    end() {
        this.mesh.count = this.n;
        this.mesh.visible = this.n > 0;
        this.mesh.instanceMatrix.needsUpdate = true;
        if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
        if (this.lights) this.lights.needsUpdate = true;
    }
    get count(): number {
        return this.mesh.count;
    }
    dispose() {
        this.mesh.dispose();
    }
}

const m4 = new Matrix4();
const q4 = new Quaternion();
const v4 = new Vector3();
const s4 = new Vector3(1, 1, 1);
const up = new Vector3(0, 1, 0);
const pitchAxis = new Vector3(0, 0, 1);
const qLean = new Quaternion();

function place(x: number, y: number, z: number, turn: number, lean = 0): Matrix4 {
    q4.setFromAxisAngle(up, turn);
    if (lean) q4.multiply(qLean.setFromAxisAngle(pitchAxis, lean));
    return m4.compose(v4.set(x, y, z), q4, s4);
}

/** A moving car's lamps: headlamps from dusk (and in the rain), the tail lamps brighter when braking. */
export function carLights(hours: number, braking: boolean): [number, number] {
    const dark = hours >= 12 ? Math.min(Math.max((hours - 17.6) / 1.2, 0), 1) : Math.min(Math.max((6.6 - hours) / 1.2, 0), 1);
    return [dark, braking ? 1 : 0];
}

/**
 * The town's cars and bicycles as meshes: one instanced set per kind and level for the parked (written when who is parked
 * changes, once an island minute, or when the camera has moved them between levels), small sets for the moving cars
 * (every frame), and the bicycles. Chunks the streamer does not draw draw none of theirs.
 */
export class TownVehicles {
    readonly group = new Group();
    private readonly probe = new EyeProbe();
    private readonly spots: ParkingSpot[];
    private readonly spotChunk: Uint16Array;
    private readonly bikes: BikeSpot[];
    private readonly parkedMaterial = vehicleMaterial(false);
    private readonly movingMaterial = vehicleMaterial(true);
    private parked = new Map<string, CarSet>();
    private moving = new Map<string, CarSet>();
    private bikeSets: CarSet[] = [];
    private models: Map<string, VehicleModel> | null = null;
    private geometries: BufferGeometry[] = [];
    private drawn: ((chunk: number) => boolean) | null = null;
    private tier: VehicleTier;
    private minute = -1;
    private lastEye = new Vector3(Number.NaN, 0, 0);
    private lastWrite = 0;
    private dirty = true;
    readonly sim: TrafficSim;
    /** The moving cars' run worked out at most this long a frame (ms) when catching up (a page opening mid-window). */
    budgetMs = 3;
    private now: {parked: Array<{spot: number; kind: CarKind; paint: Color}>; bikes: number[]} = {parked: [], bikes: []};
    private colour = new Color();
    private movingNow: MovingCar[] | null = null;

    constructor(plan: TownPlan, tier: VehicleTier, options: {offsetHours?: number} = {}) {
        this.tier = tier;
        this.group.name = "town:vehicles";
        this.group.add(this.probe);
        this.spots = townParking(plan);
        this.spotChunk = Uint16Array.from(this.spots.map((s) => townChunkOf(s.x, s.z)));
        this.bikes = townBikeSpots(plan);
        this.sim = new TrafficSim(townTraffic(plan), null, options.offsetHours ?? 0);
        this.build();
    }

    /** Where a parked or moving car's wheels are: on the carriageway (or the drive), never under the ground. */
    private yAt(x: number, z: number): number {
        return roadHeight(x, z) + 0.03;
    }

    /** The models are in (or were given). */
    get hasModels(): boolean {
        return this.models !== null;
    }

    /** The models arrived: the levels are made and the sets rebuilt. */
    setModels(models: Map<string, VehicleModel> | null) {
        this.models = models;
        this.build();
    }

    setAnimals(query: TrafficAnimals | null) {
        this.sim.setAnimals(query);
    }

    /** The camera's place as last drawn, in the town's frame (NaN before the first frame). */
    get eye(): Vector3 {
        return this.probe.eye;
    }

    private build() {
        for (const set of [...Array.from(this.parked.values()), ...Array.from(this.moving.values()), ...this.bikeSets]) {
            this.group.remove(set.mesh);
            set.dispose();
        }
        for (const g of this.geometries) g.dispose();
        this.geometries = [];
        this.parked.clear();
        this.moving.clear();
        this.bikeSets = [];
        const spots = this.spots.length;
        const movingCount = this.sim.traffic.cars.length;
        for (const kind of CAR_KINDS) {
            const model = this.models?.get(kind);
            const box = model ?? CAR_BOXES[kind];
            const proxy = proxyGeometry(box);
            this.geometries.push(proxy);
            const levels: Array<[string, BufferGeometry, number]> = [["proxy", proxy, spots]];
            if (model) {
                for (const [i, name] of [[0, "full"], [1, "mid"]] as const) {
                    const g = vehicleGeometry(model.levels[i]);
                    this.geometries.push(g);
                    levels.push([name, g, name === "full" ? Math.min(spots, 160) : Math.min(spots, 400)]);
                }
            }
            for (const [level, geometry, capacity] of levels) {
                const parked = new CarSet(geometry, this.parkedMaterial, capacity, false, `cars:${kind}:${level}`);
                parked.mesh.castShadow = level === "full";
                parked.mesh.receiveShadow = true;
                this.parked.set(`${kind}:${level}`, parked);
                this.group.add(parked.mesh);
                const moving = new CarSet(geometry, this.movingMaterial, movingCount, true, `traffic:${kind}:${level}`);
                moving.mesh.castShadow = level !== "proxy";
                this.moving.set(`${kind}:${level}`, moving);
                this.group.add(moving.mesh);
            }
        }
        const bike = this.models?.get("bicycle");
        if (bike) {
            for (const [i, name] of [[0, "full"], [1, "mid"]] as const) {
                const level = bike.levels[i];
                const g = vehicleGeometry(level);
                this.geometries.push(g);
                const set = new CarSet(g, this.parkedMaterial, this.bikes.length, false, `bikes:${name}`);
                set.mesh.castShadow = true;
                this.bikeSets.push(set);
                this.group.add(set.mesh);
            }
        }
        this.minute = -1;
        this.dirty = true;
    }

    setDrawn(drawn: ((chunk: number) => boolean) | null) {
        this.drawn = drawn;
        this.dirty = true;
    }

    setTier(tier: VehicleTier) {
        this.tier = tier;
        this.minute = -1;
        this.dirty = true;
    }

    private levelFor(d: number): "full" | "mid" | "proxy" | null {
        const t = VEHICLE_TIERS[this.tier];
        if (d > t.far) return null;
        if (!this.models) return "proxy";
        return d < t.full ? "full" : d < t.mid ? "mid" : "proxy";
    }

    /** Every frame: the parked (once a minute, or when the camera moved them between levels), the moving cars, the bikes. */
    update(clock: TownClock, epochSeconds: number) {
        const minute = Math.floor(clock.day * 1440 + clock.hours * 60);
        const kinds = VEHICLE_TIERS[this.tier].kinds;
        if (minute !== this.minute) {
            this.minute = minute;
            this.now.parked = [];
            this.spots.forEach((spot, i) => {
                const car = parkedCar(spot, clock, kinds);
                if (car.parked) this.now.parked.push({spot: i, kind: car.kind, paint: new Color(car.paint)});
            });
            this.now.bikes = [];
            this.bikes.forEach((b, i) => {
                if (bikeOut(b, clock)) this.now.bikes.push(i);
            });
            this.dirty = true;
        }
        const eye = this.probe.eye;
        const now = typeof performance !== "undefined" ? performance.now() : 0;
        const moved = Number.isNaN(this.lastEye.x) !== Number.isNaN(eye.x) || eye.distanceTo(this.lastEye) > 3;
        if (this.dirty || (moved && now - this.lastWrite > 200)) {
            this.lastEye.copy(eye);
            this.lastWrite = now;
            this.dirty = false;
            this.writeParked(eye);
        }
        this.writeMoving(clock, epochSeconds, eye);
    }

    private distance(eye: Vector3, x: number, y: number, z: number): number {
        if (Number.isNaN(eye.x)) return 60;
        return Math.hypot(eye.x - x, eye.y - y, eye.z - z);
    }

    private writeParked(eye: Vector3) {
        this.parked.forEach((set) => set.begin());
        for (const p of this.now.parked) {
            if (this.drawn && !this.drawn(this.spotChunk[p.spot])) continue;
            const spot = this.spots[p.spot];
            const y = this.yAt(spot.x, spot.z);
            const level = this.levelFor(this.distance(eye, spot.x, y, spot.z));
            if (!level) continue;
            this.parked.get(`${p.kind}:${level}`)?.push(place(spot.x, y, spot.z, spot.turn), p.paint);
        }
        this.parked.forEach((set) => set.end());
        for (const set of this.bikeSets) set.begin();
        if (this.bikeSets.length) {
            const near = VEHICLE_TIERS[this.tier].bikes;
            for (const i of this.now.bikes) {
                const b = this.bikes[i];
                if (this.drawn && !this.drawn(townChunkOf(b.x, b.z))) continue;
                const y = townHeight(b.x, b.z) + 0.15;
                const d = this.distance(eye, b.x, y, b.z);
                if (d > near) continue;
                this.colour.set(carPaint(chance(b.id, "frame")));
                this.bikeSets[d < near * 0.4 ? 0 : 1].push(place(b.x, y, b.z, b.turn, b.lean), this.colour);
            }
        }
        for (const set of this.bikeSets) set.end();
    }

    private writeMoving(clock: TownClock, epochSeconds: number, eye: Vector3) {
        this.moving.forEach((set) => set.begin());
        const cars = this.sim.at_(epochSeconds, this.budgetMs);
        this.movingNow = cars;
        if (cars) {
            const kinds = VEHICLE_TIERS[this.tier].kinds;
            for (const car of cars) {
                if (!car.active) continue;
                if (this.drawn && !this.drawn(townChunkOf(car.x, car.z))) continue;
                const spec = this.sim.traffic.cars[car.index];
                const kind = carKind(chance("traffic", car.index, spec.loop, "kind"), kinds);
                this.colour.set(carPaint(chance("traffic", car.index, "paint")));
                const y = this.yAt(car.x, car.z);
                const level = this.levelFor(this.distance(eye, car.x, y, car.z));
                if (!level) continue;
                this.moving.get(`${kind}:${level}`)?.push(place(car.x, y, car.z, Math.atan2(car.dx, car.dz)), this.colour, carLights(clock.hours, car.braking));
            }
        }
        this.moving.forEach((set) => set.end());
    }

    /** The moving cars as last worked out (null while waiting for the animals' poses). */
    movingCars(): MovingCar[] | null {
        return this.movingNow;
    }

    stats(): {parked: number; moving: number; bikes: number; drawCalls: number; byLevel: Record<string, number>} {
        const byLevel: Record<string, number> = {};
        let drawCalls = 0;
        let parked = 0;
        let moving = 0;
        this.parked.forEach((set, key) => {
            const level = key.split(":")[1];
            byLevel[level] = (byLevel[level] ?? 0) + set.count;
            parked += set.count;
            if (set.count) drawCalls++;
        });
        this.moving.forEach((set) => {
            moving += set.count;
            if (set.count) drawCalls++;
        });
        let bikes = 0;
        for (const set of this.bikeSets) {
            bikes += set.count;
            if (set.count) drawCalls++;
        }
        return {parked, moving, bikes, drawCalls, byLevel};
    }

    dispose() {
        for (const set of [...Array.from(this.parked.values()), ...Array.from(this.moving.values()), ...this.bikeSets]) set.dispose();
        for (const g of this.geometries) g.dispose();
        this.parkedMaterial.dispose();
        this.movingMaterial.dispose();
    }
}

export type {Box, Poly};
