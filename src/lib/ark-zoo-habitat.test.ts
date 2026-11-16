/**
 * The zoo's habitats (p2, lane ZOO; the owner, 2026-11-16: "the gorilla enclosure looks unbelievably basic - check the
 * other enclosures too"): every hall and paddock is dressed (rockwork, climbing frames, pools, planting), nothing that
 * stands on the ground is put on a resident's spot (where each animal is placed; an indoor one is held there), every
 * item is inside its enclosure, and no triangle is degenerate (a zero normal shades NaN: the post-processing then
 * spread black over half the picture while this was built).
 */
import assert from "node:assert/strict";
import test from "node:test";
import type {BufferGeometry, Mesh} from "three";
import {zooEnclosures, zooSpotsOf} from "@/ark-scene/islands/town/areas";
import {toLocal} from "@/ark-scene/islands/town/geom";
import {buildZooHouses} from "@/ark-scene/islands/town/render/zoo-houses";
import {buildZooScenery} from "@/ark-scene/islands/town/render/scenery";
import {zooLayout, launchEnclosures} from "@/ark-scene/islands/town/areas";

const enclosures = zooEnclosures();

test("every zoo house but the aquarium is dressed, clear of its residents' spots and inside its walls", () => {
    const houses = buildZooHouses(enclosures);
    try {
        const halls = enclosures.filter((e) => !e.shared && e.indoor && e.type !== "aquarium");
        assert.equal(houses.habitats.length, halls.length);
        for (const plot of houses.habitats) {
            const kinds = new Set(plot.footprints.map((f) => f.what));
            assert.ok(plot.footprints.length >= 12, `${plot.box.x},${plot.box.z}: ${plot.footprints.length} things`);
            for (const want of ["rockwork", "plant"]) assert.ok(kinds.has(want), `a hall has ${want}`);
            for (const f of plot.footprints) {
                for (const s of plot.spots) assert.ok(Math.hypot(s.x - f.x, s.z - f.z) >= f.r + plot.clearance - 1e-9, `${f.what} clear of a spot`);
                assert.ok(Math.abs(f.x) <= plot.box.w / 2 + 1e-9 && Math.abs(f.z) <= plot.box.d / 2 + 1e-9, `${f.what} inside the hall`);
            }
        }
        // The great apes' hall has its climbing frame, tree and pool.
        const apes = houses.habitats.find((p) => p.footprints.some((f) => f.what === "post"));
        assert.ok(apes, "the primate house has a climbing frame");
        assert.ok(apes.footprints.filter((f) => f.what === "post").length >= 3);
        // (Its spots are the placement's: the same list `zooSpots` places the residents on.)
        const primate = enclosures.find((e) => e.type === "primate_house" && !e.shared)!;
        assert.equal(apes.spots.length, zooSpotsOf(primate).length);
    } finally {
        houses.dispose();
    }
});

function degenerate(geometry: BufferGeometry): number {
    const n = geometry.getAttribute("normal");
    const p = geometry.getAttribute("position");
    let bad = 0;
    for (let i = 0; i < n.count; i++) {
        const l = Math.hypot(n.getX(i), n.getY(i), n.getZ(i));
        if (!Number.isFinite(l) || l < 0.5 || !Number.isFinite(p.getX(i) + p.getY(i) + p.getZ(i))) bad++;
    }
    return bad;
}

test("no degenerate or non-finite triangle in the zoo houses' meshes", () => {
    const houses = buildZooHouses(enclosures);
    try {
        houses.group.traverse((o) => {
            const mesh = o as Mesh;
            if (mesh.isMesh) assert.equal(degenerate(mesh.geometry), 0, mesh.name);
        });
    } finally {
        houses.dispose();
    }
});

test("no degenerate or non-finite triangle in the zoo's outdoor scenery", () => {
    const zoo = buildZooScenery(zooLayout(launchEnclosures()));
    let checked = 0;
    zoo.chunks.forEach((c) => {
        for (const geo of [c.solid, c.net]) {
            if (!geo.triangles) continue;
            assert.equal(degenerate(geo.toGeometry()), 0);
            checked++;
        }
    });
    assert.ok(checked > 0);
    void toLocal;
});
