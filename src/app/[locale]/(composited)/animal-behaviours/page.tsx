import type {Metadata} from "next";
import Link from "@/app/[locale]/_components/link";
import {
    behaviourSignatures,
    BEHAVIOUR_FREQUENCIES,
    countByFrequency,
    FREQUENCY_COPY,
    frequencyOf,
    stride,
    type BehaviourSignature
} from "@/data/animal-behaviours";
import {getLocalePath, getMetadataLocale} from "@/lib/site";
import {localeConfig} from "@/i18n";

export const revalidate = 86400;

const PATH = "/animal-behaviours";
const TITLE = "Animal Behaviours: The Science Behind Animal Frequencies and Signatures";
const DESCRIPTION =
    "How animal behaviour actually works — the tempo an animal runs at, the rhythm its body commits to, "
    + "and what \"animal frequency\" means when you measure behaviour instead of guessing at it. "
    + `Behaviour signatures for ${behaviourSignatures.length} species.`;

const FEATURED_COUNT = 24;

const FAQ: Array<{question: string; answer: string}> = [
    {
        question: "What is an animal's frequency?",
        answer:
            "In AnimalDex, an animal's frequency is the tempo its behaviour runs at: how often it commits effort, "
            + "and how long each commitment lasts. Low frequency means rare, sustained commitment. High frequency means "
            + "many cheap, repeated attempts. It is a description of observable behaviour — feeding rate, hunting pattern, "
            + "movement rhythm — not a vibration, an energy field or a spiritual property."
    },
    {
        question: "Is animal frequency the same as spiritual animal frequency?",
        answer:
            "No. Spiritual and new-age writing uses \"frequency\" to mean a vibrational or energetic quality, which is not "
            + "a measurable physical property of an animal. The frequency used here is a behavioural one: it comes from how "
            + "a species actually feeds, hunts, moves and rests. If you arrived looking for the spiritual meaning of an "
            + "animal, that is a separate tradition, and our animal symbolism articles cover it as symbolism rather than as science."
    },
    {
        question: "What is the science behind animal behaviour?",
        answer:
            "Behavioural ecology explains animal behaviour as the result of trade-offs: energy spent against energy gained, "
            + "risk taken against food secured, time invested against opportunity lost. An animal's body sets the limits, and "
            + "its behaviour is the strategy that gets the most out of those limits. That is why behaviour is predictable "
            + "enough to model — a body built for one tempo rarely succeeds at another."
    },
    {
        question: "Why do different animals repeat behaviours at such different rates?",
        answer:
            "Because the cost of one attempt differs enormously between species. A hummingbird's wingbeat costs almost nothing "
            + "per repetition, so a high repetition rate is efficient. A crocodile's ambush costs a great deal in stored energy "
            + "and exposure, so it is used rarely and held for a long time. Repetition rate follows the cost of a single try."
    },
    {
        question: "How are these behaviour signatures produced?",
        answer:
            "Each signature is generated from a species' documented behaviour and anatomy, then reduced to an archetype, a "
            + "frequency profile and a waveform that traces the rhythm. They are summaries of published natural history, "
            + "not measurements taken from an individual animal, and they describe typical behaviour for a species rather than "
            + "predicting what one animal will do."
    }
];

export function generateStaticParams() {
    return [];
}

export function generateMetadata({params}: {params: {locale: string}}): Metadata {
    return {
        title: TITLE,
        description: DESCRIPTION,
        keywords: [
            "animal behaviour",
            "animal behavior science",
            "animal frequencies",
            "animal frequency meaning",
            "science behind animal behaviour",
            "animal behaviour patterns",
            "why animals behave the way they do"
        ],
        alternates: {
            canonical: getLocalePath(params.locale, PATH),
            languages: localeConfig.locales.reduce((all, item) => {
                all[item] = getLocalePath(item, PATH);
                return all;
            }, {"x-default": getLocalePath(localeConfig.defaultLocale, PATH)} as Record<string, string>)
        },
        openGraph: {
            type: "website",
            locale: getMetadataLocale(params.locale),
            title: TITLE,
            description: DESCRIPTION,
            url: getLocalePath(params.locale, PATH),
            images: [{url: "/images/og.png", width: 1200, height: 630, alt: TITLE}]
        }
    };
}

export default function AnimalBehavioursPage({params}: {params: {locale: string}}) {
    const totals = countByFrequency(behaviourSignatures);
    const featured = stride(behaviourSignatures.filter((entry) => entry.waveform?.pathD), FEATURED_COUNT);

    const faqSchema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: FAQ.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: {"@type": "Answer", text: item.answer}
        }))
    };

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{__html: JSON.stringify(faqSchema).replace(/</g, "\\u003c")}}
            />

            <section className="border-b border-line-300 px-5 pb-16 pt-12 sm:px-8">
                <div className="mx-auto max-w-5xl">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-300">
                        Lessons from Animals
                    </p>
                    <h1 className="mt-4 max-w-3xl font-display text-4xl leading-[1.08] text-white sm:text-6xl">
                        The science behind animal behaviour
                    </h1>
                    <p className="mt-6 max-w-3xl text-lg leading-8 text-ink-200">
                        Every animal runs at a tempo. Some commit rarely and hold it for a long time; some make hundreds
                        of cheap attempts an hour. That tempo is set by the animal&rsquo;s body and by what one attempt
                        costs it — which is why behaviour is predictable enough to model, and why an animal built for one
                        rhythm rarely succeeds at another.
                    </p>
                    <p className="mt-4 max-w-3xl text-lg leading-8 text-ink-200">
                        Below is that tempo for {behaviourSignatures.length.toLocaleString(params.locale)} species: an
                        archetype, a frequency, and a waveform tracing the rhythm.
                    </p>
                </div>
            </section>

            <section className="border-b border-line-300 px-5 py-16 sm:px-8">
                <div className="mx-auto max-w-5xl">
                    <h2 className="font-display text-3xl text-white">What frequency means here</h2>
                    <p className="mt-4 max-w-3xl leading-7 text-ink-200">
                        Frequency in AnimalDex is behavioural, not vibrational. It describes how often an animal commits
                        effort and how long each commitment lasts — something you can watch and count. It is not an energy
                        field or a spiritual property; if that is what you came for, our{" "}
                        <Link href="/animal-symbolism" className="text-primary-200 underline-offset-4 hover:underline">
                            animal symbolism articles
                        </Link>{" "}
                        treat that tradition as symbolism rather than as science.
                    </p>

                    <dl className="mt-10 grid gap-px border border-line-300 bg-line-300 sm:grid-cols-3">
                        {BEHAVIOUR_FREQUENCIES.map((frequency) => (
                            <div key={frequency} className="bg-canvas-950 p-6">
                                <dt className="flex items-baseline justify-between gap-3">
                                    <span className="font-display text-xl text-white">
                                        {FREQUENCY_COPY[frequency].title}
                                    </span>
                                    <span className="font-mono text-sm tabular-nums text-primary-300">
                                        {totals[frequency].toLocaleString(params.locale)}
                                    </span>
                                </dt>
                                <dd className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-400">
                                    {FREQUENCY_COPY[frequency].tempo}
                                </dd>
                                <dd className="mt-3 text-sm leading-6 text-ink-200">
                                    {FREQUENCY_COPY[frequency].meaning}
                                </dd>
                            </div>
                        ))}
                    </dl>
                </div>
            </section>

            <section className="border-b border-line-300 px-5 py-16 sm:px-8">
                <div className="mx-auto max-w-6xl">
                    <h2 className="font-display text-3xl text-white">Behaviour signatures</h2>
                    <p className="mt-3 max-w-3xl leading-7 text-ink-200">
                        Each waveform traces one species&rsquo; working rhythm — where it spends effort, and where it waits.
                    </p>

                    <div className="mt-10 grid gap-px border border-line-300 bg-line-300 sm:grid-cols-2 lg:grid-cols-3">
                        {featured.map((entry) => (
                            <SignatureCard key={entry.slug} entry={entry} />
                        ))}
                    </div>
                </div>
            </section>

            <section className="border-b border-line-300 px-5 py-16 sm:px-8">
                <div className="mx-auto max-w-6xl">
                    <h2 className="font-display text-3xl text-white">Every modelled species</h2>
                    <p className="mt-3 max-w-3xl leading-7 text-ink-200">
                        {behaviourSignatures.length.toLocaleString(params.locale)} species with a published behaviour
                        signature.
                    </p>
                    <ul className="mt-8 columns-2 gap-x-8 sm:columns-3 lg:columns-4">
                        {behaviourSignatures.map((entry) => (
                            <li key={entry.slug} className="break-inside-avoid py-1">
                                <Link
                                    href={`/animals/${entry.slug}`}
                                    className="text-sm text-ink-200 underline-offset-4 transition-colors hover:text-primary-200 hover:underline"
                                >
                                    {entry.name}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>
            </section>

            <section className="px-5 py-16 sm:px-8">
                <div className="mx-auto max-w-4xl">
                    <h2 className="font-display text-3xl text-white">Common questions</h2>
                    <div className="mt-8 flex flex-col gap-px border border-line-300 bg-line-300">
                        {FAQ.map((item) => (
                            <div key={item.question} className="bg-canvas-950 p-6">
                                <h3 className="font-display text-lg text-white">{item.question}</h3>
                                <p className="mt-3 leading-7 text-ink-200">{item.answer}</p>
                            </div>
                        ))}
                    </div>

                    <p className="mt-10 leading-7 text-ink-300">
                        Next:{" "}
                        <Link href="/challenge-yourself" className="text-primary-200 underline-offset-4 hover:underline">
                            run an animal&rsquo;s strategy yourself
                        </Link>
                        {", read the "}
                        <Link href="/animal-lessons" className="text-primary-200 underline-offset-4 hover:underline">
                            animal lessons
                        </Link>
                        {", or "}
                        <Link href="/animals" className="text-primary-200 underline-offset-4 hover:underline">
                            browse the encyclopedia
                        </Link>.
                    </p>
                </div>
            </section>
        </>
    );
}

function SignatureCard({entry}: {entry: BehaviourSignature}) {
    const frequency = frequencyOf(entry.frequency);
    const mode = entry.modes[0]?.label;

    return (
        <Link
            href={`/animals/${entry.slug}`}
            className="group flex flex-col gap-4 bg-canvas-950 p-6 transition-colors hover:bg-canvas-900"
        >
            <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-display text-xl leading-tight text-white group-hover:text-primary-200">
                    {entry.name}
                </h3>
                <span className="shrink-0 border border-primary-500/30 bg-primary-400/10 px-2 py-0.5 font-mono text-[11px] font-bold tracking-wide text-primary-200">
                    {frequency}
                </span>
            </div>

            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-400">{entry.archetype}</p>

            {entry.waveform?.pathD ? (
                <svg
                    viewBox={entry.waveform.viewBox}
                    preserveAspectRatio="none"
                    className="h-14 w-full text-primary-400"
                    role="img"
                    aria-label={entry.waveform.description ?? `${entry.name} behaviour rhythm`}
                >
                    <path d={entry.waveform.pathD} fill="none" stroke="currentColor" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
                </svg>
            ) : null}

            {mode ? <p className="line-clamp-2 text-sm text-ink-300">{mode}</p> : null}
            {entry.closingLine ? <p className="line-clamp-3 text-sm leading-6 text-ink-200">{entry.closingLine}</p> : null}
        </Link>
    );
}
