import {getLocale, getTranslations} from "next-intl/server";
import {Metadata} from "next";
import {notFound} from "next/navigation";
import Link from "@/app/[locale]/_components/link";
import Button from "@/app/[locale]/_components/button";
import {answerPages, getAnswerPage, getRelatedAnswerPages} from "@/data/answer-pages";
import {getBlogPost} from "@/data/blog";
import {getSpeciesBySlug} from "@/data/species";
import {loadLocaleMessages} from "@/loaders/locale";
import {getAbsoluteUrl, getLocalePath, getMetadataLocale} from "@/lib/site";
import {localeConfig} from "@/i18n";

type AnswerPageProps = {
    slug: string;
};

export async function generateAnswerPageMetadata(slug: string): Promise<Metadata> {
    const locale = await getLocale();
    const entry = getAnswerPage(slug);
    const messages = await loadLocaleMessages(locale);
    const baseKeywords = Array.isArray(messages.meta?.keywords) ? messages.meta.keywords : [];

    if (!entry) {
        return {};
    }

    return {
        title: entry.metaTitle,
        description: entry.metaDescription,
        keywords: [...baseKeywords, ...entry.searchIntents],
        alternates: {
            canonical: getLocalePath(locale, `/${entry.slug}`),
            languages: localeConfig.locales.reduce((acc, localeItem) => {
                acc[localeItem] = `/${localeItem}/${entry.slug}`;
                return acc;
            }, {
                "x-default": `/${localeConfig.defaultLocale}/${entry.slug}`
            } as Record<string, string>)
        },
        openGraph: {
            type: "article",
            locale: getMetadataLocale(locale),
            title: `${entry.metaTitle} | AnimalDex`,
            description: entry.metaDescription,
            url: getLocalePath(locale, `/${entry.slug}`),
            modifiedTime: entry.updatedAt,
            tags: entry.searchIntents,
            images: [
                {
                    url: "/images/og-animaldex.svg",
                    width: 1200,
                    height: 630,
                    alt: `${entry.metaTitle} | AnimalDex`
                }
            ]
        },
        twitter: {
            card: "summary_large_image",
            title: `${entry.metaTitle} | AnimalDex`,
            description: entry.metaDescription,
            images: ["/images/og-animaldex.svg"]
        }
    };
}

export default async function AnswerPage({slug}: AnswerPageProps) {
    const t = await getTranslations("answerPages");
    const locale = await getLocale();
    const entry = getAnswerPage(slug);

    if (!entry) {
        notFound();
    }

    const relatedPages = getRelatedAnswerPages(entry.slug, 5);
    const relatedSpecies = entry.speciesSlugs
        .map((speciesSlug) => getSpeciesBySlug(speciesSlug))
        .filter((item): item is NonNullable<ReturnType<typeof getSpeciesBySlug>> => Boolean(item));
    const relatedBlogs = entry.blogSlugs
        .map((blogSlug) => getBlogPost(blogSlug))
        .filter((item): item is NonNullable<ReturnType<typeof getBlogPost>> => Boolean(item));

    const pageUrl = getAbsoluteUrl(locale, `/${entry.slug}`);
    const articleSchema = {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: entry.heroTitle,
        description: entry.metaDescription,
        dateModified: entry.updatedAt,
        inLanguage: locale,
        url: pageUrl,
        author: {"@type": "Organization", name: "AnimalDex"},
        publisher: {"@type": "Organization", name: "AnimalDex"},
        about: entry.searchIntents.map((intent) => ({
            "@type": "Thing",
            name: intent
        }))
    };
    const faqSchema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: entry.faq.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: {
                "@type": "Answer",
                text: item.answer
            }
        }))
    };

    return (
        <article className="w-full max-w-6xl mx-auto px-4 md:px-8 py-16 md:py-24 flex flex-col gap-10">
            <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify([articleSchema, faqSchema])}} />

            <div className="flex flex-col gap-4">
                <Link href="/" className="text-primary-200 hover:text-primary-100 transition-colors w-fit" underline>
                    {t("back")}
                </Link>
                <h1 className="font-display font-bold text-5xl md:text-6xl text-white">{entry.heroTitle}</h1>
                <p className="text-lg md:text-xl xl:text-2xl text-ink-200">{entry.intro}</p>
                <div className="flex flex-wrap gap-2">
                    {entry.searchIntents.map((intent) => (
                        <span key={intent} className="rounded-full border border-primary-500/30 px-3 py-1 text-primary-200 text-xs">
                            {intent}
                        </span>
                    ))}
                </div>
            </div>

            <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("directAnswerTitle")}</h2>
                {entry.directAnswer.map((paragraph) => (
                    <p key={paragraph} className="text-ink-200 text-lg md:text-xl leading-8">
                        {paragraph}
                    </p>
                ))}
            </section>

            <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("howItWorksTitle")}</h2>
                {entry.howItWorks.map((paragraph) => (
                    <p key={paragraph} className="text-ink-200 text-lg md:text-xl leading-8">
                        {paragraph}
                    </p>
                ))}
            </section>

            <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-6">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("differentTitle")}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-3xl border border-line-300/80 bg-surface-800/60 p-5 flex flex-col gap-3">
                        <h3 className="text-white text-2xl font-semibold">{t("typicalAppsTitle")}</h3>
                        <ul className="flex flex-col gap-2 text-ink-200 text-base md:text-lg list-disc pl-5">
                            {entry.comparisonTypical.map((item) => (
                                <li key={item}>{item}</li>
                            ))}
                        </ul>
                    </div>
                    <div className="rounded-3xl border border-primary-500/30 bg-surface-800/60 p-5 flex flex-col gap-3">
                        <h3 className="text-white text-2xl font-semibold">{t("animalDexDifferentTitle")}</h3>
                        <ul className="flex flex-col gap-2 text-ink-200 text-base md:text-lg list-disc pl-5">
                            {entry.comparisonAnimalDex.map((item) => (
                                <li key={item}>{item}</li>
                            ))}
                        </ul>
                    </div>
                </div>
            </section>

            <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("whoForTitle")}</h2>
                <ul className="flex flex-col gap-2 text-ink-200 text-lg md:text-xl list-disc pl-5">
                    {entry.whoItsFor.map((item) => (
                        <li key={item}>{item}</li>
                    ))}
                </ul>
            </section>

            <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("featureTitle")}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {entry.features.map((feature) => (
                        <article key={feature.title} className="rounded-3xl border border-line-300/80 bg-surface-800/60 p-5 flex flex-col gap-2">
                            <h3 className="text-white text-2xl font-semibold">{feature.title}</h3>
                            <p className="text-ink-200 text-base md:text-lg">{feature.description}</p>
                        </article>
                    ))}
                </div>
            </section>

            <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-6">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("exploreTitle")}</h2>
                <p className="text-ink-200 text-lg md:text-xl">{t("exploreDescription")}</p>

                {relatedSpecies.length > 0 && (
                    <div className="flex flex-col gap-3">
                        <h3 className="text-white text-2xl font-semibold">{t("speciesLinksTitle")}</h3>
                        <div className="flex flex-wrap gap-2">
                            {relatedSpecies.map((species) => (
                                <Link
                                    key={species.slug}
                                    href={`/animals/${species.slug}`}
                                    className="rounded-full border border-primary-500/30 px-3 py-1 text-primary-200 hover:text-primary-100 text-sm"
                                >
                                    {species.name}
                                </Link>
                            ))}
                        </div>
                    </div>
                )}

                {relatedBlogs.length > 0 && (
                    <div className="flex flex-col gap-3">
                        <h3 className="text-white text-2xl font-semibold">{t("blogLinksTitle")}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {relatedBlogs.map((post) => (
                                <article key={post.slug} className="rounded-2xl border border-line-300/80 bg-surface-800/60 p-4 flex flex-col gap-2">
                                    <h4 className="text-white text-xl font-semibold">{post.title}</h4>
                                    <p className="text-ink-200 text-base">{post.description}</p>
                                    <Link href={`/blog/${post.slug}`} className="text-primary-200 hover:text-primary-100 transition-colors" underline>
                                        {t("readArticle")}
                                    </Link>
                                </article>
                            ))}
                        </div>
                    </div>
                )}

                {relatedPages.length > 0 && (
                    <div className="flex flex-col gap-3">
                        <h3 className="text-white text-2xl font-semibold">{t("answerLinksTitle")}</h3>
                        <div className="flex flex-wrap gap-2">
                            {relatedPages.map((page) => (
                                <Link
                                    key={page.slug}
                                    href={`/${page.slug}`}
                                    className="rounded-full border border-primary-500/30 px-3 py-1 text-primary-200 hover:text-primary-100 text-sm"
                                >
                                    {page.shortTitle}
                                </Link>
                            ))}
                        </div>
                    </div>
                )}
            </section>

            <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("faqTitle")}</h2>
                <p className="text-ink-200 text-lg md:text-xl">{t("faqDescription")}</p>
                {entry.faq.map((item) => (
                    <div key={item.question} className="rounded-2xl border border-line-300/80 bg-surface-800/60 p-5">
                        <h3 className="text-white text-xl font-semibold">{item.question}</h3>
                        <p className="text-ink-200 text-base md:text-lg mt-2">{item.answer}</p>
                    </div>
                ))}
            </section>

            <div className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4 text-center">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("ctaTitle")}</h2>
                <p className="text-ink-200 text-lg md:text-xl">{t("ctaDescription")}</p>
                <div className="flex justify-center flex-wrap gap-3">
                    <Link href="/#download">
                        <Button as="span">{t("ctaButton")}</Button>
                    </Link>
                    <Link href="/">
                        <Button as="span">{t("landingButton")}</Button>
                    </Link>
                </div>
            </div>
        </article>
    );
}

export function getAnswerStaticParams() {
    return answerPages.map((entry) => ({slug: entry.slug}));
}
