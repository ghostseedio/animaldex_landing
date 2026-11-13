/**
 * The bars over the selected animal (owner, 2026-11-12: "show bars above animals too when clicked on to see how far
 * they from dieing or hunger"; decision 240): how fed it is where the server keeps it a meal clock, how far from dying,
 * its energy over its day (card truth, 2026-11-13), and its life left when the data has a lifespan (`lib/ark-animal-status.ts`
 * arkStatusBars). Only for the selected animal, following it, a fixed size on
 * screen so it reads at any zoom, kept inside the view. Plain DOM in the scene's label layer, so /ark and the apps'
 * embed both get it. The tap card says the same in words; this layer is hidden from screen readers.
 */

import {ARK_STATUS_BAR_KEYS, type ArkBarTone, type ArkStatusBarKey, type ArkStatusBars} from "@/lib/ark-animal-status";

const FONT = "var(--font-sans, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif)";
const TONE: Record<ArkBarTone, string> = {good: "#8fd694", warn: "#f2c14e", bad: "#ef6f5c"};
/** The bars' icons: a bowl (fed), a heart (health), a bolt (energy), an hourglass (life left). */
const ICON: Record<ArkStatusBarKey, string> = {
    fed: `<path d="M4 11h16a8 8 0 0 1-16 0z"/><path d="M9.5 7.5c0-1.2 1.2-1.6 1.2-3M14 7.5c0-1.2 1.2-1.6 1.2-3"/>`,
    health: `<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>`,
    energy: `<path d="M13 3L5 13.5h6L10 21l8-10.5h-6z"/>`,
    age: `<path d="M7 4h10M7 20h10M8 4c0 5 8 5 8 8s-8 3-8 8M16 4c0 5-8 5-8 8s8 3 8 8"/>`
};
const KEYS = ARK_STATUS_BAR_KEYS;
/** Clear of the view's edges (CSS px). */
const EDGE = 8;

export class ArkSelectionBars {
    readonly el: HTMLDivElement;
    private readonly rows = new Map<ArkStatusBarKey, {row: HTMLDivElement; fill: HTMLSpanElement}>();
    private shown = false;
    private any = false;
    private size: {w: number; h: number} | null = null;

    constructor(layer: HTMLElement, private reducedMotion: boolean) {
        const el = document.createElement("div");
        el.dataset.arkBars = "selected";
        Object.assign(el.style, {
            position: "absolute",
            left: "0",
            top: "0",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            padding: "5px 7px 5px 6px",
            borderRadius: "9px",
            background: "rgba(14, 20, 14, 0.72)",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(255, 255, 255, 0.18)",
            boxShadow: "0 2px 10px rgba(0, 0, 0, 0.25)",
            font: `700 9px/1 ${FONT}`,
            color: "rgba(255, 252, 244, 0.9)",
            pointerEvents: "none",
            opacity: "0",
            transition: reducedMotion ? "none" : "opacity 220ms ease",
            willChange: "transform"
        });
        for (const key of KEYS) {
            const row = document.createElement("div");
            Object.assign(row.style, {display: "none", alignItems: "center", gap: "5px"});
            const icon = document.createElement("span");
            icon.innerHTML = `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICON[key]}</svg>`;
            Object.assign(icon.style, {display: "inline-flex", flex: "0 0 auto", opacity: "0.85"});
            const track = document.createElement("span");
            Object.assign(track.style, {position: "relative", display: "block", width: "54px", height: "5px", borderRadius: "999px", background: "rgba(255, 255, 255, 0.16)", overflow: "hidden"});
            const fill = document.createElement("span");
            Object.assign(fill.style, {position: "absolute", insetInlineStart: "0", top: "0", bottom: "0", width: "0%", borderRadius: "999px", transition: reducedMotion ? "none" : "width 400ms ease, background-color 400ms ease"});
            track.appendChild(fill);
            row.append(icon, track);
            el.appendChild(row);
            this.rows.set(key, {row, fill});
        }
        // The pointer down to the animal.
        const tick = document.createElement("span");
        Object.assign(tick.style, {position: "absolute", left: "50%", bottom: "-5px", width: "8px", height: "8px", marginLeft: "-4px", transform: "rotate(45deg)", background: "rgba(14, 20, 14, 0.72)", borderRight: "1px solid rgba(255, 255, 255, 0.18)", borderBottom: "1px solid rgba(255, 255, 255, 0.18)"});
        el.appendChild(tick);
        layer.appendChild(el);
        this.el = el;
    }

    setReducedMotion(reduced: boolean) {
        this.reducedMotion = reduced;
        this.el.style.transition = reduced ? "none" : "opacity 220ms ease";
    }

    /** The selected animal's bars, or null (nothing selected, or nothing to show). */
    set(bars: ArkStatusBars | null) {
        this.any = false;
        for (const key of KEYS) {
            const bar = bars?.[key] ?? null;
            const {row, fill} = this.rows.get(key)!;
            row.style.display = bar ? "flex" : "none";
            if (!bar) continue;
            this.any = true;
            fill.style.width = `${Math.round(Math.min(Math.max(bar.value, 0.04), 1) * 100)}%`;
            fill.style.background = TONE[bar.tone];
        }
        this.size = null;
        if (!this.any) this.hide();
    }

    /** Over the point above its head (CSS px in the view), kept inside the view; hidden when it is out of sight. */
    place(x: number, y: number, visible: boolean, view: {width: number; height: number}) {
        if (!visible || !this.any) return this.hide();
        if (!this.size) {
            const box = this.el.getBoundingClientRect();
            this.size = {w: box.width || 76, h: box.height || 30};
        }
        const {w, h} = this.size;
        const left = Math.min(Math.max(x - w / 2, EDGE), Math.max(view.width - w - EDGE, EDGE));
        const top = Math.min(Math.max(y - h - 9, EDGE), Math.max(view.height - h - EDGE, EDGE));
        this.el.style.transform = `translate(${left.toFixed(1)}px, ${top.toFixed(1)}px)`;
        if (!this.shown) {
            this.shown = true;
            this.el.style.opacity = "1";
        }
    }

    hide() {
        if (!this.shown) return;
        this.shown = false;
        this.el.style.opacity = "0";
    }

    dispose() {
        this.el.remove();
    }
}
