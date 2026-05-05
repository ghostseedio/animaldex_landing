import {getLocale, getTranslations} from "next-intl/server";
import Link from "@/app/[locale]/_components/link";
import {
    getJournalAudienceCoverage,
    getJournalLastUpdatedAt,
    getJournalSearchCoverage,
    journalPosts
} from "@/data/journal";
import {journalRoadmap} from "@/data/journal-roadmap";
import {Metadata} from "next";
import {loadLocaleMessages} from "@/loaders/locale";
import {getAbsoluteUrl, getLocalePath, getMetadataLocale} from "@/lib/site";
import {localeConfig} from "@/i18n";

function formatDate(locale: string, date: string) {
    return new Intl.DateTimeFormat(locale, {dateStyle: "long"}).format(new Date(date));
}

export async function generateMetadata(): Promise<Metadata> {
    const locale = await getLocale();
    const messages = await loadLocaleMessages(locale);
    const keywords = Array.isArray(messages.meta?.keywords) ? messages.meta.keywords : [];
    const roadmapKeywords = Array.from(new Set(journalRoadmap.flatMap((item) => item.searchIntents)));
    const title = "AnimalDex Journal";
    const description = messages.journal?.description || messages.meta?.description || "";

    return {
        title,
        description,
        keywords: [...keywords, ...roadmapKeywords, "animal guides", "wildlife spotting tips", "animal learning articles"],
        alternates: {
            canonical: getLocalePath(locale, "/journal"),
            languages: localeConfig.locales.reduce((acc, localeItem) => {
                acc[localeItem] = `/${localeItem}/journal`;
                return acc;
            }, {
                "x-default": `/${localeConfig.defaultLocale}/journal`
            } as Record<string, string>)
        },
        openGraph: {
            type: "website",
            locale: getMetadataLocale(locale),
            title: `${title} | AnimalDex`,
            description,
            url: getLocalePath(locale, "/journal"),
            images: [
                {
                    url: "/images/og.png",
                    width: 1200,
                    height: 630,
                    alt: `${title} | AnimalDex`
                }
            ]
        },
        twitter: {
            card: "summary_large_image",
            title: `${title} | AnimalDex`,
            description,
            images: ["/images/og.png"]
        }
    };
}

export default async function JournalIndex() {
    const t = await getTranslations("journal");
    const locale = await getLocale();
    const pageUrl = getAbsoluteUrl(locale, "/journal");
    const lastUpdatedAt = getJournalLastUpdatedAt();
    const searchCoverage = getJournalSearchCoverage();
    const audienceCoverage = getJournalAudienceCoverage();
    const schema = {
        "@context": "https://schema.org",
        "@type": "Blog",
        name: "AnimalDex Journal",
        url: pageUrl,
        inLanguage: locale,
        description: t("description"),
        blogPost: journalPosts.map((post) => ({
            "@type": "BlogPosting",
            headline: post.title,
            description: post.description,
            url: getAbsoluteUrl(locale, `/journal/${post.slug}`),
            datePublished: post.publishedAt,
            dateModified: post.updatedAt
        })),
        hasPart: journalRoadmap.map((item) => ({
            "@type": "CreativeWork",
            name: item.title,
            description: item.description
        }))
    };

    return (
        <section className="w-full max-w-6xl mx-auto px-4 md:px-8 py-16 md:py-24 flex flex-col gap-12">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{__html: JSON.stringify(schema)}}
            />

            <div className="flex flex-col gap-4 text-center items-center">
                <p className="text-primary-200 font-medium uppercase tracking-[0.2em] text-sm">{t("eyebrow")}</p>
                <h1 className="font-display font-bold text-5xl md:text-6xl lg:text-7xl text-white max-w-4xl">{t("title")}</h1>
                <p className="text-lg md:text-xl xl:text-2xl text-ink-200 max-w-4xl">{t("description")}</p>
            </div>

            <div className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("promiseTitle")}</h2>
                <p className="text-ink-200 text-lg md:text-xl">{t("promiseDescription")}</p>
            </div>

            <div className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("freshnessTitle")}</h2>
                <p className="text-ink-200 text-lg md:text-xl">{t("freshnessDescription")}</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-2">
                    <div className="rounded-2xl border border-line-300/80 bg-surface-800/60 p-4">
                        <p className="text-ink-300 text-sm">{t("freshnessPosts")}</p>
                        <p className="text-2xl font-display font-bold text-white">{journalPosts.length}</p>
                    </div>
                    <div className="rounded-2xl border border-line-300/80 bg-surface-800/60 p-4">
                        <p className="text-ink-300 text-sm">{t("freshnessCoverage")}</p>
                        <p className="text-2xl font-display font-bold text-white">{searchCoverage.length}</p>
                    </div>
                    <div className="rounded-2xl border border-line-300/80 bg-surface-800/60 p-4">
                        <p className="text-ink-300 text-sm">{t("freshnessLastUpdated")}</p>
                        <p className="text-2xl font-display font-bold text-white">
                            {lastUpdatedAt ? formatDate(locale, lastUpdatedAt) : "-"}
                        </p>
                    </div>
                </div>
                <Link
                    href="/journal/feed.xml"
                    className="text-primary-200 text-lg hover:text-primary-100 transition-colors w-fit mt-1"
                    underline
                >
                    {t("rssLabel")}
                </Link>
            </div>

            <div className="flex flex-col gap-4">
                <h2 className="font-display font-bold text-4xl md:text-5xl text-white">{t("latestTitle")}</h2>
                <p className="text-ink-200 text-lg md:text-xl max-w-3xl">{t("latestDescription")}</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {journalPosts.map((post) => (
                    <article
                        key={post.slug}
                        className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur p-6 md:p-8 flex flex-col gap-5"
                    >
                        <div className="flex flex-wrap gap-2 text-sm text-primary-200">
                            {post.tags.map((tag) => (
                                <span key={tag} className="rounded-full border border-primary-500/30 px-3 py-1">
                                    {tag}
                                </span>
                            ))}
                        </div>
                        <div className="flex flex-col gap-3">
                            <h3 className="font-display font-bold text-3xl text-white">{post.title}</h3>
                            <p className="text-ink-200 text-lg">{post.description}</p>
                        </div>
                        <div className="text-ink-300 text-sm md:text-base flex flex-wrap gap-4">
                            <span>{t("published")} {formatDate(locale, post.publishedAt)}</span>
                            <span>{t("updated")} {formatDate(locale, post.updatedAt)}</span>
                            <span>{post.readingMinutes} {t("minutes")}</span>
                        </div>
                        <Link
                            href={`/journal/${post.slug}`}
                            className="mt-auto text-primary-200 text-lg md:text-xl hover:text-primary-100 transition-colors"
                            underline
                        >
                            {t("readArticle")}
                        </Link>
                    </article>
                ))}
            </div>

            <div className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("coverageTitle")}</h2>
                <p className="text-ink-200 text-lg md:text-xl">{t("coverageDescription")}</p>
                <div className="flex flex-col gap-2">
                    <h3 className="text-white text-xl font-semibold">{t("coverageAudiences")}</h3>
                    <div className="flex flex-wrap gap-2">
                        {audienceCoverage.map((audience) => (
                            <span
                                key={audience}
                                className="rounded-full border border-primary-500/30 px-3 py-1 text-primary-200 text-sm"
                            >
                                {audience}
                            </span>
                        ))}
                    </div>
                </div>
                <div className="flex flex-col gap-2">
                    <h3 className="text-white text-xl font-semibold">{t("coverageIntents")}</h3>
                    <div className="flex flex-wrap gap-2">
                        {searchCoverage.map((intent) => (
                            <span
                                key={intent}
                                className="rounded-full border border-line-300/80 px-3 py-1 text-ink-200 text-sm"
                            >
                                {intent}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex flex-col gap-4">
                <h2 className="font-display font-bold text-4xl md:text-5xl text-white">{t("roadmapTitle")}</h2>
                <p className="text-ink-200 text-lg md:text-xl max-w-4xl">{t("roadmapDescription")}</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {journalRoadmap.map((item) => (
                    <article
                        key={item.slug}
                        className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur p-6 md:p-8 flex flex-col gap-4"
                    >
                        <div className="flex flex-wrap gap-2 text-sm text-primary-200">
                            {item.audiences.map((audience) => (
                                <span key={audience} className="rounded-full border border-primary-500/30 px-3 py-1">
                                    {audience}
                                </span>
                            ))}
                        </div>
                        <h3 className="font-display font-bold text-2xl md:text-3xl text-white">{item.title}</h3>
                        <p className="text-ink-200 text-lg">{item.description}</p>
                        <div className="text-ink-300 text-sm md:text-base flex flex-wrap gap-4">
                            <span>{t("plannedFor")} {item.targetMonth}</span>
                            <span>{item.status === "research" ? t("statusResearch") : item.status === "drafting" ? t("statusDrafting") : t("statusPlanned")}</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {item.searchIntents.map((intent) => (
                                <span
                                    key={intent}
                                    className="rounded-full border border-line-300/80 px-3 py-1 text-ink-200 text-xs"
                                >
                                    {intent}
                                </span>
                            ))}
                        </div>
                    </article>
                ))}
            </div>
        </section>
    );
}
