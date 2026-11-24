/**
 * Lane ZOOSLEEP (2026-11-24, the owner: "elephant enclosure glitching when I get close"): residents of a mixed zoo
 * paddock slept inside each other. They picked their beds one by one from three shade points by the keepers' shed,
 * 1.6 m apart and 1.0 m from its wall: a nyala and a bongo on one point, three red deer on the other two, a deer's
 * lying body under the eave (the seat pass then pushed it sideways onto the nyala). Now every resident's bed is handed
 * out with the others' (`islands/town/zoo-beds.ts`): its own, sized by its body, clear of the shed and of each other,
 * and the schedule sleeps it there.
 *
 * Real data: the fixture snapshot's town, placed as the town places it, with its colliders; and the live Ark's, where
 * it is saved (`public/ark-local/live.json`, git-ignored: skipped where it is not), whose mixed hoofstock paddock has 11.
 */

import assert from "node:assert/strict";
import {existsSync, readFileSync} from "node:fs";
import test from "node:test";
import base from "@/ark-scene/fixtures/snapshot-v2.json";
import {withArkIslandsFixture} from "@/ark-scene/fixtures/islands";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import {arkIslandSnapshot} from "@/lib/ark-islands";
import {maskBox, penKeep, placeTownAnimals} from "@/ark-scene/islands/town/placement";
import {townColliderSet} from "@/ark-scene/islands/town/colliders";
import {townWorldOrigin} from "@/ark-scene/islands";
import {townWorldSampler} from "@/ark-scene/islands/town/sampler";
import {townHeight} from "@/ark-scene/islands/town/ground";
import {BED_GAP, bedsDown, hasShed, townZooBeds} from "@/ark-scene/islands/town/zoo-beds";
import {bodyShape} from "@/ark-scene/collide/bodies";
import {bodyClear, inKeep, overlapOf, type ResolveBody} from "@/ark-scene/collide/resolve";
import {sexLook} from "@/ark-scene/behaviour-recipes";
import {behaviourProfile} from "@/ark-scene/behaviour-profile";
import {displayLength} from "@/ark-scene/sizes";
import {bodyRadiusOf, maxSlopeOf, roostOf, scheduleWorld, type ScheduleAnimal} from "@/ark-scene/behaviour-schedule";

const origin = townWorldOrigin();
const bodyOf = (id: string, slug: string, length: number): ResolveBody => {
    const s = bodyShape(slug, Math.max(length, 0.05) * sexLook(id, slug).scale);
    return {id, radius: s.radius, half: s.half, height: s.height};
};
type Bedded = {id: string; slug: string; length: number; zone: string; body: ResolveBody; bed: {x: number; z: number; heading: number}};

/** A snapshot's town placed, its zoo beds handed out, and each shed enclosure's residents with their beds. */
function townBeds(raw: unknown) {
    const town = arkIslandSnapshot(decodeArkSnapshot(raw as never)!, "town");
    const placed = placeTownAnimals(town.animals);
    const set = townColliderSet(placed.open, origin);
    const residents = town.animals.map((a) => ({id: a.id, model_slug: a.model_slug, length: displayLength(a), zone: a.zone}));
    const beds = townZooBeds(placed.town, residents, set, origin.x, origin.z);
    const byEnclosure = new Map<string, Bedded[]>();
    for (const r of residents) {
        const bed = beds.get(r.id);
        if (!bed) continue;
        const e = placed.town.get(r.id)!.enclosure!.id;
        const list = byEnclosure.get(e) ?? [];
        list.push({id: r.id, slug: r.model_slug, length: r.length, zone: r.zone, body: bodyOf(r.id, r.model_slug, r.length), bed});
        byEnclosure.set(e, list);
    }
    return {placed, set, residents, beds, byEnclosure};
}

function apart(byEnclosure: Map<string, Bedded[]>): void {
    for (const [e, list] of Array.from(byEnclosure)) {
        for (let i = 0; i < list.length; i++) {
            for (let j = i + 1; j < list.length; j++) {
                const a = list[i];
                const b = list[j];
                const pose = (r: Bedded) => ({x: r.bed.x, y: townHeight(r.bed.x - origin.x, r.bed.z - origin.z), z: r.bed.z, yaw: r.bed.heading, aloft: false, asleep: true});
                // (Each body widened by half the gap, less a centimetre: still touching nothing.)
                const wide = (r: Bedded) => ({...r.body, radius: r.body.radius + BED_GAP / 2 - 0.01});
                const depth = overlapOf(wide(a), pose(a), wide(b), pose(b)).depth;
                assert.equal(depth, 0, `${e}: ${a.slug} ${a.id.slice(0, 8)} and ${b.slug} ${b.id.slice(0, 8)} closer than ${BED_GAP} m`);
            }
        }
    }
}

function clearAndKept(t: ReturnType<typeof townBeds>): void {
    for (const [e, list] of Array.from(t.byEnclosure)) {
        for (const r of list) {
            const info = t.placed.town.get(r.id)!;
            const keep = penKeep(maskBox(info.enclosure!.mask), info.enclosureMargin!, origin.x, origin.z);
            assert.ok(inKeep(keep, r.bed.x, r.bed.z), `${e}: ${r.slug} ${r.id.slice(0, 8)} in its keep box`);
            const y = townHeight(r.bed.x - origin.x, r.bed.z - origin.z);
            // (Clear by the shed's eave too: its body 0.3 m longer each way still stands in nothing.)
            const longer = {...r.body, half: r.body.half + 0.3};
            assert.ok(bodyClear(t.set, longer, {x: r.bed.x, y, z: r.bed.z, yaw: r.bed.heading, aloft: false, asleep: true}, r.bed.x, r.bed.z), `${e}: ${r.slug} ${r.id.slice(0, 8)} clear`);
        }
    }
}

function sleepsThere(t: ReturnType<typeof townBeds>): void {
    const world = scheduleWorld(townWorldSampler(t.placed.open, origin, t.set));
    for (const [e, list] of Array.from(t.byEnclosure)) {
        for (const r of list) {
            const p = t.placed.places.get(r.id)!;
            const animal: ScheduleAnimal = {id: r.id, zone: r.zone as ScheduleAnimal["zone"], home: {x: p.x + origin.x, y: p.ground, z: p.z + origin.z}, length: r.length, sea: false, range: 10, kept: true, bed: r.bed};
            const roost = roostOf(world, behaviourProfile(r.slug), animal);
            // (A home placed on another stretch of the walk grid than its paddock's shed, a donkey's: the schedule's own
            // rule finds it a bed it can walk to, as before.)
            const r0 = bodyRadiusOf(animal, r.slug);
            if (world.nav.region(animal.home.x, animal.home.z, maxSlopeOf(animal), r0) !== world.nav.region(r.bed.x, r.bed.z, maxSlopeOf(animal), r0)) continue;
            assert.ok(Math.hypot(roost.x - r.bed.x, roost.z - r.bed.z) < 1e-6, `${e}: ${r.slug} ${r.id.slice(0, 8)} roosts on its bed (${Math.hypot(roost.x - r.bed.x, roost.z - r.bed.z).toFixed(2)} m off)`);
            assert.equal(roost.heading, r.bed.heading);
        }
    }
}

const fixture = townBeds(withArkIslandsFixture(base));

test("zoo beds (fixture): shed paddocks get beds, none overlapping, a gap between", () => {
    assert.ok(fixture.byEnclosure.size >= 1, "a shed paddock with a bed in it");
    apart(fixture.byEnclosure);
});

test("zoo beds (fixture): each inside its keep box and clear of what stands in the paddock, the shed most of all", () => clearAndKept(fixture));

test("zoo beds (fixture): the schedule sleeps each resident on its own bed, facing the way it lies", () => sleepsThere(fixture));

const LIVE = process.env.ARK_LIVE_SNAPSHOT ?? "public/ark-local/live.json";

test("zoo beds (live Ark): every ground sleeper of a shed paddock (11 in one mixed hoofstock paddock) has a bed of their own, apart and clear", {skip: !existsSync(LIVE)}, () => {
    const raw = JSON.parse(readFileSync(LIVE, "utf8"));
    const live = townBeds(raw.snapshot ?? raw);
    // (Every ground sleeper in a shed paddock has one: none left to pick its own from the three shade points.)
    const mixed = Array.from(live.byEnclosure.values()).filter((list) => new Set(list.map((r) => r.slug)).size > 1);
    const crowd = Math.max(...mixed.map((l) => l.length));
    assert.ok(crowd >= 8, `the biggest mixed bedded paddock has ${crowd}`);
    for (const r of live.residents) {
        const info = live.placed.town.get(r.id);
        if (info?.area !== "zoo" || !info.enclosure || info.enclosure.indoor || info.enclosureMargin === undefined || info.still || !bedsDown(r.model_slug)) continue;
        if (hasShed(info.enclosure)) assert.ok(live.beds.has(r.id), `${info.enclosure.id}: ${r.model_slug} ${r.id.slice(0, 8)} has a bed`);
    }
    apart(live.byEnclosure);
    clearAndKept(live);
    sleepsThere(live);
});
