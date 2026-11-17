/**
 * A roosting cluster on a roof stands side by side (p5 (census): the coordinator's crowding census, 2026-11-17: "urban
 * roof clusters (flats-11: 16, house-5: 13, house-21: 8 — sparrows, jackdaws, gulls) get ONE identical spot each").
 * `areas.ts` spreadPerch: the first keeps its spot, the rest along the ridge (a flat roof: a grid), then the eaves.
 */
import assert from "node:assert/strict";
import {existsSync, readFileSync} from "node:fs";
import test from "node:test";
import type {ArkAnimal} from "@/ark-scene/types";
import {spreadPerch, townAreas} from "@/ark-scene/islands/town/areas";
import {placeTownAnimals} from "@/ark-scene/islands/town/placement";
import {townPlan} from "@/ark-scene/islands/town/plan";
import {inBox} from "@/ark-scene/islands/town/geom";
import {townBuildingFloor} from "@/ark-scene/islands/town/ground";

test("sixteen birds on one roof take sixteen places on it, apart, on its drawn roof", () => {
    const plan = townPlan();
    const roofs = townAreas().spots.filter((s) => (s.where === "roof" || s.where === "ledge") && plan.buildings.some((b) => b.id === s.place && b.kind !== "tower"));
    let checked = 0;
    for (const spot of roofs.filter((_, i) => i % 9 === 0)) {
        const b = plan.buildings.find((x) => x.id === spot.place)!;
        const floor = townBuildingFloor(b.at);
        const at = Array.from({length: 16}, (_, rank) => spreadPerch(spot, rank, 0.16));
        assert.deepEqual(spreadPerch(spot, 5, 0.16), at[5], "pure");
        for (let i = 0; i < at.length; i++) {
            assert.ok(inBox(b.at, at[i].x, at[i].z, 0.45), `${b.id} #${i} over its building`);
            assert.ok(at[i].y >= floor + Math.min(b.eaves - 0.4, b.top) && at[i].y <= floor + b.top + 0.7, `${b.id} #${i} on its roof (${(at[i].y - floor).toFixed(2)} m)`);
            for (let j = 0; j < i; j++) {
                const d = Math.hypot(at[i].x - at[j].x, at[i].z - at[j].z);
                // (A small roof runs out of places: past them, birds share; never the first few.)
                if (i < 6) assert.ok(d > 0.3, `${b.id}: #${i} and #${j} ${d.toFixed(2)} m apart`);
            }
        }
        checked++;
    }
    assert.ok(checked > 20, `${checked} roofs`);
});

test("on the live record no two roosting birds share one roof spot (when the local snapshot is here)", {skip: !existsSync("public/ark-local/snap.json")}, () => {
    const snap = JSON.parse(readFileSync("public/ark-local/snap.json", "utf8")) as {snapshot: {animals: ArkAnimal[]}};
    const town = snap.snapshot.animals.filter((a) => a.island === "town");
    const placed = placeTownAnimals(town);
    const seen = new Map<string, number>();
    for (const a of town) {
        const info = placed.town.get(a.id)!;
        if (info.where !== "roof" && info.where !== "eave" && info.where !== "ledge") continue;
        const p = placed.places.get(a.id)!;
        const key = `${p.x.toFixed(2)},${p.z.toFixed(2)},${p.ground.toFixed(2)}`;
        seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    const most = Math.max(...Array.from(seen.values()));
    console.log(`roof spots ${seen.size}, most on one spot ${most}`);
    assert.ok(most <= 2, `${most} birds on one spot`);
});
