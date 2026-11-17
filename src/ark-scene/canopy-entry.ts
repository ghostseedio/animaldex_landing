/**
 * The canopy harness's page (development only; `scripts/ark-canopy-shots.mjs` builds it into `.ark-golden/canopy/`
 * and serves it, nothing deploys it). The live scene in islands mode on the real Ark (the snapshot file the script
 * serves as `real.json`, read in place, never committed), on a controlled clock, so the same moment of the shared
 * schedule can be framed before and after a change: a monkey on a trunk, a gibbon mid-swing, a troop in the canopy.
 *
 *   window.__canopy.at(epoch)                     the world at that time (s)
 *   window.__canopy.frame(id, distance, az, polar) the camera on an animal where it is drawn now
 *   window.__canopy.look(target, distance, az, polar) the camera on a point
 */

import {decodeArkSnapshot, mountArk} from "@/ark-scene";
import type {ArkSceneHandle} from "@/ark-scene/types";
import {canopyPhases} from "@/ark-scene/canopy-scene";

const MODELS = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/talking-models/v1/ark";
const ICONS = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/";

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

declare global {
    interface Window {
        __canopy?: Record<string, (...args: never[]) => unknown>;
        __canopyError?: string;
    }
}

async function main() {
    const params = new URLSearchParams(location.search);
    (globalThis as {__arkQuality?: string}).__arkQuality = params.get("quality") ?? "high";
    const raw = await (await fetch("real.json")).json();
    const decoded = decodeArkSnapshot(raw.snapshot ?? raw);
    if (!decoded) throw new Error("snapshot did not decode");
    const kept = new Set(["house", "farm", "zoo"]);
    const snapshot = {...decoded, animals: decoded.animals.map((animal) => {
        const own = animal as typeof animal & {island?: string | null; area?: string | null};
        return {...animal, island: own.island ?? (own.area && kept.has(own.area) ? "town" : "wild")} as typeof animal;
    })};
    const [{arkIslandSnapshot}, {loadTownScene}] = await Promise.all([import("@/lib/ark-islands"), import("@/ark-scene/islands/scene")]);
    const split = arkIslandSnapshot as unknown as (s: typeof snapshot, island: "wild" | "town") => typeof snapshot;
    const town = await (loadTownScene as unknown as (o: {tier: string; animals: unknown[]}) => Promise<unknown>)({tier: "high", animals: split(snapshot, "town").animals});
    const wild = split(snapshot, "wild");
    const epoch0 = Number(params.get("epoch") ?? Date.UTC(2026, 10, 17, 9) / 1000);
    fake = {date: epoch0 * 1000, perf: realPerfNow()};
    let ready = false;
    const handle: ArkSceneHandle = mountArk(document.getElementById("ark")!, {snapshot, modelBase: MODELS, iconUrl: (slug: string) => ICONS + encodeURIComponent(slug) + ".webp", recording: true, island: town as never, wildAnimals: wild.animals, openIsland: (params.get("island") ?? "wild") as never, onReady: () => (ready = true)} as never);
    handle.setEnvironment({seaLevel: 0, wetness: 0, snow: 0, wind: 0.15, storm: 0, windDirection: 0.4, rain: 0, fog: 0, cloud: 0.2});
    handle.setClockScale(1, epoch0 * 1000);
    const until = realPerfNow() + 150_000;
    while (realPerfNow() < until && (!ready || handle.loading())) await wait(200);
    const debug = (window as unknown as {__arkDebug: {controls: {minDistance: number}}}).__arkDebug;
    if (debug?.controls) debug.controls.minDistance = 0.3;
    const setAt = async (epoch: number) => {
        const ms = epoch * 1000;
        fake!.perf += ms - fake!.date;
        fake!.date = ms;
        await frames(2);
    };
    window.__canopy = {
        ready: () => ready && !handle.loading(),
        loading: () => handle.loading(),
        /** The world at an absolute time (s); `run` seconds of it played on at 10 frames a second first (rigs, eases). */
        at: async (epoch: number, run = 2) => {
            await setAt(epoch - run);
            for (let i = 0; i < run * 10; i++) {
                fake!.perf += 100;
                fake!.date += 100;
                await frames(1);
            }
            await frames(2);
            return true;
        },
        hours: (h: number | null) => handle.setHours(h),
        locate: (id: string) => handle.locate(id),
        frame: async (id: string, distance: number, azimuth = 0.7, polar = 1.3, lift = 0) => {
            // (Where it is drawn is only kept up to date near the camera: framed once, then again where it is drawn.)
            for (let k = 0; k < 3; k++) {
                const at = handle.locate(id);
                if (!at) return null;
                handle.setView({target: {x: at.x, y: at.y + lift, z: at.z}, distance, polar, azimuth});
                await frames(4);
            }
            // (Its models come in for the near view: a moment for them.)
            const end = realPerfNow() + 20_000;
            while (realPerfNow() < end && handle.loading()) await wait(150);
            await frames(4);
            return handle.locate(id);
        },
        look: async (target: {x: number; y: number; z: number}, distance: number, azimuth = 0.7, polar = 1.3) => {
            handle.setView({target, distance, polar, azimuth});
            await frames(4);
            const end = realPerfNow() + 20_000;
            while (realPerfNow() < end && handle.loading()) await wait(150);
            await frames(4);
            return true;
        },
        /** The animals of these kinds and their schedule beat now (to find a climb on the page's own schedule). */
        beats: (pattern: string) => {
            const re = new RegExp(pattern);
            const all = (window as unknown as {__arkDebug: {entries: () => Array<{animal: {id: string; model_slug: string}; sched?: {pose?: {beat?: string; moving?: boolean; y?: number; ny?: number}} | null}>}}).__arkDebug.entries();
            return all.filter((e) => re.test(e.animal.model_slug)).map((e) => ({id: e.animal.id, slug: e.animal.model_slug, beat: e.sched?.pose?.beat ?? null, moving: Boolean(e.sched?.pose?.moving), y: e.sched?.pose?.y ?? null, ny: e.sched?.pose?.ny ?? null}));
        },
        /** Scan forward from `from` (s) in `step`s for the first moment an animal of these kinds is on a climb, moving. */
        findClimb: async (pattern: string, from: number, seconds: number, step = 2, skip: string[] = []) => {
            for (let e = from; e < from + seconds; e += step) {
                await setAt(e);
                const hit = (window.__canopy!.beats as unknown as (p: string) => Array<{id: string; beat: string | null; moving: boolean}>)(pattern).find((b) => b.beat === "climb" && b.moving && !skip.includes(b.id));
                if (hit) return {epoch: e, ...hit};
            }
            return null;
        },
        /** Scan forward from `from` (s) for the first moment an animal of these kinds is in this canopy phase. */
        findCanopy: async (pattern: string, phases: string[], from: number, seconds: number, step = 1, skip: string[] = []) => {
            const re = new RegExp(pattern);
            const ids = (window as unknown as {__arkDebug: {entries: () => Array<{animal: {id: string; model_slug: string}}>}}).__arkDebug.entries().filter((e) => re.test(e.animal.model_slug) && !skip.includes(e.animal.id)).map((e) => e.animal.id);
            for (let e = from; e < from + seconds; e += step) {
                await setAt(e);
                for (const id of ids) {
                    const p = canopyPhases.get(id);
                    if (p && Math.abs(p.epoch - e) < 0.5 && phases.includes(p.phase)) return {id, phase: p.phase, air: p.air, epoch: e};
                }
            }
            return null;
        },
        view: () => handle.view(),
        homeView: () => handle.homeView()
    } as never;
}

main().catch((error) => {
    window.__canopyError = String(error?.stack ?? error);
    console.error(error);
});
