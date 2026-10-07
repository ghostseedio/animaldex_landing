import Link from "@/app/[locale]/_components/link";
import type {RankingLifeLessons} from "@/data/ranking-life-lessons";

type RankingWhySectionProps = {
    lessons: RankingLifeLessons;
};

/** "Why do animals need to be strong?" — the biology behind the ranked trait. */
export function RankingWhySection({lessons}: RankingWhySectionProps) {
    if (lessons.why.length === 0) {
        return null;
    }

    return (
        <section className="rounded-lg border border-line-300 bg-surface-900/75 p-5 md:p-6">
            <h2 className="font-display text-3xl font-bold text-white md:text-4xl">{lessons.whyTitle}</h2>
            <div className="mt-4 flex max-w-4xl flex-col gap-4">
                {lessons.why.map((paragraph) => (
                    <p key={paragraph} className="text-base leading-7 text-ink-200 md:text-lg">
                        {paragraph}
                    </p>
                ))}
            </div>
        </section>
    );
}

type RankingApplyCard = {
    title: string;
    body: string;
    species?: {slug: string; name: string};
};

type RankingApplySectionProps = {
    title: string;
    intro: string;
    cards: RankingApplyCard[];
    meetAnimalLabel: (animalName: string) => string;
};

/** "How to copy the strongest animals' strengths in your life" — practical cards. */
export function RankingApplySection({title, intro, cards, meetAnimalLabel}: RankingApplySectionProps) {
    if (cards.length === 0) {
        return null;
    }

    return (
        <section className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
                <h2 className="font-display text-3xl font-bold text-white md:text-4xl">{title}</h2>
                <p className="max-w-4xl text-base leading-7 text-ink-300 md:text-lg">{intro}</p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {cards.map((card) => (
                    <article key={card.title} className="flex flex-col gap-3 rounded-lg border border-line-300 bg-surface-900/75 p-5">
                        <h3 className="font-display text-2xl font-bold leading-tight text-white">{card.title}</h3>
                        <p className="text-base leading-7 text-ink-200">{card.body}</p>
                        {card.species ? (
                            <Link
                                href={`/animals/${card.species.slug}`}
                                className="mt-auto w-fit text-sm font-semibold text-primary-200 transition-colors hover:text-primary-100"
                                underline
                            >
                                {meetAnimalLabel(card.species.name)}
                            </Link>
                        ) : null}
                    </article>
                ))}
            </div>
        </section>
    );
}

export type RankingTopTeachItem = {
    rank: number;
    speciesSlug: string;
    speciesName: string;
    principle: string;
    coreLesson: string;
    bestFor: string[];
    lessonHref?: string;
    lessonLabel?: string;
};

type RankingTopTeachSectionProps = {
    title: string;
    description: string;
    principleLabel: string;
    bestForLabel: string;
    items: RankingTopTeachItem[];
};

/** Data-driven: each top-10 animal's AnimalDex principle and core lesson. */
export function RankingTopTeachSection({title, description, principleLabel, bestForLabel, items}: RankingTopTeachSectionProps) {
    if (items.length === 0) {
        return null;
    }

    return (
        <section className="rounded-lg border border-line-300 bg-surface-900/75 p-5 md:p-6">
            <h2 className="font-display text-3xl font-bold text-white md:text-4xl">{title}</h2>
            <p className="mt-3 max-w-4xl text-base leading-7 text-ink-300 md:text-lg">{description}</p>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
                {items.map((item) => (
                    <article key={item.speciesSlug} className="flex flex-col gap-2 rounded-md border border-line-400 bg-canvas-900/40 p-4">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-md border border-primary-500/30 bg-primary-500/10 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-[0.16em] text-primary-200">
                                #{item.rank}
                            </span>
                            <h3 className="font-display text-xl font-bold leading-tight text-white">
                                <Link href={`/animals/${item.speciesSlug}`} className="transition-colors hover:text-primary-100">
                                    {item.speciesName}
                                </Link>
                            </h3>
                        </div>
                        <p className="text-sm leading-6 text-ink-300">
                            <span className="font-semibold uppercase tracking-[0.14em] text-primary-200">{principleLabel}:</span>{" "}
                            <span className="text-ink-100">{item.principle}</span>
                        </p>
                        <p className="text-base leading-7 text-ink-200">{item.coreLesson}</p>
                        {item.bestFor.length > 0 ? (
                            <p className="text-sm leading-6 text-ink-300">
                                <span className="font-semibold text-ink-200">{bestForLabel}:</span> {item.bestFor.join(", ")}
                            </p>
                        ) : null}
                        {item.lessonHref && item.lessonLabel ? (
                            <Link
                                href={item.lessonHref}
                                className="mt-auto w-fit text-sm font-semibold text-primary-200 transition-colors hover:text-primary-100"
                                underline
                            >
                                {item.lessonLabel}
                            </Link>
                        ) : null}
                    </article>
                ))}
            </div>
        </section>
    );
}
