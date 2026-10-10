import ComparisonGenerating from "@/app/[locale]/(composited)/comparisons/[slug]/_components/comparison-generating";
import type {ComparableAnimal} from "@/data/comparison-animals";
import {getScopedTranslator} from "@/loaders/translation";

/** The "generating this matchup" screen with its translated copy; it starts generation and reloads when ready. */
export async function renderComparisonGenerating({locale, basePath, slug, animalA, animalB}: {
    locale: string;
    basePath: string;
    slug: string;
    animalA: ComparableAnimal;
    animalB: ComparableAnimal;
}) {
    const t = await getScopedTranslator(locale, "comparisons");
    const data = {animalA, animalB};
    return (
            <ComparisonGenerating
                basePath={basePath}
                slug={slug}
                animalAName={data.animalA.name}
                animalBName={data.animalB.name}
                animalAArtwork={data.animalA.artworkUrl}
                animalBArtwork={data.animalB.artworkUrl}
                copy={{
                    eyebrow: t("generating.eyebrow"),
                    title: t("generating.title", {animalA: data.animalA.name, animalB: data.animalB.name}),
                    description: t("generating.description"),
                    steps: [
                        t("generating.stepOne"),
                        t("generating.stepTwo"),
                        t("generating.stepThree"),
                        t("generating.stepFour")
                    ],
                    elapsedLabel: t("generating.elapsed", {seconds: "{seconds}"}),
                    errorTitle: t("generating.errorTitle"),
                    errorDescription: t("generating.errorDescription"),
                    rateLimitTitle: t("generating.rateLimitTitle"),
                    rateLimitDescription: t("generating.rateLimitDescription"),
                    retryLabel: t("generating.retry"),
                    browseLabel: t("generating.browse")
                }}
            />
    );
}
