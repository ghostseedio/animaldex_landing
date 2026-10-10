import {Metadata} from "next";
import PageVideo from "@/app/[locale]/(composited)/_components/page-video/page-video";
import Link from "@/app/[locale]/_components/link";
import SpeciesArtworkImage from "@/app/[locale]/(composited)/animals/species-artwork-image";
import {ANIMAL_HYBRID_CANONICAL_BASE_PATH, getAnimalHybridForPair} from "@/data/animal-hybrids";
import {
    buildAnimalFusionSlug,
    formatFusionStat,
    getFusableSpecies,
    getPublishedAnimalFusion,
    getRelatedAnimalFusions,
    type AnimalFusionEntry,
    type FusableSpecies
} from "@/data/animal-fusions";
import {englishOnlyLanguageAlternates} from "@/lib/content-metadata";
import {getAbsoluteUrl, getLocalePath, getMetadataLocale} from "@/lib/site";
import {withOgCard} from "@/lib/og/og-image";

export type ResolvedFusion = {
    entry: AnimalFusionEntry;
    receiver: FusableSpecies;
    donor: FusableSpecies;
};

/** A fusion in the build snapshot, with both animals. */
export function resolvePublishedFusion(slug: string): ResolvedFusion | null {
    const entry = getPublishedAnimalFusion(slug);
    const receiver = entry ? getFusableSpecies(entry.receiverSlug) : null;
    const donor = entry ? getFusableSpecies(entry.donorSlug) : null;
    return entry && receiver && donor ? {entry, receiver, donor} : null;
}

function fusionTitle({entry, receiver, donor}: ResolvedFusion) {
    return `${receiver.name} + ${donor.name} Fusion: ${entry.name}`;
}

function fusionAnswer({entry, receiver, donor}: ResolvedFusion) {
    return `When the ${receiver.name} fuses with the ${donor.name}, its ${entry.receiverPrinciple} power learns ${entry.name} from the ${donor.name}'s ${entry.donorPrinciple}. ${entry.expression}`;
}

export function fusionMetadata(fusion: ResolvedFusion, locale: string): Metadata {
    const title = fusionTitle(fusion);
    const description = fusionAnswer(fusion).slice(0, 300);
    const path = `${ANIMAL_HYBRID_CANONICAL_BASE_PATH}/${fusion.entry.slug}`;

    return withOgCard({
        title,
        description,
        alternates: englishOnlyLanguageAlternates(path),
        openGraph: {
            type: "article",
            locale: getMetadataLocale(locale),
            title: `${title} | AnimalDex`,
            description,
            url: getLocalePath(locale, path)
        },
        twitter: {
            card: "summary",
            title: `${title} | AnimalDex`,
            description
        }
    }, title, "hybrid", fusion.entry.slug);
}

export default function AnimalFusionView({fusion, locale}: {fusion: ResolvedFusion; locale: string}) {
    const {entry, receiver, donor} = fusion;
    const title = fusionTitle(fusion);
    const answer = fusionAnswer(fusion);
    const pageUrl = getAbsoluteUrl(locale, `${ANIMAL_HYBRID_CANONICAL_BASE_PATH}/${entry.slug}`);
    const reverseSlug = buildAnimalFusionSlug(donor.slug, receiver.slug);
    const reverse = getPublishedAnimalFusion(reverseSlug);
    const related = getRelatedAnimalFusions(entry);
    const hybrid = getAnimalHybridForPair(receiver.slug, donor.slug);
    const boosts = [
        entry.primaryStat && entry.boostPrimary > 0 ? {stat: entry.primaryStat, value: entry.boostPrimary} : null,
        entry.secondaryStat && entry.boostSecondary > 0 ? {stat: entry.secondaryStat, value: entry.boostSecondary} : null
    ].filter((boost): boost is NonNullable<typeof boost> => boost !== null);
    const schema = [
        {
            "@context": "https://schema.org",
            "@type": "Article",
            headline: title,
            description: answer,
            url: pageUrl,
            dateModified: entry.updatedAt,
            inLanguage: locale,
            author: {"@type": "Organization", name: "AnimalDex"},
            publisher: {"@type": "Organization", name: "AnimalDex"},
            about: [receiver, donor].map((species) => ({"@type": "Thing", name: species.name, url: getAbsoluteUrl(locale, `/animals/${species.slug}`)}))
        },
        {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
                {"@type": "ListItem", position: 1, name: "AnimalDex", item: getAbsoluteUrl(locale)},
                {"@type": "ListItem", position: 2, name: "Animal Hybrid Lab", item: getAbsoluteUrl(locale, ANIMAL_HYBRID_CANONICAL_BASE_PATH)},
                {"@type": "ListItem", position: 3, name: title, item: pageUrl}
            ]
        }
    ];

    return (
        <article className="w-full max-w-[82rem] mx-auto px-4 md:px-8 py-16 md:py-24 flex flex-col gap-10">
            <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(schema)}} />

            <Link href={`${ANIMAL_HYBRID_CANONICAL_BASE_PATH}#fuse`} className="text-primary-200 hover:text-primary-100 transition-colors w-fit" underline>
                Back to Animal Hybrid Lab
            </Link>

            <section className="grid grid-cols-1 lg:grid-cols-[1fr_0.9fr] gap-8 items-center">
                <div className="flex flex-col gap-5">
                    <p className="text-primary-200 font-medium uppercase tracking-[0.2em] text-sm">Principle Fusion</p>
                    <h1 className="font-display font-bold text-5xl md:text-6xl lg:text-7xl text-white">
                        {receiver.name} + {donor.name}
                    </h1>
                    <p className="text-lg md:text-xl xl:text-2xl text-ink-200 leading-9">{answer}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    {[receiver, donor].map((species, index) => (
                        <Link key={species.slug} href={`/animals/${species.slug}`} aria-label={species.name}>
                            <SpeciesArtworkImage
                                slug={species.slug}
                                alt={`${species.name} artwork`}
                                priority={index === 0}
                                className="aspect-[4/5]  border border-line-300"
                                sizes="(min-width: 1024px) 20vw, 45vw"
                            />
                        </Link>
                    ))}
                </div>
            </section>

            {locale === "en" ? (
                <div className="editorial [&>section]:mb-0">
                    <PageVideo
                        type="fusion"
                        slug={entry.slug}
                        pageTitle={`${receiver.name} learns from the ${donor.name}`}
                        pageDescription={entry.expression}
                        pageUrl={pageUrl}
                        copy={{kicker: "See it in action", blurb: `The ${receiver.name}, imagined using what it learns from the ${donor.name}.`, footnote: "AI-generated imagery of an imagined behaviour."}}
                    />
                </div>
            ) : null}

            <section className="  border border-primary-500/40 bg-primary-900/10 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                <p className="text-primary-200 text-sm uppercase tracking-[0.2em]">Learned sub-principle</p>
                <h2 className="font-display font-bold text-4xl md:text-5xl text-white">{entry.name}</h2>
                <p className="text-ink-100 text-lg md:text-xl leading-8">{entry.expression}</p>
                {boosts.length > 0 ? (
                    <div className="flex flex-wrap gap-3">
                        {boosts.map((boost) => (
                            <span key={boost.stat} className="rounded-full border border-primary-500/40 px-4 py-2 font-semibold text-primary-100">
                                +{boost.value} {formatFusionStat(boost.stat)}
                            </span>
                        ))}
                    </div>
                ) : null}
                <p className="text-ink-300">
                    <span className="text-white">Helps in:</span> {entry.scenarioTags.map((tag) => tag.replace(/_/g, " ")).join(", ")}
                </p>
            </section>

            <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                    {role: "Receiver keeps", species: receiver, principle: entry.receiverPrinciple},
                    {role: "Donor teaches from", species: donor, principle: entry.donorPrinciple}
                ].map(({role, species, principle}) => (
                    <div key={species.slug} className="  border border-line-300 bg-surface-900/80 px-6 py-6 flex flex-col gap-3">
                        <p className="text-sm uppercase tracking-[0.2em] text-ink-400">{role}</p>
                        <h2 className="font-display text-3xl font-bold text-white">{species.name}</h2>
                        <p className="text-ink-200 text-lg leading-8">Animal power: <span className="text-white">{principle}</span></p>
                        <Link href={`/animals/${species.slug}`} className="text-primary-200 hover:text-primary-100 w-fit" underline>
                            View animal guide
                        </Link>
                    </div>
                ))}
            </section>

            <section className="  border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">How this fusion works</h2>
                <p className="text-ink-200 text-lg md:text-xl leading-8">
                    In a fusion nothing is bred: the {receiver.name} keeps its own body and its main power, {entry.receiverPrinciple}, and borrows one narrow lesson from the {donor.name}. The lesson only helps in situations that reward it, so the fusion is a specialist edge rather than an all-round upgrade.
                </p>
                <p className="text-ink-200 text-lg md:text-xl leading-8">
                    Fusions run one way.{" "}
                    {reverse ? (
                        <>The reverse pairing teaches something different: <Link href={`${ANIMAL_HYBRID_CANONICAL_BASE_PATH}/${reverse.slug}`} className="text-primary-200 hover:text-primary-100" underline>{donor.name} learns {reverse.name} from the {receiver.name}</Link>.</>
                    ) : (
                        <>The {donor.name} learning from the {receiver.name} would produce a different lesson. <Link href={`${ANIMAL_HYBRID_CANONICAL_BASE_PATH}?receiver=${donor.slug}&donor=${receiver.slug}#fuse`} className="text-primary-200 hover:text-primary-100" underline>Fuse the reverse pair</Link>.</>
                    )}
                </p>
            </section>

            {hybrid ? (
                <Link
                    href={`${ANIMAL_HYBRID_CANONICAL_BASE_PATH}/${hybrid.slug}`}
                    className="border border-line-300 bg-surface-900/80 px-6 py-6 flex flex-col gap-2 hover:border-primary-500/60 transition-colors"
                >
                    <span className="text-primary-200 text-sm uppercase tracking-[0.2em]">Same two animals as a hybrid creature</span>
                    <span className="font-display text-3xl font-bold text-white">{hybrid.title}: {hybrid.hybridName}</span>
                    <span className="text-ink-300">{hybrid.ultimateAbility.name}</span>
                </Link>
            ) : null}

            {related.length > 0 ? (
                <section className="flex flex-col gap-4">
                    <h2 className="font-display font-bold text-3xl md:text-4xl text-white">Related fusions</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {related.map((item) => (
                            <Link
                                key={item.slug}
                                href={`${ANIMAL_HYBRID_CANONICAL_BASE_PATH}/${item.slug}`}
                                className="rounded-3xl border border-line-300 bg-surface-900/80 px-5 py-5 hover:border-primary-500/60 transition-colors"
                            >
                                <span className="block text-primary-200 text-sm uppercase tracking-[0.2em]">{item.name}</span>
                                <span className="block font-display text-3xl font-bold text-white">
                                    {getFusableSpecies(item.receiverSlug)?.name} + {getFusableSpecies(item.donorSlug)?.name}
                                </span>
                            </Link>
                        ))}
                    </div>
                </section>
            ) : null}
        </article>
    );
}
