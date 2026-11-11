#!/usr/bin/env -S npx tsx
/**
 * The motion pass's metrics in one CI summary (integrator, `ark-next`; docs/ark/NEXT.md).
 *
 * Each lane keeps its own metric script and its own JSON; `tests/ark-motion/metrics.json` lists them: the command that
 * writes the JSON, the file, and the numbers to read from it (a dotted path, optionally `length` or `sum`), each with
 * its limit (`max` / `min`) and the release's value (`before`). This runs every check whose files have landed, reads
 * the numbers (and the test files' results), and writes one table: `<out>/summary.md` and `summary.json` (and the job summary in CI). It fails when
 * a check's command fails, a number is missing, or a number passes its limit.
 *
 *   npx tsx scripts/ark-motion-ci.mts [--out .ark-golden/ci/motion] [--only name,name] [--no-run]
 *
 * `--no-run` reads the JSON files the commands already wrote (for a quick re-read). Local files only.
 */

import {spawnSync} from "node:child_process";
import {appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

type Metric = {id: string; label: string; path: string; op?: "length" | "sum"; max?: number; min?: number; before?: number | string; unit?: string};
/**
 * A check: a `command` that writes `output` (the lane's JSON) and/or `tests` (node test files, run with the TAP
 * reporter: one row per test whose name matches `metricTests`, default "metric", and one row for the whole set).
 * Every command and test sees `ARK_MOTION_METRICS_DIR` (this run's out folder), where a lane's test may write the
 * numbers it measured as JSON for `output` + `metrics` to read.
 */
type Check = {name: string; lane: string; requires: string[]; command?: string; tests?: string[]; metricTests?: string; output?: string; metrics?: Metric[]; enabled?: boolean};
type Row = {check: string; lane: string; id: string; label: string; before: number | string | null; value: number | null; limit: string; pass: boolean; note?: string};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const arg = (name: string, fallback: string) => {
    const at = argv.indexOf(`--${name}`);
    return at >= 0 && argv[at + 1] && !argv[at + 1].startsWith("--") ? argv[at + 1] : fallback;
};
const out = path.resolve(root, arg("out", path.join(".ark-golden", "ci", "motion")));
const only = arg("only", "") ? new Set(arg("only", "").split(",")) : null;
const run = !argv.includes("--no-run");
mkdirSync(out, {recursive: true});
const log = (...parts: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...parts);

/** A dotted path into the JSON (`counts.grounded.floating`, `rows.0.value`), then `length` or `sum` if asked. */
function readMetric(json: unknown, metric: Pick<Metric, "path" | "op">): number | null {
    let at: unknown = json;
    for (const key of metric.path.split(".").filter(Boolean)) {
        if (at === null || typeof at !== "object") return null;
        at = (at as Record<string, unknown>)[key];
    }
    if (metric.op === "length") return Array.isArray(at) ? at.length : at && typeof at === "object" ? Object.keys(at).length : null;
    if (metric.op === "sum") {
        const values = Array.isArray(at) ? at : at && typeof at === "object" ? Object.values(at) : null;
        return values ? values.reduce((total: number, v) => total + (typeof v === "number" ? v : 0), 0) : null;
    }
    return typeof at === "number" && Number.isFinite(at) ? at : null;
}

const {checks} = JSON.parse(readFileSync(path.join(root, "tests", "ark-motion", "metrics.json"), "utf8")) as {checks: Check[]};
const rows: Row[] = [];
const skipped: string[] = [];
for (const check of checks) {
    if (only && !only.has(check.name)) continue;
    const missing = check.requires.filter((file) => !existsSync(path.join(root, file)));
    if (check.enabled === false || missing.length) {
        skipped.push(`${check.name} (${check.lane}): ${missing.length ? `not landed: ${missing.join(", ")}` : "disabled"}`);
        log(`skip  ${check.name}`);
        continue;
    }
    const env = {...process.env, ARK_MOTION_METRICS_DIR: out};
    if (run && check.tests?.length) {
        log(`test  ${check.name}: ${check.tests.join(" ")}`);
        const result = spawnSync("npx", ["tsx", "--test", "--test-reporter=tap", ...check.tests], {cwd: root, env, encoding: "utf8", maxBuffer: 64 << 20});
        const tap = `${result.stdout ?? ""}`;
        writeFileSync(path.join(out, `${check.name.replace(/[^a-z0-9-]+/gi, "_")}.tap`), tap + (result.stderr ?? ""));
        // Top-level tests only (subtests are indented).
        const results = [...tap.matchAll(/^(not ok|ok) \d+ - (.*)$/gm)].map((m) => ({pass: m[1] === "ok", name: m[2].trim()}));
        const pattern = new RegExp(check.metricTests ?? "metric", "i");
        for (const t of results.filter((r) => pattern.test(r.name))) rows.push({check: check.name, lane: check.lane, id: "test", label: t.name, before: null, value: t.pass ? 1 : 0, limit: "pass", pass: t.pass});
        const passed = results.filter((r) => r.pass).length;
        rows.push({check: check.name, lane: check.lane, id: "tests", label: `all of ${check.tests.map((f) => path.basename(f)).join(", ")} (tests passed)`, before: null, value: passed, limit: `= ${results.length}`, pass: result.status === 0 && results.length > 0 && passed === results.length, ...(results.length ? {} : {note: `no tests ran (exit ${result.status})`})});
        log(`${result.status === 0 ? "done " : "FAIL "} ${check.name} (${passed}/${results.length})`);
    }
    if (run && check.command) {
        log(`run   ${check.name}: ${check.command}`);
        const started = Date.now();
        const result = spawnSync(check.command, {cwd: root, env, shell: true, stdio: "inherit"});
        log(`${result.status === 0 ? "done " : "FAIL "} ${check.name} (exit ${result.status}, ${Math.round((Date.now() - started) / 1000)} s)`);
        if (result.status !== 0) {
            rows.push({check: check.name, lane: check.lane, id: "exit", label: "the check's command", before: null, value: result.status, limit: "exit 0", pass: false});
            continue;
        }
    }
    if (!check.output || !check.metrics?.length) continue;
    let json: unknown = null;
    try {
        json = JSON.parse(readFileSync(path.resolve(root, check.output.replace("$ARK_MOTION_METRICS_DIR", out)), "utf8"));
    } catch {
        rows.push({check: check.name, lane: check.lane, id: "output", label: `its output ${check.output}`, before: null, value: null, limit: "present", pass: false});
        continue;
    }
    for (const metric of check.metrics) {
        const value = readMetric(json, metric);
        const limits = [metric.max !== undefined ? `≤ ${metric.max}` : "", metric.min !== undefined ? `≥ ${metric.min}` : ""].filter(Boolean).join(", ") || "report";
        const pass = value !== null && (metric.max === undefined || value <= metric.max) && (metric.min === undefined || value >= metric.min);
        rows.push({check: check.name, lane: check.lane, id: metric.id, label: metric.label + (metric.unit ? ` (${metric.unit})` : ""), before: metric.before ?? null, value, limit: limits, pass, ...(value === null ? {note: `missing: ${metric.path}`} : {})});
    }
}

const failed = rows.filter((row) => !row.pass);
const fmt = (v: number | string | null) => (v === null ? "—" : typeof v === "number" ? String(Math.round(v * 1000) / 1000) : v);
const md = [
    `# Ark motion metrics: ${failed.length ? `${failed.length} failing` : "all pass"} (${rows.length} numbers)`,
    "",
    "| Lane | Metric | Before (release) | Now | Limit | |",
    "|---|---|---|---|---|---|",
    ...rows.map((row) => `| ${row.lane} | ${row.label}${row.note ? ` (${row.note})` : ""} | ${fmt(row.before)} | ${fmt(row.value)} | ${row.limit} | ${row.pass ? "pass" : "**FAIL**"} |`),
    ...(skipped.length ? ["", "Not run yet:", ...skipped.map((s) => `- ${s}`)] : []),
    ""
].join("\n");
writeFileSync(path.join(out, "summary.md"), md);
writeFileSync(path.join(out, "summary.json"), JSON.stringify({rows, skipped, failed: failed.length}, null, 1));
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + "\n");
console.log(md);
process.exit(failed.length ? 1 : 0);
