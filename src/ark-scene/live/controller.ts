/**
 * The live log's controller, the same on /ark and in the apps' embed: it reads what happens and puts it on the
 * log (`log-view.ts`), and a tap on a line flies the camera there.
 *
 * - **The Ark's record:** when a snapshot differs from the last (an animal came or went, a clutch was laid), it
 *   reads the server's event log since the last read (`/api/ark/events?since=`, `voyage_events_since_v1`), so a
 *   quiet Ark costs no extra request. Without that read (development's fixtures, or the read unavailable), the
 *   snapshot's newcomers stand in for it: arrivals and births only, since the snapshot can't say why one left.
 *   Development's feed hands its rows in through `events()`.
 * - **Seen:** about once a second, what the scene shows near the camera now (`ArkSceneHandle.seen`).
 * - **Now** (decision 240): the behaviour schedule's moments anywhere on the Ark (`ArkSceneHandle.happening`): at
 *   most one every few seconds, picked from the shared clock and the animals' ids, so every viewer reads the same. The
 *   record was too quiet to carry the log alone (2026-11-12: 64 events in 12 hours, 51 of them `fed`, which the log
 *   doesn't say), and seen lines need the camera within 90 m of the act.
 *
 * The record's lines also go to the scene's animal logs (`noteRecord`): a meal, young, a clutch, a pair bred.
 *
 * Nothing here decides anything about the Ark: it says what the server wrote and what the shared layers draw.
 */

import {decodeArkEvents, type ArkEvent} from "@/lib/ark-life";
import {ArkLiveLog, ArkSeenMemory, arkLiveArrivalsFromSnapshot, arkLiveLineText, arkLiveServerItems, arkNowItems, arkSeenItems, ARK_LIVE_LOG_DEFAULTS, type ArkLiveItem, type ArkLiveLine, type ArkLiveText} from "@/lib/ark-live-log";
import {ARK_LIVE_ENGLISH} from "@/lib/ark-live-words";
import {ARK_ACTIVITY_ENGLISH, arkRecordNotesFromEvents, type ArkActivityWords} from "@/lib/ark-animal-status";
import {arkPickAnimal, arkSpeciesKey} from "@/lib/ark-population";
import {hashString} from "@/ark-scene/world";
import {ZONE_REGION, type ArkSceneHandle, type ArkSnapshot} from "@/ark-scene/types";
import {ArkLiveLogView} from "@/ark-scene/live/log-view";

/** The words the log needs (the Ark's `live` and `replay`, and "Show me"), as the page or `/api/ark/words` has them. */
export type ArkLiveWordsIn = {live?: Partial<ArkLiveText["live"]> | null; replay?: Partial<ArkLiveText["replay"]> | null; showMe?: string | null; /** The schedule's moments' words (`ark.activity`). */ activity?: Partial<ArkActivityWords> | null} | null;

/** The replay's words the log borrows, in English: until (or unless) the reader's words come. */
const REPLAY_ENGLISH: ArkLiveText["replay"] = {
    a: "a {animal}",
    an: "an {animal}",
    meal: "The {predator} ate {aPrey}",
    death: "The {animal} died of old age",
    starved: "The {animal} starved",
    extinction: "The last {animal} is gone",
    laidOne: "{aAnimal} laid an egg",
    laidOther: "{aAnimal} laid {count} eggs",
    laidSome: "{aAnimal} laid a clutch of eggs"
} as ArkLiveText["replay"];

export type ArkLiveOptions = {
    /** Where the log goes: a positioned box over the world. */
    host: HTMLElement;
    scene: () => ArkSceneHandle | null;
    words: ArkLiveWordsIn;
    /** The words' language (numbers, and English names' plurals). */
    locale: string;
    /** The server's event log (`/api/ark/events`), or null: development's fixtures (newcomers, and the feed's rows). */
    eventsUrl: string | null;
    reducedMotion?: boolean;
    /** Where the log's fold is remembered (localStorage), or null for this visit only. */
    storageKey?: string | null;
    /** Folded at first when nothing is remembered. */
    collapsed?: boolean;
    /** After a line's tap flew the camera (the page brings the world into view on a phone). */
    onFocused?: (line: ArkLiveLine) => void;
};

function words(input: ArkLiveWordsIn): {text: ArkLiveText; showMe: string} {
    const activity = {...ARK_ACTIVITY_ENGLISH, ...(input?.activity ?? {}), log: {...ARK_ACTIVITY_ENGLISH.log, ...(input?.activity?.log ?? {})}} as ArkActivityWords;
    return {
        text: {live: {...ARK_LIVE_ENGLISH, ...(input?.live ?? {})}, replay: {...REPLAY_ENGLISH, ...(input?.replay ?? {})} as ArkLiveText["replay"], activity},
        showMe: input?.showMe || "Show me"
    };
}

/** Pages of the event log read in a row at most when the server says there are more (`more`). */
const MORE_PAGES = 4;
/** How long a moment's animal and kind keep the same act seen near the camera from being said again (ms). */
const NOW_SEEN_MS = 90_000;

function signature(snapshot: ArkSnapshot): string {
    const ids = snapshot.animals.map((animal) => animal.id).sort().join(",");
    const nests = (snapshot.nests ?? []).map((nest) => JSON.stringify(nest)).sort().join("|");
    return `${snapshot.animals.length}:${hashString(ids)}:${hashString(nests)}`;
}

function storage(): Storage | null {
    try {
        return window.localStorage;
    } catch {
        return null;
    }
}

export class ArkLive {
    private readonly log = new ArkLiveLog();
    private readonly memory = new ArkSeenMemory();
    private readonly said = new Set<string>();
    private readonly view: ArkLiveLogView;
    private current: ArkSnapshot | null = null;
    private sig = "";
    private cursor: string = new Date().toISOString();
    private reading = false;
    private pendingRead: {before: ArkSnapshot; next: ArkSnapshot} | null = null;
    private timer: ReturnType<typeof setInterval> | null = null;
    private ticks = 0;
    /** The last window of the schedule's moments read (null: none yet, or the log was closed). */
    private momentWindow: number | null = null;
    /** Animals a moment named, by kind, until when (ms): their act seen near the camera is not said twice. */
    private readonly nowSaid = new Map<string, number>();
    private text: ArkLiveText;
    private showMe: string;
    private locale: string;
    private disposed = false;

    constructor(private readonly options: ArkLiveOptions) {
        const read = words(options.words);
        this.text = read.text;
        this.showMe = read.showMe;
        this.locale = options.locale;
        let collapsed = options.collapsed ?? false;
        if (options.storageKey) {
            const stored = (() => {
                try {
                    return storage()?.getItem(options.storageKey!) ?? null;
                } catch {
                    return null;
                }
            })();
            if (stored === "1" || stored === "0") collapsed = stored === "1";
        }
        this.view = new ArkLiveLogView(options.host, {
            labels: this.labels(),
            text: (line) => arkLiveLineText(line, this.text, this.locale),
            onTap: (line) => this.focus(line),
            reducedMotion: Boolean(options.reducedMotion),
            serverLife: ARK_LIVE_LOG_DEFAULTS.serverLife,
            seenLife: ARK_LIVE_LOG_DEFAULTS.seenLife,
            nowLife: ARK_LIVE_LOG_DEFAULTS.nowLife,
            collapsed,
            onCollapsed: (value) => {
                if (!options.storageKey) return;
                try {
                    storage()?.setItem(options.storageKey, value ? "1" : "0");
                } catch {
                    // For this visit.
                }
            }
        });
        this.view.lineOf = (id) => this.log.lines.find((line) => line.id === id) ?? null;
        this.timer = setInterval(() => this.tick(), 500);
    }

    private labels() {
        const live = this.text.live;
        const activity = this.text.activity ?? ARK_ACTIVITY_ENGLISH;
        return {title: live.title, show: live.show, hide: live.hide, logLabel: live.logLabel, seen: live.seen, seenNote: live.seenNote, now: activity.tag, nowNote: activity.tagNote, showMe: this.showMe};
    }

    /** The reader's words came (the embed reads them after the scene starts), or the language changed. */
    setWords(input: ArkLiveWordsIn, locale?: string) {
        const read = words(input);
        this.text = read.text;
        this.showMe = read.showMe;
        if (locale) this.locale = locale;
        this.view.setLabels(this.labels());
    }

    setCovered(covered: boolean) {
        this.view.setCovered(covered);
    }

    setReducedMotion(reduced: boolean) {
        this.options.reducedMotion = reduced;
    }

    /** The lines on screen now (tests, the recorder). */
    get lines(): readonly ArkLiveLine[] {
        return this.log.lines;
    }

    /** A snapshot the page or the host applied (every one, before any "same animals" check). */
    snapshot(next: ArkSnapshot) {
        const sig = signature(next);
        if (!this.current) {
            this.current = next;
            this.sig = sig;
            if (next.as_of && Date.parse(next.as_of) > Date.parse(this.cursor) - 120_000) this.cursor = new Date(Math.min(Date.parse(next.as_of), Date.now())).toISOString();
            return;
        }
        const before = this.current;
        this.current = next;
        if (sig === this.sig) return;
        this.sig = sig;
        if (this.options.eventsUrl) this.readEvents(before, next);
        else this.newcomers(before, next);
    }

    /** Event rows in the server's shape (development's feed): said as the live ones are. */
    events(raw: unknown) {
        const decoded = decodeArkEvents(raw, this.current).filter((event) => !this.said.has(`event:${event.id}`));
        for (const event of decoded) {
            this.remember(`event:${event.id}`);
            if (event.animal && (event.kind === "arrival" || event.kind === "birth")) this.remember(`animal:${event.animal.id}`);
        }
        this.noteRecord(decoded);
        this.push(arkLiveServerItems(decoded));
    }

    /** The record's lines for the animals they are about, for their own logs on the tap card. */
    private noteRecord(events: readonly ArkEvent[]) {
        if (!events.length) return;
        try {
            this.options.scene()?.noteRecord?.(arkRecordNotesFromEvents(events));
        } catch {
            // (A scene without animal logs: the log says them all the same.)
        }
    }

    private remember(key: string) {
        this.said.add(key);
        if (this.said.size > 4000) this.said.delete(this.said.values().next().value as string);
    }

    private push(items: ArkLiveItem[]) {
        if (!items.length) return;
        this.log.push(items, performance.now());
        this.render();
    }

    /** The snapshot's newcomers, when the event log can't be read. */
    private newcomers(before: ArkSnapshot, next: ArkSnapshot) {
        const known = new Set(before.animals.map((animal) => animal.id));
        const fresh = next.animals.filter((animal) => !known.has(animal.id) && !this.said.has(`animal:${animal.id}`));
        for (const animal of fresh) this.remember(`animal:${animal.id}`);
        this.push(arkLiveArrivalsFromSnapshot(fresh));
    }

    private readEvents(before: ArkSnapshot, next: ArkSnapshot, page = 0) {
        if (this.reading) {
            // One read at a time: the next covers whatever changed meanwhile.
            this.pendingRead = {before: this.pendingRead?.before ?? before, next};
            return;
        }
        this.reading = true;
        const since = this.cursor;
        let more = false;
        fetch(`${this.options.eventsUrl}?since=${encodeURIComponent(since)}`, {cache: "no-store"})
            .then((response) => (response.ok ? response.json() : null))
            .then((body: {events?: unknown; available?: boolean; more?: boolean} | null) => {
                if (this.disposed) return;
                if (!body || body.available === false) {
                    this.newcomers(before, next);
                    return;
                }
                const from = Date.parse(since);
                const events = decodeArkEvents(body.events ?? [], next).filter((event) => Date.parse(event.at) >= from && !this.said.has(`event:${event.id}`));
                let newest = from;
                for (const event of events) {
                    this.remember(`event:${event.id}`);
                    if (event.animal) this.remember(`animal:${event.animal.id}`);
                    newest = Math.max(newest, Date.parse(event.at));
                }
                this.cursor = new Date(newest).toISOString();
                // A page at a time (the read's limit): the rest of a burst is read next, never left for the next change.
                more = body.more === true && newest > from;
                this.noteRecord(events);
                this.push(arkLiveServerItems(events));
            })
            .catch(() => {
                if (!this.disposed) this.newcomers(before, next);
            })
            .finally(() => {
                this.reading = false;
                const pending = this.pendingRead;
                this.pendingRead = null;
                if (this.disposed) return;
                if (pending) this.readEvents(pending.before, pending.next);
                else if (more && page + 1 < MORE_PAGES) this.readEvents(before, next, page + 1);
            });
    }

    private tick() {
        if (this.disposed || (typeof document !== "undefined" && document.visibilityState === "hidden")) return;
        const now = performance.now();
        this.ticks++;
        // Seen and now: only while the log is open and the world's foot is clear (a line said late is no longer happening).
        const open = !this.view.isCollapsed && !this.view.isCovered && !this.options.reducedMotion;
        if (!open) this.momentWindow = null;
        if (open) {
            const scene = this.options.scene();
            // Now: the schedule's moments since the last window read (one window of the shared clock is a few seconds).
            const got = scene?.happening?.(this.momentWindow);
            if (got) {
                this.momentWindow = got.window;
                const items = arkNowItems(got.moments, this.memory);
                for (const item of items) if (item.focus.animalId) this.nowSaid.set(`${item.focus.animalId}:${item.kind}`, Date.now() + NOW_SEEN_MS);
                if (items.length) this.log.push(items, now);
            }
            // Seen: about once a second; an act a moment already named is not said again.
            if (this.ticks % 2 === 0) {
                const seen = scene?.seen?.();
                if (seen && (seen.acts.length || seen.alarms.length)) {
                    const items = arkSeenItems(seen, this.memory).filter((item) => (this.nowSaid.get(`${item.focus.animalId}:${item.kind}`) ?? 0) < Date.now());
                    if (items.length) this.log.push(items, now);
                }
            }
            if (this.nowSaid.size > 400) for (const [key, until] of Array.from(this.nowSaid)) if (until < Date.now()) this.nowSaid.delete(key);
        }
        this.log.step(now);
        this.render();
    }

    private render() {
        this.view.render(this.log.lines, performance.now());
    }

    /** A line's tap: its animal when it is in the scene, else one of its kind (a herd's card for a herd), else its region. */
    focus(line: Pick<ArkLiveLine, "focus">) {
        const scene = this.options.scene();
        if (!scene) return;
        const {animalId, speciesId, zone} = line.focus;
        const done = () => this.options.onFocused?.(line as ArkLiveLine);
        if (animalId && scene.locate(animalId)) {
            scene.select(animalId);
            return done();
        }
        if (speciesId) {
            const kin = (this.current?.animals ?? [])
                .filter((animal) => arkSpeciesKey(animal) === speciesId || animal.species_profile_id === speciesId)
                .sort((a, b) => b.arrived_at.localeCompare(a.arrived_at));
            const there = kin.filter((animal) => scene.locate(animal.id));
            const pick = arkPickAnimal(there, null);
            if (pick) {
                scene.select(pick.id);
                return done();
            }
            if (kin.length && scene.selectHerd(kin[0].species_profile_id || `slug:${kin[0].model_slug}`)) return done();
        }
        if (zone) {
            scene.focusRegion(ZONE_REGION[zone] ?? null);
            return done();
        }
    }

    dispose() {
        this.disposed = true;
        if (this.timer) clearInterval(this.timer);
        this.timer = null;
        this.view.dispose();
    }
}
