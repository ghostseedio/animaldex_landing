import assert from "node:assert/strict";
import {after, before, describe, it} from "node:test";

/**
 * Acts like a malicious signed-in user and proves the database refuses.
 *
 * Every assertion here corresponds to something that was actually possible
 * before this work, and most of it was observed in production on 2026-09-25:
 * a capture dated ten days before its own account, one JPEG submitted twelve
 * times, Bangkok's Wikipedia coordinate recorded as a 5 m device GPS fix.
 *
 * The tests use a real Supabase user rather than the service role, because the
 * service role bypasses RLS and would pass everything. The user is created and
 * deleted here; no production account or capture is touched.
 *
 * Skips when credentials are absent so local runs and forks are not blocked;
 * the wiring test in database-privilege-contract.test.ts asserts CI has them.
 */

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY;
const configured = Boolean(url && serviceKey && anonKey);

type Ctx = {userId: string; token: string; email: string};
let ctx: Ctx | null = null;
let victim: {userId: string; captureId: string} | null = null;

function admin(path: string, init: RequestInit = {}) {
    return fetch(`${url}${path}`, {
        ...init,
        headers: {apikey: serviceKey!, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", ...(init.headers ?? {})}
    });
}

/** A request as the malicious user: their own JWT, never the service role. */
function asUser(path: string, init: RequestInit = {}) {
    return fetch(`${url}${path}`, {
        ...init,
        headers: {apikey: anonKey!, Authorization: `Bearer ${ctx!.token}`, "Content-Type": "application/json", ...(init.headers ?? {})}
    });
}

function anonymously(path: string, init: RequestInit = {}) {
    return fetch(`${url}${path}`, {
        ...init,
        headers: {apikey: anonKey!, Authorization: `Bearer ${anonKey}`, "Content-Type": "application/json", ...(init.headers ?? {})}
    });
}

async function createUser(tag: string): Promise<{userId: string; token: string; email: string}> {
    const email = `sectest+${tag}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@animaldex-test.invalid`;
    const password = `Test!${Math.random().toString(36).slice(2, 12)}Aa1`;
    const created = await admin("/auth/v1/admin/users", {
        method: "POST",
        body: JSON.stringify({email, password, email_confirm: true})
    });
    if (!created.ok) throw new Error(`could not create test user: ${created.status} ${await created.text()}`);
    const userId = (await created.json()).id as string;

    const signedIn = await fetch(`${url}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: {apikey: anonKey!, "Content-Type": "application/json"},
        body: JSON.stringify({email, password})
    });
    if (!signedIn.ok) throw new Error(`could not sign in test user: ${signedIn.status}`);
    return {userId, token: (await signedIn.json()).access_token as string, email};
}

/** A refusal is any non-2xx. The specific code varies by mechanism. */
function refused(status: number) {
    return status < 200 || status >= 300;
}

describe("capture authority — malicious signed-in user", {skip: configured ? false : "Supabase credentials not set"}, () => {
    before(async () => {
        ctx = await createUser("attacker");
        const other = await createUser("victim");
        const made = await fetch(`${url}/rest/v1/rpc/create_capture_v1`, {
            method: "POST",
            headers: {apikey: anonKey!, Authorization: `Bearer ${other.token}`, "Content-Type": "application/json"},
            body: JSON.stringify({p_capture_mode: "photo"})
        });
        victim = {userId: other.userId, captureId: made.ok ? await made.json() : ""};
    });

    after(async () => {
        for (const id of [ctx?.userId, victim?.userId].filter(Boolean)) {
            await admin(`/auth/v1/admin/users/${id}`, {method: "DELETE"});
        }
    });

    it("cannot insert a capture that is already ready, skipping analysis and the charge", async () => {
        const response = await asUser("/rest/v1/captures", {
            method: "POST",
            body: JSON.stringify({user_id: ctx!.userId, status: "ready"})
        });
        assert.ok(refused(response.status), `expected refusal, got ${response.status} ${await response.text()}`);
    });

    it("cannot choose its own analysis_credit_cost", async () => {
        const response = await asUser("/rest/v1/captures", {
            method: "POST",
            body: JSON.stringify({user_id: ctx!.userId, status: "pending", analysis_credit_cost: 0})
        });
        assert.ok(refused(response.status), `expected refusal, got ${response.status}`);
    });

    it("cannot mint a species by inserting its own analysis_results", async () => {
        const capture = await asUser("/rest/v1/rpc/create_capture_v1", {
            method: "POST",
            body: JSON.stringify({p_capture_mode: "photo"})
        });
        assert.equal(capture.status, 200, "create_capture_v1 should work for a normal user");
        const captureId = await capture.json();

        const response = await asUser("/rest/v1/analysis_results", {
            method: "POST",
            body: JSON.stringify({
                capture_id: captureId,
                scientific_name: "Panthera uncia",
                animal_name: "Snow Leopard",
                capture_grade: 5,
                model_version: "gemini-2.5-flash",
                completed_at: new Date().toISOString()
            })
        });
        assert.ok(refused(response.status), `expected refusal, got ${response.status} ${await response.text()}`);
    });

    it("cannot backdate a capture before its own account existed", async () => {
        const captureId = await (await asUser("/rest/v1/rpc/create_capture_v1", {
            method: "POST",
            body: JSON.stringify({p_capture_mode: "photo", p_captured_at: "2020-01-01T00:00:00Z"})
        })).json();

        const rows = await (await admin(`/rest/v1/captures?id=eq.${captureId}&select=captured_at,created_at`)).json();
        const capturedAt = new Date(rows[0].captured_at).getTime();
        const floor = Date.now() - 2 * 24 * 60 * 60 * 1000;
        assert.ok(capturedAt >= floor, `captured_at was not clamped: ${rows[0].captured_at}`);
    });

    it("cannot assert trusted device GPS evidence on a capture", async () => {
        const captureId = await (await asUser("/rest/v1/rpc/create_capture_v1", {
            method: "POST",
            body: JSON.stringify({p_capture_mode: "photo", p_location_lat: 13.7563, p_location_lng: 100.5018})
        })).json();

        const rows = await (await admin(`/rest/v1/captures?id=eq.${captureId}&select=location_evidence_source,location_accuracy_m`)).json();
        assert.notEqual(rows[0].location_evidence_source, "device_gps", "an inserted coordinate must not count as device evidence");
        assert.equal(rows[0].location_accuracy_m, null);
    });

    it("records a coarse coordinate as a provenance signal", async () => {
        const captureId = await (await asUser("/rest/v1/rpc/create_capture_v1", {
            method: "POST",
            body: JSON.stringify({p_capture_mode: "photo", p_location_lat: 13.7563, p_location_lng: 100.5018})
        })).json();
        const events = await (await admin(`/rest/v1/capture_provenance_events?capture_id=eq.${captureId}&select=kind`)).json();
        assert.ok(
            events.some((e: {kind: string}) => e.kind === "low_precision_coordinate"),
            "a four-decimal coordinate should be recorded as low_precision_coordinate"
        );
    });

    it("cannot attach media owned by another user", async () => {
        const captureId = await (await asUser("/rest/v1/rpc/create_capture_v1", {
            method: "POST",
            body: JSON.stringify({p_capture_mode: "photo"})
        })).json();

        const response = await asUser("/rest/v1/rpc/attach_capture_image_v1", {
            method: "POST",
            body: JSON.stringify({
                p_capture_id: captureId,
                p_storage_bucket: "captures",
                p_storage_path: `${victim!.userId}/someone-elses/primary.jpg`,
                p_mime_type: "image/jpeg"
            })
        });
        assert.ok(refused(response.status), "a storage path under another user's folder must be refused");
        assert.match(await response.text(), /storage_path_not_owned/);
    });

    it("cannot attach a capture it does not own", async () => {
        if (!victim?.captureId) return;
        const response = await asUser("/rest/v1/rpc/attach_capture_image_v1", {
            method: "POST",
            body: JSON.stringify({
                p_capture_id: victim.captureId,
                p_storage_bucket: "captures",
                p_storage_path: `${ctx!.userId}/x/primary.jpg`,
                p_mime_type: "image/jpeg"
            })
        });
        assert.ok(refused(response.status), "another user's capture must be refused");
        assert.match(await response.text(), /capture_not_owned/);
    });

    it("cannot copy a Discover capture that is not published", async () => {
        if (!victim?.captureId) return;
        const response = await asUser("/rest/v1/rpc/save_discover_capture_v1", {
            method: "POST",
            body: JSON.stringify({p_source_capture_id: victim.captureId})
        });
        assert.ok(refused(response.status), "an unpublished source must be refused");
        assert.match(await response.text(), /source_capture_not_available/);
    });

    it("forces manual saves to manual provenance and refuses forged model output", async () => {
        const captureId = await (await asUser("/rest/v1/rpc/save_manual_capture_v1", {
            method: "POST",
            body: JSON.stringify({p_animal_name: "Garden Snail", p_scientific_name: "Cornu aspersum"})
        })).json();

        const rows = await (await admin(
            `/rest/v1/analysis_results?capture_id=eq.${captureId}&select=model_version,capture_grade,game_stats,credits_charged`
        )).json();
        assert.equal(rows[0].model_version, "client_manual_v1", "manual saves must not claim a model identity");
        assert.equal(rows[0].capture_grade, null, "grade must be earned from a real analysis");
        assert.equal(rows[0].game_stats, null, "game stats reach Arena and must not be self-assigned");
        assert.equal(rows[0].credits_charged, 0);
    });

    it("cannot request analysis on another user's capture", async () => {
        if (!victim?.captureId) return;
        const response = await asUser("/rest/v1/rpc/request_capture_analysis_v1", {
            method: "POST",
            body: JSON.stringify({p_capture_id: victim.captureId})
        });
        assert.ok(refused(response.status));
        assert.match(await response.text(), /capture_not_owned/);
    });

    it("is idempotent when the same capture is created twice", async () => {
        const clientId = crypto.randomUUID();
        const first = await (await asUser("/rest/v1/rpc/create_capture_v1", {
            method: "POST",
            body: JSON.stringify({p_capture_mode: "photo", p_client_capture_id: clientId})
        })).json();
        const second = await (await asUser("/rest/v1/rpc/create_capture_v1", {
            method: "POST",
            body: JSON.stringify({p_capture_mode: "photo", p_client_capture_id: clientId})
        })).json();
        assert.equal(first, second, "a replayed create must return the original capture, not a duplicate");
    });
});

describe("privileged RPCs are unreachable anonymously", {skip: configured ? false : "Supabase credentials not set"}, () => {
    for (const fn of [
        "credit_balance_grant",
        "apply_app_store_purchase",
        "upsert_capture_analysis_result",
        "refresh_animaldex_pro_entitlement",
        "create_capture_v1",
        "save_manual_capture_v1",
        "attach_capture_image_v1",
        "request_capture_analysis_v1"
    ]) {
        it(`refuses ${fn} to an anonymous caller`, async () => {
            const response = await anonymously(`/rest/v1/rpc/${fn}`, {method: "POST", body: "{}"});
            assert.ok(refused(response.status), `${fn} answered ${response.status} to anon`);
        });
    }
});
