/**
 * The pets kept indoors at home, drawn (lane TB, the owner's "domestic animals not showing in people's homes"): for
 * each household that keeps one, its display site (`tanks.ts` homeSite) with the displays in use.
 *
 * - **A garden room** on the back of a house or a terrace home: a low brick base, white frames, glass walls and a glass
 *   lean-to roof, its walls and roof cut away as the camera comes close; a tiled floor and a stand along the house's
 *   wall with the household's tank (gravel, plants, water, a strip light), cage (a tray, a perch, bars) and vivarium
 *   (glass front, substrate, a stone, a heat lamp), whichever it uses.
 * - **A flat's** displays on a low cabinet against the back wall of its balcony, or its patio on the ground floor.
 * - **A raised garden pond** in a house's back garden: stone walls, a dark liner, its water at the walls' top, lily pads.
 *
 * Only the sites in use are drawn (the sites never move: the plan's alone). The town's local frame; a few merged
 * meshes for the whole town, rebuilt when the set in use changes.
 */

import {Group, Mesh, type BufferGeometry, type Material} from "three";
import {hashText, rng} from "@/ark-scene/islands/town/geom";
import {homeDisplayFloors, perchHeight, POND_SIZE, type HomeDisplay, type HomeSite} from "@/ark-scene/islands/town/tanks";
import {at, Geo, tone, type Frame} from "@/ark-scene/islands/town/render/kit";
import {barsMaterial, cutAttribute, cutawayMaterial, cutEye, followEye, glassMaterial, glowMaterial, interiorMaterial, outdoorMaterial, waterMaterial} from "@/ark-scene/islands/town/render/displays";

type RGB = [number, number, number];

export type PetHomes = {group: Group; floors: Float32Array; dispose: () => void};

type Parts = {shell: Geo; inside: Geo; outdoor: Geo; glow: Geo; glass: Geo; water: Geo; bars: Geo};

const FRAME = tone("#eeeae2");
const BRICK = tone("#9a5a44");
const TILE = tone("#c9c0b0");
const STAND = tone("#6a4a32");

function room(site: HomeSite, parts: Parts, ranges: Array<{from: number; to: number; x: number; y: number; z: number; h: number}>) {
    const b = site.box;
    const fr: Frame = {x: b.x, y: site.floor, z: b.z, rot: b.rot};
    const w = b.w;
    const d = b.d;
    const h = site.height;
    // The floor (with a step down into the garden), the base: uncut.
    parts.inside.box(fr, 0, -0.8, 0, w, 0.8, d, tone("#8e877a"), 0, {top: TILE});
    const from = parts.shell.pos.length / 3;
    // A low brick base on the three garden sides, white posts at the corners and between, a frame at the eaves.
    const base = 0.45;
    parts.shell.box(fr, 0, 0, -d / 2 + 0.06, w, base, 0.12, BRICK);
    for (const side of [-1, 1]) parts.shell.box(fr, side * (w / 2 - 0.06), 0, 0, 0.12, base, d, BRICK);
    for (const [lx, lz] of [[-w / 2, -d / 2], [w / 2, -d / 2], [0, -d / 2], [-w / 2, 0], [w / 2, 0]] as const) parts.shell.box(fr, lx === 0 ? 0 : lx - Math.sign(lx) * 0.05, 0, lz === 0 ? 0 : lz + 0.05, 0.08, h, 0.08, FRAME);
    parts.shell.box(fr, 0, h - 0.08, -d / 2 + 0.05, w, 0.1, 0.1, FRAME);
    for (const side of [-1, 1]) parts.shell.box(fr, side * (w / 2 - 0.05), h - 0.08, 0, 0.1, 0.1, d, FRAME);
    ranges.push({from, to: parts.shell.pos.length / 3, x: b.x, y: site.floor, z: b.z, h: h + 0.6});
    // The glass walls over the base and the lean-to glass roof, rising to the house's wall.
    const P = (lx: number, ly: number, lz: number) => at(fr, lx, ly, lz);
    const glass = tone("#dcebe6");
    parts.glass.quad(P(-w / 2, base, -d / 2), P(w / 2, base, -d / 2), P(w / 2, h, -d / 2), P(-w / 2, h, -d / 2), glass);
    parts.glass.quad(P(w / 2, base, -d / 2), P(w / 2, base, d / 2), P(w / 2, h + 0.5, d / 2), P(w / 2, h, -d / 2), glass);
    parts.glass.quad(P(-w / 2, base, d / 2), P(-w / 2, base, -d / 2), P(-w / 2, h, -d / 2), P(-w / 2, h + 0.5, d / 2), glass);
    parts.glass.quad(P(-w / 2, h, -d / 2), P(w / 2, h, -d / 2), P(w / 2, h + 0.5, d / 2), P(-w / 2, h + 0.5, d / 2), glass);
}

/** The stand a display sits on (a table in a room, a low cabinet on a balcony). */
function stand(d: HomeDisplay, siteFloor: number, parts: Parts) {
    const fr: Frame = {x: d.x, y: siteFloor, z: d.z, rot: d.rot};
    const top = d.floor - (d.form === "tank" ? 0.06 : d.form === "cage" ? 0.03 : 0.07);
    parts.inside.box(fr, 0, top - siteFloor - 0.04, 0, d.w + 0.1, 0.04, d.d + 0.08, STAND);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) parts.inside.box(fr, sx * (d.w / 2), 0, sz * (d.d / 2), 0.04, top - siteFloor - 0.04, 0.04, STAND);
}

function tank(d: HomeDisplay, parts: Parts) {
    const base = d.floor - 0.06;
    const fr: Frame = {x: d.x, y: base, z: d.z, rot: d.rot};
    const hw = d.w / 2 + 0.02;
    const hd = d.d / 2 + 0.02;
    const h = d.top - base + 0.04;
    parts.inside.box(fr, 0, 0, 0, d.w, 0.06, d.d, tone("#8a8276"));
    const r = rng(hashText(d.id));
    for (let k = 0; k < 3; k++) parts.inside.box(fr, (r() - 0.5) * d.w * 0.8, 0.06, hd * 0.55, 0.02, (d.top - d.floor) * (0.4 + r() * 0.4), 0.06, tone("#3f8a3a"), r() * 3);
    parts.glow.box(fr, 0, h + 0.01, 0, d.w * 0.8, 0.02, 0.05, tone("#f4f8ff"));
    parts.glow.box(fr, 0, 0.06, hd - 0.01, d.w * 0.98, d.top - d.floor, 0.01, tone("#8fd4a8"));
    const P = (lx: number, ly: number, lz: number) => at(fr, lx, ly, lz);
    const glass = tone("#dcebe6");
    parts.glass.quad(P(-hw, 0, -hd), P(hw, 0, -hd), P(hw, h, -hd), P(-hw, h, -hd), glass);
    parts.glass.quad(P(hw, 0, -hd), P(hw, 0, hd), P(hw, h, hd), P(hw, h, -hd), glass);
    parts.glass.quad(P(-hw, 0, hd), P(-hw, 0, -hd), P(-hw, h, -hd), P(-hw, h, hd), glass);
    water(parts, fr, d.w / 2, d.d / 2, 0.06, d.top - base, tone("#3f9a86"));
}

function water(parts: Parts, fr: Frame, hw: number, hd: number, y0: number, y1: number, tint: RGB) {
    const P = (lx: number, ly: number, lz: number) => at(fr, lx, ly, lz);
    parts.water.quad(P(-hw, y1, hd), P(hw, y1, hd), P(hw, y1, -hd), P(-hw, y1, -hd), tint);
    parts.water.quad(P(hw, y0, -hd), P(-hw, y0, -hd), P(-hw, y1, -hd), P(hw, y1, -hd), tint);
    parts.water.quad(P(hw, y0, hd), P(hw, y0, -hd), P(hw, y1, -hd), P(hw, y1, hd), tint);
    parts.water.quad(P(-hw, y0, -hd), P(-hw, y0, hd), P(-hw, y1, hd), P(-hw, y1, -hd), tint);
    parts.water.quad(P(-hw, y0, hd), P(hw, y0, hd), P(hw, y1, hd), P(-hw, y1, hd), tint);
}

function cage(d: HomeDisplay, parts: Parts) {
    const base = d.floor - 0.03;
    const fr: Frame = {x: d.x, y: base, z: d.z, rot: d.rot};
    const h = d.top - base + 0.02;
    parts.inside.box(fr, 0, 0, 0, d.w + 0.04, 0.05, d.d + 0.04, tone("#c8a46b"));
    // The perch down the middle.
    parts.inside.box(fr, 0, perchHeight(d) - base - 0.012, 0, d.w, 0.012, 0.012, tone("#8a6a48"));
    const hw = d.w / 2 + 0.02;
    const hd = d.d / 2 + 0.02;
    const P = (lx: number, ly: number, lz: number) => at(fr, lx, ly, lz);
    const c = tone("#d8d4c8");
    parts.bars.quad(P(-hw, 0, -hd), P(hw, 0, -hd), P(hw, h, -hd), P(-hw, h, -hd), c);
    parts.bars.quad(P(hw, 0, hd), P(-hw, 0, hd), P(-hw, h, hd), P(hw, h, hd), c);
    parts.bars.quad(P(hw, 0, -hd), P(hw, 0, hd), P(hw, h, hd), P(hw, h, -hd), c);
    parts.bars.quad(P(-hw, 0, hd), P(-hw, 0, -hd), P(-hw, h, -hd), P(-hw, h, hd), c);
    // The lid: bars too, so the bird is seen from above.
    parts.bars.quad(P(-hw, h, hd), P(hw, h, hd), P(hw, h, -hd), P(-hw, h, -hd), c);
    for (const side of [-1, 1]) parts.inside.box(fr, 0, h - 0.01, side * hd, d.w + 0.06, 0.02, 0.02, tone("#d8d4c8"));
}

function vivarium(d: HomeDisplay, parts: Parts) {
    const base = d.floor - 0.07;
    const fr: Frame = {x: d.x, y: base, z: d.z, rot: d.rot};
    const h = d.top - base + 0.02;
    const hw = d.w / 2 + 0.02;
    const hd = d.d / 2 + 0.02;
    // Wooden back, ends and lid; the substrate; a stone; a heat lamp under the lid. The glass front faces the garden.
    parts.inside.box(fr, 0, 0, hd - 0.01, d.w + 0.04, h, 0.02, tone("#7a5a3e"));
    for (const side of [-1, 1]) parts.inside.box(fr, side * (hw - 0.01), 0, 0, 0.02, h, d.d + 0.04, tone("#7a5a3e"));
    // A glass lid in a wooden rim, so the vivarium is seen into from above.
    for (const side of [-1, 1]) parts.inside.box(fr, 0, h, side * (hd - 0.01), d.w + 0.06, 0.03, 0.03, tone("#6a4a32"));
    parts.inside.box(fr, 0, 0, 0, d.w, 0.07, d.d, tone("#c9a46a"));
    const p = at(fr, d.w * 0.32, 0, d.d * 0.15);
    parts.inside.blob(p[0], d.floor + 0.03, p[2], Math.min(0.12, d.w * 0.12), 0.05, 0.08, tone("#8a7a62"), hashText(d.id), 0);
    parts.glow.box(fr, -d.w * 0.3, h - 0.03, 0, 0.12, 0.02, 0.12, tone("#ffb070"));
    const P = (lx: number, ly: number, lz: number) => at(fr, lx, ly, lz);
    parts.glass.quad(P(-hw, 0, -hd), P(hw, 0, -hd), P(hw, h, -hd), P(-hw, h, -hd), tone("#dcebe6"));
    parts.glass.quad(P(-hw, h, hd), P(hw, h, hd), P(hw, h, -hd), P(-hw, h, -hd), tone("#dcebe6"));
}

function pond(d: HomeDisplay, parts: Parts) {
    const ground = d.floor - 0.06;
    const fr: Frame = {x: d.x, y: ground, z: d.z, rot: d.rot};
    const w = POND_SIZE.w;
    const dd = POND_SIZE.d;
    const t = 0.18;
    const stone = tone("#a49a8a");
    for (const side of [-1, 1]) {
        parts.outdoor.box(fr, 0, -0.3, side * (dd / 2 - t / 2), w, POND_SIZE.wall + 0.3, t, stone, 0, {top: tone("#bab0a0")});
        parts.outdoor.box(fr, side * (w / 2 - t / 2), -0.3, 0, t, POND_SIZE.wall + 0.3, dd - 2 * t, stone, 0, {top: tone("#bab0a0")});
    }
    parts.outdoor.box(fr, 0, 0, 0, w - 2 * t, 0.06, dd - 2 * t, tone("#2e3a32"));
    const r = rng(hashText(d.id));
    for (let k = 0; k < 3; k++) {
        const q = at(fr, (r() - 0.5) * (w - 0.8), 0, (r() - 0.5) * (dd - 0.7));
        parts.outdoor.cylinder({x: q[0], y: d.top + 0.005, z: q[2], rot: 0}, 0, 0, 0, 0.14, 0.14, 0.01, tone("#4f8a3a"), 8);
    }
    water(parts, fr, d.w / 2, d.d / 2, 0.06, d.top - ground, tone("#3f7a6a"));
}

/** The sites in use (each with the ids of its displays in use) drawn, and their floors for the drawn ground. */
export function buildPetHomes(used: ReadonlyArray<{site: HomeSite; displays: ReadonlySet<string>}>): PetHomes {
    const group = new Group();
    group.name = "town:pet-homes";
    const parts: Parts = {shell: new Geo(), inside: new Geo(), outdoor: new Geo(), glow: new Geo(), glass: new Geo(), water: new Geo(), bars: new Geo()};
    const ranges: Array<{from: number; to: number; x: number; y: number; z: number; h: number}> = [];
    const ids = new Set<string>();
    for (const {site, displays} of used) {
        const indoors = ["tank", "cage", "vivarium"].some((form) => displays.has(site.displays[form as "tank"].id));
        if (indoors && site.kind === "garden_room") room(site, parts, ranges);
        if (indoors && site.kind !== "garden_room") {
            // A flat's low cabinet on its balcony or patio.
            const fr: Frame = {x: site.box.x, y: site.floor, z: site.box.z, rot: site.box.rot};
            parts.inside.box(fr, 0, 0, site.box.d / 2 - 0.12 - 0.21, site.box.w - 0.1, 0.42, 0.42, STAND);
        }
        for (const form of ["tank", "cage", "vivarium"] as const) {
            const d = site.displays[form];
            if (!displays.has(d.id)) continue;
            ids.add(d.id);
            if (site.kind === "garden_room") stand(d, site.floor, parts);
            if (form === "tank") tank(d, parts);
            else if (form === "cage") cage(d, parts);
            else vivarium(d, parts);
        }
        if (site.displays.pond && displays.has(site.displays.pond.id)) pond(site.displays.pond, parts);
    }
    const meshes: Mesh[] = [];
    const materials: Material[] = [];
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
    if (parts.shell.triangles) {
        const geometry = parts.shell.toGeometry();
        cutAttribute(geometry, ranges);
        const eye = cutEye();
        const {material, depth} = cutawayMaterial(eye);
        const mesh = add(geometry, material, "pet-homes:shell", true);
        mesh.customDepthMaterial = depth;
        materials.push(depth);
        followEye(mesh, eye);
    }
    if (parts.inside.triangles) add(parts.inside.toGeometry(), interiorMaterial(), "pet-homes:inside", true);
    if (parts.outdoor.triangles) add(parts.outdoor.toGeometry(), outdoorMaterial(), "pet-homes:outdoor", true);
    if (parts.glow.triangles) add(parts.glow.toGeometry(), glowMaterial(), "pet-homes:glow", false);
    if (parts.bars.triangles) add(parts.bars.toGeometry(), barsMaterial(), "pet-homes:bars", false, 2);
    if (parts.water.triangles) add(parts.water.toGeometry(), waterMaterial(), "pet-homes:water", false, 3);
    if (parts.glass.triangles) add(parts.glass.toGeometry(), glassMaterial(), "pet-homes:glass", false, 4);
    return {
        group,
        floors: homeDisplayFloors(used.map((u) => u.site), ids),
        dispose: () => {
            for (const mesh of meshes) mesh.geometry.dispose();
            for (const material of materials) material.dispose();
        }
    };
}
