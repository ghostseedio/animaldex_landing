/**
 * The runtime's two bits of interface inside the world (runtime lane): a quiet loading bar and the reset button.
 * Plain DOM over the canvas, like the scene's labels, so the web page and the apps' WebView get the same.
 *
 * - The bar: 2 px at the foot of the world, the share of what was asked for that is in; it fades in only if
 *   loading lasts more than a moment, and out when everything asked for is in. No words, nothing to read.
 * - The reset button: round, at the foot of the world's end side (above a tap band), shown once the reader has
 *   moved away from the whole-island view; it flies back to it. Its accessible name is the page's (`resetLabel`).
 *
 * Neither is shown in a recording (marketing clips, golden shots).
 */

const RESET_ICON = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none"/></svg>`;

export type RuntimeUiOptions = {
    /** The reset button's accessible name (and tooltip), in the page's language. Default English. */
    resetLabel?: string;
    /** Show the reset button (default true; a host with its own can turn it off). */
    resetButton?: boolean;
    /** Show the quiet loading bar (default true). */
    loadingBar?: boolean;
    reducedMotion: boolean;
};

export class RuntimeUi {
    private readonly bar: HTMLDivElement | null = null;
    private readonly fill: HTMLDivElement | null = null;
    private readonly button: HTMLButtonElement | null = null;
    private barShown = false;
    private loadingSince = 0;
    private buttonShown = false;
    private inset = 0;

    constructor(private readonly el: HTMLElement, options: RuntimeUiOptions, onReset: () => void) {
        const transition = options.reducedMotion ? "none" : "opacity 400ms ease";
        if (options.loadingBar !== false) {
            const bar = document.createElement("div");
            bar.setAttribute("aria-hidden", "true");
            bar.dataset.arkRuntime = "loading";
            Object.assign(bar.style, {position: "absolute", left: "0", right: "0", bottom: "0", height: "2px", pointerEvents: "none", opacity: "0", transition, background: "rgba(255, 252, 244, 0.18)", overflow: "hidden", zIndex: "0"});
            const fill = document.createElement("div");
            Object.assign(fill.style, {height: "100%", width: "0%", background: "rgba(255, 252, 244, 0.85)", transition: options.reducedMotion ? "none" : "width 300ms ease", boxShadow: "0 0 6px rgba(255, 252, 244, 0.6)"});
            bar.appendChild(fill);
            el.appendChild(bar);
            this.bar = bar;
            this.fill = fill;
        }
        if (options.resetButton !== false) {
            const button = document.createElement("button");
            button.type = "button";
            button.dataset.arkRuntime = "reset";
            const label = options.resetLabel || "Back to the whole Ark";
            button.setAttribute("aria-label", label);
            button.title = label;
            button.innerHTML = RESET_ICON;
            button.tabIndex = -1;
            Object.assign(button.style, {
                position: "absolute",
                insetInlineEnd: "12px",
                bottom: "12px",
                width: "40px",
                height: "40px",
                borderRadius: "999px",
                border: "1px solid rgba(255, 252, 244, 0.28)",
                background: "rgba(24, 21, 14, 0.55)",
                backdropFilter: "blur(10px)",
                webkitBackdropFilter: "blur(10px)",
                color: "rgba(255, 252, 244, 0.95)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0",
                cursor: "pointer",
                opacity: "0",
                pointerEvents: "none",
                transition,
                zIndex: "0",
                WebkitTapHighlightColor: "transparent"
            } as Partial<CSSStyleDeclaration>);
            button.addEventListener("click", (event) => {
                event.stopPropagation();
                onReset();
            });
            // Never a camera drag that starts on the button.
            button.addEventListener("pointerdown", (event) => event.stopPropagation());
            el.appendChild(button);
            this.button = button;
        }
    }

    /** `pending` levels still coming of `asked` (since the last quiet moment); `now` in seconds. */
    setLoading(pending: number, asked: number, now: number) {
        if (!this.bar || !this.fill) return;
        if (pending > 0 && !this.loadingSince) this.loadingSince = now;
        if (pending === 0) this.loadingSince = 0;
        // Only a load that lasts: a single model coming in close by does not flash a bar.
        const show = pending > 0 && now - this.loadingSince > 0.6;
        if (show !== this.barShown) {
            this.barShown = show;
            this.bar.style.opacity = show ? "1" : "0";
        }
        const share = asked > 0 ? Math.min(Math.max((asked - pending) / asked, 0.04), 1) : 1;
        this.fill.style.width = `${Math.round(share * 100)}%`;
    }

    /** Pixels at the foot covered by the page (a tap band): the button and the bar sit above them. */
    setInset(pixels: number) {
        const next = Math.round(pixels);
        if (next === this.inset) return;
        this.inset = next;
        if (this.button) this.button.style.bottom = `${12 + next}px`;
        if (this.bar) this.bar.style.bottom = `${next}px`;
    }

    setReset(show: boolean) {
        if (!this.button || show === this.buttonShown) return;
        this.buttonShown = show;
        this.button.style.opacity = show ? "1" : "0";
        this.button.style.pointerEvents = show ? "auto" : "none";
        this.button.tabIndex = show ? 0 : -1;
        if (show) this.button.removeAttribute("aria-hidden");
        else this.button.setAttribute("aria-hidden", "true");
    }

    dispose() {
        this.bar?.remove();
        this.button?.remove();
    }
}
