/**
 * Who fells and who plants (owner 2026-11-17; AnimalDex decision 379): a logging's crew of two at the felling front, a
 * planting crew of two on the cleared stand later. They are humans the record has aboard (one per real human capture;
 * no invented people): each logging picks its crew from the aboard humans' ids by a hash of the logging, and the town
 * leaves them out while they are away (`awayInForest`). A pure function of the Ark day, the logging and the ids, so
 * every viewer sees the same people at the same tree.
 *
 * - The feller walks to the next tree the front will reach, then works at its foot (`chop`) on the side away from its
 *   fall; the second stands well back, watching it come down, and walks after.
 * - Planters walk the cleared stand in the front's order and kneel at each spot (`plant`) as its sapling goes in.
 */

import {cutDay, forestUnit, FELL_DAYS, HAUL_DAYS, PLANT_DAYS, PLANT_FROM, plantDay, type Logging} from "@/ark-scene/positions/forestry";
import {fallHeading, saplingSpot} from "@/ark-scene/forestry/forest-state";

export type CrewPoseKind = "stand" | "walk" | "chop" | "plant" | "carry";

/** A crew member at a moment (the host draws it with the town's figures: the same person as in town). */
export type CrewMember = {id: string; x: number; z: number; yaw: number; pose: CrewPoseKind; phase: number; role: "feller" | "spotter" | "planter"};

/** Before the first tree, how long the crew is already there (Ark days): they walk in from the stand's edge. */
const ARRIVE_DAYS = 0.04;
/** After the last, how long they stay (hauling the last logs). */
const LEAVE_DAYS = HAUL_DAYS;
/** How much of the gap between two trees the feller walks (the rest it works at the next tree's foot). */
const WALK_SHARE = 0.3;

/** Two distinct ids of `humans`, picked for logging `k` and its `job` by hash; fewer when fewer are aboard. */
export function crewOf(humans: readonly string[], k: number, job: "fell" | "plant"): string[] {
    if (!humans.length) return [];
    const sorted = [...humans].sort((a, b) => forestUnit(`${job}#${k}#${a}`) - forestUnit(`${job}#${k}#${b}`) || (a < b ? -1 : 1));
    return sorted.slice(0, Math.min(2, sorted.length));
}

/** Whether the crew of logging `g` is at work in the forest at `day` (felling or planting). */
export function crewOnSite(g: Logging, day: number): "fell" | "plant" | null {
    if (day >= g.start - ARRIVE_DAYS && day < g.start + FELL_DAYS + LEAVE_DAYS) return "fell";
    if (day >= g.start + PLANT_FROM - ARRIVE_DAYS && day < g.start + PLANT_FROM + PLANT_DAYS + ARRIVE_DAYS) return "plant";
    return null;
}

/** Whether a human is away in the forest at `day` (the town leaves them out). */
export function awayInForest(loggings: readonly Logging[], humans: readonly string[], id: string, day: number): boolean {
    for (const g of loggings) {
        const job = crewOnSite(g, day);
        if (job && crewOf(humans, g.k, job).includes(id)) return true;
    }
    return false;
}

/** A place of work, its day, and (felling) how far the tree's foot spreads. */
type Spot = {x: number; z: number; at: number; r?: number};

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const yawTo = (fx: number, fz: number, tx: number, tz: number) => Math.atan2(tx - fx, tz - fz);

/** The order of work: each tree's (or sapling's) place and its day, soonest first. */
function workOrder(g: Logging, trees: ReadonlyArray<{x: number; z: number; radius?: number}>, job: "fell" | "plant"): Spot[] {
    const out: Spot[] = trees.map((t) => (job === "fell" ? {x: t.x, z: t.z, at: cutDay(g, t.x, t.z), r: t.radius} : {...saplingSpot(g, t.x, t.z), at: plantDay(g, t.x, t.z)}));
    return out.sort((a, b) => a.at - b.at || a.x - b.x || a.z - b.z);
}

/** Where the work comes in from: the stand's edge on the front's starting side. */
function entry(g: Logging): {x: number; z: number} {
    return {x: g.stand.x + Math.cos(g.bearing) * (g.stand.r + 2), z: g.stand.z + Math.sin(g.bearing) * (g.stand.r + 2)};
}

/** Walk from `from` toward `to` over the first WALK_SHARE of (prevAt, nextAt), then at `to`. */
function along(from: {x: number; z: number}, to: {x: number; z: number}, prevAt: number, nextAt: number, day: number): {x: number; z: number; walking: boolean} {
    const span = Math.max(nextAt - prevAt, 1e-6);
    const k = Math.min(Math.max((day - prevAt) / (span * WALK_SHARE), 0), 1);
    return {x: lerp(from.x, to.x, k), z: lerp(from.z, to.z, k), walking: k > 0 && k < 1};
}

/**
 * The crew of logging `g` at `day` over the stand's trees (their feet), from the aboard humans. Empty when nobody is on
 * site or nobody is aboard.
 */
export function crewAt(g: Logging, trees: ReadonlyArray<{x: number; z: number; radius?: number}>, humans: readonly string[], day: number): CrewMember[] {
    const job = crewOnSite(g, day);
    if (!job || !trees.length) return [];
    const ids = crewOf(humans, g.k, job);
    if (!ids.length) return [];
    const order = workOrder(g, trees, job);
    const gate = entry(g);
    const out: CrewMember[] = [];
    const phase = (id: string) => forestUnit(`phase#${id}`);
    if (job === "fell") {
        // The next tree the front reaches, and the one before (or the edge).
        let i = order.findIndex((s) => s.at > day);
        if (i < 0) i = order.length;
        const prev = i > 0 ? order[i - 1] : {...gate, at: g.start - ARRIVE_DAYS};
        const next = i < order.length ? order[i] : null;
        if (!next) {
            // Done: the crew at the last stump, hauling (one carries, one watches) until they go.
            out.push({id: ids[0], x: prev.x + 1.2, z: prev.z, yaw: yawTo(prev.x + 1.2, prev.z, gate.x, gate.z), pose: "carry", phase: phase(ids[0]), role: "feller"});
        } else {
            // The feller works on the side away from the tree's fall.
            const away = fallHeading(g, next.x, next.z) + Math.PI;
            const off = (next.r ?? 0.4) + 0.7;
            const foot = {x: next.x + Math.cos(away) * off, z: next.z + Math.sin(away) * off};
            const at = along(prev, foot, prev.at, next.at, day);
            out.push({id: ids[0], x: at.x, z: at.z, yaw: at.walking ? yawTo(prev.x, prev.z, foot.x, foot.z) : yawTo(foot.x, foot.z, next.x, next.z), pose: at.walking ? "walk" : "chop", phase: phase(ids[0]), role: "feller"});
        }
        if (ids[1]) {
            // The spotter: well back (two tree lengths would be the rule; the stand's edge on the crew's side here).
            const ref = next ?? prev;
            const k = 0.65;
            const sx = lerp(ref.x, gate.x, k), sz = lerp(ref.z, gate.z, k);
            out.push({id: ids[1], x: sx, z: sz, yaw: yawTo(sx, sz, ref.x, ref.z), pose: "stand", phase: phase(ids[1]), role: "spotter"});
        }
        return out;
    }
    // Planting: the two planters take alternate spots in the front's order.
    ids.forEach((id, n) => {
        const mine = order.filter((_, j) => j % ids.length === n);
        let i = mine.findIndex((s) => s.at > day);
        if (i < 0) i = mine.length;
        const prev = i > 0 ? mine[i - 1] : {...gate, at: g.start + PLANT_FROM - ARRIVE_DAYS};
        const next = i < mine.length ? mine[i] : null;
        if (!next) {
            out.push({id, x: prev.x + 0.8, z: prev.z, yaw: yawTo(prev.x, prev.z, gate.x, gate.z), pose: "walk", phase: phase(id), role: "planter"});
            return;
        }
        // Kneeling beside the sapling, on the side the work came from.
        const dx = prev.x - next.x, dz = prev.z - next.z;
        const d = Math.max(Math.sqrt(dx * dx + dz * dz), 1e-6);
        const spot = {x: next.x + (dx / d) * 0.6, z: next.z + (dz / d) * 0.6};
        const at = along(prev, spot, prev.at, next.at, day);
        out.push({id, x: at.x, z: at.z, yaw: at.walking ? yawTo(prev.x, prev.z, spot.x, spot.z) : yawTo(spot.x, spot.z, next.x, next.z), pose: at.walking ? "walk" : "plant", phase: phase(id), role: "planter"});
    });
    return out;
}
