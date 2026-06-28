import {Metadata} from "next";
import {localeConfig} from "@/i18n";
import {ContentImage} from "@/data/content-schema";
import {getAbsoluteAssetUrl, getLocalePath, getMetadataLocale} from "@/lib/site";

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
    canonicalUrl?: string;
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
    tags,
    canonicalUrl
}: BuildContentMetadataOptions): Metadata {
    const imageUrl = getAbsoluteAssetUrl(featuredImage.src);
    const brandedTitle = title.includes("AnimalDex") ? title : `${title} | AnimalDex`;
    const brandedImageAlt = featuredImage.alt.includes("AnimalDex") ? featuredImage.alt : `${featuredImage.alt} | AnimalDex`;
    const resolvedCanonical = canonicalUrl || getLocalePath(locale, pathname);

    return {
        title,
        description,
        keywords,
        alternates: {
            canonical: resolvedCanonical,
            languages: localeConfig.locales.reduce((acc, localeItem) => {
                acc[localeItem] = getLocalePath(localeItem, pathname);
                return acc;
            }, {
                "x-default": getLocalePath(localeConfig.defaultLocale, pathname)
            } as Record<string, string>)
        },
        openGraph: {
            type: "article",
            locale: getMetadataLocale(locale),
            title: brandedTitle,
            description,
            url: resolvedCanonical,
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
