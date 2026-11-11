/**
 * The audit's model of a tree with the behaviour schedule (`ark-behaviour`
 * and everything built on it, e.g. `ark-release`): the scene's own pure
 * modules (placement, profiles, the schedule, the behaviour state, the rig
 * clip rules), plus faithful copies of the few lines that live inside the
 * scene's closure in `src/ark-scene/index.ts`:
 *   - `makeSched` (micro and burrow animals stay off the schedule);
 *   - `schedulePose` (a follower in a herd/flock/school/troop/pack/group/colony/swarm
 *     replays its leader's pose 0.4 + 0.3·rank s late, out to one side);
 *   - `stepSchedule` (`air` eases to the pose's aloft at dt·6);
 *   - `stateOf` (the schedule's doing, the breath cycle, held-off-water flyers);
 *   - `rigFor`'s clip choice (no rig in the air; asleep idle; walk/run by speed; else idle).
 * Scene modules are imported dynamically so this file loads on any tree.
 */

import type {AuditFeatures, AuditModel, AuditSample, AuditSubject} from "./types";
import type {AuditFixture} from "./fixture";
import type {SceneData} from "./scene-data";

const GROUPED = new Set(["herd", "flock", "school", "troop", "pack", "group", "colony", "swarm"]);

export async function scheduleModel(fixture: AuditFixture, data: SceneData, meta: {label: string; tree: string; commit: string}): Promise<AuditModel> {
    const schedule = await import("@/ark-scene/behaviour-schedule");
    const {worldSampler} = await import("@/ark-scene/world-sampler");
    const {behaviourProfile} = await import("@/ark-scene/behaviour-profile");
    const {behaviourState} = await import("@/ark-scene/behaviour-state");
    const {placeAnimals} = await import("@/ark-scene/placement");
    const {arkBody} = await import("@/ark-scene/stats");
    const {ZONE_SITES} = await import("@/ark-scene/world");
    const {islandHours} = await import("@/lib/ark-clock");
    const {daylightAt} = await import("@/lib/ark-daylight");
    const {ARK_FLYERS} = await import("@/ark-scene/flyers");
    const sea = await import("@/ark-scene/sea-depth");
    const rigClips = await import("@/ark-scene/rig-clips");

    const sampler = worldSampler();
    const world = schedule.scheduleWorld(sampler);
    const heightAt = (x: number, z: number) => sampler.heightAt(x, z);
    const hoursAt = (epoch: number) => islandHours(epoch * 1000, 0);
    const places = placeAnimals(fixture.animals);
    const manifest = data.rigManifest ? {species: data.rigManifest} : null;
    const clip = (slug: string, name: string) => rigClips.rigClip(manifest as never, slug, name);

    type Holder = {
        sched: {profile: ReturnType<typeof behaviourProfile>; animal: import("@/ark-scene/behaviour-schedule").ScheduleAnimal; trip: import("@/ark-scene/behaviour-schedule").Trip | null; lead: import("@/ark-scene/behaviour-schedule").Trip | null} | null;
        air: number;
        leader: number;
    };
    const subjects: AuditSubject[] = [];
    const holders: Holder[] = [];
    const index = new Map<string, number>();
    fixture.animals.forEach((animal, i) => {
        const place = places.get(animal.id)!;
        const plan = data.modelPlan.get(animal.model_slug) ?? null;
        const body = arkBody(animal, plan);
        const sched = place.micro || place.burrow ? null : {
            profile: behaviourProfile(animal.model_slug, plan),
            animal: {id: animal.id, zone: animal.zone, home: {x: place.x, y: place.ground, z: place.z}, length: body.display, sea: ZONE_SITES[animal.zone]?.kind === "sea"},
            trip: null,
            lead: null
        };
        index.set(animal.id, i);
        holders.push({sched, air: 0, leader: -1});
        subjects.push({
            id: animal.id,
            slug: animal.model_slug,
            profile: fixture.profileOf.get(animal.model_slug)!,
            modelPlan: plan,
            length: body.display,
            home: {x: place.x, y: place.ground, z: place.z},
            zone: animal.zone,
            leader: place.leader && place.leader !== animal.id ? place.leader : null,
            driver: sched ? "schedule" : place.micro ? "micro" : "burrow"
        });
    });
    holders.forEach((h, i) => {
        h.leader = subjects[i].leader ? index.get(subjects[i].leader!) ?? -1 : -1;
    });

    const tripFor = (holder: NonNullable<Holder["sched"]>, key: "trip" | "lead", profile: NonNullable<Holder["sched"]>["profile"], animal: NonNullable<Holder["sched"]>["animal"], activity: string | null | undefined, epoch: number) => {
        let trip = holder[key];
        if (!trip || epoch < trip.start || epoch >= trip.end) holder[key] = trip = schedule.tripAt(world, profile, animal, epoch, hoursAt, activity as never, trip);
        return trip;
    };

    const posed = (i: number, epoch: number) => {
        const own = holders[i].sched!;
        const subject = subjects[i];
        const li = holders[i].leader;
        const leaderHolder = li >= 0 ? holders[li] : null;
        const leaderOk = leaderHolder?.sched && subjects[li].slug === subject.slug && GROUPED.has(own.profile.social);
        if (leaderOk) {
            const rank = rankOf(i);
            const lag = 0.4 + 0.3 * rank;
            const trip = tripFor(own, "lead", leaderHolder!.sched!.profile, leaderHolder!.sched!.animal, fixture.animals[li].activity, epoch - lag);
            const at = schedule.poseOnTrip(world, trip, epoch - lag);
            const angle = at.yaw + Math.PI + (rank % 2 ? 1 : -1) * (0.5 + 0.25 * Math.floor(rank / 2));
            const d = (1 + 0.45 * Math.sqrt(rank)) * Math.max(subject.length, subjects[li].length) * 1.1;
            const x = at.x + Math.sin(angle) * d;
            const z = at.z + Math.cos(angle) * d;
            const ground = heightAt(x, z);
            const inWater = at.y < Math.max(heightAt(at.x, at.z), 0) - 0.01;
            const y = at.aloft ? at.y + ((rank % 3) - 1) * 0.5 : inWater ? Math.max(at.y, ground + 0.2) : Math.max(ground, 0);
            return {...at, x, y, z, doing: trip.doing as string, mode: trip.mode, running: trip.running, point: null as string | null};
        }
        const trip = tripFor(own, "trip", own.profile, own.animal, fixture.animals[i].activity, epoch);
        return {...schedule.poseOnTrip(world, trip, epoch), doing: trip.doing as string, mode: trip.mode, running: trip.running, point: trip.to.point};
    };
    const ranks = new Map<string, number>();
    for (const animal of fixture.animals) ranks.set(animal.id, places.get(animal.id)!.rank ?? 1);
    function rankOf(i: number) {
        return ranks.get(subjects[i].id) ?? 1;
    }

    const sample = (i: number, epoch: number, dt: number): AuditSample => {
        const holder = holders[i];
        const subject = subjects[i];
        const animal = fixture.animals[i];
        const hours = hoursAt(epoch);
        const elevation = daylightAt(hours).elevation;
        const depth = sea.speciesDepth(animal.model_slug, animal.zone);
        const breather = depth?.breathes && sea.waterMotion(depth) !== "float" ? {seed: sea.depthSeed(animal.id), clock: epoch} : null;
        const aloftAlways = Boolean(sea.heldOffWater?.(animal.model_slug));
        const flyer = ARK_FLYERS.has(animal.model_slug) && ZONE_SITES[animal.zone]?.kind !== "sea";
        if (!holder.sched) {
            const state = behaviourState({activity: animal.activity, elevation, flyer: false, acting: false, visitor: false, reducedMotion: false, breather, aloftAlways} as never);
            const g = heightAt(subject.home.x, subject.home.z);
            return {state: state.kind, doing: null, x: subject.home.x, y: subject.home.y, z: subject.home.z, yaw: 0, aloft: false, moving: false, wingsOpen: false, clip: state.asleep ? (clip(subject.slug, "idle") ? "idle" : null) : null, headDown: false, inWater: g < 0, raised: true};
        }
        const at = posed(i, epoch);
        const target = at.aloft ? 1 : 0;
        holder.air += (target - holder.air) * Math.min(dt * 6, 1);
        if (Math.abs(target - holder.air) < 0.002) holder.air = target;
        const state = behaviourState({activity: animal.activity, elevation, flyer, acting: false, visitor: false, reducedMotion: false, breather, aloftAlways, scheduled: {doing: at.doing, aloft: at.aloft}} as never);
        const ground = heightAt(at.x, at.z);
        const inWater = !at.aloft && (at.y < Math.max(ground, 0) - 0.01 || ground < 0);
        // The rig player's choice (rigFor): no rig in the air; asleep its idle; by speed on the ground (walk/run); else idle.
        let chosen: string | null = null;
        // Its speed now (over the last quarter second; the audit samples far apart).
        const before = posed(i, epoch - 0.25);
        const speed = Math.hypot(at.x - before.x, at.z - before.z) / 0.25;
        if (!state.airborne && holder.air <= 0.001) {
            if (state.asleep) chosen = clip(subject.slug, "idle") ? "idle" : null;
            else if (inWater && ZONE_SITES[animal.zone]?.kind === "sea") chosen = clip(subject.slug, "swim") ? "swim" : null;
            else {
                // Model units a second (the model is about 1 unit long): the player's own test against each clip's ground speed.
                const units = speed / Math.max(subject.length, 0.01);
                const walkName = clip(subject.slug, "walk") ? "walk" : clip(subject.slug, "slither") ? "slither" : clip(subject.slug, "hop") ? "hop" : null;
                const walk = walkName ? clip(subject.slug, walkName) : null;
                const run = clip(subject.slug, "run");
                if (run && walk?.ground_speed && units > walk.ground_speed * 1.6) chosen = "run";
                else if (walk?.ground_speed && units > walk.ground_speed * 0.3) chosen = walkName;
                else if (!walk && run?.ground_speed && units > run.ground_speed * 0.3) chosen = "run";
                else if (clip(subject.slug, "idle")) chosen = "idle";
            }
        }
        // Flight clips are never played (rig-clips FLIGHT_CLIPS), and no bird has a wing shader: wings stay as modelled.
        const wingsOpen = Boolean(chosen && (chosen === "flap" || chosen === "glide"));
        return {state: state.kind, doing: at.doing, x: at.x, y: at.y, z: at.z, yaw: at.yaw, aloft: at.aloft, moving: at.moving, wingsOpen, clip: chosen, headDown: false, inWater, raised: at.mode === "surface" || (!at.moving && Boolean(at.point))};
    };

    const features: AuditFeatures = {
        schedule: true,
        rigs: Boolean(manifest),
        flightClips: !["flap", "glide", "takeoff", "land"].every((name) => rigClips.FLIGHT_CLIPS?.has(name)),
        wingShaderSpecies: data.wingShaderSpecies,
        preyLook: {within: 6, predatorMoving: true, nearCameraOnly: 45},
        preyFlee: false,
        headLook: false,
        grazePose: false,
        spawnSeparation: false,
        individualVariation: false
    };
    return {
        ...meta,
        subjects,
        features,
        heightAt,
        hoursAt,
        sample,
        attachCount: (tag, x, z, r) => sampler.attachPoints(tag as never, {x, z, r}).length
    };
}
