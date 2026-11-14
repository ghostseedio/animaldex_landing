/**
 * Behaviours pass, lane B5 air (docs/ark/behaviour-pass-2026-11/air.md): a flyer keeps to a station and flies off it as
 * its way of life has it (`locomotion/flight.ts` FLIGHT_WAYS, `behaviour-schedule.ts` stations); a thermal soarer soars
 * for minutes at a time in the warm hours, wide, rising and drifting, and only then; an aerial feeder sweeps to and fro
 * and never circles; a flock comes down together.
 *
 * Before (live main c99ff83b, the real snapshot, one-second steps): every bird that flies first took off 26 to 61 times
 * an awake hour whatever it was (common buzzard 61, kingfishers 50 to 54, herons 26 to 41, turkey vulture 34), 2 to 4 s
 * and 7 to 25 m a flight; no flight was longer than 63 s; soaring was as likely at dawn as at noon.
 */
// (First: the bigger wild island, v2, what islands mode shows, before anything samples the world.)
import "@/lib/ark-world-v2-first";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import fixtureV2 from "@/ark-scene/fixtures/snapshot-v2.json";
import {behaviourProfile, type ArkBehaviourProfile} from "@/ark-scene/behaviour-profile";
import {groupSpread, poseOnTrip, rangeReach, scheduleWorld, SLOT_SECONDS, spaceHomes, tripAt, wireThreats, type ScheduleAnimal, type Trip} from "@/ark-scene/behaviour-schedule";
import {eats} from "@/ark-scene/food-links";
import {airPacesOf, airProgress, aloftSlots, FLIGHT_WAYS, flightAccelOf, flightHop, flightSpec, flightWay, hawkAt, planSoarLeg, SOAR_BANK, soarAt, soarSpecOf, stationBout, takeoffClass, trackAt, UNRIGGED_PITCH_MOST, unriggedFlightPitch, type FlightWay} from "@/ark-scene/locomotion/flight";
import waysTable from "@/ark-scene/locomotion/flight-ways.json";
import {recordMotionMetric} from "@/lib/ark-motion-metrics";
import {placeAnimals} from "@/ark-scene/placement";
import {displayLength} from "@/ark-scene/sizes";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import type {ArkAnimal} from "@/ark-scene/types";
import {worldSampler} from "@/ark-scene/world-sampler";

const TAU = Math.PI * 2;
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

// MARK: The table

test("B5: each flyer's way of life comes from its family and how it hunts", () => {
    const expected: Record<string, FlightWay> = {
        "common-buzzard": "soar", "golden-eagle": "soar", osprey: "soar", "turkey-vulture": "vulture", "andean-condor": "vulture", "white-stork": "stork", "great-white-pelican": "stork",
        "common-kingfisher": "perch", "european-bee-eater": "perch", "barn-owl": "perch", "eurasian-sparrowhawk": "perch", "common-kestrel": "perch", "brown-shrike": "perch",
        "barn-swallow": "aerial", "european-nightjar": "aerial", "common-swift": "swift", "great-tit": "flit", "cettis-warbler": "flit", "downy-woodpecker": "tree",
        "house-sparrow": "ground", "european-starling": "ground", "scarlet-macaw": "commute", "great-hornbill": "commute", "grey-heron": "wader", "glossy-ibis": "wader",
        sanderling: "shore", "herring-gull": "patrol", "atlantic-puffin": "patrol", "ruby-throated-hummingbird": "hover"
    };
    for (const [slug, way] of Object.entries(expected)) assert.equal(flightWay(slug), way, slug);
    // Only animals that fly first have one; every row is a way the schedule knows.
    for (const [slug, way] of Object.entries((waysTable as {species: Record<string, string>}).species)) {
        assert.ok(way in FLIGHT_WAYS, `${slug}: ${way}`);
        assert.equal(behaviourProfile(slug).move, "fly", `${slug} has a way and does not fly first`);
    }
    for (const slug of ["mallard", "eurasian-coot", "common-pheasant", "plains-zebra"]) assert.equal(flightWay(slug), null, slug);
});

test("B5: bouts cover every slot once, the same for every caller, each animal's its own length", () => {
    const lengths = new Set<number>();
    for (const seed of [0.01, 0.2, 0.37, 0.61, 0.83, 0.99]) {
        const rule = FLIGHT_WAYS.perch;
        let last = stationBout(rule, seed, 1000);
        lengths.add(last.slots);
        assert.ok(last.slots >= Math.round(rule.bout * 0.7) && last.slots <= Math.round(rule.bout * 1.3));
        for (let slot = 1001; slot < 1400; slot++) {
            const bout = stationBout(rule, seed, slot);
            assert.ok(slot >= bout.first && slot < bout.first + bout.slots);
            assert.ok(bout.index === last.index || (bout.index === last.index + 1 && bout.first === slot));
            last = bout;
        }
    }
    assert.ok(lengths.size >= 3);
    // A soarer's bout starts with a soar for about its way's share of them, never longer than the bout.
    let soars = 0;
    for (let index = 0; index < 400; index++) {
        const n = aloftSlots(FLIGHT_WAYS.soar, 0.37, {index, slots: 30});
        assert.ok(n === 0 || (n >= 8 && n <= 16));
        if (n) soars++;
    }
    assert.ok(Math.abs(soars / 400 - FLIGHT_WAYS.soar.aloft!.share) < 0.1, `${soars} of 400`);
    assert.equal(aloftSlots(FLIGHT_WAYS.perch, 0.37, {index: 3, slots: 12}), 0);
});

// MARK: The soar

const buzzard = airPacesOf(flightSpec("common-buzzard", 0.52, "flying_bird")!, takeoffClass("common-buzzard"));
const vulture = airPacesOf(flightSpec("turkey-vulture", 0.72, "flying_bird")!, takeoffClass("turkey-vulture"));
const WIND = {x: 0.28, z: 0.21};

test("B5: a soar is wide, rises in its thermal, drifts with the wind, and never jumps (no memory: any moment on its own)", () => {
    for (const [name, paces, span] of [["common-buzzard", buzzard, 36], ["turkey-vulture", vulture, 50]] as const) {
        const spec = soarSpecOf(paces, span, Infinity, WIND);
        // (Its circle is its bank's: v² / (g tan 24°), 12 m at the least. The old failure circled at 6 to 12 m.)
        assert.ok(spec.radius >= 12 && spec.radius <= 45, `${name} radius ${spec.radius}`);
        assert.ok(Math.abs(spec.radius - (spec.circle * spec.circle) / (9.81 * Math.tan(SOAR_BANK))) < 0.01 || spec.radius === 12);
        const home = {x: 40, z: -30};
        const t0 = 1_794_000_000;
        let prev = soarAt(0.3, home, spec, t0);
        let worstStep = 0;
        let worstTurn = 0;
        let turned = 0;
        let circling = 0;
        let rises = 0;
        let risesOf = 0;
        const centres: Array<{x: number; z: number}> = [];
        for (let i = 1; i <= 7200; i++) {
            const at = soarAt(0.3, home, spec, t0 + i * 0.25);
            worstStep = Math.max(worstStep, Math.hypot(at.x - prev.x, at.z - prev.z));
            worstTurn = Math.max(worstTurn, Math.abs(wrap(at.yaw - prev.yaw)));
            turned += Math.abs(wrap(at.yaw - prev.yaw));
            if (at.circling) circling++;
            if (at.circling && prev.circling && at.thermal === prev.thermal) {
                risesOf++;
                if (at.lift >= prev.lift) rises++;
            }
            assert.ok(at.lift >= 0 && at.lift <= span + 1e-6, `${name} lift ${at.lift}`);
            assert.ok(Math.hypot(at.x - home.x, at.z - home.z) <= spec.reach + spec.radius + 0.35 * 200, `${name} strays ${Math.hypot(at.x - home.x, at.z - home.z)}`);
            prev = at;
            if (i % 4 === 0) centres.push({x: at.x, z: at.z});
        }
        // Never faster than its glide and a quarter over a quarter second, never a snap of its heading.
        assert.ok(worstStep <= spec.glide * 0.25 * 1.3, `${name} step ${worstStep}`);
        assert.ok(worstTurn <= 0.3, `${name} heading step ${worstTurn}`);
        assert.equal(rises, risesOf, `${name} sinks in a thermal`);
        // It drifts: over each minute of circling, where it has been is wider than its circle (the audit's old circling
        // sat inside 20 m for a minute; a turkey vulture's circle alone is wider than that).
        let widest = 0;
        for (let i = 60; i < centres.length; i += 30) {
            const window = centres.slice(i - 60, i);
            const cx = window.reduce((s, p) => s + p.x, 0) / 60;
            const cz = window.reduce((s, p) => s + p.z, 0) / 60;
            widest = Math.max(widest, ...window.map((p) => Math.hypot(p.x - cx, p.z - cz)));
        }
        assert.ok(widest > spec.radius, `${name} widest ${widest}`);
        recordMotionMetric("b5", `soar_radius_${name.split("-").pop()}`, spec.radius);
        recordMotionMetric("b5", `soar_turns_per_minute_${name.split("-").pop()}`, turned / TAU / 30);
        assert.ok(turned / TAU / 30 < 6, `${name} turns a minute ${turned / TAU / 30}`);
        assert.ok(circling / 7200 > 0.8);
        // Its pace between its circle's and its glide's eases (BA2: it stepped from one to the other, and where two
        // thermals' circles all but touched it stood nearly still for a second and a half): never under 0.7 of its
        // circle's pace, and never changing faster than three quarters of what its mass allows (it eases at half of
        // it; a short glide between two circles of different paces a little faster: 0.62 and 0.59 measured).
        let slowest = Infinity;
        let hardest = 0;
        let last: number | null = null;
        let was = soarAt(0.3, home, spec, t0);
        for (let i = 1; i <= 14400; i++) {
            const at = soarAt(0.3, home, spec, t0 + i * 0.125);
            const pace = Math.hypot(at.x - was.x, at.z - was.z) / 0.125;
            slowest = Math.min(slowest, pace);
            if (last !== null) hardest = Math.max(hardest, Math.abs(pace - last) / 0.125);
            last = pace;
            was = at;
        }
        assert.ok(slowest >= spec.circle * 0.7, `${name} slows to ${slowest.toFixed(2)} m/s (its circle's pace ${spec.circle.toFixed(2)})`);
        console.log(`${name}'s soar: slowest ${(slowest / spec.circle).toFixed(2)} of its circle's pace; its pace changes at ${(hardest / Math.min(paces.accel, paces.brake)).toFixed(2)} of its cap at the most`);
        assert.ok(hardest <= Math.min(paces.accel, paces.brake) * 0.75, `${name}'s pace changes at ${hardest.toFixed(2)} m/s² (its cap ${Math.min(paces.accel, paces.brake).toFixed(2)})`);
    }
});

test("B5: a kettle's members ride the same thermals strung round the circle, never at their leader's side", () => {
    const spec = soarSpecOf(vulture, 50, Infinity, WIND);
    const home = {x: -20, z: 60};
    let beside = 0;
    let near = 0;
    for (let i = 0; i < 3600; i++) {
        const t = 1_794_000_000 + i * 0.5;
        const lead = soarAt(0.55, home, spec, t);
        for (const member of [1, 2, 3]) {
            const at = soarAt(0.55, home, spec, t, member);
            const d = Math.hypot(at.x - lead.x, at.z - lead.z);
            // (The audit's "flying together": within 4 m, or three lengths, heading within 30 degrees.)
            if (d < 4 && Math.abs(wrap(at.yaw - lead.yaw)) < Math.PI / 6) beside++;
            if (d < spec.radius * 4) near++;
        }
    }
    assert.equal(beside, 0);
    // In the same thermal most of the time (within two circles of each other).
    assert.ok(near / (3600 * 3) > 0.8, `near ${near / (3600 * 3)}`);
});

test("B5: an aerial feeder sweeps to and fro in a figure of eight: it turns both ways, keeps its pace up, and stays by its patch", () => {
    const spec = {cruise: 7.2, reach: 20, low: 1.6, high: 4.8};
    const home = {x: 10, z: 10};
    let prev = hawkAt(0.3, home, spec, 1_794_000_000);
    let left = 0;
    let right = 0;
    let slowest = Infinity;
    let fastest = 0;
    let most = 0;
    for (let i = 1; i <= 4800; i++) {
        const at = hawkAt(0.3, home, spec, 1_794_000_000 + i * 0.25);
        const turn = wrap(at.yaw - prev.yaw);
        if (turn > 0) left += turn;
        else right -= turn;
        const pace = Math.hypot(at.x - prev.x, at.z - prev.z) / 0.25;
        slowest = Math.min(slowest, pace);
        fastest = Math.max(fastest, pace);
        most = Math.max(most, Math.hypot(at.x - home.x, at.z - home.z));
        assert.ok(at.lift >= spec.low - 1e-6 && at.lift <= spec.high + 1e-6);
        prev = at;
    }
    // As much one way as the other (a circle is all one way).
    assert.ok(Math.min(left, right) / Math.max(left, right) > 0.7, `left ${left} right ${right}`);
    assert.ok(slowest > spec.cruise * 0.35 && fastest < spec.cruise * 1.3, `${slowest} to ${fastest}`);
    assert.ok(most < 60);
    recordMotionMetric("b5", "hawk_turn_balance", Math.min(left, right) / Math.max(left, right));
});

test("B5: a soar's legs up into it and down out of it start and end at the right pace", () => {
    const up = planSoarLeg(buzzard, 400, {pace: 8, from: false, to: true, climb: 40});
    assert.deepEqual([up.knots[0], up.knots[1]], [0, 0]);
    assert.deepEqual(up.knots.slice(-2), [1, 1]);
    assert.ok(up.soar && !up.soar.from && up.soar.to);
    assert.ok(airProgress(up.knots, 1).share > 0.999);
    const down = planSoarLeg(buzzard, 200, {pace: 10, from: true, to: false, descend: 30});
    assert.deepEqual([down.knots[0], down.knots[1]], [0, 1]);
    assert.deepEqual(down.knots.slice(-2), [1, 0]);
    // Never braking harder than its mass allows.
    assert.ok(10 / ((1 - down.knots[down.knots.length - 4]) * down.seconds) <= buzzard.brake * 1.001);
    // A track is read through its points.
    const track = new Float32Array([0, 10, 0, 8, 11, 0, 16, 12, 0, 24, 13, 0]);
    assert.deepEqual([trackAt(track, 0).x, trackAt(track, 0).y], [0, 10]);
    assert.deepEqual([trackAt(track, 1).x, trackAt(track, 1).y], [24, 13]);
    assert.ok(Math.abs(trackAt(track, 0.5).x - 12) < 1e-6 && Math.abs(trackAt(track, 0.5).yaw - Math.PI / 2) < 1e-6);
    // (BA2) Fitted to the time it has, its take-off is still at its mass's acceleration: the leg used to be planned at
    // its pace and squeezed into what was left of its slot, its take-off with it (1.3 times a kite's cap on the real
    // snapshot). And it comes to its track at its track's speed there.
    for (const share of [0.85, 1, 1.2]) {
        const fit = planSoarLeg(buzzard, 400, {pace: 8, from: false, to: true, leave: 9.5, seconds: up.seconds * share});
        assert.ok(Math.abs(fit.seconds - up.seconds * share) < 1e-3, `${share}: ${fit.seconds} s for ${up.seconds * share}`);
        const accel = fit.peak / (fit.knots[2] * fit.seconds);
        assert.ok(Math.abs(accel - buzzard.accel) < buzzard.accel * 1e-3, `${share}: takes off at ${accel.toFixed(2)} m/s² (its mass's ${buzzard.accel.toFixed(2)})`);
        assert.ok(Math.abs(fit.knots[fit.knots.length - 1] * fit.peak - 9.5) < 1e-6, `${share}: joins at ${fit.knots[fit.knots.length - 1] * fit.peak} m/s`);
        // (Every change of pace along it within its mass's.)
        for (let i = 2; i < fit.knots.length; i += 2) {
            const rate = (Math.abs(fit.knots[i + 1] - fit.knots[i - 1]) * fit.peak) / Math.max((fit.knots[i] - fit.knots[i - 2]) * fit.seconds, 1e-9);
            assert.ok(rate <= Math.max(buzzard.accel, buzzard.brake) * 1.001, `${share}: ${rate.toFixed(2)} m/s²`);
        }
    }
    // Out of its soar it starts at the speed it was soaring at, and eases to its cruise.
    const leaves = planSoarLeg(buzzard, 200, {pace: 10, from: true, to: false, enter: 8, descend: 30});
    assert.ok(Math.abs(leaves.knots[1] * leaves.peak - 8) < 1e-6 && Math.abs(leaves.peak - 10) < 1e-6);
    assert.ok((2 / (leaves.knots[2] * leaves.seconds)) <= buzzard.accel * 1.001);
    // A way down longer than its slot at its cruise: quicker, braking as hard as ever (not squeezed).
    const long = planSoarLeg(buzzard, 900, {pace: 10, from: true, to: false, enter: 10, seconds: 74});
    assert.ok(Math.abs(long.seconds - 74) < 1e-3 && long.peak > 10 && long.peak < 13);
    assert.ok(long.peak / ((1 - long.knots[long.knots.length - 4]) * long.seconds) <= buzzard.brake * 1.001);
    // A track's ends with the points before and after it: at its own speed and heading there, where the curve's ends
    // were its end points twice (half its speed, along its first and last chords).
    const bend = new Float32Array([0, 10, 0, 8, 10, 0, 16, 10, 2, 24, 10, 6]);
    assert.ok(Math.abs(trackAt(bend, 0).rate - 12) < 1e-6, "an end with no lead is at half pace");
    const lead = new Float32Array([-8, 10, 0, 32, 10, 12]);
    assert.ok(Math.abs(trackAt(bend, 0, lead).rate - 24) < 1e-6 && Math.abs(trackAt(bend, 0, lead).yaw - Math.PI / 2) < 1e-6);
    const end = trackAt(bend, 1, lead);
    assert.ok(Math.abs(end.yaw - Math.atan2(16, 10)) < 1e-6 && Math.abs(end.rate - (Math.hypot(16, 10) / 2) * 3) < 1e-6);
    assert.deepEqual([end.x, end.z], [24, 6]);
});

test("B5: a hop from A to B (the hunt lane's forays) leaves and lands at rest, at its mass's acceleration, on its spots", () => {
    for (const [slug, L, d, rise] of [["common-kingfisher", 0.17, 9, 2], ["common-buzzard", 0.52, 40, -6], ["barn-owl", 0.35, 3, 0]] as const) {
        const paces = airPacesOf(flightSpec(slug, L, "flying_bird")!, takeoffClass(slug));
        const from = {x: 5, y: 10, z: -3};
        const to = {x: 5 + d * 0.6, y: 10 + rise, z: -3 + d * 0.8};
        const hop = flightHop(paces, from, to, 4);
        const first = hop.at(0);
        const last = hop.at(hop.seconds);
        assert.ok(Math.hypot(first.x - from.x, first.y - from.y, first.z - from.z) < 1e-6 && first.speed === 0 && !first.aloft, slug);
        assert.ok(Math.hypot(last.x - to.x, last.y - to.y, last.z - to.z) < 1e-6 && last.speed === 0 && !last.aloft, slug);
        let fastest = 0;
        let highest = -Infinity;
        let was = first;
        for (let k = 1; k <= 200; k++) {
            const at = hop.at((hop.seconds * k) / 200);
            // (Never speeding up or slowing harder than its mass allows, a tenth over for the sampling.)
            assert.ok(Math.abs(at.speed - was.speed) / (hop.seconds / 200) <= Math.max(paces.accel, paces.brake) * 1.1 + 1e-6, `${slug} at ${k}`);
            fastest = Math.max(fastest, at.speed);
            // (Its height over the line between its spots, where it is along it.)
            highest = Math.max(highest, at.y - (from.y + (to.y - from.y) * ((at.x - from.x) / (to.x - from.x))));
            was = at;
        }
        assert.ok(fastest <= paces.cruise + 1e-6 && fastest > 0.3 * Math.min(paces.cruise, Math.sqrt(d * paces.accel)), `${slug} peaks at ${fastest}`);
        assert.ok(highest <= 4 + 1e-6 && highest > 0, `${slug} rises ${highest}`);
    }
});

// MARK: A flyer drawn without a rig

test("B5: a flyer drawn without a rig is level in level flight, nose up on its climb, never on its head", () => {
    // (The graphics pass's report, 2026-11-14: a greater flamingo with no rig flew as its standing mesh pitched head
    // down. The scene pitched every flyer 0.95 rad nose down for the whole of every flight; a rig's own attitude hid it.)
    assert.equal(unriggedFlightPitch("cruise"), 0);
    assert.equal(unriggedFlightPitch(null), 0);
    assert.ok(unriggedFlightPitch("climb") < 0 && unriggedFlightPitch("run") < 0, "nose up out of a take-off");
    assert.ok(unriggedFlightPitch("descend") > 0 && unriggedFlightPitch("descend") <= 0.15, "a little nose down coming in");
    for (const stage of ["run", "climb", "cruise", "descend", "ski", null] as const) assert.ok(Math.abs(unriggedFlightPitch(stage)) <= UNRIGGED_PITCH_MOST);
    assert.ok(UNRIGGED_PITCH_MOST <= 0.3);
    recordMotionMetric("b5", "unrigged_level_flight_pitch_rad", Math.abs(unriggedFlightPitch("cruise")));
    recordMotionMetric("b5", "unrigged_pitch_most_rad", Math.max(...(["run", "climb", "cruise", "descend", "ski"] as const).map((stage) => Math.abs(unriggedFlightPitch(stage)))));
    // The scene's poses take it from there: no flyer's pose is pitched by a constant in the air any more.
    const scene = readFileSync(new URL("../ark-scene/index.ts", import.meta.url), "utf8");
    assert.ok(!/pitch: \(?at\.aloft \? 0\.\d+ \* entry\.air/.test(scene) && !/pitch: 0\.95/.test(scene), "a constant nose-down pitch in the air is back in index.ts");
    assert.ok(scene.includes("unriggedFlightPitch(own.pose.air?.stage ?? null)"));
});

// MARK: On the schedule (the fixture Ark, v2)

const world = scheduleWorld(worldSampler());
const snapshot = decodeArkSnapshot(fixtureV2)!;
const places = placeAnimals(snapshot.animals);
const SEA = new Set(["coral_reef", "open_ocean"]);
const GROUPED = new Set(["herd", "flock", "school", "troop", "pack", "group", "colony", "swarm"]);
type Item = {a: ArkAnimal; animal: ScheduleAnimal; profile: ArkBehaviourProfile};

/** The fixture's animals wired as the scene wires them (as `ark-behaviour-schedule.test.ts`). */
function wire(): Item[] {
    const items: Item[] = snapshot.animals.map((a) => {
        const p = places.get(a.id)!;
        return {a, profile: behaviourProfile(a.model_slug), animal: {id: a.id, zone: a.zone, home: {x: p.x, y: p.ground, z: p.z}, length: displayLength(a), sea: SEA.has(a.zone)}};
    });
    const byId = new Map(items.map((i) => [i.a.id, i]));
    const sizes = new Map<string, number>();
    for (const i of items) {
        const lead = places.get(i.a.id)!.leader;
        if (lead && lead !== i.a.id) sizes.set(lead, (sizes.get(lead) ?? 1) + 1);
    }
    for (const i of items) {
        const place = places.get(i.a.id)!;
        const leader = place.leader && place.leader !== i.a.id ? byId.get(place.leader) : null;
        if (leader && leader.a.model_slug === i.a.model_slug && GROUPED.has(i.profile.social)) i.animal.group = {leader: leader.animal, profile: leader.profile, activity: leader.a.activity, rank: Math.max(place.rank ?? 1, 1), size: sizes.get(leader.a.id) ?? 2};
    }
    const radius = new Map(items.map((i) => [i.a.id, rangeReach(i.profile, i.animal) + (sizes.has(i.a.id) ? groupSpread(i.animal.length, sizes.get(i.a.id)!) : 0)]));
    const spaced = spaceHomes(
        items.filter((i) => !i.animal.group).map((i) => ({id: i.a.id, slug: i.a.model_slug, home: i.animal.home, length: i.animal.length, walkable: (x: number, z: number) => (i.profile.move === "swim" || i.profile.seabed ? world.nav.swimmable(x, z, 0.5) : world.nav.walkable(x, z))})),
        eats,
        (id) => radius.get(id) ?? 3
    );
    for (const i of items) {
        const moved = spaced.get(i.a.id);
        if (!moved) continue;
        i.animal.home = {x: moved.home.x, y: Math.max(world.sampler.heightAt(moved.home.x, moved.home.z), 0), z: moved.home.z};
        i.animal.range = moved.range === null ? null : sizes.has(i.a.id) ? moved.range / 2 : moved.range;
        i.animal.prey = moved.prey;
    }
    for (const i of items) {
        const lead = i.animal.group?.leader;
        if (!lead || !spaced.has(lead.id)) continue;
        i.animal.home = {...lead.home};
        i.animal.range = lead.range;
    }
    wireThreats(items.map((i) => ({slug: i.a.model_slug, animal: i.animal, profile: i.profile, activity: i.a.activity})), eats);
    return items;
}
const animals = wire();
const DAY = Math.floor(Date.UTC(2026, 10, 11) / 1000);

type Flown = {flights: number; longest: number; air: number; awake: number; worstStep: number; worstTurn: number; turnAt: string; lowest: number; lowAt: string; cruise: number};
/** An animal's flights over a span at a pinned hour, second by second. */
function flown(i: Item, hours: number, from: number, seconds: number): Flown {
    const hoursAt = () => hours;
    const cruise = airPacesOf(flightSpec(i.a.model_slug, i.animal.length, "flying_bird")!, takeoffClass(i.a.model_slug)).cruise;
    const out: Flown = {flights: 0, longest: 0, air: 0, awake: 0, worstStep: 0, worstTurn: 0, turnAt: "", lowest: Infinity, lowAt: "", cruise};
    let was: {x: number; y: number; z: number; yaw: number; aloft: boolean} | null = null;
    let run = 0;
    for (let t = 0; t < seconds; t++) {
        const trip = tripAt(world, i.profile, i.animal, from + t, hoursAt, i.a.activity);
        const at = poseOnTrip(world, trip, from + t);
        if (trip.doing !== "sleep") out.awake++;
        if (at.aloft) {
            out.air++;
            run++;
            if (!was?.aloft) out.flights++;
            out.longest = Math.max(out.longest, run);
            if (was?.aloft) {
                out.worstStep = Math.max(out.worstStep, Math.hypot(at.x - was.x, at.z - was.z));
                if (run > 3 && Math.abs(wrap(at.yaw - was.yaw)) > out.worstTurn) {
                    out.worstTurn = Math.abs(wrap(at.yaw - was.yaw));
                    out.turnAt = `${trip.doing}${trip.recipe ? ` ${trip.recipe}` : ""}, ${(from + t - trip.start).toFixed(0)} s into its slot, ${run} s into its flight`;
                }
            }
            // (Its height over the ground, the drawn rocks and the woods' crowns under it.)
            // (On a slot that is all soar: not on its way up into it or down out of it.)
            if (trip.doing === "soar" && run > 60 && trip.arrive >= trip.end - 0.5) {
                // (Its height over the ground, the drawn rocks and the woods' crowns under it.)
                const under = Math.max(world.sampler.heightAt(at.x, at.z), world.sampler.flightFloor?.(at.x, at.z) ?? 0, world.sampler.canopyTop?.(at.x, at.z) ?? 0, 0);
                if (at.y - under < out.lowest) {
                    out.lowest = at.y - under;
                    const leg = trip.legs[trip.legs.length - 1];
                    out.lowAt = `${(from + t - trip.start).toFixed(0)} s into its slot, ${leg.plan?.soar?.track ? "on its track" : leg.plan?.soar?.alt ? "on its way up" : "another leg"}, y ${at.y.toFixed(1)}, ground ${world.sampler.heightAt(at.x, at.z).toFixed(1)}, rocks ${(world.sampler.flightFloor?.(at.x, at.z) ?? 0).toFixed(1)}, crowns ${(world.sampler.canopyTop?.(at.x, at.z) ?? 0).toFixed(1)}`;
                }
            }
        } else run = 0;
        was = {x: at.x, y: at.y, z: at.z, yaw: at.yaw, aloft: at.aloft};
    }
    return out;
}

const soarers = animals.filter((i) => ["soar", "vulture", "stork"].includes(flightWay(i.a.model_slug) ?? ""));
test("B5: the fixture has thermal soarers", () => assert.ok(soarers.length >= 3, `${soarers.map((i) => i.a.model_slug)}`));

test("B5: in the warm hours a soarer soars for minutes at a time, well up, with no jump where its slots meet; at dawn it does not", () => {
    let longest = 0;
    let warmAir = 0;
    let warmAwake = 0;
    let coolLongest = 0;
    let flights = 0;
    for (const i of soarers) {
        const warm = flown(i, 12.5, DAY, 4 * 3600);
        longest = Math.max(longest, warm.longest);
        warmAir += warm.air;
        warmAwake += warm.awake;
        flights += warm.flights;
        // (A second's flight is never further than its cruise and a third; its heading never snaps mid-flight.)
        assert.ok(warm.worstStep <= warm.cruise * 1.35, `${i.a.model_slug} moves ${warm.worstStep.toFixed(1)} m in a second (cruise ${warm.cruise.toFixed(1)})`);
        assert.ok(warm.worstTurn <= 1.2, `${i.a.model_slug} turns ${warm.worstTurn.toFixed(2)} rad in a second (${warm.turnAt})`);
        // (It aims for 8 m over the ground, the rocks and the crowns; 5.7 m measured between two of its track's points.)
        if (Number.isFinite(warm.lowest)) assert.ok(warm.lowest >= 4, `${i.a.model_slug} soars ${warm.lowest.toFixed(1)} m over what is under it (${warm.lowAt})`);
        const cool = flown(i, 7.5, DAY, 2 * 3600);
        coolLongest = Math.max(coolLongest, cool.longest);
    }
    const perHour = flights / (warmAwake / 3600);
    recordMotionMetric("b5", "soarers_longest_flight_s", longest);
    recordMotionMetric("b5", "soarers_warm_air_share", warmAir / warmAwake);
    recordMotionMetric("b5", "soarers_flights_per_hour", perHour);
    recordMotionMetric("b5", "soarers_cool_longest_flight_s", coolLongest);
    // (Before: the longest flight on the real snapshot was 63 s, and a buzzard took off 61 times an hour.)
    assert.ok(longest >= 480, `longest soar ${longest} s`);
    assert.ok(warmAir / warmAwake >= 0.12, `warm share ${warmAir / warmAwake}`);
    assert.ok(perHour <= 9, `${perHour.toFixed(1)} flights an hour`);
    assert.ok(coolLongest <= 120, `a ${coolLongest} s flight at 07:30`);
});

test("B5: a soarer's speed and heading never step where its soar's legs meet (its way out and its track, slot and slot, its track and its way down)", () => {
    // (BA2, 2026-11-14. Measured as MA1 measures a take-off: its speed's change over a tenth of a second, as a share of
    // its mass's cap. On the real snapshot before: 6 times its cap at the median where its way out met its track, 2.6
    // where two slots met, 9.4 where its way down began, and its heading a quarter of a radian apart in one frame; the
    // scene showed a hitch and a snap every 80 s of every soar.)
    const hoursAt = () => 12.5;
    let worst = 0;
    let worstAt = "";
    let snap = 0;
    let snapAt = "";
    let joins = 0;
    const kinds = new Set<string>();
    for (const i of soarers) {
        const mass = flightSpec(i.a.model_slug, i.animal.length)?.massKg ?? 0;
        const cap = Math.max(...Object.values(flightAccelOf(mass)));
        const measure = (kind: string, at: number, pose: (t: number) => {x: number; z: number; yaw: number}) => {
            const pts = [];
            for (let k = -45; k <= 45; k++) pts.push(pose(at + k / 60));
            const v = pts.slice(1).map((p, k) => Math.hypot(p.x - pts[k].x, p.z - pts[k].z) * 60);
            for (let k = 3; k < v.length - 3; k++) {
                const acc = (Math.abs(v[k + 3] - v[k - 3]) * 10) / cap;
                if (acc > worst) {
                    worst = acc;
                    worstAt = `${i.a.model_slug} ${kind}`;
                }
            }
            for (let k = 40; k < 50; k++) {
                const turn = Math.abs(wrap(pts[k + 1].yaw - pts[k].yaw));
                if (turn > snap) {
                    snap = turn;
                    snapAt = `${i.a.model_slug} ${kind}`;
                }
            }
            joins++;
            kinds.add(kind);
        };
        let prev: Trip | null = null;
        for (let k = 0; k < 180; k++) {
            const trip: Trip = tripAt(world, i.profile, i.animal, DAY + k * SLOT_SECONDS + 1, hoursAt, i.a.activity);
            const soars = (leg: Trip["legs"][number] | undefined) => (leg?.mode === "air" ? leg.plan?.soar : undefined);
            // Its way out's end and its track's start, inside the slot it takes off in.
            let at = trip.start;
            for (let l = 0; l + 1 < trip.legs.length; l++) {
                at += trip.legs[l].seconds;
                if (soars(trip.legs[l])?.to && soars(trip.legs[l + 1])?.from) measure("way out to track", at, (t) => poseOnTrip(world, trip, Math.max(t, trip.start)));
            }
            // Where this slot begins up in the air.
            const before = prev;
            if (before && before.end === trip.start && soars(before.legs[before.legs.length - 1])?.to) {
                const first = trip.legs.find((leg) => leg.mode === "air");
                if (soars(first)?.from) measure(soars(first)!.to ? "slot to slot" : "track to way down", trip.start, (t) => (t < trip.start ? poseOnTrip(world, before, Math.min(t, before.end - 1e-6)) : poseOnTrip(world, trip, t)));
            }
            prev = trip;
        }
    }
    console.log(`soar hand-offs: ${joins} (${[...kinds].join(", ")}); worst ${worst.toFixed(3)} of its mass's cap (${worstAt}); a frame's heading step at most ${snap.toFixed(3)} rad (${snapAt})`);
    assert.ok(joins > 100 && kinds.size === 3, `${joins} joins: ${[...kinds]}`);
    recordMotionMetric("b5", "soar_handoff_accel_share_of_cap", worst);
    recordMotionMetric("b5", "soar_handoff_heading_step_rad", snap, "rad");
    assert.ok(worst <= 1.08, `${worst.toFixed(2)} of its cap (${worstAt})`);
    assert.ok(snap <= 0.15, `${snap.toFixed(3)} rad in a frame (${snapAt})`);
});

test("B5: a bird that sits and waits flies a few times an hour; a wader fewer", () => {
    const rate = (ways: string[], hours: number) => {
        let flights = 0;
        let awake = 0;
        for (const i of animals.filter((x) => ways.includes(flightWay(x.a.model_slug) ?? ""))) {
            const f = flown(i, hours, DAY, 3 * 3600);
            flights += f.flights;
            awake += f.awake;
        }
        return awake ? flights / (awake / 3600) : NaN;
    };
    const owl = rate(["perch"], 23);
    const heron = rate(["wader"], 9);
    recordMotionMetric("b5", "perch_flights_per_hour", owl);
    recordMotionMetric("b5", "wader_flights_per_hour", heron);
    // (Before: the barn owl 19 an hour on the validator's Ark, the grey heron 34 on the real one.)
    assert.ok(owl <= 14, `the perch hunters ${owl.toFixed(1)} an hour`);
    assert.ok(heron <= 8, `the waders ${heron.toFixed(1)} an hour`);
});
