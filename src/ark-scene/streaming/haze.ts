/**
 * The edge haze (Part B, docs/ark/streaming.md): beyond the render distance nothing is drawn, so the world fades into
 * the horizon's colour before it. It is the scene's own fog, pulled in: whoever sets the fog (the scene, the weather)
 * sets its base, and what three reads is the nearer of that and the haze. With the haze off the fog is exactly its
 * base, so a world that fits inside the render distance looks as it did.
 *
 * Three's linear fog is by depth along the view, and chunks are culled by distance from the eye; a chunk just past
 * the distance at the corner of the picture is nearer in depth than straight ahead, so the haze is whole at the
 * distance times the cosine of the view's half diagonal (`hazeEndDepth`).
 */

/** The part of three's Fog the haze needs (near and far are replaced by accessors on the instance). */
type LinearFog = {near: number; far: number};

export type ArkHaze = {
    /** This frame's haze: whole at depth `end` (m), starting at `start`, `strength` 0…1 (0: the fog's own). */
    set(start: number, end: number, strength: number): void;
    /** The haze now (for the measurement page and tests). */
    readonly state: {start: number; end: number; strength: number};
    /** The fog's own values (the weather's, the scene's), before the haze. */
    readonly base: {near: number; far: number};
    /**
     * Decision 142 (both islands side by side): the clear-weather fog's reach, pushed out from the scene's own (the
     * values the fog had when installed). Only the clear part moves: weather closing in (rain, fog, a storm: the base
     * pulled nearer) keeps its own distances, blended by how clear the base is.
     */
    setClear(near: number, far: number): void;
};

/** Past this many metres beyond the haze's end at strength 0 it can never be the nearer: the fog's own. */
const FADE_REACH = 4000;

/** Install the haze on a linear fog (its `near` and `far` become accessors; the values set stay its base). */
export function hazeFog(fog: LinearFog): ArkHaze {
    const base = {near: fog.near, far: fog.far};
    // The scene's clear-weather fog (as installed), and where it is pushed to.
    const installed = {near: fog.near, far: fog.far};
    const clear = {near: fog.near, far: fog.far};
    /** The base with its clear part pushed: 1 for clear weather, falling to 0 as the weather closes the fog in. */
    const pushed = (value: number, which: "near" | "far") => {
        if (clear.near === installed.near && clear.far === installed.far) return value;
        const clearness = Math.min(Math.max(base.far / installed.far, 0), 1) ** 2;
        return value + (clear[which] - installed[which]) * clearness;
    };
    const state = {start: Infinity, end: Infinity, strength: 0};
    const near = () => (state.strength > 0 ? state.start + (1 - state.strength) * FADE_REACH : Infinity);
    const far = () => (state.strength > 0 ? state.end + (1 - state.strength) * FADE_REACH : Infinity);
    Object.defineProperty(fog, "near", {
        configurable: true,
        enumerable: true,
        get: () => Math.min(pushed(base.near, "near"), near()),
        set: (value: number) => {
            base.near = value;
        }
    });
    Object.defineProperty(fog, "far", {
        configurable: true,
        enumerable: true,
        get: () => Math.min(pushed(base.far, "far"), Math.max(far(), Math.min(pushed(base.near, "near"), near()) + 1)),
        set: (value: number) => {
            base.far = value;
        }
    });
    return {
        set(start: number, end: number, strength: number) {
            state.start = start;
            state.end = Math.max(end, start + 1);
            state.strength = Math.min(Math.max(strength, 0), 1);
        },
        state,
        base,
        setClear(nearTo: number, farTo: number) {
            clear.near = nearTo;
            clear.far = farTo;
        }
    };
}

/**
 * The depth (m) at which a point `distance` m from the eye is sure to be, anywhere in the picture: `distance` times
 * the cosine of the view's half diagonal (vertical field of view in degrees, width over height).
 */
export function hazeEndDepth(distance: number, fovDegrees: number, aspect: number): number {
    const vertical = Math.tan((fovDegrees * Math.PI) / 360);
    const horizontal = vertical * Math.max(aspect, 1e-3);
    const halfDiagonal = Math.atan(Math.sqrt(vertical * vertical + horizontal * horizontal));
    return distance * Math.cos(halfDiagonal);
}
