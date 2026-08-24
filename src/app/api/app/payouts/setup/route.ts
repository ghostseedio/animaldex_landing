import {createClient, type SupabaseClient} from "@supabase/supabase-js";
import {NextResponse} from "next/server";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {getSupabaseAuthKey, getSupabaseUrl} from "@/lib/supabase-http";
import {
    completeUserPayoutSetup,
    loadPayoutSetupStatusForUser
} from "@/lib/user-payout-setup";

async function resolveUserClient(request: Request): Promise<{
    supabase: SupabaseClient;
    userId: string;
    email: string | null;
} | null> {
    const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
    const bearer = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();

    if (bearer) {
        const url = getSupabaseUrl();
        const key = getSupabaseAuthKey();
        if (!url || !key) return null;
        const supabase = createClient(url, key, {
            global: {headers: {Authorization: `Bearer ${bearer}`}},
            auth: {persistSession: false, autoRefreshToken: false}
        });
        const {data, error} = await supabase.auth.getUser(bearer);
        if (error || !data.user) return null;
        return {supabase, userId: data.user.id, email: data.user.email ?? null};
    }

    const supabase = createSupabaseServerClient();
    if (!supabase) return null;
    const {data} = await supabase.auth.getUser();
    if (!data.user) return null;
    return {supabase, userId: data.user.id, email: data.user.email ?? null};
}

export async function GET(request: Request) {
    const session = await resolveUserClient(request);
    if (!session) return NextResponse.json({error: "Authentication required."}, {status: 401});

    const [eligibilityRes, corridorsRes] = await Promise.all([
        session.supabase.rpc("get_my_payout_eligibility"),
        session.supabase.rpc("list_my_payout_setup_corridors")
    ]);

    if (eligibilityRes.error) {
        return NextResponse.json({error: eligibilityRes.error.message}, {status: 400});
    }
    if (corridorsRes.error) {
        return NextResponse.json({error: corridorsRes.error.message}, {status: 400});
    }

    try {
        const status = await loadPayoutSetupStatusForUser({
            eligibilityRow: (eligibilityRes.data ?? {}) as Record<string, unknown>,
            corridorsRaw: corridorsRes.data,
            contactEmail: session.email
        });
        return NextResponse.json(status);
    } catch (error) {
        return NextResponse.json(
            {error: error instanceof Error ? error.message : "Unable to load payout setup."},
            {status: 400}
        );
    }
}

export async function POST(request: Request) {
    const session = await resolveUserClient(request);
    if (!session) return NextResponse.json({error: "Authentication required."}, {status: 401});

    const body = await request.json().catch(() => ({}));
    try {
        const status = await completeUserPayoutSetup({
            userId: session.userId,
            contactEmail: session.email,
            countryCode: String(body.countryCode ?? ""),
            currencyCode: String(body.currencyCode ?? ""),
            accountHolderName: String(body.accountHolderName ?? ""),
            legalCapacityAttested: Boolean(body.legalCapacityAttested),
            sortCode: String(body.sortCode ?? ""),
            accountNumber: String(body.accountNumber ?? "")
        });
        return NextResponse.json(status);
    } catch (error) {
        return NextResponse.json(
            {error: error instanceof Error ? error.message : "Unable to complete payout setup."},
            {status: 400}
        );
    }
}
