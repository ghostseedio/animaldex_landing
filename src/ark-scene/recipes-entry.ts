/**
 * The behaviour recipes' clip page (development only; `scripts/ark-recipe-clips.mjs` builds it into
 * `.ark-golden/recipes/` and serves it, nothing deploys it). The live scene with a cast-only snapshot for one
 * clip (`?clip=kingfisher|stags|murmuration|nest|heron|osprey`), at a pinned hour. It finds the moment with the
 * engine's own pure functions (a world built the same as the scene's, the scene's own wired animals), then
 * `window.__clip` steps a controlled clock frame by frame so a one-second dive gets every frame.
 */

import {decodeArkSnapshot, mountArk} from "@/ark-scene";
import type {ArkCameraView, ArkSceneHandle} from "@/ark-scene/types";
import {scheduleWorld, SLOT_SECONDS, tripAt, tripEpisode, recipeNest, poseOnTrip, type ScheduleAnimal, type Trip} from "@/ark-scene/behaviour-schedule";
import {microMurmuration, nestStageAt, pairWindows, sexLook, type RecipePose} from "@/ark-scene/behaviour-recipes";
import {heightAt} from "@/ark-scene/world";
import type {ArkBehaviourProfile} from "@/ark-scene/behaviour-profile";
import {worldSampler} from "@/ark-scene/world-sampler";
import fixture from "@/ark-scene/fixtures/snapshot-v2.json";

const MODELS = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/talking-models/v1/ark";
const ICONS = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/";

type Raw = (typeof fixture)["animals"][number];
type Species = {id: string; name: string; zone: string; activity: string | null; sociality: string | null};
const SPECIES: Record<string, Species> = {
    "common-kingfisher": {id: "0d991095-9587-402c-892c-a2cbea1750cf", name: "Common Kingfisher", zone: "river_lake", activity: "diurnal", sociality: null},
    "red-deer": {id: "9e4c04ec-46ac-4019-b396-7b9e5afb2028", name: "Red Deer", zone: "woodland", activity: "crepuscular", sociality: "group"},
    "european-starling": {id: "47097175-041c-45e3-8b17-19ecec9ad72d", name: "European Starling", zone: "farm_garden", activity: "diurnal", sociality: "group"},
    "black-billed-magpie": {id: "ddf29082-be9b-449a-9007-dbc34818102f", name: "Black-billed Magpie", zone: "woodland", activity: "diurnal", sociality: "group"},
    "grey-heron": {id: "18bed140-4543-4a6f-b741-d32f764b75ce", name: "Grey Heron", zone: "wetland", activity: "diurnal", sociality: null},
    osprey: {id: "360d1b44-2874-4312-aa80-c4f99d5e1156", name: "Osprey", zone: "seashore", activity: "diurnal", sociality: null}
};

type Moment = {start: number; seconds: number; step: number; view: ArkCameraView; note: string; follow?: string | null};
type Clip = {cast: Array<[string, string, number]>; hours: number; date: number; find: (ctx: Context) => Moment | null};
type Context = {world: ReturnType<typeof scheduleWorld>; animals: Array<{id: string; slug: string; animal: ScheduleAnimal; profile: ArkBehaviourProfile; activity: ArkBehaviourProfile["activity"] | null}>; micro: Array<{id: string; slug: string; at: {x: number; y: number; z: number}}>; hoursAt: (epoch: number) => number; date: number};

const view = (x: number, y: number, z: number, distance: number, polar = 1.15, azimuth = 0.6): ArkCameraView => ({target: {x, y, z}, distance, polar, azimuth});

/** Slots of an animal from a time on, with their trips. */
function trips(ctx: Context, a: Context["animals"][number], from: number, hours: number): Trip[] {
    const out: Trip[] = [];
    for (let t = from; t < from + hours * 3600; t += SLOT_SECONDS) out.push(tripAt(ctx.world, a.profile, a.animal, t, ctx.hoursAt, a.activity));
    return out;
}

const CLIPS: Record<string, Clip> = {
    kingfisher: {
        cast: [["kf", "common-kingfisher", 3]],
        hours: 10,
        date: Date.UTC(2026, 6, 14, 10) / 1000,
        find: (ctx) => {
            for (const a of ctx.animals) {
                for (const trip of trips(ctx, a, ctx.date, 6)) {
                    if (trip.recipe !== "perch_plunge") continue;
                    const ep = tripEpisode(ctx.world, trip);
                    const dive = ep?.keys.find((k) => k.block.id === "dive_air" && k.catch?.ok);
                    if (!ep || !dive) continue;
                    const perch = trip.to;
                    const mid = {x: (perch.x + dive.to.x) / 2, y: (perch.y + dive.to.y) / 2, z: (perch.z + dive.to.z) / 2};
                    const span = Math.hypot(perch.x - dive.to.x, perch.y - dive.to.y, perch.z - dive.to.z);
                    const side = Math.atan2(dive.to.x - perch.x, dive.to.z - perch.z) + Math.PI / 2;
                    // From the side, the perch and the water both in frame; half speed (48 steps a world second, played at 24).
                    return {start: dive.t0 - 2.5, seconds: 7, step: 1 / 48, view: view(mid.x, mid.y, mid.z, Math.max(span * 2.1, 6), 1.33, side), note: `${a.slug} ${a.id}: dive at ${dive.t0.toFixed(1)}, perch ${perch.y.toFixed(1)} m up, ${span.toFixed(1)} m to the water`};
                }
            }
            return null;
        }
    },
    stags: {
        cast: [["deer", "red-deer", 8]],
        // Crepuscular deer are up while the sun is under 22°: an early morning.
        hours: 6.4,
        date: Date.UTC(2026, 9, 6, 7) / 1000,
        find: (ctx) => {
            // Only inside the pairs' meeting windows (pure, from each pair's key): the first with a fight in it.
            for (const a of ctx.animals.filter((x) => sexLook(x.id, x.slug).sex === "male")) {
                for (const w of pairWindows(a.animal, a.slug, ctx.date, ctx.date + 2 * 86400)) {
                    for (let t = w.start; t < w.end; t += 1) {
                        const pa = poseOnTrip(ctx.world, tripAt(ctx.world, a.profile, a.animal, t, ctx.hoursAt, a.activity), t) as RecipePose;
                        if (pa.act?.block !== "fight") continue;
                        return {start: w.start - 1, seconds: Math.min(w.end - w.start, 70), step: 1 / 8, view: view(pa.x, pa.y + 1, pa.z, 11, 1.3, Math.atan2(pa.x, pa.z) + 1), note: `${a.id} and ${w.other}: ${w.template} window ${w.start}, fighting at ${t}`};
                    }
                }
            }
            return null;
        }
    },
    murmuration: {
        cast: [["st", "european-starling", 16]],
        hours: 17.8,
        date: Date.UTC(2026, 10, 11, 17) / 1000,
        find: (ctx) => {
            // House starlings (micro animals, off the schedule): their flock's murmuration is over their spot.
            const entry = ctx.micro[0];
            if (!entry) return null;
            const m = microMurmuration(entry.id, entry.slug, entry.at, ctx.date + 1200, ctx.hoursAt(0), heightAt);
            const c = m?.act.flock?.centre ?? entry.at;
            return {start: ctx.date + 1200, seconds: 30, step: 1 / 6, view: view(c.x, c.y + 16, c.z, 70, 1.38, 0.9), note: `centre ${c.x.toFixed(1)},${c.z.toFixed(1)}`};
        }
    },
    nest: {
        cast: [["mp", "black-billed-magpie", 2]],
        hours: 11,
        date: Date.UTC(2026, 3, 1, 11) / 1000,
        find: (ctx) => {
            const a = ctx.animals[0];
            const site = recipeNest(ctx.world, a.profile, a.animal, ctx.date + 86400);
            if (!site) return null;
            // A trip of it carrying material, a few days in.
            for (const trip of trips(ctx, a, ctx.date + 2.3 * 86400, 10)) {
                if (trip.recipe !== "nest_build") continue;
                const ep = tripEpisode(ctx.world, trip);
                const carry = ep?.keys.find((k) => k.carry?.item === "material" && k.block.motion === "travel");
                if (!ep || !carry) continue;
                return {start: carry.t0 - 2, seconds: 14, step: 1 / 8, view: view(site.x, site.y, site.z, 3.6, 1.33, 0.8), note: `site ${site.x.toFixed(1)},${site.y.toFixed(1)},${site.z.toFixed(1)}; stage now ${nestStageAt(a.slug, carry.t0).toFixed(2)}`};
            }
            return null;
        }
    },
    heron: {
        cast: [["he", "grey-heron", 2]],
        hours: 9,
        date: Date.UTC(2026, 6, 14, 9) / 1000,
        find: (ctx) => {
            for (const a of ctx.animals) {
                for (const trip of trips(ctx, a, ctx.date, 6)) {
                    if (trip.recipe !== "wade_spear") continue;
                    const ep = tripEpisode(ctx.world, trip);
                    const strike = ep?.keys.find((k) => k.block.id === "strike" && k.catch?.ok);
                    if (!ep || !strike) continue;
                    return {start: strike.t0 - 4, seconds: 9, step: 1 / 12, view: view(strike.from.x, strike.from.y + 0.6, strike.from.z, 4.5, 1.3, 1.1), note: `${a.id} strike at ${strike.t0}`};
                }
            }
            return null;
        }
    },
    osprey: {
        cast: [["os", "osprey", 2]],
        hours: 10,
        date: Date.UTC(2026, 6, 14, 10) / 1000,
        find: (ctx) => {
            for (const a of ctx.animals) {
                for (const trip of trips(ctx, a, ctx.date, 6)) {
                    if (trip.recipe !== "talon_grab") continue;
                    const ep = tripEpisode(ctx.world, trip);
                    const dive = ep?.keys.find((k) => k.block.id === "dive_feet" && k.catch?.ok);
                    if (!ep || !dive) continue;
                    return {start: dive.t0 - 3, seconds: 10, step: 1 / 16, view: view(dive.to.x, 2, dive.to.z, 14, 1.3, 0.3), note: `${a.id} dive at ${dive.t0}`};
                }
            }
            return null;
        }
    }
};

function castId(k: number, i: number): string {
    return `0000feed-0000-4000-8000-${(k * 256 + i).toString(16).padStart(12, "0")}`;
}

function castAnimals(cast: Clip["cast"]): Raw[] {
    const template = fixture.animals[0];
    const out: Raw[] = [];
    cast.forEach(([, slug, n], k) => {
        const sp = SPECIES[slug];
        for (let i = 0; i < n; i++) out.push({...template, id: castId(k, i), species_profile_id: sp.id, name: sp.name, scientific_name: sp.name, model_slug: slug, zone: sp.zone, activity: sp.activity, sociality: sp.sociality, slot: 90 + k, slot_rank: i} as Raw);
    });
    return out;
}

// MARK: The controlled clock (capture only)

const realDateNow = Date.now.bind(Date);
const realPerfNow = performance.now.bind(performance);
let fake: {date: number; perf: number} | null = null;
Date.now = () => (fake ? fake.date : realDateNow());
performance.now = () => (fake ? fake.perf : realPerfNow());

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const frames = (n: number) => new Promise<void>((resolve) => {
    let left = n;
    const tick = () => (--left <= 0 ? resolve() : requestAnimationFrame(tick));
    requestAnimationFrame(tick);
});

async function main() {
    const params = new URLSearchParams(location.search);
    const name = params.get("clip") ?? "kingfisher";
    const clip = CLIPS[name];
    (globalThis as {__arkQuality?: string}).__arkQuality = params.get("quality") ?? "high";
    const snapshot = decodeArkSnapshot({...fixture, animals: castAnimals(clip.cast)});
    if (!snapshot) throw new Error("fixture did not decode");
    let ready = false;
    const el = document.getElementById("ark")!;
    const handle: ArkSceneHandle = mountArk(el, {snapshot, modelBase: MODELS, iconUrl: (slug) => ICONS + encodeURIComponent(slug) + ".webp", recording: true, hours: clip.hours, onReady: () => (ready = true)});
    handle.setEnvironment({seaLevel: 0, wetness: 0, snow: 0, wind: 0.25, storm: 0, windDirection: 0.4});
    handle.setClockScale(1, clip.date * 1000);
    const until = realPerfNow() + 120_000;
    while (realPerfNow() < until && (!ready || handle.loading())) await wait(200);
    const debug = (window as unknown as {__arkDebug: {entries: () => Array<{animal: {id: string; model_slug: string; activity: ArkBehaviourProfile["activity"] | null}; place: {x: number; z: number; ground: number; micro?: unknown}; sched?: {animal: ScheduleAnimal; profile: ArkBehaviourProfile} | null}>}}).__arkDebug;
    const ctx: Context = {
        world: scheduleWorld(worldSampler()),
        animals: debug
            .entries()
            .filter((e) => e.sched)
            .map((e) => ({id: e.animal.id, slug: e.animal.model_slug, animal: e.sched!.animal, profile: e.sched!.profile, activity: e.animal.activity})),
        micro: debug
            .entries()
            .filter((e) => e.place.micro)
            .map((e) => ({id: e.animal.id, slug: e.animal.model_slug, at: {x: e.place.x, y: e.place.ground, z: e.place.z}})),
        hoursAt: () => clip.hours,
        date: clip.date
    };
    const moment = clip.find(ctx);
    const api = {
        moment,
        sexes: ctx.animals.map((a) => `${a.id.slice(-4)} ${sexLook(a.id, a.slug).sex}`),
        /** Sets the controlled clock to a world time (epoch seconds) and waits for the scene to draw it. */
        at: async (epoch: number) => {
            const ms = epoch * 1000;
            if (!fake) {
                fake = {date: ms, perf: realPerfNow()};
                handle.setClockScale(1, ms);
            } else {
                fake.perf += ms - fake.date;
                fake.date = ms;
            }
            await frames(3);
        },
        view: (v: ArkCameraView) => handle.setView(v),
        handle
    };
    if (moment) {
        handle.setView(moment.view);
        await api.at(moment.start - 4);
        // Near models in, at the first frame's place.
        const wait2 = realPerfNow() + 30_000;
        while (realPerfNow() < wait2 && handle.loading()) await wait(200);
        await wait(1500);
    }
    (window as unknown as {__clip: typeof api}).__clip = api;
}

void main();
