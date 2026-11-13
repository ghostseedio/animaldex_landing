/**
 * The town's close-up detail (lane GA, as the wild island's `near-detail.ts`): what appears only round the camera when
 * it comes down to the street, so the far view stays cheap. Fallen leaves under the trees and blown into the gutters,
 * weeds in the slab joints and along the kerbs, grit and stones on the roads, the gravel and the farm ground, daisies
 * and clover in the lawns, now and then a scrap of paper or a can (plain, no brands).
 *
 * Deterministic: each 2 m cell is filled from its own seed and what lies there (the plan's streets, the square, the
 * drives, `ground.ts` surfaces), so everyone sees the same leaf in the same place. Cells are built a few a frame as
 * the view moves and kept in a small cache. The camera is read from the meshes' own render callback, so the town's
 * hooks into the scene are unchanged. One draw call a kind while near; none from afar.
 */

import {Color, DynamicDrawUsage, Group, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3, type BufferGeometry, type Camera} from "three";
import {hashText, inBox, polylineNearest, rng} from "@/ark-scene/islands/town/geom";
import {sampleTownGround} from "@/ark-scene/islands/town/ground";
import {TOWN_HALF, TOWN_LEVEL, type TownPlan} from "@/ark-scene/islands/town/plan";
import {Geo, tone} from "@/ark-scene/islands/town/render/kit";
import {PAVEMENT_LIFT, ROAD_LIFT} from "@/ark-scene/islands/town/render/streets";
import {townWeather} from "@/ark-scene/islands/town/render/materials";

type Kind = "leaf" | "weed" | "stone" | "flower" | "litter";
const KINDS: Kind[] = ["leaf", "weed", "stone", "flower", "litter"];
const CAP: Record<Kind, number> = {leaf: 2400, weed: 1400, stone: 1600, flower: 1400, litter: 120};
const CELL = 2;
/** Detail out to this far round the point looked at, while the camera is this close to it. */
const RADIUS = 14;
const SHOW_WITHIN = 38;
/** Cells built a frame at most. */
const PER_FRAME = 10;

type Item = {kind: Kind; x: number; y: number; z: number; yaw: number; tilt: number; scale: number; colour: number};
type Where = "road" | "gutter" | "pavement" | "setts" | "gravel" | "soil" | "lawn" | "grass" | "water" | "other";

const LEAF = ["#b5651d", "#c8a03a", "#8a4a2a", "#6f7a2f", "#a5482a", "#d0b060"].map((c) => new Color(c));
const WEED = ["#4f7a33", "#5f8a3a", "#6f8f40", "#43662c"].map((c) => new Color(c));
const STONE = ["#8a857c", "#6f6a62", "#9c9488", "#7c7266"].map((c) => new Color(c));
const FLOWER = ["#f4f2ea", "#f0dc5a", "#e8e6f0", "#c9a8d8"].map((c) => new Color(c));
const LITTER = ["#efece4", "#c9c4b8", "#7a8a9a", "#a83a32", "#3a6a4a"].map((c) => new Color(c));
const PALETTE: Record<Kind, Color[]> = {leaf: LEAF, weed: WEED, stone: STONE, flower: FLOWER, litter: LITTER};

function geometryOf(kind: Kind): BufferGeometry {
    const g = new Geo();
    const f = {x: 0, y: 0, z: 0, rot: 0};
    const white = tone("#ffffff");
    switch (kind) {
        case "leaf": {
            // A leaf lying flat: a pointed blade with a midrib's crease.
            g.tri([-0.05, 0.004, 0], [0, 0.012, 0.022], [0.05, 0.004, 0], white);
            g.tri([-0.05, 0.004, 0], [0.05, 0.004, 0], [0, 0.012, -0.022], white);
            break;
        }
        case "weed": {
            // A tuft: blades leaning out from the joint.
            for (let k = 0; k < 4; k++) {
                const a = (k / 4) * Math.PI * 2;
                const c = Math.cos(a);
                const s = Math.sin(a);
                g.tri([c * 0.012 - s * 0.01, 0, s * 0.012 + c * 0.01], [c * 0.06, 0.11, s * 0.06], [c * 0.012 + s * 0.01, 0, s * 0.012 - c * 0.01], white);
                g.tri([c * 0.012 + s * 0.01, 0, s * 0.012 - c * 0.01], [c * 0.06, 0.11, s * 0.06], [c * 0.012 - s * 0.01, 0, s * 0.012 + c * 0.01], white);
            }
            break;
        }
        case "stone":
            g.blob(0, 0.012, 0, 0.03, 0.018, 0.026, white, 5, 0);
            break;
        case "flower": {
            // A daisy's head on the grass: petals round a yellow middle.
            for (let k = 0; k < 6; k++) {
                const a = (k / 6) * Math.PI * 2;
                g.tri([0, 0.02, 0], [Math.cos(a + 0.3) * 0.016, 0.02, Math.sin(a + 0.3) * 0.016], [Math.cos(a - 0.3) * 0.016, 0.02, Math.sin(a - 0.3) * 0.016], white);
            }
            g.box(f, 0, 0.02, 0, 0.006, 0.004, 0.006, tone("#f0c030"));
            break;
        }
        case "litter":
            // A crumpled scrap (or, coloured, a plain can on its side).
            g.box(f, 0, 0, 0, 0.11, 0.015, 0.08, white, 0.2);
            g.box(f, 0.02, 0.012, 0.01, 0.06, 0.02, 0.05, white, -0.4);
            break;
    }
    return g.toGeometry();
}

export type TownNear = {group: Group; setShare: (share: number) => void; stats: () => {cells: number; items: number}; dispose: () => void};

/** The close-up detail for the town (`trees`: the scenery's tree spots, for the leaves). */
export function buildTownNear(plan: TownPlan, trees: ReadonlyArray<{x: number; z: number; scale: number}>): TownNear {
    const group = new Group();
    group.name = "town:near";
    const material = townWeather(new MeshStandardMaterial({vertexColors: true, roughness: 0.85, metalness: 0}), {soak: 0.3, wetRoughness: 0.3});
    const meshes = new Map<Kind, InstancedMesh>();
    for (const kind of KINDS) {
        const mesh = new InstancedMesh(geometryOf(kind), material, CAP[kind]);
        mesh.instanceMatrix.setUsage(DynamicDrawUsage);
        mesh.setColorAt(0, new Color(1, 1, 1));
        mesh.count = 0;
        mesh.frustumCulled = false;
        mesh.castShadow = false;
        mesh.receiveShadow = true;
        mesh.name = `town:near:${kind}`;
        mesh.visible = kind === "leaf";
        meshes.set(kind, mesh);
        group.add(mesh);
    }
    let share = 1;
    // The trees on a coarse grid (leaves fall within a crown's reach).
    const treeGrid = new Map<number, Array<{x: number; z: number; r: number}>>();
    const gkey = (gx: number, gz: number) => (gx + 64) * 128 + gz + 64;
    for (const t of trees) {
        const r = 5.5 * t.scale;
        const k = gkey(Math.floor(t.x / 16), Math.floor(t.z / 16));
        const list = treeGrid.get(k) ?? [];
        list.push({x: t.x, z: t.z, r});
        treeGrid.set(k, list);
    }
    const canopy = (x: number, z: number) => {
        let best = 0;
        for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
                for (const t of treeGrid.get(gkey(Math.floor(x / 16) + dx, Math.floor(z / 16) + dz)) ?? []) {
                    const d = Math.hypot(t.x - x, t.z - z);
                    best = Math.max(best, 1 - Math.min(Math.max((d - t.r * 0.5) / t.r, 0), 1));
                }
            }
        }
        return best;
    };
    const streets = plan.streets.map((s) => {
        let x0 = Infinity;
        let x1 = -Infinity;
        let z0 = Infinity;
        let z1 = -Infinity;
        for (const p of s.line) {
            x0 = Math.min(x0, p.x);
            x1 = Math.max(x1, p.x);
            z0 = Math.min(z0, p.z);
            z1 = Math.max(z1, p.z);
        }
        const m = s.width / 2 + s.pavement + 1;
        return {s, x0: x0 - m, x1: x1 + m, z0: z0 - m, z1: z1 + m};
    });
    const where = (x: number, z: number, near: typeof streets): {at: Where; y: number} => {
        for (const {s} of near) {
            const d = polylineNearest(s.line, x, z).distance;
            if (d < s.width / 2) {
                const ground = sampleTownGround(x, z).height;
                if (s.kind === "high" || s.kind === "road" || s.kind === "lane") return {at: d > s.width / 2 - 0.55 && s.pavement > 0 ? "gutter" : "road", y: ground + ROAD_LIFT};
                return {at: s.kind === "track" ? "soil" : s.kind === "quay" || s.kind === "path" ? "pavement" : "gravel", y: ground + ROAD_LIFT};
            }
            if (s.pavement > 0 && d < s.width / 2 + s.pavement) return {at: "pavement", y: sampleTownGround(x, z).height + PAVEMENT_LIFT};
        }
        if (inBox(plan.square, x, z)) return {at: "setts", y: sampleTownGround(x, z).height + 0.12};
        for (const p of plan.parcels) if (p.drive && inBox(p.drive, x, z)) return {at: p.seed % 2 ? "pavement" : "gravel", y: sampleTownGround(x, z).height + 0.1};
        const g = sampleTownGround(x, z);
        switch (g.surface) {
            case "lawn":
            case "park":
            case "zoo":
            case "churchyard":
                return {at: "lawn", y: g.height};
            case "grass":
            case "meadow":
            case "orchard":
            case "paddock":
            case "shore":
                return {at: "grass", y: g.height};
            case "farmyard":
            case "allotment":
            case "field":
                return {at: "soil", y: g.height};
            case "water":
            case "sea":
                return {at: "water", y: g.height};
            default:
                return {at: "other", y: g.height};
        }
    };
    /** Per m² of each kind on each ground (leaves also by the canopy above). */
    const density = (at: Where, kind: Kind, under: number): number => {
        switch (kind) {
            case "leaf":
                return (at === "water" ? 0 : at === "gutter" ? 2.2 : 0.15) + under * (at === "lawn" || at === "grass" ? 3 : 5);
            case "weed":
                return at === "pavement" ? 0.7 : at === "gutter" ? 1.2 : at === "setts" ? 1.0 : at === "gravel" ? 0.8 : 0;
            case "stone":
                return at === "gravel" ? 6 : at === "soil" ? 3 : at === "gutter" ? 2 : at === "road" ? 0.25 : 0;
            case "flower":
                return at === "lawn" ? 2.5 : at === "grass" ? 1.2 : 0;
            case "litter":
                return at === "gutter" ? 0.06 : at === "pavement" ? 0.02 : at === "setts" ? 0.03 : 0;
        }
    };
    const cache = new Map<number, Item[]>();
    const cellKey = (cx: number, cz: number) => (cx + 512) * 1024 + cz + 512;
    const build = (cx: number, cz: number): Item[] => {
        const x0 = cx * CELL;
        const z0 = cz * CELL;
        const near = streets.filter((q) => x0 + CELL >= q.x0 && x0 <= q.x1 && z0 + CELL >= q.z0 && z0 <= q.z1);
        const r = rng(hashText(`near:${cx}:${cz}`));
        const items: Item[] = [];
        const under = canopy(x0 + CELL / 2, z0 + CELL / 2);
        const at0 = where(x0 + CELL / 2, z0 + CELL / 2, near).at;
        for (const kind of KINDS) {
            // An upper bound from the cell's middle, then each item tested where it falls.
            const most = Math.max(density(at0, kind, under), kind === "leaf" ? 2.2 + under * 5 : kind === "weed" ? 1.2 : kind === "stone" ? 6 : kind === "flower" ? 2.5 : 0.06);
            const n = Math.floor(most * CELL * CELL + r());
            for (let i = 0; i < n; i++) {
                const x = x0 + r() * CELL;
                const z = z0 + r() * CELL;
                const keep = r();
                const spot = where(x, z, near);
                const want = density(spot.at, kind, kind === "leaf" ? canopy(x, z) : 0);
                if (keep * most >= want) continue;
                const palette = PALETTE[kind];
                items.push({kind, x, y: spot.y, z, yaw: r() * Math.PI * 2, tilt: (r() - 0.5) * 0.3, scale: 0.7 + r() * 0.7, colour: Math.floor(r() * palette.length) + r() * 0.999});
            }
        }
        return items;
    };

    const m = new Matrix4();
    const q = new Quaternion();
    const e = new Vector3();
    const sc = new Vector3();
    const up = new Vector3(0, 1, 0);
    const tiltAxis = new Vector3(1, 0, 0);
    const tq = new Quaternion();
    const c = new Color();
    let centre: {x: number; z: number} | null = null;
    let lastKey = "";
    const eye = new Vector3();
    const look = new Vector3();

    const write = () => {
        const counts = new Map<Kind, number>();
        for (const kind of KINDS) counts.set(kind, 0);
        if (centre) {
            const cx0 = Math.floor((centre.x - RADIUS) / CELL);
            const cx1 = Math.floor((centre.x + RADIUS) / CELL);
            const cz0 = Math.floor((centre.z - RADIUS) / CELL);
            const cz1 = Math.floor((centre.z + RADIUS) / CELL);
            for (let cx = cx0; cx <= cx1; cx++) {
                for (let cz = cz0; cz <= cz1; cz++) {
                    const items = cache.get(cellKey(cx, cz));
                    if (!items) continue;
                    for (const it of items) {
                        if (Math.hypot(it.x - centre.x, it.z - centre.z) > RADIUS) continue;
                        // The tier's share: a stable prefix by each item's own seed.
                        if ((it.colour % 1) > share) continue;
                        const mesh = meshes.get(it.kind)!;
                        const n = counts.get(it.kind)!;
                        if (n >= CAP[it.kind]) continue;
                        q.setFromAxisAngle(up, it.yaw);
                        tq.setFromAxisAngle(tiltAxis, it.tilt);
                        q.multiply(tq);
                        e.set(it.x, it.y, it.z);
                        sc.setScalar(it.scale);
                        m.compose(e, q, sc);
                        mesh.setMatrixAt(n, m);
                        c.copy(PALETTE[it.kind][Math.floor(it.colour)]);
                        mesh.setColorAt(n, c);
                        counts.set(it.kind, n + 1);
                    }
                }
            }
        }
        for (const kind of KINDS) {
            const mesh = meshes.get(kind)!;
            mesh.count = counts.get(kind)!;
            // (Town performance lane: an empty kind is not drawn (three sets up an empty instanced mesh's program and
            // uniforms every frame); the leaves always are: their render callback reads the camera.)
            mesh.visible = kind === "leaf" || mesh.count > 0;
            mesh.instanceMatrix.needsUpdate = true;
            if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        }
    };

    /** Each frame the town is drawn: where the camera looks, and whether it is close enough for detail. */
    const follow = (camera: Camera) => {
        camera.getWorldPosition(eye);
        group.updateWorldMatrix(true, false);
        const ox = group.matrixWorld.elements[12];
        const oz = group.matrixWorld.elements[14];
        camera.getWorldDirection(look);
        // Where the view meets the town's level (or 12 m ahead when it looks up).
        const lx = eye.x - ox;
        const lz = eye.z - oz;
        const height = eye.y - TOWN_LEVEL;
        const t = look.y < -0.05 ? Math.min(height / -look.y, SHOW_WITHIN) : 12;
        const gx = lx + look.x * t;
        const gz = lz + look.z * t;
        const close = height < 30 && Math.hypot(gx - lx, gz - lz, height) < SHOW_WITHIN && Math.abs(gx) < TOWN_HALF && Math.abs(gz) < TOWN_HALF;
        if (!close) {
            if (centre) {
                centre = null;
                lastKey = "";
                write();
            }
            return;
        }
        // Build what is missing near the point (a few cells a frame; all at once after a jump, as a still's), then write
        // when the set changes.
        const jumped = !centre || Math.hypot(centre.x - gx, centre.z - gz) > 20;
        let built = 0;
        const limit = jumped ? Infinity : PER_FRAME;
        const cx0 = Math.floor((gx - RADIUS) / CELL);
        const cx1 = Math.floor((gx + RADIUS) / CELL);
        const cz0 = Math.floor((gz - RADIUS) / CELL);
        const cz1 = Math.floor((gz + RADIUS) / CELL);
        for (let cx = cx0; cx <= cx1 && built < limit; cx++) {
            for (let cz = cz0; cz <= cz1 && built < limit; cz++) {
                const k = cellKey(cx, cz);
                if (cache.has(k)) continue;
                cache.set(k, build(cx, cz));
                built++;
            }
        }
        if (cache.size > 900) {
            for (const k of Array.from(cache.keys()).slice(0, cache.size - 700)) cache.delete(k);
        }
        const key = `${Math.round(gx)}|${Math.round(gz)}|${cache.size}|${share}`;
        if (key === lastKey) return;
        lastKey = key;
        centre = {x: gx, z: gz};
        write();
    };
    // (Read from the render callback of the first kind: it is drawn, even when empty, whenever the town is.)
    // (Only the scene's own perspective camera; a pass that draws the scene again in the same moment is skipped.)
    let seenAt = -1;
    meshes.get("leaf")!.onBeforeRender = (_renderer, _scene, camera) => {
        const now = performance.now();
        if (!(camera as Camera & {isPerspectiveCamera?: boolean}).isPerspectiveCamera || now - seenAt < 4) return;
        seenAt = now;
        follow(camera);
    };

    return {
        group,
        setShare: (next) => {
            share = next;
            lastKey = "";
        },
        stats: () => {
            let items = 0;
            meshes.forEach((mesh) => (items += mesh.count));
            return {cells: cache.size, items};
        },
        dispose: () => {
            meshes.forEach((mesh) => {
                mesh.geometry.dispose();
                mesh.dispose();
            });
            material.dispose();
            cache.clear();
        }
    };
}
