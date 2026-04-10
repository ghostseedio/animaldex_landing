import {getLocale, getTranslations} from "next-intl/server";
import {Metadata} from "next";
import Link from "@/app/[locale]/_components/link";
import {useCases} from "@/data/use-cases";
import {collectorPages} from "@/data/collector-pages";
import {loadLocaleMessages} from "@/loaders/locale";
import {getAbsoluteUrl, getLocalePath, getMetadataLocale} from "@/lib/site";
import {localeConfig} from "@/i18n";

function formatDate(locale: string, date: string) {
    return new Intl.DateTimeFormat(locale, {dateStyle: "long"}).format(new Date(date));
}

export async function generateMetadata(): Promise<Metadata> {
    const locale = await getLocale();
    const messages = await loadLocaleMessages(locale);
    const baseKeywords = Array.isArray(messages.meta?.keywords) ? messages.meta.keywords : [];
    const useCaseKeywords = Array.from(new Set(useCases.flatMap((entry) => entry.searchIntents)));
    const title = messages.useCases?.metaTitle || "AnimalDex Use Cases";
    const description = messages.useCases?.metaDescription || messages.meta?.description || "";

    return {
        title,
        description,
        keywords: [...baseKeywords, ...useCaseKeywords],
        alternates: {
            canonical: getLocalePath(locale, "/use-cases"),
            languages: localeConfig.locales.reduce((acc, localeItem) => {
                acc[localeItem] = `/${localeItem}/use-cases`;
                return acc;
            }, {
                "x-default": `/${localeConfig.defaultLocale}/use-cases`
            } as Record<string, string>)
        },
        openGraph: {
            type: "website",
            locale: getMetadataLocale(locale),
            title: `${title} | AnimalDex`,
            description,
            url: getLocalePath(locale, "/use-cases"),
            images: [
                {
                    url: "/images/og-animaldex.svg",
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
            images: ["/images/og-animaldex.svg"]
        }
    };
}

export default async function UseCasesIndexPage() {
    const t = await getTranslations("useCases");
    const locale = await getLocale();
    const pageUrl = getAbsoluteUrl(locale, "/use-cases");

    const schema = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: t("title"),
        description: t("description"),
        url: pageUrl,
        inLanguage: locale,
        hasPart: useCases.map((entry) => ({
            "@type": "WebPage",
            name: entry.title,
            url: getAbsoluteUrl(locale, `/use-cases/${entry.slug}`),
            dateModified: entry.updatedAt
        }))
    };

    return (
        <section className="w-full max-w-6xl mx-auto px-4 md:px-8 py-16 md:py-24 flex flex-col gap-10">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{__html: JSON.stringify(schema)}}
            />

            <div className="flex flex-col gap-4 text-center items-center">
                <p className="text-primary-200 font-medium uppercase tracking-[0.2em] text-sm">{t("eyebrow")}</p>
                <h1 className="font-display font-bold text-5xl md:text-6xl lg:text-7xl text-white max-w-4xl">{t("title")}</h1>
                <p className="text-lg md:text-xl xl:text-2xl text-ink-200 max-w-4xl">{t("description")}</p>
            </div>

            <div className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-3">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("coverageTitle")}</h2>
                <p className="text-ink-200 text-lg md:text-xl">{t("coverageDescription")}</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {useCases.map((entry) => (
                    <article
                        key={entry.slug}
                        className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur p-6 md:p-8 flex flex-col gap-4"
                    >
                        <p className="text-primary-200 text-sm uppercase tracking-[0.14em]">{entry.shortLabel}</p>
                        <h2 className="font-display font-bold text-3xl text-white">{entry.title}</h2>
                        <p className="text-ink-200 text-lg">{entry.description}</p>
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
                                <span
                                    key={intent}
                                    className="rounded-full border border-primary-500/30 px-3 py-1 text-primary-200 text-xs"
                                >
                                    {intent}
                                </span>
                            ))}
                        </div>
                        <Link
                            href={`/use-cases/${entry.slug}`}
                            className="mt-auto text-primary-200 text-lg hover:text-primary-100 transition-colors"
                            underline
                        >
                            {t("readCase")}
                        </Link>
                    </article>
                ))}
            </div>

            <div className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("collectorTitle")}</h2>
                <p className="text-ink-200 text-lg md:text-xl">{t("collectorDescription")}</p>
                <div className="flex flex-wrap gap-3">
                    {collectorPages.map((entry) => (
                        <Link
                            key={entry.slug}
                            href={`/${entry.slug}`}
                            className="rounded-full border border-primary-500/30 px-4 py-2 text-primary-200 hover:text-primary-100 transition-colors"
                        >
                            {entry.title}
                        </Link>
                    ))}
                </div>
            </div>

            <div className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4 text-center">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("ctaTitle")}</h2>
                <p className="text-ink-200 text-lg md:text-xl">{t("ctaDescription")}</p>
                <div className="flex justify-center">
                    <Link href="/#download" underline className="text-primary-200 text-lg hover:text-primary-100 transition-colors">
                        {t("ctaButton")}
                    </Link>
                </div>
            </div>
        </section>
    );
}
