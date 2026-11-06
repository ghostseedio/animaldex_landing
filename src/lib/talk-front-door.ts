/**
 * The Talk front door on the web (AnimalDex docs/talk-front-door/SPEC.md,
 * sections 4.2 to 4.6): a box that says "What's on your mind?" on Companions
 * and /talk, and chooses which animal hears it. The rules of section 4.3,
 * pure, so they are tested; the band (components/talk-front-door) draws them.
 *
 * - Before any suggestion: the animal they talked to last, else their newest
 *   card, else the first "Meet one now" animal (on /talk, for a guest, the
 *   first featured animal).
 * - A suggestion (`talk_suggest`, SPEC 6.1) runs only for a draft of 12
 *   characters or more, after a 700 ms pause, when at least 3 words changed
 *   since the last call, and at most 4 times a draft. Shorter drafts never
 *   run it: they go to the default.
 * - A successful answer makes its `pick` the chosen animal with its reason;
 *   anything else keeps the current choice, with no message.
 * - A Change tap wins: nothing moves the choice again for that draft.
 * - Sending before the suggestion for the current text came back waits for
 *   it, 2.5 s at most, then sends to whoever is chosen.
 * - Wild animals are asked for only with fewer than 5 of their own.
 */

/** The remote switch (`app_feature_flags`), off until the owner turns it on. */
export const TALK_FRONT_DOOR_FLAG = "talk_front_door";

export const SUGGEST_MIN_CHARS = 12;
export const SUGGEST_PAUSE_MS = 700;
export const SUGGEST_MIN_WORDS_CHANGED = 3;
export const SUGGEST_MAX_CALLS = 4;
export const SEND_WAIT_MS = 2500;
/** Wild animals are offered while they hold fewer than this many of their own. */
export const WILD_BELOW = 5;
/** The cross-fade when the chosen animal changes. */
export const PICK_FADE_MS = 180;
/** The server's limit on a draft (`talk_suggest.text`, 1 to 2000 characters). */
export const FRONT_DOOR_TEXT_MAX = 2000;

export type FrontDoorWhy = "continuing" | "focus" | "lesson";
const WHYS: readonly FrontDoorWhy[] = ["continuing", "focus", "lesson"];

// MARK: - Words

/** Word for word with the apps (SPEC section 7). `{name}` is the chosen animal. */
export const TALK_FRONT_DOOR_WORDS_EN = {
    placeholder: "What's on your mind?",
    sendTo: "Send to {name}",
    change: "Change",
    whyContinuing: "Carrying on from earlier",
    whyFocus: "Working on this with you",
    whyLesson: "Fits best"
} as const;

export type TalkFrontDoorWords = {[Key in keyof typeof TALK_FRONT_DOOR_WORDS_EN]: string};

/** The locale's `talkFrontDoor` words, English for any it lacks. */
export function talkFrontDoorWords(raw: unknown): TalkFrontDoorWords {
    const given = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
    return Object.fromEntries(Object.entries(TALK_FRONT_DOOR_WORDS_EN).map(([key, value]) => {
        const candidate = given[key];
        return [key, typeof candidate === "string" && candidate.trim() ? candidate : value];
    })) as TalkFrontDoorWords;
}

/** The reason line under the name, from the server's `why` key (the clients own the sentences, SPEC 6.2). */
export function frontDoorReason(why: FrontDoorWhy | null, words: TalkFrontDoorWords): string | null {
    if (why === "continuing") return words.whyContinuing;
    if (why === "focus") return words.whyFocus;
    if (why === "lesson") return words.whyLesson;
    return null;
}

// MARK: - Animals

/** One animal the box can send to. */
export type FrontDoorAnimal = {
    /** One per animal: `species:<id>`, or `slug:<slug>` for a featured animal known only by its slug. */
    key: string;
    kind: "own" | "wild";
    speciesProfileId: string | null;
    /** Their card its chat opens on (their own animals only). */
    captureId: string | null;
    /** Its icon art and its chat's slug. */
    slug: string | null;
    /** What the "to" line calls it ("Luna the Gray Wolf", "Common Octopus"). */
    name: string;
    power: string | null;
    /** Its icon art's own address, when the server knows it. */
    icon?: string | null;
};

/** One of their own animals, with what the default and the Change row are ordered by (epoch ms, null when never). */
export type OwnFrontDoorAnimal = FrontDoorAnimal & {
    kind: "own";
    /** When they last said something to it: the server's last talk, or this browser's last message. */
    lastTalkedAt: number | null;
    /** When the row last moved (a message either way, a chat, the bond). */
    lastActivityAt: number | null;
    /** Their newest card of it. */
    capturedAt: number | null;
};

export function frontDoorSpeciesKey(speciesProfileId: string): string {
    return `species:${speciesProfileId.trim().toLowerCase()}`;
}

export function frontDoorSlugKey(slug: string): string {
    return `slug:${slug.trim().toLowerCase()}`;
}

/** A featured (or "Meet one now") animal from the Talk catalog: wild, known by its slug. */
export function featuredFrontDoorAnimal(animal: {slug: string; name: string; power: string | null; icon?: string | null}): FrontDoorAnimal {
    return {key: frontDoorSlugKey(animal.slug), kind: "wild", speciesProfileId: null, captureId: null, slug: animal.slug, name: animal.name, power: animal.power, icon: animal.icon ?? null};
}

/**
 * The "Meet one now" animals on Companions: the web's own (the Common
 * Octopus, `TRY_TALKING_SPECIES`) first, then the featured ones.
 */
export function meetOneNowAnimals(featured: FrontDoorAnimal[], firstSlug: string | null): FrontDoorAnimal[] {
    if (!firstSlug) return featured;
    const first = featured.find((animal) => animal.slug === firstSlug);
    return first ? [first, ...featured.filter((animal) => animal !== first)] : featured;
}

function newestBy<T>(items: T[], at: (item: T) => number | null): T | null {
    let best: T | null = null;
    let bestAt = Number.NEGATIVE_INFINITY;
    for (const item of items) {
        const value = at(item);
        if (value === null || !Number.isFinite(value) || value <= bestAt) continue;
        best = item;
        bestAt = value;
    }
    return best;
}

/**
 * Before any suggestion: the animal they talked to last, else their newest
 * card, else the first "Meet one now" animal; null when there is none at all.
 */
export function defaultFrontDoorAnimal(own: OwnFrontDoorAnimal[], meetOneNow: FrontDoorAnimal[]): FrontDoorAnimal | null {
    return newestBy(own, (animal) => animal.lastTalkedAt)
        ?? newestBy(own, (animal) => animal.capturedAt)
        ?? own[0]
        ?? meetOneNow[0]
        ?? null;
}

/** Wild animals are asked for only while they have fewer than 5 of their own; with none, wild ones are all there is. */
export function includeWild(ownCount: number): boolean {
    return ownCount < WILD_BELOW;
}

// MARK: - The suggestion's answer (SPEC 6.1)

export type TalkCandidate = {
    speciesProfileId: string;
    captureId: string | null;
    animal: string;
    nickname: string | null;
    powerName: string;
    kind: "own" | "wild";
    /** Added by the website's route: its chat's slug, for the face and the chat. */
    slug: string | null;
};

export type TalkSuggestion = {
    pick: TalkCandidate | null;
    why: FrontDoorWhy | null;
    also: TalkCandidate[];
    pickedBy: "model" | "keywords" | "default";
    candidates: TalkCandidate[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function text(value: unknown): string | null {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

function uuid(value: unknown): string | null {
    const raw = text(value);
    return raw && UUID.test(raw) ? raw.toLowerCase() : null;
}

export function decodeTalkCandidate(raw: unknown): TalkCandidate | null {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const row = raw as Record<string, unknown>;
    const speciesProfileId = uuid(row.species_profile_id);
    const animal = text(row.animal);
    const kind = row.kind === "own" || row.kind === "wild" ? row.kind : null;
    if (!speciesProfileId || !animal || !kind) return null;
    const slug = text(row.slug);
    return {
        speciesProfileId,
        captureId: kind === "own" ? uuid(row.capture_id) : null,
        animal,
        nickname: text(row.nickname),
        powerName: text(row.power_name) ?? "",
        kind,
        slug: slug && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? slug : null
    };
}

function candidates(raw: unknown, max: number): TalkCandidate[] {
    if (!Array.isArray(raw)) return [];
    const seen = new Set<string>();
    const out: TalkCandidate[] = [];
    for (const item of raw) {
        const candidate = decodeTalkCandidate(item);
        if (!candidate || seen.has(candidate.speciesProfileId)) continue;
        seen.add(candidate.speciesProfileId);
        out.push(candidate);
        if (out.length >= max) break;
    }
    return out;
}

/** A `talk_suggest` answer, or null when it is not one (which keeps the current choice). */
export function decodeTalkSuggestion(raw: unknown): TalkSuggestion | null {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const body = raw as Record<string, unknown>;
    if (!("pick" in body) || !Array.isArray(body.candidates)) return null;
    const pick = decodeTalkCandidate(body.pick);
    const why = WHYS.includes(body.why as FrontDoorWhy) ? body.why as FrontDoorWhy : null;
    const pickedBy = body.picked_by === "model" || body.picked_by === "keywords" ? body.picked_by : "default";
    return {
        pick,
        why: pick ? why : null,
        also: candidates(body.also, 2).filter((candidate) => candidate.speciesProfileId !== pick?.speciesProfileId),
        pickedBy,
        candidates: candidates(body.candidates, 40)
    };
}

/**
 * The animal a candidate is: one of theirs is their own row (its name, the
 * card its chat opens on), a wild one is drawn from the candidate. Null when
 * it cannot be shown or opened (no slug for a wild one, a card they no longer
 * hold).
 */
export function animalForCandidate(candidate: TalkCandidate, own: OwnFrontDoorAnimal[]): FrontDoorAnimal | null {
    const key = frontDoorSpeciesKey(candidate.speciesProfileId);
    if (candidate.kind === "own") {
        const mine = own.find((animal) => animal.key === key);
        if (mine) return mine.power || !candidate.powerName ? mine : {...mine, power: candidate.powerName};
        if (!candidate.captureId || !candidate.slug) return null;
        return {
            key,
            kind: "own",
            speciesProfileId: candidate.speciesProfileId,
            captureId: candidate.captureId,
            slug: candidate.slug,
            name: candidate.nickname ?? candidate.animal,
            power: candidate.powerName || null
        };
    }
    if (!candidate.slug) return null;
    return {key, kind: "wild", speciesProfileId: candidate.speciesProfileId, captureId: null, slug: candidate.slug, name: candidate.animal, power: candidate.powerName || null};
}

// MARK: - The draft

/** What one draft has asked so far. A new draft (the field emptied, or sent) starts again. */
export type FrontDoorDraft = {
    /** The text the last call was made for; null before any. */
    lastCalledText: string | null;
    calls: number;
    /** The text whose answer came back last. */
    answeredText: string | null;
    /** The text a call is out for. */
    pendingText: string | null;
    /** A Change tap: nothing moves the choice again for this draft. */
    manual: boolean;
};

export const NEW_DRAFT: FrontDoorDraft = {lastCalledText: null, calls: 0, answeredText: null, pendingText: null, manual: false};

/** The draft as sent: spaces folded, trimmed, at most the server's length. */
export function frontDoorText(raw: string): string {
    return raw.replace(/\s+/g, " ").trim().slice(0, FRONT_DOOR_TEXT_MAX);
}

/** Long enough to ask who should hear it ("hi", "ok" never are). */
export function isSuggestable(raw: string): boolean {
    return frontDoorText(raw).length >= SUGGEST_MIN_CHARS;
}

/**
 * Its words, lower case: runs of letters and digits, and each character of a
 * script written without spaces (Chinese, Japanese) as a word of its own.
 */
export function frontDoorWords(raw: string): string[] {
    return raw.toLowerCase().match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]|[\p{L}\p{N}\p{M}'’]+/gu) ?? [];
}

/** How many words changed between two drafts: the larger of the words added and the words taken away (a word replaced is one). */
export function wordsChanged(before: string, after: string): number {
    const counts = new Map<string, number>();
    for (const word of frontDoorWords(before)) counts.set(word, (counts.get(word) ?? 0) + 1);
    let added = 0;
    for (const word of frontDoorWords(after)) {
        const left = counts.get(word) ?? 0;
        if (left > 0) counts.set(word, left - 1);
        else added += 1;
    }
    let removed = 0;
    counts.forEach((left) => {
        removed += left;
    });
    return Math.max(added, removed);
}

/** Whether a call may go out for this text, the pause aside: long enough, calls left, no Change tap, 3 words changed. */
function callAllowed(draft: FrontDoorDraft, raw: string): boolean {
    const now = frontDoorText(raw);
    return !draft.manual
        && now.length >= SUGGEST_MIN_CHARS
        && draft.calls < SUGGEST_MAX_CALLS
        && now !== draft.pendingText
        && wordsChanged(draft.lastCalledText ?? "", now) >= SUGGEST_MIN_WORDS_CHANGED;
}

/**
 * Whether the suggestion runs now, as they type: it may run at all
 * (`canSuggest`: signed in, past Talk's gate, the switch on), they paused for
 * 700 ms since the last edit, and the draft qualifies.
 */
export function suggestionDue(params: {draft: FrontDoorDraft; text: string; lastEditAt: number; now: number; canSuggest: boolean}): boolean {
    if (!params.canSuggest) return false;
    if (params.now - params.lastEditAt < SUGGEST_PAUSE_MS) return false;
    return callAllowed(params.draft, params.text);
}

/** A call went out for this text. */
export function draftCalled(draft: FrontDoorDraft, raw: string): FrontDoorDraft {
    const now = frontDoorText(raw);
    return {...draft, calls: draft.calls + 1, lastCalledText: now, pendingText: now};
}

/** The call for this text came back (answered or not): it is no longer out. */
export function draftAnswered(draft: FrontDoorDraft, raw: string, ok: boolean): FrontDoorDraft {
    const now = frontDoorText(raw);
    return {
        ...draft,
        pendingText: draft.pendingText === now ? null : draft.pendingText,
        answeredText: ok ? now : draft.answeredText
    };
}

/**
 * What Send does: send now; wait for the call already out for (about) this
 * text; or ask now and wait (they sent before the pause ended). Never with a
 * Change tap, a short draft, or no suggestion allowed.
 */
export function sendPlan(params: {draft: FrontDoorDraft; text: string; canSuggest: boolean}): "now" | "wait" | "call_and_wait" {
    const now = frontDoorText(params.text);
    const {draft} = params;
    if (!params.canSuggest || draft.manual || now.length < SUGGEST_MIN_CHARS) return "now";
    const covers = (other: string | null) => other !== null && wordsChanged(other, now) < SUGGEST_MIN_WORDS_CHANGED;
    if (covers(draft.pendingText)) return "wait";
    if (covers(draft.answeredText)) return "now";
    if (callAllowed(draft, now)) return "call_and_wait";
    return draft.pendingText !== null ? "wait" : "now";
}

// MARK: - The choice

export type FrontDoorChoice = {
    animal: FrontDoorAnimal | null;
    why: FrontDoorWhy | null;
    /** Who chose it: the rules before any answer, the suggestion, or a Change tap. */
    by: "default" | "suggestion" | "manual";
};

export function defaultChoice(animal: FrontDoorAnimal | null): FrontDoorChoice {
    return {animal, why: null, by: "default"};
}

/**
 * The choice as the text stands: a short draft goes to the default (a Change
 * tap still holds); otherwise it is left as it is.
 */
export function choiceForText(choice: FrontDoorChoice, raw: string, draft: FrontDoorDraft, fallback: FrontDoorAnimal | null): FrontDoorChoice {
    if (draft.manual) return choice;
    if (!isSuggestable(raw)) return choice.by === "default" && choice.animal?.key === fallback?.key ? choice : defaultChoice(fallback);
    if (choice.by === "default" && choice.animal?.key !== fallback?.key) return defaultChoice(fallback);
    return choice;
}

/**
 * A suggestion came back: its pick becomes the choice with its reason,
 * unless they picked by hand, it picked nobody, or its pick cannot be shown.
 */
export function applySuggestion(choice: FrontDoorChoice, suggestion: TalkSuggestion | null, draft: FrontDoorDraft, own: OwnFrontDoorAnimal[]): FrontDoorChoice {
    if (draft.manual || !suggestion?.pick) return choice;
    const animal = animalForCandidate(suggestion.pick, own);
    return animal ? {animal, why: suggestion.why, by: "suggestion"} : choice;
}

/** A Change tap: that animal, for the rest of the draft. Its reason stays only when it is the suggestion's own pick. */
export function pickManually(draft: FrontDoorDraft, choice: FrontDoorChoice, animal: FrontDoorAnimal): {draft: FrontDoorDraft; choice: FrontDoorChoice} {
    const sameAsSuggested = choice.by === "suggestion" && choice.animal?.key === animal.key;
    return {draft: {...draft, manual: true}, choice: {animal, why: sameAsSuggested ? choice.why : null, by: "manual"}};
}

/**
 * The Change row (SPEC 4.2): the fits (`pick`, then `also`), then the rest
 * of their animals by recent activity, then wild ones from `candidates` (or,
 * before any answer, the "Meet one now" or featured animals when that is all
 * they have). One face per animal.
 */
export function changeRowAnimals(params: {
    suggestion: TalkSuggestion | null;
    own: OwnFrontDoorAnimal[];
    /** Wild animals to offer before (or without) an answer: guests, and anyone with fewer than 5 of their own. */
    wildFallback: FrontDoorAnimal[];
    /** The animal chosen now, which is always in the row. */
    chosen?: FrontDoorAnimal | null;
}): FrontDoorAnimal[] {
    const out: FrontDoorAnimal[] = [];
    const keys = new Set<string>();
    const slugs = new Set<string>();
    const add = (animal: FrontDoorAnimal | null | undefined) => {
        if (!animal || keys.has(animal.key) || (animal.slug && slugs.has(animal.slug))) return;
        keys.add(animal.key);
        if (animal.slug) slugs.add(animal.slug);
        out.push(animal);
    };
    const {suggestion, own} = params;
    if (suggestion?.pick) add(animalForCandidate(suggestion.pick, own));
    for (const candidate of suggestion?.also ?? []) add(animalForCandidate(candidate, own));
    const recency = (animal: OwnFrontDoorAnimal) => Math.max(animal.lastActivityAt ?? Number.NEGATIVE_INFINITY, animal.lastTalkedAt ?? Number.NEGATIVE_INFINITY, animal.capturedAt ?? Number.NEGATIVE_INFINITY);
    [...own].sort((left, right) => recency(right) - recency(left) || left.name.localeCompare(right.name)).forEach(add);
    const wild = (suggestion?.candidates ?? []).filter((candidate) => candidate.kind === "wild");
    wild.forEach((candidate) => add(animalForCandidate(candidate, own)));
    if (wild.length === 0 && includeWild(own.length)) params.wildFallback.forEach(add);
    // The one chosen is always there to see, wherever it came from.
    if (params.chosen && !keys.has(params.chosen.key) && !(params.chosen.slug && slugs.has(params.chosen.slug))) out.unshift(params.chosen);
    return out;
}

// MARK: - Sending

/**
 * Where the chat opens with the message (SPEC 4.4): one of their animals on
 * its card (Companions: the card page with its chat open, as a row opens it;
 * /talk: its full-screen chat on the card), a wild one in its public chat.
 */
export function frontDoorChatHref(animal: FrontDoorAnimal, surface: "app" | "talk"): string | null {
    if (animal.kind === "own" && animal.captureId) {
        const card = encodeURIComponent(animal.captureId);
        return surface === "talk" && animal.slug ? `/talk/${animal.slug}?card=${card}` : `/app/capture/${card}?talk=1`;
    }
    return animal.slug ? `/talk/${animal.slug}` : null;
}

/** The message on its way to a chat that is opening: which chat, and when it was sent. */
export type FrontDoorHandoff = {
    text: string;
    captureId: string | null;
    speciesProfileId: string | null;
    slug: string | null;
    at: number;
};

/** A handoff not taken within this long is forgotten (the draft itself stays). */
export const HANDOFF_TTL_MS = 2 * 60 * 1000;

export function frontDoorHandoff(animal: FrontDoorAnimal, raw: string, now: number): FrontDoorHandoff {
    return {text: frontDoorText(raw), captureId: animal.kind === "own" ? animal.captureId : null, speciesProfileId: animal.speciesProfileId, slug: animal.slug, at: now};
}

/**
 * Whether the chat now open is the one the message was sent to: the same
 * card; or, for a wild animal, its public chat (no card) by slug or species.
 */
export function handoffMatches(
    handoff: FrontDoorHandoff | null,
    chat: {captureId: string | null; slug: string | null; speciesProfileId?: string | null},
    now: number
): boolean {
    if (!handoff || !handoff.text || now - handoff.at > HANDOFF_TTL_MS || now < handoff.at - 1000) return false;
    const card = chat.captureId?.toLowerCase() ?? null;
    if (handoff.captureId) return card === handoff.captureId.toLowerCase();
    if (card) return false;
    if (handoff.slug && chat.slug && handoff.slug === chat.slug) return true;
    return Boolean(handoff.speciesProfileId && chat.speciesProfileId && handoff.speciesProfileId.toLowerCase() === chat.speciesProfileId.toLowerCase());
}

export function decodeFrontDoorHandoff(raw: string | null | undefined): FrontDoorHandoff | null {
    if (!raw) return null;
    try {
        const value = JSON.parse(raw) as Partial<FrontDoorHandoff>;
        if (typeof value.text !== "string" || !value.text.trim() || typeof value.at !== "number" || !Number.isFinite(value.at)) return null;
        const str = (field: unknown) => (typeof field === "string" && field.trim() ? field.trim() : null);
        return {text: frontDoorText(value.text), captureId: str(value.captureId), speciesProfileId: str(value.speciesProfileId), slug: str(value.slug), at: value.at};
    } catch {
        return null;
    }
}

// MARK: - The draft kept in this browser

export const FRONT_DOOR_DRAFT_KEY = "animaldex:talk-front-door:draft";
export const FRONT_DOOR_HANDOFF_KEY = "animaldex:talk-front-door:handoff";
