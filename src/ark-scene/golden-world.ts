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
import {cropAt} from "@/ark-scene/fields";
import {COTTAGE, microDecor} from "@/ark-scene/micro-decor";
import {sampleGround, smoothstep, ZONE_SITES} from "@/ark-scene/world";

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

/**
 * A field of standing crops near the cottage, for the close shot of the fields (batch 4): the point round which the
 * most cabbage, cereal or maize grows within 4 m, well inside the farm (where the ground paints the fields fully and
 * the close-up plants stand), nearest the cottage on a tie.
 */
export function goldenCropField(): {x: number; z: number} | null {
    const farm = ZONE_SITES.farm_garden;
    let best: {x: number; z: number} | null = null;
    let bestScore = 0;
    // (Home growth: the whole district; the village's own fields along its lanes are grass, the crops beyond them.)
    for (let x = farm.x - 36; x <= farm.x + 90; x += 3) {
        for (let z = farm.z - 50; z <= farm.z + 66; z += 3) {
            let grown = 0;
            for (let dx = -4; dx <= 4; dx += 1) {
                for (let dz = -4; dz <= 4; dz += 1) {
                    const crop = cropAt(x + dx, z + dz)?.crop;
                    if (crop !== "cabbage" && crop !== "cereal" && crop !== "maize") continue;
                    const s = sampleGround(x + dx, z + dz);
                    if ((s.weights.farm_garden ?? 0) * smoothstep(0.6, 1, s.land) > 0.85) grown++;
                }
            }
            const score = grown - Math.hypot(x - COTTAGE.x, z - COTTAGE.z) * 0.05;
            if (score > bestScore) {
                bestScore = score;
                best = {x, z};
            }
        }
    }
    return best;
}
