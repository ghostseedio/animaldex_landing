import {Metadata} from "next";
import {notFound} from "next/navigation";
import Link from "@/app/[locale]/_components/link";
import {getRelatedUseCases, getUseCase} from "@/data/use-cases";
import {getAbsoluteUrl, getLocalePath, getMetadataLocale} from "@/lib/site";
import {localeConfig} from "@/i18n";
import {getScopedTranslator} from "@/loaders/translation";
import StoreLinks from "@/app/[locale]/(composited)/_components/store-links";

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

    if (!entry) return {};

    return {
        title: entry.title,
        description: entry.description,
        keywords: [...entry.searchIntents, entry.audience],
        alternates: {
            canonical: getLocalePath(locale, `/use-cases/${entry.slug}`),
            languages: localeConfig.locales.reduce((acc, localeItem) => {
                acc[localeItem] = getLocalePath(localeItem, `/use-cases/${entry.slug}`);
                return acc;
            }, {
                "x-default": getLocalePath(localeConfig.defaultLocale, `/use-cases/${entry.slug}`)
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
                    url: "/images/og.png",
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
            images: ["/images/og.png"]
        },
        other: {
            "article:author": "AnimalDex",
            "article:section": t("metaSection")
        }
    };
}

export default async function UseCasePage({params}: UseCasePageProps) {
    const {locale, slug} = params;
    const t = await getScopedTranslator(locale, "useCases");
    const entry = getUseCase(slug);

    if (!entry) notFound();

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
        <article className="w-full max-w-[88rem] mx-auto px-4 md:px-8 py-10 md:py-16">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{__html: JSON.stringify([schema, faqSchema])}}
            />

            <header className="max-w-4xl mx-auto text-center flex flex-col items-center gap-5">
                <Link href="/use-cases" className="text-primary-200 hover:text-primary-100 text-sm" underline>
                    {t("back")}
                </Link>

                <p className="text-primary-200 text-xs md:text-sm uppercase tracking-[0.22em]">
                    {entry.shortLabel}
                </p>

                <h1 className="font-display font-bold text-4xl md:text-6xl text-white leading-[0.95]">
                    {entry.title}
                </h1>

                <p className="text-base md:text-xl text-ink-200 leading-8 max-w-3xl">
                    {entry.description}
                </p>

                <div className="flex flex-wrap justify-center gap-2 pt-1">
                    {entry.searchIntents.slice(0, 6).map((intent) => (
                        <span
                            key={intent}
                            className="rounded-full border border-primary-500/25 bg-primary-500/5 px-3 py-1 text-primary-200 text-xs"
                        >
                            {intent}
                        </span>
                    ))}
                </div>
            </header>

            <section className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-10 md:mt-14">
                <StatCard label={t("audienceLabel")} value={entry.audience} />
                <StatCard label={t("updatedLabel")} value={formatDate(locale, entry.updatedAt)} />
                <StatCard label="Path" value={entry.shortLabel} />
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-[18rem_1fr] gap-6 mt-8 md:mt-12">
                <aside className="hidden lg:block">
                    <div className="sticky top-24 rounded-3xl border border-line-300 bg-surface-900/70 backdrop-blur p-5">
                        <p className="text-primary-200 text-xs uppercase tracking-[0.18em] mb-4">
                            On this page
                        </p>

                        <nav className="flex flex-col gap-2 text-sm">
                            <a href="#overview" className="text-ink-200 hover:text-white transition-colors">Overview</a>
                            <a href="#actions" className="text-ink-200 hover:text-white transition-colors">What you can do</a>
                            <a href="#difference" className="text-ink-200 hover:text-white transition-colors">Why it is different</a>
                            <a href="#faq" className="text-ink-200 hover:text-white transition-colors">FAQ</a>
                            {related.length > 0 && (
                                <a href="#related" className="text-ink-200 hover:text-white transition-colors">Related paths</a>
                            )}
                        </nav>

                        <div className="mt-6 pt-5 border-t border-line-300/70">
                            <p className="text-white font-display font-bold text-xl">
                                Ready to try it?
                            </p>
                            <p className="text-ink-300 text-sm mt-2">
                                Scan, collect and learn from real animals.
                            </p>
                            <div className="mt-4">
                                <StoreLinks variant="text" />
                            </div>
                        </div>
                    </div>
                </aside>

                <main className="flex flex-col gap-6">
                    <section
                        id="overview"
                        className="rounded-4xl border border-line-300 bg-surface-900/70 backdrop-blur overflow-hidden"
                    >
                        <div className="p-6 md:p-10 border-b border-line-300/70">
                            <p className="text-primary-200 text-xs uppercase tracking-[0.18em] mb-3">
                                Overview
                            </p>
                            <h2 className="font-display font-bold text-3xl md:text-5xl text-white">
                                Built for this journey
                            </h2>
                        </div>

                        <div className="divide-y divide-line-300/70">
                            {entry.sections.map((section, index) => (
                                <section key={section.title} className="p-6 md:p-10">
                                    <div className="flex flex-col md:flex-row gap-5 md:gap-8">
                                        <div className="md:w-56 shrink-0">
                                            <span className="text-primary-200 text-xs font-semibold tracking-[0.18em]">
                                                {String(index + 1).padStart(2, "0")}
                                            </span>
                                            <h3 className="font-display font-bold text-2xl md:text-3xl text-white mt-2">
                                                {section.title}
                                            </h3>
                                        </div>

                                        <div className="flex flex-col gap-4 max-w-3xl">
                                            {section.paragraphs.map((paragraph) => (
                                                <p key={paragraph} className="text-ink-200 text-base md:text-lg leading-8">
                                                    {paragraph}
                                                </p>
                                            ))}
                                        </div>
                                    </div>
                                </section>
                            ))}
                        </div>
                    </section>

                    <section
                        id="actions"
                        className="rounded-4xl border border-line-300 bg-surface-900/70 backdrop-blur p-6 md:p-10"
                    >
                        <SectionHeading eyebrow="Practical use" title={t("actionsTitle")} />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-6">
                            {entry.keyActions.map((action) => (
                                <div
                                    key={action}
                                    className="rounded-2xl border border-line-300/80 bg-surface-800/50 p-5"
                                >
                                    <div className="w-8 h-8 rounded-full bg-primary-500/10 border border-primary-500/25 flex items-center justify-center text-primary-200 text-sm mb-4">
                                        ✓
                                    </div>
                                    <p className="text-ink-100 text-base md:text-lg leading-7">{action}</p>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section
                        id="difference"
                        className="rounded-4xl border border-primary-500/25 bg-primary-950/20 backdrop-blur p-6 md:p-10"
                    >
                        <SectionHeading eyebrow="Why AnimalDex" title={t("differenceTitle")} />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-6">
                            {entry.whyDifferent.map((point) => (
                                <div
                                    key={point}
                                    className="rounded-2xl border border-primary-500/20 bg-black/20 p-5"
                                >
                                    <p className="text-ink-100 text-base md:text-lg leading-7">{point}</p>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section
                        id="faq"
                        className="rounded-4xl border border-line-300 bg-surface-900/70 backdrop-blur p-6 md:p-10"
                    >
                        <SectionHeading eyebrow="Questions" title={t("faqTitle")} />

                        <div className="flex flex-col gap-3 mt-6">
                            {entry.faq.map((item) => (
                                <details
                                    key={item.question}
                                    className="group rounded-2xl border border-line-300/80 bg-surface-800/50 p-5"
                                >
                                    <summary className="cursor-pointer list-none flex items-start justify-between gap-4">
                                        <h3 className="text-white text-lg md:text-xl font-semibold">
                                            {item.question}
                                        </h3>
                                        <span className="text-primary-200 group-open:rotate-45 transition-transform">+</span>
                                    </summary>
                                    <p className="text-ink-200 text-base md:text-lg leading-7 mt-4">
                                        {item.answer}
                                    </p>
                                </details>
                            ))}
                        </div>
                    </section>

                    {related.length > 0 && (
                        <section id="related" className="flex flex-col gap-4">
                            <SectionHeading eyebrow="Explore next" title={t("relatedTitle")} />

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {related.map((item) => (
                                    <article
                                        key={item.slug}
                                        className="group rounded-3xl border border-line-300 bg-surface-900/70 backdrop-blur p-5 flex flex-col gap-4 hover:border-primary-500/40 transition-colors"
                                    >
                                        <p className="text-primary-200 text-xs uppercase tracking-[0.18em]">
                                            Related path
                                        </p>
                                        <h3 className="font-display font-bold text-2xl text-white group-hover:text-primary-100 transition-colors">
                                            {item.title}
                                        </h3>
                                        <p className="text-ink-200 text-base leading-7">
                                            {item.description}
                                        </p>
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

                    <section className="rounded-4xl border border-primary-500/25 bg-gradient-to-br from-primary-500/15 via-surface-900 to-surface-900 backdrop-blur p-8 md:p-12 text-center">
                        <p className="text-primary-200 text-xs uppercase tracking-[0.18em] mb-3">
                            Start now
                        </p>
                        <h2 className="font-display font-bold text-3xl md:text-5xl text-white">
                            {t("ctaTitle")}
                        </h2>
                        <p className="text-ink-200 text-base md:text-xl leading-8 mt-4 max-w-2xl mx-auto">
                            {t("ctaDescription")}
                        </p>
                        <div className="mt-7">
                            <StoreLinks variant="text" />
                        </div>
                    </section>
                </main>
            </div>
        </article>
    );
}

function SectionHeading({eyebrow, title}: {eyebrow: string; title: string}) {
    return (
        <div>
            <p className="text-primary-200 text-xs uppercase tracking-[0.18em] mb-3">
                {eyebrow}
            </p>
            <h2 className="font-display font-bold text-3xl md:text-4xl text-white">
                {title}
            </h2>
        </div>
    );
}

function StatCard({label, value}: {label: string; value: string}) {
    return (
        <div className="rounded-3xl border border-line-300 bg-surface-900/70 backdrop-blur p-5">
            <p className="text-primary-200 text-xs uppercase tracking-[0.18em] mb-2">
                {label}
            </p>
            <p className="text-white font-display font-bold text-xl leading-7">
                {value}
            </p>
        </div>
    );
}