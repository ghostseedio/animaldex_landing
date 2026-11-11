/**
 * The cottage at Home, drawn (docs/ark-micro.md): built here in code in the
 * Ark's look (soft vertex-shaded forms, like the barn), from the same
 * numbers the small animals' spots are measured on (`micro-decor.ts`
 * COTTAGE, `micro.ts`): limewashed walls on a stone plinth, a tiled roof,
 * a chimney, a porch with a deck and a lean-to roof, a door, windows that
 * glow warm at night, and the porch light (a lamp, its bulb and a soft
 * glow, lit from dusk). Beside it the garden pond, its water ringed with
 * stones.
 *
 * And a lamp post at every other land zone's micro corner, lit at night: its
 * moths' porch light. About ten draw calls in all (the house, the glass, the
 * bulbs, the glows, the posts, the pond's water and stones).
 */

import {
    AdditiveBlending,
    BoxGeometry,
    BufferAttribute,
    BufferGeometry,
    CanvasTexture,
    CircleGeometry,
    Color,
    CylinderGeometry,
    Group,
    IcosahedronGeometry,
    Mesh,
    MeshStandardMaterial,
    Sprite,
    SpriteMaterial,
    Vector3,
    type Material
} from "three";
import {mergeGeometries} from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {COTTAGE, GARDEN_POND, LAMP, microDecor} from "@/ark-scene/micro-decor";
import {roofHeight, ROOF_THICKNESS} from "@/ark-scene/micro";
import {heightAt, seeded} from "@/ark-scene/world";

function shaded(geometry: BufferGeometry, colour: Color, shade: (y: number, i: number) => number = () => 1): BufferGeometry {
    const flat = geometry.index ? geometry.toNonIndexed() : geometry;
    if (flat.getAttribute("uv")) flat.deleteAttribute("uv");
    flat.computeVertexNormals();
    const position = flat.getAttribute("position");
    const colors = new Float32Array(position.count * 3);
    for (let i = 0; i < position.count; i++) {
        const value = shade(position.getY(i), i);
        colors[i * 3] = colour.r * value;
        colors[i * 3 + 1] = colour.g * value;
        colors[i * 3 + 2] = colour.b * value;
    }
    flat.setAttribute("color", new BufferAttribute(colors, 3));
    return flat;
}

function box(w: number, h: number, d: number, x: number, y: number, z: number): BoxGeometry {
    const geometry = new BoxGeometry(w, h, d);
    geometry.translate(x, y, z);
    return geometry;
}

const C = COTTAGE;
const halfW = C.width / 2;
const halfD = C.depth / 2;

/** One slope of the roof: a slab whose underside is the roof line, `ROOF_THICKNESS` thick, out past the walls. */
function roofSlope(front: boolean): BufferGeometry {
    const run = halfD + C.overhang;
    const reach = halfW + C.overhang;
    const slab = new BoxGeometry(reach * 2, ROOF_THICKNESS, run, 6, 1, 6);
    slab.translate(0, ROOF_THICKNESS / 2, run / 2);
    const position = slab.getAttribute("position");
    for (let i = 0; i < position.count; i++) {
        const z = position.getZ(i);
        position.setY(i, position.getY(i) + roofHeight(z));
        if (!front) position.setZ(i, -z);
    }
    return slab;
}

/** The triangle of wall under the roof at one end, facing out. */
function gable(side: number): BufferGeometry {
    const x = side * (halfW + 0.001);
    const low = [x, C.wall, -halfD];
    const peak = [x, C.wall + C.ridge - 0.02, 0];
    const high = [x, C.wall, halfD];
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(new Float32Array(side > 0 ? [...low, ...peak, ...high] : [...low, ...high, ...peak]), 3));
    return geometry;
}

function glowTexture(): CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    const context = canvas.getContext("2d")!;
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, "rgba(255, 230, 170, 1)");
    gradient.addColorStop(0.25, "rgba(255, 200, 120, 0.55)");
    gradient.addColorStop(1, "rgba(255, 170, 80, 0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);
    return new CanvasTexture(canvas);
}

export type MicroScene = {
    group: Group;
    /** 0 by day, 1 at full night: the windows and the porch light come on. */
    setNight: (night: number) => void;
    setShadows: (on: boolean) => void;
    /** Each frame: a glow seen from close by is smaller, so it never floods a close-up of what rests on its lamp. */
    step: (camera: Vector3) => void;
    triangles: number;
    dispose: () => void;
};

/** A cottage's look: its limewash, tiles and woodwork, which side of the back slope its chimney is on, a porch or not. */
export type CottageStyle = {wall: string; tile: string; wood: string; /** 1: the chimney on the left (today's); -1: on the right. */ chimney: 1 | -1; porch: boolean};

/** Today's cottage at Home. */
export const COTTAGE_STYLE: CottageStyle = {wall: "#e3d5bb", tile: "#9c5a3c", wood: "#6f4f36", chimney: 1, porch: true};

/**
 * The cottage's meshes in its own frame (its middle at the origin, its floor at y = 0, facing +z): the house and its
 * window glass. With `COTTAGE_STYLE` it is today's cottage, byte for byte (`ark-props.test`); the props lane's hamlet
 * builds the other plots' cottages from it.
 */
export function cottageGeometry(style: CottageStyle = COTTAGE_STYLE): {house: BufferGeometry; glass: BufferGeometry} {
    const lime = new Color(style.wall);
    const stone = new Color("#9a9182");
    const tile = new Color(style.tile);
    const wood = new Color(style.wood);
    const trim = new Color("#f6f0e2");
    const parts: BufferGeometry[] = [
        // The plinth reaches down into the ground, so the slope never shows a gap under the walls.
        shaded(box(C.width + 0.12, 0.9, C.depth + 0.12, 0, -0.42, 0), stone, (y, i) => 0.82 + 0.1 * ((i * 7) % 3)),
        shaded(box(C.width, C.wall, C.depth, 0, C.wall / 2, 0), lime, (y) => 0.86 + 0.14 * Math.min(y / C.wall, 1)),
        shaded(gable(1), lime, () => 0.95),
        shaded(gable(-1), lime, () => 0.92),
        shaded(roofSlope(true), tile, (_, i) => 0.86 + 0.12 * ((i * 13) % 5) / 5),
        shaded(roofSlope(false), tile, (_, i) => 0.8 + 0.12 * ((i * 11) % 5) / 5),
        // The ridge's capping and a chimney on the back slope.
        shaded(box(C.width + C.overhang * 2, 0.1, 0.22, 0, C.wall + C.ridge + ROOF_THICKNESS, 0), tile.clone().multiplyScalar(0.8)),
        shaded(box(0.5, 1.5, 0.5, -1.4 * style.chimney, roofHeight(0.9) + 0.6, -0.9), stone, (y) => 0.8 + 0.06 * Math.sin(y * 9)),
        // The door and its frame, and the window frames.
        shaded(box(0.9, 2.0, 0.06, (-0.55 + 0.35) / 2, 1.0, halfD + 0.03), wood, (y) => 0.85 + 0.1 * (y > 1 ? 1 : 0)),
        shaded(box(1.06, 2.1, 0.03, (-0.55 + 0.35) / 2, 1.05, halfD + 0.015), trim)
    ];
    if (style.porch) {
        // The porch: a deck on short legs, two posts and a lean-to roof.
        parts.push(
            shaded(box(C.porch.width, C.porch.height, C.porch.depth, 0, C.porch.height / 2, halfD + C.porch.depth / 2), wood, (_, i) => 0.92 + 0.08 * ((i * 5) % 3) / 3),
            shaded(box(0.1, 2.45, 0.1, -C.porch.width / 2 + 0.1, 1.225, halfD + C.porch.depth - 0.1), wood),
            shaded(box(0.1, 2.45, 0.1, C.porch.width / 2 - 0.1, 1.225, halfD + C.porch.depth - 0.1), wood)
        );
        const porchRoof = new BoxGeometry(C.porch.width + 0.3, 0.07, C.porch.depth + 0.2);
        porchRoof.rotateX(0.16);
        porchRoof.translate(0, 2.58, halfD + C.porch.depth / 2 + 0.05);
        parts.push(shaded(porchRoof, tile, () => 0.85));
        // The porch light's lamp: a little box on a bracket.
        parts.push(shaded(box(0.05, 0.05, 0.16, C.light.x, C.light.y + 0.12, C.light.z), new Color("#2f2a26")));
        parts.push(shaded(box(0.13, 0.04, 0.13, C.light.x, C.light.y + 0.12, C.light.z + 0.1), new Color("#2f2a26")));
    }
    const windows: Array<{x: number; z: number; w: number; h: number; y: number; turn: number}> = [
        {x: -1.75, z: halfD, w: 0.85, h: 0.75, y: 1.35, turn: 0},
        {x: 1.8, z: halfD, w: 0.8, h: 0.75, y: 1.35, turn: 0},
        {x: halfW, z: 0.4, w: 0.8, h: 0.7, y: 1.4, turn: Math.PI / 2},
        {x: -halfW, z: -0.4, w: 0.8, h: 0.7, y: 1.4, turn: -Math.PI / 2},
        {x: 0.6, z: -halfD, w: 0.8, h: 0.7, y: 1.4, turn: Math.PI}
    ];
    const glass: BufferGeometry[] = [];
    for (const window of windows) {
        const frame = new BoxGeometry(window.w + 0.12, window.h + 0.12, 0.05);
        const pane = new BoxGeometry(window.w, window.h, 0.05);
        for (const [geometry, out] of [[frame, 0.02], [pane, 0.035]] as const) {
            geometry.translate(0, 0, out);
            geometry.rotateY(window.turn);
            geometry.translate(window.x, window.y, window.z);
        }
        parts.push(shaded(frame, trim));
        glass.push(pane);
        // A cross of glazing bars.
        const bars = [new BoxGeometry(window.w, 0.035, 0.06), new BoxGeometry(0.035, window.h, 0.06)];
        for (const bar of bars) {
            bar.translate(0, 0, 0.05);
            bar.rotateY(window.turn);
            bar.translate(window.x, window.y, window.z);
            parts.push(shaded(bar, trim));
        }
    }
    const house = mergeGeometries(parts)!;
    const glassGeometry = mergeGeometries(glass.map((g) => g.index ? g.toNonIndexed() : g))!;
    return {house, glass: glassGeometry};
}

export function buildMicroScene(): MicroScene {
    const group = new Group();
    const house = new Group();
    house.position.set(C.x, C.floor, C.z);
    house.rotation.y = C.rotation;
    group.add(house);

    const stone = new Color("#9a9182");
    const random = seeded(77341);
    const cottage = cottageGeometry(COTTAGE_STYLE);
    const houseGeometry = cottage.house;
    const material = new MeshStandardMaterial({vertexColors: true, roughness: 0.86, metalness: 0});
    const houseMesh = new Mesh(houseGeometry, material);
    houseMesh.castShadow = true;
    houseMesh.receiveShadow = true;
    house.add(houseMesh);

    const glassGeometry = cottage.glass;
    const glassMaterial = new MeshStandardMaterial({color: new Color("#3a4a55"), roughness: 0.18, metalness: 0.2, emissive: new Color("#ffc679"), emissiveIntensity: 0});
    const glassMesh = new Mesh(glassGeometry, glassMaterial);
    house.add(glassMesh);

    const bulbGeometry = new IcosahedronGeometry(0.045, 1);
    bulbGeometry.translate(C.light.x, C.light.y + 0.06, C.light.z + 0.1);
    const bulbMaterial = new MeshStandardMaterial({color: new Color("#fff4d6"), roughness: 0.4, emissive: new Color("#ffd48a"), emissiveIntensity: 0.2});
    const bulb = new Mesh(bulbGeometry, bulbMaterial);
    house.add(bulb);

    // The glow: an additive sprite brighter than white (the frame is lit in HDR, so it survives the tone mapping and
    // feeds the bloom), not fogged, drawn after everything.
    const glowMap = glowTexture();
    const glowMaterial = new SpriteMaterial({map: glowMap, color: new Color(2.2, 1.7, 1.05), blending: AdditiveBlending, depthWrite: false, transparent: true, opacity: 0, fog: false});
    const glow = new Sprite(glowMaterial);
    glow.position.set(C.light.x, C.light.y + 0.06, C.light.z + 0.14);
    glow.scale.setScalar(2.6);
    glow.renderOrder = 4;
    house.add(glow);

    // The lamp posts at the other zones' micro corners: a post, a lantern and its glow.
    const lamps = microDecor().filter((item) => item.kind === "lamp");
    const postParts: BufferGeometry[] = [];
    const lampBulbs: BufferGeometry[] = [];
    const lampGlows: Sprite[] = [];
    const iron = new Color("#2f2a26");
    for (const lamp of lamps) {
        const post = new CylinderGeometry(LAMP.radius * 0.8, LAMP.radius, LAMP.height, 8);
        post.translate(lamp.x, lamp.y + LAMP.height / 2, lamp.z);
        postParts.push(shaded(post, iron, (y) => 0.8 + 0.2 * Math.min((y - lamp.y) / LAMP.height, 1)));
        const cap = new CylinderGeometry(0.02, 0.17, 0.12, 6);
        cap.translate(lamp.x, lamp.y + LAMP.height + 0.2, lamp.z);
        postParts.push(shaded(cap, iron));
        const foot = new CylinderGeometry(LAMP.radius * 1.8, LAMP.radius * 2.2, 0.25, 8);
        foot.translate(lamp.x, lamp.y + 0.1, lamp.z);
        postParts.push(shaded(foot, iron, () => 0.85));
        const bulb = new IcosahedronGeometry(0.09, 1);
        bulb.scale(1, 1.3, 1);
        bulb.translate(lamp.x, lamp.y + LAMP.height + 0.06, lamp.z);
        lampBulbs.push(bulb);
        const halo = new Sprite(glowMaterial);
        halo.position.set(lamp.x, lamp.y + LAMP.height + 0.06, lamp.z);
        halo.scale.setScalar(2.6);
        halo.renderOrder = 4;
        lampGlows.push(halo);
        group.add(halo);
    }
    const postGeometry = postParts.length ? mergeGeometries(postParts)! : new BufferGeometry();
    const postMesh = new Mesh(postGeometry, new MeshStandardMaterial({vertexColors: true, roughness: 0.6, metalness: 0.3}));
    postMesh.castShadow = true;
    group.add(postMesh);
    const lampBulbGeometry = lampBulbs.length ? mergeGeometries(lampBulbs)! : new BufferGeometry();
    const lampBulbMesh = new Mesh(lampBulbGeometry, bulbMaterial);
    group.add(lampBulbMesh);

    // The garden pond: still water ringed with stones.
    const pond = GARDEN_POND;
    const waterGeometry = new CircleGeometry(pond.radius, 28);
    waterGeometry.rotateX(-Math.PI / 2);
    waterGeometry.translate(pond.x, pond.y, pond.z);
    const waterMaterial = new MeshStandardMaterial({color: new Color("#3f6f78"), roughness: 0.08, metalness: 0.35, transparent: true, opacity: 0.92});
    const water = new Mesh(waterGeometry, waterMaterial);
    water.receiveShadow = true;
    group.add(water);
    const rim: BufferGeometry[] = [];
    const rimStones = 22;
    for (let k = 0; k < rimStones; k++) {
        const angle = k / rimStones * Math.PI * 2 + random() * 0.1;
        const x = pond.x + Math.cos(angle) * (pond.radius + 0.05);
        const z = pond.z + Math.sin(angle) * (pond.radius + 0.05);
        const stoneGeometry = new IcosahedronGeometry(0.17 + random() * 0.08, 0);
        stoneGeometry.scale(1.2, 0.55, 0.9);
        stoneGeometry.rotateY(angle);
        stoneGeometry.translate(x, Math.max(heightAt(x, z), pond.y - 0.06) + 0.03, z);
        rim.push(shaded(stoneGeometry, stone, (_, i) => 0.78 + ((i * 7) % 5) / 18));
    }
    const rimMesh = new Mesh(mergeGeometries(rim)!, material);
    rimMesh.castShadow = true;
    rimMesh.receiveShadow = true;
    group.add(rimMesh);

    const meshes = [houseMesh, rimMesh, postMesh];
    const materials: Material[] = [material, glassMaterial, bulbMaterial, glowMaterial, waterMaterial, postMesh.material as Material];
    const geometries = [houseGeometry, glassGeometry, bulbGeometry, waterGeometry, rimMesh.geometry, postGeometry, lampBulbGeometry];
    const triangles = geometries.reduce((sum, geometry) => sum + (geometry.index ? geometry.index.count : geometry.getAttribute("position").count) / 3, 0);
    const warm = new Color("#ffc679");
    const haloAt = new Vector3();
    return {
        group,
        setNight: (night) => {
            const on = Math.min(Math.max((night - 0.15) / 0.5, 0), 1);
            glassMaterial.emissive.copy(warm);
            glassMaterial.emissiveIntensity = 1.6 * on;
            bulbMaterial.emissiveIntensity = 0.2 + 9 * on;
            glowMaterial.opacity = on;
            glow.visible = on > 0.01;
            for (const halo of lampGlows) halo.visible = on > 0.01;
        },
        setShadows: (on) => {
            for (const mesh of meshes) mesh.castShadow = on;
        },
        step: (cameraAt) => {
            for (const halo of [glow, ...lampGlows]) {
                if (!halo.visible) continue;
                halo.getWorldPosition(haloAt);
                // Graphics pass: a small halo up close (about 7° across), never a disc that floods the frame.
                halo.scale.setScalar(Math.min(Math.max(haloAt.distanceTo(cameraAt) * 0.12, 0.18), 1.6));
            }
        },
        triangles,
        dispose: () => {
            geometries.forEach((geometry) => geometry.dispose());
            materials.forEach((m) => m.dispose());
            glowMap.dispose();
        }
    };
}
