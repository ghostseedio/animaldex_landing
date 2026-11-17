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
import {HuntOutcomes, caughtText, withoutEndedHunts} from "@/ark-scene/live/hunt-outcome";
import {dormancyItems, dormancyText} from "@/ark-scene/live/dormancy-lines";
import {escapeActs, escapeItems, escapeText} from "@/ark-scene/live/escape-lines";
import {forestDeathRecords, forestItems, forestText} from "@/ark-scene/live/forest-lines"; // p5 (humans)
import {isEnglish, signatureItems, signatureText} from "@/ark-scene/live/signature-lines";
import {ARK_LIVE_ENGLISH} from "@/lib/ark-live-words";
import {ARK_ACTIVITY_ENGLISH, arkRecordNotesFromEvents, type ArkActivityWords} from "@/lib/ark-animal-status";
import {arkPickAnimal, arkSpeciesKey} from "@/lib/ark-population";
import {hashString} from "@/ark-scene/world";
import {ZONE_REGION, type ArkSceneHandle, type ArkSnapshot} from "@/ark-scene/types";
import {ArkLiveLogView} from "@/ark-scene/live/log-view";
import {breedFocus, isBreedKind, youngStillWanted, YOUNG_WAIT_MS} from "@/ark-scene/live/breed-focus";

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

/** The log's words with English under what is missing: for a page that says the record's lines itself (Ark Lite). */
export function arkLiveTextOf(input: ArkLiveWordsIn): ArkLiveText {
    return words(input).text;
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
    private readonly outcomes = new HuntOutcomes();
    private readonly memory = new ArkSeenMemory();
    private readonly said = new Set<string>();
    /** A mating line's animal (its focus: the record's first parent) to its partner, for the tap to frame both. */
    private readonly mates = new Map<string, string>();
    /** 3.3 fix (breeding taps): a young's parents, and a clutch's egg count by its first parent, from the record. */
    private readonly parentsOf = new Map<string, string[]>();
    private readonly clutches = new Map<string, {key: string; parents: string[]; eggs: number | null}>();
    /**
     * A young its line's tap could not go to yet (not in the roster): chosen once a read brings it, while the view is
     * still on the parent the tap chose (`youngStillWanted`), until when (ms).
     */
    private youngWait: {id: string; parent: string; since: number; until: number} | null = null;
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
            text: (line) => signatureText(line, this.text) ?? escapeText(line, this.text) ?? forestText(line, this.text) ?? dormancyText(line, this.text, this.locale) ?? caughtText(line, this.text) ?? arkLiveLineText(line, this.text, this.locale),
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
        this.youngArrived(next); // 3.3 fix (breeding taps)
        const before = this.current;
        this.current = next;
        if (sig === this.sig) return;
        this.sig = sig;
        if (this.options.eventsUrl) this.readEvents(before, next);
        else this.newcomers(before, next);
    }

    /** Event rows in the server's shape (development's feed): said as the live ones are. */
    events(raw: unknown) {
        this.dormancy(raw, -Infinity);
        const decoded = decodeArkEvents(raw, this.current).filter((event) => !this.said.has(`event:${event.id}`));
        for (const event of decoded) {
            this.remember(`event:${event.id}`);
            if (event.animal && (event.kind === "arrival" || event.kind === "birth")) this.remember(`animal:${event.animal.id}`);
        }
        this.noteRecord(decoded);
        this.noteKin(decoded); // 3.3 fix (breeding taps)
        this.revive(decoded);
        this.mate(decoded);
        this.died(decoded); // 3.3 fix (log)
        this.born(decoded);
        this.hatched(decoded); // 3.3 batch (B): ducklings dropping from the tree hole
        this.push(arkLiveServerItems(decoded));
    }

    /** Hearts are lives: an animal back from recovering walks out of its home (the scene's `revive`), once. */
    private revive(events: readonly ArkEvent[]) {
        for (const event of events) {
            if (event.kind !== "revived" || !event.animal) continue;
            try {
                this.options.scene()?.revive?.(event.animal.id);
            } catch {
                // (A scene without it: the animal is simply there again.)
            }
        }
    }

    /** 3.3 fix (log): the record's deaths, handed to the scene: its body lies where it died, and a tap on its line goes there. */
    private died(events: readonly ArkEvent[]) {
        const deaths = events.filter((event) => (event.kind === "death_old" || event.kind === "starved") && event.animal).map((event) => ({key: `death:${event.id}`, animal: event.animal!, t0: Date.parse(event.at) / 1000}));
        if (!deaths.length) return;
        try {
            this.options.scene()?.addDeaths?.(deaths);
        } catch {
            // (A scene without it: the log says it all the same.)
        }
    }

    /** p5 (humans): logging's deaths (`forest-lines.ts`): said once, and each body laid where the server judged it. */
    private deforested(raw: unknown, from: number) {
        const items = forestItems(raw, this.current, from, (key) => this.said.has(key));
        const deaths = forestDeathRecords(raw, this.current, from).map((d) => ({key: d.key, animal: d.animal, t0: d.t0, at: d.spot}));
        for (const item of items) this.remember(`event:${item.id}`);
        if (deaths.length) {
            try {
                this.options.scene()?.addDeaths?.(deaths);
            } catch {
                // (A scene without it: the log says it all the same.)
            }
        }
        if (items.length) this.push(items);
    }

    /** A pair bred: the two walk to each other and pair in the live world (the scene's `addMatings`), at its time. */
    private mate(events: readonly ArkEvent[]) {
        const matings: Array<{key: string; a: string; b: string; t0: number}> = [];
        for (const event of events) {
            if (event.kind !== "mated") continue;
            const a = event.animal?.id ?? event.parents[0];
            const b = event.other?.id ?? event.parents[1];
            const t0 = Date.parse(event.at) / 1000;
            if (a && b && a !== b && Number.isFinite(t0)) matings.push({key: `mated:${event.id}`, a, b, t0});
            // (The line's focus is the first parent, `ark-live-log.ts`; its tap frames it with the other.)
            const first = event.parents[0] ?? a;
            const other = first === a ? b : first === b ? a : null;
            if (first && other) {
                this.mates.delete(first);
                this.mates.set(first, other);
                if (this.mates.size > 200) this.mates.delete(this.mates.keys().next().value as string);
            }
        }
        if (!matings.length) return;
        try {
            this.options.scene()?.addMatings?.(matings);
        } catch {
            // (A scene without it: the log says it all the same.)
        }
    }

    /** The record's dormancy events in the rows (`dormancy-lines.ts`): said once, and the scene asked to look again. */
    private dormancy(raw: unknown, from: number) {
        const items = dormancyItems(raw, from, (key) => this.said.has(key));
        // (And the record's escapes, `escape-lines.ts`: a prey animal that got away.)
        const escapes = escapeItems(raw, from, (key) => this.said.has(key));
        for (const item of items.concat(escapes)) this.remember(item.id);
        this.deforested(raw, from); // p5 (humans)
        // 3.3 batch (D): and acted in the live world (the scene's `addEscapes`: the chase that ends in a miss, the limp).
        const acts = escapeActs(raw, from);
        if (acts.length) {
            try {
                this.options.scene()?.addEscapes?.(acts);
            } catch {
                // (A scene without it: the log says it all the same.)
            }
        }
        if (escapes.length) this.push(escapes);
        if (!items.length) return;
        this.push(items);
        this.readDormant();
    }

    /** The kinds dormant now (`/api/ark/dormant`, beside the events' URL), handed to the scene; again every ten minutes. */
    private dormantAt = -Infinity;
    private readDormant() {
        const url = this.options.eventsUrl?.replace(/\/events(\?.*)?$/, "/dormant");
        if (!url || url === this.options.eventsUrl || this.disposed) return;
        this.dormantAt = performance.now();
        fetch(url)
            .then((response) => (response.ok ? response.json() : null))
            .then((body: {dormant?: unknown} | null) => {
                if (this.disposed || !body || !Array.isArray(body.dormant)) return;
                this.options.scene()?.setDormant?.(body.dormant.filter((id): id is string => typeof id === "string"));
            })
            .catch(() => {
                // (No answer: nothing is dormant as far as the scene knows; asked again later.)
            });
        // p5 (humans): and the record's forestry (logging and replanting on the wild island), as often.
        fetch(url.replace(/\/dormant$/, "/forestry"))
            .then((response) => (response.ok ? response.json() : null))
            .then((body: {forestry?: {fromDay?: unknown; v?: unknown} | null} | null) => {
                if (!this.disposed && body) this.options.scene()?.setForestry?.(body.forestry ?? null);
            })
            .catch(() => {
                // (No answer: no forestry drawn; asked again later.)
            });
    }

    /** Into the log, a hunt's outcome marked on the way (`hunt-outcome.ts`). */
    private say(items: readonly ArkLiveItem[], now: number): boolean {
        const noted = this.outcomes.note(items, now);
        const before = this.log.lines.length;
        this.log.lines = withoutEndedHunts(this.log.lines, noted.ended);
        return this.log.push(noted.items, now) || this.log.lines.length !== before;
    }

    /** 3.3 batch (B, C): the record's hatchings, for the scene (`addHatchings`): a tree hole's jump, a mouth carry, the lineage. */
    private hatched(events: readonly ArkEvent[]) {
        const clutches = new Map<string, {key: string; parents: string[]; young: string[]; t0: number}>();
        for (const event of events) {
            if (event.kind !== "birth" || !event.from_egg || !event.animal || !event.parents.length) continue;
            const t0 = Date.parse(event.at) / 1000;
            if (!Number.isFinite(t0)) continue;
            const key = `hatch:${event.at}:${[...event.parents].sort().join(",")}`;
            const clutch = clutches.get(key);
            if (clutch) clutch.young.push(event.animal.id);
            else clutches.set(key, {key, parents: [...event.parents], young: [event.animal.id], t0});
        }
        if (!clutches.size) return;
        try {
            this.options.scene()?.addHatchings?.(Array.from(clutches.values()));
        } catch {
            // (A scene without it: the log says it all the same.)
        }
    }

    /** 3.3 fix (breeding taps): who a young's parents are, and a laid clutch's eggs, for their lines' taps. */
    private noteKin(events: readonly ArkEvent[]) {
        const keep = <V>(map: Map<string, V>, key: string, value: V) => {
            map.delete(key);
            map.set(key, value);
            if (map.size > 200) map.delete(map.keys().next().value as string);
        };
        for (const event of events) {
            if (event.kind === "birth" && event.animal && event.parents.length) keep(this.parentsOf, event.animal.id, [...event.parents]);
            // (A laid line's focus is the record's first parent, `ark-live-log.ts`.)
            const first = event.parents[0] ?? event.animal?.id;
            if (event.kind === "laid" && first) keep(this.clutches, first, {key: `laid:${event.id}`, parents: event.parents.length ? [...event.parents] : [first], eggs: event.eggs});
        }
    }

    /** A young waited for (its line was tapped before a read brought it): chosen once it is aboard. */
    private youngArrived(next: ArkSnapshot) {
        const wait = this.youngWait;
        if (!wait) return;
        if (!this.youngWanted()) return;
        if (!next.animals.some((animal) => animal.id === wait.id)) return;
        this.youngWait = null;
        // (After the page hands the scene this read, `ark-view.tsx` apply: the scene then chooses it once it is laid out.)
        setTimeout(() => {
            if (!this.disposed) this.options.scene()?.select(wait.id);
        }, 0);
    }

    /** The young waited for, still wanted (else forgotten): the viewer chose, followed or closed nothing since. */
    private youngWanted(): boolean {
        const scene = this.options.scene();
        if (youngStillWanted(this.youngWait, Date.now(), scene?.selection?.() ?? null)) return true;
        this.youngWait = null;
        return false;
    }

    /** Live young were born (not a hatching): the litter's birth is acted in the live world (the scene's `addBirths`). */
    private born(events: readonly ArkEvent[]) {
        const litters = new Map<string, {key: string; parents: string[]; young: string[]; t0: number}>();
        for (const event of events) {
            if (event.kind !== "birth" || event.from_egg || !event.animal || !event.parents.length) continue;
            const t0 = Date.parse(event.at) / 1000;
            if (!Number.isFinite(t0)) continue;
            const key = `birth:${event.at}:${[...event.parents].sort().join(",")}`;
            const litter = litters.get(key);
            if (litter) litter.young.push(event.animal.id);
            else litters.set(key, {key, parents: [...event.parents], young: [event.animal.id], t0});
        }
        if (!litters.size) return;
        try {
            this.options.scene()?.addBirths?.(Array.from(litters.values()));
        } catch {
            // (A scene without it: the log says it all the same.)
        }
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
        this.say(items, performance.now());
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
                this.dormancy(body.events ?? [], from);
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
                this.noteKin(events); // 3.3 fix (breeding taps)
                this.revive(events);
                this.mate(events);
                this.died(events); // 3.3 fix (log)
                this.born(events);
                this.hatched(events); // 3.3 batch (B)
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
        if (now - this.dormantAt > 600_000) this.readDormant();
        // Seen and now: only while the log is open (above the card too, when one is up: a line said late is no longer happening).
        const open = !this.view.isCollapsed && !this.options.reducedMotion;
        if (!open) this.momentWindow = null;
        if (open) {
            const scene = this.options.scene();
            // Now: the schedule's moments since the last window read (one window of the shared clock is a few seconds).
            const got = scene?.happening?.(this.momentWindow);
            if (got) {
                this.momentWindow = got.window;
                const items = arkNowItems(got.moments, this.memory);
                // In English a moment whose species has its own sentence for the recipe it starts is said in it.
                if (isEnglish(this.locale)) {
                    const own = new Map(got.moments.filter((m) => m.line).map((m) => [m.id, m.line!]));
                    for (const item of items) if (own.has(item.id)) item.line = own.get(item.id);
                }
                for (const item of items) if (item.focus.animalId) this.nowSaid.set(`${item.focus.animalId}:${item.kind}`, Date.now() + NOW_SEEN_MS);
                if (items.length) this.say(items, now);
            }
            // Seen: about once a second; an act a moment already named is not said again.
            if (this.ticks % 2 === 0) {
                const seen = scene?.seen?.();
                if (seen && (seen.acts.length || seen.alarms.length)) {
                    // In English a species' own sentence first; the generic line only for acts without one.
                    const english = isEnglish(this.locale);
                    const own = english ? signatureItems(seen.acts, this.memory) : [];
                    const items = own.concat(arkSeenItems(english ? {acts: seen.acts.filter((act) => !act.line), alarms: seen.alarms} : seen, this.memory)).filter((item) => (this.nowSaid.get(`${item.focus.animalId}:${item.kind}`) ?? 0) < Date.now());
                    if (items.length) this.say(items, now);
                }
            }
            if (this.nowSaid.size > 400) for (const [key, until] of Array.from(this.nowSaid)) if (until < Date.now()) this.nowSaid.delete(key);
        }
        if (this.youngWait) this.youngWanted(); // 3.3 fix (breeding taps): forgotten the moment the viewer looks elsewhere
        this.log.step(now);
        this.render();
    }

    private render() {
        this.view.render(this.log.lines, performance.now());
    }

    /**
     * A line's tap: its animal when it is in the scene, else one of its kind (a herd's card for a herd), else its region.
     * A mating's: the pair, both framed while their mating is acted (the scene's `selectPair`), else the first alone.
     */
    focus(line: Pick<ArkLiveLine, "focus"> & Partial<Pick<ArkLiveLine, "id" | "kind">>) {
        const scene = this.options.scene();
        if (!scene) return;
        const {animalId, speciesId, zone} = line.focus;
        const done = () => this.options.onFocused?.(line as ArkLiveLine);
        this.youngWait = null;
        // 3.3 fix (breeding taps): a pair, a clutch, a young: chosen when aboard, drawn now or not (`breed-focus.ts`).
        if (isBreedKind(line.kind)) {
            const aboard = new Set((this.current?.animals ?? []).map((animal) => animal.id));
            const step = breedFocus(line.kind, animalId, {partner: animalId ? this.mates.get(animalId) : null, parents: animalId ? this.parentsOf.get(animalId) : null}, (id) => aboard.has(id) || Boolean(scene.locate(id)));
            if (step) {
                if (step.do === "pair") {
                    if (scene.selectPair) scene.selectPair(step.a, step.b, line.kind !== "mated");
                    else scene.select(step.a);
                } else scene.select(step.id);
                if (step.do === "parent") this.youngWait = {id: step.young, parent: step.id, since: Date.now(), until: Date.now() + YOUNG_WAIT_MS};
                const clutch = line.kind === "laid" && animalId ? this.clutches.get(animalId) : undefined;
                if (clutch) scene.showClutch?.(clutch.key, clutch.parents.filter((id) => aboard.has(id)), clutch.eggs);
                return done();
            }
        }
        // 3.3 fix (log): a death's line goes to where it died (its body lies there a while), not to one of its kind.
        if ((line.kind === "death" || line.kind === "starved") && line.id && scene.focusDeath?.(`death:${line.id}`)) return done();
        if (animalId && scene.locate(animalId)) {
            const partner = line.kind === "mated" ? this.mates.get(animalId) : undefined;
            if (partner && scene.selectPair) scene.selectPair(animalId, partner);
            else scene.select(animalId);
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
