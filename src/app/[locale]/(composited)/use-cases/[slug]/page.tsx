import {Metadata} from "next";
import {notFound} from "next/navigation";
import Link from "@/app/[locale]/_components/link";
import {getRelatedUseCases, getUseCase} from "@/data/use-cases";
import {getAbsoluteUrl, getLocalePath, getMetadataLocale} from "@/lib/site";
import {localeConfig} from "@/i18n";
import {getScopedTranslator} from "@/loaders/translation";
import StoreLinks from "@/app/[locale]/(composited)/_components/store-links";
import {appDestinationHref, INSTAGRAM_WEB_IMPORT_LIVE, instagramWebImportCtaLabel} from "@/lib/instagram-import";
import {getSupportArticleBySlugs, getSupportArticlePath} from "@/lib/support-articles";
import UseCaseProductCta from "@/app/[locale]/(composited)/use-cases/_components/use-case-product-cta";
import InstagramImportIntro from "@/app/[locale]/(composited)/use-cases/_components/instagram-import-intro";

export function generateStaticParams() {
    return [
        {locale: "en", slug: "ai-animal-scanner-identification-app"},
        {locale: "id", slug: "ai-animal-scanner-identification-app"}
    ];
}

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
    const localePrefix = locale === localeConfig.defaultLocale ? "" : `/${locale}`;
    const productHref = entry.productCta
        ? appDestinationHref(localePrefix, entry.productCta.path)
        : null;
    const secondaryHref = entry.secondaryCta
        ? appDestinationHref(localePrefix, entry.secondaryCta.path)
        : null;
    const isImportPage = entry.slug === "import-instagram-wildlife-photos";
    const importSupport = isImportPage
        ? getSupportArticleBySlugs("instagram-import", "how-do-i-import-wildlife-posts-from-instagram")
        : null;
    const importCtaLabel = isImportPage ? instagramWebImportCtaLabel() : entry.productCta?.label;

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

    const breadcrumbSchema = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: getAbsoluteUrl(locale, "/") },
            { "@type": "ListItem", position: 2, name: t("back"), item: getAbsoluteUrl(locale, "/use-cases") },
            { "@type": "ListItem", position: 3, name: entry.shortLabel, item: pageUrl }
        ]
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

    const howToSchema = entry.steps?.length
        ? {
            "@context": "https://schema.org",
            "@type": "HowTo",
            name: entry.title,
            description: entry.description,
            step: entry.steps.map((step, index) => ({
                "@type": "HowToStep",
                position: index + 1,
                name: step.title,
                text: step.body
            }))
        }
        : null;

    return (
        <article className="w-full max-w-[88rem] mx-auto px-4 md:px-8 py-10 md:py-16">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{__html: JSON.stringify([schema, faqSchema, breadcrumbSchema, howToSchema].filter(Boolean))}}
            />

            <header className="max-w-4xl mx-auto text-center flex flex-col items-center gap-5">
                <Link href="/use-cases" className="text-primary-200 hover:text-primary-100 text-sm" underline>
                    {t("back")}
                </Link>

                <p className="text-primary-200 text-xs md:text-sm uppercase tracking-[0.22em]">
                    {entry.shortLabel}
                </p>

                {entry.heroTitle ? (
                    <>
                        <p className={`max-w-xl text-primary-200 ${isImportPage ? "text-sm font-semibold leading-snug md:text-base" : "text-sm uppercase tracking-[0.22em]"}`}>
                            {entry.heroEyebrow}
                        </p>
                        <h1 className="font-display font-bold text-4xl md:text-6xl text-white leading-[0.95]">
                            {entry.heroTitle}
                        </h1>
                    </>
                ) : (
                    <h1 className="font-display font-bold text-4xl md:text-6xl text-white leading-[0.95]">
                        {entry.title}
                    </h1>
                )}

                <p className="text-base md:text-xl text-ink-200 leading-8 max-w-3xl">
                    {entry.description}
                </p>

                {productHref && entry.productCta ? (
                    <div className="flex flex-col items-center gap-3 pt-2">
                        <UseCaseProductCta
                            href={productHref}
                            label={importCtaLabel ?? entry.productCta.label}
                            event={entry.productCta.event ?? "use_case_product_cta"}
                            extraEvents={isImportPage ? ["casual_archive_to_import"] : []}
                            source={isImportPage ? "import_use_case" : entry.productCta.event}
                        />
                        {secondaryHref && entry.secondaryCta ? (
                            <UseCaseProductCta
                                href={secondaryHref}
                                label={entry.secondaryCta.label}
                                event={entry.secondaryCta.event ?? "use_case_secondary_cta"}
                                source={entry.secondaryCta.event}
                                variant="secondary"
                            />
                        ) : null}
                        {entry.experienceCta ? (
                            <UseCaseProductCta
                                href={entry.experienceCta.href}
                                label={entry.experienceCta.label}
                                event={entry.experienceCta.event ?? "use_case_experience_cta"}
                                variant="secondary"
                            />
                        ) : null}
                        <StoreLinks variant="text" />
                    </div>
                ) : null}

                {entry.limitationNote ? (
                    <p className="max-w-2xl text-sm leading-6 text-ink-300">{entry.limitationNote}</p>
                ) : null}

                {importSupport && !isImportPage ? (
                    <Link href={getSupportArticlePath(importSupport)} className="text-sm text-primary-200" underline>
                        How Instagram import works
                    </Link>
                ) : null}

                {entry.productCta ? null : (
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
                )}
            </header>

            {entry.steps?.length ? (
                <section className="mx-auto mt-10 max-w-5xl md:mt-14">
                    {isImportPage && productHref ? (
                        <InstagramImportIntro productHref={productHref} />
                    ) : null}
                    {isImportPage && INSTAGRAM_WEB_IMPORT_LIVE ? (
                        <section aria-labelledby="web-first-heading" className="mb-8 rounded-[1.35rem] border border-primary-400/20 bg-primary-400/[0.06] p-5">
                            <h2 id="web-first-heading" className="font-display text-2xl font-bold text-white">
                                No app download required to get started
                            </h2>
                            <p className="mt-2 text-sm leading-6 text-ink-200">
                                Import on the web. Sign in to review eligible posts, then download the app when you capture new animals in the field.
                            </p>
                        </section>
                    ) : null}
                    {isImportPage ? null : (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {entry.steps.map((step, index) => (
                        <div key={step.title} className="rounded-[1.35rem] border border-primary-500/20 bg-primary-950/20 p-5">
                            <p className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-primary-200">
                                {String(index + 1).padStart(2, "0")}
                            </p>
                            <h2 className="mt-2 font-display text-2xl font-bold text-white">{step.title}</h2>
                            <p className="mt-2 text-sm leading-6 text-ink-200">{step.body}</p>
                        </div>
                    ))}
                    </div>
                    )}
                </section>
            ) : null}

            {entry.audiences?.length && !isImportPage ? (
                <section className="mx-auto mt-8 grid max-w-5xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {entry.audiences.map((audience) => (
                        <div key={audience.title} className="rounded-[1.35rem] border border-white/10 bg-white/[0.03] p-5">
                            <h2 className="font-display text-xl font-bold text-white">{audience.title}</h2>
                            <p className="mt-2 text-sm leading-6 text-ink-200">{audience.body}</p>
                        </div>
                    ))}
                </section>
            ) : null}

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

                    {isImportPage ? (
                        <section
                            aria-labelledby="past-new-heading"
                            className="grid grid-cols-1 gap-3 md:grid-cols-2"
                        >
                            <h2 id="past-new-heading" className="sr-only">Past encounters and new encounters</h2>
                            <article aria-labelledby="past-encounters-heading" className="rounded-[1.35rem] border border-white/10 bg-white/[0.03] p-5">
                                <p className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-primary-200">Past</p>
                                <h3 id="past-encounters-heading" className="mt-2 font-display text-xl font-bold text-white">
                                    Past encounters
                                </h3>
                                <p className="mt-2 text-sm leading-6 text-ink-200">
                                    Bring eligible wildlife posts from Instagram into AnimalDex after review.
                                </p>
                            </article>
                            <article aria-labelledby="new-encounters-heading" className="rounded-[1.35rem] border border-white/10 bg-white/[0.03] p-5">
                                <p className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-primary-200">New</p>
                                <h3 id="new-encounters-heading" className="mt-2 font-display text-xl font-bold text-white">
                                    New encounters
                                </h3>
                                <p className="mt-2 text-sm leading-6 text-ink-200">
                                    Use AnimalDex mobile capture for new encounters in the wild, zoo, aquarium, and the field.
                                </p>
                            </article>
                        </section>
                    ) : null}

                    {isImportPage && entry.audiences?.length ? (
                        <section aria-labelledby="import-audiences-heading" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            <h2 id="import-audiences-heading" className="sr-only">Who Instagram import is for</h2>
                            {entry.audiences.map((audience) => (
                                <article key={audience.title} className="rounded-[1.35rem] border border-white/10 bg-white/[0.03] p-5">
                                    <h3 className="font-display text-xl font-bold text-white">{audience.title}</h3>
                                    <p className="mt-2 text-sm leading-6 text-ink-200">{audience.body}</p>
                                </article>
                            ))}
                        </section>
                    ) : null}

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
                            {entry.productCta ? entry.productCta.label : t("ctaTitle")}
                        </h2>
                        <p className="text-ink-200 text-base md:text-xl leading-8 mt-4 max-w-2xl mx-auto">
                            {entry.limitationNote ?? t("ctaDescription")}
                        </p>
                        <div className="mt-7 flex flex-col items-center gap-3">
                            {productHref && entry.productCta ? (
                                <UseCaseProductCta
                                    href={productHref}
                                    label={importCtaLabel ?? entry.productCta.label}
                                    event={entry.productCta.event ?? "use_case_product_cta"}
                                    extraEvents={isImportPage ? ["casual_archive_to_import"] : []}
                                    source={isImportPage ? "import_use_case" : entry.productCta.event}
                                />
                            ) : null}
                            {secondaryHref && entry.secondaryCta ? (
                                <UseCaseProductCta
                                    href={secondaryHref}
                                    label={entry.secondaryCta.label}
                                    event={entry.secondaryCta.event ?? "use_case_secondary_cta"}
                                    source={entry.secondaryCta.event}
                                    variant="secondary"
                                />
                            ) : null}
                            {entry.experienceCta ? (
                                <UseCaseProductCta
                                    href={entry.experienceCta.href}
                                    label={entry.experienceCta.label}
                                    event={entry.experienceCta.event ?? "use_case_experience_cta"}
                                    variant="secondary"
                                />
                            ) : null}
                            <StoreLinks variant="text" />
                            {importSupport ? (
                                <Link href={getSupportArticlePath(importSupport)} className="text-sm text-primary-200" underline>
                                    How Instagram import works
                                </Link>
                            ) : null}
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