/**
 * The Ark's motion headless, for the collision checks (motion pass L5): a snapshot laid out and wired as the scene
 * lays it out and wires it (`index.ts` setSnapshot, makeSched, wireSchedules), so the poses measured are the poses
 * every viewer's scene draws from: the behaviour schedule's (with its recipe episodes), the hamlet residents' out and
 * door beats, and the collisions' own layer (`collide/`) on top when it is on.
 *
 * Nothing here is the scene's closure: it is the same pure modules, called in the same order.
 */

import {placeAnimals, type Placement} from "@/ark-scene/placement";
import {hamletHash, hamletPlotsFor, hamletState, plotSpots, type HamletResident} from "@/ark-scene/map/hamlet";
import {doorWalkAt} from "@/ark-scene/collide/routes";
import {mapHabitatAt, onSchedule, scheduleRoost} from "@/ark-scene/map/place";
import {setAttachHomePlots} from "@/ark-scene/sampler";
import {setBehaviourHomePlots, worldSampler} from "@/ark-scene/world-sampler";
import {behaviourProfile, type ArkBehaviourProfile} from "@/ark-scene/behaviour-profile";
import {forgetSchedules, groupSpread, rangeReach, scheduleWorld, spaceHomes, wireThreats, withLazyRoost, type HoursAt, type ScheduleAnimal, type ScheduleGroup, type ScheduleWorld} from "@/ark-scene/behaviour-schedule";
import {sexLook, wireRecipes} from "@/ark-scene/behaviour-recipes";
import {onBehaviourSchedule} from "@/ark-scene/schedule-water";
import {eats} from "@/ark-scene/food-links";
import {arkBody} from "@/ark-scene/stats";
import {arkThriveOf} from "@/ark-scene/thrive";
import {ZONE_SITES} from "@/ark-scene/world";
import {islandHours} from "@/lib/ark-clock";
import {bodyShape, type BodyShape} from "@/ark-scene/collide/bodies";
import type {ArkAnimal} from "@/ark-scene/types";

const GROUPED = new Set(["herd", "flock", "school", "troop", "pack", "group", "colony", "swarm"]);

export type SimAnimal = {
    a: ArkAnimal;
    place: Placement;
    profile: ArkBehaviourProfile;
    /** Its schedule animal (null: off the schedule, as the scene's makeSched leaves it). */
    sched: ScheduleAnimal | null;
    /** A hamlet resident (out on its plot's spots and through its door: `map/hamlet.ts`). */
    resident: boolean;
    /** Its drawn length (m: arkBody's display times its sex's scale) and its body at that length. */
    length: number;
    body: BodyShape;
};

export type Sim = {world: ScheduleWorld; animals: SimAnimal[]; residents: HamletResident[]; hoursAt: HoursAt};

/** The island clock the scene keeps (`index.ts` scheduleHours, no pinned hour). */
export const simHours: HoursAt = (epoch) => islandHours(epoch * 1000, 0);

/**
 * Lay out and wire a snapshot's animals as the scene does. `planOf` gives a species' body plan as its model's
 * `ark.json` says (the scene's library); without it the plan is the behaviour profile's guess.
 */
export function buildSim(list: ArkAnimal[], options: {planOf?: (slug: string) => string | null; arkDay?: number | null} = {}): Sim {
    const plots = hamletPlotsFor(list);
    setAttachHomePlots(plots);
    setBehaviourHomePlots(plots);
    forgetSchedules();
    const places = placeAnimals(list);
    const world = scheduleWorld(worldSampler());
    const animals: SimAnimal[] = list.map((a) => {
        const place = places.get(a.id)!;
        const plan = options.planOf?.(a.model_slug) ?? null;
        const body = arkBody(a, plan);
        const length = body.display * sexLook(a.id, a.model_slug).scale;
        const profile = behaviourProfile(a.model_slug, plan ?? undefined);
        const scheduled = onSchedule(place, a.model_slug) && onBehaviourSchedule(a.model_slug);
        const sched = scheduled ? withLazyRoost({id: a.id, zone: a.zone, home: {x: place.x, y: place.ground, z: place.z}, length: body.display, sea: ZONE_SITES[a.zone]?.kind === "sea", thrive: arkThriveOf(a)}, () => scheduleRoost(place, a.zone)) : null;
        return {a, place, profile, sched, resident: Boolean(place.hamlet), length, body: bodyShape(a.model_slug, length)};
    });
    // index.ts wireSchedules: groups to their leaders, predators spaced from their prey, threats, recipes, the young.
    const byId = new Map(animals.map((s) => [s.a.id, s]));
    const onIt = animals.filter((s) => s.sched);
    const sizes = new Map<SimAnimal, number>();
    const leaderOf = (s: SimAnimal) => (s.place.leader && s.place.leader !== s.a.id ? byId.get(s.place.leader) ?? null : null);
    for (const s of onIt) {
        const lead = leaderOf(s);
        if (lead?.sched) sizes.set(lead, (sizes.get(lead) ?? 1) + 1);
    }
    const groups = new Map<SimAnimal, ScheduleGroup | null>();
    for (const s of onIt) {
        const lead = leaderOf(s);
        const ok = lead && lead.sched && lead.a.model_slug === s.a.model_slug && GROUPED.has(s.profile.social);
        groups.set(s, ok ? {leader: lead!.sched!, profile: lead!.profile, activity: lead!.a.activity, rank: Math.max(s.place.rank ?? 1, 1), size: sizes.get(lead!) ?? 2} : null);
    }
    const nav = world.nav;
    const radius = new Map(onIt.map((s) => [s.a.id, rangeReach(s.profile, s.sched!) + (sizes.has(s) ? groupSpread(s.body.length, sizes.get(s)!) : 0)]));
    const spaced = spaceHomes(
        onIt.filter((s) => !groups.get(s)).map((s) => ({id: s.a.id, slug: s.a.model_slug, home: {x: s.sched!.home.x, z: s.sched!.home.z}, length: s.sched!.length, walkable: (x: number, z: number) => (s.profile.move === "swim" || s.profile.seabed ? nav.swimmable(x, z, 0.5) : s.profile.move === "fly" ? world.sampler.heightAt(x, z) > 0.05 && mapHabitatAt(s.a, x, z, 5) : nav.walkable(x, z) && mapHabitatAt(s.a, x, z, 5))})),
        eats,
        (id) => radius.get(id) ?? 3
    );
    for (const s of onIt) {
        s.sched!.group = groups.get(s) ?? null;
        const age = options.arkDay != null && typeof s.a.born_ark_day === "number" ? options.arkDay - s.a.born_ark_day : null;
        s.sched!.young = s.a.origin === "born" && age !== null && age < 90;
    }
    for (const s of onIt) {
        const moved = spaced.get(s.a.id);
        if (!moved) continue;
        s.sched!.home = {x: moved.home.x, y: Math.max(world.sampler.heightAt(moved.home.x, moved.home.z), 0), z: moved.home.z};
        s.sched!.range = moved.range === null ? null : sizes.has(s) ? moved.range / 2 : moved.range;
        s.sched!.prey = moved.prey;
    }
    for (const s of onIt) {
        const lead = s.sched!.group?.leader;
        const leader = leaderOf(s);
        if (!lead || !leader || !spaced.has(leader.a.id)) continue;
        s.sched!.home = {...lead.home};
        s.sched!.range = lead.range;
    }
    wireThreats(onIt.map((s) => ({slug: s.a.model_slug, animal: s.sched!, profile: s.profile, activity: s.a.activity})), eats);
    forgetSchedules();
    wireRecipes(onIt.map((s) => ({animal: s.sched!, profile: s.profile, slug: s.a.model_slug, activity: s.a.activity})));
    const residents = animals.filter((s) => s.resident).map((s) => ({id: s.a.id, slug: s.a.model_slug, length: arkBody(s.a).metres, plot: s.place.hamlet!.plot}));
    return {world, animals, residents, hoursAt: simHours};
}

/**
 * A hamlet resident's spot now as the scene draws it (`index.ts` pose: out on its spot, through its door, else in). With
 * `routed`, a door beat follows its walk round the house, the fences and the props (`collide/routes.ts`), as the scene
 * does with the collisions on; else the straight line the scene drew before.
 */
export function residentAt(sim: Sim, s: SimAnimal, epoch: number, routed = false): {x: number; z: number; yaw: number; out: boolean; moving: boolean} {
    const state = hamletState(sim.residents, epoch, sim.hoursAt);
    const beat = state.beats.get(s.a.id);
    const out = state.out.get(s.a.id);
    const plot = s.place.hamlet!.plot;
    const door = plotSpots(plot).door;
    if (beat) {
        if (routed) {
            const at = doorWalkAt(sim.world.nav, beat.from, beat.to, s.body.radius, beat.t);
            return {x: at.x, z: at.z, yaw: at.yaw, out: true, moving: true};
        }
        return {x: beat.from.x + (beat.to.x - beat.from.x) * beat.t, z: beat.from.z + (beat.to.z - beat.from.z) * beat.t, yaw: Math.atan2(beat.to.x - beat.from.x, beat.to.z - beat.from.z), out: true, moving: true};
    }
    if (out) return {x: out.at.x, z: out.at.z, yaw: plot.rotation + ((hamletHash(s.a.id) >>> 5) % 628) / 100, out: true, moving: false};
    return {x: door.x, z: door.z, yaw: plot.rotation, out: false, moving: false};
}
