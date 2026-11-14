/**
 * The day's needs (behaviours pass, lane B3, 2026-11-14; docs/ark/behaviour-pass-2026-11/needs.md): how long each kind
 * sleeps and when, how much of its waking time it feeds and rests and in what bouts, that feeding leads to rest, how
 * often it goes to water, and that its fed bar is low before a feeding bout and fills through it. The limits are set
 * from the measured values, with a little slack: they stop the old sameness coming back (every species slept by the
 * sun alone, fed in 80-second bouts drawn slot by slot, and went to water about 40 times a day).
 */
import assert from "node:assert/strict";
import test from "node:test";
import fixtureV2 from "@/ark-scene/fixtures/snapshot-v2.json";
import table from "@/ark-scene/behaviours.json";
import {behaviourProfile, dayOf, decodeBehaviourRow, type ArkBehaviourProfile} from "@/ark-scene/behaviour-profile";
import {awakeAt, feedingRhythm, forgetSchedules, groupSpread, needAt, rangeReach, scheduleWorld, slotOffset, spaceHomes, sunElevationAt, tripAt, wakingDay, wireThreats, SLOT_SECONDS, type ArkNeed, type ScheduleAnimal} from "@/ark-scene/behaviour-schedule";
import {EATING, forayActivity, planOf, scheduleFed, type ScheduleSubject} from "@/ark-scene/animal-status";
import {eats} from "@/ark-scene/food-links";
import {placeAnimals} from "@/ark-scene/placement";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import {displayLength} from "@/ark-scene/sizes";
import {sceneSampler} from "@/ark-scene/world-sampler";
import type {ArkAnimal} from "@/ark-scene/types";
import {ARK_FED_FLOOR, arkActivityKey, arkFedRates} from "./ark-animal-status";
import {isAwake} from "./ark-daylight";
import {recordMotionMetric} from "./ark-motion-metrics";

const DAY = Math.floor(Date.UTC(2026, 10, 12) / 1000);
const hoursAt = (epoch: number) => (((epoch / 3600) % 24) + 24) % 24;
const SLOTS = Math.round(86_400 / SLOT_SECONDS);
const ROWS = (table as {species: Record<string, string>}).species;
const profileOf = (slug: string): ArkBehaviourProfile => {
    assert.ok(ROWS[slug], `${slug} is in behaviours.json`);
    return decodeBehaviourRow(slug, ROWS[slug]);
};

/** Hours asleep in a day by the schedule's own rule, every three minutes. */
function sleepHours(profile: ArkBehaviourProfile, activity: ArkBehaviourProfile["activity"] | null = null): number {
    let asleep = 0;
    for (let i = 0; i < 480; i++) if (!awakeAt(profile, activity, i * 0.05)) asleep++;
    return asleep * 0.05;
}

/** A lone animal's day of needs, slot by slot ("sleep" asleep), over `days` from the fixture's day. */
function needsDay(slug: string, days = 1, id = `n-${slug}`, extra: Partial<ScheduleAnimal> = {}): string[] {
    const profile = profileOf(slug);
    const animal = {id, zone: "woodland" as const, group: null, ...extra};
    const offset = slotOffset(id);
    const first = Math.ceil((DAY + offset) / SLOT_SECONDS);
    const out: string[] = [];
    for (let k = 0; k < SLOTS * days; k++) {
        const start = (first + k) * SLOT_SECONDS - offset;
        out.push(awakeAt(profile, null, hoursAt(start)) ? needAt(profile, animal, null, start, hoursAt) : "sleep");
    }
    return out;
}
const share = (needs: string[], need: string) => needs.filter((n) => n === need).length / Math.max(needs.filter((n) => n !== "sleep").length, 1);
function runs(needs: string[], need: string): number[] {
    const out: number[] = [];
    let n = 0;
    for (const x of [...needs, ""]) {
        if (x === need) n++;
        else if (n) {
            out.push((n * SLOT_SECONDS) / 60);
            n = 0;
        }
    }
    return out.sort((a, b) => a - b);
}
const median = (list: number[]) => (list.length ? list[Math.floor(list.length / 2)] : 0);

test("every species has a day: shares that fit, a cycle, drinks only for one that goes to water", () => {
    let written = 0;
    for (const [slug, row] of Object.entries(ROWS)) {
        const profile = decodeBehaviourRow(slug, row);
        assert.ok(profile.day, `${slug} has its day written`);
        const day = dayOf(profile);
        written++;
        assert.ok(day.feed >= 0 && day.rest >= 0 && day.feed + day.rest <= 1.0001, `${slug}: feed ${day.feed} + rest ${day.rest}`);
        assert.ok(day.cycle >= 4 && day.cycle <= 720, `${slug}: cycle ${day.cycle}`);
        assert.ok(day.sleep === null || (day.sleep >= 0 && day.sleep <= 22), `${slug}: sleep ${day.sleep}`);
        assert.ok(day.every >= 1 && day.every <= 7, `${slug}: every ${day.every}`);
        if (day.drinks > 0) assert.ok((profile.weights.drink ?? 0) > 0, `${slug} drinks but never goes to water`);
        assert.ok(day.drinks <= 3, `${slug}: ${day.drinks} drinks a day`);
    }
    assert.ok(written > 2500);
    // A species the table lacks: its diet's day.
    const lacking = behaviourProfile("no-such-species-b3", "quadruped");
    assert.equal(lacking.day, null);
    assert.ok(dayOf(lacking).feed > 0 && dayOf(lacking).cycle > 0);
});

test("sleep by kind, not one curve for all: a koala 20 hours, a giraffe four and a half, a dolphin none", () => {
    const hours = (slug: string) => Math.round(sleepHours(profileOf(slug)) * 10) / 10;
    const measured = Object.fromEntries(["koala", "giraffe", "african-bush-elephant", "plains-zebra", "cow", "african-lion", "bengal-tiger", "domestic-cat", "domestic-dog", "nine-banded-armadillo", "european-rabbit", "red-deer", "chimpanzee", "house-mouse", "great-tit"].map((slug) => [slug, hours(slug)]));
    const within = (slug: string, low: number, high: number) => assert.ok(measured[slug] >= low && measured[slug] <= high, `${slug} sleeps ${measured[slug]} h (${low}-${high})`);
    within("koala", 19, 21);
    within("giraffe", 4, 5);
    within("african-bush-elephant", 2, 4);
    within("plains-zebra", 2, 4);
    within("cow", 4, 5.5);
    within("african-lion", 12, 14.5);
    within("bengal-tiger", 12, 14.5);
    within("domestic-cat", 12, 14);
    within("domestic-dog", 8.5, 10.5);
    within("nine-banded-armadillo", 16, 18.5);
    within("european-rabbit", 8, 9.5);
    within("red-deer", 4, 5.5);
    within("chimpanzee", 9, 10.5);
    within("house-mouse", 12, 13.5);
    // No hours written: its activity's own hours by the sun, exactly as before.
    const tit = profileOf("great-tit");
    assert.equal(dayOf(tit).sleep, null);
    for (let h = 0; h < 24; h += 0.25) assert.equal(awakeAt(tit, null, h), isAwake("diurnal", sunElevationAt(h)), `great tit at ${h}`);
    // A whale, a cruising shark and a crocodile are never asleep on the schedule.
    for (const slug of ["commersons-dolphin", "humpback-whale", "great-white-shark", "saltwater-crocodile"]) if (ROWS[slug]) assert.equal(sleepHours(profileOf(slug)), 0, slug);
    // A short sleeper sleeps in the small hours, in bouts, and is up between them; a night animal by day.
    const elephant = profileOf("african-bush-elephant");
    assert.equal(awakeAt(elephant, null, 12), true);
    assert.equal(awakeAt(elephant, null, 23), false);
    assert.equal(awakeAt(elephant, null, 0.25), true, "up between two sleeps");
    const koala = profileOf("koala");
    assert.equal(awakeAt(koala, null, 12), false);
    assert.equal(awakeAt(koala, null, 19.5), true, "up at dusk");
    assert.equal(awakeAt(koala, null, 0.5), false, "asleep again about midnight");
    // The day's two ends: asleep through midday and about midnight, up at dawn and dusk (by the sun's height alone it was up 4.9 hours).
    const rabbit = profileOf("european-rabbit");
    assert.deepEqual([12.5, 0.5, 6.5, 18.5, 20.5].map((h) => awakeAt(rabbit, "crepuscular", h)), [false, false, true, true, true]);
    assert.ok(Math.abs(sleepHours(profileOf("great-tit"), "crepuscular") - 12) < 0.2, "a crepuscular animal with no hours written sleeps twelve");
    // The waking day: where its longest stretch awake begins and how long it is.
    const day = wakingDay(elephant, null);
    assert.ok(day.hours > 17 && day.hours < 19 && day.wake > 4 && day.wake < 5, JSON.stringify(day));
    recordMotionMetric("b3-needs", "sleep_hours_spread", Math.max(...Object.values(measured)) - Math.min(...Object.values(measured)));
});

test("feeding by kind and in bouts: a grazer most of its waking, a lion little, a hummingbird a minute or two every ten", () => {
    const of = (slug: string, days = 1) => needsDay(slug, days);
    const elephant = of("african-bush-elephant");
    const cow = of("cow");
    const lion = of("african-lion");
    const hummer = of("ruby-throated-hummingbird");
    const tit = of("great-tit");
    const croc = of("saltwater-crocodile", 6);
    assert.ok(share(elephant, "feed") > 0.65, `elephant feeds ${share(elephant, "feed")} of its waking`);
    assert.ok(share(cow, "feed") > 0.33 && share(cow, "rest") > 0.25, `cow: feed ${share(cow, "feed")}, rest ${share(cow, "rest")}`);
    assert.ok(share(lion, "feed") < 0.2 && share(lion, "rest") > 0.55, `lion: feed ${share(lion, "feed")}, rest ${share(lion, "rest")}`);
    assert.ok(share(croc, "feed") < 0.06 && share(croc, "rest") + share(croc, "bask") > 0.7, `crocodile: feed ${share(croc, "feed")}, rest ${share(croc, "rest")}`);
    assert.ok(share(tit, "feed") > 0.5, `great tit feeds ${share(tit, "feed")}`);
    // Bouts: a cow's feeding bout runs the best part of an hour or more, a hummingbird's a few minutes, many times a day.
    assert.ok(median(runs(cow, "feed")) >= 30, `cow's median feeding bout ${median(runs(cow, "feed"))} min`);
    assert.ok(median(runs(elephant, "feed")) >= 60, `elephant's ${median(runs(elephant, "feed"))} min`);
    assert.ok(median(runs(hummer, "feed")) <= 5 && runs(hummer, "feed").length >= 50, `hummingbird: ${runs(hummer, "feed").length} bouts of ${median(runs(hummer, "feed"))} min`);
    assert.ok(runs(lion, "feed").length <= 4, `lion: ${runs(lion, "feed").length} feeding bouts a day`);
    // Feeding leads to rest: what follows a cow's or a lion's feeding bout is its rest, not another draw.
    const after = (needs: string[]) => {
        let rest = 0;
        let all = 0;
        for (let k = 1; k < needs.length; k++) {
            if (needs[k - 1] !== "feed" || needs[k] === "feed" || needs[k] === "sleep") continue;
            all++;
            if (needs[k] === "rest" || needs[k] === "drink") rest++;
        }
        return all ? rest / all : 0;
    };
    assert.ok(after(of("cow", 3)) >= 0.8, `rest follows a cow's feeding ${after(of("cow", 3))}`);
    assert.ok(after(of("african-lion", 6)) >= 0.8, `rest follows a lion's feeding ${after(of("african-lion", 6))}`);
    // One that gorges feeds on its own days: a python on one or two days of ten, and not at all on the others.
    const python = of("ball-python", 10);
    const fedDays = Array.from({length: 10}, (_, d) => python.slice(d * SLOTS, (d + 1) * SLOTS).filter((n) => n === "feed").length).filter((n) => n > 0).length;
    assert.ok(fedDays >= 1 && fedDays <= 4, `python fed on ${fedDays} days of ten`);
    recordMotionMetric("b3-needs", "elephant_feed_share_awake", share(elephant, "feed"));
    recordMotionMetric("b3-needs", "lion_feed_share_awake", share(lion, "feed"));
    recordMotionMetric("b3-needs", "cow_feed_bout_median_min", median(runs(cow, "feed")));
    recordMotionMetric("b3-needs", "hummingbird_feed_bouts_a_day", runs(hummer, "feed").length);
});

test("trips to water: once or twice a day for a zebra, never for a koala or a kangaroo rat, a herd together", () => {
    const drinks = (slug: string, days: number) => runs(needsDay(slug, days), "drink").length / days;
    assert.ok(drinks("plains-zebra", 8) >= 1 && drinks("plains-zebra", 8) <= 2, `zebra ${drinks("plains-zebra", 8)} a day`);
    assert.ok(drinks("cow", 8) >= 1 && drinks("cow", 8) <= 2, `cow ${drinks("cow", 8)} a day`);
    assert.ok(drinks("giraffe", 8) > 0 && drinks("giraffe", 8) < 1.01, `giraffe ${drinks("giraffe", 8)} a day`);
    assert.equal(drinks("koala", 4), 0);
    for (const slug of ["ords-kangaroo-rat", "ruby-throated-hummingbird", "commersons-dolphin", "green-anaconda"]) if (ROWS[slug]) assert.equal(drinks(slug, 3), 0, slug);
    // A day of its own each time (not the same minute every day), and each trip one slot.
    const zebra = needsDay("plains-zebra", 4);
    const at = zebra.map((n, k) => (n === "drink" ? k % SLOTS : -1)).filter((k) => k >= 0);
    assert.ok(new Set(at).size >= Math.min(at.length, 3), "at its own minute each day");
    assert.ok(runs(zebra, "drink").every((minutes) => minutes <= (2 * SLOT_SECONDS) / 60));
    // A herd goes together: a member's trips are its leader's, slot for slot (their slots are offset by under a slot).
    const profile = profileOf("plains-zebra");
    const leader: ScheduleAnimal = {id: "herd-lead", zone: "grassland", home: {x: 0, y: 0, z: 0}, length: 2.4, sea: false};
    const member: ScheduleAnimal = {id: "herd-member", zone: "grassland", home: {x: 0, y: 0, z: 0}, length: 2.4, sea: false, group: {leader, profile, activity: null, rank: 1, size: 4}};
    const times = (animal: ScheduleAnimal) => {
        const offset = slotOffset(animal.id);
        const first = Math.ceil((DAY + offset) / SLOT_SECONDS);
        const out: number[] = [];
        for (let k = 0; k < SLOTS * 3; k++) {
            const start = (first + k) * SLOT_SECONDS - offset;
            if (awakeAt(profile, null, hoursAt(start)) && needAt(profile, animal, null, start, hoursAt) === "drink") out.push(start);
        }
        return out;
    };
    const lead = times(leader);
    const follows = times(member);
    assert.ok(lead.length >= 3 && follows.length === lead.length, `${lead.length} and ${follows.length} trips`);
    lead.forEach((t, i) => assert.ok(Math.abs(follows[i] - t) <= SLOT_SECONDS, `trip ${i}: ${follows[i] - t} s apart`));
    recordMotionMetric("b3-needs", "zebra_drinks_a_day", drinks("plains-zebra", 8));
});

test("order by cause: a basker basks first on a morning's waking, the last minutes up are rest, a zoo's feeding time is feeding, the hour pinned still lives", () => {
    // The first waking hour of a day lizard's morning is its bask.
    for (const slug of ["green-iguana", "central-bearded-dragon"]) {
        if (!ROWS[slug]) continue;
        const profile = profileOf(slug);
        assert.ok((profile.weights.bask ?? 0) > 0, `${slug} basks`);
        const waking = wakingDay(profile, null);
        const animal = {id: `bask-${slug}`, zone: "desert" as const, group: null};
        const needs: ArkNeed[] = [];
        for (let k = 1; k <= 30; k++) needs.push(needAt(profile, animal, null, DAY + waking.wake * 3600 + k * SLOT_SECONDS, hoursAt));
        assert.ok(needs.filter((n) => n === "bask").length >= 28, `${slug}: ${needs.filter((n) => n === "bask").length} of its first 30 slots basking`);
    }
    // Winding down: a day bird's last quarter of an hour before its sleep is rest.
    const tit = profileOf("great-tit");
    const waking = wakingDay(tit, null);
    const bed = DAY + (waking.wake + waking.hours) * 3600;
    const last = Array.from({length: 10}, (_, k) => needAt(tit, {id: "tit-1", zone: "woodland", group: null}, null, bed - (k + 1) * SLOT_SECONDS - 5, hoursAt));
    assert.ok(last.filter((n) => n === "rest").length >= 9, last.join(","));
    // A zoo's feeding time.
    assert.equal(needAt(profileOf("african-lion"), {id: "zoo-lion", zone: "grassland", group: null, feeding: true}, null, DAY + 13 * 3600, hoursAt), "feed");
    // The hour pinned (a recording's): a short cycle still turns, and it still goes to water now and then.
    const pinned = () => 10.5;
    const cow = profileOf("cow");
    const seen = new Set<string>();
    for (let k = 0; k < SLOTS; k++) seen.add(needAt(cow, {id: "pinned-cow", zone: "grassland", group: null}, null, DAY + k * SLOT_SECONDS, pinned));
    assert.ok(seen.has("feed") && seen.has("rest") && seen.has("drink"), Array.from(seen).join(","));
    // Pure: the same answer every time, whoever asks and in whatever order.
    const a = needsDay("red-deer");
    assert.deepEqual(needsDay("red-deer"), a);
});

test("the fed bar's rate is its feeding rhythm's: a shrew's gap is minutes, a deer's an hour, a lion's most of its night, a python's days", () => {
    const gap = (slug: string) => feedingRhythm(profileOf(slug), null).gap;
    const order = ["ruby-throated-hummingbird", "red-deer", "african-lion", "ball-python"].map(gap);
    for (let i = 1; i < order.length; i++) assert.ok(order[i] > order[i - 1], `${order[i]} > ${order[i - 1]}`);
    assert.ok(gap("ruby-throated-hummingbird") <= 900 && gap("african-lion") > 4 * 3600 && gap("ball-python") > 24 * 3600, order.join(", "));
    // From full it reaches its floor a little after one gap awake and not eating.
    const rates = arkFedRates("meat", 2, 3600);
    assert.ok(Math.abs((1 - ARK_FED_FLOOR) / rates.drain - 3600 / 0.9) < 1);
    // Without a rhythm: by diet and length, as before.
    assert.equal(Math.round(arkFedRates("grazer", 1).drain * 60 * 1000) / 10, 5);
});

test("a server foray is hunting only for a hunter: a goose's is grazing, a sunbird's is at flowers, a flamingo's is looking for food", () => {
    assert.equal(forayActivity(profileOf("african-lion")), "hunting");
    assert.equal(forayActivity(profileOf("saltwater-crocodile")), "hunting");
    assert.equal(forayActivity(profileOf("greylag-goose")), "grazing");
    assert.equal(forayActivity(profileOf("leopard-tortoise")), "grazing");
    assert.equal(forayActivity(profileOf("crimson-sunbird")), "flowers");
    assert.equal(forayActivity(profileOf("greater-flamingo")), "food");
    // Whatever it is said as, it is eating (its fed bar fills).
    for (const slug of ["african-lion", "greylag-goose", "crimson-sunbird", "greater-flamingo"]) assert.ok(EATING.has(forayActivity(profileOf(slug))), slug);
});

// MARK: On the fixture's world (the schedule's own plans and trips)

const snapshot = decodeArkSnapshot(fixtureV2)!;
const world = scheduleWorld(sceneSampler());
const places = placeAnimals(snapshot.animals);
const SEA = new Set(["coral_reef", "open_ocean"]);
const GROUPED = new Set(["herd", "flock", "school", "troop", "pack", "group", "colony", "swarm"]);
type Item = {a: ArkAnimal; animal: ScheduleAnimal; profile: ArkBehaviourProfile; subject: ScheduleSubject};

function wire(): Item[] {
    const items = snapshot.animals.map((a) => {
        const p = places.get(a.id)!;
        const profile = behaviourProfile(a.model_slug);
        const animal: ScheduleAnimal = {id: a.id, zone: a.zone, home: {x: p.x, y: p.ground, z: p.z}, length: displayLength(a), sea: SEA.has(a.zone), young: false};
        return {a, animal, profile};
    });
    const byId = new Map(items.map((i) => [i.a.id, i]));
    const sizes = new Map<string, number>();
    for (const i of items) {
        const lead = places.get(i.a.id)!.leader;
        if (lead && lead !== i.a.id) sizes.set(lead, (sizes.get(lead) ?? 1) + 1);
    }
    for (const i of items) {
        const place = places.get(i.a.id)!;
        const leader = place.leader && place.leader !== i.a.id ? byId.get(place.leader) : null;
        if (leader && leader.a.model_slug === i.a.model_slug && GROUPED.has(i.profile.social)) i.animal.group = {leader: leader.animal, profile: leader.profile, activity: leader.a.activity, rank: Math.max(place.rank ?? 1, 1), size: sizes.get(leader.a.id) ?? 2};
    }
    const radius = new Map(items.map((i) => [i.a.id, rangeReach(i.profile, i.animal) + (sizes.has(i.a.id) ? groupSpread(i.animal.length, sizes.get(i.a.id)!) : 0)]));
    const spaced = spaceHomes(
        items.filter((i) => !i.animal.group).map((i) => ({id: i.a.id, slug: i.a.model_slug, home: i.animal.home, length: i.animal.length, walkable: (x: number, z: number) => (i.profile.move === "swim" || i.profile.seabed ? world.nav.swimmable(x, z, 0.5) : world.nav.walkable(x, z))})),
        eats,
        (id) => radius.get(id) ?? 3
    );
    for (const i of items) {
        const moved = spaced.get(i.a.id);
        if (!moved) continue;
        i.animal.home = {x: moved.home.x, y: Math.max(world.sampler.heightAt(moved.home.x, moved.home.z), 0), z: moved.home.z};
        i.animal.range = moved.range;
        i.animal.prey = moved.prey;
    }
    wireThreats(items.map((i) => ({slug: i.a.model_slug, animal: i.animal, profile: i.profile, activity: i.a.activity})), eats);
    return items.map((i) => ({...i, subject: {id: i.a.id, world, profile: i.profile, animalAt: () => i.animal, activity: i.a.activity, hoursAt}}));
}
const items = wire();
forgetSchedules();
const keyAt = (i: Item, epoch: number) => {
    const plan = planOf(i.subject, epoch);
    return {plan, key: arkActivityKey({doing: plan.doing, recipe: plan.recipe, wary: plan.wary, flyer: i.profile.move === "fly", still: plan.still})};
};

const MOVING: ReadonlySet<string> = new Set(["wandering", "flying", "swimming", "climbing", "home", "light", "breathing", "drinking", "toWater", "digging"]);

test("on the fixture: what an animal is seen doing runs in bouts (it changed about 30 times a waking hour), a grazer grazes, nobody commutes to water", () => {
    // Four waking hours of every animal on the schedule, 08:00-12:00 (and 20:00-24:00 for the night's).
    let changes = 0;
    let awakeSlots = 0;
    let drinks = 0;
    let animalsUp = 0;
    const grazerFeed: number[] = [];
    const feedRuns: number[] = [];
    for (const i of items) {
        if (i.profile.move === "sessile") continue;
        const from = awakeAt(i.profile, i.a.activity, 10) ? DAY + 8 * 3600 : DAY + 20 * 3600;
        let last = "";
        let run = 0;
        let fed = 0;
        let up = 0;
        for (let k = 0; k < 180; k++) {
            const {plan, key} = keyAt(i, from + k * SLOT_SECONDS);
            if (plan.doing === "sleep" || plan.doing === "to_roost") {
                last = "";
                continue;
            }
            up++;
            if (key === "drinking" || key === "toWater") drinks++;
            const eating = EATING.has(key);
            if (eating) fed++;
            if (eating) run++;
            else if (run) {
                feedRuns.push(run);
                run = 0;
            }
            // (What a viewer tells apart at a glance: feeding, on the move, settled in place. A rest that turns into a
            // preen and back is not a change.)
            const mode = eating || key === "prowling" ? "feed" : MOVING.has(key) ? "move" : "settle";
            if (last && last !== mode) changes++;
            last = mode;
        }
        if (!up) continue;
        animalsUp++;
        awakeSlots += up;
        if ((i.profile.diet === "grazer" || i.profile.diet === "browser") && dayOf(i.profile).feed >= 0.5 && up >= 120) grazerFeed.push(fed / up);
    }
    const perHour = changes / ((awakeSlots * SLOT_SECONDS) / 3600);
    const drinksPerAnimalDay = (drinks / Math.max(awakeSlots, 1)) * SLOTS * 0.55;
    feedRuns.sort((a, b) => a - b);
    grazerFeed.sort((a, b) => a - b);
    // How much of all the feeding is in bouts of four slots (five minutes) and up: drawn slot by slot, about a tenth.
    const inBouts = feedRuns.filter((n) => n >= 4).reduce((a, b) => a + b, 0) / Math.max(feedRuns.reduce((a, b) => a + b, 0), 1);
    console.log(`needs on the fixture: ${animalsUp} animals up, ${perHour.toFixed(1)} changes a waking hour, median feeding run ${median(feedRuns)} slots (mean ${(feedRuns.reduce((a, b) => a + b, 0) / Math.max(feedRuns.length, 1)).toFixed(1)}), ${inBouts.toFixed(3)} of feeding in bouts of 4 slots and up, grazers feeding ${median(grazerFeed).toFixed(2)} (${grazerFeed.length}), drinking slots an animal a day ${drinksPerAnimalDay.toFixed(2)}`);
    assert.ok(animalsUp > 100, `${animalsUp} animals up`);
    assert.ok(perHour < 12, `${perHour.toFixed(1)} changes between feeding, moving and settled a waking hour`);
    assert.ok(inBouts >= 0.6, `${inBouts.toFixed(2)} of feeding slots are in bouts of four slots and up`);
    assert.ok(grazerFeed.length >= 5 && median(grazerFeed) >= 0.4, `grazers and browsers feed ${median(grazerFeed)} of these hours (${grazerFeed.length})`);
    assert.ok(drinksPerAnimalDay < 3, `about ${drinksPerAnimalDay.toFixed(1)} drinking slots an animal a day`);
    recordMotionMetric("b3-needs", "activity_changes_per_awake_hour", perHour);
    recordMotionMetric("b3-needs", "feeding_in_bouts_share", inBouts);
    recordMotionMetric("b3-needs", "grazer_feed_share_morning", median(grazerFeed));
});

test("on the fixture: a rest keeps its place through its spell (a long rest got up and wandered home every fifth slot)", () => {
    // Walkers' consecutive resting slots: the second starts where the first was, and goes nowhere.
    let pairs = 0;
    let stayed = 0;
    let wanders = 0;
    let slots = 0;
    for (const i of items) {
        if (i.profile.move !== "walk" || i.animal.group || i.profile.surface) continue;
        const from = awakeAt(i.profile, i.a.activity, 10) ? DAY + 9 * 3600 : DAY + 21 * 3600;
        let previous: ReturnType<typeof tripAt> | null = null;
        for (let k = 0; k < 60; k++) {
            const trip = tripAt(world, i.profile, i.animal, from + k * SLOT_SECONDS, hoursAt, i.a.activity, previous);
            slots++;
            if (trip.doing === "wander") wanders++;
            if (previous && previous.doing === "rest" && trip.doing === "rest" && !trip.recipe && !previous.recipe) {
                pairs++;
                if (trip.length < 0.5) stayed++;
            }
            previous = trip;
        }
        if (pairs > 1500) break;
    }
    console.log(`needs on the fixture: ${stayed} of ${pairs} resting slots stayed put; walkers wander ${(wanders / slots).toFixed(3)} of their slots`);
    assert.ok(pairs >= 200, `${pairs} pairs of resting slots`);
    assert.ok(stayed / pairs >= 0.85, `${stayed} of ${pairs} resting slots stayed put`);
    recordMotionMetric("b3-needs", "rest_slots_staying_put_share", stayed / pairs);
    recordMotionMetric("b3-needs", "walker_wander_share", wanders / slots);
});

test("on the fixture: the fed bar is low before a feeding bout and fills through it", () => {
    const before: number[] = [];
    const after: number[] = [];
    for (const i of items.slice(0, 160)) {
        if (i.profile.move === "sessile" || dayOf(i.profile).cycle > 200) continue;
        const from = awakeAt(i.profile, i.a.activity, 10) ? DAY + 8 * 3600 : DAY + 20 * 3600;
        let run = 0;
        let start = NaN;
        for (let k = 0; k < 135; k++) {
            const {plan, key} = keyAt(i, from + k * SLOT_SECONDS);
            const eating = plan.doing !== "sleep" && EATING.has(key);
            if (eating && !run) start = scheduleFed(i.subject, plan.start + 1)?.value ?? NaN;
            if (eating) run++;
            else {
                if (run >= 4 && Number.isFinite(start)) {
                    const end = scheduleFed(i.subject, plan.start - 1)?.value ?? NaN;
                    if (Number.isFinite(end)) {
                        before.push(start);
                        after.push(end);
                    }
                }
                run = 0;
            }
        }
    }
    const mean = (list: number[]) => list.reduce((a, b) => a + b, 0) / Math.max(list.length, 1);
    console.log(`needs on the fixture: fed ${mean(before).toFixed(3)} before a feeding bout, ${mean(after).toFixed(3)} after (${before.length} bouts)`);
    assert.ok(before.length >= 40, `${before.length} feeding bouts`);
    assert.ok(mean(after) - mean(before) >= 0.15, `fed ${mean(before).toFixed(2)} before a bout, ${mean(after).toFixed(2)} after`);
    assert.ok(after.filter((v, n) => v >= before[n]).length >= before.length * 0.95, "it never ends a bout hungrier");
    recordMotionMetric("b3-needs", "fed_before_feeding_bout", mean(before));
    recordMotionMetric("b3-needs", "fed_after_feeding_bout", mean(after));
});
