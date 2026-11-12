/**
 * Render distance, haze and memory per quality tier, and the tier chosen from what the device says about itself
 * (Part B, docs/ark/streaming.md). Pure: the browser's signals are read by `deviceSignals` and passed in.
 *
 * The render distances are sized for the bigger islands of Part C. Today's island (land within ~112 m of the
 * middle, the camera at most ~460 m out) fits inside every tier's distance from every view the camera can take on
 * the medium and high tiers, so nothing is hidden there and the picture is the one before; the low tier's distance
 * (440 m) covers the island from its home view on a phone (the far shore is ~415 m off).
 */

export type StreamTierName = "high" | "medium" | "low";

export type StreamTier = {
    /** Chunks within this (m, from the eye to the chunk's box) are drawn in full; beyond, the map view or nothing. */
    renderDistance: number;
    /** An `in` chunk goes only past the distance plus this (m). */
    hysteresis: number;
    /**
     * Past the render distance, chunks are drawn in map style out to this (m), on every island (decision 141: both
     * islands visible side by side): the other island across the strait always reads as an island, never hazed out.
     */
    mapDistance: number;
    /** The haze starts at this share of the distance and is whole at the distance (only while something lies beyond). */
    hazeStart: number;
    /** What the page may hold (MB): past either, the render distance pulls in (then the tier drops). */
    memory: {heapMB: number; gpuMB: number};
};

export const ARK_STREAM_TIERS: Record<StreamTierName, StreamTier> = {
    // Budgets: about twice the peaks measured on the real Ark (3,137 animals, docs/ark/streaming.md §7), so today's
    // island never pulls its distance in; a bigger island reaches them only where it holds more than this one does.
    high: {renderDistance: 960, hysteresis: 40, mapDistance: 3000, hazeStart: 0.7, memory: {heapMB: 768, gpuMB: 512}},
    medium: {renderDistance: 640, hysteresis: 32, mapDistance: 2200, hazeStart: 0.7, memory: {heapMB: 512, gpuMB: 320}},
    low: {renderDistance: 440, hysteresis: 26, mapDistance: 1600, hazeStart: 0.7, memory: {heapMB: 384, gpuMB: 192}}
};

/** The camera this far (m) or more from what it looks at is the map view: no haze at all there. */
export const MAP_VIEW_FROM = 150;
/** Memory pressure pulls the render distance in by steps of this share, never below `MIN_RENDER_SCALE` of the tier's. */
export const RENDER_SCALE_STEP = 0.85;
export const MIN_RENDER_SCALE = 0.6;
/** Under this share of both budgets for `RELAX_SECONDS`, the distance steps back out. */
export const RELAX_BELOW = 0.7;
export const RELAX_SECONDS = 30;

export type DeviceSignals = {
    /** A touch screen as the main pointer. */
    coarse: boolean;
    /** `navigator.hardwareConcurrency`. */
    cores: number | null;
    /** GB of memory: `navigator.deviceMemory` (Chromium, capped at 8), or the app's own figure (`?mem=`, `ark:device`). */
    memoryGB: number | null;
    /** The JS heap's limit (MB), where the browser says it (`performance.memory`, Chromium). */
    heapLimitMB: number | null;
};

/**
 * The tier a device starts on. The same answers as before for the devices the runtime measured (a desktop with 8+
 * cores and 8 GB: high; a phone with 6+ cores and 4 GB: medium; any other touch device: low), and now:
 * - 2 GB or less (a low-memory Android phone, or the app's figure): low, whatever the cores;
 * - 3 GB: at most medium on a desktop pointer, low on touch.
 * (The JS heap's limit is not a tier signal: Chromium on Android gives a 4 GB phone a small one. It caps the heap
 * budget instead, `heapBudgetMB`.) Then the scene drops a tier if frames run long, and pulls the render distance in under memory pressure.
 */
export function chooseTier(signals: DeviceSignals): StreamTierName {
    const cores = signals.cores && signals.cores > 0 ? signals.cores : 4;
    const memory = signals.memoryGB && signals.memoryGB > 0 ? signals.memoryGB : null;
    if (memory !== null && memory <= 2) return "low";
    if (memory !== null && memory < 4) return signals.coarse ? "low" : "medium";
    const known = memory ?? 8;
    if (!signals.coarse && cores >= 8 && known >= 8) return "high";
    if (cores >= 6 && known >= 4) return "medium";
    return signals.coarse ? "low" : "medium";
}

/** What the browser says about the device (and the app's figure, if the page was given one). */
export function deviceSignals(appMemoryGB?: number | null): DeviceSignals {
    if (typeof window === "undefined") return {coarse: false, cores: null, memoryGB: appMemoryGB ?? null, heapLimitMB: null};
    const nav = navigator as Navigator & {deviceMemory?: number};
    const heap = (performance as Performance & {memory?: {jsHeapSizeLimit?: number}}).memory?.jsHeapSizeLimit;
    const fromPage = Number(new URLSearchParams(window.location?.search ?? "").get("mem"));
    const app = appMemoryGB && appMemoryGB > 0 ? appMemoryGB : fromPage > 0 ? fromPage : null;
    return {
        coarse: window.matchMedia?.("(pointer: coarse)").matches ?? false,
        cores: nav.hardwareConcurrency || null,
        // The app knows the device's real memory (iOS never says; Chromium caps it at 8): its figure wins.
        memoryGB: app ?? (typeof nav.deviceMemory === "number" ? nav.deviceMemory : null),
        heapLimitMB: typeof heap === "number" && heap > 0 ? heap / 2 ** 20 : null
    };
}

/** The tier's heap budget, never more than half the heap's own limit where the browser says it. */
export function heapBudgetMB(tier: StreamTier, heapLimitMB: number | null): number {
    return heapLimitMB && heapLimitMB > 0 ? Math.min(tier.memory.heapMB, heapLimitMB * 0.5) : tier.memory.heapMB;
}

export type MemoryReading = {heapMB: number | null; gpuMB: number};

/**
 * The render distance's scale under memory pressure (pure, stepped twice a second by the streamer): over either
 * budget it steps in by `RENDER_SCALE_STEP` (to `MIN_RENDER_SCALE`); under `RELAX_BELOW` of both for `RELAX_SECONDS`
 * it steps back out. `drop` asks for a lower tier when already at the floor and still over.
 */
export function stepRenderScale(scale: number, reading: MemoryReading, tier: StreamTier, calmFor: number, heapLimitMB: number | null = null): {scale: number; calmFor: number; drop: boolean} {
    const heapShare = reading.heapMB === null ? 0 : reading.heapMB / heapBudgetMB(tier, heapLimitMB);
    const gpuShare = reading.gpuMB / tier.memory.gpuMB;
    const share = Math.max(heapShare, gpuShare);
    if (share > 1) {
        if (scale <= MIN_RENDER_SCALE + 1e-6) return {scale: MIN_RENDER_SCALE, calmFor: 0, drop: true};
        return {scale: Math.max(scale * RENDER_SCALE_STEP, MIN_RENDER_SCALE), calmFor: 0, drop: false};
    }
    if (share < RELAX_BELOW && scale < 1) {
        if (calmFor >= RELAX_SECONDS) return {scale: Math.min(scale / RENDER_SCALE_STEP, 1), calmFor: 0, drop: false};
        return {scale, calmFor, drop: false};
    }
    return {scale, calmFor: 0, drop: false};
}

/** Development: `window.__arkRenderScale` (a share of the tier's distance) or `__arkRenderDistance` (m) before mounting. */
export function forcedRenderDistance(tier: StreamTier): number | null {
    const g = globalThis as {__arkRenderScale?: unknown; __arkRenderDistance?: unknown};
    if (typeof g.__arkRenderDistance === "number" && g.__arkRenderDistance > 0) return g.__arkRenderDistance;
    if (typeof g.__arkRenderScale === "number" && g.__arkRenderScale > 0) return tier.renderDistance * g.__arkRenderScale;
    return null;
}

/**
 * True scale (motion pass §3, lane L4): what is drawn past the render distance goes by size on screen, not distance
 * alone. In the map view an animal at least `MAP_MODEL_PIXELS` CSS px long on screen keeps its model there (a 25 m
 * whale is ~45 px at 640 m on a phone, and stays a model across a Part C island); smaller ones are a marker. Past the
 * distance in a ground view the haze is whole, so nothing there is drawn, big or small (like the land it stands on).
 */
export const MAP_MODEL_PIXELS = 6;

/** CSS px a length (m) covers on screen at `distance` (m), for a vertical field of view (degrees) and a viewport height. */
export function screenPixelsAt(length: number, distance: number, viewportHeight: number, fovDegrees: number): number {
    return (length * viewportHeight) / (2 * Math.tan((fovDegrees * Math.PI) / 360) * Math.max(distance, 0.01));
}

/** Whether an animal past the render distance, seen from the map view, keeps its model (big enough on screen). */
export function keepsModelBeyond(length: number, distance: number, viewportHeight: number, fovDegrees: number): boolean {
    return screenPixelsAt(length, distance, viewportHeight, fovDegrees) >= MAP_MODEL_PIXELS;
}

/** Development: `window.__arkMapDistance` (m) before mounting (with a small render distance, to see the map style end). */
export function forcedMapDistance(): number | null {
    const g = globalThis as {__arkMapDistance?: unknown};
    return typeof g.__arkMapDistance === "number" && g.__arkMapDistance > 0 ? g.__arkMapDistance : null;
}
