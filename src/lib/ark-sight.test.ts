/**
 * The close-up's line of sight (`runtime/sight.ts`) and the views it tries (`runtime/camera.ts` closeUpViews): the
 * map lane's follow-up of the graphics pass (2026-11-14).
 */

import assert from "node:assert/strict";
import test from "node:test";
import {BoxGeometry, DoubleSide, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, PlaneGeometry, Vector3} from "three";
import {closeUpViews} from "@/ark-scene/runtime/camera";
import {Sight, solid} from "@/ark-scene/runtime/sight";

test("sight: a solid thing between the eye and the animal blocks; glass, a hidden thing, the weather and ground cover do not", () => {
    const root = new Group();
    const wall = new Mesh(new BoxGeometry(4, 3, 0.3), new MeshBasicMaterial());
    wall.position.set(0, 1.5, 5);
    wall.name = "solid";
    root.add(wall);
    root.updateMatrixWorld(true);
    const sight = new Sight(root);
    const eye = new Vector3(0, 1.5, 0);
    const animal = new Vector3(0, 1, 10);
    assert.equal(sight.blocked(eye, animal, 0.5), true, "the wall stands between");
    assert.equal(sight.blocked(eye, new Vector3(0, 1, 4), 0.5), false, "an animal in front of the wall");
    assert.equal(sight.blocked(eye, new Vector3(6, 1, 10), 0.5), false, "past the wall's end");
    // The animal's own last metres are never counted: something right at it (its perch, its own body) does not block.
    assert.equal(sight.blocked(eye, new Vector3(0, 1.5, 5.3), 0.6), false);
    // Glass, water and nets are seen through.
    (wall.material as MeshBasicMaterial).transparent = true;
    assert.equal(sight.blocked(eye, animal, 0.5), false, "see-through");
    (wall.material as MeshBasicMaterial).transparent = false;
    // What is not drawn does not block (a streamed-out chunk, a hidden level).
    wall.visible = false;
    assert.equal(sight.blocked(eye, animal, 0.5), false, "hidden");
    wall.visible = true;
    const holder = new Group();
    root.remove(wall);
    holder.add(wall);
    root.add(holder);
    holder.visible = false;
    assert.equal(sight.blocked(eye, animal, 0.5), false, "inside a hidden group");
    holder.visible = true;
    assert.equal(sight.blocked(eye, animal, 0.5), true);
    // The weather, markers and rings, by name.
    wall.name = "rain";
    assert.equal(sight.blocked(eye, animal, 0.5), false);
    wall.name = "solid";
    // A wall seen from behind is not drawn, so it does not hide anything either (the eye inside a house looking out).
    const sheet = new Mesh(new PlaneGeometry(4, 3), new MeshBasicMaterial());
    sheet.position.set(20, 1.5, 5);
    sheet.rotation.y = Math.PI;
    root.add(sheet);
    root.updateMatrixWorld(true);
    assert.equal(sight.blocked(new Vector3(20, 1.5, 0), new Vector3(20, 1, 10), 0.5), true, "its face is toward the eye");
    assert.equal(sight.blocked(new Vector3(20, 1.5, 10), new Vector3(20, 1, 0), 0.5), false, "from behind: culled, as drawn");
    (sheet.material as MeshBasicMaterial).side = DoubleSide;
    assert.equal(sight.blocked(new Vector3(20, 1.5, 10), new Vector3(20, 1, 0), 0.5), true, "two-sided: drawn from both");
    // Ground cover (thousands of instances) is never asked; a stand of a few trees is.
    const few = new InstancedMesh(new BoxGeometry(1, 4, 1), new MeshBasicMaterial(), 3);
    few.setMatrixAt(0, new Matrix4().makeTranslation(40, 2, 5));
    few.setMatrixAt(1, new Matrix4().makeTranslation(60, 2, 5));
    few.setMatrixAt(2, new Matrix4().makeTranslation(80, 2, 5));
    root.add(few);
    root.updateMatrixWorld(true);
    assert.equal(sight.blocked(new Vector3(40, 1.5, 0), new Vector3(40, 1, 10), 0.5), true, "a trunk");
    const cover = new InstancedMesh(new BoxGeometry(1, 4, 1), new MeshBasicMaterial(), 3000);
    assert.equal(solid(cover), false, "ground cover");
    assert.equal(solid(few), true);
});

test("sight: the views tried for a close-up: the asked one first, then round it, steeper, nearer, overhead", () => {
    const asked = {distance: 12, polar: 1.13, azimuth: 0.4};
    const views = closeUpViews(asked, 4);
    assert.equal(views[0], asked, "the asked view first: nothing changes when it is clear");
    assert.ok(views.length >= 30 && views.length <= 40, `${views.length} views`);
    // The first others are the nearest bearings each side, at the asked height and distance.
    assert.ok(Math.abs(Math.abs(views[1].azimuth - asked.azimuth) - Math.PI / 4) < 1e-9 && views[1].polar === asked.polar && views[1].distance === asked.distance);
    assert.ok(Math.abs(Math.abs(views[2].azimuth - asked.azimuth) - Math.PI / 4) < 1e-9 && views[2].azimuth !== views[1].azimuth);
    const seen = new Set<string>();
    for (const view of views) {
        assert.ok(view.distance >= 4 - 1e-9 && view.distance <= asked.distance + 1e-9, "never further than asked, never nearer than allowed");
        assert.ok(view.polar <= asked.polar + 1e-9 && view.polar >= 0.2 - 1e-9, "never lower than asked");
        const key = `${view.distance.toFixed(3)}|${view.polar.toFixed(3)}|${(((view.azimuth % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)).toFixed(3)}`;
        assert.ok(!seen.has(key), `no view twice (${key})`);
        seen.add(key);
    }
    assert.ok(views.some((view) => view.polar < 0.9 && view.distance === asked.distance), "steeper");
    assert.ok(views.some((view) => view.distance < asked.distance), "nearer");
    // A view already at its nearest and steep: only round it and overhead.
    const tight = closeUpViews({distance: 4, polar: 0.8, azimuth: 0}, 4);
    for (const view of tight) assert.equal(view.distance, 4);
    assert.ok(tight.length >= 9);
});
