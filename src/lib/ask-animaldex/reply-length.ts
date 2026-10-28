/**
 * How long this one reply should be.
 *
 * A fixed "about N words" made every reply the same length. Real talk varies,
 * and it varies for reasons, so the length comes from the conversation, not
 * chance: what the message asks for ("ok" gets a few words, small talk a line
 * or two, a real how/why/help question the room it needs), how this person
 * writes (someone who writes long messages gets fuller replies, someone terse
 * gets terse ones), and the animal's own last replies (two of one length in a
 * row and the next one changes). There is no word limit: the tier is a
 * starting size the animal judges from, and a request for a long answer
 * always gets one (owner, 2026-10-28).
 *
 * Port of the apps' `supabase/functions/_shared/animal-reply-length.ts`,
 * verbatim. Pure.
 */

export type AskReplyLength = "few_words" | "short" | "medium" | "full";

const TIERS: AskReplyLength[] = ["few_words", "short", "medium", "full"];

// One or more of these and nothing else: "ok", "ok thanks!", "haha nice".
const ACKNOWLEDGEMENT =
    /^(?:(?:ok(?:ay)?|k|kk|thanks?(?: you)?|ty|thx|cool|nice|lol|haha+|hah|ha|yes|yeah|yep|yup|no|nope|sure|great|awesome|wow|hmm+|bye|good ?night|gn|night|morning|ah|oh|right|fair|true|same|mhm|ikr)[\s,!.?❤️🙂😊😂👍]*)+$/iu;
const ASKS_FOR_DEPTH =
    /\b(how|why|explain|tell me (about|more)|walk me through|what (do|should|would) (i|you)|should i|help me|advice|decide|difference|compare|story)\b/i;

function words(text: string): number {
    return text.trim().split(/\s+/).filter(Boolean).length;
}

// The tier a reply of this many words landed in.
function tierOfWords(count: number): AskReplyLength {
    if (count <= 8) return "few_words";
    if (count <= 30) return "short";
    if (count <= 60) return "medium";
    return "full";
}

export function askReplyLengthFor(params: {
    message: string;
    mode: string | null | undefined;
    // The conversation so far, oldest first (the app's recent turns).
    history?: Array<{role: string; content: string}>;
}): AskReplyLength {
    const message = params.message.trim();
    // Short messages only: the repeated pattern must never meet a long input.
    if (message.length <= 40 && ACKNOWLEDGEMENT.test(message)) return "few_words";
    const length = words(message);
    const depth = ASKS_FOR_DEPTH.test(message);
    let at = TIERS.indexOf(depth || length >= 30 || params.mode === "guidance" ? "full" : length <= 8 ? "short" : "medium");

    // How this person writes: their last few messages.
    const history = params.history ?? [];
    const theirs = history.filter((turn) => turn.role === "user").slice(-3).map((turn) => words(turn.content));
    if (theirs.length >= 2) {
        const average = theirs.reduce((sum, n) => sum + n, 0) / theirs.length;
        if (average >= 35 && at < 3) at += 1;
        if (average <= 6 && at === 2 && !depth) at -= 1;
    }

    // The animal's own rhythm: after two replies of one length, a different one.
    const mine = history.filter((turn) => turn.role === "assistant").slice(-2).map((turn) => tierOfWords(words(turn.content)));
    if (mine.length === 2 && mine[0] === mine[1] && mine[0] === TIERS[at] && at > 1) at -= 1;

    return TIERS[at];
}

// Whether there is room in this reply for a story of its own.
export function askRoomForAStory(tier: AskReplyLength): boolean {
    return tier === "medium" || tier === "full";
}

export function askReplyLengthLine(tier: AskReplyLength): string {
    const room = {
        few_words: "about a few words, or one short line",
        short: "about a line or two",
        medium: "about a few sentences",
        full: "what it takes to answer it well; for a plain question, a few sentences"
    }[tier];
    const story = tier === "few_words" || tier === "short" ? "" : " A story of your own, if you tell one, may run a little longer.";
    // The animal judges the size of what was said; the tier only caps it.
    // (A list of greetings to answer briefly missed everything not on it:
    // owner, 2026-10-28, no hardcoded replies or phrase lists.)
    return `this_reply — length: ${room}. Match the size of what they said, the way a person would: a hello or a ` +
        `passing remark gets a short line back (no introduction, no facts about you, no story); a plain question gets ` +
        `the answer, not everything you know about it; if they ask for a full, detailed or long answer, or to go ` +
        `deeper, give them a thorough one however long it takes. Never pad to fill space.${story}`;
}
