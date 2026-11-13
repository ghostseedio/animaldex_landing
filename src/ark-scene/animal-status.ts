/**
 * An animal's status from the behaviour schedule it already runs (decision 240): what it is doing now, what its next
 * slots are for (or, asleep, when it wakes), and what it did over its last slots; and the live log's moments, the
 * notable things the schedule has animals starting anywhere on the Ark (a lion setting out to hunt, a weaver building
 * its nest, a herd going down to water, a young one playing).
 *
 * Everything here is a pure function of the shared clock, the animals' ids and what the server sent, through
 * `slotPlanAt` (the slot's goal, the same one its trip is built from): the same for every viewer, never per viewer
 * (the local reactive layer near the camera is not read). Visual only: nothing here decides anything on the Ark.
 */

import {awakeAt, slotOffset, slotPlanAt, SLOT_SECONDS, type HoursAt, type ScheduleAnimal, type ScheduleWorld, type SlotPlan, type Trip} from "@/ark-scene/behaviour-schedule";
import type {ArkBehaviourProfile} from "@/ark-scene/behaviour-profile";
import {hash32} from "@/lib/ark-clock";
import {arkActivityKey, type ArkActivityKey, type ArkStatusGoal, type ArkStatusLogEntry} from "@/lib/ark-animal-status";

/** One animal on the schedule, as the status reads it. */
export type ScheduleSubject = {
    id: string;
    world: ScheduleWorld;
    profile: ArkBehaviourProfile;
    /** Its schedule animal at a moment (Part C: a zoo animal at feeding time has its enclosure's station for its home). */
    animalAt: (epoch: number) => ScheduleAnimal;
    /** A zoo's feeding time at a moment, when it has one. */
    feedingAt?: ((epoch: number) => boolean) | null;
    activity: ArkBehaviourProfile["activity"] | null | undefined;
    hoursAt: HoursAt;
};

/** Its slot's plan at a moment. */
export function planOf(subject: ScheduleSubject, epoch: number): SlotPlan {
    return slotPlanAt(subject.world, subject.profile, subject.animalAt(epoch), epoch, subject.hoursAt, subject.activity);
}

function keyOf(subject: ScheduleSubject, plan: SlotPlan, extra: {travelling?: boolean; hunting?: boolean} = {}): ArkActivityKey {
    const feeding = Boolean(subject.feedingAt?.(plan.start + SLOT_SECONDS / 2));
    return arkActivityKey({doing: plan.doing, recipe: plan.recipe, wary: plan.wary, feeding, flyer: subject.profile.move === "fly", still: plan.still, ...extra});
}

/** Slots looked back over for its log (about thirteen minutes), and the log's schedule lines at most. */
const LOOK_BACK = 10;
const PAST_RUNS = 5;
/** Slots looked ahead for its next goal; a sleeper's wake looked for over a day. */
const LOOK_AHEAD = 3;
const WAKE_SLOTS = Math.ceil(86_400 / SLOT_SECONDS) + 1;

export type ScheduleStatus = {activity: ArkActivityKey; since: number; goal: ArkStatusGoal | null; log: ArkStatusLogEntry[]};

/**
 * Its status now. `trip`: the trip it is on (the scene's), for whether it is still on its way to its goal; `hunting`:
 * walking its forays under encounter hunting now (`hunting.ts`, from the server's next hunt).
 */
export function scheduleStatus(subject: ScheduleSubject, epoch: number, context: {trip?: Trip | null; hunting?: boolean} = {}): ScheduleStatus {
    const plan = planOf(subject, epoch);
    const trip = context.trip && context.trip.slot === plan.slot ? context.trip : null;
    const travelling = Boolean(trip && epoch < trip.arrive && trip.length > 0.5);
    const settled = keyOf(subject, plan);
    const activity = context.hunting ? "hunting" : keyOf(subject, plan, {travelling});
    // Back through its last slots: the run it is in now (since when), then the runs before it, newest first.
    let since = plan.start;
    let runKey = settled;
    let runStart = plan.start;
    let current = true;
    const log: ArkStatusLogEntry[] = [];
    for (let k = 1; k <= LOOK_BACK && log.length < PAST_RUNS; k++) {
        const earlier = planOf(subject, plan.start - k * SLOT_SECONDS + 0.5);
        const key = keyOf(subject, earlier);
        if (key === runKey) {
            runStart = earlier.start;
            if (current) since = runStart;
            continue;
        }
        if (!current) log.push(scheduleEntry(subject.id, runKey, runStart));
        current = false;
        runKey = key;
        runStart = earlier.start;
    }
    if (!current && log.length < PAST_RUNS) log.push(scheduleEntry(subject.id, runKey, runStart));
    return {activity, since, goal: context.hunting ? null : goalOf(subject, plan, settled, activity, trip, travelling), log};
}

function scheduleEntry(id: string, activity: ArkActivityKey, start: number): ArkStatusLogEntry {
    return {id: `slot:${id}:${Math.round(start)}`, source: "schedule", at: start * 1000, day: null, kind: "activity", activity};
}

function goalOf(subject: ScheduleSubject, plan: SlotPlan, settled: ArkActivityKey, now: ArkActivityKey, trip: Trip | null, travelling: boolean): ArkStatusGoal | null {
    if (plan.doing === "sleep") {
        // Asleep: it wakes at the first slot that starts in its waking hours (the schedule's own rule).
        for (let k = 1; k <= WAKE_SLOTS; k++) {
            const start = plan.start + k * SLOT_SECONDS;
            if (awakeAt(subject.profile, subject.activity, subject.hoursAt(start))) return {kind: "wakes", at: start};
        }
        return null;
    }
    // On its way: what it is going there for.
    if (travelling && trip && settled !== now) return {kind: "next", activity: settled, at: trip.arrive};
    for (let k = 1; k <= LOOK_AHEAD; k++) {
        const later = planOf(subject, plan.start + k * SLOT_SECONDS + 0.5);
        const key = keyOf(subject, later);
        if (key !== now) return {kind: "next", activity: key, at: later.start};
    }
    return null;
}

// MARK: The live log's moments

/** The live log's schedule moments come in windows of this many seconds of the shared clock: one line each at most. */
export const MOMENT_WINDOW_SECONDS = 5;

export type ScheduleMomentKind = "hunting" | "nest" | "eggs" | "courting" | "contest" | "fishing" | "playing" | "toWater" | "home" | "flock" | "breathing" | "calling" | "bathing" | "feeding" | "group" | "doing";

/** An animal the moments may name: its schedule, and what makes its moments worth saying. */
export type MomentSubject = ScheduleSubject & {
    /** Young (born on the Ark not long ago). */
    young: boolean;
    /** How big a group it leads, itself included (0: it leads none). */
    leads: number;
    /** An air-breather in the water big enough to be seen coming up (a whale, a dolphin, a seal, a turtle). */
    surfaces: boolean;
};

/**
 * How likely a moment of each kind is said, per window it starts in (a seeded draw, the same for everyone): the rare
 * and the striking nearly always; the everyday (`doing`: an animal setting about something else, "A Red Deer is
 * drinking") now and then, so the log keeps a steady flow without crowding.
 */
export const MOMENT_WEIGHTS: Record<ScheduleMomentKind, number> = {hunting: 1, nest: 1, eggs: 0.6, courting: 1, contest: 1, fishing: 0.8, playing: 1, toWater: 1, home: 1, flock: 0.8, breathing: 0.5, calling: 0.4, bathing: 0.7, feeding: 1, group: 0.7, doing: 0.3};
/** Which moment a window says when several are let through: the striking first, then the notable, then the everyday. */
const MOMENT_TIER: Record<ScheduleMomentKind, number> = {hunting: 0, nest: 0, eggs: 0, courting: 0, contest: 0, playing: 0, toWater: 0, home: 0, flock: 0, feeding: 0, fishing: 1, bathing: 1, breathing: 1, calling: 1, group: 1, doing: 2};
/** The everyday activities a moment may say of one animal (`doing`) or of a group by its leader (`group`). */
// (The schedule's stalk, "waiting for prey" or "on the prowl", is everyday too: visual only, nothing is caught. The live
// log's "is hunting" is the server's encounter hunt alone, a due predator setting out on its forays: `pickMoment`'s starts.)
const EVERYDAY: ReadonlySet<ArkActivityKey> = new Set<ArkActivityKey>(["food", "grazing", "browsing", "drinking", "swimming", "flying", "basking", "grooming", "climbing", "digging", "flowers", "home", "toWater", "watching", "wary", "hiding", "light", "waiting", "prowling"]);
const GROUP_EVERYDAY: ReadonlySet<ArkActivityKey> = new Set<ArkActivityKey>(["food", "grazing", "browsing", "swimming", "resting", "basking"]);

/** The moment a slot starts, if it is one (its goal changed from the slot before to one worth saying), and its activity. */
export function momentOf(subject: MomentSubject, plan: SlotPlan, before: SlotPlan): {kind: ScheduleMomentKind; activity: ArkActivityKey} | null {
    const now = keyOf(subject, plan);
    if (now === keyOf(subject, before)) return null;
    const kind = ((): ScheduleMomentKind | null => {
        switch (now) {
            case "feeding":
            case "hunting":
            case "nest":
            case "eggs":
            case "courting":
            case "fishing":
            case "bathing":
            case "calling":
                return now;
            case "sparring":
                return "contest";
            case "playing":
                return subject.young ? "playing" : null;
            case "drinking":
                return subject.leads >= 3 ? "toWater" : "doing";
            case "home":
                return subject.leads >= 3 ? "home" : "doing";
            case "flying":
                return subject.leads >= 3 ? "flock" : "doing";
            case "breathing":
                return subject.surfaces ? "breathing" : null;
            default:
                if (subject.leads >= 3 && GROUP_EVERYDAY.has(now)) return "group";
                return EVERYDAY.has(now) ? "doing" : null;
        }
    })();
    return kind ? {kind, activity: now} : null;
}

/** The moment's kind alone (tests, and the checks of what a line says). */
export function momentKind(subject: MomentSubject, plan: SlotPlan, before: SlotPlan): ScheduleMomentKind | null {
    return momentOf(subject, plan, before)?.kind ?? null;
}

export type ScheduleMoment = {id: string; kind: ScheduleMomentKind; activity: ArkActivityKey; animalId: string; /** When it starts (epoch seconds). */ at: number; /** A group's size. */ count: number};

/** Candidates looked at per window at most (a bounded, fixed amount of work: the same for every viewer). */
const MOMENT_CAP = 120;

function draw(...parts: Array<string | number>): number {
    return hash32(...parts) / 4294967296;
}

/** Its slot that starts inside the window, if one does: its start (epoch seconds). */
export function slotStartIn(id: string, from: number, to: number): number | null {
    const offset = slotOffset(id);
    const start = Math.ceil((from + offset) / SLOT_SECONDS) * SLOT_SECONDS - offset;
    return start < to ? start : null;
}

/**
 * The window's moment, or null: among the animals whose slot starts in it (in a seeded order of the window, the first
 * `MOMENT_CAP`), those whose new slot is a moment and whose draw lets it through; of them the most striking, the first
 * in that order among equals. `starts`: encounter hunting's forays that begin in the window (the server's next hunts),
 * said before anything else.
 */
export function pickMoment(window: number, subjects: readonly MomentSubject[], starts: ReadonlyArray<{subject: MomentSubject; at: number}> = []): ScheduleMoment | null {
    const from = window * MOMENT_WINDOW_SECONDS;
    const to = from + MOMENT_WINDOW_SECONDS;
    if (starts.length) {
        const first = [...starts].sort((a, b) => draw("ark-hunt", window, a.subject.id) - draw("ark-hunt", window, b.subject.id) || a.subject.id.localeCompare(b.subject.id))[0];
        return {id: `now:hunt:${first.subject.id}:${window}`, kind: "hunting", activity: "hunting", animalId: first.subject.id, at: first.at, count: 1};
    }
    const candidates: Array<{subject: MomentSubject; start: number; order: number}> = [];
    for (const subject of subjects) {
        const start = slotStartIn(subject.id, from, to);
        if (start !== null) candidates.push({subject, start, order: draw("ark-moment", window, subject.id)});
    }
    candidates.sort((a, b) => a.order - b.order || a.subject.id.localeCompare(b.subject.id));
    let best: ScheduleMoment | null = null;
    let bestTier = Infinity;
    for (const {subject, start} of candidates.slice(0, MOMENT_CAP)) {
        const moment = momentOf(subject, planOf(subject, start + 0.5), planOf(subject, start - 0.5));
        if (!moment || MOMENT_TIER[moment.kind] >= bestTier || draw("ark-accept", window, subject.id) >= MOMENT_WEIGHTS[moment.kind]) continue;
        bestTier = MOMENT_TIER[moment.kind];
        best = {id: `now:${subject.id}:${Math.round(start)}`, kind: moment.kind, activity: moment.activity, animalId: subject.id, at: start, count: moment.kind === "toWater" || moment.kind === "home" || moment.kind === "flock" || moment.kind === "group" ? subject.leads : 1};
        if (bestTier === 0) break;
    }
    return best;
}
