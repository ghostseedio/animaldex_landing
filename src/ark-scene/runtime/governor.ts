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
        return Math.max(MODE_INTERVAL[mode], powerCap(this.power()).interval);
    }

    /** Whether to draw this display frame (`now` and `lastDrawn` in ms). */
    shouldDraw(nowMs: number, lastDrawnMs: number): boolean {
        if (!this.visible()) return false;
        const interval = this.interval(nowMs / 1000);
        if (interval <= 0 || !lastDrawnMs) return true;
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
