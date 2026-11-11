/**
 * The audit's model of a tree WITHOUT the behaviour schedule (live main
 * 76a4f5d1, what animaldex.app/ark shows): its own placement, stats and
 * daylight modules, plus a faithful copy of how its scene closure moves an
 * animal (`src/ark-scene/index.ts` at 76a4f5d1, `pose()` ~l.1123–1210 and the
 * loop/air updates ~l.1230–1245):
 *   - awake = the species' activity against the sun (the same for every
 *     animal of a species at any moment);
 *   - only the 7 `ARK_FLYERS` species fly: while awake, a circle of radius
 *     6 + 6·phase at 9–15 m over their spot; a cluster follower flies on its
 *     leader's circle, 0.22·rank behind;
 *   - sea swimmers loop about their spot; everyone else stands on its spot
 *     (canopy, microhabitat and burrow animals keep their local motion about
 *     their spot, modelled here as the spot);
 *   - no rigs (`ARK_RIG_MANIFEST` is null), no bird has a wing shader motion.
 * Scene modules are imported dynamically so this file loads on any tree.
 */

import type {AuditFeatures, AuditModel, AuditSample, AuditSubject} from "./types";
import type {AuditFixture} from "./fixture";
import type {SceneData} from "./scene-data";

export async function legacyModel(fixture: AuditFixture, data: SceneData, meta: {label: string; tree: string; commit: string}): Promise<AuditModel> {
    const {placeAnimals} = await import("@/ark-scene/placement");
    const {arkBody, loopPace} = await import("@/ark-scene/stats");
    const {heightAt, ZONE_SITES} = await import("@/ark-scene/world");
    const {isAwake, daylightAt} = await import("@/lib/ark-daylight");
    const {ARK_FLYERS} = await import("@/ark-scene/flyers");
    const {SWIMMING_PLANS} = await import("@/ark-scene/sizes");
    const {speciesLayer} = await import("@/ark-scene/layers");

    const places = placeAnimals(fixture.animals);
    const phaseOf = (id: string) => {
        let h = 2166136261;
        for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
        return ((h >>> 0) % 10000) / 10000;
    };
    const hoursAt = (epoch: number) => (((epoch / 3600) % 24) + 24) % 24;

    type Entry = {phase: number; pace: number; loop: number; air: number; rest: number; flyer: boolean; swimmer: boolean; leader: number; rank: number; floor: boolean};
    const subjects: AuditSubject[] = [];
    const entries: Entry[] = [];
    const index = new Map<string, number>();
    fixture.animals.forEach((animal, i) => {
        const place = places.get(animal.id)!;
        const plan = data.modelPlan.get(animal.model_slug) ?? null;
        const body = arkBody(animal, plan);
        const phase = phaseOf(animal.id);
        const sea = ZONE_SITES[animal.zone]?.kind === "sea";
        const flyer = ARK_FLYERS.has(animal.model_slug) && !sea;
        const swimmer = sea && SWIMMING_PLANS.has(plan ?? "");
        const floor = sea && speciesLayer(animal.model_slug).mode === "floor";
        index.set(animal.id, i);
        entries.push({phase, pace: loopPace(animal), loop: phase * Math.PI * 2, air: flyer ? 1 : 0, rest: 0, flyer, swimmer, leader: -1, rank: place.rank ?? 1, floor});
        subjects.push({
            id: animal.id,
            slug: animal.model_slug,
            profile: fixture.profileOf.get(animal.model_slug)!,
            modelPlan: plan,
            length: body.display,
            home: {x: place.x, y: place.ground, z: place.z},
            zone: animal.zone,
            leader: place.leader && place.leader !== animal.id ? place.leader : null,
            driver: place.micro ? "micro" : place.canopy ? "canopy" : place.burrow ? "burrow" : flyer ? "flyer-circle" : swimmer ? "swim-loop" : "spot"
        });
    });
    entries.forEach((e, i) => {
        e.leader = subjects[i].leader ? index.get(subjects[i].leader!) ?? -1 : -1;
    });
    const placeOf = (i: number) => places.get(fixture.animals[i].id)!;

    const sample = (i: number, epoch: number, dt: number): AuditSample => {
        const e = entries[i];
        const animal = fixture.animals[i];
        const place = placeOf(i);
        const elevation = daylightAt(hoursAt(epoch)).elevation;
        const awake = isAwake(animal.activity ?? null, elevation);
        // Asleep eases in (dt·1.5); loops slow almost to a stop asleep; a flyer's air follows awake at 0.02 a frame (60 fps).
        e.rest += ((awake ? 0 : 1) - e.rest) * Math.min(1 - Math.exp(-1.5 * dt), 1);
        const pace = 1 - 0.85 * e.rest;
        if (e.swimmer) e.loop += dt * (0.05 + e.phase * 0.05) * (e.phase > 0.5 ? 1 : -1) * pace * e.pace;
        else if (e.air > 0.001) e.loop += dt * (0.16 + e.phase * 0.08) * pace * e.pace;
        if (e.flyer) e.air += ((awake ? 1 : 0) - e.air) * (1 - Math.pow(0.98, dt * 60));
        const state = !awake ? "asleep" : e.flyer ? "flying" : "awake";
        if (e.flyer && e.air > 0.001 && !place.micro && !place.burrow) {
            const lead = e.leader >= 0 && entries[e.leader].air > 0.5 ? entries[e.leader] : null;
            const owner = lead ?? e;
            const radius = 6 + owner.phase * 6;
            const angle = lead ? lead.loop - 0.22 * e.rank : e.loop;
            const t = epoch;
            const altitude = 9 + owner.phase * 6 + Math.sin(t * 0.4 + e.phase * 7) * 0.8 + (lead ? 0.8 : 0);
            const centre = lead ? placeOf(e.leader) : place;
            const ax = centre.x + Math.cos(angle) * radius - radius;
            const az = centre.z + Math.sin(angle) * radius;
            const k = e.air < 0.5 ? 2 * e.air * e.air : 1 - Math.pow(-2 * e.air + 2, 2) / 2;
            const x = place.x + (ax - place.x) * k;
            const z = place.z + (az - place.z) * k;
            const y = Math.max(place.ground, 0) + altitude * k;
            const yaw = Math.atan2(-Math.sin(angle), Math.cos(angle));
            return {state, doing: null, x, y, z, yaw, aloft: k > 0.5, moving: true, wingsOpen: false, clip: null, headDown: false, inWater: false, raised: false};
        }
        if (e.swimmer) {
            const lead = e.leader >= 0 ? entries[e.leader] : null;
            const follower = lead ? e.rank : 0;
            const owner = lead ?? e;
            const direction = owner.phase > 0.5 ? 1 : -1;
            const radius = 2.2 + owner.phase * 3 + subjects[lead ? e.leader : i].length * 0.6 + (follower ? ((follower % 3) - 1) * 0.9 : 0);
            const angle = lead ? lead.loop - direction * follower * (0.1 + subjects[i].length * 0.04) : e.loop;
            const centre = lead ? placeOf(e.leader) : place;
            const x = centre.x + Math.cos(angle) * radius;
            const z = centre.z + Math.sin(angle) * radius;
            const yaw = Math.atan2(-Math.sin(angle) * direction, Math.cos(angle) * direction);
            return {state, doing: null, x, y: -0.5, z, yaw, aloft: false, moving: true, wingsOpen: false, clip: null, headDown: false, inWater: true, raised: false};
        }
        let base = place.ground;
        if (place.water && place.ground < -0.45) base = -0.3;
        else if (place.water) base = Math.max(place.ground, -0.3);
        const inWater = base < Math.max(place.ground, 0) - 0.01 || place.ground < 0;
        return {state, doing: null, x: place.x, y: base, z: place.z, yaw: place.yaw, aloft: false, moving: false, wingsOpen: false, clip: null, headDown: false, inWater, raised: Boolean(place.canopy || place.micro)};
    };

    const features: AuditFeatures = {
        schedule: false,
        rigs: false,
        flightClips: false,
        wingShaderSpecies: data.wingShaderSpecies,
        preyLook: null,
        preyFlee: false,
        headLook: false,
        grazePose: false,
        spawnSeparation: false,
        individualVariation: false
    };
    return {...meta, subjects, features, heightAt, hoursAt, sample, attachCount: null};
}
