/**
 * The town's pavements as a graph people walk (p5 (humans); the owner, 2026-11-17: "walking along sidewalks in
 * general"). Built from the plan's own streets: both kerbs of every street with a pavement (a line a stride in from
 * the kerb, clear of the street trees, lamps and bins), the footpaths, the towpaths and the quay; pavements break
 * where another carriageway crosses them and are joined again kerb to kerb at the junction's corners and at the zebra
 * crossings (`render/streets.ts` CROSSINGS). No one walks a carriageway but across it at those.
 *
 * A walk is pure in the shared clock and the person's id: `walkFix` answers where a person is `metres` along a trip
 * (a list of stops) by the graph's all-pairs table, with no state, so every viewer sees the same people at the same
 * places. Positions are in the town's frame.
 */

import {humanUnit, WALK_PACE} from "@/ark-scene/humans/figures";
import {inBox, polylineAt, polylineLength, polylineNearest, polylineWithin, type Pt} from "@/ark-scene/islands/town/geom";
import {sampleTownGround} from "@/ark-scene/islands/town/ground";
import {townPlan, type Street, type TownPlan} from "@/ark-scene/islands/town/plan";
import {solidDistance, townSolids, type TownSolid} from "@/ark-scene/islands/town/solids";
import {bridgeAt} from "@/ark-scene/islands/town/canal-bridges";
import {CROSSINGS} from "@/ark-scene/islands/town/render/streets";

/** How far in from the kerb people walk (m), and how far a walker keeps to their left of that line. */
export const KERB_INSET = 0.8;
export const KEEP_LEFT = 0.28;
/** The samples' spacing along a pavement (m). */
const STEP = 1;
/** The longest kerb-to-kerb crossing at a junction (m): a carriageway and the two insets. */
const CROSS_MAX = 10.5;
/** A walker's room (m): the line keeps this clear of walls, trees, lamps, bins and fences (`KEEP_LEFT` and a body). */
const ROOM = 0.55;

export type PaveKind = "pavement" | "path" | "crossing" | "zebra" | "corner";
/** An edge between two nodes: its line (from `a` to `b`), each point's metres from `a`. */
export type PaveEdge = {a: number; b: number; kind: PaveKind; street: string; line: Pt[]; at: Float32Array; length: number};
export type PaveNode = Pt & {edges: number[]};
export type PavementGraph = {
    nodes: PaveNode[];
    edges: PaveEdge[];
    /** All pairs (n × n): the metres of the shortest walk, and its first edge (-1: none). */
    dist: Float32Array;
    first: Int16Array;
    /** The nodes of the largest connected part (trips start and end on these). */
    main: number[];
};

const DRY: ReadonlyArray<[number, number]> = [[0, 0], [0.45, 0], [-0.45, 0], [0, 0.45], [0, -0.45]];
const CARS: ReadonlySet<Street["kind"]> = new Set<Street["kind"]>(["high", "road", "lane", "track"]);
const WALKS: ReadonlySet<Street["kind"]> = new Set<Street["kind"]>(["path", "towpath", "quay"]);

type Vertex = Pt & {chain: number; links: Array<{to: number; kind: PaveKind}>; street: string; end: boolean};

/** Solids in 8 m cells (the build asks each vertex's clearance once). */
function solidGrid(solids: readonly TownSolid[]) {
    const cell = 8;
    const grid = new Map<string, TownSolid[]>();
    const put = (x: number, z: number, s: TownSolid) => {
        const k = `${Math.floor(x / cell)},${Math.floor(z / cell)}`;
        const list = grid.get(k);
        if (list) list.push(s);
        else grid.set(k, [s]);
    };
    for (const s of solids) {
        // (A solid's reach: its own size; each is put in every cell its bounds touch.)
        const r = s.shape === "circle" ? s.r : s.shape === "box" ? Math.hypot(s.hw, s.hd) : s.r + Math.hypot(s.bx - s.ax, s.bz - s.az) / 2;
        const cx = s.shape === "segment" ? (s.ax + s.bx) / 2 : s.x;
        const cz = s.shape === "segment" ? (s.az + s.bz) / 2 : s.z;
        for (let x = Math.floor((cx - r) / cell); x <= Math.floor((cx + r) / cell); x++) for (let z = Math.floor((cz - r) / cell); z <= Math.floor((cz + r) / cell); z++) put(x * cell, z * cell, s);
    }
    return (x: number, z: number): number => {
        let best = Infinity;
        for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
                const list = grid.get(`${Math.floor(x / cell) + dx},${Math.floor(z / cell) + dz}`);
                if (list) for (const s of list) best = Math.min(best, solidDistance(s, x, z));
            }
        }
        return best;
    };
}

/** Whether a point is somewhere a person may stand: no building, no solid within `gap`, dry ground (or a bridge's deck). */
export type Clear = (x: number, z: number, gap: number) => boolean;

export function townClearance(plan: TownPlan = townPlan()): {clear: Clear; inRoad: (x: number, z: number, margin: number, but?: string) => boolean; /** How many carriageways a point is in. */ roads: (x: number, z: number) => number} {
    const near = solidGrid(townSolids([], plan));
    const roads = plan.streets.filter((s) => CARS.has(s.kind));
    return {
        roads: (x, z) => roads.reduce((count, s) => count + (polylineWithin(s.line, x, z, s.width / 2) ? 1 : 0), 0),
        clear: (x, z, gap) => {
            if (near(x, z) <= gap) return false;
            for (const b of plan.buildings) if (inBox(b.at, x, z, gap)) return false;
            // Dry underfoot, and a step to each side (a quay's edge, a bank): or a bridge's deck.
            for (const [dx, dz] of DRY) {
                if (bridgeAt(x + dx, z + dz)) continue;
                const g = sampleTownGround(x + dx, z + dz);
                if (g.surface === "water" || g.height <= 0.35) return false;
            }
            return true;
        },
        inRoad: (x, z, margin, but) => roads.some((s) => s.id !== but && polylineWithin(s.line, x, z, s.width / 2 + margin))
    };
}

/** The graph, built once for a plan (a few thousand samples; ~100 ms, only when there are people to walk it). */
export function pavementGraph(plan: TownPlan = townPlan()): PavementGraph {
    if (memo && memo.plan === plan) return memo.graph;
    const {clear, inRoad, roads} = townClearance(plan);
    const vertices: Vertex[] = [];
    let chains = 0;
    const link = (a: number, b: number, kind: PaveKind) => {
        if (a === b || vertices[a].links.some((l) => l.to === b)) return;
        vertices[a].links.push({to: b, kind});
        vertices[b].links.push({to: a, kind});
    };
    /** A run of points as chains: consecutive valid points linked, a gap ends the chain. */
    const run = (points: Array<Pt | null>, street: string, kind: PaveKind) => {
        let last = -1;
        for (const p of points) {
            if (!p) {
                if (last >= 0) vertices[last].end = true;
                last = -1;
                continue;
            }
            const v = vertices.length;
            vertices.push({x: p.x, z: p.z, chain: chains, links: [], street, end: last < 0});
            if (last >= 0) link(last, v, kind);
            else chains++;
            last = v;
        }
        if (last >= 0) vertices[last].end = true;
        chains++;
    };
    const sides = new Map<string, number[][]>();
    for (const s of plan.streets) {
        const length = polylineLength(s.line);
        const n = Math.max(1, Math.round(length / STEP));
        if (CARS.has(s.kind) && s.pavement > 0) {
            // Each kerb's line: `KERB_INSET` in from the kerb, cut where another carriageway (and its own inset) crosses,
            // so the two streets' lines meet at the corner.
            // (Round a lamp, a tree or a bin in the line: a little nearer the kerb or further in.)
            const insets = [KERB_INSET, KERB_INSET - 0.25, KERB_INSET + 0.3, KERB_INSET + 0.6].filter((inset) => inset <= s.pavement - 0.3);
            const both: number[][] = [];
            for (const side of [-1, 1]) {
                const from = vertices.length;
                const points: Array<Pt | null> = [];
                for (let i = 0; i <= n; i++) {
                    const {point, dir} = polylineAt(s.line, (i / n) * length);
                    let found: Pt | null = null;
                    for (const inset of insets) {
                        const off = s.width / 2 + inset;
                        const x = point.x - dir.z * off * side;
                        const z = point.z + dir.x * off * side;
                        if (inRoad(x, z, KERB_INSET - 0.05, s.id)) break;
                        if (clear(x, z, ROOM)) {
                            found = {x, z};
                            break;
                        }
                    }
                    points.push(found);
                }
                run(points, s.id, "pavement");
                both.push(Array.from({length: vertices.length - from}, (_, k) => from + k));
            }
            sides.set(s.id, both);
        } else if (WALKS.has(s.kind)) {
            const points: Array<Pt | null> = [];
            for (let i = 0; i <= n; i++) {
                const {point} = polylineAt(s.line, (i / n) * length);
                points.push(!inRoad(point.x, point.z, KERB_INSET - 0.05) && clear(point.x, point.z, ROOM) ? point : null);
            }
            run(points, s.id, "path");
        }
    }
    // The zebra crossings: the two kerbs' nearest points joined.
    for (const c of CROSSINGS) {
        const s = plan.streets.find((q) => q.id === c.street);
        const both = sides.get(c.street);
        if (!s || !both) continue;
        const {point} = polylineAt(s.line, c.at);
        const nearest = (list: number[]) => list.reduce((best, v) => (best < 0 || Math.hypot(vertices[v].x - point.x, vertices[v].z - point.z) < Math.hypot(vertices[best].x - point.x, vertices[best].z - point.z) ? v : best), -1);
        const a = nearest(both[0]);
        const b = nearest(both[1]);
        if (a >= 0 && b >= 0 && Math.hypot(vertices[a].x - vertices[b].x, vertices[a].z - vertices[b].z) < CROSS_MAX) link(a, b, "zebra");
    }
    // The junctions: a chain's end joins the nearest point of each other chain within a kerb-to-kerb crossing (the
    // corner's other pavement, the kerb across the side street, a path's end on a pavement), in a straight line that
    // meets no wall.
    const straight = (a: Pt, b: Pt) => {
        const d = Math.hypot(b.x - a.x, b.z - a.z);
        const steps = Math.max(1, Math.ceil(d / 0.5));
        for (let i = 1; i < steps; i++) if (!clear(a.x + ((b.x - a.x) * i) / steps, a.z + ((b.z - a.z) * i) / steps, 0.25)) return false;
        return true;
    };
    const ends = vertices.map((v, i) => (v.end ? i : -1)).filter((i) => i >= 0);
    for (const e of ends) {
        const ve = vertices[e];
        const best = new Map<number, {v: number; d: number}>();
        for (let v = 0; v < vertices.length; v++) {
            const o = vertices[v];
            if (o.chain === ve.chain) continue;
            const d = Math.hypot(o.x - ve.x, o.z - ve.z);
            if (d > CROSS_MAX) continue;
            const had = best.get(o.chain);
            if (!had || d < had.d) best.set(o.chain, {v, d});
        }
        best.forEach(({v, d}) => {
            const o = vertices[v];
            if (!straight(ve, o)) return;
            // Across one carriageway (kerb to kerb at the junction's mouth), never a junction's diagonal over two.
            let most = 0;
            let any = 0;
            for (let i = 1; i < 8; i++) {
                const c = roads(ve.x + ((o.x - ve.x) * i) / 8, ve.z + ((o.z - ve.z) * i) / 8);
                most = Math.max(most, c);
                any += c ? 1 : 0;
            }
            if (most > 1) return;
            link(e, v, any ? "crossing" : d < 2.5 ? "corner" : "path");
        });
    }
    const graph = contract(vertices);
    memo = {plan, graph};
    return graph;
}
let memo: {plan: TownPlan; graph: PavementGraph} | null = null;

/** The fine vertices as nodes (where the way ends or branches) and edges (the runs between), with the all-pairs table. */
function contract(vertices: Vertex[]): PavementGraph {
    const isNode = vertices.map((v) => v.links.length !== 2 || v.links[0].kind !== v.links[1].kind || (v.links[0].kind !== "pavement" && v.links[0].kind !== "path"));
    const index = new Int32Array(vertices.length).fill(-1);
    const nodes: PaveNode[] = [];
    vertices.forEach((v, i) => {
        if (!isNode[i] || !v.links.length) return;
        index[i] = nodes.length;
        nodes.push({x: v.x, z: v.z, edges: []});
    });
    const edges: PaveEdge[] = [];
    const seen = new Set<string>();
    vertices.forEach((v, i) => {
        if (index[i] < 0) return;
        for (const l of v.links) {
            // Walk the run from this node to the next.
            const line: Pt[] = [{x: v.x, z: v.z}];
            let prev = i;
            let at = l.to;
            for (;;) {
                line.push({x: vertices[at].x, z: vertices[at].z});
                if (index[at] >= 0) break;
                const next = vertices[at].links[0].to === prev ? vertices[at].links[1].to : vertices[at].links[0].to;
                prev = at;
                at = next;
            }
            // (Each run once: by its two ends' first steps, whichever way it is walked.)
            const out = `${i}>${l.to}`;
            const back = `${at}>${prev}`;
            const key = out < back ? out : back;
            if (seen.has(key)) continue;
            seen.add(key);
            const along = new Float32Array(line.length);
            for (let k = 1; k < line.length; k++) along[k] = along[k - 1] + Math.hypot(line[k].x - line[k - 1].x, line[k].z - line[k - 1].z);
            const edge = edges.length;
            edges.push({a: index[i], b: index[at], kind: l.kind, street: v.street, line, at: along, length: along[line.length - 1]});
            nodes[index[i]].edges.push(edge);
            if (at !== i) nodes[index[at]].edges.push(edge);
        }
    });
    // All pairs: Floyd–Warshall over the nodes (a few hundred).
    const n = nodes.length;
    const dist = new Float32Array(n * n).fill(Infinity);
    const first = new Int16Array(n * n).fill(-1);
    for (let i = 0; i < n; i++) dist[i * n + i] = 0;
    edges.forEach((e, k) => {
        if (e.a === e.b) return;
        if (e.length < dist[e.a * n + e.b]) {
            dist[e.a * n + e.b] = dist[e.b * n + e.a] = e.length;
            first[e.a * n + e.b] = first[e.b * n + e.a] = k;
        }
    });
    for (let k = 0; k < n; k++) {
        for (let i = 0; i < n; i++) {
            const ik = dist[i * n + k];
            if (ik === Infinity) continue;
            for (let j = 0; j < n; j++) {
                const d = ik + dist[k * n + j];
                if (d < dist[i * n + j]) {
                    dist[i * n + j] = d;
                    first[i * n + j] = first[i * n + k];
                }
            }
        }
    }
    // The largest connected part.
    let main: number[] = [];
    const done = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
        if (done[i]) continue;
        const part: number[] = [];
        for (let j = 0; j < n; j++) {
            if (dist[i * n + j] < Infinity) {
                part.push(j);
                done[j] = 1;
            }
        }
        if (part.length > main.length) main = part;
    }
    return {nodes, edges, dist, first, main};
}

export type WalkFix = {x: number; z: number; yaw: number; /** Standing at a stop (false: walking). */ paused: boolean; /** The edge walked (its kind). */ kind: PaveKind; /** The trip is over (the person has gone in). */ done: boolean};

/** A point `s` metres from an edge's start `from` (a or b), kept `left` metres to the walker's left. */
function onEdge(e: PaveEdge, fromA: boolean, s: number, left: number, out: WalkFix): void {
    const t = fromA ? s : e.length - s;
    let k = 1;
    while (k < e.line.length - 1 && e.at[k] < t) k++;
    const p = e.line[k - 1];
    const q = e.line[k];
    const span = e.at[k] - e.at[k - 1] || 1;
    const u = Math.min(Math.max((t - e.at[k - 1]) / span, 0), 1);
    let dx = (q.x - p.x) / span;
    let dz = (q.z - p.z) / span;
    if (!fromA) {
        dx = -dx;
        dz = -dz;
    }
    // (Left of the way walked: (dz, -dx) with three's yaw, forward (sin, cos).)
    const side = e.kind === "pavement" || e.kind === "path" ? left : 0;
    out.x = p.x + (q.x - p.x) * u + dz * side;
    out.z = p.z + (q.z - p.z) * u - dx * side;
    out.yaw = Math.atan2(dx, dz);
    out.kind = e.kind;
}

/**
 * Where a walk is `seconds` after it began: from `stops[0]` to each next stop by the shortest way, at `pace` (m/s),
 * standing `pause(k)` seconds at stop k (not the first or the last). After the last stop: `done`.
 */
export function walkFix(graph: PavementGraph, stops: readonly number[], seconds: number, pace: number, pause: (k: number) => number, out: WalkFix): WalkFix {
    const n = graph.nodes.length;
    out.done = false;
    out.paused = false;
    let t = Math.max(seconds, 0);
    for (let k = 0; k + 1 < stops.length; k++) {
        const leg = graph.dist[stops[k] * n + stops[k + 1]];
        if (!(leg < Infinity)) break;
        const time = leg / pace;
        if (t <= time) {
            // On this leg: hop by hop.
            let s = t * pace;
            let at = stops[k];
            for (let guard = 0; guard < 4096 && at !== stops[k + 1]; guard++) {
                const e = graph.edges[graph.first[at * n + stops[k + 1]]];
                const fromA = e.a === at;
                if (s <= e.length) {
                    onEdge(e, fromA, s, KEEP_LEFT, out);
                    return out;
                }
                s -= e.length;
                at = fromA ? e.b : e.a;
            }
            out.x = graph.nodes[at].x;
            out.z = graph.nodes[at].z;
            return out;
        }
        t -= time;
        const wait = k + 2 < stops.length ? pause(k + 1) : 0;
        if (t < wait) {
            // Standing at the stop, as they arrived.
            const e = graph.edges[lastEdge(graph, stops[k], stops[k + 1])];
            onEdge(e, e.b === stops[k + 1], e.length, KEEP_LEFT, out);
            out.paused = true;
            return out;
        }
        t -= wait;
    }
    const last = graph.nodes[stops[stops.length - 1]];
    out.x = last.x;
    out.z = last.z;
    out.done = true;
    return out;
}

/** The last edge of the shortest way from a to b (b's first edge back to a: the table is symmetric). */
function lastEdge(graph: PavementGraph, a: number, b: number): number {
    return graph.first[b * graph.nodes.length + a];
}

/** How long a walk takes (s): its legs at `pace` and its pauses. */
export function walkSeconds(graph: PavementGraph, stops: readonly number[], pace: number, pause: (k: number) => number): number {
    const n = graph.nodes.length;
    let total = 0;
    for (let k = 0; k + 1 < stops.length; k++) {
        total += graph.dist[stops[k] * n + stops[k + 1]] / pace;
        if (k + 2 < stops.length) total += pause(k + 1);
    }
    return total;
}

/** A node of the main part by a key's hash, between `min` and `max` metres' walk from `from` (any when none is). */
export function nodeFor(graph: PavementGraph, key: string, from = -1, min = 0, max = Infinity): number {
    const n = graph.nodes.length;
    const main = graph.main;
    const start = Math.floor(humanUnit(key) * main.length);
    if (from < 0) return main[start];
    for (let i = 0; i < main.length; i++) {
        const node = main[(start + i * 7) % main.length];
        const d = graph.dist[from * n + node];
        if (node !== from && d >= min && d <= max) return node;
    }
    return main[start] === from ? main[(start + 1) % main.length] : main[start];
}

/** The main part's node nearest a point (a home's door, a bench). */
export function nearestNode(graph: PavementGraph, x: number, z: number): number {
    let best = graph.main[0];
    let bestD = Infinity;
    for (const i of graph.main) {
        const d = Math.hypot(graph.nodes[i].x - x, graph.nodes[i].z - z);
        if (d < bestD) {
            bestD = d;
            best = i;
        }
    }
    return best;
}

/** Which street's pavement or path a point is on (for the tests and the probe): the nearest walked line within reach. */
export function onWalkedGround(plan: TownPlan, x: number, z: number): {street: string; kind: "pavement" | "path"} | null {
    for (const s of plan.streets) {
        const near = polylineNearest(s.line, x, z);
        if (CARS.has(s.kind) && s.pavement > 0 && near.distance >= s.width / 2 - 0.02 && near.distance <= s.width / 2 + s.pavement + 0.05) return {street: s.id, kind: "pavement"};
        if (WALKS.has(s.kind) && near.distance <= s.width / 2 + 0.05) return {street: s.id, kind: "path"};
    }
    return null;
}

// MARK: - Who walks when

/** What `TownHumans` knows of a person's day that the walks need (`town-humans.ts` rhythm). */
export type WalkerRhythm = {wake: number; back: number; worker: boolean; /** Humans visible: when an early shift leaves (else after waking, between 8:05 and 9). */ leave?: number; /** Humans visible: a late shift's walks are `night`'s, not the day's commute. */ kind?: string};
export type WalkWhy = "commute" | "stroll" | "errands" | "night";
type Trip = {key: number; start: number; stops: number[]; pauses: number[]; seconds: number};
type Walker = {home: number; work: number; pace: number; leave: number; commute: Trip; back: Trip; stroll: Trip; errands: Trip; night: Trip};

const BLOCK_HOURS = 1.5;
const emptyTrip = (): Trip => ({key: -1, start: 0, stops: [], pauses: [], seconds: 0});

/**
 * The town's people on foot, pure in the clock and the id:
 * - a worker walks to work on a weekday morning and home again at the day's end (the walk ends at `back`);
 * - some evenings, a stroll after dinner: out to somewhere a few hundred metres off and home;
 * - out by day with nowhere else to be ("about"): errands from stop to stop along the pavements, a pause at each,
 *   home before the 90-minute block ends.
 * A walk starts and ends at the person's own door (a node of the graph by their id): before it and after it they are
 * indoors (not drawn here).
 */
export class PavementWalks {
    private walkers = new Map<string, Walker>();
    private graphMemo: PavementGraph | null = null;
    readonly fix: WalkFix = {x: 0, z: 0, yaw: 0, paused: false, kind: "pavement", done: false};
    /** Why the last `at` answered (for the tests). */
    why: WalkWhy = "errands";

    constructor(private readonly plan: TownPlan = townPlan()) {}

    get graph(): PavementGraph {
        return this.graphMemo ?? (this.graphMemo = pavementGraph(this.plan));
    }

    private walker(id: string): Walker {
        let w = this.walkers.get(id);
        if (!w) {
            const g = this.graph;
            const home = nodeFor(g, `${id}#door`);
            w = {home, work: nodeFor(g, `${id}#workplace`, home, 150, 650), pace: WALK_PACE * (0.94 + humanUnit(`${id}#pace`) * 0.16), leave: humanUnit(`${id}#leave`), commute: emptyTrip(), back: emptyTrip(), stroll: emptyTrip(), errands: emptyTrip(), night: emptyTrip()};
            this.walkers.set(id, w);
        }
        return w;
    }

    private trip(t: Trip, key: number, start: number, pace: number): Trip {
        t.key = key;
        t.start = start;
        t.seconds = walkSeconds(this.graph, t.stops, pace, (k) => t.pauses[k] ?? 0);
        return t;
    }

    /**
     * Humans visible (2026-11-18): a night walk (`town-humans.ts` nightOuting), pure in the id and the night's `key`;
     * `hours` and `at` on the night's scale (past 24 after midnight): "owl", a last walk from the door to somewhere
     * 250–600 m off and home, starting at `at`; "late", a late shift's way to work, leaving at `at`; "home", its way
     * home, arriving at `at`.
     */
    night(id: string, kind: "owl" | "late" | "home", key: number, at: number, hours: number): WalkFix | null {
        if (!this.graph.main.length) return null;
        const w = this.walker(id);
        const t = w.night;
        const tag = key * 4 + (kind === "owl" ? 0 : kind === "late" ? 1 : 2);
        if (t.key !== tag) {
            const g = this.graph;
            t.stops = kind === "owl" ? [w.home, nodeFor(g, `${id}#${key}#night#to`, w.home, 250, 600), w.home] : kind === "late" ? [w.home, w.work] : [w.work, w.home];
            t.pauses = kind === "owl" ? [0, 30 + humanUnit(`${id}#${key}#night#look`) * 60] : [];
            this.trip(t, tag, 0, kind === "owl" ? w.pace * 0.85 : w.pace);
            t.start = kind === "home" ? at - t.seconds / 3600 : at;
        }
        const seconds = (hours - t.start) * 3600;
        if (seconds < 0 || seconds >= t.seconds) return null;
        this.why = "night";
        return walkFix(this.graph, t.stops, seconds, kind === "owl" ? w.pace * 0.85 : w.pace, (k) => t.pauses[k] ?? 0, this.fix);
    }

    /** Humans visible: a person's own door on the pavements (town frame), where they step out to at night. */
    door(id: string): {x: number; z: number} | null {
        if (!this.graph.main.length) return null;
        const node = this.graph.nodes[this.walker(id).home];
        return node ? {x: node.x, z: node.z} : null;
    }

    /** Where a person walks now (the town's frame), or null: indoors, at work, or somewhere else. */
    at(id: string, hours: number, day: number, weekday: number, state: "home" | "work" | "out" | "sleep", about: boolean, rhythm: WalkerRhythm): WalkFix | null {
        if (state === "sleep" || !this.graph.main.length) return null;
        const w = this.walker(id);
        const g = this.graph;
        const answer = (t: Trip, why: WalkWhy): WalkFix | null => {
            const seconds = (hours - t.start) * 3600;
            if (seconds < 0 || seconds >= t.seconds) return null;
            this.why = why;
            return walkFix(g, t.stops, seconds, w.pace, (k) => t.pauses[k] ?? 0, this.fix);
        };
        // (`weekday`: 0 is Sunday, `people.ts` weekday: Monday to Friday are 1–5. A late shift's walks are `night`'s.)
        if (rhythm.worker && rhythm.kind !== "late" && weekday >= 1 && weekday <= 5 && (state === "home" || state === "work")) {
            // To work: leaving between a little after waking and nine; home: arriving at `back`.
            if (w.commute.key !== day) {
                w.commute.stops = [w.home, w.work];
                this.trip(w.commute, day, 0, w.pace);
                // (Humans visible: from 7:30, so a few are on their way at eight.)
                w.commute.start = rhythm.leave ?? Math.min(Math.max(7.5 + w.leave * 1.45, rhythm.wake + 0.6), 9);
                w.back.stops = [w.work, w.home];
                this.trip(w.back, day, 0, w.pace);
                w.back.start = rhythm.back - w.back.seconds / 3600;
            }
            const fix = answer(w.commute, "commute") ?? answer(w.back, "commute");
            if (fix) return fix;
        }
        if (state === "home" && hours >= 19.5) {
            if (w.stroll.key !== day) {
                const out = humanUnit(`${id}#${day}#stroll`) < 0.3;
                w.stroll.stops = out ? [w.home, nodeFor(g, `${id}#${day}#stroll#to`, w.home, 180, 480), w.home] : [];
                w.stroll.pauses = [0, 20 + humanUnit(`${id}#${day}#stroll#look`) * 60];
                this.trip(w.stroll, day, 19.6 + humanUnit(`${id}#${day}#stroll#at`) * 0.9, w.pace * 0.85);
            }
            return w.stroll.stops.length ? answer(w.stroll, "stroll") : null;
        }
        if (state === "out" && about) {
            const block = Math.floor(hours / BLOCK_HOURS);
            const key = day * 32 + block;
            if (w.errands.key !== key) {
                // From stop to stop until the block's time is spent, the way home counted in.
                const n = g.nodes.length;
                const start = block * BLOCK_HOURS + 0.02 + humanUnit(`${id}#${key}#errand#at`) * 0.2;
                const budget = ((block + 1) * BLOCK_HOURS - 0.05 - start) * 3600;
                const stops = [w.home];
                const pauses = [0];
                let spent = 0;
                for (let k = 1; k < 28; k++) {
                    const from = stops[stops.length - 1];
                    const to = nodeFor(g, `${id}#${key}#errand#${k}`, from, 70, 380);
                    const pause = 15 + humanUnit(`${id}#${key}#errand#${k}#wait`) * 70;
                    const leg = g.dist[from * n + to] / w.pace + pause;
                    if (spent + leg + g.dist[to * n + w.home] / w.pace > budget) break;
                    stops.push(to);
                    pauses.push(pause);
                    spent += leg;
                }
                stops.push(w.home);
                w.errands.stops = stops;
                w.errands.pauses = pauses;
                this.trip(w.errands, key, start, w.pace);
            }
            return answer(w.errands, "errands");
        }
        return null;
    }
}
