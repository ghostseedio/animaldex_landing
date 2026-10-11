import Link from "@/app/[locale]/_components/link";
import type {ScopedTranslator} from "@/loaders/translation";
import {START_COLLECTION_HREF} from "@/data/public-navigation";
import {STAT_LESSONS, type StatLesson, type StatLessonKey, getStatLesson} from "@/lib/stat-lessons";

export type StatLessonText = {
    name: string;
    question: string;
    recorded: string;
    high: string;
    low: string;
};

export const FIVE_STATS_ANCHOR = "five-stats";

/** Every stat's copy from `rankings.statLessons.stats`. */
export function buildStatLessonText(t: ScopedTranslator): Record<StatLessonKey, StatLessonText> {
    return Object.fromEntries(STAT_LESSONS.map((lesson) => [lesson.key, {
        name: t(`statLessons.stats.${lesson.key}.name`),
        question: t(`statLessons.stats.${lesson.key}.question`),
        recorded: t(`statLessons.stats.${lesson.key}.recorded`),
        high: t(`statLessons.stats.${lesson.key}.high`),
        low: t(`statLessons.stats.${lesson.key}.low`)
    }])) as Record<StatLessonKey, StatLessonText>;
}

function ExampleLine({label, lesson, end}: {label: string; lesson: StatLesson; end: "high" | "low"}) {
    const example = lesson[end];
    return (
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{color: end === "high" ? lesson.tint : "rgb(var(--c-ink-400))"}}>
            {label} ·{" "}
            <Link href={`/animals/${example.slug}`} className="text-ink-200 underline-offset-4 hover:text-white hover:underline">
                {example.name}
            </Link>{" "}
            <span className="font-mono tabular-nums text-ink-400">{lesson.shortTitle} {example.value}</span>
        </p>
    );
}

function StatCard({lesson, text, highLabel, lowLabel}: {lesson: StatLesson; text: StatLessonText; highLabel: string; lowLabel: string}) {
    return (
        <article className="flex flex-col gap-4 bg-canvas-950 p-5 md:p-6">
            <div>
                <p className="text-[11px] font-black tracking-[0.16em]" style={{color: lesson.tint}}>{lesson.shortTitle}</p>
                <h3 className="mt-1 font-display text-2xl font-bold text-white">{text.name}</h3>
                <p className="mt-1 text-sm font-semibold text-ink-200">{text.question}</p>
            </div>
            <p className="text-sm leading-6 text-ink-300">{text.recorded}</p>
            <div className="flex flex-col gap-1.5 border-t border-line-300 pt-4">
                <ExampleLine label={highLabel} lesson={lesson} end="high" />
                <p className="text-sm leading-6 text-ink-100">{text.high}</p>
            </div>
            <div className="flex flex-col gap-1.5">
                <ExampleLine label={lowLabel} lesson={lesson} end="low" />
                <p className="text-sm leading-6 text-ink-100">{text.low}</p>
            </div>
        </article>
    );
}

/** The hub's reference section: how the five stats are recorded and how each reads as a lesson. */
export function StatLessonsSection({t}: {t: ScopedTranslator}) {
    const text = buildStatLessonText(t);
    const highLabel = t("statLessons.highLabel");
    const lowLabel = t("statLessons.lowLabel");

    return (
        <section id={FIVE_STATS_ANCHOR} className="w-[calc(100vw-2rem)] max-w-full scroll-mt-24 md:w-auto" aria-labelledby="five-stats-title">
            <h2 id="five-stats-title" className="font-display text-3xl font-bold text-white md:text-4xl">{t("statLessons.sectionTitle")}</h2>
            <p className="mt-3 max-w-4xl text-base leading-7 text-ink-300 md:text-lg">{t("statLessons.sectionDescription")}</p>

            <div className="mt-6 grid gap-6 border border-line-300 p-5 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] md:p-6">
                <h3 className="font-display text-xl font-bold text-white">{t("statLessons.recordedTitle")}</h3>
                <div className="flex max-w-3xl flex-col gap-3 text-base leading-7 text-ink-200">
                    <p>{t("statLessons.recordedOne")}</p>
                    <p>{t("statLessons.recordedTwo")}</p>
                </div>
            </div>

            <h3 className="mt-8 font-display text-xl font-bold text-white">{t("statLessons.readsTitle")}</h3>
            <div className="mt-4 grid gap-px border border-line-300 bg-line-300 md:grid-cols-2 xl:grid-cols-3">
                {STAT_LESSONS.map((lesson) => (
                    <StatCard key={lesson.key} lesson={lesson} text={text[lesson.key]} highLabel={highLabel} lowLabel={lowLabel} />
                ))}
                {/* The sixth cell: where the five stats live, your own collection. */}
                <div className="flex flex-col justify-between gap-5 bg-canvas-950 p-5 md:p-6">
                    <div>
                        <h3 className="font-display text-2xl font-bold text-white">{t("ctaTitle")}</h3>
                        <p className="mt-3 text-sm leading-6 text-ink-300">{t("ctaDescription")}</p>
                    </div>
                    <Link
                        href={START_COLLECTION_HREF}
                        className="inline-flex h-11 w-fit items-center rounded-[2px] bg-primary-400 px-4 text-[0.8125rem] font-black uppercase tracking-[0.04em] text-canvas-950 transition-colors hover:bg-primary-100"
                    >
                        {t("ctaButton")}
                    </Link>
                </div>
            </div>
        </section>
    );
}

/**
 * On a tier list: the stat the list leans on, read as a lesson, with the other
 * four a link away. A list that measures something the five stats don't
 * shows all five briefly instead.
 */
export function RankingStatLessonSection({t, stat, subject}: {t: ScopedTranslator; stat: StatLessonKey | null; subject: string}) {
    const text = buildStatLessonText(t);
    const highLabel = t("statLessons.highLabel");
    const lowLabel = t("statLessons.lowLabel");
    const lesson = stat ? getStatLesson(stat) : null;
    const hubHref = `/tier-list#${FIVE_STATS_ANCHOR}`;

    if (lesson) {
        const others = STAT_LESSONS.filter((item) => item.key !== lesson.key);
        return (
            <section className="border border-line-300 p-5 md:p-6" aria-labelledby="ranking-stat-lesson-title">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-300">{t("statLessons.eyebrow")}</p>
                <h2 id="ranking-stat-lesson-title" className="mt-2 font-display text-3xl font-bold text-white md:text-4xl">
                    {t("statLessons.listTitle", {stat: text[lesson.key].name.toLowerCase()})}
                </h2>
                <p className="mt-3 max-w-4xl text-base leading-7 text-ink-300 md:text-lg">
                    {t("statLessons.listDescription", {stat: text[lesson.key].name.toLowerCase()})}
                </p>
                <div className="mt-6 grid gap-px border border-line-300 bg-line-300 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                    <div className="flex flex-col gap-1.5 bg-canvas-950 p-5">
                        <ExampleLine label={highLabel} lesson={lesson} end="high" />
                        <p className="text-base leading-7 text-ink-100">{text[lesson.key].high}</p>
                    </div>
                    <div className="flex flex-col gap-1.5 bg-canvas-950 p-5">
                        <ExampleLine label={lowLabel} lesson={lesson} end="low" />
                        <p className="text-base leading-7 text-ink-100">{text[lesson.key].low}</p>
                    </div>
                </div>
                <p className="mt-4 max-w-4xl text-sm leading-6 text-ink-400">{text[lesson.key].recorded}</p>

                <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-400">{t("statLessons.listOtherStats")}</p>
                <ul className="mt-3 grid gap-px border border-line-300 bg-line-300 sm:grid-cols-2 lg:grid-cols-4">
                    {others.map((item) => (
                        <li key={item.key} className="bg-canvas-950 p-4">
                            <p className="text-[10px] font-black tracking-[0.14em]" style={{color: item.tint}}>{item.shortTitle} · {text[item.key].name}</p>
                            <p className="mt-1 text-sm leading-6 text-ink-200">{text[item.key].question}</p>
                        </li>
                    ))}
                </ul>
                <Link href={hubHref} className="mt-4 inline-block text-sm font-semibold text-primary-200 underline-offset-4 hover:text-primary-100 hover:underline">
                    {t("statLessons.listSeeAll")}
                </Link>
            </section>
        );
    }

    return (
        <section className="border border-line-300 p-5 md:p-6" aria-labelledby="ranking-stat-lesson-title">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-300">{t("statLessons.eyebrow")}</p>
            <h2 id="ranking-stat-lesson-title" className="mt-2 font-display text-3xl font-bold text-white md:text-4xl">{t("statLessons.listGenericTitle")}</h2>
            <p className="mt-3 max-w-4xl text-base leading-7 text-ink-300 md:text-lg">{t("statLessons.listGenericDescription", {subject})}</p>
            <ul className="mt-6 grid gap-px border border-line-300 bg-line-300 sm:grid-cols-2 lg:grid-cols-5">
                {STAT_LESSONS.map((item) => (
                    <li key={item.key} className="flex flex-col gap-2 bg-canvas-950 p-4">
                        <p className="text-[10px] font-black tracking-[0.14em]" style={{color: item.tint}}>{item.shortTitle} · {text[item.key].name}</p>
                        <p className="text-sm font-semibold text-white">{text[item.key].question}</p>
                        <p className="text-sm leading-6 text-ink-300">
                            <span className="text-ink-100">{highLabel}:</span> {text[item.key].high.split(".")[0]}.{" "}
                            <span className="text-ink-100">{lowLabel}:</span> {text[item.key].low.split(".")[0]}.
                        </p>
                    </li>
                ))}
            </ul>
            <Link href={hubHref} className="mt-4 inline-block text-sm font-semibold text-primary-200 underline-offset-4 hover:text-primary-100 hover:underline">
                {t("statLessons.listSeeAll")}
            </Link>
        </section>
    );
}
