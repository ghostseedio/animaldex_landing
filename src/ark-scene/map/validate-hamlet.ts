/**
 * The hamlet's and the crowding checks (owner decision D10; the dry run's
 * §4.3 asked for them): the spawn validator places one of each species, so
 * none of its ten checks sees crowding. These take a population (the dry
 * run's 1× and 3× captures, `scripts/ark-map-scale.mts`) and check:
 *
 * - `plot_overlap`: no reserved plot overlaps another, or has a tree, rock
 *   or building in its house's or barn's core, or stands off dry land;
 * - `plot_capacity`: through a day, no plot has more residents out than it
 *   has spots, and each one out is on a spot of its own plot that its body
 *   may use (a horse never in the coop's run);
 * - `crowding`: no more than `CROWD_MAX` animals stand in one 1 m cube (the
 *   map's ground and perches, and the hamlet's residents out of doors);
 * - `reserved_land`: no animal but a resident stands on a reserved plot.
 *
 * Pure: the same population gives the same report.
 */

import {homeObstacles, type HomePlot} from "@/ark-scene/props/home-layout";
import {hamletState, plotFootprint, plotSpots, reservedAt, reservedPlots, spotSize, type HamletResident} from "@/ark-scene/map/hamlet";
import {placeAnimals, type Placement} from "@/ark-scene/placement";
import {withinCapacity, zoneCapacity} from "@/ark-scene/map/capacity";
import {arkBody} from "@/ark-scene/stats";
import type {ArkAnimal} from "@/ark-scene/types";
import {sampleGround} from "@/ark-scene/world";

/** The most animals of a cat's size or more (`CROWD_LENGTH`) one 1 m cube may hold; smaller ones (lizards on a rock, a perched colony) crowd as they do. */
export const CROWD_MAX = 4;
export const CROWD_LENGTH = 0.25;

export type HamletFailure = {check: "plot_overlap" | "plot_capacity" | "crowding" | "reserved_land"; detail: string};

function overlaps(a: Array<{x: number; z: number}>, b: Array<{x: number; z: number}>): boolean {
    for (const poly of [a, b]) {
        for (let i = 0; i < poly.length; i++) {
            const p = poly[i];
            const q = poly[(i + 1) % poly.length];
            const nx = q.z - p.z;
            const nz = p.x - q.x;
            const pa = a.map((v) => v.x * nx + v.z * nz);
            const pb = b.map((v) => v.x * nx + v.z * nz);
            if (Math.max(...pa) <= Math.min(...pb) || Math.max(...pb) <= Math.min(...pa)) return false;
        }
    }
    return true;
}

/** The plots: apart, their cores clear, on dry land. */
export function validatePlots(plots: readonly HomePlot[] = reservedPlots()): HamletFailure[] {
    const failures: HamletFailure[] = [];
    const prints = plots.map((plot) => plotFootprint(plot));
    for (let i = 0; i < plots.length; i++) {
        // (Today's cottage and barn are the scenery's own, drawn as they always were: their gardens and yards meet.)
        for (let j = Math.max(i + 1, 2); j < plots.length; j++) if (overlaps(prints[i], prints[j])) failures.push({check: "plot_overlap", detail: `${plots[i].id} overlaps ${plots[j].id}`});
        if (i < 2) continue; // (today's cottage and barn are the scenery's own)
        const plot = plots[i];
        for (const corner of prints[i]) {
            const g = sampleGround(corner.x, corner.z);
            if (g.land < 0.8 || g.height < 0.3) failures.push({check: "plot_overlap", detail: `${plot.id} reaches off dry land at ${corner.x.toFixed(1)},${corner.z.toFixed(1)}`});
        }
        const core = plot.kind === "house" ? 3 : 4.2;
        for (const o of homeObstacles()) if (Math.hypot(o.x - plot.x, o.z - plot.z) < o.r + core * 0.8) failures.push({check: "plot_overlap", detail: `${plot.id}'s ${plot.kind === "house" ? "house" : "barn"} on a tree, rock or building at ${o.x.toFixed(1)},${o.z.toFixed(1)}`});
    }
    return failures;
}

/** Through a day (every 20 minutes): no plot over its spots; each out on a spot of its own plot its body may use. */
export function validateCapacity(residents: readonly HamletResident[], hours: (epochSeconds: number) => number, day: number): {failures: HamletFailure[]; most: number; share: number} {
    const failures: HamletFailure[] = [];
    let most = 0;
    let outSum = 0;
    let samples = 0;
    const lengths = new Map(residents.map((r) => [r.id, r.length]));
    for (let t = 0; t < 24 * 3600; t += 1200) {
        const {out} = hamletState(residents, day + t, hours);
        const byPlot = new Map<string, number>();
        out.forEach((o, id) => {
            byPlot.set(o.plot.id, (byPlot.get(o.plot.id) ?? 0) + 1);
            const spot = plotSpots(o.plot).spots[o.spot];
            if (!spot || !spot.sizes.includes(spotSize(lengths.get(id) ?? 0))) failures.push({check: "plot_capacity", detail: `${id} on a spot its body may not use (${spot?.where})`});
        });
        byPlot.forEach((n, plot) => {
            const spots = plotSpots(residents.find((r) => r.plot.id === plot)!.plot).spots.length;
            if (n > spots) failures.push({check: "plot_capacity", detail: `${plot}: ${n} out on ${spots} spots`});
        });
        most = Math.max(most, out.size);
        outSum += out.size;
        samples++;
    }
    return {failures, most, share: residents.length ? outSum / samples / residents.length : 0};
}

/** Where each animal stands now on the ground (or a perch): the map's place, and a resident out of doors at its spot. */
function standing(animals: readonly ArkAnimal[], placed: Map<string, Placement>, out: Map<string, {at: {x: number; y: number; z: number}}>, visible: ReadonlySet<string>): Array<{id: string; x: number; y: number; z: number}> {
    const list: Array<{id: string; x: number; y: number; z: number}> = [];
    for (const animal of animals) {
        const place = placed.get(animal.id);
        if (!place) continue;
        // (Past its zone's visible capacity, a wild animal rests out of sight: rule E, `capacity.ts`.)
        if (!place.hamlet && !visible.has(animal.id)) continue;
        if (place.hamlet) {
            const o = out.get(animal.id);
            if (o && arkBody(animal).metres >= CROWD_LENGTH) list.push({id: animal.id, x: o.at.x, y: o.at.y, z: o.at.z});
            continue;
        }
        // (Micro animals, canopy limbs and the water's swimmers are not on the ground's cells.)
        if (place.micro || place.canopy || place.water || place.map?.held || arkBody(animal).metres < CROWD_LENGTH) continue;
        list.push({id: animal.id, x: place.x, y: place.perch ? place.perch.y : place.ground, z: place.z});
    }
    return list;
}

/** A population's crowding and reserved land at one moment, and its hamlet's capacity through a day. */
export function validatePopulation(animals: readonly ArkAnimal[], hours: (epochSeconds: number) => number, day: number): {failures: HamletFailure[]; residents: number; plots: number; mostPerCell: number; cellsOver: number; outMost: number; outShare: number; resting: number} {
    const placed = placeAnimals([...animals]);
    const residents: HamletResident[] = animals.flatMap((animal) => {
        const plot = placed.get(animal.id)?.hamlet?.plot;
        return plot ? [{id: animal.id, slug: animal.model_slug, length: arkBody(animal).metres, plot}] : [];
    });
    const failures = validatePlots();
    const capacity = validateCapacity(residents, hours, day);
    // Rule E for the wild animals: each zone shows its visible capacity (Home's less the hamlet's spots, which its
    // residents' own rotation keeps to), the rest rest out of sight.
    const hamletSpots = reservedPlots().reduce((sum, plot) => sum + plotSpots(plot).spots.length, 0);
    const wild = animals.filter((animal) => !placed.get(animal.id)?.hamlet);
    const visible = withinCapacity(wild, (zone) => {
        const cap = zoneCapacity(zone);
        return cap === null ? null : zone === "farm_garden" ? Math.max(cap - hamletSpots, 0) : cap;
    });
    failures.push(...capacity.failures);
    // Crowding at midday and at midnight.
    let mostPerCell = 0;
    let cellsOver = 0;
    for (const t of [12 * 3600, 0]) {
        const {out} = hamletState(residents, day + t, hours);
        const cells = new Map<string, number>();
        for (const s of standing(animals, placed, out, visible)) {
            // A 1 m cell in 3D: a gecko on the wall is not in the cell of a cat on the lawn below it.
            const key = `${Math.floor(s.x)},${Math.floor(s.y)},${Math.floor(s.z)}`;
            cells.set(key, (cells.get(key) ?? 0) + 1);
        }
        cells.forEach((n, key) => {
            mostPerCell = Math.max(mostPerCell, n);
            if (n > CROWD_MAX) {
                cellsOver++;
                if (cellsOver <= 5) failures.push({check: "crowding", detail: `${n} animals in the 1 m cell at ${key}`});
            }
        });
    }
    for (const animal of animals) {
        const place = placed.get(animal.id);
        if (!place || place.hamlet || place.micro || place.canopy || place.water) continue;
        // (A partner by its host stands where its host does, a step aside: the host is what must keep off.)
        const host = place.host ? placed.get(place.host.id) : null;
        if (host ? reservedAt(host.x, host.z) : reservedAt(place.x, place.z)) failures.push({check: "reserved_land", detail: `${animal.model_slug} on a reserved plot at ${place.x.toFixed(1)},${place.z.toFixed(1)}`});
    }
    const plots = new Set(residents.map((r) => r.plot.id)).size;
    return {failures, residents: residents.length, plots, mostPerCell, cellsOver, outMost: capacity.most, outShare: capacity.share, resting: wild.length - visible.size};
}
