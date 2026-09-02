import {NextResponse} from "next/server";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {invokeAuthenticatedSupabaseFunctionResponse} from "@/lib/supabase/app-functions";
import {
    IMPORT_SETTING_TAGS,
    isAllowedInstagramMediaHost,
    pickInstagramConnection,
    type ImportSettingTag
} from "@/lib/instagram-import";

export const dynamic = "force-dynamic";

type ImportAction =
    | "oauth-start"
    | "scan"
    | "screen"
    | "frame-targets"
    | "frame-screen"
    | "media-refresh"
    | "materialize"
    | "candidates"
    | "active-operation"
    | "rescreen-job"
    | "complete-operation"
    | "pause-operation"
    | "cancel-operation"
    | "quote-operation"
    | "accept-quote"
    | "quote-materialization"
    | "accept-materialization"
    | "settle-materialization"
    | "confirm-location"
    | "skip-location"
    | "set-species"
    | "attest";

function jsonError(message: string, status = 400) {
    return NextResponse.json({error: message}, {status});
}

async function requireUser() {
    const supabase = createSupabaseServerClient();
    if (!supabase) return {error: jsonError("Supabase is not configured.", 503)} as const;
    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return {error: jsonError("Authentication required.", 401)} as const;
    return {supabase, user} as const;
}

function importBusyResponse(payload: {retry_after_ms?: number; error?: string}) {
    const retryAfterMs = Math.max(1000, Number(payload.retry_after_ms ?? 4000));
    return NextResponse.json({
        error: payload.error || "import_stage_busy",
        retryable: true,
        retry_after_ms: retryAfterMs
    }, {
        status: 429,
        headers: {"Retry-After": String(Math.ceil(retryAfterMs / 1000))}
    });
}

async function invokeImportFunction(name: string, body: unknown) {
    try {
        const invoked = await invokeAuthenticatedSupabaseFunctionResponse(name, body);
        if (invoked.status === 429 || invoked.payload?.error === "import_stage_busy") {
            return {ok: false as const, busy: true as const, payload: invoked.payload};
        }
        if (!invoked.ok) {
            return {
                ok: false as const,
                busy: false as const,
                message: String(invoked.payload?.message || invoked.payload?.error || "The request failed.")
            };
        }
        return {ok: true as const, payload: invoked.payload};
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {ok: false as const, busy: false as const, message};
    }
}

function settingTag(value: unknown): ImportSettingTag {
    return IMPORT_SETTING_TAGS.includes(value as ImportSettingTag) ? value as ImportSettingTag : "Wild";
}

export async function GET() {
    const auth = await requireUser();
    if ("error" in auth) return auth.error;

    const [connectionsRes, ] = await Promise.all([
        auth.supabase.rpc("list_external_account_connections")
    ]);
    if (connectionsRes.error) return jsonError(connectionsRes.error.message);

    const connections = Array.isArray(connectionsRes.data) ? connectionsRes.data : [];
    const connection = pickInstagramConnection(connections);

    let operation = null;
    let candidates: unknown[] = [];
    if (connection?.connection_id) {
        const [operationRes, candidatesRes] = await Promise.all([
            auth.supabase.rpc("get_active_external_import_operation", {
                p_connection_id: connection.connection_id
            }),
            auth.supabase.rpc("list_external_import_candidates", {
                p_connection_id: connection.connection_id,
                p_review_state: null,
                p_limit: 100,
                p_offset: 0
            })
        ]);
        if (!operationRes.error) operation = operationRes.data ?? null;
        if (!candidatesRes.error && Array.isArray(candidatesRes.data)) candidates = candidatesRes.data;
    }

    return NextResponse.json({connection, operation, candidates, connections});
}

export async function POST(request: Request) {
    const auth = await requireUser();
    if ("error" in auth) return auth.error;

    let body: Record<string, unknown>;
    try {
        body = await request.json() as Record<string, unknown>;
    } catch {
        return jsonError("Invalid request.");
    }

    const action = String(body.action ?? "") as ImportAction;

    switch (action) {
        case "oauth-start": {
            const forceReauth = body.forceReauth !== false;
            const name = forceReauth ? "instagram-oauth-start?force_reauth=true" : "instagram-oauth-start";
            const origin = new URL(request.url).origin;
            const invoked = await invokeImportFunction(name, {
                return_to: typeof body.returnTo === "string" ? body.returnTo : `${origin}/app/import/instagram`
            });
            if (!invoked.ok) {
                if (invoked.busy) return importBusyResponse(invoked.payload);
                return jsonError(invoked.message, 400);
            }
            return NextResponse.json(invoked.payload);
        }
        case "scan": {
            const invoked = await invokeImportFunction("instagram-import-scan", {
                ...(typeof body.jobId === "string" ? {job_id: body.jobId} : {}),
                ...(typeof body.cursor === "string" ? {cursor: body.cursor} : {})
            });
            if (!invoked.ok) {
                if (invoked.busy) return importBusyResponse(invoked.payload);
                return jsonError(invoked.message, 409);
            }
            return NextResponse.json(invoked.payload);
        }
        case "screen": {
            const invoked = await invokeImportFunction("instagram-candidate-screen", {
                connection_id: body.connectionId,
                job_id: body.jobId,
                billing_contract_version: 2,
                limit: body.limit ?? 8
            });
            if (!invoked.ok) {
                if (invoked.busy) return importBusyResponse(invoked.payload);
                return jsonError(invoked.message, 409);
            }
            return NextResponse.json(invoked.payload);
        }
        case "frame-targets": {
            const invoked = await invokeImportFunction("instagram-frame-targets", {
                connection_id: body.connectionId,
                job_id: body.jobId,
                billing_contract_version: 2,
                ...(typeof body.cursor === "string" ? {cursor: body.cursor} : {}),
                limit: body.limit ?? 5
            });
            if (!invoked.ok) {
                if (invoked.busy) return importBusyResponse(invoked.payload);
                return jsonError(invoked.message, 409);
            }
            return NextResponse.json(invoked.payload);
        }
        case "frame-screen": {
            const invoked = await invokeImportFunction("instagram-frame-screen", {
                candidate_id: body.candidateId,
                job_id: body.jobId,
                billing_contract_version: 2,
                frames: body.frames,
                extraction: body.extraction
            });
            if (!invoked.ok) {
                if (invoked.busy) return importBusyResponse(invoked.payload);
                return jsonError(invoked.message, 409);
            }
            return NextResponse.json(invoked.payload);
        }
        case "media-refresh": {
            const invoked = await invokeImportFunction("instagram-media-refresh", {
                candidate_id: body.candidateId
            });
            if (!invoked.ok) {
                if (invoked.busy) return importBusyResponse(invoked.payload);
                return jsonError(invoked.message, 409);
            }
            return NextResponse.json(invoked.payload);
        }
        case "materialize": {
            const invoked = await invokeImportFunction("instagram-import-materialize", {
                candidate_id: body.candidateId,
                billing_contract_version: 2
            });
            if (!invoked.ok) {
                if (invoked.busy) return importBusyResponse(invoked.payload);
                return jsonError(invoked.message, 409);
            }
            return NextResponse.json(invoked.payload);
        }
        case "candidates": {
            const {data, error} = await auth.supabase.rpc("list_external_import_candidates", {
                p_connection_id: body.connectionId,
                p_review_state: null,
                p_limit: 100,
                p_offset: 0
            });
            if (error) return jsonError(error.message);
            return NextResponse.json({candidates: data ?? []});
        }
        case "active-operation": {
            const {data, error} = await auth.supabase.rpc("get_active_external_import_operation", {
                p_connection_id: body.connectionId
            });
            if (error) return jsonError(error.message);
            return NextResponse.json({operation: data ?? null});
        }
        case "rescreen-job": {
            const {data, error} = await auth.supabase.rpc("create_external_import_rescreen_job", {
                p_connection_id: body.connectionId
            });
            if (error) return jsonError(error.message);
            return NextResponse.json({jobId: data});
        }
        case "complete-operation": {
            const {data, error} = await auth.supabase.rpc("complete_external_import_operation", {
                p_job_id: body.jobId
            });
            if (error) return jsonError(error.message);
            return NextResponse.json({jobId: data});
        }
        case "pause-operation": {
            const {data, error} = await auth.supabase.rpc("pause_external_import_operation", {
                p_job_id: body.jobId
            });
            if (error) return jsonError(error.message);
            return NextResponse.json({jobId: data});
        }
        case "cancel-operation": {
            const {data, error} = await auth.supabase.rpc("cancel_external_import_operation", {
                p_job_id: body.jobId
            });
            if (error) return jsonError(error.message);
            return NextResponse.json({jobId: data});
        }
        case "quote-operation": {
            const {data, error} = await auth.supabase.rpc("quote_external_import_operation", {
                p_job_id: body.jobId
            });
            if (error) return jsonError(error.message);
            return NextResponse.json(data ?? {});
        }
        case "accept-quote": {
            const {data, error} = await auth.supabase.rpc("accept_external_import_quote", {
                p_job_id: body.jobId,
                p_quote_id: body.quoteId
            });
            if (error) {
                const message = error.message || "";
                if (message.includes("insufficient_credits")) {
                    return NextResponse.json({error: "insufficient_credits"}, {status: 402});
                }
                return jsonError(error.message);
            }
            return NextResponse.json(data ?? {});
        }
        case "quote-materialization": {
            const {data, error} = await auth.supabase.rpc("quote_external_import_materialization", {
                p_candidate_ids: body.candidateIds
            });
            if (error) return jsonError(error.message);
            return NextResponse.json(data ?? {});
        }
        case "accept-materialization": {
            const {data, error} = await auth.supabase.rpc("accept_external_import_materialization_quote", {
                p_quote_id: body.quoteId
            });
            if (error) {
                const message = error.message || "";
                if (message.includes("insufficient_credits")) {
                    return NextResponse.json({error: "insufficient_credits"}, {status: 402});
                }
                return jsonError(error.message);
            }
            return NextResponse.json(data ?? {});
        }
        case "settle-materialization": {
            const {error} = await auth.supabase.rpc("settle_external_import_materialization_quote", {
                p_quote_id: body.quoteId
            });
            if (error) return jsonError(error.message);
            return NextResponse.json({ok: true});
        }
        case "confirm-location": {
            const {data, error} = await auth.supabase.rpc("confirm_external_import_candidate_locations", {
                p_candidate_ids: body.candidateIds,
                p_lat: body.latitude,
                p_lng: body.longitude,
                p_display_label: body.label ?? null,
                p_country_code: body.countryCode ?? null
            });
            if (error) return jsonError(error.message);
            return NextResponse.json({updated: data});
        }
        case "skip-location": {
            const ids = Array.isArray(body.candidateIds) ? body.candidateIds as string[] : [];
            let done = 0;
            for (const id of ids) {
                const {error} = await auth.supabase.rpc("set_external_import_candidate_location_state", {
                    p_candidate_id: id,
                    p_state: "unknown"
                });
                if (error) return jsonError(error.message);
                done += 1;
            }
            return NextResponse.json({updated: done});
        }
        case "set-species": {
            const {error} = await auth.supabase.rpc("update_external_import_candidate_identity", {
                p_candidate_id: body.candidateId,
                p_species_profile_id: body.speciesId
            });
            if (error) return jsonError(error.message);
            return NextResponse.json({ok: true});
        }
        case "attest": {
            const {data, error} = await auth.supabase.rpc("attest_external_import_candidates", {
                p_candidate_ids: body.candidateIds,
                p_setting_tag: settingTag(body.settingTag)
            });
            if (error) return jsonError(error.message);
            return NextResponse.json({updated: data});
        }
        default:
            return jsonError("Unknown import action.");
    }
}
