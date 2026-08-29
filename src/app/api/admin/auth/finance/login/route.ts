import {createServerClient} from "@supabase/ssr";
import {cookies} from "next/headers";
import {NextResponse} from "next/server";
import {getSupabaseAuthKey, getSupabaseUrl} from "@/lib/supabase-http";
import {isNamedFinanceAdminEmail} from "@/lib/support-admin-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Named finance-operator sign-in.
 *
 * Finance approvals are gated on a Supabase session whose email is in the
 * admin list, never the shared support-password session. This endpoint signs
 * an operator in with email + password and rejects accounts that are not named
 * finance operators, so the UI can show a clear "not an operator" error instead
 * of silently leaving finance locked.
 */
export async function POST(request: Request) {
    const supabaseUrl = getSupabaseUrl();
    const supabaseAuthKey = getSupabaseAuthKey();

    if (!supabaseUrl || !supabaseAuthKey) {
        return NextResponse.json({ok: false, error: "Named operator sign-in is not configured"}, {status: 503});
    }

    let body: {email?: string; password?: string};

    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ok: false, error: "Invalid request body."}, {status: 400});
    }

    const email = body.email?.trim();
    const password = body.password;

    if (!email || !password) {
        return NextResponse.json({ok: false, error: "Email and password are required."}, {status: 400});
    }

    const cookieStore = cookies();
    const response = NextResponse.json({ok: true});

    const supabase = createServerClient(supabaseUrl, supabaseAuthKey, {
        cookies: {
            get(name) {
                return cookieStore.get(name)?.value;
            },
            set(name, value, options) {
                cookieStore.set({name, value, ...options});
                response.cookies.set({name, value, ...options});
            },
            remove(name, options) {
                cookieStore.set({name, value: "", ...options});
                response.cookies.set({name, value: "", ...options});
            }
        }
    });

    const {data, error} = await supabase.auth.signInWithPassword({email, password});

    if (error) {
        return NextResponse.json({ok: false, error: error.message}, {status: 401});
    }

    if (!isNamedFinanceAdminEmail(data.user?.email)) {
        await supabase.auth.signOut();
        return NextResponse.json(
            {ok: false, error: "This account is not a named finance operator."},
            {status: 403}
        );
    }

    return response;
}
