import {NextRequest, NextResponse} from "next/server";
import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";

/**
 * Classify (GET) or terminalize (POST) undurable capture/media residue.
 *
 * GET is a report. POST requires {confirm: true} and only closes rows whose
 * source media is proven missing or whose queue is retrying a permanent
 * client-media failure. Videos awaiting client frames are reported, not failed.
 */

function config() {
    const url = getSupabaseUrl();
    const key = getSupabaseServiceKey();
    if (!url || !key) throw new Error("Supabase maintenance access is not configured");
    return {url, key};
}

async function repair(apply: boolean) {
    const {url, key} = config();
    const response = await fetch(`${url}/rest/v1/rpc/repair_undurable_pipeline_residue`, {
        method: "POST",
        headers: getSupabaseHeaders(key, {"Content-Type": "application/json", Accept: "application/json"}),
        cache: "no-store",
        body: JSON.stringify({p_apply: apply})
    });
    if (!response.ok) throw new Error(`repair_undurable_pipeline_residue failed (${response.status}): ${await response.text()}`);
    return response.json();
}

export async function GET(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) {
        return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    }
    try {
        return NextResponse.json({ok: true, ...(await repair(false))});
    } catch (error) {
        return NextResponse.json({
            ok: false,
            error: error instanceof Error ? error.message : "Unable to classify pipeline residue"
        }, {status: 500});
    }
}

export async function POST(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) {
        return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    }
    const body = await request.json().catch(() => ({})) as {confirm?: boolean};
    if (!body.confirm) {
        return NextResponse.json({ok: false, error: "Confirm the repair before it runs"}, {status: 400});
    }
    try {
        return NextResponse.json({ok: true, ...(await repair(true))});
    } catch (error) {
        return NextResponse.json({
            ok: false,
            error: error instanceof Error ? error.message : "Unable to repair pipeline residue"
        }, {status: 500});
    }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
