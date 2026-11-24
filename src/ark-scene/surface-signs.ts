/**
 * Signs on the sea's surface of the real animals in it (SEA-SURFACE, 2026-11-24; the survey: from above, nothing
 * showed that anything lived in the sea). Drawn only where a real aboard animal really is at the surface, as its own
 * pose has it this frame; nothing is invented:
 *
 * - **Breaking the surface** (from under the water up to it: a turtle's or a seal's breath trip, a cormorant coming
 *   up from its dive, a manta rising to cruise at the top): rings spreading from where it came up and a short splash,
 *   or for an air-breather a short blow of spray as it breathes out.
 * - **Going down** (from the surface under it: the dive after a breath, a cormorant's surface dive): a ring.
 * - **Landing on the water and taking off from it** (a bird): a ring.
 * - **A wake**: a small Kelvin V behind one swimming at the surface (its back or its wings in the water and out),
 *   its length and strength with its speed: the manta cruising at the top, a swimming bird.
 *
 * A whale's blow is `ocean-shadows.ts`'s and a leap's rings are `water-leaps.ts`'s (not drawn twice here). Sea water
 * only (not the lake, the river or a pond), and only within `SIGN_RANGE` of the camera, from above (none from under the
 * sea). The tracking is pure (the tests run it in node); `SurfaceSignsView` draws it: two instanced meshes (the wakes,
 * the splashes and blows; two draw calls, transparent, after the sea's surface) at most `WAKE_MOST` + `SPLASH_MOST`
 * instances, and the rings through the scene's own ring marks. Visual only.
 */

import {BufferGeometry, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshLambertMaterial, Quaternion, Vector3, type Object3D} from "three";
import {plumeGeometry} from "@/ark-scene/ocean-shadows";
import {wakeGeometry} from "@/ark-scene/ocean-traffic-render";

/** How far from the camera the signs are drawn (m): a wide view over the sea is ~100–200 m from what it shows. */
export const SIGN_RANGE = 320;
/** The most wakes and splashes at once. */
export const WAKE_MOST = 24;
export const SPLASH_MOST = 24;
/** A swimmer faster than this (m/s) at the surface leaves a wake; full strength by `WAKE_FULL`. */
export const WAKE_FROM = 0.12;
export const WAKE_FULL = 0.7;
/** How long a splash, a blow and the rings last (s). */
export const SPLASH_SECONDS = 1.3;
export const BLOW_SECONDS = 1.7;
export const RING_SECONDS = 3;

/** Where a body is against the surface: wholly under it, in it (some of it out), wholly above it. */
export type SurfaceState = "under" | "at" | "air";

export function surfaceState(top: number, bottom: number, surface: number): SurfaceState {
    if (top < surface - 0.02) return "under";
    if (bottom > surface + 0.05) return "air";
    return "at";
}

export type SurfaceSample = {x: number; z: number; yaw: number; top: number; bottom: number; surface: number; length: number; breathes: boolean};
export type SignTrack = {state: SurfaceState; x: number; z: number; t: number; speed: number};
export type SignKind = "break" | "dive" | "land" | "lift";
export type SignEvent = {kind: SignKind; x: number; z: number; surface: number; size: number; start: number; blow: boolean};

/** A wake's strength (0…1) for a swimmer's speed at the surface. */
const wakeStrength = (speed: number) => Math.min(Math.max((speed - WAKE_FROM) / (WAKE_FULL - WAKE_FROM), 0), 1);

/**
 * One frame of one animal: its new track, what happened at the surface since the last frame (or null), and its wake's
 * strength now (0 none … 1). A gap of more than a second (it was not drawn, or out of range) starts it over: nothing
 * is told about what it did meanwhile.
 */
export function trackSurface(track: SignTrack | null, sample: SurfaceSample, t: number): {track: SignTrack; event: SignEvent | null; wake: number} {
    const state = surfaceState(sample.top, sample.bottom, sample.surface);
    const dt = track ? t - track.t : 0;
    // (A second look in the same frame keeps its track: its speed is over time, not between two looks at once.)
    if (track && dt <= 0 && dt > -1) return {track, event: null, wake: state === "at" ? wakeStrength(track.speed) : 0};
    if (!track || dt <= 0 || dt > 1) return {track: {state, x: sample.x, z: sample.z, t, speed: 0}, event: null, wake: 0};
    const moved = Math.hypot(sample.x - track.x, sample.z - track.z) / dt;
    // (Smoothed: a pose's small steps frame to frame are not a speed.)
    const speed = track.speed + (Math.min(moved, 12) - track.speed) * Math.min(dt * 4, 1);
    let kind: SignKind | null = null;
    if (track.state === "under" && state !== "under") kind = "break";
    else if (track.state !== "under" && state === "under") kind = "dive";
    else if (track.state === "air" && state === "at") kind = "land";
    else if (track.state === "at" && state === "air") kind = "lift";
    const event = kind ? {kind, x: sample.x, z: sample.z, surface: sample.surface, size: Math.max(sample.length, 0.3), start: t, blow: kind === "break" && sample.breathes} : null;
    const wake = state === "at" ? wakeStrength(speed) : 0;
    return {track: {state, x: sample.x, z: sample.z, t, speed}, event, wake};
}

/** An event's rings at `age` s: radius (m) and alpha of each (none once it is over). */
export function signRings(event: SignEvent, age: number): Array<{radius: number; alpha: number}> {
    if (age < 0 || age > RING_SECONDS) return [];
    const size = Math.min(event.size, 5);
    const rings = [{radius: size * (0.45 + age * (event.kind === "break" ? 0.9 : 0.7)), alpha: 0.9 * (1 - age / RING_SECONDS) ** 1.4}];
    if (event.kind === "break" && age > 0.45) rings.push({radius: size * (0.3 + (age - 0.45) * 0.65), alpha: 0.65 * (1 - (age - 0.45) / (RING_SECONDS - 0.45)) ** 1.4});
    return rings;
}

/** A splash's or a blow's height (m) at `age` s: up quickly, then falling and gone. 0 once over (or none for it). */
export function splashHeight(event: SignEvent, age: number): number {
    const seconds = event.blow ? BLOW_SECONDS : SPLASH_SECONDS;
    if (event.kind !== "break" || age < 0 || age > seconds) return 0;
    const top = event.blow ? Math.min(Math.max(event.size * 0.55, 0.35), 1.2) : Math.min(Math.max(event.size * 0.35, 0.2), 1.4);
    const up = Math.min(age / 0.25, 1);
    return top * up * (1 - (age / seconds) ** 2);
}

/** The wake's length behind it (m) for its body `length` and strength. */
export function wakeLength(length: number, strength: number): number {
    return Math.min(length * (1.4 + 1.4 * strength), 10);
}

// MARK: - Drawn

const fadeMaterial = (emissive: number, key: string) => {
    const material = new MeshLambertMaterial({vertexColors: true, emissive, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2});
    material.onBeforeCompile = (shader) => {
        shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nattribute float aFade;\nvarying float vFade;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvFade = aFade;");
        shader.fragmentShader = shader.fragmentShader.replace("#include <common>", "#include <common>\nvarying float vFade;").replace("#include <color_fragment>", "#include <color_fragment>\ndiffuseColor.a *= vFade;");
    };
    material.customProgramCacheKey = () => key;
    return material;
};

export class SurfaceSignsView {
    private readonly wakes: InstancedMesh;
    private readonly splashes: InstancedMesh;
    private readonly wakeFade: InstancedBufferAttribute;
    private readonly splashFade: InstancedBufferAttribute;
    private readonly tracks = new Map<string, SignTrack>();
    private events: SignEvent[] = [];
    private wakeCount = 0;
    private readonly matrix = new Matrix4();
    private readonly position = new Vector3();
    private readonly scale = new Vector3();
    private readonly quaternion = new Quaternion();
    private readonly up = new Vector3(0, 1, 0);
    private frame = 0;
    private readonly seen = new Map<string, number>();

    constructor(parent: Object3D) {
        const wake = wakeGeometry(false);
        this.wakeFade = new InstancedBufferAttribute(new Float32Array(WAKE_MOST), 1);
        wake.setAttribute("aFade", this.wakeFade);
        this.wakes = new InstancedMesh(wake, fadeMaterial(0x2a3034, "ark-surface-wakes"), WAKE_MOST);
        this.wakes.name = "surface-wakes";
        const plume: BufferGeometry = plumeGeometry();
        this.splashFade = new InstancedBufferAttribute(new Float32Array(SPLASH_MOST), 1);
        plume.setAttribute("aFade", this.splashFade);
        this.splashes = new InstancedMesh(plume, fadeMaterial(0x6a7076, "ark-surface-splashes"), SPLASH_MOST);
        this.splashes.name = "surface-splashes";
        for (const mesh of [this.wakes, this.splashes]) {
            mesh.count = 0;
            mesh.frustumCulled = false;
            mesh.visible = false;
            // (After the sea's surface, 2, as the boats' wakes.)
            mesh.renderOrder = 3;
            mesh.raycast = () => {};
            parent.add(mesh);
        }
    }

    begin(): void {
        this.wakeCount = 0;
        this.frame++;
    }

    /** One animal in the sea this frame (its pose's numbers), at `t` (epoch s). */
    sample(id: string, sample: SurfaceSample, t: number): void {
        // (Once a frame: a second pose of it this frame is not another sign.)
        if (this.seen.get(id) === this.frame) return;
        const result = trackSurface(this.tracks.get(id) ?? null, sample, t);
        this.tracks.set(id, result.track);
        this.seen.set(id, this.frame);
        if (result.event) {
            this.events.push(result.event);
            if (this.events.length > 64) this.events.shift();
        }
        if (result.wake > 0.02 && this.wakeCount < WAKE_MOST) {
            const length = wakeLength(sample.length, result.wake);
            // (From its head: the V's arms pass its sides, and a manta's wingtips, about a body length back.)
            const headX = sample.x + Math.sin(sample.yaw) * sample.length * 0.45;
            const headZ = sample.z + Math.cos(sample.yaw) * sample.length * 0.45;
            this.quaternion.setFromAxisAngle(this.up, sample.yaw);
            this.matrix.compose(this.position.set(headX, sample.surface + 0.04, headZ), this.quaternion, this.scale.set(length, 1, length));
            this.wakes.setMatrixAt(this.wakeCount, this.matrix);
            this.wakeFade.setX(this.wakeCount, 0.4 * result.wake);
            this.wakeCount++;
        }
    }

    /** Every live event's rings now, for the scene's ring marks. */
    rings(t: number, push: (x: number, y: number, z: number, radius: number, alpha: number) => void): void {
        for (const event of this.events) for (const ring of signRings(event, t - event.start)) push(event.x, event.surface + 0.03, event.z, ring.radius, ring.alpha);
    }

    /** Done for this frame: the splashes and blows drawn, the finished events and the tracks not seen dropped. */
    end(t: number, underwater: boolean): void {
        this.events = this.events.filter((event) => t - event.start <= RING_SECONDS && t >= event.start - 1);
        let splashes = 0;
        for (const event of this.events) {
            if (splashes >= SPLASH_MOST) break;
            const height = splashHeight(event, t - event.start);
            if (height <= 0.01) continue;
            this.quaternion.identity();
            this.matrix.compose(this.position.set(event.x, event.surface + 0.05, event.z), this.quaternion, this.scale.set(height * (event.blow ? 0.6 : 0.9), height, height * (event.blow ? 0.6 : 0.9)));
            this.splashes.setMatrixAt(splashes, this.matrix);
            this.splashFade.setX(splashes, event.blow ? 0.8 : 0.95);
            splashes++;
        }
        if (this.frame % 120 === 0) for (const [id, frame] of Array.from(this.seen)) if (this.frame - frame > 120) {
            this.seen.delete(id);
            this.tracks.delete(id);
        }
        this.wakes.count = this.wakeCount;
        this.wakes.visible = !underwater && this.wakeCount > 0;
        if (this.wakeCount) {
            this.wakes.instanceMatrix.needsUpdate = true;
            this.wakeFade.needsUpdate = true;
        }
        this.splashes.count = splashes;
        this.splashes.visible = !underwater && splashes > 0;
        if (splashes) {
            this.splashes.instanceMatrix.needsUpdate = true;
            this.splashFade.needsUpdate = true;
        }
    }

    dispose(): void {
        for (const mesh of [this.wakes, this.splashes]) {
            mesh.geometry.dispose();
            (mesh.material as MeshLambertMaterial).dispose();
            mesh.removeFromParent();
        }
    }
}
