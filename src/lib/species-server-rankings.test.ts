import assert from "node:assert/strict";
import test from "node:test";
import {fetchServerSpeciesRankingRows, isLikelyNonLiveRankingRow} from "@/lib/species-server-rankings";

const config = {supabaseUrl: "https://example.supabase.co", readKey: "test-anon-key"};
type Row = {capture_id?: string | null};

async function fetchServerSpeciesRankings(entry: {speciesProfileId?: string; normalizedIdentityKey?: string}, limit: number, fetchImpl: typeof fetch) {
    const ranked = await fetchServerSpeciesRankingRows<Row>(config, entry, limit, "capture_id", fetchImpl);
    return ranked?.map(({row, rank, totalCount}) => ({captureId: row.capture_id, rank, totalCount})) ?? null;
}

function row(id: string, extra: Record<string, unknown> = {}): {capture_id: string; raw_json?: unknown} & Record<string, unknown> {
    return {capture_id: id, animal_name: "Red Fox", profile_username: `user-${id}`, capture_grade: 7, ...extra};
}

function fakeFetch(rankRows: unknown, feedRows: unknown, calls: string[] = [], rankStatus = 200) {
    return (async (input: RequestInfo | URL) => {
        const url = String(input);
        calls.push(url);
        if (url.includes("/rpc/discover_ranking_page_v1")) {
            return new Response(JSON.stringify(rankRows), {status: rankStatus});
        }
        return new Response(JSON.stringify(feedRows), {status: 200});
    }) as typeof fetch;
}

test("server ranks are kept as numbers and order, with the cohort size (GRADING-5)", async () => {
    const calls: string[] = [];
    const items = await fetchServerSpeciesRankings(
        {speciesProfileId: "sp-1", normalizedIdentityKey: "red_fox"},
        24,
        // The feed rows come back in a different order than the ranks.
        fakeFetch(
            [{capture_id: "c-7", rank: 7, total_count: 300}, {capture_id: "c-8", rank: 8, total_count: 300}],
            [row("c-8"), row("c-7")],
            calls
        )
    );
    assert.deepEqual(items?.map((item) => [item.captureId, item.rank, item.totalCount]), [["c-7", 7, 300], ["c-8", 8, 300]]);
    assert.ok(calls[1].includes("capture_id=in.%28c-7%2Cc-8%29"));
});

test("a missing RPC (before the migration) returns null so the old ranking runs", async () => {
    const items = await fetchServerSpeciesRankings(
        {speciesProfileId: "sp-1"},
        24,
        fakeFetch({code: "PGRST202", message: "Could not find the function"}, [], [], 404)
    );
    assert.equal(items, null);
});

test("an empty cohort is an empty list, and a ranked row the feed no longer has is left out", async () => {
    assert.deepEqual(await fetchServerSpeciesRankings({speciesProfileId: "sp-1"}, 24, fakeFetch([], [])), []);
    const items = await fetchServerSpeciesRankings(
        {speciesProfileId: "sp-1"},
        24,
        fakeFetch([{capture_id: "gone", rank: 1, total_count: 2}, {capture_id: "here", rank: 2, total_count: 2}], [row("here")])
    );
    assert.deepEqual(items?.map((item) => item.rank), [2]);
});

test("no species id or key means no server call", async () => {
    const calls: string[] = [];
    assert.equal(await fetchServerSpeciesRankings({}, 24, fakeFetch([], [], calls)), null);
    assert.equal(calls.length, 0);
});

test("non-live captures are not rankable on the fallback path", () => {
    assert.equal(isLikelyNonLiveRankingRow(row("a", {raw_json: {model: {capture_validity: "valid_live_capture"}}})), false);
    assert.equal(isLikelyNonLiveRankingRow(row("b", {raw_json: {model: {authenticity_status: "likely_non_live_source"}}})), true);
    assert.equal(isLikelyNonLiveRankingRow(row("c", {raw_json: {model: {capture_validity: "likely_non_live_source"}}})), true);
    assert.equal(isLikelyNonLiveRankingRow(row("d")), false);
});
