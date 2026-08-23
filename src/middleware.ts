import createIntlMiddleware from "next-intl/middleware";
import {createServerClient} from "@supabase/ssr";
import {type NextRequest, NextResponse} from "next/server";
import {localeConfig} from "@/i18n";
import {updateSupabaseSession} from "@/lib/supabase/middleware";
import {getSupabaseAuthKey, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";

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
    "/app/earnings",
    "/app/sets",
    "/app/trades",
    "/app/train"
];

const selfRenderedCmsPageSlugs = new Set([
    "best-animal-identification-app",
    "what-is-animal-collecting",
    "pokemon-like-animal-app",
    "animal-collection-app",
    "animal-identifier-app",
    "ai-animal-scanner",
    "identify-insects",
    "identify-birds",
    "identify-reptiles",
    "identify-pets",
    "wildlife-discovery-app",
    "animal-breed-price-estimator",
    "animal-breed-grading-app",
    "sell-custom-animal-cards",
    "learn-from-animals"
]);

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

function isSingleSegmentPublicPage(appPath: string) {
    if (appPath === "/" || appPath.startsWith("/managed-content")) return false;
    if (appPath.startsWith("/app") || appPath.startsWith("/blog") || appPath.startsWith("/p/") || appPath.startsWith("/u/")) return false;
    if (appPath.includes(".")) return false;
    return appPath.split("/").filter(Boolean).length === 1;
}

async function hasPublishedManagedPage(slug: string) {
    const supabaseUrl = getSupabaseUrl();
    const serviceKey = getSupabaseServiceKey();

    if (!supabaseUrl || !serviceKey) return false;

    try {
        const response = await fetch(`${supabaseUrl}/rest/v1/admin_content_entries?content_type=eq.page&slug=eq.${encodeURIComponent(slug)}&is_published=eq.true&select=id&limit=1`, {
            headers: {
                apikey: serviceKey,
                Authorization: `Bearer ${serviceKey}`,
                Accept: "application/json"
            },
            cache: "no-store"
        });
        if (!response.ok) return false;
        const rows = await response.json() as Array<{id: string}>;
        return rows.length > 0;
    } catch {
        return false;
    }
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
    const {locale, appPath} = splitLocalePath(request.nextUrl.pathname);

    if (isSingleSegmentPublicPage(appPath)) {
        const slug = appPath.slice(1);
        const isCmsSourceRequest = request.nextUrl.searchParams.get("cmsSource") === "1"
            || request.headers.get("x-animaldex-cms-source") === "1";
        if (!isCmsSourceRequest && !selfRenderedCmsPageSlugs.has(slug) && await hasPublishedManagedPage(slug)) {
            const rewriteUrl = request.nextUrl.clone();
            rewriteUrl.pathname = `/${locale}/managed-content/${slug}`;
            return NextResponse.rewrite(rewriteUrl, sessionResponse);
        }
    }

    if (!isProtectedAppPath(request.nextUrl.pathname)) {
        return sessionResponse;
    }

    if (await hasSupabaseUser(request, sessionResponse)) {
        return sessionResponse;
    }

    const signInUrl = request.nextUrl.clone();
    signInUrl.pathname = locale === localeConfig.defaultLocale ? "/account" : `/${locale}/account`;
    signInUrl.search = "";
    signInUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);

    return NextResponse.redirect(signInUrl);
}

export const config = {
    matcher: ["/((?!api|admin|_next|.*\\..*|legal|auth).*)"]
};
