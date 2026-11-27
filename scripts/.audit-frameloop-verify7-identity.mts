// @ts-nocheck
/**
 * PERF-WEB audit (FRAME-7 identity verifier). Untracked helper, writes nothing.
 *
 * The real snapshot's wild island (v2, islands mode), worked out twice: on this thread, then in a worker_thread (a fresh
 * isolate with fresh module state, as a browser worker is) whose answer comes back through postMessage (structured
 * clone; the typed arrays transferred, as a browser worker would send them). The worker works in another order (nests
 * before the behaviour world), so any cache one part warms for the other (attach points, groundUnder, lattices) is
 * warmed differently.
 *   - nest spots: props/nest-sites.ts nestSpots for every nest plan, in buildHomesSteps' order, the radius as it works it
 *     out, one shared `used` set (and what each plan added to it);
 *   - the behaviour world's walk-grid cells: world-sampler.ts sceneSamplerTasks, then behaviour-nav.ts navCellTasks
 *     (heights, walkable, clearance), each task timed.
 * Compares the two to the bit and prints the times.
 *   npx tsx scripts/.audit-frameloop-verify7-identity.mts --snapshot <voyage.json>
 */
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import {execSync} from "node:child_process";
import {createHash} from "node:crypto";
import {Worker, isMainThread, parentPort, workerData} from "node:worker_threads";

const req = createRequire(import.meta.url);
const now = () => performance.now();
const load = () => execSync("uptime").toString().trim().replace(/.*load averages?: /, "");

function compute(snapshotPath: string, order: "nav-first" | "nests-first") {
    const t: Record<string, number> = {};
    const mark = (name: string, since: number) => (t[name] = Math.round((now() - since) * 10) / 10);
    const {setArkWorld} = req("@/ark-scene/world");
    setArkWorld("v2");
    const {setNoHamlet} = req("@/ark-scene/no-hamlet");
    setNoHamlet(true);
    const {decodeArkSnapshot} = req("@/ark-scene/snapshot");
    const {arkIslandSnapshot} = req("@/lib/ark-islands");
    const {isHumanAnimal} = req("@/ark-scene/humans/town-humans");
    const {placeAnimals} = req("@/ark-scene/placement");
    const {allAttachPoints} = req("@/ark-scene/sampler");
    const {sceneSamplerTasks} = req("@/ark-scene/world-sampler");
    const {navCellTasks} = req("@/ark-scene/behaviour-nav");
    const {propsPresence} = req("@/ark-scene/props/presence");
    const {nestRadius} = req("@/ark-scene/props/nest-kinds");
    const {nestSpots} = req("@/ark-scene/props/nest-sites");
    const {arkBody} = req("@/ark-scene/stats");

    const raw = JSON.parse(readFileSync(snapshotPath, "utf8"));
    const snapshot = decodeArkSnapshot(raw.snapshot ?? raw);
    const wild = arkIslandSnapshot(snapshot, "wild");
    // (The mount's `withoutHumans`: humans are never animal entries.)
    const animals = wild.animals.filter((a: any) => !isHumanAnimal(a));
    let s = now();
    const places = placeAnimals(animals);
    mark("places", s);
    s = now();
    const attach = allAttachPoints();
    mark("attachPoints", s);

    const nav = () => {
        let s0 = now();
        const job = sceneSamplerTasks();
        const per: number[] = [];
        for (const task of job.tasks) {
            const ts = now();
            while (!task()) {
                /* the task's next chunk */
            }
            per.push(now() - ts);
        }
        const fs = now();
        const sampler = job.finish();
        t.samplerFinish = Math.round((now() - fs) * 10) / 10;
        mark("samplerTasks", s0);
        t.samplerTaskMax = Math.round(Math.max(...per) * 10) / 10;
        s0 = now();
        const cells = navCellTasks(sampler);
        const names = ["navHeights", "navWalkable", "navClearance"];
        cells.tasks.forEach((task: () => boolean, i: number) => {
            const ts = now();
            while (!task()) {
                /* the next row */
            }
            t[names[i]] = Math.round((now() - ts) * 10) / 10;
        });
        mark("navCellsTotal", s0);
        return {version: sampler.version, cells: cells.cells, plotsNull: true};
    };
    const nests = () => {
        const s0 = now();
        const presence = propsPresence({animals, ark_day: wild.ark_day, nests: wild.nests});
        const SAT_ON = new Set(["ground", "shore", "water_margin"]);
        const used = new Set<string>();
        const spots: unknown[] = [];
        const added: string[][] = [];
        const perPlan: number[] = [];
        const bySite: Record<string, number> = {};
        for (const plan of presence.nests) {
            const body = arkBody({model_slug: plan.slug}, "bird");
            const drawn = SAT_ON.has(plan.profile.site) ? body.display : Math.max(body.metres * 1.35, body.display * 0.3);
            const radius = nestRadius(plan.profile, drawn);
            const before = used.size;
            const ts = now();
            spots.push(nestSpots(plan, radius, (id: string) => places.get(id) ?? null, used));
            const took = now() - ts;
            perPlan.push(took);
            bySite[plan.profile.site] = (bySite[plan.profile.site] ?? 0) + took;
            added.push(Array.from(used).slice(before));
        }
        mark("nestSpotsTotal", s0);
        const sorted = [...perPlan].sort((a, b) => a - b);
        const q = (p: number) => Math.round(sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] * 10) / 10;
        t.nestPlans = perPlan.length;
        t.nestP50 = q(0.5);
        t.nestP90 = q(0.9);
        t.nestMax = Math.round(sorted[sorted.length - 1] * 10) / 10;
        return {spots, added, bySite: Object.fromEntries(Object.entries(bySite).map(([k, v]) => [k, Math.round(v)]))};
    };
    let navOut: ReturnType<typeof nav>;
    let nestOut: ReturnType<typeof nests>;
    if (order === "nav-first") {
        navOut = nav();
        nestOut = nests();
    } else {
        nestOut = nests();
        navOut = nav();
    }
    return {t, attachCount: attach.length, animals: animals.length, nav: navOut, nests: nestOut};
}

/** Every number by its exact bits (and -0 apart), keys in their own order: two values print the same only if equal to the bit. */
function exact(value: unknown): string {
    const buf = new Float64Array(1);
    const bits = new BigUint64Array(buf.buffer);
    const walk = (v: unknown): string => {
        if (typeof v === "number") {
            buf[0] = v;
            return `n${bits[0].toString(16)}`;
        }
        if (v === undefined) return "u";
        if (v === null || typeof v !== "object") return JSON.stringify(v);
        if (Array.isArray(v)) return `[${v.map(walk).join(",")}]`;
        return `{${Object.keys(v).map((k) => `${JSON.stringify(k)}:${walk((v as Record<string, unknown>)[k])}`).join(",")}}`;
    };
    return walk(value);
}
const sha = (bytes: ArrayBufferView | string) => createHash("sha256").update(typeof bytes === "string" ? bytes : Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)).digest("hex").slice(0, 16);
const KEYS = ["walk", "steep", "depth", "height", "clear"] as const;

if (isMainThread) {
    const at = process.argv.indexOf("--snapshot");
    const snapshotPath = at >= 0 ? process.argv[at + 1] : "";
    console.log(`load before: ${load()}`);
    const main = compute(snapshotPath, "nav-first");
    console.log(`main thread (nav first), load ${load()}: ${JSON.stringify(main.t)}`);
    console.log(`  wild animals ${main.animals}, attach points ${main.attachCount}, nav size ${main.nav.cells.size}, version ${main.nav.version}`);
    console.log(`  nest ms by site: ${JSON.stringify(main.nests.bySite)}`);
    const boot = `const {register: rc} = require(${JSON.stringify(req.resolve("tsx/cjs/api"))}); rc(); import(${JSON.stringify("file://" + req.resolve("tsx/esm/api").replace(/index\.cjs$/, "index.mjs"))}).then(({register}) => { register(); return import(${JSON.stringify(import.meta.url)}); });`;
    const worker = new Worker(boot, {eval: true, workerData: {snapshotPath}, resourceLimits: {maxOldGenerationSizeMb: 8192}});
    const answer: any = await new Promise((resolve, reject) => {
        worker.on("message", resolve);
        worker.on("error", reject);
    });
    await worker.terminate();
    console.log(`worker thread (nests first), load ${load()}: ${JSON.stringify(answer.t)}`);
    let same = true;
    const report: string[] = [];
    const a = main.nav;
    const b = answer.nav;
    report.push(`version ${a.version === b.version ? "same" : "DIFFERENT"}; size ${a.cells.size} / ${b.cells.size}`);
    if (a.version !== b.version || a.cells.size !== b.cells.size) same = false;
    for (const key of KEYS) {
        const x = a.cells[key];
        const y = b.cells[key];
        if (!x || !y) {
            report.push(`${key}: ${x ? "main only" : y ? "worker only" : "neither"}`);
            if (Boolean(x) !== Boolean(y)) same = false;
            continue;
        }
        const eq = x.byteLength === y.byteLength && Buffer.compare(Buffer.from(x.buffer, x.byteOffset, x.byteLength), Buffer.from(y.buffer, y.byteOffset, y.byteLength)) === 0;
        if (!eq) same = false;
        report.push(`${key}: ${x.constructor.name}[${x.length}] sha ${sha(x)} / ${sha(y)} ${eq ? "bytes equal" : "BYTES DIFFER"}`);
    }
    const spotsA = exact(main.nests.spots);
    const spotsB = exact(answer.nests.spots);
    const usedA = exact(main.nests.added);
    const usedB = exact(answer.nests.added);
    if (spotsA !== spotsB || usedA !== usedB) same = false;
    let count = 0;
    for (const list of main.nests.spots as unknown[][]) count += list.length;
    report.push(`nest spots: ${main.nests.spots.length} plans, ${count} spots, sha ${sha(spotsA)} / ${sha(spotsB)} ${spotsA === spotsB ? "bits equal" : "BITS DIFFER"}`);
    report.push(`used additions: ${main.nests.added.flat().length} ids, sha ${sha(usedA)} / ${sha(usedB)} ${usedA === usedB ? "equal (same order)" : "DIFFER"}`);
    console.log(report.map((line) => `  ${line}`).join("\n"));
    console.log(same ? "IDENTICAL: the worker's answer equals this thread's to the bit" : "NOT IDENTICAL");
    console.log(`load after: ${load()}`);
} else {
    const out = compute(workerData.snapshotPath, "nests-first");
    const cells = out.nav.cells;
    const transfer = KEYS.map((k) => cells[k]?.buffer).filter(Boolean);
    parentPort!.postMessage(out, transfer);
}
