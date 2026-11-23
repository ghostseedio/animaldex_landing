/**
 * The zoo's houses (lane TB, the owner's "aquariums: animals inside can't be seen"): the aquarium, the reptile, insect
 * and nocturnal houses and the primate house, each with walls, a glass front onto the visitors' porch and a roof that
 * are cut away as the camera comes close (`displays.ts` cutawayMaterial), on a floor 0.25 m over the ground.
 *
 * - **The aquarium**: its tanks (`tanks.ts` aquariumTanks) on dark stands, each with sand, rocks, plants or corals, a
 *   back light and a strip light, clear glass and its water tinted by its kind (green-blue fresh, blue salt). Its
 *   residents swim inside (`tankPose`), seen through the glass from outside and up close.
 * - **The other houses**: the residents' hall (sand and rocks for the reptiles, leaf litter and plants for the insects,
 *   a dark floor under blue night lights for the nocturnal house, bark chips and a climbing frame for the primates),
 *   its dressing kept to the corners and walls so nobody stands in it.
 *
 * Everything is in the town's local frame, a few merged meshes for all the houses (rebuilt when the zoo's houses
 * open): the cut shell, the interior, the lit panels, the glass, the water. Pure in the open enclosures.
 */

import {Group, Mesh, type BufferAttribute, type BufferGeometry, type InstancedMesh, type Material} from "three";
import {hashText, rng, type Box, type Pt} from "@/ark-scene/islands/town/geom";
import {zooSpotsOf, type ZooEnclosure} from "@/ark-scene/islands/town/areas";
import {aquariumTanks, zooHouseFloors, zooHouseFrame, ZOO_HOUSE_PORCH, ZOO_HOUSE_TYPES, ZOO_HOUSE_WALL, type Tank} from "@/ark-scene/islands/town/tanks";
import {at, Geo, tone, type Frame} from "@/ark-scene/islands/town/render/kit";
import {cactus, climbingFrame, climbingTree, fern, flowers, ledge, log, outcrop, patch, Plot, pool, rope, tuft} from "@/ark-scene/islands/town/render/zoo-habitat";
import {cutAttribute, cutawayMaterial, cutEye, followEye, glassMaterial, glowMaterial, interiorMaterial, waterMaterial} from "@/ark-scene/islands/town/render/displays";
import {aquariumHall, inAquariumHall} from "@/ark-scene/islands/town/aquarium-hall";
import {RockInstances} from "@/ark-scene/islands/town/render/rock-instances";
import {buildAquariumHall, hallRocks, hallWaterMaterial, underwaterMaterial, type HallRock} from "@/ark-scene/islands/town/render/aquarium-hall";

type RGB = [number, number, number];

/** Each house's walls and roof colours (the town lane's palette for its zoo houses). */
const LOOK: Record<string, [string, string]> = {aquarium: ["#e9eef0", "#2f7f8f"], reptile_house: ["#e6d8b8", "#a8543a"], insect_house: ["#e8e4cc", "#6f8f3a"], nocturnal_house: ["#d8d2c4", "#2f3a5a"], primate_house: ["#e6dcc4", "#4f7a3a"]};
/** The hall's floor by house. */
const FLOOR: Record<string, string> = {aquarium: "#3c4a52", reptile_house: "#c9b083", insect_house: "#6f5a3a", nocturnal_house: "#2e2a26", primate_house: "#5d7a38"};
const SALT = tone("#2f7fbf");
const FRESH = tone("#3f9a86");
const SAND = tone("#d9c79a");
const GRAVEL = tone("#8a8276");
const STAND = tone("#262b30");

export type ZooHouses = {group: Group; floors: Float32Array; tanks: Tank[]; /** p2 (zoo): each hall's dressing plan (its footprints), for the checks. */ habitats: Plot[]; dispose: () => void};

/** Upright frame at a point (the house's own turn), its floor at `y`. */
function frameAt(b: Box, y: number): Frame {
    return {x: b.x, y, z: b.z, rot: b.rot};
}

function shell(geo: Geo, e: ZooEnclosure, ranges: Array<{from: number; to: number; x: number; y: number; z: number; h: number}>) {
    const f = zooHouseFrame(e);
    const [wallHex, roofHex] = LOOK[e.type] ?? ["#e6dcc4", "#5a6a5a"];
    const wall = tone(wallHex);
    const roof = tone(roofHex);
    const band = roof.map((v) => v * 0.8) as RGB;
    const fr = frameAt(f.box, f.floor);
    const w = f.box.w;
    const d = f.box.d;
    const h = f.height;
    const from = geo.pos.length / 3;
    const t = ZOO_HOUSE_WALL;
    const front = d / 2 - ZOO_HOUSE_PORCH;
    const inside = front + d / 2;
    // The back and the two sides (the front is glass), a coloured band at their foot.
    geo.box(fr, 0, 0, -d / 2 + t / 2, w, h, t, wall);
    for (const side of [-1, 1]) geo.box(fr, side * (w / 2 - t / 2), 0, -d / 2 + inside / 2, t, h, inside, wall);
    // 3.3 fix: the band stands 3 cm proud of the wall outside and stops 3 cm short of its inside face. It was t + 6 cm
    // thick about a centre 3 cm out, so its inner face lay exactly on the wall's: the two colours fought in the depth
    // buffer and the cut-down walls flashed (the owner, 2026-11-16, the nocturnal house: "the roof and walls are flashing").
    geo.box(fr, 0, 0, -d / 2 + t / 2 - 0.03, w + 0.06, 0.9, t, band);
    for (const side of [-1, 1]) geo.box(fr, side * (w / 2 - t / 2 + 0.03), 0, -d / 2 + inside / 2, t, 0.9, inside + 0.06, band);
    // The front: a low base under the glass, mullions, a lintel, the canopy over the porch and the sign.
    // 3.3 fix: the base stands 1 cm proud of the side walls' ends and 1 cm inside their outer faces (it shared both planes).
    geo.box(fr, 0, 0, front - t / 2 + 0.01, w - 0.02, 0.3, t + 0.02, band);
    for (let u = -w / 2 + t; u <= w / 2 - t + 1e-6; u += (w - 2 * t) / Math.max(1, Math.round((w - 2 * t) / 2.4))) geo.box(fr, u, 0.3, front - t / 2, 0.12, h - 0.79, 0.14, tone("#2a2e30"));
    geo.box(fr, 0, h - 0.5, front - t / 2, w, 0.5, t, wall);
    // 3.3 fix: the mullions run 1 cm up into the lintel and the canopy's underside sits 1 cm over the lintel's, and the canopy
    // 3 cm past the side walls, so no two colours share a plane at the porch (the shell is drawn double-sided).
    geo.box(fr, 0, h - 0.49, front + ZOO_HOUSE_PORCH / 2, w + 0.06, 0.15, ZOO_HOUSE_PORCH + 0.4, roof);
    geo.box(fr, 0, h - 0.35, front + 0.02, Math.min(6, w * 0.5), 0.7, 0.08, tone("#e2c86a"));
    // The roof: a hip over the halls, flat with a glazed barrel over the primates' and the insects' (`glass` below).
    if (e.type === "primate_house" || e.type === "insect_house") geo.box(fr, 0, h, -ZOO_HOUSE_PORCH / 2, w + 0.6, 0.4, inside + 0.6, roof);
    else geo.hip(fr, 0, h, -ZOO_HOUSE_PORCH / 2, w, inside, Math.min(w, inside) * 0.22, 0.45, roof);
    ranges.push({from, to: geo.pos.length / 3, x: f.box.x, y: f.floor, z: f.box.z, h: h + 2});
}

function plinthAndFloor(geo: Geo, e: ZooEnclosure) {
    const f = zooHouseFrame(e);
    const fr = frameAt(f.box, f.floor);
    // The plinth from the floor down into the ground, so a slope never shows a gap; the hall's floor and the porch's.
    geo.box(fr, 0, -1.6, 0, f.box.w + 0.1, 1.6, f.box.d + 0.1, tone("#8e877a"), 0, {top: tone(FLOOR[e.type] ?? "#6a6a64")});
    geo.box(fr, 0, 0, f.box.d / 2 - ZOO_HOUSE_PORCH / 2, f.box.w, 0.02, ZOO_HOUSE_PORCH, tone("#b9b2a4"));
    // Climbing plants on the front corners, outside.
    const q = rng(e.slot.seed + 3);
    for (const side of [-1, 1]) {
        const p = at(fr, side * (f.box.w / 2 - 0.5), 0, f.box.d / 2 - ZOO_HOUSE_PORCH + 0.25);
        geo.bush(p[0], f.floor + 1.0 + q() * 1.2, p[2], 0.6, 1.4, 0.35, tone("#4f7a3a"), hashText(`${e.slot.id}c${side}`));
    }
}

/** One tank: its stand, sand, rocks and plants, its back light and strip light, its glass and its water. */
function tank(t: Tank, parts: {inside: Geo; glow: Geo; glass: Geo; water: Geo}, floor: number) {
    const fr: Frame = {x: t.x, y: floor, z: t.z, rot: t.rot};
    const sand = t.floor;
    const top = t.top;
    const w = t.w;
    const d = t.d;
    // The stand (a dark cabinet up to the tank's bottom) and the sand on it.
    const bottom = sand - 0.14;
    if (bottom - floor > 0.02) parts.inside.box(fr, 0, 0, 0, w + 0.24, bottom - floor, d + 0.24, STAND);
    parts.inside.box(fr, 0, bottom - floor, 0, w, 0.14, d, t.form === "fresh" || t.form === "river" || t.form === "home" ? GRAVEL : SAND);
    // The rim over the glass.
    for (const side of [-1, 1]) {
        parts.inside.box(fr, 0, top - floor + 0.06, side * (d / 2 + 0.03), w + 0.12, 0.06, 0.06, STAND);
        parts.inside.box(fr, side * (w / 2 + 0.03), top - floor + 0.06, 0, 0.06, 0.06, d + 0.12, STAND);
    }
    // The back light (the far side from the visitors) and a strip light along the top.
    const glow: RGB = t.kind === "salt" ? tone("#5fb4e8") : tone("#8fd4a8");
    const back = t.form === "fresh" ? {x: -w / 2, z: 0, along: d, across: true} : t.form === "reef" ? {x: w / 2, z: 0, along: d, across: true} : {x: 0, z: -d / 2, along: w, across: false};
    if (t.form !== "jelly") {
        if (back.across) parts.glow.box(fr, back.x - Math.sign(back.x) * 0.02, sand - floor, 0, 0.03, top - sand, back.along * 0.98, glow);
        else parts.glow.box(fr, 0, sand - floor, back.z + 0.02, back.along * 0.98, top - sand, 0.03, glow);
    } else {
        // A jelly column glows from below.
        parts.glow.box(fr, 0, sand - floor - 0.02, 0, w * 0.9, 0.02, d * 0.9, tone("#b48ce8"));
    }
    parts.glow.box(fr, 0, top - floor + 0.12, 0, w * 0.8, 0.03, 0.08, tone("#f4f8ff"));
    // Rocks and plants by the back, low, so the swimmers' loops (a body length off the glass) pass over them.
    const r = rng(hashText(t.id));
    const water = top - sand;
    const rocks = t.form === "jelly" ? 0 : Math.max(2, Math.round((w * d) / 2.5));
    for (let k = 0; k < rocks; k++) {
        const along = (r() - 0.5) * 0.9;
        const lx = back.across ? Math.sign(back.x) * (w / 2 - 0.08 - r() * Math.min(0.35, w * 0.15)) : along * w;
        const lz = back.across ? along * d : -d / 2 + 0.08 + r() * Math.min(0.35, d * 0.15);
        const p = at(fr, lx, 0, lz);
        const size = Math.min(0.12 + r() * 0.25, water * 0.18, Math.min(w, d) * 0.12);
        parts.inside.blob(p[0], sand + size * 0.4, p[2], size * 1.3, size, size * 1.1, tone(t.kind === "salt" ? (r() < 0.5 ? "#c8826a" : "#e0b8a0") : "#6e6a5e"), hashText(`${t.id}r${k}`), 0);
        if (r() < 0.7) {
            // A plant (fresh) or a coral (salt) beside it.
            const tall = Math.min(water * (t.form === "ocean" ? 0.45 : 0.35), 1.4);
            const colour: RGB = t.kind === "salt" ? tone(["#e8604a", "#f0a040", "#c058a8", "#e8d060"][k % 4]) : tone(["#3f8a3a", "#5aa040", "#2f6a30"][k % 3]);
            const q = at(fr, lx + (r() - 0.5) * 0.2, 0, lz + (r() - 0.5) * 0.2);
            if (t.kind === "salt") parts.inside.blob(q[0], sand + tall * 0.25, q[2], tall * 0.35, tall * 0.3, tall * 0.35, colour, hashText(`${t.id}c${k}`), 0);
            else parts.inside.box({x: q[0], y: sand, z: q[2], rot: r() * 3}, 0, 0, 0, 0.04, tall, 0.12, colour);
        }
    }
    // The glass: four sides up to a little over the water; the water: its surface and its sides inside the glass.
    const gh = top - sand + 0.215;
    // (From just over the stand's top, so the glass never fights it.)
    const g0 = sand - floor - 0.135;
    const glass = tone("#dcebe6");
    const P = (lx: number, ly: number, lz: number) => at(fr, lx, ly, lz);
    const hw = w / 2;
    const hd = d / 2;
    parts.glass.quad(P(-hw, g0, hd), P(hw, g0, hd), P(hw, g0 + gh, hd), P(-hw, g0 + gh, hd), glass);
    parts.glass.quad(P(hw, g0, -hd), P(-hw, g0, -hd), P(-hw, g0 + gh, -hd), P(hw, g0 + gh, -hd), glass);
    parts.glass.quad(P(hw, g0, hd), P(hw, g0, -hd), P(hw, g0 + gh, -hd), P(hw, g0 + gh, hd), glass);
    parts.glass.quad(P(-hw, g0, -hd), P(-hw, g0, hd), P(-hw, g0 + gh, hd), P(-hw, g0 + gh, -hd), glass);
    const tint = t.kind === "salt" ? SALT : FRESH;
    const ww = hw - 0.03;
    const wd = hd - 0.03;
    const y0 = sand - floor;
    const y1 = top - floor;
    parts.water.quad(P(-ww, y1, wd), P(ww, y1, wd), P(ww, y1, -wd), P(-ww, y1, -wd), tint);
    parts.water.quad(P(-ww, y0, wd), P(ww, y0, wd), P(ww, y1, wd), P(-ww, y1, wd), tint);
    parts.water.quad(P(ww, y0, -wd), P(-ww, y0, -wd), P(-ww, y1, -wd), P(ww, y1, -wd), tint);
    parts.water.quad(P(ww, y0, wd), P(ww, y0, -wd), P(ww, y1, -wd), P(ww, y1, wd), tint);
    parts.water.quad(P(-ww, y0, -wd), P(-ww, y0, wd), P(-ww, y1, wd), P(-ww, y1, -wd), tint);
}

const climbMemo = new Map<string, Plot["climbs"]>();

/** ARK-JUNGLE: a primate house's climbing frames' beams (`Plot.climbs`), from its hall's own dressing, once. */
export function hallClimbs(e: ZooEnclosure): Plot["climbs"] {
    const key = `${e.id}:${e.slot.seed}`;
    let climbs = climbMemo.get(key);
    if (!climbs) {
        climbs = e.type === "primate_house" ? hall(e, {inside: new Geo(), glow: new Geo(), glass: new Geo(), water: new Geo()})?.climbs ?? [] : [];
        climbMemo.set(key, climbs);
    }
    return climbs;
}

/** The hall of a house that is not the aquarium: its dressing in the corners and along the walls, the lights. */
export function hall(e: ZooEnclosure, parts: {inside: Geo; glow: Geo; glass: Geo; water?: Geo}): Plot | null {
    const f = zooHouseFrame(e);
    const b = f.inner;
    const fr = frameAt(b, f.floor);
    const r = rng(e.slot.seed + 11);
    // p2 (zoo): each hall dressed as its kind's habitat, clear of the residents' spots (`themedHall`, `primateHall`).
    let plot: Plot | null = null;
    if (e.type === "primate_house") {
        // p2 (zoo): the great apes' forest hall (`primateHall`); the glazed barrel over it (`shell`'s flat roof carries it).
        plot = primateHall(e, parts);
        barrel(e, parts.glass);
    } else plot = themedHall(e, parts);
    if (e.type === "insect_house") barrel(e, parts.glass);
    // Lights: warm heat lamps (reptiles), blue night light (nocturnal), daylight panels (insects, primates): high on the back wall.
    const light: RGB = e.type === "reptile_house" ? tone("#ffb070") : e.type === "nocturnal_house" ? tone("#5a6ab8") : tone("#e8f0d8");
    for (const lx of [-b.w * 0.3, b.w * 0.3]) parts.glow.box(fr, lx, Math.min(2.4, f.height - 1), -b.d / 2 + 0.02, 1.2, 0.18, 0.04, light);
    return plot;
}

/**
 * The small halls' habitats (p2, lane ZOO; the owner, "check the other enclosures too": each was an empty floor with a
 * blob in each corner): the reptile house a desert of sand, gravel and rockwork with basking ledges under the heat
 * lamps, driftwood, cacti and a pool; the nocturnal house a night forest floor of leaf litter, logs, rocks, ferns and a
 * dead tree; the insect house a garden of leaf litter, ferns, flowering plants and logs. Small residents: a smaller
 * clearance from their spots.
 */
function themedHall(e: ZooEnclosure, parts: {inside: Geo; glow: Geo; glass: Geo; water?: Geo}): Plot {
    const f = zooHouseFrame(e);
    const b = f.inner;
    const plot = new Plot(b, () => f.floor, zooSpotsOf(e), e.slot.seed, 0.45);
    plot.indoor = true; // p4 (townfix): its logs and trees in the hall's mesh
    const g = parts.inside;
    const r = rng(e.slot.seed + 41);
    const W = b.w / 2;
    const D = b.d / 2;
    const desert = e.type === "reptile_house";
    const night = e.type === "nocturnal_house";
    const ROCK: RGB = tone(desert ? "#b08a62" : night ? "#5a5248" : "#7c6c5a");
    const ground = desert ? ["#d2b07a", "#b89a70", "#a08a6a"] : night ? ["#3a3026", "#4a3a2a", "#2e3a26"] : ["#5a4430", "#4f6a2e", "#6a5236"];
    for (let k = 0; k < 10; k++) patch(g, plot, (r() - 0.5) * b.w * 0.9, (r() - 0.5) * b.d * 0.9, 0.8 + r() * 1.3, tone(ground[k % 3]), hashText(`${e.id}g${k}`), 0.008 + (k % 3) * 0.003);
    // Rockwork set into the back wall and the back corners.
    for (let lx = -W + 0.5; lx <= W - 0.5; lx += 1.5) {
        const size = 0.9 + r() * 0.7;
        if (plot.take(lx, -D + 0.15, size * 0.6, "rockwork", -size)) outcrop(g, plot, lx, -D + 0.15, size, ROCK, hashText(`${e.id}bk${lx.toFixed(1)}`));
    }
    for (const sx of [-1, 1]) {
        for (let lz = -D + 1.6; lz <= 0; lz += 1.7) {
            const size = 0.6 + r() * 0.5;
            if (plot.take(sx * (W - 0.15), lz, size * 0.6, "rockwork", -size)) outcrop(g, plot, sx * (W - 0.15), lz, size, ROCK, hashText(`${e.id}sd${sx}${lz.toFixed(1)}`));
        }
    }
    // Basking ledges (under the lamps on the back wall), logs and driftwood.
    for (const lx of [-b.w * 0.3, b.w * 0.3]) {
        const q = plot.near(lx, -D + 1.3, 0.45, "ledge", 1.2, 14, -0.2);
        if (q) ledge(g, plot, q.x, q.z, 0.45, ROCK, hashText(`${e.id}l${lx.toFixed(1)}`));
    }
    for (let k = 0; k < 4; k++) {
        const q = plot.near((r() - 0.5) * b.w * 0.8, (r() - 0.5) * b.d * 0.7, 0.7, "log", 2);
        if (!q) continue;
        const a = r() * 3.14;
        log(g, plot, q.x - Math.cos(a) * 0.7, q.z - Math.sin(a) * 0.7, q.x + Math.cos(a) * 0.7, q.z + Math.sin(a) * 0.7, 0.13 + r() * 0.06, tone(desert ? "#a08868" : "#5e4632"));
    }
    if (night || !desert) {
        const t = plot.near(W * 0.4, -D * 0.4, 0.5, "tree", 2.5, 20);
        if (t) climbingTree(g, plot, t.x, t.z, Math.min(f.height - 1.2, 3.6), hashText(`${e.id}t`));
    }
    if (desert && parts.water) {
        const q = plot.near(-W * 0.35, D * 0.3, 0.9, "pool", 2.5, 24);
        if (q) pool(g, parts.water, plot, q.x, q.z, 0.75, hashText(`${e.id}pool`), ROCK, tone("#4a8a80"));
    }
    // Planting round the walls (not along the glass), tufts between.
    const beds: Array<[number, number]> = [];
    for (let t = -W + 0.5; t <= W - 0.5; t += 1.3) beds.push([t, -D + 1.1]);
    for (let t = -D + 0.5; t <= D - 1.6; t += 1.4) beds.push([-W + 0.45, t], [W - 0.45, t]);
    beds.push([-W + 0.5, D - 0.5], [W - 0.5, D - 0.5]);
    const leaf = night ? [tone("#2f5a34"), tone("#3a6a3a")] : [tone("#3f7a34"), tone("#5a9a40")];
    const bloom = [tone("#e8a03a"), tone("#c84a6a"), tone("#e8d85a"), tone("#8a5ac8")];
    beds.forEach(([lx, lz], k) => {
        const q = plot.near(lx, lz, 0.35, "plant", 0.8, 10, -0.3);
        if (!q) return;
        if (desert) {
            if (k % 3 === 0) cactus(g, plot, q.x, q.z, 0.9 + r() * 0.9, hashText(`${e.id}c${k}`));
            else fern(g, plot, q.x, q.z, 0.45 + r() * 0.3, tone("#7a9a6a"), hashText(`${e.id}s${k}`), 11);
        } else if (!night && k % 2 === 0) flowers(g, plot, q.x, q.z, 0.7 + r() * 0.4, bloom[k % 4], hashText(`${e.id}fl${k}`));
        else fern(g, plot, q.x, q.z, 0.8 + r() * 0.7, leaf[k % 2], hashText(`${e.id}f${k}`), 9);
    });
    for (let k = 0; k < 40; k++) tuft(g, plot, (r() - 0.5) * b.w * 0.95, (r() - 0.5) * b.d * 0.95, 0.18 + r() * 0.2, tone(desert ? "#a8a060" : night ? "#3f5a34" : "#6f9a44"), hashText(`${e.id}u${k}`), 5);
    return plot;
}

/**
 * The great apes' hall (p2, lane ZOO; the owner: "the gorilla enclosure looks unbelievably basic"): a forest floor of
 * bark with grass and leaf litter, a backdrop of rounded rockwork along the back and up the sides with ledges, a
 * climbing frame of stripped logs with decks, swagged and hanging ropes and a fire-hose hammock, a dead climbing tree,
 * a stream-fed pool with a stone rim, and broad-leaved planting in the corners and along the walls. Every ground item
 * keeps clear of the residents' spots (`zoo-habitat.ts` Plot), where each ape is held.
 */
function primateHall(e: ZooEnclosure, parts: {inside: Geo; glow: Geo; glass: Geo; water?: Geo}): Plot {
    const f = zooHouseFrame(e);
    const b = f.inner;
    const plot = new Plot(b, () => f.floor, zooSpotsOf(e), e.slot.seed);
    plot.indoor = true; // p4 (townfix): its logs and trees in the hall's mesh
    const g = parts.inside;
    const r = rng(e.slot.seed + 29);
    const W = b.w / 2;
    const D = b.d / 2;
    const ROCK: RGB = tone("#7c6c5a");
    // The ground: a grass floor with bark-chip and leaf-litter clearings and a sandy beach by the pool (flat, under
    // everything; the residents walk on them).
    for (let k = 0; k < 14; k++) patch(g, plot, (r() - 0.5) * b.w * 0.9, (r() - 0.5) * b.d * 0.9, 1.3 + r() * 1.8, tone(["#7a5a3a", "#6a4e30", "#4f6a2e", "#6f8a42"][k % 4]), hashText(`${e.id}g${k}`), 0.008 + (k % 4) * 0.003);
    // Rockwork along the back wall and the back halves of the sides, set into the walls.
    for (let lx = -W + 0.6; lx <= W - 0.6; lx += 1.9) {
        const size = 1.6 + r() * 1.0;
        if (plot.take(lx, -D + 0.2, size * 0.7, "rockwork", -size)) outcrop(g, plot, lx, -D + 0.2, size, ROCK, hashText(`${e.id}bk${lx.toFixed(1)}`));
    }
    for (const sx of [-1, 1]) {
        for (let lz = -D + 2.2; lz <= -D + b.d * 0.5; lz += 2.1) {
            const size = 0.9 + r() * 0.8;
            if (plot.take(sx * (W - 0.2), lz, size * 0.7, "rockwork", -size)) outcrop(g, plot, sx * (W - 0.2), lz, size, ROCK, hashText(`${e.id}sd${sx}${lz.toFixed(1)}`));
        }
    }
    // Basking and sitting ledges out in the hall.
    for (let k = 0; k < 4; k++) {
        const q = plot.near((r() - 0.5) * b.w * 0.7, (r() - 0.3) * b.d * 0.6, 0.9, "ledge", 3);
        if (q) ledge(g, plot, q.x, q.z, 0.75 + r() * 0.3, ROCK, hashText(`${e.id}l${k}`));
    }
    // The climbing frame: a line of stripped logs across the back third, another up one side.
    const back: Pt[] = [];
    for (let lx = -W + 1.6; lx <= W - 1.6; lx += 2.9) back.push({x: lx + (r() - 0.5) * 0.6, z: -D + 3.2 + (r() - 0.5) * 0.8});
    climbingFrame(g, plot, back, Math.min(f.height - 1.0, 5.8), hashText(`${e.id}cf`));
    const side: Pt[] = [];
    for (let lz = -D + 6.5; lz <= D - 5; lz += 3.0) side.push({x: -W + 1.4 + (r() - 0.5) * 0.4, z: lz});
    climbingFrame(g, plot, side, Math.min(f.height - 1.5, 5.2), hashText(`${e.id}cs`));
    // A fire-hose hammock slung high across the hall from the back frame to the side frame.
    const h0 = plot.p(back[0].x, back[0].z, 4.1);
    const h1 = plot.p(side[0].x, side[0].z, 4.1);
    rope(g, h0, h1, 0.8, 0.22, tone("#b8462e"));
    // A dead climbing tree in the open middle.
    const tree = plot.near(W * 0.35, -D * 0.05, 0.8, "tree", 3.5, 24);
    if (tree) climbingTree(g, plot, tree.x, tree.z, Math.min(f.height - 0.8, 5.6), hashText(`${e.id}t`));
    // A pool with a stone rim toward the front, where the visitors see it.
    if (parts.water) {
        const q = plot.near(W * 0.4, D * 0.35, 1.7, "pool", 3, 30);
        if (q) {
            patch(g, plot, q.x, q.z, 2.3, tone("#c9b088"), hashText(`${e.id}beach`), 0.02);
            pool(g, parts.water, plot, q.x, q.z, 1.45, hashText(`${e.id}pool`), ROCK, tone("#3f8a86"));
        }
    }
    // Logs to sit on and turn over.
    for (let k = 0; k < 3; k++) {
        const q = plot.near((r() - 0.5) * b.w * 0.7, (r() - 0.5) * b.d * 0.6, 1.1, "log", 3);
        if (!q) continue;
        const a = r() * 3.14;
        log(g, plot, q.x - Math.cos(a), q.z - Math.sin(a), q.x + Math.cos(a), q.z + Math.sin(a), 0.2 + r() * 0.08);
    }
    // Planting: broad leaves and bushes in the corners and along the walls, grass tufts wherever a foot does not land.
    const green = [tone("#3f7a34"), tone("#4f8a3a"), tone("#2f6a30"), tone("#5a9a40")];
    // (Beds every couple of metres round the walls, and by the rocks and the pool: whichever are clear of the apes.)
    const beds: Array<[number, number]> = [];
    // (Not along the glass: the visitors look in there. Its two corners only.)
    for (let t = -W + 0.6; t <= W - 0.6; t += 1.7) beds.push([t, -D + 1.6]);
    beds.push([-W + 0.6, D - 0.6], [W - 0.6, D - 0.6]);
    for (let t = -D + 0.6; t <= D - 2.4; t += 1.8) beds.push([-W + 0.6, t], [W - 0.6, t]);
    beds.forEach(([lx, lz], k) => {
        const q = plot.near(lx, lz, 0.55, "plant", 1.0, 10, -0.4);
        if (!q) return;
        const c = green[k % 4];
        if (k % 5 === 0) g.bush(...plot.p(q.x, q.z, 0.45), 0.6 + r() * 0.3, 0.6 + r() * 0.3, 0.6 + r() * 0.3, c, hashText(`${e.id}b${k}`));
        else fern(g, plot, q.x, q.z, 1.2 + r() * 0.9, c, hashText(`${e.id}f${k}`), 9 + (k % 3), k % 4 === 1 ? 0.6 + r() * 1.2 : 0);
    });
    for (let k = 0; k < 90; k++) tuft(g, plot, (r() - 0.5) * b.w * 0.95, (r() - 0.5) * b.d * 0.95, 0.3 + r() * 0.35, tone(k % 2 ? "#6f9a44" : "#86a84e"), hashText(`${e.id}u${k}`));
    return plot;
}

function barrel(e: ZooEnclosure, glass: Geo) {
    const f = zooHouseFrame(e);
    const fr = frameAt(f.box, f.floor);
    const w = f.box.w;
    const inside = f.box.d - ZOO_HOUSE_PORCH;
    const n = 6;
    const rr = inside / 2;
    const c = tone("#9ab8b0");
    for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI;
        const a1 = ((i + 1) / n) * Math.PI;
        const y0 = f.height + 0.4 + Math.sin(a0) * rr * 0.5;
        const y1 = f.height + 0.4 + Math.sin(a1) * rr * 0.5;
        const z0 = -ZOO_HOUSE_PORCH / 2 + Math.cos(a0) * rr;
        const z1 = -ZOO_HOUSE_PORCH / 2 + Math.cos(a1) * rr;
        glass.quad(at(fr, -w / 2, y0, z0), at(fr, w / 2, y0, z0), at(fr, w / 2, y1, z1), at(fr, -w / 2, y1, z1), c);
    }
}

/** `BufferAttribute.onUpload`: the page's copy let go once the GPU has it (`batches.ts`' own). */
function releaseArray(this: {array: ArrayLike<number>}) {
    // (Set aside for the seat audit's probe, development only: `scripts/ark-seat-audit.mjs` reads every drawn triangle
    // near an animal, and with the copies gone a bird on a town tree's limb measured 8 m over the ground below it. Set
    // aside, not kept on the attribute: the scene's own seat pass reads the attribute, and must see what it sees live.)
    if (process.env.NODE_ENV !== "production" && (globalThis as {__arkKeepArrays?: boolean}).__arkKeepArrays) ((globalThis as {__arkKeptArrays?: WeakMap<object, ArrayLike<number>>}).__arkKeptArrays ??= new WeakMap()).set(this, this.array);
    this.array = new Float32Array(0);
}

/** Every open zoo house's shell, interior, tanks, lights, glass and water, and its floors for the drawn ground. */
export function buildZooHouses(enclosures: readonly ZooEnclosure[]): ZooHouses {
    const group = new Group();
    group.name = "town:zoo-houses";
    const shellGeo = new Geo();
    const ranges: Array<{from: number; to: number; x: number; y: number; z: number; h: number}> = [];
    const parts = {inside: new Geo(), glow: new Geo(), glass: new Geo(), water: new Geo()};
    // p3 (zoofix): the halls' boulders (their rockwork, ledges, pools' rims) drawn as instances (`rock-instances.ts`).
    parts.inside.rocks = [];
    const tanks: Tank[] = [];
    const habitats: Plot[] = [];
    const houses = enclosures.filter((e) => !e.shared && ZOO_HOUSE_TYPES.has(e.type));
    // p2 (aqua): the two aquarium plots are one hall with its own tanks (`render/aquarium-hall.ts`).
    const aquaHall = houses.some((e) => inAquariumHall(e)) ? aquariumHall() : null;
    const under = new Geo();
    const hallWater = new Geo();
    const rocks: HallRock[] = [];
    if (aquaHall) {
        buildAquariumHall(aquaHall, shellGeo, ranges, {...parts, under, water: hallWater}, rocks);
        for (const t of aquaHall.tanks) tanks.push(t.tank);
    }
    for (const e of houses) {
        if (aquaHall && inAquariumHall(e)) continue;
        shell(shellGeo, e, ranges);
        plinthAndFloor(parts.inside, e);
        // The glass front from the base to the lintel.
        const f = zooHouseFrame(e);
        const fr = frameAt(f.box, f.floor);
        const front = f.box.d / 2 - ZOO_HOUSE_PORCH - ZOO_HOUSE_WALL / 2;
        const hw = f.box.w / 2 - ZOO_HOUSE_WALL;
        parts.glass.quad(at(fr, -hw, 0.3, front), at(fr, hw, 0.3, front), at(fr, hw, f.height - 0.5, front), at(fr, -hw, f.height - 0.5, front), tone(e.type === "nocturnal_house" ? "#6a7090" : "#dcebe6"));
        if (e.type === "aquarium") {
            for (const t of aquariumTanks(e)) {
                tank(t, parts, f.floor);
                tanks.push(t);
            }
        } else {
            const plot = hall(e, parts);
            if (plot) habitats.push(plot);
        }
    }
    const materials: Material[] = [];
    const meshes: Mesh[] = [];
    const add = (geometry: BufferGeometry, material: Material, name: string, shadows: boolean, order = 0) => {
        const mesh = new Mesh(geometry, material);
        mesh.name = name;
        mesh.castShadow = shadows;
        mesh.receiveShadow = true;
        mesh.renderOrder = order;
        group.add(mesh);
        meshes.push(mesh);
        materials.push(material);
        return mesh;
    };
    if (shellGeo.triangles) {
        const geometry = shellGeo.toGeometry();
        cutAttribute(geometry, ranges);
        const eye = cutEye();
        const {material, depth} = cutawayMaterial(eye);
        const mesh = add(geometry, material, "zoo-houses:shell", true);
        mesh.customDepthMaterial = depth;
        materials.push(depth);
        followEye(mesh, eye);
    }
    let boulders: RockInstances | null = null;
    if (parts.inside.triangles) {
        // (Its page copy let go once on the GPU: nothing reads it back; the floors are `zooHouseFloors`'.)
        const geometry = parts.inside.toGeometry();
        for (const name of Object.keys(geometry.attributes)) (geometry.attributes[name] as BufferAttribute).onUpload(releaseArray);
        const mesh = add(geometry, interiorMaterial(), "zoo-houses:inside", true);
        if (parts.inside.rocks?.length) {
            boulders = new RockInstances(parts.inside.rocks, mesh.material as Material, "zoo-houses:rocks", {castShadow: true});
            for (const m of boulders.meshes) group.add(m);
        }
    }
    if (aquaHall && under.triangles) {
        const material = underwaterMaterial(aquaHall.frame.floor + 8.1);
        add(under.toGeometry(), material, "zoo-houses:under-water", true);
        // (Its boulders as instances, the same material: `hallRocks`.)
        for (const mesh of hallRocks(rocks, material)) {
            group.add(mesh);
            meshes.push(mesh);
        }
    }
    // (The hall's water takes no shadow: the vault's ribs and the tall tanks' rims fell on it as blocky shadow-map texels.)
    if (hallWater.triangles) add(hallWater.toGeometry(), hallWaterMaterial(), "zoo-houses:hall-water", false, 3).receiveShadow = false;
    if (parts.glow.triangles) add(parts.glow.toGeometry(), glowMaterial(), "zoo-houses:glow", false);
    if (parts.water.triangles) add(parts.water.toGeometry(), waterMaterial(), "zoo-houses:water", false, 3);
    if (parts.glass.triangles) add(parts.glass.toGeometry(), glassMaterial(), "zoo-houses:glass", false, 4);
    return {
        group,
        floors: zooHouseFloors(houses),
        tanks,
        habitats,
        dispose: () => {
            boulders?.dispose();
            for (const mesh of meshes) {
                mesh.geometry.dispose();
                // (p2 (aqua): the hall's instanced boulders free their instance buffers too.)
                if ((mesh as InstancedMesh).isInstancedMesh) (mesh as InstancedMesh).dispose();
            }
            for (const material of materials) material.dispose();
        }
    };
}
