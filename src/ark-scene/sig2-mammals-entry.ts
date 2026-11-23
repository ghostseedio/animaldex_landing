/**
 * The mammals' signature-behaviour harness (sig2, mammals; development only: `scripts/ark-sig2-mammals-clips.mjs`
 * builds it into `.ark-golden/sig2-mammals/` and serves it, nothing deploys it). The live scene with a cast-only snapshot
 * on a controlled clock and a pinned hour (as `recipes-entry.ts`), for two kinds of picture:
 *
 *   sleep:  a group of one kind asleep (`sleepStyle(slug).social`: huddle, pile, cluster), framed from outside the group,
 *           with how close the animals lie (the nearest neighbour's gap in body lengths) against the kind's own length;
 *   recipe: the species' recipe episode found with the engine's own pure functions (`tripAt`, `tripEpisode`) and played
 *           frame by frame: a stone hammer's pounding, a worm drawn from the litter, a drey carried to its fork.
 *
 * `window.__sig2` has the scene's moment (`info`), `at(epoch)` and `frame(spec)`.
 */

import {decodeArkSnapshot, mountArk} from "@/ark-scene";
import type {ArkCameraView, ArkSceneHandle} from "@/ark-scene/types";
import {scheduleWorld, SLOT_SECONDS, tripAt, tripEpisode, recipeNest, roostOf, type ScheduleAnimal, type Trip} from "@/ark-scene/behaviour-schedule";
import {nestStageAt, speciesRecipes, type Episode} from "@/ark-scene/behaviour-recipes";
import {sleepStyle} from "@/ark-scene/sleep";
import type {ArkBehaviourProfile} from "@/ark-scene/behaviour-profile";
import {worldSampler} from "@/ark-scene/world-sampler";
import fixture from "@/ark-scene/fixtures/snapshot-v2.json";

const MODELS = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/talking-models/v1/ark";
const ICONS = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/";

type Raw = (typeof fixture)["animals"][number];
type Activity = "diurnal" | "nocturnal" | "crepuscular" | "any";
type Scene = {
    zone: string;
    /** The pinned hour of the day (the scene's own clock). */
    hours: number;
    /** The day the clock starts (UTC ms). */
    date: number;
    slug: string;
    name: string;
    n: number;
    activity: Activity;
    kind: "sleep" | "recipe";
    /** recipe: the template, and the block (and its kind of key) to frame. */
    recipe?: string;
    block?: string;
    /** recipe: where to look in the day's slots from `date`, hours. */
    within?: number;
};

const day = (month: number, d = 20) => Date.UTC(2026, month - 1, d, 0) / 1000;
const SCENES: Record<string, Scene> = {
    // MARK: Sleeping together (the sleep layer: huddle, pile, cluster). (Each is shown asleep at noon, as a night animal: the sleep
    // is the same whichever hour a kind keeps, and a night's own light is too dark to see by.)
    "sleep-ring-tailed-lemur": {zone: "rainforest", hours: 13, date: day(11), slug: "ring-tailed-lemur", name: "Ring-tailed Lemur", n: 5, activity: "nocturnal", kind: "sleep"},
    "sleep-tufted-capuchin": {zone: "rainforest", hours: 13, date: day(11), slug: "tufted-capuchin", name: "Tufted Capuchin", n: 5, activity: "nocturnal", kind: "sleep"},
    "sleep-barbary-macaque": {zone: "mountains", hours: 13, date: day(11), slug: "barbary-macaque", name: "Barbary Macaque", n: 5, activity: "nocturnal", kind: "sleep"},
    "sleep-sugar-glider": {zone: "woodland", hours: 13, date: day(11), slug: "sugar-glider", name: "Sugar Glider", n: 5, activity: "nocturnal", kind: "sleep"},
    "sleep-zebu": {zone: "farm_garden", hours: 13, date: day(11), slug: "zebu", name: "Zebu", n: 5, activity: "nocturnal", kind: "sleep"},
    "sleep-collared-peccary": {zone: "desert", hours: 13, date: day(11), slug: "collared-peccary", name: "Collared Peccary", n: 5, activity: "nocturnal", kind: "sleep"},
    "sleep-guinea-pig": {zone: "farm_garden", hours: 13, date: day(11), slug: "guinea-pig", name: "Guinea Pig", n: 5, activity: "nocturnal", kind: "sleep"},
    "sleep-capybara": {zone: "wetland", hours: 13, date: day(11), slug: "capybara", name: "Capybara", n: 5, activity: "nocturnal", kind: "sleep"},
    "sleep-domestic-sheep": {zone: "farm_garden", hours: 13, date: day(11), slug: "domestic-sheep", name: "Domestic Sheep", n: 6, activity: "nocturnal", kind: "sleep"},
    "sleep-kuhls-pipistrelle-bat": {zone: "woodland", hours: 13, date: day(11), slug: "kuhls-pipistrelle-bat", name: "Kuhl's Pipistrelle Bat", n: 6, activity: "nocturnal", kind: "sleep"},
    // (SIG3: the other tree sleepers, a troop on its leader's branch.)
    "sleep-bolivian-squirrel-monkey": {zone: "rainforest", hours: 13, date: day(11), slug: "bolivian-squirrel-monkey", name: "Bolivian Squirrel Monkey", n: 5, activity: "nocturnal", kind: "sleep"},
    "sleep-coppery-titi-monkey": {zone: "rainforest", hours: 13, date: day(11), slug: "coppery-titi-monkey", name: "Coppery Titi Monkey", n: 5, activity: "nocturnal", kind: "sleep"},
    "sleep-stump-tailed-macaque": {zone: "rainforest", hours: 13, date: day(11), slug: "stump-tailed-macaque", name: "Stump-tailed Macaque", n: 5, activity: "nocturnal", kind: "sleep"},
    "sleep-common-marmoset": {zone: "rainforest", hours: 13, date: day(11), slug: "common-marmoset", name: "Common Marmoset", n: 5, activity: "nocturnal", kind: "sleep"},
    "sleep-long-tailed-macaque": {zone: "rainforest", hours: 13, date: day(11), slug: "long-tailed-macaque", name: "Long-tailed Macaque", n: 5, activity: "nocturnal", kind: "sleep"},
    // (A control: a kind with no sleeping together.)
    "sleep-control-red-deer": {zone: "grassland", hours: 13, date: day(11), slug: "red-deer", name: "Red Deer", n: 5, activity: "nocturnal", kind: "sleep"},
    // MARK: Recipe episodes
    "stone-long-tailed-macaque": {zone: "rainforest", hours: 10, date: day(11), slug: "long-tailed-macaque", name: "Long-tailed Macaque", n: 4, activity: "diurnal", kind: "recipe", recipe: "stone_hammer", block: "pound", within: 24},
    "stone-tufted-capuchin": {zone: "rainforest", hours: 10, date: day(11), slug: "tufted-capuchin", name: "Tufted Capuchin", n: 4, activity: "diurnal", kind: "recipe", recipe: "stone_hammer", block: "pound", within: 24},
    "worm-javan-ferret-badger": {zone: "rainforest", hours: 22, date: day(11), slug: "javan-ferret-badger", name: "Javan Ferret-Badger", n: 3, activity: "nocturnal", kind: "recipe", recipe: "worm_dig", block: "pull", within: 24},
    "nest-eastern-gray-squirrel": {zone: "woodland", hours: 10, date: Date.UTC(2026, 6, 4) / 1000, slug: "eastern-gray-squirrel", name: "Eastern Gray Squirrel", n: 3, activity: "diurnal", kind: "recipe", recipe: "nest_build", block: "place", within: 24},
    "nest-red-squirrel": {zone: "woodland", hours: 10, date: Date.UTC(2026, 8, 4) / 1000, slug: "red-squirrel", name: "Red Squirrel", n: 3, activity: "diurnal", kind: "recipe", recipe: "nest_build", block: "place", within: 24},
    "nest-desert-cottontail": {zone: "desert", hours: 10, date: Date.UTC(2026, 2, 5) / 1000, slug: "desert-cottontail", name: "Desert Cottontail", n: 3, activity: "crepuscular", kind: "recipe", recipe: "nest_build", block: "place", within: 24},
    "nest-malaysian-field-rat": {zone: "grassland", hours: 22, date: day(11), slug: "malaysian-field-rat", name: "Malaysian Field Rat", n: 3, activity: "nocturnal", kind: "recipe", recipe: "nest_build", block: "place", within: 24},
    "nest-red-river-hog": {zone: "rainforest", hours: 22, date: day(11), slug: "red-river-hog", name: "Red River Hog", n: 3, activity: "nocturnal", kind: "recipe", recipe: "nest_build", block: "place", within: 24}
};

const castId = (i: number) => `0000feed-0000-4000-8000-${i.toString(16).padStart(12, "0")}`;
const SPECIES_ID = "5bec1e50-0000-4000-8000-000000000001";

const realDateNow = Date.now.bind(Date);
const realPerfNow = performance.now.bind(performance);
let fake: {date: number; perf: number} | null = null;
Date.now = () => (fake ? fake.date : realDateNow());
performance.now = () => (fake ? fake.perf : realPerfNow());
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const frames = (n: number) =>
    new Promise<void>((resolve) => {
        let left = n;
        const tick = () => (--left <= 0 ? resolve() : requestAnimationFrame(tick));
        requestAnimationFrame(tick);
    });

type Ctx = {world: ReturnType<typeof scheduleWorld>; animals: Array<{id: string; animal: ScheduleAnimal; profile: ArkBehaviourProfile}>; hours: number; date: number; activity: Activity};
const trips = (ctx: Ctx, a: Ctx["animals"][number], from: number, hours: number): Trip[] => {
    const out: Trip[] = [];
    for (let t = from; t < from + hours * 3600; t += SLOT_SECONDS) out.push(tripAt(ctx.world, a.profile, a.animal, t, () => ctx.hours, ctx.activity));
    return out;
};

async function main() {
    const params = new URLSearchParams(location.search);
    const name = params.get("scene") ?? "sleep-ring-tailed-lemur";
    const scene = SCENES[name];
    (globalThis as {__arkQuality?: string}).__arkQuality = params.get("quality") ?? "high";
    const template = fixture.animals[0];
    const animals: Raw[] = [];
    for (let i = 0; i < scene.n; i++) {
        animals.push({...template, id: castId(i), species_profile_id: SPECIES_ID, name: scene.name, scientific_name: scene.name, model_slug: scene.slug, zone: scene.zone, activity: scene.activity, sociality: "group", slot: 90, slot_rank: i, origin: "arrived", born_ark_day: 0} as Raw);
    }
    const snapshot = decodeArkSnapshot({...fixture, animals});
    if (!snapshot) throw new Error("fixture did not decode");
    let ready = false;
    const handle: ArkSceneHandle = mountArk(document.getElementById("ark")!, {snapshot, modelBase: MODELS, iconUrl: (slug) => ICONS + encodeURIComponent(slug) + ".webp", recording: true, hours: scene.hours, onReady: () => (ready = true)});
    handle.setEnvironment({seaLevel: 0, wetness: 0, snow: 0, wind: 0.15, storm: 0, windDirection: 0.4, rain: 0, fog: 0});
    handle.setClockScale(1, scene.date * 1000);
    const until = realPerfNow() + 300_000;
    while (realPerfNow() < until && (!ready || handle.loading())) await wait(200);
    console.log("[sig2] loaded", ready, handle.loading());
    const debug = (window as unknown as {__arkDebug: {entries: () => Array<{animal: {id: string; model_slug: string}; sched?: {animal: ScheduleAnimal; profile: ArkBehaviourProfile}}>; controls: {minDistance: number}; camera: {near: number; updateProjectionMatrix: () => void}}}).__arkDebug;
    const ctx: Ctx = {
        world: scheduleWorld(worldSampler()),
        animals: debug.entries().filter((e) => e.sched).map((e) => ({id: e.animal.id, animal: e.sched!.animal, profile: e.sched!.profile})),
        hours: scene.hours,
        date: scene.date,
        activity: scene.activity
    };
    const at = async (epoch: number, ticks = 3) => {
        const ms = epoch * 1000;
        if (!fake) {
            fake = {date: ms, perf: realPerfNow()};
            handle.setClockScale(1, ms);
        } else {
            fake.perf += ms - fake.date;
            fake.date = ms;
        }
        await frames(ticks);
    };
    const close = (distance: number) => {
        debug.controls.minDistance = Math.min(debug.controls.minDistance, distance);
        debug.camera.near = 0.03;
        debug.camera.updateProjectionMatrix();
    };
    /** The group's places now: centre, the widest spread, mean body length, and each one's nearest neighbour's gap in body lengths. */
    const group = () => {
        const at = scene.n ? Array.from({length: scene.n}, (_, i) => handle.locate(castId(i))).filter((p): p is NonNullable<typeof p> => Boolean(p)) : [];
        if (!at.length) return null;
        const cx = at.reduce((s, p) => s + p.x, 0) / at.length;
        const cy = at.reduce((s, p) => s + p.y, 0) / at.length;
        const cz = at.reduce((s, p) => s + p.z, 0) / at.length;
        const length = at.reduce((s, p) => s + p.length, 0) / at.length;
        const gaps = at.map((p, i) => Math.min(...at.filter((_, j) => j !== i).map((q) => Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z)), Infinity) / Math.max(p.length, 0.01));
        const spread = Math.max(...at.map((p) => Math.hypot(p.x - cx, p.z - cz)));
        return {x: cx, y: cy, z: cz, length, spread, gaps: gaps.map((g) => Number(g.toFixed(2))), meanGap: Number((gaps.reduce((s, g) => s + g, 0) / gaps.length).toFixed(2)), ys: at.map((p) => Number((p.y - p.ground).toFixed(2)))};
    };
    const statuses = () => Array.from({length: scene.n}, (_, i) => handle.animalStatus?.(castId(i))?.activity ?? "-");
    const api: Record<string, unknown> = {name, scene, social: sleepStyle(scene.slug).social, ownNest: speciesRecipes(scene.slug).ownNest, group, statuses, at, close};
    let moment: {start: number; seconds: number; step: number; view: ArkCameraView; note: string; id: string; aim?: {x: number; y: number; z: number}} | null = null;

    if (scene.kind === "recipe") {
        // The first episode of the recipe whose block has a key worth framing: found with the engine's own functions.
        const tally = {trips: 0, episodes: 0, shapes: {} as Record<string, number>};
        search: for (const a of ctx.animals) {
            for (const trip of trips(ctx, a, scene.date + (scene.recipe === "nest_build" ? 0 : 0), scene.within ?? 24)) {
                if (trip.recipe !== scene.recipe) continue;
                const ep: Episode | null = tripEpisode(ctx.world, trip);
                tally.trips++;
                if (!ep) continue;
                tally.episodes++;
                const shape = ep.keys.map((k) => k.block.id).join(">");
                tally.shapes[shape] = (tally.shapes[shape] ?? 0) + 1;
                const key = ep.keys.find((k) => k.block.id === scene.block && (scene.block !== "pull" || k.catch?.ok));
                if (!key) continue;
                const first = ep.keys[0];
                const toNest = scene.recipe === "nest_build" ? ep.keys.find((k) => k.carry?.item === "material" && k.block.motion === "travel") : null;
                const start = (toNest ?? key).t0 - 6;
                const last = ep.keys[ep.keys.length - 1];
                const aim = scene.recipe === "nest_build" ? {x: key.to.x, y: key.to.y, z: key.to.z} : {x: key.from.x, y: key.from.y, z: key.from.z};
                moment = {start, seconds: Math.min(Math.max(last.t1 - start, 12), 34), step: 0.5, view: {target: aim, distance: scene.recipe === "nest_build" ? 3.2 : 2.4, polar: 1.15, azimuth: 0.9}, note: `${a.id.slice(-3)} ${scene.recipe}: ${ep.keys.map((k) => k.block.id).join(" ")}; first ${first.block.id} ${first.t0.toFixed(0)}, ${scene.block} at ${key.t0.toFixed(0)}`, id: a.id, aim};
                break search;
            }
        }
        if (scene.recipe === "nest_build") {
            const a = ctx.animals[0];
            const site = recipeNest(ctx.world, a.profile, a.animal, scene.date);
            api.nest = {site, stage: nestStageAt(scene.slug, scene.date + 86400 * 3)};
        }
        // (The moment's view: from the animal itself, a little back, side on.)
        console.log("[sig2] moment", moment ? moment.note : "none", JSON.stringify(tally));
    }
    api.moment = moment;
    /** One picture of the recipe moment: the world at `epoch`, the camera on the actor (or its nest) from `distance`. */
    api.look = async (epoch: number, distance: number, follow: boolean, polar = 1.2, azimuth = 0.9) => {
        await at(epoch, 4);
        close(distance);
        const id = moment?.id ?? castId(0);
        const p = handle.locate(id);
        const aim = follow || !moment?.aim ? (p ? {x: p.x, y: p.y + p.length * 0.35, z: p.z} : moment?.aim) : moment.aim;
        if (aim) handle.setView({target: aim, distance, polar, azimuth});
        await frames(3);
        const pose = (debug.entries().find((e) => e.animal.id === id) as unknown as {sched?: {pose?: {beat?: string; act?: {recipe?: string; state?: string; carry?: {item: string} | null} | null}}} | undefined)?.sched?.pose;
        return `t=${epoch.toFixed(1)} beat ${pose?.beat ?? "-"} recipe ${pose?.act?.recipe ?? "-"} state ${pose?.act?.state ?? "-"} carry ${pose?.act?.carry?.item ?? "-"} card ${handle.animalStatus?.(id)?.activity ?? "-"}`;
    };
    /** A picture of the sleeping group (or the control): the world at `epoch` (the clock on in tenths), framed from outside it. */
    api.sleeping = async (epoch: number, lengths: number, polar = 1.05, azimuth = 0.7) => {
        await at(epoch - 2);
        for (let i = 0; i < 20; i++) {
            fake!.perf += 100;
            fake!.date += 100;
            await frames(1);
        }
        const g = group();
        if (!g) return "no group";
        close(Math.max(g.spread * 2.2, lengths * g.length));
        handle.setView({target: {x: g.x, y: g.y + g.length * 0.25, z: g.z}, distance: Math.max(g.spread * 2.4 + g.length * 2, lengths * g.length), polar, azimuth});
        await frames(4);
        const roosts = ctx.animals.map((a) => {
            const r = roostOf(ctx.world, a.profile, a.animal);
            const yaw = handle.locate(a.id)?.yaw;
            return `${a.id.slice(-2)}:${(r.point ?? "-").slice(0, 28)}${r.along ? " along" : ""}${r.heading === undefined ? "" : ` h${r.heading.toFixed(2)}`} yaw${yaw === undefined ? "-" : yaw.toFixed(2)}`;
        });
        console.log("[sig2] roosts", roosts.join(" | "));
        return `t=${epoch.toFixed(0)} cards ${statuses().join("/")} social ${api.social} meanGap ${g.meanGap} gaps ${g.gaps.join(",")} spread ${g.spread.toFixed(2)} m length ${g.length.toFixed(2)} m`;
    };
    (window as unknown as {__sig2: typeof api}).__sig2 = api;
}

main().catch((error) => {
    console.error("[sig2]", error?.stack ?? error);
    (window as unknown as {__sig2Error?: string}).__sig2Error = String(error?.stack ?? error);
});
