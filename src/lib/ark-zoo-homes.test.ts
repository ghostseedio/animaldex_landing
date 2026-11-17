/**
 * The zoo's new homes (p5 (zoospace); the owner, 2026-11-17: "anywhere else overcrowded?"): the census of the real
 * record found the aviaries at 40 birds each, the reptile house at 36 with 17 bodies on one another, the small mammals,
 * the nocturnal house, the primates, the hoofstock and the aquarium's tunnel crowded, piranhas with trout.
 *
 * - The homes table is the rule over the stored profiles and the food links (`scripts/ark-zoo-homes.mts`), not a list.
 * - Each enclosure under its kind's density cap; nobody on another's spot or body.
 * - Nothing sinks or floats; every resident of a new home stays inside it through an Ark day.
 * - No hunter with its prey (a food link to an animal much smaller than itself) in one enclosure or tank.
 * - A new home's plot still used by its own type is not built; its residents keep their type's spread.
 * - A resident's enclosure is its own fields' and the open list's, whoever else is in the list (the town joins in parts).
 */
import assert from "node:assert/strict";
import {existsSync, readFileSync} from "node:fs";
import path from "node:path";
import test from "node:test";
import type {ArkAnimal} from "@/ark-scene/types";
import {keepInPen, keptGap, maskBox, placeTownAnimals} from "@/ark-scene/islands/town/placement";
import {toLocal, type Box} from "@/ark-scene/islands/town/geom";
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
import {enclosuresIn, zooLayout} from "@/ark-scene/islands/town/areas";
import {ZOO_SPREAD, zooAnnex, zooEnclosureOf, zooHomeOf, zooResidents} from "@/ark-scene/islands/town/zoo-homes";
import {waterOf} from "@/ark-scene/islands/town/tanks";
import table from "@/ark-scene/islands/town/zoo-homes.json";

type Profile = {slug: string; zone: string; plan: string; diet: string; size: number; activity: string; water: string | null; social: string};
const PROFILES = (JSON.parse(readFileSync(path.join(process.cwd(), "data/ark/behaviour-profiles.json"), "utf8")) as {profiles: Profile[]}).profiles;
const BY_SLUG = new Map(PROFILES.map((p) => [p.slug, p]));
const LINKS = (JSON.parse(readFileSync(path.join(process.cwd(), "data/ark/audit-predator-prey.json"), "utf8")) as {prey: Record<string, string>}).prey;
const PREY = new Map<string, Profile[]>(Object.entries(LINKS).map(([k, v]) => [k, v.split(".").map((i) => PROFILES[parseInt(i, 36)])]));

test("the zoo's homes table is the rule over the stored profiles and the food links, nothing listed by hand", () => {
    const BIRDS = new Set(["flying_bird", "walking_bird", "flightless_bird"]);
    const MAMMALS = new Set(["quadruped", "primate", "bat"]);
    const REPTILES = new Set(["lizard", "legless", "turtle", "amphibian"]);
    const hunts = (p: Profile, plans: Set<string>) => (PREY.get(p.slug) ?? []).some((q) => plans.has(q.plan));
    const band = (size: number) => Math.floor(Math.log(Math.max(size, 1)) / Math.log(1.25));
    const want: Record<string, Record<string, string>> = {};
    for (const p of PROFILES) {
        const own: Record<string, string> = {};
        const b = band(p.size);
        if (BIRDS.has(p.plan)) {
            if (p.diet === "carrion" && !p.water) own.aviaries = "vultures";
            else if (hunts(p, BIRDS)) own.aviaries = p.activity === "nocturnal" ? `owls:${b}` : p.water ? `waders:${b}` : `raptors:${b}`;
            else if (p.water) own.aviaries = "wetland";
        }
        if (MAMMALS.has(p.plan)) {
            if (hunts(p, MAMMALS)) own.small_mammals = `carnivores:${b}`;
            else if (p.plan === "quadruped" && p.diet === "grazer" && p.size >= 28) own.small_mammals = "walkabout";
        }
        if (REPTILES.has(p.plan)) {
            if (p.plan === "turtle" && (p.diet === "grazer" || p.diet === "browser") && p.size >= 30) own.reptile_house = "tortoises";
            else if (hunts(p, REPTILES)) own.reptile_house = b >= 17 ? "large_reptiles" : p.water ? "turtles" : "snakes";
            else if (p.plan === "legless") own.reptile_house = "snakes";
            else if (p.plan === "turtle" || p.plan === "amphibian") own.reptile_house = "turtles";
        }
        if (p.plan === "fish" && p.zone === "river_lake") {
            const model = modelBase(p.slug);
            const disc = model ? model.size.x / Math.max(model.size.z, 0.05) >= 0.58 : false;
            if (disc && p.size >= 15 && p.size < 45) own.aquarium = "rays";
            else if (p.size >= 45) own.aquarium = "river";
            else if (p.diet === "fish" && p.social === "school") own.aquarium = "piranhas";
        }
        if (Object.keys(own).length) want[p.slug] = own;
    }
    const t = table as {homes: Record<string, Record<string, string>>; spread: Record<string, Record<string, string>>};
    assert.deepEqual(t.homes, want);
    // The spread table names only its type's own plots.
    for (const [slug, by] of Object.entries(t.spread)) {
        for (const [type, id] of Object.entries(by)) assert.ok(ZOO_SPREAD[type as keyof typeof ZOO_SPREAD]?.some((x) => x.id === id), `${slug}: ${type} → ${id}`);
    }
    // Real kinds land where they belong.
    const home = (slug: string, type = zooTypeOfSlug(slug)) => zooHomeOf({model_slug: slug, area: "zoo", enclosure: `${type}-1`});
    assert.equal(home("arapaima", "aquarium"), "zoo_river-1");
    assert.equal(home("red-bellied-piranha", "aquarium"), "zoo_river-1");
    assert.equal(home("greater-flamingo", "aviaries"), "zoo_wetland-1");
    assert.equal(home("capybara", "small_mammals"), "zoo_walkabout-1");
    assert.equal(home("leopoldi-stingray", "aquarium"), "zoo_river-1");
    // A river's or a lake's animal is a fresh water one whatever its name holds (a stingray of the Amazon, a crayfish).
    assert.equal(waterOf("leopoldi-stingray", "river_lake"), "fresh");
    assert.equal(waterOf("red-swamp-crayfish", "wetland"), "fresh");
    assert.equal(waterOf("blacktip-reef-shark", "coral_reef"), "salt");
});

/** A zoo resident in a server enclosure (the fields placement reads). */
function resident(i: number, slug: string, enclosure: string): ArkAnimal {
    const p = BY_SLUG.get(slug)!;
    return {id: `zh-${String(i).padStart(4, "0")}-${slug}`, species_profile_id: `sp-${slug}`, name: slug, scientific_name: null, model_slug: slug, zone: p.zone as ArkAnimal["zone"], arrived_at: `2026-11-${String(1 + (i % 9)).padStart(2, "0")}T10:00:00Z`, brought_by: {label: "x", named: false}, mine: false, area: "zoo", island: "town", enclosure} as ArkAnimal;
}

/** The live record's crowded kinds (scratchpad snapshot, 2026-11-17), as the server held them: two of each. */
const KINDS: Array<[string, string]> = [
    // aviaries: waterbirds, raptors, owls, vultures, storks, songbirds and parrots
    ["greater-flamingo", "aviaries-1"], ["mute-swan", "aviaries-1"], ["mandarin-duck", "aviaries-2"], ["eurasian-coot", "aviaries-3"],
    ["harriss-hawk", "aviaries-1"], ["peregrine-falcon", "aviaries-2"], ["barn-owl", "aviaries-2"], ["eurasian-eagle-owl", "aviaries-3"],
    ["lappet-faced-vulture", "aviaries-1"], ["marabou-stork", "aviaries-4"], ["scarlet-macaw", "aviaries-1"], ["budgerigar", "aviaries-2"],
    // reptile house: lizards, snakes, turtles, a tortoise, a python, frogs
    ["green-iguana", "reptile_house-1"], ["leopard-gecko", "reptile_house-1"], ["corn-snake", "reptile_house-1"], ["red-eared-slider", "reptile_house-1"],
    ["aldabra-giant-tortoise", "reptile_house-1"], ["reticulated-python", "reptile_house-1"], ["american-bullfrog", "reptile_house-1"],
    // small mammals, nocturnal, primates, hoofstock
    ["meerkat", "small_mammals-1"], ["capybara", "small_mammals-1"], ["red-panda", "small_mammals-3"], ["serval", "small_mammals-1"],
    ["aye-aye", "nocturnal_house-1"], ["common-raccoon", "nocturnal_house-1"], ["ring-tailed-lemur", "primate_house-1"], ["squirrel-monkey", "primate_house-1"],
    ["reindeer", "hoofstock_paddocks-1"], ["red-deer", "hoofstock_paddocks-1"],
    // aquarium's river fish
    ["arapaima", "aquarium-1"], ["alligator-gar", "aquarium-1"], ["red-bellied-piranha", "aquarium-1"], ["rainbow-trout", "aquarium-1"], ["leopoldi-stingray", "aquarium-1"]
];

function animals(): ArkAnimal[] {
    const out: ArkAnimal[] = [];
    let i = 0;
    for (const [slug, enclosure] of KINDS) if (BY_SLUG.has(slug)) for (let k = 0; k < 2; k++) out.push(resident(i++, slug, enclosure));
    return out;
}

/** Residents per 100 m² of an enclosure's ground, at most, by its kind (the census's numbers after the move, and room). */
const CAP: Record<string, number> = {
    // (A new home by its theme: the walkabout's capybaras, maras and wallabies are small mammals on a hoofstock plot.)
    walkabout: 5, tortoises: 7, carnivores: 4, raptors: 6, owls: 6, wetland: 6, vultures: 6, waders: 6, flight: 6, snakes: 6,
    aviaries: 6, reptile_house: 6, nocturnal_house: 7, primate_house: 5, small_mammals: 7, hoofstock_paddocks: 2, savanna_paddocks: 2, big_cats: 4, insect_house: 12};

/** The pairs in one enclosure where one hunts the other (a food link) and the other is under `ratio` of its size. */
function hunted(slugs: readonly string[], ratio: number): string[] {
    const out: string[] = [];
    for (const a of slugs) {
        const pa = BY_SLUG.get(a);
        const prey = PREY.get(a);
        if (!pa || !prey) continue;
        for (const b of slugs) if (b !== a && prey.some((q) => q.slug === b) && BY_SLUG.get(b)!.size <= pa.size * ratio) out.push(`${a} hunts ${b}`);
    }
    return out;
}

/** Every zoo enclosure's (and tank's) residents, density, overlaps and hunter pairs, for a placed list. */
function audit(list: readonly ArkAnimal[]) {
    const placed = placeTownAnimals(list);
    const by = new Map<string, ArkAnimal[]>();
    for (const a of list) {
        const info = placed.town.get(a.id);
        if (!info || info.area !== "zoo" || !info.enclosure) continue;
        const key = info.tank ? `tank:${info.tank.id}` : info.enclosure.id;
        (by.get(key) ?? by.set(key, []).get(key)!).push(a);
    }
    const problems: string[] = [];
    for (const [key, members] of Array.from(by)) {
        const first = placed.town.get(members[0].id)!;
        const e = first.enclosure!;
        const cap = CAP[e.slot.annex ?? e.type];
        if (!key.startsWith("tank:") && cap !== undefined && !e.slot.safari) {
            const area = e.slot.at.w * e.slot.at.d;
            const per100 = (members.length / area) * 100;
            if (per100 > cap) problems.push(`${key}: ${members.length} in ${area.toFixed(0)} m² (${per100.toFixed(1)} per 100 m², cap ${cap})`);
        }
        // Nobody on another's spot or body (out of the water: a tank's and a pool's swimmers move on their loops).
        if (!key.startsWith("tank:")) {
            const dry = members.filter((a) => placed.town.get(a.id)!.where !== "pool");
            for (let i = 0; i < dry.length; i++) {
                for (let j = i + 1; j < dry.length; j++) {
                    const p = placed.places.get(dry[i].id)!;
                    const q = placed.places.get(dry[j].id)!;
                    const gap = keptGap(arkBody(dry[i]).metres, arkBody(dry[j]).metres);
                    if (Math.hypot(p.x - q.x, p.z - q.z) < gap * 0.999) problems.push(`${key}: ${dry[i].model_slug} on ${dry[j].model_slug} (${Math.hypot(p.x - q.x, p.z - q.z).toFixed(2)} < ${gap.toFixed(2)} m)`);
                }
            }
        }
        // No hunter with its prey: under 0.8 of its size in the open, under half in a house's shared hall.
        const ratio = e.indoor && !key.startsWith("tank:") ? 0.5 : 0.8;
        for (const h of hunted(Array.from(new Set(members.map((a) => a.model_slug))), ratio)) problems.push(`${key}: ${h}`);
    }
    return {placed, by, problems};
}

test("the crowded kinds in their new homes: under each kind's cap, nobody on another, no hunter with its prey", () => {
    const list = animals();
    assert.ok(list.length >= 60, `${list.length} residents`);
    const {placed, by, problems} = audit(list);
    assert.deepEqual(problems, []);
    // They moved: the waterbirds to the lagoon, the raptors and owls to their row, the river giants to the river house.
    const at = (slug: string) => placed.town.get(list.find((a) => a.model_slug === slug)!.id)!.enclosure!.id;
    assert.equal(at("greater-flamingo"), "zoo_wetland-1");
    assert.match(at("harriss-hawk"), /^zoo_raptors-\d$/);
    assert.match(at("barn-owl"), /^zoo_owls-\d$/);
    assert.equal(at("lappet-faced-vulture"), "zoo_vultures-1");
    assert.equal(at("aldabra-giant-tortoise"), "zoo_tortoises-1");
    assert.equal(at("reticulated-python"), "reptile_house-3");
    assert.equal(at("capybara"), "zoo_walkabout-1");
    assert.equal(at("arapaima"), "zoo_river-1");
    // The piranhas in their own tank, the trout not with them.
    const tankOf = (slug: string) => placed.town.get(list.find((a) => a.model_slug === slug)!.id)!.tank?.id ?? "";
    assert.match(tankOf("red-bellied-piranha"), /piranhas$/);
    assert.notEqual(tankOf("rainbow-trout"), tankOf("red-bellied-piranha"));
    // The river rays in their own shallow tank, never with the giants that eat them.
    assert.match(tankOf("leopoldi-stingray"), /rays$/);
    assert.match(tankOf("arapaima"), /river$/);
    assert.ok(by.size >= 15, `${by.size} enclosures and tanks`);
});

/** How far a body of half-length `half` at (x, z) is inside the box: under 0 across its edge. */
function inside(at: Box, x: number, z: number, half: number): number {
    const l = toLocal(at, x, z);
    return Math.min(at.w / 2 - Math.abs(l.x), at.d / 2 - Math.abs(l.z)) - half;
}

test("every resident of a new outdoor home stays inside it through an Ark day, on the drawn ground", () => {
    const list = animals();
    const placed = placeTownAnimals(list);
    const colliders = townColliderSet(placed.open, {x: 0, z: 0});
    const world = scheduleWorld(townWorldSampler(placed.open, {x: 0, z: 0}, colliders));
    const epochs = [...townDayEpochs(16), ...townDayEpochs(16, Date.UTC(2026, 10, 12, 12) / 1000)];
    const hoursAt = (epoch: number) => islandHours(epoch * 1000, 0);
    const out: string[] = [];
    const moved: ArkAnimal[] = [];
    let poses = 0;
    for (const a of list) {
        const info = placed.town.get(a.id)!;
        const e = info.enclosure;
        if (!e || !e.slot.annex || e.indoor) continue;
        moved.push(a);
        const place = placed.places.get(a.id)!;
        const plan = modelBase(a.model_slug)?.plan ?? null;
        const half = arkBody(a, plan).display / 2;
        if (inside(e.slot.at, place.x, place.z, half) < 0) out.push(`${a.model_slug} spot ${inside(e.slot.at, place.x, place.z, half).toFixed(2)} m`);
        const profile = behaviourProfile(a.model_slug, plan);
        const own = withLazyRoost({id: a.id, zone: a.zone, home: {x: place.x, y: place.ground, z: place.z}, length: arkBody(a, plan).display, sea: false, range: Math.max(info.range, 0.6) * 1.5}, () => null);
        let trip: Trip | null = null;
        for (const epoch of epochs) {
            if (!trip || epoch < trip.start || epoch >= trip.end) trip = tripAt(world, profile, own, epoch, hoursAt, a.activity ?? null, trip);
            const at = poseOnTrip(world, trip, epoch);
            if (at.aloft) continue;
            poses++;
            const pose = {x: at.x, z: at.z};
            keepInPen(maskBox(e.mask), info.enclosureMargin!, pose);
            if (inside(e.slot.at, pose.x, pose.z, half) < 0) out.push(`${a.model_slug} ${trip.doing} ${inside(e.slot.at, pose.x, pose.z, half).toFixed(2)} m`);
        }
    }
    assert.ok(moved.length >= 14, `${moved.length} in new outdoor homes`);
    assert.ok(poses > 300, `${poses} poses`);
    assert.deepEqual(out.slice(0, 8), []);
    // On the drawn ground through the day (the scene's own check): none sinks, none floats, the river house's fish too.
    const check = validateTownAnimals(list, {epochs: townDayEpochs(16)});
    setTownWalkSurfaces(null);
    console.log(`zoo homes: ${list.length} residents, ${check.samples} samples; sinks ${check.counts.sinks}, floats ${check.counts.floats}`);
    assert.equal(check.counts.sinks, 0, JSON.stringify(check.problems.filter((p) => p.problems.includes("sinks")).slice(0, 5)));
    assert.equal(check.counts.floats, 0, JSON.stringify(check.problems.filter((p) => p.problems.includes("floats")).slice(0, 5)));
});

test("a new home's plot still its own type's is not built: its residents keep their type's spread", () => {
    const list = animals();
    // A big cat the safari has no area for, in big_cats-1 (the plot under the raptor row's first three bays).
    const cat = resident(900, "serval", "big_cats-1");
    const open = enclosuresIn([...list, cat]);
    assert.ok(open.includes("big_cats-1"));
    const layout = zooLayout(open);
    for (const e of layout.enclosures) {
        const annex = zooAnnex(e.id);
        if (annex) assert.notEqual(annex.plot, "big_cats-1", `${e.id} built on a taken plot`);
    }
    const taken = new Set(["big_cats-1"]);
    for (const a of list) {
        const e = zooEnclosureOf(a, taken);
        const annex = zooAnnex(e);
        assert.ok(!annex || annex.plot !== "big_cats-1", `${a.model_slug} → ${e}`);
    }
});

test("a resident's enclosure is its own fields' and the open list's, whoever else the list holds", () => {
    const list = animals();
    const open = enclosuresIn(list);
    const whole = zooResidents(list, open);
    for (let n = 1; n < list.length; n += 7) {
        const part = zooResidents(list.slice(0, n), open);
        part.forEach((a, i) => assert.equal(a.enclosure, whole[i].enclosure, a.model_slug));
    }
});

test("the real record (when the local snapshot is here): every zoo enclosure under its cap, nobody on another, no hunter with its prey", {skip: !existsSync("public/ark-local/snap.json")}, () => {
    const snap = JSON.parse(readFileSync("public/ark-local/snap.json", "utf8")) as {snapshot: {animals: ArkAnimal[]}};
    const town = snap.snapshot.animals.filter((a) => (a.island ?? "town") === "town");
    const {problems} = audit(town);
    // (Left as they are: the hall's one ocean tank, 2,900 m² of water where the sawfish, the giant moray and the reef
    // sharks swim together as the big aquariums show them, the food links between them of animals over half their size.)
    const mine = problems.filter((p) => !p.startsWith("tank:aquarium-hall:ocean"));
    console.log(`real record zoo audit: ${problems.length} findings (${problems.filter((p) => !mine.includes(p)).join("; ")}), ${mine.length} outside the ocean tank`);
    assert.deepEqual(mine, []);
});

test("the wild island's real record (when the local snapshot is here): no two crocodilians on one spot, nobody at a rock's foot on another", {skip: !existsSync("public/ark-local/snap.json")}, async () => {
    // (A crevice or cave dweller's home at a rock's foot, `map/place.ts` toTheRocks: two slots by one rock picked one foot
    // and stood on one spot, the wild wetland's saltwater and American crocodiles.)
    const {setArkMapSampler} = await import("@/ark-scene/map/place");
    const {wildMapSampler} = await import("@/ark-scene/islands/wild/map-sampler");
    const {placeAnimals} = await import("@/ark-scene/placement");
    setArkMapSampler(wildMapSampler());
    const snap = JSON.parse(readFileSync("public/ark-local/snap.json", "utf8")) as {snapshot: {animals: ArkAnimal[]}};
    const wild = snap.snapshot.animals.filter((a) => (a.island ?? "town") !== "town");
    const placed = placeAnimals(wild);
    const crocs = wild.filter((a) => /crocodile|caiman|alligator$|gharial/.test(a.model_slug));
    assert.ok(crocs.length >= 3, `${crocs.length} crocodilians`);
    for (let i = 0; i < crocs.length; i++) {
        for (let j = i + 1; j < crocs.length; j++) {
            const p = placed.get(crocs[i].id)!;
            const q = placed.get(crocs[j].id)!;
            const gap = keptGap(arkBody(crocs[i]).metres, arkBody(crocs[j]).metres) * 0.5;
            assert.ok(Math.hypot(p.x - q.x, p.z - q.z) >= gap, `${crocs[i].model_slug} on ${crocs[j].model_slug}`);
        }
    }
    // Nobody from different clusters on one ground spot (to the centimetre).
    const seen = new Map<string, string>();
    const same: string[] = [];
    for (const a of wild) {
        const p = placed.get(a.id);
        if (!p || p.canopy || p.micro || p.perch || p.leader) continue;
        const k = `${p.x.toFixed(2)},${p.z.toFixed(2)}`;
        if (seen.has(k)) same.push(`${seen.get(k)} and ${a.model_slug}`);
        else seen.set(k, a.model_slug);
    }
    assert.deepEqual(same, []);
});
