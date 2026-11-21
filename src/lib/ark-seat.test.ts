/**
 * ARK-SEAT (the owner, 2026-11-21: "i need guaranteed fixes on animals not properly interacting with their
 * environments from bugs to mammals"): the last pass's own rules on a small scene built here: the solids index against
 * three's Raycaster, and a body hovering, sunk, on a rock, held with nothing under it, on a wall's face, inside a rock.
 * (The whole scene's audit is `scripts/ark-seat-audit.mjs`: `.github/workflows/ark-seat.yml`.)
 */
import assert from "node:assert/strict";
import test from "node:test";
import {BoxGeometry, DoubleSide, Euler, IcosahedronGeometry, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, Quaternion, Raycaster, Scene, Vector3} from "three";
import {SeatPass, seatKind, solidClass, HARD, ROCK, SOFT, TREE, type SeatHolder, type SeatInput, type SeatKind} from "@/ark-scene/seat";
import {DrawnSolids, ALL, type SolidHit} from "@/ark-scene/seat/solids";
import {TriGrid} from "@/ark-scene/seat/trigrid";
import {hullOf, posedHull} from "@/ark-scene/seat/support";

const random = (seed: number) => () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
};

/** A scene of rocks (instanced, turned and scaled), a log, a wall and a leaf, named as the scene names them. */
function world(): {scene: Scene; rocks: InstancedMesh} {
    const scene = new Scene();
    const rock = new IcosahedronGeometry(1, 2);
    const rocks = new InstancedMesh(rock, new MeshBasicMaterial(), 40);
    rocks.userData.kind = "asset-rock";
    const r = random(7);
    const m = new Matrix4();
    for (let i = 0; i < 40; i++) {
        m.compose(new Vector3((r() - 0.5) * 20, r() * 0.4, (r() - 0.5) * 20), new Quaternion().setFromEuler(new Euler(r() * 0.6, r() * 6, r() * 0.6)), new Vector3(0.4 + r() * 1.6, 0.3 + r(), 0.4 + r() * 1.6));
        rocks.setMatrixAt(i, m);
    }
    // One alone, where the bodies below are put: a rock 1.2 m across and 0.8 m high on the ground at (100, 0, 100).
    m.compose(new Vector3(100, 0, 100), new Quaternion(), new Vector3(0.6, 0.8, 0.6));
    rocks.setMatrixAt(0, m);
    rocks.instanceMatrix.needsUpdate = true;
    scene.add(rocks);
    const wall = new Mesh(new BoxGeometry(0.3, 3, 6), new MeshBasicMaterial());
    wall.name = "solid";
    wall.position.set(120, 1.5, 100);
    scene.add(wall);
    const leaf = new Mesh(new BoxGeometry(0.4, 0.001, 0.4), new MeshBasicMaterial({side: DoubleSide}));
    leaf.userData.kind = "leaf";
    leaf.position.set(140, 1.5, 100);
    scene.add(leaf);
    scene.updateMatrixWorld(true);
    return {scene, rocks};
}

test("seat: a geometry's triangle grid finds what three's Raycaster finds", () => {
    const geometry = new IcosahedronGeometry(1, 3);
    const grid = new TriGrid(geometry);
    // (Built a slice at a time.)
    let steps = 0;
    while (!grid.step(100)) steps++;
    assert.ok(steps > 2 && grid.ready);
    const mesh = new Mesh(geometry, new MeshBasicMaterial({side: DoubleSide}));
    mesh.updateMatrixWorld(true);
    const ray = new Raycaster();
    const r = random(3);
    for (let i = 0; i < 300; i++) {
        const x = (r() - 0.5) * 2.4;
        const z = (r() - 0.5) * 2.4;
        const hits: Array<{t: number}> = [];
        grid.cast(x, 2, z, 0, -4, 0, hits as never);
        ray.set(new Vector3(x, 2, z), new Vector3(0, -1, 0));
        const theirs = ray.intersectObject(mesh).map((hit) => hit.distance).sort((a, b) => a - b);
        const mine = hits.map((hit) => hit.t * 4).sort((a, b) => a - b);
        assert.equal(mine.length, theirs.length, `at ${x}, ${z}`);
        mine.forEach((d, k) => assert.ok(Math.abs(d - theirs[k]) < 1e-4, `${d} against ${theirs[k]}`));
    }
});

test("seat: the solids index reads every instance as placed (against three's Raycaster)", () => {
    const {scene, rocks} = world();
    const solids = new DrawnSolids(scene);
    solids.force = true;
    solids.begin(1);
    (rocks.material as MeshBasicMaterial).side = DoubleSide;
    const ray = new Raycaster();
    const r = random(11);
    let met = 0;
    for (let i = 0; i < 400; i++) {
        const x = (r() - 0.5) * 22;
        const z = (r() - 0.5) * 22;
        const hits: SolidHit[] = [];
        assert.ok(solids.cast(x, 6, z, 0, -8, 0, ALL, hits));
        ray.set(new Vector3(x, 6, z), new Vector3(0, -1, 0));
        ray.far = 8;
        const theirs = ray.intersectObject(rocks).map((hit) => hit.point.y).sort((a, b) => a - b);
        const mine = hits.map((hit) => hit.y).sort((a, b) => a - b);
        assert.equal(mine.length, theirs.length, `at ${x}, ${z}`);
        mine.forEach((y, k) => assert.ok(Math.abs(y - theirs[k]) < 1e-3));
        met += mine.length;
        // The top face met from above looks up; the last one down.
        if (hits.length >= 2) {
            const top = hits.reduce((a, b) => (a.y > b.y ? a : b));
            assert.ok(top.ny > 0, "a rock's top face's normal is up");
        }
    }
    assert.ok(met > 60, `only ${met} faces met`);
});

test("seat: what each drawn thing is to an animal", () => {
    assert.equal(solidClass("asset-rock||"), ROCK);
    assert.equal(solidClass("|props:den-rocks:near|props:den-entrances"), ROCK);
    assert.equal(solidClass("|props:rocks:-3,-2:far|props:areas"), ROCK);
    assert.equal(solidClass("|zoo:rocks|town:zoo"), ROCK);
    assert.equal(solidClass("asset-tree|asset-tree:oak-a:lod1|"), TREE);
    assert.equal(solidClass("asset-tree|asset-tree:oak-a:card|"), 0);
    assert.equal(solidClass("town:trees|town:trees:log-mossy-a:lod2|town:trees"), HARD);
    assert.equal(solidClass("asset-floor||"), SOFT);
    assert.equal(solidClass("flower||"), SOFT);
    assert.equal(solidClass("|solid|town:chunk-batches"), HARD);
    assert.equal(solidClass("|ground|town:chunk-batches"), 0);
    assert.equal(solidClass("|ark-ground-12|ark-ground"), 0);
    assert.equal(solidClass("|bug-ground:blade|bug-ground"), 0);
    assert.equal(solidClass("|ark-fresh-water|ark-ground"), 0);
    assert.equal(solidClass("|props:nest-cup-moss:near|props:homes"), SOFT);
    assert.equal(solidClass("|something-new|"), -1);
});

test("seat: the kinds left alone and the kinds seated", () => {
    const facts = {riding: false, carried: false, hanging: false, onWeb: false, flying: false, water: false, afloat: false, den: false, growing: false, acting: false, swinging: false, hopping: false, surfaceNy: null as number | null, lying: false};
    assert.equal(seatKind(facts), "stand");
    assert.equal(seatKind({...facts, lying: true}), "lie");
    assert.equal(seatKind({...facts, surfaceNy: 0.9, afloat: true}), "perch");
    assert.equal(seatKind({...facts, surfaceNy: 0.1}), "cling");
    assert.equal(seatKind({...facts, flying: true, surfaceNy: 0.9}), "fly");
    assert.equal(seatKind({...facts, water: true}), "swim");
    assert.equal(seatKind({...facts, afloat: true}), "afloat");
    assert.equal(seatKind({...facts, hopping: true}), "hop");
});

/** A body (a box 0.6 long, 0.2 high, 0.2 wide, its base at its origin) drawn at a place, and the pass stepped to rest. */
function seatBody(kind: SeatKind, at: Vector3, options: {surface?: SeatInput["surface"]; rotation?: Quaternion; frames?: number} = {}) {
    const {scene} = world();
    const pass = new SeatPass(scene);
    const geometry = new BoxGeometry(0.2, 0.2, 0.6);
    geometry.translate(0, 0.1, 0);
    const holder: SeatHolder = {};
    const matrix = new Matrix4();
    const position = new Vector3();
    const ground = () => 0;
    let frames = 0;
    for (; frames < (options.frames ?? 90); frames++) {
        pass.begin();
        position.copy(at);
        // (As the scene does: held where nothing is drawn, it is drawn upright and comes down.)
        const fell = Boolean(options.surface) && pass.fallen(holder, kind, at.x, at.z);
        const as = fell ? "perch" : kind;
        const offset = pass.offset(holder, as, 1 / 60);
        if (offset) position.add(new Vector3(offset.x, offset.y, offset.z));
        matrix.compose(position, fell ? new Quaternion() : options.rotation ?? new Quaternion(), new Vector3(1, 1, 1));
        // (Its turn every frame here: the chosen animal's.)
        pass.settle({holder, kind: as, matrix, geometry, pose: null, height: 0.2, length: 0.6, surface: fell ? null : options.surface ?? null, moving: false, ground, focus: true});
        if (pass.solids.stats().pending === 0 && holder.seat?.solved && holder.seat.x === holder.seat.tx && holder.seat.y === holder.seat.ty && holder.seat.z === holder.seat.tz && frames > 3) break;
    }
    return {seat: holder.seat!, position: position.clone(), frames, pass};
}

test("seat: a body hovering comes down onto the ground, a sunk one up, and both arrive", () => {
    const hover = seatBody("stand", new Vector3(200, 0.5, 200));
    assert.ok(Math.abs(hover.position.y) < 0.013, `hovering: left at ${hover.position.y}`);
    assert.ok(hover.frames < 60, "it arrives");
    const sunk = seatBody("stand", new Vector3(200, -0.3, 200));
    assert.ok(Math.abs(sunk.position.y) < 0.013, `sunk: left at ${sunk.position.y}`);
    const fine = seatBody("stand", new Vector3(200, 0.005, 200));
    assert.equal(fine.seat.ty, 0, "within a centimetre: left as it is");
});

test("seat: over a rock it stands on the rock; a flier is left alone", () => {
    // Over the lone rock's top (0.8 m): hovering at 1.5 m, it comes down onto the rock, not through it to the ground.
    const over = seatBody("stand", new Vector3(100, 1.5, 100));
    assert.ok(over.position.y > 0.6 && over.position.y < 0.82, `on the rock: ${over.position.y}`);
    assert.match(over.seat.on, /asset-rock/);
    const flier = seatBody("fly", new Vector3(100, 1.5, 100));
    assert.equal(flier.position.y, 1.5);
});

test("seat: a body inside a rock is put out of it", () => {
    // Its middle in the rock's middle, on the ground: the rock's top is over its back, out of a step's reach.
    const inside = seatBody("lie", new Vector3(100, 0, 100.1), {frames: 240});
    const out = Math.hypot(inside.position.x - 100, inside.position.z - 100);
    assert.ok(out > 0.6 || inside.position.y > 0.6, `still in the rock: ${inside.position.x}, ${inside.position.y}, ${inside.position.z}`);
    assert.equal(inside.seat.inside, 0, "none of its body in the rock at the end");
});

test("seat: held on a leaf it rests on the leaf; held on nothing it comes down", () => {
    const up = {nx: 0, ny: 1, nz: 0};
    const onLeaf = seatBody("perch", new Vector3(140, 1.62, 100), {surface: up});
    assert.ok(Math.abs(onLeaf.position.y - 1.5) < 0.014, `on the leaf: ${onLeaf.position.y}`);
    // A body's length to the side of the leaf: onto the leaf beside it, not left in the air.
    const beside = seatBody("perch", new Vector3(140.5, 1.56, 100), {surface: up});
    assert.ok(Math.abs(beside.position.y - 1.5) < 0.014 && Math.abs(beside.position.x - 140) < 0.45, `beside the leaf: ${beside.position.x}, ${beside.position.y}`);
    // Nothing anywhere near: down onto the ground.
    const nothing = seatBody("perch", new Vector3(160, 3, 100), {surface: up});
    assert.ok(Math.abs(nothing.position.y) < 0.013, `in the air: ${nothing.position.y}`);
    // A walker under the leaf is not lifted onto it.
    const under = seatBody("stand", new Vector3(140, 1.45, 100));
    assert.ok(Math.abs(under.position.y) < 0.013, `a walker on a leaf: ${under.position.y}`);
});

test("seat: on a wall's face it is brought to the face", () => {
    // The wall's +x face is at x = 120.15; a body clinging 10 cm off it, its back along the face's normal.
    const rotation = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), new Vector3(1, 0, 0));
    const off = seatBody("cling", new Vector3(120.25, 1.5, 100), {surface: {nx: 1, ny: 0, nz: 0}, rotation});
    assert.ok(Math.abs(off.position.x - 120.15) < 0.014, `off the wall: ${off.position.x}`);
    // A face that is not drawn (nothing within its reach): not left on the air, down onto the ground, upright.
    const gone = seatBody("cling", new Vector3(300, 2, 300), {surface: {nx: 1, ny: 0, nz: 0}, rotation, frames: 200});
    assert.ok(gone.seat.fell, "it knows nothing is drawn there");
    assert.ok(Math.abs(gone.position.y) < 0.013, `left on the air: ${gone.position.y}`);
});

test("seat: a rig's hull points are posed by the rows its shader reads", () => {
    const geometry = new BoxGeometry(1, 1, 1);
    const hull = hullOf(geometry);
    assert.ok(hull.vertices.length >= 8 && hull.vertices.length <= 66);
    const out = new Float32Array(hull.vertices.length * 3);
    assert.equal(posedHull(hull, null, out), hull.vertices.length);
    // (A still mesh: its own corners.)
    for (let i = 0; i < hull.vertices.length; i++) assert.ok(Math.abs(Math.abs(out[i * 3]) - 0.5) < 1e-6);
});
