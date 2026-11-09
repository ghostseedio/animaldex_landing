import {NextResponse} from "next/server";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {invokeAuthenticatedSupabaseFunctionResponse} from "@/lib/supabase/app-functions";
import {
    arkDiaryVisibility,
    arkProblemCode,
    cleanArkSummary,
    decodeArkChange,
    decodeArkChanges,
    decodeArkStats
} from "@/lib/ark";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Life Sim: Ark Score (AnimalDex docs/life-sim/CONTRACT.md, section 8), as
 * the signed-in reader. Every RPC acts on auth.uid() (`ark_stats_v1` reads
 * someone else's within the privacy rules of section 7).
 *
 * GET ?view=stats[&userId=]                       `ark_stats_v1`
 * GET ?view=changes[&since=][&speciesProfileId=][&limit=]
 *                                                 `ark_changes_v1`, newest first
 * POST {action: "undo", changeId}                 `undo_ark_revision_v1`
 * POST {action: "visibility", visibility}         `set_diary_visibility_v1`
 * POST {action: "hide", focusId, hidden}          `hide_diary_entry_v1`
 * POST {action: "approve", focusId, text}         `approve_diary_summary_v1`
 * POST {action: "draft", focusId}                 `generate-applied-insight` `diary_public_draft`
 *
 * Until the migration is live the reads answer `available: false` and the
 * screens show without Ark; the writes answer `{ok: false, code}`.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRIVATE = {"Cache-Control": "private, no-store"};

function uuid(value: unknown): string | null {
    return typeof value === "string" && UUID.test(value.trim()) ? value.trim().toLowerCase() : null;
}

function failed(what: string, message: string) {
    const code = arkProblemCode(message);
    if (code === "ark_unavailable") console.warn(`[ark] ${what} failed`, message.slice(0, 200));
    return NextResponse.json({ok: false, code}, {status: code === "ark_unavailable" ? 502 : code === "not_authenticated" ? 401 : 400});
}

export async function GET(request: Request) {
    const supabase = createSupabaseServerClient();
    if (!supabase) return NextResponse.json({error: "Supabase is not configured."}, {status: 503});
    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return NextResponse.json({error: "Authentication required."}, {status: 401});

    const params = new URL(request.url).searchParams;
    if (params.get("view") === "stats") {
        const raw = params.get("userId");
        const userId = raw === null ? null : uuid(raw);
        if (raw !== null && !userId) return NextResponse.json({error: "A user id is required."}, {status: 400});
        const {data, error} = await supabase.rpc("ark_stats_v1", {p_user_id: userId});
        if (error) {
            console.warn("[ark] ark_stats_v1 failed", error.message.slice(0, 200));
            return NextResponse.json({stats: null, available: false}, {headers: PRIVATE});
        }
        return NextResponse.json({stats: decodeArkStats(data), available: true}, {headers: PRIVATE});
    }

    const since = params.get("since");
    const sinceAt = since && !Number.isNaN(Date.parse(since)) ? new Date(since).toISOString() : null;
    const speciesProfileId = uuid(params.get("speciesProfileId"));
    const limit = Math.max(1, Math.min(100, Number.parseInt(params.get("limit") ?? "50", 10) || 50));
    const {data, error} = await supabase.rpc("ark_changes_v1", {
        p_since: sinceAt,
        p_species_profile_id: speciesProfileId,
        p_limit: limit
    });
    if (error) {
        console.warn("[ark] ark_changes_v1 failed", error.message.slice(0, 200));
        return NextResponse.json({changes: [], available: false}, {headers: PRIVATE});
    }
    return NextResponse.json({changes: decodeArkChanges(data), available: true}, {headers: PRIVATE});
}

export async function POST(request: Request) {
    const supabase = createSupabaseServerClient();
    if (!supabase) return NextResponse.json({error: "Supabase is not configured."}, {status: 503});
    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return NextResponse.json({error: "Authentication required."}, {status: 401});

    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const action = typeof body.action === "string" ? body.action : "";

    if (action === "undo") {
        const changeId = uuid(body.changeId);
        if (!changeId) return NextResponse.json({ok: false, code: "change_not_found"}, {status: 400});
        const {data, error} = await supabase.rpc("undo_ark_revision_v1", {p_change_id: changeId});
        if (error) return failed("undo_ark_revision_v1", error.message);
        const row = data && typeof data === "object" ? data as Record<string, unknown> : null;
        return NextResponse.json({ok: true, change: decodeArkChange(row?.change ?? row)});
    }

    if (action === "visibility") {
        const visibility = arkDiaryVisibility(body.visibility);
        if (!visibility) return NextResponse.json({ok: false, code: "invalid_visibility"}, {status: 400});
        const {error} = await supabase.rpc("set_diary_visibility_v1", {p_visibility: visibility});
        if (error) return failed("set_diary_visibility_v1", error.message);
        return NextResponse.json({ok: true, visibility});
    }

    if (action === "hide") {
        const focusId = uuid(body.focusId);
        if (!focusId || typeof body.hidden !== "boolean") return NextResponse.json({ok: false, code: "focus_not_found"}, {status: 400});
        const {error} = await supabase.rpc("hide_diary_entry_v1", {p_focus_id: focusId, p_hidden: body.hidden});
        if (error) return failed("hide_diary_entry_v1", error.message);
        return NextResponse.json({ok: true, hidden: body.hidden});
    }

    if (action === "approve") {
        const focusId = uuid(body.focusId);
        const text = typeof body.text === "string" ? cleanArkSummary(body.text) : "";
        if (!focusId) return NextResponse.json({ok: false, code: "focus_not_found"}, {status: 400});
        if (!text) return NextResponse.json({ok: false, code: "summary_not_safe"}, {status: 400});
        const {error} = await supabase.rpc("approve_diary_summary_v1", {p_focus_id: focusId, p_text: text});
        if (error) return failed("approve_diary_summary_v1", error.message);
        return NextResponse.json({ok: true, text});
    }

    if (action === "draft") {
        const focusId = uuid(body.focusId);
        if (!focusId) return NextResponse.json({ok: false, code: "focus_not_found"}, {status: 400});
        const invoked = await invokeAuthenticatedSupabaseFunctionResponse("generate-applied-insight", {
            action: "diary_public_draft",
            focus_id: focusId
        }).catch(() => null);
        if (!invoked) return NextResponse.json({ok: false, code: "ark_unavailable"}, {status: 502});
        const payload = invoked.payload && typeof invoked.payload === "object" ? invoked.payload as Record<string, unknown> : {};
        if (!invoked.ok) return failed("diary_public_draft", String(payload.error ?? payload.code ?? `status ${invoked.status}`));
        const text = typeof payload.text === "string" ? cleanArkSummary(payload.text) : "";
        // Not safe to share (or nothing came back): it stays private, and the reason is the server's.
        if (payload.public_ok !== true || !text) {
            return NextResponse.json({ok: true, publicOk: false, reason: typeof payload.reason === "string" ? payload.reason.slice(0, 200) : null});
        }
        return NextResponse.json({ok: true, publicOk: true, text});
    }

    return NextResponse.json({ok: false, code: "ark_unavailable"}, {status: 400});
}
