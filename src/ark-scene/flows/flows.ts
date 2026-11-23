/**
 * Behaviour flows, pilot (docs/ark/behaviour-flows.md). An animal's time as chains of steps with outcomes, narrating the
 * engine's own outcomes: the engine decides (fed this Ark day or not, a kill and its prey, a cache, a mating); the flow
 * tells the path to it (the search, the near misses, giving up, the catch at the kill's time, eating, caching).
 *
 * Pure: a function of the animal's id, the engine's tick (the Ark day: `ARK_DAY_MS` of the shared clock) and what the
 * server released. Never the viewer, the camera or the frame. Nothing here decides anything on the Ark.
 *
 * Truth rules (owner, 2026-11-23):
 * - No catch without the server's kill (`kills`), at its time and with its prey. No eating in a tick the engine did not
 *   feed it, and in a tick it did, it eats (its own foods; a hunter's ambient foods, never an Ark animal).
 * - No mating without the server's `mated`; no clutch, hatch or birth here at all (they are the server's lines).
 * - Eating, handling and caching are always still (ground, perch or water), never in the air or moving.
 */

import {hash32} from "@/lib/ark-clock";
import {isAwake} from "@/lib/ark-daylight";
import type {FlowParams, FoodWord} from "@/ark-scene/flows/params";

/** The engine's day (`ark-clock.ts` ARK_DAY_MS: one Ark year in 14 real days), in seconds: its tick. */
export const FLOW_TICK_SECONDS = (86_400 * 14) / 365;

export type StepKind =
    | "sleep" | "settle" | "wake"
    | "search" | "movePatch" | "stalk" | "attempt" | "nearMiss" | "nothing" | "giveUp" | "catch" | "found" | "eat" | "cache" | "dance"
    | "rest" | "digest" | "groom" | "toWater" | "drink" | "wary"
    | "keptWait" | "keptEat"
    | "call" | "scentMark" | "display" | "spar" | "court" | "rejected" | "mate" | "build";

export type Pose = "moving" | "air" | "still";

export type FlowStep = {
    kind: StepKind;
    /** Epoch seconds. */
    from: number;
    to: number;
    pose: Pose;
    food?: FoodWord;
    /** The near miss's reason, the cache's method, the search's mode, a kill's prey (by name). */
    detail?: string;
    /** Set when a step is the engine's own event (a kill, a cache, a mating). */
    server?: true;
};

/** What the server released about this animal: the engine's outcomes the flow narrates. */
export type FlowServer = {
    /** Changes whenever what the server released about it changes (a new snapshot or event): its flows are worked out again. */
    version?: string | number;
    /** Fed this Ark day (the engine's meal clock: not hungry, or a `fed` event that day). */
    fedOn: (tick: number) => boolean;
    /** Kills (`meal` events): when (epoch s) and the prey's name. */
    kills?: ReadonlyArray<{at: number; prey: string}>;
    /** The engine's own near misses (`escaped` events: its prey got away from it): when, and the prey's name. */
    escapes?: ReadonlyArray<{at: number; prey: string}>;
    /** SIG-EVENTS food caches (`signature` food_cache) and the meals from them (`fed` source cache). */
    caches?: ReadonlyArray<{at: number; recipe: string}>;
    cacheMeals?: readonly number[];
    /** A kept animal (house, farm, zoo): its keepers' feeding times (epoch s, the scene's feeding rhythm), none when not kept. */
    kept?: {feedings: readonly number[]} | null;
    /** Reproduction, from the server: in its season (the kind's months), whether it has a mate it may court, matings. */
    repro?: {inSeason: boolean; sex: "male" | "female" | null; partner: boolean; neutered?: boolean; mated?: readonly number[]} | null;
};

export type FlowSubject = {id: string; params: FlowParams; server: FlowServer; /** The island's hour at a moment (0-24). */ hoursAt: (epoch: number) => number};

// MARK: Seeds

function rng(...parts: Array<string | number>): () => number {
    let s = hash32(...parts) || 1;
    return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** An exponential draw around a mean, held to [0.25, 3] of it (no instant or endless step). */
function around(random: () => number, mean: number): number {
    return mean * Math.min(Math.max(-Math.log(1 - random() * 0.999), 0.25), 3);
}

function sunElevation(hours: number): number {
    return 58 * Math.sin((2 * Math.PI * (hours - 6)) / 24);
}

export function flowAwake(subject: FlowSubject, epoch: number): boolean {
    return isAwake(subject.params.activity, sunElevation(subject.hoursAt(epoch)));
}

// MARK: The tick's steps

export function tickOf(epoch: number): number {
    return Math.floor(epoch / FLOW_TICK_SECONDS);
}

const memo = new Map<string, FlowStep[]>();

/** Its steps through one engine tick, in order, covering [start, end) of the tick. Remembered (the last 200 ticks read). */
export function tickSteps(subject: FlowSubject, tick: number): FlowStep[] {
    const key = `${subject.id}|${tick}|${subject.server.version ?? ""}`;
    const known = memo.get(key);
    if (known) return known;
    const steps = buildTick(subject, tick);
    memo.set(key, steps);
    if (memo.size > 200) memo.delete(memo.keys().next().value as string);
    return steps;
}

export function forgetFlows(): void {
    memo.clear();
}

/** The step at a moment, or null. */
export function flowStepAt(subject: FlowSubject, epoch: number): FlowStep | null {
    const steps = tickSteps(subject, tickOf(epoch));
    let lo = 0;
    let hi = steps.length - 1;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (steps[mid].to <= epoch) lo = mid + 1;
        else if (steps[mid].from > epoch) hi = mid - 1;
        else return steps[mid];
    }
    return null;
}

/** Its steps over [from, to), across ticks. */
export function flowSteps(subject: FlowSubject, from: number, to: number): FlowStep[] {
    const out: FlowStep[] = [];
    for (let tick = tickOf(from); tick * FLOW_TICK_SECONDS < to; tick++) for (const step of tickSteps(subject, tick)) if (step.to > from && step.from < to) out.push(step);
    return out;
}

const HUNTERS = new Set(["stalker", "pursuit", "sitwait", "fish", "hawk", "web"]);

function buildTick(subject: FlowSubject, tick: number): FlowStep[] {
    const {params: p, server} = subject;
    const start = tick * FLOW_TICK_SECONDS;
    const end = start + FLOW_TICK_SECONDS;
    const random = rng("flow-tick", subject.id, tick);
    const steps: FlowStep[] = [];
    // Its own bouts give way to the server's next event (a kill's hunt, a cache, a mating): `limit`, its lead-in's start.
    let limit = end;
    const push = (kind: StepKind, from: number, to: number, pose: Pose, extra: Partial<FlowStep> = {}) => {
        to = Math.min(to, end, Math.max(limit, from));
        // (A sliver at the tick's end is not a step, but its time passes.)
        if (to - from < 0.5) return Math.max(to, from);
        steps.push({kind, from, to, pose, ...extra});
        return to;
    };
    const fed = server.fedOn(tick);
    const kills = (server.kills ?? []).filter((k) => k.at >= start && k.at < end).sort((a, b) => a.at - b.at);
    const escapes = (server.escapes ?? []).filter((e) => e.at >= start && e.at < end);
    const caches = (server.caches ?? []).filter((c) => c.at >= start && c.at < end);
    const cacheMeals = (server.cacheMeals ?? []).filter((t) => t >= start && t < end);
    const matings = (server.repro?.mated ?? []).filter((t) => t >= start && t < end);
    // A hunter's own non-prey foods (a fox's fruit and insects): what it eats on a day the engine fed it without a kill.
    const plain = HUNTERS.has(p.guild) ? p.foods.filter((f) => !f.the) : p.foods;
    let ate = false;
    let gaveUp = false;
    // (Its last drink: once it has drunk it does not go back to the water for a while.)
    let drank = -Infinity;
    // A kept animal eats what its keepers give it, at their times; its own searches are play, never a meal.
    const kept = Boolean(server.kept);
    const feedings = (server.kept?.feedings ?? []).filter((f) => f >= start && f < end);
    let t = start;
    let guard = 0;
    while (t < end && guard++ < 400) {
        if (!flowAwake(subject, t)) {
            // Asleep until it wakes (scanned a minute at a time; the tick's end at most).
            let wake = t;
            while (wake < end && !flowAwake(subject, wake)) wake += 60;
            const settle = steps.length && steps[steps.length - 1].kind !== "sleep" ? push("settle", t, t + Math.min(40, wake - t), "still") : t;
            t = push("sleep", settle, wake, "still");
            if (wake < end) t = push("wake", t, t + 8 + random() * 12, "still");
            continue;
        }
        limit = end;
        // The engine's near miss: a hunt bout to it, the prey (by name) getting away at its time.
        const escape = escapes.find((e) => e.at >= t && e.at - t < p.patience);
        if (escape) {
            escapes.splice(escapes.indexOf(escape), 1);
            const prey: FoodWord = {eat: `a ${escape.prey}`, the: `the ${escape.prey}`};
            t = push("search", t, Math.max(t + 1, escape.at - Math.min(p.search, 60) - 2), p.mode === "sitwait" || p.mode === "watch" || p.mode === "web" ? "still" : "moving", {detail: p.mode});
            t = push("stalk", t, Math.max(t + 1, escape.at - 2), p.mode === "sitwait" || p.mode === "web" ? "still" : "moving", {food: prey, detail: p.mode});
            t = push("attempt", t, Math.max(t + 0.5, escape.at), "still", {food: prey, detail: p.mode});
            t = push("nearMiss", t, t + 5, "still", {food: prey, detail: p.mode === "web" ? "web" : "escaped", server: true});
            continue;
        }
        // The server's kill: a hunt bout leading to it, the catch at its time.
        const kill = kills.find((k) => k.at >= t);
        if (kill && kill.at - t < p.patience) {
            t = huntTo(kill, t);
            continue;
        }
        const feeding = feedings.find((f) => f >= t - 60 && f - t < 90);
        if (feeding !== undefined) {
            feedings.splice(feedings.indexOf(feeding), 1);
            t = push("keptWait", t, Math.max(feeding, t + 10), "still");
            t = push("keptEat", t, t + around(random, p.handle * 2), "still", {food: p.kept});
            ate = true;
            t = push("rest", t, t + around(random, 240), "still");
            continue;
        }
        // A cache the engine saved, or a meal from one.
        const cache = caches.find((c) => c.at >= t && c.at - t < 300);
        if (cache) {
            caches.splice(caches.indexOf(cache), 1);
            t = push("search", t, cache.at, "moving", {detail: p.mode});
            t = push("cache", t, t + around(random, 40), "still", {detail: p.cache?.method ?? "hide", food: p.foods[0], server: true});
            continue;
        }
        const cacheMeal = cacheMeals.find((m) => m >= t && m - t < 300);
        if (cacheMeal !== undefined) {
            t = push("movePatch", t, cacheMeal, "moving");
            t = push("found", t, t + 15, "still", {detail: "cache", food: p.foods[0], server: true});
            t = push("eat", t, t + around(random, p.handle), "still", {food: p.foods[0]});
            ate = true;
            continue;
        }
        if (matings.some((m) => m >= t && m - t < 120)) {
            const at = matings.find((m) => m >= t)!;
            t = push("court", t, at, "still", {detail: p.repro.display ?? "court"});
            t = push("mate", t, t + 30, "still", {server: true});
            continue;
        }
        // The next server event's lead-in: its own bouts end there.
        limit = Math.min(end, ...kills.filter((k) => k.at > t).map((k) => k.at - p.patience * 0.9), ...caches.filter((c) => c.at > t).map((c) => c.at - 290), ...cacheMeals.filter((m) => m > t).map((m) => m - 290), ...escapes.filter((e) => e.at > t).map((e) => e.at - p.patience * 0.9), ...matings.filter((m) => m > t).map((m) => m - 110), ...feedings.filter((f) => f > t).map((f) => f - 80));
        if (limit <= t + 0.5) {
            limit = end;
            t = Math.min(...[...kills.map((k) => k.at - p.patience * 0.9), ...caches.map((c) => c.at - 290), ...cacheMeals.map((m) => m - 290), ...escapes.map((e) => e.at - p.patience * 0.9), ...matings.map((m) => m - 110), ...feedings.map((f) => f - 80)].filter((x) => x > t), end);
            continue;
        }
        // Its choice of bout: hungry for its tick's meal first, then its rhythm.
        // (In season and able: a male's calls and displays; a pair-living kind with a mate builds, both sexes.)
        const able = Boolean(server.repro && server.repro.inSeason && !server.repro.neutered && p.repro.system !== "none");
        const repro = able && (server.repro!.sex === "male" || (p.repro.system === "pair" && p.repro.nest && server.repro!.partner));
        const pick = random();
        const needs = fed && !ate && plain.length > 0 && !kept;
        // (In season, a male's or a pair's breeding comes before more food: a rutting stag barely eats.)
        if (repro && !needs && (pick < 0.45 || (ate && pick < 0.7))) t = reproBout(t);
        // (After giving up it moves off and rests or tidies itself before searching again: never straight back at it.)
        else if (!gaveUp && (needs || pick < (fed ? 0.45 : 0.7))) t = forage(t, needs, fed && plain.length > 0 && !kept);
        else if (gaveUp && pick < 0.3) {
            gaveUp = false;
            t = push("movePatch", t, t + around(random, 40), "moving");
        } else if (pick < 0.82 && t - drank > 1800) {
            gaveUp = false;
            t = drinkBout(t);
            drank = t;
        }
        else {
            gaveUp = false;
            t = pick < 0.9 ? push("groom", t, t + around(random, 90), "still") : push("rest", t, t + around(random, 300), "still");
        }
    }
    return steps;

    // A forage bout: search, tries with near misses or nothing, and (when the engine fed it and it may eat now) a find.
    function forage(from: number, mustEat: boolean, mayEat: boolean): number {
        let t = from;
        gaveUp = false;
        const bout = t + around(random, p.bout);
        const giveUp = t + around(random, p.patience);
        let tries = 0;
        let found = false;
        while (t < Math.min(bout, end, limit)) {
            t = push(p.guild === "web" ? "search" : tries && random() < 0.3 ? "movePatch" : "search", t, t + Math.max(around(random, p.search), 20 + random() * 25), p.guild === "web" ? "still" : p.mode === "sitwait" || p.mode === "watch" ? "still" : "moving", {detail: p.mode});
            if (t >= Math.min(end, limit)) break;
            tries++;
            // (Grazing and browsing: grass is there; a bout of them is a find from the first patch.)
            const food = mayEat ? plain[Math.floor(random() * Math.min(plain.length, 3))] : undefined;
            const succeed = food && (mustEat && t > giveUp - p.search ? true : random() < p.success) && !(HUNTERS.has(p.guild) && food.the);
            if (succeed && food) {
                t = push("found", t, t + 3 + random() * 4, "still", {food});
                t = push("eat", t, t + around(random, p.handle), "still", {food});
                found = true;
                ate = true;
                if (p.dance && random() < 0.5) t = push("dance", t, t + 20 + random() * 30, "still");
                if (!mustEat && random() < 0.5) break;
                mustEat = false;
                continue;
            }
            // A try that fails: a near miss at something that could get away, or nothing found here.
            const prey = p.foods.find((f) => f.the);
            if (prey && random() < p.nearMiss) {
                if (HUNTERS.has(p.guild)) t = push("stalk", t, t + around(random, p.search / 3), p.mode === "sitwait" || p.mode === "web" ? "still" : "moving", {food: prey, detail: p.mode});
                t = push("attempt", t, t + 1.5 + random() * 2, "still", {food: prey, detail: p.mode});
                t = push("nearMiss", t, t + 4, "still", {food: prey, detail: p.mode === "web" ? "web" : random() < 0.8 ? "escaped" : "dropped"});
            } else if (random() < 0.35) t = push("nothing", t, t + 3 + random() * 3, "still");
            if (t > giveUp && !mustEat) {
                t = push("giveUp", t, t + 6, "still");
                gaveUp = true;
                return t;
            }
        }
        if (found) t = push("digest", t, t + around(random, p.handle * 1.5), "still");
        return t;
    }

    // The server's kill at its time: the search and the near misses before it, then the catch and eating (or caching).
    function huntTo(kill: {at: number; prey: string}, from: number): number {
        let t = from;
        const prey: FoodWord = {eat: `a ${kill.prey}`, the: `the ${kill.prey}`};
        while (kill.at - t > p.search * 1.5) {
            t = push("search", t, Math.min(t + around(random, p.search), kill.at - p.search * 0.5), p.mode === "sitwait" || p.mode === "watch" || p.mode === "web" ? "still" : "moving", {detail: p.mode});
            if (kill.at - t > p.search && random() < p.nearMiss * 0.6) {
                const other = p.foods.find((f) => f.the) ?? prey;
                t = push("attempt", t, t + 2, "still", {food: other, detail: p.mode});
                t = push("nearMiss", t, t + 4, "still", {food: other, detail: p.mode === "web" ? "web" : "escaped"});
            }
        }
        t = push("stalk", t, Math.max(t + 1, kill.at - 2), p.mode === "sitwait" || p.mode === "web" ? "still" : "moving", {food: prey, detail: p.mode});
        t = push("attempt", t, kill.at, "still", {food: prey, detail: p.mode});
        t = push("catch", t, t + 4, "still", {food: prey, detail: kill.prey, server: true});
        const cached = caches.find((c) => c.at >= t && c.at - t < 600);
        if (cached) caches.splice(caches.indexOf(cached), 1);
        if (cached) return push("cache", t, t + around(random, 40), "still", {food: prey, detail: p.cache?.method ?? "hide", server: true});
        ate = true;
        t = push("eat", t, t + around(random, p.handle * 2), "still", {food: prey});
        return push("digest", t, t + around(random, p.handle * 3), "still");
    }

    // To water: the walk (or flight), a wary look, the drink.
    function drinkBout(from: number): number {
        let t = push("toWater", from, from + around(random, 40), p.guild === "nectar" ? "air" : "moving");
        t = push("wary", t, t + 3 + random() * 5, "still");
        return push("drink", t, t + around(random, 25), "still");
    }

    // In season, a male's bout (pilot: calls, scent, display, a spar), no outcome the engine does not decide.
    function reproBout(from: number): number {
        let t = from;
        // A pair's nest: gathering and building (the clutch itself is the server's line, never here).
        if (p.repro.system === "pair" && p.repro.nest && server.repro?.partner) {
            for (let n = 0; n < 3; n++) {
                t = push("search", t, t + around(random, p.search * 2), "moving", {detail: "material"});
                t = push("build", t, t + around(random, 25), "still");
            }
            return t;
        }
        if (server.repro?.sex !== "male") return push("rest", from, from + 60, "still");
        if (p.repro.call) t = push("call", t, t + around(random, 40), "still");
        if (p.repro.scent && random() < 0.5) t = push("scentMark", t, t + around(random, 30), "moving");
        if (p.repro.display || p.repro.lek) t = push("display", t, t + around(random, p.repro.lek ? 300 : 90), "still", {detail: p.repro.display ?? "display"});
        if (p.repro.contest && random() < 0.4) t = push("spar", t, t + around(random, 45), "still", {detail: p.repro.contest});
        if (server.repro?.partner && random() < 0.5) {
            t = push("court", t, t + around(random, 60), "still", {detail: p.repro.display ?? "court"});
            t = push("rejected", t, t + 10, "still");
        }
        return t > from ? t : push("rest", from, from + 60, "still");
    }
}

// MARK: Words (English; the 45 locales come with the roll-out, docs section 6)

const MODE_SEARCH: Record<string, string> = {
    graze: "looking for good grazing", browse: "looking for leaves to browse", sight: "looking for food", listen: "listening for prey", watch: "crouched, watching for prey",
    sitwait: "standing still, watching for prey", web: "waiting on its web", flowers: "looking for flowers", probe: "probing for food", scent: "following a scent", swim: "searching the water"
};
const CACHE: Record<string, string> = {bury: "Burying {food} for later", hide: "Hiding {food} for later", hoard: "Storing {food} for later", larder: "Storing {food} in its larder", impale: "Spiking {food} on a thorn for later"};

function fill(text: string, food?: FoodWord, the = false): string {
    const word = food ? (the ? food.the ?? food.eat : food.eat) : "food";
    return text.replace("{food}", word);
}

/** The card's line for a step ("Now: …" takes it as it is). */
export function stepLine(step: FlowStep): string {
    const f = step.food;
    switch (step.kind) {
        case "sleep": return "Sleeping";
        case "settle": return "Settling down to sleep";
        case "wake": return "Waking up";
        case "search": return step.detail === "material" ? "Gathering nest material" : capital(MODE_SEARCH[step.detail ?? "sight"] ?? "looking for food");
        case "movePatch": return "Trying another spot";
        case "stalk": return step.detail === "web" ? capital(fill("{food} hit its web", f)) : step.detail === "sitwait" ? fill("Eyeing {food}", f) : fill("Stalking {food}", f);
        case "attempt": return step.detail === "web" ? fill("Running out to wrap {food}", f) : step.detail === "sitwait" ? fill("Striking at {food}", f) : step.detail === "listen" || step.detail === "watch" ? fill("Pouncing on {food}", f) : fill("Going for {food}", f);
        case "nearMiss": return step.detail === "dropped" ? fill("Missed: dropped {food}", f) : step.detail === "web" ? capital(fill("Missed: {food} broke free", f, true)) : capital(fill("Missed: {food} got away", f, true));
        case "nothing": return "Found nothing here";
        case "giveUp": return "Gave up, moving on";
        case "catch": return fill("Caught {food}", f);
        case "found": return step.detail === "cache" ? fill("Dug up its cache: {food}", f) : fill("Found {food}", f);
        case "eat": return f?.eat === "nectar" ? "Drinking nectar" : f?.eat === "pollen" ? "Gathering pollen" : fill("Eating {food}", f);
        case "cache": return fill(CACHE[step.detail ?? "hide"] ?? CACHE.hide, f);
        case "dance": return "Dancing to show the others the way";
        case "rest": return "Resting";
        case "digest": return "Resting after its meal";
        case "groom": return "Grooming";
        case "toWater": return "Heading to water";
        case "wary": return "Checking for danger at the water";
        case "drink": return "Drinking";
        case "keptWait": return "Waiting for its keeper";
        case "keptEat": return fill("Eating {food} from its keeper", f);
        case "call": return "Calling";
        case "scentMark": return "Scent-marking";
        case "display": return "Displaying";
        case "spar": return "Sparring with a rival";
        case "court": return "Courting";
        case "rejected": return "Courting: turned down";
        case "mate": return "With its mate";
        case "build": return "Building its nest";
    }
}

function capital(text: string): string {
    return text ? text[0].toUpperCase() + text.slice(1) : text;
}

// MARK: The live log's moments

export type FlowMomentKind = "caught" | "nearMiss" | "cached" | "found" | "gaveUp";
/** Each moment's chance of being said (a seeded draw a window), all above the everyday "doing" (0.3). */
export const FLOW_MOMENT_WEIGHTS: Record<FlowMomentKind, number> = {caught: 0.8, cached: 0.9, nearMiss: 0.6, gaveUp: 0.5, found: 0.4};

/** A step's moment, if it is one. A giving-up is said only after a long search (twice its patience's mean at least). */
export function stepMoment(step: FlowStep, steps: readonly FlowStep[], params: FlowParams): FlowMomentKind | null {
    switch (step.kind) {
        case "catch": return "caught";
        case "cache": return "cached";
        case "nearMiss": return "nearMiss";
        case "found": return "found";
        case "giveUp": {
            const i = steps.indexOf(step);
            let since = step.from;
            for (let k = i - 1; k >= 0 && ["search", "movePatch", "stalk", "attempt", "nearMiss", "nothing"].includes(steps[k].kind); k--) since = steps[k].from;
            return step.from - since >= params.patience * 0.8 ? "gaveUp" : null;
        }
        default: return null;
    }
}

/** The live log's line for a moment: "A Red Fox caught a Bank Vole". */
export function momentLine(kind: FlowMomentKind, name: string, step: FlowStep): string {
    const a = /^[aeiou]/i.test(name) && !/^(uni|eu|one|use|usu|ura)/i.test(name) ? `An ${name}` : `A ${name}`;
    const f = step.food;
    switch (kind) {
        case "caught": return `${a} caught ${f?.eat ?? "its prey"}`;
        case "cached": return `${a} is ${fill(CACHE[step.detail ?? "hide"] ?? CACHE.hide, f).replace(/^\w/, (c) => c.toLowerCase())}`;
        case "nearMiss": return `${a} missed: ${f?.the ?? "it"} ${step.detail === "web" ? "broke free" : "got away"}`;
        case "found": return `${a} found ${f?.eat ?? "food"} and is ${f?.eat === "nectar" ? "drinking" : "eating"}`;
        case "gaveUp": return `${a} gave up the search and moved on`;
    }
}

/** One animal's flow moments are said at most one in this many seconds (its server events, a catch and a cache, always). */
export const FLOW_MOMENT_GAP_SECONDS = 180;

/** The moments one animal's steps let through, in order: its seeded draw a step, and its gap. */
export function flowMoments(id: string, steps: readonly FlowStep[], params: FlowParams): Array<{kind: FlowMomentKind; step: FlowStep}> {
    const out: Array<{kind: FlowMomentKind; step: FlowStep}> = [];
    let last = -Infinity;
    for (const step of steps) {
        const kind = stepMoment(step, steps, params);
        if (!kind) continue;
        if (!step.server && (step.from - last < FLOW_MOMENT_GAP_SECONDS || hash32("flow-moment", id, Math.round(step.from)) / 4294967296 >= FLOW_MOMENT_WEIGHTS[kind])) continue;
        out.push({kind, step});
        last = step.from;
    }
    return out;
}
