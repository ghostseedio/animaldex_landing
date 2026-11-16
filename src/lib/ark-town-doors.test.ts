/**
 * Graphics pass 1, lane PROPS (the owner's "fishtanks outside houses are in front of the door blocking it"): by rule
 * over every home on the town island, nothing of a garden stands on a door's step or on the path to it (`doors.ts`).
 */

import assert from "node:assert/strict";
import test from "node:test";
import {townPlan} from "@/ark-scene/islands/town/plan";
import {binSpots, townHouseholds} from "@/ark-scene/islands/town/areas";
import {homeSites} from "@/ark-scene/islands/town/tanks";
import {townTrees} from "@/ark-scene/islands/town/trees";
import {townBikeSpots} from "@/ark-scene/islands/town/render/vehicles";
import {boxesOverlap, clearOfDoors, homeDoors, houseDoorU, spotBox, townDoorWays} from "@/ark-scene/islands/town/doors";
import {inBox, toLocal} from "@/ark-scene/islands/town/geom";

const plan = townPlan();
const ways = townDoorWays(plan);

test("every home has its doors: one front door a house and a block, a front and a back door per terrace home", () => {
    const houses = plan.buildings.filter((b) => b.kind === "house").length;
    const terraces = plan.buildings.filter((b) => b.kind === "terrace").reduce((n, b) => n + b.households, 0);
    const blocks = plan.buildings.filter((b) => b.kind === "flats").length;
    assert.equal(ways.length, houses + terraces * 2 + blocks);
    // Each front door has its path out to the street edge of its garden (a block's door on its courtyard: none).
    assert.equal(ways.filter((w) => w.door.side === "front" && !w.path && !w.building.startsWith("flats")).length, 0);
    // A house's door is near one end of its front, inside the wall.
    for (const b of plan.buildings.filter((q) => q.kind === "house")) assert.ok(Math.abs(houseDoorU(b)) + 0.5 < b.at.w / 2, b.id);
});

test("no garden room, balcony or patio display, or garden pond stands on a door's step or its path", () => {
    const bad: string[] = [];
    homeSites(townHouseholds(plan), plan).forEach((site, id) => {
        if (!site) return;
        if (site.kind !== "balcony" && !clearOfDoors(site.box, 0.05, plan)) bad.push(`${id} ${site.kind}`);
        if (site.pond && !clearOfDoors(site.pond, 0.05, plan)) bad.push(`${id} pond`);
        for (const form of ["tank", "cage", "vivarium"] as const) {
            const d = site.displays[form];
            if (site.kind !== "balcony" && !clearOfDoors({x: d.x, z: d.z, w: d.w, d: d.d, rot: d.rot}, 0.05, plan)) bad.push(`${id} ${form}`);
        }
    });
    assert.deepEqual(bad, []);
});

test("a terrace home's garden room stays in its own yard, clear of its back door, and keeps a useful width", () => {
    const byId = new Map(plan.buildings.map((b) => [b.id, b]));
    homeSites(townHouseholds(plan), plan).forEach((site, id) => {
        if (!site || site.kind !== "garden_room") return;
        const [bid, k] = id.split("#");
        const b = byId.get(bid)!;
        assert.ok(site.box.w >= 1.6, `${id} ${site.box.w}`);
        if (b.kind !== "terrace") return;
        const share = b.at.w / b.households;
        const lo = -b.at.w / 2 + share * Number(k);
        const c = toLocal(b.at, site.box.x, site.box.z);
        assert.ok(c.x - site.box.w / 2 >= lo + 0.1 && c.x + site.box.w / 2 <= lo + share - 0.1, `${id} out of its yard`);
        for (const door of homeDoors(b)) {
            if (door.side !== "back") continue;
            assert.ok(Math.abs(c.x - door.u) >= site.box.w / 2 + door.w / 2, `${id} on ${door.home}'s back door`);
        }
    });
});

test("no tree, shrub, bin or bicycle stands on a door's step or the path to it", () => {
    const bad: string[] = [];
    for (const t of townTrees(plan)) if (!clearOfDoors(spotBox(t, 0.6), 0, plan)) bad.push(`tree ${t.kind} ${t.x.toFixed(1)},${t.z.toFixed(1)}`);
    for (const bin of binSpots(plan)) if (!clearOfDoors(spotBox(bin.home, 0.7), 0, plan)) bad.push(`bin ${bin.id}`);
    for (const bike of townBikeSpots(plan)) if (!clearOfDoors(spotBox(bike, 0.5), 0, plan)) bad.push(`bike ${bike.id}`);
    assert.deepEqual(bad, []);
});

/**
 * The plan's own crowding, not a garden's: terrace-13 (Sea View) stands 1.4 m behind terrace-11's last home, so that
 * home's back door opens almost onto its wall. Left for the plan (pass 2); every other door is clear.
 */
const PLAN_CROWDED = new Set(["terrace-11 back3 into terrace-13"]);

test("no door's step or path runs through a building", () => {
    const bad: string[] = [];
    for (const way of ways) {
        for (const b of plan.buildings) {
            if (b.id === way.building) continue;
            if (boxesOverlap(way.apron, b.at, -0.05) || (way.path && boxesOverlap(way.path, b.at, -0.05))) bad.push(`${way.building} ${way.door.side}${way.door.home} into ${b.id}`);
        }
    }
    assert.deepEqual(bad.filter((x) => !PLAN_CROWDED.has(x)), []);
});

test("the rule itself: a box on a door's step is caught, one clear of it is not", () => {
    const way = ways.find((w) => w.path)!;
    assert.equal(clearOfDoors(spotBox(way.apron, 0.4), 0, plan), false);
    assert.equal(clearOfDoors(spotBox({x: way.path!.x, z: way.path!.z}, 0.4), 0, plan), false);
    assert.ok(inBox(way.apron, way.apron.x, way.apron.z));
    assert.equal(clearOfDoors({x: way.apron.x + 400, z: way.apron.z + 400, w: 1, d: 1, rot: 0}, 0, plan), true);
});
