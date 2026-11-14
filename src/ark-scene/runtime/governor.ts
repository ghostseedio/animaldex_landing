/**
 * When the Ark draws, and how often (runtime lane, docs/ark/runtime-bridge.md).
 *
 * One small state machine, fed by the page and the apps, read by the frame
 * loop each display frame:
 *
 * - **paused**: the page is hidden (`document.hidden`), the world is scrolled
 *   off screen, or the app says the panel is covered (`ark:visible`). Nothing
 *   draws and the frame loop stops asking for frames until it is visible.
 * - **full**: someone is touching it, or something the reader is watching
 *   moves on its own (a camera flight, following, a replay, an animal
 *   talking, the opening, an arrival). Every display frame, up to the power
 *   cap.
 * - **calm**: no input for CALM_AFTER and nothing of the above: 30 fps.
 * - **drowsy**: no input for DROWSY_AFTER: 20 fps (the view drifting round
 *   on its own, an ambient screen).
 * - **still**: reduced motion and nothing moving (the water, grass and
 *   animals hold still): a few frames a second, for the clock and the models
 *   coming in.
 *
 * A fast display (100 Hz and up: a 120 Hz phone or laptop, a 144 Hz monitor) is drawn every other refresh (every
 * fourth at 240 Hz): 60 to 72 frames a second, each shown for the same time. Drawn at every refresh, a frame that
 * takes a little over one refresh slips to the next, and the picture alternates between 8 and 17 ms frames (a
 * judder a steady 60 does not have), at twice the battery and heat. The frame loop measures the refresh
 * (`setDisplayInterval`); a 60, 75 or 90 Hz display is drawn at its own rate, as before.
 *
 * Power (`ark:power` from the apps, else the Battery and Compute Pressure
 * APIs where the browser has them) caps the frame rate and asks for the low
 * tier: battery saver or `serious` heat 30 fps, `critical` heat 20 fps.
 *
 * Pure: the clock is passed in, so the tests drive it.
 */

import type {QualityTier} from "@/ark-scene/post";

export type ArkThermal = "nominal" | "fair" | "serious" | "critical";

/** What the device says about its power (`ark:power`), merged with the browser's own sources. */
export type ArkPower = {
    /** Battery saver / Low Power Mode is on. */
    saver: boolean;
    /** The device's heat: iOS ProcessInfo.thermalState, Android PowerManager thermal status, or the browser's CPU pressure. */
    thermal: ArkThermal;
    /** 0–1, or null when unknown. */
    battery: number | null;
    charging: boolean | null;
};

export const POWER_DEFAULT: ArkPower = {saver: false, thermal: "nominal", battery: null, charging: null};

export type ArkRenderMode = "paused" | "full" | "calm" | "drowsy" | "still";

/** What moves on its own this frame, besides the reader's input. */
export type ArkActivity = {
    /** A camera flight, the opening, following, a replay, a talking animal, an arrival's entrance, a tracked selection. */
    busy: boolean;
    /** Reduced motion: the world holds still unless the reader moves it. */
    reducedMotion: boolean;
};

/** Seconds without input before calm (30 fps) and drowsy (20 fps). */
export const CALM_AFTER = 5;
export const DROWSY_AFTER = 120;
/** Minimum ms between drawn frames per mode (0: every display frame). */
export const MODE_INTERVAL: Record<ArkRenderMode, number> = {paused: Infinity, full: 0, calm: 1000 / 30, drowsy: 1000 / 20, still: 1000 / 4};
/** A frame may come this much early (display frames jitter round the cap). */
const EARLY_MS = 4;
/** A display at least this fast (Hz) is drawn every `round(rate / 60)`th refresh. */
export const FAST_DISPLAY_HZ = 100;

/**
 * The ms between drawn frames a display of this refresh period asks for at full rate: 0 (every refresh) under
 * `FAST_DISPLAY_HZ`, else a whole number of refreshes nearest 60 a second (120 Hz: 16.7 ms, 144 Hz: 13.9 ms,
 * 240 Hz: 16.7 ms). Pure.
 */
export function displayCap(refreshMs: number): number {
    if (!(refreshMs > 0)) return 0;
    const hz = 1000 / refreshMs;
    if (hz < FAST_DISPLAY_HZ) return 0;
    return refreshMs * Math.max(Math.round(hz / 60), 1);
}

/** Display refresh rates a measured period snaps to (Hz), when within 7 %. */
const KNOWN_REFRESH_HZ = [60, 72, 75, 90, 100, 120, 144, 165, 240] as const;

/**
 * The display's refresh period from the gaps between animation-frame callbacks (ms): the gap a fifth of them are at or
 * under (a busy main thread stretches some gaps to two or three refreshes, never under one), snapped to a known rate.
 * 0 when there is too little to say. Pure.
 */
export function refreshPeriod(gaps: ArrayLike<number>, count: number): number {
    if (count < 20) return 0;
    const sorted = Array.from({length: count}, (_, i) => gaps[i]).filter((gap) => gap > 2 && gap < 100).sort((a, b) => a - b);
    if (sorted.length < 20) return 0;
    const low = sorted[Math.floor(sorted.length * 0.2)];
    for (const hz of KNOWN_REFRESH_HZ) if (Math.abs(low - 1000 / hz) / (1000 / hz) < 0.07) return 1000 / hz;
    return low;
}

/** A battery at or under this, not charging, counts as saver when the host says nothing. */
export const LOW_BATTERY = 0.2;

export const THERMAL_ORDER: Record<ArkThermal, number> = {nominal: 0, fair: 1, serious: 2, critical: 3};

/** Battery saver or heat: the most frames a second, and whether the low tier is asked for. */
export function powerCap(power: ArkPower): {interval: number; lowTier: boolean; pixelRatio: number | null} {
    const heat = THERMAL_ORDER[power.thermal] ?? 0;
    const saver = power.saver || (power.battery !== null && power.battery <= LOW_BATTERY && power.charging === false);
    if (heat >= 3) return {interval: 1000 / 20, lowTier: true, pixelRatio: 1};
    if (heat >= 2 || saver) return {interval: 1000 / 30, lowTier: true, pixelRatio: null};
    return {interval: 0, lowTier: false, pixelRatio: null};
}

export class RenderGovernor {
    private documentHidden = false;
    private onScreen = true;
    private hostVisible = true;
    private lastInput: number;
    private activity: ArkActivity = {busy: false, reducedMotion: false};
    private powerFromHost: Partial<ArkPower> | null = null;
    private powerFromBrowser: Partial<ArkPower> = {};
    /** The frame pacing's cap (ms between frames; 0: none): a phone locked to a steady 30 (`runtime/pace.ts`). */
    private paceCap = 0;
    /** The display's measured refresh period (ms; 0: not known yet), for the fast display's cap. */
    private refreshMs = 0;
    /** Called when the scene becomes visible again after a pause (the frame loop asks for frames again). */
    onWake: () => void = () => undefined;
    /** Called whenever the scene's visibility flips (either way): the ambient sound follows it. */
    onVisibility: (visible: boolean) => void = () => undefined;
    /** Called when the power cap's low-tier wish changes. */
    onPower: (power: ArkPower) => void = () => undefined;

    constructor(now: number) {
        this.lastInput = now;
    }

    // MARK: Inputs

    setDocumentHidden(hidden: boolean) {
        this.change(() => {
            this.documentHidden = hidden;
        });
    }

    setOnScreen(onScreen: boolean) {
        this.change(() => {
            this.onScreen = onScreen;
        });
    }

    /** `ark:visible` from the app: false while its panel is covered or the app is in the background. */
    setHostVisible(visible: boolean) {
        this.change(() => {
            this.hostVisible = visible;
        });
    }

    /** Pointer, wheel, key or a host command that moves the view. Seconds. */
    input(now: number) {
        this.lastInput = now;
    }

    setActivity(activity: ArkActivity) {
        this.activity = activity;
    }

    /** `ark:power` from the app (null: the app stopped saying; the browser's own sources again). */
    setHostPower(power: Partial<ArkPower> | null) {
        const before = this.power();
        this.powerFromHost = power;
        this.powerChanged(before);
    }

    /** The Battery / Compute Pressure APIs (only where the host says nothing). */
    setBrowserPower(power: Partial<ArkPower>) {
        const before = this.power();
        this.powerFromBrowser = {...this.powerFromBrowser, ...power};
        this.powerChanged(before);
    }

    // MARK: Outputs

    visible(): boolean {
        return !this.documentHidden && this.onScreen && this.hostVisible;
    }

    /** The power as the scene uses it: the host's word wins field by field over the browser's. */
    power(): ArkPower {
        return {...POWER_DEFAULT, ...this.powerFromBrowser, ...(this.powerFromHost ?? {})};
    }

    mode(now: number): ArkRenderMode {
        if (!this.visible()) return "paused";
        const quiet = now - this.lastInput;
        if (this.activity.busy || quiet < CALM_AFTER) return "full";
        if (this.activity.reducedMotion) return "still";
        return quiet < DROWSY_AFTER ? "calm" : "drowsy";
    }

    /** The least ms between drawn frames now (0: every display frame). */
    interval(now: number): number {
        const mode = this.mode(now);
        return Math.max(MODE_INTERVAL[mode], powerCap(this.power()).interval, this.paceCap);
    }

    /** The frame pacing's cap (`runtime/pace.ts`): 0, or the ms of a steady lower rate. */
    setPaceCap(ms: number) {
        this.paceCap = ms > 0 ? ms : 0;
    }

    /** The display's refresh period as the frame loop measured it (ms; 0: unknown): a fast display is drawn every other refresh. */
    setDisplayInterval(ms: number) {
        this.refreshMs = ms > 0 ? ms : 0;
    }

    /** The fast display's cap now (ms between drawn frames at full rate; 0: every refresh). */
    displayInterval(): number {
        return displayCap(this.refreshMs);
    }

    /** At full rate but for the pacing's own cap: the frames that tell the pacing what the device can hold. */
    drawsFull(now: number): boolean {
        return this.visible() && this.mode(now) === "full" && powerCap(this.power()).interval <= 0;
    }

    /** Whether to draw this display frame (`now` and `lastDrawn` in ms). */
    shouldDraw(nowMs: number, lastDrawnMs: number): boolean {
        if (!this.visible()) return false;
        const interval = this.interval(nowMs / 1000);
        if (!lastDrawnMs) return true;
        // Full rate on a fast display: every other refresh (half a refresh early is this refresh).
        const display = displayCap(this.refreshMs);
        if (interval <= display) return display <= 0 || nowMs - lastDrawnMs >= display - this.refreshMs / 2;
        return nowMs - lastDrawnMs >= interval - EARLY_MS;
    }

    /** Frames run at the display's own rate (the tier check only measures these). */
    uncapped(now: number): boolean {
        return this.visible() && this.interval(now) <= 0;
    }

    /** The tier the power asks for at most (null: no cap). */
    tierCap(): QualityTier | null {
        return powerCap(this.power()).lowTier ? "low" : null;
    }

    private change(apply: () => void) {
        const was = this.visible();
        apply();
        if (was !== this.visible()) this.onVisibility(this.visible());
        if (!was && this.visible()) this.onWake();
    }

    private powerChanged(before: ArkPower) {
        const after = this.power();
        const a = powerCap(before);
        const b = powerCap(after);
        if (a.interval !== b.interval || a.lowTier !== b.lowTier || a.pixelRatio !== b.pixelRatio) this.onPower(after);
    }
}
