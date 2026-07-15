import createIntlMiddleware from "next-intl/middleware";
import {createServerClient} from "@supabase/ssr";
import {type NextRequest, NextResponse} from "next/server";
import {localeConfig} from "@/i18n";
import {updateSupabaseSession} from "@/lib/supabase/middleware";
import {getSupabaseAuthKey, getSupabaseUrl} from "@/lib/supabase-http";

const intlMiddleware = createIntlMiddleware(localeConfig);

const protectedAppPrefixes = [
    "/app/arena",
    "/app/capture",
    "/app/collection",
    "/app/journal",
    "/app/matchups",
    "/app/messages",
    "/app/missions",
    "/app/notifications",
    "/app/profile",
    "/app/sets",
    "/app/trades",
    "/app/train"
];

function splitLocalePath(pathname: string) {
    const segments = pathname.split("/");
    const firstSegment = segments[1];
    const hasLocalePrefix = localeConfig.locales.includes(firstSegment);
    const locale = hasLocalePrefix ? firstSegment : localeConfig.defaultLocale;
    const appPath = hasLocalePrefix ? `/${segments.slice(2).join("/")}` : pathname;

    return {
        locale,
        appPath: appPath === "/" ? "/" : appPath.replace(/\/+$/, "") || "/"
    };
}

function isProtectedAppPath(pathname: string) {
    const {appPath} = splitLocalePath(pathname);

    return protectedAppPrefixes.some((prefix) => appPath === prefix || appPath.startsWith(`${prefix}/`));
}

async function hasSupabaseUser(request: NextRequest, response: NextResponse) {
    const supabaseUrl = getSupabaseUrl();
    const supabaseAuthKey = getSupabaseAuthKey();

    if (!supabaseUrl || !supabaseAuthKey) {
        return false;
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

    return Boolean(user);
}

export async function middleware(request: NextRequest) {
    const response = intlMiddleware(request);

    const sessionResponse = await updateSupabaseSession(request, response);

    if (!isProtectedAppPath(request.nextUrl.pathname)) {
        return sessionResponse;
    }

    if (await hasSupabaseUser(request, sessionResponse)) {
        return sessionResponse;
    }

    const {locale} = splitLocalePath(request.nextUrl.pathname);
    const signInUrl = request.nextUrl.clone();
    signInUrl.pathname = locale === localeConfig.defaultLocale ? "/account" : `/${locale}/account`;
    signInUrl.search = "";
    signInUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);

    return NextResponse.redirect(signInUrl);
}

export const config = {
    matcher: ["/((?!api|admin|_next|.*\\..*|legal|auth).*)"]
};
