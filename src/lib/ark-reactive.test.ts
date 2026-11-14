import assert from "node:assert/strict";
import test from "node:test";
import {behaviourProfile} from "@/ark-scene/behaviour-profile";
import {bodyMass, canEat, canTake, foodLinked, hasIntelProfile, huntCompany, huntsByBuild, intelProfile} from "@/ark-scene/intelligence-profile";
import {HEAD_LIMITS, clampLook, headLimits, lookAngles, stepHead} from "@/ark-scene/head-look";
import {displayLength} from "@/ark-scene/sizes";
import {ReactiveLayer, fleeSpeed, menaceOf, minGap, offsetShare, perceive, reactiveEnvelope, threatScale, type ReactiveInput, type ReactiveOut, type ReactiveWorld, type SharedPose} from "@/ark-scene/reactive";

// MARK: Helpers

function animal(id: string, slug: string, x: number, z: number, extra: Omit<Partial<ReactiveInput>, "shared"> & {shared?: Partial<SharedPose>} = {}): ReactiveInput {
    const b = behaviourProfile(slug);
    // (Its true drawn length, as the scene passes it: who can take whom goes by body size, `canTake`.)
    const length = extra.length ?? displayLength(slug, extra.plan ?? intelProfile(slug).plan);
    const {shared, ...rest} = extra;
    return {
        id,
        slug,
        plan: extra.plan ?? intelProfile(slug).plan,
        length,
        size: b.size,
        speed: b.speed,
        dominance: b.dominance,
        social: b.social,
        diet: b.diet,
        intel: intelProfile(slug),
        asleep: false,
        acting: false,
        ...rest,
        shared: {x, y: 0, z, yaw: 0, moving: false, aloft: false, doing: "forage", ...(shared ?? {})}
    };
}

function world(now: number, extra: Partial<ReactiveWorld> = {}): ReactiveWorld {
    return {now, dt: 1 / 30, hours: 10, night: 0, weather: {rain: 0, wind: 0.2, windDirection: 0, fog: 0, storm: 0}, camera: {x: 0, y: 2, z: -20}, ...extra};
}

type Frame = {t: number; out: Map<string, ReactiveOut>; inputs: ReactiveInput[]};
/** Runs the layer for `seconds` at 30 fps; `move` updates the shared poses each frame (the shared layer). */
function run(layer: ReactiveLayer, inputs: ReactiveInput[], seconds: number, opts: {start?: number; move?: (inputs: ReactiveInput[], t: number) => void; world?: (t: number) => Partial<ReactiveWorld>} = {}): Frame[] {
    const frames: Frame[] = [];
    const start = opts.start ?? 1000;
    for (let k = 0; k < seconds * 30; k++) {
        const t = start + k / 30;
        opts.move?.(inputs, t);
        const out = layer.step(inputs, world(t, opts.world?.(t)));
        frames.push({t, out, inputs: inputs.map((i) => ({...i, shared: {...i.shared}}))});
    }
    return frames;
}
const drawn = (i: ReactiveInput, o: ReactiveOut | undefined) => ({x: i.shared.x + (o?.dx ?? 0), z: i.shared.z + (o?.dz ?? 0)});

// MARK: Profiles

test("the profiles cover the Ark and the food links say who eats whom", () => {
    for (const slug of ["red-deer", "eurasian-wolf", "meerkat", "red-squirrel", "chimpanzee", "bateleur"]) assert.ok(hasIntelProfile(slug), slug);
    assert.ok(canEat(intelProfile("eurasian-wolf"), intelProfile("red-deer"), 46, 58), "a wolf can eat a red deer (named in its diet)");
    assert.ok(!canEat(intelProfile("red-deer"), intelProfile("eurasian-wolf"), 58, 46), "a deer eats no wolf");
    assert.ok(intelProfile("meerkat").sentinel, "meerkats keep a sentinel (stored text)");
    assert.ok(intelProfile("chimpanzee").tools, "chimpanzees use tools (stored text)");
    assert.ok(!intelProfile("red-deer").tools, "no tool use without stored text");
    assert.ok(intelProfile("red-squirrel").forage.includes("cache"), "red squirrels cache (stored text)");
    const unknown = intelProfile("not-a-species", "flying_bird", 50);
    assert.ok(unknown.fallback && unknown.defence.includes("fly_off"));
});

// MARK: Heads

test("heads turn within their body plan's limits, and never further", () => {
    for (const [plan, limits] of Object.entries(HEAD_LIMITS)) {
        for (let a = -Math.PI; a <= Math.PI; a += 0.1) {
            const look = clampLook({yaw: a, pitch: a / 2}, limits);
            assert.ok(Math.abs(look.yaw) <= limits.yaw + 1e-9, plan);
            assert.ok(look.pitch <= limits.up + 1e-9 && look.pitch >= -limits.down - 1e-9, plan);
            let head = {yaw: 0, pitch: 0};
            for (let k = 0; k < 60; k++) head = stepHead(head, {yaw: a, pitch: a}, 1 / 30, limits);
            assert.ok(Math.abs(head.yaw) <= limits.yaw + 1e-9 && head.pitch <= limits.up + 1e-9 && head.pitch >= -limits.down - 1e-9, plan);
        }
    }
    assert.equal(headLimits("fish").yaw < 0.2, true, "a fish barely turns its head");
    assert.ok(headLimits("flying_bird", "barn-owl").yaw > headLimits("flying_bird", "house-sparrow").yaw, "an owl turns further");
    // Facing +z, a point to the right (+x) is a positive yaw.
    assert.ok(lookAngles({x: 0, y: 1, z: 0}, 0, {x: 5, y: 1, z: 0}).yaw > 1.5);
});

test("a head turns at its own rate: no snap", () => {
    const limits = headLimits("quadruped");
    const next = stepHead({yaw: 0, pitch: 0}, {yaw: 1, pitch: 0}, 1 / 30, limits);
    assert.ok(next.yaw > 0 && next.yaw <= limits.rate / 30 + 1e-9);
});

// MARK: Perception

test("perception: sight in the open, not through a hill; hearing a moving animal; night shortens a day animal's sight", () => {
    const deer = animal("deer", "red-deer", 0, 0);
    const wolfStill = animal("wolf", "eurasian-wolf", 0, 18, {shared: {moving: false}});
    assert.equal(perceive(deer, wolfStill, world(0)), "sight");
    assert.equal(perceive(deer, wolfStill, world(0, {sight: () => 0})), null, "a still wolf behind a ridge is neither seen nor heard");
    const wolfMoving = animal("wolf", "eurasian-wolf", 0, 18, {shared: {moving: true}});
    assert.equal(perceive(deer, wolfMoving, world(0, {sight: () => 0})), "hearing", "a moving wolf is heard");
    const chimp = animal("chimp", "chimpanzee", 0, 0);
    const far = animal("wolf", "eurasian-wolf", 0, 30, {shared: {moving: false}});
    assert.equal(perceive(chimp, far, world(0)), "sight");
    assert.equal(perceive(chimp, far, world(0, {night: 1})), null, "at night a day animal does not see as far");
});

// MARK: How alarming a threat is, how fast it runs, and armour

test("a bigger predator, and one coming at it, sets it off sooner; a still one later; a tortoise runs slower than a deer", () => {
    const deer = animal("deer", "red-deer", 0, 0);
    const coming = animal("wolf", "eurasian-wolf", 0, 12, {shared: {moving: true, yaw: Math.PI}});
    const passing = animal("wolf", "eurasian-wolf", 0, 12, {shared: {moving: true, yaw: Math.PI / 2}});
    const still = animal("wolf", "eurasian-wolf", 0, 12, {shared: {moving: false}});
    assert.ok(threatScale(deer, coming) > threatScale(deer, passing), "coming at it");
    assert.ok(threatScale(deer, passing) > threatScale(deer, still), "moving rather than still");
    const big = animal("lion", "african-lion", 0, 12, {length: 4, shared: {moving: true, yaw: Math.PI / 2}});
    assert.ok(threatScale(deer, big) > threatScale(deer, passing), "bigger");
    // (A still predator smaller than it: 0.75 for its size times 0.6 for lying up; a big one coming: 1.5 times 1.3.)
    for (const t of [coming, passing, still, big]) assert.ok(threatScale(deer, t) >= 0.45 && threatScale(deer, t) <= 1.95);
    const creeping = animal("wolf", "eurasian-wolf", 0, 12, {shared: {moving: true, doing: "stalk", yaw: Math.PI}});
    const chasing = {...animal("wolf", "eurasian-wolf", 0, 12, {shared: {moving: true, yaw: Math.PI / 2}}), chasing: true};
    assert.equal(menaceOf(deer, still), "resting");
    assert.equal(menaceOf(deer, passing), "passing");
    assert.equal(menaceOf(deer, coming), "coming");
    assert.equal(menaceOf(deer, creeping), "stalking");
    assert.equal(menaceOf(deer, chasing), "chasing");
    assert.ok(threatScale(deer, chasing) > threatScale(deer, creeping) && threatScale(deer, creeping) > threatScale(deer, coming), "a chase, then a stalk, then a walk at it");
    const tortoise = animal("t", "leopard-tortoise", 0, 0, {length: 1.2});
    const deer12 = animal("d", "red-deer", 0, 0, {length: 1.2});
    assert.ok(fleeSpeed(tortoise) < fleeSpeed(deer12) * 0.6, `tortoise ${fleeSpeed(tortoise).toFixed(1)} vs deer ${fleeSpeed(deer12).toFixed(1)} m/s`);
    assert.ok(fleeSpeed(animal("e", "african-bush-elephant", 0, 0, {length: 3.5})) <= 8);
});

test("an armoured animal pulls in and stays put; a sessile one is never moved", () => {
    const layer = new ReactiveLayer({tier: "high"});
    const tortoise = animal("t", "leopard-tortoise", 0, 0, {shared: {doing: "graze"}});
    const croc = animal("croc", "american-alligator", -12, 1.2, {shared: {doing: "wander", moving: true, yaw: Math.PI / 2}});
    const frames = run(layer, [tortoise, croc], 10, {move: (list, t) => {
        list.find((i) => i.id === "croc")!.shared.x = -12 + (t - 1000) * 1.5;
    }});
    const actions = new Set(frames.map((f) => f.out.get("t")!.action));
    assert.ok(actions.has("withdraw"), `it withdraws (${Array.from(actions).join(", ")})`);
    assert.ok(!actions.has("flee"), "it does not run");
    const pulled = frames.filter((f) => f.out.get("t")!.action === "withdraw");
    assert.ok(pulled.every((f) => Math.hypot(f.out.get("t")!.dx, f.out.get("t")!.dz) < 0.3), "it stays where it is");
    assert.ok(pulled[pulled.length - 1].out.get("t")!.crouch > 0.6, "pulled in low");
    const barnacle = {...animal("b", "acorn-barnacle", 0, 0), sessile: true};
    assert.equal(reactiveEnvelope(barnacle, true), 0, "a sessile animal has no envelope");
});

// MARK: Scenario 1: a predator passes a herd

test("a predator passes a herd: the first to notice calls, the alarm runs through the herd, and they run to the herd and away", () => {
    const layer = new ReactiveLayer({tier: "high"});
    const herd = Array.from({length: 7}, (_, i) => animal(`deer${i}`, "red-deer", (i % 4) * 2.2, Math.floor(i / 4) * 2.4, {shared: {doing: "graze", yaw: (i * 0.9) % 6}}));
    const wolf = animal("wolf", "eurasian-wolf", -35, 4, {shared: {moving: true, doing: "wander", yaw: Math.PI / 2}});
    const inputs = [...herd, wolf];
    const frames = run(layer, inputs, 14, {move: (list, t) => {
        const w = list.find((i) => i.id === "wolf")!;
        w.shared.x = -35 + (t - 1000) * 3.2;
    }});
    const calls = frames.flatMap((f) => Array.from(f.out.entries()).filter(([, o]) => o.called).map(([id]) => ({id, t: f.t})));
    assert.ok(calls.length >= 1, "someone calls the alarm");
    const reactedAt = new Map<string, number>();
    for (const f of frames) for (const d of herd) {
        const o = f.out.get(d.id);
        if (o && (o.action === "flee" || o.action === "alert" || o.action === "freeze") && !reactedAt.has(d.id)) reactedAt.set(d.id, f.t);
    }
    assert.equal(reactedAt.size, herd.length, "every deer reacts");
    const times = Array.from(reactedAt.values()).sort();
    assert.ok(times[times.length - 1] - times[0] > 0.05, "the reaction spreads (not all on one frame)");
    const fled = herd.filter((d) => frames.some((f) => f.out.get(d.id)?.action === "flee"));
    assert.ok(fled.length >= 5, `most of the herd runs (${fled.length})`);
    // Running away: over its first dash (from where it stood when it set off: it had closed up with the herd while it
    // watched), it goes away from the wolf.
    for (const d of fled) {
        const from = frames.findIndex((fr) => fr.out.get(d.id)?.action === "flee");
        let to = from;
        while (to + 1 < frames.length && frames[to + 1].out.get(d.id)?.action === "flee") to++;
        const a = frames[Math.max(from - 1, 0)].out.get(d.id)!;
        const b = frames[to].out.get(d.id)!;
        if (Math.hypot(b.dx - a.dx, b.dz - a.dz) < 0.8) continue;
        const w = frames[from].inputs.find((i) => i.id === "wolf")!;
        const away = (d.shared.x + a.dx - w.shared.x) * (b.dx - a.dx) + (d.shared.z + a.dz - w.shared.z) * (b.dz - a.dz);
        assert.ok(away > 0, `${d.id} runs away from the wolf`);
    }
    // They closed up while they watched it come: the herd is tighter as the first one runs than it was grazing.
    const spread = (f: Frame) => {
        const pts = herd.map((d) => drawn(d, f.out.get(d.id)));
        const cx = pts.reduce((sum, q) => sum + q.x, 0) / pts.length;
        const cz = pts.reduce((sum, q) => sum + q.z, 0) / pts.length;
        return pts.reduce((sum, q) => sum + Math.hypot(q.x - cx, q.z - cz), 0) / pts.length;
    };
    const firstRun = frames.findIndex((f) => herd.some((d) => f.out.get(d.id)?.action === "flee"));
    assert.ok(spread(frames[firstRun - 1]) < spread(frames[0]) * 0.9, `the herd closes up (${spread(frames[0]).toFixed(2)} -> ${spread(frames[firstRun - 1]).toFixed(2)} m)`);
    // Nobody calls again and again at the same wolf: a call each time it takes a fresh look, not one every 8 s.
    assert.ok(calls.length <= herd.length * 2, `calls (${calls.length})`);
    // Heads up and toward the wolf when alert.
    const alert = frames.flatMap((f) => Array.from(f.out.entries()).filter(([id, o]) => id !== "wolf" && o.looking === "wolf"));
    assert.ok(alert.length > 0, "they look at the wolf");
});

test("after running, it holds its ground while the predator is still in view (it never walks back toward it), and looks where it runs", () => {
    const layer = new ReactiveLayer({tier: "high"});
    const deer = animal("deer", "red-deer", 0, 0, {shared: {doing: "graze"}});
    const wolf = animal("wolf", "eurasian-wolf", -6, 0, {shared: {doing: "wander", moving: true, yaw: Math.PI / 2}});
    // The wolf comes close, then backs off to 16 m and stands there, watching.
    const frames = run(layer, [deer, wolf], 16, {move: (list, t) => {
        const w = list.find((i) => i.id === "wolf")!;
        const k = t - 1000;
        w.shared.x = k < 3 ? -6 : -6 - Math.min((k - 3) * 2, 10);
        w.shared.moving = k >= 3 && k < 8;
    }});
    const fled = frames.findIndex((f) => f.out.get("deer")!.action === "flee");
    assert.ok(fled >= 0, "it runs");
    const runningAhead = frames.slice(fled).filter((f) => f.out.get("deer")!.action === "flee" && f.out.get("deer")!.looking === "ahead").length;
    assert.ok(runningAhead > 0, "running, it looks where it runs");
    let peak = 0;
    for (const f of frames.slice(fled)) {
        const o = f.out.get("deer")!;
        const off = Math.hypot(o.dx, o.dz);
        peak = Math.max(peak, off);
        // Toward the wolf (at -x) is a smaller dx; while it is still reacting it never gives back more than a step.
        if (o.action === "alert" || o.action === "flee") assert.ok(off >= peak - 0.5, `holds its ground (${off.toFixed(2)} of ${peak.toFixed(2)} m, ${o.action})`);
    }
});

test("an alarm about a lion far off puts the herd on alert, heads up and on it; nobody runs until it comes near", () => {
    const layer = new ReactiveLayer({tier: "high"});
    const herd = Array.from({length: 5}, (_, i) => animal(`z${i}`, "plains-zebra", (i % 3) * 2.4, Math.floor(i / 3) * 2.4, {shared: {doing: "graze", yaw: i * 1.3}}));
    const lion = animal("lion", "african-lion", -30, 30, {shared: {doing: "wander", moving: true, yaw: Math.PI / 2}});
    // It walks across 30 m off for 12 s.
    const far = run(layer, [...herd, lion], 12, {move: (list, t) => {
        list.find((i) => i.id === "lion")!.shared.x = -30 + (t - 1000) * 3;
    }});
    assert.ok(far.some((f) => Array.from(f.out.values()).some((o) => o.called)), "someone calls");
    assert.ok(herd.every((z) => far.some((f) => f.out.get(z.id)!.looking === "lion")), "every head comes up to it");
    assert.ok(!far.some((f) => herd.some((z) => f.out.get(z.id)!.action === "flee")), "nobody runs from a lion 30 m off");
    // Then it turns and walks straight at them: they run.
    const near = run(layer, [...herd, lion], 10, {start: 1012, move: (list, t) => {
        const l = list.find((i) => i.id === "lion")!;
        l.shared.x = 6;
        l.shared.z = 30 - (t - 1012) * 3;
        l.shared.yaw = Math.PI;
    }});
    assert.ok(herd.filter((z) => near.some((f) => f.out.get(z.id)!.action === "flee")).length >= 4, "when it comes near, they run");
});

test("with the shared layer's wariness: already watching, it notices sooner, adds no avoiding of its own, and runs only if the predator comes close", () => {
    const first = (doing: string, lionX: number) => {
        const layer = new ReactiveLayer({tier: "high"});
        const zebra = animal("wz", "plains-zebra", 0, 0, {shared: {doing, yaw: Math.PI / 2}});
        const lion = animal("wl", "african-lion", lionX, 0, {shared: {doing: "rest", moving: false, yaw: -Math.PI / 2}});
        const frames = run(layer, [zebra, lion], 8);
        return {
            noticed: frames.findIndex((f) => f.out.get("wz")!.looking === "wl"),
            fled: frames.some((f) => f.out.get("wz")!.action === "flee"),
            moved: Math.max(...frames.map((f) => Math.hypot(f.out.get("wz")!.dx, f.out.get("wz")!.dz)))
        };
    };
    // A lion resting 18 m off (beyond its flight distance), in sight.
    const grazing = first("graze", 18);
    const watching = first("watch", 18);
    assert.ok(watching.noticed >= 0 && watching.noticed <= grazing.noticed, `watching notices no later (${watching.noticed} vs ${grazing.noticed} frames)`);
    assert.ok(!watching.fled, "it does not run from a lion 18 m off that the shared layer already has it watching");
    assert.ok(watching.moved < 0.3, `no extra avoiding step on top of the shared one (${watching.moved.toFixed(2)} m)`);
    // The lion close: it runs all the same.
    assert.ok(first("watch", 5).fled, "a lion 5 m off: it runs");
});

// MARK: Scenario 2: a pack acts out a hunt (the pack mates not in the act stalk and stop short)

test("a pack not acting out a meal stalks, fans out and never closes on the prey", () => {
    const layer = new ReactiveLayer({tier: "high"});
    const deer = animal("deer", "red-deer", 0, 0, {shared: {doing: "graze"}});
    const wolves = [0, 1, 2].map((i) => animal(`wolf${i}`, "eurasian-wolf", -10 + i * 1.5, -8 - i, {shared: {doing: "wander", yaw: 0.6}}));
    const inputs = [deer, ...wolves];
    const frames = run(layer, inputs, 12);
    let stalked = 0;
    for (const f of frames) for (const w of wolves) {
        const o = f.out.get(w.id);
        if (o?.action === "stalk") stalked++;
        const a = drawn(w, o);
        const b = drawn(deer, f.out.get("deer"));
        const shared = Math.hypot(w.shared.x - deer.shared.x, w.shared.z - deer.shared.z);
        assert.ok(Math.hypot(a.x - b.x, a.z - b.z) >= Math.min(minGap(w, deer), shared) - 1e-6, "never nearer than the gap");
    }
    assert.ok(stalked > 0, "the wolves stalk");
    const last = frames[frames.length - 1].out;
    const sides = wolves.map((w) => Math.sign((last.get(w.id)?.dx ?? 0) * 1 - (last.get(w.id)?.dz ?? 0) * 0));
    assert.ok(new Set(wolves.map((w) => Math.round((last.get(w.id)?.dx ?? 0) * 10))).size > 1 || new Set(sides).size > 1, "they fan out");
    // An acting predator (a server meal) is left entirely to the act.
    const acting = new ReactiveLayer();
    const out = acting.step([deer, {...wolves[0], acting: true}], world(1));
    assert.deepEqual([out.get(wolves[0].id)!.dx, out.get(wolves[0].id)!.dz, out.get(wolves[0].id)!.headYaw], [0, 0, 0]);
});

// MARK: Scenario 3: a squirrel caches and returns

test("a squirrel buries food and comes back to it", () => {
    const layer = new ReactiveLayer({tier: "high"});
    const squirrel = animal("sq", "red-squirrel", 0, 0, {shared: {doing: "forage"}});
    const frames = run(layer, [squirrel], 90);
    const actions = frames.map((f) => f.out.get("sq")!.action);
    const buried = actions.indexOf("cache_bury");
    assert.ok(buried >= 0, "it buries");
    const cache = layer.memoryOf("sq")?.spots.cache;
    const returned = actions.indexOf("cache_return");
    assert.ok(returned > buried, "it comes back later");
    if (cache) {
        const at = frames.slice(returned).find((f) => {
            const o = f.out.get("sq")!;
            return Math.hypot(o.dx - (cache.x - squirrel.shared.x), o.dz - (cache.z - squirrel.shared.z)) < 0.3;
        });
        assert.ok(at, "and reaches the cache");
    }
});

// MARK: Scenario 4: avoiding a spot after a predator, and learning

test("after a predator, an animal remembers the spot, keeps away from it and reacts faster the second time", () => {
    const layer = new ReactiveLayer({tier: "high"});
    const deer = animal("deer", "red-deer", 0, 0, {shared: {doing: "graze"}});
    const wolf = animal("wolf", "eurasian-wolf", 9, 0, {shared: {doing: "wander", moving: true}});
    const first = run(layer, [deer, wolf], 4);
    const firstFlee = first.findIndex((f) => f.out.get("deer")!.action === "flee");
    assert.ok(firstFlee >= 0);
    // The wolf goes; the deer calms down but keeps away from where it was.
    const after = run(layer, [deer], 40, {start: 1004});
    const mem = layer.memoryOf("deer")!;
    assert.ok(mem.predators.some((m) => m.slug === "eurasian-wolf"), "it remembers the wolf there");
    const mid = after[Math.floor(after.length / 3)].out.get("deer")!;
    assert.ok(mid.dx < 0, "it keeps to the far side from the wolf's spot");
    const calm = after[after.length - 1].out.get("deer")!;
    assert.ok(!["flee", "alert", "freeze"].includes(calm.action), "and calms down");
    // (It is still on the far side when the wolf is back, further from it than its flight distance: it does not run
    // again. What it has learned is that it notices sooner.)
    const firstLook = first.findIndex((f) => f.out.get("deer")!.looking === "wolf");
    const second = run(layer, [deer, wolf], 4, {start: 1044});
    const secondLook = second.findIndex((f) => f.out.get("deer")!.looking === "wolf");
    assert.ok(secondLook >= 0 && secondLook < firstLook, `faster the second time (${secondLook} < ${firstLook} frames)`);
});

// MARK: Scenario 5: parents shield young

test("a parent puts itself between its young and a predator; the young hides behind", () => {
    const layer = new ReactiveLayer({tier: "high"});
    const mother = animal("mother", "red-deer", 0, 0, {shared: {doing: "graze"}});
    const calf = animal("calf", "red-deer", 1.2, 0.5, {parentId: "mother", length: 0.7, shared: {doing: "graze"}});
    const wolf = animal("wolf", "eurasian-wolf", 0, 14, {shared: {doing: "wander", moving: true, yaw: Math.PI}});
    const frames = run(layer, [mother, calf, wolf], 5);
    const shielded = frames.filter((f) => ["shield_young", "threat_display"].includes(f.out.get("mother")!.action));
    assert.ok(shielded.length > 0, "the mother shields");
    const f = shielded[shielded.length - 1];
    const m = drawn(mother, f.out.get("mother"));
    const c = drawn(calf, f.out.get("calf"));
    assert.ok(Math.hypot(m.x - wolf.shared.x, m.z - wolf.shared.z) < Math.hypot(c.x - wolf.shared.x, c.z - wolf.shared.z), "she is nearer the wolf than her calf");
    assert.ok(frames.some((fr) => fr.out.get("calf")!.action === "hide_behind_parent"), "the calf keeps behind her");
});

// MARK: Scenario 6: storm behaviour

test("in a storm, animals go to shelter and keep low", () => {
    const layer = new ReactiveLayer({tier: "high"});
    const herd = Array.from({length: 6}, (_, i) => animal(`z${i}`, "plains-zebra", i * 3, 0, {shared: {doing: "graze"}}));
    const shade = {x: 6, z: 2};
    const frames = run(layer, herd, 30, {world: () => ({weather: {rain: 1, wind: 0.9, windDirection: 1, fog: 0.3, storm: 1}, refuge: (x: number, z: number, kind) => (kind === "shade" || kind === "cover" ? shade : null)})});
    const sheltering = herd.filter((h) => frames.slice(-60).some((f) => f.out.get(h.id)?.action === "shelter"));
    assert.ok(sheltering.length >= 4, `most shelter (${sheltering.length})`);
    const low = frames[frames.length - 1].out;
    assert.ok(Array.from(low.values()).filter((o) => o.action === "shelter").every((o) => o.crouch > 0.3), "keeping low");
    const calm = run(new ReactiveLayer(), herd.map((h) => ({...h, shared: {...h.shared}})), 30);
    assert.ok(!calm.some((f) => Array.from(f.out.values()).some((o) => o.action === "shelter")), "not in fine weather");
});

test("a storm never sets off alarms by itself: no calls at lions resting 30 m off in a gale; a lion walking right up still gets one", () => {
    const scene = () => [
        ...Array.from({length: 8}, (_, i) => animal(`sz${i}`, "plains-zebra", (i % 4) * 3, Math.floor(i / 4) * 3, {shared: {doing: "graze", yaw: i}})),
        ...Array.from({length: 6}, (_, i) => animal(`sm${i}`, "meerkat", 14 + (i % 3) * 1.5, 6 + Math.floor(i / 3) * 1.5, {shared: {doing: "forage"}})),
        animal("sl0", "african-lion", -32, 2, {shared: {doing: "rest"}}),
        animal("sl1", "african-lion", -34, 5, {shared: {doing: "rest"}})
    ];
    const calls = (weather: ReactiveWorld["weather"], move?: (list: ReactiveInput[], t: number) => void) => {
        let n = 0;
        for (const f of run(new ReactiveLayer({tier: "high"}), scene(), 18, {world: () => ({weather}), move})) f.out.forEach((o) => (n += o.called ? 1 : 0));
        return n;
    };
    // The wind blowing from the lions to the herd (the worst case for scent).
    let calm = 0;
    let storm = 0;
    for (const windDirection of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
        calm += calls({rain: 0, wind: 0.3, windDirection, fog: 0, storm: 0});
        storm += calls({rain: 1, wind: 1, windDirection, fog: 0, storm: 1, lightning: 1});
    }
    assert.ok(storm <= calm, `no more calls in the storm than calm (${storm} vs ${calm})`);
    assert.equal(storm, 0, "none at resting lions 30 m off");
    // A lion walking straight into the herd in the storm: somebody calls.
    const close = calls({rain: 1, wind: 1, windDirection: 0, fog: 0, storm: 1}, (list, t) => {
        const l = list.find((i) => i.id === "sl0")!;
        l.shared.x = -32 + (t - 1000) * 3;
        l.shared.moving = true;
        l.shared.yaw = Math.PI / 2;
        l.shared.doing = "wander";
    });
    assert.ok(close >= 1, `a lion coming in still gets a call (${close})`);
});

// MARK: Scenario 7: a curious, sharp animal investigates the camera

test("a curious, sharp animal comes to look at the camera; a dull one does not", () => {
    const layer = new ReactiveLayer({tier: "high"});
    const ids = Array.from({length: 8}, (_, i) => `chimp${i}`);
    const chimps = ids.map((id, i) => animal(id, "chimpanzee", -8 + i * 2.2, -12, {shared: {doing: "rest", yaw: Math.PI}}));
    const frames = run(layer, chimps, 40, {world: () => ({camera: {x: 0, y: 1.6, z: -18}})});
    const investigating = chimps.filter((c) => frames.some((f) => f.out.get(c.id)!.action === "investigate_camera"));
    assert.ok(investigating.length >= 1, "at least one comes to look");
    for (const c of investigating) {
        const f = frames.filter((fr) => fr.out.get(c.id)!.action === "investigate_camera").pop()!;
        const o = f.out.get(c.id)!;
        assert.equal(o.looking, "camera");
        const before = Math.hypot(c.shared.x - 0, c.shared.z + 18);
        const now = Math.hypot(c.shared.x + o.dx, c.shared.z + o.dz + 18);
        assert.ok(now < before, "closer to the camera");
        assert.ok(now >= 1.2, "never right up to it");
    }
    // A low-intelligence animal (a woodlouse-like instinct band) only glances.
    const dull = {...animal("dull", "red-deer", 0, -13, {shared: {doing: "rest"}}), intel: {...intelProfile("red-deer"), stat: 8, band: "instinct" as const, repertoire: 3, curiosity: 0.1}};
    const dullFrames = run(new ReactiveLayer(), [dull], 40, {world: () => ({camera: {x: 0, y: 1.6, z: -18}})});
    assert.ok(!dullFrames.some((f) => f.out.get("dull")!.action === "investigate_camera"));
});

test("near a still camera grazers get used to it in a few seconds and graze; a camera walking at them gets their attention", () => {
    const camActions = new Set(["watch_camera", "investigate_camera", "back_off_camera"]);
    const herd = Array.from({length: 8}, (_, i) => animal(`cam-deer${i}`, i % 2 ? "red-deer" : "plains-zebra", (i % 4) * 3, Math.floor(i / 4) * 3, {shared: {doing: "graze", yaw: i}}));
    const still = run(new ReactiveLayer({tier: "high"}), herd.map((h) => ({...h, shared: {...h.shared}})), 40, {world: () => ({camera: {x: 4, y: 1.6, z: -6}})});
    const later = still.slice(10 * 30);
    let feed = 0;
    let cam = 0;
    for (const f of later) for (const h of herd) {
        const a = f.out.get(h.id)!.action;
        if (a === "feed") feed++;
        if (camActions.has(a)) cam++;
    }
    const n = later.length * herd.length;
    assert.ok(feed / n > 0.55, `grazing is the common case near a still camera (${((100 * feed) / n).toFixed(0)}%)`);
    assert.ok(cam / n < 0.08, `watching it is brief (${((100 * cam) / n).toFixed(0)}%)`);
    // Some never pay it any attention; some glance up when they first notice it.
    const glanced = herd.filter((h) => still.slice(0, 5 * 30).some((f) => f.out.get(h.id)!.action === "watch_camera"));
    assert.ok(glanced.length >= 1 && glanced.length < herd.length, `a glance from some, not all (${glanced.length} of ${herd.length})`);
    // A camera walking at them from 14 m to 4 m.
    const walking = run(new ReactiveLayer({tier: "high"}), herd.map((h) => ({...h, shared: {...h.shared}})), 20, {world: (t) => ({camera: {x: 4, y: 1.6, z: -6 - Math.max(10 - (t - 1000) * 0.8, 0)}})});
    const noticed = herd.filter((h) => walking.some((f) => camActions.has(f.out.get(h.id)!.action)));
    assert.ok(noticed.length > glanced.length, `an approaching camera gets more attention (${noticed.length} vs ${glanced.length})`);
});

// MARK: Sentinels and many eyes

test("a sentinel group keeps one on watch at a time (rotating), the rest feed; it calls first at a raptor", () => {
    const layer = new ReactiveLayer({tier: "high"});
    const mob = Array.from({length: 6}, (_, i) => animal(`mk${i}`, "meerkat", (i % 3) * 1.2, Math.floor(i / 3) * 1.2, {shared: {doing: "forage"}}));
    const frames = run(layer, mob, 100);
    const watchers = new Set<string>();
    let maxAtOnce = 0;
    for (const f of frames) {
        const on = mob.filter((m) => f.out.get(m.id)!.action === "sentinel");
        on.forEach((m) => watchers.add(m.id));
        maxAtOnce = Math.max(maxAtOnce, on.length);
    }
    assert.ok(watchers.size >= 2, `the duty rotates (${watchers.size})`);
    assert.ok(maxAtOnce <= 2, "one on watch at a time (two only at a hand-over)");
    const feeding = frames.slice(-300).reduce((n, f) => n + mob.filter((m) => f.out.get(m.id)!.action === "feed").length, 0);
    assert.ok(feeding > 300, "the others feed");
    // A raptor comes over: the one on watch sees it first (it looks further) and calls; the mob runs for the burrows.
    // The martial eagle is the meerkat's main aerial predator and its stored profile swoops. (The bateleur this test
    // used before is a carrion-first eater since the profile review, so it gets no hunting default and is no threat
    // in the air: the fixture went stale, the logic did not.)
    const watcher = mob.find((m) => frames[frames.length - 1].out.get(m.id)!.action === "sentinel");
    assert.ok(watcher, "one is on watch when the raptor comes");
    assert.ok(intelProfile("martial-eagle").hunt.includes("aerial_swoop") && !intelProfile("martial-eagle").fallback, "the raptor is a stored aerial hunter");
    const raptor = animal("eagle", "martial-eagle", 30, 4, {shared: {aloft: true, moving: true, y: 12, doing: "soar"}});
    const after = run(layer, [...mob, raptor], 6, {start: 1100, move: (list, t) => {
        list.find((i) => i.id === "eagle")!.shared.x = 30 - (t - 1100) * 5;
    }});
    const firstCall = after.flatMap((f) => Array.from(f.out.entries()).filter(([, o]) => o.called).map(([id]) => id))[0];
    assert.ok(firstCall, "someone calls");
    assert.equal(firstCall, watcher!.id, "the sentinel calls first");
    const ran = mob.filter((m) => after.some((f) => ["flee", "freeze", "alert"].includes(f.out.get(m.id)!.action)));
    assert.equal(ran.length, mob.length, "the whole mob reacts");
});

test("many eyes: an animal alone scans more than one in a big herd", () => {
    const scanShare = (n: number) => {
        const layer = new ReactiveLayer({tier: "high"});
        const herd = Array.from({length: n}, (_, i) => animal(`d${i}`, "red-deer", (i % 5) * 2, Math.floor(i / 5) * 2, {shared: {doing: "graze"}}));
        const frames = run(layer, herd, 120);
        let scans = 0;
        for (const f of frames) scans += Array.from(f.out.values()).filter((o) => o.action === "scan").length;
        return scans / (frames.length * n);
    };
    const alone = scanShare(1);
    const many = scanShare(12);
    assert.ok(alone > many * 1.3, `alone ${alone.toFixed(2)} vs herd ${many.toFixed(2)}`);
});

test("dominance: the more dominant drinks first, the other waits its turn", () => {
    const layer = new ReactiveLayer({tier: "high"});
    const top = animal("top", "red-deer", 0, 0, {dominance: 80, shared: {doing: "drink"}});
    const low = animal("low", "red-deer", 1.4, 0, {dominance: 20, shared: {doing: "drink"}});
    const frames = run(layer, [top, low], 8);
    assert.ok(frames.some((f) => f.out.get("low")!.action === "wait_turn"));
    assert.ok(!frames.some((f) => f.out.get("top")!.action === "wait_turn"));
});

// MARK: The shared layer is a hard constraint

test("the reactive layer never moves an animal outside its envelope, wakes a sleeper only when something wakes it, and leaves acts alone", () => {
    const layer = new ReactiveLayer({tier: "high"});
    const animals: ReactiveInput[] = [];
    for (let i = 0; i < 30; i++) animals.push(animal(`d${i}`, i % 3 === 0 ? "plains-zebra" : "red-deer", (i % 6) * 3, Math.floor(i / 6) * 3, {shared: {doing: ["graze", "rest", "drink", "wander"][i % 4], moving: i % 4 === 3}}));
    for (let i = 0; i < 4; i++) animals.push(animal(`w${i}`, "eurasian-wolf", -20 + i * 2, -10, {shared: {doing: "wander", moving: true}}));
    for (let i = 0; i < 6; i++) animals[i * 5].asleep = true;
    animals[7].acting = true;
    const sleepers = animals.filter((a) => a.asleep);
    let previous = new Map<string, number>();
    const woken = new Set<string>();
    const frames = run(layer, animals, 25, {
        move: (list, t) => {
            const k = t - 1000;
            for (const a of list) {
                if (a.id.startsWith("w")) {
                    a.shared.x = -20 + k * 2.4 + Number(a.id.slice(1)) * 2;
                    a.shared.z = -10 + Math.sin(k * 0.3) * 8;
                } else if (a.shared.moving) a.shared.x += 0.02;
            }
        }
    });
    for (const f of frames) {
        for (const a of f.inputs) {
            const o = f.out.get(a.id);
            if (!o) continue;
            const off = Math.hypot(o.dx, o.dz);
            assert.ok(off <= reactiveEnvelope(a, true) + 1e-6, `${a.id} inside its envelope`);
            if (a.acting) assert.deepEqual([o.dx, o.dz, o.headYaw, o.headPitch, o.bodyYaw], [0, 0, 0, 0, 0]);
            // (Asleep it stays asleep until something wakes it: the wolves running through, its herd fleeing, an alarm; `ark-sleep.test.ts`.)
            if (a.asleep && !o.woke) {
                assert.equal(o.action, "asleep", "asleep stays asleep");
                assert.equal(o.called, false);
                if (!woken.has(a.id)) assert.ok(off <= (previous.get(a.id) ?? Infinity) + 1e-9, "a sleeper's offset only eases back");
                previous.set(a.id, off);
            }
            if (a.asleep && o.woke) woken.add(a.id);
        }
    }
    assert.ok(sleepers.length === 6);
    // Something did happen to the awake ones.
    assert.ok(frames.some((f) => Array.from(f.out.values()).some((o) => o.action === "flee")));
});

test("an offset never takes a land animal into the water, nor a water animal onto a shore or out of its depth", () => {
    // A straight shore at x = 0: water for x < 0, the floor shelving down 0.5 m a metre; land rising the other way.
    const isWater = (x: number) => x < 0;
    const ground = (x: number) => x * 0.5;
    const end = (at: {x: number; z: number; base: number}, dx: number, k: number) => ({x: at.x + dx * k, floor: ground(at.x + dx * k)});
    // A fish 3 m out, swimming 1 m down, startled toward the shore: it stops where the floor is still under it.
    const fish = {x: -3, z: 0, base: -1};
    const k = offsetShare(fish, 5, 0, "water", isWater, ground);
    assert.ok(k < 1, "the offset is cut");
    const at = end(fish, 5, k);
    assert.ok(isWater(at.x) && at.floor <= fish.base + 0.05, `in the water, the floor under its body (${at.x}, floor ${at.floor})`);
    assert.equal(offsetShare(fish, -3, 0, "water", isWater, ground), 1, "away from the shore it takes all of it");
    // A duck floating on the surface stays on the water.
    const duck = {x: -1, z: 0, base: 0};
    const kd = offsetShare(duck, 3, 0, "water", isWater, ground);
    assert.ok(isWater(end(duck, 3, kd).x), "the duck stays on the water");
    // A deer on the bank is never pushed into the water (the rule that was there).
    const deer = {x: 2, z: 0, base: 1};
    const kl = offsetShare(deer, -5, 0, "land", isWater, ground);
    assert.ok(kl < 1 && !isWater(end(deer, -5, kl).x), "the deer stays on land");
    // In the air (or neither): free.
    assert.equal(offsetShare(deer, -5, 0, "free", isWater, ground), 1);
    // Right at the edge with nowhere to go: none of it.
    assert.equal(offsetShare({x: -0.05, z: 0, base: -0.02}, 4, 0, "water", isWater, ground), 0);
});

test("nothing moves backwards: whenever its reactive offset moves faster than 0.3 m/s, it faces within 90 degrees of the way it goes (back-steps excepted), and play comes in short dashes", () => {
    const BACK = new Set(["back_off_camera", "wait_turn"]);
    const scenes: Array<{name: string; list: ReactiveInput[]; camera: (t: number) => {x: number; y: number; z: number}; move?: (l: ReactiveInput[], t: number) => void}> = [
        {name: "dogs at play", list: Array.from({length: 4}, (_, i) => animal(`pd${i}`, "domestic-dog", (i % 2) * 2.5, Math.floor(i / 2) * 2.5, {youngPlay: 0.9, shared: {doing: "rest", yaw: i * 1.6}})), camera: () => ({x: 0, y: 2, z: -14})},
        {
            name: "zebras running from a lion",
            list: [...Array.from({length: 6}, (_, i) => animal(`pz${i}`, "plains-zebra", (i % 3) * 2.5, Math.floor(i / 3) * 2.5, {shared: {doing: "graze", yaw: i * 1.1}})), animal("pl", "african-lion", -25, 1, {shared: {doing: "wander", moving: true, yaw: Math.PI / 2}})],
            camera: () => ({x: 0, y: 2, z: -20}),
            move: (l, t) => {
                const lion = l.find((i) => i.id === "pl")!;
                lion.shared.x = -25 + Math.min(t - 1000, 6) * 3.5;
                lion.shared.moving = t - 1000 < 6;
            }
        },
        {name: "chimps and an arriving camera", list: Array.from({length: 5}, (_, i) => animal(`pc${i}`, "chimpanzee", -3 + i * 1.5, 0, {shared: {doing: "rest", yaw: i * 2}})), camera: (t) => ({x: 0, y: 1.6, z: -(20 - 13 * Math.min((t - 1000) / 4, 1))})}
    ];
    for (const scene of scenes) {
        const frames = run(new ReactiveLayer({tier: "high"}), scene.list, 14, {move: scene.move, world: (t) => ({camera: scene.camera(t)})});
        let moving = 0;
        for (let k = 1; k < frames.length; k++) {
            for (const a of frames[k].inputs) {
                if (a.id === "pl") continue;
                const o = frames[k].out.get(a.id);
                const p = frames[k - 1].out.get(a.id);
                if (!o || !p || BACK.has(o.action)) continue;
                const vx = (o.dx - p.dx) * 30;
                const vz = (o.dz - p.dz) * 30;
                const v = Math.hypot(vx, vz);
                if (v <= 0.3) continue;
                moving++;
                const yaw = a.shared.yaw + o.bodyYaw;
                const cos = (Math.sin(yaw) * vx + Math.cos(yaw) * vz) / v;
                assert.ok(cos >= -1e-6, `${scene.name}: ${a.id} ${o.action} at ${v.toFixed(2)} m/s faces ${((Math.acos(Math.min(Math.max(cos, -1), 1)) * 180) / Math.PI).toFixed(0)} degrees off its way`);
            }
        }
        assert.ok(moving > 20, `${scene.name}: something moved (${moving} frames)`);
        if (scene.name === "dogs at play") {
            // Short dashes and pauses, not a dog racing round its spot: under 8 m of offset travel each in 14 s.
            for (const a of scene.list) {
                let path = 0;
                for (let k = 1; k < frames.length; k++) {
                    const o = frames[k].out.get(a.id)!;
                    const p = frames[k - 1].out.get(a.id)!;
                    path += Math.hypot(o.dx - p.dx, o.dz - p.dz);
                }
                assert.ok(path < 8, `${a.id} plays in bursts (${path.toFixed(1)} m in 14 s)`);
            }
        }
    }
});

/** Body turns a minute: each start of body rotation faster than 0.25 rad/s after half a second below it. */
function bodyTurnsPerMinute(yaws: number[]): number {
    let events = 0;
    let quiet = 30;
    for (let k = 1; k < yaws.length; k++) {
        let d = yaws[k] - yaws[k - 1];
        while (d > Math.PI) d -= 2 * Math.PI;
        while (d < -Math.PI) d += 2 * Math.PI;
        if (Math.abs(d) * 30 > 0.25) {
            if (quiet >= 15) events++;
            quiet = 0;
        } else quiet++;
    }
    return events / (yaws.length / 30 / 60);
}

test("a watcher turns its head first and its body less than once a minute while a predator paces round it; calm looks never turn the body", () => {
    // A lion pacing a slow circle 25 m round a zebra the shared layer has watching it, for three minutes.
    const watcher = animal("tw", "plains-zebra", 0, 0, {shared: {doing: "watch", yaw: 0}});
    const lion = animal("tl", "african-lion", 0, 25, {shared: {doing: "wander", moving: true}});
    const frames = run(new ReactiveLayer({tier: "high"}), [watcher, lion], 180, {move: (list, t) => {
        const a = ((t - 1000) * 0.3) / 25 - 1.2;
        const l = list.find((i) => i.id === "tl")!;
        l.shared.x = Math.sin(a) * 25;
        l.shared.z = Math.cos(a) * 25;
        l.shared.yaw = a + Math.PI / 2;
    }});
    const yaws = frames.slice(150).map((f) => f.out.get("tw")!.bodyYaw);
    const watching = frames.filter((f) => f.out.get("tw")!.looking === "tl").length / frames.length;
    assert.ok(watching > 0.8, `it watches the lion (${(watching * 100).toFixed(0)}% of the time)`);
    assert.ok(bodyTurnsPerMinute(yaws) < 1, `body turns a minute: ${bodyTurnsPerMinute(yaws).toFixed(2)}`);
    // And it keeps it in view: the head never sits pinned at its limit for long while the lion is out of its reach.
    const pinned = frames.slice(150).filter((f) => Math.abs(f.out.get("tw")!.headYaw) > 0.99).length / (frames.length - 150);
    assert.ok(pinned < 0.1, `head pinned at its limit ${(pinned * 100).toFixed(0)}% of the time`);
    // Grooming zebras and resting goats look round, at their flanks and at each other: their bodies do not turn.
    for (const [slug, doing] of [["plains-zebra", "groom"], ["domestic-goat", "rest"], ["plains-zebra", "graze"]] as const) {
        const group = Array.from({length: 4}, (_, i) => animal(`tc-${slug}-${i}`, slug, i * 2, (i % 2) * 2, {shared: {doing, yaw: i * 1.4}}));
        const calm = run(new ReactiveLayer({tier: "high"}), group, 120);
        for (const g of group) {
            const turns = bodyTurnsPerMinute(calm.slice(150).map((f) => f.out.get(g.id)!.bodyYaw));
            assert.ok(turns < 0.5, `${slug} ${doing}: ${g.id} turns its body ${turns.toFixed(2)} times a minute`);
        }
    }
});

// MARK: Variety

test("variety: individuals of one herd choose differently and change at different moments", () => {
    const layer = new ReactiveLayer({tier: "high"});
    const herd = Array.from({length: 10}, (_, i) => animal(`d${i}`, "red-deer", (i % 5) * 2.5, Math.floor(i / 5) * 2.5, {shared: {doing: i % 2 ? "graze" : "rest", yaw: i}}));
    const frames = run(layer, herd, 120);
    const seqs = herd.map((h) => frames.map((f) => f.out.get(h.id)!.action).join(","));
    assert.equal(new Set(seqs).size, herd.length, "no two the same over two minutes");
    // Changes at different moments: rarely more than a third of the herd switches on the same frame.
    let together = 0;
    for (let k = 1; k < frames.length; k++) {
        const switched = herd.filter((h) => frames[k].out.get(h.id)!.action !== frames[k - 1].out.get(h.id)!.action).length;
        if (switched > herd.length / 3) together++;
    }
    assert.ok(together < 3, `switching in step ${together} times`);
    // Heads move: every one turns its head at some point, and not in step.
    const yaw = herd.map((h) => frames.map((f) => f.out.get(h.id)!.headYaw));
    for (const y of yaw) assert.ok(Math.max(...y) - Math.min(...y) > 0.3, "it looks round");
    const corr = (a: number[], b: number[]) => {
        const ma = a.reduce((s, v) => s + v, 0) / a.length;
        const mb = b.reduce((s, v) => s + v, 0) / b.length;
        let num = 0, da = 0, db = 0;
        for (let i = 0; i < a.length; i++) {
            num += (a[i] - ma) * (b[i] - mb);
            da += (a[i] - ma) ** 2;
            db += (b[i] - mb) ** 2;
        }
        return num / Math.sqrt(da * db || 1);
    };
    let high = 0;
    for (let i = 0; i < yaw.length; i++) for (let j = i + 1; j < yaw.length; j++) if (Math.abs(corr(yaw[i], yaw[j])) > 0.8) high++;
    assert.ok(high <= 2, `heads in step: ${high} pairs`);
});

test("the same inputs give the same frames (no hidden randomness)", () => {
    const make = () => [animal("a", "red-deer", 0, 0), animal("b", "red-deer", 2, 0), animal("w", "eurasian-wolf", 15, 0, {shared: {moving: true}})];
    const one = run(new ReactiveLayer(), make(), 6);
    const two = run(new ReactiveLayer(), make(), 6);
    for (let k = 0; k < one.length; k++) for (const id of ["a", "b", "w"]) assert.deepEqual(one[k].out.get(id), two[k].out.get(id));
});

test("the budget: only the nearest animals within the tier's radius act", () => {
    const layer = new ReactiveLayer({tier: "low"});
    const many = Array.from({length: 200}, (_, i) => animal(`d${i}`, "red-deer", (i % 20) * 3, Math.floor(i / 20) * 3 - 20));
    const out = layer.step(many, world(1, {camera: {x: 0, y: 2, z: -20}}));
    assert.ok(out.size <= layer.budget.agents);
    for (const id of Array.from(out.keys())) {
        const a = many.find((m) => m.id === id)!;
        assert.ok(Math.hypot(a.shared.x, a.shared.z + 20) <= layer.budget.radius);
    }
    assert.equal(new ReactiveLayer({tier: "lite"}).step(many, world(1)).size, 0, "lite: off");
});

// MARK: The behaviours pass, lane B2 (2026-11-14): the response fits the threat

/** Shares of the frames by action and by response (`ReactiveOut.response`), for one animal. */
function shares(frames: Frame[], id: string): {action: Record<string, number>; response: Record<string, number>} {
    const action: Record<string, number> = {};
    const response: Record<string, number> = {};
    for (const f of frames) {
        const o = f.out.get(id);
        if (!o) continue;
        action[o.action] = (action[o.action] ?? 0) + 1 / frames.length;
        if (o.response) response[o.response] = (response[o.response] ?? 0) + 1 / frames.length;
    }
    return {action, response};
}

test("who is a threat goes by body size too: a giraffe pays a rock python no mind, a hedgehog a mantis; a rabbit still runs from a stoat, and a lion cub is no threat to a zebra", () => {
    // (The food links and the size stat alone link each of these: the stat ranks animals within their own kind.)
    const eatsByStat = (a: string, b: string) => canEat(intelProfile(a), intelProfile(b), behaviourProfile(a).size, behaviourProfile(b).size);
    assert.ok(eatsByStat("indian-rock-python", "giraffe") && eatsByStat("chinese-mantis", "european-hedgehog"), "the size stat lets a python at a giraffe");
    assert.ok(foodLinked(intelProfile("stoat"), intelProfile("european-rabbit")) && !eatsByStat("stoat", "european-rabbit"), "and keeps a stoat from a rabbit");
    const takes = (a: string, b: string, aLength = displayLength(a, intelProfile(a).plan)) => canTake(intelProfile(a).plan, aLength, huntCompany(intelProfile(a).hunt, behaviourProfile(a).social), intelProfile(b).plan, displayLength(b, intelProfile(b).plan));
    assert.ok(!takes("indian-rock-python", "giraffe") && !takes("chinese-mantis", "european-hedgehog") && !takes("korean-rat-snake", "roe-deer"));
    assert.ok(takes("stoat", "european-rabbit") && takes("african-lion", "plains-zebra") && takes("african-lion", "cape-buffalo") && takes("eurasian-wolf", "red-deer") && takes("eurasian-lynx", "roe-deer") && takes("spotted-hyena", "blue-wildebeest"));
    assert.ok(!takes("african-lion", "african-bush-elephant") && !takes("red-fox", "red-deer"));
    // A pet has no food links: it is read by its build (a cat the garden's birds and mice, not a hen's worth of dog).
    const cat = intelProfile("domestic-cat");
    assert.ok(!cat.eats.size && !cat.eatsSpecies.size, "the ecology gives the house cat no food links");
    assert.ok(huntsByBuild(cat, behaviourProfile("domestic-cat").diet, intelProfile("house-sparrow"), behaviourProfile("house-sparrow").diet));
    assert.ok(!huntsByBuild(intelProfile("african-lion"), "meat", intelProfile("house-sparrow"), behaviourProfile("house-sparrow").diet), "only one with no links at all");
    assert.ok(!takes("african-lion", "plains-zebra", 0.7), "a cub could not take a zebra");
    assert.ok(bodyMass("quadruped", 2) > bodyMass("flying_bird", 2) && bodyMass("flying_bird", 2) > bodyMass("legless", 2));
    // In the layer: the giraffe grazes on with the python coming at it; the rabbit runs from the stoat.
    const layer = new ReactiveLayer({tier: "high"});
    const giraffe = animal("g", "giraffe", 0, 0, {shared: {doing: "browse"}});
    const python = animal("p", "indian-rock-python", 20, 0, {shared: {moving: true, doing: "wander", yaw: -Math.PI / 2}});
    const frames = run(layer, [giraffe, python], 16, {move: (list, t) => (list[1].shared.x = Math.max(20 - (t - 1000) * 1.2, 2))});
    assert.ok(frames.every((f) => !["alert", "flee", "freeze"].includes(f.out.get("g")!.action)), "the giraffe does not react");
    const rabbit = animal("r", "european-rabbit", 0, 0, {shared: {doing: "graze"}});
    const stoat = animal("s", "stoat", 14, 0, {shared: {moving: true, doing: "wander", yaw: -Math.PI / 2}});
    const chase = run(new ReactiveLayer({tier: "high"}), [rabbit, stoat], 14, {move: (list, t) => (list[1].shared.x = Math.max(14 - (t - 1000) * 1.2, 1))});
    assert.ok(chase.some((f) => f.out.get("r")!.action === "flee"), "the rabbit runs from the stoat");
});

test("a herd tolerates lions lying up in sight and grazes on, warily; it watches one that gets up and comes, closes up, and runs when it is near", () => {
    const layer = new ReactiveLayer({tier: "high"});
    const herd = Array.from({length: 6}, (_, i) => animal(`z${i}`, "plains-zebra", (i % 3) * 3, Math.floor(i / 3) * 4, {shared: {doing: "graze", yaw: (i * 1.3) % 6}}));
    // (A lion lying still is seen about 20 m off: flee-envelope.md §2.)
    const lion = animal("lion", "african-lion", 18, 2, {shared: {doing: "rest", yaw: 0}});
    const resting = run(layer, [...herd, lion], 60);
    const late = resting.slice(-30 * 30);
    // (One grazing with its back to the lion may never have seen it: it has its blind side, and the others have settled.)
    const settled = herd.filter((z) => (shares(late, z.id).response.tolerate ?? 0) > 0.9);
    assert.ok(settled.length >= herd.length - 1, `they tolerate the resting lion (${settled.length} of ${herd.length})`);
    for (const z of herd) {
        assert.ok(!late.some((f) => ["alert", "freeze"].includes(f.out.get(z.id)!.action)), `${z.id} is not standing staring at it`);
        assert.ok(!resting.some((f) => f.out.get(z.id)!.action === "flee"), `${z.id} does not run from a lion lying up 15 m off`);
    }
    const feeding = herd.reduce((sum, z) => sum + (shares(late, z.id).action.feed ?? 0), 0) / herd.length;
    assert.ok(feeding > 0.4, `they graze on (${(feeding * 100).toFixed(0)}% of the time)`);
    const up = herd.reduce((sum, z) => sum + (shares(late, z.id).action.scan ?? 0), 0) / herd.length;
    assert.ok(up > 0.12 && up < 0.6, `warily: heads up ${(up * 100).toFixed(0)}% of the time`);
    assert.ok(late.some((f) => herd.some((z) => f.out.get(z.id)!.looking === "lion")), "some of their looks go to the lion");
    const calls = resting.reduce((n, f) => n + herd.filter((z) => f.out.get(z.id)!.called).length, 0);
    assert.ok(calls <= herd.length, `no calling over and over at a lion lying up (${calls})`);
    // The lion gets up and walks at them.
    const coming = run(layer, [...herd, lion], 16, {start: 1060, move: (list, t) => {
        const l = list.find((i) => i.id === "lion")!;
        l.shared.x = Math.max(18 - (t - 1060) * 1.6, 8);
        l.shared.moving = l.shared.x > 8;
        l.shared.yaw = -Math.PI / 2;
        l.shared.doing = "wander";
    }});
    for (const z of herd) assert.ok(coming.some((f) => ["watch", "bunch"].includes(f.out.get(z.id)!.response ?? "")), `${z.id} watches it come`);
    assert.ok(herd.some((z) => coming.some((f) => f.out.get(z.id)!.response === "bunch")), "the herd closes up");
    assert.ok(herd.filter((z) => coming.some((f) => f.out.get(z.id)!.action === "flee")).length >= 3, "and runs when it is near");
});

test("a creeping predator is seen later than a walking one, and a predator lying up later still than one walking by; once seen, the stalker sets it off from furthest", () => {
    const zebra = animal("z", "plains-zebra", 0, 0, {shared: {yaw: Math.PI / 2}});
    const seenAt = (shared: Partial<SharedPose>) => {
        for (let d = 60; d > 1; d -= 0.5) if (perceive(zebra, animal("l", "african-lion", d, 0, {shared}), world(1000, {weather: {rain: 0, wind: 0.2, windDirection: Math.PI, fog: 0, storm: 0}})) === "sight") return d;
        return 0;
    };
    const walking = seenAt({moving: true, doing: "wander", yaw: -Math.PI / 2});
    const still = seenAt({moving: false, doing: "rest"});
    const creeping = seenAt({moving: true, doing: "stalk", yaw: -Math.PI / 2});
    assert.ok(walking > still && still > creeping && creeping > 8, `walking ${walking} m, lying up ${still} m, creeping ${creeping} m`);
    // The prey of a meal's chase runs at this pace too.
    const layer = new ReactiveLayer({tier: "high"});
    const z = animal("z", "plains-zebra", 0, 0, {shared: {doing: "graze"}});
    const lion = animal("lion", "african-lion", 30, 0, {shared: {moving: true, doing: "stalk", yaw: -Math.PI / 2}});
    const frames = run(layer, [z, lion], 50, {move: (list, t) => (list[1].shared.x = Math.max(30 - (t - 1000) * 0.6, 3))});
    const first = frames.find((f) => f.out.get("z")!.looking === "lion");
    assert.ok(first, "it sees the stalker in the end");
    const at = first!.inputs[1].shared.x;
    assert.ok(at < walking * 0.6, `late: at ${at.toFixed(1)} m`);
    const fled = frames.find((f) => f.out.get("z")!.action === "flee");
    assert.ok(fled && fled.t - first!.t < 3, "and bolts almost as soon as it does");
});

test("a flight is a dash at the chase's own pace: up to speed over its first strides, to the edge of its reach, then it stops and looks back; it is not 'fleeing' all the while the predator stays", () => {
    const chital = animal("c", "chital", 0, 0, {shared: {doing: "graze"}});
    assert.ok(fleeSpeed(chital) > 4, `a chital runs at ${fleeSpeed(chital).toFixed(1)} m/s (it crawled at 0.15 on the first rig set's clip figure)`);
    assert.ok(fleeSpeed(animal("m", "alpine-marmot", 0, 0)) > 2 && fleeSpeed(animal("h", "house-mouse", 0, 0)) < 3);
    const layer = new ReactiveLayer({tier: "high"});
    const tiger = animal("t", "bengal-tiger", 4, 0, {shared: {doing: "rest"}});
    const frames = run(layer, [chital, tiger], 40);
    const fleeing = frames.filter((f) => f.out.get("c")!.action === "flee");
    assert.ok(fleeing.length > 3 && fleeing.length < 4 * 30, `the dash is short (${(fleeing.length / 30).toFixed(1)} s of 40)`);
    // Speed along the dash: slow off the mark, fast in the middle.
    const speeds = fleeing.slice(1).map((f, k) => Math.hypot(f.out.get("c")!.dx - fleeing[k].out.get("c")!.dx, f.out.get("c")!.dz - fleeing[k].out.get("c")!.dz) * 30);
    const peak = Math.max(...speeds);
    assert.ok(peak > 3 && peak <= fleeSpeed(chital) + 0.01, `peak ${peak.toFixed(1)} m/s`);
    assert.ok(speeds[0] < peak * 0.6, `it gets up to speed (${speeds[0].toFixed(1)} then ${peak.toFixed(1)} m/s)`);
    const after = frames.slice(frames.indexOf(fleeing[fleeing.length - 1]) + 1);
    const reach = reactiveEnvelope(chital, true);
    assert.ok(after.every((f) => Math.hypot(f.out.get("c")!.dx, f.out.get("c")!.dz) > reach * 0.8), "it stays where it ran to while the tiger is there");
    assert.ok(after.some((f) => f.out.get("c")!.response === "hold") && after.some((f) => f.out.get("c")!.looking === "t"), "holding, looking back at it");
    // The tiger lies on: the chital settles there, out of its flight distance, and feeds again.
    assert.ok(after.slice(-150).some((f) => f.out.get("c")!.response === "tolerate"), "and settles, still out there");
});

test("big and armed animals stand their ground: a buffalo and a boar before a big cat, a porcupine and a skunk before a lynx; a zebra and a rabbit run", () => {
    const meet = (prey: string, predator: string) => {
        const me = animal("me", prey, 0, 0, {shared: {doing: "graze"}});
        const it = animal("it", predator, 26, 0, {shared: {moving: true, doing: "wander", yaw: -Math.PI / 2}});
        return shares(run(new ReactiveLayer({tier: "high"}), [me, it], 22, {move: (list, t) => (list[1].shared.x = Math.max(26 - (t - 1000) * 1.5, 2.5))}), "me");
    };
    assert.ok(intelProfile("striped-skunk").defence.includes("chemical"), "a skunk's spray is stored (the family rule)");
    assert.ok(intelProfile("crested-porcupine").defence.includes("armour") && intelProfile("crested-porcupine").defence.includes("threat"));
    for (const [prey, predator] of [["cape-buffalo", "african-lion"], ["wild-boar", "amur-leopard"], ["crested-porcupine", "eurasian-lynx"], ["striped-skunk", "eurasian-lynx"]]) {
        const s = meet(prey, predator);
        assert.ok((s.response.stand ?? 0) > 0.2 && !s.action.flee, `${prey} stands before ${predator} (${JSON.stringify(s.response)})`);
        assert.ok((s.action.threat_display ?? 0) > 0.2, `${prey} faces it`);
    }
    for (const [prey, predator] of [["plains-zebra", "african-lion"], ["european-rabbit", "red-fox"]]) {
        const s = meet(prey, predator);
        assert.ok((s.action.flee ?? 0) > 0 && !s.response.stand, `${prey} runs from ${predator}`);
    }
});

test("a cryptic animal holds still, low, until the predator is almost on it, then bolts; one that lives in a burrow runs for it and keeps low there", () => {
    const pheasant = animal("p", "common-pheasant", 0, 0, {shared: {doing: "forage"}});
    assert.ok(intelProfile("common-pheasant").defence.includes("freeze"));
    const fox = animal("f", "red-fox", 22, 0, {shared: {moving: true, doing: "wander", yaw: -Math.PI / 2}});
    const frames = run(new ReactiveLayer({tier: "high"}), [pheasant, fox], 24, {move: (list, t) => (list[1].shared.x = Math.max(22 - (t - 1000) * 1.1, 0.8))});
    const frozen = frames.filter((f) => f.out.get("p")!.action === "freeze");
    assert.ok(frozen.length > 4 * 30, `it holds still (${(frozen.length / 30).toFixed(1)} s)`);
    assert.ok(frozen[frozen.length - 1].out.get("p")!.crouch > 0.5, "low");
    const flush = frames.find((f) => f.out.get("p")!.action === "flee");
    assert.ok(flush, "it goes in the end");
    const flight = intelProfile("common-pheasant").flight;
    assert.ok(flush!.inputs[1].shared.x < flight * 1.6, `late: the fox ${flush!.inputs[1].shared.x.toFixed(1)} m off (its flight distance ${flight} m)`);
    assert.ok(frames.indexOf(flush!) > frames.indexOf(frozen[0]), "frozen first, then gone");
    // A meerkat: its group is listed first, but it lives in a burrow: it makes for the bolt-hole, and keeps low at it.
    const p = intelProfile("meerkat");
    assert.ok(p.defence[0] === "group" && behaviourProfile("meerkat").roost === "burrow");
    const mob = Array.from({length: 4}, (_, i) => ({...animal(`m${i}`, "meerkat", i * 0.8, 0, {shared: {doing: "forage"}}), roost: "burrow"}));
    const jackal = animal("j", "european-wildcat", 0, 16, {shared: {moving: true, doing: "wander", yaw: Math.PI}});
    assert.ok(foodLinked(intelProfile("european-wildcat"), p), "a wildcat takes a meerkat");
    const hole = {x: -1.2, z: -1.5};
    const ran = run(new ReactiveLayer({tier: "high"}), [...mob, jackal], 16, {move: (list, t) => (list[4].shared.z = Math.max(16 - (t - 1000) * 1.4, 1.5)), world: () => ({refuge: (_x, _z, kind) => (kind === "cover" ? hole : null)})});
    const m3 = mob[3];
    const end = ran[ran.length - 1].out.get(m3.id)!;
    assert.ok(ran.some((f) => f.out.get(m3.id)!.action === "flee"), "it runs");
    assert.ok(Math.hypot(m3.shared.x + end.dx - hole.x, m3.shared.z + end.dz - hole.z) < Math.hypot(m3.shared.x - hole.x, m3.shared.z - hole.z) - 0.5, "toward the bolt-hole (away from the middle of the mob)");
    assert.ok(ran.some((f) => f.out.get(m3.id)!.response === "ground" && f.out.get(m3.id)!.crouch > 0.6), "and keeps low there");
});

test("after a scare it calms in proportion: a look at a lion going by is over in seconds, a run takes much longer; then it is wary a while, then feeds as before", () => {
    const calmAfter = (closest: number) => {
        const layer = new ReactiveLayer({tier: "high"});
        const zebra = animal("z", "plains-zebra", 0, 0, {shared: {doing: "graze"}});
        const lion = animal("l", "african-lion", -30, closest, {shared: {moving: true, doing: "wander", yaw: Math.PI / 2}});
        // The lion walks by and is gone from sight as it draws level (over a bank, into the reeds).
        const pass = run(layer, [zebra, lion], 15, {move: (list, t) => (list[1].shared.x = -30 + (t - 1000) * 2)});
        const after = run(layer, [zebra], 150, {start: 1015});
        const calm = after.findIndex((f) => f.out.get("z")!.alarmed === 0 && !["alert", "flee", "freeze", "recover"].includes(f.out.get("z")!.action));
        const fed = after.findIndex((f, k) => k >= calm && f.out.get("z")!.action === "feed");
        return {ran: pass.some((f) => f.out.get("z")!.action === "flee"), calm: calm / 30, fed: fed / 30, end: after[after.length - 1].out.get("z")!};
    };
    const far = calmAfter(22);
    const near = calmAfter(3);
    assert.ok(!far.ran && near.ran);
    assert.ok(far.calm >= 0 && far.calm < 16, `a look: calm in ${far.calm.toFixed(1)} s`);
    assert.ok(near.calm > far.calm + 8 && near.calm < 60, `a run: calm in ${near.calm.toFixed(1)} s`);
    assert.ok(near.fed >= near.calm && near.fed < 130, `and feeding again by ${near.fed.toFixed(1)} s`);
    assert.ok(Math.hypot(near.end.dx, near.end.dz) < reactiveEnvelope(animal("z", "plains-zebra", 0, 0), false) + 0.01, "back at its own place in the end (never frozen where it ran to)");
});

test("vigilance in a herd: each lifts its head in bouts, fewer the bigger the herd, more at the edge; someone's is up much of the time", () => {
    const upShare = (size: number) => {
        const layer = new ReactiveLayer({tier: "high"});
        // A block of them, 3 m apart: the ones in the middle have the herd all round.
        const side = Math.ceil(Math.sqrt(size));
        const herd = Array.from({length: size}, (_, i) => animal(`w${size}-${i}`, "blue-wildebeest", (i % side) * 3, Math.floor(i / side) * 3, {shared: {doing: "graze", yaw: (i * 2.1) % 6}}));
        const frames = run(layer, herd, 240, {world: () => ({camera: {x: 0, y: 2, z: -60}})});
        const up = herd.map((h) => frames.filter((f) => ["scan", "sentinel", "alert"].includes(f.out.get(h.id)!.action)).length / frames.length);
        const some = frames.filter((f) => herd.some((h) => f.out.get(h.id)!.action === "scan")).length / frames.length;
        const cx = ((side - 1) * 3) / 2;
        const cz = ((Math.ceil(size / side) - 1) * 3) / 2;
        const inner = herd.map((h, i) => ({d: Math.hypot(h.shared.x - cx, h.shared.z - cz), up: up[i]})).sort((a, b) => a.d - b.d);
        const mean = (list: number[]) => list.reduce((a, b) => a + b, 0) / Math.max(list.length, 1);
        return {mean: mean(up), some, inner: mean(inner.slice(0, Math.floor(size / 3)).map((x) => x.up)), edge: mean(inner.slice(-Math.floor(size / 3)).map((x) => x.up))};
    };
    const five = upShare(5);
    const sixteen = upShare(16);
    assert.ok(five.mean > 0.08 && five.mean < 0.3, `in a herd of 5 a head is up ${(five.mean * 100).toFixed(0)}% of the time (4% before the pass)`);
    assert.ok(sixteen.mean > 0.04 && sixteen.mean < five.mean, `fewer in 16: ${(sixteen.mean * 100).toFixed(0)}%`);
    assert.ok(five.some > 0.35 && sixteen.some > five.some, `someone is up ${(five.some * 100).toFixed(0)}% of the time in 5, ${(sixteen.some * 100).toFixed(0)}% in 16`);
    assert.ok(sixteen.edge > sixteen.inner, `more at the edge (${(sixteen.edge * 100).toFixed(0)}% against ${(sixteen.inner * 100).toFixed(0)}% inside)`);
});

test("a grazing animal with its head down notices a distant predator later than one already looking round, and one on watch soonest", () => {
    const noticedAfter = (extra: Partial<SharedPose>) => {
        const times: number[] = [];
        for (let k = 0; k < 12; k++) {
            const layer = new ReactiveLayer({tier: "high"});
            const z = animal(`att${k}`, "plains-zebra", 0, 0, {shared: {doing: "graze", ...extra}});
            // (Feeding for a while first, so its head is down when the lion shows.)
            run(layer, [z], 6);
            const lion = animal("lion", "african-lion", 30, 0, {shared: {moving: true, doing: "wander", yaw: 0}});
            const frames = run(layer, [z, lion], 12, {start: 1006});
            const at = frames.findIndex((f) => f.out.get(z.id)!.looking === "lion");
            times.push(at < 0 ? 12 : at / 30);
        }
        return times.sort((a, b) => a - b)[6];
    };
    const grazing = noticedAfter({});
    const watching = noticedAfter({doing: "watch"});
    assert.ok(grazing > watching + 0.3, `grazing ${grazing.toFixed(1)} s, on watch ${watching.toFixed(1)} s`);
    assert.ok(grazing < 8 && watching < 1, "within seconds either way");
});

test("kept animals: a zoo zebra pays the zoo's lions no mind, a hen the yard dog, but a hen runs from a wild fox; the camera walking at a pet neither backs it off nor wakes it; the zoo lion still watches", () => {
    const layer = new ReactiveLayer({tier: "high"});
    const zebra = {...animal("z", "plains-zebra", 0, 0, {shared: {doing: "graze"}}), kept: "zoo" as const};
    const lion = {...animal("l", "african-lion", 7, 0, {shared: {moving: true, doing: "wander", yaw: -Math.PI / 2}}), kept: "zoo" as const};
    const zoo = run(layer, [zebra, lion], 30);
    assert.ok(zoo.every((f) => !f.out.get("z")!.response && !["alert", "flee", "freeze"].includes(f.out.get("z")!.action)), "the zoo zebra does not react");
    assert.ok(zoo.some((f) => f.out.get("l")!.action === "watch_prey") && !zoo.some((f) => f.out.get("l")!.action === "stalk"), "the lion watches it across the fence and never stalks");
    const hen = {...animal("h", "domestic-chicken", 0, 0, {shared: {doing: "forage"}}), kept: "farm" as const};
    const dog = {...animal("d", "domestic-dog", 5, 0, {shared: {moving: true, doing: "wander", yaw: -Math.PI / 2}}), kept: "house" as const};
    const yard = run(new ReactiveLayer({tier: "high"}), [hen, dog], 20, {move: (list, t) => (list[1].shared.x = Math.max(5 - (t - 1000) * 0.6, 1))});
    assert.ok(yard.every((f) => !["alert", "flee", "freeze"].includes(f.out.get("h")!.action)), "the hen knows the yard dog");
    const fox = animal("f", "red-fox", 12, 0, {shared: {moving: true, doing: "wander", yaw: -Math.PI / 2}});
    const raid = run(new ReactiveLayer({tier: "high"}), [hen, fox], 14, {move: (list, t) => (list[1].shared.x = Math.max(12 - (t - 1000) * 1.2, 1))});
    assert.ok(raid.some((f) => f.out.get("h")!.action === "flee"), "the hen runs from a fox");
    // The camera walking at a sleeping pet and at a shy wild one of its kind.
    const walkIn = (kept: "house" | null) => {
        const cat = {...animal("shycat", "domestic-cat", 0, 0, {shared: {doing: "rest"}}), asleep: true, kept};
        return run(new ReactiveLayer({tier: "high"}), [cat], 12, {world: (t) => ({camera: {x: 0, y: 1.6, z: Math.max(10 - (t - 1000) * 1.2, 0.5)}})});
    };
    assert.ok(walkIn("house").every((f) => !f.out.get("shycat")!.woke), "a pet sleeps on with someone walking up");
    assert.ok(walkIn(null).some((f) => f.out.get("shycat")!.woke), "a wild one wakes");
});

test("a smaller hunter gives way to a much bigger one (a cheetah to a lion); the bigger pays it no mind", () => {
    const layer = new ReactiveLayer({tier: "high"});
    const cheetah = animal("c", "cheetah", 0, 0, {shared: {doing: "rest"}});
    const lion = animal("l", "african-lion", 26, 0, {shared: {moving: true, doing: "wander", yaw: -Math.PI / 2}});
    assert.ok(!canEat(intelProfile("african-lion"), intelProfile("cheetah"), behaviourProfile("african-lion").size, behaviourProfile("cheetah").size), "the food links have no lion eating cheetahs");
    const frames = run(layer, [cheetah, lion], 20, {move: (list, t) => (list[1].shared.x = Math.max(26 - (t - 1000) * 1.6, 2))});
    assert.ok(frames.some((f) => f.out.get("c")!.looking === "l" && f.out.get("c")!.action === "alert"), "the cheetah watches the lion come");
    assert.ok(frames.some((f) => Math.hypot(f.out.get("c")!.dx, f.out.get("c")!.dz) > 2), "and gets out of its way");
    assert.ok(frames.every((f) => !["alert", "flee"].includes(f.out.get("l")!.action)), "the lion does not react to the cheetah");
});
