import {cookies} from "next/headers";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {requestHasSupabaseAuthCookie} from "@/lib/supabase/auth-cookie";

/**
 * `auth.getUser()` is a network round trip to Supabase. Logged-out readers are
 * the majority of traffic on public comparison pages and always carry no auth
 * cookie, so check for one before paying for the call.
 *
 * Presence of a cookie is not authorization. Callers that need a trusted user
 * still go through `auth.getUser()` after this hint.
 */
export function hasAuthCookie() {
    return requestHasSupabaseAuthCookie(cookies().getAll());
}

export async function getViewerUserId(): Promise<string | null> {
    if (!hasAuthCookie()) return null;

    const supabase = createSupabaseServerClient();
    if (!supabase) return null;

    const {data: {user}} = await supabase.auth.getUser();
    return user?.id ?? null;
}
