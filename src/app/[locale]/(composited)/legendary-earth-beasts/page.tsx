import {Metadata} from "next";
import Link from "@/app/[locale]/_components/link";
import StoreLinks from "@/app/[locale]/(composited)/_components/store-links";
import LegendaryEarthBeastsHubGrid from "@/app/[locale]/(composited)/legendary-earth-beasts/_components/legendary-earth-beasts-hub-grid";
import {
    getLaunchPriorityLegendaryEarthBeasts,
    LEGENDARY_EARTH_BEASTS_CANONICAL_BASE_PATH,
    legendaryEarthBeastEntries,
    legendaryEarthBeastsHubDescription,
    legendaryEarthBeastsHubFaq,
    legendaryEarthBeastsHubTitle
} from "@/data/legendary-earth-beasts";
import {getSpeciesBySlug} from "@/data/species";
import {buildContentMetadata} from "@/lib/content-metadata";
import {getAbsoluteUrl} from "@/lib/site";

type LegendaryEarthBeastsHubPageProps = {
    params: {
        locale: string;
    };
};

const hubFeaturedImage = legendaryEarthBeastEntries.find((beast) => beast.slug === "naga-snake")?.featuredImage || {
    src: "/images/placeholders/blog-image-slot.svg",
    alt: "Legendary Earth Beasts",
    width: 1600,
    height: 900
};

export async function generateMetadata({params}: LegendaryEarthBeastsHubPageProps): Promise<Metadata> {
    const {locale} = params;

    return buildContentMetadata({
        locale,
        pathname: LEGENDARY_EARTH_BEASTS_CANONICAL_BASE_PATH,
        title: legendaryEarthBeastsHubTitle,
        description: legendaryEarthBeastsHubDescription,
        keywords: [
            "legendary earth beasts",
            "rocks that look like animals",
            "petrified animal rocks",
            "naga cave",
            "dragon head mountain",
            "elephant rock alula",
            "devils tower bear legend",
            "animal shaped rocks",
            "animaldex captures"
        ],
        featuredImage: hubFeaturedImage,
        publishedAt: "2026-07-06",
        updatedAt: "2026-07-06",
        tags: ["Legendary Earth Beasts", "Animal-Shaped Rocks", "AnimalDex"]
    });
}

export default async function LegendaryEarthBeastsHubPage({params}: LegendaryEarthBeastsHubPageProps) {
    const {locale} = params;
    const pageUrl = getAbsoluteUrl(locale, LEGENDARY_EARTH_BEASTS_CANONICAL_BASE_PATH);
    const launchBeasts = getLaunchPriorityLegendaryEarthBeasts(10);
    const linkedSpecies = Array.from(
        new Set(
            legendaryEarthBeastEntries
                .map((beast) => beast.speciesSlug)
                .filter((slug): slug is string => Boolean(slug))
        )
    )
        .map((slug) => getSpeciesBySlug(slug))
        .filter((entry): entry is NonNullable<ReturnType<typeof getSpeciesBySlug>> => Boolean(entry));

    const schema = [
        {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: legendaryEarthBeastsHubTitle,
            description: legendaryEarthBeastsHubDescription,
            url: pageUrl,
            inLanguage: locale
        },
        {
            "@context": "https://schema.org",
            "@type": "ItemList",
            itemListElement: legendaryEarthBeastEntries.map((beast, index) => ({
                "@type": "ListItem",
                position: index + 1,
                name: beast.legendaryFormName,
                url: getAbsoluteUrl(locale, `${LEGENDARY_EARTH_BEASTS_CANONICAL_BASE_PATH}/${beast.slug}`)
            }))
        },
        {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: legendaryEarthBeastsHubFaq.map((item) => ({
                "@type": "Question",
                name: item.question,
                acceptedAnswer: {
                    "@type": "Answer",
                    text: item.answer
                }
            }))
        }
    ];

    return (
        <article className="w-full max-w-[88rem] mx-auto px-4 md:px-8 py-16 md:py-24 flex flex-col gap-12">
            <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(schema)}} />

            <header className="flex flex-col gap-6 text-center items-center max-w-5xl mx-auto">
                <p className="text-primary-200 font-medium uppercase tracking-[0.2em] text-sm">
                    AnimalDex feature hub
                </p>
                <h1 className="font-display font-bold text-5xl md:text-6xl lg:text-7xl text-white leading-[0.95]">
                    Legendary Earth Beasts
                </h1>
                <p className="text-lg md:text-xl xl:text-2xl text-ink-200 leading-9">
                    Real animal species awakened by mythic landforms. Visit places where caves, mountains, cliffs, and coastlines look like dragons, serpents, elephants, bears, whales, and more—then capture the real species behind each legendary form.
                </p>
            </header>

            <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4 max-w-5xl mx-auto w-full">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">Real species. Mythic places. S-tier captures.</h2>
                <p className="text-ink-200 text-lg md:text-xl leading-8">
                    Legendary Earth Beasts are not fantasy-only monsters. Each entry pairs a real scientific species with a real-world formation or cultural site—from Naka Cave and Dragon Head Mountain to Elephant Rock, Sigiriya, Devils Tower, and Hin Sam Wan.
                </p>
                <p className="text-ink-200 text-lg md:text-xl leading-8">
                    The goal in AnimalDex is simple: travel to the formation, capture respectfully from a public viewpoint, and unlock the real animal with its legendary form, power, and lesson.
                </p>
            </section>

            <section className="flex flex-col gap-6">
                <div className="flex flex-col gap-3">
                    <h2 className="font-display font-bold text-4xl md:text-5xl text-white">All 20 Legendary Earth Beasts</h2>
                    <p className="text-ink-300 text-lg md:text-xl max-w-4xl">
                        Filter by legendary type, respectful-capture sites, dragons and serpents, mammal titans, or ocean beasts.
                    </p>
                </div>
                <LegendaryEarthBeastsHubGrid beasts={legendaryEarthBeastEntries} />
            </section>

            <section className="rounded-4xl border border-primary-500/30 bg-primary-900/10 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">Strongest launch picks</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {launchBeasts.map((beast, index) => (
                        <Link
                            key={beast.slug}
                            href={`${LEGENDARY_EARTH_BEASTS_CANONICAL_BASE_PATH}/${beast.slug}`}
                            className="rounded-2xl border border-line-300/80 bg-surface-900/70 px-4 py-4 hover:border-primary-500/40 transition-colors"
                        >
                            <span className="text-primary-200 text-xs uppercase tracking-[0.18em]">
                                Launch pick {index + 1}
                            </span>
                            <span className="block font-display text-2xl font-bold text-white mt-1">
                                {beast.legendaryFormName}
                            </span>
                            <span className="block text-ink-300 mt-1">{beast.captureSite.split(",")[0]}</span>
                        </Link>
                    ))}
                </div>
            </section>

            <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-5">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">Start capturing in AnimalDex</h2>
                <p className="text-ink-200 text-lg md:text-xl leading-8 max-w-4xl">
                    Legendary Earth Beasts extend the normal capture loop: identify wildlife, collect species, and learn from real places—not just pets, zoos, and backyard animals.
                </p>
                <div className="flex flex-wrap gap-3">
                    <Link
                        href="/capture-animals-app"
                        className="rounded-full border border-primary-500/40 bg-primary-500/10 px-5 py-3 text-primary-100 hover:bg-primary-500/20 transition-colors"
                    >
                        Capture animals app
                    </Link>
                    <Link
                        href="/best-animal-identification-app"
                        className="rounded-full border border-line-300 bg-surface-800/80 px-5 py-3 text-white hover:border-primary-500/30 transition-colors"
                    >
                        Animal identification app
                    </Link>
                </div>
                <StoreLinks variant="text" />
            </section>

            {linkedSpecies.length > 0 ? (
                <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                    <h2 className="font-display font-bold text-3xl md:text-4xl text-white">Species anchors in the catalog</h2>
                    <p className="text-ink-200 text-lg md:text-xl">
                        Every Legendary Earth Beast links to a real species page where the biology, lesson, and field-guide context already live.
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {linkedSpecies.map((species) => (
                            <Link
                                key={species.slug}
                                href={`/animals/${species.slug}`}
                                className="rounded-full border border-primary-500/30 px-4 py-2 text-primary-200 hover:text-primary-100 text-sm"
                            >
                                {species.name}
                            </Link>
                        ))}
                    </div>
                </section>
            ) : null}

            <section id="faq" className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">FAQ</h2>
                {legendaryEarthBeastsHubFaq.map((item) => (
                    <div key={item.question} className="rounded-2xl border border-line-300/80 bg-surface-800/60 p-5">
                        <h3 className="text-white text-xl font-semibold">{item.question}</h3>
                        <p className="text-ink-200 text-base md:text-lg mt-2 leading-7">{item.answer}</p>
                    </div>
                ))}
            </section>
        </article>
    );
}
