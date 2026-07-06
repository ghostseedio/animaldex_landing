import {
    formatLessonValueAmount,
    formatLessonValueRange,
    type SpeciesLessonValueResolution
} from "@/data/species-lesson-value";

type SpeciesLessonValueLabels = {
    title: string;
    estimatedLabel: string;
    rangeLabel: string;
    rangeOnlyLabel: string;
    confidenceLabel: string;
    footer: string;
    disclaimer: string;
    stewardshipBasis: string;
    generatedBasis: string;
};

type SpeciesLessonValueSectionProps = {
    result: SpeciesLessonValueResolution;
    locale: string;
    labels: SpeciesLessonValueLabels;
};

function isStewardshipEstimate(pricingIdentityType: SpeciesLessonValueResolution["pricingIdentityType"]) {
    switch (pricingIdentityType) {
        case "domesticParent":
        case "wild":
        case "zoo":
        case "exotic":
        case "generic":
            return true;
        default:
            return false;
    }
}

export default function SpeciesLessonValueSection({result, locale, labels}: SpeciesLessonValueSectionProps) {
    const rangeText = formatLessonValueRange(result.lowPrice, result.highPrice, result.currency, locale);
    const typicalText = result.displayMode === "typical_and_range"
        ? formatLessonValueAmount(result.typicalPrice, result.currency, locale)
        : null;
    const stewardship = isStewardshipEstimate(result.pricingIdentityType);
    const confidencePercent = Math.round(result.estimateConfidence * 100);
    const basisText = result.source === "generated_from_species_stats"
        ? labels.generatedBasis
        : stewardship
            ? labels.stewardshipBasis
            : result.basisLabel;

    return (
        <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10">
            <div className="flex items-center gap-2 text-ink-300 text-sm uppercase tracking-[0.18em]">
                <span aria-hidden className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300">
                    $
                </span>
                <span>{labels.title}</span>
            </div>

            <div className="mt-5 flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400/20 to-teal-400/15 text-emerald-300">
                    <span aria-hidden className="text-lg font-bold">#</span>
                </div>

                <div className="flex min-w-0 flex-col gap-2">
                    {typicalText ? (
                        <>
                            <p className="font-display text-2xl md:text-3xl font-bold text-white">
                                {labels.estimatedLabel.replace("{amount}", typicalText)}
                            </p>
                            <p className="text-ink-200 text-base md:text-lg">
                                {labels.rangeLabel.replace("{range}", rangeText)}
                            </p>
                        </>
                    ) : (
                        <>
                            <p className="font-display text-2xl md:text-3xl font-bold text-white">{rangeText}</p>
                            <p className="text-ink-200 text-base md:text-lg">{labels.rangeOnlyLabel}</p>
                        </>
                    )}

                    <p className="text-sm text-ink-300">
                        {labels.confidenceLabel.replace("{percent}", String(confidencePercent))}
                    </p>
                    <p className="text-sm text-ink-300">{basisText}</p>
                    <p className="text-sm text-ink-400">{result.disclaimer || labels.disclaimer}</p>
                    <p className="text-sm text-ink-400">{labels.footer}</p>
                </div>
            </div>
        </section>
    );
}
