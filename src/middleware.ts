import createIntlMiddleware from "next-intl/middleware";
import {type NextRequest, NextResponse} from "next/server";
import {localeConfig} from "@/i18n";
import {updateSupabaseSession} from "@/lib/supabase/middleware";
import {createDevRequestTimer, finishDevRequestTimer, timeDevStep} from "@/lib/dev-request-timing";
import {
    isProtectedAppPath,
    matchDefaultLocalePrefixedPath,
    middlewareShouldRefreshSession,
    splitLocalePath
} from "@/lib/request-routing";
import {requestHasSupabaseAuthCookie} from "@/lib/supabase/auth-cookie";
import {traceRequestAmplification} from "@/lib/request-trace";
import {
    applyEnglishOnlyDetailLinkHeader,
    closedSeoNamespaceNotFoundResponse,
    resolveClosedSeoNamespacePath
} from "@/lib/closed-seo-namespaces";
import {matchCollapsedIdDetailPath} from "@/lib/english-detail-routes";

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
 * Supabase drops the `redirect_to` we send when it is not on the project's
 * allow-list and falls back to the Site URL, so a Google sign-in can land on
 * `/?code=…` instead of `/auth/callback?code=…`. Nothing on the marketing root
 * exchanges that code, so the visitor lands back signed out. Forward any auth
 * code that arrives on a site root to the callback, which owns the exchange.
 */
function matchMisroutedAuthCallback(request: NextRequest) {
    const path = request.nextUrl.pathname.replace(/\/$/, "");
    const isSiteRoot = path === "" || localeConfig.locales.includes(path.slice(1));
    if (!isSiteRoot) return null;

    const params = request.nextUrl.searchParams;
    const code = params.get("code");
    const error = params.get("error") ?? params.get("error_description");
    if (!code && !error) return null;

    const callbackUrl = new URL("/auth/callback", request.nextUrl.origin);
    if (code) callbackUrl.searchParams.set("code", code);
    if (params.get("error")) callbackUrl.searchParams.set("error", params.get("error")!);
    if (params.get("error_description")) {
        callbackUrl.searchParams.set("error_description", params.get("error_description")!);
    }
    return callbackUrl;
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
        const misroutedAuthCallback = matchMisroutedAuthCallback(request);
        if (misroutedAuthCallback) {
            return NextResponse.redirect(misroutedAuthCallback);
        }

        // Collapse external /en URLs here (not next.config) so next-intl's
        // internal /en rewrite for as-needed English cannot self-redirect.
        const defaultLocalePrefixed = matchDefaultLocalePrefixedPath(request.nextUrl.pathname);
        if (defaultLocalePrefixed != null) {
            const destination = request.nextUrl.clone();
            destination.pathname = defaultLocalePrefixed;
            return NextResponse.redirect(destination, 308);
        }

        const collapsed = matchCollapsedIdDetailPath(request.nextUrl.pathname);
        if (collapsed) {
            const destination = request.nextUrl.clone();
            destination.pathname = collapsed.englishPath;
            return NextResponse.redirect(destination, 308);
        }

        const closedNamespace = resolveClosedSeoNamespacePath(request.nextUrl.pathname);
        if (closedNamespace?.action === "block") {
            return closedSeoNamespaceNotFoundResponse();
        }

        const response = applyEnglishOnlyDetailLinkHeader(intlMiddleware(request), request);
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

        return applyEnglishOnlyDetailLinkHeader(session.response, request);
    } finally {
        finishDevRequestTimer(timer, {path: request.nextUrl.pathname});
    }
}

export const config = {
    matcher: ["/((?!api|admin|_next|.*\\..*|legal|auth).*)"]
};
