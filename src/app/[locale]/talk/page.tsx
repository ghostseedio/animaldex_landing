import type {Metadata} from "next";
import {localeConfig} from "@/i18n";
import {getLocalePath, getMetadataLocale} from "@/lib/site";
import {loadLocaleMessages} from "@/loaders/locale";
import {talkWords} from "@/lib/ask-animaldex/talk";
import TalkPicker from "@/app/[locale]/talk/talk-picker";

/**
 * /talk: a new chat, the animal picker (docs/rich-chat/SPEC.md, section 4).
 * Indexable, and in the sitemap: it is the site's way into talking to the
 * animals. Rendered once per locale and kept; the animals load in the page.
 */

export const revalidate = 86400;

export function generateStaticParams() {
    return [];
}

export async function generateMetadata({params}: {params: {locale: string}}): Promise<Metadata> {
    const words = talkWords((await loadLocaleMessages(params.locale).catch(() => null))?.talkPage);
    const path = "/talk";
    return {
        title: words.metaTitle,
        description: words.metaDescription,
        alternates: {
            canonical: getLocalePath(params.locale, path),
            languages: localeConfig.locales.reduce((all, item) => {
                all[item] = getLocalePath(item, path);
                return all;
            }, {"x-default": getLocalePath(localeConfig.defaultLocale, path)} as Record<string, string>)
        },
        openGraph: {
            type: "website",
            locale: getMetadataLocale(params.locale),
            title: words.metaTitle,
            description: words.metaDescription,
            url: getLocalePath(params.locale, path)
        }
    };
}

export default async function TalkPage({params}: {params: {locale: string}}) {
    const words = talkWords((await loadLocaleMessages(params.locale).catch(() => null))?.talkPage);
    return <TalkPicker words={words} />;
}
