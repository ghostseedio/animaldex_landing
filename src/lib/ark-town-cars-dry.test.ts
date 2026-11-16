/**
 * No town car stands or drives in the water (the owner, 2026-11-16: "there seems to be cars in the water in the dock
 * area by the lighthouse"): the harbour's car park stood inside the harbour basin.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {carOverWater, townParking, townTraffic} from "@/ark-scene/islands/town/render/vehicles";
import {HARBOUR_BAYS, carSpots} from "@/ark-scene/islands/town/areas";
import {sampleTownGround} from "@/ark-scene/islands/town/ground";
import {CANAL, CANAL_WIDTH} from "@/ark-scene/islands/town/plan";
import {polylineWithin} from "@/ark-scene/islands/town/geom";

const wet = (x: number, z: number) => {
    const surface = sampleTownGround(x, z).surface;
    return surface === "water" || surface === "sea";
};

test("every parked car's whole footprint is on dry ground, the harbour's car park among them", () => {
    const spots = townParking();
    const inWater = spots.filter((s) => carOverWater(s.x, s.z, s.turn));
    assert.deepEqual(inWater.map((s) => s.id), []);
    // The harbour's bays are all still there (none dropped as blocked).
    assert.equal(spots.filter((s) => s.kind === "harbour").length, HARBOUR_BAYS.length);
    for (const s of carSpots()) assert.ok(!wet(s.x, s.z), `${s.id} in the water`);
});

test("the moving cars' lanes are on dry ground but for the bridges over the canal", () => {
    const traffic = townTraffic();
    let checked = 0;
    for (const path of traffic.paths) {
        for (let i = 0; i < path.x.length; i++) {
            const x = path.x[i];
            const z = path.z[i];
            checked++;
            if (!wet(x, z)) continue;
            assert.ok(polylineWithin(CANAL, x, z, CANAL_WIDTH / 2 + 2), `a lane in the water at ${x.toFixed(1)}, ${z.toFixed(1)} (${path.id})`);
        }
    }
    assert.ok(checked > 100);
});
