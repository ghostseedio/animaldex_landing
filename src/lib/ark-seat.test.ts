/**
 * ARK-SEAT (the owner, 2026-11-21: "i need guaranteed fixes on animals not properly interacting with their
 * environments from bugs to mammals"): the last pass's own rules on a small scene built here: the solids index against
 * three's Raycaster, and a body hovering, sunk, on a rock, held with nothing under it, on a wall's face, inside a rock.
 * (The whole scene's audit is `scripts/ark-seat-audit.mjs`: `.github/workflows/ark-seat.yml`.)
 */
import assert from "node:assert/strict";
import test from "node:test";
import {BoxGeometry, DoubleSide, Euler, Group, IcosahedronGeometry, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, Quaternion, Raycaster, Scene, Vector3} from "three";
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
    // A tree's crown, 4 m across, its top 5 m up.
    const crown = new Mesh(new BoxGeometry(4, 0.001, 4), new MeshBasicMaterial({side: DoubleSide}));
    crown.userData.kind = "asset-tree";
    crown.position.set(170, 5, 100);
    scene.add(crown);
    const low = new Mesh(new BoxGeometry(0.4, 0.001, 0.4), new MeshBasicMaterial({side: DoubleSide}));
    low.userData.kind = "leaf";
    low.position.set(150, 0.12, 100);
    scene.add(low);
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

test("seat: a level's mesh shown since the meshes were read is what the seats stand on the next frame (WILD-PERCH)", () => {
    // The asset rocks' and trees' levels (`asset-rocks.ts` update): one InstancedMesh per level, empty and hidden until
    // the camera brings an instance to it, then shown with the instance moved onto it from the level it was on.
    const scene = new Scene();
    const geometry = new IcosahedronGeometry(1, 2);
    const near = new InstancedMesh(geometry, new MeshBasicMaterial(), 4);
    const far = new InstancedMesh(geometry, new MeshBasicMaterial(), 4);
    near.userData.kind = far.userData.kind = "asset-rock";
    const at = new Matrix4().compose(new Vector3(10, 0, 10), new Quaternion(), new Vector3(1, 1, 1));
    far.setMatrixAt(0, at);
    far.count = 1;
    near.count = 0;
    near.visible = false;
    scene.add(near, far);
    scene.updateMatrixWorld(true);
    const solids = new DrawnSolids(scene);
    solids.force = true;
    solids.begin(1);
    const down = (): SolidHit[] => {
        const hits: SolidHit[] = [];
        solids.cast(10, 3, 10, 0, -4, 0, ALL, hits);
        return hits;
    };
    assert.ok(down().some((hit) => hit.ny > 0 && Math.abs(hit.y - 1) < 0.05), "the rock, at its far level");
    // The camera comes near: the instance moves to the near level, which is shown (no new reading of the meshes yet).
    near.setMatrixAt(0, at);
    near.count = 1;
    near.visible = true;
    near.instanceMatrix.needsUpdate = true;
    far.count = 0;
    far.visible = false;
    far.instanceMatrix.needsUpdate = true;
    const before = solids.version;
    solids.begin(2);
    const hits = down();
    assert.ok(hits.some((hit) => hit.ny > 0 && Math.abs(hit.y - 1) < 0.05), "the rock, at its near level, the frame it is drawn there");
    assert.ok(solids.version > before, "the seats round it are made again");
    // And one hidden again (its parent's group turned off) is gone the frame it is.
    const group = new Group();
    scene.remove(near);
    group.add(near);
    scene.add(group);
    scene.updateMatrixWorld(true);
    solids.begin(31);
    assert.ok(down().length > 0);
    group.visible = false;
    solids.begin(32);
    assert.equal(down().length, 0, "nothing under a hidden group");
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
    assert.equal(solidClass("|buildings:detail|town:chunk:74"), HARD);
    assert.equal(solidClass("||town:zoo-life"), SOFT);
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
function seatBody(kind: SeatKind, at: Vector3, options: {surface?: SeatInput["surface"]; rotation?: Quaternion; frames?: number; long?: boolean} = {}) {
    const {scene} = world();
    const pass = new SeatPass(scene);
    // (`long`: a body 3 m long, a vertex every 25 cm along it: a dragon's, to a rock 1.2 m across.)
    const geometry = options.long ? new BoxGeometry(0.3, 0.3, 3, 1, 1, 12) : new BoxGeometry(0.2, 0.2, 0.6);
    geometry.translate(0, options.long ? 0.15 : 0.1, 0);
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
        pass.settle({holder, kind: as, matrix, geometry, pose: null, height: options.long ? 0.3 : 0.2, length: options.long ? 3 : 0.6, surface: fell ? null : options.surface ?? null, moving: false, ground, focus: true});
        if (as !== "fly" && as !== "swim" && pass.solids.stats().pending === 0 && holder.seat?.solved && holder.seat.x === holder.seat.tx && holder.seat.y === holder.seat.ty && holder.seat.z === holder.seat.tz && !(holder.seat.doubt > 0 && !holder.seat.fell && holder.seat.doubt < 0.8) && holder.seat.gap === holder.seat.gap && frames > 3) break;
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
    // A flier whose way goes through the rock is taken up over it, and let back when it is clear.
    const through = seatBody("fly", new Vector3(100, 0.2, 100), {frames: 120});
    assert.ok(through.position.y > 0.75, `a flier in the rock: ${through.position.y}`);
    const swimmer = seatBody("swim", new Vector3(100, 0.2, 100), {frames: 120});
    assert.ok(Math.hypot(swimmer.position.x - 100, swimmer.position.z - 100) > 0.4, `a swimmer in the rock: ${swimmer.position.x}, ${swimmer.position.z}`);
});

test("seat: a body inside a rock is put out of it", () => {
    // Its middle in the rock's middle, on the ground: the rock's top is over its back, out of a step's reach.
    const inside = seatBody("lie", new Vector3(100, 0, 100.1), {frames: 240});
    const out = Math.hypot(inside.position.x - 100, inside.position.z - 100);
    assert.ok(out > 0.6 || inside.position.y > 0.6, `still in the rock: ${inside.position.x}, ${inside.position.y}, ${inside.position.z}`);
    assert.equal(inside.seat.inside, 0, "none of its body in the rock at the end");
});

test("seat: a long body through a rock too small to carry it goes out sideways, not up onto it", () => {
    // Lying through the lone rock (1.2 m across, 0.8 m high), its ends on the ground either side: up on the rock's top it
    // would be balanced there with most of it in the air (the Komodo dragon asleep under its den's capstone).
    const through = seatBody("lie", new Vector3(100, 0, 100), {frames: 300, long: true});
    assert.ok(Math.abs(through.position.y) < 0.05, `lifted onto the rock: ${through.position.y}`);
    assert.ok(Math.abs(through.position.x - 100) > 0.6, `still through the rock: ${through.position.x}, ${through.position.z}`);
    assert.equal(through.seat.inside, 0, "none of it in the rock at the end");
});

test("seat: held on a leaf it rests on the leaf; held on nothing near, it stays where its own motion has it", () => {
    const top = {nx: 0, ny: 1, nz: 0};
    const onLeaf = seatBody("perch", new Vector3(140, 1.62, 100), {surface: top});
    assert.ok(Math.abs(onLeaf.position.y - 1.5) < 0.014, `on the leaf: ${onLeaf.position.y}`);
    // A body's length to the side of the leaf: onto the leaf beside it, not left in the air.
    const beside = seatBody("perch", new Vector3(140.5, 1.56, 100), {surface: top});
    assert.ok(Math.abs(beside.position.y - 1.5) < 0.014 && Math.abs(beside.position.x - 140) < 0.45, `beside the leaf: ${beside.position.x}, ${beside.position.y}`);
    // ARK-VANISH (the owner, 2026-11-23: "when i zoom in, animals seem to disappear"): held 3 m over a tree's crown and
    // 2 m out from its edge, it is not carried off metres from where the viewer looks at it: it stays on its limb.
    const over = seatBody("perch", new Vector3(174, 8, 100), {surface: top, frames: 240});
    assert.ok(Math.abs(over.position.y - 8) < 0.014 && Math.abs(over.position.x - 174) < 0.014, `carried off its limb: ${over.position.x}, ${over.position.y}`);
    // Nothing anywhere near: not dropped to the ground either.
    const nothing = seatBody("perch", new Vector3(160, 3, 100), {surface: top});
    assert.ok(Math.abs(nothing.position.y - 3) < 0.013 && !nothing.seat.fell, `dropped: ${nothing.position.y}`);
    // (Development, `__arkSeatFar = true`: the move before ARK-VANISH, onto the crown and down to the ground.)
    (globalThis as {__arkSeatFar?: boolean}).__arkSeatFar = true;
    try {
        const crown = seatBody("perch", new Vector3(174, 8, 100), {surface: top, frames: 240});
        assert.ok(Math.abs(crown.position.y - 5) < 0.014 && crown.position.x < 172.1, `beside a crown: ${crown.position.x}, ${crown.position.y}`);
        const down = seatBody("perch", new Vector3(160, 3, 100), {surface: top});
        assert.ok(Math.abs(down.position.y) < 0.013, `in the air: ${down.position.y}`);
    } finally {
        delete (globalThis as {__arkSeatFar?: boolean}).__arkSeatFar;
    }
    // A walker on the ground under a low leaf (12 cm up, through its body) is not lifted onto it.
    const under = seatBody("stand", new Vector3(150, 0.04, 100));
    assert.ok(Math.abs(under.position.y) < 0.013, `a walker on a leaf: ${under.position.y}`);
    // One the scene only says stands, but plainly up in the air by a leaf (a bird between two of its tree's points): onto the leaf.
    const up = seatBody("stand", new Vector3(140, 1.56, 100));
    assert.ok(Math.abs(up.position.y - 1.5) < 0.014, `up by a leaf: ${up.position.y}`);
});

test("seat: on a wall's face it is brought to the face", () => {
    // The wall's +x face is at x = 120.15; a body clinging 10 cm off it, its back along the face's normal.
    const rotation = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), new Vector3(1, 0, 0));
    const off = seatBody("cling", new Vector3(120.25, 1.5, 100), {surface: {nx: 1, ny: 0, nz: 0}, rotation});
    assert.ok(Math.abs(off.position.x - 120.15) < 0.014, `off the wall: ${off.position.x}`);
    // A face that is not drawn (nothing within its reach): ARK-VANISH, left where its own motion has it, not dropped.
    const gone = seatBody("cling", new Vector3(300, 2, 300), {surface: {nx: 1, ny: 0, nz: 0}, rotation, frames: 200});
    assert.ok(!gone.seat.fell && gone.seat.on === "none", "it knows nothing is drawn there");
    assert.ok(Math.abs(gone.position.y - 2) < 0.013, `dropped: ${gone.position.y}`);
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

test("seat: its own motion going straight up or down does not carry its seat off; a body that does not answer is not chased", () => {
    const {scene} = world();
    const pass = new SeatPass(scene);
    const geometry = new BoxGeometry(0.2, 0.2, 0.6);
    geometry.translate(0, 0.1, 0);
    const matrix = new Matrix4();
    const one = new Vector3(1, 1, 1);
    const ground = () => 0;
    // A bird the schedule has 5 m up in the air, then drifting up 2 cm a frame: on the ground at every frame, its turn or not.
    const holder: SeatHolder = {};
    let worst = 0;
    for (let frame = 0; frame < 120; frame++) {
        pass.begin();
        const own = new Vector3(200, 5 + (frame > 30 ? (frame - 30) * 0.02 : 0), 200);
        const offset = pass.offset(holder, "stand", 1 / 60, false, own.x, own.y, own.z);
        const drawn = own.clone().add(new Vector3(offset?.x ?? 0, offset?.y ?? 0, offset?.z ?? 0));
        matrix.compose(drawn, new Quaternion(), one);
        if (frame > 30) worst = Math.max(worst, Math.abs(drawn.y));
        // (Its turn only every tenth frame once it is seated.)
        if (frame < 20 || frame % 10 === 0) pass.settle({holder, kind: "stand", matrix, geometry, pose: null, height: 0.2, length: 0.6, surface: null, moving: false, ground, focus: true});
    }
    assert.ok(worst < 0.015, `left behind by ${worst}`);
    // Its own motion then has it somewhere else in one frame (off its limb, down on the ground 3 m away): its seat starts
    // afresh there, it is not carried 6 m under the ground by the offset that held it down from the air.
    pass.begin();
    const jumped = pass.offset(holder, "stand", 1 / 60, false, 203, 0, 200);
    assert.equal(jumped, null, `kept its old offset: ${jumped?.y}`);
    // A body something else holds where it is (its matrix takes no offset): its offset never runs away.
    const held: SeatHolder = {};
    let most = 0;
    for (let frame = 0; frame < 400; frame++) {
        pass.begin();
        pass.offset(held, "stand", 1 / 60, false, 210, -0.05, 200);
        matrix.compose(new Vector3(210, -0.05, 200), new Quaternion(), one);
        pass.settle({holder: held, kind: "stand", matrix, geometry, pose: null, height: 0.2, length: 0.6, surface: null, moving: false, ground, focus: true});
        most = Math.max(most, Math.abs(held.seat!.ty));
    }
    assert.ok(most < 0.5, `ran away to ${most}`);
    assert.ok(Math.abs(held.seat!.ty) < 0.11, `left near where its own motion has it: ${held.seat!.ty}`);
});

test("seat: on its feet it rests on its feet, not on a head at the ground", () => {
    // A body with a head hanging 10 cm under its feet's level when posed (a grazing muzzle): two boxes in one mesh, the
    // feet lowest at rest; drawn pitched nose down so the head's end is under the ground.
    const {scene} = world();
    const pass = new SeatPass(scene);
    const geometry = new BoxGeometry(0.2, 0.2, 0.6, 1, 1, 6);
    geometry.translate(0, 0.1, 0);
    const holder: SeatHolder = {};
    const matrix = new Matrix4();
    // (Pitched 20 degrees about its hind feet: its fore end 20 cm under the ground, its hind end on it.)
    const rotation = new Quaternion().setFromEuler(new Euler(0.35, 0, 0));
    for (let frame = 0; frame < 60; frame++) {
        pass.begin();
        const own = new Vector3(220, 0, 200);
        const offset = pass.offset(holder, "lie", 1 / 60, false, own.x, own.y, own.z);
        matrix.compose(own.clone().add(new Vector3(offset?.x ?? 0, offset?.y ?? 0, offset?.z ?? 0)), rotation, new Vector3(1, 1, 1));
        pass.settle({holder, kind: "lie", matrix, geometry, pose: null, height: 0.2, length: 0.6, surface: null, moving: false, ground: () => 0, focus: true});
    }
    // Lying, nothing of it is under the ground: lifted until its lowest point is on it.
    assert.ok(holder.seat!.y > 0.08, `lying, its lowest under the ground: ${holder.seat!.y}`);
});
