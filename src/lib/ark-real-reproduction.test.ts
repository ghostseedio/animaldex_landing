// REAL-REPRODUCTION (AnimalDex decision 440, docs/ark/real-reproduction.md): each kind breeds its own way on screen; fixed
// animals never move and slow creepers creep at centimetres a minute.
import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync, readdirSync} from "node:fs";
import path from "node:path";

import type {ActPose} from "@/ark-scene/acts";
import {behaviourProfile} from "@/ark-scene/behaviour-profile";
import {LiveMatings, mountKind, type LiveMatingsHost} from "@/ark-scene/live-matings";
import {birthScript, motherPose, realStyle, youngPose} from "@/ark-scene/live-births";
import {FX_MOST, particleAt, reproAct, reproFx, reproOf, reproPlan, reproPose, rockOf, type FxEmitter, type Particle} from "@/ark-scene/repro";
import {arkLiveLineText, arkLiveServerItems, arkLiveWayOf, type ArkLiveText} from "@/lib/ark-live-log";
import {decodeArkEvents} from "@/lib/ark-life";

const CUCUMBER = "7ae26f5b-6ce2-4ff4-9182-512b3f384635";
const STAGHORN = "03bccf24-2c8a-4a2a-b7c1-a70da27f1b91";
const HYDRA = "b3090597-8fdd-4783-9876-239dd44553b8";
const SEAHORSE = "71d081a2-916b-4f68-9a80-cc68206ea631";
const CLOWNFISH = "4b6ae26c-9273-4788-84b9-b22bcfb6343c";
const TOAD = "298d81b3-1a0e-48a4-b55d-6df6f465983d";

test("the way table: corals and sea cucumbers spawn, seahorse males carry, hydras bud, toads clasp", () => {
    assert.equal(reproOf(CUCUMBER)?.way, "broadcast");
    assert.equal(reproOf(CUCUMBER)?.also, "split");
    assert.equal(reproOf(STAGHORN)?.way, "broadcast");
    assert.equal(reproOf(HYDRA)?.way, "asexual");
    assert.equal(reproOf(SEAHORSE)?.way, "male_pregnancy");
    assert.equal(reproOf(CLOWNFISH)?.way, "spawn_pair");
    assert.equal(reproOf(TOAD)?.way, "amplexus");
    assert.equal(reproOf("a-zebra"), null);
    assert.equal(reproAct(reproOf(STAGHORN)), "spawn_night");
    assert.equal(reproAct(reproOf(HYDRA)), null, "an asexual kind never pairs");
});

test("no mammal's mount for anything that is not a mammal (the rig's 'other', a star, a sponge)", () => {
    for (const plan of ["other", "mollusc", "echinoderm", "sponge", "coral", "fish", "amphibian"]) assert.notEqual(mountKind(plan), "mount", plan);
    assert.equal(mountKind("quadruped"), "mount");
    assert.equal(mountKind("mammal"), "mount");
});

test("movement audit: fixed animals never move; slow creepers creep at centimetres a minute and never flee", () => {
    for (const slug of ["christmas-tree-worm", "venus-flower-basket", "ocean-quahog", "bivalve", "giant-barrel-sponge", "acorn-barnacle", "kenya-tree-coral"]) assert.equal(behaviourProfile(slug).move, "sessile", slug);
    for (const slug of ["black-sea-cucumber", "sea-pig", "blue-linckia-sea-star", "crown-of-thorns-starfish", "giant-african-land-snail", "banana-slug", "red-sea-urchin", "common-limpet"]) {
        const p = behaviourProfile(slug);
        assert.ok(p.creep && p.creep < 0.005, `${slug}: ${p.creep} m/s`);
        // centimetres a minute
        assert.ok(p.creep! * 60 * 100 < 30, `${slug}: ${p.creep! * 6000} cm/min`);
    }
    assert.equal(behaviourProfile("sea-pig").move, "crawl");
    // not a bird or a fish with a borrowed word in its name
    assert.equal(behaviourProfile("barnacle-goose").creep ?? null, null);
    assert.equal(behaviourProfile("eurasian-oystercatcher").creep ?? null, null);
});

type E = {id: string; x: number; z: number; act: ActPose | null; male: boolean | null; species: string; plan: string};
function host(animals: E[], kin: Array<{x: number; z: number}> = []): LiveMatingsHost<E> {
    const byId = new Map(animals.map((a) => [a.id, a]));
    return {
        find: (id) => byId.get(id) ?? null,
        scheduleAt: (e) => ({x: e.x, z: e.z, y: 0, yaw: 0, doing: "rest", aloft: false}),
        ground: () => 0,
        walk: () => 0.5,
        length: () => 0.4,
        height: () => 0.2,
        plan: (e) => e.plan,
        courtship: () => null,
        male: (e) => e.male,
        together: () => true,
        setAct: (e, pose) => {
            e.act = pose;
        },
        busy: () => false,
        repro: (e) => reproOf(e.species),
        kinSpots: () => kin
    };
}

test("a spawning night: neither moves to the other, both rear up where they are, and their kin's haze rises with theirs", () => {
    const a: E = {id: "a", x: 0, z: 0, act: null, male: true, species: CUCUMBER, plan: "other"};
    const b: E = {id: "b", x: 6, z: 0, act: null, male: false, species: CUCUMBER, plan: "other"};
    const layer = new LiveMatings(host([a, b], [{x: 3, z: 4}, {x: -2, z: 1}]));
    layer.add([{key: "night", a: "a", b: "b", t0: 1000}], 1000);
    let lifted = 0;
    let haze = 0;
    for (let t = 1000; t < 1100; t += 2) {
        layer.step(t);
        const pa = a.act;
        const pb = b.act;
        if (pa) assert.ok(Math.hypot(pa.x - 0, pa.z) < 1e-6, `a stays at ${pa.x},${pa.z}`);
        if (pb) assert.ok(Math.hypot(pb.x - 6, pb.z) < 1e-6, `b stays at ${pb.x},${pb.z}`);
        if (pa && pa.pitch < -0.5) lifted++;
        const fx = layer.fx(t);
        haze = Math.max(haze, fx.filter((f) => f.kind === "haze").length);
    }
    assert.ok(lifted > 10, "it reared up on its end");
    assert.equal(haze, 4, "both of the pair and two kin spawn");
    assert.equal(layer.debug()[0].mount, "alongside");
});

test("clownfish: at their rock she lays a patch of eggs pass by pass, he passes over each row after her, then guards it", () => {
    const r = reproOf(CLOWNFISH)!;
    assert.equal(r.detail, "surface");
    const plan = reproPlan("spawn_pair", r, {from: {m: {x: 4, z: 0}, f: {x: 0, z: 0}}, to: {m: {x: 0.3, z: 0}, f: {x: 0, z: 0}}, walk: 5, heading: 0, m: {length: 0.1, height: 0.05, pace: 0.3}, f: {length: 0.1, height: 0.05, pace: 0.3}});
    const rock = rockOf(plan)!;
    assert.ok(rock && rock.long > 0.1, "a rock longer than the fish");
    let passesOver = 0;
    for (let s = 0; s < plan.end; s += 0.5) {
        for (const isM of [true, false]) {
            const p = reproPose(plan, isM, s, () => 0, "x");
            if (!p) continue;
            // (Never mounted: at most a body's height over the rock's top.)
            assert.ok(p.base <= rock.tall + 0.05 + 1e-9, `never on top of the other (${s})`);
            assert.notEqual(p.state, "walk", "fish swim");
            if (isM && s > plan.b + 2 && s < plan.c && Math.hypot(p.x - plan.spot.x, p.z - plan.spot.z) < rock.long * 0.35) passesOver++;
        }
    }
    assert.ok(passesOver > 20, "he passes over the eggs");
    // The patch grows as she lays and stays to the end; the rock is there throughout; his milt is over the eggs.
    const at = (s: number) => reproFx(plan, "k", s, () => 0);
    const patch = (s: number) => at(s).find((e) => e.kind === "patch");
    assert.equal(patch(plan.b - 1), undefined);
    assert.ok(patch(plan.b + 5)!.share! < patch(plan.c - 1)!.share!);
    assert.equal(patch(plan.end - 1)!.share, 1);
    assert.ok(at(plan.b + 10).some((e) => e.kind === "milt"));
    assert.ok(at(plan.a).some((e) => e.kind === "rock") && at(plan.end - 1).some((e) => e.kind === "rock"));
    const p: Particle = {x: 0, y: 0, z: 0, size: 0, alt: false};
    const half = patch(plan.b + (plan.c - plan.b) / 2)!;
    const full = patch(plan.c + 1)!;
    const lit = (e: FxEmitter) => Array.from({length: 96}, (_, i) => particleAt(e, i, {...p})).filter((a) => a > 0).length;
    assert.ok(lit(half) > 20 && lit(half) < lit(full) && lit(full) >= 90, "eggs laid row by row");
    // after the release only the guard (the male, for clownfish) is still acted
    const late = plan.c + 10;
    const guard = reproPose(plan, r.guard === "male", late, () => 0, "x")!;
    assert.ok(Math.hypot(guard.x - plan.spot.x, guard.z - plan.spot.z) < rockOf(plan)!.wide, "he tends the eggs");
    const she = reproPose(plan, r.guard !== "male", late, () => 0, "x")!;
    assert.ok(Math.hypot(she.x - plan.spot.x, she.z - plan.spot.z) > rockOf(plan)!.wide, "she keeps off, near");
});

test("frogs in amplexus: he is held on her back a long while; seahorses circle and rise together", () => {
    const body = {length: 0.1, height: 0.05, pace: 0.3};
    const at = {from: {m: {x: 1, z: 0}, f: {x: 0, z: 0}}, to: {m: {x: 0.05, z: 0}, f: {x: 0, z: 0}}, walk: 3, heading: 0, m: body, f: body};
    const amp = reproPlan("amplexus", reproOf(TOAD)!, at);
    const held = reproPose(amp, true, amp.a + 30, () => 0, "f")!;
    assert.ok(held.base > 0.03 && amp.c - amp.a >= 60, "on her back for a minute");
    // She walks on with him aboard, laying two strings of eggs behind her.
    const she = (s: number) => reproPose(amp, false, s, () => 0, "m")!;
    assert.ok(she(amp.c - 1).z > she(amp.b).z + 0.1, "she walks on as she lays");
    const str = reproFx(amp, "k", amp.c - 1, () => 0).find((e) => e.kind === "string")!;
    assert.ok(str && (str.long ?? 0) > 0.1, "the strings are as long as her walk");
    const sea = reproPlan("pouch", reproOf(SEAHORSE)!, at);
    const up = reproPose(sea, true, sea.b - 1, () => 0, "f")!;
    assert.ok(up.base > 0.05, "risen together");
});

test("births: a hydra's bud is pinched off its one parent slowly; a seahorse's young come out of the father's pouch", () => {
    assert.equal(realStyle(reproOf(HYDRA), 1), "split");
    assert.equal(realStyle(reproOf(CUCUMBER), 1), "split");
    assert.equal(realStyle(reproOf(CUCUMBER), 2), null, "a spawned larva hatches as before");
    assert.equal(realStyle(reproOf(SEAHORSE), 2), "fry");
    const sc = birthScript({x: 0, z: 0, yaw: 0, length: 0.02, height: 0.01, pace: 0.001, plan: "other", care: null, pouch: false}, 1, "k", 0.001, 0.01, false, "split");
    const early = youngPose(sc, 0, sc.first + 2, () => 0, "p");
    const late = youngPose(sc, 0, sc.lickEnd, () => 0, "p");
    assert.ok(Math.hypot(early.x, early.z) < Math.hypot(late.x, late.z), "it comes away from its parent");
    // In line with the parent's body at first (one long body), then apart along it, the parent drawing forward.
    assert.ok(Math.abs(early.x) < 1e-6 && early.z < 0, "its back half");
    const parent = motherPose(sc, sc.lickEnd, () => 0, "y");
    assert.ok(parent.z > 0 && parent.z - late.z > 0.02 * 0.8, "the two pulled apart");
    assert.ok(sc.lickEnd - sc.first >= 30, "slowly");
});

test("the puffs stay within their budget and fade", () => {
    const e: FxEmitter = {key: "k", x: 0, y: 0, z: 0, kind: "haze", t: 20, size: 0.3};
    const p: Particle = {x: 0, y: 0, z: 0, size: 0, alt: false};
    let lit = 0;
    for (let i = 0; i < 64; i++) if (particleAt(e, i, p) > 0) lit++;
    assert.ok(lit > 20);
    assert.ok(FX_MOST <= 1024);
});

test("log lines: a spawning night, a pair's spawn, amplexus, a father's pouch and a split are said their own way", () => {
    assert.equal(arkLiveWayOf("broadcast"), "spawnNight");
    assert.equal(arkLiveWayOf("spawn_pair"), "spawnPair");
    assert.equal(arkLiveWayOf("mating"), null);
    assert.equal(arkLiveWayOf(undefined), null);
    const animal = {id: "a1", species_profile_id: STAGHORN, name: "Staghorn Coral", model_slug: "staghorn-coral", zone: "reef"};
    const events = decodeArkEvents(
        [
            {id: 1, kind: "mated", at: "2026-11-20T10:00:00Z", ark_day: 310, animal, parents: ["a1", "a2"], payload: {way: "broadcast", spawners: 6}},
            {id: 2, kind: "birth", at: "2026-11-20T10:00:01Z", ark_day: 310, animal: {...animal, id: "a3"}, parents: ["a1", "a1"], payload: {way: "alone", way_detail: "fragment"}},
            {id: 3, kind: "mated", at: "2026-11-20T10:00:02Z", ark_day: 310, animal: {...animal, id: "z1", name: "Plains Zebra"}, parents: ["z1", "z2"], payload: {}}
        ],
        null
    );
    const items = arkLiveServerItems(events);
    const words = JSON.parse(readFileSync(path.join(process.cwd(), "src/data/locales/en.json"), "utf8")).ark as ArkLiveText;
    const text = items.map((i) => arkLiveLineText(i, words, "en"));
    assert.equal(text[0], "The reef spawned tonight: Staghorn Coral");
    assert.equal(text[1], "Staghorn Coral: a new one split off its parent");
    assert.ok(!items[2].way, "a zebra's mating is said as before");
});

test("every locale has the five new lines with their placeholders", () => {
    const root = path.join(process.cwd(), "src/data/locales");
    const files = [path.join(root, "en.json"), path.join(root, "id.json"), ...readdirSync(path.join(root, "ark")).map((f) => path.join(root, "ark", f))];
    assert.equal(files.length, 45);
    for (const f of files) {
        const live = JSON.parse(readFileSync(f, "utf8")).ark.live;
        for (const k of ["spawnNight", "spawnPair", "amplexus", "pouchFry", "split"]) {
            assert.ok(typeof live[k] === "string" && live[k].includes("{animal}"), `${f}: ${k}`);
        }
        assert.ok(live.pouchFry.includes("{count}"), f);
    }
});
