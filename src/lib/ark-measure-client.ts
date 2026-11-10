/**
 * The browser half of measuring the Ark (lib/ark-measure): every event goes
 * to GA4 (lib/analytics, as the rest of the site's events) and to
 * /api/ark-events, which keeps it for /admin/metrics. Arrivals seen go to the
 * server too, through /api/ark/seen, so they can be joined to the arrival.
 *
 * Browser-only; every call is a no-op on the server, and nothing here ever
 * throws into the page.
 */

import {trackEvent} from "@/lib/analytics";
import {arkMeasureProps, type ArkMeasureEvent, type ArkMeasureProps, type ArkSource} from "@/lib/ark-measure";

export const ARK_EVENTS_ENDPOINT = "/api/ark-events";
const ARRIVAL_SEEN_ENDPOINT = "/api/ark/seen";
/** The animals of this reader's that the server has already recorded as seen. */
const SEEN_KEY = "animaldex:ark:arrivals-seen";

function inBrowser() {
    return typeof window !== "undefined" && typeof document !== "undefined";
}

function send(body: string) {
    // A beacon outlives the page: a session's seconds are sent as the tab closes.
    try {
        if (typeof navigator.sendBeacon === "function" && navigator.sendBeacon(ARK_EVENTS_ENDPOINT, new Blob([body], {type: "application/json"}))) return;
    } catch {
        // Fall through to fetch.
    }
    void fetch(ARK_EVENTS_ENDPOINT, {method: "POST", headers: {"Content-Type": "application/json"}, body, keepalive: true}).catch(() => undefined);
}

/** One Ark event, with only the properties it may carry (lib/ark-measure); dropped when one it needs is missing. */
export function trackArk(event: ArkMeasureEvent, props: ArkMeasureProps = {}) {
    if (!inBrowser()) return;
    try {
        const clean = arkMeasureProps(event, props as Record<string, unknown>);
        if (!clean) return;
        trackEvent(event, clean);
        // Automated browsers (tests, previews) never reach the dashboard.
        if (navigator.webdriver) return;
        send(JSON.stringify({event, props: clean}));
    } catch {
        // Telemetry never breaks the Ark.
    }
}

/**
 * One visit to an Ark surface: `ark_open` now, and `ark_session_seconds`
 * (the time it was on screen, the tab in front) once, when it closes or the
 * tab goes away. Returns the stop.
 */
export function startArkSession(source: ArkSource): () => void {
    if (!inBrowser()) return () => undefined;
    trackArk("ark_open", {source});
    let shownMs = 0;
    let since: number | null = document.visibilityState === "visible" ? performance.now() : null;
    let ended = false;
    const pause = () => {
        if (since !== null) shownMs += performance.now() - since;
        since = null;
    };
    const onVisibility = () => {
        if (document.visibilityState === "visible") since ??= performance.now();
        else pause();
    };
    const end = () => {
        if (ended) return;
        ended = true;
        pause();
        document.removeEventListener("visibilitychange", onVisibility);
        window.removeEventListener("pagehide", end);
        const seconds = Math.round(shownMs / 1000);
        if (seconds >= 1) trackArk("ark_session_seconds", {source, seconds});
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", end);
    return end;
}

function readSeen(): Set<string> {
    try {
        const stored = JSON.parse(window.localStorage.getItem(SEEN_KEY) ?? "[]") as unknown;
        return new Set(Array.isArray(stored) ? stored.filter((id): id is string => typeof id === "string") : []);
    } catch {
        return new Set();
    }
}

function writeSeen(seen: Set<string>) {
    try {
        // The newest few hundred are plenty: the server keeps the truth.
        window.localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(seen).slice(-400)));
    } catch {
        // Asked again on the next visit; the server keeps only the first.
    }
}

let pending = false;

/**
 * An Ark surface is showing the reader's own animals (`mine` in the
 * snapshot): the ones not yet recorded go to /api/ark/seen, and each one the
 * server saw for the first time is an `ark_arrival_seen`. Remembered here only once the server
 * has recorded them, so nothing is lost before the migration is applied.
 */
export function noteArkArrivalsSeen(animals: Array<{id: string; species_profile_id: string; mine: boolean}>, source: ArkSource) {
    if (!inBrowser() || pending) return;
    const seen = readSeen();
    const fresh = animals.filter((animal) => animal.mine && !animal.id.startsWith("visitor:") && !seen.has(animal.id));
    if (!fresh.length) return;
    pending = true;
    void fetch(ARRIVAL_SEEN_ENDPOINT, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        credentials: "same-origin",
        body: JSON.stringify({animal_ids: fresh.slice(0, 200).map((animal) => animal.id), surface: source})
    })
        .then((response) => (response.ok ? response.json() : null))
        .then((body: {recorded?: boolean; firstSeen?: unknown} | null) => {
            if (!body?.recorded) return;
            for (const animal of fresh) seen.add(animal.id);
            writeSeen(seen);
            // Only the ones the server saw for the first time: a cleared browser never counts one twice.
            const first = new Set(Array.isArray(body.firstSeen) ? body.firstSeen : []);
            for (const animal of fresh) {
                if (first.has(animal.id.toLowerCase())) trackArk("ark_arrival_seen", {source, species_profile_id: animal.species_profile_id});
            }
        })
        .catch(() => undefined)
        .finally(() => {
            pending = false;
        });
}
