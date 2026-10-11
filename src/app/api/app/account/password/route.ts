import {createClient} from "@supabase/supabase-js";
import {NextResponse} from "next/server";
import {passwordChangeProblem} from "@/lib/account-settings";
import {getSupabasePublicKey, getSupabaseUrl} from "@/lib/supabase-http";
import {createSupabaseServerClient} from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * iOS `ChangePasswordView` → `SupabaseAuthService.changePassword`: re-check the
 * current password, then set the new one. The re-check uses a throwaway
 * client so the browser's session cookies are never replaced by it.
 */
export async function POST(request: Request) {
    const supabase = createSupabaseServerClient();
    const url = getSupabaseUrl();
    const anonKey = getSupabasePublicKey();
    if (!supabase || !url || !anonKey) return NextResponse.json({error: "Supabase is not configured."}, {status: 503});

    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return NextResponse.json({error: "Authentication required."}, {status: 401});

    const providers = (user.identities ?? []).map((identity) => identity.provider);
    if (!user.email || !providers.includes("email")) {
        return NextResponse.json({error: "Passwords are not used for this sign-in method."}, {status: 400});
    }

    const body = await request.json().catch(() => ({})) as {current?: string; next?: string; confirm?: string};
    const input = {current: body.current ?? "", next: body.next ?? "", confirm: body.confirm ?? body.next ?? ""};
    const problem = passwordChangeProblem(input);
    if (problem) return NextResponse.json({error: problem}, {status: 400});

    const verifier = createClient(url, anonKey, {auth: {persistSession: false, autoRefreshToken: false}});
    const {error: verifyError} = await verifier.auth.signInWithPassword({email: user.email, password: input.current});
    if (verifyError) return NextResponse.json({error: "Current password is incorrect."}, {status: 400});
    await verifier.auth.signOut().catch(() => undefined);

    const {error} = await supabase.auth.updateUser({password: input.next});
    if (error) return NextResponse.json({error: error.message}, {status: 400});
    return NextResponse.json({ok: true});
}
