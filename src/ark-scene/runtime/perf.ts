/**
 * The Ark's frame profiler and its real-phone overlay (mobile performance lane, docs/ark/perf-audit-mobile-2026-11.md).
 *
 * Off unless asked: `?perf=1` on /ark, `/ark/embed.html` or the measurement page (or `window.__arkPerf = true` before
 * the mount), remembered on the device until `?perf=0`; or, where the address cannot be changed (the apps' Ark panel),
 * five quick taps on the world's top-left corner turn it on (and off again), remembered the same way. Off, every call is
 * one early return and nothing is drawn or kept. On:
 *
 * - **Sections**: the frame loop marks where its time goes (`lap`: the time since the last mark goes to that section;
 *   `carve`: time measured inside a later section, moved out of it), summed over the last 120 drawn frames.
 * - **Frames**: the interval between drawn frames and each frame's own main-thread time, the last 240, as p50 / p95 /
 *   p99 and the share over 16.7 and 33 ms.
 * - **The overlay**: a small block in the world's top-left corner, rewritten twice a second, that a reader can read
 *   numbers off on their own phone (fps, frame-time p95, draw calls, triangles, heap, tier, DPR, animals drawn and
 *   rigged, and the costliest sections). Plain DOM, no dependency.
 * - `window.__arkPerfReport()`: the same numbers as data (the measurement harness reads it).
 */

/** Where a frame's main-thread time goes. */
export const ARK_PERF_SECTIONS = [
    "world",
    "town",
    "camera",
    "stream",
    "scenery",
    "resting",
    "schedule",
    "collide",
    "animals",
    "reactive",
    "apart",
    "rigs",
    "locomotion",
    "instances",
    "herds",
    "particles",
    "recipes",
    "plants",
    "render",
    "labels",
    "runtime"
] as const;
export type ArkPerfSection = (typeof ARK_PERF_SECTIONS)[number];

const WINDOW = 120;
const FRAMES = 240;

export type ArkPerfGpu = {calls: number; triangles: number; programs: number; textures: number; geometries: number};

export type ArkPerfReport = {
    frames: number;
    fps: number;
    interval: {p50: number; p95: number; p99: number; over16: number; over33: number};
    cpu: {p50: number; p95: number; p99: number; mean: number};
    sections: Partial<Record<ArkPerfSection, number>>;
    gpu: ArkPerfGpu;
    heapMB: number | null;
    tier: string;
    dpr: number;
    scale: number;
    drawn: number;
    rigged: number;
    mode: string;
    /** Renders of the page's React overlay (the /ark page counts them: `arkPerfCountRender`). */
    hudRenders: number;
    /** When (ms from the navigation) the view was first complete: the behaviour world built and the view's models in. */
    inViewAt: number | null;
};

/** What the scene hands the overlay each time it is rewritten. */
export type ArkPerfScene = {gpu: ArkPerfGpu; tier: string; dpr: number; scale: number; drawn: number; rigged: number; mode: string; inView: boolean};

const STORAGE_KEY = "ark:perf";

function remember(on: boolean) {
    try {
        if (on) window.localStorage.setItem(STORAGE_KEY, "1");
        else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
        // No storage (a private window): for this page only.
    }
}

/** Whether the profiler is on for this page: `?perf=1` / `?perf=0` (remembered), `window.__arkPerf = true`, or remembered. */
export function arkPerfAsked(): boolean {
    if (typeof window === "undefined") return false;
    const g = globalThis as {__arkPerf?: unknown};
    if (g.__arkPerf === true) return true;
    try {
        const asked = new URLSearchParams(window.location?.search ?? "").get("perf");
        if (asked === "1" || asked === "0") {
            remember(asked === "1");
            return asked === "1";
        }
        return window.localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
        return false;
    }
}

/** Five taps within this long on the corner turn the profiler on or off. */
const TAPS = 5;
const TAPS_WITHIN_MS = 3000;
/** The corner (CSS px from the world's top-left, below what the host draws over its top: `--ark-inset-top`). */
const CORNER_PX = 64;

/** The /ark page's React overlay counts its renders here (only while the profiler is on). */
export function arkPerfCountRender(): void {
    const g = globalThis as {__arkPerfRenders?: number};
    g.__arkPerfRenders = (g.__arkPerfRenders ?? 0) + 1;
}

const percentile = (sorted: Float64Array, q: number) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] : 0);
const round1 = (value: number) => Math.round(value * 10) / 10;

export class ArkPerf {
    on: boolean;
    private last = 0;
    private debt = 0;
    private readonly now = new Float64Array(ARK_PERF_SECTIONS.length);
    private readonly ring = new Float64Array(ARK_PERF_SECTIONS.length * WINDOW);
    private ringAt = 0;
    private ringFilled = 0;
    private readonly intervals = new Float64Array(FRAMES);
    private readonly cpu = new Float64Array(FRAMES);
    private frameAt = 0;
    private frameFilled = 0;
    private lastStart = 0;
    private overlay: HTMLDivElement | null = null;
    private overlayAt = 0;
    private scene: (() => ArkPerfScene) | null = null;
    private inViewAt: number | null = null;
    private rendersAt = {t: 0, n: 0, rate: 0};
    private readonly index = new Map<ArkPerfSection, number>(ARK_PERF_SECTIONS.map((name, i) => [name, i]));
    private el: HTMLElement | null = null;
    private taps: number[] = [];
    private readonly onTap = (event: PointerEvent) => {
        const el = this.el;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const inset = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--ark-inset-top")) || 0;
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top - inset;
        if (x < 0 || y < 0 || x > CORNER_PX || y > CORNER_PX) {
            this.taps = [];
            return;
        }
        const now = performance.now();
        this.taps = this.taps.filter((at) => now - at < TAPS_WITHIN_MS);
        this.taps.push(now);
        if (this.taps.length < TAPS) return;
        this.taps = [];
        this.setOn(!this.on);
        remember(this.on);
    };

    constructor(on: boolean) {
        this.on = on;
    }

    /** The overlay inside the world's element (when on); `scene` is asked for its numbers when it is rewritten. */
    attach(el: HTMLElement, scene: () => ArkPerfScene) {
        this.el = el;
        this.scene = scene;
        el.addEventListener("pointerdown", this.onTap, {capture: true, passive: true});
        if (this.on) this.show();
    }

    /** On or off from now (the corner's taps). */
    setOn(on: boolean) {
        if (on === this.on) return;
        this.on = on;
        if (on) {
            this.ringFilled = 0;
            this.frameFilled = 0;
            this.lastStart = 0;
            this.show();
        } else {
            this.overlay?.remove();
            this.overlay = null;
        }
    }

    private show() {
        const el = this.el;
        if (!el || this.overlay) return;
        const box = document.createElement("div");
        box.setAttribute("aria-hidden", "true");
        box.dataset.arkPerf = "1";
        Object.assign(box.style, {
            position: "absolute",
            left: "calc(6px + env(safe-area-inset-left, 0px))",
            top: "calc(6px + env(safe-area-inset-top, 0px) + var(--ark-inset-top, 0px))",
            zIndex: "40",
            pointerEvents: "none",
            font: "10px/1.35 ui-monospace, SFMono-Regular, Menlo, monospace",
            color: "#fff",
            background: "rgba(0, 0, 0, 0.62)",
            padding: "4px 6px",
            borderRadius: "4px",
            whiteSpace: "pre",
            maxWidth: "calc(100% - 12px)",
            overflow: "hidden"
        });
        el.appendChild(box);
        this.overlay = box;
        (globalThis as {__arkPerfReport?: () => ArkPerfReport}).__arkPerfReport = () => this.report();
    }

    /** The top of a drawn frame. */
    begin(startedAt: number) {
        if (!this.on) return;
        this.now.fill(0);
        this.last = startedAt;
        this.debt = 0;
        if (this.lastStart) {
            const interval = startedAt - this.lastStart;
            if (interval < 2000) this.intervals[this.frameAt] = interval;
            else this.intervals[this.frameAt] = NaN;
        } else this.intervals[this.frameAt] = NaN;
        this.lastStart = startedAt;
    }

    /** The time since the last mark goes to `section` (less any time carved out of it meanwhile). */
    lap(section: ArkPerfSection) {
        if (!this.on) return;
        const t = performance.now();
        this.now[this.index.get(section)!] += Math.max(t - this.last - this.debt, 0);
        this.last = t;
        this.debt = 0;
    }

    /** `ms` measured inside the section the next `lap` closes, given to `section` instead. */
    carve(section: ArkPerfSection, ms: number) {
        if (!this.on || !(ms > 0)) return;
        this.now[this.index.get(section)!] += ms;
        this.debt += ms;
    }

    /** The bottom of a drawn frame: its main-thread time (`spent`). */
    end(spent: number) {
        if (!this.on) return;
        this.ring.set(this.now, this.ringAt * ARK_PERF_SECTIONS.length);
        this.ringAt = (this.ringAt + 1) % WINDOW;
        this.ringFilled = Math.min(this.ringFilled + 1, WINDOW);
        this.cpu[this.frameAt] = spent;
        this.frameAt = (this.frameAt + 1) % FRAMES;
        this.frameFilled = Math.min(this.frameFilled + 1, FRAMES);
        const t = performance.now();
        if (this.overlay && t - this.overlayAt > 500) {
            this.overlayAt = t;
            this.overlay.textContent = this.text(this.report());
        }
    }

    report(): ArkPerfReport {
        const n = this.frameFilled;
        const intervals = Array.from(this.intervals.subarray(0, n)).filter((v) => Number.isFinite(v));
        const sortedIntervals = Float64Array.from(intervals).sort();
        const sortedCpu = Float64Array.from(this.cpu.subarray(0, n)).sort();
        const meanInterval = intervals.length ? intervals.reduce((s, v) => s + v, 0) / intervals.length : 0;
        const sections: Partial<Record<ArkPerfSection, number>> = {};
        const frames = this.ringFilled;
        ARK_PERF_SECTIONS.forEach((name, i) => {
            let sum = 0;
            for (let k = 0; k < frames; k++) sum += this.ring[k * ARK_PERF_SECTIONS.length + i];
            const ms = frames ? sum / frames : 0;
            if (ms >= 0.005) sections[name] = Math.round(ms * 100) / 100;
        });
        const scene = this.scene?.() ?? {gpu: {calls: 0, triangles: 0, programs: 0, textures: 0, geometries: 0}, tier: "-", dpr: 0, scale: 1, drawn: 0, rigged: 0, mode: "-", inView: false};
        if (scene.inView && this.inViewAt === null) this.inViewAt = Math.round(performance.now());
        const heap = (performance as Performance & {memory?: {usedJSHeapSize?: number}}).memory?.usedJSHeapSize;
        return {
            frames: n,
            fps: meanInterval ? round1(1000 / meanInterval) : 0,
            interval: {
                p50: round1(percentile(sortedIntervals, 0.5)),
                p95: round1(percentile(sortedIntervals, 0.95)),
                p99: round1(percentile(sortedIntervals, 0.99)),
                over16: intervals.length ? round1((intervals.filter((v) => v > 16.7 + 1).length / intervals.length) * 100) : 0,
                over33: intervals.length ? round1((intervals.filter((v) => v > 33.4 + 1).length / intervals.length) * 100) : 0
            },
            cpu: {p50: round1(percentile(sortedCpu, 0.5)), p95: round1(percentile(sortedCpu, 0.95)), p99: round1(percentile(sortedCpu, 0.99)), mean: n ? round1(sortedCpu.reduce((s, v) => s + v, 0) / n) : 0},
            sections,
            gpu: scene.gpu,
            heapMB: typeof heap === "number" ? Math.round(heap / 2 ** 20) : null,
            tier: scene.tier,
            dpr: Math.round(scene.dpr * 100) / 100,
            scale: Math.round(scene.scale * 100) / 100,
            drawn: scene.drawn,
            rigged: scene.rigged,
            mode: scene.mode,
            hudRenders: (globalThis as {__arkPerfRenders?: number}).__arkPerfRenders ?? 0,
            inViewAt: this.inViewAt
        };
    }

    private text(r: ArkPerfReport): string {
        const top = Object.entries(r.sections)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6)
            .map(([name, ms]) => `${name} ${ms.toFixed(1)}`)
            .join("  ");
        const tris = r.gpu.triangles >= 1e6 ? `${(r.gpu.triangles / 1e6).toFixed(2)}M` : `${Math.round(r.gpu.triangles / 1000)}k`;
        return [
            `${r.fps} fps  p95 ${r.interval.p95} ms  >33ms ${r.interval.over33}%  cpu ${r.cpu.p50}/${r.cpu.p95} ms`,
            `${r.tier} ${r.mode}  dpr ${r.dpr}${r.scale < 0.999 ? ` x${r.scale}` : ""}  calls ${r.gpu.calls}  tris ${tris}  prog ${r.gpu.programs}  tex ${r.gpu.textures}`,
            `heap ${r.heapMB ?? "n/a"} MB  animals ${r.drawn}  rigged ${r.rigged}  hud ${this.renderRate(r.hudRenders)}/s`,
            top
        ].join("\n");
    }

    /** The React overlay's renders a second, between two rewrites of the overlay. */
    private renderRate(count: number): number {
        const t = performance.now();
        const dt = (t - this.rendersAt.t) / 1000;
        if (dt >= 0.4) {
            this.rendersAt = {t, n: count, rate: this.rendersAt.t ? Math.round(((count - this.rendersAt.n) / dt) * 10) / 10 : 0};
        }
        return this.rendersAt.rate;
    }

    dispose() {
        this.el?.removeEventListener("pointerdown", this.onTap, {capture: true});
        this.el = null;
        this.overlay?.remove();
        this.overlay = null;
        this.scene = null;
    }
}
