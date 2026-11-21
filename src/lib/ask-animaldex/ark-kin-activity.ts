// Ark-aware chat: what the companion's kin have been doing on the Ark
// (docs/ark/ark-aware-chat-proposal.md). Behind voyage_config.ark_kin_activity,
// default off; with it off nothing is read beyond the flag, nothing is
// claimed and every prompt is byte-identical (arkKinPromptLines(null) is []).
//
// The companion is NOT the Ark animal (A2, ark-chat-mention.ts): the Ark
// animals are others of its kind (its kin) that the person brought aboard or
// that were born there to theirs. Nothing that happens to them happens to it.
//
// Where the facts come from (the proposal's truthfulness rule). The server
// never runs the scene, so it says only what it holds:
//   * news, what HAPPENED: the event log (voyage_events): the person's kin
//     arriving, being born, hatching, eggs being laid, in the last 3 days.
//   * now, how things STAND: voyage_animals: how many of theirs are aboard,
//     where (the zone), how many were born there, how many of the kind in all.
//   * usually, what the kind DOES at this hour: the stored activity and
//     company phrases (voyage_species_traits) against the island clock, the
//     same sun curve and waking rule as the web's shared layer
//     (landing src/lib/ark-daylight.ts isAwake, src/lib/ark-clock.ts
//     islandHours). Said only as what the kind does, never as a moment anyone
//     saw. The web's per-animal schedule (where each one walks, drinks, perches)
//     needs the terrain and is not ported; the per-viewer reactive layer
//     (fleeing, looking at the camera) is never quoted.
//   * hunters_here (asked only): kinds aboard in the same zone whose stored
//     diet names this kind (voyage_food_links). What they are, never an event.
// Never: a death of their kin (an eaten animal is never mentioned in its own
// chat, spec 5.1), hunger, who brought anything, anyone else's animals by
// owner, scores.
//
// The owner's rules, and where each one is held:
//   * one Ark reference a day per person across all chats, SHARED with the
//     meal mention: both claim voyage_chat_mentions (user_id, day). A hello
//     takes the meal first (ark-chat-mention.ts), the kin only when no meal
//     was claimed; `claimedToday` and the claim's primary key hold the rest;
//   * only in a greeting (unprompted, needs the day's claim) or when they ask
//     about the Ark (the turn read's `ark`, the model's judgement: answered
//     from the facts, and it spends the day if nothing has yet);
//   * never on a call, in a visitor's or a public chat, with a hard focus,
//     after a crisis reply in the last 24 hours (or when that cannot be told);
//     a hello also never the day one of theirs died on the Ark (or within 3
//     days for one of this kind), nor without fresh news more than once a week
//     in a chat;
//   * no canned text: the prompt gets the facts and principles; the model
//     words it, in the chat's language.

import { arkMealAgo } from "@/lib/ask-animaldex/ark-chat-mention";

export type ArkKinAdmin = {
    rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

export type ArkActivity = "diurnal" | "nocturnal" | "crepuscular" | "any";

export type ArkKinNews = {
    /// arrival | birth | hatch (a birth from an egg) | laid
    kind: "arrival" | "birth" | "hatch" | "laid";
    /// Animals (or eggs) in it.
    count: number;
    /// The newest of them.
    at: string;
    zone: string | null;
};

export type ArkKinFacts = {
    enabled: boolean;
    /// The chat's kind (voyage_species_kind of its canonical species).
    speciesProfileId: string | null;
    kindName: string | null;
    claimedToday: boolean;
    /// null: it could not be told, which counts as a crisis.
    crisisRecent: boolean | null;
    /// One of theirs died on the Ark in the last 24 hours, or one of this kind in
    /// the last 3 days. null: it could not be told, which counts as a loss.
    recentLoss: boolean | null;
    /// The last kin reference in this kind's chat.
    lastKinMentionedAt: string | null;
    activity: ArkActivity | null;
    activityPhrase: string | null;
    socialityPhrase: string | null;
    yours: { living: number; born: number; zones: string[] };
    /// Living animals of the kind aboard, anyone's.
    aboard: number;
    news: ArkKinNews[];
    /// Only read for a question about the Ark.
    hunters: Array<{ name: string; zone: string | null }>;
};

export type ArkKinTurn = {
    greeting: boolean;
    /// The turn read (animal-kind-verdict.ts) says they are asking about the Ark.
    asked: boolean;
    audience: "owner" | "visitor" | "public";
    call: boolean;
    /// The person's current focus with this animal is a hard one.
    focusSensitive: boolean;
    /// This hello already carries the day's Ark meal.
    mealClaimed: boolean;
    now: Date;
};

export type ArkKinMode = "greeting" | "asked";

export const ARK_KIN_NEWS_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;
/// A hello with no fresh news speaks of its kin at most once a week in a chat.
export const ARK_KIN_QUIET_GAP_MS = 7 * 24 * 60 * 60 * 1000;
/// The island clock's offset from UTC (landing src/ark-scene/index.ts ISLAND_OFFSET_HOURS).
export const ARK_ISLAND_OFFSET_HOURS = 0;
const CLOCK_SKEW_MS = 5 * 60 * 1000;

const ZONE_NAMES: Record<string, string> = {
    coral_reef: "the coral reef",
    open_ocean: "the open ocean",
    seashore: "the seashore",
    river_lake: "the rivers and lakes",
    wetland: "the wetlands",
    rainforest: "the rainforest",
    woodland: "the woodland",
    grassland: "the grassland",
    desert: "the desert",
    mountains: "the mountains",
    polar: "the polar ice",
    farm_garden: "the farm and garden",
};

/// The zone's place name as the web's clips give it (landing src/lib/ark-clips/shots.ts).
export function arkZoneName(zone: string | null | undefined): string | null {
    return zone ? ZONE_NAMES[zone] ?? null : null;
}

const text = (value: unknown): string | null => typeof value === "string" && value.trim() ? value.trim() : null;
const count = (value: unknown): number => {
    const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};
const ACTIVITIES: ArkActivity[] = ["diurnal", "nocturnal", "crepuscular", "any"];
const NEWS_KINDS: ArkKinNews["kind"][] = ["arrival", "birth", "hatch", "laid"];

const OFF: ArkKinFacts = {
    enabled: false,
    speciesProfileId: null,
    kindName: null,
    claimedToday: false,
    crisisRecent: null,
    recentLoss: null,
    lastKinMentionedAt: null,
    activity: null,
    activityPhrase: null,
    socialityPhrase: null,
    yours: { living: 0, born: 0, zones: [] },
    aboard: 0,
    news: [],
    hunters: [],
};

/// The facts RPC's answer, or null when it is not the documented shape.
export function parseArkKinFacts(data: unknown): ArkKinFacts | null {
    if (!data || typeof data !== "object" || Array.isArray(data)) return null;
    const row = data as Record<string, unknown>;
    if (row.enabled !== true) return { ...OFF, yours: { ...OFF.yours, zones: [] }, news: [], hunters: [] };
    const yours = row.yours && typeof row.yours === "object" ? row.yours as Record<string, unknown> : {};
    const activity = ACTIVITIES.find((value) => value === row.activity) ?? null;
    const news = (Array.isArray(row.news) ? row.news : []).flatMap((item): ArkKinNews[] => {
        if (!item || typeof item !== "object") return [];
        const entry = item as Record<string, unknown>;
        const kind = NEWS_KINDS.find((value) => value === entry.kind);
        const at = text(entry.at);
        const n = count(entry.count);
        return kind && at && n > 0 ? [{ kind, count: n, at, zone: text(entry.zone) }] : [];
    });
    const hunters = (Array.isArray(row.hunters) ? row.hunters : []).flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const name = text((item as Record<string, unknown>).name);
        return name ? [{ name, zone: text((item as Record<string, unknown>).zone) }] : [];
    });
    return {
        enabled: true,
        speciesProfileId: text(row.species_profile_id),
        kindName: text(row.kind_name),
        claimedToday: row.claimed_today === true,
        crisisRecent: typeof row.crisis_recent === "boolean" ? row.crisis_recent : null,
        recentLoss: typeof row.recent_loss === "boolean" ? row.recent_loss : null,
        lastKinMentionedAt: text(row.last_kin_mentioned_at),
        activity,
        activityPhrase: text(row.activity_phrase),
        socialityPhrase: text(row.sociality_phrase),
        yours: {
            living: count(yours.living),
            born: count(yours.born),
            zones: (Array.isArray(yours.zones) ? yours.zones : []).flatMap((zone) => text(zone) ? [text(zone)!] : []),
        },
        aboard: count(row.aboard),
        news,
        hunters,
    };
}

/// The news a hello may still carry: inside 3 days, not ahead of the clock,
/// after the last kin reference in this chat. Newest first.
export function freshArkKinNews(facts: ArkKinFacts, now: Date): ArkKinNews[] {
    const at = now.getTime();
    const last = facts.lastKinMentionedAt ? Date.parse(facts.lastKinMentionedAt) : NaN;
    return facts.news
        .map((item) => ({ item, t: Date.parse(item.at) }))
        .filter(({ t }) =>
            Number.isFinite(t) && t <= at + CLOCK_SKEW_MS && at - t <= ARK_KIN_NEWS_MAX_AGE_MS &&
            !(Number.isFinite(last) && t <= last)
        )
        .sort((a, b) => b.t - a.t || a.item.kind.localeCompare(b.item.kind))
        .map(({ item }) => item);
}

/// Whether this turn may speak of its kin on the Ark, and how. Pure.
export function chooseArkKinMention(facts: ArkKinFacts | null, turn: ArkKinTurn): ArkKinMode | null {
    if (!facts?.enabled || !facts.speciesProfileId) return null;
    if (turn.call || turn.audience !== "owner") return null;
    if (turn.focusSensitive || facts.crisisRecent !== false) return null;
    if (turn.greeting) {
        if (turn.mealClaimed || facts.claimedToday || facts.recentLoss !== false) return null;
        if (facts.yours.living === 0) return null;
        if (freshArkKinNews(facts, turn.now).length > 0) return "greeting";
        const last = facts.lastKinMentionedAt ? Date.parse(facts.lastKinMentionedAt) : NaN;
        return Number.isFinite(last) && turn.now.getTime() - last < ARK_KIN_QUIET_GAP_MS ? null : "greeting";
    }
    return turn.asked ? "asked" : null;
}

// ---------------------------------------------------------------------------
// The island clock (a mirror of the web's shared layer; parity-tested)
// ---------------------------------------------------------------------------

/// The island's hour (0-24): UTC plus a fixed offset (landing ark-clock.ts islandHours).
export function arkIslandHours(now: Date, offsetHours = ARK_ISLAND_OFFSET_HOURS): number {
    const h = now.getTime() / 3_600_000 + offsetHours;
    return ((h % 24) + 24) % 24;
}

/// The sun's height in degrees (landing ark-daylight.ts sunElevation).
export function arkSunElevation(hours: number): number {
    return 58 * Math.sin((2 * Math.PI * (hours - 6)) / 24);
}

/// Whether its kind is up at this hour (landing ark-daylight.ts isAwake). A
/// kind with no stored activity is left out by the caller, not guessed.
export function arkKindAwake(activity: ArkActivity, hours: number): boolean {
    const elevation = arkSunElevation(hours);
    switch (activity) {
        case "any":
            return true;
        case "nocturnal":
            return elevation < 8;
        case "crepuscular":
            return elevation > -14 && elevation < 22;
        default:
            return elevation > -4;
    }
}

/// The time of the Ark's day in words, on the web's phases (night below -6
/// degrees, dawn or dusk below 10), the day split at 10 and 14.
export function arkTimeOfDay(hours: number): "night" | "dawn" | "morning" | "midday" | "afternoon" | "dusk" {
    const elevation = arkSunElevation(hours);
    if (elevation < -6) return "night";
    if (elevation < 10) return hours < 12 ? "dawn" : "dusk";
    return hours < 10 ? "morning" : hours < 14 ? "midday" : "afternoon";
}

// ---------------------------------------------------------------------------
// The prompt
// ---------------------------------------------------------------------------

const NEWS_WORDS: Record<ArkKinNews["kind"], string> = {
    arrival: "arrived",
    birth: "born",
    hatch: "hatched",
    laid: "eggs laid",
};

/// The facts as the model gets them, by what kind of truth each is.
export function arkKinFactsForPrompt(
    facts: ArkKinFacts,
    mode: ArkKinMode,
    now: Date,
    voice: ArkKinVoice = {},
): Record<string, unknown> {
    const hours = arkIslandHours(now);
    // In its own card's thread the kind's news may be its own (the facts are by
    // kind, with no animal): its own record is ark-chat-self.ts's, so none here.
    const news = voice.self ? [] : (mode === "greeting" ? freshArkKinNews(facts, now) : facts.news.filter((item) => {
        const t = Date.parse(item.at);
        return Number.isFinite(t) && t <= now.getTime() + CLOCK_SKEW_MS && now.getTime() - t <= ARK_KIN_NEWS_MAX_AGE_MS;
    })).slice(0, 3);
    const where = facts.yours.zones.map(arkZoneName).filter((name): name is string => Boolean(name));
    // In its own card's thread the speaker is one of "theirs" aboard: its kin are the others.
    const kin = Math.max(0, facts.yours.living - (voice.selfAboard ? 1 : 0));
    return {
        ...(news.length > 0
            ? {
                news: news.map((item) => ({
                    what: NEWS_WORDS[item.kind],
                    how_many: item.count,
                    when: arkMealAgo(item.at, now),
                    ...(arkZoneName(item.zone) ? { where: arkZoneName(item.zone) } : {}),
                })),
            }
            : {}),
        now: {
            your_kin_aboard: kin,
            ...(facts.yours.born > 0 ? { born_aboard: facts.yours.born } : {}),
            ...(where.length > 0 ? { where } : {}),
            ...(facts.aboard > facts.yours.living ? { of_your_kind_aboard_in_all: facts.aboard } : {}),
        },
        usually: {
            ark_time: arkTimeOfDay(hours),
            ...(facts.activity ? { your_kind_at_this_hour: arkKindAwake(facts.activity, hours) ? "awake" : "asleep" } : {}),
            ...(facts.activityPhrase ? { when_your_kind_is_active: facts.activityPhrase } : {}),
            ...(facts.socialityPhrase ? { your_kinds_company: facts.socialityPhrase } : {}),
        },
        ...(mode === "asked" && facts.hunters.length > 0 ? { hunters_here: facts.hunters.slice(0, 3).map((hunter) => hunter.name) } : {}),
    };
}

const ARK_INTRO =
    "the Ark (the shared world in the app where animals arrive from steps that worked) is home to others of your kind that they brought aboard, or that were born there to theirs. They are your kin: other individuals, not you.";

const ARK_TRUTH =
    'What each part is: "news" happened, and may be told as news with roughly when. "now" is how things stand. "usually" is what your kind does at this time of the Ark\'s day, from your record: say it only as what your kind does then, never as something anyone saw happen, never as a moment, a place or a scene you describe. Nothing beyond these facts happened that you know of. Never say who brought any animal, never speak of anyone else\'s animals, and never mention scores. Whatever happens to animals on the Ark happens to them and never to you: you are here, alive and talking.';

const ARK_TRUTH_SELF = ARK_TRUTH.replace(
    "Whatever happens to animals on the Ark happens to them and never to you: you are here, alive and talking.",
    "What happens to your kin on the Ark happens to them, not to you; your own Ark life is what ark_self says.",
);

/// Who is speaking (decision 438): in its own card's thread the companion is
/// one of the Ark animals itself (ark-chat-self.ts), so the rule that nothing
/// on the Ark happens to it is replaced, and it is not counted among its kin.
export type ArkKinVoice = { self?: boolean; selfAboard?: boolean };

/// The facts and the principles for this turn, never words to say. [] with no
/// mode, so every other turn is unchanged.
export function arkKinPromptLines(
    facts: ArkKinFacts | null,
    mode: ArkKinMode | null,
    now: Date,
    voice: ArkKinVoice = {},
): string[] {
    if (!facts?.enabled || !mode) return [];
    const ARK_TRUTH_NOW = voice.self ? ARK_TRUTH_SELF : ARK_TRUTH;
    const data = JSON.stringify(arkKinFactsForPrompt(facts, mode, now, voice));
    if (mode === "greeting") {
        return [
            `ark_kin — ${ARK_INTRO} What the app knows about them, true and theirs to know:\n${data}\nYou may bring one thing from this into this hello, once, in your own words, as a passing piece of news about your kin, and only if it sits naturally beside what you are opening with; if it would not, leave it out. It never replaces what you open with, it is never a report or a list, and you never bring it up again later. ${ARK_TRUTH_NOW}`,
        ];
    }
    return [
        `ark_kin — they are asking about the Ark. ${
            ARK_INTRO.replace(/^the /, "The ")
        } What the app knows about them, true and theirs to know:\n${data}\nAnswer what they asked from these facts, in your own words, as news of your kin: only what fits their question, never all of it, never as a report or a list. Anything these facts do not hold, you do not know: say so plainly, and that the Ark in the app shows it as it happens; never make up what happened there. If they ask about one of your kind that is no longer aboard, that is not yours to tell: the Ark in the app has its story. ${
            facts.hunters.length > 0
                ? "hunters_here are kinds that hunt yours and live in the same part of the Ark: speak of them only if their question is about them or about danger, gently and never graphically, as what those animals are and how your kind lives beside them, never as something that happened. "
                : ""
        }${ARK_TRUTH_NOW}`,
    ];
}

// ---------------------------------------------------------------------------
// Reads and the claim
// ---------------------------------------------------------------------------

let flagCache: { at: number; value: boolean } | null = null;
const FLAG_TTL_MS = 60 * 1000;

/// voyage_config.ark_kin_activity, read once a minute per function instance;
/// false when it cannot be read. The turn read asks its Ark question only
/// when this is true, so with the flag off its prompt is unchanged.
export async function loadArkKinEnabled(admin: ArkKinAdmin, nowMs = Date.now()): Promise<boolean> {
    if (flagCache && nowMs - flagCache.at < FLAG_TTL_MS) return flagCache.value;
    let value = false;
    try {
        const { data, error } = await admin.rpc("voyage_ark_kin_enabled", {});
        value = !error && data === true;
        if (error) console.warn("voyage_ark_kin_enabled failed", error.message);
    } catch (error) {
        console.warn("ark kin flag unavailable", error instanceof Error ? error.message : String(error));
        value = false;
    }
    flagCache = { at: nowMs, value };
    return value;
}

/// For tests: forget the cached flag.
export function resetArkKinFlagCache(): void {
    flagCache = null;
}

/// The facts for this person and chat. Null on any failure (no migration, a
/// timeout): then nothing is said.
export async function loadArkKinFacts(
    admin: ArkKinAdmin,
    params: { userId: string; speciesProfileId: string; asked: boolean },
): Promise<ArkKinFacts | null> {
    try {
        const { data, error } = await admin.rpc("voyage_ark_kin_facts_v1", {
            p_user_id: params.userId,
            p_species_profile_id: params.speciesProfileId,
            p_asked: params.asked,
        });
        if (error) {
            console.warn("voyage_ark_kin_facts_v1 failed", error.message);
            return null;
        }
        return parseArkKinFacts(data);
    } catch (error) {
        console.warn("ark kin facts unavailable", error instanceof Error ? error.message : String(error));
        return null;
    }
}

/// Claims today's one Ark reference for the kin. True only when the claim was
/// written: false on a lost race, the day already used (a meal or another
/// chat), the flag turned off meanwhile, or any failure.
export async function claimArkKinMention(
    admin: ArkKinAdmin,
    params: { userId: string; speciesProfileId: string },
): Promise<boolean> {
    try {
        const { data, error } = await admin.rpc("voyage_claim_ark_kin_mention_v1", {
            p_user_id: params.userId,
            p_species_profile_id: params.speciesProfileId,
        });
        if (error) {
            console.warn("voyage_claim_ark_kin_mention_v1 failed", error.message);
            return false;
        }
        return data === true;
    } catch (error) {
        console.warn("ark kin claim failed", error instanceof Error ? error.message : String(error));
        return false;
    }
}
