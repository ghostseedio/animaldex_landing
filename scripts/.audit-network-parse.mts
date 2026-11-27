/**
 * PERF-WEB audit, area "loading and the network": what one /api/ark/voyage answer costs to take in on the main thread
 * (the page's 45 s refresh reads the whole body each time: `cache: "no-store"`, ark-view.tsx). Times JSON.parse of the
 * real answer's text and `decodeArkSnapshot` of its snapshot, and the founders' JSON.stringify compare the refresh does.
 *
 *   npx tsx scripts/.audit-network-parse.mts <voyage.json> [rounds]
 */
import {readFileSync} from "node:fs";
import {performance} from "node:perf_hooks";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import {decodeArkFounders} from "@/lib/ark-founders";

const file = process.argv[2];
const rounds = Number(process.argv[3] ?? "12");
const text = readFileSync(file, "utf8");
const parse: number[] = [];
const decode: number[] = [];
const founders: number[] = [];
let animals = 0;
for (let i = 0; i < rounds; i++) {
    const t0 = performance.now();
    const body = JSON.parse(text) as {snapshot?: unknown; founders?: unknown};
    const t1 = performance.now();
    const snapshot = decodeArkSnapshot(body.snapshot);
    const t2 = performance.now();
    const named = decodeArkFounders(body.founders);
    const same = JSON.stringify(named) === JSON.stringify(named);
    const t3 = performance.now();
    animals = snapshot?.animals.length ?? 0;
    if (!same) throw new Error("compare");
    parse.push(t1 - t0);
    decode.push(t2 - t1);
    founders.push(t3 - t2);
}
const median = (list: number[]) => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)];
const fmt = (list: number[]) => `median ${median(list.slice(2)).toFixed(1)} ms (first ${list[0].toFixed(1)}, min ${Math.min(...list).toFixed(1)}, max ${Math.max(...list).toFixed(1)})`;
console.log(`answer ${(text.length / 1e6).toFixed(2)} MB of JSON, ${animals} animals, ${rounds} rounds`);
console.log(`JSON.parse      ${fmt(parse)}`);
console.log(`decodeArkSnapshot ${fmt(decode)}`);
console.log(`founders decode+compare ${fmt(founders)}`);
