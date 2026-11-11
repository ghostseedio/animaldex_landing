#!/usr/bin/env -S npx tsx
/**
 * The Ark's behaviour checks in CI (`.github/workflows/ark-behaviour-audit.yml`): reads the behaviour audit's result
 * (`scripts/ark-behaviour-audit.mts`, the CI configuration) and the reactive layer's encounter scenario
 * (`scripts/ark-intelligence-encounters.mts --out`), and fails when a key number for the owner's problems 1–7 is worse
 * than `tests/ark-audit/thresholds.json`.
 *
 * The thresholds are today's merged values (with a small slack), not the final targets: they stop a regression, and
 * are raised by hand as the lanes improve them (`--write` prints the current values in the file's shape).
 *
 *   npx tsx scripts/ark-audit-check.mts --audit <ci.json> --encounters <encounters.json> [--thresholds <file>] [--write]
 *
 * Deterministic: the audit and the scenario have no randomness, so a change in a number is a change in the scene.
 */
import {readFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

type Check = {id: string; problem: string; source: "audit" | "encounters"; path: string; max?: number; min?: number; note?: string};
type Thresholds = {about: string; config: Record<string, string>; checks: Check[]};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name: string) => {
    const at = process.argv.indexOf(`--${name}`);
    return at > 0 ? process.argv[at + 1] : undefined;
};
const thresholdsFile = arg("thresholds") ?? path.join(root, "tests/ark-audit/thresholds.json");
const thresholds = JSON.parse(readFileSync(thresholdsFile, "utf8")) as Thresholds;
const sources: Record<Check["source"], unknown> = {
    audit: arg("audit") ? JSON.parse(readFileSync(arg("audit")!, "utf8")) : null,
    encounters: arg("encounters") ? (JSON.parse(readFileSync(arg("encounters")!, "utf8")) as {summary: unknown}).summary : null
};

/** A value at a dot path (`variety.awakeAllSamePct`, `predatorPrey.predatorsWithPreyWithinM.5`). */
function at(object: unknown, dotted: string): unknown {
    return dotted.split(".").reduce<unknown>((value, key) => (value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined), object);
}

if (process.argv.includes("--write")) {
    // Today's values in the file's shape (the slack is added by hand).
    for (const check of thresholds.checks) console.log(`${check.id}: ${JSON.stringify(at(sources[check.source], check.path))}`);
    process.exit(0);
}

const lines: string[] = ["| Problem | Check | Value | Limit | |", "|---|---|---|---|---|"];
let failed = 0;
for (const check of thresholds.checks) {
    const source = sources[check.source];
    if (!source) {
        lines.push(`| ${check.problem} | ${check.id} | (no ${check.source} result) | | skipped |`);
        continue;
    }
    const raw = at(source, check.path);
    const value = typeof raw === "number" ? raw : raw === null ? null : Number.NaN;
    const limit = check.max !== undefined ? `≤ ${check.max}` : `≥ ${check.min}`;
    let ok: boolean;
    if (value === null || Number.isNaN(value)) ok = false;
    else ok = (check.max === undefined || value <= check.max) && (check.min === undefined || value >= check.min);
    if (!ok) failed++;
    lines.push(`| ${check.problem} | ${check.id} | ${value === null ? "null" : value} | ${limit} | ${ok ? "ok" : "**WORSE**"} |`);
}
console.log(lines.join("\n"));
if (failed) {
    console.error(`\n${failed} of ${thresholds.checks.length} checks are worse than tests/ark-audit/thresholds.json. A deliberate change: update the file in the same PR, with why.`);
    process.exit(1);
}
console.log(`\nAll ${thresholds.checks.length} checks hold.`);
