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
 * sea). The tracking is pure (the tests run it in node); `SurfaceSignsView` draws it: three instanced meshes (the soft
 * puffs of the splashes and blows, the wakes' dabs, the thin uneven water rings; three draw calls, transparent, after
 * the sea's surface) of at most `SPLASH_MOST`, `DAB_MOST` and `RING_MOST`. Not the scene's ring marks: those are
 * crisp bright selection-style rings; these are water. Visual only.
 */

import {BufferAttribute, BufferGeometry, DoubleSide, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshLambertMaterial, Quaternion, Vector3, type Object3D} from "three";

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
export const SPLASH_SECONDS = 0.9;
export const BLOW_SECONDS = 1.3;
export const RING_SECONDS = 2;
/** The most rings drawn at once. */
export const RING_MOST = 48;

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

/**
 * `shallow`: how far under the surface its top may be and still count as at it (m; 0 by default). A cruiser (the manta,
 * `surface-cruise.ts`) swims with its highest point just under the water, wholly hidden, and its wings still push the
 * water into a wake above it.
 */
export type SurfaceSample = {x: number; z: number; yaw: number; top: number; bottom: number; surface: number; length: number; breathes: boolean; shallow?: number};
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
    const state = surfaceState(sample.top + (sample.shallow ?? 0), sample.bottom, sample.surface, track?.state ?? null);
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
    // (Faint water rings, not marks: thin, uneven, widening and gone in RING_SECONDS.)
    const rings = [{radius: size * (0.4 + age * (event.kind === "break" ? 0.8 : 0.6)), alpha: 0.4 * (1 - age / RING_SECONDS) ** 1.5}];
    if (event.kind === "break" && age > 0.3) rings.push({radius: size * (0.3 + (age - 0.3) * 0.55), alpha: 0.28 * (1 - (age - 0.3) / (RING_SECONDS - 0.3)) ** 1.5});
    return rings;
}

/**
 * A splash's or a blow's puff at `age` s: its size (m across, soft), how high its middle has risen (m) and its alpha.
 * Null once over (or none for it). A soft brief puff of mist that swells, rises a little and thins away; not a spike.
 */
export function splashPuff(event: SignEvent, age: number): {size: number; rise: number; alpha: number} | null {
    const seconds = event.blow ? BLOW_SECONDS : SPLASH_SECONDS;
    if (event.kind !== "break" || age < 0 || age > seconds) return null;
    const full = event.blow ? Math.min(Math.max(event.size * 0.6, 0.4), 1.4) : Math.min(Math.max(event.size * 0.45, 0.25), 1.4);
    const u = age / seconds;
    const swell = 1 - (1 - Math.min(age / 0.35, 1)) ** 2;
    return {size: full * (0.35 + 0.65 * swell), rise: full * (0.25 + 0.35 * u), alpha: (event.blow ? 0.45 : 0.55) * Math.min(age / 0.1, 1) * (1 - u) ** 1.6};
}

/** A soft puff, 1 m across, its middle at y = 0: three crossed upright discs, white, clear at their rims. Normals up. */
export function puffGeometry(): BufferGeometry {
    const pos: number[] = [];
    const col: number[] = [];
    const n = 12;
    for (let k = 0; k < 3; k++) {
        const turn = (k / 3) * Math.PI;
        const ax = Math.cos(turn);
        const az = Math.sin(turn);
        for (let i = 0; i < n; i++) {
            const a0 = (i / n) * Math.PI * 2;
            const a1 = ((i + 1) / n) * Math.PI * 2;
            pos.push(0, 0, 0, ax * Math.cos(a0) * 0.5, Math.sin(a0) * 0.5, az * Math.cos(a0) * 0.5, ax * Math.cos(a1) * 0.5, Math.sin(a1) * 0.5, az * Math.cos(a1) * 0.5);
            col.push(1, 1, 1, 0.7, 1, 1, 1, 0, 1, 1, 1, 0);
        }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
    geometry.setAttribute("color", new BufferAttribute(new Float32Array(col), 4));
    geometry.setAttribute("normal", new BufferAttribute(new Float32Array(pos.length).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    geometry.computeBoundingSphere();
    return geometry;
}

/**
 * A water ring, radius 1 m, flat: a thin band soft at both edges, uneven along its round (stronger and fainter
 * stretches, a gap or two), pale. Scaled by its radius; a different turn each so no two look the same.
 */
export function ringGeometry(): BufferGeometry {
    const pos: number[] = [];
    const col: number[] = [];
    const n = 64;
    const band = [0.955, 0.985, 1.015, 1.045];
    const soft = [0, 1, 1, 0];
    const along = (a: number) => Math.max(0, Math.min(1, 0.55 + 0.45 * Math.sin(a * 3 + 0.7) * Math.cos(a * 5 + 1.9) + 0.25 * Math.sin(a * 11)));
    for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2;
        const a1 = ((i + 1) / n) * Math.PI * 2;
        for (let j = 0; j < band.length - 1; j++) {
            const v = (a: number, k: number) => {
                pos.push(Math.cos(a) * band[k], 0, Math.sin(a) * band[k]);
                col.push(0.86, 0.93, 0.96, soft[k] * along(a));
            };
            v(a0, j), v(a1, j), v(a1, j + 1), v(a0, j), v(a1, j + 1), v(a0, j + 1);
        }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
    geometry.setAttribute("color", new BufferAttribute(new Float32Array(col), 4));
    geometry.setAttribute("normal", new BufferAttribute(new Float32Array(pos.length).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    geometry.computeBoundingSphere();
    return geometry;
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

const UP = new Vector3(0, 1, 0);

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
    private readonly rings: InstancedMesh;
    private readonly ringFade: InstancedBufferAttribute;
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
        const puff: BufferGeometry = puffGeometry();
        this.splashFade = new InstancedBufferAttribute(new Float32Array(SPLASH_MOST), 1);
        puff.setAttribute("aFade", this.splashFade);
        this.splashes = new InstancedMesh(puff, fadeMaterial(0x7a8086, "ark-surface-splashes"), SPLASH_MOST);
        this.splashes.name = "surface-splashes";
        const ring = ringGeometry();
        this.ringFade = new InstancedBufferAttribute(new Float32Array(RING_MOST), 1);
        ring.setAttribute("aFade", this.ringFade);
        this.rings = new InstancedMesh(ring, fadeMaterial(0x5a6066, "ark-surface-rings"), RING_MOST);
        this.rings.name = "surface-rings";
        const dab = dabGeometry();
        this.dabFade = new InstancedBufferAttribute(new Float32Array(DAB_MOST), 1);
        dab.setAttribute("aFade", this.dabFade);
        this.dabs = new InstancedMesh(dab, fadeMaterial(0x4a5056, "ark-surface-dabs"), DAB_MOST);
        this.dabs.name = "surface-wakes";
        for (const mesh of [this.splashes, this.dabs, this.rings]) {
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


    /** Done for this frame: the splashes and blows drawn, the finished events and the tracks not seen dropped. */
    end(t: number, underwater: boolean): void {
        this.events = this.events.filter((event) => t - event.start <= eventSeconds(event) && t >= event.start - 1);
        let splashes = 0;
        let rings = 0;
        for (const event of this.events) {
            const age = t - event.start;
            const puff = splashes < SPLASH_MOST ? splashPuff(event, age) : null;
            if (puff && puff.alpha > 0.005) {
                this.quaternion.identity();
                this.matrix.compose(this.position.set(event.x, event.surface + puff.rise, event.z), this.quaternion, this.scale.set(puff.size, puff.size * 0.8, puff.size));
                this.splashes.setMatrixAt(splashes, this.matrix);
                this.splashFade.setX(splashes, puff.alpha);
                splashes++;
            }
            // (Each event's rings turned its own way: the unevenness of one is not the next one's.)
            const turn = (event.start * 7.3 + event.x) % (Math.PI * 2);
            for (const ring of signRings(event, age)) {
                if (rings >= RING_MOST || ring.alpha <= 0.005) continue;
                this.quaternion.setFromAxisAngle(UP, turn + ring.radius * 0.3);
                this.matrix.compose(this.position.set(event.x, event.surface + 0.035, event.z), this.quaternion, this.scale.set(ring.radius, 1, ring.radius));
                this.rings.setMatrixAt(rings, this.matrix);
                this.ringFade.setX(rings, ring.alpha);
                rings++;
            }
        }
        this.rings.count = rings;
        this.rings.visible = !underwater && rings > 0;
        if (rings) {
            this.rings.instanceMatrix.needsUpdate = true;
            this.ringFade.needsUpdate = true;
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
        for (const mesh of [this.splashes, this.dabs, this.rings]) {
            mesh.geometry.dispose();
            (mesh.material as MeshLambertMaterial).dispose();
            mesh.removeFromParent();
        }
    }
}
