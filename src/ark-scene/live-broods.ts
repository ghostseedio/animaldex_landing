/**
 * BROODS drawn in the world (AnimalDex docs/ark/broods.md section 7; owner 2026-11-27: "make sure it's drawn on the
 * world and not just a log"). The engine keeps a clutch or a litter as ONE record with a count; this layer draws it
 * from the public brood read (`src/lib/ark-broods.ts`) and nothing else:
 *
 *   EGGS where they were laid (the brood's `nest`: the copied home slot, placed by the scene's own home function), with
 *   the record's count: a bird's nest, a scrape, spawn in the water that lasts as long as the record does (a clump, a
 *   toad's string, a patch on a rock), a spider's sac. The attending parent (`carer`, `hold`) sits on them, guards
 *   beside them or fans them for as long as the read says it attends.
 *   YOUNG as STAND-INS: up to a tier's few members a brood are roster animals made from the record (the kind's own
 *   model, born on the brood's stage day, its parents the brood's), so every system that already draws young draws
 *   them: young scale (`ark-age.ts`), following, lying up, riding, lines and clumps (`liveliness-scene.ts`). They are
 *   ordinary roster animals, not pins, so they count against the live budget (`live-budget.ts`). The rest of the count
 *   is instanced specks (a trail behind the carer, a cluster at the nest, a school in the water). Never more than
 *   `count` is drawn; a count above what is drawn is the card's number.
 *   TAKES acted: each `taken` loss of the read is acted once, on the shared clock, held as a meal is
 *   (`ark-act-hold.ts`): young that can run are chased by `live-meals.ts` (the prey a stand-in), eggs and young that
 *   cannot are RAIDED here: the hunter goes to the brood's place, feeds there, and the record's count of eggs or young
 *   goes one by one while it does; the attending parent gives way.
 *   LOSSES WITH NO CAUSE ("did not survive", "failed", "did not settle"): the members fade where they are. No death
 *   act, no carcass, nothing made up. A failed nest stands empty a while, then fades.
 *   RECRUITMENT: the survivors' stand-ins hand over to the new animals where they stand (`recruited`).
 *
 * Nothing here decides anything: every count, time, hunter and place is the record's. With the read off the layer is
 * never made (`index.ts` loads this file only for a read that says `on: true`).
 *
 * Pure in the shared clock: no three.js, no DOM. The scene gives it entries through a host; it gives back act poses,
 * the roster's stand-ins, and what to draw through a sink (`brood-draw.ts`).
 */

import type {ActPose} from "@/ark-scene/acts";
import type {ArkAnimal, ArkSnapshot, ArkZone} from "@/ark-scene/types";
import type {QualityTier} from "@/ark-scene/post";
import type {ArkAct, ArkEventAnimal} from "@/lib/ark-life";
import {arkActStart} from "@/lib/ark-act-hold";
import {ARK_DAY_MS} from "@/lib/ark-clock";
import {ARK_BROOD_MEMBER_PREFIX, arkBroodLossStage, arkBroodMemberId, arkBroodOfMember, type ArkBrood, type ArkBroodLoss, type ArkBroodsRead} from "@/lib/ark-broods";
import {waysOf} from "@/ark-scene/young-ways";

type MealAct = Extract<ArkAct, {kind: "meal"}>;
type Point = {x: number; z: number};

/** Stand-ins drawn with the kind's own model, per brood and in all (a fifth of the tier's live budget at most). */
export const BROOD_MODELS: Record<QualityTier, number> = {high: 6, medium: 4, low: 2};
export const BROOD_MODELS_MOST: Record<QualityTier, number> = {high: 240, medium: 80, low: 40};
/** Instanced members a brood, at most. */
export const BROOD_SPECKS: Record<QualityTier, number> = {high: 40, medium: 24, low: 12};
/** Eggs drawn in a nest or a scrape, and beads of spawn, at most. */
export const BROOD_EGGS_DRAWN = 24;
export const BROOD_SPAWN_DRAWN = 60;

/** A raid: the hunter's way to the brood (s), its feeding there per member taken (s, within bounds), its way back (s). */
export const RAID_WALK = 14;
const RAID_PER = 1.3;
const RAID_FEED_MIN = 4;
const RAID_FEED_MAX = 12;
const RAID_BACK = 12;
/** A take whose act would have begun this long ago (s) is not acted: the members are simply gone. */
const ACT_LATE = 150;
/** A chase's catch, until `live-meals` says when it is (s after its start). */
const CATCH_GUESS = 8;
/** Members that go with no cause fade over this long (s); a taken one over this. */
const QUIET_FADE = 4;
const TAKEN_FADE = 0.7;
/** The deepest water a clump of frog spawn is laid in (m): the margin's warm shallows. */
const SPAWN_SHALLOW = 0.08;
/** A failed nest stands empty this long (s), then fades over this. */
export const NEST_EMPTY_SECONDS = 600;
const NEST_FADE = 8;
/** The eggs come one by one over this long (s) when the laying is seen; a hatching's rock and split. */
const LAY_SECONDS = 2.4;
export const HATCH_ROCK = 0.9;
const HATCH_GONE = 1.6;
/** The hatchlings stay round the nest this long before the young systems have them (s). */
const HATCH_STAY = 12;
/** The parent's way back onto its eggs after something else had it (s). */
const SETTLE = 5;
/** A recruit takes over its stand-in's place over this long (s); stand-ins wait for their recruits this long. */
const HANDOVER = 3;
const HANDOVER_WAIT = 120;

/** A brood's place: the surface its eggs lie on (`y`: the ground, the bed, a limb), the water's top there, and whether it is in water. */
export type BroodPlace = {x: number; z: number; y: number; top: number; yaw: number; water: boolean};
export type BroodBody = {x: number; z: number; base: number; yaw: number; length: number};

export type EggLook = "shell" | "speckled" | "spawn" | "sac";
export type NestLook = "nest" | "scrape";
export type SpeckLook = "oval" | "four" | "fry" | "tadpole" | "grub";

/** What the layer draws, a frame: the drawer (`brood-draw.ts`) writes each straight into an instanced mesh. */
export type BroodSink = {
    nest: (look: NestLook, x: number, y: number, z: number, size: number, alpha: number) => void;
    egg: (look: EggLook, x: number, y: number, z: number, size: number, roll: number) => void;
    speck: (look: SpeckLook, slug: string, x: number, y: number, z: number, yaw: number, length: number, scale: number) => void;
};

export type LiveBroodsHost<E> = {
    /** A drawn living animal's entry (a stand-in's too), or null: not out, held by another act's stand-in, or not aboard. */
    find: (id: string) => E | null;
    /** Whether the live set has it at all (out, even if another act's stand-in holds it now). */
    out: (id: string) => boolean;
    /** The model's body plan (`ark.json` behaviour.plan: mammal, bird, reptile, snake, frog, fish, arthropod...), or null: not in yet. */
    plan: (slug: string) => string | null;
    /** Where the scene's home function puts each of these (a nest's slot as an animal's): from the record alone. */
    place: (animals: ArkAnimal[]) => Map<string, BroodPlace>;
    /** The water's edge near a point (a land-layer whose home is in the water lays on the shore), or null: none near. */
    shore?: (x: number, z: number) => Point | null;
    /** Water near a point (spawn is laid in it, whatever damp ground the parent's home is on), or null: none near. */
    wet?: (x: number, z: number) => Point | null;
    /** An adult of the kind's drawn length (m). */
    adultLength: (brood: ArkBrood) => number;
    /** Where an entry is drawn now, and where its day has it at a time (null: off its day). */
    body: (entry: E) => BroodBody;
    scheduleAt: (entry: E, epoch: number) => {x: number; z: number; y: number; yaw: number} | null;
    ground: (x: number, z: number) => number;
    waterTop: (x: number, z: number) => number;
    walk: (entry: E) => number;
    flies: (entry: E) => boolean;
    /** Whether it goes in the water (its day has it swim): a hunter that does not is never acted over open water. Absent: it does not. */
    swims?: (entry: E) => boolean;
    setAct: (entry: E, pose: ActPose | null) => void;
    /** Held by something else now (a meal, a mating, a replay, a moment): left alone. */
    busy: (entry: E) => boolean;
    /** A take of young that can run: `live-meals.ts` acts the chase and the meal. */
    addMeals: (acts: MealAct[]) => void;
    /** When that chase's catch is (s, shared clock), once `live-meals` has built it; else null. */
    catchAt: (predator: string, prey: string) => number | null;
    /** A chase `live-meals` could not act (a hunter that cannot follow its prey where it is): it lets it go; the take is then a raid here. */
    dropMeal: (predator: string, prey: string) => void;
    /** The roster's stand-ins changed: the scene lays its animals out again. */
    relayout: () => void;
};

type LossAct = {
    loss: ArkBroodLoss;
    stage: "egg" | "young";
    /** `raid`: acted here at the brood's place. `meal`: a chase by `live-meals`. `quiet`: a fade. `none`: already over. */
    kind: "raid" | "meal" | "quiet" | "none";
    /** The act's start (s). */
    t0: number;
    /** When the members are gone from the count (s); they go over `span` seconds before it (a raid's feeding). */
    effectAt: number;
    span: number;
    /** (meal) the eaten one's id, given to `live-meals`; sent once. */
    prey?: string;
    sent?: boolean;
    /** (raid) where the hunter's day had it when it set out, and whether it was ever found. */
    from?: {x: number; z: number; y: number; yaw: number} | null;
    /** (raid) where the brood was when it began: its nest, or with the parent its young follow. */
    at?: BroodPlace;
    /**
     * (raid of young) acted away from where the brood is drawn now: young with their parent on the water and a hunter that
     * cannot go there are taken at the record's own place of the take (its encounter's spot, else the nest, on the
     * shore). Those it took come to that place from the brood, and go there one by one as it feeds.
     */
    apart?: {from: Map<string, BroodBody>};
    acted?: boolean;
    over?: boolean;
};

type Live = {
    brood: ArkBrood;
    ended: boolean;
    /** When this page first saw it (s), first saw it ended, and saw it hatch (null: not seen). */
    seenAt: number;
    endedAt: number | null;
    hatchAt: number | null;
    /** Its eggs come one by one from here (s), when its laying was seen; else -Infinity. */
    layAt: number;
    place: BroodPlace | null;
    placed: boolean;
    size: number;
    adult: number;
    acts: Map<string, LossAct>;
    /** Model stand-ins in the roster now. */
    models: number;
    /** The carer as last posed by this layer, and since when it has had it (s). */
    sitter: {id: string; since: number; from: BroodBody} | null;
    /** Recruits that take over from its stand-ins: the new animal, the stand-in's last place, when it began. */
    recruits: Array<{id: string; from: BroodBody | null; since: number | null; done: boolean}>;
    /** Where each stand-in was last drawn (for a hand-over). */
    last: Map<string, BroodBody>;
    /** Worked out once: each egg's place in the clutch (x, y, z by threes), and each instanced member's two own numbers. */
    spots?: {all: number; layout: string; at: Float32Array};
    rand?: Float32Array;
    /** When something else last held its attending parent (s): it then walks back onto its eggs. */
    heldAt?: number;
    /** How many stand-ins it had when it ended with survivors (they wait for their recruits). */
    handing?: number;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
const ease = (u: number) => {
    const c = clamp(u, 0, 1);
    return c * c * (3 - 2 * c);
};
function unit(key: string): number {
    let h = 2166136261;
    for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
    return ((h >>> 0) % 100000) / 100000;
}

/**
 * A pose on a raised surface (a nest on a limb, a perch, a rock's top): the scene stands an act on the ground unless it
 * is given the surface it is on (`acts.ts` ActPose.surface, as a perched bird's own place has).
 */
export function onSurface(pose: ActPose): ActPose {
    return {...pose, pitch: 0, surface: {nx: 0, ny: 1, nz: 0, tx: Math.sin(pose.yaw), ty: 0, tz: Math.cos(pose.yaw)}};
}

/**
 * The models' plans (`ark.json` behaviour.plan, counted over the 2,632 local models 2026-11-27): mammal 696, bird 680,
 * arthropod 413, fish 265, reptile 129, butterfly 103, turtle 64, snake 61, slow_invertebrate 55, frog 47, cetacean 27,
 * sessile 18, cephalopod 17, eel 16, ray 13, jellyfish 11, worm 8, flatfish 7. (`shark`, `lizard`, `crocodile` are kept
 * for a plan the models may yet carry; a shark is `fish` today, a crocodile `reptile`.)
 */
const WATER_PLAN = /^(fish|flatfish|eel|ray|shark|cetacean|jellyfish|cephalopod)$/;
const LEGGED_PLAN = /^(mammal)$/;
/** Plans that lay on land whatever water their home is in (a turtle, a crocodile, a water snake). */
const LAND_LAYER = /^(reptile|turtle|snake|crocodile|lizard|mammal)$/;
const MODEL_PLAN = /^(mammal|cetacean|bird|reptile|turtle|snake|crocodile|lizard|fish|flatfish|eel|ray|shark)$/;

/**
 * How many of `count` are drawn when at most `cap` can be: all of them while the stage began within the cap; else in
 * proportion to what is left of the stage's start, so a take from a clutch of thousands is still seen. Never more
 * than `count`. Pure, monotone in `count`.
 */
export function broodDrawn(count: number, of: number, cap: number): number {
    if (count <= 0 || cap <= 0) return 0;
    if (of <= cap) return Math.min(count, cap);
    return Math.max(Math.min(count, Math.round((cap * Math.min(count, of)) / of)), 1);
}

/** How a brood's eggs are drawn: the nest's kind (null: none under them), the eggs' look, and how many at most; null: not drawn (carried in a mouth or a pouch, or drifting spawn). */
export function broodEggLook(brood: Pick<ArkBrood, "way" | "way_detail" | "care" | "hold" | "model_slug">, plan: string | null, water: boolean): {nest: NestLook | null; egg: EggLook; cap: number; layout: "heap" | "clump" | "string" | "patch"} | null {
    const detail = brood.way_detail ?? "";
    // (Nothing lasting is honest for drifting spawn; a mouthbrooder's and a pouch's eggs are inside the parent.)
    if (brood.way === "broadcast" || brood.way === "brooding" || brood.way === "male_pregnancy" || /mouth|pouch/.test(detail)) return null;
    const slug = brood.model_slug;
    if (plan === "bird") return brood.care === "follow" ? {nest: "scrape", egg: "speckled", cap: BROOD_EGGS_DRAWN, layout: "heap"} : {nest: "nest", egg: "speckled", cap: BROOD_EGGS_DRAWN, layout: "heap"};
    if (plan === "frog" || /(frog|toad|newt|salamander|axolotl|caecilian)/.test(slug)) return {nest: null, egg: "spawn", cap: BROOD_SPAWN_DRAWN, layout: /toad/.test(slug) ? "string" : "clump"};
    if (WATER_PLAN.test(plan ?? "") || (water && !LAND_LAYER.test(plan ?? ""))) return {nest: null, egg: "spawn", cap: BROOD_SPAWN_DRAWN, layout: detail === "scatter" ? "clump" : "patch"};
    if (/(spider|tarantula)/.test(slug)) return {nest: null, egg: "sac", cap: 1, layout: "heap"};
    return {nest: "scrape", egg: "shell", cap: BROOD_EGGS_DRAWN, layout: "heap"};
}

/** Whether a brood's young are drawn with the kind's own model (else as specks only: a tadpole is not a small frog). */
export function broodModels(brood: Pick<ArkBrood, "care">, plan: string | null): boolean {
    return MODEL_PLAN.test(plan ?? "") || brood.care === "carry";
}

/** Whether its young can run from a hunter (a chase), or are taken where they are (a raid). */
export function broodFlees(brood: Pick<ArkBrood, "care">, plan: string | null): boolean {
    return MODEL_PLAN.test(plan ?? "") && brood.care !== "nest" && brood.care !== "carry";
}

/** A member's speck by its kind's plan. */
export function broodSpeck(plan: string | null, water: boolean): SpeckLook {
    if (plan === "frog") return "tadpole";
    if (WATER_PLAN.test(plan ?? "")) return "fry";
    if (plan === "bird") return "oval";
    if (LEGGED_PLAN.test(plan ?? "")) return "four";
    if (LAND_LAYER.test(plan ?? "")) return "grub";
    return water ? "fry" : "grub";
}

/** The k-th egg's place in a clutch of `n` (unit: the nest's size), by its layout. Pure. */
export function eggSpot(layout: "heap" | "clump" | "string" | "patch", k: number, n: number, seed: number): {x: number; y: number; z: number} {
    if (layout === "string") {
        // A toad's string: beads along a line wound through the weed.
        const u = n > 1 ? k / (n - 1) : 0.5;
        const along = (u - 0.5) * 3.2;
        const c = Math.cos(seed * 6.283);
        const s = Math.sin(seed * 6.283);
        const side = Math.sin(u * 9 + seed * 20) * 0.28;
        return {x: along * c - side * s, y: Math.sin(u * 14 + seed * 9) * 0.05, z: along * s + side * c};
    }
    const angle = k * 2.39996 + seed * 6.283;
    const spread = layout === "heap" ? 0.2 + 0.035 * Math.sqrt(n) : layout === "patch" ? 0.5 : 0.42;
    const r = n === 1 ? 0 : spread * Math.sqrt((k + 0.5) / n);
    // (A clump of spawn is a mass: a second layer above the first.)
    const y = layout === "clump" ? (k % 3) * 0.05 : layout === "heap" && n > 9 ? (k % 2) * 0.04 : 0;
    return {x: Math.cos(angle) * r, y, z: Math.sin(angle) * r};
}

/** The carer's pose on, beside or over its eggs. Pure. */
export function carerPose(hold: "sit" | "guard", water: boolean, nest: BroodPlace, length: number, key: string, epoch: number): ActPose {
    const yaw0 = unit(`${key}:yaw`) * Math.PI * 2;
    const mk = (x: number, z: number, base: number, yaw: number, state: string, pitch = 0): ActPose => ({x, z, base, yaw, pitch, roll: 0, scale: 1, dim: 0, hidden: false, state, speed: 0, meal: "resting"});
    if (water) {
        // Fanning: over the eggs, head to them, its body rocking as its fins beat.
        const off = length * 0.35;
        return mk(nest.x - Math.sin(yaw0) * off, nest.z - Math.cos(yaw0) * off, nest.y + Math.max(length * 0.12, 0.02), yaw0 + Math.sin(epoch * 0.7) * 0.18, "swim", 0.14 + 0.07 * Math.sin(epoch * 5.2));
    }
    // Sitting: low in the cup, its legs under it.
    if (hold === "sit") return mk(nest.x, nest.z, nest.y - length * 0.1, yaw0, "rest", 0.04 * Math.sin(epoch * 0.5));
    // Guarding: a body length off, turned outward, looking about.
    return mk(nest.x + Math.sin(yaw0) * length * 0.9, nest.z + Math.cos(yaw0) * length * 0.9, nest.y, yaw0 + Math.sin(epoch * 0.23) * 0.9, "scan");
}

/** The hunter at a raid, `s` seconds into it: to the brood, feeding there, and away; null once it is back at its day. Pure. */
export function raidPose(s: number, feed: number, from: {x: number; z: number; y: number; yaw: number} | null, back: {x: number; z: number; y: number; yaw: number} | null, nest: BroodPlace, length: number, size: number, walk: number, flies: boolean, ground: (x: number, z: number) => number): ActPose | null {
    const mk = (x: number, z: number, base: number, yaw: number, state: string, speed = 0, extra: Partial<ActPose> = {}): ActPose => ({x, z, base, yaw, pitch: 0, roll: 0, scale: 1, dim: 0, hidden: false, state, speed, ...extra});
    // It stands at the nest's edge, its head over the eggs.
    const reach = Math.max(length * 0.45, size * 0.5);
    const dir = from && Math.hypot(nest.x - from.x, nest.z - from.z) > 0.05 ? Math.atan2(nest.x - from.x, nest.z - from.z) : nest.yaw;
    const at = {x: nest.x - Math.sin(dir) * reach, z: nest.z - Math.cos(dir) * reach};
    const base = nest.water ? nest.y + Math.max(length * 0.1, 0.02) : nest.y;
    const go = (a: {x: number; z: number; y: number}, b: {x: number; z: number; y: number}, k: number, seconds: number): ActPose => {
        const e = ease(k);
        const x = a.x + (b.x - a.x) * e;
        const z = a.z + (b.z - a.z) * e;
        const d = Math.hypot(b.x - a.x, b.z - a.z);
        const yaw = d > 0.05 ? Math.atan2(b.x - a.x, b.z - a.z) : dir;
        const air = flies && d > Math.max(length * 6, 3);
        const y = air ? a.y + (b.y - a.y) * e + Math.sin(Math.PI * clamp(k, 0, 1)) * clamp(d * 0.2, 1, 8) : nest.water ? a.y + (b.y - a.y) * e : Math.abs(a.y - ground(a.x, a.z)) < 0.3 && Math.abs(b.y - ground(b.x, b.z)) < 0.3 ? ground(x, z) : a.y + (b.y - a.y) * e;
        return mk(x, z, y, yaw, air ? "fly" : nest.water ? "swim" : d < 0.05 ? "scan" : "walk", (d / Math.max(seconds, 0.5)) * 6 * clamp(k, 0, 1) * (1 - clamp(k, 0, 1)), {meal: "hunting"});
    };
    const here = {x: at.x, z: at.z, y: base};
    if (s < RAID_WALK) {
        // (Too far to come in the time, or its day unknown: it is at the brood's edge from the start, as a meal's hunter is at its chase's.)
        const far = !from || Math.hypot(at.x - from.x, at.z - from.z) > Math.max(walk, 0.3) * RAID_WALK * (flies ? 8 : 2.5);
        return far ? mk(at.x, at.z, base, dir, "scan", 0, {meal: "hunting"}) : go(from!, here, s / RAID_WALK, RAID_WALK);
    }
    const f = s - RAID_WALK;
    // Feeding: its head down into the nest, a dip for each one it takes.
    if (f < feed) return mk(at.x, at.z, base, dir, "eat", 0, {pitch: 0.1 + 0.06 * Math.sin(f * (Math.PI * 2 / RAID_PER)), meal: "eating"});
    const b = f - feed;
    if (!back || b >= RAID_BACK) return null;
    return {...go(here, back, b / RAID_BACK, RAID_BACK), meal: undefined};
}

/** A hatchling's first seconds at the nest (hidden in the egg, out, a few steps clear, about it); null once the young systems have it. Pure. */
export function hatchPose(s: number, k: number, n: number, nest: BroodPlace, size: number): ActPose | null {
    if (s >= HATCH_STAY) return null;
    const angle = (k / Math.max(n, 1)) * Math.PI * 2 + 0.6;
    const r = size * (0.45 + 0.2 * (k % 2));
    const at = {x: nest.x + Math.sin(angle) * r, z: nest.z + Math.cos(angle) * r};
    const mk = (x: number, z: number, yaw: number, state: string, extra: Partial<ActPose> = {}): ActPose => ({x, z, base: nest.y, yaw, pitch: 0, roll: 0, scale: 1, dim: 0, hidden: false, state, speed: 0, ...extra});
    const out = s - HATCH_ROCK - k * 0.4;
    if (out < 0) return mk(nest.x, nest.z, angle, "rest", {hidden: true});
    if (out < 1.4) {
        const e = ease(out / 1.4);
        return mk(nest.x + (at.x - nest.x) * e, nest.z + (at.z - nest.z) * e, angle, nest.water ? "swim" : "walk", {scale: 0.5 + 0.5 * ease(out / 0.8), speed: r / 1.4});
    }
    return mk(at.x, at.z, angle + Math.sin(out * 1.7 + k) * 0.5, nest.water ? "swim" : "scan");
}

export class LiveBroods<E> {
    private broods = new Map<string, Live>();
    private read: ArkBroodsRead | null = null;
    private version = 0;
    private made = new WeakMap<ArkSnapshot, {version: number; roster: ArkSnapshot}>();
    private standIns: ArkAnimal[] = [];
    private parents = new Map<string, readonly string[]>();
    private acting = new Set<E>();
    private recruitIds = new Set<string>();
    /** The frame's own clock (s), for nothing but easing in what this page first sees. */
    private now = 0;
    tier: QualityTier = "high";

    constructor(private readonly host: LiveBroodsHost<E>) {}

    /** Whether there is anything to step or draw. */
    get size(): number {
        return this.broods.size;
    }

    /** The Ark day `day` on the shared clock (s), from the read's own pair of the two. */
    private epochOf(day: number | null): number {
        const read = this.read;
        const asOf = read?.as_of ? Date.parse(read.as_of) : NaN;
        if (day === null || !read || read.ark_day === null || !Number.isFinite(asOf)) return NaN;
        return (asOf + (day - read.ark_day) * ARK_DAY_MS) / 1000;
    }

    /** The read as the server gave it (decoded). A brood it no longer lists is gone at once. */
    set(read: ArkBroodsRead, epoch: number): void {
        this.read = read.on ? read : null;
        const next = new Map<string, Live>();
        if (read.on) {
            const rows: Array<[ArkBrood, boolean]> = [...read.broods.map((b): [ArkBrood, boolean] => [b, false]), ...read.ended.map((b): [ArkBrood, boolean] => [b, true])];
            for (const [brood, ended] of rows) {
                const before = this.broods.get(brood.id);
                const live: Live = before ?? {brood, ended, seenAt: epoch, endedAt: null, hatchAt: null, layAt: -Infinity, place: null, placed: false, size: 0.3, adult: 1, acts: new Map(), models: 0, sitter: null, recruits: [], last: new Map()};
                if (before) {
                    // Seen hatching (or born of a carried brood): the eggs split and the young come out now.
                    if (before.brood.stage !== "young" && brood.stage === "young" && !ended) live.hatchAt = epoch;
                    if (!before.ended && ended) live.endedAt = epoch;
                } else {
                    // (Seen for the first time: a clutch laid in the last minutes comes egg by egg; one already ended has stood empty since it ended.)
                    const laid = this.epochOf(brood.laid_ark_day);
                    if (brood.stage === "egg" && !ended && Number.isFinite(laid) && epoch - laid < 300) live.layAt = epoch;
                    if (ended) live.endedAt = Number.isFinite(this.epochOf(brood.ended_ark_day)) ? Math.min(this.epochOf(brood.ended_ark_day), epoch) : epoch;
                }
                live.brood = brood;
                live.ended = ended;
                this.noteLosses(live, epoch, !before);
                next.set(brood.id, live);
            }
        }
        // Whoever this layer was posing for a brood now gone: its own again.
        this.broods.forEach((gone, id) => {
            if (!next.has(id)) this.release(gone);
        });
        this.broods = next;
        this.placeAll();
        this.rebuild(epoch, true);
    }

    /** The read's losses this page has not met: each becomes an act (or, long over, nothing). */
    private noteLosses(live: Live, epoch: number, first: boolean): void {
        const brood = live.brood;
        const plan = this.host.plan(brood.model_slug);
        for (const loss of brood.losses) {
            if (live.acts.has(loss.id)) continue;
            const stage = arkBroodLossStage(brood, loss);
            const at = loss.atMs / 1000;
            if (loss.cause !== "taken") {
                // Gone with no cause: a fade where they are, from when this page reads it (never a replay of an old one).
                const fresh = !first && epoch - at < ACT_LATE * 4;
                live.acts.set(loss.id, {loss, stage, kind: fresh ? "quiet" : "none", t0: epoch, effectAt: fresh ? epoch + QUIET_FADE : -Infinity, span: QUIET_FADE});
                continue;
            }
            const t0 = arkActStart(at, loss.encounter?.t ?? null);
            if (!Number.isFinite(t0) || epoch - t0 > ACT_LATE || !loss.hunter) {
                live.acts.set(loss.id, {loss, stage, kind: "none", t0, effectAt: -Infinity, span: 0});
                continue;
            }
            const chase = stage === "young" && broodFlees(brood, plan);
            const feed = clamp(loss.count * RAID_PER, RAID_FEED_MIN, RAID_FEED_MAX);
            live.acts.set(loss.id, chase ? {loss, stage, kind: "meal", t0, effectAt: t0 + CATCH_GUESS, span: TAKEN_FADE} : {loss, stage, kind: "raid", t0, effectAt: t0 + RAID_WALK + feed, span: feed});
        }
    }

    /** Recruitment (a `birth` with `recruit: true`): these new animals take over from the brood's stand-ins where they stand. */
    recruited(broodId: string, ids: readonly string[]): void {
        const live = this.broods.get(broodId);
        if (!live) {
            // (Its brood was never drawn here: the new animals are simply there, with no entrance of a birth.)
            for (const id of ids) this.recruitIds.add(id);
            return;
        }
        for (const id of ids) {
            this.recruitIds.add(id);
            if (!live.recruits.some((r) => r.id === id)) live.recruits.push({id, from: null, since: null, done: false});
        }
        if (this.recruitIds.size > 500) this.recruitIds.delete(this.recruitIds.values().next().value as string);
    }

    /** A stand-in's parents (the brood's), for the young systems; null for any other id. */
    parentsOf(id: string): readonly string[] | null {
        return this.parents.get(id) ?? null;
    }

    /** Where a stand-in whose kind keeps its young at a spot lies: its brood's nest; null for any other id. */
    stayAt(id: string): Point | null {
        const place = this.broods.get(arkBroodOfMember(id) ?? "")?.place;
        return place ? {x: place.x, z: place.z} : null;
    }

    /** How near the camera may come to a point (m): close to a brood's nest, near enough to count its eggs; else `far`. */
    closeUp(x: number, z: number, far: number): number {
        let best = far;
        this.broods.forEach((live) => {
            const p = live.place;
            if (p && Math.abs(p.x - x) < 3 && Math.abs(p.z - z) < 3 && Math.hypot(p.x - x, p.z - z) < Math.max(live.size * 3, 0.6)) best = Math.min(best, Math.max(live.size * 2.2, 0.3));
        });
        return best;
    }

    /** Whether a new animal is a brood's recruit (it takes over from a stand-in: no entrance of its own). */
    isRecruit(id: string): boolean {
        return this.recruitIds.has(id);
    }

    /**
     * The parents whose home a brood's nest may be (the record copies the first parent's home slot onto the brood): the
     * scene gives the nest and its stand-ins that parent's own place when its slot is still the nest's, with no placement
     * of their own. For a stand-in's id or a `nest:<brood id>` key; null for any other.
     */
    homeOf(id: string): {parents: readonly string[]; zone: string; slot: number; rank: number; index: number} | null {
        const nestKey = id.startsWith("nest:") ? id.slice(5) : null;
        const brood = this.broods.get(nestKey ?? arkBroodOfMember(id) ?? "")?.brood;
        if (!brood?.nest) return null;
        return {parents: brood.parents, zone: brood.zone, slot: brood.nest.slot, rank: brood.nest.slot_rank, index: nestKey ? -1 : Number(id.slice(id.lastIndexOf(":") + 1)) || 0};
    }

    /** The parent a tap on a stand-in chooses (its carer, else its first parent), or null for any other id. */
    parentFor(id: string): string | null {
        const brood = this.broods.get(arkBroodOfMember(id) ?? "")?.brood;
        return brood ? brood.carer ?? brood.parents[0] ?? null : null;
    }

    /** Every animal an act of this layer needs drawn now: the hunters of takes about to be acted or under way. */
    pins(epoch: number): string[] {
        const out: string[] = [];
        this.broods.forEach((live) => {
            live.acts.forEach((act) => {
                if ((act.kind === "raid" || act.kind === "meal") && !act.over && act.loss.hunter && epoch > act.t0 - RAID_WALK - 60 && epoch < act.effectAt + RAID_BACK + 5) out.push(act.loss.hunter.id);
            });
        });
        return out;
    }

    /** WATCH (the camera director): every raid under way now is a hunt. */
    raids(epoch: number): Array<{predator: string; t0: number}> {
        const out: Array<{predator: string; t0: number}> = [];
        this.broods.forEach((live) => {
            live.acts.forEach((act) => {
                if (act.kind === "raid" && act.acted && !act.over && epoch >= act.t0 && epoch < act.effectAt + 2) out.push({predator: act.loss.hunter!.id, t0: act.t0});
            });
        });
        return out;
    }

    /** How many of a brood are there to be seen at `epoch`: the record's count, and the members of losses not yet acted. */
    private shown(live: Live, epoch: number, stage: "egg" | "young"): number {
        const brood = live.brood;
        // (A hatched brood's eggs are there only while they split: as many as hatched.)
        if (brood.stage !== stage) return stage === "egg" && brood.stage === "young" && !live.ended && live.hatchAt !== null && epoch < live.hatchAt + HATCH_GONE ? brood.stage_count : 0;
        let n = brood.count;
        live.acts.forEach((act) => {
            if (act.stage === stage && act.effectAt > epoch && act.kind !== "none") n += act.loss.count;
        });
        return n;
    }

    /**
     * The members of acts in their last `span` seconds: a raid's go one by one (`raid`: how many are gone already), the
     * others fade together (`fading`: how many, `k`: how far gone, 0..1).
     */
    private leaving(live: Live, epoch: number, stage: "egg" | "young"): {raid: number; fading: number; k: number} {
        const out = {raid: 0, fading: 0, k: 0};
        if (live.brood.stage !== stage) return out;
        live.acts.forEach((act) => {
            if (act.stage !== stage || act.kind === "none" || act.effectAt <= epoch || act.apart) return;
            const k = clamp(1 - (act.effectAt - epoch) / Math.max(act.span, 0.01), 0, 1);
            if (act.kind === "raid") out.raid += Math.floor(k * act.loss.count + 1e-6);
            else if (k > 0) {
                out.fading += act.loss.count;
                out.k = Math.max(out.k, k);
            }
        });
        return out;
    }

    /** The same as one number: how many fewer are drawn now. */
    private going(live: Live, epoch: number, stage: "egg" | "young"): number {
        const l = this.leaving(live, epoch, stage);
        return l.raid + l.fading * l.k;
    }

    private placeAll(): void {
        const asks: ArkAnimal[] = [];
        this.broods.forEach((live) => {
            if (live.placed || !live.brood.nest) return;
            asks.push(this.memberAnimal(live.brood, `nest:${live.brood.id}`, 0));
        });
        if (!asks.length) return;
        const places = this.host.place(asks);
        this.broods.forEach((live) => {
            if (live.placed) return;
            live.placed = true;
            let place = places.get(`nest:${live.brood.id}`) ?? null;
            const plan = this.host.plan(live.brood.model_slug);
            if (place?.water && (LAND_LAYER.test(plan ?? "") || plan === "bird")) {
                // A land-layer whose home is in the water (a duck, a turtle, a crocodile): its eggs on the shore beside it;
                // with no shore near, a bird's nest floats (a grebe's).
                const shore = this.host.shore?.(place.x, place.z) ?? null;
                if (shore) place = {...place, x: shore.x, z: shore.z, y: Math.max(this.host.ground(shore.x, shore.z), 0), water: false};
                else place = {...place, y: Math.max(place.y, place.top)};
            }
            const look = place ? broodEggLook(live.brood, plan, place.water) : null;
            if (place && !place.water && (look?.egg === "spawn" || (!look && WATER_PLAN.test(plan ?? "")))) {
                // Spawn is laid in water: the nearest to the parent's home.
                const wet = this.host.wet?.(place.x, place.z) ?? null;
                if (wet) place = {...place, x: wet.x, z: wet.z, y: this.host.ground(wet.x, wet.z), top: this.host.waterTop(wet.x, wet.z), water: true};
            }
            // A clump of frog spawn lies in the shallowest margin, a few centimetres deep, where the sun warms it (and clear of
            // the lily pads, which keep to water a hand deep and more: `decor.ts`, `decor-v2.ts`): from the spot toward the shore.
            const laid = place ? broodEggLook(live.brood, plan, place.water) : null;
            if (place?.water && laid?.egg === "spawn" && laid.layout === "clump") {
                const h = this.host;
                const depth = (x: number, z: number) => h.waterTop(x, z) - h.ground(x, z);
                const shore = depth(place.x, place.z) > SPAWN_SHALLOW ? h.shore?.(place.x, place.z) ?? null : null;
                const d = shore ? Math.hypot(shore.x - place.x, shore.z - place.z) : 0;
                for (let t = 0.1; shore && t <= d; t += 0.1) {
                    const x = place.x + ((shore.x - place.x) * t) / d;
                    const z = place.z + ((shore.z - place.z) * t) / d;
                    const deep = depth(x, z);
                    if (deep > SPAWN_SHALLOW) continue;
                    if (deep >= 0.03) place = {...place, x, z, y: h.ground(x, z), top: h.waterTop(x, z)};
                    break;
                }
            }
            // A ground-nester whose home is up on a perch or a limb (a plover, a duck): its scrape on the ground beneath.
            if (place && !place.water && broodEggLook(live.brood, plan, false)?.nest === "scrape") {
                const ground = this.host.ground(place.x, place.z);
                if (place.y > ground + 0.3) place = {...place, y: Math.max(ground, 0)};
            }
            live.place = place;
            live.adult = this.host.adultLength(live.brood);
            // (A clutch's size across: from the parent's length, with a floor so a small animal's is seen (as `clutchSize`), and
            // a mass of spawn larger the more eggs it holds.)
            const spawn = place && broodEggLook(live.brood, plan, place.water)?.egg === "spawn";
            live.size = clamp(live.adult * 0.5, 0.1, 1) * (spawn ? clamp(1 + Math.log10(Math.max(live.brood.start, 1)) / 3, 1, 3) : 1);
        });
    }

    private memberAnimal(brood: ArkBrood, id: string, rank: number): ArkAnimal {
        return {
            id,
            species_profile_id: brood.species_profile_id,
            kind_species_profile_id: brood.kind,
            name: brood.name,
            scientific_name: null,
            model_slug: brood.model_slug,
            zone: brood.zone as ArkZone,
            arrived_at: this.read?.as_of ?? "",
            brought_by: {label: "", named: false},
            mine: false,
            origin: "born",
            generation: 1,
            slot: brood.nest?.slot ?? null,
            slot_rank: (brood.nest?.slot_rank ?? 0) + rank,
            sociality: null,
            activity: null,
            island: brood.island,
            born_ark_day: brood.stage_ark_day
        } as ArkAnimal;
    }

    /** The roster's stand-ins worked out again (after a read, and when an act's members have gone). */
    private rebuild(epoch: number, force = false): void {
        const cap = BROOD_MODELS[this.tier];
        let left = BROOD_MODELS_MOST[this.tier];
        const list: ArkAnimal[] = [];
        const parents = new Map<string, readonly string[]>();
        let changed = force;
        // (Broods with a take to act first, then the same order for every viewer.)
        const order = Array.from(this.broods.values()).sort((a, b) => Number(this.pending(b)) - Number(this.pending(a)) || (unit(a.brood.id) - unit(b.brood.id)));
        for (const live of order) {
            const brood = live.brood;
            let n = 0;
            if (brood.stage === "young" && live.place && brood.nest && broodModels(brood, this.host.plan(brood.model_slug))) {
                // (An ended brood: its survivors wait for their recruits a while; any other only while its last members fade.)
                const handing = live.ended && brood.outcome === "independent";
                const waiting = handing && live.endedAt !== null && epoch - live.endedAt < HANDOVER_WAIT;
                // (As many as became animals, where the read says; the others have gone with their own loss, "did not settle".)
                if (handing && live.handing === undefined) live.handing = Math.min(live.models, brood.recruited ?? (brood.count > 0 ? brood.count : live.models));
                const shown = handing ? (waiting ? Math.max(live.handing ?? 0, 0) - live.recruits.filter((r) => r.since !== null).length : 0) : Math.min(this.shown(live, epoch, "young"), brood.stage_count);
                n = Math.max(Math.min(shown, cap, left), 0);
            }
            left -= n;
            if (n !== live.models) changed = true;
            live.models = n;
            for (let i = 0; i < n; i++) {
                const id = arkBroodMemberId(brood.id, i);
                list.push(this.memberAnimal(brood, id, 1 + i));
                // (The young keep to the parent the record says attends them; with none attending, to their parents as the scene picks.)
                parents.set(id, brood.carer ? [brood.carer] : brood.parents);
            }
        }
        if (!changed) return;
        this.standIns = list;
        this.parents = parents;
        this.version++;
        this.host.relayout();
    }

    private pending(live: Live): boolean {
        let any = false;
        live.acts.forEach((act) => {
            if (!act.over && (act.kind === "raid" || act.kind === "meal")) any = true;
        });
        return any;
    }

    /** The roster the scene lays out: the read's animals and this layer's stand-ins (the same object while neither changes). */
    roster(base: ArkSnapshot): ArkSnapshot {
        if (!this.standIns.length) return base;
        const known = this.made.get(base);
        if (known && known.version === this.version) return known.roster;
        const aboard = new Set(base.animals.map((a) => a.id));
        const adults = new Map(base.animals.map((a) => [a.id, a]));
        const extra = this.standIns.filter((a) => !aboard.has(a.id)).map((a) => {
            // (Its day is its parent's kind of day.)
            const parent = (this.parents.get(a.id) ?? []).map((id) => adults.get(id)).find(Boolean);
            return parent ? {...a, sociality: parent.sociality ?? null, activity: parent.activity ?? null, thrive: parent.thrive ?? null} : a;
        });
        const roster = extra.length ? {...base, animals: [...base.animals, ...extra]} : base;
        this.made.set(base, {version: this.version, roster});
        return roster;
    }

    private release(live: Live): void {
        if (live.sitter) {
            const e = this.host.find(live.sitter.id);
            if (e) this.host.setAct(e, null);
            live.sitter = null;
        }
    }

    clear(): void {
        this.acting.forEach((e) => this.host.setAct(e, null));
        this.acting.clear();
        this.broods.clear();
        if (this.standIns.length) {
            this.standIns = [];
            this.parents = new Map();
            this.version++;
            this.host.relayout();
        }
    }

    /**
     * One frame at `epoch` (s, the shared clock): the acts' poses, and what is drawn within `reach` metres of `view`
     * (the eggs and the specks are small: beyond it nothing of them could be seen).
     */
    step(epoch: number, sink: BroodSink, view: Point | null, reach: number, still = false): void {
        const h = this.host;
        this.now = epoch;
        const acting = new Set<E>();
        // (`still`: reduced motion. Everything is drawn as the record has it, the parent on its eggs; nothing is acted: no
        // raid's walk, no chase, no hatching or hand-over; what is taken or lost is simply gone at its time.)
        const pose = (entry: E | null, act: ActPose | null, moving = true): boolean => {
            if (!entry || !act || (still && moving) || h.busy(entry)) return false;
            h.setAct(entry, act);
            acting.add(entry);
            return true;
        };
        let dirty = false;
        const speckCap = BROOD_SPECKS[this.tier];
        this.broods.forEach((live) => {
            const brood = live.brood;
            const nest = live.place;
            if (!nest) return;
            const plan = h.plan(brood.model_slug);
            const near = !view || Math.hypot(nest.x - view.x, nest.z - view.z) < reach;
            // (Up off the ground: whoever is posed at the nest is posed on its surface.)
            const raised = !nest.water && nest.y > h.ground(nest.x, nest.z) + 0.2;
            const seat = (p: ActPose | null): ActPose | null => (p && raised && Math.abs(p.base - nest.y) < Math.max(0.15, live.adult * 0.15) && p.state !== "walk" && p.state !== "fly" ? onSurface(p) : p);
            // The takes: a chase handed to `live-meals`, or a raid acted here.
            let raided: LossAct | null = null;
            live.acts.forEach((act) => {
                if (act.over || act.kind === "none" || act.kind === "quiet") {
                    if (act.kind === "quiet" && !act.over && epoch >= act.effectAt) {
                        act.over = true;
                        dirty = true;
                    }
                    return;
                }
                const hunter = h.find(act.loss.hunter!.id);
                if (act.kind === "meal") {
                    if (!act.sent && !still && epoch >= act.t0 - RAID_WALK - 20) {
                        act.sent = true;
                        // The eaten one: the last of its drawn stand-ins when the take leaves fewer than are drawn; else one of the crowd.
                        const after = this.shown(live, epoch, "young") - act.loss.count;
                        act.prey = after < live.models ? arkBroodMemberId(brood.id, live.models - 1) : `${ARK_BROOD_MEMBER_PREFIX}${brood.id}:x${act.loss.id}`;
                        h.addMeals([this.mealOf(live, act)]);
                    }
                    const at = act.prey ? h.catchAt(act.loss.hunter!.id, act.prey) : null;
                    if (at !== null && Math.abs(at - act.effectAt) > 0.01 && epoch < act.effectAt) act.effectAt = at;
                    if (at === null && act.sent && !still && epoch >= act.t0 + 1 && epoch < act.t0 + 3) {
                        // `live-meals` has no chase for it (a fox cannot follow ducklings onto the water): the take is a raid where the brood is.
                        h.dropMeal(act.loss.hunter!.id, act.prey!);
                        const feed = clamp(act.loss.count * RAID_PER, RAID_FEED_MIN, RAID_FEED_MAX);
                        Object.assign(act, {kind: "raid", t0: epoch, effectAt: epoch + RAID_WALK + feed, span: feed});
                    } else {
                        if (epoch >= act.effectAt) {
                            act.over = true;
                            dirty = true;
                        }
                        return;
                    }
                }
                // A raid.
                const s = epoch - act.t0;
                if (s >= 0 && s < act.effectAt - act.t0 + 2) raided = act;
                if (s < 0) return;
                if (epoch >= act.effectAt && !act.acted) {
                    // (Its hunter never came into the scene: the members are gone all the same, as the record says.)
                    act.over = true;
                    dirty = true;
                    return;
                }
                if (!act.at) {
                    // (Young that go about with a parent are raided where they are with it; eggs and the rest at the nest.)
                    const with_ = act.stage === "young" && brood.carer && brood.care !== "nest" && brood.care !== "none" ? h.find(brood.carer) : null;
                    const b = with_ ? h.body(with_) : null;
                    const wet = (x: number, z: number) => h.waterTop(x, z) > h.ground(x, z) + 0.05;
                    act.at = b ? {...nest, x: b.x, z: b.z, y: b.base, water: wet(b.x, b.z)} : nest;
                    if (b && act.at.water && hunter && !h.flies(hunter) && !h.swims?.(hunter)) {
                        // (A fox does not walk on a pond: it takes them where the record has the take, on dry ground.)
                        const spot = act.loss.encounter?.prey ?? null;
                        const dry = spot && !wet(spot.x, spot.z) ? spot : !nest.water ? nest : h.shore?.(b.x, b.z) ?? null;
                        if (dry) {
                            act.at = {...nest, x: dry.x, z: dry.z, y: Math.max(h.ground(dry.x, dry.z), 0), top: h.waterTop(dry.x, dry.z), water: false};
                            act.apart = {from: new Map()};
                        }
                    }
                }
                if (hunter) {
                    if (act.from === undefined) act.from = h.scheduleAt(hunter, act.t0);
                    const body = h.body(hunter);
                    const p = raidPose(s, act.effectAt - act.t0 - RAID_WALK, act.from, h.scheduleAt(hunter, epoch), act.at, body.length, live.size, h.walk(hunter), h.flies(hunter), h.ground);
                    if (p) {
                        if (pose(hunter, act.at === nest ? seat(p) : p)) act.acted = true;
                    } else if (s > RAID_WALK) act.over = true;
                }
                if (epoch >= act.effectAt + RAID_BACK) act.over = true;
                if (epoch >= act.effectAt) dirty = true;
            });
            // The eggs and whoever attends them.
            const look = broodEggLook(brood, plan, nest.water);
            // (A nest is there under its eggs, and under nestlings; an ended one stands empty a while.)
            const wasEgg = brood.stage === "egg" || (brood.stage === "young" && brood.laid_ark_day !== null && brood.stage_ark_day !== null && brood.laid_ark_day < brood.stage_ark_day);
            const nested = brood.stage === "egg" || (wasEgg && (brood.care === "nest" || (live.hatchAt !== null && epoch < live.hatchAt + HATCH_STAY)));
            const carer = !live.ended && brood.stage === "egg" && brood.carer && brood.hold && look ? brood.carer : null;
            // (Only where it can be seen: an act keeps its animal drawn one by one with its model in, and a parent on a nest
            // across the island is a speck. Beyond the camera's reach it goes about its day; coming into reach it is on its
            // eggs at once, and it walks back onto them only after something nearer had it, or as the clutch is laid.)
            if (carer && !near) {
                if (live.sitter) this.release(live);
            } else if (carer) {
                const entry = h.find(carer);
                const held = entry ? h.busy(entry) : false;
                if (held) live.heldAt = epoch;
                if (entry && !held) {
                    const body = h.body(entry);
                    const walks = (live.heldAt !== undefined && epoch - live.heldAt < 2) || (live.layAt > -Infinity && epoch - live.layAt < 10);
                    if (!live.sitter || live.sitter.id !== carer) live.sitter = {id: carer, since: walks ? epoch : epoch - SETTLE, from: body};
                    const water = nest.water || WATER_PLAN.test(plan ?? "");
                    let to = carerPose(brood.hold!, water, nest, body.length, brood.id, still ? 0 : epoch);
                    if (raided) {
                        // A raider at its eggs: it gives way, off to the far side, facing the nest.
                        const act = raided as LossAct;
                        const dir = act.from ? Math.atan2(nest.x - act.from.x, nest.z - act.from.z) : nest.yaw;
                        const off = Math.max(body.length * 2.2, live.size * 2);
                        to = {...to, x: nest.x + Math.sin(dir) * off, z: nest.z + Math.cos(dir) * off, yaw: dir + Math.PI, pitch: 0, state: water ? "swim" : "scan", base: water ? to.base : h.ground(nest.x + Math.sin(dir) * off, nest.z + Math.cos(dir) * off)};
                        live.sitter = {id: carer, since: epoch - SETTLE * 0.6, from: {...body, x: to.x, z: to.z, base: to.base}};
                    }
                    const k = (epoch - live.sitter.since) / SETTLE;
                    if (k < 1 && !raided && !still) {
                        // Back onto them from where something else left it.
                        const from = live.sitter.from;
                        const e = ease(k);
                        const d = Math.hypot(to.x - from.x, to.z - from.z);
                        to = {...to, x: from.x + (to.x - from.x) * e, z: from.z + (to.z - from.z) * e, base: from.base + (to.base - from.base) * e, yaw: d > 0.05 ? Math.atan2(to.x - from.x, to.z - from.z) : to.yaw, pitch: 0, state: d > 0.05 ? (water ? "swim" : "walk") : to.state, speed: d / SETTLE};
                    }
                    pose(entry, seat(to), false);
                } else {
                    live.sitter = null;
                    // Resting out of sight by the live budget: a figure of it on its eggs, as the resting are drawn.
                    if (!entry && near && !raided) {
                        const p = carerPose(brood.hold!, nest.water || WATER_PLAN.test(plan ?? ""), nest, live.adult, brood.id, epoch);
                        sink.speck(broodSpeck(plan, nest.water) === "tadpole" ? "grub" : broodSpeck(plan, nest.water), brood.model_slug, p.x, p.base, p.z, p.yaw, live.adult, 1);
                    }
                }
            } else if (live.sitter) this.release(live);
            if (nested && look && near) this.drawEggs(live, look, epoch, sink);
            // The young: the hatchlings' first seconds, the fades, the hand-over, and the specks.
            if (brood.stage !== "young") return;
            const hatch = live.hatchAt !== null ? epoch - live.hatchAt : Infinity;
            const shown = Math.min(this.shown(live, epoch, "young"), brood.stage_count);
            const leaving = this.leaving(live, epoch, "young");
            const going = leaving.raid + leaving.fading * leaving.k;
            const handing = live.ended && brood.outcome === "independent";
            // (Nestlings and a litter kept at the nest lie in it, unless its kind's own ways already keep its young at a spot: `young-ways.ts`.)
            const inNest = brood.care === "nest" && !waysOf(brood.model_slug)?.stay;
            // A take acted apart (`LossAct.apart`): its members are the last stand-ins drawn (and specks beyond them), at its place.
            let apart: LossAct | null = null;
            live.acts.forEach((act) => {
                if (!apart && act.apart && act.at && act.stage === "young" && !act.over && epoch >= act.t0 && epoch < act.effectAt) apart = act;
            });
            const away = apart as LossAct | null;
            const awayCount = away ? away.loss.count : 0;
            const awayModels = Math.min(awayCount, live.models);
            const awayTaken = away ? Math.floor(clamp(1 - (away.effectAt - epoch) / Math.max(away.span, 0.01), 0, 1) * awayCount + 1e-6) : 0;
            const groupShown = shown - awayCount;
            for (let i = 0; i < live.models; i++) {
                const id = arkBroodMemberId(brood.id, i);
                const entry = h.find(id);
                if (!entry) continue;
                if (away && i >= live.models - awayModels) {
                    // Taken apart: it comes to the take's place from the brood, waits there, and goes as the hunter feeds.
                    const j = live.models - 1 - i;
                    const at = away.at!;
                    if (!away.apart!.from.has(id)) away.apart!.from.set(id, live.last.get(id) ?? h.body(entry));
                    const from = away.apart!.from.get(id)!;
                    // (Just past the place, as the hunter faces it (`raidPose`: its head is over the place): in front of it, side by side.)
                    const dir = away.from && Math.hypot(at.x - away.from.x, at.z - away.from.z) > 0.05 ? Math.atan2(at.x - away.from.x, at.z - away.from.z) : at.yaw;
                    const ahead = live.size * (0.45 + 0.2 * (j % 2));
                    const side = (j - (awayModels - 1) / 2) * live.size * 0.4;
                    const spot = {x: at.x + Math.sin(dir) * ahead + Math.cos(dir) * side, z: at.z + Math.cos(dir) * ahead - Math.sin(dir) * side};
                    const far = Math.hypot(spot.x - from.x, spot.z - from.z);
                    const u = far > 40 ? 1 : clamp((epoch - away.t0) / (RAID_WALK * 0.8), 0, 1);
                    const e = ease(u);
                    const x = from.x + (spot.x - from.x) * e;
                    const z = from.z + (spot.z - from.z) * e;
                    const swim = h.waterTop(x, z) > h.ground(x, z) + 0.05;
                    const body: BroodBody = {x, z, base: swim ? Math.max(h.waterTop(x, z), from.base) : h.ground(x, z), yaw: u < 1 && far > 0.05 ? Math.atan2(spot.x - from.x, spot.z - from.z) : dir + Math.PI * (0.6 + 0.8 * (j % 2)), length: 0};
                    live.last.set(id, body);
                    const gone = j < awayTaken;
                    const pop = far > 40 ? ease((epoch - away.t0) / 0.8) : 1;
                    pose(entry, {x: body.x, z: body.z, base: body.base, yaw: body.yaw, pitch: 0, roll: 0, scale: gone ? 0.02 : Math.max(pop, 0.02), dim: 0, hidden: gone, state: gone ? "rest" : u < 1 ? (swim ? "swim" : "walk") : "scan", speed: u < 1 ? far / (RAID_WALK * 0.8) : 0});
                    continue;
                }
                if (hatch < HATCH_STAY && wasEgg) {
                    pose(entry, seat(hatchPose(hatch, i, live.models, nest, live.size)));
                    continue;
                }
                // (The last ones are the ones that go: a raid's are gone one by one, the others fade together.)
                const k = handing ? 1 : i >= groupShown - leaving.raid ? 0 : i >= groupShown - leaving.raid - leaving.fading ? 1 - leaving.k : 1;
                if (k < 1) {
                    // Going (a loss with no cause, or taken with the one that was chased): it fades where it is.
                    const body = live.last.get(id) ?? h.body(entry);
                    pose(entry, {x: body.x, z: body.z, base: body.base, yaw: body.yaw, pitch: 0, roll: 0, scale: Math.max(k, 0.02), dim: 1 - k, hidden: k <= 0.02, state: "rest", speed: 0});
                    continue;
                }
                if (inNest && !handing && near) {
                    const angle = (i / Math.max(live.models, 1)) * Math.PI * 2 + unit(brood.id) * 6.283;
                    const r = live.models > 1 ? live.size * 0.2 : 0;
                    const at: BroodBody = {x: nest.x + Math.sin(angle) * r, z: nest.z + Math.cos(angle) * r, base: nest.y + (look?.nest === "nest" && wasEgg ? live.size * 0.06 : 0), yaw: angle, length: 0};
                    // (Each lifts its head now and then, in its own time.)
                    pose(entry, seat({x: at.x, z: at.z, base: at.base, yaw: at.yaw + (still ? 0 : Math.sin(epoch * 0.8 + i * 2.1) * 0.25), pitch: still ? 0 : Math.max(Math.sin(epoch * 1.1 + i * 1.7), 0) * 0.18, roll: 0, scale: 1, dim: 0, hidden: false, state: "rest", speed: 0}), false);
                    live.last.set(id, at);
                    continue;
                }
                live.last.set(id, h.body(entry));
            }
            // Recruits: each takes its stand-in's place, then goes to its own.
            if (handing) {
                for (const r of live.recruits) {
                    if (r.done) continue;
                    const entry = h.find(r.id);
                    if (!entry) continue;
                    if (r.since === null) {
                        const k = live.recruits.filter((x) => x.since !== null).length;
                        r.from = live.last.get(arkBroodMemberId(brood.id, k)) ?? null;
                        r.since = epoch;
                        dirty = true;
                    }
                    const u = (epoch - r.since) / HANDOVER;
                    if (u >= 1 || !r.from) {
                        r.done = true;
                        continue;
                    }
                    const own = h.scheduleAt(entry, epoch);
                    const to = own ?? {x: r.from.x, z: r.from.z, y: r.from.base, yaw: r.from.yaw};
                    const e = ease(u);
                    const d = Math.hypot(to.x - r.from.x, to.z - r.from.z);
                    pose(entry, {x: r.from.x + (to.x - r.from.x) * e, z: r.from.z + (to.z - r.from.z) * e, base: r.from.base + (to.y - r.from.base) * e, yaw: d > 0.05 ? Math.atan2(to.x - r.from.x, to.z - r.from.z) : r.from.yaw, pitch: 0, roll: 0, scale: 1, dim: 0, hidden: false, state: d > 0.05 ? (nest.water ? "swim" : "walk") : "scan", speed: d / HANDOVER});
                }
                if (live.endedAt !== null && epoch - live.endedAt >= HANDOVER_WAIT && live.models) dirty = true;
            }
            if (live.ended) return;
            if (!near) {
                // (Young that go about with a parent are drawn where it is, however far from the nest.)
                const with_ = view && brood.carer && brood.care !== "nest" && brood.care !== "none" ? h.find(brood.carer) : null;
                const b = with_ ? h.body(with_) : null;
                if (!b || Math.hypot(b.x - view!.x, b.z - view!.z) >= reach) return;
            }
            // The specks: whoever of the count is not drawn with a model (a model stand-in the budget rests is a speck too).
            let models = 0;
            for (let i = 0; i < live.models - awayModels; i++) if (h.out(arkBroodMemberId(brood.id, i))) models++;
            const rest = Math.max(groupShown - going - models, 0);
            const drawn = Math.min(broodDrawn(Math.ceil(rest), Math.max(brood.stage_count - models, 1), speckCap), Math.ceil(rest));
            if (drawn > 0) this.drawSpecks(live, plan, drawn, rest, wasEgg && !still ? hatch : Infinity, still ? 0 : epoch, sink);
            // (A take apart of more than the stand-ins drawn: the rest of its members huddled at its place, going as it feeds.)
            const awaySpecks = Math.max(awayCount - awayModels - Math.max(awayTaken - awayModels, 0), 0);
            if (away && awaySpecks > 0) this.drawSpecks(live, plan, Math.min(awaySpecks, speckCap), Math.min(awaySpecks, speckCap), Infinity, still ? 0 : epoch, sink, away.at!);
        });
        // Whoever it posed last frame and not now: its own again.
        this.acting.forEach((e) => {
            if (!acting.has(e)) h.setAct(e, null);
        });
        this.acting = acting;
        if (dirty) this.rebuild(epoch);
    }

    private mealOf(live: Live, act: LossAct): MealAct {
        const brood = live.brood;
        const hunter = act.loss.hunter!;
        const blank = {arrived_at: null, generation: null, activity: null, sociality: null, status: null};
        const predator: ArkEventAnimal = {...blank, id: hunter.id, species_profile_id: hunter.species_profile_id, name: hunter.name, model_slug: hunter.model_slug, zone: brood.zone as ArkZone, origin: null, slot: null, slot_rank: null, island: brood.island};
        const prey = {...blank, id: act.prey!, species_profile_id: brood.species_profile_id, name: brood.name, model_slug: brood.model_slug, zone: brood.zone as ArkZone, origin: "born" as const, generation: 1, slot: brood.nest?.slot ?? null, slot_rank: (brood.nest?.slot_rank ?? 0) + 1, island: brood.island, born_ark_day: brood.stage_ark_day} as ArkEventAnimal;
        return {kind: "meal", at: act.loss.at, predator, prey, phrase: null, extinct: false, ...(act.loss.encounter ? {encounter: act.loss.encounter} : {})};
    }

    private drawEggs(live: Live, look: NonNullable<ReturnType<typeof broodEggLook>>, epoch: number, sink: BroodSink): void {
        const brood = live.brood;
        const nest = live.place!;
        const size = live.size;
        const failed = live.ended;
        const since = live.endedAt !== null ? epoch - live.endedAt : 0;
        // An ended clutch: its nest stands empty, then fades; spawn with nothing under it is simply gone.
        if (failed && (since > NEST_EMPTY_SECONDS + NEST_FADE || !look.nest)) return;
        const alpha = failed ? 1 - clamp((since - NEST_EMPTY_SECONDS) / NEST_FADE, 0, 1) : 1;
        // (A clump of spawn floats at the top, its upper beads breaking the surface; a string lies just under it in the weed;
        // a patch lies on the bed.)
        const y = nest.water && look.egg === "spawn" ? (look.layout === "patch" ? nest.y + 0.01 : Math.max(nest.top - size * (look.layout === "clump" ? 0.125 : 0.07), nest.y + 0.01)) : nest.y;
        if (look.nest) sink.nest(look.nest, nest.x, y, nest.z, size, alpha);
        if (failed) return;
        const hatch = live.hatchAt !== null ? epoch - live.hatchAt : -1;
        const of = Math.max(brood.start, 1);
        const left = Math.max(Math.min(this.shown(live, epoch, "egg"), of) - this.going(live, epoch, "egg"), 0);
        const all = broodDrawn(of, of, look.cap);
        const n = Math.min(broodDrawn(Math.ceil(left), of, look.cap), all);
        if (look.egg === "sac") {
            if (n > 0) sink.egg("sac", nest.x, y + size * 0.18, nest.z, size * 0.36, 0);
            return;
        }
        const seed = unit(brood.id);
        if (!live.spots || live.spots.all !== all || live.spots.layout !== look.layout) {
            const at = new Float32Array(all * 3);
            for (let k = 0; k < all; k++) {
                const p = eggSpot(look.layout, k, all, seed);
                at[k * 3] = p.x;
                at[k * 3 + 1] = p.y;
                at[k * 3 + 2] = p.z;
            }
            live.spots = {all, layout: look.layout, at};
        }
        const spots = live.spots.at;
        const bead = look.egg === "spawn" ? size * (look.layout === "string" ? 0.07 : 0.085) : size * clamp(0.62 / Math.sqrt(Math.max(all, 1)), 0.1, 0.2);
        for (let k = 0; k < n; k++) {
            const px = spots[k * 3];
            const py = spots[k * 3 + 1];
            const pz = spots[k * 3 + 2];
            // Coming one by one as she lays; rocking, then split and gone, as they hatch.
            let s = 1;
            let roll = 0;
            if (live.layAt > -Infinity) {
                const own = (epoch - live.layAt - (k / Math.max(n, 1)) * LAY_SECONDS) / 0.3;
                s = own <= 0 ? 0 : own >= 1 ? 1 : 1 + 0.25 * Math.sin(own * Math.PI);
            }
            if (hatch >= 0) {
                roll = hatch < HATCH_ROCK ? Math.sin(hatch * 22 + k) * 0.35 * (hatch / HATCH_ROCK) : 0;
                if (hatch >= HATCH_ROCK) s *= 1 - clamp((hatch - HATCH_ROCK) / (HATCH_GONE - HATCH_ROCK), 0, 1);
            }
            if (s <= 0.001) continue;
            sink.egg(look.egg, nest.x + px * size, y + bead * 0.45 + py * size + (look.nest === "nest" ? size * 0.06 : 0), nest.z + pz * size, bead * s, roll);
        }
    }

    private drawSpecks(live: Live, plan: string | null, drawn: number, rest: number, hatch: number, epoch: number, sink: BroodSink, apartAt?: BroodPlace): void {
        const h = this.host;
        const brood = live.brood;
        // (`apartAt`: a take's place away from the brood: its members huddled there, on dry ground.)
        const nest = apartAt ?? live.place!;
        const water = !apartAt && (nest.water || WATER_PLAN.test(plan ?? ""));
        const look = broodSpeck(plan, nest.water || WATER_PLAN.test(plan ?? ""));
        // (A member's drawn length: a newborn's share of the adult's, as the young's own scale has it, with a floor so it is seen.)
        const length = Math.max(live.adult * (look === "tadpole" || look === "grub" ? 0.22 : 0.3), Math.min(0.025, live.adult * 0.45));
        const carerEntry = !apartAt && brood.carer && (brood.care === "follow" || brood.care === "carry" || brood.care === "guard") ? h.find(brood.carer) : null;
        const anchor = carerEntry ? h.body(carerEntry) : null;
        const pop = hatch < HATCH_GONE + 1 ? ease((hatch - HATCH_ROCK) / 1.2) : 1;
        if (pop <= 0) return;
        const seed = unit(brood.id);
        if (!live.rand || live.rand.length < drawn * 2) {
            const made = new Float32Array(Math.max(drawn, 16) * 2);
            for (let k = 0; k < made.length / 2; k++) {
                made[k * 2] = unit(`${brood.id}:${k}`);
                made[k * 2 + 1] = unit(`${brood.id}:${k}:b`);
            }
            live.rand = made;
        }
        const rand = live.rand;
        for (let k = 0; k < drawn; k++) {
            // (The last one fades as a part-count goes.)
            const fade = k === drawn - 1 ? clamp(rest - (drawn - 1), 0.05, 1) : 1;
            const a = rand[k * 2];
            const b = rand[k * 2 + 1];
            let x: number;
            let z: number;
            let y: number;
            let yaw: number;
            if (water) {
                // A school: round a slow-moving middle over the nest, each on its own loop, all heading one way.
                const turn = epoch * 0.18 + seed * 6.283;
                const cx = nest.x + Math.cos(turn) * live.size * 1.4;
                const cz = nest.z + Math.sin(turn) * live.size * 1.4;
                const r = length * (1.2 + 2.6 * Math.sqrt((k + 0.5) / Math.max(drawn, 1)));
                const phase = a * 6.283 + epoch * (0.5 + b * 0.5);
                x = cx + Math.cos(phase) * r;
                z = cz + Math.sin(phase) * r * 0.7;
                const top = h.waterTop(x, z);
                const bed = h.ground(x, z);
                y = Math.min(Math.max(bed + length * (0.6 + b * 2.5), bed + 0.01), Math.max(top - length * 0.8, bed + 0.01));
                yaw = turn + Math.PI / 2 + Math.sin(phase) * 0.5;
            } else if (anchor) {
                // A trail behind the carer: rows of three, each wobbling in its place.
                const row = 1 + Math.floor(k / 3);
                const col = (k % 3) - 1;
                const back = anchor.length * 0.55 + row * length * 1.5;
                const side = col * length * 1.1 + Math.sin(epoch * 1.3 + a * 6.283) * length * 0.25;
                x = anchor.x - Math.sin(anchor.yaw) * back + Math.cos(anchor.yaw) * side;
                z = anchor.z - Math.cos(anchor.yaw) * back - Math.sin(anchor.yaw) * side;
                y = h.ground(x, z);
                yaw = anchor.yaw + Math.sin(epoch * 0.9 + b * 6.283) * 0.3;
            } else {
                // A cluster at the nest, each shifting a little.
                const angle = k * 2.39996 + seed * 6.283;
                const r = (live.size * 0.35 + length * 0.9 * Math.sqrt(drawn)) * Math.sqrt((k + 0.5) / Math.max(drawn, 1));
                x = nest.x + Math.cos(angle) * r + Math.sin(epoch * 0.6 + a * 6.283) * length * 0.2;
                z = nest.z + Math.sin(angle) * r + Math.cos(epoch * 0.5 + b * 6.283) * length * 0.2;
                y = Math.abs(nest.y - h.ground(nest.x, nest.z)) > 0.05 ? nest.y : h.ground(x, z);
                yaw = angle + Math.sin(epoch * 0.4 + a * 9) * 0.8;
            }
            sink.speck(look, brood.model_slug, x, y, z, yaw, length, pop * fade);
        }
    }

    /** Development (the broods harness): each brood as it is drawn now. */
    debug(epoch = this.now): Array<{id: string; stage: string; ended: boolean; count: number; eggs: number; young: number; models: number; place: BroodPlace | null; size: number; sitter: string | null; acts: Array<{id: string; kind: string; stage: string; t0: number; effectAt: number; acted: boolean; over: boolean; prey: string | null}>}> {
        return Array.from(this.broods.values()).map((live) => ({
            id: live.brood.id,
            stage: live.brood.stage,
            ended: live.ended,
            count: live.brood.count,
            eggs: Math.max(this.shown(live, epoch, "egg") - this.going(live, epoch, "egg"), 0),
            young: live.brood.stage === "young" ? Math.max(this.shown(live, epoch, "young") - this.going(live, epoch, "young"), 0) : 0,
            models: live.models,
            place: live.place,
            size: live.size,
            sitter: live.sitter?.id ?? null,
            acts: Array.from(live.acts.values()).map((a) => ({id: a.loss.id, kind: a.kind, stage: a.stage, t0: a.t0, effectAt: a.effectAt, acted: Boolean(a.acted || a.sent), over: Boolean(a.over), prey: a.prey ?? null}))
        }));
    }
}
