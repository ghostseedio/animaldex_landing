import assert from "node:assert/strict";
import test from "node:test";
import fixtureV2 from "@/ark-scene/fixtures/snapshot-v2.json";
import {mealStage, type ActBody} from "@/ark-scene/acts";
import {allocateArkPlaces, placeAnimals, slotKind, zoneLayout} from "@/ark-scene/placement";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import {ARK_SIZE_CAP, ARK_SIZE_FLOOR, arkBody, bodyAxisExtent, arkIdleBehaviour, arkStats, bodyLengthsPerSecond, glance, glancePeriod, massFromSize, moveSpeed, screenLength} from "@/ark-scene/stats";
import type {ArkAnimal} from "@/ark-scene/types";
import {ZONE_SITES} from "@/ark-scene/world";

const near = (actual: number, expected: number, within: number, what: string) => assert.ok(Math.abs(actual - expected) <= within, `${what}: ${actual} not ${expected}`);

test("size: the stored length where there is one, else the size stat through mass; drawn at 1.2·L^0.6 between the floor and the cap", () => {
    // The addendum's table (docs/ark-next.md), from the live catalogue.
    const ladybird = arkBody({model_slug: "seven-spot-ladybird"});
    near(ladybird.metres, 0.005, 0.001, "ladybird length");
    assert.equal(ladybird.source, "estimate");
    assert.equal(ladybird.display, ARK_SIZE_FLOOR);
    assert.ok(ladybird.floor, "the ladybird gets a marker");
    const mouse = arkBody({model_slug: "house-mouse"});
    assert.equal(mouse.source, "stored");
    near(mouse.metres, 0.09, 0.005, "mouse (7.5-10 cm)");
    near(mouse.display, 0.28, 0.01, "mouse on screen");
    assert.ok(!mouse.floor);
    near(arkBody({model_slug: "house-sparrow"}).display, 0.36, 0.01, "sparrow");
    near(arkBody({model_slug: "eurasian-wolf"}).display, 1.44, 0.02, "wolf");
    near(arkBody({model_slug: "polar-bear"}).metres, 2.5, 0.001, "polar bear stored");
    near(arkBody({model_slug: "african-bush-elephant"}).display, 3.51, 0.02, "elephant");
    near(arkBody({model_slug: "fin-whale"}).display, 6.27, 0.03, "fin whale");
    // The mass anchors read the other way: elephant 92 is 6 t.
    near(massFromSize(92), 6000, 1, "size 92");
    near(massFromSize(100), 150_000, 1, "size 100");
    assert.equal(screenLength(80), ARK_SIZE_CAP);
    assert.equal(screenLength(0.0001), ARK_SIZE_FLOOR);
    // The snapshot's own values win over the catalogue's.
    assert.equal(arkBody({model_slug: "house-mouse", length_m: 0.2}).metres, 0.2);
    assert.ok(arkBody({model_slug: "domestic-cat", stats: {size: 92}}).display > 3);
    // A species the catalogue lacks: its body plan, labelled as such.
    assert.equal(arkBody({model_slug: "no-such-animal"}, "bird").source, "plan");
});

test("size is a body length: models are scaled along their head-to-tail axis, so tall ones stand tall and upright ones by their height", () => {
    // Extents from the ark model set (ark.json), head toward +z.
    const scaleOf = (slug: string, plan: string, extent: {x: number; y: number; z: number}) => arkBody({model_slug: slug}).display / bodyAxisExtent(slug, plan, extent);
    const giraffe = {x: 0.2749, y: 1.28, z: 1};
    const elephant = {x: 0.4883, y: 0.7318, z: 1};
    assert.equal(bodyAxisExtent("giraffe", "mammal", giraffe), 1);
    assert.ok(scaleOf("giraffe", "mammal", giraffe) * giraffe.y > scaleOf("african-bush-elephant", "mammal", elephant) * elephant.y, "a giraffe stands taller than an elephant");
    // Waders along the body (legs and neck add height); a snake and a fish along their length.
    assert.equal(bodyAxisExtent("greater-flamingo", "bird", {x: 0.37, y: 1.59, z: 1}), 1);
    assert.equal(bodyAxisExtent("grey-heron", "bird", {x: 0.585, y: 1.27, z: 1}), 1);
    assert.equal(bodyAxisExtent("african-rock-python", "snake", {x: 0.29, y: 0.08, z: 1}), 1);
    assert.equal(bodyAxisExtent("bluefin-tuna", "fish", {x: 0.18, y: 0.31, z: 1}), 1);
    // Upright bodies by their height: a penguin, an owl, a hawk sitting up, a seahorse, a jellyfish. "Lowland" is not an owl.
    assert.equal(bodyAxisExtent("emperor-penguin", "bird", {x: 1.14, y: 1.91, z: 1}), 1.91);
    assert.equal(bodyAxisExtent("barn-owl", "bird", {x: 0.64, y: 1.32, z: 1}), 1.32);
    assert.equal(bodyAxisExtent("coopers-hawk", "bird", {x: 0.5, y: 1.3, z: 1}), 1.3);
    assert.equal(bodyAxisExtent("pot-bellied-seahorse", "fish", {x: 0.3, y: 1.83, z: 1}), 1.83);
    assert.equal(bodyAxisExtent("moon-jellyfish", "jellyfish", {x: 1, y: 2.36, z: 1}), 2.36);
    assert.equal(bodyAxisExtent("western-lowland-gorilla", "mammal", {x: 0.69, y: 1.17, z: 1}), 1);
    assert.equal(bodyAxisExtent("owl-butterfly", "butterfly", {x: 1.2, y: 0.4, z: 1}), 1);
    // A degenerate z: the longest horizontal side.
    assert.equal(bodyAxisExtent("flat-thing", "fish", {x: 1, y: 0.3, z: 0.1}), 1);
});

test("snapshot: stats and a stored length decode when the server sends them", () => {
    const raw = JSON.parse(JSON.stringify(fixtureV2)) as {animals: Array<Record<string, unknown>>};
    raw.animals[0].stats = {size: 40, speed: 70, dominance: 120, rarity: "x", intelligence: 61};
    raw.animals[0].length_m = 1.4;
    raw.animals[0].length_phrase = "1.2-1.6 m";
    const animal = decodeArkSnapshot(raw)!.animals.find((a) => a.id === raw.animals[0].id)!;
    assert.deepEqual(animal.stats, {size: 40, speed: 70, intelligence: 61});
    assert.equal(animal.length_m, 1.4);
    assert.equal(animal.length_phrase, "1.2-1.6 m");
    // A fixture without them has none, and the catalogue fills in.
    const plain = decodeArkSnapshot(fixtureV2)!.animals[0];
    assert.equal(plain.stats, undefined);
    assert.equal(arkStats(plain).size, arkStats({model_slug: plain.model_slug}).size);
});

test("speed: 0.6 to 2 body lengths a second, and a chase takes as long as its predator's pace says, ending in the same place", () => {
    assert.equal(bodyLengthsPerSecond(0), 0.6);
    assert.equal(bodyLengthsPerSecond(100), 2);
    assert.equal(bodyLengthsPerSecond(250), 2);
    const cheetah = arkBody({model_slug: "cheetah"}).display;
    const lion = arkBody({model_slug: "african-lion"}).display;
    assert.ok(moveSpeed({model_slug: "cheetah"}, cheetah) > moveSpeed({model_slug: "african-lion"}, lion) * 0.9);
    const prey: ActBody = {x: 0, z: 0, base: 0.5, yaw: 0, length: 1.6, height: 1};
    const hunter = (speed?: number): ActBody => ({x: -6, z: 0, base: 0.5, yaw: 0, length: 1.8, height: 1, speed});
    const plain = mealStage("glide", hunter(), prey);
    const fast = mealStage("glide", hunter(7), prey);
    const slow = mealStage("glide", hunter(1.2), prey);
    assert.ok(fast.seconds < plain.seconds && plain.seconds < slow.seconds, `${fast.seconds} ${plain.seconds} ${slow.seconds}`);
    // Each ends where it would have: standing over the prey, the prey gone.
    for (const stage of [fast, slow]) {
        const end = stage.predator(stage.seconds)!;
        const was = plain.predator(plain.seconds)!;
        near(end.x, was.x, 1e-9, "x");
        near(end.z, was.z, 1e-9, "z");
        assert.ok(stage.prey(stage.seconds).hidden);
    }
    // Clamped: never slower than twice the stage's own stretch.
    assert.ok(mealStage("glide", hunter(0.01), prey).seconds <= plain.seconds + 2 * 1.6 + 1e-9);
});

test("intelligence: sharper animals have more kinds of idle and look round at a near camera more often", () => {
    const behaviour = {idle: {look: 2, startle: 1, shake: 0, sniff: 0, bob: 0}};
    const kinds = (intelligence: number) => Object.entries(arkIdleBehaviour(behaviour, intelligence).idle ?? {}).filter(([, n]) => Number(n) > 0).map(([kind]) => kind).sort();
    assert.deepEqual(kinds(10), ["look"]);
    assert.ok(kinds(45).length < kinds(90).length);
    assert.deepEqual(kinds(90), ["bob", "look", "shake", "sniff", "startle"]);
    // Nothing "often" swamps the rest for a sharp one.
    assert.ok(Object.values(arkIdleBehaviour({idle: {look: 3, sniff: 1}}, 90).idle ?? {}).every((n) => Number(n) <= 2));
    assert.ok(glancePeriod(90) < glancePeriod(20));
    // A glance is a short window once a period, the same for the same animal.
    const period = glancePeriod(60);
    let looking = 0;
    for (let t = 0; t < period * 10; t += 0.1) if (glance(60, t, 0.3) > 0) looking++;
    near(looking / (period * 100), 2.4 / period, 0.02, "share of time glancing");
    assert.equal(glance(60, 12.3, 0.3), glance(60, 12.3, 0.3));
});

test("placement: the dominant stand at the middle, the rare at the edge (some behind cover); nobody moves when another leaves", () => {
    const v2 = decodeArkSnapshot(fixtureV2)!;
    const places = placeAnimals(v2.animals);
    const slots = allocateArkPlaces(v2.animals);
    const radius = (animal: ArkAnimal) => {
        const site = ZONE_SITES[animal.zone];
        const place = places.get(animal.id)!;
        return Math.hypot(place.x - site.x, place.z - site.z);
    };
    const leaders = v2.animals.filter((a) => slots.get(a.id)!.rank === 0);
    const kindOf = (a: ArkAnimal) => slotKind(a, slots.get(a.id)!.slot);
    // The lion and the elephant are the grassland's core, nearer its middle than the zebra; the bluefin tuna rides the ocean's edge.
    const of = (slug: string) => leaders.filter((a) => a.model_slug === slug);
    assert.ok(of("african-lion").every((a) => kindOf(a) === "core"));
    assert.ok(Math.max(...of("african-lion").map(radius)) < Math.min(...of("plains-zebra").map(radius)));
    assert.ok(of("bluefin-tuna").every((a) => kindOf(a) === "edge"));
    for (const animal of leaders) {
        const kind = kindOf(animal);
        const layout = zoneLayout(animal.zone);
        const site = ZONE_SITES[animal.zone];
        if (kind === "edge" || (kind === "cover" && !places.get(animal.id)!.covered)) {
            assert.ok(radius(animal) >= Math.hypot(layout.spot(layout.edgeFrom).x - site.x, layout.spot(layout.edgeFrom).z - site.z) - site.spacing, `${animal.model_slug} at the edge`);
        }
        if (places.get(animal.id)!.covered) assert.equal(kind, "cover");
    }
    assert.ok(Array.from(places.values()).some((p) => p.covered), "someone rare stands behind cover");
    // The stats never break stability: every third leaves, the rest stand still.
    const spot = (p: {x: number; z: number; yaw: number; ground: number; covered?: boolean} | undefined) => p && [p.x, p.z, p.yaw, p.ground, p.covered ?? false];
    const after = placeAnimals(v2.animals.filter((_, i) => i % 3 !== 1));
    after.forEach((place, id) => assert.deepEqual(spot(place), spot(places.get(id)), id));
    // Nor does a newcomer of a rare kind in an empty slot.
    const lone: ArkAnimal = {...v2.animals.find((a) => a.model_slug === "snow-leopard")!, id: "new-leopard", slot: 40, slot_rank: 0, arrived_at: "2026-11-09T00:00:00Z"};
    const more = placeAnimals([...v2.animals, lone]);
    places.forEach((place, id) => assert.deepEqual(spot(more.get(id)), spot(place), id));
    const newcomer = more.get("new-leopard")!;
    more.forEach((place, id) => {
        if (id !== "new-leopard") assert.ok(Math.hypot(place.x - newcomer.x, place.z - newcomer.z) > 0.9, `the newcomer on ${id}`);
    });
});
