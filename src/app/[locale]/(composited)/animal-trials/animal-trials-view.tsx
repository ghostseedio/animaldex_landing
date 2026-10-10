import type {Metadata} from "next";
import Image from "next/image";
import Link from "@/app/[locale]/_components/link";
import {animalTrials, countByFrequency, frequencyOf, type AnimalTrialEntry} from "@/data/animal-behaviours";
import {animalTrialsPagination as pagination} from "@/data/hub-pagination";
import {getSpeciesArtworkRoute} from "@/data/species-artwork";
import HubPaginationNav from "@/app/[locale]/(composited)/_components/hub-pagination-nav";
import {getLocalePath, getMetadataLocale} from "@/lib/site";
import {localeConfig} from "@/i18n";
import {withOgCard} from "@/lib/og/og-image";

export const animalTrialsPageCount = pagination.pageCount(animalTrials.length);

const TITLE = "Animal Trials: Biomimicry Challenges Drawn From Animal Behaviour";
const DESCRIPTION =
    "What humans and animals genuinely have in common, and what you can borrow. "
    + `${animalTrials.length} Animal Trials, each one a strategy a real species uses, turned into something you can run yourself.`;

const FAQ: Array<{question: string; answer: string}> = [
    {
        question: "What is biomimicry?",
        answer:
            "Biomimicry is solving a human problem by copying a strategy that evolution already tested. Velcro came from "
            + "burdock hooks, bullet train noses from the kingfisher's bill, and building ventilation from termite mounds. "
            + "The useful part is rarely the animal's shape — it is the rule the animal follows, which is what these Trials isolate."
    },
    {
        question: "What do humans and animals have in common?",
        answer:
            "More than anatomy. Humans face the same underlying problems every animal faces: when to commit energy, when to "
            + "wait, how much risk to accept for a given reward, and when to abandon an attempt. Animals have been solving "
            + "those problems under real consequences for far longer than we have, which is why their strategies transfer even "
            + "when their bodies do not."
    },
    {
        question: "Can you actually copy animal behaviour?",
        answer:
            "You cannot copy the body, but you can copy the rule. An Arctic Tern's migration is not reproducible; committing "
            + "to a direction before verifying it is. Each Trial names the animal's mechanism, then states the rule in a form "
            + "a person can follow in about ten minutes."
    },
    {
        question: "Do I need an account to read a Trial?",
        answer:
            "No. Every Trial here is readable without signing in — you can see what it asks and what the animal does before "
            + "deciding. Starting a Trial and submitting evidence for it needs an AnimalDex account."
    },
    {
        question: "Are these challenges safe?",
        answer:
            "Trials are designed to be done in ordinary, safe conditions and carry a safety note where one applies. Nothing "
            + "asks you to approach, handle, bait or disturb a wild animal. Use your judgement about your own conditions, and "
            + "stop if a Trial stops being sensible where you are."
    }
];

export function buildAnimalTrialsMetadata(locale: string, page: number): Metadata {
    const path = pagination.pagePath(page);
    const title = page === 1 ? TITLE : `Every Animal Trial – Page ${page} of ${animalTrialsPageCount}`;
    const description = page === 1
        ? DESCRIPTION
        : `Animal Trials ${(page - 1) * pagination.perPage + 1}–${Math.min(page * pagination.perPage, animalTrials.length)} of ${animalTrials.length}. ${DESCRIPTION}`;

    return withOgCard({
        title,
        description,
        keywords: [
            "biomimicry",
            "biomimicry examples",
            "similarities between humans and animals",
            "what humans can learn from animals",
            "animal trials",
            "animal inspired challenges",
            "copying animal behaviour",
            "nature inspired problem solving"
        ],
        alternates: {
            canonical: getLocalePath(locale, path),
            languages: localeConfig.locales.reduce((all, item) => {
                all[item] = getLocalePath(item, path);
                return all;
            }, {"x-default": getLocalePath(localeConfig.defaultLocale, path)} as Record<string, string>)
        },
        openGraph: {
            type: "website",
            locale: getMetadataLocale(locale),
            title,
            description,
            url: getLocalePath(locale, path)
        }
    }, "Animal trials on AnimalDex", "page", "animal-trials");
}

/** Page 1 is the full hub; later pages carry only the paged Trial list. */
export default function AnimalTrialsView({locale, page}: {locale: string; page: number}) {
    const params = {locale};
    const isFirstPage = page === 1;
    const pageTrials = pagination.slice(animalTrials, page);
    const rangeStart = (page - 1) * pagination.perPage + 1;
    const rangeEnd = rangeStart + pageTrials.length - 1;
    const totals = countByFrequency(animalTrials);
    const species = new Set(animalTrials.map((trial) => trial.slug)).size;
    const principles = new Set(animalTrials.map((trial) => trial.principleName).filter(Boolean)).size;

    const faqSchema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: FAQ.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: {"@type": "Answer", text: item.answer}
        }))
    };

    const stats = [
        {value: animalTrials.length, label: "Trials"},
        {value: species, label: "Species"},
        {value: principles, label: "Powers"},
        {value: totals.LOW + totals.MID + totals.HIGH, label: "Classified by tempo"}
    ];

    return (
        <>
            {isFirstPage ? (
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{__html: JSON.stringify(faqSchema).replace(/</g, "\\u003c")}}
                />
            ) : null}

            {isFirstPage ? (
            <>
            <section className="border-b border-line-300 px-5 pb-16 pt-12 sm:px-8">
                <div className="mx-auto max-w-5xl">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-300">
                        Animal Trials
                    </p>
                    <h1 className="mt-4 max-w-3xl font-display text-4xl leading-[1.08] text-white sm:text-6xl">
                        Take on the trials real animals face
                    </h1>
                    <p className="mt-6 max-w-3xl text-lg leading-8 text-ink-200">
                        You cannot copy a kingfisher&rsquo;s bill or a tern&rsquo;s migration. You can copy the rule each one
                        follows — commit before you verify, spend nothing on the attempts that do not matter, hold position
                        until the moment is actually there. That is biomimicry: borrowing a strategy evolution already tested,
                        rather than the body that carries it.
                    </p>
                    <p className="mt-4 max-w-3xl text-lg leading-8 text-ink-200">
                        Each Trial below names what a real species does, then states that strategy as something you can run
                        in about ten minutes.
                    </p>

                    <dl className="mt-10 grid grid-cols-2 gap-px border border-line-300 bg-line-300 sm:grid-cols-4">
                        {stats.map((stat) => (
                            <div key={stat.label} className="bg-canvas-950 p-5">
                                <dd className="font-display text-3xl font-bold leading-none text-white">
                                    {stat.value.toLocaleString(params.locale)}
                                </dd>
                                <dt className="mt-2 text-[11px] uppercase tracking-[0.14em] text-ink-400">{stat.label}</dt>
                            </div>
                        ))}
                    </dl>
                </div>
            </section>

            </>
            ) : (
                <section className="border-b border-line-300 px-5 pb-10 pt-12 sm:px-8">
                    <div className="mx-auto max-w-6xl">
                        <Link
                            href={pagination.pagePath(1)}
                            className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-300 underline-offset-4 hover:underline"
                        >
                            Animal Trials
                        </Link>
                        <h1 className="mt-4 font-display text-4xl leading-[1.08] text-white sm:text-5xl">
                            Every Animal Trial — page {page} of {animalTrialsPageCount}
                        </h1>
                        <p className="mt-4 max-w-3xl text-lg leading-8 text-ink-200">
                            Each Trial is a strategy a real species uses, turned into something you can run yourself in about
                            ten minutes. Each card says what to do and why it helps.
                        </p>
                    </div>
                </section>
            )}

            <section id={pagination.anchor} className="scroll-mt-24 border-b border-line-300 px-5 py-16 sm:px-8">
                <div className="mx-auto max-w-6xl">
                    <h2 className="font-display text-3xl text-white">Trials drawn from real behaviour</h2>
                    <p className="mt-3 max-w-3xl leading-7 text-ink-200">
                        What each Trial asks you to do, and what it does for you. Reading a Trial needs no account.{" "}
                        {animalTrials.length.toLocaleString(params.locale)} Trials across{" "}
                        {species.toLocaleString(params.locale)} species. Showing{" "}
                        {rangeStart.toLocaleString(params.locale)}–{rangeEnd.toLocaleString(params.locale)}.
                    </p>
                    <div className="mt-10 grid gap-px border border-line-300 bg-line-300 md:grid-cols-2 xl:grid-cols-3">
                        {pageTrials.map((trial) => (
                            <TrialCard key={`${trial.slug}-${trial.title}`} trial={trial} locale={params.locale} />
                        ))}
                    </div>
                    <HubPaginationNav
                        pagination={pagination}
                        page={page}
                        totalPages={animalTrialsPageCount}
                        locale={params.locale}
                        label="Trial pages"
                    />
                </div>
            </section>

            {isFirstPage ? (
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
                        Next: read{" "}
                        <Link href="/animal-frequencies" className="text-primary-200 underline-offset-4 hover:underline">
                            the animal frequencies
                        </Link>
                        {", the "}
                        <Link href="/animal-powers" className="text-primary-200 underline-offset-4 hover:underline">
                            animal powers
                        </Link>
                        {", or "}
                        <Link href="/animals" className="text-primary-200 underline-offset-4 hover:underline">
                            browse the encyclopedia
                        </Link>.
                    </p>
                </div>
            </section>
            ) : null}
        </>
    );
}

function TrialCard({trial, locale}: {trial: AnimalTrialEntry; locale: string}) {
    const frequency = frequencyOf(trial.frequency);

    return (
        <article className="flex flex-col gap-4 bg-canvas-950 p-6">
            <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-display text-xl leading-tight text-white">{trial.title}</h3>
                <span className="shrink-0 border border-primary-500/30 bg-primary-400/10 px-2 py-0.5 font-mono text-[11px] font-bold tracking-wide text-primary-200">
                    {frequency}
                </span>
            </div>

            <Link
                href={`/animals/${trial.slug}`}
                className="group flex w-fit items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-400 underline-offset-4 transition-colors hover:text-primary-200"
            >
                <span className="relative h-10 w-10 shrink-0 overflow-hidden border border-line-300 bg-white/[0.04]">
                    {/* Sized variant: 60 cards a page, so fetch thumbnails, not full artwork. */}
                    <Image
                        src={getSpeciesArtworkRoute(trial.slug, 96)}
                        alt=""
                        fill
                        unoptimized
                        sizes="40px"
                        className="object-contain p-1 transition duration-300 group-hover:scale-105"
                    />
                </span>
                <span className="group-hover:underline">
                    {trial.species}
                    {trial.principleName ? ` · ${trial.principleName}` : ""}
                </span>
            </Link>

            {/* What the Trial asks, then what it does for you. The animal's
                mechanism and rule stay on the species page. */}
            <div className="border-l-2 border-primary-500/40 pl-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-300">The Trial</p>
                <p className="mt-1.5 text-sm leading-6 text-ink-100">{trial.instructions ?? trial.objective}</p>
            </div>

            {trial.userBenefit ? (
                <div className="border-l-2 border-line-300 pl-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-400">Why it helps</p>
                    <p className="mt-1.5 text-sm leading-6 text-ink-200">{trial.userBenefit}</p>
                </div>
            ) : null}

            <p className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs text-ink-400">
                {trial.estimatedMinutes ? <span>{trial.estimatedMinutes} min</span> : null}
                <span>Difficulty {trial.difficulty}</span>
                {trial.completionCount > 0 ? (
                    <span>{trial.completionCount.toLocaleString(locale)} completed</span>
                ) : null}
            </p>
        </article>
    );
}
