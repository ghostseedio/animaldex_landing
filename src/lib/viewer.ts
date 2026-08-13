import {cookies} from "next/headers";
import {createSupabaseServerClient} from "@/lib/supabase/server";

/**
 * `auth.getUser()` is a network round trip to Supabase. Logged-out readers are
 * the majority of traffic on public comparison pages and always carry no auth
 * cookie, so check for one before paying for the call.
 */
export function hasAuthCookie() {
    return cookies().getAll().some((cookie) =>
        cookie.name.startsWith("sb-") && cookie.name.includes("auth-token")
    );
}

export async function getViewerUserId(): Promise<string | null> {
    if (!hasAuthCookie()) return null;

    const supabase = createSupabaseServerClient();
    if (!supabase) return null;

    const {data: {user}} = await supabase.auth.getUser();
    return user?.id ?? null;
}
