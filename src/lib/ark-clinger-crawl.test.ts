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

/** The first search (#126), every run's clearance checked before it is relaxed: the reference the A* must match. */
function eager(world: ScheduleWorld, from: Spot, to: Spot, bodyR: number): Array<{x: number; z: number}> | null {
    const solid = world.nav.colliders!;
    const flat = Math.hypot(to.x - from.x, to.z - from.z);
    const near = solid.near((from.x + to.x) / 2, (from.z + to.z) / 2, flat / 2 + 12, []).filter((c) => c.reach <= 12);
    const nodes: Array<{x: number; z: number}> = [{x: from.x, z: from.z}, {x: to.x, z: to.z}];
    for (const c of near) {
        const r = c.reach + bodyR + 0.3;
        for (let k = 0; k < 12; k++) {
            const a = (k / 12) * Math.PI * 2;
            const x = c.cx + Math.sin(a) * r;
            const z = c.cz + Math.cos(a) * r;
            if (!solid.blocked(x, z, bodyR) && world.sampler.heightAt(x, z) > 0) nodes.push({x, z});
        }
    }
    const n = nodes.length;
    const dist = new Array<number>(n).fill(Infinity);
    const prev = new Array<number>(n).fill(-1);
    const done = new Array<boolean>(n).fill(false);
    dist[0] = 0;
    for (;;) {
        let u = -1;
        for (let i = 0; i < n; i++) if (!done[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
        if (u < 0 || u === 1) break;
        done[u] = true;
        for (let v = 0; v < n; v++) {
            if (done[v]) continue;
            const d = dist[u] + Math.hypot(nodes[v].x - nodes[u].x, nodes[v].z - nodes[u].z);
            if (d < dist[v] && solid.segmentClear(nodes[u].x, nodes[u].z, nodes[v].x, nodes[v].z, bodyR)) {
                dist[v] = d;
                prev[v] = u;
            }
        }
    }
    if (dist[1] === Infinity) return null;
    const way: Array<{x: number; z: number}> = [];
    for (let i = 1; i >= 0; i = prev[i]) way.unshift(nodes[i]);
    return way;
}

test("clinger crawl: the A* with runs checked when taken gives the very way the first search gave, on 400 scattered fields", () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    let rounds = 0;
    for (let t = 0; t < 400; t++) {
        const rocks = Array.from({length: 1 + Math.floor(rnd() * 14)}, () => rock(rnd() * 20 - 10, rnd() * 20 - 10, 0.3 + rnd() * 2.5));
        const from = spot(rnd() * 24 - 12, rnd() * 24 - 12);
        const to = spot(rnd() * 24 - 12, rnd() * 24 - 12);
        const bodyR = 0.02 + rnd() * 0.2;
        const want = eager(worldWith(rocks), from, to, bodyR);
        assert.deepEqual(crawlRound(worldWith(rocks), from, to, bodyR), want, `field ${t}`);
        if (want && want.length > 2) rounds++;
    }
    assert.ok(rounds > 100, `${rounds} fields with a way round`);
});

test("clinger crawl: asked again in the same world, the kept way (the same array)", () => {
    const world = worldWith([rock(0, 0, 2)]);
    const a = crawlRound(world, spot(-6, 0), spot(6, 0), 0.05);
    assert.equal(crawlRound(world, spot(-6, 0), spot(6, 0), 0.05), a);
    assert.notEqual(crawlRound(worldWith([rock(0, 0, 2)]), spot(-6, 0), spot(6, 0), 0.05), a);
});
