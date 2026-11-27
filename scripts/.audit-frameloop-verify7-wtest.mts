// @ts-nocheck
/** PERF-WEB audit (FRAME-7 verifier): does tsx run a worker_thread with the @/ aliases? Untracked helper. */
import {Worker, isMainThread, parentPort} from "node:worker_threads";
import {createRequire} from "node:module";
const req = createRequire(import.meta.url);
if (isMainThread) {
    const boot = `const {register: rc} = require(${JSON.stringify(req.resolve("tsx/cjs/api"))}); rc(); import(${JSON.stringify("file://" + req.resolve("tsx/esm/api").replace(/index\.cjs$/, "index.mjs"))}).then(({register}) => { register(); return import(${JSON.stringify(import.meta.url)}); });`;
    const w = new Worker(boot, {eval: true});
    w.on("message", (m) => { console.log("worker says", JSON.stringify(m)); process.exit(0); });
    w.on("error", (e) => { console.log("worker error", String(e)); process.exit(1); });
} else {
    const world = req("@/ark-scene/world");
    world.setArkWorld("v2");
    parentPort.postMessage({half: world.TERRAIN_HALF, world: world.arkWorld()});
}
