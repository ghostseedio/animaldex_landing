import {createServerClient} from "@supabase/ssr";
import {cookies} from "next/headers";
import {NextResponse} from "next/server";
import {getSupabaseAuthKey, getSupabasePublicKey, getSupabaseUrl, isSupabaseJwtKey} from "@/lib/supabase-http";
import {ensureAuthenticatedProfileRows} from "@/lib/supabase/auth-bootstrap";

function getAuthConfigError() {
    const supabaseUrl = getSupabaseUrl();
    const authKey = getSupabaseAuthKey();
    const anonKey = getSupabasePublicKey();

    if (!supabaseUrl) {
        return "Web sign-in is not configured. Missing SUPABASE_URL.";
    }

    if (!authKey) {
        return "Web sign-in is not configured. Missing SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY.";
    }

    if (anonKey && !isSupabaseJwtKey(anonKey)) {
        return "SUPABASE_ANON_KEY looks invalid. Use the JWT anon key from Supabase Dashboard → Project Settings → API (starts with eyJ).";
    }

    return null;
}

export async function POST(request: Request) {
    const configError = getAuthConfigError();

    if (configError) {
        return NextResponse.json({error: configError}, {status: 503});
    }

    const supabaseUrl = getSupabaseUrl()!;
    const supabaseAuthKey = getSupabaseAuthKey()!;

    let body: {email?: string; password?: string};

    try {
        body = await request.json();
    } catch {
        return NextResponse.json({error: "Invalid request body."}, {status: 400});
    }

    const email = body.email?.trim();
    const password = body.password;

    if (!email || !password) {
        return NextResponse.json({error: "Email and password are required."}, {status: 400});
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

    const {error} = await supabase.auth.signInWithPassword({email, password});

    if (error) {
        return NextResponse.json({error: error.message}, {status: 401});
    }

    await ensureAuthenticatedProfileRows(supabase);

    return response;
}
