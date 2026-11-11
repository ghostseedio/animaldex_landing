/**
 * The behaviour intelligence scenarios' page script (development only;
 * `scripts/ark-intelligence-scenarios.mjs` builds it into `.ark-golden/` and
 * serves it, nothing deploys it). The live scene on the v2 fixture plus the
 * scenario animals, as `window.__arkIntel`:
 *
 *   setup(name)    arrange a scenario: homes for its animals (as if the shared layer put them there), a scripted
 *                  shared path for a passing predator, the hour, the weather, the camera; resolves when drawn.
 *   sample()       every scenario animal's reactive state now (action, head look, offset, alarm).
 *   measure(ms)    frame intervals and the reactive layer's cost.
 *
 * The scripted predator path and the homes are the harness standing in for the shared layer (a schedule that
 * happens to walk the lion past the zebras at this minute); the reactive layer under test is the real one.
 */

import {decodeArkSnapshot, mountArk} from "@/ark-scene";
import type {ArkSceneHandle} from "@/ark-scene/types";
import {heightAt, ZONE_SITES} from "@/ark-scene/world";
import fixture from "@/ark-scene/fixtures/snapshot-v2.json";

const MODELS = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/talking-models/v1/ark";
const ICONS = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/";

type Raw = (typeof fixture)["animals"][number];
const SPECIES: Record<string, {id: string; name: string; zone: string; activity: string | null; sociality: string | null}> = {
    "plains-zebra": {id: "c77f8bc4-c073-4a77-ad24-788b76fbbbda", name: "Plains Zebra", zone: "grassland", activity: "any", sociality: "group"},
    "african-lion": {id: "7e7080ec-9c17-4a75-9d85-5a4f6a38e430", name: "African Lion", zone: "grassland", activity: null, sociality: "group"},
    "eurasian-wolf": {id: "355114d7-d9b2-44bd-a567-cf23bd454456", name: "Eurasian Wolf", zone: "woodland", activity: null, sociality: "group"},
    "roe-deer": {id: "3ee80e06-ce44-4f0f-ba8e-d88526d622a9", name: "Roe Deer", zone: "woodland", activity: "any", sociality: null},
    "red-squirrel": {id: "0dc31b55-7102-4391-9616-0cab092062a5", name: "Red Squirrel", zone: "woodland", activity: "diurnal", sociality: null},
    chimpanzee: {id: "56169946-7f4c-4aa1-89d6-bc2512abd7b4", name: "Chimpanzee", zone: "rainforest", activity: "diurnal", sociality: null},
    meerkat: {id: "1ecdb4fb-75ce-484f-8a9c-c7b7d4bcaf01", name: "Meerkat", zone: "desert", activity: "diurnal", sociality: "group"},
    bateleur: {id: "5b50ee3a-fc81-480c-bef7-f42a844209a9", name: "Bateleur", zone: "grassland", activity: "diurnal", sociality: "pair"}
};

/** The scenario animals: id prefix, species, how many. */
const CAST: Array<[string, string, number]> = [
    ["zebra", "plains-zebra", 8],
    ["lion", "african-lion", 1],
    ["wolf", "eurasian-wolf", 3],
    ["deer", "roe-deer", 5],
    ["squirrel", "red-squirrel", 2],
    ["chimp", "chimpanzee", 5],
    ["meerkat", "meerkat", 6],
    ["eagle", "bateleur", 1]
];

/** A fixed uuid per scenario animal (the prefix's index and the animal's). */
function castId(prefix: string, i: number): string {
    const k = CAST.findIndex((c) => c[0] === prefix);
    return `0000beef-0000-4000-8000-${(k * 256 + i).toString(16).padStart(12, "0")}`;
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
                species_profile_id: sp.id,
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

type Debug = {
    entries: () => Array<{animal: {id: string; model_slug: string}; youngOf?: {parent: string | null; play: number; at: number}; reactive?: unknown}>;
    reactive: () => {stats: {agents: number; perceptions: number; sightChecks: number; ms: number}; ms: number; tier: string | null};
    pinShared: (id: string, fn: ((epoch: number) => Record<string, unknown>) | null) => void;
    setHome: (id: string, x: number, z: number) => boolean;
    controls: {minDistance: number};
};

const nextFrame = () => new Promise<number>((resolve) => requestAnimationFrame(resolve));
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function mountScenarios(el: HTMLElement) {
    const params = new URLSearchParams(location.search);
    const quality = params.get("quality");
    if (quality === "high" || quality === "medium" || quality === "low") (globalThis as {__arkQuality?: string}).__arkQuality = quality;
    const cast = castAnimals();
    // Only the cast: the fixture's own predators (crocodiles at the pond, lions) would set the herds off before the scenario starts.
    const snapshot = decodeArkSnapshot({...fixture, animals: cast});
    if (!snapshot) throw new Error("fixture did not decode");
    let ready = false;
    const handle: ArkSceneHandle = mountArk(el, {snapshot, modelBase: MODELS, iconUrl: (slug) => ICONS + encodeURIComponent(slug) + ".webp", recording: true, hours: 10, onReady: () => (ready = true)});
    handle.setEnvironment({seaLevel: 0, wetness: 0, snow: 0, wind: 0.3, storm: 0, windDirection: 0.4});
    const debug = () => (window as unknown as {__arkDebug: Debug}).__arkDebug;
    const byPrefix: Record<string, string[]> = Object.fromEntries(CAST.map(([prefix, , n]) => [prefix, Array.from({length: n}, (_, i) => castId(prefix, i))]));
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
    const clearPins = () => {
        for (const [prefix] of CAST) for (const id of byPrefix[prefix]) debug().pinShared(id, null);
    };
    /**
     * Holds a group still at a point, grazing or resting (the harness standing in for a shared layer that has them at
     * their spots this minute), so what the reactive layer adds is plain to see.
     */
    const hold = (prefix: string, x: number, z: number, spread: number, doing: string, count = byPrefix[prefix].length) => {
        byPrefix[prefix].slice(0, count).forEach((id, i) => {
            const a = i * 2.39996;
            const r = i === 0 ? 0 : spread * Math.sqrt(i / count);
            const px = x + Math.cos(a) * r;
            const pz = z + Math.sin(a) * r;
            const yaw = ((i * 1.7) % (Math.PI * 2)) - Math.PI;
            debug().setHome(id, px, pz);
            debug().pinShared(id, () => ({x: px, z: pz, y: Math.max(heightAt(px, pz), 0), yaw, moving: false, aloft: false, doing, nx: 0, ny: 1, nz: 0}));
        });
    };
    /** Parks a group far off (out of the scene's way) so it doesn't wander into another scenario. */
    const park = (prefix: string) => {
        byPrefix[prefix].forEach((id, i) => debug().pinShared(id, () => ({x: 400 + i * 3, z: 400, y: 0, moving: false, aloft: false, doing: "rest"})));
    };
    const walk = (id: string, from: {x: number; z: number}, to: {x: number; z: number}, start: number, seconds: number, doing = "wander") => {
        debug().pinShared(id, (epoch: number) => {
            const u = Math.min(Math.max((epoch - start) / seconds, 0), 1);
            const x = from.x + (to.x - from.x) * u;
            const z = from.z + (to.z - from.z) * u;
            return {x, z, y: Math.max(heightAt(x, z), 0), yaw: Math.atan2(to.x - from.x, to.z - from.z), moving: u > 0 && u < 1, aloft: false, nx: 0, ny: 1, nz: 0, doing};
        });
    };
    const view = (x: number, z: number, distance: number, azimuth: number, polar = 1.05) => {
        debug().controls.minDistance = 1;
        handle.setView({target: {x, y: Math.max(heightAt(x, z), 0) + 0.6, z}, distance, polar, azimuth});
    };
    const nowS = () => Date.now() / 1000;
    const site = (zone: keyof typeof ZONE_SITES, dx = 0, dz = 0) => ({x: ZONE_SITES[zone].x + dx, z: ZONE_SITES[zone].z + dz});

    /** Each scenario arranges its animals and returns what to watch, and `go`: the scripted shared paths start when recording starts. */
    const SCENARIOS: Record<string, () => Promise<{note: string; watch: string[]; go?: () => void}>> = {
        /** A lion walks past a zebra herd: the first to notice calls, the alarm runs through, they bunch and run. */
        predator_herd: async () => {
            const at = site("grassland", 6, 4);
            hold("zebra", at.x, at.z, 5, "graze");
            walk(byPrefix.lion[0], {x: at.x - 40, z: at.z + 9}, {x: at.x + 30, z: at.z + 10}, nowS() + 1e6, 24);
            view(at.x - 4, at.z + 2, 20, -0.35, 1.1);
            return {note: "the lion walks past from the left 3 s in", watch: [...byPrefix.zebra, ...byPrefix.lion], go: () => walk(byPrefix.lion[0], {x: at.x - 40, z: at.z + 9}, {x: at.x + 30, z: at.z + 10}, nowS() + 3, 24)};
        },
        /** Wolves not acting out a meal stalk a deer group visually and stop short; the deer watch, then move off. */
        pack_hunt: async () => {
            const at = site("woodland", -4, 6);
            hold("deer", at.x, at.z, 3.5, "graze");
            const wolves = (start: number) => byPrefix.wolf.forEach((id, i) => walk(id, {x: at.x - 24 + i * 2, z: at.z - 16 - i * 1.5}, {x: at.x - 10 + i * 2.5, z: at.z - 7 - i}, start, 12));
            wolves(nowS() + 1e6);
            view(at.x - 6, at.z - 4, 18, -0.9, 1.1);
            return {note: "three wolves come in from the south-west and stalk", watch: [...byPrefix.deer, ...byPrefix.wolf], go: () => wolves(nowS() + 2)};
        },
        /** A squirrel buries food, goes about its business, and comes back to dig it up. */
        squirrel_cache: async () => {
            const at = site("woodland", 8, -6);
            hold("squirrel", at.x, at.z, 3, "forage");
            view(at.x + 1, at.z, 6, 0.6, 1.05);
            return {note: "forage slots: bury, then return after 20 s", watch: byPrefix.squirrel};
        },
        /** After the lion has gone, the zebras keep away from where it was and stay watchful; a second pass, quicker. */
        avoid_spot: async () => {
            const at = site("grassland", 6, 4);
            hold("zebra", at.x, at.z, 5, "graze");
            walk(byPrefix.lion[0], {x: at.x - 70, z: at.z + 2}, {x: at.x - 70, z: at.z + 2}, nowS(), 1);
            view(at.x - 4, at.z, 22, -0.4, 1.1);
            return {
                note: "the lion walks in to 14 m, stands 5 s, walks off; the herd keeps away from that spot",
                watch: [...byPrefix.zebra, ...byPrefix.lion],
                go: () => {
                    const t = nowS();
                    debug().pinShared(byPrefix.lion[0], (epoch: number) => {
                        const k = epoch - t;
                        const x = k < 4 ? at.x - 40 + 26 * (k / 4) : k < 9 ? at.x - 14 : at.x - 14 - 8 * (k - 9);
                        const z = at.z + 2;
                        return {x, z, y: Math.max(heightAt(x, z), 0), yaw: k < 9 ? Math.PI / 2 : -Math.PI / 2, moving: k < 4 || k > 9, aloft: false, doing: "wander"};
                    });
                }
            };
        },
        /** A zebra mare puts herself between her foal and a lion. */
        parents_shield: async () => {
            const at = site("grassland", -10, 12);
            hold("zebra", at.x, at.z, 3, "graze", 2);
            // The harness makes zebra1 the young of zebra0 (the scene takes this from the log's births: `ark-age.ts`).
            const foal = debug().entries().find((e) => e.animal.id === byPrefix.zebra[1]);
            if (foal) foal.youngOf = {parent: byPrefix.zebra[0], play: 0.5, at: nowS() + 1e6};
            walk(byPrefix.lion[0], {x: at.x + 30, z: at.z + 22}, {x: at.x + 30, z: at.z + 22}, nowS(), 1);
            view(at.x + 3, at.z + 2, 14, 0.9, 1.1);
            return {note: "the lion comes in from the north-east and stops 10 m off", watch: [byPrefix.zebra[0], byPrefix.zebra[1], byPrefix.lion[0]], go: () => walk(byPrefix.lion[0], {x: at.x + 30, z: at.z + 22}, {x: at.x + 8, z: at.z + 6}, nowS() + 2, 9)};
        },
        /** A storm: the herd goes to shelter and keeps low, back to the wind. */
        storm: async () => {
            const at = site("grassland", 6, 4);
            hold("zebra", at.x, at.z, 5, "graze");
            handle.setEnvironment({seaLevel: 0, wetness: 1, snow: 0, wind: 1, storm: 1, windDirection: 1.2});
            view(at.x, at.z, 24, 0.4);
            return {note: "storm 1, rain 1, wind 1", watch: byPrefix.zebra};
        },
        /** Curious, sharp chimpanzees come over to look at the camera; a dull animal would only glance. */
        curious_camera: async () => {
            const at = site("rainforest", 0, 0);
            hold("chimp", at.x, at.z, 3, "rest");
            view(at.x, at.z - 1, 7, Math.PI, 1.2);
            return {note: "the camera 7 m from the group", watch: byPrefix.chimp};
        },
        /** Meerkats with one on watch; a bateleur comes over: the sentinel calls first and the mob runs. */
        sentinel_raptor: async () => {
            const at = site("desert", 0, 0);
            hold("meerkat", at.x, at.z, 2.2, "forage");
            const eagle = (start: number) =>
                debug().pinShared(byPrefix.eagle[0], (epoch: number) => {
                    const u = Math.min(Math.max((epoch - start) / 10, 0), 1);
                    const x = at.x + 60 - 100 * u;
                    return {x, z: at.z + 3, y: Math.max(heightAt(x, at.z), 0) + 12, yaw: -Math.PI / 2, moving: true, aloft: true, doing: "soar"};
                });
            eagle(nowS() + 1e6);
            view(at.x, at.z, 8, 0.5, 1.15);
            return {note: "the bateleur comes over 8 s in", watch: [...byPrefix.meerkat, ...byPrefix.eagle], go: () => eagle(nowS() + 8)};
        }
    };

    return {
        scenarios: Object.keys(SCENARIOS),
        ids: byPrefix,
        prepare: async () => {
            await settle();
            await handle.preload(Array.from(new Set(cast.map((a) => a.model_slug))));
            return {settled: await settle(), stats: handle.stats()};
        },
        setup: async (name: string) => {
            clearPins();
            handle.setEnvironment({seaLevel: 0, wetness: 0, snow: 0, wind: 0.3, storm: 0, windDirection: 0.4});
            for (const [prefix] of CAST) park(prefix);
            const run = SCENARIOS[name];
            if (!run) throw new Error(`no scenario ${name}`);
            // Unpark the cast this scenario uses (its own setup pins or homes them).
            const result = await run();
            for (let i = 0; i < 20; i++) await nextFrame();
            await settle(20_000);
            // Let the herd settle into its calm business before anything happens.
            await wait(1500);
            result.go?.();
            return {note: result.note, watch: result.watch};
        },
        sample: (watch: string[]) => {
            const out: Record<string, unknown> = {};
            for (const id of watch) out[id] = handle.reactive(id);
            return {t: Date.now() / 1000, out, stats: handle.reactiveStats()};
        },
        measure: async (ms = 3000) => {
            const intervals: number[] = [];
            const costs: number[] = [];
            let last = await nextFrame();
            const until = performance.now() + ms;
            while (performance.now() < until) {
                const now = await nextFrame();
                intervals.push(now - last);
                last = now;
                costs.push(handle.reactiveStats().ms);
            }
            const p = (values: number[], q: number) => [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(values.length * q))] ?? 0;
            const stats = handle.stats();
            return {intervalP50: p(intervals, 0.5), intervalP95: p(intervals, 0.95), reactiveP50: p(costs, 0.5), reactiveP95: p(costs, 0.95), reactive: handle.reactiveStats(), frameMs: stats.frameMs, tier: stats.tier};
        }
    };
}

declare global {
    interface Window {
        __arkIntel?: Awaited<ReturnType<typeof mountScenarios>>;
        __arkIntelError?: string;
    }
}

(async () => {
    try {
        const el = document.getElementById("ark")!;
        window.__arkIntel = await mountScenarios(el);
    } catch (error) {
        window.__arkIntelError = String((error as Error)?.stack ?? error);
    }
})();
