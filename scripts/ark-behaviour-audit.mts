/**
 * The Ark behaviour audit (owner's 7 problems, docs/ark/behaviour-audit.md):
 * a synthetic Ark with every catalogue species, simulated headless over
 * several island days with the tree's own scene logic, measured.
 *
 * Run from the root of the tree to measure (its `@/` imports are its own):
 *
 *   npx tsx scripts/ark-behaviour-audit.mts --label release --out <dir>
 *   npx tsx <this>/scripts/ark-behaviour-audit.mts --label live \
 *       --profiles <ark-release>/data/ark/behaviour-profiles.json \
 *       --prey <ark-release>/data/ark/audit-predator-prey.json --out <dir>
 *   npx tsx scripts/ark-behaviour-audit.mts --compare <live.json> <release.json> --out <dir>
 *
 * Options: --days 3 (pass A length), --step 20 (pass A seconds), --flight-hours 12
 * (pass B, flyers every second from 06:00 of day 1), --order adjacent|shuffled,
 * --models <dir>|none (the local model + rig set, default ~/animaldex-talking-models),
 * --limit <n> (first n species, for a quick run), --workers 6 (threads simulating slices).
 *
 * Local only: no network, no keys. Writes <label>.json and <label>.md.
 */

import {execSync} from "node:child_process";
import {isMainThread, parentPort, Worker} from "node:worker_threads";
import {existsSync, mkdirSync, readFileSync, writeFileSync} from "node:fs";
import path from "node:path";
import {auditFixture, decodePreyTable, type AuditProfile} from "../src/lib/ark-audit/fixture";
import {AuditMeter, type AuditResult} from "../src/lib/ark-audit/metrics";
import {defaultModelsDir, loadSceneData} from "../src/lib/ark-audit/scene-data";
import {staticChecks} from "../src/lib/ark-audit/static-checks";
import {renderComparison, renderOne} from "../src/lib/ark-audit/report";
import type {AuditModel, AuditSample} from "../src/lib/ark-audit/types";
import {blankSample, packSample, unpackSample} from "../src/lib/ark-audit/codec";

const args = process.argv.slice(2);
const opt = (name: string, fallback?: string) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : fallback;
};
const out = path.resolve(opt("out", "ark-audit-out")!);
mkdirSync(out, {recursive: true});

if (args.includes("--compare")) {
    const i = args.indexOf("--compare");
    const before = JSON.parse(readFileSync(args[i + 1], "utf8")) as AuditResult & {static: unknown};
    const after = JSON.parse(readFileSync(args[i + 2], "utf8")) as AuditResult & {static: unknown};
    const md = renderComparison(before, after);
    writeFileSync(path.join(out, "compare.md"), md);
    console.log(md);
    process.exit(0);
}

const tree = process.cwd();
const label = opt("label", "tree")!;
const days = Number(opt("days", "3"));
const stepA = Number(opt("step", "20"));
const flightHours = Number(opt("flight-hours", "12"));
const order = (opt("order", "adjacent") as "adjacent" | "shuffled");
const limit = opt("limit") ? Number(opt("limit")) : null;
const profilesFile = path.resolve(opt("profiles", path.join(tree, "data/ark/behaviour-profiles.json"))!);
const preyFile = path.resolve(opt("prey", path.join(tree, "data/ark/audit-predator-prey.json"))!);
const modelsOpt = opt("models");
const modelsDir = modelsOpt === "none" ? null : modelsOpt ? path.resolve(modelsOpt) : defaultModelsDir();
const commit = (() => {
    try {
        return execSync("git rev-parse --short HEAD", {cwd: tree}).toString().trim();
    } catch {
        return "unknown";
    }
})();

const log = (...m: unknown[]) => (isMainThread ? console.error(`[audit ${label}]`, ...m) : undefined);
let profiles = (JSON.parse(readFileSync(profilesFile, "utf8")) as {profiles: AuditProfile[]}).profiles;
if (limit) profiles = profiles.filter((p) => !p.excluded).slice(0, limit);
const preyOf = decodePreyTable(JSON.parse(readFileSync(preyFile, "utf8")), (JSON.parse(readFileSync(profilesFile, "utf8")) as {profiles: AuditProfile[]}).profiles);
const fixture = auditFixture(profiles, preyOf, order);
const data = loadSceneData(modelsDir, [...fixture.profileOf.keys()]);
if (isMainThread) log(`tree ${tree} @ ${commit}; ${fixture.animals.length} animals, ${fixture.profileOf.size} species; models ${modelsDir ?? "none"}; rigs ${data.rigManifest ? Object.keys(data.rigManifest).length : 0}`);

const hasSchedule = existsSync(path.join(tree, "src/ark-scene/behaviour-schedule.ts"));
const makeModel = async (): Promise<AuditModel> => {
    const meta = {label, tree, commit};
    if (hasSchedule) return (await import("../src/lib/ark-audit/model-schedule")).scheduleModel(fixture, data, meta);
    return (await import("../src/lib/ark-audit/model-legacy")).legacyModel(fixture, data, meta);
};

// Island midnight, a few days after the fixture's arrivals.
const T0 = Date.UTC(2026, 10, 12) / 1000;
/** Steps per shared window. */
const WINDOW = 180;

type Job = {pass: "A" | "B"; indices: number[]; from: number; step: number; window: number; total: number; width: number; floats: SharedArrayBuffer; bytes: SharedArrayBuffer};

if (!isMainThread) {
    // A worker: simulate its slice of the animals, a window of steps at a time, into the shared arrays.
    const model = await makeModel();
    const port = parentPort!;
    port.on("message", (job: Job & {slot: number[]}) => {
        const floats = new Float32Array(job.floats);
        const bytes = new Uint8Array(job.bytes);
        const width = job.width;
        const begin = job.window * WINDOW;
        const end = Math.min(begin + WINDOW, job.total);
        for (let k = begin; k < end; k++) {
            const t = job.from + k * job.step;
            for (let m = 0; m < job.indices.length; m++) packSample(model.sample(job.indices[m], t, job.step), floats, bytes, (k - begin) * width + job.slot[m]);
        }
        port.postMessage("done");
    });
    port.postMessage("ready");
} else {
    const started = Date.now();
    const model = await makeModel();
    log(`model ${hasSchedule ? "schedule" : "legacy (live main rules)"} ready in ${Date.now() - started} ms`);
    const meter = new AuditMeter(model, preyOf);
    const n = model.subjects.length;
    const workers = Math.max(1, Math.min(Number(opt("workers", "6")), 16));

    const pool = await Promise.all(Array.from({length: workers}, () => new Promise<Worker>((resolve, reject) => {
        const w = new Worker(new URL("./ark-behaviour-audit-worker.mjs", import.meta.url), {workerData: {entry: import.meta.url, tsconfig: path.join(tree, "tsconfig.json")}, argv: process.argv.slice(2)});
        w.once("message", () => resolve(w));
        w.once("error", reject);
    })));
    log(`${workers} workers ready (${((Date.now() - started) / 1000).toFixed(0)} s)`);
    /** Runs a pass over `indices` (each step, every one of them), calling `observe` with the samples in that order. */
    const runPass = async (pass: "A" | "B", indices: number[], from: number, step: number, total: number, observe: (t: number, samples: AuditSample[]) => void) => {
        const width = indices.length;
        const floats = new SharedArrayBuffer(WINDOW * width * 4 * 4);
        const bytes = new SharedArrayBuffer(WINDOW * width * 4);
        const fa = new Float32Array(floats);
        const ba = new Uint8Array(bytes);
        const buffers = [indices.map(blankSample), indices.map(blankSample)];
        // A cluster (a leader and those who keep to it) stays in one worker: live main's followers read their leader's state.
        const idIndex = new Map(model.subjects.map((s, i) => [s.id, i]));
        const groupOf = (i: number) => (model.subjects[i].leader ? idIndex.get(model.subjects[i].leader!) ?? i : i);
        const slices = pool.map((_, w) => indices.map((index, slot) => ({index, slot})).filter((x) => groupOf(x.index) % workers === w));
        const windows = Math.ceil(total / WINDOW);
        let flip = 0;
        for (let win = 0; win < windows; win++) {
            await Promise.all(pool.map((w, k) => new Promise<void>((resolve, reject) => {
                w.once("error", reject);
                w.once("message", () => {
                    w.off("error", reject);
                    resolve();
                });
                w.postMessage({pass, indices: slices[k].map((x) => x.index), slot: slices[k].map((x) => x.slot), from, step, window: win, total, width, floats, bytes});
            })));
            const begin = win * WINDOW;
            const end = Math.min(begin + WINDOW, total);
            for (let k = begin; k < end; k++) {
                const into = buffers[(flip = 1 - flip)];
                for (let m = 0; m < width; m++) unpackSample(fa, ba, (k - begin) * width + m, into[m]);
                observe(from + k * step, into);
            }
            if (win % 10 === 0) log(`pass ${pass} ${((100 * end) / total).toFixed(0)}% (${((Date.now() - started) / 1000).toFixed(0)} s; main ms ${JSON.stringify(Object.fromEntries(Object.entries(meter.timing).map(([k, v]) => [k, Math.round(v)])))})`);
        }
    };

    const all = Array.from({length: n}, (_, i) => i);
    const stepsA = Math.round((days * 86400) / stepA);
    await runPass("A", all, T0, stepA, stepsA, (t, s) => meter.observeA(t, stepA, s));
    // Pass B: the flyers every second, from 06:00 of day 1.
    const flyers = meter.flyerIndices();
    const secondsB = Math.round(flightHours * 3600);
    log(`pass B: ${flyers.length} flyers`);
    if (flyers.length) await runPass("B", flyers, T0 + 6 * 3600, 1, secondsB, (_t, s) => meter.observeB(s));
    await Promise.all(pool.map((w) => w.terminate()));
    const result = {...meter.result({days, stepA, secondsB}), static: staticChecks(profiles, data, model.features), fixture: {order, profiles: path.basename(profilesFile), animals: n, species: fixture.profileOf.size, modelsDir: modelsDir ? "local model + rig set" : "none"}, seconds: Math.round((Date.now() - started) / 1000)};
    writeFileSync(path.join(out, `${label}.json`), JSON.stringify(result, null, 1));
    writeFileSync(path.join(out, `${label}.md`), renderOne(result));
    log(`done in ${result.seconds} s -> ${path.join(out, `${label}.json`)}`);
}
