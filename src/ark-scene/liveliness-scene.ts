/**
 * The liveliness wiring in the scene (docs/ark/liveliness-wiring.md): the
 * shared clock's weather, tide, dawn and dusk, and each animal's age, carried
 * through to what is drawn and heard. `index.ts` holds one of these and calls
 * it at a few points (the environment, each animal's schedule pose, its
 * drawn length, each drawn animal, and once a frame); everything else is here.
 *
 * Visual and audio only, and shared: every decision comes from the moment,
 * the island clock's weather and tide, and ids (`src/lib/ark-liveliness.ts`).
 * Nothing here decides an arrival, a meal, a birth, a death or a score.
 */

import {Color, Group, Vector3, type Fog, type PerspectiveCamera, type WebGLRenderer} from "three";
import {ArkAudio, type ArkAudioAnimal, type ArkAudioBed} from "@/ark-scene/ark-audio";
import {selectAmbientBeds} from "@/ark-scene/ambient-beds-stub";
import {sizeOf} from "@/ark-scene/ark-variation";
import type {QualityTier} from "@/ark-scene/post";
import {attachPoints, type ArkEnvironment} from "@/ark-scene/sampler";
import {Traces, TRACE_WITHIN} from "@/ark-scene/traces";
import type {ArkAnimal} from "@/ark-scene/types";
import {WeatherFx} from "@/ark-scene/weather-fx";
import {LAKE, riverDistance, sampleGround, zoneAt} from "@/ark-scene/world";
import {ageOf, speciesCare, type ArkAge} from "@/lib/ark-age";
import {arkDayAt, lightningAt, seaLevelAt, shoreAt, tideAt, weatherAt, type ArkShore, type ArkTide, type ArkWeather} from "@/lib/ark-clock";
import {
    aboveTide,
    backToWindYaw,
    coverSpot,
    ease,
    HEEL_LAG_SECONDS,
    heelPose,
    lerpAngle,
    pickParent,
    shelterAt,
    shelterKind,
    shelterPace,
    WeatherFlips,
    wornPatches,
    yawToward,
    type FlipState,
    type ShelterKind,
    type ShelterProfile
} from "@/lib/ark-liveliness";
import {callMood, type ArkCallMood, type ArkSoundTier} from "@/lib/ark-sound";

/** A schedule pose as the scene has it (`behaviour-schedule.ts` `TripPose` plus its doing). */
export type LivePose = {x: number; y: number; z: number; yaw: number; moving: boolean; aloft: boolean; doing: string};

/** What the wiring reads of an animal the scene draws (a structural slice of `index.ts`'s entry). */
export type LiveAnimal = {
    animal: ArkAnimal;
    length: number;
    drawnHeight: number;
    place: {x: number; z: number; ground: number; water?: boolean};
    /** A water species (its depth band): never shelters, never pushed off the tide. */
    depth: unknown | null;
};

export type LiveHooks = {
    /** Its body plan once its model is in (`library.get(slug)?.behaviour?.plan`). */
    planOf: (slug: string) => string | null | undefined;
    /** Its behaviour profile (`behaviour-profile.ts`), when it is on the schedule. */
    profileOf: (entry: LiveAnimal) => ShelterProfile | null;
    /** Its schedule pose at another moment (its shared schedule; no cache of the scene's disturbed). */
    poseAt: (entry: LiveAnimal, epochSeconds: number) => LivePose | null;
    /** Its roost (the schedule's `roostOf`), for those whose roost is shelter. */
    roostOf: (entry: LiveAnimal) => {x: number; y: number; z: number} | null;
    /** The scene's entry for an id. */
    entryOf: (id: string) => LiveAnimal | null;
    heightAt: (x: number, z: number) => number;
};

export type LiveOptions = {
    tier: QualityTier;
    fog: Fog;
    renderer: WebGLRenderer;
    voyageStartMs: number | null;
    offsetHours: number;
    soundBase: string | null;
    hooks: LiveHooks;
    onSoundCredits?: () => void;
};

/** A pinned environment (golden shots, clips): any field pins it; the rest follow the clock. */
export type LivePin = Partial<{seaLevel: number; wetness: number; snow: number; wind: number; storm: number; windDirection: number; cloud: number; rain: number; fog: number}>;

/** How the young are worked out again (s): growth is slow. */
const AGE_EVERY = 30;
/** Plans whose young play (the rest only keep close). */
const DAWN_SINGERS = new Set(["bird", "frog", "mammal"]);

type Young = {age: ArkAge; parent: string | null; at: number};
type Shelter = {kind: ShelterKind; spot: {x: number; y: number; z: number} | null; travelMs: number};

export class ArkLiveliness {
    readonly root = new Group();
    readonly audio: ArkAudio;
    readonly weatherFx: WeatherFx;
    readonly traces: Traces;
    weather: ArkWeather;
    tide: ArkTide;
    shore: ArkShore;
    seaLevel = 0;
    /** The environment the shaders and the sampler read (after any pin). */
    environment: ArkEnvironment & {windDirection: number; cloud: number; rain: number; fog: number};
    private readonly flips: WeatherFlips;
    private pinnedCover: FlipState | null = null;
    private readonly shelters = new Map<string, Shelter>();
    private readonly anchors = new Map<string, {at: number; pose: LivePose}>();
    private readonly young = new Map<string, Young>();
    private parents = new Map<string, string>();
    private arkDayNow = 0;
    private reducedMotion = false;
    private tier: QualityTier;
    private lite = false;
    private readonly options: LiveOptions;
    private nowMs = Date.now();
    private audioAnimals: ArkAudioAnimal[] = [];
    private alarms: string[] = [];
    private beds: ArkAudioBed[] = [];
    private bedsAt = -1;
    private wornAt = -1e9;
    private wornCentre = new Vector3(1e9, 0, 0);
    private wornQueue: LiveAnimal[] = [];
    private wornRoutes = new Map<string, Array<{x: number; z: number}>>();
    private readonly horizon = new Color();
    /** Per-frame numbers for the scene's stats. */
    readonly counts = {sheltering: 0, young: 0, tideMoved: 0};
    private last = {sheltering: 0, young: 0, tideMoved: 0};

    constructor(options: LiveOptions) {
        this.options = options;
        this.tier = options.tier;
        const clock = {voyageStartMs: options.voyageStartMs, offsetHours: options.offsetHours};
        this.flips = new WeatherFlips((ms) => weatherAt(ms, clock).hints.seekCover);
        this.weather = weatherAt(this.nowMs, clock);
        this.tide = tideAt(this.nowMs);
        this.shore = shoreAt(this.tide);
        this.environment = {seaLevel: 0, wetness: 0, snow: 0, wind: 0.35, storm: 0, windDirection: 0, cloud: 0.3, rain: 0, fog: 0};
        this.weatherFx = new WeatherFx(options.tier, options.fog, options.renderer);
        this.traces = new Traces(options.tier);
        this.root.add(this.weatherFx.root, this.traces.root);
        this.audio = new ArkAudio({soundBase: options.soundBase, tier: soundTier(options.tier, false), onCredits: options.onSoundCredits});
    }

    setTier(tier: QualityTier, lite: boolean) {
        this.tier = tier;
        this.lite = lite;
        this.weatherFx.setTier(tier, lite);
        this.traces.setTier(tier);
        this.audio.setTier(soundTier(tier, lite));
    }

    setReducedMotion(reduced: boolean) {
        this.reducedMotion = reduced;
        this.weatherFx.setReducedMotion(reduced);
        this.traces.setReducedMotion(reduced);
    }

    setPixelRatio(ratio: number) {
        this.traces.setPixelRatio(ratio);
    }

    // MARK: The clock

    /** The weather and tide at the world's moment `nowMs`, with any pinned fields; returns what the shaders read. */
    environmentAt(nowMs: number, pin: LivePin | null) {
        this.nowMs = nowMs;
        const clock = {voyageStartMs: this.options.voyageStartMs, offsetHours: this.options.offsetHours};
        this.weather = weatherAt(nowMs, clock);
        this.tide = tideAt(nowMs);
        const live = {
            seaLevel: seaLevelAt(nowMs, {mean: 0, springRange: 0.7}),
            wetness: this.weather.wetness,
            snow: this.weather.mountainSnowCover,
            wind: this.weather.wind,
            storm: this.weather.storm,
            windDirection: this.weather.windDirection,
            cloud: this.weather.cloud,
            rain: this.weather.rain,
            fog: this.weather.fog
        };
        const env = {...live, ...(pin ?? {})};
        // A pin with no rain of its own: rain follows a pinned storm (a storm pinned is a wet one).
        if (pin && pin.rain === undefined && pin.storm !== undefined) env.rain = Math.min(1, pin.storm);
        if (pin && pin.fog === undefined && (pin.storm !== undefined || pin.rain !== undefined)) env.fog = 0.1 * env.rain;
        this.environment = env;
        this.seaLevel = env.seaLevel;
        this.shore = shoreAt({height: env.seaLevel / 0.35});
        // Shelter follows a pinned rain at once (the walk starting when it was pinned); else the clock's flips.
        const pinnedWet = pin && (pin.rain !== undefined || pin.storm !== undefined) ? env.rain > 0.45 || env.storm > 0.3 : null;
        if (pinnedWet === null) this.pinnedCover = null;
        // A first pin is how it already is (golden shots: no walk); a pin that changes starts the walk in or out.
        else if (!this.pinnedCover) this.pinnedCover = {on: pinnedWet, since: -Infinity, before: -Infinity};
        else if (this.pinnedCover.on !== pinnedWet) this.pinnedCover = {on: pinnedWet, since: nowMs, before: this.pinnedCover.since};
        if (this.options.voyageStartMs) this.arkDayNow = arkDayAt(nowMs, this.options.voyageStartMs);
        return env;
    }

    // MARK: Who is whose young

    /** A newer snapshot: each young one's parent (one adult of its kind in its cluster, seeded). */
    setSnapshot(animals: ArkAnimal[], arkDay: number | null | undefined) {
        if (typeof arkDay === "number" && !this.options.voyageStartMs) this.arkDayNow = arkDay;
        const adults = new Map<string, ArkAnimal[]>();
        for (const animal of animals) {
            if (animal.origin === "born") continue;
            const key = animal.kind_species_profile_id || animal.species_profile_id || animal.model_slug;
            adults.set(key, [...(adults.get(key) ?? []), animal]);
        }
        const parents = new Map<string, string>();
        for (const animal of animals) {
            if (animal.origin !== "born") continue;
            const key = animal.kind_species_profile_id || animal.species_profile_id || animal.model_slug;
            const parent = pickParent({id: animal.id, slot: animal.slot, zone: animal.zone}, (adults.get(key) ?? []).map((a) => ({id: a.id, slot: a.slot, zone: a.zone})));
            if (parent) parents.set(animal.id, parent);
        }
        this.parents = parents;
        this.young.clear();
    }

    /** A young one's parent (the scene's seeded pick), or null. */
    parentOf(id: string): string | null {
        return this.parents.get(id) ?? null;
    }

    /** Its age now (young, adult, old), worked out again now and then. */
    ageOf(entry: LiveAnimal): ArkAge | null {
        const animal = entry.animal;
        if (animal.origin !== "born" || animal.born_ark_day == null || !this.arkDayNow) return null;
        const now = this.nowMs / 1000;
        const known = this.young.get(animal.id);
        if (known && now - known.at < AGE_EVERY && now >= known.at) return known.age;
        const plan = this.options.hooks.planOf(animal.model_slug) ?? null;
        const parent = this.parents.get(animal.id) ?? null;
        const age = ageOf({id: animal.id, origin: animal.origin, born_ark_day: animal.born_ark_day, condition: animal.condition ?? null, parents: parent ? [parent] : []}, this.arkDayNow, plan, speciesCare(animal.model_slug, plan));
        this.young.set(animal.id, {age, parent, at: now});
        return age;
    }

    /** Times its species' drawn length: its own seeded size, and smaller while it grows. */
    lengthScale(entry: LiveAnimal, atFloor: boolean): number {
        const age = this.ageOf(entry);
        const young = age && age.stage === "young" ? (atFloor ? Math.max(age.scale, 0.7) : age.scale) : 1;
        return sizeOf(entry.animal.id) * young;
    }

    // MARK: The shared pose

    private shelterOf(entry: LiveAnimal, kind: ShelterKind): Shelter {
        const id = entry.animal.id;
        const known = this.shelters.get(id);
        if (known && known.kind === kind) return known;
        let spot: Shelter["spot"] = null;
        // Too big to stand under a crown (an elephant, a giraffe): it hunkers in the open instead.
        let use: ShelterKind = kind === "cover" && entry.length > 2.6 ? "hunker" : kind;
        const home = {x: entry.place.x, z: entry.place.z};
        if (kind === "roost") {
            const roost = this.options.hooks.roostOf(entry);
            if (roost && Math.hypot(roost.x - home.x, roost.z - home.z) < 40) spot = roost;
            else use = "cover";
        }
        if (use === "cover") {
            const trunks = attachPoints({tag: "bark", near: {x: home.x, z: home.z, radius: 22}}).map((p) => ({x: p.position.x, z: p.position.z, nx: p.normal.x, nz: p.normal.z, id: p.id}));
            const at = coverSpot(id, home, entry.length, trunks, 22);
            if (at) {
                const y = this.options.hooks.heightAt(at.x, at.z);
                // Never into the water.
                spot = y > 0.05 ? {x: at.x, y, z: at.z} : null;
            }
            if (!spot) use = "hunker";
        }
        const distance = spot ? Math.hypot(spot.x - home.x, spot.z - home.z) : 0;
        const shelter: Shelter = {kind: use, spot, travelMs: use === "hunker" ? 2500 : Math.max(2500, (distance / shelterPace(entry.length)) * 1000)};
        this.shelters.set(id, shelter);
        return shelter;
    }

    /** Its schedule pose at a past moment, remembered while that moment holds (where it set off from). */
    private anchor(entry: LiveAnimal, atMs: number): LivePose | null {
        const id = entry.animal.id;
        const known = this.anchors.get(id);
        if (known && known.at === atMs) return known.pose;
        if (!Number.isFinite(atMs)) return null;
        const pose = this.options.hooks.poseAt(entry, atMs / 1000);
        if (pose) this.anchors.set(id, {at: atMs, pose});
        return pose;
    }

    /** Rain: to its shelter and back, at its own moment (the same for every viewer). */
    private sheltered<P extends LivePose>(entry: LiveAnimal, pose: P, nowMs: number): P {
        if (entry.depth || entry.place.water) return pose;
        const kind = shelterKind(this.options.hooks.profileOf(entry), this.options.hooks.planOf(entry.animal.model_slug));
        if (kind === "none") return pose;
        const shelter = this.shelterOf(entry, kind);
        const pinned = this.pinnedCover;
        const state = shelterAt(pinned ? {stateAt: () => pinned} : this.flips, entry.animal.id, nowMs, shelter.travelMs);
        if (state.level <= 0) return pose;
        this.counts.sheltering++;
        const wind = backToWindYaw(entry.animal.id, this.environment.windDirection);
        if (shelter.kind === "hunker" || !shelter.spot) {
            // Where it was when the rain came: it stays there, its back to the wind, until it passes.
            const at = this.anchor(entry, state.wentIn) ?? pose;
            // Going: it stays where it was. Coming out: from there back to where its schedule has it now.
            const k = state.going ? 0 : ease(1 - state.level);
            const hold = state.going ? Math.min(state.level * 3, 1) : 1;
            return Object.assign({}, pose, {
                x: at.x + (pose.x - at.x) * k,
                y: at.y + (pose.y - at.y) * k,
                z: at.z + (pose.z - at.z) * k,
                yaw: state.going ? lerpAngle(at.yaw, wind, ease(hold)) : lerpAngle(wind, pose.yaw, k),
                moving: !state.going && state.moving,
                aloft: state.going ? false : pose.aloft && k > 0.5,
                doing: state.going || state.level > 0.5 ? "rest" : pose.doing
            });
        }
        const spot = shelter.spot;
        const from = state.going ? this.anchor(entry, state.since) ?? pose : null;
        const k = ease(state.level);
        // Going: from where it set off to the spot. Coming out: from the spot back to where its schedule has it now.
        const sx = from ? from.x : pose.x;
        const sy = from ? from.y : pose.y;
        const sz = from ? from.z : pose.z;
        const x = sx + (spot.x - sx) * k;
        const z = sz + (spot.z - sz) * k;
        const up = spot.y - this.options.hooks.heightAt(spot.x, spot.z);
        // A roost up a tree: flown to, not walked.
        const flying = up > 0.4 && state.moving;
        const ground = Math.max(this.options.hooks.heightAt(x, z), 0);
        const y = flying ? Math.max(sy + (spot.y - sy) * k, ground) + Math.sin(Math.PI * k) * 1.5 : state.level >= 1 ? spot.y : up > 0.4 ? sy + (spot.y - sy) * k : ground;
        const heading = state.going ? yawToward(spot.x - sx, spot.z - sz) : yawToward(pose.x - spot.x, pose.z - spot.z);
        return Object.assign({}, pose, {
            x,
            y,
            z,
            yaw: state.moving ? heading : wind,
            moving: state.moving,
            aloft: flying,
            doing: state.moving ? (flying ? "fly" : "walk") : "rest"
        });
    }

    /**
     * Its pose now on top of its schedule's: a dependent young one at its
     * parent's heel (or on its back), anyone sheltering from rain, and a
     * land animal kept off ground the tide has covered. Called with the
     * schedule's pose each time the scene works it out.
     */
    sharedPose<P extends LivePose>(entry: LiveAnimal, pose: P, epochSeconds: number): P {
        if (this.reducedMotion) return pose;
        const nowMs = epochSeconds * 1000;
        let out = pose;
        const age = this.ageOf(entry);
        const parentId = age && age.stage === "young" && age.follow ? age.follow.parentId : null;
        const parent = parentId ? this.options.hooks.entryOf(parentId) : null;
        if (age && parent && age.follow && !pose.aloft) {
            // Its parent a moment ago, sheltering or not: it keeps to its heel.
            const raw = this.options.hooks.poseAt(parent, epochSeconds - HEEL_LAG_SECONDS);
            if (raw) {
                const lead = this.sheltered(parent, raw, nowMs - HEEL_LAG_SECONDS * 1000);
                const heel = heelPose(entry.animal.id, {x: lead.x, z: lead.z, yaw: lead.yaw, length: parent.length, height: parent.drawnHeight || parent.length * 0.6}, {distance: age.follow.distance, carried: age.carried}, age.play, nowMs);
                const ground = Math.max(this.options.hooks.heightAt(heel.x, heel.z), 0);
                this.counts.young++;
                out = Object.assign({}, pose, {
                    x: heel.x,
                    z: heel.z,
                    y: (age.carried ? Math.max(lead.y, ground) : ground) + heel.lift,
                    yaw: heel.yaw,
                    moving: lead.moving || heel.playing,
                    aloft: false,
                    doing: heel.playing ? "play" : lead.doing
                });
                return this.offTheTide(entry, out);
            }
        }
        out = this.sheltered(entry, out, nowMs);
        return this.offTheTide(entry, out);
    }

    /** At high water: a land animal standing on covered ground walks up the beach. */
    private offTheTide<P extends LivePose>(entry: LiveAnimal, pose: P): P {
        if (entry.depth || pose.aloft || this.seaLevel <= 0.02) return pose;
        const ground = this.options.hooks.heightAt(pose.x, pose.z);
        // Only one standing on land the schedule meant as land (at or above the mean sea), now under the tide.
        if (ground < -0.02 || pose.y < ground - 0.02 || ground >= this.seaLevel + 0.04) return pose;
        const moved = aboveTide(pose.x, pose.z, this.seaLevel, this.options.hooks.heightAt);
        if (!moved.moved) return pose;
        this.counts.tideMoved++;
        return Object.assign({}, pose, {x: moved.x, z: moved.z, y: moved.ground});
    }

    // MARK: Every drawn animal

    /** One animal drawn near the camera this frame: its traces, and (with sound on) whether and how it calls. */
    drawn(entry: LiveAnimal, at: {x: number; base: number; z: number; yaw: number; afloat: boolean; inWater: boolean}, info: {distance: number; asleep: boolean; aloft: boolean; resting: boolean; alarmed: number; called: boolean; hours: number}, elapsed: number) {
        const plan = this.options.hooks.planOf(entry.animal.model_slug) ?? "";
        if (info.distance < TRACE_WITHIN && !info.aloft) {
            const surface = at.inWater && Math.abs(at.base - this.seaLevel) < Math.max(entry.drawnHeight * 0.6, 0.15);
            const wading = !at.inWater && !entry.depth && this.options.hooks.heightAt(at.x, at.z) < this.seaLevel - 0.02;
            this.traces.observe({id: entry.animal.id, x: at.x, y: at.base, z: at.z, yaw: at.yaw, length: entry.length, onGround: !at.afloat && !at.inWater, atSurface: surface || wading, bird: plan === "bird", distance: info.distance}, elapsed, this.environment);
        }
        if (this.audio.playing) {
            const mood: ArkCallMood = callMood({asleep: info.asleep, alarm: info.alarmed > 0.3, resting: info.resting || this.weather.rain > 0.5, dawnSinger: DAWN_SINGERS.has(plan), hours: info.hours});
            this.audioAnimals.push({id: entry.animal.id, speciesProfileId: entry.animal.species_profile_id, kindSpeciesProfileId: entry.animal.kind_species_profile_id ?? null, x: at.x, y: at.base + entry.drawnHeight * 0.6, z: at.z, mood});
            if (info.called) this.alarms.push(entry.animal.id);
        }
    }

    // MARK: Once a frame

    /** After the animals: the weather drawn, the traces' clocks, the sound, the worn paths. */
    step(elapsed: number, camera: PerspectiveCamera, target: Vector3, fog: Fog | null, horizon: Color, width: number, height: number, hours: number, scheduled: () => LiveAnimal[], routeOf: (entry: LiveAnimal, fromS: number, toS: number, stepS: number) => Array<{x: number; z: number}>) {
        const underwater = camera.position.y < this.seaLevel - 0.02;
        const lightning = lightningAt(this.nowMs, this.environment.storm);
        this.horizon.copy(horizon);
        this.weatherFx.update({rain: this.environment.rain, wind: this.environment.wind, windDirection: this.environment.windDirection, fog: this.environment.fog, storm: this.environment.storm, lightning, seaLevel: this.seaLevel, underwater}, camera, target, fog, this.horizon, this.options.renderer, width, height);
        this.traces.step(elapsed);
        // Sound: the animals heard this frame, the beds round the camera (a few times a second).
        if (this.audio.playing) {
            if (elapsed - this.bedsAt > 0.5 || elapsed < this.bedsAt) {
                this.bedsAt = elapsed;
                const ground = sampleGround(target.x, target.z);
                const lakeEdge = Math.hypot(target.x - LAKE.x, target.z - LAKE.z) - LAKE.r;
                const water = {shore: clamp01(1 - ground.inland / 22), river: clamp01(1 - riverDistance(target.x, target.z) / 14), pond: clamp01(1 - lakeEdge / 14)};
                const input = {zone: ground.height < -0.5 ? (ground.reef > 0.5 ? "coral_reef" : "open_ocean") : zoneAt(ground), weather: this.weather, hour: hours, tide: this.tide, cameraPos: {x: camera.position.x, y: camera.position.y, z: camera.position.z}, nearWater: Math.max(water.shore, water.river, water.pond), water, underwater};
                this.beds = selectAmbientBeds(input);
            }
            const right = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
            right.y = 0;
            if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
            right.normalize();
            this.audio.step({nowMs: this.nowMs, listener: {x: camera.position.x, y: camera.position.y, z: camera.position.z, rightX: right.x, rightZ: right.z}, animals: this.audioAnimals, alarms: this.alarms, beds: this.beds, underwater});
        } else {
            this.audio.step({nowMs: this.nowMs, listener: {x: 0, y: 0, z: 0, rightX: 1, rightZ: 0}, animals: [], alarms: [], beds: []});
        }
        this.audioAnimals = [];
        this.alarms = [];
        this.stepWorn(target, scheduled, routeOf);
        this.last = {...this.counts};
        this.counts.sheltering = 0;
        this.counts.young = 0;
        this.counts.tideMoved = 0;
    }

    /** Last frame's numbers (the scene's stats). */
    stats() {
        const traces = this.traces.stats();
        const sound = this.audio.activity();
        return {...this.last, drops: this.weatherFx.now.drops, haze: Math.round(this.weatherFx.now.haze * 100) / 100, ...traces, voices: sound.voices, beds: sound.beds, soundOn: sound.on};
    }

    /**
     * Worn paths round what the camera looks at: each scheduled animal's
     * route over the last half hour (its shared schedule), one animal a
     * frame, laid again once they are all in. Not at the low tier.
     */
    private stepWorn(target: Vector3, scheduled: () => LiveAnimal[], routeOf: (entry: LiveAnimal, fromS: number, toS: number, stepS: number) => Array<{x: number; z: number}>) {
        if (this.tier === "low" || this.lite || this.reducedMotion) return;
        const now = this.nowMs / 1000;
        const moved = Math.hypot(target.x - this.wornCentre.x, target.z - this.wornCentre.z) > 18;
        if (moved || now - this.wornAt > 300 || now < this.wornAt) {
            this.wornAt = now;
            this.wornCentre.copy(target);
            this.wornRoutes = new Map();
            this.wornQueue = scheduled().filter((e) => !e.depth && !e.place.water && Math.hypot(e.place.x - target.x, e.place.z - target.z) < 40).slice(0, 24);
            if (!this.wornQueue.length) this.traces.setWorn([]);
            return;
        }
        const next = this.wornQueue.shift();
        if (!next) return;
        // On a 10-minute grid, so every viewer samples the same moments.
        const to = Math.floor(now / 600) * 600;
        this.wornRoutes.set(next.animal.id, routeOf(next, to - 1800, to, 12));
        if (this.wornQueue.length) return;
        const patches = wornPatches(Array.from(this.wornRoutes.values()), 1.1, 4).flatMap((c) => {
            const y = this.options.hooks.heightAt(c.x, c.z);
            return y > 0.06 ? [{x: c.x, y, z: c.z, size: 1.5, strength: c.strength}] : [];
        });
        this.traces.setWorn(patches);
    }

    // MARK: Sound

    /** Turn sound on (from a tap: the context is made here) or off. False: no WebAudio on this device. */
    setSound(on: boolean): boolean {
        if (on) return this.audio.unlocked ? (this.audio.setOn(true), true) : this.audio.unlock();
        this.audio.setOn(false);
        return true;
    }

    dispose() {
        this.audio.dispose();
        this.weatherFx.dispose();
        this.traces.dispose();
    }
}

function clamp01(value: number): number {
    return Math.min(Math.max(value, 0), 1);
}

/** The sound tier for a quality tier (the lighter view hears as the low tier). */
export function soundTier(tier: QualityTier, lite: boolean): ArkSoundTier {
    return lite ? "low" : tier;
}
