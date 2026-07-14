import {Metadata} from "next";
import Image from "next/image";
import Link from "@/app/[locale]/_components/link";
import StoreLinks from "@/app/[locale]/(composited)/_components/store-links";
import {
    celebrityWildProfiles,
    whatAnimalAmIPage,
    WHAT_ANIMAL_AM_I_UPDATED_AT
} from "@/data/what-animal-am-i-page";
import {getAbsoluteUrl, getLocalePath, getMetadataLocale} from "@/lib/site";
import {localeConfig} from "@/i18n";
import {getScopedTranslator} from "@/loaders/translation";
import CelebrityWildProfileCarousel from "./celebrity-wild-profile-carousel";

type WhatAnimalAmIPageProps = {
    params: {
        locale: string;
    };
};

export async function generateMetadata({params}: WhatAnimalAmIPageProps): Promise<Metadata> {
    const page = whatAnimalAmIPage;

    return {
        title: page.metaTitle,
        description: page.metaDescription,
        keywords: page.searchIntents,
        alternates: {
            canonical: getLocalePath(params.locale, `/${page.slug}`),
            languages: localeConfig.locales.reduce((acc, localeItem) => {
                acc[localeItem] = getLocalePath(localeItem, `/${page.slug}`);
                return acc;
            }, {
                "x-default": getLocalePath(localeConfig.defaultLocale, `/${page.slug}`)
            } as Record<string, string>)
        },
        openGraph: {
            type: "article",
            locale: getMetadataLocale(params.locale),
            title: `${page.metaTitle} | AnimalDex`,
            description: page.metaDescription,
            url: getLocalePath(params.locale, `/${page.slug}`),
            modifiedTime: WHAT_ANIMAL_AM_I_UPDATED_AT,
            tags: page.searchIntents,
            images: [
                {
                    url: "/images/blog/what-animal-am-i/wild-profile-hero.webp",
                    width: 1200,
                    height: 630,
                    alt: "AnimalDex Wild Profile spirit animal diagnosis"
                }
            ]
        },
        twitter: {
            card: "summary_large_image",
            title: `${page.metaTitle} | AnimalDex`,
            description: page.metaDescription,
            images: ["/images/blog/what-animal-am-i/wild-profile-hero.webp"]
        }
    };
}

export default async function WhatAnimalAmIPage({params}: WhatAnimalAmIPageProps) {
    const t = await getScopedTranslator(params.locale, "whatAnimalAmI");
    const page = whatAnimalAmIPage;
    const pageUrl = getAbsoluteUrl(params.locale, `/${page.slug}`);
    const articleSchema = {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: page.heroTitle,
        description: page.metaDescription,
        dateModified: WHAT_ANIMAL_AM_I_UPDATED_AT,
        inLanguage: params.locale,
        url: pageUrl,
        author: {"@type": "Organization", name: "AnimalDex"},
        publisher: {"@type": "Organization", name: "AnimalDex"},
        about: page.searchIntents.map((intent) => ({
            "@type": "Thing",
            name: intent
        }))
    };
    const faqSchema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: page.faq.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: {
                "@type": "Answer",
                text: item.answer
            }
        }))
    };
    const howToSchema = {
        "@context": "https://schema.org",
        "@type": "HowTo",
        name: "How to find out what animal you are in AnimalDex",
        description: page.metaDescription,
        step: page.howItWorks.map((step, index) => ({
            "@type": "HowToStep",
            position: index + 1,
            name: `Step ${index + 1}`,
            text: step
        }))
    };

    return (
        <article className="mx-auto flex w-full max-w-[88rem] flex-col gap-12 px-4 py-12 md:px-8 md:py-20">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{__html: JSON.stringify([articleSchema, faqSchema, howToSchema])}}
            />

            <section className="overflow-hidden rounded-lg border border-line-300 bg-gradient-to-br from-primary-500/14 via-surface-900 to-canvas-900">
                <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(24rem,0.78fr)]">
                    <div className="p-6 md:p-10 lg:p-12">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-200">{t("eyebrow")}</p>
                        <h1 className="mt-4 max-w-5xl font-display text-4xl font-bold leading-[1.02] text-white md:text-6xl lg:text-7xl">{page.heroTitle}</h1>
                        <p className="mt-5 max-w-3xl text-lg leading-8 text-ink-100 md:text-xl">{page.heroSubtitle}</p>
                        <p className="mt-4 max-w-3xl text-base leading-7 text-ink-300 md:text-lg">{page.intro}</p>
                        <div className="mt-7 flex flex-wrap gap-2">
                            {page.searchIntents.slice(0, 6).map((intent) => (
                                <span key={intent} className="rounded-md border border-white/10 bg-canvas-950/35 px-3 py-1.5 text-xs text-ink-200">
                                    {intent}
                                </span>
                            ))}
                        </div>
                        <div className="mt-8 grid gap-3 text-sm text-ink-300 sm:grid-cols-3">
                            <div className="rounded-md border border-white/10 bg-canvas-950/35 p-3">
                                <strong className="block text-2xl text-white">{page.roleRows.length}</strong>
                                <span>Wild roles</span>
                            </div>
                            <div className="rounded-md border border-white/10 bg-canvas-950/35 p-3">
                                <strong className="block text-2xl text-white">{page.howItWorks.length}</strong>
                                <span>Profile steps</span>
                            </div>
                            <div className="rounded-md border border-white/10 bg-canvas-950/35 p-3">
                                <strong className="block text-2xl text-white">{celebrityWildProfiles.length}</strong>
                                <span>Example profiles</span>
                            </div>
                        </div>
                        <div className="mt-8 flex flex-wrap gap-3">
                            <StoreLinks />
                            <Link href={`/blog/${page.blogSlug}`} underline className="self-center text-lg text-primary-200 hover:text-primary-100">
                                {t("readDeepGuide")}
                            </Link>
                        </div>
                    </div>
                    <div className="relative min-h-[27rem] border-t border-line-300 bg-canvas-950/35 lg:border-l lg:border-t-0">
                        <Image
                            src="/images/blog/what-animal-am-i/wild-profile-hero.webp"
                            alt="AnimalDex Wild Profile showing Origin, Apex, and Active animal patterns"
                            fill
                            priority
                            sizes="(min-width: 1024px) 36rem, 100vw"
                            className="object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                        <div className="absolute inset-x-4 bottom-4 rounded-lg border border-white/10 bg-canvas-950/78 p-4 backdrop-blur">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-200">Wild Profile</p>
                            <p className="mt-1 text-sm leading-6 text-ink-200">Origin, Apex, and Active animal patterns in one personal profile.</p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="border-t border-line-300 pt-8">
                <div className="mb-6 max-w-4xl">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-200">Profile anatomy</p>
                    <h2 className="mt-2 font-display text-3xl font-bold text-white md:text-5xl">{t("rolesTitle")}</h2>
                    <p className="mt-3 text-lg leading-8 text-ink-200 md:text-xl">{t("rolesDescription")}</p>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    {page.roleRows.map((row) => (
                        <article key={row.role} className="rounded-lg border border-line-300 bg-surface-900/75 p-5">
                            <h3 className="font-display text-2xl font-bold text-white">{row.role}</h3>
                            <p className="mt-2 text-base leading-7 text-ink-300 md:text-lg">{row.meaning}</p>
                        </article>
                    ))}
                </div>
            </section>

            <section className="border-t border-line-300 pt-8">
                <div className="mb-6 max-w-4xl">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-200">How it works</p>
                    <h2 className="mt-2 font-display text-3xl font-bold text-white md:text-5xl">{t("howTitle")}</h2>
                </div>
                <ol className="grid gap-4 md:grid-cols-3">
                    {page.howItWorks.map((step, index) => (
                        <li key={step} className="rounded-lg border border-line-300 bg-surface-900/70 p-5">
                            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-200">Step {index + 1}</span>
                            <p className="mt-4 text-base leading-7 text-ink-200 md:text-lg">{step}</p>
                        </li>
                    ))}
                </ol>
            </section>

            <CelebrityWildProfileCarousel
                profiles={celebrityWildProfiles}
                copy={{
                    eyebrow: t("celebrityEyebrow"),
                    title: t("celebrityTitle"),
                    description: t("celebrityDescription"),
                    disclaimer: t("celebrityDisclaimer"),
                    originLabel: t("originLabel"),
                    apexLabel: t("apexLabel"),
                    activeLabel: t("activeLabel"),
                    openSpecies: t("openSpecies"),
                    previous: t("previous"),
                    next: t("next"),
                    slideLabel: t("slideLabel")
                }}
            />

            <section className="grid gap-8 border-y border-line-300 py-10 lg:grid-cols-[0.7fr_1.3fr]">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-200">Why dynamic</p>
                    <h2 className="mt-2 font-display text-3xl font-bold text-white md:text-5xl">{t("whyNotTitle")}</h2>
                </div>
                <div className="grid gap-4">
                    {page.whyNotStatic.map((paragraph) => (
                        <p key={paragraph} className="text-lg leading-8 text-ink-200 md:text-xl">
                            {paragraph}
                        </p>
                    ))}
                </div>
            </section>

            <section className="grid gap-8 lg:grid-cols-[0.55fr_1.45fr]">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-200">Answers</p>
                    <h2 className="mt-2 font-display text-3xl font-bold text-white md:text-5xl">{t("faqTitle")}</h2>
                    <p className="mt-3 text-base leading-7 text-ink-300 md:text-lg">{t("faqDescription")}</p>
                </div>
                <div className="divide-y divide-line-300 rounded-lg border border-line-300 bg-surface-900/70 px-5 md:px-8">
                    {page.faq.map((item) => (
                        <details key={item.question} className="group py-5">
                            <summary className="flex cursor-pointer list-none items-center justify-between gap-5 text-lg font-semibold text-white">
                                {item.question}
                                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-line-300 text-primary-200 transition-transform group-open:rotate-45">+</span>
                            </summary>
                            <p className="mt-3 max-w-3xl text-base leading-7 text-ink-300 md:text-lg">{item.answer}</p>
                        </details>
                    ))}
                </div>
            </section>

            <section className="overflow-hidden rounded-lg border border-line-300 bg-surface-900/80">
                <div className="grid gap-0 lg:grid-cols-[1fr_18rem]">
                    <div className="p-6 text-center md:p-10 lg:text-left">
                        <h2 className="font-display text-3xl font-bold text-white md:text-4xl">{t("ctaTitle")}</h2>
                        <p className="mx-auto mt-3 max-w-3xl text-lg leading-8 text-ink-200 lg:mx-0">{t("ctaDescription")}</p>
                        <div className="mt-6 flex flex-wrap justify-center gap-3 lg:justify-start">
                            <StoreLinks />
                            <Link href="/blog/what-animal-am-i" underline className="self-center text-lg text-primary-200 hover:text-primary-100">
                                {t("readDeepGuide")}
                            </Link>
                        </div>
                    </div>
                    <div className="relative hidden border-l border-line-300 bg-canvas-950/35 lg:block">
                        <Image
                            src="/images/blog/what-animal-am-i/wild-profile-app-interface.webp"
                            alt=""
                            fill
                            sizes="18rem"
                            className="object-cover opacity-85"
                        />
                    </div>
                </div>
            </section>
        </article>
    );
}
