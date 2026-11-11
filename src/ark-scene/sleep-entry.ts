/**
 * The sleep clips' page (development only; `scripts/ark-sleep-clips.mjs` builds it into `.ark-golden/sleep/` and
 * serves it, nothing deploys it). The live scene with a cast-only snapshot (`?clip=night|den`), on a controlled
 * clock: `window.__clip.frame(i)` sets the world time and the camera for frame `i` of the clip's shots and waits for
 * it to be drawn.
 *
 * - `night`: the grassland at 01:30 (the hour pinned): a Grevy's zebra herd asleep standing with one on watch,
 *   wildebeest lying, lions sprawled, starlings tucked on a branch; then the camera walks at a sleeping wildebeest
 *   and it wakes with a start.
 * - `den`: a bat-eared fox at dawn (the island clock running): it walks back to its den and goes in to sleep.
 */

import {decodeArkSnapshot, mountArk} from "@/ark-scene";
import type {ArkCameraView, ArkLocated, ArkSceneHandle} from "@/ark-scene/types";
import {scheduleWorld, SLOT_SECONDS, tripAt, poseOnTrip, type ScheduleAnimal} from "@/ark-scene/behaviour-schedule";
import type {ArkBehaviourProfile} from "@/ark-scene/behaviour-profile";
import {worldSampler} from "@/ark-scene/world-sampler";
import {islandHours} from "@/lib/ark-clock";
import fixture from "@/ark-scene/fixtures/snapshot-v2.json";

const MODELS = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/talking-models/v1/ark";
const ICONS = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/";

type Raw = (typeof fixture)["animals"][number];
const SPECIES: Record<string, {id: string; name: string; zone: string; activity: string | null; sociality: string | null}> = {
    "grevys-zebra": {id: "9bea2025-e1b9-4ab7-96eb-2bfb90dfcbfc", name: "Grevy's Zebra", zone: "grassland", activity: "diurnal", sociality: "group"},
    "blue-wildebeest": {id: "dcddd54a-4b25-4762-aa18-468236f6f901", name: "Blue Wildebeest", zone: "grassland", activity: "diurnal", sociality: "group"},
    "african-lion": {id: "7e7080ec-9c17-4a75-9d85-5a4f6a38e430", name: "African Lion", zone: "grassland", activity: null, sociality: "group"},
    "superb-starling": {id: "53678f18-8bb2-45d6-9024-7f7ee6ad8de2", name: "Superb Starling", zone: "grassland", activity: "diurnal", sociality: "group"},
    "bat-eared-fox": {id: "6a332339-5b72-4af5-832b-4fefde7df320", name: "Bat-eared Fox", zone: "grassland", activity: null, sociality: null}
};

type Ctx = {
    world: ReturnType<typeof scheduleWorld>;
    animals: Array<{id: string; slug: string; animal: ScheduleAnimal; profile: ArkBehaviourProfile; activity: ArkBehaviourProfile["activity"] | null}>;
    hoursAt: (epoch: number) => number;
    date0: number;
};
/** A shot: from `at` seconds into the clip, the camera (fixed, or moving with the clip's time). */
type Shot = {at: number; label: string; view: (u: number, locate: (id: string) => ArkLocated | null) => ArkCameraView};
type Script = {start: number; seconds: number; fps: number; shots: Shot[]; note: string};
type Clip = {cast: Array<[string, number]>; hours: number | null; date: number; find: (ctx: Ctx) => Script | null};

const view = (x: number, y: number, z: number, distance: number, polar = 1.15, azimuth = 0.6): ArkCameraView => ({target: {x, y, z}, distance, polar, azimuth});
const centroid = (list: Array<{x: number; y: number; z: number}>) => ({x: list.reduce((s, p) => s + p.x, 0) / list.length, y: list.reduce((s, p) => s + p.y, 0) / list.length, z: list.reduce((s, p) => s + p.z, 0) / list.length});

const CLIPS: Record<string, Clip> = {
    night: {
        cast: [["grevys-zebra", 7], ["blue-wildebeest", 6], ["african-lion", 4], ["superb-starling", 5]],
        hours: 1.5,
        date: Date.UTC(2026, 10, 12, 1, 30) / 1000,
        find: (ctx) => {
            const t = ctx.date0 + 30;
            const at = (slug: string) => ctx.animals.filter((a) => a.slug === slug).map((a) => ({a, p: poseOnTrip(ctx.world, tripAt(ctx.world, a.profile, a.animal, t, ctx.hoursAt, a.activity), t), doing: tripAt(ctx.world, a.profile, a.animal, t, ctx.hoursAt, a.activity).doing}));
            const zebras = at("grevys-zebra");
            const gnus = at("blue-wildebeest");
            const lions = at("african-lion");
            const birds = at("superb-starling");
            if (!zebras.length || !lions.length) return null;
            const zc = centroid(zebras.map((z) => z.p));
            const lc = centroid(lions.map((l) => l.p));
            const bird = birds.find((b) => b.doing === "sleep") ?? birds[0];
            const gnu = gnus.find((g) => g.doing === "sleep") ?? gnus[0];
            const all = centroid([...zebras, ...gnus, ...lions].map((x) => x.p));
            const shots: Shot[] = [
                {at: 0, label: "the grassland at 01:30: a zebra herd, wildebeest and lions asleep", view: (u) => view(all.x, all.y + 0.8, all.z, 46 - 6 * u, 0.98, 0.5 + 0.15 * u)},
                {at: 8, label: "Grevy's zebras: asleep on their feet, one keeping watch", view: (u) => view(zc.x, zc.y + 1.1, zc.z, 16, 1.12, 1.0 + 0.4 * u)},
                {at: 20, label: "lions sprawled: on their sides, chests, curled; breathing, a stir", view: (u) => view(lc.x, lc.y + 0.4, lc.z, 9, 1.0, 2.2 + 0.35 * u)},
                ...(bird ? [{at: 32, label: "superb starlings tucked on a branch", view: (u: number) => view(bird.p.x, bird.p.y + 0.1, bird.p.z, 2.6, 1.3, 0.3 + 0.3 * u)}] : []),
                ...(gnu ? [{at: 40, label: "the camera walks at a sleeping wildebeest: it wakes with a start", view: (u: number) => view(gnu.p.x, gnu.p.y + 0.8, gnu.p.z, Math.max(16 - 13 * Math.min(u * 1.6, 1), 3), 1.12, 0.9)}] : [])
            ];
            const doings = [...zebras, ...gnus, ...lions, ...birds].map((x) => `${x.a.slug.split("-")[0]}:${x.doing}:${x.a.animal.group ? `${x.a.animal.group.rank}/${x.a.animal.group.size}` : "-"}`).join(" ");
            return {start: ctx.date0, seconds: 56, fps: 10, shots, note: doings};
        }
    },
    lab: {
        // Development: lions asleep at midday (crepuscular: down while the sun is high), each close, to judge the postures.
        cast: [["african-lion", 6]],
        hours: 13,
        date: Date.UTC(2026, 10, 12, 13) / 1000,
        find: (ctx) => {
            const t = ctx.date0 + 30;
            const lions = ctx.animals.map((a) => ({a, p: poseOnTrip(ctx.world, tripAt(ctx.world, a.profile, a.animal, t, ctx.hoursAt, a.activity), t)}));
            const shots: Shot[] = lions.map((l, i) => ({at: i * 3, label: `lion ${l.a.id.slice(-2)}`, view: () => view(l.p.x, l.p.y + 0.4, l.p.z, 4.2, 1.05, 0.4 + i * 1.1)}));
            return {start: ctx.date0, seconds: lions.length * 3, fps: 10, shots, note: "lab"};
        }
    },
    eyes: {
        // Development: close on sleeping heads (eyes shut, breathing) at midday, then the same heads awake at 18:30.
        cast: [["african-lion", 6]],
        hours: Number(new URLSearchParams(location.search).get("hours") ?? 13),
        date: Date.UTC(2026, 10, 12, 13) / 1000,
        find: (ctx) => {
            const t = ctx.date0 + 30;
            const list = ctx.animals.map((a) => ({a, p: poseOnTrip(ctx.world, tripAt(ctx.world, a.profile, a.animal, t, ctx.hoursAt, a.activity), t)}));
            const shots: Shot[] = list.map((l, i) => ({
                at: i * 4,
                label: `${l.a.slug} ${l.a.id.slice(-2)} head`,
                // Where it is drawn now (the scene's own), its head a little ahead of its middle.
                view: (_u, locate) => {
                    const at = locate(l.a.id) ?? {x: l.p.x, y: l.p.y, z: l.p.z, yaw: l.p.yaw, length: l.a.animal.length, height: 1, ground: l.p.y, awake: false};
                    const hx = at.x + Math.sin(at.yaw) * at.length * 0.36;
                    const hz = at.z + Math.cos(at.yaw) * at.length * 0.36;
                    return view(hx, at.ground + at.height * 0.3, hz, 4, 1.32, at.yaw + 0.45);
                }
            }));
            return {start: ctx.date0, seconds: list.length * 4, fps: 10, shots, note: "eyes"};
        }
    },
    den: {
        cast: [["bat-eared-fox", 2]],
        hours: null,
        date: Date.UTC(2026, 10, 12, 6, 10) / 1000,
        find: (ctx) => {
            // The slot it heads back to its den (to_roost) in the dawn, and where its den is.
            for (const a of ctx.animals) {
                for (let t = ctx.date0; t < ctx.date0 + 3 * 3600; t += SLOT_SECONDS) {
                    const trip = tripAt(ctx.world, a.profile, a.animal, t, ctx.hoursAt, a.activity);
                    if (trip.doing !== "to_roost") continue;
                    const den = trip.to;
                    const from = trip.from;
                    const side = Math.atan2(from.x - den.x, from.z - den.z) + 0.9;
                    const start = Math.max(trip.arrive - 22, trip.start);
                    return {
                        start,
                        seconds: 44,
                        fps: 10,
                        shots: [{at: 0, label: `a bat-eared fox goes back to its den at dawn (${den.point ?? "no den point"})`, view: () => view(den.x, den.y + 0.25, den.z, 6.5, 1.25, side)}],
                        note: `${a.id} to_roost at ${new Date(t * 1000).toISOString()} arrive ${new Date(trip.arrive * 1000).toISOString()} point ${den.point}`
                    };
                }
            }
            return null;
        }
    }
};

function castId(k: number, i: number): string {
    return `0000beef-0000-4000-8000-${(k * 256 + i).toString(16).padStart(12, "0")}`;
}
function castAnimals(cast: Clip["cast"]): Raw[] {
    const template = fixture.animals[0];
    const out: Raw[] = [];
    cast.forEach(([slug, n], k) => {
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
    const name = params.get("clip") ?? "night";
    const clip = CLIPS[name];
    (globalThis as {__arkQuality?: string}).__arkQuality = params.get("quality") ?? "high";
    const snapshot = decodeArkSnapshot({...fixture, animals: castAnimals(clip.cast)});
    if (!snapshot) throw new Error("fixture did not decode");
    let ready = false;
    const el = document.getElementById("ark")!;
    const handle: ArkSceneHandle = mountArk(el, {snapshot, modelBase: MODELS, iconUrl: (slug) => ICONS + encodeURIComponent(slug) + ".webp", recording: true, hours: clip.hours, onReady: () => (ready = true)});
    handle.setEnvironment({seaLevel: 0, wetness: 0, snow: 0, wind: 0.2, storm: 0, windDirection: 0.4});
    handle.setClockScale(1, clip.date * 1000);
    const until = realPerfNow() + 120_000;
    while (realPerfNow() < until && (!ready || handle.loading())) await wait(200);
    const debug = (window as unknown as {__arkDebug: {entries: () => Array<{animal: {id: string; model_slug: string; activity: ArkBehaviourProfile["activity"] | null}; sched?: {animal: ScheduleAnimal; profile: ArkBehaviourProfile} | null}>}}).__arkDebug;
    const ctx: Ctx = {
        world: scheduleWorld(worldSampler()),
        animals: debug
            .entries()
            .filter((e) => e.sched)
            .map((e) => ({id: e.animal.id, slug: e.animal.model_slug, animal: e.sched!.animal, profile: e.sched!.profile, activity: e.animal.activity})),
        hoursAt: (epoch: number) => clip.hours ?? islandHours(epoch * 1000, 0),
        date0: clip.date
    };
    const script = clip.find(ctx);
    const setAt = async (epoch: number) => {
        const ms = epoch * 1000;
        if (!fake) {
            fake = {date: ms, perf: realPerfNow()};
            handle.setClockScale(1, ms);
        } else {
            fake.perf += ms - fake.date;
            fake.date = ms;
        }
        await frames(3);
    };
    const shotAt = (s: number) => {
        const list = script!.shots;
        let k = 0;
        for (let i = 0; i < list.length; i++) if (s >= list[i].at) k = i;
        const end = k + 1 < list.length ? list[k + 1].at : script!.seconds;
        return {shot: list[k], u: (s - list[k].at) / Math.max(end - list[k].at, 1e-3)};
    };
    const api = {
        script: script ? {seconds: script.seconds, fps: script.fps, note: script.note, shots: script.shots.map((s) => ({at: s.at, label: s.label}))} : null,
        /** Frame `i` of the clip: the world time, the camera, and a label. */
        /** Development: draw the eyes open (to compare the shut ones). */
        eyesOpen: async (open: boolean) => {
            (globalThis as {__arkEyesOpen?: boolean}).__arkEyesOpen = open;
            await frames(3);
        },
        frame: async (i: number) => {
            const s = i / script!.fps;
            const {shot, u} = shotAt(s);
            const v = shot.view(u, (id) => handle.locate(id));
            handle.setView(v);
            await setAt(script!.start + s);
            // What the animals in view are doing (development: the sleep, the reactive layer's wake).
            const near = (debug.entries() as unknown as Array<{animal: {id: string; model_slug: string}; middle: {x: number; z: number} | null; sleepNow?: {t: number; posture: string} | null; denIn?: number; reactive?: {action: string; woke?: boolean} | null; state: {kind: string; doing?: string}}>)
                .filter((e) => e.middle && Math.hypot(e.middle.x - v.target.x, e.middle.z - v.target.z) < 9)
                .map((e) => `${e.animal.model_slug.split("-")[0]}${e.animal.id.slice(-2)} ${e.state.doing ?? e.state.kind} ${e.sleepNow ? `${e.sleepNow.posture} ${e.sleepNow.t.toFixed(2)}` : "up"}${e.denIn ? ` in its den ${e.denIn.toFixed(2)}` : ""}${e.reactive ? ` ${e.reactive.action}${e.reactive.woke ? " WOKE" : ""}` : ""}`)
                .slice(0, 8);
            return `${shot.label}   +${s.toFixed(1)} s\n${near.join("\n")}`;
        }
    };
    if (script) {
        handle.setView(script.shots[0].view(0, (id) => handle.locate(id)));
        await setAt(script.start - 3);
        const wait2 = realPerfNow() + 30_000;
        while (realPerfNow() < wait2 && handle.loading()) await wait(200);
        await wait(1500);
    }
    (window as unknown as {__clip: typeof api}).__clip = api;
}

void main();
