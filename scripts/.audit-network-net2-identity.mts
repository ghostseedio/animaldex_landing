/**
 * PERF-WEB audit, verifier for NET-2 (the /ark page's Ark read through the shared anonymous read).
 *
 * 1. Identity: the route's body bytes (route.ts payloadOf + JSON.stringify, noIcon left out: it needs the artwork
 *    listing) for one raw answer, built alone, after the page-side decode + page helpers ran on a deep-frozen decode
 *    of the same raw object, and with the page decoding first. Also: the raw is unchanged by decoding, and which
 *    decoded sub-objects are the raw's own objects (aliases).
 * 2. Coupling: one createArkSharedRead instance, a route caller and a page caller, fake clock: which answer the route
 *    gets at each moment with and without page calls, and after a page-triggered failed refresh.
 * 3. Request-path cost today of a first render in a 60 s window, CPU only: JSON.parse, Next 13.5.11's fetch-cache set
 *    (Buffer copy, base64, JSON.stringify of the entry, then skipped as over 2 MB), decodeArkSnapshot.
 *
 *   npx tsx scripts/.audit-network-net2-identity.mts <voyage.json> [rounds]
 */
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {performance} from "node:perf_hooks";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import {arkFoundersOf} from "@/lib/ark-founders";
import {arkPageSummary} from "@/lib/ark-page-summary";
import {arkFocusSlug, arkSpeciesShare} from "@/lib/ark-seo";
import {arkRankedSpecies} from "@/lib/ark-population-change";
import {arkIslandCounts, arkPlaceGroups, arkTwoIslands} from "@/lib/ark-islands";
import {createArkSharedRead} from "@/lib/ark-shared-read";

const file = process.argv[2];
const rounds = Number(process.argv[3] ?? "8");
const answer = JSON.parse(readFileSync(file, "utf8")) as {snapshot: unknown};
// Stand-in for voyage_public_v2's raw answer: the route's own snapshot (the client decodes exactly this shape again).
const rawText = JSON.stringify(answer.snapshot);
const sha = (s: string | Buffer) => createHash("sha256").update(s).digest("hex").slice(0, 16);

function routeBody(rawData: unknown): string {
    const snapshot = decodeArkSnapshot(rawData);
    if (!snapshot) throw new Error("undecodable");
    return JSON.stringify({available: true, snapshot, founders: arkFoundersOf(rawData)});
}

function deepFreeze(value: unknown, seen = new Set<unknown>()): void {
    if (!value || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);
    for (const key of Object.keys(value as object)) deepFreeze((value as Record<string, unknown>)[key], seen);
    Object.freeze(value);
}

function pageSide(page: NonNullable<ReturnType<typeof decodeArkSnapshot>>): string {
    const summary = arkPageSummary(page);
    const ranked = arkRankedSpecies(page);
    const two = arkTwoIslands(page);
    const counts = two ? arkIslandCounts(page) : null;
    const groups = arkPlaceGroups(page.animals, two);
    const slugs = Array.from(new Set(page.animals.map((a) => a.model_slug))).slice(0, 40);
    const shares = slugs.map((slug) => [arkFocusSlug(page, slug), arkSpeciesShare(page, slug)]);
    return sha(JSON.stringify([summary, ranked.length, counts, groups.length, shares]));
}

// 1. Identity ------------------------------------------------------------------------------------------------
const raw = JSON.parse(rawText) as {animals: Array<Record<string, unknown>>};
const rawHashBefore = sha(JSON.stringify(raw));
const alone = routeBody(raw);
const page = decodeArkSnapshot(raw)!;
const rawById = new Map(raw.animals.map((a) => [a.id, a]));
const aliasKeys = new Map<string, number>();
let objectFields = 0;
for (const a of page.animals) {
    const r = rawById.get(a.id);
    for (const [key, v] of Object.entries(a)) {
        if (!v || typeof v !== "object") continue;
        objectFields++;
        if (r && r[key] === v) aliasKeys.set(key, (aliasKeys.get(key) ?? 0) + 1);
    }
}
const rawHashAfterDecode = sha(JSON.stringify(raw));
deepFreeze(page); // freezes the raw's aliased sub-objects too: any page-side write now throws (ES modules are strict)
let pageError: string | null = null;
let pageHash = "";
try {
    pageHash = pageSide(page);
} catch (error) {
    pageError = (error as Error).message;
}
const afterPage = routeBody(raw);
// Order B: a fresh raw object, the page decodes and works first, then the route builds.
const raw2 = JSON.parse(rawText);
const page2 = decodeArkSnapshot(raw2)!;
deepFreeze(page2);
pageSide(page2);
const pageFirst = routeBody(raw2);
console.log("== identity (route body bytes for one raw answer)");
console.log(`raw answer ${(rawText.length / 1e6).toFixed(2)} MB, ${page.animals.length} animals; body ${(alone.length / 1e6).toFixed(2)} MB`);
console.log(`route alone ${sha(alone)} | after page-side work on a frozen decode ${sha(afterPage)} | page first ${sha(pageFirst)} -> ${alone === afterPage && alone === pageFirst ? "IDENTICAL" : "DIFFERENT"}`);
console.log(`raw unchanged by decoding: ${rawHashBefore === rawHashAfterDecode} | page helpers on frozen decode: ${pageError ?? "no write"} (${pageHash})`);
console.log(`decoded object-valued fields: ${objectFields}; aliased to the raw's own objects: ${JSON.stringify(Object.fromEntries(aliasKeys))}`);

// 2. Coupling -------------------------------------------------------------------------------------------------
console.log("\n== coupling (one shared read, fake clock; answers are versions v1, v2, ...)");
type Raw = {ok: boolean; v: number};
async function scenario(label: string, pageAt: number[], failVersion: number | null) {
    let t = 0;
    const shared = createArkSharedRead<Raw>({freshMs: 30_000, staleMs: 600_000, retryMs: 15_000, isGood: (r) => r.ok, now: () => t});
    let version = 0;
    const reads: string[] = [];
    // Each load lands at once (time does not pass inside it); a failing one answers ok:false.
    const load = (by: string) => async (): Promise<Raw> => {
        version++;
        reads.push(`${by}@${t / 1000}s:v${version}${version === failVersion ? "(fail)" : ""}`);
        return {ok: version !== failVersion, v: version};
    };
    const events = [...[0, 35, 50, 80, 125].map((s) => ({s, who: "route"})), ...pageAt.map((s) => ({s, who: "page"}))].sort((a, b) => a.s - b.s || (a.who === "page" ? -1 : 1));
    const routeSaw: string[] = [];
    for (const e of events) {
        t = e.s * 1000;
        const r = await shared.read(load(e.who));
        await new Promise((resolve) => setImmediate(resolve)); // let a background refresh land
        if (e.who === "route") routeSaw.push(`${e.s}s:v${r.v}${r.ok ? "" : "!"}`);
    }
    console.log(`${label.padEnd(34)} route answers ${routeSaw.join(" ")} | reads ${reads.join(" ")}`);
}
await scenario("today (route callers only)", [], null);
await scenario("page renders at 31 s and 70 s", [31, 70], null);
await scenario("page refresh at 31 s fails", [31], 2);
await scenario("route refresh at 35 s fails (today)", [], 2);

// 3. Cost today, CPU only, per first render in a 60 s window ---------------------------------------------------
const parse: number[] = [];
const nextSet: number[] = [];
const decode: number[] = [];
for (let i = 0; i < rounds; i++) {
    const t0 = performance.now();
    const parsed = JSON.parse(rawText);
    const t1 = performance.now();
    // patch-fetch.js:389-410 + incremental-cache/index.js:365: copy the body, base64 it, stringify the whole entry.
    const body = Buffer.from(rawText);
    const entry = {kind: "FETCH", data: {headers: {"content-type": "application/json"}, body: body.toString("base64"), status: 200, url: "https://x.supabase.co/rest/v1/rpc/voyage_public_v2"}, revalidate: 60};
    const tooBig = JSON.stringify(entry).length > 2 * 1024 * 1024;
    const t2 = performance.now();
    decodeArkSnapshot(parsed);
    const t3 = performance.now();
    if (!tooBig) throw new Error("expected over 2 MB");
    parse.push(t1 - t0);
    nextSet.push(t2 - t1);
    decode.push(t3 - t2);
}
const median = (list: number[]) => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)];
const fmt = (list: number[]) => `median ${median(list.slice(1)).toFixed(1)} ms (first ${list[0].toFixed(1)}, min ${Math.min(...list).toFixed(1)}, max ${Math.max(...list).toFixed(1)})`;
console.log(`\n== request-path CPU today, ${rounds} rounds on ${(rawText.length / 1e6).toFixed(2)} MB`);
console.log(`JSON.parse                  ${fmt(parse)}`);
console.log(`Next fetch-cache set (skip) ${fmt(nextSet)}`);
console.log(`decodeArkSnapshot           ${fmt(decode)}`);
