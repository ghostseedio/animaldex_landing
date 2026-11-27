// Audit helper (lane PERF-WEB, verifier for NET-5), untracked: never commit.
// Shows, with only existing exports and stubbed fetches (no network), what a 429 does to the 24-hour change read today
// and what the same read does when its page fetch goes through readUntilIn (the fix's mechanism), plus how the
// existing retry classifies three's HttpError for a 429 (people GLB, town KTX2).
import {readArkPopulationThen, ARK_CHANGE_CACHE_KEY} from "@/lib/ark-population-change";
import {finalStatus, ModelFileError, readIsFinal, readUntilIn} from "@/ark-scene/model-files";

type Answer = {ok: boolean; status: number; json: () => Promise<unknown>};
const answer = (status: number, body: unknown): Answer => ({ok: status >= 200 && status < 300, status, json: async () => body});

// A minimal snapshot: one wild red fox now; the log says one arrived in the window, so "then" is 0 of it.
const snapshot = {animals: [{id: "a1", species_profile_id: "fox", kind_species_profile_id: "fox", island: "wild", model_slug: "red-fox", brought_by: {label: "x"}}], counts: {animals: 1, species: 1, founders: 1}} as never;
const page1 = {available: true, more: true, events: [{id: 1, at: "2026-11-26T19:02:00.444044Z", kind: "arrival", animal: {id: "a0", species_profile_id: "fox"}}]};
const page2 = {available: true, more: false, events: [{id: 2, at: "2026-11-27T06:00:00.000Z", kind: "arrival", animal: {id: "a1", species_profile_id: "fox"}}]};

function stubFetch(): {fetch: (url: string) => Promise<Answer>; asked: string[]} {
    const asked: string[] = [];
    let page2Tries = 0;
    return {
        asked,
        fetch: async (url: string) => {
            asked.push(url);
            if (!url.includes("19%3A02%3A00")) return answer(200, page1);
            // The cold run: the second page answered 429 (Retry-After 9) once, then would have answered.
            return ++page2Tries === 1 ? answer(429, {}) : answer(200, page2);
        }
    };
}

const memory = new Map<string, string>();
const storage = {getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => void memory.set(k, v)};
const now = () => Date.parse("2026-11-27T06:45:00.000Z");

// Today: the page's own fetch, no retry.
const today = stubFetch();
memory.clear();
const before = await readArkPopulationThen("/api/ark/events", snapshot, {fetch: today.fetch, storage, now});
console.log("today:    result", before === null ? "null (no 24-hour change for the visit)" : JSON.stringify(before), "| reads", today.asked.length, "| cached", memory.has(ARK_CHANGE_CACHE_KEY));

// The fix's mechanism: the same read, its page fetch made until it is in (non-final failures retried; waits stubbed).
const fixed = stubFetch();
memory.clear();
const waits: number[] = [];
let tries = 0;
const retrying = (url: string) => {
    tries = 0;
    return readUntilIn("24-hour change", async () => {
        tries++;
        const r = await fixed.fetch(url);
        if (!r.ok) throw new ModelFileError(`${url}: HTTP ${r.status}`, finalStatus(r.status));
        return r;
    }, () => tries < 4, async (s) => void waits.push(s));
};
const origWarn = console.warn;
console.warn = () => undefined;
const after = await readArkPopulationThen("/api/ark/events", snapshot, {fetch: retrying, storage, now});
console.warn = origWarn;
console.log("retrying: result", after === null ? "null" : JSON.stringify(after.then), "| reads", fixed.asked.length, "| waits (s)", JSON.stringify(waits), "| cached", memory.has(ARK_CHANGE_CACHE_KEY));

// Three's loaders (r170 FileLoader) reject a 429 with HttpError(message, response): not final, so readUntilIn asks again.
const http429 = Object.assign(new Error('fetch for "https://animaldex.app/ark/assets/people-v1/people-near.glb?v=4bbe7c1a82c0" responded with 429: '), {response: {status: 429}});
console.log("readIsFinal(three HttpError 429) =", readIsFinal(http429), "| 404 =", readIsFinal(Object.assign(new Error("404"), {response: {status: 404}})), "| finalStatus(429/502/503/504) =", [429, 502, 503, 504].map(finalStatus).join(","));
