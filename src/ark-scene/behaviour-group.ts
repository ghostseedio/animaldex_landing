/**
 * Group life (lane SIG-GROUP, 2026-11-20; behaviours plan P5, catalogue theme "group life"): what the animals of one
 * group do TOGETHER, drawn only from animals actually aboard together. A group is the server's own placement (a leader
 * and its members, `ScheduleGroup`); nothing here draws an ambient flock-mate: a species with two of its kind aboard in
 * one group can huddle, post a sentinel, gather at its roost or lick clay, one alone does none of it.
 *
 * Every act is a window of world time seeded by the group's leader (`windowOf`), so every member of the group (and
 * every viewer) agrees on it without talking: a member whose slot starts inside the window takes the act as its goal
 * (`groupIntent`, asked by `behaviour-schedule.ts` before the group's own turn at the watch), others go on with their
 * day. Pure in ids and the time, like the rest of the schedule.
 *
 *   huddle    by day, in rest windows, the group presses into one tight cluster (its members each a place of their own
 *             round the cluster's middle), resting: sheep, guinea pigs, peccaries, otters, capybaras;
 *   sentinel  one member at a time (in turn, by window) stands on the group's vantage (a rock, a log, a post, a
 *             branch) scanning while the others feed: crows, mallards, meerkats, prairie dogs, marmots, alpacas;
 *   gather    in the last hour of the day the group is already at its roost, calling, before it sleeps: sparrows,
 *             mynas, parrots, kites, crows (the roost itself is `sleep.ts`: `roost:` below);
 *   lick      in a morning window the flock lands together on a bare bank to eat soil: African grey parrots, macaws;
 *   chorus    in a window the whole group calls where it stands, heads up, one starting and the rest joining: magpies at
 *             dawn, wolves at dusk, laughingthrushes;
 *   feast     in a window the group converges on one fruiting tree (a branch near its home) and eats there together: macaques,
 *             starlings, bulbuls;
 *   basking   in a day window the group basks stacked on one log or rock by the water: sliders;
 *   commute   a flock's day is at a feeding patch some way from its roost (it flies out after dawn, back at dusk by its
 *             own roost trip): budgerigars, lovebirds, pigeons, macaws, geese;
 *   tight     in flight the whole flock keeps close (half the usual spread round its leader): lorikeets, conures;
 *   pairs     in flight each pair of a flock flies wing to wing (`pairSide`, used by the schedule's flock shadow);
 *   roost:X   how the group sleeps together (huddle, pile, row, cluster), read by `sleep.ts` when the species' own
 *             sleep text says nothing of it.
 *
 * The species and the stored sentence behind each: `data/ark/group-behaviours.json` (made into `group-acts.json` by
 * `scripts/ark-group-behaviours.mts`). Visual only: nothing here decides anything in the Ark.
 */

import table from "@/ark-scene/group-acts.json";
import {hashString} from "@/ark-scene/world";
import type {ArkBehaviourProfile} from "@/ark-scene/behaviour-profile";
import type {ScheduleAnimal, ScheduleWorld, Spot, TripMode} from "@/ark-scene/behaviour-schedule";
import type {ScheduleKit} from "@/ark-scene/behaviour-recipes";
import type {AttachTag} from "@/ark-scene/world-sampler";

export type GroupActId = "huddle" | "sentinel" | "gather" | "lick" | "chorus" | "feast" | "basking" | "commute" | "pairs" | "tight" | "roost";
export type GroupAct = {id: GroupActId; arg: string | null};
export type RoostSocial = "huddle" | "pile" | "row" | "cluster";

const DATA = table as unknown as {lives: string[]; species: Record<string, string>};
const LIVES = new Set(DATA.lives);
const parsed = new Map<string, readonly GroupAct[]>();
const NONE: readonly GroupAct[] = Object.freeze([]);
const KNOWN = new Set<string>(["huddle", "sentinel", "gather", "lick", "chorus", "feast", "basking", "commute", "pairs", "tight", "roost"]);

/** A species' group acts (`huddle`, `sentinel:3`, `roost:row` …), in the order they are tried. */
export function groupActsOf(slug: string): readonly GroupAct[] {
    let hit = parsed.get(slug);
    if (!hit) {
        const row = DATA.species[slug];
        hit = row
            ? Object.freeze(
                  row
                      .split(" ")
                      .filter(Boolean)
                      .map((token) => {
                          const [id, arg] = token.split(":");
                          return {id: id as GroupActId, arg: arg ?? null};
                      })
                      .filter((a) => KNOWN.has(a.id))
              )
            : NONE;
        parsed.set(slug, hit);
    }
    return hit;
}

/**
 * A species whose own stored text has it living in groups though its profile says otherwise (a guinea pig is "solitary"
 * in the profile, its text has it huddling): the scene groups it round its leader like the species that flock or herd.
 */
export function groupLives(slug: string): boolean {
    return LIVES.has(slug);
}

/** How the species' group sleeps together when its own sleep text has no word of it (`sleep.ts`), or null. */
export function groupRoostOf(slug: string): RoostSocial | null {
    const arg = groupActsOf(slug).find((a) => a.id === "roost")?.arg;
    return arg === "huddle" || arg === "pile" || arg === "row" || arg === "cluster" ? arg : null;
}

function rng(seed: number): () => number {
    let s = seed >>> 0 || 1;
    return () => {
        s ^= s << 13;
        s ^= s >>> 17;
        s ^= s << 5;
        return ((s >>> 0) % 1_000_003) / 1_000_003;
    };
}

/**
 * The window of an act round a world time (pure in the key and the time): in each `period` the key's seed decides
 * whether there is one (`chance`), how long it is (`min`…`max` s) and where in the period it falls. `n` numbers it.
 */
export function windowOf(key: string, t: number, period: number, chance: number, min: number, max: number): {n: number; t0: number; t1: number} | null {
    const n = Math.floor(t / period);
    const r = rng(hashString(`${key}#${n}`));
    if (r() >= chance) return null;
    const len = min + r() * (max - min);
    const t0 = n * period + r() * Math.max(period - len, 0);
    return t >= t0 && t < t0 + len ? {n, t0, t1: t0 + len} : null;
}

/** Each windowed act's period (s), the chance of a window in it, and the window's length range (s). */
const WINDOWS: Record<string, [number, number, number, number]> = {huddle: [600, 0.55, 150, 330], sentinel: [360, 0.85, 130, 250], lick: [1200, 0.65, 270, 540], chorus: [900, 0.6, 50, 100], feast: [1000, 0.5, 240, 480], basking: [900, 0.6, 300, 600]};

/** An act's window round a world time for a group (its leader's id), or null (for the scene's picture harness and the tests). */
export function actWindow(act: keyof typeof WINDOWS, leaderId: string, t: number): {n: number; t0: number; t1: number} | null {
    const [period, chance, min, max] = WINDOWS[act];
    return windowOf(`${leaderId}#${act}`, t, period, chance, min, max);
}

export type GroupInput = {
    world: ScheduleWorld;
    profile: ArkBehaviourProfile;
    animal: ScheduleAnimal;
    slug: string;
    start: number;
    /** Island hours at the slot's start. */
    hours: number;
    /** The group's middle for this slot, and its spread. */
    centre: {x: number; z: number};
    radius: number;
    kit: ScheduleKit;
};
export type GroupIntent = {doing: string; /** Null: where it is (a chorus is sung on the spot). */ to: Spot | null; mode: TripMode; recipe: string; face?: number};

type Who = {act: GroupAct; lead: ScheduleAnimal; leadProfile: ArkBehaviourProfile; size: number; rank: number; length: number};

/** The group an animal is in (its leader's, or its own when it leads one), as far as it is aboard together. */
function whoOf(i: GroupInput, act: GroupAct): Who | null {
    const group = i.animal.group ?? null;
    const size = group ? group.size : i.animal.led ?? 1;
    if (size < 2) return null;
    const lead = group ? group.leader : i.animal;
    return {act, lead, leadProfile: group ? group.profile : i.profile, size, rank: group ? Math.max(group.rank, 1) : 0, length: Math.max(i.animal.length, lead.length, 0.05)};
}

/** A land profile for a spot on the ground (a bird that flies is put on the ground for a huddle or a lick). */
const onFoot = (profile: ArkBehaviourProfile): ArkBehaviourProfile => ({...profile, move: "walk", seabed: false});

/** A member's own place round a cluster's middle, close to it: a golden-angle ring each rank a little further out. */
function ringSpot(i: GroupInput, w: Who, middle: {x: number; z: number}, spacing: number): {x: number; z: number} {
    const angle = w.rank * 2.399963 + ((hashString(`${i.animal.id}#ring`) % 1000) / 1000 - 0.5) * 0.3;
    const d = w.length * spacing * (w.rank === 0 ? 0 : 0.5 + 0.5 * Math.sqrt(w.rank));
    return {x: middle.x + Math.sin(angle) * d, z: middle.z + Math.cos(angle) * d};
}

function groundOn(i: GroupInput, at: {x: number; z: number}): Spot {
    const land = i.world.nav.nearest(at.x, at.z, "walk", 0.5, 6) ?? at;
    return i.kit.groundSpot(i.world, land.x, land.z);
}

const HUDDLE: [number, number] = [7, 17.5];

function huddle(i: GroupInput, w: Who): GroupIntent | null {
    if (i.kit.aquatic(i.profile) || i.hours < HUDDLE[0] || i.hours > HUDDLE[1]) return null;
    const win = actWindow("huddle", w.lead.id, i.start);
    if (!win) return null;
    const r = rng(hashString(`${w.lead.id}#huddle#${win.n}`));
    // The cluster's middle: one place the whole group agrees on, near its leader's home.
    const middle = i.kit.rangeSpot(i.world, onFoot(w.leadProfile), w.lead, {x: w.lead.home.x, z: w.lead.home.z}, Math.max(i.radius * 0.5, 2), r);
    const to = groundOn(i, ringSpot(i, w, middle, 0.62));
    return {doing: "rest", to, mode: "ground", recipe: "huddle", face: Math.atan2(middle.x - to.x, middle.z - to.z) + Math.PI * (w.rank % 2)};
}

const VANTAGE_FLYER: AttachTag[] = ["post", "branch", "rock_top", "log_top"];
const VANTAGE_WALKER: AttachTag[] = ["rock_top", "log_top"];

function sentinel(i: GroupInput, w: Who): GroupIntent | null {
    const need = Number(w.act.arg) || 2;
    if (w.size < need) return null;
    const win = actWindow("sentinel", w.lead.id, i.start);
    if (!win) return null;
    // One member at a time stands watch (by window: in turn).
    if (w.rank % w.size !== hashString(`${w.lead.id}#sentinel#post#${win.n}`) % w.size) return null;
    const flyer = i.kit.flies(i.profile);
    const point = i.kit.placeNear(i.world, i.centre, i.animal.length, flyer ? VANTAGE_FLYER : VANTAGE_WALKER, Math.max(i.radius, 6), rng(hashString(`${i.animal.id}#vantage#${win.n}`))());
    if (point) {
        const to = i.kit.spotOf(point);
        const raised = to.y > i.world.sampler.heightAt(to.x, to.z) + 0.6;
        return {doing: "watch", to, mode: flyer && raised ? "air" : "ground", recipe: "sentinel_post"};
    }
    // No vantage near: at the group's edge on the side away from its leader, facing out.
    const r = rng(hashString(`${i.animal.id}#edge#${win.n}`));
    const edge = i.kit.rangeSpot(i.world, onFoot(i.profile), i.animal, i.centre, Math.max(i.radius * 0.6, 3), r);
    return {doing: "watch", to: edge, mode: "ground", recipe: "sentinel_post", face: Math.atan2(edge.x - w.lead.home.x, edge.z - w.lead.home.z)};
}

function gather(i: GroupInput, w: Who): GroupIntent | null {
    // The last hour of daylight: from a time of the group's own (17.0–17.6) until it sleeps, it is at its roost, calling.
    const begin = 17 + (hashString(`${w.lead.id}#gather`) % 100) / 166;
    if (i.hours < begin || i.hours > 19) return null;
    const to = i.kit.roostOf(i.world, i.profile, i.animal);
    const flyer = i.kit.flies(i.profile);
    const raised = to.y > i.world.sampler.heightAt(to.x, to.z) + 0.6;
    if (i.kit.aquatic(i.profile) && !flyer) return null;
    return {doing: raised || flyer ? "perch" : "rest", to, mode: flyer && raised ? "air" : "ground", recipe: "dusk_gather"};
}

function lick(i: GroupInput, w: Who): GroupIntent | null {
    if (i.hours < 6.4 || i.hours > 10.8) return null;
    const win = actWindow("lick", w.lead.id, i.start);
    if (!win) return null;
    const r = rng(hashString(`${w.lead.id}#lick#${win.n}`));
    // A bank's bare ground near the group's home, within a few metres of the water if there is a bank; else bare ground.
    const bank = i.kit.placeNear(i.world, {x: w.lead.home.x, z: w.lead.home.z}, w.length, ["water_edge"], 28, r());
    const middle = bank ? {x: bank.x, z: bank.z} : i.kit.rangeSpot(i.world, onFoot(w.leadProfile), w.lead, {x: w.lead.home.x, z: w.lead.home.z}, 14, r);
    const to = groundOn(i, ringSpot(i, w, middle, 1.4));
    return {doing: "forage", to, mode: "ground", recipe: "lick_gather", face: Math.atan2(middle.x - to.x, middle.z - to.z)};
}

function feast(i: GroupInput, w: Who): GroupIntent | null {
    if (i.hours < 7 || i.hours > 16.5) return null;
    const win = actWindow("feast", w.lead.id, i.start);
    if (!win) return null;
    const r = rng(hashString(`${w.lead.id}#feast#${win.n}`));
    // The tree: a branch within 30 m of the group's home that the whole group agrees on; each member takes a branch of its own near it.
    const tree = i.kit.placeNear(i.world, {x: w.lead.home.x, z: w.lead.home.z}, w.length, ["branch"], 30, r());
    if (!tree) return null;
    const own = i.kit.placeNear(i.world, {x: tree.x, z: tree.z}, i.animal.length, ["branch"], 4, rng(hashString(`${i.animal.id}#feast#${win.n}`))()) ?? tree;
    const to = i.kit.spotOf(own);
    return {doing: "forage", to, mode: i.kit.flies(i.profile) ? "air" : "ground", recipe: "tree_feast"};
}

const BASK_TAGS: AttachTag[] = ["log_top", "rock_top"];

function basking(i: GroupInput, w: Who): GroupIntent | null {
    if (i.hours < 8.5 || i.hours > 16) return null;
    const win = actWindow("basking", w.lead.id, i.start);
    if (!win) return null;
    // One log or rock near the group's home, within 25 m: the whole group stacks on it.
    const spot = i.kit.placeNear(i.world, {x: w.lead.home.x, z: w.lead.home.z}, w.length, BASK_TAGS, 25, rng(hashString(`${w.lead.id}#basking#${win.n}`))());
    if (!spot) return null;
    return {doing: "bask", to: i.kit.spotOf(spot), mode: "ground", recipe: "bask_pile"};
}

/** A chorus's hours (island): the dawn chorus, the day's, the dusk and night's. */
const CHORUS_HOURS: Record<string, [number, number]> = {dawn: [5.3, 7.6], day: [7, 17], dusk: [17.4, 22.5]};

function chorus(i: GroupInput, w: Who): GroupIntent | null {
    const [from, to] = CHORUS_HOURS[w.act.arg ?? "day"] ?? CHORUS_HOURS.day;
    if (i.hours < from || i.hours > to) return null;
    // Every member whose slot starts in the window sings where it stands, heads up: its slots start at different moments, so
    // one starts and the rest join.
    if (!actWindow("chorus", w.lead.id, i.start)) return null;
    return {doing: "rest", to: null, mode: "stay", recipe: "chorus"};
}

const ACTS: Partial<Record<GroupActId, (i: GroupInput, w: Who) => GroupIntent | null>> = {sentinel, lick, chorus, feast, basking, huddle, gather};

/**
 * What a group act sets this animal on for the slot starting now (null: none; its own day goes on). Asked by the
 * schedule for an awake animal that no predator has sent to watch.
 */
export function groupIntent(i: GroupInput): GroupIntent | null {
    const acts = groupActsOf(i.slug);
    if (!acts.length) return null;
    for (const act of acts) {
        const run = ACTS[act.id];
        if (!run) continue;
        const who = whoOf(i, act);
        if (!who) return null;
        const out = run(i, who);
        if (out) return out;
    }
    return null;
}

// MARK: The commute: a flock's day is at a feeding patch

/** The first hour after dawn, and the hour the flock's day ends (its roost trip home takes over at dusk). */
const COMMUTE_FROM = 6.7;
const COMMUTE_TO = 17.2;
const patches = new WeakMap<ScheduleWorld, WeakMap<ScheduleAnimal, {x: number; z: number} | null>>();

/**
 * The feeding patch a flock's leader spends the day at (a spot 40–70 m from its home on open ground that it can see,
 * seeded by its id: the same every day), or null: not a commuter, not a leader of a group aboard, or not the day's hours.
 * Its members keep to their leader's goals, so the flock flies out after dawn and, at dusk, back to its roost.
 */
export function commuteCentre(world: ScheduleWorld, animal: ScheduleAnimal, slug: string, hours: number, sameGround: (x: number, z: number) => boolean = () => true): {x: number; z: number} | null {
    if (animal.group || (animal.led ?? 1) < 2 || hours < COMMUTE_FROM || hours > COMMUTE_TO) return null;
    if (!groupActsOf(slug).some((a) => a.id === "commute")) return null;
    let byAnimal = patches.get(world);
    if (!byAnimal) patches.set(world, (byAnimal = new WeakMap()));
    const known = byAnimal.get(animal);
    if (known !== undefined) return known;
    const r = rng(hashString(`${animal.id}#commute`));
    const far = 40 + r() * 30;
    const a0 = r() * Math.PI * 2;
    let out: {x: number; z: number} | null = null;
    for (let k = 0; k < 8 && !out; k++) {
        const a = a0 + k * (Math.PI / 4);
        const x = animal.home.x + Math.cos(a) * far;
        const z = animal.home.z + Math.sin(a) * far;
        const land = world.nav.nearest(x, z, "walk", 0.5, 12);
        // (On its own stretch of ground: a walk-first bird goes only there, `sameGround`; one that cannot would stay home.)
        if (land && Math.hypot(land.x - animal.home.x, land.z - animal.home.z) >= far * 0.7 && !world.sampler.blocked(land.x, land.z, 2.2) && sameGround(land.x, land.z)) out = {x: land.x, z: land.z};
    }
    byAnimal.set(animal, out);
    return out;
}

// MARK: Pairs in flight

/**
 * Where a paired member flies relative to its partner's offset: a member of a species whose pairs fly wing to wing
 * (`pairs`) takes the side of the member one rank below it (ranks 2k+1 and 2k+2 are a pair), a wingspan or so beside it.
 * Returns the pair's index and the side (-1 / +1), or null: not a pairing species, or the leader.
 */
export function pairSide(slug: string, rank: number): {pair: number; side: -1 | 1} | null {
    if (rank < 1 || !groupActsOf(slug).some((a) => a.id === "pairs")) return null;
    return {pair: Math.floor((rank - 1) / 2), side: (rank - 1) % 2 === 0 ? -1 : 1};
}

// MARK: Tight flocks

/** How wide a flock flies round its leader against the usual: half for a species whose own text has it flying in a tight flock. */
export function flockTightness(slug: string): number {
    return groupActsOf(slug).some((a) => a.id === "tight") ? 0.5 : 1;
}
