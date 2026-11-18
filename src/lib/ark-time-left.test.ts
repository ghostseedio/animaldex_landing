import assert from "node:assert/strict";
import {existsSync, readFileSync} from "node:fs";
import os from "node:os";
import path from "node:path";
import {pathToFileURL} from "node:url";
import test from "node:test";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import {ARK_LANGUAGES} from "@/lib/ark-languages";
import {
    ARK_TIME_LEFT_ANIMAL_FIELDS,
    ARK_TIME_LEFT_ENGLISH,
    ARK_TIME_LEFT_HOOKS,
    ARK_TIME_LEFT_PROPOSED,
    ARK_TIME_LEFT_SNAPSHOT_FIELDS,
    ARK_TIME_LEFT_WORLD_FIELDS,
    arkAdultAgeDays,
    arkAtRisk,
    arkMealIntervalDays,
    arkNeedsFacts,
    arkStarveDays,
    arkTimeLeft,
    arkTimeLeftText,
    arkTimeLeftWordsFrom,
    arkTimeLeftWorldOf,
    type ArkTimeLeft,
    type ArkTimeLeftAnimal,
    type ArkTimeLeftFacts,
    type ArkTimeLeftHook,
    type ArkTimeLeftWorld
} from "@/lib/ark-time-left";
import {
    ADULT_AGE,
    HUNT_SUCCESS,
    LIFESPAN_HI_OVER_LO,
    MEAL_INTERVAL,
    OLD_LIFE_FRACTION,
    PREY_FLOOR,
    RETRY_AFTER_MISS_DAYS,
    STARVE
} from "@/lib/ark-time-left-constants";
import {PREDATORS_READ, arkTimeLeftFor, readArkTimeLeftFacts, type ArkTimeLeftFetch} from "@/lib/ark-time-left-facts";

// MARK: Fixtures

const FOX = "kind-fox";
const VOLE = "kind-vole";
const HEDGE = "kind-hedgehog";
const ARK_DAY = 260;

function animal(kind: string, slug: string, over: Partial<ArkTimeLeftAnimal> = {}): ArkTimeLeftAnimal {
    return {
        species_profile_id: kind,
        model_slug: slug,
        zone: "woodland",
        island: "wild",
        area: null,
        origin: "arrived",
        condition: "well_fed",
        born_ark_day: 150,
        lifespan_days: 1826,
        lifespan_estimate: false,
        ...over
    };
}

const vole = (over: Partial<ArkTimeLeftAnimal> = {}) => animal(VOLE, "field-vole", {lifespan_days: 240, ...over});
const hedge = (over: Partial<ArkTimeLeftAnimal> = {}) => animal(HEDGE, "european-hedgehog", over);
const fox = (over: Partial<ArkTimeLeftAnimal> = {}) => animal(FOX, "red-fox", over);

function worldOf(animals: ArkTimeLeftAnimal[], over: Partial<ArkTimeLeftWorld> = {}): ArkTimeLeftWorld {
    return {arkDay: ARK_DAY, animals, huntGrace: {endsArkDay: 120, rampArkDays: 40}, ...over};
}

const FOX_FACTS: ArkTimeLeftFacts = {eatsAnimals: false, predators: [{id: FOX, slug: "red-fox", name: "Red Fox", preyKinds: [VOLE, HEDGE]}]};

/** A hedgehog in a wood with `hedgehogs` of its kind and `foxes` foxes, the protection over. */
function wood(hedgehogs = 4, foxes = 2, over: Partial<ArkTimeLeftWorld> = {}) {
    const me = hedge();
    const animals = [me, ...Array.from({length: hedgehogs - 1}, () => hedge()), ...Array.from({length: foxes}, () => fox())];
    return {me, world: worldOf(animals, over)};
}

const range = (r: ArkTimeLeft | null): [number, number] => {
    assert.ok(r, "an estimate");
    return [r.lowDays, r.highDays];
};

/** B is no better than A: both ends no later. */
function assertNoBetter(better: ArkTimeLeft | null, worse: ArkTimeLeft | null, label: string) {
    const [a, b] = range(better);
    const [c, d] = range(worse);
    assert.ok(c <= a && d <= b, `${label}: [${c}, ${d}] should not exceed [${a}, ${b}]`);
}

function rng(seed: number) {
    let s = seed >>> 0;
    return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// MARK: Who is at risk

test("not at risk: a well-fed animal in the middle of its life, with no predator around", () => {
    const me = hedge();
    assert.deepEqual(arkAtRisk(me, worldOf([me, hedge(), hedge()]), FOX_FACTS), []);
    assert.equal(arkTimeLeft(me, worldOf([me]), null), null);
});

test("old: the read's flag, or its rule again when hunger hides it", () => {
    const flagged = hedge({condition: "old"});
    assert.deepEqual(arkAtRisk(flagged, worldOf([flagged]), null), ["old"]);
    // Hungry hides old in the read (one condition): 4/5 of the lower end since it came aboard is the read's own rule.
    const hiding = vole({condition: "hungry", born_ark_day: ARK_DAY - OLD_LIFE_FRACTION * 240 - 1});
    assert.deepEqual(arkAtRisk(hiding, worldOf([hiding]), null), ["old"]);
    const young = vole({born_ark_day: ARK_DAY - 100});
    assert.deepEqual(arkAtRisk(young, worldOf([young]), null), []);
});

test("hunted: a predator of its kind in its region, its kind at the floor, the protection over, and the protection known", () => {
    const {me, world} = wood();
    assert.deepEqual(arkAtRisk(me, world, FOX_FACTS), ["hunted"]);
    // no published protection: the hunting factor is off, never assumed
    assert.deepEqual(arkAtRisk(me, {...world, huntGrace: null}, FOX_FACTS), []);
    // the protection is not over yet: nothing hunts it
    assert.deepEqual(arkAtRisk(me, {...world, huntGrace: {endsArkDay: ARK_DAY + 5, rampArkDays: 40}}, FOX_FACTS), []);
    // the engine never hunts a kind below the floor of 3 in the region
    assert.deepEqual(arkAtRisk(wood(PREY_FLOOR - 1, 2).me, wood(PREY_FLOOR - 1, 2).world, FOX_FACTS), []);
    assert.deepEqual(arkAtRisk(wood(PREY_FLOOR, 2).me, wood(PREY_FLOOR, 2).world, FOX_FACTS), ["hunted"]);
    // no predator in its region (a fox on the other island does not hunt here)
    const far = wood(4, 0);
    far.world.animals = [...far.world.animals, fox({island: "town"}), fox({zone: "open_ocean"})];
    assert.deepEqual(arkAtRisk(far.me, far.world, FOX_FACTS), []);
    // kept animals are fed by their keepers: not hunted (a zoo, a house, a farm)
    for (const area of ["zoo", "house", "farm"] as const) {
        const kept = hedge({area});
        const w = worldOf([kept, hedge({area}), hedge({area}), hedge({area}), fox(), fox()]);
        assert.deepEqual(arkAtRisk(kept, w, FOX_FACTS), [], area);
    }
    // no facts read yet: nothing about predators is claimed
    assert.deepEqual(arkAtRisk(me, world, null), []);
});

test("starving: only a hungry animal whose kind eats catalogue animals", () => {
    const hungry = fox({condition: "hungry"});
    const w = worldOf([hungry]);
    assert.deepEqual(arkAtRisk(hungry, w, {eatsAnimals: true, predators: []}), ["starving"]);
    // a hungry herbivore cannot starve
    assert.deepEqual(arkAtRisk(hungry, w, {eatsAnimals: false, predators: []}), []);
    // not hungry: not starving
    assert.deepEqual(arkAtRisk(fox(), w, {eatsAnimals: true, predators: []}), []);
    // facts not read: not claimed
    assert.deepEqual(arkAtRisk(hungry, w, null), []);
});

test("the facts are read only where they can matter", () => {
    const {me, world} = wood();
    assert.equal(arkNeedsFacts(me, world), true, "wild with a published protection");
    assert.equal(arkNeedsFacts(me, {...world, huntGrace: null}), false, "no protection published: nothing to ask");
    assert.equal(arkNeedsFacts(hedge({area: "zoo"}), world), false, "kept");
    assert.equal(arkNeedsFacts(hedge({condition: "hungry", area: "zoo"}), world), true, "hungry: does its kind eat animals?");
    assert.equal(arkNeedsFacts(hedge({condition: "old"}), {...world, huntGrace: null}), false, "old needs none");
});

// MARK: The estimate

test("a range of whole Ark days, never 0 or negative, low at most high, with the reasons that move it", () => {
    const {me, world} = wood();
    const r = arkTimeLeft(me, world, FOX_FACTS)!;
    assert.ok(Number.isInteger(r.lowDays) && Number.isInteger(r.highDays));
    assert.ok(r.lowDays >= 1 && r.highDays >= r.lowDays);
    assert.deepEqual(r.atRisk, ["hunted"]);
    // a young animal: its age does not move the range, so it is not a reason; the hunters are
    assert.deepEqual(r.reasons.map((x) => x.kind), ["hunted"]);
    const hunted = r.reasons[0];
    assert.ok(hunted.kind === "hunted" && hunted.predators[0].name === "Red Fox" && hunted.predators[0].count === 2);
    // an old one: its age is the reason, the lifespan's upper end is not in the read yet (assumed, and said so), and so are the hunters
    const old = {...me, condition: "old" as const, born_ark_day: ARK_DAY - 1500};
    const both = arkTimeLeft(old, {...world, animals: [old, ...world.animals]}, FOX_FACTS)!;
    assert.deepEqual(both.reasons.map((x) => x.kind), ["age", "hunted"]);
    const age = both.reasons[0];
    assert.ok(age.kind === "age" && age.estimate && age.lifespanHighDays === 1826 * LIFESPAN_HI_OVER_LO.median);
    assert.equal(both.estimate, true);
    // a starving predator: hunger is the reason, its age is not
    const hungry = fox({condition: "hungry"});
    assert.deepEqual(arkTimeLeft(hungry, worldOf([hungry]), {eatsAnimals: true, predators: []})!.reasons.map((x) => x.kind), ["hunger"]);
});

test("an animal past the upper end of its lifespan still has at least a day", () => {
    const ancient = hedge({condition: "old", born_ark_day: -5000});
    const r = arkTimeLeft(ancient, worldOf([ancient]), null)!;
    assert.ok(r.lowDays >= 1 && r.highDays >= 1 && r.highDays <= 10, `${r.lowDays}-${r.highDays}`);
});

test("a published upper end replaces the assumed one and the estimate flag follows the lifespan's own", () => {
    const me = hedge({condition: "old", born_ark_day: 100, lifespan_days: 1000, lifespan_days_hi: 1200});
    const r = arkTimeLeft(me, worldOf([me]), null)!;
    const age = r.reasons[0];
    assert.ok(age.kind === "age" && age.lifespanHighDays === 1200 && age.estimate === false);
    assert.equal(r.estimate, false);
    const estimated = {...me, lifespan_estimate: true};
    assert.equal(arkTimeLeft(estimated, worldOf([estimated]), null)!.estimate, true);
});

test("an arrival counts as grown on arrival: older in the engine than the days it has been aboard", () => {
    const arrived = hedge({condition: "old", origin: "arrived", born_ark_day: 100});
    const born = hedge({condition: "old", origin: "born", born_ark_day: 100});
    assertNoBetter(arkTimeLeft(born, worldOf([born]), null), arkTimeLeft(arrived, worldOf([arrived]), null), "arrived vs born");
    assert.equal(arkAdultAgeDays(1000, 3000), 0.15 * 2000);
});

test("hunger: a starving predator has days, not years", () => {
    const hungry = fox({condition: "hungry"});
    const r = arkTimeLeft(hungry, worldOf([hungry]), {eatsAnimals: true, predators: []})!;
    assert.ok(r.highDays <= STARVE.maxDays, `${r.highDays}`);
    assert.ok(r.reasons.some((x) => x.kind === "hunger"));
});

test("the hunting protection is a reason, and delays the hazard", () => {
    const {me, world} = wood(4, 2, {huntGrace: {endsArkDay: 100, rampArkDays: 20}});
    const old = {...me, condition: "old" as const};
    const during = arkTimeLeft(old, {...world, arkDay: 80}, FOX_FACTS)!;
    assert.deepEqual(during.reasons.filter((x) => x.kind === "safe"), [{kind: "safe", untilArkDay: 100}]);
    const after = arkTimeLeft(old, world, FOX_FACTS)!;
    assert.deepEqual(after.reasons.filter((x) => x.kind === "safe"), []);
});

// MARK: Monotone in each factor

test("monotone: more age, never more time", () => {
    let last: ArkTimeLeft | null = null;
    for (const age of [0, 100, 400, 900, 1500, 1900, 2500, 3500, 5000]) {
        const me = hedge({condition: "old", born_ark_day: ARK_DAY - age});
        const r = arkTimeLeft(me, worldOf([me]), null);
        if (last && r) assertNoBetter(last, r, `age ${age}`);
        last = r;
    }
});

test("monotone: a longer lifespan, never less time; a later upper end, never less time", () => {
    const at = (low: number, high?: number) => {
        const me = hedge({condition: "old", born_ark_day: 100, lifespan_days: low, lifespan_days_hi: high ?? null});
        return arkTimeLeft(me, worldOf([me]), null);
    };
    assertNoBetter(at(2000), at(1000), "lower end");
    assertNoBetter(at(1000, 3000), at(1000, 1500), "upper end");
});

test("monotone: hungry is never better than fed; more predators never better; a faster hunter never better", () => {
    const {me, world} = wood(4, 1);
    const one = arkTimeLeft(me, world, FOX_FACTS);
    assertNoBetter(one, arkTimeLeft(me, wood(4, 2).world, FOX_FACTS), "two foxes");
    assertNoBetter(arkTimeLeft(me, wood(4, 2).world, FOX_FACTS), arkTimeLeft(me, wood(4, 5).world, FOX_FACTS), "five foxes");
    // a published meal interval: shorter means more hunts
    const interval = (days: number) => {
        const foxes = [fox({hunt_interval_days: days}), fox({hunt_interval_days: days})];
        return arkTimeLeft(me, worldOf([me, hedge(), hedge(), hedge(), ...foxes]), FOX_FACTS);
    };
    assertNoBetter(interval(300), interval(100), "interval 100 vs 300");
    assertNoBetter(interval(100), interval(20), "interval 20 vs 100");
    // hungry on top of old
    const old = hedge({condition: "old", born_ark_day: 100});
    const hungry = hedge({condition: "hungry", born_ark_day: 100});
    const facts: ArkTimeLeftFacts = {eatsAnimals: true, predators: []};
    assertNoBetter(arkTimeLeft(old, worldOf([old]), facts), arkTimeLeft(hungry, worldOf([hungry]), facts), "hungry");
});

test("monotone: more animals it may be mistaken for, never less time; a later end of the protection, never less time", () => {
    const base = wood(4, 2);
    const crowded = wood(4, 2);
    crowded.world.animals = [...crowded.world.animals, ...Array.from({length: 6}, () => vole())];
    assertNoBetter(arkTimeLeft(crowded.me, crowded.world, FOX_FACTS), arkTimeLeft(base.me, base.world, FOX_FACTS), "more prey in the region");
    let last: ArkTimeLeft | null = null;
    for (const end of [0, 100, 250, 300, 500, 900]) {
        const old = {...base.me, condition: "old" as const};
        const r = arkTimeLeft(old, {...base.world, huntGrace: {endsArkDay: end, rampArkDays: 40}}, FOX_FACTS);
        if (last && r) assertNoBetter(r, last, `protection ends ${end}`);
        last = r;
    }
});

test("monotone: a surer catch is never better for the prey", () => {
    const sure = "696281b7-35ee-4f2a-b571-cbd4dd3d7522"; // Common Snapping Turtle: [0.15, 0.15]
    const buzzard = "9064b7e7-4441-4820-bcf2-bd5cdc678eba"; // Common Buzzard: [0.275, 0.275]
    assert.ok(sure in HUNT_SUCCESS && buzzard in HUNT_SUCCESS);
    const me = hedge();
    const withPredator = (id: string, slug: string) =>
        arkTimeLeft(me, worldOf([me, hedge(), hedge(), animal(id, slug, {hunt_interval_days: 5})]), {eatsAnimals: false, predators: [{id, slug, name: slug, preyKinds: [HEDGE]}]});
    // the same interval, a different success: the retry cost is a step, so the difference is tiny but never in the wrong direction
    assertNoBetter(withPredator(sure, "a"), withPredator("kind-sure", "b"), "a predator that always catches");
});

test("a hook adds an extra curve and a reason; none is built in today (wounds E5, wild skill P1-8)", () => {
    assert.equal(ARK_TIME_LEFT_HOOKS.length, 0);
    const old = hedge({condition: "old", born_ark_day: 100});
    const w = worldOf([old]);
    const wounds: ArkTimeLeftHook = () => ({survival: (t) => Math.max(0, 1 - t / 30), reason: {kind: "wounds"}});
    const plain = arkTimeLeft(old, w, null)!;
    const hurt = arkTimeLeft(old, w, null, [wounds])!;
    assertNoBetter(plain, hurt, "a wound");
    assert.ok(hurt.reasons.some((x) => x.kind === "wounds"));
    assert.ok(hurt.highDays <= 30);
    const silent: ArkTimeLeftHook = () => null;
    assert.deepEqual(arkTimeLeft(old, w, null, [silent]), plain);
});

// MARK: Properties

test("property: over random worlds the range is whole days, 1 <= low <= high <= 100 Ark years, with no NaN", () => {
    const random = rng(20261118);
    const slugs = ["red-fox", "field-vole", "european-hedgehog", "common-buzzard", "komodo-dragon", "blue-whale", "house-fly"];
    for (let i = 0; i < 1500; i++) {
        const pick = <T,>(xs: readonly T[]) => xs[Math.floor(random() * xs.length)];
        const make = (): ArkTimeLeftAnimal => {
            const slug = pick(slugs);
            return animal(`kind-${slug}`, slug, {
                zone: pick(["woodland", "grassland", "open_ocean", "river_lake", "farm_garden"] as const),
                island: pick(["wild", "wild", "town", undefined] as const),
                area: pick([null, null, null, "house", "farm", "zoo"] as const),
                origin: pick(["arrived", "born"] as const),
                condition: pick(["well_fed", "hungry", "old", null] as const),
                born_ark_day: random() < 0.1 ? null : random() * 400 - 20,
                lifespan_days: random() < 0.1 ? null : 5 + random() * 30000,
                lifespan_days_hi: random() < 0.5 ? null : 40000 + random() * 20000,
                lifespan_estimate: random() < 0.5,
                hunt_interval_days: random() < 0.3 ? 1 + random() * 400 : null
            });
        };
        const animals = Array.from({length: 1 + Math.floor(random() * 30)}, make);
        const me = animals[0];
        const world = worldOf(animals, {arkDay: random() * 600, huntGrace: random() < 0.2 ? null : {endsArkDay: random() * 600, rampArkDays: random() * 60}});
        const kinds = Array.from(new Set(animals.map((a) => a.species_profile_id)));
        const facts: ArkTimeLeftFacts | null = random() < 0.15 ? null : {
            eatsAnimals: random() < 0.5,
            predators: kinds.slice(0, 3).map((k) => ({id: k, slug: k.replace("kind-", ""), name: k, preyKinds: random() < 0.3 ? null : kinds}))
        };
        const r = arkTimeLeft(me, world, facts);
        if (!r) continue;
        assert.ok(Number.isInteger(r.lowDays) && Number.isInteger(r.highDays), `${r.lowDays}-${r.highDays}`);
        assert.ok(r.lowDays >= 1 && r.highDays >= r.lowDays && r.highDays <= 36500, `${r.lowDays}-${r.highDays}`);
        assert.ok(r.atRisk.length > 0 && r.reasons.length > 0);
    }
});

test("property: older never has more time, over random animals", () => {
    const random = rng(7);
    for (let i = 0; i < 500; i++) {
        const low = 50 + random() * 20000;
        const born = random() * 200;
        const a = hedge({condition: "old", born_ark_day: born, lifespan_days: low});
        const b = {...a, born_ark_day: born - random() * 5000};
        assertNoBetter(arkTimeLeft(a, worldOf([a]), null), arkTimeLeft(b, worldOf([b]), null), `lifespan ${low}`);
    }
});

// MARK: Released fields only (no look-ahead)

function recorded<T extends object>(target: T, reads: Set<string>): T {
    return new Proxy(target, {
        get(obj, key, receiver) {
            if (typeof key === "string") reads.add(key);
            return Reflect.get(obj, key, receiver);
        }
    });
}

const DECOYS = {
    natural_death_day: 261.5,
    death_day: 262,
    drawn_lifespan_days: 5,
    lifespan_draw: 0.01,
    seed: "secret",
    rng: 7,
    next_hunt_ark_day: 261,
    hunt_draw: 0.001,
    next_event: "eaten",
    will_die_at: 261,
    ramp_fraction: 0,
    prey_from: 120,
    last_meal_ark_day: 100,
    hungry_since: 90
};

test("no look-ahead: the estimate touches only the released snapshot's fields", () => {
    const worldReads = new Set<string>();
    const animalReads = new Set<string>();
    const {me, world} = wood();
    const hungry = fox({condition: "hungry"});
    for (const subject of [me, vole({condition: "old"}), hungry]) {
        const animals = [subject, ...world.animals].map((a) => recorded(a, animalReads));
        const watched = recorded({...world, animals}, worldReads);
        arkTimeLeft(recorded(subject, animalReads), watched, {eatsAnimals: true, predators: FOX_FACTS.predators}, ARK_TIME_LEFT_HOOKS);
        arkAtRisk(recorded(subject, animalReads), watched, FOX_FACTS);
        arkNeedsFacts(recorded(subject, animalReads), watched);
    }
    const allowedAnimal = new Set<string>(ARK_TIME_LEFT_ANIMAL_FIELDS);
    const allowedWorld = new Set<string>(ARK_TIME_LEFT_WORLD_FIELDS);
    for (const key of Array.from(animalReads)) assert.ok(allowedAnimal.has(key), `reads animal.${key}`);
    for (const key of Array.from(worldReads)) assert.ok(allowedWorld.has(key), `reads world.${key}`);
    // the world is built from the snapshot's own fields only
    const snapshotReads = new Set<string>();
    arkTimeLeftWorldOf(recorded({ark_day: 260, animals: [me], hunt_grace: {ends_ark_day: 1, ramp_ark_days: 2}} as never, snapshotReads));
    const allowedSnapshot = new Set<string>(ARK_TIME_LEFT_SNAPSHOT_FIELDS);
    for (const key of Array.from(snapshotReads)) assert.ok(allowedSnapshot.has(key), `reads snapshot.${key}`);
});

test("no look-ahead: planting the server's secrets (a drawn death day, a hunt draw, a next hunt, the seed) changes nothing", () => {
    const random = rng(99);
    for (let i = 0; i < 200; i++) {
        const {me, world} = wood(3 + Math.floor(random() * 4), 1 + Math.floor(random() * 4));
        const subject = {...me, condition: random() < 0.5 ? ("old" as const) : ("hungry" as const), born_ark_day: random() * 200};
        const clean = arkTimeLeft(subject, {...world, animals: [subject, ...world.animals]}, {eatsAnimals: true, predators: FOX_FACTS.predators});
        const tainted = (a: ArkTimeLeftAnimal) => ({...a, ...Object.fromEntries(Object.entries(DECOYS).map(([k, v]) => [k, typeof v === "number" ? v * random() : v]))});
        const dirty = arkTimeLeft(
            tainted(subject),
            {...world, animals: [subject, ...world.animals].map(tainted), ...DECOYS} as ArkTimeLeftWorld,
            {eatsAnimals: true, predators: FOX_FACTS.predators.map((p) => ({...p, ...DECOYS}))}
        );
        assert.deepEqual(dirty, clean);
    }
});

test("no look-ahead: the module names none of the engine's random draws or the unreleased reads", () => {
    for (const file of ["ark-time-left.ts", "ark-time-left-facts.ts", "ark-time-left-dom.ts", "ark-time-left-constants.ts"]) {
        const source = readFileSync(path.join(__dirname, file), "utf8");
        // Comments may name what is not used; code may not. Strip block and line comments before looking.
        const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
        for (const banned of ["naturalDeathDay", "rngFor", "hashUnit", "rampFraction", "preyFrom", "voyage_hunting", "/api/ark/hunting", "Math.random", "decodeArkHunting", "last_meal", "next_hunt", "seed"]) {
            assert.ok(!code.includes(banned), `${file} uses ${banned}`);
        }
    }
});

test("no look-ahead: every field it may read is in the decoded public snapshot (or marked proposed)", () => {
    const row: Record<string, unknown> = {
        id: "a1", species_profile_id: "k1", name: "Red Fox", model_slug: "red-fox", zone: "woodland", arrived_at: "2026-11-10T10:00:00Z", island: "wild", area: "zoo",
        origin: "born", condition: "old", born_ark_day: 12, lifespan_days: 500, lifespan_estimate: true, lifespan_days_hi: 900, hunt_interval_days: 40,
        stats: {size: 30}, kind_species_profile_id: "k0"
    };
    const decoded = decodeArkSnapshot({voyage: {slug: "first", name: "x", started_at: null, ark_day: 5, hunt_grace: {ends_ark_day: 100, ramp_ark_days: 20}}, animals: [row]})!;
    const first = decoded.animals[0] as unknown as Record<string, unknown>;
    for (const key of ARK_TIME_LEFT_ANIMAL_FIELDS) assert.ok(key in first, `the snapshot decoder does not carry animal.${key}`);
    assert.deepEqual(decoded.hunt_grace, {ends_ark_day: 100, ramp_ark_days: 20});
    const world = arkTimeLeftWorldOf(decoded)!;
    assert.equal(world.arkDay, 5);
    assert.deepEqual(world.huntGrace, {endsArkDay: 100, rampArkDays: 20});
    // the proposed ones are optional: a snapshot without them decodes and works (today's read)
    const today = decodeArkSnapshot({voyage: {slug: "first", name: "x", started_at: null}, animals: [{...row, lifespan_days_hi: undefined, hunt_interval_days: undefined}]})!;
    assert.equal(today.hunt_grace, undefined);
    assert.equal((today.animals[0] as unknown as Record<string, unknown>).lifespan_days_hi, undefined);
    assert.deepEqual(Array.from(ARK_TIME_LEFT_PROPOSED).sort(), ["huntGrace", "hunt_interval_days", "lifespan_days_hi"]);
});

// MARK: Facts

function chainBody(entry: unknown) {
    return {entry};
}

const sp = (id: string, slug: string, name: string) => ({id, slug, name, aboard: 1, page: null});

test("the facts: its own species, then at most four predators from its region, one request each", async () => {
    const calls: string[] = [];
    const bodies: Record<string, unknown> = {
        "european-hedgehog": chainBody({eats: [], eatenBy: [sp(FOX, "red-fox", "Red Fox"), sp("kind-owl", "tawny-owl", "Tawny Owl"), sp("kind-far", "far-away", "Far Away")].map((predator) => ({predator}))}),
        "red-fox": chainBody({eats: [{prey: [sp(VOLE, "field-vole", "Field Vole"), sp(HEDGE, "european-hedgehog", "European Hedgehog")]}], eatenBy: []})
    };
    const fetchJson: ArkTimeLeftFetch = async (url) => {
        calls.push(url);
        const slug = new URL(url, "http://x").searchParams.get("species") ?? "";
        return bodies[slug] ?? null;
    };
    const {me, world: base} = wood();
    const world = {...base, animals: [...base.animals, animal("kind-owl", "tawny-owl")]};
    const facts = (await readArkTimeLeftFacts(me, world, fetchJson))!;
    assert.equal(facts.eatsAnimals, false);
    // the far-away predator has no animal in the region: not read; the owl's own entry is missing: its prey kinds unknown
    assert.deepEqual(facts.predators.map((p) => [p.name, p.preyKinds]), [["Red Fox", [VOLE, HEDGE]], ["Tawny Owl", null]]);
    assert.deepEqual(calls.sort(), ["/api/ark/food-chain?species=european-hedgehog", "/api/ark/food-chain?species=red-fox", "/api/ark/food-chain?species=tawny-owl"]);
    assert.equal(PREDATORS_READ, 4);
    // the estimate from it, in one go
    const r = await arkTimeLeftFor(me, world, fetchJson);
    assert.ok(r && r.atRisk.includes("hunted"));
});

test("the facts: an unreadable species, or a slug that is not one, leaves them unknown and the risks that need none stand", async () => {
    const none: ArkTimeLeftFetch = async () => null;
    const {me, world} = wood();
    assert.equal(await readArkTimeLeftFacts(me, world, none), null);
    assert.equal(await readArkTimeLeftFacts({...me, model_slug: "../etc/passwd"}, world, async () => ({entry: {}})), null);
    assert.equal(await readArkTimeLeftFacts({...me, model_slug: "placeholder--x"}, world, async () => ({entry: {}})), null);
    const old = {...me, condition: "old" as const};
    const r = await arkTimeLeftFor(old, world, none);
    assert.ok(r && r.atRisk.join() === "old");
});

// MARK: Words

test("the words: units are the panel's own (`life.ageDays`), a range is one string, never a plural of its own", () => {
    const {words, units} = arkTimeLeftWordsFrom(undefined, undefined);
    assert.deepEqual(words, ARK_TIME_LEFT_ENGLISH);
    const result = (low: number, high: number, over: Partial<ArkTimeLeft> = {}): ArkTimeLeft => ({lowDays: low, highDays: high, capped: false, atRisk: ["old"], reasons: [], estimate: false, ...over});
    const at = (r: ArkTimeLeft) => arkTimeLeftText(r, words, units, "en").value;
    assert.equal(at(result(3, 9)), "About 3–9 Ark days");
    assert.equal(at(result(1, 1)), "About 1 Ark day");
    assert.equal(at(result(40, 1200)), "About 40–1,200 Ark days");
    assert.equal(at(result(400, 1900)), "About 1.1–5.2 Ark years");
    assert.equal(at(result(1000, 36500, {capped: true})), "About 2.7–100+ Ark years");
    const text = arkTimeLeftText(
        result(3, 9, {reasons: [{kind: "age", lifespanLowDays: 730, lifespanHighDays: 1460, estimate: true}, {kind: "hunted", predators: [{name: "Red Fox", count: 2}, {name: "Common Buzzard", count: 1}, {name: "Barn Owl", count: 1}]}, {kind: "hunger"}, {kind: "safe", untilArkDay: 1234}]}),
        words,
        units,
        "en"
    );
    assert.deepEqual(text.reasons, [
        "Typical lifespan, estimated: 2–4 Ark years",
        "Predators here: Red Fox, Common Buzzard, and Barn Owl",
        "Hunger: no recent meal",
        "Hunting protection until Ark day 1,234"
    ]);
    assert.equal(text.label, "Estimated time left: About 3–9 Ark days");
    // a bundle's own words win, English fills the rest
    const mixed = arkTimeLeftWordsFrom({title: "Restzeit"}, {ageDays: "{days} Tage"});
    assert.equal(mixed.words.title, "Restzeit");
    assert.equal(mixed.words.about, "About {value}");
    assert.equal(arkTimeLeftText(result(3, 9), mixed.words, mixed.units, "de").value, "About 3–9 Tage");
});

test("the words: every one of the 45 Ark languages has the eight keys, filled the same way as English", () => {
    const locales = path.join(__dirname, "..", "data", "locales");
    const english = JSON.parse(readFileSync(path.join(locales, "en.json"), "utf8")).ark.timeLeft as Record<string, string>;
    const expected: Record<string, string> = {...ARK_TIME_LEFT_ENGLISH};
    assert.deepEqual(english, expected);
    const holes = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort();
    assert.equal(ARK_LANGUAGES.length, 45);
    for (const language of ARK_LANGUAGES) {
        const file = language === "en" || language === "id" ? path.join(locales, `${language}.json`) : path.join(locales, "ark", `${language}.json`);
        const bundle = JSON.parse(readFileSync(file, "utf8")).ark.timeLeft as Record<string, string>;
        assert.deepEqual(Object.keys(bundle).sort(), Object.keys(english).sort(), language);
        for (const key of Object.keys(english)) {
            assert.ok(bundle[key]?.trim(), `${language}.${key} is empty`);
            assert.deepEqual(holes(bundle[key]), holes(english[key]), `${language}.${key}: placeholders differ`);
            if (language !== "en") assert.notEqual(bundle[key], english[key], `${language}.${key} is still English`);
        }
    }
});

// MARK: Lazily loaded

test("lazy: the card and Ark Lite reach the estimate only through a dynamic import (the page's static JavaScript is budgeted)", () => {
    const root = path.join(__dirname, "..");
    const card = readFileSync(path.join(root, "app/[locale]/(composited)/ark/ark-animal-card.tsx"), "utf8");
    const view = readFileSync(path.join(root, "app/[locale]/(composited)/ark/ark-view.tsx"), "utf8");
    const lite = readFileSync(path.join(root, "ark-scene/lite/lite-view.ts"), "utf8");
    const words = readFileSync(path.join(root, "lib/ark-words.ts"), "utf8");
    const staticValueImport = /^import (?!type)[^;]*from "@\/(lib\/ark-time-left[\w-]*|app\/\[locale\]\/\(composited\)\/ark\/ark-time-left)";/m;
    for (const [name, source] of Object.entries({card, view, lite, words})) assert.ok(!staticValueImport.test(source), `${name} imports the estimate statically`);
    assert.match(card, /lazy\(\(\) => import\("@\/app\/\[locale\]\/\(composited\)\/ark\/ark-time-left"\)\)/);
    assert.match(lite, /import\("@\/lib\/ark-time-left-dom"\)/);
});

// MARK: The engine's own numbers

const ENGINE_ROOT = [process.env.ARK_ENGINE_DIR, path.join(os.homedir(), "AnimalDex")].find((dir): dir is string => Boolean(dir) && existsSync(path.join(dir!, "supabase/functions/_shared/ark-ecology/rules.ts")));
const ENGINE = ENGINE_ROOT ? path.join(ENGINE_ROOT, "supabase/functions/_shared/ark-ecology") : null;
const engineTest = (name: string, run: () => Promise<void> | void) => test(`engine: ${name}${ENGINE ? "" : " (skipped: set ARK_ENGINE_DIR to an AnimalDex checkout)"}`, {skip: !ENGINE}, run);

async function engine() {
    const rules = await import(pathToFileURL(path.join(ENGINE!, "rules.ts")).href);
    const helpers = await import(pathToFileURL(path.join(ENGINE!, "test-helpers.ts")).href);
    return {rules, helpers};
}

engineTest("every constant is the engine's", async () => {
    const {rules} = await engine();
    const cfg = rules.DEFAULT_CONFIG;
    assert.equal(cfg.oldLifeFrac, OLD_LIFE_FRACTION);
    assert.equal(cfg.preySwitchMin, PREY_FLOOR);
    assert.equal(cfg.adultAgeLifespanFrac, ADULT_AGE.lifespanFraction);
    assert.equal(cfg.adultAgeMinDays, ADULT_AGE.minDays);
    assert.equal(cfg.adultAgeMaxDays, ADULT_AGE.maxDays);
    assert.equal(cfg.starveBaseDays, STARVE.baseDays);
    assert.equal(cfg.starveMassExponent, STARVE.massExponent);
    assert.equal(cfg.starveMinDays, STARVE.minDays);
    assert.equal(cfg.starveMaxDays, STARVE.maxDays);
    assert.equal(rules.ARK_DAYS_PER_REAL_DAY, 365 / 14);
    // the live meal interval rule: voyage_config.launch_ecology in the migration that seeds it (no later migration changes these keys)
    const migration = readFileSync(path.join(ENGINE_ROOT!, "supabase/migrations/20261115130000_voyage_thrive_schema.sql"), "utf8");
    const json = /\('launch_ecology', '(\{[^']*\})'::jsonb\)/.exec(migration)?.[1];
    assert.ok(json, "launch_ecology row");
    const live = JSON.parse(json!);
    assert.equal(live.mealIntervalRule, "allometric");
    assert.equal(live.mealIntervalEndoDays, MEAL_INTERVAL.endoDays);
    assert.equal(live.mealIntervalEctoDays, MEAL_INTERVAL.ectoDays);
    assert.equal(live.mealIntervalExponent, MEAL_INTERVAL.massExponent);
    assert.equal(live.mealIntervalMinDays, MEAL_INTERVAL.minDays);
    assert.equal(live.mealIntervalMaxDays, MEAL_INTERVAL.maxDays);
    const positions = readFileSync(path.join(ENGINE_ROOT!, "supabase/functions/_shared/ark-positions/positions.ts"), "utf8");
    const steps = Number(/export const STEPS_PER_ARK_DAY = (\d+)/.exec(positions)?.[1]);
    assert.equal(RETRY_AFTER_MISS_DAYS, 1 / steps);
});

engineTest("the published hunting success is the engine's data, all 22 kinds", () => {
    const published = JSON.parse(readFileSync(path.join(ENGINE_ROOT!, "docs/ark/hunt-success.json"), "utf8")).for_record as Array<{id: string; rate: [number, number]}>;
    assert.equal(published.length, Object.keys(HUNT_SUCCESS).length);
    for (const row of published) assert.deepEqual(Array.from(HUNT_SUCCESS[row.id] ?? []), row.rate, row.id);
});

engineTest("the assumed spread of a lifespan is the 10th, 50th and 90th percentile of the engine's stored ranges", () => {
    const rows = JSON.parse(readFileSync(path.join(ENGINE_ROOT!, "scripts/ark/data/lifespan_fill_2026-11-15.json"), "utf8")).rows as Array<{lo_years: number; hi_years: number}>;
    const ratios = rows.filter((r) => r.lo_years > 0 && r.hi_years > 0).map((r) => r.hi_years / r.lo_years).sort((a, b) => a - b);
    const at = (p: number) => ratios[Math.floor(ratios.length * p)];
    assert.ok(Math.abs(at(0.1) - LIFESPAN_HI_OVER_LO.low) < 0.05, `${at(0.1)}`);
    assert.ok(Math.abs(at(0.5) - LIFESPAN_HI_OVER_LO.median) < 0.05, `${at(0.5)}`);
    assert.ok(Math.abs(at(0.9) - LIFESPAN_HI_OVER_LO.high) < 0.05, `${at(0.9)}`);
});

engineTest("the formulas give the engine's answers: starvation, adult age, meal interval", async () => {
    const {rules, helpers} = await engine();
    const cfg = rules.withConfig({mealIntervalRule: "allometric", mealIntervalEndoDays: 112, mealIntervalEctoDays: 448, mealIntervalExponent: 0.27, mealIntervalMinDays: 7, mealIntervalMaxDays: 365});
    for (const kg of [0.001, 0.03, 1, 6, 40, 190, 1500, 100000]) {
        assert.equal(arkStarveDays(kg), rules.starveDays({mass_kg: kg}, cfg), `starve ${kg}`);
        const endo = helpers.world([helpers.traits("p", {mass_kg: kg, tax_class: "Mammalia"})], [], cfg);
        const ecto = helpers.world([helpers.traits("p", {mass_kg: kg, tax_class: "Reptilia"})], [], cfg);
        const pred = {id: "p1", species: "p", zone: "woodland", island: null};
        assert.ok(Math.abs(arkMealIntervalDays(kg).endo - rules.mealInterval(endo, pred).days) < 1e-9, `endo ${kg}`);
        assert.ok(Math.abs(arkMealIntervalDays(kg).ecto - rules.mealInterval(ecto, pred).days) < 1e-9, `ecto ${kg}`);
    }
    for (const [lo, hi] of [[100, 300], [1826, 3652], [20000, 40000], [3, 5]]) {
        assert.equal(arkAdultAgeDays(lo, hi), rules.adultAgeDays({lifespan_days_wild: [lo, hi]}, rules.DEFAULT_CONFIG), `adult ${lo}-${hi}`);
    }
});
