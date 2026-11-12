import assert from "node:assert/strict";
import test from "node:test";
import type {ArkAnimal, ArkSnapshot} from "@/ark-scene/types";
import {
    ARK_CHANGE_CACHE_KEY,
    ARK_CHANGE_CACHE_MS,
    arkChangeOf,
    arkChangeSince,
    arkChangeText,
    arkEventsNet,
    arkPopulationThen,
    arkRankedSpecies,
    arkTotalChange,
    readArkPopulationThen
} from "@/lib/ark-population-change";

/**
 * The population overlay (decision 239): species biggest first, and each count's change over 24 hours worked out
 * from the event log (the count then = now − arrivals − births + the ones that left).
 */

let serial = 0;

function animal(name: string, island: "wild" | "town" | null, extra: Partial<ArkAnimal> = {}): ArkAnimal {
    serial++;
    const slug = name.toLowerCase().replace(/\s+/g, "-");
    return {
        id: `a-${slug}-${serial}`,
        species_profile_id: `sp-${slug}`,
        name,
        scientific_name: null,
        model_slug: slug,
        zone: island === "town" ? "farm_garden" : "grassland",
        arrived_at: "2026-11-01T00:00:00Z",
        brought_by: {label: "Voyager 1", named: false},
        mine: false,
        ...(island ? {island} : {}),
        ...extra
    } as ArkAnimal;
}

function snapshotOf(animals: ArkAnimal[]): ArkSnapshot {
    return {
        voyage: {slug: "ark", name: "Ark", started_at: null},
        counts: {animals: animals.length, species: new Set(animals.map((a) => a.species_profile_id)).size, founders: 1},
        zones: [],
        animals,
        as_of: null
    };
}

function many(count: number, name: string, island: "wild" | "town" | null, extra: Partial<ArkAnimal> = {}): ArkAnimal[] {
    return Array.from({length: count}, () => animal(name, island, extra));
}

/** An event row as `voyage_events_since_v1` writes it (only what the count reads). */
function row(id: number, kind: string, who: ArkAnimal | {id: string; species_profile_id: string; model_slug: string; island?: string; area?: string}, other?: ArkAnimal) {
    const shape = (a: typeof who) => ({id: a.id, species_profile_id: a.species_profile_id, model_slug: a.model_slug, island: "island" in a ? a.island : undefined, area: "area" in a ? a.area : undefined});
    return {id, kind, at: `2026-11-12T0${id % 10}:00:00Z`, species_profile_id: who.species_profile_id, animal: shape(who), other: other ? shape(other) : null};
}

test("biggest first: the most numerous species leads, ties by name, breeds counted as their kind (A1)", () => {
    const dogs = [
        ...many(2, "Labrador", "town", {kind_species_profile_id: "sp-dog", kind_name: "Domestic Dog"}),
        ...many(2, "Poodle", "town", {kind_species_profile_id: "sp-dog", kind_name: "Domestic Dog"})
    ];
    const snapshot = snapshotOf([...many(3, "Zebra", "wild"), ...many(1, "Aardvark", "wild"), ...many(1, "Bison", "wild"), ...dogs]);
    const ranked = arkRankedSpecies(snapshot);
    assert.deepEqual(ranked.map((r) => [r.name, r.count]), [["Domestic Dog", 4], ["Zebra", 3], ["Aardvark", 1], ["Bison", 1]]);
    assert.equal(ranked[0].breeds.length, 2, "the kind's breeds stay inside its row");
    assert.deepEqual(arkRankedSpecies(null), []);
});

test("the count 24 hours ago: now, less arrivals and births, plus the animals that left", () => {
    const zebras = many(5, "Zebra", "wild");
    const lions = many(2, "Lion", "wild");
    const snapshot = snapshotOf([...zebras, ...lions]);
    // Two zebras came aboard and one was born in the window; a lion ate a zebra that is gone now; another zebra died old.
    const eaten = {id: "gone-1", species_profile_id: "sp-zebra", model_slug: "zebra", island: "wild"};
    const old = {id: "gone-2", species_profile_id: "sp-zebra", model_slug: "zebra", island: "wild"};
    const events = [
        row(1, "arrival", zebras[0]),
        row(2, "arrival", zebras[1]),
        row(3, "birth", zebras[2]),
        row(4, "meal", lions[0], eaten as unknown as ArkAnimal),
        // The meal's other half names the same prey: one departure, not two.
        row(5, "eaten", eaten),
        row(6, "death_old", old),
        // Hunger, feeding, mating and clutches move nobody.
        row(7, "fed", lions[1]),
        row(8, "mated", zebras[3]),
        row(9, "laid", zebras[4])
    ];
    const net = arkEventsNet({events}, snapshot);
    assert.deepEqual(net.get("sp-zebra"), [3 - 2, 0], "3 came, 2 left");
    assert.equal(net.get("sp-lion"), undefined);
    const then = arkPopulationThen(snapshot, events, 0, "x");
    assert.deepEqual(then.then["sp-zebra"], [4, 0], "5 now − 3 came + 2 left");
    assert.deepEqual(then.then["sp-lion"], [2, 0]);
    assert.deepEqual(arkChangeOf(5, then, "sp-zebra", "wild"), {delta: 1, base: 4});
    assert.deepEqual(arkChangeOf(2, then, "sp-lion", "both"), {delta: 0, base: 2});
    assert.deepEqual(arkTotalChange(7, then, "both"), {delta: 1, base: 6});
});

test("an animal that came and left inside the window counts as neither; one gone with its kind gone counts down to none", () => {
    const owls = many(1, "Owl", "wild");
    const snapshot = snapshotOf(owls);
    const visitor = {id: "v-1", species_profile_id: "sp-mouse", model_slug: "mouse", island: "wild"};
    const lastFox = {id: "f-1", species_profile_id: "sp-fox", model_slug: "fox", island: "wild"};
    const events = [row(1, "arrival", visitor), row(2, "meal", owls[0], visitor as unknown as ArkAnimal), row(3, "starved", lastFox)];
    const then = arkPopulationThen(snapshot, events, 0, "x");
    assert.equal(then.then["sp-mouse"], undefined, "came and was eaten: not aboard then, not aboard now");
    assert.deepEqual(then.then["sp-fox"], [1, 0], "one fox then, none now");
    assert.deepEqual(arkChangeOf(0, then, "sp-fox", "wild"), {delta: -1, base: 1});
});

test("each island apart: a row's change is its scope's (the island shown, or both)", () => {
    const wildCats = many(4, "Wildcat", "wild");
    const townCats = many(6, "Wildcat", "town");
    const snapshot = snapshotOf([...wildCats, ...townCats]);
    const events = [row(1, "arrival", townCats[0]), row(2, "arrival", townCats[1]), row(3, "arrival", wildCats[0])];
    const then = arkPopulationThen(snapshot, events, 0, "x");
    assert.deepEqual(then.then["sp-wildcat"], [3, 4]);
    assert.deepEqual(arkChangeOf(6, then, "sp-wildcat", "town"), {delta: 2, base: 4});
    assert.deepEqual(arkChangeOf(4, then, "sp-wildcat", "wild"), {delta: 1, base: 3});
    assert.deepEqual(arkChangeOf(10, then, "sp-wildcat", "both"), {delta: 3, base: 7});
    // A departed animal no longer aboard: its island from the row (or its area on an older row).
    const gone = {id: "g-1", species_profile_id: "sp-wildcat", model_slug: "wildcat", area: "house"};
    assert.deepEqual(arkEventsNet([row(4, "death_old", gone)], snapshot).get("sp-wildcat"), [0, -1]);
});

test("a breed that left counts in its kind's row (A1), as the panel lists it", () => {
    const dogs = many(3, "Labrador", "town", {kind_species_profile_id: "sp-dog", kind_name: "Domestic Dog"});
    const snapshot = snapshotOf(dogs);
    const gone = {id: "g-lab", species_profile_id: "sp-labrador", model_slug: "labrador", island: "town"};
    const then = arkPopulationThen(snapshot, [row(1, "eaten", gone), row(2, "arrival", dogs[0])], 0, "x");
    assert.deepEqual(then.then["sp-dog"], [0, 3]);
    assert.equal(then.then["sp-labrador"], undefined);
});

test("said as a percentage from three animals then, as a count below; nothing when unchanged; null when not read", () => {
    assert.deepEqual(arkChangeText({delta: 3, base: 25}, "en"), {text: "+12%", up: true, percent: true});
    assert.deepEqual(arkChangeText({delta: -1, base: 4}, "en"), {text: "−25%", up: false, percent: true});
    assert.deepEqual(arkChangeText({delta: 1, base: 250}, "en"), {text: "+0.4%", up: true, percent: true}, "a tenth under 10%");
    assert.deepEqual(arkChangeText({delta: 1, base: 5000}, "en"), {text: "+0.1%", up: true, percent: true}, "never +0%");
    assert.deepEqual(arkChangeText({delta: 4, base: 2}, "en"), {text: "+4", up: true, percent: false}, "two then: the count, not +200%");
    assert.deepEqual(arkChangeText({delta: 3, base: 0}, "en"), {text: "+3", up: true, percent: false}, "new aboard");
    assert.deepEqual(arkChangeText({delta: -2, base: 2}, "en"), {text: "−2", up: false, percent: false});
    assert.equal(arkChangeText({delta: 0, base: 10}, "en"), null);
    assert.equal(arkChangeText(null, "en"), null);
    assert.equal(arkChangeOf(3, null, "k", "both"), null);
    assert.equal(arkChangeText({delta: 3, base: 25}, "de")?.text, "+12 %", "the reader's own percent");
});

function memoryStorage() {
    const data = new Map<string, string>();
    return {getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => void data.set(key, value), data};
}

test("reading the log: once, from 24 hours back rounded to five minutes, then kept for five minutes per device", async () => {
    const zebras = many(3, "Zebra", "wild");
    const snapshot = snapshotOf(zebras);
    const asked: string[] = [];
    const fetch = async (url: string) => {
        asked.push(url);
        return {ok: true, json: async () => ({events: [row(1, "arrival", zebras[0])], more: false, available: true})};
    };
    const storage = memoryStorage();
    const now = Date.parse("2026-11-12T10:17:42Z");
    const first = await readArkPopulationThen("/api/ark/events", snapshot, {fetch, storage, now: () => now});
    assert.equal(arkChangeSince(now), "2026-11-11T10:15:00.000Z");
    assert.deepEqual(asked, ["/api/ark/events?since=2026-11-11T10%3A15%3A00.000Z"]);
    assert.deepEqual(first?.then["sp-zebra"], [2, 0]);
    const again = await readArkPopulationThen("/api/ark/events", snapshot, {fetch, storage, now: () => now + 60_000});
    assert.equal(asked.length, 1, "kept");
    assert.deepEqual(again?.then, first?.then);
    await readArkPopulationThen("/api/ark/events", snapshot, {fetch, storage, now: () => now + ARK_CHANGE_CACHE_MS + 1});
    assert.equal(asked.length, 2, "read again after five minutes");
    // Storage that throws: read every time, never an error.
    const broken = {getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); }};
    assert.ok(await readArkPopulationThen("/api/ark/events", snapshot, {fetch, storage: broken, now: () => now}));
});

test("a window the read cannot give whole says nothing (and is not read again at once); a failed read says nothing", async () => {
    const zebras = many(2, "Zebra", "wild");
    const snapshot = snapshotOf(zebras);
    // A burst: every read answers `more` with the same rows (more in one minute than the route pages through).
    let reads = 0;
    const stuck = async () => {
        reads++;
        return {ok: true, json: async () => ({events: [row(1, "arrival", zebras[0]), row(2, "arrival", zebras[1])], more: true, available: true})};
    };
    const storage = memoryStorage();
    assert.equal(await readArkPopulationThen("/api/ark/events", snapshot, {fetch: stuck, storage, now: () => 0}), null);
    assert.equal(reads, 2, "the second read starts at the last row; nothing new, so it stops");
    assert.equal(await readArkPopulationThen("/api/ark/events", snapshot, {fetch: stuck, storage, now: () => 1000}), null);
    assert.equal(reads, 2, "the unreadable window is kept, not read again on every load");
    assert.match(storage.data.get(ARK_CHANGE_CACHE_KEY) ?? "", /"then":null/);
    // A second page that finishes the window: both pages counted, the overlap once.
    let page = 0;
    const paged = async (url: string) => {
        page++;
        return page === 1
            ? {ok: true, json: async () => ({events: [row(1, "arrival", zebras[0])], more: true})}
            : (assert.match(url, /since=2026-11-12T01%3A00%3A00Z/), {ok: true, json: async () => ({events: [row(1, "arrival", zebras[0]), row(2, "arrival", zebras[1])], more: false})});
    };
    const whole = await readArkPopulationThen("/api/ark/events", snapshot, {fetch: paged, storage: null, now: () => 0});
    assert.equal(whole?.then["sp-zebra"], undefined, "both zebras came in the window: none then");
    // Not there yet, or failing: nothing.
    assert.equal(await readArkPopulationThen("/api/ark/events", snapshot, {fetch: async () => ({ok: true, json: async () => ({events: [], available: false})}), storage: null}), null);
    assert.equal(await readArkPopulationThen("/api/ark/events", snapshot, {fetch: async () => ({ok: false, json: async () => ({})}), storage: null}), null);
    assert.equal(await readArkPopulationThen("/api/ark/events", snapshot, {fetch: async () => { throw new Error("offline"); }, storage: null}), null);
});
