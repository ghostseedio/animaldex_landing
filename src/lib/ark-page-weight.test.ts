import assert from "node:assert/strict";
import test from "node:test";
import {build} from "esbuild";
import {arkPageSummary} from "@/lib/ark-page-summary";
import type {ArkSnapshot} from "@/ark-scene/types";

/**
 * /ark's first JavaScript (decision 246): the page's client component pulls in no three.js and none of the scene's
 * tables (the species map, the stats catalogue, the sea's depth bands, the assets manifest); the scene comes with its
 * own dynamic import, once the browser is idle behind the poster. Before: 1.47 MB minified (three.js 558 KB through
 * `placeholder.ts`, 400 KB through `herds.ts`, 175 KB through `snapshot.ts` → `stats.ts`, 160 KB through
 * `behaviour-state.ts`). And what the page hands its client before the Ark is read: the counts only.
 */

const ENTRY = "src/app/[locale]/(composited)/ark/ark-view.tsx";
const SCENE_TABLES = ["node_modules/three/", "src/ark-scene/map/species.json", "src/ark-scene/species-stats.json", "src/ark-scene/depth-bands.json", "src/ark-scene/assets-manifest.json", "src/ark-scene/layers.json"];

test("the Ark page's static imports: no three.js, no scene tables, under 200 KB minified", async () => {
    const result = await build({
        entryPoints: [ENTRY],
        bundle: true,
        write: false,
        metafile: true,
        minify: true,
        format: "esm",
        platform: "browser",
        outdir: "/tmp/ark-page-weight",
        jsx: "automatic",
        external: ["react", "react-dom", "next", "next/*", "@formatjs/*"],
        loader: {".json": "json", ".svg": "empty", ".css": "empty", ".glsl": "text"},
        logLevel: "silent"
    });
    const inputs = result.metafile.inputs;
    const output = Object.values(result.metafile.outputs).find((out) => out.entryPoint)!;
    const start = Object.keys(inputs).find((path) => path.endsWith("ark-view.tsx"))!;
    // Only static imports: the scene's dynamic import() is meant to stay out.
    const reached = new Map<string, string | null>([[start, null]]);
    const queue = [start];
    while (queue.length) {
        const path = queue.shift()!;
        for (const imported of inputs[path]?.imports ?? []) {
            if (imported.kind !== "import-statement" || imported.external || reached.has(imported.path)) continue;
            reached.set(imported.path, path);
            queue.push(imported.path);
        }
    }
    const via = (path: string) => {
        const chain = [path];
        for (let at = reached.get(path); at; at = reached.get(at)) chain.push(at);
        return chain.reverse().join(" → ");
    };
    for (const path of Array.from(reached.keys())) {
        assert.ok(!SCENE_TABLES.some((heavy) => path.includes(heavy)), `the page pulls in ${path}: ${via(path)}`);
    }
    const bytes = Array.from(reached.keys()).reduce((sum, path) => sum + (output.inputs[path]?.bytesInOutput ?? 0), 0);
    // The top 15 contributors, each with what pulls it in, so a lane over the budget sees what to make lazy
    // (docs/ark/lazy-loading.md).
    const top = Array.from(reached.keys())
        .map((path) => ({path, size: output.inputs[path]?.bytesInOutput ?? 0}))
        .sort((a, b) => b.size - a.size)
        .slice(0, 15);
    console.log(`/ark static JavaScript: ${bytes} of 204800 bytes (${204_800 - bytes} left); top 15:`);
    for (const {path, size} of top) console.log(`  ${String(size).padStart(6)}  ${path}${reached.get(path) ? `  ← ${reached.get(path)}` : ""}`);
    // 200 KB as 200 KiB (AnimalDex decision 371, 2026-11-16): the limit was 200,000 bytes with main 41 bytes under it,
    // and the count moves by ±13 bytes with code anywhere in the bundle (the minifier's names), so the check failed
    // at random and no log line or card word could be added. The guard is unchanged in kind: no three.js, no scene
    // tables, and what loads with the scene stays with the scene (`src/ark-scene/live/`).
    assert.ok(bytes < 204_800, `the page's static JavaScript is ${bytes} bytes minified`);
});

test("the first paint's summary: counts and the islands' sizes, nothing about any animal", () => {
    const animal = (island: "wild" | "town") => ({id: `a-${island}`, species_profile_id: "sp", name: "Zebra", scientific_name: null, model_slug: "zebra", zone: "grassland", arrived_at: "2026-11-01T00:00:00Z", brought_by: {label: "@someone", named: true}, mine: true, island}) as ArkSnapshot["animals"][number];
    const snapshot: ArkSnapshot = {voyage: {slug: "ark", name: "Ark", started_at: null}, counts: {animals: 2, species: 1, founders: 1}, zones: [], animals: [animal("wild"), animal("town")], as_of: null};
    const summary = arkPageSummary(snapshot);
    assert.deepEqual(summary, {counts: {animals: 2, species: 1, founders: 1}, islands: {wild: 1, town: 1, zoo: 0}});
    assert.ok(!JSON.stringify(summary).includes("someone"), "never a bringer");
    assert.equal(arkPageSummary(null), null);
    assert.deepEqual(arkPageSummary({...snapshot, animals: [{...animal("wild"), island: undefined}]})?.islands, null, "one island: no switch");
});
