#!/usr/bin/env -S npx tsx
/**
 * The behaviours pass, lane B2 (prey and bystanders; docs/ark/behaviour-pass-2026-11/prey.md): what prey do about a
 * predator by the predator's state, measured on the real reactive layer (`src/ark-scene/reactive.ts`) in node. No
 * rendering, no network, no randomness: the same numbers every run.
 *
 *   npx tsx --tsconfig scripts/tsconfig.scripts.json scripts/ark-prey-audit.mts fixture [--limit 150] [--out file.json]
 *   npx tsx --tsconfig scripts/tsconfig.scripts.json scripts/ark-prey-audit.mts groups [--out file.json]
 *   npx tsx --tsconfig scripts/tsconfig.scripts.json scripts/ark-prey-audit.mts real public/ark-local/live.json
 *       --islands public/ark-local/islands-routing.json [--stops 80] [--out file.json]
 *
 * `fixture`: every prey species aboard with a predator of its zone (the encounter harness's pairs; a seeded sample by
 * body plan with `--limit`), in open ground, feeding, against the predator in each state:
 *   asleep 6 m off; resting awake at 25, 12, 6 and 3 m; walking past at 20, 10 and 4 m; walking straight at it from
 *   35 m; stalking it (the schedule's `stalk`, a creep at 0.35 of its walk) from 30 m; chasing past at 6 m.
 * Then the predator is gone, and the run goes on 90 s. Read per run: when and how far off it first reacts, what it
 * does (shares of the exposure by action), whether, how far, how fast and which way it flees, whether it calls, how
 * long until it is calm and until it feeds again, and where it ends up.
 *
 * `groups`: herds of 1, 5 and 12 of the herd-living grazers: calm vigilance (head-up share by group size and by place
 * in the herd), then a predator walking at the herd: who notices, when, who runs, whether the herd bunches.
 *
 * `real`: the real snapshot on the schedule through a day (twelve 10-minute windows): every awake prey animal on the
 * ground with an awake hunter of it within 25 m, by the hunter's state and the distance; who rests or sleeps within
 * 5 m of a hunter; and the reactive layer run round a seeded sample of those moments (`--stops`), with the island's
 * terrain and cover. A snapshot holds real usernames: only species slugs and counts are printed.
 *
 * `town`: the real snapshot's town island where its animals are placed (houses, farms, the zoo's enclosures, the
 * town's own wildlife): every animal with a hunter of it within 25, 10 and 5 m, by who keeps the two (a house pet and
 * the cat next door, a zoo zebra and the lions two enclosures off, a garden sparrow and a house cat), and how many of
 * those the layer's rule for kept animals leaves as predator and prey (`reactive.ts` `apart`).
 *
 *   npx tsx --tsconfig scripts/tsconfig.scripts.json scripts/ark-prey-audit.mts town public/ark-local/live.json
 *       --islands public/ark-local/islands-routing.json
 */
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {setArkWorld} from "../src/ark-scene/world.ts";

const args = process.argv.slice(2);
const MODE = args[0];
const value = (name: string, fallback = "") => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : fallback;
};
if (!["fixture", "groups", "real", "town"].includes(MODE)) {
    console.error("usage: ark-prey-audit.mts fixture|groups|real|town [snapshot.json --islands routing.json] [--limit n] [--stops n] [--out file.json]");
    process.exit(1);
}
setArkWorld("v2");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const {behaviourProfile} = await import("../src/ark-scene/behaviour-profile.ts");
const intelModule = await import("../src/ark-scene/intelligence-profile.ts");
const {canEat, hasIntelProfile, intelProfile} = intelModule;
/** The behaviours pass's rules, where the tree has them (`foodLinked`, `canTake`, `huntCompany`); before it: the food links and the size stat (`canEat`). */
const after = intelModule as {
    foodLinked?: (p: ReturnType<typeof intelProfile>, q: ReturnType<typeof intelProfile>) => boolean;
    canTake?: (pp: string, pl: number, company: "alone" | "group" | "pack", qp: string, ql: number) => boolean;
    huntCompany?: (hunt: readonly string[], social: string) => "alone" | "group" | "pack";
    huntsByBuild?: (p: ReturnType<typeof intelProfile>, pd: string, q: ReturnType<typeof intelProfile>, qd: string) => boolean;
    bodyMass?: (plan: string, length: number) => number;
};
/** Whether a hunter of one kind is a threat to another kind, as the reactive layer has it (kinds at their species' drawn length). */
function kindThreat(p: string, q: string): boolean {
    const pi = intelProfile(p);
    const qi = intelProfile(q);
    if (!pi.hunt.some((h) => h !== "filter" && h !== "scavenge")) return false;
    if (!after.foodLinked || !after.canTake || !after.huntCompany) return canEat(pi, qi, behaviourProfile(p).size, behaviourProfile(q).size);
    const pl = displayLength(p, pi.plan);
    const ql = displayLength(q, qi.plan);
    if (after.foodLinked(pi, qi)) return after.canTake(pi.plan, pl, after.huntCompany(pi.hunt, behaviourProfile(p).social), qi.plan, ql);
    if (after.huntsByBuild?.(pi, behaviourProfile(p).diet, qi, behaviourProfile(q).diet)) return after.bodyMass!(qi.plan, ql) <= 0.35 * after.bodyMass!(pi.plan, pl);
    return false;
}

const {displayLength} = await import("../src/ark-scene/sizes.ts");
const reactive = await import("../src/ark-scene/reactive.ts");
const {hashString} = await import("../src/ark-scene/world.ts");
type ReactiveInput = import("../src/ark-scene/reactive.ts").ReactiveInput;
type ReactiveOut = import("../src/ark-scene/reactive.ts").ReactiveOut;
type ReactiveWorld = import("../src/ark-scene/reactive.ts").ReactiveWorld;

const OUT = value("out");
const FPS = 20;
const unit = (key: string) => (hashString(key) % 100000) / 100000;
const pct = (a: number, b: number) => (b ? Math.round((1000 * a) / b) / 10 : 0);
const round = (v: number, k = 10) => Math.round(v * k) / k;
const quantile = (v: number[], q: number) => {
    if (!v.length) return null;
    const s = [...v].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.floor(s.length * q))];
};
const median = (v: number[]) => quantile(v, 0.5);

/** The reactions (it has stopped what it was doing for the predator), and the ones that are a defence of its own. */
const REACTING = new Set<string>(["alert", "freeze", "flee", "threat_display", "play_dead", "shield_young", "hide_behind_parent", "withdraw"]);
const CALM = new Set<string>(["feed", "drink", "scan", "sentinel", "look_kin", "approach_kin", "groom", "doze", "play", "use_tool", "cache_bury", "cache_return", "follow_mixed", "wait_turn", "watch_camera", "investigate_camera", "back_off_camera", "shelter", "watch_prey", "stalk", "wary"]);
const WATER_PLANS = new Set(["fish", "cephalopod_jelly"]);

type Row = {slug: string; zone: string | null; excluded: string | null; plan: string};
const profiles = JSON.parse(fs.readFileSync(path.join(root, "data/ark/behaviour-profiles.json"), "utf8")) as {profiles: Row[]};
const aboard = profiles.profiles.filter((r) => !r.excluded && r.zone && hasIntelProfile(r.slug));

function input(id: string, slug: string, x: number, z: number, shared: Partial<ReactiveInput["shared"]>): ReactiveInput {
    const p = intelProfile(slug);
    const b = behaviourProfile(slug);
    return {id, slug, plan: p.plan, length: displayLength(slug, p.plan), size: b.size, speed: b.speed, gait: b.gait, walkPace: b.walkPace, runPace: b.runPace, roost: b.roost, dominance: b.dominance, social: b.social, diet: b.diet, intel: p, asleep: false, acting: false, shared: {x, y: 0, z, yaw: 0, moving: false, aloft: false, doing: "forage", ...shared}};
}

/** Who could eat it, aboard and in its zone (ground hunters first), as `ark-intelligence-encounters.mts` picks it. */
function predatorFor(prey: Row): Row | null {
    const water = WATER_PLANS.has(prey.plan);
    const eligible = aboard.filter((q) => {
        if (q.slug === prey.slug || q.zone !== prey.zone) return false;
        if (WATER_PLANS.has(q.plan) !== water) return false;
        return kindThreat(q.slug, prey.slug);
    });
    if (!eligible.length) return null;
    const ground = eligible.filter((q) => !["flying_bird", "bat", "flying_insect"].includes(q.plan));
    const pool = ground.length ? ground : eligible;
    return pool.slice().sort((a, b) => unit(`${prey.slug}|${a.slug}`) - unit(`${prey.slug}|${b.slug}`))[0];
}

const calmWorld = (now: number, camera: {x: number; y: number; z: number} | null, extra: Partial<ReactiveWorld> = {}): ReactiveWorld => ({now, dt: 1 / FPS, hours: 10, night: 0, weather: {rain: 0, wind: 0.2, windDirection: 0.4, fog: 0, storm: 0}, camera, ...extra});

// MARK: The fixture: one prey, one predator, by the predator's state

type PredatorAt = {x: number; z: number; yaw: number; moving: boolean; doing: string; asleep?: boolean; chasing?: boolean};
type Scenario = {name: string; state: string; seconds: (walk: number) => number; at: (t: number, walk: number) => PredatorAt};
const SCENARIOS: Scenario[] = [
    {name: "asleep 6 m", state: "asleep", seconds: () => 30, at: () => ({x: 6, z: 0, yaw: 0, moving: false, doing: "sleep", asleep: true})},
    ...[25, 12, 6, 3].map((d): Scenario => ({name: `resting ${d} m`, state: "resting", seconds: () => 60, at: () => ({x: d, z: 0, yaw: Math.PI / 2, moving: false, doing: "rest"})})),
    ...[20, 10, 4].map((d): Scenario => ({name: `passing ${d} m`, state: "passing", seconds: (walk) => 70 / walk, at: (t, walk) => ({x: -35 + t * walk, z: d, yaw: Math.PI / 2, moving: true, doing: "wander"})})),
    {name: "walking at it", state: "approach", seconds: (walk) => 33 / walk + 6, at: (t, walk) => ({x: Math.max(35 - t * walk, 2), z: 0, yaw: -Math.PI / 2, moving: 35 - t * walk > 2, doing: "wander"})},
    {name: "stalking it", state: "stalk", seconds: (walk) => 27 / (walk * 0.35) + 8, at: (t, walk) => ({x: Math.max(30 - t * walk * 0.35, 3), z: 0, yaw: -Math.PI / 2, moving: 30 - t * walk * 0.35 > 3, doing: "stalk"})},
    {name: "chasing past 6 m", state: "chase", seconds: (walk) => 70 / (walk * 3.5), at: (t, walk) => ({x: -35 + t * walk * 3.5, z: 6, yaw: Math.PI / 2, moving: true, doing: "wander", chasing: true})}
];
const AFTER_SECONDS = 90;

type Run = {
    prey: string;
    plan: string;
    predator: string;
    scenario: string;
    state: string;
    defence: string;
    flight: number;
    reactS: number | null;
    reactM: number | null;
    first: string | null;
    fled: boolean;
    fleeM: number | null;
    fleeS: number | null;
    maxOffset: number;
    fleeSpeed: number | null;
    fleeOffAway: number | null;
    called: boolean;
    shares: Record<string, number>;
    /** Shares of the exposure by how it takes the predator (`ReactiveOut.response`; none on a tree before the behaviours pass). */
    responses: Record<string, number>;
    calmS: number | null;
    feedS: number | null;
    endOffset: number;
    nearest: number;
};

function fixtureRun(prey: Row, predator: Row, scenario: Scenario): Run {
    const layer = new reactive.ReactiveLayer({tier: "high"});
    const grazer = behaviourProfile(prey.slug).diet === "grazer";
    const me = input(`${prey.slug}#prey`, prey.slug, 0, 0, {doing: grazer ? "graze" : "forage", yaw: unit(`${prey.slug}#yaw`) * Math.PI * 2});
    const hunter = input(`${predator.slug}#pred`, predator.slug, 100, 0, {});
    const walk = Math.min(Math.max(hunter.length * 1.1, 0.9), 2.2);
    const seconds = scenario.seconds(walk);
    const camera = {x: 0, y: 2.5, z: -40};
    const settle = 3;
    const counts: Record<string, number> = {};
    const responses: Record<string, number> = {};
    let frames = 0;
    let reactS: number | null = null;
    let reactM: number | null = null;
    let first: string | null = null;
    let fled = false;
    let fleeM: number | null = null;
    let fleeS: number | null = null;
    let maxOffset = 0;
    let called = false;
    let fleeDistance = 0;
    let fleeFrames = 0;
    let fleeOffAway: number | null = null;
    let calmS: number | null = null;
    let feedS: number | null = null;
    let nearest = Infinity;
    let last = {dx: 0, dz: 0};
    let o: ReactiveOut | undefined;
    const total = settle + seconds + AFTER_SECONDS;
    for (let k = 0; k < total * FPS; k++) {
        const t = k / FPS - settle;
        const now = 1000 + k / FPS;
        const present = t >= 0 && t < seconds;
        if (present) {
            const at = scenario.at(t, walk);
            hunter.shared = {...hunter.shared, x: at.x, z: at.z, yaw: at.yaw, moving: at.moving, doing: at.doing as never};
            hunter.asleep = Boolean(at.asleep);
            hunter.chasing = Boolean(at.chasing);
        }
        o = layer.step(present ? [me, hunter] : [me], calmWorld(now, camera)).get(me.id);
        if (!o) continue;
        const offset = Math.hypot(o.dx, o.dz);
        if (present) {
            const apart = Math.hypot(hunter.shared.x - me.shared.x - o.dx, hunter.shared.z - me.shared.z - o.dz);
            nearest = Math.min(nearest, Math.hypot(hunter.shared.x, hunter.shared.z));
            frames++;
            counts[o.action] = (counts[o.action] ?? 0) + 1;
            const response = (o as {response?: string | null}).response;
            if (response) responses[response] = (responses[response] ?? 0) + 1;
            const reacting = REACTING.has(o.action) || o.looking === hunter.id;
            if (reacting && reactS === null) {
                reactS = round(t, 100);
                reactM = round(Math.hypot(hunter.shared.x, hunter.shared.z));
                first = REACTING.has(o.action) ? o.action : "look";
            }
            if (o.action === "flee") {
                if (!fled) {
                    fled = true;
                    fleeM = round(apart);
                    fleeS = round(t, 100);
                }
                const step = Math.hypot(o.dx - last.dx, o.dz - last.dz);
                if (step * FPS > 0.05) {
                    fleeDistance += step;
                    fleeFrames++;
                    if (fleeOffAway === null && offset > 0.3) {
                        const away = Math.atan2(me.shared.x - hunter.shared.x, me.shared.z - hunter.shared.z);
                        const went = Math.atan2(o.dx, o.dz);
                        let d = went - away;
                        d = d - Math.round(d / (Math.PI * 2)) * Math.PI * 2;
                        fleeOffAway = Math.round((Math.abs(d) * 180) / Math.PI);
                    }
                }
            }
            if (o.called) called = true;
            maxOffset = Math.max(maxOffset, offset);
        } else if (t >= seconds) {
            const since = t - seconds;
            if (calmS === null && o.alarmed === 0 && !REACTING.has(o.action) && o.action !== "recover") calmS = round(since);
            if (feedS === null && calmS !== null && o.action === "feed") feedS = round(since);
        }
        last = {dx: o.dx, dz: o.dz};
    }
    const shares = Object.fromEntries(Object.entries(counts).map(([k, n]) => [k, pct(n, frames)]));
    return {prey: prey.slug, plan: prey.plan, predator: predator.slug, scenario: scenario.name, state: scenario.state, defence: intelProfile(prey.slug).defence.join(","), flight: intelProfile(prey.slug).flight, reactS, reactM, first, fled, fleeM, fleeS, maxOffset: round(maxOffset), fleeSpeed: fleeFrames ? round((fleeDistance * FPS) / fleeFrames) : null, fleeOffAway, called, shares, responses: Object.fromEntries(Object.entries(responses).map(([k, n]) => [k, pct(n, frames)])), calmS, feedS, endOffset: round(o ? Math.hypot(o.dx, o.dz) : 0), nearest: round(nearest)};
}

function summariseRuns(list: Run[]) {
    const share = (action: string) => round(list.reduce((s, r) => s + (r.shares[action] ?? 0), 0) / Math.max(list.length, 1));
    const reacting = list.map((r) => Object.entries(r.shares).filter(([k]) => REACTING.has(k)).reduce((s, [, v]) => s + v, 0));
    const taking = (response: string) => round(list.reduce((s, r) => s + (r.responses[response] ?? 0), 0) / Math.max(list.length, 1));
    return {
        runs: list.length,
        reactPct: pct(list.filter((r) => r.reactS !== null).length, list.length),
        medianReactS: median(list.filter((r) => r.reactS !== null).map((r) => r.reactS!)),
        medianReactM: median(list.filter((r) => r.reactM !== null).map((r) => r.reactM!)),
        fleePct: pct(list.filter((r) => r.fled).length, list.length),
        medianFleeM: median(list.filter((r) => r.fleeM !== null).map((r) => r.fleeM!)),
        medianFleeSpeed: median(list.filter((r) => r.fleeSpeed !== null).map((r) => r.fleeSpeed!)),
        medianFleeOffAwayDeg: median(list.filter((r) => r.fleeOffAway !== null).map((r) => r.fleeOffAway!)),
        callPct: pct(list.filter((r) => r.called).length, list.length),
        /** Mean share of the exposure spent reacting (not at its own business), and by action. */
        reactingSharePct: round(reacting.reduce((a, b) => a + b, 0) / Math.max(list.length, 1)),
        feed: share("feed"),
        scan: share("scan"),
        alert: share("alert"),
        freeze: share("freeze"),
        flee: share("flee"),
        withdraw: share("withdraw"),
        threat: share("threat_display"),
        tolerate: taking("tolerate"),
        watch: taking("watch"),
        moveOff: taking("move_off"),
        bunch: taking("bunch"),
        hold: taking("hold"),
        ground: taking("ground"),
        stand: taking("stand"),
        medianCalmS: median(list.filter((r) => r.calmS !== null).map((r) => r.calmS!)),
        p90CalmS: quantile(list.filter((r) => r.calmS !== null).map((r) => r.calmS!), 0.9),
        neverCalm: list.filter((r) => r.calmS === null).length,
        medianFeedS: median(list.filter((r) => r.feedS !== null).map((r) => r.feedS!)),
        medianEndOffset: median(list.map((r) => r.endOffset))
    };
}

function fixture() {
    const LIMIT = Number(value("limit", "150"));
    const withPredator = aboard.map((r) => ({prey: r, predator: predatorFor(r)})).filter((p): p is {prey: Row; predator: Row} => Boolean(p.predator));
    const byPlan = new Map<string, Array<{prey: Row; predator: Row}>>();
    for (const p of withPredator) byPlan.set(p.prey.plan, [...(byPlan.get(p.prey.plan) ?? []), p]);
    const pairs: Array<{prey: Row; predator: Row}> = [];
    for (const [, list] of byPlan) {
        const share = Math.max(1, Math.round((LIMIT * list.length) / withPredator.length));
        pairs.push(...list.slice().sort((a, b) => unit(a.prey.slug) - unit(b.prey.slug)).slice(0, share));
    }
    // (And the animals the brief names, whatever the sample: the styles a reader would check first.)
    const NAMED = ["plains-zebra", "red-deer", "roe-deer", "thomsons-gazelle", "impala", "european-hare", "european-rabbit", "grey-partridge", "meerkat", "alpine-marmot", "european-hedgehog", "nine-banded-armadillo", "african-buffalo", "cape-buffalo", "white-rhinoceros", "crested-porcupine", "north-american-porcupine", "striped-skunk", "vervet-monkey", "house-sparrow", "common-starling", "european-robin", "common-frog", "green-iguana", "common-wall-lizard", "mallard", "canada-goose", "domestic-chicken", "red-junglefowl", "hermanns-tortoise", "house-mouse", "red-squirrel", "wild-boar", "warthog", "ostrich", "blue-wildebeest", "giraffe", "african-bush-elephant", "hippopotamus", "honey-badger"];
    for (const slug of NAMED) {
        if (pairs.some((p) => p.prey.slug === slug)) continue;
        const hit = withPredator.find((p) => p.prey.slug === slug);
        if (hit) pairs.push(hit);
    }
    const t0 = performance.now();
    const runs: Run[] = [];
    for (const {prey, predator} of pairs) for (const scenario of SCENARIOS) runs.push(fixtureRun(prey, predator, scenario));
    const byScenario = Object.fromEntries(SCENARIOS.map((s) => [s.name, summariseRuns(runs.filter((r) => r.scenario === s.name))]));
    const byState = Object.fromEntries(Array.from(new Set(SCENARIOS.map((s) => s.state))).map((s) => [s, summariseRuns(runs.filter((r) => r.state === s))]));
    // By the prey's first defence (its style), the close scenarios only: what the style does when it matters.
    const closeNames = new Set(["resting 3 m", "passing 4 m", "walking at it", "stalking it"]);
    const styles = Array.from(new Set(runs.map((r) => r.defence.split(",")[0] || "none"))).sort();
    const byStyle = Object.fromEntries(styles.map((s) => [s, summariseRuns(runs.filter((r) => closeNames.has(r.scenario) && (r.defence.split(",")[0] || "none") === s))]));
    const summary = {mode: "fixture", pairs: pairs.length, runs: runs.length, ms: Math.round(performance.now() - t0), all: summariseRuns(runs), byState, byScenario, byStyle};
    if (OUT) fs.writeFileSync(OUT, JSON.stringify({summary, runs}, null, 1));
    const line = (name: string, s: ReturnType<typeof summariseRuns>) => `| ${name} | ${s.runs} | ${s.reactPct}% | ${s.medianReactS ?? "–"} | ${s.medianReactM ?? "–"} | ${s.fleePct}% | ${s.medianFleeM ?? "–"} | ${s.reactingSharePct}% | ${s.feed}% | ${s.alert}% | ${s.freeze}% | ${s.flee}% | ${s.withdraw}% | ${s.threat}% | ${s.tolerate}% | ${s.moveOff}% | ${s.bunch}% | ${s.hold + s.ground}% | ${s.callPct}% | ${s.medianCalmS ?? "–"} / ${s.p90CalmS ?? "–"} (${s.neverCalm}) | ${s.medianFeedS ?? "–"} |`;
    console.log(`fixture: ${pairs.length} prey species, ${runs.length} runs, ${summary.ms} ms`);
    console.log("| Predator | Runs | React | Median s to react | Median m when it reacts | Flee | Median m when it runs | Share of exposure reacting | feeding | alert | frozen | fleeing | withdrawn | display | tolerating | moving off | bunching | holding where it ran | Call | Calm after it is gone: median / p90 s (never) | Feeds again s |");
    console.log("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|");
    for (const [name, s] of Object.entries(byScenario)) console.log(line(name, s));
    console.log("\nBy the prey's first defence (resting 3 m, passing 4 m, walking at it, stalking it):");
    for (const [name, s] of Object.entries(byStyle)) console.log(line(name, s));
    const named = runs.filter((r) => NAMED.includes(r.prey) && ["resting 12 m", "walking at it", "stalking it"].includes(r.scenario));
    console.log("\nNamed animals (resting 12 m | walking at it | stalking it): first reaction @ m, fled @ m, shares");
    for (const slug of NAMED) {
        const mine = named.filter((r) => r.prey === slug);
        if (!mine.length) continue;
        const cell = (r: Run) => `${r.first ?? "nothing"}@${r.reactM ?? "–"}${r.fled ? ` flee@${r.fleeM} ${r.maxOffset}m ${r.fleeSpeed}m/s` : ""} [${Object.entries(r.shares).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ${Math.round(v)}`).join(", ")}]${Object.keys(r.responses).length ? ` {${Object.entries(r.responses).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ${Math.round(v)}`).join(", ")}}` : ""} calm ${r.calmS ?? "never"}`;
        console.log(`${slug} (${mine[0].defence}; flight ${mine[0].flight}) ← ${mine[0].predator}: ${mine.map(cell).join(" | ")}`);
    }
}

// MARK: Groups: vigilance by herd size and place, and a herd's response

function groups() {
    const herders = aboard.filter((r) => r.plan === "quadruped" && ["herd", "group", "troop", "colony"].includes(behaviourProfile(r.slug).social) && ["grazer", "browser"].includes(behaviourProfile(r.slug).diet) && predatorFor(r));
    const flockers = aboard.filter((r) => ["flying_bird", "walking_bird"].includes(r.plan) && behaviourProfile(r.slug).social === "flock" && predatorFor(r));
    const sentinels = aboard.filter((r) => intelProfile(r.slug).sentinel && predatorFor(r));
    const pick = (list: Row[], n: number) => list.slice().sort((a, b) => unit(`g${a.slug}`) - unit(`g${b.slug}`)).slice(0, n);
    const sample = [...pick(herders, 24), ...pick(flockers, 12), ...pick(sentinels, 8)];
    const rows: Array<Record<string, number | string | null>> = [];
    for (const prey of sample) {
        const predator = predatorFor(prey)!;
        for (const size of [1, 5, 12]) {
            const layer = new reactive.ReactiveLayer({tier: "high"});
            const b = behaviourProfile(prey.slug);
            const L = displayLength(prey.slug, intelProfile(prey.slug).plan);
            const spacing = Math.max(L * 2.2, 0.8);
            // A seeded cluster: rings round the first, jittered.
            const herd: ReactiveInput[] = [];
            for (let i = 0; i < size; i++) {
                const ring = i === 0 ? 0 : i <= 5 ? 1 : 2;
                const a = unit(`${prey.slug}#${size}#${i}#a`) * Math.PI * 2 + i * 2.4;
                const r = ring * spacing * (0.8 + 0.4 * unit(`${prey.slug}#${size}#${i}#r`));
                herd.push(input(`${prey.slug}#${size}#${i}`, prey.slug, Math.sin(a) * r, Math.cos(a) * r, {doing: b.diet === "grazer" ? "graze" : "forage", yaw: unit(`${prey.slug}#${size}#${i}#y`) * Math.PI * 2}));
            }
            const cx = herd.reduce((s, h) => s + h.shared.x, 0) / size;
            const cz = herd.reduce((s, h) => s + h.shared.z, 0) / size;
            const fromCentre = herd.map((h) => Math.hypot(h.shared.x - cx, h.shared.z - cz));
            const edgeCut = median(fromCentre) ?? 0;
            const camera = {x: 0, y: 2.5, z: -45};
            // Calm: two minutes. Heads up = scan, sentinel or alert (not feeding, not its own business with the head down).
            const UP = new Set(["scan", "sentinel", "alert"]);
            const up = herd.map(() => 0);
            let frames = 0;
            let anyUp = 0;
            let watchFrames = 0;
            for (let k = 0; k < 120 * FPS; k++) {
                const out = layer.step(herd, calmWorld(1000 + k / FPS, camera));
                frames++;
                let some = false;
                herd.forEach((h, i) => {
                    const o = out.get(h.id);
                    if (o && UP.has(o.action)) {
                        up[i]++;
                        some = true;
                    }
                    if (o?.action === "sentinel") watchFrames++;
                });
                if (some) anyUp++;
            }
            const edge = herd.map((_, i) => i).filter((i) => size > 1 && fromCentre[i] > edgeCut);
            const inner = herd.map((_, i) => i).filter((i) => size > 1 && fromCentre[i] <= edgeCut);
            const mean = (idx: number[]) => (idx.length ? pct(idx.reduce((s, i) => s + up[i], 0), idx.length * frames) : null);
            // Then the predator walks at the herd from 40 m, stops 2 m short of the nearest, stays 5 s; gone; 60 s more.
            const hunter = input(`${predator.slug}#pred`, predator.slug, 40, 0, {doing: "wander", moving: true, yaw: -Math.PI / 2});
            const walk = Math.min(Math.max(hunter.length * 1.1, 0.9), 2.2);
            const front = Math.max(...herd.map((h) => h.shared.x)) + 2;
            const approach = (40 - front) / walk;
            const noticed: Array<number | null> = herd.map(() => null);
            const fled: Array<number | null> = herd.map(() => null);
            const called: number[] = [];
            let spreadBefore = 0;
            let spreadMin = Infinity;
            let spreadMax = 0;
            let calmAll: number | null = null;
            const spreadOf = (out: Map<string, ReactiveOut>) => {
                const pts = herd.map((h) => ({x: h.shared.x + (out.get(h.id)?.dx ?? 0), z: h.shared.z + (out.get(h.id)?.dz ?? 0)}));
                const mx = pts.reduce((s, p) => s + p.x, 0) / size;
                const mz = pts.reduce((s, p) => s + p.z, 0) / size;
                return pts.reduce((s, p) => s + Math.hypot(p.x - mx, p.z - mz), 0) / size;
            };
            for (let k = 0; k < (approach + 5 + 60) * FPS; k++) {
                const t = k / FPS;
                const now = 1000 + 120 + t;
                const present = t < approach + 5;
                hunter.shared.x = Math.max(40 - t * walk, front);
                hunter.shared.moving = t < approach;
                const out = layer.step(present ? [...herd, hunter] : herd, calmWorld(now, camera));
                if (k === 0) spreadBefore = spreadOf(out);
                if (present) {
                    const s = spreadOf(out);
                    spreadMin = Math.min(spreadMin, s);
                    spreadMax = Math.max(spreadMax, s);
                }
                let calm = true;
                herd.forEach((h, i) => {
                    const o = out.get(h.id);
                    if (!o) return;
                    if (present && noticed[i] === null && (REACTING.has(o.action) || o.looking === hunter.id || o.looking === "sound")) noticed[i] = t;
                    if (present && fled[i] === null && o.action === "flee") fled[i] = t;
                    if (o.called) called.push(t);
                    if (o.alarmed > 0 || REACTING.has(o.action) || o.action === "recover") calm = false;
                });
                if (!present && calm && calmAll === null) calmAll = t - approach - 5;
            }
            const noticedT = noticed.filter((v): v is number => v !== null);
            const fledT = fled.filter((v): v is number => v !== null);
            rows.push({
                prey: prey.slug,
                kind: intelProfile(prey.slug).sentinel ? "sentinel" : prey.plan === "quadruped" ? "herd" : "flock",
                size,
                headUpPct: pct(up.reduce((a, c) => a + c, 0), size * frames),
                headUpEdgePct: mean(edge),
                headUpInnerPct: mean(inner),
                someoneUpPct: pct(anyUp, frames),
                sentinelPct: pct(watchFrames, frames),
                noticedPct: pct(noticedT.length, size),
                firstNoticeM: noticedT.length ? round(40 - Math.min(...noticedT) * walk) : null,
                noticeSpreadS: noticedT.length > 1 ? round(Math.max(...noticedT) - Math.min(...noticedT)) : null,
                fledPct: pct(fledT.length, size),
                fleeSpreadS: fledT.length > 1 ? round(Math.max(...fledT) - Math.min(...fledT)) : null,
                calls: called.length,
                bunch: size > 1 && spreadBefore > 0 ? round(spreadMin / spreadBefore, 100) : null,
                scatter: size > 1 && spreadBefore > 0 ? round(spreadMax / spreadBefore, 100) : null,
                calmAllS: calmAll === null ? null : round(calmAll)
            });
        }
    }
    const num = (list: typeof rows, key: string) => list.map((r) => r[key]).filter((v): v is number => typeof v === "number");
    const summary: Record<string, unknown> = {mode: "groups", species: sample.length};
    for (const kind of ["herd", "flock", "sentinel"]) {
        for (const size of [1, 5, 12]) {
            const list = rows.filter((r) => r.kind === kind && r.size === size);
            summary[`${kind} of ${size}`] = {
                groups: list.length,
                headUpPct: median(num(list, "headUpPct")),
                headUpEdgePct: median(num(list, "headUpEdgePct")),
                headUpInnerPct: median(num(list, "headUpInnerPct")),
                someoneUpPct: median(num(list, "someoneUpPct")),
                sentinelPct: median(num(list, "sentinelPct")),
                noticedPct: median(num(list, "noticedPct")),
                firstNoticeM: median(num(list, "firstNoticeM")),
                noticeSpreadS: median(num(list, "noticeSpreadS")),
                fledPct: median(num(list, "fledPct")),
                fleeSpreadS: median(num(list, "fleeSpreadS")),
                calls: median(num(list, "calls")),
                bunch: median(num(list, "bunch")),
                scatter: median(num(list, "scatter")),
                calmAllS: median(num(list, "calmAllS"))
            };
        }
    }
    if (OUT) fs.writeFileSync(OUT, JSON.stringify({summary, rows}, null, 1));
    console.log(JSON.stringify(summary, null, 1));
}

// MARK: The real snapshot

async function real() {
    const source = args[1];
    if (!source || source.startsWith("--")) throw new Error("real: give the snapshot file");
    const {decodeArkSnapshot} = await import("../src/ark-scene/snapshot.ts");
    const {arkBody} = await import("../src/ark-scene/stats.ts");
    const sched = await import("../src/ark-scene/behaviour-schedule.ts");
    const {wireRecipes} = await import("../src/ark-scene/behaviour-recipes.ts");
    const {eats} = await import("../src/ark-scene/food-links.ts");
    const {mapHabitatAt, onSchedule, scheduleRoost} = await import("../src/ark-scene/map/place.ts");
    const {placeAnimals} = await import("../src/ark-scene/placement.ts");
    const {onBehaviourSchedule} = await import("../src/ark-scene/schedule-water.ts");
    const {worldSampler} = await import("../src/ark-scene/world-sampler.ts");
    const {heightAt, ZONE_SITES} = await import("../src/ark-scene/world.ts");
    const {islandHours} = await import("../src/lib/ark-clock.ts");
    const {daylightAt} = await import("../src/lib/ark-daylight.ts");
    const {modelBase} = await import("../src/ark-scene/grounding/base.ts");
    const {reactiveWorldQueries} = await import("../src/ark-scene/reactive-world.ts");
    type ArkAnimal = import("../src/ark-scene/types.ts").ArkAnimal;
    const routingPath = value("islands");
    let raw: unknown = JSON.parse(fs.readFileSync(source, "utf8"));
    if (routingPath) raw = (await import("../src/lib/ark-islands-local.ts")).mergeArkIslandsRouting(raw, JSON.parse(fs.readFileSync(routingPath, "utf8"))).merged;
    const local = (await import("../src/lib/ark-local-snapshot.ts")).arkLocalSnapshotOf(raw);
    const snapshot = local?.snapshot ?? decodeArkSnapshot(raw);
    if (!snapshot) throw new Error("not a snapshot");
    const animals: ArkAnimal[] = routingPath ? (await import("../src/lib/ark-islands.ts")).arkIslandSnapshot(snapshot, "wild").animals : snapshot.animals.filter((a) => !(a as {area?: string | null}).area);
    const GROUPED = new Set(["herd", "flock", "school", "troop", "pack", "group", "colony", "swarm"]);
    const sampler = worldSampler();
    const world = sched.scheduleWorld(sampler);
    const places = placeAnimals(animals);
    type Subject = {animal: ArkAnimal; place: NonNullable<ReturnType<typeof places.get>>; length: number; placed: {x: number; z: number}; sched: {profile: ReturnType<typeof behaviourProfile>; animal: import("../src/ark-scene/behaviour-schedule.ts").ScheduleAnimal; trip: import("../src/ark-scene/behaviour-schedule.ts").Trip | null} | null};
    const subjects: Subject[] = animals.map((animal) => {
        const place = places.get(animal.id)!;
        const plan = modelBase(animal.model_slug)?.plan ?? null;
        const body = arkBody(animal, plan);
        const on = onSchedule(place, animal.model_slug) && onBehaviourSchedule(animal.model_slug);
        return {animal, place, length: body.display, placed: {x: place.x, z: place.z}, sched: on ? {profile: behaviourProfile(animal.model_slug, plan), animal: sched.withLazyRoost({id: animal.id, zone: animal.zone, home: {x: place.x, y: place.ground, z: place.z}, length: body.display, sea: ZONE_SITES[animal.zone]?.kind === "sea"}, () => scheduleRoost(place, animal.zone)), trip: null} : null};
    });
    // The scene's wiring (as `scripts/ark-time-budget.mts`): groups, spaced homes, threats, recipes.
    let moved = 0;
    {
        const byId = new Map(subjects.map((s) => [s.animal.id, s]));
        const onIt = subjects.filter((s) => s.sched);
        const leaderOf = (s: Subject) => (s.place.leader && s.place.leader !== s.animal.id ? byId.get(s.place.leader) ?? null : null);
        const sizes = new Map<Subject, number>();
        for (const s of onIt) {
            const leader = leaderOf(s);
            if (leader?.sched) sizes.set(leader, (sizes.get(leader) ?? 1) + 1);
        }
        const groupOf = new Map<Subject, import("../src/ark-scene/behaviour-schedule.ts").ScheduleGroup | null>();
        for (const s of onIt) {
            const leader = leaderOf(s);
            const ok = leader && leader.sched && leader.animal.model_slug === s.animal.model_slug && GROUPED.has(s.sched!.profile.social) ? leader : null;
            groupOf.set(s, ok ? {leader: ok.sched!.animal, profile: ok.sched!.profile, activity: ok.animal.activity, rank: Math.max(s.place.rank ?? 1, 1), size: sizes.get(ok) ?? 2} : null);
        }
        const nav = world.nav;
        const radius = new Map(onIt.map((s) => [s.animal.id, sched.rangeReach(s.sched!.profile, s.sched!.animal) + (sizes.has(s) ? sched.groupSpread(s.length, sizes.get(s)!) : 0)]));
        // `--wide-spacing` (a what-if, not the scene's): homes spaced by the reactive layer's links too, where both live
        // on land (fish of one water cannot be put 20 m apart), to size what widening `spaceHomes` would do.
        const wide = args.includes("--wide-spacing");
        const onLand = (slug: string) => !WATER_PLANS.has(intelProfile(slug).plan) && behaviourProfile(slug).move !== "swim";
        const links = wide ? (p: string, q: string) => eats(p, q) || (onLand(p) && onLand(q) && displayLength(p, intelProfile(p).plan) >= 0.4 && kindThreat(p, q)) : eats;
        const spaced = sched.spaceHomes(
            onIt.filter((s) => !groupOf.get(s)).map((s) => ({id: s.animal.id, slug: s.animal.model_slug, home: {x: s.sched!.animal.home.x, z: s.sched!.animal.home.z}, length: s.length, walkable: (x: number, z: number) => (s.sched!.profile.move === "swim" || s.sched!.profile.seabed ? nav.swimmable(x, z, 0.5) : s.sched!.profile.move === "fly" ? heightAt(x, z) > 0.05 && mapHabitatAt(s.animal, x, z, 5) : nav.walkable(x, z) && mapHabitatAt(s.animal, x, z, 5))})),
            links,
            (id) => radius.get(id) ?? 3
        );
        let shrunk = 0;
        let tiny = 0;
        spaced.forEach((to) => {
            if (to.range !== null) shrunk++;
            if (to.range !== null && to.range < 2) tiny++;
        });
        console.log(`spaceHomes${wide ? " (wide what-if)" : ""}: ${spaced.size} animals touched, ${shrunk} with a range cap, ${tiny} capped under 2 m`);
        for (const s of onIt) {
            const own = s.sched!;
            own.animal.group = groupOf.get(s) ?? null;
            own.animal.young = false;
            const to = spaced.get(s.animal.id);
            if (to) {
                if (Math.hypot(to.home.x - own.animal.home.x, to.home.z - own.animal.home.z) > 0.5) moved++;
                own.animal.home = {x: to.home.x, y: Math.max(heightAt(to.home.x, to.home.z), 0), z: to.home.z};
                own.animal.range = to.range === null ? null : sizes.has(s) ? to.range / 2 : to.range;
                own.animal.prey = to.prey;
            }
        }
        for (const s of onIt) {
            const lead = s.sched!.animal.group?.leader;
            const leader = leaderOf(s);
            if (!lead || !leader || !spaced.has(leader.animal.id)) continue;
            s.sched!.animal.home = {...lead.home};
            s.sched!.animal.range = lead.range;
        }
        const list = onIt.map((s) => ({slug: s.animal.model_slug, animal: s.sched!.animal, profile: s.sched!.profile, activity: s.animal.activity}));
        sched.wireThreats(list, eats);
        sched.forgetSchedules();
        wireRecipes(list.map((w) => ({animal: w.animal, profile: w.profile, slug: w.slug, activity: w.activity})));
    }
    const onIt = subjects.filter((s) => s.sched);
    const hoursAt = (epoch: number) => islandHours(epoch * 1000, 0);
    const intelOf = (s: Subject) => intelProfile(s.animal.model_slug, null, null);
    // Who hunts whom here: the reactive layer's own sense (`canEat`, the intelligence profiles' food groups and the
    // size stat), and the schedule's (`eats`, the food links the homes are spaced by).
    const kinds = Array.from(new Set(onIt.map((s) => s.animal.model_slug)));
    const hunterKinds = kinds.filter((k) => intelProfile(k).hunt.some((h) => h !== "filter" && h !== "scavenge"));
    const reacts = new Map<string, Set<string>>();
    let reactLinks = 0;
    let spacedLinks = 0;
    let bothLinks = 0;
    for (const p of hunterKinds) {
        const set = new Set<string>();
        for (const q of kinds) {
            if (q === p) continue;
            const a = kindThreat(p, q);
            if (a) set.add(q);
            const b = eats(p, q);
            if (a) reactLinks++;
            if (b) spacedLinks++;
            if (a && b) bothLinks++;
        }
        if (set.size) reacts.set(p, set);
    }
    for (const p of kinds) if (!hunterKinds.includes(p)) for (const q of kinds) if (q !== p && eats(p, q)) spacedLinks++;
    console.log(`real: ${animals.length} animals, ${onIt.length} on the schedule, ${kinds.length} kinds; predators moved by spaceHomes ${moved}`);
    console.log(`links between kinds aboard: the reactive layer reacts to ${reactLinks} (hunters only), homes are spaced by ${spacedLinks} (food links), both ${bothLinks}`);
    const homesOnly = args.includes("--homes-only");

    type Pose = {x: number; y: number; z: number; yaw: number; moving: boolean; aloft: boolean; doing: string; point: string | null};
    const poseOf = (s: Subject, epoch: number): Pose => {
        const own = s.sched!;
        if (!own.trip || epoch < own.trip.start || epoch >= own.trip.end) own.trip = sched.tripAt(world, own.profile, own.animal, epoch, hoursAt, s.animal.activity, own.trip);
        const at = sched.poseOnTrip(world, own.trip, epoch);
        return {x: at.x, y: at.y, z: at.z, yaw: at.yaw, moving: at.moving, aloft: at.aloft, doing: own.trip.doing, point: own.trip.to.point ?? null};
    };
    const start = Date.UTC(2026, 10, 12) / 1000;
    const WINDOWS = Array.from({length: 12}, (_, i) => start + i * 7200);
    const STEP = 30;
    const RESTFUL = new Set(["rest", "idle", "groom", "bask", "perch", "hide", "sleep", "to_roost", "watch"]);
    const stateOf = (p: Pose) => (p.doing === "sleep" ? "asleep" : p.doing === "stalk" ? "stalking" : p.moving ? "walking" : RESTFUL.has(p.doing) ? "resting" : "busy");
    const band = (d: number) => (d < 3 ? "<3" : d < 6 ? "3-6" : d < 12 ? "6-12" : "12-25");
    const tally = new Map<string, number>();
    const add = (k: string, n = 1) => tally.set(k, (tally.get(k) ?? 0) + n);
    type Moment = {epoch: number; prey: number; hunter: number; d: number; state: string};
    const moments: Moment[] = [];
    const closeRest = new Map<string, number>();
    const pairsSeen = new Set<string>();
    let samples = 0;
    let preyAwakeSamples = 0;
    let preyWatch = 0;
    const watchBy = new Map<string, number>();
    const t0 = performance.now();
    for (const from of homesOnly ? [] : WINDOWS) {
        for (let t = 0; t < 600; t += STEP) {
            const epoch = from + t;
            const poses = onIt.map((s) => poseOf(s, epoch));
            samples++;
            const cell = 25;
            const grid = new Map<number, number[]>();
            const key = (cx: number, cz: number) => (cx + 4096) * 8192 + (cz + 4096);
            onIt.forEach((s, i) => {
                if (!reacts.has(s.animal.model_slug) || poses[i].aloft) return;
                const k = key(Math.floor(poses[i].x / cell), Math.floor(poses[i].z / cell));
                const list = grid.get(k);
                if (list) list.push(i);
                else grid.set(k, [i]);
            });
            onIt.forEach((s, i) => {
                const p = poses[i];
                if (p.aloft) return;
                const asleep = p.doing === "sleep";
                if (!asleep) {
                    preyAwakeSamples++;
                    if (p.doing === "watch" && s.sched!.animal.threats?.length) {
                        preyWatch++;
                    }
                }
                let best: {j: number; d: number} | null = null;
                const cx = Math.floor(p.x / cell);
                const cz = Math.floor(p.z / cell);
                for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
                    for (const j of grid.get(key(cx + a, cz + b)) ?? []) {
                        if (j === i || !reacts.get(onIt[j].animal.model_slug)!.has(s.animal.model_slug)) continue;
                        const d = Math.hypot(poses[j].x - p.x, poses[j].z - p.z);
                        if (d <= 25 && (!best || d < best.d)) best = {j, d};
                    }
                }
                if (!best) return;
                const h = poses[best.j];
                const hs = stateOf(h);
                const ps = asleep ? "asleep" : RESTFUL.has(p.doing) ? "resting" : "up";
                add(`prey ${ps} | hunter ${hs} | ${band(best.d)}`);
                add(`hunter ${hs}`);
                if (p.doing === "watch") watchBy.set(hs, (watchBy.get(hs) ?? 0) + 1);
                pairsSeen.add(`${s.animal.model_slug}<${onIt[best.j].animal.model_slug}`);
                if (best.d < 5 && (ps === "asleep" || ps === "resting") && (hs === "asleep" || hs === "resting")) {
                    const k = `${s.animal.model_slug} by ${onIt[best.j].animal.model_slug}`;
                    closeRest.set(k, (closeRest.get(k) ?? 0) + 1);
                }
                if (!asleep && hs !== "asleep") moments.push({epoch, prey: i, hunter: best.j, d: best.d, state: hs});
            });
        }
    }
    if (homesOnly) {
        homesReport();
        return;
    }
    const total = Array.from(tally.entries()).filter(([k]) => k.startsWith("prey ")).reduce((s, [, n]) => s + n, 0);
    console.log(`\nschedule only, ${samples} moments through the day (${Math.round(performance.now() - t0)} ms): prey on the ground with a hunter of it within 25 m: ${total} animal-moments (${round(total / samples)} at a time), ${pairsSeen.size} kind pairs`);
    console.log("by the hunter's state:", Object.fromEntries(["asleep", "resting", "busy", "walking", "stalking"].map((s) => [s, tally.get(`hunter ${s}`) ?? 0])));
    console.log("| Prey | Hunter | <3 m | 3-6 m | 6-12 m | 12-25 m |\n|---|---|---|---|---|---|");
    for (const ps of ["up", "resting", "asleep"]) for (const hs of ["asleep", "resting", "busy", "walking", "stalking"]) {
        const cells = ["<3", "3-6", "6-12", "12-25"].map((b) => tally.get(`prey ${ps} | hunter ${hs} | ${b}`) ?? 0);
        if (cells.some(Boolean)) console.log(`| ${ps} | ${hs} | ${cells.join(" | ")} |`);
    }
    const restTotal = Array.from(closeRest.values()).reduce((a, b) => a + b, 0);
    console.log(`\nresting or asleep within 5 m of a resting or sleeping hunter of it: ${restTotal} animal-moments (${round(restTotal / samples)} at a time), ${closeRest.size} kind pairs; the most:`);
    for (const [k, n] of Array.from(closeRest.entries()).sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log(`  ${n}  ${k}  (schedule spaces them: ${eats(k.split(" by ")[1], k.split(" by ")[0])})`);
    console.log(`\nshared wariness: awake prey moments on the schedule's watch with a predator wired ${preyWatch} of ${preyAwakeSamples} (${pct(preyWatch, preyAwakeSamples)}%); watching with a hunter within 25 m, by its state:`, Object.fromEntries(watchBy));
    homesReport();
    // Homes: each hunter's nearest prey home (the reactive layer's links), as the audit's "within 5 m".
    function homesReport() {
        let within5 = 0;
        let within10 = 0;
        let hunters = 0;
        const closeKinds = new Map<string, number>();
        onIt.forEach((s) => {
            const prey = reacts.get(s.animal.model_slug);
            if (!prey) return;
            let best = Infinity;
            let who = "";
            for (const q of onIt) {
                if (!prey.has(q.animal.model_slug)) continue;
                const d = Math.hypot(s.sched!.animal.home.x - q.sched!.animal.home.x, s.sched!.animal.home.z - q.sched!.animal.home.z);
                if (d < best) {
                    best = d;
                    who = q.animal.model_slug;
                }
            }
            if (!Number.isFinite(best)) return;
            hunters++;
            if (best < 5) {
                within5++;
                const k = `${s.animal.model_slug} > ${who} (spaced: ${eats(s.animal.model_slug, who)})`;
                closeKinds.set(k, (closeKinds.get(k) ?? 0) + 1);
            }
            if (best < 10) within10++;
        });
        console.log(`\nhomes: hunters with a prey home (the reactive layer's links) within 5 m ${within5}, within 10 m ${within10}, of ${hunters}; the most:`);
        for (const [k, n] of Array.from(closeKinds.entries()).sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log(`  ${n}  ${k}`);
    }

    // The reactive layer round a seeded sample of the moments, by the hunter's state and the distance.
    const STOPS = Number(value("stops", "80"));
    const cells = new Map<string, Moment[]>();
    for (const m of moments) {
        const k = `${m.state} | ${band(m.d)}`;
        cells.set(k, [...(cells.get(k) ?? []), m]);
    }
    const chosen: Moment[] = [];
    const perCell = Math.max(1, Math.floor(STOPS / Math.max(cells.size, 1)));
    for (const [k, list] of cells) {
        const seen = new Set<number>();
        for (const m of list.slice().sort((a, b) => unit(`${k}${a.epoch}${a.prey}`) - unit(`${k}${b.epoch}${b.prey}`))) {
            if (seen.has(m.prey)) continue;
            seen.add(m.prey);
            chosen.push(m);
            if (seen.size >= perCell) break;
        }
    }
    const queries = reactiveWorldQueries(sampler, 6);
    const budget = reactive.REACTIVE_BUDGET.medium;
    const SECONDS = 40;
    const rows: Array<{state: string; band: string; prey: string; hunter: string; reactS: number | null; fled: boolean; shares: Record<string, number>}> = [];
    const t1 = performance.now();
    for (const m of chosen) {
        const layer = new reactive.ReactiveLayer({tier: "medium"});
        const me = onIt[m.prey];
        const at0 = poseOf(me, m.epoch);
        const near = onIt.filter((s) => Math.hypot(s.sched!.animal.home.x - at0.x, s.sched!.animal.home.z - at0.z) < budget.radius + budget.reach + 30);
        const h0 = poseOf(onIt[m.hunter], m.epoch);
        const ax = at0.x - h0.x;
        const az = at0.z - h0.z;
        const al = Math.hypot(ax, az) || 1;
        const counts: Record<string, number> = {};
        let frames = 0;
        let reactS: number | null = null;
        let fled = false;
        const R = 10;
        for (let k = 0; k < SECONDS * R; k++) {
            const t = m.epoch + k / R;
            const hours = hoursAt(t);
            const mine = poseOf(me, t);
            const camera = {x: mine.x + (ax / al) * 12, y: Math.max(heightAt(mine.x + (ax / al) * 12, mine.z + (az / al) * 12), 0) + 3, z: mine.z + (az / al) * 12};
            const inputs: ReactiveInput[] = [];
            for (const s of near) {
                const p = poseOf(s, t);
                if (Math.hypot(p.x - camera.x, p.z - camera.z) > budget.radius + budget.reach) continue;
                const io = intelOf(s);
                const b = s.sched!.profile;
                inputs.push({id: s.animal.id, slug: s.animal.model_slug, plan: io.plan, length: s.length, size: b.size, speed: b.speed, gait: b.gait, walkPace: b.walkPace, runPace: b.runPace, roost: b.roost, dominance: b.dominance, social: b.social, diet: b.diet, intel: io, asleep: p.doing === "sleep", acting: false, parentId: null, youngPlay: 0, headHeight: s.length * 0.5, shared: {x: p.x, y: p.y, z: p.z, yaw: p.yaw, moving: p.moving, aloft: p.aloft, doing: p.doing as never, spot: p.point}});
            }
            const out = layer.step(inputs, {now: t, dt: 1 / R, hours, night: daylightAt(hours).night, weather: {rain: 0, wind: 0.3, windDirection: 0, fog: 0, storm: 0}, camera, sight: queries.sight, refuge: queries.refuge});
            const o = out.get(me.animal.id);
            if (!o || o.action === "off" || o.action === "asleep" || o.action === "aloft") continue;
            frames++;
            counts[o.action] = (counts[o.action] ?? 0) + 1;
            const hunterIds = new Set(inputs.filter((i) => reacts.get(i.slug)?.has(me.animal.model_slug)).map((i) => i.id));
            if (reactS === null && (REACTING.has(o.action) || (o.looking !== null && hunterIds.has(o.looking)))) reactS = k / R;
            if (o.action === "flee") fled = true;
        }
        if (!frames) continue;
        rows.push({state: m.state, band: band(m.d), prey: me.animal.model_slug, hunter: onIt[m.hunter].animal.model_slug, reactS, fled, shares: Object.fromEntries(Object.entries(counts).map(([k, n]) => [k, pct(n, frames)]))});
    }
    console.log(`\nthe reactive layer round ${rows.length} of those moments (${SECONDS} s each, medium tier, terrain and cover; ${Math.round(performance.now() - t1)} ms):`);
    console.log("| Hunter | Distance | Stops | React | Median s | Flee | Share reacting | calm (own business) | alert | frozen | fleeing | recovering |\n|---|---|---|---|---|---|---|---|---|---|---|---|");
    const share = (list: typeof rows, pick: (k: string) => boolean) => round(list.reduce((s, r) => s + Object.entries(r.shares).filter(([k]) => pick(k)).reduce((a, [, v]) => a + v, 0), 0) / Math.max(list.length, 1));
    const lineOf = (name: string, bandName: string, list: typeof rows) => `| ${name} | ${bandName} | ${list.length} | ${pct(list.filter((r) => r.reactS !== null).length, list.length)}% | ${median(list.filter((r) => r.reactS !== null).map((r) => r.reactS!)) ?? "–"} | ${pct(list.filter((r) => r.fled).length, list.length)}% | ${share(list, (k) => REACTING.has(k))}% | ${share(list, (k) => CALM.has(k))}% | ${share(list, (k) => k === "alert")}% | ${share(list, (k) => k === "freeze")}% | ${share(list, (k) => k === "flee")}% | ${share(list, (k) => k === "recover")}% |`;
    for (const hs of ["resting", "busy", "walking", "stalking"]) for (const b of ["<3", "3-6", "6-12", "12-25"]) {
        const list = rows.filter((r) => r.state === hs && r.band === b);
        if (list.length) console.log(lineOf(hs, b, list));
    }
    console.log(lineOf("all", "all", rows));
    if (OUT) fs.writeFileSync(OUT, JSON.stringify({tally: Object.fromEntries(tally), closeRest: Object.fromEntries(closeRest), rows}, null, 1));
}

// MARK: The town island, where its animals are placed

async function town() {
    const source = args[1];
    const routingPath = value("islands");
    if (!source || source.startsWith("--") || !routingPath) throw new Error("town: give the snapshot file and --islands routing.json");
    const {decodeArkSnapshot} = await import("../src/ark-scene/snapshot.ts");
    const {placeTownAnimals} = await import("../src/ark-scene/islands/town/placement.ts");
    const merged = (await import("../src/lib/ark-islands-local.ts")).mergeArkIslandsRouting(JSON.parse(fs.readFileSync(source, "utf8")), JSON.parse(fs.readFileSync(routingPath, "utf8"))).merged;
    const snapshot = decodeArkSnapshot((merged as {snapshot?: unknown}).snapshot ?? merged);
    if (!snapshot) throw new Error("not a snapshot");
    const animals = (await import("../src/lib/ark-islands.ts")).arkIslandSnapshot(snapshot, "town").animals;
    const placed = placeTownAnimals(animals);
    type Kept = "house" | "farm" | "zoo" | null;
    type One = {slug: string; x: number; z: number; kept: Kept; pen: string | null; held: boolean};
    const ones: One[] = [];
    for (const a of animals) {
        const place = placed.places.get(a.id);
        const info = placed.town.get(a.id);
        if (!place || !info || !hasIntelProfile(a.model_slug)) continue;
        const area = (a as {area?: string | null}).area ?? null;
        ones.push({slug: a.model_slug, x: place.x, z: place.z, kept: area === "house" || area === "farm" || area === "zoo" ? area : null, pen: (a as {enclosure?: string | null}).enclosure ?? null, held: info.still || Boolean(info.tank) || Boolean(info.display)});
    }
    // The layer's rule (`reactive.ts` `apart`): a zoo animal is apart from everything (its fence, and the habit of the ones it is kept with); the animals of homes and farms are used to one another.
    const apart = (a: One, b: One) => a.kept === "zoo" || b.kept === "zoo" || Boolean(a.kept && b.kept);
    const threat = new Map<string, boolean>();
    const threatens = (p: string, q: string) => {
        const k = `${p}|${q}`;
        let v = threat.get(k);
        if (v === undefined) threat.set(k, (v = kindThreat(p, q)));
        return v;
    };
    const cell = 25;
    const grid = new Map<string, One[]>();
    for (const o of ones) {
        const k = `${Math.floor(o.x / cell)},${Math.floor(o.z / cell)}`;
        grid.set(k, [...(grid.get(k) ?? []), o]);
    }
    const label = (o: One) => (o.kept === "zoo" ? "zoo" : o.kept ?? "wild");
    const rows = new Map<string, {all: number[]; left: number[]; pairs: Map<string, number>}>();
    const preyWith = {all: [0, 0, 0], left: [0, 0, 0]};
    for (const q of ones) {
        const nearest = {all: Infinity, left: Infinity};
        const cx = Math.floor(q.x / cell);
        const cz = Math.floor(q.z / cell);
        for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const p of grid.get(`${cx + a},${cz + b}`) ?? []) {
            if (p === q || p.slug === q.slug || !threatens(p.slug, q.slug)) continue;
            const d = Math.hypot(p.x - q.x, p.z - q.z);
            if (d > 25) continue;
            const kind = `${label(q)} prey, ${label(p)} hunter${q.kept === "zoo" && p.kept === "zoo" ? (q.pen === p.pen ? " (one enclosure)" : " (two enclosures)") : ""}`;
            const row = rows.get(kind) ?? {all: [0, 0, 0], left: [0, 0, 0], pairs: new Map<string, number>()};
            rows.set(kind, row);
            const kept = !apart(p, q);
            [25, 10, 5].forEach((within, i) => {
                if (d > within) return;
                row.all[i]++;
                if (kept) row.left[i]++;
            });
            row.pairs.set(`${q.slug} < ${p.slug}`, (row.pairs.get(`${q.slug} < ${p.slug}`) ?? 0) + 1);
            nearest.all = Math.min(nearest.all, d);
            if (kept) nearest.left = Math.min(nearest.left, d);
        }
        [25, 10, 5].forEach((within, i) => {
            if (nearest.all <= within) preyWith.all[i]++;
            if (nearest.left <= within) preyWith.left[i]++;
        });
    }
    console.log(`town: ${animals.length} animals, ${ones.length} placed with a profile (house ${ones.filter((o) => o.kept === "house").length}, farm ${ones.filter((o) => o.kept === "farm").length}, zoo ${ones.filter((o) => o.kept === "zoo").length}, the town's own ${ones.filter((o) => !o.kept).length})`);
    console.log(`animals with a hunter of theirs within 25 / 10 / 5 m: ${preyWith.all.join(" / ")}; once kept animals are apart (fences, households): ${preyWith.left.join(" / ")}`);
    console.log("| Pairs (prey, hunter) | within 25 m | 10 m | 5 m | still predator and prey: 25 m | 10 m | 5 m | the most |\n|---|---|---|---|---|---|---|---|");
    for (const [kind, row] of Array.from(rows.entries()).sort((a, b) => b[1].all[0] - a[1].all[0])) {
        const most = Array.from(row.pairs.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => `${k} (${n})`).join("; ");
        console.log(`| ${kind} | ${row.all.join(" | ")} | ${row.left.join(" | ")} | ${most} |`);
    }
}

if (MODE === "fixture") fixture();
else if (MODE === "groups") groups();
else if (MODE === "town") await town();
else await real();
