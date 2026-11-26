/**
 * Lane ZOOSLEEP (2026-11-24, the owner: "elephant enclosure glitching when I get close"): where each resident of a zoo
 * paddock with a keepers' shed lies asleep. Each gets a bed of its own, handed out with all the enclosure's others at
 * once, so it is the same whoever asks first and for every viewer.
 *
 * Before this the schedule picked each one's bed by itself, from three shade points 1.6 m apart and 1.0 m in front of
 * the shed (`sampler.ts`). A mixed enclosure had up to 17 residents on those three points. A nyala and a bongo lay on
 * the same point, and a red deer's bed had its lying body under the shed's eave, so the seat pass pushed it out
 * sideways onto the nyala beside it (`seat/seat.ts` wayOut, which knows no other animal).
 *
 * The beds are in rows in front of the shed. Each lies with its spine pointing into the paddock, its tail clear of
 * the shed and its eave, with a gap of BED_GAP to its neighbours on each side. Each bed is as wide as its own body.
 * A row that has no room left starts another row behind it, one body length plus a gap further out. Residents of one
 * kind are next to each other (sorted by kind, then id), so a herd lies together. A bed must be inside the keep box
 * the bound holds the animal to, and clear of the enclosure's solids, its rocks and bushes (`clear`). A resident left
 * with no such bed gets null, and its schedule picks one as before.
 */

import {local, type Box} from "@/ark-scene/islands/town/geom";
import type {ZooEnclosure} from "@/ark-scene/islands/town/areas";
import {ZOO_TYPES} from "@/ark-scene/islands/town/zoo-types";
import {maskBox, penKeep, type TownPlace} from "@/ark-scene/islands/town/placement";
import {townHeight} from "@/ark-scene/islands/town/ground";
import {behaviourProfile} from "@/ark-scene/behaviour-profile";
import {bodyShape} from "@/ark-scene/collide/bodies";
import {bodyClear, inKeep} from "@/ark-scene/collide/resolve";
import type {ColliderSet} from "@/ark-scene/collide/colliders";
import {sexLook} from "@/ark-scene/behaviour-recipes";

/** The space between two beds side by side, and between rows (m). */
export const BED_GAP = 0.35;
/** How far a bed's tail is kept from the shed's front wall: its eave (0.3 m) and a gap (m). */
const SHED_CLEAR = 0.3 + BED_GAP;
/** How far a bed slides along its row to get clear of a rock or a bush (m). */
const SLIDE = 0.2;

export type BedResident = {
    id: string;
    slug: string;
    /** Its body: half its width, half its spine, its height (`collide/bodies.ts`). */
    radius: number;
    half: number;
    height: number;
    /** How far in from the fence its middle is kept (`zooMargin`, the keep box's margin). */
    margin: number;
};

/** A bed in the town's own frame, and the way it faces as it lies (the schedule's yaw: atan2 of x over z). */
export type ZooBed = {x: number; z: number; heading: number};

/** Whether an enclosure has a keepers' shed (`solids.ts`): the enclosures whose residents get beds here. */
export function hasShed(e: ZooEnclosure): boolean {
    const form = ZOO_TYPES[e.type].form;
    return !e.shared && !e.slot.safari && e.type !== "penguin_seal_pools" && (form === "paddock" || form === "pool");
}

/**
 * Every resident's bed, by id. `clear(x, z, heading, r)`: whether resident `r` lying there that way is clear of the
 * enclosure's solids (town frame). An enclosure with no shed gets no beds.
 */
export function zooBeds(e: ZooEnclosure, residents: readonly BedResident[], clear: (x: number, z: number, heading: number, r: BedResident) => boolean): Map<string, ZooBed> {
    const out = new Map<string, ZooBed>();
    if (!hasShed(e) || !residents.length) return out;
    const s: Box = e.slot.at;
    // (The shed as `solids.ts` places it: at the back, its middle 4 m in from the right side, 1.5 m deep each way.)
    const shedX = s.w / 2 - 4;
    const front = -s.d / 2 + 2.2 + 1.5;
    // (Into the paddock: the slot's own +z, as the schedule's yaw.)
    const o = local(s, 0, 0);
    const ahead = local(s, 0, 1);
    const heading = Math.atan2(ahead.x - o.x, ahead.z - o.z);
    const sorted = residents.slice().sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    // (The row's left end: the row as wide as all of them, centred on the shed, inside the fence.)
    const width = sorted.reduce((n, r) => n + 2 * r.radius + BED_GAP, -BED_GAP);
    const left = -s.w / 2;
    const right = s.w / 2;
    const start = Math.max(left, Math.min(shedX - width / 2, right - width));
    let cursor = start;
    let tail = front + SHED_CLEAR;
    let deepest = 0;
    let rowEmpty = true;
    for (const r of sorted) {
        let placed = false;
        // (Twice at most: this row, then a new one behind it.)
        for (let tries = 0; tries < 2 && !placed; tries++) {
            const reach = r.half + r.radius;
            const lz = tail + reach;
            const fits = lz <= s.d / 2 - r.margin;
            for (let lx = Math.max(cursor + r.radius, left + r.margin); fits && lx + r.radius <= right && lx <= right - r.margin; lx += SLIDE) {
                const p = local(s, lx, lz);
                if (!clear(p.x, p.z, heading, r)) continue;
                out.set(r.id, {x: p.x, z: p.z, heading});
                cursor = lx + r.radius + BED_GAP;
                deepest = Math.max(deepest, 2 * reach);
                rowEmpty = false;
                placed = true;
                break;
            }
            if (!placed && !rowEmpty) {
                tail += deepest + BED_GAP;
                cursor = start;
                deepest = 0;
                rowEmpty = true;
            } else if (!placed) break;
        }
    }
    return out;
}

/**
 * The kinds that lie down on open ground in a paddock, by the shed (their roost by its profile: by ground cover, in
 * the open, or one the paddock has nothing of, a cliff, a cave, water). One that sleeps in a burrow, a den or up a
 * tree keeps its own way to it.
 */
const ON_THE_GROUND: ReadonlySet<string> = new Set(["ground_cover", "open", "cliff", "rocks", "cave", "water", "bottom"]);

/** Whether a kind gets a bed here: it walks, and it sleeps lying on the ground (`ON_THE_GROUND`). */
export function bedsDown(slug: string): boolean {
    const p = behaviourProfile(slug);
    return p.move === "walk" && ON_THE_GROUND.has(p.roost);
}

/**
 * The town's zoo beds, world frame, by id: every enclosure with a shed, for its residents that sleep on the ground
 * outdoors (`zooBeds`). As the scene and the paddock sim both have them: `places` the town's placement
 * (`placeTownAnimals`), `animals` its residents with their drawn lengths, `set` the town's colliders (world frame), the
 * island at `ox`, `oz`. Each body is the schedule's (`behaviour-schedule.ts` bodyOf: its length as its sex draws it).
 */
export function townZooBeds(places: ReadonlyMap<string, TownPlace>, animals: ReadonlyArray<{id: string; model_slug: string; length: number}>, set: ColliderSet | null | undefined, ox: number, oz: number): Map<string, ZooBed> {
    const by = new Map<ZooEnclosure, BedResident[]>();
    for (const a of animals) {
        const info = places.get(a.id);
        const e = info?.enclosure;
        if (!info || info.area !== "zoo" || !e || e.indoor || info.still || info.enclosureMargin === undefined || !hasShed(e)) continue;
        if (!bedsDown(a.model_slug)) continue;
        const shape = bodyShape(a.model_slug, Math.max(a.length, 0.05) * sexLook(a.id, a.model_slug).scale);
        const list = by.get(e) ?? [];
        list.push({id: a.id, slug: a.model_slug, radius: shape.radius, half: shape.half, height: shape.height, margin: info.enclosureMargin});
        by.set(e, list);
    }
    const out = new Map<string, ZooBed>();
    for (const [e, list] of Array.from(by)) {
        const box = maskBox(e.mask);
        const beds = zooBeds(e, list, (x, z, heading, r) => {
            if (!inKeep(penKeep(box, r.margin, ox, oz), x + ox, z + oz)) return false;
            if (!set) return true;
            // (Its lying body with SHED_CLEAR's 0.3 m to spare at each end: an eave, a rock's overhang, the seat's drawn mesh.)
            const shape = {id: r.id, radius: r.radius, half: r.half + 0.3, height: r.height};
            return bodyClear(set, shape, {x: x + ox, y: townHeight(x, z), z: z + oz, yaw: heading, aloft: false, asleep: true}, x + ox, z + oz);
        });
        for (const [id, b] of Array.from(beds)) out.set(id, {x: b.x + ox, z: b.z + oz, heading: b.heading});
    }
    return out;
}
