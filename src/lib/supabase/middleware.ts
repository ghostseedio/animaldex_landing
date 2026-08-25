import {createServerClient} from "@supabase/ssr";
import {type NextRequest, NextResponse} from "next/server";
import {getSupabaseAuthKey, getSupabaseUrl} from "@/lib/supabase-http";
import {requestHasSupabaseAuthCookie} from "@/lib/supabase/auth-cookie";
import {traceRequestAmplification} from "@/lib/request-trace";
import type {User} from "@supabase/supabase-js";

export async function updateSupabaseSession(
    request: NextRequest,
    response: NextResponse
): Promise<{response: NextResponse; user: User | null}> {
    if (!requestHasSupabaseAuthCookie(request.cookies.getAll())) {
        traceRequestAmplification("supabase-session-skipped", {path: request.nextUrl.pathname});
        return {response, user: null};
    }

    const supabaseUrl = getSupabaseUrl();
    const supabaseAuthKey = getSupabaseAuthKey();

    if (!supabaseUrl || !supabaseAuthKey) {
        return {response, user: null};
    }

    const supabase = createServerClient(supabaseUrl, supabaseAuthKey, {
        cookies: {
            getAll() {
                return request.cookies.getAll();
            },
            setAll(cookiesToSet, headers) {
                cookiesToSet.forEach(({name, value, options}) => {
                    request.cookies.set({name, value, ...options});
                    response.cookies.set({name, value, ...options});
                });

                for (const [key, value] of Object.entries(headers)) {
                    response.headers.set(key, value);
                }
            }
        }
    });

    const {data: {user}} = await supabase.auth.getUser();
    traceRequestAmplification("supabase-session-refreshed", {
        path: request.nextUrl.pathname,
        authenticated: Boolean(user)
    });

    return {response, user: user ?? null};
}
