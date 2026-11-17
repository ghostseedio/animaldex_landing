/**
 * Who is aboard, over the world: the apps' embed's counterpart of /ark's population overlay (`ark-population-hud.tsx`,
 * decision 239). A chip at the top start corner ("3,152 aboard ▾", folded at first, every time: nothing is
 * remembered in the apps' panel) that opens to a small glass panel: the total and its 24-hour change, then every
 * species biggest first as a thin bar with its icon, name, count and 24-hour change (green ▲ / red ▼; nothing when the
 * same). The count 24 hours ago is worked out from the event log (`lib/ark-population-change.ts`). A count that
 * changes glides its bar to the new length.
 *
 * A row goes to one of that species' animals (the host hears `ark:selected` as for any tap) and folds the panel so
 * the animal shows. Plain DOM; the whole Ark (both islands), as the apps' panel shows one world.
 */

import {ARK_PLACEHOLDER_ICON, isArkPlaceholderSlug} from "@/ark-scene/placeholder-icon";
import {arkBarCeiling, arkBarShare} from "@/lib/ark-live-bars";
import {arkChangeOf, arkChangeText, arkRankedSpecies, arkTotalChange, readArkPopulationThen, type ArkChange, type ArkPopulationThen} from "@/lib/ark-population-change";
import {arkPickAnimal, arkSpeciesKey, type ArkSpeciesRow} from "@/lib/ark-population";
import {fillArkWords} from "@/lib/ark-words";
import {ARK_LOST_WORDS_EN, arkExtinctHow, arkExtinctWhen, fetchArkExtinct, type ArkExtinction, type ArkLostWords} from "@/lib/ark-extinct";
import type {ArkSceneHandle, ArkSnapshot} from "@/ark-scene/types";
// popgraph: population over time (owner, 2026-11-17), from the server's record.
import {arkHistoryLines, arkPeriodSpan, readArkHistory, type ArkHistory, type ArkLine, type ArkPeriod} from "@/lib/ark-population-history";
import {ARK_BARS_GRAPH_WORDS, buildGraphPane, drawControls, drawPeriodChange, drawSpark, makeSparkButton, type ArkSortMode} from "@/ark-scene/live/bars-graph";

const FONT = "var(--font-sans, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif)";
const GLASS = {background: "rgba(14, 20, 14, 0.72)", backdropFilter: "blur(12px)", border: "1px solid rgba(255, 255, 255, 0.14)", color: "rgba(255, 252, 244, 0.96)"};
const UP = "#86e08f";
const DOWN = "#ff8a7a";
const LIME = "#c8fa63";
/** The 24-hour change is worked out this long after the first snapshot, so its read never competes with the scene's. */
const CHANGE_READ_AFTER_MS = 1500;
/** Rows built at a time: the first ones when the panel first opens, more as the list is scrolled near its end. */
const ROWS_STEP = 48;

export type ArkBarsWords = {
    /** "{count} aboard": the chip and the panel's heading. */
    chip: string;
    show: string;
    hide: string;
    /** "{animal}: {count}" */
    rowCount: string;
    /** "{change} in the last 24 hours" */
    change24h: string;
    /** "24 h" */
    changeWindow: string;
    /** "{count} species" (and its one) */
    speciesOne: string;
    speciesOther: string;
    yours: string;
    herdTag: string;
    list: string;
    /** Lost from the Ark (`lib/ark-extinct.ts`); English where absent. */
    lost?: ArkLostWords;
};

export type ArkBarsViewOptions = {
    scene: () => ArkSceneHandle | null;
    words: ArkBarsWords;
    locale: string;
    reducedMotion: boolean;
    collapsed: boolean;
    /** `/api/ark/events`, for the 24-hour change; null (development's fixtures): no change said. */
    eventsUrl?: string | null;
    /**
     * A species' icon, from the host (the embed's own icon folder): the bundle has no site environment to build one
     * from. Without it, and for a species with no Ark model (A13), the Ark's generic figure.
     */
    iconUrl?: ((slug: string) => string) | null;
    /**
     * Lost from the Ark's read (`/api/ark/extinct`); null: no section (development's fixtures). The section shows only
     * once the read answers with at least one species.
     */
    extinctUrl?: string | null;
    /** A lost species tapped (the embed tells its host `ark:open-species`). Absent: its rows are not buttons. */
    onLostSpecies?: ((one: ArkExtinction) => void) | null;
};

type Row = {el: HTMLLIElement; button: HTMLButtonElement; icon: HTMLImageElement; name: HTMLSpanElement; mine: HTMLSpanElement; fill: HTMLSpanElement; change: HTMLSpanElement; count: HTMLSpanElement; spark: HTMLButtonElement; slug: string};

const CARET = `<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M5 7.5l5 5 5-5"/></svg>`;

function caret(up: boolean, reducedMotion: boolean): HTMLSpanElement {
    const span = document.createElement("span");
    span.innerHTML = CARET;
    Object.assign(span.style, {display: "inline-flex", opacity: "0.75", transform: up ? "rotate(180deg)" : "none", transition: reducedMotion ? "none" : "transform 200ms ease"});
    return span;
}

/** "▲ +12%" / "▼ −3%", coloured; empty when there is nothing to say. */
function drawChange(el: HTMLSpanElement, change: ArkChange | null, words: ArkBarsWords, locale: string) {
    const said = arkChangeText(change, locale);
    el.textContent = said ? `${said.up ? "▲" : "▼"} ${said.text}` : "";
    el.style.display = said ? "inline" : "none";
    el.style.color = said?.up ? UP : DOWN;
    el.title = said ? fillArkWords(words.change24h, {change: said.text}) : "";
}

export class ArkBarsView {
    readonly root: HTMLDivElement;
    private readonly chip: HTMLButtonElement;
    private readonly chipText: HTMLSpanElement;
    private readonly chipChange: HTMLSpanElement;
    private readonly panel: HTMLDivElement;
    private readonly title: HTMLSpanElement;
    private readonly totalChange: HTMLSpanElement;
    private readonly windowLabel: HTMLSpanElement;
    private readonly subline: HTMLSpanElement;
    private readonly close: HTMLButtonElement;
    private readonly list: HTMLUListElement;
    private readonly lost: HTMLDivElement;
    private readonly lostToggle: HTMLButtonElement;
    private readonly lostTitle: HTMLSpanElement;
    private readonly lostCount: HTMLSpanElement;
    private readonly lostBody: HTMLDivElement;
    private lostList: ArkExtinction[] = [];
    private lostOpen = false;
    private lostAsked = false;
    private readonly rows = new Map<string, Row>();
    private snapshot: ArkSnapshot | null = null;
    private ranked: ArkSpeciesRow[] = [];
    private then: ArkPopulationThen | null = null;
    private asked = false;
    private collapsed: boolean;
    /** How many rows are built (none until the panel is first opened). */
    private built = 0;
    private selectedId: string | null = null;
    private timer: ReturnType<typeof setTimeout> | null = null;
    private disposed = false;
    // popgraph: the record's answers (week by the hour, all by the day), the order and period, the graph shown.
    private histories: {week: ArkHistory | null; all: ArkHistory | null} = {week: null, all: null};
    private historyAsked = {week: false, all: false};
    private period: ArkPeriod = "24h";
    private mode: ArkSortMode = "biggest";
    private graphKey: string | null = null;
    private lines = new Map<string, ArkLine>();
    private order: string[] = [];
    private readonly controls: HTMLDivElement;
    private readonly none: HTMLParagraphElement;
    private graphPane: HTMLDivElement | null = null;

    constructor(host: HTMLElement, private options: ArkBarsViewOptions) {
        this.collapsed = options.collapsed;
        const reduced = options.reducedMotion;
        const root = document.createElement("div");
        root.dataset.arkLive = "bars";
        Object.assign(root.style, {
            position: "absolute",
            insetInlineStart: "10px",
            // Clear of the top of the screen: the safe area and what the host draws there (`--ark-inset-top`, the
            // embed's `?insetTop=`: the iOS panel's close button and title).
            top: "calc(10px + env(safe-area-inset-top, 0px) + var(--ark-inset-top, 0px))",
            zIndex: "2",
            // popgraph: a little wider for each row's line (was 18rem).
            width: "min(20rem, calc(100% - 66px))",
            // Clear of the log at the foot of the world (its chip and a few lines).
            maxHeight: "calc(100% - 210px - env(safe-area-inset-top, 0px) - var(--ark-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - var(--ark-inset-bottom, 0px))",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            pointerEvents: "none",
            font: `600 12px/1.25 ${FONT}`,
            WebkitTapHighlightColor: "transparent"
        });

        // Folded: the chip.
        const chip = document.createElement("button");
        chip.type = "button";
        Object.assign(chip.style, {...GLASS, pointerEvents: "auto", display: "inline-flex", alignItems: "center", gap: "8px", minHeight: "44px", padding: "0 12px 0 14px", borderRadius: "999px", font: `700 13px/1 ${FONT}`, fontVariantNumeric: "tabular-nums", cursor: "pointer", whiteSpace: "nowrap", boxShadow: "0 10px 30px -12px rgba(0, 0, 0, 0.55)"});
        const chipText = document.createElement("span");
        const chipChange = document.createElement("span");
        Object.assign(chipChange.style, {font: `700 11px/1 ${FONT}`, fontVariantNumeric: "tabular-nums"});
        chip.append(chipText, chipChange, caret(false, reduced));
        chip.addEventListener("click", () => this.setCollapsed(false));

        // Open: the panel.
        const panel = document.createElement("div");
        Object.assign(panel.style, {...GLASS, pointerEvents: "auto", display: "flex", flexDirection: "column", width: "100%", minHeight: "0", borderRadius: "16px", overflow: "hidden", boxShadow: "0 10px 30px -12px rgba(0, 0, 0, 0.55)"});
        const head = document.createElement("div");
        Object.assign(head.style, {display: "flex", alignItems: "flex-start", gap: "4px", padding: "8px 4px 8px 14px"});
        const heading = document.createElement("div");
        Object.assign(heading.style, {flex: "1", minWidth: "0", paddingTop: "4px"});
        const line = document.createElement("div");
        Object.assign(line.style, {display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "2px 8px"});
        const title = document.createElement("span");
        Object.assign(title.style, {font: `800 15px/1.2 ${FONT}`, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em"});
        const totalChange = document.createElement("span");
        Object.assign(totalChange.style, {font: `700 11px/1 ${FONT}`, fontVariantNumeric: "tabular-nums"});
        const windowLabel = document.createElement("span");
        Object.assign(windowLabel.style, {font: `600 10.5px/1 ${FONT}`, opacity: "0.45"});
        windowLabel.setAttribute("aria-hidden", "true");
        line.append(title, totalChange, windowLabel);
        const subline = document.createElement("span");
        Object.assign(subline.style, {display: "block", marginTop: "3px", font: `500 11.5px/1.2 ${FONT}`, opacity: "0.6"});
        heading.append(line, subline);
        const close = document.createElement("button");
        close.type = "button";
        close.setAttribute("aria-expanded", "true");
        Object.assign(close.style, {flex: "0 0 auto", width: "44px", height: "44px", display: "flex", alignItems: "center", justifyContent: "center", border: "0", borderRadius: "999px", background: "transparent", color: "inherit", cursor: "pointer", padding: "0"});
        close.appendChild(caret(true, reduced));
        close.addEventListener("click", () => this.setCollapsed(true));
        head.append(heading, close);
        const list = document.createElement("ul");
        // More rows as the end of the list comes into view.
        list.addEventListener("scroll", () => {
            if (this.built >= Math.max(this.order.length, this.ranked.length) || list.scrollTop + list.clientHeight < list.scrollHeight - 240) return;
            this.built += ROWS_STEP;
            this.draw();
        }, {passive: true});
        Object.assign(list.style, {listStyle: "none", margin: "0", padding: "4px 0", minHeight: "0", flex: "1 1 auto", overflowY: "auto", overscrollBehavior: "contain", borderTop: "1px solid rgba(255, 255, 255, 0.08)", scrollbarWidth: "thin"});
        // Lost from the Ark, after the living: one folded line, hidden until the read answers with one.
        const lost = document.createElement("div");
        lost.dataset.arkLost = "0";
        Object.assign(lost.style, {display: "none", flex: "0 0 auto", flexDirection: "column", borderTop: "1px solid rgba(255, 255, 255, 0.08)", minHeight: "0"});
        const lostToggle = document.createElement("button");
        lostToggle.type = "button";
        lostToggle.setAttribute("aria-expanded", "false");
        Object.assign(lostToggle.style, {display: "flex", alignItems: "center", gap: "8px", width: "100%", minHeight: "44px", padding: "0 10px 0 14px", border: "0", background: "transparent", color: "rgba(255, 252, 244, 0.72)", font: `700 12px/1.2 ${FONT}`, textAlign: "start", cursor: "pointer"});
        const lostDot = document.createElement("span");
        lostDot.setAttribute("aria-hidden", "true");
        Object.assign(lostDot.style, {flex: "0 0 auto", width: "6px", height: "6px", borderRadius: "999px", background: "#8a8579"});
        const lostTitle = document.createElement("span");
        lostTitle.style.flex = "1";
        const lostCount = document.createElement("span");
        Object.assign(lostCount.style, {opacity: "0.6", fontVariantNumeric: "tabular-nums"});
        lostToggle.append(lostDot, lostTitle, lostCount, caret(false, reduced));
        lostToggle.addEventListener("click", () => this.setLostOpen(!this.lostOpen));
        const lostBody = document.createElement("div");
        Object.assign(lostBody.style, {display: "none", maxHeight: "12rem", overflowY: "auto", overscrollBehavior: "contain", paddingBottom: "4px"});
        lost.append(lostToggle, lostBody);
        // popgraph: the order and period over the list (shown once the record's read answers), and "nothing changed".
        const controls = document.createElement("div");
        Object.assign(controls.style, {display: "none", flexWrap: "wrap", alignItems: "center", gap: "6px", padding: "0 14px 10px"});
        const none = document.createElement("p");
        Object.assign(none.style, {display: "none", margin: "0", padding: "12px 14px", font: `500 12px/1.3 ${FONT}`, opacity: "0.55", borderTop: "1px solid rgba(255, 255, 255, 0.08)"});
        panel.append(head, controls, none, list, lost);

        root.append(chip, panel);
        host.appendChild(root);
        this.root = root;
        this.chip = chip;
        this.chipText = chipText;
        this.chipChange = chipChange;
        this.panel = panel;
        this.title = title;
        this.totalChange = totalChange;
        this.windowLabel = windowLabel;
        this.subline = subline;
        this.close = close;
        this.list = list;
        this.lost = lost;
        this.lostToggle = lostToggle;
        this.lostTitle = lostTitle;
        this.lostCount = lostCount;
        this.lostBody = lostBody;
        this.controls = controls;
        this.none = none;
        this.applyCollapsed();
    }

    /** Lost from the Ark as read (the embed hands it to its host on `ark:extinct` too). */
    lostSpecies(): ArkExtinction[] {
        return this.lostList.slice();
    }

    /** The read's answer (from this view's own read, or the embed's). */
    setLost(list: ArkExtinction[]) {
        this.lostList = list.slice();
        this.drawLost();
    }

    private setLostOpen(open: boolean) {
        this.lostOpen = open;
        this.drawLost();
    }

    private drawLost() {
        const words = this.options.words.lost ?? ARK_LOST_WORDS_EN;
        const locale = this.options.locale;
        const list = this.lostList;
        this.lost.dataset.arkLost = String(list.length);
        this.lost.style.display = list.length ? "flex" : "none";
        if (!list.length) return;
        this.lostTitle.textContent = words.title;
        this.lostCount.textContent = list.length.toLocaleString(locale);
        this.lostToggle.setAttribute("aria-expanded", this.lostOpen ? "true" : "false");
        const turn = this.lostToggle.lastElementChild as HTMLElement | null;
        if (turn) turn.style.transform = this.lostOpen ? "rotate(180deg)" : "none";
        this.lostBody.style.display = this.lostOpen ? "block" : "none";
        this.lostBody.replaceChildren();
        if (!this.lostOpen) return;
        const intro = document.createElement("p");
        Object.assign(intro.style, {margin: "0", padding: "0 14px 4px", font: `500 11px/1.35 ${FONT}`, opacity: "0.5"});
        intro.textContent = words.intro;
        const ul = document.createElement("ul");
        ul.setAttribute("aria-label", words.listLabel);
        Object.assign(ul.style, {listStyle: "none", margin: "0", padding: "0"});
        for (const one of list) {
            const li = document.createElement("li");
            const tap = this.options.onLostSpecies;
            const row = document.createElement(tap ? "button" : "div");
            if (row instanceof HTMLButtonElement) {
                row.type = "button";
                row.addEventListener("click", () => tap?.(one));
            }
            Object.assign(row.style, {display: "flex", alignItems: "center", gap: "10px", width: "100%", minHeight: "44px", padding: "5px 14px", border: "0", background: "transparent", color: "inherit", font: "inherit", textAlign: "start", cursor: tap ? "pointer" : "default"});
            const badge = document.createElement("span");
            Object.assign(badge.style, {flex: "0 0 auto", width: "24px", height: "24px", borderRadius: "999px", background: "#f6f1e7", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", opacity: one.backAboard ? "1" : "0.6", filter: one.backAboard ? "none" : "grayscale(1)"});
            const icon = document.createElement("img");
            icon.alt = "";
            icon.width = 24;
            icon.height = 24;
            icon.loading = "lazy";
            Object.assign(icon.style, {width: "84%", height: "84%", objectFit: "contain"});
            icon.addEventListener("error", () => {
                if (!icon.src.endsWith(ARK_PLACEHOLDER_ICON)) icon.src = ARK_PLACEHOLDER_ICON;
            });
            icon.src = this.options.iconUrl && one.modelSlug && !isArkPlaceholderSlug(one.modelSlug) ? this.options.iconUrl(one.modelSlug) : ARK_PLACEHOLDER_ICON;
            badge.appendChild(icon);
            const middle = document.createElement("span");
            Object.assign(middle.style, {flex: "1", minWidth: "0", display: "block"});
            const top = document.createElement("span");
            Object.assign(top.style, {display: "flex", alignItems: "center", gap: "6px"});
            const name = document.createElement("span");
            Object.assign(name.style, {minWidth: "0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", font: `600 13px/1.2 ${FONT}`, opacity: one.backAboard ? "1" : "0.75"});
            name.textContent = one.name;
            top.appendChild(name);
            if (one.backAboard) {
                const back = document.createElement("span");
                Object.assign(back.style, {flex: "0 0 auto", padding: "1px 6px", borderRadius: "999px", background: "rgba(200, 250, 99, 0.15)", color: LIME, font: `700 10px/1.2 ${FONT}`});
                back.textContent = words.back;
                top.appendChild(back);
            }
            const when = arkExtinctWhen(words.when, one, locale);
            const how = arkExtinctHow(words, one);
            const line = (value: string, alpha: string) => {
                const span = document.createElement("span");
                Object.assign(span.style, {display: "block", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", font: `500 11px/1.2 ${FONT}`, opacity: alpha});
                span.textContent = value;
                return span;
            };
            middle.append(top, line(when, "0.55"));
            if (how) middle.appendChild(line(how, "0.45"));
            row.setAttribute("aria-label", [one.name, when, how, one.backAboard ? words.back : null].filter(Boolean).join(", "));
            row.append(badge, middle);
            li.appendChild(row);
            ul.appendChild(li);
        }
        this.lostBody.append(intro, ul);
    }

    /** Its own read of Lost from the Ark, once, a moment after the first snapshot (never competing with the scene). */
    private askLost() {
        if (this.lostAsked || !this.options.extinctUrl) return;
        this.lostAsked = true;
        const url = this.options.extinctUrl;
        setTimeout(() => {
            if (this.disposed) return;
            void fetchArkExtinct(url).then((answer) => {
                if (!this.disposed && answer.available) this.setLost(answer.extinctions);
            });
        }, CHANGE_READ_AFTER_MS);
    }

    private applyCollapsed() {
        this.chip.style.display = this.collapsed ? "inline-flex" : "none";
        this.panel.style.display = this.collapsed ? "none" : "flex";
        const words = this.options.words;
        this.chip.setAttribute("aria-expanded", "false");
        this.chip.setAttribute("aria-label", [this.chipText.textContent, this.chipChange.title, words.show].filter(Boolean).join(", "));
        this.chip.title = words.show;
        this.close.setAttribute("aria-label", words.hide);
        this.close.title = words.hide;
    }

    setCollapsed(collapsed: boolean) {
        this.collapsed = collapsed;
        // The rows are built the first time the panel opens (a folded chip costs the page nothing).
        if (!collapsed && !this.built && this.snapshot) {
            this.built = ROWS_STEP;
            this.draw();
        }
        this.applyCollapsed();
    }

    setWords(words: ArkBarsWords, locale: string) {
        this.options = {...this.options, words, locale};
        if (this.snapshot) this.draw();
        this.drawLost();
        this.applyCollapsed();
    }

    /** The animal the host or a tap selected (a species' row walks through its animals from it). */
    setSelected(id: string | null) {
        this.selectedId = id;
        if (this.snapshot) this.drawSelected();
    }

    update(snapshot: ArkSnapshot) {
        this.snapshot = snapshot;
        this.ranked = arkRankedSpecies(snapshot);
        if (!this.collapsed && !this.built) this.built = ROWS_STEP;
        this.draw();
        this.askLost();
        // The 24-hour change: the log read once, a moment after the first snapshot (kept a few minutes per device).
        if (!this.asked && this.options.eventsUrl) {
            this.asked = true;
            const url = this.options.eventsUrl;
            this.timer = setTimeout(() => {
                if (this.disposed || !this.snapshot) return;
                let storage: Storage | null = null;
                try {
                    storage = window.localStorage;
                } catch {
                    storage = null;
                }
                this.askHistory("week");
                void readArkPopulationThen(url, this.snapshot, {fetch: (asked) => fetch(asked), storage}).then((then) => {
                    if (this.disposed || !then) return;
                    this.then = then;
                    this.draw();
                });
            }, CHANGE_READ_AFTER_MS);
        }
    }

    private makeRow(key: string): Row {
        const el = document.createElement("li");
        const button = document.createElement("button");
        button.type = "button";
        Object.assign(button.style, {display: "flex", alignItems: "center", gap: "10px", width: "100%", minHeight: "44px", padding: "4px 14px", border: "0", background: "transparent", color: "inherit", font: "inherit", textAlign: "start", cursor: "pointer", transition: this.options.reducedMotion ? "none" : "background-color 200ms ease"});
        const badge = document.createElement("span");
        Object.assign(badge.style, {flex: "0 0 auto", width: "24px", height: "24px", borderRadius: "999px", background: "#f6f1e7", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden"});
        const icon = document.createElement("img");
        icon.alt = "";
        icon.width = 24;
        icon.height = 24;
        icon.loading = "lazy";
        icon.decoding = "async";
        Object.assign(icon.style, {width: "84%", height: "84%", objectFit: "contain"});
        icon.addEventListener("error", () => {
            if (!icon.src.endsWith(ARK_PLACEHOLDER_ICON)) icon.src = ARK_PLACEHOLDER_ICON;
        });
        badge.appendChild(icon);
        const middle = document.createElement("span");
        Object.assign(middle.style, {flex: "1", minWidth: "0", display: "block"});
        const top = document.createElement("span");
        Object.assign(top.style, {display: "flex", alignItems: "center", gap: "6px"});
        const name = document.createElement("span");
        Object.assign(name.style, {minWidth: "0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", font: `600 13px/1.2 ${FONT}`});
        const mine = document.createElement("span");
        mine.setAttribute("aria-hidden", "true");
        Object.assign(mine.style, {flex: "0 0 auto", width: "6px", height: "6px", borderRadius: "999px", background: LIME, display: "none"});
        top.append(name, mine);
        const track = document.createElement("span");
        track.setAttribute("aria-hidden", "true");
        Object.assign(track.style, {display: "block", height: "3px", marginTop: "5px", borderRadius: "999px", background: "rgba(255, 255, 255, 0.09)"});
        const fill = document.createElement("span");
        Object.assign(fill.style, {display: "block", height: "100%", width: "0%", borderRadius: "999px", background: "rgba(255, 252, 244, 0.6)", transition: this.options.reducedMotion ? "none" : "width 700ms cubic-bezier(.2,.8,.2,1)"});
        track.appendChild(fill);
        middle.append(top, track);
        const change = document.createElement("span");
        change.setAttribute("aria-hidden", "true");
        Object.assign(change.style, {flex: "0 0 auto", font: `700 11px/1 ${FONT}`, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap"});
        const count = document.createElement("span");
        Object.assign(count.style, {flex: "0 0 auto", minWidth: "2em", textAlign: "end", font: `700 13px/1 ${FONT}`, fontVariantNumeric: "tabular-nums"});
        button.append(badge, middle, change, count);
        button.addEventListener("click", () => this.pick(key));
        el.style.display = "flex";
        button.style.flex = "1 1 auto";
        button.style.minWidth = "0";
        const spark = makeSparkButton(() => this.openGraph(key));
        spark.style.display = "none";
        el.append(button, spark);
        return {el, button, icon, name, mine, fill, change, count, spark, slug: ""};
    }

    private draw() {
        const snapshot = this.snapshot;
        if (!snapshot) return;
        const words = this.options.words;
        const locale = this.options.locale;
        const number = (value: number) => value.toLocaleString(locale);
        const total = fillArkWords(words.chip, {count: number(snapshot.counts.animals)});
        const totalChange = arkTotalChange(snapshot.animals.length, this.then, "both");
        this.chipText.textContent = total;
        drawChange(this.chipChange, totalChange, words, locale);
        this.title.textContent = total;
        drawChange(this.totalChange, totalChange, words, locale);
        this.windowLabel.textContent = arkChangeText(totalChange, locale) ? words.changeWindow : "";
        const species = snapshot.counts.species;
        this.subline.textContent = species === 1 ? words.speciesOne : words.speciesOther.replace("{count}", number(species));
        this.list.setAttribute("aria-label", words.list);
        const ceiling = arkBarCeiling(this.ranked[0]?.count ?? 0);
        const seen = new Set<string>();
        // popgraph: each row's line over the period, and Thriving / Declining's order (with kinds that died out).
        const history = this.history();
        const byKey = new Map(this.ranked.map((species) => [species.key, species]));
        const drawn = history ? arkHistoryLines(history, this.period, this.ranked.map((species) => species.key), "both", this.mode) : null;
        this.lines = drawn?.lines ?? new Map();
        this.order = drawn?.ranked ?? this.ranked.map((species) => species.key);
        this.drawControls(history, drawn?.ranked ?? null);
        for (const key of this.order.slice(0, this.built)) {
            const species = byKey.get(key);
            const line = this.lines.get(key) ?? null;
            if (!species) {
                // A kind that died out in the period (Declining): its graph only.
                const gone = history?.gone.get(key);
                if (!gone) continue;
                seen.add(key);
                let row = this.rows.get(key);
                if (!row) {
                    row = this.makeRow(key);
                    this.rows.set(key, row);
                }
                this.list.appendChild(row.el);
                row.slug = gone.slug ?? "";
                row.icon.src = this.options.iconUrl && gone.slug && !isArkPlaceholderSlug(gone.slug) ? this.options.iconUrl(gone.slug) : ARK_PLACEHOLDER_ICON;
                row.name.textContent = gone.name;
                row.name.style.opacity = "0.7";
                row.mine.style.display = "none";
                row.count.textContent = "0";
                row.fill.style.width = "0%";
                if (line) drawPeriodChange(row.change, line.stats, locale);
                row.button.setAttribute("aria-label", `${gone.name}: 0, ${ARK_BARS_GRAPH_WORDS.goneNow}`);
                this.drawRowSpark(row, line, gone.name);
                continue;
            }
            seen.add(species.key);
            let row = this.rows.get(species.key);
            if (!row) {
                row = this.makeRow(species.key);
                this.rows.set(species.key, row);
            }
            // In rank order (appending an attached node moves it).
            this.list.appendChild(row.el);
            if (row.slug !== species.slug) {
                row.slug = species.slug;
                row.icon.src = this.options.iconUrl && !isArkPlaceholderSlug(species.slug) ? this.options.iconUrl(species.slug) : ARK_PLACEHOLDER_ICON;
            }
            row.name.textContent = species.name;
            row.name.style.opacity = "1";
            row.mine.style.display = species.mine ? "inline-block" : "none";
            row.count.textContent = number(species.count);
            row.fill.style.width = `${(arkBarShare(species.count, ceiling) * 100).toFixed(1)}%`;
            const change = arkChangeOf(species.count, this.then, species.key, "both");
            // Thriving / Declining: the period's change; else the 24-hour change, as before.
            if (drawn?.ranked && line) drawPeriodChange(row.change, line.stats, locale);
            else drawChange(row.change, change, words, locale);
            const said = arkChangeText(change, locale);
            row.button.setAttribute("aria-label", [
                fillArkWords(words.rowCount, {animal: species.name, count: number(species.count)}),
                drawn?.ranked && line ? `${row.change.textContent}, ${ARK_BARS_GRAPH_WORDS.periods[this.period]}` : said ? fillArkWords(words.change24h, {change: said.text}) : null,
                species.mine ? words.yours : null
            ].filter(Boolean).join(", "));
            this.drawRowSpark(row, line, species.name);
        }
        this.rows.forEach((row, key) => {
            if (seen.has(key)) return;
            row.el.remove();
            this.rows.delete(key);
        });
        this.drawSelected();
        this.drawGraph();
        this.applyCollapsed();
    }

    // MARK: popgraph

    private history(): ArkHistory | null {
        return this.histories[arkPeriodSpan(this.period)];
    }

    /** The record's answer for a span, once; nothing shows until it answers (and nothing at all while it cannot). */
    private askHistory(span: "week" | "all") {
        const url = this.options.eventsUrl ? this.options.eventsUrl.replace(/events$/, "population") : null;
        if (!url || this.historyAsked[span]) return;
        this.historyAsked[span] = true;
        void readArkHistory(url, span, (asked) => fetch(asked)).then((history) => {
            if (this.disposed || !history) return;
            this.histories[span] = history;
            this.draw();
        });
    }

    private drawRowSpark(row: Row, line: ArkLine | null, name: string) {
        row.spark.style.display = line ? "flex" : "none";
        if (line) drawSpark(row.spark, line.series, line.stats, name);
    }

    private drawControls(history: ArkHistory | null, ranked: string[] | null) {
        const shown = Boolean(this.histories.week) && !this.graphKey;
        this.controls.style.display = shown ? "flex" : "none";
        if (shown) drawControls(this.controls, this.mode, (mode) => this.setGraphState({mode}), this.period, (period) => this.setGraphState({period}));
        const empty = Boolean(history && ranked && !ranked.length) && !this.graphKey;
        this.none.style.display = empty ? "block" : "none";
        this.none.textContent = this.mode === "thriving" ? ARK_BARS_GRAPH_WORDS.noneThriving : ARK_BARS_GRAPH_WORDS.noneDeclining;
    }

    private setGraphState(next: {mode?: ArkSortMode; period?: ArkPeriod; graphKey?: string | null}) {
        if (next.mode !== undefined) {
            this.mode = next.mode;
            this.list.scrollTop = 0;
        }
        if (next.period !== undefined) {
            this.period = next.period;
            this.askHistory(arkPeriodSpan(next.period));
        }
        if (next.graphKey !== undefined) this.graphKey = next.graphKey;
        this.draw();
    }

    private openGraph(key: string) {
        this.setGraphState({graphKey: key});
    }

    /** The graph pane in the list's place while a species' graph is open. */
    private drawGraph() {
        this.graphPane?.remove();
        this.graphPane = null;
        const history = this.history();
        const key = this.graphKey;
        const line = key ? this.lines.get(key) : null;
        const species = key ? this.ranked.find((one) => one.key === key) ?? null : null;
        const gone = key ? history?.gone.get(key) ?? null : null;
        const open = Boolean(history && key && line && (species || gone));
        this.list.style.display = open ? "none" : "";
        if (!open || !history || !line || !key) return;
        const slug = species?.slug ?? gone?.slug ?? "";
        this.graphPane = buildGraphPane({
            history,
            name: species?.name ?? gone?.name ?? "",
            iconSrc: this.options.iconUrl && slug && !isArkPlaceholderSlug(slug) ? this.options.iconUrl(slug) : ARK_PLACEHOLDER_ICON,
            series: line.series,
            stats: line.stats,
            period: this.period,
            locale: this.options.locale,
            onPeriod: (period) => this.setGraphState({period}),
            onBack: () => this.setGraphState({graphKey: null}),
            onFly: species ? () => {
                this.graphKey = null;
                this.pick(key);
                this.draw();
            } : null
        });
        this.list.after(this.graphPane);
    }

    private drawSelected() {
        const animal = this.selectedId ? this.snapshot?.animals.find((one) => one.id === this.selectedId) ?? null : null;
        const key = animal ? arkSpeciesKey(animal) : null;
        this.rows.forEach((row, rowKey) => {
            const selected = rowKey === key;
            row.button.style.background = selected ? "rgba(255, 255, 255, 0.10)" : "transparent";
            row.fill.style.background = selected ? LIME : "rgba(255, 252, 244, 0.6)";
            if (selected) row.button.setAttribute("aria-current", "true");
            else row.button.removeAttribute("aria-current");
        });
    }

    private pick(key: string) {
        const row = this.ranked.find((species) => species.key === key);
        if (!row) {
            if (this.history()?.gone.has(key)) this.openGraph(key);
            return;
        }
        const scene = this.options.scene();
        if (!scene) return;
        // On the apps' small panel the open list would cover the animal it flies to: it folds.
        this.setCollapsed(true);
        const herdKey = [row.key, ...row.breeds.map((breed) => breed.key)].find((k) => scene.selectHerd(k));
        if (herdKey) return;
        const animal = arkPickAnimal(row.animals, this.selectedId);
        if (!animal) return;
        this.selectedId = animal.id;
        scene.select(animal.id);
    }

    dispose() {
        this.disposed = true;
        if (this.timer) clearTimeout(this.timer);
        this.root.remove();
    }
}
