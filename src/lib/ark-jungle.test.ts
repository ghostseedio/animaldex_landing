/**
 * The jungle (lane ARK-JUNGLE, board 2026-11-20): a denser stand of the wild island's rainforest with open gaps in its
 * canopy where a swinger is seen (`islands/wild/jungle.ts`), a langur's climb up a rock's ledges (`rock-ledge.ts`) and
 * the primate house's swingers on its climbing frames (`islands/town/zoo-swing.ts`).
 */

import assert from "node:assert/strict";
import test from "node:test";
import {sampleGround, setArkWorld} from "@/ark-scene/world";

setArkWorld("v2");

const ground = (x: number, z: number) => sampleGround(x, z).height;

test("the jungle: its own list (no scenery index moves), inside its area, clear of the scenery's trunks, its gaps open", async () => {
    const {forestFill, worldDecor} = await import("@/ark-scene/decor");
    const {treeBody} = await import("@/ark-scene/tree-spacing");
    const {JUNGLE, jungleHolds, wildJungle} = await import("@/ark-scene/islands/wild/jungle");
    const fill = forestFill().length;
    const decor = worldDecor().length;
    const {trees, gaps} = wildJungle();
    assert.ok(trees.length >= 60, `${trees.length} trees`);
    assert.ok(gaps.length >= 3, `${gaps.length} gaps`);
    // Its own list: the scenery's (the hosts of homes) the same length.
    assert.equal(forestFill().length, fill);
    assert.equal(worldDecor().length, decor);
    // The same every time.
    assert.deepEqual(wildJungle().trees.slice(0, 5), trees.slice(0, 5));
    const others = [...worldDecor().filter((d) => d.kind === "tree"), ...forestFill()].filter((d) => Math.hypot(d.x - JUNGLE.x, d.z - JUNGLE.z) < JUNGLE.r + 12);
    for (const t of trees) {
        assert.ok(Math.hypot(t.x - JUNGLE.x, t.z - JUNGLE.z) <= JUNGLE.r + 1, `tree at ${t.x},${t.z} outside`);
        for (const o of others) assert.ok(Math.hypot(t.x - o.x, t.z - o.z) > 0.8, `jungle tree at ${t.x.toFixed(1)},${t.z.toFixed(1)} on a scenery tree`);
    }
    for (const g of gaps) {
        // No jungle crown's middle over a gap: its sky open.
        for (const t of trees) {
            const body = treeBody(t as never);
            if (!body) continue;
            assert.ok(Math.hypot(body.cx - g.x, body.cz - g.z) > g.r * 0.8, `a crown over the gap at ${g.x},${g.z}`);
        }
    }
    const holds = jungleHolds();
    assert.ok(holds.length > 200);
    assert.ok(holds.every((h) => /^(limb|canopy_hang|branch):jungle\d+:\d+$/.test(h.id)));
});

test("a langur of the rocks: up a rock's ledges near it, a while on top, down again; footholds of the drawn rock", async () => {
    const {climbsRock, ledgePoseAt, planLedges} = await import("@/ark-scene/rock-ledge");
    assert.equal(climbsRock("Trachypithecus francoisi"), true);
    assert.equal(climbsRock("Semnopithecus priam"), true);
    assert.equal(climbsRock("Hylobates lar"), false);
    // François' langur's ground on the real Ark (the hills, among boulders).
    const stand = {x: -3, y: ground(-3, -98), z: -98};
    let routes = 0;
    for (let s = 0; s < 12; s++) {
        const route = planLedges(stand, 1000 + s * 7919, ground);
        if (!route) continue;
        routes++;
        assert.ok(route.top.y - stand.y > 1, "the top above the ground");
        // From its spot and back to it; never under the ground; on top while it sits.
        const first = ledgePoseAt(route, 0)!;
        const last = ledgePoseAt(route, route.seconds)!;
        assert.ok(Math.hypot(first.x - stand.x, first.z - stand.z) < 0.01);
        assert.ok(Math.hypot(last.x - stand.x, last.z - stand.z) < 0.05);
        const mid = ledgePoseAt(route, (route.sitFrom + route.sitTo) / 2)!;
        assert.ok(Math.abs(mid.y - route.top.y) < 1e-6);
        let prev = first;
        for (let t = 0; t <= route.seconds; t += 0.1) {
            const f = ledgePoseAt(route, t);
            assert.ok(f, `a frame at ${t}`);
            assert.ok(f.y > ground(f.x, f.z) - 0.6, `under the ground at ${t}`);
            assert.ok(Math.hypot(f.x - prev.x, f.y - prev.y, f.z - prev.z) < 1.2, `a jump at ${t}`);
            assert.ok(f.ny > 0.4, "its back mostly up");
            prev = f;
        }
        assert.equal(ledgePoseAt(route, -1), null);
        assert.equal(ledgePoseAt(route, route.seconds + 1), null);
    }
    assert.ok(routes >= 3, `${routes} routes`);
    // No rock in reach: no climb.
    assert.equal(planLedges({x: -160, y: ground(-160, 56), z: 56}, 7, ground), null);
});

test("the primate house: a swinger up a post, along the frame's beams the way its kind goes, down, home", async () => {
    const {beamHolds, zooSwingFrame} = await import("@/ark-scene/islands/town/zoo-swing");
    // A frame of three posts 3 m apart, its beams 5 m up, on a floor at 1 m.
    const posts: Array<[number, number, number]> = [[0, 6, 0], [3, 6, 0], [6, 6, 0.5]];
    const climbs = [0, 1].map((i) => ({a: [posts[i][0], 5.52, posts[i][2]] as [number, number, number], b: [posts[i + 1][0], 5.52, posts[i + 1][2]] as [number, number, number], posts: [posts[i], posts[i + 1]] as [[number, number, number], [number, number, number]], feet: [[posts[i][0], 1, posts[i][2]], [posts[i + 1][0], 1, posts[i + 1][2]]] as [[number, number, number], [number, number, number]]}));
    const under = beamHolds(climbs, true);
    assert.ok(under.length >= 4 && under.every((h) => h.under && h.ny === -1));
    assert.ok(beamHolds(climbs, false).every((h) => !h.under && h.y > 5.52));
    const spot = {x: 2, y: 1, z: 3};
    const gibbon = {id: "gibbon-1", model_slug: "lar-gibbon", scientific_name: "Hylobates lar"};
    let seen = 0;
    let swung = false;
    let prev: {x: number; y: number; z: number} | null = null;
    for (let e = 0; e < 3000; e += 0.2) {
        const f = zooSwingFrame(gibbon, 0.6, spot, climbs, e, true);
        if (!f) {
            prev = null;
            continue;
        }
        seen++;
        if (f.phase === "swing") swung = true;
        assert.ok(f.y >= 1 - 1e-6, "never under the floor");
        assert.ok(f.y <= 6.2, "never over the frame");
        if (prev) assert.ok(Math.hypot(f.x - prev.x, f.y - prev.y, f.z - prev.z) < 1.5, `a jump at ${e}`);
        prev = f;
    }
    assert.ok(seen > 0 && swung, "out on the frame, swinging");
    // Asleep, or a kind of the ground: never.
    for (let e = 0; e < 3000; e += 1) assert.equal(zooSwingFrame(gibbon, 0.6, spot, climbs, e, false), null);
    for (let e = 0; e < 3000; e += 1) assert.equal(zooSwingFrame({id: "g", model_slug: "western-lowland-gorilla", scientific_name: "Gorilla gorilla"}, 1.6, spot, climbs, e, true), null);
});
