/**
 * A replay's shot (V2 replay; the recorder's director loads this only for a `replay=<event id>` shot, `director.ts`):
 * the clock pinned to the event's own time, everyone it names brought in and pinned (`cast.ts`), the scene's own live
 * layers fed the record (`event-replay.ts` `feed`), and the camera kept on all of them.
 *
 * It films; it never acts. What the animals do is the live layers' (`live-matings`, `live-births`, `live-deaths`,
 * `live-meals`, `live-escapes`) and the scene's own replay (`play`, a hatching) and entrance (`arrive`, a release),
 * exactly as a viewer watching at that moment had them. The shot's own part:
 *
 * - the clock: `pinArkClock(t0 - lead)`, so the scene's world time (schedules, the layers, the light) is the event's;
 *   a CUT is the pin moved on (a long walk to a mate, a long stalk: the clip shows its end), and the extinction's
 *   last minutes are run fast while the camera pulls back (the body's fade is the death layer's, 3 minutes long);
 * - the frame: the point between the two farthest of the cast that are drawn and the least distance that holds them
 *   (`pair-frame.ts` framePair, `runtime/camera.ts` meetDistance: the selection's own framing), eased;
 * - an editorial default (the audit, §2.4): at a mating's mount the camera pulls up and away and the clip goes on
 *   with the two resting together; `mount: "show"` films it.
 *
 * `step(t, dt)` is called once per video frame, before the frame is drawn.
 */

import {arkEpochSeconds, pinArkClock} from "@/ark-scene/shared-clock";
import {easeToward, framePair} from "@/ark-scene/pair-frame";
import {meetDistance} from "@/ark-scene/runtime/camera";
import {attachArkCast, type ArkCast} from "@/ark-scene/replay/cast";
import {DEATH_BODY_SECONDS, DEATH_FADE_SECONDS} from "@/ark-scene/live-deaths";
import type {ArkEventReplay} from "@/ark-scene/replay/event-replay";
import type {ArkCameraView, ArkLocated, ArkSceneHandle} from "@/ark-scene/types";

const FOV = 38;

export type ArkReplayShotOptions = {
    handle: ArkSceneHandle;
    replay: ArkEventReplay;
    /** Width over height of the picture. */
    aspect: () => number;
    /** Seconds of the animals' own day before the event (the clock is pinned this long before it). */
    lead: number;
    /** A mating's mount: the camera pulls away (the default, the audit's editorial judgement), or films it. */
    mount?: "cutaway" | "show";
    /** Keep the roster as it was at the event's time (who came aboard later is left out). Default true. */
    asOf?: boolean;
};

export type ArkReplayShotReport = {
    eventId: string;
    kind: string;
    /** The event's time the clock was pinned to (epoch s). */
    t0: number;
    /** Cast ids not in the Ark's read (they stood in), everyone pinned, and how many later arrivals were left out. */
    standIns: string[];
    pins: string[];
    dropped: number;
    /** Whether the scene's layer acted it; when not, why (the two too far apart, a cut-away pair, no model…). */
    acted: boolean;
    reason: string | null;
    /** The cuts made: clip seconds, and how far the clock was moved on (s). */
    cuts: Array<{at: number; skipped: number; why: string}>;
    /** Per cast id: the share of the act's frames it was drawn in, and its role. */
    seen: Record<string, {role: string; frames: number; shown: number}>;
};

export type ArkReplayShot = {
    /** Pin the clock, bring the cast in, feed the layers. Call once, then draw frames until the models are in. */
    begin: () => void;
    /**
     * After the frames that let the scene settle on the pinned moment (the light's ease to that hour, each animal's
     * first step of its day there): the clock back to where the shot starts, `lead` seconds before the event.
     */
    settle: () => void;
    /** One video frame at clip second `t` (`dt` since the last): the view to set, or null while the scene's own replay flies the camera. */
    step: (t: number, dt: number) => ArkCameraView | null;
    /** Clip seconds at which the act was over (the camera lingers after); null while it runs. */
    doneAt: () => number | null;
    /** Clip seconds the act began at. */
    actAt: () => number;
    report: () => ArkReplayShotReport;
    /** The real clock again, the cast gone. */
    end: () => void;
};

type Point = {x: number; y: number; z: number};
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const clamp01 = (k: number) => Math.min(Math.max(k, 0), 1);
const ease = (k: number) => {
    const c = clamp01(k);
    return c * c * (3 - 2 * c);
};
/** The bearing from the island's middle out to a point: the camera stands outside, looking in (the director's rule). */
const outward = (p: {x: number; z: number}) => (Math.hypot(p.x, p.z) > 1 ? Math.atan2(p.x, p.z) : 0);
const nearer = (from: number, to: number) => from + Math.atan2(Math.sin(to - from), Math.cos(to - from));

export function createArkReplayShot(options: ArkReplayShotOptions): ArkReplayShot {
    const {handle, replay} = options;
    const lead = Math.max(options.lead, 0.5);
    const t0 = replay.t0;
    const key = `replay:${replay.eventId}`;
    const cast: ArkCast = attachArkCast(handle);
    const ids = replay.cast.map((member) => member.record.id);
    const roleOf = new Map(replay.cast.map((member) => [member.record.id, member.role]));
    const byRole = (role: string) => replay.cast.filter((member) => member.role === role).map((member) => member.record.id);
    const report: ArkReplayShotReport = {eventId: replay.eventId, kind: replay.kind, t0, standIns: [], pins: [], dropped: 0, acted: false, reason: null, cuts: [], seen: Object.fromEntries(replay.cast.map((member) => [member.record.id, {role: member.role, frames: 0, shown: 0}]))};

    let done: number | null = null;
    let ended = false;
    let actAt = lead;
    let clip = 0;
    /** The camera as last set (eased from). */
    let view: ArkCameraView | null = null;
    let cutOnce = new Set<string>();
    let playing: {over: boolean} | null = null;
    let arrived = false;
    let lapseFrom: number | null = null;
    let state = "lead";
    let stateAt = 0;
    const enter = (next: string) => {
        if (state === next) return;
        state = next;
        stateAt = clip;
    };
    const since = () => arkEpochSeconds() - t0;

    /** Move the clock on to `s` seconds after the event: a cut. The camera snaps (no easing across a cut). */
    const cut = (s: number, why: string) => {
        const now = since();
        if (cutOnce.has(why) || s <= now + 0.5) return;
        cutOnce.add(why);
        pinArkClock(t0 + s);
        report.cuts.push({at: Math.round(clip * 100) / 100, skipped: Math.round((s - now) * 10) / 10, why});
        view = null;
    };

    const located = (list: string[]): Array<ArkLocated & {id: string}> => list.map((id) => ({id, at: handle.locate(id)})).filter((item): item is {id: string; at: ArkLocated} => Boolean(item.at)).map((item) => ({...item.at, id: item.id}));

    /**
     * The view that holds these animals: the two farthest apart framed together (the selection's pair framing), or the
     * one alone at its meeting distance; side on to the line between them, from the island's outer side.
     */
    const frameOf = (list: string[], style: {polar?: number; widen?: number; max?: number} = {}): {target: Point; distance: number; azimuth: number; polar: number} | null => {
        const all = located(list);
        const drawn = all.filter((at) => at.shown !== false);
        const who = drawn.length ? drawn : all;
        if (!who.length) return null;
        const aspect = options.aspect();
        let a = who[0];
        let b = who[0];
        let far = 0;
        for (const p of who) for (const q of who) {
            const d = Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z);
            if (d > far) {
                far = d;
                a = p;
                b = q;
            }
        }
        const length = Math.max(...who.map((p) => p.length), 0.01);
        const single = meetDistance(length, aspect, FOV);
        const max = style.max ?? 150;
        const pair = a === b ? null : framePair({x: a.x, y: a.y, z: a.z, length: a.length}, {x: b.x, y: b.y, z: b.z, length: b.length}, {fovDeg: FOV, aspect, single, max});
        const centre = pair ?? {x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2};
        // (Farther apart than the pair framing takes: the same fit, as far back as it needs, up to `max`.)
        const narrow = Math.tan((FOV * Math.PI) / 360) * Math.min(Math.max(aspect, 0.3), 1);
        const fit = (far / 2 + length * 0.6) / (0.7 * narrow);
        const distance = Math.min(Math.max(pair?.distance ?? Math.max(single, fit), single), max) * (style.widen ?? 1);
        const across = far > Math.max(length * 0.5, 0.2) ? Math.atan2(b.z - a.z, -(b.x - a.x)) : outward(centre);
        const out = outward(centre);
        const side = Math.cos(across - out) >= 0 ? across : across + Math.PI;
        return {target: {x: centre.x, y: centre.y, z: centre.z}, distance, azimuth: side, polar: style.polar ?? 1.12};
    };

    /** Toward a framing, eased (snapped after a cut or on the first frame); the bearing never swings more than it must. */
    const toward = (want: {target: Point; distance: number; azimuth: number; polar: number} | null, dt: number, rate = 2.4, turn = 0.6): ArkCameraView | null => {
        if (!want) return view;
        if (!view) {
            view = {target: {...want.target}, distance: want.distance, polar: want.polar, azimuth: want.azimuth};
            return view;
        }
        const azimuth = nearer(view.azimuth, want.azimuth);
        view = {
            target: {x: easeToward(view.target.x, want.target.x, dt, rate), y: easeToward(view.target.y, want.target.y, dt, rate), z: easeToward(view.target.z, want.target.z, dt, rate)},
            distance: easeToward(view.distance, want.distance, dt, rate * 0.8),
            polar: easeToward(view.polar, want.polar, dt, rate * 0.6),
            azimuth: easeToward(view.azimuth, azimuth, dt, turn)
        };
        return view;
    };
    /** Holding on a framing with a slow drift round it (the linger after the act, a shot with nothing to wait for). */
    const drift = (want: ReturnType<typeof frameOf>, dt: number, per = 0.05) => {
        const next = toward(want ? {...want, azimuth: view?.azimuth ?? want.azimuth} : null, dt);
        if (next) next.azimuth += per * dt;
        return next;
    };

    const finish = (acted: boolean, reason: string | null = null) => {
        if (done !== null) return;
        done = clip;
        report.acted = acted;
        report.reason = reason;
    };
    const count = () => {
        if (state === "lead" || done !== null) return;
        for (const at of located(ids)) {
            const seen = report.seen[at.id];
            seen.frames++;
            if (at.shown) seen.shown++;
        }
    };

    // MARK: The kinds

    const stepMated = (dt: number) => {
        const s = since();
        const act = handle.liveActs?.().matings.find((m) => m.key === replay.feed.matings![0].key);
        if (s < 0) return toward(frameOf(ids, {widen: 1.15}), dt);
        if (!act || act.phase === "skipped") {
            // (Different islands, more than 160 m apart, or one of them off its schedule: the layer does not walk them across.)
            if (s > 1.5) {
                enter("still");
                if (clip - stateAt > 7) finish(false, act ? "the mating layer skipped it: the two live in different worlds, are too far apart or have no day to walk from" : "the mating was not taken up by the scene (one of the two is not drawn)");
            }
            return drift(frameOf(ids, {widen: 1.15}), dt);
        }
        const meet = act.meet;
        const courted = act.courted;
        const mounted = act.mounted;
        if (meet === undefined || courted === undefined || mounted === undefined) return toward(frameOf(ids, {widen: 1.15}), dt);
        // A contest first (rival males): its last bouts and the loser's flight; then the walk's last seconds.
        if (act.contestEnd && s < act.contestEnd - 9.5) cut(act.contestEnd - 9, "to the contest's end");
        else if (s >= (act.contestEnd ?? 0) && meet - s > 7.5) cut(meet - 7, "to the end of the walk to each other");
        const now = since();
        if (now < courted - 0.2) {
            enter("court");
            return toward(frameOf(ids, {widen: 1.1}), dt);
        }
        if (options.mount !== "show") {
            if (state !== "away" && state !== "rest" && state !== "over") enter("away");
            if (state === "away") {
                // Up and away as it begins; then on to the two resting together.
                const k = ease((clip - stateAt) / 2.6);
                const frame = frameOf(ids);
                if (clip - stateAt > 2.6) {
                    cut(mounted + 2.4, "past the mount");
                    enter("rest");
                    return toward(frameOf(ids, {widen: 1.2}), dt);
                }
                return toward(frame ? {...frame, distance: frame.distance * lerp(1.1, 3.2, k), polar: lerp(1.12, 0.72, k)} : null, dt, 3.5);
            }
        } else if (now < mounted + 2.4) {
            enter("mount");
            return toward(frameOf(ids, {widen: 1.1}), dt);
        } else enter("rest");
        if (state === "rest" && clip - stateAt > 5) finish(true);
        return drift(frameOf(ids, {widen: 1.2}), dt);
    };

    const stepBirth = (dt: number) => {
        const s = since();
        if (replay.feed.play) {
            // A hatching: the scene's own replay act (it flies the camera to the clutch itself).
            if (!playing && clip >= lead) {
                const running = {over: false};
                playing = running;
                actAt = clip;
                enter("hatch");
                void handle.play(replay.feed.play).done.then(() => {
                    running.over = true;
                });
            }
            if (playing && !playing.over) return null;
            if (playing?.over && state === "hatch") {
                enter("after");
                view = handle.view();
            }
            if (state === "after") {
                if (clip - stateAt > 3) finish(true);
                return drift(frameOf(byRole("young").concat(byRole("parent")), {widen: 1.2}) ?? (view ? {...view} : null), dt);
            }
            return toward(frameOf(byRole("parent").length ? byRole("parent") : ids, {widen: 1.3}), dt);
        }
        const act = handle.liveActs?.().births.find((b) => b.key === replay.feed.births![0].key);
        const who = act?.mother ? [act.mother, ...byRole("young")] : ids;
        if (s < 0) return toward(frameOf(byRole("parent"), {widen: 1.2}), dt);
        if (!act || act.phase === "skipped") {
            if (s > 1.5) {
                enter("still");
                if (clip - stateAt > 7) finish(false, act ? "the birth layer skipped it: the mother has no day to settle from (in the air, off the schedule)" : "the birth was not taken up by the scene (no parent of the record is drawn)");
            }
            return drift(frameOf(ids, {widen: 1.2}), dt);
        }
        enter("birth");
        // (Settling, the young born one by one, the first licks: the first 24 s; then the nursing goes on for minutes.)
        if (s > Math.min(act.end ?? 24, 24)) finish(true);
        return toward(frameOf(who, {widen: 1.15}), dt);
    };

    const stepDeath = (dt: number, last: boolean) => {
        const s = since();
        const id = ids[0];
        if (state === "lead" && s >= 0) enter("fall");
        if (state === "lead" || state === "fall") {
            if (state === "fall" && s > 6.5) {
                const act = handle.liveActs?.().deaths.find((d) => d.id === id);
                if (!last) {
                    finish(Boolean(act?.drawn), act?.drawn ? null : "its body was not drawn (the scene could not place where it died)");
                    return drift(frameOf([id]), dt);
                }
                // The last of its kind: on to the body's last minutes, run fast, as the camera pulls back over its home range.
                cut(DEATH_BODY_SECONDS - DEATH_FADE_SECONDS - 4, "to the body's last minutes");
                report.acted = Boolean(act?.drawn);
                if (!act?.drawn) report.reason = "its body was not drawn (the scene could not place where it died)";
                enter("lapse");
                lapseFrom = arkEpochSeconds();
                return toward(frameOf([id]), dt);
            }
            return toward(frameOf([id], {widen: s < 0 ? 1.15 : 1}), dt);
        }
        if (state === "lapse") {
            // 4 s of video for the fade's 3 minutes: the pin moved on every frame.
            const k = clamp01((clip - stateAt) / 4);
            pinArkClock(lapseFrom! + ease(k) * (DEATH_FADE_SECONDS + 8));
            const frame = frameOf([id]);
            if (k >= 1) enter("empty");
            return toward(frame ? {...frame, distance: lerp(frame.distance, Math.max(frame.distance * 5, 60), ease(k)), polar: lerp(1.12, 0.88, ease(k))} : null, dt, 3);
        }
        // Its home range, empty.
        if (clip - stateAt > 4) {
            const acted = report.acted;
            const reason = report.reason;
            finish(acted, reason);
        }
        if (view) view = {...view, azimuth: view.azimuth + 0.05 * dt, distance: view.distance + 1.2 * dt};
        return view;
    };

    const stepChase = (dt: number, kind: "meal" | "escaped") => {
        const s = since();
        const hunter = byRole("predator")[0];
        const quarry = byRole(kind === "meal" && replay.kind === "extinct" ? "last" : "prey")[0];
        if (s < 0) return toward(frameOf([hunter], {widen: 1.3}), dt);
        const acts = handle.liveActs?.();
        const meal = kind === "meal" ? acts?.meals[0] : null;
        const escape = kind === "escaped" ? acts?.escapes.find((e) => e.key === replay.feed.escapes![0].key) : null;
        const end = kind === "meal" ? (meal && meal.catchAt > 0 ? meal.catchAt : null) : escape?.missAt ?? null;
        if (end === null) {
            // (A pair the scene cuts away from, `acts.ts` chaseKind: a swimmer after a land animal, an insect; or no model.)
            if (s > 1.5) {
                enter("still");
                if (clip - stateAt > 7) finish(false, kind === "meal" ? "the meal layer did not act it (the hunter is not drawn, or the pair is one the scene cuts away from)" : "the escape layer did not act a chase (a pair the scene cuts away from, or the prey on the wing): only its limp");
            }
            return drift(frameOf([hunter, quarry], {widen: 1.2}), dt);
        }
        if (end - s > 14) cut(end - 12, "to the end of the stalk");
        const now = since();
        enter("chase");
        if (kind === "meal") {
            // (The catch, then the meal's first seconds: the feeding goes on for minutes.)
            if (now > end + 7) finish(true);
            return toward(frameOf([hunter, quarry], {widen: now > end ? 1.05 : 1.2}), dt, 3);
        }
        if (now > Math.min(escape?.seconds ?? end + 6, end + 8)) finish(true);
        return toward(frameOf([hunter, quarry], {widen: 1.25}), dt, 3);
    };

    const stepLastStand = (dt: number) => {
        const last = byRole("last");
        const predator = byRole("predator");
        const alone = frameOf(last);
        if (clip < 0.05) enter("wide");
        if (clip < 6) {
            // From over its home range, in to the last one.
            const k = ease(clip / 6);
            return toward(alone ? {...alone, distance: lerp(Math.max(alone.distance * 6, 55), alone.distance * 1.1, k), polar: lerp(0.86, 1.12, k)} : null, dt, 4);
        }
        if (clip < 11 || !predator.length) {
            if (!predator.length && clip > 13) finish(true);
            return drift(alone, dt);
        }
        // And the one that hunts it, in the same picture.
        if (clip > 18) finish(true);
        return toward(frameOf(last.concat(predator), {polar: 1.02, max: 220}), dt, 1.6, 0.35);
    };

    const stepReleased = (dt: number) => {
        const id = ids[0];
        if (clip < 3.6) {
            // Where it lived: the town's zoo.
            enter("zoo");
            const town = handle.islandView?.("town");
            return town ? (view = {...town, distance: town.distance * 0.55, polar: 0.98, azimuth: town.azimuth + 0.04 * clip}) : toward(frameOf([id], {widen: 6, polar: 0.9}), dt);
        }
        if (state === "zoo") {
            enter("shore");
            view = null;
        }
        const here = frameOf([id]);
        if (!arrived && clip >= 5.2) {
            arrived = true;
            actAt = clip;
            handle.arrive(id);
        }
        if (clip > 15) finish(true);
        const k = ease((clip - 3.6) / 3);
        return toward(here ? {...here, distance: here.distance * lerp(2.6, 1.15, k), polar: lerp(0.95, 1.12, k)} : null, dt, 3);
    };

    return {
        begin: () => {
            pinArkClock(t0 - lead);
            if (options.asOf !== false) cast.setAsOf(t0, replay.arkDay);
            cast.bring(key, replay.cast.map((member) => member.record), {marks: replay.marks}).apply();
            const feed = replay.feed;
            if (feed.matings) handle.addMatings?.(feed.matings);
            if (feed.births) handle.addBirths?.(feed.births);
            if (feed.deaths) handle.addDeaths?.(feed.deaths);
            if (feed.meals) handle.setMeals?.(feed.meals);
            if (feed.escapes) handle.addEscapes?.(feed.escapes);
            if (feed.release) handle.hold(feed.release.id);
        },
        settle: () => {
            pinArkClock(t0 - lead);
            view = null;
        },
        step: (t, dt) => {
            clip = t;
            if (done !== null) {
                // The linger: the same picture, drifting.
                if (playing && !playing.over) return null;
                return drift(replay.kind === "death" || replay.kind === "extinct" ? null : frameOf(ids, {widen: 1.2}), dt, 0.06) ?? (view ? (view = {...view, azimuth: view.azimuth + 0.06 * dt}) : null);
            }
            let next: ArkCameraView | null;
            switch (replay.kind) {
                case "mated":
                    next = stepMated(dt);
                    break;
                case "birth":
                    next = stepBirth(dt);
                    break;
                case "death":
                    next = stepDeath(dt, false);
                    break;
                case "extinct":
                    next = replay.feed.meals ? stepChase(dt, "meal") : stepDeath(dt, true);
                    break;
                case "meal":
                    next = stepChase(dt, "meal");
                    break;
                case "escaped":
                    next = stepChase(dt, "escaped");
                    break;
                case "last_stand":
                    next = stepLastStand(dt);
                    break;
                case "released":
                    next = stepReleased(dt);
                    break;
            }
            if (state === "lead" && since() >= 0 && replay.kind !== "last_stand" && replay.kind !== "released") enter("act");
            count();
            return next ?? view;
        },
        doneAt: () => done,
        actAt: () => actAt,
        report: () => {
            // (Who stands in is the roster's, as the scene last laid it out; kept once the cast is gone.)
            if (!ended) Object.assign(report, cast.report());
            return {...report, cuts: [...report.cuts], seen: {...report.seen}};
        },
        end: () => {
            if (!ended) Object.assign(report, cast.report());
            ended = true;
            pinArkClock(null);
            if (replay.feed.meals) handle.setMeals?.([]);
            cast.detach();
        }
    };
}
