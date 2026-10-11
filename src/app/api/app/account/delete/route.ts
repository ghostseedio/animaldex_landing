import {NextResponse} from "next/server";
import {invokeAuthenticatedSupabaseFunctionResponse} from "@/lib/supabase/app-functions";

export const runtime = "nodejs";

/**
 * iOS `SettingsAccountView` → "Delete Account": the shared `delete-account`
 * edge function removes the profile, captures and associated data for the
 * caller's JWT. The client signs out afterwards.
 */
export async function POST() {
    try {
        const result = await invokeAuthenticatedSupabaseFunctionResponse("delete-account", {});
        if (!result.ok) {
            const message = typeof result.payload?.error === "string" ? result.payload.error : null;
            return NextResponse.json({error: message && message !== "missing_authorization" ? message : "Account deletion failed."}, {status: result.status || 400});
        }
        return NextResponse.json({ok: true});
    } catch (error) {
        return NextResponse.json({error: error instanceof Error ? error.message : "Account deletion failed."}, {status: 400});
    }
}
