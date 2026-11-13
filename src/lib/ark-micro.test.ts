import assert from "node:assert/strict";
import test from "node:test";
import table from "@/ark-scene/microhabitats.json";
import {COTTAGE} from "@/ark-scene/micro-decor";
import {MICRO_SPOTS, microPlace, microSpecies, surfacePoint} from "@/ark-scene/micro";
import {placeAnimals} from "@/ark-scene/placement";
import {arkBody} from "@/ark-scene/stats";
import {MARKER_BELOW_PIXELS, markerNotIcon, screenPixels} from "@/ark-scene/sizes";
import {meetDistance} from "@/ark-scene/runtime/camera";
import type {ArkAnimal} from "@/ark-scene/types";

const near = (actual: number, expected: number, within: number, what: string) => assert.ok(Math.abs(actual - expected) <= within, `${what}: ${actual} not ${expected}`);
const rows = (table as unknown as {species: Record<string, string[]>}).species;

test("microhabitats: every row is a known spot with its reason; the owner's examples are where he put them", () => {
    for (const [slug, row] of Object.entries(rows)) {
        assert.ok((MICRO_SPOTS as readonly string[]).includes(row[0]), slug);
        assert.ok(row[1].length > 8, `${slug} keeps its reason`);
    }
    // Geckos, house spiders and ants on the cottage; moths there are moths; pets and house sparrows round it.
    for (const slug of ["mediterranean-house-gecko", "tropical-house-gecko", "common-house-gecko", "common-house-spider", "black-ant"]) assert.equal(microSpecies(slug)?.spot, "house", slug);
    assert.equal(microSpecies("clothes-house-moth")?.moth, true);
    for (const slug of ["domestic-cat", "domestic-dog", "house-sparrow", "house-mouse"]) assert.equal(microSpecies(slug)?.spot, "house", slug);
    assert.equal(microPlace("domestic-dog", "farm_garden", 3, 0, 0.8)?.surface, "around");
    assert.equal(microPlace("house-sparrow", "farm_garden", 3, 0, 0.13)?.surface, "roof");
    assert.equal(microPlace("mediterranean-house-gecko", "farm_garden", 3, 0, 0.1)?.surface, "wall");
    // A big animal is not small; the sea keeps its own.
    assert.equal(microSpecies("african-bush-elephant"), null);
    assert.equal(microSpecies("blue-whale"), null);
});

function animal(slug: string, zone: ArkAnimal["zone"], slot: number, rank = 0): ArkAnimal {
    return {id: `${slug}-${zone}-${slot}-${rank}`, species_profile_id: slug, name: slug, scientific_name: null, model_slug: slug, zone, arrived_at: "2026-11-01T00:00:00Z", brought_by: {label: "Voyager 1", named: false}, mine: false, slot, slot_rank: rank};
}

test("microhabitats: on the cottage's walls, in the plane of a wall and inside it; every slot its own point", () => {
    const halfW = COTTAGE.width / 2;
    const halfD = COTTAGE.depth / 2;
    const seen: Array<[number, number, number]> = [];
    for (let slot = 0; slot < 60; slot++) {
        const place = microPlace("mediterranean-house-gecko", "farm_garden", slot, 0, 0.1)!;
        const p = surfacePoint(place, "farm_garden");
        const lx = p.x - COTTAGE.x;
        const lz = p.z - COTTAGE.z;
        const onWall = Math.abs(Math.abs(lx) - halfW) < 0.03 || Math.abs(Math.abs(lz) - halfD) < 0.03;
        assert.ok(onWall && Math.abs(lx) <= halfW + 0.03 && Math.abs(lz) <= halfD + 0.03, `slot ${slot} on a wall`);
        assert.ok(p.y > COTTAGE.floor && p.y < COTTAGE.floor + COTTAGE.wall, `slot ${slot} between the floor and the eaves`);
        // Its back to the wall's normal, heading along the wall.
        assert.ok(Math.abs(p.nx * p.tx + p.ny * p.ty + p.nz * p.tz) < 1e-6);
        for (const q of seen) assert.ok(Math.hypot(q[0] - p.x, q[1] - p.y, q[2] - p.z) > 0.02, `slot ${slot} has its own point`);
        seen.push([p.x, p.y, p.z]);
    }
});

test("microhabitats: nobody moves when another small animal arrives or leaves", () => {
    const animals = [
        animal("mediterranean-house-gecko", "farm_garden", 40),
        animal("common-house-spider", "farm_garden", 41),
        animal("black-ant", "farm_garden", 42, 0),
        animal("black-ant", "farm_garden", 42, 1),
        animal("black-ant", "farm_garden", 42, 2),
        animal("marmalade-hoverfly", "farm_garden", 43),
        animal("green-anole", "farm_garden", 44),
        animal("yellow-spotted-millipede", "woodland", 30),
        animal("water-strider", "river_lake", 20),
        animal("common-wall-lizard", "farm_garden", 45),
        animal("domestic-cat", "farm_garden", 46)
    ];
    const before = placeAnimals(animals);
    // The map (B3): every small one on an attach point (the water strider on the water itself); the cat, not small, round the house (or its garden).
    for (const a of animals) {
        const place = before.get(a.id)!;
        if (a.model_slug === "water-strider") assert.ok(place.water && ["pond", "lake", "stream_river"].includes(place.map!.tag!), "the strider on still water");
        else if (a.model_slug === "domestic-cat") assert.ok(["house", "garden"].includes(place.map!.tag!), "the cat round the house or in the garden");
        // A small invertebrate as a micro animal; a gecko, a lizard or a bird perched on its point (on the behaviour schedule).
        else assert.ok(place.micro?.attach || (place.perch && place.map?.attach), `${a.model_slug} on an attach point`);
    }
    const after = placeAnimals(animals.filter((_, i) => i % 2 === 0));
    after.forEach((place, id) => assert.deepEqual(place, before.get(id)));
    const more = placeAnimals([...animals, animal("tropical-house-gecko", "farm_garden", 47), animal("house-fly", "woodland", 31)]);
    before.forEach((place, id) => assert.deepEqual(more.get(id), place));
});

test("small animals are true size at every distance (motion pass §3): the marker from afar, met close enough to see", () => {
    // A black ant (5 mm): drawn its own size close by and far off; a marker once it is under 5 px; never an icon past the model cap.
    const ant = arkBody({model_slug: "black-ant"});
    assert.ok(ant.display < 0.01 && !ant.floor, `an ant is drawn ${ant.display} m`);
    const pixelsAt = (distance: number) => screenPixels(ant.display, distance, 800, 38);
    assert.ok(pixelsAt(0.12) > 40, "close by it fills a good part of the view");
    assert.ok(pixelsAt(3) < MARKER_BELOW_PIXELS, "a few metres off it is found by its marker");
    assert.ok(markerNotIcon(pixelsAt(40)), "far off it is a dot, not a 1.6 m icon");
    // "My animals" and ?focus= fly to it: close enough that it is a fifth of the view or so.
    const met = meetDistance(ant.display, 0.45);
    assert.ok(met <= 0.15 && pixelsAt(met) >= MARKER_BELOW_PIXELS * 6, `met from ${met} m`);
    // A mouse from about a metre, a whale from far enough back to see it whole on an upright phone.
    near(meetDistance(arkBody({model_slug: "house-mouse"}).display, 0.45), 1.05, 0.3, "mouse");
    assert.ok(meetDistance(arkBody({model_slug: "blue-whale"}).display, 0.45) > 100, "blue whale");
});

test("rigged clips: passed rigs, a partial rig's own passing clips; never flight, never a sitting rig's movement, never a fallback", async () => {
    const {rigClip, rigPlayable, decodeRigIndex, decodeRigEntry} = await import("@/ark-scene/rig-clips");
    const manifest = {species: {
        "mediterranean-house-gecko": {state: "passed", v: "a", clips: {walk: {frames: 24, loop: true, seconds: 0.35, pass: true}}},
        "common-house-spider": {state: "fallback", clips: ["idle", "walk", "run"]},
        "black-ant": {state: "passed", v: "b", clips: {idle: {frames: 48, loop: true, seconds: 2, pass: true}}},
        // A passed flyer: its flight is held (pass false), and a clip without `pass` is never read.
        "house-sparrow": {state: "passed", v: "c", clips: {
            hop: {frames: 12, loop: true, seconds: 0.4, ground_speed: 0.5, pass: true},
            flap: {frames: 12, loop: true, seconds: 0.3, pass: false, held: "wing cards await owner review"},
            perch: {frames: 48, loop: true, seconds: 3}
        }},
        // A partial rig: only its individually passing clips.
        "acorn-woodpecker": {state: "partial", v: "d", clips: {
            walk: {frames: 24, loop: true, seconds: 0.5, ground_speed: 0.1, pass: false},
            hop: {frames: 12, loop: true, seconds: 0.4, ground_speed: 0.5, pass: true}
        }},
        // A sitting rest pose: idle only, whatever its walk's checks said.
        "agile-wallaby": {state: "partial", v: "e", pose: "sitting (rest pose reviewed from renders)", clips: {
            idle: {frames: 48, loop: true, seconds: 2, pass: true},
            walk: {frames: 24, loop: true, seconds: 0.6, ground_speed: 0.1, pass: true}
        }},
        // Even a manifest that marks a flight clip as passing never plays it.
        "barn-owl": {state: "passed", v: "f", clips: {glide: {frames: 24, loop: true, seconds: 2, pass: true}, land: {frames: 24, loop: false, seconds: 1, pass: true}}}
    }};
    assert.equal(rigClip(manifest, "mediterranean-house-gecko", "walk")?.frames, 24);
    assert.equal(rigClip(manifest, "common-house-spider", "walk"), null, "a fallback rig is never read");
    assert.equal(rigClip(manifest, "black-ant", "walk"), null, "a clip the passed rig doesn't list");
    assert.equal(rigClip(manifest, "nobody", "walk"), null);
    assert.equal(rigClip(manifest, "house-sparrow", "hop")?.frames, 12);
    assert.equal(rigClip(manifest, "house-sparrow", "flap"), null, "held flight");
    assert.equal(rigClip(manifest, "house-sparrow", "perch"), null, "a clip not marked as passing");
    assert.equal(rigClip(manifest, "acorn-woodpecker", "hop")?.frames, 12, "a partial rig's passing clip");
    assert.equal(rigClip(manifest, "acorn-woodpecker", "walk"), null, "a partial rig's failing clip");
    assert.equal(rigClip(manifest, "agile-wallaby", "idle")?.frames, 48);
    assert.equal(rigClip(manifest, "agile-wallaby", "walk"), null, "a sitting rig's movement is held");
    for (const flight of ["flap", "glide", "takeoff", "land"]) assert.equal(rigClip(manifest, "barn-owl", flight), null, flight);
    assert.equal(rigPlayable(manifest, "barn-owl"), false, "nothing but flight: no rig to load");
    assert.equal(rigPlayable(manifest, "acorn-woodpecker"), true);
    assert.equal(rigPlayable(manifest, "common-house-spider"), false);
    assert.equal(rigClip(null, "mediterranean-house-gecko", "walk"), null, "no manifest: every animal procedural");
    // The published manifest: slug -> rig file version; anything else is left out.
    assert.equal(decodeRigIndex({nope: 1}), null);
    assert.equal(decodeRigIndex("x"), null);
    assert.deepEqual(decodeRigIndex({species: {}}), {}, "an empty manifest: every rig off");
    assert.deepEqual(decodeRigIndex({species: {"red-fox": "8ea446733cd9", "Bad Slug": "8ea446733cd9", lion: "../../x", owl: 3}}), {"red-fox": "8ea446733cd9"});
    assert.equal(decodeRigEntry({state: "passed", clips: ["idle"]}), null);
    assert.equal(decodeRigEntry(null), null);
    assert.ok(decodeRigEntry({state: "partial", clips: {idle: {frames: 48, loop: true, seconds: 2, pass: true}}}));
});

test("rig player: the rig folder beside the model set, texture rows, planted feet, half floats", async () => {
    const {rigBaseFrom} = await import("@/ark-scene/rig-clips");
    const {clipRows, cyclesFor, halfToFloat} = await import("@/ark-scene/rig-player");
    assert.equal(rigBaseFrom("https://x.supabase.co/storage/v1/object/public/talking-models/v1/ark", "v1"), "https://x.supabase.co/storage/v1/object/public/talking-models/ark-rig/v1");
    assert.equal(rigBaseFrom("/api/dev/ark-models/v1/ark/", "v1"), "/api/dev/ark-models/ark-rig/v1");
    assert.equal(rigBaseFrom("/somewhere/else"), null);
    // Versioned: a re-made set (v3) beside the old ones; the release moves ARK_RIG_VERSION (v1 stays the fallback: ark-rig.test.ts).
    const {ARK_RIG_VERSION} = await import("@/ark-scene/rig-clips");
    assert.equal(ARK_RIG_VERSION, "v3");
    assert.equal(rigBaseFrom("/api/dev/ark-models/v1/ark", "v2"), "/api/dev/ark-models/ark-rig/v2");
    assert.equal(rigBaseFrom("/api/dev/ark-models/v1/ark", "../x"), null);
    const walk = {name: "walk", frames: 24, loop: true, seconds: 0.5, ground_speed: 0.2, pass: true, row: 49, rows: 25};
    assert.deepEqual(clipRows(walk, 0), [49, 50, 0]);
    // Looping: the phase wraps, and the last row (the first frame again) closes the cycle.
    const [r0, r1, t] = clipRows(walk, 1.99);
    assert.equal(r0, 49 + 23);
    assert.equal(r1, 49 + 24);
    assert.ok(t > 0.7 && t < 1);
    const once = {...walk, name: "leap", loop: false};
    assert.deepEqual(clipRows(once, 3), [49 + 24, 49 + 24, 0], "a one-shot holds its last frame");
    // A cycle covers ground_speed × seconds: walking that far is one cycle, whatever the time it took.
    assert.equal(cyclesFor(walk, 0.1), 1);
    assert.equal(cyclesFor({...walk, ground_speed: undefined}, 0.1), 0);
    assert.equal(halfToFloat(0x3c00), 1);
    assert.equal(halfToFloat(0xc000), -2);
    assert.equal(halfToFloat(0x3555) > 0.333 && halfToFloat(0x3555) < 0.3334, true);
    assert.equal(halfToFloat(0), 0);
});
