import type {ReactNode} from "react";
import type {EnhancedAnimalPowerProfile} from "@/data/species-animal-power";
import Link from "@/app/[locale]/_components/link";
import type {DreamReading} from "@/lib/animal-dream-reading";
import type {AnimalMeaningSections} from "@/lib/animal-meaning-sections";

type SpeciesAnimalPowerGuideProps = {
    animalName: string;
    artwork?: ReactNode;
    profile: EnhancedAnimalPowerProfile;
    /** "What does it mean to dream about or encounter a wild <animal>?", built from this principle. */
    dream?: DreamReading | null;
    /** Symbolism, spirit animal, life areas and biomimicry — all from data. */
    meaning?: AnimalMeaningSections | null;
    /** /animal-powers/<slug> when published: owns "what can we learn from…". */
    lessonHref?: string | null;
    labels: {
        eyebrow: string;
        pattern: string;
        natureProof: string;
        observation: string;
        function: string;
        interpretation: string;
        continuum: string;
        deficient: string;
        balanced: string;
        excess: string;
        practise: string;
        reflection: string;
        legacyBasis: string;
        legacyPractice: string;
    };
};

export default function SpeciesAnimalPowerGuide({
    animalName,
    artwork,
    profile,
    dream,
    meaning,
    lessonHref,
    labels
}: SpeciesAnimalPowerGuideProps) {
    const enhanced = profile.availability === "enhanced";

    return (
        <section
            id="animal-power"
            className="scroll-mt-28 overflow-hidden  border border-primary-400/20 light:border-line-200 light:bg-none light:bg-surface-900 bg-[radial-gradient(circle_at_80%_0%,rgba(167,244,50,0.14),transparent_32%),linear-gradient(180deg,rgba(16,22,14,0.96),rgba(8,11,8,0.98))] p-5 md:p-8"
        >
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(16rem,0.7fr)] lg:items-start">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-200">{labels.eyebrow}</p>
                    <h2 className="mt-2 font-display text-4xl font-bold tracking-tight text-white md:text-5xl">
                        {profile.principleName}
                    </h2>
                    {profile.principleExpression ? (
                        <p className="mt-3 text-xl font-semibold text-primary-100">{profile.principleExpression}</p>
                    ) : null}
                    {profile.coreLesson ? (
                        <p className="mt-4 max-w-3xl text-lg leading-8 text-ink-200">{profile.coreLesson}</p>
                    ) : null}
                    {profile.shortMotto ? (
                        <p className="mt-4 text-base italic text-ink-300">“{profile.shortMotto}”</p>
                    ) : null}
                </div>
                {artwork ? <div className="justify-self-center lg:justify-self-end">{artwork}</div> : null}
            </div>

            {enhanced ? (
                <div className="mt-10 flex flex-col gap-8">
                    {profile.corePattern ? (
                        <PowerBlock title={labels.pattern}>
                            <p>{profile.corePattern}</p>
                        </PowerBlock>
                    ) : null}

                    {profile.behavioralEvidence.length > 0 ? (
                        <PowerBlock title={labels.natureProof}>
                            <div className="grid gap-4 md:grid-cols-2">
                                {profile.behavioralEvidence.map((item) => (
                                    <article key={item.title} className="  border border-white/[0.08] bg-white/[0.03] p-5">
                                        <h3 className="font-display text-xl font-bold text-white">{item.title}</h3>
                                        <ProofLine label={labels.observation} text={item.observation} />
                                        {item.biologicalFunction ? <ProofLine label={labels.function} text={item.biologicalFunction} /> : null}
                                        {item.interpretation ? <ProofLine label={labels.interpretation} text={item.interpretation} /> : null}
                                    </article>
                                ))}
                            </div>
                        </PowerBlock>
                    ) : null}

                    {profile.powerContinuum ? (
                        <PowerBlock title={labels.continuum}>
                            <div className="grid gap-3 md:grid-cols-3">
                                <ContinuumCard title={labels.deficient} text={profile.powerContinuum.deficientExpression} tone="orange" />
                                <ContinuumCard title={labels.balanced} text={profile.powerContinuum.balancedExpression} tone="green" />
                                <ContinuumCard title={labels.excess} text={profile.powerContinuum.excessExpression} tone="violet" />
                            </div>
                        </PowerBlock>
                    ) : null}

                    {profile.embodimentPractices.length > 0 ? (
                        <PowerBlock title={labels.practise}>
                            <div className="flex flex-col gap-4">
                                {profile.embodimentPractices.map((practice) => (
                                    <article key={practice.title} className="  border border-primary-400/15 bg-primary-400/[0.05] p-5">
                                        <h3 className="font-display text-xl font-bold text-white">{practice.title}</h3>
                                        <p className="mt-2 text-ink-100">{practice.instruction}</p>
                                        {practice.animalConnection ? (
                                            <p className="mt-3 text-sm text-primary-100">{practice.animalConnection}</p>
                                        ) : null}
                                        {practice.timeframe ? (
                                            <p className="mt-2 text-xs uppercase tracking-[0.14em] text-ink-400">{practice.timeframe}</p>
                                        ) : null}
                                    </article>
                                ))}
                            </div>
                        </PowerBlock>
                    ) : null}

                    {profile.reflectionQuestions.length > 0 ? (
                        <PowerBlock title={labels.reflection}>
                            <ul className="flex list-disc flex-col gap-2 pl-5">
                                {profile.reflectionQuestions.map((question) => (
                                    <li key={question}>{question}</li>
                                ))}
                            </ul>
                        </PowerBlock>
                    ) : null}
                </div>
            ) : (
                <div className="mt-10 flex flex-col gap-6">
                    {profile.biologicalBasis ? (
                        <PowerBlock title={labels.legacyBasis}>
                            <p>{profile.biologicalBasis}</p>
                        </PowerBlock>
                    ) : null}
                    {profile.applicationExample ? (
                        <PowerBlock title={labels.legacyPractice}>
                            <p>{profile.applicationExample}</p>
                        </PowerBlock>
                    ) : null}
                </div>
            )}

            {meaning ? (
                <div id="meaning" className="mt-10 grid scroll-mt-28 gap-8 border-t border-primary-400/15 pt-8">
                    <div>
                        <h3 className="font-display text-2xl font-bold text-white md:text-3xl">{meaning.symbolism.question}</h3>
                        <p className="mt-3 max-w-3xl text-lg leading-8 text-ink-200">{meaning.symbolism.answer}</p>
                    </div>
                    <div>
                        <h3 className="font-display text-2xl font-bold text-white md:text-3xl">{meaning.spiritAnimal.question}</h3>
                        <p className="mt-3 max-w-3xl text-lg leading-8 text-ink-200">{meaning.spiritAnimal.answer}</p>
                    </div>
                    <div>
                        <h3 className="font-display text-2xl font-bold text-white md:text-3xl">{meaning.lifeAreas.question}</h3>
                        <p className="mt-3 max-w-3xl text-lg leading-8 text-ink-200">{meaning.lifeAreas.intro}</p>
                        {meaning.lifeAreas.qualities.length > 0 ? (
                            <ul className="mt-4 flex flex-wrap gap-2">
                                {meaning.lifeAreas.qualities.map((quality) => (
                                    <li key={quality} className="border border-primary-400/25 bg-primary-400/[0.08] px-3 py-1.5 text-sm font-semibold text-primary-100">{quality}</li>
                                ))}
                            </ul>
                        ) : null}
                        {meaning.lifeAreas.example ? (
                            <p className="mt-4 max-w-3xl text-base leading-7 text-ink-300"><span className="font-semibold text-white">In practice: </span>{meaning.lifeAreas.example}</p>
                        ) : null}
                        {lessonHref ? (
                            <Link href={lessonHref} className="mt-4 inline-block text-sm font-semibold text-primary-200 hover:text-primary-100" underline>
                                What can we learn from the {animalName}?
                            </Link>
                        ) : null}
                    </div>
                    {meaning.biomimicry ? (
                        <div>
                            <h3 className="font-display text-2xl font-bold text-white md:text-3xl">{meaning.biomimicry.question}</h3>
                            {meaning.biomimicry.role ? <p className="mt-2 text-sm font-semibold uppercase tracking-[0.14em] text-primary-200">{meaning.biomimicry.role}</p> : null}
                            <p className="mt-3 max-w-3xl text-lg leading-8 text-ink-200">{meaning.biomimicry.hardware}</p>
                            {meaning.biomimicry.insight ? <p className="mt-3 max-w-3xl text-lg leading-8 text-ink-200">{meaning.biomimicry.insight}</p> : null}
                        </div>
                    ) : null}
                </div>
            ) : null}

            {dream ? (
                <div id="dream-meaning" className="mt-10 scroll-mt-28 border-t border-primary-400/15 pt-8">
                    <h3 className="font-display text-2xl font-bold text-white md:text-3xl">{dream.question}</h3>
                    <p className="mt-4 max-w-3xl text-lg leading-8 text-ink-200">{dream.answer}</p>
                    <p className="mt-3 max-w-3xl text-base leading-7 text-ink-300">{dream.goodOrBad}</p>
                    <div className="mt-6 grid gap-4 md:grid-cols-2">
                        {dream.scenarios.map((scenario) => (
                            <article key={scenario.title} className="border border-line-300 bg-canvas-900/40 p-5">
                                <h4 className="text-base font-semibold text-white">{scenario.title}</h4>
                                <p className="mt-2 text-base leading-7 text-ink-200">{scenario.reading}</p>
                            </article>
                        ))}
                    </div>
                    <p className="mt-4 text-sm text-ink-400">{dream.note}</p>
                </div>
            ) : null}
        </section>
    );
}

function PowerBlock({title, children}: {title: string; children: ReactNode}) {
    return (
        <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-200">{title}</h3>
            <div className="mt-3 text-lg leading-8 text-ink-200">{children}</div>
        </div>
    );
}

function ProofLine({label, text}: {label: string; text: string}) {
    return (
        <p className="mt-3">
            <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-ink-400">{label}</span>
            <span className="text-base leading-7 text-ink-100">{text}</span>
        </p>
    );
}

function ContinuumCard({title, text, tone}: {title: string; text: string; tone: "orange" | "green" | "violet"}) {
    const toneClass = {
        orange: "border-orange-300/20 bg-orange-400/[0.08] text-orange-100",
        green: "border-primary-300/25 bg-primary-400/[0.08] text-primary-100",
        violet: "border-violet-300/20 bg-violet-400/[0.08] text-violet-100"
    }[tone];

    return (
        <article className={`  border p-5 ${toneClass}`}>
            <h4 className="text-xs font-semibold uppercase tracking-[0.16em]">{title}</h4>
            <p className="mt-3 text-base leading-7 text-ink-100">{text}</p>
        </article>
    );
}
