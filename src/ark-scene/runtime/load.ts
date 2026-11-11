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

    /** Lower first. Near and far of one species rank together (the far one is asked for first). */
    priority(slug: string, level: "near" | "far"): number {
        const known = this.seen.get(slug);
        const base = !known || this.frame - known.frame > FRESH_FRAMES ? UNSEEN : known.distance * (known.visible ? 1 : OUT_OF_VIEW);
        // A near level only ever matters close by; just behind its own far level.
        return base + (level === "near" ? 0.5 : 0);
    }
}

/**
 * Compile every shader the scene has now, in parallel where the browser can (KHR_parallel_shader_compile), and
 * resolve when they are ready or after `timeoutMs` (a driver without the extension: the first frame compiles the
 * rest, as before). Never rejects.
 */
export function warmShaders(renderer: WebGLRenderer, scene: Object3D, camera: Camera, timeoutMs = 5000): Promise<"ready" | "timeout" | "failed"> {
    return new Promise((resolve) => {
        let settled = false;
        const finish = (how: "ready" | "timeout" | "failed") => {
            if (settled) return;
            settled = true;
            resolve(how);
        };
        const timer = setTimeout(() => finish("timeout"), timeoutMs);
        try {
            const compile = (renderer as WebGLRenderer & {compileAsync?: (scene: Object3D, camera: Camera) => Promise<unknown>}).compileAsync;
            if (typeof compile !== "function") {
                clearTimeout(timer);
                finish("failed");
                return;
            }
            compile.call(renderer, scene, camera).then(() => {
                clearTimeout(timer);
                finish("ready");
            }, () => {
                clearTimeout(timer);
                finish("failed");
            });
        } catch {
            clearTimeout(timer);
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
