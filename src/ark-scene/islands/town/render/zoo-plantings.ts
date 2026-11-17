/**
 * The zoo enclosures' library plantings (p4 (townfix); the owner, 2026-11-17: "the elephant enclosure has objects in it
 * like tree trunks and mini pond and bushes etc. that all look so bad and cheap graphics, not detailed"): the fallen
 * logs with their root plates, the dead trees, the bushes, ferns, reeds and sedge that `zoo-habitat.ts` dressPaddock
 * puts in each outdoor enclosure, as the asset library's own (barked logs, leaf-picture bushes and ferns), instanced
 * with the town's trees (`render/assets.ts`: one draw per asset and level, levels of detail, no new material).
 *
 * The same run of the dressing as the scenery's (the same spots, the same ground), drawing nothing itself: where each
 * goes is where the dressing's footprints and colliders already are, unchanged.
 */

import {zooSpotsOf, type ZooEnclosure} from "@/ark-scene/islands/town/areas";
import {townHeight} from "@/ark-scene/islands/town/ground";
import {ZOO_TYPES} from "@/ark-scene/islands/town/zoo-types";
import {Geo} from "@/ark-scene/islands/town/render/kit";
import {dressPaddock} from "@/ark-scene/islands/town/render/zoo-habitat";
import type {TownAssetPlacement} from "@/ark-scene/islands/town/render/assets";

/** A Geo that keeps nothing (the dressing's drawing is the scenery's). */
class Nothing extends Geo {
    override tri() {}
    override triShaded() {}
    override rock() {}
    override blob() {}
    override bush() {}
}

/** Past this far (m) a small planting is not drawn (as the town's reeds: `render/nature.ts`); the dead trees always are. */
function cullFor(asset: string): number {
    if (asset.startsWith("snag")) return Infinity;
    if (asset.startsWith("bush")) return 160;
    if (asset.startsWith("log")) return 110;
    return 70;
}

/** Every open outdoor enclosure's library plantings, as the town's asset placements. */
export function zooHabitatPlantings(enclosures: readonly ZooEnclosure[]): TownAssetPlacement[] {
    const out: TownAssetPlacement[] = [];
    const sink = new Nothing();
    for (const e of enclosures) {
        if (e.shared) continue;
        const form = ZOO_TYPES[e.type].form;
        if (form !== "paddock" && form !== "aviary") continue;
        const plot = dressPaddock(e, zooSpotsOf(e), sink, sink, townHeight, null);
        if (!plot) continue;
        for (const p of plot.plantings) out.push({asset: p.asset, x: p.x, y: p.y, z: p.z, rotation: p.rotation, scale: p.scale, stretch: p.stretch, shade: p.shade, cull: cullFor(p.asset), ...(p.tint ? {tint: p.tint} : {})});
    }
    return out;
}
