import type {Metadata} from "next";
import {localeConfig} from "@/i18n";
import {getLocalePath, getMetadataLocale} from "@/lib/site";
import {loadLocaleMessages} from "@/loaders/locale";
import {talkWords} from "@/lib/ask-animaldex/talk";
import {ogImagePath} from "@/lib/og/og-image";
import {getTalkPickerRows} from "@/data/talk-animals";
import TalkPicker from "@/app/[locale]/talk/talk-picker";

/**
 * /talk: a new chat, the animal picker (docs/rich-chat/SPEC.md, section 4).
 * Indexable, and in the sitemap: it is the site's way into talking to the
 * animals. Rendered once per locale and kept. Its first rows (the featured
 * animals and the pairs that disagree) are drawn here, a few KB with each
 * face's own address; the search index loads only once someone searches
 * (WEB-18, WEB-24).
 */

export const revalidate = 86400;

export function generateStaticParams() {
    return [];
}

export async function generateMetadata({params}: {params: {locale: string}}): Promise<Metadata> {
    const words = talkWords((await loadLocaleMessages(params.locale).catch(() => null))?.talkPage);
    const path = "/talk";
    const image = ogImagePath("talk");
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
            url: getLocalePath(params.locale, path),
            images: [{url: image, width: 1200, height: 630, alt: words.ogAlt}]
        },
        // Its own title and card, never the home page's (WEB-14).
        twitter: {card: "summary_large_image", title: `${words.metaTitle} | AnimalDex`, description: words.metaDescription, images: [{url: image, alt: words.ogAlt}]}
    };
}

export default async function TalkPage({params}: {params: {locale: string}}) {
    const [messages, rows] = await Promise.all([
        loadLocaleMessages(params.locale).catch(() => null),
        getTalkPickerRows().catch(() => ({popular: [], disagree: []}))
    ]);
    return <TalkPicker words={talkWords(messages?.talkPage)} initial={rows} />;
}
