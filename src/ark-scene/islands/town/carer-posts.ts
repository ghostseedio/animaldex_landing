/**
 * Carers' posts (AnimalDex decision 418; `humans/carers.ts` draws them): where and when each carer works, from the town's
 * placements of the kept animals (loaded with the town). Mirrors the server's staffing (`_shared/ark-ecology/carers.ts`):
 * - a keeper per section of enclosures of a type (`ENCLOSURES_PER_KEEPER`, by the enclosure's number), at each one's
 *   keepers' hatch (just outside its back fence, facing in), at its residents' feeding times and on the morning round;
 * - a farmer per `PENS_PER_FARMER` pens (a farm, a countryside field), at the pen's trough (else by its residents);
 * - a home's owner at each of its pets' tanks, cages and vivaria (facing the glass) and by its garden pets.
 * Pets kept indoors in a room are left out (the room is the people's own, `home-rooms-host.ts`).
 */

import type {CarerPost} from "@/ark-scene/humans/carers";
import {roundVisits} from "@/ark-scene/humans/carers";
import {FEED_HOURS} from "@/ark-scene/islands/town/zoo-life";
import {zooFeedingTimes, type ZooEnclosureType, type ZooRhythm} from "@/ark-scene/islands/town/zoo-types";
import {townFarmProps} from "@/ark-scene/islands/town/farm";
import {RURAL_TROUGHS} from "@/ark-scene/islands/town/rural";
import {hashText, local, type Box} from "@/ark-scene/islands/town/geom";
import type {TownPlace} from "@/ark-scene/islands/town/placement";

/** Staffing, as the server's `carers.ts` (keep the two the same; `ark-carers.test.ts` pins these values). */
export const ENCLOSURES_PER_KEEPER: Readonly<Record<string, number>> = {
    aquarium: 1, aviaries: 3, bears_wolves: 2, big_cats: 1, childrens_farm: 2, hoofstock_paddocks: 2, insect_house: 1,
    nocturnal_house: 1, penguin_seal_pools: 1, primate_house: 1, reptile_house: 1, savanna_paddocks: 2, small_mammals: 4
};
export const PENS_PER_FARMER = 4;

/** The morning rounds (island hours) and how long each takes. */
const KEEPER_ROUND = [7.5, 1.2] as const;
const FARM_FEEDS = [7, 16.5] as const;
const FARM_ROUND = 1;
const HOME_ROUND = 0.25;

type Kept = {id: string; place: TownPlace; x: number; z: number};

/** A keeper's section ('keeper:aviaries:0' covers aviaries 1-3). */
export function keeperOf(enclosure: string): string {
    const m = /^(.*)-(\d+)$/.exec(enclosure);
    const type = m ? m[1] : enclosure;
    const n = m ? Number(m[2]) : 1;
    return `keeper:${type}:${Math.floor((Math.max(1, n) - 1) / (ENCLOSURES_PER_KEEPER[type] ?? 2))}`;
}

/** The way from `from` to `to` as a yaw (forward is (sin, cos)). */
function yawTo(fx: number, fz: number, tx: number, tz: number): number {
    return Math.atan2(tx - fx, tz - fz);
}

/** Every carer's posts for the kept animals placed now (town frame). `rhythms`: each enclosure's residents' rhythms. */
export function carerPosts(kept: readonly Kept[], rhythms: ReadonlyMap<string, readonly ZooRhythm[]>): CarerPost[] {
    const posts: CarerPost[] = [];
    // Zoo: one post per enclosure with residents; the section's keeper goes round its enclosures in turn.
    const enclosures = new Map<string, NonNullable<TownPlace["enclosure"]>>();
    for (const a of kept) if (a.place.area === "zoo" && a.place.enclosure) enclosures.set(a.place.enclosure.id, a.place.enclosure);
    const sections = new Map<string, string[]>();
    for (const id of Array.from(enclosures.keys()).sort()) {
        const k = keeperOf(id);
        sections.set(k, [...(sections.get(k) ?? []), id]);
    }
    sections.forEach((ids, keeper) => {
        ids.forEach((id, i) => {
            const e = enclosures.get(id)!;
            const at = e.slot.at;
            // The hatch: the feeding station, 1.4 m in from the back fence; the keeper just outside it, facing in.
            const dx = e.feeding.x - at.x, dz = e.feeding.z - at.z;
            const len = Math.hypot(dx, dz) || 1;
            const x = e.feeding.x + (dx / len) * 2.3, z = e.feeding.z + (dz / len) * 2.3;
            const times = new Set<number>();
            for (const r of rhythms.get(id) ?? ["day"]) for (const t of zooFeedingTimes(e.type as ZooEnclosureType, r)) times.add(t);
            const each = FEED_HOURS / ids.length;
            const visits: Array<readonly [number, number]> = Array.from(times).sort((a, b) => a - b).map((t) => [t + i * each, each] as const);
            visits.push([KEEPER_ROUND[0] + (i * KEEPER_ROUND[1]) / ids.length, KEEPER_ROUND[1] / ids.length]);
            posts.push({carer: keeper, kind: "keeper", x, z, yaw: yawTo(x, z, at.x, at.z), near: null, visits});
        });
    });
    // Farms: a pen per farm or field with residents, at its trough; a farmer per PENS_PER_FARMER pens.
    const pens = new Map<string, Kept[]>();
    for (const a of kept) if (a.place.area === "farm") pens.set(a.place.place, [...(pens.get(a.place.place) ?? []), a]);
    const troughs = [...townFarmProps().filter((p) => p.kind === "trough").map((p) => ({at: p.at, farm: p.farm as string | null})), ...RURAL_TROUGHS.map((at) => ({at, farm: null}))];
    const penIds = Array.from(pens.keys()).sort();
    const rounds: string[][] = [];
    penIds.forEach((id, i) => (rounds[Math.floor(i / PENS_PER_FARMER)] ??= []).push(id));
    rounds.forEach((round, r) => {
        const visits = roundVisits(round.length, FARM_FEEDS, FARM_ROUND);
        round.forEach((id, i) => {
            const residents = pens.get(id)!;
            const pen = residents.find((a) => a.place.pen)?.place.pen ?? null;
            const cx = pen ? pen.x : residents[0].x, cz = pen ? pen.z : residents[0].z;
            let best: Box | null = null;
            let bestD = Infinity;
            for (const t of troughs) {
                if (t.farm !== null && t.farm !== id) continue;
                const d = Math.hypot(t.at.x - cx, t.at.z - cz);
                if (d < bestD && d < (pen ? Math.max(pen.w, pen.d) : 12)) {
                    bestD = d;
                    best = t.at;
                }
            }
            // At the trough's long side, facing it; else a step from the first resident's spot.
            const spot = best ? local(best, 0, best.d / 2 + 0.55) : {x: residents[0].x + 1.2, z: residents[0].z + 0.6};
            const look = best ? {x: best.x, z: best.z} : {x: residents[0].x, z: residents[0].z};
            posts.push({carer: `farmer:${r}`, kind: "farmer", x: spot.x, z: spot.z, yaw: yawTo(spot.x, spot.z, look.x, look.z), near: null, visits: visits[i]});
        });
    });
    // Homes: the owner at each display (tank, cage, vivarium, pond) and by each garden pet, at the home's own hours.
    const homes = new Map<string, Kept[]>();
    for (const a of kept) if (a.place.area === "house" && a.place.where !== "indoor") homes.set(a.place.place, [...(homes.get(a.place.place) ?? []), a]);
    homes.forEach((pets, home) => {
        const u = hashText(`carer|${home}`) / 4294967296;
        const seen = new Set<string>();
        const spots: Array<{x: number; z: number; yaw: number; near: number | null}> = [];
        for (const a of pets.sort((p, q) => (p.id < q.id ? -1 : 1))) {
            const d = a.place.display;
            if (d) {
                if (seen.has(d.id)) continue;
                seen.add(d.id);
                const box: Box = {x: d.x, z: d.z, w: d.w, d: d.d, rot: d.rot};
                const front = local(box, 0, d.d / 2 + 0.55);
                spots.push({x: front.x, z: front.z, yaw: yawTo(front.x, front.z, d.x, d.z), near: d.form === "pond" ? null : d.floor});
            } else if (spots.length < 3) {
                spots.push({x: a.x + 0.9, z: a.z + 0.5, yaw: yawTo(a.x + 0.9, a.z + 0.5, a.x, a.z), near: null});
            }
        }
        const visits = roundVisits(spots.length, [7 + u * 1.2, 18 + u * 1.5], HOME_ROUND * Math.min(3, spots.length));
        spots.forEach((s, i) => posts.push({carer: `owner:${home}`, kind: "owner", ...s, visits: visits[i]}));
    });
    return posts;
}
