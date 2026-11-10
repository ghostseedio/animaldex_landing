import assert from "node:assert/strict";
import test from "node:test";
import en from "@/data/locales/en.json";
import id from "@/data/locales/id.json";
import fixtureV2 from "@/ark-scene/fixtures/snapshot-v2.json";
import {eggsFixture, herdFixture, placeholderFixture} from "@/ark-scene/fixtures/edge";
import {ARK_HERD_FROM, ARK_HERD_LIVE, arkHerdKeys, arkRepresentatives} from "@/ark-scene/herds";
import {drawnEggs, nestKind} from "@/ark-scene/nests";
import {arkPlaceholderSlug, isArkPlaceholderSlug} from "@/ark-scene/placeholder";
import {placeAnimals} from "@/ark-scene/placement";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import {arkBringerLabel, arkHatchNest, arkJoinLabels, decodeArkEvents, decodeArkLife, isQuietArkReplay, planArkReplay} from "@/lib/ark-life";
import {arkMissingModels, decodeArkMissingModels} from "@/lib/ark-missing-models";
import {arkPopulation, arkSpeciesAboard} from "@/lib/ark-population";

type Raw = Parameters<typeof herdFixture>[0];
const raw = () => JSON.parse(JSON.stringify(fixtureV2)) as Raw;

// MARK: A13, the placeholder

test("a species with no model decodes as the placeholder, never dropped", () => {
    const snapshot = decodeArkSnapshot(placeholderFixture(raw()))!;
    const saola = snapshot.animals.filter((a) => a.name === "Saola");
    assert.equal(saola.length, 2);
    assert.ok(saola.every((a) => a.placeholder === true && isArkPlaceholderSlug(a.model_slug)));
    // One species, one slug: one row in the panel, one mesh in the scene.
    assert.equal(new Set(saola.map((a) => a.model_slug)).size, 1);
    assert.equal(saola[0].model_slug, arkPlaceholderSlug(saola[0].species_profile_id, saola[0].id));
    const row = arkPopulation(snapshot).regions.flatMap((g) => g.species).find((r) => r.name === "Saola");
    assert.equal(row?.count, 2);
    // A real slug the server sends stays as it is (the scene falls back when the model set doesn't list it).
    assert.equal(snapshot.animals.find((a) => a.name.startsWith("Test Missing"))?.placeholder, undefined);
});

test("the missing-models list: the placeholders, and slugs the manifest doesn't list, most animals first", () => {
    const snapshot = decodeArkSnapshot(placeholderFixture(raw()))!;
    const listed = new Set(snapshot.animals.map((a) => a.model_slug).filter((slug) => slug !== "zz-ark-missing-model-test" && !isArkPlaceholderSlug(slug)));
    const rows = arkMissingModels(snapshot, listed);
    assert.deepEqual(rows.map((r) => [r.name, r.animals, r.reason, r.slug]), [["Saola", 2, "no_slug", null], ["Test Missing-model Antelope", 1, "not_in_manifest", "zz-ark-missing-model-test"]]);
    // No manifest: only the placeholders.
    assert.deepEqual(arkMissingModels(snapshot, null).map((r) => r.name), ["Saola"]);
    // The RPC's rows, in either shape.
    // The RPC's rows (20261113120000's columns), in its order.
    const decoded = decodeArkMissingModels([
        {species_profile_id: "a", name: "Okapi", scientific_name: "Okapia johnstoni", animaldex_number: 812, identity_kind: "species", kind_species_profile_id: "a", kind_name: "Okapi", animals_living: 3, animals_ever: 4, worked_steps: 9},
        {species_profile_id: "b", name: "Labradoodle", scientific_name: null, animaldex_number: null, identity_kind: "breed", kind_species_profile_id: "dog", kind_name: "Domestic Dog", animals_living: 0, animals_ever: 0, worked_steps: 2}
    ]);
    assert.deepEqual(decoded.map((r) => [r.name, r.animals, r.animalsEver, r.workedSteps, r.reason, r.kindName, r.animaldexNumber]), [["Okapi", 3, 4, 9, "no_slug", null, 812], ["Labradoodle", 0, 0, 2, "no_slug", "Domestic Dog", null]]);
    assert.deepEqual(decodeArkMissingModels({rows: [{species_profile_id: "c", name: "Aye-aye", slug: "aye-aye", count: 7, reason: "not_in_manifest"}]}).map((r) => [r.animals, r.reason]), [[7, "not_in_manifest"]]);
});

test("an event naming a placeholder animal no longer aboard keeps it (its placeholder slug)", () => {
    const events = decodeArkEvents([{id: 1, kind: "death_old", at: "2026-11-09T00:00:00Z", animal: {id: "x1", species_profile_id: "sp-okapi", name: "Okapi", model_slug: null, placeholder: true, zone: "rainforest"}}], null);
    assert.equal(events[0].animal?.model_slug, arkPlaceholderSlug("sp-okapi", "x1"));
});

// MARK: A9, eggs

test("eggs: laid, then hatched from the same clutch; the summary counts both and eggs are never a meal", () => {
    const {snapshot: rawSnapshot, events} = eggsFixture(raw());
    const snapshot = decodeArkSnapshot(rawSnapshot)!;
    const decoded = decodeArkEvents(events, snapshot);
    assert.deepEqual(decoded.map((e) => [e.kind, e.from_egg, e.eggs]), [
        ["laid", false, 6], ["birth", true, null], ["birth", true, null], ["laid", false, 1], ["birth", true, null], ["birth", true, null], ["birth", true, null]
    ]);
    const plan = planArkReplay(decoded);
    assert.deepEqual(plan.acts.map((a) => a.kind), ["laid", "birth", "laid", "birth"]);
    assert.deepEqual({laid: plan.summary.laid, hatched: plan.summary.hatched, births: plan.summary.births, meals: plan.summary.meals}, {laid: 2, hatched: 5, births: 5, meals: 0});
    assert.equal(isQuietArkReplay({...plan.summary, arrivals: 0, births: 0, hatched: 0, meals: 0, deaths: 0, starved: 0, extinctions: 0}), false);
    // The mallards' young hatch from the clutch laid before; the turtle's clutch was laid before the visit.
    const mallardLaid = plan.acts[0];
    assert.equal(arkHatchNest(plan.acts, 1), mallardLaid);
    assert.equal(arkHatchNest(plan.acts, 3), null);
    const hatch = plan.acts[1];
    assert.ok(hatch.kind === "birth" && hatch.fromEgg && hatch.young.length === 2);
});

test("a nest suits its parent: a bird's nest, spawn in the water, else a scrape; never more than 9 eggs drawn", () => {
    assert.equal(nestKind({plan: "bird", slug: "mallard", water: false}), "nest");
    assert.equal(nestKind({plan: "fish", slug: "atlantic-herring", water: true}), "spawn");
    assert.equal(nestKind({plan: "frog", slug: "common-frog", water: false}), "spawn");
    assert.equal(nestKind({plan: "reptile", slug: "komodo-dragon", water: false}), "scrape");
    assert.equal(drawnEggs("scrape", 120), 9);
    assert.equal(drawnEggs("nest", null), 3);
    assert.ok(drawnEggs("spawn", 5000) <= 18);
});

// MARK: A14, herds

test("1,000 of one species: a herd of 24 representatives, the rest massed, and all keep the server's places", () => {
    const snapshot = decodeArkSnapshot(herdFixture(raw(), "herd1000"))!;
    const zebras = snapshot.animals.filter((a) => a.model_slug === "plains-zebra");
    assert.equal(zebras.length, 1000);
    const keys = arkHerdKeys(snapshot.animals);
    assert.deepEqual(Array.from(keys), [zebras[0].species_profile_id]);
    const reps = arkRepresentatives(snapshot.animals);
    const herd = reps.herds.get(zebras[0].species_profile_id)!;
    assert.equal(herd.count, 1000);
    assert.equal(herd.live.length, ARK_HERD_LIVE);
    assert.equal(herd.massed.length, 1000 - ARK_HERD_LIVE);
    // Everyone else is drawn one by one, as before.
    assert.equal(reps.live.size, snapshot.animals.length - herd.massed.length);
    // The reader's own come forward first, then the newest.
    const mine = zebras.filter((a) => a.mine).map((a) => a.id);
    assert.ok(mine.length > 0 && mine.every((id) => herd.live.includes(id)));
    const newest = [...zebras].sort((a, b) => b.arrived_at.localeCompare(a.arrived_at))[0];
    assert.ok(herd.live.includes(newest.id));
    // A pinned one (selected) always comes forward.
    const someone = herd.massed[500];
    assert.ok(arkRepresentatives(snapshot.animals, {pinned: new Set([someone])}).live.has(someone));
    // The same answer for every viewer.
    assert.deepEqual(arkRepresentatives(snapshot.animals).herds.get(zebras[0].species_profile_id)!.live, herd.live);
    // Every one of the thousand has a place of its own.
    const places = placeAnimals(snapshot.animals);
    const spots = new Set(zebras.map((a) => `${places.get(a.id)!.x.toFixed(2)},${places.get(a.id)!.z.toFixed(2)}`));
    assert.ok(spots.size >= 990, `distinct spots ${spots.size}`);
});

test("1,000 over five species: five herds of 200", () => {
    const snapshot = decodeArkSnapshot(herdFixture(raw(), "herd5"))!;
    const reps = arkRepresentatives(snapshot.animals, {live: 12});
    assert.equal(reps.herds.size, 5);
    for (const herd of Array.from(reps.herds.values())) {
        assert.equal(herd.count, 200);
        assert.equal(herd.live.length, 12);
    }
    // At the line: exactly ARK_HERD_FROM is still drawn one by one.
    const small = snapshot.animals.filter((a) => a.model_slug === "plains-zebra").slice(0, ARK_HERD_FROM);
    assert.equal(arkRepresentatives(small).herds.size, 0);
});

// MARK: A17, every Ark word in Indonesian

function flat(value: unknown, prefix = ""): string[] {
    if (!value || typeof value !== "object") return [prefix];
    return Object.entries(value as Record<string, unknown>).flatMap(([key, inner]) => flat(inner, prefix ? `${prefix}.${key}` : key));
}

test("every Ark word has its Indonesian, with the same {placeholders}", () => {
    const english = en as Record<string, unknown>;
    const indonesian = id as Record<string, unknown>;
    const read = (root: Record<string, unknown>, path: string) => path.split(".").reduce<unknown>((at, key) => (at && typeof at === "object" ? (at as Record<string, unknown>)[key] : undefined), root);
    const keys = [...flat(english.ark, "ark"), ...flat(english.talkPage, "talkPage").filter((key) => /^talkPage\.ark/.test(key))];
    const missing = keys.filter((key) => typeof read(indonesian, key) !== "string" || !(read(indonesian, key) as string).trim());
    assert.deepEqual(missing, []);
    const slots = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort().join(" ");
    const mismatched = keys.filter((key) => slots(read(english, key) as string) !== slots(read(indonesian, key) as string));
    assert.deepEqual(mismatched, []);
});

// MARK: The server lane's additions (ark-edge-server, 20261113120000)

test("A1 kinds: breeds count as their kind, one row with the breeds named; a capture of a breed counts the kind", () => {
    const base = decodeArkSnapshot(raw())!;
    const dog = (id: string, look: string, name: string, slug: string) => ({id, species_profile_id: look, kind_species_profile_id: "kind-dog", kind_name: "Domestic Dog", name, model_slug: slug, zone: "farm_garden", arrived_at: `2026-11-0${id.length % 9}T10:00:00Z`, brought_by: {label: "Voyager 3", named: false}, mine: false, slot: 40, slot_rank: Number(id.slice(-1))});
    const snapshot = decodeArkSnapshot({...raw(), animals: [...raw().animals, dog("d1", "look-lab", "Labrador Retriever", "labrador-retriever"), dog("d2", "look-lab", "Labrador Retriever", "labrador-retriever"), dog("d3", "look-poodle", "Poodle", "poodle")]})!;
    assert.equal(snapshot.animals.find((a) => a.id === "d1")?.kind_species_profile_id, "kind-dog");
    const rows = arkPopulation(snapshot).regions.flatMap((g) => g.species);
    const row = rows.find((r) => r.key === "kind-dog")!;
    assert.equal(row.name, "Domestic Dog");
    assert.equal(row.count, 3);
    assert.equal(row.status, "more");
    assert.deepEqual(row.breeds.map((b) => [b.name, b.count]), [["Labrador Retriever", 2], ["Poodle", 1]]);
    assert.equal(rows.length, arkPopulation(base).regions.flatMap((g) => g.species).length + 1);
    assert.equal(arkSpeciesAboard(snapshot, {speciesProfileId: "look-poodle"}).count, 3);
    // An animal that is its own kind keeps its row as before (no breeds listed).
    assert.ok(rows.filter((r) => r.key !== "kind-dog").every((r) => r.breeds.length === 0));
});

test("A3 revised: decoded, counted in the life story, never acted out", () => {
    const rows = [{id: 1, kind: "revised", at: "2026-11-09T10:00:00Z", animal: {id: "z1", species_profile_id: "sp", name: "Plains Zebra", model_slug: "plains-zebra", zone: "grassland"}, payload: {revised: true, worked: false}}];
    const events = decodeArkEvents(rows, null);
    assert.equal(events[0]?.kind, "revised");
    const plan = planArkReplay(events);
    assert.equal(plan.acts.length, 0);
    assert.equal(isQuietArkReplay(plan.summary), true);
    const life = decodeArkLife({id: "z1", origin: {kind: "arrived", at: "2026-11-01T00:00:00Z", brought_by: {label: "Former voyager", named: false}}, revision: {at: "2026-11-09T10:00:00Z", worked: false}, placeholder: false});
    assert.deepEqual(life?.revision, {at: "2026-11-09T10:00:00Z", worked: false});
    assert.equal(decodeArkLife({id: "z2"})?.revision, null);
});

test("A5 former voyager: the server's label said in the reader's language, a Voyager number as it is", () => {
    assert.equal(arkBringerLabel("Former voyager", "Mantan voyager"), "Mantan voyager");
    assert.equal(arkBringerLabel("Voyager 12", "Mantan voyager"), "Voyager 12");
    assert.equal(arkJoinLabels(["Voyager 2", "Former voyager"], "id", "Mantan voyager"), "Voyager 2 dan Mantan voyager");
    assert.equal((id as {ark: {formerVoyager: string}}).ark.formerVoyager, "Mantan voyager");
});

test("A13 the server's placeholder flag with a null slug, in the snapshot and in the capture check", () => {
    const snapshot = decodeArkSnapshot({...raw(), animals: [{...raw().animals[0], id: "p1", model_slug: null, placeholder: true}]})!;
    assert.equal(snapshot.animals[0].placeholder, true);
    assert.ok(isArkPlaceholderSlug(snapshot.animals[0].model_slug));
});
