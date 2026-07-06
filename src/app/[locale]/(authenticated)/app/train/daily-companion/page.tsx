import {AppMetric, AppPageHeader} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import JournalClient from "@/app/[locale]/(authenticated)/app/journal/journal-client";
import TrainBackLink from "@/app/[locale]/(authenticated)/app/train/train-back-link";
import {getAppCaptures, getAppJournalEntries} from "@/data/authenticated-app";
import {getTrainDailyCompanionState} from "@/data/train-modules";
import {appStoreUrl} from "@/lib/store-links";

export default async function DailyCompanionPage() {
    const [captures, journals, companion] = await Promise.all([
        getAppCaptures(),
        getAppJournalEntries(8),
        getTrainDailyCompanionState()
    ]);

    return (
        <div className="space-y-8">
            <div>
                <TrainBackLink />
                <div className="mt-5">
                    <AppPageHeader
                        eyebrow="Daily"
                        title="Daily Companion"
                        description="Companion tasks, proofs, and stat growth. Use the Nature Alignment journal on web, or complete the full daily challenge flow in the app."
                    />
                </div>
            </div>

            <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
                <AppMetric
                    label="Today"
                    value={companion.completedToday ? "Complete" : "Open"}
                    accent={companion.completedToday ? "green" : "gold"}
                />
                <AppMetric label="Journal entries" value={companion.journalCount} accent="blue" />
                <AppMetric label="Animal powers" value={Math.min(captures.length, 8)} detail="Available to slot" />
            </section>

            {companion.completedToday ? (
                <section className="rounded-[1.5rem] border border-primary-300/20 bg-primary-400/[0.08] p-5">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-primary-200">Daily companion</p>
                    <h2 className="mt-2 font-display text-2xl font-bold text-white">You completed today&apos;s ritual</h2>
                    <p className="mt-2 text-sm text-white/55">Open AnimalDex for roulette selection, apex growth challenges, and proof sharing.</p>
                    <a href={appStoreUrl} className="mt-4 inline-flex rounded-2xl bg-primary-400 px-4 py-2.5 text-sm font-black text-black">
                        Open AnimalDex
                    </a>
                </section>
            ) : null}

            <JournalClient captures={captures} />

            {journals.length > 0 ? (
                <section className="space-y-4">
                    <h2 className="font-display text-2xl font-bold text-white">Recent journal entries</h2>
                    <div className="grid gap-3">
                        {journals.map((entry) => (
                            <article key={entry.id} className="rounded-[1.2rem] border border-white/10 bg-[#151515] p-4">
                                <div className="flex items-center justify-between gap-3">
                                    <p className="text-xs font-black uppercase tracking-[0.14em] text-white/35">{entry.date}</p>
                                    {entry.tier ? <span className="rounded-full bg-violet-500/15 px-2.5 py-1 text-xs font-bold text-violet-200">{entry.tier}</span> : null}
                                </div>
                                <p className="mt-3 text-sm font-semibold text-white">{entry.problem}</p>
                                {entry.insight ? <p className="mt-2 line-clamp-3 text-sm leading-6 text-white/50">{entry.insight}</p> : null}
                            </article>
                        ))}
                    </div>
                </section>
            ) : null}
        </div>
    );
}
