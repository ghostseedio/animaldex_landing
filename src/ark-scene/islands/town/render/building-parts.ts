/**
 * The parts of a town building that stick out of its footprint (a bay window, a porch, a door step, a shop's awning,
 * a tower's balconies, the eaves), as boxes, for the camera (`scene.ts` cameraObstacles).
 *
 * The building's footprint box alone kept the user's eye 0.35 m off its walls, but a home's bay stands 0.8 m out from
 * its front: orbiting low by a garden, the eye came to rest inside the bay, the view filled with its grey sides seen
 * from within. So the parts are not described a second time here: the building is drawn again exactly as
 * `buildBuilding` draws it, into a Geo that keeps no triangles, only the box each part it draws (one call of `box`,
 * `gable`, `cylinder`, `quad`...) spans in the building's own frame. A part the drawing code adds or moves is then in
 * the camera's obstacles too: the two cannot drift apart.
 */
import {buildBuilding, newBuildingChunk} from "@/ark-scene/islands/town/render/buildings";
import {Geo, NullGeo, type V3} from "@/ark-scene/islands/town/render/kit";
import {townPlan, type Building} from "@/ark-scene/islands/town/plan";
import {townHeight} from "@/ark-scene/islands/town/ground";
import type {CameraObstacle} from "@/ark-scene/runtime/camera";

/** A part's box in the town's own coordinates, turned as its building is (`rot`): the footprint's convention. */
export type BuildingPart = {x: number; z: number; y0: number; y1: number; hx: number; hz: number; rot: number};

/** How far past the footprint a part must reach to be kept (m): under the camera's close-up margin (0.06). */
export const PART_OUT = 0.3;

/** The primitives a building is drawn with: one call at the top level is one part. */
const PRIMITIVES = ["box", "gable", "hip", "pyramid", "cylinder", "blob", "quad", "tri"] as const;

/** A Geo that draws nothing and records, per top-level primitive call, the box it spans in the building's frame. */
class PartRecorder extends NullGeo {
    /** Per part: min x, max x, min y, max y, min z, max z (building frame: x along the front, z out of it). */
    readonly boxes: number[] = [];
    private depth = 0;
    private box6 = [0, 0, 0, 0, 0, 0];
    private ox = 0;
    private oz = 0;
    private cos = 1;
    private sin = 0;

    constructor() {
        super();
        for (const name of PRIMITIVES) {
            const draw = (Geo.prototype as unknown as Record<string, (...args: unknown[]) => void>)[name];
            (this as unknown as Record<string, (...args: unknown[]) => void>)[name] = (...args: unknown[]) => {
                if (this.depth === 0) this.box6 = [Infinity, -Infinity, Infinity, -Infinity, Infinity, -Infinity];
                this.depth++;
                try {
                    if (name === "tri") this.take(args[0] as V3, args[1] as V3, args[2] as V3);
                    else draw.apply(this, args);
                } finally {
                    this.depth--;
                }
                if (this.depth === 0 && this.box6[0] <= this.box6[1]) this.boxes.push(...this.box6);
            };
        }
    }

    /** The building's frame: its footprint's middle and turn. */
    frame(x: number, z: number, rot: number) {
        this.ox = x;
        this.oz = z;
        this.cos = Math.cos(rot);
        this.sin = Math.sin(rot);
    }

    private take(p0: V3, p1: V3, p2: V3) {
        const b = this.box6;
        for (let k = 0; k < 3; k++) {
            const p = k === 0 ? p0 : k === 1 ? p1 : p2;
            // (kit `at` inverted: world to the building's frame.)
            const dx = p[0] - this.ox;
            const dz = p[2] - this.oz;
            const lx = dx * this.cos + dz * this.sin;
            const lz = -dx * this.sin + dz * this.cos;
            if (lx < b[0]) b[0] = lx;
            if (lx > b[1]) b[1] = lx;
            if (p[1] < b[2]) b[2] = p[1];
            if (p[1] > b[3]) b[3] = p[1];
            if (lz < b[4]) b[4] = lz;
            if (lz > b[5]) b[5] = lz;
        }
    }
}

/**
 * Every part `buildBuilding` draws for `b`, as the box it spans in the building's frame (min x, max x, min y, max y,
 * min z, max z; x along the front, z out of it, y the town's height).
 */
export function drawnParts(b: Building): number[][] {
    const recorder = new PartRecorder();
    recorder.frame(b.at.x, b.at.z, b.at.rot);
    // The solid, the glass (a shopfront, a bay's panes) and the near detail (a door's panels) all into the recorder.
    const chunk = newBuildingChunk({solid: recorder, glass: recorder}, recorder);
    chunk.panes = new NullGeo();
    buildBuilding(chunk, b);
    const list = recorder.boxes;
    const boxes: number[][] = [];
    for (let i = 0; i < list.length; i += 6) boxes.push(list.slice(i, i + 6));
    return boxes;
}

/** A building as the camera has it: its body's top (the drawn roof, town height) and the parts out of the body. */
export type BuildingCamera = {
    id: string;
    top: number;
    /** The body's plan in its frame (min x, max x, min z, max z): the footprint and all drawn within `PART_OUT` of it (the eaves' overhang). */
    body: [number, number, number, number];
    parts: BuildingPart[];
};

/**
 * `b` for the camera, from its drawing: the body's plan (`body`) and top is the highest of the parts that cover half its footprint or
 * more (its roof: the plan's `top` is over its centre's ground, under the roof on a slope), at least the plan's; the
 * parts are those that reach more than `PART_OUT` past the footprint, or over that top (a chimney), merged
 * (`mergeParts`), each a box in the building's own turn (town coordinates, heights).
 */
export function buildingCamera(b: Building): BuildingCamera {
    const drawn = drawnParts(b);
    const area = b.at.w * b.at.d;
    let top = townHeight(b.at.x, b.at.z) + b.top;
    for (const k of drawn) if ((k[1] - k[0]) * (k[5] - k[4]) >= area * 0.5) top = Math.max(top, k[3]);
    const hw = b.at.w / 2 + PART_OUT;
    const hd = b.at.d / 2 + PART_OUT;
    const isBody = (q: number[]) => q[0] >= -hw && q[1] <= hw && q[4] >= -hd && q[5] <= hd && q[3] <= top + PART_OUT;
    const out = drawn.filter((q) => !isBody(q));
    // (The body as drawn: an eave 0.3 m over the wall hides what is behind it as the wall does.)
    const body: [number, number, number, number] = [-b.at.w / 2, b.at.w / 2, -b.at.d / 2, b.at.d / 2];
    for (const q of drawn) if (isBody(q)) [body[0], body[1], body[2], body[3]] = [Math.min(body[0], q[0]), Math.max(body[1], q[1]), Math.min(body[2], q[4]), Math.max(body[3], q[5])];
    const cos = Math.cos(b.at.rot);
    const sin = Math.sin(b.at.rot);
    const parts = mergeParts(out).map(([x0, x1, y0, y1, z0, z1]) => {
        const mx = (x0 + x1) / 2;
        const mz = (z0 + z1) / 2;
        return {x: b.at.x + mx * cos - mz * sin, z: b.at.z + mx * sin + mz * cos, y0, y1, hx: (x1 - x0) / 2, hz: (z1 - z0) / 2, rot: b.at.rot};
    });
    return {id: b.id, top, body, parts};
}

/** `b`'s parts out of its body (`buildingCamera`). */
export function buildingParts(b: Building): BuildingPart[] {
    return buildingCamera(b).parts;
}

/**
 * Fewer boxes keeping the eye out of the same parts (each box is a camera obstacle every frame near it):
 * - a part within `PART_OUT` of a bigger kept one (a bay's window frame on the bay, a balcony's rail on its slab) is
 *   taken into it (the bigger box grows to cover it);
 * - parts stacked one over another, one's plan within the other's (a tower's bays or a block's balconies, storey on
 *   storey, the top one's rail), become one box from the lowest to the highest, when the gap between them is under a
 *   storey.
 * (Boxes: min x, max x, min y, max y, min z, max z, in the building's frame.)
 */
export function mergeParts(boxes: number[][]): number[][] {
    const E = PART_OUT;
    const volume = (q: number[]) => (q[1] - q[0]) * (q[3] - q[2]) * (q[5] - q[4]);
    const within = (q: number[], k: number[]) => q[0] >= k[0] - E && q[1] <= k[1] + E && q[2] >= k[2] - E && q[3] <= k[3] + E && q[4] >= k[4] - E && q[5] <= k[5] + E;
    const prune = (list: number[][]) => {
        const kept: number[][] = [];
        for (const q of [...list].sort((a, c) => volume(c) - volume(a))) {
            const k = kept.find((box) => within(q, box));
            if (!k) kept.push([...q]);
            // (Taken into it, so the box still covers all it stands for: a bay's own little roof, a hand's breadth over it,
            // hides what is behind it.)
            else for (let i = 0; i < 6; i++) k[i] = i % 2 === 0 ? Math.min(k[i], q[i]) : Math.max(k[i], q[i]);
        }
        return kept;
    };
    let list = prune(boxes);
    for (let changed = true; changed; ) {
        changed = false;
        for (let i = 0; i < list.length && !changed; i++) {
            for (let j = i + 1; j < list.length; j++) {
                const a = list[i];
                const c = list[j];
                const onPlan = (q: number[], k: number[]) => q[0] >= k[0] - E && q[1] <= k[1] + E && q[4] >= k[4] - E && q[5] <= k[5] + E;
                const samePlan = onPlan(a, c) || onPlan(c, a);
                const gap = Math.max(a[2], c[2]) - Math.min(a[3], c[3]);
                if (!samePlan || gap > STOREY_GAP) continue;
                const union = [Math.min(a[0], c[0]), Math.max(a[1], c[1]), Math.min(a[2], c[2]), Math.max(a[3], c[3]), Math.min(a[4], c[4]), Math.max(a[5], c[5])];
                list = prune([...list.filter((_, k) => k !== i && k !== j), union]);
                changed = true;
                break;
            }
        }
    }
    return list;
}

/** The widest gap (m) between two parts stacked on one plan that are still taken as one (a storey's height). */
const STOREY_GAP = 3.6;

/** The buildings the camera keeps out of (`scene.ts` cameraObstacles: those over 1.2 m; lower, its height over the ground does). */
export function cameraBuildings(): Building[] {
    return townPlan().buildings.filter((building) => building.top > 1.2);
}

/** Every camera building for the camera (the town's prebuild worker works them out, `prebuild-worker.ts`; else the page). */
export function townBuildingCamera(): BuildingCamera[] {
    return cameraBuildings().map((building) => buildingCamera(building));
}

/**
 * The camera's boxes for the town's buildings, in the world (`origin`: the town's): each body from a metre under its
 * ground (`heightAt`, the town's own coordinates) to its drawn top, side-by-side bodies joined (`joinedFootprints`),
 * and each part (`cameras`: the prebuild's, else worked out now). All `sight`: the eye comes through toward what it
 * looks at (`camera.ts` collideCamera).
 */
export function buildingCameraBoxes(origin: {x: number; z: number}, heightAt: (x: number, z: number) => number, cameras: BuildingCamera[] = townBuildingCamera()): CameraObstacle[] {
    const byId = new Map(cameras.map((c) => [c.id, c]));
    const footprints = joinedFootprints(
        cameraBuildings().map((building) => {
            const ground = heightAt(building.at.x, building.at.z);
            const camera = byId.get(building.id);
            const [x0, x1, z0, z1] = camera?.body ?? [-building.at.w / 2, building.at.w / 2, -building.at.d / 2, building.at.d / 2];
            const mx = (x0 + x1) / 2;
            const mz = (z0 + z1) / 2;
            const cos = Math.cos(building.at.rot);
            const sin = Math.sin(building.at.rot);
            return {x: building.at.x + mx * cos - mz * sin, z: building.at.z + mx * sin + mz * cos, y0: ground - 1, y1: Math.max(ground + building.top, camera?.top ?? -Infinity), hx: (x1 - x0) / 2, hz: (z1 - z0) / 2, rot: building.at.rot};
        })
    );
    const boxes: CameraObstacle[] = footprints.map((f) => ({kind: "box", x: origin.x + f.x, z: origin.z + f.z, y0: f.y0, y1: f.y1, hx: f.hx, hz: f.hz, rotation: -f.rot, sight: true}));
    for (const camera of cameras) for (const part of camera.parts) boxes.push({kind: "box", x: origin.x + part.x, z: origin.z + part.z, y0: part.y0, y1: part.y1, hx: part.hx, hz: part.hz, rotation: -part.rot, sight: true});
    return boxes;
}

/**
 * Footprints side by side, turned alike and about as deep (a pair of semi-detached houses, a row of terraced homes), as
 * one box (the notch where one is shallower filled): two boxes touching at a party wall pushed the eye to and fro across it, each out of itself into the other's
 * margin, and it came to rest in the wall.
 */
export function joinedFootprints(list: BuildingPart[]): BuildingPart[] {
    const boxes = list.map((f) => ({...f}));
    const GAP = 0.7;
    for (let joined = true; joined; ) {
        joined = false;
        for (let i = 0; i < boxes.length && !joined; i++) {
            for (let j = i + 1; j < boxes.length; j++) {
                const a = boxes[i];
                const c = boxes[j];
                const turn = Math.abs(Math.sin(c.rot - a.rot));
                if (turn > 1e-3) continue;
                // `c` in `a`'s frame (along its x, out of its z); flipped (turned half round) the same box.
                const cos = Math.cos(a.rot);
                const sin = Math.sin(a.rot);
                const dx = c.x - a.x;
                const dz = c.z - a.z;
                const lx = dx * cos + dz * sin;
                const lz = -dx * sin + dz * cos;
                // Side by side (a gap under GAP), their fronts and backs mostly level (sharing four fifths of the shallower).
                const share = (l: number, ha: number, hc: number) => Math.min(ha, l + hc) - Math.max(-ha, l - hc) >= 1.6 * Math.min(ha, hc);
                const alongX = share(lz, a.hz, c.hz) && Math.abs(lx) - (a.hx + c.hx) < GAP;
                const alongZ = share(lx, a.hx, c.hx) && Math.abs(lz) - (a.hz + c.hz) < GAP;
                if (!alongX && !alongZ) continue;
                const x0 = Math.min(-a.hx, lx - c.hx);
                const x1 = Math.max(a.hx, lx + c.hx);
                const z0 = Math.min(-a.hz, lz - c.hz);
                const z1 = Math.max(a.hz, lz + c.hz);
                const mx = (x0 + x1) / 2;
                const mz = (z0 + z1) / 2;
                boxes[i] = {x: a.x + mx * cos - mz * sin, z: a.z + mx * sin + mz * cos, y0: Math.min(a.y0, c.y0), y1: Math.max(a.y1, c.y1), hx: (x1 - x0) / 2, hz: (z1 - z0) / 2, rot: a.rot};
                boxes.splice(j, 1);
                joined = true;
                break;
            }
        }
    }
    return boxes;
}
