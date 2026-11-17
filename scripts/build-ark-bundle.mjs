#!/usr/bin/env node
/**
 * Packs the framework-free Ark scene (src/ark-scene, three.js included) into
 * one script for pages outside Next: `public/ark/ark-scene.js`, used by
 * `public/ark/embed.html` (the 3.3 apps' WebView). The /ark page imports the
 * module itself and doesn't need this, only the workers it packs too. Also writes the
 * code version (`public/ark/ark-version.txt`).
 *
 *   node scripts/build-ark-bundle.mjs           minified
 *   node scripts/build-ark-bundle.mjs --dev     with a source map
 *
 * The output is built, not committed (.gitignore).
 */
import {createHash} from "node:crypto";
import {copyFileSync, statSync, writeFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {build} from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dev = process.argv.includes("--dev");
// `--names`: a production build with its names kept (a readable CPU profile: scripts/ark-runtime-measure.mjs --profile).
const minify = !dev && !process.argv.includes("--names");

// The scene (embed-entry.ts: used by public/ark/embed.html) and the runtime's prebuild workers
// (src/ark-scene/runtime/prebuild.ts): the scenery (~20 KB) and a big Ark's places. Part C (decision 153): the town's
// prebuild worker (src/ark-scene/islands/town/prebuild.ts): its plan, ground, scenery, places, behaviour world and
// colliders, off the page's main thread.
const bundles = [
    {entry: "embed-entry.ts", out: "ark-scene.js", sourcemap: dev},
    {entry: "runtime/prebuild-worker.ts", out: "ark-prebuild-worker.js"},
    {entry: "runtime/prebuild-places-worker.ts", out: "ark-prebuild-places-worker.js"},
    {entry: "islands/town/prebuild-worker.ts", out: "ark-town-worker.js"}
];

/** One bundle, with the code version defined (`src/ark-scene/code-version.ts`: the `?v=` the scene puts on the scripts it asks for). */
function bundleOptions(bundle, version, write) {
    return {
        entryPoints: [path.join(root, "src/ark-scene", bundle.entry)],
        outfile: path.join(root, "public/ark", bundle.out),
        bundle: true,
        format: "iife",
        platform: "browser",
        target: ["es2020", "safari15"],
        minify,
        sourcemap: Boolean(bundle.sourcemap),
        tsconfig: path.join(root, "tsconfig.json"),
        define: {"process.env.NODE_ENV": JSON.stringify(dev ? "development" : "production"), "process.env.NEXT_PUBLIC_ARK_CODE_V": JSON.stringify(version)},
        legalComments: "none",
        metafile: true,
        write,
        logLevel: "warning"
    };
}

// The code version (src/ark-scene/code-version.ts): a hash of what the four bundles are before the version is written into them,
// so the same code is the same version on any machine and an unchanged worker keeps its address (and its cache) across deploys.
const first = await Promise.all(bundles.map((bundle) => build(bundleOptions(bundle, "", false))));
const hash = createHash("sha256");
first.forEach((result, i) => {
    const js = result.outputFiles.find((file) => file.path.endsWith(".js"));
    hash.update(`${bundles[i].out}\0`);
    hash.update(js.contents);
});
const version = hash.digest("hex").slice(0, 12);

const results = await Promise.all(bundles.map((bundle) => build(bundleOptions(bundle, version, true))));
results.forEach((result, i) => {
    const bytes = Object.values(result.metafile.outputs).reduce((sum, output) => sum + output.bytes, 0);
    console.log(`public/ark/${bundles[i].out}: ${(bytes / 1024).toFixed(0)} KB`);
});
// The version beside the bundles: next.config.js reads it and inlines it in the pages (`NEXT_PUBLIC_ARK_CODE_V`), so a page
// and the workers it asks for are one build's. (Built, not committed: .gitignore.)
writeFileSync(path.join(root, "public/ark/ark-version.txt"), `${version}\n`);
console.log(`public/ark/ark-version.txt: ${version}`);
// Encounter hunting's positions atlas (src/ark-scene/positions/atlas.json, pinned): a static file the scene reads only
// when the Ark hunts by encounter (`src/ark-scene/hunting.ts`), never in the bundle.
copyFileSync(path.join(root, "src/ark-scene/positions/atlas.json"), path.join(root, "public/ark/positions-atlas.json"));
console.log(`public/ark/positions-atlas.json: ${(statSync(path.join(root, "public/ark/positions-atlas.json")).size / 1024).toFixed(0)} KB`);
