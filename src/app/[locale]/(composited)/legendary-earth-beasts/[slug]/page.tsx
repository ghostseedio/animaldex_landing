import {Metadata} from "next";
import {notFound} from "next/navigation";
import Link from "@/app/[locale]/_components/link";
import ContentImageFigure from "@/app/[locale]/(composited)/_components/content-image-figure";
import SpeciesArtworkImage from "@/app/[locale]/(composited)/animals/species-artwork-image";
import SpeciesStatsSection from "@/app/[locale]/(composited)/animals/[slug]/species-stats-section";
import {getResolvedSpeciesBySlug} from "@/data/database-species-pages";
import {getLegendaryCatalogSeedByBeastSlug} from "@/data/legendary-earth-beasts-catalog-seed";
import {
    getLegendaryEarthBeast,
    getRelatedLegendaryEarthBeasts,
    LEGENDARY_EARTH_BEASTS_CANONICAL_BASE_PATH,
    LEGENDARY_EARTH_BEASTS_PILLAR_PATH
} from "@/data/legendary-earth-beasts";
import {getBattleTier, resolveSpeciesStats} from "@/data/species-stats";
import {buildContentMetadata} from "@/lib/content-metadata";
import {getLegendaryCaptureRequirementMessage} from "@/lib/legendary-earth-beast-capture";
import {getAbsoluteUrl} from "@/lib/site";

type LegendaryEarthBeastPageProps = {
    params: {
        locale: string;
        slug: string;
    };
};

function formatDate(locale: string, date: string) {
    return new Intl.DateTimeFormat(locale, {dateStyle: "long"}).format(new Date(date));
}

export const revalidate = 3600;
export const dynamicParams = true;

export function generateStaticParams() {
    return [
        {locale: "en", slug: "sinai-dragon"},
        {locale: "id", slug: "sinai-dragon"}
    ];
}

export async function generateMetadata({params}: LegendaryEarthBeastPageProps): Promise<Metadata> {
    const {locale, slug} = params;
    const entry = getLegendaryEarthBeast(slug);

    if (!entry) {
        return {};
    }

    return buildContentMetadata({
        locale,
        pathname: `${LEGENDARY_EARTH_BEASTS_CANONICAL_BASE_PATH}/${entry.slug}`,
        title: entry.title,
        description: entry.description,
        keywords: [...entry.searchIntents, entry.legendaryFormName, entry.displayName, entry.captureSite],
        featuredImage: entry.featuredImage,
        publishedAt: entry.publishedAt,
        updatedAt: entry.updatedAt,
        tags: [entry.legendaryType, entry.legendaryFormName, entry.region]
    });
}

function FactCard({label, value}: {label: string; value: string}) {
    return (
        <div className="rounded-3xl border border-line-300 bg-surface-900/80 px-5 py-5 flex flex-col gap-2">
            <p className="text-xs uppercase tracking-[0.18em] text-ink-400">{label}</p>
            <p className="text-white text-lg md:text-xl font-medium leading-7">{value}</p>
        </div>
    );
}

export default async function LegendaryEarthBeastPage({params}: LegendaryEarthBeastPageProps) {
    const {locale, slug} = params;
    const entry = getLegendaryEarthBeast(slug);

    if (!entry) {
        notFound();
    }

    const species = await getResolvedSpeciesBySlug(entry.slug);
    const catalogSeed = getLegendaryCatalogSeedByBeastSlug(entry.slug);
    const statsResult = species ? await resolveSpeciesStats(species.slug, species) : null;
    const battleTier = statsResult?.stats ? getBattleTier(statsResult.stats) : null;
    const captureRequirement = getLegendaryCaptureRequirementMessage(entry.slug);
    const relatedEntries = getRelatedLegendaryEarthBeasts(entry.slug);
    const pageUrl = getAbsoluteUrl(locale, `${LEGENDARY_EARTH_BEASTS_CANONICAL_BASE_PATH}/${entry.slug}`);
    const pillarUrl = getAbsoluteUrl(locale, LEGENDARY_EARTH_BEASTS_PILLAR_PATH);

    const schema = [
        {
            "@context": "https://schema.org",
            "@type": "Article",
            headline: entry.title,
            description: entry.description,
            url: pageUrl,
            datePublished: entry.publishedAt,
            dateModified: entry.updatedAt,
            inLanguage: locale,
            author: {"@type": "Organization", name: "AnimalDex"},
            publisher: {"@type": "Organization", name: "AnimalDex"},
            keywords: entry.searchIntents.join(", "),
            image: getAbsoluteUrl(locale, entry.featuredImage.src)
        },
        {
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
        },
        {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
                {"@type": "ListItem", position: 1, name: "AnimalDex", item: getAbsoluteUrl(locale)},
                {"@type": "ListItem", position: 2, name: "Legendary Earth Beasts", item: pillarUrl},
                {"@type": "ListItem", position: 3, name: entry.legendaryFormName, item: pageUrl}
            ]
        }
    ];

    return (
        <article className="w-full max-w-[82rem] mx-auto px-4 md:px-8 py-16 md:py-24 flex flex-col gap-10">
            <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(schema)}} />

            <Link href={LEGENDARY_EARTH_BEASTS_PILLAR_PATH} className="text-primary-200 hover:text-primary-100 transition-colors w-fit" underline>
                Back to Legendary Earth Beasts
            </Link>

            <section className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-8 items-start">
                <div className="flex flex-col gap-5">
                    <p className="text-primary-200 font-medium uppercase tracking-[0.2em] text-sm">
                        {entry.legendaryType} · Tier {entry.tier}
                    </p>
                    <h1 className="font-display font-bold text-5xl md:text-6xl lg:text-7xl text-white leading-[0.95]">
                        {entry.legendaryFormName}
                    </h1>
                    <p className="text-lg md:text-xl xl:text-2xl text-ink-200 leading-9">
                        {entry.quickAnswer}
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                        {entry.searchIntents.slice(0, 5).map((intent) => (
                            <span
                                key={intent}
                                className="rounded-full border border-primary-500/25 bg-primary-500/5 px-3 py-1 text-primary-200 text-xs"
                            >
                                {intent}
                            </span>
                        ))}
                    </div>
                </div>

                <ContentImageFigure image={entry.featuredImage} priority sizes="(min-width: 1024px) 40vw, 100vw" />
            </section>

            <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                <FactCard label="Tier" value={`${entry.tier} · ${entry.legendaryType}`} />
                <FactCard label="Scientific name" value={entry.scientificName} />
                <FactCard label="Capture landmark" value={catalogSeed?.captureSite ?? entry.captureSite} />
                <FactCard label="Legendary power" value={entry.power} />
            </section>

            {captureRequirement ? (
                <section className="rounded-4xl border border-primary-500/30 bg-primary-500/10 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                    <p className="text-primary-200 text-sm uppercase tracking-[0.2em]">Capture site</p>
                    <h2 className="font-display font-bold text-3xl md:text-4xl text-white">Landmark-only capture</h2>
                    <p className="text-ink-100 text-lg md:text-xl leading-8">{captureRequirement}</p>
                </section>
            ) : null}

            {entry.respectfulCaptureNote ? (
                <section className="rounded-4xl border border-amber-400/30 bg-amber-500/10 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                    <p className="text-amber-200 text-sm uppercase tracking-[0.2em]">Respectful capture</p>
                    <h2 className="font-display font-bold text-3xl md:text-4xl text-white">Handle this place with care</h2>
                    <p className="text-ink-100 text-lg md:text-xl leading-8">{entry.respectfulCaptureNote}</p>
                </section>
            ) : null}

            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                    <p className="text-primary-200 text-sm uppercase tracking-[0.2em]">The place</p>
                    <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{entry.captureSite}</h2>
                    {entry.placeStory.map((paragraph) => (
                        <p key={paragraph} className="text-ink-200 text-lg md:text-xl leading-8">
                            {paragraph}
                        </p>
                    ))}
                </div>

                <div className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                    <p className="text-primary-200 text-sm uppercase tracking-[0.2em]">The legendary animal</p>
                    <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{entry.legendaryFormName}</h2>
                    {species ? (
                        <div className="overflow-hidden rounded-3xl border border-line-300">
                            <SpeciesArtworkImage
                                slug={species.slug}
                                alt={`${species.name} artwork`}
                                className="aspect-[16/10] w-full"
                                sizes="(min-width: 1024px) 30vw, 100vw"
                            />
                        </div>
                    ) : null}
                    <p className="text-ink-200 text-lg md:text-xl leading-8">
                        {catalogSeed?.speciesSpotlight ?? entry.quickAnswer}
                    </p>
                    {species ? (
                        <Link href={`/animals/${species.slug}`} className="text-primary-200 hover:text-primary-100 w-fit" underline>
                            Open full species page — stats, field guide, and powers
                        </Link>
                    ) : null}
                    {catalogSeed ? (
                        <p className="text-ink-400 text-sm">
                            Biology inspired by {catalogSeed.biologyDisplayName} ({catalogSeed.scientificName}).
                        </p>
                    ) : null}
                </div>
            </section>

            {statsResult?.stats ? (
                <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                    <p className="text-primary-200 text-sm uppercase tracking-[0.2em]">Canonical stats</p>
                    <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{entry.legendaryFormName} battle profile</h2>
                    <SpeciesStatsSection
                        result={statsResult}
                        battleTier={battleTier}
                        labels={{
                            title: "Canonical game stats",
                            description: "Legendary Earth Beasts use flagship S-tier stats tied to their landmark capture site.",
                            battleTierChip: battleTier ? `Battle tier ${battleTier}` : "Battle tier",
                            sourceLabel: "Stats source",
                            dominance: "Dominance",
                            speed: "Speed",
                            size: "Size",
                            intelligence: "Intelligence",
                            rarity: "Rarity",
                            sourceSpeciesProfile: "Indexed species profile",
                            sourceAnalysisBase: "Analysis base",
                            sourceAnalysisEffective: "Analysis effective",
                            sourceRawJson: "Raw capture data",
                            sourceGenerated: "Generated estimate",
                            sourceNone: "Unavailable",
                            unavailableTitle: "Stats unavailable",
                            unavailableDescription: "Canonical stats are still syncing for this legendary animal."
                        }}
                    />
                </section>
            ) : null}

            {catalogSeed ? (
                <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-6">
                    <div className="flex flex-col gap-3">
                        <p className="text-primary-200 text-sm uppercase tracking-[0.2em]">Field guide</p>
                        <h2 className="font-display font-bold text-3xl md:text-4xl text-white">Habitat, traits, and ecology</h2>
                        <p className="text-ink-200 text-lg md:text-xl leading-8">
                            <span className="text-white">Habitat:</span> {catalogSeed.captureSite}
                        </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="rounded-2xl border border-line-300/80 bg-surface-800/60 p-5">
                            <h3 className="text-white text-xl font-semibold">Signature traits</h3>
                            <ul className="mt-3 space-y-2 text-ink-200">
                                {catalogSeed.signatureTraits.map((trait) => (
                                    <li key={trait}>{trait}</li>
                                ))}
                            </ul>
                        </div>
                        <div className="rounded-2xl border border-line-300/80 bg-surface-800/60 p-5">
                            <h3 className="text-white text-xl font-semibold">Interesting facts</h3>
                            <ul className="mt-3 space-y-2 text-ink-200">
                                {catalogSeed.interestingFacts.map((fact) => (
                                    <li key={fact}>{fact}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-ink-200">
                        <p><span className="text-white">Diet:</span> {catalogSeed.dietSummary}</p>
                        <p><span className="text-white">Predators:</span> {catalogSeed.predatorsSummary}</p>
                        <p><span className="text-white">Sleep pattern:</span> {catalogSeed.sleepPattern}</p>
                        <p><span className="text-white">Lifespan:</span> {catalogSeed.lifespanEstimate}</p>
                    </div>
                </section>
            ) : null}

            <section className="rounded-4xl border border-primary-500/40 bg-primary-900/10 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                <p className="text-primary-200 text-sm uppercase tracking-[0.2em]">Legendary power</p>
                <h2 className="font-display font-bold text-4xl md:text-5xl text-white">{entry.power}</h2>
                <p className="text-ink-100 text-lg md:text-xl leading-8">
                    <span className="text-white">Lesson:</span> {entry.lesson}
                </p>
                <p className="text-ink-300 text-lg md:text-xl leading-8">
                    <span className="text-white">Best for:</span> {entry.bestFor.join(", ")}
                </p>
                <p className="text-ink-300 text-base md:text-lg leading-7">
                    <span className="text-white">Image direction:</span> {entry.imageDirection}
                </p>
            </section>

            <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">Are these really petrified animals?</h2>
                <p className="text-ink-200 text-lg md:text-xl leading-8">
                    No. {entry.legendaryFormName} is inspired by a real place where natural rock, erosion, and human imagination overlap—not by a literal fossilized animal frozen in stone.
                </p>
                <p className="text-ink-200 text-lg md:text-xl leading-8">
                    In AnimalDex, {entry.legendaryFormName} is its own catalog species with flagship stats and a field guide. Its biology draws on {entry.displayName} ({entry.scientificName}) so the lesson stays educational and searchable.
                </p>
            </section>

            {entry.faq.length > 0 ? (
                <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                    <h2 className="font-display font-bold text-3xl md:text-4xl text-white">FAQ</h2>
                    {entry.faq.map((item) => (
                        <div key={item.question} className="rounded-2xl border border-line-300/80 bg-surface-800/60 p-5">
                            <h3 className="text-white text-xl font-semibold">{item.question}</h3>
                            <p className="text-ink-200 text-base md:text-lg mt-2 leading-7">{item.answer}</p>
                        </div>
                    ))}
                </section>
            ) : null}

            {entry.sources.length > 0 ? (
                <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                    <h2 className="font-display font-bold text-3xl md:text-4xl text-white">Sources and further reading</h2>
                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {entry.sources.map((source) => (
                            <li key={source.href} className="list-none rounded-2xl border border-line-300/80 bg-surface-800/60 p-4">
                                <a
                                    href={source.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary-200 hover:text-primary-100 transition-colors underline underline-offset-4"
                                >
                                    {source.label}
                                </a>
                            </li>
                        ))}
                    </ul>
                </section>
            ) : null}

            {relatedEntries.length > 0 ? (
                <section className="flex flex-col gap-4">
                    <h2 className="font-display font-bold text-3xl md:text-4xl text-white">Related Legendary Earth Beasts</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {relatedEntries.map((related) => (
                            <Link
                                key={related.slug}
                                href={`${LEGENDARY_EARTH_BEASTS_CANONICAL_BASE_PATH}/${related.slug}`}
                                className="rounded-3xl border border-line-300 bg-surface-900/80 px-5 py-5 hover:border-primary-500/60 transition-colors"
                            >
                                <span className="block text-primary-200 text-sm uppercase tracking-[0.2em]">{related.legendaryType}</span>
                                <span className="block font-display text-3xl font-bold text-white mt-2">{related.legendaryFormName}</span>
                                <span className="block text-ink-300 mt-2">{related.captureSite.split(",")[0]}</span>
                                <span className="block text-ink-400 mt-3 text-sm">{related.power}</span>
                            </Link>
                        ))}
                    </div>
                </section>
            ) : null}

            <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-3 text-center items-center">
                <p className="text-ink-300 text-sm uppercase tracking-[0.18em]">Updated {formatDate(locale, entry.updatedAt || entry.publishedAt)}</p>
                <p className="text-ink-200 text-lg md:text-xl max-w-3xl leading-8">
                    Part of the AnimalDex Legendary Earth Beasts pillar guide. Explore all twenty formations, their flagship species pages, and the landmarks where they can be captured.
                </p>
                <Link href={LEGENDARY_EARTH_BEASTS_PILLAR_PATH} className="text-primary-200 hover:text-primary-100" underline>
                    Read the full Legendary Earth Beasts guide
                </Link>
            </section>
        </article>
    );
}
