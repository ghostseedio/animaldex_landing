/**
 * Rule E (the captures dry run, AnimalDex docs/ark/captures-backfill-dry-run.md
 * §5): each zone's visible capacity, how many of its animals its own ground
 * shows without crowding. Past it, the rest rest out of sight by the shared
 * rotation (the runtime lane's `setArkZoneCapacity` / `arkWithinCapacity`),
 * the same for every viewer, before the device tier's budget.
 *
 * A zone's capacity is its own spawn cells (2.5 m, every tag's, wet and dry;
 * `points.ts`) times `PER_CELL`, plus its attach points (each holds one small
 * animal: a leaf, a branch, a rock face, a burrow), and for Home the hamlet's
 * outdoor spots (its residents' own rotation keeps within them). Pure and
 * deterministic: the same island gives the same table. The crowding check
 * (`validate-hamlet.ts`) applies it before it counts.
 */

import {mapPoints} from "@/ark-scene/map/place";
import {plotSpots, reservedPlots} from "@/ark-scene/map/hamlet";
import {worldSampler} from "@/ark-scene/map/world-sampler";
import {ARK_ZONES, type ArkZone} from "@/ark-scene/types";

/** Animals a cell shows at once without crowding (a 2.5 m cell: one animal and its neighbours' spread round it). */
export const PER_CELL = 1;

let table: Map<ArkZone, number> | null = null;

/** Every zone's visible capacity (animals). */
export function zoneCapacities(): Map<ArkZone, number> {
    if (table) return table;
    const cells = mapPoints().cellsPerZone();
    const points = new Map<ArkZone, number>();
    for (const point of worldSampler().attachPoints()) points.set(point.zone, (points.get(point.zone) ?? 0) + 1);
    const hamlet = reservedPlots().reduce((sum, plot) => sum + plotSpots(plot).spots.length, 0);
    table = new Map(ARK_ZONES.map((zone) => [zone, (cells.get(zone) ?? 0) * PER_CELL + (points.get(zone) ?? 0) + (zone === "farm_garden" ? hamlet : 0)]));
    return table;
}

/** A zone's visible capacity, or null for one the map does not know (no limit): the runtime's `setArkZoneCapacity` shape. */
export function zoneCapacity(zone: string): number | null {
    return zoneCapacities().get(zone as ArkZone) ?? null;
}

/** A stable 32-bit hash (FNV-1a, as `live-budget.ts` arkHash). */
function hash(text: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}

/**
 * Rule E as the runtime applies it (`live-budget.ts` arkWithinCapacity at a rotation step, nobody pinned or resting):
 * in a zone holding more than its capacity, a window of the zone's ring by id hash. For the checks: who of these is
 * visible. `capacity` may be lowered for animals another rotation shows (the hamlet's residents).
 */
export function withinCapacity<T extends {id: string; zone: string}>(animals: readonly T[], capacity: (zone: string) => number | null = zoneCapacity, step = 0): Set<string> {
    const byZone = new Map<string, T[]>();
    for (const animal of animals) byZone.set(animal.zone, [...(byZone.get(animal.zone) ?? []), animal]);
    const kept = new Set<string>();
    byZone.forEach((members, zone) => {
        const cap = capacity(zone);
        if (cap === null || members.length <= cap) {
            for (const member of members) kept.add(member.id);
            return;
        }
        const ring = members.map((member) => ({member, h: hash(`zone:${member.id}`)})).sort((a, b) => a.h - b.h || (a.member.id < b.member.id ? -1 : 1));
        const start = (step + (hash(`zone:${zone}`) % ring.length)) % ring.length;
        for (let i = 0; i < cap; i++) kept.add(ring[(start + i) % ring.length].member.id);
    });
    return kept;
}
