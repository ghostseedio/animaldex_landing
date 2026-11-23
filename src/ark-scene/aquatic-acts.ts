/**
 * The water's signature behaviours that need two animals (sig2-aquatic; AnimalDex docs/ark/behaviours-plan.md,
 * decision 367/369; the rows of docs/ark/signature-behaviours.json that `scripts/ark-signature-recipes.mts` held for
 * another body plan): a cleaner at a larger swimmer's skin (`clean_client`: the cleaner wrasse, the juvenile gray
 * angelfish, the yellow tang at a green sea turtle), a moray or a surgeonfish with the other kind its text names
 * (`mixed_follow`: groupers, the other surgeonfishes), an adult pair of gray angelfish patrolling the reef from one
 * feeding patch to the next (`pair_patrol`).
 *
 * Why not the recipe engine: a reef fish is a hole-dweller (`sea-depth.ts`: `crevice`, "in its hole, still, its head
 * turning slowly"), so no schedule's episode is ever drawn for it. This acts them from the draw layer instead, in the
 * shape of a pure function of the shared clock, the pair's ids and the places the Ark gave them: the same for every
 * viewer. The act is a window of world time in each ten minutes (seeded by the pair): out from its crevice to the
 * other (at its own swimming pace), the act itself, and back to its crevice. Never a record: nothing here changes what
 * happens on the Ark, and nothing is shown that its own species' sentence does not say (`aquatic-partners.json` keeps
 * each sentence). Real animals only: a cleaner with no larger swimmer of its text's kind within 20 m shows nothing.
 *
 * Loads with the scene (never in the Ark page's static JavaScript: `ark-page-weight.test.ts`).
 */

import partners from "@/ark-scene/aquatic-partners.json";
import {speciesRecipes, type RecipeAct} from "@/ark-scene/behaviour-recipes";
import {TEMPLATES} from "@/ark-scene/recipe-templates";
import {hashString} from "@/ark-scene/world";
import {modelBase} from "@/ark-scene/grounding/base";

export type AquaticRecipe = "clean_client" | "mixed_follow" | "pair_patrol";
const RECIPES: readonly AquaticRecipe[] = ["clean_client", "mixed_follow", "pair_patrol"];

/** Whether a recipe is one of these (the log, the card and the rig read `entry.recipeAct` for these ahead of the schedule's). */
export function isAquaticRecipe(recipe: string | null | undefined): recipe is AquaticRecipe {
    return recipe === "clean_client" || recipe === "mixed_follow" || recipe === "pair_patrol";
}

type Rule = {with: {larger?: number; slugs?: string[]; pattern?: string; same?: boolean}; stage?: "young" | "adult"; block: string; field: string; quote: string};
const RULES = (partners as unknown as {species: Record<string, Partial<Record<AquaticRecipe, Rule>>>}).species;

/** What it needs of an animal of the Ark to wire it: its place (the Ark's, fixed), its size and how it is in the water. */
export type AquaticWire = {id: string; slug: string; x: number; z: number; length: number; young: boolean; motion: "hole" | "swim" | "walk" | "float" | null};

type Link = {recipe: AquaticRecipe; key: string; other: AquaticWire; own: AquaticWire; /** Pair patrol: the one that leads (the path is its own). */ lead: boolean; approach: number; work: number; block: string; side: 1 | -1};

const links = new Map<string, Link>();
/** How far (m) from its crevice it goes to its other: its approach is at its own pace, so a small fish stays near. */
const REACH = 20;
export const AQUATIC_PERIOD = 600;
/** Which of the periods it is in: two in three. */
const BUSY = 3;

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
const ease = (u: number) => u * u * (3 - 2 * u);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
/** A heading between two, `k` of the way (by their directions, so a turn that passes the far side never flips it round). */
const between = (from: number, to: number, k: number) => Math.atan2((1 - k) * Math.sin(from) + k * Math.sin(to), (1 - k) * Math.cos(from) + k * Math.cos(to));
const unit = (seed: string) => (hashString(seed) % 100_003) / 100_003;
/** A body's width and height as shares of its length, from its model (a flat, wide turtle; a tall angelfish; a thin tang). */
function shape(slug: string): {w: number; h: number} {
    const size = modelBase(slug)?.size;
    return size && size.z > 0 ? {w: size.x / size.z, h: size.y / size.z} : {w: 0.3, h: 0.3};
}
/** Its swimming pace to and from (m/s): a few body lengths a second, a small fish no slower than half a metre a second. */
const pace = (length: number) => clamp(length * 3, 0.5, 2.5);

function matches(a: AquaticWire, rule: Rule, b: AquaticWire): boolean {
    if (b.id === a.id || !b.motion || b.motion === "float") return false;
    const w = rule.with;
    if (w.same) return b.slug === a.slug;
    if (b.slug === a.slug) return false;
    if (w.slugs) return w.slugs.includes(b.slug);
    if (w.pattern) return new RegExp(w.pattern).test(b.slug);
    // (A larger swimmer, not another cleaner: the water's `larger` is a client's, at its crevice or swimming.)
    if (w.larger) return (b.motion === "hole" || b.motion === "swim") && b.length >= a.length * w.larger && !RULES[b.slug]?.clean_client;
    return false;
}

/**
 * Who works with whom (after the Ark's places are set, like `wireRecipes`): each animal whose species has one of these
 * acts takes the nearest animal within 20 m its text names; a patrol pair is two adults of the one kind, each in one.
 * Deterministic from ids and places.
 */
export function wireAquatic(animals: readonly AquaticWire[]) {
    links.clear();
    const sorted = [...animals].filter((a) => a.motion).sort((p, q) => p.id.localeCompare(q.id));
    const taken = new Set<string>();
    const near = (a: AquaticWire, b: AquaticWire) => Math.hypot(a.x - b.x, a.z - b.z);
    for (const a of sorted) {
        const species = RULES[a.slug];
        if (!species || a.motion !== "hole") continue;
        const has = speciesRecipes(a.slug).has;
        for (const recipe of RECIPES) {
            const rule = species[recipe];
            if (!rule || !has.has(recipe) || links.has(a.id)) continue;
            if (rule.stage === "young" && !a.young) continue;
            if (rule.stage === "adult" && a.young) continue;
            const pool = sorted.filter((b) => matches(a, rule, b) && (!rule.stage || recipe !== "pair_patrol" || !b.young) && !(recipe === "pair_patrol" && taken.has(b.id)) && near(a, b) <= REACH);
            if (!pool.length) continue;
            const other = pool.sort((p, q) => near(a, p) - near(a, q) || p.id.localeCompare(q.id))[0];
            const key = recipe === "pair_patrol" ? `${recipe}#${[a.id, other.id].sort().join("#")}` : `${recipe}#${a.id}#${other.id}`;
            const approach = clamp(near(a, other) / pace(a.length), 6, 45);
            const work = (recipe === "clean_client" ? 50 : recipe === "pair_patrol" ? 100 : 90) + (hashString(`${key}#work`) % 50);
            const mine: Link = {recipe, key, own: a, other, lead: a.id < other.id, approach, work, block: rule.block, side: unit(`${key}#side`) < 0.5 ? 1 : -1};
            links.set(a.id, mine);
            if (recipe === "pair_patrol") {
                // (The pair's other keeps the same window and path, by the same key: each of two, from its own crevice.)
                taken.add(a.id);
                taken.add(other.id);
                links.set(other.id, {...mine, own: other, other: a, lead: !mine.lead, approach: clamp(near(a, other) / pace(other.length), 6, 45), side: mine.side === 1 ? -1 : 1});
            }
        }
    }
}

/** Whether it has one of these acts wired (a cheap test for the draw layer). */
export function hasAquaticAct(id: string): boolean {
    return links.has(id);
}

/** The partner's frame, as it is drawn now (the middle of its body, its heading, its size). */
export type AquaticFrame = {x: number; y: number; z: number; yaw: number; length: number; height: number};
/** Its own place now (in its crevice): the middle of its body, its heading and its drawn height. */
export type AquaticRest = {x: number; y: number; z: number; yaw: number; height: number; length: number};
export type AquaticWater = {floorAt: (x: number, z: number) => number; topAt: (x: number, z: number) => number};
export type AquaticPose = {x: number; y: number; z: number; yaw: number; pitch: number; roll: number; act: RecipeAct};

/** The window of its act in the period, or null (none this period, or out of hours). `hoursAt`: the island's hour at a world time. */
function windowOf(link: Link, epoch: number, hoursAt: (epoch: number) => number): {start: number; end: number; period: number} | null {
    const total = 2 * link.approach + link.work;
    const period = Math.floor(epoch / AQUATIC_PERIOD);
    if (hashString(`${link.key}#busy#${period}`) % BUSY === 0) return null;
    const start = period * AQUATIC_PERIOD + (hashString(`${link.key}#at#${period}`) % Math.max(AQUATIC_PERIOD - Math.ceil(total) - 1, 1));
    if (epoch < start || epoch >= start + total) return null;
    // By day (as `hourOk` "day": the cleaning stations are busy by day; a pair feeds by day).
    const hours = hoursAt(start);
    if (!(hours > 7 && hours < 17.4)) return null;
    return {start, end: start + total, period};
}

type Path = {points: Array<{x: number; z: number}>; length: number; each: number[]};
const paths = new Map<string, Path | null>();

/** A pair's patrol: a loop through three feeding patches (over water, 4–9 m out) from the middle of their two crevices and back. */
function pathOf(link: Link, water: AquaticWater, partner: AquaticWire, period: number): Path | null {
    const memo = `${link.key}#${period}`;
    if (paths.has(memo)) return paths.get(memo)!;
    const a = link.own.id < partner.id ? link.own : partner;
    const b = link.own.id < partner.id ? partner : link.own;
    const cx = (a.x + b.x) / 2;
    const cz = (a.z + b.z) / 2;
    const turn = unit(`${memo}#turn`) * Math.PI * 2;
    const points: Array<{x: number; z: number}> = [{x: cx, z: cz}];
    for (let k = 0; k < 3; k++) {
        const angle = turn + (k / 3) * Math.PI * 2 + (unit(`${memo}#j${k}`) - 0.5) * 0.7;
        for (const reach of [9, 7, 5, 3.5]) {
            const x = cx + Math.sin(angle) * reach * (0.7 + 0.3 * unit(`${memo}#r${k}`));
            const z = cz + Math.cos(angle) * reach * (0.7 + 0.3 * unit(`${memo}#r${k}`));
            if (water.floorAt(x, z) < water.topAt(x, z) - 0.8) {
                points.push({x, z});
                break;
            }
        }
    }
    points.push({x: cx, z: cz});
    let result: Path | null = null;
    if (points.length >= 4) {
        const each: number[] = [0];
        let length = 0;
        for (let i = 1; i < points.length; i++) {
            length += Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z);
            each.push(length);
        }
        result = {points, length, each};
    }
    paths.set(memo, result);
    if (paths.size > 64) paths.delete(paths.keys().next().value as string);
    return result;
}

function along(path: Path, d: number): {x: number; z: number} {
    const at = clamp(d, 0, path.length);
    let i = 1;
    while (i < path.each.length - 1 && path.each[i] < at) i++;
    const span = Math.max(path.each[i] - path.each[i - 1], 1e-6);
    const u = (at - path.each[i - 1]) / span;
    return {x: path.points[i - 1].x + (path.points[i].x - path.points[i - 1].x) * u, z: path.points[i - 1].z + (path.points[i].z - path.points[i - 1].z) * u};
}

/** A patrol's swimming pace (m/s). */
const patrolPace = (length: number) => clamp(length * 1.2, 0.35, 0.8);

/**
 * Its act at a world time, or null (none now). `rest` is where it is without one; `frameOf` a partner's drawn frame (null:
 * not drawn now, no act). Pure in the shared clock, the pair and the Ark's places.
 */
export function aquaticPose(id: string, epoch: number, hoursAt: (epoch: number) => number, rest: AquaticRest, frameOf: (id: string) => AquaticFrame | null, water: AquaticWater): AquaticPose | null {
    const link = links.get(id);
    if (!link) return null;
    const window = windowOf(link, epoch, hoursAt);
    if (!window) return null;
    const partner = frameOf(link.other.id);
    if (!partner) return null;
    const t = epoch - window.start;
    const {approach, work} = link;
    // Out, there, back: 0 in its crevice, 1 at the act.
    const out = ease(clamp(t / approach, 0, 1));
    const back = ease(clamp((t - approach - work) / approach, 0, 1));
    const w = out * (1 - back);
    const there = w > 0.985;
    const phase = t - approach;
    const length = Math.max(rest.length, 0.05);
    const height = Math.max(rest.height, length * 0.2);
    let tx = partner.x;
    let ty = partner.y;
    let tz = partner.z;
    let tyaw = partner.yaw;
    let pitch = 0;
    let roll = 0;
    if (link.recipe === "clean_client") {
        // Working over the client's flank: back and forth along its body (its middle to its head, to its tail), a little up
        // and down the side, nibbling; turning at the ends as a fish does, not a flip.
        const period = 7 + 3 * unit(`${link.key}#pass`);
        const phi = (phase / period) * Math.PI * 2;
        const fore = partner.length * (0.04 + 0.3 * Math.sin(phi));
        const them = shape(link.other.slug);
        const mine = shape(link.own.slug);
        const half = (partner.length * them.w) / 2;
        // A wide, flat client (a turtle) is worked over its back; a fish along its side, a body width off.
        const flat = them.w > 0.6;
        const side = flat ? link.side * half * 0.35 : link.side * (half + (length * mine.w) / 2 + 0.01);
        const fx = Math.sin(partner.yaw);
        const fz = Math.cos(partner.yaw);
        tx = partner.x + fx * fore + fz * side;
        tz = partner.z + fz * fore - fx * side;
        ty = flat ? partner.y + (partner.length * them.h) / 2 + (length * mine.h) / 2 + 0.01 : partner.y + partner.height * 0.2 * Math.sin(phi * 1.6 + 1);
        // Along its way: with the client's heading going forward, against it coming back.
        tyaw = partner.yaw + Math.PI / 2 - (Math.PI / 2) * Math.tanh(4 * Math.cos(phi)) - link.side * 0.3;
        pitch = 0.25 * Math.max(Math.sin(phi * 5), 0);
        roll = link.side * 0.25;
    } else if (link.recipe === "mixed_follow") {
        // Alongside the other kind, in a slow loop about it (it feeds or hunts with it): near its head first.
        const radius = Math.max(partner.length * 0.9 + length * 1.5, 0.6);
        const speed = clamp(length * 1.5, 0.3, 1);
        const turnsOn = link.side * ((phase * speed) / radius);
        const start = unit(`${link.key}#loop`) * Math.PI * 2;
        const angle = start + turnsOn;
        const lead = partner.length * 0.25;
        tx = partner.x + Math.sin(partner.yaw) * lead + Math.cos(angle) * radius;
        tz = partner.z + Math.cos(partner.yaw) * lead + Math.sin(angle) * radius;
        ty = partner.y + partner.height * 0.3 * Math.sin(angle * 2);
        tyaw = Math.atan2(-Math.sin(angle) * link.side, Math.cos(angle) * link.side);
        if (link.block === "graze_with") pitch = 0.3 + 0.14 * Math.sin(phase * 0.7 * Math.PI * 2);
    } else {
        // An adult pair over the reef together: the lead's loop through three patches, side by side.
        const path = pathOf(link, water, link.other, window.period);
        if (!path) return null;
        const v = patrolPace(Math.max(length, link.other.length));
        const d = clamp(phase * v, 0, path.length);
        const p = along(path, d);
        const q = along(path, d + 0.6);
        const heading = Math.atan2(q.x - p.x, q.z - p.z) || partner.yaw;
        const gap = (Math.max(length, link.other.length) * 0.7 + 0.05) * link.side;
        tx = p.x + Math.cos(heading) * gap;
        tz = p.z - Math.sin(heading) * gap;
        tyaw = heading;
        const floor = water.floorAt(tx, tz);
        ty = Math.min(floor + Math.max(0.35, height * 0.9) + 0.18 * Math.sin(phase * 0.5 + unit(`${link.key}#y`) * 6), water.topAt(tx, tz) - height);
    }
    // From its crevice to the act and back: along the straight line, its heading its way there (then the act's), eased at both ends.
    const x = rest.x + (tx - rest.x) * w;
    const y = rest.y + (ty - rest.y) * w;
    const z = rest.z + (tz - rest.z) * w;
    const goingOut = t < approach + work / 2;
    const bearing = Math.atan2(goingOut ? tx - rest.x : rest.x - tx, goingOut ? tz - rest.z : rest.z - tz);
    const away = Math.hypot(tx - rest.x, tz - rest.z) > 0.05;
    const travel = away ? bearing : rest.yaw;
    const settle = ease(clamp((w - 0.8) / 0.2, 0, 1));
    const turned = between(rest.yaw, travel, ease(clamp((goingOut ? t : approach * 2 + work - t) / 1.5, 0, 1)));
    const yaw = between(turned, tyaw, settle);
    const lift = Math.atan2(ty - rest.y, Math.max(Math.hypot(tx - rest.x, tz - rest.z), 0.05)) * (1 - settle) * (goingOut ? -1 : 1) * 0.5;
    const block = there ? link.block : "swim";
    const act: RecipeAct = {
        episode: `${link.key}#${window.period}`,
        recipe: link.recipe,
        block,
        state: block === "clean" ? "groom_other" : block === "graze_with" ? "probe" : "swim",
        u: t / (2 * approach + work),
        pitch: (there ? pitch : 0) + lift,
        roll: there ? roll : 0,
        own: true,
        carry: null,
        prey: null,
        catch: null,
        fx: null,
        mark: null,
        label: TEMPLATES[link.recipe].label,
        with: link.other.id
    };
    return {x, y, z, yaw, pitch: act.pitch, roll: act.roll, act};
}

/** The pair an animal is wired to (for the harness and the tests): its act's recipe, the other's id and its window length (s). */
export function aquaticLinkOf(id: string): {recipe: AquaticRecipe; other: string; key: string; seconds: number; approach: number; work: number} | null {
    const link = links.get(id);
    return link ? {recipe: link.recipe, other: link.other.id, key: link.key, seconds: 2 * link.approach + link.work, approach: link.approach, work: link.work} : null;
}

/** Its windows between two world times (for the harness and the tests): `{start, end}` in world seconds. */
export function aquaticWindows(id: string, from: number, to: number, hoursAt: (epoch: number) => number): Array<{start: number; end: number}> {
    const link = links.get(id);
    const out: Array<{start: number; end: number}> = [];
    if (!link) return out;
    for (let p = Math.floor(from / AQUATIC_PERIOD); p * AQUATIC_PERIOD < to; p++) {
        const w = windowAnywhere(link, p, hoursAt);
        if (w && w.end > from && w.start < to) out.push({start: w.start, end: w.end});
    }
    return out;
}

/** (A period's window wherever it falls in the period: `windowOf` only answers for a time inside it.) */
function windowAnywhere(link: Link, period: number, hoursAt: (epoch: number) => number): {start: number; end: number; period: number} | null {
    const total = 2 * link.approach + link.work;
    if (hashString(`${link.key}#busy#${period}`) % BUSY === 0) return null;
    const start = period * AQUATIC_PERIOD + (hashString(`${link.key}#at#${period}`) % Math.max(AQUATIC_PERIOD - Math.ceil(total) - 1, 1));
    const hours = hoursAt(start);
    return hours > 7 && hours < 17.4 ? {start, end: start + total, period} : null;
}
