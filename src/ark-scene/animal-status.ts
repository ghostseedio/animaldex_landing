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

import {awakeAt, drawnRecipeAt, flightSpan, pairMeetingsAt, scheduleGeneration, slotOffset, slotPlanAt, stayIsFeeding, SLOT_SECONDS, tripAt, type HoursAt, type ScheduleAnimal, type ScheduleWorld, type SlotPlan, type Trip} from "@/ark-scene/behaviour-schedule";
import type {ArkBehaviourProfile} from "@/ark-scene/behaviour-profile";
import {hash32} from "@/lib/ark-clock";
import {recipeBase} from "@/ark-scene/recipe-templates-reptiles";
import {arkActivityKey, arkFed, arkFedRates, arkRecipeActivity, type ArkActivityKey, type ArkFed, type ArkFedSlot, type ArkStatusGoal, type ArkStatusLogEntry} from "@/lib/ark-animal-status";

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

/** From a world time on, the card says this (its timeline, lane ark-activities 2026-11-14: what the scene draws then). */
type Segment = {at: number; key: ArkActivityKey};

/** Its trip in a slot: the scene's, when it is that slot's, else the schedule's own (pure, remembered with the trips). */
function tripIn(subject: ScheduleSubject, plan: SlotPlan, given: Trip | null): Trip {
    if (given && given.slot === plan.slot) return given;
    const at = plan.start + 0.5;
    return tripAt(subject.world, subject.profile, subject.animalAt(at), at, subject.hoursAt, subject.activity);
}

/**
 * What the card says through one slot, in order. Its slot's goal, but a flight slot is said as the scene draws it
 * (owner, 2026-11-14: "sometimes it says [animal] is flying but I click the log and it's not actually flying"): a
 * flight is a few seconds to tens of seconds of an 80 s slot, after a wait where it was, and then it is down, so it is
 * resting where it waits, flying only while its trip has it in the air (`flightSpan`), then looking for food or resting
 * where it came down, as its stay there does.
 */
function slotSegments(subject: ScheduleSubject, plan: SlotPlan, given: Trip | null): Segment[] {
    const key = keyOf(subject, plan);
    if (key !== "flying") return [{at: plan.start, key}];
    const trip = tripIn(subject, plan, given);
    const span = flightSpan(trip);
    const down: ArkActivityKey = stayIsFeeding(trip) ? "food" : "resting";
    if (!span) return [{at: plan.start, key: down}];
    const out: Segment[] = [];
    if (span.from > plan.start + 0.5) out.push({at: plan.start, key: "resting"});
    out.push({at: Math.max(span.from, plan.start), key: "flying"});
    if (span.to < plan.end - 0.5) out.push({at: span.to, key: down});
    return out;
}

/** An episode laid over the timeline (a pair's meeting, its stay's recipe): its key from its start, then what was in force. */
function layEpisode(timeline: Segment[], t0: number, t1: number, key: ArkActivityKey): Segment[] {
    let after: ArkActivityKey | null = null;
    for (const seg of timeline) if (seg.at <= t1) after = seg.key;
    const kept = timeline.filter((seg) => seg.at < t0 || seg.at >= t1);
    kept.push({at: t0, key});
    if (after && !kept.some((seg) => seg.at === t1)) kept.push({at: t1, key: after});
    return kept.sort((a, b) => a.at - b.at);
}

/** The flyers' keys that say it is settled where it is: in the air on such a slot (on its way to its perch), it is flying. */
const SETTLED: ReadonlySet<ArkActivityKey> = new Set<ArkActivityKey>(["resting", "grooming", "watching", "wandering", "about", "basking", "calling", "climbing", "hiding"]);

/**
 * Its status now. `trip`: the trip it is on (the scene's), for whether it is still on its way to its goal and what its
 * pose plays now; `hunting`: walking its forays under encounter hunting now (`hunting.ts`, from the server's next hunt).
 *
 * Truth rule (lane ark-activities, 2026-11-14): the card says what the scene draws then. Its slots are said as their
 * goals, but a flight only while it is in the air (`slotSegments`); a pair's meeting (courting, sparring with a rival,
 * grooming each other) while the pair meets (`pairMeetingsAt`: both sides built, the way clear), and the episode its
 * pose plays now (a call, a preen, a bathe, its nest: `drawnRecipeAt`). Its log is the same timeline, newest first.
 */
export function scheduleStatus(subject: ScheduleSubject, epoch: number, context: {trip?: Trip | null; hunting?: boolean} = {}): ScheduleStatus {
    const plan = planOf(subject, epoch);
    const trip = context.trip && context.trip.slot === plan.slot ? context.trip : null;
    const travelling = Boolean(trip && epoch < trip.arrive && trip.length > 0.5);
    // Its last slots and this one, as the card says them.
    let timeline: Segment[] = [];
    for (let k = LOOK_BACK; k >= 1; k--) timeline.push(...slotSegments(subject, planOf(subject, plan.start - k * SLOT_SECONDS + 0.5), null));
    timeline.push(...slotSegments(subject, plan, trip));
    // The pair meetings it has had since, and the one it is in.
    const from = plan.start - LOOK_BACK * SLOT_SECONDS;
    for (const meeting of pairMeetingsAt(subject.world, subject.profile, subject.animalAt(epoch), from, epoch, subject.hoursAt, subject.activity)) {
        const key = arkRecipeActivity(recipeBase(meeting.recipe));
        if (key) timeline = layEpisode(timeline, meeting.t0, meeting.t1, key);
    }
    // What its pose plays now on its trip (the scene's): its stay's episode, a meeting, a murmuration; and a flyer on its
    // way through the air on a slot said as settled.
    if (trip && !context.hunting) {
        const drawn = plan.doing === "sleep" ? null : drawnRecipeAt(subject.world, trip, epoch);
        const key = drawn ? arkRecipeActivity(recipeBase(drawn.recipe)) : null;
        if (drawn && key) timeline = layEpisode(timeline, drawn.t0, drawn.t1, key);
        else if (!drawn && SETTLED.has(keyOf(subject, plan)) && subject.profile.move === "fly") {
            const span = flightSpan(trip);
            if (span && epoch >= span.from && epoch < span.to) timeline = layEpisode(timeline, span.from, span.to, "flying");
        }
    }
    // Runs: consecutive segments that say the same.
    const runs: Segment[] = [];
    for (const seg of timeline) if (!runs.length || runs[runs.length - 1].key !== seg.key) runs.push(seg);
    let index = -1;
    for (let i = 0; i < runs.length; i++) if (runs[i].at <= epoch) index = i;
    const current = index >= 0 ? runs[index] : {at: plan.start, key: keyOf(subject, plan)};
    const settled = keyOf(subject, plan);
    // (Its slot's own goal said from the slot's start: on its way to water it is heading to water.)
    const slotsOwn = current.key === settled && current.at <= plan.start;
    const activity: ArkActivityKey = context.hunting ? "hunting" : slotsOwn ? keyOf(subject, plan, {travelling}) : current.key;
    const log: ArkStatusLogEntry[] = [];
    for (let i = index - 1; i >= 0 && log.length < PAST_RUNS; i--) log.push(scheduleEntry(subject.id, runs[i].key, runs[i].at));
    const later = runs.slice(index + 1);
    return {activity, since: current.at, goal: context.hunting ? null : goalOf(subject, plan, settled, activity, trip, travelling && slotsOwn, later), log};
}

function scheduleEntry(id: string, activity: ArkActivityKey, start: number): ArkStatusLogEntry {
    return {id: `slot:${id}:${Math.round(start)}`, source: "schedule", at: start * 1000, day: null, kind: "activity", activity};
}

function goalOf(subject: ScheduleSubject, plan: SlotPlan, settled: ArkActivityKey, now: ArkActivityKey, trip: Trip | null, travelling: boolean, later: readonly Segment[]): ArkStatusGoal | null {
    if (plan.doing === "sleep") {
        // Asleep: it wakes at the first slot that starts in its waking hours (the schedule's own rule).
        for (let k = 1; k <= WAKE_SLOTS; k++) {
            const start = plan.start + k * SLOT_SECONDS;
            if (awakeAt(subject.profile, subject.activity, subject.hoursAt(start), subject.animalAt(start).sleep)) return {kind: "wakes", at: start};
        }
        return null;
    }
    // On its way: what it is going there for.
    if (travelling && trip && settled !== now) return {kind: "next", activity: settled, at: trip.arrive};
    // Later in this slot (a flight's take-off or landing, the end of a meeting), then its next slots.
    for (const seg of later) if (seg.key !== now && seg.at < plan.end) return {kind: "next", activity: seg.key, at: seg.at};
    for (let k = 1; k <= LOOK_AHEAD; k++) {
        const next = planOf(subject, plan.start + k * SLOT_SECONDS + 0.5);
        for (const seg of slotSegments(subject, next, null)) if (seg.key !== now) return {kind: "next", activity: seg.key, at: seg.at};
    }
    return null;
}

// MARK: Its day (lane ark-its-day, 2026-11-15)

/**
 * Its day is worked out on a grid of this many world seconds: each of its slots in cells of this length from the
 * slot's start, each cell said as the card says the cell's middle (`scheduleStatus` with the scene's trip for that
 * slot). Two seconds is far finer than a day's band draws (about 90 s a pixel), and the cells keep the work bounded.
 */
export const DAY_STEP_SECONDS = 2;
/** The middle of a cell (s after its start): where its day reads the card. */
export const DAY_CELL_READ = DAY_STEP_SECONDS / 2;
/** Pair meetings begun this long before a slot can still be on in it (a meeting is at most 90 s). */
const DAY_MEETING_BACK = 2 * SLOT_SECONDS;

/** A stretch of its day said one way: from, to (world seconds), and what the card says through it. */
export type DayRun = {from: number; to: number; key: ArkActivityKey};

/**
 * Its day through one slot, as the card would say it at every cell's middle (the truth rule: what the scene draws
 * then). The same pieces `scheduleStatus` puts together for "now", in the same order: the slot's goal as the card says
 * it (`slotSegments`, a flight only while it is in the air), the pair meetings over it (`layEpisode`, as the card lays
 * them), on its way to its goal (heading to water, on the prowl) while that is the slot's own stretch, and then what
 * its pose plays (`drawnRecipeAt`: its stay's episode, a meeting, a murmuration) or, for a flyer on a settled slot, its
 * flight. Not here: encounter hunting's forays (the server's, now only); its meals are on its record.
 */
function daySlotCells(subject: ScheduleSubject, plan: SlotPlan, previous: Segment[]): {cells: ArkActivityKey[]} {
    const asleep = plan.doing === "sleep";
    const trip = asleep ? null : tripIn(subject, plan, null);
    const segments = slotSegments(subject, plan, trip);
    let timeline: Segment[] = [...previous, ...segments];
    const at = plan.start + 0.5;
    for (const meeting of pairMeetingsAt(subject.world, subject.profile, subject.animalAt(at), plan.start - DAY_MEETING_BACK, plan.end, subject.hoursAt, subject.activity)) {
        if (meeting.t1 <= (previous[0]?.at ?? plan.start)) continue;
        const key = arkRecipeActivity(recipeBase(meeting.recipe));
        if (key) timeline = layEpisode(timeline, meeting.t0, meeting.t1, key);
    }
    const runs: Segment[] = [];
    for (const seg of timeline) if (!runs.length || runs[runs.length - 1].key !== seg.key) runs.push(seg);
    const settled = keyOf(subject, plan);
    const travelKey = trip && trip.length > 0.5 ? keyOf(subject, plan, {travelling: true}) : settled;
    const flyer = subject.profile.move === "fly";
    const span = trip && flyer && SETTLED.has(settled) ? flightSpan(trip) : null;
    const cells: ArkActivityKey[] = [];
    let index = 0;
    for (let t = plan.start + DAY_CELL_READ; t < plan.end; t += DAY_STEP_SECONDS) {
        while (index + 1 < runs.length && runs[index + 1].at <= t) index++;
        const run = runs[index];
        let key: ArkActivityKey = run && run.at <= t ? run.key : settled;
        // (Its slot's own stretch from the slot's start, on its way there: as the card says it travelling.)
        if (trip && t < trip.arrive && key === settled && run && run.at <= plan.start) key = travelKey;
        if (trip) {
            const drawn = drawnRecipeAt(subject.world, trip, t);
            const said = drawn ? arkRecipeActivity(recipeBase(drawn.recipe)) : null;
            if (said) key = said;
            else if (!drawn && span && t >= span.from && t < span.to) key = "flying";
        }
        cells.push(key);
    }
    return {cells};
}

/** Working out its day over a window, a slot at a time (`step`), newest first; its runs so far in `runs` (oldest first). */
export type DayCursor = {
    readonly from: number;
    readonly to: number;
    /** Worked out from here to `to` (world seconds): its latest hours come first. */
    since: number;
    runs: DayRun[];
    done: boolean;
    /** Works out its next slot back. */
    step: () => void;
};

/**
 * Its day over a window [from, to) (world seconds), worked out lazily, a slot per `step` (about half a millisecond to a
 * few on a phone: the slot's trip is the cost), newest first, so a page can do it a little a frame and show its latest
 * hours at once. Pure: the same for every viewer, nothing stored; a cell is said as the card says it then
 * (`daySlotCells`).
 */
export function dayCursor(subject: ScheduleSubject, from: number, to: number): DayCursor {
    let plan = planOf(subject, to - 1e-3);
    const cursor: DayCursor = {
        from,
        to,
        since: to,
        runs: [],
        done: from >= to,
        step: () => {
            if (cursor.done) return;
            const before = planOf(subject, plan.start - SLOT_SECONDS + 0.5);
            const {cells} = daySlotCells(subject, plan, slotSegments(subject, before, null));
            for (let k = cells.length - 1; k >= 0; k--) {
                const a = Math.max(plan.start + k * DAY_STEP_SECONDS, from);
                const b = Math.min(plan.start + (k + 1) * DAY_STEP_SECONDS, plan.end, to);
                if (b <= a) continue;
                const first = cursor.runs[0];
                if (first && first.key === cells[k] && first.from <= b + 1e-6) first.from = a;
                else cursor.runs.unshift({from: a, to: b, key: cells[k]});
            }
            cursor.since = Math.max(plan.start, from);
            if (plan.start <= from) {
                cursor.done = true;
                return;
            }
            plan = before;
        }
    };
    return cursor;
}

/** What its day says at a world time (the run holding it), or null outside what is worked out. */
export function dayKeyAt(runs: readonly DayRun[], t: number): ArkActivityKey | null {
    let lo = 0;
    let hi = runs.length - 1;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (runs[mid].to <= t) lo = mid + 1;
        else if (runs[mid].from > t) hi = mid - 1;
        else return runs[mid].key;
    }
    return null;
}

// MARK: How fed it is over its day

/** What its card says it is doing that is eating: a forage, a graze, a browse, a catch (fishing, a pounce or a hawk), flowers, a zoo's feeding. */
export const EATING: ReadonlySet<ArkActivityKey> = new Set<ArkActivityKey>(["food", "grazing", "browsing", "fishing", "hunting", "flowers", "feeding"]);
/** Waking slots its daily hunger looks back over (two hours), and how far back at most it looks for them (a day and those). */
const FED_AWAKE_SLOTS = 90;
const FED_LOOK_SLOTS = Math.ceil(86_400 / SLOT_SECONDS) + FED_AWAKE_SLOTS;

/** Each animal's slots as its daily hunger read them (0 asleep, 1 awake, 2 eating), for the schedules as they are now. */
let fedMemo: {generation: number; world: ScheduleWorld | null; byId: Map<string, Map<number, number>>} = {generation: -1, world: null, byId: new Map()};

/**
 * How fed it is now (`arkFed`), from its own schedule: its slots back to two waking hours ago, awake or asleep by the
 * schedule's own rule (its slot's start), eating when its card would say it is eating there. `meals`: the server's kills
 * of its that landed (epoch seconds: its log's meals), each of which fills it. Its rates from its stored diet and its
 * body length. Remembered per animal, slot by slot, until the schedules change, so a card read each second works out
 * one new slot at most.
 */
export function scheduleFed(subject: ScheduleSubject, epoch: number, meals: readonly number[] = []): ArkFed | null {
    if (fedMemo.generation !== scheduleGeneration() || fedMemo.world !== subject.world) fedMemo = {generation: scheduleGeneration(), world: subject.world, byId: new Map()};
    let known = fedMemo.byId.get(subject.id);
    if (!known) {
        known = new Map();
        fedMemo.byId.set(subject.id, known);
        if (fedMemo.byId.size > 24) fedMemo.byId.delete(fedMemo.byId.keys().next().value as string);
    }
    const offset = slotOffset(subject.id);
    const now = Math.floor((epoch + offset) / SLOT_SECONDS);
    const slots: ArkFedSlot[] = [];
    let awake = 0;
    for (let slot = now; slot > now - FED_LOOK_SLOTS && awake < FED_AWAKE_SLOTS; slot--) {
        const start = slot * SLOT_SECONDS - offset;
        let flag = known.get(slot);
        if (flag === undefined) {
            flag = !awakeAt(subject.profile, subject.activity, subject.hoursAt(start), subject.animalAt(start).sleep) ? 0 : EATING.has(keyOf(subject, planOf(subject, start + 0.5))) ? 2 : 1;
            known.set(slot, flag);
        }
        if (flag) awake++;
        slots.push({start, end: start + SLOT_SECONDS, awake: flag > 0, eating: flag === 2});
    }
    if (known.size > FED_LOOK_SLOTS * 2) {
        known.forEach((_, slot) => {
            if (slot <= now - FED_LOOK_SLOTS) known!.delete(slot);
        });
    }
    if (!awake) return null;
    slots.reverse();
    return arkFed(slots, epoch, arkFedRates(subject.profile.diet, subject.animalAt(epoch).length), meals);
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
export function momentOf(subject: MomentSubject, plan: SlotPlan, before: SlotPlan): {kind: ScheduleMomentKind; activity: ArkActivityKey; recipe: string | null} | null {
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
                // (A young one's own line; an adult of a playful kind's, "A Bonobo is playing".)
                return subject.young ? "playing" : "doing";
            case "drinking":
                // (A group setting out is "going down to water", true from the slot's start. One animal's "is drinking" is
                // said when it is at the water, at its trip's arrival: `midSlotMoments`.)
                return subject.leads >= 3 ? "toWater" : null;
            case "home":
                return subject.leads >= 3 ? "home" : "doing";
            case "flying":
                // (A flight is said at its take-off, `flightMoments`: at its slot's start it is still waiting where it was.)
                return null;
            case "breathing":
                return subject.surfaces ? "breathing" : null;
            default:
                if (subject.leads >= 3 && GROUP_EVERYDAY.has(now)) return "group";
                return EVERYDAY.has(now) ? "doing" : null;
        }
    })();
    // (Its slot's recipe, when it has one: the live log says the species' own sentence for it, `live/signature-lines.ts`.)
    return kind ? {kind, activity: now, recipe: plan.recipe} : null;
}

/** The moment's kind alone (tests, and the checks of what a line says). */
export function momentKind(subject: MomentSubject, plan: SlotPlan, before: SlotPlan): ScheduleMomentKind | null {
    return momentOf(subject, plan, before)?.kind ?? null;
}

export type ScheduleMoment = {id: string; kind: ScheduleMomentKind; activity: ArkActivityKey; animalId: string; /** When it starts (epoch seconds). */ at: number; /** A group's size. */ count: number; /** The recipe it starts, when it is one. */ recipe?: string | null};

/** A flight said in the live log lasts at least this long (s): a hop of a few seconds is over before its line is read. */
export const FLIGHT_MOMENT_SECONDS = 8;

/** A drink said in the live log has at least this long left at the water (s). */
export const DRINK_MOMENT_SECONDS = 6;

/**
 * When one animal's "is drinking" is said: when its trip arrives at the water's edge its drink slot goes to (the slot's
 * goal is a drinking spot, `behaviour-schedule.ts` drink_edge, or the shallows), never at the slot's start while it is
 * still walking or flying there (owner, 2026-11-16: "it said 'a roadside hawk is drinking' but it was nowhere near the
 * water"; a hawk's flight to the water is half a slot). Null when it gets there too late in the slot to be seen
 * drinking (`DRINK_MOMENT_SECONDS`), or never gets there.
 */
export function drinkArrival(plan: Pick<SlotPlan, "start" | "end">, trip: Pick<Trip, "arrive" | "start" | "end">): number | null {
    const at = Math.max(trip.arrive, plan.start);
    return at + DRINK_MOMENT_SECONDS <= Math.min(plan.end, trip.end) ? at : null;
}

/** Its moments that start inside a window but not at a slot's start: a flight's take-off, a pair's meeting (its first side's), one animal's arrival at the water to drink. */
function midSlotMoments(subject: MomentSubject, from: number, to: number): Array<{kind: ScheduleMomentKind; activity: ArkActivityKey; at: number; recipe?: string | null}> {
    const out: Array<{kind: ScheduleMomentKind; activity: ArkActivityKey; at: number; recipe?: string | null}> = [];
    if (subject.leads < 3) {
        const first = planOf(subject, from);
        const last = planOf(subject, to - 0.001);
        for (const plan of last.slot !== first.slot ? [first, last] : [first]) {
            if (keyOf(subject, plan) !== "drinking") continue;
            const at = drinkArrival(plan, tripIn(subject, plan, null));
            if (at !== null && at >= from && at < to) out.push({kind: "doing", activity: "drinking", at});
        }
    }
    if (subject.profile.move === "fly" || subject.profile.moves.includes("fly")) {
        const plans = [planOf(subject, from)];
        const last = planOf(subject, to - 0.001);
        if (last.slot !== plans[0].slot) plans.push(last);
        for (const plan of plans) {
            if (keyOf(subject, plan) !== "flying") continue;
            const span = flightSpan(tripIn(subject, plan, null));
            if (span && span.from >= from && span.from < to && span.to - span.from >= FLIGHT_MOMENT_SECONDS) out.push({kind: subject.leads >= 3 ? "flock" : "doing", activity: "flying", at: span.from});
        }
    }
    for (const meeting of pairMeetingsAt(subject.world, subject.profile, subject.animalAt(from), from, to, subject.hoursAt, subject.activity)) {
        if (meeting.role !== "a") continue;
        const key = arkRecipeActivity(recipeBase(meeting.recipe));
        const kind: ScheduleMomentKind | null = key === "courting" ? "courting" : key === "sparring" ? "contest" : key === "grooming" ? "doing" : null;
        if (key && kind) out.push({kind, activity: key, at: meeting.t0, recipe: meeting.recipe});
    }
    return out;
}

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
    const candidates: Array<{subject: MomentSubject; start: number | null; order: number}> = [];
    for (const subject of subjects) {
        const start = slotStartIn(subject.id, from, to);
        const order = draw("ark-moment", window, subject.id);
        if (start !== null) candidates.push({subject, start, order});
        // (And its flights' take-offs and its pairs' meetings that start in the window.)
        candidates.push({subject, start: null, order});
    }
    candidates.sort((a, b) => a.order - b.order || a.subject.id.localeCompare(b.subject.id) || (a.start === null ? 1 : 0) - (b.start === null ? 1 : 0));
    let best: ScheduleMoment | null = null;
    let bestTier = Infinity;
    let looked = 0;
    for (const {subject, start} of candidates) {
        const moments = start !== null ? [momentOf(subject, planOf(subject, start + 0.5), planOf(subject, start - 0.5))].filter((m) => m !== null).map((m) => ({...m!, at: start})) : midSlotMoments(subject, from, to);
        if (start !== null && ++looked > MOMENT_CAP) break;
        for (const moment of moments) {
            if (MOMENT_TIER[moment.kind] >= bestTier || draw("ark-accept", window, subject.id) >= MOMENT_WEIGHTS[moment.kind]) continue;
            bestTier = MOMENT_TIER[moment.kind];
            best = {id: `now:${subject.id}:${Math.round(moment.at)}`, kind: moment.kind, activity: moment.activity, recipe: moment.recipe ?? null, animalId: subject.id, at: moment.at, count: moment.kind === "toWater" || moment.kind === "home" || moment.kind === "flock" || moment.kind === "group" ? subject.leads : 1};
        }
        if (bestTier === 0) break;
    }
    return best;
}
