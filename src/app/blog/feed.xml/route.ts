import {GET as getLocalizedBlogFeed} from "@/app/[locale]/(composited)/blog/feed.xml/route";
import {localeConfig} from "@/i18n";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
    return getLocalizedBlogFeed(request, {
        params: {
            locale: localeConfig.defaultLocale
        }
    });
}
