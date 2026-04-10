import {Metadata} from "next";
import {notFound} from "next/navigation";
import Link from "@/app/[locale]/_components/link";
import SystemsIntelligenceSection from "@/app/[locale]/(composited)/_components/systems-intelligence-section";
import {getBlogPostsForSpecies} from "@/data/blog";
import {getRelatedSpecies, getSpeciesBySlug, rarityLabel, speciesEntries} from "@/data/species";
import {getSystemsIntelligenceBySpeciesSlug} from "@/data/species-systems-intelligence";
import {buildContentMetadata} from "@/lib/content-metadata";
import {getAbsoluteUrl} from "@/lib/site";
import {getScopedTranslator} from "@/loaders/translation";

type SpeciesPageProps = {
    params: {
        locale: string;
        slug: string;
    };
};

function formatDate(locale: string, date: string) {
    return new Intl.DateTimeFormat(locale, {dateStyle: "long"}).format(new Date(date));
}

export async function generateMetadata({params}: SpeciesPageProps): Promise<Metadata> {
    const {locale, slug} = params;
    const entry = getSpeciesBySlug(slug);

    if (!entry) {
        return {};
    }

    const title = `${entry.name} — Identification, Habitat, Rarity & Facts`;
    const description = `${entry.name}: ${entry.analysis.summary} Learn identification traits, habitat, native range, rarity, behavior, and related animals with AnimalDex.`;

    return buildContentMetadata({
        locale,
        pathname: `/animals/${entry.slug}`,
        title,
        description,
        keywords: [...entry.searchIntents, entry.name, entry.analysis.scientificName, "animal identification app", "wildlife app"],
        featuredImage: entry.featuredImage,
        publishedAt: entry.publishedAt,
        updatedAt: entry.updatedAt,
        tags: entry.searchIntents
    });
}

export function generateStaticParams() {
    return speciesEntries.map((entry) => ({slug: entry.slug}));
}

export default async function SpeciesPage({params}: SpeciesPageProps) {
    const {locale, slug} = params;
    const t = await getScopedTranslator(locale, "animals");
    const entry = getSpeciesBySlug(slug);

    if (!entry) {
        notFound();
    }

    const related = getRelatedSpecies(entry.slug, 3);
    const relatedBlogPosts = getBlogPostsForSpecies(entry.slug, 3);
    const systemsEntry = getSystemsIntelligenceBySpeciesSlug(entry.slug);
    const pageUrl = getAbsoluteUrl(locale, `/animals/${entry.slug}`);
    const thingSchema = {
        "@context": "https://schema.org",
        "@type": "Thing",
        name: entry.name,
        alternateName: entry.analysis.scientificName,
        description: entry.analysis.summary,
        category: entry.analysis.category
    };
    const articleSchema = {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: entry.heroTitle,
        description: entry.analysis.summary,
        datePublished: entry.publishedAt,
        dateModified: entry.updatedAt,
        image: getAbsoluteUrl(locale, entry.featuredImage.src),
        author: {
            "@type": "Organization",
            name: "AnimalDex"
        },
        publisher: {
            "@type": "Organization",
            name: "AnimalDex"
        },
        mainEntityOfPage: pageUrl,
        about: [
            {
                "@type": "Thing",
                name: entry.name
            },
            {
                "@type": "Thing",
                name: entry.analysis.scientificName
            }
        ]
    };

    return (
        <article className="w-full max-w-5xl mx-auto px-4 md:px-8 py-16 md:py-24 flex flex-col gap-10">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{__html: JSON.stringify([thingSchema, articleSchema])}}
            />

            <div className="flex flex-col gap-4">
                <Link href="/animals" className="text-primary-200 hover:text-primary-100 transition-colors w-fit" underline>
                    {t("back")}
                </Link>
                <h1 className="font-display font-bold text-5xl md:text-6xl text-white">{entry.heroTitle}</h1>
                <p className="text-lg md:text-xl xl:text-2xl text-ink-200">{entry.analysis.summary}</p>
                <div className="text-ink-300 text-sm md:text-base flex flex-wrap gap-x-6 gap-y-3">
                    <span>
                        <span className="text-white">{t("scientificName")}: </span>
                        {entry.analysis.scientificName}
                    </span>
                    <span>
                        <span className="text-white">{t("category")}: </span>
                        {entry.analysis.category}
                    </span>
                    <span>
                        <span className="text-white">{t("published")}: </span>
                        {formatDate(locale, entry.publishedAt)}
                    </span>
                    <span>
                        <span className="text-white">{t("updated")}: </span>
                        {formatDate(locale, entry.updatedAt)}
                    </span>
                </div>
            </div>

            <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("whatIsTitle", {animal: entry.name})}</h2>
                <p className="text-ink-200 text-lg md:text-xl leading-8">{entry.analysis.summary}</p>
            </section>

            <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("identifyTitle", {animal: entry.name})}</h2>
                <ul className="flex flex-col gap-2 text-ink-200 text-lg md:text-xl list-disc pl-5">
                    {entry.analysis.identification.map((item) => (
                        <li key={item}>{item}</li>
                    ))}
                </ul>
            </section>

            <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("whereFoundTitle", {animal: entry.name})}</h2>
                <p className="text-ink-200 text-lg md:text-xl leading-8">
                    <span className="text-white">{t("habitatLabel")}: </span>
                    {entry.analysis.habitat}
                </p>
                <p className="text-ink-200 text-lg md:text-xl leading-8">
                    <span className="text-white">{t("nativeRangeLabel")}: </span>
                    {entry.analysis.nativeRange}
                </p>
            </section>

            <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("rareTitle", {animal: entry.name})}</h2>
                <p className="text-ink-200 text-lg md:text-xl leading-8">
                    <span className="text-white">{t("rarityLabel")}: </span>
                    {rarityLabel(entry.analysis.rarityScore)} ({entry.analysis.rarityScore}/100)
                </p>
                <p className="text-ink-200 text-lg md:text-xl leading-8">{entry.analysis.rarityReason}</p>
            </section>

            {systemsEntry && (
                <SystemsIntelligenceSection
                    items={[
                        {
                            slug: entry.slug,
                            name: entry.name,
                            entry: systemsEntry
                        }
                    ]}
                    labels={{
                        title: t("systemsIntelligenceTitle"),
                        description: t("systemsIntelligenceDescription"),
                        systemRole: t("systemRoleLabel"),
                        specializedHardware: t("specializedHardwareLabel"),
                        systemsScript: t("systemsScriptLabel"),
                        strategicInsight: t("strategicInsightLabel")
                    }}
                />
            )}

            <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("behaviorTitle", {animal: entry.name})}</h2>
                <ul className="flex flex-col gap-2 text-ink-200 text-lg md:text-xl list-disc pl-5">
                    {entry.premiumDetails.behaviorTraits.map((item) => (
                        <li key={item}>{item}</li>
                    ))}
                </ul>
            </section>

            <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("interestingTitle", {animal: entry.name})}</h2>
                <ul className="flex flex-col gap-2 text-ink-200 text-lg md:text-xl list-disc pl-5">
                    {entry.premiumDetails.whyInteresting.map((item) => (
                        <li key={item}>{item}</li>
                    ))}
                </ul>
            </section>

            <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("spottingTitle")}</h2>
                <ul className="flex flex-col gap-2 text-ink-200 text-lg md:text-xl list-disc pl-5">
                    {entry.premiumDetails.respectfulSpotting.map((item) => (
                        <li key={item}>{item}</li>
                    ))}
                </ul>
            </section>

            <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("lookalikesTitle")}</h2>
                <ul className="flex flex-col gap-2 text-ink-200 text-lg md:text-xl list-disc pl-5">
                    {entry.premiumDetails.lookalikes.map((item) => (
                        <li key={item}>{item}</li>
                    ))}
                </ul>
            </section>

            <section className="flex flex-col gap-4">
                <h2 className="font-display font-bold text-4xl text-white">{t("relatedTitle")}</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {related.map((item) => (
                        <article
                            key={item.slug}
                            className="rounded-3xl border border-line-300 bg-surface-900/80 backdrop-blur p-5 flex flex-col gap-3"
                        >
                            <h3 className="font-display font-bold text-2xl text-white">{item.name}</h3>
                            <p className="text-ink-200 text-base">{item.analysis.summary}</p>
                            <Link
                                href={`/animals/${item.slug}`}
                                className="mt-auto text-primary-200 hover:text-primary-100 transition-colors"
                                underline
                            >
                                {t("readSpecies")}
                            </Link>
                        </article>
                    ))}
                </div>
            </section>

            {relatedBlogPosts.length > 0 && (
                <section className="flex flex-col gap-4">
                    <h2 className="font-display font-bold text-4xl text-white">{t("relatedBlogTitle")}</h2>
                    <p className="text-ink-200 text-lg md:text-xl">{t("relatedBlogDescription")}</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {relatedBlogPosts.map((post) => (
                            <article
                                key={post.slug}
                                className="rounded-3xl border border-line-300 bg-surface-900/80 backdrop-blur p-5 flex flex-col gap-3"
                            >
                                <h3 className="font-display font-bold text-2xl text-white">{post.title}</h3>
                                <p className="text-ink-200 text-base">{post.description}</p>
                                <Link
                                    href={`/blog/${post.slug}`}
                                    className="mt-auto text-primary-200 hover:text-primary-100 transition-colors"
                                    underline
                                >
                                    {t("readBlog")}
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
