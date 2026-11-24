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
 * - **A wake**: as one swims along the top (its back or its wings in the water and out: the manta cruising at the
 *   top, a swimming bird), a pair of faint soft dabs of disturbed water left every `TRAIL_EVERY` s at its sides (a
 *   manta's wingtips), each drifting outward and gone in `TRAIL_SECONDS`: together a short soft V that follows its
 *   own path (curving as it turns) and fades within a few body lengths.
 *
 * A whale's blow is `ocean-shadows.ts`'s and a leap's rings are `water-leaps.ts`'s (not drawn twice here). Sea water
 * only (not the lake, the river or a pond), and only within `SIGN_RANGE` of the camera, from above (none from under the
 * sea). The tracking is pure (the tests run it in node); `SurfaceSignsView` draws it: two instanced meshes (the splashes
 * and blows, the wakes' dabs; two draw calls, transparent, after the sea's surface) of at most `SPLASH_MOST` and
 * `DAB_MOST`, and the rings through the scene's own ring marks. Visual only.
 */

import {BufferAttribute, BufferGeometry, DoubleSide, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshLambertMaterial, Quaternion, Vector3, type Object3D} from "three";
import {plumeGeometry} from "@/ark-scene/ocean-shadows";

/** How far from the camera the signs are drawn (m): a wide view over the sea is ~100–200 m from what it shows. */
export const SIGN_RANGE = 320;
/** The most splashes at once, and the most live events (the wakes' rings among them). */
export const SPLASH_MOST = 24;
export const EVENTS_MOST = 200;
/** A wake's dabs: a pair every `TRAIL_EVERY` s, drifting outward at `TRAIL_SPREAD` m/s, gone in `TRAIL_SECONDS`. */
export const TRAIL_EVERY = 0.35;
export const TRAIL_SPREAD = 0.3;
export const TRAIL_SECONDS = 5;
export const DAB_MOST = 160;
/** A swimmer faster than this (m/s) at the surface leaves a wake; full strength by `WAKE_FULL`. */
export const WAKE_FROM = 0.12;
export const WAKE_FULL = 0.7;
/** How long a splash, a blow and the rings last (s). */
export const SPLASH_SECONDS = 1.3;
export const BLOW_SECONDS = 1.7;
export const RING_SECONDS = 3;

/** Where a body is against the surface: wholly under it, in it (some of it out), wholly above it. */
export type SurfaceState = "under" | "at" | "air";

export function surfaceState(top: number, bottom: number, surface: number, was: SurfaceState | null = null): SurfaceState {
    // (With a margin against the state it was in: a manta cruising with its wingtips at the very top, or a bird bobbing,
    // goes in and out by centimetres each frame; each was a "break" and a "dive", dozens of rings stacked in a second.)
    if (top < surface - (was === "under" ? 0.02 : 0.12)) return "under";
    if (bottom > surface + (was === "air" ? 0.05 : 0.15)) return "air";
    if (was === "under" && top < surface + 0.03) return "under";
    return "at";
}

export type SurfaceSample = {x: number; z: number; yaw: number; top: number; bottom: number; surface: number; length: number; breathes: boolean};
export type SignTrack = {state: SurfaceState; x: number; z: number; t: number; speed: number; told?: number};
/** The least time between one animal's surface events (s): one surfacing is one sign. */
export const EVENT_GAP = 2.5;
export type SignKind = "break" | "dive" | "land" | "lift" | "trail";
export type SignEvent = {kind: SignKind; x: number; z: number; surface: number; size: number; start: number; blow: boolean; strength?: number; yaw?: number};

/** A wake's strength (0…1) for a swimmer's speed at the surface. */
const wakeStrength = (speed: number) => Math.min(Math.max((speed - WAKE_FROM) / (WAKE_FULL - WAKE_FROM), 0), 1);

/**
 * One frame of one animal: its new track, what happened at the surface since the last frame (or null), and its wake's
 * strength now (0 none … 1). A gap of more than a second (it was not drawn, or out of range) starts it over: nothing
 * is told about what it did meanwhile.
 */
export function trackSurface(track: SignTrack | null, sample: SurfaceSample, t: number): {track: SignTrack; event: SignEvent | null; wake: number} {
    const state = surfaceState(sample.top, sample.bottom, sample.surface, track?.state ?? null);
    const dt = track ? t - track.t : 0;
    // (A second look in the same frame keeps its track: its speed is over time, not between two looks at once.)
    if (track && dt <= 0 && dt > -1) return {track, event: null, wake: state === "at" ? wakeStrength(track.speed) : 0};
    if (!track || dt <= 0 || dt > 1) return {track: {state, x: sample.x, z: sample.z, t, speed: 0, told: track?.told}, event: null, wake: 0};
    const moved = Math.hypot(sample.x - track.x, sample.z - track.z) / dt;
    // (Smoothed: a pose's small steps frame to frame are not a speed.)
    const speed = track.speed + (Math.min(moved, 12) - track.speed) * Math.min(dt * 4, 1);
    let kind: SignKind | null = null;
    if (track.state === "under" && state !== "under") kind = "break";
    else if (track.state !== "under" && state === "under") kind = "dive";
    else if (track.state === "air" && state === "at") kind = "land";
    else if (track.state === "at" && state === "air") kind = "lift";
    // (One surfacing, one sign: none again within EVENT_GAP s of its last.)
    if (kind && track.told !== undefined && t - track.told < EVENT_GAP) kind = null;
    const event = kind ? {kind, x: sample.x, z: sample.z, surface: sample.surface, size: Math.max(sample.length, 0.3), start: t, blow: kind === "break" && sample.breathes} : null;
    const wake = state === "at" ? wakeStrength(speed) : 0;
    return {track: {state, x: sample.x, z: sample.z, t, speed, told: event ? t : track.told}, event, wake};
}

/** An event's rings at `age` s: radius (m) and alpha of each (none once it is over). */
export function signRings(event: SignEvent, age: number): Array<{radius: number; alpha: number}> {
    if (event.kind === "trail") return [];
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

/**
 * A wake's pair of dabs at `age` s (faint each: a dozen overlap along its path): how far out to each side of where it was (m), how wide (m) and how strong (alpha).
 * None once gone. From about its sides (a third of its length), drifting out and widening, faint and fading.
 */
export function trailDab(event: SignEvent, age: number): {side: number; radius: number; alpha: number} | null {
    if (event.kind !== "trail" || age < 0 || age > TRAIL_SECONDS) return null;
    const size = Math.min(event.size, 5);
    const u = age / TRAIL_SECONDS;
    return {side: size * 0.32 + TRAIL_SPREAD * age, radius: size * 0.1 * (1 + age * 0.3), alpha: 0.09 * (event.strength ?? 1) * (1 - u) ** 2 * Math.min(age / 0.4, 1)};
}

/** A soft dab, 1 m across: white, its alpha falling from its middle to nothing at its rim. Normals up. */
export function dabGeometry(): BufferGeometry {
    const pos: number[] = [];
    const col: number[] = [];
    const n = 12;
    for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2;
        const a1 = ((i + 1) / n) * Math.PI * 2;
        pos.push(0, 0, 0, Math.cos(a1) * 0.5, 0, Math.sin(a1) * 0.5, Math.cos(a0) * 0.5, 0, Math.sin(a0) * 0.5);
        col.push(1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0);
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
    geometry.setAttribute("color", new BufferAttribute(new Float32Array(col), 4));
    geometry.setAttribute("normal", new BufferAttribute(new Float32Array(pos.length).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    geometry.computeBoundingSphere();
    return geometry;
}

/** How long an event is live (s). */
export const eventSeconds = (event: SignEvent) => (event.kind === "trail" ? TRAIL_SECONDS : RING_SECONDS);

// MARK: - Drawn

const fadeMaterial = (emissive: number, key: string) => {
    const material = new MeshLambertMaterial({vertexColors: true, emissive, side: DoubleSide, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2});
    material.onBeforeCompile = (shader) => {
        shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nattribute float aFade;\nvarying float vFade;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvFade = aFade;");
        shader.fragmentShader = shader.fragmentShader.replace("#include <common>", "#include <common>\nvarying float vFade;").replace("#include <color_fragment>", "#include <color_fragment>\ndiffuseColor.a *= vFade;");
    };
    material.customProgramCacheKey = () => key;
    return material;
};

export class SurfaceSignsView {
    private readonly splashes: InstancedMesh;
    private readonly dabs: InstancedMesh;
    private readonly dabFade: InstancedBufferAttribute;
    private readonly splashFade: InstancedBufferAttribute;
    private readonly tracks = new Map<string, SignTrack>();
    private events: SignEvent[] = [];
    private readonly trailAt = new Map<string, number>();
    private readonly matrix = new Matrix4();
    private readonly position = new Vector3();
    private readonly scale = new Vector3();
    private readonly quaternion = new Quaternion();
    private frame = 0;
    private readonly seen = new Map<string, number>();

    constructor(parent: Object3D) {
        const plume: BufferGeometry = plumeGeometry();
        this.splashFade = new InstancedBufferAttribute(new Float32Array(SPLASH_MOST), 1);
        plume.setAttribute("aFade", this.splashFade);
        this.splashes = new InstancedMesh(plume, fadeMaterial(0x6a7076, "ark-surface-splashes"), SPLASH_MOST);
        this.splashes.name = "surface-splashes";
        const dab = dabGeometry();
        this.dabFade = new InstancedBufferAttribute(new Float32Array(DAB_MOST), 1);
        dab.setAttribute("aFade", this.dabFade);
        this.dabs = new InstancedMesh(dab, fadeMaterial(0x4a5056, "ark-surface-dabs"), DAB_MOST);
        this.dabs.name = "surface-wakes";
        for (const mesh of [this.splashes, this.dabs]) {
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
        this.frame++;
    }

    /** One animal in the sea this frame (its pose's numbers), at `t` (epoch s). */
    sample(id: string, sample: SurfaceSample, t: number): void {
        // (Once a frame: a second pose of it this frame is not another sign.)
        if (this.seen.get(id) === this.frame) return;
        const result = trackSurface(this.tracks.get(id) ?? null, sample, t);
        this.tracks.set(id, result.track);
        this.seen.set(id, this.frame);
        if (result.event) this.push(result.event);
        // (Its wake: a ring where it is now, every TRAIL_EVERY s while it swims along the top.)
        if (result.wake > 0.05 && t - (this.trailAt.get(id) ?? -1e9) >= TRAIL_EVERY) {
            this.trailAt.set(id, t);
            this.push({kind: "trail", x: sample.x, z: sample.z, surface: sample.surface, size: Math.max(sample.length, 0.3), start: t, blow: false, strength: result.wake, yaw: sample.yaw});
        }
    }

    private push(event: SignEvent): void {
        this.events.push(event);
        if (this.events.length > EVENTS_MOST) this.events.shift();
    }

    /** Every live event's rings now, for the scene's ring marks. */
    rings(t: number, push: (x: number, y: number, z: number, radius: number, alpha: number) => void): void {
        for (const event of this.events) for (const ring of signRings(event, t - event.start)) push(event.x, event.surface + 0.03, event.z, ring.radius, ring.alpha);
    }

    /** Done for this frame: the splashes and blows drawn, the finished events and the tracks not seen dropped. */
    end(t: number, underwater: boolean): void {
        this.events = this.events.filter((event) => t - event.start <= eventSeconds(event) && t >= event.start - 1);
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
        let dabs = 0;
        for (const event of this.events) {
            const dab = trailDab(event, t - event.start);
            if (!dab || dab.alpha <= 0.005) continue;
            // (Its sides: across its heading then.)
            const yaw = event.yaw ?? 0;
            for (const side of [-1, 1]) {
                if (dabs >= DAB_MOST) break;
                this.quaternion.identity();
                const x = event.x + Math.cos(yaw) * dab.side * side;
                const z = event.z - Math.sin(yaw) * dab.side * side;
                this.matrix.compose(this.position.set(x, event.surface + 0.04, z), this.quaternion, this.scale.set(dab.radius * 2, 1, dab.radius * 2));
                this.dabs.setMatrixAt(dabs, this.matrix);
                this.dabFade.setX(dabs, dab.alpha);
                dabs++;
            }
        }
        this.dabs.count = dabs;
        this.dabs.visible = !underwater && dabs > 0;
        if (dabs) {
            this.dabs.instanceMatrix.needsUpdate = true;
            this.dabFade.needsUpdate = true;
        }
        if (this.frame % 120 === 0) for (const [id, frame] of Array.from(this.seen)) if (this.frame - frame > 120) {
            this.seen.delete(id);
            this.tracks.delete(id);
            this.trailAt.delete(id);
        }
        this.splashes.count = splashes;
        this.splashes.visible = !underwater && splashes > 0;
        if (splashes) {
            this.splashes.instanceMatrix.needsUpdate = true;
            this.splashFade.needsUpdate = true;
        }
    }

    dispose(): void {
        for (const mesh of [this.splashes, this.dabs]) {
            mesh.geometry.dispose();
            (mesh.material as MeshLambertMaterial).dispose();
            mesh.removeFromParent();
        }
    }
}
