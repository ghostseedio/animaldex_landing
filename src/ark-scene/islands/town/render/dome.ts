/**
 * p5 (zoospace): the free-flight dome's building (`dome.ts`), drawn with the town's scenery so it stands as a landmark
 * whether or not its birds are in view:
 *
 * - **The drum**: a low concrete plinth and a ring of steel posts to the ring beam, fine netting between them.
 * - **The cap**: a geodesic lattice (`domeLattice`): rings of nodes on the cap's sphere, fewer towards the crown, each
 *   ring zipped to the next in triangles; a pale steel tube on every edge, the netting on every triangle (the net
 *   channel's fine aviary netting: wires drawn at their real size close up, a faint veil far away, one material).
 * - **The lobby**: the visitors' double doors on the east side at the end of the zoo's middle path, a netted porch
 *   between an outer and an inner door.
 * - **Inside**: the paths' paving, the raised boardwalk over the lagoon's end, the lagoon's sheet (the town's fresh
 *   water: still, reflecting), path lamps (the town's own lamps: lit softly at night).
 *
 * The planting, the cliff and its waterfall, the snags, the nest ledges and the feeding stations are the enclosure's
 * dressing (`zoo-habitat.ts` dressPaddock, "dome"), with its colliders.
 */
import {hashText, polylineAt, polylineLength, type Poly} from "@/ark-scene/islands/town/geom";
import {alongZ, SURF, tagged} from "@/ark-scene/islands/town/render/surface-tags";
import {safariWaterLevel, townHeight} from "@/ark-scene/islands/town/ground";
import {Geo, tone, type Frame, type V3} from "@/ark-scene/islands/town/render/kit";
import {NET_FINE, strut} from "@/ark-scene/islands/town/render/zoo-barriers";
import {DOME, DOME_BOARDWALK, DOME_BOARDWALK_HEIGHT, DOME_LAGOON, DOME_LOBBY, DOME_PATH_WIDTH, DOME_PATHS, domeShell, lagoonNorm} from "@/ark-scene/islands/town/dome";
import {ellipse} from "@/ark-scene/islands/town/geom";

type RGB = [number, number, number];
type Chunk = {solid: Geo; decal: Geo; net: Geo};
type Chunks = (x: number, z: number) => Chunk;

const H = (x: number, z: number) => townHeight(x, z);
const STEEL = tone("#d2d8d6");
const STEEL_DARK = tone("#9aa3a1");
const NETTING = tone("#4a5053");
const PLINTH = tone("#b9b2a3");
const TIMBER = tone("#7a5a3e");
const TIMBER_DARK = tone("#5e4632");
const DECKING = tone("#8a6a48");
const DOOR = tone("#2f4a38");
const PATH = tone("#b9a47c");

/** The drum's posts round the rim (the east two stand either side of the lobby's inner door). */
export const DOME_POSTS = 36;
/** The cap's rings from the rim up: how many nodes each has (the crown is one more node). */
export const DOME_RINGS = [36, 36, 30, 24, 24, 18, 12, 6] as const;

export type DomeLattice = {nodes: V3[]; /** Pairs of node indices: every tube. */ edges: Array<[number, number]>; /** Triples: every netted cell. */ cells: Array<[number, number, number]>; rings: number[][]};

/**
 * The cap's lattice over the dome's floor level `floor` (pure: the drawing and the tests): ring j at an equal step of
 * arc up the cap's sphere from the rim, its nodes evenly round it (each ring turned half a bay from the one below), the
 * crown one node; each ring's edges, and between neighbouring rings a zip of triangles (the nearer next node each time).
 */
export function domeLattice(floor: number): DomeLattice {
    const capR = (DOME.r * DOME.r + DOME.rise * DOME.rise) / (2 * DOME.rise);
    const theta0 = Math.asin(DOME.r / capR);
    const nodes: V3[] = [];
    const rings: number[][] = [];
    DOME_RINGS.forEach((n, j) => {
        const theta = theta0 * (1 - j / DOME_RINGS.length);
        const rho = capR * Math.sin(theta);
        const ring: number[] = [];
        for (let i = 0; i < n; i++) {
            // (The whole lattice turned half a rim bay: a bay, not a post, faces east, the lobby's inner door.)
            const a = ((i + (j % 2) * 0.5) / n) * Math.PI * 2 + Math.PI / DOME_RINGS[0];
            ring.push(nodes.length);
            nodes.push([DOME.x + Math.cos(a) * rho, floor + domeShell(rho), DOME.z + Math.sin(a) * rho]);
        }
        rings.push(ring);
    });
    const crown = nodes.length;
    nodes.push([DOME.x, floor + domeShell(0), DOME.z]);
    const edges: Array<[number, number]> = [];
    const cells: Array<[number, number, number]> = [];
    for (const ring of rings) for (let i = 0; i < ring.length; i++) edges.push([ring[i], ring[(i + 1) % ring.length]]);
    for (let j = 0; j + 1 < rings.length; j++) {
        const low = rings[j];
        const high = rings[j + 1];
        // Zip round from the pair nearest each other: each step takes the shorter new tube (the next node of the lower
        // ring to this upper one, or the next of the upper to this lower), until both rings are closed.
        const dist = (p: number, q: number) => Math.hypot(nodes[p][0] - nodes[q][0], nodes[p][1] - nodes[q][1], nodes[p][2] - nodes[q][2]);
        let k0 = 0;
        for (let q = 1; q < high.length; q++) if (dist(low[0], high[q]) < dist(low[0], high[k0])) k0 = q;
        const L = (n: number) => low[n % low.length];
        const U = (n: number) => high[(k0 + n) % high.length];
        let i = 0;
        let k = 0;
        edges.push([L(0), U(0)]);
        while (i < low.length || k < high.length) {
            const stepLow = i < low.length ? dist(L(i + 1), U(k)) : Infinity;
            const stepHigh = k < high.length ? dist(U(k + 1), L(i)) : Infinity;
            if (stepLow <= stepHigh) {
                cells.push([L(i), L(i + 1), U(k)]);
                i++;
            } else {
                cells.push([L(i), U(k + 1), U(k)]);
                k++;
            }
            if (i < low.length || k < high.length) edges.push([L(i), U(k)]);
        }
    }
    const top = rings[rings.length - 1];
    for (let i = 0; i < top.length; i++) {
        edges.push([top[i], crown]);
        cells.push([top[i], top[(i + 1) % top.length], crown]);
    }
    return {nodes, edges, cells, rings};
}

function shade(c: RGB, k: number): RGB {
    return [c[0] * k, c[1] * k, c[2] * k];
}

/** The dome's building into the town's chunks, its lagoon into the fresh water, its path lamps into the town's lamps. */
export function domeScenery(chunkAt: Chunks, fresh: Geo, lamps: Array<{x: number; y: number; z: number}>) {
    const floor = H(DOME.x, DOME.z);
    const lattice = domeLattice(floor);
    const mid = (a: V3, b: V3): V3 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    // The cap: a tube on every edge (stouter on the rings), the netting on every cell.
    const ringEdges = lattice.rings.reduce((t, r) => t + r.length, 0);
    lattice.edges.forEach(([i, j], n) => {
        const a = lattice.nodes[i];
        const b = lattice.nodes[j];
        const m = mid(a, b);
        strut(chunkAt(m[0], m[2]).solid, a, b, n < ringEdges ? 0.2 : 0.15, n < ringEdges ? STEEL : shade(STEEL, 0.94));
    });
    for (const [i, j, k] of lattice.cells) {
        const a = lattice.nodes[i];
        const b = lattice.nodes[j];
        const c = lattice.nodes[k];
        const net = chunkAt((a[0] + b[0] + c[0]) / 3, (a[2] + b[2] + c[2]) / 3).net;
        net.tag = NET_FINE;
        // (Just inside the tubes, so the frame is over the netting from outside.)
        const inwards = (p: V3): V3 => [p[0] + (DOME.x - p[0]) * 0.004, p[1] - 0.06, p[2] + (DOME.z - p[2]) * 0.004];
        net.tri(inwards(a), inwards(b), inwards(c), NETTING);
        net.tag = 0;
    }
    // The drum: posts from the ground to the cap's rim (each under a rim node), the plinth, the netting between them;
    // the bay facing east is the lobby's inner door.
    const rim = lattice.rings[0].map((i) => lattice.nodes[i]);
    for (let i = 0; i < rim.length; i++) {
        const top = rim[i];
        const next = rim[(i + 1) % rim.length];
        const c = chunkAt(top[0], top[2]);
        const foot: V3 = [top[0], H(top[0], top[2]) - 0.3, top[2]];
        strut(c.solid, foot, top, 0.26, STEEL_DARK);
        const nextFoot: V3 = [next[0], H(next[0], next[2]) - 0.3, next[2]];
        const m = mid(top, next);
        const door = Math.abs(m[2] - DOME.z) < 1 && m[0] > DOME.x;
        const cm = chunkAt(m[0], m[2]);
        if (door) {
            // The inner door's frame and leaves (ajar), netting over it.
            const y = Math.max(foot[1], nextFoot[1]) + 0.3;
            strut(cm.solid, [top[0], y + 2.5, top[2]], [next[0], y + 2.5, next[2]], 0.16, STEEL_DARK);
            cm.net.tag = NET_FINE;
            cm.net.quad([top[0], y + 2.5, top[2]], [next[0], y + 2.5, next[2]], next, top, NETTING);
            cm.net.tag = 0;
            continue;
        }
        const turn = Math.atan2(next[0] - top[0], next[2] - top[2]);
        const seg = Math.hypot(next[0] - top[0], next[2] - top[2]);
        const base = Math.min(foot[1], nextFoot[1]);
        cm.solid.box({x: m[0], y: base, z: m[2], rot: -turn}, 0, 0, 0, 0.34, 0.9 + (Math.max(foot[1], nextFoot[1]) - base), seg + 0.1, PLINTH);
        // A mid rail, the netting from the plinth to the rim.
        const rail = (DOME.drum + 0.6) / 2;
        strut(cm.solid, [top[0], foot[1] + 0.3 + rail, top[2]], [next[0], nextFoot[1] + 0.3 + rail, next[2]], 0.09, STEEL_DARK);
        cm.net.tag = NET_FINE;
        cm.net.quad([top[0], foot[1] + 0.8, top[2]], [next[0], nextFoot[1] + 0.8, next[2]], next, top, NETTING);
        cm.net.tag = 0;
    }
    lobby(chunkAt);
    // Inside: the forest floor (dark earth and moss under the planting, to the drum; the lagoon's banks keep their mud),
    // the paths' paving, the boardwalk, the lagoon's sheet.
    const cell = 3;
    for (let lx = -DOME.r; lx <= DOME.r; lx += cell) {
        for (let lz = -DOME.r; lz <= DOME.r; lz += cell) {
            const x = DOME.x + lx;
            const z = DOME.z + lz;
            if (Math.hypot(lx, lz) > DOME.r - 2.6 || lagoonNorm(x, z) < 1.42) continue;
            const k = hashText(`dome-floor:${lx}:${lz}`) % 5;
            const colour = tone(["#4f5a34", "#56603a", "#4a5230", "#5a5a3a", "#525c36"][k]);
            const c = chunkAt(x, z);
            tagged(c.decal, SURF.earth, alongZ(0), () => c.decal.drape({x, y: 0, z, rot: 0}, cell + 0.04, cell + 0.04, H, 0.07, () => colour, 1));
        }
    }
    for (const line of DOME_PATHS) pave(chunkAt, line, DOME_PATH_WIDTH);
    boardwalk(chunkAt, DOME_BOARDWALK, DOME_BOARDWALK_HEIGHT);
    const level = safariWaterLevel(DOME_LAGOON);
    const poly = ellipse(DOME_LAGOON.x, DOME_LAGOON.z, DOME_LAGOON.rx * 1.02, DOME_LAGOON.rz * 1.02, 36, DOME_LAGOON.rot);
    for (let i = 0; i < poly.length; i++) {
        const p = poly[i];
        const q = poly[(i + 1) % poly.length];
        fresh.tri([DOME_LAGOON.x, level, DOME_LAGOON.z], [q.x, level, q.z], [p.x, level, p.z], tone("#000000"));
    }
    // Path lamps (the town's own: their glow and their light on the ground at night), and one each side of the outer door.
    for (const [line, every] of [[DOME_PATHS[0], 11], [DOME_BOARDWALK, 13]] as Array<[Poly, number]>) {
        const length = polylineLength(line);
        for (let a = 5; a < length - 2; a += every) {
            const {point, dir} = polylineAt(line, a);
            const side = Math.floor(a / every) % 2 ? 1 : -1;
            const x = point.x - dir.z * side * (DOME_PATH_WIDTH / 2 + 0.5);
            const z = point.z + dir.x * side * (DOME_PATH_WIDTH / 2 + 0.5);
            lamps.push({x, y: H(x, z), z});
        }
    }
    for (const side of [-1, 1]) {
        const x = DOME_LOBBY.x + DOME_LOBBY.w / 2 + 1.2;
        const z = DOME_LOBBY.z + side * (DOME_LOBBY.d / 2 + 1.2);
        lamps.push({x, y: H(x, z), z});
    }
}

/** The double-door lobby: a steel frame and netting, an outer door on its east end, a board over it. */
function lobby(chunkAt: Chunks) {
    const b = DOME_LOBBY;
    const c = chunkAt(b.x, b.z);
    const y = H(b.x, b.z);
    const f: Frame = {x: b.x, y, z: b.z, rot: 0};
    const h = 2.9;
    const hw = b.w / 2;
    const hd = b.d / 2;
    const P = (lx: number, ly: number, lz: number): V3 => [b.x + lx, y + ly, b.z + lz];
    for (const lx of [-hw, 0, hw]) for (const lz of [-hd, hd]) strut(c.solid, P(lx, -0.3, lz), P(lx, h, lz), 0.16, STEEL_DARK);
    for (const lz of [-hd, hd]) {
        strut(c.solid, P(-hw, h, lz), P(hw, h, lz), 0.14, STEEL_DARK);
        c.solid.box(f, 0, 0, lz, b.w, 0.5, 0.2, PLINTH);
        c.net.tag = NET_FINE;
        c.net.quad(P(-hw, 0.5, lz), P(hw, 0.5, lz), P(hw, h, lz), P(-hw, h, lz), NETTING);
        c.net.tag = 0;
    }
    for (const lx of [-hw, 0, hw]) strut(c.solid, P(lx, h, -hd), P(lx, h, hd), 0.12, STEEL_DARK);
    c.net.tag = NET_FINE;
    c.net.quad(P(-hw, h, -hd), P(-hw, h, hd), P(hw, h, hd), P(hw, h, -hd), NETTING);
    c.net.tag = 0;
    // The floor, the outer door's frame and leaves (one ajar), the board over it.
    tagged(c.decal, SURF.blocks, alongZ(0), () => c.decal.drape({x: b.x, y: 0, z: b.z, rot: 0}, b.w, b.d - 0.4, H, 0.1, () => PATH, 1));
    for (const lz of [-1.05, 1.05]) c.solid.box(f, hw, 0, lz, 0.16, 2.3, 0.16, DOOR);
    c.solid.box(f, hw, 2.3, 0, 0.16, 0.16, 2.26, DOOR);
    c.solid.box({x: b.x + hw + 0.45, y, z: b.z - 0.62, rot: 0.9}, 0, 0.05, 0, 0.06, 2.2, 0.98, DOOR);
    c.solid.box(f, hw + 0.03, 0.05, 0.53, 0.06, 2.2, 0.98, DOOR);
    c.solid.box(f, hw + 0.05, 2.6, 0, 0.08, 0.7, 3.4, DOOR);
    c.solid.box(f, hw + 0.1, 2.72, 0, 0.03, 0.42, 2.9, tone("#e2c86a"));
}

/** A path's paving: a strip of compacted gravel along a line, in pieces each in its own chunk. */
function pave(chunkAt: Chunks, line: Poly, width: number) {
    const length = polylineLength(line);
    const n = Math.max(1, Math.round(length / 3));
    for (let i = 0; i < n; i++) {
        const a = polylineAt(line, (i / n) * length).point;
        const b = polylineAt(line, ((i + 1) / n) * length).point;
        const mx = (a.x + b.x) / 2;
        const mz = (a.z + b.z) / 2;
        const turn = Math.atan2(b.x - a.x, b.z - a.z);
        const c = chunkAt(mx, mz);
        tagged(c.decal, SURF.gravel, alongZ(-turn), () => c.decal.drape({x: mx, y: 0, z: mz, rot: -turn}, width, Math.hypot(b.x - a.x, b.z - a.z) + 0.5, H, 0.11, () => (i % 2 ? PATH : shade(PATH, 0.96)), 1));
    }
}

/** The raised boardwalk (as the safari's): posts every 2.4 m, a deck `rise` over the ground, rails, a ramp at each end. */
function boardwalk(chunkAt: Chunks, line: Poly, rise: number) {
    const length = polylineLength(line);
    const n = Math.max(2, Math.round(length / 2.4));
    const top = H(line[0].x, line[0].z) + rise;
    let prev: {l: V3; r: V3; x: number; z: number} | null = null;
    for (let i = 0; i <= n; i++) {
        const {point, dir} = polylineAt(line, (i / n) * length);
        const sx = -dir.z * (DOME_PATH_WIDTH / 2 - 0.1);
        const sz = dir.x * (DOME_PATH_WIDTH / 2 - 0.1);
        const c = chunkAt(point.x, point.z);
        const y = i === 0 || i === n ? H(point.x, point.z) + 0.18 : top;
        for (const s of [-1, 1]) {
            const px = point.x + sx * s;
            const pz = point.z + sz * s;
            strut(c.solid, [px, H(px, pz) - 0.5, pz], [px, y + 1.05, pz], 0.14, TIMBER_DARK);
        }
        const l: V3 = [point.x - sx, y, point.z - sz];
        const r: V3 = [point.x + sx, y, point.z + sz];
        if (prev) {
            // (The deck between this bay and the last, drawn both ways up: a ramp slopes with its ends.)
            c.solid.quad(prev.l, prev.r, r, l, DECKING);
            c.solid.quad(l, r, prev.r, prev.l, DECKING);
            for (const [a, b] of [[prev.l, l], [prev.r, r]] as const) {
                strut(c.solid, [a[0], a[1] - 0.07, a[2]], [b[0], b[1] - 0.07, b[2]], 0.14, TIMBER_DARK);
                strut(c.solid, [a[0], a[1] + 1.0, a[2]], [b[0], b[1] + 1.0, b[2]], 0.09, TIMBER);
                strut(c.solid, [a[0], a[1] + 0.5, a[2]], [b[0], b[1] + 0.5, b[2]], 0.06, TIMBER);
            }
        }
        prev = {l, r, x: point.x, z: point.z};
    }
}
