import assert from "node:assert/strict";
import test from "node:test";
import {abilitiesOf} from "@/ark-live/species";
import {newMotion, validatePose, type Motion, type ValidateContext} from "@/ark-live/validate";
import {NO_INPUT, startMover, stepMover, type ControlInput, type MoveContext} from "@/ark-live/movement";
import type {AnimalFacts} from "@/ark-live/rules";
import type {Clip, Mode, PoseMessage, WirePose} from "@/ark-live/protocol";
import {signals, type Meters} from "@/ark-live/meters";
import {GridTerrain} from "@/lib/ark-live-fixtures";

const terrain = new GridTerrain();
const T0 = 1_000_000;

function facts(slug: string, extra: Partial<AnimalFacts> = {}): AnimalFacts {
    return {id: "a", slug, zone: "grassland", area: null, enclosure: null, ...extra};
}

function ctx(slug: string, extra: Partial<AnimalFacts> = {}, meters: Meters | null = null, nowS = 0): ValidateContext {
    return {a: abilitiesOf(slug), facts: facts(slug, extra), terrain, sig: meters ? signals(meters, nowS) : null};
}

function start(x: number, z: number, mode: Mode = "ground", y = 0.5, yaw = 0): WirePose {
    return {x, y, z, yaw, pitch: 0, roll: 0, mode, clip: "idle", speed: 0};
}

let seq = 0;
function pose(m: Motion, dx: number, dz: number, dtMs: number, extra: Partial<PoseMessage> = {}): PoseMessage {
    const last = m.last;
    seq = (last.seq + 1) & 0xffff;
    const x = last.x + dx;
    const z = last.z + dz;
    const yaw = dx || dz ? Math.atan2(dx, dz) : last.yaw;
    return {seq, t: last.t + dtMs, x, y: last.y, z, yaw, pitch: 0, roll: 0, mode: last.mode, clip: "walk" as Clip, speed: 0, flags: 0, ...extra};
}

/** Walk a run of steps; returns the verdict kinds. */
function walk(m: Motion, c: ValidateContext, steps: number, dx: number, dz: number, dtMs: number, extra: Partial<PoseMessage> = {}): string[] {
    const out: string[] = [];
    let now = m.last.received;
    for (let i = 0; i < steps; i++) {
        now += dtMs;
        out.push(validatePose(m, pose(m, dx, dz, dtMs, extra), now, c).kind);
    }
    return out;
}

test("validate: a fox walking at its pace is accepted, and the server sets its height", () => {
    const c = ctx("red-fox");
    const m = newMotion(start(-10, -30), T0);
    const step = c.a.walk * 0.1 * 0.95;
    const kinds = walk(m, c, 30, 0, step, 100);
    assert.deepEqual(new Set(kinds), new Set(["accept"]));
    assert.equal(m.last.y, 0.5, "y from the terrain");
    const lifted = validatePose(m, {...pose(m, 0, step, 100), y: 3}, m.last.received + 100, c);
    assert.equal(lifted.kind, "accept");
    assert.equal(m.last.y, 0.5, "a client's y is ignored on the ground: nothing floats");
});

test("validate: too fast for its mode is corrected; a run needs the run clip; a teleport is refused outright", () => {
    const c = ctx("red-fox");
    let m = newMotion(start(-10, -30), T0);
    // Walk clip at run speed.
    const r = validatePose(m, pose(m, 0, c.a.run * 0.1, 100), T0 + 100, c);
    assert.equal(r.kind, "reject");
    if (r.kind === "reject") assert.equal(r.reason, "speed");
    // The run clip at run speed passes.
    m = newMotion(start(-10, -30), T0);
    assert.equal(validatePose(m, pose(m, 0, c.a.run * 0.1, 100, {clip: "run"}), T0 + 100, c).kind, "accept");
    // A 5 m jump.
    m = newMotion(start(-10, -30), T0);
    const jump = validatePose(m, pose(m, 0, 5, 100, {clip: "sprint"}), T0 + 100, c);
    assert.ok(jump.kind === "reject" && jump.reason === "teleport");
});

test("validate: stretching the client clock buys nothing (stamps clamped, a rolling second of distance)", () => {
    const c = ctx("red-fox");
    const m = newMotion(start(-10, -30), T0);
    // Claim 400 ms passed each time while only 100 ms did: per-step allows it at first, the 1 s window does not.
    const kinds = walk(m, c, 10, 0, c.a.walk * 0.4, 100);
    assert.ok(kinds.includes("reject"), kinds.join(","));
    // A stamp far in the future is clamped (and counted).
    const m2 = newMotion(start(-10, -30), T0);
    validatePose(m2, {...pose(m2, 0, 0.05, 100), t: T0 + 60_000}, T0 + 100, c);
    assert.equal(m2.clamped, 1);
});

test("validate: the sprint is a 3 s burst from a bucket that refills a second every five", () => {
    const c = ctx("red-fox");
    const m = newMotion(start(-20, -40), T0);
    const step = c.a.sprint * 0.1 * 0.97;
    const kinds = walk(m, c, 45, 0, step, 100, {clip: "sprint"});
    const firstReject = kinds.indexOf("reject");
    assert.ok(firstReject >= 25 && firstReject <= 34, `sprint ran out after ${firstReject} steps`);
});

test("validate: turning faster than the species can is corrected", () => {
    const c = ctx("african-bush-elephant");
    const m = newMotion(start(-10, -30), T0);
    const r = validatePose(m, {...pose(m, 0, 0, 100), yaw: 2.5}, T0 + 100, c);
    assert.ok(r.kind === "reject" && r.reason === "turn");
});

test("validate: nothing passes through a wall, a trunk or a ridge", () => {
    const c = ctx("red-fox");
    // The wall at x ∈ [0, 1): a cheetah's 1.5 m sprint step from x = -0.3 is under its speed and teleport caps but crosses it.
    const cheetah = ctx("cheetah");
    const m = newMotion(start(-0.3, 0, "ground", 0.5, Math.PI / 2), T0);
    const r = validatePose(m, pose(m, 1.5, 0, 200, {clip: "sprint"}), T0 + 200, cheetah);
    assert.ok(r.kind === "reject" && r.reason === "terrain", JSON.stringify(r));
    // Up the cliff (2.25 rise over run): too steep.
    const m2 = newMotion(start(9.8, -35, "ground", 0.5, Math.PI / 2), T0);
    const r2 = walk(m2, c, 6, 0.1, 0, 100);
    assert.ok(r2.includes("reject"));
    assert.ok(m2.last.x < 10.2, "stopped at the foot of the cliff");
    // A mountain animal climbs it.
    const goat = ctx("domestic-goat", {zone: "mountains"});
    const m3 = newMotion(start(9.8, -35, "ground", 0.5, Math.PI / 2), T0);
    assert.ok(walk(m3, goat, 4, 0.1, 0, 100).every((k) => k === "accept"));
});

test("validate: no fish out of water, no fox in the air, no fox swimming under", () => {
    const fish = ctx("atlantic-salmon", {zone: "open_ocean"});
    const m = newMotion(start(40, 0, "swim", -2, -Math.PI / 2), T0);
    assert.equal(validatePose(m, pose(m, -0.1, 0, 100, {clip: "swim"}), T0 + 100, fish).kind, "accept");
    // Swim up onto the beach: the step itself stays short, but the cell is land.
    const m2 = newMotion(start(30.4, 0, "swim", -0.2, -Math.PI / 2), T0);
    const r2 = validatePose(m2, pose(m2, -0.3, 0, 100, {clip: "swim"}), T0 + 100, fish);
    assert.equal(r2.kind, "reject");
    const fox = ctx("red-fox");
    const m3 = newMotion(start(-10, -30), T0);
    const r3 = validatePose(m3, {...pose(m3, 0, 0.1, 100), mode: "air", y: 3}, T0 + 100, fox);
    assert.ok(r3.kind === "reject" && r3.reason === "mode");
    const m4 = newMotion(start(40, 0, "paddle", -0.3), T0);
    const r4 = validatePose(m4, {...pose(m4, 0, 0.05, 100), mode: "swim", y: -2}, T0 + 100, fox);
    assert.ok(r4.kind === "reject" && r4.reason === "mode");
});

test("validate: a non-swimmer paddles 15 m of deep water, then only back toward the shallows", () => {
    const c = ctx("red-fox");
    const m = newMotion(start(31, 0, "paddle", -0.5), T0);
    const step = c.a.paddle * 0.1 * 0.9;
    const kinds = walk(m, c, Math.ceil(25 / step), step, 0, 100, {mode: "paddle", clip: "paddle"});
    assert.ok(kinds.includes("reject"), "out past its limit");
    assert.ok(m.last.x < 31 + 17, `stopped at ${m.last.x.toFixed(1)}`);
    // Back toward the shore is fine.
    const back = walk(m, c, 5, -step, 0, 100, {mode: "paddle", clip: "paddle"});
    assert.ok(back.slice(-3).every((k) => k === "accept" || k === "drop"), back.join(","));
});

test("validate: flight ceilings and the mode graph's switches take their clip's time", () => {
    const eagle = ctx("golden-eagle", {zone: "mountains"});
    // Take off: then for 0.6 s it may not go fast.
    const m = newMotion(start(-10, -30), T0);
    assert.equal(validatePose(m, {...pose(m, 0, 0.05, 100), mode: "air", y: 0.9, clip: "takeoff"}, T0 + 100, eagle).kind, "accept");
    const fast = validatePose(m, {...pose(m, 0, eagle.a.fly * 0.1, 100), mode: "air", y: 1.2, clip: "flap"}, T0 + 200, eagle);
    assert.ok(fast.kind === "reject" && fast.reason === "speed", "no instant full speed after a take-off");
    // Over the ceiling (high band: 42 m above the ground).
    const m2 = newMotion(start(-10, -30, "air", 42.8), T0);
    const r = validatePose(m2, {...pose(m2, 0, 0.5, 100), y: 43.4, clip: "flap"}, T0 + 100, eagle);
    assert.ok(r.kind === "reject" && r.reason === "altitude");
    // A burrow only in soil, only for a burrower.
    const fox = ctx("red-fox");
    const m3 = newMotion(start(-10, -30), T0);
    const r3 = validatePose(m3, {...pose(m3, 0, 0, 100), mode: "burrow", y: -0.1}, T0 + 100, fox);
    assert.ok(r3.kind === "reject" && r3.reason === "mode");
});

test("validate: pens are walls (a zoo animal stays in its enclosure, a farm animal in its paddock, nobody walks into the zoo)", () => {
    const zoo = ctx("red-fox", {enclosure: 7});
    const m = newMotion(start(-7.5, 32.5), T0);
    const out = walk(m, zoo, 40, 0, 0.1, 100);
    assert.ok(out.includes("reject"));
    assert.ok(m.last.z < 35 && m.last.z > 34, `walked to the fence and kept in at z ${m.last.z.toFixed(2)}`);
    const goat = ctx("domestic-goat", {area: "farm", zone: "farm_garden"});
    const m2 = newMotion(start(17.5, -45.5, "ground", 0.5, Math.PI / 2), T0);
    walk(m2, goat, 60, 0.1, 0, 100);
    assert.ok(m2.last.x < 20 && m2.last.x > 19, `farm animal walked to its fence and stopped at x ${m2.last.x.toFixed(2)}`);
    const wild = ctx("red-fox");
    const m3 = newMotion(start(-12, 32.5, "ground", 0.5, Math.PI / 2), T0);
    walk(m3, wild, 40, 0.1, 0, 100);
    assert.ok(m3.last.x < -10 && m3.last.x > -11, `walked up to the zoo's fence and kept out at x ${m3.last.x.toFixed(2)}`);
});

test("validate: three corrections in 5 s stumble it for a second; twenty in a minute end the session; in-flight poses after a correction are dropped, not punished", () => {
    const c = ctx("red-fox");
    const m = newMotion(start(-10, -30), T0);
    let now = T0;
    const verdicts = [];
    for (let i = 0; i < 3; i++) {
        now += 800;
        m.resyncUntil = 0;
        verdicts.push(validatePose(m, {...pose(m, 0, 1.4, 100), t: now}, now, c));
    }
    assert.ok(verdicts.every((v) => v.kind === "reject"));
    assert.ok(verdicts[2].kind === "reject" && verdicts[2].stumble, "the third stumbles");
    // Held: it may not move for a second.
    const held = validatePose(m, {...pose(m, 0, 0.3, 100), t: now + 500}, now + 500, c);
    assert.equal(held.kind, "drop", "within the resync window it's a drop");
    m.resyncUntil = 0;
    const held2 = validatePose(m, {...pose(m, 0, 0.3, 100), t: now + 950}, now + 950, c);
    assert.ok(held2.kind === "reject" && held2.reason === "held");
    let end = false;
    for (let i = 0; i < 20 && !end; i++) {
        now += 1500;
        m.resyncUntil = 0;
        const v = validatePose(m, {...pose(m, 0, 1.4, 100), t: now}, now, c);
        if (v.kind === "reject" && v.end) end = true;
    }
    assert.ok(end, "ends after 20 in a minute");
    // A burst of in-flight poses right after one correction: one rejection, the rest dropped quietly.
    const m2 = newMotion(start(-10, -30), T0);
    const first = validatePose(m2, pose(m2, 0, 1.5, 100), T0 + 100, c);
    assert.equal(first.kind, "reject");
    const next = [1, 2, 3].map((i) => validatePose(m2, pose(m2, 0, 1.5 + 0.1 * i, 100), T0 + 100 + i * 100, c).kind);
    assert.deepEqual(next, ["drop", "drop", "drop"]);
    assert.equal(m2.rejected, 1);
});

test("validate: more than 12 packets a second are dropped and counted", () => {
    const c = ctx("red-fox");
    const m = newMotion(start(-10, -30), T0);
    const kinds = [];
    for (let i = 0; i < 20; i++) kinds.push(validatePose(m, pose(m, 0, 0.01, 40), T0 + i * 40, c).kind);
    assert.ok(kinds.filter((k) => k === "drop").length >= 7);
    assert.ok(m.dropped >= 7);
});

test("validate: a held animal (lying exhausted, a distressed stop) doesn't move", () => {
    const meters: Meters = {stamina: 0, exposure: 0, lyingUntil: (T0 + 20_000) / 1000};
    const c = ctx("red-fox", {}, meters, T0 / 1000);
    const m = newMotion(start(-10, -30), T0);
    const kinds = walk(m, c, 8, 0, 0.1, 100);
    assert.ok(kinds.includes("reject"), kinds.join(","));
});

// MARK: The mover's own poses pass the validator.

type Drive = (t: number) => Partial<ControlInput>;

function drive(slug: string, from: WirePose, seconds: number, steer: Drive, extra: Partial<AnimalFacts> = {}): {rejects: number; accepted: number; last: WirePose; modes: Set<Mode>} {
    const a = abilitiesOf(slug);
    const f = facts(slug, extra);
    const mc: MoveContext = {a, facts: f, terrain, sig: null};
    let s = startMover({x: from.x, y: from.y, z: from.z, yaw: from.yaw, mode: from.mode}, mc);
    const m = newMotion(from, T0);
    let rejects = 0;
    let accepted = 0;
    const modes = new Set<Mode>();
    for (let i = 1; i <= seconds * 60; i++) {
        s = stepMover(s, {...NO_INPUT, ...steer(i / 60)}, 1 / 60, mc);
        if (i % 6 === 0) {
            const now = T0 + Math.round((i / 60) * 1000);
            const v = validatePose(m, {seq: (m.last.seq + 1) & 0xffff, t: now, x: s.x, y: s.y, z: s.z, yaw: s.yaw, pitch: s.pitch, roll: s.roll, mode: s.mode, clip: s.clip, speed: s.speed, flags: 0}, now, {a, facts: f, terrain, sig: null});
            if (v.kind === "reject") {
                rejects++;
                s = {...s, x: m.last.x, y: m.last.y, z: m.last.z, mode: m.last.mode, speed: 0};
            } else if (v.kind === "accept") accepted++;
            modes.add(s.mode);
        }
    }
    return {rejects, accepted, last: m.last, modes};
}

const dirOf = (angle: number) => ({dirX: Math.sin(angle), dirZ: Math.cos(angle), amount: 1});

test("mover: a fox wandering, running and sprinting for a minute is never corrected; the wall stops it", () => {
    const r = drive("red-fox", start(-10, -30), 60, (t) => ({...dirOf(t * 0.4), run: t % 10 > 5, sprint: t % 20 > 18}));
    assert.equal(r.rejects, 0);
    assert.ok(r.accepted > 500);
    const wall = drive("red-fox", start(-4, 0, "ground", 0.5, Math.PI / 2), 6, () => ({...dirOf(Math.PI / 2), run: true}));
    assert.equal(wall.rejects, 0);
    assert.ok(wall.last.x < 0, "the wall stopped it");
});

test("mover: an eagle takes off, flies, glides, banks and lands without a correction", () => {
    const r = drive("golden-eagle", start(-10, -30), 40, (t) => ({...dirOf(t * 0.3), takeoff: t > 0.5 && t < 0.55, vertical: t < 8 ? 1 : t > 30 ? -1 : 0, flap: t < 10, land: t > 35}), {zone: "mountains"});
    assert.equal(r.rejects, 0);
    assert.ok(r.modes.has("air") && r.modes.has("ground"), [...r.modes].join(","));
});

test("mover: a salmon swims the sea and turns back at the shore; a duck walks in, paddles and dives", () => {
    const fish = drive("atlantic-salmon", start(40, 0, "swim", -2, -Math.PI / 2), 20, () => ({...dirOf(-Math.PI / 2), vertical: 0.2}), {zone: "open_ocean"});
    assert.equal(fish.rejects, 0);
    assert.ok(fish.last.x > 30, "still in the sea");
    const duck = drive("mallard", start(26, 5, "ground", 0.5, Math.PI / 2), 30, (t) => ({...dirOf(Math.PI / 2), vertical: t > 15 && t < 17 ? -1 : 0}), {zone: "river_lake"});
    assert.equal(duck.rejects, 0);
    assert.ok(duck.modes.has("paddle"), [...duck.modes].join(","));
});

test("mover: a mole digs in and comes up; a gibbon climbs the tree", () => {
    const mole = drive("american-badger", start(-10, -30), 10, (t) => ({...dirOf(0), amount: t > 2 && t < 6 ? 1 : 0, dig: (t > 1 && t < 1.02) || (t > 7 && t < 7.02)}));
    assert.equal(mole.rejects, 0);
    assert.ok(mole.modes.has("burrow"));
    const gibbon = drive("lar-gibbon", start(4.5, -19.5, "ground", 0.5, Math.PI / 2), 8, (t) => ({climb: t > 0.5 && t < 0.52, vertical: t > 1 && t < 5 ? 1 : t > 5 ? -1 : 0}), {zone: "rainforest"});
    assert.equal(gibbon.rejects, 0);
    assert.ok(gibbon.modes.has("climb"));
});
