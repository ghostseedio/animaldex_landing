import {NextResponse} from "next/server";
import {mapResolveRow} from "@/data/matchups";
import {friendlyChallengeError} from "@/lib/matchup-stats";
import {invokeAuthenticatedSupabaseFunction} from "@/lib/supabase/app-functions";
import {createSupabaseServerClient} from "@/lib/supabase/server";

export const runtime = "nodejs";

function normalizeResolveRow(payload: unknown) {
    if (!payload || typeof payload !== "object") return null;

    const record = payload as Record<string, unknown>;
    if (record.result && typeof record.result === "object") {
        const nested = record.result as Record<string, unknown>;
        if (nested.result && typeof nested.result === "object") {
            return mapResolveRow(nested.result as Record<string, unknown>);
        }
        return mapResolveRow(nested);
    }

    return mapResolveRow(record);
}

export async function POST(request: Request) {
    const supabase = createSupabaseServerClient();

    if (!supabase) {
        return NextResponse.json({error: "Supabase is not configured."}, {status: 503});
    }

    const {data: {user}} = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({error: "Authentication required."}, {status: 401});
    }

    const body = await request.json().catch(() => ({}));
    const attackerCaptureId = String(body.attackerCaptureId ?? "").trim();
    const defenderCaptureId = String(body.defenderCaptureId ?? "").trim();

    if (!attackerCaptureId || !defenderCaptureId) {
        return NextResponse.json({error: "Both animals are required for a matchup."}, {status: 400});
    }

    const params = {
        p_attacker_capture_id: attackerCaptureId,
        p_defender_capture_id: defenderCaptureId,
        p_attacker_battle_power: null,
        p_defender_battle_power: null,
        p_attacker_tier: null,
        p_defender_tier: null
    };

    try {
        const edgePayload = await invokeAuthenticatedSupabaseFunction("resolve-capture-challenge", params);
        const result = normalizeResolveRow(edgePayload);

        if (!result?.id) {
            return NextResponse.json({error: "Matchup completed without a result payload."}, {status: 502});
        }

        return NextResponse.json({result});
    } catch (edgeError) {
        const {data, error} = await supabase.rpc("resolve_capture_challenge", params);

        if (error) {
            return NextResponse.json({error: friendlyChallengeError(error.message)}, {status: 400});
        }

        const row = Array.isArray(data) ? data[0] : data;
        const result = row ? mapResolveRow(row as Record<string, unknown>) : null;

        if (!result?.id) {
            const message = edgeError instanceof Error ? edgeError.message : "Matchup failed.";
            return NextResponse.json({error: friendlyChallengeError(message)}, {status: 400});
        }

        return NextResponse.json({result});
    }
}
