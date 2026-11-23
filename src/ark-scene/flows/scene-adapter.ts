/**
 * Behaviour flows in the scene (pilot, behind a switch: `globalThis.__arkFlows`, the harness's `?flows=1`; off, nothing
 * here runs). docs/ark/behaviour-flows.md section 8.
 *
 * The schedule still decides where an animal goes (its slot's route, its legs: a moving step is the schedule's own trip
 * leg). The flow decides what it does where it stands: its stay's beats are rewritten from the flow's steps at each
 * moment, a meal as bites and chews (a bird's as pecks), head down and standing still; a still search as looks round; a
 * rest, a drink, a groom as themselves. Steps the schedule's stay walks (its `step`, `stalk` and `play` beats) are kept
 * as they are, at their places, so where the stay leaves it (`finish`, and the next slot's start) never changes: the
 * adapter moves nothing, it only changes the beat a stance plays.
 *
 * Pure and the same for every viewer: the flow's steps are a function of the animal's id, the engine's tick and what the
 * server released (`setFlowServer`); its fed state is the server's condition (`hungry` or not).
 */

import table from "@/ark-scene/flows/flow-params.json";
import {flowStepAt, forgetFlows, stepLine, type FlowServer, type FlowStep, type FlowSubject} from "@/ark-scene/flows/flows";
import type {FlowParams} from "@/ark-scene/flows/params";

type Beat = "walk" | "run" | "fly" | "glide" | "swim" | "enter_water" | "exit_water" | "climb" | "pause" | "shake" | "bite" | "chew" | "step" | "scan" | "peck" | "drink" | "preen" | "rest" | "sleep" | "play" | "stalk";
type StayBeat = {at: number; beat: Beat; x: number; z: number; yaw: number; dur?: number};
type AdaptTrip = {doing: string; arrive: number; end: number; stay: StayBeat[]; shadow?: unknown};

const PARAMS = (table as unknown as {species: Record<string, FlowParams>}).species;

export function flowsOn(): boolean {
    return Boolean((globalThis as {__arkFlows?: boolean}).__arkFlows);
}

/** The pilot kinds' parameters (null: not a pilot kind, the schedule alone). */
export function flowParamsFor(slug: string): FlowParams | null {
    return PARAMS[slug] ?? null;
}

const servers = new Map<string, Partial<FlowServer>>();
/** What the server released about an animal (its kills, escapes, caches, keepers' feedings, matings), for its flows. */
export function setFlowServer(id: string, server: Partial<FlowServer>): void {
    servers.set(id, server);
    forgetFlows();
}

export function flowSubjectOf(animal: {id: string; condition?: string | null}, slug: string, hoursAt: (epoch: number) => number, awake?: (epoch: number) => boolean): FlowSubject | null {
    const params = flowParamsFor(slug);
    if (!params) return null;
    const extra = servers.get(animal.id) ?? {};
    const hungry = animal.condition === "hungry";
    const subject: FlowSubject = {id: animal.id, params, hoursAt, awake, server: {fedOn: () => !hungry, ...extra}};
    subjects.set(animal.id, subject);
    return subject;
}

/** The subjects the scene's schedule last asked for, by id: the card line's and the harness's reads. */
const subjects = new Map<string, FlowSubject>();
/** For the harness: whether the switch is on and which ids have flows. */
export function flowDebug(): {on: boolean; ids: string[]} {
    return {on: flowsOn(), ids: Array.from(subjects.keys()).slice(0, 12)};
}

/** Its flow step now, as the scene plays it, and the card's line for it (null: no flow for it, or flows off). */
export function flowNow(id: string, epoch: number): {kind: string; line: string; server: boolean} | null {
    const subject = subjects.get(id);
    const step = subject ? flowStepAt(subject, epoch) : null;
    return step ? {kind: step.kind, line: stepLine(step), server: Boolean(step.server)} : null;
}

/** The beats it walks with: kept where the schedule put them. */
const WALKS = new Set<Beat>(["step", "stalk", "play", "walk", "run"]);
/** Birds and insects peck at their food; the rest bite and chew. */
const PECKERS = new Set(["seed", "glean", "nectar", "hawk"]);

/** A flow step's beat at `k` (its beat count since the step began): the cadence of a meal, a look, a rest. */
function beatOf(step: FlowStep | null, params: FlowParams, k: number): Beat {
    if (!step) return "rest";
    switch (step.kind) {
        case "eat":
        case "keptEat":
            return PECKERS.has(params.guild) ? "peck" : k % 2 ? "chew" : "bite";
        case "catch":
        case "attempt":
            return "bite";
        case "stalk":
            return step.pose === "moving" ? "stalk" : "scan";
        case "search":
        case "wary":
        case "keptWait":
            return step.pose === "still" ? "scan" : "pause";
        case "drink":
            return "drink";
        case "groom":
            return "preen";
        case "sleep":
        case "settle":
            return "rest";
        default:
            return "rest";
    }
}

/** Seconds between a step's beats: a bite and a chew, a peck, a look round, a long rest. */
function cadence(beat: Beat): number {
    return beat === "peck" ? 1.1 : beat === "bite" || beat === "chew" ? 1.6 : beat === "scan" ? 3.5 : 6;
}

/**
 * Its trip with its stay's beats from its flow (the same trip when flows are off, it is not a pilot kind, it sleeps or it
 * flies with a flock). The walked beats stay where they are; between them, at the place each leaves it, the flow's beats.
 */
export function flowTrip<T extends AdaptTrip>(trip: T, subject: FlowSubject | null): T {
    if (!subject || trip.shadow || trip.doing === "sleep" || trip.doing === "to_roost" || !trip.stay.length) return trip;
    const out: StayBeat[] = [];
    const stay = trip.stay;
    for (let i = 0; i < stay.length; i++) {
        const beat = stay[i];
        const next = i + 1 < stay.length ? stay[i + 1].at : trip.end - trip.arrive;
        if (WALKS.has(beat.beat)) {
            out.push(beat);
            // (Its step's own time first; then the flow's beats where it stopped.)
            const after = beat.at + (beat.dur ?? (beat.beat === "play" ? 0.8 : beat.beat === "stalk" ? 2.5 : 1.2));
            fill(after, next, beat);
            continue;
        }
        fill(beat.at, next, beat);
    }
    return {...trip, stay: out} as T;

    function fill(from: number, to: number, at: StayBeat) {
        let t = from;
        let k = 0;
        let last: FlowStep | null = null;
        while (t < to - 0.05) {
            const step = flowStepAt(subject!, trip.arrive + t);
            if (step !== last) k = 0;
            last = step;
            const beat = beatOf(step, subject!.params, k++);
            // (One beat a stance while it holds: merged with the one before it when they are the same.)
            const prev = out[out.length - 1];
            if (!(prev && prev.beat === beat && prev.x === at.x && prev.z === at.z && beat !== "bite" && beat !== "chew" && beat !== "peck")) out.push({at: t, beat, x: at.x, z: at.z, yaw: at.yaw});
            t += cadence(beat);
        }
    }
}
