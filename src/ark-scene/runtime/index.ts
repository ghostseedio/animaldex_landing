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

import type {Camera, Mesh, Object3D, PerspectiveCamera, Scene, Vector3, WebGLRenderTarget, WebGLRenderer} from "three";
import type {ModelLibrary} from "@/ark-scene/models";
import type {QualityTier} from "@/ark-scene/post";
import {arkBudget, arkCaps, GRASS_BUILD, overBudget, type ArkCaps} from "@/ark-scene/runtime/budgets";
import {CameraObstacles, collideCamera, dampingFor, FollowSmoother, WheelGlide} from "@/ark-scene/runtime/camera";
import {RenderGovernor, type ArkPower, type ArkRenderMode} from "@/ark-scene/runtime/governor";
import {FrameBudget, LoadPlanner, warmShaders} from "@/ark-scene/runtime/load";
import {parsePowerMessage, parseVisibleMessage, watchBrowserPower} from "@/ark-scene/runtime/power";
import {RuntimeUi} from "@/ark-scene/runtime/ui";
import {heightAt} from "@/ark-scene/world";
import {arkAnimalClock, arkEpochSeconds, ArkShaderClock} from "@/ark-scene/shared-clock";
import {ARK_LIVE_BUDGET, arkOutside, arkRestingAsks, arkRestStep, arkWithinCapacity, arkZoneCapacity, type ArkLiveCandidate} from "@/ark-scene/live-budget";

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
    /** Every model the view draws now is in (the far models of the kinds in view, the near ones close by). */
    viewComplete: boolean;
    /**
     * The kinds the view draws as models now (the nearest in view). 0 when every animal in sight is past the render
     * distance (the v2 wild island's whole view: map markers only), where `viewComplete` has nothing to wait on and stays
     * false.
     */
    viewKinds: number;
    /** Queued far models dropped because the camera left their kinds. */
    pruned: number;
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
    /** Part C: the one world's ground (the town's inside its square), for the camera's floor; absent: the wild island's. */
    groundAt?: (x: number, z: number) => number;
};

/** The grass to build for the device's first tier (`buildVegetation`). */
export function arkGrassBuild(tier: QualityTier): number {
    return GRASS_BUILD[tier];
}

export {arkCaps};

export type ArkRuntime = ReturnType<typeof createArkRuntime>;

/** Far models asked for up front (the nearest kinds to the view), per tier; the rest when seen within `FAR_ON_DEMAND` m. */
const FAR_UPFRONT: Record<QualityTier, number> = {high: 160, medium: 120, low: 80};
/** Kinds in view whose far models are fetched (the nearest; the scene draws its nearest 150 / 120 / 80 animals as models). */
const FAR_IN_VIEW: Record<QualityTier, number> = {high: 150, medium: 120, low: 80};
/** The starting view's kinds fetched first (then the tier's full number once those are in). */
const FIRST_VIEW_KINDS = 60;

/** The mount's steps' share per frame (ms) before the first frame. */
const MOUNT_SLICE_MS = 25;

/** The shader warm-up's synchronous share per frame (ms). */
const WARM_SLICE_MS = 30;

/** Rule E applies from this many animals aboard (the snapshot's size: the same for every viewer). */
const RULE_E_FROM = 1000;

/** The layer a mesh waits on, undrawn, while its new shader compiles (the camera and the shadows draw layer 0). */
const HELD_LAYER = 31;

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
    let warmQueue: Object3D[] = [];
    /** The mount's remaining steps (`mountLater`), run before the first frame a frame at a time. */
    let mountSteps: Array<() => boolean> = [];
    let warmPending: Array<Promise<"ready" | "timeout" | "failed">> = [];
    let warmLimit = 5000;
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
    /** The kinds the view draws as models now, the far models dropped from the queue, and the up-front list (kept). */
    let inView: string[] = [];
    /** The first view's models are all in (then the tier's full number of kinds is fetched). */
    let viewSettled = false;
    /** Every model the view draws now is in (the far models of the kinds in view, the near ones close by). */
    const viewIsComplete = () => inView.length > 0 && inView.every((slug) => {
        const model = ctx.library.get(slug);
        return Boolean(model?.far) && (planner.nearestInView(slug) > 27.5 || Boolean(model?.near));
    });
    let pruned = 0;
    const upfront = new Set<string>();
    /** The live budget's last answer: its rotation step and budget (a new step or tier asks for the snapshot again). */
    let restAt: {step: number; budget: number} | null = null;
    /** The shaders' time on the shared clock (shared-clock.ts), brought back down only while nobody sees the scene. */
    const shaderClock = new ArkShaderClock();

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
    // Part B: the starting view's far models from the first tier's pack (streaming/pack.ts), when the model set has one.
    // Not in a recording (the golden shots, the marketing recorder): it waits for every model anyway, and the published
    // skins keep its pictures exactly as they are.
    if (!ctx.options.recording) ctx.library.packTier = ctx.tier();
    ctx.library.paced = true;
    // More files at once on a desktop's connection (HTTP/2 to the bucket); a phone keeps four.
    ctx.library.setConcurrency(ctx.tier() === "high" ? 8 : 6);
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
        // (Kept as if drawn near now: the species the reader chose and is flying to, `library.urgent`; and a level in
        // its first three seconds. Neither has been drawn near yet, so each was let go the moment it arrived whenever
        // the budget's check fell on that frame, and loaded again.)
        const used = (level: {slug: string; at: number}) => (level.slug === ctx.library.urgent || now - level.at < 3 ? now : lastNear.get(level.slug) ?? 0);
        const levels = ctx.library.levels().flatMap((level) => [
            {slug: level.slug, level: level.level, bytes: level.texture, texture: true, lastNear: used(level)},
            {slug: level.slug, level: level.level, bytes: level.geometry, texture: false, lastNear: used(level)}
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
            // The rest of the mount, before the first frame: its steps a frame at a time (each its own task), as many as
            // fit in MOUNT_SLICE_MS; a step returns false to go on in the next frame.
            if (mountSteps.length) {
                skipped++;
                return "skip";
            }
            // The first frame (and the first after a tier change, whose shadows and finish are new shader variants)
            // waits for the scene's shaders, compiled in parallel: the last picture stays up meanwhile, and the page
            // keeps answering. Never longer than the warm-up's own limit.
            if (shaders === "pending") {
                // The scene's parts are handed to the compiler a few per frame (its synchronous part is ~160 ms for
                // everything on a throttled phone), then the frame waits for the parallel compiles to finish.
                if (!warming) {
                    warming = true;
                    // (The whole scene in one call: compiled part by part, one part's promise could wait out the limit,
                    // which held the first frame back 5 s on the real backfill. The call's own task is ~160 ms on a phone.)
                    warmQueue = [ctx.scene];
                    warmPending = [];
                    warmLimit = 1500; // (Some driver leaves a program unreported: the real backfill's desktop waited out 5 s for it.)
                }
                if (warmQueue.length) {
                    const target = ctx.renderTarget();
                    const previous = ctx.renderer.getRenderTarget();
                    if (target) ctx.renderer.setRenderTarget(target);
                    const sliceStarted = performance.now();
                    while (warmQueue.length && performance.now() - sliceStarted < WARM_SLICE_MS) {
                        warmPending.push(warmShaders(ctx.renderer, warmQueue.shift()!, ctx.camera as Camera, warmLimit, ctx.scene));
                    }
                    ctx.renderer.setRenderTarget(previous);
                    if (!warmQueue.length) {
                        void Promise.all(warmPending).then((results) => {
                            shaders = results.includes("timeout") ? "timeout" : results.includes("failed") ? "failed" : "ready";
                            warming = false;
                        });
                    }
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

        /**
         * The rest of the mount, in steps run before the first frame, each in its own task (a step returns true when it
         * is done, false to be called again next frame). The first frame waits for them, then the shader warm-up.
         */
        mountLater(steps: Array<() => boolean>) {
            const idle = mountSteps.length === 0;
            mountSteps = [...mountSteps, ...steps];
            // Each run is its own task (a message to ourselves), not inside an animation frame, where it would add to
            // every other lane's per-frame slices in one long task.
            const channel = typeof MessageChannel !== "undefined" ? new MessageChannel() : null;
            const next = () => (channel ? channel.port2.postMessage(0) : setTimeout(run, 0));
            const run = () => {
                const sliceStarted = performance.now();
                while (mountSteps.length && performance.now() - sliceStarted < MOUNT_SLICE_MS) {
                    if (mountSteps[0]()) mountSteps.shift();
                    else break;
                }
                if (mountSteps.length) next();
                else channel?.port1.close();
            };
            if (channel) channel.port1.onmessage = run;
            if (idle) next();
        },

        /** Asked by the frame loop when it stops (hidden); called back when visible again. */
        set onWake(callback: () => void) {
            governor.onWake = () => {
                // Unseen until now: the moment to bring the shader time's numbers back down, if they grew.
                shaderClock.rebase();
                callback();
            };
        },

        /** The scene is seen: the page shown, the world on screen, and the app's panel uncovered (`ark:visible`). */
        visible(): boolean {
            return governor.visible();
        },

        /** Called whenever that flips (the ambient sound sleeps with the drawing). */
        set onVisibleChange(callback: () => void) {
            governor.onVisibility = () => callback();
        },

        /** `ARK_TIME.value`: epoch seconds from a whole-window origin, the same phase for every viewer. */
        shaderTime(): number {
            return shaderClock.seconds(arkEpochSeconds());
        },

        /** `ARK_CLOCK.value`: the animals' idle clock, epoch seconds mod an hour. */
        animalClock(): number {
            return arkAnimalClock();
        },

        /** What moves on its own this frame (flights, follow, replay, talking, the opening): full rate while it does. */
        activity(busy: boolean, reducedMotion: boolean) {
            const now = performance.now() / 1000;
            // A recording (clips, golden shots) is the director's: every frame, never idle-capped.
            // Models coming in count as moving: their hand-over runs at the full rate, then the page settles.
            // (On the high tier models coming in count as moving: full rate. On a phone's tiers the reverse: the frames
            // take most of a throttled main thread, so while the view's models come in it may drop to 30 fps and leave
            // the loads the rest; measured on the real backfill, the loads were starved at 60 fps.)
            const loading = ctx.library.pending > 0;
            governor.setActivity({busy: busy || recording || now < busyUntil || wheel.active || (loading && ctx.tier() === "high"), reducedMotion});
        },

        /** Something will move for a while (an arrival's entrance): full rate until then. */
        busyFor(seconds: number) {
            busyUntil = Math.max(busyUntil, performance.now() / 1000 + seconds);
        },

        /** Frames run at the display's own rate (the tier check measures only these). */
        uncapped(): boolean {
            return governor.uncapped(performance.now() / 1000);
        },

        /** Full rate but for the frame pacing's own cap (`runtime/pace.ts` measures these). */
        drawsFull(): boolean {
            return governor.drawsFull(performance.now() / 1000);
        },

        /** The frame pacing's cap: 0, or a steady lower rate's ms between frames. */
        setPaceCap(ms: number) {
            governor.setPaceCap(ms);
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
            const diving = (ctx.groundAt ?? heightAt)(target.x, target.z) < -0.4 && target.y < -0.15;
            const clearance = Math.min(Math.max(ctx.camera.position.distanceTo(target) * 0.25, 0.03), 1.2);
            if (collideCamera(obstacles, ctx.camera.position, target, {dt, diving, clearance, closeUp, fill, ...(ctx.groundAt ? {ground: ctx.groundAt} : {})}) > 1e-4) collisions++;
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

        /** One animal of a species seen this frame (the load order; a far model asked for once it is in view and near enough). */
        see(slug: string, distance: number, visible: boolean) {
            planner.see(slug, distance, visible);
        },

        /**
         * Who of `live` (the animals that would be drawn one by one) is outside now (`live-budget.ts`): at most the
         * tier's budget (the lighter view's: the low tier's), the same for every viewer, the reader's own and `pins`
         * always. Everyone else rests out of sight; the counts are untouched.
         */
        outside(animals: ReadonlyArray<{id: string; species_profile_id?: string | null; model_slug: string; mine?: boolean; zone: string}>, live: ReadonlySet<string>, pins: ReadonlySet<string>, lite: boolean, restingOf?: (id: string) => boolean): Set<string> {
            const budget = ARK_LIVE_BUDGET[lite ? "low" : ctx.tier()];
            const epoch = arkEpochSeconds();
            restAt = {step: arkRestStep(epoch), budget};
            let candidates: Array<ArkLiveCandidate & {zone: string}> = [];
            const pinned = new Set<string>(pins);
            for (const animal of animals) {
                if (!live.has(animal.id)) continue;
                candidates.push({id: animal.id, group: animal.species_profile_id || `slug:${animal.model_slug}`, zone: animal.zone});
                if (animal.mine) pinned.add(animal.id);
            }
            const resting = restingOf ? (candidate: ArkLiveCandidate) => restingOf(candidate.id) : undefined;
            // Rule E first (the map's visible capacity per zone, the same on every device), then the tier's budget.
            // (From 1,000 animals aboard: a small Ark does not crowd a zone, and the table costs a second to build.)
            const capacity = animals.length >= RULE_E_FROM ? arkZoneCapacity() : null;
            if (capacity) candidates = arkWithinCapacity(candidates, capacity, epoch, pinned, resting);
            return arkOutside(candidates, budget, epoch, pinned, resting);
        },

        /**
         * The ids the rotation at `epoch` asks about first (resting at its roost?), as `outside` would ask at that step
         * with every answer not `known` yet taken as "not resting": a crowded kind's members in ring order until its quota,
         * the crowded zones' likewise. The warm-up's list (mobile performance lane): a few hundred of the Ark's thousands.
         * Should some turn out resting, the rest of what that step asks is asked then, as before. Pure: no state changes.
         */
        restingAsks(animals: ReadonlyArray<{id: string; species_profile_id?: string | null; model_slug: string; mine?: boolean; zone: string}>, live: ReadonlySet<string>, pins: ReadonlySet<string>, lite: boolean, epoch: number, known: (id: string) => boolean | undefined): string[] {
            const budget = ARK_LIVE_BUDGET[lite ? "low" : ctx.tier()];
            const candidates: Array<ArkLiveCandidate & {zone: string}> = [];
            const pinned = new Set<string>(pins);
            for (const animal of animals) {
                if (!live.has(animal.id)) continue;
                candidates.push({id: animal.id, group: animal.species_profile_id || `slug:${animal.model_slug}`, zone: animal.zone});
                if (animal.mine) pinned.add(animal.id);
            }
            return arkRestingAsks(candidates, budget, epoch, pinned, animals.length >= RULE_E_FROM ? arkZoneCapacity() : null, known);
        },

        /** Behaviour's world is built (who is resting at home is known now): lay the snapshot out again next frame. */
        restingReady() {
            if (restAt) restAt = {...restAt, step: -1};
        },

        /** The rotation moved on (a new step on the shared clock) or the budget changed: the snapshot is to be laid out again. */
        rotationDue(lite: boolean): boolean {
            if (!restAt) return false;
            return arkRestStep(arkEpochSeconds()) !== restAt.step || ARK_LIVE_BUDGET[lite ? "low" : ctx.tier()] !== restAt.budget;
        },

        /** The far models to ask for up front: all, or (a big Ark) the tier's number of kinds nearest the view. */
        upfrontFar(slugs: string[], where: ReadonlyArray<{slug: string; x: number; z: number}>, always: readonly string[] = []): string[] {
            const limit = FAR_UPFRONT[ctx.tier()];
            if (slugs.length <= limit) return slugs;
            const keep = new Set(always);
            for (const slug of always) upfront.add(slug);
            const target = ctx.controls.target;
            const nearest = new Map<string, number>();
            for (const at of where) {
                const d = Math.hypot(at.x - target.x, at.z - target.z);
                if (d < (nearest.get(at.slug) ?? Infinity)) nearest.set(at.slug, d);
            }
            // The herds' kinds always (their figures are drawn from afar), then the nearest.
            const rest = slugs.filter((slug) => !keep.has(slug)).sort((a, b) => (nearest.get(a) ?? Infinity) - (nearest.get(b) ?? Infinity) || (a < b ? -1 : 1));
            const chosen = [...slugs.filter((slug) => keep.has(slug)), ...rest.slice(0, Math.max(limit - keep.size, 0))];
            for (const slug of chosen) upfront.add(slug);
            return chosen;
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

        /**
         * A mesh the scene just added (a species' instances, a rig's): if its material's shader is new, it is not drawn
         * (another layer) until the shader is compiled in parallel, instead of the frame that first draws it stalling
         * on the compile (seconds on a slow phone). A material whose program is already in use is drawn at once.
         */
        prepare(mesh: Mesh) {
            const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            const ready = materials.every((material) => (ctx.renderer.properties.get(material) as {currentProgram?: {isReady?: () => boolean}}).currentProgram?.isReady?.() === true);
            if (ready) return;
            const layers = mesh.layers.mask;
            mesh.layers.set(HELD_LAYER);
            const target = ctx.renderTarget();
            const previous = ctx.renderer.getRenderTarget();
            if (target) ctx.renderer.setRenderTarget(target);
            void warmShaders(ctx.renderer, mesh, ctx.camera as Camera, 3000, ctx.scene).then(() => {
                mesh.layers.mask = layers;
            });
            ctx.renderer.setRenderTarget(previous);
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
            // Far models for what the view draws as models (the tier's nearest kinds in view), nearest first; the rest
            // when the camera comes to them. A few times a second is enough.
            if (drawn % 8 === 1) {
                if (!viewSettled && viewIsComplete()) viewSettled = true;
                // The starting view asks for its nearest 60 kinds first; once those are in, the tier's full number.
                inView = planner.nearestVisible(viewSettled ? FAR_IN_VIEW[ctx.tier()] : Math.min(FIRST_VIEW_KINDS, FAR_IN_VIEW[ctx.tier()]));
                for (const slug of inView) if (ctx.library.has(slug)) ctx.library.request(slug, "far");
                // Queued far models of kinds the camera has left (the opening flight's path) give way to what is in view.
                if (drawn % 64 === 1) pruned += ctx.library.prune((slug, level) => level === "near" || planner.recent(slug) || upfront.has(slug));
            }
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
                    collisions,
                    viewComplete: viewIsComplete(),
                    viewKinds: inView.length,
                    pruned
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
