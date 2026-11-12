/**
 * The town island's obstacle footprints for the nav and collisions lane (L5, `behaviour-nav.ts` / `collide/`), in the
 * town's own metres: what stands on the ground and what it lets through. Pure, from the plan; `townObstaclesJSON()`
 * is the file L5 reads (`npx tsx scripts/ark-town-plan.mts --obstacles` writes it).
 *
 * - `building`: a closed footprint (convex, four corners), its floor and its top. Nothing walks through.
 * - `barrier`: a line (hedge, wall, fence, railing, paddock rail, zoo fence, aviary net) with its height and
 *   thickness, and who gets past it: `small` (under a fence, through a hedge or railings), `climber` (over a garden
 *   wall or fence: cats, squirrels, rats, geckos), `flyer` (over anything but a net). A zoo fence or net is `hard`
 *   for the zoo's own residents (they stay in their enclosure; decision 22, plan §5).
 * - `water`: the canal, the millpond, the farm pond, the harbour, the zoo's pools: walkers cross only by `bridges`.
 * - `tree`: a trunk (radius) as drawn (`trees.ts`: the library tree's trunk at its scale, lane GC; a shrub its stems'
 *   clump, `soft`: paths go round it, a body may brush it), the zoo's own trees with their enclosures.
 * - `prop`: a farm's bales, trough or hay shelter (`farm.ts`, lane GC): a closed footprint, its floor and top.
 * - `enclosure`: each zoo enclosure's mask, the hard bound for its residents (placement, behaviour, walk grid,
 *   player control).
 */

import {corners, type Poly, type Pt} from "@/ark-scene/islands/town/geom";
import {townHeight} from "@/ark-scene/islands/town/ground";
import {CANAL, CANAL_LEVEL, CANAL_WIDTH, HARBOUR_BASIN, townPlan, type Hedge, type TownPlan} from "@/ark-scene/islands/town/plan";
import {launchEnclosures, zooLayout} from "@/ark-scene/islands/town/areas";
import {townTrees, townZooTrees, type TownTree} from "@/ark-scene/islands/town/trees";
import {townFarmProps, type FarmPropKind} from "@/ark-scene/islands/town/farm";

export type Passer = "small" | "climber" | "flyer";

export type TownObstacle =
    | {id: string; kind: "building"; poly: Poly; floor: number; top: number}
    | {id: string; kind: "barrier"; line: Poly; height: number; thickness: number; barrier: Hedge["kind"]; passable: Passer[]; hard: boolean}
    | {id: string; kind: "water"; poly: Poly; level: number; fresh: boolean}
    | {id: string; kind: "tree"; x: number; z: number; r: number; soft?: boolean}
    | {id: string; kind: "enclosure"; poly: Poly; type: string; hard: true}
    | {id: string; kind: "prop"; poly: Poly; floor: number; top: number; what: FarmPropKind};

const PASS: Record<Hedge["kind"], {passable: Passer[]; thickness: number; hard: boolean}> = {
    hedge: {passable: ["small", "flyer"], thickness: 0.9, hard: false},
    wall: {passable: ["climber", "flyer"], thickness: 0.3, hard: false},
    fence: {passable: ["small", "climber", "flyer"], thickness: 0.06, hard: false},
    railing: {passable: ["small", "climber", "flyer"], thickness: 0.05, hard: false},
    paddock_rail: {passable: ["small", "flyer"], thickness: 0.14, hard: false},
    picket: {passable: ["small", "flyer"], thickness: 0.06, hard: false},
    zoo_fence: {passable: ["flyer"], thickness: 0.35, hard: true},
    net: {passable: [], thickness: 0.05, hard: true}
};

/** The canal as a water polygon (both banks of its centreline). */
function canalPoly(): Poly {
    const left: Pt[] = [];
    const right: Pt[] = [];
    for (let i = 0; i < CANAL.length; i++) {
        const a = CANAL[Math.max(i - 1, 0)];
        const b = CANAL[Math.min(i + 1, CANAL.length - 1)];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const l = Math.hypot(dx, dz) || 1;
        const nx = -dz / l;
        const nz = dx / l;
        left.push({x: CANAL[i].x + (nx * CANAL_WIDTH) / 2, z: CANAL[i].z + (nz * CANAL_WIDTH) / 2});
        right.push({x: CANAL[i].x - (nx * CANAL_WIDTH) / 2, z: CANAL[i].z - (nz * CANAL_WIDTH) / 2});
    }
    return [...left, ...right.reverse()];
}

/** For the open enclosures (the launch set by default): closed plots are lawn, nothing to stop anyone. */
export function townObstacles(plan: TownPlan = townPlan(), open?: readonly string[]): TownObstacle[] {
    const out: TownObstacle[] = [];
    for (const b of plan.buildings) {
        const poly = corners(b.at);
        let floor = -Infinity;
        for (const c of poly) floor = Math.max(floor, townHeight(c.x, c.z));
        out.push({id: b.id, kind: "building", poly, floor: Math.round((floor + 0.15) * 100) / 100, top: Math.round((floor + 0.15 + b.top) * 100) / 100});
    }
    for (const h of plan.hedges) {
        const p = PASS[h.kind];
        out.push({id: h.id, kind: "barrier", line: h.line, height: h.height, thickness: p.thickness, barrier: h.kind, passable: p.passable, hard: p.hard});
    }
    const layout = zooLayout(open ?? launchEnclosures(), plan);
    for (const e of layout.enclosures) {
        if (e.shared) continue;
        const k = corners(e.slot.at);
        const aviary = e.type === "aviaries";
        const p = PASS[aviary ? "net" : "zoo_fence"];
        out.push({id: `${e.slot.id}-fence`, kind: "barrier", line: [k[0], k[1], k[2], k[3], k[0]], height: aviary ? 8 : e.type === "big_cats" ? 4.5 : 2.6, thickness: p.thickness, barrier: aviary ? "net" : "zoo_fence", passable: p.passable, hard: true});
        out.push({id: e.id, kind: "enclosure", poly: e.mask, type: e.type, hard: true});
        if (e.pool) out.push({id: `${e.slot.id}-pool`, kind: "water", poly: e.pool, level: townHeight(e.slot.at.x, e.slot.at.z) + 0.45, fresh: true});
    }
    out.push({id: "canal", kind: "water", poly: canalPoly(), level: CANAL_LEVEL, fresh: true});
    for (const w of plan.waters) {
        if (w.kind === "fountain") continue;
        out.push({id: w.id, kind: "water", poly: w.kind === "harbour" ? corners(HARBOUR_BASIN) : w.poly, level: w.level, fresh: w.kind !== "harbour"});
    }
    const trunk = (t: TownTree): TownObstacle => (t.low ? {id: `tree-${t.seed}`, kind: "tree", x: t.x, z: t.z, r: Math.max(0.35, t.crown * 0.55), soft: true} : {id: `tree-${t.seed}`, kind: "tree", x: t.x, z: t.z, r: Math.max(t.trunk, 0.12)});
    for (const t of townTrees(plan)) out.push(trunk(t));
    for (const t of townZooTrees(layout, plan)) out.push(trunk(t));
    for (const p of townFarmProps(plan)) {
        const poly = corners(p.at);
        let floor = Infinity;
        for (const c of poly) floor = Math.min(floor, townHeight(c.x, c.z));
        out.push({id: p.id, kind: "prop", poly, floor: Math.round(floor * 100) / 100, top: Math.round((floor + p.top) * 100) / 100, what: p.kind});
    }
    return out;
}

/** The file for L5: the obstacles, the bridges and gates where walkers cross, the island's bounds and units. */
export function townObstaclesJSON(plan: TownPlan = townPlan()): string {
    const round = (v: unknown): unknown => (typeof v === "number" ? Math.round(v * 100) / 100 : Array.isArray(v) ? v.map(round) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, round(x)])) : v);
    const bridges = plan.streets
        .filter((s) => s.kind !== "zoo_path" && s.kind !== "lane" && s.kind !== "track" && s.kind !== "quay")
        .flatMap((s) => {
            const found: Pt[] = [];
            for (let i = 1; i < s.line.length; i++) {
                const a = s.line[i - 1];
                const b = s.line[i];
                for (let t = 0; t <= 1; t += 0.02) {
                    const x = a.x + (b.x - a.x) * t;
                    const z = a.z + (b.z - a.z) * t;
                    if (CANAL.some((c, k) => k > 0 && segDistance(x, z, CANAL[k - 1], c) < 0.6) && !found.some((f) => Math.hypot(f.x - x, f.z - z) < 8)) found.push({x, z});
                }
            }
            return found.map((p) => ({street: s.id, x: p.x, z: p.z, width: s.width + s.pavement * 2}));
        });
    const gates = plan.parcels.filter((p) => p.front).map((p) => ({parcel: p.id, x: p.front!.x + -Math.sin(p.at.rot) * (p.front!.d / 2), z: p.front!.z + Math.cos(p.at.rot) * (p.front!.d / 2)}));
    return JSON.stringify(round({island: "town", units: "m", frame: "town local (x east, z south, y up)", bounds: {half: 237.6}, obstacles: townObstacles(plan), bridges, gates}));
}

function segDistance(x: number, z: number, a: Pt, b: Pt): number {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const l = dx * dx + dz * dz;
    const t = l > 0 ? Math.min(Math.max(((x - a.x) * dx + (z - a.z) * dz) / l, 0), 1) : 0;
    return Math.hypot(x - a.x - dx * t, z - a.z - dz * t);
}
