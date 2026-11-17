/**
 * The safari park drawn (p4 (safari), `islands/town/safari.ts`), merged into the town's chunk meshes like the rest of
 * its scenery (no new draw calls but the trucks' one):
 *
 * - **The entrance**: the plaza's paving, a timber gate arch with its painted board (an acacia and the sun) over the
 *   road in, the car park's asphalt with its bays, the depot's gravel yard; the gatehouse, kiosks, depot shed, lodge,
 *   toilets and tower are the plan's buildings (`buildings.ts` safariBuilding).
 * - **The habitats' edges**: a herbivore area is held by its ha-ha (the ditch is in the ground, `ground.ts`) and a low
 *   rustic post-and-rail on its lip, no cage; a predator's area by the zoo's own fence (`zoo-barriers.ts`).
 * - **The waters**: each pool and waterhole's sheet at its level (`ground.ts` safariWaterLevel), in the town's fresh
 *   water mesh.
 * - **The visitors' timber**: the raised boardwalk from the lodge to the deck over the river, the viewing decks, an
 *   information board at each habitat.
 * - **The trucks** (`SafariTrucks`): open-sided safari trucks driving the loop by day on the shared clock (pure in
 *   time, the same for every viewer), parked in the depot at night.
 */

import {BufferGeometry, Group, InstancedMesh, Matrix4, Quaternion, Vector3, type Material} from "three";
import {corners, hashText, local, polylineAt, polylineLength, rng, type Box, type Poly, type Pt} from "@/ark-scene/islands/town/geom";
import {safariWaterLevel, townHeight} from "@/ark-scene/islands/town/ground";
import {at, Geo, tone, type Frame, type V3} from "@/ark-scene/islands/town/render/kit";
import {alongZ, SURF, tagged} from "@/ark-scene/islands/town/render/surface-tags";
import {strut, zooBarrier} from "@/ark-scene/islands/town/render/zoo-barriers";
import {SAFARI, SAFARI_AREAS, SAFARI_GATE_ROAD, SAFARI_LOOP, safariWaterPoly, type SafariArea} from "@/ark-scene/islands/town/safari";
import type {ZooEnclosure} from "@/ark-scene/islands/town/areas";

type RGB = [number, number, number];
type Chunk = {solid: Geo; decal: Geo};
type Chunks = (x: number, z: number) => Chunk;

const H = (x: number, z: number) => townHeight(x, z);
const TIMBER = tone("#7a5a3c");
const TIMBER_DARK = tone("#5a4130");
const DECKING = tone("#9a7650");
const SIGN_GREEN = tone("#2f4a38");
const SIGN_GOLD = tone("#e2c86a");

// MARK: - The habitats' edges

/** A herbivore area's low post-and-rail on its ditch's lip (rustic timber, 1.1 m); a predator's, the zoo's fence. */
export function safariBarrier(parts: {solid: Geo; net: Geo}, e: ZooEnclosure, area: SafariArea) {
    if (area.predator) {
        zooBarrier(parts, e);
        return;
    }
    const k = corners(e.slot.at);
    for (let i = 0; i < 4; i++) railAlong(parts.solid, k[i], k[(i + 1) % 4], 0.25, hashText(`${e.id}:rail${i}`));
}

/** A post-and-rail from a to b, set `out` m outside the area (away from its middle), posts every ~3 m. */
function railAlong(geo: Geo, a: Pt, b: Pt, out: number, seed: number) {
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const ux = (b.x - a.x) / len;
    const uz = (b.z - a.z) / len;
    // (Outward: the corners run anticlockwise seen from above in the town's frame, so the outside is to the left.)
    const nx = uz;
    const nz = -ux;
    const n = Math.max(1, Math.round(len / 3));
    const r = rng(seed);
    let prev: [V3, V3] | null = null;
    for (let i = 0; i <= n; i++) {
        const t = i / n;
        const x = a.x + (b.x - a.x) * t + nx * out;
        const z = a.z + (b.z - a.z) * t + nz * out;
        const g = H(x, z);
        const lean = (r() - 0.5) * 0.06;
        strut(geo, [x, g - 0.3, z], [x + lean, g + 1.15, z + lean], 0.13, i % 2 ? TIMBER : TIMBER_DARK);
        const rails: [V3, V3] = [[x, g + 0.5, z], [x, g + 0.98, z]];
        if (prev) for (let k = 0; k < 2; k++) strut(geo, prev[k], rails[k], 0.08, TIMBER);
        prev = rails;
    }
}

// MARK: - The static scenery

/** The safari's paving, gate arch, waters, boardwalk, decks and boards (into the town's chunks and fresh water). */
export function safariScenery(chunkAt: Chunks, fresh: Geo) {
    // The plaza: warm paving; the car park: asphalt, bays, the zoo's walk through it; the depot's yard and the hub: gravel.
    paveBox(chunkAt, SAFARI.plaza, SURF.blocks, tone("#c9b48a"));
    paveBox(chunkAt, SAFARI.carPark, SURF.asphalt, tone("#4c4c4a"));
    carParkLines(chunkAt);
    paveBox(chunkAt, SAFARI.depot, SURF.gravel, tone("#b5a382"));
    paveBox(chunkAt, {x: -74, z: -233, w: 30, d: 12, rot: 0}, SURF.gravel, tone("#c2ae86"));
    paveBox(chunkAt, {x: -70, z: -251.5, w: 22, d: 3.4, rot: 0}, SURF.blocks, tone("#b9a582"));
    gateArch(chunkAt, SAFARI_GATE_ROAD[0], SAFARI_GATE_ROAD[1]);
    // The waters' sheets.
    for (const a of SAFARI_AREAS) {
        for (const w of a.waters) {
            const poly = safariWaterPoly(w, 1.02, 32);
            const level = safariWaterLevel(w);
            for (let i = 0; i < poly.length; i++) {
                const p = poly[i];
                const q = poly[(i + 1) % poly.length];
                fresh.tri([w.x, level, w.z], [q.x, level, q.z], [p.x, level, p.z], tone("#000000"));
            }
        }
        board(chunkAt, a);
    }
    boardwalk(chunkAt, SAFARI.boardwalk, 1.6);
    for (const d of SAFARI.decks) viewingDeck(chunkAt, d);
}

function paveBox(chunkAt: Chunks, b: Box, surface: (typeof SURF)[keyof typeof SURF], colour: RGB) {
    // (In 12 m tiles, each in its own chunk.)
    const nx = Math.max(1, Math.ceil(b.w / 12));
    const nz = Math.max(1, Math.ceil(b.d / 12));
    for (let i = 0; i < nx; i++) {
        for (let j = 0; j < nz; j++) {
            const w = b.w / nx;
            const d = b.d / nz;
            const m = local(b, -b.w / 2 + w * (i + 0.5), -b.d / 2 + d * (j + 0.5));
            const c = chunkAt(m.x, m.z);
            tagged(c.decal, surface, alongZ(b.rot), () => c.decal.drape({x: m.x, y: 0, z: m.z, rot: b.rot}, w, d, H, 0.1, () => colour, 1));
        }
    }
}

/** The car park's bay lines (white paint), two rows facing the walk down its middle. */
function carParkLines(chunkAt: Chunks) {
    const b = SAFARI.carPark;
    const paint = tone("#e8e4d8");
    for (const side of [-1, 1]) {
        for (let k = 0; k <= 9; k++) {
            const z = b.z - b.d / 2 + 1.6 + k * 2.75;
            const x0 = b.x + side * 2.4;
            const x1 = b.x + side * (b.w / 2 - 0.4);
            const c = chunkAt((x0 + x1) / 2, z);
            tagged(c.decal, SURF.paint, false, () => c.decal.ribbon([{x: x0, z}, {x: x1, z}], 0.12, H, 0.13, paint, 2));
        }
    }
}

/** The gate arch over the road in: two log posts, a crossbeam, a painted board (the sun over an acacia). */
function gateArch(chunkAt: Chunks, a: Pt, b: Pt) {
    const dir = Math.atan2(b.z - a.z, b.x - a.x);
    const c = chunkAt(a.x, a.z);
    const f: Frame = {x: a.x, y: H(a.x, a.z), z: a.z, rot: -dir + Math.PI / 2};
    for (const lx of [-3.6, 3.6]) c.solid.cylinder(f, lx, -0.3, 0, 0.32, 0.28, 6.6, TIMBER_DARK, 8);
    c.solid.box(f, 0, 5.6, 0, 8.6, 0.5, 0.55, TIMBER);
    c.solid.box(f, 0, 6.1, 0, 6.2, 1.5, 0.18, SIGN_GREEN);
    // The art: a gold sun, an acacia's flat crown on its trunk in dark green against it.
    c.solid.cylinder({...f, y: f.y + 6.25}, 0, 0, 0.1, 0.55, 0.55, 0.02, SIGN_GOLD, 10);
    const sun = at(f, 1.2, 6.85, 0.12);
    c.solid.blob(sun[0], sun[1], sun[2], 0.42, 0.42, 0.06, SIGN_GOLD, 7, 0);
    c.solid.box(f, -1.0, 6.25, 0.12, 0.12, 0.7, 0.04, tone("#1d2b22"));
    c.solid.box(f, -1.0, 6.9, 0.12, 1.6, 0.18, 0.04, tone("#1d2b22"));
    for (const lx of [-2.6, 2.6]) c.solid.box(f, lx, 6.3, 0.12, 0.12, 1.1, 0.04, SIGN_GOLD);
}

/** An information board at a habitat's front, beside the road: two posts, a sloping panel. */
function board(chunkAt: Chunks, a: SafariArea) {
    const p = local(a.at, -a.at.w / 2 + 3, a.at.d / 2 + 1.5);
    const c = chunkAt(p.x, p.z);
    const f: Frame = {x: p.x, y: H(p.x, p.z), z: p.z, rot: 0};
    for (const lx of [-0.55, 0.55]) c.solid.box(f, lx, -0.2, 0, 0.1, 1.3, 0.1, TIMBER_DARK);
    c.solid.box(f, 0, 1.0, 0, 1.4, 0.75, 0.08, SIGN_GREEN);
    c.solid.box(f, 0, 1.05, 0.05, 1.2, 0.08, 0.02, SIGN_GOLD);
    c.solid.box(f, 0, 1.25, 0.05, 0.5, 0.35, 0.02, tone(a.predator ? "#c7743c" : "#8fb06a"));
}

/** The raised boardwalk: posts every 2.4 m, a 2.2 m deck at `rise` over the ground, rails both sides, steps at the start. */
function boardwalk(chunkAt: Chunks, line: Poly, rise: number) {
    const length = polylineLength(line);
    const n = Math.max(2, Math.round(length / 2.4));
    const top = Math.max(...line.map((p) => H(p.x, p.z))) + rise;
    let prev: {l: V3; r: V3; x: number; z: number} | null = null;
    for (let i = 0; i <= n; i++) {
        const {point, dir} = polylineAt(line, (i / n) * length);
        const sx = -dir.z * 1.1;
        const sz = dir.x * 1.1;
        const c = chunkAt(point.x, point.z);
        const y = i === 0 ? H(point.x, point.z) + 0.2 : top;
        for (const s of [-1, 1]) {
            const px = point.x + sx * s;
            const pz = point.z + sz * s;
            strut(c.solid, [px, H(px, pz) - 0.4, pz], [px, y + 1.05, pz], 0.14, TIMBER_DARK);
        }
        const l: V3 = [point.x - sx, y, point.z - sz];
        const r: V3 = [point.x + sx, y, point.z + sz];
        if (prev) {
            // The deck's planks between this bay and the last (a box along it), the rails at hand height.
            const mx = (prev.x + point.x) / 2;
            const mz = (prev.z + point.z) / 2;
            const seg = Math.hypot(point.x - prev.x, point.z - prev.z);
            const turn = Math.atan2(point.x - prev.x, point.z - prev.z);
            const y0 = (prev.l[1] + y) / 2;
            c.solid.box({x: mx, y: y0 - 0.12, z: mz, rot: -turn}, 0, 0, 0, 2.3, 0.14, seg + 0.05, DECKING);
            for (const [a, b] of [[prev.l, l], [prev.r, r]] as const) {
                strut(c.solid, [a[0], a[1] + 1.0, a[2]], [b[0], b[1] + 1.0, b[2]], 0.09, TIMBER);
                strut(c.solid, [a[0], a[1] + 0.5, a[2]], [b[0], b[1] + 0.5, b[2]], 0.06, TIMBER);
            }
        }
        prev = {l, r, x: point.x, z: point.z};
    }
}

/** A viewing deck: a platform 0.6 m up on posts, a railing on three sides, a bench, facing `turn` (its front, +z). */
function viewingDeck(chunkAt: Chunks, d: {x: number; z: number; turn: number; w: number; d: number}) {
    const c = chunkAt(d.x, d.z);
    let g = -Infinity;
    for (const [lx, lz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) g = Math.max(g, H(d.x + (lx * d.w) / 2, d.z + (lz * d.d) / 2));
    const f: Frame = {x: d.x, y: g + 0.6, z: d.z, rot: d.turn};
    for (const [lx, lz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) c.solid.box(f, (lx * (d.w - 0.3)) / 2, -1.4, (lz * (d.d - 0.3)) / 2, 0.18, 1.4, 0.18, TIMBER_DARK);
    c.solid.box(f, 0, -0.14, 0, d.w, 0.14, d.d, DECKING);
    const rail = (a: [number, number], b: [number, number]) => {
        const pa = at(f, a[0], 0, a[1]);
        const pb = at(f, b[0], 0, b[1]);
        strut(c.solid, [pa[0], pa[1] + 1.0, pa[2]], [pb[0], pb[1] + 1.0, pb[2]], 0.09, TIMBER);
        strut(c.solid, [pa[0], pa[1], pa[2]], [pa[0], pa[1] + 1.0, pa[2]], 0.08, TIMBER);
    };
    const hw = d.w / 2;
    const hd = d.d / 2;
    rail([-hw, hd], [hw, hd]);
    rail([hw, hd], [hw, -hd]);
    rail([-hw, -hd], [-hw, hd]);
    c.solid.box(f, 0, 0, -hd + 0.5, d.w * 0.6, 0.45, 0.4, TIMBER);
}

// MARK: - The trucks

/** How many trucks drive the loop by day, and their pace (m/s, a game drive's crawl) and stop at each deck (s). */
export const SAFARI_TRUCKS = {count: 4, speed: 3.2, open: 8, close: 19.5} as const;

/** The loop's length (m). */
const LOOP_LENGTH = polylineLength(SAFARI_LOOP);

/**
 * A truck now (town frame): pure in the island clock's seconds and the truck's number, the same for every viewer. By
 * day each laps the loop, evenly spaced, slowing to a stop at the decks (every quarter lap for 40 s); at night (and
 * before the park opens) it stands in its bay in the depot. `hours`: the island's hour.
 */
export function safariTruckAt(index: number, seconds: number, hours: number): {x: number; z: number; turn: number; moving: boolean} {
    const open = hours >= SAFARI_TRUCKS.open && hours < SAFARI_TRUCKS.close;
    if (!open) {
        const bay = local(SAFARI.depot, -7 + index * 4.6, -1.6);
        return {x: bay.x, z: bay.z, turn: Math.PI, moving: false};
    }
    // A lap: four legs, each driven then a 40 s stop.
    const leg = LOOP_LENGTH / 4;
    const drive = leg / SAFARI_TRUCKS.speed;
    const lap = (drive + 40) * 4;
    const t = (((seconds + (index * lap) / SAFARI_TRUCKS.count) % lap) + lap) % lap;
    const k = Math.floor(t / (drive + 40));
    const into = t - k * (drive + 40);
    const along = k * leg + Math.min(into, drive) * SAFARI_TRUCKS.speed;
    const {point, dir} = polylineAt(SAFARI_LOOP, along % LOOP_LENGTH);
    // (On the left of the track, as the town drives.)
    return {x: point.x - dir.z * -0.9, z: point.z + dir.x * -0.9, turn: Math.atan2(dir.x, dir.z), moving: into < drive};
}

/** One safari truck (about 6.4 m): a green body, a cab, an open passenger deck with a canopy on posts, four wheels. */
export function safariTruckGeometry(): BufferGeometry {
    const g = new Geo();
    const f: Frame = {x: 0, y: 0, z: 0, rot: 0};
    const body = tone("#4a6a3a");
    const dark = tone("#1e2420");
    const canvas = tone("#d8c9a0");
    // Wheels (chunky, off-road).
    for (const [lx, lz] of [[-1.05, 2.0], [1.05, 2.0], [-1.05, -1.9], [1.05, -1.9]] as const) g.box(f, lx, 0, lz, 0.38, 0.92, 0.92, dark);
    // Chassis and body sides.
    g.box(f, 0, 0.55, 0, 2.2, 0.55, 6.2, body);
    g.box(f, 0, 1.1, 2.3, 2.1, 0.7, 1.4, body);
    // The cab: windscreen frame and roof.
    g.box(f, 0, 1.8, 1.65, 2.1, 0.9, 0.12, tone("#2a3a40"));
    g.box(f, 0, 2.7, 1.2, 2.2, 0.1, 1.1, body);
    // The passenger deck: three bench rows, low sides.
    g.box(f, 0, 1.1, -1.1, 2.15, 0.35, 4.0, body);
    for (const lz of [-2.6, -1.5, -0.4]) g.box(f, 0, 1.3, lz, 1.9, 0.45, 0.5, tone("#6a4a30"));
    // The canopy on six posts.
    for (const lx of [-1.0, 1.0]) for (const lz of [-2.9, -1.1, 0.6]) g.box(f, lx, 1.4, lz, 0.08, 1.35, 0.08, dark);
    g.box(f, 0, 2.75, -1.15, 2.3, 0.08, 4.0, canvas);
    // A spare wheel on the tailgate; headlamps.
    g.box(f, 0, 0.9, -3.15, 0.8, 0.8, 0.25, dark);
    for (const lx of [-0.75, 0.75]) g.box(f, lx, 1.05, 3.02, 0.3, 0.2, 0.06, tone("#f2ecd2"));
    return g.toGeometry();
}

/** The trucks as one instanced mesh, moved on the island clock (`update`). */
export class SafariTrucks {
    readonly mesh: InstancedMesh;
    private readonly m = new Matrix4();
    private readonly q = new Quaternion();
    private readonly p = new Vector3();
    private readonly s = new Vector3(1, 1, 1);
    private readonly up = new Vector3(0, 1, 0);
    constructor(material: Material) {
        this.mesh = new InstancedMesh(safariTruckGeometry(), material, SAFARI_TRUCKS.count);
        this.mesh.name = "town:safari-trucks";
        this.mesh.frustumCulled = false;
    }
    update(seconds: number, hours: number) {
        for (let i = 0; i < SAFARI_TRUCKS.count; i++) {
            const t = safariTruckAt(i, seconds, hours);
            this.p.set(t.x, townHeight(t.x, t.z) + 0.08, t.z);
            this.q.setFromAxisAngle(this.up, t.turn);
            this.m.compose(this.p, this.q, this.s);
            this.mesh.setMatrixAt(i, this.m);
        }
        this.mesh.instanceMatrix.needsUpdate = true;
    }
    group(): Group {
        const g = new Group();
        g.add(this.mesh);
        return g;
    }
    dispose() {
        this.mesh.geometry.dispose();
    }
}
