import type {RecordClock} from "@/ark-scene/record-clock";
import type {ArkCameraView, ArkSceneHandle, ArkSnapshot} from "@/ark-scene/types";
import type {ArkDirection, ArkMarks} from "@/lib/ark-clips/shots";
import {MOMENT_SECONDS} from "@/ark-scene/moments";

/**
 * The clip recorder's director (`/ark?record=1`, `window.__arkDirector`):
 * scripted camera moves over the live scene, one exact video frame per call,
 * so the recorder never clicks or waits on wall-clock time.
 *
 *   info()            the Ark it was given (and whether it is the fixture), and the event log
 *   prepare(d)        the light, every model loaded, the first view: resolves when ready
 *   frame()           moves time on by 1/30 s and returns that frame as a JPEG data URL
 *   marks()           when the act began and ended, for the captions
 *
 * Camera moves only: what happens (an arrival, a meal) comes from the data,
 * through the scene's own entrance and replay.
 */

export const DIRECTOR_FPS = 30;

/** `events` is the event log as the server answers it (decodeArkEvents reads it). */
export type ArkDirectorInfo = {snapshot: ArkSnapshot; fixture: boolean; events: unknown};

export type ArkDirectorFrame = {index: number; t: number; done: boolean; image: string};

export type ArkDirector = {
    info: () => ArkDirectorInfo;
    prepare: (direction: ArkDirection) => Promise<{models: number}>;
    frame: (quality?: number) => ArkDirectorFrame;
    marks: () => ArkMarks;
};

type Point = {x: number; y: number; z: number};

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);
const clamp01 = (k: number) => Math.min(Math.max(k, 0), 1);

function lerpView(a: ArkCameraView, b: ArkCameraView, k: number): ArkCameraView {
    return {
        target: {x: lerp(a.target.x, b.target.x, k), y: lerp(a.target.y, b.target.y, k), z: lerp(a.target.z, b.target.z, k)},
        distance: lerp(a.distance, b.distance, k),
        polar: lerp(a.polar, b.polar, k),
        azimuth: lerp(a.azimuth, b.azimuth, k)
    };
}

/** The bearing from the island's middle out to a point: the camera stands outside, looking in. */
function outward(point: Point): number {
    return Math.hypot(point.x, point.z) > 1 ? Math.atan2(point.x, point.z) : 0;
}

export function createArkDirector(options: {handle: ArkSceneHandle; clock: RecordClock; canvas: () => HTMLCanvasElement | null; info: ArkDirectorInfo}): ArkDirector {
    const {handle, clock} = options;
    let direction: ArkDirection | null = null;
    let index = 0;
    const marks: ArkMarks = {start: 0, act: 0, actEnd: 0, end: 0, total: 0};
    // The act (a meal's replay): when it started and whether it is still running.
    let playing = false;
    let played = false;
    let actView: ArkCameraView | null = null;
    // The subject as the camera last saw it (smoothed), and the view each shot starts from.
    let tracked: Point | null = null;
    let home: ArkCameraView = handle.homeView();
    let anchor: ArkCameraView = home;
    /** Which way the subject faced as the shot began (a moment heads that way). */
    let anchorYaw = 0;

    const subjectPoint = (): Point | null => {
        if (!direction?.subject) return null;
        const at = handle.locate(direction.subject);
        return at ? {x: at.x, y: at.y, z: at.z} : null;
    };
    const subjectSize = () => {
        const at = direction?.subject ? handle.locate(direction.subject) : null;
        return {length: at?.length ?? 1, ground: at?.ground ?? 0, height: at?.height ?? 1};
    };

    /** The subject, smoothed: `k` of the way to where it is now, each frame. */
    const track = (k: number): Point | null => {
        const at = subjectPoint();
        if (at) tracked = tracked ? {x: lerp(tracked.x, at.x, k), y: lerp(tracked.y, at.y, k), z: lerp(tracked.z, at.z, k)} : at;
        return tracked;
    };

    /** The planned total before the act's length is known; the act shots grow by it. */
    const plannedTotal = (d: ArkDirection) => d.lead + d.linger + d.end;

    const arrivalFraming = (): ArkCameraView => {
        const at = subjectPoint() ?? {x: 0, y: 0, z: 0};
        const size = subjectSize();
        return {target: {x: at.x, y: size.ground + 0.5, z: at.z}, distance: 8 + size.length * 3.2, polar: 1.12, azimuth: outward(at)};
    };

    /** The view at time `t` for the shots the director films alone (everything but a meal's act). */
    const viewAt = (d: ArkDirection, t: number, total: number): ArkCameraView | null => {
        const u = clamp01(t / Math.max(total, 0.001));
        switch (d.kind) {
            case "day_to_night":
                return {target: home.target, distance: home.distance * 0.8, polar: lerp(1.0, 1.1, u), azimuth: lerp(home.azimuth - 0.55, home.azimuth + 0.55, u)};
            case "flyover": {
                const k = ease(u);
                const from: ArkCameraView = {target: {x: home.target.x, y: 0, z: home.target.z - 16}, distance: home.distance * 1.05, polar: 0.6, azimuth: home.azimuth - 1.25};
                const to: ArkCameraView = {target: home.target, distance: home.distance * 0.62, polar: 1.13, azimuth: home.azimuth + 1.35};
                return lerpView(from, to, k);
            }
            case "follow":
            case "meet": {
                const centre = track(d.kind === "follow" ? 0.3 : 0.14) ?? anchor.target;
                const size = subjectSize();
                const push = ease(clamp01(t / 2.5));
                const near = d.kind === "meet" ? 5 + size.length * 2.4 : 6 + size.length * 3;
                const distance = lerp(near * (d.kind === "meet" ? 1.7 : 1.35), near, push) * (d.kind === "meet" ? 1 - 0.08 * u : 1);
                const y = d.kind === "meet" ? Math.max(centre.y, size.ground + size.height * 0.45) : centre.y;
                return {target: {x: centre.x, y, z: centre.z}, distance, polar: d.kind === "meet" ? 1.2 : 1.12, azimuth: anchor.azimuth + (d.kind === "meet" ? 0.035 : 0.11) * t};
            }
            case "arrival": {
                const framing = arrivalFraming();
                if (t < d.lead) {
                    const from: ArkCameraView = {target: {x: lerp(home.target.x, framing.target.x, 0.6), y: framing.target.y, z: lerp(home.target.z, framing.target.z, 0.6)}, distance: Math.max(framing.distance * 4.5, 45), polar: 0.92, azimuth: framing.azimuth - 0.35};
                    return lerpView(from, framing, ease(t / d.lead));
                }
                // After it lands the camera keeps it in view (a flyer takes to the air), backing off a little.
                const since = t - d.lead;
                const at = since > 0.6 ? track(0.12) : null;
                const centre = at ? {x: at.x, y: Math.max(at.y - 0.3, framing.target.y), z: at.z} : framing.target;
                return {target: centre, distance: framing.distance * (1 + 0.25 * ease(clamp01((since - 0.6) / 3))), polar: framing.polar, azimuth: framing.azimuth + 0.085 * since};
            }
            case "seabird_dive":
            case "whale_surface":
            case "owl_swoop":
            case "primate_drop": {
                // A cross-layer moment: the camera keeps the animal in the middle of the frame as the moment takes it
                // (out to sea and down into it, up through the surface, off its branch to the ground and back): it
                // follows closely (a fast swoop would leave a slow follow behind), wide enough for the whole path,
                // from the side of the path rather than along it, drifting round a little.
                const centre = track(t < d.lead ? 0.3 : 0.35) ?? anchor.target;
                const size = subjectSize();
                const wide = d.kind === "seabird_dive" ? 24 : d.kind === "whale_surface" ? 14 + size.length * 2 : d.kind === "owl_swoop" ? 13 : 8 + size.length * 2;
                const push = ease(clamp01(t / Math.max(d.lead, 0.1)));
                const polar = d.kind === "whale_surface" ? 1.2 : d.kind === "seabird_dive" ? 1.0 : 1.12;
                // Across the way it heads (an owl swoops forward from its branch): a quarter turn from its facing.
                const across = d.kind === "owl_swoop" || d.kind === "primate_drop" ? anchorYaw + Math.PI / 2 : anchor.azimuth;
                return {target: {x: centre.x, y: Math.max(centre.y, d.kind === "whale_surface" ? -0.5 : centre.y), z: centre.z}, distance: lerp(wide * 1.5, wide, push), polar, azimuth: across + 0.03 * t};
            }
            case "meal_chase": {
                const at = subjectPoint() ?? {x: 0, y: 0, z: 0};
                if (!played) {
                    // The way in: high over the hunter's ground, slowly lower.
                    const k = ease(clamp01(t / Math.max(d.lead, 0.1)));
                    return {target: {x: at.x, y: Math.max(at.y, 0), z: at.z}, distance: lerp(70, 60, k), polar: lerp(0.86, 0.95, k), azimuth: outward(at) - 0.2 + 0.1 * k};
                }
                // After the act: a cut to the hunter's ground from higher up, turning slowly (a cut-away act ended out at sea).
                const since = t - marks.actEnd;
                const bearing = actView?.azimuth ?? outward(at);
                return {target: {x: at.x, y: Math.max(at.y, 0), z: at.z}, distance: 38, polar: 0.98, azimuth: bearing + 0.06 * since};
            }
        }
    };

    const total = () => {
        if (!direction) return 0;
        if (direction.act && direction.kind === "meal_chase") {
            if (!played) return Infinity;
            return Math.max(marks.actEnd + direction.linger + direction.end, direction.minSeconds);
        }
        if (direction.kind === "arrival") return Math.max(direction.lead + 2.4 + direction.linger + direction.end, direction.minSeconds);
        return Math.max(plannedTotal(direction), direction.minSeconds);
    };

    const hoursAt = (d: ArkDirection, t: number, length: number) => lerp(d.hours.from, d.hours.to, d.kind === "day_to_night" ? ease(clamp01(t / Math.max(length - d.end, 0.001))) : clamp01(t / Math.max(length, 0.001)));

    const capture = (quality: number): string => {
        const canvas = options.canvas();
        return canvas ? canvas.toDataURL("image/jpeg", quality) : "";
    };

    return {
        info: () => options.info,
        prepare: async (next) => {
            direction = next;
            index = 0;
            playing = false;
            played = false;
            actView = null;
            tracked = null;
            Object.assign(marks, {start: 0, act: next.lead, actEnd: next.lead, end: 0, total: 0});
            handle.setHours(next.hours.from);
            home = handle.homeView();
            // Every species aboard, near and far, so nothing pops in during the shot.
            const slugs = Array.from(new Set([...next.preload, ...options.info.snapshot.animals.map((animal) => animal.model_slug)]));
            await handle.preload(slugs);
            if (next.kind === "arrival" && next.subject) handle.hold(next.subject);
            // The scene's own follow too: it keeps the view at the animal's height (a flyer in the air) instead of easing it to the ground.
            if ((next.kind === "follow" || next.kind === "meet") && next.subject) handle.follow(next.subject);
            else handle.follow(null);
            // Frames without time passing, until every model is in and placed (at most two minutes).
            const until = Date.now() + 120_000;
            let quietSince = 0;
            while (Date.now() < until) {
                const first = next.subject ? handle.locate(next.subject) : null;
                // "Meet": from in front and to one side of it (its face, not its back); otherwise from outside the island looking in.
                if (first && !tracked) {
                    anchor = {...home, target: {x: first.x, y: first.y, z: first.z}, azimuth: next.kind === "meet" ? first.yaw + 0.55 : outward(first)};
                    anchorYaw = first.yaw;
                }
                const view = viewAt(next, 0, plannedTotal(next));
                if (view) handle.setView(view);
                clock.tick(0);
                if (handle.loading()) quietSince = 0;
                else if (!quietSince) quietSince = Date.now();
                else if (Date.now() - quietSince > 1200) break;
                await new Promise((resolve) => setTimeout(resolve, 60));
            }
            tracked = null;
            return {models: handle.stats().modelsLoaded};
        },
        frame: (quality = 0.92) => {
            const d = direction;
            if (!d) throw new Error("prepare() first");
            const t = index / DIRECTOR_FPS;
            // The act: an arrival is the scene's own entrance, a meal its replay (which flies the camera itself).
            if (d.kind === "arrival" && d.subject && index === Math.round(d.lead * DIRECTOR_FPS)) {
                handle.arrive(d.subject);
                handle.follow(d.subject);
                marks.act = t;
                marks.actEnd = t + 2.4;
            }
            if (d.kind === "meal_chase" && d.act && !playing && !played && t >= d.lead) {
                playing = true;
                marks.act = t;
                const run = handle.play([d.act]);
                void run.done.then(() => {
                    playing = false;
                    played = true;
                    marks.actEnd = index / DIRECTOR_FPS;
                    actView = handle.view();
                });
            }
            // A cross-layer moment begins as the lead ends (the scene acts it out; cosmetic only).
            if (d.subject && (d.kind === "seabird_dive" || d.kind === "whale_surface" || d.kind === "owl_swoop" || d.kind === "primate_drop") && index === Math.round(d.lead * DIRECTOR_FPS)) {
                handle.moment(d.kind, d.subject);
                marks.act = t;
                marks.actEnd = t + MOMENT_SECONDS[d.kind];
            }
            const length = total();
            if (!playing) {
                const view = viewAt(d, t, Number.isFinite(length) ? length : plannedTotal(d));
                if (view) handle.setView(view);
            }
            if (d.hours.from !== d.hours.to || index === 0) handle.setHours(hoursAt(d, t, Number.isFinite(length) ? length : plannedTotal(d)));
            clock.tick(1000 / DIRECTOR_FPS);
            const image = capture(quality);
            index += 1;
            const now = index / DIRECTOR_FPS;
            const finished = Number.isFinite(length) && now >= length;
            if (finished) {
                marks.total = now;
                marks.end = Math.max(now - d.end, 0);
                if (!d.act && d.kind !== "arrival" && !(d.kind in MOMENT_SECONDS)) {
                    marks.act = marks.end;
                    marks.actEnd = marks.end;
                }
            }
            // A runaway act (models that never came) still ends: a minute is the most any clip runs.
            return {index: index - 1, t, done: finished || now >= 60, image};
        },
        marks: () => ({...marks, total: marks.total || index / DIRECTOR_FPS, end: marks.end || Math.max(index / DIRECTOR_FPS - (direction?.end ?? 0), 0)})
    };
}
