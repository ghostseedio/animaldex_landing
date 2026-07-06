import {createServerClient} from "@supabase/ssr";
import {cookies} from "next/headers";
import {NextResponse} from "next/server";
import {getSupabasePublicKey, getSupabaseUrl} from "@/lib/supabase-http";
import {ensureAuthenticatedProfileRows} from "@/lib/supabase/auth-bootstrap";

function sanitizeNextPath(value: string | null) {
    if (!value || !value.startsWith("/") || value.startsWith("//")) return "/app";
    if (value.startsWith("/api/") || value.startsWith("/auth/")) return "/app";
    return value;
}

function accountPathFor(nextPath: string) {
    const locale = nextPath.match(/^\/(en|id)(?:\/|$)/)?.[1];
    return locale ? `/${locale}/account` : "/account";
}

export async function GET(request: Request) {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get("code");
    const providerError = requestUrl.searchParams.get("error_description") ?? requestUrl.searchParams.get("error");
    const nextPath = sanitizeNextPath(requestUrl.searchParams.get("next"));

    const supabaseUrl = getSupabaseUrl();
    const supabaseAnonKey = getSupabasePublicKey();

    if (providerError) {
        const redirectUrl = new URL(accountPathFor(nextPath), requestUrl.origin);
        redirectUrl.searchParams.set("error", providerError);
        return NextResponse.redirect(redirectUrl);
    }

    if (!supabaseUrl || !supabaseAnonKey || !code) {
        const redirectUrl = new URL(accountPathFor(nextPath), requestUrl.origin);
        redirectUrl.searchParams.set("error", "Sign-in callback is not configured.");
        return NextResponse.redirect(redirectUrl);
    }

    const cookieStore = cookies();
    const response = NextResponse.redirect(new URL(nextPath, requestUrl.origin));
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
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

    const {error} = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
        const redirectUrl = new URL(accountPathFor(nextPath), requestUrl.origin);
        redirectUrl.searchParams.set("error", error.message);
        return NextResponse.redirect(redirectUrl);
    }

    try {
        await ensureAuthenticatedProfileRows(supabase);
    } catch (bootstrapError) {
        const redirectUrl = new URL(accountPathFor(nextPath), requestUrl.origin);
        redirectUrl.searchParams.set("error", bootstrapError instanceof Error ? bootstrapError.message : "Could not initialize account.");
        return NextResponse.redirect(redirectUrl);
    }

    return response;
}
