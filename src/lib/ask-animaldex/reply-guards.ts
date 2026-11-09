/* Ported from the apps' supabase/functions/_shared/animal-reply-guards.ts (AnimalDex strategy/chat-engine, 2026-11-04): keep the two in step. */
/// What keeps one reply from turning into the last one, and the turn's own
/// guide for the animal (strategy, 2026-11-04; the CTO's transcript review of
/// 1-3 Nov):
///
/// - The same picture again: "an arm regrows" ran through 7 replies in a row.
///   The pictures from the animal's own life in its last replies are named to
///   it, so it reaches for another part of its life, or none.
/// - One skeleton: every problem got emoji headers, a numbered list and a
///   closing question. The shape of its last reply is named, so this one
///   takes another; an idea gets none.
/// - Slang taken literally ("wdyn" got "I don't know what that means"): the
///   shorthand in the message is spelled out.
/// - A question about credits answered in character with an upsell: an app
///   question gets the real facts to answer from, plainly.
/// - Step churn: five steps set, replaced or dropped on one problem in two
///   hours. At most one new step on a problem a day, unless they report on it
///   or ask for another (newStepAllowed, also enforced when the step is written).
/// - Light preferences they have told the animals (short answers, straight to
///   the point) go into the brief.
///
/// All of it is per turn, in the user prompt, after the cached system prompt.

import type {AskMemoryFact as AnimalChatMemoryFact} from "@/lib/ask-animaldex/memory-prompt";
import {shorthandIn, type TurnKind} from "@/lib/ask-animaldex/turn-kind";

const STOPWORDS = new Set(
    ("a an and are as at be been but by can could did do does for from had has have he her him his how i i'm if in into " +
        "is it it's its just me more most my no not of on one or our out so some than that the their them then there these " +
        "they this to too up us was we were what when where which while who why will with would you your you're yours " +
        "about again all also am any because before being both each few get go going got here just know like make much " +
        "need now only other over really right same say see should still such take tell thing things think through very " +
        "want way well even ever let lot back down off first last next new old own yes yeah okay ok").split(" "),
);

/// Words too common in any reply to be a picture.
const PLAIN_WORDS = new Set(
    ("step steps week today tomorrow day days time times people person someone something anything everything nothing " +
        "life work job home friend friends talk said says start started try trying keep kept give gave move moves good " +
        "better best bad hard easy small big little long short real part whole kind sort").split(" "),
);

function contentWords(text: string): string[] {
    return (text.toLowerCase().replace(/[’']/g, "'").match(/[\p{L}\p{N}']+/gu) ?? [])
        .map((word) => word.replace(/^'+|'+$/g, ""))
        .filter((word) => word.length >= 3 && !STOPWORDS.has(word));
}

/// The animal's recent replies, oldest first (the hidden lines after the
/// follow-ups never reach the history, so this is what the person saw).
export function recentAnimalReplies(history: Array<{ role?: string | null; content?: string | null }>, limit = 4): string[] {
    return history
        .filter((turn) => turn.role === "assistant" && typeof turn.content === "string" && turn.content.trim())
        .map((turn) => (turn.content as string).split("§§FOLLOW_UPS§§")[0])
        .slice(-limit);
}

/// The words of the animal's world, from its record: what its pictures are made of.
export function recordVocabulary(texts: Array<string | null | undefined>): Set<string> {
    const out = new Set<string>();
    for (const text of texts) {
        for (const word of contentWords(text ?? "")) {
            if (word.length >= 4 && !PLAIN_WORDS.has(word)) out.add(word);
        }
    }
    return out;
}

function pairs(text: string): string[] {
    const words = contentWords(text).filter((word) => !PLAIN_WORDS.has(word));
    const out: string[] = [];
    for (let i = 0; i + 1 < words.length; i++) out.push(`${words[i]} ${words[i + 1]}`);
    return out;
}

/// The pictures in the last replies: two-word phrases that came back in two
/// of them, and, in the last two, phrases made of the animal's own world
/// (a word from its record). Newest first, at most six.
export function imagesUsed(replies: string[], vocabulary: Set<string> = new Set()): string[] {
    const counts = new Map<string, { replies: number; last: number }>();
    replies.forEach((reply, index) => {
        for (const pair of Array.from(new Set(pairs(reply)))) {
            const entry = counts.get(pair) ?? { replies: 0, last: -1 };
            counts.set(pair, { replies: entry.replies + 1, last: index });
        }
    });
    const recent = replies.length - 2;
    const picked = Array.from(counts.entries())
        .filter(([pair, entry]) =>
            entry.replies >= 2 || (entry.last >= recent && pair.split(" ").some((word) => vocabulary.has(word)))
        )
        .sort((a, b) => b[1].replies - a[1].replies || b[1].last - a[1].last);
    const out: string[] = [];
    for (const [pair] of picked) {
        // "regrows arm" and "arm regrows" are one picture.
        if (out.some((kept) => kept.split(" ").some((word) => pair.split(" ").includes(word)))) continue;
        out.push(pair);
        if (out.length >= 6) break;
    }
    return out;
}

/// Which of those pictures a new reply used again (the eval and the logs read it).
export function imagesReused(reply: string, images: string[]): string[] {
    const own = new Set(pairs(reply));
    return images.filter((image) => own.has(image) || own.has(image.split(" ").reverse().join(" ")));
}

export type ReplyShape = "headings" | "table" | "diagram" | "numbered" | "bullets" | "plain";

/// The layout a reply was given, its most structured part first.
export function replyShape(text: string): ReplyShape {
    if (/^#{2,3}\s/m.test(text)) return "headings";
    if (/^\|.+\|\s*$/m.test(text)) return "table";
    if (/```text/.test(text)) return "diagram";
    if (/^\s*\d+\.\s/m.test(text)) return "numbered";
    if (/^\s*[-*•]\s/m.test(text)) return "bullets";
    return "plain";
}

const SHAPE_WORDS: Record<ReplyShape, string> = {
    headings: "under headings",
    table: "as a table",
    diagram: "around a drawing",
    numbered: "as a numbered list",
    bullets: "as a list",
    plain: "as plain talk",
};

/// This reply's shape, against the last one's.
export function formatVarietyLine(replies: string[], kind: TurnKind | null, rich = false): string | null {
    if (kind === "chat" || kind === "crisis") return null;
    const shapes = replies.slice(-2).map(replyShape);
    const last = shapes.at(-1);
    if (kind === "idea") {
        // A build that draws rich answers may show the twist (the owner, 2026-11-07:
        // "showing ideas using symbols and ascii"); still no skeleton of headings or lists.
        return rich
            ? "this_reply_shape — an idea: talk it through in a few short paragraphs; when your twist is easier seen than said, " +
                "sketch it once under your words (a small text diagram or a few symbol-marked lines). No headings, a list only if they ask."
            : "this_reply_shape — an idea gets no layout: talk it through in a few short paragraphs, a list only if they ask for one.";
    }
    if (!last || last === "plain") return null;
    const again = shapes.length === 2 && shapes[0] === last;
    return `this_reply_shape — your last ${again ? "two replies were" : "reply was"} laid out ${SHAPE_WORDS[last]}. Give this one a different shape: ` +
        "plain talk, or the one structure this answer really needs. Never the same skeleton twice in a row.";
}

// ---------------------------------------------------------------------------
// Light preferences, from what they have told the animals
// ---------------------------------------------------------------------------

export type AnswerPreferences = { length: "short" | "detailed" | null; manner: "direct" | "gentle" | null };

const SHORT = /\b(short|brief|concise|quick|one[- ]line|few words|to the point|tl;?dr|less text|not too long)\b/i;
const DETAILED = /\b(detailed|in depth|in-depth|thorough|long(er)? answers|explain (fully|everything)|lots of detail)\b/i;
const DIRECT = /\b(direct|blunt|straight|honest|no sugar|brutal|tell (it|me) like it is|no fluff)\b/i;
const GENTLE = /\b(gentle|gently|kind|soft|go easy|reassur|encourag|patient)\b/i;

/// How they like answers, from the facts that say so (memory kind
/// "preference", or a fact that is plainly about answers).
export function answerPreferences(memory: AnimalChatMemoryFact[]): AnswerPreferences {
    const prefs: AnswerPreferences = { length: null, manner: null };
    for (const fact of [...memory].reverse()) {
        const text = fact.fact;
        const aboutAnswers = fact.kind === "preference" || /\b(answers?|replies|advice|told|explain|talk)\b/i.test(text);
        if (!aboutAnswers) continue;
        prefs.length ??= SHORT.test(text) ? "short" : DETAILED.test(text) ? "detailed" : null;
        prefs.manner ??= DIRECT.test(text) ? "direct" : GENTLE.test(text) ? "gentle" : null;
    }
    return prefs;
}

export function preferenceLine(prefs: AnswerPreferences): string | null {
    const parts = [
        prefs.length === "short" ? "short answers" : prefs.length === "detailed" ? "detailed answers" : null,
        prefs.manner === "direct" ? "said straight, no softening" : prefs.manner === "gentle" ? "said gently" : null,
    ].filter(Boolean);
    return parts.length > 0
        ? `how_they_like_answers — they have told the animals they like ${parts.join(", ")}. Fit this reply to it, in your own manner.`
        : null;
}

// ---------------------------------------------------------------------------
// One new step on a problem a day
// ---------------------------------------------------------------------------

const ASKS_FOR_ANOTHER = new RegExp(
    [
        "\\b(different|another|other|new|else|easier|smaller|simpler)\\b.{0,30}\\b(step|one|thing|task|idea|something|way)\\b",
        "\\bsomething else\\b",
        "\\b(change|swap|replace)\\b.{0,20}\\b(step|it|that|this)\\b",
        "\\bnot (that|this) one\\b",
        "\\bcan'?t do (that|this|it)\\b",
        "\\btoo (hard|big|much|scary)\\b",
        "\\b(otro paso|otra cosa|autre (étape|chose)|anderen? schritt|etwas anderes|outro passo|outra coisa|altro passo|qualcos'altro|langkah lain|yang lain)\\b",
    ].join("|"),
    "i",
);

/// Whether a step the animal writes in this reply may replace the open one:
/// always when there is none, it is the same step, they reported on it, or
/// they asked for another; otherwise not while the open one was set less than
/// a day ago.
export function newStepAllowed(params: {
    openTrial: { step: string; set_at?: string | null } | null | undefined;
    newStep: string | null | undefined;
    reportedDone: boolean;
    userMessage: string;
    /// A debate way they chose is waiting for its step from this animal
    /// (companion.chosen_way, AnimalDex migration 20261110100000).
    chosenWay?: boolean;
    now?: Date;
}): boolean {
    const open = params.openTrial;
    if (!params.newStep || !open) return true;
    if (open.step.trim().toLowerCase() === params.newStep.trim().toLowerCase()) return true;
    if (params.reportedDone) return true;
    if (params.chosenWay) return true;
    if (ASKS_FOR_ANOTHER.test(params.userMessage)) return true;
    const setAt = open.set_at ? Date.parse(open.set_at) : Number.NaN;
    if (!Number.isFinite(setAt)) return true;
    return (params.now ?? new Date()).getTime() - setAt >= 24 * 60 * 60 * 1000;
}

/// Set less than a day ago: the companion block says so (set_today).
export function stepSetToday(setAt: string | null | undefined, now: Date = new Date()): boolean {
    const at = setAt ? Date.parse(setAt) : Number.NaN;
    return Number.isFinite(at) && now.getTime() - at < 24 * 60 * 60 * 1000;
}

// ---------------------------------------------------------------------------
// App questions
// ---------------------------------------------------------------------------

export type AppFacts = {
    remaining?: number | null;
    limit?: number | null;
    isPro?: boolean | null;
    resetsAt?: string | null;
    creditBalance?: number | null;
    creditsCanPay?: boolean | null;
    creditCost?: number | null;
};

/// The real facts a question about the app is answered from, plainly. Only
/// what is true for this person now, and the few rules every client shares.
export function appFactsLines(facts: AppFacts): string[] {
    const now = Object.fromEntries(Object.entries({
        messages_left_today: facts.remaining,
        messages_a_day: facts.limit,
        resets_at: facts.resetsAt,
        pro: facts.isPro,
        credits: facts.creditBalance,
        credits_can_pay_for_a_message: facts.creditsCanPay,
        credits_per_message: facts.creditsCanPay ? facts.creditCost : undefined,
    }).filter(([, value]) => value !== null && value !== undefined));
    return [
        "app_question — they are asking about AnimalDex itself. Answer that plainly and briefly, in a sentence or two, out of",
        "character only as long as it takes, then carry on as yourself. No card, no step, no pitch for Pro. Say only what",
        "app_facts says; for anything else (billing, refunds, their account, something broken) say you don't know and that",
        "Settings has help.",
        `app_facts: ${JSON.stringify(now)}`,
        "- Talking is a number of messages a day, and the count starts again each day; a hello from an animal is free.",
        "  Pro gives more messages a day. With Pro, once the day's messages are used, a message can be paid for with credits.",
        "- One real step done with an animal earns its Power. Capturing an animal adds it to their collection, and they can",
        "  also meet and talk to animals they have not captured.",
        "- The animals are AI: they speak as each animal, from what AnimalDex knows about its kind.",
    ];
}

// ---------------------------------------------------------------------------
// The turn's guide
// ---------------------------------------------------------------------------

/// Everything this turn adds for the animal, in the order it reads it, after
/// the rest of the context (contextLines' turnGuide).
export function turnGuideLines(params: {
    kind: TurnKind | null;
    /// The model's read of the turn was there (a verdict section carries the take).
    hasTake: boolean;
    message: string;
    replies: string[];
    vocabulary?: Set<string>;
    memory?: AnimalChatMemoryFact[];
    appQuestion?: boolean;
    appFacts?: AppFacts | null;
    teenLines?: string[] | null;
    /** This turn is drawn rich (`animalRichAnswers`): an idea may be sketched. */
    rich?: boolean;
}): string[] {
    const lines: string[] = [];
    if (params.kind === "chat") {
        lines.push(
            "this_turn — small talk. Answer lightly, the way a friend texts back: a line or two, warm, in your own voice. No",
            "advice, no verdict, no step.",
        );
    } else if (params.kind === "idea" && !params.hasTake) {
        lines.push(
            "this_turn — they brought an idea. Build on it from one real thing your kind does, from your record, into a new",
            "version of it nobody else would suggest. No side on whether to do it, no audit, no step unless they ask how to start.",
        );
    }
    const shorthand = shorthandIn(params.message);
    if (shorthand.length > 0) {
        lines.push(`their_words — shorthand in their message, as a friend reads it: ${shorthand.map((item) => `${item.term} = ${item.meaning}`).join("; ")}.`);
    }
    const images = imagesUsed(params.replies, params.vocabulary);
    if (images.length > 0 && params.kind !== "crisis") {
        lines.push(
            `images_used — pictures you used in your last replies: ${images.map((image) => `"${image}"`).join(", ")}. Don't reach for`,
            "them again: if this reply needs a picture, take it from another part of your life, or use none.",
        );
    }
    const shape = formatVarietyLine(params.replies, params.kind, params.rich === true);
    if (shape) lines.push(shape);
    const preference = params.memory ? preferenceLine(answerPreferences(params.memory)) : null;
    if (preference) lines.push(preference);
    if (params.appQuestion && params.appFacts) lines.push(...appFactsLines(params.appFacts));
    if (params.teenLines?.length) lines.push(...params.teenLines);
    return lines;
}
