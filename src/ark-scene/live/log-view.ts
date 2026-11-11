/**
 * The live log over the world (`lib/ark-live-log.ts` decides the lines): a small chip at the foot of the world's
 * start side ("Live"), the last few lines above it, each fading after a while, each a button that flies the camera
 * to what it is about. Plain DOM over the canvas, like the runtime's reset button, so /ark and the apps' embed get
 * the same thing.
 *
 * Lines of the Ark's record are solid; lines seen near the camera are lighter, dashed, with an eye and a "Seen"
 * tag. The chip folds the lines away (remembered per reader when the host gives a storage key). While a card
 * covers the foot of the world, the whole log steps aside.
 */

import type {ArkLiveLine} from "@/lib/ark-live-log";

const FONT = "var(--font-sans, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif)";

/**
 * Clear of the foot of the screen: the safe area (an iPhone's home indicator) and what the host covers there
 * (`--ark-inset-bottom`, the embed's `?insetBottom=`); both 0 on /ark.
 */
export const ARK_BOTTOM_CLEAR = "calc(12px + env(safe-area-inset-bottom, 0px) + var(--ark-inset-bottom, 0px))";

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
    more: "#d8d2c2"
};

const EYE = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="2.6"/></svg>`;
const CHEVRON = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M6 15l6-6 6 6"/></svg>`;

export type ArkLiveLogLabels = {title: string; show: string; hide: string; logLabel: string; seen: string; seenNote: string; showMe: string};

export type ArkLiveLogViewOptions = {
    labels: ArkLiveLogLabels;
    /** A line as the reader reads it. */
    text: (line: ArkLiveLine) => string;
    onTap: (line: ArkLiveLine) => void;
    reducedMotion: boolean;
    /** How long a line of the record and a seen one stay (ms): they fade over the last part. */
    serverLife: number;
    seenLife: number;
    collapsed: boolean;
    onCollapsed?: (collapsed: boolean) => void;
};

/** The last stretch of a line's life over which it fades out (ms). */
const FADE_MS = 3000;

export class ArkLiveLogView {
    readonly root: HTMLDivElement;
    private readonly list: HTMLDivElement;
    private readonly chip: HTMLButtonElement;
    private readonly dot: HTMLSpanElement;
    private readonly chipLabel: HTMLSpanElement;
    private readonly rows = new Map<string, {el: HTMLButtonElement; text: HTMLSpanElement; count: number; seen: boolean}>();
    private collapsed: boolean;
    private covered = false;
    private labels: ArkLiveLogLabels;
    private static serial = 0;

    constructor(host: HTMLElement, private options: ArkLiveLogViewOptions) {
        this.labels = options.labels;
        this.collapsed = options.collapsed;
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
            gap: "5px",
            maxWidth: "min(25rem, calc(100% - 80px))",
            pointerEvents: "none",
            font: `600 12.5px/1.3 ${FONT}`,
            transition: options.reducedMotion ? "none" : "opacity 250ms ease",
            WebkitTapHighlightColor: "transparent"
        });
        const list = document.createElement("div");
        list.id = id;
        list.setAttribute("role", "log");
        list.setAttribute("aria-live", "polite");
        list.setAttribute("aria-relevant", "additions");
        Object.assign(list.style, {display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "4px", maxWidth: "100%"});
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
        chip.addEventListener("click", () => {
            this.setCollapsed(!this.collapsed);
            this.options.onCollapsed?.(this.collapsed);
        });
        root.append(list, chip);
        host.appendChild(root);
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
        const label = this.collapsed ? this.labels.show : this.labels.hide;
        this.chip.setAttribute("aria-label", `${this.labels.title}: ${label}`);
        this.chip.title = label;
    }

    private applyCollapsed(chevron = this.chevron()) {
        this.list.style.display = this.collapsed ? "none" : "flex";
        this.chip.setAttribute("aria-expanded", this.collapsed ? "false" : "true");
        if (chevron) chevron.style.transform = this.collapsed ? "rotate(0deg)" : "rotate(180deg)";
        this.applyLabels();
    }

    setLabels(labels: ArkLiveLogLabels) {
        this.labels = labels;
        this.applyLabels();
        for (const row of Array.from(this.rows.values())) {
            const tag = row.el.querySelector<HTMLElement>("[data-ark-live-seen]");
            if (tag) {
                tag.textContent = labels.seen;
                tag.title = labels.seenNote;
            }
        }
    }

    setCollapsed(collapsed: boolean) {
        this.collapsed = collapsed;
        this.applyCollapsed();
    }

    /** A card covers the foot of the world: the log steps aside until it closes. */
    setCovered(covered: boolean) {
        this.covered = covered;
        this.root.style.opacity = covered ? "0" : "1";
        this.root.style.visibility = covered ? "hidden" : "visible";
    }

    get isCollapsed(): boolean {
        return this.collapsed;
    }

    get isCovered(): boolean {
        return this.covered;
    }

    /** The lines as they are now (oldest first); `now` sets each one's fade. */
    render(lines: readonly ArkLiveLine[], now: number) {
        const keep = new Set(lines.map((line) => line.id));
        this.rows.forEach((row, id) => {
            if (keep.has(id)) return;
            row.el.remove();
            this.rows.delete(id);
        });
        for (const line of lines) {
            let row = this.rows.get(line.id);
            if (!row) {
                row = this.makeRow(line);
                this.rows.set(line.id, row);
                this.list.appendChild(row.el);
                if (!this.options.reducedMotion) {
                    row.el.animate?.([{opacity: 0, transform: "translateY(6px)"}, {opacity: 1, transform: "none"}], {duration: 260, easing: "cubic-bezier(.2,.8,.2,1)"});
                }
            } else if (row.count !== line.count) {
                row.count = line.count;
                row.text.textContent = this.options.text(line);
                row.el.setAttribute("aria-label", this.lineLabel(line));
                if (!this.options.reducedMotion) row.el.animate?.([{backgroundColor: "rgba(255, 252, 244, 0.28)"}, {backgroundColor: row.seen ? "rgba(14, 20, 14, 0.42)" : "rgba(14, 20, 14, 0.66)"}], {duration: 700, easing: "ease-out"});
            }
            const life = line.source === "seen" ? this.options.seenLife : this.options.serverLife;
            const left = life - (now - line.updatedAt);
            row.el.style.opacity = String(Math.max(Math.min(left / FADE_MS, 1), 0));
        }
        // The chip's dot: lit while anything is on screen.
        const lit = lines.length > 0;
        this.dot.style.background = lit ? "#8fd694" : "rgba(255, 252, 244, 0.35)";
        this.dot.style.boxShadow = lit && !this.options.reducedMotion ? "0 0 0 3px rgba(143, 214, 148, 0.22)" : "none";
    }

    private lineLabel(line: ArkLiveLine): string {
        const text = this.options.text(line);
        return line.source === "seen" ? `${this.labels.seen}: ${text}. ${this.labels.showMe}` : `${text}. ${this.labels.showMe}`;
    }

    private makeRow(line: ArkLiveLine) {
        const seen = line.source === "seen";
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
            transition: this.options.reducedMotion ? "none" : "opacity 600ms linear"
        });
        const marker = document.createElement("span");
        marker.setAttribute("aria-hidden", "true");
        if (seen) {
            marker.innerHTML = EYE;
            Object.assign(marker.style, {display: "inline-flex", flex: "0 0 auto", color: "#a8d8e8"});
        } else {
            Object.assign(marker.style, {flex: "0 0 auto", width: "8px", height: "8px", borderRadius: "999px", background: DOT[line.kind] ?? DOT.more});
        }
        const text = document.createElement("span");
        text.textContent = this.options.text(line);
        Object.assign(text.style, {minWidth: "0", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: "2", WebkitBoxOrient: "vertical"});
        el.append(marker, text);
        if (seen) {
            const tag = document.createElement("span");
            tag.dataset.arkLiveSeen = "1";
            tag.textContent = this.labels.seen;
            tag.title = this.labels.seenNote;
            tag.setAttribute("aria-hidden", "true");
            Object.assign(tag.style, {flex: "0 0 auto", padding: "1px 5px", borderRadius: "999px", border: "1px solid rgba(168, 216, 232, 0.55)", color: "#cfe9f2", font: `700 9.5px/1.3 ${FONT}`, letterSpacing: "0.08em", textTransform: "uppercase"});
            el.append(tag);
        }
        el.setAttribute("aria-label", this.lineLabel(line));
        el.addEventListener("click", () => {
            const current = this.lineOf?.(line.id) ?? line;
            this.options.onTap(current);
        });
        return {el, text, count: line.count, seen};
    }

    /** The newest copy of a line (its focus can move to the latest of a folded group). */
    lineOf: ((id: string) => ArkLiveLine | null) | null = null;

    dispose() {
        this.root.remove();
        this.rows.clear();
    }
}
