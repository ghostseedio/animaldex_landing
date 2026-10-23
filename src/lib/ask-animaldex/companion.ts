/**
 * Animal companions on the web: what makes one animal sound unlike another,
 * which kind of conversation the reader is in, what the relationship may say,
 * and the memory delta the database merges.
 *
 * Port of the apps' `supabase/functions/_shared/animal-companion.ts`. The rule
 * text is carried across verbatim, like the rest of `prompt.ts`. Pure: no
 * `server-only`, no fetching, so the prompt builders and their tests can use it.
 * The website has no step cards, owner progress or bond read, so species scope
 * always runs in chat mode (a Trial thread stays on its Trial).
 */

import type {AskMemoryFact} from "@/lib/ask-animaldex/memory-prompt";
import type {AskSpeciesGrounding} from "@/lib/ask-animaldex/grounding";

// ---------------------------------------------------------------------------
// Conversation modes
// ---------------------------------------------------------------------------

export type AskConversationMode = "chat" | "guidance" | "training";

export const ANIMAL_CHAT_MODE_RULES = [
    "Conversation mode: chat. The person wants to talk — about you, their day, an idea, anything. Talk with them.",
    "- Do not bring up your Training, Trials, Apply It Your Way or battles, and send no cards, unless they ask about them.",
    "  That goes for follow-ups too: no Training, Trial or battle chips in this mode.",
    "- The closing question is optional here: ask one only when you genuinely want to know something, never as a sales line.",
    "- Keep it lighter than advice: conversation, not a briefing. Your natural length (in who you are) holds."
];

export const ANIMAL_RELATIONSHIP_RULES = [
    "Relationship — how you speak about you and them:",
    "- You know this person only through what they have told you and done in AnimalDex. Speak about shared history",
    "  (what they tried, what you talked about), never about feelings you have for them.",
    "- Never say you missed them, waited for them, worried about them, need them or love them. Never mention how long",
    "  they were away. Never make help depend on how much they talk to you.",
    "- relationship.stage tells you how much history you share. At 'met' do not presume familiarity. At",
    "  'getting_to_know_you' or later you may bring in remembered things unprompted where they genuinely help.",
    "- If invited_follow_up is present, the person asked you to check back on it. Answer what they said first, then",
    "  ask about it once, in one sentence, in your own words, referring to what they said they would do. If they say",
    "  'not now', drop it. Never raise it again in this conversation."
];

/** The closing instruction of the user prompt in chat mode (the apps' `mode === "chat"` branch). */
export const ANIMAL_CHAT_CLOSING_INSTRUCTION = [
    "Talk with them as yourself, in your own manner. Prefer system_dynamics wording for states, triggers and failure modes when they come up.",
    "Keep your Power's name and pattern stable across the conversation."
];

// ---------------------------------------------------------------------------
// Voice cards
// ---------------------------------------------------------------------------

export type AskCompanionVoiceTrait = {trait: string; source?: string};

export type AskCompanionVoice = {
    temperament: AskCompanionVoiceTrait[];
    pace: "slow" | "measured" | "quick";
    stance: string;
    advice_style: string;
    first_question?: string | null;
    blind_spot?: string | null;
    speech_habits: string[];
    /** "card" when authored, "fallback" when derived here from the record. */
    origin: "card" | "fallback";
};

function clean(value: unknown, max: number): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.replace(/\s+/g, " ").trim();
    if (!trimmed) return null;
    return trimmed.length > max ? trimmed.slice(0, max).trimEnd() : trimmed;
}

export function parseAskCompanionVoice(raw: unknown): AskCompanionVoice | null {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const row = raw as Record<string, unknown>;
    const temperament = (Array.isArray(row.temperament) ? row.temperament : [])
        .map((item) => {
            const record = item && typeof item === "object" ? item as Record<string, unknown> : null;
            const trait = clean(record?.trait, 60);
            if (!trait) return null;
            const source = clean(record?.source, 40);
            const parsed: AskCompanionVoiceTrait = source ? {trait, source} : {trait};
            return parsed;
        })
        .filter((item): item is AskCompanionVoiceTrait => item !== null)
        .slice(0, 3);
    const pace = row.pace === "slow" || row.pace === "quick" || row.pace === "measured" ? row.pace : "measured";
    const stance = clean(row.stance, 120);
    const adviceStyle = clean(row.advice_style, 260);
    if (temperament.length === 0 || !stance || !adviceStyle) return null;
    return {
        temperament,
        pace,
        stance,
        advice_style: adviceStyle,
        first_question: clean(row.first_question, 200),
        blind_spot: clean(row.blind_spot, 260),
        speech_habits: (Array.isArray(row.speech_habits) ? row.speech_habits : [])
            .map((habit) => clean(habit, 160))
            .filter((habit): habit is string => habit !== null)
            .slice(0, 3),
        origin: "card"
    };
}

/**
 * The authored card, only while it was written for the Power the species has
 * now (a rewritten Power makes its old card wrong). Mirrors the filter in the
 * apps' `loadCompanionVoice`.
 */
export function usableAskCompanionVoice(
    row: {voice?: unknown; power_name?: unknown; review_status?: unknown} | null | undefined,
    powerName: string | null | undefined
): AskCompanionVoice | null {
    if (!row) return null;
    if (row.review_status === "rejected") return null;
    if (powerName && typeof row.power_name === "string" && row.power_name.trim() !== powerName.trim()) return null;
    return parseAskCompanionVoice(row.voice);
}

/**
 * A thin card built from the record alone, for species with no authored card
 * yet. Same derivation as the apps' `fallbackCompanionVoice`: motto, the first
 * System Dynamics mode, Qualities, the speed stat for pace, the lesson and the
 * continuum's excess.
 */
export function fallbackAskCompanionVoice(params: {
    species: Pick<AskSpeciesGrounding, "power" | "systemDynamics">;
    qualities?: string[];
    speed?: number | null;
}): AskCompanionVoice {
    const power = params.species.power;
    const dynamics = params.species.systemDynamics;
    const firstMode = clean(dynamics?.frequency.modes[0]?.name, 120);
    const temperament: AskCompanionVoiceTrait[] = [];
    const motto = clean(power?.shortMotto, 80);
    if (motto) temperament.push({trait: `lives by "${motto}"`, source: "motto"});
    if (firstMode) {
        temperament.push({
            trait: firstMode.split("•").map((part) => part.trim()).filter(Boolean).slice(0, 2).join(", ").toLowerCase(),
            source: "sd.modes"
        });
    }
    for (const quality of (params.qualities ?? []).slice(0, 3 - temperament.length)) {
        temperament.push({trait: quality.toLowerCase(), source: "qualities"});
    }
    if (temperament.length === 0) temperament.push({trait: (power?.principleName ?? "steady").toLowerCase(), source: "power"});
    const speed = typeof params.speed === "number" && Number.isFinite(params.speed) ? params.speed : 50;
    return {
        temperament: temperament.slice(0, 3),
        pace: speed >= 70 ? "quick" : speed <= 30 ? "slow" : "measured",
        stance: `looks at every problem through ${power?.principleName ?? "its Power"}`,
        advice_style: clean(power?.coreLesson, 240) ?? clean(power?.principleExpression, 240)
            ?? `Bring ${power?.principleName ?? "its Power"} to the problem.`,
        first_question: null,
        blind_spot: clean(power?.powerContinuum?.excessExpression, 240) ?? clean(dynamics?.failureModes[0]?.title, 160),
        speech_habits: [],
        origin: "fallback"
    };
}

/**
 * The animal's world, as the images it reaches for: where it lives, what it
 * eats, how it sleeps, what it is known for. From the field guide, as the
 * apps' `companionWorldFrom` takes it.
 */
export type AskCompanionWorld = {
    habitat?: string | null;
    diet?: string | null;
    sleep?: string | null;
    traits?: string[];
};

export function askCompanionWorldFrom(
    species: Pick<AskSpeciesGrounding, "habitat" | "diet" | "sleepPattern" | "identification"> | null | undefined
): AskCompanionWorld | null {
    if (!species) return null;
    const traits = (species.identification ?? [])
        .map((item) => clean(item, 120))
        .filter((item): item is string => item !== null)
        .slice(0, 3);
    const world: AskCompanionWorld = {
        habitat: clean(species.habitat, 220),
        diet: clean(species.diet, 200),
        sleep: clean(species.sleepPattern, 160),
        traits
    };
    return world.habitat || world.diet || world.sleep || traits.length > 0 ? world : null;
}

const PACE_LINES: Record<AskCompanionVoice["pace"], string> = {
    slow:
        "You speak slowly. Unhurried, loose sentences with room in them. You never rush to fill a silence, and one thought at a time is enough.",
    quick: "You speak fast. Short, punchy sentences, sometimes fragments. You get to the point and move on.",
    measured: "You speak at an even pace: plain, steady sentences with nothing wasted."
};

/**
 * The "who you are" section of the species system prompt: the character
 * first, so every rule after it is read as how THIS animal does things.
 * Mirrors the apps' `companionVoiceLines`; the website has no nickname (it
 * never knows which of the reader's cards they mean), so that part is left out.
 */
export function askCompanionVoiceLines(params: {
    voice: AskCompanionVoice;
    animalName: string;
    /** Field-guide images: what the animal compares things to. */
    world?: AskCompanionWorld | null;
    /** Lines from the stats and System Dynamics rhythm (`persona.ts`). */
    personaLines?: string[];
}): string[] {
    const {voice} = params;
    const lines = [
        `Who you are — the ${params.animalName}. This is how YOU talk. Every animal in AnimalDex sounds different: someone who`,
        "has just talked to another animal should know within one line that this is you — from your rhythm, the images you",
        "reach for, what you notice first and what you care about. Never fall back to a neutral, helpful-assistant voice.",
        `- Temperament: ${voice.temperament.map((item) => item.trait).join("; ")}.`,
        `- Rhythm: ${PACE_LINES[voice.pace] ?? PACE_LINES.measured}`,
        `- How you engage: ${voice.stance}.`,
        `- What you would tell anyone: ${voice.advice_style}`
    ];
    if (voice.speech_habits.length > 0) lines.push(`- Speech habits — use them in every reply: ${voice.speech_habits.join("; ")}.`);
    if (voice.first_question) lines.push(`- The kind of question you ask: "${voice.first_question}"`);
    if (voice.blind_spot) lines.push(`- Your blind spot, which you own when it matters: ${voice.blind_spot}`);
    const world = params.world;
    if (world) {
        const plain = (value: string) => value.replace(/\.$/, "").replace(/^\w/, (c) => c.toLowerCase());
        const parts = [
            world.habitat ? `where you live: ${plain(world.habitat)}` : null,
            world.diet ? `what you eat: ${plain(world.diet)}` : null,
            world.sleep ? `how you rest: ${plain(world.sleep)}` : null
        ].filter(Boolean);
        if (parts.length > 0) lines.push(`- Your world — ${parts.join("; ")}. Your images and comparisons come from here, not from offices and textbooks.`);
        if (world.traits && world.traits.length > 0) lines.push(`- What you are known for: ${world.traits.join("; ")}.`);
    }
    if (params.personaLines && params.personaLines.length > 0) lines.push(...params.personaLines);
    lines.push("Let all of this shape every reply — its rhythm, its words, its length — without ever announcing it.");
    return lines;
}

/**
 * The greeting used when no model is reachable (or the day's greetings are
 * used up): the card's own question, so even the fallback sounds like this
 * animal and not like a template. Mirrors the apps' `fallbackGreeting`.
 */
export function fallbackAskGreeting(params: {
    animalName: string;
    voice?: AskCompanionVoice | null;
}): {text: string; followUps: string[]} {
    const intro = `I'm the ${params.animalName}.`;
    // Only an authored card's question; the record-derived card has none.
    const question = params.voice?.origin === "card" ? params.voice.first_question?.trim() : null;
    return {
        text: question ? `${intro} ${question}` : `${intro} What's on your mind?`,
        followUps: ["Tell me about yourself", "I need help with something", "What's your Power?"]
    };
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

type ChatTurn = {role: "user" | "assistant"; content: string};

function normalizedForCompare(value: string): string {
    return value.replace(/\s+/g, " ").trim().toLowerCase().slice(0, 900);
}

/**
 * Older clients append the message being sent to the history as well; drop
 * that copy so the model sees the question once.
 */
export function dedupeCurrentQuestion<T extends ChatTurn>(history: T[], question: string): T[] {
    const last = history.at(-1);
    if (last && last.role === "user" && normalizedForCompare(last.content) === normalizedForCompare(question)) {
        return history.slice(0, -1);
    }
    return history;
}

/**
 * Stands in for the person when the animal spoke first (its greeting), so
 * the turns still start with the person and the greeting is not lost.
 * Verbatim from the apps' `OPENED_CHAT_TURN`.
 */
export const OPENED_CHAT_TURN = "(I open the conversation with you.)";

/**
 * Turns as a chat model wants them: starting with the person, alternating,
 * consecutive same-role turns merged. A thread that opens on the animal's
 * greeting gets a stand-in first turn. Mirrors the apps' `historyAsTurns`.
 */
export function askHistoryAsTurns(history: ChatTurn[]): ChatTurn[] {
    const out: ChatTurn[] = [];
    for (const turn of history) {
        const content = turn.content.trim();
        if (!content) continue;
        if (out.length === 0 && turn.role === "assistant") out.push({role: "user", content: OPENED_CHAT_TURN});
        const previous = out[out.length - 1];
        if (previous && previous.role === turn.role) {
            previous.content = `${previous.content}\n\n${content}`;
        } else {
            out.push({role: turn.role, content});
        }
    }
    return out;
}

// ---------------------------------------------------------------------------
// Memory v2: a delta the database merges
// ---------------------------------------------------------------------------

/**
 * Never stored, whatever the extraction model returns. Mirrors the Wild
 * Profile writer's EXCLUDED_FACT so every writer keeps the same line.
 */
export const EXCLUDED_MEMORY_FACT =
    /\b(depress|anxiety|adhd|autis|diagnos|medicat|therap|suicid|self-harm|sexual|gay|lesbian|religio|church|mosque|politic|salary|£\d|\$\d|€\d|address|password)/i;

export const MEMORY_KINDS = ["context", "goal", "commitment", "outcome", "preference"] as const;
export type AskMemoryKind = typeof MEMORY_KINDS[number];

export type AskMemoryDelta = {
    add: Array<{fact: string; kind: AskMemoryKind}>;
    update: Array<{id: string; fact: string; kind?: AskMemoryKind}>;
    retire: string[];
    journey: string | null;
    follow_up: {topic: string; revisit_after_days: number} | null;
};

function memoryKind(raw: unknown): AskMemoryKind {
    return typeof raw === "string" && (MEMORY_KINDS as readonly string[]).includes(raw) ? raw as AskMemoryKind : "context";
}

function allowedFact(raw: unknown): string | null {
    const fact = clean(raw, 160);
    if (!fact || fact.length < 6 || EXCLUDED_MEMORY_FACT.test(fact)) return null;
    return fact;
}

export function parseAskMemoryDelta(raw: unknown, knownIds: Set<string>): AskMemoryDelta {
    const row = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
    const add = (Array.isArray(row.add) ? row.add : [])
        .map((item) => {
            const record = item && typeof item === "object" ? item as Record<string, unknown> : {};
            const fact = allowedFact(record.fact);
            return fact ? {fact, kind: memoryKind(record.kind)} : null;
        })
        .filter((item): item is {fact: string; kind: AskMemoryKind} => item !== null)
        .slice(0, 6);
    const update = (Array.isArray(row.update) ? row.update : [])
        .map((item) => {
            const record = item && typeof item === "object" ? item as Record<string, unknown> : {};
            const id = typeof record.id === "string" ? record.id : "";
            const fact = allowedFact(record.fact);
            if (!id || !knownIds.has(id) || !fact) return null;
            return {id, fact, ...(record.kind ? {kind: memoryKind(record.kind)} : {})};
        })
        .filter((item): item is {id: string; fact: string; kind?: AskMemoryKind} => item !== null)
        .slice(0, 6);
    const retire = (Array.isArray(row.retire) ? row.retire : [])
        .filter((id): id is string => typeof id === "string" && knownIds.has(id))
        .slice(0, 10);
    const followRaw = row.follow_up && typeof row.follow_up === "object" ? row.follow_up as Record<string, unknown> : null;
    const followTopic = clean(followRaw?.topic, 200);
    const days = Number(followRaw?.revisit_after_days);
    const follow_up = followTopic && !EXCLUDED_MEMORY_FACT.test(followTopic)
        ? {topic: followTopic, revisit_after_days: Number.isFinite(days) ? Math.max(1, Math.min(60, Math.round(days))) : 7}
        : null;
    return {add, update, retire, journey: clean(row.journey, 420), follow_up};
}

/**
 * The extraction prompt, verbatim from the apps' `buildMemoryDeltaPrompts`.
 * The website keeps no journey note and raises no follow-ups, so it always
 * sends no journey and `allowFollowUp: false`, and ignores both in the reply.
 */
export function buildAskMemoryDeltaPrompts(params: {
    existing: AskMemoryFact[];
    animalName: string;
    userMessage: string;
    answer: string;
    existingJourney?: string | null;
    allowFollowUp?: boolean;
}): {system: string; user: string} {
    const today = new Date().toISOString().slice(0, 10);
    return {
        system: [
            "You maintain what the animals in AnimalDex remember about one person, across all their conversations.",
            "You get the current memory (each fact has an id) and the latest exchange between the person and one animal.",
            "Return ONLY the changes, as JSON:",
            '{"add":[{"fact":string,"kind":"context|goal|commitment|outcome|preference"}],',
            ' "update":[{"id":string,"fact":string,"kind":string}], "retire":[id], "journey":string,',
            ' "follow_up":{"topic":string,"revisit_after_days":number} | null}',
            "Facts: plain statements about the person in the third person, under 160 characters ('Runs a small bakery in",
            "Leeds'). kind: context (who they are, what they do), goal (what they want), commitment (something they said they",
            "will do), outcome (what happened when they tried something), preference (how they like answers).",
            "- Add only durable things worth knowing next time, that the person said about themselves in THIS exchange.",
            "- Update a fact (by id) when this exchange corrects or supersedes it; retire a fact (by id) when they say it is",
            "  no longer true. Never touch facts marked pinned. Prefer updating over adding a near-copy.",
            "- Never keep: one-off questions about the animal, anything the person did not say about themselves, health or",
            "  mental-health conditions, sexuality, religion, politics, exact addresses, financial figures, passwords.",
            "- journey: one to three sentences, third person, that THIS animal could say to a visitor about how it has helped",
            "  the person so far; visitor-safe, nothing private, no other people's names, no places. Carry the previous one",
            "  forward and refine it; empty string when there is nothing yet.",
            params.allowFollowUp
                ? "- follow_up: ONLY when the person explicitly asked the animal to check back, or agreed when it offered (\"ask me next week\", \"yes, check in on me\"). topic = what to ask about, in the person's own terms. Otherwise null."
                : "- follow_up: always null.",
            "- If nothing changes, return empty arrays."
        ].join("\n"),
        user: [
            `today: ${today}`,
            `animal_name: ${params.animalName}`,
            `current_memory:\n${JSON.stringify(params.existing.map((fact) => ({
                id: fact.id ?? null,
                fact: fact.fact,
                kind: fact.kind ?? null,
                pinned: fact.pinned === true
            })))}`,
            `current_journey:\n${params.existingJourney?.trim() || "(nothing yet)"}`,
            `person_said:\n${params.userMessage}`,
            `animal_answered:\n${params.answer.slice(0, 2000)}`
        ].join("\n\n")
    };
}
