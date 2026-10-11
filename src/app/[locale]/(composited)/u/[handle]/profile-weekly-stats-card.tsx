import type {ProfileStatsWeek} from "@/data/profile-authenticated";

const NEON = "#A7F432";

function day(value: string) {
    // The server sends calendar days ("2026-10-05"); read them as local dates.
    const [year, month, date] = value.slice(0, 10).split("-").map(Number);
    return new Date(year, (month ?? 1) - 1, date ?? 1);
}

function rangeLabel(start: string, end: string) {
    const format = (value: string) => day(value).toLocaleDateString(undefined, {month: "short", day: "numeric"});
    return `${format(start)} – ${format(end)}`;
}

function deltaPhrase(delta: number) {
    if (delta === 0) return "Same as last week";
    return `${delta > 0 ? `+${delta}` : delta} vs last week`;
}

function Figure({title, value, delta}: {title: string; value: number; delta: number}) {
    return (
        <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase text-white/40">{title}</p>
            <p className="mt-1 text-[28px] font-extrabold leading-none tabular-nums text-white">{value}</p>
            <p className="mt-1 flex items-center gap-[3px] text-[11px] text-white/40">
                {delta !== 0 ? <span aria-hidden="true" className="text-[8px] text-white/60">{delta > 0 ? "▲" : "▼"}</span> : null}
                {deltaPhrase(delta)}
            </p>
        </div>
    );
}

/** iOS `ProfileWeeklyStatsCard`: "This Week", drawn entirely from `get_profile_stats_overview`. */
export default function ProfileWeeklyStatsCard({week}: {week: ProfileStatsWeek}) {
    const hasActivity = week.captures > 0 || week.previousCaptures > 0;
    const peak = Math.max(1, ...week.daily.map((entry) => entry.captures));
    const best = week.daily.reduce<ProfileStatsWeek["daily"][number] | null>((top, entry) => (!top || entry.captures > top.captures ? entry : top), null);
    const today = new Date().toDateString();

    return (
        <section className="space-y-4 border-b border-white/[0.06] bg-[#12351C]/40 p-4">
            <div className="flex items-baseline justify-between gap-2 text-[11px] text-white/40">
                <span className="tracking-[0.1em]">THIS WEEK</span>
                <span>{rangeLabel(week.currentStart, week.currentEnd)}</span>
            </div>
            {hasActivity ? (
                <>
                    <div className="flex items-start gap-3.5">
                        <Figure title="Captures" value={week.captures} delta={week.captures - week.previousCaptures} />
                        <span className="h-11 w-px bg-white/10" aria-hidden="true" />
                        <Figure title="New species" value={week.newSpecies} delta={week.newSpecies - week.previousNewSpecies} />
                    </div>
                    <div className="relative flex items-end gap-1.5" role="img" aria-label="Captures per day this week">
                        <span className="pointer-events-none absolute inset-x-0 bottom-4 h-px bg-white/[0.12]" aria-hidden="true" />
                        {week.daily.map((entry) => {
                            const date = day(entry.date);
                            const isToday = date.toDateString() === today;
                            const labelled = entry.captures > 0 && best?.date === entry.date;
                            return (
                                <div key={entry.date} className="flex flex-1 flex-col items-center gap-1.5" title={`${date.toLocaleDateString(undefined, {weekday: "long"})}: ${entry.captures} ${entry.captures === 1 ? "capture" : "captures"}`}>
                                    <span className="h-3 text-[11px] text-white/60">{labelled ? entry.captures : ""}</span>
                                    <span className="flex h-[68px] items-end">
                                        {entry.captures > 0 ? (
                                            <span
                                                className="block w-[18px] rounded"
                                                style={{
                                                    height: Math.max(6, (entry.captures / peak) * 68),
                                                    backgroundImage: `linear-gradient(to bottom, ${NEON}${isToday ? "FA" : "CC"}, ${NEON}${isToday ? "B3" : "7A"})`
                                                }}
                                            />
                                        ) : null}
                                    </span>
                                    <span className={`h-4 text-[11px] ${isToday ? "text-white" : "text-white/40"}`}>
                                        {date.toLocaleDateString(undefined, {weekday: "narrow"})}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                    {week.collectorPoints > 0 ? (
                        <p className="text-[11px] text-white/40">+{week.collectorPoints} collector points from this week&rsquo;s captures</p>
                    ) : null}
                </>
            ) : (
                <p className="py-1 text-sm text-white/60">Nothing captured this week yet.</p>
            )}
        </section>
    );
}
