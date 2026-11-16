/**
 * The farms' tractor and bales (graphics pass 2, lane town2; the owner: "the tractor looks awful", "the hay bales look
 * bad quality too"). The round bales were wound inward, so the solid material culled their near sides and they read as
 * hollow half-pipes: every face of a bale now faces out of it.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {Geo} from "@/ark-scene/islands/town/render/kit";
import {roundBale, spinX, squareBale, tractor} from "@/ark-scene/islands/town/render/farm-machines";

function facesOut(geo: Geo, centre: [number, number, number]): number {
    let inward = 0;
    for (let i = 0; i < geo.pos.length; i += 9) {
        const m = [0, 1, 2].map((k) => (geo.pos[i + k] + geo.pos[i + 3 + k] + geo.pos[i + 6 + k]) / 3);
        const d = geo.nor[i] * (m[0] - centre[0]) + geo.nor[i + 1] * (m[1] - centre[1]) + geo.nor[i + 2] * (m[2] - centre[2]);
        if (d <= 0) inward++;
    }
    return inward;
}

test("a round bale is closed and every face looks out of it, straw or wrapped, at any turn", () => {
    for (const wrapped of [false, true]) {
        for (const rot of [0, 0.7, Math.PI / 2, 2.5]) {
            const geo = new Geo();
            roundBale(geo, {x: 3, y: 2, z: -4, rot}, 0, 0.6, 0, 0.6, 1.2, wrapped, 42);
            assert.equal(facesOut(geo, [3, 2.6, -4]), 0, `wrapped ${wrapped} rot ${rot}`);
            assert.ok(geo.triangles >= 300 && geo.triangles <= 400, `${geo.triangles} triangles`);
            // (Closed: its surface area is the cylinder's, near enough.)
            let area = 0;
            for (let i = 0; i < geo.pos.length; i += 9) {
                const u = [0, 1, 2].map((k) => geo.pos[i + 3 + k] - geo.pos[i + k]);
                const v = [0, 1, 2].map((k) => geo.pos[i + 6 + k] - geo.pos[i + k]);
                area += Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) / 2;
            }
            const cylinder = 2 * Math.PI * 0.6 * 1.2 + 2 * Math.PI * 0.36;
            assert.ok(Math.abs(area - cylinder) / cylinder < 0.08, `area ${area.toFixed(2)} vs ${cylinder.toFixed(2)}`);
        }
    }
});

test("spinX winds outward whichever way the profile turns", () => {
    const geo = new Geo();
    spinX(geo, {x: 0, y: 0, z: 0, rot: 1.1}, 0, 1, 0, [[-1, 0], [-1, 0.5], [1, 0.5], [1, 0]], 12, () => [1, 1, 1]);
    assert.equal(facesOut(geo, [0, 1, 0]), 0);
});

test("a square bale and the tractor are built within their budgets", () => {
    const bale = new Geo();
    squareBale(bale, {x: 0, y: 0, z: 0, rot: 0.3}, 0, 0, 0, 0.88, 0.44, 1.1, 7);
    // (Its body and two twine bands: three boxes.)
    assert.equal(bale.triangles, 30);
    const geo = new Geo();
    const glass = new Geo();
    tractor(geo, glass, 10, 2.6, -5, 0.4);
    assert.ok(geo.triangles > 2500 && geo.triangles < 6000, `${geo.triangles} triangles`);
    assert.ok(glass.triangles > 0);
    // Stands on the ground: nothing under it, its wheels touching (within the treads' height).
    let low = Infinity;
    let high = -Infinity;
    for (let i = 1; i < geo.pos.length; i += 3) {
        low = Math.min(low, geo.pos[i]);
        high = Math.max(high, geo.pos[i]);
    }
    assert.ok(low > 2.6 - 0.08 && low < 2.6 + 0.02, `lowest ${low.toFixed(3)}`);
    assert.ok(high > 2.6 + 2.7 && high < 2.6 + 3.1, `top ${high.toFixed(2)}`);
});
