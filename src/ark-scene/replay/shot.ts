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
 *   from where the camera is (the selection's pair fit, `pair-frame.ts` framePair, taken to any bearing: an upright
 *   picture holds two along its tall side; one alone as large as the picture holds it, `FILL_WIDE`), eased;
 * - a clear view: the scene's own lines of sight (`sightOf`: `runtime/sight.ts`, as a chosen animal's close-up asks
 *   them) from the camera to each of the cast, the views round the asked one tried until one sees them all (inside
 *   a zoo house's shell, over a rock, under the water with a swimmer); and what leaves stand between dissolve
 *   (`setNearCone`, `near-fade.ts`: a cone round the view's axis, as far as the subject and the plant it stands in);
 * - the night: the recorder's exposure and a fill of the sky's own light (`setExposure`), eased in with the dark;
 *   the hour, the moon and the night's colours are the event's;
 * - an editorial default (the audit, §2.4): at a mating's mount the camera pulls up and away and the clip goes on
 *   with the two resting together; `mount: "show"` films it.
 *
 * `step(t, dt)` is called once per video frame, before the frame is drawn.
 *
 * V1 ("hunting and mating you can see"): the same camera WATCHES an act live (`live: true`, `seen/watch.ts`): the
 * clock is the Ark's own (no pin, so no cut and no time run fast), the layers were fed by the live log, and the cast
 * is the live world's shared one. Two that share the picture are HELD in it (`holdIn`): whatever the easing is doing,
 * the camera is at once far enough back for both, so a sprint or a stoop never leaves the frame; and a chase's still
 * is the frame where both are in the picture and nearest each other.
 */

import {arkEpochSeconds, pinArkClock} from "@/ark-scene/shared-clock";
import {easeToward} from "@/ark-scene/pair-frame";
import {attachArkCast, type ArkCast} from "@/ark-scene/replay/cast";
import {DEATH_BODY_SECONDS, DEATH_DYING_SECONDS, DEATH_FADE_SECONDS} from "@/ark-scene/live-deaths";
import type {ArkEventReplay} from "@/ark-scene/replay/event-replay";
import type {ArkCameraView, ArkLocated, ArkSceneHandle} from "@/ark-scene/types";
import {islandHours} from "@/lib/ark-clock";
import {daylightAt} from "@/lib/ark-daylight";

const FOV = 38;
/**
 * One alone fills the picture: its length this share of the picture's width, or its height this share of the
 * picture's height, whichever asks for more room (an upright phone's clip: a long body by its width, a tall one by its
 * height); never nearer than a few of its own lengths (`NEAREST_LENGTHS`: nearer, the lens is inside the animal's own
 * leaf) nor than `NEAREST` metres. So an aphid of 2 mm is filmed from a centimetre, an elephant from 13 m.
 */
const FILL_WIDE = 0.74;
const FILL_TALL = 0.44;
const NEAREST_LENGTHS = 2.4;
const NEAREST = 0.01;
/**
 * The cone the leaves dissolve in (`near-fade.ts`), as the tangent of its half angle: the picture's width for one in
 * the middle of it, wider for two (never the whole picture: its corners keep their trees).
 */
const CONE = 0.2;
const CONE_MOST = 0.4;
/** A swimmer under the surface is filmed level with it, from under the water (the angle from straight above). */
const POLAR_UNDER = 1.33;
/** REAL-REPRODUCTION: a split on the seabed, looked down on through the water (a flat star level with the camera is a sliver). */
const POLAR_SEABED = 0.8;
/**
 * The night's lift at its darkest, as gains on the Ark's own (the camera's exposure, and the sky's own light as a
 * fill): an act on a forest floor at midnight reads, still blue and dim. `nightGain` scales both.
 */
const NIGHT_EXPOSURE = 2.6;
const NIGHT_FILL = 3.2;
/**
 * How high the camera stands (the polar angle, from straight above): a little over the ground's plants for an animal a
 * person could see across a clearing; from well above for a small one (the plants round it are as tall as the camera
 * is far) and for a body lying on the ground. Raised further while something still stands between (`RAISE`).
 */
const POLAR = 0.9;
const POLAR_SMALL = 0.55;
/** A small body lying on the ground: from nearly straight above (the near cut then takes away every leaf over it). */
const POLAR_BODY = 0.26;
/**
 * The cutaway (`setNearCut`): the camera's near plane out toward the subject, so the roof, the fern or the bush in the
 * first part of the way is not drawn, whatever it is made of. As far as the nearest of the cast less its own body, but
 * never past this share of the depth at which the ground enters the picture's lower edge (the ground under the
 * picture is never cut open); and not at all from far back (a wide view keeps its wood).
 */
const CUT_GROUND = 0.78;
const CUT_WITHIN = 45;
const HALF_TALL = (FOV * Math.PI) / 360;
/** V1: in a tank, a cage or a room the cut goes this share of the way to the floor: through the roof or the ceiling over them. */
const CUT_GROUND_HOUSED = 0.93;
const cutAt = (distance: number, polar: number, body: number, share = CUT_GROUND) => {
    const ground = (share * Math.cos(Math.min(polar, 1.5)) * Math.cos(HALF_TALL)) / Math.cos(Math.max(polar - HALF_TALL, 0));
    return Math.max(Math.min(distance - body, distance * ground), 0) * Math.min(Math.max((CUT_WITHIN - distance) / (CUT_WITHIN * 0.4), 0), 1);
};
/** A chase from higher still: over the ferns and between the trunks, under the crowns (most chases are in the woods). */
const POLAR_CHASE = 0.6;
const RAISE = 0.16;
const RAISE_MOST = 0.48;
/** Two farther apart than this (m) are not held in one picture after their act (from that far back neither reads). */
const TOGETHER = 40;
/**
 * While two are still coming together (a walk to a mate, a stalk), one picture holds both only within this (m): from
 * far enough back for more the camera is over the treetops. Until then, one of them alone.
 */
const CLOSING = 14;
/**
 * A chase is too fast for that: the picture stays on the quarry, where the chase comes, and holds the hunter too only
 * once it is this near (m): the lunge, the catch or the miss.
 */
const CLOSING_CHASE = 4;
/** The lunge: from this long before the miss to this long after (s), the picture is on the quarry from at least this far back (m): room for the hunter. */
const LUNGE_BEFORE = 2.2;
const LUNGE_AFTER = 1.0;
/** The lunge's picture: this many times the quarry's own close-up distance back, never nearer than this (m), from this height (the angle from straight above). */
const LUNGE_ROOM = 2.6;
const LUNGE_LEAST = 3.2;
const POLAR_LUNGE = 0.82;
/** V1: two that share the picture are kept inside this share of its half width and half height (`holdIn`). */
const HOLD_IN = 0.84;
/** V1: an act in a tank, a cage or a room is filmed from this high (the angle from straight above): down through its top. */
const POLAR_HOUSED = 0.34;
/** V1: a birth's picture once a young is out, as a share of the pair framing's distance. */
const BIRTH_CLOSE = 0.66;
/** V1: a stalking hunter and its quarry share the picture from this near (m); farther, the hunter alone. */
const STALK_TOGETHER = 9;
/**
 * The frames nobody sees before the shot's first (the director's, `settle`): the clock is pinned this long before the
 * shot's start, so they end before it, never past the event (a layer that has begun its act is not walked back).
 */
export const REPLAY_SETTLE_SECONDS = 5;

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
    /**
     * The night's lift, as a scale on the shot's own (`NIGHT_EXPOSURE`, `NIGHT_FILL`; 1, the default: an act at
     * midnight reads; 0: the night as the Ark shows it). Eased in with the dark; by day nothing changes. A camera's
     * choice only: the hour, the light's colour and what the animals do are the event's.
     */
    nightGain?: number;
    /** The light's hour pinned (`--hour`, 0–24) instead of the island's own at the event's time: no night gain then. */
    hour?: number | null;
    /**
     * V1: watch the act as it happens in the live world (`seen/watch.ts`): the Ark's own clock (nothing pinned, no
     * cuts, no time run fast), the live layers as the log fed them, and `cast`, the live world's shared cast (this
     * shot's group is brought into it and released from it; it is never detached).
     */
    live?: boolean;
    cast?: ArkCast;
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
    /** What the picture could not hold (the hunter too far off to share it…): said, never hidden. */
    notes: string[];
    /** The island's hour at the event (0–24), how much of full night it was (0–1), and the exposure gain the camera used. */
    hour: number;
    night: number;
    gain: number;
    /** The clip second of the act's telling moment (the courtship, the catch, the miss, the body lying, the coming ashore): a still's frame. Null until it has come. */
    keyAt: number | null;
    /** The cuts made: clip seconds, and how far the clock was moved on (s). */
    cuts: Array<{at: number; skipped: number; why: string}>;
    /** Per cast id: the share of the act's frames it was drawn in, and its role. */
    seen: Record<string, {role: string; frames: number; shown: number}>;
    /** The lines of sight: view searches made, how many moved the camera, how many found no wholly clear view (and what stood in the way). */
    sight?: {searches: number; moved: number; blocked: number; checks: number; met: Record<string, number>};
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
    const live = Boolean(options.live);
    const cast: ArkCast = options.cast ?? attachArkCast(handle);
    const ids = replay.cast.map((member) => member.record.id);
    const byRole = (role: string) => replay.cast.filter((member) => member.role === role).map((member) => member.record.id);
    const report: ArkReplayShotReport = {eventId: replay.eventId, kind: replay.kind, t0, standIns: [], pins: [], dropped: 0, acted: false, reason: null, notes: [], hour: Math.round(islandHours(replay.t0 * 1000) * 100) / 100, night: Math.round(daylightAt(islandHours(replay.t0 * 1000)).night * 100) / 100, gain: 1, keyAt: null, cuts: [], seen: Object.fromEntries(replay.cast.map((member) => [member.record.id, {role: member.role, frames: 0, shown: 0}]))};

    let done: number | null = null;
    let ended = false;
    let actAt = lead;
    let clip = 0;
    /** The camera as last set (eased from). */
    let view: ArkCameraView | null = null;
    /** The bearing the camera keeps (chosen clear of the trees, kept until something comes between), and for how many frames it has been blocked. */
    let bearing: number | null = null;
    let blocked = 0;
    /**
     * With the scene's lines of sight (`sightOf`): the view chosen clear of what is drawn, as how far round from the
     * bearing the framing asks (so it turns with two that turn about each other: a lunge, a pass), how much steeper or
     * lower, and how much nearer; kept until the lines are blocked twice running.
     */
    let pick: {turn: number; tilt: number; near: number; clear: boolean} | null = null;
    let checkedAt = -1;
    let searchedAt = -9;
    let driftClear = false;
    const sights = {searches: 0, moved: 0, blocked: 0, checks: 0, met: {} as Record<string, number>};
    /** V1: how far toward the ground under the picture the near cut may go (`CUT_GROUND`; more for an act under a roof). */
    let cutShare = CUT_GROUND;
    /** Who the picture held last (when that changes, one alone to the two together, the bearing is chosen again: side on to both). */
    let framed = "";
    /** How much higher than its framing asks the camera stands, having found no clear bearing (rocks, a thicket). */
    let raised = 0;
    /** The act's telling moment has come (once). */
    const tell = (offset = 0) => {
        if (report.keyAt === null) report.keyAt = Math.round((clip + offset) * 100) / 100;
    };
    const cutOnce = new Set<string>();
    let playing: {over: boolean} | null = null;
    let lungeGap = Infinity;
    let hatchView = false;
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
    const hourPinned = typeof options.hour === "number";
    /** The light at the clock's moment, now (the scene looks at its clock for the light only every few seconds, and not during its own replay). */
    const relight = () => handle.setHours(hourPinned ? options.hour! : null);

    /** Move the clock on to `s` seconds after the event: a cut. The camera snaps (no easing across a cut). */
    const cut = (s: number, why: string) => {
        const now = since();
        // (Watching live: the clock is everyone's.)
        if (live || cutOnce.has(why) || s <= now + 0.5) return;
        cutOnce.add(why);
        pinArkClock(t0 + s);
        relight();
        report.cuts.push({at: Math.round(clip * 100) / 100, skipped: Math.round((s - now) * 10) / 10, why});
        view = null;
        bearing = null;
        pick = null;
        raised = 0;
    };
    type Sight = {x: number; y: number; z: number; slack: number};
    type Frame = {
        target: Point;
        /** From its own bearing (`azimuth`). */
        distance: number;
        azimuth: number;
        polar: number;
        /** Who must be seen from the camera (the sight lines kept clear). */
        places: Point[];
        /** The lines kept clear (`sightOf`): each one's middle, and the head and tail of a long one. */
        sight: Sight[];
        /** How far under the water the shallowest of them is (m; 0: on land): the camera keeps under the surface with them. */
        under: number;
        /** From the view's target toward the camera, how much of the way is the cast's own bodies (m): the near cut stops short of it. */
        body: number;
        /** The least distance that holds everyone from another bearing and height (the camera is rarely on the bearing asked for: a tree, a swing under way). Absent: `distance` whatever the bearing. */
        fit?: (azimuth: number, polar: number) => number;
        /** V1: two or more that share the picture, each with its body's reach (m): the camera is never nearer than holds them all (`holdIn`). */
        hold?: Array<Point & {r: number}>;
        /** The farthest the camera stands for them (m). */
        most?: number;
    };
    /** A framing at a distance and height of the shot's own (a pull back, a push in): no fitting. */
    const held = (frame: Frame, distance: number, polar: number): Frame => ({...frame, distance, polar, fit: undefined});

    const located = (list: string[]): Array<ArkLocated & {id: string}> => list.map((id) => ({id, at: handle.locate(id)})).filter((item): item is {id: string; at: ArkLocated} => Boolean(item.at)).map((item) => ({...item.at, id: item.id}));

    /**
     * The view that holds these animals: the two farthest apart framed together (the selection's pair framing), or the
     * one alone at its meeting distance; side on to the line between them, from the island's outer side.
     */
    const frameOf = (list: string[], style: {polar?: number; widen?: number; max?: number; /** Alone in the picture while the rest are farther than `closing` (default `CLOSING`) from it. */ first?: string; closing?: number; /** REAL-REPRODUCTION: one on the seabed (a split sea star or cucumber): looked down on through the water, never level with it. */ seabed?: boolean; /** V1: places held in the picture as well, with nobody at them yet (where a hunter will be at its lunge's end). */ also?: Array<ArkLocated & {id: string}>} = {}): Frame | null => {
        const all = located(list);
        const drawn = all.filter((at) => at.shown !== false);
        let who = drawn.length ? drawn : all;
        if (!who.length) return null;
        const first = style.first ? all.find((at) => at.id === style.first) : null;
        if (first && all.some((at) => Math.hypot(at.x - first.x, at.z - first.z) > (style.closing ?? CLOSING))) who = [first];
        if (style.also?.length) who = who.concat(style.also);
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
        const length = Math.max(...who.map((p) => p.length), 0.001);
        const tall = Math.max(...who.map((p) => p.height), 0.0005);
        const tangent = Math.tan((FOV * Math.PI) / 360);
        const single = Math.max(length / (2 * FILL_WIDE * tangent * Math.max(aspect, 0.3)), tall / (2 * FILL_TALL * tangent), length * NEAREST_LENGTHS, NEAREST);
        const max = style.max ?? 150;
        // (Swimmers under the surface: level with them, the camera in the water too.)
        const under = Math.min(...who.map((p) => (p.under ?? 0) - p.height / 2));
        const polar = style.seabed ? POLAR_SEABED : under > 0.12 ? POLAR_UNDER : style.polar ?? (length < 0.3 ? POLAR_SMALL : POLAR);
        const apartNow = far > Math.max(length * 0.5, 0.2);
        const centre = {x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2};
        // The least distance that holds the two from a bearing and a height: across the picture, the part of the line
        // between them that lies across the view; up the picture, the part along the view, foreshortened by the
        // camera's height. (Side on in a wide picture is the selection's pair framing, `pair-frame.ts`; an upright
        // picture, a phone's clip, holds two far better along its tall side, one nearer and one farther.)
        const half = Math.tan((FOV * Math.PI) / 360);
        const line = Math.atan2(b.x - a.x, b.z - a.z);
        const widen = style.widen ?? 1;
        const fit = (azimuth: number, height: number) => {
            if (!apartNow) return single * widen;
            const across = (far * Math.abs(Math.sin(azimuth - line))) / 2 + length * 0.6;
            const along = (far * Math.abs(Math.cos(azimuth - line)) * Math.cos(height)) / 2 + length * 0.7;
            return Math.min(Math.max(single, across / (0.7 * half * Math.max(aspect, 0.3)), along / (0.62 * half)), max) * widen;
        };
        const sideOn = Math.atan2(b.z - a.z, -(b.x - a.x));
        // (Close together, side on: along the line the nearer one would stand in front of the other.)
        const upright = apartNow && far > length * 3 && fit(line, polar) < fit(sideOn, polar) * 0.85;
        const across = !apartNow ? outward(centre) : upright ? line + Math.PI : sideOn;
        const out = outward(centre);
        const side = Math.cos(across - out) >= 0 ? across : across + Math.PI;
        const distance = fit(side, polar);
        const holds = `${who.map((p) => p.id).sort().join(",")}${upright ? "|along" : ""}${under > 0.12 ? "|under" : ""}`;
        if (holds !== framed) {
            framed = holds;
            bearing = null;
            pick = null;
            raised = 0;
        }
        const sight: Sight[] = [];
        for (const p of who) {
            // (The last of a line that is the body's own: by its height for a long low one, a python among its rocks.)
            const slack = Math.min(Math.max(p.length, p.height) * 0.6, p.height * 0.8 + 0.15) + Math.min(0.08, p.length);
            sight.push({x: p.x, y: p.y, z: p.z, slack});
            if (p.length < 0.3) continue;
            for (const end of [1, -1]) sight.push({x: p.x + Math.sin(p.yaw) * p.length * 0.3 * end, y: p.y, z: p.z + Math.cos(p.yaw) * p.length * 0.3 * end, slack});
        }
        return {target: {x: centre.x, y: centre.y, z: centre.z}, distance, azimuth: side, polar: polar - raised, places: who.map((p) => ({x: p.x, y: p.y, z: p.z})), sight, under: Math.max(under, 0), body: Math.max(length, tall) * 0.6 + 0.02 + (apartNow ? far / 2 : 0), fit, ...(who.length > 1 ? {hold: who.map((p) => ({x: p.x, y: p.y, z: p.z, r: Math.max(p.length, p.height) * 0.55})), most: max} : {})};
    };
    /**
     * V1: where a point is in the picture from a view, as shares of its half width and half height (0: the middle, 1:
     * the edge); null behind the camera.
     */
    const inPicture = (at: ArkCameraView, p: Point, r = 0): {x: number; y: number} | null => {
        const sp = Math.sin(at.polar);
        const cp = Math.cos(at.polar);
        const sa = Math.sin(at.azimuth);
        const ca = Math.cos(at.azimuth);
        const rel = {x: p.x - at.target.x, y: p.y - at.target.y, z: p.z - at.target.z};
        const depth = at.distance - (rel.x * sp * sa + rel.y * cp + rel.z * sp * ca);
        if (depth <= 1e-4) return null;
        const half = Math.tan((FOV * Math.PI) / 360);
        const px = Math.abs(rel.x * ca - rel.z * sa) + r;
        const py = Math.abs(-rel.x * sa * cp + rel.y * sp - rel.z * ca * cp) + r;
        return {x: px / (depth * half * Math.max(options.aspect(), 0.3)), y: py / (depth * half)};
    };
    /** V1: the least distance from which all of them are inside the picture's middle (`HOLD_IN` of its half sides), from this bearing and height. */
    const holdIn = (at: ArkCameraView, points: Array<Point & {r: number}>): number => {
        const sp = Math.sin(at.polar);
        const cp = Math.cos(at.polar);
        const sa = Math.sin(at.azimuth);
        const ca = Math.cos(at.azimuth);
        const half = Math.tan((FOV * Math.PI) / 360) * HOLD_IN;
        let need = 0;
        for (const p of points) {
            const rel = {x: p.x - at.target.x, y: p.y - at.target.y, z: p.z - at.target.z};
            const along = rel.x * sp * sa + rel.y * cp + rel.z * sp * ca;
            const px = Math.abs(rel.x * ca - rel.z * sa) + p.r;
            const py = Math.abs(-rel.x * sa * cp + rel.y * sp - rel.z * ca * cp) + p.r;
            need = Math.max(need, along + Math.max(px / (half * Math.max(options.aspect(), 0.3)), py / half));
        }
        return need;
    };
    /** V1: whether every one of these is drawn and inside the picture now (a still's test). */
    const allInPicture = (at: ArkCameraView | null, list: string[], within = 0.94): boolean => {
        if (!at) return false;
        const all = located(list);
        return all.length === list.length && all.every((p) => {
            if (p.shown === false) return false;
            const on = inPicture(at, p, Math.max(p.length, p.height) * 0.3);
            return Boolean(on && on.x < within && on.y < within);
        });
    };
    const apart = (a: string, b: string): number | null => {
        const [p, q] = [handle.locate(a), handle.locate(b)];
        return p && q ? Math.hypot(p.x - q.x, p.z - q.z) : null;
    };

    const sameBearing = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))) < 0.02;
    /**
     * The framing from a bearing with nothing in the way (the scene's own rule for its replays, `clearView`): chosen
     * nearest the side-on bearing, then kept while it stays clear; once a tree has stood between for a few frames,
     * round to the nearest clear bearing (the camera eases there).
     */
    const clearOf = (want: Frame): Frame => {
        const ask = (azimuth: number) => handle.clearView?.(want.target, want.distance, want.polar, azimuth, want.places) ?? {polar: want.polar, azimuth};
        if (bearing === null) {
            const first = ask(want.azimuth);
            bearing = first.azimuth;
            blocked = 0;
            return {...want, ...first};
        }
        const now = ask(bearing);
        if (sameBearing(now.azimuth, bearing)) {
            blocked = 0;
            return {...want, polar: now.polar, azimuth: bearing};
        }
        if (++blocked >= 5) {
            blocked = 0;
            let next = now.azimuth;
            for (const off of [0.45, -0.45, 0.9, -0.9, 1.35, -1.35, 1.8, -1.8]) {
                if (!sameBearing(ask(bearing + off).azimuth, bearing + off)) continue;
                next = bearing + off;
                break;
            }
            // (Nothing clear nearby, and the far side's best is not clear either: from higher up, over what is in the way.)
            if (next === now.azimuth && !sameBearing(ask(next).azimuth, next)) raised = Math.min(raised + RAISE, RAISE_MOST);
            bearing = next;
        }
        return {...want, polar: now.polar, azimuth: bearing};
    };

    /**
     * The framing from a view the scene's own lines of sight are clear from (`sightOf`). The asked view first, then
     * round it at the same height (nearest bearings first), then steeper (over a wall, a rock, a bush), lower (under
     * a roof's edge, level with a swimmer), from nearly overhead, and nearer (inside the house or the pen it is in):
     * the first that sees every line, else the one that sees most. Kept while it sees two lines in three; blocked
     * twice running, the search again from where the camera is.
     */
    const tilted = (polar: number, tilt: number) => Math.min(Math.max(polar + tilt, 0.12), 1.5);
    const sightOf = (want: Frame, snapFar: boolean): Frame => {
        const ask = handle.sightOf!;
        const reach = (azimuth: number, polar: number, near: number) => (want.fit?.(azimuth, polar) ?? want.distance) * near;
        // (What is solid counts whole; a leaf the cone would dissolve counts a hundredth: a view with nothing at all between first.)
        const lines = (azimuth: number, polar: number, near: number, fresh = false) => {
            const distance = reach(azimuth, polar, near);
            const cut = cutAt(distance, polar, want.body, cutShare);
            const solid = ask(want.target, {distance, polar, azimuth}, want.sight, fresh, cut);
            return solid > 0 ? solid : ask(want.target, {distance, polar, azimuth}, want.sight, false, cut, true) / 100;
        };
        // (Under the water with a swimmer: no view from over the surface.)
        const wet = (polar: number, near: number) => want.under > 0.12 && Math.cos(polar) * reach(want.azimuth, polar, near) > want.under - 0.05;
        const search = (from: number) => {
            searchedAt = clip;
            sights.searches++;
            const tilts = [0, -0.3, -0.6, 0.14 - want.polar, 0.3, 0.52].filter((tilt, index, all) => all.findIndex((other) => Math.abs(tilted(want.polar, other) - tilted(want.polar, tilt)) < 0.08) === index);
            let best: {turn: number; tilt: number; near: number; clear: boolean} | null = null;
            let least = Infinity;
            let fresh = true;
            for (const near of [1, 0.72, 0.5]) {
                for (const tilt of tilts) {
                    const polar = tilted(want.polar, tilt);
                    if (wet(polar, near)) continue;
                    for (const turn of [0, 0.5, -0.5, 1, -1, Math.PI / 2, -Math.PI / 2, 2.3, -2.3, Math.PI]) {
                        const n = lines(from + turn, polar, near, fresh);
                        fresh = false;
                        if (n < least) {
                            least = n;
                            best = {turn: from + turn - want.azimuth, tilt, near, clear: n === 0};
                        }
                        if (n === 0) return best!;
                    }
                }
            }
            if (least > 0) {
                sights.blocked++;
                const met = handle.sightMet?.() || "?";
                sights.met[met] = (sights.met[met] ?? 0) + 1;
            }
            return best ?? {turn: from - want.azimuth, tilt: 0, near: 1, clear: false};
        };
        if (!pick) {
            pick = search(want.azimuth);
            checkedAt = clip;
            blocked = 0;
            driftClear = false;
        } else if (clip - checkedAt >= 0.2) {
            checkedAt = clip;
            sights.checks++;
            const polar = tilted(want.polar, pick.tilt);
            const n = lines(want.azimuth + pick.turn, polar, pick.near);
            // (The way round, for the linger's drift: only where the next of it is clear too.)
            driftClear = n === 0 && lines(want.azimuth + pick.turn + 0.12, polar, pick.near) === 0;
            // (Kept while it sees two lines in three; a view that had nothing at all between, while leaves hide no more than that.)
            if (n < 1 ? !pick.clear || n * 300 <= want.sight.length : n * 3 <= want.sight.length) blocked = 0;
            else if (++blocked >= 2 && clip - searchedAt > 1.2) {
                blocked = 0;
                const before = pick;
                pick = search(want.azimuth + pick.turn);
                // (Somewhere else altogether: an edit, not a swing through what was in the way.)
                if (snapFar && (Math.abs(Math.atan2(Math.sin(pick.turn - before.turn), Math.cos(pick.turn - before.turn))) > 0.75 || Math.abs(pick.tilt - before.tilt) > 0.4)) view = null;
                if (Math.abs(pick.turn - before.turn) > 1e-6 || pick.tilt !== before.tilt || pick.near !== before.near) sights.moved++;
            }
        }
        const chosen = pick;
        const polar = tilted(want.polar, chosen.tilt);
        return {...want, azimuth: want.azimuth + chosen.turn, polar, distance: want.distance * chosen.near, ...(want.fit ? {fit: (azimuth: number, height: number) => want.fit!(azimuth, height) * chosen.near} : {})};
    };

    /** Toward a framing, eased (snapped after a cut or on the first frame); the bearing never swings more than it must. */
    const toward = (asked: Frame | null, dt: number, rate = 2.4, turn = 0.6, aim = rate): ArkCameraView | null => {
        if (!asked) return view;
        // (Its subject is suddenly somewhere else, a hunter at its foray's waypoint: an edit, not a pan across the island.)
        if (view && Math.hypot(asked.target.x - view.target.x, asked.target.z - view.target.z) > Math.max(12, view.distance)) view = null;
        if (!view) {
            bearing = null;
            pick = null;
        }
        // (A bearing chosen again while the camera is up: nearest the side it is on, so it swings the short way.)
        // (With the lines of sight the chosen view is so far round from the asked bearing, which may be either side of
        // the two: always the side the camera is on.)
        if ((handle.sightOf ? true : bearing === null) && view && Math.cos(asked.azimuth + (handle.sightOf ? pick?.turn ?? 0 : 0) - view.azimuth) < 0) asked = {...asked, azimuth: asked.azimuth + Math.PI};
        const want = handle.sightOf ? sightOf(asked, true) : clearOf(asked);
        if (!view) {
            view = {target: {...want.target}, distance: want.fit?.(want.azimuth, want.polar) ?? want.distance, polar: want.polar, azimuth: want.azimuth};
            if (want.hold) view.distance = Math.min(Math.max(view.distance, holdIn(view, want.hold)), Math.max(want.most ?? 150, view.distance));
            return view;
        }
        const azimuth = easeToward(view.azimuth, nearer(view.azimuth, want.azimuth), dt, turn);
        const polar = easeToward(view.polar, want.polar, dt, rate * 0.6);
        // (Far enough back for everyone from where the camera is now, not from where it is going.)
        const distance = want.fit?.(azimuth, polar) ?? want.distance;
        view = {
            // (`aim`: how fast the picture's middle follows; a lunge's is quick, so the two are in its middle, not at its edge.)
            target: {x: easeToward(view.target.x, want.target.x, dt, aim), y: easeToward(view.target.y, want.target.y, dt, aim), z: easeToward(view.target.z, want.target.z, dt, aim)},
            // (Out at once when they would leave the picture; in gently.)
            distance: distance > view.distance ? easeToward(view.distance, distance, dt, rate * 3) : easeToward(view.distance, distance, dt, rate * 0.8),
            polar,
            azimuth
        };
        // V1: held in the picture: at once as far back as holds them all from where the camera is this frame (the
        // target's own easing lags a sprint; the distance does not).
        if (want.hold) view.distance = Math.min(Math.max(view.distance, holdIn(view, want.hold)), Math.max(want.most ?? 150, view.distance));
        return view;
    };
    /** Holding on a framing with a slow drift round it, where the way round is clear (the linger after the act, a shot with nothing to wait for). */
    const drift = (want: Frame | null, dt: number, per = 0.05) => {
        if (want && handle.sightOf) {
            if (pick && driftClear) pick.turn += per * dt;
        } else if (want && bearing !== null) {
            const on = bearing + per * dt * 6;
            if (sameBearing((handle.clearView?.(want.target, want.distance, want.polar, on, want.places) ?? {azimuth: on}).azimuth, on)) bearing += per * dt;
        }
        return toward(want, dt);
    };

    const finish = (acted: boolean, reason: string | null = null) => {
        if (done !== null) return;
        done = clip;
        report.acted = acted;
        report.reason = reason;
    };
    const count = () => {
        // (A released animal is counted from its coming ashore: it is held out of sight until then.)
        if (state === "lead" || done !== null || (replay.kind === "released" && !arrived)) return;
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
        if (s < 0) return toward(frameOf(ids, {widen: 1.15, first: ids[0]}), dt);
        // A contest first (rival males, `live-matings.ts`): its last bouts and the loser's flight, the rival in the picture.
        if (act?.contestEnd && s < act.contestEnd) {
            if (s < act.contestEnd - 9.5) cut(act.contestEnd - 9, "to the contest's end");
            enter("contest");
            return toward(frameOf(act.rival ? ids.concat(act.rival) : ids, {widen: 1.15}), dt);
        }
        const meet = act?.meet;
        const courted = act?.courted;
        const mounted = act?.mounted;
        if (!act || act.phase === "skipped" || meet === undefined || courted === undefined || mounted === undefined) {
            // (Different islands, more than 160 m apart, one of them in a tank or off its schedule: the layer does not walk
            // them across; or it has not taken the pair up at all, one of the two not being in the scene.)
            if (s > (act?.contestEnd ?? 0) + 2.5) {
                enter("still");
                if (clip - stateAt > 7) finish(false, act?.phase === "skipped" ? "the mating layer skipped it: the two live in different worlds, are too far apart or have no day to walk from (a tank, a cage)" : "the mating was not taken up by the scene (one of the two is not in it)");
            }
            return drift(frameOf(ids, {widen: 1.15, first: ids[0]}), dt);
        }
        // The walk's last seconds.
        if (meet - s > 7.5) cut(meet - 7, "to the end of the walk to each other");
        const now = since();
        // (The still: the courtship. A line tapped later, with the mount under way: the two resting together after it,
        // never the camera's pull up and away.)
        if (now > Math.max(meet, courted - 5) && (now < courted - 0.2 || state === "court")) tell();
        // (V1: a housed pair, in its tank, cage or room: from above, through its top.)
        const high = act.how === "housed" || act.how === "brought" ? {polar: POLAR_HOUSED} : {};
        if (high.polar) cutShare = CUT_GROUND_HOUSED;
        if (now < courted - 0.2) {
            enter("court");
            return toward(frameOf(ids, {widen: 1.1, first: ids[0], ...high}), dt);
        }
        // REAL-REPRODUCTION: a kind's own way (a spawning, a clasp, a pair over its eggs) is no mount: it is watched
        // through, close, its still in the middle of the laying.
        if (act.repro) {
            const [from, to] = act.telling ?? [courted, mounted];
            if (now < mounted + 2.4) {
                enter("mount");
                if (now > from + Math.min(8, (to - from) * 0.5)) tell();
                // (A spawning night's pair are each where they are, maybe across the bay: the first of them, close.)
                return toward(frameOf(ids, {widen: 1.15, first: ids[0], ...high}), dt);
            }
            enter("rest");
        } else if (options.mount !== "show" && act.how !== "brought") {
            if (state !== "away" && state !== "rest" && state !== "over") enter("away");
            if (state === "away") {
                // Up and away as it begins; then on to the two resting together.
                const k = ease((clip - stateAt) / 2.6);
                const frame = frameOf(ids);
                // (Watching live there is no cut past it: the camera stays up and away until the mount is over.)
                if (clip - stateAt > 2.6 && (!live || now >= mounted + 2.4)) {
                    cut(mounted + 2.4, "past the mount");
                    enter("rest");
                    return toward(frameOf(ids, {widen: 1.2, ...high}), dt);
                }
                return toward(frame ? held(frame, frame.distance * lerp(1.1, 3.2, k), lerp(high.polar ?? POLAR, high.polar ?? 0.72, k)) : null, dt, 3.5);
            }
        } else if (now < mounted + 2.4) {
            enter("mount");
            return toward(frameOf(ids, {widen: 1.1, ...high}), dt);
        } else enter("rest");
        if (state === "rest" && clip - stateAt > 2.5) tell();
        if (state === "rest" && clip - stateAt > 5) finish(true);
        return drift(frameOf(ids, {widen: 1.2, ...(act.repro ? {first: ids[0]} : {}), ...high}), dt);
    };

    const stepBirth = (dt: number) => {
        const s = since();
        if (replay.feed.play) {
            // A hatching: the scene's own replay act (it flies the camera to the clutch itself). (Watching live too: a
            // tapped hatching line shows its clutch hatch again, as the Ark's "while you were away" does, on the viewer's
            // own time; the world's clock is not touched.)
            if (!playing && clip >= lead) {
                const running = {over: false};
                playing = running;
                actAt = clip;
                enter("hatch");
                void handle.play(replay.feed.play).done.then(() => {
                    running.over = true;
                });
            }
            if (playing && !playing.over) {
                // The scene flies to the clutch itself; once it has landed, the shot's own clear view of the hatching
                // (the young as they come, the parent beside them), until the scene flies on.
                if (!handle.flying || handle.flying() || !handle.sightOf) {
                    hatchView = false;
                    return null;
                }
                if (!hatchView) {
                    hatchView = true;
                    view = handle.view();
                    pick = null;
                }
                const young = located(byRole("young")).filter((at) => at.shown !== false).map((at) => at.id);
                // (Watching live the young are in the read already: the still is the clutch hatched, at the act's end.)
                if (young.length && !live) tell();
                // (V1: until a young is out the picture stays where the scene landed, on the clutch: it went to a parent,
                // which may be across the wood, and the young then hatched out of the picture.)
                if (!young.length) return view;
                return toward(frameOf(young, {widen: 1.3}), dt, 1.6) ?? null;
            }
            if (playing?.over && state === "hatch") {
                enter("after");
                tell(-1.5);
                view = handle.view();
            }
            if (state === "after") {
                if (clip - stateAt > 3) finish(true);
                // (The young where their day has them now, when they are out; else a parent: never a picture as wide as
                // the wood between a chick in its nest hole and a parent out feeding.)
                const out = located(byRole("young")).filter((at) => at.shown !== false).map((at) => at.id);
                const frame = frameOf(out.length ? out : byRole("parent").slice(0, 1), {widen: out.length ? 2 : 1.3});
                return frame ? drift(frame, dt) : view;
            }
            return toward(frameOf(byRole("parent").length ? byRole("parent") : ids, {widen: 1.3, first: byRole("parent")[0] ?? ids[0]}), dt);
        }
        const act = handle.liveActs?.().births.find((b) => b.key === replay.feed.births![0].key);
        const who = act?.mother ? [act.mother, ...byRole("young")] : ids;
        if (s < 0) return toward(frameOf(byRole("parent"), {widen: 1.2, first: byRole("parent")[0]}), dt);
        if (!act || act.phase === "skipped" || (act.phase === "waiting" && s > 3)) {
            if (s > 1.5) {
                enter("still");
                if (clip - stateAt > 7) finish(false, act?.phase === "skipped" ? "the birth layer skipped it: the mother has no day to settle from (in the air, in a tank, off the schedule)" : "the birth was not taken up by the scene (no parent of the record is in it)");
            }
            return drift(frameOf(ids, {widen: 1.2, first: byRole("parent")[0] ?? ids[0]}), dt);
        }
        enter("birth");
        // (The still: every young that is shown can be seen, `live-births.ts` seenBy: a den's have crawled out from under her.)
        // (REAL-REPRODUCTION: a split's halves come apart slowly; held on until they have.)
        const seenBy = Math.min(act.seenBy ?? 12, act.style === "split" ? 48 : 26);
        if (s > seenBy + 1) tell();
        // (Settling, the young born one by one, the first licks: the first 24 s or so; then the nursing goes on for minutes.)
        if (s > Math.min(act.end ?? 24, Math.max(24, seenBy + 5))) finish(true);
        // (V1: once a young is out, close on the mother and the young at her side: the pair framing's room for two
        // walking animals left a litter a tenth of the picture wide. `holdIn` keeps every one of them in.)
        const born = located(byRole("young")).some((at) => at.shown !== false);
        if (act.housed) cutShare = CUT_GROUND_HOUSED;
        // (A tank's, a cage's or a room's: from above, through its open or glass top; from the side there is a wall.)
        // (REAL-REPRODUCTION: a split on the seabed: from above through the water, both halves held, never so near that the
        // camera's near plane cuts into the flat body.)
        if (act.style === "split") return toward(frameOf(who, {widen: 1.8, seabed: true}), dt);
        return toward(frameOf(who, {widen: born ? BIRTH_CLOSE : 1.15, ...(act.housed ? {polar: POLAR_HOUSED} : {})}), dt);
    };

    const stepDeath = (dt: number, last: boolean) => {
        const s = since();
        const id = ids[0];
        if (state === "lead" && s >= 0) enter("fall");
        if (state === "lead" || state === "fall") {
            // (An extinction's still is the ring round the last one as the camera draws back, below.)
            // (V1: the dying act first, `live-deaths.ts`: it weakens on its feet, then goes over; the still is the body lying.)
            if (state === "fall" && s > DEATH_DYING_SECONDS + 0.6 && (!last || handle.sightOf)) tell();
            if (state === "fall" && s > DEATH_DYING_SECONDS + 4) {
                const act = handle.liveActs?.().deaths.find((d) => d.id === id);
                if (!last) {
                    finish(Boolean(act?.drawn), act?.drawn ? null : "its body was not drawn (the scene could not place where it died)");
                    return drift(frameOf([id]), dt);
                }
                report.acted = Boolean(act?.drawn);
                if (!act?.drawn) report.reason = "its body was not drawn (the scene could not place where it died)";
                if (live) {
                    // Watching live, nothing is run fast: the camera draws back over its home range as its body lies.
                    enter("pull");
                    return toward(frameOf([id]), dt);
                }
                // The last of its kind: on to the body's last minutes, run fast, as the camera pulls back over its home range.
                cut(DEATH_BODY_SECONDS - DEATH_FADE_SECONDS - 4, "to the body's last minutes");
                enter("lapse");
                lapseFrom = arkEpochSeconds();
                return toward(frameOf([id]), dt);
            }
            // (Its body from well above, once it is down: it lies among the ground's plants.)
            const body = handle.locate(id);
            return toward(frameOf([id], {widen: s < DEATH_DYING_SECONDS ? 1.15 : 1, ...(s > DEATH_DYING_SECONDS - 1 ? {polar: body && body.length < 0.3 && handle.setNearCut ? POLAR_BODY : POLAR_SMALL} : {})}), dt);
        }
        if (state === "pull") {
            const k = clamp01((clip - stateAt) / 6);
            if (k > 0.45) tell();
            const frame = frameOf([id]);
            if (k >= 1) enter("empty");
            // (V1: a speck, an aphid or a water flea: from 45 m back there is nothing of it to see. The camera draws back
            // only as far as still shows it, with its ring, which is its own size.)
            const speck = (handle.locate(id)?.length ?? 1) < 0.05;
            return toward(frame ? held(frame, lerp(frame.distance, speck ? frame.distance * 3.2 : Math.max(frame.distance * 4, 45), ease(k)), speck ? frame.polar : lerp(POLAR_SMALL, 0.88, ease(k))) : null, dt, 3);
        }
        if (state === "lapse") {
            // 4 s of video for the fade's 3 minutes: the pin moved on every frame.
            const k = clamp01((clip - stateAt) / 4);
            if (k > 0.6) tell();
            pinArkClock(lapseFrom! + ease(k) * (DEATH_FADE_SECONDS + 8));
            const frame = frameOf([id]);
            if (k >= 1) enter("empty");
            return toward(frame ? held(frame, lerp(frame.distance, Math.max(frame.distance * 5, 60), ease(k)), lerp(POLAR_SMALL, 0.88, ease(k))) : null, dt, 3);
        }
        // Its home range, empty. (V1: watching a speck live, the picture stays on it and its ring: its body lies for minutes yet.)
        if (live && (handle.locate(id)?.length ?? 1) < 0.05) {
            if (clip - stateAt > 4) finish(report.acted, report.reason);
            return drift(frameOf([id], {widen: 3.2}), dt);
        }
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
        // (Watching live there may be several meals under way: this one by its two animals, `live-meals.ts` keys.)
        const meal = kind === "meal" ? acts?.meals.find((m) => m.key.startsWith(`${hunter}>${quarry}@`)) ?? (live ? null : acts?.meals[0]) : null;
        const escape = kind === "escaped" ? acts?.escapes.find((e) => e.key === replay.feed.escapes![0].key) : null;
        const end = kind === "meal" ? (meal && meal.catchAt > 0 ? meal.catchAt : null) : escape?.missAt ?? null;
        if (end === null) {
            // (A pair the scene cuts away from, `acts.ts` chaseKind: a swimmer after a land animal, an insect; or no model.)
            if (s > 1.5) {
                enter("still");
                if (clip - stateAt > 7) finish(false, kind === "meal" ? "the meal layer did not act it (the hunter is not drawn, or the pair is one the scene cuts away from)" : "the escape layer did not act a chase (a pair the scene cuts away from, or the prey on the wing): only its limp");
            }
            return drift(frameOf([hunter, quarry], {widen: 1.2, first: quarry}), dt);
        }
        if (end - s > 14) cut(end - 12, "to the end of the stalk");
        const now = since();
        const sight = Boolean(handle.sightOf);
        const [h, q] = [handle.locate(hunter), handle.locate(quarry)];
        // (Their distance through the air: a hawk straight over its quarry is not on it yet.)
        const gap = h && q ? Math.hypot(h.x - q.x, h.y - q.y, h.z - q.z) : null;
        if (kind === "meal") {
            // (The catch, then the meal's first seconds: the feeding goes on for minutes.)
            if (now > end + 1.2) tell();
            if (now > end + 7) finish(true);
        } else if (now > Math.min(escape?.seconds ?? end + 6, end + 8)) finish(true);
        if (sight && now < end - LUNGE_BEFORE) {
            // V1, the stalk: the hunter, the one that moves, alone and large while it is far from its quarry (from far
            // enough back for both, neither reads); the two in one picture once it is near.
            enter("stalk");
            return toward(gap !== null && gap <= STALK_TOGETHER ? frameOf([hunter, quarry], {widen: 1.15, polar: POLAR_CHASE, max: 60}) : frameOf([hunter], {widen: 1.3}), dt, 4);
        }
        if (state !== "chase") {
            // From the hunter to its quarry, where the chase comes: an edit (with the lines of sight, only when it is far).
            if (!sight) view = null;
            enter("chase");
        }
        if (sight && now < end + (kind === "meal" ? 0.4 : LUNGE_AFTER)) {
            // V1, the lunge: the picture is on the quarry and stays on it, near (a few of its own lengths' room round
            // it, from lower than the chase: side on to the two), and the hunter comes INTO it: the camera is there
            // before the hunter is (a sprint and a stoop outrun any easing, and a picture that holds both from the
            // start is far enough back that neither reads). An escape's still: the frame at which both were well
            // inside the picture and nearest each other (through the air: a hawk straight over its quarry is not on it yet).
            if (kind === "escaped" && view && h && q && h.shown !== false && q.shown !== false && now > end - 1.2) {
                // (How far the worse placed of the two is from the picture's middle, 1 at its edge; a little for how far apart they are.)
                const [ph, pq] = [inPicture(view, h, h.length * 0.3), inPicture(view, q, q.length * 0.3)];
                const off = ph && pq ? Math.max(ph.x, ph.y, pq.x, pq.y) : Infinity;
                const score = off + Math.min((gap ?? 0) / Math.max(view.distance, 1e-3), 1) * 0.5;
                if (off < 0.9 && score < lungeGap) {
                    lungeGap = score;
                    report.keyAt = Math.round(clip * 100) / 100;
                }
            }
            // (No frame of both in the picture: the miss itself, the quarry breaking away.)
            if (kind === "escaped" && now > end + 0.15 && lungeGap === Infinity) tell();
            // (Composed for the lunge's end from its start: the quarry, and the place beside it where the hunter will be
            // when it is on it, toward where it is coming from: an upright picture then holds the two along its tall
            // side, a tiger and the monkey it lunges at both whole.)
            const reach = h && q ? (h.length + q.length) * 0.5 + Math.max(Math.min(h.length, q.length) * 0.25, 0.08) : 0;
            const flat = h && q ? Math.hypot(h.x - q.x, h.z - q.z) : 0;
            const there = h && q && flat > 1e-3 ? [{...h, id: `${hunter}@lunge`, x: q.x + ((h.x - q.x) / flat) * reach, y: q.y + Math.min(Math.max(h.y - q.y, -reach), reach) * Math.min(reach / Math.max(gap ?? reach, reach), 1), z: q.z + ((h.z - q.z) / flat) * reach, shown: true}] : [];
            const on = frameOf([quarry], {polar: POLAR_LUNGE, also: there});
            // (Its aim is all but at once: the quarry is at a run, and a picture that trails it has the two at its edge.)
            return toward(on && !there.length ? held(on, Math.max(on.distance * LUNGE_ROOM, LUNGE_LEAST), POLAR_LUNGE) : on, dt, 6, 3, 40);
        }
        if (kind === "meal") {
            // (The quarry, and the hunter once it is on it: the catch, then the meal where the prey fell.)
            return toward(frameOf([hunter, quarry], {widen: now > end ? 1.05 : 1.3, first: quarry, closing: now > end ? CLOSING : CLOSING_CHASE, polar: POLAR_CHASE}), dt, 6);
        }
        // (The still: the lunge as it meets empty air; without a frame of both in the picture, just after the miss.)
        if (now > end + (sight ? LUNGE_AFTER : 0.08)) tell();
        // (Once it is away, the one that got away: the two are soon too far apart for one picture.)
        return toward(frameOf([hunter, quarry], {widen: 1.2, first: quarry, closing: !sight ? CLOSING_CHASE : now > end + 2.5 ? TOGETHER * 0.4 : TOGETHER * 0.6, polar: POLAR_CHASE, max: 60}), dt, 6, sight ? 3 : 0.6);
    };

    const stepLastStand = (dt: number) => {
        const last = byRole("last");
        const predator = byRole("predator");
        const alone = frameOf(last);
        if (clip < 0.05) enter("wide");
        if (clip < 6) {
            // From over its home range, in to the last one.
            const k = ease(clip / 6);
            return toward(alone ? held(alone, lerp(Math.max(alone.distance * 6, 55), alone.distance * 1.1, k), lerp(0.86, alone.polar, k)) : null, dt, 4);
        }
        // And the one that hunts it, in the same picture, when it is near enough for one.
        const off = predator.length ? apart(last[0], predator[0]) : null;
        const near = off !== null && off <= TOGETHER * 2;
        if (predator.length && !near && !report.notes.length) report.notes.push(`the hunter is ${off === null ? "not in the scene" : `${Math.round(off)} m away`}: not in the same picture`);
        if (clip < 11 || !near) {
            if (clip > 9) tell();
            if (!near && clip > 13) finish(true);
            return drift(alone, dt);
        }
        if (clip > 15 && clip < 15.2) report.keyAt = Math.round(clip * 100) / 100;
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
        if (arrived && clip > actAt + 2.5) tell();
        if (clip > 15) finish(true);
        const k = ease((clip - 3.6) / 3);
        return toward(here ? held(here, here.distance * lerp(2.6, 1.15, k), lerp(0.95, here.polar, k)) : null, dt, 3);
    };

    return {
        begin: () => {
            if (live) {
                // Watching live: the layers are the live log's, the clock everyone's; only the cast's group is this shot's.
                cast.bring(key, replay.cast.map((member) => member.record), {marks: replay.marks}).apply();
                return;
            }
            // (Nothing of an earlier replay, or of the live log, is still being acted when this one starts.)
            handle.clearLiveActs?.();
            pinArkClock(t0 - lead - REPLAY_SETTLE_SECONDS);
            relight();
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
            if (live) return;
            pinArkClock(t0 - lead);
            relight();
            view = null;
        },
        step: (t, dt) => {
            clip = t;
            if (!hourPinned && (options.nightGain ?? 1) > 0) {
                // The camera's exposure and its fill follow the dark (the island's hour on the pinned clock): dusk is
                // dark on a forest floor well before the stars are out, so by the daylight, not by the night sky.
                const dark = clamp01((1 - daylightAt(islandHours(arkEpochSeconds() * 1000)).daylight) / 0.75);
                const scale = options.nightGain ?? 1;
                const gain = 1 + (NIGHT_EXPOSURE * scale - 1) * dark;
                handle.setExposure?.(Math.max(gain, 1), Math.max(1 + (NIGHT_FILL * scale - 1) * dark, 1));
                report.gain = Math.max(report.gain, Math.round(gain * 100) / 100);
            }
            const next = stepKind(dt);
            cone(next ?? handle.view());
            return next;
        },
        doneAt: () => done,
        actAt: () => actAt,
        report: () => {
            // (Who stands in is the roster's, as the scene last laid it out; kept once the cast is gone.)
            if (!ended) Object.assign(report, cast.report());
            return {...report, notes: [...report.notes], cuts: [...report.cuts], seen: {...report.seen}, sight: {...sights, met: {...sights.met}}};
        },
        end: () => {
            if (!ended) Object.assign(report, cast.report());
            ended = true;
            handle.setNearCone?.(null);
            handle.setNearCut?.(null);
            handle.setGroundClear?.(null);
            handle.setExposure?.(1, 1);
            if (live) {
                // (The live world goes on: its acts are not let go, and the shared cast only loses this shot's group.)
                cast.release(key).apply();
                return;
            }
            // (While the cast is still in: whoever a meal's or a death's stand-in hid is shown again.)
            handle.clearLiveActs?.();
            pinArkClock(null);
            handle.setHours(hourPinned ? options.hour! : null);
            cast.detach();
        }
    };

    /** The leaves between the camera and whoever of the cast is in the picture dissolve (`near-fade.ts`). */
    function cone(at: ArkCameraView | null) {
        if (!at) {
            handle.setNearCut?.(null);
            handle.setGroundClear?.(null);
            handle.setNearCone?.(null);
            return;
        }
        const sinP = Math.sin(at.polar);
        const eye = {x: at.target.x + at.distance * sinP * Math.sin(at.azimuth), y: at.target.y + at.distance * Math.cos(at.polar), z: at.target.z + at.distance * sinP * Math.cos(at.azimuth)};
        const axis = {x: (at.target.x - eye.x) / at.distance, y: (at.target.y - eye.y) / at.distance, z: (at.target.z - eye.z) / at.distance};
        let end = 0;
        let wide = CONE;
        let held = 0;
        let cut = Infinity;
        const spots: Array<{x: number; z: number; r: number}> = [];
        for (const p of located(ids)) {
            if (p.shown === false) continue;
            const v = {x: p.x - eye.x, y: p.y - eye.y, z: p.z - eye.z};
            const along = v.x * axis.x + v.y * axis.y + v.z * axis.z;
            if (along <= 0) continue;
            const off = Math.hypot(v.x - axis.x * along, v.y - axis.y * along, v.z - axis.z * along) / along;
            if (off > 0.5) continue;
            held++;
            spots.push({x: p.x, z: p.z, r: Math.min(Math.max(p.length, 0.25) * 0.9 + 0.25, 2.5)});
            wide = Math.max(wide, Math.min(off + 0.1, CONE_MOST));
            // (As far as the farthest of them and its own body's depth again: the plant an animal stands in dissolves
            // round it too. The animals themselves never fade.)
            end = Math.max(end, along + Math.max(p.length, p.height) * 0.8);
            cut = Math.min(cut, cutAt(at.distance, at.polar, at.distance - along + Math.max(p.length, p.height) * 0.6 + 0.02, cutShare));
        }
        handle.setNearCone?.(held && end > 0.05 ? {tan: wide, end} : null);
        handle.setNearCut?.(held && cut > 0 && Number.isFinite(cut) ? cut : null, held ? at.distance * 0.9 : null);
        handle.setGroundClear?.(spots.length ? spots : null);
    }

    function stepKind(dt: number): ArkCameraView | null {
            if (done !== null) {
                // The linger: the same picture, drifting.
                if (playing && !playing.over) return null;
                if (replay.kind === "extinct") {
                    // (V1: watching a speck's end live, the linger stays on it and its ring.)
                    const last = byRole("last")[0] ?? ids[0];
                    if (live && !replay.feed.meals && (handle.locate(last)?.length ?? 1) < 0.05) return drift(frameOf([last], {widen: 3.2}), dt, 0.06);
                    return view ? (view = {...view, azimuth: view.azimuth + 0.05 * dt, distance: view.distance + 1.2 * dt}) : null;
                }
                if (replay.kind === "birth" && !replay.feed.play) {
                    // (V1: the linger on the mother and the young still by her: never out to the other parent across the lake.)
                    const act = handle.liveActs?.().births.find((b) => b.key === replay.feed.births![0].key);
                    const mother = act?.mother ? handle.locate(act.mother) : null;
                    const by = mother ? located(byRole("young")).filter((at) => at.shown !== false && Math.hypot(at.x - mother.x, at.z - mother.z) <= Math.max(mother.length * 2.5, 0.5)).map((at) => at.id) : [];
                    if (mother) return drift(frameOf([act!.mother!, ...by], act?.style === "split" ? {widen: 1.8, seabed: true} : {widen: by.length ? BIRTH_CLOSE : 1.2}), dt, 0.06);
                }
                const all = located(ids);
                const near = all.length < 2 || all.every((p) => all.every((q) => Math.hypot(p.x - q.x, p.z - q.z) <= TOGETHER * 2));
                return drift(frameOf(near ? ids : ids.slice(0, 1), {widen: 1.2}), dt, 0.06);
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
            return next;
    }
}
