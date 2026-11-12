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
import type {ArkSceneHandle, ArkSnapshot} from "@/ark-scene/types";

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
};

type Row = {el: HTMLLIElement; button: HTMLButtonElement; icon: HTMLImageElement; name: HTMLSpanElement; mine: HTMLSpanElement; fill: HTMLSpanElement; change: HTMLSpanElement; count: HTMLSpanElement; slug: string};

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
            width: "min(18rem, calc(100% - 66px))",
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
            if (this.built >= this.ranked.length || list.scrollTop + list.clientHeight < list.scrollHeight - 240) return;
            this.built += ROWS_STEP;
            this.draw();
        }, {passive: true});
        Object.assign(list.style, {listStyle: "none", margin: "0", padding: "4px 0", minHeight: "0", flex: "1 1 auto", overflowY: "auto", overscrollBehavior: "contain", borderTop: "1px solid rgba(255, 255, 255, 0.08)", scrollbarWidth: "thin"});
        panel.append(head, list);

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
        this.applyCollapsed();
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
        el.appendChild(button);
        return {el, button, icon, name, mine, fill, change, count, slug: ""};
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
        for (const species of this.ranked.slice(0, this.built)) {
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
            row.mine.style.display = species.mine ? "inline-block" : "none";
            row.count.textContent = number(species.count);
            row.fill.style.width = `${(arkBarShare(species.count, ceiling) * 100).toFixed(1)}%`;
            const change = arkChangeOf(species.count, this.then, species.key, "both");
            drawChange(row.change, change, words, locale);
            const said = arkChangeText(change, locale);
            row.button.setAttribute("aria-label", [
                fillArkWords(words.rowCount, {animal: species.name, count: number(species.count)}),
                said ? fillArkWords(words.change24h, {change: said.text}) : null,
                species.mine ? words.yours : null
            ].filter(Boolean).join(", "));
        }
        this.rows.forEach((row, key) => {
            if (seen.has(key)) return;
            row.el.remove();
            this.rows.delete(key);
        });
        this.drawSelected();
        this.applyCollapsed();
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
        const scene = this.options.scene();
        if (!row || !scene) return;
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
