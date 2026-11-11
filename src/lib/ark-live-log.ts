/**
 * The Ark's live log (owner, 2026-11-11: "maybe a log on-screen to show what's happening e.g. any animals getting
 * eaten, any mating happening etc."). Pure: the scene's DOM log (`src/ark-scene/live/log-view.ts`), on /ark and
 * in the apps' embed, draws what this decides.
 *
 * Two sources, never mixed up:
 * - **The Ark's record** (`server`): the server's event log (`voyage_events_since_v1`, decoded by
 *   `decodeArkEvents`): arrivals, births and hatchings, clutches laid, meals (the predator named), deaths of old
 *   age, starvation, a kind gone. The server decides every one of them; this only says them.
 * - **Seen** (`seen`): behaviour the shared deterministic layers are showing right now near the camera, in view
 *   (the recipes' courtship, rival contests, fishing catches of the ambient fish, nest building; the reactive
 *   layer's alarm calls). Said in the present tense, marked "Seen", never a server fact, and never a change in
 *   who is aboard.
 *
 * Privacy: a line names species only. Never a bringer's label or name, never a person, never a place.
 *
 * Rate: at most a few lines at once, each fading after a while; repeats within a short window fold into one line
 * with a count ("3 House Sparrows came aboard"), a burst bigger than the log ends in "+N more", and seen lines
 * come no more often than one every few seconds.
 */

import type {ArkZone} from "@/ark-scene/types";
import type {ArkEvent, ArkEventAnimal} from "@/lib/ark-life";
import {pluralAnimalName} from "@/lib/ark-population";
import {fillArkWords, type ArkWords} from "@/lib/ark-words";

export type ArkLiveServerKind = "arrival" | "birth" | "hatched" | "laid" | "meal" | "death" | "starved" | "extinction";
export type ArkLiveSeenKind = "courting" | "contest" | "fishing" | "nest" | "alarm";
export type ArkLiveKind = ArkLiveServerKind | ArkLiveSeenKind | "more";
export type ArkLiveSource = "server" | "seen";

/** Where a line's tap flies the camera: the animal itself when it is aboard, else one of its kind, else its zone. */
export type ArkLiveFocus = {animalId: string | null; speciesId: string | null; zone: ArkZone | null};

export type ArkLiveItem = {
    /** Unique: the event's id, or the seen episode's. */
    id: string;
    kind: ArkLiveKind;
    source: ArkLiveSource;
    /** What folds repeats into one line: the kind and the species (a meal: both species). */
    key: string;
    /** The species' name (the predator's, for a meal; the caller's, for an alarm). */
    animal: string;
    /** The prey, for a meal. */
    other: string | null;
    /** How many: young in a litter, animals in a grouped line, events folded in. */
    count: number;
    /** A clutch's eggs, when the server says. */
    eggs: number | null;
    focus: ArkLiveFocus;
};

/** A line on screen: an item, when it came in, and when it last grew. */
export type ArkLiveLine = ArkLiveItem & {shownAt: number; updatedAt: number};

// MARK: The Ark's record

function speciesOf(animal: Pick<ArkEventAnimal, "species_profile_id" | "model_slug">): string {
    return animal.species_profile_id || `slug:${animal.model_slug}`;
}

function focusOn(animal: ArkEventAnimal | null): ArkLiveFocus {
    return {animalId: animal?.id ?? null, speciesId: animal ? speciesOf(animal) : null, zone: animal?.zone ?? null};
}

/**
 * The server's events as log items, oldest first. A meal and its `eaten` row are one item (the predator named);
 * a litter is one item with its young counted; milestones, hunger, feeding and revisions are not said.
 */
export function arkLiveServerItems(events: readonly ArkEvent[]): ArkLiveItem[] {
    const items: ArkLiveItem[] = [];
    const litters = new Map<string, ArkLiveItem>();
    for (const event of events) {
        const animal = event.animal;
        switch (event.kind) {
            case "arrival":
                if (animal) items.push({id: event.id, kind: "arrival", source: "server", key: `arrival:${speciesOf(animal)}`, animal: animal.name, other: null, count: 1, eggs: null, focus: focusOn(animal)});
                break;
            case "birth": {
                if (!animal) break;
                const kind = event.from_egg ? "hatched" : "birth";
                const litterKey = `${kind}|${event.at}|${[...event.parents].sort().join(",")}`;
                const litter = litters.get(litterKey);
                if (litter) {
                    litter.count++;
                    break;
                }
                const item: ArkLiveItem = {id: event.id, kind, source: "server", key: `${kind}:${speciesOf(animal)}`, animal: animal.name, other: null, count: 1, eggs: null, focus: focusOn(animal)};
                litters.set(litterKey, item);
                items.push(item);
                break;
            }
            case "laid":
                if (animal) items.push({id: event.id, kind: "laid", source: "server", key: `laid:${speciesOf(animal)}`, animal: animal.name, other: null, count: 1, eggs: event.eggs, focus: {...focusOn(animal), animalId: event.parents[0] ?? animal.id}});
                break;
            case "meal":
                if (animal && event.other) items.push({id: event.id, kind: "meal", source: "server", key: `meal:${speciesOf(animal)}:${speciesOf(event.other)}`, animal: animal.name, other: event.other.name, count: 1, eggs: null, focus: focusOn(animal)});
                break;
            case "death_old":
            case "starved":
                if (animal) items.push({id: event.id, kind: event.kind === "starved" ? "starved" : "death", source: "server", key: `${event.kind}:${speciesOf(animal)}`, animal: animal.name, other: null, count: 1, eggs: null, focus: {...focusOn(animal), animalId: null}});
                break;
            case "extinction": {
                const name = event.species?.name || animal?.name || "";
                if (name) items.push({id: event.id, kind: "extinction", source: "server", key: `extinction:${event.species?.id || name}`, animal: name, other: null, count: 1, eggs: null, focus: {animalId: null, speciesId: null, zone: animal?.zone ?? null}});
                break;
            }
            default:
                // `eaten` is the meal's other half; milestones, hunger, feeding and revisions are not said.
                break;
        }
    }
    return items;
}

/** The animals a snapshot gained, as items: what the log says when the server's event log can't be read. */
export function arkLiveArrivalsFromSnapshot(animals: ReadonlyArray<{id: string; species_profile_id: string; model_slug: string; name: string; zone: ArkZone; origin?: "arrived" | "born"}>): ArkLiveItem[] {
    return animals.map((animal) => {
        const kind = animal.origin === "born" ? "birth" : "arrival";
        const species = animal.species_profile_id || `slug:${animal.model_slug}`;
        return {id: `new:${animal.id}`, kind, source: "server", key: `${kind}:${species}`, animal: animal.name, other: null, count: 1, eggs: null, focus: {animalId: animal.id, speciesId: species, zone: animal.zone}};
    });
}

// MARK: Seen

/** What the scene reports near the camera (`ArkSceneHandle.seen`): visible animals running one of the logged recipes. */
export type ArkSeenAct = {id: string; name: string; speciesId: string; zone: ArkZone; recipe: string; episode: string; block: string; /** It has a fish now (the catch came off, or it carries one). */ fish: boolean};
/** An alarm call by a visible animal near the camera (the reactive layer), with what it called about when known. */
export type ArkSeenAlarm = {id: string; name: string; speciesId: string; zone: ArkZone; at: number; threat: string | null};
export type ArkSeenNow = {acts: ArkSeenAct[]; alarms: ArkSeenAlarm[]};

const SEEN_RECIPES: Record<string, Exclude<ArkLiveSeenKind, "alarm">> = {
    court_display: "courting",
    court_dance: "courting",
    strut_display: "courting",
    antler_clash: "contest",
    horn_clash: "contest",
    jaw_spar: "contest",
    box_spar: "contest",
    lizard_contest: "contest",
    wrestle: "contest",
    perch_plunge: "fishing",
    air_plunge: "fishing",
    talon_grab: "fishing",
    wade_spear: "fishing",
    bill_sweep: "fishing",
    pouch_scoop: "fishing",
    surface_dive: "fishing",
    chase_fish: "fishing",
    river_fish: "fishing",
    nest_build: "nest",
    beach_nest: "nest"
};

/** The blocks that are the thing itself (not the walk to it): a display or a dance, a clash, carrying or placing material. */
const SEEN_BLOCKS: Record<Exclude<ArkLiveSeenKind, "alarm" | "fishing">, ReadonlySet<string>> = {
    courting: new Set(["display", "dance"]),
    contest: new Set(["fight", "clash", "box", "rear"]),
    nest: new Set(["pick_up", "place", "dig"])
};

/** The log's kind for a recipe, or null when it isn't one the log says (the scene asks this per visible actor). */
export function arkSeenKind(recipe: string): Exclude<ArkLiveSeenKind, "alarm"> | null {
    return SEEN_RECIPES[recipe] ?? null;
}

/** Seen episodes already said (bounded), so one courtship or one catch is one line however long it is in view. */
export class ArkSeenMemory {
    private readonly said = new Set<string>();
    constructor(private readonly max = 400) {}
    has(id: string): boolean {
        return this.said.has(id);
    }
    add(id: string) {
        this.said.add(id);
        if (this.said.size > this.max) this.said.delete(this.said.values().next().value as string);
    }
}

/**
 * New seen items from what the scene reports now: an episode is said once, when its characteristic part is in
 * view (a fishing episode only once it has its fish); an alarm call once. Pair episodes (two rivals, a courting
 * pair) share one episode, so they are one line.
 */
export function arkSeenItems(now: ArkSeenNow, memory: ArkSeenMemory): ArkLiveItem[] {
    const items: ArkLiveItem[] = [];
    for (const act of now.acts) {
        const kind = arkSeenKind(act.recipe);
        if (!kind) continue;
        const shown = kind === "fishing" ? act.fish : SEEN_BLOCKS[kind].has(act.block);
        const id = `seen:${act.episode}`;
        if (!shown || memory.has(id)) continue;
        memory.add(id);
        items.push({id, kind, source: "seen", key: `${kind}:${act.speciesId}`, animal: act.name, other: null, count: 1, eggs: null, focus: {animalId: act.id, speciesId: act.speciesId, zone: act.zone}});
    }
    for (const call of now.alarms) {
        const id = `seen:alarm:${call.id}:${Math.round(call.at * 10)}`;
        if (memory.has(id)) continue;
        memory.add(id);
        items.push({id, kind: "alarm", source: "seen", key: `alarm:${call.speciesId}`, animal: call.name, other: null, count: 1, eggs: null, focus: {animalId: call.id, speciesId: call.speciesId, zone: call.zone}});
    }
    return items;
}

// MARK: The log

export type ArkLiveLogOptions = {
    /** Lines on screen at most. */
    maxLines: number;
    /** How long a line of the record stays (ms), and a seen one. */
    serverLife: number;
    seenLife: number;
    /** A repeat within this long of a line (ms) folds into it. */
    groupWindow: number;
    /** At least this long between two lines (ms), and between two seen lines. */
    gap: number;
    seenGap: number;
    /** A seen item still waiting after this long (ms) is dropped: it is no longer happening. */
    seenStale: number;
    /** Record items waiting at most; more fold into one "+N more" line. */
    maxQueue: number;
};

export const ARK_LIVE_LOG_DEFAULTS: ArkLiveLogOptions = {maxLines: 4, serverLife: 15_000, seenLife: 9_000, groupWindow: 10_000, gap: 1_100, seenGap: 6_000, seenStale: 4_000, maxQueue: 6};

/** The kinds the record keeps first when a burst is bigger than the log: the rare and the sad before the many. */
const PRIORITY: Record<ArkLiveKind, number> = {extinction: 0, meal: 1, starved: 2, death: 3, birth: 4, hatched: 4, laid: 5, arrival: 6, courting: 7, contest: 7, fishing: 7, nest: 7, alarm: 7, more: 8};

/**
 * The log's state: the lines on screen and the items waiting. `push` takes new items, `step` lets the next one
 * through when its turn has come and drops lines whose time is up; both return whether anything changed.
 */
export class ArkLiveLog {
    lines: ArkLiveLine[] = [];
    private queue: Array<ArkLiveItem & {queuedAt: number}> = [];
    private lastShown = -Infinity;
    private lastSeen = -Infinity;
    private readonly options: ArkLiveLogOptions;

    constructor(options: Partial<ArkLiveLogOptions> = {}) {
        this.options = {...ARK_LIVE_LOG_DEFAULTS, ...options};
    }

    get waiting(): number {
        return this.queue.length;
    }

    push(items: readonly ArkLiveItem[], now: number): boolean {
        let changed = false;
        for (const item of items) {
            // Folded into a line still on screen.
            const line = this.lines.find((l) => l.key === item.key && l.kind !== "more" && now - l.updatedAt < this.options.groupWindow);
            if (line) {
                line.count += item.count;
                line.updatedAt = now;
                if (item.focus.animalId && item.source === "server" && item.kind !== "death" && item.kind !== "starved") line.focus = item.focus;
                changed = true;
                continue;
            }
            // Or into one waiting.
            const waiting = this.queue.find((q) => q.key === item.key);
            if (waiting) {
                waiting.count += item.count;
                continue;
            }
            this.queue.push({...item, queuedAt: now});
        }
        // A burst bigger than the log: the rarest kinds stay, the rest become "+N more".
        const record = this.queue.filter((q) => q.source === "server" && q.kind !== "more");
        if (record.length > this.options.maxQueue) {
            const keep = new Set([...record].sort((a, b) => PRIORITY[a.kind] - PRIORITY[b.kind]).slice(0, this.options.maxQueue - 1));
            let folded = 0;
            this.queue = this.queue.filter((q) => {
                if (q.source !== "server" || q.kind === "more" || keep.has(q)) return true;
                folded += q.count;
                return false;
            });
            const more = this.queue.find((q) => q.kind === "more");
            if (more) more.count += folded;
            else this.queue.push({id: `more:${now}`, kind: "more", source: "server", key: `more:${now}`, animal: "", other: null, count: folded, eggs: null, focus: {animalId: null, speciesId: null, zone: null}, queuedAt: now});
        }
        return changed;
    }

    step(now: number): boolean {
        let changed = false;
        const before = this.lines.length;
        this.lines = this.lines.filter((line) => now - line.updatedAt < (line.source === "seen" ? this.options.seenLife : this.options.serverLife));
        if (this.lines.length !== before) changed = true;
        // Seen items that waited too long are no longer happening.
        const queued = this.queue.length;
        this.queue = this.queue.filter((q) => q.source !== "seen" || now - q.queuedAt < this.options.seenStale);
        if (this.queue.length !== queued) changed = true;
        if (now - this.lastShown < this.options.gap) return changed;
        // The record first, oldest first; a seen item only when none of the record waits and its own gap has passed.
        let at = this.queue.findIndex((q) => q.source === "server" && q.kind !== "more");
        if (at < 0) at = this.queue.findIndex((q) => q.kind === "more");
        if (at < 0 && now - this.lastSeen >= this.options.seenGap) at = this.queue.findIndex((q) => q.source === "seen");
        if (at < 0) return changed;
        const [item] = this.queue.splice(at, 1);
        const {queuedAt: _queuedAt, ...line} = item;
        this.lines.push({...line, shownAt: now, updatedAt: now});
        if (this.lines.length > this.options.maxLines) this.lines.splice(0, this.lines.length - this.options.maxLines);
        this.lastShown = now;
        if (item.source === "seen") this.lastSeen = now;
        return true;
    }

    clear() {
        this.lines = [];
        this.queue = [];
    }
}

// MARK: Words

/** The words a line needs: the Ark's live words, and the replay's (articles, the meal, a death). */
export type ArkLiveText = Pick<ArkWords, "live" | "replay">;

function capitalised(text: string): string {
    return text ? text[0].toLocaleUpperCase() + text.slice(1) : text;
}

/** "a Plains Zebra", "an Arctic Fox" in English; the language's own form elsewhere (`replay.a` / `replay.an`). */
export function arkWithArticle(name: string, words: ArkLiveText): string {
    const an = /^[aeiou]/i.test(name) && !/^(uni|eu|one|use|usu|ura)/i.test(name);
    return fillArkWords(an ? words.replay.an : words.replay.a, {animal: name});
}

function isEnglish(locale: string): boolean {
    return /^en(\b|[-_])/i.test(locale) || locale.toLowerCase() === "en";
}

/** A line as the reader reads it. `locale`: the words' language (English names take their plural). */
export function arkLiveLineText(line: Pick<ArkLiveItem, "kind" | "animal" | "other" | "count" | "eggs">, words: ArkLiveText, locale: string): string {
    const live = words.live;
    const replay = words.replay;
    const many = line.count > 1;
    const count = line.count.toLocaleString(locale);
    const aAnimal = capitalised(arkWithArticle(line.animal, words));
    const animals = isEnglish(locale) ? pluralAnimalName(line.animal) : line.animal;
    const times = (text: string) => (many ? `${text} ×${count}` : text);
    switch (line.kind) {
        case "arrival":
            return many ? fillArkWords(live.arrivalOther, {count, animals}) : fillArkWords(live.arrivalOne, {aAnimal});
        case "birth":
            return many ? fillArkWords(live.birthOther, {count, animal: line.animal}) : fillArkWords(live.birthOne, {aAnimal});
        case "hatched":
            return many ? fillArkWords(live.hatchedOther, {count, animal: line.animal}) : fillArkWords(live.hatchedOne, {aAnimal});
        case "laid": {
            const eggs = line.eggs;
            const one = eggs === 1 ? fillArkWords(replay.laidOne, {aAnimal}) : eggs ? fillArkWords(replay.laidOther, {aAnimal, count: eggs.toLocaleString(locale)}) : fillArkWords(replay.laidSome, {aAnimal});
            return times(one);
        }
        case "meal":
            return times(fillArkWords(replay.meal, {predator: line.animal, aPrey: arkWithArticle(line.other ?? "", words)}));
        case "death":
            return many ? fillArkWords(live.deathOther, {count, animals}) : fillArkWords(replay.death, {animal: line.animal});
        case "starved":
            return times(fillArkWords(replay.starved, {animal: line.animal}));
        case "extinction":
            return fillArkWords(replay.extinction, {animal: line.animal});
        case "courting":
            return times(fillArkWords(live.courting, {aAnimal}));
        case "contest":
            return times(fillArkWords(live.contest, {animal: line.animal}));
        case "fishing":
            return times(fillArkWords(live.fishing, {aAnimal}));
        case "nest":
            return times(fillArkWords(live.nest, {aAnimal}));
        case "alarm":
            return times(fillArkWords(live.alarm, {aAnimal}));
        case "more":
            return fillArkWords(live.more, {count});
    }
}
