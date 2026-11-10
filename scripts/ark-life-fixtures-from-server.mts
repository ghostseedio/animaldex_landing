#!/usr/bin/env -S npx tsx
/**
 * The Ark life fixtures from the server's own answers.
 *
 *   npx tsx scripts/ark-life-fixtures-from-server.mts <capture> [--check] [--out <dir>] [--save-capture <file>]
 *
 * <capture> is either a capture's JSON (`{snapshot, events, lives}`: the
 * answers of `voyage_public_v2()`, `voyage_events_since_v1(...)` and
 * `voyage_animal_life_v1(id)` per id, verbatim), or the output of the
 * server's rolled-back rehearsal as `supabase db query` printed it (its
 * final error carries `CAPTURE_BEGIN{...}CAPTURE_END`; see the server's
 * supabase/scripts/voyage-life-rehearsal/build.py).
 *
 * It checks the capture against the canonical shapes (src/lib/ark-capture.ts,
 * life v2 contract 4.1), feeds it through the web's decoders and the replay
 * planner, and fails if a key differs or a decoder drops anything the server
 * sent. Then, unless --check, it writes the answers verbatim as
 * <dir>/snapshot-v2.json, <dir>/events.json and <dir>/lives.json (default
 * src/ark-scene/fixtures), which /ark?fixture=1 decodes like the live reads.
 * --save-capture writes the capture itself as JSON (the rehearsal's is kept
 * as src/ark-scene/fixtures/server-capture.json, which the tests read).
 */
import {mkdirSync, readFileSync, writeFileSync} from "node:fs";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {arkCaptureProblems, decodeArkCapture, extractArkCapture, type ArkCapture} from "../src/lib/ark-capture.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Checks and decodes a capture; throws with every problem. Returns a one-line proof. */
export function proveArkCapture(capture: ArkCapture): string {
    const problems = arkCaptureProblems(capture);
    const decoded = decodeArkCapture(capture);
    const all = [...problems, ...decoded.lost.map((lost) => `decoder lost ${lost}`)];
    if (all.length) throw new Error(`the capture is not read whole:\n  ${all.join("\n  ")}`);
    const kinds = decoded.events.reduce<Record<string, number>>((sum, e) => ({...sum, [e.kind]: (sum[e.kind] ?? 0) + 1}), {});
    const acts = decoded.plan.acts.reduce<Record<string, number>>((sum, act) => {
        const key = act.kind === "death" ? `death(${act.cause})` : act.kind;
        return {...sum, [key]: (sum[key] ?? 0) + 1};
    }, {});
    return `snapshot ${decoded.snapshot?.animals.length} animals (Ark day ${decoded.snapshot?.ark_day}), ${decoded.events.length} events ${JSON.stringify(kinds)}, `
        + `${decoded.lives.size} lives, nothing lost; replay acts ${JSON.stringify(acts)}; summary ${JSON.stringify(decoded.plan.summary)}`;
}

/** Writes a checked capture as the fixtures, verbatim. */
export function writeArkFixtures(capture: ArkCapture, out = join(root, "src/ark-scene/fixtures")): void {
    mkdirSync(out, {recursive: true});
    const write = (file: string, value: unknown) => writeFileSync(join(out, file), JSON.stringify(value, null, 1) + "\n");
    write("snapshot-v2.json", capture.snapshot);
    write("events.json", capture.events);
    write("lives.json", capture.lives);
}

const main = fileURLToPath(import.meta.url) === resolve(process.argv[1] ?? "");
if (main) {
    const args = process.argv.slice(2);
    const valued = new Set(["--out", "--save-capture"]);
    const file = args.find((arg, i) => !arg.startsWith("--") && !valued.has(args[i - 1]));
    const outAt = args.indexOf("--out");
    const saveAt = args.indexOf("--save-capture");
    if (!file) {
        console.error("usage: npx tsx scripts/ark-life-fixtures-from-server.mts <capture.json | rehearsal output> [--check] [--out <dir>] [--save-capture <file>]");
        process.exit(2);
    }
    const capture = extractArkCapture(readFileSync(file, "utf8"));
    if (!capture) {
        console.error(`no capture in ${file}`);
        process.exit(1);
    }
    try {
        console.log(proveArkCapture(capture));
    } catch (error) {
        console.error((error as Error).message);
        process.exit(1);
    }
    if (saveAt >= 0) {
        writeFileSync(resolve(args[saveAt + 1]), JSON.stringify(capture, null, 1) + "\n");
        console.log(`saved the capture to ${args[saveAt + 1]}`);
    }
    if (!args.includes("--check")) {
        const out = outAt >= 0 ? resolve(args[outAt + 1]) : undefined;
        writeArkFixtures(capture, out);
        console.log(`wrote snapshot-v2.json, events.json, lives.json to ${out ?? "src/ark-scene/fixtures"}`);
    }
}
