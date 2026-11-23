/**
 * The live log over the world (`lib/ark-live-log.ts` decides the lines): a small chip at the foot of the world's
 * start side ("Live"), the last few lines above it, each fading after a while, each a button that flies the camera
 * to what it is about. Plain DOM over the canvas, like the runtime's reset button, so /ark and the apps' embed get
 * the same thing.
 *
 * Lines of the Ark's record are solid; lines seen near the camera are lighter, dashed, with an eye and a "Seen"
 * tag; the behaviour schedule's moments anywhere on the Ark (decision 240) are as light, with a pulse and a "Now"
 * tag. The chip folds the lines away (remembered per reader when the host gives a storage key). While a card
 * covers the foot of the world, the whole log moves up above it (the host's `--ark-card-h`, the card's height; owner
 * 2026-11-16: the card "hides the 'live' log … we should move the live logs up when the description container shows up").
 *
 * A stack (owner 2026-11-20, decision 439; `lib/ark-live-stack.ts`): the newest line comes in at the foot, the older
 * slide up and fade a step each (at most 4, 3 at a phone's width, and only as many as fit under the controls at the
 * top and clear of the population panel), each goes on its own at the end of its life, and only the newest carries its
 * "Now" / "Seen" tag. Moves are transforms and opacity only (FLIP: one read of the rows before and after a change, never
 * per frame); with reduced motion nothing slides, lines only fade.
 */

import type {ArkLiveLine} from "@/lib/ark-live-log";
import {arkLiveStackFit, arkLiveStackMax, arkLiveStackOpacity, arkLiveStackPick, arkLiveStackTagged} from "@/lib/ark-live-stack";

const FONT = "var(--font-sans, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif)";

/**
 * Clear of the foot of the screen: the safe area (an iPhone's home indicator) and what the host covers there
 * (`--ark-inset-bottom`, the embed's `?insetBottom=`); both 0 on /ark.
 */
export const ARK_BOTTOM_CLEAR = "calc(12px + env(safe-area-inset-bottom, 0px) + var(--ark-inset-bottom, 0px))";

/** Space between two lines, and between the lines and the chip (px). */
const ROW_GAP = 4;
const CHIP_GAP = 5;
/** Kept clear at the top of the world for its controls (sound, the quality leaf: px), under the host's top inset. */
const TOP_CLEAR = 64;
/** How long a line takes to fade out when it leaves the stack, and to slide (ms). */
const LEAVE_MS = 420;
const SLIDE_MS = 320;
const EASE = "cubic-bezier(.2,.8,.2,1)";

type Row = {
    id: string;
    el: HTMLButtonElement;
    text: HTMLSpanElement;
    tag: HTMLSpanElement | null;
    count: number;
    seen: boolean;
    source: ArkLiveLine["source"];
    /** Fading out, about to be taken away (no longer a button anyone can press). */
    leaving: boolean;
    slide: Animation | null;
};

/** A line's dot, by kind (the record), in the page's palette. */
const DOT: Record<string, string> = {
    arrival: "#8fd694",
    mated: "#e7a8dc",
    birth: "#f4b6c8",
    hatched: "#f4b6c8",
    laid: "#efdfa8",
    meal: "#f08a5d",
    death: "#b9b4a7",
    starved: "#b9b4a7",
    extinction: "#8a8579",
    // The crisis layer (AnimalDex E4): a calm amber for a kind down to a few, the arrival's green once it is out of danger,
    // the extinction's grey for none left in the wild, a soft blue for a recovering animal in the zoo's care.
    crisis: "#e3c27a",
    saved: "#8fd694",
    wildGone: "#8a8579",
    toCare: "#9cc4e4",
    more: "#d8d2c2"
};

const EYE = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="2.6"/></svg>`;
/** A now line's marker: a ring with its dot (happening now, on the shared clock). */
const PULSE = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="7.5" opacity="0.55"/><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/></svg>`;
const CHEVRON = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M6 15l6-6 6 6"/></svg>`;

export type ArkLiveLogLabels = {title: string; show: string; hide: string; logLabel: string; seen: string; seenNote: string; /** The schedule's moments' tag ("Now") and what it means. */ now: string; nowNote: string; showMe: string};

export type ArkLiveLogViewOptions = {
    labels: ArkLiveLogLabels;
    /** A line as the reader reads it. */
    text: (line: ArkLiveLine) => string;
    onTap: (line: ArkLiveLine) => void;
    reducedMotion: boolean;
    /** How long a line of the record, a seen one and a now one stay (ms): they fade over the last part. */
    serverLife: number;
    seenLife: number;
    nowLife?: number;
    collapsed: boolean;
    onCollapsed?: (collapsed: boolean) => void;
};


export class ArkLiveLogView {
    readonly root: HTMLDivElement;
    private readonly list: HTMLDivElement;
    private readonly chip: HTMLButtonElement;
    private readonly dot: HTMLSpanElement;
    private readonly chipLabel: HTMLSpanElement;
    private readonly host: HTMLElement;
    /** The rows in the list, oldest first (those leaving too, until they are gone). */
    private readonly rows = new Map<string, Row>();
    /** Lines that did not fit above a card: not drawn again while they are in the log (they are older than all shown). */
    private readonly dropped = new Set<string>();
    private readonly timers = new Set<ReturnType<typeof setTimeout>>();
    private collapsed: boolean;
    private covered = false;
    private labels: ArkLiveLogLabels;
    private static serial = 0;

    constructor(host: HTMLElement, private options: ArkLiveLogViewOptions) {
        this.labels = options.labels;
        // Owner 2026-11-23: the live log is always open; it no longer folds (any stored or passed fold is ignored).
        this.collapsed = false;
        const id = `ark-live-log-${++ArkLiveLogView.serial}`;
        const root = document.createElement("div");
        root.dataset.arkLive = "log";
        Object.assign(root.style, {
            position: "absolute",
            insetInlineStart: "12px",
            bottom: ARK_BOTTOM_CLEAR,
            zIndex: "2",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: `${CHIP_GAP}px`,
            maxWidth: "min(25rem, calc(100% - 80px))",
            pointerEvents: "none",
            font: `600 12.5px/1.3 ${FONT}`,
            transition: options.reducedMotion ? "none" : "opacity 250ms ease, bottom 250ms ease",
            WebkitTapHighlightColor: "transparent"
        });
        const list = document.createElement("div");
        list.id = id;
        list.setAttribute("role", "log");
        list.setAttribute("aria-live", "polite");
        list.setAttribute("aria-relevant", "additions");
        Object.assign(list.style, {display: "flex", flexDirection: "column", alignItems: "flex-start", gap: `${ROW_GAP}px`, maxWidth: "100%"});
        const chip = document.createElement("button");
        chip.type = "button";
        chip.setAttribute("aria-controls", id);
        Object.assign(chip.style, {
            pointerEvents: "auto",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            minHeight: "28px",
            padding: "4px 10px 4px 9px",
            border: "1px solid rgba(255, 255, 255, 0.16)",
            borderRadius: "999px",
            background: "rgba(14, 20, 14, 0.62)",
            backdropFilter: "blur(8px)",
            color: "rgba(255, 252, 244, 0.92)",
            font: `700 10.5px/1 ${FONT}`,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            cursor: "pointer"
        });
        const dot = document.createElement("span");
        dot.setAttribute("aria-hidden", "true");
        Object.assign(dot.style, {width: "7px", height: "7px", borderRadius: "999px", background: "rgba(255, 252, 244, 0.35)", transition: options.reducedMotion ? "none" : "background-color 400ms ease, box-shadow 400ms ease"});
        const chipLabel = document.createElement("span");
        const chevron = document.createElement("span");
        chevron.innerHTML = CHEVRON;
        Object.assign(chevron.style, {display: "inline-flex", opacity: "0.75", transition: options.reducedMotion ? "none" : "transform 200ms ease"});
        chip.append(dot, chipLabel, chevron);
        // (Always open: the chip is the log's title only, not a button that folds it.)
        chip.disabled = true;
        chip.style.cursor = "default";
        chevron.style.display = "none";
        root.append(list, chip);
        host.appendChild(root);
        this.host = host;
        this.root = root;
        this.list = list;
        this.chip = chip;
        this.dot = dot;
        this.chipLabel = chipLabel;
        this.applyLabels();
        this.applyCollapsed(chevron);
    }

    private chevron(): HTMLElement | null {
        return this.chip.lastElementChild as HTMLElement | null;
    }

    private applyLabels() {
        this.chipLabel.textContent = this.labels.title;
        this.list.setAttribute("aria-label", this.labels.logLabel);
        this.chip.setAttribute("aria-label", this.labels.title);
        this.chip.removeAttribute("title");
    }

    private applyCollapsed(chevron = this.chevron()) {
        this.list.style.display = this.collapsed ? "none" : "flex";
        this.chip.removeAttribute("aria-expanded");
        if (chevron) chevron.style.transform = this.collapsed ? "rotate(0deg)" : "rotate(180deg)";
        this.applyLabels();
    }

    setLabels(labels: ArkLiveLogLabels) {
        this.labels = labels;
        this.applyLabels();
        for (const row of Array.from(this.rows.values())) {
            if (row.tag) {
                const now = row.source === "now";
                row.tag.textContent = now ? labels.now : labels.seen;
                row.tag.title = now ? labels.nowNote : labels.seenNote;
            }
        }
    }

    setCollapsed(_collapsed: boolean) {
        this.collapsed = false;
        this.applyCollapsed();
    }

    /** A card covers the foot of the world: the log moves up above it (by the host's `--ark-card-h`) until it closes. */
    setCovered(covered: boolean) {
        this.covered = covered;
        this.root.style.bottom = covered ? `calc(${ARK_BOTTOM_CLEAR} + var(--ark-card-h, 0px))` : ARK_BOTTOM_CLEAR;
        // (Above a card the world left is short, a phone's most of all: the stack keeps only the lines that fit under the
        // controls at the top, the newest always; never a line cut in half. Measured where the log will stand.)
        if (covered) this.root.dataset.arkLiveCovered = "";
        else delete this.root.dataset.arkLiveCovered;
        // (After the log's own move up, 250 ms: measured where it stands, not where it was.)
        const timer = setTimeout(() => {
            this.timers.delete(timer);
            this.fit();
        }, this.options.reducedMotion ? 0 : 300);
        this.timers.add(timer);
    }

    get isCollapsed(): boolean {
        return this.collapsed;
    }

    get isCovered(): boolean {
        return this.covered;
    }

    /** The lines as they are now (oldest first); `now` sets each one's fade. */
    render(lines: readonly ArkLiveLine[], now: number) {
        const present = new Set(lines.map((line) => line.id));
        this.dropped.forEach((id) => {
            if (!present.has(id)) this.dropped.delete(id);
        });
        const shown = arkLiveStackPick(lines.filter((line) => !this.dropped.has(line.id)), arkLiveStackMax(this.root.ownerDocument.defaultView?.innerWidth ?? 1024));
        const keep = new Set(shown.map((line) => line.id));
        const going = Array.from(this.rows.values()).filter((row) => !row.leaving && !keep.has(row.id));
        const coming = shown.filter((line) => !this.rows.has(line.id));
        if (going.length || coming.length) {
            this.flip(() => {
                for (const row of going) this.leave(row);
                for (const line of coming) {
                    const row = this.makeRow(line);
                    this.rows.set(line.id, row);
                    this.list.appendChild(row.el);
                }
            });
            for (const line of coming) {
                const row = this.rows.get(line.id)!;
                const life = this.lifeOf(line);
                const target = arkLiveStackOpacity(0, life - (now - line.updatedAt));
                row.el.style.opacity = String(target);
                // In: from just below, the older ones sliding up (`flip`); with reduced motion only a fade.
                row.el.animate?.(this.options.reducedMotion ? [{opacity: 0}, {opacity: target}] : [{opacity: 0, transform: "translateY(10px)"}, {opacity: target, transform: "none"}], {duration: this.options.reducedMotion ? 200 : 300, easing: EASE});
            }
            if (coming.length) this.fit();
        }
        // Each line: a step fainter for each newer one below it, and its own fade at the end of its life.
        const byId = new Map(lines.map((line) => [line.id, line]));
        const live = Array.from(this.rows.values()).filter((row) => !row.leaving);
        live.forEach((row, at) => {
            const line = byId.get(row.id);
            if (!line) return;
            const rank = live.length - 1 - at;
            if (row.count !== line.count) {
                row.count = line.count;
                row.text.textContent = this.options.text(line);
                row.el.setAttribute("aria-label", this.lineLabel(line));
                if (!this.options.reducedMotion) row.el.animate?.([{backgroundColor: "rgba(255, 252, 244, 0.28)"}, {backgroundColor: row.seen ? "rgba(14, 20, 14, 0.42)" : "rgba(14, 20, 14, 0.66)"}], {duration: 700, easing: "ease-out"});
            }
            row.el.style.opacity = String(arkLiveStackOpacity(rank, this.lifeOf(line) - (now - line.updatedAt)));
            if (row.tag) row.tag.style.display = arkLiveStackTagged(rank) ? "" : "none";
        });
        // The chip's dot: lit while anything is on screen.
        const lit = live.length > 0;
        this.dot.style.background = lit ? "#8fd694" : "rgba(255, 252, 244, 0.35)";
        this.dot.style.boxShadow = lit && !this.options.reducedMotion ? "0 0 0 3px rgba(143, 214, 148, 0.22)" : "none";
    }

    private lifeOf(line: ArkLiveLine): number {
        const life = line.source === "server" ? this.options.serverLife : line.source === "now" ? this.options.nowLife ?? this.options.seenLife : this.options.seenLife;
        return Math.max(life, line.stay ?? 0);
    }

    /**
     * A change to the rows with the others gliding to their new places (FLIP): where each stood before, the change,
     * where it stands now, and a transform from the one to the other. Two reads a change (a new line, one gone), never
     * per frame. With reduced motion the change is made as it is.
     */
    private flip(change: () => void) {
        if (this.options.reducedMotion || this.collapsed) {
            change();
            return;
        }
        const before = new Map<Row, number>();
        this.rows.forEach((row) => before.set(row, row.el.getBoundingClientRect().top));
        change();
        before.forEach((top, row) => {
            if (!row.el.isConnected) return;
            row.slide?.cancel();
            const dy = Math.round(top - row.el.getBoundingClientRect().top);
            row.slide = dy ? row.el.animate?.([{transform: `translateY(${dy}px)`}, {transform: "none"}], {duration: SLIDE_MS, easing: EASE}) ?? null : null;
        });
    }

    /** A row out of the stack: it fades where it is, then goes (the others close up over it). */
    private leave(row: Row) {
        row.leaving = true;
        row.el.style.pointerEvents = "none";
        row.el.setAttribute("aria-hidden", "true");
        row.el.tabIndex = -1;
        row.el.style.transition = `opacity ${LEAVE_MS}ms ease`;
        row.el.style.opacity = "0";
        const timer = setTimeout(() => {
            this.timers.delete(timer);
            if (this.rows.get(row.id) !== row) return;
            this.flip(() => {
                row.el.remove();
                this.rows.delete(row.id);
            });
        }, LEAVE_MS);
        this.timers.add(timer);
    }

    /**
     * Only the lines that fit: under the controls at the top of the world (and the host's top inset), clear of the
     * population panel where the two would meet (a phone's "aboard" pill), the newest always. Read when a line comes
     * and when a card comes or goes; the older lines that do not fit leave and are not drawn again.
     */
    private fit() {
        if (this.collapsed || !this.root.isConnected) return;
        const live = Array.from(this.rows.values()).filter((row) => !row.leaving);
        if (live.length < 2) return;
        const view = this.root.ownerDocument.defaultView;
        const inset = view ? Number.parseFloat(view.getComputedStyle(this.root.ownerDocument.documentElement).getPropertyValue("--ark-inset-top")) || 0 : 0;
        const box = this.root.getBoundingClientRect();
        let top = this.host.getBoundingClientRect().top + inset + TOP_CLEAR;
        const bars = this.host.querySelector<HTMLElement>("[data-ark-live=\"bars\"]");
        if (bars) {
            const panel = bars.getBoundingClientRect();
            if (panel.height > 0 && panel.left < box.right && panel.right > box.left) top = Math.max(top, panel.bottom + 8);
        }
        const room = this.chip.getBoundingClientRect().top - CHIP_GAP - top;
        const heights = live.map((row) => row.el.offsetHeight).reverse();
        const n = arkLiveStackFit(heights, ROW_GAP, room);
        if (n >= live.length) return;
        const going = live.slice(0, live.length - n);
        for (const row of going) this.dropped.add(row.id);
        for (const row of going) this.leave(row);
    }

    private lineLabel(line: ArkLiveLine): string {
        const text = this.options.text(line);
        return line.source === "seen" ? `${this.labels.seen}: ${text}. ${this.labels.showMe}` : line.source === "now" ? `${this.labels.now}: ${text}. ${this.labels.showMe}` : `${text}. ${this.labels.showMe}`;
    }

    private makeRow(line: ArkLiveLine) {
        // (Seen and now lines are drawn alike, lighter and dashed: neither is the Ark's record.)
        const now = line.source === "now";
        const seen = line.source === "seen" || now;
        const el = document.createElement("button");
        el.type = "button";
        el.dataset.arkLiveKind = line.kind;
        el.dataset.arkLiveSource = line.source;
        Object.assign(el.style, {
            pointerEvents: "auto",
            display: "flex",
            alignItems: "center",
            gap: "7px",
            maxWidth: "100%",
            minHeight: "28px",
            padding: "5px 10px 5px 8px",
            textAlign: "start",
            borderRadius: "10px",
            border: seen ? "1px dashed rgba(255, 255, 255, 0.34)" : "1px solid rgba(255, 255, 255, 0.14)",
            background: seen ? "rgba(14, 20, 14, 0.42)" : "rgba(14, 20, 14, 0.66)",
            backdropFilter: "blur(8px)",
            color: seen ? "rgba(255, 252, 244, 0.9)" : "rgba(255, 252, 244, 0.98)",
            font: "inherit",
            cursor: "pointer",
            // (Opacity only: the stack's steps and the end of a line's life. The slides are the rows' own animations.)
            transition: "opacity 600ms linear",
            willChange: "transform, opacity"
        });
        const marker = document.createElement("span");
        marker.setAttribute("aria-hidden", "true");
        if (seen) {
            marker.innerHTML = now ? PULSE : EYE;
            Object.assign(marker.style, {display: "inline-flex", flex: "0 0 auto", color: now ? "#f2d98a" : "#a8d8e8"});
        } else {
            Object.assign(marker.style, {flex: "0 0 auto", width: "8px", height: "8px", borderRadius: "999px", background: DOT[line.kind] ?? DOT.more});
        }
        const text = document.createElement("span");
        text.textContent = this.options.text(line);
        Object.assign(text.style, {minWidth: "0", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: "2", WebkitBoxOrient: "vertical"});
        el.append(marker, text);
        let tagEl: HTMLSpanElement | null = null;
        if (seen) {
            const tag = document.createElement("span");
            tag.dataset.arkLiveSeen = now ? "now" : "1";
            tag.textContent = now ? this.labels.now : this.labels.seen;
            tag.title = now ? this.labels.nowNote : this.labels.seenNote;
            tag.setAttribute("aria-hidden", "true");
            Object.assign(tag.style, {flex: "0 0 auto", padding: "1px 5px", borderRadius: "999px", border: now ? "1px solid rgba(242, 217, 138, 0.55)" : "1px solid rgba(168, 216, 232, 0.55)", color: now ? "#f6e7b4" : "#cfe9f2", font: `700 9.5px/1.3 ${FONT}`, letterSpacing: "0.08em", textTransform: "uppercase"});
            el.append(tag);
            tagEl = tag;
        }
        el.setAttribute("aria-label", this.lineLabel(line));
        el.addEventListener("click", () => {
            const current = this.lineOf?.(line.id) ?? line;
            this.options.onTap(current);
        });
        return {id: line.id, el, text, tag: tagEl, count: line.count, seen, source: line.source, leaving: false, slide: null} satisfies Row;
    }

    /** The newest copy of a line (its focus can move to the latest of a folded group). */
    lineOf: ((id: string) => ArkLiveLine | null) | null = null;

    dispose() {
        this.timers.forEach((timer) => clearTimeout(timer));
        this.timers.clear();
        this.root.remove();
        this.rows.clear();
        this.dropped.clear();
    }
}
