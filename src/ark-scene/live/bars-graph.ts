/**
 * Population over time in the apps' embed bars (`bars-view.ts`): the DOM counterpart of /ark's
 * `ark-population-graph.tsx` (owner, 2026-11-17: "a population line graph per species, just a line might do it and a
 * time period"). The iOS and Android Ark panels show this embed, so this is the apps' graph too.
 *
 * A sparkline at each row's end (a button: it opens that species' graph), the order and period switches over the
 * list, and the graph pane in the list's place. Numbers only from `lib/ark-population-history.ts` (the server's
 * record). Its words are `ark.graph` in the reader's language (`lib/ark-graph-words.ts`), handed in by the bars.
 */

import type {ArkGraphWords} from "@/lib/ark-graph-words";
import {arkKindHereText, arkKindWholeText, type ArkKindWhere} from "@/lib/ark-kind-where";
import {fillArkWords} from "@/lib/ark-words";
import {
    ARK_PERIODS,
    arkDayAt,
    arkGraphDate,
    arkGraphWhen,
    arkLinePath,
    arkStatsChangeText,
    arkStepChanges,
    type ArkHistory,
    type ArkPeriod,
    type ArkSeries,
    type ArkSeriesStats
} from "@/lib/ark-population-history";

export type ArkSortMode = "biggest" | "thriving" | "declining";

const FONT = "var(--font-sans, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif)";
const UP = "#86e08f";
const DOWN = "#ff8a7a";
const LIME = "#c8fa63";
const SVG = "http://www.w3.org/2000/svg";

export function arkLineTone(stats: Pick<ArkSeriesStats, "delta">): string {
    return stats.delta > 0 ? UP : stats.delta < 0 ? DOWN : "rgba(255,252,244,0.55)";
}

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
    const el = document.createElementNS(SVG, tag);
    for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, String(value));
    return el;
}

/** The sparkline drawn into `button` (replacing what was there). */
export function drawSpark(button: HTMLButtonElement, series: ArkSeries, stats: ArkSeriesStats, name: string, words: ArkGraphWords) {
    const width = 38;
    const height = 16;
    const line = arkLinePath(series.counts, width, height);
    const root = svg("svg", {viewBox: `0 0 ${width} ${height}`, width, height, "aria-hidden": "true", focusable: "false"});
    root.style.display = "block";
    root.style.overflow = "visible";
    root.appendChild(svg("path", {d: line.d, fill: "none", stroke: arkLineTone(stats), "stroke-width": 1.4, "stroke-linejoin": "round", "stroke-linecap": "round"}));
    button.replaceChildren(root);
    const label = fillArkWords(words.openGraph, {animal: name});
    button.setAttribute("aria-label", label);
    button.title = label;
}

export function makeSparkButton(onOpen: () => void): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    Object.assign(button.style, {flex: "0 0 auto", display: "flex", alignItems: "center", minHeight: "44px", padding: "0 10px 0 2px", border: "0", background: "transparent", color: "inherit", cursor: "pointer"});
    button.addEventListener("click", onOpen);
    return button;
}

/** "▲ +25%" / "▼ −2" / "0" for a period, into `el`. */
export function drawPeriodChange(el: HTMLElement, stats: ArkSeriesStats, locale: string) {
    const said = arkStatsChangeText(stats, locale);
    el.textContent = `${said.up === null ? "" : said.up ? "▲ " : "▼ "}${said.percent && said.up !== null ? said.percent : said.count}`;
    el.style.display = "inline";
    el.style.color = arkLineTone(stats);
    el.title = "";
}

function pills<T extends string>(label: string, items: Array<{id: T; text: string; aria?: string; mark?: string}>, current: T, onPick: (id: T) => void): HTMLDivElement {
    const group = document.createElement("div");
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", label);
    Object.assign(group.style, {display: "flex", borderRadius: "999px", background: "rgba(255, 255, 255, 0.07)", padding: "2px"});
    for (const item of items) {
        const button = document.createElement("button");
        button.type = "button";
        const on = item.id === current;
        button.setAttribute("aria-pressed", on ? "true" : "false");
        if (item.aria) button.setAttribute("aria-label", item.aria);
        Object.assign(button.style, {minHeight: "32px", padding: "0 9px", border: "0", borderRadius: "999px", background: on ? "rgba(255, 255, 255, 0.16)" : "transparent", color: on ? "#fff" : "rgba(255, 252, 244, 0.6)", font: `700 11.5px/1 ${FONT}`, fontVariantNumeric: "tabular-nums", cursor: "pointer", whiteSpace: "nowrap"});
        if (item.mark) {
            const mark = document.createElement("span");
            mark.setAttribute("aria-hidden", "true");
            Object.assign(mark.style, {fontSize: "8px", marginInlineEnd: "4px", color: item.mark === "up" ? UP : DOWN});
            mark.textContent = item.mark === "up" ? "▲" : "▼";
            button.appendChild(mark);
        }
        button.append(item.text);
        button.addEventListener("click", () => onPick(item.id));
        group.appendChild(button);
    }
    return group;
}

export function periodPills(period: ArkPeriod, onPeriod: (period: ArkPeriod) => void, words: ArkGraphWords): HTMLDivElement {
    return pills(words.periodLabel, ARK_PERIODS.map((id) => ({id, text: words.periodsShort[id], aria: words.periods[id]})), period, onPeriod);
}

/** The order and period switches, into `host`. */
export function drawControls(host: HTMLElement, mode: ArkSortMode, onMode: (mode: ArkSortMode) => void, period: ArkPeriod, onPeriod: (period: ArkPeriod) => void, words: ArkGraphWords) {
    host.replaceChildren(
        pills<ArkSortMode>(words.sortLabel, [{id: "biggest", text: words.biggest}, {id: "thriving", text: words.thriving, mark: "up"}, {id: "declining", text: words.declining, mark: "down"}], mode, onMode),
        periodPills(period, onPeriod, words)
    );
}

/**
 * Where a kind's animals are, into `host`: the count across the whole Ark with its places, and, when an animal is tapped,
 * where it stands among its own ("This one: alone in its zoo enclosure"). `rule` adds the breeding rule (the pane always,
 * the panel's strip only for an animal alone in its place). Nothing in `host` when the kind has none aboard.
 */
export function drawWhere(host: HTMLElement, where: ArkKindWhere | null, words: ArkGraphWords, locale: string, options: {name?: boolean; rule: "always" | "alone"}) {
    host.replaceChildren();
    host.style.display = where ? "block" : "none";
    if (!where) return;
    const line = (text: string, style: Partial<CSSStyleDeclaration>) => {
        const p = document.createElement("p");
        Object.assign(p.style, {margin: "0", font: `500 11.5px/1.35 ${FONT}`}, style);
        p.textContent = text;
        host.appendChild(p);
    };
    if (options.name) line(where.name, {fontWeight: "700", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"});
    line(arkKindWholeText(where, words, locale), {opacity: "0.75"});
    const here = arkKindHereText(where, words, locale);
    if (here) line(here, {fontWeight: "600", color: LIME});
    if (options.rule === "always" || (where.here && where.here.count <= 1)) line(words.breedsSamePlace, {opacity: "0.45"});
}

/** One species' graph pane: back, name and count, period switch, the line, its numbers, and the fly-to button. */
export function buildGraphPane(options: {
    history: ArkHistory;
    name: string;
    iconSrc: string;
    series: ArkSeries;
    stats: ArkSeriesStats;
    period: ArkPeriod;
    locale: string;
    onPeriod: (period: ArkPeriod) => void;
    onBack: () => void;
    onFly: (() => void) | null;
    words: ArkGraphWords;
    /** Where the kind's animals are, and where the tapped one is among them. */
    where: ArkKindWhere | null;
}): HTMLDivElement {
    const {history, name, series, stats, period, locale, words} = options;
    const number = (value: number) => value.toLocaleString(locale);
    const pane = document.createElement("div");
    Object.assign(pane.style, {flex: "1 1 auto", minHeight: "0", overflowY: "auto", overscrollBehavior: "contain", borderTop: "1px solid rgba(255, 255, 255, 0.08)", padding: "4px 0 10px"});

    const back = document.createElement("button");
    back.type = "button";
    Object.assign(back.style, {display: "flex", alignItems: "center", gap: "4px", minHeight: "44px", padding: "0 10px", border: "0", background: "transparent", color: "rgba(255, 252, 244, 0.7)", font: `600 12px/1 ${FONT}`, cursor: "pointer"});
    back.textContent = `‹ ${words.back}`;
    back.addEventListener("click", options.onBack);

    const head = document.createElement("div");
    Object.assign(head.style, {display: "flex", alignItems: "center", gap: "10px", padding: "0 14px"});
    const badge = document.createElement("span");
    Object.assign(badge.style, {flex: "0 0 auto", width: "28px", height: "28px", borderRadius: "999px", background: "#f6f1e7", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden"});
    const icon = document.createElement("img");
    icon.alt = "";
    icon.src = options.iconSrc;
    Object.assign(icon.style, {width: "84%", height: "84%", objectFit: "contain"});
    badge.appendChild(icon);
    const title = document.createElement("h3");
    Object.assign(title.style, {flex: "1", minWidth: "0", margin: "0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", font: `700 14px/1.2 ${FONT}`});
    title.textContent = name;
    const now = document.createElement("span");
    Object.assign(now.style, {font: `700 15px/1 ${FONT}`, fontVariantNumeric: "tabular-nums"});
    now.textContent = number(stats.now);
    head.append(badge, title, now);

    const whereBox = document.createElement("div");
    Object.assign(whereBox.style, {padding: "6px 14px 0"});
    drawWhere(whereBox, options.where, words, locale, {rule: "always"});

    const bar = document.createElement("div");
    Object.assign(bar.style, {display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "8px", padding: "8px 14px 4px"});
    const change = document.createElement("span");
    const said = arkStatsChangeText(stats, locale);
    Object.assign(change.style, {font: `700 12px/1 ${FONT}`, fontVariantNumeric: "tabular-nums", color: arkLineTone(stats)});
    change.textContent = `${said.up === null ? "" : said.up ? "▲ " : "▼ "}${said.count}${said.percent && said.up !== null ? ` · ${said.percent}` : ""}`;
    bar.append(periodPills(period, options.onPeriod, words), change);

    // The line: counts from 0, a step line in the change's colour, the period's start and now under it.
    const W = 300;
    const H = 132;
    const LEFT = 30;
    const BOTTOM = 18;
    const plotW = W - LEFT - 4;
    const plotH = H - BOTTOM - 6;
    const line = arkLinePath(series.counts, plotW, plotH, {pad: 2, fromZero: true, max: stats.peak});
    const tone = arkLineTone(stats);
    const chart = svg("svg", {viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": fillArkWords(words.graphLabel, {animal: name, period: words.periods[period], start: number(stats.start), now: number(stats.now)})});
    Object.assign(chart.style, {display: "block", width: "100%", height: "auto", touchAction: "none"});
    const top = line.max;
    const ticks = top < 1 ? [0] : top > 1 && top % 2 === 0 ? [0, top / 2, top] : [0, top];
    const yOf = (v: number) => 8 + (plotH - 4) - (v / Math.max(top, 1)) * (plotH - 4);
    for (const tick of ticks) {
        chart.appendChild(svg("line", {x1: LEFT, x2: W - 4, y1: yOf(tick), y2: yOf(tick), stroke: "rgba(255,255,255,0.08)", "stroke-width": 1}));
        const text = svg("text", {x: LEFT - 5, y: yOf(tick) + 3.5, "text-anchor": "end", "font-size": 10, fill: "rgba(255,252,244,0.5)"});
        text.textContent = number(tick);
        chart.appendChild(text);
    }
    const plot = svg("g", {transform: `translate(${LEFT} 6)`});
    plot.appendChild(svg("path", {d: line.area, fill: tone, "fill-opacity": 0.12}));
    plot.appendChild(svg("path", {d: line.d, fill: "none", stroke: tone, "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round"}));
    const last = line.points[line.points.length - 1];
    const dot = svg("circle", {cx: last[0], cy: last[1], r: 3, fill: tone});
    const cursor = svg("line", {x1: 0, x2: 0, y1: 0, y2: plotH, stroke: "rgba(255,255,255,0.25)", "stroke-width": 1, visibility: "hidden"});
    plot.append(cursor, dot);
    chart.appendChild(plot);
    const start = series.times[0] ?? history.asOf;
    const from = svg("text", {x: LEFT, y: H - 4, "font-size": 10, fill: "rgba(255,252,244,0.5)"});
    from.textContent = arkGraphWhen(Math.max(start, history.firstAt), locale, history);
    const to = svg("text", {x: W - 4, y: H - 4, "font-size": 10, "text-anchor": "end", fill: "rgba(255,252,244,0.5)"});
    to.textContent = words.now;
    chart.append(from, to);
    const plotBox = document.createElement("div");
    Object.assign(plotBox.style, {position: "relative", padding: "0 8px"});
    const tip = document.createElement("p");
    tip.setAttribute("aria-live", "polite");
    Object.assign(tip.style, {position: "absolute", top: "0", right: "12px", maxWidth: "85%", margin: "0", padding: "2px 6px", borderRadius: "6px", background: "rgba(0,0,0,0.6)", font: `600 11px/1.2 ${FONT}`, fontVariantNumeric: "tabular-nums", display: "none", pointerEvents: "none"});
    const hover = (event: PointerEvent) => {
        const box = chart.getBoundingClientRect();
        const x = ((event.clientX - box.left) / Math.max(box.width, 1)) * W - LEFT;
        const n = series.counts.length;
        const i = Math.max(0, Math.min(n - 1, n <= 1 ? 0 : Math.round((x / plotW) * (n - 1))));
        const point = line.points[Math.min(i, line.points.length - 1)];
        cursor.setAttribute("x1", String(point[0]));
        cursor.setAttribute("x2", String(point[0]));
        cursor.setAttribute("visibility", "visible");
        dot.setAttribute("cx", String(point[0]));
        dot.setAttribute("cy", String(point[1]));
        dot.setAttribute("fill", LIME);
        tip.textContent = fillArkWords(words.pointAt, {count: number(series.counts[i]), time: arkGraphWhen(series.times[i], locale, history)});
        // What changed at this point: arrivals from photos, births, deaths (the record's own rows).
        const changed = arkStepChanges(series, i).map(([kind, n]) => fillArkWords(words[kind], {count: number(n)})).join(" · ");
        if (changed) {
            const more = document.createElement("span");
            Object.assign(more.style, {display: "block", fontWeight: "500", opacity: "0.75"});
            more.textContent = changed;
            tip.appendChild(more);
        }
        tip.style.display = "block";
    };
    chart.addEventListener("pointermove", hover);
    chart.addEventListener("pointerdown", hover);
    chart.addEventListener("pointerleave", () => {
        cursor.setAttribute("visibility", "hidden");
        dot.setAttribute("cx", String(last[0]));
        dot.setAttribute("cy", String(last[1]));
        dot.setAttribute("fill", tone);
        tip.style.display = "none";
    });
    plotBox.append(chart, tip);

    const legend = document.createElement("p");
    Object.assign(legend.style, {margin: "0", padding: "0 14px 2px", font: `500 10.5px/1.35 ${FONT}`, opacity: "0.55"});
    legend.textContent = words.riseFall;

    const note = document.createElement("p");
    Object.assign(note.style, {margin: "0", padding: "0 14px", font: `500 10.5px/1.3 ${FONT}`, opacity: "0.45"});
    const end = series.times[series.times.length - 1] ?? history.asOf;
    const dayFrom = arkDayAt(start, history.startedAt);
    const dayTo = arkDayAt(end, history.startedAt);
    note.textContent = [
        dayFrom !== null && dayTo !== null ? fillArkWords(words.arkDays, {from: number(Math.max(0, dayFrom)), to: number(dayTo)}) : null,
        start <= history.firstAt + history.bucketMs ? fillArkWords(words.recordStarts, {date: arkGraphDate(history.firstAt, locale, history)}) : null
    ].filter(Boolean).join(" · ");

    const grid = document.createElement("dl");
    Object.assign(grid.style, {display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "4px", margin: "0", padding: "10px 14px 4px", textAlign: "center"});
    for (const [term, value, colored] of [[words.now, number(stats.now), false], [words.change, said.count, true], [words.peak, number(stats.peak), false], [words.low, number(stats.low), false]] as const) {
        const cell = document.createElement("div");
        Object.assign(cell.style, {borderRadius: "8px", background: "rgba(255,255,255,0.05)", padding: "6px 4px"});
        const dt = document.createElement("dt");
        Object.assign(dt.style, {font: `600 10px/1.2 ${FONT}`, textTransform: "uppercase", letterSpacing: "0.04em", opacity: "0.45"});
        dt.textContent = term;
        const dd = document.createElement("dd");
        Object.assign(dd.style, {margin: "0", font: `700 13px/1.3 ${FONT}`, fontVariantNumeric: "tabular-nums", color: colored ? tone : "inherit"});
        dd.textContent = value;
        cell.append(dt, dd);
        grid.appendChild(cell);
    }

    const happened = document.createElement("p");
    Object.assign(happened.style, {margin: "0", padding: "6px 14px 8px", font: `500 11.5px/1.35 ${FONT}`, opacity: "0.7"});
    const parts = ([["arrived", stats.arrived], ["born", stats.born], ["revived", stats.revived], ["died", stats.died], ["eaten", stats.eaten]] as const).filter(([, n]) => n > 0).map(([kind, n]) => fillArkWords(words[kind], {count: number(n)}));
    happened.textContent = parts.length ? parts.join(" · ") : words.nothing;
    if (stats.goneNow) {
        const gone = document.createElement("span");
        Object.assign(gone.style, {display: "block", paddingTop: "2px", fontWeight: "700", color: DOWN});
        gone.textContent = words.goneNow;
        happened.appendChild(gone);
    }

    pane.append(back, head, whereBox, bar, plotBox, legend, note, grid, happened);
    if (options.onFly) {
        const fly = document.createElement("button");
        fly.type = "button";
        Object.assign(fly.style, {display: "block", width: "calc(100% - 28px)", margin: "0 14px", minHeight: "44px", border: "0", borderRadius: "999px", background: "rgba(255,255,255,0.1)", color: "#fff", font: `700 12.5px/1 ${FONT}`, cursor: "pointer"});
        fly.textContent = words.flyTo;
        fly.addEventListener("click", options.onFly);
        pane.appendChild(fly);
    }
    return pane;
}
