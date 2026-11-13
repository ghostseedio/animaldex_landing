/**
 * Other body plans (lane MA4, the movement audit of 2026-11-13, findings 10 and 11; docs/ark/movement-audit-2026-11-13.md):
 *
 * - Head-bob by family from the stored taxonomy (`styles.json`'s ground `b`), not slug names ("crow" bobbed the crowned
 *   eagle and three crowned parrots, "turkey" the turkey vulture).
 * - True seals galumph on the belly (`land-drivers.ts` galumphDriver): on the ground, the back humping, the hind flippers
 *   held up, a hump a fifth of the body long; sea lions, fur seals and the walrus walk on four flippers (legged gaits).
 * - Frogs and toads hop (`land-drivers.ts` saltationDriver): sit with feet planted, a ballistic hop of about their natural
 *   length, landing on their place; toads walk when slow; newts, salamanders and walking frogs never hop.
 *
 * On real rig skeletons from the v2 set (`src/lib/__fixtures__/ark-l2/`, `scripts/ark-l2-rig-fixtures.mts`).
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {Matrix4, Quaternion, Vector3} from "three";
import styles from "@/ark-scene/locomotion/styles.json";
import {gaitLadder, headBobs, landGait} from "@/ark-scene/locomotion/gaits";
import {galumphDriver, GALUMPH_STRIDE, HOPS, hopClassOf, saltationDriver, TOAD_HOP_PACE, type GalumphState, type SaltationState} from "@/ark-scene/locomotion/land-drivers";
import {leggedDriver} from "@/ark-scene/locomotion/legged";
import {leggedPoser, simulate, type Scenario} from "@/ark-scene/locomotion/sim";
import {bonePointNow, buildLocoRig, restInverses, type RawSkeleton} from "@/ark-scene/locomotion/skeleton";
import type {LocoInput, LocoRig} from "@/ark-scene/locomotion/types";
import {recordMotionMetric} from "@/lib/ark-motion-metrics";

type Fixture = RawSkeleton & {positions: number[]; joints: number[]; weights: number[]};
const fixture = (slug: string): Fixture => JSON.parse(fs.readFileSync(path.join(__dirname, "__fixtures__/ark-l2", `${slug}.json`), "utf8"));
const reasons = (file: string) => JSON.parse(fs.readFileSync(path.join(process.cwd(), "data/ark", file), "utf8")).species as Record<string, Record<string, unknown>>;

// MARK: Head-bob

/** Families whose walkers bob their heads (Necker 2007's orders; the audit's list) and families that never do. */
const BOBBING = ["Columbidae", "Phasianidae", "Rallidae", "Ardeidae", "Threskiornithidae", "Ciconiidae", "Gruidae", "Sturnidae", "Corvidae", "Motacillidae"];
const NEVER = ["Accipitridae", "Cathartidae", "Sagittariidae", "Psittacidae", "Psittaculidae", "Strigidae", "Tytonidae", "Anatidae", "Anseranatidae", "Laridae", "Momotidae", "Maluridae", "Spheniscidae", "Phalacrocoracidae", "Trochilidae"];

test("MA4 metric: head-bob by family from the stored taxonomy, never by a slug's name", () => {
    const ground = reasons("locomotion-styles.json") as Record<string, {ground?: {code: string; why: string}}>;
    const birds = Object.entries(ground).filter(([, r]) => r.ground);
    let misfiled = 0;
    let byName = 0;
    const wrong: string[] = [];
    for (const [slug, r] of birds) {
        const family = r.ground!.why.split(":")[0];
        const bobs = headBobs(slug, "flying_bird");
        // The scene reads the family's own flag: the same answer for every plan a bird's rig has.
        assert.equal(bobs, headBobs(slug, "walking_bird"));
        assert.equal(headBobs(slug, "quadruped"), false);
        if (bobs !== r.ground!.code.endsWith("b")) misfiled++;
        if (BOBBING.includes(family) && !bobs) wrong.push(`${slug} (${family}) does not bob`);
        if (NEVER.includes(family) && bobs) {
            byName++;
            wrong.push(`${slug} (${family}) bobs`);
        }
    }
    recordMotionMetric("ma4", "headbob_misfiled", misfiled);
    recordMotionMetric("ma4", "headbob_wrong_family", byName);
    assert.ok(birds.length > 600, `${birds.length} birds`);
    assert.equal(misfiled, 0);
    assert.deepEqual(wrong, []);
    // The audit's name collisions (finding 10) and its reference walkers.
    for (const slug of ["crowned-eagle", "turkey-vulture", "red-crowned-parrot", "yellow-crowned-amazon-parrot", "blue-crowned-hanging-parrot", "blue-crowned-motmot", "magpie-goose", "purple-crowned-fairywren", "secretarybird", "mallard", "house-sparrow"]) assert.equal(headBobs(slug, "flying_bird"), false, slug);
    for (const slug of ["domestic-pigeon", "victoria-crowned-pigeon", "domestic-chicken", "indian-peafowl", "wild-turkey", "grey-heron", "eurasian-coot", "eurasian-magpie", "european-starling", "grey-wagtail"]) assert.equal(headBobs(slug, "flying_bird"), true, slug);
    // (Stored once: `styles.json` rows carry it as the ground code's `b`.)
    assert.match((styles as {species: Record<string, string>}).species["domestic-pigeon"], /\|\w*b\|/);
});

// MARK: Land gaits by family

test("MA4: land gaits by family: true seals galumph, eared seals and the walrus walk on flippers, frogs by family, newts crawl", () => {
    const land = reasons("land-gaits.json") as Record<string, {gait: string; why: string}>;
    const want: Record<string, string> = {Phocidae: "galumph", Otariidae: "flipper_gallop", Odobenidae: "flipper_walk", Ranidae: "leap", Hylidae: "leap", Bufonidae: "hop", Dendrobatidae: "hop", Microhylidae: "walk"};
    let seen = 0;
    for (const [slug, r] of Object.entries(land)) {
        assert.equal(landGait(slug), r.gait, slug);
        const family = r.why.split(":")[0].split("/").pop()!;
        if (want[family]) {
            seen++;
            assert.equal(r.gait, want[family], `${slug} (${family})`);
        }
        if (r.why.startsWith("Caudata")) assert.equal(r.gait, "crawl", slug);
    }
    assert.ok(seen > 30, `${seen}`);
    for (const slug of ["harbor-seal", "grey-seal", "northern-elephant-seal", "weddell-seal"]) assert.equal(landGait(slug), "galumph", slug);
    for (const slug of ["california-sea-lion", "new-zealand-fur-seal"]) assert.equal(landGait(slug), "flipper_gallop", slug);
    assert.equal(landGait("walrus"), "flipper_walk");
    assert.equal(landGait("red-fox"), null);
    // The legged gaits: a sea lion walks then gallops (hind flippers together), the walrus only walks; frogs that walk,
    // newts and salamanders never hop; a toad walks first.
    const ladder = (slug: string, plan: LocoRig["plan"]) => gaitLadder({slug, plan, legs: [{}, {}, {}, {}] as LocoRig["legs"]}).map(([g]) => g);
    assert.deepEqual(ladder("california-sea-lion", "quadruped"), ["walk", "half_bound"]);
    assert.deepEqual(ladder("walrus", "quadruped"), ["walk"]);
    for (const slug of ["alpine-newt", "fire-salamander", "axolotl", "tomato-frog", "desert-rain-frog"]) assert.ok(!ladder(slug, "amphibian").includes("hop"), slug);
    assert.deepEqual(ladder("cane-toad", "amphibian"), ["sprawl", "hop"]);
    assert.deepEqual(ladder("common-frog", "amphibian"), ["hop"]);
});

test("MA4: birds hop, waddle or walk by family (the stored ground gait), never by a slug's name", () => {
    const ladder = (slug: string, plan: LocoRig["plan"]) => gaitLadder({slug, plan, legs: [{}, {}] as LocoRig["legs"]}).map(([g]) => g).join(">");
    // The old name matches: "sparrow" hopped the sparrowhawk, "blackbird" the red-winged blackbird, "finch" the finch-billed myna.
    for (const slug of ["eurasian-sparrowhawk", "red-winged-blackbird", "finch-billed-myna"]) assert.equal(ladder(slug, "flying_bird"), "biped_walk>biped_run", slug);
    // Hopping families the names missed: a chiffchaff, a fieldfare, a waxwing.
    for (const slug of ["common-chiffchaff", "fieldfare", "cedar-waxwing", "house-sparrow"]) assert.equal(ladder(slug, "flying_bird"), "hop", slug);
    // Waddling families the names missed: grebes, loons, cormorants, pelicans, albatrosses; ducks as before.
    for (const slug of ["great-crested-grebe", "common-loon", "great-cormorant", "brown-pelican", "wandering-albatross", "mallard"]) assert.equal(ladder(slug, "flying_bird"), "waddle>biped_run", slug);
    // Penguins only waddle; ratites walk and run.
    assert.equal(ladder("emperor-penguin", "flightless_bird"), "waddle");
    assert.equal(ladder("ostrich", "flightless_bird"), "biped_walk>biped_run");
});

// MARK: A run over flat ground

const flat = () => ({height: 0, nx: 0, ny: 1, nz: 0});

type Frame = {t: number; place: number; world: Matrix4[]; instance: Matrix4; gait: string; phase: string};

/**
 * A driver run at `pace` body lengths a second along +z for `moving` seconds (after half a second standing), then
 * standing, posed at 60 fps; each frame's bones (world = instance · mesh) kept.
 */
function run(rig: LocoRig, length: number, pace: number, moving: number, after: number, driver: typeof galumphDriver, clip = "walk"): {frames: Frame[]; state: unknown; scale: number} {
    const scale = length / Math.max(rig.length, rig.height);
    const state = driver.init(rig);
    const frames: Frame[] = [];
    const total = 0.5 + moving + after;
    for (let f = 0; f <= total * 60; f++) {
        const t = f / 60;
        const z = pace * length * Math.min(Math.max(t - 0.5, 0), moving);
        const instance = new Matrix4().compose(new Vector3(0, -rig.minY * scale, z), new Quaternion(), new Vector3(scale, scale, scale));
        const world = rig.bones.map((b) => b.restWorld.clone());
        const input: LocoInput = {instance, scale, yaw: 0, dt: 1 / 60, clock: 1000 + t, seed: 0.3, ground: flat, grounded: true, clipNow: t > 0.5 && t < 0.5 + moving ? clip : clip === "walk" && driver === galumphDriver ? "walk" : "idle", clipFrom: null, clipPhase: 0};
        const gait = driver.pose(rig, input, world, state)!;
        const own = state as SaltationState;
        frames.push({t, place: z, world: world.map((m) => new Matrix4().multiplyMatrices(instance, m)), instance, gait: gait.gait, phase: own.walking ? "walk" : own.phase ?? ""});
    }
    return {frames, state, scale};
}

/** The skinned points (world) of the fixture's vertices, optionally only those carried mostly by `bones`. */
function skin(rig: LocoRig, f: Fixture, world: Matrix4[], bones?: number[]): Vector3[] {
    const inv = restInverses(rig);
    const m = world.map((w, b) => new Matrix4().multiplyMatrices(w, inv[b]));
    const out: Vector3[] = [];
    const n = f.positions.length / 3;
    const v = new Vector3();
    for (let i = 0; i < n; i++) {
        let best = -1;
        let bw = -1;
        let total = 0;
        for (let k = 0; k < 4; k++) {
            total += f.weights[i * 4 + k];
            if (f.weights[i * 4 + k] > bw) (bw = f.weights[i * 4 + k]), (best = f.joints[i * 4 + k]);
        }
        if (total <= 0 || (bones && !bones.includes(best))) continue;
        v.set(f.positions[i * 3], f.positions[i * 3 + 1], f.positions[i * 3 + 2]);
        const acc = new Vector3();
        for (let k = 0; k < 4; k++) {
            const w = f.weights[i * 4 + k];
            if (w > 0) acc.addScaledVector(v.clone().applyMatrix4(m[f.joints[i * 4 + k]]), w);
        }
        out.push(acc);
    }
    return out;
}
const lowest = (pts: Vector3[]) => pts.reduce((a, p) => Math.min(a, p.y), Infinity);

// MARK: Galumph

test("MA4 metric: a true seal galumphs on its belly: on the ground, the back humping, hind flippers up, a hump a fifth of its length", () => {
    const f = fixture("harbor-seal");
    const rig = buildLocoRig(f);
    const L = 1.6;
    const input = (over: Partial<LocoInput>): LocoInput => ({instance: new Matrix4(), scale: 1, yaw: 0, dt: 1 / 60, clock: 10, seed: 0.3, ground: flat, grounded: true, clipNow: "walk", clipFrom: null, clipPhase: 0, ...over});
    // Who draws a seal on land: the galumph (never the legged gaits); a sea lion: the legged gaits.
    assert.equal(galumphDriver.takes(rig, input({})), true);
    assert.equal(leggedDriver.takes(rig, input({})), false);
    assert.equal(galumphDriver.takes(rig, input({clipNow: "idle"})), false, "standing, its own idle plays");
    assert.equal(galumphDriver.takes(rig, input({grounded: false})), false, "in the water, not");
    const lion = buildLocoRig(fixture("california-sea-lion"));
    assert.equal(galumphDriver.takes(lion, input({})), false);
    assert.equal(leggedDriver.takes(lion, input({})), true);
    // (At rest a sea lion or the walrus keeps its own baked idle, propped on its fore flippers: the legged gaits only travel.)
    assert.equal(leggedDriver.takes(lion, input({clipNow: "idle"})), false);
    assert.equal(leggedDriver.takes(buildLocoRig(fixture("walrus")), input({clipNow: "idle"})), false);
    assert.equal(leggedDriver.takes(buildLocoRig(fixture("cane-toad")), input({clipNow: "idle"})), true);

    // (The flippers' webs: the foot bones; the upper and lower bones carry the belly skin by the hips too.)
    const hind = rig.legs.filter((l) => l.end === "hind").map((l) => l.foot);
    let gapMax = 0;
    let humpMax = 0;
    let hindClear = Infinity;
    for (const pace of [0.1, 0.2, 0.35]) {
        const {frames, state} = run(rig, L, pace, 6, 0.2, galumphDriver);
        // Humps along its way: one every fifth of its length (the most two a second).
        const s = state as GalumphState;
        const metres = pace * L * 6;
        const stride = Math.max(GALUMPH_STRIDE * L, (pace * L) / 2);
        assert.ok(Math.abs(s.cycles - 0.3 * 3 - metres / stride) < 0.6, `${pace}: ${s.cycles.toFixed(2)} humps over ${metres.toFixed(2)} m`);
        for (const fr of frames.filter((x) => x.t > 1.5 && x.t < 6.5)) {
            const pts = skin(rig, f, fr.world);
            gapMax = Math.max(gapMax, Math.abs(lowest(pts)) / L);
            hindClear = Math.min(hindClear, lowest(skin(rig, f, fr.world, hind)) / L);
            // The back's hump: the belly's middle third off the ground.
            const mid = pts.filter((p) => Math.abs(p.z - (fr.place + 0)) < 0.17 * L && Math.abs(p.x) < 0.15 * L);
            humpMax = Math.max(humpMax, lowest(mid) / L);
        }
    }
    recordMotionMetric("ma4", "galumph_ground_gap_max", gapMax, "share of its length");
    recordMotionMetric("ma4", "galumph_hump", humpMax, "share of its length");
    recordMotionMetric("ma4", "galumph_hind_flipper_clearance", hindClear, "share of its length");
    assert.ok(gapMax <= 0.02, `its lowest point ${(gapMax * 100).toFixed(1)}% of its length off or into the ground`);
    assert.ok(humpMax >= 0.03, `the back humps ${(humpMax * 100).toFixed(1)}% of its length`);
    assert.ok(hindClear >= 0.004, `the hind flippers ${(hindClear * 100).toFixed(2)}% of its length off the ground`);
});

test("MA4 metric: sea lions and the walrus walk on their flippers with planted feet (the legged gaits' own limits)", () => {
    const fails: string[] = [];
    let worst = 0;
    for (const [slug, L] of [["california-sea-lion", 2.0], ["walrus", 3.0]] as const) {
        const rig = buildLocoRig(fixture(slug));
        const scale = L / Math.max(rig.length, rig.height);
        for (const scenario of ["walk", "run", "spin"] as Scenario[]) {
            const {metrics: m, gaits} = simulate(rig, scenario, scale, leggedPoser(), 7);
            worst = Math.max(worst, m.slideShare);
            if (m.slideShare > 0.02) fails.push(`${slug} ${scenario}: slide ${m.slideShare}`);
            if (m.jointViolations > 0.02) fails.push(`${slug} ${scenario}: joints ${m.jointViolations}`);
            if (scenario !== "spin" && m.strideMismatch > 0.12) fails.push(`${slug} ${scenario}: stride ${m.strideMismatch}`);
            if (gaits.some((g) => g === "trot" || g === "gallop" || g === "rotary")) fails.push(`${slug} ${scenario}: ${gaits.join(">")}`);
        }
    }
    recordMotionMetric("ma4", "flipper_walk_slide_max", worst, "share of the hip");
    assert.deepEqual(fails, []);
});

// MARK: Saltation

/** Where the body is (its hips, world z) against where its place puts them (the rest hips through the instance). */
function offsetOf(rig: LocoRig, fr: Frame): number {
    const now = new Vector3().setFromMatrixPosition(fr.world[rig.hips]);
    const rest = new Vector3().setFromMatrixPosition(rig.bones[rig.hips].restWorld).applyMatrix4(fr.instance);
    return now.z - rest.z;
}

/** A run's hops (how far the body moved between sits), its lowest point's best height in the air, its planted feet's drift. */
function hopsOf(frames: Frame[], rig: LocoRig, f: Fixture): {hops: number[]; airLift: number; sitSlide: number} {
    const sits: number[] = [];
    let airLift = 0;
    let sitSlide = 0;
    let anchor: Vector3[] | null = null;
    let was = "";
    for (const fr of frames) {
        if (fr.phase === "sit") {
            const at = rig.legs.map((l) => new Vector3().setFromMatrixPosition(fr.world[l.foot]));
            if (was !== "sit") {
                anchor = at;
                sits.push(new Vector3().setFromMatrixPosition(fr.world[rig.hips]).z);
            } else sitSlide = Math.max(sitSlide, ...at.map((p, i) => Math.hypot(p.x - anchor![i].x, p.z - anchor![i].z)));
        } else if (fr.phase === "air") airLift = Math.max(airLift, lowest(skin(rig, f, fr.world)));
        was = fr.phase;
    }
    return {hops: sits.slice(1).map((z, i) => z - sits[i]), airLift, sitSlide};
}

test("MA4 metric: frogs and toads hop: feet planted while they sit, a ballistic hop of their natural length, landing on their place", () => {
    const out: Record<string, number> = {};
    const fails: string[] = [];
    for (const [slug, L] of [["common-frog", 0.08], ["cane-toad", 0.15]] as const) {
        const f = fixture(slug);
        const rig = buildLocoRig(f);
        const cls = hopClassOf(slug)!;
        const natural = HOPS[cls].lengths * L;
        // At a frog's pace (1.4 lengths a second: the common toad's on the real island), then standing.
        const {frames, state} = run(rig, L, 1.4, 6, 3, saltationDriver);
        const s = state as SaltationState;
        const {hops, airLift, sitSlide} = hopsOf(frames, rig, f);
        const lengths = hops.filter((h) => h > 0.3 * natural).sort((a, b) => a - b);
        const median = lengths[Math.floor(lengths.length / 2)] / natural;
        // How far the body is from its place: never more than about a hop behind; at rest, on it.
        const lag = Math.max(...frames.map((fr) => Math.abs(offsetOf(rig, fr)))) / L;
        const settled = Math.abs(offsetOf(rig, frames[frames.length - 1])) / L;
        out[`${cls}_hop_length_ratio`] = median;
        out[`${cls}_air_lift`] = airLift / L;
        out[`${cls}_sit_slide`] = sitSlide / L;
        out[`${cls}_lag_max`] = lag;
        out[`${cls}_settled`] = settled;
        // (8.4 body lengths in 6 s: about four leaps of 2.2, nine hops of 0.9.)
        if (s.hops < (cls === "leap" ? 3 : 7)) fails.push(`${slug}: ${s.hops} hops in 6 s`);
        if (!(median > 0.8 && median < 1.35)) fails.push(`${slug}: hops ${median.toFixed(2)} of its natural length`);
        if (airLift / L < (cls === "leap" ? 0.12 : 0.04)) fails.push(`${slug}: off the ground ${(airLift / L).toFixed(3)} of its length in the air`);
        if (sitSlide / L > 0.02) fails.push(`${slug}: planted feet slide ${(sitSlide / L).toFixed(3)} of its length`);
        if (lag > HOPS[cls].lengths + 1) fails.push(`${slug}: ${lag.toFixed(2)} lengths from its place`);
        if (settled > 0.25) fails.push(`${slug}: settles ${settled.toFixed(2)} lengths from its place`);
    }
    for (const [id, v] of Object.entries(out)) recordMotionMetric("ma4", id, v);
    console.log(`hops: ${JSON.stringify(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, Math.round(v * 1000) / 1000])))}`);
    assert.deepEqual(fails, []);
});

test("MA4: a toad walks when slow (the legged gaits, a sprawl) and hops when faster", () => {
    const f = fixture("cane-toad");
    const rig = buildLocoRig(f);
    const slow = run(rig, 0.15, 0.5, 4, 0.5, saltationDriver);
    assert.ok(slow.frames.filter((x) => x.t > 1.5 && x.t < 4).every((x) => x.gait === "sprawl" || x.gait === "stand"), Array.from(new Set(slow.frames.map((x) => x.gait))).join(","));
    assert.equal((slow.state as SaltationState).hops, 0);
    const fast = run(rig, 0.15, TOAD_HOP_PACE * 1.5, 4, 0.5, saltationDriver);
    assert.ok((fast.state as SaltationState).hops >= 4, `${(fast.state as SaltationState).hops} hops`);
    // A frog of a leaping family never walks: it sits and hops even slowly.
    const frog = buildLocoRig(fixture("common-frog"));
    const creep = run(frog, 0.08, 0.4, 6, 0.5, saltationDriver);
    assert.ok(creep.frames.every((x) => x.gait !== "sprawl"));
    assert.ok((creep.state as SaltationState).hops >= 1);
});

test("MA4 metric: a frog on a winding way turns where it sits before it hops, and its hind feet never come over its back", () => {
    let worst = -Infinity;
    let twisted = 0;
    for (const [slug, L] of [["common-frog", 0.08], ["cane-toad", 0.15], ["common-toad", 0.09]] as const) {
        const rig = buildLocoRig(fixture(slug));
        const scale = L / Math.max(rig.length, rig.height);
        const state = saltationDriver.init(rig) as SaltationState;
        // A circle of two body lengths' radius at 1.6 lengths a second: it changes heading all the time.
        const r = 2 * L;
        const v = 1.6 * L;
        let pushYaw: number | null = null;
        for (let fr = 0; fr <= 60 * 8; fr++) {
            const t = fr / 60;
            const a = (v * t) / r;
            const instance = new Matrix4().compose(new Vector3(r - r * Math.cos(a), -rig.minY * scale, r * Math.sin(a)), new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), a), new Vector3(scale, scale, scale));
            const world = rig.bones.map((b) => b.restWorld.clone());
            saltationDriver.pose(rig, {instance, scale, yaw: a, dt: 1 / 60, clock: 50 + t, seed: 0.2, ground: flat, grounded: true, clipNow: "walk", clipFrom: null, clipPhase: 0}, world, state);
            if (state.walking) continue;
            // Pushing off: the body already faces its hop (it turned while it sat).
            if (state.phase === "push" && pushYaw === null) {
                pushYaw = state.hop.yaw;
                if (Math.abs(Math.atan2(Math.sin(state.hop.yaw - state.hop.yaw0), Math.cos(state.hop.yaw - state.hop.yaw0))) > 0.4) twisted++;
            }
            if (state.phase !== "push") pushYaw = null;
            // Each hind foot's ankle and toes against its hip, in the hips' own frame (up = the body's up).
            const hipsTurn = new Quaternion().setFromRotationMatrix(new Matrix4().extractRotation(world[rig.hips])).multiply(new Quaternion().setFromRotationMatrix(new Matrix4().extractRotation(rig.bones[rig.hips].restWorld)).invert());
            for (const leg of rig.legs.filter((l) => l.end === "hind")) {
                const hip = new Vector3().setFromMatrixPosition(world[leg.upper]);
                const toes = bonePointNow(rig, world, leg.foot, leg.contact, new Vector3());
                for (const p of [new Vector3().setFromMatrixPosition(world[leg.foot]), toes]) {
                    const rel = p.sub(hip).applyQuaternion(hipsTurn.clone().invert());
                    worst = Math.max(worst, rel.y / (leg.upperLength + leg.lowerLength));
                }
            }
        }
        assert.ok(state.hops >= 4, `${slug}: ${state.hops} hops`);
    }
    recordMotionMetric("ma4", "frog_hind_foot_over_hip", worst, "share of the leg");
    recordMotionMetric("ma4", "frog_hops_pushing_while_turning", twisted);
    assert.ok(worst < 0, `a hind foot ${worst.toFixed(2)} of its leg above its hip`);
    assert.equal(twisted, 0);
});
