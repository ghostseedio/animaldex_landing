import {createServerClient} from "@supabase/ssr";
import type {EmailOtpType} from "@supabase/supabase-js";
import {cookies} from "next/headers";
import {NextResponse} from "next/server";
import {getSupabasePublicKey, getSupabaseUrl} from "@/lib/supabase-http";
import {ensureAuthenticatedProfileRows} from "@/lib/supabase/auth-bootstrap";
import {getSiteUrl} from "@/lib/site";

export const dynamic = "force-dynamic";

/**
 * One-time email sign-in links the server sends (a Wildlife Guide bought by
 * card as a guest): /auth/confirm?token_hash=…&type=magiclink&next=/guides/…
 * Verifies the token on the server, sets the session cookies and opens `next`.
 * The OAuth `code` flow stays on /auth/callback.
 */

const OTP_TYPES = new Set<EmailOtpType>(["magiclink", "email"]);

function sanitizeNextPath(value: string | null) {
    if (!value || !value.startsWith("/") || value.startsWith("//")) return "/app";
    if (value.startsWith("/api/") || value.startsWith("/auth/")) return "/app";
    return value;
}

export async function GET(request: Request) {
    const requestUrl = new URL(request.url);
    // Behind the proxy request.url is the container's own address; redirect on the canonical origin.
    const origin = getSiteUrl();
    const tokenHash = requestUrl.searchParams.get("token_hash");
    const type = requestUrl.searchParams.get("type") as EmailOtpType | null;
    const nextPath = sanitizeNextPath(requestUrl.searchParams.get("next"));

    const failed = (message: string) => {
        const redirectUrl = new URL("/account", origin);
        redirectUrl.searchParams.set("next", nextPath);
        redirectUrl.searchParams.set("error", message);
        return NextResponse.redirect(redirectUrl);
    };

    const supabaseUrl = getSupabaseUrl();
    const supabaseAnonKey = getSupabasePublicKey();
    if (!supabaseUrl || !supabaseAnonKey) return failed("Sign-in is not configured.");
    if (!tokenHash || !type || !OTP_TYPES.has(type)) return failed("This sign-in link is not valid.");

    const cookieStore = cookies();
    const response = NextResponse.redirect(new URL(nextPath, origin));
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

    const {error} = await supabase.auth.verifyOtp({type, token_hash: tokenHash});
    if (error) {
        return failed("This sign-in link has expired or was already used. Open the guide page and ask for a new link.");
    }
    try {
        await ensureAuthenticatedProfileRows(supabase);
    } catch (bootstrapError) {
        return failed(bootstrapError instanceof Error ? bootstrapError.message : "Could not initialize account.");
    }
    return response;
}
