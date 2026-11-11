/**
 * The Ark's runtime (runtime lane): loading, memory, battery, camera. One object `mountArk` makes and calls from a
 * few thin hooks, so the scene file stays the other lanes'. What each part does:
 *
 * - `governor.ts`: when to draw (paused when hidden, 30 / 20 fps when idle, power caps) and the power tier;
 * - `power.ts`: the bridge's `ark:visible` / `ark:power` and the browser's own visibility, battery and pressure;
 * - `load.ts`: the model queue's order by distance and view, the paced hand-over, the first frame's shader warm-up;
 * - `budgets.ts` + `memory.ts`: per-tier skin sizes, memory ceilings and instance caps, enforced by letting near
 *   levels go;
 * - `camera.ts`: collision, per-second damping, the follow, the wheel's glide;
 * - `ui.ts`: the quiet loading bar and the reset button.
 *
 * The contract for the apps is docs/ark/runtime-bridge.md; the numbers are in docs/ark/runtime.md.
 */

import type {Camera, PerspectiveCamera, Scene, Vector3, WebGLRenderTarget, WebGLRenderer} from "three";
import type {ModelLibrary} from "@/ark-scene/models";
import type {QualityTier} from "@/ark-scene/post";
import {arkBudget, arkCaps, GRASS_BUILD, overBudget, type ArkCaps} from "@/ark-scene/runtime/budgets";
import {CameraObstacles, collideCamera, dampingFor, FollowSmoother, WheelGlide} from "@/ark-scene/runtime/camera";
import {RenderGovernor, type ArkPower, type ArkRenderMode} from "@/ark-scene/runtime/governor";
import {FrameBudget, LoadPlanner, warmShaders} from "@/ark-scene/runtime/load";
import {parsePowerMessage, parseVisibleMessage, watchBrowserPower} from "@/ark-scene/runtime/power";
import {RuntimeUi} from "@/ark-scene/runtime/ui";
import {heightAt} from "@/ark-scene/world";

export type {ArkPower, ArkRenderMode} from "@/ark-scene/runtime/governor";

/** The scene options the runtime reads (`ArkSceneOptions` takes these too). */
export type ArkRuntimeOptions = {
    /** The reset button's accessible name, in the page's language (default English). */
    resetLabel?: string;
    /** The scene's own reset button (default true). */
    resetButton?: boolean;
    /** The quiet loading bar (default true). */
    loadingBar?: boolean;
};

export type ArkRuntimeStats = {
    mode: ArkRenderMode;
    visible: boolean;
    power: ArkPower;
    /** The power's tier cap now (null: none). */
    powerTier: QualityTier | null;
    /** ms from mount to the first frame drawn, and how the shaders were warmed. */
    firstFrameMs: number | null;
    shaders: "pending" | "ready" | "timeout" | "failed";
    /** The animal models' estimated GPU bytes (MB) and the tier's ceilings. */
    modelTextureMB: number;
    modelGeometryMB: number;
    budget: {textureMB: number; geometryMB: number};
    /** Near levels let go over the budget, this session. */
    evicted: number;
    /** Levels still coming. */
    pending: number;
    /** Frames drawn and display frames skipped by the governor. */
    drawn: number;
    skipped: number;
    /** Camera pushes out of scenery this session (frames). */
    collisions: number;
};

/** What the runtime adds to the scene's handle. */
export type ArkRuntimeHandle = {
    /** The app's panel shown (true) or covered / the app in the background (false): `ark:visible`. */
    setVisible: (visible: boolean) => void;
    /** Battery saver and heat from the app (`ark:power`), or null to hand back to the browser's sources. */
    setPower: (power: Partial<ArkPower> | null) => void;
    /** Any bridge message (`ark:visible`, `ark:power`): true when the runtime took it. */
    receive: (message: unknown) => boolean;
    /** Fly back to the whole island (the reset button). */
    resetView: () => void;
    /** The runtime's state and numbers. */
    runtime: () => ArkRuntimeStats;
};

export type ArkRuntimeContext = {
    el: HTMLElement;
    canvas: HTMLCanvasElement;
    renderer: WebGLRenderer;
    scene: Scene;
    camera: PerspectiveCamera;
    controls: {dampingFactor: number; target: Vector3};
    library: ModelLibrary;
    options: ArkRuntimeOptions & {recording?: boolean; reducedMotion?: boolean};
    /** The scene's current tier, and a way to apply one (`applyTier`). */
    tier: () => QualityTier;
    applyTier: (tier: QualityTier) => void;
    /** Drop a species' near instanced mesh and material (its near level is being let go). */
    dropNear: (slug: string) => void;
    /** Whether the view is away from the whole-island view (the reset button shows). */
    awayFromHome: () => boolean;
    /** Fly home and end any follow / selection fly-around. */
    goHome: () => void;
    /** The forest fill a tier draws (`TIER_SETTINGS[tier].fill`). */
    fillShare: (tier: QualityTier) => number;
    /** The render target the scene's materials draw into (the post chain's), for the shader warm-up. */
    renderTarget: () => WebGLRenderTarget | null;
};

/** The grass to build for the device's first tier (`buildVegetation`). */
export function arkGrassBuild(tier: QualityTier): number {
    return GRASS_BUILD[tier];
}

export {arkCaps};

export type ArkRuntime = ReturnType<typeof createArkRuntime>;

/** A let-go near level comes back when an animal of its species is in view this close (the scene's near distance and its hysteresis). */
const NEAR_AGAIN_WITHIN = 27.5;

export function createArkRuntime(ctx: ArkRuntimeContext) {
    const started = performance.now();
    const governor = new RenderGovernor(started / 1000);
    const planner = new LoadPlanner();
    const pace = new FrameBudget(4);
    const follow = new FollowSmoother();
    const wheel = new WheelGlide(ctx.canvas);
    const recording = Boolean(ctx.options.recording);
    const ui = recording ? null : new RuntimeUi(ctx.el, {resetLabel: ctx.options.resetLabel, resetButton: ctx.options.resetButton, loadingBar: ctx.options.loadingBar, reducedMotion: Boolean(ctx.options.reducedMotion)}, () => resetView());
    let obstacles: CameraObstacles | null = null;
    let firstFrameMs: number | null = null;
    let shaders: ArkRuntimeStats["shaders"] = "pending";
    let warming = false;
    let drawn = 0;
    let skipped = 0;
    let evicted = 0;
    let collisions = 0;
    let lastDrawn = 0;
    let busyUntil = 0;
    let asked = 0;
    let lastBudget = 0;
    /** The tier before the power capped it, to go back to. */
    let beforePower: QualityTier | null = null;
    const lastNear = new Map<string, number>();

    // (Meshopt decoding stays on the main thread: three's decoder builds its worker from its own function's source,
    // which a minifier renames, so `useWorkers` breaks in the site's and the bundle's builds. It is WASM and fast.)

    // The models: nearest in view first, skins fitted to the tier, handed over a few per frame.
    ctx.library.priority = (slug, level) => planner.priority(slug, level);
    // A near level let go over the budget is not asked for again (by the 48 m preload) until an animal of the
    // species is in view within the near distance: no load, evict, load loop.
    const evictedAt = new Map<string, number>();
    ctx.library.gate = (slug, level) => {
        if (level !== "near" || !evictedAt.has(slug)) return true;
        if (planner.nearestInView(slug) > NEAR_AGAIN_WITHIN) return false;
        evictedAt.delete(slug);
        return true;
    };
    const fitFor = (tier: QualityTier) => ({near: arkBudget(tier).nearTexture, far: arkBudget(tier).farTexture});
    ctx.library.fit = fitFor(ctx.tier());
    ctx.library.paced = true;
    ctx.library.upload = (map) => {
        try {
            ctx.renderer.initTexture(map);
        } catch {
            // Uploaded at its first draw instead.
        }
    };

    // Input: anything the reader does brings the full frame rate back at once.
    const onInput = () => governor.input(performance.now() / 1000);
    const inputs: Array<keyof HTMLElementEventMap> = ["pointerdown", "pointermove", "wheel", "keydown", "touchstart"];
    for (const name of inputs) ctx.canvas.addEventListener(name, onInput, {capture: true, passive: true});
    // A recording takes no power hints from the browser (the director's frame rate and tier); the app's still count.
    const stopPower = recording ? () => undefined : watchBrowserPower(governor);

    // Power: the low tier while saver or heat asks for it; the tier from before when it lets go.
    governor.onPower = () => {
        const cap = governor.tierCap();
        const tier = ctx.tier();
        if (cap === "low" && tier !== "low") {
            beforePower = tier;
            ctx.applyTier("low");
        } else if (!cap && beforePower) {
            const back = beforePower;
            beforePower = null;
            if (ctx.tier() === "low") ctx.applyTier(back);
        }
    };

    const resetView = () => {
        governor.input(performance.now() / 1000);
        ctx.goHome();
    };

    const enforceBudget = (now: number) => {
        // Twice a second is plenty: the bytes only change when a model comes in.
        if (now - lastBudget < 0.5) return;
        lastBudget = now;
        const tier = ctx.tier();
        const budget = arkBudget(tier);
        const levels = ctx.library.levels().flatMap((level) => [
            {slug: level.slug, level: level.level, bytes: level.texture, texture: true, lastNear: lastNear.get(level.slug) ?? 0},
            {slug: level.slug, level: level.level, bytes: level.geometry, texture: false, lastNear: lastNear.get(level.slug) ?? 0}
        ]);
        for (const drop of overBudget(levels, budget, now)) {
            ctx.dropNear(drop.slug);
            if (ctx.library.evict(drop.slug, "near")) {
                evicted++;
                evictedAt.set(drop.slug, now);
            }
        }
    };

    return {
        /** The first frame drawn (`onReady`): the time from mount. */
        get ready(): boolean {
            return firstFrameMs !== null;
        },

        /**
         * The top of each display frame: "draw" (go on), "skip" (this display frame is not drawn: idle cap, the shaders
         * still compiling) or "sleep" (hidden: stop asking for frames; `onWake` asks again).
         */
        frame(nowMs: number): "draw" | "skip" | "sleep" {
            if (!governor.visible()) return "sleep";
            // The first frame (and the first after a tier change, whose shadows and finish are new shader variants)
            // waits for the scene's shaders, compiled in parallel: the last picture stays up meanwhile, and the page
            // keeps answering. Never longer than the warm-up's own limit.
            if (shaders === "pending") {
                if (!warming) {
                    warming = true;
                    const target = ctx.renderTarget();
                    const previous = ctx.renderer.getRenderTarget();
                    if (target) ctx.renderer.setRenderTarget(target);
                    void warmShaders(ctx.renderer, ctx.scene, ctx.camera as Camera, firstFrameMs === null ? 5000 : 1500).then((how) => {
                        shaders = how;
                        warming = false;
                    });
                    ctx.renderer.setRenderTarget(previous);
                }
                skipped++;
                return "skip";
            }
            if (!governor.shouldDraw(nowMs, lastDrawn)) {
                skipped++;
                return "skip";
            }
            return "draw";
        },

        /** Asked by the frame loop when it stops (hidden); called back when visible again. */
        set onWake(callback: () => void) {
            governor.onWake = callback;
        },

        /** What moves on its own this frame (flights, follow, replay, talking, the opening): full rate while it does. */
        activity(busy: boolean, reducedMotion: boolean) {
            const now = performance.now() / 1000;
            // A recording (clips, golden shots) is the director's: every frame, never idle-capped.
            // Models coming in count as moving: their hand-over runs at the full rate, then the page settles.
            governor.setActivity({busy: busy || recording || now < busyUntil || wheel.active || ctx.library.pending > 0, reducedMotion});
        },

        /** Something will move for a while (an arrival's entrance): full rate until then. */
        busyFor(seconds: number) {
            busyUntil = Math.max(busyUntil, performance.now() / 1000 + seconds);
        },

        /** Frames run at the display's own rate (the tier check measures only these). */
        uncapped(): boolean {
            return governor.uncapped(performance.now() / 1000);
        },

        /** OrbitControls' damping for this frame (per second, not per frame) and the wheel's glide. */
        controls(dt: number) {
            ctx.controls.dampingFactor = dampingFor(dt);
            wheel.step(dt);
        },

        /**
         * After the scene keeps the view over the world (its own hard floor): out of trees, rocks and buildings, and
         * over ground rising just round the eye. `closeUp`: by a small animal (only solid things push, by less).
         */
        collide(target: Vector3, dt: number, closeUp: boolean) {
            // Built once (every fill tree, with its rank); a tier's share is applied at the query.
            obstacles ??= CameraObstacles.forScene();
            const fill = ctx.fillShare(ctx.tier());
            // The scene's rules (keepInWorld): under the sea it keeps its own floor; the eye's height over the ground
            // is a quarter of the view distance, 3 cm to 1.2 m.
            const diving = heightAt(target.x, target.z) < -0.4 && target.y < -0.15;
            const clearance = Math.min(Math.max(ctx.camera.position.distanceTo(target) * 0.25, 0.03), 1.2);
            if (collideCamera(obstacles, ctx.camera.position, target, {dt, diving, clearance, closeUp, fill}) > 1e-4) collisions++;
        },

        /** The world scrolled into (true) or out of (false) the page's view. */
        onScreen(seen: boolean) {
            governor.setOnScreen(seen);
        },

        /** Following: the step to add to the target and the camera this frame. */
        follow(target: Vector3, aim: Vector3, dt: number) {
            return follow.step(target, aim, dt);
        },

        endFollow() {
            follow.reset();
        },

        /** One animal of a species seen this frame (the load order). */
        see(slug: string, distance: number, visible: boolean) {
            planner.see(slug, distance, visible);
        },

        /** The species drawn with their near model this frame (the budget lets the others' near levels go first). */
        usedNear(slugs: Set<string>) {
            const now = performance.now() / 1000;
            slugs.forEach((slug) => lastNear.set(slug, now));
        },

        /** The instance caps for the tier (the lighter view's are the low tier's). */
        caps(tier: QualityTier, lite: boolean): ArkCaps {
            return arkCaps(lite ? "low" : tier);
        },

        /** The tier changed: skins loaded from now on are fitted to it; its new shader variants are compiled before the next draw. */
        tierChanged(tier: QualityTier) {
            ctx.library.fit = fitFor(tier);
            if (firstFrameMs !== null && !warming) shaders = "pending";
        },

        /** After the frame is drawn: the paced hand-over, the budget, the bar and the button. */
        drawnFrame(nowMs: number, inset: number) {
            const now = nowMs / 1000;
            drawn++;
            lastDrawn = nowMs;
            if (firstFrameMs === null) firstFrameMs = Math.round(nowMs - started);
            planner.endFrame();
            pace.begin();
            ctx.library.drain(() => pace.allows(), () => pace.ran());
            enforceBudget(now);
            const pending = ctx.library.pending;
            if (pending === 0) asked = 0;
            else asked = Math.max(asked, pending);
            if (ui) {
                ui.setInset(inset);
                ui.setLoading(pending, asked, now);
                ui.setReset(ctx.awayFromHome());
            }
        },

        handle: {
            setVisible: (visible: boolean) => governor.setHostVisible(visible),
            setPower: (power: Partial<ArkPower> | null) => governor.setHostPower(power),
            receive: (message: unknown) => {
                const visible = parseVisibleMessage(message);
                if (visible !== null) {
                    governor.setHostVisible(visible);
                    return true;
                }
                const power = parsePowerMessage(message);
                if (power !== undefined) {
                    governor.setHostPower(power);
                    return true;
                }
                return false;
            },
            resetView,
            runtime: (): ArkRuntimeStats => {
                const levels = ctx.library.levels();
                const budget = arkBudget(ctx.tier());
                return {
                    mode: governor.mode(performance.now() / 1000),
                    visible: governor.visible(),
                    power: governor.power(),
                    powerTier: governor.tierCap(),
                    firstFrameMs,
                    shaders,
                    modelTextureMB: Math.round(levels.reduce((sum, level) => sum + level.texture, 0) / 2 ** 20 * 10) / 10,
                    modelGeometryMB: Math.round(levels.reduce((sum, level) => sum + level.geometry, 0) / 2 ** 20 * 10) / 10,
                    budget: {textureMB: budget.textureMB, geometryMB: budget.geometryMB},
                    evicted,
                    pending: ctx.library.pending,
                    drawn,
                    skipped,
                    collisions
                };
            }
        } satisfies ArkRuntimeHandle,

        dispose() {
            for (const name of inputs) ctx.canvas.removeEventListener(name, onInput, {capture: true});
            stopPower();
            wheel.dispose();
            ui?.dispose();
            governor.onWake = () => undefined;
            governor.onPower = () => undefined;
        }
    };
}
