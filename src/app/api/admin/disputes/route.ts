import {NextRequest, NextResponse} from "next/server";
import {createSignedStorageUrl} from "@/lib/capture-storage-image";
import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";
import {isSupportAdminRequestAuthorized, resolveAdminActor} from "@/lib/support-admin-auth";
import {
    captureImageToSign,
    describeResolveError,
    EVIDENCE_BUCKET,
    normalizeStatusFilter,
    parseDecisionRequest,
    type StrikeDispute,
    type StrikeDisputeView,
} from "@/lib/strike-disputes-admin";

/**
 * Strike disputes, for /admin/disputes: GET lists them, POST decides one.
 * Everything goes through the SECURITY DEFINER functions of AnimalDex
 * migration 20261017235500 with the service key; the dispute tables are closed
 * to every role, service_role included.
 */

/** Evidence and the flagged photo are private; the page gets links that last an hour. */
const SIGNED_URL_SECONDS = 60 * 60;

async function rpc(name: string, body: Record<string, unknown>) {
    const url = getSupabaseUrl();
    const key = getSupabaseServiceKey();
    if (!url || !key) return {ok: false as const, status: 500, detail: "Supabase access is not configured"};
    let response: Response;
    try {
        response = await fetch(`${url}/rest/v1/rpc/${name}`, {
            method: "POST",
            headers: getSupabaseHeaders(key, {"Content-Type": "application/json", Accept: "application/json"}),
            body: JSON.stringify(body),
            cache: "no-store",
        });
    } catch (error) {
        return {ok: false as const, status: 502, detail: error instanceof Error ? error.message : "Request failed"};
    }
    if (!response.ok) return {ok: false as const, status: response.status, detail: await response.text()};
    return {ok: true as const, data: (await response.json()) as unknown};
}

async function withSignedUrls(dispute: StrikeDispute): Promise<StrikeDisputeView> {
    const photo = captureImageToSign(dispute);
    const [captureImageUrl, ...evidence] = await Promise.all([
        photo ? createSignedStorageUrl(photo.bucket, photo.path, SIGNED_URL_SECONDS) : Promise.resolve(null),
        ...dispute.evidence.map((item) => createSignedStorageUrl(EVIDENCE_BUCKET, item.path, SIGNED_URL_SECONDS)),
    ]);
    return {
        ...dispute,
        captureImageUrl,
        evidenceUrls: Object.fromEntries(dispute.evidence.map((item, index) => [item.id, evidence[index] ?? null])),
    };
}

export async function GET(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) {
        return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    }
    const status = normalizeStatusFilter(request.nextUrl.searchParams.get("status"));
    const result = await rpc("admin_list_strike_disputes", {p_status: status, p_limit: 100, p_offset: 0});
    if (!result.ok) {
        const missing = result.status === 404 || result.detail.includes("admin_list_strike_disputes");
        return NextResponse.json(
            {
                ok: false,
                error: missing
                    ? "Disputes are not installed. Apply AnimalDex migration 20261017235500_strike_disputes.sql."
                    : `Disputes query failed (${result.status}): ${result.detail.slice(0, 300)}`,
            },
            {status: missing ? 503 : 502},
        );
    }
    const payload = result.data as {disputes?: StrikeDispute[]; counts?: Record<string, number>};
    const disputes = await Promise.all((payload.disputes ?? []).map(withSignedUrls));
    return NextResponse.json({ok: true, status, counts: payload.counts ?? {}, disputes, generatedAt: new Date().toISOString()});
}

export async function POST(request: NextRequest) {
    const actor = await resolveAdminActor(request.cookies);
    if (!actor.authorized) {
        return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    }
    const parsed = parseDecisionRequest(await request.json().catch(() => null));
    if (!parsed.ok) return NextResponse.json({ok: false, error: parsed.error}, {status: 400});

    const result = await rpc("admin_resolve_strike_dispute", {
        p_dispute_id: parsed.value.disputeId,
        p_decision: parsed.value.decision,
        p_note: parsed.value.note,
        // Named operators are recorded by email; the shared password as "admin".
        p_actor_email: actor.email ?? "admin",
    });
    if (!result.ok) {
        const conflict = result.detail.includes("dispute_already_decided");
        return NextResponse.json({ok: false, error: describeResolveError(result.detail)}, {status: conflict ? 409 : 502});
    }
    return NextResponse.json({ok: true, dispute: await withSignedUrls(result.data as StrikeDispute)});
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
