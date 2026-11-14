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
import {modelBase} from "@/ark-scene/grounding/base";
import {hipShare} from "@/ark-scene/locomotion/flee";
import {BURST_MEAN, gaitRhythm} from "@/ark-scene/locomotion/paces";
import {G} from "@/ark-scene/locomotion/gaits";

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
// The locomotion course's cast (`?cast=slug:plan,slug:plan`): one of each, prefixed "c<n>".
const COURSE_CAST: Array<{slug: string; plan: string}> = (new URLSearchParams(typeof location === "undefined" ? "" : location.search).get("cast") ?? "")
    .split(",")
    .filter(Boolean)
    .map((item) => {
        const [slug, plan] = item.split(":");
        return {slug, plan: plan ?? "quadruped"};
    });
// With a course cast, only the course's animals (a species also in the scenes' cast would be one of a herd, drawn as
// its representative's figure, and never be found).
if (COURSE_CAST.length) CAST.splice(0, CAST.length);
COURSE_CAST.forEach((c, i) => {
    if (!SPECIES[c.slug]) SPECIES[c.slug] = {name: c.slug.replace(/-/g, " "), zone: "grassland", activity: "any", sociality: null};
    CAST.push([`c${i}`, c.slug, 1]);
});
// `?loco=0`: the locomotion layer off (the baked clips, as before), for before/after recordings.
if (typeof location !== "undefined" && new URLSearchParams(location.search).get("loco") === "0") (globalThis as {__arkLoco?: boolean}).__arkLoco = false;

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
    /** A pinned shared pose (the harness's script), with no behaviour recipe act of the trip under it. */
    const pinPose = (id: string, fn: ((epoch: number) => Record<string, unknown>) | null) => debug().pinShared(id, fn ? (epoch: number) => ({act: null, ...fn(epoch)}) : null);
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
    const park = (prefix: string) => ids[prefix].forEach((id, i) => pinPose(id, () => ({x: 400 + i * 3, z: 400 + CAST.findIndex((c) => c[0] === prefix) * 6, y: 0, moving: false, aloft: false, doing: "rest", beat: "rest"})));
    const view = (x: number, z: number, distance: number, azimuth: number, polar = 1.1, lift = 0.6) => {
        debug().controls.minDistance = 0.5;
        handle.setView({target: {x, y: ground(x, z) + lift, z}, distance, polar, azimuth});
    };
    /** Stands still at a spot doing one thing, its beats cycling (bite, chew, scan) from its own offset. */
    const stand = (id: string, x: number, z: number, yaw: number, doing: string, beats: Array<[string, number]>, offset: number) => {
        const total = beats.reduce((sum, [, s]) => sum + s, 0);
        debug().setHome(id, x, z);
        pinPose(id, (epoch: number) => {
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
        pinPose(id, (epoch: number) => {
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
        pinPose(id, (epoch: number) => {
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

    /**
     * The locomotion course (lane L1's golden recordings): on a 9 m circle in the grassland, on its slopes: standing
     * 1.5 s, a walk (from 1.5 s), a trot (4.5 s), a run (5.5-8.5 s), slowing to a stop (10 s), turning on the spot
     * 150 degrees (10-12.5 s), a walk off (12.5-15 s). Speeds by Froude number on the drawn hip height (walk 0.25,
     * trot 0.9, run 2.5), so every size moves at its own natural pace. The camera follows from its side.
     */
    const course = (id: string, plan: string, start: number) => {
        const centre = site("grassland", 8, -12);
        const radius = 9;
        const len = () => Math.max(handle.locate(id)?.length ?? 1, 0.02);
        const hip = () => len() * hipShare(plan);
        const at = (fr: number) => Math.sqrt(fr * G * hip());
        const speedAt = (k: number) => {
            const walk = at(0.25);
            const trot = at(0.9);
            const run = at(2.5);
            if (k < 1.5) return 0;
            if (k < 2.5) return walk * (k - 1.5);
            if (k < 4.5) return walk;
            if (k < 5.5) return walk + (trot - walk) * (k - 4.5);
            if (k < 6.5) return trot + (run - trot) * (k - 5.5);
            if (k < 8.5) return run;
            if (k < 10) return run * (1 - (k - 8.5) / 1.5);
            if (k < 12.5) return 0;
            if (k < 13.5) return walk * (k - 12.5);
            return walk;
        };
        debug().setHome(id, centre.x + radius, centre.z);
        pinPose(id, (epoch: number) => {
            const pose = coursePose(epoch);
            courseYaw.set(id, pose.yaw);
            return pose;
        });
        function coursePose(epoch: number) {
            const k = Math.max(epoch - start, 0);
            // Distance along the circle, then straight off it after the turn.
            let s = 0;
            const h = 1 / 60;
            for (let u = 0; u < Math.min(k, 12.5); u += h) s += speedAt(u) * Math.min(h, k - u);
            const a = s / radius;
            let x = centre.x + Math.cos(a) * radius;
            let z = centre.z + Math.sin(a) * radius;
            let yaw = Math.atan2(-Math.sin(a), Math.cos(a));
            let speed = speedAt(k);
            if (k >= 10) {
                // Turning on the spot, 150 degrees to its left, eased; then off along that heading.
                const turn = (2.62 * Math.min(Math.max(k - 10, 0), 2.5)) / 2.5;
                const e = (1 - Math.cos((Math.PI * turn) / 2.62)) / 2;
                yaw += 2.62 * e;
                if (k >= 12.5) {
                    let d = 0;
                    for (let u = 12.5; u < k; u += h) d += speedAt(u) * Math.min(h, k - u);
                    x += Math.sin(yaw) * d;
                    z += Math.cos(yaw) * d;
                } else speed = 0;
            }
            const moving = speed > 0.02 * len();
            const run = speed > at(1.5);
            return {x, z, y: ground(x, z), yaw, moving, aloft: false, doing: moving ? "wander" : "rest", beat: moving ? (run ? "run" : "walk") : "rest"};
        }
    };
    /** The course's own heading per animal (the camera follows it, not the drawn heading, which turns to look at the camera). */
    const courseYaw = new Map<string, number>();
    /** The camera follows an animal from its left side (its heading + 90 degrees), a little above. */
    const trackSide = (id: string, polar: number) => {
        const token = ++tracking;
        debug().controls.minDistance = 0.1;
        const step = () => {
            if (token !== tracking) return;
            const a = handle.locate(id);
            // (A small animal from higher up: from its side the grass hides it.)
            // (A tiny one, an ant or a spider, nearly from above and close: the plants are trees at its size.)
            if (a) handle.setView({target: {x: a.x, y: a.y, z: a.z}, distance: Math.max(a.length * (a.length < 0.1 ? 9 : 3.2), a.length < 0.1 ? 0.1 : 0.25), polar: a.length < 0.1 ? 0.55 : a.length < 0.4 ? Math.min(polar, 0.9) : polar, azimuth: (courseYaw.get(id) ?? a.yaw) + Math.PI / 2});
            requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    };
    const courseScenes: Record<string, () => {note: string; watch: string[]; go?: () => void}> = Object.fromEntries(
        COURSE_CAST.map((c, i) => [
            `loco_${c.slug}`,
            () => {
                const id = ids[`c${i}`][0];
                course(id, c.plan, nowS() + 1e6);
                trackSide(id, 1.22);
                return {note: `${c.slug}: stand, walk, trot, run, stop, turn on the spot, walk off (15 s)`, watch: [id], go: () => course(id, c.plan, nowS())};
            }
        ])
    );

    const SCENES: Record<string, () => {note: string; watch: string[]; go?: () => void}> = {
        ...courseScenes,
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
                pinPose(ids.lion[0], (epoch: number) => {
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
                pinPose(ids.meagle[0], (epoch: number) => {
                    // Out of sight until it comes over (parked far off, so nobody runs before it shows).
                    if (epoch < start) return {x: 400, z: 380, y: 30, yaw: 0, moving: false, aloft: true, doing: "soar", beat: "glide"};
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

const el = new URLSearchParams(location.search).get("island") ? null : document.getElementById("ark");
if (el) {
    mountScenes(el)
        .then((api) => ((window as unknown as {__arkRig: unknown}).__arkRig = api))
        .catch((error) => ((window as unknown as {__arkRigError: string}).__arkRigError = String(error instanceof Error ? error.stack || error.message : error)));
}

/**
 * `?island=1`: the owner's view (`/ark?fixture=1`): the whole v2 fixture, the default island camera, live models and
 * rigs, nothing pinned. `window.__arkIsland.motion(seconds)` samples every animal every frame: where it is drawn
 * (`locate`), which way it faces, its level and its rig (clip, weight, pace ratio), and sums per animal the time it
 * moves facing more than 90 degrees from its way, the time it moves without a rig (gliding), and how much its way turns.
 */
async function mountIsland(el: HTMLElement) {
    const params = new URLSearchParams(location.search);
    const quality = params.get("quality");
    if (quality === "high" || quality === "medium" || quality === "low") (globalThis as {__arkQuality?: string}).__arkQuality = quality;
    if (params.get("moverGait") === "0") (globalThis as {__arkMoverGait?: boolean}).__arkMoverGait = false;
    // (`collide=0`: the collisions' layer off, the schedule's poses as they come: L5's floor for the turns measure.)
    if (params.get("collide") === "0") (globalThis as {__arkCollideOff?: boolean}).__arkCollideOff = true;
    const snapshot = decodeArkSnapshot(fixture);
    if (!snapshot) throw new Error("fixture did not decode");
    let ready = false;
    const handle: ArkSceneHandle = mountArk(el, {snapshot, modelBase: MODELS, iconUrl: (slug) => ICONS + encodeURIComponent(slug) + ".webp", onReady: () => (ready = true)});
    // `view=x,z,distance,polar,azimuth`: a view of the island other than its home view (a mid-distance look at movers).
    const view = params.get("view")?.split(",").map(Number);
    type E = {animal: {id: string; model_slug: string}; level?: string; middle?: unknown; air: number; yawNow?: number; rig?: RigSample & {ratio?: number}; sched?: {pose?: {moving?: boolean; doing?: string; x: number; z: number; act?: unknown} | null; trip?: unknown; profile?: {walkPace?: number | null; runPace?: number | null}} | null; reactive?: {dx: number; dz: number; action: string} | null};
    const entries = () => (window as unknown as {__arkDebug: {entries: () => E[]}}).__arkDebug.entries();
    const settle = async (maxMs = 180_000) => {
        const until = performance.now() + maxMs;
        let quiet = 0;
        while (performance.now() < until) {
            await wait(100);
            if (!ready || handle.loading()) quiet = 0;
            else if (!quiet) quiet = performance.now();
            else if (performance.now() - quiet > 2000) return true;
        }
        return false;
    };
    return {
        prepare: async () => {
            const settled = await settle();
            if (view && view.length === 5 && view.every(Number.isFinite)) {
                handle.setView({target: {x: view[0], y: 0.5, z: view[1]}, distance: view[2], polar: view[3], azimuth: view[4]});
                await wait(4000);
                await settle(60_000);
            }
            return {settled, stats: handle.stats()};
        },
        stats: () => handle.stats(),
        motion: async (seconds: number, startAt?: number) => {
            // (A wall-clock start shared by two runs, so a run with the layer and one without sample the same moment of
            // the schedule: `--start-at`.)
            while (startAt && Date.now() < startAt) await wait(50);
            type Track = {ratiosBaked?: number[]; ratioWhy?: Map<string, number[]>; backVisible?: number; byRecipe?: Map<string, {turn: number; moving: number}>; lastTrip?: unknown; wasMoving?: boolean; settleUntil?: number; schedLast?: {x: number; z: number; way?: number}; schedTurn?: number; schedDist?: number; offsetMax?: number; actions?: Set<string>; slug: string; last: {x: number; z: number; t: number} | null; moving: number; backwards: number; backRun: number; backRunMax: number; glide: number; glideNear: number; rigged: number; turn: number; dist: number; ratios: number[]; clips: Set<string>; levels: Set<string>; doing: Set<string>};
            const tracks = new Map<string, Track>();
            const t0 = performance.now();
            let last = t0;
            while (performance.now() - t0 < seconds * 1000) {
                await nextFrame();
                const now = performance.now();
                const dt = (now - last) / 1000;
                last = now;
                for (const e of entries()) {
                    // Not drawn this frame (hidden, down in the water seen from above, still waiting for its schedule):
                    // `locate` then gives its home, which read as a 10 m jump and a turn (a turtle's "16.9 turns a
                    // minute"). The frame is skipped, and its way starts afresh when it shows again.
                    if (!e.middle) {
                        const gone = tracks.get(e.animal.id) as (Track & {way?: number}) | undefined;
                        if (gone) {
                            gone.last = null;
                            gone.way = undefined;
                            gone.backRun = 0;
                        }
                        continue;
                    }
                    const at = handle.locate(e.animal.id);
                    if (!at) continue;
                    const tr = tracks.get(e.animal.id) ?? {slug: e.animal.model_slug, last: null, moving: 0, backwards: 0, backRun: 0, backRunMax: 0, glide: 0, glideNear: 0, rigged: 0, turn: 0, dist: 0, ratios: [], clips: new Set(), levels: new Set(), doing: new Set()};
                    tracks.set(e.animal.id, tr);
                    if (e.level) tr.levels.add(e.level);
                    // A stay's first 0.25 s (its trip just changed, or its walk just ended): the walk-in heading settling to
                    // the stay's, counted apart as "settle" (behaviour's own tests leave it out).
                    if (e.sched?.trip !== tr.lastTrip) {
                        tr.lastTrip = e.sched?.trip;
                        tr.settleUntil = now + 250;
                    }
                    const movingNow = Boolean(e.sched?.pose?.moving);
                    if (tr.wasMoving && !movingNow) tr.settleUntil = now + 250;
                    tr.wasMoving = movingNow;
                    if (e.sched?.pose?.doing) tr.doing.add(e.sched.pose.doing);
                    // The schedule's own path (before the reactive offset), to tell which one turns.
                    const sp = e.sched?.pose;
                    if (sp && (now - (tr.last?.t ?? now)) / 1000 >= 0.25) {
                        if (tr.schedLast) {
                            const sdx = sp.x - tr.schedLast.x;
                            const sdz = sp.z - tr.schedLast.z;
                            const sd = Math.hypot(sdx, sdz);
                            if (sd > 0.02) {
                                const sway = Math.atan2(sdx, sdz);
                                if (tr.schedLast.way !== undefined) {
                                    let st = sway - tr.schedLast.way;
                                    while (st > Math.PI) st -= Math.PI * 2;
                                    while (st < -Math.PI) st += Math.PI * 2;
                                    tr.schedTurn = (tr.schedTurn ?? 0) + Math.abs(st);
                                }
                                tr.schedDist = (tr.schedDist ?? 0) + sd;
                                tr.schedLast = {x: sp.x, z: sp.z, way: sway};
                            }
                        } else tr.schedLast = {x: sp.x, z: sp.z};
                    }
                    if (e.reactive) {
                        tr.offsetMax = Math.max(tr.offsetMax ?? 0, Math.hypot(e.reactive.dx, e.reactive.dz));
                        (tr.actions ??= new Set()).add(e.reactive.action);
                    }
                    // Its way: over at least 0.25 s, so a frame's jitter is no heading.
                    if (!tr.last) tr.last = {x: at.x, z: at.z, t: now};
                    const span = (now - tr.last.t) / 1000;
                    if (span >= 0.25) {
                        const dx = at.x - tr.last.x;
                        const dz = at.z - tr.last.z;
                        const d = Math.hypot(dx, dz);
                        const speed = d / span;
                        if (speed > Math.max(0.05, 0.15 * at.length) && e.air < 0.5) {
                            tr.moving += span;
                            tr.dist += d;
                            const way = Math.atan2(dx, dz);
                            let off = way - (e.yawNow ?? at.yaw);
                            while (off > Math.PI) off -= Math.PI * 2;
                            while (off < -Math.PI) off += Math.PI * 2;
                            // The body as drawn: the locomotion layer's own turn (it lags the heading by at most 35
                            // degrees while it steps round), when the legged driver poses it.
                            const loco = (e.rig as unknown as {loco?: {driver?: string | null; share?: number; states?: Map<string, {state: {bodyYaw?: number}}>}} | undefined)?.loco;
                            // (Only while its rig is drawn: a rig let go keeps its last state, from minutes ago.)
                            const drawn = (e.rig?.weight ?? 0) > 0.5 && e.rig?.now && ["walk", "run", "hop", "idle"].includes(e.rig.now.name);
                            // (MA4: a frog's hop driver turns its body too, between hops.)
                            const bodyYaw = drawn && (loco?.driver === "legged" || loco?.driver === "saltation") && (loco.share ?? 0) > 0.5 ? loco.states?.get(loco.driver)?.state.bodyYaw : undefined;
                            if (bodyYaw !== undefined) {
                                let seen = way - bodyYaw;
                                while (seen > Math.PI) seen -= Math.PI * 2;
                                while (seen < -Math.PI) seen += Math.PI * 2;
                                if (Math.abs(seen) > Math.PI / 2) tr.backVisible = (tr.backVisible ?? 0) + span;
                            } else if (Math.abs(off) > Math.PI / 2) tr.backVisible = (tr.backVisible ?? 0) + span;
                            if (Math.abs(off) > Math.PI / 2) {
                                tr.backwards += span;
                                tr.backRun += span;
                                tr.backRunMax = Math.max(tr.backRunMax, tr.backRun);
                            } else tr.backRun = 0;
                            const rigged = (e.rig?.weight ?? 0) > 0.5;
                            if (rigged) {
                                tr.rigged += span;
                                if (e.rig?.now) tr.clips.add(e.rig.now.name);
                                if (e.rig?.ratio) {
                                    // Whether its feet are the baked clip's (played by distance: the pace ratio is what the
                                    // eye sees) or the locomotion layer's (stride and cadence from the speed: the clip's own
                                    // pace no longer matters), and what moved it (its schedule beat, a recipe act, the
                                    // reactive layer's action).
                                    const lc = (e.rig as unknown as {loco?: {driver?: string | null; share?: number}}).loco;
                                    // (MA4: a true seal's galumph and a frog's hops follow the speed too.)
                                    const layered = (lc?.driver === "legged" || lc?.driver === "galumph" || lc?.driver === "saltation") && (lc.share ?? 0) > 0.5;
                                    // Under the layer, against the pace it is driven at: its schedule's walk (its run's on
                                    // the run clip), in body lengths a second (`behaviours.json`, decision 202's natural
                                    // paces). The baked clip's ground speed (`rig.ratio`) is the reach-limited clip's: a
                                    // bullfrog at its natural walk read 7 times it (the integrator's default view, 2026-11-12).
                                    const prof = e.sched?.profile;
                                    // (Lane B4: on a run leg of its schedule too, whatever clip the pace picked: the paces are the
                                    // animal's own now, not the clips', so a trot may be under its walk clip's pace.)
                                    const running = e.rig.now?.name === "run" || (e.sched?.pose as {beat?: string} | null | undefined)?.beat === "run";
                                    let own = prof?.walkPace ? (running && prof.runPace ? prof.runPace : prof.walkPace) * Math.max(at.length, 0.01) : 0;
                                    // (A burst mover in a burst, a mouse, a small lizard, a rabbit, goes at its bursts' pace:
                                    // its walk's over its share moving, `gaitRhythm`.)
                                    const rhythm = gaitRhythm(e.animal.model_slug, modelBase(e.animal.model_slug)?.plan, at.length);
                                    if (!running && rhythm.share < 1 && speed > own * 1.2) own /= rhythm.share * BURST_MEAN;
                                    const ratio = layered && own > 0 ? speed / own : e.rig.ratio;
                                    tr.ratios.push(ratio);
                                    if (!layered) (tr.ratiosBaked ??= []).push(ratio);
                                    const act = (e.sched?.pose?.act as {state?: string} | null | undefined)?.state;
                                    const why = `${layered ? "layer" : "baked"}:${e.rig.now?.name ?? "?"}:${act ? `act ${act}` : e.reactive?.action && e.reactive.action !== "none" ? `reactive ${e.reactive.action}` : `sched ${(e.sched?.pose as {beat?: string} | null | undefined)?.beat ?? "?"}`}`;
                                    const list = (tr.ratioWhy ??= new Map()).get(why) ?? [];
                                    list.push(ratio);
                                    tr.ratioWhy.set(why, list);
                                }
                            } else {
                                tr.glide += span;
                                if (e.level === "near") tr.glideNear += span;
                            }
                            const prevWay = (tr as Track & {way?: number}).way;
                            if (prevWay !== undefined) {
                                let turn = way - prevWay;
                                while (turn > Math.PI) turn -= Math.PI * 2;
                                while (turn < -Math.PI) turn += Math.PI * 2;
                                tr.turn += Math.abs(turn);
                                // Whose turning: a recipe episode laid over the schedule (its pose acts), or the schedule's own steps.
                                const act = e.sched?.pose?.act as {recipe?: string; block?: string} | null | undefined;
                                const source = now < (tr.settleUntil ?? 0) ? "settle" : act ? `recipe:${act.recipe ?? "?"}/${act.block ?? "?"}` : `schedule:${(e.sched?.pose as {beat?: string} | null | undefined)?.beat ?? "?"}`;
                                const by = (tr.byRecipe ??= new Map()).get(source) ?? {turn: 0, moving: 0};
                                by.turn += Math.abs(turn);
                                tr.byRecipe.set(source, by);
                            }
                            {
                                const act = e.sched?.pose?.act as {recipe?: string; block?: string} | null | undefined;
                                const source = now < (tr.settleUntil ?? 0) ? "settle" : act ? `recipe:${act.recipe ?? "?"}/${act.block ?? "?"}` : `schedule:${(e.sched?.pose as {beat?: string} | null | undefined)?.beat ?? "?"}`;
                                const by = (tr.byRecipe ??= new Map()).get(source) ?? {turn: 0, moving: 0};
                                by.moving += span;
                                tr.byRecipe.set(source, by);
                            }
                            (tr as Track & {way?: number}).way = way;
                        } else tr.backRun = 0;
                        tr.last = {x: at.x, z: at.z, t: now};
                    }
                }
                void dt;
            }
            const rows = Array.from(tracks.entries()).map(([id, t]) => {
                const sorted = t.ratios.slice().sort((a, b) => a - b);
                return {
                    id: id.slice(-6),
                    slug: t.slug,
                    levels: Array.from(t.levels).join(","),
                    doing: Array.from(t.doing).join(","),
                    moving: Math.round(t.moving * 10) / 10,
                    backwards: Math.round(t.backwards * 10) / 10,
                    backwardsVisible: Math.round((t.backVisible ?? 0) * 10) / 10,
                    backRunMax: Math.round(t.backRunMax * 10) / 10,
                    glide: Math.round(t.glide * 10) / 10,
                    glideNear: Math.round(t.glideNear * 10) / 10,
                    rigged: Math.round(t.rigged * 10) / 10,
                    clips: Array.from(t.clips).join(","),
                    ratioMedian: sorted.length ? Math.round(sorted[Math.floor(sorted.length / 2)] * 100) / 100 : null,
                    ratioBakedMedian: t.ratiosBaked?.length ? Math.round(t.ratiosBaked.slice().sort((a, b) => a - b)[t.ratiosBaked.length >> 1] * 100) / 100 : null,
                    ratioWhy: Object.fromEntries(Array.from(t.ratioWhy ?? new Map<string, number[]>()).map(([k, v]) => [k, {n: v.length, median: Math.round(v.slice().sort((a, b) => a - b)[v.length >> 1] * 100) / 100}])),
                    ratioMax: sorted.length ? Math.round(sorted[sorted.length - 1] * 100) / 100 : null,
                    turnsPerMinute: t.moving > 0 ? Math.round(((t.turn / (Math.PI * 2)) / t.moving) * 60 * 10) / 10 : 0,
                    turnPerMetre: t.dist > 0 ? Math.round((t.turn / t.dist) * 100) / 100 : 0,
                    schedTurnPerMetre: t.schedDist ? Math.round(((t.schedTurn ?? 0) / t.schedDist) * 100) / 100 : null,
                    schedDist: Math.round((t.schedDist ?? 0) * 10) / 10,
                    drawnDist: Math.round(t.dist * 10) / 10,
                    reactiveOffsetMax: Math.round((t.offsetMax ?? 0) * 100) / 100,
                    actions: Array.from(t.actions ?? []).join(","),
                    // Turns a minute of movement by source: each recipe episode, and the schedule's own steps.
                    turnsBySource: Object.fromEntries(Array.from(t.byRecipe ?? new Map<string, {turn: number; moving: number}>()).map(([key, v]) => [key, {moving: Math.round(v.moving * 10) / 10, turnsPerMinute: v.moving > 0 ? Math.round(((v.turn / (Math.PI * 2)) / v.moving) * 60 * 10) / 10 : 0}]))
                };
            });
            return {rows, stats: handle.stats()};
        }
    };
}

if (new URLSearchParams(location.search).get("island")) {
    const island = document.getElementById("ark");
    if (island) {
        mountIsland(island)
            .then((api) => ((window as unknown as {__arkIsland: unknown}).__arkIsland = api))
            .catch((error) => ((window as unknown as {__arkRigError: string}).__arkRigError = String(error instanceof Error ? error.stack || error.message : error)));
    }
}
