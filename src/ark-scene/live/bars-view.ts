/**
 * Who is aboard, as bars, over the world: the apps' embed's counterpart of /ark's population column
 * (`ark-population-hud.tsx` with `ark-live-bars.tsx`). Each region a bar against the biggest region, each species
 * (inside its open region) a bar against the biggest of its region, with the pair line marked and the pair status
 * as the bar's colour. When a count changes the bar glides to its new length and an arrow says by how much.
 *
 * A region's row flies there and opens its species; a species' row goes to one of its animals (the host hears
 * `ark:selected` as for any tap). Plain DOM, folded at first on a narrow panel.
 */

import {arkBars, arkCountChanges, arkDeltaText, arkPopulationCounts, ARK_TREND_MS} from "@/lib/ark-live-bars";
import {arkPickAnimal, arkPopulation, type ArkPairStatus, type ArkPopulation, type ArkSpeciesRow} from "@/lib/ark-population";
import {fillArkWords} from "@/lib/ark-words";
import type {ArkRegion, ArkSceneHandle, ArkSnapshot} from "@/ark-scene/types";

const FONT = "var(--font-sans, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif)";

export const ARK_STATUS_COLOURS: Record<ArkPairStatus, string> = {
    single: "#e9c77b",
    pair: "rgb(200, 250, 99)",
    more: "rgb(167, 244, 50)",
    crowded: "#ee9f6c"
};

export type ArkBarsWords = {
    title: string;
    show: string;
    hide: string;
    barsNote: string;
    up: string;
    down: string;
    regions: Record<ArkRegion, string>;
    status: Record<ArkPairStatus, string>;
    /** "{animal}: {count}, {status}" */
    rowLabel: string;
    /** "{region}: {count} animals" */
    regionCount: string;
};

export type ArkBarsViewOptions = {
    scene: () => ArkSceneHandle | null;
    words: ArkBarsWords;
    locale: string;
    reducedMotion: boolean;
    collapsed: boolean;
};

type Row = {el: HTMLElement; button: HTMLButtonElement; fill: HTMLSpanElement; count: HTMLSpanElement; trend: HTMLSpanElement; notch: HTMLSpanElement | null; name: HTMLSpanElement};

function bar(reducedMotion: boolean, height: number): {track: HTMLSpanElement; fill: HTMLSpanElement} {
    const track = document.createElement("span");
    track.setAttribute("aria-hidden", "true");
    Object.assign(track.style, {position: "relative", display: "block", height: `${height}px`, borderRadius: "999px", background: "rgba(255, 255, 255, 0.12)", overflow: "visible"});
    const fill = document.createElement("span");
    Object.assign(fill.style, {position: "absolute", insetInlineStart: "0", top: "0", bottom: "0", width: "0%", borderRadius: "999px", transition: reducedMotion ? "none" : "width 900ms cubic-bezier(.2,.8,.2,1), background-color 400ms ease, box-shadow 400ms ease"});
    track.appendChild(fill);
    return {track, fill};
}

export class ArkBarsView {
    readonly root: HTMLDivElement;
    private readonly header: HTMLButtonElement;
    private readonly total: HTMLSpanElement;
    private readonly body: HTMLDivElement;
    private readonly regions = new Map<string, Row & {list: HTMLDivElement}>();
    private readonly species = new Map<string, Row>();
    private population: ArkPopulation | null = null;
    private counts = new Map<string, number>();
    private readonly trends = new Map<string, {delta: number; at: number}>();
    private open: ArkRegion | null = null;
    private collapsed: boolean;
    private selectedId: string | null = null;
    private timer: ReturnType<typeof setInterval> | null = null;

    constructor(host: HTMLElement, private options: ArkBarsViewOptions) {
        this.collapsed = options.collapsed;
        const root = document.createElement("div");
        root.dataset.arkLive = "bars";
        Object.assign(root.style, {
            position: "absolute",
            insetInlineStart: "10px",
            top: "calc(10px + env(safe-area-inset-top, 0px))",
            zIndex: "2",
            width: "min(17.5rem, calc(100% - 66px))",
            maxHeight: "calc(100% - 110px)",
            display: "flex",
            flexDirection: "column",
            borderRadius: "14px",
            background: "rgba(14, 20, 14, 0.66)",
            backdropFilter: "blur(10px)",
            border: "1px solid rgba(255, 255, 255, 0.14)",
            color: "rgba(255, 252, 244, 0.96)",
            font: `600 12px/1.25 ${FONT}`,
            overflow: "hidden",
            WebkitTapHighlightColor: "transparent"
        });
        const header = document.createElement("button");
        header.type = "button";
        Object.assign(header.style, {display: "flex", alignItems: "center", gap: "8px", minHeight: "36px", padding: "6px 12px", border: "0", background: "transparent", color: "inherit", font: `700 10.5px/1 ${FONT}`, letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer", textAlign: "start"});
        const title = document.createElement("span");
        title.textContent = options.words.title;
        title.style.flex = "1";
        const total = document.createElement("span");
        Object.assign(total.style, {font: `800 14px/1 ${FONT}`, letterSpacing: "0", fontVariantNumeric: "tabular-nums"});
        const chevron = document.createElement("span");
        chevron.setAttribute("aria-hidden", "true");
        chevron.textContent = "▾";
        Object.assign(chevron.style, {opacity: "0.7", transition: options.reducedMotion ? "none" : "transform 200ms ease"});
        header.append(title, total, chevron);
        header.addEventListener("click", () => this.setCollapsed(!this.collapsed));
        const body = document.createElement("div");
        body.setAttribute("role", "group");
        body.title = options.words.barsNote;
        Object.assign(body.style, {overflowY: "auto", overscrollBehavior: "contain", padding: "0 0 6px"});
        root.append(header, body);
        host.appendChild(root);
        this.root = root;
        this.header = header;
        this.total = total;
        this.body = body;
        this.applyCollapsed();
        // The arrows fade on their own time.
        this.timer = setInterval(() => this.fadeTrends(), 400);
    }

    private applyCollapsed() {
        this.body.style.display = this.collapsed ? "none" : "block";
        this.header.setAttribute("aria-expanded", this.collapsed ? "false" : "true");
        const label = this.collapsed ? this.options.words.show : this.options.words.hide;
        this.header.setAttribute("aria-label", `${this.options.words.title} ${this.total.textContent ?? ""}: ${label}`);
        this.header.title = label;
        const chevron = this.header.lastElementChild as HTMLElement | null;
        if (chevron) chevron.style.transform = this.collapsed ? "rotate(-90deg)" : "none";
    }

    setCollapsed(collapsed: boolean) {
        this.collapsed = collapsed;
        this.applyCollapsed();
    }

    setWords(words: ArkBarsWords, locale: string) {
        this.options = {...this.options, words, locale};
        (this.header.firstElementChild as HTMLElement).textContent = words.title;
        this.body.title = words.barsNote;
        if (this.population) this.draw(this.population);
        this.applyCollapsed();
    }

    /** The animal the host or a tap selected (a species' row walks through its animals from it). */
    setSelected(id: string | null) {
        this.selectedId = id;
    }

    update(snapshot: ArkSnapshot) {
        const population = arkPopulation(snapshot);
        const counts = arkPopulationCounts(population);
        const now = performance.now();
        // The first reading sets the counts; changes after it get an arrow.
        if (this.population) arkCountChanges(this.counts, counts).forEach((delta, key) => this.trends.set(key, {delta: (this.trends.get(key) && now - this.trends.get(key)!.at < ARK_TREND_MS ? this.trends.get(key)!.delta : 0) + delta, at: now}));
        this.counts = counts;
        this.population = population;
        this.draw(population);
    }

    private makeRow(kind: "region" | "species", onTap: () => void): Row {
        const el = document.createElement("div");
        const button = document.createElement("button");
        button.type = "button";
        const species = kind === "species";
        Object.assign(button.style, {display: "block", width: "100%", padding: species ? "5px 12px 6px 22px" : "7px 12px 7px", border: "0", background: "transparent", color: "inherit", font: "inherit", textAlign: "start", cursor: "pointer"});
        const line = document.createElement("span");
        Object.assign(line.style, {display: "flex", alignItems: "baseline", gap: "6px", marginBottom: "4px"});
        const name = document.createElement("span");
        Object.assign(name.style, {flex: "1", minWidth: "0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", ...(species ? {} : {font: `700 10.5px/1.2 ${FONT}`, letterSpacing: "0.12em", textTransform: "uppercase", opacity: "0.85"})});
        const trend = document.createElement("span");
        trend.setAttribute("aria-hidden", "true");
        Object.assign(trend.style, {font: `800 11px/1 ${FONT}`, fontVariantNumeric: "tabular-nums", opacity: "0", transition: this.options.reducedMotion ? "none" : "opacity 500ms ease"});
        const count = document.createElement("span");
        Object.assign(count.style, {font: `800 ${species ? 13 : 12}px/1 ${FONT}`, fontVariantNumeric: "tabular-nums", minWidth: "1.4em", textAlign: "end"});
        line.append(name, trend, count);
        const {track, fill} = bar(this.options.reducedMotion, species ? 6 : 4);
        let notch: HTMLSpanElement | null = null;
        if (species) {
            notch = document.createElement("span");
            Object.assign(notch.style, {position: "absolute", top: "-2px", bottom: "-2px", width: "1.5px", background: "rgba(255, 252, 244, 0.55)", borderRadius: "1px", transition: this.options.reducedMotion ? "none" : "inset-inline-start 900ms ease"});
            track.appendChild(notch);
        }
        button.append(line, track);
        button.addEventListener("click", onTap);
        el.appendChild(button);
        return {el, button, fill, count, trend, notch, name};
    }

    private setTrend(row: Row, key: string, now: number) {
        const trend = this.trends.get(key);
        const live = trend && now - trend.at < ARK_TREND_MS && trend.delta !== 0;
        if (live) {
            row.trend.textContent = `${trend!.delta > 0 ? "▲" : "▼"}${arkDeltaText(trend!.delta, this.options.locale)}`;
            row.trend.style.color = trend!.delta > 0 ? "rgb(200, 250, 99)" : "#ee9f6c";
            row.trend.title = fillArkWords(trend!.delta > 0 ? this.options.words.up : this.options.words.down, {count: Math.abs(trend!.delta).toLocaleString(this.options.locale)});
        }
        row.trend.style.opacity = live ? "1" : "0";
        row.fill.style.boxShadow = live ? `0 0 8px ${trend!.delta > 0 ? "rgba(200, 250, 99, 0.7)" : "rgba(238, 159, 108, 0.7)"}` : "none";
    }

    private fadeTrends() {
        if (!this.population || !this.trends.size) return;
        const now = performance.now();
        let any = false;
        this.trends.forEach((trend, key) => {
            if (now - trend.at >= ARK_TREND_MS + 600) this.trends.delete(key);
            else any = true;
        });
        this.regions.forEach((row, region) => this.setTrend(row, `region:${region}`, now));
        this.species.forEach((row, key) => this.setTrend(row, key, now));
        if (!any) this.trends.clear();
    }

    private draw(population: ArkPopulation) {
        const words = this.options.words;
        const locale = this.options.locale;
        const now = performance.now();
        const bars = arkBars(population);
        const total = population.regions.reduce((sum, group) => sum + group.animals, 0);
        this.total.textContent = total.toLocaleString(locale);
        const seenRegions = new Set<string>();
        const seenSpecies = new Set<string>();
        for (const group of population.regions) {
            const model = bars.regions.find((r) => r.region === group.region)!;
            seenRegions.add(group.region);
            let row = this.regions.get(group.region);
            if (!row) {
                const region = group.region;
                const made = this.makeRow("region", () => {
                    this.open = this.open === region ? null : region;
                    this.options.scene()?.focusRegion(region);
                    if (this.population) this.draw(this.population);
                });
                const list = document.createElement("div");
                made.el.appendChild(list);
                row = {...made, list};
                this.regions.set(region, row);
            }
            this.body.appendChild(row.el);
            row.name.textContent = words.regions[group.region] ?? group.region;
            row.count.textContent = group.animals.toLocaleString(locale);
            row.fill.style.width = `${(model.share * 100).toFixed(1)}%`;
            row.fill.style.background = "rgba(255, 252, 244, 0.72)";
            row.button.setAttribute("aria-expanded", this.open === group.region ? "true" : "false");
            row.button.setAttribute("aria-label", fillArkWords(words.regionCount, {region: words.regions[group.region] ?? group.region, count: group.animals.toLocaleString(locale)}));
            this.setTrend(row, `region:${group.region}`, now);
            const open = this.open === group.region;
            row.list.style.display = open ? "block" : "none";
            if (!open) continue;
            for (const species of group.species) {
                const share = model.rows.find((r) => r.key === species.key)?.share ?? 0;
                seenSpecies.add(species.key);
                let srow = this.species.get(species.key);
                if (!srow) {
                    const key = species.key;
                    srow = this.makeRow("species", () => this.pick(key));
                    this.species.set(key, srow);
                }
                row.list.appendChild(srow.el);
                this.drawSpecies(srow, species, share, model.pairShare, now);
            }
        }
        this.regions.forEach((row, key) => {
            if (seenRegions.has(key)) return;
            row.el.remove();
            this.regions.delete(key);
        });
        this.species.forEach((row, key) => {
            if (seenSpecies.has(key)) return;
            row.el.remove();
            this.species.delete(key);
        });
        this.applyCollapsed();
    }

    private drawSpecies(row: Row, species: ArkSpeciesRow, share: number, pairShare: number, now: number) {
        const words = this.options.words;
        const locale = this.options.locale;
        row.name.textContent = species.name;
        row.count.textContent = species.count.toLocaleString(locale);
        row.fill.style.width = `${(share * 100).toFixed(1)}%`;
        row.fill.style.background = ARK_STATUS_COLOURS[species.status];
        if (row.notch) row.notch.style.insetInlineStart = `calc(${(pairShare * 100).toFixed(1)}% - 0.75px)`;
        row.button.setAttribute("aria-label", fillArkWords(words.rowLabel, {animal: species.name, count: species.count.toLocaleString(locale), status: words.status[species.status]}));
        this.setTrend(row, species.key, now);
    }

    private pick(key: string) {
        const row = this.population?.regions.flatMap((group) => group.species).find((species) => species.key === key);
        const scene = this.options.scene();
        if (!row || !scene) return;
        const herdKey = [row.key, ...row.breeds.map((breed) => breed.key)].find((k) => scene.selectHerd(k));
        if (herdKey) return;
        const animal = arkPickAnimal(row.animals, this.selectedId);
        if (!animal) return;
        this.selectedId = animal.id;
        scene.select(animal.id);
    }

    dispose() {
        if (this.timer) clearInterval(this.timer);
        this.root.remove();
    }
}
