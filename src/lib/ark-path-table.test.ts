import assert from "node:assert/strict";
import test from "node:test";
import {alongPath, pathLength, type NavPoint} from "@/ark-scene/behaviour-nav";
import {PATH_TABLE_FROM, tabledAlong, tabledLength} from "@/ark-scene/path-table";

/** A seeded path of `count` points: runs of every length, some of none (two points on one spot). */
function pathOf(seed: number, count: number): NavPoint[] {
    let s = seed >>> 0 || 1;
    const next = () => {
        s ^= s << 13;
        s ^= s >>> 17;
        s ^= s << 5;
        return ((s >>> 0) % 1_000_003) / 1_000_003;
    };
    const path: NavPoint[] = [{x: next() * 400 - 200, z: next() * 400 - 200}];
    for (let i = 1; i < count; i++) {
        const last = path[i - 1];
        const still = next() < 0.08;
        path.push(still ? {x: last.x, z: last.z} : {x: last.x + (next() - 0.5) * 9, z: last.z + (next() - 0.5) * 9});
    }
    return path;
}

const same = (a: {x: number; z: number; yaw: number}, b: {x: number; z: number; yaw: number}) => Object.is(a.x, b.x) && Object.is(a.z, b.z) && Object.is(a.yaw, b.yaw);

test("path table: a long path's length and every point along it are the plain functions' own, to the bit", () => {
    let asked = 0;
    for (let seed = 1; seed <= 60; seed++) {
        for (const count of [1, 2, 3, PATH_TABLE_FROM - 1, PATH_TABLE_FROM, 21, 64, 120]) {
            const path = pathOf(seed * 7919 + count, count);
            assert.ok(Object.is(tabledLength(path), pathLength(path)), `length, ${count} points, seed ${seed}`);
            const total = pathLength(path);
            for (let k = 0; k <= 200; k++) {
                // (Past both ends too, and with the length handed in and left out, as its callers do both.)
                const fraction = -0.05 + (k / 200) * 1.1;
                assert.ok(same(tabledAlong(path, fraction), alongPath(path, fraction)), `along ${fraction}, ${count} points, seed ${seed}`);
                assert.ok(same(tabledAlong(path, fraction, total), alongPath(path, fraction, total)), `along ${fraction} with its length, ${count} points, seed ${seed}`);
                asked += 2;
            }
        }
    }
    assert.ok(asked > 150_000);
});

test("path table: a path changed after it was first asked is measured again", () => {
    const path = pathOf(31, 40);
    const before = tabledLength(path);
    assert.ok(Object.is(before, pathLength(path)));
    // (As a trip's builder does: one more point on its end; then its last point moved.)
    path.push({x: path[path.length - 1].x + 3, z: path[path.length - 1].z - 4});
    assert.ok(Object.is(tabledLength(path), pathLength(path)));
    assert.equal(tabledLength(path), before + 5);
    path[path.length - 1] = {x: path[path.length - 1].x + 1, z: path[path.length - 1].z};
    assert.ok(Object.is(tabledLength(path), pathLength(path)));
    assert.ok(same(tabledAlong(path, 0.99), alongPath(path, 0.99)));
});

test("path table: a path of points on one spot has no length, and its start is where it is", () => {
    const path: NavPoint[] = Array.from({length: 12}, () => ({x: 4, z: -2}));
    assert.equal(tabledLength(path), 0);
    assert.ok(same(tabledAlong(path, 0.5), alongPath(path, 0.5)));
});
