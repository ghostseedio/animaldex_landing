/**
 * No frame waits on a new shader (graphics and performance pass, 2026-11).
 *
 * The first frame's shaders are compiled in parallel before it is drawn (`load.ts` warmShaders), and the animals'
 * meshes are held back until theirs are (`prepare`). Everything else made later was not: the close-up detail of a
 * zone, a burrow's cutaway, a nest, a prop's effect. Each new material was compiled and linked inside the frame that
 * first drew it, and the page waited there for the driver (measured on the phone profiles while zooming in to twelve
 * animals: 20 programs, 2.1 s of frames held at 4× and 4.9 s at 6×, single frames of 0.35 to 2.6 s; a real phone's
 * compiler is slower than the Mac's that ran them).
 *
 * So the renderer's own draw call is watched for materials it has never drawn: such an object is left out of the frame,
 * its shader is asked for after the frame (compiled in parallel, as the first frame's were), and it is drawn from the
 * first frame its program is ready, or after `limitMs` whatever happens. A material drawn once is never looked at
 * again (one set lookup a draw). Where the browser cannot compile in parallel, every program says it is ready at once
 * and nothing is held: the same frames as before.
 *
 * Only the scene's own pass is watched (never a post-processing quad or the sky: leaving one of those out is a broken
 * frame); an object held back casts no shadow and leaves no mark in the ambient occlusion meanwhile. Never in a
 * recording (the golden shots, the director's clips): those wait for everything anyway and must not change.
 */

/** What the hold needs of three's renderer (a fake stands in for it in the tests). */
export type HoldRenderer = {
    renderBufferDirect: (camera: unknown, scene: unknown, geometry: unknown, material: object, object: object, group: unknown) => void;
    properties: {get: (material: object) => {currentProgram?: {isReady?: () => boolean} | null} | undefined};
};

type Held = {since: number; objects: Set<object>};

export type ShaderHoldStats = {
    /** Materials waiting for their program now. */
    holding: number;
    /** Materials held and then drawn once their program was ready, this session. */
    released: number;
    /** Materials drawn after the limit with their program still compiling (the frame waited, as before). */
    timedOut: number;
    /** Draws left out of a frame while their material's program compiled. */
    skippedDraws: number;
};

export class ShaderHold {
    /** Materials drawn at least once: never looked at again. */
    private readonly known = new WeakSet<object>();
    private readonly holding = new Map<object, Held>();
    /** The objects left out now (their shadows and occlusion stay out with them), each with how many of its materials hold it. */
    private readonly heldObjects = new Map<object, number>();
    private asked: object[] = [];
    private readonly native: HoldRenderer["renderBufferDirect"];
    private installed = false;
    /** Off until the first frame is drawn (the mount's own warm-up covers what is there by then), and whenever the runtime says. */
    active = false;
    private released = 0;
    /** Held materials let through since the last `take` (a drawn frame): one a frame. */
    private releasedNow = 0;
    private timedOut = 0;
    private skippedDraws = 0;

    constructor(private readonly renderer: HoldRenderer, private readonly scene: object, private readonly limitMs = 3000, private readonly now: () => number = () => performance.now()) {
        this.native = renderer.renderBufferDirect;
    }

    install() {
        if (this.installed) return;
        this.installed = true;
        const native = this.native;
        const renderer = this.renderer;
        renderer.renderBufferDirect = (camera, scene, geometry, material, object, group) => {
            if (this.active) {
                if (scene === this.scene) {
                    if ((scene as {overrideMaterial?: unknown}).overrideMaterial) {
                        // (An override pass, the ambient occlusion's depth and normals: nothing of what is not drawn yet.)
                        if (this.heldObjects.size && this.heldObjects.has(object)) return;
                    } else if (!this.known.has(material) && this.hold(material, object)) {
                        this.skippedDraws++;
                        return;
                    }
                } else if (this.heldObjects.size && this.heldObjects.has(object)) {
                    // (The shadow pass: no shadow from what is not drawn yet.)
                    return;
                }
            }
            native.call(renderer, camera, scene, geometry, material, object, group);
        };
    }

    /** Whether this material's draw is left out of the frame (its program is not ready yet). */
    private hold(material: object, object: object): boolean {
        const program = this.renderer.properties.get(material)?.currentProgram ?? null;
        const held = this.holding.get(material);
        if (program) {
            let ready = true;
            try {
                ready = typeof program.isReady !== "function" || program.isReady() === true;
            } catch {
                ready = true;
            }
            if (ready) {
                // (One held material a frame: its first draw reads the whole program back from the driver, uniform by
                // uniform, ~13 ms on the low phone profile; six at once, a zone's close-up detail, were one long frame.)
                if (held && this.releasedNow >= 1 && this.now() - held.since <= this.limitMs) return true;
                if (held) {
                    this.released++;
                    this.releasedNow++;
                }
                this.release(material, held);
                return false;
            }
        }
        const now = this.now();
        if (!held) {
            // New: ask for its program once this frame is drawn (a program already on its way, the mount's warm-up or
            // `prepare`, is only waited for).
            this.holding.set(material, {since: now, objects: new Set([object])});
            this.heldObjects.set(object, (this.heldObjects.get(object) ?? 0) + 1);
            if (!program) this.asked.push(object);
            return true;
        }
        if (now - held.since > this.limitMs) {
            // (A driver that never reports, or a compile slower than the limit: drawn now, the frame waiting as it did before.)
            this.timedOut++;
            this.release(material, held);
            return false;
        }
        if (!held.objects.has(object)) {
            held.objects.add(object);
            this.heldObjects.set(object, (this.heldObjects.get(object) ?? 0) + 1);
            // (The same material on another kind of object, an instanced mesh beside a plain one, is another program.)
            if (!program) this.asked.push(object);
        }
        return true;
    }

    private release(material: object, held: Held | undefined) {
        this.known.add(material);
        if (!held) return;
        this.holding.delete(material);
        held.objects.forEach((object) => {
            const left = (this.heldObjects.get(object) ?? 1) - 1;
            if (left > 0) this.heldObjects.set(object, left);
            else this.heldObjects.delete(object);
        });
    }

    /** After a frame is drawn: the objects whose shaders are to be compiled now (each once). */
    take(): object[] {
        this.releasedNow = 0;
        if (!this.asked.length) return this.asked;
        const out = this.asked;
        this.asked = [];
        return out;
    }

    stats(): ShaderHoldStats {
        return {holding: this.holding.size, released: this.released, timedOut: this.timedOut, skippedDraws: this.skippedDraws};
    }

    dispose() {
        if (this.installed) this.renderer.renderBufferDirect = this.native;
        this.installed = false;
        this.holding.clear();
        this.heldObjects.clear();
        this.asked = [];
    }
}
