/**
 * V1 "hunting and mating you can see" (AnimalDex docs/ark/audits/ecosystem-audit-2026-11-18.md §2.4, §5 P1-3; owner
 * decision 389): the live world's cast, the watch, and the marks, on a mounted scene. See `README.md` in this folder.
 *
 * Loaded lazily, by the live log (`live/controller.ts`) the first time it has something for it: a record that is
 * acted, a line tapped, a lone founder in the read, an open crisis. Nothing here is in the scene's own chunk, and the
 * scene knows it only through `setCast` (V2's hook).
 */

import {attachArkCast, type ArkCast} from "@/ark-scene/replay/cast";
import {planArkEventReplay, recordOfAboard, type ArkEventReplay} from "@/ark-scene/replay/event-replay";
import {ARK_SEEN_KINDS, ARK_SEEN_WATCH_BEFORE, ArkSeenCast, type ArkSeenCrisis, type ArkSeenGroup} from "@/ark-scene/seen/live-cast";
import {ARK_SEEN_ENGLISH, arkEggCountdown, arkSeenStateText, arkSeenStates, arkSeenStatesToPin, type ArkSeenState, type ArkSeenWords} from "@/ark-scene/seen/hooks";
import {startArkWatch, type ArkWatch, type ArkWatchEnd} from "@/ark-scene/seen/watch";
import {arkPinnedMs} from "@/ark-scene/shared-clock";
import {ARK_DAY_MS} from "@/lib/ark-clock";
import type {ArkSceneHandle, ArkSnapshot} from "@/ark-scene/types";

export {ARK_SEEN_KINDS} from "@/ark-scene/seen/live-cast";
export type {ArkSeenWords} from "@/ark-scene/seen/hooks";

type Row = Record<string, unknown>;

/** Rows of the acted kinds remembered (for a tapped line's plan, and an extinction's cause). */
const ROWS_KEPT = 300;
/** Act groups' animals pinned at once: the low tier's live budget is 200, and each pin is one more drawn one by one. */
const PINS_LOW = 16;
const PINS = 48;
/** Animals kept drawn for what the read says they are doing (a dozen hunters search at a time; 47 at most in the engine's simulation). */
const STATES_LOW = 12;
const STATES = 40;
/** How long after its start each kind can still be watched (s): while the layer has something to show. */
const WATCH_FOR: Record<string, number> = {mated: 20 * 60, birth: 4 * 60, death: 18 * 60, extinct: 18 * 60, meal: 12 * 60, escaped: 45};

export type ArkSeenOptions = {
    handle: ArkSceneHandle;
    /** The picture's width over its height (the world's box). */
    aspect: () => number;
    /** Where the watch's caption goes (a positioned box over the world), or null: no caption. */
    host?: HTMLElement | null;
    words?: ArkSeenWords | null;
    reducedMotion?: () => boolean;
    /** The frame clock and the next frame (the harness steps them itself). */
    now?: () => number;
    frame?: (step: () => void) => void;
    /** The clock the acts run on, ms (the shared one; the harness's). */
    epochMs?: () => number;
};

export type ArkSeen = {
    /** New rows of the public log, as read: their acts' casts are brought in (apply before feeding the layers). */
    note: (rows: readonly unknown[], snapshot: ArkSnapshot | null) => ArkSeenGroup[];
    /** Every read the page shows: the lone marks, the crisis animals still aboard, the public states. */
    snapshot: (snapshot: ArkSnapshot) => void;
    /** The crises read's answer (`/api/ark/crises`, as the server wrote it), or null: none. */
    setCrises: (raw: unknown) => void;
    setWords: (words: ArkSeenWords | null) => void;
    /**
     * A line's tap: its act watched when it can be now (under way, or about to begin); false: nothing to watch (the
     * caller's own focus). `text`: the line's own words, the caption.
     */
    watch: (eventId: string, text: string, onEnd?: (why: ArkWatchEnd) => void) => boolean;
    watching: () => string | null;
    stop: () => void;
    /** Once or twice a second: the groups whose act is over let go. */
    tick: () => void;
    /** The current watch (the harness steps and reads it). */
    current: () => ArkWatch | null;
    report: () => ReturnType<ArkSeenCast["report"]> & {rows: number; lone: number; states: number};
    dispose: () => void;
};

const STYLE = "position:absolute;z-index:6;top:calc(10px + env(safe-area-inset-top) + var(--ark-inset-top, 0px));left:50%;transform:translateX(-50%);max-width:min(86%,420px);display:flex;align-items:center;gap:8px;padding:7px 12px;border:0;border-radius:16px;background:rgba(12,20,34,.78);color:#fffcf4;font:600 12.5px/1.25 var(--font-sans, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif);text-align:start;cursor:pointer;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);pointer-events:auto";

export function attachArkSeen(options: ArkSeenOptions): ArkSeen {
    const {handle} = options;
    const cast: ArkCast = attachArkCast(handle);
    const low = (() => {
        try {
            const stats = handle.stats();
            return stats.tier === "low" || stats.lite;
        } catch {
            return false;
        }
    })();
    const seen = new ArkSeenCast(cast, {most: low ? PINS_LOW : PINS});
    // (The acts' clock is the shared one: the recorder's pin when there is one, as the scene's own world time.)
    const epochMs = options.epochMs ?? (() => arkPinnedMs() ?? Date.now());
    let rows: Row[] = [];
    let read: ArkSnapshot | null = null;
    let words: Required<ArkSeenWords> = {...ARK_SEEN_ENGLISH, ...(options.words ?? {})};
    let lone = new Set<string>();
    let states = new Map<string, ArkSeenState>();
    let crises: ArkSeenCrisis[] = [];
    let watch: ArkWatch | null = null;
    let watchKey: string | null = null;
    let caption: HTMLButtonElement | null = null;
    let disposed = false;

    /**
     * ARK-MATING-SHOWN (owner 2026-11-20): the clutches the record says were laid (`laid` rows: their parents, the
     * laying's time, `clutch.hatch_ark_day` on the Ark clock), until they hatch (a `birth` from_egg of the same parents)
     * or are due. Shown on the mother: the parent the scene draws as female, else the record's first.
     */
    const eggs = new Map<string, {parents: string[]; laidMs: number; hatchMs: number}>();
    const pairOf = (parents: unknown) => (Array.isArray(parents) ? parents.filter((p): p is string => typeof p === "string") : []);
    const noteEggs = (row: Row) => {
        const parents = pairOf(row.parents);
        if (!parents.length) return;
        const key = [...parents].sort().join("|");
        if (row.kind === "birth" && row.from_egg === true) {
            eggs.delete(key);
            return;
        }
        if (row.kind !== "laid") return;
        const clutch = row.clutch && typeof row.clutch === "object" ? row.clutch as Row : null;
        const hatch = typeof clutch?.hatch_ark_day === "number" ? clutch.hatch_ark_day : NaN;
        const laidMs = Date.parse(String(row.at));
        const start = Date.parse(read?.voyage.started_at ?? "");
        // (On the Ark clock from the voyage's start; without it, from the row's own day.)
        const hatchMs = Number.isFinite(start) ? start + hatch * ARK_DAY_MS : typeof row.ark_day === "number" ? laidMs + (hatch - row.ark_day) * ARK_DAY_MS : NaN;
        if (Number.isFinite(laidMs) && Number.isFinite(hatchMs) && hatchMs > laidMs) eggs.set(key, {parents, laidMs, hatchMs});
    };
    const eggsOf = (id: string) => {
        const now = epochMs();
        for (const [key, clutch] of Array.from(eggs)) {
            if (clutch.hatchMs <= now) {
                eggs.delete(key);
                continue;
            }
            if (!clutch.parents.includes(id)) continue;
            const female = clutch.parents.find((p) => options.handle.sexOf?.(p) === "female");
            if ((female ?? clutch.parents[0]) === id) return clutch;
        }
        return null;
    };
    cast.progress = (id) => {
        const clutch = eggs.size ? eggsOf(id) : null;
        const countdown = clutch ? arkEggCountdown(clutch.laidMs, clutch.hatchMs, epochMs(), words) : null;
        return countdown ? {share: countdown.share, label: countdown.text} : null;
    };
    /** MATE-FINDING (decision 432): the trips the record says were made to a far mate, by traveller (shown a real day). */
    const trips = new Map<string, {distance: number; atMs: number}>();
    const metres = (d: number) => String(d < 50 ? Math.max(5, Math.round(d / 5) * 5) : Math.round(d / 10) * 10);
    cast.label = (id) => {
        const band = seen.band(id);
        if (band) return words[band];
        const trip = trips.get(id);
        if (trip && epochMs() - trip.atMs < 86_400_000) return words.mateFound.replace("{distance}", metres(trip.distance));
        const state = states.get(id);
        if (state?.kind === "mate_seeking") {
            const near = handle.mateNearest?.(id);
            if (typeof near === "number" && near >= 25) return words.mateNearest.replace("{distance}", metres(near));
        }
        // (A stalker names its quarry; a wounded one's `target` is its biter, which its line does not name.)
        if (state) return arkSeenStateText(state, state.kind === "stalking" && state.target ? read?.animals.find((animal) => animal.id === state.target)?.name ?? null : null, words);
        if (lone.has(id)) return words.lone;
        return eggs.size && eggsOf(id) ? words.eggsInNest : null;
    };
    // (The label is asked whether or not anything is pinned: the cast is in the scene from the start.)
    cast.apply();

    const idOf = (row: Row) => (typeof row.id === "number" || typeof row.id === "string" ? String(row.id) : "");

    const stopWatch = (why: ArkWatchEnd) => {
        const running = watch;
        watch = null;
        if (watchKey) seen.hold(watchKey, false);
        watchKey = null;
        caption?.remove();
        caption = null;
        running?.stop(why);
    };
    const touched = (event: Event) => {
        if (watch && event.target instanceof HTMLCanvasElement) stopWatch("touched");
    };
    if (typeof window !== "undefined") {
        window.addEventListener("pointerdown", touched, true);
        window.addEventListener("wheel", touched, {capture: true, passive: true});
    }

    const applyStates = () => {
        if (!read) return;
        const list = arkSeenStates(read);
        states = new Map(list.map((state) => [state.id, state]));
        const aboard = new Map(read.animals.map((animal) => [animal.id, animal]));
        const ids = new Set<string>();
        // (The wounded, the stalking, the searching, in that order; the mate-seeking only have their line.)
        for (const state of arkSeenStatesToPin(list, low ? STATES_LOW : STATES)) {
            ids.add(state.id);
            if (state.target && aboard.has(state.target)) ids.add(state.target);
        }
        seen.pin("states", Array.from(ids).filter((id) => aboard.has(id)).map((id) => recordOfAboard(aboard.get(id)!)));
        handle.setWounded?.(list.filter((state) => state.kind === "wounded").map((state) => ({id: state.id, since: state.since ?? epochMs() / 1000})));
    };

    return {
        note: (incoming, snapshot) => {
            if (snapshot) read = snapshot;
            const fresh: Row[] = [];
            const known = new Set(rows.map(idOf));
            for (const item of incoming) {
                const row = item && typeof item === "object" && !Array.isArray(item) ? item as Row : null;
                if (row && (row.kind === "laid" || row.kind === "birth")) noteEggs(row);
                if (row && row.kind === "mate_found") {
                    const animal = row.animal && typeof row.animal === "object" ? row.animal as Row : null;
                    const journey = row.journey && typeof row.journey === "object" ? row.journey as Row : null;
                    const at = Date.parse(String(row.at));
                    if (typeof animal?.id === "string" && typeof journey?.distance === "number" && Number.isFinite(at)) trips.set(animal.id, {distance: journey.distance, atMs: at});
                }
                if (!row || typeof row.kind !== "string" || !ARK_SEEN_KINDS.has(row.kind) || !idOf(row) || known.has(idOf(row))) continue;
                known.add(idOf(row));
                fresh.push(row);
            }
            if (!fresh.length) return [];
            rows = rows.concat(fresh).slice(-ROWS_KEPT);
            const now = epochMs();
            const groups: ArkSeenGroup[] = [];
            for (const row of fresh) {
                const group = seen.note(idOf(row), rows, read, now);
                if (group && !groups.includes(group)) groups.push(group);
            }
            seen.apply();
            return groups;
        },
        snapshot: (snapshot) => {
            read = snapshot;
            lone = new Set(snapshot.animals.filter((animal) => animal.lone === true).map((animal) => animal.id));
            seen.setCrises(crises, snapshot);
            applyStates();
            seen.apply();
        },
        setCrises: (raw) => {
            const list = raw && typeof raw === "object" && Array.isArray((raw as {crises?: unknown}).crises) ? (raw as {crises: unknown[]}).crises : [];
            crises = [];
            for (const item of list) {
                const row = item && typeof item === "object" ? item as Row : null;
                // (The contract, `crises-api-contract.md`: open ones only; `critical` is two left, `last` one.)
                if (!row || row.status !== "open" || (row.band !== "critical" && row.band !== "last") || typeof row.id !== "string") continue;
                const animals = Array.isArray(row.last_animal_ids) ? row.last_animal_ids.filter((id): id is string => typeof id === "string").slice(0, 2) : [];
                if (animals.length) crises.push({id: row.id, band: row.band, animals});
            }
            seen.setCrises(crises, read);
            seen.apply();
        },
        setWords: (next) => {
            words = {...ARK_SEEN_ENGLISH, ...(next ?? {})};
        },
        watch: (eventId, text, onEnd) => {
            if (disposed || options.reducedMotion?.()) return false;
            const now = epochMs();
            let plan: ArkEventReplay;
            try {
                plan = planArkEventReplay(eventId, rows, read, {now});
            } catch {
                return false;
            }
            if (plan.provisional) return false;
            const since = now / 1000 - plan.t0;
            if (since < -ARK_SEEN_WATCH_BEFORE || since > (WATCH_FOR[plan.kind] ?? 0)) return false;
            if (!plan.cast.length) return false;
            stopWatch("replaced");
            // (Everyone it names in the scene: its group is brought again if its time had let it go.)
            const group = seen.note(eventId, rows, read, now);
            watchKey = group?.key ?? null;
            if (watchKey) seen.hold(watchKey, true);
            seen.apply();
            if (options.host && text) {
                caption = document.createElement("button");
                caption.type = "button";
                caption.dataset.arkWatch = plan.kind;
                caption.style.cssText = STYLE;
                caption.dir = "auto";
                caption.textContent = text;
                caption.setAttribute("aria-label", text);
                caption.addEventListener("click", () => stopWatch("touched"));
                options.host.appendChild(caption);
            }
            const started = startArkWatch({
                handle,
                cast,
                replay: plan,
                aspect: options.aspect,
                now: options.now,
                frame: options.frame,
                onEnd: (why) => {
                    if (watch === started) {
                        watch = null;
                        if (watchKey) seen.hold(watchKey, false);
                        watchKey = null;
                        caption?.remove();
                        caption = null;
                    }
                    onEnd?.(why);
                }
            });
            watch = started;
            return true;
        },
        watching: () => (watch?.running() ? watch.eventId : null),
        stop: () => stopWatch("touched"),
        tick: () => {
            seen.step(epochMs());
            seen.apply();
        },
        current: () => watch,
        report: () => ({...seen.report(), rows: rows.length, lone: lone.size, states: states.size}),
        dispose: () => {
            disposed = true;
            stopWatch("disposed");
            if (typeof window !== "undefined") {
                window.removeEventListener("pointerdown", touched, true);
                window.removeEventListener("wheel", touched, true);
            }
            cast.detach();
        }
    };
}
