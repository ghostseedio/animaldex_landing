import createIntlMiddleware from "next-intl/middleware";
import {type NextRequest} from "next/server";
import {localeConfig} from "@/i18n";
import {updateSupabaseSession} from "@/lib/supabase/middleware";

const intlMiddleware = createIntlMiddleware(localeConfig);

export async function middleware(request: NextRequest) {
    const response = intlMiddleware(request);

    return updateSupabaseSession(request, response);
}

export const config = {
    matcher: ["/((?!api|admin|_next|.*\\..*|legal|auth).*)"]
};
