/**
 * What the golden cameras must stand clear of (graphics pass, batch 4): the
 * trunks, lamps and buildings of today's map, as circles on the ground. The
 * golden-shot page (`golden-entry.ts`) hands them to the shots through
 * `GoldenWorld.obstacles`, and the tests read the same list, so a shot never
 * opens with a trunk beside the lens again, whatever the map build moves.
 *
 * Pure: no three.js, no DOM.
 */

import {forestFill, worldDecor} from "@/ark-scene/decor";
import {microDecor} from "@/ark-scene/micro-decor";

/** Each kind's reach round its middle at camera height (m, at scale 1): a trunk, a canopy tree's low limbs, a wall. */
const REACH: Record<string, number> = {
    broadleaf: 0.6,
    rainforest: 0.7,
    conifer: 0.5,
    acacia: 0.5,
    palm: 0.4,
    orchard: 0.4,
    shrub: 0.7,
    // The canopy trees' limbs reach 2.3 m out from 2.7 m up: a camera under them looks into the bark.
    canopy: 2.6,
    lamp: 0.25,
    barn: 5.5,
    cottage: 4.4
};

export type GoldenObstacle = {x: number; z: number; radius: number};

let cached: GoldenObstacle[] | null = null;

export function goldenObstacles(): GoldenObstacle[] {
    if (cached) return cached;
    const list: GoldenObstacle[] = [];
    const add = (item: {kind: string; x: number; z: number; scale: number}) => {
        const reach = REACH[item.kind];
        if (reach === undefined) return;
        // Buildings and canopy limbs keep their size; trunks grow with the tree.
        const radius = item.kind === "barn" || item.kind === "cottage" || item.kind === "canopy" || item.kind === "lamp" ? reach : reach * Math.max(item.scale, 0.6);
        list.push({x: item.x, z: item.z, radius});
    };
    worldDecor().forEach(add);
    forestFill().forEach(add);
    microDecor().forEach(add);
    cached = list;
    return list;
}
