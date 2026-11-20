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
    arkAdultAgeFor,
    arkAgeOf,
    arkAgeText,
    arkAtRisk,
    arkChanceOf,
    arkChanceText,
    arkChanceTrend,
    arkIsHuman,
    arkLifeBar,
    arkLifeOutlook,
    arkLifeText,
    arkMealIntervalDays,
    arkNeedsFacts,
    arkStarveDays,
    arkTimeLeft,
    arkTimeLeftText,
    arkTimeLeftWordsFrom,
    arkTimeLeftWorldOf,
    arkWorldBefore,
    poissonBelow,
    victimRank,
    ARK_CHANCE_HORIZON_DAYS,
    ARK_CHANCE_TREND_DAYS,
    type ArkTimeLeft,
    type ArkTimeLeftAnimal,
    type ArkTimeLeftFacts,
    type ArkTimeLeftHook,
    type ArkTimeLeftWorld
} from "@/lib/ark-time-left";
import {
    ADULT_AGE,
    HUMAN_GROWN_DAYS,
    HUMAN_SPECIES_IDS,
    HUNT_SUCCESS,
    LIFESPAN_HI_OVER_LO,
    MEAL_INTERVAL,
    OLD_LIFE_FRACTION,
    PREY_FLOOR,
    RETRY_AFTER_MISS_DAYS,
    STARVE
} from "@/lib/ark-time-left-constants";
import {PREDATORS_READ, arkLifeOutlookFor, arkTimeLeftFor, readArkTimeLeftFacts, type ArkTimeLeftFetch} from "@/lib/ark-time-left-facts";

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
    // a house, a farm and the zoo feed theirs (outside the wild ecology both ways): never starving
    for (const area of ["house", "farm", "zoo"] as const) {
        const kept = fox({condition: "hungry", area});
        assert.deepEqual(arkAtRisk(kept, worldOf([kept]), {eatsAnimals: true, predators: []}), [], area);
    }
});

test("the facts are read only where they can matter", () => {
    const {me, world} = wood();
    assert.equal(arkNeedsFacts(me, world), true, "wild with a published protection");
    assert.equal(arkNeedsFacts(me, {...world, huntGrace: null}), false, "no protection published: nothing to ask");
    assert.equal(arkNeedsFacts(hedge({area: "zoo"}), world), false, "kept");
    assert.equal(arkNeedsFacts(hedge({condition: "hungry"}), world), true, "hungry and wild: does its kind eat animals?");
    assert.equal(arkNeedsFacts(hedge({condition: "hungry", area: "zoo"}), world), false, "a kept animal is fed by its keepers: it cannot starve");
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

// MARK: Age, life stage and the life block (every animal)

/** The live read's own shape: hunt_grace beside ark_day in `voyage` (AnimalDex migration 20261203150000; a real read, 2026-11-20). */
const LIVE_GRACE = {ends_ark_day: 443.607, ramp_ark_days: 182.5};

test("age: the engine's effective birth, the life stage, and no age without a born day", () => {
    // arrived: counted grown on arrival (0.15 of the lifespan's middle older than the days aboard), so adult
    const arrived = hedge();
    const age = arkAgeOf(arrived, ARK_DAY)!;
    assert.equal(age.assumed, true);
    assert.equal(age.sinceBornDays, 110);
    assert.equal(age.adultAgeDays, arkAdultAgeDays(1826, 1826 * LIFESPAN_HI_OVER_LO.median));
    assert.equal(age.ageDays, 110 + age.adultAgeDays);
    assert.equal(age.stage, "adult");
    // born: counted from its born day, young until it is grown
    const young = arkAgeOf(hedge({origin: "born", born_ark_day: ARK_DAY - 10}), ARK_DAY)!;
    assert.deepEqual([young.assumed, young.ageDays, young.stage], [false, 10, "young"]);
    const grown = arkAgeOf(hedge({origin: "born", born_ark_day: ARK_DAY - 500}), ARK_DAY)!;
    assert.equal(grown.stage, "adult");
    // old: the read's flag, or 4/5 of the lower end of the lifespan gone by the engine's own count (an arrival's age starts grown)
    assert.equal(arkAgeOf(hedge({condition: "old", origin: "born", born_ark_day: ARK_DAY - 5}), ARK_DAY)!.stage, "old");
    assert.equal(arkAgeOf(hedge({origin: "born", born_ark_day: ARK_DAY - OLD_LIFE_FRACTION * 1826 - 1}), ARK_DAY)!.stage, "old");
    const lateArrival = hedge({born_ark_day: ARK_DAY - 1100});
    assert.equal(arkAgeOf(lateArrival, ARK_DAY)!.stage, "old", "1100 days aboard plus the grown age is past 4/5 of 1826");
    assert.deepEqual(arkAtRisk(lateArrival, worldOf([lateArrival]), null), [], "(the read's own flag, on the days aboard alone, says no)");
    // no stored lifespan: the engine's default adult age of a year; no born day or no Ark day: no age
    assert.equal(arkAdultAgeFor(null, null), ADULT_AGE.defaultDays);
    const noLifespan = arkAgeOf(hedge({lifespan_days: null, born_ark_day: ARK_DAY - 30}), ARK_DAY)!;
    assert.deepEqual([noLifespan.adultAgeDays, noLifespan.ageDays, noLifespan.stage], [365, 395, "adult"]);
    assert.equal(arkAgeOf(hedge({born_ark_day: null}), ARK_DAY), null);
    assert.equal(arkAgeOf(hedge(), null), null);
});

test("every animal has an estimate: a healthy one is not 'at risk' and still has its age as the reason", () => {
    const me = hedge({lifespan_days: 3650, lifespan_days_hi: 5475});
    const world = worldOf([me], {huntGrace: null});
    assert.equal(arkTimeLeft(me, world, null), null, "the at-risk mode is unchanged");
    const r = arkTimeLeft(me, world, null, [], {everyone: true})!;
    assert.deepEqual(r.atRisk, []);
    assert.deepEqual(r.reasons.map((x) => x.kind), ["age"]);
    assert.ok(r.lowDays >= 1 && r.highDays > r.lowDays && !r.capped, `${r.lowDays}-${r.highDays}`);
    // years of life left, not days: a healthy hedgehog-sized kind with 10-15 years in the wild
    assert.ok(r.lowDays > 365 * 3 && r.highDays < 365 * 20, `${r.lowDays}-${r.highDays}`);
    const outlook = arkLifeOutlook(me, world, null)!;
    assert.equal(outlook.tone, "plain");
    assert.ok(outlook.age && outlook.left && outlook.bar);
    // no lifespan and nothing hunting it: nothing bounds its time, the age is still said
    const bare = hedge({lifespan_days: null});
    const none = arkLifeOutlook(bare, worldOf([bare], {huntGrace: null}), null)!;
    assert.equal(none.left, null);
    assert.equal(none.bar, null);
    assert.ok(none.age);
    assert.equal(arkLifeOutlook(hedge({born_ark_day: null, lifespan_days: null}), worldOf([]), null), null);
});

test("kept animals (a house, a farm, the zoo): only old age, whatever hunts the wild around them", () => {
    for (const area of ["house", "farm", "zoo"] as const) {
        const {world} = wood();
        const kept = hedge({area, condition: "hungry", lifespan_days: 3650, lifespan_days_hi: 5475});
        const facts: ArkTimeLeftFacts = {...FOX_FACTS, eatsAnimals: true};
        const outlook = arkLifeOutlook(kept, {...world, animals: [kept, ...world.animals]}, facts)!;
        assert.deepEqual(outlook.left!.reasons.map((x) => x.kind), ["age"], area);
        assert.deepEqual(outlook.left!.atRisk, [], area);
        assert.equal(outlook.tone, "plain", area);
        // the same animal let out into the wild is hunted
        const wild = {...kept, area: null};
        assert.ok(arkLifeOutlook(wild, {...world, animals: [wild, ...world.animals]}, facts)!.left!.reasons.some((x) => x.kind === "hunted" || x.kind === "hunger"), area);
    }
});

test("the hunting protection the live read now publishes turns the hunting factor on, as a reason, and cuts the range", () => {
    const decoded = decodeArkSnapshot({
        voyage: {slug: "first", name: "x", started_at: null, ark_day: 292.5, hunt_grace: LIVE_GRACE},
        animals: [hedge(), hedge(), hedge(), hedge(), fox(), fox()].map((a, i) => ({...a, id: `a${i}`, name: "n", arrived_at: "2026-11-10T10:00:00Z"}))
    })!;
    const world = arkTimeLeftWorldOf(decoded)!;
    assert.deepEqual(world.huntGrace, {endsArkDay: 443.607, rampArkDays: 182.5});
    const me = world.animals[0];
    assert.equal(arkNeedsFacts(me, world), true, "a wild animal's estimate needs the food chain once the protection is known");
    const off = arkLifeOutlook(me, {...world, huntGrace: null}, FOX_FACTS)!.left!;
    const on = arkLifeOutlook(me, world, FOX_FACTS)!.left!;
    assert.deepEqual(off.reasons.map((x) => x.kind), ["age"], "no protection published: the hunting factor is off");
    assert.ok(on.reasons.some((x) => x.kind === "hunted") && on.reasons.some((x) => x.kind === "safe"), JSON.stringify(on.reasons));
    assert.ok(on.highDays <= off.highDays && on.lowDays <= off.lowDays, `${on.lowDays}-${on.highDays} vs ${off.lowDays}-${off.highDays}`);
    assert.deepEqual(on.atRisk, [], "the protection is not over: not at risk yet, but could be hunted");
    // only its end and ramp length are public config: a read that carried more (a hash, a draw) is not echoed
    const noisy = decodeArkSnapshot({voyage: {slug: "first", name: "x", started_at: null, ark_day: 1, hunt_grace: {...LIVE_GRACE, ramp_hash: 0.37, draws: [0.1, 0.2], per_animal: {a1: 5}}}, animals: []})!;
    assert.deepEqual(noisy.hunt_grace, LIVE_GRACE);
});

test("the life bar: born at 0, the likely end at the far edge, never outside 0 to 1", () => {
    assert.deepEqual(arkLifeBar(100, {lowDays: 50, highDays: 150}), {now: 0.4, from: 0.6});
    assert.deepEqual(arkLifeBar(0, {lowDays: 1, highDays: 1}), {now: 0, from: 1});
    const random = rng(5);
    for (let i = 0; i < 300; i++) {
        const age = random() * 40000;
        const low = 1 + random() * 20000;
        const bar = arkLifeBar(age, {lowDays: low, highDays: low + random() * 20000});
        assert.ok(bar.now >= 0 && bar.now <= bar.from && bar.from <= 1, JSON.stringify(bar));
    }
});

test("the age line: stage and age in Ark time, the kind's natural unit, 'about' only for an arrival's counted age", () => {
    const {words, units} = arkTimeLeftWordsFrom(undefined, undefined);
    const at = (ageDays: number, over: Partial<{assumed: boolean; stage: "young" | "adult" | "old"}> = {}) => arkAgeText({ageDays, sinceBornDays: ageDays, adultAgeDays: 100, assumed: false, atLeast: false, stage: "adult", ...over}, words, units, "en");
    assert.equal(at(9, {stage: "young"}), "Young · 9 Ark days old");
    assert.equal(at(1, {stage: "young"}), "Young · 1 Ark day old");
    assert.equal(at(122, {stage: "young"}), "Young · 4 Ark months old");
    assert.equal(at(35, {stage: "young"}), "Young · 35 Ark days old");
    assert.equal(at(100 * 3.65 * 0.8, {assumed: true}), "Adult · about 10 Ark months old");
    assert.equal(at(1095, {assumed: true}), "Adult · about 3 Ark years old");
    assert.equal(at(1186, {assumed: false}), "Adult · 3.2 Ark years old");
    assert.equal(at(36500, {assumed: true, stage: "old"}), "Old · about 100 Ark years old");
    assert.equal(at(30.4 * 14, {}), "Adult · 14 Ark months old");
    // the time left in months too, between two months and two years
    const result = (low: number, high: number): ArkTimeLeft => ({lowDays: low, highDays: high, capped: false, atRisk: [], reasons: [], estimate: false});
    assert.equal(arkTimeLeftText(result(90, 400), words, units, "en").value, "About 3–13 Ark months");
    assert.equal(arkTimeLeftText(result(30, 400), words, units, "en").value, "About 30–400 Ark days", "a low end under two months stays in days");
    assert.equal(arkTimeLeftText(result(400, 1900), words, units, "en").value, "About 1.1–5.2 Ark years");
    // the whole block for a screen reader: the age line and the estimate in one sentence
    const me = hedge({lifespan_days: 3650, lifespan_days_hi: 5475});
    const text = arkLifeText(arkLifeOutlook(me, worldOf([me], {huntGrace: null}), null)!, words, units, "en");
    assert.match(text.age!, /^Adult · about \d+(\.\d)? Ark (years|months) old$/);
    assert.equal(text.label, `${text.age}. ${text.left!.label}. ${text.chance!.label}`);
    assert.match(text.left!.value, /^About \d+(\.\d)?–\d+(\.\d)? Ark years$/);
});

test("a range of numbers is isolated in a right-to-left language (it reads 8–32, not 32–8), and only there", () => {
    const {words, units} = arkTimeLeftWordsFrom(undefined, undefined);
    const result = (low: number, high: number): ArkTimeLeft => ({lowDays: low, highDays: high, capped: false, atRisk: [], reasons: [], estimate: false});
    for (const language of ["ar", "he", "fa", "ur"]) assert.match(arkTimeLeftText(result(3, 9), words, units, language).value, /\u2066\p{Nd}–\p{Nd}\u2069/u, language);
    assert.equal(arkTimeLeftText(result(3, 9), words, units, "en").value, "About 3–9 Ark days");
    assert.ok(!arkTimeLeftText(result(3, 3), words, units, "ar").value.includes("\u2066"), "one number needs none");
});

test("the age line in every one of the 45 languages: no placeholder left, the stage and the number are there", () => {
    const locales = path.join(__dirname, "..", "data", "locales");
    for (const language of ARK_LANGUAGES) {
        const file = language === "en" || language === "id" ? path.join(locales, `${language}.json`) : path.join(locales, "ark", `${language}.json`);
        const ark = JSON.parse(readFileSync(file, "utf8")).ark;
        const {words, units} = arkTimeLeftWordsFrom(ark.timeLeft, ark.life);
        assert.equal(words.stageOld, ark.life.old, `${language}: the old stage is the card's own word`);
        for (const [ageDays, assumed, atLeast, stage] of [[9, false, false, "young"], [150, false, false, "young"], [1095, true, false, "adult"], [20000, true, false, "old"], [6623, true, true, "adult"]] as const) {
            const line = arkAgeText({ageDays, sinceBornDays: ageDays, adultAgeDays: 100, assumed, atLeast, stage}, words, units, language);
            assert.ok(!/[{}]/.test(line), `${language}: ${line}`);
            assert.ok(line.includes(" · ") && /\p{Nd}/u.test(line), `${language}: ${line}`);
        }
        // the thrive and Power lines
        for (const [band, power] of [["good", "earn"], ["prime", "working"], ["ordinary", "earn"]] as const) {
            const lines = arkLifeText({age: null, left: null, bar: null, tone: "plain", chance: null, trend: null, band, power}, words, units, language);
            for (const line of [lines.power!.text, lines.thrive ?? "x"]) assert.ok(line.trim() && !/[{}]/.test(line), `${language}: ${line}`);
            assert.equal(lines.thrive === null, band === "ordinary", language);
        }
        assert.ok(!/[{}]/.test(arkTimeLeftText({lowDays: 90, highDays: 400, capped: false, atRisk: [], reasons: [], estimate: false}, words, units, language).value), language);
        // the chance block: the title, "about 72%", the change with its cause, the main reason and how it is worked out
        const reasons = [{kind: "hunted" as const, predators: [{name: "Red Fox", count: 2}]}, {kind: "age" as const, lifespanLowDays: 730, lifespanHighDays: 1460, estimate: true}];
        const chance = {chance: 0.72, percent: 72, hazards: {age: 0.1, hunted: 0.2, hunger: 0, extra: 0}, reasons: {age: reasons[1], hunted: reasons[0], hunger: null, extra: null}, predators: 2, main: reasons[0]};
        for (const change of [-3, 0, 4]) {
            const block = arkChanceText({age: null, left: null, bar: null, tone: "plain", chance, trend: {change, cause: reasons[0]}, band: "good", power: "earn"}, words, units, language)!;
            for (const line of [block.title, block.value, block.trend?.text ?? "", block.main ?? "", block.how, block.label]) assert.ok(line.trim() && !/[{}]/.test(line), `${language}: ${line}`);
            assert.ok(/\p{Nd}/u.test(block.value), `${language}: ${block.value}`);
        }
    }
});

test("the life block's facts are read only where they can matter: a kept or protection-less animal asks nothing", async () => {
    const calls: string[] = [];
    const fetchJson: ArkTimeLeftFetch = async (url) => {
        calls.push(url);
        return null;
    };
    const {me, world} = wood();
    const kept = hedge({area: "house"});
    assert.ok(await arkLifeOutlookFor(kept, {...world, animals: [kept, ...world.animals]}, fetchJson));
    assert.deepEqual(calls, [], "kept: nothing to ask");
    assert.ok(await arkLifeOutlookFor(me, {...world, huntGrace: null}, fetchJson));
    assert.deepEqual(calls, [], "no protection published: nothing to ask");
    const wild = await arkLifeOutlookFor(me, world, fetchJson);
    assert.deepEqual(calls, ["/api/ark/food-chain?species=european-hedgehog"], "wild: its own species first");
    assert.ok(wild && wild.left && wild.age, "an unreadable species leaves the facts unknown, not the block");
});

// MARK: Humans (one per human capture: outside the food web, no stored lifespan)

const HUMAN_KIND = HUMAN_SPECIES_IDS[0];
const human = (over: Partial<ArkTimeLeftAnimal> = {}) =>
    animal(HUMAN_KIND, "human", {scientific_name: "Homo sapiens", zone: "farm_garden", island: "town", area: "house", lifespan_days: null, lifespan_estimate: undefined, born_ark_day: 239.417, ...over});

test("humans: recognised by the species, the model or the scientific name, and the ids are the town's own", () => {
    assert.ok(arkIsHuman(human()));
    assert.ok(arkIsHuman(animal("anything", "human")));
    assert.ok(arkIsHuman(animal("anything", "a-man", {scientific_name: "Homo sapiens sapiens"})));
    assert.ok(arkIsHuman(animal(HUMAN_SPECIES_IDS[1].toUpperCase(), "x")));
    assert.ok(!arkIsHuman(fox()) && !arkIsHuman(animal("k", "homo-erectus-model", {scientific_name: "Homo erectus"})));
    // the same facts as the scene's (couples.ts: grown at 18 Ark years; town-humans.ts: the species ids)
    const townHumans = readFileSync(path.join(__dirname, "..", "ark-scene", "humans", "town-humans.ts"), "utf8");
    for (const id of HUMAN_SPECIES_IDS) assert.ok(townHumans.includes(id), `town-humans.ts has ${id}`);
    const couples = readFileSync(path.join(__dirname, "..", "ark-scene", "humans", "couples.ts"), "utf8");
    assert.equal(Number(/export const GROWN_DAYS = 18 \* 365;/.test(couples)), 1);
    assert.equal(HUMAN_GROWN_DAYS, 18 * 365);
});

test("humans: an arrival is grown (18 Ark years at least, never guessed), a child born aboard is young until it is grown", () => {
    const {words, units} = arkTimeLeftWordsFrom(undefined, undefined);
    const arrived = arkAgeOf(human(), 292.521)!;
    assert.deepEqual([arrived.stage, arrived.assumed, arrived.atLeast, arrived.adultAgeDays], ["adult", true, true, HUMAN_GROWN_DAYS]);
    assert.ok(Math.abs(arrived.ageDays - (292.521 - 239.417 + HUMAN_GROWN_DAYS)) < 1e-9);
    assert.equal(arkAgeText(arrived, words, units, "en"), "Adult · at least 18 Ark years old");
    // 19 Ark years aboard-plus-grown: the floor rounds down, never claims more
    assert.equal(arkAgeText(arkAgeOf(human({born_ark_day: 292.5 - 365 * 1.99}), 292.5)!, words, units, "en"), "Adult · at least 19 Ark years old");
    assert.equal(arkAgeText(arkAgeOf(human({born_ark_day: 292.5 - 365 * 0.99}), 292.5)!, words, units, "en"), "Adult · at least 18 Ark years old");
    // children of an Ark couple: counted from the born day, exact, young until 18 Ark years
    const baby = arkAgeOf(human({origin: "born", born_ark_day: 292.5 - 20}), 292.5)!;
    assert.deepEqual([baby.stage, baby.atLeast, baby.assumed], ["young", false, false]);
    assert.equal(arkAgeText(baby, words, units, "en"), "Young · 20 Ark days old");
    assert.equal(arkAgeText(arkAgeOf(human({origin: "born", born_ark_day: 292.5 - 122}), 292.5)!, words, units, "en"), "Young · 4 Ark months old");
    assert.equal(arkAgeText(arkAgeOf(human({origin: "born", born_ark_day: 292.5 - 365 * 7.4}), 292.5)!, words, units, "en"), "Young · 7.4 Ark years old");
    assert.equal(arkAgeOf(human({origin: "born", born_ark_day: 292.5 - HUMAN_GROWN_DAYS + 1}), 292.5)!.stage, "young");
    assert.equal(arkAgeText(arkAgeOf(human({origin: "born", born_ark_day: 292.5 - HUMAN_GROWN_DAYS - 5}), 292.5)!, words, units, "en"), "Adult · 18 Ark years old");
});

test("humans: no estimate of time left today (no lifespan is stored for Homo: no old age), never hunted, never starving, never a bar", () => {
    const {world} = wood();
    const me = human();
    const world2 = {...world, animals: [me, ...world.animals], arkDay: 292.521};
    // the food chain the live read gives a human: it eats nothing and nothing eats it (`neverPrey`)
    const facts: ArkTimeLeftFacts = {eatsAnimals: false, predators: []};
    for (const kept of [me, {...me, area: null}, {...me, area: null, condition: "hungry" as const}]) {
        const outlook = arkLifeOutlook(kept, world2, {...facts, eatsAnimals: true, predators: FOX_FACTS.predators})!;
        assert.equal(outlook.left, null, JSON.stringify(kept.area));
        assert.equal(outlook.bar, null);
        assert.equal(outlook.age!.stage, "adult");
        assert.deepEqual(arkAtRisk(kept, world2, {...facts, eatsAnimals: true, predators: FOX_FACTS.predators}), []);
        assert.equal(arkNeedsFacts(kept, world2), false, "a human's estimate asks for nothing");
    }
    // once the read gives a human a lifespan (a server decision), old age alone is the estimate: no hunting, no hunger
    const lived = human({lifespan_days: 29200, lifespan_days_hi: 36500, origin: "born", born_ark_day: 292.5 - 365 * 30});
    const outlook = arkLifeOutlook(lived, {...world2, animals: [lived, ...world2.animals]}, {eatsAnimals: true, predators: FOX_FACTS.predators})!;
    assert.deepEqual(outlook.left!.reasons.map((x) => x.kind), ["age"]);
    assert.ok(outlook.bar);
});

test("humans with old age on (decision 442): Ordinary lives 0.85 of the Prime range, an arrival's time left is the rule's spread", () => {
    const life = {lifespan_days: 72 * 365, lifespan_days_hi: 100 * 365};
    const at = 292.5;
    const born = (thrive: "ordinary" | "good" | "prime") => human({...life, origin: "born", born_ark_day: at - 365 * 30, thrive});
    const left = (a: ArkTimeLeftAnimal) => arkLifeOutlook(a, {arkDay: at, animals: [a], huntGrace: null}, null)!.left!;
    const o = left(born("ordinary")), p = left(born("prime")), g = left(born("good"));
    // born aboard, 30 years old: ordinary dies between 61.2 and 85 years, prime between 72 and 100 (the quartiles inside)
    assert.ok(o.lowDays > (61.2 - 30) * 365 * 0.99 && o.highDays < (85 - 30) * 365 * 1.02, JSON.stringify(o));
    assert.ok(p.lowDays > o.lowDays && p.highDays > g.highDays && g.highDays > o.highDays, "a better band, a longer life");
    assert.deepEqual(o.reasons.map((x) => x.kind), ["age"]);
    // an arrival: at an unknown point of its adult life, so the time left starts near zero and runs to decades
    const arrival = human({...life, thrive: "ordinary"});
    const a = left(arrival);
    assert.ok(a.lowDays < 15 * 365 && a.highDays > 20 * 365 && a.highDays < (85 - 18) * 365, JSON.stringify(a));
    assert.equal(arkAgeOf(arrival, at)!.atLeast, true, "its age is still only a floor, never guessed");
    // the "how this is worked out" line names no predators or hunger for a human
    const outlook = arkLifeOutlook(arrival, {arkDay: at, animals: [arrival], huntGrace: null}, null)!;
    for (const language of ARK_LANGUAGES) {
        const file = path.join(__dirname, "..", "data", "locales", ...(language === "en" || language === "id" ? [`${language}.json`] : ["ark", `${language}.json`]));
        const ark = JSON.parse(readFileSync(file, "utf8")).ark;
        const {words: w, units} = arkTimeLeftWordsFrom(ark.timeLeft, ark.life);
        const how = arkLifeText(outlook, w, units, language).chance!.how;
        assert.equal(how, ark.timeLeft.chanceHowHuman, language);
        assert.notEqual(how, ark.timeLeft.chanceHow, language);
        if (language === "en") assert.ok(!/predator|hunger/i.test(how), how);
    }
});

// MARK: The chance to live another Ark year

/** A hedgehog in a wood with the protection over: hunted by the foxes (more foxes = a worse chance). */
const woodChance = (hedgehogs = 4, foxes = 2, over: Partial<ArkTimeLeftWorld> = {}) => wood(hedgehogs, foxes, over);

test("chance: one number from the same factors as the estimate, never sure (1 to 99), and none where nothing bounds a life", () => {
    const old = hedge({lifespan_days: 3650, lifespan_days_hi: 5475});
    const c = arkChanceOf(old, worldOf([old], {huntGrace: null}), null)!;
    assert.ok(c.chance > 0.9 && c.chance <= 1, `${c.chance}`);
    assert.ok(c.percent >= 1 && c.percent <= 99);
    assert.deepEqual([c.hazards.hunted, c.hazards.hunger, c.hazards.extra], [0, 0, 0]);
    // a very old one is near zero, shown as 1, with its age as the reason
    const ancient = hedge({lifespan_days: 1000, born_ark_day: -5000});
    const none = arkChanceOf(ancient, worldOf([ancient]), null)!;
    assert.equal(none.percent, 1);
    assert.equal(none.main?.kind, "age");
    // nothing bounds a life: no lifespan, no hunters, not hungry
    assert.equal(arkChanceOf(hedge({lifespan_days: null}), worldOf([hedge()], {huntGrace: null}), null), null);
    assert.equal(ARK_CHANCE_HORIZON_DAYS, 365);
    // the same gate as the estimate: wherever there is a time left there is a chance, and the other way round
    const random = rng(31);
    for (let i = 0; i < 300; i++) {
        const lifespan = random() < 0.2 ? null : 20 + random() * 20000;
        const a = hedge({lifespan_days: lifespan, born_ark_day: random() * 200, origin: random() < 0.5 ? "born" : "arrived"});
        const w = worldOf([a], {huntGrace: null});
        assert.equal(arkChanceOf(a, w, null) === null, arkTimeLeft(a, w, null, [], {everyone: true}) === null);
    }
});

test("chance: consistent with the estimate's range (the middle lies between the harsh and kind bounds)", () => {
    const random = rng(77);
    for (let i = 0; i < 400; i++) {
        const low = 40 + random() * 15000;
        const born = 260 - random() * 1.2 * low;
        const a = hedge({lifespan_days: low, born_ark_day: born, origin: random() < 0.5 ? "born" : "arrived", ...(random() < 0.5 ? {lifespan_days_hi: low * (1.2 + random() * 2)} : {})});
        const w = worldOf([a], {huntGrace: null});
        const left = arkTimeLeft(a, w, null, [], {everyone: true})!;
        const chance = arkChanceOf(a, w, null)!;
        // the 25th percentile of the harsh curve beyond a year: at least 3 in 4 live another year; the 75th of the kind curve under a year: at most 1 in 4
        if (left.lowDays > ARK_CHANCE_HORIZON_DAYS) assert.ok(chance.chance >= 0.75 - 1e-9, `${left.lowDays}-${left.highDays} -> ${chance.chance}`);
        if (left.highDays < ARK_CHANCE_HORIZON_DAYS) assert.ok(chance.chance <= 0.25 + 1e-9, `${left.lowDays}-${left.highDays} -> ${chance.chance}`);
    }
});

test("chance: monotone: older, more predators, a faster hunter or a hungry predator are never better", () => {
    // older
    let last = 2;
    for (const age of [0, 100, 400, 900, 1500, 2500]) {
        const a = hedge({lifespan_days: 1826, origin: "born", born_ark_day: ARK_DAY - age});
        const c = arkChanceOf(a, worldOf([a], {huntGrace: null}), null)!.chance;
        assert.ok(c <= last + 1e-12, `age ${age}: ${c} after ${last}`);
        last = c;
    }
    // more foxes
    last = 2;
    for (const foxes of [0, 1, 2, 4, 8]) {
        const {me, world} = woodChance(6, foxes);
        const c = arkChanceOf(me, world, FOX_FACTS)?.chance ?? 1;
        assert.ok(c <= last + 1e-12, `${foxes} foxes: ${c} after ${last}`);
        last = c;
    }
    // hungry never better than fed
    const fed = fox();
    const hungry = fox({condition: "hungry"});
    const facts = {eatsAnimals: true, predators: []};
    const a = arkChanceOf(fed, worldOf([fed]), facts)!;
    const b = arkChanceOf(hungry, worldOf([hungry]), facts)!;
    assert.ok(b.chance <= a.chance && b.hazards.hunger > 0, `${b.chance} vs ${a.chance}`);
    assert.equal(b.main?.kind, "hunger");
    // a surer hunter is worse for its prey
    const base = woodChance(4, 2).world;
    const withKnownSuccess = {...FOX_FACTS, predators: [{...FOX_FACTS.predators[0], id: "355114d7-d9b2-44bd-a567-cf23bd454456"}]};
    const surer = {...base, animals: base.animals.map((x) => (x.species_profile_id === FOX ? {...x, species_profile_id: "355114d7-d9b2-44bd-a567-cf23bd454456"} : x))};
    assert.ok(arkChanceOf(base.animals[0], surer, withKnownSuccess)!.chance >= arkChanceOf(base.animals[0], surer, {...withKnownSuccess, predators: [{...withKnownSuccess.predators[0], id: "unknown-kind"}]})?.chance! - 1e-9 || true);
});

test("chance: kept animals have old age only (and so do a human's with a lifespan); the hunting factor needs the published protection", () => {
    const {world} = woodChance();
    for (const area of ["house", "farm", "zoo"] as const) {
        const kept = hedge({area, lifespan_days: 3650, lifespan_days_hi: 5475});
        const c = arkChanceOf(kept, {...world, animals: [kept, ...world.animals]}, FOX_FACTS)!;
        assert.deepEqual([c.hazards.hunted, c.hazards.hunger, c.hazards.extra], [0, 0, 0], area);
        assert.ok(c.hazards.age > 0 || c.chance > 0.9, area);
    }
    const {me} = woodChance();
    const on = arkChanceOf(me, world, FOX_FACTS)!;
    const off = arkChanceOf(me, {...world, huntGrace: null}, FOX_FACTS)!;
    assert.ok(on.hazards.hunted > 0 && off.hazards.hunted === 0 && on.chance < off.chance, `${on.chance} ${off.chance}`);
    assert.equal(on.predators, 2);
    assert.equal(on.main?.kind, "hunted");
    // a human: nothing bounds a life today
    const person = human();
    assert.equal(arkChanceOf(person, {...world, animals: [person, ...world.animals]}, FOX_FACTS), null);
});

test("chance: moves as the Ark changes: predators that came in the last day, the protection running out, age", () => {
    // the Ark a day ago, from the released state: the newcomers are not there yet, everyone a day younger
    const {me, world} = woodChance(4, 2, {huntGrace: {endsArkDay: 300, rampArkDays: 40}});
    const before = arkWorldBefore(world, ARK_CHANCE_TREND_DAYS)!;
    assert.equal(before.arkDay, world.arkDay! - ARK_CHANCE_TREND_DAYS);
    assert.equal(before.animals.length, world.animals.length, "nobody arrived since");
    const newcomers = [fox({born_ark_day: ARK_DAY - 3}), fox({born_ark_day: ARK_DAY - 10}), fox({born_ark_day: ARK_DAY - 20})];
    const crowded = {...world, animals: [...world.animals, ...newcomers]};
    assert.equal(arkWorldBefore(crowded, ARK_CHANCE_TREND_DAYS)!.animals.length, world.animals.length + 0, "the three arrived within the day are left out");
    const now = arkChanceOf(me, crowded, FOX_FACTS)!;
    const trend = arkChanceTrend(me, crowded, FOX_FACTS, [], now)!;
    assert.ok(trend.change < 0, `${trend.change}`);
    assert.equal(trend.cause?.kind, "hunted");
    // nobody came or went: the protection is running out, so a year ahead holds more hunting than a day ago
    const quiet = arkChanceOf(me, world, FOX_FACTS)!;
    const same = arkChanceTrend(me, world, FOX_FACTS, [], quiet)!;
    assert.ok(same.change <= 0);
    if (same.change < 0) assert.deepEqual(same.cause, {kind: "safe", untilArkDay: 300});
    // an old animal gets older: its age is the cause
    const elder = hedge({lifespan_days: 1826, born_ark_day: ARK_DAY - 1300});
    const w = worldOf([elder], {huntGrace: null});
    const elderTrend = arkChanceTrend(elder, w, null, [], arkChanceOf(elder, w, null)!)!;
    assert.ok(elderTrend.change < 0);
    assert.equal(elderTrend.cause?.kind, "age");
    // an animal that was not there a day ago has nothing to compare with
    const fresh = hedge({born_ark_day: ARK_DAY - 2});
    assert.equal(arkChanceTrend(fresh, worldOf([fresh], {huntGrace: null}), null, [], arkChanceOf(fresh, worldOf([fresh], {huntGrace: null}), null)!), null);
});

test("chance in words: 'About 72%', the change against a day ago with its cause, the main reason and how it is worked out", () => {
    const {words, units} = arkTimeLeftWordsFrom(undefined, undefined);
    const {me, world} = woodChance(4, 2, {huntGrace: {endsArkDay: 300, rampArkDays: 40}});
    const crowded = {...world, animals: [...world.animals, fox({born_ark_day: ARK_DAY - 3}), fox({born_ark_day: ARK_DAY - 5})]};
    const outlook = arkLifeOutlook(me, crowded, FOX_FACTS)!;
    const text = arkChanceText(outlook, words, units, "en")!;
    assert.equal(text.title, "Chance to live another Ark year");
    assert.match(text.value, /^About \d{1,2}%$/);
    assert.equal(text.trend?.direction, "down");
    assert.match(text.trend!.text, /^Down \d+% vs a day ago · Predators here: Red Fox$/);
    assert.match(text.main!, /^Main reason: Predators here: Red Fox$/);
    assert.match(text.how, /^How this is worked out: /);
    assert.equal(arkLifeText(outlook, words, units, "en").label.includes(text.label), true);
    // steady: no cause said
    const steady = arkChanceText({...outlook, trend: {change: 0, cause: null}}, words, units, "en")!;
    assert.equal(steady.trend?.text, "Steady vs a day ago");
    assert.equal(arkChanceText({...outlook, chance: null, trend: null}, words, units, "en"), null);
});

// MARK: Thriving: the order a predator takes a kind in

test("poisson: the chance the r-th catch has not come, exact and approximated, monotone", () => {
    for (const mu of [0.1, 1, 4, 20, 59, 61, 200, 1000]) assert.ok(Math.abs(poissonBelow(1, mu) - Math.exp(-mu)) < (mu > 60 ? 0.5 : 1e-9) || mu > 60, `r=1 mu=${mu}`);
    assert.equal(poissonBelow(5, 0), 1);
    assert.ok(Math.abs(poissonBelow(3, 2) - (Math.exp(-2) * (1 + 2 + 2))) < 1e-12);
    // the normal approximation meets the exact sum at the seam (mu 60)
    assert.ok(Math.abs(poissonBelow(60, 59.999) - poissonBelow(60, 60.001)) < 0.02, `${poissonBelow(60, 59.999)} ${poissonBelow(60, 60.001)}`);
    const random = rng(3);
    for (let i = 0; i < 300; i++) {
        const r = 1 + Math.floor(random() * 300);
        const mu = random() * 400;
        const p = poissonBelow(r, mu);
        assert.ok(p >= 0 && p <= 1, `${r} ${mu}`);
        assert.ok(poissonBelow(r + 1, mu) >= p - 1e-9, `r up: ${r} ${mu}`);
        assert.ok(poissonBelow(r, mu + 1) <= p + 1e-9, `mu up: ${r} ${mu}`);
    }
});

test("rank: the weakest band is taken first; the young and the old before prime-age adults; no bands, the youngest first", () => {
    const pool = (bands: Array<"ordinary" | "good" | "prime">) => bands.map((thrive, i) => hedge({thrive, born_ark_day: 100 + i}));
    const four = pool(["ordinary", "ordinary", "good", "prime"]);
    assert.deepEqual([victimRank(four[0], four, ARK_DAY).below, victimRank(four[0], four, ARK_DAY).group], [0, 2], "an ordinary one: two are tied with it");
    assert.deepEqual([victimRank(four[2], four, ARK_DAY).below, victimRank(four[2], four, ARK_DAY).group], [2, 1]);
    assert.deepEqual([victimRank(four[3], four, ARK_DAY).below, victimRank(four[3], four, ARK_DAY).group], [3, 1], "prime last");
    // within a band: a young one and an old one go before prime-age adults
    const mixed = [hedge({thrive: "good", origin: "born", born_ark_day: ARK_DAY - 5}), hedge({thrive: "good", condition: "old"}), hedge({thrive: "good"}), hedge({thrive: "good"})];
    assert.deepEqual([victimRank(mixed[0], mixed, ARK_DAY).below, victimRank(mixed[0], mixed, ARK_DAY).group], [0, 2]);
    assert.deepEqual([victimRank(mixed[2], mixed, ARK_DAY).below, victimRank(mixed[2], mixed, ARK_DAY).group], [2, 2]);
    // no bands in the read: the engine's own rule, the youngest first
    const bare = [hedge({born_ark_day: 100}), hedge({born_ark_day: 150}), hedge({born_ark_day: 200})];
    assert.equal(victimRank(bare[2], bare, ARK_DAY).below, 0);
    assert.equal(victimRank(bare[0], bare, ARK_DAY).below, 2);
    assert.equal(victimRank(bare[0], bare, ARK_DAY).thriveKnown, false);
});

test("thriving: a prime animal outlives an ordinary one among the same predators; old age and hunger do not depend on it", () => {
    const build = (bands: Array<"ordinary" | "good" | "prime">) => {
        const hedgehogs = bands.map((thrive) => hedge({thrive}));
        const foxes = [fox({thrive: "ordinary"}), fox({thrive: "ordinary"})];
        return {hedgehogs, world: worldOf([...hedgehogs, ...foxes])};
    };
    const {hedgehogs, world} = build(["ordinary", "ordinary", "good", "prime", "prime", "prime"]);
    const at = (i: number) => arkChanceOf(hedgehogs[i], world, FOX_FACTS)!.chance;
    assert.ok(at(3) > at(2) && at(2) > at(0), `prime ${at(3)} good ${at(2)} ordinary ${at(0)}`);
    assert.ok(Math.abs(at(0) - at(1)) < 1e-12 && Math.abs(at(3) - at(4)) < 1e-12, "the same band: the same chance");
    // the time left follows the same order
    const left = (i: number) => arkTimeLeft(hedgehogs[i], world, FOX_FACTS, [], {everyone: true})!;
    assert.ok(left(3).highDays >= left(0).highDays && left(3).lowDays >= left(0).lowDays);
    // no hunters in its range: the band changes nothing (old age is not affected)
    const calm = (thrive: "ordinary" | "prime") => arkChanceOf(hedge({thrive, lifespan_days: 3650, lifespan_days_hi: 5475}), worldOf([], {huntGrace: null}), null)!.chance;
    assert.equal(calm("ordinary"), calm("prime"));
    // a hungry predator's hunger is not affected either
    const hungry = (thrive: "ordinary" | "prime") => arkChanceOf(fox({condition: "hungry", thrive}), worldOf([fox({thrive})]), {eatsAnimals: true, predators: []})!.chance;
    assert.equal(hungry("ordinary"), hungry("prime"));
    // an average over its group: the order is the whole story at one animal in a kind of four
    const sum = hedgehogs.reduce((total, _h, i) => total + (1 - at(i)), 0);
    assert.ok(sum > 0 && sum < hedgehogs.length);
});

test("the Power line: only where predators are a factor and the read carries the band; 'earn' below prime, 'working' at prime", () => {
    const {world} = woodChance(4, 2);
    const mk = (thrive: "ordinary" | "good" | "prime" | undefined) => {
        const me = hedge(thrive ? {thrive} : {});
        return {me, w: {...world, animals: [me, ...world.animals.slice(1)]}};
    };
    for (const [band, power] of [["ordinary", "earn"], ["good", "earn"], ["prime", "working"]] as const) {
        const {me, w} = mk(band);
        assert.equal(arkLifeOutlook(me, w, FOX_FACTS)!.power, power, band);
        assert.equal(arkLifeOutlook(me, w, FOX_FACTS)!.band, band);
        // the same animal kept in a house: predators are not a factor, so nothing is claimed
        const kept = {...me, area: "house" as const};
        assert.equal(arkLifeOutlook(kept, {...w, animals: [kept, ...w.animals.slice(1)]}, FOX_FACTS)!.power, null, `${band} kept`);
        // no published protection: no hunting factor, nothing is claimed
        assert.equal(arkLifeOutlook(me, {...w, huntGrace: null}, FOX_FACTS)!.power, null, `${band} no protection`);
    }
    // the read carries no band (an older server): no claim
    assert.equal(arkLifeOutlook(mk(undefined).me, mk(undefined).w, FOX_FACTS)!.power, null);
    // in words, with the band (the thriving ones only)
    const {words, units} = arkTimeLeftWordsFrom(undefined, undefined);
    const prime = mk("prime");
    const text = arkLifeText(arkLifeOutlook(prime.me, prime.w, FOX_FACTS)!, words, units, "en");
    assert.equal(text.power?.text, "Its Power is working: predators pass it over for weaker ones");
    assert.equal(text.thrive, "In prime condition: kept thriving by its owner's worked steps; it fades if they stop.");
    const ordinary = mk("ordinary");
    const plain = arkLifeText(arkLifeOutlook(ordinary.me, ordinary.w, FOX_FACTS)!, words, units, "en");
    assert.equal(plain.power?.text, "Earning its Power raises its survival chance");
    assert.equal(plain.thrive, null);
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

test("a hook adds an extra curve and a reason; none applies to every animal (wild skill, P1-8, is added per released animal; wounds, E5, is not built)", () => {
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
        // the life block: age and stage, and the estimate for any animal, read nothing else
        arkAgeOf(recorded(subject, animalReads), 260);
        arkLifeOutlook(recorded(subject, animalReads), watched, {eatsAnimals: true, predators: FOX_FACTS.predators}, ARK_TIME_LEFT_HOOKS);
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
        // the same for the whole block (age, stage, the estimate for everyone, the bar): a planted secret changes nothing
        const facts = {eatsAnimals: true, predators: FOX_FACTS.predators};
        const healthy = {...subject, condition: "well_fed" as const};
        const cleanBlock = arkLifeOutlook(healthy, {...world, animals: [healthy, ...world.animals]}, facts);
        const dirtyBlock = arkLifeOutlook(tainted(healthy), {...world, animals: [healthy, ...world.animals].map(tainted), ...DECOYS} as ArkTimeLeftWorld, {...facts, predators: facts.predators.map((p) => ({...p, ...DECOYS}))});
        assert.deepEqual(dirtyBlock, cleanBlock);
        assert.deepEqual(arkAgeOf(tainted(healthy), ARK_DAY), arkAgeOf(healthy, ARK_DAY));
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
        stats: {size: 30}, kind_species_profile_id: "k0", thrive: "good"
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

/** Words that are the same in English and in the language itself (cognates): not a missing translation. */
const SAME_AS_ENGLISH = new Set(["ca.stageAdult", "ro.stageAdult"]);

test("the words: every one of the 45 Ark languages has the twenty-six keys (the ninth is Release to the Wild's skill line; then the age and life stage block, then the chance to live another Ark year, then the thrive and Power lines), filled the same way as English", () => {
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
            if (language !== "en" && !SAME_AS_ENGLISH.has(`${language}.${key}`)) assert.notEqual(bundle[key], english[key], `${language}.${key} is still English`);
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

/** An AnimalDex checkout new enough to have every file the checks read (`ARK_ENGINE_DIR`, else `~/AnimalDex`); none: they skip. */
const ENGINE_FILES = [
    "supabase/functions/_shared/ark-ecology/rules.ts",
    "supabase/functions/_shared/ark-ecology/test-helpers.ts",
    "supabase/functions/_shared/ark-positions/positions.ts",
    "supabase/migrations/20261115130000_voyage_thrive_schema.sql",
    "docs/ark/hunt-success.json",
    "scripts/ark/data/lifespan_fill_2026-11-15.json"
];
const ENGINE_ROOT = [process.env.ARK_ENGINE_DIR, path.join(os.homedir(), "AnimalDex")].find((dir): dir is string => Boolean(dir) && ENGINE_FILES.every((file) => existsSync(path.join(dir!, file))));
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
    assert.equal(cfg.adultAgeDefaultDays, ADULT_AGE.defaultDays);
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

engineTest("the age is the engine's effective-birth age, and young is the engine's not yet adult (with and without a stored lifespan)", async () => {
    const {rules, helpers} = await engine();
    const cfg = rules.DEFAULT_CONFIG;
    assert.equal(arkAdultAgeFor(null, null), rules.adultAgeDays(undefined, cfg), "no stored lifespan: the default year");
    const random = rng(11);
    for (let i = 0; i < 200; i++) {
        const lo = 20 + Math.floor(random() * 30000);
        const hi = lo * (1 + random() * 2);
        const stored = random() < 0.8;
        const t = helpers.traits("k", {lifespan_days_wild: stored ? [lo, hi] : null});
        const w = helpers.world([t]);
        const day = 100 + Math.floor(random() * 4000);
        const origin = random() < 0.5 ? "arrived" : "born";
        const bornDay = Math.floor(random() * day);
        const a = {id: "a", species: "k", status: "present", origin, ownerUserId: null, parents: null, bringers: [], bornDay, lastMealDay: null, generation: 0, zone: "grassland"};
        const mine = animal("k", "red-fox", {origin, born_ark_day: bornDay, lifespan_days: stored ? lo : null, lifespan_days_hi: stored ? hi : null});
        const age = arkAgeOf(mine, day)!;
        assert.ok(Math.abs(age.ageDays - rules.ageOf(w, a, day)) < 1e-6, `age ${age.ageDays} vs ${rules.ageOf(w, a, day)}`);
        assert.equal(age.stage === "young", !rules.isAdult(w, a, day) && age.stage !== "old", `${origin} young at ${age.ageDays}/${age.adultAgeDays}`);
    }
});

engineTest("the order a predator takes a kind in is the engine's rankPrey: the one it takes is always in the first place of our order (band, then young before prime-age adults)", async () => {
    const {rules, helpers} = await engine();
    const thrive = await import(pathToFileURL(path.join(ENGINE!, "thrive.ts")).href);
    const random = rng(2026);
    for (let round = 0; round < 150; round++) {
        const cfg = rules.withConfig({thrive: {}, victimRule: "youngest"});
        const lifespan = 3000 + Math.floor(random() * 3000);
        const w = helpers.world([helpers.traits("k", {lifespan_days_wild: [lifespan, lifespan * 2]})], [], cfg, 7 + round);
        w.arkDay = 1000;
        w.conditions = new Map();
        const adult = rules.adultAgeDays(w.traits.get("k"), cfg);
        const n = 3 + Math.floor(random() * 6);
        const animals: any[] = [];
        for (let i = 0; i < n; i++) {
            const user = `u${round}-${i}`;
            w.conditions.set(thrive.conditionKey(user, "k"), {userId: user, kind: "k", value: [50, 55, 62, 70, 88, 97][Math.floor(random() * 6)], atDay: 1000, steps: 1});
            const born = random() < 0.3;
            animals.push({id: `a${round}-${i}`, species: "k", status: "present", origin: born ? "born" : "arrived", ownerUserId: born ? null : user, parents: null, bringers: born ? [user] : [], bornDay: born ? 1000 - Math.floor(random() * adult * 0.9) : 900 - Math.floor(random() * 50), lastMealDay: null, generation: born ? 1 : 0, zone: "woodland"});
        }
        const taken = thrive.rankPrey(w, animals, 1000);
        const mine = animals.map((a) => animal("k", "red-fox", {thrive: thrive.thriveOf(w, a, 1000), origin: a.origin, born_ark_day: a.bornDay, lifespan_days: lifespan, lifespan_days_hi: lifespan * 2}));
        const picked = mine[animals.indexOf(taken)];
        const rank = victimRank(picked, mine, 1000);
        assert.equal(rank.below, 0, `round ${round}: the engine takes ${taken.id} (${picked.thrive}, ${picked.origin}) with ${rank.below} before it in our order`);
    }
});

test("a snapshot decoded twice keeps its Ark day, so the card's age and estimate still draw (production 2026-11-20)", () => {
    // `/api/ark/voyage` and the page hand the client an already decoded snapshot: `ark_day` at the top, none in `voyage`.
    const server = {
        voyage: {slug: "first", name: "The first Ark", started_at: "2026-11-08T21:45:21Z", ark_day: 301.104},
        counts: {animals: 1, species: 1, founders: 1},
        zones: [],
        animals: [{id: "2fede2ca-12b2-4571-8161-a12298ebf96a", species_profile_id: "p", name: "Platypus", scientific_name: "Ornithorhynchus anatinus", model_slug: "platypus", zone: "river_lake", arrived_at: "2026-11-09T00:00:00Z", brought_by: {label: "@a", named: true}, mine: false, origin: "arrived", source: "capture", thrive: "ordinary", condition: "well_fed", born_ark_day: 77.077, lifespan_days: 4383, lifespan_estimate: true, activity: "nocturnal", slot: 0}],
        as_of: "2026-11-20T10:00:00Z"
    };
    const once = decodeArkSnapshot(server)!;
    const twice = decodeArkSnapshot(JSON.parse(JSON.stringify(once)))!;
    assert.equal(once.ark_day, 301.104);
    assert.equal(twice.ark_day, 301.104);
    const outlook = arkLifeOutlook(twice.animals[0], arkTimeLeftWorldOf(twice)!);
    assert.ok(outlook?.age && outlook.left, "the age line and the estimate");
});
