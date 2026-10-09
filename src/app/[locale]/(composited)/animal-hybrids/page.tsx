import {Metadata} from "next";
import AnimalFuseTool from "@/app/[locale]/(composited)/animal-hybrids/animal-fuse-tool";
import AnimalHybridGrid, {type AnimalHybridCard} from "@/app/[locale]/(composited)/animal-hybrids/animal-hybrid-grid";
import {formatFusionStat, getFusableSpecies, publishedAnimalFusions} from "@/data/animal-fusions";
import {ANIMAL_HYBRID_CANONICAL_BASE_PATH, animalHybridEntries} from "@/data/animal-hybrids";
import {getSpeciesBySlug} from "@/data/species";
import {localeConfig} from "@/i18n";
import {getAbsoluteUrl, getLocalePath, getMetadataLocale} from "@/lib/site";

export const revalidate = 86400;

export function generateStaticParams() {
    return [{locale: "en"}, {locale: "id"}];
}

const title = "Animal Hybrid Lab";
const description = "Speculative animal hybrids that answer how a cross like zebra + rhino might look and behave, plus AnimalDex fusions: pick any two animals and see what one learns from the other.";

type AnimalHybridsIndexPageProps = {
    params: {
        locale: string;
    };
};

export async function generateMetadata({params}: AnimalHybridsIndexPageProps): Promise<Metadata> {
    const {locale} = params;

    return {
        title,
        description,
        keywords: [
            "animal hybrids",
            "hypothetical animal hybrids",
            "zebra rhino hybrid",
            "animal cross ideas",
            "what would animal hybrids look like",
            "animal fusion",
            "fuse two animals"
        ],
        alternates: {
            canonical: getLocalePath(locale, ANIMAL_HYBRID_CANONICAL_BASE_PATH),
            languages: localeConfig.locales.reduce((acc, localeItem) => {
                acc[localeItem] = getLocalePath(localeItem, ANIMAL_HYBRID_CANONICAL_BASE_PATH);
                return acc;
            }, {
                "x-default": getLocalePath(localeConfig.defaultLocale, ANIMAL_HYBRID_CANONICAL_BASE_PATH)
            } as Record<string, string>)
        },
        openGraph: {
            type: "website",
            locale: getMetadataLocale(locale),
            title: `${title} | AnimalDex`,
            description,
            url: getLocalePath(locale, ANIMAL_HYBRID_CANONICAL_BASE_PATH)
        },
        twitter: {
            card: "summary",
            title: `${title} | AnimalDex`,
            description
        }
    };
}

export default async function AnimalHybridsIndexPage({params}: AnimalHybridsIndexPageProps) {
    const {locale} = params;
    const pageUrl = getAbsoluteUrl(locale, ANIMAL_HYBRID_CANONICAL_BASE_PATH);
    const collectionSchema = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: title,
        description,
        url: pageUrl,
        inLanguage: locale
    };
    // Fusions made in the app lead; the curated hybrid creatures follow.
    const fusionCards: AnimalHybridCard[] = publishedAnimalFusions.flatMap((fusion) => {
        const receiver = getFusableSpecies(fusion.receiverSlug);
        const donor = getFusableSpecies(fusion.donorSlug);
        if (!receiver || !donor) return [];
        const boosts = [
            fusion.primaryStat && fusion.boostPrimary > 0 ? `+${fusion.boostPrimary} ${formatFusionStat(fusion.primaryStat)}` : null,
            fusion.secondaryStat && fusion.boostSecondary > 0 ? `+${fusion.boostSecondary} ${formatFusionStat(fusion.secondaryStat)}` : null
        ].filter(Boolean);
        return [{
            kind: "fusion",
            slug: fusion.slug,
            href: `${ANIMAL_HYBRID_CANONICAL_BASE_PATH}/${fusion.slug}`,
            title: `${receiver.name} + ${donor.name}`,
            label: fusion.name,
            summary: `The ${receiver.name} keeps its ${fusion.receiverPrinciple} and learns from the ${donor.name}'s ${fusion.donorPrinciple}.`,
            abilityLabel: boosts.length > 0 ? `Learned power · ${boosts.join(" · ")}` : "Learned power",
            abilityName: fusion.name,
            abilityDescription: fusion.expression,
            parents: [{slug: receiver.slug, name: receiver.name}, {slug: donor.slug, name: donor.name}]
        }];
    });
    const hybridCards: AnimalHybridCard[] = animalHybridEntries.map((entry) => ({
        kind: "hybrid",
        slug: entry.slug,
        href: `${ANIMAL_HYBRID_CANONICAL_BASE_PATH}/${entry.slug}`,
        title: entry.title,
        label: entry.hybridName,
        summary: entry.quickAnswer,
        abilityLabel: "Ultimate ability",
        abilityName: entry.ultimateAbility.name,
        abilityDescription: entry.ultimateAbility.description,
        parents: entry.parents.flatMap((parent) => {
            const species = getSpeciesBySlug(parent.slug);
            return species ? [{slug: species.slug, name: species.name}] : [];
        })
    }));
    const cards = [...fusionCards, ...hybridCards];
    const itemListSchema = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        itemListElement: cards.map((card, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: card.title,
            url: getAbsoluteUrl(locale, card.href)
        }))
    };

    return (
        <article className="w-full max-w-[88rem] mx-auto px-4 md:px-8 py-16 md:py-24 flex flex-col gap-10">
            <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify([collectionSchema, itemListSchema])}} />

            <section className="flex flex-col gap-5 text-center items-center">
                <p className="text-primary-200 font-medium uppercase tracking-[0.2em] text-sm">Explore</p>
                <h1 className="font-display font-bold text-5xl md:text-6xl lg:text-7xl text-white max-w-5xl">{title}</h1>
                <p className="text-lg md:text-xl xl:text-2xl text-ink-200 max-w-4xl">{description}</p>
            </section>

            <section className="  border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">Fictional crosses, biology-first answers</h2>
                <p className="text-ink-200 text-lg md:text-xl leading-8">
                    Every pair of animals here is fictional. Hybrid pages separate real-world viability from the fun design question: what would the cross look like, how would it behave, and what ultimate ability would emerge? Fusions keep both animals real and ask what one would learn from the other.
                </p>
            </section>

            <AnimalFuseTool />

            <section className="flex flex-col gap-2">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">Hybrids and fusions</h2>
                <p className="text-ink-200 text-lg">Hybrids imagine two animals as one creature; fusions are made in the AnimalDex app, where one animal learns a power from another.</p>
            </section>
            <AnimalHybridGrid cards={cards} />
        </article>
    );
}
