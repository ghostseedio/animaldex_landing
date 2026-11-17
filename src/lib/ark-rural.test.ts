/**
 * The countryside on the town island (p5 (rural); the owner, 2026-11-17: "we also need somewhere to move the domestic
 * animals, currently so many dogs and horses and cows etc. in one garden. Add more to the town island like a rural area
 * with lots of fields"; then "add chicken farms too").
 *
 * - Who moves is the rule over each record (`rural.ts` ruralPenOf: its area and its scientific name's genus), never a list.
 * - Each moved animal lives in a field built for its kind; cows with cows, horses in paddocks, sheep in the fold, the
 *   poultry on the free range, in the orchard and the farmyard's run, the ducks and geese at the pond.
 * - A home's dog stays at home; a farm's dog goes to the dairy's yard; a few backyard hens stay in their gardens.
 * - The farms and the zoo's children's farm keep a few each; the rest move out (the census's crowding).
 * - Every moved body stays inside its field's boundary through an Ark day, never in the pond, on the drawn ground.
 * - The fields are on land, clear of one another, the lane and the tracks; their buildings stand inside them.
 */
import assert from "node:assert/strict";
import {existsSync, readFileSync} from "node:fs";
import test from "node:test";
import type {ArkAnimal} from "@/ark-scene/types";
import {keepInPen, placeTownAnimals, ruralFields} from "@/ark-scene/islands/town/placement";
import {boxesOverlap, corners, inBox, polylineDistance, toLocal, type Box} from "@/ark-scene/islands/town/geom";
import {townColliderSet} from "@/ark-scene/islands/town/colliders";
import {townWorldSampler} from "@/ark-scene/islands/town/sampler";
import {poseOnTrip, scheduleWorld, tripAt, withLazyRoost, type Trip} from "@/ark-scene/behaviour-schedule";
import {behaviourProfile} from "@/ark-scene/behaviour-profile";
import {modelBase} from "@/ark-scene/grounding/base";
import {arkBody} from "@/ark-scene/stats";
import {townDayEpochs, validateTownAnimals} from "@/ark-scene/islands/town/validate-animals";
import {setTownWalkSurfaces} from "@/ark-scene/islands/town/drawn-ground";
import {islandHours} from "@/lib/ark-clock";
import {sampleTownGround} from "@/ark-scene/islands/town/ground";
import {inland, townPlan} from "@/ark-scene/islands/town/plan";
import {farmOf} from "@/ark-scene/islands/town/areas";
import {COOP_HOURS, coopPose, henHouseOf, FARM_KEEP, PETTING_KEEP, RURAL_BUILDINGS, RURAL_LANE, RURAL_LANE_WIDTH, RURAL_PENS, RURAL_TRACKS, ruralKindOf, ruralPenOf, ruralPondNorm, type RuralKind} from "@/ark-scene/islands/town/rural";
import residents from "@/ark-scene/islands/town/rural-residents.json";
import {pickFigure, type Projector} from "@/ark-scene/tap-pick";

/** The live record's kept kinds (scratchpad snapshot, 2026-11-16) with their stored scientific names. */
const KINDS: Array<[string, string, string]> = [
    ["cow", "Bos taurus", "farm_garden"], ["water-buffalo", "Bubalus bubalis", "farm_garden"], ["domestic-horse", "Equus caballus", "farm_garden"], ["domestic-donkey", "Equus asinus", "farm_garden"],
    ["domestic-sheep", "Ovis aries", "farm_garden"], ["alpaca", "Vicugna pacos", "farm_garden"], ["llama", "Lama glama", "mountains"], ["domestic-goat", "Capra hircus", "farm_garden"], ["domestic-pig", "Sus scrofa domesticus", "farm_garden"],
    ["domestic-chicken", "Gallus gallus domesticus", "farm_garden"], ["red-junglefowl", "Gallus gallus", "rainforest"], ["domestic-turkey", "Meleagris gallopavo domesticus", "farm_garden"], ["japanese-quail", "Coturnix japonica", "farm_garden"], ["indian-peafowl", "Pavo cristatus", "farm_garden"], ["helmeted-guineafowl", "Numida meleagris", "farm_garden"],
    ["domestic-duck", "Anas platyrhynchos domesticus", "farm_garden"], ["domestic-goose", "Anser anser domesticus", "farm_garden"], ["muscovy-duck", "Cairina moschata domestica", "river_lake"],
    // Pets: they stay at home.
    ["domestic-dog", "Canis lupus familiaris", "farm_garden"], ["domestic-cat", "Felis catus", "farm_garden"], ["domestic-rabbit", "Oryctolagus cuniculus domesticus", "farm_garden"], ["domestic-pigeon", "Columba livia domestica", "farm_garden"], ["guinea-pig", "Cavia porcellus", "farm_garden"]
];
const FITS: Record<RuralKind, RegExp> = {cattle: /dairy-pasture/, horses: /paddock/, donkeys: /paddock-2/, sheep: /sheep-fold/, camelids: /sheep-fold/, goats: /goats/, pigs: /pigs/, poultry: /free-range|orchard|farmyard-run/, waterfowl: /duck-pond/};

function animal(i: number, slug: string, sci: string, zone: string, area: "house" | "farm" | "zoo", enclosure: string | null = null): ArkAnimal {
    return {id: `ru-${String(i).padStart(4, "0")}-${slug}`, species_profile_id: `sp-${slug}`, name: slug, scientific_name: sci, model_slug: slug, zone: zone as ArkAnimal["zone"], arrived_at: `2026-11-${String(1 + (i % 9)).padStart(2, "0")}T10:00:00Z`, brought_by: {label: "x", named: false}, mine: false, area, island: "town", enclosure} as ArkAnimal;
}

function animals(): ArkAnimal[] {
    const out: ArkAnimal[] = [];
    let i = 0;
    for (const [slug, sci, zone] of KINDS) {
        for (let k = 0; k < 4; k++) out.push(animal(i++, slug, sci, zone, "house"));
        for (let k = 0; k < 4; k++) out.push(animal(i++, slug, sci, zone, "farm"));
    }
    // The children's farm: five donkeys, four horses, six goats (the census's crowding).
    for (let k = 0; k < 5; k++) out.push(animal(i++, "domestic-donkey", "Equus asinus", "farm_garden", "zoo", "childrens_farm-1"));
    for (let k = 0; k < 4; k++) out.push(animal(i++, "domestic-horse", "Equus caballus", "farm_garden", "zoo", "childrens_farm-1"));
    for (let k = 0; k < 6; k++) out.push(animal(i++, "domestic-goat", "Capra hircus", "farm_garden", "zoo", "childrens_farm-1"));
    return out;
}

test("the resident table is the genus rule: livestock and poultry by kind, pets absent", () => {
    const t = residents as {genera: Record<string, string>; equus: Record<string, string>};
    assert.equal(t.genera.Bos, "cattle");
    assert.equal(t.genera.Ovis, "sheep");
    assert.equal(t.genera.Gallus, "poultry");
    assert.equal(t.genera.Anas, "waterfowl");
    assert.equal(t.equus.caballus, "horses");
    assert.equal(t.equus.asinus, "donkeys");
    for (const pet of ["Canis", "Felis", "Oryctolagus", "Columba", "Cavia", "Mesocricetus", "Melopsittacus"]) assert.equal(t.genera[pet], undefined, `${pet} is a pet`);
    assert.equal(ruralKindOf({scientific_name: "Equus quagga"}), null, "a zebra is not a horse");
    assert.equal(ruralKindOf({scientific_name: "Bos taurus"}), "cattle");
    // Every kind has a field built for it.
    for (const kind of Object.keys(FITS) as RuralKind[]) assert.ok(RURAL_PENS.some((p) => p.kinds.includes(kind) && p.weight > 0), `a field for ${kind}`);
});

test("who moves: by the rule; each to a field of its kind; pets and a home's dog stay home; a farm's dog to the dairy yard", () => {
    const all = animals();
    const fields = ruralFields(all);
    for (const a of all) {
        const kind = ruralKindOf(a);
        const f = fields.get(a.id);
        if (!kind) {
            if (a.model_slug === "domestic-dog" && a.area === "farm") assert.equal(f?.id, "rural-dairy-yard", "the farm's dog with the farmer");
            else assert.equal(f, undefined, `${a.model_slug} (${a.area}) stays`);
            continue;
        }
        if (!f) continue;
        assert.ok(f.kinds.includes(kind) && FITS[kind].test(f.id), `${a.model_slug} in ${f.id}`);
    }
    // Every home's livestock moves; of a home's poultry only a few backyard hens stay (`BACKYARD_HENS`).
    const home = all.filter((a) => a.area === "house" && ruralKindOf(a));
    const stayed = home.filter((a) => !fields.has(a.id));
    for (const a of stayed) assert.equal(ruralKindOf(a), "poultry", `${a.model_slug} stayed at home`);
    assert.ok(stayed.length <= home.length * 0.25, `${stayed.length} of ${home.length} stayed`);
    // The farms keep their few, by farm; the children's farm its petting set.
    const plan = townPlan();
    const atFarm = new Map<string, {big: number; birds: number}>();
    for (const a of all) {
        if (a.area !== "farm" || !ruralKindOf(a) || fields.has(a.id)) continue;
        const farm = farmOf(a.id);
        const c = atFarm.get(farm) ?? {big: 0, birds: 0};
        if (ruralKindOf(a) === "poultry" || ruralKindOf(a) === "waterfowl") c.birds++;
        else c.big++;
        atFarm.set(farm, c);
    }
    atFarm.forEach((c, id) => {
        const kind = plan.farms.find((f) => f.id === id)!.kind;
        assert.ok(c.big <= FARM_KEEP[kind].big && c.birds <= FARM_KEEP[kind].birds, `${id}: ${c.big} big, ${c.birds} birds`);
    });
    const petting = all.filter((a) => a.area === "zoo" && !fields.has(a.id));
    assert.equal(petting.length, PETTING_KEEP, "the children's farm's petting set");
    for (const slug of ["domestic-donkey", "domestic-horse", "domestic-goat"]) assert.equal(petting.filter((a) => a.model_slug === slug).length, 2, `${slug} at the children's farm (one of each kind in turn)`);
    // The rule is per animal and pure: the same answer from any order of the list.
    const again = ruralFields(all.slice().reverse());
    for (const [id, f] of Array.from(fields)) assert.equal(again.get(id)?.id, f.id);
    assert.equal(ruralPenOf({id: "x", model_slug: "domestic-horse", scientific_name: "Equus caballus", area: null}), null, "town wildlife is never taken");
});

/** How far a body of half-length `half` at (x, z) is inside the field's box: under 0 across its boundary. */
function inside(at: Box, x: number, z: number, half: number): number {
    const l = toLocal(at, x, z);
    return Math.min(at.w / 2 - Math.abs(l.x), at.d / 2 - Math.abs(l.z)) - half;
}

test("every moved body stays inside its field through an Ark day, out of the pond, on the drawn ground", () => {
    const all = animals();
    const placed = placeTownAnimals(all);
    const fields = ruralFields(all);
    const colliders = townColliderSet(placed.open, {x: 0, z: 0});
    const world = scheduleWorld(townWorldSampler(placed.open, {x: 0, z: 0}, colliders));
    const epochs = [...townDayEpochs(16), ...townDayEpochs(16, Date.UTC(2026, 10, 12, 12) / 1000)];
    const hoursAt = (epoch: number) => islandHours(epoch * 1000, 0);
    const out: string[] = [];
    let poses = 0;
    for (const a of all) {
        const field = fields.get(a.id);
        if (!field) continue;
        const info = placed.town.get(a.id)!;
        assert.equal(info.place, field.id);
        assert.ok(info.pen, `${a.model_slug} penned`);
        const place = placed.places.get(a.id)!;
        const plan = modelBase(a.model_slug)?.plan ?? null;
        const half = arkBody(a, plan).display / 2;
        if (inside(field.at, place.x, place.z, half) < 0.05) out.push(`${a.model_slug} spot`);
        assert.ok(ruralPondNorm(place.x, place.z) > 1.1, `${a.model_slug} not in the pond`);
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
            // (The scene's hard bound for a penned animal, `islands/scene.ts`.)
            keepInPen(info.pen!, info.penMargin ?? 0, pose);
            if (inside(field.at, pose.x, pose.z, half * 0.9) < 0) out.push(`${a.model_slug} ${trip.doing} ${inside(field.at, pose.x, pose.z, half).toFixed(2)} m`);
        }
    }
    assert.ok(poses > 500, `${poses} poses`);
    assert.deepEqual(out.slice(0, 8), []);
    const moved = all.filter((a) => fields.has(a.id));
    const check = validateTownAnimals(moved, {epochs: townDayEpochs(12)});
    setTownWalkSurfaces(null);
    console.log(`countryside residents: ${moved.length}, ${check.samples} samples; sinks ${check.counts.sinks}, floats ${check.counts.floats}`);
    assert.equal(check.counts.sinks, 0, JSON.stringify(check.problems.filter((p) => p.problems.includes("sinks")).slice(0, 5)));
    assert.equal(check.counts.floats, 0, JSON.stringify(check.problems.filter((p) => p.problems.includes("floats")).slice(0, 5)));
});

test("the fields lie on land, apart, clear of the lane and the tracks; their buildings inside them or clear", () => {
    for (const p of RURAL_PENS) {
        for (const c of corners(p.at)) assert.ok(inland(c.x, c.z) > 4, `${p.id} on land`);
        for (const q of RURAL_PENS) if (q !== p) assert.ok(!boxesOverlap(p.at, q.at, -0.5), `${p.id} × ${q.id}`);
        // (Sampled along the boundary: the lane's and the tracks' edges keep a metre off it.)
        const c = corners(p.at);
        for (let i = 0; i < 4; i++) {
            const a = c[i];
            const b = c[(i + 1) % 4];
            for (let t = 0; t <= 1; t += 0.05) {
                const x = a.x + (b.x - a.x) * t;
                const z = a.z + (b.z - a.z) * t;
                assert.ok(polylineDistance(RURAL_LANE, x, z) > RURAL_LANE_WIDTH / 2 + 1, `${p.id} on the lane`);
                for (const tr of RURAL_TRACKS) assert.ok(polylineDistance(tr.line, x, z) > 1.6 + 0.8, `${p.id} on ${tr.id}`);
            }
        }
    }
    for (const b of RURAL_BUILDINGS) {
        const host = RURAL_PENS.filter((p) => boxesOverlap(p.at, b.at, 0));
        // (Shelters, arks, hen houses and the farmyard's coop stand wholly inside their field; the rest clear of every field.)
        if (host.length) assert.ok(host.length === 1 && corners(b.at).every((c) => inBox(host[0].at, c.x, c.z, -0.3)), `${b.id} inside ${host[0].id}`);
        for (const c of corners(b.at)) assert.ok(inland(c.x, c.z) > 4, `${b.id} on land`);
    }
    // The plan has them: the fields' greens and boundaries, the pond, the buildings.
    const plan = townPlan();
    for (const p of RURAL_PENS) {
        assert.ok(plan.greens.some((g) => g.id === p.id), `${p.id} green`);
        assert.ok(plan.hedges.some((h) => h.id.startsWith(`${p.id}-`)), `${p.id} boundary`);
    }
    assert.ok(plan.waters.some((w) => w.id === "rural_pond" && w.kind === "farm_pond"));
    for (const b of RURAL_BUILDINGS) assert.ok(plan.buildings.some((x) => x.id === b.id), b.id);
});

test("the real record (when the local snapshot is here): gardens without livestock, farms and the children's farm uncrowded", {skip: !existsSync("public/ark-local/snap.json")}, () => {
    const snap = JSON.parse(readFileSync("public/ark-local/snap.json", "utf8")) as {snapshot: {animals: ArkAnimal[]}};
    const town = snap.snapshot.animals.filter((a) => a.island === "town");
    const placed = placeTownAnimals(town);
    const fields = ruralFields(town);
    const perPlace = new Map<string, {big: number; birds: number}>();
    for (const a of town) {
        const kind = ruralKindOf(a);
        const info = placed.town.get(a.id)!;
        const f = fields.get(a.id);
        if (f && kind) assert.ok(FITS[kind].test(f.id), `${a.model_slug} in ${f.id}`);
        // (The zoo's own hoofstock and wild sheep keep their enclosures: only the children's farm is the census's.)
        if (!kind || f || !a.area || (a.area === "zoo" && !a.enclosure?.startsWith("childrens_farm"))) continue;
        // A home keeps only backyard hens; no garden keeps a horse, a cow, a goat, a sheep or a pig.
        if (a.area === "house") assert.equal(kind, "poultry", `${a.model_slug} in a garden`);
        const c = perPlace.get(info.place) ?? {big: 0, birds: 0};
        if (kind === "poultry" || kind === "waterfowl") c.birds++;
        else c.big++;
        perPlace.set(info.place, c);
    }
    perPlace.forEach((c, place) => {
        if (place.startsWith("childrens_farm")) assert.ok(c.big <= PETTING_KEEP && c.birds <= PETTING_KEEP, `${place}: ${c.big} + ${c.birds}`);
        else if (place.startsWith("farmstead")) assert.ok(c.big <= FARM_KEEP.farmstead.big && c.birds <= FARM_KEEP.farmstead.birds, `${place}: ${c.big} big, ${c.birds} birds`);
        else if (place.startsWith("smallholding")) assert.ok(c.big <= FARM_KEEP.smallholding.big && c.birds <= FARM_KEEP.smallholding.birds, `${place}: ${c.big} big, ${c.birds} birds`);
        else assert.ok(c.big === 0 && c.birds <= 3, `${place}: ${c.big} livestock, ${c.birds} hens`);
    });
    console.log(`countryside on the live record: ${fields.size} animals in ${new Set(Array.from(fields.values()).map((f) => f.id)).size} fields`);
    assert.ok(fields.size > 150);
});

test("the hens range by day and are shut in their hen house from dusk to morning, by the shared clock", () => {
    for (const field of ["rural-free-range", "rural-orchard", "rural-farmyard-run"]) {
        for (let i = 0; i < 30; i++) {
            const id = `hen-${field}-${i}`;
            const house = henHouseOf(field, id)!;
            assert.ok(house && RURAL_PENS.find((p) => p.id === field)!.at && corners(house.at).every((c) => inBox(RURAL_PENS.find((p) => p.id === field)!.at, c.x, c.z, 0)), `${id}'s house in its field`);
            const at = RURAL_PENS.find((p) => p.id === field)!.at;
            assert.equal(coopPose(field, id, 12, at.x, at.z), null, "out ranging at noon");
            for (const h of [COOP_HOURS.in + 0.1, 23, 2, COOP_HOURS.out - 0.1]) {
                const p = coopPose(field, id, h, at.x, at.z)!;
                assert.ok(p.inside && inBox(house.at, p.x, p.z, -0.3), `${id} inside at ${h} h`);
                assert.deepEqual(p, coopPose(field, id, h, at.x + 3, at.z - 2), "inside, wherever it was");
            }
            // Walking in and out: between its place and the pophole, never through the house.
            const dusk = coopPose(field, id, COOP_HOURS.in - COOP_HOURS.walk / 2, at.x, at.z)!;
            assert.ok(!dusk.inside && Number.isFinite(dusk.x));
        }
    }
    assert.equal(coopPose("rural-dairy-pasture", "cow-1", 23, 0, 0), null, "only the poultry");
});

test("a tap on an animal in the fields selects it: by day where it stands, a hen at night in her hen house", () => {
    const list = animals();
    const placed = placeTownAnimals(list);
    const fields = ruralFields(list);
    const moved = list.filter((a) => fields.has(a.id));
    const poultry = moved.filter((a) => /free-range|orchard|farmyard-run/.test(fields.get(a.id)!.id));
    assert.ok(moved.length > 20 && poultry.length > 3, `${moved.length} moved, ${poultry.length} poultry`);
    // (Looking straight down from 30 m over each in turn, as the homes' tap test does.)
    const tap = (at: {x: number; z: number; y: number}, where: Map<string, {x: number; z: number; y: number}>) => {
        const project: Projector = (x, y, z) => ({sx: 500 + (x - at.x) * (100 / 30), sy: 500 + (z - at.z) * (100 / 30), distance: Math.max(at.y + 30 - y, 0.1)});
        const middles: number[] = [];
        for (const a of moved) {
            const p = where.get(a.id)!;
            middles.push(p.x, p.y + 0.2, p.z);
        }
        return pickFigure(500, 500, [{members: moved.map((a) => ({id: a.id})), middles, length: 0.5, height: 0.3}], project, 0.01);
    };
    const day = new Map(moved.map((a) => {
        const p = placed.places.get(a.id)!;
        return [a.id, {x: p.x, z: p.z, y: p.ground}];
    }));
    for (const target of moved.filter((_, i) => i % 7 === 0)) {
        const hit = tap(day.get(target.id)!, day);
        assert.equal(hit?.id, target.id, `a tap on ${target.model_slug} in ${fields.get(target.id)!.id}`);
    }
    // At night: the hens where the scene draws them (`coopPose`), in their houses; a tap there selects a hen of that house.
    const night = new Map(day);
    for (const a of poultry) {
        const at = day.get(a.id)!;
        const coop = coopPose(fields.get(a.id)!.id, a.id, 23, at.x, at.z)!;
        night.set(a.id, {x: coop.x, z: coop.z, y: sampleTownGround(coop.x, coop.z).height + coop.floor});
    }
    for (const target of poultry.slice(0, 6)) {
        const hit = tap(night.get(target.id)!, night);
        assert.ok(hit, "a hit");
        const got = night.get(hit.id)!;
        const want = night.get(target.id)!;
        assert.ok(Math.hypot(got.x - want.x, got.z - want.z) < 0.5 && henHouseOf(fields.get(hit.id)!.id, hit.id) === henHouseOf(fields.get(target.id)!.id, target.id), `${hit.id} for ${target.id}`);
    }
});
