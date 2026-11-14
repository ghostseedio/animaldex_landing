/**
 * The mobile performance lane (docs/ark/perf-audit-mobile-2026-11.md): the frame pacing, the start tier's benchmark,
 * a read of the Ark that changes nothing, and the collisions' memo giving exactly the answers it saves.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {ArkFramePacer, PACE_LOCK_MS, SCALE_FLOOR, SLOW_CPU_MS, tierForCpu} from "@/ark-scene/runtime/pace";
import {sameArkPush, sameArkRead, sameJson, sameJsonSliced} from "@/ark-scene/runtime/same";
import {ColliderSet} from "@/ark-scene/collide/colliders";
import {CollideLayer} from "@/ark-scene/collide/layer";
import type {ResolveBody, ResolvePose} from "@/ark-scene/collide/resolve";
import {BackSide, BoxGeometry, DoubleSide, FrontSide, Group, Mesh, MeshStandardMaterial} from "three";
import {splitTwoSided} from "@/ark-scene/runtime/two-sided";

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

test("pacing: script-bound frames that cannot hold 60 lock to a steady 30, resolution untouched, tries rarer each time", () => {
    const pacer = new ArkFramePacer("medium", 0);
    const {decisions, lockedShare} = simulate(pacer, 0, 120, 24, 10, false);
    assert.equal(decisions[0].interval, PACE_LOCK_MS);
    assert.equal(pacer.interval, PACE_LOCK_MS);
    assert.equal(pacer.resolution, 1);
    assert.ok(lockedShare > 0.9, `locked ${Math.round(lockedShare * 100)}%`);
    assert.ok(decisions.length <= 10, JSON.stringify(decisions));
});

test("pacing: a jittery rate (a third of the frames missing 60) locks to a steady 30, though the median is on time", () => {
    const pacer = new ArkFramePacer("medium", 0);
    let t = 0;
    let locked = false;
    for (let k = 0; k < 400 && !locked; k++) {
        const interval = pacer.interval || (k % 3 === 0 ? 33.4 : 16.7);
        t += interval / 1000;
        locked = pacer.step(t, interval, 14, true, false).interval > 0;
    }
    assert.ok(locked);
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

test("pacing: a scale found too high again and again is tried again more and more rarely (no soften and sharpen every 90 s for good)", () => {
    // (A GPU that holds 60 at 0.8 of the resolution and not at 0.9: 21.5 ms a frame at full resolution.)
    const pacer = new ArkFramePacer("medium", 0);
    const {decisions} = simulate(pacer, 0, 1200, 6, 21.5);
    assert.equal(pacer.interval, 0);
    // Each try at 0.9 is a step up and a step back down: when each began.
    const ups = decisions.filter((d, i) => i > 0 && d.scale > decisions[i - 1].scale).map((d) => Math.round(d.t));
    const gaps = ups.slice(1).map((t, i) => t - ups[i]);
    assert.ok(ups.length >= 2 && ups.length <= 4, `${ups.length} tries in 20 minutes: ${JSON.stringify(ups)}`);
    assert.ok(gaps.every((gap, i) => i === 0 || gap > gaps[i - 1] * 1.5), JSON.stringify(gaps));
    assert.ok(decisions.every((d) => d.scale >= 0.8 - 1e-9 && !d.dropTier), JSON.stringify(decisions));
});

test("pacing: a try at 60 the GPU cannot hold at any resolution is one step down and one back, not a climb of tenths", () => {
    const pacer = new ArkFramePacer("medium", 0);
    const {decisions} = simulate(pacer, 0, 600, 6, 40);
    // After the first minute (the first descent and the settling at 30), every change of resolution belongs to a try:
    // down to the floor as it begins, back to where the steady 30 was as it fails.
    const later = decisions.filter((d) => d.t > 60);
    const scales = later.map((d, i) => (i === 0 ? null : d.scale - later[i - 1].scale)).filter((v): v is number => v !== null && Math.abs(v) > 1e-9);
    const small = scales.filter((v) => Math.abs(v) < 0.15).length;
    // (The steady 30's own ceiling, 0.9 against 1, is tried again now and then: a tenth up, a tenth down.)
    assert.ok(small <= 6, `${small} single-tenth steps after the first minute: ${JSON.stringify(later.map((d) => [Math.round(d.t), d.scale, d.interval > 0 ? 30 : 60]))}`);
    assert.ok(later.filter((d) => d.interval === 0).length <= 4, "tries at 60 after the first minute");
    assert.ok(decisions.every((d) => d.scale >= SCALE_FLOOR - 1e-9 && !d.dropTier));
});

test("pacing: sporadic late frames with short work (a collection, another task) lock the rate but never cost resolution", () => {
    const pacer = new ArkFramePacer("medium", 0);
    let t = 0;
    for (let k = 0; k < 3000; k++) {
        const interval = Math.max(pacer.interval, k % 3 === 0 ? 45 : 16.7);
        t += interval / 1000;
        pacer.step(t, interval, 6, true, false);
    }
    assert.equal(pacer.resolution, 1);
});

test("pacing: the start is forgotten when it ends: a phone locked by it is back at 60 within seconds, and stays", () => {
    const pacer = new ArkFramePacer("medium", 0);
    // The start: the world being built, 24 ms of work a frame.
    const start = simulate(pacer, 0, 40, 24, 10, false);
    assert.equal(pacer.interval, PACE_LOCK_MS);
    // Over: 12 ms a frame, which holds 60.
    const after = simulate(pacer, start.t, 60, 12, 10, true);
    assert.equal(pacer.interval, 0, JSON.stringify(after.decisions));
    const back = after.decisions.find((d) => d.interval === 0);
    assert.ok(back && back.t - start.t < 5, `back at 60 after ${back ? (back.t - start.t).toFixed(1) : "never"} s`);
    assert.ok(after.decisions.every((d) => !d.dropTier));
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

test("pacing: time away (the panel covered, the page hidden) is not time locked: no tier lost on coming back", () => {
    // A phone the script holds at 30 on the medium tier (20 ms a frame), settled. Covered after 8 s for a minute.
    const away = (resumed: boolean) => {
        const pacer = new ArkFramePacer("medium", 0);
        const before = simulate(pacer, 0, 8, 20, 6);
        assert.ok(pacer.interval > 0 && before.decisions.every((d) => !d.dropTier));
        if (resumed) pacer.resume(68);
        // (The first three seconds back.)
        return simulate(pacer, 68, 3, 20, 6).decisions.some((d) => d.dropTier);
    };
    assert.equal(away(false), true, "as it was: the minute away counted as a minute locked");
    assert.equal(away(true), false);
    // It still trades the tier for the display's rate once it has really been locked that long.
    const pacer = new ArkFramePacer("medium", 0);
    simulate(pacer, 0, 8, 20, 6);
    pacer.resume(68);
    assert.ok(simulate(pacer, 68, 30, 20, 6).decisions.some((d) => d.dropTier));
});

test("pacing: the low tier on a dense screen earns resolution above its own only with frames to spare, once settled", () => {
    // Top 1 (every other tier, a 1× screen, battery saver): never above 1, whatever the frames.
    const plain = new ArkFramePacer("low", 0, false);
    simulate(plain, 0, 120, 8, 4);
    assert.equal(plain.resolution, 1);
    // A phone with frames to spare: nothing during the start, then 1.25 and 1.5, two changes in all.
    const spare = new ArkFramePacer("low", 0, false);
    spare.setTop(1.5, 0);
    assert.equal(simulate(spare, 0, 30, 8, 4, false).decisions.length, 0);
    const earned = simulate(spare, 30, 120, 8, 4).decisions.map((d) => d.scale);
    assert.deepEqual(earned, [1.25, 1.5]);
    assert.equal(spare.interval, 0);
    // A GPU that holds 60 at 1 and not at 1.25: one try, taken back within seconds, not tried again for minutes.
    const tight = new ArkFramePacer("low", 0, false);
    tight.setTop(1.5, 0);
    const tried = simulate(tight, 0, 300, 8, 13);
    assert.deepEqual(tried.decisions.map((d) => d.scale), [1.25, 1]);
    assert.ok(tried.decisions[1].t - tried.decisions[0].t < 4, JSON.stringify(tried.decisions));
    assert.equal(tight.interval, 0);
    // A slow main thread locked at 30 with an idle GPU: the sharper picture at the same 30, and its tries at 60 (the
    // script's to fail) cost no resolution.
    const slow = new ArkFramePacer("low", 0, true);
    slow.setTop(1.5, 0);
    const steady = simulate(slow, 0, 300, 24, 4);
    assert.equal(slow.resolution, 1.5);
    assert.deepEqual(Array.from(new Set(steady.decisions.map((d) => d.scale))), [1, 1.25, 1.5]);
    // Locked at 30 by the script and the GPU full at 1.5: the bonus is given back though the work is long.
    const full = new ArkFramePacer("low", 0, true);
    full.setTop(1.5, 0);
    simulate(full, 0, 200, 24, 20);
    assert.equal(full.resolution, 1.25);
    // The top lowered (battery saver, another tier): down to it at once.
    slow.setTop(1, 301);
    assert.equal(slow.resolution, 1);
});

test("pacing: a tier on trial must hold the display's rate: a GPU that misses it at every resolution goes down the tier, once", () => {
    // A device that said what it is: left on the medium tier at a steady 30 (the GPU holds that).
    const declared = new ArkFramePacer("medium", 0);
    assert.equal(simulate(declared, 0, 120, 7, 40).decisions.filter((d) => d.dropTier).length, 0);
    assert.equal(declared.interval, PACE_LOCK_MS);
    // The same device with the tier on trial: resolution given up first, then the rate, then, 15 s on, the tier.
    const trial = new ArkFramePacer("medium", 0);
    trial.trial = true;
    const {decisions} = simulate(trial, 0, 120, 7, 40);
    const drops = decisions.filter((d) => d.dropTier);
    assert.equal(drops.length, 1);
    assert.ok(drops[0].t > 15 && drops[0].t < 45, JSON.stringify(drops));
    assert.ok(decisions.findIndex((d) => d.scale === SCALE_FLOOR) < decisions.findIndex((d) => d.dropTier));
    // On trial and holding the display's rate, or giving up only resolution for it: no drop.
    const holds = new ArkFramePacer("medium", 0);
    holds.trial = true;
    assert.equal(simulate(holds, 0, 120, 7, 21).decisions.filter((d) => d.dropTier).length, 0);
    assert.equal(holds.interval, 0);
    // Never during the start.
    const starting = new ArkFramePacer("medium", 0);
    starting.trial = true;
    assert.equal(simulate(starting, 0, 60, 7, 40, false).decisions.filter((d) => d.dropTier).length, 0);
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

test("a host's push of the whole Ark again (the wire's shape, its day inside the voyage): the same but for its time is dropped undecoded, found out in slices", async () => {
    const DAY = (86_400_000 * 14) / 365;
    const animals = Array.from({length: 400}, (_, i) => ({id: `a${i}`, zone: "forest", thrive: {hunger: i / 400}, bringers: [{label: `b${i}`, named: true}]}));
    const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
    const pushed = {as_of: "2026-11-13T10:00:00Z", voyage: {slug: "first", name: "First", ark_day: 90.1}, counts: {animals: 400}, animals};
    const again = {as_of: "2026-11-13T10:00:45Z", voyage: {slug: "first", name: "First", ark_day: 90.1 + 45_000 / DAY}, counts: {animals: 400}, animals: copy(animals)};
    // A clock that moves a millisecond each time it is read: the walk is cut into many slices, each followed by a pause.
    let clock = 0;
    let pauses = 0;
    const sliced = {now: () => ++clock, pause: async () => void pauses++};
    assert.equal(await sameArkPush(pushed, again, sliced), true);
    assert.ok(pauses >= 5, `${pauses} pauses`);
    assert.equal(await sameArkPush(pushed, pushed), true);
    // An animal changed (the last and the first walked), one arrived, the voyage renamed: a new Ark.
    const changed = (at: number) => ({...again, animals: again.animals.map((animal, i) => (i === at ? {...animal, thrive: {hunger: 2}} : animal))});
    assert.equal(await sameArkPush(pushed, changed(0), sliced), false);
    assert.equal(await sameArkPush(pushed, changed(399), sliced), false);
    assert.equal(await sameArkPush(pushed, {...again, animals: [...again.animals, {id: "y", zone: "town", thrive: {hunger: 0.1}, bringers: []}]}, sliced), false);
    assert.equal(await sameArkPush(pushed, {...again, voyage: {...again.voyage, name: "Second"}}, sliced), false);
    // The day past the tolerance (four reads or so on): laid out again, as a read of the page's own is.
    assert.equal(await sameArkPush(pushed, {...again, as_of: "2026-11-13T10:03:45Z", voyage: {...again.voyage, ark_day: 90.1 + 225_000 / DAY}}, sliced), false);
    // Not the wire's shape: never the same.
    assert.equal(await sameArkPush(pushed, null), false);
    assert.equal(await sameArkPush({animals}, {animals: copy(animals)}), false);
    // The sliced walk answers as the whole one does.
    const pairs: Array<[unknown, unknown]> = [[{a: [1, {b: null}], c: "x"}, {c: "x", a: [1, {b: null}]}], [{a: [1, 2]}, {a: [1, 2, 3]}], [{a: 1}, {a: 1, b: undefined}], [{a: 1}, {a: "1"}], [undefined, undefined], [null, {}], [[NaN], [NaN]]];
    for (const [x, y] of pairs) assert.equal(await sameJsonSliced(x, y, sliced), sameJson(x, y), JSON.stringify([x, y]));
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

test("two-sided transparent meshes: the back faces then the front, as three's two passes draw them, nothing else changed", () => {
    const root = new Group();
    const glass = new MeshStandardMaterial({transparent: true, opacity: 0.2, side: DoubleSide, depthWrite: false});
    glass.customProgramCacheKey = () => "glass-key";
    const patch = () => undefined;
    glass.onBeforeCompile = patch;
    const pane = new Mesh(new BoxGeometry(1, 1, 0.01), glass);
    pane.renderOrder = 4;
    const caster = new Mesh(new BoxGeometry(), new MeshStandardMaterial({transparent: true, side: DoubleSide}));
    caster.castShadow = true;
    const solid = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
    root.add(pane, caster, solid);
    assert.equal(splitTwoSided(root), 1);
    const back = pane.material as MeshStandardMaterial;
    const front = pane.children[0] as Mesh;
    assert.equal(back.side, BackSide);
    assert.equal((front.material as MeshStandardMaterial).side, FrontSide);
    assert.equal(front.geometry, pane.geometry, "the same geometry");
    assert.ok(front.id > pane.id, "drawn right after it (the transparent sort's last word is the id)");
    assert.equal(front.renderOrder, 4);
    for (const copy of [back, front.material as MeshStandardMaterial]) {
        assert.equal(copy.opacity, 0.2);
        assert.equal(copy.customProgramCacheKey(), "glass-key");
        assert.equal(copy.onBeforeCompile, patch);
    }
    // A shadow caster and an opaque mesh are left as they are; nothing is split twice.
    assert.equal(caster.children.length, 0);
    assert.equal(solid.children.length, 0);
    assert.equal(splitTwoSided(root), 0);
});

test("the resting warm-up's list: the rotation's first asks, a fraction of the Ark; with those answers it asks nothing else", async () => {
    const {arkOutside, arkRestingAsks, arkWithinCapacity} = await import("@/ark-scene/live-budget");
    const candidates = Array.from({length: 600}, (_, i) => ({id: `a${String(i).padStart(4, "0")}`, group: `kind${i % 60}`, zone: ["forest", "coast", "open_land"][i % 3]}));
    const capacity = (zone: string) => (zone === "forest" ? 120 : null);
    const epoch = 1_800_000_300;
    const pinned = new Set(["a0007"]);
    const asks = arkRestingAsks(candidates, 40, epoch, pinned, capacity, () => undefined);
    assert.ok(asks.length > 0 && asks.length < candidates.length / 2, `${asks.length} asks`);
    // Answer exactly those (none resting): the rotation asks about no one else, and lays out as with every answer known.
    const answers = new Map(asks.map((id) => [id, false]));
    const strict = (c: {id: string}) => {
        const answer = answers.get(c.id);
        if (answer === undefined) throw new Error(`asked about ${c.id}, not in the warm-up's list`);
        return answer;
    };
    const out = arkOutside(arkWithinCapacity(candidates, capacity, epoch, pinned, strict), 40, epoch, pinned, strict);
    const everyone = () => false;
    assert.deepEqual(Array.from(out).sort(), Array.from(arkOutside(arkWithinCapacity(candidates, capacity, epoch, pinned, everyone), 40, epoch, pinned, everyone)).sort());
});
