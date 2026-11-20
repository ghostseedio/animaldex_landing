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
import {ambientCredits, AMBIENT_THUNDER, bedUrl, selectAmbientBeds, thunderClaps, type AmbientInput} from "@/ark-scene/ambient-beds";
import {GARDEN_POND} from "@/ark-scene/micro-decor";
import {noHamlet, onHamletSwitch} from "@/ark-scene/no-hamlet";
import {sizeOf} from "@/ark-scene/ark-variation";
import type {QualityTier} from "@/ark-scene/post";
import {attachPoints, type ArkEnvironment} from "@/ark-scene/sampler";

/** The trunks (bark attach points) in 10 m cells, built once: an animal's cover is looked up near its home, not over all of them. */
let trunkGrid: Map<string, Array<{x: number; z: number; nx: number; nz: number; id: string}>> | null = null;
onHamletSwitch(() => {
    trunkGrid = null;
});
function trunksNear(x: number, z: number, radius: number): Array<{x: number; z: number; nx: number; nz: number; id: string}> {
    if (!trunkGrid) {
        const grid = new Map<string, Array<{x: number; z: number; nx: number; nz: number; id: string}>>();
        for (const p of attachPoints({tag: "bark"})) {
            const key = `${Math.floor(p.position.x / 10)},${Math.floor(p.position.z / 10)}`;
            const cell = grid.get(key) ?? [];
            cell.push({x: p.position.x, z: p.position.z, nx: p.normal.x, nz: p.normal.z, id: p.id});
            grid.set(key, cell);
        }
        trunkGrid = grid;
    }
    const out: Array<{x: number; z: number; nx: number; nz: number; id: string}> = [];
    const reach = Math.ceil(radius / 10);
    const cx = Math.floor(x / 10);
    const cz = Math.floor(z / 10);
    for (let i = -reach; i <= reach; i++) for (let k = -reach; k <= reach; k++) for (const p of trunkGrid.get(`${cx + i},${cz + k}`) ?? []) if (Math.hypot(p.x - x, p.z - z) <= radius) out.push(p);
    return out;
}
import {Traces, TRACE_WITHIN} from "@/ark-scene/traces";
import type {ArkAnimal} from "@/ark-scene/types";
import {WeatherFx} from "@/ark-scene/weather-fx";
import {motherAmong, nurseBlend, nursePlace, nurses, nursingBout} from "@/ark-scene/young-care";
import {
    clumpSpot,
    fatherAmong,
    familyClock,
    familySpot,
    HELPER_CHANCE,
    inVisitHours,
    lineBehind,
    lineDistance,
    moveBlend,
    PARENT_CHANCE,
    siblingOffset,
    visitPlace,
    visitMotion,
    visitPlan,
    visitState,
    VISIT_HOLD_S,
    VISIT_REACH,
    waysOf,
    walkSeconds,
    type Pt,
    type VisitPlan,
    type VisitState,
    type WayKind
} from "@/ark-scene/young-ways";
import {arkWorld, coastRadius, LAKE, RIVER, sampleGround} from "@/ark-scene/world";
import {fallsSoundAt} from "@/ark-scene/islands/wild/falls";
import {ageOf, speciesCare, type ArkAge} from "@/lib/ark-age";
import {arkDayAt, hash32, islandHours, lightningAt, seaLevelAt, shoreAt, tideAt, unit, weatherAt, type ArkShore, type ArkTide, type ArkWeather} from "@/lib/ark-clock";
import {
    aboveTide,
    backToWindYaw,
    callLift,
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
import {ARK_SOUND_TIERS, callMood, type ArkCallMood, type ArkSoundTier} from "@/lib/ark-sound";

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
    /** 3.3 batch (C): a young one's recorded parents (`young-care.ts` `Lineage`, the record's births), or null: the seeded pick. */
    recordedParents?: (youngId: string) => readonly string[] | null;
    /** 3.3 batch (C): an animal's drawn sex (the mother is the parent drawn female; the engine has no sexes). */
    maleOf?: (animal: ArkAnimal) => boolean | null;
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

/** The longest walk to shelter (ms): cover is within 22 m and the slowest pace is 0.45 m/s. */
const SHELTER_LONGEST_MS = (22 / 0.45 + 2) * 1000;
/** How the young are worked out again (s): growth is slow. */
const AGE_EVERY = 30;
/** Plans whose young play (the rest only keep close). */
const DAWN_SINGERS = new Set(["bird", "frog", "mammal"]);

type Young = {age: ArkAge; parent: string | null; at: number};
/** One parent's (or helper's) visit to its young: where it set out from, where it stands with them, and how long the walk or flight takes. */
type VisitRun = {key: string; plan: VisitPlan; anchor: LivePose; place: {x: number; z: number; yaw: number}; spot: Pt; go: number; back: number; flies: boolean; youngId: string; kind: "nurse" | "feed"};
type Shelter = {/** The kind it was asked for (the cache key; `kind` may have fallen back to hunkering). */ asked: ShelterKind; kind: ShelterKind; spot: {x: number; y: number; z: number} | null; travelMs: number; /** The spot's height over the ground (a roost up a tree), worked out once. */ up: number};

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
    /** Each walker's ground, sampled again only after it has moved a little (a full height sample is not free on a phone). */
    private readonly grounds = new Map<string, {x: number; z: number; y: number}>();
    /** Parents' past positions (a young one's play reads where its parent was when its dash ended). */
    private readonly pastPoses = new Map<string, {x: number; z: number} | null>();
    private parents = new Map<string, string>();
    /** 3.3 batch (C): the last snapshot's animals (the parents are worked out again when the record tells a birth), and who suckles now. */
    private snapshotAnimals: ArkAnimal[] = [];
    readonly nursing = new Map<string, {mother: string; key: string; at: number}>();
    /** sig-young: the families whose young stay at a spot (by their parent's id), who visits whom, who follows in a line, who clumps. */
    private families = new Map<string, {young: string[]}>();
    private visitors = new Map<string, {familyKey: string; helper: boolean}>();
    private familyVisitors = new Map<string, string[]>();
    private lineMates = new Map<string, string[]>();
    private clumps = new Map<string, string[]>();
    private clumpOf = new Map<string, string>();
    private readonly spots = new Map<string, Pt | null>();
    private readonly visitRuns = new Map<string, VisitRun | null>();
    private readonly trails = new Map<string, {g: number; points: Pt[]}>();
    /** What a young one (or its visitor) is doing now in the young-ways (the log says it in its species' own sentence once an episode). */
    readonly wayNowOf = new Map<string, {way: WayKind; key: string; at: number; speciesLine: string | null}>();
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
    /** Thunder is asked for in back-to-back windows: the next one starts here (shared ms). */
    private thunderTo = 0;
    private wornAt = -1e9;
    private wornCentre = new Vector3(1e9, 0, 0);
    private wornQueue: LiveAnimal[] = [];
    private wornRoutes = new Map<string, Array<{x: number; z: number}>>();
    private readonly horizon = new Color();
    /** Per-frame numbers for the scene's stats. */
    readonly counts = {sheltering: 0, young: 0, tideMoved: 0};
    private last = {sheltering: 0, young: 0, tideMoved: 0};
    /** Main-thread time this frame in the wiring (ms), and the last few frames' (for the stats' mean). */
    private spent = 0;
    private readonly spentFrames: number[] = [];
    /** This frame's split (ms): the shared pose, the drawn animals, the frame's own step. */
    private split = {pose: 0, drawn: 0, step: 0};
    private lastSplit = {pose: 0, drawn: 0, step: 0};

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
        this.snapshotAnimals = animals;
        const adults = new Map<string, ArkAnimal[]>();
        for (const animal of animals) {
            if (animal.origin === "born") continue;
            const key = animal.kind_species_profile_id || animal.species_profile_id || animal.model_slug;
            adults.set(key, [...(adults.get(key) ?? []), animal]);
        }
        const parents = new Map<string, string>();
        const byId = new Map(animals.map((animal) => [animal.id, animal]));
        for (const animal of animals) {
            if (animal.origin !== "born") continue;
            const key = animal.kind_species_profile_id || animal.species_profile_id || animal.model_slug;
            // 3.3 batch (C): its recorded mother when the record has said who its parents are; else the seeded pick.
            const recorded = this.options.hooks.recordedParents?.(animal.id);
            const maleOf = (id: string) => (byId.has(id) ? this.options.hooks.maleOf?.(byId.get(id)!) ?? null : null);
            const mother = recorded ? motherAmong(recorded, maleOf, (id) => byId.has(id)) : null;
            // sig-young: where its species' own text says the father carries or leads (`young-ways.ts` `by`), the recorded father; else the pick among the kind's drawn males.
            const byMale = waysOf(animal.model_slug)?.by === "male";
            const father = byMale && recorded ? fatherAmong(recorded, maleOf, (id) => byId.has(id)) : null;
            const pool = (adults.get(key) ?? []).map((a) => ({a, male: byMale ? maleOf(a.id) : null}));
            const pickFrom = byMale && !father && pool.some((p) => p.male === true) ? pool.filter((p) => p.male === true) : pool;
            const parent = father ?? mother ?? pickParent({id: animal.id, slot: animal.slot, zone: animal.zone}, pickFrom.map(({a}) => ({id: a.id, slot: a.slot, zone: a.zone})));
            if (parent) parents.set(animal.id, parent);
        }
        this.parents = parents;
        this.young.clear();
        this.buildFamilies(animals, adults, parents);
    }

    /**
     * sig-young: the ways its species keeps young (`young-ways.ts`), for the young now aboard: whose young stay at a spot
     * (so who comes back to them, and which helpers of the kind come too), who follows in a line behind whom, and which
     * young clump. Worked out again with the snapshot and when the record tells a birth.
     */
    private buildFamilies(animals: ArkAnimal[], adults: Map<string, ArkAnimal[]>, parents: Map<string, string>) {
        const families = new Map<string, {young: string[]}>();
        const visitors = new Map<string, {familyKey: string; helper: boolean}>();
        const lineMates = new Map<string, string[]>();
        const clumps = new Map<string, string[]>();
        const clumpOf = new Map<string, string>();
        for (const animal of animals) {
            if (animal.origin !== "born") continue;
            const ways = waysOf(animal.model_slug);
            if (!ways) continue;
            const parent = parents.get(animal.id) ?? null;
            if (ways.stay) {
                const key = parent ?? animal.id;
                const family = families.get(key) ?? {young: []};
                family.young.push(animal.id);
                families.set(key, family);
                if (parent) visitors.set(parent, {familyKey: key, helper: false});
                if (parent && ways.helpers) {
                    // (Up to two other adults of the kind in its cluster, the same pool as its seeded parent: their own pick by the young one's id.)
                    const kind = animal.kind_species_profile_id || animal.species_profile_id || animal.model_slug;
                    const pool = (adults.get(kind) ?? []).filter((a) => a.id !== parent && a.zone === animal.zone && (animal.slot == null || a.slot === animal.slot)).map((a) => a.id).sort();
                    const picks = pool.map((id) => ({id, h: hash32(animal.id, "helper", id)})).sort((a, b) => a.h - b.h || (a.id < b.id ? -1 : 1)).slice(0, 2);
                    for (const pick of picks) if (!visitors.has(pick.id)) visitors.set(pick.id, {familyKey: key, helper: true});
                }
            }
            if (ways.line && parent) lineMates.set(parent, [...(lineMates.get(parent) ?? []), animal.id]);
            if (ways.cluster) {
                const key = `${animal.kind_species_profile_id || animal.species_profile_id || animal.model_slug}|${animal.zone}|${animal.slot ?? ""}`;
                clumps.set(key, [...(clumps.get(key) ?? []), animal.id]);
                clumpOf.set(animal.id, key);
            }
        }
        families.forEach((list) => list.young.sort());
        lineMates.forEach((list) => list.sort());
        clumps.forEach((list) => list.sort());
        const familyVisitors = new Map<string, string[]>();
        visitors.forEach((v, id) => familyVisitors.set(v.familyKey, [...(familyVisitors.get(v.familyKey) ?? []), id]));
        familyVisitors.forEach((list) => list.sort());
        this.families = families;
        this.visitors = visitors;
        this.familyVisitors = familyVisitors;
        this.lineMates = lineMates;
        this.clumps = clumps;
        this.clumpOf = clumpOf;
        this.spots.clear();
        this.visitRuns.clear();
        this.trails.clear();
        this.wayNowOf.clear();
    }

    /** 3.3 batch (C): the record told a birth (`Lineage.note`): who follows whom is worked out again. */
    lineageChanged() {
        this.setSnapshot(this.snapshotAnimals, undefined);
    }

    /** A young one's parent (its recorded mother, else the scene's seeded pick), or null. */
    parentOf(id: string): string | null {
        return this.parents.get(id) ?? null;
    }

    /** ARK-JUNGLE: the mother that carries it now (a young one in its carried time), or null. */
    carriedBy(animal: ArkAnimal): string | null {
        if (animal.origin !== "born" || animal.born_ark_day == null || !this.arkDayNow) return null;
        const parent = this.parents.get(animal.id) ?? null;
        if (!parent) return null;
        const plan = this.options.hooks.planOf(animal.model_slug) ?? null;
        const age = ageOf({id: animal.id, origin: animal.origin, born_ark_day: animal.born_ark_day, condition: animal.condition ?? null, parents: [parent]}, this.arkDayNow, plan, speciesCare(animal.model_slug, plan));
        return age.stage === "young" && age.carried ? parent : null;
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
        if (known && known.asked === kind) return known;
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
            const at = coverSpot(id, home, entry.length, trunksNear(home.x, home.z, 22), 22);
            if (at) {
                const y = this.options.hooks.heightAt(at.x, at.z);
                // Never into the water.
                spot = y > 0.05 ? {x: at.x, y, z: at.z} : null;
            }
            if (!spot) use = "hunker";
        }
        const distance = spot ? Math.hypot(spot.x - home.x, spot.z - home.z) : 0;
        const up = spot ? spot.y - this.options.hooks.heightAt(spot.x, spot.z) : 0;
        const shelter: Shelter = {asked: kind, kind: use, spot, up, travelMs: use === "hunker" ? 2500 : Math.max(2500, (distance / shelterPace(entry.length)) * 1000)};
        this.shelters.set(id, shelter);
        return shelter;
    }

    /** Where a parent was at a past moment (trailed as the young trail it, sheltering included), for its young's play. */
    private parentAt(parent: LiveAnimal, ms: number): {x: number; z: number} | null {
        const key = `${parent.animal.id}@${ms}`;
        const known = this.pastPoses.get(key);
        if (known !== undefined) return known;
        const raw = this.options.hooks.poseAt(parent, ms / 1000 - HEEL_LAG_SECONDS);
        const at = raw ? this.sheltered(parent, raw, ms - HEEL_LAG_SECONDS * 1000) : null;
        const out = at ? {x: at.x, z: at.z} : null;
        this.pastPoses.set(key, out);
        if (this.pastPoses.size > 128) this.pastPoses.delete(this.pastPoses.keys().next().value as string);
        return out;
    }

    /** The ground under a walker (at or above the sea's mean), sampled again once it is 25 cm from the last sample. */
    private groundOf(id: string, x: number, z: number): number {
        const known = this.grounds.get(id);
        if (known && Math.abs(known.x - x) + Math.abs(known.z - z) < 0.25) return known.y;
        const y = Math.max(this.options.hooks.heightAt(x, z), 0);
        this.grounds.set(id, {x, z, y});
        if (this.grounds.size > 400) this.grounds.clear();
        return y;
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
        const pinned = this.pinnedCover;
        const flips = pinned ? {stateAt: () => pinned} : this.flips;
        // Out in the open even on the longest walk: nothing to work out (its cover is found only once it shelters).
        if (shelterAt(flips, entry.animal.id, nowMs, SHELTER_LONGEST_MS).level <= 0) return pose;
        const shelter = this.shelterOf(entry, kind);
        const state = shelterAt(flips, entry.animal.id, nowMs, shelter.travelMs);
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
        const up = shelter.up;
        // A roost up a tree: flown to, not walked.
        const flying = up > 0.4 && state.moving;
        const ground = state.level >= 1 ? spot.y - up : this.groundOf(entry.animal.id, x, z);
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
        const started = performance.now();
        const out = this.sharedPoseNow(entry, pose, epochSeconds);
        const took = performance.now() - started;
        this.spent += took;
        this.split.pose += took;
        return out;
    }

    private sharedPoseNow<P extends LivePose>(entry: LiveAnimal, pose: P, epochSeconds: number): P {
        const nowMs = epochSeconds * 1000;
        let out = pose;
        const age = this.ageOf(entry);
        // sig-young: young kept at a spot (lying hidden, at the den, in the nest) and the parent's or helper's visits to it,
        // young that clump (`young-ways.ts`).
        if (age && age.stage === "young" && (age.staying || age.ways?.cluster)) {
            const kept = age.staying ? this.stayPose(entry, age, pose, nowMs) : this.clusterPose(entry, pose, nowMs);
            if (kept) return this.offTheTide(entry, kept);
        } else if (this.visitors.size && this.visitors.has(entry.animal.id)) {
            const visiting = this.visitPose(entry, this.sheltered(entry, pose, nowMs), nowMs);
            if (visiting) return this.offTheTide(entry, visiting);
        }
        const parentId = age && age.stage === "young" && age.follow ? age.follow.parentId : null;
        const parent = parentId ? this.options.hooks.entryOf(parentId) : null;
        if (age && parent && age.follow && !pose.aloft) {
            // Its parent a moment ago, sheltering or not: it keeps to its heel.
            const raw = this.options.hooks.poseAt(parent, epochSeconds - HEEL_LAG_SECONDS);
            if (raw) {
                const lead = this.sheltered(parent, raw, nowMs - HEEL_LAG_SECONDS * 1000);
                const heel = heelPose(entry.animal.id, {x: lead.x, z: lead.z, yaw: lead.yaw, length: parent.length, height: parent.drawnHeight || parent.length * 0.6}, {distance: age.follow.distance, carried: age.carried}, age.play, nowMs, (ms) => this.parentAt(parent, ms));
                // sig-young: a young one of a species that follows in a line goes along her own path, each one its length behind the last.
                if (age.line && !age.carried) {
                    const mates = this.lineMates.get(parent.animal.id);
                    const rank = Math.max(mates ? mates.indexOf(entry.animal.id) : 0, 0);
                    const spot = lineBehind(this.trailOf(parent, lead, nowMs), lineDistance(parent.length, entry.length, rank), lead.yaw);
                    heel.x = spot.x;
                    heel.z = spot.z;
                    heel.yaw = spot.yaw;
                    heel.lift = 0;
                    heel.playing = false;
                    heel.moving = false;
                    const key = `line:${parent.animal.id}:${Math.floor(nowMs / 900_000)}`;
                    this.noteWay(entry.animal.id, "line", key, nowMs, age.ways?.lines.line ?? null);
                }
                // 3.3 batch (C): a mammal's young at heel comes to her flank to suckle in bouts of the shared clock
                // (`young-care.ts`), while she stands still and it is neither carried nor at play.
                const bout = !age.carried && !heel.playing && !lead.moving && !lead.aloft && lead.doing !== "sleep" && nurses(this.options.hooks.planOf(entry.animal.model_slug)) ? nursingBout(entry.animal.id, nowMs) : null;
                if (bout) {
                    const to = nurseBlend(heel, nursePlace(entry.animal.id, {x: lead.x, z: lead.z, yaw: lead.yaw, length: parent.length}, entry.length), bout.level);
                    heel.x = to.x;
                    heel.z = to.z;
                    heel.yaw = to.yaw;
                    if (bout.suckling) this.nursing.set(entry.animal.id, {mother: parent.animal.id, key: bout.key, at: nowMs});
                }
                const ground = this.groundOf(entry.animal.id, heel.x, heel.z);
                this.counts.young++;
                out = Object.assign({}, pose, {
                    x: heel.x,
                    z: heel.z,
                    y: (age.carried ? Math.max(lead.y, ground) : ground) + heel.lift,
                    yaw: heel.yaw,
                    moving: bout ? bout.level < 1 : lead.moving || heel.moving,
                    aloft: false,
                    // (Suckling it stands, head up under her: never her grazing or drinking with its head to the ground.)
                    doing: heel.playing ? "play" : bout ? "watch" : lead.doing
                }, bout ? {nurse: parent.animal.id, beat: undefined} : null);
                return this.offTheTide(entry, out);
            }
        }
        out = this.sheltered(entry, out, nowMs);
        return this.offTheTide(entry, out);
    }

    // MARK: Young kept at a spot, visits, lines and clumps (sig-young; `young-ways.ts`)

    /** The leader's recent places, newest first, half a second apart (a few seconds' walk): shared by all the young behind her. */
    private trailOf(leader: LiveAnimal, lead: {x: number; z: number}, nowMs: number): Pt[] {
        const STEP = 500;
        const g = Math.floor(nowMs / STEP) * STEP;
        let trail = this.trails.get(leader.animal.id);
        if (!trail || trail.g !== g) {
            const points: Pt[] = [];
            for (let j = 0; j < 24; j++) {
                const ms = g - j * STEP;
                const raw = this.options.hooks.poseAt(leader, ms / 1000 - HEEL_LAG_SECONDS);
                const at = raw ? this.sheltered(leader, raw, ms - HEEL_LAG_SECONDS * 1000) : null;
                if (at) points.push({x: at.x, z: at.z});
            }
            trail = {g, points};
            this.trails.set(leader.animal.id, trail);
            if (this.trails.size > 200) this.trails.delete(this.trails.keys().next().value as string);
        }
        return [{x: lead.x, z: lead.z}, ...trail.points];
    }

    private landAt(p: Pt): boolean {
        return this.options.hooks.heightAt(p.x, p.z) >= 0.1;
    }

    /** Where the family's young lie in a stay slot (null: nowhere on land to put them: they keep their day). Cached. */
    private staySpot(young: LiveAnimal, stay: NonNullable<ArkAge["ways"]>["stay"], familyKey: string, parentId: string | null, slot: number, slotStart: number): Pt | null {
        const key = `${familyKey}#${slot}`;
        const known = this.spots.get(key);
        if (known !== undefined) return known;
        const parent = parentId ? this.options.hooks.entryOf(parentId) : null;
        let anchor: Pt | null = null;
        let den = false;
        if (stay === "den") {
            const roost = this.options.hooks.roostOf(young) ?? (parent ? this.options.hooks.roostOf(parent) : null);
            if (roost) {
                anchor = {x: roost.x, z: roost.z};
                den = true;
            }
        }
        if (!anchor) {
            const at = this.options.hooks.poseAt(parent ?? young, slotStart / 1000);
            if (at) anchor = {x: at.x, z: at.z};
        }
        let spot: Pt | null = null;
        if (anchor) {
            spot = den ? anchor : familySpot(familyKey, slot, anchor, parent?.length ?? young.length * 3);
            if (!this.landAt(spot)) spot = this.landAt(anchor) ? anchor : null;
        }
        if (this.spots.size > 3000) this.spots.clear();
        this.spots.set(key, spot);
        return spot;
    }

    /** A young one lying hidden / at its den / in its nest: at its family's spot, up and watching while a visitor is with it. */
    private stayPose<P extends LivePose>(entry: LiveAnimal, age: ArkAge, pose: P, nowMs: number): P | null {
        const ways = age.ways;
        if (!ways?.stay) return null;
        const id = entry.animal.id;
        const parentId = this.parents.get(id) ?? null;
        const familyKey = parentId ?? id;
        const clock = familyClock(familyKey, nowMs);
        const here = this.staySpot(entry, ways.stay, familyKey, parentId, clock.stay, clock.stayStart);
        if (!here) return null;
        const before = this.staySpot(entry, ways.stay, familyKey, parentId, clock.stay - 1, clock.stayStart - 720_000) ?? here;
        const mine = siblingOffset(id, entry.length);
        const move = moveBlend({x: before.x + mine.x, z: before.z + mine.z}, {x: here.x + mine.x, z: here.z + mine.z}, nowMs - clock.stayStart);
        // A visitor with it now (its parent, or a helper of the kind).
        let visit: {visitor: string; place: {x: number; z: number; yaw: number}; kind: "nurse" | "feed"; key: string} | null = null;
        for (const visitorId of this.familyVisitors.get(familyKey) ?? []) {
            const now = this.visitNow(visitorId, nowMs);
            if (now && now.state.phase === "hold") {
                visit = {visitor: visitorId, place: now.run.place, kind: now.run.kind, key: now.run.key};
                break;
            }
        }
        const ground = this.groundOf(id, move.x, move.z);
        const asleep = ways.stay === "hide";
        const facing = visit ? Math.atan2(visit.place.x - move.x, visit.place.z - move.z) : move.yaw ?? unit(id, "stay-yaw") * Math.PI * 2;
        const key = visit ? visit.key : `stay:${familyKey}:${clock.stay}`;
        this.noteWay(id, visit ? "visit" : "stay", key, nowMs, (visit ? ways.lines.visit : ways.lines.stay) ?? null);
        this.counts.young++;
        return Object.assign({}, pose, {
            x: move.x,
            z: move.z,
            y: ground,
            yaw: facing,
            moving: move.moving,
            aloft: false,
            doing: move.moving ? "wander" : visit ? "watch" : asleep ? "sleep" : "rest"
        }, visit ? {nurse: visit.visitor, beat: undefined} : null);
    }

    /** The visit of `visitorId` to its family now: its plan, where it goes and when; null when it is not on a visit. Cached by plan. */
    private visitNow(visitorId: string, nowMs: number): {state: VisitState; run: VisitRun} | null {
        const v = this.visitors.get(visitorId);
        if (!v) return null;
        const youngId = this.families.get(v.familyKey)?.young[0];
        const young = youngId ? this.options.hooks.entryOf(youngId) : null;
        const visitor = this.options.hooks.entryOf(visitorId);
        if (!young || !visitor) return null;
        const ways = waysOf(young.animal.model_slug);
        if (!ways?.stay) return null;
        if (!inVisitHours(islandHours(nowMs, this.options.offsetHours), ways.hours)) return null;
        const plan = visitPlan(visitorId, v.familyKey, nowMs, v.helper ? HELPER_CHANCE : PARENT_CHANCE);
        if (!plan || nowMs < plan.start || nowMs >= plan.end) return null;
        let run = this.visitRuns.get(plan.key);
        if (run === undefined) {
            run = this.buildRun(plan, visitor, young, ways);
            if (this.visitRuns.size > 400) this.visitRuns.clear();
            this.visitRuns.set(plan.key, run);
        }
        if (!run) return null;
        const state = visitState(plan, nowMs, run.go, run.back);
        return state ? {state, run} : null;
    }

    private buildRun(plan: VisitPlan, visitor: LiveAnimal, young: LiveAnimal, ways: NonNullable<ArkAge["ways"]>): VisitRun | null {
        const age = this.ageOf(young);
        if (!age || age.stage !== "young" || !age.staying || !ways.stay) return null;
        const parentId = this.parents.get(young.animal.id) ?? null;
        const clock = familyClock(plan.familyKey, plan.start);
        const base = this.staySpot(young, ways.stay, plan.familyKey, parentId, clock.stay, clock.stayStart);
        const anchor = this.options.hooks.poseAt(visitor, plan.start / 1000);
        // (Not out of her bed at night: a sleeper keeps to it.)
        if (!base || !anchor || anchor.doing === "sleep" || anchor.doing === "to_roost") return null;
        const place = visitPlace(visitor.animal.id, base, visitor.length, young.length);
        const dist = Math.hypot(place.x - anchor.x, place.z - anchor.z);
        if (dist > VISIT_REACH) return null;
        const flies = this.options.hooks.planOf(visitor.animal.model_slug) === "bird" && this.options.hooks.profileOf(visitor)?.move === "fly" && dist > 8;
        const pace = flies ? 5 : shelterPace(visitor.length) * 1.5;
        const go = walkSeconds(dist, pace);
        // (Her day has moved on by the time she goes back: the way home is from here to where her day has her then.)
        const home = (after: number) => this.options.hooks.poseAt(visitor, plan.start / 1000 + after) ?? anchor;
        let back = walkSeconds(Math.hypot(home(go + VISIT_HOLD_S + go).x - place.x, home(go + VISIT_HOLD_S + go).z - place.z), pace);
        back = walkSeconds(Math.hypot(home(go + VISIT_HOLD_S + back).x - place.x, home(go + VISIT_HOLD_S + back).z - place.z), pace);
        return {key: plan.key, plan, anchor, place, spot: base, go, back, flies, youngId: young.animal.id, kind: (ways.visit ?? "nurse") as "nurse" | "feed"};
    }

    /** A parent (or helper) on its way to its young, with them, and back: nursing or feeding them where they lie. */
    private visitPose<P extends LivePose>(entry: LiveAnimal, pose: P, nowMs: number): P | null {
        const now = this.visitNow(entry.animal.id, nowMs);
        if (!now) return null;
        const {state, run} = now;
        const L = state.level;
        const hold = state.phase === "hold";
        const m = visitMotion(state, run.anchor, run.place, pose, run.flies);
        const ground = this.groundOf(entry.animal.id, m.x, m.z);
        // Her heading: the way she walks while she walks, then her head to the young.
        const turn = state.phase === "back" ? ease((1 - L) * 4) : ease(L * 4 - 3);
        const yaw = state.phase === "back" ? lerpAngle(run.place.yaw, m.way, turn) : lerpAngle(m.way, run.place.yaw, turn);
        const x = m.x;
        const z = m.z;
        const moving = m.moving;
        const lift = m.lift;
        this.noteWay(entry.animal.id, hold ? "visit" : "stay", run.key, nowMs, hold ? waysOf(entry.animal.model_slug)?.lines.visit ?? this.visitLine(run.youngId) : null);
        return Object.assign({}, pose, {
            x,
            z,
            y: ground + lift,
            yaw,
            moving,
            aloft: run.flies && moving,
            doing: moving ? (run.flies ? "fly" : "wander") : hold ? (run.kind === "feed" ? "forage" : "watch") : pose.doing
        }, hold ? {nurse: run.youngId, beat: undefined} : null);
    }

    /** The visit sentence of the young one's species (a helper of another name says the family's). */
    private visitLine(youngId: string): string | null {
        const young = this.options.hooks.entryOf(youngId);
        return young ? waysOf(young.animal.model_slug)?.lines.visit ?? null : null;
    }

    /** The clump's middle in a stay slot: where its first member's day has it when the slot began. Cached. */
    private clumpCentre(key: string, mates: readonly string[], self: LiveAnimal, slot: number, slotStart: number): Pt | null {
        const cached = `${key}#c${slot}`;
        const known = this.spots.get(cached);
        if (known !== undefined) return known;
        let anchor: LiveAnimal | null = null;
        for (const id of mates) {
            anchor = this.options.hooks.entryOf(id);
            if (anchor) break;
        }
        const at = this.options.hooks.poseAt(anchor ?? self, slotStart / 1000);
        let centre: Pt | null = at ? {x: at.x, z: at.z} : null;
        const wet = Boolean(self.depth || self.place.water);
        if (centre && !wet && !this.landAt(centre)) centre = null;
        if (this.spots.size > 3000) this.spots.clear();
        this.spots.set(cached, centre);
        return centre;
    }

    /** A young one of a species whose young gather (a creche, a nymph cluster, a shoal): in the clump of its kind there, which moves on by the slot. */
    private clusterPose<P extends LivePose>(entry: LiveAnimal, pose: P, nowMs: number): P | null {
        const id = entry.animal.id;
        const key = this.clumpOf.get(id);
        const mates = key ? this.clumps.get(key) : null;
        if (!key || !mates || mates.length < 2) return null;
        const clock = familyClock(key, nowMs);
        const centre = this.clumpCentre(key, mates, entry, clock.stay, clock.stayStart);
        if (!centre) return null;
        const prev = this.clumpCentre(key, mates, entry, clock.stay - 1, clock.stayStart - 720_000) ?? centre;
        const index = mates.indexOf(id);
        const move = moveBlend(clumpSpot(prev, index, mates.length, entry.length), clumpSpot(centre, index, mates.length, entry.length), nowMs - clock.stayStart);
        const wet = Boolean(entry.depth || entry.place.water);
        const ways = this.ageOf(entry)?.ways;
        this.noteWay(id, "cluster", `cluster:${key}:${clock.stay}`, nowMs, ways?.lines.cluster ?? null);
        this.counts.young++;
        return Object.assign({}, pose, {
            x: move.x,
            z: move.z,
            y: wet ? pose.y : this.groundOf(id, move.x, move.z),
            yaw: move.yaw ?? pose.yaw,
            moving: move.moving,
            aloft: false,
            doing: move.moving ? "wander" : pose.doing === "sleep" ? "sleep" : pose.moving ? "rest" : pose.doing
        });
    }

    /** Notes what a young one (or its visitor) shows of its species' ways now (the one record per animal is kept, not made again every frame). */
    private noteWay(id: string, way: WayKind, key: string, nowMs: number, line: string | null) {
        const known = this.wayNowOf.get(id);
        if (known && known.way === way && known.key === key && known.speciesLine === line) known.at = nowMs;
        else this.wayNowOf.set(id, {way, key, at: nowMs, speciesLine: line});
    }

    /** What a young one (or a visitor) is showing now of its species' ways, for the log: once an episode; null when nothing. */
    wayNow(id: string, nowMs: number): {way: WayKind; key: string; line: string} | null {
        const now = this.wayNowOf.get(id);
        if (!now || nowMs - now.at > 1500 || !now.speciesLine) return null;
        return {way: now.way, key: now.key, line: now.speciesLine};
    }

    /** At high water: a land animal standing on covered ground walks up the beach. */
    private offTheTide<P extends LivePose>(entry: LiveAnimal, pose: P): P {
        // (Standing well above the water: nothing to sample.)
        if (entry.depth || pose.aloft || this.seaLevel <= 0.02 || pose.y >= this.seaLevel + 0.04) return pose;
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
        const started = performance.now();
        this.drawnNow(entry, at, info, elapsed);
        const took = performance.now() - started;
        this.spent += took;
        this.split.drawn += took;
    }

    private drawnNow(entry: LiveAnimal, at: {x: number; base: number; z: number; yaw: number; afloat: boolean; inWater: boolean}, info: {distance: number; asleep: boolean; aloft: boolean; resting: boolean; alarmed: number; called: boolean; hours: number}, elapsed: number) {
        const plan = this.options.hooks.planOf(entry.animal.model_slug) ?? "";
        if (info.distance < TRACE_WITHIN && !info.aloft) {
            const surface = at.inWater && Math.abs(at.base - this.seaLevel) < Math.max(entry.drawnHeight * 0.6, 0.15);
            // (Only near the water's level is the ground worth sampling: a full height sample per animal per frame is not free.)
            const wading = !at.inWater && !entry.depth && at.base < this.seaLevel + 0.3 && this.options.hooks.heightAt(at.x, at.z) < this.seaLevel - 0.02;
            this.traces.observe({id: entry.animal.id, x: at.x, y: at.base, z: at.z, yaw: at.yaw, length: entry.length, onGround: !at.afloat && !at.inWater, atSurface: surface || wading, bird: plan === "bird", distance: info.distance}, elapsed, this.environment);
        }
        if (this.audio.playing) {
            const mood: ArkCallMood = callMood({asleep: info.asleep, alarm: info.alarmed > 0.3, resting: info.resting || this.weather.rain > 0.5, dawnSinger: DAWN_SINGERS.has(plan), hours: info.hours});
            this.audioAnimals.push({id: entry.animal.id, speciesProfileId: entry.animal.species_profile_id, kindSpeciesProfileId: entry.animal.kind_species_profile_id ?? null, x: at.x, y: at.base + entry.drawnHeight * 0.6, z: at.z, mood});
            if (info.called) this.alarms.push(entry.animal.id);
        }
    }

    /** 0…1 how far its head is up in a call now (sound on: the call it was heard making). */
    callLiftOf(animalId: string): number {
        const call = this.audio.playing ? this.audio.callOf(animalId) : null;
        return call ? callLift(this.nowMs - call.at, call.ms) : 0;
    }

    // MARK: Once a frame

    /** After the animals: the weather drawn, the traces' clocks, the sound, the worn paths. */
    step(elapsed: number, nowMs: number, camera: PerspectiveCamera, target: Vector3, fog: Fog | null, horizon: Color, width: number, height: number, hours: number, scheduled: () => LiveAnimal[], routeOf: (entry: LiveAnimal, fromS: number, toS: number, stepS: number) => Array<{x: number; z: number}>) {
        const started = performance.now();
        // The world's moment this frame (the environment itself is read every 2 s; calls need the moment now).
        this.nowMs = nowMs;
        const underwater = camera.position.y < this.seaLevel - 0.02;
        const lightning = lightningAt(this.nowMs, this.environment.storm);
        this.horizon.copy(horizon);
        this.weatherFx.update({rain: this.environment.rain, wind: this.environment.wind, windDirection: this.environment.windDirection, fog: this.environment.fog, storm: this.environment.storm, lightning, seaLevel: this.seaLevel, underwater}, camera, target, fog, this.horizon, this.options.renderer, width, height);
        this.traces.step(elapsed);
        // Sound: the animals heard this frame, the beds round the camera (a few times a second).
        if (this.audio.playing) {
            const forward = new Vector3().setFromMatrixColumn(camera.matrixWorld, 2).negate();
            const yaw = Math.atan2(forward.x, forward.z);
            if (elapsed - this.bedsAt > 0.4 || elapsed < this.bedsAt) {
                this.bedsAt = elapsed;
                // The beds round what the camera looks at (`ambient-beds.ts`, the ambient lane), from the scene's water and zones.
                const ground = sampleGround(target.x, target.z);
                const zone: AmbientInput["zone"] = ground.height < -0.5 ? (ground.reef > 0.5 ? "coral_reef" : "open_ocean") : (ground.weights as unknown as Record<string, number>);
                const input: AmbientInput = {
                    zone,
                    weather: {rain: this.environment.rain, wind: this.environment.wind, storm: this.environment.storm, insects: this.weather.insects, cold: this.weather.cold},
                    hour: hours,
                    tide: {height: Math.min(Math.max(this.seaLevel / 0.35, -1), 1)},
                    cameraPos: {x: target.x, y: target.y, z: target.z, yaw},
                    nearWater: {...waterNear(target.x, target.z, this.seaLevel), underwater},
                    eyeDistance: camera.position.distanceTo(target),
                    format: this.audio.format,
                    maxBeds: ARK_SOUND_TIERS[soundTier(this.tier, this.lite)].beds,
                    nowMs: this.nowMs
                };
                this.beds = selectAmbientBeds(input).map((bed) => ({...bed, credits: ambientCredits([bed.id])}));
            }
            // Thunder after each of the storm's flashes, the sound's travel time later (the same flashes `lightningAt` draws).
            if (this.environment.storm > 0.05) {
                const from = Math.max(this.thunderTo, this.nowMs);
                const to = this.nowMs + 1500;
                this.audio.preload([AMBIENT_THUNDER.near.id, AMBIENT_THUNDER.far.id].map((id) => bedUrl(id, this.audio.format)));
                for (const clap of thunderClaps({fromMs: from, toMs: to, storm: this.environment.storm, yaw, format: this.audio.format})) {
                    this.audio.shot({...clap, credits: ambientCredits([clap.id])}, this.nowMs);
                }
                this.thunderTo = to;
            } else {
                this.thunderTo = this.nowMs;
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
        this.split.step += performance.now() - started;
        this.spent += performance.now() - started;
        this.spentFrames.push(this.spent);
        this.lastSplit = this.split;
        this.split = {pose: 0, drawn: 0, step: 0};
        if (this.spentFrames.length > 60) this.spentFrames.shift();
        this.spent = 0;
        this.last = {...this.counts};
        this.counts.sheltering = 0;
        this.counts.young = 0;
        this.counts.tideMoved = 0;
    }

    /** Last frame's numbers (the scene's stats). */
    stats() {
        const traces = this.traces.stats();
        const sound = this.audio.activity();
        const ms = this.spentFrames.length ? this.spentFrames.reduce((sum, v) => sum + v, 0) / this.spentFrames.length : 0;
        const r = (v: number) => Math.round(v * 1000) / 1000;
        return {...this.last, ms: r(ms), split: {pose: r(this.lastSplit.pose), drawn: r(this.lastSplit.drawn), step: r(this.lastSplit.step)}, drops: this.weatherFx.now.drops, haze: Math.round(this.weatherFx.now.haze * 100) / 100, ...traces, voices: sound.voices, beds: sound.beds, soundOn: sound.on};
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

/** The river's line every 1.5 m, with how shallow it runs (the terrain draws white water where it is shallow). */
let riverSamples: Array<{x: number; z: number; shallow: boolean}> | null = null;
function riverPoints(heightAt: (x: number, z: number) => number) {
    if (riverSamples) return riverSamples;
    const out: Array<{x: number; z: number; shallow: boolean}> = [];
    for (let i = 1; i < RIVER.length; i++) {
        const [ax, az] = RIVER[i - 1];
        const [bx, bz] = RIVER[i];
        const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 1.5));
        for (let k = 0; k < steps; k++) {
            const x = ax + ((bx - ax) * k) / steps;
            const z = az + ((bz - az) * k) / steps;
            const depth = -heightAt(x, z);
            out.push({x, z, shallow: depth > 0.05 && depth < 0.55});
        }
    }
    riverSamples = out;
    return out;
}

/**
 * Metres from (x, z) to the sea, the river, its white water, the lake and the garden pond (and where, for panning),
 * measured on the scene's own map (`world.ts`). The waterfall: the bigger wild island's (p4, `islands/wild/falls.ts`), heard
 * from the foot of its sheet; today's island has none.
 */
export function waterNear(x: number, z: number, seaLevel: number, heightAt: (x: number, z: number) => number = (px, pz) => sampleGround(px, pz).height): NonNullable<AmbientInput["nearWater"]> {
    const ground = sampleGround(x, z);
    const theta = Math.atan2(z, x);
    const coast = coastRadius(theta);
    const sea = ground.height < seaLevel && ground.inland < 0 ? {distance: 0, x, z} : {distance: Math.max(ground.inland, 0), x: Math.cos(theta) * coast, z: Math.sin(theta) * coast};
    let river = {distance: Infinity, x, z};
    let rapids = {distance: Infinity, x, z};
    for (const p of riverPoints(heightAt)) {
        const d = Math.hypot(p.x - x, p.z - z);
        if (d < river.distance) river = {distance: d, x: p.x, z: p.z};
        if (p.shallow && d < rapids.distance) rapids = {distance: d, x: p.x, z: p.z};
    }
    const lakeD = Math.hypot(x - LAKE.x, z - LAKE.z);
    const lake = {distance: Math.max(lakeD - LAKE.r, 0), x: LAKE.x, z: LAKE.z};
    const pondD = Math.hypot(x - GARDEN_POND.x, z - GARDEN_POND.z);
    const pond = {distance: Math.max(pondD - GARDEN_POND.radius, 0), x: GARDEN_POND.x, z: GARDEN_POND.z};
    // (Islands mode, `no-hamlet.ts`: no garden pond to hear.)
    // p4 (waterfall): the falls' roar, measured to the pool where the sheet strikes it; a 31 m drop carries further than
    // the bed's own reach (made for a stream's cascade), so it counts as nearer by a third.
    const falls = arkWorld() === "v2" ? fallsSoundAt() : null;
    const waterfall = falls ? {distance: Math.max(Math.hypot(x - falls.x, z - falls.z) - 4, 0) * 0.67, x: falls.x, z: falls.z} : null;
    return {sea, river: Number.isFinite(river.distance) ? river : null, rapids: Number.isFinite(rapids.distance) ? rapids : null, waterfall, lake, pond: noHamlet() ? null : pond};
}

/** The sound tier for a quality tier (the lighter view hears as the low tier). */
export function soundTier(tier: QualityTier, lite: boolean): ArkSoundTier {
    return lite ? "low" : tier;
}
