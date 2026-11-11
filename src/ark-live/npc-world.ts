/**
 * Phase 2 (design §3.5): `ark-live`'s own copy of the shared behaviour schedule, so the server knows where every NPC
 * is drawn and can work out, once for everyone, how the animals near a controlled one react to it.
 *
 * Built from the public snapshot the way the scene builds its schedules (`index.ts` makeSched and wireSchedules; the
 * behaviour audit's headless twin, `src/lib/ark-audit/model-schedule.ts`, does the same): the server's placement, each
 * schedule animal (home, length, sea, thrive, its roost), groups through the schedule, predators spaced from their prey,
 * threats and recipes wired. Released animals follow their stored plans, then their home overrides, as the scene does.
 *
 * Pure (no Node, no DOM); heavy to build (the walk grid and places: about a second on a desktop core), cheap to ask.
 */

import {forgetSchedules, groupSpread, poseOnTrip, rangeReach, scheduleWorld, spaceHomes, tripAt, wireThreats, withLazyRoost, type ScheduleAnimal, type ScheduleWorld, type Trip} from "@/ark-scene/behaviour-schedule";
import {behaviourProfile, type ArkBehaviourProfile} from "@/ark-scene/behaviour-profile";
import {placeAnimals, type Placement} from "@/ark-scene/placement";
import {mapHabitatAt, onSchedule, scheduleRoost} from "@/ark-scene/map/place";
import {onBehaviourSchedule} from "@/ark-scene/schedule-water";
import {eats} from "@/ark-scene/food-links";
import {wireRecipes} from "@/ark-scene/behaviour-recipes";
import {arkBody, arkStats} from "@/ark-scene/stats";
import {arkThriveOf} from "@/ark-scene/thrive";
import {ZONE_SITES} from "@/ark-scene/world";
import {intelProfile} from "@/ark-scene/intelligence-profile";
import {islandHours} from "@/lib/ark-clock";
import type {ReactiveInput} from "@/ark-scene/reactive";
import type {ArkWorldSampler} from "@/ark-scene/world-sampler";
import type {ArkAnimal} from "@/ark-scene/types";
import {evalPlan, type ReleasePlan} from "@/ark-live/plan-eval";
import type {HomeOverride} from "@/ark-live/release";

const GROUPED = new Set(["herd", "flock", "school", "troop", "pack", "group", "colony", "swarm"]);

type Holder = {animal: ArkAnimal; place: Placement; profile: ArkBehaviourProfile; sched: ScheduleAnimal; trip: Trip | null; length: number; leader: string | null};

export type NpcPose = {x: number; y: number; z: number; yaw: number; moving: boolean; aloft: boolean; doing: string; spot: string | null};

export type Released = {plan: ReleasePlan; home: HomeOverride | null};

export class NpcWorld {
    readonly world: ScheduleWorld;
    private readonly holders = new Map<string, Holder>();
    private readonly cells = new Map<string, string[]>();
    private released = new Map<string, Released>();
    readonly builtMs: number;

    constructor(animals: ArkAnimal[], private readonly sampler: ArkWorldSampler, now: () => number = Date.now) {
        const started = now();
        this.world = scheduleWorld(sampler);
        const places = placeAnimals(animals);
        for (const animal of animals) {
            const place = places.get(animal.id);
            if (!place || !onSchedule(place, animal.model_slug) || !onBehaviourSchedule(animal.model_slug)) continue;
            const length = arkBody(animal).display;
            const sched = withLazyRoost(
                {id: animal.id, zone: animal.zone, home: {x: place.x, y: place.ground, z: place.z}, length, sea: ZONE_SITES[animal.zone]?.kind === "sea", thrive: arkThriveOf(animal)},
                () => scheduleRoost(place, animal.zone)
            );
            this.holders.set(animal.id, {animal, place, profile: behaviourProfile(animal.model_slug), sched, trip: null, length, leader: place.leader && place.leader !== animal.id ? place.leader : null});
        }
        this.wire();
        for (const [id, h] of Array.from(this.holders)) {
            const key = NpcWorld.key(h.sched.home.x, h.sched.home.z);
            const list = this.cells.get(key);
            if (list) list.push(id);
            else this.cells.set(key, [id]);
        }
        this.builtMs = now() - started;
    }

    private static key(x: number, z: number): string {
        return `${Math.floor(x / 32)},${Math.floor(z / 32)}`;
    }

    /** Groups through the schedule, predators spaced from their prey, threats and recipes (index.ts wireSchedules). */
    private wire(): void {
        const list = Array.from(this.holders.values());
        const sizes = new Map<string, number>();
        for (const h of list) if (h.leader && this.holders.has(h.leader)) sizes.set(h.leader, (sizes.get(h.leader) ?? 1) + 1);
        for (const h of list) {
            const lead = h.leader ? this.holders.get(h.leader) : undefined;
            const ok = lead && lead.animal.model_slug === h.animal.model_slug && GROUPED.has(h.profile.social);
            h.sched.group = ok ? {leader: lead!.sched, profile: lead!.profile, activity: lead!.animal.activity, rank: Math.max(h.place.rank ?? 1, 1), size: sizes.get(lead!.animal.id) ?? 2} : null;
            h.sched.young = false;
        }
        const nav = this.world.nav;
        const reach = new Map(list.map((h) => [h.animal.id, rangeReach(h.profile, h.sched) + (sizes.has(h.animal.id) ? groupSpread(h.length, sizes.get(h.animal.id)!) : 0)]));
        const spaced = spaceHomes(
            list.filter((h) => !h.sched.group).map((h) => ({
                id: h.animal.id,
                slug: h.animal.model_slug,
                home: {x: h.sched.home.x, z: h.sched.home.z},
                length: h.length,
                walkable: (x: number, z: number) => (h.profile.move === "swim" || h.profile.seabed ? nav.swimmable(x, z, 0.5) : h.profile.move === "fly" ? this.sampler.heightAt(x, z) > 0.05 && mapHabitatAt(h.animal, x, z, 5) : nav.walkable(x, z) && mapHabitatAt(h.animal, x, z, 5))
            })),
            eats,
            (id) => reach.get(id) ?? 3
        );
        for (const h of list) {
            const moved = spaced.get(h.animal.id);
            if (!moved) continue;
            h.sched.home = {x: moved.home.x, y: Math.max(this.sampler.heightAt(moved.home.x, moved.home.z), 0), z: moved.home.z};
            h.sched.range = moved.range === null ? null : sizes.has(h.animal.id) ? moved.range / 2 : moved.range;
            h.sched.prey = moved.prey;
        }
        for (const h of list) {
            const lead = h.sched.group?.leader;
            if (!lead || !h.leader || !spaced.has(h.leader)) continue;
            h.sched.home = {...lead.home};
            h.sched.range = lead.range;
        }
        const wire = list.map((h) => ({slug: h.animal.model_slug, animal: h.sched, profile: h.profile, activity: h.animal.activity}));
        wireThreats(wire, eats);
        forgetSchedules();
        wireRecipes(wire);
    }

    /** The stored records of released animals (their plans, then their home overrides). */
    setReleased(records: Map<string, Released>): void {
        this.released = records;
        for (const [id, rec] of Array.from(records)) {
            const h = this.holders.get(id);
            if (h && rec.home && typeof rec.home.x === "number" && typeof rec.home.z === "number") {
                h.sched = {...h.sched, home: {x: rec.home.x, y: Math.max(this.sampler.heightAt(rec.home.x, rec.home.z), 0), z: rec.home.z}};
                h.trip = null;
            }
        }
    }

    has(id: string): boolean {
        return this.holders.has(id);
    }

    size(): number {
        return this.holders.size;
    }

    slugOf(id: string): string | null {
        return this.holders.get(id)?.animal.model_slug ?? null;
    }

    /** NPCs whose homes are within r (plus their own ranging) of a point: the candidates for a hot area. */
    candidates(x: number, z: number, r: number): string[] {
        const out: string[] = [];
        const span = Math.ceil((r + 40) / 32);
        const cx = Math.floor(x / 32);
        const cz = Math.floor(z / 32);
        for (let i = -span; i <= span; i++) for (let j = -span; j <= span; j++) for (const id of this.cells.get(`${cx + i},${cz + j}`) ?? []) out.push(id);
        return out;
    }

    /** Where its schedule (or its release plan) has it now, on every viewer the same. */
    poseAt(id: string, epochSeconds: number): NpcPose | null {
        const h = this.holders.get(id);
        if (!h) return null;
        const rec = this.released.get(id);
        if (rec) {
            const p = evalPlan(rec.plan, epochSeconds * 1000);
            if (p && !p.done) return {x: p.x, y: Math.max(this.sampler.heightAt(p.x, p.z), 0), z: p.z, yaw: p.yaw, moving: p.moving, aloft: p.mode === 4, doing: "wander", spot: null};
        }
        const hoursAt = (epoch: number) => islandHours(epoch * 1000, 0);
        let trip = h.trip;
        if (!trip || epochSeconds < trip.start || epochSeconds >= trip.end) h.trip = trip = tripAt(this.world, h.profile, h.sched, epochSeconds, hoursAt, h.animal.activity, trip);
        const at = poseOnTrip(this.world, trip, epochSeconds);
        return {x: at.x, y: at.y, z: at.z, yaw: at.yaw, moving: at.moving, aloft: at.aloft, doing: trip.doing, spot: trip.to.point};
    }

    /** The reactive layer's input for an NPC at a pose (index.ts stepReactive's, without the camera and the young). */
    reactiveInput(id: string, pose: NpcPose): ReactiveInput | null {
        const h = this.holders.get(id);
        if (!h) return null;
        const stats = arkStats(h.animal);
        const intel = intelProfile(h.animal.model_slug, null, stats.intelligence);
        return {
            id,
            slug: h.animal.model_slug,
            plan: intel.plan,
            length: h.length,
            size: h.profile.size,
            speed: h.profile.speed,
            gait: h.profile.gait,
            dominance: h.profile.dominance,
            social: h.profile.social,
            diet: h.profile.diet,
            intel,
            asleep: pose.doing === "sleep",
            acting: false,
            parentId: null,
            youngPlay: 0,
            headHeight: h.length * 0.5,
            sessile: h.profile.move === "sessile" && intel.plan === "other",
            watched: false,
            shared: {x: pose.x, y: pose.y, z: pose.z, yaw: pose.yaw, moving: pose.moving, aloft: pose.aloft, doing: pose.doing as never, spot: pose.spot}
        };
    }
}
