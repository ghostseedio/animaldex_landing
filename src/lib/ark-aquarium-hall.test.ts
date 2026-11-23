/**
 * The aquarium hall (graphics pass 2, lane AQUA; the owner, 2026-11-16: "make them in a mall or massive building with
 * massive tanks of different shapes ... rocks and artificial water caves where fish hide inside ... like I'm seeing a
 * whale inside just stuck between 2 glass panels"): one hall over both aquarium plots, its tanks inside it and apart,
 * every real aquarium species in a tank that holds it, swimming a loop that keeps its whole body inside the glass all
 * day, the biggest (the whale shark) and every kept cetacean in the open ocean, and the hiders in their caves part of
 * the time.
 */
import assert from "node:assert/strict";
import test from "node:test";
import type {ArkAnimal} from "@/ark-scene/types";
import {launchEnclosures, zooLayout} from "@/ark-scene/islands/town/areas";
import {aquariumHall, caveVisit, hallLoop, inAquariumHall} from "@/ark-scene/islands/town/aquarium-hall";
import {aquariumTankOf, aquariumTanks, tankBody, tankBox, tankPose, zooHouseFloors, zooHouseFrame, type Tank} from "@/ark-scene/islands/town/tanks";
import {townPlan} from "@/ark-scene/islands/town/plan";
import {placeTownAnimals} from "@/ark-scene/islands/town/placement";
import {validateTownAnimals} from "@/ark-scene/islands/town/validate-animals";
import {boxesOverlap, corners, inBox, toLocal} from "@/ark-scene/islands/town/geom";
import {arkBody} from "@/ark-scene/stats";
import {modelBase} from "@/ark-scene/grounding/base";
import {clearOfHallRocks, hallRockList, rockMeasure} from "@/ark-scene/islands/town/hall-rocks";

/** Every species the real Ark keeps in its aquarium (the saved read of 2026-11-16: 66 species, 92 animals), with its zone. */
const AQUARIUM: Array<[string, string]> = [
    ["alligator-gar", "river_lake"], ["american-paddlefish", "river_lake"], ["arapaima", "river_lake"], ["bicolor-parrotfish", "coral_reef"], ["blacktip-reef-shark", "coral_reef"], ["blue-tang", "coral_reef"],
    ["blueface-angelfish", "coral_reef"], ["bluespine-unicornfish", "coral_reef"], ["bluestreak-cleaner-wrasse", "coral_reef"], ["bristlenose-pleco", "river_lake"], ["brownbanded-bamboo-shark", "coral_reef"],
    ["chocolate-chip-sea-star", "coral_reef"], ["clown-knifefish", "river_lake"], ["clown-triggerfish", "coral_reef"], ["commersons-frogfish", "coral_reef"], ["common-octopus", "coral_reef"], ["common-seahorse", "coral_reef"],
    ["dugong", "seashore"], ["european-sturgeon", "river_lake"], ["flathead-catfish", "river_lake"], ["giant-gourami", "river_lake"], ["giant-moray", "coral_reef"], ["gray-angelfish", "coral_reef"],
    ["greater-amberjack", "open_ocean"], ["green-sea-turtle", "coral_reef"], ["guppy", "river_lake"], ["humphead-wrasse", "coral_reef"], ["iridescent-shark", "river_lake"], ["japanese-spider-crab", "open_ocean"],
    ["koi", "farm_garden"], ["largetooth-sawfish", "open_ocean"], ["leopard-shark", "open_ocean"], ["leopoldi-stingray", "river_lake"], ["long-spined-porcupinefish", "coral_reef"], ["long-spined-sea-urchin", "coral_reef"],
    ["longspine-snipefish", "coral_reef"], ["mangrove-horseshoe-crab", "wetland"], ["moon-jellyfish", "open_ocean"], ["moorish-idol", "coral_reef"], ["nurse-shark", "coral_reef"], ["ocellaris-clownfish", "coral_reef"],
    ["oscar-fish", "farm_garden"], ["rainbow-trout", "river_lake"], ["razorfish", "coral_reef"], ["red-bellied-pacu", "river_lake"], ["red-bellied-piranha", "river_lake"], ["red-lionfish", "coral_reef"],
    ["red-swamp-crayfish", "wetland"], ["red-tailed-tinfoil-barb", "river_lake"], ["reticulated-river-stingray", "river_lake"], ["rosy-tetra", "river_lake"], ["siamese-algae-eater", "river_lake"], ["snubnose-pompano", "open_ocean"],
    ["spotted-jellyfish", "open_ocean"], ["spotted-wobbegong", "coral_reef"], ["stars-and-stripes-pufferfish", "coral_reef"], ["sterlet-sturgeon", "river_lake"], ["streaked-gurnard", "open_ocean"], ["tadpole-shrimp", "river_lake"],
    ["warty-frogfish", "coral_reef"], ["whale-shark", "open_ocean"], ["white-seabream", "open_ocean"], ["yellow-tang", "coral_reef"], ["yellowfin-surgeonfish", "coral_reef"], ["zebra-moray-eel", "coral_reef"], ["zebra-shark", "coral_reef"]
];

function animal(i: number, slug: string, zone: string, enclosure: string): ArkAnimal {
    return {id: `aq-${String(i).padStart(4, "0")}-${slug}`, species_profile_id: `sp-${slug}`, name: slug, scientific_name: null, model_slug: slug, zone: zone as ArkAnimal["zone"], arrived_at: "2026-11-10T10:00:00Z", brought_by: {label: "x", named: false}, mine: false, area: "zoo", island: "town", enclosure} as ArkAnimal;
}

/** Two of each species, one in each of the two aquarium enclosures. */
function residents(): ArkAnimal[] {
    return AQUARIUM.flatMap(([slug, zone], k) => [animal(k * 2, slug, zone, "aquarium-1"), animal(k * 2 + 1, slug, zone, "aquarium-2")]);
}

const DAY = Date.UTC(2026, 10, 16) / 1000;

test("one hall over both aquarium plots: its tanks inside it and apart, both enclosures' frame the hall's", () => {
    const plan = townPlan();
    const hall = aquariumHall(plan)!;
    assert.ok(hall, "the hall stands");
    const layout = zooLayout(launchEnclosures(), plan);
    const aquariums = layout.enclosures.filter((e) => e.type === "aquarium" && !e.shared);
    assert.equal(aquariums.length, 2);
    for (const e of aquariums) {
        assert.ok(inAquariumHall(e, plan));
        assert.equal(zooHouseFrame(e), hall.frame, `${e.id} is drawn in the hall`);
        assert.equal(aquariumTanks(e).length, hall.tanks.length);
    }
    // The hall stands on the two plots only (their union), 12 m high, over 30 m across.
    const slots = aquariums.map((e) => e.slot.at);
    for (const c of corners(hall.frame.box)) assert.ok(slots.some((s) => inBox(s, c.x, c.z, 0.35)), "a corner on a plot");
    assert.ok(hall.frame.box.w > 30 && hall.frame.height >= 12);
    // Its floor once, for the two enclosures.
    assert.equal(zooHouseFloors(aquariums).length, 18);
    // Every tank's glass inside the hall's walls; no two tanks' glass overlap; different shapes.
    const forms = new Set(hall.tanks.map((t) => t.look));
    for (const look of ["ocean", "reef_wall", "jelly", "tunnel", "fresh", "reef"]) assert.ok(forms.has(look as never), look);
    for (const t of hall.tanks) {
        for (const c of corners(t.glass)) assert.ok(inBox(hall.frame.inner, c.x, c.z, 0.01), `${t.tank.id} inside the hall`);
        for (const u of hall.tanks) if (u !== t) assert.ok(!boxesOverlap(t.glass, u.glass, -0.2), `${t.tank.id} apart from ${u.tank.id}`);
        // Its swim room inside its glass; its caves inside its glass, each in its rockwork (outside the swim room or on its edge).
        const r = t.tank.swim!;
        assert.ok(r.x0 >= -t.glass.w / 2 && r.x1 <= t.glass.w / 2 && r.z0 >= -t.glass.d / 2 && r.z1 <= t.glass.d / 2);
        for (const cave of t.tank.caves ?? []) {
            assert.ok(inBox(t.glass, cave.x, cave.z, -cave.room + 1e-6), `${t.tank.id}'s cave in the glass`);
            assert.ok(cave.lx <= r.x0 + 0.01 || cave.lx >= r.x1 - 0.01 || cave.lz <= r.z0 + 0.01 || cave.lz >= r.z1 - 0.01 || cave.lx < r.x0 + 1 || cave.lz < r.z0 + 1, `${t.tank.id}'s cave by its rockwork`);
        }
    }
    // The ocean is the biggest, and big: the whale shark's.
    const ocean = hall.tanks.find((t) => t.look === "ocean")!;
    assert.ok(ocean.glass.w >= 18 && ocean.glass.d >= 18 && ocean.tank.top - ocean.tank.floor >= 7, "an ocean tank for the biggest");
});

test("every aquarium species has a tank that holds it: the big and every cetacean in the ocean, jellyfish in the cylinder", () => {
    const tanks = aquariumHall()!.tanks.map((t) => t.tank);
    const by = new Map<string, Tank>();
    for (const [slug, zone] of AQUARIUM) {
        const a = animal(0, slug, zone, "aquarium-2");
        const body = arkBody(a, modelBase(slug)?.plan ?? null);
        const tank = aquariumTankOf(a, body.display, tanks)!;
        assert.ok(tank, `${slug} has a tank`);
        by.set(slug, tank);
    }
    assert.equal(by.get("whale-shark")!.form, "ocean");
    assert.equal(by.get("largetooth-sawfish")!.form, "ocean");
    // (The dugong is the record's only kept cetacean-plan animal; a kept cetacean always goes to the biggest tank.)
    assert.equal(modelBase("dugong")?.plan, "cetacean");
    assert.equal(by.get("dugong")!.form, "ocean");
    assert.equal(by.get("moon-jellyfish")!.form, "jelly");
    assert.equal(by.get("spotted-jellyfish")!.form, "jelly");
    assert.equal(by.get("arapaima")!.form, "tunnel");
    assert.equal(by.get("ocellaris-clownfish")!.form, "reef");
    assert.equal(by.get("rosy-tetra")!.form, "fresh");
    assert.equal(by.get("blue-tang")!.form, "reef_wall");
});

test("no animal stuck between panes: every resident's whole body inside its tank's glass and water, all day", () => {
    const placed = placeTownAnimals(residents());
    let samples = 0;
    let hidden = 0;
    let caves = 0;
    for (const a of residents()) {
        const info = placed.town.get(a.id)!;
        assert.ok(info.tank, `${a.model_slug} in a tank`);
        const t = info.tank!;
        const plan = modelBase(a.model_slug)?.plan ?? null;
        const display = arkBody(a, plan).display;
        const {length, width} = tankBody(a.model_slug, plan, display);
        const found = modelBase(a.model_slug)!;
        const height = (found.size.y / Math.max(found.size.z, 0.05)) * length;
        const box = tankBox(t);
        let inCave = 0;
        for (let k = 0; k < 480; k++) {
            const clock = DAY + k * 180 + (k % 7) * 3.7;
            const p = tankPose(t, a, display, height, plan, clock);
            samples++;
            const fx = Math.sin(p.yaw);
            const fz = Math.cos(p.yaw);
            for (const [u, v] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
                const x = p.x + fx * (u * length) / 2 + fz * (v * width) / 2;
                const z = p.z + fz * (u * length) / 2 - fx * (v * width) / 2;
                const l = toLocal(box, x, z);
                assert.ok(Math.abs(l.x) <= t.w / 2 + 0.01 && Math.abs(l.z) <= t.d / 2 + 0.01, `${a.model_slug} (${length.toFixed(2)} × ${width.toFixed(2)} m) through the glass of ${t.id} at ${clock}`);
                if (t.round) assert.ok(Math.hypot(l.x, l.z) <= t.round + 0.01, `${a.model_slug} through the cylinder's glass`);
            }
            assert.ok(p.base >= t.floor - 0.3 * height - 0.01 && p.base <= t.top, `${a.model_slug} in the water's column (${p.base.toFixed(2)} in ${t.floor.toFixed(2)}–${t.top.toFixed(2)})`);
            if (p.spec.breath === 0 && p.motion !== "float") assert.ok(p.base + height <= t.top + 0.02, `${a.model_slug} under the surface`);
            if ((t.caves ?? []).some((c) => Math.hypot(c.x - p.x, c.z - p.z) < 1e-6)) inCave++;
        }
        if (inCave) caves++;
        hidden += inCave;
    }
    // The hiders spend a good share of the day in their caves: fewer seen at once.
    assert.ok(caves >= 30, `${caves} residents use a cave`);
    assert.ok(hidden / samples > 0.08, `hidden ${(100 * hidden / samples).toFixed(1)}% of the time`);
    console.log(`aquarium hall: ${samples} samples, ${caves} residents with a cave, hidden ${(100 * hidden / samples).toFixed(1)}% of all samples`);
});

test("the whale shark's loop: turns wider than a third of its length, round the ocean, never up and back between two panes", () => {
    const ocean = aquariumHall()!.tanks.find((t) => t.look === "ocean")!.tank;
    const shark = animal(1, "whale-shark", "open_ocean", "aquarium-2");
    const plan = modelBase("whale-shark")!.plan;
    const display = arkBody(shark, plan).display;
    const {length, width} = tankBody("whale-shark", plan, display);
    const out = {lx: 0, lz: 0, tx: 0, tz: 1};
    assert.ok(hallLoop(ocean.swim!, length, width, {size: 0, stretch: 0, ox: 0.5, oz: 0.5, dir: 1, start: 0}, 0.5, 0, out), "it has a loop");
    // Its heading turns all the way round over a lap (a loop, not a shuttle).
    const yaws = new Set<number>();
    for (let k = 0; k < 200; k++) {
        const p = tankPose(ocean, shark, display, 2, plan, DAY + k * 1.5);
        yaws.add(Math.round(((p.yaw + Math.PI * 4) % (Math.PI * 2)) / (Math.PI / 4)) % 8);
    }
    assert.equal(yaws.size, 8, "it faces every way round the lap");
});

test("a cave visit: leaves its loop, rests in its cave about two fifths of a few minutes, and comes back to where its loop is", () => {
    const cave = {x: 0, z: 0, y: 0, r: 0.5, room: 2, mouth: 0, lx: 0, lz: 0};
    let hidden = 0;
    for (let s = 0; s < 3000; s++) if (caveVisit(cave, {period: 0.5, share: 0.5, offset: 0.2}, DAY + s)) hidden++;
    assert.ok(hidden / 3000 > 0.3 && hidden / 3000 < 0.5, `${hidden / 3000}`);
});

// SIG3 (the aquarium's pile): fourteen reef-wall residents, the lionfish, the moray and an octopus among them, were all in one
// hollow at once, each on its own cycle (or, a hole-dweller, in it always).
test("a cave holds one body at a time: its residents take turns, and each of them is in it sometimes", () => {
    const placed = placeTownAnimals(residents());
    const roster: Array<{id: string; tank: string; model_slug: string; zone: string; length: number}> = [];
    const byId = new Map(residents().map((a) => [a.id, a]));
    placed.town.forEach((info, id) => {
        const a = byId.get(id);
        if (a && info.tank?.swim) roster.push({id, tank: info.tank.id, model_slug: a.model_slug, zone: a.zone, length: arkBody(a).display});
    });
    assert.ok(roster.length > 40, `${roster.length} in the hall's tanks`);
    const tanks = new Map<string, Tank>();
    placed.town.forEach((info) => info.tank?.swim && tanks.set(info.tank.id, info.tank));
    let most = 0;
    const hid = new Set<string>();
    const hiders = new Set<string>();
    for (let k = 0; k < 400; k++) {
        const clock = DAY + k * 37.3;
        const inCave = new Map<string, number>();
        for (const r of roster) {
            const t = tanks.get(r.tank)!;
            const plan = modelBase(r.model_slug)?.plan ?? null;
            const p = tankPose(t, {id: r.id, model_slug: r.model_slug, zone: r.zone}, r.length, r.length * 0.3, plan, clock, roster);
            const cave = (t.caves ?? []).find((c) => Math.hypot(c.x - p.x, c.z - p.z) < 0.02);
            if (!cave) continue;
            hiders.add(r.id);
            hid.add(r.id);
            const key = `${t.id}|${cave.lx}|${cave.lz}`;
            inCave.set(key, (inCave.get(key) ?? 0) + 1);
        }
        for (const n of inCave.values()) most = Math.max(most, n);
    }
    assert.equal(most, 1, "one body resting in a cave at a time");
    assert.ok(hid.size >= 10, `${hid.size} residents rested in a cave over the samples`);
});

test("the town's validator: nobody in the hall's glass, its walls or out of its water", () => {
    const check = validateTownAnimals(residents(), {schedule: false});
    assert.equal(check.counts.out_of_tank, 0, JSON.stringify(check.problems.filter((p) => p.problems.includes("out_of_tank")).slice(0, 5)));
    assert.equal(check.kinds.tank, check.animals > 0 ? check.kinds.tank : 0);
});

// p3 (solid): the owner, "I just saw a horse go through a bush": the fish neither. Through a cave only where a cave is.
test("the hall's residents swim and walk round its rocks (over a low one, never through one), into the rock only by a cave", () => {
    const placed = placeTownAnimals(residents());
    const {all} = hallRockList();
    assert.ok(all.length > 100, `${all.length} rocks in the hall`);
    let samples = 0;
    let before = 0;
    let inRock = 0;
    let caved = 0;
    const bad: string[] = [];
    for (const a of residents()) {
        const t = placed.town.get(a.id)!.tank!;
        const rocks = hallRockList().byTank.get(t.id) ?? [];
        const plan = modelBase(a.model_slug)?.plan ?? null;
        const display = arkBody(a, plan).display;
        const {length, width} = tankBody(a.model_slug, plan, display);
        const found = modelBase(a.model_slug)!;
        const height = (found.size.y / Math.max(found.size.z, 0.05)) * length;
        const box = tankBox(t);
        for (let k = 0; k < 480; k++) {
            const clock = DAY + k * 180 + (k % 7) * 3.7;
            const raw = tankPose(t, a, display, height, plan, clock);
            const p = clearOfHallRocks(t, raw, length, width, height);
            assert.deepEqual(clearOfHallRocks(t, raw, length, width, height), p, "the same for every viewer");
            samples++;
            if ((t.caves ?? []).some((c) => Math.hypot(c.x - p.x, c.z - p.z) < c.r * 1.3 + length * 0.6)) {
                caved++;
                continue;
            }
            const inside = (q: {x: number; z: number; base: number}) => rocks.some((r) => q.base < r.y + r.sy - 0.01 && q.base + height > r.y + 0.02 && rockMeasure(r, q.x, q.z, Math.max(width / 2, 0.02)) < 1);
            if (inside(raw)) before++;
            if (inside(p)) {
                inRock++;
                if (bad.length < 5) bad.push(`${a.model_slug} in ${t.id} at ${clock}`);
            }
            const l = toLocal(box, p.x, p.z);
            assert.ok(Math.abs(l.x) <= t.w / 2 + 0.01 && Math.abs(l.z) <= t.d / 2 + 0.01, `${a.model_slug} kept in its glass`);
            assert.ok(p.base + height <= t.top + 0.02 || p.spec.breath > 0 || p.motion === "float", `${a.model_slug} under the surface`);
        }
    }
    console.log(`aquarium rocks: ${samples} samples, ${before} in a rock before, ${inRock} after, ${caved} at a cave`);
    assert.equal(inRock, 0, `in a rock: ${bad.join("; ")}`);
    assert.ok(caved > samples * 0.08, "the caves still used");
});
