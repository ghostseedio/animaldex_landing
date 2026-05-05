import {getLocale, getTranslations} from "next-intl/server";
import {Metadata} from "next";
import Image from "next/image";
import Link from "@/app/[locale]/_components/link";
import Button from "@/app/[locale]/_components/button";
import {locationPages} from "@/data/locations";
import {loadLocaleMessages} from "@/loaders/locale";
import {localeConfig} from "@/i18n";
import {getAbsoluteUrl, getLocalePath, getMetadataLocale} from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
    const locale = await getLocale();
    const messages = await loadLocaleMessages(locale);
    const baseKeywords = Array.isArray(messages.meta?.keywords) ? messages.meta.keywords : [];
    const locationKeywords = Array.from(new Set(locationPages.flatMap((page) => page.searchIntents)));
    const title = messages.locations?.metaTitle || "Animal Locations";
    const description = messages.locations?.metaDescription || messages.meta?.description || "";

    return {
        title,
        description,
        keywords: [...baseKeywords, ...locationKeywords],
        alternates: {
            canonical: getLocalePath(locale, "/locations"),
            languages: localeConfig.locales.reduce((acc, localeItem) => {
                acc[localeItem] = `/${localeItem}/locations`;
                return acc;
            }, {
                "x-default": `/${localeConfig.defaultLocale}/locations`
            } as Record<string, string>)
        },
        openGraph: {
            type: "website",
            locale: getMetadataLocale(locale),
            title: `${title} | AnimalDex`,
            description,
            url: getLocalePath(locale, "/locations"),
            images: [
                {
                    url: "/images/placeholders/more-discovery.svg",
                    width: 1200,
                    height: 675,
                    alt: `${title} | AnimalDex`
                }
            ]
        },
        twitter: {
            card: "summary_large_image",
            title: `${title} | AnimalDex`,
            description,
            images: ["/images/placeholders/more-discovery.svg"]
        }
    };
}

export default async function LocationsIndexPage() {
    const t = await getTranslations("locations");
    const locale = await getLocale();
    const pageUrl = getAbsoluteUrl(locale, "/locations");

    const collectionSchema = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: t("title"),
        description: t("description"),
        url: pageUrl,
        inLanguage: locale
    };
    const itemListSchema = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        itemListElement: locationPages.map((page, index) => ({
            "@type": "ListItem",
            position: index + 1,
            url: getAbsoluteUrl(locale, `/locations/${page.slug}`),
            name: page.title
        }))
    };

    return (
        <section className="w-full max-w-6xl mx-auto px-4 md:px-8 py-16 md:py-24 flex flex-col gap-10">
            <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify([collectionSchema, itemListSchema])}} />

            <div className="flex flex-col gap-4 text-center items-center">
                <p className="text-primary-200 font-medium uppercase tracking-[0.2em] text-sm">{t("eyebrow")}</p>
                <h1 className="font-display font-bold text-5xl md:text-6xl lg:text-7xl text-white max-w-4xl">{t("title")}</h1>
                <p className="text-lg md:text-xl xl:text-2xl text-ink-200 max-w-4xl">{t("description")}</p>
                <Link href="/animals">
                    <Button as="span" className="text-lg md:text-xl py-3 px-6">
                        {t("searchAnimalsByLocation")}
                    </Button>
                </Link>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {locationPages.map((page) => (
                    <article
                        key={page.slug}
                        className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur p-6 md:p-8 flex flex-col gap-4"
                    >
                        <Link href={`/locations/${page.slug}`} className="overflow-hidden rounded-3xl border border-line-300 bg-surface-800/60">
                            <Image
                                src={page.featuredImage.src}
                                alt={page.featuredImage.alt}
                                width={page.featuredImage.width}
                                height={page.featuredImage.height}
                                sizes="(min-width: 1024px) 42vw, 100vw"
                                className="h-auto w-full object-cover"
                            />
                        </Link>
                        <div className="flex flex-wrap gap-2">
                            <span className="rounded-full border border-primary-500/30 px-3 py-1 text-primary-200 text-xs uppercase tracking-[0.22em] font-semibold">
                                {t(`types.${page.regionType}`)}
                            </span>
                        </div>
                        <h2 className="font-display font-bold text-3xl text-white">{page.title}</h2>
                        <p className="text-ink-200 text-lg">{page.description}</p>
                        <p className="text-white text-lg leading-8">{page.quickAnswer}</p>
                        <div className="mt-auto flex flex-wrap gap-3 items-center">
                            <Link
                                href={`/locations/${page.slug}`}
                                className="text-primary-200 text-lg hover:text-primary-100 transition-colors"
                                underline
                            >
                                {t("readLocation")}
                            </Link>
                        </div>
                    </article>
                ))}
            </div>

            <div className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4 text-center">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("indexCtaTitle")}</h2>
                <p className="text-ink-200 text-lg md:text-xl">{t("indexCtaDescription")}</p>
                <div className="flex justify-center">
                    <Link href="https://apps.apple.com/app/6761607780">
                        <Button as="span">{t("ctaButton")}</Button>
                    </Link>
                </div>
            </div>
        </section>
    );
}
