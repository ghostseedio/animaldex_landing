#!/usr/bin/env -S npx tsx
/**
 * The grounding audit (motion 100x pass, lane L3): floating, sinking and inside-scenery counts, before this lane's
 * rules (`legacy`) and with them (`grounded`), through one Ark day (`src/ark-scene/grounding/audit.ts`).
 *
 *   npx tsx --tsconfig scripts/tsconfig.scripts.json scripts/ark-grounding-audit.mts <snapshot.json | --validator> [--level near|far] [--json out.json]
 *
 * A snapshot holds real usernames: read it in place (development's `public/ark-local/real.json`), never copy it.
 * Only counts and species slugs are printed or written.
 */
import {readFileSync, writeFileSync} from "node:fs";
import {auditGrounding} from "../src/ark-scene/grounding/audit.ts";
import {decodeArkSnapshot} from "../src/ark-scene/snapshot.ts";
import {validatorAnimals} from "../src/ark-scene/map/validate.ts";
import type {ArkAnimal} from "../src/ark-scene/types.ts";

const args = process.argv.slice(2);
const value = (name: string) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
};
const source = args[0];
if (!source) throw new Error("usage: ark-grounding-audit.mts <snapshot.json | --validator> [--level near|far] [--json out.json]");
let animals: ArkAnimal[];
if (source === "--validator") animals = validatorAnimals();
else {
    const snapshot = decodeArkSnapshot(JSON.parse(readFileSync(source, "utf8")));
    if (!snapshot) throw new Error("not a snapshot");
    animals = snapshot.animals;
}
const level = (value("--level") ?? "near") as "near" | "far";
const started = Date.now();
const audit = auditGrounding(animals, {level});
console.log(`${audit.animals} animals, ${audit.samples.length / 2} samples each rule set (${((Date.now() - started) / 1000).toFixed(0)} s), level ${level}`);
console.log("samples by kind:", JSON.stringify(audit.kinds));
for (const rules of ["legacy", "grounded"] as const) {
    const c = audit.counts[rules];
    console.log(`${rules.padEnd(8)} animals floating ${c.floats}, sinking ${c.sinks}, inside scenery ${c.inside} (any ${c.any}); samples ${JSON.stringify(c.samples)}`);
}
// Where the problems are: by what they stand on, and the species most often wrong.
for (const rules of ["legacy", "grounded"] as const) {
    const on = new Map<string, number>();
    const species = new Map<string, number>();
    const example = new Map<string, string>();
    for (const sample of audit.samples) {
        if (!sample.id.endsWith(`#${rules}`) || !sample.problems.length) continue;
        const key = `${sample.kind}:${sample.on}:${sample.problems.join("+")}`;
        on.set(key, (on.get(key) ?? 0) + 1);
        species.set(sample.slug, (species.get(sample.slug) ?? 0) + 1);
        if (!example.has(key) && sample.detail) example.set(key, `${sample.slug}: ${sample.detail}`);
    }
    console.log(`\n${rules}: problem samples by surface`);
    for (const [key, n] of Array.from(on.entries()).sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(`  ${String(n).padStart(6)}  ${key}${example.has(key) ? `  (e.g. ${example.get(key)})` : ""}`);
    console.log(`${rules}: species with most problem samples: ${Array.from(species.entries()).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([s, n]) => `${s} ${n}`).join(", ")}`);
}
const out = value("--json");
if (out) writeFileSync(out, JSON.stringify({animals: audit.animals, level, counts: audit.counts, kinds: audit.kinds, problems: audit.samples.filter((s) => s.problems.length).map((s) => ({rules: s.id.endsWith("#legacy") ? "legacy" : "grounded", slug: s.slug, kind: s.kind, on: s.on, gap: Math.round(s.gap * 1000) / 1000, problems: s.problems, detail: s.detail}))}));
