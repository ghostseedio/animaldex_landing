/**
 * Pets indoors at home (p5 (homes); the owner, 2026-11-17: "currently so many dogs and horses and cows etc. in one
 * garden ... maybe a way to enter the skyrise buildings where you can see dogs/cats inside homes").
 *
 * - The garden cap: a house's garden keeps at most 3 outdoor pets, a terrace home's yard 2 (unless more of them cannot
 *   live indoors); the domestic cats, dogs, rabbits and guinea pigs over it live in the home's garden room or a tower
 *   apartment, never invented, never lost.
 * - Each pet indoors stays in its own cell of its room's floor through a day of the shared clock, at the floor's height.
 * - The apartments are glazed bays on the towers' fronts, outside the curtain wall, on their storeys' floors.
 * - A tap lands on a pet indoors (its drawn figure's circle on screen).
 * - The answer is the same whatever order the animals come in; turtles have a tank to themselves.
 */
import assert from "node:assert/strict";
import {existsSync, readFileSync} from "node:fs";
import test from "node:test";
import type {ArkAnimal} from "@/ark-scene/types";
import {arkBody} from "@/ark-scene/stats";
import {modelBase} from "@/ark-scene/grounding/base";
import {toLocal, type Box} from "@/ark-scene/islands/town/geom";
import {townPlan, TOWER_FLOOR} from "@/ark-scene/islands/town/plan";
import {placeTownAnimals, type TownPlace} from "@/ark-scene/islands/town/placement";
import {APARTMENT_FROM_STOREY, BAY_DEPTH, GARDEN_CAP, countsInGarden, indoorKind, roomCell, roomPose, towerApartments, towerFloor} from "@/ark-scene/islands/town/home-rooms";
import {pickFigure, type Projector} from "@/ark-scene/tap-pick";

function animal(i: number, slug: string, zone = "farm_garden"): ArkAnimal {
    return {id: `hr-${String(i).padStart(5, "0")}-${slug}`, species_profile_id: `sp-${slug}`, name: slug, scientific_name: null, model_slug: slug, zone: zone as ArkAnimal["zone"], arrived_at: `2026-10-${String(1 + (i % 28)).padStart(2, "0")}T10:00:00Z`, brought_by: {label: "x", named: false}, mine: false, area: "house", island: "town", enclosure: null} as ArkAnimal;
}

/** The real town's mix of home pets, about its size (2026-11-16: 312 cats, 264 dogs, 16 rabbits, 11 guinea pigs ...). */
function homes(): ArkAnimal[] {
    const out: ArkAnimal[] = [];
    let i = 0;
    const mix: Array<[string, number, string?]> = [["domestic-cat", 312], ["domestic-dog", 264], ["domestic-rabbit", 16], ["guinea-pig", 11], ["domestic-pigeon", 44], ["greek-tortoise", 4], ["goldfish", 20], ["siamese-fighting-fish", 11], ["annam-pond-turtle", 3, "river_lake"], ["reeves-turtle", 2, "river_lake"], ["budgerigar", 8]];
    for (const [slug, n, zone] of mix) for (let k = 0; k < n; k++) out.push(animal(i++, slug, zone));
    return out;
}

function inset(b: Box, x: number, z: number): number {
    const l = toLocal(b, x, z);
    return Math.min(b.w / 2 - Math.abs(l.x), b.d / 2 - Math.abs(l.z));
}

/** The gardens' counted outdoor pets and the cap's breaches (more than the cap with an indoor-able pet among them). */
function gardens(list: readonly ArkAnimal[], town: Map<string, TownPlace>): {max: number; breaches: string[]; indoors: number; sizes: Map<string, number>} {
    const by = new Map<string, ArkAnimal[]>();
    let indoors = 0;
    for (const a of list) {
        if (a.area !== "house") continue;
        const info = town.get(a.id)!;
        if (info.room) {
            indoors++;
            continue;
        }
        if (info.where === "window" || info.display || info.area !== "house") continue;
        const plan = modelBase(a.model_slug)?.plan ?? null;
        if (!countsInGarden(plan, arkBody(a).metres)) continue;
        by.set(info.place, [...(by.get(info.place) ?? []), a]);
    }
    const breaches: string[] = [];
    let max = 0;
    const sizes = new Map<string, number>();
    by.forEach((pets, place) => {
        max = Math.max(max, pets.length);
        sizes.set(place, pets.length);
        const cap = place.startsWith("terrace") ? GARDEN_CAP.terrace_home : GARDEN_CAP.house;
        const able = pets.filter((a) => indoorKind(a.model_slug, modelBase(a.model_slug)?.plan ?? null));
        if (pets.length > cap && able.length) breaches.push(`${place}: ${pets.map((a) => a.model_slug).join(", ")}`);
    });
    return {max, breaches, indoors, sizes};
}

test("the garden cap: a few pets outdoors a home, the rest of the cats and dogs indoors (fixture mix)", () => {
    const list = homes();
    const placed = placeTownAnimals(list);
    const g = gardens(list, placed.town);
    console.log(`homes: ${list.length} pets, ${g.indoors} indoors, the fullest garden ${g.max}`);
    assert.deepEqual(g.breaches, []);
    assert.ok(g.indoors > 100, `${g.indoors} indoors`);
    // Only domestic indoor kinds are indoors; every pet is placed (none lost).
    for (const a of list) {
        const info = placed.town.get(a.id);
        assert.ok(info && placed.places.get(a.id), `${a.id} placed`);
        if (info.room) assert.ok(indoorKind(a.model_slug, modelBase(a.model_slug)?.plan ?? null), `${a.model_slug} indoors`);
    }
});

const REAL = "public/ark-local/snap.json";
test("the garden cap on the live record (development only: the saved snapshot)", {skip: !existsSync(REAL)}, () => {
    const raw = JSON.parse(readFileSync(REAL, "utf8"));
    const town = ((raw.snapshot ?? raw).animals as ArkAnimal[]).filter((a) => a.island === "town");
    const placed = placeTownAnimals(town);
    const g = gardens(town, placed.town);
    console.log(`live: ${g.indoors} pets indoors, the fullest garden ${g.max}`);
    assert.deepEqual(g.breaches, []);
});

test("every pet indoors stays in its cell of its room's floor through a day of the shared clock", () => {
    const list = homes();
    const placed = placeTownAnimals(list);
    let n = 0;
    const cells = new Map<string, string[]>();
    for (const a of list) {
        const info = placed.town.get(a.id)!;
        if (!info.room) continue;
        n++;
        const cell = roomCell(info.room);
        const key = `${info.room.room.id}:${info.room.cell}`;
        cells.set(key, [...(cells.get(key) ?? []), a.id]);
        const length = arkBody(a).metres;
        const p = placed.places.get(a.id)!;
        assert.equal(p.ground, info.room.room.floor, `${a.id} on its room's floor`);
        // (Its drawn body: no more than its stored length's half from its middle, in its cell.)
        for (let t = 0; t < 86400; t += 97) {
            const pose = roomPose(info.room, a.id, length, t);
            assert.ok(inset(cell, pose.x, pose.z) >= Math.min(length * 0.5, cell.w / 2, cell.d / 2) - 1e-6, `${a.id} at ${t}: ${inset(cell, pose.x, pose.z).toFixed(3)}`);
            assert.equal(pose.base, info.room.room.floor);
        }
        // Pure in time and id.
        assert.deepEqual(roomPose(info.room, a.id, length, 1234.5), roomPose(info.room, a.id, length, 1234.5));
    }
    assert.ok(n > 100);
    cells.forEach((ids, key) => assert.equal(ids.length, 1, `${key} shared by ${ids.join(", ")}`));
});

test("the tower apartments: glazed bays on the towers' fronts and backs, outside the walls, on their storeys", () => {
    const plan = townPlan();
    const rooms = towerApartments(plan);
    assert.ok(rooms.length >= 60, `${rooms.length} apartments`);
    for (const r of rooms) {
        const tower = plan.buildings.find((b) => b.id === r.building)!;
        assert.equal(tower.kind, "tower");
        const l = toLocal(tower.at, r.shell.x, r.shell.z);
        assert.ok(Math.abs(Math.abs(l.z) - (tower.at.d / 2 + BAY_DEPTH / 2)) < 1e-6 && Math.abs(l.x) < tower.at.w / 2, `${r.id} on the front or back`);
        assert.ok(r.storey! >= APARTMENT_FROM_STOREY && r.storey! < tower.floors - 1);
        assert.ok(Math.abs(r.floor - (towerFloor(tower.at) + r.storey! * TOWER_FLOOR)) < 1e-6);
        // Its free floor inside its shell, short of the glass.
        for (const lx of [-1, 1]) for (const lz of [-1, 1]) {
            const x = r.free.x + (Math.cos(r.free.rot) * lx * r.free.w) / 2 - (Math.sin(r.free.rot) * lz * r.free.d) / 2;
            const z = r.free.z + (Math.sin(r.free.rot) * lx * r.free.w) / 2 + (Math.cos(r.free.rot) * lz * r.free.d) / 2;
            assert.ok(inset(r.shell, x, z) > 0.1, `${r.id} free floor inside`);
        }
    }
});

test("a tap on a pet indoors selects it", () => {
    const list = homes();
    const placed = placeTownAnimals(list);
    const pets = list.filter((a) => placed.town.get(a.id)?.room?.room.kind === "apartment").slice(0, 5);
    assert.ok(pets.length > 0);
    // (Looking straight down from 30 m over each in turn: 100 px a metre at 1 m.)
    for (const target of pets) {
        const at = placed.places.get(target.id)!;
        const project: Projector = (x, y, z) => ({sx: 500 + (x - at.x) * (100 / 30), sy: 500 + (z - at.z) * (100 / 30), distance: Math.max(at.ground + 30 - y, 0.1)});
        const middles: number[] = [];
        for (const a of list) {
            const p = placed.places.get(a.id)!;
            middles.push(p.x, p.ground + 0.2, p.z);
        }
        const hit = pickFigure(500, 500, [{members: list.map((a) => ({id: a.id})), middles, length: 0.5, height: 0.3}], project, 0.01);
        assert.ok(hit, "a hit");
        const hitPlace = placed.places.get(hit.id)!;
        assert.ok(Math.hypot(hitPlace.x - at.x, hitPlace.z - at.z) < 1e-6 && placed.town.get(hit.id)?.room, `${hit.id} for ${target.id}`);
    }
});

test("the same pets indoors whatever order they come in; each home turtle has its tank to itself", () => {
    const list = homes();
    const a = placeTownAnimals(list);
    const b = placeTownAnimals(list.slice().reverse());
    for (const pet of list) {
        assert.equal(a.town.get(pet.id)!.room?.room.id ?? null, b.town.get(pet.id)!.room?.room.id ?? null, pet.id);
        assert.deepEqual(a.places.get(pet.id), b.places.get(pet.id), pet.id);
    }
    const tanks = new Map<string, string[]>();
    for (const pet of list) {
        const info = a.town.get(pet.id)!;
        if (info.display?.form === "tank") tanks.set(info.display.id, [...(tanks.get(info.display.id) ?? []), pet.model_slug]);
    }
    let turtles = 0;
    tanks.forEach((slugs, id) => {
        if (!slugs.some((s) => /turtle/.test(s))) return;
        turtles++;
        assert.equal(slugs.length, 1, `${id}: ${slugs.join(", ")}`);
    });
    assert.ok(turtles >= 3, `${turtles} turtles in tanks`);
});
