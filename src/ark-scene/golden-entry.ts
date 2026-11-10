/**
 * The golden-shot page's script (development only; scripts/ark-golden-shots.mjs
 * builds it into `.ark-golden/` and serves it, nothing deploys it).
 *
 *   golden.html                      the live scene on the v2 fixture, as `window.__arkGolden`
 *   golden.html?quality=high|medium|low   the tier pinned (`__arkQuality`); default: the device decides
 *   golden.html?study=<direction>    an art-direction study instead (`study/art-study.ts`)
 *
 * The world adapter below is the one place that knows today's map modules:
 * when the map build changes them, update `goldenWorld` and the shots
 * (`golden-shots.ts`) keep their names and framing.
 */

import {decodeArkSnapshot, mountArk} from "@/ark-scene";
import type {ArkCameraView, ArkSceneHandle} from "@/ark-scene/types";
import {GOLDEN_PLACES, GOLDEN_TIMES, goldenView, type GoldenPlace, type GoldenTime, type GoldenWorld} from "@/ark-scene/golden-shots";
import {LAKE, RIVER, ZONE_SITES, heightAt, regionCentre, sampleGround} from "@/ark-scene/world";
import {worldDecor} from "@/ark-scene/decor";
import {COTTAGE, microCorner} from "@/ark-scene/micro-decor";
import fixture from "@/ark-scene/fixtures/snapshot-v2.json";
import {mountArtStudy, type ArtStudyHandle} from "@/ark-scene/study/art-study";

const MODELS = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/talking-models/v1/ark";
const ICONS = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/";

function goldenWorld(handle: ArkSceneHandle): GoldenWorld {
    return {
        homeView: () => handle.homeView(),
        groundAt: (x, z) => heightAt(x, z),
        beach: () => ZONE_SITES.seashore,
        // Rocks at the waterline on open shore, not under a sea cliff (the beach's kind of coast).
        shoreRocks: () => worldDecor().filter((item) => item.kind === "rock" && item.y < 0.2 && item.y > -0.9 && sampleGround(item.x, item.z).cliff < 0.25).map((item) => ({x: item.x, z: item.z, scale: item.scale})),
        forestFloor: () => microCorner("woodland"),
        house: () => ({x: COTTAGE.x, z: COTTAGE.z}),
        fields: () => ZONE_SITES.farm_garden,
        lake: () => ({x: LAKE.x, z: LAKE.z}),
        river: () => RIVER.map(([x, z]) => ({x, z})),
        mountainArea: () => {
            const centre = regionCentre("high_cold");
            const site = ZONE_SITES.mountains;
            return {x: site.x, z: site.z - 6, radius: Math.max(centre.radius * 0.5, 26)};
        },
        reef: () => ZONE_SITES.coral_reef
    };
}

type Measure = {
    /** Wall time between drawn frames (what the reader sees), ms. */
    intervalP50: number;
    intervalP95: number;
    fps: number;
    /** The scene's own CPU time per frame (update + render submit), ms. */
    cpuMs: number;
    /** Extra wait for the GPU to finish the frame (a 1-pixel readPixels after it), ms. */
    gpuDrainMs: number;
    drawCalls: number;
    triangles: number;
    tier: string;
    lite: boolean;
    pixelRatio: number;
    near: number;
    far: number;
    modelsLoaded: number;
};

const percentile = (values: number[], p: number) => {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
};
const round = (value: number) => Math.round(value * 100) / 100;
const nextFrame = () => new Promise<number>((resolve) => requestAnimationFrame(resolve));

/** Frames for `ms`: intervals free-running, then (for half as long) each frame drained with a 1-pixel read. */
async function measureFrames(canvas: HTMLCanvasElement, ms: number): Promise<{intervals: number[]; drains: number[]}> {
    const gl = (canvas.getContext("webgl2") ?? canvas.getContext("webgl")) as WebGLRenderingContext | null;
    const pixel = new Uint8Array(4);
    const intervals: number[] = [];
    const drains: number[] = [];
    let last = await nextFrame();
    const until = performance.now() + ms;
    while (performance.now() < until) {
        const now = await nextFrame();
        intervals.push(now - last);
        last = now;
    }
    const drainUntil = performance.now() + ms / 2;
    while (gl && performance.now() < drainUntil) {
        await nextFrame();
        const started = performance.now();
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
        drains.push(performance.now() - started);
    }
    return {intervals, drains};
}

async function mountGolden(el: HTMLElement) {
    const params = new URLSearchParams(location.search);
    const quality = params.get("quality");
    if (quality === "high" || quality === "medium" || quality === "low") (globalThis as {__arkQuality?: string}).__arkQuality = quality;
    const snapshot = decodeArkSnapshot(fixture);
    if (!snapshot) throw new Error("fixture did not decode");
    let ready = false;
    const handle = mountArk(el, {
        snapshot,
        modelBase: MODELS,
        iconUrl: (slug) => ICONS + encodeURIComponent(slug) + ".webp",
        recording: true,
        hours: GOLDEN_TIMES.day,
        onReady: () => {
            ready = true;
        }
    });
    const canvas = el.querySelector("canvas") as HTMLCanvasElement;
    const world = goldenWorld(handle);

    const settle = async (quietMs: number, maxMs = 90_000) => {
        const until = performance.now() + maxMs;
        let quietSince = 0;
        while (performance.now() < until) {
            await new Promise((resolve) => setTimeout(resolve, 80));
            if (!ready || handle.loading()) quietSince = 0;
            else if (!quietSince) quietSince = performance.now();
            else if (performance.now() - quietSince > quietMs) return true;
        }
        return false;
    };

    return {
        places: GOLDEN_PLACES,
        times: GOLDEN_TIMES,
        /** Every species' models in, before the first shot (so nothing pops in). */
        prepare: async () => {
            await settle(200);
            await handle.preload(Array.from(new Set(snapshot.animals.map((animal) => animal.model_slug))));
            const settled = await settle(1500, 150_000);
            return {settled, stats: handle.stats()};
        },
        /** Frame the named place in the named light; resolves once it is drawn and quiet. */
        shoot: async (place: GoldenPlace, time: GoldenTime) => {
            const shot = goldenView(place, world);
            handle.setHours(GOLDEN_TIMES[time]);
            handle.setView(shot.view);
            // The view keeps itself over the ground for a few frames (setView, then the scene's own limits): hold it there.
            for (let i = 0; i < 20; i++) {
                await nextFrame();
                if (i < 6) handle.setView(shot.view);
            }
            await settle(700, 30_000);
            return {anchor: shot.anchor, asked: shot.view, actual: handle.view() as ArkCameraView};
        },
        measure: async (ms = 3000): Promise<Measure> => {
            const {intervals, drains} = await measureFrames(canvas, ms);
            const stats = handle.stats();
            const p50 = percentile(intervals, 0.5);
            return {
                intervalP50: round(p50),
                intervalP95: round(percentile(intervals, 0.95)),
                fps: round(intervals.length / (intervals.reduce((sum, value) => sum + value, 0) / 1000)),
                cpuMs: round(stats.frameMs),
                gpuDrainMs: round(percentile(drains, 0.5)),
                drawCalls: stats.drawCalls,
                triangles: stats.triangles,
                tier: stats.tier,
                lite: stats.lite,
                pixelRatio: stats.pixelRatio,
                near: stats.near,
                far: stats.far,
                modelsLoaded: stats.modelsLoaded
            };
        },
        stats: () => handle.stats()
    };
}

type GoldenApi = Awaited<ReturnType<typeof mountGolden>>;

declare global {
    interface Window {
        __arkGolden?: GoldenApi;
        __arkStudy?: ArtStudyHandle & {measure: (ms?: number) => Promise<{intervalP50: number; intervalP95: number; fps: number; gpuDrainMs: number}>};
        __arkGoldenError?: string;
    }
}

(async () => {
    const el = document.getElementById("ark") as HTMLElement;
    const study = new URLSearchParams(location.search).get("study");
    try {
        if (study) {
            const handle = await mountArtStudy(el, study);
            window.__arkStudy = {
                ...handle,
                measure: async (ms = 3000) => {
                    const {intervals, drains} = await measureFrames(handle.canvas, ms);
                    return {
                        intervalP50: round(percentile(intervals, 0.5)),
                        intervalP95: round(percentile(intervals, 0.95)),
                        fps: round(intervals.length / (intervals.reduce((sum, value) => sum + value, 0) / 1000)),
                        gpuDrainMs: round(percentile(drains, 0.5))
                    };
                }
            };
        } else {
            window.__arkGolden = await mountGolden(el);
        }
    } catch (error) {
        window.__arkGoldenError = String((error as Error)?.stack ?? error);
    }
})();
