// Bundle `ark-live` into one file for its container: node ark-live/build.mjs → ark-live/dist/server.mjs.
import {build} from "esbuild";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

await build({
    entryPoints: [join(here, "server.mts")],
    outfile: join(here, "dist", "server.mjs"),
    bundle: true,
    platform: "node",
    target: "node22",
    format: "esm",
    tsconfig: join(root, "tsconfig.json"),
    // The scene's data tables come in as JSON (about 1.5 MB); three.js is never pulled in by the room core.
    loader: {".json": "json"},
    banner: {js: "import {createRequire as __cr} from 'node:module'; const require = __cr(import.meta.url);"},
    minify: false,
    sourcemap: true,
    logLevel: "info"
});
