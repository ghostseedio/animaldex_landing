#!/usr/bin/env node
/**
 * Packs the framework-free Ark scene (src/ark-scene, three.js included) into
 * one script for pages outside Next: `public/ark/ark-scene.js`, used by
 * `public/ark/embed.html` (the 3.3 apps' WebView). The /ark page imports the
 * module itself and doesn't need this.
 *
 *   node scripts/build-ark-bundle.mjs           minified
 *   node scripts/build-ark-bundle.mjs --dev     with a source map
 *
 * The output is built, not committed (.gitignore).
 */
import path from "node:path";
import {fileURLToPath} from "node:url";
import {build} from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dev = process.argv.includes("--dev");

const result = await build({
    entryPoints: [path.join(root, "src/ark-scene/embed-entry.ts")],
    outfile: path.join(root, "public/ark/ark-scene.js"),
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["es2020", "safari15"],
    minify: !dev,
    sourcemap: dev,
    tsconfig: path.join(root, "tsconfig.json"),
    define: {"process.env.NODE_ENV": JSON.stringify(dev ? "development" : "production")},
    legalComments: "none",
    metafile: true,
    logLevel: "warning"
});
const bytes = Object.values(result.metafile.outputs).reduce((sum, output) => sum + output.bytes, 0);
console.log(`public/ark/ark-scene.js: ${(bytes / 1024).toFixed(0)} KB`);
