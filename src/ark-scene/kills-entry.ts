/**
 * The kills harness's page (development only; `scripts/ark-kills-clips.mjs` builds it into `.ark-golden/kills/` and
 * serves it, nothing deploys it). The live scene with a cast-only snapshot (`?pair=lion|heron|hawk|python`) on a
 * controlled clock, and a made-up server meal (a fixture: the event's records and its encounter, as the hunting read
 * and the event log would give them) handed to `setMeals`: the live world acts it from its step. `window.__kills.shot(s,
 * label)` sets the world time to `s` seconds after the step, frames the meal and waits for it to be drawn.
 */

import {decodeArkSnapshot, mountArk} from "@/ark-scene";
import type {ArkCameraView, ArkSceneHandle} from "@/ark-scene/types";
import type {ArkAct, ArkEventAnimal} from "@/lib/ark-life";
import fixture from "@/ark-scene/fixtures/snapshot-v2.json";

const MODELS = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/talking-models/v1/ark";
const ICONS = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/";

type Raw = (typeof fixture)["animals"][number];
type Cast = {slug: string; name: string; n: number; activity?: string | null};
type Pair = {zone: string; hours: number; predator: Cast; prey: Cast; others: Cast[]; date: number};

const PAIRS: Record<string, Pair> = {
    // A big cat on an antelope, two vultures and a hyena about (scavengers by diet), a little after sunrise.
    lion: {zone: "grassland", hours: 8, date: Date.UTC(2026, 10, 20, 8) / 1000, predator: {slug: "african-lion", name: "African Lion", n: 1, activity: "any"}, prey: {slug: "impala", name: "Impala", n: 1}, others: [{slug: "white-backed-vulture", name: "White-backed Vulture", n: 2, activity: "diurnal"}, {slug: "marabou-stork", name: "Marabou Stork", n: 1, activity: "diurnal"}]},
    // A heron on a fish in the river.
    heron: {zone: "river_lake", hours: 9, date: Date.UTC(2026, 10, 20, 9) / 1000, predator: {slug: "grey-heron", name: "Grey Heron", n: 1, activity: "any"}, prey: {slug: "rainbow-trout", name: "Rainbow Trout", n: 1}, others: []},
    // A raptor on a small mammal, a raven about.
    hawk: {zone: "grassland", hours: 10, date: Date.UTC(2026, 10, 20, 10) / 1000, predator: {slug: "red-tailed-hawk", name: "Red-tailed Hawk", n: 1, activity: "any"}, prey: {slug: "european-rabbit", name: "European Rabbit", n: 1}, others: [{slug: "common-raven", name: "Common Raven", n: 1, activity: "diurnal"}]},
    // A snake on a rodent.
    python: {zone: "grassland", hours: 11, date: Date.UTC(2026, 10, 20, 11) / 1000, predator: {slug: "african-rock-python", name: "African Rock Python", n: 1, activity: "any"}, prey: {slug: "brown-rat", name: "Brown Rat", n: 1}, others: []}
};

function castId(k: number, i: number): string {
    return `0000feed-0000-4000-8000-${(k * 256 + i).toString(16).padStart(12, "0")}`;
}
function speciesId(k: number): string {
    return `5bec1e50-0000-4000-8000-${k.toString(16).padStart(12, "0")}`;
}

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

async function main() {
    const params = new URLSearchParams(location.search);
    const name = params.get("pair") ?? "lion";
    const pair = PAIRS[name];
    (globalThis as {__arkQuality?: string}).__arkQuality = params.get("quality") ?? "high";
    const template = fixture.animals[0];
    const casts = [pair.predator, pair.prey, ...pair.others];
    const animals: Raw[] = [];
    casts.forEach((c, k) => {
        for (let i = 0; i < c.n; i++) animals.push({...template, id: castId(k, i), species_profile_id: speciesId(k), name: c.name, scientific_name: c.name, model_slug: c.slug, zone: pair.zone, activity: c.activity ?? "diurnal", sociality: null, slot: 90 + k, slot_rank: i} as Raw);
    });
    const snapshot = decodeArkSnapshot({...fixture, animals});
    if (!snapshot) throw new Error("fixture did not decode");
    let ready = false;
    const handle: ArkSceneHandle = mountArk(document.getElementById("ark")!, {snapshot, modelBase: MODELS, iconUrl: (slug) => ICONS + encodeURIComponent(slug) + ".webp", recording: true, hours: pair.hours, onReady: () => (ready = true)});
    handle.setEnvironment({seaLevel: 0, wetness: 0, snow: 0, wind: 0.15, storm: 0, windDirection: 0.4, rain: 0, fog: 0});
    const t0 = pair.date + 60;
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
    await setAt(t0 - 20);
    const until = realPerfNow() + 120_000;
    while (realPerfNow() < until && (!ready || handle.loading())) await wait(200);
    console.log("[kills] loaded", ready, handle.loading());
    await setAt(t0 - 2);
    await wait(800);
    const predatorId = castId(0, 0);
    const preyId = castId(1, 0);
    const hunter = handle.locate(predatorId);
    const quarry = handle.locate(preyId);
    if (!hunter || !quarry) throw new Error("cast not placed");
    // The encounter: the hunter where it is, the prey where it is (brought within 22 m of it, a foray's reach).
    const d = Math.hypot(quarry.x - hunter.x, quarry.z - hunter.z);
    const k = d > 22 ? 22 / d : 1;
    const hx = quarry.x + (hunter.x - quarry.x) * k;
    const hz = quarry.z + (hunter.z - quarry.z) * k;
    const record = (c: Cast, id: string, k2: number): ArkEventAnimal => ({id, species_profile_id: speciesId(k2), name: c.name, model_slug: c.slug, zone: pair.zone as ArkEventAnimal["zone"], arrived_at: "2026-11-12T00:00:00Z", origin: "arrived", generation: 0, slot: 90 + k2, slot_rank: 0, activity: (c.activity ?? "diurnal") as ArkEventAnimal["activity"], sociality: null, status: null});
    const act: Extract<ArkAct, {kind: "meal"}> = {kind: "meal", at: new Date(t0 * 1000).toISOString(), predator: record(pair.predator, predatorId, 0), prey: record(pair.prey, preyId, 1), phrase: null, extinct: false, encounter: {t: t0, predator: {x: hx, z: hz}, prey: {x: quarry.x, z: quarry.z, r: 0.5}}};
    handle.setMeals?.([act]);
    await setAt(t0 + 0.05);
    await frames(4);
    const debug = (window as unknown as {__arkDebug: {meals: () => Array<Record<string, unknown> & {carcass: {x: number; z: number} | null; catchAt: number}>; entries: () => Array<{animal: {id: string; model_slug: string}; act: Record<string, unknown> | null}>; traces: () => unknown[]}}).__arkDebug;
    const info = debug.meals()[0];
    const centre = info?.carcass ?? {x: quarry.x, z: quarry.z};
    const ground = handle.heightAt(centre.x, centre.z);
    const view = (distance: number, polar = 1.12, azimuth = 0.7, at: {x: number; z: number} = centre, lift = 0.4): ArkCameraView => ({target: {x: at.x, y: Math.max(ground, 0) + lift, z: at.z}, distance, polar, azimuth});
    const api = {
        info: () => debug.meals(),
        /** The world at `s` seconds after the meal's step, from `distance` (or following an animal: `follow`). */
        shot: async (s: number, distance: number, follow?: string, polar?: number) => {
            // (Up to the moment in small steps, so the rigs' one-shots, lying down and getting up, play as they would.)
            await setAt(t0 + s - 2.5);
            for (let i = 1; i <= 25; i++) {
                fake!.perf += 100;
                fake!.date += 100;
                await frames(1);
            }
            // (`?jaw=1`: on the prey itself, wherever it is drawn: the swallow's view.)
            const preyAct = params.has("jaw") ? debug.entries().find((e) => e.animal.id === preyId && e.act && !e.act.hidden)?.act ?? null : null;
            const who = preyAct ? {x: Number(preyAct.x), z: Number(preyAct.z), y: Number(preyAct.base)} : follow ? handle.locate(follow) : null;
            handle.setView(view(distance, polar ?? 1.12, 0.7, who ? {x: who.x, z: who.z} : centre, who ? Math.max(who.y - Math.max(ground, 0), 0) + 0.4 : 0.4));
            await frames(3);
            const acts = debug
                .entries()
                .filter((e) => e.act)
                .map((e) => `${e.animal.model_slug} ${String(e.act!.meal ?? "-")} ${String(e.act!.state ?? "")}${e.act!.hidden ? " hidden" : ""}${e.act!.lying ? ` lying ${Number(e.act!.lying).toFixed(2)}` : ""}${params.has("where") ? ` at ${Number(e.act!.x).toFixed(2)},${Number(e.act!.z).toFixed(2)} y ${Number(e.act!.base).toFixed(2)} s ${Number(e.act!.scale).toFixed(2)} drawn ${(e as unknown as {middle: {x: number; z: number} | null}).middle ? `${(e as unknown as {middle: {x: number; z: number}}).middle.x.toFixed(2)},${(e as unknown as {middle: {x: number; z: number}}).middle.z.toFixed(2)}` : "-"} ${JSON.stringify({level: (e as unknown as {level: string}).level, held: (e as unknown as {held: boolean}).held, den: (e as unknown as {denIn?: number}).denIn, micro: Boolean((e as unknown as {place: {micro?: unknown; burrow?: unknown}}).place.micro), burrow: Boolean((e as unknown as {place: {burrow?: unknown}}).place.burrow), ghost: (e as unknown as {ghost?: boolean}).ghost, model: Boolean((window as unknown as {__arkDebug: {library: {get: (s: string) => unknown; has: (s: string) => boolean}}}).__arkDebug.library.get(e.animal.model_slug)), has: (window as unknown as {__arkDebug: {library: {has: (s: string) => boolean}}}).__arkDebug.library.has(e.animal.model_slug), mid: (e as unknown as {middle: unknown}).middle, air: (e as unknown as {air: number}).air, len: (e as unknown as {length: number}).length})}` : ""}`);
            const status = (id: string) => handle.animalStatus?.(id)?.activity ?? "-";
            const hunt = handle.liveHunt?.();
            return `+${s.toFixed(1)} s   predator card: ${status(predatorId)}   marker: ${hunt ? `${hunt.phase} ${hunt.name}` : "none"}   traces: ${debug.traces().length}\n${acts.join("\n")}`;
        },
        handle
    };
    (window as unknown as {__kills: typeof api}).__kills = api;
}

main().catch((error) => {
    console.error("[kills]", error?.stack ?? error);
    (window as unknown as {__killsError?: string}).__killsError = String(error?.stack ?? error);
});
