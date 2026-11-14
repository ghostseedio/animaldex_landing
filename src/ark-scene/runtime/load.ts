/**
 * Progressive loading (runtime lane, docs/ark/runtime.md).
 *
 * - **Order:** the model queue (`models.ts`) takes the next species by
 *   where the camera is: animals in view and close first, then in view and
 *   far, then out of view, then those not seen at all (micro species not yet
 *   drawn, the deep, the underground) last. Re-ranked each time a load ends,
 *   so a turn of the camera changes what comes next.
 * - **Pace:** a finished model is handed to the scene (and its skin uploaded
 *   to the GPU) a few at a time per frame, inside a small time budget, so a
 *   burst of loads never stalls a frame.
 * - **First frame:** the scene's shaders are compiled in parallel
 *   (`compileAsync`, KHR_parallel_shader_compile) before the first draw,
 *   instead of blocking the first frame's first use of each.
 */

import type {Camera, Object3D, WebGLRenderer} from "three";

type Sighting = {distance: number; visible: boolean; frame: number};

/** Seen within this many frames counts as seen now. */
const FRESH_FRAMES = 30;
/** Out of view weighs this many times its distance. */
const OUT_OF_VIEW = 3;
/** Never seen (or not for a while): after everything that is. */
const UNSEEN = 1e6;

export class LoadPlanner {
    private frame = 0;
    private readonly seen = new Map<string, Sighting>();
    /** Kinds the reader chose (a flight to one has begun), each until a frame number: first in the queue meanwhile. */
    private readonly wanted = new Map<string, number>();

    /**
     * The reader chose this kind (selected one of its animals; the camera is on its way): its levels load before
     * everything else for the next `frames` drawn frames. The load order went by distance to the camera alone, so
     * at the start of a flight from the island view the kind flown to ranked behind every kind near where the camera
     * still was, and its near model was only asked for when the camera came within the near distance at the flight's
     * end.
     */
    want(slug: string, frames = 600) {
        this.wanted.set(slug, this.frame + frames);
    }

    /** Chosen by the reader lately (`want`). */
    isWanted(slug: string): boolean {
        const until = this.wanted.get(slug);
        if (until === undefined) return false;
        if (this.frame <= until) return true;
        this.wanted.delete(slug);
        return false;
    }

    /** One animal of a species this frame: how far from the camera, and whether it is in view. */
    see(slug: string, distance: number, visible: boolean) {
        const known = this.seen.get(slug);
        if (known && known.frame === this.frame) {
            if (visible && !known.visible) {
                known.visible = true;
                known.distance = distance;
            } else if (visible === known.visible && distance < known.distance) {
                known.distance = distance;
            }
            return;
        }
        this.seen.set(slug, {distance, visible, frame: this.frame});
    }

    endFrame() {
        this.frame++;
    }

    /** The kinds seen in view this frame, nearest first, at most `limit` (the ones drawn as models). */
    nearestVisible(limit: number): string[] {
        const list: Array<[string, number]> = [];
        this.seen.forEach((known, slug) => {
            if (known.visible && known.frame === this.frame) list.push([slug, known.distance]);
        });
        list.sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1));
        return list.slice(0, limit).map(([slug]) => slug);
    }

    /** Seen at all lately (in view or not): still wanted by the scene. */
    recent(slug: string, frames = 120): boolean {
        const known = this.seen.get(slug);
        return Boolean(known && this.frame - known.frame <= frames);
    }

    /** The species' nearest animal in view lately (m), or Infinity. */
    nearestInView(slug: string): number {
        const known = this.seen.get(slug);
        return known && known.visible && this.frame - known.frame <= FRESH_FRAMES ? known.distance : Infinity;
    }

    /** Lower first. Near and far of one species rank together (the far one is asked for first). */
    priority(slug: string, level: "near" | "far"): number {
        // (The kind the reader chose: before everything, its far level first.)
        if (this.wanted.size && this.isWanted(slug)) return level === "near" ? -0.5 : -1;
        const known = this.seen.get(slug);
        const base = !known || this.frame - known.frame > FRESH_FRAMES ? UNSEEN : known.distance * (known.visible ? 1 : OUT_OF_VIEW);
        // A near level only ever matters close by; just behind its own far level.
        return base + (level === "near" ? 0.5 : 0);
    }
}

/**
 * Compile every shader the scene has now, in parallel where the browser can (KHR_parallel_shader_compile), and
 * resolve when they are ready or after `timeoutMs` (a driver without the extension: the first frame compiles the
 * rest, as before). Never rejects, and never throws later: three's own `compileAsync` polls `currentProgram.isReady()`
 * on a timer and throws (uncaught) when a material it is waiting on is disposed or loses its program meanwhile (the
 * town joining the one world, decision 153: a release fix). So the polling is done here, guarded: a material with no
 * program (or one whose check throws) is nothing to wait for, and the polling stops when this settles.
 */
export function warmShaders(renderer: WebGLRenderer, scene: Object3D, camera: Camera, timeoutMs = 5000, lightsFrom: Object3D | null = null): Promise<"ready" | "timeout" | "failed"> {
    return new Promise((resolve) => {
        let settled = false;
        let poll: ReturnType<typeof setTimeout> | null = null;
        const finish = (how: "ready" | "timeout" | "failed") => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            if (poll !== null) clearTimeout(poll);
            resolve(how);
        };
        const timer = setTimeout(() => finish("timeout"), timeoutMs);
        try {
            const gl = renderer as unknown as {
                compile?: (scene: Object3D, camera: Camera, target?: Object3D | null) => unknown;
                properties?: {get: (material: object) => {currentProgram?: {isReady?: () => boolean} | null} | undefined};
            };
            if (typeof gl.compile !== "function" || !gl.properties) {
                finish("failed");
                return;
            }
            // (Programs created now, compiling in the driver's own time where it can.)
            const compiled = gl.compile.call(renderer, scene, camera, lightsFrom);
            if (!(compiled instanceof Set)) {
                finish("failed");
                return;
            }
            const pending = new Set<object>(compiled as Set<object>);
            const check = () => {
                poll = null;
                if (settled) return;
                pending.forEach((material) => {
                    let ready = true;
                    try {
                        const program = gl.properties!.get(material)?.currentProgram;
                        // (Disposed or replaced while it warmed: no program to wait for.)
                        ready = !program || typeof program.isReady !== "function" || program.isReady();
                    } catch {
                        ready = true;
                    }
                    if (ready) pending.delete(material);
                });
                if (pending.size === 0) finish("ready");
                else poll = setTimeout(check, 10);
            };
            poll = setTimeout(check, 0);
        } catch {
            finish("failed");
        }
    });
}

/** A per-frame time budget: `spend(work)` runs work while the budget lasts (always at least once a frame). */
export class FrameBudget {
    private started = 0;
    private runs = 0;

    constructor(private readonly ms: number, private readonly now: () => number = () => performance.now()) {}

    begin() {
        this.started = this.now();
        this.runs = 0;
    }

    /** May one more piece of work run this frame? */
    allows(): boolean {
        return this.runs === 0 || this.now() - this.started < this.ms;
    }

    ran() {
        this.runs++;
    }
}
