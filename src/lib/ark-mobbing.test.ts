import assert from "node:assert/strict";
import test from "node:test";
import type {ActPose} from "@/ark-scene/acts";
import moves from "@/ark-scene/bird-moves.json";
import {canEat, hasIntelProfile, intelProfile} from "@/ark-scene/intelligence-profile";
import {MOB_APPROACH, MOB_REACH, MOB_REST, MOB_SECONDS, Mobbing, mobFlight, mobFoeFits, mobRing, mobSpot, type MobHost} from "@/ark-scene/mobbing";

const fox = {length: 1.1, height: 0.5};

test("the ring: one bird dives at a time, in turn, and the path has no jump", () => {
    const ring = mobRing(fox, 0.4);
    for (const n of [1, 2, 3, 4]) {
        const dives: number[] = [];
        for (let s = 0; s < ring.dive * 2 * Math.max(n, 2); s += 0.01) {
            const diving = Array.from({length: n}, (_, k) => mobFlight(ring, k, n, s)).filter((f) => f.diving > 0.02 && f.diving < 0.98);
            assert.ok(diving.length <= 1, `one at a time (n ${n}, s ${s.toFixed(2)})`);
            for (let k = 0; k < n; k++) {
                const a = mobFlight(ring, k, n, s);
                const b = mobFlight(ring, k, n, s + 0.01);
                assert.ok(Math.hypot(b.x - a.x, b.z - a.z, b.up - a.up) < 0.2, "no jump");
                if (a.diving > 0.49 && a.diving < 0.51 && !dives.includes(k)) dives.push(k);
            }
        }
        assert.equal(dives.length, n, `every bird has its turn (n ${n})`);
    }
});

test("the dive stays outside its gap: always above the predator's top, never through it or the ground", () => {
    for (const threat of [fox, {length: 0.4, height: 0.45}, {length: 2.4, height: 1.3}]) {
        for (const bird of [0.12, 0.25, 0.5]) {
            const ring = mobRing(threat, bird);
            assert.ok(ring.gap >= 0.4 && ring.pass < ring.radius && ring.height > ring.gap);
            // A hillside rising to one side: the ground under the ring is higher than under the predator.
            const ground = (x: number) => 5 + x * 0.6;
            const centre = {x: 0, z: 0, top: ground(0) + threat.height};
            let nearest = Infinity;
            for (let s = 0; s < 40; s += 0.02) {
                for (let k = 0; k < 3; k++) {
                    const p = mobSpot(centre, ring, k, 3, s, ground);
                    assert.ok(p.y >= centre.top + ring.gap - 1e-9, "above the predator's top by the gap");
                    assert.ok(p.y >= ground(p.x) + ring.gap - 1e-9, "clear of the ground under it");
                    // (The predator's body: a box of its length and height on the ground at the centre.)
                    const inBody = Math.abs(p.x) < threat.length / 2 && Math.abs(p.z) < threat.length / 2 && p.y < centre.top;
                    assert.equal(inBody, false);
                    nearest = Math.min(nearest, Math.hypot(p.x, p.z, p.y - centre.top));
                }
            }
            assert.ok(nearest >= ring.gap, "never nearer its head than the gap");
            assert.ok(nearest < ring.gap + ring.pass + 0.5, "and a dive does come close: past its head");
        }
    }
});

type E = {id: string; slug: string; x: number; y: number; z: number; len: number; h: number; act: ActPose | null; free: boolean; air: number};
const mk = (id: string, slug: string, x: number, z: number, o: Partial<E> = {}): E => ({id, slug, x, y: 0, z, len: slug === "red-fox" ? 1.1 : 0.4, h: slug === "red-fox" ? 0.5 : 0.3, act: null, free: true, air: 0, ...o});
const host = (): MobHost<E> => ({
    id: (e) => e.id,
    slug: (e) => e.slug,
    mobs: (e) => e.slug in moves.mob,
    free: (e) => e.free && !e.act,
    place: (e) => ({x: e.x, y: e.y, z: e.z, yaw: 0}),
    home: (e) => ({x: e.x, y: e.y, z: e.z, yaw: 0.5}),
    length: (e) => e.len,
    height: (e) => e.h,
    // (The scene's own rule, with the real model slugs: the ecology's food links.)
    threatens: (t, b) => canEat(intelProfile(t.slug), intelProfile(b.slug), 50, 20),
    ground: () => 0,
    act: (e) => e.act,
    setAct: (e, pose, aloft) => {
        e.act = pose;
        if (pose && aloft) e.air = 1;
    }
});

test("near the camera: magpies near a fox go up, mob it in turns and come back to their day; others never do", () => {
    const foxE = mk("f", "red-fox", 0, 0);
    const birds = [mk("m1", "australian-magpie", 6, 2), mk("m2", "australian-magpie", 9, -3), mk("m3", "australian-magpie", 14, 6)];
    const far = mk("m9", "australian-magpie", 400, 0);
    const zebra = mk("z", "plains-zebra", 3, 3);
    const sparrow = mk("s", "house-sparrow", 4, 1);
    const all = [foxE, ...birds, far, zebra, sparrow];
    const mob = new Mobbing<E>(host());
    mob.step(1000, all);
    assert.equal(mob.active, true);
    assert.deepEqual(birds.map((b) => Boolean(b.act)), [true, true, true]);
    assert.equal(far.act, null, "too far from the predator and its kin");
    assert.equal(sparrow.act, null, "a species whose text does not say it mobs");
    assert.equal(foxE.act, null, "the predator is never moved");
    let low = Infinity;
    let seen = 0;
    for (let t = 1000; t < 1000 + MOB_APPROACH + MOB_SECONDS + 10; t += 0.05) {
        mob.step(t, all);
        for (const b of birds) {
            if (!b.act) continue;
            assert.ok(b.act.base >= -1e-9, "never under the ground");
            assert.ok(["fly", "glide"].includes(b.act.state ?? ""));
            if (t - 1000 > MOB_APPROACH && t - 1000 < MOB_APPROACH + MOB_SECONDS) low = Math.min(low, Math.hypot(b.act.x, b.act.z, b.act.base - 0.5));
        }
        seen = Math.max(seen, mob.seen(t).length);
    }
    assert.ok(low >= mobRing(fox, 0.4).gap - 1e-6 && low < 2, `they pass its head, outside the gap (${low.toFixed(2)})`);
    assert.equal(seen, 3, "the log hears of all three, under one episode");
    assert.equal(mob.active, false, "over");
    assert.deepEqual(birds.map((b) => b.act), [null, null, null], "back on their schedules");
    // Rested: the same fox still there, nobody goes up again at once.
    mob.step(1000 + 60, all);
    assert.equal(mob.active, false);
    mob.step(1000 + MOB_REST + 40, all);
    assert.equal(mob.active, true, "later they do");
});

test("a bird taken by the record (a meal's act) is left to it; a predator out of reach starts nothing", () => {
    const foxE = mk("f", "red-fox", 0, 0);
    const bird = mk("m1", "australian-magpie", 5, 0);
    const mob = new Mobbing<E>(host());
    mob.step(10, [foxE, bird]);
    assert.ok(bird.act);
    const meal = {...bird.act!, state: "eat"};
    bird.act = meal;
    mob.step(10.1, [foxE, bird]);
    assert.equal(bird.act, meal, "not taken back");
    assert.equal(mob.active, false);
    const mob2 = new Mobbing<E>(host());
    const b2 = mk("m2", "australian-magpie", MOB_REACH + 3, 0);
    mob2.step(10, [foxE, b2]);
    assert.equal(mob2.active, false);
    const busy = mk("m3", "australian-magpie", 4, 0, {free: false});
    mob2.step(12, [foxE, busy]);
    assert.equal(mob2.active, false, "asleep or acting: not started");
});

test("the data: every mobbing species is a real model with a predator in the scene's food links, and its sentence fits its foe", () => {
    const table = moves.mob as Record<string, {line: string | null; foe: string | null; quote: string}>;
    assert.ok(Object.keys(table).length >= 17);
    for (const [slug, row] of Object.entries(table)) {
        assert.ok(hasIntelProfile(slug), slug);
        assert.ok(row.quote.length > 10 && row.line && /^\{(aAnimal|animals)\}/.test(row.line), slug);
        assert.ok(canEat(intelProfile("tawny-owl"), intelProfile(slug), 50, 20) || canEat(intelProfile("red-fox"), intelProfile(slug), 50, 20), `${slug} has a predator`);
    }
    assert.equal(mobFoeFits("owl", "tawny-owl", "bird"), true);
    assert.equal(mobFoeFits("owl", "red-fox", "mammal"), false, "a crow's 'mobbing an owl' is not said of a fox");
    assert.equal(mobFoeFits("raptor", "red-tailed-hawk", "bird"), true);
    assert.equal(mobFoeFits("raptor", "barn-owl", "bird"), true);
    assert.equal(mobFoeFits("snake", "king-cobra", "snake"), true);
    assert.equal(mobFoeFits("snake", "red-fox", "mammal"), false);
    assert.equal(mobFoeFits(null, "red-fox", "mammal"), true);
    assert.equal(table["american-crow"].foe, "owl");
    assert.equal(table["australian-magpie"].foe, null);
});
