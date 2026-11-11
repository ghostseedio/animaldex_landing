/**
 * Lane L2's scene recordings (development only; `scripts/ark-l2-scenes.mjs` builds it into `.ark-golden/l2/` and
 * serves it; nothing deploys it): the live scene on the v2 fixture with a small cast of flyers, swimmers and snakes,
 * the rigs read from the page's `?rig=` folder (a local set), as `window.__arkL2`:
 *
 *   prepare()     wait for the scene and the cast's models;
 *   setup(name)   arrange a scene: the cast's shared paths pinned (the harness standing in for the schedule), the
 *                 camera tracking the animal; `go()` starts it;
 *   sample(ids)   each watched animal's rig now (clip, phase, weight, flying) and its drawn pose;
 *   stats()       the scene's counts.
 *
 * The pinned paths are the harness's; everything drawn (the flight frame, the drivers, the shader's waves) is the real
 * scene's code.
 */

import {decodeArkSnapshot, mountArk} from "@/ark-scene";
import type {ArkSceneHandle} from "@/ark-scene/types";
import {heightAt, LAKE, ZONE_SITES} from "@/ark-scene/world";
import fixture from "@/ark-scene/fixtures/snapshot-v2.json";
import {flightPaces, stoopPose} from "@/ark-scene/locomotion/flight";

const MODELS = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/talking-models/v1/ark";
const ICONS = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/";

type Raw = (typeof fixture)["animals"][number];
const CAST: Array<[string, string, string]> = [
    ["duck", "mallard", "grassland"],
    ["sparrow", "house-sparrow", "farm_garden"],
    ["eagle", "golden-eagle", "grassland"],
    ["heron", "grey-heron", "wetland"],
    ["pigeon", "domestic-pigeon", "farm_garden"],
    ["bee", "western-honey-bee", "farm_garden"],
    ["monarch", "monarch-butterfly", "grassland"],
    ["moth", "cecropia-moth", "farm_garden"],
    ["kestrel", "common-kestrel", "grassland"],
    ["orca", "orca", "open_ocean"],
    ["humpback", "humpback-whale", "open_ocean"],
    ["shark", "great-white-shark", "open_ocean"],
    ["manta", "reef-manta-ray", "coral_reef"],
    ["stingray", "common-stingray", "coral_reef"],
    ["clown", "ocellaris-clownfish", "coral_reef"],
    ["tang", "blue-tang", "coral_reef"],
    ["eel", "european-eel", "river_lake"],
    ["salmon", "atlantic-salmon", "open_ocean"],
    ["mamba", "eastern-green-mamba", "grassland"],
    ["sidewinder", "sidewinder", "desert"],
    ["python", "african-rock-python", "grassland"]
];

function castId(prefix: string): string {
    const k = CAST.findIndex((c) => c[0] === prefix);
    return `0000feed-0000-4000-8000-${(0x2000 + k).toString(16).padStart(12, "0")}`;
}

function castAnimals(): Raw[] {
    const template = fixture.animals[0];
    // (The moth is "yours", so the scene draws it close up at its porch light whatever the camera's distance.)
    return CAST.map(([prefix, slug, zone], k) => ({...template, id: castId(prefix), name: slug, scientific_name: slug, model_slug: slug, zone, activity: prefix === "moth" ? "nocturnal" : "diurnal", sociality: null, slot: 120 + k, slot_rank: 0, ...(prefix === "moth" ? {mine: true} : {})} as Raw));
}

type Debug = {
    entries: () => Array<{animal: {id: string; model_slug: string}; air: number; rig?: {now: {name: string; phase: number}; weight: number; flying: boolean; climb: number; turn: number} | null; l2?: {flight?: {beat: number; mode: string} | null; swim?: {cycles: number; speed: number} | null; legless?: {cycles: number; speed: number} | null} | null; yawNow?: number; middle?: {x: number; y: number; z: number} | null; level?: string}>;
    pinShared: (id: string, fn: ((epoch: number) => Record<string, unknown>) | null) => void;
    setHome: (id: string, x: number, z: number) => boolean;
    controls: {minDistance: number};
};

const nextFrame = () => new Promise<number>((resolve) => requestAnimationFrame(resolve));
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const smooth = (k: number) => {
    const c = Math.min(Math.max(k, 0), 1);
    return c * c * (3 - 2 * c);
};

async function mountScenes(el: HTMLElement) {
    const params = new URLSearchParams(location.search);
    const rigBase = params.get("norig") ? null : params.get("rig") ? new URL(params.get("rig")!, location.href).href.replace(/\/+$/, "") : undefined;
    // The harness's camera goes where it is told (the golden shots' switch: the target is not pulled toward the ground
    // when it is more than 6 m off, so a flyer high up stays in the middle; it may look up from below).
    (window as unknown as {__arkGoldenCamera?: {free?: boolean; maxPolar?: number}}).__arkGoldenCamera = {free: true, maxPolar: 1.85};
    // `?before=1`: lane L2 off (the scene as it was before it), for the before/after recordings.
    if (params.get("before")) (globalThis as {__arkL2Motion?: boolean}).__arkL2Motion = false;
    const quality = params.get("quality");
    if (quality === "high" || quality === "medium" || quality === "low") (globalThis as {__arkQuality?: string}).__arkQuality = quality;
    const cast = castAnimals();
    const snapshot = decodeArkSnapshot({...fixture, animals: cast});
    if (!snapshot) throw new Error("fixture did not decode");
    let ready = false;
    const handle: ArkSceneHandle = mountArk(el, {snapshot, modelBase: MODELS, rigBase, iconUrl: (slug) => ICONS + encodeURIComponent(slug) + ".webp", recording: true, hours: Number(params.get("hours") ?? 11), onReady: () => (ready = true)});
    handle.setEnvironment({seaLevel: 0, wetness: 0, snow: 0, wind: 0.15, storm: 0, windDirection: 0.4});
    const debug = () => (window as unknown as {__arkDebug: Debug}).__arkDebug;
    const ids = Object.fromEntries(CAST.map(([prefix]) => [prefix, castId(prefix)]));
    const settle = async (maxMs = 120_000) => {
        const until = performance.now() + maxMs;
        let quiet = 0;
        while (performance.now() < until) {
            await wait(100);
            if (!ready || handle.loading()) quiet = 0;
            else if (!quiet) quiet = performance.now();
            else if (performance.now() - quiet > 1500) return true;
        }
        return false;
    };
    const pinPose = (id: string, fn: ((epoch: number) => Record<string, unknown>) | null) => debug().pinShared(id, fn ? (epoch: number) => ({act: null, ...fn(epoch)}) : null);
    const nowS = () => Date.now() / 1000;
    let tracking = 0;
    /** The camera on an animal: its drawn middle, or (`along`) its pinned path's x and z with the drawn height. */
    const track = (id: string, distance: number, polar: number, azimuth: number | ((yaw: number) => number), lift = 0, along?: () => {x: number; z: number}) => {
        const token = ++tracking;
        debug().controls.minDistance = 0.3;
        const step = () => {
            if (token !== tracking) return;
            const at = handle.locate(id);
            const on = along?.();
            if (at) handle.setView({target: {x: on ? on.x : at.x, y: at.y + lift, z: on ? on.z : at.z}, distance, polar, azimuth: typeof azimuth === "function" ? azimuth(at.yaw) : azimuth});
            requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    };
    const ground = (x: number, z: number) => Math.max(heightAt(x, z), 0);
    const site = (zone: keyof typeof ZONE_SITES, dx = 0, dz = 0) => ({x: ZONE_SITES[zone].x + dx, z: ZONE_SITES[zone].z + dz});
    const park = (prefix: string) => pinPose(ids[prefix], () => ({x: 500 + CAST.findIndex((c) => c[0] === prefix) * 6, z: 500, y: 0, moving: false, aloft: false, doing: "rest", beat: "rest"}));
    const yawOf = (dx: number, dz: number) => Math.atan2(dx, dz);

    /** A path (x, z, y as functions of seconds since start), its heading from its own motion, aloft above `airAbove` m over the ground. */
    const fly = (id: string, start: number, path: (t: number) => {x: number; z: number; y: number; beat?: string; doing?: string}, until: number, then?: (t: number) => Record<string, unknown>) => {
        pinPose(id, (epoch: number) => {
            const t = Math.max(epoch - start, 0);
            if (t > until && then) return then(t - until);
            const a = path(Math.min(t, until));
            const b = path(Math.min(t, until) + 0.02);
            const g = ground(a.x, a.z);
            const aloft = a.y - g > 0.08;
            const moving = t < until && Math.hypot(b.x - a.x, b.z - a.z, b.y - a.y) > 1e-5;
            return {x: a.x, z: a.z, y: a.y, yaw: Math.hypot(b.x - a.x, b.z - a.z) > 1e-6 ? yawOf(b.x - a.x, b.z - a.z) : 0, moving, aloft, doing: a.doing ?? "fly", beat: a.beat ?? (aloft ? "fly" : moving ? "walk" : "rest")};
        });
    };

    /** A straight swim (or crawl) at `speed` m/s through (x0, z0) along `yaw`, at height y (the band decides in the water). */
    const swimLine = (id: string, start: number, from: {x: number; z: number}, yaw: number, speed: number, y: number, doing = "swim", beat = "swim", speedAt?: (t: number) => number) => {
        pinPose(id, (epoch: number) => {
            const t = Math.max(epoch - start, 0);
            // Distance swum: the speed profile integrated (closed form for a constant; numeric for a profile).
            let d = speed * t;
            if (speedAt) {
                d = 0;
                const n = Math.ceil(t / 0.05);
                for (let i = 0; i < n; i++) d += speedAt(Math.min((i + 0.5) * 0.05, t)) * Math.min(0.05, t - i * 0.05);
            }
            const x = from.x + Math.sin(yaw) * d;
            const z = from.z + Math.cos(yaw) * d;
            return {x, z, y: doing === "swim" ? Math.min(y, -0.5) : ground(x, z), yaw, moving: t > 0, aloft: false, doing, beat};
        });
    };

    /** Where a straight swim started at `start` is now (for the camera). */
    let lineStart = 0;
    const lineAt = (from: {x: number; z: number}, yaw: number, speed: number) => () => {
        const t = Math.max(nowS() - lineStart, 0);
        return {x: from.x + Math.sin(yaw) * speed * t, z: from.z + Math.cos(yaw) * speed * t};
    };
    const goLine = (fn: () => void) => () => {
        lineStart = nowS();
        fn();
    };

    const SCENES: Record<string, () => {note: string; watch: string[]; go?: () => void}> = {
        /** A mallard stands, takes off with hard flaps, flies, glides in, flares and lands, wings folding, then walks. */
        takeoff_land: () => {
            const at = site("grassland", 4, 2);
            const from = {x: at.x - 10, z: at.z};
            const to = {x: at.x + 10, z: at.z + 1};
            const id = ids.duck;
            debug().setHome(id, from.x, from.z);
            const path = (t: number) => {
                if (t < 2) return {x: from.x, z: from.z, y: ground(from.x, from.z), beat: "rest", doing: "rest"};
                const u = Math.min((t - 2) / 11, 1);
                const x = from.x + (to.x - from.x) * u;
                const z = from.z + (to.z - from.z) * u + Math.sin(Math.PI * u) * 4;
                const lift = smooth(Math.min(u / 0.2, (1 - u) / 0.3, 1));
                const g = ground(x, z);
                return {x, z, y: g + 3.2 * lift, beat: lift > 0.9 && u > 0.5 && u < 0.68 ? "glide" : "fly"};
            };
            fly(id, nowS() + 1e6, path, 13, (t) => {
                const w = Math.min(t / 5, 1);
                const x = to.x + 2 * w;
                const z = to.z + 0.6 * w;
                return {x, z, y: ground(x, z), yaw: yawOf(2, 0.6), moving: w < 1, aloft: false, doing: "forage", beat: w < 1 ? "walk" : "peck"};
            });
            track(id, 4.5, 1.3, 0.25);
            return {note: "stand 2 s, take off, an 11 s flight to 3.2 m with a glide in its middle, flare and land, then walk", watch: [id], go: () => fly(id, nowS(), path, 13, (t) => {
                const w = Math.min(t / 5, 1);
                const x = to.x + 2 * w;
                const z = to.z + 0.6 * w;
                return {x, z, y: ground(x, z), yaw: yawOf(2, 0.6), moving: w < 1, aloft: false, doing: "forage", beat: w < 1 ? "walk" : "peck"};
            })};
        },
        /** A mallard flies a level circle (radius 6 m, 5 m/s: a coordinated bank of about 23°), seen from behind and the side. */
        bank_circle: () => {
            const c = site("grassland", 0, 6);
            const id = ids.duck;
            const r = 6;
            const w = 5 / r;
            const path = (t: number) => ({x: c.x + r * Math.cos(w * t), z: c.z + r * Math.sin(w * t), y: ground(c.x, c.z) + 4});
            fly(id, nowS() + 1e6, path, 1e6);
            track(id, 5, 1.25, (yaw) => yaw + Math.PI + 0.5);
            return {note: "a level circle, r 6 m at 5 m/s (ω 0.83 rad/s, tanφ = vω/g: 23°)", watch: [id], go: () => fly(id, nowS(), path, 1e6)};
        },
        /** A golden eagle soars in wide circles (radius 12 m, 6 m/s), then glides straight and flaps a few times to climb. */
        soar: () => {
            // Over the reef's water (no trees between the camera and the bird; the camera can't look up from below).
            const c = site("coral_reef", 0, 0);
            const id = ids.eagle;
            const r = 12;
            const w = 6 / r;
            const path = (t: number) => {
                if (t < 12) return {x: c.x + r * Math.cos(w * t), z: c.z + r * Math.sin(w * t), y: 14 + 0.15 * t, beat: "glide", doing: "soar"};
                const a = w * 12;
                const s = t - 12;
                const x = c.x + r * Math.cos(a) - Math.sin(a) * 6 * s;
                const z = c.z + r * Math.sin(a) + Math.cos(a) * 6 * s;
                return {x, z, y: 15.8 + (s > 2 && s < 4 ? (s - 2) * 0.9 : s >= 4 ? 1.8 : 0), beat: s > 2 && s < 4 ? "fly" : "glide", doing: s > 2 && s < 4 ? "fly" : "soar"};
            };
            fly(id, nowS() + 1e6, path, 1e6);
            // From a little below, against the sky.
            track(id, 7, 1.7, (yaw) => yaw + Math.PI + 0.7, 0);
            return {note: "12 s of circling (r 12 m, 6 m/s), then a straight glide with a 2 s climb", watch: [id], go: () => fly(id, nowS(), path, 1e6)};
        },
        /**
         * A golden eagle's stoop (lane L2's dive API for L7: `stoopPose`, `flightPaces`): it glides high, rolls in, dives
         * wings closed, pulls out with braking beats near the ground and climbs away.
         */
        stoop: () => {
            const c = site("grassland", 2, 2);
            const id = ids.eagle;
            const g = ground(c.x, c.z);
            const paces = flightPaces("bird", "soar", 0.85, true);
            const dive = 2.2;
            const path = (t: number) => {
                // (The scene's camera tracks only up to about 15 m: the stoop starts at 13 m.)
                if (t < 3) return {x: c.x - 30 + 6 * t, z: c.z, y: g + 13, beat: "glide", doing: "soar"};
                const u = Math.min((t - 3) / dive, 1);
                // Down a steep line (about 50°), the pull-out curving to level a metre and a half over the grass.
                const k = 1 - (1 - u) * (1 - u);
                const x = c.x - 12 + 22 * u;
                const y = g + 13 - 11.5 * Math.sin((Math.PI / 2) * Math.min(k * 1.05, 1));
                if (t - 3 <= dive) return {x, z: c.z, y, beat: "fly", doing: "fly"};
                const s = t - 3 - dive;
                return {x: c.x + 10 + 7 * s, z: c.z, y: g + 1.5 + 1.2 * s, beat: "fly", doing: "fly"};
            };
            const pin = (start: number) =>
                pinPose(id, (epoch: number) => {
                    const t = Math.max(epoch - start, 0);
                    const a = path(t);
                    const b = path(t + 0.02);
                    const u = (t - 3) / dive;
                    const stoop = u > 0 && u < 1 ? stoopPose(u) : null;
                    // The dive's act (as L7's chase would set it): the plunge clip and its pitch while the wings are closed.
                    const act = stoop && stoop.clip === "plunge" ? {episode: "stoop", recipe: "l2", block: "stoop", state: "plunge", u, pitch: stoop.pitch - 0.6 * Math.atan2(a.y - b.y, Math.hypot(b.x - a.x, b.z - a.z)), roll: 0, own: false, carry: null, prey: null, catch: null, fx: null, mark: null, label: "stoop"} : null;
                    return {x: a.x, z: a.z, y: a.y, yaw: yawOf(b.x - a.x, b.z - a.z), moving: true, aloft: true, doing: a.doing, beat: a.beat, act};
                });
            pin(nowS() + 1e6);
            track(id, 10, 1.45, 1.45, 0);
            return {note: `glide 3 s, a ${dive} s stoop (the API's dive pace ${paces.dive.toFixed(0)} m/s at true scale), pull-out and climb`, watch: [id], go: () => pin(nowS())};
        },
        /** A house sparrow flies straight 2 m up (flap-bounding), comes down, and hops about. */
        bound_hop: () => {
            const at = site("farm_garden", 3, 4);
            const id = ids.sparrow;
            const path = (t: number) => {
                const u = Math.min(t / 6, 1);
                const x = at.x - 12 + 18 * u;
                const z = at.z;
                const lift = smooth(Math.min(u / 0.12, (1 - u) / 0.18, 1));
                return {x, z, y: ground(x, z) + 2 * lift};
            };
            const hop = (t: number) => {
                const x = at.x + 6 + 0.6 * Math.sin(t * 0.5);
                const z = at.z + 0.3 * Math.sin(t * 0.33);
                return {x, z, y: ground(x, z), yaw: yawOf(0.3 * Math.cos(t * 0.5), 0.1 * Math.cos(t * 0.33)), moving: true, aloft: false, doing: "forage", beat: "walk"};
            };
            fly(id, nowS() + 1e6, path, 6, hop);
            track(id, 2.2, 1.3, 1.45, 0.05);
            return {note: "6 s of flap-bounding flight (18 m, 2 m up), land, hop", watch: [id], go: () => fly(id, nowS(), path, 6, hop)};
        },
        /** A kestrel flies in and hovers, then a pigeon walks (head-bobbing: L1's legged driver) past a heron. */
        hover_walk: () => {
            const at = site("farm_garden", -3, 2);
            const k = ids.kestrel;
            const path = (t: number) => {
                const u = Math.min(t / 3, 1);
                return {x: at.x - 8 + 8 * smooth(u), z: at.z, y: ground(at.x, at.z) + 5};
            };
            fly(k, nowS() + 1e6, path, 1e6);
            const p = ids.pigeon;
            swimLine(p, nowS() + 1e6, {x: at.x - 1, z: at.z - 2}, Math.PI / 2, 0.35, 0, "forage", "walk");
            track(k, 4, 1.35, 1.2);
            return {note: "a kestrel flies in and hangs in the air (hover); a pigeon walks below", watch: [k, p], go: () => {
                fly(k, nowS(), path, 1e6);
                swimLine(p, nowS(), {x: at.x - 1, z: at.z - 2}, Math.PI / 2, 0.35, 0, "forage", "walk");
            }};
        },
        /** A monarch flutters across a meadow (its wings beaten by the driver: its rig holds an open glide), a honey bee whirs. */
        flutter: () => {
            const at = site("grassland", -4, -4);
            const m = ids.monarch;
            const b = ids.bee;
            const path = (t: number) => ({x: at.x - 3 + 0.5 * t, z: at.z + 0.6 * Math.sin(t * 0.7), y: ground(at.x, at.z) + 1.1 + 0.2 * Math.sin(t * 1.3)});
            const bee = (t: number) => ({x: at.x - 2 + 0.45 * t, z: at.z + 0.8 + 0.3 * Math.sin(t * 1.9), y: ground(at.x, at.z) + 0.8 + 0.1 * Math.sin(t * 2.3)});
            fly(m, nowS() + 1e6, path, 1e6);
            fly(b, nowS() + 1e6, bee, 1e6);
            track(m, 1.6, 1.25, 1.3);
            return {note: "a monarch at 0.5 m/s, a honey bee beside it", watch: [m, b], go: () => {
                fly(m, nowS(), path, 1e6);
                fly(b, nowS(), bee, 1e6);
            }};
        },
        /**
         * A cecropia moth round the porch light at night (its microhabitat's own flight: run with `--hours 21.5`): its rig
         * holds an open glide, so its wings are beaten by the wing driver.
         */
        moth_light: () => {
            const id = ids.moth;
            track(id, 1.2, 1.2, 0.8, 0);
            return {note: "the moth's own circling of the porch light (not pinned), the camera following it", watch: [id]};
        },
        /** An orca swims by under water, then speeds up to a burst (2.2x): the flukes beat faster. */
        swim_orca: () => {
            const at = site("open_ocean", 0, 0);
            const id = ids.orca;
            const speedAt = (t: number) => (t < 6 ? 2 : 2 + 2.4 * smooth((t - 6) / 2));
            swimLine(id, nowS() + 1e6, {x: at.x - 10, z: at.z}, Math.PI / 2, 2, -3, "swim", "swim", speedAt);
            track(id, 9, 1.52, 0.2, 0);
            return {note: "cruise 2 m/s for 6 s, then a burst to 4.4 m/s (2.2x)", watch: [id], go: () => swimLine(id, nowS(), {x: at.x - 10, z: at.z}, Math.PI / 2, 2, -3, "swim", "swim", speedAt)};
        },
        swim_humpback: () => {
            const at = site("open_ocean", 6, 8);
            const id = ids.humpback;
            swimLine(id, nowS() + 1e6, {x: at.x - 14, z: at.z}, Math.PI / 2, 1.8, -4);
            track(id, 16, 1.5, 0.2, 0);
            return {note: "a humpback cruising at 1.8 m/s", watch: [id], go: () => swimLine(id, nowS(), {x: at.x - 14, z: at.z}, Math.PI / 2, 1.8, -4)};
        },
        swim_shark: () => {
            const at = site("open_ocean", -6, -6);
            const id = ids.shark;
            swimLine(id, nowS() + 1e6, {x: at.x - 10, z: at.z}, Math.PI / 2, 1.6, -2);
            // From behind and a little below: the tail's side-to-side beat (a side view hides it).
            track(id, 5.5, 1.75, (yaw) => yaw + 0.45, 0);
            return {note: "a great white (thunniform: only the tail beats), from behind and below", watch: [id], go: () => swimLine(id, nowS(), {x: at.x - 10, z: at.z}, Math.PI / 2, 1.6, -2)};
        },
        swim_salmon: () => {
            const at = site("open_ocean", 4, -8);
            const id = ids.salmon;
            swimLine(id, nowS() + 1e6, {x: at.x - 6, z: at.z}, Math.PI / 2, 0.8, -1.5);
            track(id, 2.4, 1.75, (yaw) => yaw + 0.45, 0);
            return {note: "an Atlantic salmon (subcarangiform)", watch: [id], go: () => swimLine(id, nowS(), {x: at.x - 6, z: at.z}, Math.PI / 2, 0.8, -1.5)};
        },
        swim_manta: () => {
            const at = site("coral_reef", 0, 4);
            const id = ids.manta;
            const from = {x: at.x - 8, z: at.z};
            lineStart = nowS() + 1e6;
            swimLine(id, lineStart, from, Math.PI / 2, 1, -1.5);
            track(id, 5, 1.35, -0.5, 0, lineAt(from, Math.PI / 2, 1));
            return {note: "a reef manta flying with its wing fins", watch: [id], go: goLine(() => swimLine(id, lineStart, from, Math.PI / 2, 1, -1.5))};
        },
        swim_stingray: () => {
            const at = site("coral_reef", -4, -2);
            const id = ids.stingray;
            swimLine(id, nowS() + 1e6, {x: at.x - 4, z: at.z}, Math.PI / 2, 0.4, -3);
            track(id, 3.2, 1.3, 0.3, 0);
            return {note: "a common stingray: a wave along its fin's edge", watch: [id], go: () => swimLine(id, nowS(), {x: at.x - 4, z: at.z}, Math.PI / 2, 0.4, -3)};
        },
        swim_reef: () => {
            const at = site("coral_reef", 2, -4);
            const c = ids.clown;
            const t = ids.tang;
            swimLine(c, nowS() + 1e6, {x: at.x - 2, z: at.z}, Math.PI / 2, 0.18, -1.5);
            swimLine(t, nowS() + 1e6, {x: at.x - 3, z: at.z + 0.6}, Math.PI / 2, 0.3, -1.5);
            track(c, 1.6, 1.5, 0.3, 0);
            return {note: "a clownfish and a blue tang (labriform: rowing with the fins, a light tail)", watch: [c, t], go: () => {
                swimLine(c, nowS(), {x: at.x - 2, z: at.z}, Math.PI / 2, 0.18, -1.5);
                swimLine(t, nowS(), {x: at.x - 3, z: at.z + 0.6}, Math.PI / 2, 0.3, -1.5);
            }};
        },
        swim_eel: () => {
            const id = ids.eel;
            const from = {x: LAKE.x - 4, z: LAKE.z};
            swimLine(id, nowS() + 1e6, from, Math.PI / 2, 0.35, -1);
            track(id, 2.2, 1.7, (yaw) => yaw + 0.6, 0);
            return {note: "a European eel in the lake (anguilliform: the whole body waves)", watch: [id], go: () => swimLine(id, nowS(), from, Math.PI / 2, 0.35, -1)};
        },
        /** A green mamba crawls across the grass (lateral undulation, no slip). */
        snake_lateral: () => {
            const at = site("grassland", -8, 10);
            const id = ids.mamba;
            debug().setHome(id, at.x - 3, at.z);
            swimLine(id, nowS() + 1e6, {x: at.x - 3, z: at.z}, Math.PI / 2, 0.45, 0, "wander", "walk");
            track(id, 3.2, 0.75, 0.4, 0);
            return {note: "a green mamba at 0.45 m/s, from above", watch: [id], go: () => swimLine(id, nowS(), {x: at.x - 3, z: at.z}, Math.PI / 2, 0.45, 0, "wander", "walk")};
        },
        /** A sidewinder on the dunes (its stored text says it sidewinds). */
        snake_sidewind: () => {
            const at = site("desert", 0, 0);
            const id = ids.sidewinder;
            debug().setHome(id, at.x - 2, at.z);
            swimLine(id, nowS() + 1e6, {x: at.x - 2, z: at.z}, Math.PI / 2, 0.3, 0, "wander", "walk");
            track(id, 2.4, 0.85, 0.5, 0);
            return {note: "a sidewinder at 0.3 m/s, from above", watch: [id], go: () => swimLine(id, nowS(), {x: at.x - 2, z: at.z}, Math.PI / 2, 0.3, 0, "wander", "walk")};
        },
        /** An African rock python: slow (rectilinear, straight) then faster (lateral). */
        snake_python: () => {
            const at = site("grassland", 8, -8);
            const id = ids.python;
            debug().setHome(id, at.x - 3, at.z);
            const speedAt = (t: number) => (t < 7 ? 0.08 : 0.5);
            swimLine(id, nowS() + 1e6, {x: at.x - 3, z: at.z}, Math.PI / 2, 0.08, 0, "wander", "walk", speedAt);
            track(id, 4.5, 0.8, 0.4, 0);
            return {note: "7 s at 0.08 m/s (rectilinear), then 0.5 m/s (lateral)", watch: [id], go: () => swimLine(id, nowS(), {x: at.x - 3, z: at.z}, Math.PI / 2, 0.08, 0, "wander", "walk", speedAt)};
        }
    };

    return {
        scenes: Object.keys(SCENES),
        ids,
        prepare: async () => {
            await settle();
            await handle.preload(Array.from(new Set(cast.map((a) => a.model_slug))));
            return {settled: await settle(), stats: handle.stats()};
        },
        setup: async (name: string) => {
            tracking++;
            for (const [prefix] of CAST) park(prefix);
            const run = SCENES[name];
            if (!run) throw new Error(`no scene ${name}`);
            const result = run();
            for (let i = 0; i < 20; i++) await nextFrame();
            await settle(30_000);
            await wait(2500);
            result.go?.();
            return {note: result.note, watch: result.watch};
        },
        sample: (watch: string[]) => {
            const entries = debug().entries();
            return watch.map((id) => {
                const e = entries.find((x) => x.animal.id === id);
                const rig = e?.rig ?? null;
                const r2 = (v: number | undefined | null) => (typeof v === "number" ? Math.round(v * 100) / 100 : null);
                return {
                    id,
                    slug: e?.animal.model_slug,
                    level: e?.level ?? null,
                    clip: rig?.now.name ?? null,
                    phase: r2(rig?.now.phase),
                    weight: r2(rig?.weight),
                    flying: rig?.flying ?? null,
                    climb: r2(rig?.climb),
                    turn: r2(rig?.turn),
                    beat: r2(e?.l2?.flight?.beat),
                    mode: e?.l2?.flight?.mode ?? null,
                    swim: e?.l2?.swim ? {cycles: r2(e.l2.swim.cycles), speed: r2(e.l2.swim.speed)} : null,
                    crawl: e?.l2?.legless ? {cycles: r2(e.l2.legless.cycles), speed: r2(e.l2.legless.speed)} : null,
                    y: r2(e?.middle?.y),
                    micro: Boolean((e as {place?: {micro?: unknown}} | undefined)?.place?.micro),
                    aloft: (e as {sched?: {pose?: {aloft?: boolean}} | null} | undefined)?.sched?.pose?.aloft ?? null,
                    air: r2(e?.air)
                };
            });
        },
        stats: () => handle.stats()
    };
}

const el = document.getElementById("ark");
if (el) {
    mountScenes(el)
        .then((api) => ((window as unknown as {__arkL2: unknown}).__arkL2 = api))
        .catch((error) => ((window as unknown as {__arkL2Error: string}).__arkL2Error = String(error instanceof Error ? error.stack || error.message : error)));
}
