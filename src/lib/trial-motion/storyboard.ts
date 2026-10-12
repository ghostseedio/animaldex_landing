/**
 * Trial Loops: the storyboard a Trial stores in `species_trials.motion_storyboard`
 * (spec v1, `AnimalDex/docs/trial-motion/SPEC.md`).
 *
 * Authored files pass `validate.py` before they reach the database, and the DB
 * only checks the outline (`v = 1`, a beats array, an actors object). This
 * parser is the client's guard: it accepts exactly what the renderer can draw
 * without throwing, and turns anything else into null so the Trial shows what
 * it showed before Trial Loops existed. Authoring rules (caption wording,
 * overlaps, composition) are the validator's business, not this one's.
 */

import vocabulary from "./vocabulary.json";

export type TrialMotionPoseName = keyof typeof vocabulary.figure.poses;

export type TrialMotionFigureActor = {
    kind: "figure";
    x: number;
    facing?: "left" | "right";
    tone?: "you" | "other";
    pose?: string;
    hidden?: boolean;
};

export type TrialMotionItemActor = {
    kind: "item";
    glyph: string;
    x: number;
    y: number;
    size?: "s" | "m" | "l";
    tile?: boolean;
    hidden?: boolean;
};

export type TrialMotionPileActor = {
    kind: "pile";
    count: number;
    glyphs: string[];
    y?: number;
    hidden?: boolean;
};

export type TrialMotionListActor = {
    kind: "list";
    glyphs: string[];
    y?: number;
    hidden?: boolean;
};

export type TrialMotionActor = TrialMotionFigureActor | TrialMotionItemActor | TrialMotionPileActor | TrialMotionListActor;

/**
 * One event. Every event has `type` and `at`; the rest depends on the type
 * (see the events table in SPEC.md). Kept as one loose shape, as the reference
 * renderer reads it, rather than a union the port would have to narrow at every
 * use: the parser has already checked the fields each type needs.
 */
export type TrialMotionEvent = {
    type: string;
    at: number;
    actor?: string;
    until?: number;
    dur?: number;
    pose?: string;
    to?: number | string;
    from?: number | string;
    gait?: "walk" | "run";
    dx?: number;
    seconds?: number;
    id?: string;
    glyph?: string;
    style?: "speech" | "thought";
    target?: string;
    x?: number;
    y?: number;
    keep?: number[];
    index?: number;
    n?: number;
    marks?: string[];
};

export type TrialMotionBeat = {
    at: number;
    caption: string;
    events?: TrialMotionEvent[];
};

export type TrialStoryboard = {
    v: 1;
    loop: number;
    poster?: number;
    actors: Record<string, TrialMotionActor>;
    beats: TrialMotionBeat[];
};

const POSES = new Set(Object.keys(vocabulary.figure.poses));
const EVENT_SPECS = vocabulary.events as Record<string, {actorKinds: string[]; fields: Record<string, string>}>;
const ACTOR_KINDS = new Set(vocabulary.actorKinds);
const LIMITS = vocabulary.limits;
const TIMING = vocabulary.timing;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value);
}

function isStringList(value: unknown, min: number, max: number): value is string[] {
    return Array.isArray(value) && value.length >= min && value.length <= max && value.every((item) => typeof item === "string");
}

function actorIsDrawable(actor: unknown): actor is TrialMotionActor {
    if (!isRecord(actor) || typeof actor.kind !== "string" || !ACTOR_KINDS.has(actor.kind)) return false;
    switch (actor.kind) {
        case "figure":
            return isNumber(actor.x) && (actor.pose === undefined || (typeof actor.pose === "string" && POSES.has(actor.pose)));
        case "item":
            return typeof actor.glyph === "string" && isNumber(actor.x) && isNumber(actor.y)
                && (actor.size === undefined || actor.size === "s" || actor.size === "m" || actor.size === "l");
        case "pile":
            return isNumber(actor.count) && Number.isInteger(actor.count) && actor.count >= 1 && actor.count <= 12
                && isStringList(actor.glyphs, 1, 4) && (actor.y === undefined || isNumber(actor.y));
        case "list":
            return isStringList(actor.glyphs, 1, 6) && (actor.y === undefined || isNumber(actor.y));
        default:
            return false;
    }
}

/** The fields the renderer does arithmetic with, per event type. Missing ones would draw NaN. */
function eventIsDrawable(event: Record<string, unknown>, actors: Record<string, TrialMotionActor>, markIds: Set<string>) {
    const type = String(event.type);
    const spec = EVENT_SPECS[type];
    if (!spec || !isNumber(event.at)) return false;

    if (spec.actorKinds.length) {
        const actor = typeof event.actor === "string" ? actors[event.actor] : undefined;
        if (!actor || !spec.actorKinds.includes(actor.kind)) return false;
    }

    const optionalNumber = (key: string) => event[key] === undefined || isNumber(event[key]);
    const actorRef = (key: string) => typeof event[key] === "string" && Boolean(actors[event[key] as string]);
    const until = () => isNumber(event.until) && (event.until as number) > (event.at as number);

    switch (type) {
        case "pose":
            return typeof event.pose === "string" && POSES.has(event.pose) && optionalNumber("dur");
        case "move":
            return isNumber(event.to) && isNumber(event.dur) && (event.dur as number) > 0;
        case "jump":
            return isNumber(event.dx);
        case "hold":
            return isNumber(event.seconds) && until();
        case "mark":
            if (typeof event.id !== "string" || !event.id) return false;
            markIds.add(event.id);
            return true;
        case "holding":
        case "bubble":
            return typeof event.glyph === "string" && until();
        case "look":
            return actorRef("target") && until();
        case "slide":
            return isNumber(event.x) && isNumber(event.y) && optionalNumber("dur");
        case "transform":
            return typeof event.glyph === "string";
        case "pulse":
            return until();
        case "give":
            return actorRef("from") && actorRef("to") && typeof event.glyph === "string" && optionalNumber("dur");
        case "stack":
            return until();
        case "discard": {
            const pile = actors[event.actor as string] as TrialMotionPileActor;
            const keep = event.keep;
            return until() && Array.isArray(keep) && keep.length >= 1 && keep.length <= 4
                && keep.every((index) => Number.isInteger(index) && index >= 0 && index < pile.count);
        }
        case "sort":
            return optionalNumber("dur");
        case "step": {
            const list = actors[event.actor as string] as TrialMotionListActor;
            return Number.isInteger(event.index) && (event.index as number) >= 0 && (event.index as number) < list.glyphs.length;
        }
        case "count":
            return isNumber(event.from) && isNumber(event.to) && until();
        case "timer":
            return isNumber(event.seconds) && until();
        case "tally":
            return Number.isInteger(event.n) && (event.n as number) >= 1 && (event.n as number) <= 10 && until();
        case "compare":
            return Array.isArray(event.marks) && event.marks.length === 2;
        default:
            // reset, show, hide, check, cross, keep: nothing beyond the actor.
            return true;
    }
}

/**
 * A storyboard the renderer can draw, or null. Null covers the column being
 * empty (today, everywhere) as well as anything malformed.
 */
export function parseTrialStoryboard(value: unknown): TrialStoryboard | null {
    let raw = value;
    if (typeof raw === "string") {
        try {
            raw = JSON.parse(raw);
        } catch {
            return null;
        }
    }
    if (!isRecord(raw) || raw.v !== 1) return null;

    const loop = raw.loop;
    if (!isNumber(loop) || loop < TIMING.loopMin || loop > TIMING.loopMax) return null;
    if (raw.poster !== undefined && !(isNumber(raw.poster) && raw.poster >= 0 && raw.poster < loop)) return null;

    if (!isRecord(raw.actors)) return null;
    const actorEntries = Object.entries(raw.actors);
    if (!actorEntries.length || actorEntries.length > LIMITS.actorsMax) return null;
    if (!actorEntries.every(([, actor]) => actorIsDrawable(actor))) return null;
    const actors = raw.actors as Record<string, TrialMotionActor>;

    const beats = raw.beats;
    if (!Array.isArray(beats) || beats.length < LIMITS.beatsMin || beats.length > LIMITS.beatsMax) return null;

    let previousAt = -1;
    let eventCount = 0;
    const markIds = new Set<string>();
    const compares: Array<Record<string, unknown>> = [];
    let hasDiscard = false;
    let hasKeep = false;
    for (const beat of beats) {
        if (!isRecord(beat) || !isNumber(beat.at) || beat.at <= previousAt || beat.at >= loop) return null;
        if (typeof beat.caption !== "string" || !beat.caption.trim()) return null;
        previousAt = beat.at;
        if (beat.events === undefined) continue;
        if (!Array.isArray(beat.events)) return null;
        for (const event of beat.events) {
            if (!isRecord(event) || !eventIsDrawable(event, actors, markIds)) return null;
            if (event.type === "compare") compares.push(event);
            if (event.type === "discard") hasDiscard = true;
            if (event.type === "keep") hasKeep = true;
            eventCount += 1;
        }
    }
    if ((beats[0] as TrialMotionBeat).at !== 0) return null;
    if (eventCount > LIMITS.eventsMax) return null;
    // A compare draws bars to marks; a keep moves the tiles a discard kept.
    if (!compares.every((event) => (event.marks as unknown[]).every((mark) => typeof mark === "string" && markIds.has(mark)))) return null;
    if (hasKeep && !hasDiscard) return null;

    return raw as TrialStoryboard;
}

/** The numbered steps under the stage, in order. */
export function trialMotionCaptions(storyboard: TrialStoryboard) {
    return storyboard.beats.map((beat) => beat.caption.trim());
}

/** The stage's accessible name: the captions joined in order. */
export function trialMotionAccessibilityLabel(captions: string[]) {
    return captions.map((caption) => caption.replace(/[.\s]+$/, "")).join(". ") + ".";
}

/** The still frame for Reduce Motion, and the first frame painted. */
export function trialMotionPosterTime(storyboard: TrialStoryboard) {
    return storyboard.poster ?? storyboard.loop - 0.6;
}

/** Which caption is active at `t` (seconds, wrapped by the loop): the last beat that has started. */
export function trialMotionBeatIndexAt(storyboard: TrialStoryboard, t: number) {
    const loop = storyboard.loop;
    const wrapped = ((t % loop) + loop) % loop;
    let current = 0;
    storyboard.beats.forEach((beat, index) => {
        if (wrapped >= beat.at) current = index;
    });
    return current;
}
