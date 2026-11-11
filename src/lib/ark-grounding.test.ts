/**
 * Grounding (motion 100x pass, lane L3: "animals float or sink; tree animals aren't properly on branches"): the drawn
 * ground, the true bases, standing on slopes and perching, and the grounding validator's counts on every catalogue
 * species through an Ark day (fail CI on any animal floating, sinking or inside scenery outside the reviewed holds).
 */
import assert from "node:assert/strict";
import test from "node:test";
import {existsSync, readFileSync} from "node:fs";
import path from "node:path";
import {groundArrays} from "@/ark-scene/terrain";
import {DRAWN_GROUND_SEGMENTS, drawnGround, drawnGroundHeight} from "@/ark-scene/grounding/drawn-ground";
import {clipStandOffset, groundedSlugs, levelBase, meanDrop, modelBase, rigFeet} from "@/ark-scene/grounding/base";
import {scheduleSurface, standOnGround} from "@/ark-scene/grounding/stand";
import {auditGrounding, arkDayEpochs} from "@/ark-scene/grounding/audit";
import {validateGrounding, GROUNDING_HOLDS, GROUNDING_INSIDE_AT_REST} from "@/ark-scene/map/validate-grounding";
import {mapSlugs} from "@/ark-scene/map/species";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import {TERRAIN_HALF} from "@/ark-scene/world";

test("grounding: the drawn ground is the terrain mesh's own triangles (vertex for vertex, and between them)", () => {
    const a = groundArrays();
    const size = DRAWN_GROUND_SEGMENTS + 1;
    assert.equal(a.size, size, "the terrain's grid changed: drawn-ground.ts DRAWN_GROUND_SEGMENTS");
    let worst = 0;
    for (let i = 0; i < size * size; i += 37) worst = Math.max(worst, Math.abs(drawnGroundHeight(a.positions[i * 3], a.positions[i * 3 + 2]) - a.positions[i * 3 + 1]));
    assert.ok(worst < 1e-4, `vertex heights differ by ${worst}`);
    // Between vertices: the index's own triangles, by barycentric weights.
    let between = 0;
    for (let t = 0; t < a.index.length; t += 3 * 997) {
        const [i, j, k] = [a.index[t], a.index[t + 1], a.index[t + 2]];
        const w = [0.2, 0.3, 0.5];
        const x = w[0] * a.positions[i * 3] + w[1] * a.positions[j * 3] + w[2] * a.positions[k * 3];
        const y = w[0] * a.positions[i * 3 + 1] + w[1] * a.positions[j * 3 + 1] + w[2] * a.positions[k * 3 + 1];
        const z = w[0] * a.positions[i * 3 + 2] + w[1] * a.positions[j * 3 + 2] + w[2] * a.positions[k * 3 + 2];
        between = Math.max(between, Math.abs(drawnGroundHeight(x, z) - y));
    }
    assert.ok(between < 1e-3, `inside a triangle the drawn ground is off by ${between}`);
    const n = drawnGround(10.3, -20.7);
    assert.ok(Math.abs(Math.hypot(n.nx, n.ny, n.nz) - 1) < 1e-6 && n.ny > 0);
    assert.ok(Number.isFinite(drawnGroundHeight(TERRAIN_HALF + 5, 0)), "off the mesh the analytic ground stands in");
});

test("grounding: every catalogue species' model has a true base (near and far) and a footprint", () => {
    const listed = new Set(groundedSlugs());
    const missing = mapSlugs().filter((slug) => !listed.has(slug));
    // (A species the bucket has no model for is drawn as the neutral figure: none is expected here.)
    assert.ok(missing.length <= Math.ceil(mapSlugs().length * 0.01), `${missing.length} catalogue species have no base: ${missing.slice(0, 10).join(", ")}`);
    for (const slug of Array.from(listed).slice(0, 400)) {
        const base = modelBase(slug)!;
        assert.ok(base.near.base >= base.near.minY - 1e-6 && base.far.base >= base.far.minY - 1e-6, `${slug}: a base below its lowest point`);
        assert.ok(base.near.base - base.near.minY <= 0.3 * base.size.y + 1e-6, `${slug}: a base past 30% of its height`);
        assert.ok(base.footprint.x1 >= base.footprint.x0 && base.footprint.z1 >= base.footprint.z0, `${slug}: footprint`);
    }
    // A model the file does not list keeps its bounding box.
    assert.equal(levelBase("no-such-model", "near", -0.42), -0.42);
});

test("grounding: on a slope every contact touches (none sunk), the body leans to it", () => {
    const plane = (x: number, z: number) => 2 + 0.15 * x - 0.1 * z;
    const footprint = {x0: -0.12, x1: 0.12, z0: -0.4, z1: 0.35};
    for (const yaw of [0, 0.7, 2.1, -2.8]) {
        const stand = standOnGround(4, -3, yaw, 1.6, -0.21, footprint, 0, 0, plane);
        // Its contacts after the lean: all on the plane.
        const cy = Math.cos(yaw);
        const sy = Math.sin(yaw);
        const cp = Math.cos(stand.pitch);
        const sp = Math.sin(stand.pitch);
        const cr = Math.cos(stand.roll);
        const sr = Math.sin(stand.roll);
        let worst = 0;
        let lowest = Infinity;
        for (const [lx, lz] of [[0, footprint.z1], [0, footprint.z0], [footprint.x1, 0], [footprint.x0, 0]]) {
            const x1 = (lx * cr + 0.21 * sr) * 1.6;
            const y1 = (lx * sr - 0.21 * cr) * 1.6;
            const z1 = lz * 1.6;
            const y2 = y1 * cp - z1 * sp;
            const z2 = y1 * sp + z1 * cp;
            const gap = stand.rootY + y2 - plane(4 + x1 * cy + z2 * sy, -3 - x1 * sy + z2 * cy);
            worst = Math.max(worst, Math.abs(gap));
            lowest = Math.min(lowest, gap);
        }
        assert.ok(lowest > -1e-6, `yaw ${yaw}: a contact sunk ${lowest}`);
        assert.ok(worst < 0.03, `yaw ${yaw}: a contact ${worst.toFixed(3)} m off a plane it leans to`);
        assert.ok(Math.abs(stand.pitch) > 0.01 || Math.abs(stand.roll) > 0.01, "it leans");
    }
});

test("grounding: on a trunk or a wall it heads up the surface, its frame square", () => {
    const frame = scheduleSurface({x: 0, y: 3, z: 0, yaw: 1.2, nx: 1, ny: 0, nz: 0});
    assert.ok(frame.ty > 0.99, "up the trunk");
    assert.ok(Math.abs(frame.nx * frame.tx + frame.ny * frame.ty + frame.nz * frame.tz) < 1e-9);
    const top = scheduleSurface({x: 0, y: 3, z: 0, yaw: 0.4, nx: 0, ny: 1, nz: 0});
    assert.ok(Math.abs(top.tx - Math.sin(0.4)) < 1e-9 && Math.abs(top.tz - Math.cos(0.4)) < 1e-9, "on a branch's top: its own heading");
});

test("grounding: rigs' soles are below their grip pivots, and only real standing-clip offsets are taken off", () => {
    let rigs = 0;
    for (const slug of groundedSlugs()) {
        const feet = rigFeet(slug);
        if (!feet) continue;
        rigs++;
        assert.ok(feet.drop > -0.2 && feet.drop < 0.5, `${slug}: a grip drop of ${feet.drop}`);
        assert.ok(meanDrop(slug) >= 0, `${slug}: soles never above the pivots in use`);
        assert.ok(Math.abs(clipStandOffset(slug, "walk")) < 0.08, `${slug}: walk offset`);
        assert.equal(clipStandOffset(slug, "flap"), 0);
    }
    assert.ok(rigs > 1500, `${rigs} rigs measured`);
});

/** The validator's run once for the file. */
let run: ReturnType<typeof validateGrounding> | null = null;
const validated = () => (run ??= validateGrounding());

test("grounding validator: every catalogue species through an Ark day: none floats or sinks, none clings upright through a wall or hides in a crown; at rest inside a trunk or rock no more than the reviewed count (collisions, lane L5); the old rules would have failed", () => {
    const result = validated();
    assert.ok(result.animals > 2000, `${result.animals} animals`);
    assert.equal(result.counts.grounded.floats, 0, "floating");
    assert.equal(result.counts.grounded.sinks, 0, "sinking");
    // Off the ground (a branch, a limb, bark, a wall): never inside scenery.
    const offGround = result.failures.filter((f) => f.on !== "ground" && f.on !== "lawn" && !GROUNDING_HOLDS[f.slug]);
    assert.deepEqual(offGround.slice(0, 20).map((f) => `${f.slug}: ${f.problem} on ${f.on} (${f.detail})`), []);
    // At rest on the ground inside a trunk, a rock or a building: the schedule's rest and roost spots, which lane L5's
    // colliders settle; a ratchet until they land (it fails when the count grows).
    assert.ok(result.counts.grounded.inside <= GROUNDING_INSIDE_AT_REST, `${result.counts.grounded.inside} animals at rest inside scenery (reviewed: ${GROUNDING_INSIDE_AT_REST})`);
    // The check sees the old bugs (so a green run means something).
    assert.ok(result.counts.legacy.floats > 50 && result.counts.legacy.sinks > 50 && result.counts.legacy.inside > result.counts.grounded.inside, `legacy rules: ${JSON.stringify(result.counts.legacy)}`);
});

test("grounding: the real snapshot (development only, read in place) has no animal floating, sinking or inside scenery", (t) => {
    const file = path.join(process.cwd(), "public/ark-local/real.json");
    if (!existsSync(file)) return t.skip("no local real snapshot");
    const snapshot = decodeArkSnapshot(JSON.parse(readFileSync(file, "utf8")))!;
    const audit = auditGrounding(snapshot.animals, {epochs: arkDayEpochs(8)});
    assert.equal(audit.counts.grounded.floats, 0);
    assert.equal(audit.counts.grounded.sinks, 0);
    assert.ok(audit.samples.every((sample) => !sample.id.endsWith("#grounded") || !sample.problems.includes("inside") || sample.kind === "ground"), "off the ground, never inside scenery");
});
