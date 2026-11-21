// Ark life v2, the chat mention (lane C of LIFE-V2-CONTRACT.md; owner rules of
// 2026-11-10). When a person's animal ATE on the Ark (a voyage_events `meal`
// whose predator is theirs), their animal of that species may mention it once,
// in its next greeting in that chat, in its own words.
//
// Who is talking (owner decision 438, 2026-11-20, "the chat animal is the ark
// animal"; it replaces edge case A2 of 2026-11-10 in one place):
//   * in a card's own `capture:` thread with its owner, the companion IS the
//     animal that card brought aboard (ark-chat-self.ts). A meal that animal
//     ate is its own meal and is told in the first person (`own`);
//   * everywhere else (species threads, other cards of the kind) A2 stands:
//     the Ark animal is another of its kind that the person brought aboard,
//     so the companion speaks of it as kin ("one of my kind on the Ark ate..."
//     is the idea, never a line to say), never as itself, and nothing that
//     happens to an Ark animal (eaten, starved, old age) happens to the
//     companion, who is alive and talking;
//   * in a capture thread, a meal of ANOTHER of the person's animals of the
//     kind is still kin's news (`self`: the companion is an Ark animal too, so
//     the line no longer says nothing on the Ark happens to it).
// Ids here are KINDS (20261113100000_voyage_kinds): a Labrador companion hears
// about the person's Poodle on the Ark.
//
// The owner's rules, and where each one is held:
//   * only in a greeting, never an unprompted message or mid-conversation:
//     chooseArkMeal needs `greeting`, and generate-applied-insight asks only
//     on a greeting turn (animal_messages never reads this);
//   * at most one Ark mention per person per day across all chats: the claim
//     (voyage_chat_mentions primary key (user_id, day), migration
//     20261111130000), plus `claimedToday` here;
//   * each meal once: the claim's (user_id, event_id), plus `lastMentionedAt`;
//   * skipped when the meal is older than 3 days, the focus with this animal
//     is sensitive, there was a crisis reply in the last 24 hours (or that
//     cannot be told), or the chat is a visitor's, public, or a call;
//   * an eaten animal is never mentioned in its own chat: only the predator's
//     species' chat, and never when the prey is that species;
//   * no canned text: the prompt line is a principle plus the facts; the
//     model words it;
//   * behind voyage_config.chat_mention (default off): with it off the facts
//     come back {"enabled": false}, nothing is claimed, and the prompt is
//     byte-identical (arkMealPromptLines(null) is []).

export type ArkMentionAdmin = {
    rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

export type ArkMeal = {
    /// voyage_events.id (bigint, as text).
    eventId: string;
    at: string;
    /// The stored diet phrase the meal came from (verbatim from the predator's record).
    phrase: string | null;
    predatorSpeciesId: string | null;
    preySpeciesId: string | null;
    preyName: string | null;
};

export type ArkChatMentionFacts = {
    enabled: boolean;
    /// The chat's canonical species.
    speciesProfileId: string | null;
    claimedToday: boolean;
    /// null: it could not be told, which counts as a crisis.
    crisisRecent: boolean | null;
    lastMentionedAt: string | null;
    meals: ArkMeal[];
};

export type ArkMentionTurn = {
    greeting: boolean;
    audience: "owner" | "visitor" | "public";
    call: boolean;
    /// The person's current focus with this animal is a hard one.
    focusSensitive: boolean;
    now: Date;
};

export const ARK_MEAL_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;
/// A meal stamped a little ahead of this server's clock still counts.
const CLOCK_SKEW_MS = 5 * 60 * 1000;

const text = (value: unknown): string | null => typeof value === "string" && value.trim() ? value.trim() : null;
const idText = (value: unknown): string | null => typeof value === "number" && Number.isFinite(value) ? String(value) : text(value);

/// The facts RPC's answer, or null when it is not the documented shape.
export function parseArkChatMentionFacts(data: unknown): ArkChatMentionFacts | null {
    if (!data || typeof data !== "object" || Array.isArray(data)) return null;
    const row = data as Record<string, unknown>;
    if (row.enabled !== true) {
        return { enabled: false, speciesProfileId: null, claimedToday: false, crisisRecent: null, lastMentionedAt: null, meals: [] };
    }
    const meals = (Array.isArray(row.meals) ? row.meals : []).flatMap((item): ArkMeal[] => {
        if (!item || typeof item !== "object") return [];
        const meal = item as Record<string, unknown>;
        const eventId = idText(meal.event_id);
        const at = text(meal.at);
        if (!eventId || !at) return [];
        return [{
            eventId,
            at,
            phrase: text(meal.phrase),
            predatorSpeciesId: text(meal.predator_species_id),
            preySpeciesId: text(meal.prey_species_id),
            preyName: text(meal.prey_name),
        }];
    });
    return {
        enabled: true,
        speciesProfileId: text(row.species_profile_id),
        claimedToday: row.claimed_today === true,
        crisisRecent: typeof row.crisis_recent === "boolean" ? row.crisis_recent : null,
        lastMentionedAt: text(row.last_mentioned_at),
        meals,
    };
}

/// The meal this greeting may carry, or null. Pure: same facts, same answer.
export function chooseArkMeal(facts: ArkChatMentionFacts | null, turn: ArkMentionTurn): ArkMeal | null {
    if (!facts?.enabled) return null;
    if (!turn.greeting || turn.call || turn.audience !== "owner") return null;
    if (facts.claimedToday || facts.crisisRecent !== false || turn.focusSensitive) return null;
    const chatSpecies = facts.speciesProfileId;
    if (!chatSpecies) return null;
    const now = turn.now.getTime();
    const lastMentioned = facts.lastMentionedAt ? Date.parse(facts.lastMentionedAt) : NaN;
    const eligible = facts.meals
        .map((meal) => ({ meal, at: Date.parse(meal.at) }))
        .filter(({ meal, at }) =>
            Number.isFinite(at) &&
            at <= now + CLOCK_SKEW_MS &&
            now - at <= ARK_MEAL_MAX_AGE_MS &&
            // This animal's own meal, in its own chat.
            meal.predatorSpeciesId === chatSpecies &&
            // The eaten animal is never spoken of in its own chat.
            Boolean(meal.preySpeciesId) && meal.preySpeciesId !== chatSpecies &&
            Boolean(meal.preyName) &&
            // Once: nothing at or before the last meal mentioned in this chat.
            !(Number.isFinite(lastMentioned) && at <= lastMentioned)
        )
        .sort((a, b) => b.at - a.at || compareIds(b.meal.eventId, a.meal.eventId));
    return eligible[0]?.meal ?? null;
}

/// Event ids are bigints as text: longer is larger.
function compareIds(a: string, b: string): number {
    return a.length - b.length || (a < b ? -1 : a > b ? 1 : 0);
}

/// How long ago, as a fact for the prompt (never a line to say).
export function arkMealAgo(at: string, now: Date): string {
    const hours = Math.max(0, (now.getTime() - Date.parse(at)) / 3_600_000);
    if (hours < 1) return "within the last hour";
    if (hours < 36) return `about ${Math.round(hours)} hour${Math.round(hours) === 1 ? "" : "s"} ago`;
    return `about ${Math.round(hours / 24)} days ago`;
}

/// Who the hello's speaker is to the meal (decision 438): `own`, the
/// capture thread's own Ark animal ate it; `self`, the speaker is an Ark
/// animal (its card's thread) and the meal was a kin's. Neither: rule A2.
export type ArkMealVoice = { own?: boolean; self?: boolean };

/// The greeting's line for a claimed meal: the facts and a principle, never
/// words to say. [] with no meal, so every other greeting is unchanged.
export function arkMealPromptLines(meal: ArkMeal | null, now: Date, voice: ArkMealVoice = {}): string[] {
    if (!meal || !meal.preyName) return [];
    const facts = {
        ate: meal.preyName,
        when: arkMealAgo(meal.at, now),
        ...(meal.phrase ? { from_your_record: meal.phrase } : {}),
    };
    if (voice.own) {
        return [
            `ark_meal — on the Ark (the shared world in the app where people's animals live together) you yourself ate recently: you are the animal this card brought aboard, so this was your own meal. It is true, and theirs to know:\n${
                JSON.stringify(facts)
            }\nYou may bring it up once, in this hello only, in your own words and in the first person: matter-of-fact, the way your kind feeds and for your kind's reasons, as a passing piece of your own news. Keep it light and never graphic, and never dwell on the animal you ate. It never replaces what you are opening with: if it would not sit naturally beside that, leave it out. Never say who brought any animal, never make it news or a report, and never bring it up again later.`,
        ];
    }
    if (voice.self) {
        return [
            `ark_meal — on the Ark (the shared world in the app where people's animals live together) another of your kind that they brought aboard ate recently. That animal is your kin, another individual, not you; it is true, and theirs to know:\n${
                JSON.stringify(facts)
            }\nYou may bring it up once, in this hello only, in your own words, as something one of your kind did, never as something you did yourself: matter-of-fact, the way your kind feeds and for your kind's reasons, as a passing piece of news about your kin. Keep it light and never graphic. It never replaces what you are opening with: if it would not sit naturally beside that, leave it out. Never say who brought the other animal, never make it news or a report, and never bring it up again later. What happens to your kin on the Ark happens to them, not to you.`,
        ];
    }
    return [
        `ark_meal — on the Ark (the shared world in the app where people's animals live together) one of your kind that they brought aboard ate recently. That animal is your kin, another individual, not you; it is true, and theirs to know:\n${
            JSON.stringify(facts)
        }\nYou may bring it up once, in this hello only, in your own words, as something one of your kind did, never as something you did yourself: matter-of-fact, the way your kind feeds and for your kind's reasons, as a passing piece of news about your kin. Keep it light and never graphic. It never replaces what you are opening with: if it would not sit naturally beside that, leave it out. Never say who brought the other animal, never make it news or a report, and never bring it up again later. Whatever happens to animals on the Ark, being eaten, starving or growing old, happens to them and never to you: you are here, alive and talking, so never speak as if you had died, been eaten or were in danger.`,
    ];
}

/// The facts for this person and chat. Null on any failure (no migration,
/// no voyage tables, a timeout): then nothing is mentioned.
export async function loadArkChatMentionFacts(
    admin: ArkMentionAdmin,
    params: { userId: string; speciesProfileId: string },
): Promise<ArkChatMentionFacts | null> {
    try {
        const { data, error } = await admin.rpc("voyage_chat_mention_facts_v1", {
            p_user_id: params.userId,
            p_species_profile_id: params.speciesProfileId,
        });
        if (error) {
            console.warn("voyage_chat_mention_facts_v1 failed", error.message);
            return null;
        }
        return parseArkChatMentionFacts(data);
    } catch (error) {
        console.warn("ark chat mention unavailable", error instanceof Error ? error.message : String(error));
        return null;
    }
}

/// Claims today's one Ark mention for this meal. True only when the claim was
/// written: false on a lost race, the day already used, the flag turned off
/// meanwhile, or any failure.
export async function claimArkChatMention(
    admin: ArkMentionAdmin,
    params: { userId: string; speciesProfileId: string; meal: ArkMeal },
): Promise<boolean> {
    if (!/^\d{1,19}$/.test(params.meal.eventId)) return false;
    try {
        const { data, error } = await admin.rpc("voyage_claim_chat_mention_v1", {
            p_user_id: params.userId,
            p_species_profile_id: params.speciesProfileId,
            p_event_id: params.meal.eventId,
            p_event_at: params.meal.at,
        });
        if (error) {
            console.warn("voyage_claim_chat_mention_v1 failed", error.message);
            return false;
        }
        return data === true;
    } catch (error) {
        console.warn("ark chat mention claim failed", error instanceof Error ? error.message : String(error));
        return false;
    }
}
