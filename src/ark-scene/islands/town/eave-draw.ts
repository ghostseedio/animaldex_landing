/**
 * ARK-CONTACT (the owner, 2026-11-21: "a Ruddy Ground Dove perched on a house roof is in mid-air", beside the roof's
 * edge or gutter): an eave's perch as drawn, on the drawn roof's lower edge.
 *
 * The plan's eave perch (`areas.ts` urbanSpots) is 0.2 m out from a building's front and back walls at the eaves'
 * height, lifted onto the drawn roof there (`roof-perch.ts`). Where those walls are gable ends (every gable house's,
 * 96 of 96: its eaves run along the other walls) or a flat roof's sides (no overhang), there is no drawn roof under it:
 * the bird stood in the air beside the house (210 of the town's 300 eave perches). The plan's spots are the server's
 * too (`positions/town-reach.json`, pinned), so the plan keeps them; the scene draws a bird resting on one at its
 * drawn eave instead: the same distance out from the side walls (the eaves of a roof built the other way round), else
 * moved in from its wall until the drawn roof is under it, onto that roof. Each building's solid is built once, when a
 * bird first rests on one of its eaves, and the answers kept.
 */

import {townAreas} from "@/ark-scene/islands/town/areas";
import {local, toLocal} from "@/ark-scene/islands/town/geom";
import {townBuildingFloor} from "@/ark-scene/islands/town/ground";
import {townPlan, type Building} from "@/ark-scene/islands/town/plan";
import {buildingSolid, perchOnSurface, surfacesAt} from "@/ark-scene/islands/town/roof-perch";

type Pt3 = {x: number; y: number; z: number};

/** An eave's perch on the drawn roof (pure in the building, its solid and the planned perch). */
export function eaveOnRoof(b: Building, solid: ArrayLike<number>, s: Pt3): Pt3 {
    const onRoof = (x: number, z: number, y: number) => {
        const lifted = perchOnSurface(solid, x, y, z);
        return lifted !== y ? {x, y: lifted, z} : null;
    };
    const here = onRoof(s.x, s.z, s.y);
    if (here) return here;
    const at = toLocal(b.at, s.x, s.z);
    const side = at.z < 0 ? -1 : 1;
    const turned = local(b.at, side * (b.at.w / 2 + 0.2), 0);
    const there = onRoof(turned.x, turned.z, s.y);
    if (there) return there;
    // (In from the wall, 5 cm at a time, onto the highest drawn surface under the point up to the roof's top.)
    const top = townBuildingFloor(b.at) + b.top + 0.6;
    for (let lz = Math.abs(at.z) - 0.05; lz > 0; lz -= 0.05) {
        const p = local(b.at, at.x, side * lz);
        const heights = surfacesAt(solid, p.x, p.z).filter((h) => h <= top);
        if (heights.length) return {x: p.x, y: perchOnSurface(solid, p.x, Math.max(...heights) - 0.005, p.z), z: p.z};
    }
    return s;
}

/** The plan's eave perches by their point (cm), with their building. */
let eaves: Map<string, {spot: Pt3; building: string}> | null = null;
const solids = new Map<string, ArrayLike<number>>();
const drawn = new Map<string, Pt3>();
const keyOf = (x: number, z: number) => `${Math.round(x * 100)},${Math.round(z * 100)}`;

/**
 * Where a body resting at (x, y, z) on a planned eave perch is drawn: that eave's drawn point (null: not on an eave
 * perch, within 2 cm across and 5 cm up or down, or one already on its drawn roof).
 */
export function drawnEave(x: number, y: number, z: number): Pt3 | null {
    if (!eaves) {
        eaves = new Map();
        for (const s of townAreas().spots) if (s.where === "eave") eaves.set(keyOf(s.x, s.z), {spot: {x: s.x, y: s.y, z: s.z}, building: s.place});
    }
    let found: {spot: Pt3; building: string} | undefined;
    const cx = Math.round(x * 100);
    const cz = Math.round(z * 100);
    for (let dx = -2; dx <= 2 && !found; dx++) for (let dz = -2; dz <= 2 && !found; dz++) found = eaves.get(`${cx + dx},${cz + dz}`);
    if (!found || Math.abs(found.spot.y - y) > 0.05) return null;
    const key = keyOf(found.spot.x, found.spot.z);
    let out = drawn.get(key);
    if (!out) {
        const b = townPlan().buildings.find((it) => it.id === found!.building);
        if (!b) return null;
        let solid = solids.get(b.id);
        if (!solid) {
            solid = buildingSolid(b);
            solids.set(b.id, solid);
        }
        out = eaveOnRoof(b, solid, found.spot);
        drawn.set(key, out);
    }
    return out.x === found.spot.x && out.y === found.spot.y && out.z === found.spot.z ? null : out;
}
