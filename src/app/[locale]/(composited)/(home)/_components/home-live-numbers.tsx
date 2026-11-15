"use client";

import {useEffect, useState} from "react";
import {arkMealsWait, fetchArkLanding, type ArkLandingSummary, type ArkMealsWaitWords} from "@/lib/ark-landing";

export type HomeLiveNumbersWords = {
    title: string;
    animals: string;
    species: string;
    founders: string;
    births: string;
    meals: string;
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

/**
 * Who is aboard now, from the Ark's public read and its event log (`/api/ark/landing`): animals, species, founders,
 * and the last 24 hours' births and meals. Real numbers only: until the read answers each figure is a dash in a cell
 * of the same width, so nothing moves when it does, and a read that fails says so. A 0 in meals is shown only when it
 * is a real count: while no predator is due yet the cell says when hunting starts instead, and with no hunting read
 * it is a dash (owner 2026-11-15).
 */
export default function HomeLiveNumbers({locale, words}: {locale: string; words: HomeLiveNumbersWords}) {
    const summary = useArkLanding();
    const number = (value: number | null | undefined) => (typeof value === "number" ? value.toLocaleString(locale) : "—");
    const meals = summary?.today?.meals;
    const huntLine = meals === 0 ? arkMealsWait(summary?.hunt, Date.now(), locale, words.hunts) : null;
    const mealsValue = meals === 0 && summary?.hunt?.state !== "counting" ? null : meals;
    const cells = [
        {key: "animals", label: words.animals, value: summary?.counts.animals},
        {key: "species", label: words.species, value: summary?.counts.species},
        {key: "founders", label: words.founders, value: summary?.counts.founders},
        {key: "births", label: words.births, value: summary?.today?.births},
        {key: "meals", label: words.meals, value: mealsValue, line: huntLine}
    ];
    const asOf = summary?.asOf ? new Intl.DateTimeFormat(locale, {day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC"}).format(new Date(summary.asOf)) + " UTC" : null;
    const list = summary?.top.length ? new Intl.ListFormat(locale, {style: "long", type: "conjunction"}).format(summary.top.map((row) => row.name)) : null;

    return (
        <div>
            {/* Hairlines between the cells at every width: the grid's gap shows the rule colour behind them. */}
            <dl className="grid grid-cols-2 gap-px border-y border-line-200 bg-line-200 sm:grid-cols-3 lg:grid-cols-5">
                {cells.map((cell, index) => (
                    <div key={cell.key} className={`flex flex-col gap-2 bg-canvas-950 px-4 py-6 sm:px-5 md:py-8 ${index === 4 ? "col-span-2 lg:col-span-1" : ""}`}>
                        <dt className="order-2 text-[11px] font-bold uppercase leading-snug tracking-[0.16em] text-ink-300">{cell.label}</dt>
                        {"line" in cell && cell.line ? (
                            // (The same height as a figure, so the row does not move: a short line in the number's place.)
                            <dd className="order-1 flex min-h-12 items-end font-display text-2xl font-bold leading-tight tracking-tight text-white [text-wrap:balance] md:min-h-[3.75rem] md:text-[1.75rem] lg:text-2xl">
                                {cell.line}
                            </dd>
                        ) : (
                            <dd className="order-1 font-display text-5xl font-bold leading-none tracking-tight text-white [font-variant-numeric:tabular-nums] md:text-6xl">
                                {summary === undefined ? <span className="text-white/25">—</span> : number(cell.value)}
                            </dd>
                        )}
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
