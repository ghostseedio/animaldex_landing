/**
 * The ant colonies' harness page (development only; `scripts/ark-ants-strips.mjs` builds it into `.ark-golden/ants/`
 * and serves it, nothing deploys it). The live scene with a cast-only snapshot (`?scene=ghost|fire|leafcutter|army|
 * weaver`) on a controlled clock. For the trail scenes a made-up server record (a fixture: a House Cricket's death, as
 * the event log would give it) is handed to `addDeaths` beside the colony: the body is the real food the trail goes to.
 * `window.__ants.shot(epoch, distance, at)` sets the world time, frames a point and waits for it to be drawn.
 */

import {decodeArkSnapshot, mountArk} from "@/ark-scene";
import type {ArkCameraView, ArkSceneHandle} from "@/ark-scene/types";
import type {ArkEventAnimal} from "@/lib/ark-life";
import fixture from "@/ark-scene/fixtures/snapshot-v2.json";

const MODELS = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/talking-models/v1/ark";
const ICONS = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/";

type Raw = (typeof fixture)["animals"][number];
type Cast = {slug: string; name: string; n: number; activity?: string | null; condition?: string};
type Scene = {zone: string; hours: number; cast: Cast[]; victim?: Cast};

const SCENES: Record<string, Scene> = {
    ghost: {zone: "farm_garden", hours: 11, cast: [{slug: "ghost-ant", name: "Ghost Ant", n: 4, activity: "any"}], victim: {slug: "house-cricket", name: "House Cricket", n: 1}},
    fire: {zone: "farm_garden", hours: 11, cast: [{slug: "red-imported-fire-ant", name: "Red Imported Fire Ant", n: 4, activity: "any"}], victim: {slug: "house-cricket", name: "House Cricket", n: 1}},
    leafcutter: {zone: "rainforest", hours: 10, cast: [{slug: "leafcutter-ant", name: "Leafcutter Ant", n: 3, activity: "any", condition: "well_fed"}]},
    army: {zone: "rainforest", hours: 10, cast: [{slug: "eciton-army-ant", name: "Eciton Army Ant", n: 3, activity: "diurnal"}]},
    weaver: {zone: "rainforest", hours: 10, cast: [{slug: "asian-weaver-ant", name: "Asian Weaver Ant", n: 4, activity: "diurnal"}], victim: {slug: "house-cricket", name: "House Cricket", n: 1}}
};

const castId = (k: number, i: number) => `0000a0a0-0000-4000-8000-${(k * 256 + i).toString(16).padStart(12, "0")}`;
const speciesId = (k: number) => `5bec1e50-0000-4000-8000-${(k + 40).toString(16).padStart(12, "0")}`;

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

type AntsDebug = {colonies: Array<{key: string; slug: string; nest: {x: number; y: number; z: number}; plan: {food: string; phase: string; strength: number; found: number; home: number} | null; plant: string | null}>; foods: Array<{key: string; x: number; z: number}>; drawn: number; trails: number; ms: number};

async function main() {
    const params = new URLSearchParams(location.search);
    const name = params.get("scene") ?? "ghost";
    const sc = SCENES[name];
    (globalThis as {__arkQuality?: string}).__arkQuality = params.get("quality") ?? "high";
    const template = fixture.animals[0];
    const casts = sc.victim ? [...sc.cast, sc.victim] : sc.cast;
    const animals: Raw[] = [];
    casts.forEach((c, k) => {
        for (let i = 0; i < c.n; i++) animals.push({...template, id: castId(k, i), species_profile_id: speciesId(k), name: c.name, scientific_name: c.name, model_slug: c.slug, zone: sc.zone, activity: c.activity ?? "diurnal", sociality: null, condition: c.condition ?? "well_fed", slot: 90 + k, slot_rank: i} as Raw);
    });
    const snapshot = decodeArkSnapshot({...fixture, animals});
    if (!snapshot) throw new Error("fixture did not decode");
    let ready = false;
    const handle: ArkSceneHandle = mountArk(document.getElementById("ark")!, {snapshot, modelBase: MODELS, iconUrl: (slug) => ICONS + encodeURIComponent(slug) + ".webp", recording: true, hours: sc.hours, onReady: () => (ready = true)});
    handle.setEnvironment({seaLevel: 0, wetness: 0, snow: 0, wind: 0.1, storm: 0, windDirection: 0.4, rain: params.has("rain") ? 0.8 : 0, fog: 0});
    const date = Date.UTC(2026, 10, 20, sc.hours) / 1000;
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
    await setAt(date);
    const until = realPerfNow() + 120_000;
    while (realPerfNow() < until && (!ready || handle.loading())) await wait(200);
    const debug = () => (window as unknown as {__arkAnts?: {debug: () => AntsDebug}}).__arkAnts?.debug() ?? null;
    // The ants' layer loads with the first colony ant; wait for its colonies.
    for (let i = 0; i < 100 && !debug()?.colonies.length; i++) {
        fake!.perf += 1100;
        fake!.date += 1100;
        await frames(2);
        await wait(50);
    }
    const colony = debug()?.colonies[0];
    if (!colony) throw new Error("no colony");
    console.log("[ants] colony", JSON.stringify(colony));
    // The trail scenes: a House Cricket dies a little way from the nest (the fixture's record).
    let death: {t0: number; x: number; z: number} | null = null;
    if (sc.victim) {
        const k = sc.cast.length;
        const v = sc.victim;
        const t0 = date + 30;
        const angle = 0.7;
        const d = name === "weaver" ? 2.2 : name === "fire" ? 1.6 : 0.9;
        const x = colony.nest.x + Math.cos(angle) * d;
        const z = colony.nest.z + Math.sin(angle) * d;
        const animal: ArkEventAnimal = {id: castId(k, 0), species_profile_id: speciesId(k), name: v.name, model_slug: v.slug, zone: sc.zone as ArkEventAnimal["zone"], arrived_at: "2026-11-12T00:00:00Z", origin: "arrived", generation: 0, slot: 90 + k, slot_rank: 0, activity: "any", sociality: null, status: null};
        (handle as unknown as {addDeaths: (d: unknown[]) => void}).addDeaths([{key: "death:fixture-1", animal, t0, at: {x, z}, cause: "old"}]);
        death = {t0, x, z};
        await setAt(t0 + 5);
        for (let i = 0; i < 4; i++) {
            fake!.perf += 1100;
            fake!.date += 1100;
            await frames(2);
        }
    }
    const api = {
        info: () => ({colony: debug()?.colonies[0] ?? null, death, date, foods: debug()?.foods ?? []}),
        /** The world at `epoch`, framing `at` from `distance` (m). */
        shot: async (epoch: number, distance: number, at: {x: number; z: number; y?: number}, polar = 1.0, azimuth = 0.7) => {
            await setAt(epoch - 1.2);
            for (let i = 0; i < 12; i++) {
                fake!.perf += 100;
                fake!.date += 100;
                await frames(1);
            }
            const ground = handle.heightAt(at.x, at.z);
            const view: ArkCameraView = {target: {x: at.x, y: at.y ?? ground + 0.002, z: at.z}, distance, polar, azimuth};
            handle.setView(view);
            await frames(4);
            const d = debug();
            const c = d?.colonies[0];
            const lines = (handle as unknown as {seen?: () => {acts: Array<{words?: {key: string; other: string | null}; episode: string}>}}).seen?.().acts.filter((a) => a.words).map((a) => `${a.words!.key}${a.words!.other ? `(${a.words!.other})` : ""}`) ?? [];
            return `ants ${d?.drawn ?? 0}  ${c?.plan ? `trail ${c.plan.phase} ${c.plan.strength.toFixed(2)}` : "no trail (searching)"}  ${d?.ms.toFixed(2)} ms  log: ${lines.join(", ") || "-"}`;
        },
        handle
    };
    (window as unknown as {__ants: typeof api}).__ants = api;
}

main().catch((error) => {
    console.error("[ants]", error?.stack ?? error);
    (window as unknown as {__antsError?: string}).__antsError = String(error?.stack ?? error);
});
