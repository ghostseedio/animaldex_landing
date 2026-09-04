import type {ReactNode} from "react";
import type {EnhancedAnimalPowerProfile} from "@/data/species-animal-power";

type SpeciesAnimalPowerGuideProps = {
    animalName: string;
    artwork?: ReactNode;
    profile: EnhancedAnimalPowerProfile;
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
    labels
}: SpeciesAnimalPowerGuideProps) {
    const enhanced = profile.availability === "enhanced";

    return (
        <section
            id="animal-power"
            className="scroll-mt-28 overflow-hidden rounded-[1.75rem] border border-primary-400/20 bg-[radial-gradient(circle_at_80%_0%,rgba(167,244,50,0.14),transparent_32%),linear-gradient(180deg,rgba(16,22,14,0.96),rgba(8,11,8,0.98))] p-5 md:p-8"
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
                                    <article key={item.title} className="rounded-3xl border border-white/[0.08] bg-white/[0.03] p-5">
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
                                    <article key={practice.title} className="rounded-3xl border border-primary-400/15 bg-primary-400/[0.05] p-5">
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
                    <p className="text-sm text-ink-400">
                        {animalName} still has a catalog Animal Power. The enhanced guide fills in as species profiles are prepared.
                    </p>
                </div>
            )}
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
        <article className={`rounded-3xl border p-5 ${toneClass}`}>
            <h4 className="text-xs font-semibold uppercase tracking-[0.16em]">{title}</h4>
            <p className="mt-3 text-base leading-7 text-ink-100">{text}</p>
        </article>
    );
}
