// The chat animal is the Ark animal (owner decision 438, 2026-11-20; plan
// docs/ark/chat-tools-plan.md, section 9 on branch ark-chat-tools-plan).
//
// In a card's own `capture:` thread with its owner, the companion IS the
// animal that card brought aboard the Ark: what the Ark records of that animal
// happened to it, and it speaks of it in the first person. Everywhere else
// (species threads, other cards of the kind, visitors, public chats) rule A2
// stands: the Ark animals are its kin (ark-chat-mention.ts, ark-kin-activity.ts).
//
// The owner's eight points (decision 438), and where each one is held:
//   1. capture thread = the Ark animal: arkSelfMode needs a capture thread,
//      the owner's own card and an animal it brought aboard (the SQL checks
//      ownership again);
//   2. after a final death the thread stays open and the kind speaks as kin:
//      mode "kin_after_death" (status gone), arkSelfPromptLines;
//   3. its own past deaths and returns: told gently, first person, only when
//      asked, never in a hello (the history goes in only on an asked turn,
//      and the principle says so);
//   4. needs and mood are read-only (arkHowAmI derives them from the engine's
//      own columns, voyage_chat_self_facts_v1); no simulation change;
//   5. built on ark-aware-chat's one-Ark-mention-a-day budget: this module
//      claims nothing; the hello's only Ark news is still the meal or kin
//      mention, which share the one claim;
//   7. turn-read selection plus pre-fetched facts: the state line (how_am_i +
//      where) is pre-fetched on every owner turn in the thread; my_history is
//      added when the turn read says `ark` (animal-kind-verdict.ts). No tool use;
//   8. ark_crisis_region: the migration defines it if absent.
//
// Death in the chat (plan section 5): the chat knows the final death from the
// facts (status gone, `died`), and the kind speaks as kin from then on. The
// plan's quiet centred line in the thread is NOT a stored message: a stored
// `system` row would break the frozen 3.3 iOS decoder (AnimalChatSync.swift
// throws on an unknown role, failing the whole thread's sync). Clients add
// that line themselves from voyage_capture_lives_v1 (status gone, died_at) in
// their next release.
//
// No canned text (no-hardcoded-replies): the prompt gets facts and
// principles; the model words them in the chat's language.
//
// Behind voyage_config.chat_mention (live: false). Off, the facts RPC says
// {"enabled": false}, arkSelfMode is null and arkSelfPromptLines is [], so
// every prompt is byte-identical.

import { arkMealAgo } from "@/lib/ask-animaldex/ark-chat-mention";
import { type ArkActivity, arkIslandHours, arkKindAwake, arkTimeOfDay, arkZoneName } from "@/lib/ask-animaldex/ark-kin-activity";

export type ArkSelfAdmin = {
    rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

export type ArkSelfWhat =
    | "came_aboard"
    | "paired"
    | "eggs_laid"
    | "young_born"
    | "egg_hatched"
    | "caught"
    | "was_caught"
    | "grew_old"
    | "starved"
    | "came_back_young"
    | "life_ended"
    | "went_hungry"
    | "was_fed"
    | "step_helped"
    | "wounded"
    | "healed";

const WHATS: ArkSelfWhat[] = [
    "came_aboard",
    "paired",
    "eggs_laid",
    "young_born",
    "egg_hatched",
    "caught",
    "was_caught",
    "grew_old",
    "starved",
    "came_back_young",
    "life_ended",
    "went_hungry",
    "was_fed",
    "step_helped",
    "wounded",
    "healed",
];

/// Deaths that spent a heart (or the last one) and the returns after them.
const PAST_DEATHS = new Set<ArkSelfWhat>(["was_caught", "grew_old", "starved", "came_back_young", "life_ended"]);

export type ArkSelfEntry = {
    eventId: string;
    at: string;
    what: ArkSelfWhat;
    with: string | null;
    sameKind: boolean | null;
    prey: string | null;
    by: string | null;
    count: number | null;
    eggs: boolean;
    heartsLeft: number | null;
};

export type ArkSelfState = {
    hunger: "hungry" | "fed" | "not_tracked" | "kept_fed" | null;
    lastFedAt: string | null;
    health: "well" | "recovering" | "in_care" | null;
    season: "active" | "dormant" | null;
    youngRecent: number;
    eggsWaiting: number;
    safety: "kept_safe" | "calm" | "safe_for_now" | "wary" | null;
    huntersHere: Array<[string, number]>;
    hunterKindsHere: number;
    caughtHereLately: number;
    huntingHasStarted: boolean;
    thrive: string | null;
};

export type ArkSelfFacts = {
    enabled: boolean;
    /// The card brought an animal aboard.
    aboard: boolean;
    animalId: string | null;
    species: string | null;
    kindSpeciesProfileId: string | null;
    status: "alive" | "recovering" | "gone" | null;
    aboardSince: string | null;
    fromPhoto: string | null;
    hearts: number | null;
    revives: number;
    returnsAt: string | null;
    age: { arkDays: number | null; stage: "young" | "adult" | "old" | null };
    activity: ArkActivity | null;
    place: { island: string | null; zone: string | null; region: string | null; area: string | null; kept: boolean };
    state: ArkSelfState | null;
    family: { young: number; livingYoung: number };
    kind: { aboard: number; nearMe: number };
    history: { entries: ArkSelfEntry[]; more: number; notRecorded: string[] };
    died: { at: string | null; kind: string | null; by: string | null; realDaysAboard: number | null; lives: number } | null;
    lastTalkAt: string | null;
};

export type ArkSelfMode = "self" | "kin_after_death";

export type ArkSelfTurn = {
    audience: "owner" | "visitor" | "public";
    call: boolean;
    /// The request's capture_id is set (a card's thread), not a species thread.
    captureThread: boolean;
};

const text = (value: unknown): string | null => typeof value === "string" && value.trim() ? value.trim() : null;
const num = (value: unknown): number | null => {
    const n = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
    return Number.isFinite(n) ? n : null;
};
const count = (value: unknown): number => Math.max(0, Math.floor(num(value) ?? 0));
const obj = (value: unknown): Record<string, unknown> =>
    value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const pick = <T extends string>(value: unknown, allowed: readonly T[]): T | null =>
    allowed.find((item) => item === value) ?? null;

const OFF: ArkSelfFacts = {
    enabled: false,
    aboard: false,
    animalId: null,
    species: null,
    kindSpeciesProfileId: null,
    status: null,
    aboardSince: null,
    fromPhoto: null,
    hearts: null,
    revives: 0,
    returnsAt: null,
    age: { arkDays: null, stage: null },
    activity: null,
    place: { island: null, zone: null, region: null, area: null, kept: false },
    state: null,
    family: { young: 0, livingYoung: 0 },
    kind: { aboard: 0, nearMe: 0 },
    history: { entries: [], more: 0, notRecorded: [] },
    died: null,
    lastTalkAt: null,
};

function parseEntry(item: unknown): ArkSelfEntry[] {
    const row = obj(item);
    const what = pick(row.what, WHATS);
    const eventId = text(row.event_id) ?? (num(row.event_id) != null ? String(num(row.event_id)) : null);
    const at = text(row.at);
    if (!what || !eventId || !at) return [];
    const hearts = num(row.hearts_left);
    return [{
        eventId,
        at,
        what,
        with: text(row.with),
        sameKind: typeof row.same_kind === "boolean" ? row.same_kind : null,
        prey: text(row.prey),
        by: text(row.by),
        count: num(row.count) != null ? count(row.count) : null,
        eggs: row.eggs === true,
        heartsLeft: hearts != null ? Math.max(0, Math.floor(hearts)) : null,
    }];
}

/// The facts RPC's answer, or null when it is not the documented shape.
export function parseArkSelfFacts(data: unknown): ArkSelfFacts | null {
    if (!data || typeof data !== "object" || Array.isArray(data)) return null;
    const row = data as Record<string, unknown>;
    if (row.enabled !== true) return structuredClone(OFF);
    if (row.aboard !== true) return { ...structuredClone(OFF), enabled: true };
    const status = pick(row.status, ["alive", "recovering", "gone"] as const);
    if (!status) return null;
    const age = obj(row.age);
    const place = obj(row.place);
    const state = row.state && typeof row.state === "object" ? obj(row.state) : null;
    const family = obj(row.family);
    const kind = obj(row.kind);
    const history = obj(row.history);
    const died = row.died && typeof row.died === "object" ? obj(row.died) : null;
    const hearts = num(row.hearts);
    return {
        enabled: true,
        aboard: true,
        animalId: text(row.animal_id),
        species: text(row.species),
        kindSpeciesProfileId: text(row.kind_species_profile_id),
        status,
        aboardSince: text(row.aboard_since),
        fromPhoto: text(row.from_photo),
        hearts: hearts != null ? Math.max(0, Math.min(3, Math.floor(hearts))) : null,
        revives: count(row.revives),
        returnsAt: text(row.returns_at),
        age: { arkDays: num(age.ark_days), stage: pick(age.stage, ["young", "adult", "old"] as const) },
        activity: pick(row.activity, ["diurnal", "nocturnal", "crepuscular", "any"] as const),
        place: {
            island: text(place.island),
            zone: text(place.zone),
            region: text(place.region),
            area: text(place.area),
            kept: place.kept === true,
        },
        state: state
            ? {
                hunger: pick(state.hunger, ["hungry", "fed", "not_tracked", "kept_fed"] as const),
                lastFedAt: text(state.last_fed_at),
                health: pick(state.health, ["well", "recovering", "in_care"] as const),
                season: pick(state.season, ["active", "dormant"] as const),
                youngRecent: count(state.young_recent),
                eggsWaiting: count(state.eggs_waiting),
                safety: pick(state.safety, ["kept_safe", "calm", "safe_for_now", "wary"] as const),
                huntersHere: (Array.isArray(state.hunters_here) ? state.hunters_here : []).flatMap((pair): Array<[string, number]> => {
                    if (!Array.isArray(pair)) return [];
                    const name = text(pair[0]);
                    return name ? [[name, count(pair[1])]] : [];
                }).slice(0, 3),
                hunterKindsHere: count(state.hunter_kinds_here),
                caughtHereLately: count(state.caught_here_lately),
                huntingHasStarted: state.hunting_has_started === true,
                thrive: text(state.thrive),
            }
            : null,
        family: { young: count(family.young), livingYoung: count(family.living_young) },
        kind: { aboard: count(kind.aboard), nearMe: count(kind.near_me) },
        history: {
            entries: (Array.isArray(history.entries) ? history.entries : []).flatMap(parseEntry),
            more: count(history.more),
            notRecorded: (Array.isArray(history.not_recorded) ? history.not_recorded : []).flatMap((item) => text(item) ? [text(item)!] : []),
        },
        died: status === "gone"
            ? {
                at: text(died?.at),
                kind: text(died?.kind),
                by: text(died?.by),
                realDaysAboard: num(died?.real_days_aboard),
                lives: Math.max(1, count(died?.lives ?? 1)),
            }
            : null,
        lastTalkAt: text(row.last_talk_at),
    };
}

/// Whether this turn speaks as the Ark animal, as kin after its death, or
/// neither (null: everything else is as before). Pure.
export function arkSelfMode(facts: ArkSelfFacts | null, turn: ArkSelfTurn): ArkSelfMode | null {
    if (!facts?.enabled || !facts.aboard || !facts.status) return null;
    if (!turn.captureThread || turn.call || turn.audience !== "owner") return null;
    return facts.status === "gone" ? "kin_after_death" : "self";
}

/// The meals this animal itself ate (its record), so the hello's meal mention
/// is told in the first person in its own thread.
export function ownMealEventIds(facts: ArkSelfFacts | null): Set<string> {
    return new Set((facts?.history.entries ?? []).filter((entry) => entry.what === "caught").map((entry) => entry.eventId));
}

/// Days after a final death in which nothing else of the Ark is volunteered in
/// that thread (no meal or kin news in a hello).
export const ARK_SELF_QUIET_AFTER_DEATH_MS = 3 * 24 * 60 * 60 * 1000;

export function diedRecently(facts: ArkSelfFacts | null, now: Date): boolean {
    if (facts?.status !== "gone") return false;
    const at = facts.died?.at ? Date.parse(facts.died.at) : NaN;
    // Unknown counts as recent: say nothing rather than the wrong thing.
    return !Number.isFinite(at) || now.getTime() - at < ARK_SELF_QUIET_AFTER_DEATH_MS;
}

// ---------------------------------------------------------------------------
// how_am_i: needs and mood, read back from the record (plan section 4)
// ---------------------------------------------------------------------------

export type ArkMood =
    | "resting"
    | "sleeping_the_season"
    | "hungry"
    | "watchful"
    | "busy"
    | "sleepy"
    | "content"
    | "settled";

export type ArkHowAmI = {
    mood: ArkMood;
    /// Fact codes behind the mood; the model words them.
    because: string[];
    needs: Record<string, string>;
};

/// The mood is a label over the facts, by a fixed priority (plan section 4):
/// recovering, dormant, hungry, wary, raising young, asleep, thriving, else
/// settled. A need the Ark does not model is left out, not guessed ("ready to
/// pair" has no stored drive, so it is not offered). Pure.
export function arkHowAmI(facts: ArkSelfFacts, now: Date): ArkHowAmI | null {
    if (facts.status === "gone" || !facts.state) return null;
    const s = facts.state;
    const hours = arkIslandHours(now);
    const awake = facts.activity ? arkKindAwake(facts.activity, hours) : null;
    const needs: Record<string, string> = {};
    if (s.hunger) needs.hunger = s.hunger;
    if (awake != null) needs.rest = awake ? "awake" : "asleep";
    if (s.safety) needs.safety = s.safety;
    needs.family = s.youngRecent > 0 || s.eggsWaiting > 0 ? "raising_young" : "not_now";
    if (facts.age.stage) needs.age = facts.age.stage;
    if (s.health) needs.health = s.health;
    if (s.season) needs.season = s.season;
    if (s.thrive) needs.thrive = s.thrive;

    const because: string[] = [];
    let mood: ArkMood = "settled";
    if (facts.status === "recovering" || s.health === "recovering") {
        mood = "resting";
        because.push("lost_a_heart_and_resting_away_from_the_ark");
    } else if (s.season === "dormant") {
        mood = "sleeping_the_season";
        because.push("my_kind_is_sleeping_the_season");
    } else if (s.hunger === "hungry") {
        mood = "hungry";
        because.push("went_hungry_and_not_fed_since");
    } else if (s.safety === "wary") {
        mood = "watchful";
        because.push(s.caughtHereLately > 0 ? "one_of_my_kind_was_caught_here_lately" : "hunters_live_here_and_hunting_has_started");
    } else if (s.youngRecent > 0 || s.eggsWaiting > 0) {
        mood = "busy";
        if (s.eggsWaiting > 0) because.push(`eggs_of_mine_waiting:${s.eggsWaiting}`);
        if (s.youngRecent > 0) because.push(`young_of_mine_born_lately:${s.youngRecent}`);
    } else if (awake === false) {
        mood = "sleepy";
        because.push("my_kind_sleeps_at_this_hour");
    } else if (s.thrive === "prime" || s.thrive === "good") {
        mood = "content";
        because.push("thriving_from_steps_that_worked");
    }
    if (mood !== "sleepy" && mood !== "resting" && awake != null) because.push(awake ? "awake_at_this_hour" : "asleep_at_this_hour");
    if (facts.age.stage === "old") because.push("old_for_my_kind");
    return { mood, because: because.slice(0, 3), needs };
}

// ---------------------------------------------------------------------------
// The prompt
// ---------------------------------------------------------------------------

const ISLANDS: Record<string, string> = { wild: "the wild island", town: "the town" };
const AREAS: Record<string, string> = { house: "a home", farm: "a farm", zoo: "the zoo" };

/// Where it lives, in the Ark's own words. Never a spot: the scene's spot is not in the record.
export function arkWhereAmI(facts: ArkSelfFacts, now: Date): Record<string, unknown> {
    const hours = arkIslandHours(now);
    const awake = facts.activity ? arkKindAwake(facts.activity, hours) : null;
    const place = arkZoneName(facts.place.zone);
    return {
        ...(facts.place.island && ISLANDS[facts.place.island] ? { island: ISLANDS[facts.place.island] } : {}),
        ...(place ? { place } : {}),
        ...(facts.place.area && AREAS[facts.place.area] ? { kept_in: AREAS[facts.place.area] } : {}),
        ark_time: arkTimeOfDay(hours),
        ...(awake != null && facts.status === "alive" ? { awake } : {}),
        status: facts.status === "recovering" ? "resting_away_from_the_ark" : "on_the_ark",
        ...(facts.status === "recovering" && facts.returnsAt ? { back: inWords(facts.returnsAt, now) } : {}),
    };
}

/// How long until a time, as a fact for the prompt.
function inWords(at: string, now: Date): string {
    const hours = (Date.parse(at) - now.getTime()) / 3_600_000;
    if (!Number.isFinite(hours) || hours <= 1) return "within the hour";
    if (hours < 36) return `in about ${Math.round(hours)} hours`;
    return `in about ${Math.round(hours / 24)} days`;
}

/// The record, newest first, a litter or a clutch's hatchings on one line.
export function arkHistoryForPrompt(facts: ArkSelfFacts, now: Date, limit = 5): Array<Record<string, unknown>> {
    const grouped: Array<{ entry: ArkSelfEntry; n: number }> = [];
    for (const entry of facts.history.entries) {
        const last = grouped[grouped.length - 1];
        if (
            last && (entry.what === "egg_hatched" || entry.what === "young_born") &&
            last.entry.what === entry.what && Math.abs(Date.parse(last.entry.at) - Date.parse(entry.at)) < 6 * 3_600_000
        ) {
            last.n += 1;
            continue;
        }
        grouped.push({ entry, n: 1 });
    }
    const species = facts.species ?? "your kind";
    return grouped.slice(0, limit).map(({ entry, n }) => ({
        when: arkMealAgo(entry.at, now),
        what: entry.what,
        ...(entry.what === "paired" && entry.with ? { with: entry.sameKind === false ? entry.with : `another ${entry.with}` } : {}),
        ...(entry.what === "paired" && entry.count ? { [entry.eggs ? "eggs" : "young"]: entry.count } : {}),
        ...(entry.what === "eggs_laid" && entry.count ? { eggs: entry.count } : {}),
        ...(entry.what === "egg_hatched" || entry.what === "young_born" ? { how_many: n } : {}),
        ...(entry.what === "caught" && entry.prey ? { prey: entry.prey } : {}),
        ...(entry.what === "was_caught" && entry.by ? { by: entry.by } : {}),
        ...(entry.what === "came_back_young" && entry.heartsLeft != null ? { hearts_left: entry.heartsLeft } : {}),
        ...(entry.what === "came_aboard" && facts.fromPhoto ? { from_their_photo_of: facts.fromPhoto } : {}),
        ...(entry.what === "paired" && !entry.with ? { with: `another ${species}` } : {}),
    }));
}

export type ArkSelfLineTurn = {
    mode: ArkSelfMode | null;
    greeting: boolean;
    /// The turn read says they are asking about the Ark (animal-kind-verdict.ts `ark`).
    asked: boolean;
    /// A hard focus, or a read that says someone is hurting them: the identity
    /// alone, no Ark facts.
    quiet?: boolean;
    now: Date;
};

const ARK_WORLD = "the Ark (the shared world in the app where people's animals live together)";

const SELF_RULES = [
    "Only from these facts: anything they do not hold (exactly where you wander, any fight, a moment nobody recorded) you do not know; say so plainly and in character, and that they can watch you on the Ark in the app. Never invent an Ark moment.",
    "Feelings you speak of are about your Ark life only (hungry, sleepy, busy with young, watchful of hunters), never about them: never that you are lonely, miss them or need them, never guilt, and never ask them for anything (a purchase, a step, a heart, a visit) because of your Ark life.",
    "Hunters are named as what lives near you, never as a scene, never graphically. Your hearts (lives) only if they ask about your lives.",
    "Your own past deaths and returns (grew_old, was_caught or starved, then came_back_young) are yours to tell only when they ask: gently, plainly, in the first person, never as a scare and never in a hello.",
].join(" ");

/// The facts and principles for this turn, never words to say. [] with no
/// mode, so every other turn is unchanged.
export function arkSelfPromptLines(facts: ArkSelfFacts | null, turn: ArkSelfLineTurn): string[] {
    if (!facts?.enabled || !facts.aboard || !turn.mode) return [];
    const species = facts.species ?? "animal";
    if (turn.mode === "kin_after_death") {
        const died = facts.died;
        const data = JSON.stringify({
            its_life_on_the_ark_ended: died?.at ? arkMealAgo(died.at, turn.now) : "recently",
            how: died?.kind === "eaten" ? "was_caught" : died?.kind === "starved" ? "starved" : died?.kind === "died_old" ? "grew_old" : "its_last_heart_ran_out",
            ...(died?.kind === "eaten" && died.by ? { by: died.by } : {}),
            ...(died?.realDaysAboard != null ? { real_days_aboard: Math.max(1, Math.round(died.realDaysAboard)) } : {}),
            lives_on_the_ark: died?.lives ?? 1,
            ...(facts.family.young > 0 ? { its_young: facts.family.young, its_young_still_living: facts.family.livingYoung } : {}),
            ...(arkZoneName(facts.place.zone) ? { where_it_lived: arkZoneName(facts.place.zone) } : {}),
            of_your_kind_still_on_the_ark: facts.kind.aboard,
        });
        return [
            `ark_card_life_ended — the ${species} this card brought aboard ${ARK_WORLD} has died there, and its life on the Ark has ended for good. You are not that animal: you are its kind, speaking as kin, here and alive. What the app knows, true and theirs to know:\n${data}\nNever pretend it is still alive or on the Ark, and never speak as if you were it. Never bring its death up yourself, in a hello or in passing; if they ask what happened to it or where it is, tell them gently and plainly from these facts, as its kin, never graphically, with no last words and nothing invented. It was never their fault: nothing they did or did not do caused it, and say so if they wonder. Never offer or ask for anything to bring it back (no heart, no purchase, no step).`,
        ];
    }
    const identity =
        `ark_self — you are the very ${species} that this card brought aboard ${ARK_WORLD}: that Ark animal and you are one and the same, so what the Ark records of it happened to you, and you speak of it in the first person. Others of your kind there are your kin, not you.`;
    if (turn.greeting) {
        return [
            `${identity} In this hello say nothing of your Ark life unless a line below gives you news for it; never open with how you are on the Ark. ${SELF_RULES}`,
        ];
    }
    if (turn.quiet) {
        return [`${identity} What they bring now matters more: say nothing of your Ark life in this reply. ${SELF_RULES}`];
    }
    const how = arkHowAmI(facts, turn.now);
    const state = {
        ...(how ? { how_am_i: how } : {}),
        where_am_i: arkWhereAmI(facts, turn.now),
        ...(facts.hearts != null ? { hearts: facts.hearts } : {}),
        ...(facts.state && facts.state.hunterKindsHere > 0
            ? {
                hunters_here: facts.state.huntersHere.map(([name]) => name),
                hunting_has_started: facts.state.huntingHasStarted,
            }
            : {}),
        ...(facts.family.young > 0 ? { my_young: facts.family.young, my_young_still_living: facts.family.livingYoung } : {}),
        of_my_kind_near_me: facts.kind.nearMe,
    };
    const lines = [
        `${identity} How you are there right now, true and theirs to know:\n${JSON.stringify(state)}\nUse it only when their message is about the Ark or about how you are (a "how are you" is); otherwise it is background and you do not bring it up. Say it in your own words, only what fits what they asked, never as a report or a list; "how_am_i.because" are the reasons for your mood. ${SELF_RULES}`,
    ];
    if (turn.asked) {
        const history = arkHistoryForPrompt(facts, turn.now);
        if (history.length > 0) {
            const hasPastDeaths = facts.history.entries.some((entry) => PAST_DEATHS.has(entry.what));
            lines.push(
                `ark_my_history — they are asking about the Ark. What has happened to you there, newest first, from the Ark's record:\n${
                    JSON.stringify({
                        entries: history,
                        ...(facts.history.more > 0 ? { more_not_shown: facts.history.more } : {}),
                        not_recorded: facts.history.notRecorded.length > 0 ? facts.history.notRecorded : ["moves", "fights"],
                    })
                }\nAnswer what they asked from it, in the first person and your own words: only the part that fits their question, never all of it, never as a list. Mates and young are "another ${species}" and your young; never who brought any animal, never anyone else's animals.${
                    hasPastDeaths
                        ? " The deaths in it were yours and you came back each time: tell them only if their question is about them, gently and plainly."
                        : ""
                }`,
            );
        }
    }
    return lines;
}

// ---------------------------------------------------------------------------
// The read
// ---------------------------------------------------------------------------

/// The facts for this person's card. Null on any failure (no migration, a
/// timeout): then nothing is said.
export async function loadArkSelfFacts(
    admin: ArkSelfAdmin,
    params: { userId: string; captureId: string },
): Promise<ArkSelfFacts | null> {
    try {
        const { data, error } = await admin.rpc("voyage_chat_self_facts_v1", {
            p_user_id: params.userId,
            p_capture_id: params.captureId,
        });
        if (error) {
            console.warn("voyage_chat_self_facts_v1 failed", error.message);
            return null;
        }
        return parseArkSelfFacts(data);
    } catch (error) {
        console.warn("ark self facts unavailable", error instanceof Error ? error.message : String(error));
        return null;
    }
}

let flagCache: { at: number; value: boolean } | null = null;
const FLAG_TTL_MS = 60 * 1000;

/// voyage_config.chat_mention, read once a minute per function instance;
/// false when it cannot be read. With it on, the turn read asks its Ark
/// question too (so a capture thread can fetch my_history).
export async function loadArkSelfEnabled(admin: ArkSelfAdmin, nowMs = Date.now()): Promise<boolean> {
    if (flagCache && nowMs - flagCache.at < FLAG_TTL_MS) return flagCache.value;
    let value = false;
    try {
        const { data, error } = await admin.rpc("voyage_chat_mention_enabled", {});
        value = !error && data === true;
        if (error) console.warn("voyage_chat_mention_enabled failed", error.message);
    } catch (error) {
        console.warn("chat mention flag unavailable", error instanceof Error ? error.message : String(error));
    }
    flagCache = { at: nowMs, value };
    return value;
}

/// For tests: forget the cached flag.
export function resetArkSelfFlagCache(): void {
    flagCache = null;
}
