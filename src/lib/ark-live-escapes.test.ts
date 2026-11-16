import assert from "node:assert/strict";
import test from "node:test";
import type {ActBody, ActPose, ChaseKind, FleeStyle} from "@/ark-scene/acts";
import {LIMP_PACE, LIMP_SECONDS, LiveEscapes, escapePose, escapeScript, limpAmount, limpOffsets, missGap, type EscapeChase, type LiveEscapesHost} from "@/ark-scene/live-escapes";

const body = (x: number, z: number, length: number, speedStat: number, base = 0): ActBody => ({x, z, base, yaw: 0, length, height: length * 0.6, speedStat});
const chase = (kind: EscapeChase["kind"], flee: FleeStyle, predator: ActBody, prey: ActBody, seed: string, extra: Partial<EscapeChase> = {}): EscapeChase => ({kind, flee, predator, prey, seed, ground: () => 0, ...extra});

/** The two bodies' middles' distance at a time, from the poses the scene draws. */
function gapAt(script: ReturnType<typeof escapeScript>, s: number): number {
    const p = escapePose(script, "predator", s);
    const q = escapePose(script, "prey", s);
    return Math.hypot(p.x - q.x, p.z - q.z, p.base - q.base);
}

test("an escape is never drawn as a catch: the gap holds for every kind, pace and seed", () => {
    const kinds: Array<[EscapeChase["kind"], FleeStyle]> = [["glide", "run"], ["glide", "bound"], ["glide", "fly"], ["glide", "still"], ["bound", "run"], ["slither", "run"], ["slither", "bound"], ["dart", "swim"], ["swoop", "run"], ["swoop", "fly"], ["swoop", "still"], ["swoop", "swim"]];
    const sizes: Array<[number, number, number, number]> = [[2, 2.4, 80, 70], [2, 2.4, 20, 95], [0.6, 0.12, 60, 30], [0.3, 1.8, 95, 10], [3.5, 0.2, 40, 90], [1, 1, 50, 50]];
    let scripts = 0;
    for (const [kind, flee] of kinds) {
        for (const [lp, lq, sp, sq] of sizes) {
            for (let n = 0; n < 6; n++) {
                const distance = [0.2, 4, 12, 22, 38, 70][n];
                const water = kind === "dart" || flee === "swim";
                const predator = body(10, 5, lp, sp, kind === "dart" ? -0.6 : kind === "swoop" && n % 2 ? 9 : 0);
                const prey = body(10 + distance * Math.sin(n), 5 + distance * Math.cos(n), lq, sq, water ? -0.5 : 0);
                const script = escapeScript(chase(kind, flee, predator, prey, `seed-${kind}-${flee}-${lp}-${n}`, {exact: n % 2 === 0}));
                scripts++;
                assert.ok(script.closest >= script.gap, `${kind}/${flee} ${lp}>${lq} at ${distance} m: closest ${script.closest} under the gap ${script.gap}`);
                assert.equal(script.gap, missGap(lp, lq));
                assert.ok(script.seconds > 2 && script.seconds <= 30.1, `${kind}/${flee}: ${script.seconds} s`);
                assert.ok(script.missAt > 0 && script.missAt < script.seconds);
                // The drawn poses (between the samples too) keep it, and every number is finite.
                for (let s = 0; s <= script.seconds; s += 0.031) {
                    assert.ok(gapAt(script, s) >= script.gap, `${kind}/${flee} ${lp}>${lq} at ${distance} m, +${s.toFixed(2)} s: ${gapAt(script, s)} < ${script.gap}`);
                    for (const who of ["predator", "prey"] as const) {
                        const pose = escapePose(script, who, s);
                        assert.ok([pose.x, pose.z, pose.base, pose.yaw, pose.pitch, pose.speed].every((v) => Number.isFinite(v)), `${kind}/${flee} ${who} +${s.toFixed(2)}`);
                        assert.equal(pose.hidden, false);
                        assert.equal(pose.scale, 1);
                        assert.notEqual(pose.state, "eat");
                    }
                }
            }
        }
    }
    assert.equal(scripts, kinds.length * sizes.length * 6);
});

test("a lion's miss on a zebra: it stalks, rushes and closes to a near miss; the zebra bolts, gets clear and stops", () => {
    const lion = body(0, 0, 2, 80);
    const zebra = body(0, 22, 2.4, 70);
    const script = escapeScript(chase("glide", "run", lion, zebra, "zebra#2026-11-20", {exact: true}));
    const states = (who: "predator" | "prey") => {
        const out: string[] = [];
        for (let s = 0; s < script.seconds; s += 1 / 30) {
            const state = escapePose(script, who, s).state!;
            if (out[out.length - 1] !== state) out.push(state);
        }
        return out;
    };
    assert.deepEqual(states("predator").filter((s) => s !== "freeze"), ["stalk", "run", "leap", "run", "scan"]);
    assert.deepEqual(states("prey"), ["rest", "scan", "run", "scan"]);
    // A near miss: within a body length of the least gap at its closest, at the lunge.
    assert.ok(script.closest < script.gap + 2, `closest ${script.closest}, gap ${script.gap}`);
    assert.ok(gapAt(script, script.missAt) < script.gap + 2.5);
    // The zebra gets clear: far from it at the end, and both stand.
    const end = script.seconds - 0.02;
    assert.ok(gapAt(script, end) > 12, `apart at the end: ${gapAt(script, end)}`);
    assert.ok(escapePose(script, "prey", end).speed! < 0.1 && escapePose(script, "predator", end).speed! < 0.1);
    // The same for every viewer.
    const again = escapeScript(chase("glide", "run", lion, zebra, "zebra#2026-11-20", {exact: true}));
    assert.deepEqual(escapePose(again, "prey", 7.3), escapePose(script, "prey", 7.3));
    assert.notDeepEqual(escapePose(escapeScript(chase("glide", "run", lion, zebra, "another", {exact: true})), "prey", script.missAt + 1), escapePose(script, "prey", script.missAt + 1));
});

test("a raptor's stoop misses: it pulls out over empty ground and climbs; a shell is nosed at and left", () => {
    const hawk = body(0, 0, 0.55, 80, 0);
    const vole = body(0, 15, 0.12, 40);
    const script = escapeScript(chase("swoop", "run", hawk, vole, "vole"));
    const low = escapePose(script, "predator", script.missAt);
    assert.ok(low.base < 0.5 && low.base > 0, `its feet come down to ${low.base}`);
    assert.ok(Math.hypot(low.x - escapePose(script, "prey", script.missAt).x, low.z - escapePose(script, "prey", script.missAt).z) > script.gap, "the vole is gone from under it");
    assert.ok(escapePose(script, "predator", script.seconds - 0.05).base > 4, "it climbs away");
    const fox = body(0, 0, 0.9, 60);
    const tortoise = body(0, 6, 0.25, 5);
    const shell = escapeScript(chase("glide", "still", fox, tortoise, "tortoise"));
    const q0 = escapePose(shell, "prey", 0);
    const q1 = escapePose(shell, "prey", shell.seconds - 0.05);
    assert.ok(Math.hypot(q1.x - q0.x, q1.z - q0.z) < 1e-9, "it does not run");
    assert.equal(q1.state, "freeze");
    assert.ok(gapAt(shell, shell.missAt) < shell.gap * 1.2);
});

test("the limp: an uneven hitch for a while after the escape, pure in the time, easing off", () => {
    assert.equal(limpAmount(-1), 0);
    assert.equal(limpAmount(0), 1);
    assert.equal(limpAmount(LIMP_SECONDS * 0.6), 1);
    assert.ok(limpAmount(LIMP_SECONDS * 0.85) > 0 && limpAmount(LIMP_SECONDS * 0.85) < 1);
    assert.equal(limpAmount(LIMP_SECONDS), 0);
    const out = {drop: 0, roll: 0, pitch: 0};
    assert.equal(limpOffsets("e1", LIMP_SECONDS + 1, true, 2, out), false);
    assert.deepEqual(out, {drop: 0, roll: 0, pitch: 0});
    // Standing: a lean off the leg, no bob.
    assert.equal(limpOffsets("e1", 100, false, 2, out), true);
    assert.ok(out.drop === 0 && Math.abs(out.roll) > 0.02 && Math.abs(out.roll) < 0.05);
    // Moving: a dip once a stride that takes up a third of it (uneven), bounded, the same side every stride.
    let dipping = 0;
    let n = 0;
    let maxDrop = 0;
    let maxRoll = 0;
    const sides = new Set<number>();
    for (let s = 60; s < 90; s += 0.01) {
        limpOffsets("e1", s, true, 2, out);
        n++;
        if (out.drop > 1e-4) {
            dipping++;
            sides.add(Math.sign(out.roll));
        }
        assert.ok(out.drop >= 0);
        maxDrop = Math.max(maxDrop, out.drop);
        maxRoll = Math.max(maxRoll, Math.abs(out.roll));
    }
    assert.ok(dipping / n > 0.25 && dipping / n < 0.4, `dipping ${dipping / n} of the time`);
    assert.equal(sides.size, 1);
    assert.ok(maxDrop > 0.08 && maxDrop <= 0.16, `drop ${maxDrop}`);
    assert.ok(maxRoll > 0.08 && maxRoll <= 0.12, `roll ${maxRoll}`);
    // Pure: the same numbers again; a small body dips less.
    const a = {drop: 0, roll: 0, pitch: 0};
    const b = {drop: 0, roll: 0, pitch: 0};
    limpOffsets("e1", 77.7, true, 2, a);
    limpOffsets("e1", 77.7, true, 2, b);
    assert.deepEqual(a, b);
    let small = 0;
    for (let s = 60; s < 62; s += 0.01) {
        limpOffsets("e1", s, true, 0.1, out);
        small = Math.max(small, out.drop);
    }
    assert.ok(small > 0 && small < 0.01);
});

type Fake = {id: string; act: ActPose | null; busy: boolean; home: {x: number; z: number}};
/** (Read afresh: a step changes it behind the type checker's back.) */
const actOf = (f: Fake): ActPose | null => f.act;

function stage(kind: ChaseKind = "glide") {
    const lion: Fake = {id: "lion", act: null, busy: false, home: {x: 0, z: 0}};
    const zebra: Fake = {id: "zebra", act: null, busy: false, home: {x: 0, z: 22}};
    const all = new Map([[lion.id, lion], [zebra.id, zebra]]);
    const host: LiveEscapesHost<Fake> = {
        find: (id) => all.get(id) ?? null,
        chase: (act) => (kind === "cutaway" ? null : chase(kind as EscapeChase["kind"], "run", body(0, 0, 2, 80), body(0, 22, 2.4, 70), act.key, {exact: true})),
        scheduleAt: (entry) => ({x: entry.home.x, z: entry.home.z, y: 0, yaw: 0, aloft: false}),
        ground: () => 0,
        walk: () => 1.2,
        flies: () => false,
        setAct: (entry, pose) => {
            entry.act = pose;
        },
        busy: (entry) => entry.busy
    };
    return {lion, zebra, live: new LiveEscapes<Fake>(host)};
}

test("the record's escape on the stage: the chase, the walk back at a limping pace, then the limp alone", () => {
    const {lion, zebra, live} = stage();
    const t0 = 1_000_000;
    live.add([{key: "escaped:1", prey: "zebra", predator: "lion", t0}], t0 - 5);
    live.add([{key: "escaped:1", prey: "zebra", predator: "lion", t0}], t0 - 5);
    assert.equal(live.size, 1);
    live.step(t0 - 1);
    assert.equal(actOf(lion), null);
    assert.deepEqual(live.pins(), []);
    live.step(t0 + 0.5);
    assert.equal(actOf(lion)?.role, "hunter");
    assert.equal(actOf(lion)?.meal, "hunting");
    assert.equal(actOf(lion)?.with, "zebra");
    assert.equal(actOf(zebra)?.role, "quarry");
    assert.equal(actOf(zebra)?.meal, undefined);
    assert.deepEqual(live.pins().sort(), ["lion", "zebra"]);
    const info = live.debug()[0];
    assert.equal(info.phase, "acting");
    assert.ok(info.closest! >= info.gap!);
    // After the chase both walk back; the zebra's walk takes longer (its pace is capped).
    const seconds = info.seconds!;
    live.step(t0 + seconds + 1);
    assert.equal(actOf(zebra)?.state, "walk");
    assert.equal(actOf(zebra)?.role, undefined);
    assert.ok(LIMP_PACE < 1);
    let lionBack = 0;
    let zebraBack = 0;
    for (let s = seconds; s < seconds + 60; s += 0.5) {
        live.step(t0 + s);
        if (actOf(lion)) lionBack = s;
        if (actOf(zebra)) zebraBack = s;
    }
    assert.ok(zebraBack > 0 && lionBack > 0);
    assert.equal(actOf(lion), null);
    assert.equal(actOf(zebra), null);
    assert.deepEqual(live.pins(), []);
    assert.equal(live.debug()[0].phase, "limping");
    // The limp is the prey's alone, for LIMP_SECONDS from the event.
    const out = {drop: 0, roll: 0, pitch: 0};
    assert.equal(live.limp("zebra", t0 + 200, true, 2.4, out), true);
    assert.equal(live.limp("lion", t0 + 200, true, 2, out), false);
    assert.equal(live.limp("zebra", t0 + LIMP_SECONDS + 1, true, 2.4, out), false);
    live.step(t0 + LIMP_SECONDS + 2);
    assert.equal(live.size, 0);
});

test("an escape read late acts nothing but the limp; a busy animal is left alone; a cut-away kind only limps", () => {
    const late = stage();
    const t0 = 2_000_000;
    late.live.add([{key: "escaped:2", prey: "zebra", predator: "lion", t0}], t0 + 600);
    late.live.step(t0 + 600);
    assert.equal(actOf(late.zebra), null);
    assert.equal(actOf(late.lion), null);
    const out = {drop: 0, roll: 0, pitch: 0};
    assert.equal(late.live.limp("zebra", t0 + 600, true, 2.4, out), true);
    // (Long over: not even kept.)
    late.live.add([{key: "escaped:3", prey: "zebra", predator: "lion", t0: t0 - LIMP_SECONDS - 700}], t0 + 600);
    assert.equal(late.live.size, 1);

    const held = stage();
    held.lion.busy = true;
    held.live.add([{key: "escaped:4", prey: "zebra", predator: "lion", t0}], t0);
    held.live.step(t0 + 1);
    assert.equal(actOf(held.lion), null);
    assert.equal(actOf(held.zebra)?.role, "quarry");
    held.live.clear();
    assert.equal(actOf(held.zebra), null);

    const cut = stage("cutaway");
    cut.live.add([{key: "escaped:5", prey: "zebra", predator: "lion", t0}], t0);
    cut.live.step(t0 + 1);
    assert.equal(actOf(cut.zebra), null);
    assert.equal(cut.live.debug()[0].phase, "limp only");
    assert.equal(cut.live.limp("zebra", t0 + 30, false, 2.4, out), true);
});

test("the rows' escapes for the scene: who got away from whom, when, and the server's geometry", async () => {
    const {escapeActs} = await import("@/ark-scene/live/escape-lines");
    const encounter = {t: 1795165260, step: 4, predator: {x: 1, z: 2}, prey: {x: 9, z: 9, r: 3}, d: 10.6};
    const raw = {events: [
        {id: 7, kind: "escaped", at: "2026-11-20T10:00:00Z", animal: {id: "zebra", name: "Plains Zebra"}, other: {id: "lion", name: "African Lion"}, encounter},
        {id: 8, kind: "meal", at: "2026-11-20T10:01:00Z", animal: {id: "lion"}, other: {id: "zebra"}},
        {id: 9, kind: "escaped", at: "2026-11-20T10:02:00Z", animal: {id: "hare"}, other: null},
        {id: 10, kind: "escaped", at: "2026-11-20T09:00:00Z", animal: {id: "vole"}, other: {id: "owl"}, payload: {encounter}}
    ]};
    assert.deepEqual(escapeActs(raw, Date.parse("2026-11-20T09:30:00Z")), [{key: "escaped:7", prey: "zebra", predator: "lion", t0: Date.parse("2026-11-20T10:00:00Z") / 1000, encounter}]);
    assert.deepEqual(escapeActs(raw, -Infinity).map((a) => a.key), ["escaped:7", "escaped:10"]);
    assert.equal(escapeActs(raw, -Infinity)[1].encounter, encounter);
    assert.deepEqual(escapeActs(null, -Infinity), []);
});
