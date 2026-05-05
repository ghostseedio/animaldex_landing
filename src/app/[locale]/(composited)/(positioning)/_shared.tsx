import {getLocale, getTranslations} from "next-intl/server";
import {Metadata} from "next";
import {notFound} from "next/navigation";
import Link from "@/app/[locale]/_components/link";
import Button from "@/app/[locale]/_components/button";
import {collectorPages, getCollectorPage} from "@/data/collector-pages";
import {loadLocaleMessages} from "@/loaders/locale";
import {getAbsoluteUrl, getLocalePath, getMetadataLocale} from "@/lib/site";
import {localeConfig} from "@/i18n";

type PositioningPageResult = {
    slug: string;
};

export async function generateCollectorMetadata(slug: string): Promise<Metadata> {
    const locale = await getLocale();
    const entry = getCollectorPage(slug);
    const messages = await loadLocaleMessages(locale);
    const baseKeywords = Array.isArray(messages.meta?.keywords) ? messages.meta.keywords : [];

    if (!entry) {
        return {};
    }

    return {
        title: entry.heroTitle,
        description: entry.description,
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
            type: "website",
            locale: getMetadataLocale(locale),
            title: `${entry.heroTitle} | AnimalDex`,
            description: entry.description,
            url: getLocalePath(locale, `/${entry.slug}`),
            images: [
                {
                    url: "/images/og.png",
                    width: 1200,
                    height: 630,
                    alt: `${entry.heroTitle} | AnimalDex`
                }
            ]
        },
        twitter: {
            card: "summary_large_image",
            title: `${entry.heroTitle} | AnimalDex`,
            description: entry.description,
            images: ["/images/og.png"]
        }
    };
}

export default async function CollectorLandingPage({slug}: PositioningPageResult) {
    const t = await getTranslations("collectorPages");
    const locale = await getLocale();
    const entry = getCollectorPage(slug);

    if (!entry) {
        notFound();
    }

    const pageUrl = getAbsoluteUrl(locale, `/${entry.slug}`);
    const schema = {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: entry.heroTitle,
        description: entry.description,
        inLanguage: locale,
        url: pageUrl,
        about: entry.searchIntents.map((intent) => ({
            "@type": "Thing",
            name: intent
        }))
    };

    return (
        <article className="w-full max-w-5xl mx-auto px-4 md:px-8 py-16 md:py-24 flex flex-col gap-10">
            <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(schema)}} />

            <div className="flex flex-col gap-4">
                <Link href="/use-cases" className="text-primary-200 hover:text-primary-100 transition-colors w-fit" underline>
                    {t("back")}
                </Link>
                <h1 className="font-display font-bold text-5xl md:text-6xl text-white">{entry.heroTitle}</h1>
                <p className="text-lg md:text-xl xl:text-2xl text-ink-200">{entry.description}</p>
                <div className="flex flex-wrap gap-2">
                    {entry.searchIntents.map((intent) => (
                        <span key={intent} className="rounded-full border border-primary-500/30 px-3 py-1 text-primary-200 text-xs">
                            {intent}
                        </span>
                    ))}
                </div>
                <div className="flex flex-wrap gap-3 pt-2">
                    <Link href="/">
                        <Button as="span">{t("homeButton")}</Button>
                    </Link>
                    <Link href="https://apps.apple.com/app/6761607780">
                        <Button as="span">{t("appButton")}</Button>
                    </Link>
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

            <div className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4 text-center">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("ctaTitle")}</h2>
                <p className="text-ink-200 text-lg md:text-xl">{t("ctaDescription")}</p>
                <div className="flex justify-center flex-wrap gap-3">
                    <Link href="/">
                        <Button as="span">{t("homeButton")}</Button>
                    </Link>
                    <Link href="https://apps.apple.com/app/6761607780">
                        <Button as="span">{t("appButton")}</Button>
                    </Link>
                </div>
            </div>
        </article>
    );
}

export function getCollectorStaticParams() {
    return collectorPages.map((entry) => ({slug: entry.slug}));
}
