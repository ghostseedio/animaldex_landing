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
 * On a tree with behaviour v2 (`spaceHomes` exported; ark-release from 2026-11-11) it mirrors that scene instead:
 *   - `wireSchedules`: each group member keeps to its leader through the schedule (`ScheduleGroup`), and predators'
 *     homes are spaced from their prey's (`spaceHomes`, the tree's own food links); followers no longer replay a pose;
 *   - `makeSched`: a species held off the water is not scheduled (`schedule-water.ts`);
 *   - `fromSchedule`: in the water a water species is drawn in its depth band;
 *   - `rigFor`: flight clips where the tree's rig rules let them play, the beat's own clip (graze, browse, scan,
 *     into and out of the water) where the rig has one, a watching grazer's head up;
 *   - pass C (`cameraPass`): the local reactive layer round a camera (head look, prey reacting and fleeing, variety).
 * Scene modules are imported dynamically so this file loads on any tree.
 */

import type {AuditFeatures, AuditModel, AuditSample, AuditSubject, CameraResult, CameraStop} from "./types";
import type {AuditFixture} from "./fixture";
import type {SceneData} from "./scene-data";

const GROUPED = new Set(["herd", "flock", "school", "troop", "pack", "group", "colony", "swarm"]);

/** A scene module the tree may not have (null then): the specifier is a variable, so older trees still load this file. */
async function optional<T>(specifier: string): Promise<T | null> {
    try {
        return (await import(specifier)) as T;
    } catch {
        return null;
    }
}

type Reactive = typeof import("@/ark-scene/reactive");
type ReactiveWorldModule = typeof import("@/ark-scene/reactive-world");
type IntelModule = typeof import("@/ark-scene/intelligence-profile");
type WaterModule = typeof import("@/ark-scene/schedule-water");
type FoodModule = typeof import("@/ark-scene/food-links");
type MapPlaceModule = {mapHabitatAt?: (animal: {model_slug: string; zone: string}, x: number, z: number) => boolean};
type RecipesModule = {wireRecipes?: (animals: Array<{animal: unknown; profile: unknown; slug: string; activity: unknown}>) => void};
type RigPlayerModule = {beatClip?: (beat: string | null | undefined, doing: string | null | undefined, has: (name: string) => boolean) => string | null};

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
    const water = await optional<WaterModule>("@/ark-scene/schedule-water");
    const food = await optional<FoodModule>("@/ark-scene/food-links");
    const reactiveModule = await optional<Reactive>("@/ark-scene/reactive");
    const reactiveWorld = await optional<ReactiveWorldModule>("@/ark-scene/reactive-world");
    const intel = await optional<IntelModule>("@/ark-scene/intelligence-profile");
    const {arkStats} = await import("@/ark-scene/stats");
    const rigPlayer = await optional<RigPlayerModule>("@/ark-scene/rig-player");
    const mapPlace = await optional<MapPlaceModule>("@/ark-scene/map/place");
    const recipes = await optional<RecipesModule>("@/ark-scene/behaviour-recipes");
    /** Behaviour v2 (groups through the schedule, spaced predators). */
    const v2 = typeof (schedule as Record<string, unknown>).spaceHomes === "function" && Boolean(food);

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
    const hawkers = new Map<string, boolean>();
    const hawks = (slug: string) => {
        let found = hawkers.get(slug);
        if (found === undefined) hawkers.set(slug, (found = Boolean(intel?.intelProfile(slug, null, arkStats({model_slug: slug} as never).intelligence).hunt.includes("aerial_hawk"))));
        return found;
    };
    fixture.animals.forEach((animal, i) => {
        const place = places.get(animal.id)!;
        const plan = data.modelPlan.get(animal.model_slug) ?? null;
        const body = arkBody(animal, plan);
        const sched = place.micro || place.burrow || (water && !water.onBehaviourSchedule(animal.model_slug)) ? null : {
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
            driver: sched ? "schedule" : place.micro ? "micro" : "burrow",
            hawker: hawks(animal.model_slug)
        });
    });
    holders.forEach((h, i) => {
        h.leader = subjects[i].leader ? index.get(subjects[i].leader!) ?? -1 : -1;
    });
    const ranks = new Map<string, number>();
    for (const animal of fixture.animals) ranks.set(animal.id, places.get(animal.id)!.rank ?? 1);
    function rankOf(i: number) {
        return ranks.get(subjects[i].id) ?? 1;
    }

    // Behaviour v2's wiring after a snapshot (index.ts `wireSchedules`): groups through the schedule, predators spaced.
    if (v2) {
        const onIt = holders.map((_h, i) => i).filter((i) => holders[i].sched);
        const sizes = new Map<number, number>();
        for (const i of onIt) {
            const li = holders[i].leader;
            if (li >= 0 && holders[li].sched) sizes.set(li, (sizes.get(li) ?? 1) + 1);
        }
        for (const i of onIt) {
            const own = holders[i].sched!;
            const li = holders[i].leader;
            const lead = li >= 0 && holders[li].sched && subjects[li].slug === subjects[i].slug && GROUPED.has(own.profile.social) ? li : -1;
            own.animal.group = lead >= 0 ? {leader: holders[lead].sched!.animal, profile: holders[lead].sched!.profile, activity: fixture.animals[lead].activity, rank: Math.max(rankOf(i), 1), size: sizes.get(lead) ?? 2} : null;
            // (The fixture's animals all arrived: none is young.)
            own.animal.young = false;
        }
        const nav = world.nav;
        const reach = new Map(onIt.map((i) => [subjects[i].id, schedule.rangeReach(holders[i].sched!.profile, holders[i].sched!.animal) + (sizes.has(i) ? schedule.groupSpread(subjects[i].length, sizes.get(i)!) : 0)]));
        const spaced = schedule.spaceHomes(
            onIt
                .filter((i) => !holders[i].sched!.animal.group)
                .map((i) => {
                    const own = holders[i].sched!;
                    const animal = fixture.animals[i];
                    // (The map's habitat too, where the tree has it: index.ts passes `mapHabitatAt`.)
                    const habitat = (x: number, z: number) => (mapPlace?.mapHabitatAt ? mapPlace.mapHabitatAt(animal, x, z) : true);
                    return {id: subjects[i].id, slug: subjects[i].slug, home: {x: own.animal.home.x, z: own.animal.home.z}, length: subjects[i].length, walkable: (x: number, z: number) => (own.profile.move === "swim" || own.profile.seabed ? nav.swimmable(x, z, 0.5) : nav.walkable(x, z) && habitat(x, z))};
                }),
            food!.eats,
            (id) => reach.get(id) ?? 3
        );
        for (const i of onIt) {
            const own = holders[i].sched!;
            const moved = spaced.get(subjects[i].id);
            if (!moved) continue;
            own.animal.home = {x: moved.home.x, y: Math.max(heightAt(moved.home.x, moved.home.z), 0), z: moved.home.z};
            own.animal.range = moved.range === null ? null : sizes.has(i) ? moved.range / 2 : moved.range;
            own.animal.prey = moved.prey;
        }
        for (const i of onIt) {
            const lead = holders[i].sched!.animal.group?.leader;
            const li = holders[i].leader;
            if (!lead || li < 0 || !spaced.has(subjects[li].id)) continue;
            holders[i].sched!.animal.home = {...lead.home};
            holders[i].sched!.animal.range = lead.range;
        }
        // Where each now lives (the spawn check reads it: the scene draws it there, on its schedule, from the first frame).
        for (const i of onIt) subjects[i].home = {...holders[i].sched!.animal.home};
        // Prey know the predators that could eat them (behaviour's shared-layer wariness), where the tree has it.
        const wire = onIt.map((i) => ({slug: subjects[i].slug, animal: holders[i].sched!.animal, profile: holders[i].sched!.profile, activity: fixture.animals[i].activity}));
        const wireThreats = (schedule as {wireThreats?: (list: typeof wire, eats: (p: string, q: string) => boolean) => void}).wireThreats;
        if (wireThreats) wireThreats(wire, food!.eats);
        schedule.forgetSchedules?.();
        // Who meets whom in the behaviour recipes (rivals, pairs), where the tree has them.
        recipes?.wireRecipes?.(wire);
    }

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
        if (leaderOk && !v2) {
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
    /** Whether the tree's rig rules let this species play a flight clip with the wings open (flap, glide, soar, hover, banks, the take-off held). */
    const wingsOpenCache = new Map<string, boolean>();
    const wingsCanOpen = (slug: string): boolean => {
        let open = wingsOpenCache.get(slug);
        if (open === undefined) wingsOpenCache.set(slug, (open = ["flap", "glide", "soar", "hover", "bank_l", "bank_r", "takeoff"].some((name) => Boolean(clip(slug, name)))));
        return open;
    };

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
            // One held off the water (not scheduled on v2): on its circle in the air, asleep or awake (the legacy flyer rule).
            if (aloftAlways && state.airborne) return {state: state.kind, doing: null, x: subject.home.x, y: Math.max(g, 0) + 12, z: subject.home.z, yaw: 0, aloft: true, moving: true, wingsOpen: wingsCanOpen(subject.slug), clip: null, headDown: false, inWater: false, raised: false};
            return {state: state.kind, doing: null, x: subject.home.x, y: subject.home.y, z: subject.home.z, yaw: 0, aloft: false, moving: false, wingsOpen: false, clip: state.asleep ? (clip(subject.slug, "idle") ? "idle" : null) : null, headDown: false, inWater: g < 0, raised: true};
        }
        const at = posed(i, epoch);
        const target = at.aloft ? 1 : 0;
        holder.air += (target - holder.air) * Math.min(dt * 6, 1);
        if (Math.abs(target - holder.air) < 0.002) holder.air = target;
        const state = behaviourState({activity: animal.activity, elevation, flyer, acting: false, visitor: false, reducedMotion: false, breather, aloftAlways, scheduled: {doing: at.doing, aloft: at.aloft}} as never);
        const ground = heightAt(at.x, at.z);
        // In the water a water species is drawn in its depth band (index.ts `fromSchedule`, `schedule-water.ts`); one in
        // its hole stays in it, at its place (`waterPose`).
        let x = at.x;
        let z = at.z;
        let y = at.y;
        // (Lane MA3: in the water any swimmer has a band, `swimDepth`, a coot's as a duck's; with none, an animal over water
        // stands on the bed, never on the surface. A tree from before MA3 has no swimDepth: its own band only.)
        const swimDepth = (sea as {swimDepth?: (slug: string, zone: string) => typeof depth}).swimDepth;
        const band = swimDepth ? swimDepth(animal.model_slug, animal.zone) : depth;
        if (water && depth && sea.waterMotion(depth) === "hole") {
            x = subject.home.x;
            z = subject.home.z;
            y = sea.fitInWater(sea.waterSpec(depth, heightAt(x, z), sea.depthSeed(animal.id), epoch, 0), subject.length * 0.6).base;
        } else if (water && water.inDepthBand(band, at, ground) && !(at as {act?: {own?: boolean}}).act?.own) {
            const breath = state.breathing ? sea.breathAt(sea.depthSeed(animal.id), epoch, state.asleep) : 0;
            y = water.scheduledWater(band!, ground, sea.depthSeed(animal.id), epoch, breath, subject.length * 0.6).base;
        } else if (swimDepth && !band && !at.aloft && ground < 0 && at.y >= ground - 0.01 && at.y <= 0.02) y = ground;
        const inWater = !at.aloft && (y < Math.max(heightAt(x, z), 0) - 0.01 || heightAt(x, z) < 0);
        // The rig player's choice (rigFor): no rig in the air; asleep its idle; by speed on the ground (walk/run); else idle.
        let chosen: string | null = null;
        // Its speed now (over the last quarter second; the audit samples far apart).
        const before = posed(i, epoch - 0.25);
        const speed = Math.hypot(at.x - before.x, at.z - before.z) / 0.25;
        if (!state.airborne && holder.air <= 0.001) {
            if (state.asleep) chosen = clip(subject.slug, "idle") ? "idle" : null;
            else if (water && band && inWater) chosen = sea.waterMotion(band) === "walk" ? (clip(subject.slug, "walk") ? "walk" : null) : sea.waterMotion(band) === "swim" ? (clip(subject.slug, "swim") ? "swim" : clip(subject.slug, "slither") ? "slither" : null) : sea.waterMotion(band) === "float" && clip(subject.slug, "paddle") ? "paddle" : clip(subject.slug, "idle") ? "idle" : null;
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
        // The schedule's beat picks its own clip where the rig has one (rig-player `beatClip`): graze is the head down.
        // (A watching grazer lifting its head is the reactive layer's, near the camera: pass C.)
        const beat = rigPlayer?.beatClip && !at.aloft && !state.asleep ? rigPlayer.beatClip(at.beat, at.doing, (name) => Boolean(clip(subject.slug, name))) : null;
        if (beat && (!chosen || chosen === "idle")) chosen = beat;
        // In the air: the wings open where the tree's rig rules let a flight clip play (flap, an open-wing loop, the
        // take-off's last frame held); else no wing motion at all (no bird has a wing shader).
        const wingsOpen = (at.aloft || state.airborne) && wingsCanOpen(subject.slug);
        if (wingsOpen) chosen = clip(subject.slug, "flap") ? "flap" : "glide";
        return {state: state.kind, doing: at.doing, x, y, z, yaw: at.yaw, aloft: at.aloft, moving: at.moving, wingsOpen, clip: chosen, headDown: chosen === "graze", inWater, raised: at.mode === "surface" || (!at.moving && Boolean(at.point))};
    };

    const features: AuditFeatures = {
        schedule: true,
        rigs: Boolean(manifest),
        flightClips: manifest ? Object.keys(manifest.species).some((slug) => ["flap", "glide", "takeoff"].some((name) => Boolean(clip(slug, name)))) : false,
        wingShaderSpecies: data.wingShaderSpecies,
        preyLook: {within: 6, predatorMoving: true, nearCameraOnly: 45},
        preyFlee: false,
        headLook: false,
        grazePose: false,
        spawnSeparation: false,
        individualVariation: false
    };
    /**
     * Pass C: the local reactive layer round a camera, as index.ts `stepReactive` feeds it, at 10 frames a second. At
     * each stop the camera follows the prey 12 m off (on the side away from the hunter, 3 m up) for 5 s of warm-up and
     * 30 s measured; the layer runs at the medium tier (the golden shots' and a phone's) on everyone near. Weather calm.
     */
    const cameraPass = reactiveModule && reactiveWorld && intel && v2
        ? (stops: CameraStop[], hunts: (hunter: string, prey: string) => boolean): CameraResult => {
              const started = Date.now();
              const FPS = 10;
              const WARM = 5;
              const SECONDS = 30;
              const tier = "medium" as const;
              const budget = reactiveModule.REACTIVE_BUDGET[tier];
              const queries = reactiveWorld.reactiveWorldQueries(sampler, budget.sightSamples);
              const intelCache = new Map<string, ReturnType<IntelModule["intelProfile"]>>();
              const intelFor = (slug: string) => {
                  let found = intelCache.get(slug);
                  if (!found) intelCache.set(slug, (found = intel.intelProfile(slug, null, arkStats({model_slug: slug} as never).intelligence)));
                  return found;
              };
              const REACT = new Set(["alert", "freeze", "flee", "startle", "threat_display", "play_dead", "shelter", "shield_young", "hide_behind_parent"]);
              const headAnimals = new Set<string>();
              const headTurned = new Set<string>();
              let agentFrames = 0;
              let turnedFrames = 0;
              let frames = 0;
              let groupFrames = 0;
              let groupAllSame = 0;
              const actions = new Map<string, number>();
              const huntRows: Array<{reacted: number | null; fled: boolean}> = [];
              let used = 0;
              for (const stop of stops) {
                  // (The layer runs only for scheduled animals, as `stepReactive` does: a micro or burrow prey is skipped.)
                  if (!holders[stop.prey].sched) continue;
                  used++;
                  const layer = new reactiveModule.ReactiveLayer({tier});
                  const t0 = stop.epoch - WARM;
                  // Who may come into the layer's reach in the stop: everyone within its radius and reach of the prey now.
                  const preyAt = sample(stop.prey, t0, 0);
                  const near: number[] = [];
                  for (let i = 0; i < subjects.length; i++) {
                      if (!holders[i].sched) continue;
                      if (i === stop.prey || i === stop.hunter) {
                          near.push(i);
                          continue;
                      }
                      const s = sample(i, t0, 0);
                      if (Math.hypot(s.x - preyAt.x, s.z - preyAt.z) < budget.radius + 12) near.push(i);
                  }
                  const huntOpen = new Map<string, {start: number; reacted: number | null; fled: boolean}>();
                  let inputsNow: import("@/ark-scene/reactive").ReactiveInput[] = [];
                  let indexNow = new Map<string, number>();
                  /** A prey animal with one of its hunters (awake, on the ground) within 25 m: when it first reacts, whether it flees. */
                  const trackHunt = (me: import("@/ark-scene/reactive").ReactiveInput, o: {action: string; looking: string | null}, id: string, t: number) => {
                      if (me.shared.aloft) return;
                      let hunterNear: string | null = null;
                      for (const other of inputsNow) {
                          if (other.id === id || other.asleep || other.shared.aloft || !hunts(other.slug, me.slug)) continue;
                          if (Math.hypot(other.shared.x - me.shared.x, other.shared.z - me.shared.z) <= 25) {
                              hunterNear = other.id;
                              break;
                          }
                      }
                      let row = huntOpen.get(id);
                      if (hunterNear && !row) huntOpen.set(id, (row = {start: t, reacted: null, fled: false}));
                      if (!row) return;
                      const looksAtHunter = o.looking !== null && indexNow.has(o.looking) && hunts(subjects[indexNow.get(o.looking)!].slug, me.slug);
                      if (row.reacted === null && (REACT.has(o.action) || looksAtHunter)) row.reacted = t - row.start;
                      if (o.action === "flee") row.fled = true;
                  };
                  let offset: {x: number; z: number} | null = null;
                  for (let f = 0; f <= (WARM + SECONDS) * FPS; f++) {
                      const t = t0 + f / FPS;
                      const dt = 1 / FPS;
                      const now = near.map((i) => ({i, s: sample(i, t, dt)}));
                      const prey = now.find((x) => x.i === stop.prey)!.s;
                      if (!offset) {
                          const hunter = now.find((x) => x.i === stop.hunter)?.s;
                          const ax = hunter ? prey.x - hunter.x : 1;
                          const az = hunter ? prey.z - hunter.z : 0;
                          const length = Math.hypot(ax, az) || 1;
                          offset = {x: (ax / length) * 12, z: (az / length) * 12};
                      }
                      const camera = {x: prey.x + offset.x, y: Math.max(heightAt(prey.x + offset.x, prey.z + offset.z), 0) + 3, z: prey.z + offset.z};
                      const inputs: import("@/ark-scene/reactive").ReactiveInput[] = [];
                      const indexOf = new Map<string, number>();
                      for (const {i, s} of now) {
                          if (Math.hypot(s.x - camera.x, s.z - camera.z) > budget.radius + budget.reach) continue;
                          const own = holders[i].sched!;
                          const io = intelFor(subjects[i].slug);
                          indexOf.set(subjects[i].id, i);
                          inputs.push({
                              id: subjects[i].id,
                              slug: subjects[i].slug,
                              plan: io.plan,
                              length: subjects[i].length,
                              size: own.profile.size,
                              dominance: own.profile.dominance,
                              social: own.profile.social,
                              diet: own.profile.diet,
                              intel: io,
                              asleep: s.state === "asleep",
                              acting: false,
                              parentId: null,
                              youngPlay: 0,
                              headHeight: subjects[i].length * 0.6 * 0.8,
                              shared: {x: s.x, y: s.y, z: s.z, yaw: s.yaw, moving: s.moving, aloft: s.aloft, doing: (s.doing ?? "rest") as never, spot: own.trip?.to.point ?? null}
                          });
                      }
                      inputsNow = inputs;
                      indexNow = indexOf;
                      const hours = hoursAt(t);
                      const out = layer.step(inputs, {now: t, dt, hours, night: daylightAt(hours).night, weather: {rain: 0, wind: 0.3, windDirection: 0, fog: 0, storm: 0}, camera, sight: queries.sight, refuge: queries.refuge});
                      // (Hunts are timed from the stop's first frame, the layer fresh; the rest is measured after the warm-up.)
                      const measured = f >= WARM * FPS;
                      if (measured) frames++;
                      const bySlug = new Map<string, string[]>();
                      const input = new Map(inputs.map((x) => [x.id, x]));
                      out.forEach((o, id) => {
                          const me = input.get(id);
                          if (!me || me.asleep || o.action === "off" || o.action === "asleep" || o.action === "aloft") return;
                          if (!measured) {
                              trackHunt(me, o, id, t);
                              return;
                          }
                          agentFrames++;
                          actions.set(o.action, (actions.get(o.action) ?? 0) + 1);
                          headAnimals.add(id);
                          if (o.headWeight > 0.15) {
                              turnedFrames++;
                              headTurned.add(id);
                          }
                          const list = bySlug.get(me.slug) ?? [];
                          list.push(o.action);
                          bySlug.set(me.slug, list);
                          trackHunt(me, o, id, t);
                      });
                      for (const list of Array.from(bySlug.values())) {
                          if (list.length < 3) continue;
                          groupFrames++;
                          if (new Set(list).size === 1) groupAllSame++;
                      }
                  }
                  for (const row of Array.from(huntOpen.values())) huntRows.push(row);
              }
              const pct = (n: number, d: number) => (d ? Math.round((1000 * n) / d) / 10 : null);
              const times = huntRows.filter((r) => r.reacted !== null).map((r) => r.reacted!).sort((a, b) => a - b);
              const reacted = times.length;
              const fled = huntRows.filter((r) => r.fled).length;
              return {
                  stops: used,
                  frames,
                  secondsPerStop: SECONDS,
                  tier,
                  heads: {animals: headAnimals.size, turned: headTurned.size, turnedPct: pct(headTurned.size, headAnimals.size), framesTurnedPct: pct(turnedFrames, agentFrames)},
                  hunts: {encounters: huntRows.length, reacted, fled, reactPct: pct(reacted, huntRows.length), fleePct: pct(fled, huntRows.length), medianSecondsToReact: times.length ? Math.round(times[Math.floor(times.length / 2)] * 10) / 10 : null},
                  variety: {groupFrames, allSame: groupAllSame, allSamePct: pct(groupAllSame, groupFrames)},
                  actions: Object.fromEntries(Array.from(actions.entries()).sort((a, b) => b[1] - a[1]).map(([k, n]) => [k, pct(n, agentFrames) ?? 0])),
                  ms: Date.now() - started
              };
          }
        : undefined;

    return {
        ...meta,
        subjects,
        features,
        heightAt,
        hoursAt,
        sample,
        attachCount: (tag, x, z, r) => sampler.attachPoints(tag as never, {x, z, r}).length,
        cameraPass
    };
}
