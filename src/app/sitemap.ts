import {MetadataRoute} from "next";
import {journalPosts} from "@/data/journal";
import {localeConfig} from "@/i18n";
import {getAbsoluteUrl} from "@/lib/site";
import {useCases} from "@/data/use-cases";
import {speciesEntries} from "@/data/species";
import {collectorPages} from "@/data/collector-pages";
import {blogPosts} from "@/data/blog";
import {answerPages} from "@/data/answer-pages";

export default function sitemap(): MetadataRoute.Sitemap {
    const now = new Date();

    return localeConfig.locales.flatMap((locale) => {
        const staticEntries: MetadataRoute.Sitemap = [
            {
                url: getAbsoluteUrl(locale),
                lastModified: now
            },
            {
                url: getAbsoluteUrl(locale, "/journal"),
                lastModified: now
            },
            {
                url: getAbsoluteUrl(locale, "/legal/privacy"),
                lastModified: now
            },
            {
                url: getAbsoluteUrl(locale, "/journal/feed.xml"),
                lastModified: now
            },
            {
                url: getAbsoluteUrl(locale, "/animals"),
                lastModified: now
            },
            {
                url: getAbsoluteUrl(locale, "/use-cases"),
                lastModified: now
            },
            {
                url: getAbsoluteUrl(locale, "/blog"),
                lastModified: now
            }
        ];

        const journalEntries = journalPosts.map((post) => ({
            url: getAbsoluteUrl(locale, `/journal/${post.slug}`),
            lastModified: new Date(post.updatedAt)
        }));

        const useCaseEntries = useCases.map((entry) => ({
            url: getAbsoluteUrl(locale, `/use-cases/${entry.slug}`),
            lastModified: new Date(entry.updatedAt)
        }));

        const speciesPages = speciesEntries.map((entry) => ({
            url: getAbsoluteUrl(locale, `/animals/${entry.slug}`),
            lastModified: new Date(entry.updatedAt)
        }));

        const collectorLandingPages = collectorPages.map((entry) => ({
            url: getAbsoluteUrl(locale, `/${entry.slug}`),
            lastModified: now
        }));

        const blogEntries = blogPosts.map((post) => ({
            url: getAbsoluteUrl(locale, `/blog/${post.slug}`),
            lastModified: new Date(post.updatedAt || post.publishedAt)
        }));

        const answerPageEntries = answerPages.map((entry) => ({
            url: getAbsoluteUrl(locale, `/${entry.slug}`),
            lastModified: new Date(entry.updatedAt)
        }));

        return [
            ...staticEntries,
            ...journalEntries,
            ...useCaseEntries,
            ...speciesPages,
            ...collectorLandingPages,
            ...blogEntries,
            ...answerPageEntries
        ];
    });
}
