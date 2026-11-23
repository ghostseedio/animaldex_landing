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
import type {ArkActivityKey} from "@/lib/ark-animal-status";
import {flowStepAt, flowSteps, forgetFlows, stepCardIn, stepCard, stepLine, stepLineIn, type FlowServer, type FlowStep, type FlowSubject, type FlowWords} from "@/ark-scene/flows/flows";
import type {FlowParams} from "@/ark-scene/flows/params";

type Beat = "walk" | "run" | "fly" | "glide" | "swim" | "enter_water" | "exit_water" | "climb" | "pause" | "shake" | "bite" | "chew" | "step" | "scan" | "peck" | "drink" | "preen" | "rest" | "sleep" | "play" | "stalk";
type StayBeat = {at: number; beat: Beat; x: number; z: number; yaw: number; dur?: number};
type AdaptTrip = {doing: string; start: number; arrive: number; end: number; stay: StayBeat[]; shadow?: unknown; legs: Array<{mode: string; seconds: number; beat: Beat}>; to?: {x: number; z: number; yaw?: number}; finish?: {yaw?: number}};

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
    // (A subject already handed out reads the new release too.)
    const known = subjects.get(id);
    if (known) known.server = {...known.server, ...server};
    forgetFlows();
}

export function flowSubjectOf(animal: {id: string; condition?: string | null; group?: {leader: {id: string; condition?: string | null}} | null}, slug: string, hoursAt: (epoch: number) => number, awake?: (epoch: number) => boolean): FlowSubject | null {
    const params = flowParamsFor(slug);
    if (!params) return null;
    const extra = servers.get(animal.id) ?? {};
    // A flock's member forages with its flock: its flow is its leader's (seeded by the leader's id, fed or hungry by its
    // leader's condition, awake by its leader's hours: the caller's `awake`), so they land, eat, rest and go up together,
    // and every member reads the one flow (a member's own hunger or sleep gave the shared memo whichever came first);
    // its own server events still pin its own steps (its version keeps them apart).
    const leader = params.flock && animal.group ? animal.group.leader.id : null;
    const hungry = (leader ? animal.group!.leader.condition : animal.condition) === "hungry";
    const own = leader && Object.keys(extra).length ? {version: `${animal.id}:${String(extra.version ?? "")}`} : {};
    const subject: FlowSubject = {id: leader ?? animal.id, params, hoursAt, awake, server: {fedOn: () => !hungry, ...extra, ...own}};
    subjects.set(animal.id, subject);
    return subject;
}

/**
 * A kill the scene acts (`live-meals.ts`, when it builds the meal): pinned at its catch, with the act's own phases, and
 * its cache when the engine saved it. Replaces a kill of the same prey already given (the event's own time).
 */
export function addFlowKill(id: string, kill: {at: number; prey: string; acted?: {eat?: number; carry?: number; cache?: number; rest?: number}}, cached: boolean): void {
    const had = servers.get(id) ?? {};
    const kills = (had.kills ?? []).filter((k) => k.prey !== kill.prey || Math.abs(k.at - kill.at) > 600).concat(kill);
    const caches = cached ? (had.caches ?? []).filter((c) => Math.abs(c.at - kill.at) > 600).concat({at: kill.at + 4.5, recipe: "cache_food"}) : had.caches;
    setFlowServer(id, {...had, kills, ...(caches ? {caches} : {}), version: `${String(had.version ?? "")}+${Math.round(kill.at)}`});
}

/** The subjects the scene's schedule last asked for, by id: the card line's and the harness's reads. */
const subjects = new Map<string, FlowSubject>();
/** For the harness: whether the switch is on and which ids have flows. */
export function flowDebug(): {on: boolean; ids: string[]} {
    return {on: flowsOn(), ids: Array.from(subjects.keys()).slice(0, 12)};
}

/** Debug: its flow's steps over [from, to) every `every` s, as `kind/pose`, and whose flow it reads. */
export function flowWindow(id: string, from: number, to: number, every = 5): string {
    const subject = subjects.get(id);
    if (!subject) return "(no subject)";
    const out: string[] = [];
    for (let t = from; t < to; t += every) {
        const step = flowStepAt(subject, t);
        out.push(step ? `${step.kind}/${step.pose}` : "-");
    }
    return `${subject.id.slice(-3)} v${String(subject.server.version ?? "")} awake ${subject.awake ? subject.awake(from) : "?"} fed ${subject.server.fedOn ? subject.server.fedOn(from) : "?"}: ${out.join(" ")}`;
}

/** Its flow step now, as the scene plays it, and the card's line for it (null: no flow for it, or flows off). */
export function flowNow(id: string, epoch: number): {kind: string; line: string; server: boolean} | null {
    const subject = subjects.get(id);
    const step = subject ? flowStepAt(subject, epoch) : null;
    return step ? {kind: step.kind, line: stepLine(step), server: Boolean(step.server)} : null;
}

let readerWords: FlowWords | null = null;
/** The reader's `ark.flow` words (null: English, its lines naming the food). The page's card sets them. */
export function setFlowWords(words: FlowWords | null): void {
    readerWords = words;
}

/**
 * The card's now and its log from its flow (the card reads the flow's own step, never the schedule's doing): its line
 * now in the reader's words, and its earlier lines over `back` seconds, newest first (a line held across steps is one).
 */
export function flowStatus(id: string, epoch: number, back: number): {line: string; since: number; log: Array<{at: number; text: string}>} | null {
    const subject = subjects.get(id);
    if (!subject) return null;
    const steps = flowSteps(subject, epoch - back, epoch + 0.001);
    if (!steps.length) return null;
    const head = (step: FlowStep) => (readerWords ? stepCardIn(step, readerWords) : stepCard(step)).line;
    const runs: Array<{line: string; from: number; step: FlowStep}> = [];
    for (const step of steps) {
        const line = head(step);
        if (!runs.length || runs[runs.length - 1].line !== line) runs.push({line, from: step.from, step});
        else runs[runs.length - 1].step = step;
    }
    const now = runs[runs.length - 1];
    const nowStep = flowStepAt(subject, epoch) ?? now.step;
    return {
        line: stepLineIn(nowStep, readerWords),
        since: now.from,
        log: runs.slice(0, -1).reverse().map((run) => ({at: run.from, text: run.line}))
    };
}

/** Its flow's step at `epoch` as one of the card's activities (the live log's words for it), when it has a flow. */
export function flowActivity(id: string, epoch: number): ArkActivityKey | null {
    const subject = subjects.get(id);
    const step = subject ? flowStepAt(subject, epoch) : null;
    if (!step) return null;
    const bout = step.bout?.kind;
    switch (step.kind) {
        case "sleep": case "settle": return "sleeping";
        case "search": case "movePatch": case "found": return bout === "flowers" ? "flowers" : bout === "nest" ? "nest" : "food";
        case "eat": return bout === "graze" ? "grazing" : bout === "browse" ? "browsing" : bout === "flowers" ? "flowers" : step.server ? "eating" : "food";
        case "stalk": case "attempt": case "nearMiss": return "hunting";
        case "catch": case "carry": return "eating";
        case "cache": return "caching";
        case "rest": case "digest": case "wake": case "keptWait": return "resting";
        case "groom": return "grooming";
        case "toWater": return "toWater";
        case "drink": return "drinking";
        case "wary": return "wary";
        case "keptEat": return "feeding";
        case "display": case "court": case "mate": case "dance": return "courting";
        case "build": return "nest";
    }
    return null;
}

/** A slot its flow spends at least this share of still is a stay: the schedule's route for it is dropped. */
export const FLOW_STILL_SHARE = 0.6;

/** The share of [from, to) its flow is still (eating, resting, a catch, a still search): 0 with no flow. */
export function flowStillShare(subject: FlowSubject | null, from: number, to: number): number {
    if (!subject) return 0;
    let still = 0;
    for (const step of flowSteps(subject, from, to)) if (step.pose === "still" && step.kind !== "sleep") still += Math.min(step.to, to) - Math.max(step.from, from);
    return still / Math.max(to - from, 1);
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
    if (!subject || trip.doing === "sleep" || trip.doing === "to_roost") return trip;
    // (A flock member waiting for its flock to go up, or one standing between legs: it does its flow's still step there, a
    // peck or a bite where it waits, not a blank pause. Its place and its times are the leg's own.)
    let at = trip.start;
    let legs = trip.legs;
    for (let i = 0; i < trip.legs.length; i++) {
        const leg = trip.legs[i];
        if (leg.mode === "pause" && leg.beat === "pause" && leg.seconds > 2) {
            const step = flowStepAt(subject, at + leg.seconds / 2);
            const beat = step && step.pose === "still" ? beatOf(step, subject.params, 0) : null;
            if (beat && beat !== "rest") {
                if (legs === trip.legs) legs = trip.legs.slice();
                legs[i] = {...leg, beat};
            }
        }
        at += leg.seconds;
    }
    if (trip.shadow || !(trip.stay.length || trip.to)) return legs === trip.legs ? trip : ({...trip, legs} as T);
    const out: StayBeat[] = [];
    // (A stay with no beats of its own, a slot its flow keeps it still in: its flow's beats where it stands.)
    const stay = trip.stay.length ? trip.stay : [{at: 0, beat: "pause" as Beat, x: trip.to!.x, z: trip.to!.z, yaw: trip.to!.yaw ?? trip.finish?.yaw ?? 0}];
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
    return {...trip, legs, stay: out} as T;

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
            // (Never past its step's end: a flock's short peck between searches fell inside one long beat's stride.)
            t = Math.min(t + cadence(beat), step ? Math.max(step.to - trip.arrive, t + 0.3) : Infinity);
        }
    }
}
