/**
 * Graphics pass 2, lane CONTACT (the owner, 2026-11-16): "sometimes shadows are appearing not on the surface and halfway
 * up an animal", "the lions and tigers are sinking into the ground same with bears etc. and sleeping poses look bad",
 * "snakes are rendering in the ground e.g. boa constrictor is sleeping half in the ground", "the tails on birds are
 * floppy". The rules, held over whole islands and real model sizes: a contact shadow on the ground the feet are on; a
 * lying body's belly on the drawn ground (within a few cm, nothing of the torso under it); a legless body flat; the
 * four-legged rigs' mid-stride lying clips held; a bird's tail never wagged like a dog's.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {Scene, type WebGLRenderer} from "three";
import {AnimalLook} from "@/ark-scene/animal-look";
import {drawnGround, drawnGroundHeight} from "@/ark-scene/grounding/drawn-ground";
import {lieOnGround, lyingPoints} from "@/ark-scene/grounding/stand";
import {modelBase} from "@/ark-scene/grounding/base";
import {bellyShare, LEGLESS_BELLY, lyingBody, lyingDrop, lyingTorso, POSTURE_SPECS, sleepStyle, type SleepPosture} from "@/ark-scene/sleep";
import {QUADRUPED_LYING_HELD, rigClip} from "@/ark-scene/rig-clips";
import {tailWagOf} from "@/ark-scene/animal-material";
import {sampleGround, setArkWorld, TERRAIN_HALF} from "@/ark-scene/world";
import {setTownWalkSurfaces, townDrawnHeight, townTileHeight} from "@/ark-scene/islands/town/drawn-ground";
import {TOWN_HALF} from "@/ark-scene/islands/town/plan";
import {launchEnclosures} from "@/ark-scene/islands/town/areas";
import {townSurfacesFor} from "@/ark-scene/islands/town/validate-animals";

const look = () => new AnimalLook({scene: new Scene(), renderer: {} as WebGLRenderer, closeUpBase: null, basisBase: "", enabled: true});

// MARK: 1. Shadows on the ground the animal is on

test("contact: the wild island's contact shadow is on the drawn ground (where the feet are), not the analytic one", () => {
    setArkWorld("v2");
    const a = look();
    let worstOld = 0;
    let checked = 0;
    for (let x = -TERRAIN_HALF + 3; x < TERRAIN_HALF - 3; x += 7.3)
        for (let z = -TERRAIN_HALF + 3; z < TERRAIN_HALF - 3; z += 7.9) {
            const drawn = drawnGroundHeight(x, z);
            if (drawn < 0.2) continue;
            checked++;
            worstOld = Math.max(worstOld, Math.abs(sampleGround(x, z).height - drawn));
            for (const exact of [true, false]) assert.ok(Math.abs(a.groundUnder(x, z, 0, exact).height - drawn) < 1e-4, `${x},${z}`);
            const n = a.groundNormal(x, z);
            const g = drawnGround(x, z);
            assert.ok(Math.abs(n.x - g.nx) < 1e-9 && Math.abs(n.y - g.ny) < 1e-9 && Math.abs(n.z - g.nz) < 1e-9, "its slope: the drawn triangle's");
        }
    assert.ok(checked > 200, `${checked} points on land`);
    // (The analytic ground the shadow used to lie on is off the drawn one by this much somewhere: the cliff bands.)
    assert.ok(worstOld > 0.1, `the old gap ${worstOld.toFixed(2)} m`);
});

test("contact: on the town, under a raised floor (a zoo house's floor, a cage's perch, a deck), the floor the body is on takes its shadow", () => {
    const surfaces = townSurfacesFor(launchEnclosures(), []);
    setTownWalkSurfaces(surfaces);
    let stacked = 0;
    let worst = 0;
    for (let x = -TOWN_HALF + 2; x < TOWN_HALF - 2; x += 0.9)
        for (let z = -TOWN_HALF + 2; z < TOWN_HALF - 2; z += 0.9) {
            const tile = townTileHeight(x, z);
            const top = townDrawnHeight(x, z, surfaces);
            if (top - tile < 0.35) continue;
            // An animal on the tile under it (a body at the tile's height): its feet and now its shadow on the tile.
            const under = townDrawnHeight(x, z, surfaces, tile);
            if (under - tile > 0.3) continue;
            stacked++;
            worst = Math.max(worst, top - under);
            assert.ok(under < top - 0.05, "the floor below, not the one over its back");
        }
    setTownWalkSurfaces(null);
    assert.ok(stacked > 0, "the town has stacked floors");
    // (The shadow drawn on the higher one was this far up the animal's body.)
    assert.ok(worst > 0.3, `up to ${worst.toFixed(2)} m over the feet`);
});

// MARK: 2-3. Lying on the ground

/** A model-space test body: a torso box over four legs (or none), sampled as vertices. */
function bodyMesh(o: {length: number; height: number; width: number; belly: number; legs: boolean; midLeg?: boolean}) {
    const pts: Array<[number, number, number]> = [];
    const h2 = o.height / 2;
    const bellyY = -h2 + o.belly * o.height;
    for (let i = 0; i <= 40; i++)
        for (let j = 0; j <= 10; j++)
            for (const k of [0, 1]) {
                const z = -o.length / 2 + (o.length * i) / 40;
                const y = bellyY + ((h2 - bellyY) * j) / 10;
                pts.push([k ? o.width / 2 : -o.width / 2, y, z]);
                if (j === 0 || j === 10) pts.push([-o.width / 2 + (o.width * k), y, z]);
            }
    if (o.legs)
        for (const lz of o.midLeg ? [0.36, 0.05, -0.3, -0.38] : [0.36, 0.28, -0.3, -0.38])
            for (const lx of [-0.3, 0.3])
                for (let j = 0; j <= 8; j++) pts.push([lx * o.width, -h2 + ((bellyY + h2) * j) / 8, lz * o.length]);
    return pts;
}

test("contact: a body's belly from its mesh: a four-legged one's underside (mid-stride too), a snake's at 0", () => {
    for (const midLeg of [false, true]) {
        const pts = bodyMesh({length: 1, height: 0.62, width: 0.25, belly: 0.3, legs: true, midLeg});
        const box = {minY: -0.31, maxY: 0.31, minZ: -0.5, maxZ: 0.5};
        const b = bellyShare(pts.length, (i) => pts[i][1], (i) => pts[i][2], box);
        assert.ok(Math.abs(b - 0.3) < 0.04, `a lion's belly ${b} (mid-stride ${midLeg})`);
    }
    const snake = bodyMesh({length: 1, height: 0.07, width: 0.2, belly: 0, legs: false});
    const b = bellyShare(snake.length, (i) => snake[i][1], (i) => snake[i][2], {minY: -0.035, maxY: 0.035, minZ: -0.5, maxZ: 0.5});
    assert.ok(b < LEGLESS_BELLY, `a snake's ${b}`);
});

test("contact: a legless sleeper lies flat (no drop, no roll); a legged one drops no deeper than its belly", () => {
    for (const posture of ["curl", "side", "sternal", "flat"] as SleepPosture[]) {
        const spec = POSTURE_SPECS[posture];
        assert.deepEqual(lyingBody({legs: spec.drop, roll: spec.roll}, spec.drop, 0.01), {legs: 0, roll: 0}, posture);
        const lion = lyingBody({legs: spec.drop, roll: spec.roll}, spec.drop, 0.28);
        assert.ok(lion.legs <= 0.28 + 1e-9 && lion.roll === spec.roll, posture);
    }
    // The boa's own posture is a curl (its stored style): flat on the ground.
    assert.equal(sleepStyle("boa-constrictor").posture, "curl");
    // On its side nearly all the way over (the legs along the ground), and a side lifted onto the ground, never left under it.
    assert.ok(POSTURE_SPECS.side.roll >= 1.35);
    assert.ok(lyingDrop({minX: -0.12, maxX: 0.12, minY: 0, maxY: 0.62}, 0.3, 1.4) < 0, "rolled onto its side about its feet: lifted");
});

test("contact: lying bodies on the drawn ground across species, postures and slopes: the torso's lowest on it, none of it under", () => {
    const species = ["african-lion", "bengal-tiger", "brown-bear", "polar-bear", "domestic-dog", "red-deer", "african-bush-elephant", "boa-constrictor", "reticulated-python", "domestic-cat"];
    let n = 0;
    for (const slug of species) {
        const base = modelBase(slug);
        if (!base) continue;
        const half = {x: base.size.x / 2, y: base.size.y / 2, z: base.size.z / 2};
        const box = {min: {x: -half.x, y: -half.y, z: -half.z}, max: {x: half.x, y: half.y, z: half.z}};
        const legless = base.plan === "snake";
        const belly = legless ? 0 : 0.28;
        const scale = 1.8 / Math.max(base.size.z, 1e-3);
        for (const posture of ["sternal", "side", "curl", "flat"] as SleepPosture[]) {
            const spec = POSTURE_SPECS[posture];
            const body = lyingBody({legs: spec.drop, roll: -spec.roll}, spec.drop, belly);
            const torso = lyingTorso(box, body.legs);
            for (const [nx, nz] of [[0, 0], [0.18, 0], [0, -0.25], [0.12, 0.15]]) {
                const ny = Math.sqrt(1 - nx * nx - nz * nz);
                // The plane through (10, 2.4, -6) with this normal.
                const plane = (x: number, z: number) => 2.4 - (nx * (x - 10) + nz * (z - -6)) / ny;
                for (const yaw of [0, 1.1, -2.4]) {
                    const stand = lieOnGround(10, -6, yaw, scale, torso, 0, body.roll, 2.4, {nx, ny, nz});
                    const points = lyingPoints(stand, 10, -6, yaw, scale, torso, 0, body.roll);
                    const gaps = points.map((p) => p.y - plane(p.x, p.z));
                    const lowest = Math.min(...gaps);
                    assert.ok(Math.abs(lowest) < 0.01, `${slug} ${posture} slope ${nx},${nz} yaw ${yaw}: lowest ${lowest.toFixed(3)} m`);
                    if (legless) assert.ok(Math.abs(stand.roll + body.roll) <= 0.3 + 1e-9, "a snake is not rolled onto its side");
                    n++;
                }
            }
        }
    }
    assert.ok(n >= 300, `${n} cases`);
});

// MARK: 2. The four-legged rigs' lying clips

test("contact: a four-legged rig's mid-stride lying clips are held (the scene's postures instead); its standing clips and other plans' sleep play", () => {
    const clip = {frames: 24, seconds: 1, loop: true, pass: true};
    const names = ["idle", "walk", "run", "groom", ...QUADRUPED_LYING_HELD, "sleep_tuck", "sleep_one_leg", "sleep_hang", "sleep_stand"];
    const clips = Object.fromEntries(names.map((n) => [n, clip]));
    const manifest = {flight: true, species: {"african-lion": {state: "passed", plan: "quadruped", clips}, "grey-heron": {state: "passed", plan: "walking_bird", clips}, "plains-zebra": {state: "passed", plan: "quadruped", clips}}};
    for (const name of QUADRUPED_LYING_HELD) assert.equal(rigClip(manifest, "african-lion", name), null, `lion ${name} held`);
    for (const name of ["idle", "walk", "run", "groom"]) assert.ok(rigClip(manifest, "african-lion", name), `lion ${name} plays`);
    assert.ok(rigClip(manifest, "plains-zebra", "sleep_stand"), "standing asleep is no lying clip");
    for (const name of ["sleep", "sleep_tuck", "sleep_one_leg"]) assert.ok(rigClip(manifest, "grey-heron", name), `a heron's ${name} plays`);
});

// MARK: 4. Birds' tails

test("contact: a bird's tail is never wagged side to side (stiff feathers); a mammal's and a lizard's are", () => {
    assert.equal(tailWagOf("bird"), 0);
    for (const plan of ["mammal", "reptile", null, undefined]) assert.equal(tailWagOf(plan), 1);
});
