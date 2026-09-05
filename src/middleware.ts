import createIntlMiddleware from "next-intl/middleware";
import {type NextRequest, NextResponse} from "next/server";
import {localeConfig} from "@/i18n";
import {updateSupabaseSession} from "@/lib/supabase/middleware";
import {createDevRequestTimer, finishDevRequestTimer, timeDevStep} from "@/lib/dev-request-timing";
import {
    isProtectedAppPath,
    middlewareShouldRefreshSession,
    splitLocalePath
} from "@/lib/request-routing";
import {requestHasSupabaseAuthCookie} from "@/lib/supabase/auth-cookie";
import {traceRequestAmplification} from "@/lib/request-trace";

const intlMiddleware = createIntlMiddleware(localeConfig);

function redirectToAccount(request: NextRequest, locale: string, sessionResponse?: NextResponse) {
    const signInUrl = request.nextUrl.clone();
    signInUrl.pathname = locale === localeConfig.defaultLocale ? "/account" : `/${locale}/account`;
    signInUrl.search = "";
    signInUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    const redirect = NextResponse.redirect(signInUrl);

    sessionResponse?.cookies.getAll().forEach((cookie) => {
        redirect.cookies.set(cookie);
    });

    return redirect;
}

/**
 * Middleware stays broad so next-intl can handle `as-needed` locale routing
 * and legacy public URLs keep working. That does **not** mean every public
 * request may contact Supabase.
 *
 * Safe split:
 * - Locale/redirect work always runs (no network).
 * - Auth/session refresh runs only when a Supabase auth cookie is present or
 *   the path is a protected `/app/*` gate.
 * - Protected routes without a cookie redirect locally — no `getUser()`.
 * - CMS vanity slugs are resolved in the catch-all route, never here.
 * - Authorization for APIs and RSC still uses server `auth.getUser()`.
 */
export async function middleware(request: NextRequest) {
    const timer = createDevRequestTimer("middleware", {path: request.nextUrl.pathname});
    try {
        const response = intlMiddleware(request);
        const {locale} = splitLocalePath(request.nextUrl.pathname);
        const hasAuthCookie = requestHasSupabaseAuthCookie(request.cookies.getAll());
        const isProtected = isProtectedAppPath(request.nextUrl.pathname);

        if (!middlewareShouldRefreshSession(request.nextUrl.pathname, hasAuthCookie)) {
            traceRequestAmplification("middleware-public-anonymous", {path: request.nextUrl.pathname});
            // next-intl sets NEXT_LOCALE whenever the request has no cookie.
            // That Set-Cookie header forces private/no-store and a Function
            // invocation on every crawler GET. Locale lives in the URL.
            response.headers.delete("set-cookie");
            return response;
        }

        if (isProtected && !hasAuthCookie) {
            traceRequestAmplification("middleware-protected-anonymous-redirect", {path: request.nextUrl.pathname});
            return redirectToAccount(request, locale);
        }

        const session = await timeDevStep(timer, "supabase.session", () => updateSupabaseSession(request, response));

        if (isProtected && !session.user) {
            traceRequestAmplification("middleware-protected-invalid-session", {path: request.nextUrl.pathname});
            return redirectToAccount(request, locale, session.response);
        }

        return session.response;
    } finally {
        finishDevRequestTimer(timer, {path: request.nextUrl.pathname});
    }
}

export const config = {
    matcher: ["/((?!api|admin|_next|.*\\..*|legal|auth).*)"]
};
