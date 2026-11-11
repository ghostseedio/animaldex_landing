import assert from "node:assert/strict";
import test from "node:test";
import behaviours from "@/ark-scene/behaviours.json";
import {behaviourProfile} from "@/ark-scene/behaviour-profile";
import {intelProfile} from "@/ark-scene/intelligence-profile";
import {ReactiveLayer, SLEEP_HEARING, SLEEP_SIGHT, perceive, type ReactiveInput, type ReactiveOut, type ReactiveWorld, type SharedPose} from "@/ark-scene/reactive";
import {
    POSTURE_SPECS,
    SLEEP_POSTURES,
    breathRate,
    decodeSleepRow,
    getUpSeconds,
    goesIntoRoost,
    lieDownSeconds,
    packSleep,
    restStatus,
    roostOffset,
    sleepDraw,
    sleepHead,
    sleepPostureClips,
    sleepPostureFor,
    sleepSpacing,
    sleepStages,
    sleepStir,
    sleepStyle,
    stepSleep
} from "@/ark-scene/sleep";
import fixtureV2 from "@/ark-scene/fixtures/snapshot-v2.json";
import {NIGHT_WATCH_SLOTS, SLOT_SECONDS, roostOf, scheduleWorld, slotStart, tripAt, type ScheduleAnimal} from "@/ark-scene/behaviour-schedule";
import {sceneSampler} from "@/ark-scene/world-sampler";
import {placeAnimals} from "@/ark-scene/placement";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";

// MARK: The styles (stored data)

test("every species aboard has a sleep style, and every posture is one the scene draws", () => {
    const slugs = Object.keys((behaviours as {species: Record<string, string>}).species);
    assert.ok(slugs.length > 2000);
    for (const slug of slugs) {
        const style = sleepStyle(slug);
        assert.ok((SLEEP_POSTURES as readonly string[]).includes(style.posture), slug);
        for (const alt of style.alts) assert.ok((SLEEP_POSTURES as readonly string[]).includes(alt), `${slug} ${alt}`);
        assert.ok(!style.alts.includes(style.posture), `${slug}: its usual posture is not also an alternative`);
    }
    assert.deepEqual(decodeSleepRow("curl|side|pile|em|1"), {posture: "curl", alts: ["side"], social: "pile", eyes: true, mammal: true, breath: 1});
    assert.equal(sleepStyle("not-a-species").posture, "still");
});

test("postures follow the stored text, the recipes' postures and the taxon (horses stand, herons on one leg, lions sprawl, otters float)", () => {
    const expect: Array<[string, string, string?]> = [
        ["plains-zebra", "stand"],
        ["domestic-horse", "stand"],
        ["african-bush-elephant", "stand"],
        ["grey-heron", "one_leg"],
        ["greater-flamingo", "one_leg"],
        ["african-lion", "side"],
        ["red-fox", "curl"],
        ["domestic-cat", "curl"],
        ["impala", "sternal"],
        ["dromedary-camel", "sternal"],
        ["domestic-pig", "side", "pile"],
        ["sea-otter", "float_back"],
        ["egyptian-fruit-bat", "hang", "cluster"],
        ["emperor-penguin", "stand", "huddle"],
        ["european-bee-eater", "tuck", "row"],
        ["mallard", "tuck"],
        ["koi", "hover"],
        ["turbot", "bottom"],
        ["sperm-whale", "bottle"],
        ["american-alligator", "flat"]
    ];
    for (const [slug, posture, social] of expect) {
        const style = sleepStyle(slug);
        assert.equal(style.posture, posture, slug);
        if (social) assert.equal(style.social, social, `${slug} social`);
    }
    // The lion takes its other postures on some nights.
    assert.ok(sleepStyle("african-lion").alts.includes("sternal"));
});

test("eyes shut only where there are lids: mammals and birds yes; fish, snakes and insects no", () => {
    for (const slug of ["african-lion", "plains-zebra", "grey-heron", "mallard", "american-alligator"]) assert.equal(sleepStyle(slug).eyes, true, slug);
    for (const slug of ["koi", "turbot", "ball-python", "black-mamba", "honey-bee"]) assert.equal(sleepStyle(slug).eyes, false, slug);
});

// MARK: Determinism

test("the night's posture, its side and its stirs are the same for every viewer (ids and the world clock only)", () => {
    const night = Date.UTC(2026, 10, 11, 23) / 1000;
    for (const id of ["a1", "b2", "c3"]) {
        assert.deepEqual(sleepPostureFor(id, "african-lion", night), sleepPostureFor(id, "african-lion", night + 60), "the same all through the bout");
        for (const t of [night, night + 13.7, night + 400.25]) assert.deepEqual(sleepStir(id, t), sleepStir(id, t));
    }
    // A pride does not all lie the same way: over 40 lions, more than one posture and both sides.
    const picks = Array.from({length: 40}, (_, i) => sleepPostureFor(`lion-${i}`, "african-lion", night));
    assert.ok(new Set(picks.map((p) => p.posture)).size >= 2);
    assert.ok(new Set(picks.map((p) => p.side)).size === 2);
    // And a zebra stands most nights.
    const zebras = Array.from({length: 40}, (_, i) => sleepPostureFor(`zebra-${i}`, "plains-zebra", night).posture);
    assert.ok(zebras.filter((p) => p === "stand").length >= 18, zebras.join(","));
});

// MARK: Transitions (no pops)

test("lying down and getting up never jump: every stage moves a little each frame, at 60 and at 12 frames a second", () => {
    for (const fps of [60, 12]) {
        const dt = 1 / fps;
        const seconds = lieDownSeconds(1.8, true);
        let t = 0;
        let last = sleepStages(t);
        let frames = 0;
        // Down, then up half way, then down again, then all the way up startled.
        const plan: Array<[boolean, number, boolean]> = [[true, seconds + 0.5, false], [false, seconds * 0.4, false], [true, seconds, false], [false, 1, true]];
        for (const [asleep, span, startled] of plan) {
            const s = asleep ? seconds : getUpSeconds(1.8, true, startled);
            for (let k = 0; k < span * fps; k++) {
                t = stepSleep(t, asleep, dt, s);
                const now = sleepStages(t);
                const step = Math.max(...(["body", "head", "eyes", "roll"] as const).map((key) => Math.abs(now[key] - last[key])));
                // Even the startled get-up (a third of a second) is spread over frames; a smoothstep peaks at 1.5x its rate.
                const most = (dt / s) * 1.5 * 4.2;
                assert.ok(step <= most + 1e-9, `fps ${fps}: a stage moved ${step.toFixed(3)} in one frame (at most ${most.toFixed(3)})`);
                last = now;
                frames++;
            }
        }
        assert.equal(t, 0, "up again at the end");
        assert.ok(frames > 10);
    }
    // The order: the body goes down before the eyes shut; the eyes open before the body is up.
    const half = sleepStages(0.5);
    assert.ok(half.body > half.eyes && half.eyes === 0);
    const late = sleepStages(0.85);
    assert.ok(late.eyes > 0 && late.body === 1);
    // Bigger animals take longer to lie down; the startled get-up is quick.
    assert.ok(lieDownSeconds(4, true) > lieDownSeconds(0.3, true));
    assert.ok(getUpSeconds(2, true, true) < 0.5);
});

test("a stir is a gentle pulse: the head lifts and settles, the heading shifts without a jump, all continuous", () => {
    const id = "deer-7";
    let last = sleepStir(id, 5000);
    let lifts = 0;
    let shifts = 0;
    for (let t = 5000; t < 5000 + 600; t += 1 / 30) {
        const s = sleepStir(id, t);
        assert.ok(s.lift >= 0 && s.lift <= 1 && s.flick >= 0 && s.flick <= 1);
        assert.ok(Math.abs(s.shift - last.shift) < 0.02, `shift jumped at ${t.toFixed(2)}: ${last.shift} -> ${s.shift}`);
        assert.ok(Math.abs(s.lift - last.lift) < 0.05, `lift jumped at ${t.toFixed(2)}`);
        if (s.lift > 0.5 && last.lift <= 0.5) lifts++;
        if (Math.abs(s.shift - last.shift) > 1e-4) shifts++;
        last = s;
    }
    assert.ok(lifts >= 2, `lifts ${lifts}`);
    assert.ok(shifts > 0);
});

test("breathing is slower for bigger animals and none through gills", () => {
    assert.ok(breathRate(0.1, 1) > breathRate(2, 1));
    assert.ok(breathRate(2, 1) > breathRate(6, 1));
    // A lion breathes about 10-20 times a minute asleep.
    const lion = breathRate(2, 1) * 60;
    assert.ok(lion > 9 && lion < 21, `${lion}`);
    assert.equal(breathRate(0.4, 0), 0);
    assert.equal(POSTURE_SPECS.hover.breath, 0);
});

test("postures: lying ones go down and use the lying clips, standing ones barely sag, heads stay within reason", () => {
    for (const p of ["sternal", "side", "curl", "flat"] as const) assert.ok(POSTURE_SPECS[p].lying && POSTURE_SPECS[p].drop > 0, p);
    for (const p of ["stand", "one_leg"] as const) assert.ok(!POSTURE_SPECS[p].lying && POSTURE_SPECS[p].drop < 0.05, p);
    assert.ok(POSTURE_SPECS.side.roll > 1);
    assert.ok(POSTURE_SPECS.curl.curl > 0.5);
    for (const p of SLEEP_POSTURES) for (const head of [0, 1, 2] as const) for (const side of [1, -1] as const) {
        const h = sleepHead(POSTURE_SPECS[p], side, head, p);
        assert.ok(Math.abs(h.yaw) <= 1.6 && Math.abs(h.pitch) <= 0.6, `${p} ${head}`);
    }
});

// MARK: Sleeping together

test("huddles, piles, rows and clusters sleep close; a young mammal sleeps against the adult; others apart", () => {
    assert.ok(sleepSpacing("domestic-pig") < 0.6);
    assert.ok(sleepSpacing("emperor-penguin") < 0.6);
    assert.equal(sleepSpacing("plains-zebra"), 1);
    assert.ok(sleepSpacing("red-deer", true) < 0.6, "a fawn against its mother");
    assert.equal(sleepSpacing("mallard", true), 1, "a duckling is not a mammal");
    // A row along the limb: alternate sides, a body's width or so apart, along the limb's heading.
    const a = roostOffset("european-bee-eater", 1, 0.28, 0)!;
    const b = roostOffset("european-bee-eater", 2, 0.28, 0)!;
    assert.ok(Math.sign(a.dx) !== Math.sign(b.dx));
    assert.ok(Math.abs(a.dx) > 0.08 && Math.abs(a.dx) < 0.2 && Math.abs(a.dz) < 1e-9);
    assert.equal(roostOffset("plains-zebra", 1, 2, 0), null);
    assert.ok(goesIntoRoost("burrow:ground:96", "den") && goesIntoRoost("cave_mouth:12", "cave") && !goesIntoRoost("limb:oak-a:3", "den") && !goesIntoRoost("burrow:ground:96", "tree"));
    const c = roostOffset("egyptian-fruit-bat", 3, 0.16, 0)!;
    assert.ok(Math.hypot(c.dx, c.dz) < 0.2);
});

// MARK: The tap card

test("what the tap card says: plain words for where and how it rests", () => {
    assert.equal(restStatus({asleep: true, enclosed: true, roost: "den"}), "asleep_den");
    assert.equal(restStatus({asleep: true, enclosed: true, roost: "burrow"}), "asleep_burrow");
    assert.equal(restStatus({asleep: true, posture: "stand"}), "asleep_standing");
    assert.equal(restStatus({asleep: true, posture: "one_leg"}), "asleep_one_leg");
    assert.equal(restStatus({asleep: true, posture: "hang"}), "asleep_hanging");
    assert.equal(restStatus({asleep: true, posture: "float_back"}), "asleep_water");
    assert.equal(restStatus({asleep: true, posture: "side", social: "pile"}), "asleep_huddle");
    assert.equal(restStatus({asleep: true, posture: "tuck", raised: true}), "asleep_perch");
    assert.equal(restStatus({asleep: true, posture: "sternal"}), "asleep");
    assert.equal(restStatus({asleep: false, doing: "watch"}), "on_watch");
    assert.equal(restStatus({asleep: false, doing: "rest", sunny: true}), "dozing_sun");
    assert.equal(restStatus({asleep: false, doing: "rest", sunny: false}), "resting");
    assert.equal(restStatus({asleep: false, doing: "rest", enclosed: true}), "resting_den");
    assert.equal(restStatus({asleep: false, doing: "bask"}), "basking");
    assert.equal(restStatus({asleep: false, doing: "graze"}), null);
});

// MARK: The rig's clips (the rigging lane's v6 names, contract 8.2)

test("each posture asks the rig for its own v6 sleep clip first, then its kind's plain sleep", () => {
    const CONTRACT = new Set(["sleep", "sleep_side", "sleep_curl", "sleep_stand", "sleep_one_leg", "sleep_tuck", "sleep_float", "sleep_hang", "bask"]);
    for (const posture of SLEEP_POSTURES) for (const name of sleepPostureClips(posture)) assert.ok(CONTRACT.has(name), `${posture}: ${name}`);
    assert.deepEqual(sleepPostureClips("side"), ["sleep_side", "sleep"]);
    assert.deepEqual(sleepPostureClips("stand"), ["sleep_stand"]);
    assert.deepEqual(sleepPostureClips("one_leg")[0], "sleep_one_leg");
    assert.deepEqual(sleepPostureClips("hover"), []);
    // With a clip drawing it, the procedural body, head and breath give way (the eyes stay: the clips have no lids).
    const now = {t: 1, posture: "side" as const, side: 1 as const, head: 0 as const, spec: POSTURE_SPECS.side, down: true, startled: false};
    const own = sleepDraw(now, {id: "x", slug: "african-lion", length: 2, epoch: 1000, procedural: 1, reduced: true});
    const clipped = sleepDraw(now, {id: "x", slug: "african-lion", length: 2, epoch: 1000, procedural: 0, reduced: true});
    assert.ok(own.legs > 0 && own.breath > 0 && own.headWeight > 0);
    assert.equal(clipped.legs, 0);
    assert.equal(clipped.headWeight, 0);
    assert.equal(clipped.breath, 0);
    assert.equal(clipped.eyes, own.eyes);
});

// MARK: Waking (the reactive layer)

function animal(id: string, slug: string, x: number, z: number, extra: Omit<Partial<ReactiveInput>, "shared"> & {shared?: Partial<SharedPose>} = {}): ReactiveInput {
    const b = behaviourProfile(slug);
    const length = extra.length ?? Math.min(Math.max(0.35 * Math.cbrt(Math.max(b.size ?? 20, 1)) ** 1.4, 0.2), 3);
    const {shared, ...rest} = extra;
    return {id, slug, plan: intelProfile(slug).plan, length, size: b.size, speed: b.speed, dominance: b.dominance, social: b.social, diet: b.diet, intel: intelProfile(slug), asleep: false, acting: false, ...rest, shared: {x, y: 0, z, yaw: 0, moving: false, aloft: false, doing: "rest", ...(shared ?? {})}};
}
function world(now: number, extra: Partial<ReactiveWorld> = {}): ReactiveWorld {
    return {now, dt: 1 / 30, hours: 2, night: 0, weather: {rain: 0, wind: 0.2, windDirection: 0, fog: 0, storm: 0}, camera: {x: 0, y: 2, z: -40}, ...extra};
}
type Frame = {t: number; out: Map<string, ReactiveOut>};
function run(layer: ReactiveLayer, inputs: ReactiveInput[], seconds: number, opts: {move?: (t: number) => void; world?: (t: number) => Partial<ReactiveWorld>} = {}): Frame[] {
    const frames: Frame[] = [];
    for (let k = 0; k < seconds * 30; k++) {
        const t = 1000 + k / 30;
        opts.move?.(t);
        frames.push({t, out: layer.step(inputs, world(t, opts.world?.(t)))});
    }
    return frames;
}

test("asleep it perceives less: its eyes shut and its hearing dulled, its nose as awake", () => {
    const deer = animal("deer", "red-deer", 0, 0);
    const wolf = animal("wolf", "eurasian-wolf", 9, 0, {shared: {moving: false, doing: "rest"}});
    const w = world(1000);
    assert.equal(perceive(deer, wolf, w, 1, 0), "sight", "awake, it sees the wolf lying 9 m off");
    const dozing = {...deer, intel: {...deer.intel, sight: Math.min(deer.intel.sight * SLEEP_SIGHT, deer.length * 4), hearing: deer.intel.hearing * SLEEP_HEARING}};
    assert.equal(perceive(dozing, wolf, w, 1, 0), null, "asleep, downwind, it doesn't");
    // Upwind (the wind blows from the wolf to it): it smells it, asleep as awake.
    const upwind = {...wolf, shared: {...wolf.shared, x: -9}};
    assert.equal(perceive(dozing, upwind, w, 1, 0), "smell");
});

test("a sleeper stays asleep with a still wolf downwind, wakes with a start when it is upwind or comes close, then gets up and runs", () => {
    // Downwind and still, 8 m off: it sleeps on (awake, it would have seen it).
    {
        const layer = new ReactiveLayer({tier: "high"});
        const deer = animal("deer", "red-deer", 0, 0, {asleep: true, shared: {doing: "sleep"}});
        const wolf = animal("wolf", "eurasian-wolf", 8, 0, {shared: {doing: "rest"}});
        const frames = run(layer, [deer, wolf], 6);
        assert.ok(frames.every((f) => f.out.get("deer")?.action === "asleep" && !f.out.get("deer")?.woke));
    }
    // The wolf walks up to it from downwind: it wakes before the wolf is on it, startled, then flees.
    {
        const layer = new ReactiveLayer({tier: "high"});
        const deer = animal("deer", "red-deer", 0, 0, {asleep: true, shared: {doing: "sleep"}});
        const wolf = animal("wolf", "eurasian-wolf", 30, 0, {shared: {doing: "stalk", moving: true}});
        let wokeAt: number | null = null;
        let wolfAtWake = 0;
        const frames = run(layer, [deer, wolf], 14, {
            move: (t) => {
                wolf.shared.x = Math.max(30 - (t - 1000) * 2.2, 3);
            }
        });
        let startled = false;
        let fled = false;
        for (const f of frames) {
            const o = f.out.get("deer")!;
            if (o.woke && wokeAt === null) {
                wokeAt = f.t;
                wolfAtWake = 30 - (f.t - 1000) * 2.2;
            }
            if (o.startled) startled = true;
            if (o.woke && o.action === "flee") fled = true;
        }
        assert.ok(wokeAt !== null, "it woke");
        assert.ok(wolfAtWake > 3 && wolfAtWake < 14, `woke with the wolf ${wolfAtWake.toFixed(1)} m off`);
        assert.ok(startled, "with a start");
        assert.ok(fled, "and ran");
    }
});

test("an alarm call wakes the herd; the one keeping watch sees the lion first", () => {
    const layer = new ReactiveLayer({tier: "high"});
    // The watch (awake, the shared layer's night watch), and two asleep beside it; a lion walks in from 40 m.
    const watch = animal("z-watch", "plains-zebra", 0, 0, {shared: {doing: "watch"}});
    const a = animal("z-a", "plains-zebra", -3, 1, {asleep: true, shared: {doing: "sleep"}});
    const b = animal("z-b", "plains-zebra", -4, -2, {asleep: true, shared: {doing: "sleep"}});
    const lion = animal("lion", "african-lion", 40, 0, {shared: {doing: "stalk", moving: true}});
    let calledAt: number | null = null;
    const wokeAt = new Map<string, number>();
    const frames = run(layer, [watch, a, b, lion], 12, {move: (t) => (lion.shared.x = Math.max(40 - (t - 1000) * 1.6, 22))});
    for (const f of frames) {
        if (f.out.get("z-watch")?.called && calledAt === null) calledAt = f.t;
        for (const id of ["z-a", "z-b"]) if (f.out.get(id)?.woke && !wokeAt.has(id)) wokeAt.set(id, f.t);
    }
    assert.ok(calledAt !== null, "the watch called");
    // The lion stopped 22 m off (outside the sleepers' waking reach): only the call woke them, after it.
    for (const id of ["z-a", "z-b"]) {
        assert.ok(wokeAt.has(id), `${id} woke`);
        assert.ok(wokeAt.get(id)! >= calledAt!, `${id} woke after the call`);
    }
});

test("a still camera never wakes a sleeper; one coming at it close may, by its species (a deer before a lion)", () => {
    for (const [slug, wakes] of [["red-deer", true], ["african-lion", false]] as const) {
        // Still, 4 m off.
        const still = new ReactiveLayer({tier: "high"});
        const s = animal("s", slug, 0, 0, {asleep: true, shared: {doing: "sleep"}});
        const quiet = run(still, [s], 8, {world: () => ({camera: {x: 0, y: 2, z: -4}})});
        assert.ok(quiet.every((f) => !f.out.get("s")?.woke), `${slug}: a still camera`);
        // Walking at it from 14 m to 3 m.
        const walking = new ReactiveLayer({tier: "high"});
        const m = animal("m", slug, 0, 0, {asleep: true, shared: {doing: "sleep"}});
        const coming = run(walking, [m], 8, {world: (t) => ({camera: {x: 0, y: 2, z: -Math.max(14 - (t - 1000) * 1.5, 3)}})});
        assert.equal(coming.some((f) => f.out.get("m")?.woke), wakes, `${slug}: a camera coming at it`);
    }
});

test("waking is deterministic: the same frames give the same wake, the same start, the same run", () => {
    const once = () => {
        const layer = new ReactiveLayer({tier: "medium"});
        const deer = animal("deer", "red-deer", 0, 0, {asleep: true, shared: {doing: "sleep"}});
        const deer2 = animal("deer2", "red-deer", 2, 3, {asleep: true, shared: {doing: "sleep"}});
        const wolf = animal("wolf", "eurasian-wolf", 25, 2, {shared: {doing: "stalk", moving: true}});
        return run(layer, [deer, deer2, wolf], 10, {move: (t) => (wolf.shared.x = 25 - (t - 1000) * 2)}).map((f) => JSON.stringify(Array.from(f.out.entries())));
    };
    assert.deepEqual(once(), once());
});

test("woken and calm again, it goes back to sleep", () => {
    const layer = new ReactiveLayer({tier: "high"});
    const deer = animal("deer", "red-deer", 0, 0, {asleep: true, shared: {doing: "sleep"}});
    // A camera walks at it, then goes away and stays away.
    const frames = run(layer, [deer], 90, {world: (t) => ({camera: t < 1007 ? {x: 0, y: 2, z: -Math.max(14 - (t - 1000) * 1.6, 3)} : {x: 0, y: 2, z: -60}})});
    assert.ok(frames.some((f) => f.out.get("deer")?.woke), "it woke");
    const last = frames[frames.length - 1].out.get("deer")!;
    assert.equal(last.woke, false);
    assert.equal(last.action, "asleep");
});

test("the sleep packs into one float exactly and unpacks as the shader does (awake is all zeros)", () => {
    // The shader's arkSleepOf, in numbers.
    const unpack = (packed: number) => {
        if (packed < 0.5) return [0, 0, 0, 0];
        let p = Math.floor(packed + 0.5);
        const eyes = Math.floor(p / 262144);
        p -= eyes * 262144;
        const curl = Math.floor(p / 4096);
        p -= curl * 4096;
        const flick = Math.floor(p / 64);
        const breath = p - flick * 64;
        return [eyes / 63, (curl - 31) / 25, flick / 63, breath / 50];
    };
    for (const [e, c, f, b] of [[0, 0, 0, 0], [1, 1.05, 0, 0.28], [0.4, -1.05, 1, 0.9], [1, -1.2, 0.5, 0.09]]) {
        const packed = packSleep(e, c, f, b);
        assert.ok(Number.isInteger(packed) && packed < 2 ** 24);
        assert.equal(Math.fround(packed), packed, "a float holds it exactly");
        const [ue, uc, uf, ub] = unpack(Math.fround(packed));
        assert.ok(Math.abs(ue - e) <= 0.5 / 63 + 1e-9 && Math.abs(uc - c) <= 0.5 / 25 + 1e-9 && Math.abs(uf - f) <= 0.5 / 63 + 1e-9 && Math.abs(ub - b) <= 0.5 / 50 + 1e-9, `${[e, c, f, b]} -> ${[ue, uc, uf, ub]}`);
    }
    assert.deepEqual(unpack(packSleep(0, 0, 0, 0)), [0, 0, 0, 0]);
    assert.deepEqual(unpack(0), [0, 0, 0, 0]);
});

test("the camera never wakes the animal the viewer is looking at, nor with a cut", () => {
    // Watched (selected or followed): the camera flies in to it and it sleeps on.
    const layer = new ReactiveLayer({tier: "high"});
    const deer = animal("deer", "red-deer", 0, 0, {asleep: true, watched: true, shared: {doing: "sleep"}});
    const frames = run(layer, [deer], 8, {world: (t) => ({camera: {x: 0, y: 2, z: -Math.max(14 - (t - 1000) * 1.5, 3)}})});
    assert.ok(frames.every((f) => !f.out.get("deer")?.woke));
    // A cut: the camera jumps from 40 m to 3 m in one frame (a shot change, a tap's flight), then stays.
    const cut = new ReactiveLayer({tier: "high"});
    const other = animal("deer2", "red-deer", 0, 0, {asleep: true, shared: {doing: "sleep"}});
    const after = run(cut, [other], 6, {world: (t) => ({camera: {x: 0, y: 2, z: t < 1001 ? -40 : -3}})});
    assert.ok(after.every((f) => !f.out.get("deer2")?.woke));
});

// MARK: The schedule: the night watch and sleeping together


const schedWorld = scheduleWorld(sceneSampler());
const fixturePlaces = placeAnimals(decodeArkSnapshot(fixtureV2)!.animals);
const grassHome = (() => {
    const a = fixtureV2.animals.find((x) => x.zone === "grassland")!;
    const p = fixturePlaces.get(a.id)!;
    return {x: p.x, y: p.ground, z: p.z};
})();
function herd(slug: string, n: number, length: number, young: number[] = []): ScheduleAnimal[] {
    const profile = behaviourProfile(slug);
    const leader: ScheduleAnimal = {id: `${slug}-lead`, zone: "grassland", home: {...grassHome}, length, sea: false};
    const list = [leader];
    for (let r = 1; r < n; r++) list.push({id: `${slug}-${r}`, zone: "grassland", home: {...grassHome}, sea: false, length: young.includes(r) ? length * 0.5 : length, young: young.includes(r), group: {leader, profile, activity: "diurnal", rank: r, size: n}});
    return list;
}

test("a herd keeps one of its members on watch all night, a few slots each, the guard changing now and then", () => {
    const profile = behaviourProfile("grevys-zebra");
    const zebras = herd("grevys-zebra", 6, 2.4);
    const night = Date.UTC(2026, 10, 12, 0, 0) / 1000;
    const hoursAt = () => 1.5;
    let changes = 0;
    let last: string | null = null;
    const runs: number[] = [];
    let run = 0;
    for (let k = 1; k < 40; k++) {
        const watching = zebras.filter((z) => tripAt(schedWorld, profile, z, slotStart(z, Math.floor(night / SLOT_SECONDS) + k) + 1, hoursAt, "diurnal").doing === "watch");
        assert.equal(watching.length, 1, `slot ${k}: ${watching.length} on watch`);
        assert.ok(watching[0].group, "never the leader's turn with nobody up");
        if (last !== null && watching[0].id !== last) {
            changes++;
            runs.push(run);
            run = 0;
        }
        run++;
        last = watching[0].id;
    }
    assert.ok(changes >= 4, `${changes} changes of the guard`);
    assert.ok(runs.every((r) => r <= NIGHT_WATCH_SLOTS + 1), `watches ${runs.join(",")} slots`);
});

test("piled pigs and a young mammal sleep touching; a zebra herd sleeps a little apart", () => {
    const spread = (slug: string, young: number[] = []) => {
        const profile = behaviourProfile(slug);
        const list = herd(slug, 6, 1.4, young);
        const lead = roostOf(schedWorld, profile, list[0]);
        return list.slice(1).map((a) => ({young: Boolean(a.young), d: Math.hypot(roostOf(schedWorld, profile, a).x - lead.x, roostOf(schedWorld, profile, a).z - lead.z) / 1.4}));
    };
    const pigs = spread("domestic-pig");
    const zebras = spread("grevys-zebra");
    const mean = (l: Array<{d: number}>) => l.reduce((s, x) => s + x.d, 0) / l.length;
    assert.ok(mean(pigs) < mean(zebras) * 0.7, `pigs ${mean(pigs).toFixed(2)} vs zebras ${mean(zebras).toFixed(2)} body lengths`);
    // A foal sleeps against the adult its group keeps to.
    const foal = spread("grevys-zebra", [3]).find((x) => x.young)!;
    assert.ok(foal.d < 0.8, `foal ${foal.d.toFixed(2)} body lengths from the adult`);
});

test("the tap card's rest words: every status has words, in every Ark language", async () => {
    const {ARK_REST_KEYS, arkRestWords, arkRestIsSleep} = await import("@/lib/ark-rest-words");
    const {ARK_LANGUAGES} = await import("@/lib/ark-languages");
    const {readFileSync} = await import("node:fs");
    const statuses = ["asleep", "asleep_den", "asleep_burrow", "asleep_perch", "asleep_hanging", "asleep_standing", "asleep_one_leg", "asleep_water", "asleep_huddle", "resting", "resting_den", "dozing_sun", "basking", "on_watch"];
    assert.deepEqual(Object.keys(ARK_REST_KEYS).sort(), [...statuses].sort());
    for (const lang of ARK_LANGUAGES) {
        const file = lang === "en" || lang === "id" ? `src/data/locales/${lang}.json` : `src/data/locales/ark/${lang}.json`;
        const words = JSON.parse(readFileSync(file, "utf8")).ark.life.rest;
        for (const status of statuses) {
            const said = arkRestWords(status, words);
            assert.ok(said && said.trim().length > 1, `${lang} ${status}`);
        }
        assert.equal(new Set(statuses.map((s) => arkRestWords(s, words))).size, statuses.length, `${lang}: each status its own words`);
    }
    assert.equal(arkRestWords(null, {asleep: "Asleep"}), null);
    assert.equal(arkRestWords("asleep_den", null), null);
    assert.ok(arkRestIsSleep("asleep_den") && !arkRestIsSleep("on_watch") && !arkRestIsSleep(null));
});
