/**
 * The runtime lane's measurement page (development only: scripts/ark-runtime-measure.mjs builds it into
 * `.ark-golden/runtime/` and serves it; nothing deploys it). The live scene on the v2 fixture, mounted as the /ark
 * page mounts it (the opening flight, the device's own tier), timed from the script's first line:
 *
 *   - mount: how long `mountArk` held the main thread;
 *   - first frame: when the scene said it drew (`onReady`);
 *   - in view: when the models asked for by then were all in (the first time `loading()` went quiet after the
 *     opening), and every 250 ms the models loaded, draw calls and the scene's memory estimate;
 *   - memory: the JS heap and the scene's GPU estimate (geometry and texture bytes, `runtime/memory.ts`).
 *
 * The long tasks are read by the driver (a PerformanceObserver installed before this script runs).
 */

import {decodeArkSnapshot, mountArk} from "@/ark-scene";
import fixture from "@/ark-scene/fixtures/snapshot-v2.json";
import {sceneMemory} from "@/ark-scene/runtime/memory";
import type {Scene} from "three";

const MODELS = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/talking-models/v1/ark";
const ICONS = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/";

type Sample = {t: number; models: number; drawCalls: number; triangles: number; loading: boolean; tier: string; geometryMB: number; textureMB: number};

declare global {
    interface Window {
        __arkMeasure?: {done: boolean; result?: unknown; error?: string};
        __arkScriptStart?: number;
    }
}

const round = (value: number) => Math.round(value * 10) / 10;

(async () => {
    window.__arkMeasure = {done: false};
    const t0 = performance.now();
    const params = new URLSearchParams(location.search);
    const seconds = Number(params.get("seconds") ?? "20");
    const quality = params.get("quality");
    if (quality === "high" || quality === "medium" || quality === "low") (globalThis as {__arkQuality?: string}).__arkQuality = quality;
    try {
        const snapshot = decodeArkSnapshot(fixture);
        if (!snapshot) throw new Error("fixture did not decode");
        const el = document.getElementById("ark") as HTMLElement;
        let firstFrame = 0;
        const mountStart = performance.now();
        const handle = mountArk(el, {
            snapshot,
            modelBase: MODELS,
            iconUrl: (slug) => ICONS + encodeURIComponent(slug) + ".webp",
            onReady: () => {
                firstFrame = performance.now();
            }
        });
        const mountMs = performance.now() - mountStart;
        // The Mac running the harness is busy with other work: its CPU pressure is not the phone's. Power as a calm
        // device unless the page asks (`?power=saver|serious|critical`).
        const power = params.get("power");
        // (Optional: the same page measures a build from before the runtime, which has no setPower.)
        (handle as {setPower?: typeof handle.setPower}).setPower?.(power === "saver" ? {saver: true, thermal: "nominal"} : power === "serious" || power === "critical" ? {saver: false, thermal: power} : {saver: false, thermal: "nominal"});
        const debug = (window as unknown as {__arkDebug?: {scene: Scene}}).__arkDebug;
        const samples: Sample[] = [];
        let inView = 0;
        const until = performance.now() + seconds * 1000;
        while (performance.now() < until) {
            await new Promise((resolve) => setTimeout(resolve, 250));
            const stats = handle.stats();
            const memory = debug ? sceneMemory(debug.scene) : {geometryBytes: 0, textureBytes: 0};
            const loading = handle.loading();
            const t = performance.now() - t0;
            samples.push({t: Math.round(t), models: stats.modelsLoaded, drawCalls: stats.drawCalls, triangles: stats.triangles, loading, tier: stats.tier, geometryMB: round(memory.geometryBytes / 2 ** 20), textureMB: round(memory.textureBytes / 2 ** 20)});
            // In view: past the opening flight (4.6 s), the first moment nothing more is loading.
            if (!inView && firstFrame && !loading && t > 5000) inView = t;
        }
        const stats = handle.stats();
        const memory = debug ? sceneMemory(debug.scene) : null;
        const heap = (performance as Performance & {memory?: {usedJSHeapSize: number}}).memory?.usedJSHeapSize ?? null;
        const runtime = (handle as unknown as {runtime?: () => unknown}).runtime?.() ?? null;
        window.__arkMeasure = {
            done: true,
            result: {
                scriptStart: round(t0),
                mountMs: round(mountMs),
                firstFrameMs: firstFrame ? round(firstFrame - t0) : null,
                firstFrameFromNavigation: firstFrame ? round(firstFrame) : null,
                inViewMs: inView ? round(inView) : null,
                stats,
                memory: memory ? {geometryMB: round(memory.geometryBytes / 2 ** 20), textureMB: round(memory.textureBytes / 2 ** 20), geometries: memory.geometries, textures: memory.textures, instances: memory.instances} : null,
                heapMB: heap === null ? null : round(heap / 2 ** 20),
                runtime,
                samples
            }
        };
    } catch (error) {
        window.__arkMeasure = {done: true, error: String((error as Error)?.stack ?? error)};
    }
})();
