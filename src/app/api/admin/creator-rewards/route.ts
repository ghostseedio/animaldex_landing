import {NextRequest, NextResponse} from "next/server";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";
import {mapCreatorRewardConfig} from "@/lib/creator-rewards";
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
        const periodId = request.nextUrl.searchParams.get("periodId");
        if (periodId) {
            const detail = await rpc("admin_get_creator_reward_period_detail", {
                p_period_id: periodId,
            });
            return NextResponse.json(scrub({detail}));
        }

        const [configRaw, periods, formula, identity] = await Promise.all([
            rpc("get_creator_reward_config"),
            rpc("admin_list_creator_reward_period_summaries"),
            rpc("get_creator_reward_formula_summary", {
                p_calculation_version: "creator_rewards_v1_calibrated",
            }).catch(() => null),
            rpc("get_animaldex_environment_identity").catch(() => null),
        ]);
        const config = mapCreatorRewardConfig(
            configRaw && typeof configRaw === "object" ? (configRaw as Record<string, unknown>) : {}
        );
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
            nextStep: nextStepForPeriodStatus(String(p.status ?? "")),
            why: whyForPeriodStatus(String(p.status ?? "")),
        }));
        const formulaMapped = formula
            ? {
                  calculationVersion: String(formula.calculation_version ?? ""),
                  weights: formula.weights ?? undefined,
                  socialCapBps:
                      typeof formula.social_cap_bps === "number" ? formula.social_cap_bps : undefined,
                  minAllocationAmountMinor:
                      typeof formula.min_allocation_amount_minor === "number"
                          ? formula.min_allocation_amount_minor
                          : undefined,
                  firewalls: Array.isArray(formula.firewalls) ? formula.firewalls : undefined,
                  notes: typeof formula.notes === "string" ? formula.notes : undefined,
              }
            : null;
        return NextResponse.json(
            scrub({
                config: {
                    enabled: config.enabled,
                    autoPostEarnings: config.autoPostEarnings,
                    environment: config.environment,
                },
                identity,
                periods: mapped,
                formula: formulaMapped,
                playbook: CREATOR_REWARDS_ADMIN_PLAYBOOK,
            })
        );
    } catch (e) {
        return NextResponse.json({error: e instanceof Error ? e.message : "Failed"}, {status: 400});
    }
}

function nextStepForPeriodStatus(status: string): string {
    switch (status) {
        case "draft":
            return "Open the period when you want contribution scoring to begin.";
        case "open":
            return "When the window ends, Freeze to lock inputs for calculation.";
        case "frozen":
            return "Run Calculate to create individual allocations from the formula.";
        case "calculated":
            return "Review individuals below, then Finalize to lock the money split.";
        case "finalized":
            return "Post to Earnings (or rely on auto_post if enabled) so creators get Pending balances.";
        case "posted":
            return "Creators now have Earnings. Pay Available balances via /admin/payouts (manual finance).";
        case "cancelled":
            return "No further action. Start a new period if needed.";
        default:
            return "Review period status and follow the lifecycle playbook.";
    }
}

function whyForPeriodStatus(status: string): string {
    switch (status) {
        case "draft":
            return "Drafts are planning records. They do not score creators or create money.";
        case "open":
            return "Open periods collect contribution signals (captures, quality, gifts-as-events).";
        case "frozen":
            return "Freeze stops intake so Calculate is deterministic and auditable.";
        case "calculated":
            return "Calculated allocations are proposals — not yet final money and not bank payouts.";
        case "finalized":
            return "Finalized locks shares. Posting creates Earnings obligations (still not a bank transfer).";
        case "posted":
            return "Posted = Earnings ledger only. Wise bank payouts are a separate finance step.";
        default:
            return "Each status is an auditable lifecycle gate.";
    }
}

const CREATOR_REWARDS_ADMIN_PLAYBOOK = [
    {
        title: "1. Create & open a period",
        body: "Set pool, dates, and formula. Opening starts contribution scoring. This does not pay anyone.",
    },
    {
        title: "2. Freeze → Calculate",
        body: "Freeze locks inputs. Calculate shows each creator’s share. Review individuals before continuing.",
    },
    {
        title: "3. Finalize → Post to Earnings",
        body: "Finalize locks the split. Post creates Pending Earnings. With auto_post_earnings=true, finalize may post automatically.",
    },
    {
        title: "4. Pay via /admin/payouts",
        body: "Payouts are NOT automatic. After Available Earnings + bank setup, finance manually approves a Wise transfer. Target SLA: 14 days after Available.",
    },
];

export async function POST(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) {
        return NextResponse.json({error: "Unauthorized"}, {status: 401});
    }
    try {
        const body = await request.json().catch(() => ({}));
        const action = String(body.action ?? "");
        const periodId = String(body.periodId ?? "");

        const configRaw = await rpc("get_creator_reward_config");
        const config = mapCreatorRewardConfig(
            configRaw && typeof configRaw === "object" ? (configRaw as Record<string, unknown>) : {}
        );
        const envLabel = (config.environment?.environmentLabel ?? "unknown").toUpperCase();
        const projectRef = config.environment?.supabaseProjectRef ?? "unknown";

        if (action === "create") {
            const slug = String(body.slug ?? "");
            const displayName = String(body.displayName ?? "");
            const looksLikeTest =
                /staging|test[_-]?only|fixture|local[_-]?dev/i.test(slug) ||
                /STAGING|TEST ONLY|fixture/i.test(displayName);
            if (config.environment?.isProduction && looksLikeTest) {
                return NextResponse.json(
                    {
                        error: `Refusing test/staging period create on PRODUCTION (${projectRef}).`,
                    },
                    {status: 403}
                );
            }
            const result = await rpc("admin_create_creator_reward_period", {
                p_slug: slug,
                p_display_name: displayName,
                p_currency_code: String(body.currencyCode ?? "USD"),
                p_pool_amount_minor: Number(body.poolAmountMinor ?? 0),
                p_period_start: String(body.periodStart ?? ""),
                p_period_end: String(body.periodEnd ?? ""),
                p_notes: typeof body.notes === "string" ? body.notes : null,
                p_calculation_version: String(body.calculationVersion ?? "creator_rewards_v1_calibrated"),
                p_eligibility_version: String(body.eligibilityVersion ?? "eligibility_v1"),
                p_risk_version: String(body.riskVersion ?? "risk_v1"),
                p_min_allocation_amount_minor: Number(body.minAllocationAmountMinor ?? 50),
                p_social_cap_bps: Number(body.socialCapBps ?? 1500),
            });
            return NextResponse.json(scrub({ok: true, message: `draft created (${envLabel})`, result}));
        }

        const map: Record<string, string> = {
            open: "admin_open_creator_reward_period",
            freeze: "freeze_creator_reward_period_inputs",
            calculate: "calculate_creator_reward_allocations",
            finalize: "finalize_creator_reward_period",
            post: "post_creator_reward_allocations_to_earnings",
            cancel: "admin_cancel_creator_reward_period",
        };
        const rpcName = map[action];
        if (!rpcName) {
            return NextResponse.json({error: "Unknown action"}, {status: 400});
        }
        const result = await rpc(rpcName, {p_period_id: periodId});
        return NextResponse.json(
            scrub({
                ok: true,
                message: `${action} ok on ${envLabel} (${projectRef})`,
                result,
            })
        );
    } catch (e) {
        return NextResponse.json({error: e instanceof Error ? e.message : "Failed"}, {status: 400});
    }
}
