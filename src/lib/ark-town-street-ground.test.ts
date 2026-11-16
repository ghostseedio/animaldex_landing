/**
 * The drawn ground never stands up through a street (the owner, 2026-11-16: "there's a random glitch patch in the road
 * on the town island"). The park's rolling ground ended at a hard edge along the mill lane (a 0.4 m step under the
 * road), and a street's strip is one face from kerb to kerb: where the ground bent under it (the park's step, a shore's
 * brow under the bay road) the face cut under the 1.1 m ground tile by up to 23 cm and grass showed in the asphalt.
 * Now the streets' beds are graded (`ground.ts` streetGrade), the rough areas' edges eased, and a strip is cut across in
 * four where the ground bends under it.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {townPlan} from "@/ark-scene/islands/town/plan";
import {townTileHeight} from "@/ark-scene/islands/town/drawn-ground";
import {roughness, townHeight} from "@/ark-scene/islands/town/ground";
import {Geo} from "@/ark-scene/islands/town/render/kit";
import {streetSurfaces} from "@/ark-scene/islands/town/render/streets";
import {streetHeight} from "@/ark-scene/islands/town/render/scenery";

test("no street surface lies under the drawn ground (no grass through the road)", () => {
    const geo = new Geo();
    streetSurfaces(townPlan(), {chunkAt: () => ({decal: geo}), heightAt: streetHeight});
    const pokes: string[] = [];
    let probed = 0;
    for (let i = 0; i < geo.pos.length; i += 9) {
        if (Math.abs(geo.nor[i + 1]) < 0.5) continue;
        for (const [a, b] of [[1 / 3, 1 / 3], [0.7, 0.15], [0.15, 0.7], [0.15, 0.15]]) {
            const c = 1 - a - b;
            const x = geo.pos[i] * a + geo.pos[i + 3] * b + geo.pos[i + 6] * c;
            const y = geo.pos[i + 1] * a + geo.pos[i + 4] * b + geo.pos[i + 7] * c;
            const z = geo.pos[i + 2] * a + geo.pos[i + 5] * b + geo.pos[i + 8] * c;
            // (Down at the tide's reach (a path's end on the beach, the quay's foot) the sea covers it: not counted.)
            if (y < 0.7) continue;
            probed++;
            const tile = townTileHeight(x, z);
            if (tile > y - 0.01) pokes.push(`(${x.toFixed(1)}, ${z.toFixed(1)}): ground ${tile.toFixed(2)} over ${y.toFixed(2)}`);
        }
    }
    assert.ok(probed > 40000, `probed ${probed}`);
    assert.equal(pokes.length, 0, `${pokes.length} points, e.g. ${pokes.slice(0, 5).join("; ")}`);
});

test("the ground has no hard step at the park's and the zoo's edges", () => {
    // (Across each edge, every 0.25 m: the height changes by under 0.12 m a step.)
    const lines: Array<[number, number, number, number]> = [
        [-14, -45, -14, -30], // the park's north edge (z = -38), across the mill lane
        [-20, -110, -20, -100], // the park's south edge
        [-62, -60, -50, -60], // the zoo's east edge (x = -56)
        [-120, 10, -120, 26] // the zoo's north edge (z = 18)
    ];
    for (const [x0, z0, x1, z1] of lines) {
        let last = townHeight(x0, z0);
        const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.25);
        for (let k = 1; k <= n; k++) {
            const x = x0 + ((x1 - x0) * k) / n;
            const z = z0 + ((z1 - z0) * k) / n;
            const h = townHeight(x, z);
            assert.ok(Math.abs(h - last) < 0.12, `a step of ${(h - last).toFixed(2)} m at (${x.toFixed(2)}, ${z.toFixed(2)})`);
            last = h;
        }
    }
    // (And a street's bed does not roll: the mill lane through the park's edge.)
    assert.equal(roughness(-30, -38.8), 0);
});
