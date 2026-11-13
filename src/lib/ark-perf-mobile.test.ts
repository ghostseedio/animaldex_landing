/**
 * The mobile performance lane (docs/ark/perf-audit-mobile-2026-11.md): the frame pacing, the start tier's benchmark,
 * a read of the Ark that changes nothing, and the collisions' memo giving exactly the answers it saves.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {ArkFramePacer, PACE_LOCK_MS, SCALE_FLOOR, SLOW_CPU_MS, tierForCpu} from "@/ark-scene/runtime/pace";
import {sameArkRead, sameJson} from "@/ark-scene/runtime/same";
import {ColliderSet} from "@/ark-scene/collide/colliders";
import {CollideLayer} from "@/ark-scene/collide/layer";
import type {ResolveBody, ResolvePose} from "@/ark-scene/collide/resolve";

/**
 * A device for the pacer: each frame's script work (ms) and its GPU's time at full resolution (ms, going with the pixels:
 * the scale squared); a frame's interval is the longest of the two, the display's 16.7 ms and the pacing's lock.
 */
function simulate(pacer: ArkFramePacer, from: number, seconds: number, work: number, gpuFull: number, settled = true) {
    const decisions: Array<{t: number; interval: number; scale: number; dropTier: boolean}> = [];
    let t = from;
    let lockedFor = 0;
    while (t < from + seconds) {
        const interval = Math.max(pacer.interval, work, gpuFull * pacer.resolution ** 2, 1000 / 60);
        t += interval / 1000;
        if (pacer.interval > 0) lockedFor += interval / 1000;
        const decision = pacer.step(t, interval, work, true, settled);
        if (decision.changed) decisions.push({t, interval: decision.interval, scale: decision.scale, dropTier: decision.dropTier});
    }
    return {t, decisions, lockedShare: lockedFor / seconds};
}

test("pacing: a phone that holds 60 stays at 60 and full resolution", () => {
    const pacer = new ArkFramePacer("medium", 0);
    assert.equal(simulate(pacer, 0, 60, 9, 12).decisions.length, 0);
    assert.equal(pacer.interval, 0);
    assert.equal(pacer.resolution, 1);
});

test("pacing: script-bound frames that cannot hold 60 lock to a steady 30, resolution untouched", () => {
    const pacer = new ArkFramePacer("medium", 0);
    const {decisions} = simulate(pacer, 0, 30, 24, 10, false);
    assert.equal(decisions.length, 1, JSON.stringify(decisions));
    assert.equal(pacer.interval, PACE_LOCK_MS);
    assert.equal(pacer.resolution, 1);
});

test("pacing: GPU-bound frames give up a step of resolution and hold 60 there, with no bouncing", () => {
    const pacer = new ArkFramePacer("medium", 0);
    const {decisions} = simulate(pacer, 0, 80, 6, 21);
    assert.equal(pacer.interval, 0, JSON.stringify(decisions));
    assert.equal(pacer.resolution, 0.9);
    assert.ok(decisions.every((d) => d.t < 10 && d.scale >= SCALE_FLOOR && !d.dropTier), JSON.stringify(decisions));
});

test("pacing: a GPU too slow for 60 even at the floor holds a steady 30; its tries at 60 grow rarer", () => {
    const pacer = new ArkFramePacer("medium", 0);
    const {decisions, lockedShare} = simulate(pacer, 0, 400, 6, 40);
    assert.ok(lockedShare > 0.9, `locked ${Math.round(lockedShare * 100)}% of the time`);
    // (A try: from the lock to the display's rate; the resolution steps that follow it at 60 are part of the same try.)
    const tries = decisions.filter((d, i) => d.interval === 0 && (i === 0 ? false : decisions[i - 1].interval > 0)).map((d) => d.t);
    const gaps = tries.slice(1).map((t, i) => t - tries[i]);
    assert.ok(gaps.every((gap, i) => i === 0 || gap >= gaps[i - 1] - 1), JSON.stringify(gaps));
    assert.ok(tries.length <= 6, `${tries.length} tries in 400 s`);
    assert.ok(decisions.every((d) => d.scale >= SCALE_FLOOR && !d.dropTier));
});

test("pacing: back to 60 once the frames are light again, and it stays there", () => {
    const pacer = new ArkFramePacer("medium", 0);
    simulate(pacer, 0, 10, 24, 10, false);
    assert.equal(pacer.interval, PACE_LOCK_MS);
    // Still heavy (and the start not over): no try, however long.
    const heavy = simulate(pacer, 10, 60, 24, 10, false);
    assert.equal(heavy.decisions.length, 0);
    const light = simulate(pacer, heavy.t, 60, 5, 10, false);
    assert.equal(pacer.interval, 0);
    assert.equal(light.decisions.length, 1, JSON.stringify(light.decisions));
});

test("pacing: a slow phone's low tier starts locked at 30; a tier drops only once settled and still not holding 30", () => {
    assert.equal(new ArkFramePacer("low", 0, true).interval, PACE_LOCK_MS);
    assert.equal(new ArkFramePacer("low", 0, false).interval, 0);
    const early = new ArkFramePacer("medium", 0);
    assert.ok(simulate(early, 0, 30, 45, 10, false).decisions.every((d) => !d.dropTier), "never during the start");
    const late = new ArkFramePacer("medium", 0);
    const drops = simulate(late, 0, 40, 45, 10, true).decisions.filter((d) => d.dropTier);
    assert.equal(drops.length, 1);
});

test("pacing: locked at 30 by the script's own work, once settled, a phone trades a tier for the display's rate", () => {
    const pacer = new ArkFramePacer("medium", 0);
    const before = simulate(pacer, 0, 60, 22, 8, false);
    assert.ok(before.decisions.every((d) => !d.dropTier), "not during the start");
    const after = simulate(pacer, before.t, 30, 22, 8, true);
    assert.equal(after.decisions.filter((d) => d.dropTier).length, 1, JSON.stringify(after.decisions));
});

test("the start tier: a slow main thread starts a touch device on the low tier, never raises one", () => {
    assert.equal(tierForCpu("medium", SLOW_CPU_MS + 1), "low");
    assert.equal(tierForCpu("medium", SLOW_CPU_MS - 1), "medium");
    assert.equal(tierForCpu("low", 1), "low");
    assert.equal(tierForCpu("high", SLOW_CPU_MS * 2), "low");
});

test("a read of the Ark that changes nothing laid out: the same but for its time, within the day's tolerance", () => {
    assert.ok(sameJson({a: [1, {b: null}], c: "x"}, {c: "x", a: [1, {b: null}]}));
    assert.ok(!sameJson({a: [1, 2]}, {a: [1, 2, 3]}));
    assert.ok(!sameJson({a: 1}, {a: 1, b: undefined}));
    assert.ok(!sameJson({a: 1}, {a: "1"}));
    const animals = [{id: "x", zone: "forest", thrive: {hunger: 0.4}}];
    const laid = {as_of: "2026-11-13T10:00:00Z", ark_day: 90.1, animals, voyage: {slug: "first"}};
    // A later read of the same Ark: its time and day moved together (the day carried forward is the same).
    const later = {as_of: "2026-11-13T10:00:45Z", ark_day: 90.1 + 45_000 / ((86_400_000 * 14) / 365), animals: JSON.parse(JSON.stringify(animals)), voyage: {slug: "first"}};
    assert.ok(sameArkRead(laid, later));
    // Anything about an animal changed: a new read.
    assert.ok(!sameArkRead(laid, {...later, animals: [{id: "x", zone: "forest", thrive: {hunger: 0.5}}]}));
    // The day moved on past the tolerance: a new read (the young's ages, the nests).
    assert.ok(!sameArkRead(laid, {...later, ark_day: 90.2}));
    // The day stood still while its time moved on by more than the tolerance: a new read too (the props carry it forward).
    assert.ok(!sameArkRead(laid, {...later, ark_day: 90.1, as_of: "2026-11-13T10:10:00Z"}));
});

test("the collisions' memo: the same answers as working each out afresh, moment after moment", () => {
    const set = new ColliderSet([
        {shape: "circle", kind: "trunk", id: "t1", cx: 0, cz: 0, r: 0.5, reach: 0.5, y0: -1, y1: 5, gap: 0},
        {shape: "circle", kind: "trunk", id: "t2", cx: 1.05, cz: 0, r: 0.5, reach: 0.5, y0: -1, y1: 5, gap: 0}
    ], "memo-test");
    type E = {id: string; body: ResolveBody; pose: (epoch: number) => ResolvePose};
    // One wedged between two trunks at rest (the ring search), one walking past, one at rest beside it.
    const animals: E[] = [
        {id: "wedged", body: {id: "wedged", radius: 0.3, half: 0.2, height: 1}, pose: () => ({x: 0.52, y: 0, z: 0, yaw: 0.3, aloft: false})},
        {id: "walker", body: {id: "walker", radius: 0.25, half: 0.3, height: 1}, pose: (epoch) => ({x: -2 + (epoch % 20) * 0.2, y: 0, z: 0.9, yaw: Math.PI / 2, aloft: false})},
        {id: "rester", body: {id: "rester", radius: 0.25, half: 0.3, height: 1}, pose: () => ({x: 0.4, y: 0, z: 1.2, yaw: 0, aloft: false, still: true})}
    ];
    // Two layers fed the same: one keeping its memo, one made to forget it before every answer (each way out of the
    // trunks worked out afresh). Their answers must be the same, to the last bit.
    const layer = (forget: boolean) => {
        const last = new Map<E, {x: number; z: number; at: number}>();
        const l = new CollideLayer<E>({
            colliders: () => set,
            body: (e) => e.body,
            base: (e, epoch) => e.pose(epoch),
            everyone: () => animals,
            last: (e) => last.get(e) ?? null,
            speed: () => 1
        });
        return (e: E, epoch: number) => {
            // (Only the memo forgotten: everything else the layer keeps, as the scene's does.)
            if (forget) (l as unknown as {outMemo: WeakMap<object, unknown>}).outMemo = new WeakMap();
            const out = l.apply(e, epoch, e.pose(epoch));
            last.set(e, {x: out.x, z: out.z, at: epoch});
            return out;
        };
    };
    const kept = layer(false);
    const afresh = layer(true);
    for (let k = 0; k < 120; k++) {
        const epoch = 1_000_000 + k * 0.25;
        for (const e of animals) assert.deepEqual(kept(e, epoch), afresh(e, epoch), `${e.id} at ${epoch}`);
    }
});
