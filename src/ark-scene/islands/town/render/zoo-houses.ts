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

import {Group, Mesh, type BufferGeometry, type Material} from "three";
import {hashText, rng, type Box} from "@/ark-scene/islands/town/geom";
import type {ZooEnclosure} from "@/ark-scene/islands/town/areas";
import {aquariumTanks, zooHouseFloors, zooHouseFrame, ZOO_HOUSE_PORCH, ZOO_HOUSE_TYPES, ZOO_HOUSE_WALL, type Tank} from "@/ark-scene/islands/town/tanks";
import {at, Geo, tone, type Frame} from "@/ark-scene/islands/town/render/kit";
import {cutAttribute, cutawayMaterial, cutEye, followEye, glassMaterial, glowMaterial, interiorMaterial, waterMaterial} from "@/ark-scene/islands/town/render/displays";

type RGB = [number, number, number];

/** Each house's walls and roof colours (the town lane's palette for its zoo houses). */
const LOOK: Record<string, [string, string]> = {aquarium: ["#e9eef0", "#2f7f8f"], reptile_house: ["#e6d8b8", "#a8543a"], insect_house: ["#e8e4cc", "#6f8f3a"], nocturnal_house: ["#d8d2c4", "#2f3a5a"], primate_house: ["#e6dcc4", "#4f7a3a"]};
/** The hall's floor by house. */
const FLOOR: Record<string, string> = {aquarium: "#3c4a52", reptile_house: "#c9b083", insect_house: "#6f5a3a", nocturnal_house: "#2e2a26", primate_house: "#7a5a3a"};
const SALT = tone("#2f7fbf");
const FRESH = tone("#3f9a86");
const SAND = tone("#d9c79a");
const GRAVEL = tone("#8a8276");
const STAND = tone("#262b30");

export type ZooHouses = {group: Group; floors: Float32Array; tanks: Tank[]; dispose: () => void};

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
    geo.box(fr, 0, 0, -d / 2 + t / 2 - 0.03, w + 0.06, 0.9, t + 0.06, band);
    for (const side of [-1, 1]) geo.box(fr, side * (w / 2 - t / 2 + 0.03), 0, -d / 2 + inside / 2, t + 0.06, 0.9, inside + 0.06, band);
    // The front: a low base under the glass, mullions, a lintel, the canopy over the porch and the sign.
    geo.box(fr, 0, 0, front - t / 2, w, 0.3, t, band);
    for (let u = -w / 2 + t; u <= w / 2 - t + 1e-6; u += (w - 2 * t) / Math.max(1, Math.round((w - 2 * t) / 2.4))) geo.box(fr, u, 0.3, front - t / 2, 0.12, h - 0.8, 0.14, tone("#2a2e30"));
    geo.box(fr, 0, h - 0.5, front - t / 2, w, 0.5, t, wall);
    geo.box(fr, 0, h - 0.5, front + ZOO_HOUSE_PORCH / 2, w, 0.15, ZOO_HOUSE_PORCH + 0.4, roof);
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
        geo.blob(p[0], f.floor + 1.0 + q() * 1.2, p[2], 0.6, 1.4, 0.35, tone("#4f7a3a"), hashText(`${e.slot.id}c${side}`), 0);
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

/** The hall of a house that is not the aquarium: its dressing in the corners and along the walls, the lights. */
function hall(e: ZooEnclosure, parts: {inside: Geo; glow: Geo; glass: Geo}) {
    const f = zooHouseFrame(e);
    const b = f.inner;
    const fr = frameAt(b, f.floor);
    const r = rng(e.slot.seed + 11);
    const corners: Array<[number, number]> = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
    for (const [sx, sz] of corners) {
        const lx = sx * (b.w / 2 - 0.45);
        const lz = sz * (b.d / 2 - 0.45);
        const p = at(fr, lx, 0, lz);
        if (e.type === "reptile_house") parts.inside.blob(p[0], f.floor + 0.25, p[2], 0.6, 0.45, 0.55, tone(r() < 0.5 ? "#a8906a" : "#8a7a62"), hashText(`${e.id}r${lx}${lz}`), 0);
        else if (e.type === "insect_house" || e.type === "primate_house") parts.inside.blob(p[0], f.floor + 0.6, p[2], 0.55, 0.9, 0.55, tone("#4f7a3a"), hashText(`${e.id}p${lx}${lz}`), 0);
        else parts.inside.blob(p[0], f.floor + 0.2, p[2], 0.5, 0.35, 0.5, tone("#3a3a34"), hashText(`${e.id}n${lx}${lz}`), 0);
    }
    // Logs along the back wall.
    parts.inside.box(fr, 0, 0, -b.d / 2 + 0.25, Math.min(3, b.w * 0.4), 0.28, 0.3, tone("#5e4630"));
    if (e.type === "primate_house") {
        // A climbing frame against the back wall: poles, a beam, ropes, a platform (above the residents' heads).
        for (const lx of [-b.w * 0.3, 0, b.w * 0.3]) parts.inside.cylinder(fr, lx, 0, -b.d / 2 + 0.35, 0.12, 0.1, f.height - 1.2, tone("#7a5a3e"), 6);
        parts.inside.box(fr, 0, f.height - 1.4, -b.d / 2 + 0.35, b.w * 0.62, 0.14, 0.14, tone("#7a5a3e"));
        parts.inside.box(fr, 0, f.height - 2.4, -b.d / 2 + 0.6, b.w * 0.5, 0.08, 0.5, tone("#8a6a48"));
        // The glazed barrel over the hall (`shell`'s flat roof carries it).
        barrel(e, parts.glass);
    }
    if (e.type === "insect_house") barrel(e, parts.glass);
    // Lights: warm heat lamps (reptiles), blue night light (nocturnal), daylight panels (insects, primates): high on the back wall.
    const light: RGB = e.type === "reptile_house" ? tone("#ffb070") : e.type === "nocturnal_house" ? tone("#5a6ab8") : tone("#e8f0d8");
    for (const lx of [-b.w * 0.3, b.w * 0.3]) parts.glow.box(fr, lx, Math.min(2.4, f.height - 1), -b.d / 2 + 0.02, 1.2, 0.18, 0.04, light);
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

/** Every open zoo house's shell, interior, tanks, lights, glass and water, and its floors for the drawn ground. */
export function buildZooHouses(enclosures: readonly ZooEnclosure[]): ZooHouses {
    const group = new Group();
    group.name = "town:zoo-houses";
    const shellGeo = new Geo();
    const ranges: Array<{from: number; to: number; x: number; y: number; z: number; h: number}> = [];
    const parts = {inside: new Geo(), glow: new Geo(), glass: new Geo(), water: new Geo()};
    const tanks: Tank[] = [];
    const houses = enclosures.filter((e) => !e.shared && ZOO_HOUSE_TYPES.has(e.type));
    for (const e of houses) {
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
        } else hall(e, parts);
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
    if (parts.inside.triangles) add(parts.inside.toGeometry(), interiorMaterial(), "zoo-houses:inside", true);
    if (parts.glow.triangles) add(parts.glow.toGeometry(), glowMaterial(), "zoo-houses:glow", false);
    if (parts.water.triangles) add(parts.water.toGeometry(), waterMaterial(), "zoo-houses:water", false, 3);
    if (parts.glass.triangles) add(parts.glass.toGeometry(), glassMaterial(), "zoo-houses:glass", false, 4);
    return {
        group,
        floors: zooHouseFloors(houses),
        tanks,
        dispose: () => {
            for (const mesh of meshes) mesh.geometry.dispose();
            for (const material of materials) material.dispose();
        }
    };
}
