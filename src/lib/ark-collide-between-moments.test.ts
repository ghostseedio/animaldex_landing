/**
 * Lane TOWNOVERLAP (2026-11-24: horses in the town's rural-paddock-2 stood and ran inside each other and the donkeys, A2's
 * play-run take 3.9-6.6 s and SIG5's horse roll frames 2-3). The collisions' push apart is worked out at the shared
 * clock's SEPARATION_EASE moments and eased between them; a body that came into another just after one moment had no push
 * until the next, and was eased out over the one after: with moments 4 s apart, a horse walking up to a grazing donkey
 * stood inside it for seconds. These drive the scene's layer (`collide/layer.ts`) frame by frame with the real body
 * shapes, and measure how long two bodies are inside each other as drawn, and that the easing never jumps.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {ColliderSet} from "@/ark-scene/collide/colliders";
import {bodyShape} from "@/ark-scene/collide/bodies";
import {CollideLayer} from "@/ark-scene/collide/layer";
import {overlapOf, SEPARATION_EASE, SEPARATION_SLACK, type ResolveBody, type ResolvePose} from "@/ark-scene/collide/resolve";

type Item = {id: string; slug: string; length: number; at: (epoch: number) => {x: number; z: number; yaw: number; moving: boolean}; last: {x: number; z: number; at: number} | null; fixed?: boolean};

/** Deeper than this beyond touching (m) is inside the other, as the eye reads it (a hand's width). */
const INSIDE = 0.08;

/** The scene's use of the layer, 60 frames a second: the longest run inside another (s), the deepest, the biggest push step a frame. */
function run(items: Item[], from: number, to: number) {
    const none = new ColliderSet([], "none", []);
    const bodies = new Map<Item, ResolveBody>(items.map((it) => {
        const s = bodyShape(it.slug, it.length);
        return [it, {id: it.id, radius: s.radius, half: s.half, height: s.height, group: it.id}];
    }));
    const baseOf = (it: Item, epoch: number): ResolvePose => {
        const p = it.at(epoch);
        return {x: p.x, y: 0, z: p.z, yaw: p.yaw, aloft: false, still: !p.moving, fixed: it.fixed};
    };
    const layer = new CollideLayer<Item>({colliders: () => none, body: (it) => bodies.get(it)!, base: baseOf, everyone: () => items, last: (it) => it.last, speed: () => 7});
    let longest = 0;
    let deepest = 0;
    let inside = 0;
    let step = 0;
    const push = new Map<Item, {x: number; z: number}>();
    for (let f = 0; f <= (to - from) * 60; f++) {
        const epoch = from + f / 60;
        const drawn = items.map((it) => {
            const base = baseOf(it, epoch);
            // (One in an act is drawn where its act has it: the scene asks the layer nothing for it, `collideActing`.)
            const at = it.fixed ? {x: base.x, z: base.z} : layer.apply(it, epoch, base);
            it.last = {x: at.x, z: at.z, at: epoch};
            const now = {x: at.x - base.x, z: at.z - base.z};
            const was = push.get(it);
            if (was) step = Math.max(step, Math.hypot(now.x - was.x, now.z - was.z));
            push.set(it, now);
            return {it, pose: {...base, x: at.x, z: at.z}};
        });
        let worst = 0;
        for (let i = 0; i < drawn.length; i++) {
            for (let j = i + 1; j < drawn.length; j++) {
                const a = bodies.get(drawn[i].it)!;
                const b = bodies.get(drawn[j].it)!;
                worst = Math.max(worst, overlapOf(a, drawn[i].pose, b, drawn[j].pose).depth - SEPARATION_SLACK * Math.min(a.radius, b.radius));
            }
        }
        deepest = Math.max(deepest, worst);
        inside = worst > INSIDE ? inside + 1 / 60 : 0;
        longest = Math.max(longest, inside);
    }
    return {longest, deepest, step};
}

/** From (x0, z0) to (x1, z1) over [t0, t1], standing at either end. */
const line = (x0: number, z0: number, x1: number, z1: number, t0: number, t1: number) => (epoch: number) => {
    const u = Math.min(Math.max((epoch - t0) / (t1 - t0), 0), 1);
    return {x: x0 + (x1 - x0) * u, z: z0 + (z1 - z0) * u, yaw: Math.atan2(x1 - x0, z1 - z0), moving: u > 0 && u < 1};
};
const standing = (x: number, z: number, yaw: number) => () => ({x, z, yaw, moving: false});

test("a horse walking up to a grazing donkey and stopping at its side is out of it within a second, never jumping", () => {
    // (Every arrival through one easing period: whenever it comes between two moments.)
    for (let k = 0; k < 8; k++) {
        const q = 1000 + k * 0.37;
        const horse: Item = {id: "horse", slug: "domestic-horse", length: 2.4, at: line(-6, 0.4, 0.2, 0.4, q, q + 4.1), last: null};
        const donkey: Item = {id: "donkey", slug: "domestic-donkey", length: 2, at: standing(0, 0, Math.PI / 2 + 0.2), last: null};
        const {longest, step} = run([horse, donkey], q - 1, q + 14);
        assert.ok(longest <= 1, `arrival ${k}: inside the donkey for ${longest.toFixed(2)} s`);
        assert.ok(step < 0.05, `arrival ${k}: the push stepped ${step.toFixed(3)} m in a frame`);
    }
});

test("a horse at a play run's pace past a standing horse is never inside it for more than half a second", () => {
    for (let k = 0; k < 8; k++) {
        const q = 2000 + k * 0.37;
        const runner: Item = {id: "h1", slug: "domestic-horse", length: 2.4, at: line(-12, 0.3, 12, 0.3, q, q + 4.8), last: null};
        const stander: Item = {id: "h2", slug: "domestic-horse", length: 2.4, at: standing(0, 0, Math.PI / 2), last: null};
        const {longest, step} = run([runner, stander], q - 1, q + 8);
        assert.ok(longest <= 0.5, `pass ${k}: inside the other for ${longest.toFixed(2)} s`);
        assert.ok(step < 0.08, `pass ${k}: the push stepped ${step.toFixed(3)} m in a frame`);
    }
});

test("two grazing apart are left exactly where their day has them", () => {
    const a: Item = {id: "a", slug: "domestic-horse", length: 2.4, at: standing(0, 0, 0), last: null};
    const b: Item = {id: "b", slug: "domestic-donkey", length: 2, at: standing(4, 0, 0), last: null};
    const {deepest, step} = run([a, b], 3000, 3000 + SEPARATION_EASE * 3);
    assert.equal(deepest, 0);
    assert.equal(step, 0);
});

test("one paused in an act of its own (a dung pause) stays where its act has it, and a horse walking up is eased round it", () => {
    // (The scene's `collideActing`: held, `fixed`, still among the bodies; out of them before, it was walked through.)
    for (let k = 0; k < 4; k++) {
        const q = 4000 + k * 0.29;
        const horse: Item = {id: "horse", slug: "domestic-horse", length: 2.4, at: line(-6, 0.4, 0.2, 0.4, q, q + 4.1), last: null};
        const donkey: Item = {id: "donkey", slug: "domestic-donkey", length: 2, at: standing(0, 0, Math.PI / 2 + 0.2), last: null, fixed: true};
        const {longest, step} = run([horse, donkey], q - 1, q + 10);
        assert.ok(longest <= 1, `arrival ${k}: inside the paused donkey for ${longest.toFixed(2)} s`);
        assert.ok(step < 0.05, `arrival ${k}: the push stepped ${step.toFixed(3)} m in a frame`);
    }
});
