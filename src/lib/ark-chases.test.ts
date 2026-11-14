/**
 * The motion pass's chases (lane L7, brief section 6): visual hunts of ambient prey in the recipes (`recipe-hunt.ts`,
 * `behaviour-recipes.ts`), the server's meals acted out as full chases (`acts.ts`), and prey near a chase scattering
 * (`reactive.ts`).
 */
import assert from "node:assert/strict";
import test from "node:test";
import {chasePace, clearBearing, encounterBodies, mealEncounter, mealStage, preyFleeStyle, setChasePaces, type ActBody, type ChaseKind, type FleeStyle} from "@/ark-scene/acts";
import {forgetRecipes, quarriesOf, type RecipePose} from "@/ark-scene/behaviour-recipes";
import {behaviourProfile} from "@/ark-scene/behaviour-profile";
import {intelProfile} from "@/ark-scene/intelligence-profile";
import {quarryAt, type QuarryTrack} from "@/ark-scene/recipe-hunt";
import {TEMPLATES, type PreyKind} from "@/ark-scene/recipe-templates";
import table from "@/ark-scene/recipes.json";
import {ReactiveLayer, SCATTER, type ReactiveInput, type ReactiveOut} from "@/ark-scene/reactive";
import {poseOnTrip, scheduleWorld, tripAt, tripEpisode, SLOT_SECONDS, type ScheduleAnimal, type Trip} from "@/ark-scene/behaviour-schedule";
import type {Episode} from "@/ark-scene/behaviour-recipes";
import {sceneSampler} from "@/ark-scene/world-sampler";

const world = scheduleWorld(sceneSampler());
const hoursAt = (epoch: number) => (((epoch / 3600) % 24) + 24) % 24;
const DAY = Math.floor(Date.UTC(2026, 6, 14, 0) / 1000);
const AMBIENT: PreyKind[] = ["fish", "insect", "worm", "shellfish", "nut", "seed"];
const ROWS = (table as {species: Record<string, string>}).species;
const heightAt = (x: number, z: number) => world.sampler.heightAt(x, z);

type Hunt = {trip: Trip; episode: Episode; track: QuarryTrack};

/** The hunts (catches with a quarry) of a species at a home over a day. */
function hunts(slug: string, length: number, zone: ScheduleAnimal["zone"], home: {x: number; z: number}, activity: string | null, max = 30): Hunt[] {
    forgetRecipes();
    const animal: ScheduleAnimal = {id: `chase-${slug}`, zone, home: {x: home.x, y: Math.max(heightAt(home.x, home.z), 0), z: home.z}, length, sea: false};
    const profile = behaviourProfile(slug);
    const out: Hunt[] = [];
    for (let start = DAY; start < DAY + 24 * 3600 && out.length < max; start += SLOT_SECONDS) {
        const trip = tripAt(world, profile, animal, start, hoursAt, activity as never);
        const episode = trip.recipe ? tripEpisode(world, trip) : null;
        if (!episode) continue;
        for (const track of quarriesOf(world, episode)) out.push({trip, episode, track});
    }
    return out;
}

const CAST: Array<[string, number, ScheduleAnimal["zone"], {x: number; z: number}, string | null, string]> = [
    ["domestic-cat", 0.46, "farm_garden", {x: 40, z: -60}, "diurnal", "pounce"],
    ["grey-heron", 0.95, "wetland", {x: -70, z: 22}, "diurnal", "wade_spear"],
    ["osprey", 0.58, "seashore", {x: -70, z: 22}, "diurnal", "talon_grab"],
    ["harbor-seal", 1.6, "seashore", {x: -70, z: 22}, null, "chase_fish"],
    ["barn-swallow", 0.18, "farm_garden", {x: 40, z: -60}, "diurnal", "aerial_hawk"]
];

test("visual hunts: a cat's grasshopper, a heron's fish, an osprey's fish, a seal's fish, a swallow's moth; each caught at the mouth or got away", () => {
    for (const [slug, length, zone, home, activity, recipe] of CAST) {
        const list = hunts(slug, length, zone, home, activity);
        const mine = list.filter((h) => h.episode.recipe === recipe);
        assert.ok(mine.length >= 3, `${slug}: ${mine.length} ${recipe} hunts`);
        let caught = 0;
        let missed = 0;
        for (const {trip, track} of mine) {
            assert.ok(AMBIENT.includes(track.kind) && !(track.kind in ROWS), `${slug}: ambient quarry only (${track.kind})`);
            const at = quarryAt(track, track.tc - 1e-3, heightAt)!;
            assert.ok(at, `${slug}: there at the catch`);
            const pose = poseOnTrip(world, trip, track.tc - 1e-3) as RecipePose;
            // Its mouth (bill, paws, talons) is within about its body's half length of the body's middle.
            const mouth = Math.hypot(at.x - pose.x, at.z - pose.z);
            if (track.ok) {
                caught++;
                assert.ok(mouth < length * 0.75 + 0.15, `${slug}: caught at its mouth (${mouth.toFixed(2)} m from its middle)`);
                assert.equal(quarryAt(track, track.tc + 0.05, heightAt), null, `${slug}: gone into its mouth once caught`);
            } else {
                missed++;
                const later = quarryAt(track, track.tc + 0.9, heightAt)!;
                const then = poseOnTrip(world, trip, track.tc + 0.9);
                assert.ok(Math.hypot(later.x - then.x, later.z - then.z) > Math.hypot(at.x - pose.x, at.z - pose.z) - 0.05, `${slug}: a miss gets away`);
                assert.equal(quarryAt(track, track.te + 0.01, heightAt), null, `${slug}: and is gone after`);
            }
            // While it flees, the predator closes on it (it is caught where the recipe's catch is, never ahead of it).
            if (track.tc - track.ts > 0.6) {
                const early = quarryAt(track, track.ts + 0.05, heightAt)!;
                const p0 = poseOnTrip(world, trip, track.ts + 0.05);
                const late = quarryAt(track, track.tc - 0.1, heightAt)!;
                const p1 = poseOnTrip(world, trip, track.tc - 0.1);
                assert.ok(Math.hypot(late.x - p1.x, late.z - p1.z) <= Math.hypot(early.x - p0.x, early.z - p0.z) + 0.05, `${slug}: it closes on its quarry`);
            }
            // Where it is: a grasshopper on the ground or in a hop, a fish under the surface, a moth in the air.
            for (let t = track.tv; t < track.te; t += 0.1) {
                const q = quarryAt(track, t, heightAt);
                if (!q) continue;
                if (q.look === "fish") assert.ok(q.y < 0, `${slug}: fish under the surface`);
                if (q.look === "hopper") assert.ok(q.y >= Math.max(heightAt(q.x, q.z), 0) - 1e-6 && q.y < Math.max(heightAt(q.x, q.z), 0) + 0.4, `${slug}: hopper on the ground or hopping`);
                if (q.look === "flier") assert.ok(q.y > Math.max(heightAt(q.x, q.z), 0) + 0.1, `${slug}: moth in the air`);
            }
        }
        assert.ok(caught >= 1 && missed >= 1, `${slug}: some caught (${caught}), some missed (${missed})`);
    }
});

test("a quarry is pure: the same track from a fresh world, and the catch only in its mouth from the moment it is made", () => {
    const a = hunts("domestic-cat", 0.46, "farm_garden", {x: 40, z: -60}, "diurnal", 6);
    const b = hunts("domestic-cat", 0.46, "farm_garden", {x: 40, z: -60}, "diurnal", 6);
    assert.equal(a.length, b.length);
    for (let i = 0; i < a.length; i++) {
        for (let t = a[i].track.tv; t < a[i].track.te; t += 0.25) {
            const p = quarryAt(a[i].track, t, heightAt);
            const q = quarryAt(b[i].track, t, heightAt);
            assert.deepEqual(p && [p.x, p.y, p.z], q && [q.x, q.y, q.z]);
        }
        // The carried catch shows only once caught (before it, the quarry is loose).
        if (a[i].track.ok) {
            const before = poseOnTrip(world, a[i].trip, a[i].track.tc - 0.2) as RecipePose;
            assert.ok(!before.act?.carry || before.act.carry.item !== "insect", "not carried before the catch");
        }
    }
});

test("hunts stay on clear ground: a cat's rush and pounce never cross the pond, a rock or a building", () => {
    const list = hunts("domestic-cat", 0.46, "farm_garden", {x: 40, z: -60}, "diurnal", 40);
    let legs = 0;
    const seen = new Set<Episode>();
    for (const {trip, episode} of list) {
        if (seen.has(episode)) continue;
        seen.add(episode);
        for (const k of episode.keys) {
            if (k.block.id !== "run" && k.block.id !== "leap") continue;
            legs++;
            // Along the way it is drawn (its curve), from where it was to where it lands.
            for (let u = 0.05; u <= 1; u += 0.1) {
                const p = poseOnTrip(world, trip, k.t0 + (k.t1 - k.t0) * u);
                assert.ok(world.nav.walkable(p.x, p.z) && !world.sampler.blocked(p.x, p.z, 0.2), `${k.block.id} crosses blocked ground at ${p.x.toFixed(2)},${p.z.toFixed(2)}`);
            }
        }
    }
    assert.ok(legs >= 10, `legs ${legs}`);
});

test("swallows, martins and swifts hawk on the wing (never from a perch), with fast dashes at their insects", () => {
    for (const slug of ["barn-swallow", "common-swift", "bank-swallow", "house-martin", "white-throated-needletail"]) {
        const row = ROWS[slug];
        if (!row) continue;
        assert.ok(row.startsWith("aerial_hawk") || row.includes(",aerial_hawk"), `${slug}: ${row.split("|")[0]}`);
        assert.ok(!row.split("|")[0].includes("hawk_insects"), `${slug}: no perch sallies`);
    }
    const t = TEMPLATES.aerial_hawk;
    assert.ok(t.steps.every((s) => s.b === "fly") && t.steps.some((s) => s.fast && s.catch === "insect"));
    const list = hunts("barn-swallow", 0.18, "farm_garden", {x: 40, z: -60}, "diurnal", 20).filter((h) => h.episode.recipe === "aerial_hawk");
    assert.ok(list.length >= 5);
    let samples = 0;
    let clear = 0;
    for (const {trip, episode} of list) {
        for (let at = episode.t0 + 1; at < episode.t1 - 2; at += 0.5) {
            const p = poseOnTrip(world, trip, at) as RecipePose;
            assert.ok(p.aloft, "in the air throughout");
            // Its sweeps keep clear of the trees' crowns (no trunk within a crown's reach under it).
            samples++;
            if (!world.sampler.blocked(p.x, p.z, 2.2)) clear++;
        }
    }
    assert.ok(clear >= samples * 0.97, `in open air (${clear} of ${samples})`);
});

// MARK: The meal's chase

const body = (x: number, z: number, length: number, height: number, speedStat: number, base = 0.5): ActBody => ({x, z, base, yaw: 0, length, height, speedStat});
const CHASES: Array<[string, ChaseKind, ActBody, ActBody, FleeStyle]> = [
    ["lion and zebra", "glide", body(-15, 0, 2.5, 1.1, 75), body(0, 0, 2.4, 1.4, 70), "run"],
    ["cheetah and gazelle", "glide", body(-20, 5, 1.3, 0.8, 100), body(0, 0, 1.0, 0.7, 85), "run"],
    ["fox and rabbit", "glide", body(-6, 0, 0.7, 0.4, 60), body(0, 0, 0.4, 0.25, 70), "bound"],
    ["python and rat", "slither", body(-3, 0, 3, 0.3, 20), body(0, 0, 0.25, 0.1, 50), "run"],
    ["eagle and hare", "swoop", body(-10, 0, 0.9, 0.6, 70), body(0, 0, 0.6, 0.35, 75), "bound"],
    ["hawk and pigeon", "swoop", body(-10, 0, 0.5, 0.4, 80, 9), body(0, 0, 0.32, 0.25, 60), "fly"],
    ["dolphin and fish", "dart", body(-8, 0, 2.5, 0.6, 85, -1), body(0, 0, 0.4, 0.1, 60, -0.8), "swim"]
];

test("a meal is a full chase: it stalks, the prey bolts and darts, it sprints and closes, the catch; the same for every viewer", () => {
    for (const [name, kind, predator, prey, flee] of CHASES) {
        const stage = mealStage(kind, predator, prey, {seed: name, flee});
        const again = mealStage(kind, predator, prey, {seed: name, flee});
        const catchAt = stage.catchAt!;
        assert.ok(catchAt > 0.5 && catchAt < stage.seconds, `${name}: a catch (${catchAt})`);
        const p = stage.predator(catchAt)!;
        const q = stage.prey(catchAt);
        assert.ok(Math.hypot(p.x - q.x, p.z - q.z) < predator.length * 0.6 + prey.length * 0.6 + 0.2, `${name}: on its prey at the catch (${Math.hypot(p.x - q.x, p.z - q.z).toFixed(2)} m)`);
        assert.ok(stage.prey(stage.seconds).hidden, `${name}: the prey gone at the end`);
        const states = new Set<string>();
        let fastest = 0;
        let preyFastest = 0;
        let darts = 0;
        let lastTurn = 0;
        let last = stage.prey(0);
        for (let t = 0; t <= stage.seconds; t += 1 / 30) {
            const a = stage.predator(t)!;
            const b = stage.prey(t);
            const a2 = again.predator(t)!;
            assert.ok(a.x === a2.x && a.z === a2.z && a.base === a2.base, `${name}: deterministic`);
            states.add(a.state ?? "");
            if (t < catchAt) {
                fastest = Math.max(fastest, a.speed ?? 0);
                preyFastest = Math.max(preyFastest, b.speed ?? 0);
                // Darts: the prey's turning changes side.
                const d = Math.atan2(Math.sin(b.yaw - last.yaw), Math.cos(b.yaw - last.yaw));
                if (Math.abs(d) > 0.01 && Math.sign(d) !== Math.sign(lastTurn)) {
                    darts++;
                    lastTurn = d;
                }
            }
            last = b;
        }
        if (kind === "glide") {
            for (const s of ["stalk", "run", "leap", "eat"]) assert.ok(states.has(s), `${name}: ${s} in ${Array.from(states)}`);
            // (A big one swerves now and then; a mid-sized one zigzags; a small one darts.)
            assert.ok(darts >= (prey.length >= 2.2 ? 1 : 3), `${name}: the prey darts (${darts})`);
            assert.ok(preyFastest <= fastest * 0.73 + 1e-6, `${name}: the prey is the slower (${preyFastest.toFixed(1)} of ${fastest.toFixed(1)})`);
            assert.ok(fastest <= chasePace(predator, "sprint") + 1e-6, `${name}: no faster than its sprint`);
        }
        if (kind === "swoop") assert.ok(states.has("plunge") && states.has("strike_feet"), `${name}: stoops (${Array.from(states)})`);
        if (kind === "dart") assert.ok(Array.from(states).every((s) => s === "swim" || s === "strike" || s === "eat"), `${name}: swims (${Array.from(states)})`);
        if (kind === "slither") assert.ok(states.has("strike") && !states.has("run"), `${name}: creeps and strikes`);
    }
    // A faster hunter is on its prey sooner.
    const prey = body(0, 0, 1.4, 1, 60);
    assert.ok(mealStage("glide", body(-14, 0, 1.5, 1, 95), prey, {seed: "s"}).catchAt! < mealStage("glide", body(-14, 0, 1.5, 1, 40), prey, {seed: "s"}).catchAt!);
});

test("a chase goes round what is in its way: neither crosses a wall, nor leaves the water", () => {
    // A wall across the prey's way out (x = 6 to 7).
    const clear = (x: number) => x < 6 || x > 7;
    const stage = mealStage("glide", body(-12, 0, 1.8, 1, 70), body(0, 0, 1.6, 1.2, 70), {seed: "wall", flee: "run", clear: (x) => clear(x)});
    for (let t = 0; t <= stage.seconds; t += 1 / 60) {
        assert.ok(clear(stage.prey(t).x), `prey through the wall at ${t.toFixed(2)}`);
        assert.ok(clear(stage.predator(t)!.x), `predator through the wall at ${t.toFixed(2)}`);
    }
    const water = (x: number, z: number) => Math.hypot(x, z) < 9;
    const swim = mealStage("dart", body(-6, 0, 2, 0.6, 80, -1), body(0, 0, 0.4, 0.1, 60, -0.8), {seed: "pond", flee: "swim", water});
    for (let t = 0; t <= swim.seconds; t += 1 / 60) assert.ok(water(swim.prey(t).x, swim.prey(t).z), "the fish stays in the water");
});

test("a chase always ends: a hunter that cannot reach its prey (a wall all round it, a crawling sprint) still catches it, in bounded time", () => {
    // (The first scene run of a lion's chase hit the time limit and never ended: the catch was reset every step.)
    const walled = mealStage("glide", body(-12, 0, 1.8, 1, 70), body(0, 0, 1.6, 1.2, 70), {seed: "walled", flee: "run", clear: (x) => x < -11 || x > -1});
    assert.ok(walled.catchAt! > 0 && walled.seconds < 20, `walled: catch ${walled.catchAt}, ${walled.seconds} s`);
    const crawl = mealStage("glide", {...body(-12, 0, 1.8, 1, 70), gait: 0.01}, body(0, 0, 1.6, 1.2, 70), {seed: "crawl", flee: "run"});
    assert.ok(crawl.catchAt! > 0 && crawl.seconds < 20, `crawl: catch ${crawl.catchAt}, ${crawl.seconds} s`);
    assert.ok(crawl.prey(crawl.seconds).hidden && walled.prey(walled.seconds).hidden);
});

test("the server's positions: the hunter where the scene has it near its waypoint (else the waypoint), the prey where it is in its disc (or the disc's edge nearest it)", () => {
    assert.equal(mealEncounter({kind: "meal"}), null);
    assert.equal(mealEncounter({encounter: {predator: {x: 1}, prey: {x: 0, z: 0, r: 2}}}), null);
    const e = mealEncounter({payload: {encounter: {t: 1700000000, predator: {x: -10, z: 2}, prey: {x: 4, z: 0, r: 3}, step: 9, island: "wild", d: 14}}})!;
    assert.deepEqual(e, {t: 1700000000, predator: {x: -10, z: 2}, prey: {x: 4, z: 0, r: 3}});
    const flat = () => 0;
    const inDisc = encounterBodies(body(30, 30, 2, 1, 70), body(5, 1, 1.5, 1, 60), e, flat);
    assert.deepEqual([inDisc.predator.x, inDisc.predator.z], [-10, 2], "the scene far from the waypoint: the waypoint");
    const agreeing = encounterBodies(body(-12, 4, 2, 1, 70), body(5, 1, 1.5, 1, 60), e, flat);
    assert.deepEqual([agreeing.predator.x, agreeing.predator.z], [-12, 4], "the scene within a few metres of it: the scene's pose");
    assert.deepEqual([inDisc.prey.x, inDisc.prey.z], [5, 1], "inside its disc: where it is");
    const outside = encounterBodies(body(30, 30, 2, 1, 70), body(20, 0, 1.5, 1, 60), e, flat);
    assert.ok(Math.abs(Math.hypot(outside.prey.x - 4, outside.prey.z) - 3) < 1e-9 && outside.prey.x > 4, "outside: the disc's edge nearest it");
    assert.ok(Math.abs(outside.predator.yaw - Math.atan2(outside.prey.x + 10, outside.prey.z - 2)) < 1e-9, "facing its prey");
    // The chase then starts there: from the waypoint itself, closing the gap in its stalk.
    const stage = mealStage("glide", inDisc.predator, inDisc.prey, {seed: "enc", exact: true});
    const start = stage.predator(0)!;
    assert.ok(Math.hypot(start.x + 10, start.z - 2) < 1e-9, "from its waypoint");
});

test("the chase's camera looks past the trees: of the side-on bearings, one with no trunk in its line", () => {
    const focus = {x: 0, y: 1, z: 0};
    // A tree 6 m out along the first side-on bearing (east): the camera takes the other side.
    const tree = (x: number, z: number, clearance: number) => Math.hypot(x - 6, z) < clearance;
    const b = clearBearing(focus, 20, 1.1, Math.PI / 2, tree, () => 0);
    assert.ok(Math.abs(Math.atan2(Math.sin(b + Math.PI / 2), Math.cos(b + Math.PI / 2))) < 1e-9, `west (${b})`);
    // Nothing in the way: side on as the scene asked.
    assert.equal(clearBearing(focus, 20, 1.1, Math.PI / 2, () => false, () => 0), Math.PI / 2);
});

test("how prey flee, and the locomotion lanes' paces when they are wired", () => {
    assert.equal(preyFleeStyle({preySlug: "plains-zebra", preyPlan: "mammal", preyWater: false, preyFlies: false}), "run");
    assert.equal(preyFleeStyle({preySlug: "european-hare", preyPlan: "mammal", preyWater: false, preyFlies: false}), "bound");
    assert.equal(preyFleeStyle({preySlug: "rock-dove", preyPlan: "bird", preyWater: false, preyFlies: true}), "fly");
    assert.equal(preyFleeStyle({preySlug: "atlantic-herring", preyPlan: "fish", preyWater: true, preyFlies: false}), "swim");
    assert.equal(preyFleeStyle({preySlug: "garden-snail", preyPlan: "other", preyWater: false, preyFlies: false}), "still");
    const lion = body(0, 0, 2.5, 1.1, 75);
    const own = chasePace(lion, "sprint");
    setChasePaces({sprint: () => 17.5, burst: () => null});
    try {
        assert.equal(chasePace(lion, "sprint"), 17.5);
        assert.equal(chasePace(lion, "burst"), chasePace({...lion, speedStat: 75}, "burst"), "null: the provisional pace stands");
    } finally {
        setChasePaces(null);
    }
    assert.equal(chasePace(lion, "sprint"), own);
});

// MARK: Scatter

function reactive(id: string, slug: string, x: number, z: number, extra: Partial<ReactiveInput> = {}): ReactiveInput {
    const b = behaviourProfile(slug);
    return {
        id,
        slug,
        plan: intelProfile(slug).plan,
        length: extra.length ?? 2,
        size: b.size,
        speed: b.speed,
        dominance: b.dominance,
        social: b.social,
        diet: b.diet,
        intel: intelProfile(slug),
        asleep: false,
        acting: false,
        ...extra,
        shared: {x, y: 0, z, yaw: 0, moving: false, aloft: false, doing: "graze", ...(extra.shared ?? {})}
    };
}

test("prey near a chase scatter: they bolt at once, each its own way, even when the hunter's day has it asleep", () => {
    const run = (chasing: boolean) => {
        const layer = new ReactiveLayer({tier: "high"});
        const herd = Array.from({length: 8}, (_, i) => reactive(`zebra${i}`, "plains-zebra", 4 + (i % 4) * 3, (Math.floor(i / 4) - 0.5) * 4, {length: 2.4, shared: {x: 0, y: 0, z: 0, yaw: (i * 1.3) % 6, moving: false, aloft: false, doing: "graze"}}));
        // (The lion acting out the meal: its schedule has it asleep at this hour; the act runs it at the herd.)
        const lion = reactive("lion", "african-lion", -10, 0, {length: 2.5, asleep: true, acting: true, chasing, shared: {x: -10, y: 0, z: 0, yaw: Math.PI / 2, moving: chasing, aloft: false, doing: "sleep"}});
        const outs: Array<Map<string, ReactiveOut>> = [];
        for (let k = 0; k < 60; k++) {
            const t = 1000 + k / 30;
            if (chasing) lion.shared.x = -10 + (t - 1000) * 9;
            outs.push(layer.step([...herd, lion], {now: t, dt: 1 / 30, hours: 10, night: 0, weather: {rain: 0, wind: 0.2, windDirection: 0, fog: 0, storm: 0}, camera: {x: 0, y: 2, z: -20}}));
        }
        return {herd, outs};
    };
    const {herd, outs} = run(true);
    const fled = herd.filter((z) => outs.some((o) => o.get(z.id)?.action === "flee"));
    assert.ok(fled.length >= 6, `the herd bolts (${fled.length} of ${herd.length})`);
    const first = herd.map((z) => outs.findIndex((o) => o.get(z.id)?.action === "flee")).filter((i) => i >= 0);
    assert.ok(Math.min(...first) / 30 < 0.8, "at once");
    // Each its own way: the directions they run spread out (fanned up to SCATTER either side of straight away): the
    // mean of their unit directions is well short of one.
    const ways = fled.map((z) => {
        const o = outs[outs.length - 1].get(z.id)!;
        const l = Math.hypot(o.dx, o.dz) || 1;
        return {x: o.dx / l, z: o.dz / l};
    });
    const mean = Math.hypot(ways.reduce((s, w) => s + w.x, 0), ways.reduce((s, w) => s + w.z, 0)) / ways.length;
    // (The behaviours pass, lane B2: a flight is now one dash in a direction chosen as it starts, each animal's own
    // seeded angle either side of straight away; before, the direction was worked out again every frame against the
    // lion's place, and with the lion running through the herd that turned them about. These eight ids' angles give
    // a resultant of 0.93, from 31 degrees one side to 42 the other.)
    assert.ok(mean < 0.95, `fanned out (resultant ${mean.toFixed(2)}; scatter ${SCATTER})`);
    const angles = ways.map((w) => Math.atan2(w.z, w.x));
    assert.ok(Math.max(...angles) - Math.min(...angles) > 1, `across more than a radian (${(Math.max(...angles) - Math.min(...angles)).toFixed(2)})`);
    // The same lion asleep and not chasing: nothing stirs.
    const quiet = run(false);
    assert.ok(!quiet.herd.some((z) => quiet.outs.some((o) => o.get(z.id)?.action === "flee")), "a sleeping lion sends nobody running");
});
