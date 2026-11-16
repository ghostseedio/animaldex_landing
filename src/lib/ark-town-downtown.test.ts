/**
 * The town's downtown (pass 2, lane LAND; the owner, 2026-11-16: "could do with a couple very tall buildings in the town
 * too and billboards with night lights and an area for a giant christmas tree with fairy lights, the island doesn't have
 * to be round it can be an obscure shape if you need to add extra land"):
 * - the headland is land and the town's square still has sea all round; its streets join the town's;
 * - three towers of 10–25 storeys, on land, off the streets, each with a peregrine's ledge;
 * - the billboards stand on land off the carriageways (or on their tower's roof), and nothing else stands in them;
 * - the tree's season by the island clock, its lights on its boughs; the offices' windows by the clock.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {boxesOverlap, inBox, polylineNearest} from "@/ark-scene/islands/town/geom";
import {coastNorm, DOWNTOWN_LOBE, inland, TOWN_HALF, townPlan} from "@/ark-scene/islands/town/plan";
import {sampleTownGround} from "@/ark-scene/islands/town/ground";
import {windowLit} from "@/ark-scene/islands/town/people";
import {christmasSeason, christmasTree, CHRISTMAS_TREE} from "@/ark-scene/islands/town/render/downtown";

const NEW_STREETS = ["sea_view_south", "west_street_south", "tower_row"];

test("the headland is land, the square's edge still sea, and the downtown's streets join the town's", () => {
    assert.ok(inland(DOWNTOWN_LOBE.x, DOWNTOWN_LOBE.z) > 20, "the headland's middle is well inland");
    assert.ok(sampleTownGround(DOWNTOWN_LOBE.x, DOWNTOWN_LOBE.z).height > 2, "and at the town's level");
    for (let x = -TOWN_HALF + 2; x <= TOWN_HALF - 2; x += 8) for (const z of [-TOWN_HALF + 2, TOWN_HALF - 2]) assert.ok(coastNorm(x, z) > 1 && inland(x, z) < 0, `sea at ${x}, ${z}`);
    for (let z = -TOWN_HALF + 2; z <= TOWN_HALF - 2; z += 8) for (const x of [-TOWN_HALF + 2, TOWN_HALF - 2]) assert.ok(coastNorm(x, z) > 1 && inland(x, z) < 0, `sea at ${x}, ${z}`);
    const plan = townPlan();
    for (const id of NEW_STREETS) {
        const s = plan.streets.find((q) => q.id === id)!;
        assert.ok(s, id);
        for (const end of [s.line[0], s.line[s.line.length - 1]]) {
            const joined = plan.streets.some((o) => o.id !== id && polylineNearest(o.line, end.x, end.z).distance < 0.5);
            assert.ok(joined, `${id} joins another street at ${end.x}, ${end.z}`);
        }
        for (const p of s.line) assert.ok(inland(p.x, p.z) > 8, `${id} on land at ${p.x}, ${p.z}`);
    }
});

test("three towers of 10 to 25 storeys, on land, off the streets, with a peregrine's ledge", () => {
    const plan = townPlan();
    const towers = plan.buildings.filter((b) => b.kind === "tower");
    assert.equal(towers.length, 3);
    for (const t of towers) {
        assert.ok(t.floors >= 10 && t.floors <= 25, `${t.id} ${t.floors} storeys`);
        assert.ok(t.tall && t.tall.y > 30, `${t.id} a tall ledge`);
        assert.equal(t.households, 0, "offices: the town's 360 households are unchanged");
        for (const s of plan.streets) {
            const d = polylineNearest(s.line, t.at.x, t.at.z).distance;
            assert.ok(d > Math.hypot(t.at.w, t.at.d) / 2 + s.width / 2 + s.pavement - 6, `${t.id} clear of ${s.id}`);
        }
    }
});

test("the billboards: on land, off the carriageways and pavements, in nothing (or on their tower's roof)", () => {
    const plan = townPlan();
    assert.ok(plan.downtown.billboards.length >= 3);
    for (const b of plan.downtown.billboards) {
        assert.ok(inland(b.x, b.z) > 4, `${b.id} on land`);
        const right = {x: Math.cos(b.turn), z: -Math.sin(b.turn)};
        for (const u of [-b.w / 2, 0, b.w / 2]) {
            const x = b.x + right.x * u;
            const z = b.z + right.z * u;
            if (b.on) {
                const on = plan.buildings.find((q) => q.id === b.on)!;
                assert.ok(inBox(on.at, x, z, -0.4), `${b.id} on its roof, inside the parapet`);
                continue;
            }
            for (const s of plan.streets) assert.ok(polylineNearest(s.line, x, z).distance > s.width / 2 + s.pavement + 0.3, `${b.id} off ${s.id}`);
            for (const q of plan.buildings) assert.ok(!inBox(q.at, x, z, 0.5), `${b.id} clear of ${q.id}`);
        }
    }
    // Nothing of the plaza's middle is a building: the tree has its room.
    const t = plan.downtown.tree;
    for (const q of plan.buildings) assert.ok(!boxesOverlap(q.at, {x: t.x, z: t.z, w: 12, d: 12, rot: 0}, 0), `${q.id} clear of the tree`);
});

test("the Christmas tree's season is 15 November to 6 January by the island clock, its lights on its boughs", () => {
    const day = (iso: string) => ({hours: 20, day: Math.floor(Date.parse(iso) / 86_400_000) + 4});
    assert.equal(christmasSeason(day("2026-11-14T12:00:00Z")), false);
    assert.equal(christmasSeason(day("2026-11-15T12:00:00Z")), true);
    assert.equal(christmasSeason(day("2026-12-25T12:00:00Z")), true);
    assert.equal(christmasSeason(day("2027-01-06T12:00:00Z")), true);
    assert.equal(christmasSeason(day("2027-01-07T12:00:00Z")), false);
    assert.equal(christmasSeason(day("2026-07-01T12:00:00Z")), false);
    const {lights} = christmasTree({x: 0, z: 0}, 2.6);
    const bulbs = lights.pos.length / 9;
    assert.ok(bulbs >= CHRISTMAS_TREE.bulbs * 10, `every bulb drawn (a box each): ${bulbs} triangles`);
    for (let i = 0; i < lights.pos.length; i += 3) {
        const r = Math.hypot(lights.pos[i], lights.pos[i + 2]);
        const y = lights.pos[i + 1] - 2.6;
        assert.ok(y > 0 && y < CHRISTMAS_TREE.height + 1.5, `a light at ${y.toFixed(1)} m`);
        assert.ok(r < 6.2 * (1 - y / (CHRISTMAS_TREE.height + 2)) + 1.0, `a light ${r.toFixed(2)} m out at ${y.toFixed(1)} m: on the boughs`);
    }
});

test("the towers' offices: dim by day, many lit into the evening, a few all night", () => {
    const share = (hours: number, day = 20410) => {
        let lit = 0;
        let sum = 0;
        for (let k = 0; k < 600; k++) {
            const v = windowLit({building: `tower-${1 + (k % 3)}`, owner: "office", household: k, floor: 2 + (k % 20), seed: k * 7919}, {hours, day});
            if (v > 0) lit++;
            sum += v;
        }
        return {lit: lit / 600, mean: sum / Math.max(lit, 1)};
    };
    // (Day 20410 is a Tuesday: weekday 20410 % 7 = 5, a weekday.)
    const noon = share(12);
    assert.ok(noon.lit > 0.8 && noon.mean < 0.4, `noon ${JSON.stringify(noon)}`);
    const evening = share(20.5);
    assert.ok(evening.lit > 0.25 && evening.lit < 0.75 && evening.mean > 0.9, `evening ${JSON.stringify(evening)}`);
    const night = share(3);
    assert.ok(night.lit > 0.03 && night.lit < 0.25, `night ${JSON.stringify(night)}`);
});
