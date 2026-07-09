import type {UserCaptureSummary} from "@/data/user-captures";
import {resolveCaptureVariantDisplay} from "@/lib/species-life-stage-policy";

type SpeciesLifeStagesSectionProps = {
    speciesName: string;
    captures: UserCaptureSummary[];
    labels: {
        title: string;
        description: string;
        captureTitle: string;
    };
};

function distinctLifeStages(captures: UserCaptureSummary[], speciesName: string) {
    const stages = new Set<string>();

    for (const capture of captures) {
        const variant = resolveCaptureVariantDisplay({
            animalName: capture.animalName,
            lifeStage: capture.lifeStage,
            normalizedIdentityKey: capture.speciesSlug,
            canonicalSpecies: {name: speciesName, slug: ""}
        });

        if (variant.lifeStageChip) {
            stages.add(variant.lifeStageChip);
        }
    }

    return Array.from(stages).sort((left, right) => left.localeCompare(right));
}

function stageVariantCaptures(captures: UserCaptureSummary[], speciesName: string) {
    return captures.filter((capture) => resolveCaptureVariantDisplay({
        animalName: capture.animalName,
        lifeStage: capture.lifeStage,
        normalizedIdentityKey: capture.speciesSlug,
        canonicalSpecies: {name: speciesName, slug: ""}
    }).isStageVariant);
}

export default function SpeciesLifeStagesSection({
    speciesName,
    captures,
    labels
}: SpeciesLifeStagesSectionProps) {
    const lifeStages = distinctLifeStages(captures, speciesName);
    const variantCaptures = stageVariantCaptures(captures, speciesName);

    if (lifeStages.length === 0) {
        return null;
    }

    return (
        <section className="rounded-[1.75rem] border border-white/10 bg-surface-900/55 px-5 py-8 md:px-8">
            <h2 className="font-display text-3xl font-bold text-white md:text-4xl">{labels.title}</h2>
            <p className="mt-3 max-w-3xl text-lg leading-8 text-ink-200">{labels.description}</p>

            <div className="mt-5 flex flex-wrap gap-2">
                {lifeStages.map((stage) => (
                    <span
                        key={stage}
                        className="rounded-full border border-primary-400/25 bg-primary-400/10 px-3 py-1.5 text-sm font-semibold text-primary-100"
                    >
                        {stage}
                    </span>
                ))}
            </div>

            <div className="mt-8 flex flex-col gap-3">
                {variantCaptures.slice(0, 8).map((capture) => {
                    const variant = resolveCaptureVariantDisplay({
                        animalName: capture.animalName,
                        lifeStage: capture.lifeStage,
                        normalizedIdentityKey: capture.speciesSlug,
                        canonicalSpecies: {name: speciesName, slug: ""}
                    });

                    return (
                        <article
                            key={capture.captureId}
                            className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3"
                        >
                            <div className="flex flex-wrap items-center gap-2">
                                <h3 className="font-display text-lg font-bold text-white">{variant.title}</h3>
                                {variant.lifeStageChip ? (
                                    <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs font-bold text-white/60">
                                        {variant.lifeStageChip}
                                    </span>
                                ) : null}
                            </div>
                            {variant.countsAsLine ? (
                                <p className="mt-1 text-sm text-ink-300">{variant.countsAsLine}</p>
                            ) : null}
                        </article>
                    );
                })}
            </div>
        </section>
    );
}
