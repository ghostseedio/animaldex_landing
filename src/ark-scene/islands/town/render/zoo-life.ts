/**
 * The zoo's day drawn (`zoo-life.ts`): each open enclosure's enrichment props (one merged mesh: puzzle feeders, hanging
 * toys, hay nets, balls, hammocks, scent posts, salt licks, burrow boxes, heat lamps, perches, bathing pools, fruit
 * skewers), the food put down at its feeding station while it is fed (one instanced mesh, eaten away over the window),
 * and an ice block that melts through the day where the type has one. Two draw calls for the whole zoo, in the town's
 * local frame (the town's root carries the world origin). Pure functions of the island clock: the same for everyone.
 */

import {BoxGeometry, BufferAttribute, BufferGeometry, Color, CylinderGeometry, DynamicDrawUsage, Group, IcosahedronGeometry, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Quaternion, SphereGeometry, Vector3} from "three";
import {mergeGeometries} from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type {ZooEnclosure} from "@/ark-scene/islands/town/areas";
import type {TownClock} from "@/ark-scene/islands/town/people";
import {iceLeft, zooFeedingAt, type ZooFood} from "@/ark-scene/islands/town/zoo-life";

const UP = new Vector3(0, 1, 0);
const FOOD_COLOUR: Record<ZooFood, string> = {fish: "#9fb3bf", hay: "#c9b26a", meat: "#8a3b30", fruit: "#d9822b", seed: "#c8a46b", insects: "#5a4a3a", pellets: "#9c7a4f"};

function painted(geometry: BufferGeometry, hex: string, x: number, y: number, z: number, turn = 0): BufferGeometry {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    const m = new Matrix4().compose(new Vector3(x, y, z), new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), turn), new Vector3(1, 1, 1));
    g.applyMatrix4(m);
    const c = new Color(hex);
    const n = g.getAttribute("position").count;
    const colours = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) colours.set([c.r, c.g, c.b], i * 3);
    g.setAttribute("color", new BufferAttribute(colours, 3));
    for (const name of Object.keys(g.attributes)) if (name !== "position" && name !== "normal" && name !== "color") g.deleteAttribute(name);
    return g;
}

/** The props for one enrichment item at a point on the ground (local frame, the ground's height `y`). */
function prop(what: string, x: number, y: number, z: number, seed: number): BufferGeometry[] {
    const turn = (seed % 628) / 100;
    switch (what) {
        case "puzzle_feeder":
            return [painted(new BoxGeometry(0.5, 0.35, 0.5), "#7a5a3a", x, y + 0.18, z, turn), painted(new CylinderGeometry(0.06, 0.06, 0.1, 6), "#2f2a24", x, y + 0.4, z)];
        case "hay_net":
            return [painted(new CylinderGeometry(0.06, 0.06, 2.4, 6), "#6a5038", x, y + 1.2, z), painted(new SphereGeometry(0.45, 8, 6), "#b8a25e", x + 0.35, y + 1.7, z)];
        case "hay":
            return [painted(new CylinderGeometry(0.55, 0.55, 0.8, 10), "#c9b26a", x, y + 0.4, z, turn)];
        case "ball":
            return [painted(new SphereGeometry(0.28, 10, 8), "#c8402e", x, y + 0.28, z)];
        case "hammock":
            return [painted(new CylinderGeometry(0.07, 0.07, 2.2, 6), "#6a5038", x - 1, y + 1.1, z), painted(new CylinderGeometry(0.07, 0.07, 2.2, 6), "#6a5038", x + 1, y + 1.1, z), painted(new BoxGeometry(2, 0.08, 0.8), "#b07a4a", x, y + 1.5, z)];
        case "climbing_frame":
            return [0, 1, 2, 3].map((k) => painted(new CylinderGeometry(0.08, 0.08, 3, 6), "#6a5038", x + (k % 2 ? 0.9 : -0.9), y + 1.5, z + (k > 1 ? 0.9 : -0.9))).concat([painted(new BoxGeometry(2, 0.1, 2), "#7a5a3a", x, y + 3, z)]);
        case "scent_trail":
            return [0, 1, 2].map((k) => painted(new CylinderGeometry(0.05, 0.05, 0.5, 5), "#8a6a48", x + k * 1.4, y + 0.25, z + Math.sin(k) * 0.8));
        case "salt_lick":
            return [painted(new BoxGeometry(0.3, 0.25, 0.3), "#e8e2d6", x, y + 0.6, z), painted(new CylinderGeometry(0.06, 0.06, 0.5, 6), "#6a5038", x, y + 0.25, z)];
        case "scratching_post":
            return [painted(new CylinderGeometry(0.18, 0.2, 1.6, 8), "#7a5a3a", x, y + 0.8, z)];
        case "burrow_box":
            return [painted(new BoxGeometry(0.8, 0.5, 0.6), "#6f5a42", x, y + 0.25, z, turn)];
        case "perches":
            return [painted(new CylinderGeometry(0.05, 0.05, 2.6, 6), "#6a5038", x, y + 1.3, z), painted(new CylinderGeometry(0.04, 0.04, 1.6, 6).rotateZ(Math.PI / 2), "#6a5038", x, y + 2.2, z)];
        case "bathing_pool":
            return [painted(new CylinderGeometry(0.7, 0.7, 0.12, 14), "#6f9aa8", x, y + 0.06, z)];
        case "fruit_skewer":
            return [painted(new CylinderGeometry(0.04, 0.04, 1.8, 6), "#6a5038", x, y + 0.9, z), ...[0, 1, 2].map((k) => painted(new SphereGeometry(0.1, 6, 5), k === 1 ? "#d9822b" : "#c8402e", x, y + 1.3 + k * 0.18, z))];
        case "heat_lamp":
            return [painted(new CylinderGeometry(0.16, 0.22, 0.2, 10), "#d86a2a", x, y + 1.9, z), painted(new CylinderGeometry(0.03, 0.03, 0.8, 6), "#3a3a3a", x, y + 2.4, z)];
        case "insect_feeder":
        case "butterfly_feeder":
            return [painted(new CylinderGeometry(0.04, 0.04, 1.2, 6), "#4a4a40", x, y + 0.6, z), painted(new CylinderGeometry(0.22, 0.18, 0.06, 10), "#e0b84a", x, y + 1.2, z)];
        case "hollow_logs":
            return [painted(new CylinderGeometry(0.35, 0.35, 2.2, 10).rotateZ(Math.PI / 2), "#5e4630", x, y + 0.35, z, turn)];
        case "scatter_feed":
            return [0, 1, 2, 3, 4].map((k) => painted(new SphereGeometry(0.07, 5, 4), "#d9a23b", x + Math.cos(k * 2.3) * 0.8, y + 0.05, z + Math.sin(k * 2.3) * 0.8));
        case "fish_scatter":
            return [painted(new CylinderGeometry(0.25, 0.2, 0.35, 10), "#5f7f8f", x, y + 0.18, z)];
        default:
            // (Logs, rocks, the pool, the termite mound and the high platform are the town's own scenery.)
            return [];
    }
}

export type ZooLife = {group: Group; update: (clock: TownClock) => void; dispose: () => void; stats: () => {feeding: number}};

export function buildZooLife(enclosures: readonly ZooEnclosure[], groundAt: (x: number, z: number) => number): ZooLife {
    const group = new Group();
    group.name = "town:zoo-life";
    const parts: BufferGeometry[] = [];
    enclosures.forEach((e, i) => {
        if (e.shared) return;
        e.enrichment.forEach((item, k) => {
            for (const g of prop(item.what, item.at.x, groundAt(item.at.x, item.at.z), item.at.z, i * 31 + k)) parts.push(g);
        });
    });
    const material = new MeshStandardMaterial({vertexColors: true, roughness: 0.85, metalness: 0});
    const merged = parts.length ? mergeGeometries(parts, false) : null;
    for (const p of parts) p.dispose();
    const props = merged ? new Mesh(merged, material) : null;
    if (props) {
        props.castShadow = true;
        props.receiveShadow = true;
        group.add(props);
    }
    // The food at each station (and an ice block in the bears', penguins' and big cats' enclosures), one instance each.
    const open = enclosures.filter((e) => !e.shared);
    const foodGeometry = new IcosahedronGeometry(0.42, 0);
    const foodMaterial = new MeshStandardMaterial({roughness: 0.9, metalness: 0});
    const food = new InstancedMesh(foodGeometry, foodMaterial, Math.max(open.length * 2, 1));
    food.instanceMatrix.setUsage(DynamicDrawUsage);
    food.castShadow = true;
    food.frustumCulled = false;
    group.add(food);
    const m = new Matrix4();
    const q = new Quaternion();
    const s = new Vector3();
    const p = new Vector3();
    const iceTypes = new Set(["bears_wolves", "penguin_seal_pools", "big_cats"]);
    let lastMinute = -1;
    let feeding = 0;
    const update = (clock: TownClock) => {
        const minute = Math.floor((clock.day * 24 + clock.hours) * 60);
        if (minute === lastMinute) return;
        lastMinute = minute;
        feeding = 0;
        open.forEach((e, i) => {
            const fed = zooFeedingAt(e.type, clock);
            const y = groundAt(e.feeding.x, e.feeding.z);
            const left = fed ? 1 - fed.eaten : 0;
            if (fed) feeding++;
            p.set(e.feeding.x, y + 0.15 * left, e.feeding.z);
            s.set(1.6 * left, 0.6 * left, 1.2 * left);
            food.setMatrixAt(i * 2, m.compose(p, q.identity(), s));
            food.setColorAt(i * 2, new Color(FOOD_COLOUR[fed?.food ?? "hay"]));
            const ice = iceTypes.has(e.type) ? iceLeft(clock.hours) : 0;
            const at = e.enrichment[0]?.at ?? e.feeding;
            p.set(at.x + 1.2, groundAt(at.x, at.z) + 0.4 * ice, at.z + 0.6);
            s.set(ice * 1.1, ice * 0.9, ice * 1.1);
            food.setMatrixAt(i * 2 + 1, m.compose(p, q.setFromAxisAngle(UP, i), s));
            food.setColorAt(i * 2 + 1, new Color("#cfe6f0"));
        });
        food.instanceMatrix.needsUpdate = true;
        if (food.instanceColor) food.instanceColor.needsUpdate = true;
    };
    return {
        group,
        update,
        stats: () => ({feeding}),
        dispose: () => {
            merged?.dispose();
            material.dispose();
            foodGeometry.dispose();
            foodMaterial.dispose();
            food.dispose();
        }
    };
}
