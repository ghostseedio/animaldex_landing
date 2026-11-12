#!/usr/bin/env -S npx tsx
/**
 * The collision audit (motion pass L5): a snapshot's animals laid out and scheduled as the scene does
 * (`src/lib/ark-collide/sim.ts`), run over many hours of the shared clock, every pose measured against the world's
 * solid things and each other (`src/lib/ark-collide/metrics.ts`): pass-throughs, fence crossings and overlaps.
 *
 *   nice -n 10 npx tsx scripts/ark-collide-audit.mts --snapshot <snapshot.json> --hours 24 --step 1 --workers 6 \
 *       --label after --out <dir> [--mode raw|planned|final]
 *   raw: the schedule and the hamlet's straight door walks, as drawn before the collisions; planned: this tree's paths
 *   and routed door walks; final (default): and the collisions' layer on top (collide/resolve.ts), as the scene draws.
 *
 * `--wild-island <islands-routing.json | kept>`: islands mode (decision 148, `src/ark-scene/no-hamlet.ts`): the wild island
 * without its hamlet, and only its animals (by the routing's ids, or "kept": all but the house, farm and zoo animals).
 *
 * `--fixture` instead of `--snapshot`: the synthetic Ark (every species and a full hamlet: src/lib/ark-collide/fixture.ts),
 * what CI runs (.github/workflows/ark-collisions.yml, against tests/ark-collide/thresholds.json).
 *
 * The real snapshot is read in place (never copied); the report names species, never people. Local only.
 */

import {isMainThread, parentPort, Worker, workerData} from "node:worker_threads";
import {mkdirSync, readFileSync, writeFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

type Job = {snapshot: string; from: number; seconds: number; step: number; mode: string; models: string | null; wild?: string | null};

async function runJob(job: Job) {
    // Islands mode (`--wild-island`, decision 148): the wild island without its hamlet, set before anything is built.
    if (job.wild) (await import("@/ark-scene/no-hamlet")).setNoHamlet(true);
    const {decodeArkSnapshot} = await import("@/ark-scene/snapshot");
    const {buildSim} = await import("@/lib/ark-collide/sim");
    const metrics = await import("@/lib/ark-collide/metrics");
    const {loadSceneData} = await import("@/lib/ark-audit/scene-data");
    const collide = await import("@/ark-scene/collide/colliders");
    // (`--fixture`: the synthetic Ark of every species and a full hamlet, src/lib/ark-collide/fixture.ts: CI's.)
    const snapshot = job.snapshot === "fixture"
        ? {animals: (await import("@/lib/ark-collide/fixture")).collideFixture(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")), ark_day: null}
        : decodeArkSnapshot(JSON.parse(readFileSync(job.snapshot, "utf8")))!;
    if (job.wild) {
        // Only the wild island's animals: the routing's (T1's islands-routing.json, merged by id in memory), or with
        // "kept" every animal not kept in a house, on a farm or in a zoo (the fixture's hamlet residents live in the town).
        const routing = job.wild === "kept" ? null : new Map((JSON.parse(readFileSync(job.wild, "utf8")) as {animals: Array<{id: string; island: string}>}).animals.map((row) => [row.id, row.island]));
        snapshot.animals = snapshot.animals.filter((a) => (routing ? routing.get(a.id) === "wild" : a.area !== "house" && a.area !== "farm" && a.area !== "zoo"));
    }
    const data = job.models ? loadSceneData(job.models, Array.from(new Set(snapshot.animals.map((a) => a.model_slug)))) : null;
    const sim = buildSim(snapshot.animals, {planOf: (slug) => data?.modelPlan.get(slug) ?? null, arkDay: snapshot.ark_day ?? null});
    const {hamletPlotsFor} = await import("@/ark-scene/map/hamlet");
    const set = collide.colliderSetFor(hamletPlotsFor(snapshot.animals));
    // raw: the schedule and the hamlet as they were drawn; planned: with the routed door walks (the paths are this
    // tree's own); final: and the collisions' layer on top (collide/resolve.ts), as the scene now draws them.
    const m = metrics as Record<string, unknown>;
    const posesAt = job.mode === "final" && m.resolvedPosesAt ? (m.resolvedPosesAt as (a: unknown, b: unknown) => import("@/lib/ark-collide/metrics").PosesAt)(sim, set) : m.rawPosesAt ? (m.rawPosesAt as (a: unknown, b: boolean) => import("@/lib/ark-collide/metrics").PosesAt)(sim, job.mode === "planned") : null;
    return metrics.measureCollisions(sim, set, posesAt!, {from: job.from, seconds: job.seconds, step: job.step});
}

if (!isMainThread) {
    const report = await runJob((workerData as {job: Job}).job);
    parentPort!.postMessage(report);
} else if (process.argv.includes("--check")) {
    // CI: an audit's numbers against the thresholds (tests/ark-collide/thresholds.json): at most these.
    const args = process.argv.slice(2);
    const report = JSON.parse(readFileSync(args[args.indexOf("--check") + 1], "utf8"));
    const limits = JSON.parse(readFileSync(args[args.indexOf("--thresholds") + 1], "utf8")) as Record<string, number>;
    const got: Record<string, number> = {passThrough: report.passThrough.samples, fenceCrossings: report.fenceCrossings.count, cliffs: report.cliffs?.samples ?? 0, overlaps: report.overlaps.samples};
    const lines = ["| Check | Now | At most |", "|---|---:|---:|"];
    let failed = false;
    for (const [name, most] of Object.entries(limits)) {
        if (typeof most !== "number") continue;
        const now = got[name];
        const bad = now === undefined || now > most;
        failed ||= bad;
        lines.push(`| ${name} | ${now ?? "missing"} | ${most}${bad ? " FAIL" : ""} |`);
    }
    console.log(lines.join("\n"));
    if (failed) {
        console.log("\nWorst pass-throughs:", JSON.stringify(report.passThrough.worst?.slice(0, 5)), "\nFence crossings:", JSON.stringify(report.fenceCrossings.examples?.slice(0, 5)));
        process.exit(1);
    }
} else {
    const args = process.argv.slice(2);
    const opt = (name: string, fallback?: string) => {
        const i = args.indexOf(`--${name}`);
        return i >= 0 ? args[i + 1] : fallback;
    };
    const snapshot = args.includes("--fixture") ? "fixture" : path.resolve(opt("snapshot")!);
    const hours = Number(opt("hours", "4"));
    const step = Number(opt("step", "1"));
    const workers = Number(opt("workers", "4"));
    const label = opt("label", "run")!;
    const out = path.resolve(opt("out", "ark-collide-out")!);
    const mode = opt("mode", "final")!;
    const models = opt("models", path.join(process.env.HOME ?? "", "animaldex-talking-models"))!;
    // `--wild-island <islands-routing.json | kept>`: islands mode (no-hamlet.ts), the wild island's animals only.
    const wild = opt("wild-island") ?? null;
    const start = Number(opt("from", String(Math.floor(Date.UTC(2026, 10, 12, 0, 0, 0) / 1000))));
    mkdirSync(out, {recursive: true});
    const total = hours * 3600;
    const per = Math.ceil(total / workers / 60) * 60;
    const jobs: Job[] = [];
    for (let k = 0; k * per < total; k++) jobs.push({snapshot, from: start + k * per, seconds: Math.min(per, total - k * per), step, mode, models: models === "none" ? null : models, wild: wild && wild !== "kept" ? path.resolve(wild) : wild});
    const self = fileURLToPath(import.meta.url);
    const started = Date.now();
    const results = await Promise.all(jobs.map((job) => new Promise<import("@/lib/ark-collide/metrics").CollideReport>((resolve, reject) => {
        const worker = new Worker(new URL("./ark-collide-audit-worker.mjs", import.meta.url), {workerData: {entry: import.meta.url, tsconfig: path.join(path.dirname(self), "..", "tsconfig.json"), job}});
        worker.once("message", resolve);
        worker.once("error", reject);
    })));
    const merge = (maps: Array<Record<string, number>>) => {
        const o: Record<string, number> = {};
        for (const m of maps) for (const [k, v] of Object.entries(m)) o[k] = (o[k] ?? 0) + v;
        return Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1]));
    };
    const sum = (f: (r: import("@/lib/ark-collide/metrics").CollideReport) => number) => results.reduce((s, r) => s + f(r), 0);
    const strip = <T extends {id?: string}>(list: T[]) => list.map(({id: _id, ...rest}) => rest);
    const report = {
        label,
        hours,
        step,
        mode,
        animals: results[0]?.animals ?? 0,
        measured: Math.max(...results.map((r) => r.measured)),
        samples: sum((r) => r.samples),
        passThrough: {
            // (Distinct animals per window, summed over windows: an upper bound on distinct animals.)
            animalWindows: sum((r) => r.passThrough.animals),
            samples: sum((r) => r.passThrough.samples),
            byKind: merge(results.map((r) => r.passThrough.byKind)),
            bySource: merge(results.map((r) => r.passThrough.bySource)),
            byKindSource: merge(results.map((r) => r.passThrough.byKindSource ?? {})),
            bySlug: merge(results.map((r) => r.passThrough.bySlug ?? {})),
            worst: strip(results.flatMap((r) => r.passThrough.worst).sort((a, b) => b.depth - a.depth).slice(0, 40))
        },
        cliffs: {animalWindows: sum((r) => r.cliffs?.animals ?? 0), samples: sum((r) => r.cliffs?.samples ?? 0), bySource: merge(results.map((r) => r.cliffs?.bySource ?? {})), examples: strip(results.flatMap((r) => r.cliffs?.examples ?? []).slice(0, 20))},
        fenceCrossings: {animalWindows: sum((r) => r.fenceCrossings.animals), count: sum((r) => r.fenceCrossings.count), bySource: merge(results.map((r) => r.fenceCrossings.bySource)), examples: strip(results.flatMap((r) => r.fenceCrossings.examples).slice(0, 20))},
        overlaps: {pairWindows: sum((r) => r.overlaps.pairs), samples: sum((r) => r.overlaps.samples), bySource: merge(results.map((r) => r.overlaps.bySource)), examples: results.flatMap((r) => r.overlaps.examples).slice(0, 30)},
        wallSeconds: Math.round((Date.now() - started) / 1000),
        workerMs: results.map((r) => r.ms)
    };
    writeFileSync(path.join(out, `${label}.json`), JSON.stringify(report, null, 1));
    console.log(JSON.stringify({label, animals: report.animals, measured: report.measured, samples: report.samples, passThrough: {samples: report.passThrough.samples, animalWindows: report.passThrough.animalWindows, byKind: report.passThrough.byKind}, fenceCrossings: report.fenceCrossings.count, cliffs: report.cliffs.samples, overlaps: {samples: report.overlaps.samples, pairWindows: report.overlaps.pairWindows}, wallSeconds: report.wallSeconds}, null, 1));
}
