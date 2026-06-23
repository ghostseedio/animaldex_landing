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
                acc[localeItem] = `/${localeItem}/${page.slug}`;
                return acc;
            }, {
                "x-default": `/${localeConfig.defaultLocale}/${page.slug}`
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
        <article className="w-full max-w-[88rem] mx-auto px-4 md:px-8 py-16 md:py-24 flex flex-col gap-10">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{__html: JSON.stringify([articleSchema, faqSchema, howToSchema])}}
            />

            <section className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] gap-8 items-center">
                <div className="flex flex-col gap-4">
                    <p className="text-primary-200 font-medium uppercase tracking-[0.2em] text-sm">{t("eyebrow")}</p>
                    <h1 className="font-display font-bold text-5xl md:text-6xl lg:text-7xl text-white">{page.heroTitle}</h1>
                    <p className="text-lg md:text-xl xl:text-2xl text-ink-200">{page.heroSubtitle}</p>
                    <p className="text-ink-300 text-base md:text-lg">{page.intro}</p>
                    <div className="flex flex-wrap gap-2">
                        {page.searchIntents.slice(0, 6).map((intent) => (
                            <span key={intent} className="rounded-full border border-primary-500/30 px-3 py-1 text-primary-200 text-xs">
                                {intent}
                            </span>
                        ))}
                    </div>
                    <div className="flex flex-wrap gap-3 pt-2">
                        <StoreLinks />
                        <Link href={`/blog/${page.blogSlug}`} underline className="text-primary-200 hover:text-primary-100 text-lg self-center">
                            {t("readDeepGuide")}
                        </Link>
                    </div>
                </div>
                <div className="overflow-hidden rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur">
                    <Image
                        src="/images/blog/what-animal-am-i/wild-profile-hero.webp"
                        alt="AnimalDex Wild Profile showing Origin, Apex, and Active animal patterns"
                        width={1200}
                        height={630}
                        priority
                        className="h-auto w-full object-cover"
                    />
                </div>
            </section>

            <section className="rounded-4xl border border-primary-500/30 bg-primary-500/10 px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("rolesTitle")}</h2>
                <p className="text-ink-200 text-lg md:text-xl max-w-4xl">{t("rolesDescription")}</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {page.roleRows.map((row) => (
                        <article key={row.role} className="rounded-3xl border border-line-300/80 bg-surface-900/70 p-5 flex flex-col gap-2">
                            <h3 className="text-white font-display font-bold text-2xl">{row.role}</h3>
                            <p className="text-ink-200 text-base md:text-lg">{row.meaning}</p>
                        </article>
                    ))}
                </div>
            </section>

            <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("howTitle")}</h2>
                <ol className="flex flex-col gap-3 text-ink-200 text-lg md:text-xl list-decimal pl-5">
                    {page.howItWorks.map((step) => (
                        <li key={step}>{step}</li>
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

            <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("whyNotTitle")}</h2>
                {page.whyNotStatic.map((paragraph) => (
                    <p key={paragraph} className="text-ink-200 text-lg md:text-xl leading-8">
                        {paragraph}
                    </p>
                ))}
            </section>

            <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("faqTitle")}</h2>
                <p className="text-ink-200 text-lg md:text-xl">{t("faqDescription")}</p>
                {page.faq.map((item) => (
                    <div key={item.question} className="rounded-2xl border border-line-300/80 bg-surface-800/60 p-5">
                        <h3 className="text-white text-xl font-semibold">{item.question}</h3>
                        <p className="text-ink-200 text-base md:text-lg mt-2">{item.answer}</p>
                    </div>
                ))}
            </section>

            <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4 text-center">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("ctaTitle")}</h2>
                <p className="text-ink-200 text-lg md:text-xl max-w-3xl mx-auto">{t("ctaDescription")}</p>
                <div className="flex justify-center flex-wrap gap-3">
                    <StoreLinks />
                    <Link href="/blog/what-animal-am-i" underline className="text-primary-200 hover:text-primary-100 text-lg self-center">
                        {t("readDeepGuide")}
                    </Link>
                </div>
            </section>
        </article>
    );
}
