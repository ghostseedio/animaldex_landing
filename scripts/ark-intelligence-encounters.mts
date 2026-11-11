#!/usr/bin/env -S npx tsx
/**
 * The owner's problems (5) "no head movement" and (6) "prey ignore predators", measured on the real reactive layer
 * (`src/ark-scene/reactive.ts`) in node: no rendering, no network, no randomness (the same numbers every run).
 *
 * Encounters (problem 6). Every prey species aboard (a stratified, seeded sample by body plan; `--limit`) meets a
 * predator of its own zone that the food links say can eat it (`canEat`), the way the audit lane counts them
 * (`ark-audit` metrics: an awake predator on the ground within 25 m is an encounter, under 6 m a close one):
 *   - a walking pass at closest distances of 2, 4, 6, 9, 13, 18 and 24 m (it walks 70 m in a straight line at a walk);
 *   - a predator standing still at 4, 10 and 20 m for 20 s.
 * The prey stands feeding (grazers graze, the rest forage), facing a seeded way. Reported: the share of encounters
 * where the prey reacts at all (looks at the predator, or alerts, freezes, flees, displays), the share of close ones
 * where it flees (and where it uses any defence of its own), and the seconds from the start of the encounter
 * (the predator within 25 m) to the first reaction.
 *
 * Heads (problem 5). Per species: the share of calm time its head is turned (its own look-round, with no threat or
 * camera), how often it changes what it looks at, whether it looks at the threat in the encounters, and whether it
 * looks at the camera when the camera is close.
 *
 *   npx tsx scripts/ark-intelligence-encounters.mts [--limit 300] [--tier high] [--out file.json] [--markdown]
 *
 * Open ground (no sight lines through the terrain) unless `--sight`: then the island's own terrain and vegetation
 * (`reactive-world.ts`), with each pair put in its zone.
 */

import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {behaviourProfile} from "@/ark-scene/behaviour-profile";
import {canEat, hasIntelProfile, intelProfile} from "@/ark-scene/intelligence-profile";
import {displayLength} from "@/ark-scene/sizes";
import {ReactiveLayer, type ReactiveInput, type ReactiveOut, type ReactiveTier, type ReactiveWorld} from "@/ark-scene/reactive";
import {hashString, heightAt, ZONE_SITES} from "@/ark-scene/world";
import {worldSampler} from "@/ark-scene/world-sampler";
import {reactiveWorldQueries, type ReactiveWorldQueries} from "@/ark-scene/reactive-world";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name: string, fallback: string) => {
    const at = process.argv.indexOf(`--${name}`);
    return at > 0 && process.argv[at + 1] && !process.argv[at + 1].startsWith("--") ? process.argv[at + 1] : fallback;
};
const flag = (name: string) => process.argv.includes(`--${name}`);
const LIMIT = Number(arg("limit", "300"));
const TIER = arg("tier", "high") as ReactiveTier;
const OUT = arg("out", "");
const WITH_SIGHT = flag("sight");

/** The audit lane's numbers (`src/lib/ark-audit/metrics.ts` on ark-audit): sight 25 m, a close encounter under 6 m. */
const ENCOUNTER_M = 25;
const CLOSE_M = 6;
const FPS = 30;
const REACTIONS = new Set<ReactiveOut["action"]>(["alert", "freeze", "flee", "threat_display", "play_dead", "shield_young", "hide_behind_parent", "recover"]);
const DEFENCES = new Set<ReactiveOut["action"]>(["flee", "freeze", "threat_display", "play_dead", "shield_young", "hide_behind_parent"]);
const WATER_PLANS = new Set(["fish", "cephalopod_jelly"]);
/** Plans whose head does not turn by design (`head-look.ts`: no neck to speak of). */
const NO_HEAD = new Set(["crustacean", "arachnid", "other", "cephalopod_jelly"]);

type Row = {slug: string; zone: string | null; excluded: string | null; plan: string};
const profiles = JSON.parse(fs.readFileSync(path.join(root, "data/ark/behaviour-profiles.json"), "utf8")) as {profiles: Row[]};
const aboard = profiles.profiles.filter((r) => !r.excluded && r.zone && hasIntelProfile(r.slug));

function input(id: string, slug: string, x: number, z: number, shared: Partial<ReactiveInput["shared"]>): ReactiveInput {
    const p = intelProfile(slug);
    const b = behaviourProfile(slug);
    return {
        id,
        slug,
        plan: p.plan,
        length: displayLength(slug, p.plan),
        size: b.size,
        speed: b.speed,
        dominance: b.dominance,
        social: b.social,
        diet: b.diet,
        intel: p,
        asleep: false,
        acting: false,
        shared: {x, y: 0, z, yaw: 0, moving: false, aloft: false, doing: "forage", ...shared}
    };
}

const unit = (key: string) => (hashString(key) % 100000) / 100000;

/** Who could eat it, aboard and in its zone (ground hunters first: a hawk walking past is not how it meets one). */
function predatorFor(prey: Row): Row | null {
    const pi = intelProfile(prey.slug);
    const pb = behaviourProfile(prey.slug);
    const water = WATER_PLANS.has(prey.plan);
    const eligible = aboard.filter((q) => {
        if (q.slug === prey.slug || q.zone !== prey.zone) return false;
        if (WATER_PLANS.has(q.plan) !== water) return false;
        const qi = intelProfile(q.slug);
        if (!qi.hunt.some((h) => h !== "filter" && h !== "scavenge")) return false;
        return canEat(qi, pi, behaviourProfile(q.slug).size, pb.size);
    });
    if (!eligible.length) return null;
    const ground = eligible.filter((q) => !["flying_bird", "bat", "flying_insect"].includes(q.plan));
    const pool = ground.length ? ground : eligible;
    return pool.slice().sort((a, b) => unit(`${prey.slug}|${a.slug}`) - unit(`${prey.slug}|${b.slug}`))[0];
}

type Run = {prey: string; plan: string; predator: string; kind: "pass" | "still"; d: number; nearest: number; reactedS: number | null; reactedAtM: number | null; looked: boolean; fled: boolean; defended: boolean; called: boolean; lookFrames: number; reactFrames: number};

let queries: ReactiveWorldQueries | null = null;
function world(now: number, camera: {x: number; y: number; z: number}, terrain = false): ReactiveWorld {
    if (terrain) queries ??= reactiveWorldQueries(worldSampler(), 8);
    return {now, dt: 1 / FPS, hours: 10, night: 0, weather: {rain: 0, wind: 0.2, windDirection: 0.4, fog: 0, storm: 0}, camera, ...(terrain && queries ? {sight: queries.sight, refuge: queries.refuge} : {})};
}

/** With `--sight`: where a pair meets on the island (its zone's site, seeded a little off it), and the ground there. */
function ground(prey: Row): {ox: number; oz: number; heading: number; terrain: boolean} {
    const site = ZONE_SITES[prey.zone as keyof typeof ZONE_SITES];
    const terrain = WITH_SIGHT && Boolean(site) && !WATER_PLANS.has(prey.plan) && site.kind !== "sea";
    if (!terrain) return {ox: 0, oz: 0, heading: 0, terrain: false};
    const a = unit(`${prey.slug}#site`) * Math.PI * 2;
    return {ox: site.x + Math.cos(a) * 4, oz: site.z + Math.sin(a) * 4, heading: unit(`${prey.slug}#heading`) * Math.PI * 2, terrain: true};
}

function encounter(prey: Row, predator: Row, kind: "pass" | "still", d: number): Run {
    const layer = new ReactiveLayer({tier: TIER});
    const grazer = behaviourProfile(prey.slug).diet === "grazer";
    const yaw = unit(`${prey.slug}#yaw`) * Math.PI * 2;
    const g = ground(prey);
    // Local (u along the pass, v across it) to world: rotated by the pair's heading, about its meeting point.
    const toWorld = (u: number, v: number) => ({x: g.ox + u * Math.cos(g.heading) - v * Math.sin(g.heading), z: g.oz + u * Math.sin(g.heading) + v * Math.cos(g.heading)});
    const lift = (i: ReactiveInput) => {
        if (g.terrain) i.shared.y = Math.max(heightAt(i.shared.x, i.shared.z), 0);
    };
    const me = input("prey", prey.slug, g.ox, g.oz, {doing: grazer ? "graze" : "forage", yaw});
    lift(me);
    const startAt = toWorld(kind === "pass" ? -35 : d, kind === "pass" ? d : 0);
    const passYaw = Math.atan2(Math.cos(g.heading), Math.sin(g.heading));
    const hunter = input("pred", predator.slug, startAt.x, startAt.z, {doing: kind === "pass" ? "wander" : "rest", moving: kind === "pass", yaw: kind === "pass" ? passYaw : passYaw + Math.PI});
    const walk = Math.min(Math.max(hunter.length * 1.1, 0.9), 2.2);
    const seconds = kind === "pass" ? 70 / walk + 4 : 22;
    // The camera off to one side, out of the curious-camera range (the camera is measured separately).
    const camera = {...toWorld(0, -30), y: me.shared.y + 2.5};
    let start: number | null = null;
    let nearest = Infinity;
    let reactedS: number | null = null;
    let reactedAtM: number | null = null;
    let looked = false;
    let fled = false;
    let defended = false;
    let called = false;
    let lookFrames = 0;
    let reactFrames = 0;
    // Two calm seconds first, the predator not yet in range.
    const settle = 2;
    for (let k = 0; k < (seconds + settle) * FPS; k++) {
        const t = 1000 + k / FPS;
        const walking = kind === "pass" && t >= 1000 + settle;
        if (kind === "pass") {
            const at = toWorld(-35 + Math.max(t - 1000 - settle, 0) * walk, d);
            hunter.shared.x = at.x;
            hunter.shared.z = at.z;
            lift(hunter);
        }
        hunter.shared.moving = walking;
        const apart = Math.hypot(hunter.shared.x - me.shared.x, hunter.shared.z - me.shared.z);
        const inRange = apart <= ENCOUNTER_M && t >= 1000 + settle;
        const out = layer.step(kind === "still" && t < 1000 + settle ? [me] : [me, hunter], world(t, camera, g.terrain));
        const o = out.get("prey");
        if (inRange) {
            nearest = Math.min(nearest, apart);
            start ??= t;
        }
        if (start === null || !o) continue;
        const looking = o.looking === "pred";
        const reacting = REACTIONS.has(o.action) || looking;
        if (reacting && reactedS === null) {
            reactedS = Math.round((t - start) * 100) / 100;
            reactedAtM = Math.round(apart * 10) / 10;
        }
        if (looking) looked = true;
        if (o.action === "flee") fled = true;
        if (DEFENCES.has(o.action)) defended = true;
        if (o.called) called = true;
        if (reactedS !== null && inRange) {
            reactFrames++;
            if (looking) lookFrames++;
        }
    }
    return {prey: prey.slug, plan: prey.plan, predator: predator.slug, kind, d, nearest: Math.round(nearest * 10) / 10, reactedS, reactedAtM, looked, fled, defended, called, lookFrames, reactFrames};
}

type Heads = {slug: string; plan: string; turnedShare: number; changesPerMin: number; yawRange: number; camera: boolean; cameraShare: number};

function heads(row: Row): Heads {
    // Calm: alone, feeding, the camera 30 m off (no threat, no camera interest): its own look-round.
    const layer = new ReactiveLayer({tier: TIER});
    const grazer = behaviourProfile(row.slug).diet === "grazer";
    const me = input("me", row.slug, 0, 0, {doing: grazer ? "graze" : unit(`${row.slug}#rest`) < 0.5 ? "rest" : "forage", yaw: unit(`${row.slug}#yaw`) * Math.PI * 2});
    let turned = 0;
    let frames = 0;
    let changes = 0;
    let lastLabel: string | null | undefined;
    let lastDir = 0;
    let lo = Infinity;
    let hi = -Infinity;
    for (let k = 0; k < 60 * FPS; k++) {
        const o = layer.step([me], world(1000 + k / FPS, {x: 0, y: 2.5, z: -30})).get("me");
        if (!o) continue;
        frames++;
        if (Math.abs(o.headYaw) > 0.05 || Math.abs(o.headPitch) > 0.05) turned++;
        lo = Math.min(lo, o.headYaw);
        hi = Math.max(hi, o.headYaw);
        // A change of look: a new target, or the head's sweep reversing.
        const dir = Math.sign(Math.round(o.headYaw * 50) / 50);
        if (o.looking !== lastLabel || (dir !== 0 && dir !== lastDir)) changes++;
        lastLabel = o.looking;
        if (dir !== 0) lastDir = dir;
    }
    // The camera close (6 m, eye height), for 40 s: does it look at it?
    const cam = new ReactiveLayer({tier: TIER});
    const you = input("me", row.slug, 0, 0, {doing: "rest", yaw: unit(`${row.slug}#yaw`) * Math.PI * 2});
    let looking = 0;
    let n = 0;
    for (let k = 0; k < 40 * FPS; k++) {
        const o = cam.step([you], world(2000 + k / FPS, {x: 4.2, y: 1.6, z: 4.2})).get("me");
        if (!o) continue;
        n++;
        if (o.looking === "camera") looking++;
    }
    return {slug: row.slug, plan: row.plan, turnedShare: frames ? turned / frames : 0, changesPerMin: changes, yawRange: Math.round((hi - lo) * 100) / 100, camera: looking > 0, cameraShare: n ? looking / n : 0};
}

// MARK: The sample (seeded, stratified by plan)

const byPlan = new Map<string, Row[]>();
for (const r of aboard) byPlan.set(r.plan, [...(byPlan.get(r.plan) ?? []), r]);
const pairs: Array<{prey: Row; predator: Row}> = [];
const withPredator = aboard.map((r) => ({prey: r, predator: predatorFor(r)})).filter((p): p is {prey: Row; predator: Row} => Boolean(p.predator));
const preyByPlan = new Map<string, Array<{prey: Row; predator: Row}>>();
for (const p of withPredator) preyByPlan.set(p.prey.plan, [...(preyByPlan.get(p.prey.plan) ?? []), p]);
for (const [, list] of preyByPlan) {
    const share = Math.max(1, Math.round((LIMIT * list.length) / withPredator.length));
    pairs.push(...list.slice().sort((a, b) => unit(a.prey.slug) - unit(b.prey.slug)).slice(0, share));
}

const t0 = performance.now();
const runs: Run[] = [];
for (const {prey, predator} of pairs) {
    for (const d of [2, 4, 6, 9, 13, 18, 24]) runs.push(encounter(prey, predator, "pass", d));
    for (const d of [4, 10, 20]) runs.push(encounter(prey, predator, "still", d));
}
const headRows: Heads[] = [];
const headSample = aboard.slice().sort((a, b) => unit(`h${a.slug}`) - unit(`h${b.slug}`)).slice(0, LIMIT);
for (const r of headSample) headRows.push(heads(r));
const ms = performance.now() - t0;

// MARK: Summary

const pct = (a: number, b: number) => (b ? Math.round((1000 * a) / b) / 10 : 0);
const median = (v: number[]) => {
    if (!v.length) return null;
    const s = [...v].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
};
const encounters = runs.filter((r) => r.nearest <= ENCOUNTER_M);
const close = encounters.filter((r) => r.nearest < CLOSE_M);
const reactTimes = encounters.filter((r) => r.reactedS !== null).map((r) => r.reactedS!);
const summarise = (list: Run[]) => {
    const near = list.filter((r) => r.nearest < CLOSE_M);
    return {
        encounters: list.length,
        reactPct: pct(list.filter((r) => r.reactedS !== null).length, list.length),
        lookPct: pct(list.filter((r) => r.looked).length, list.length),
        close: near.length,
        closeFleePct: pct(near.filter((r) => r.fled).length, near.length),
        closeDefendPct: pct(near.filter((r) => r.defended).length, near.length),
        medianReactS: median(list.filter((r) => r.reactedS !== null).map((r) => r.reactedS!)),
        closeMedianReactS: median(near.filter((r) => r.reactedS !== null).map((r) => r.reactedS!)),
        medianReactAtM: median(list.filter((r) => r.reactedAtM !== null).map((r) => r.reactedAtM!))
    };
};
const plans = [...new Set(encounters.map((r) => r.plan))].sort();
const headed = headRows.filter((h) => !NO_HEAD.has(h.plan));
const summary = {
    tier: TIER,
    sight: WITH_SIGHT,
    pairs: pairs.length,
    species: new Set(pairs.map((p) => p.prey.slug)).size,
    ms: Math.round(ms),
    targets: {
        "most encounters end in a look (> 50%)": pct(encounters.filter((r) => r.reactedS !== null).length, encounters.length),
        "most close ones in a flee (> 50%)": pct(close.filter((r) => r.fled).length, close.length),
        "median reaction (< 3 s)": median(reactTimes)
    },
    all: summarise(encounters),
    walking: summarise(encounters.filter((r) => r.kind === "pass")),
    still: summarise(encounters.filter((r) => r.kind === "still")),
    byPlan: Object.fromEntries(plans.map((p) => [p, summarise(encounters.filter((r) => r.plan === p))])),
    byDistance: Object.fromEntries([2, 4, 6, 9, 13, 18, 24].map((d) => [`pass ${d} m`, summarise(encounters.filter((r) => r.kind === "pass" && r.d === d))])),
    lookAtThreatShare: pct(encounters.reduce((s, r) => s + r.lookFrames, 0), encounters.reduce((s, r) => s + r.reactFrames, 0)),
    heads: {
        species: headRows.length,
        withHead: headed.length,
        turnOnTheirOwnPct: pct(headed.filter((h) => h.turnedShare > 0.1 && h.yawRange > 0.2).length, headed.length),
        medianTurnedShare: median(headed.map((h) => Math.round(h.turnedShare * 100) / 100)),
        medianChangesPerMin: median(headed.map((h) => h.changesPerMin)),
        lookAtCameraPct: pct(headed.filter((h) => h.camera).length, headed.length),
        medianCameraShare: median(headed.filter((h) => h.camera).map((h) => Math.round(h.cameraShare * 100) / 100)),
        neverTurn: headed.filter((h) => h.yawRange < 0.05).map((h) => h.slug).slice(0, 20)
    },
    notReacting: encounters.filter((r) => r.reactedS === null && r.nearest < 10).slice(0, 25).map((r) => `${r.prey} (${r.plan}) ← ${r.predator} ${r.kind} ${r.d} m`),
    closeNoFlee: close.filter((r) => !r.fled).slice(0, 25).map((r) => `${r.prey} (${r.plan}) ← ${r.predator} ${r.kind} ${r.d} m: ${r.defended ? "defends" : r.reactedS !== null ? "reacts, no flight" : "nothing"}`)
};

if (OUT) fs.writeFileSync(OUT, JSON.stringify({summary, runs, heads: headRows}, null, 1));
if (flag("markdown")) {
    const line = (name: string, s: ReturnType<typeof summarise>) => `| ${name} | ${s.encounters} | ${s.reactPct}% | ${s.lookPct}% | ${s.close} | ${s.closeFleePct}% | ${s.closeDefendPct}% | ${s.medianReactS ?? "–"} | ${s.closeMedianReactS ?? "–"} | ${s.medianReactAtM ?? "–"} |`;
    console.log("| Group | Encounters | React (look or more) | Head on it | Close (< 6 m) | Close: flee | Close: any defence | Median s to react | Close: median s | Median m when it reacts |");
    console.log("|---|---|---|---|---|---|---|---|---|---|");
    console.log(line("All", summary.all));
    console.log(line("Walking past", summary.walking));
    console.log(line("Standing still", summary.still));
    for (const [d, s] of Object.entries(summary.byDistance)) console.log(line(d, s));
    for (const [p, s] of Object.entries(summary.byPlan)) console.log(line(p, s));
}
console.log(JSON.stringify({...summary, byPlan: undefined, byDistance: undefined}, null, 1));
