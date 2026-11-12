import assert from "node:assert/strict";
import test from "node:test";
import {SupabaseStore} from "../../ark-live/store-supabase";

type Call = {url: string; headers: Record<string, string>; body: Record<string, unknown>};

function fakeFetch(answers: Record<string, unknown>, fail: Set<string> = new Set()) {
    const calls: Call[] = [];
    const f = (async (url: string, init: {headers: Record<string, string>; body: string}) => {
        const name = url.split("/rpc/")[1];
        calls.push({url, headers: init.headers, body: JSON.parse(init.body) as Record<string, unknown>});
        if (fail.has(name)) return {ok: false, status: 503, json: async () => ({})};
        return {ok: true, status: 200, json: async () => answers[name] ?? null};
    }) as unknown as typeof fetch;
    return {f, calls};
}

test("production store: ark-live's calls as the ark_live role, with the contract's parameter names", async () => {
    const {f, calls} = fakeFetch({ark_live_start_v1: {ok: true, animal: {id: "a", slug: "red-fox"}, quota: {}, state: {animal_id: "a", plan: {kind: "stay", legs: []}}}, ark_live_meal_request_v1: {ok: true, id: "m1"}, ark_live_meal_status_v1: {status: "confirmed"}});
    const store = new SupabaseStore({url: "https://example.test/", apiKey: "anon-key", jwt: "ark-live-jwt", fetch: f});
    const started = await store.start({nonce: "n", sessionId: "s", userId: "u", animalId: "a", island: "wild", client: "web", appVersion: null});
    assert.equal(started.ok, true);
    assert.deepEqual(Object.keys(calls[0].body).sort(), ["p_animal_id", "p_app_version", "p_client", "p_island", "p_session_id", "p_ticket_nonce", "p_user_id"]);
    assert.equal(calls[0].url, "https://example.test/rest/v1/rpc/ark_live_start_v1");
    assert.equal(calls[0].headers.authorization, "Bearer ark-live-jwt");
    assert.equal(calls[0].headers.apikey, "anon-key");
    assert.equal((await store.stateOf("a"))?.plan.kind, "stay", "the start's record is kept for the session's release");
    await store.heartbeat(["s"]);
    assert.deepEqual(calls[1].body, {p_session_ids: ["s"]});
    await store.end("s", "player", {distance_m: 1, max_speed: 1, rejections: 0, clamped: 0, dropped: 0, client: null, app_version: null}, {island: "wild", released_at: "x", release: {x: 0, y: 0, z: 0, yaw: 0, mode: "ground", band: null}, plan: {kind: "stay", legs: [], settle_at: null, settle: null}, zone: null, stranded_from: null, stamina: 1, exposure: 0, crossed: null, home: null});
    assert.deepEqual(Object.keys(calls[2].body).sort(), ["p_reason", "p_session_id", "p_state", "p_stats"]);
    assert.deepEqual(await store.mealRequest("s", "a", "b", {at: 1}), {ok: true, id: "m1"});
    assert.deepEqual(Object.keys(calls[3].body).sort(), ["p_evidence", "p_predator_id", "p_prey_id", "p_session_id"]);
    assert.equal((await store.mealStatus("m1")).status, "confirmed");
});

test("production store: traces that fail are kept and sent with the next batch (up to 10 minutes)", async () => {
    let now = 0;
    const fail = new Set(["ark_live_trace_v1"]);
    const {f, calls} = fakeFetch({ark_live_trace_v1: 1}, fail);
    const store = new SupabaseStore({url: "https://example.test", apiKey: "k", jwt: "j", fetch: f, now: () => now});
    const row = (step: number) => ({animal_id: "a", step, island: "wild", x: 0, z: 0, y: 0, mode: "ground" as const, band: null});
    await store.trace([row(1)]);
    now += 60_000;
    fail.delete("ark_live_trace_v1");
    await store.trace([row(2)]);
    assert.deepEqual((calls[1].body.p_rows as Array<{step: number}>).map((r) => r.step), [1, 2]);
    now += 60_000;
    fail.add("ark_live_trace_v1");
    await store.trace([row(3)]);
    now += 11 * 60_000;
    fail.delete("ark_live_trace_v1");
    await store.trace([row(4)]);
    assert.deepEqual((calls[3].body.p_rows as Array<{step: number}>).map((r) => r.step), [4], "a sample older than 10 minutes is dropped");
});
