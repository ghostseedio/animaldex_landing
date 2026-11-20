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
import {copyFileSync, readFileSync, statSync, writeFileSync} from "node:fs";
import {createRequire} from "node:module";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {build, transform} from "esbuild";

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
    {entry: "islands/town/prebuild-worker.ts", out: "ark-town-worker.js"},
    // The apps' panel and card (lane ARK-SIMPLE): /ark's own components, loaded by embed.html once the world is up.
    {entry: "embed-ui/embed-ui-entry.tsx", out: "ark-ui.js", ui: true}
];

// The UI bundle's Next pieces, without Next: the site's Link as a plain anchor the host can take, and next/navigation's hooks.
const embedShims = {
    name: "ark-embed-shims",
    setup(pluginBuild) {
        pluginBuild.onResolve({filter: /^@\/app\/\[locale\]\/_components\/link$/}, () => ({path: path.join(root, "src/ark-scene/embed-ui/link-shim.tsx")}));
        pluginBuild.onResolve({filter: /^next\/navigation$/}, () => ({path: path.join(root, "src/ark-scene/embed-ui/navigation-shim.ts")}));
    }
};

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
        define: {
            "process.env.NODE_ENV": JSON.stringify(dev ? "development" : "production"),
            "process.env.NEXT_PUBLIC_ARK_CODE_V": JSON.stringify(version),
            // (The UI bundle's site helpers: a Supabase URL Next would inline; unset, they use their own public default.)
            ...(bundle.ui ? {"process.env.NEXT_PUBLIC_SUPABASE_URL": "undefined", "process.env.SUPABASE_URL": "undefined"} : {})
        },
        legalComments: "none",
        jsx: "automatic",
        plugins: bundle.ui ? [embedShims] : [],
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
// The UI bundle's styles: Tailwind over exactly the files packed into it (as raw text: their paths, `[locale]` and
// `(composited)`, are glob syntax to Tailwind) (no preflight: the embed's own page keeps its
// look; a reset scoped to the UI's layer instead), with the site's theme colours and the Ark's glass and ticker rules.
{
    const ui = bundles.findIndex((bundle) => bundle.ui);
    const files = Object.keys(results[ui].metafile.inputs).filter((file) => /\.(tsx|ts|jsx|js)$/.test(file) && !file.includes("node_modules")).map((file) => path.join(root, file));
    const globals = readFileSync(path.join(root, "src/app/[locale]/_assets/globals.css"), "utf8");
    const theme = globals.slice(globals.indexOf(":root,\n.theme-dark {"), globals.indexOf("}", globals.indexOf(":root,\n.theme-dark {")) + 1);
    const arkRules = globals.slice(globals.indexOf("@keyframes rowsIn"), globals.indexOf("/* The Ark's loading screen"));
    if (!theme.includes("--c-canvas-950") || !arkRules.includes(".ark-ticker-track")) throw new Error("globals.css: the theme or the Ark's rules moved");
    const input = `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n${theme}\n:root { --ease-spring: cubic-bezier(.2, .8, .2, 1); }\n${arkRules}\n` +
        ":where(#ark-ui) *, :where(#ark-ui) ::before, :where(#ark-ui) ::after { box-sizing: border-box; border: 0 solid; margin: 0; padding: 0; }\n" +
        ":where(#ark-ui) button { background: transparent; color: inherit; font: inherit; cursor: pointer; -webkit-appearance: none; appearance: none; }\n" +
        ":where(#ark-ui) a { color: inherit; text-decoration: inherit; }\n:where(#ark-ui) ul, :where(#ark-ui) ol { list-style: none; }\n" +
        ":where(#ark-ui) img, :where(#ark-ui) svg { display: block; vertical-align: middle; } :where(#ark-ui) img { max-width: 100%; height: auto; }\n" +
        ":where(#ark-ui) h1, :where(#ark-ui) h2, :where(#ark-ui) h3, :where(#ark-ui) p { font-size: inherit; font-weight: inherit; }\n" +
        ":where(#ark-ui) [hidden] { display: none; }\n";
    const require = createRequire(import.meta.url);
    const config = require(path.join(root, "tailwind.config.js"));
    const postcss = require("postcss");
    const tailwind = require("tailwindcss");
    const css = await postcss([tailwind({...config, content: files.map((file) => ({raw: readFileSync(file, "utf8"), extension: path.extname(file).slice(1)})), corePlugins: {...(config.corePlugins || {}), preflight: false}}), require("autoprefixer")]).process(input, {from: undefined});
    const out = minify ? (await transform(css.css, {loader: "css", minify: true})).code : css.css;
    writeFileSync(path.join(root, "public/ark/ark-ui.css"), out);
    console.log(`public/ark/ark-ui.css: ${(out.length / 1024).toFixed(0)} KB (${files.length} files)`);
}
// The version beside the bundles: next.config.js reads it and inlines it in the pages (`NEXT_PUBLIC_ARK_CODE_V`), so a page
// and the workers it asks for are one build's. (Built, not committed: .gitignore.)
writeFileSync(path.join(root, "public/ark/ark-version.txt"), `${version}\n`);
console.log(`public/ark/ark-version.txt: ${version}`);
// Encounter hunting's positions atlas (src/ark-scene/positions/atlas.json, pinned): a static file the scene reads only
// when the Ark hunts by encounter (`src/ark-scene/hunting.ts`), never in the bundle.
copyFileSync(path.join(root, "src/ark-scene/positions/atlas.json"), path.join(root, "public/ark/positions-atlas.json"));
console.log(`public/ark/positions-atlas.json: ${(statSync(path.join(root, "public/ark/positions-atlas.json")).size / 1024).toFixed(0)} KB`);
// The apps' Ark page (`embed.html`) loads its panel and card from these two (ARK-SIMPLE): built here, by `prebuild` (so
// `npm run build` and the Dockerfile's image both make them), never committed. A missing or empty one fails the build
// rather than shipping an app Ark with no panel or card.
for (const file of ["public/ark/ark-scene.js", "public/ark/ark-ui.js", "public/ark/ark-ui.css"]) {
    const size = (() => { try { return statSync(path.join(root, file)).size; } catch { return 0; } })();
    if (size < 4096) {
        console.error(`build-ark-bundle: ${file} is missing or empty (${size} bytes)`);
        process.exit(1);
    }
}
