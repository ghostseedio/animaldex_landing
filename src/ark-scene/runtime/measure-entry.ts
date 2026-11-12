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

type Sample = {t: number; models: number; drawCalls: number; triangles: number; loading: boolean; tier: string; geometryMB: number; textureMB: number; modelTextureMB?: number; evicted?: number; mode?: string; heapMB?: number | null; chunksIn?: number; haze?: number; frameMs?: number; skipped?: number; markers?: number};

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
    // Part B: `?render=<m>` / `?renderScale=<share>` set the render distance (streaming/tiers.ts), to measure what a
    // smaller one saves (as a bigger island would need); `?mem=<GB>` is the app's memory figure (the tier).
    const render = Number(params.get("render"));
    if (render > 0) (globalThis as {__arkRenderDistance?: number}).__arkRenderDistance = render;
    const renderScale = Number(params.get("renderScale"));
    if (renderScale > 0) (globalThis as {__arkRenderScale?: number}).__arkRenderScale = renderScale;
    const memoryGB = Number(params.get("mem")) || null;
    // `?report=<url>`: post the result there when done (a WebView in the iOS Simulator or an Android emulator, where
    // no driver reads the page).
    const report = params.get("report");
    // `?tour=1`: after the opening, the camera goes down close in each region in turn and back to the island view.
    const tour = params.get("tour") === "1";
    // `?focus=<region>`: after the opening, the camera goes down to that region once and stays (a fixed ground view).
    const focus = params.get("focus");
    // `?walk=1`: after the opening, the camera visits the zones in turn (as a reader would), so near levels come and go.
    const walk = params.get("walk") === "1";
    try {
        // `?population=<file>`: a scale snapshot (scripts/ark-scale-fixture.mts) instead of the fixture.
        const population = params.get("population");
        const decoded = decodeArkSnapshot(population ? await (await fetch(population)).json() : fixture);
        if (!decoded) throw new Error("fixture did not decode");
        let snapshot = decoded;
        // `?islands=1` (decision 141): both islands in one world, mounted as the archipelago mounts them. A snapshot from
        // before the island column: the kept animals (house, farm, zoo) live on the town, as `arkIslandOf` reads them.
        const islands = params.get("islands") === "1";
        let islandOptions: Record<string, unknown> = {};
        let prebuildSnapshot = snapshot;
        if (islands) {
            const kept = new Set(["house", "farm", "zoo"]);
            snapshot = {...snapshot, animals: snapshot.animals.map((animal) => {
                const own = animal as typeof animal & {island?: string | null; area?: string | null};
                return {...animal, island: own.island ?? (own.area && kept.has(own.area) ? "town" : "wild")} as typeof animal;
            })};
            const [{arkIslandSnapshot}, {loadTownScene}] = await Promise.all([import("@/lib/ark-islands"), import("@/ark-scene/islands/scene")]);
            const split = arkIslandSnapshot as unknown as (s: typeof snapshot, island: "wild" | "town") => typeof snapshot;
            const townTier = quality === "high" || quality === "medium" || quality === "low" ? quality : "medium";
            const town = await (loadTownScene as unknown as (o: {tier: string; animals: unknown[]}) => Promise<unknown>)({tier: townTier, animals: split(snapshot, "town").animals});
            const wild = split(snapshot, "wild");
            prebuildSnapshot = wild;
            islandOptions = {island: town, wildAnimals: wild.animals, openIsland: "wild"};
        }
        // `?pan=town`: after the opening, the camera flies to the town (and stays).
        const pan = params.get("pan");
        // `?prebuild=1`: the mount's heavy work in the prebuild worker first (runtime/prebuild.ts).
        let prepared: ArkPrepared | null = null;
        if (params.get("prebuild") === "1") prepared = await prepareArk({snapshot: prebuildSnapshot, workerUrl: "./ark-prebuild-worker.js", placesWorkerUrl: "./ark-prebuild-places-worker.js"});
        const el = document.getElementById("ark") as HTMLElement;
        let firstFrame = 0;
        const mountStart = performance.now();
        const handle = mountArk(el, {
            snapshot,
            // `?models=<base>`: the model files from elsewhere (the measure script's simulated cached CDN).
            modelBase: params.get("models") ?? MODELS,
            deviceMemoryGB: memoryGB,
            // `?hour=<0-24>`: the island's hour pinned (a still by daylight).
            ...(params.get("hour") !== null && Number.isFinite(Number(params.get("hour"))) ? {hours: Number(params.get("hour"))} : {}),
            ...islandOptions,
            iconUrl: (slug) => ICONS + encodeURIComponent(slug) + ".webp",
            onReady: () => {
                firstFrame = performance.now();
                // In an app's WebView (the iOS app's panel, measured in the Simulator): tell the host it is up, as the
                // embed does, so the app shows the web view rather than its fallback.
                const host = window as unknown as {webkit?: {messageHandlers?: {ark?: {postMessage: (m: unknown) => void}}}; AndroidArk?: {postMessage: (m: string) => void}};
                if (host.webkit?.messageHandlers?.ark) host.webkit.messageHandlers.ark.postMessage({type: "ark:ready"});
                else host.AndroidArk?.postMessage(JSON.stringify({type: "ark:ready"}));
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
        let quiet = 0;
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
        const visits = Array.from(bySpecies.values());
        let nextVisit = performance.now() + 6000;
        let visit = 0;
        const regions = ["home", "forest", "open_land", "high_cold", "fresh_water", "coast", "ocean", null] as const;
        let nextRegion = performance.now() + 8000;
        let region = 0;
        let peakHeap = 0;
        let inViewRequests: number | null = null;
        let peakGpu = 0;
        while (performance.now() < until) {
            await new Promise((resolve) => setTimeout(resolve, 250));
            if (walk && performance.now() > nextVisit) {
                nextVisit = performance.now() + 3000;
                handle.select(visits[visit++ % visits.length]);
            }
            const stats = handle.stats();
            if (pan && performance.now() > nextRegion && region === 0) {
                region = 1;
                (handle as unknown as {flyToIsland?: (island: string) => void}).flyToIsland?.(pan);
            }
            if (focus && performance.now() > nextRegion && region === 0) {
                region = 1;
                (handle as unknown as {focusRegion?: (region: string | null) => void}).focusRegion?.(focus);
            }
            if (tour && performance.now() > nextRegion) {
                nextRegion = performance.now() + 4000;
                (handle as unknown as {focusRegion?: (region: string | null) => void}).focusRegion?.(regions[region++ % regions.length]);
            }
            const memory = debug ? sceneMemory(debug.scene) : {geometryBytes: 0, textureBytes: 0};
            const heapNow = (performance as Performance & {memory?: {usedJSHeapSize: number}}).memory?.usedJSHeapSize ?? null;
            if (heapNow !== null) peakHeap = Math.max(peakHeap, heapNow);
            peakGpu = Math.max(peakGpu, memory.geometryBytes + memory.textureBytes);
            const loading = handle.loading();
            const t = performance.now() - t0;
            const run = (handle as unknown as {runtime?: () => {modelTextureMB: number; evicted: number; mode: string}}).runtime?.();
            samples.push({t: Math.round(t), models: stats.modelsLoaded, drawCalls: stats.drawCalls, triangles: stats.triangles, loading, tier: stats.tier, geometryMB: round(memory.geometryBytes / 2 ** 20), textureMB: round(memory.textureBytes / 2 ** 20), modelTextureMB: run?.modelTextureMB, evicted: run?.evicted, mode: run?.mode, heapMB: heapNow === null ? null : round(heapNow / 2 ** 20), chunksIn: stats.streaming?.chunks.in, haze: stats.streaming?.haze, frameMs: stats.frameMs, skipped: stats.streaming?.animalsSkipped, markers: stats.streaming?.mapMarkers});
            // In view: past the opening flight (4.6 s), the first moment nothing more is loading.
            // In view: past the opening flight (4.6 s), the first moment every model the view draws is in (the runtime's
            // own test); the old test (nothing at all loading) as `quietMs`.
            const complete = (handle as unknown as {runtime?: () => {viewComplete?: boolean}}).runtime?.().viewComplete;
            if (!inView && firstFrame && t > 5000 && (complete ?? !loading)) {
                inView = t;
                inViewRequests = (window as unknown as {__arkDebug?: {library?: {requests: number}}}).__arkDebug?.library?.requests ?? null;
            }
            if (!quiet && firstFrame && !loading && t > 5000) quiet = t;
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
                quietMs: quiet ? round(quiet) : null,
                frameRate,
                stats,
                memory: memory ? {geometryMB: round(memory.geometryBytes / 2 ** 20), textureMB: round(memory.textureBytes / 2 ** 20), geometries: memory.geometries, textures: memory.textures, instances: memory.instances} : null,
                heapMB: heap === null ? null : round(heap / 2 ** 20),
                peakHeapMB: peakHeap ? round(peakHeap / 2 ** 20) : null,
                peakGpuMB: round(peakGpu / 2 ** 20),
                heapLimitMB: (() => {
                    const limit = (performance as Performance & {memory?: {jsHeapSizeLimit?: number}}).memory?.jsHeapSizeLimit;
                    return typeof limit === "number" ? round(limit / 2 ** 20) : null;
                })(),
                deviceMemoryGB: (navigator as Navigator & {deviceMemory?: number}).deviceMemory ?? null,
                cores: navigator.hardwareConcurrency ?? null,
                inViewRequests,
                streaming: stats.streaming ?? null,
                library: (() => {
                    const library = (window as unknown as {__arkDebug?: {library?: {requests: number; packHits: number; fileHits: number; farOrder: string[]}}}).__arkDebug?.library;
                    return library ? {requests: library.requests, packHits: library.packHits, fileHits: library.fileHits, farOrder: library.farOrder.slice(0, 400)} : null;
                })(),
                userAgent: navigator.userAgent,
                viewport: {width: innerWidth, height: innerHeight, dpr: devicePixelRatio},
                runtime,
                prepared,
                animals: snapshot.animals.length,
                samples
            }
        };
    } catch (error) {
        window.__arkMeasure = {done: true, error: String((error as Error)?.stack ?? error)};
    }
    if (report) {
        const label = params.get("label") ?? "";
        await fetch(report, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({label, ...window.__arkMeasure})}).catch(() => undefined);
        document.title = "ark-measure-done";
    }
})();
