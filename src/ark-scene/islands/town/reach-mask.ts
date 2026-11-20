/**
 * The town island's connectivity mask (AnimalDex decision 416, "if animals can't reach each other, no mating"; AnimalDex
 * docs/ark/town-reach.md): the town's own layout (ground, canal, ponds, harbour, buildings, walls, hedges, fences, the
 * zoo's fences, the canal's bridges) as one byte a cell, in the format of the wild atlas's mask (`positions.ts`
 * AtlasIsland.mask: x0, z0, cell, nx, nz and one byte a cell with the medium in its low two bits: 0 land, 1 fresh
 * water, 2 shallow sea, 3 deep sea) with four flags more in the bits above the medium (read only by `reach.ts`, which the
 * wild island's mask never sets):
 *
 *   bit 2 (4)  BAR    something stands on this land cell that a body on the ground cannot just walk across: a building's
 *                     outline (its walls; the cells inside it are land again, its roof: a body placed on a roof is in a
 *                     part of its own), or a barrier line (`obstacles.ts`: hedge, wall, fence, railing, picket, paddock
 *                     rail, zoo fence, net, dry-stone wall, poultry net, pig wire). Water cells ignore it.
 *   bit 3 (8)  SMALL  ... but a small body gets through it (the barrier's `passable` has `small`: under a fence, through a
 *                     hedge or railings)
 *   bit 4 (16) CLIMB  ... but a climbing body gets over it (`passable` has `climber`: over a garden wall or fence, up a
 *                     building's wall and over its roof)
 *   bit 5 (32) DECK   a bridge's deck or a breakwater's walkway over this water cell: a body on the ground walks across it
 *                     (the water under it is still water for a swimmer)
 *
 * A cell with several barriers lets a body through only when every one does (SMALL and CLIMB are the AND). A building's
 * wall lets a climber through, never a walker or a small one. Each front garden's gate (`townGates`) is a gap in whatever
 * stands there. The zoo's fences are all in (every plot), so the mask does not change as the server opens the next one.
 *
 * Everything is a pure function of the town's plan, ground and obstacle footprints, so the mask is exactly the town the page
 * draws; `scripts/ark-town-reach.mts` writes it, `src/lib/ark-town-reach.test.ts` checks it against the drawn town (the plan,
 * the ground, the scene's colliders, the gates, the bridges and the breakwaters).
 */

import {bridgeAt} from "@/ark-scene/islands/town/canal-bridges";
import {inBox, inPoly, segmentDistance, type Poly} from "@/ark-scene/islands/town/geom";
import {sampleTownGround} from "@/ark-scene/islands/town/ground";
import {townGates, townObstacles, type TownObstacle} from "@/ark-scene/islands/town/obstacles";
import {BREAKWATER_TOP, HARBOUR_ARMS, HARBOUR_BASIN, TOWN_HALF, townPlan} from "@/ark-scene/islands/town/plan";

export const REACH_CELL = 1;
export const BAR = 4;
export const SMALL = 8;
export const CLIMB = 16;
export const DECK = 32;

export type TownReachMask = {x0: number; z0: number; cell: number; nx: number; nz: number; data: Uint8Array};

/** A front garden's gate leaves a gap this wide about its middle (m): whatever stands in it, a body walks through. */
export const GATE_CLEAR = 1.0;

/** A sea cell is shallow under 1.5 m (the wild atlas's rule), else deep. */
const SHALLOW = 1.5;

/** Every plot of the zoo (all open: the mask must not change as the server opens the next one). */
function zooNames(): string[] {
    return townPlan().zoo.slots.map((s) => s.id);
}

/** A cell of the mask holding (x, z). */
export function cellOf(mask: Pick<TownReachMask, "x0" | "z0" | "cell" | "nx" | "nz">, x: number, z: number): number {
    const i = Math.floor((x - mask.x0) / mask.cell);
    const j = Math.floor((z - mask.z0) / mask.cell);
    return i < 0 || j < 0 || i >= mask.nx || j >= mask.nz ? -1 : j * mask.nx + i;
}

/** Marks a barrier on one cell: kept only as far as every barrier there lets a small / a climbing body through. */
function mark(data: Uint8Array, c: number, small: boolean, climb: boolean): void {
    const v = data[c];
    if (!(v & BAR)) {
        data[c] = v | BAR | (small ? SMALL : 0) | (climb ? CLIMB : 0);
        return;
    }
    data[c] = (v & ~(SMALL | CLIMB)) | (small ? v & SMALL : 0) | (climb ? v & CLIMB : 0);
}

/** An 8-connected line of cells from a to b (Bresenham): it parts the plane for a body that steps to its four side neighbours. */
function line(mask: TownReachMask, ax: number, az: number, bx: number, bz: number, fn: (c: number) => void): void {
    let i0 = Math.floor((ax - mask.x0) / mask.cell);
    let j0 = Math.floor((az - mask.z0) / mask.cell);
    const i1 = Math.floor((bx - mask.x0) / mask.cell);
    const j1 = Math.floor((bz - mask.z0) / mask.cell);
    const di = Math.abs(i1 - i0);
    const dj = -Math.abs(j1 - j0);
    const si = i0 < i1 ? 1 : -1;
    const sj = j0 < j1 ? 1 : -1;
    let err = di + dj;
    for (;;) {
        if (i0 >= 0 && j0 >= 0 && i0 < mask.nx && j0 < mask.nz) fn(j0 * mask.nx + i0);
        if (i0 === i1 && j0 === j1) break;
        const e2 = 2 * err;
        if (e2 >= dj) {
            err += dj;
            i0 += si;
        }
        if (e2 <= di) {
            err += di;
            j0 += sj;
        }
    }
}

/** The cells inside a polygon, and its outline. */
function fillPoly(mask: TownReachMask, poly: Poly, fn: (c: number) => void): void {
    let x0 = Infinity;
    let x1 = -Infinity;
    let z0 = Infinity;
    let z1 = -Infinity;
    for (const p of poly) {
        x0 = Math.min(x0, p.x);
        x1 = Math.max(x1, p.x);
        z0 = Math.min(z0, p.z);
        z1 = Math.max(z1, p.z);
    }
    const i0 = Math.max(0, Math.floor((x0 - mask.x0) / mask.cell));
    const i1 = Math.min(mask.nx - 1, Math.floor((x1 - mask.x0) / mask.cell));
    const j0 = Math.max(0, Math.floor((z0 - mask.z0) / mask.cell));
    const j1 = Math.min(mask.nz - 1, Math.floor((z1 - mask.z0) / mask.cell));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (inPoly(poly, mask.x0 + (i + 0.5) * mask.cell, mask.z0 + (j + 0.5) * mask.cell)) fn(j * mask.nx + i);
    // (A thin building or a poly smaller than a cell: its outline still marks cells, so nothing closes by being narrow.)
    for (let k = 0; k < poly.length; k++) {
        const a = poly[k];
        const b = poly[(k + 1) % poly.length];
        line(mask, a.x, a.z, b.x, b.z, fn);
    }
}

/** The town's obstacles that stand on the ground, from the plan (every zoo plot open). */
export function reachObstacles(): TownObstacle[] {
    return townObstacles(townPlan(), zooNames());
}

export function townReachMask(cell = REACH_CELL): TownReachMask {
    const half = Math.ceil(TOWN_HALF / cell) * cell;
    const nx = (2 * half) / cell;
    const mask: TownReachMask = {x0: -half, z0: -half, cell, nx, nz: nx, data: new Uint8Array(nx * nx)};
    const {data} = mask;
    // The medium: the ground's own water (the sea, the canal, the millpond, the farm and country ponds, the harbour's basin,
    // the safari's waterholes).
    for (let j = 0; j < nx; j++) {
        for (let i = 0; i < nx; i++) {
            const x = mask.x0 + (i + 0.5) * cell;
            const z = mask.z0 + (j + 0.5) * cell;
            const g = sampleTownGround(x, z);
            if (g.surface === "sea" || (g.surface === "water" && inBox(HARBOUR_BASIN, x, z, 0))) data[j * nx + i] = -g.height < SHALLOW ? 2 : 3;
            else if (g.surface === "water") data[j * nx + i] = 1;
        }
    }
    const obstacles = reachObstacles();
    // The zoo's raised pools (fresh water above the ground; the ground's own waters and the harbour's salt basin are done above).
    for (const o of obstacles) if (o.kind === "water" && o.fresh) fillPoly(mask, o.poly, (c) => void (data[c] = (data[c] & ~3) | 1));
    // Buildings: land under them (the lighthouse stands in the sea); the outline is the wall (a climber goes up it and over the
    // roof; a walker or a small body never); the cells inside are the roof, land of a part of its own.
    for (const o of obstacles) {
        if (o.kind !== "building") continue;
        fillPoly(mask, o.poly, (c) => void (data[c] &= ~3));
        for (let k = 0; k < o.poly.length; k++) {
            const a = o.poly[k];
            const b = o.poly[(k + 1) % o.poly.length];
            line(mask, a.x, a.z, b.x, b.z, (c) => mark(data, c, false, true));
        }
    }
    // Barriers: a line of cells with who gets through (the town lane's `passable`).
    for (const o of obstacles) {
        if (o.kind !== "barrier") continue;
        const small = o.passable.includes("small");
        const climb = o.passable.includes("climber");
        for (let k = 1; k < o.line.length; k++) line(mask, o.line[k - 1].x, o.line[k - 1].z, o.line[k].x, o.line[k].z, (c) => mark(data, c, small, climb));
    }
    // The front gardens' gates: a gap in whatever fence, wall or hedge stands there.
    for (const g of townGates()) {
        const i0 = Math.floor((g.x - mask.x0) / cell);
        const j0 = Math.floor((g.z - mask.z0) / cell);
        for (let dj = -2; dj <= 2; dj++) {
            for (let di = -2; di <= 2; di++) {
                const i = i0 + di;
                const j = j0 + dj;
                if (i < 0 || j < 0 || i >= nx || j >= nx) continue;
                const cx = mask.x0 + (i + 0.5) * cell - g.x;
                const cz = mask.z0 + (j + 0.5) * cell - g.z;
                if ((di === 0 && dj === 0) || cx * cx + cz * cz <= GATE_CLEAR * GATE_CLEAR) data[j * nx + i] &= ~(BAR | SMALL | CLIMB);
            }
        }
    }
    // The breakwaters' walkways (and the lighthouse at the end of the east one): land over the water for a body on the ground.
    for (const [a, e] of HARBOUR_ARMS) {
        for (let j = 0; j < nx; j++) {
            for (let i = 0; i < nx; i++) {
                const c = j * nx + i;
                if ((data[c] & 3) === 0) continue;
                if (segmentDistance(mask.x0 + (i + 0.5) * cell, mask.z0 + (j + 0.5) * cell, a.x, a.z, e.x, e.z) <= BREAKWATER_TOP / 2) data[c] |= DECK;
            }
        }
    }
    // Bridges: the deck over each water cell it covers.
    for (let j = 0; j < nx; j++) {
        for (let i = 0; i < nx; i++) {
            const c = j * nx + i;
            if ((data[c] & 3) === 0) continue;
            const on = bridgeAt(mask.x0 + (i + 0.5) * cell, mask.z0 + (j + 0.5) * cell);
            if (on && Math.abs(on.u) < on.bridge.band) data[c] |= DECK;
        }
    }
    return mask;
}
