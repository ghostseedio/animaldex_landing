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
 * V1 ("hunting and mating you can see", `seen/`, loaded lazily the first time there is something for it): every
 * record that is acted brings its animals into the scene before its layer is fed (pinned; a stand-in for whoever has
 * left the read), a meal is handed to the scene as its row is read (the held chase is then seen, `ark-act-hold.ts`),
 * and a tap on a line whose act is under way or about to begin WATCHES it: everyone it names held in one picture.
 *
 * Nothing here decides anything about the Ark: it says what the server wrote and what the shared layers draw.
 */

import {decodeArkEvents, planArkReplay, type ArkAct, type ArkEvent} from "@/lib/ark-life";
import {arkActStart, arkActStartOf} from "@/lib/ark-act-hold";
import {ARK_DAY_MS} from "@/lib/ark-clock";
import {arkPinnedMs} from "@/ark-scene/shared-clock";
import type {ArkSeen, ArkSeenWords} from "@/ark-scene/seen";
import {ArkLiveLog, ArkSeenMemory, arkLiveArrivalsFromSnapshot, arkLiveLineText, arkNowItems, arkSeenItems, ARK_LIVE_LOG_DEFAULTS, type ArkLiveItem, type ArkLiveLine, type ArkLiveText} from "@/lib/ark-live-log";
import {HuntOutcomes, caughtText, withoutEndedHunts} from "@/ark-scene/live/hunt-outcome";
import {crisisText, recordItems} from "@/ark-scene/live/crisis-lines"; // E4 (the crisis layer)
import {dormancyItems, dormancyText} from "@/ark-scene/live/dormancy-lines";
import {escapeActs, escapeItems, escapeText} from "@/ark-scene/live/escape-lines";
import {closeCallRow, closeCallText, heartsNotes, rescueItems, rescueText} from "@/ark-scene/live/hearts-lines";
import {arkHeartsEscape, decodeArkHeartsRules, type ArkHeartsRules} from "@/lib/ark-hearts-rules";
import {cacheEventItems, cacheEventText, signatureCues, signatureEventItems, signatureEventText} from "@/ark-scene/live/signature-events"; // SIG-EVENTS: saved signature moves
import {richItems, richNotes} from "@/ark-scene/live/rich-lines"; // decision 434
import {careItems, careNotes} from "@/ark-scene/live/care-lines"; // GIFTS-CARE, decision 387
import {forestDeathRecords, forestItems, forestText} from "@/ark-scene/live/forest-lines"; // p5 (humans)
import {humanItems, humanText} from "@/ark-scene/live/human-lines"; // p5 (humans)
import {releaseItems, releaseText} from "@/ark-scene/live/release-lines"; // Release to the Wild (P1-8)
import {journeysOf, mateItems, mateText} from "@/ark-scene/live/mate-lines"; // MATE-FINDING (decision 432)
import {isEnglish, signatureItems, signatureText} from "@/ark-scene/live/signature-lines";
import {antItems} from "@/ark-scene/live/ant-lines";
import {ARK_LIVE_ENGLISH} from "@/lib/ark-live-words";
import {ARK_ACTIVITY_ENGLISH, arkRecordNotesFromEvents, type ArkActivityWords} from "@/lib/ark-animal-status";
import {arkPickAnimal, arkSpeciesKey} from "@/lib/ark-population";
import {hashString} from "@/ark-scene/world";
import {ZONE_REGION, type ArkSceneHandle, type ArkSnapshot, type GrassKey} from "@/ark-scene/types";
import {ArkLiveLogView} from "@/ark-scene/live/log-view";
import {breedFocus, isBreedKind, youngStillWanted, YOUNG_WAIT_MS} from "@/ark-scene/live/breed-focus";

/** The words the log needs (the Ark's `live` and `replay`, and "Show me"), as the page or `/api/ark/words` has them. */
export type ArkLiveWordsIn = {live?: Partial<ArkLiveText["live"]> | null; replay?: Partial<ArkLiveText["replay"]> | null; showMe?: string | null; /** The schedule's moments' words (`ark.activity`). */ activity?: Partial<ArkActivityWords> | null; /** V1: the marks' words (`ark.endangered`'s "Last one" and "Critical", `ark.life.lone`) and the states' (`ark.seen`). */ endangered?: {last?: string | null; critical?: string | null} | null; life?: ({lone?: string | null} & Partial<Record<GrassKey, string | null>>) | null; seen?: Partial<Record<string, string | null>> | null; /** ARK-MATING-SHOWN: a clutch's countdown's (`ark.eggs`). */ eggs?: Partial<Record<string, string | null>> | null; /** MATE-FINDING: the far mate's lines (`ark.mate`). */ mate?: Partial<Record<string, string | null>> | null} | null;

/** V1: the server's kinds that are acted with a cast (`seen/live-cast.ts` ARK_SEEN_KINDS; here so nothing of `seen/` loads until one comes). */
// (ARK-MATING-SHOWN: and `laid`, for its clutch's countdown on the mother: `seen/index.ts` eggs.)
const SEEN_KINDS: ReadonlySet<string> = new Set(["mated", "birth", "death_old", "starved", "meal", "escaped", "extinction", "laid"]);
/** V1: the crises read (`/api/ark/crises`, E4): asked a little after the log starts, then this often; rarely while it is not there. */
const CRISES_FIRST_MS = 12_000;
const CRISES_EVERY_MS = 3 * 60_000;
const CRISES_ABSENT_MS = 30 * 60_000;

/** V1's words out of the Ark's (`ark.endangered`, `ark.life.lone`, `ark.seen`, `ark.replay.a` / `.an`); also Ark Lite's. */
export function arkSeenWordsOf(input: ArkLiveWordsIn): ArkSeenWords {
    const out: ArkSeenWords = {};
    if (input?.endangered?.last) out.last = input.endangered.last;
    if (input?.endangered?.critical) out.critical = input.endangered.critical;
    if (input?.life?.lone) out.lone = input.life.lone;
    // (A name with its article, as the log's own lines fill `{aPrey}`: `ark.replay.a` and `.an`.)
    if (input?.replay?.a) out.a = input.replay.a;
    if (input?.replay?.an) out.an = input.replay.an;
    const seen = input?.seen;
    for (const key of ["searching", "stalking", "stalkingNoTarget", "wounded"] as const) {
        const value = seen?.[key];
        if (typeof value === "string" && value.trim()) out[key] = value;
    }
    if (typeof seen?.mateSeeking === "string" && seen.mateSeeking.trim()) out.mate_seeking = seen.mateSeeking;
    // MATE-FINDING (decision 432): `ark.mate.*`.
    const mate = input?.mate;
    if (typeof mate?.nearest === "string" && mate.nearest.trim()) out.mateNearest = mate.nearest;
    if (typeof mate?.found === "string" && mate.found.trim()) out.mateFound = mate.found;
    // ARK-MATING-SHOWN: a clutch's countdown (`ark.eggs.*`).
    const eggs = input?.eggs;
    for (const key of ["eggsInNest", "hatchesIn", "ifAllGoesWell", "minutes", "hours", "days"] as const) {
        const value = eggs?.[key];
        if (typeof value === "string" && value.trim()) out[key] = value;
    }
    return out;
}

/** The replay's words the log borrows, in English: until (or unless) the reader's words come. */
const REPLAY_ENGLISH: ArkLiveText["replay"] = {
    a: "a {animal}",
    an: "an {animal}",
    meal: "The {predator} ate {aPrey}",
    death: "The {animal} died of old age",
    deathUnknown: "The {animal} died. The cause is not known",
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
    /** V1 (`seen/`): false leaves the casts, the watch and the marks out (a test's log). Default on. */
    seen?: boolean;
    /** The frame clock, the next frame and the acts' clock for `seen/` (the harness steps them itself). */
    seenClock?: {now?: () => number; frame?: (step: () => void) => void; epochMs?: () => number};
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
    /** V1 (`seen/`): the casts, the watch and the marks; loaded the first time there is something for them. */
    private seen: ArkSeen | null = null;
    private seenLoading: Promise<ArkSeen | null> | null = null;
    private crisesAt = -Infinity;
    private crisesEvery = CRISES_FIRST_MS;
    private readonly lineText: (line: ArkLiveLine) => string;
    /** Which rule the server runs for a heart, from the events read (`heartsRules`): null until read, or from a server that does not say (today's rule). */
    private heartsRules: ArkHeartsRules | null = null;

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
        this.lineText = (line) => signatureEventText(line, this.text, this.locale) ?? cacheEventText(line, this.text) ?? signatureText(line, this.text) ?? escapeText(line, this.text, this.locale) ?? rescueText(line, this.text, this.locale) ?? closeCallText(line, this.text, this.locale) ?? forestText(line, this.text, this.locale) ?? humanText(line) ?? releaseText(line, this.text) ?? mateText(line, this.text) ?? dormancyText(line, this.text, this.locale) ?? crisisText(line, this.text) ?? caughtText(line, this.text) ?? arkLiveLineText(line, this.text, this.locale);
        this.crisesAt = performance.now();
        this.view = new ArkLiveLogView(options.host, {
            labels: this.labels(),
            text: this.lineText,
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
        this.options.words = input;
        this.seen?.setWords(arkSeenWordsOf(input));
    }

    // MARK: V1 (`seen/`)

    /** `seen/`, loaded once (null: no scene yet, a scene without the cast's hook, or the load failed: the log goes on without it). */
    private loadSeen(): Promise<ArkSeen | null> {
        if (this.seen) return Promise.resolve(this.seen);
        if (this.options.seen === false) return Promise.resolve(null);
        return (this.seenLoading ??= import("@/ark-scene/seen")
            .then(({attachArkSeen}) => {
                const scene = this.options.scene();
                if (this.disposed || !scene?.setCast) {
                    this.seenLoading = null;
                    return null;
                }
                const host = this.options.host;
                this.seen = attachArkSeen({handle: scene, host, aspect: () => host.clientWidth / Math.max(host.clientHeight, 1) || 1, words: arkSeenWordsOf(this.options.words), reducedMotion: () => Boolean(this.options.reducedMotion), ...(this.options.seenClock ?? {})});
                if (this.current) this.seen.snapshot(this.current);
                return this.seen;
            })
            .catch(() => {
                this.seenLoading = null;
                return null;
            }));
    }

    /**
     * Before the layers are fed rows: everyone their acts name brought into the scene (`seen/live-cast.ts`). Null:
     * nothing to wait for (no row that is acted, or `seen/` is in already and has them).
     */
    private casting(raw: unknown): Promise<void> | null {
        const list: unknown[] = Array.isArray(raw) ? raw : raw && typeof raw === "object" && Array.isArray((raw as {events?: unknown}).events) ? (raw as {events: unknown[]}).events : [];
        // (A survived close call (AGE-RISK `closeCall`) is a `death_old` row but nothing died: there is no act and no cast for it.)
        const rows = list.filter((row) => row && typeof row === "object" && SEEN_KINDS.has(String((row as {kind?: unknown}).kind)) && !closeCallRow(row));
        if (!rows.length || this.options.seen === false || !this.options.scene()?.setCast) return null;
        if (this.seen) {
            this.seen.note(rows, this.current);
            return null;
        }
        return this.loadSeen().then((seen) => {
            seen?.note(rows, this.current);
        });
    }

    /**
     * A line whose act can still be watched from its start stays until it has begun (`ArkLiveItem.stay`): a held chase
     * or dying act begins a minute after its record (`ark-act-hold.ts`), a mating's walk and a birth take their time.
     * `at`: the row's own time (ms) by the item's id.
     */
    private staying(items: ArkLiveItem[], at: (id: string) => number): ArkLiveItem[] {
        const now = this.options.seenClock?.epochMs?.() ?? arkPinnedMs() ?? Date.now();
        for (const item of items) {
            const t = at(String(item.id));
            if (!Number.isFinite(t) || item.source !== "server") continue;
            const held = item.kind === "meal" || item.kind === "death" || item.kind === "starved" || item.kind === "extinction" || item.say === "escaped";
            const until = held || item.kind === "birth" ? (arkActStart(t / 1000) + 20) * 1000 : item.kind === "mated" ? t + 100_000 : item.kind === "hatched" ? t + 50_000 : NaN;
            if (until > now) item.stay = until - now;
        }
        return items;
    }

    /** The record's meals, handed to the scene as they are read (`addMeals`): the hunting read's own set comes up to a refresh later. */
    private ate(events: readonly ArkEvent[]) {
        const meals = events.filter((event) => event.kind === "meal" && event.animal && event.other).flatMap((event) => planArkReplay([event], 1).acts.filter((act): act is Extract<ArkAct, {kind: "meal"}> => act.kind === "meal"));
        if (!meals.length) return;
        try {
            this.options.scene()?.addMeals?.(meals);
        } catch {
            // (A scene without it: the hunting read's meals still come.)
        }
    }

    /** The open crises (`/api/ark/crises` beside the events' URL, E4; asked rarely while it fails): their animals pinned, the last one ringed. */
    private readCrises() {
        const url = this.options.eventsUrl?.replace(/\/events(\?.*)?$/, "/crises");
        this.crisesAt = performance.now();
        if (!url || url === this.options.eventsUrl || this.disposed || this.options.seen === false) return;
        fetch(url)
            .then((response) => {
                this.crisesEvery = response.ok ? CRISES_EVERY_MS : CRISES_ABSENT_MS;
                return response.ok ? response.json() : null;
            })
            .then((body: {available?: boolean; crises?: unknown} | null) => {
                if (this.disposed || !body || body.available === false || !Array.isArray(body.crises)) return;
                // (`seen/` is loaded for an open crisis only; once in, an empty answer clears the rings.)
                if (!body.crises.length && !this.seen) return;
                void this.loadSeen().then((seen) => seen?.setCrises(body));
            })
            .catch(() => {
                this.crisesEvery = CRISES_ABSENT_MS;
            });
    }

    setCovered(covered: boolean) {
        this.view.setCovered(covered);
    }

    setReducedMotion(reduced: boolean) {
        this.options.reducedMotion = reduced;
    }

    /** V1: `seen/` once it is in (the harness, tests). */
    get seenNow(): ArkSeen | null {
        return this.seen;
    }

    /** V1: `seen/` asked for now (the harness: before any record has come). */
    seenReady(): Promise<ArkSeen | null> {
        return this.loadSeen();
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
            this.seenSnapshot(next);
            this.sig = sig;
            if (next.as_of && Date.parse(next.as_of) > Date.parse(this.cursor) - 120_000) this.cursor = new Date(Math.min(Date.parse(next.as_of), Date.now())).toISOString();
            return;
        }
        this.youngArrived(next); // 3.3 fix (breeding taps)
        const before = this.current;
        this.current = next;
        this.seenSnapshot(next);
        if (sig === this.sig) return;
        this.sig = sig;
        if (this.options.eventsUrl) this.readEvents(before, next);
        else this.newcomers(before, next);
    }

    /** V1: every read to `seen/` (the lone marks, the crisis animals still aboard), loaded for a read with a lone founder or a state (E6) in it. */
    private seenSnapshot(next: ArkSnapshot) {
        if (this.seen) this.seen.snapshot(next);
        else if (!this.seenLoading && this.options.seen !== false && next.animals.some((animal) => animal.lone === true || animal.state)) void this.loadSeen();
    }

    /** Event rows in the server's shape (development's feed): said as the live ones are. `heartsRules`: the server's rule for a heart, as `/api/ark/events` would send it. */
    events(raw: unknown, heartsRules?: unknown) {
        if (heartsRules !== undefined) this.heartsRules = decodeArkHeartsRules(heartsRules);
        // (V1: everyone the rows' acts name is brought into the scene first; the first time, once `seen/` has loaded.)
        const casting = this.casting(raw);
        if (casting) void casting.then(() => this.eventsNow(raw));
        else this.eventsNow(raw);
    }

    private eventsNow(raw: unknown) {
        if (this.disposed) return;
        this.dormancy(raw, -Infinity);
        const decoded = decodeArkEvents(raw, this.current).filter((event) => !this.said.has(`event:${event.id}`));
        for (const event of decoded) {
            this.remember(`event:${event.id}`);
            if (event.animal && (event.kind === "arrival" || event.kind === "birth")) this.remember(`animal:${event.animal.id}`);
        }
        this.noteRecord(decoded);
        this.noteKin(decoded); // 3.3 fix (breeding taps)
        this.revive(decoded);
        this.ate(decoded); // V1
        this.mate(decoded);
        this.died(decoded); // 3.3 fix (log)
        this.born(decoded);
        this.laid(raw); // ARK-MATING-SHOWN
        this.hatched(decoded); // 3.3 batch (B): ducklings dropping from the tree hole
        this.push(this.staying(recordItems(decoded), (id) => Date.parse(decoded.find((event) => String(event.id) === id)?.at ?? "")));
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
        // (V1: the dying act begins once the record is out, `ark-act-hold.ts`; until then its stand-in goes on with its day.)
        const deaths = events.filter((event) => (event.kind === "death_old" || event.kind === "starved") && event.animal && !event.closeCall).map((event) => ({key: `death:${event.id}`, animal: event.animal!, t0: arkActStartOf(event.at), ...(event.kind === "starved" ? {cause: "starved" as const} : {})}));
        if (!deaths.length) return;
        try {
            this.options.scene()?.addDeaths?.(deaths);
        } catch {
            // (A scene without it: the log says it all the same.)
        }
    }

    /** p5 (humans): logging's deaths (`forest-lines.ts`): said once, and each body laid where the server judged it. */
    private deforested(raw: unknown, from: number) {
        // A heart a survived attack: a logging recovery is a lost home, said so, and nothing died: no body is laid for it.
        const lost = arkHeartsEscape(this.heartsRules);
        const items = forestItems(raw, this.current, from, (key) => this.said.has(key), lost);
        const deaths = forestDeathRecords(raw, this.current, from).filter((d) => !(lost && d.hearts !== undefined)).map((d) => ({key: d.key, animal: d.animal, t0: d.t0, at: d.spot}));
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
        const rowsIn: Array<{id?: unknown; at?: unknown}> = Array.isArray(raw) ? raw : raw && typeof raw === "object" && Array.isArray((raw as {events?: unknown}).events) ? (raw as {events: Array<{id?: unknown; at?: unknown}>}).events : [];
        const escapes = this.staying(escapeItems(raw, from, (key) => this.said.has(key)), (id) => Date.parse(String(rowsIn.find((row) => row && `event:${String(row.id)}` === id)?.at ?? "")));
        for (const item of items.concat(escapes)) this.remember(item.id);
        this.deforested(raw, from); // p5 (humans)
        // p5 (humans): the town's couples (`human-lines.ts`).
        const couples = humanItems(raw, from, (key) => this.said.has(key));
        for (const item of couples) this.remember(item.id);
        if (couples.length) this.push(couples);
        // Rich events (AnimalDex decision 434, `rich-lines.ts`): grown up, growing old, a breeding season, a carer, the ground,
        // a first mating, a mate found after a long wait, fresh dung found. Their lines for the animals' own logs go first,
        // so a first mating's line takes the plain one's place.
        const rich = richItems(raw, from, (key) => this.said.has(key), this.text, this.locale);
        for (const item of rich) this.remember(item.id);
        if (rich.length) this.push(rich);
        try {
            const notes = richNotes(raw, this.text, this.locale);
            if (notes.length) this.options.scene()?.noteRecord?.(notes);
        } catch {
            // (A scene without animal logs: the log says them all the same.)
        }
        // A heart is a survived attack (`hearts-lines.ts`, behind the server's `hearts_escape`): an animal found starving and taken
        // into care, and the wounded escapes of the animals' own logs. (A wounded escape's line is the escapes' above.)
        const rescued = rescueItems(raw, from, (key) => this.said.has(key));
        for (const item of rescued) this.remember(item.id);
        if (rescued.length) this.push(rescued);
        try {
            const notes = heartsNotes(raw, this.text, this.locale);
            if (notes.length) this.options.scene()?.noteRecord?.(notes);
        } catch {
            // (A scene without animal logs: the log says them all the same.)
        }
        // Gifts as Ark care (GIFTS-CARE, decision 387, `care-lines.ts`): a visitor's meal, shelter, nesting help.
        const cared = careItems(raw, from, (key) => this.said.has(key), this.text);
        for (const item of cared) this.remember(item.id);
        if (cared.length) this.push(cared);
        try {
            const notes = careNotes(raw, this.text);
            if (notes.length) this.options.scene()?.noteRecord?.(notes);
        } catch {
            // (A scene without animal logs: the log says them all the same.)
        }
        // Saved signature moves (SIG-EVENTS, `signature-events.ts`): said for everyone, and the animal plays its recipe in view.
        const moves = signatureEventItems(raw, from, (key) => this.said.has(key)).concat(cacheEventItems(raw, from, (key) => this.said.has(key)));
        for (const item of moves) this.remember(item.id);
        if (moves.length) this.push(moves);
        const cues = signatureCues(raw, from);
        if (cues.length) {
            try {
                this.options.scene()?.addSignatureCues?.(cues);
            } catch {
                // (A scene without it: the log says it all the same.)
            }
        }
        // Release to the Wild (P1-8): a zoo animal that now lives free (`release-lines.ts`).
        const freed = releaseItems(raw, from, (key) => this.said.has(key));
        for (const item of freed) this.remember(item.id);
        if (freed.length) this.push(freed);
        // MATE-FINDING (decision 432): a wild animal that travelled to a far partner (`mate-lines.ts`), and its trip acted.
        const found = mateItems(raw, from, (key) => this.said.has(key));
        for (const item of found) this.remember(item.id);
        if (found.length) this.push(found);
        const trips = journeysOf(raw, from);
        if (trips.length) {
            try {
                this.options.scene()?.addJourneys?.(trips);
            } catch {
                // (A scene without it: the log says it all the same.)
            }
        }
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
        // Decision 418: and the record's carers (keepers, farmers, pet owners at work), as often.
        fetch(url.replace(/\/dormant$/, "/carers"))
            .then((response) => (response.ok ? response.json() : null))
            .then((body: {carers?: {v?: unknown} | null} | null) => {
                if (!this.disposed && body) this.options.scene()?.setCarers?.(body.carers ?? null);
            })
            .catch(() => {
                // (No answer: no carers drawn; asked again later.)
            });
        // Vegetation (decision 417 (1)): and how grazed the grass is, as often (null while the server's is off).
        fetch(url.replace(/\/dormant$/, "/vegetation"))
            .then((response) => (response.ok ? response.json() : null))
            .then((body: {vegetation?: unknown} | null) => {
                if (!this.disposed && body) this.options.scene()?.setVegetation?.(body.vegetation ?? null, this.options.words?.life);
            })
            .catch(() => {
                // (No answer: the grass as it stands; asked again later.)
            });
        // p5 (humans): and the town's couples and their children (the server's courtship), as often.
        fetch(url.replace(/\/dormant$/, "/human-bonds"))
            .then((response) => (response.ok ? response.json() : null))
            .then((body: unknown) => {
                if (!this.disposed && body) this.options.scene()?.setHumanBonds?.(body);
            })
            .catch(() => {
                // (No answer: everyone goes about their own day; asked again later.)
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
        const clutches = new Map<string, {key: string; parents: string[]; young: string[]; t0: number; held: number}>();
        for (const event of events) {
            if (event.kind !== "birth" || !event.from_egg || !event.animal || !event.parents.length) continue;
            const t0 = Date.parse(event.at) / 1000;
            if (!Number.isFinite(t0)) continue;
            const key = `hatch:${event.at}:${[...event.parents].sort().join(",")}`;
            const clutch = clutches.get(key);
            if (clutch) clutch.young.push(event.animal.id);
            else clutches.set(key, {key, parents: [...event.parents], young: [event.animal.id], t0, held: arkActStartOf(event.at)});
        }
        if (!clutches.size) return;
        try {
            this.options.scene()?.addHatchings?.(Array.from(clutches.values()));
        } catch {
            // (A scene without it: the log says it all the same.)
        }
    }

    /**
     * ARK-MATING-SHOWN: the record's layings for the scene (`addLayings`): its parents, its eggs, its time and when it
     * hatches (the row's `clutch.hatch_ark_day` on the Ark clock: from the voyage's start, else from the row's own day).
     */
    private laid(raw: unknown) {
        const list: unknown[] = Array.isArray(raw) ? raw : raw && typeof raw === "object" && Array.isArray((raw as {events?: unknown}).events) ? (raw as {events: unknown[]}).events : [];
        const start = Date.parse(this.current?.voyage.started_at ?? "");
        const out: Array<{key: string; parents: string[]; eggs: number | null; t0: number; hatchAt: number}> = [];
        for (const item of list) {
            const row = item as {kind?: unknown; id?: unknown; at?: unknown; ark_day?: unknown; parents?: unknown; clutch?: {eggs?: unknown; hatch_ark_day?: unknown} | null} | null;
            if (!row || row.kind !== "laid" || !Array.isArray(row.parents) || !row.parents.length) continue;
            const t0 = Date.parse(String(row.at)) / 1000;
            const hatch = typeof row.clutch?.hatch_ark_day === "number" ? row.clutch.hatch_ark_day : NaN;
            const hatchAt = (Number.isFinite(start) ? start + hatch * ARK_DAY_MS : typeof row.ark_day === "number" ? t0 * 1000 + (hatch - row.ark_day) * ARK_DAY_MS : NaN) / 1000;
            if (Number.isFinite(t0)) out.push({key: `laid:${String(row.id)}`, parents: row.parents.filter((p): p is string => typeof p === "string"), eggs: typeof row.clutch?.eggs === "number" ? row.clutch.eggs : null, t0, hatchAt});
        }
        if (!out.length) return;
        try {
            this.options.scene()?.addLayings?.(out);
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
            // (V1: held until the record is out, `ark-act-hold.ts`: the birth is seen, not only the nursing after it.)
            const t0 = arkActStartOf(event.at);
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
            .then(async (body: {events?: unknown; available?: boolean; more?: boolean; heartsRules?: unknown} | null) => {
                if (this.disposed) return;
                if (!body || body.available === false) {
                    this.newcomers(before, next);
                    return;
                }
                // (Which rule the server runs for a heart: absent from one that does not say, and the lines are today's.)
                this.heartsRules = decodeArkHeartsRules(body.heartsRules);
                // (V1: everyone the rows' acts name is brought into the scene before the layers are fed.)
                await this.casting(body.events ?? []);
                if (this.disposed) return;
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
                this.ate(events); // V1
                this.mate(events);
                this.died(events); // 3.3 fix (log)
                this.born(events);
                // (ARK-MATING-SHOWN: its rows as released, the ones this read had not said.)
                this.laid((Array.isArray(body.events) ? (body.events as Array<{id?: unknown}>) : []).filter((row) => events.some((event) => String(event.id) === String(row?.id))));
                this.hatched(events); // 3.3 batch (B)
                this.push(this.staying(recordItems(events), (id) => Date.parse(events.find((event) => String(event.id) === id)?.at ?? "")));
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
        if (now - this.crisesAt > this.crisesEvery) this.readCrises(); // V1
        this.seen?.tick(); // V1: the casts whose act is over let go
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
                    const items = own.concat(antItems(seen.acts, this.memory, this.text, this.locale), arkSeenItems(english ? {acts: seen.acts.filter((act) => !act.line), alarms: seen.alarms} : seen, this.memory)).filter((item) => (this.nowSaid.get(`${item.focus.animalId}:${item.kind}`) ?? 0) < Date.now());
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
    focus(line: Pick<ArkLiveLine, "focus"> & Partial<Pick<ArkLiveLine, "id" | "kind">>, watched = false) {
        const scene = this.options.scene();
        if (!scene) return;
        const {animalId, speciesId, zone} = line.focus;
        const done = () => this.options.onFocused?.(line as ArkLiveLine);
        this.youngWait = null;
        // V1: a line whose act is under way or about to begin is watched (`seen/watch.ts`): everyone it names held in one
        // picture. When the watch ends on its own, the line's own focus, as its tap always was.
        if (!watched && this.seen && line.id && (line.kind === "meal" || line.kind === "mated" || line.kind === "birth" || line.kind === "hatched" || line.kind === "death" || line.kind === "starved" || line.kind === "extinction" || (line as Partial<ArkLiveLine>).say === "escaped")) {
            const eventId = String(line.id).replace(/^event:/, "");
            const text = (() => {
                try {
                    return this.lineText(line as ArkLiveLine);
                } catch {
                    return "";
                }
            })();
            if (this.seen.watch(eventId, text, (why) => {
                if (why === "done" && !this.disposed) this.focus(line, true);
            })) return done();
        }
        this.seen?.stop();
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
        this.seen?.dispose();
        this.seen = null;
        this.view.dispose();
    }
}
