import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import test from "node:test";
import {NavGrid, navGridBuild, type NavCells} from "@/ark-scene/behaviour-nav";
import {ScheduleWorldBuild, scheduleWorld} from "@/ark-scene/behaviour-schedule";
import {SlicedBuild} from "@/ark-scene/behaviour-build";
import {ATTACH_TAGS, resetWorldSampler, sceneSampler, sceneSamplerTasks, worldSampler, type ArkWorldSampler, type AttachPoint, type AttachTag} from "@/ark-scene/world-sampler";
import {forestFill, worldDecor, type DecorItem} from "@/ark-scene/decor";
import {allAttachPoints, shoreRadius, surfaceAt} from "@/ark-scene/sampler";
import {COTTAGE, GARDEN_POND} from "@/ark-scene/micro-decor";
import {hashString, LAKE, RIVER, TERRAIN_HALF} from "@/ark-scene/world";
import type {ArkZone} from "@/ark-scene/types";

/**
 * The walk grid and the places are built a slice at a time between frames (`behaviour-build.ts`). These check that
 * the result is the old build's, to the bit: the reference below is the build all at once as it was before the
 * slicing (ark-behaviour d1f1bb26), copied verbatim.
 */

const CELL = 2;
const SIZE = Math.ceil((TERRAIN_HALF * 2) / CELL);

/** The old `NavGrid` constructor's two loops, verbatim. */
function referenceCells(sampler: ArkWorldSampler): Omit<NavCells, "version" | "size"> {
    const walk = new Uint8Array(SIZE * SIZE);
    const steep = new Float32Array(SIZE * SIZE);
    const depth = new Float32Array(SIZE * SIZE);
    const height = new Float32Array(SIZE * SIZE);
    for (let j = 0; j < SIZE; j++) {
        for (let i = 0; i < SIZE; i++) {
            const x = -TERRAIN_HALF + (i + 0.5) * CELL;
            const z = -TERRAIN_HALF + (j + 0.5) * CELL;
            const h = sampler.heightAt(x, z);
            const k = j * SIZE + i;
            height[k] = h;
            depth[k] = h < 0 ? -h : 0;
        }
    }
    for (let j = 1; j < SIZE - 1; j++) {
        for (let i = 1; i < SIZE - 1; i++) {
            const k = j * SIZE + i;
            const h = height[k];
            if (h <= 0.05) continue;
            const slope = Math.max(Math.abs(height[k + 1] - height[k - 1]), Math.abs(height[k + SIZE] - height[k - SIZE])) / (2 * CELL);
            steep[k] = slope;
            const x = -TERRAIN_HALF + (i + 0.5) * CELL;
            const z = -TERRAIN_HALF + (j + 0.5) * CELL;
            if (sampler.blocked(x, z, 0.2)) continue;
            walk[k] = 1;
        }
    }
    return {walk, steep, depth, height};
}

/** The old `sceneSampler`'s places and version, verbatim (the index, the lattice and the obstacle test are unchanged code). */
function referencePlaces(): {version: string; points: Map<AttachTag, AttachPoint[]>} {
    // (The scenery-to-place tag mapping is data, not the build: it follows world-sampler.ts's, here as of 2026-11-11.)
    const FROM: Record<string, AttachTag> = {leaf: "leaf", branch: "branch", canopy_perch: "branch", bark: "bark", canopy_climb: "bark", flower_head: "flower", rock_face: "rock_face", tide_pool: "tide_pool", house_wall: "house_wall", house_eave: "house_wall", porch_light: "porch_light", lamp: "porch_light", leaf_litter: "leaf_litter", worm_hole: "worm_hole", burrow: "burrow_entrance", pond_surface: "pond_surface", ledge: "cliff_ledge", limb: "branch", tree_hollow: "tree_hollow", fence_post: "post", roof_edge: "post"};
    const TREE_KINDS = new Set<DecorItem["kind"]>(["broadleaf", "rainforest", "conifer", "acacia", "palm", "orchard", "canopy"]);
    const UP = {nx: 0, ny: 1, nz: 0};
    const points = new Map<AttachTag, AttachPoint[]>();
    const add = (point: Omit<AttachPoint, "id"> & {id?: string}) => {
        const list = points.get(point.tag) ?? [];
        list.push({...point, id: point.id ?? `${point.tag}:${list.length}`} as AttachPoint);
        points.set(point.tag, list);
    };
    const surface = (x: number, z: number) => surfaceAt(x, z);
    const scenery = allAttachPoints();
    for (const p of scenery) {
        const tag = FROM[p.tag];
        if (!tag) continue;
        add({id: p.id, tag, x: p.position.x, y: p.position.y, z: p.position.z, nx: p.normal.x, ny: p.normal.y, nz: p.normal.z, yaw: p.yaw, size: p.size, zone: (p.zone ?? surface(p.position.x, p.position.z).zone) as ArkZone});
    }
    const items: DecorItem[] = [...worldDecor(), ...forestFill()];
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (TREE_KINDS.has(item.kind)) {
            const sx = item.x + 1.4 * item.scale;
            const sz = item.z + 1.1 * item.scale;
            const s = surface(sx, sz);
            if (s.waterDepth <= 0 && i % 2 === 0) add({tag: "shade", x: sx, y: s.height, z: sz, ...UP, yaw: item.rotation, size: [0.05, 4], zone: s.zone});
        } else if (item.kind === "rock") {
            const s = surface(item.x, item.z);
            add({tag: "rock_top", x: item.x, y: item.y + 0.18 * item.scale + 0.53 * item.scale * 0.95, z: item.z, ...UP, yaw: item.rotation, size: [0.02, 1.4 * item.scale], zone: s.zone});
            if (item.scale > 1.3 && (s.zone === "mountains" || s.surface === "rock")) add({tag: "cave_mouth", x: item.x + Math.sin(item.rotation) * item.scale, y: s.height, z: item.z + Math.cos(item.rotation) * item.scale, nx: Math.sin(item.rotation), ny: 0, nz: Math.cos(item.rotation), yaw: item.rotation, size: [0.05, 2.5], zone: s.zone});
        } else if (item.kind === "reed") {
            add({tag: "reeds", x: item.x, y: item.y, z: item.z, ...UP, yaw: item.rotation, size: [0.02, 1.2], zone: surface(item.x, item.z).zone});
        } else if (item.kind === "shrub" || item.kind === "cactus") {
            if (i % 2 === 0) {
                const s = surface(item.x + 0.7, item.z + 0.4);
                if (s.waterDepth <= 0) add({tag: "shade", x: item.x + 0.7, y: s.height, z: item.z + 0.4, ...UP, yaw: item.rotation, size: [0.02, 0.9], zone: s.zone});
            }
        }
    }
    const edge = (x: number, z: number, outward: number, zone?: ArkZone) => {
        for (let d = 0; d < 6; d += 0.25) {
            const px = x + Math.cos(outward) * d;
            const pz = z + Math.sin(outward) * d;
            const s = surface(px, pz);
            if (s.waterDepth <= 0 && s.height > 0.05) {
                add({tag: "water_edge", x: px, y: s.height, z: pz, ...UP, yaw: outward + Math.PI, size: [0.02, 6], zone: zone ?? s.zone});
                return;
            }
        }
    };
    for (let k = 0; k < 28; k++) {
        const a = (k / 28) * Math.PI * 2;
        edge(LAKE.x + Math.cos(a) * (LAKE.r - 1), LAKE.z + Math.sin(a) * (LAKE.r - 1), a, "river_lake");
    }
    for (let s = 0; s + 1 < RIVER.length; s++) {
        const [ax, az] = RIVER[s];
        const [bx, bz] = RIVER[s + 1];
        const normal = Math.atan2(bx - ax, -(bz - az));
        for (let t = 0.2; t < 1; t += 0.3) {
            edge(ax + (bx - ax) * t, az + (bz - az) * t, normal);
            edge(ax + (bx - ax) * t, az + (bz - az) * t, normal + Math.PI);
        }
    }
    for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        edge(GARDEN_POND.x + Math.cos(a) * GARDEN_POND.radius * 0.6, GARDEN_POND.z + Math.sin(a) * GARDEN_POND.radius * 0.6, a, "farm_garden");
    }
    for (let k = 0; k < 120; k++) {
        const theta = (k / 120) * Math.PI * 2;
        const r = shoreRadius(theta);
        const s0 = surface(Math.cos(theta) * (r + 1.5), Math.sin(theta) * (r + 1.5));
        if (s0.cliff > 0.45) continue;
        edge(Math.cos(theta) * (r + 2), Math.sin(theta) * (r + 2), theta + Math.PI);
    }
    const step = 6;
    for (let x = -TERRAIN_HALF; x <= TERRAIN_HALF; x += step) {
        for (let z = -TERRAIN_HALF; z <= TERRAIN_HALF; z += step) {
            const jitter = hashString(`${x},${z}`);
            const px = x + ((jitter % 97) / 97 - 0.5) * step;
            const pz = z + (((jitter >> 7) % 97) / 97 - 0.5) * step;
            const s = surface(px, pz);
            if (s.waterDepth > 0 || s.height <= 0.05) continue;
            if (s.cliff > 0.45 && s.normal.y > 0.6) add({tag: "cliff_ledge", x: px, y: s.height, z: pz, ...UP, yaw: Math.atan2(-px, -pz), size: [0.1, 1.5], zone: s.zone});
            if ((s.weights.grass ?? 0) > 0.45 && s.normal.y > 0.85) add({tag: "grass", x: px, y: s.height, z: pz, ...UP, yaw: 0, size: [0.05, 6], zone: s.zone});
        }
    }
    const counts = ATTACH_TAGS.map((tag) => points.get(tag)?.length ?? 0).join(".");
    return {version: `scene:${items.length}:${scenery.length}:${counts}`, points};
}

const bytes = (cells: Pick<NavCells, "walk" | "steep" | "depth" | "height">) => [cells.walk, cells.steep, cells.depth, cells.height].map((a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength));
const hashOf = (cells: Pick<NavCells, "walk" | "steep" | "depth" | "height">) => {
    const h = createHash("sha256");
    for (const b of bytes(cells)) h.update(b);
    return h.digest("hex");
};
const placesOf = (sampler: ArkWorldSampler) => Object.fromEntries(ATTACH_TAGS.map((tag) => [tag, sampler.attachPoints(tag)]));

/** Built a task or so a step (budget 0: one task, one row or chunk, each time), as slowly as it can be sliced. */
function finest<T>(build: SlicedBuild<T>): {result: T; slices: number} {
    let slices = 0;
    for (;;) {
        slices++;
        const result = build.step(0);
        if (result) return {result, slices};
    }
}

const allAtOnce = sceneSampler();
const reference = referencePlaces();

test("the places are the old build's: the same points, ids, order and version", () => {
    assert.equal(allAtOnce.version, reference.version);
    for (const tag of ATTACH_TAGS) assert.deepEqual(allAtOnce.attachPoints(tag), reference.points.get(tag) ?? [], tag);
});

test("the places sliced as finely as they can be are the build all at once", () => {
    const job = sceneSamplerTasks();
    const {result: sliced, slices} = finest(new SlicedBuild(job.tasks, job.finish));
    assert.ok(slices > 60, `only ${slices} slices`);
    assert.equal(sliced.version, allAtOnce.version);
    assert.deepEqual(placesOf(sliced), placesOf(allAtOnce));
    // The same obstacles, ground and water.
    for (let x = -TERRAIN_HALF; x <= TERRAIN_HALF; x += 3.7) {
        for (let z = -TERRAIN_HALF; z <= TERRAIN_HALF; z += 4.1) {
            assert.equal(sliced.blocked(x, z, 0.2), allAtOnce.blocked(x, z, 0.2));
            assert.equal(sliced.heightAt(x, z), allAtOnce.heightAt(x, z));
        }
    }
});

test("the walk grid's bytes are the old build's, all at once and sliced a row at a time", () => {
    const old = referenceCells(allAtOnce);
    const whole = new NavGrid(allAtOnce);
    const now = whole.cells;
    assert.equal(now.size, SIZE);
    assert.deepEqual(bytes(now), bytes(old));
    assert.equal(hashOf(now), hashOf(old));
    // Sliced: from a sampler of its own (nothing cached), one row a step.
    const fresh = sceneSampler();
    const {result: grid, slices} = finest(navGridBuild(fresh));
    assert.ok(slices >= SIZE, `only ${slices} slices`);
    assert.equal(hashOf(grid.cells), hashOf(old));
    // And the walk queries agree everywhere.
    for (let k = 0; k < 4000; k++) {
        const x = ((k * 37) % 260) - 130 + 0.3;
        const z = ((k * 53) % 260) - 130 + 0.7;
        assert.equal(grid.walkable(x, z), whole.walkable(x, z));
        assert.equal(grid.depthAt(x, z), old.depth[Math.min(Math.max(Math.floor((z + TERRAIN_HALF) / CELL), 0), SIZE - 1) * SIZE + Math.min(Math.max(Math.floor((x + TERRAIN_HALF) / CELL), 0), SIZE - 1)]);
    }
});

test("the schedule world built between frames is the world built at once, and becomes the shared one", () => {
    resetWorldSampler();
    const build = new ScheduleWorldBuild();
    let world = null;
    let steps = 0;
    while (!world) {
        world = build.step(1);
        steps++;
        assert.ok(steps < 100000);
    }
    assert.ok(steps > 3, `built in ${steps} steps`);
    assert.ok(build.spentMs > 0);
    assert.equal(worldSampler(), world.sampler);
    const once = scheduleWorld(sceneSampler());
    assert.equal(world.sampler.version, once.sampler.version);
    assert.deepEqual(placesOf(world.sampler), placesOf(once.sampler));
    assert.equal(hashOf(world.nav.cells), hashOf(referenceCells(once.sampler)));
    // Asked for before it is done, the shared sampler is finished at once (the same one the build then returns).
    resetWorldSampler();
    const half = new ScheduleWorldBuild();
    half.step(0);
    const early = worldSampler();
    assert.equal(half.run().sampler, early);
    assert.equal(early.version, once.sampler.version);
});
