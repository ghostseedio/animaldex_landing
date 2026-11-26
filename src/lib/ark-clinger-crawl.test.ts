/**
 * A clinger's crawl from the ground to the ground goes round what is solid on its straight line, never through it
 * (SPECIES-ANIM-B2, 2026-11-24: a common wall gecko's forage ran 0.52 m into a boulder, rock:decor1205, on the v2 island).
 */
import assert from "node:assert/strict";
import test from "node:test";
import {crawlRound, type ScheduleWorld, type Spot} from "@/ark-scene/behaviour-schedule";
import {ColliderSet, type Collider} from "@/ark-scene/collide/colliders";

const spot = (x: number, z: number): Spot => ({x, y: 1, z, nx: 0, ny: 1, nz: 0, point: null});
const rock = (cx: number, cz: number, r: number): Collider => ({shape: "circle", kind: "rock", id: `rock:${cx},${cz}`, cx, cz, r, reach: r, y0: 0, y1: 2, gap: 0} as unknown as Collider);
const worldWith = (list: Collider[]): ScheduleWorld => ({sampler: {heightAt: () => 1}, nav: {colliders: new ColliderSet(list, "t")}} as unknown as ScheduleWorld);

test("clinger crawl: a boulder on the straight line is crawled round, every run clear of it", () => {
    const set = new ColliderSet([rock(0, 0, 2)], "t");
    const world = worldWith([rock(0, 0, 2)]);
    const bodyR = 0.05;
    assert.equal(set.segmentClear(-6, 0, 6, 0, bodyR), false);
    const way = crawlRound(world, spot(-6, 0), spot(6, 0), bodyR)!;
    assert.ok(way && way.length > 2, "a way round, corner to corner");
    assert.deepEqual(way[0], {x: -6, z: 0});
    assert.deepEqual(way[way.length - 1], {x: 6, z: 0});
    for (let i = 1; i < way.length; i++) assert.ok(set.segmentClear(way[i - 1].x, way[i - 1].z, way[i].x, way[i].z, bodyR), `run ${i} is clear`);
});

test("clinger crawl: two rocks in a row, still round both; walled in, no way (the caller keeps its straight crawl)", () => {
    const two = [rock(-2, 0, 1), rock(3, 0, 1.5)];
    const set = new ColliderSet(two, "t");
    const way = crawlRound(worldWith(two), spot(-8, 0), spot(8, 0), 0.05)!;
    for (let i = 1; i < way.length; i++) assert.ok(set.segmentClear(way[i - 1].x, way[i - 1].z, way[i].x, way[i].z, 0.05));
    // (Its end inside a rock: nothing reaches it.)
    assert.equal(crawlRound(worldWith([rock(6, 0, 2)]), spot(-6, 0), spot(6, 0), 0.05), null);
});
