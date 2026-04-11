import {Metadata} from "next";
import {localeConfig} from "@/i18n";
import {ContentImage} from "@/data/content-schema";
import {getAbsoluteUrl, getLocalePath, getMetadataLocale} from "@/lib/site";

type BuildContentMetadataOptions = {
    locale: string;
    pathname: string;
    title: string;
    description: string;
    keywords?: string[];
    featuredImage: ContentImage;
    publishedAt?: string;
    updatedAt?: string;
    tags?: string[];
};

export function buildContentMetadata({
    locale,
    pathname,
    title,
    description,
    keywords,
    featuredImage,
    publishedAt,
    updatedAt,
    tags
}: BuildContentMetadataOptions): Metadata {
    const imageUrl = getAbsoluteUrl(locale, featuredImage.src);
    const brandedTitle = title.includes("AnimalDex") ? title : `${title} | AnimalDex`;
    const brandedImageAlt = featuredImage.alt.includes("AnimalDex") ? featuredImage.alt : `${featuredImage.alt} | AnimalDex`;

    return {
        title,
        description,
        keywords,
        alternates: {
            canonical: getLocalePath(locale, pathname),
            languages: localeConfig.locales.reduce((acc, localeItem) => {
                acc[localeItem] = `/${localeItem}${pathname}`;
                return acc;
            }, {
                "x-default": `/${localeConfig.defaultLocale}${pathname}`
            } as Record<string, string>)
        },
        openGraph: {
            type: "article",
            locale: getMetadataLocale(locale),
            title: brandedTitle,
            description,
            url: getLocalePath(locale, pathname),
            publishedTime: publishedAt,
            modifiedTime: updatedAt,
            tags,
            images: [
                {
                    url: imageUrl,
                    width: featuredImage.width,
                    height: featuredImage.height,
                    alt: brandedImageAlt
                }
            ]
        },
        twitter: {
            card: "summary_large_image",
            title: brandedTitle,
            description,
            images: [
                {
                    url: imageUrl,
                    alt: brandedImageAlt
                }
            ]
        }
    };
}
