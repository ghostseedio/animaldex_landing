/**
 * Detect whether a request already carries a Supabase auth cookie.
 *
 * Cookie names can be chunked (`sb-<ref>-auth-token.0`) and the project ref
 * can change, so this never hard-codes a full cookie name. Presence of a
 * cookie is only a hint that session work may be necessary — it is not
 * authorization. Protected resources still call `auth.getUser()`.
 */
export function isSupabaseAuthCookieName(name: string) {
    return name.startsWith("sb-") && name.includes("auth-token");
}

export function requestHasSupabaseAuthCookie(
    cookies: Array<{name: string}> | string | null | undefined
) {
    if (!cookies) return false;

    if (typeof cookies === "string") {
        return cookies.split(";").some((part) => {
            const name = part.trim().split("=")[0];
            return Boolean(name) && isSupabaseAuthCookieName(name);
        });
    }

    return cookies.some((cookie) => isSupabaseAuthCookieName(cookie.name));
}
