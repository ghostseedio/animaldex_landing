import type {SpeciesAtAGlance} from "@/lib/species-field-guide";

type SpeciesAtAGlanceProps = {
    animalName: string;
    glance: SpeciesAtAGlance;
    labels: {
        title: string;
        knownFor: string;
        power: string;
    };
};

export default function SpeciesAtAGlanceCard({animalName, glance, labels}: SpeciesAtAGlanceProps) {
    if (glance.facts.length === 0 && glance.knownFor.length === 0 && !glance.principleName) {
        return null;
    }

    return (
        <section
            aria-label={labels.title.replace("{animal}", animalName)}
            className="rounded-[1.5rem] border border-white/[0.08] bg-surface-900/55 px-5 py-5 md:px-8 md:py-6"
        >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-100/85">
                {labels.title.replace("{animal}", animalName)}
            </p>
            {glance.facts.length > 0 ? (
                <p className="mt-3 text-base leading-7 text-ink-100 md:text-lg">
                    {glance.facts.join(" · ")}
                </p>
            ) : null}
            {glance.knownFor.length > 0 ? (
                <p className="mt-3 text-sm leading-6 text-ink-300">
                    <span className="font-semibold text-white">{labels.knownFor}: </span>
                    {glance.knownFor.join(", ")}
                </p>
            ) : null}
            {glance.principleName ? (
                <p className="mt-3 text-sm leading-6 text-primary-100">
                    <span className="font-semibold text-white">{labels.power}: </span>
                    {glance.principleName}
                </p>
            ) : null}
        </section>
    );
}
