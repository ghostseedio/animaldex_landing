/**
 * Lane ark-sleep (the owner, 2026-11-21: "generally animals don't sleep in the open - they find a hiding spot or
 * something"): where a kept animal's resting figure sleeps in its pen (a paddock, a sheep fold, a pig unit, a farm's
 * yard, a home's back garden). It sleeps beside its shelter: the side nearest its pen of the nearest field shelter, pig
 * ark, stable, barn, or (in a garden) its home. A herd or a flock beds down together there, each a seeded step from the
 * spot so they lie close but apart. The rest of the day the figure stands at its own place, as before.
 *
 * Its hours: a day animal (or one of any hours, or dawn and dusk) from 21:00 to 06:00 on the island's clock; a night
 * animal from 08:00 to 17:00. Pure: the plan, the pen, the id and the hour; the same for every viewer.
 */

import {hashText, local, type Box, type Pt} from "@/ark-scene/islands/town/geom";
import {townPlan, type Building, type TownPlan} from "@/ark-scene/islands/town/plan";
import {inPen} from "@/ark-scene/islands/town/placement";

/** The buildings stock and pets sleep beside. */
const SHELTERS: ReadonlySet<string> = new Set(["field_shelter", "pig_ark", "stable", "barn", "house", "terrace"]);
/** How far from its pen's middle a shelter is looked for (m). */
const SHELTER_REACH = 30;

export const STOCK_NIGHT = {day: {from: 21, to: 6}, night: {from: 8, to: 17}} as const;

/** Whether an animal of this activity is asleep at its pen's shelter at this island hour. */
export function stockAsleep(activity: string | null | undefined, hours: number): boolean {
    const h = ((hours % 24) + 24) % 24;
    if (activity === "nocturnal") return h >= STOCK_NIGHT.night.from && h < STOCK_NIGHT.night.to;
    return h >= STOCK_NIGHT.day.from || h < STOCK_NIGHT.day.to;
}

/** A number that changes when any figure's bed changes by the clock (`roostTick`): the two windows' states. */
export function stockTick(hours: number): number {
    return (stockAsleep("diurnal", hours) ? 1 : 0) + (stockAsleep("nocturnal", hours) ? 2 : 0);
}

const sideCache = new Map<string, Pt | null>();

/** The spot beside its pen's shelter (the side of the nearest shelter nearest the pen's middle), or null: none in reach. */
export function penShelterSpot(pen: Box, plan: TownPlan = townPlan()): Pt | null {
    const key = `${pen.x},${pen.z},${pen.w},${pen.d},${pen.rot}`;
    if (sideCache.has(key)) return sideCache.get(key)!;
    let best: Building | null = null;
    let near = SHELTER_REACH;
    for (const b of plan.buildings) {
        if (!SHELTERS.has(b.kind)) continue;
        const d = Math.hypot(b.at.x - pen.x, b.at.z - pen.z);
        if (d < near || (d === near && best && b.id < best.id)) (best = b), (near = d);
    }
    let spot: Pt | null = null;
    if (best) {
        const b = best;
        const out = b.kind === "pig_ark" ? 0.8 : 1.2;
        const sides: Pt[] = [local(b.at, 0, b.at.d / 2 + out), local(b.at, 0, -b.at.d / 2 - out), local(b.at, b.at.w / 2 + out, 0), local(b.at, -b.at.w / 2 - out, 0)];
        // (The side facing into its pen: an open field shelter's front, a home's back wall over its garden.)
        spot = sides.reduce((a, c) => (Math.hypot(c.x - pen.x, c.z - pen.z) < Math.hypot(a.x - pen.x, a.z - pen.z) ? c : a));
    }
    sideCache.set(key, spot);
    return spot;
}

/**
 * Its bed in its pen asleep (the town's own frame), or null: awake, or no shelter in reach. `margin`: how far in from
 * the rails its middle keeps (`penMarginOf`), `length` its body.
 */
export function stockBed(pen: Box, margin: number, id: string, length: number, activity: string | null | undefined, hours: number, plan: TownPlan = townPlan()): Pt | null {
    if (!stockAsleep(activity, hours)) return null;
    const spot = penShelterSpot(pen, plan);
    if (!spot) return null;
    // (Close but apart: a seeded bearing and a step of up to two and a half body lengths, then kept in its pen and out
    // of the walls, `inPen`.)
    const h = hashText(`${id}|stock-bed`);
    const angle = ((h % 3600) / 3600) * Math.PI * 2;
    const step = Math.max(length, 0.3) * (0.4 + (((h >>> 12) % 1000) / 1000) * 2.1);
    return inPen(pen, margin, spot.x + Math.cos(angle) * step, spot.z + Math.sin(angle) * step, length);
}
