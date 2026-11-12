/**
 * The scenery lane's checks (the motion 100x pass): trees never grow inside each other, rocks sit into the ground and
 * stay out of the trees, and props neither float nor stand in each other. Numbers: `scripts/ark-scenery-metrics.mts`.
 */

import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import test from "node:test";
import {Matrix4, Quaternion, Vector3} from "three";
import {forestFill, worldDecor} from "@/ark-scene/decor";
import {drawnRocks} from "@/ark-scene/map/rocks";
import {allMountainRocks, mountainRocks, pieceBox, piecePoint, SOLID_ACROSS} from "@/ark-scene/rock-layout";
import {cachedRock, ROCK_DETAIL, ROCK_VARIANTS, rockMesh} from "@/ark-scene/rock-shapes";
import {REAL_HEIGHT, assetTreePlacement} from "@/ark-scene/tree-pick";
import {treeBody, treesClash, TreeSpacing, type TreeBody} from "@/ark-scene/tree-spacing";
import {heightAt} from "@/ark-scene/world";

// MARK: - Trees

test("scenery trees: the crowns measured on the drawn trees are up to date with the tree assets", () => {
    execFileSync(process.execPath, ["scripts/ark-tree-footprints.mjs", "--check"], {stdio: "pipe"});
});

test("scenery trees: no two drawn trees grow inside each other (trunks, a trunk through a crown, fused crowns)", () => {
    const bodies: Array<{host: string; body: TreeBody}> = [];
    worldDecor().forEach((item, i) => {
        const body = treeBody(item);
        if (body) bodies.push({host: `decor${i}`, body});
    });
    forestFill().forEach((item, i) => {
        const body = treeBody(item);
        if (body) bodies.push({host: `fill${i}`, body});
    });
    assert.ok(bodies.filter(({body}) => !body.low).length > 150, `${bodies.length} trees`);
    const index = new TreeSpacing();
    const host = new Map<TreeBody, string>();
    const clashes: string[] = [];
    for (const {host: name, body} of bodies) {
        for (const {other, clash} of index.clashes(body)) clashes.push(`${host.get(other)} ${name} ${clash.kind} ${clash.depth.toFixed(2)} m`);
        index.add(body);
        host.set(body, name);
    }
    assert.deepEqual(clashes.slice(0, 12), [], `${clashes.length} pairs`);
});

test("scenery trees: the clash rules (trunks, a trunk through a crown, crowns fused; the understorey and thickets allowed)", () => {
    const tree = (x: number, scale: number, kind = "broadleaf"): TreeBody => {
        // An oak by the pond (farm_garden): a real asset tree, placed and measured as the scatter does.
        const body = treeBody({kind, variant: 0, x, y: 1.4, z: 40, scale, rotation: 0});
        assert.ok(body, "a drawn tree");
        return body!;
    };
    const big = tree(0, 1.5);
    assert.equal(treesClash(big, tree(0.3, 1.5))?.kind, "trunk");
    assert.ok(treesClash(big, tree(4, 1.5)), "two oaks 4 m apart fuse");
    assert.equal(treesClash(big, tree(40, 1.5)), null, "40 m apart: clear");
    // A shrub at the oak's foot stays off its trunk, but may stand under the crown's edge.
    const shrub = (x: number) => treeBody({kind: "shrub", variant: 0, x, y: 1.4, z: 40, scale: 1, rotation: 0})!;
    assert.ok(treesClash(big, shrub(0.4)), "a shrub in the trunk");
    assert.equal(treesClash(big, shrub(big.trunk + 2.5)), null, "the understorey");
    assert.equal(treesClash(shrub(10), shrub(10.8)), null, "a thicket");
});

test("scenery trees: grown to real heights by kind (decision 34): the big ones of each kind near its real height", () => {
    const by = new Map<string, number[]>();
    for (const item of [...worldDecor(), ...forestFill()]) {
        const placed = assetTreePlacement(item as never);
        if (!placed) continue;
        const kind = placed.id.replace(/-[abc]$/, "");
        const list = by.get(kind) ?? [];
        list.push(placed.height);
        by.set(kind, list);
    }
    for (const [kind, heights] of Array.from(by)) {
        if (heights.length < 6 || kind === "snag") continue;
        heights.sort((a, b) => a - b);
        const top = heights[Math.floor(heights.length * 0.9)];
        assert.ok(top > REAL_HEIGHT[kind] * 0.75 && top < REAL_HEIGHT[kind] * 1.45, `${kind}: the tallest tenth from ${top.toFixed(1)} m (real ${REAL_HEIGHT[kind]} m)`);
    }
});

// MARK: - Rocks

test("scenery rocks: made in code, every shape a real mesh: closed, sized, the same at every call", () => {
    for (const style of ["boulder", "crag", "slab", "scree"] as const) {
        for (let v = 0; v < ROCK_VARIANTS[style]; v++) {
            const a = rockMesh(style, v, ROCK_DETAIL[style][0]);
            const b = cachedRock(style, v, ROCK_DETAIL[style][0]);
            assert.deepEqual(Array.from(a.positions.slice(0, 30)), Array.from(b.positions.slice(0, 30)), "deterministic");
            assert.equal(a.bounds.min[1], 0, "standing on y = 0");
            assert.ok(a.bounds.max[1] > 0.3 && a.bounds.max[0] - a.bounds.min[0] > 0.8, `${style} ${v} sized`);
            for (let i = 0; i < a.normals.length; i += 3) assert.ok(Math.abs(Math.hypot(a.normals[i], a.normals[i + 1], a.normals[i + 2]) - 1) < 1e-3);
            // The coarser levels are the same rock: their bounds within a tenth.
            const far = cachedRock(style, v, ROCK_DETAIL[style][2]);
            assert.ok(far.triangles < a.triangles || style === "scree");
            assert.ok(Math.abs(far.bounds.max[1] - a.bounds.max[1]) < 0.15 * a.bounds.max[1] + 0.05, `${style} ${v}: far level the same height`);
        }
    }
});

test("scenery rocks: the mountain's crags, scree and boulders sit into the ground: no edge of a base in the air, a top that shows", () => {
    const {crags, boulders, scree} = mountainRocks();
    assert.ok(crags.length >= 8, `${crags.length} crags`);
    assert.ok(scree.length >= 100 && boulders.length >= 20, `${scree.length} scree, ${boulders.length} boulders`);
    const floating: string[] = [];
    for (const piece of allMountainRocks()) {
        const b = cachedRock(piece.style, piece.variant, ROCK_DETAIL[piece.style][0]).bounds;
        // The base's outline (an ellipse in its bounds) and middle, through the renderer's own transform.
        for (let k = 0; k <= 12; k++) {
            const a = (k / 12) * Math.PI * 2;
            const x = k === 12 ? (b.min[0] + b.max[0]) / 2 : (Math.cos(a) * 0.5 + 0.5) * (b.max[0] - b.min[0]) * 0.92 + b.min[0] * 0.92;
            const z = k === 12 ? (b.min[2] + b.max[2]) / 2 : (Math.sin(a) * 0.5 + 0.5) * (b.max[2] - b.min[2]) * 0.92 + b.min[2] * 0.92;
            const [wx, wy, wz] = piecePoint(piece, x, 0, z);
            if (wy > heightAt(wx, wz) + 0.01) floating.push(`${piece.role} at ${piece.x.toFixed(1)},${piece.z.toFixed(1)}: base ${(wy - heightAt(wx, wz)).toFixed(2)} m up`);
        }
        const [tx, ty, tz] = piecePoint(piece, (b.min[0] + b.max[0]) / 2, b.max[1], (b.min[2] + b.max[2]) / 2);
        if (piece.role === "crag") assert.ok(ty - heightAt(tx, tz) > 0.35 * b.max[1] * piece.scale, `${piece.role} at ${piece.x.toFixed(1)},${piece.z.toFixed(1)} shows`);
    }
    assert.deepEqual(floating.slice(0, 10), [], `${floating.length} base points in the air`);
});

test("scenery rocks: the layout's hand-made transform is the renderer's (quaternion(up) · quaternion(yaw), scaled)", () => {
    for (const piece of allMountainRocks().slice(0, 40)) {
        const q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), piece.yaw).premultiply(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), new Vector3(...piece.up)));
        const m = new Matrix4().compose(new Vector3(piece.x, piece.y, piece.z), q, new Vector3(piece.scale, piece.scale, piece.scale));
        const p = new Vector3(0.7, 0.4, -0.3).applyMatrix4(m);
        const [x, y, z] = piecePoint(piece, 0.7, 0.4, -0.3);
        assert.ok(Math.hypot(p.x - x, p.y - y, p.z - z) < 1e-6);
    }
});

test("scenery rocks: no rock in a tree's trunk; every solid one (0.3 m and more) is an obstacle in map/rocks.ts", () => {
    const trunks = [...worldDecor(), ...forestFill()].map((item) => treeBody(item)).filter((body): body is TreeBody => !!body && !body.low);
    const pieces = allMountainRocks();
    for (const piece of pieces) {
        const box = pieceBox(piece);
        const c = Math.cos(piece.yaw);
        const s = Math.sin(piece.yaw);
        for (const tree of trunks) {
            if (Math.hypot(tree.x - piece.x, tree.z - piece.z) > 12) continue;
            const dx = tree.x - piece.x;
            const dz = tree.z - piece.z;
            const lx = dx * c - dz * s;
            const lz = dx * s + dz * c;
            const inside = lx > box.hx0 - tree.trunk && lx < box.hx1 + tree.trunk && lz > box.hz0 - tree.trunk && lz < box.hz1 + tree.trunk;
            // A scree stone's box is loose about its round shape: only its middle third counts.
            if (piece.role === "scree" ? Math.hypot(dx, dz) < tree.trunk + piece.across * 0.3 : inside) assert.fail(`${piece.role} at ${piece.x.toFixed(1)},${piece.z.toFixed(1)} in the trunk of the ${tree.asset ?? tree.kind} at ${tree.x.toFixed(1)},${tree.z.toFixed(1)}`);
        }
    }
    const listed = drawnRocks().filter((rock) => rock.source && rock.source !== "decor");
    assert.equal(listed.length, pieces.filter((piece) => piece.across >= SOLID_ACROSS).length);
});

// MARK: - Props

import {sceneryProblems} from "@/ark-scene/scenery-check";
import {termiteMoundFootprints} from "@/ark-scene/props/areas";

test("scenery props: nothing floats and nothing stands in anything (rocks, trunks, logs, bales, mounds, the barn, the cottage)", () => {
    const {floating, intersections, solids} = sceneryProblems();
    assert.ok(solids > 600, `${solids} solids`);
    const say = (p: {what: string; a: string; b?: string; x: number; z: number; by: number}) => `${p.what} ${p.a} ${p.b ?? ""} at ${p.x.toFixed(1)},${p.z.toFixed(1)} by ${p.by.toFixed(2)} m`;
    assert.deepEqual(floating.slice(0, 10).map(say), [], `${floating.length} floating`);
    assert.deepEqual(intersections.slice(0, 10).map(say), [], `${intersections.length} standing in each other`);
});

test("scenery props: every termite mound's footprint for the collisions lane (the savanna's always, the active ones with termites)", () => {
    const mounds = termiteMoundFootprints();
    assert.equal(mounds.filter((m) => m.always).length, 3);
    assert.ok(mounds.filter((m) => !m.always).length >= 6);
    for (const m of mounds) assert.ok(m.radius > 0.5 && m.top > heightAt(m.x, m.z) + 1, JSON.stringify(m));
});
