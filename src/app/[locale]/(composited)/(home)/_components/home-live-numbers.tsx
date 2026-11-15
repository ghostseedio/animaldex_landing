"use client";

import {useEffect, useState} from "react";
import {arkMealsWait, fetchArkLanding, type ArkLandingSummary, type ArkMealsWaitWords} from "@/lib/ark-landing";
import {arkAnimalsBefore, arkChange, type ArkChange} from "@/lib/ark-landing-changes";

export type HomeLiveNumbersWords = {
    title: string;
    animals: string;
    species: string;
    founders: string;
    births: string;
    meals: string;
    /** "Extinct species": species lost from the Ark and not back aboard (owner 2026-11-15). */
    extinct: string;
    /** The change line's windows: "24 h" (against 24 hours before), "this week" (new this week). */
    changeDay: string;
    changeWeek: string;
    /** "From the Ark's public record, {time}". */
    asOf: string;
    unavailable: string;
    /** Said in the meals figure's place while no predator is due ("First hunts from {date}", "Next hunt in {duration}"). */
    hunts: ArkMealsWaitWords;
    /** "Most aboard: {list}. …". */
    top: string;
};

/** The live Ark, read once per page load (shared with the day and the chart). */
export function useArkLanding(): ArkLandingSummary | null | undefined {
    const [summary, setSummary] = useState<ArkLandingSummary | null | undefined>(undefined);
    useEffect(() => {
        let live = true;
        void fetchArkLanding().then((read) => {
            if (live) setSummary(read);
        });
        return () => {
            live = false;
        };
    }, []);
    return summary;
}

/** Species extinct on the Ark now (`/api/ark/extinct`), not counting any back aboard; null until the read exists. */
function useArkExtinctCount(): {count: number; week: number} | null | undefined {
    const [count, setCount] = useState<{count: number; week: number} | null | undefined>(undefined);
    useEffect(() => {
        let live = true;
        fetch("/api/ark/extinct")
            .then((response) => (response.ok ? response.json() : null))
            .then((answer: {available?: boolean; extinctions?: Array<{back_aboard?: boolean; at?: string}>} | null) => {
                if (!live) return;
                if (answer?.available !== true || !Array.isArray(answer.extinctions)) return setCount(null);
                const lost = answer.extinctions.filter((one) => one.back_aboard !== true);
                const weekAgo = Date.now() - 7 * 86_400_000;
                setCount({count: lost.length, week: lost.filter((one) => Date.parse(one.at ?? "") >= weekAgo).length});
            })
            .catch(() => {
                if (live) setCount(null);
            });
        return () => {
            live = false;
        };
    }, []);
    return count;
}

/**
 * Who is aboard now, from the Ark's public read and its event log (`/api/ark/landing`): animals, species, founders,
 * and the last 24 hours' births and meals. Real numbers only: until the read answers each figure is a dash in a cell
 * of the same width, so nothing moves when it does, and a read that fails says so. A 0 in meals is shown only when it
 * is a real count: while no predator is due yet the cell says when hunting starts instead, and with no hunting read
 * it is a dash (owner 2026-11-15).
 */
export default function HomeLiveNumbers({locale, words}: {locale: string; words: HomeLiveNumbersWords}) {
    const summary = useArkLanding();
    const extinct = useArkExtinctCount();
    const number = (value: number | null | undefined) => (typeof value === "number" ? value.toLocaleString(locale) : "—");
    const meals = summary?.today?.meals;
    const huntLine = meals === 0 ? arkMealsWait(summary?.hunt, Date.now(), locale, words.hunts) : null;
    const mealsValue = meals === 0 && summary?.hunt?.state !== "counting" ? null : meals;
    // Changes only where the earlier value is known (owner 2026-11-15: green and red arrows): animals against 24 hours
    // ago from the log, births and meals against the 24 hours before, new extinctions this week. Species and founders
    // have no earlier value in the read, so no arrow.
    const today = summary?.today;
    const yesterday = summary?.yesterday;
    const cells: Array<{key: string; label: string; value: number | null | undefined; line?: string | null; change?: ArkChange | null; window?: string}> = [
        {key: "animals", label: words.animals, value: summary?.counts.animals, change: arkChange(summary?.counts.animals, arkAnimalsBefore(summary?.counts.animals, today), "good"), window: words.changeDay},
        {key: "species", label: words.species, value: summary?.counts.species},
        {key: "founders", label: words.founders, value: summary?.counts.founders},
        {key: "births", label: words.births, value: today?.births, change: arkChange(today?.births, yesterday?.births, "good"), window: words.changeDay},
        {key: "meals", label: words.meals, value: mealsValue, line: huntLine, change: huntLine ? null : arkChange(today?.meals, yesterday?.meals, "neutral"), window: words.changeDay},
        // (Only once the read exists: never a 0 that only means "not known yet".)
        ...(extinct === null ? [] : [{key: "extinct", label: words.extinct, value: extinct?.count, change: extinct && extinct.week > 0 ? arkChange(extinct.count, extinct.count - extinct.week, "bad") : null, window: words.changeWeek}])
    ];
    const changeLine = (change: ArkChange | null | undefined, window: string | undefined) => {
        if (!change) return null;
        const colour = change.tone === "good" ? "text-emerald-400" : change.tone === "bad" ? "text-red-400" : "text-ink-300";
        const amount = change.percent !== null && Math.abs(change.percent) >= 0.1
            ? `${Math.abs(change.percent).toLocaleString(locale, {maximumFractionDigits: Math.abs(change.percent) < 10 ? 1 : 0})}%`
            : Math.abs(change.delta).toLocaleString(locale);
        return (
            <dd className={`order-3 flex items-center gap-1 text-xs font-semibold [font-variant-numeric:tabular-nums] ${colour}`}>
                <svg aria-hidden="true" viewBox="0 0 10 10" className={`h-2.5 w-2.5 ${change.direction === "down" ? "rotate-180" : ""}`} fill="currentColor"><path d="M5 1 9.5 8.5h-9z" /></svg>
                <span>{change.direction === "up" ? "+" : "−"}{amount}</span>
                {window ? <span className="font-normal text-ink-300">{window}</span> : null}
            </dd>
        );
    };
    const asOf = summary?.asOf ? new Intl.DateTimeFormat(locale, {day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC"}).format(new Date(summary.asOf)) + " UTC" : null;
    const list = summary?.top.length ? new Intl.ListFormat(locale, {style: "long", type: "conjunction"}).format(summary.top.map((row) => row.name)) : null;

    return (
        <div>
            {/* Hairlines between the cells at every width: the grid's gap shows the rule colour behind them. */}
            <dl className={`grid grid-cols-2 gap-px border-y border-line-200 bg-line-200 sm:grid-cols-3 ${cells.length === 6 ? "lg:grid-cols-6" : "lg:grid-cols-5"}`}>
                {cells.map((cell, index) => (
                    <div key={cell.key} className={`flex flex-col gap-2 bg-canvas-950 px-4 py-6 sm:px-5 md:py-8 ${index === 4 && cells.length === 5 ? "col-span-2 lg:col-span-1" : ""}`}>
                        <dt className="order-2 text-[11px] font-bold uppercase leading-snug tracking-[0.16em] text-ink-300">{cell.label}</dt>
                        {"line" in cell && cell.line ? (
                            // (The same height as a figure, so the row does not move: a short line in the number's place.)
                            <dd className="order-1 flex min-h-12 items-end font-display text-2xl font-bold leading-tight tracking-tight text-white [text-wrap:balance] md:min-h-[3.75rem] md:text-[1.75rem] lg:text-2xl">
                                {cell.line}
                            </dd>
                        ) : (
                            <dd className="order-1 font-display text-5xl font-bold leading-none tracking-tight text-white [font-variant-numeric:tabular-nums] md:text-6xl">
                                {summary === undefined || cell.value === undefined ? <span className="text-white/25">—</span> : number(cell.value)}
                            </dd>
                        )}
                        {changeLine(cell.change, cell.window)}
                    </div>
                ))}
            </dl>
            <div className="mt-4 flex flex-col gap-1.5 text-sm leading-relaxed text-ink-300 md:flex-row md:flex-wrap md:gap-x-6">
                {summary === null ? <p>{words.unavailable}</p> : null}
                {asOf ? <p>{words.asOf.replace("{time}", asOf)}</p> : null}
                {list ? <p>{words.top.replace("{list}", list)}</p> : null}
            </div>
        </div>
    );
}
