/**
 * Watching an act as it happens (V1 "hunting and mating you can see"): a tapped line of the live log whose act is
 * under way, or about to begin (`ark-act-hold.ts`), is watched with V2's own camera run live (`replay/shot.ts`, `live`):
 * everyone the record names in the picture (a stand-in for whoever has left the read), a clear view of them (the
 * scene's lines of sight, the cutaway, the leaves dissolved to them), two that share the picture held in it, the night
 * lifted. The clock is the Ark's own: nothing is replayed, moved on or run fast, so every viewer watching sees the
 * same moment.
 *
 * It ends when the act is over and the camera has lingered, when the viewer touches the view (it is theirs again at
 * once), or when another line is tapped. While it runs nothing is selected (the selection's own camera would pull
 * the other way); when it ends on its own, `onEnd("done")` lets the log select the act's first animal as its tap
 * always has.
 */

import type {ArkCast} from "@/ark-scene/replay/cast";
import type {ArkEventReplay} from "@/ark-scene/replay/event-replay";
import {createArkReplayShot, type ArkReplayShot, type ArkReplayShotReport} from "@/ark-scene/replay/shot";
import type {ArkCameraView, ArkSceneHandle} from "@/ark-scene/types";

/** The camera's way in from where the viewer was (s), the linger after the act (s), and the longest a watch runs (s). */
const FLY_SECONDS = 1.4;
const LINGER_SECONDS = 6;
const MOST_SECONDS: Record<string, number> = {mated: 150, birth: 60, death: 40, extinct: 45, meal: 120, escaped: 60};

export type ArkWatchEnd = "done" | "touched" | "replaced" | "disposed";

export type ArkWatchOptions = {
    handle: ArkSceneHandle;
    cast: ArkCast;
    replay: ArkEventReplay;
    /** The picture's width over its height. */
    aspect: () => number;
    onEnd?: (why: ArkWatchEnd, report: ArkReplayShotReport) => void;
    /** The frame clock: `performance.now()` in seconds (a test's, the harness's). */
    now?: () => number;
    /** The next frame (`requestAnimationFrame`; the harness steps it itself). */
    frame?: (step: () => void) => void;
};

export type ArkWatch = {
    eventId: string;
    /** One frame (called by the watch's own loop; the harness may call it instead). */
    step: () => void;
    stop: (why: ArkWatchEnd) => void;
    running: () => boolean;
    report: () => ArkReplayShotReport;
    /** Seconds since the watch began, and when the act was over (null while it runs). */
    clock: () => {t: number; doneAt: number | null; keyAt: number | null};
};

const ease = (k: number) => {
    const c = Math.min(Math.max(k, 0), 1);
    return c * c * (3 - 2 * c);
};

/** Between two views (the way in): the target and the angles the short way, the distance by its ratio. */
export function mixArkViews(from: ArkCameraView, to: ArkCameraView, k: number): ArkCameraView {
    const turn = Math.atan2(Math.sin(to.azimuth - from.azimuth), Math.cos(to.azimuth - from.azimuth));
    return {
        target: {x: from.target.x + (to.target.x - from.target.x) * k, y: from.target.y + (to.target.y - from.target.y) * k, z: from.target.z + (to.target.z - from.target.z) * k},
        distance: Math.exp(Math.log(Math.max(from.distance, 1e-3)) + (Math.log(Math.max(to.distance, 1e-3)) - Math.log(Math.max(from.distance, 1e-3))) * k),
        polar: from.polar + (to.polar - from.polar) * k,
        azimuth: from.azimuth + turn * k
    };
}

/** A low tier's scene without its lines of sight (each search is a burst of rays): the shot then uses the cheap clear bearing. */
function forTier(handle: ArkSceneHandle): ArkSceneHandle {
    let low = false;
    try {
        const stats = handle.stats();
        low = stats.tier === "low" || stats.lite;
    } catch {
        low = false;
    }
    return low ? Object.assign(Object.create(handle) as ArkSceneHandle, {sightOf: undefined}) : handle;
}

export function startArkWatch(options: ArkWatchOptions): ArkWatch {
    const {handle, replay} = options;
    const now = options.now ?? (() => performance.now() / 1000);
    const frame = options.frame ?? ((step: () => void) => void requestAnimationFrame(step));
    const shot: ArkReplayShot = createArkReplayShot({handle: forTier(handle), replay, aspect: options.aspect, lead: 0.5, live: true, cast: options.cast});
    const from = handle.view();
    const began = now();
    let last = began;
    let running = true;
    // (Nothing chosen while it runs: the selection's own camera follows its animal.)
    handle.select(null);
    handle.follow(null);
    shot.begin();
    const stop = (why: ArkWatchEnd) => {
        if (!running) return;
        running = false;
        const report = shot.report();
        shot.end();
        options.onEnd?.(why, report);
    };
    const step = () => {
        if (!running) return;
        const at = now();
        const t = at - began;
        const dt = Math.min(Math.max(at - last, 0), 0.25);
        last = at;
        const view = shot.step(t, dt);
        if (view) handle.setView(t < FLY_SECONDS ? mixArkViews(from, view, ease(t / FLY_SECONDS)) : view);
        const done = shot.doneAt();
        if ((done !== null && t > done + LINGER_SECONDS) || t > (MOST_SECONDS[replay.kind] ?? 90)) {
            stop("done");
            return;
        }
        frame(step);
    };
    frame(step);
    return {eventId: replay.eventId, step, stop, running: () => running, report: () => shot.report(), clock: () => ({t: now() - began, doneAt: shot.doneAt(), keyAt: shot.report().keyAt})};
}
