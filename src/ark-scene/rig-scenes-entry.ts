/**
 * The rig player's scene recordings' page script (development only;
 * `scripts/ark-rig-scenes.mjs` builds it into `.ark-golden/` and serves it,
 * nothing deploys it). The live scene on the v2 fixture with a small cast,
 * the rigs read from the page's `?rig=` folder (a local test set) and the
 * v1 fallback beside the model set, as `window.__arkRig`:
 *
 *   setup(name)   arrange a scene: the cast's shared paths pinned (the harness standing in for the schedule: a
 *                 duck's flight across open ground into a landing and a walk, a herd's grazing beats, a deer at
 *                 rest near the camera), the camera; resolves when drawn.
 *   sample()      every cast animal's rig now (clip, phase, weight, flying) and its head look.
 *
 * The pinned paths are the harness's; the rig player (`rigFor`, the clips, the look on the bones) is the real one.
 */

import {decodeArkSnapshot, mountArk} from "@/ark-scene";
import type {ArkSceneHandle} from "@/ark-scene/types";
import {heightAt, LAKE, ZONE_SITES} from "@/ark-scene/world";
import fixture from "@/ark-scene/fixtures/snapshot-v2.json";

const MODELS = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/talking-models/v1/ark";
const ICONS = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/";

type Raw = (typeof fixture)["animals"][number];
const SPECIES: Record<string, {name: string; zone: string; activity: string | null; sociality: string | null}> = {
    mallard: {name: "Mallard", zone: "grassland", activity: "diurnal", sociality: null},
    "golden-eagle": {name: "Golden Eagle", zone: "grassland", activity: "diurnal", sociality: null},
    "red-deer": {name: "Red Deer", zone: "grassland", activity: "any", sociality: "group"},
    "domestic-goat": {name: "Domestic Goat", zone: "grassland", activity: "diurnal", sociality: "group"},
    "plains-zebra": {name: "Plains Zebra", zone: "grassland", activity: "any", sociality: "group"},
    "african-lion": {name: "African Lion", zone: "grassland", activity: null, sociality: "group"},
    meerkat: {name: "Meerkat", zone: "desert", activity: "diurnal", sociality: "group"},
    "martial-eagle": {name: "Martial Eagle", zone: "grassland", activity: "diurnal", sociality: null}
};
const CAST: Array<[string, string, number]> = [
    ["duck", "mallard", 1],
    ["eagle", "golden-eagle", 1],
    ["deer", "red-deer", 12],
    ["goat", "domestic-goat", 6],
    ["zebra", "plains-zebra", 6],
    ["lion", "african-lion", 1],
    ["meerkat", "meerkat", 6],
    ["meagle", "martial-eagle", 1]
];

function castId(prefix: string, i: number): string {
    const k = CAST.findIndex((c) => c[0] === prefix);
    return `0000feed-0000-4000-8000-${(k * 256 + i).toString(16).padStart(12, "0")}`;
}

function castAnimals(): Raw[] {
    const template = fixture.animals[0];
    const out: Raw[] = [];
    for (const [prefix, slug, n] of CAST) {
        const sp = SPECIES[slug];
        for (let i = 0; i < n; i++) {
            out.push({
                ...template,
                id: castId(prefix, i),
                name: sp.name,
                scientific_name: sp.name,
                model_slug: slug,
                zone: sp.zone,
                activity: sp.activity,
                sociality: sp.sociality,
                slot: 90 + CAST.findIndex((c) => c[0] === prefix),
                slot_rank: i
            } as Raw);
        }
    }
    return out;
}

type RigSample = {now: {name: string; phase: number}; weight: number; flying: boolean; climb: number; turn: number} | null;
type Debug = {
    entries: () => Array<{animal: {id: string; model_slug: string}; rig?: RigSample; reactive?: {headYaw: number; headPitch: number; headWeight: number; action: string} | null; air: number}>;
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
    const quality = params.get("quality");
    if (quality === "high" || quality === "medium" || quality === "low") (globalThis as {__arkQuality?: string}).__arkQuality = quality;
    const cast = castAnimals();
    const snapshot = decodeArkSnapshot({...fixture, animals: cast});
    if (!snapshot) throw new Error("fixture did not decode");
    let ready = false;
    const handle: ArkSceneHandle = mountArk(el, {snapshot, modelBase: MODELS, rigBase, iconUrl: (slug) => ICONS + encodeURIComponent(slug) + ".webp", recording: true, hours: 10, onReady: () => (ready = true)});
    handle.setEnvironment({seaLevel: 0, wetness: 0, snow: 0, wind: 0.2, storm: 0, windDirection: 0.4});
    const debug = () => (window as unknown as {__arkDebug: Debug}).__arkDebug;
    const ids: Record<string, string[]> = Object.fromEntries(CAST.map(([prefix, , n]) => [prefix, Array.from({length: n}, (_, i) => castId(prefix, i))]));
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
    const nowS = () => Date.now() / 1000;
    /** The camera tracks an animal (its middle, as the scene draws it) from a fixed side, every frame, until the next setup. */
    let tracking = 0;
    const track = (id: string, distance: number, polar: number, azimuth: number) => {
        const token = ++tracking;
        debug().controls.minDistance = 0.5;
        const step = () => {
            if (token !== tracking) return;
            const at = handle.locate(id);
            if (at) handle.setView({target: {x: at.x, y: at.y, z: at.z}, distance, polar, azimuth});
            requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    };
    const ground = (x: number, z: number) => Math.max(heightAt(x, z), 0);
    const site = (zone: keyof typeof ZONE_SITES, dx = 0, dz = 0) => ({x: ZONE_SITES[zone].x + dx, z: ZONE_SITES[zone].z + dz});
    const park = (prefix: string) => ids[prefix].forEach((id, i) => debug().pinShared(id, () => ({x: 400 + i * 3, z: 400 + CAST.findIndex((c) => c[0] === prefix) * 6, y: 0, moving: false, aloft: false, doing: "rest", beat: "rest"})));
    const view = (x: number, z: number, distance: number, azimuth: number, polar = 1.1, lift = 0.6) => {
        debug().controls.minDistance = 0.5;
        handle.setView({target: {x, y: ground(x, z) + lift, z}, distance, polar, azimuth});
    };
    /** Stands still at a spot doing one thing, its beats cycling (bite, chew, scan) from its own offset. */
    const stand = (id: string, x: number, z: number, yaw: number, doing: string, beats: Array<[string, number]>, offset: number) => {
        const total = beats.reduce((sum, [, s]) => sum + s, 0);
        debug().setHome(id, x, z);
        debug().pinShared(id, (epoch: number) => {
            let t = (((epoch + offset) % total) + total) % total;
            let beat = beats[0][0];
            for (const [name, seconds] of beats) {
                if (t < seconds) {
                    beat = name;
                    break;
                }
                t -= seconds;
            }
            return {x, z, y: ground(x, z), yaw, moving: false, aloft: false, doing, beat, nx: 0, ny: 1, nz: 0};
        });
    };
    /**
     * The schedule's air leg, as `behaviour-schedule.ts` legPose makes it: it takes off, climbs to its cruise, flies
     * on, and comes down to land (lift over the first 18% and the last 22%; aloft once 5% up). Before it: standing;
     * after it: a walk on, then standing.
     */
    const flight = (id: string, from: {x: number; z: number}, to: {x: number; z: number}, start: number, wait0: number, seconds: number, cruise: number, walkTo: {x: number; z: number}) => {
        debug().setHome(id, from.x, from.z);
        const yaw = Math.atan2(to.x - from.x, to.z - from.z);
        const walkYaw = Math.atan2(walkTo.x - to.x, walkTo.z - to.z);
        debug().pinShared(id, (epoch: number) => {
            const k = epoch - start;
            if (k < wait0) return {x: from.x, z: from.z, y: ground(from.x, from.z), yaw, moving: false, aloft: false, doing: "rest", beat: "rest"};
            const u = (k - wait0) / seconds;
            if (u < 1) {
                // A bowed route (as alongRoute's three-point curve), so it turns as it goes.
                const bow = Math.sin(Math.PI * u) * 6;
                const nx = -(to.z - from.z);
                const nz = to.x - from.x;
                const nl = Math.hypot(nx, nz) || 1;
                const x = from.x + (to.x - from.x) * u + (nx / nl) * bow;
                const z = from.z + (to.z - from.z) * u + (nz / nl) * bow;
                const lift = smooth(Math.min(u / 0.18, (1 - u) / 0.22, 1));
                const base = ground(from.x, from.z) + (ground(to.x, to.z) - ground(from.x, from.z)) * u;
                const y = Math.max(base + (cruise + Math.max(ground(x, z) - base, 0)) * lift, Math.min(ground(x, z), base) + 0.05 * lift);
                const du = 0.002;
                const bow2 = Math.sin(Math.PI * (u + du)) * 6;
                const x2 = from.x + (to.x - from.x) * (u + du) + (nx / nl) * bow2;
                const z2 = from.z + (to.z - from.z) * (u + du) + (nz / nl) * bow2;
                return {x, z, y, yaw: Math.atan2(x2 - x, z2 - z), moving: true, aloft: lift > 0.05, doing: "fly", beat: lift > 0.9 && u > 0.45 && u < 0.7 ? "glide" : "fly"};
            }
            const w = Math.min((k - wait0 - seconds) / 5, 1);
            const x = to.x + (walkTo.x - to.x) * w;
            const z = to.z + (walkTo.z - to.z) * w;
            return {x, z, y: ground(x, z), yaw: walkYaw, moving: w < 1, aloft: false, doing: "forage", beat: w < 1 ? "walk" : "peck"};
        });
    };

    /**
     * A duck's way into the lake and back out, as the schedule's legs make it (`behaviour-schedule.ts`: a walk to the
     * edge, an "enter" leg of 2.2 s, a swim, an "exit" leg of 2.4 s, then a shake off): the times in seconds from `start`.
     */
    const waterTrip = (id: string, start: number) => {
        const dir = (a: number, r: number) => ({x: LAKE.x + Math.cos(a) * r, z: LAKE.z + Math.sin(a) * r});
        const a0 = 0.9;
        const bank = dir(a0, LAKE.r + 2.6);
        const edge = dir(a0, LAKE.r + 0.2);
        const off = dir(a0, LAKE.r - 2.2);
        const far = dir(a0 + 0.45, LAKE.r - 3.2);
        const off2 = dir(a0 + 0.25, LAKE.r - 2.2);
        const edge2 = dir(a0 + 0.25, LAKE.r + 0.2);
        const bank2 = dir(a0 + 0.32, LAKE.r + 2.2);
        type Seg = {from: {x: number; z: number}; to: {x: number; z: number}; seconds: number; beat: string; doing: string; water: [number, number] | null; moving: boolean};
        const segs: Seg[] = [
            {from: bank, to: bank, seconds: 2, beat: "rest", doing: "rest", water: null, moving: false},
            {from: bank, to: edge, seconds: 2.5, beat: "walk", doing: "swim", water: null, moving: true},
            {from: edge, to: off, seconds: 2.2, beat: "enter_water", doing: "swim", water: [0, 1], moving: true},
            {from: off, to: far, seconds: 3.5, beat: "swim", doing: "swim", water: [1, 1], moving: true},
            {from: far, to: off2, seconds: 3, beat: "swim", doing: "swim", water: [1, 1], moving: true},
            {from: off2, to: edge2, seconds: 2.4, beat: "exit_water", doing: "rest", water: [1, 0], moving: true},
            {from: edge2, to: edge2, seconds: 2.6, beat: "shake", doing: "rest", water: null, moving: false},
            {from: edge2, to: bank2, seconds: 2.2, beat: "walk", doing: "rest", water: null, moving: true},
            {from: bank2, to: bank2, seconds: 6, beat: "peck", doing: "forage", water: null, moving: false}
        ];
        debug().setHome(id, bank.x, bank.z);
        debug().pinShared(id, (epoch: number) => {
            let k = Math.max(epoch - start, 0);
            let seg = segs[segs.length - 1];
            let u = 1;
            for (const s of segs) {
                if (k < s.seconds) {
                    seg = s;
                    u = k / s.seconds;
                    break;
                }
                k -= s.seconds;
            }
            const x = seg.from.x + (seg.to.x - seg.from.x) * u;
            const z = seg.from.z + (seg.to.z - seg.from.z) * u;
            const land = ground(x, z);
            // On the water: at its surface (y 0); across an edge, from the bank's height to it (or back).
            const wet = seg.water ? seg.water[0] + (seg.water[1] - seg.water[0]) * u : 0;
            const y = seg.water ? Math.max(land, 0) * (1 - wet) : land;
            // Standing on the bank it faces the lake.
            const yaw = seg.from.x === seg.to.x && seg.from.z === seg.to.z ? Math.atan2(-Math.cos(a0), -Math.sin(a0)) : Math.atan2(seg.to.x - seg.from.x, seg.to.z - seg.from.z);
            return {x, z, y, yaw, moving: seg.moving && u < 1, aloft: false, doing: seg.doing, beat: seg.beat, nx: 0, ny: 1, nz: 0};
        });
    };

    const SCENES: Record<string, () => {note: string; watch: string[]; go?: () => void}> = {
        /** The same flight seen from 36 m (past the near level's 25 m): a flying rig is still drawn near, flapping. */
        duck_flight_far: () => {
            const at = site("grassland", 4, 2);
            const from = {x: at.x - 9, z: at.z};
            const to = {x: at.x + 9, z: at.z + 1};
            flight(ids.duck[0], from, to, nowS() + 1e6, 2, 12, 3.2, {x: to.x + 1.6, z: to.z + 0.6});
            track(ids.duck[0], 36, 1.32, 0.35);
            return {note: "the duck flight, the camera 36 m off", watch: ids.duck, go: () => flight(ids.duck[0], from, to, nowS(), 2, 12, 3.2, {x: to.x + 1.6, z: to.z + 0.6})};
        },
        /** A mallard walks from the bank into the lake, swims a little loop, climbs out, shakes off and pecks on. */
        duck_water: () => {
            waterTrip(ids.duck[0], nowS() + 1e6);
            track(ids.duck[0], 4.6, 1.2, 2.2);
            return {note: "bank 2 s, walk 2.5 s, enter 2.2 s, swim 6.5 s, exit 2.4 s, shake 2.6 s, walk 2.2 s, peck", watch: ids.duck, go: () => waterTrip(ids.duck[0], nowS())};
        },
        /** A mallard takes off, flaps across open ground (gliding a while), banks round, lands and walks on with its wings closed. */
        duck_flight: () => {
            const at = site("grassland", 4, 2);
            const from = {x: at.x - 9, z: at.z};
            const to = {x: at.x + 9, z: at.z + 1};
            flight(ids.duck[0], from, to, nowS() + 1e6, 2, 12, 3.2, {x: to.x + 1.6, z: to.z + 0.6});
            track(ids.duck[0], 4.2, 1.32, 0.35);
            return {note: "standing 2 s, then a 12 s flight at 3.2 m, a landing, a 5 s walk", watch: ids.duck, go: () => flight(ids.duck[0], from, to, nowS(), 2, 12, 3.2, {x: to.x + 1.6, z: to.z + 0.6})};
        },
        /** Three red deer grazing: head down to bite and chew, now and then the head up to look round, each on its own time. */
        deer_graze: () => {
            const at = site("grassland", -6, 8);
            ids.deer.slice(0, 3).forEach((id, i) => stand(id, at.x + i * 1.9 - 1.9, at.z + (i % 2) * 1.3, 0.6 + i * 1.9, "graze", [["bite", 5], ["chew", 2.5], ["scan", 3.5]], i * 3.7));
            // From past 14 m: nearer, the reactive layer has them watch the camera (heads up) instead of grazing.
            view(at.x, at.z + 0.5, 15.5, 1.2, 1.28, 0.7);
            return {note: "bite 5 s, chew 2.5 s, scan 3.5 s, each deer offset; the camera 15.5 m off", watch: ids.deer.slice(0, 3)};
        },
        /** A red deer at rest near the camera: the reactive layer turns its head (to the camera, round, to its kin). */
        deer_look: () => {
            const at = site("grassland", -6, 8);
            stand(ids.deer[0], at.x, at.z, 0.3, "rest", [["rest", 60]], 0);
            ids.deer.slice(1, 3).forEach((id, i) => stand(id, at.x + 3 + i * 1.5, at.z - 2.5, 2.4, "graze", [["bite", 6], ["scan", 3]], i * 2));
            view(at.x, at.z, 4.2, 0.9, 1.2, 0.9);
            return {note: "the camera 4 m from a resting deer; two more grazing behind it", watch: ids.deer.slice(0, 3)};
        },
        /** A lion walks past a grazing zebra herd 3 s in: they notice, call, bunch and run (the reactive layer's flee), on their run clips. */
        herd_flee: () => {
            const at = site("grassland", 6, 4);
            ids.zebra.forEach((id, i) => {
                const a = i * 2.39996;
                const r = i === 0 ? 0 : 5 * Math.sqrt(i / ids.zebra.length);
                stand(id, at.x + Math.cos(a) * r, at.z + Math.sin(a) * r, ((i * 1.7) % (Math.PI * 2)) - Math.PI, "graze", [["bite", 6], ["chew", 2], ["scan", 2]], i * 1.3);
            });
            const lion = (start: number) =>
                debug().pinShared(ids.lion[0], (epoch: number) => {
                    const u = Math.min(Math.max((epoch - start) / 24, 0), 1);
                    const x = at.x - 40 + 70 * u;
                    const z = at.z + 9.5;
                    return {x, z, y: ground(x, z), yaw: Math.PI / 2, moving: u > 0 && u < 1, aloft: false, doing: "wander", beat: "walk"};
                });
            lion(nowS() + 1e6);
            view(at.x - 3, at.z + 2, 17, -0.35, 1.12);
            return {note: "the lion walks past from the left 3 s in", watch: [...ids.zebra, ...ids.lion], go: () => lion(nowS() + 3)};
        },
        /** Meerkats foraging, one on watch; a martial eagle comes over 8 s in: the sentinel calls and the mob runs. */
        meerkat_sentinel: () => {
            const at = site("desert", 0, 0);
            ids.meerkat.forEach((id, i) => {
                const a = i * 2.39996;
                const r = i === 0 ? 0 : 2.2 * Math.sqrt(i / ids.meerkat.length);
                stand(id, at.x + Math.cos(a) * r, at.z + Math.sin(a) * r, ((i * 1.7) % (Math.PI * 2)) - Math.PI, "forage", [["peck", 5], ["scan", 2]], i * 1.1);
            });
            const eagle = (start: number) =>
                debug().pinShared(ids.meagle[0], (epoch: number) => {
                    const u = Math.min(Math.max((epoch - start) / 10, 0), 1);
                    const x = at.x + 60 - 100 * u;
                    return {x, z: at.z + 3, y: ground(x, at.z) + 12, yaw: -Math.PI / 2, moving: true, aloft: true, doing: "soar", beat: "glide"};
                });
            eagle(nowS() + 1e6);
            view(at.x, at.z, 7, 0.5, 1.15, 0.3);
            return {note: "the martial eagle comes over 8 s in", watch: [...ids.meerkat, ...ids.meagle], go: () => eagle(nowS() + 8)};
        },
        /** The perf scene: 24 grazers of 3 species round the camera, all within the rig distance (the caps decide how many rig). */
        crowd: () => {
            const at = site("grassland", -6, 8);
            const all = [...ids.deer, ...ids.goat, ...ids.zebra];
            all.forEach((id, i) => {
                const a = i * 2.39996;
                const r = 2 + 7 * Math.sqrt(i / all.length);
                stand(id, at.x + Math.cos(a) * r, at.z + Math.sin(a) * r, a * 1.3, "graze", [["bite", 5], ["chew", 2.5], ["scan", 3.5], ["walk", 1]], i * 1.7);
            });
            view(at.x, at.z, 11, 0.8, 1.15, 0.6);
            return {note: "24 grazers (12 red deer, 6 goats, 6 zebras) within 9 m, the camera 11 m off", watch: all};
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
            await settle(20_000);
            await wait(2500);
            result.go?.();
            return {note: result.note, watch: result.watch};
        },
        sample: (watch: string[]) => {
            const entries = debug().entries();
            return watch.map((id) => {
                const e = entries.find((x) => x.animal.id === id);
                const rig = e?.rig ?? null;
                return {
                    id,
                    slug: e?.animal.model_slug,
                    air: e ? Math.round(e.air * 100) / 100 : null,
                    clip: rig?.now.name ?? null,
                    phase: rig ? Math.round(rig.now.phase * 100) / 100 : null,
                    weight: rig ? Math.round(rig.weight * 100) / 100 : null,
                    flying: rig?.flying ?? null,
                    climb: rig ? Math.round(rig.climb * 100) / 100 : null,
                    turn: rig ? Math.round(rig.turn * 100) / 100 : null,
                    headYaw: e?.reactive ? Math.round(e.reactive.headYaw * 100) / 100 : null,
                    headPitch: e?.reactive ? Math.round(e.reactive.headPitch * 100) / 100 : null,
                    headWeight: e?.reactive ? Math.round(e.reactive.headWeight * 100) / 100 : null,
                    action: e?.reactive?.action ?? null
                };
            });
        },
        stats: () => handle.stats(),
        /** Frame intervals over `ms` (the frame clock) and the scene's own counts. */
        measure: async (ms: number) => {
            const gaps: number[] = [];
            let last = await nextFrame();
            const until = last + ms;
            while (last < until) {
                const now = await nextFrame();
                gaps.push(now - last);
                last = now;
            }
            gaps.sort((a, b) => a - b);
            const at = (q: number) => Math.round(gaps[Math.min(gaps.length - 1, Math.floor(q * gaps.length))] * 10) / 10;
            const mean = gaps.reduce((sum, g) => sum + g, 0) / Math.max(gaps.length, 1);
            const stats = handle.stats() as unknown as Record<string, unknown>;
            return {frames: gaps.length, fps: Math.round((1000 / mean) * 10) / 10, p50: at(0.5), p95: at(0.95), p99: at(0.99), tier: stats.tier, lite: stats.lite, rigged: stats.rigged, rigsLoaded: stats.rigsLoaded, near: stats.near, drawCalls: stats.drawCalls, triangles: stats.triangles, frameMs: stats.frameMs, behaviourMs: stats.behaviourMs};
        },
        /** Every frame from now: each watched animal's clip changes (and its head look's turns), with the time since the start. */
        trace: (watch: string[]) => {
            const log: Array<{t: number; id: string; clip: string | null; flying: boolean | null; weight: number | null; headYaw: number | null; action: string | null}> = [];
            const last = new Map<string, string>();
            const t0 = performance.now();
            const epoch0 = Date.now() / 1000;
            let on = true;
            const step = () => {
                if (!on) return;
                const entries = debug().entries();
                for (const id of watch) {
                    const e = entries.find((x) => x.animal.id === id);
                    const clip = e?.rig?.now.name ?? null;
                    const yaw = e?.reactive ? Math.round(e.reactive.headYaw * 10) / 10 : null;
                    const action = e?.reactive?.action ?? null;
                    const key = `${clip}|${e?.rig?.flying}|${yaw}|${action}`;
                    if (last.get(id) !== key) {
                        last.set(id, key);
                        log.push({t: Math.round(performance.now() - t0) / 1000, id, clip, flying: e?.rig?.flying ?? null, weight: e?.rig ? Math.round(e.rig.weight * 100) / 100 : null, headYaw: yaw, action});
                    }
                }
                requestAnimationFrame(step);
            };
            requestAnimationFrame(step);
            (window as unknown as {__arkRigTrace: () => {epoch0: number; log: typeof log}}).__arkRigTrace = () => {
                on = false;
                return {epoch0, log};
            };
        }
    };
}

const el = document.getElementById("ark");
if (el) {
    mountScenes(el)
        .then((api) => ((window as unknown as {__arkRig: unknown}).__arkRig = api))
        .catch((error) => ((window as unknown as {__arkRigError: string}).__arkRigError = String(error instanceof Error ? error.stack || error.message : error)));
}
