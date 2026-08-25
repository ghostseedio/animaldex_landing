import {createClient, type SupabaseClient} from "@supabase/supabase-js";
import {NextRequest, NextResponse} from "next/server";
import {mapWiseRequirementsToFields, normalizeDbSchema} from "@/lib/payout-destination-requirements";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {getSupabaseAuthKey, getSupabaseUrl} from "@/lib/supabase-http";
import {
    loadWiseConfigFromEnv,
    loadWiseProductionConfigFromEnv,
    WisePayoutProvider
} from "@/lib/wise-payout-provider";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function resolveUserClient(request: Request): Promise<{
    supabase: SupabaseClient;
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
        return {supabase};
    }

    const supabase = createSupabaseServerClient();
    if (!supabase) return null;
    const {data} = await supabase.auth.getUser();
    if (!data.user) return null;
    return {supabase};
}

export async function GET(request: NextRequest) {
    const session = await resolveUserClient(request);
    if (!session) return NextResponse.json({error: "Authentication required."}, {status: 401});

    try {
        const corridorId = request.nextUrl.searchParams.get("corridorId");
        const corridorsRes = await session.supabase.rpc("list_my_payout_corridors");
        if (corridorsRes.error) {
            return NextResponse.json({error: corridorsRes.error.message}, {status: 400});
        }

        if (!corridorId) {
            return NextResponse.json({corridors: corridorsRes.data ?? []});
        }

        const reqRes = await session.supabase.rpc("get_payout_corridor_requirements", {
            p_corridor_id: corridorId
        });
        if (reqRes.error) {
            return NextResponse.json({error: reqRes.error.message}, {status: 400});
        }

        const requirements = (reqRes.data ?? {}) as Record<string, unknown>;
        let fields = normalizeDbSchema(requirements.schema);
        let source = String(requirements.requirementsSource ?? "static_verified");

        try {
            const identity = await session.supabase.rpc("get_animaldex_environment_identity");
            const envRow = (identity.data ?? {}) as Record<string, unknown>;
            const env = String(envRow.environment_label ?? envRow.environmentLabel ?? "").toLowerCase();
            const config = env === "production" ? loadWiseProductionConfigFromEnv() : loadWiseConfigFromEnv();
            if (config.apiToken && config.profileId) {
                const provider = new WisePayoutProvider(config);
                const wiseReqs = await provider.getAccountRequirements({
                    sourceCurrency: String(requirements.currencyCode ?? "USD"),
                    targetCurrency: String(requirements.currencyCode ?? "GBP"),
                    sourceAmount: 100
                });
                const mapped = mapWiseRequirementsToFields(
                    wiseReqs,
                    String(requirements.recipientType ?? "")
                );
                if (mapped.length > 1) {
                    fields = mapped;
                    source = "wise_api";
                }
            }
        } catch {
            // static fallback
        }

        return NextResponse.json({
            corridor: requirements,
            requirements: {
                country: requirements.countryCode,
                currency: requirements.currencyCode,
                recipientType: requirements.recipientType,
                schemaVersion: requirements.schemaVersion,
                source,
                fields
            }
        });
    } catch (error) {
        return NextResponse.json(
            {error: error instanceof Error ? error.message : "Failed to load corridors"},
            {status: 400}
        );
    }
}
