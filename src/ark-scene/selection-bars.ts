/**
 * The bars over the selected animal (owner, 2026-11-12: "show bars above animals too when clicked on to see how far
 * they from dieing or hunger"; decision 240): how fed it is where the server keeps it a meal clock, how far from dying,
 * its energy over its day (card truth, 2026-11-13), and its life left when the data has a lifespan (`lib/ark-animal-status.ts`
 * arkStatusBars). Only for the selected animal, following it, a fixed size on
 * screen so it reads at any zoom, kept inside the view. Plain DOM in the scene's label layer, so /ark and the apps'
 * embed both get it. The tap card says the same in words; this layer is hidden from screen readers.
 *
 * Over the bars, its species' name (owner, 2026-11-14: "on the bars above the animal can we add the animal name, same
 * font size as the icons"): the name its card shows (`animal.name`, the species' common name), never a person's nickname
 * for it nor its founder's name. Up to two bar rows wide (a long name widens the box, the bars stay their width), cut
 * with an ellipsis only past that; `dir="auto"` so a
 * right-to-left name reads right to left.
 *
 * Under the name, who brought it (owner, 2026-11-15: "it's got the new animal [name] but hasn't got the 'Brought by' like
 * on web"; docs/ark/CAPTURE-MEDIA-CONTRACT.md section 1): "Brought by @handle" only when the server names its founder,
 * "Born on the Ark" for one born aboard, nothing for a Voyager. The @handle is a real link to the founder's profile, and
 * a small Talk button sits at the end of the name line for a talkable species (section 3); the host decides what a tap
 * does (`onLink`: the apps' embed tells the app instead of navigating). Those two are the box's only live parts: they
 * take their own taps (never the camera's) and keyboard focus while the box shows; the bars stay hidden from screen
 * readers. The box sits in its own layer beside the scene's labels, which are hidden from screen readers.
 */

import type {SdRhythmState} from "@/lib/ark-sd-rhythm";
import {ARK_STATUS_BAR_KEYS, type ArkBarTone, type ArkStatusBarKey, type ArkStatusBars} from "@/lib/ark-animal-status";

const FONT = "var(--font-sans, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif)";
const TONE: Record<ArkBarTone, string> = {good: "#8fd694", warn: "#f2c14e", bad: "#ef6f5c"};
const RHYTHM: Record<SdRhythmState, string> = {in: TONE.good, slightly: TONE.warn, out: TONE.bad};
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
/** Clear of the chips and buttons over the view by this much (CSS px), and how often they are measured (ms). */
const CHIP_GAP = 6;
const CHIPS_EVERY_MS = 400;
/** The icons' size (CSS px): the name is set at it. */
const ICON_PX = 11;
/** A bar row's width (icon, gap, track); the name may take two of them before it is cut ("Western Diamondback"). */
const ROW_PX = ICON_PX + 5 + 54;
const NAME_MAX_PX = ROW_PX * 2;

type Box = {left: number; top: number; right: number; bottom: number};

/** Under the name: a named founder ("Brought by {name}" with the @handle linked) or a plain line ("Born on the Ark"). */
export type ArkSelectionByline =
    | {kind: "founder"; template: string; handle: string; href: string}
    | {kind: "text"; text: string};

/** What the host adds to the selected animal's box: who brought it, and its Talk link (null: not talkable). */
export type ArkSelectionExtras = {byline: ArkSelectionByline | null; talk: {label: string; href: string} | null};

/** A tap on one of the box's links; the host answers true when it handled it (the link then does not navigate). */
export type ArkSelectionLink = {kind: "profile"; handle: string} | {kind: "talk"; slug: string; animalId: string};

/** The parts of `template` around `{name}` ("Brought by {name}" -> ["Brought by ", ""]); no `{name}`: all before it. */
export function bylineParts(template: string): [string, string] {
    const at = template.indexOf("{name}");
    return at < 0 ? [`${template} `, ""] : [template.slice(0, at), template.slice(at + 6)];
}

const LINK_STYLE = {
    pointerEvents: "auto",
    color: "rgba(255, 252, 244, 0.96)",
    textDecoration: "underline",
    textDecorationColor: "rgba(255, 252, 244, 0.45)",
    textUnderlineOffset: "2px",
    outlineOffset: "2px",
    cursor: "pointer"
} as const;

const ARK_BAR_HEARTS = 3;
const HEART_PATH = "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z";

/** The hearts row's markup: `filled` of 3 filled, the rest outlined (♥♥♡). Pure. */
export function arkBarHeartsMarkup(filled: number): string {
    const n = Math.min(Math.max(Math.round(filled), 0), ARK_BAR_HEARTS);
    return Array.from({length: ARK_BAR_HEARTS}, (_, i) => `<svg viewBox="0 0 24 24" width="${ICON_PX - 1}" height="${ICON_PX - 1}" fill="${i < n ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="${HEART_PATH}"/></svg>`).join("");
}

/**
 * Where the bars go so that they overlap none of `boxes` (the chips and buttons over the view): beside the one they
 * would cover, on the side that moves them least, when they fit there inside the view; else below it. Pure.
 */
export function clearOfBoxes(at: {left: number; top: number}, size: {w: number; h: number}, boxes: readonly Box[], view: {width: number; height: number}, edge = EDGE): {left: number; top: number} {
    let {left, top} = at;
    for (const box of boxes) {
        if (!(left < box.right && left + size.w > box.left && top < box.bottom && top + size.h > box.top)) continue;
        const beside = [box.right, box.left - size.w].filter((x) => x >= edge && x + size.w <= view.width - edge).sort((a, b) => Math.abs(a - left) - Math.abs(b - left));
        if (beside.length) left = beside[0];
        else top = Math.min(box.bottom, Math.max(view.height - size.h - edge, edge));
    }
    return {left, top};
}

export class ArkSelectionBars {
    readonly el: HTMLDivElement;
    private readonly rows = new Map<ArkStatusBarKey, {row: HTMLDivElement; fill: HTMLSpanElement}>();
    private readonly name: HTMLDivElement;
    private readonly nameText: HTMLSpanElement;
    private readonly talk: HTMLAnchorElement;
    private readonly byline: HTMLDivElement;
    private links: {talk: ArkSelectionLink | null; profile: ArkSelectionLink | null} = {talk: null, profile: null};
    private readonly head: HTMLDivElement;
    private readonly dot: HTMLSpanElement;
    /** Hearts are lives: the owner's own animal's hearts (♥♥♡), a tiny row under the bars; hidden with none. */
    private readonly hearts: HTMLDivElement;
    private heartsShown: number | null = null;
    private shown = false;
    private any = false;
    private size: {w: number; h: number} | null = null;
    /** What is drawn over the view (the HUD's chips, the sound button), in the layer's own pixels, and the host's top inset. */
    private chips: {at: number; top: number; boxes: Box[]} | null = null;

    /** `layer`: the scene's label layer; the box goes in a layer of its own just after it (not hidden from screen readers). */
    constructor(labels: HTMLElement, private reducedMotion: boolean, private readonly onLink: ((link: ArkSelectionLink) => boolean) | null = null) {
        const layer = document.createElement("div");
        layer.dataset.arkBarsLayer = "";
        Object.assign(layer.style, {position: "absolute", inset: "0", pointerEvents: "none", overflow: "hidden"});
        labels.after(layer);
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
        const line = {
            maxWidth: `${NAME_MAX_PX}px`,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            textAlign: "start",
            font: `600 ${ICON_PX}px/1.15 ${FONT}`,
            letterSpacing: "-0.01em",
            color: "rgba(255, 252, 244, 0.96)",
            textShadow: "0 1px 2px rgba(0, 0, 0, 0.45)"
        };
        // The name line: the species' name, and the Talk button at its end when there is one.
        const name = document.createElement("div");
        Object.assign(name.style, {display: "none", alignItems: "center", gap: "5px", maxWidth: `${NAME_MAX_PX + ICON_PX + 9}px`, paddingBottom: "1px"});
        const nameText = document.createElement("span");
        nameText.dir = "auto";
        nameText.setAttribute("aria-hidden", "true");
        Object.assign(nameText.style, {...line, display: "block", minWidth: "0", flex: "0 1 auto"});
        const talk = document.createElement("a");
        talk.dataset.arkBarsTalk = "";
        talk.innerHTML = `<svg viewBox="0 0 24 24" width="${ICON_PX}" height="${ICON_PX}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M20 12a7.5 7.5 0 0 1-11.2 6.5L4 20l1.5-4.3A7.5 7.5 0 1 1 20 12z"/></svg>`;
        Object.assign(talk.style, {
            ...LINK_STYLE,
            display: "none",
            flex: "0 0 auto",
            alignItems: "center",
            justifyContent: "center",
            width: `${ICON_PX + 8}px`,
            height: `${ICON_PX + 8}px`,
            margin: "-4px -3px -4px 0",
            borderRadius: "999px",
            background: "rgba(143, 214, 148, 0.22)",
            textDecoration: "none"
        });
        name.append(nameText, talk);
        // Its rhythm (lane ark-sd-align): a small dot before its name, in rhythm with its kind's System Dynamics (green),
        // slightly off (amber), out of rhythm (red); the card says it in words. None until it is worked out.
        const head = document.createElement("div");
        Object.assign(head.style, {display: "none", alignItems: "center", gap: "4px"});
        const dot = document.createElement("span");
        dot.dataset.arkRhythm = "";
        Object.assign(dot.style, {display: "none", flex: "0 0 auto", width: "6px", height: "6px", borderRadius: "999px"});
        head.append(dot, name);
        el.appendChild(head);
        this.head = head;
        this.dot = dot;
        this.name = name;
        this.nameText = nameText;
        this.talk = talk;
        // Who brought it, under the name.
        const byline = document.createElement("div");
        byline.dataset.arkBarsBy = "";
        byline.dir = "auto";
        Object.assign(byline.style, {...line, display: "none", font: `500 ${ICON_PX}px/1.2 ${FONT}`, color: "rgba(255, 252, 244, 0.78)", marginTop: "-2px", paddingBottom: "1px"});
        el.appendChild(byline);
        this.byline = byline;
        for (const link of [talk]) this.guard(link, "talk");
        for (const key of KEYS) {
            const row = document.createElement("div");
            row.setAttribute("aria-hidden", "true");
            Object.assign(row.style, {display: "none", alignItems: "center", gap: "5px"});
            const icon = document.createElement("span");
            icon.innerHTML = `<svg viewBox="0 0 24 24" width="${ICON_PX}" height="${ICON_PX}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICON[key]}</svg>`;
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
        const hearts = document.createElement("div");
        hearts.dataset.arkHearts = "";
        Object.assign(hearts.style, {display: "none", alignItems: "center", gap: "2px", paddingTop: "1px", color: "#ff8f8f"});
        el.appendChild(hearts);
        this.hearts = hearts;
        // The pointer down to the animal.
        const tick = document.createElement("span");
        tick.setAttribute("aria-hidden", "true");
        Object.assign(tick.style, {position: "absolute", left: "50%", bottom: "-5px", width: "8px", height: "8px", marginLeft: "-4px", transform: "rotate(45deg)", background: "rgba(14, 20, 14, 0.72)", borderRight: "1px solid rgba(255, 255, 255, 0.18)", borderBottom: "1px solid rgba(255, 255, 255, 0.18)"});
        el.appendChild(tick);
        layer.appendChild(el);
        this.el = el;
        this.live(false);
    }

    setReducedMotion(reduced: boolean) {
        this.reducedMotion = reduced;
        this.el.style.transition = reduced ? "none" : "opacity 220ms ease";
    }

    /** A link of the box: its own taps (never the camera's), and the host's say on what a tap does. */
    private guard(link: HTMLAnchorElement, kind: "talk" | "profile") {
        const stop = (event: Event) => event.stopPropagation();
        link.addEventListener("pointerdown", stop);
        link.addEventListener("pointerup", stop);
        link.addEventListener("dblclick", stop);
        link.addEventListener("keydown", stop);
        link.addEventListener("click", (event) => {
            event.stopPropagation();
            const told = this.links[kind];
            if (told && this.onLink?.(told)) event.preventDefault();
        });
    }

    /** The links take taps and focus only while the box shows. */
    private live(on: boolean) {
        for (const link of Array.from(this.el.querySelectorAll("a"))) {
            link.tabIndex = on ? 0 : -1;
            link.style.pointerEvents = on ? "auto" : "none";
        }
    }

    private setByline(byline: ArkSelectionByline | null) {
        const key = byline ? (byline.kind === "founder" ? `f|${byline.template}|${byline.handle}|${byline.href}` : `t|${byline.text}`) : "";
        if (this.byline.dataset.key === key) return;
        this.byline.dataset.key = key;
        this.byline.replaceChildren();
        this.links.profile = null;
        this.byline.style.display = byline ? "block" : "none";
        if (!byline) return;
        if (byline.kind === "text") {
            this.byline.textContent = byline.text;
            return;
        }
        const [before, after] = bylineParts(byline.template);
        const link = document.createElement("a");
        link.href = byline.href;
        link.textContent = `@${byline.handle}`;
        link.dir = "ltr";
        link.dataset.arkBarsProfile = byline.handle;
        Object.assign(link.style, LINK_STYLE, {pointerEvents: this.shown ? "auto" : "none"});
        link.tabIndex = this.shown ? 0 : -1;
        this.guard(link, "profile");
        this.links.profile = {kind: "profile", handle: byline.handle};
        this.byline.append(before, link, after);
    }

    /**
     * The selected animal's bars and its species' name (never a nickname), or null (nothing selected, or nothing to
     * show); `extras`, who brought it and its Talk link (section 1 and 3 of the capture media contract).
     */
    set(bars: ArkStatusBars | null, name: string | null = null, extras: ArkSelectionExtras | null = null, ids: {animalId: string; slug: string} | null = null, rhythm: SdRhythmState | null = null, hearts: number | null = null) {
        this.any = false;
        this.setHearts(hearts);
        const label = name?.trim() || "";
        if (this.nameText.textContent !== label) this.nameText.textContent = label;
        this.name.style.display = label ? "flex" : "none";
        this.dot.style.display = rhythm ? "inline-block" : "none";
        this.dot.dataset.arkRhythm = rhythm ?? "";
        if (rhythm) this.dot.style.background = RHYTHM[rhythm];
        this.head.style.display = label || rhythm ? "flex" : "none";
        const talk = label && extras?.talk && ids ? extras.talk : null;
        this.talk.style.display = talk ? "inline-flex" : "none";
        this.links.talk = talk && ids ? {kind: "talk", slug: ids.slug, animalId: ids.animalId} : null;
        if (talk) {
            if (this.talk.getAttribute("href") !== talk.href) this.talk.href = talk.href;
            this.talk.setAttribute("aria-label", talk.label);
            this.talk.title = talk.label;
        }
        this.setByline(extras?.byline ?? null);
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

    /** Its hearts row (0..3 filled of 3), or none. Pure DOM; the markup is built once per count. */
    private setHearts(hearts: number | null) {
        const n = typeof hearts === "number" && Number.isFinite(hearts) ? Math.min(Math.max(Math.round(hearts), 0), ARK_BAR_HEARTS) : null;
        if (n === this.heartsShown) return;
        this.heartsShown = n;
        this.size = null;
        if (n === null) {
            this.hearts.style.display = "none";
            this.hearts.replaceChildren();
            return;
        }
        this.hearts.innerHTML = arkBarHeartsMarkup(n);
        this.hearts.dataset.arkHearts = String(n);
        this.hearts.style.display = "flex";
    }

    /** Over the point above its head (CSS px in the view), kept inside the view; hidden when it is out of sight. */
    place(x: number, y: number, visible: boolean, view: {width: number; height: number}) {
        if (!visible || !this.any) return this.hide();
        if (!this.size) {
            const box = this.el.getBoundingClientRect();
            this.size = {w: box.width || 76, h: box.height || 30};
        }
        const {w, h} = this.size;
        // Clear of what the host draws over the top of the view (`--ark-inset-top`, the iOS panel's title), and of the
        // chips over it: close up on an animal near the top, the bars slid under the "aboard" chip.
        const chips = this.measureChips();
        const at = clearOfBoxes(
            {left: Math.min(Math.max(x - w / 2, EDGE), Math.max(view.width - w - EDGE, EDGE)), top: Math.min(Math.max(y - h - 9, EDGE + chips.top), Math.max(view.height - h - EDGE, EDGE))},
            {w, h},
            chips.boxes,
            view
        );
        this.el.style.transform = `translate(${at.left.toFixed(1)}px, ${at.top.toFixed(1)}px)`;
        if (!this.shown) {
            this.shown = true;
            this.el.style.opacity = "1";
            this.live(true);
        }
    }

    /** The chips and buttons over the view now (measured a few times a second, not every frame). */
    private measureChips(): {top: number; boxes: Box[]} {
        const now = performance.now();
        if (this.chips && now - this.chips.at < CHIPS_EVERY_MS) return this.chips;
        const layer = this.el.parentElement;
        const host = layer?.parentElement;
        const boxes: Box[] = [];
        let top = 0;
        if (layer && host) {
            const origin = layer.getBoundingClientRect();
            const over: Element[] = [];
            // (Each HUD part's own pieces: its box is wider than the chip in it.)
            host.querySelectorAll("[data-ark-live]").forEach((part) => over.push(...Array.from(part.children)));
            const sound = document.getElementById("ark-sound");
            if (sound) over.push(sound);
            for (const element of over) {
                const box = element.getBoundingClientRect();
                if (box.width < 2 || box.height < 2) continue;
                boxes.push({left: box.left - origin.left - CHIP_GAP, top: box.top - origin.top - CHIP_GAP, right: box.right - origin.left + CHIP_GAP, bottom: box.bottom - origin.top + CHIP_GAP});
            }
            top = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--ark-inset-top")) || 0;
        }
        this.chips = {at: now, top, boxes};
        return this.chips;
    }

    hide() {
        if (!this.shown) return;
        this.shown = false;
        this.el.style.opacity = "0";
        this.live(false);
    }

    dispose() {
        this.el.parentElement?.remove();
    }
}
