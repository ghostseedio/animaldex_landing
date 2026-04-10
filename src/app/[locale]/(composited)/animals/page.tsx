import {getLocale, getTranslations} from "next-intl/server";
import {Metadata} from "next";
import Link from "@/app/[locale]/_components/link";
import {speciesEntries} from "@/data/species";
import {loadLocaleMessages} from "@/loaders/locale";
import {getAbsoluteUrl, getLocalePath, getMetadataLocale} from "@/lib/site";
import {localeConfig} from "@/i18n";

function formatDate(locale: string, date: string) {
    return new Intl.DateTimeFormat(locale, {dateStyle: "long"}).format(new Date(date));
}

export async function generateMetadata(): Promise<Metadata> {
    const locale = await getLocale();
    const messages = await loadLocaleMessages(locale);
    const metaKeywords = Array.isArray(messages.meta?.keywords) ? messages.meta.keywords : [];
    const speciesKeywords = Array.from(new Set(speciesEntries.flatMap((entry) => entry.searchIntents)));
    const title = messages.animals?.metaTitle || "Animal Species Guides";
    const description = messages.animals?.metaDescription || messages.meta?.description || "";

    return {
        title,
        description,
        keywords: [...metaKeywords, ...speciesKeywords],
        alternates: {
            canonical: getLocalePath(locale, "/animals"),
            languages: localeConfig.locales.reduce((acc, localeItem) => {
                acc[localeItem] = `/${localeItem}/animals`;
                return acc;
            }, {
                "x-default": `/${localeConfig.defaultLocale}/animals`
            } as Record<string, string>)
        },
        openGraph: {
            type: "website",
            locale: getMetadataLocale(locale),
            title: `${title} | AnimalDex`,
            description,
            url: getLocalePath(locale, "/animals"),
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

export default async function AnimalsIndexPage() {
    const t = await getTranslations("animals");
    const locale = await getLocale();
    const pageUrl = getAbsoluteUrl(locale, "/animals");

    const schema = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: t("title"),
        description: t("description"),
        url: pageUrl,
        inLanguage: locale,
        hasPart: speciesEntries.map((entry) => ({
            "@type": "Article",
            headline: entry.heroTitle,
            about: entry.name,
            url: getAbsoluteUrl(locale, `/animals/${entry.slug}`)
        }))
    };

    return (
        <section className="w-full max-w-6xl mx-auto px-4 md:px-8 py-16 md:py-24 flex flex-col gap-10">
            <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(schema)}} />

            <div className="flex flex-col gap-4 text-center items-center">
                <p className="text-primary-200 font-medium uppercase tracking-[0.2em] text-sm">{t("eyebrow")}</p>
                <h1 className="font-display font-bold text-5xl md:text-6xl lg:text-7xl text-white max-w-4xl">{t("title")}</h1>
                <p className="text-lg md:text-xl xl:text-2xl text-ink-200 max-w-4xl">{t("description")}</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {speciesEntries.map((entry) => (
                    <article
                        key={entry.slug}
                        className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur p-6 md:p-8 flex flex-col gap-4"
                    >
                        <h2 className="font-display font-bold text-3xl text-white">{entry.heroTitle}</h2>
                        <p className="text-ink-200 text-lg">{entry.analysis.summary}</p>
                        <div className="text-ink-300 text-sm md:text-base">
                            <span className="text-white">{t("scientificName")}: </span>
                            {entry.analysis.scientificName}
                        </div>
                        <div className="text-ink-300 text-sm md:text-base">
                            <span className="text-white">{t("updated")}: </span>
                            {formatDate(locale, entry.updatedAt)}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {entry.searchIntents.map((intent) => (
                                <span key={intent} className="rounded-full border border-primary-500/30 px-3 py-1 text-primary-200 text-xs">
                                    {intent}
                                </span>
                            ))}
                        </div>
                        <Link
                            href={`/animals/${entry.slug}`}
                            className="mt-auto text-primary-200 text-lg hover:text-primary-100 transition-colors"
                            underline
                        >
                            {t("readSpecies")}
                        </Link>
                    </article>
                ))}
            </div>

            <div className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-3 text-center">
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
