import {Metadata} from "next";
import {notFound} from "next/navigation";
import Link from "@/app/[locale]/_components/link";
import {getRelatedUseCases, getUseCase, useCases} from "@/data/use-cases";
import {getAbsoluteUrl, getLocalePath, getMetadataLocale} from "@/lib/site";
import {localeConfig} from "@/i18n";
import {getScopedTranslator} from "@/loaders/translation";

type UseCasePageProps = {
    params: {
        locale: string;
        slug: string;
    };
};

function formatDate(locale: string, date: string) {
    return new Intl.DateTimeFormat(locale, {dateStyle: "long"}).format(new Date(date));
}

export async function generateMetadata({params}: UseCasePageProps): Promise<Metadata> {
    const {locale, slug} = params;
    const entry = getUseCase(slug);
    const t = await getScopedTranslator(locale, "useCases");

    if (!entry) {
        return {};
    }

    return {
        title: entry.title,
        description: entry.description,
        keywords: [...entry.searchIntents, entry.audience],
        alternates: {
            canonical: getLocalePath(locale, `/use-cases/${entry.slug}`),
            languages: localeConfig.locales.reduce((acc, localeItem) => {
                acc[localeItem] = `/${localeItem}/use-cases/${entry.slug}`;
                return acc;
            }, {
                "x-default": `/${localeConfig.defaultLocale}/use-cases/${entry.slug}`
            } as Record<string, string>)
        },
        openGraph: {
            type: "article",
            locale: getMetadataLocale(locale),
            title: `${entry.title} | AnimalDex`,
            description: entry.description,
            url: getLocalePath(locale, `/use-cases/${entry.slug}`),
            modifiedTime: entry.updatedAt,
            tags: entry.searchIntents,
            images: [
                {
                    url: "/images/og-animaldex.svg",
                    width: 1200,
                    height: 630,
                    alt: `${entry.title} | AnimalDex`
                }
            ]
        },
        twitter: {
            card: "summary_large_image",
            title: `${entry.title} | AnimalDex`,
            description: entry.description,
            images: ["/images/og-animaldex.svg"]
        },
        other: {
            "article:author": "AnimalDex",
            "article:section": t("metaSection")
        }
    };
}

export function generateStaticParams() {
    return useCases.map((entry) => ({slug: entry.slug}));
}

export default async function UseCasePage({params}: UseCasePageProps) {
    const {locale, slug} = params;
    const t = await getScopedTranslator(locale, "useCases");
    const entry = getUseCase(slug);

    if (!entry) {
        notFound();
    }

    const pageUrl = getAbsoluteUrl(locale, `/use-cases/${entry.slug}`);
    const related = getRelatedUseCases(entry.slug, 3);
    const schema = {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: entry.title,
        description: entry.description,
        inLanguage: locale,
        url: pageUrl,
        dateModified: entry.updatedAt,
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
        <article className="w-full max-w-5xl mx-auto px-4 md:px-8 py-16 md:py-24 flex flex-col gap-10">
            <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify([schema, faqSchema])}} />

            <div className="flex flex-col gap-4">
                <Link href="/use-cases" className="text-primary-200 hover:text-primary-100 transition-colors w-fit" underline>
                    {t("back")}
                </Link>
                <p className="text-primary-200 text-sm uppercase tracking-[0.14em]">{entry.shortLabel}</p>
                <h1 className="font-display font-bold text-5xl md:text-6xl text-white">{entry.title}</h1>
                <p className="text-lg md:text-xl xl:text-2xl text-ink-200">{entry.description}</p>
                <div className="text-ink-300 text-sm md:text-base">
                    <span className="text-white">{t("audienceLabel")}: </span>
                    {entry.audience}
                </div>
                <div className="text-ink-300 text-sm md:text-base">
                    <span className="text-white">{t("updatedLabel")}: </span>
                    {formatDate(locale, entry.updatedAt)}
                </div>
                <div className="flex flex-wrap gap-2">
                    {entry.searchIntents.map((intent) => (
                        <span key={intent} className="rounded-full border border-primary-500/30 px-3 py-1 text-primary-200 text-xs">
                            {intent}
                        </span>
                    ))}
                </div>
            </div>

            <div className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-8">
                {entry.sections.map((section) => (
                    <section key={section.title} className="flex flex-col gap-3">
                        <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{section.title}</h2>
                        {section.paragraphs.map((paragraph) => (
                            <p key={paragraph} className="text-ink-200 text-lg md:text-xl leading-8">
                                {paragraph}
                            </p>
                        ))}
                    </section>
                ))}
            </div>

            <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("actionsTitle")}</h2>
                <ul className="flex flex-col gap-2 text-ink-200 text-lg md:text-xl list-disc pl-5">
                    {entry.keyActions.map((action) => (
                        <li key={action}>{action}</li>
                    ))}
                </ul>
            </section>

            <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("differenceTitle")}</h2>
                <ul className="flex flex-col gap-2 text-ink-200 text-lg md:text-xl list-disc pl-5">
                    {entry.whyDifferent.map((point) => (
                        <li key={point}>{point}</li>
                    ))}
                </ul>
            </section>

            <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("faqTitle")}</h2>
                {entry.faq.map((item) => (
                    <div key={item.question} className="rounded-2xl border border-line-300/80 bg-surface-800/60 p-5">
                        <h3 className="text-white text-xl font-semibold">{item.question}</h3>
                        <p className="text-ink-200 text-base md:text-lg mt-2">{item.answer}</p>
                    </div>
                ))}
            </section>

            {related.length > 0 && (
                <section className="flex flex-col gap-4">
                    <h2 className="font-display font-bold text-4xl text-white">{t("relatedTitle")}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {related.map((item) => (
                            <article
                                key={item.slug}
                                className="rounded-3xl border border-line-300 bg-surface-900/80 backdrop-blur p-5 flex flex-col gap-3"
                            >
                                <h3 className="font-display font-bold text-2xl text-white">{item.title}</h3>
                                <p className="text-ink-200 text-base">{item.description}</p>
                                <Link
                                    href={`/use-cases/${item.slug}`}
                                    className="mt-auto text-primary-200 hover:text-primary-100 transition-colors"
                                    underline
                                >
                                    {t("readCase")}
                                </Link>
                            </article>
                        ))}
                    </div>
                </section>
            )}

            <div className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4 text-center">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("ctaTitle")}</h2>
                <p className="text-ink-200 text-lg md:text-xl">{t("ctaDescription")}</p>
                <div className="flex justify-center">
                    <Link href="/#download" underline className="text-primary-200 text-lg hover:text-primary-100 transition-colors">
                        {t("ctaButton")}
                    </Link>
                </div>
            </div>
        </article>
    );
}
