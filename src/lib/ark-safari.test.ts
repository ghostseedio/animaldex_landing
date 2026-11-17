/**
 * The commercial safari on the zoo's island (p4 (safari); the owner, 2026-11-17: "just add a massive section to the zoo
 * island for a commercial safari, then move animals to it, make it nice and detailed so it matches the rest").
 *
 * - The resident table is the rule over the stored profiles (`scripts/ark-safari-residents.mts`), not a list.
 * - Who moves: large herbivores from the savanna paddocks, the lions, tigers and hyenas, the crocodilians; each to a
 *   habitat that fits its stored zone; predators each kind alone, never with prey.
 * - Every moved resident's body stays inside its area through an Ark day, on the drawn ground (not sunk, not floating).
 * - The trucks keep to the loop by day and stand in the depot at night.
 */
import assert from "node:assert/strict";
import {existsSync, readFileSync} from "node:fs";
import path from "node:path";
import test from "node:test";
import type {ArkAnimal} from "@/ark-scene/types";
import {keepInPen, maskBox, placeTownAnimals} from "@/ark-scene/islands/town/placement";
import {inBox, polylineNearest, toLocal, type Box} from "@/ark-scene/islands/town/geom";
import {zooTypeOfSlug} from "@/ark-scene/islands/routing";
import {townColliderSet} from "@/ark-scene/islands/town/colliders";
import {townWorldSampler} from "@/ark-scene/islands/town/sampler";
import {poseOnTrip, scheduleWorld, tripAt, withLazyRoost, type Trip} from "@/ark-scene/behaviour-schedule";
import {behaviourProfile} from "@/ark-scene/behaviour-profile";
import {modelBase} from "@/ark-scene/grounding/base";
import {arkBody} from "@/ark-scene/stats";
import {townDayEpochs, validateTownAnimals} from "@/ark-scene/islands/town/validate-animals";
import {setTownWalkSurfaces} from "@/ark-scene/islands/town/drawn-ground";
import {islandHours} from "@/lib/ark-clock";
import {sampleTownGround, safariWaterLevel, townHeight} from "@/ark-scene/islands/town/ground";
import {enclosuresIn} from "@/ark-scene/islands/town/areas";
import {SAFARI, SAFARI_AREAS, SAFARI_LOOP, SAFARI_ROAD_WIDTH, safariArea, safariEnclosureOf, safariHabitatOf, safariWaterNorm} from "@/ark-scene/islands/town/safari";
import {safariTruckAt, SAFARI_TRUCKS} from "@/ark-scene/islands/town/render/safari";
import residents from "@/ark-scene/islands/town/safari-residents.json";

type Profile = {slug: string; zone: string; plan: string; diet: string; size: number};
const PROFILES = (JSON.parse(readFileSync(path.join(process.cwd(), "data/ark/behaviour-profiles.json"), "utf8")) as {profiles: Profile[]}).profiles;
const BY_SLUG = new Map(PROFILES.map((p) => [p.slug, p]));
const ZONE_FITS: Record<string, string[]> = {plains: ["grassland"], desert: ["desert"], forest: ["rainforest", "woodland"], wetland: ["wetland", "river_lake"], river: ["wetland", "river_lake"]};

test("the safari's resident table is the rule over the stored profiles, nothing listed by hand", () => {
    const want: Record<string, string> = {};
    const zone: Record<string, string> = {grassland: "plains", desert: "desert", rainforest: "forest", woodland: "forest", wetland: "wetland", river_lake: "wetland"};
    for (const p of PROFILES) {
        let h: string | null = null;
        if (p.plan === "quadruped" && p.size >= 45 && p.diet !== "meat" && p.diet !== "fish") h = zone[p.zone] ?? null;
        else if (p.plan === "lizard" && p.size >= 55 && (p.zone === "wetland" || p.zone === "river_lake") && (p.diet === "fish" || p.diet === "meat")) h = "river";
        if (h) want[p.slug] = h;
    }
    assert.deepEqual((residents as {habitats: Record<string, string>}).habitats, want);
    // Real kinds land where they belong; the flightless birds and the smaller kinds stay in the zoo.
    assert.equal(want["giraffe"], "plains");
    assert.equal(want["common-hippopotamus"], "wetland");
    assert.equal(want["dromedary-camel"], "desert");
    assert.equal(want["malayan-tapir"], "forest");
    assert.equal(want["ostrich"], undefined);
    assert.equal(want["meerkat"], undefined);
});

/** A zoo resident in its kind's server enclosure (the fields placement reads). */
function resident(i: number, slug: string, scientific: string | null = null): ArkAnimal {
    const p = BY_SLUG.get(slug)!;
    const enclosure = `${zooTypeOfSlug(slug)}-1`;
    return {id: `sf-${String(i).padStart(4, "0")}-${slug}`, species_profile_id: `sp-${slug}`, name: slug, scientific_name: scientific, model_slug: slug, zone: p.zone as ArkAnimal["zone"], arrived_at: `2026-11-${String(1 + (i % 9)).padStart(2, "0")}T10:00:00Z`, brought_by: {label: "x", named: false}, mine: false, area: "zoo", island: "town", enclosure} as ArkAnimal;
}

/** The live record's zoo kinds (scratchpad snapshot, 2026-11-17), three of each. */
const KINDS: Array<[string, string | null]> = [
    ["giraffe", "Giraffa camelopardalis"], ["plains-zebra", "Equus quagga"], ["common-warthog", "Phacochoerus africanus"], ["white-rhinoceros", "Ceratotherium simum"], ["cape-buffalo", "Syncerus caffer"],
    ["blue-wildebeest", "Connochaetes taurinus"], ["common-eland", "Taurotragus oryx"], ["asian-elephant", "Elephas maximus"], ["south-american-tapir", "Tapirus terrestris"], ["malayan-tapir", "Tapirus indicus"],
    ["scimitar-horned-oryx", "Oryx dammah"], ["dromedary-camel", "Camelus dromedarius"], ["common-hippopotamus", "Hippopotamus amphibius"], ["pygmy-hippopotamus", "Choeropsis liberiensis"],
    ["nile-crocodile", "Crocodylus niloticus"], ["african-lion", "Panthera leo"], ["bengal-tiger", "Panthera tigris tigris"], ["spotted-hyena", "Crocuta crocuta"],
    // Staying in the zoo: the flightless birds, the wolves, the bears, a small mammal.
    ["ostrich", "Struthio camelus"], ["southern-cassowary", "Casuarius casuarius"], ["eurasian-wolf", "Canis lupus"], ["brown-bear", "Ursus arctos"], ["meerkat", "Suricata suricatta"]
];

function animals(): ArkAnimal[] {
    const out: ArkAnimal[] = [];
    let i = 0;
    for (const [slug, sci] of KINDS) if (BY_SLUG.has(slug)) for (let k = 0; k < 3; k++) out.push(resident(i++, slug, sci));
    return out;
}

test("who moves to the safari: by the rule; each to a habitat fitting its stored zone; predators each kind alone", () => {
    const all = animals();
    const moved = all.filter((a) => safariHabitatOf(a));
    assert.ok(moved.length >= 40, `${moved.length} moved`);
    for (const a of all) {
        const habitat = safariHabitatOf(a);
        const p = BY_SLUG.get(a.model_slug)!;
        if (["ostrich", "southern-cassowary", "eurasian-wolf", "brown-bear", "meerkat"].includes(a.model_slug)) assert.equal(habitat, null, `${a.model_slug} stays in the zoo`);
        if (!habitat) continue;
        const area = SAFARI_AREAS.find((x) => x.habitat === habitat)!;
        if (area.predator) assert.ok(p.diet === "meat", `${a.model_slug} in a predator's area`);
        else assert.ok(ZONE_FITS[habitat].includes(p.zone), `${a.model_slug} (${p.zone}) in the ${habitat}`);
    }
    // Placed: the town's enclosures are the safari's; every area holds one kind of predator or only prey.
    const placed = placeTownAnimals(all);
    const by = new Map<string, Set<string>>();
    for (const a of moved) {
        const info = placed.town.get(a.id)!;
        assert.equal(info.enclosure?.id, safariEnclosureOf(a), `${a.model_slug} in its safari area`);
        const set = by.get(info.enclosure!.id) ?? new Set<string>();
        set.add(a.model_slug);
        by.set(info.enclosure!.id, set);
    }
    for (const [id, kinds] of Array.from(by)) {
        const area = safariArea(id)!;
        const eaters = Array.from(kinds).filter((s) => BY_SLUG.get(s)!.diet === "meat");
        if (area.predator) assert.equal(kinds.size, 1, `${id}: one predator kind (${Array.from(kinds).join(", ")})`);
        else assert.deepEqual(eaters, [], `${id}: no predator among prey`);
    }
    // The open enclosures as the town reads them from the record: the safari's, and no empty paddock opened for them.
    const open = enclosuresIn(all);
    for (const a of SAFARI_AREAS) if (by.has(a.id)) assert.ok(open.includes(a.id), `${a.id} open`);
});

/** How far a body of half-length `half` at (x, z) is inside the area's box: under 0 across its edge. */
function inside(at: Box, x: number, z: number, half: number): number {
    const l = toLocal(at, x, z);
    return Math.min(at.w / 2 - Math.abs(l.x), at.d / 2 - Math.abs(l.z)) - half;
}

test("every safari resident's body stays inside its area through an Ark day, on the drawn ground", () => {
    const all = animals();
    const placed = placeTownAnimals(all);
    const colliders = townColliderSet(placed.open, {x: 0, z: 0});
    const world = scheduleWorld(townWorldSampler(placed.open, {x: 0, z: 0}, colliders));
    const epochs = [...townDayEpochs(16), ...townDayEpochs(16, Date.UTC(2026, 10, 12, 12) / 1000)];
    const hoursAt = (epoch: number) => islandHours(epoch * 1000, 0);
    const out: string[] = [];
    const ground: string[] = [];
    let poses = 0;
    for (const a of all) {
        const info = placed.town.get(a.id)!;
        if (!info.enclosure || !safariArea(info.enclosure.id)) continue;
        const area = safariArea(info.enclosure.id)!;
        const place = placed.places.get(a.id)!;
        const plan = modelBase(a.model_slug)?.plan ?? null;
        const half = arkBody(a, plan).display / 2;
        if (inside(area.at, place.x, place.z, half) < 0.1) out.push(`${a.model_slug} spot`);
        // In the water only where it wades (the hippos', the crocodiles').
        for (const w of area.waters) if (safariWaterNorm(w, place.x, place.z) < 1) assert.ok(safariWaterLevel(w) - place.ground < 1.0, `${a.model_slug} under the water`);
        assert.notEqual(sampleTownGround(place.x, place.z).surface, "sea");
        const profile = behaviourProfile(a.model_slug, plan);
        const own = withLazyRoost({id: a.id, zone: a.zone, home: {x: place.x, y: place.ground, z: place.z}, length: arkBody(a, plan).display, sea: false, range: Math.max(info.range, 0.6) * 1.5}, () => null);
        let trip: Trip | null = null;
        for (const epoch of epochs) {
            if (!trip || epoch < trip.start || epoch >= trip.end) trip = tripAt(world, profile, own, epoch, hoursAt, a.activity ?? null, trip);
            const at = poseOnTrip(world, trip, epoch);
            if (at.aloft) continue;
            poses++;
            const pose = {x: at.x, z: at.z};
            keepInPen(maskBox(info.enclosure.mask), info.enclosureMargin!, pose);
            if (inside(area.at, pose.x, pose.z, half) < 0.1) out.push(`${a.model_slug} ${trip.doing} ${inside(area.at, pose.x, pose.z, half).toFixed(2)} m`);
        }
    }
    assert.ok(poses > 500, `${poses} poses`);
    assert.deepEqual(out.slice(0, 8), []);
    // On the drawn ground through the day (the scene's own check, `validate-animals.ts`): none sinks, none floats.
    const safari = all.filter((a) => safariHabitatOf(a));
    const check = validateTownAnimals(safari, {epochs: townDayEpochs(16)});
    setTownWalkSurfaces(null);
    console.log(`safari residents: ${safari.length}, ${check.samples} samples; sinks ${check.counts.sinks}, floats ${check.counts.floats}`);
    assert.equal(check.counts.sinks, 0, JSON.stringify(check.problems.filter((p) => p.problems.includes("sinks")).slice(0, 5)));
    assert.equal(check.counts.floats, 0, JSON.stringify(check.problems.filter((p) => p.problems.includes("floats")).slice(0, 5)));
    assert.ok(ground.length === 0);
});

test("the safari trucks keep to the loop by day and stand in the depot at night, the same for every viewer", () => {
    for (let i = 0; i < SAFARI_TRUCKS.count; i++) {
        for (let s = 0; s < 24 * 3600; s += 97) {
            const hours = (s / 3600) % 24;
            const t = safariTruckAt(i, 1_700_000_000 + s, hours);
            assert.deepEqual(t, safariTruckAt(i, 1_700_000_000 + s, hours), "pure in the clock");
            if (hours >= SAFARI_TRUCKS.open && hours < SAFARI_TRUCKS.close) {
                const d = polylineNearest(SAFARI_LOOP, t.x, t.z).distance;
                assert.ok(d < SAFARI_ROAD_WIDTH / 2 - 0.4, `truck ${i} ${d.toFixed(2)} m off the loop's middle`);
                assert.ok(townHeight(t.x, t.z) > 0.3, "on dry ground");
                for (const a of SAFARI_AREAS) assert.ok(!inBox(a.at, t.x, t.z, -1.5), `truck ${i} inside ${a.id}`);
            } else assert.ok(inBox(SAFARI.depot, t.x, t.z, 0), `truck ${i} in the depot at ${hours.toFixed(1)} h`);
        }
    }
});

test("the real record (when the local snapshot is here): every moved resident in a fitting area, predators alone", {skip: !existsSync("public/ark-local/snap.json")}, () => {
    const snap = JSON.parse(readFileSync("public/ark-local/snap.json", "utf8")) as {snapshot: {animals: ArkAnimal[]}};
    const zoo = snap.snapshot.animals.filter((a) => a.island === "town" && a.area === "zoo");
    const by = new Map<string, Set<string>>();
    const kinds = new Map<string, Set<string>>();
    for (const a of zoo) {
        const habitat = safariHabitatOf(a);
        if (!habitat) continue;
        const id = safariEnclosureOf(a)!;
        const set = by.get(id) ?? new Set<string>();
        set.add(a.model_slug);
        const kind = kinds.get(id) ?? new Set<string>();
        kind.add((a.scientific_name ?? "").toLowerCase().split(/\s+/).slice(0, 2).join(" "));
        kinds.set(id, kind);
        by.set(id, set);
    }
    assert.ok(by.size >= 6, `${by.size} safari areas in use`);
    for (const [id, slugs] of Array.from(by)) {
        const area = safariArea(id)!;
        if (!area.predator) assert.ok(Array.from(slugs).every((k) => BY_SLUG.get(k)!.diet !== "meat"), `${id}: prey only`);
        // (The river holds the record's crocodilians together, nothing else; each cat and the hyenas alone.)
        else if (area.habitat === "river") assert.ok(Array.from(slugs).every((k) => BY_SLUG.get(k)!.plan === "lizard"), `${id}: crocodilians only`);
        else assert.equal(kinds.get(id)!.size, 1, `${id}: one species (${Array.from(slugs).join(", ")})`);
    }
});
