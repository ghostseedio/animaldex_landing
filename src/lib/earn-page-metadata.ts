import type {Metadata} from "next";
import {localeConfig} from "@/i18n";
import {getAbsoluteUrl, getLocalePath, getMetadataLocale} from "@/lib/site";

export function buildEarnPageMetadata(options: {
    locale: string;
    path: string;
    title: string;
    description: string;
    keywords?: string[];
}): Metadata {
    const {locale, path, title, description, keywords} = options;
    const canonical = getLocalePath(locale, path);
    const url = getAbsoluteUrl(locale, path);

    return {
        title,
        description,
        keywords,
        alternates: {
            canonical,
            languages: localeConfig.locales.reduce((languages, item) => {
                languages[item] = getLocalePath(item, path);
                return languages;
            }, {"x-default": getLocalePath(localeConfig.defaultLocale, path)} as Record<string, string>)
        },
        openGraph: {
            type: "website",
            locale: getMetadataLocale(locale),
            title,
            description,
            url,
            images: [{url: "/images/og-animaldex.svg", width: 1200, height: 630, alt: title}]
        },
        twitter: {
            card: "summary_large_image",
            title,
            description,
            images: ["/images/og-animaldex.svg"]
        }
    };
}

export function earnBreadcrumbList(locale: string, crumbs: Array<{name: string; path: string}>) {
    return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: crumbs.map((crumb, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: crumb.name,
            item: getAbsoluteUrl(locale, crumb.path)
        }))
    };
}

export function earnFaqSchema(locale: string, path: string, name: string, items: Array<{question: string; answer: string}>) {
    return {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        name,
        url: getAbsoluteUrl(locale, path),
        inLanguage: locale,
        mainEntity: items.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: {
                "@type": "Answer",
                text: item.answer
            }
        }))
    };
}
