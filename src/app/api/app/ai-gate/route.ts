import {NextResponse} from "next/server";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {hasAuthCookie} from "@/lib/viewer";
import {isSameOriginBrowserRequest} from "@/lib/comparison-generation-guard";
import {AGE_RESTRICTED_COOKIE, AGE_RESTRICTED_MAX_AGE_SECONDS, AI_CONSENT_VERSION, ageBandFor, isAgeBand, isValidBirthYear} from "@/lib/ai-chat-gate";
import {getSupabasePublicKey, getSupabaseUrl} from "@/lib/supabase-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEADERS = {"Cache-Control": "private, no-store"} as const;

function json(body: Record<string, unknown>, status = 200) {
    return NextResponse.json(body, {status, headers: HEADERS});
}

/** PostgREST or Postgres saying the column or function is not there yet (the migration is not applied). */
function isMissing(error: {code?: string | null; message?: string | null} | null | undefined): boolean {
    if (!error) return false;
    return ["42703", "42883", "PGRST202", "PGRST204"].includes(error.code ?? "")
        || /could not find the function|does not exist/i.test(error.message ?? "");
}

async function viewer() {
    if (!hasAuthCookie()) return null;
    const supabase = createSupabaseServerClient();
    if (!supabase) return null;
    const {data: {user}} = await supabase.auth.getUser();
    return user ? {supabase, user} : null;
}

type ProfileGate = {birth_year?: unknown; ai_consent_at?: unknown; ai_consent_version?: unknown};

/** The year-long under-13 mark on this browser (lib/ai-chat-gate). */
function withAgeRestrictedMark(response: NextResponse) {
    response.cookies.set(AGE_RESTRICTED_COOKIE, "1", {
        maxAge: AGE_RESTRICTED_MAX_AGE_SECONDS,
        path: "/",
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production"
    });
    return response;
}

/** Deletes the signed-in account through delete-account, with the person's own token, as Settings does in the apps. */
async function closeAccount(supabase: NonNullable<ReturnType<typeof createSupabaseServerClient>>): Promise<boolean> {
    const {data: {session}} = await supabase.auth.getSession();
    const url = getSupabaseUrl();
    const key = getSupabasePublicKey();
    if (!session?.access_token || !url || !key) return false;
    const response = await fetch(`${url}/functions/v1/delete-account`, {
        method: "POST",
        headers: {apikey: key, Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json"},
        body: "{}",
        cache: "no-store"
    }).catch(() => null);
    if (!response?.ok) {
        console.warn("[ai-gate] closing an under-13 account failed", response?.status ?? "network");
        return false;
    }
    return true;
}

/**
 * What the chat gate needs before an account's first web chat (SPEC 3.1):
 * its birth year (and band) and its AI consent. `available: false` means the
 * backend migration is not applied: no age check, and the consent is kept in
 * the browser. A signed-out reader is a guest; their consent lives in the
 * browser only.
 */
export async function GET() {
    const session = await viewer();
    if (!session) return json({signedIn: false});
    const {data, error} = await session.supabase
        .from("profiles")
        .select("birth_year, ai_consent_at, ai_consent_version")
        .eq("id", session.user.id)
        .maybeSingle();
    if (error) {
        if (!isMissing(error)) console.warn("[ai-gate] profile read failed", error.message);
        return json({signedIn: true, userId: session.user.id, birthYear: null, band: "unknown", consented: false, available: false});
    }
    const row = (data ?? {}) as ProfileGate;
    const birthYear = typeof row.birth_year === "number" ? row.birth_year : null;
    return json({
        signedIn: true,
        userId: session.user.id,
        birthYear,
        band: ageBandFor(birthYear),
        // Given, for this version of the words (a consent without a version is taken as this one).
        consented: typeof row.ai_consent_at === "string" && (typeof row.ai_consent_version !== "string" || row.ai_consent_version === AI_CONSENT_VERSION),
        available: true
    });
}

/**
 * `{action: "birth_year", year}` keeps the account's birth year once
 * (`set_birth_year`, which answers with the band); `{action: "consent"}`
 * records the AI consent (`record_ai_consent`). Same-origin only: a birth
 * year is set once, so no other site may set one. A missing RPC answers
 * `missing: true`, and the browser carries on without it.
 */
export async function POST(request: Request) {
    if (!isSameOriginBrowserRequest(request)) return json({ok: false, error: "forbidden"}, 403);
    const session = await viewer();
    if (!session) return json({ok: false, error: "signed_out"}, 401);
    const body = await request.json().catch(() => null) as {action?: unknown; year?: unknown} | null;

    if (body?.action === "birth_year") {
        if (!isValidBirthYear(body.year)) return json({ok: false, error: "invalid_year"}, 400);
        const {data, error} = await session.supabase.rpc("set_birth_year", {p_birth_year: body.year});
        if (!error) {
            const band = isAgeBand(data) ? data : ageBandFor(body.year);
            // Under 13 the browser is marked at once; the gate then closes the account.
            return band === "under_13"
                ? withAgeRestrictedMark(json({ok: true, band, birthYear: body.year}))
                : json({ok: true, band, birthYear: body.year});
        }
        if (isMissing(error)) return json({ok: false, missing: true});
        // Already set (it is set once): what the account holds stands.
        const {data: profile} = await session.supabase.from("profiles").select("birth_year").eq("id", session.user.id).maybeSingle();
        const kept = typeof (profile as ProfileGate | null)?.birth_year === "number" ? (profile as {birth_year: number}).birth_year : null;
        if (kept !== null) return json({ok: true, band: ageBandFor(kept), birthYear: kept});
        console.warn("[ai-gate] set_birth_year failed", error.code, error.message);
        return json({ok: false, error: error.code === "22023" ? "invalid_year" : "failed"}, error.code === "22023" ? 400 : 500);
    }

    if (body?.action === "close_under_13") {
        // Only an account the age check put under 13 (the same rule as delete-account's sweep path).
        const {data: profile} = await session.supabase.from("profiles").select("birth_year").eq("id", session.user.id).maybeSingle();
        const kept = typeof (profile as ProfileGate | null)?.birth_year === "number" ? (profile as {birth_year: number}).birth_year : null;
        if (kept === null || ageBandFor(kept) !== "under_13") return json({ok: false, error: "not_age_restricted"}, 409);
        const closed = await closeAccount(session.supabase);
        if (!closed) return json({ok: false, error: "failed"}, 502);
        await session.supabase.auth.signOut().catch(() => undefined);
        return withAgeRestrictedMark(json({ok: true, closed: true}));
    }

    if (body?.action === "consent") {
        const {error} = await session.supabase.rpc("record_ai_consent", {p_version: AI_CONSENT_VERSION});
        if (!error) return json({ok: true, version: AI_CONSENT_VERSION});
        if (isMissing(error)) return json({ok: false, missing: true});
        console.warn("[ai-gate] record_ai_consent failed", error.code, error.message);
        return json({ok: false, error: "failed"}, 500);
    }

    return json({ok: false, error: "invalid_request"}, 400);
}
