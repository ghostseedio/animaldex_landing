import type {Metadata} from "next";
import {withBrandSuffix} from "@/lib/brand-title";
import {clampMetaDescription} from "@/lib/seo/page-metadata";
import {breadcrumbJsonLd, jsonLdHtml, talkJsonLd} from "@/lib/seo/structured-data";
import {localeConfig} from "@/i18n";
import {getLocalePath, getMetadataLocale} from "@/lib/site";
import {loadLocaleMessages} from "@/loaders/locale";
import {talkWords} from "@/lib/ask-animaldex/talk";
import {ogImagePath} from "@/lib/og/og-image";
import {getTalkPickerRows} from "@/data/talk-animals";
import {loadAppFeatureFlags} from "@/data/app-feature-flags";
import {isAppFeatureOn} from "@/lib/app-feature-flags";
import {TALK_FRONT_DOOR_FLAG, talkFrontDoorWords} from "@/lib/talk-front-door";
import TalkPicker from "@/app/[locale]/talk/talk-picker";

/**
 * /talk: a new chat, the animal picker (docs/rich-chat/SPEC.md, section 4).
 * Indexable, and in the sitemap: it is the site's way into talking to the
 * animals. Rendered once per locale and kept. Its first rows (the featured
 * animals and the pairs that disagree) are drawn here, a few KB with each
 * face's own address; the search index loads only once someone searches
 * (WEB-18, WEB-24).
 *
 * The Talk front door (AnimalDex docs/talk-front-door/SPEC.md, section 4.1)
 * sits above the picker while its remote switch is on: the switch as it was
 * when this page was drawn, then the live one, read in the browser, so a
 * page kept for a day follows the owner's switch within a minute.
 */

export const revalidate = 86400;

export function generateStaticParams() {
    return [];
}

export async function generateMetadata({params}: {params: {locale: string}}): Promise<Metadata> {
    const loaded = talkWords((await loadLocaleMessages(params.locale).catch(() => null))?.talkPage);
    // What a result shows of the description (the Indonesian one ran to 217 characters).
    const words = {...loaded, metaDescription: clampMetaDescription(loaded.metaDescription)};
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
            title: withBrandSuffix(words.metaTitle),
            description: words.metaDescription,
            url: getLocalePath(params.locale, path),
            siteName: "AnimalDex",
            images: [{url: image, width: 1200, height: 630, alt: words.ogAlt}]
        },
        // Its own title and card, never the home page's (WEB-14).
        twitter: {card: "summary_large_image", title: withBrandSuffix(words.metaTitle), description: words.metaDescription, images: [{url: image, alt: words.ogAlt}]}
    };
}

export default async function TalkPage({params}: {params: {locale: string}}) {
    const [messages, rows, flags] = await Promise.all([
        loadLocaleMessages(params.locale).catch(() => null),
        getTalkPickerRows().catch(() => ({popular: [], disagree: []})),
        loadAppFeatureFlags().catch(() => ({}))
    ]);
    const words = talkWords(messages?.talkPage);
    // The chat as schema.org says it (S1's audit: /talk had none): a free web application, part of the app.
    const schema = [
        talkJsonLd({locale: params.locale, name: words.metaTitle, description: words.metaDescription, image: ogImagePath("talk")}),
        breadcrumbJsonLd(params.locale, [{name: "AnimalDex", path: "/"}, {name: words.metaTitle, path: "/talk"}])
    ];
    return (
        <>
        <script type="application/ld+json" dangerouslySetInnerHTML={{__html: jsonLdHtml(schema)}} />
        <TalkPicker
            words={words}
            initial={rows}
            frontDoor={{enabled: isAppFeatureOn(flags, TALK_FRONT_DOOR_FLAG), words: talkFrontDoorWords(messages?.talkFrontDoor)}}
        />
        </>
    );
}
