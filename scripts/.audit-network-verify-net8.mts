/**
 * PERF-WEB audit, verifier for NET-8 (skip the 45 s refresh's parse when the ETag is unchanged).
 * Times, on the real answer, every step a same-ETag refresh runs today (ark-view.tsx:1074-1085 + apply :999-1010):
 *   body   UTF-8 decode + JSON.parse of the bytes (what Response.json() does on the main thread)
 *   decode decodeArkSnapshot(body.snapshot)
 *   live   ArkLive.snapshot(next) (controller.ts:368-385): signature() + seen.snapshot() (seen/index.ts:226-232),
 *          replicated: lone set, setCrises' aboard map, applyStates (arkSeenStates, maps, pin signature), setWounded filter
 *   same   sameAnimals(before, next) (ark-view.tsx:238)
 *   found  decodeArkFounders + the two JSON.stringify (ark-view.tsx:1083-1084)
 * and what one refresh leaves for the GC (heap retained by {body, next}, after a full gc).
 *
 *   NODE_OPTIONS=--expose-gc npx tsx scripts/.audit-network-verify-net8.mts <voyage.json> [rounds]
 */
import {readFileSync} from "node:fs";
import {performance} from "node:perf_hooks";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import {decodeArkFounders} from "@/lib/ark-founders";
import {arkSeenStates, arkSeenStatesToPin} from "@/ark-scene/seen/hooks";
import type {ArkSnapshot} from "@/ark-scene/types";

const file = process.argv[2];
const rounds = Number(process.argv[3] ?? "15");
const bytes = readFileSync(file);
const gc = (globalThis as {gc?: () => void}).gc;

function hashString(value: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < value.length; i++) {
        h ^= value.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}
function signature(snapshot: ArkSnapshot): string {
    const ids = snapshot.animals.map((animal) => animal.id).sort().join(",");
    const nests = (snapshot.nests ?? []).map((nest) => JSON.stringify(nest)).sort().join("|");
    return `${snapshot.animals.length}:${hashString(ids)}:${hashString(nests)}`;
}
function sameAnimals(a: ArkSnapshot | null, b: ArkSnapshot | null): boolean {
    if (!a || !b || a.animals.length !== b.animals.length) return false;
    return a.animals.every((animal, i) => animal.id === b.animals[i].id && animal.mine === b.animals[i].mine);
}
let pinned = "";
function seenSnapshot(read: ArkSnapshot): number {
    const lone = new Set(read.animals.filter((animal) => animal.lone === true).map((animal) => animal.id));
    const aboardC = new Map(read.animals.map((animal) => [animal.id, animal]));
    const list = arkSeenStates(read);
    const states = new Map(list.map((state) => [state.id, state]));
    const aboard = new Map(read.animals.map((animal) => [animal.id, animal]));
    const ids = new Set<string>();
    for (const state of arkSeenStatesToPin(list, 40)) {
        ids.add(state.id);
        if (state.target && aboard.has(state.target)) ids.add(state.target);
    }
    const sig = Array.from(ids).filter((id) => aboard.has(id)).sort().join(",");
    const same = sig === pinned;
    pinned = sig;
    const wounded = list.filter((state) => state.kind === "wounded").length;
    return lone.size + aboardC.size + states.size + wounded + (same ? 1 : 0);
}

const T: Record<string, number[]> = {body: [], decode: [], live: [], same: [], found: [], total: []};
let before: ArkSnapshot | null = null;
let current = decodeArkFounders(JSON.parse(new TextDecoder().decode(bytes)).founders);
let sink = 0;
for (let i = 0; i < rounds; i++) {
    const t0 = performance.now();
    const body = JSON.parse(new TextDecoder().decode(bytes)) as {snapshot?: unknown; founders?: unknown};
    const t1 = performance.now();
    const next = decodeArkSnapshot(body.snapshot)!;
    const t2 = performance.now();
    sink += signature(next).length + seenSnapshot(next);
    const t3 = performance.now();
    sink += sameAnimals(before, next) ? 1 : 0;
    const t4 = performance.now();
    const named = decodeArkFounders(body.founders);
    current = JSON.stringify(current) === JSON.stringify(named) ? current : named;
    const t5 = performance.now();
    if (!before) before = next;
    T.body.push(t1 - t0);
    T.decode.push(t2 - t1);
    T.live.push(t3 - t2);
    T.same.push(t4 - t3);
    T.found.push(t5 - t4);
    T.total.push(t5 - t0);
}
const median = (list: number[]) => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)];
const fmt = (list: number[]) => `median ${median(list.slice(2)).toFixed(1)} ms  (first ${list[0].toFixed(1)}, min ${Math.min(...list).toFixed(1)}, max ${Math.max(...list).toFixed(1)})`;
console.log(`answer ${(bytes.length / 1e6).toFixed(2)} MB, ${before?.animals.length} animals, ${rounds} rounds (sink ${sink % 7})`);
for (const key of Object.keys(T)) console.log(`${key.padEnd(7)} ${fmt(T[key])}`);

// What one refresh leaves for the GC: heap retained by the parsed body and the decoded snapshot.
if (gc) {
    gc();
    gc();
    const h0 = process.memoryUsage().heapUsed;
    const body = JSON.parse(new TextDecoder().decode(bytes)) as {snapshot?: unknown};
    gc();
    const h1 = process.memoryUsage().heapUsed;
    const next = decodeArkSnapshot(body.snapshot);
    gc();
    const h2 = process.memoryUsage().heapUsed;
    console.log(`heap retained: parsed body ${((h1 - h0) / 1e6).toFixed(1)} MB, + decoded snapshot ${((h2 - h1) / 1e6).toFixed(1)} MB (animals ${next?.animals.length})`);
} else console.log("(no gc: run with NODE_OPTIONS=--expose-gc for the heap numbers)");
