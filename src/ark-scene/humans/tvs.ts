/**
 * The TVs people watch at home in the evening (p5 (humans)): a flat screen on a low stand, drawn only while someone in
 * the room watches it (`town-humans.ts` frame's `tvs`), its picture a flicker of light pure in the shared clock and the
 * room (the same for every viewer). Two instanced draws (the set and its lit screen), ~40 triangles a TV.
 */

import {BoxGeometry, Color, Group, InstancedMesh, Matrix4, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, Quaternion, Vector3} from "three";
import {mergeGeometries} from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {humanUnit} from "@/ark-scene/humans/figures";
import type {Spot} from "@/ark-scene/humans/town-humans";

const MAX_TVS = 64;

/** The screen's colour at a moment: a slow scene change every few seconds and a quick flicker within it. */
export function screenColour(room: string, seconds: number, out: Color): Color {
    const shot = Math.floor(seconds / 4.5);
    const u = humanUnit(`${room}#${shot}`);
    const flick = 0.82 + 0.18 * Math.sin(seconds * 9.1 + u * 40) * Math.sin(seconds * 3.7 + u * 11);
    // Cool blues and whites mostly, a warm or green scene now and then.
    const hue = u < 0.6 ? [0.55, 0.68, 0.95] : u < 0.8 ? [0.9, 0.85, 0.75] : [0.5, 0.85, 0.6];
    return out.setRGB(hue[0] * flick * 1.6, hue[1] * flick * 1.6, hue[2] * flick * 1.6);
}

export class HumanTVs {
    readonly group = new Group();
    private readonly sets: InstancedMesh;
    private readonly screens: InstancedMesh;
    private readonly matrix = new Matrix4();
    private readonly q = new Quaternion();
    private readonly p = new Vector3();
    private readonly one = new Vector3(1, 1, 1);
    private readonly up = new Vector3(0, 1, 0);
    private readonly colour = new Color();

    constructor() {
        this.group.name = "humans:tvs";
        const set = new BoxGeometry(0.98, 0.6, 0.06).translate(0, 0.3, 0);
        const stand = new BoxGeometry(1.1, 0.42, 0.38).translate(0, -0.21, -0.02);
        this.sets = new InstancedMesh(mergeGeometries([set, stand])!, new MeshStandardMaterial({color: 0x17181a, roughness: 0.5}), MAX_TVS);
        // The screen faces the TV's front (+z), a hair in front of the set.
        this.screens = new InstancedMesh(new PlaneGeometry(0.9, 0.52).translate(0, 0.3, 0.032), new MeshBasicMaterial({color: 0xffffff, toneMapped: false}), MAX_TVS);
        for (const mesh of [this.sets, this.screens]) {
            mesh.count = 0;
            mesh.frustumCulled = false;
            this.group.add(mesh);
        }
        this.sets.castShadow = true;
    }

    /** The TVs on now (each the screen's foot: x, y = the stand's top, z, and the way the screen faces). */
    setFrame(tvs: ReadonlyArray<Spot & {room: string}>, seconds: number): void {
        const n = Math.min(tvs.length, MAX_TVS);
        for (let i = 0; i < n; i++) {
            const tv = tvs[i];
            this.q.setFromAxisAngle(this.up, tv.yaw);
            this.matrix.compose(this.p.set(tv.x, tv.y, tv.z), this.q, this.one);
            this.sets.setMatrixAt(i, this.matrix);
            this.screens.setMatrixAt(i, this.matrix);
            this.screens.setColorAt(i, screenColour(tv.room, seconds, this.colour));
        }
        for (const mesh of [this.sets, this.screens]) {
            mesh.count = n;
            mesh.visible = n > 0;
            mesh.instanceMatrix.needsUpdate = true;
        }
        if (this.screens.instanceColor) this.screens.instanceColor.needsUpdate = true;
    }

    dispose(): void {
        for (const mesh of [this.sets, this.screens]) {
            mesh.geometry.dispose();
            (mesh.material as MeshBasicMaterial).dispose();
        }
        this.group.removeFromParent();
    }
}
