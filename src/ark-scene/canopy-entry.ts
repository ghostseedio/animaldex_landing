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
import {ledgeSeen} from "@/ark-scene/rock-ledge";
import {zooSeen} from "@/ark-scene/islands/town/zoo-swing";
import {Raycaster, Vector3, type Object3D} from "three";

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
    // (The view held where it is put, up in the crowns: otherwise the camera eases its target down to the ground under it
    // unless an animal is selected, as golden-entry.ts holds a golden shot's.)
    (window as unknown as {__arkGoldenCamera?: {free?: boolean}}).__arkGoldenCamera = {free: true};
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
        /** The clock on by `seconds` in 10 Hz frames (a clip's next frame), never back. */
        step: async (seconds: number) => {
            const n = Math.max(1, Math.round(seconds * 10));
            for (let i = 0; i < n; i++) {
                fake!.perf += (seconds * 1000) / n;
                fake!.date += (seconds * 1000) / n;
                await frames(1);
            }
            return true;
        },
        /** The camera kept on an animal where it is drawn now, without waiting for models (a clip's frame). */
        follow: async (id: string, distance: number, azimuth = 0.7, polar = 1.3, lift = 0) => {
            const at = handle.locate(id);
            if (!at) return null;
            handle.setView({target: {x: at.x, y: at.y + lift, z: at.z}, distance, polar, azimuth});
            await frames(1);
            return at;
        },
        hours: (h: number | null) => handle.setHours(h),
        /** Followed (lane ark-sleep): an animal the live budget is resting this turn is drawn all the same (a pin). */
        pin: (id: string | null) => handle.follow(id),
        /**
         * The light alone pinned to an hour (lane ark-sleep: night's sleepers seen in daylight; the schedule keeps the
         * world's own hour). null: the light follows the world's hour again.
         */
        light: (h: number | null) => {
            const lighting = (window as unknown as {__arkDebug?: {lighting?: {setHours: (hours: number, fog?: unknown) => void; __own?: (hours: number, fog?: unknown) => void}}}).__arkDebug?.lighting;
            if (!lighting) return;
            lighting.__own ??= lighting.setHours.bind(lighting);
            const own = lighting.__own;
            lighting.setHours = h === null ? own : (_hours: number, fog?: unknown) => own(h, fog);
        },
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
        /** A young one's age, its parent and the parent's state (to see why it is or is not carried). */
        young: (id: string) => {
            const dbg = (window as unknown as {__arkDebug: {liveliness: {ageOf: (e: unknown) => unknown; parentOf: (id: string) => string | null}; entries: () => Array<{animal: {id: string}; act?: unknown; sched?: unknown}>}}).__arkDebug;
            const all = dbg.entries();
            const e = all.find((x) => x.animal.id === id);
            if (!e) return {missing: true, count: all.length};
            const parent = dbg.liveliness.parentOf(id);
            const m = parent ? all.find((x) => x.animal.id === parent) : null;
            return {age: dbg.liveliness.ageOf(e), parent, mother: m ? {act: Boolean(m.act), sched: Boolean(m.sched), at: handle.locate(parent!)} : null, at: handle.locate(id)};
        },
        /** Scan forward from `from` (s) for the first moment an animal of these kinds is on a rock climb in this phase. */
        findLedge: async (pattern: string, phases: string[], from: number, seconds: number, step = 1, zoo = false) => {
            const seen = zoo ? zooSeen : ledgeSeen;
            const re = new RegExp(pattern);
            const ids = (window as unknown as {__arkDebug: {entries: () => Array<{animal: {id: string; model_slug: string}}>}}).__arkDebug.entries().filter((e) => re.test(e.animal.model_slug)).map((e) => e.animal.id);
            for (let e = from; e < from + seconds; e += step) {
                await setAt(e);
                for (const id of ids) {
                    const p = seen.get(id);
                    if (p && Math.abs(p.epoch - e) < 0.5 && phases.includes(p.phase)) return {id, phase: p.phase, epoch: e};
                }
            }
            return null;
        },
        /** Objects drawn with a non-finite world matrix now (a NaN in a pose blooms white), and the camera. */
        nanScan: () => {
            const dbg = (window as unknown as {__arkDebug: {scene: {traverse: (f: (o: {name: string; type: string; visible: boolean; matrixWorld: {elements: number[]}; parent: unknown; userData: unknown}) => void) => void}; camera: {position: {x: number; y: number; z: number}}}}).__arkDebug;
            const bad: string[] = [];
            dbg.scene.traverse((o) => {
                if (o.matrixWorld.elements.some((v) => !Number.isFinite(v)) && bad.length < 12) bad.push(`${o.type} ${o.name} ${JSON.stringify(o.userData).slice(0, 80)}`);
            });
            return {bad, camera: dbg.camera.position};
        },
        /** One animal's schedule state now (why it is or is not out on its canopy route). */
        who: (id: string) => {
            const e = (window as unknown as {__arkDebug: {entries: () => Array<{animal: {id: string}; level?: string; state?: {asleep?: boolean}; sched?: {at?: number; trip?: {arrive: number; end: number; slot: number; to: {point: string | null}} | null; pose?: {moving?: boolean; beat?: string; act?: {episode?: string; own?: boolean} | null}} | null}>}}).__arkDebug.entries().find((x) => x.animal.id === id);
            if (!e) return null;
            const t = e.sched?.trip;
            return {level: e.level, asleep: e.state?.asleep, at: e.sched?.at, trip: t ? {arrive: t.arrive, end: t.end, slot: t.slot, to: t.to.point} : null, moving: e.sched?.pose?.moving, beat: e.sched?.pose?.beat, act: e.sched?.pose?.act ? {episode: e.sched.pose.act.episode, own: e.sched.pose.act.own} : null, canopy: canopyPhases.get(id) ?? null};
        },
        /**
         * The camera on an animal from the clearest side (ARK-JUNGLE: as the scene's own `clearCanopyView` picks a view of a
         * canopy animal): of 24 headings and a few heights, the first with nothing drawn between it and the animal, else the
         * one with the least. Returns the view taken and how many things were in the way.
         */
        clearFrame: async (id: string, distance: number, polar = 1.2, lift = 0) => {
            // (Framed first as `frame` does, so it is drawn near and where it is drawn is known; then the clear side.)
            let at = handle.locate(id);
            for (let k = 0; k < 3 && at; k++) {
                handle.setView({target: {x: at.x, y: at.y + lift, z: at.z}, distance, polar, azimuth: 0.7});
                await frames(4);
                at = handle.locate(id);
            }
            const until = realPerfNow() + 20_000;
            while (realPerfNow() < until && handle.loading()) await wait(150);
            await frames(4);
            at = handle.locate(id);
            if (!at) return null;
            const target = new Vector3(at.x, at.y + lift, at.z);
            const scene = (window as unknown as {__arkDebug: {scene: Object3D}}).__arkDebug.scene;
            const ray = new Raycaster();
            let best = {azimuth: 0, polar, hits: Infinity};
            for (const p of [polar, polar - 0.3, polar + 0.25, polar - 0.55]) {
                for (let k = 0; k < 24; k++) {
                    const az = (k / 24) * Math.PI * 2;
                    const dir = new Vector3(Math.sin(p) * Math.sin(az), Math.cos(p), Math.sin(p) * Math.cos(az));
                    ray.set(target.clone().addScaledVector(dir, Math.max(at.length ?? 0.5, 0.4) * 0.9), dir);
                    ray.far = distance;
                    const hits = ray.intersectObjects(scene.children, true).filter((h) => h.object.visible && !(h.object as {isSprite?: boolean}).isSprite).length;
                    if (hits < best.hits) best = {azimuth: az, polar: p, hits};
                    if (!hits) break;
                }
                if (!best.hits) break;
            }
            handle.setView({target: {x: target.x, y: target.y, z: target.z}, distance, polar: best.polar, azimuth: best.azimuth});
            await frames(4);
            const end = realPerfNow() + 20_000;
            while (realPerfNow() < end && handle.loading()) await wait(150);
            await frames(4);
            return best;
        },
        /** Where the animals of these kinds are drawn now, and their schedule's hold (to frame the jungle's shots). */
        where: (pattern: string) => {
            const re = new RegExp(pattern);
            const all = (window as unknown as {__arkDebug: {entries: () => Array<{animal: {id: string; model_slug: string}; sched?: {trip?: {to: {point: string | null}} | null; pose?: {beat?: string}} | null}>}}).__arkDebug.entries();
            return all.filter((e) => re.test(e.animal.model_slug)).map((e) => ({id: e.animal.id, slug: e.animal.model_slug, at: handle.locate(e.animal.id), beat: e.sched?.pose?.beat ?? null, point: e.sched?.trip?.to.point ?? null}));
        },
        view: () => handle.view(),
        homeView: () => handle.homeView()
    } as never;
}

main().catch((error) => {
    window.__canopyError = String(error?.stack ?? error);
    console.error(error);
});
