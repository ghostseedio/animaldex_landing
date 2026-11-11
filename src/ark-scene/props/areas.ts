/**
 * The environment's details by area (the owner's brief, section 6), always
 * there whatever is aboard:
 *
 * - House and garden: weathering (rain streaks under the windows, moss on
 *   the plinth and the roof), gutters and a downpipe into a water butt, a
 *   flagstone path to a picket fence and its gate, a vegetable patch with a
 *   bean wigwam, a compost heap in its bin, a bird box on the wall, puddles
 *   after rain. (Chimney smoke, the moths at the porch light and the mist
 *   are `effects.ts`; the glowing windows are `micro-scene.ts`'s.)
 * - Farm: a hay shelter with stacked bales and loose hay, the loft door
 *   open on the barn, a paddock with post-and-rail fences, troughs with
 *   water in them, and mud round them and the gate (glossier when wet).
 * - Mountain: outcrops in strata on the steep ground, scree fanned below
 *   them, snow drifts in the lee (more with the snow), icicles in the cold
 *   area; frost whitens their tops at a cold dawn (`kit.ts` materials).
 * - Grassland: tussocks of three grasses at mixed heights, wildflower
 *   drifts, and old termite mounds (shared scenery: more when termites are
 *   aboard, `homes.ts`). Dust is `effects.ts`.
 *
 * Built once (the world is fixed); near and far forms by distance, counts
 * capped by tier (`kit.ts`).
 */

import {BoxGeometry, BufferGeometry, Color, ConeGeometry, CylinderGeometry, Group, IcosahedronGeometry, MeshStandardMaterial, SphereGeometry, Vector3} from "three";
import {worldDecor} from "@/ark-scene/decor";
import {COTTAGE, GARDEN_POND} from "@/ark-scene/micro-decor";
import {roofHeight, ROOF_THICKNESS} from "@/ark-scene/micro";
import {LodBatch, LodPiece, lumpy, merge, paint, place, propMaterial, runSteps, type PropInstance, type PropsTier} from "@/ark-scene/props/kit";
import {hamletLandAt} from "@/ark-scene/props/hamlet-land";
import {caveSite, groundAt, propRandom, propsPoints} from "@/ark-scene/props/sampler";
import {surfaceAt} from "@/ark-scene/sampler";
import * as shapes from "@/ark-scene/props/shapes";
import {barnBase, buildHamletBuildings, type HamletBuildings} from "@/ark-scene/props/hamlet-buildings";
import {barnStyle, chimneyTop, cottageStyle, coopSpot, defaultHomePlots, GARDEN, PADDOCK_POST_TOP, paddockRect, paddockSegments, PICKET_POST_TOP, picketPosts, picketRuns, plotFrame, type HomePlot} from "@/ark-scene/props/home-layout";
import {riverDistance, sampleGround, ZONE_SITES, zoneAt} from "@/ark-scene/world";

export type Areas = {
    group: Group;
    batches: LodBatch[];
    pieces: LodPiece[];
    /** Weather-driven parts: the puddles' opacity, the snow drifts, the icicles. */
    setWeather: (w: {puddles: number; snowCover: number; cold: number}) => boolean;
    /** The chimney's top in the world (for its smoke). */
    chimney: Vector3;
    /** The troughs' and the paddock's middle (for shots). */
    farm: Vector3;
    /** The hamlet's buildings past today's cottage and barn (`hamlet-buildings.ts`): their windows light up at night. */
    buildings: HamletBuildings;
    /** Where things are (for the golden shots): the highest outcrop with scree below it. */
    marks: Record<string, {x: number; y: number; z: number}>;
    dispose: () => void;
};

const C = COTTAGE;
const halfW = C.width / 2;
const halfD = C.depth / 2;


function wood(geometry: BufferGeometry, colour = "#8a6b4a", shade = 1): BufferGeometry {
    return paint(geometry, colour, (_, i) => shade * (0.86 + ((i * 7) % 11) / 55));
}

/** A box between two points on the ground, `h` high and `t` thick (a rail, a plank, a ridge of soil). */
function boxAlong(ax: number, az: number, bx: number, bz: number, y: number, h: number, t: number, colour: string, shade = 1): BufferGeometry {
    const length = Math.hypot(bx - ax, bz - az);
    const geometry = new BoxGeometry(length, h, t);
    geometry.rotateY(-Math.atan2(bz - az, bx - ax));
    geometry.translate((ax + bx) / 2, y, (az + bz) / 2);
    return wood(geometry, colour, shade);
}

// MARK: - House and garden

/**
 * A house plot's details, laid out in the plot's frame (the house's middle at the origin, facing +z) and seeded by
 * its id: built locally, then turned and moved onto the plot. `house(x, y, z)` is a point of the house's frame
 * (y over its floor); `G(x, z)` the ground's height under a local point.
 */
function garden(plot: HomePlot): {near: BufferGeometry; far: BufferGeometry; chimney: Vector3; cabbages: PropInstance[]; puddles: PropInstance[]} {
    const frame = plotFrame(plot);
    const random = plot.id === "house-0" ? propRandom("garden") : frame.random("garden");
    const house = (x: number, y: number, z: number) => new Vector3(x, frame.floor + y, z);
    const G = (x: number, z: number) => frame.ground(x, z);
    // What hangs on the house (gutters, downpipe, moss, the bird box) is built in the house's own frame (y over its
    // floor) and scaled with the plot's cottage (home-layout.ts cottageStyle: 0.9–1 of today's).
    const k = cottageStyle(plot).scale;
    const attached: BufferGeometry[] = [];
    const onHouse = (x: number, y: number, z: number) => new Vector3(x, y, z);
    const parts: BufferGeometry[] = [];
    const farParts: BufferGeometry[] = [];

    // Gutters along both eaves, a downpipe at the front right corner into a water butt.
    const eaveY = roofHeight(halfD + C.overhang) - 0.1;
    for (const side of [1, -1]) {
        const gutter = new CylinderGeometry(0.07, 0.07, C.width + C.overhang * 2, 8, 1, true, 0, Math.PI);
        gutter.rotateZ(Math.PI / 2);
        gutter.rotateX(Math.PI);
        const at = onHouse(0, eaveY, side * (halfD + C.overhang + 0.04));
        attached.push(paint(place(gutter, at.x, at.y, at.z), "#5b5f63", () => 0.9));
    }
    const pipeTop = onHouse(halfW - 0.1, eaveY - 0.05, halfD + 0.09);
    const pipe = new CylinderGeometry(0.04, 0.04, eaveY + 0.1, 8);
    attached.push(paint(place(pipe, pipeTop.x, (eaveY - 0.1) / 2 - 0.05, pipeTop.z), "#5b5f63"));
    const elbow = new CylinderGeometry(0.04, 0.04, C.overhang + 0.05, 8);
    elbow.rotateX(Math.PI / 2);
    attached.push(paint(place(elbow, pipeTop.x, pipeTop.y, pipeTop.z + C.overhang / 2), "#5b5f63"));
    const butt = new CylinderGeometry(0.32, 0.3, 0.85, 14);
    const buttAt = house((halfW + 0.3) * k, 0, (halfD + 0.25) * k);
    parts.push(paint(place(butt, buttAt.x, G(buttAt.x, buttAt.z) + 0.42, buttAt.z), "#3d5a3e", (y) => 0.8 + 0.3 * (y + 0.4)));

    // Weathering: rain streaks under the front windows, moss along the plinth, moss cushions on the roof.
    for (const [sx, sz, length, turn] of [[0, halfD, C.width, 0], [0, -halfD, C.width, 0], [halfW, 0, C.depth, Math.PI / 2], [-halfW, 0, C.depth, Math.PI / 2]] as const) {
        const moss = new BoxGeometry(length + 0.14, 0.12, 0.03);
        moss.rotateY(turn);
        const at = onHouse(sx + Math.sign(sx) * 0.07, 0.02, sz + Math.sign(sz) * 0.07);
        attached.push(paint(place(moss, at.x, at.y, at.z), "#5e7a3a", (_, i) => 0.7 + ((i * 7) % 9) / 30));
    }
    // Moss cushions on the roof: low clumps of small lumps in the lower, damper half, dark olive with lighter tips.
    const mossTones = ["#4f6430", "#5d7334", "#6e7f3c", "#56602f"];
    for (let k = 0; k < 9; k++) {
        const side = k % 2 ? 1 : -1;
        const fromRidge = 0.9 + random() * 1.1;
        const x = (random() - 0.5) * (C.width - 0.6);
        const slope = Math.atan(C.ridge / halfD);
        const lumps = 4 + Math.floor(random() * 5);
        for (let j = 0; j < lumps; j++) {
            const lump = new IcosahedronGeometry(0.035 + random() * 0.04, 1);
            lumpy(lump, 0.35, random);
            lump.scale(1.3, 0.45, 1.1);
            lump.rotateX(side * slope);
            const dx = (random() - 0.5) * 0.22;
            const dr = (random() - 0.5) * 0.18;
            const at = onHouse(x + dx, roofHeight(fromRidge + dr) + ROOF_THICKNESS - 0.01, side * (fromRidge + dr));
            const tone = mossTones[Math.floor(random() * mossTones.length)];
            attached.push(paint(place(lump, at.x, at.y, at.z), tone, (y) => 0.8 + 0.25 * Math.min(Math.max((y - at.y) * 12 + 0.5, 0), 1)));
        }
    }

    // The bird box on the east wall, facing out.
    const box = shapes.birdBox();
    box.rotateY(Math.PI / 2);
    const boxAt = onHouse(halfW + 0.005, 1.95, -0.9);
    attached.push(place(box, boxAt.x, boxAt.y, boxAt.z));
    parts.push(merge(attached).scale(k, k, k).translate(0, frame.floor, 0));

    // The path: flagstones from the porch to the gate.
    const pathFrom = halfD + C.porch.depth + 0.25;
    const gateZ = GARDEN.gateZ;
    for (let z = pathFrom; z < gateZ + 0.6; z += 0.62) {
        for (const off of [-0.27, 0.27]) {
            if (random() < 0.12) continue;
            const stone = new BoxGeometry(0.5 + random() * 0.08, 0.06, 0.52 + random() * 0.06, 2, 1, 2);
            lumpy(stone, 0.06, random);
            const x = -0.1 + off + (random() - 0.5) * 0.05;
            const wz = z + (random() - 0.5) * 0.05;
            parts.push(paint(place(stone, x, G(x, wz) + 0.01, wz, (random() - 0.5) * 0.15), "#a69d8c", (_, i) => 0.82 + ((i * 5) % 7) / 40));
        }
    }

    // A picket fence round the front garden (home-layout.ts picketRuns), its posts where the sampler's fence_post
    // points are (picketPosts), the gate open at the path.
    const fence = (ax: number, az: number, bx: number, bz: number) => {
        const length = Math.hypot(bx - ax, bz - az);
        const count = Math.round(length / 0.17);
        const rails: BufferGeometry[] = [];
        for (let k = 0; k <= count; k++) {
            const t = k / count;
            const x = ax + (bx - ax) * t;
            const z = az + (bz - az) * t;
            const ground = G(x, z);
            const picket = new BoxGeometry(0.075, 0.82, 0.03);
            const tip = new ConeGeometry(0.055, 0.1, 4);
            tip.rotateY(Math.PI / 4);
            const turn = -Math.atan2(bz - az, bx - ax);
            picket.rotateY(turn);
            tip.rotateY(turn);
            parts.push(paint(place(picket, x, ground + 0.37, z), "#ede6d8", (_, i) => 0.84 + ((i * 3) % 7) / 50));
            parts.push(paint(place(tip, x, ground + 0.82, z), "#ede6d8"));
        }
        for (const y of [0.18, 0.6]) {
            const ground = G((ax + bx) / 2, (az + bz) / 2);
            rails.push(boxAlong(ax, az, bx, bz, ground + y, 0.06, 0.03, "#ddd5c4"));
        }
        parts.push(...rails);
        farParts.push(boxAlong(ax, az, bx, bz, G(ax, az) + 0.4, 0.8, 0.04, "#e6dfd0"));
    };
    for (const [ax, az, bx, bz] of picketRuns()) fence(ax, az, bx, bz);
    for (const post of picketPosts()) {
        const ground = G(post.x, post.z);
        const turn = -Math.atan2(post.along.z, post.along.x);
        const stake = new BoxGeometry(0.09, PICKET_POST_TOP + 0.05, 0.09);
        stake.rotateY(turn);
        parts.push(paint(place(stake, post.x, ground + (PICKET_POST_TOP - 0.05) / 2, post.z), "#e4dccb", (_, i) => 0.86 + ((i * 5) % 7) / 50));
        const cap = new BoxGeometry(0.12, 0.03, 0.12);
        cap.rotateY(turn);
        parts.push(paint(place(cap, post.x, ground + PICKET_POST_TOP - 0.015, post.z), "#f0eadf"));
    }
    // The gate, swung open into the garden.
    const gateAt = house(0.55, 0, gateZ);
    const gate = new BoxGeometry(1.15, 0.7, 0.04);
    gate.translate(-0.58, 0, 0);
    gate.rotateY(-1.2);
    parts.push(wood(place(gate, gateAt.x, G(gateAt.x, gateAt.z) + 0.4, gateAt.z), "#e6dfd0"));

    // The vegetable patch west of the cottage: ridged beds, bean canes in a wigwam.
    const cabbages: PropInstance[] = [];
    const bedX = -7.6;
    for (let row = 0; row < 4; row++) {
        const x = bedX + row * 0.95;
        const z0 = -1.6;
        const z1 = 2.4;
        const ground = Math.min(G(x, z0), G(x, z1));
        const ridge = new BoxGeometry(0.6, 0.22, 4, 2, 1, 8);
        lumpy(ridge, 0.05, random);
        parts.push(paint(place(ridge, x, ground + 0.05, (z0 + z1) / 2), "#5c4330", (_, i) => 0.78 + ((i * 7) % 9) / 40));
        if (row < 3) {
            for (let k = 0; k < 6; k++) {
                const z = z0 + 0.35 + k * 0.62;
                cabbages.push({x: x + (random() - 0.5) * 0.06, y: G(x, z) + 0.12, z, turn: random() * 6, scale: 0.8 + random() * 0.4, tint: row === 1 ? new Color("#c7d98d") : undefined});
            }
        }
    }
    const wigwam = house(bedX + 3 * 0.95, 0, 0.4);
    const wg = G(wigwam.x, wigwam.z);
    for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        const foot = new Vector3(wigwam.x + Math.cos(a) * 0.45, wg, wigwam.z + Math.sin(a) * 0.45);
        const cane = new CylinderGeometry(0.012, 0.015, 1.9, 5);
        cane.translate(0, 0.95, 0);
        cane.rotateZ(-0.22);
        cane.rotateY(-a);
        parts.push(paint(place(cane, foot.x, foot.y, foot.z), "#b49a68"));
        for (let l = 0; l < 4; l++) {
            const leaf = new SphereGeometry(0.11, 5, 4);
            leaf.scale(1, 0.6, 0.4);
            const t = 0.2 + l * 0.2;
            parts.push(paint(place(leaf, foot.x - Math.cos(a) * 0.42 * t, wg + 1.8 * t, foot.z - Math.sin(a) * 0.42 * t, a), "#5f8a3a", () => 0.8 + l * 0.06));
        }
    }

    // The compost heap behind the cottage: a slatted bin of three sides, the heap spilling out of its front.
    const bin = house(3.4, 0, -halfD - 2.2);
    const bg = G(bin.x, bin.z);
    for (let k = 0; k < 4; k++) {
        parts.push(boxAlong(bin.x - 0.7, bin.z - 0.7, bin.x + 0.7, bin.z - 0.7, bg + 0.12 + k * 0.2, 0.13, 0.04, "#7d6448", 0.9));
        parts.push(boxAlong(bin.x - 0.7, bin.z - 0.7, bin.x - 0.7, bin.z + 0.6, bg + 0.12 + k * 0.2, 0.13, 0.04, "#7d6448", 0.95));
        parts.push(boxAlong(bin.x + 0.7, bin.z - 0.7, bin.x + 0.7, bin.z + 0.6, bg + 0.12 + k * 0.2, 0.13, 0.04, "#7d6448"));
    }
    parts.push(place(shapes.heap(0.75, 0.55, "#4b3a2a", 41, 0.22), bin.x, bg, bin.z - 0.05));
    parts.push(place(shapes.heap(0.4, 0.18, "#6d7a3a", 42, 0.3), bin.x + 0.1, bg + 0.42, bin.z));

    // The chimney's top (micro-scene.ts: a 0.5 m stack on the back slope), in the world.
    const top = chimneyTop(plot);
    const chimney = new Vector3(top.x, top.y, top.z);

    // Puddles after rain: on the path, by the gate, in the yard.
    const puddles: PropInstance[] = [];
    for (const [x, z, r] of [[-0.2, 5.4, 0.55], [0.4, 8.0, 0.45], [-2.4, 10.4, 0.8], [3.3, 9.8, 0.6], [-1.2, 12.2, 0.9]] as const) puddles.push({x, y: G(x, z) + 0.035, z, turn: random() * 6, scale: r});
    farParts.push(paint(place(new BoxGeometry(4, 0.4, 0.4), bedX + 1.4, G(bedX + 1.4, 0) + 0.05, 0.4), "#5c4330"));
    // Onto the plot: turned and moved (the instances' too).
    const near = merge(parts).rotateY(plot.rotation).translate(plot.x, 0, plot.z);
    const far = merge(farParts).rotateY(plot.rotation).translate(plot.x, 0, plot.z);
    const onPlot = (item: PropInstance): PropInstance => {
        const w = frame.toWorld(item.x, item.z);
        return {...item, x: w.x, z: w.z, turn: item.turn + plot.rotation};
    };
    return {near, far, chimney, cabbages: cabbages.map(onPlot), puddles: puddles.map(onPlot)};
}

// MARK: - Farm

/**
 * A smallholding's details, in its frame (the barn's or the yard's middle at the origin, the barn's long side along
 * local x) and seeded by its id: the hay shelter (against the barn's gable when it has one), the loft door, the
 * paddock (home-layout.ts paddockRect: on pasture, clear of trees), its posts where the sampler's fence_post points
 * are, troughs, mud and puddles, and the hens' coop.
 */
function farm(plot: HomePlot): {near: BufferGeometry; far: BufferGeometry; centre: Vector3; troughs: PropInstance[]; water: BufferGeometry; mud: PropInstance[]; puddles: PropInstance[]; coop: PropInstance} {
    const frame = plotFrame(plot);
    const random = plot.id === "smallholding-0" ? propRandom("farm") : frame.random("farm");
    const parts: BufferGeometry[] = [];
    const farParts: BufferGeometry[] = [];
    const b = {x: plot.x, z: plot.z, y: frame.floor, rotation: plot.rotation};
    const c = Math.cos(b.rotation);
    const s = Math.sin(b.rotation);
    // The barn's frame (three's rotation about y): local (x, z) to the world.
    const at = (lx: number, lz: number) => ({x: b.x + lx * c + lz * s, z: b.z - lx * s + lz * c});
    const turn = b.rotation;

    // The hay shelter against the barn's west gable: four posts, a lean-to roof, bales stacked three high, loose hay.
    const shelter = at(-5, 0);
    const sg = groundAt(shelter.x, shelter.z);
    for (const [lx, lz] of [[-1.6, -1.8], [-1.6, 1.8], [1.4, -1.8], [1.4, 1.8]] as const) {
        const p = at(-5 + lx, lz);
        parts.push(wood(place(new BoxGeometry(0.14, 2.6, 0.14), p.x, sg + 1.3, p.z), "#6b553f"));
    }
    const roof = new BoxGeometry(3.6, 0.08, 4.2);
    roof.rotateZ(-0.18);
    parts.push(paint(place(roof, shelter.x, sg + 2.62, shelter.z, turn), "#6a625c", () => 0.85));
    for (let layer = 0; layer < 3; layer++) {
        for (let k = 0; k < 3 - (layer === 2 ? 1 : 0); k++) {
            for (let j = 0; j < 2; j++) {
                const p = at(-5.6 + j * 0.95 + (layer % 2) * 0.2, -1.2 + k * 1.15);
                const bale = new BoxGeometry(0.9, 0.45, 1.1, 2, 2, 2);
                lumpy(bale, 0.03, random);
                parts.push(paint(place(bale, p.x, sg + 0.23 + layer * 0.46, p.z, turn), "#d8b866", (y, i) => 0.8 + ((i * 7) % 9) / 40 + 0.05 * Math.sin(y * 40)));
            }
        }
    }
    const loose = at(-3.4, 0.6);
    parts.push(place(shapes.heap(0.9, 0.35, "#d6b45e", 51, 0.3), loose.x, groundAt(loose.x, loose.z), loose.z));
    farParts.push(paint(place(new BoxGeometry(3.4, 1.4, 4), shelter.x, sg + 0.7, shelter.z, turn), "#c9a95e"));

    // The barn's loft door, open on its east gable, hay spilling from it.
    // (A farm shed has no loft; another plot's barn has its own size and colour: home-layout.ts barnStyle.)
    const look = barnStyle(plot);
    if (plot.barn && !look.shed) {
        const [sx, sy] = look.size;
        const loft = at(3.24 * sx, 0);
        const bg = plot.id === "smallholding-0" ? b.y : barnBase(plot, look.size);
        const dark = new BoxGeometry(0.06, 0.9, 1.1);
        parts.push(paint(place(dark, loft.x, bg + 3.75 * sy, loft.z, turn), "#1b140e"));
        const hayLip = new BoxGeometry(0.3, 0.25, 1.0, 2, 2, 2);
        lumpy(hayLip, 0.2, random);
        const lip = at(3.36 * sx, 0);
        parts.push(paint(place(hayLip, lip.x, bg + 3.35 * sy, lip.z, turn), "#d9b765", (_, i) => 0.85 + ((i * 5) % 7) / 40));
        const door = new BoxGeometry(0.05, 0.9, 0.55);
        const doorAt = at(3.3 * sx, 0.85 * sx);
        parts.push(wood(place(door, doorAt.x, bg + 3.75 * sy, doorAt.z, turn + 0.9), look.wall));
    }

    // The paddock: beside the barn, post and rail, a gate gap toward the yard (home-layout.ts: the same posts the sampler lists).
    const paddock = paddockRect(plot);
    for (const segment of paddockSegments(paddock)) {
        if (segment.gate) continue;
        const pa = at(segment.a.x, segment.a.z);
        const pb = at(segment.b.x, segment.b.z);
        const ga = groundAt(pa.x, pa.z);
        const gb = groundAt(pb.x, pb.z);
        parts.push(wood(place(new BoxGeometry(0.12, 1.15, 0.12), pa.x, ga + PADDOCK_POST_TOP - 0.575, pa.z, turn + random() * 0.1), "#7a5f43"));
        for (const y of [0.45, 0.9]) parts.push(boxAlong(pa.x, pa.z, pb.x, pb.z, (ga + gb) / 2 + y, 0.09, 0.05, "#8a6b4a"));
        farParts.push(boxAlong(pa.x, pa.z, pb.x, pb.z, (ga + gb) / 2 + 0.6, 0.6, 0.06, "#8a6b4a"));
    }

    // Troughs (one in the paddock, one by the barn door), mud round them and the gate, puddles after rain.
    const troughs: PropInstance[] = [];
    const water: BufferGeometry[] = [];
    const mud: PropInstance[] = [];
    const puddles: PropInstance[] = [];
    const troughSpots: Array<[number, number, number]> = [[paddock.x0 + (paddock.x1 - paddock.x0) * 0.75, paddock.z0 + (paddock.z1 - paddock.z0) * 0.38, 2.2], [1.2, 3.0, 1.6]];
    for (const [lx, lz, length] of troughSpots) {
        const p = at(lx, lz);
        const g = groundAt(p.x, p.z);
        troughs.push({x: p.x, y: g, z: p.z, turn, scale: length / 2, tall: 1});
        const surface = new BoxGeometry(length - 0.1, 0.02, 0.45);
        water.push(place(surface, p.x, g + 0.5, p.z, turn));
        for (let k = 0; k < 4; k++) {
            const m = at(lx + (random() - 0.5) * length * 1.4, lz + (random() < 0.5 ? -1 : 1) * (0.6 + random() * 0.6));
            mud.push({x: m.x, y: groundAt(m.x, m.z) - 0.02, z: m.z, turn: random() * 6, scale: 0.6 + random() * 0.6});
        }
        const puddleAt = at(lx + 0.6, lz + 1.1);
        puddles.push({x: puddleAt.x, y: groundAt(puddleAt.x, puddleAt.z) + 0.03, z: puddleAt.z, turn: random() * 6, scale: 0.7});
    }
    const gateAt = at(paddock.x1, (paddock.z0 + paddock.z1) / 2);
    for (let k = 0; k < 5; k++) {
        const m = {x: gateAt.x + (random() - 0.5) * 2.2, z: gateAt.z + (random() - 0.5) * 2.2};
        mud.push({x: m.x, y: groundAt(m.x, m.z) - 0.02, z: m.z, turn: random() * 6, scale: 0.7 + random() * 0.7});
    }
    puddles.push({x: gateAt.x + 0.4, y: groundAt(gateAt.x + 0.4, gateAt.z) + 0.03, z: gateAt.z, turn: 1, scale: 0.9});
    // The hens' coop, by the paddock (home-layout.ts coopSpot: clear of trees).
    const coopAt = coopSpot(plot);
    const cw = at(coopAt.x, coopAt.z);
    const coop: PropInstance = {x: cw.x, y: groundAt(cw.x, cw.z), z: cw.z, turn: turn + coopAt.turn, scale: 1};
    const middle = at((paddock.x0 + paddock.x1) / 2, (paddock.z0 + paddock.z1) / 2);
    return {near: merge(parts), far: merge(farParts), centre: new Vector3(middle.x, groundAt(middle.x, middle.z), middle.z), troughs, water: merge(water.map((geometry) => paint(geometry, "#ffffff"))), mud, puddles, coop};
}

/** The barn's middle (for the golden shots' framing). */
function barnMark(): Record<string, {x: number; y: number; z: number}> {
    const barn = worldDecor().find((item) => item.kind === "barn");
    return barn ? {barn: {x: barn.x, y: barn.y, z: barn.z}} : {};
}

// MARK: - Mountain and the ice

function* mountain(): Generator<void, {outcrops: PropInstance[]; scree: PropInstance[]; drifts: PropInstance[]; polarDrifts: PropInstance[]; icicles: PropInstance[]}, void> {
    const random = propRandom("mountain");
    const outcrops: PropInstance[] = [];
    const scree: PropInstance[] = [];
    const cave = caveSite();
    // The ground's cliff ledges (not the rock tops'): the way out of the cliff is the ledge's `forward`.
    const ledges = propsPoints("ledge").filter((point) => point.host === "ground" && (point.zone === "mountains" || point.zone === "polar")).map((point) => ({...point, normal: point.forward ?? point.normal}));
    for (let k = 0; k < ledges.length; k++) {
        const ledge = ledges[k];
        if (k % 2) continue;
        if (k % 16 === 0) yield;
        const size = 1.6 + random() * 2.2;
        // Its back into the slope: a little uphill of the ledge point, sunk in.
        const x = ledge.x - ledge.normal.x * size * 0.3;
        const z = ledge.z - ledge.normal.z * size * 0.3;
        outcrops.push({x, y: groundAt(x, z) - size * 0.3, z, turn: ledge.yaw, scale: size / 2.5, tint: new Color().setHSL(0.08, 0.06, 0.55 + random() * 0.12)});
        // A fan of scree below it, downhill.
        for (let s = 0; s < 46; s++) {
            const d = size * 0.5 + random() * random() * size * 3.5;
            const spread = (random() - 0.5) * (0.4 + d * 0.35);
            const px = ledge.x + ledge.normal.x * d + ledge.normal.z * spread;
            const pz = ledge.z + ledge.normal.z * d - ledge.normal.x * spread;
            const ground = sampleGround(px, pz);
            if (ground.height < 0.5 || ground.land < 0.9) continue;
            // Scree lies where the slope eases to its resting angle, not on the cliff itself.
            const normal = surfaceAt(px, pz).normal;
            if (normal.y < 0.72) continue;
            scree.push({x: px, y: ground.height - 0.03, z: pz, turn: random() * 6, scale: 0.3 + random() * random() * 1.8, tint: new Color().setHSL(0.08, 0.06, 0.4 + random() * 0.18)});
        }
    }
    yield;
    // Snow drifts: in the lee of rocks and outcrops high on the mountain (shown with the snow), always on the ice.
    const drifts: PropInstance[] = [];
    const polarDrifts: PropInstance[] = [];
    const lee = 0.6 + Math.PI; // The prevailing wind blows toward +x/+z; drifts build on the far side.
    for (const item of worldDecor()) {
        if (item.kind !== "rock" || item.y < 1) continue;
        const ground = sampleGround(item.x, item.z);
        const zone = zoneAt(ground);
        const high = zone === "mountains" && ground.height > 16;
        if (zone !== "polar" && !high) continue;
        const x = item.x + Math.cos(lee - Math.PI) * item.scale * 1.2;
        const z = item.z + Math.sin(lee - Math.PI) * item.scale * 1.2;
        if (zone === "polar" && Math.hypot(x - cave.x, z - cave.z) < 9) continue;
        (zone === "polar" ? polarDrifts : drifts).push({x, y: groundAt(x, z) - 0.08, z, turn: -(lee - Math.PI) + Math.PI / 2, scale: 0.4 + item.scale * 0.35});
    }
    for (const outcrop of outcrops) {
        const ground = sampleGround(outcrop.x, outcrop.z);
        if (ground.height < 16) continue;
        drifts.push({x: outcrop.x + 1.2, y: ground.height - 0.12, z: outcrop.z + 1.0, turn: 0.4, scale: outcrop.scale * 0.8});
    }
    const polar = ZONE_SITES.polar;
    for (let k = 0; k < 26; k++) {
        const a = random() * Math.PI * 2;
        const d = polar.clearing + 2 + random() * 16;
        const x = polar.x + Math.cos(a) * d;
        const z = polar.z + Math.sin(a) * d;
        const ground = sampleGround(x, z);
        if (ground.land < 0.9 || zoneAt(ground) !== "polar") continue;
        // Not across the cave's mouth.
        if (Math.hypot(x - cave.x, z - cave.z) < 9) continue;
        polarDrifts.push({x, y: ground.height - 0.08, z, turn: random() * 0.6, scale: 0.7 + random() * 1.0});
    }
    // Icicles: under the ice's rock faces.
    const icicles: PropInstance[] = [];
    for (const face of propsPoints("rock_face", undefined, "polar")) {
        if (face.normal.y > 0.5) continue;
        for (let k = 0; k < 4; k++) icicles.push({x: face.x + (random() - 0.5) * 0.4, y: face.y + 0.1, z: face.z + (random() - 0.5) * 0.4, turn: 0, scale: 0.5 + random() * 0.9});
    }
    return {outcrops, scree, drifts, polarDrifts, icicles};
}

// MARK: - Grassland

function* grassland(): Generator<void, {tussocks: PropInstance[][]; flowers: PropInstance[]; mounds: PropInstance[]}, void> {
    const random = propRandom("grassland");
    const tussocks: PropInstance[][] = [[], [], []];
    const flowers: PropInstance[] = [];
    const meadow = new Set(["grassland", "woodland", "farm_garden", "river_lake", "mountains", "desert"]);
    const site = ZONE_SITES.grassland;
    for (let k = 0; k < 9000; k++) {
        if (k % 600 === 0) yield;
        const x = site.x + (random() * 2 - 1) * 46;
        const z = site.z + (random() * 2 - 1) * 46;
        const ground = sampleGround(x, z);
        if (ground.land < 0.9 || ground.height < 0.4 || riverDistance(x, z) < 3) continue;
        const zone = zoneAt(ground);
        if (!meadow.has(zone)) continue;
        const inGrass = zone === "grassland" ? 1 : zone === "desert" ? 0.25 : 0.12;
        const roll = random();
        const pick = random();
        const size = random();
        if (Math.hypot(x - site.x, z - site.z) < site.clearing - 3) continue;
        if (roll < 0.34 * inGrass) {
            const kind = zone === "desert" ? 2 : pick < 0.45 ? 0 : pick < 0.8 ? 1 : 2;
            tussocks[kind].push({x, y: ground.height - 0.03, z, turn: random() * 6, scale: 0.6 + size * 0.9});
        } else if (roll < 0.34 * inGrass + 0.04 && zone !== "desert") {
            // A drift of one flower: a cluster of a dozen.
            const colour = [new Color("#f4d84a"), new Color("#f2f0ea"), new Color("#c96fd6"), new Color("#e8613a"), new Color("#6f8fe8")][Math.floor(random() * 5)];
            const variant = Math.floor(random() * 3);
            for (let f = 0; f < 12; f++) {
                const fx = x + (random() - 0.5) * 2.4;
                const fz = z + (random() - 0.5) * 2.4;
                flowers.push({x: fx, y: groundAt(fx, fz) - 0.02, z: fz, turn: random() * 6, scale: 0.7 + random() * 0.6, tint: colour, tall: variant});
            }
        }
    }
    // Old mounds on the savanna (shared scenery, map plan: they stay when no termites are aboard).
    const mounds: PropInstance[] = [];
    for (const [dx, dz, s] of [[-site.clearing - 6, 8, 1.2], [site.clearing + 8, -5, 0.9], [4, -site.clearing - 9, 1.05]] as const) {
        const x = site.x + dx;
        const z = site.z + dz;
        mounds.push({x, y: groundAt(x, z) - 0.05, z, turn: dx, scale: s});
    }
    // Not on the hamlet's reserved plots (props/hamlet-land.ts): no tussock under a house or a barn, no wildflowers on
    // a plot; filtered after the draws, so every other one stays where it was.
    return {tussocks: tussocks.map((list) => list.filter((item) => hamletLandAt(item.x, item.z) !== "core")), flowers: flowers.filter((item) => !hamletLandAt(item.x, item.z)), mounds};
}

/** All the areas at once (the tests): `buildAreasSteps` run to its end. */
export function buildAreas(tier: PropsTier, plots: HomePlot[] = defaultHomePlots()): Areas {
    return runSteps(buildAreasSteps(tier, plots));
}

/** The areas, a step at a time (each plot, the mountain's ledges, the meadow's samples), for the scene's slices (`kit.ts` runSliced). */
export function* buildAreasSteps(tier: PropsTier, plots: HomePlot[] = defaultHomePlots()): Generator<void, Areas, void> {
    const group = new Group();
    group.name = "props:areas";
    const warm = propMaterial();
    const cold = propMaterial({cold: true, flatShading: true, texture: 5, textureScale: 0.5});
    const snow = propMaterial({roughness: 0.75, texture: 7, textureScale: 0.35, textureStrength: 0.6});
    const foliage = propMaterial({doubleSide: true});
    const water = new MeshStandardMaterial({color: new Color("#4d5f66"), roughness: 0.04, metalness: 0.85, transparent: true, opacity: 0.85, polygonOffset: true, polygonOffsetFactor: -2});
    const puddleMaterial = new MeshStandardMaterial({color: new Color("#56646c"), roughness: 0.03, metalness: 0.9, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3});
    const mudMaterial = propMaterial({roughness: 0.55, texture: 6, textureScale: 0.8});
    const batches: LodBatch[] = [];
    const pieces: LodPiece[] = [];
    const addBatch = (batch: LodBatch) => {
        batch.setTier(tier);
        batch.add(group);
        batches.push(batch);
        return batch;
    };
    const addPiece = (piece: LodPiece) => {
        piece.setTier(tier);
        piece.add(group);
        pieces.push(piece);
        return piece;
    };

    // The home area's plots (home-layout.ts): each house plot its garden, each smallholding its yard, paddock and coop.
    const gardens: Array<{plot: HomePlot; built: ReturnType<typeof garden>}> = [];
    for (const plot of plots.filter((p) => p.kind === "house")) {
        yield;
        gardens.push({plot, built: garden(plot)});
    }
    const farms: Array<{plot: HomePlot; built: ReturnType<typeof farm>}> = [];
    for (const plot of plots.filter((p) => p.kind === "smallholding")) {
        yield;
        farms.push({plot, built: farm(plot)});
    }
    for (const {plot, built} of gardens) {
        const centre = plotFrame(plot).toWorld(0, 3);
        addPiece(new LodPiece(`garden:${plot.id}`, new Vector3(centre.x, plotFrame(plot).floor, centre.z), built.near, built.far, warm, {near: 70, far: 220, shadow: true}));
    }
    for (const {plot, built} of farms) {
        addPiece(new LodPiece(`farm:${plot.id}`, built.centre, built.near, built.far, warm, {near: 80, far: 240, shadow: true}));
        addPiece(new LodPiece(`trough-water:${plot.id}`, built.centre, built.water, null, water, {near: 70, far: 0}));
    }
    addBatch(new LodBatch("cabbages", gardens.flatMap(({built}) => built.cabbages), shapes.cabbage(0.42), null, warm, {cap: 30 * Math.max(gardens.length, 1), reach: 1}));
    addBatch(new LodBatch("troughs", farms.flatMap(({built}) => built.troughs), shapes.trough(2), null, warm, {cap: 4 * Math.max(farms.length, 1), reach: 1.3}));
    addBatch(new LodBatch("coops", farms.map(({built}) => built.coop), shapes.coop(), shapes.coopFar(), warm, {cap: 6, reach: 1.4, shadow: true}));
    addBatch(new LodBatch("mud", farms.flatMap(({built}) => built.mud), shapes.heap(0.9, 0.025, "#4f3c2b", 61, 0.05), null, mudMaterial, {cap: 20 * Math.max(farms.length, 1), reach: 1.1}));
    const puddles = addBatch(new LodBatch("puddles", [...gardens.flatMap(({built}) => built.puddles), ...farms.flatMap(({built}) => built.puddles)], shapes.puddle(1), null, puddleMaterial, {cap: 16, reach: 1.2}));
    puddles.hidden = true;
    // The other plots' cottages and barns (today's two are the graphics lane's).
    yield;
    const buildings = buildHamletBuildings(plots);
    group.add(buildings.group);
    const firstGarden = gardens[0]?.built;
    const firstFarm = farms[0]?.built;

    yield;
    const m = yield* mountain();
    addBatch(new LodBatch("strata", m.outcrops, shapes.strataOutcrop(2.5, 2.2), paint(new BoxGeometry(2.2, 1.8, 1.2).translate(0, 0.9, 0), "#8f8576"), cold, {cap: 40, reach: 2.2, farReach: 1, shadow: true}));
    addBatch(new LodBatch("scree", m.scree, shapes.screeStone(0.22), null, cold, {cap: 2600, reach: 0.9}));
    const drifts = addBatch(new LodBatch("snow-drifts", m.drifts, shapes.snowDrift(2.4), null, snow, {cap: 60, reach: 1.6}));
    addBatch(new LodBatch("polar-drifts", m.polarDrifts, shapes.snowDrift(2.4, 2), null, snow, {cap: 60, reach: 1.6}));
    const icicles = addBatch(new LodBatch("icicles", m.icicles, shapes.icicle(0.45), null, new MeshStandardMaterial({vertexColors: true, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.85}), {cap: 120, reach: 0.6, fine: true}));

    yield;
    const gr = yield* grassland();
    gr.tussocks.forEach((items, kind) => addBatch(new LodBatch(`tussock-${kind}`, items, shapes.tussock(kind, kind === 1 ? 0.55 : 0.42), null, foliage, {cap: kind === 0 ? 900 : 600, reach: 0.85})));
    for (let variant = 0; variant < 3; variant++) {
        const items = gr.flowers.filter((flower) => flower.tall === variant).map((flower) => ({...flower, tall: undefined}));
        addBatch(new LodBatch(`wildflowers-${variant}`, items, shapes.wildflower(0.3, variant), null, foliage, {cap: 500, reach: 0.6}));
    }
    addBatch(new LodBatch("termite-mounds", gr.mounds, shapes.termiteMound(2.4, 1), shapes.termiteMoundFar(2.4), warm, {cap: 4, reach: 2, shadow: true}));

    let last = "";
    return {
        group,
        batches,
        pieces,
        buildings,
        chimney: firstGarden?.chimney ?? new Vector3(0, -100, 0),
        farm: firstFarm?.centre ?? new Vector3(0, -100, 0),
        marks: {...(firstGarden ? {chimney: firstGarden.chimney} : {}), ...(firstFarm ? {farm: firstFarm.centre, coop: new Vector3(firstFarm.coop.x, firstFarm.coop.y, firstFarm.coop.z)} : {}), ...barnMark(), ...(m.outcrops.length ? {outcrop: m.outcrops.reduce((best, o) => (o.y > best.y && o.y < 30 ? o : best), m.outcrops[0])} : {})},
        setWeather: (w) => {
            puddleMaterial.opacity = Math.min(w.puddles * 1.2, 0.92);
            const key = `${w.puddles > 0.05}|${w.snowCover > 0.35}|${w.cold > 0.55}`;
            if (key === last) return false;
            last = key;
            puddles.hidden = w.puddles <= 0.05;
            drifts.hidden = w.snowCover <= 0.35;
            icicles.hidden = w.cold <= 0.55;
            return true;
        },
        dispose: () => {
            for (const batch of batches) batch.dispose();
            for (const piece of pieces) piece.dispose();
            buildings.dispose();
            for (const material of [warm, cold, snow, foliage, water, puddleMaterial, mudMaterial]) material.dispose();
            void GARDEN_POND;
        }
    };
}
