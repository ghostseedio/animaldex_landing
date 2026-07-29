import {getLocale, getTranslations} from "next-intl/server";
import {Metadata} from "next";
import {notFound} from "next/navigation";
import Image from "next/image";
import {ReactNode} from "react";
import Link from "@/app/[locale]/_components/link";
import StoreLinks from "@/app/[locale]/(composited)/_components/store-links";
import ContentImageFigure from "@/app/[locale]/(composited)/_components/content-image-figure";
import {answerPages, getAnswerPage, getRelatedAnswerPages} from "@/data/answer-pages";
import {getBlogPost} from "@/data/blog";
import {getSpeciesBySlug} from "@/data/species";
import {loadLocaleMessages} from "@/loaders/locale";
import {getAbsoluteAssetUrl, getAbsoluteUrl, getLocalePath, getMetadataLocale} from "@/lib/site";
import {localeConfig} from "@/i18n";
import {getManagedPage} from "@/lib/admin-content";
import {canRenderCodeBlock, getRenderedCodeDocument} from "@/lib/rendered-code-block";
import RenderedCodeFrame from "@/app/_components/rendered-code-frame";

type AnswerPageProps = {
    slug: string;
    cmsSource?: boolean;
};

type AnswerVisual = {
    eyebrow: string;
    heroImage: string;
    heroAlt: string;
    companionImage: string;
    companionAlt: string;
    toneClass: string;
    accentClass: string;
};

type SectionShellProps = {
    id: string;
    eyebrow: string;
    title: string;
    description?: string;
    children: ReactNode;
    className?: string;
};

const visualProfiles = {
    scan: {
        eyebrow: "AI scanner guide",
        heroImage: "/images/placeholders/feature-scan-overview.svg",
        heroAlt: "AnimalDex scan workflow preview",
        companionImage: "/images/placeholders/phone-scan-card.svg",
        companionAlt: "AnimalDex phone scan card preview",
        toneClass: "from-primary-500/18 via-surface-800 to-canvas-900",
        accentClass: "border-primary-500/40 bg-primary-500/10 text-primary-100"
    },
    collection: {
        eyebrow: "Collection guide",
        heroImage: "/images/placeholders/feature-collection-overview.svg",
        heroAlt: "AnimalDex animal collection overview",
        companionImage: "/images/placeholders/phone-collection-card.svg",
        companionAlt: "AnimalDex collection card preview",
        toneClass: "from-amber-400/16 via-surface-800 to-canvas-900",
        accentClass: "border-amber-300/35 bg-amber-300/10 text-amber-100"
    },
    learning: {
        eyebrow: "Learning guide",
        heroImage: "/images/placeholders/feature-discovery-overview.svg",
        heroAlt: "AnimalDex learning and discovery overview",
        companionImage: "/images/placeholders/phone-guide-card.svg",
        companionAlt: "AnimalDex field guide card preview",
        toneClass: "from-sky-400/14 via-surface-800 to-canvas-900",
        accentClass: "border-sky-300/35 bg-sky-300/10 text-sky-100"
    },
    analysis: {
        eyebrow: "Analysis guide",
        heroImage: "/images/placeholders/more-analysis.svg",
        heroAlt: "AnimalDex analysis preview",
        companionImage: "/images/placeholders/phone-challenge-card.svg",
        companionAlt: "AnimalDex comparison card preview",
        toneClass: "from-fuchsia-400/14 via-surface-800 to-canvas-900",
        accentClass: "border-fuchsia-300/35 bg-fuchsia-300/10 text-fuchsia-100"
    },
    discovery: {
        eyebrow: "Discovery guide",
        heroImage: "/images/placeholders/more-discovery.svg",
        heroAlt: "AnimalDex discovery overview",
        companionImage: "/images/placeholders/phone-discovery-card.svg",
        companionAlt: "AnimalDex discovery card preview",
        toneClass: "from-teal-400/14 via-surface-800 to-canvas-900",
        accentClass: "border-teal-300/35 bg-teal-300/10 text-teal-100"
    }
} satisfies Record<string, AnswerVisual>;

function getAnswerVisual(slug: string): AnswerVisual {
    if (slug.includes("breed") || slug.includes("price") || slug.includes("grading")) {
        return visualProfiles.analysis;
    }

    if (slug.includes("collect") || slug.includes("pokemon") || slug.includes("card") || slug.includes("sell")) {
        return visualProfiles.collection;
    }

    if (slug.includes("learn") || slug.includes("lesson") || slug.includes("wisdom") || slug.includes("meaning")) {
        return visualProfiles.learning;
    }

    if (slug.includes("scan") || slug.includes("identify") || slug.includes("identifier")) {
        return visualProfiles.scan;
    }

    return visualProfiles.discovery;
}

function MiniIcon({name, className = "h-5 w-5"}: {name: "scan" | "collect" | "learn" | "compare" | "link" | "check"; className?: string}) {
    const paths = {
        scan: <><path d="M4 8V5a1 1 0 0 1 1-1h3"/><path d="M16 4h3a1 1 0 0 1 1 1v3"/><path d="M20 16v3a1 1 0 0 1-1 1h-3"/><path d="M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M8 12h8"/><path d="M12 8v8"/></>,
        collect: <><rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/></>,
        learn: <><path d="M5 5h9a4 4 0 0 1 4 4v10H9a4 4 0 0 0-4-4Z"/><path d="M5 5v10"/><path d="M9 9h5"/></>,
        compare: <><path d="M7 6h11l-3-3"/><path d="M18 6l-3 3"/><path d="M17 18H6l3 3"/><path d="M6 18l3-3"/></>,
        link: <><path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.1 0l-2 2A5 5 0 0 0 12 20.1l1.1-1.1"/></>,
        check: <path d="m5 12 4 4L19 6"/>
    };

    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
            {paths[name]}
        </svg>
    );
}

function SectionShell({id, eyebrow, title, description, children, className = ""}: SectionShellProps) {
    return (
        <section id={id} className={`scroll-mt-28 border-t border-line-300 pt-8 ${className}`}>
            <div className="mb-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-200">{eyebrow}</p>
                <h2 className="mt-2 font-display text-3xl font-bold leading-tight text-white md:text-4xl">{title}</h2>
                {description ? <p className="mt-3 max-w-3xl text-base leading-7 text-ink-300 md:text-lg">{description}</p> : null}
            </div>
            {children}
        </section>
    );
}

function getSectionNav(t: (key: string) => string) {
    return [
        {href: "#answer", label: t("directAnswerTitle")},
        {href: "#workflow", label: t("howItWorksTitle")},
        {href: "#difference", label: t("differentTitle")},
        {href: "#features", label: t("featureTitle")},
        {href: "#explore", label: t("exploreTitle")},
        {href: "#faq", label: t("faqTitle")}
    ];
}

export async function generateAnswerPageMetadata(slug: string): Promise<Metadata> {
    const locale = await getLocale();
    const entry = getAnswerPage(slug);
    const messages = await loadLocaleMessages(locale);
    const baseKeywords = Array.isArray(messages.meta?.keywords) ? messages.meta.keywords : [];

    if (!entry) {
        return {};
    }
    const managed = await getManagedPage(slug);
    const metadataTitle = managed?.title ?? entry.metaTitle;
    const metadataDescription = managed?.description ?? entry.metaDescription;
    const metadataImage = managed?.featuredImage;

    return {
        title: metadataTitle,
        description: metadataDescription,
        keywords: [...baseKeywords, ...(managed?.searchIntents ?? entry.searchIntents)],
        alternates: {
            canonical: getLocalePath(locale, `/${entry.slug}`),
            languages: localeConfig.locales.reduce((acc, localeItem) => {
                acc[localeItem] = getLocalePath(localeItem, `/${entry.slug}`);
                return acc;
            }, {
                "x-default": getLocalePath(localeConfig.defaultLocale, `/${entry.slug}`)
            } as Record<string, string>)
        },
        openGraph: {
            type: "article",
            locale: getMetadataLocale(locale),
            title: `${metadataTitle} | AnimalDex`,
            description: metadataDescription,
            url: getLocalePath(locale, `/${entry.slug}`),
            modifiedTime: managed?.updatedAt ?? entry.updatedAt,
            tags: managed?.searchIntents ?? entry.searchIntents,
            images: [
                {
                    url: metadataImage ? getAbsoluteAssetUrl(metadataImage.src) : "/images/og.png",
                    width: metadataImage?.width ?? 1200,
                    height: metadataImage?.height ?? 630,
                    alt: `${metadataImage?.alt ?? metadataTitle} | AnimalDex`
                }
            ]
        },
        twitter: {
            card: "summary_large_image",
            title: `${metadataTitle} | AnimalDex`,
            description: metadataDescription,
            images: [metadataImage ? getAbsoluteAssetUrl(metadataImage.src) : "/images/og.png"]
        }
    };
}

export function ManagedAnswerPageArticle({managed}: {managed: NonNullable<Awaited<ReturnType<typeof getManagedPage>>>}) {
    const cmsSourceMigrated = (managed as typeof managed & {cmsSourceMigrated?: unknown}).cmsSourceMigrated;
    const sourceMigrated = typeof cmsSourceMigrated === "string" && cmsSourceMigrated.startsWith("source-sections-");

    if (sourceMigrated) {
        return (
            <article className="mx-auto flex w-full max-w-[88rem] flex-col gap-10 px-4 py-12 md:px-8 md:py-20">
                {managed.headerHtml ? (
                    <RenderedCodeFrame
                        title="Page header"
                        documentHtml={getRenderedCodeDocument({language: "html+css+js", code: managed.headerHtml})}
                        minHeight={240}
                    />
                ) : null}
                {managed.sections.map((section, sectionIndex) => section.html !== undefined ? (
                    <RenderedCodeFrame
                        key={`${section.title}-${sectionIndex}`}
                        title={section.title || `Page section ${sectionIndex + 1}`}
                        documentHtml={getRenderedCodeDocument({language: "html+css+js", code: section.html})}
                        minHeight={280}
                    />
                ) : (
                    <section key={`${section.title}-${sectionIndex}`} className="space-y-5 border-t border-line-300 pt-8">
                        {section.kicker ? <p className="text-xs font-black uppercase tracking-[.2em] text-primary-200">{section.kicker}</p> : null}
                        {(section.headingLevel ?? 2) === 3
                            ? <h3 className="font-display text-2xl text-white sm:text-3xl">{section.title}</h3>
                            : <h2 className="font-display text-3xl text-white sm:text-4xl">{section.title}</h2>}
                        {section.paragraphs.map((paragraph, index) => <p key={index} className="whitespace-pre-wrap text-lg leading-8 text-ink-200">{paragraph}</p>)}
                    </section>
                ))}
            </article>
        );
    }

    return (
        <article className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-12 md:px-8 md:py-20">
            {managed.headerHtml ? <RenderedCodeFrame title="Page header" documentHtml={getRenderedCodeDocument({language: "html+css+js", code: managed.headerHtml})} minHeight={240} /> : <header className="text-center">
                <div className="flex flex-wrap justify-center gap-2">{managed.tags.map((tag) => <span key={tag} className="rounded-full border border-primary-400/30 bg-primary-500/10 px-3 py-1 text-xs font-bold text-primary-100">{tag}</span>)}</div>
                <h1 className="mt-5 font-display text-4xl leading-tight text-white sm:text-6xl">{managed.title}</h1>
                <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-ink-300">{managed.description}</p>
            </header>}
            <ContentImageFigure image={managed.featuredImage} priority />
            <div className="space-y-14">
                {managed.sections.map((section, sectionIndex) => (
                    <section key={`${section.title}-${sectionIndex}`} className="space-y-5 border-t border-line-300 pt-8">
                        {section.html !== undefined ? <div className="overflow-hidden rounded-2xl border border-line-300"><RenderedCodeFrame title={section.title || `Custom section ${sectionIndex + 1}`} documentHtml={getRenderedCodeDocument({language: "html+css+js", code: section.html})} minHeight={320} /></div> : <>
                            {section.kicker ? <p className="text-xs font-black uppercase tracking-[.2em] text-primary-200">{section.kicker}</p> : null}
                            {(section.headingLevel ?? 2) === 3
                                ? <h3 className="font-display text-2xl text-white sm:text-3xl">{section.title}</h3>
                                : <h2 className="font-display text-3xl text-white sm:text-4xl">{section.title}</h2>}
                            {section.paragraphs.map((paragraph, index) => <p key={index} className="whitespace-pre-wrap text-lg leading-8 text-ink-200">{paragraph}</p>)}
                            {section.codeBlocks?.map((block, index) => block.render && canRenderCodeBlock(block.language)
                                ? <figure key={index} className="overflow-hidden rounded-2xl border border-line-300 bg-white"><RenderedCodeFrame title={block.caption || `Embedded content ${index + 1}`} documentHtml={getRenderedCodeDocument(block)} minHeight={320} />{block.caption ? <figcaption className="border-t border-line-300 bg-surface-900 px-4 py-3 text-xs text-ink-400">{block.caption}</figcaption> : null}</figure>
                                : <figure key={index} className="overflow-hidden rounded-2xl border border-line-300 bg-[#080d0a]"><div className="border-b border-line-300 px-4 py-2 text-[11px] font-bold uppercase tracking-[.16em] text-ink-400">{block.language || "Text"}</div><pre className="overflow-x-auto p-4 text-sm leading-6 text-primary-100"><code>{block.code}</code></pre>{block.caption ? <figcaption className="border-t border-line-300 px-4 py-3 text-xs text-ink-400">{block.caption}</figcaption> : null}</figure>)}
                        </>}
                    </section>
                ))}
            </div>
        </article>
    );
}

export default async function AnswerPage({slug, cmsSource = false}: AnswerPageProps) {
    const t = await getTranslations("answerPages");
    const locale = await getLocale();
    const entry = getAnswerPage(slug);

    if (!entry) {
        notFound();
    }
    const managed = await getManagedPage(slug);

    if (managed && !cmsSource) {
        return <ManagedAnswerPageArticle managed={managed} />;
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
    const visual = getAnswerVisual(entry.slug);
    const sectionNav = getSectionNav(t);
    const primaryFeatures = entry.features.slice(0, 4);

    return (
        <article className="mx-auto flex w-full max-w-[88rem] flex-col gap-10 px-4 py-12 md:px-8 md:py-20">
            <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify([articleSchema, faqSchema])}} />

            <section className={`overflow-hidden rounded-lg border border-line-300 bg-gradient-to-br ${visual.toneClass}`}>
                <div className="grid gap-0 lg:grid-cols-[minmax(0,1.03fr)_minmax(24rem,0.72fr)]">
                    <div className="flex min-w-0 flex-col justify-between p-5 md:p-8 lg:p-10">
                        <div>
                            <Link href="/" className="mb-6 inline-flex text-sm text-primary-200 transition-colors hover:text-primary-100" underline>
                                {t("back")}
                            </Link>
                            <span className={`inline-flex w-fit rounded-md border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] ${visual.accentClass}`}>
                                {visual.eyebrow}
                            </span>
                            <h1 className="mt-5 max-w-5xl break-words font-display text-4xl font-bold leading-[1.05] text-white md:text-6xl">
                                {entry.heroTitle}
                            </h1>
                            <p className="mt-5 max-w-3xl text-lg leading-8 text-ink-200 md:text-xl">{entry.intro}</p>
                        </div>
                        <div className="mt-8 flex flex-col gap-5">
                            <div className="flex flex-wrap gap-2">
                                {entry.searchIntents.slice(0, 6).map((intent) => (
                                    <span key={intent} className="rounded-md border border-white/10 bg-canvas-950/35 px-3 py-1.5 text-xs text-ink-200">
                                        {intent}
                                    </span>
                                ))}
                            </div>
                            <div className="grid gap-3 text-sm text-ink-300 sm:grid-cols-3">
                                <div className="rounded-md border border-white/10 bg-canvas-950/35 p-3">
                                    <span className="block text-2xl font-bold text-white">{entry.features.length}</span>
                                    <span>Feature areas</span>
                                </div>
                                <div className="rounded-md border border-white/10 bg-canvas-950/35 p-3">
                                    <span className="block text-2xl font-bold text-white">{entry.faq.length}</span>
                                    <span>FAQ answers</span>
                                </div>
                                <div className="rounded-md border border-white/10 bg-canvas-950/35 p-3">
                                    <span className="block text-2xl font-bold text-white">{relatedPages.length}</span>
                                    <span>Related guides</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="relative min-h-[28rem] border-t border-line-300 bg-canvas-950/35 lg:border-l lg:border-t-0">
                        <Image
                            src={visual.heroImage}
                            alt={visual.heroAlt}
                            width={960}
                            height={720}
                            priority
                            className="h-full min-h-[28rem] w-full object-cover"
                            sizes="(min-width: 1024px) 34rem, 100vw"
                        />
                        <div className="absolute inset-x-4 bottom-4 rounded-lg border border-white/10 bg-canvas-950/78 p-4 shadow-2xl backdrop-blur">
                            <div className="flex items-center gap-3">
                                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-white/10 bg-surface-800">
                                    <Image src={visual.companionImage} alt={visual.companionAlt} fill className="object-cover" sizes="4rem" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-200">Guide preview</p>
                                    <p className="mt-1 max-h-10 overflow-hidden text-sm leading-5 text-ink-200">{entry.directAnswer[0]}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <div className="grid gap-8 lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start">
                <aside className="hidden lg:block lg:sticky lg:top-24">
                    <nav className="rounded-lg border border-line-300 bg-surface-900/75 p-3" aria-label="Page sections">
                        {sectionNav.map((item) => (
                            <a key={item.href} href={item.href} className="block rounded-md px-3 py-2.5 text-sm text-ink-300 transition-colors hover:bg-primary-500/10 hover:text-primary-100">
                                {item.label}
                            </a>
                        ))}
                    </nav>
                    <div className="mt-4 rounded-lg border border-line-300 bg-surface-900/55 p-4 text-sm leading-6 text-ink-300">
                        <p className="font-semibold text-white">Updated</p>
                        <p>{entry.updatedAt}</p>
                    </div>
                </aside>

                <div className="flex min-w-0 flex-col gap-10">
                    <SectionShell id="answer" eyebrow="Summary" title={t("directAnswerTitle")}>
                        <div className="grid gap-4">
                            {entry.directAnswer.map((paragraph, index) => (
                                <div key={paragraph} className="grid gap-4 rounded-lg border border-line-300 bg-surface-900/75 p-5 md:grid-cols-[3.5rem_minmax(0,1fr)] md:p-6">
                                    <span className="flex h-11 w-11 items-center justify-center rounded-md bg-primary-500 text-lg font-bold text-canvas-950">
                                        {index + 1}
                                    </span>
                                    <p className="text-lg leading-8 text-ink-200 md:text-xl">{paragraph}</p>
                                </div>
                            ))}
                        </div>
                    </SectionShell>

                    <SectionShell id="workflow" eyebrow="Workflow" title={t("howItWorksTitle")}>
                        <div className="grid gap-4 md:grid-cols-2">
                            {entry.howItWorks.map((paragraph, index) => (
                                <article key={paragraph} className="rounded-lg border border-line-300 bg-surface-900/65 p-5">
                                    <div className="mb-5 flex items-center justify-between gap-4">
                                        <span className={`grid h-11 w-11 place-items-center rounded-md border ${visual.accentClass}`}>
                                            <MiniIcon name={index === 0 ? "scan" : "collect"} />
                                        </span>
                                        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-400">Step {index + 1}</span>
                                    </div>
                                    <p className="text-base leading-7 text-ink-200 md:text-lg">{paragraph}</p>
                                </article>
                            ))}
                        </div>
                    </SectionShell>

                    <SectionShell id="difference" eyebrow="Positioning" title={t("differentTitle")}>
                        <div className="overflow-hidden rounded-lg border border-line-300">
                            <div className="grid bg-surface-900/80 md:grid-cols-2">
                                <div className="border-b border-line-300 p-5 md:border-b-0 md:border-r">
                                    <h3 className="text-xl font-semibold text-white">{t("typicalAppsTitle")}</h3>
                                </div>
                                <div className="p-5">
                                    <h3 className="text-xl font-semibold text-white">{t("animalDexDifferentTitle")}</h3>
                                </div>
                            </div>
                            {entry.comparisonTypical.map((item, index) => (
                                <div key={item} className="grid border-t border-line-300 bg-surface-800/45 md:grid-cols-2">
                                    <div className="border-b border-line-400 p-5 text-base leading-7 text-ink-300 md:border-b-0 md:border-r">
                                        {item}
                                    </div>
                                    <div className="flex gap-3 p-5 text-base leading-7 text-ink-100">
                                        <MiniIcon name="check" className="mt-1 h-5 w-5 shrink-0 text-primary-200" />
                                        <span>{entry.comparisonAnimalDex[index] ?? entry.comparisonAnimalDex[0]}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </SectionShell>

                    <SectionShell id="features" eyebrow="Fit and tools" title={t("featureTitle")}>
                        <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
                            <div className="rounded-lg border border-line-300 bg-surface-900/70 p-5">
                                <h3 className="text-xl font-semibold text-white">{t("whoForTitle")}</h3>
                                <ul className="mt-4 grid gap-3">
                                    {entry.whoItsFor.map((item) => (
                                        <li key={item} className="flex gap-3 text-base leading-7 text-ink-200">
                                            <MiniIcon name="check" className="mt-1 h-5 w-5 shrink-0 text-primary-200" />
                                            <span>{item}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                                {primaryFeatures.map((feature, index) => (
                                    <article key={feature.title} className="rounded-lg border border-line-300 bg-surface-900/70 p-5">
                                        <span className="mb-4 grid h-10 w-10 place-items-center rounded-md border border-line-300 bg-surface-800 text-primary-200">
                                            <MiniIcon name={index === 0 ? "scan" : index === 1 ? "collect" : index === 2 ? "learn" : "compare"} />
                                        </span>
                                        <h3 className="text-xl font-semibold text-white">{feature.title}</h3>
                                        <p className="mt-2 text-base leading-7 text-ink-300">{feature.description}</p>
                                    </article>
                                ))}
                            </div>
                        </div>
                        {entry.features.length > primaryFeatures.length ? (
                            <div className="mt-4 flex flex-wrap gap-2">
                                {entry.features.slice(primaryFeatures.length).map((feature) => (
                                    <span key={feature.title} className="rounded-md border border-line-300 bg-surface-900/60 px-3 py-2 text-sm text-ink-200">
                                        {feature.title}
                                    </span>
                                ))}
                            </div>
                        ) : null}
                    </SectionShell>

                    <SectionShell id="explore" eyebrow="Next paths" title={t("exploreTitle")} description={t("exploreDescription")}>
                        <div className="grid gap-5">
                            {relatedSpecies.length > 0 && (
                                <div className="rounded-lg border border-line-300 bg-surface-900/70 p-5">
                                    <h3 className="text-xl font-semibold text-white">{t("speciesLinksTitle")}</h3>
                                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                        {relatedSpecies.map((species) => (
                                            <Link key={species.slug} href={`/animals/${species.slug}`} className="group flex min-w-0 items-center gap-3 rounded-md border border-line-300 bg-surface-800/55 p-3 transition-colors hover:border-primary-400/60">
                                                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-primary-500/12 text-primary-200">
                                                    <MiniIcon name="link" />
                                                </span>
                                                <span className="min-w-0">
                                                    <span className="block truncate font-semibold text-white group-hover:text-primary-100">{species.name}</span>
                                                    <span className="block truncate text-sm text-ink-400">{species.analysis.category}</span>
                                                </span>
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {relatedBlogs.length > 0 && (
                                <div className="grid gap-4 md:grid-cols-2">
                                    {relatedBlogs.map((post) => (
                                        <article key={post.slug} className="overflow-hidden rounded-lg border border-line-300 bg-surface-900/70">
                                            <Image
                                                src={post.featuredImage.src}
                                                alt={post.featuredImage.alt}
                                                width={post.featuredImage.width}
                                                height={post.featuredImage.height}
                                                sizes="(min-width: 1024px) 28rem, 100vw"
                                                className="aspect-[16/9] w-full object-cover"
                                            />
                                            <div className="p-5">
                                                <h3 className="text-xl font-semibold text-white">{post.title}</h3>
                                                <p className="mt-2 text-base leading-7 text-ink-300">{post.description}</p>
                                                <Link href={`/blog/${post.slug}`} className="mt-4 inline-flex text-primary-200 transition-colors hover:text-primary-100" underline>
                                                    {t("readArticle")}
                                                </Link>
                                            </div>
                                        </article>
                                    ))}
                                </div>
                            )}

                            {relatedPages.length > 0 && (
                                <div className="rounded-lg border border-line-300 bg-surface-900/70 p-5">
                                    <h3 className="text-xl font-semibold text-white">{t("answerLinksTitle")}</h3>
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        {relatedPages.map((page) => (
                                            <Link
                                                key={page.slug}
                                                href={`/${page.slug}`}
                                                className="rounded-md border border-line-300 bg-surface-800/55 px-3 py-2 text-sm text-ink-200 transition-colors hover:border-primary-400/60 hover:text-primary-100"
                                            >
                                                {page.shortTitle}
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </SectionShell>

                    <SectionShell id="faq" eyebrow="Answers" title={t("faqTitle")} description={t("faqDescription")}>
                        <div className="grid gap-3">
                            {entry.faq.map((item) => (
                                <details key={item.question} className="group rounded-lg border border-line-300 bg-surface-900/70 p-5 open:border-primary-500/35">
                                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold text-white">
                                        {item.question}
                                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-line-300 text-primary-200 transition-transform group-open:rotate-45">+</span>
                                    </summary>
                                    <p className="mt-4 text-base leading-7 text-ink-300 md:text-lg">{item.answer}</p>
                                </details>
                            ))}
                        </div>
                    </SectionShell>

                    <div className="relative overflow-hidden rounded-[2rem] border border-primary-200/20 bg-[radial-gradient(circle_at_20%_0%,rgba(131,255,174,0.14),transparent_34%),linear-gradient(135deg,rgba(16,25,20,0.96),rgba(6,10,8,0.98))] shadow-[0_30px_120px_rgba(0,0,0,0.34),inset_0_1px_0_rgba(255,255,255,0.08)]">
                        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-primary-200/50 to-transparent" />
                        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_22rem]">
                            <div className="relative z-10 p-6 text-center md:p-10 lg:p-12 lg:text-left">
                                <p className="text-xs font-black uppercase tracking-[0.24em] text-primary-200">Start collecting</p>
                                <h2 className="mt-3 font-display text-4xl font-bold leading-[0.98] text-white md:text-5xl">{t("ctaTitle")}</h2>
                                <p className="mt-4 max-w-2xl text-lg leading-8 text-ink-200">{t("ctaDescription")}</p>
                                <div className="mt-7 flex flex-col items-center gap-4 lg:items-start">
                                    <StoreLinks
                                        className="!mt-0 !justify-start"
                                        buttonClassName="!h-16 !min-w-[13.5rem] !rounded-[1.25rem] !bg-primary-400 !px-7 !text-xl !shadow-[0_18px_55px_rgba(49,255,79,0.22),inset_0_1px_0_rgba(255,255,255,0.35)] hover:!bg-primary-300 hover:!shadow-[0_24px_70px_rgba(49,255,79,0.32),inset_0_1px_0_rgba(255,255,255,0.45)]"
                                    />
                                    <Link
                                        href="/"
                                        className="inline-flex min-h-[3.25rem] items-center justify-center gap-2 rounded-full border border-primary-200/25 bg-white/[0.045] px-5 text-sm font-black uppercase tracking-[0.12em] text-primary-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition hover:-translate-y-0.5 hover:border-primary-200/60 hover:bg-primary-400 hover:text-canvas-950"
                                    >
                                        <span aria-hidden="true">←</span>
                                        {t("landingButton")}
                                    </Link>
                                </div>
                            </div>
                            <div className="relative hidden min-h-[22rem] overflow-hidden border-l border-primary-200/15 bg-canvas-950/45 lg:block">
                                <Image src={visual.companionImage} alt="" fill className="object-cover opacity-75" sizes="22rem" />
                                <div className="absolute inset-0 bg-gradient-to-r from-canvas-950/20 via-transparent to-canvas-950/45" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </article>
    );
}

export function getAnswerStaticParams() {
    return answerPages.map((entry) => ({slug: entry.slug}));
}
