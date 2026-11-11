/**
 * The props' shapes, built here in code in the Ark's look (soft,
 * vertex-coloured forms, a little larger than life so they read from the
 * scene's closest camera): every function returns a painted, non-indexed
 * geometry in its own metres, standing on y = 0 and facing +z, ready to be
 * merged or instanced. Each has a near (detailed) form and, where it is seen
 * from further, a far form of a few triangles.
 */

import {
    BoxGeometry,
    BufferAttribute,
    BufferGeometry,
    Color,
    ConeGeometry,
    CylinderGeometry,
    DodecahedronGeometry,
    IcosahedronGeometry,
    LatheGeometry,
    SphereGeometry,
    TorusGeometry,
    Vector2,
    Vector3
} from "three";
import {lumpy, merge, paint, place} from "@/ark-scene/props/kit";
import {seeded} from "@/ark-scene/world";

const TWIG = new Color("#7a5f43");
const TWIG_DARK = new Color("#5b4532");
const STRAW = new Color("#c9a868");
const DOWN = new Color("#d9cfbf");
const SOIL = new Color("#7d6249");
const SAND = new Color("#d8c39a");

const jitter = (i: number, k = 7) => 0.86 + ((i * k) % 11) / 55;

/** A stick: a thin box from a to b. */
function stick(ax: number, ay: number, az: number, bx: number, by: number, bz: number, thickness: number, colour: Color, shade = 1): BufferGeometry {
    const a = new Vector3(ax, ay, az);
    const b = new Vector3(bx, by, bz);
    const length = a.distanceTo(b);
    const geometry = new BoxGeometry(thickness, thickness, length);
    geometry.lookAt(b.clone().sub(a));
    geometry.translate((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
    return paint(geometry, colour, (_, i) => shade * jitter(i));
}

// MARK: - Birds' nests

/** A cup of twigs and grass with a soft lining: a songbird's in a fork, `r` across its rim. */
export function cupNest(r: number, seed = 1): BufferGeometry {
    const random = seeded(4100 + seed);
    const parts: BufferGeometry[] = [];
    const rim = new TorusGeometry(r * 0.78, r * 0.3, 7, 18);
    rim.rotateX(Math.PI / 2);
    rim.scale(1, 0.75, 1);
    lumpy(rim, 0.12, random);
    parts.push(paint(place(rim, 0, r * 0.32, 0), TWIG, (y, i) => 0.78 + 0.3 * (y / r) + ((i * 13) % 7) / 40));
    const lining = new SphereGeometry(r * 0.74, 14, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
    lining.scale(1, 0.55, 1);
    parts.push(paint(place(lining, 0, r * 0.4, 0), DOWN, (y) => 0.7 + 0.3 * Math.min(Math.max((y / r) * 2, 0), 1)));
    // Loose twigs poking out of the rim.
    for (let i = 0; i < 16; i++) {
        const a = random() * Math.PI * 2;
        const from = r * (0.5 + random() * 0.2);
        const to = r * (1.05 + random() * 0.35);
        const y = r * (0.15 + random() * 0.45);
        parts.push(stick(Math.cos(a) * from, y, Math.sin(a) * from, Math.cos(a + 0.5) * to, y + (random() - 0.5) * r * 0.3, Math.sin(a + 0.5) * to, r * 0.05, random() < 0.5 ? TWIG : STRAW));
    }
    return merge(parts);
}

/** A platform of crossed sticks: a heron's, a stork's or an eagle's (`r` across). */
export function platformNest(r: number, seed = 2): BufferGeometry {
    const random = seeded(4200 + seed);
    const parts: BufferGeometry[] = [];
    const base = new CylinderGeometry(r * 0.9, r * 0.7, r * 0.32, 14, 1);
    lumpy(base, 0.1, random);
    parts.push(paint(place(base, 0, r * 0.16, 0), TWIG_DARK, (y, i) => 0.8 + 0.4 * (y / r) + ((i * 7) % 5) / 30));
    const dip = new SphereGeometry(r * 0.6, 12, 4, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
    dip.scale(1, 0.25, 1);
    parts.push(paint(place(dip, 0, r * 0.33, 0), STRAW, () => 0.75));
    for (let i = 0; i < 30; i++) {
        const a = random() * Math.PI;
        const length = r * (1.4 + random() * 0.8);
        const cx = (random() - 0.5) * r * 0.5;
        const cz = (random() - 0.5) * r * 0.5;
        const y = r * (0.05 + random() * 0.32);
        parts.push(stick(cx - Math.cos(a) * length / 2, y, cz - Math.sin(a) * length / 2, cx + Math.cos(a) * length / 2, y + (random() - 0.5) * r * 0.1, cz + Math.sin(a) * length / 2, r * 0.045, random() < 0.6 ? TWIG : TWIG_DARK));
    }
    return merge(parts);
}

/** A scrape on the ground lined with down and grass: a duck's, a plover's (`r` across). */
export function groundNest(r: number, seed = 3): BufferGeometry {
    const random = seeded(4300 + seed);
    const parts: BufferGeometry[] = [];
    const rim = new TorusGeometry(r * 0.75, r * 0.26, 6, 16);
    rim.rotateX(Math.PI / 2);
    rim.scale(1, 0.55, 1);
    lumpy(rim, 0.3, random);
    parts.push(paint(place(rim, 0, r * 0.1, 0), STRAW, (_, i) => 0.62 + ((i * 11) % 9) / 22));
    const down = new SphereGeometry(r * 0.72, 12, 5, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
    down.scale(1, 0.3, 1);
    lumpy(down, 0.08, random);
    parts.push(paint(place(down, 0, r * 0.14, 0), DOWN, (_, i) => 0.8 + ((i * 5) % 7) / 35));
    // Loose straws and down feathers round the rim.
    for (let i = 0; i < 40; i++) {
        const a = random() * Math.PI * 2;
        const from = r * (0.55 + random() * 0.3);
        const to = r * (0.95 + random() * 0.45);
        const y = r * (0.05 + random() * 0.18);
        parts.push(stick(Math.cos(a) * from, y, Math.sin(a) * from, Math.cos(a + 0.4) * to, y + (random() - 0.5) * r * 0.15, Math.sin(a + 0.4) * to, r * 0.03, random() < 0.7 ? STRAW : TWIG));
    }
    for (let i = 0; i < 6; i++) {
        const a = random() * Math.PI * 2;
        const feather = new SphereGeometry(r * 0.09, 5, 4);
        feather.scale(1.4, 0.5, 1);
        parts.push(paint(place(feather, Math.cos(a) * r * 0.75, r * 0.22, Math.sin(a) * r * 0.75), DOWN, () => 1.05));
    }
    for (let i = 0; i < 12; i++) {
        const a = random() * Math.PI * 2;
        const d = r * (0.85 + random() * 0.3);
        const blade = new ConeGeometry(r * 0.04, r * (0.4 + random() * 0.4), 3);
        blade.rotateZ((random() - 0.5) * 0.9);
        parts.push(paint(place(blade, Math.cos(a) * d, r * 0.2, Math.sin(a) * d), new Color("#8f9a52"), (y) => 0.7 + y));
    }
    return merge(parts);
}

/** A mud cup under the eaves (a swallow's) or a ball of grass tucked in (a sparrow's): `r` across, its back to the wall (−z). */
export function eavesNest(r: number, seed = 4): BufferGeometry {
    const random = seeded(4400 + seed);
    const parts: BufferGeometry[] = [];
    const ball = new IcosahedronGeometry(r * 0.75, 1);
    ball.scale(1.1, 0.8, 0.8);
    lumpy(ball, 0.25, random);
    parts.push(paint(place(ball, 0, 0, r * 0.35), STRAW, (_, i) => 0.7 + ((i * 7) % 9) / 25));
    // Its entrance, a dark hole on the front.
    const hole = new SphereGeometry(r * 0.22, 8, 6);
    hole.scale(1, 0.8, 0.4);
    parts.push(paint(place(hole, r * 0.1, -r * 0.05, r * 0.92), new Color("#1f1811")));
    for (let i = 0; i < 10; i++) {
        const a = random() * Math.PI * 2;
        parts.push(stick(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.4, r * 0.4, Math.cos(a) * r * 1.0, Math.sin(a) * r * 0.75, r * 0.5, r * 0.05, STRAW, 0.9));
    }
    return merge(parts);
}

/**
 * A tree hollow: a dark opening in the bark with a swollen lip of healed wood
 * (on a trunk, facing +z). Round for a woodpecker's or a parrot's hole; a
 * tall split (`slit`) for a natural hollow where a limb rotted out (a wild
 * bees' nest).
 */
export function hollow(r: number, slit = false): BufferGeometry {
    const parts: BufferGeometry[] = [];
    const lip = new TorusGeometry(r, r * (slit ? 0.24 : 0.3), 7, 20);
    lip.scale(slit ? 0.48 : 0.75, slit ? 1.35 : 1, 0.6);
    lumpy(lip, 0.25, seeded(4380));
    parts.push(paint(place(lip, 0, 0, r * 0.05), new Color("#5a4431"), (_, i) => jitter(i, 5)));
    const dark = new SphereGeometry(r * 0.9, 12, 8, 0, Math.PI * 2, 0, Math.PI);
    dark.scale(slit ? 0.44 : 0.7, slit ? 1.3 : 1, 0.25);
    parts.push(paint(dark, new Color("#120d09")));
    return merge(parts);
}

/** An egg (`size` long), speckled tones come from the instance tint. */
export function egg(size: number): BufferGeometry {
    const geometry = new SphereGeometry(size / 2, 10, 8);
    geometry.scale(0.78, 1, 0.78);
    return paint(place(geometry, 0, size * 0.42, 0), new Color("#f3eee2"), (y, i) => 0.88 + 0.12 * (y / size) + (i % 5 === 0 ? -0.08 : 0));
}

// MARK: - Insects' homes

/** An ant mound: a dome of needles and fine soil, speckled, with a few entrances (`r` across, `h` high). */
export function antMound(r: number, h: number, seed = 5): BufferGeometry {
    const random = seeded(4500 + seed);
    const dome = new SphereGeometry(r, 36, 14, 0, Math.PI * 2, 0, Math.PI / 2);
    dome.scale(1, h / r, 1);
    lumpy(dome, 0.1, random);
    // A fine, grainy surface: every vertex nudged a little (a heap of needles and grit, not a shell).
    {
        const position = dome.getAttribute("position");
        for (let i = 0; i < position.count; i++) {
            const k = 1 + (random() - 0.5) * 0.06;
            position.setXYZ(i, position.getX(i) * k, position.getY(i) * (1 + (random() - 0.5) * 0.08), position.getZ(i) * k);
        }
    }
    const parts = [paint(dome, new Color("#7b5d3f"), (y, i, x, z) => 0.72 + 0.35 * (y / h) + (((Math.floor(x * 30) * 7 + Math.floor(z * 30) * 13) % 9) - 4) / 40)];
    for (let i = 0; i < 5; i++) {
        const a = random() * Math.PI * 2;
        const t = 0.35 + random() * 0.4;
        const hole = new SphereGeometry(r * 0.06, 6, 4);
        hole.scale(1, 0.6, 1);
        const y = h * Math.cos(t * Math.PI / 2) * 0.98;
        const d = r * Math.sin(t * Math.PI / 2);
        parts.push(paint(place(hole, Math.cos(a) * d, y, Math.sin(a) * d), new Color("#21170f")));
    }
    // Needles and twigs over it, the ants' thatch.
    for (let i = 0; i < 90; i++) {
        const a = random() * Math.PI * 2;
        const t = Math.sqrt(random()) * 0.95;
        const d = r * Math.sin(t * Math.PI / 2);
        const y = h * Math.cos(t * Math.PI / 2);
        const b = a + (random() - 0.5) * 2.5;
        const length = r * (0.08 + random() * 0.12);
        parts.push(stick(Math.cos(a) * d, y, Math.sin(a) * d, Math.cos(a) * d + Math.cos(b) * length, y + (random() - 0.6) * length * 0.4, Math.sin(a) * d + Math.sin(b) * length, r * 0.012, random() < 0.6 ? new Color("#8a6236") : new Color("#5d4128")));
    }
    // A skirt of loose spoil.
    const skirt = new CylinderGeometry(r * 1.25, r * 1.4, 0.04, 18, 1);
    parts.push(paint(place(skirt, 0, 0.01, 0), new Color("#8a6c4b"), (_, i) => jitter(i)));
    return merge(parts);
}

/** A termite mound: a buttressed cathedral of red earth with a few spires (`h` high). */
export function termiteMound(h: number, seed = 6): BufferGeometry {
    const random = seeded(4600 + seed);
    const parts: BufferGeometry[] = [];
    const spires = 1 + Math.floor(random() * 3);
    for (let s = 0; s < spires; s++) {
        const height = h * (s === 0 ? 1 : 0.45 + random() * 0.35);
        const base = h * (s === 0 ? 0.34 : 0.18);
        const points: Vector2[] = [];
        for (let k = 0; k <= 8; k++) {
            const t = k / 8;
            points.push(new Vector2(Math.max(base * (1 - t) ** 1.4 * (1 + 0.15 * Math.sin(t * 9 + s)), 0.01), t * height));
        }
        const lathe = new LatheGeometry(points, 9);
        lumpy(lathe, 0.08, random);
        const ox = s === 0 ? 0 : (random() - 0.5) * h * 0.4;
        const oz = s === 0 ? 0 : (random() - 0.5) * h * 0.4;
        parts.push(paint(place(lathe, ox, 0, oz), new Color("#b0673f"), (y, i) => 0.72 + 0.3 * (y / h) + ((i * 11) % 7) / 50));
    }
    const foot = new CylinderGeometry(h * 0.42, h * 0.55, h * 0.12, 12, 1);
    lumpy(foot, 0.1, random);
    parts.push(paint(place(foot, 0, h * 0.04, 0), new Color("#a35f3a"), (_, i) => jitter(i)));
    return merge(parts);
}

/** A far termite mound: a few triangles. */
export function termiteMoundFar(h: number): BufferGeometry {
    return paint(new ConeGeometry(h * 0.36, h, 6), new Color("#ad6640"), (y) => 0.75 + 0.3 * (y / h + 0.5)).translate(0, h / 2, 0);
}

/** A hive box in the garden: a stand, two boxes, a gabled roof (about 0.9 m tall). */
export function hiveBox(): BufferGeometry {
    const white = new Color("#ece7dc");
    const parts: BufferGeometry[] = [
        paint(place(new BoxGeometry(0.06, 0.32, 0.06), -0.2, 0.16, -0.2), new Color("#6d5844")),
        paint(place(new BoxGeometry(0.06, 0.32, 0.06), 0.2, 0.16, -0.2), new Color("#6d5844")),
        paint(place(new BoxGeometry(0.06, 0.32, 0.06), -0.2, 0.16, 0.2), new Color("#6d5844")),
        paint(place(new BoxGeometry(0.06, 0.32, 0.06), 0.2, 0.16, 0.2), new Color("#6d5844")),
        paint(place(new BoxGeometry(0.52, 0.05, 0.52), 0, 0.34, 0), white, () => 0.85)
    ];
    for (let k = 0; k < 3; k++) parts.push(paint(place(new BoxGeometry(0.5 - k * 0.0, 0.17, 0.5), 0, 0.45 + k * 0.175, 0), white, (y, i) => (k % 2 ? 0.92 : 0.98) * jitter(i, 3)));
    const roof = new ConeGeometry(0.44, 0.2, 4);
    roof.rotateY(Math.PI / 4);
    parts.push(paint(place(roof, 0, 1.08, 0), new Color("#8d8a86"), () => 0.9));
    // The entrance slot.
    parts.push(paint(place(new BoxGeometry(0.22, 0.03, 0.02), 0, 0.39, 0.255), new Color("#1b140e")));
    return merge(parts);
}

/** Comb in a hollow: three hanging plates of hexagon-shaded wax, golden (fits inside `hollow(r)`). */
export function comb(r: number): BufferGeometry {
    const parts: BufferGeometry[] = [];
    // Wild comb: parallel sheets of wax hanging from the hollow's roof, seen edge-on from its mouth (old comb darker
    // at the top, fresh pale wax at the hanging edges), cells a shade on each face.
    for (let k = 0; k < 4; k++) {
        const plate = new SphereGeometry(r * 0.5, 14, 12);
        plate.scale(0.12, 1.05, 0.62);
        const tone = new Color(k % 2 ? "#b9802a" : "#c99436");
        parts.push(paint(place(plate, (k - 1.5) * r * 0.24, -r * 0.08, r * 0.05), tone, (y, i, x, z) => {
            const age = 0.78 + 0.3 * Math.min(Math.max(-y / r, 0), 1);
            return age * (0.86 + 0.14 * Math.abs(Math.sin(z * 90) * Math.sin(y * 78 + (Math.floor(z * 30) % 2) * 1.57)));
        }));
    }
    return merge(parts);
}

/** A paper wasps' nest hanging under an eave: a banded, papery ball, its door underneath (`r` across). */
export function waspNest(r: number, seed = 7): BufferGeometry {
    const random = seeded(4700 + seed);
    const ball = new SphereGeometry(r * 0.5, 16, 12);
    ball.scale(1, 1.25, 1);
    lumpy(ball, 0.05, random);
    const paper = new Color("#b9ab92");
    const parts = [paint(place(ball, 0, -r * 0.62, 0), paper, (y) => 0.7 + 0.32 * Math.abs(Math.sin(y * 48)))];
    const stalk = new CylinderGeometry(r * 0.05, r * 0.08, r * 0.15, 6);
    parts.push(paint(place(stalk, 0, -r * 0.05, 0), paper, () => 0.6));
    const door = new SphereGeometry(r * 0.1, 8, 6);
    door.scale(1, 0.4, 1);
    parts.push(paint(place(door, 0, -r * 1.25, 0), new Color("#171009")));
    return merge(parts);
}

/** A chrysalis (`gold` speckled) or a silk cocoon, hanging from its thread (`size` long, hangs down from y = 0). */
export function chrysalis(size: number, cocoon: boolean): BufferGeometry {
    const body = new SphereGeometry(size / 2, 10, 8);
    body.scale(cocoon ? 0.55 : 0.42, 1, cocoon ? 0.55 : 0.42);
    const parts = [paint(place(body, 0, -size * 0.55 - 0.01, 0), new Color(cocoon ? "#e6dfcf" : "#7f9a45"), (y, i) => 0.8 + (cocoon ? 0.15 : 0.2) * Math.sin(y * 90) + (!cocoon && i % 11 === 0 ? 0.6 : 0))];
    parts.push(paint(place(new BoxGeometry(0.004, 0.06, 0.004), 0, -0.03, 0), new Color("#efefe6")));
    return merge(parts);
}

// MARK: - Burrows, dens and others

/** A warren's entrance: a dark mouth under a fan of dug, paler earth (`r` across), facing +z. */
export function warrenMouth(r: number, seed = 8): BufferGeometry {
    const random = seeded(4800 + seed);
    const fan = new SphereGeometry(r * 1.1, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    fan.scale(1.1, 0.16, 1.5);
    lumpy(fan, 0.15, random);
    const mouth = new SphereGeometry(r * 0.42, 10, 8, 0, Math.PI * 2, 0, Math.PI);
    mouth.scale(1, 0.75, 0.6);
    mouth.rotateX(-0.25);
    return merge([
        paint(place(fan, 0, 0, r * 0.45), SOIL, (_, i) => 0.95 * jitter(i)),
        paint(place(mouth, 0, r * 0.05, -r * 0.05), new Color("#120c08"))
    ]);
}

/** A worm cast: a little coiled heap of soil. */
export function wormCast(size: number, seed = 9): BufferGeometry {
    const random = seeded(4900 + seed);
    const parts: BufferGeometry[] = [];
    for (let k = 0; k < 3; k++) {
        const coil = new TorusGeometry(size * (0.35 - k * 0.09), size * 0.12, 5, 10);
        coil.rotateX(Math.PI / 2);
        parts.push(paint(place(coil, (random() - 0.5) * size * 0.1, size * (0.08 + k * 0.13), (random() - 0.5) * size * 0.1), new Color("#5d4634"), (_, i) => jitter(i)));
    }
    const hole = new CylinderGeometry(size * 0.1, size * 0.1, 0.01, 8);
    parts.push(paint(place(hole, size * 0.5, 0.005, 0), new Color("#120c08")));
    return merge(parts);
}

/** A den in the rocks: two boulders leaning over a dark mouth and a trodden apron (`r` across), facing +z. */
export function den(r: number, seed = 10): BufferGeometry {
    const random = seeded(5000 + seed);
    const rockColour = new Color("#8a8275");
    const parts: BufferGeometry[] = [];
    for (const [x, s] of [[-0.7, 1], [0.75, 0.85], [0.05, 0.7]] as const) {
        const boulder = new DodecahedronGeometry(r * 0.6 * s, 1);
        lumpy(boulder, 0.2, random);
        boulder.scale(1, 0.75, 1);
        parts.push(paint(place(boulder, x * r, r * 0.35 * s + (x === 0.05 ? r * 0.45 : 0), -r * 0.2), rockColour, (y, i) => 0.7 + 0.25 * (y / r) + ((i * 5) % 7) / 40));
    }
    const mouth = new SphereGeometry(r * 0.38, 10, 8, 0, Math.PI * 2, 0, Math.PI);
    mouth.scale(1, 0.85, 0.5);
    parts.push(paint(place(mouth, 0, r * 0.18, r * 0.12), new Color("#0f0b08")));
    const apron = new CylinderGeometry(r * 0.9, r, 0.03, 14, 1);
    apron.scale(1, 1, 0.7);
    parts.push(paint(place(apron, 0, 0.012, r * 0.55), new Color("#836a4e"), (_, i) => jitter(i)));
    return merge(parts);
}

/** A big cat's lair: a flat-topped rock shelf on boulders (a kopje's ledge) over a flattened bed (`r` across). */
export function lair(r: number, seed = 11): BufferGeometry {
    const random = seeded(5100 + seed);
    const rockColour = new Color("#9a8a72");
    const parts: BufferGeometry[] = [];
    for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + random();
        const boulder = new DodecahedronGeometry(r * (0.35 + random() * 0.25), 1);
        lumpy(boulder, 0.25, random);
        parts.push(paint(place(boulder, Math.cos(a) * r * 0.8, r * 0.25, Math.sin(a) * r * 0.6 - r * 0.3), rockColour, (y, i) => 0.72 + 0.25 * (y / r) + ((i * 3) % 7) / 40));
    }
    const slab = new BoxGeometry(r * 1.8, r * 0.28, r * 1.1);
    lumpy(slab, 0.12, random);
    parts.push(paint(place(slab, 0, r * 0.72, -r * 0.35, 0.2), rockColour, (y) => 0.8 + 0.25 * (y / r)));
    const bed = new CylinderGeometry(r * 0.75, r * 0.8, 0.03, 14);
    bed.scale(1.2, 1, 0.8);
    parts.push(paint(place(bed, 0, 0.012, r * 0.35), new Color("#b8a06a"), (_, i) => jitter(i)));
    return merge(parts);
}

/**
 * A sea turtle's nest as it is left: a body pit about `r` across, its rim of
 * thrown sand, the covered egg chamber a low hump in the middle (the eggs are
 * half a metre down, never seen), and a fan of sand flung out behind (+z,
 * toward the sea). Standing on y = 0, the sand's own grain from the material.
 */
export function turtlePit(r: number, seed = 12, turn = 0, ground: (x: number, z: number) => number = () => 0): BufferGeometry {
    const random = seeded(5300 + seed);
    const rings = 12;
    const segments = 28;
    const reach = 1.6;
    const bumps = Array.from({length: 7}, () => ({a: random() * Math.PI * 2, d: 0.3 + random() * 1.1, s: 0.15 + random() * 0.2, h: (random() - 0.4) * 0.05}));
    const height = (rho: number, theta: number) => {
        let h = 0.07 * Math.exp(-(((rho - 0.95) / 0.2) ** 2)) - 0.06 * Math.exp(-(((rho - 0.5) / 0.22) ** 2)) + 0.035 * Math.exp(-((rho / 0.22) ** 2));
        h += 0.06 * Math.exp(-(((rho - 1.25) / 0.22) ** 2)) * Math.max(0, Math.cos(theta)) ** 2;
        for (const bump of bumps) {
            const dx = Math.cos(theta) * rho - Math.cos(bump.a) * bump.d;
            const dz = Math.sin(theta) * rho - Math.sin(bump.a) * bump.d;
            h += bump.h * Math.exp(-(dx * dx + dz * dz) / (bump.s * bump.s));
        }
        // Down to the beach at its edge.
        return h * (1 - smooth(1.2, reach, rho));
    };
    const point = (ring: number, segment: number) => {
        const rho = (ring / rings) * reach;
        const theta = (segment / segments) * Math.PI * 2;
        // Turned to face the sea (+z local), on the beach's own heights (`ground`, relative to the middle).
        const lx = Math.sin(theta) * rho * r;
        const lz = Math.cos(theta) * rho * r;
        const x = lx * Math.cos(turn) + lz * Math.sin(turn);
        const z = -lx * Math.sin(turn) + lz * Math.cos(turn);
        return new Vector3(x, ground(x, z) + 0.012 + height(rho, theta) * r * 1.4, z);
    };
    const positions: number[] = [];
    for (let ring = 0; ring < rings; ring++) {
        for (let segment = 0; segment < segments; segment++) {
            const a = point(ring, segment);
            const b = point(ring + 1, segment);
            const c = point(ring + 1, segment + 1);
            const d = point(ring, segment + 1);
            positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, a.x, a.y, a.z, c.x, c.y, c.z, d.x, d.y, d.z);
        }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
    // Dug sand is darker and damper than the dry surface round it.
    return paint(geometry, new Color("#cdb68f"), (_, i, x, z) => {
        const rho = Math.hypot(x, z) / r;
        return (rho < 1.15 ? 0.84 : 0.96) + 0.05 * Math.sin(i * 0.37);
    });
}

function smooth(a: number, b: number, x: number): number {
    const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
    return t * t * (3 - 2 * t);
}

/** A beaver lodge: a dome of peeled sticks and mud standing in the water (`r` across, base at y = 0 = the water). */
export function beaverLodge(r: number, seed = 13): BufferGeometry {
    const random = seeded(5300 + seed);
    const dome = new SphereGeometry(r, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    dome.scale(1, 0.55, 1);
    lumpy(dome, 0.12, random);
    const parts = [paint(place(dome, 0, -0.3, 0), new Color("#5c4a38"), (y, i) => 0.75 + 0.25 * (y / r) + ((i * 7) % 9) / 40)];
    for (let i = 0; i < 46; i++) {
        const a = random() * Math.PI * 2;
        const t = random() * 0.9;
        const d = r * Math.cos(t * Math.PI / 2);
        const y = r * 0.55 * Math.sin(t * Math.PI / 2) - 0.25;
        const length = r * (0.6 + random() * 0.6);
        const tilt = (random() - 0.5) * 1.4;
        parts.push(stick(Math.cos(a) * d - Math.cos(a + tilt) * length / 2, y, Math.sin(a) * d - Math.sin(a + tilt) * length / 2, Math.cos(a) * d + Math.cos(a + tilt) * length / 2, y + (random() - 0.4) * 0.3, Math.sin(a) * d + Math.sin(a + tilt) * length / 2, 0.06, random() < 0.3 ? new Color("#cdb991") : TWIG));
    }
    return merge(parts);
}

/** A beaver dam across `width` m of river: a bank of sticks and mud, the water higher on its −z side. */
export function beaverDam(width: number, seed = 14): BufferGeometry {
    const random = seeded(5400 + seed);
    const bank = new CylinderGeometry(0.55, 0.55, width, 10, 6);
    bank.rotateZ(Math.PI / 2);
    bank.scale(1, 0.5, 1.3);
    lumpy(bank, 0.1, random);
    const parts = [paint(place(bank, 0, -0.05, 0), new Color("#5a4837"), (y, i) => 0.78 + 0.3 * y + ((i * 3) % 7) / 40)];
    for (let i = 0; i < Math.round(width * 9); i++) {
        const x = (random() - 0.5) * width;
        const a = (random() - 0.5) * 1.2;
        const length = 0.5 + random() * 0.7;
        const y = 0.05 + random() * 0.2;
        parts.push(stick(x - Math.sin(a) * length / 2, y, -Math.cos(a) * length / 2, x + Math.sin(a) * length / 2, y + (random() - 0.5) * 0.15, Math.cos(a) * length / 2, 0.05, random() < 0.3 ? new Color("#cdb991") : TWIG));
    }
    return merge(parts);
}

// MARK: - House and garden

/** A bird box: a little house of planks with its round door and a perch (about 0.32 m tall), its back to −z. */
export function birdBox(): BufferGeometry {
    const wood = new Color("#9a7a55");
    const roof = new BoxGeometry(0.26, 0.025, 0.24);
    roof.rotateX(0.3);
    return merge([
        paint(place(new BoxGeometry(0.2, 0.28, 0.18), 0, 0, 0.09), wood, (_, i) => jitter(i)),
        paint(place(roof, 0, 0.16, 0.1), new Color("#6f5a42")),
        paint(place(new CylinderGeometry(0.035, 0.035, 0.02, 12).rotateX(Math.PI / 2), 0, 0.04, 0.185), new Color("#140e09")),
        paint(place(new CylinderGeometry(0.008, 0.008, 0.07, 5).rotateX(Math.PI / 2), 0, -0.03, 0.215), new Color("#5b4532"))
    ]);
}

/** A tussock of grass (three kinds: a fine bunch, a tall one with seed heads, a broad red-oat clump), `h` high. */
export function tussock(kind: number, h: number, seed = 15): BufferGeometry {
    const random = seeded(5500 + seed * 17 + kind);
    const parts: BufferGeometry[] = [];
    const colours = [new Color("#8e9a4c"), new Color("#c5ad6a"), new Color("#a36d43")];
    const blades = kind === 1 ? 9 : 13;
    for (let i = 0; i < blades; i++) {
        const a = random() * Math.PI * 2;
        const lean = 0.15 + random() * (kind === 2 ? 0.7 : 0.45);
        const height = h * (0.6 + random() * 0.5);
        const blade = new ConeGeometry(h * (kind === 2 ? 0.04 : 0.025), height, 3, 2);
        blade.translate(0, height / 2, 0);
        blade.rotateZ(lean);
        blade.rotateY(a);
        parts.push(paint(blade, colours[kind], (y) => 0.6 + 0.55 * (y / h)));
    }
    if (kind === 1) {
        for (let i = 0; i < 4; i++) {
            const a = random() * Math.PI * 2;
            const stem = h * (1.3 + random() * 0.4);
            const x = Math.cos(a) * h * 0.12;
            const z = Math.sin(a) * h * 0.12;
            parts.push(stick(0, 0, 0, x * 2, stem, z * 2, h * 0.02, new Color("#b49c62")));
            const head = new SphereGeometry(h * 0.05, 5, 4);
            head.scale(0.6, 2.6, 0.6);
            parts.push(paint(place(head, x * 2, stem + h * 0.08, z * 2), new Color("#e0cc95"), () => 0.95));
        }
    }
    return merge(parts);
}

/** A wildflower: a stem and a head (the instance tint is the petals' colour). */
export function wildflower(h: number, variant: number): BufferGeometry {
    const stem = new CylinderGeometry(h * 0.015, h * 0.02, h, 4);
    stem.translate(0, h / 2, 0);
    const head = variant === 0 ? new CylinderGeometry(h * 0.12, h * 0.04, h * 0.05, 7) : variant === 1 ? new SphereGeometry(h * 0.08, 6, 4) : new ConeGeometry(h * 0.08, h * 0.22, 6);
    if (variant === 2) head.rotateX(Math.PI);
    const leaf = new SphereGeometry(h * 0.1, 5, 3);
    leaf.scale(1.4, 0.25, 0.5);
    return merge([
        paint(stem, new Color("#5d7a35")),
        paint(place(leaf, h * 0.08, h * 0.3, 0), new Color("#5f7f38")),
        paint(place(head, 0, h * (variant === 2 ? 1.06 : 1.0), 0), new Color("#ffffff"), (y, i) => (variant === 0 && i < 8 ? 0.6 : 1))
    ]);
}

/** A scree stone: an angular little rock (`size` across). */
export function screeStone(size: number, seed = 16): BufferGeometry {
    const stone = new DodecahedronGeometry(size / 2, 0);
    lumpy(stone, 0.35, seeded(5600 + seed));
    stone.scale(1, 0.55, 0.85);
    return paint(place(stone, 0, size * 0.18, 0), new Color("#8a8479"), (y, i) => 0.75 + 0.5 * (y / size) + ((i * 7) % 5) / 30);
}

/**
 * A rock outcrop in strata: beds of rock stacked like a worn pile of slabs,
 * each a little set back or proud of the one below, the whole tilted with
 * the bedding, its back and foot buried in the slope (`w` wide, `h` high),
 * its face toward +z; bands of colour by bed, crisp edges, the rock's own
 * texture from the material.
 */
export function strataOutcrop(w: number, h: number, seed = 17): BufferGeometry {
    const random = seeded(5700 + seed);
    const tones = ["#6f665b", "#857a6b", "#5f574e", "#948875", "#77695a"];
    const parts: BufferGeometry[] = [];
    const beds = 5;
    let y = 0;
    for (let k = 0; k < beds; k++) {
        const thick = (h / beds) * (0.75 + random() * 0.5);
        const width = w * (1 - 0.09 * k) * (0.85 + random() * 0.25);
        const depth = w * 0.75 * (1 - 0.05 * k);
        const slab = new BoxGeometry(width, thick, depth, 3, 1, 2);
        lumpy(slab, 0.07, random);
        // Set back or proud of the bed below; its front edge rounded off by the weather.
        const step = (random() - 0.35) * w * 0.12;
        const sideways = (random() - 0.5) * w * 0.1;
        place(slab, sideways, y + thick / 2, step - depth * 0.15);
        const tone = new Color(tones[(k + Math.floor(random() * 2)) % tones.length]);
        parts.push(paint(slab, tone, (_, i) => 0.86 + ((i * 7) % 9) / 50));
        y += thick * 0.96;
    }
    const tilt = (random() - 0.5) * 0.35;
    const geometry = merge(parts);
    geometry.rotateZ(tilt);
    geometry.translate(0, -h * 0.18, 0);
    geometry.computeVertexNormals();
    return geometry;
}

/** A snow drift: a long smooth mound, its steep side to −z (the wind's), `l` long. */
export function snowDrift(l: number, seed = 18): BufferGeometry {
    const drift = new SphereGeometry(l / 2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    drift.scale(1, 0.22, 0.45);
    const position = drift.getAttribute("position");
    for (let i = 0; i < position.count; i++) {
        const z = position.getZ(i);
        if (z < 0) position.setY(i, position.getY(i) * 1.35);
        else position.setZ(i, z * 1.6);
    }
    lumpy(drift, 0.04, seeded(5800 + seed));
    return paint(drift, new Color("#eef3f8"), (y) => 0.92 + 0.08 * (y / l));
}

/** An icicle (`l` long), hanging from y = 0. */
export function icicle(l: number): BufferGeometry {
    const cone = new ConeGeometry(l * 0.12, l, 5, 2);
    cone.rotateX(Math.PI);
    cone.translate(0, -l / 2, 0);
    return paint(cone, new Color("#d7ecf6"), (y) => 0.85 + 0.15 * (1 + y / l));
}

/** A stalactite (`l` long), hanging from y = 0; a stalagmite is it turned up. */
export function stalactite(l: number, up = false, seed = 19): BufferGeometry {
    const points: Vector2[] = [];
    for (let k = 0; k <= 6; k++) {
        const t = k / 6;
        points.push(new Vector2(Math.max(l * 0.16 * (1 - t) ** 1.6 * (1 + 0.12 * Math.sin(t * 13 + seed)), 0.004), up ? t * l : -t * l));
    }
    const lathe = new LatheGeometry(points, 7);
    return paint(lathe, new Color("#b8a58b"), (y, i) => 0.7 + 0.3 * (1 - Math.abs(y) / l) + ((i * 5) % 7) / 50);
}

/** A trough: a long wooden (or stone) box on legs, its water drawn separately (`l` long). */
export function trough(l: number): BufferGeometry {
    const wood = new Color("#7d6448");
    const w = 0.55;
    const h = 0.45;
    const parts: BufferGeometry[] = [
        paint(place(new BoxGeometry(l, 0.05, w), 0, 0.2, 0), wood, (_, i) => jitter(i)),
        paint(place(new BoxGeometry(l, h - 0.15, 0.05), 0, 0.2 + (h - 0.15) / 2, w / 2), wood, (_, i) => jitter(i, 3)),
        paint(place(new BoxGeometry(l, h - 0.15, 0.05), 0, 0.2 + (h - 0.15) / 2, -w / 2), wood, (_, i) => jitter(i, 5)),
        paint(place(new BoxGeometry(0.05, h - 0.15, w), l / 2, 0.2 + (h - 0.15) / 2, 0), wood),
        paint(place(new BoxGeometry(0.05, h - 0.15, w), -l / 2, 0.2 + (h - 0.15) / 2, 0), wood)
    ];
    for (const x of [-l / 2 + 0.15, l / 2 - 0.15]) parts.push(paint(place(new BoxGeometry(0.08, 0.2, w + 0.1), x, 0.1, 0), new Color("#5f4b37")));
    return merge(parts);
}

/** A cabbage (or a lettuce): a ball of leaves. */
export function cabbage(size: number, seed = 20): BufferGeometry {
    const random = seeded(6000 + seed);
    const parts: BufferGeometry[] = [];
    const heart = new IcosahedronGeometry(size * 0.3, 1);
    parts.push(paint(place(heart, 0, size * 0.28, 0), new Color("#9fc06a"), () => 1));
    for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 + random() * 0.4;
        const leaf = new SphereGeometry(size * 0.3, 6, 4);
        leaf.scale(1, 0.35, 0.8);
        leaf.rotateZ(0.6);
        leaf.rotateY(-a);
        parts.push(paint(place(leaf, Math.cos(a) * size * 0.28, size * 0.16, Math.sin(a) * size * 0.28), new Color("#6f9a48"), (y) => 0.75 + 0.6 * (y / size)));
    }
    return merge(parts);
}

/** A strip of web-free puddle: an irregular flat disc (`r` across), drawn with the water's glassy material. */
export function puddle(r: number, seed = 21): BufferGeometry {
    const random = seeded(6100 + seed);
    const segments = 18;
    const positions: number[] = [];
    const radius = (k: number) => r * (0.7 + 0.3 * Math.sin(k * 0.9 + random() * 0.2) + 0.15 * random());
    const radii = Array.from({length: segments}, (_, k) => radius(k));
    for (let k = 0; k < segments; k++) {
        const a0 = (k / segments) * Math.PI * 2;
        const a1 = ((k + 1) / segments) * Math.PI * 2;
        const r0 = radii[k];
        const r1 = radii[(k + 1) % segments];
        positions.push(0, 0, 0, Math.cos(a1) * r1, 0, Math.sin(a1) * r1 * 0.7, Math.cos(a0) * r0, 0, Math.sin(a0) * r0 * 0.7);
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
    geometry.computeVertexNormals();
    return geometry;
}

/** A low mound of something heaped (compost, hay, guano, mud): `r` across, `h` high. */
export function heap(r: number, h: number, colour: string, seed = 22, roughness = 0.18): BufferGeometry {
    const dome = new SphereGeometry(r, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2);
    dome.scale(1, h / r, 1);
    lumpy(dome, roughness, seeded(6200 + seed));
    return paint(dome, new Color(colour), (y, i) => 0.72 + 0.35 * (y / h) + ((i * 7) % 9) / 50);
}
