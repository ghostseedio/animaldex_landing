/* Ported from the apps' supabase/functions/_shared/animal-turn-kind.ts (AnimalDex strategy/chat-engine, 2026-11-04): keep the two in step. */
/// What a person brought to the animal this turn, read automatically: there is
/// no toggle (strategy, 2026-11-04). The kind's verdict reads it with
/// everything else (animal-kind-verdict.ts); a crisis is read apart, by its own
/// classifier (animal-crisis.ts), and overrides the rest.
///
/// - idea: something they want to start, make, try or change, with no choice in
///   it yet. It gets the full angle: the obvious take named, one real behaviour
///   of the animal's kind latched onto, and a new idea twisted from it. A step
///   only when they ask how to start.
/// - decision / problem: a side and a move, as before, and a step.
/// - chat: a hello, small talk, news, a question about the animal or the app.
/// - crisis: the fixed reply with helplines, nothing else.
///
/// The words-only reading here is the fallback for when the model's read is
/// not there (off, failed, or not run on this turn): routing still needs a
/// kind, and small talk should never wake the deep model.

export const TURN_KINDS = ["idea", "decision", "problem", "chat", "crisis"] as const;
export type TurnKind = typeof TURN_KINDS[number];

export function parseTurnKind(raw: unknown): TurnKind | null {
    if (typeof raw !== "string") return null;
    const value = raw.trim().toLowerCase();
    return (TURN_KINDS as readonly string[]).includes(value) ? value as TurnKind : null;
}

/// The kinds that get the full take: the effort floor, an angle from the
/// record, and a step when one is right.
export function isDeepTurn(kind: TurnKind | null | undefined): boolean {
    return kind === "idea" || kind === "decision" || kind === "problem";
}

function words(message: string): string[] {
    return message.toLowerCase().replace(/[’']/g, "'").match(/[\p{L}\p{N}']+/gu) ?? [];
}

const GREETING =
    /^(hi+|hey+|hello+|hiya|yo+|sup|wassup|whats ?up|what's up|howdy|gm|gn|good (morning|afternoon|evening|night)|hola|bonjour|salut|hallo|ciao|ola|oi|halo|hai|thanks?|thank you|ty|thx|lol|lmao|haha+|hehe+|ok(ay)?|kk?|cool|nice|wow|bye|cya|see ya|hru|how are (you|u)|how r u|wyd|wbu|hbu|what are you doing|who are you|are you (real|a bot|an ai)|i'?m (good|fine|ok|okay|bored|tired))\b/;

const DECISION =
    /\b(should i|shall i|or should|whether (to|i|or)|torn between|choose between|pick between|deciding|decide (between|whether|if)|can'?t decide|which (one|should)|is it worth|do i (take|quit|stay|go|leave|tell|say)|or not\b)/;

const IDEA =
    /\b(i'?m thinking (of|about)|thinking of (starting|making|opening|launching|doing|writing|moving)|i want to (start|make|build|launch|open|write|create|try|learn|move|plan|throw|run|grow|change)|i'?d (like|love) to (start|make|build|launch|open|write|create|try|move)|planning (to|a|an|on|my|our)|plan to|my idea|an idea|idea for|what if i|i'?m going to (start|make|build|launch|open|write|try)|side (project|hustle)|start(ing)? a (podcast|business|band|blog|channel|shop|club|company|garden|newsletter))\b/;

const PROBLEM =
    /\b(keeps?|kept|can'?t|cannot|won'?t|struggl\w*|problem|issue|stuck|hate|annoy\w*|worried|worry|stress\w*|anxious|lonely|alone|fight|fighting|argu\w*|broke up|break ?up|failing|failed|behind on|overwhelm\w*|nobody|no one|ignor\w*|bully\w*|jealous|scared|afraid|lost my|miss(ing)? (him|her|them)|grief|grieving|sad|upset|angry|tired of|sick of)\b/;

/// A guess from the words alone; null when they do not say.
export function heuristicTurnKind(message: string): TurnKind | null {
    const text = message.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ").trim();
    if (!text) return null;
    const count = words(text).length;
    if (DECISION.test(text)) return "decision";
    if (IDEA.test(text)) return "idea";
    if (PROBLEM.test(text)) return "problem";
    if (count <= 6 && GREETING.test(text)) return "chat";
    // A few words with no question in them is chat ("hi pet", "ok cool").
    if (count <= 3 && !text.includes("?")) return "chat";
    return null;
}

/// The kind a turn runs as: the model's read when there is one, else the
/// words; a long message nobody could read is treated as a real one.
export function resolveTurnKind(modelKind: TurnKind | null | undefined, message: string): TurnKind {
    if (modelKind) return modelKind;
    const guessed = heuristicTurnKind(message);
    if (guessed) return guessed;
    return words(message).length >= 8 ? "problem" : "chat";
}

/// A question about AnimalDex itself (messages, credits, Pro, how it works,
/// whether the animal is an AI), for when the model's read is not there.
const APP_QUESTION =
    /\b(credits?|pro (plan|account|subscription|version)|go pro|animaldex pro|premium|subscription|subscribe|unsubscribe|refund|messages? (left|limit)|how many messages|out of messages|daily limit|paywall|how (does|do) (this|the app|animaldex|it) work|what is animaldex|is this (an? )?(ai|bot|app)|are you (an? )?(ai|bot|robot|real|human|person)|(app|it)'?s? (not working|broken|crashing)|bug in|xp|level up)\b/i;

export function looksLikeAppQuestion(message: string): boolean {
    return APP_QUESTION.test(message);
}

/// Texting shorthand a friend reads without thinking. Only the ones whose
/// meaning is not obvious from the letters; ordinary words that double as
/// slang ("bet", "cap") are left to the model.
const SHORTHAND: Record<string, string> = {
    wdym: "what do you mean",
    wdyn: "what do you need (or: what do you mean)",
    wym: "what do you mean",
    hru: "how are you",
    hbu: "how about you",
    wbu: "what about you",
    wyd: "what are you doing",
    wya: "where are you",
    ngl: "not gonna lie",
    tbh: "to be honest",
    idk: "I don't know",
    idc: "I don't care",
    imo: "in my opinion",
    imho: "in my honest opinion",
    fr: "for real",
    frfr: "for real, for real",
    rn: "right now",
    smh: "shaking my head",
    nvm: "never mind",
    ikr: "I know, right",
    istg: "I swear",
    ong: "I swear (on god)",
    omw: "on my way",
    tmr: "tomorrow",
    tmrw: "tomorrow",
    ily: "I love you",
    ilysm: "I love you so much",
    jk: "just kidding",
    irl: "in real life",
    yk: "you know",
    ykwim: "you know what I mean",
    afaik: "as far as I know",
    atm: "at the moment",
    bc: "because",
    bcs: "because",
    ppl: "people",
    lowkey: "a little, quietly",
    highkey: "very, openly",
    hmu: "hit me up (get in touch)",
    tysm: "thank you so much",
    pov: "point of view",
    gtg: "got to go",
    g2g: "got to go",
    brb: "be right back",
    ttyl: "talk to you later",
    sry: "sorry",
    pls: "please",
    plz: "please",
};

/// The shorthand in their message, with what it means, at most six.
export function shorthandIn(message: string): Array<{ term: string; meaning: string }> {
    const seen = new Set<string>();
    const found: Array<{ term: string; meaning: string }> = [];
    for (const token of words(message)) {
        const meaning = SHORTHAND[token];
        if (!meaning || seen.has(token)) continue;
        seen.add(token);
        found.push({ term: token, meaning });
        if (found.length >= 6) break;
    }
    return found;
}
