import {createServerClient} from "@supabase/ssr";
import {cookies} from "next/headers";
import {NextRequest, NextResponse} from "next/server";
import {getSupabaseAuthKey, getSupabasePublicKey, getSupabaseUrl, isSupabaseJwtKey} from "@/lib/supabase-http";

type OAuthProvider = "google" | "apple";

const PROVIDERS = new Set<OAuthProvider>(["google", "apple"]);

function sanitizeNextPath(value: string | null) {
    if (!value || !value.startsWith("/") || value.startsWith("//")) return "/app";
    if (value.startsWith("/api/") || value.startsWith("/auth/")) return "/app";
    return value;
}

function accountErrorRedirect(request: NextRequest, nextPath: string, error: string) {
    const locale = nextPath.match(/^\/(en|id)(?:\/|$)/)?.[1] ?? "en";
    const url = new URL(`/${locale}/account`, request.url);
    url.searchParams.set("error", error);
    return NextResponse.redirect(url);
}

function getAuthConfigError() {
    const supabaseUrl = getSupabaseUrl();
    const authKey = getSupabaseAuthKey();
    const anonKey = getSupabasePublicKey();

    if (!supabaseUrl) return "Web sign-in is not configured. Missing SUPABASE_URL.";
    if (!authKey) return "Web sign-in is not configured. Missing SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY.";
    if (anonKey && !isSupabaseJwtKey(anonKey)) {
        return "SUPABASE_ANON_KEY looks invalid. Use the JWT anon key from Supabase Dashboard → Project Settings → API.";
    }

    return null;
}

export async function GET(request: NextRequest) {
    const requestUrl = new URL(request.url);
    const provider = requestUrl.searchParams.get("provider") as OAuthProvider | null;
    const nextPath = sanitizeNextPath(requestUrl.searchParams.get("next"));

    if (!provider || !PROVIDERS.has(provider)) {
        return accountErrorRedirect(request, nextPath, "Unsupported sign-in provider.");
    }

    const configError = getAuthConfigError();
    if (configError) return accountErrorRedirect(request, nextPath, configError);

    const supabaseUrl = getSupabaseUrl()!;
    const supabaseAuthKey = getSupabaseAuthKey()!;
    const response = NextResponse.next();
    const cookieStore = cookies();
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

    const callbackUrl = new URL("/auth/callback", requestUrl.origin);
    callbackUrl.searchParams.set("next", nextPath);

    const {data, error} = await supabase.auth.signInWithOAuth({
        provider,
        options: {
            redirectTo: callbackUrl.toString(),
            queryParams: provider === "google"
                ? {access_type: "offline", prompt: "select_account"}
                : undefined
        }
    });

    if (error || !data.url) {
        return accountErrorRedirect(request, nextPath, error?.message ?? "OAuth sign-in could not start.");
    }

    const redirectResponse = NextResponse.redirect(data.url);
    response.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie);
    });

    return redirectResponse;
}
