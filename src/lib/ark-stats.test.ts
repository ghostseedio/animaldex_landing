import assert from "node:assert/strict";
import test from "node:test";
import fixtureV2 from "@/ark-scene/fixtures/snapshot-v2.json";
import {mealStage, type ActBody} from "@/ark-scene/acts";
import {allocateArkPlaces, placeAnimals, slotKind, zoneLayout} from "@/ark-scene/placement";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import {arkBody, bodyAxisExtent, arkIdleBehaviour, arkStats, bodyLengthsPerSecond, glance, glancePeriod, massFromSize, moveSpeed} from "@/ark-scene/stats";
import sizesTable from "@/ark-scene/species-stats.json";
import type {ArkAnimal} from "@/ark-scene/types";
import {ZONE_SITES} from "@/ark-scene/world";

const near = (actual: number, expected: number, within: number, what: string) => assert.ok(Math.abs(actual - expected) <= within, `${what}: ${actual} not ${expected}`);

test("size is true to life (motion pass §3): the stored length, else the data-gap value, else the size stat; no curve, no floor, no cap", () => {
    // From the live catalogue and the data-gap lengths (scripts/ark-species-stats.mts; docs/ark/true-scale.md).
    const ladybird = arkBody({model_slug: "seven-spot-ladybird"});
    assert.ok(ladybird.metres > 0.004 && ladybird.metres < 0.01, `ladybird ${ladybird.metres}`);
    assert.ok(ladybird.display < 0.012, "a ladybird is drawn its own size, not at a floor");
    assert.equal(ladybird.floor, false);
    const mouse = arkBody({model_slug: "house-mouse"});
    assert.equal(mouse.source, "stored");
    near(mouse.metres, 0.09, 0.005, "mouse head and body (7.5-10 cm)");
    assert.ok(mouse.display > 0.09 && mouse.display < 0.25, `mouse drawn with its tail ${mouse.display}`);
    // The humpback was drawn 3.5 m (its size stat is the elephant's); true to life it is about 14 m.
    const humpback = arkBody({model_slug: "humpback-whale"});
    assert.ok(humpback.display > 12 && humpback.display < 17, `humpback ${humpback.display}`);
    const blue = arkBody({model_slug: "blue-whale"});
    assert.ok(blue.display > 22, `a blue whale is no longer capped at 9 m: ${blue.display}`);
    const elephant = arkBody({model_slug: "african-bush-elephant"});
    assert.ok(blue.display > elephant.display * 3, "a blue whale is several elephants long");
    assert.ok(elephant.display > mouse.display * 20, "an elephant dwarfs a mouse");
    near(arkBody({model_slug: "polar-bear"}).metres, 2.5, 0.001, "polar bear stored");
    // The mass anchors read the other way: elephant 92 is 6 t (only an estimate, for species with no known length).
    near(massFromSize(92), 6000, 1, "size 92");
    near(massFromSize(100), 150_000, 1, "size 100");
    // The snapshot's own stored length wins; it is drawn in the table's proportion (its tail).
    const ownMouse = arkBody({model_slug: "house-mouse", length_m: 0.2});
    assert.equal(ownMouse.metres, 0.2);
    near(ownMouse.display / 0.2, mouse.display / mouse.metres, 1e-9, "drawn in the same proportion");
    // A known length wins over a size stat (which only estimates one); a species with only stats is estimated.
    near(arkBody({model_slug: "domestic-cat", stats: {size: 92}}).display, arkBody({model_slug: "domestic-cat"}).display, 1e-9, "the cat stays a cat");
    const unknown = arkBody({model_slug: "no-such-animal", stats: {size: 26}});
    assert.equal(unknown.source, "estimate");
    near(unknown.metres, 0.33 * Math.cbrt(5), 0.01, "size 26 is 5 kg");
    // A species the catalogue lacks: its body plan, labelled as such.
    assert.equal(arkBody({model_slug: "no-such-animal"}, "bird").source, "plan");
});

test("every species in the table has a true size and a source", () => {
    const table = sizesTable as unknown as {lengths: Record<string, [number, number, number]>; sources: string[]};
    const rows = Object.entries(table.lengths);
    assert.ok(rows.length > 2500, `${rows.length} sized`);
    for (const [slug, [drawn, metres, source]] of rows) {
        assert.ok(drawn > 0 && metres > 0, `${slug} has a length`);
        assert.ok(table.sources[source], `${slug} has a source`);
        assert.ok(drawn < 40 && metres < 40, `${slug}: ${drawn} m drawn, ${metres} m`);
    }
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
    // Upright bodies by their height: a penguin, an owl, a hawk sitting up, a seahorse. "Lowland" is not an owl.
    assert.equal(bodyAxisExtent("emperor-penguin", "bird", {x: 1.14, y: 1.91, z: 1}), 1.91);
    assert.equal(bodyAxisExtent("barn-owl", "bird", {x: 0.64, y: 1.32, z: 1}), 1.32);
    assert.equal(bodyAxisExtent("coopers-hawk", "bird", {x: 0.5, y: 1.3, z: 1}), 1.3);
    assert.equal(bodyAxisExtent("pot-bellied-seahorse", "fish", {x: 0.3, y: 1.83, z: 1}), 1.83);
    // A jellyfish by its bell across (its stated size is the bell's: "Bell 25-50 cm"), a hydra by its height (lane TB).
    assert.equal(bodyAxisExtent("moon-jellyfish", "jellyfish", {x: 1, y: 2.36, z: 0.98}), 1);
    assert.equal(bodyAxisExtent("common-hydra", "jellyfish", {x: 0.3, y: 1, z: 0.3}), 1);
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

test("speed: 0.6 to 2 body lengths a second, and a chase takes as long as its predator's pace says, ending over its prey", () => {
    assert.equal(bodyLengthsPerSecond(0), 0.6);
    assert.equal(bodyLengthsPerSecond(100), 2);
    assert.equal(bodyLengthsPerSecond(250), 2);
    const cheetah = arkBody({model_slug: "cheetah"}).display;
    const lion = arkBody({model_slug: "african-lion"}).display;
    assert.ok(moveSpeed({model_slug: "cheetah"}, cheetah) > moveSpeed({model_slug: "african-lion"}, lion) * 0.9);
    // (The meal's chase, `acts.ts` (motion pass, L7): its speed stat sets its sprint; it ends over its prey, wherever the
    // prey's darts took it. More in ark-chases.test.ts.)
    const prey: ActBody = {x: 0, z: 0, base: 0.5, yaw: 0, length: 1.6, height: 1};
    const hunter = (speedStat?: number): ActBody => ({x: -6, z: 0, base: 0.5, yaw: 0, length: 1.8, height: 1, speedStat});
    const plain = mealStage("glide", hunter(), prey);
    const fast = mealStage("glide", hunter(95), prey);
    const slow = mealStage("glide", hunter(15), prey);
    assert.ok(fast.catchAt! < plain.catchAt! && plain.catchAt! < slow.catchAt!, `${fast.catchAt} ${plain.catchAt} ${slow.catchAt}`);
    for (const stage of [fast, plain, slow]) {
        const at = stage.catchAt!;
        const end = stage.predator(at)!;
        const caught = stage.prey(at);
        assert.ok(Math.hypot(end.x - caught.x, end.z - caught.z) < 1.8 * 0.5 + 1.6 * 0.6, "over its prey at the catch");
        assert.ok(stage.prey(stage.seconds).hidden);
    }
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
