/**
 * The town's kept animals in their right places (graphics pass 1, lane PLACE; the owner, 2026-11-16: "horses are in the
 * middle of fences", "half of a horse's body is half in a cow's", "i see a random asian arowana in the backyard of a
 * house", "the water canal in the town island has a dog in it"). By rule over the whole island (`placement.ts`):
 * - a farm animal stands inside its paddock, run or yard, its body clear of the rails; a home's pet inside its own
 *   garden, yard or courtyard; and every pose of its day is held there (`keepInPen`, the scene's bound);
 * - kept animals in one pen stand apart (`keptGap`), and none of them in a building, a garden room or a pond;
 * - no kept land animal stands in water (the canal, the millpond, a farm pond), and no home's fish is out of it.
 */
import assert from "node:assert/strict";
import {existsSync, readFileSync} from "node:fs";
import test from "node:test";
import type {ArkAnimal} from "@/ark-scene/types";
import {arkBody} from "@/ark-scene/stats";
import {toLocal, type Box} from "@/ark-scene/islands/town/geom";
import {townHeight} from "@/ark-scene/islands/town/ground";
import {townWaterSurface} from "@/ark-scene/islands/town/drawn-ground";
import {homeSiteFootprints, homeKeeping, inTownSolid} from "@/ark-scene/islands/town/tanks";
import {townHouseholds} from "@/ark-scene/islands/town/areas";
import {keepInPen, keptGap, placeTownAnimals, type TownPlace} from "@/ark-scene/islands/town/placement";
import {modelBase} from "@/ark-scene/grounding/base";
import {inBox} from "@/ark-scene/islands/town/geom";
import {roomCell} from "@/ark-scene/islands/town/home-rooms";

function animal(i: number, slug: string, area: ArkAnimal["area"], zone = "farm_garden", extra: Partial<ArkAnimal> = {}): ArkAnimal {
    return {id: `pen-${String(i).padStart(5, "0")}-${slug}`, species_profile_id: `sp-${slug}`, name: slug, scientific_name: null, model_slug: slug, zone: zone as ArkAnimal["zone"], arrived_at: `2026-10-${String(1 + (i % 28)).padStart(2, "0")}T${String(i % 24).padStart(2, "0")}:00:00Z`, brought_by: {label: "x", named: false}, mine: false, area, island: "town", enclosure: null, ...extra} as ArkAnimal;
}

/** The real town's mix of kept animals, about its size (2026-11-16: 312 cats, 264 dogs, 154 farm animals...). */
function keptTown(): ArkAnimal[] {
    const out: ArkAnimal[] = [];
    let i = 0;
    const farm: Array<[string, number]> = [["domestic-chicken", 40], ["domestic-horse", 18], ["cow", 16], ["domestic-goat", 14], ["domestic-sheep", 13], ["domestic-duck", 7], ["domestic-pig", 6], ["domestic-goose", 5], ["domestic-donkey", 4], ["domestic-turkey", 4], ["indian-peafowl", 3], ["alpaca", 3]];
    for (const [slug, n] of farm) for (let k = 0; k < n; k++) out.push(animal(i++, slug, "farm"));
    const home: Array<[string, number, string?]> = [["domestic-cat", 300], ["domestic-dog", 260], ["domestic-chicken", 45], ["domestic-pigeon", 40], ["domestic-rabbit", 16], ["guinea-pig", 11], ["domestic-horse", 10], ["cow", 8], ["domestic-duck", 9], ["goldfish", 20], ["koi", 12], ["asian-arowana", 5, "river_lake"], ["silver-arowana", 2, "river_lake"], ["siamese-fighting-fish", 10], ["greek-tortoise", 4]];
    for (const [slug, n, zone] of home) for (let k = 0; k < n; k++) out.push(animal(i++, slug, "house", zone));
    return out;
}

/** How far a point is inside a box (m): its distance to the nearest side, negative outside. */
function inset(b: Box, x: number, z: number): number {
    const l = toLocal(b, x, z);
    return Math.min(b.w / 2 - Math.abs(l.x), b.d / 2 - Math.abs(l.z));
}

function checkTown(animals: readonly ArkAnimal[]): {penned: number; indoor: number; outOfPen: string[]; onRails: string[]; together: string[]; inWater: string[]; dryFish: string[]; inSolid: string[]} {
    const placed = placeTownAnimals(animals);
    const rooms = homeSiteFootprints(townHouseholds());
    const out = {penned: 0, indoor: 0, outOfPen: [] as string[], onRails: [] as string[], together: [] as string[], inWater: [] as string[], dryFish: [] as string[], inSolid: [] as string[]};
    const byPlace = new Map<string, Array<{a: ArkAnimal; x: number; z: number; length: number}>>();
    for (const a of animals) {
        const info = placed.town.get(a.id) as TownPlace;
        const p = placed.places.get(a.id)!;
        const length = arkBody(a).metres;
        const label = `${a.model_slug} ${info.where} ${info.place} (${p.x.toFixed(1)}, ${p.z.toFixed(1)})`;
        if (info.area === "house" && (info.keeping === "tank" || info.keeping === "pond") && !info.tank) out.dryFish.push(label);
        // p5 (homes): a pet over its garden's cap lives indoors, its spot inside its cell of its room's floor.
        if (info.room) {
            out.indoor++;
            if (inset(roomCell(info.room), p.x, p.z) < 0 || Math.abs(p.ground - info.room.room.floor) > 1e-6) out.outOfPen.push(`${label}: out of its room`);
            continue;
        }
        const ground = !info.still && !info.tank && !info.display && info.where !== "balcony" && info.where !== "window" && (info.area === "house" || info.area === "farm");
        if (!ground) continue;
        if (info.pen) {
            out.penned++;
            const d = inset(info.pen, p.x, p.z);
            if (d < 0) out.outOfPen.push(label);
            else if (d < Math.min(length / 2, Math.min(info.pen.w, info.pen.d) / 2 - 0.05) - 1e-6) out.onRails.push(`${label}: ${d.toFixed(2)} m in`);
        } else out.outOfPen.push(`${label}: no pen`);
        const surface = townWaterSurface(p.x, p.z);
        if (surface !== null && townHeight(p.x, p.z) < surface) out.inWater.push(label);
        if (inTownSolid(p.x, p.z, -0.05) || rooms.some((b) => inBox(b, p.x, p.z, -0.05))) out.inSolid.push(label);
        const list = byPlace.get(info.place) ?? [];
        for (const o of list) if (Math.hypot(o.x - p.x, o.z - p.z) < keptGap(length, o.length) - 1e-6) out.together.push(`${label} and ${o.a.model_slug}: ${Math.hypot(o.x - p.x, o.z - p.z).toFixed(2)} m`);
        list.push({a, x: p.x, z: p.z, length});
        byPlace.set(info.place, list);
    }
    return out;
}

test("the town's kept animals: in their pens off the rails, apart, out of the water and the buildings; the fish in water", () => {
    const animals = keptTown();
    const check = checkTown(animals);
    console.log(`kept town: ${animals.length} animals, ${check.penned} penned on the ground`);
    // (p5 (homes): the gardens' cap sends the pets over it indoors, each checked in its room above: outdoors and in
    // together they are the town's kept animals, as before.)
    assert.ok(check.penned + check.indoor > 600, `${check.penned} penned, ${check.indoor} indoors`);
    assert.ok(check.indoor > 50, `${check.indoor} indoors`);
    assert.deepEqual(check.outOfPen, [], "out of its pen");
    assert.deepEqual(check.onRails, [], "on its pen's rails");
    assert.deepEqual(check.inWater, [], "a land animal in water");
    assert.deepEqual(check.dryFish, [], "a home's fish out of water");
    assert.deepEqual(check.inSolid, [], "in a building, garden room or pond");
    // (A pen full past its room keeps the last ones as far from the others as it can: none in this town.)
    assert.deepEqual(check.together, [], "kept animals inside one another");
});

test("a fish longer than every home's tank (an arowana) lives in a garden pond, not on the lawn", () => {
    const arowana = animal(1, "asian-arowana", "house", "river_lake");
    assert.equal(homeKeeping("asian-arowana", "river_lake", arkBody(arowana).metres, modelBase("asian-arowana")?.plan ?? null), "tank");
    const info = placeTownAnimals([arowana]).town.get(arowana.id)!;
    assert.ok(info.tank && info.display?.form === "pond", JSON.stringify({where: info.where, display: info.display?.form}));
});

test("the scene's bound holds every pose of a penned animal inside its pen, off the rails; one inside is left alone", () => {
    const pen: Box = {x: 10, z: -4, w: 13.8, d: 9, rot: 0.6};
    const margin = 1.35;
    for (let k = 0; k < 200; k++) {
        const pose = {x: 10 + 12 * Math.cos(k * 0.7) * ((k % 7) / 6), z: -4 + 12 * Math.sin(k * 1.3) * ((k % 5) / 4)};
        const before = {...pose};
        keepInPen(pen, margin, pose, 0, 0);
        assert.ok(inset(pen, pose.x, pose.z) >= margin - 1e-6, `${k}: ${inset(pen, pose.x, pose.z)}`);
        if (inset(pen, before.x, before.z) >= margin) assert.deepEqual(pose, before);
    }
    // (In the world: the island's origin added.)
    const pose = {x: 600 + 40, z: -249};
    keepInPen(pen, margin, pose, 600, -249);
    assert.ok(inset(pen, pose.x - 600, pose.z + 249) >= margin - 1e-6);
});

test("an arrival moves nobody already in its pen", () => {
    const first = keptTown().filter((a) => a.area === "farm");
    const placed = placeTownAnimals(first);
    const later = [...first, ...["domestic-horse", "cow", "domestic-sheep", "domestic-goat"].flatMap((slug, k) => [animal(90000 + k * 2, slug, "farm", "farm_garden", {arrived_at: "2026-11-16T10:00:00Z"}), animal(90001 + k * 2, slug, "farm", "farm_garden", {arrived_at: "2026-11-16T10:00:00Z"})])];
    const after = placeTownAnimals(later);
    for (const a of first) assert.deepEqual(after.places.get(a.id), placed.places.get(a.id), a.id);
});

/** The real Ark's town (development only, read in place): `ARK_TOWN_SNAPSHOT`, a saved `voyage_public_v3` read with its islands. */
const REAL = process.env.ARK_TOWN_SNAPSHOT ?? "";
test("the real Ark's town (development only): the same rules over every kept animal", {skip: !REAL || !existsSync(REAL)}, () => {
    const raw = JSON.parse(readFileSync(REAL, "utf8"));
    const animals = ((raw.snapshot ?? raw).animals as ArkAnimal[]).filter((a) => a.island === "town");
    const check = checkTown(animals);
    console.log(`real town: ${animals.length} animals, ${check.penned} penned; together ${check.together.length}`);
    assert.deepEqual(check.outOfPen, []);
    assert.deepEqual(check.onRails, []);
    assert.deepEqual(check.inWater, []);
    assert.deepEqual(check.dryFish, []);
    assert.deepEqual(check.inSolid, []);
    assert.deepEqual(check.together, []);
});
