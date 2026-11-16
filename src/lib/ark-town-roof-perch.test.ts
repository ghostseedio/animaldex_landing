/**
 * A town bird's perch on a roof, an eave or a ledge is on the drawn roof, never inside it (the owner, 2026-11-16: "i saw
 * a bird inside a house or roof"): `islands/town/roof-perch.ts`, used by `areas.ts` urbanSpots.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {townPlan} from "@/ark-scene/islands/town/plan";
import {townAreas} from "@/ark-scene/islands/town/areas";
import {buildingSolid, perchOnSurface, surfacesAt} from "@/ark-scene/islands/town/roof-perch";

test("the vertical line through a solid: a flat roof slab's top and underside, nothing outside it", () => {
    // A 2 x 2 slab from y 3 to 3.2 as two triangles on top and two under.
    const top = [-1, 3.2, -1, 1, 3.2, -1, 1, 3.2, 1, -1, 3.2, -1, 1, 3.2, 1, -1, 3.2, 1];
    const under = top.map((v, i) => (i % 3 === 1 ? 3 : v));
    const solid = [...top, ...under];
    assert.deepEqual(surfacesAt(solid, 0.2, 0.3).map((h) => +h.toFixed(3)).sort(), [3, 3.2]);
    assert.deepEqual(surfacesAt(solid, 1.5, 0), []);
    // A perch planned inside the slab is lifted onto it; one over open ground is left.
    assert.equal(+perchOnSurface(solid, 0, 3.05, 0).toFixed(3), 3.21);
    assert.equal(perchOnSurface(solid, 5, 3.05, 5), 3.05);
});

test("every roof, eave and ledge perch of the town: no drawn surface over it within a small bird's height", () => {
    const plan = townPlan();
    const perches = townAreas().spots.filter((s) => s.where === "roof" || s.where === "eave" || s.where === "ledge");
    const byBuilding = new Map(plan.buildings.map((b) => [b.id, b]));
    let checked = 0;
    const inside: string[] = [];
    const groups = new Map<string, typeof perches>();
    for (const p of perches) groups.set(p.place, [...(groups.get(p.place) ?? []), p]);
    groups.forEach((list, id) => {
        const b = byBuilding.get(id);
        if (!b) return;
        const solid = buildingSolid(b);
        for (const p of list) {
            checked++;
            if (surfacesAt(solid, p.x, p.z).some((h) => h > p.y + 0.005 && h < p.y + 0.25)) inside.push(`${id} ${p.where}`);
        }
    });
    assert.ok(checked > 400, `${checked} perches`);
    assert.deepEqual(inside.slice(0, 10), [], `${inside.length} of ${checked} perches inside a roof`);
});
