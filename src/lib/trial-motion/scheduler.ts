/**
 * Never more than two Trial Loops running at once, page-wide. Every loop on
 * screen registers here; the two most visible (ties broken by page order) run
 * and the rest hold their poster frame. Nothing runs while the tab is hidden.
 */

export const MAX_RUNNING_TRIAL_LOOPS = 2;

type Entry = {
    element: Element;
    ratio: number;
    setRunning: (running: boolean) => void;
    running: boolean;
};

const entries = new Set<Entry>();
let observer: IntersectionObserver | null = null;
const byElement = new Map<Element, Entry>();
let listening = false;

/** Which loops run, given what is visible. Exported for tests. */
export function pickRunning<T extends {ratio: number; order: number}>(candidates: T[], max = MAX_RUNNING_TRIAL_LOOPS): T[] {
    return candidates
        .filter((candidate) => candidate.ratio > 0)
        .sort((left, right) => right.ratio - left.ratio || left.order - right.order)
        .slice(0, max);
}

function documentOrder(left: Element, right: Element) {
    if (left === right) return 0;
    return left.compareDocumentPosition(right) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
}

function recompute() {
    const hidden = typeof document !== "undefined" && document.visibilityState === "hidden";
    const list = Array.from(entries).sort((left, right) => documentOrder(left.element, right.element));
    const chosen = new Set(hidden ? [] : pickRunning(list.map((entry, order) => ({entry, ratio: entry.ratio, order}))).map((item) => item.entry));
    for (const entry of list) {
        const running = chosen.has(entry);
        if (running !== entry.running) {
            entry.running = running;
            entry.setRunning(running);
        }
    }
}

function ensureObserver() {
    if (!observer) {
        observer = new IntersectionObserver((records) => {
            for (const record of records) {
                const entry = byElement.get(record.target);
                if (entry) entry.ratio = record.isIntersecting ? Math.max(record.intersectionRatio, 0.001) : 0;
            }
            recompute();
        }, {threshold: [0, 0.15, 0.35, 0.55, 0.75, 1]});
    }
    if (!listening) {
        document.addEventListener("visibilitychange", recompute);
        listening = true;
    }
    return observer;
}

/** Registers a loop; `setRunning` is told when it may animate. Returns the unregister function. */
export function registerTrialLoop(element: Element, setRunning: (running: boolean) => void) {
    if (typeof IntersectionObserver === "undefined") return () => undefined;
    const entry: Entry = {element, ratio: 0, setRunning, running: false};
    entries.add(entry);
    byElement.set(element, entry);
    ensureObserver().observe(element);
    return () => {
        entries.delete(entry);
        byElement.delete(element);
        observer?.unobserve(element);
        if (entry.running) setRunning(false);
        recompute();
    };
}
