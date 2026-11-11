/**
 * The runtime lane's measurement page (development only: scripts/ark-runtime-measure.mjs builds it into
 * `.ark-golden/runtime/` and serves it; nothing deploys it). The live scene on the v2 fixture, mounted as the /ark
 * page mounts it (the opening flight, the device's own tier), timed from the script's first line:
 *
 *   - mount: how long `mountArk` held the main thread;
 *   - first frame: when the scene said it drew (`onReady`);
 *   - in view: when the models asked for by then were all in (the first time `loading()` went quiet after the
 *     opening), and every 250 ms the models loaded, draw calls and the scene's memory estimate;
 *   - memory: the JS heap and the scene's GPU estimate (geometry and texture bytes, `runtime/memory.ts`);
 *   - frames: the frame intervals once it is in view (requestAnimationFrame), as p50, p95 and frames a second.
 *
 * The long tasks are read by the driver (a PerformanceObserver installed before this script runs).
 */

import {decodeArkSnapshot, mountArk} from "@/ark-scene";
import fixture from "@/ark-scene/fixtures/snapshot-v2.json";
import {sceneMemory} from "@/ark-scene/runtime/memory";
import {prepareArk, type ArkPrepared} from "@/ark-scene/runtime/prebuild";
import type {Scene} from "three";

const MODELS = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/talking-models/v1/ark";
const ICONS = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/";

type Sample = {t: number; models: number; drawCalls: number; triangles: number; loading: boolean; tier: string; geometryMB: number; textureMB: number; modelTextureMB?: number; evicted?: number; mode?: string};

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
    // `?budget=<MB>`: a small skin ceiling, to watch the near levels being let go (runtime/budgets.ts).
    const budget = Number(params.get("budget"));
    if (budget > 0) (globalThis as {__arkBudgetMB?: number}).__arkBudgetMB = budget;
    // `?walk=1`: after the opening, the camera visits the zones in turn (as a reader would), so near levels come and go.
    const walk = params.get("walk") === "1";
    try {
        // `?population=<file>`: a scale snapshot (scripts/ark-scale-fixture.mts) instead of the fixture.
        const population = params.get("population");
        const snapshot = decodeArkSnapshot(population ? await (await fetch(population)).json() : fixture);
        if (!snapshot) throw new Error("fixture did not decode");
        // `?prebuild=1`: the mount's heavy work in the prebuild worker first (runtime/prebuild.ts).
        let prepared: ArkPrepared | null = null;
        if (params.get("prebuild") === "1") prepared = await prepareArk({snapshot, workerUrl: "./ark-prebuild-worker.js", placesWorkerUrl: "./ark-prebuild-places-worker.js"});
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
        // For the probes (scratch scripts drive the handle: visibility, power).
        (window as unknown as {__arkMeasureHandle?: unknown}).__arkMeasureHandle = handle;
        // The Mac running the harness is busy with other work: its CPU pressure is not the phone's. Power as a calm
        // device unless the page asks (`?power=saver|serious|critical`).
        const power = params.get("power");
        // (Optional: the same page measures a build from before the runtime, which has no setPower.)
        (handle as {setPower?: typeof handle.setPower}).setPower?.(power === "saver" ? {saver: true, thermal: "nominal"} : power === "serious" || power === "critical" ? {saver: false, thermal: power} : {saver: false, thermal: "nominal"});
        const debug = (window as unknown as {__arkDebug?: {scene: Scene}}).__arkDebug;
        const samples: Sample[] = [];
        let inView = 0;
        // Every frame's interval, with when it ended (from the script's first line), for the steady rate once in view.
        const frames: Array<[number, number]> = [];
        let frameLast = 0;
        let framing = true;
        const onFrame = (now: number) => {
            if (frameLast) frames.push([now - t0, now - frameLast]);
            frameLast = now;
            if (framing) requestAnimationFrame(onFrame);
        };
        requestAnimationFrame(onFrame);
        const until = performance.now() + seconds * 1000;
        // The walk: animal after animal (one species each), flown to close up, so near levels come in and are let go.
        const bySpecies = new Map<string, string>();
        for (const animal of [...snapshot.animals].sort((x, y) => x.id.localeCompare(y.id))) if (!bySpecies.has(animal.model_slug)) bySpecies.set(animal.model_slug, animal.id);
        const tour = Array.from(bySpecies.values());
        let nextVisit = performance.now() + 6000;
        let visit = 0;
        while (performance.now() < until) {
            await new Promise((resolve) => setTimeout(resolve, 250));
            if (walk && performance.now() > nextVisit) {
                nextVisit = performance.now() + 3000;
                handle.select(tour[visit++ % tour.length]);
            }
            const stats = handle.stats();
            const memory = debug ? sceneMemory(debug.scene) : {geometryBytes: 0, textureBytes: 0};
            const loading = handle.loading();
            const t = performance.now() - t0;
            const run = (handle as unknown as {runtime?: () => {modelTextureMB: number; evicted: number; mode: string}}).runtime?.();
            samples.push({t: Math.round(t), models: stats.modelsLoaded, drawCalls: stats.drawCalls, triangles: stats.triangles, loading, tier: stats.tier, geometryMB: round(memory.geometryBytes / 2 ** 20), textureMB: round(memory.textureBytes / 2 ** 20), modelTextureMB: run?.modelTextureMB, evicted: run?.evicted, mode: run?.mode});
            // In view: past the opening flight (4.6 s), the first moment nothing more is loading.
            if (!inView && firstFrame && !loading && t > 5000) inView = t;
        }
        framing = false;
        // In view (else past the opening's 8 s): the intervals from then on.
        const steady = frames.filter(([at]) => at > (inView || 8000)).map(([, ms]) => ms).sort((a, b) => a - b);
        const at = (q: number) => (steady.length ? round(steady[Math.min(steady.length - 1, Math.floor(q * steady.length))]) : null);
        const frameRate = steady.length ? {p50Ms: at(0.5), p95Ms: at(0.95), fps: round(1000 / (steady.reduce((sum, ms) => sum + ms, 0) / steady.length)), frames: steady.length, over50Ms: steady.filter((ms) => ms > 50).length} : null;
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
                frameRate,
                stats,
                memory: memory ? {geometryMB: round(memory.geometryBytes / 2 ** 20), textureMB: round(memory.textureBytes / 2 ** 20), geometries: memory.geometries, textures: memory.textures, instances: memory.instances} : null,
                heapMB: heap === null ? null : round(heap / 2 ** 20),
                runtime,
                prepared,
                animals: snapshot.animals.length,
                samples
            }
        };
    } catch (error) {
        window.__arkMeasure = {done: true, error: String((error as Error)?.stack ?? error)};
    }
})();
