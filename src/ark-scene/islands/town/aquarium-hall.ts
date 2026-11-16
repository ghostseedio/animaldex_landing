/**
 * The aquarium hall (graphics pass 2, lane AQUA). The owner, 2026-11-16: "the aquariums look basic, can you make them
 * in a mall or massive building with massive tanks of different shapes, make them massive with lots of detail like
 * rocks and artificial water caves where fish hide inside so animals don't appear over crowded, like I'm seeing a whale
 * inside just stuck between 2 glass panels."
 *
 * The cause of the whale: each of the zoo's two aquarium plots (16.7 × 23 m) was its own small house with an ocean
 * tank about 9.5 × 7 m, and the record's whale shark (9 m) took the "long" path in it: up and back along the tank
 * between its two side panes. Now both plots (`aquarium-1`, `aquarium-2`, side by side on the zoo's middle path, the
 * plan's only two aquarium slots) are one glass-roofed hall about 33 × 23 m and 12 m high, and both enclosures'
 * residents share its tanks:
 *
 * - **the open ocean** (19 × 16 m, 7.5 m of water) for the big: the whale shark, the sawfish, the sharks, the turtles,
 *   the dugong (the only kept cetacean; any kept cetacean goes here, the biggest tank: wild whales belong to the sea
 *   lane's open ocean, never this hall), with rockwork, caves and arches along its back and ends;
 * - **the reef wall** (19 × 3.3 m, wide and shallow) along the front glass, coral heads and caves, for the reef fish;
 * - **the jellyfish cylinder** (6.4 m across, 10 m tall), lit from below;
 * - **the river tunnel** (5 × 20 m) over a glass-roofed walkway, the river giants and their rock banks and roots;
 * - **two small tanks**, fresh and reef, for the smallest.
 *
 * Every tank's swimmers loop (a racetrack whose turns fit the body: `hallLoop`) in its swim room, kept out of the
 * rockwork's band, and those that fit a cave spend part of each few minutes inside one, so fewer are seen at once
 * (`hallPose`). Pure: the plan and the shared clock only, the same for every viewer. Layout here; drawing in
 * `render/aquarium-hall.ts`.
 */

import {corners, hashText, local, sub, toLocal, type Box} from "@/ark-scene/islands/town/geom";
import {townHeight} from "@/ark-scene/islands/town/ground";
import {townPlan, type TownPlan} from "@/ark-scene/islands/town/plan";
import type {Tank, TankCave, TankKind} from "@/ark-scene/islands/town/tanks";

/** The two plots the hall stands on (the plan's own aquarium slots, side by side). */
export const HALL_SLOTS: readonly string[] = ["aquarium-1", "aquarium-2"];
/** The hall's walls' height (m over its floor); its glass vault rises over them. */
export const HALL_HEIGHT = 12;
const PORCH = 1.2;
const WALL = 0.3;

/** A hall's frame (the same shape as a zoo house's: `tanks.ts` ZooHouseFrame). */
export type HallFrame = {box: Box; floor: number; height: number; inner: Box};

/** How a hall tank is drawn: its glass box (inner faces), round or square, its sand's top, its glass's top. */
export type HallTank = {
    tank: Tank;
    look: "ocean" | "reef_wall" | "jelly" | "tunnel" | "fresh" | "reef";
    /** The glass's inner box (local frame of the town), and, for the cylinder, its radius about the box's middle. */
    glass: Box;
    radius: number | null;
    /** The sand's (or the tunnel's banks' foot) top, and the glass's top (m). */
    sand: number;
    glassTop: number;
    /** The rockwork's band along a side (tank-local: which side, how deep), where the caves are. */
    bands: Array<{side: "back" | "left" | "right" | "front"; depth: number}>;
};

export type AquariumHall = {frame: HallFrame; tanks: HallTank[]};

const halls = new WeakMap<TownPlan, AquariumHall | null>();

/** Whether a zoo enclosure is drawn in the hall: one of the two aquarium enclosures on its own plan slot. */
export function inAquariumHall(e: {type: string; slot: {id: string; at: Box}}, plan: TownPlan = townPlan()): boolean {
    if (e.type !== "aquarium" || !HALL_SLOTS.includes(e.slot.id)) return false;
    const own = plan.zoo.slots.find((s) => s.id === e.slot.id);
    return Boolean(own && Math.abs(own.at.x - e.slot.at.x) < 1e-6 && Math.abs(own.at.z - e.slot.at.z) < 1e-6) && Boolean(aquariumHall(plan));
}

/** The hall over the plan's two aquarium plots (null if the plan has them apart or turned differently). */
export function aquariumHall(plan: TownPlan = townPlan()): AquariumHall | null {
    if (halls.has(plan)) return halls.get(plan) ?? null;
    const a = plan.zoo.slots.find((s) => s.id === HALL_SLOTS[0])?.at;
    const b = plan.zoo.slots.find((s) => s.id === HALL_SLOTS[1])?.at;
    let hall: AquariumHall | null = null;
    if (a && b && Math.abs(a.rot - b.rot) < 1e-6 && Math.abs(a.d - b.d) < 1e-6) {
        const l = toLocal(a, b.x, b.z);
        // (Side by side along the path: the same depth, a hand's width apart.)
        if (Math.abs(l.z) < 0.05 && Math.abs(Math.abs(l.x) - (a.w + b.w) / 2) < 1.0) {
            const lo = Math.min(-a.w / 2, l.x - b.w / 2);
            const hi = Math.max(a.w / 2, l.x + b.w / 2);
            const mid = local(a, (lo + hi) / 2, 0);
            const box: Box = {x: mid.x, z: mid.z, w: hi - lo - 0.4, d: a.d - 0.4, rot: a.rot};
            let high = townHeight(box.x, box.z);
            for (const c of [...corners(box), ...corners(a), ...corners(b)]) high = Math.max(high, townHeight(c.x, c.z));
            const floor = high + 0.25;
            const inner = sub(box, 0, -PORCH / 2, box.w - WALL * 2, box.d - PORCH - WALL * 2);
            const frame: HallFrame = {box, floor, height: HALL_HEIGHT, inner};
            hall = {frame, tanks: hallTanks(frame)};
        }
    }
    halls.set(plan, hall);
    return hall;
}

/**
 * The tanks, in the hall's inner frame (x across the hall, z from the back wall (−) to the front glass (+)). Each
 * tank's `w`/`d` are its glass's inside; its `swim` room is that less its rockwork's band.
 */
function hallTanks(f: HallFrame): HallTank[] {
    const b = f.inner;
    const W = b.w / 2;
    const D = b.d / 2;
    const out: HallTank[] = [];
    const add = (
        name: string,
        look: HallTank["look"],
        kind: TankKind,
        x0: number,
        x1: number,
        z0: number,
        z1: number,
        sand: number,
        swimFloor: number,
        top: number,
        glassTop: number,
        bands: HallTank["bands"],
        radius: number | null = null
    ) => {
        const p = local(b, (x0 + x1) / 2, (z0 + z1) / 2);
        const w = x1 - x0;
        const d = z1 - z0;
        const glass: Box = {x: p.x, z: p.z, w, d, rot: b.rot};
        // The swim room (tank-local): the glass less 5 cm, less each rockwork band.
        const swim = {x0: -w / 2 + 0.05, x1: w / 2 - 0.05, z0: -d / 2 + 0.05, z1: d / 2 - 0.05};
        for (const band of bands) {
            if (band.side === "back") swim.z0 = -d / 2 + band.depth;
            if (band.side === "front") swim.z1 = d / 2 - band.depth;
            if (band.side === "left") swim.x0 = -w / 2 + band.depth;
            if (band.side === "right") swim.x1 = w / 2 - band.depth;
        }
        if (radius) {
            // (Round: the square inside the circle, less a little.)
            const h = (radius / Math.SQRT2) * 0.96;
            swim.x0 = swim.z0 = -h;
            swim.x1 = swim.z1 = h;
        }
        const tank: Tank = {id: `aquarium-hall:${name}`, kind, form: look, x: p.x, z: p.z, rot: b.rot, w: radius ? radius * 2 : w, d: radius ? radius * 2 : d, floor: f.floor + swimFloor, top: f.floor + top, swim, caves: [], round: radius ?? undefined};
        tank.caves = cavesOf(tank, look, sand + f.floor, bands);
        out.push({tank, look, glass, radius, sand: f.floor + sand, glassTop: f.floor + glassTop, bands});
    };
    // The open ocean: the left of the hall, back wall to front glass, 7.5 m of water; rockwork, caves and arches along the back.
    const oceanX1 = -W + 19.1;
    add("ocean", "ocean", "salt", -W + 0.25, oceanX1, -D + 0.25, D - 0.35, 0.6, 0.6, 8.1, 8.35, [{side: "back", depth: 1.3}]);
    // The river tunnel: down the right side, back to front, its water over a glass-roofed walkway between rock banks.
    add("tunnel", "tunnel", "fresh", W - 5.35, W - 0.25, -D + 0.25, D - 0.35, 0.15, 2.95, 5.4, 5.6, []);
    // Between them: the jellyfish cylinder at the back, the reef in front of it, two small tanks on stands at the front.
    const cx0 = oceanX1 + 0.5;
    const cx1 = W - 5.75;
    const r = Math.min((cx1 - cx0) / 2, 3.2);
    const cmid = (cx0 + cx1) / 2;
    add("jelly", "jelly", "salt", cmid - r, cmid + r, -D + 0.6, -D + 0.6 + 2 * r, 0.5, 0.5, 10.2, 10.4, [], r);
    const rz0 = -D + 0.6 + 2 * r + 1.0;
    add("reef_wall", "reef_wall", "salt", cx0, cx1, rz0, rz0 + 5.4, 0.75, 0.75, 4.6, 4.8, [{side: "back", depth: 1.0}]);
    const sz0 = rz0 + 6.6;
    const half = (cx1 - cx0) / 2;
    add("fresh", "fresh", "fresh", cx0, cx0 + half - 0.2, sz0, sz0 + 2.8, 0.85, 0.85, 2.7, 2.85, [{side: "back", depth: 0.5}]);
    add("reef", "reef", "salt", cx0 + half + 0.2, cx1, sz0, sz0 + 2.8, 0.85, 0.85, 2.7, 2.85, [{side: "back", depth: 0.5}]);
    return out;
}

/**
 * The caves along a tank's rockwork bands: each a hollow under a rock roof between two cheeks, its mouth into the tank.
 * `inside` is where a hiding animal rests (its middle), `r` the hollow's half width, `room` the distance from it to the
 * nearest glass (a body has to fit whichever way it turns).
 */
function cavesOf(t: Tank, look: HallTank["look"], sand: number, bands: HallTank["bands"]): TankCave[] {
    const out: TankCave[] = [];
    const c = Math.cos(t.rot);
    const s = Math.sin(t.rot);
    const hw = t.w / 2;
    const hd = t.d / 2;
    const add = (lx: number, lz: number, r: number, dx: number, dz: number) => {
        const room = Math.min(hw - Math.abs(lx), hd - Math.abs(lz));
        out.push({x: t.x + lx * c - lz * s, z: t.z + lx * s + lz * c, y: sand, r, room, mouth: Math.atan2(dx * c - dz * s, dx * s + dz * c), lx, lz});
    };
    for (const band of bands) {
        const along = band.side === "back" || band.side === "front" ? t.w : t.d;
        const r = look === "ocean" ? 0.85 : look === "reef_wall" ? 0.45 : 0.22;
        const step = look === "ocean" ? 4.2 : look === "reef_wall" ? 2.6 : 1.6;
        const n = Math.max(1, Math.floor((along - 1.2) / step));
        for (let k = 0; k < n; k++) {
            const u = -along / 2 + (along - (n - 1) * step) / 2 + k * step;
            const jitter = ((hashText(`${t.id}|cave|${band.side}|${k}`) % 1000) / 1000 - 0.5) * step * 0.3;
            const depthIn = band.depth * 0.8;
            if (band.side === "back") add(u + jitter, -hd + depthIn, r, 0, 1);
            else if (band.side === "front") add(u + jitter, hd - depthIn, r, 0, -1);
            else if (band.side === "left") add(-hw + depthIn, u + jitter, r, 1, 0);
            else add(hw - depthIn, u + jitter, r, -1, 0);
        }
    }
    return out;
}

/** A hall tank's resident's tank, by its water and size (jellyfish to the cylinder; the big and every cetacean to the ocean). */
export function hallTankOf(slug: string, kind: TankKind, length: number, plan: string | null, tanks: readonly Tank[]): Tank | null {
    const by = (form: string) => tanks.find((t) => t.form === form) ?? null;
    if (/jelly|(^|-)medusa/.test(slug) || plan === "jellyfish") return by("jelly");
    if (plan === "cetacean") return by("ocean");
    if (kind === "salt") {
        if (length >= 0.95 || plan === "turtle" || plan === "ray") return by("ocean");
        if (length <= 0.2) return by("reef");
        return by("reef_wall");
    }
    if (length >= 0.5) return by("tunnel");
    return by("fresh");
}

/** Whether a body (length, width) fits a tank's swim room with room to turn (else it belongs in a bigger one). */
export function fitsSwim(t: Tank, length: number, width: number): boolean {
    const r = t.swim ?? {x0: -t.w / 2, x1: t.w / 2, z0: -t.d / 2, z1: t.d / 2};
    const narrow = Math.min(r.x1 - r.x0, r.z1 - r.z0);
    return Math.hypot(length, width) + 0.1 <= narrow;
}

// MARK: - Swimming in a hall tank

/** A loop's point (tank-local) and heading (unit, tank-local). */
export type LoopAt = {lx: number; lz: number; tx: number; tz: number};

/**
 * A racetrack loop in the swim room whose straight runs and half-circle turns keep the whole body (`length` × `width`,
 * as a box along its heading) inside it, null if the room is too narrow for a turn of at least a third of its length.
 * `u` are its own unit draws (size, offset, direction, start), `pace` m/s.
 */
export function hallLoop(room: {x0: number; x1: number; z0: number; z1: number}, length: number, width: number, u: {size: number; stretch: number; ox: number; oz: number; dir: number; start: number}, pace: number, clock: number, out: LoopAt): LoopAt | null {
    const spanX = room.x1 - room.x0;
    const spanZ = room.z1 - room.z0;
    const alongX = spanX >= spanZ;
    const W = (alongX ? spanX : spanZ) / 2;
    const D = (alongX ? spanZ : spanX) / 2;
    const lh = length / 2;
    const hw = width / 2;
    // The body as a box along the circle's tangent at radius r: its outer corners at hypot(r + hw, lh) from the turn's middle.
    const reach2 = D * D - lh * lh;
    if (reach2 <= 0) return null;
    const rMax = Math.sqrt(reach2) - hw;
    const rMin = Math.max(length * 0.34, 0.06);
    if (rMax < rMin) return null;
    const r = rMin + (rMax - rMin) * (0.45 + 0.55 * u.size);
    const reach = Math.hypot(r + hw, lh);
    const sMax = Math.max(W - reach, 0);
    const s = sMax * (0.25 + 0.75 * u.stretch);
    const ox = (W - reach - s) * (u.ox * 2 - 1);
    const oz = Math.max(D - reach, 0) * (u.oz * 2 - 1);
    const perimeter = 4 * s + 2 * Math.PI * r;
    let along = (u.start * perimeter + pace * clock) % perimeter;
    if (along < 0) along += perimeter;
    if (u.dir < 0.5) along = perimeter - along;
    const sign = u.dir < 0.5 ? -1 : 1;
    let a: number;
    let b: number;
    let ta: number;
    let tb: number;
    const arc = Math.PI * r;
    if (along < 2 * s) {
        a = -s + along;
        b = -r;
        ta = 1;
        tb = 0;
    } else if (along < 2 * s + arc) {
        const th = -Math.PI / 2 + (along - 2 * s) / r;
        a = s + Math.cos(th) * r;
        b = Math.sin(th) * r;
        ta = -Math.sin(th);
        tb = Math.cos(th);
    } else if (along < 4 * s + arc) {
        a = s - (along - 2 * s - arc);
        b = r;
        ta = -1;
        tb = 0;
    } else {
        const th = Math.PI / 2 + (along - 4 * s - arc) / r;
        a = -s + Math.cos(th) * r;
        b = Math.sin(th) * r;
        ta = -Math.sin(th);
        tb = Math.cos(th);
    }
    ta *= sign;
    tb *= sign;
    const cx = (room.x0 + room.x1) / 2;
    const cz = (room.z0 + room.z1) / 2;
    out.lx = cx + (alongX ? a + ox : b + oz);
    out.lz = cz + (alongX ? b + oz : a + ox);
    out.tx = alongX ? ta : tb;
    out.tz = alongX ? tb : ta;
    return out;
}

/** A cave visit's moment: where between its loop and its cave (0 on the loop, 1 deep in the cave), and which way. */
export type CaveVisit = {cave: TankCave; share: number; phase: "in" | "rest" | "out"; t: number; left: number; back: number};

/**
 * Whether a resident is on a cave visit at a clock (s): each one's own cycle of two and a half to five minutes, about
 * two fifths of it hidden in its cave (the owner's "fish hide inside so animals don't appear over crowded"). `left`
 * and `back` are the clocks when it left its loop and when it is back on it.
 */
export function caveVisit(cave: TankCave, units: {period: number; share: number; offset: number}, clock: number): CaveVisit | null {
    const period = 150 + 150 * units.period;
    const hidden = period * (0.3 + 0.2 * units.share);
    let tau = (clock + units.offset * period) % period;
    if (tau < 0) tau += period;
    if (tau >= hidden) return null;
    const left = clock - tau;
    const back = left + hidden;
    const travel = Math.min(9, hidden * 0.2);
    if (tau < travel) return {cave, share: tau / travel, phase: "in", t: tau / travel, left, back};
    if (tau > hidden - travel) return {cave, share: (hidden - tau) / travel, phase: "out", t: 1 - (hidden - tau) / travel, left, back};
    return {cave, share: 1, phase: "rest", t: (tau - travel) / Math.max(hidden - 2 * travel, 1), left, back};
}
