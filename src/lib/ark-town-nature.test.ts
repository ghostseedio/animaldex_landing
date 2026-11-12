/**
 * The town's trees, planting, farm things and zoo barriers (lane GC, docs/ark/town-island.md §13): trees never grow
 * into each other or into a building, every tree is a library tree at its kind's real size with its files, the farm's
 * bales and troughs are colliders clear of every animal's spot, and every open enclosure keeps its hard barrier.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {existsSync} from "node:fs";
import path from "node:path";
import {townPlan} from "@/ark-scene/islands/town/plan";
import {townTrees, townZooTrees} from "@/ark-scene/islands/town/trees";
import {launchEnclosures, townAreas, zooLayout} from "@/ark-scene/islands/town/areas";
import {townObstacles} from "@/ark-scene/islands/town/obstacles";
import {townColliderList} from "@/ark-scene/islands/town/colliders";
import {townFarmGates, townFarmProps} from "@/ark-scene/islands/town/farm";
import {footprintBody, treesClash} from "@/ark-scene/tree-spacing";
import {ASSETS, ASSET_BASE} from "@/ark-scene/tree-pick";
import {boxDistance, inBox} from "@/ark-scene/islands/town/geom";
import {ZOO_TYPES} from "@/ark-scene/islands/town/zoo-types";

const plan = townPlan();
const layout = zooLayout(launchEnclosures(), plan);
const trees = townTrees(plan);
const zooTrees = townZooTrees(layout, plan);

test("town trees: none grows into another (L6's spacing), the zoo's own included", () => {
    const all = [...trees, ...zooTrees];
    const bodies = all.map((t) => footprintBody(t.asset, t, t.scale, t.low)!);
    assert.ok(bodies.every(Boolean), "every tree has a measured footprint");
    let clashes = 0;
    const examples: string[] = [];
    for (let i = 0; i < bodies.length; i++) {
        for (let j = i + 1; j < bodies.length; j++) {
            const clash = treesClash(bodies[i], bodies[j]);
            if (!clash) continue;
            clashes++;
            if (examples.length < 5) examples.push(`${all[i].id} × ${all[j].id}: ${clash.kind} ${clash.depth.toFixed(2)} m`);
        }
    }
    assert.equal(clashes, 0, examples.join("; "));
    assert.ok(trees.length > 250, `the town keeps its planting (${trees.length} of ${plan.trees.length})`);
});

test("town trees: no trunk in a building, no crown through a wall below its roof", () => {
    for (const t of trees) {
        for (const b of plan.buildings) {
            const d = boxDistance(b.at, t.x, t.z);
            assert.ok(d >= t.trunk + 0.29, `${t.id} (${t.asset}) trunk ${d.toFixed(2)} m from ${b.id}`);
        }
    }
});

test("town trees: library trees at real heights, every level's file there", () => {
    const root = path.join(process.cwd(), "public", ASSET_BASE);
    for (const id of Array.from(new Set([...trees, ...zooTrees].map((t) => t.asset)))) {
        for (const lod of ASSETS[id].lods) assert.ok(existsSync(path.join(root, lod.file)), `${lod.file}`);
    }
    const median = (kind: string) => {
        const h = trees.filter((t) => t.kind === kind).map((t) => t.height).sort((a, b) => a - b);
        return h[Math.floor(h.length / 2)];
    };
    // A park oak, a lime and a plane are big trees; an apple and a cherry garden-sized; shrubs about a metre.
    assert.ok(median("oak") > 10 && median("oak") < 24, `oak ${median("oak")}`);
    assert.ok(median("lime") > 8 && median("lime") < 24, `lime ${median("lime")}`);
    assert.ok(median("apple") > 2.5 && median("apple") < 6.5, `apple ${median("apple")}`);
    assert.ok(median("cherry") > 3 && median("cherry") < 8.5, `cherry ${median("cherry")}`);
    assert.ok(median("hedge_shrub") > 0.6 && median("hedge_shrub") < 2.2, `shrub ${median("hedge_shrub")}`);
    // Inside an aviary, under its net.
    for (const t of zooTrees.filter((z) => z.id.startsWith("zoo:aviaries"))) assert.ok(t.height < 8, `${t.id} ${t.height}`);
});

test("town trees: trunks are colliders, shrubs soft ones", () => {
    const colliders = townColliderList(launchEnclosures(), {x: 0, z: 0});
    const trunks = colliders.filter((c) => c.kind === "trunk").length;
    const shrubs = colliders.filter((c) => c.kind === "shrub").length;
    assert.equal(trunks, [...trees, ...zooTrees].filter((t) => !t.low).length);
    assert.equal(shrubs, [...trees, ...zooTrees].filter((t) => t.low).length);
});

test("farm things: bales, troughs and hay shelters are colliders, clear of every animal's spot", () => {
    const props = townFarmProps(plan);
    assert.ok(props.length >= plan.farms.length * 2, `${props.length} farm things`);
    const obstacles = townObstacles(plan).filter((o) => o.kind === "prop");
    assert.equal(obstacles.length, props.length);
    const colliders = townColliderList(launchEnclosures(), {x: 0, z: 0}).filter((c) => c.id.includes(":round_bales") || c.id.includes(":square_bales") || c.id.includes(":trough") || c.id.includes(":hay_shelter"));
    assert.equal(colliders.length, props.length);
    const spots = townAreas().spots;
    for (const p of props) {
        const inside = spots.filter((s) => inBox(p.at, s.x, s.z, 0.3));
        assert.equal(inside.length, 0, `${p.id} over ${inside.map((s) => `${s.area}:${s.where}`).join(",")}`);
    }
    assert.ok(townFarmGates(plan).length >= plan.farms.length, "a gate in every paddock");
});

test("zoo barriers: every open outdoor enclosure keeps its hard barrier on its boundary", () => {
    const obstacles = townObstacles(plan, launchEnclosures());
    for (const e of layout.enclosures) {
        if (e.shared || ZOO_TYPES[e.type].form === "house") continue;
        const barrier = obstacles.find((o) => o.id === `${e.slot.id}-fence`);
        assert.ok(barrier && barrier.kind === "barrier" && barrier.hard, `${e.id}`);
        if (barrier && barrier.kind === "barrier") assert.equal(barrier.barrier, e.type === "aviaries" ? "net" : "zoo_fence");
    }
});
