/**
 * The canal's humpbacked bridges (the owner, 2026-11-17: "the canal bridge looks so bad and glitchy, fix it"). The old
 * flat decks had the canal's coping standing through the road as a pale bar, single-sided arch faces you saw the sky
 * through, and boats moored under them with their cabins through the deck. Here: the deck is one smooth curve that
 * meets the street's own ground at both ends; the canal's coping is under it; the arch clears the water and stays under
 * the deck; the street's surfaces (what walkers stand on) and the cars' road follow the deck; the masonry is closed and
 * stays off the deck between the parapets; no boat is moored under a bridge.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {Geo} from "@/ark-scene/islands/town/render/kit";
import {ARCH_RING, archAt, bridgeAt, canalBridges, PARAPET} from "@/ark-scene/islands/town/canal-bridges";
import {drawCanalBridge} from "@/ark-scene/islands/town/render/canal-bridges";
import {streetHeight} from "@/ark-scene/islands/town/render/scenery";
import {roadHeight} from "@/ark-scene/islands/town/render/vehicles";
import {streetSurfaces, ROAD_LIFT} from "@/ark-scene/islands/town/render/streets";
import {CANAL_LEVEL, TOWN_LEVEL, townPlan} from "@/ark-scene/islands/town/plan";
import {townHeight} from "@/ark-scene/islands/town/ground";

const at = (b: ReturnType<typeof canalBridges>[number], u: number, v: number) => ({x: b.x + b.dx * v - b.dz * u, z: b.z + b.dz * v + b.dx * u});

test("four bridges: the High Street, Mill Lane, Harbour Road and Church Walk's footbridge", () => {
    assert.deepEqual(canalBridges().map((b) => b.street).sort(), ["church_walk", "harbour_road", "high_street", "mill_lane"]);
});

test("each deck is one smooth curve from the street's ground, over the canal and back, with no step", () => {
    for (const b of canalBridges()) {
        for (const u of [0, b.band * 0.5, -b.band + 0.1]) {
            let last: number | null = null;
            for (let v = -b.reach - 2; v <= b.reach + 2; v += 0.1) {
                const p = at(b, u, v);
                const h = streetHeight(p.x, p.z);
                if (last !== null) assert.ok(Math.abs(h - last) < 0.025, `${b.street} steps ${(h - last).toFixed(3)} m at v ${v.toFixed(1)}`);
                last = h;
                if (Math.abs(v) >= b.reach) assert.ok(Math.abs(h - townHeight(p.x, p.z)) < 1e-6, `${b.street} off its ground at v ${v.toFixed(1)}`);
                // The cars' road is the deck the street is drawn on.
                assert.ok(Math.abs(roadHeight(p.x, p.z) - h) < 1e-6);
            }
            const crown = at(b, u, 0);
            assert.ok(Math.abs(streetHeight(crown.x, crown.z) - (TOWN_LEVEL + b.rise)) < 1e-6);
        }
    }
});

test("the canal's coping is under the deck; the arch clears the water and stays under the deck", () => {
    for (const b of canalBridges()) {
        for (let v = -b.bankHalf; v <= b.bankHalf; v += 0.1) {
            for (const u of [-b.band, 0, b.band]) {
                const p = at(b, u, v);
                assert.ok(streetHeight(p.x, p.z) + ROAD_LIFT > TOWN_LEVEL + 0.18 + 0.05, `${b.street} coping through the deck at v ${v.toFixed(1)}`);
            }
            const soffit = archAt(b, v);
            if (soffit === null) continue;
            assert.ok(soffit >= CANAL_LEVEL + 0.25, `${b.street} arch in the water`);
            const p = at(b, 0, v);
            assert.ok(streetHeight(p.x, p.z) - (soffit + ARCH_RING) >= 0.1, `${b.street} arch ring through the deck at v ${v.toFixed(1)}`);
        }
    }
});

test("the street's drawn surface (what walkers and the cars stand on) lies on the deck over the crown", () => {
    const geo = new Geo();
    streetSurfaces(townPlan(), {chunkAt: () => ({decal: geo}), heightAt: streetHeight});
    for (const b of canalBridges()) {
        let found = 0;
        for (let i = 0; i < geo.pos.length; i += 9) {
            const cx = (geo.pos[i] + geo.pos[i + 3] + geo.pos[i + 6]) / 3;
            const cz = (geo.pos[i + 2] + geo.pos[i + 5] + geo.pos[i + 8]) / 3;
            const on = bridgeAt(cx, cz);
            if (!on || on.bridge !== b || Math.abs(on.v) > 0.6 || Math.abs(on.u) > b.band) continue;
            const y = (geo.pos[i + 1] + geo.pos[i + 4] + geo.pos[i + 7]) / 3;
            assert.ok(y > TOWN_LEVEL + b.rise - 0.01 && y < TOWN_LEVEL + b.rise + 0.2, `${b.street} surface at ${y.toFixed(2)}`);
            found++;
        }
        assert.ok(found > 0, `${b.street} has no surface on its crown`);
    }
});

test("the masonry: closed faces, nothing on the deck between the parapets below the coping, under 2,400 triangles a bridge", () => {
    for (const b of canalBridges()) {
        const geo = new Geo();
        const triangles = drawCanalBridge(geo, b, townHeight);
        assert.ok(triangles > 200 && triangles < 2400, `${b.street}: ${triangles} triangles`);
        let degenerate = 0;
        let onDeck = 0;
        for (let i = 0; i < geo.pos.length; i += 9) {
            const ax = geo.pos[i + 3] - geo.pos[i];
            const ay = geo.pos[i + 4] - geo.pos[i + 1];
            const az = geo.pos[i + 5] - geo.pos[i + 2];
            const bx = geo.pos[i + 6] - geo.pos[i];
            const by = geo.pos[i + 7] - geo.pos[i + 1];
            const bz = geo.pos[i + 8] - geo.pos[i + 2];
            if (Math.hypot(ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx) < 1e-7) degenerate++;
        }
        for (let i = 0; i < geo.pos.length; i += 3) {
            const on = bridgeAt(geo.pos[i], geo.pos[i + 2]);
            if (!on || on.bridge !== b || Math.abs(on.u) > b.band - 0.05) continue;
            // (The coping overhangs the walk by 7 cm a metre up: nothing stands on the deck below that.)
            const over = geo.pos[i + 1] - streetHeight(geo.pos[i], geo.pos[i + 2]);
            if (over > -0.05 && over < PARAPET.high) onDeck++;
        }
        assert.equal(degenerate, 0, `${b.street}: degenerate triangles`);
        assert.equal(onDeck, 0, `${b.street}: ${onDeck} masonry vertices on the deck`);
        assert.ok(PARAPET.high >= 0.9);
    }
});

test("no canal boat is moored under a bridge", () => {
    for (const m of townPlan().moorings) {
        if (m.harbour) continue;
        for (let t = -m.length / 2; t <= m.length / 2; t += 0.5) {
            const on = bridgeAt(m.x + Math.sin(m.turn) * t, m.z + Math.cos(m.turn) * t);
            assert.ok(!on, `a boat at ${m.x.toFixed(1)}, ${m.z.toFixed(1)} under ${on?.bridge.street}`);
        }
    }
});
