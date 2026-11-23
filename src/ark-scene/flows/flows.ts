/**
 * Behaviour flows, pilot (docs/ark/behaviour-flows.md). An animal's time as chains of steps with outcomes, narrating the
 * engine's own outcomes: the engine decides (fed this Ark day or not, a kill and its prey, a cache, a mating); the flow
 * tells the path to it (the search, the near misses, giving up, the catch at the kill's time, eating, caching).
 *
 * Pure: a function of the animal's id, the engine's tick (the Ark day: `ARK_DAY_MS` of the shared clock) and what the
 * server released. Never the viewer, the camera or the frame. Nothing here decides anything on the Ark.
 *
 * Truth rules (owner, 2026-11-23, "no fake events"):
 * - Every catch, find, meal and near miss is backed by the engine: a catch is a `meal` event (its time, its prey); a near
 *   miss is an `escaped` event; a cache and a meal from one are SIG-EVENTS'; a kept animal's meal is its keepers'. Its
 *   everyday eating is of its background food as the engine stores it (`params.foods`, `voyage_species_traits.
 *   ambient_phrases`), and only while the engine says it is fed. Nothing is a seeded draw's outcome.
 * - Where the engine records nothing, only neutral steps: searching, listening, watching, moving on, resting, grooming,
 *   drinking, sleeping. No seeded pounce, miss, "found nothing", "gave up", rival, courtship or rejection.
 * - No mating without the server's `mated`; displays only at the server's own (`signature` display/courtship); nest
 *   building only before a clutch the server laid; no clutch, hatch or birth here at all (they are the server's lines).
 * - Eating, handling and caching are always still (ground, perch or water), never in the air or moving.
 */

import {hash32} from "@/lib/ark-clock";
import {isAwake} from "@/lib/ark-daylight";
import type {FlowParams, FoodWord} from "@/ark-scene/flows/params";

/** The engine's day (`ark-clock.ts` ARK_DAY_MS: one Ark year in 14 real days), in seconds: its tick. */
export const FLOW_TICK_SECONDS = (86_400 * 14) / 365;

export type StepKind =
    | "sleep" | "settle" | "wake"
    | "search" | "movePatch" | "stalk" | "attempt" | "nearMiss" | "catch" | "found" | "eat" | "carry" | "cache" | "dance"
    | "rest" | "digest" | "groom" | "toWater" | "drink" | "wary"
    | "keptWait" | "keptEat"
    | "display" | "court" | "mate" | "build";

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
    /**
     * A repeating cycle said as one activity with progress (coordinator, 2026-11-23: no card line flickering between two
     * steps): a grazer's patches, a forager's pecks, a bee's flowers, a nest's trips. Its steps still drive the pose.
     */
    bout?: FlowBout;
};

export type FlowBoutKind = "graze" | "browse" | "forage" | "flowers" | "filter" | "nest";
/** `n`: meals in it so far (a nest: its trip); `visits`: spots or flowers tried; `food`: what it is eating. */
export type FlowBout = {kind: FlowBoutKind; n: number; visits: number; food?: FoodWord; material?: string};

/** The guilds whose foraging is one activity with progress: their tries are seconds, not stalks. */
const GROUPED: Partial<Record<FlowParams["guild"], FlowBoutKind>> = {grazer: "graze", browser: "browse", seed: "forage", glean: "forage", nectar: "flowers", filter: "filter"};

/** What the server released about this animal: the engine's outcomes the flow narrates. */
export type FlowServer = {
    /** Changes whenever what the server released about it changes (a new snapshot or event): its flows are worked out again. */
    version?: string | number;
    /** Fed this Ark day (the engine's meal clock: not hungry, or a `fed` event that day). */
    fedOn: (tick: number) => boolean;
    /**
     * Kills (`meal` events): when (epoch s: the catch as the scene acts it) and the prey's name; `acted`, the scene's own
     * meal act's phases (s from the catch: eating, or carrying and caching), so the line says what the body does.
     */
    kills?: ReadonlyArray<{at: number; prey: string; acted?: {eat?: number; carry?: number; cache?: number; rest?: number}}>;
    /** The engine's own near misses (`escaped` events: its prey got away from it): when, and the prey's name. */
    escapes?: ReadonlyArray<{at: number; prey: string}>;
    /** SIG-EVENTS food caches (`signature` food_cache) and the meals from them (`fed` source cache). */
    caches?: ReadonlyArray<{at: number; recipe: string; /** SIG-EVENTS `cache: {food}`: what it stored (its own Field Guide text). */ food?: string}>;
    cacheMeals?: readonly number[];
    /** A kept animal (house, farm, zoo): its keepers' feeding times (epoch s, the scene's feeding rhythm), none when not kept. */
    kept?: {feedings: readonly number[]} | null;
    /** Reproduction, from the server: in its season (the kind's months), whether it has a mate it may court, matings. */
    repro?: {
        inSeason: boolean;
        sex: "male" | "female" | null;
        partner: boolean;
        neutered?: boolean;
        mated?: readonly number[];
        /** Its displays and courtships the engine logged (SIG-EVENTS `signature` display / courtship): when. */
        displays?: readonly number[];
        /** Its clutches the engine laid (`laid`): a pair builds its nest only in the ticks before one. */
        laid?: readonly number[];
    } | null;
};

export type FlowSubject = {
    id: string;
    params: FlowParams;
    server: FlowServer;
    /** The island's hour at a moment (0-24). */
    hoursAt: (epoch: number) => number;
    /** In the scene: the schedule's own waking hours (its activity as the server stores it), so a flow never sleeps while its body is up. */
    awake?: (epoch: number) => boolean;
};

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
    if (subject.awake) return subject.awake(epoch);
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
    const displays = (server.repro?.displays ?? []).filter((t) => t >= start && t < end);
    // Its background food as the engine stores it (a fox's insects and fruit): what it eats on a day the engine has it fed.
    const plain = p.foods;
    let ate = false;
    let gaveUp = false;
    // (Its last drink: once it has drunk it does not go back to the water for a while.)
    let drank = -Infinity;
    // A kept animal eats what its keepers give it, at their times; its own searches are play, never a meal.
    const kept = Boolean(server.kept);
    const feedings = (server.kept?.feedings ?? []).filter((f) => f >= start && f < end);
    // (The server's next event from a moment on: its kills, escapes, caches, matings, displays, keepers' feedings.)
    const nextEvent = (from: number) => Math.min(...[...escapes.map((e) => e.at), ...kills.map((k) => k.at), ...caches.map((c) => c.at), ...cacheMeals, ...matings, ...displays, ...feedings].filter((x) => x >= from));
    let t = start;
    let guard = 0;
    while (t < end && guard++ < 400) {
        if (!flowAwake(subject, t) && nextEvent(t) - t > 125) {
            // Asleep until it wakes (scanned a minute at a time; the tick's end at most).
            let wake = t;
            while (wake < end && !flowAwake(subject, wake)) wake += 60;
            // (The engine's own events wake it: an escape, a kill, a cache, a mating at a time its hours say it sleeps
            // still happened, so it is up for them, two minutes before.)
            const next = nextEvent(t);
            if (next < wake) wake = Math.max(t, next - 120);
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
            t = push("cache", t, t + around(random, 40), "still", {detail: p.cache?.method ?? "hide", food: cache.food ? {eat: cache.food, the: null} : p.foods[0], server: true});
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
        // The engine's own display or courtship (SIG-EVENTS), at its time.
        const display = displays.find((d) => d >= t && d - t < 120);
        if (display !== undefined) {
            displays.splice(displays.indexOf(display), 1);
            t = push("search", t, display, "moving", {detail: "mate"});
            t = push("display", t, t + Math.max(around(random, p.repro.lek ? 300 : 90), 45), "still", {detail: p.repro.display ?? "display", server: true});
            continue;
        }
        // The next server event's lead-in: its own bouts end there.
        limit = Math.min(end, ...kills.filter((k) => k.at > t).map((k) => k.at - p.patience * 0.9), ...caches.filter((c) => c.at > t).map((c) => c.at - 290), ...cacheMeals.filter((m) => m > t).map((m) => m - 290), ...escapes.filter((e) => e.at > t).map((e) => e.at - p.patience * 0.9), ...matings.filter((m) => m > t).map((m) => m - 110), ...displays.filter((d) => d > t).map((d) => d - 110), ...feedings.filter((f) => f > t).map((f) => f - 80));
        if (limit <= t + 0.5) {
            limit = end;
            t = Math.min(...[...kills.map((k) => k.at - p.patience * 0.9), ...caches.map((c) => c.at - 290), ...cacheMeals.map((m) => m - 290), ...escapes.map((e) => e.at - p.patience * 0.9), ...matings.map((m) => m - 110), ...displays.map((d) => d - 110), ...feedings.map((f) => f - 80)].filter((x) => x > t), end);
            continue;
        }
        // Too little time before the tick's end or the server's next event for a new bout to be told: it keeps on with
        // what it was doing (never a few seconds of something else and back).
        if (Math.min(end, limit) - t < 90 && steps.length) {
            const last = steps[steps.length - 1];
            const kind: StepKind = ["search", "movePatch", "rest", "digest", "groom", "sleep", "display", "build", "keptEat"].includes(last.kind) ? last.kind : "rest";
            t = push(kind, t, Math.min(end, limit), last.pose === "air" ? "still" : kind === last.kind ? last.pose : "still", kind === last.kind ? {detail: last.detail, food: last.food, bout: last.bout} : {});
            continue;
        }
        // Its choice of bout: its meal first on a day the engine has it fed, then its rhythm.
        // (A pair with a mate builds its nest only in the ticks before a clutch the server laid: section 5.)
        const able = Boolean(server.repro && server.repro.inSeason && !server.repro.neutered && p.repro.system !== "none");
        const laidSoon = (server.repro?.laid ?? []).some((l) => l >= start && l < end + 3 * FLOW_TICK_SECONDS);
        const repro = able && p.repro.system === "pair" && p.repro.nest && Boolean(server.repro!.partner) && laidSoon;
        const pick = random();
        const mayEat = fed && plain.length > 0 && !kept;
        const needs = mayEat && !ate;
        if (repro && !needs && (pick < 0.45 || (ate && pick < 0.7))) t = reproBout(t);
        // (After a search that came to nothing it rests or tidies itself before searching again: never straight back at it.)
        else if (!gaveUp && (needs || pick < (fed ? 0.45 : 0.7))) t = forage(t, mayEat);
        else if (pick < 0.82 && t - drank > 1800) {
            gaveUp = false;
            t = drinkBout(t);
            drank = t;
        }
        else {
            gaveUp = false;
            t = pick < 0.9 ? push("groom", t, t + Math.max(around(random, 90), 40), "still") : push("rest", t, t + Math.max(around(random, 300), 60), "still");
        }
    }
    // (A sliver left at the tick's end is not a new activity: the one before it runs on to the end.)
    const tail = steps[steps.length - 1];
    if (tail && steps.length > 1 && !tail.server && tail.to - tail.from < CARD_RETURN_SECONDS && tail.kind !== "sleep") {
        steps.pop();
        steps[steps.length - 1].to = tail.to;
    }
    return steps;

    // A forage bout: searching, moving between spots and, on a day the engine has it fed, eating its background food. A
    // day it is not: the search comes to nothing (said as searching, then moving on and resting: no seeded miss or find).
    function forage(from: number, mayEat: boolean): number {
        let t = from;
        gaveUp = false;
        const first = steps.length;
        const bout = t + around(random, mayEat ? p.bout : p.patience);
        let spots = 0;
        let fedHere = false;
        const still = p.guild === "web" || p.mode === "sitwait" || p.mode === "watch";
        while (t < Math.min(bout, end, limit)) {
            t = push(!still && spots && random() < 0.3 ? "movePatch" : "search", t, t + Math.max(around(random, p.search), 20 + random() * 25), still ? "still" : "moving", {detail: p.mode});
            spots++;
            // (Too little time left for a meal to play out: the bout ends on its search.)
            if (Math.min(end, limit) - t < 40) break;
            if (!mayEat) continue;
            const food = plain[Math.floor(random() * Math.min(plain.length, 3))];
            // (A meal said on its own line lasts long enough not to flicker with the search around it: CARD_RETURN_SECONDS.)
            t = push("eat", t, t + Math.max(around(random, p.handle), GROUPED[p.guild] ? 0 : CARD_RETURN_SECONDS + 2), "still", {food});
            fedHere = true;
            ate = true;
            // (Full for now, it may stop, but a bout is never a single bite: a minute and a half at least.)
            if (t - from > Math.max(90, p.bout * 0.25) && random() < 0.5) break;
        }
        group(first);
        // (A bee's dance is back at the hive after a bout it fed in, never between two flowers.)
        if (fedHere && p.dance && random() < 0.5) t = push("dance", t, t + CARD_RETURN_SECONDS + 2 + random() * 20, "still");
        if (fedHere) return push("digest", t, t + Math.max(around(random, p.handle * 1.5), 45), "still");
        gaveUp = true;
        if (!still && Math.min(end, limit) - t >= 40) t = push("movePatch", t, t + 30 + random() * 30, "moving", {detail: p.mode});
        return push("rest", t, t + Math.max(around(random, 240), 60), "still");
    }

    // A grouped guild's bout from `first` on: each step carries the bout's progress so far.
    function group(first: number) {
        const kind = GROUPED[p.guild];
        if (!kind) return;
        // (Straight on from a bout of the same: its count carries on, the card stays on its line.)
        const before = steps[first - 1]?.bout;
        const bout: FlowBout = before && before.kind === kind ? {...before} : {kind, n: 0, visits: 0};
        for (let i = first; i < steps.length; i++) {
            const step = steps[i];
            if (step.kind === "eat") {
                bout.n++;
                bout.food = step.food;
            } else if (step.kind === "movePatch" || step.kind === "search") bout.visits++;
            step.bout = {...bout};
        }
    }

    // The server's kill at its time: the search before it (only searching: its misses are the engine's own `escaped`), the
    // stalk and the attempt on that prey, the catch, then eating (or caching, when SIG-EVENTS saved it).
    function huntTo(kill: {at: number; prey: string; acted?: {eat?: number; carry?: number; cache?: number; rest?: number}}, from: number): number {
        let t = from;
        const prey: FoodWord = {eat: `a ${kill.prey}`, the: `the ${kill.prey}`};
        const still = p.mode === "sitwait" || p.mode === "watch" || p.mode === "web";
        if (kill.at - t > p.search * 1.5) t = push("search", t, kill.at - Math.min(p.search, 60), still ? "still" : "moving", {detail: p.mode});
        t = push("stalk", t, Math.max(t + 1, kill.at - 2), p.mode === "sitwait" || p.mode === "web" ? "still" : "moving", {food: prey, detail: p.mode});
        t = push("attempt", t, kill.at, "still", {food: prey, detail: p.mode});
        t = push("catch", t, t + 4, "still", {food: prey, detail: kill.prey, server: true});
        const cached = caches.find((c) => c.at >= t && c.at - t < 600);
        if (cached) caches.splice(caches.indexOf(cached), 1);
        // (Cached: picked up and carried off in its mouth to its cache spot, then dug in: the scene's meal act, `meal-acts.ts`.)
        if (cached) {
            t = push("carry", t, t + (kill.acted?.carry ?? 12 + random() * 10), "moving", {food: prey});
            t = push("cache", t, t + (kill.acted?.cache ?? Math.max(around(random, 15), 11)), "still", {food: prey, detail: p.cache?.method ?? "hide", server: true});
            // (The scene's act rests it after: its rest, as long as the act's.)
            return kill.acted?.rest ? push("rest", t, t + kill.acted.rest, "still") : t;
        }
        ate = true;
        t = push("eat", t, t + (kill.acted?.eat ?? around(random, p.handle * 2)), "still", {food: prey});
        return push("digest", t, t + (kill.acted?.rest ?? around(random, p.handle * 3)), "still");
    }

    // To water: the walk (or flight), a wary look, the drink.
    function drinkBout(from: number): number {
        let t = push("toWater", from, from + around(random, 40), p.guild === "nectar" ? "air" : "moving");
        t = push("wary", t, t + 3 + random() * 5, "still");
        return push("drink", t, t + around(random, 25), "still");
    }

    // A pair's nest before the clutch the server laid: gathering and building, its trips counted (never the clutch itself).
    function reproBout(from: number): number {
        let t = from;
        const trips = 4 + Math.floor(random() * 9);
        const material = p.repro.material ?? "material";
        for (let n = 1; n <= trips && t < Math.min(end, limit); n++) {
            const bout: FlowBout = {kind: "nest", n, visits: n, material};
            t = push("search", t, t + Math.max(around(random, p.search * 2), 12), "moving", {detail: "material", bout});
            t = push("build", t, t + around(random, 25), "still", {bout});
        }
        return push("rest", t, t + Math.max(around(random, 120), 60), "still");
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

/** The card's line for a step ("Now: …"): its activity, and a grouped bout's progress after a " · ". */
export function stepLine(step: FlowStep): string {
    const card = stepCard(step);
    return card.progress ? `${card.line} · ${card.progress}` : card.line;
}

/** A step as the card says it: the activity (what must not flicker) and its progress (which may count up). */
export function stepCard(step: FlowStep): {line: string; progress: string | null} {
    const b = step.bout;
    if (b && step.kind !== "digest" && step.kind !== "dance" && step.kind !== "rest") {
        const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
        const found = b.food ? `eating ${b.food.eat === "nectar" ? "nectar" : b.food.eat}` : null;
        switch (b.kind) {
            case "nest":
                return {line: "Building its nest", progress: `trip ${b.n}, carrying ${b.material ?? "material"}`};
            case "flowers":
                return {line: "Visiting flowers", progress: `${b.visits + 1} so far`};
            case "graze":
            case "browse":
                // (Head down and moving on through the sward from the start: grazing all the way, its patches counted.)
                return {line: b.kind === "graze" ? "Grazing" : "Browsing", progress: b.n ? `${found} · patch ${b.n}` : "looking for a good patch"};
            case "filter":
                return {line: "Filter-feeding", progress: b.n ? found : null};
            case "forage":
                return {line: "Foraging", progress: b.n ? found : b.visits > 1 ? `${plural(b.visits, "spot", "spots")} searched` : "looking for food"};
        }
    }
    return {line: soloLine(step), progress: null};
}

function soloLine(step: FlowStep): string {
    const f = step.food;
    switch (step.kind) {
        case "sleep": return "Sleeping";
        case "settle": return "Settling down to sleep";
        case "wake": return "Waking up";
        case "search": return step.detail === "material" ? "Gathering nest material" : step.detail === "mate" ? "Moving" : capital(MODE_SEARCH[step.detail ?? "sight"] ?? "looking for food");
        case "movePatch": return "Moving on";
        case "stalk": return step.detail === "web" ? capital(fill("{food} hit its web", f)) : step.detail === "sitwait" ? fill("Eyeing {food}", f) : fill("Stalking {food}", f);
        case "attempt": return step.detail === "web" ? fill("Running out to wrap {food}", f) : step.detail === "sitwait" ? fill("Striking at {food}", f) : step.detail === "listen" || step.detail === "watch" ? fill("Pouncing on {food}", f) : fill("Going for {food}", f);
        case "nearMiss": return step.detail === "dropped" ? fill("Missed: dropped {food}", f) : step.detail === "web" ? capital(fill("Missed: {food} broke free", f, true)) : capital(fill("Missed: {food} got away", f, true));
        case "catch": return fill("Caught {food}", f);
        case "found": return step.detail === "cache" ? fill("Dug up its cache: {food}", f) : fill("Found {food}", f);
        case "eat": return f?.eat === "nectar" ? "Drinking nectar" : f?.eat === "pollen" ? "Gathering pollen" : fill("Eating {food}", f);
        case "carry": return fill("Carrying {food} off to store it", f);
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
        case "display": return "Displaying";
        case "court": return "Courting";
        case "mate": return "With its mate";
        case "build": return "Building its nest";
    }
}

function capital(text: string): string {
    return text ? text[0].toUpperCase() + text.slice(1) : text;
}

// MARK: The live log's moments

export type FlowMomentKind = "caught" | "nearMiss" | "cached" | "found";
/** Each moment's chance of being said: always (every moment is the engine's own event; above the everyday "doing", 0.3). */
export const FLOW_MOMENT_WEIGHTS: Record<FlowMomentKind, number> = {caught: 1, cached: 1, nearMiss: 1, found: 1};

/** A step's moment, if it is one: only the engine's own events (a catch, a cache, a near miss, a meal from a cache). */
export function stepMoment(step: FlowStep, _steps: readonly FlowStep[], _params: FlowParams): FlowMomentKind | null {
    if (!step.server) return null;
    switch (step.kind) {
        case "catch": return "caught";
        case "cache": return "cached";
        case "nearMiss": return "nearMiss";
        case "found": return "found";
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
        case "found": return `${a} dug up its cache: ${f?.eat ?? "food"}`;
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

/** The card's runs: consecutive steps that say the same activity (progress may count up inside a run). */
export function cardRuns(steps: readonly FlowStep[]): Array<{line: string; from: number; to: number}> {
    const runs: Array<{line: string; from: number; to: number}> = [];
    for (const step of steps) {
        const line = stepCard(step).line;
        const last = runs[runs.length - 1];
        if (last && last.line === line && step.from - last.to < 1) last.to = step.to;
        else runs.push({line, from: step.from, to: step.to});
    }
    return runs;
}

/** A card line may not come back within this many seconds after one other line (no flicker between two steps). */
export const CARD_RETURN_SECONDS = 30;
