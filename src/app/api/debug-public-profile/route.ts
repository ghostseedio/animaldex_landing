import {NextRequest, NextResponse} from "next/server";
import {
    getSupabaseHeaders,
    getSupabaseServerReadKey,
    getSupabaseUrl,
    isSupabaseJwtKey
} from "@/lib/supabase-http";
import {normalizePublicHandle} from "@/data/public-profiles";

export const dynamic = "force-dynamic";

function getReadKeySource() {
    const candidates = [
        "SUPABASE_SERVICE_ROLE_KEY",
        "SUPABASE_SECRET_KEY",
        "SUPABASE_SERVICE_KEY",
        "SUPABASE_ANON_KEY",
        "SUPABASE_PUBLISHABLE_KEY",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY",
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
    ];

    return candidates.find((name) => process.env[name]?.trim()) ?? null;
}

function getSupabaseHost(value: string | null) {
    if (!value) return null;

    try {
        return new URL(value).host;
    } catch {
        return "invalid-url";
    }
}

function getDebugSecret(request: NextRequest) {
    return request.headers.get("x-debug-secret")
        ?? request.nextUrl.searchParams.get("secret")
        ?? "";
}

export async function GET(request: NextRequest) {
    const configuredSecret = process.env.PROFILE_DEBUG_SECRET?.trim();

    if (!configuredSecret || getDebugSecret(request) !== configuredSecret) {
        return NextResponse.json({error: "Not found"}, {status: 404});
    }

    const handle = normalizePublicHandle(request.nextUrl.searchParams.get("handle") ?? "lendawg");
    const supabaseUrl = getSupabaseUrl();
    const readKey = getSupabaseServerReadKey();
    const readKeySource = getReadKeySource();

    const config = {
        hasSupabaseUrl: Boolean(supabaseUrl),
        supabaseHost: getSupabaseHost(supabaseUrl),
        hasReadKey: Boolean(readKey),
        readKeySource,
        readKeyLooksJwt: isSupabaseJwtKey(readKey)
    };

    if (!handle) {
        return NextResponse.json({config, profileQuery: {error: "Invalid handle"}}, {status: 400});
    }

    if (!supabaseUrl || !readKey) {
        return NextResponse.json({
            config,
            handle,
            profileQuery: {ok: false, status: null, rowCount: null, rows: []}
        });
    }

    const searchParams = new URLSearchParams({
        select: "id,username,display_name,created_at,is_pro",
        username: `eq.${handle}`,
        limit: "5"
    });

    try {
        const response = await fetch(`${supabaseUrl}/rest/v1/profiles?${searchParams.toString()}`, {
            headers: getSupabaseHeaders(readKey),
            cache: "no-store"
        });
        const body = await response.text();
        const parsedBody = body ? JSON.parse(body) : null;
        const rows = Array.isArray(parsedBody) ? parsedBody : [];

        return NextResponse.json({
            config,
            handle,
            profileQuery: {
                ok: response.ok,
                status: response.status,
                rowCount: rows.length,
                rows,
                error: response.ok ? null : parsedBody
            }
        });
    } catch (error) {
        return NextResponse.json({
            config,
            handle,
            profileQuery: {
                ok: false,
                status: null,
                rowCount: null,
                rows: [],
                error: error instanceof Error ? error.message : "Unknown error"
            }
        });
    }
}
