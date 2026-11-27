/**
 * PERF-WEB audit, verifier of NET-2: the main-thread CPU one `readPublicArk` memo miss adds on the server besides the
 * RPC's own time. Next 13.5.11's patched fetch (`next: {revalidate}`) reads the body into a Buffer, base64s it and
 * JSON.stringifies the whole cache entry only to skip it as over 2 MB (patch-fetch.js:394-411, incremental-cache
 * index.js:365-371); then `rpc()` parses it with `response.json()` and `decodeArkSnapshot` decodes it.
 * Input: the real /api/ark/voyage answer (its `snapshot` stands in for the RPC's raw answer: same animals, ~13% smaller).
 *
 *   npx tsx scripts/.audit-network-v2-missmath.mts <voyage.json> [rounds]
 */
import {readFileSync} from "node:fs";
import {performance} from "node:perf_hooks";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";

const file = process.argv[2];
const rounds = Number(process.argv[3] ?? "10");
const whole = JSON.parse(readFileSync(file, "utf8")) as {snapshot: unknown};
// The RPC answers the snapshot itself; serialise just that, as the RPC's body would be.
const text = JSON.stringify(whole.snapshot);
const bytes = Buffer.from(text);
const times: Record<string, number[]> = {base64: [], stringifyEntry: [], responseJson: [], jsonParse: [], decode: []};
let animals = 0;
for (let i = 0; i < rounds; i++) {
    let t = performance.now();
    const b64 = Buffer.from(bytes).toString("base64");
    times.base64.push(performance.now() - t);
    t = performance.now();
    const size = JSON.stringify({kind: "FETCH", data: {headers: {"content-type": "application/json; charset=utf-8"}, body: b64, status: 200, url: "https://x.supabase.co/rest/v1/rpc/voyage_public_v2"}, revalidate: 60}).length;
    times.stringifyEntry.push(performance.now() - t);
    if (size < 2 * 1024 * 1024) throw new Error("entry under 2 MB: Next would store it");
    t = performance.now();
    const viaResponse = await new Response(bytes).json();
    times.responseJson.push(performance.now() - t);
    t = performance.now();
    const parsed = JSON.parse(text);
    times.jsonParse.push(performance.now() - t);
    t = performance.now();
    const snapshot = decodeArkSnapshot(parsed);
    times.decode.push(performance.now() - t);
    animals = snapshot?.animals.length ?? 0;
    if (!viaResponse || !snapshot) throw new Error("decode");
}
const median = (list: number[]) => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)];
console.log(`body ${(bytes.length / 1e6).toFixed(2)} MB, ${animals} animals, ${rounds} rounds (median of rounds 3+, first in brackets)`);
for (const [name, list] of Object.entries(times)) console.log(`${name.padEnd(15)} ${median(list.slice(2)).toFixed(1)} ms (first ${list[0].toFixed(1)})`);
const miss = median(times.base64.slice(2)) + median(times.stringifyEntry.slice(2)) + median(times.responseJson.slice(2)) + median(times.decode.slice(2));
console.log(`one miss, CPU on this machine: base64 + entry stringify + response.json + decode = ${miss.toFixed(1)} ms; Next's skipped-cache detour alone = ${(median(times.base64.slice(2)) + median(times.stringifyEntry.slice(2))).toFixed(1)} ms`);
