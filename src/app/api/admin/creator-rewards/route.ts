import {NextRequest, NextResponse} from "next/server";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";
import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const FORBIDDEN = ["service_role", "serviceRole", "apikey", "api_key", "password", "secret", "token", "access_token", "refresh_token", "latitude", "longitude", "gps", "email"];

function scrub(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(scrub);
    if (!value || typeof value !== "object") return value;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (FORBIDDEN.includes(k) || FORBIDDEN.includes(k.toLowerCase())) continue;
        out[k] = scrub(v);
    }
    return out;
}

async function rpc(name: string, body: Record<string, unknown> = {}) {
    const url = getSupabaseUrl();
    const key = getSupabaseServiceKey();
    if (!url || !key) throw new Error("Supabase is not configured");
    const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
        method: "POST",
        headers: getSupabaseHeaders(key, {"Content-Type": "application/json", Accept: "application/json"}),
        body: JSON.stringify(body),
        cache: "no-store",
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        const message = typeof payload?.message === "string" ? payload.message : `${name} failed`;
        throw new Error(message);
    }
    return payload;
}

export async function GET(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) {
        return NextResponse.json({error: "Unauthorized"}, {status: 401});
    }
    try {
        const [config, periods] = await Promise.all([
            rpc("get_creator_reward_config"),
            rpc("admin_list_creator_reward_period_summaries"),
        ]);
        const mapped = (Array.isArray(periods) ? periods : []).map((p: Record<string, unknown>) => ({
            periodId: String(p.period_id ?? ""),
            slug: String(p.slug ?? ""),
            displayName: String(p.display_name ?? ""),
            currencyCode: String(p.currency_code ?? ""),
            poolAmountMinor: Number(p.pool_amount_minor ?? 0),
            periodStart: String(p.period_start ?? ""),
            periodEnd: String(p.period_end ?? ""),
            status: String(p.status ?? ""),
            eligibleCreatorCount: Number(p.eligible_creator_count ?? 0),
            allocatedAmountMinor: Number(p.allocated_amount_minor ?? 0),
            unallocatedRemainderMinor: Number(p.unallocated_remainder_minor ?? 0),
            calculationVersion: String(p.calculation_version ?? ""),
        }));
        return NextResponse.json(scrub({
            config: {
                enabled: Boolean(config?.enabled),
                autoPostEarnings: Boolean(config?.auto_post_earnings),
            },
            periods: mapped,
        }));
    } catch (e) {
        return NextResponse.json({error: e instanceof Error ? e.message : "Failed"}, {status: 400});
    }
}

export async function POST(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) {
        return NextResponse.json({error: "Unauthorized"}, {status: 401});
    }
    try {
        const body = await request.json().catch(() => ({}));
        const action = String(body.action ?? "");
        const periodId = String(body.periodId ?? "");
        const map: Record<string, string> = {
            open: "admin_open_creator_reward_period",
            freeze: "freeze_creator_reward_period_inputs",
            calculate: "calculate_creator_reward_allocations",
            finalize: "finalize_creator_reward_period",
            post: "post_creator_reward_allocations_to_earnings",
            cancel: "admin_cancel_creator_reward_period",
        };
        const rpcName = map[action];
        if (!rpcName) return NextResponse.json({error: "Unknown action"}, {status: 400});
        if (!periodId) return NextResponse.json({error: "periodId required"}, {status: 400});
        const result = await rpc(rpcName, {p_period_id: periodId});
        return NextResponse.json(scrub({ok: true, message: `${action} completed`, result}));
    } catch (e) {
        return NextResponse.json({error: e instanceof Error ? e.message : "Failed"}, {status: 400});
    }
}
