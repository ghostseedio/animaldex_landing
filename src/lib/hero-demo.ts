/**
 * The home hero's live demo (variant B of the hero test, lib/hero-variant):
 * a split card with "The usual answer", a grey example we wrote, beside
 * "Your lion's take", one live reply from the guest Talk API
 * (/api/ask/stream) when an idea chip is tapped. "Keep talking" carries the
 * exchange into the lion's own chat at /talk/african-lion, the same thread.
 *
 * The chips are mostly ideas and one problem (SPEC section 1: ideas, plans,
 * decisions or problems). What each chip sends is our words, never the
 * visitor's, so nothing they wrote reaches a model before they choose to
 * type in the chat (where the AI consent comes first).
 *
 * Pure, so the request, the stream reading and the shown text are tested.
 */

/** The animal the demo talks to: the catalog's lion (its Talk page calls it "Lion"), with its Power. */
export const HERO_DEMO_ANIMAL = {slug: "african-lion", name: "Lion", power: "Pride Command"} as const;

/** Where "Keep talking" goes, and the path the demo's turn is asked from, so it is that chat's thread. */
export const HERO_DEMO_TALK_PATH = `/talk/${HERO_DEMO_ANIMAL.slug}`;

export type HeroDemoChipKind = "idea" | "problem";

/** The chips, in order; their words come from the locale's `home.demo.chips.<id>`. */
export const HERO_DEMO_CHIPS: ReadonlyArray<{id: string; kind: HeroDemoChipKind}> = [
    {id: "podcast", kind: "idea"},
    {id: "abroad", kind: "idea"},
    {id: "sugar", kind: "idea"},
    {id: "deadlines", kind: "problem"}
];

export type HeroDemoChip = {
    id: string;
    kind: HeroDemoChipKind;
    /** On the chip. */
    label: string;
    /** What is sent, as the visitor's first message in the thread. */
    message: string;
    /** The usual answer's three lines: our example, grey, labelled as one. */
    usual: string[];
};

/** The streamed request for one chip: the Talk page's own request shape, for the lion's thread. */
export function heroDemoRequestBody(input: {message: string; locale: string; requestId: string; utcOffsetMinutes: number | null}) {
    return {
        question: input.message,
        locale: input.locale,
        history: [],
        requestId: input.requestId,
        utc_offset_minutes: input.utcOffsetMinutes,
        subject: {
            scope: "species" as const,
            slug: HERO_DEMO_ANIMAL.slug,
            name: HERO_DEMO_ANIMAL.name,
            captureId: null,
            hasReaderPhoto: false,
            title: HERO_DEMO_ANIMAL.name,
            summary: null,
            path: HERO_DEMO_TALK_PATH,
            trialContext: null,
            trialKey: null
        }
    };
}

/** The follow-up sentinel the stream holds back (lib/ask-animaldex/prompt's ASK_FOLLOW_UP_SENTINEL). */
export const HERO_DEMO_FOLLOW_UP_SENTINEL = "§§FOLLOW_UPS§§";

/** Splits a server-sent-events buffer into the events it holds and the unfinished rest. */
export function splitStreamFrames(buffer: string): {events: Array<Record<string, unknown>>; rest: string} {
    const frames = buffer.replace(/\r\n/g, "\n").split("\n\n");
    const rest = frames.pop() ?? "";
    const events: Array<Record<string, unknown>> = [];
    for (const frame of frames) {
        const line = frame.split("\n").find((candidate) => candidate.startsWith("data:"));
        const payload = line?.slice(5).trim();
        if (!payload) continue;
        try {
            const event = JSON.parse(payload) as unknown;
            if (event && typeof event === "object" && !Array.isArray(event)) events.push(event as Record<string, unknown>);
        } catch {
            // A frame that cannot be read is skipped, as the chat skips it.
        }
    }
    return {events, rest};
}

/**
 * The reply as the card shows it, from the raw stream so far: up to the
 * follow-ups (and never a half-arrived sentinel), without the chat's drawn
 * mediums (fenced blocks), and as plain words rather than markdown.
 */
export function heroDemoVisibleText(raw: string): string {
    let text = raw;
    const sentinel = text.indexOf(HERO_DEMO_FOLLOW_UP_SENTINEL);
    if (sentinel >= 0) {
        text = text.slice(0, sentinel);
    } else {
        for (let held = Math.min(HERO_DEMO_FOLLOW_UP_SENTINEL.length - 1, text.length); held > 0; held -= 1) {
            if (HERO_DEMO_FOLLOW_UP_SENTINEL.startsWith(text.slice(text.length - held))) {
                text = text.slice(0, text.length - held);
                break;
            }
        }
    }
    // A drawn medium, whole or still arriving.
    text = text.replace(/```[\s\S]*?```/g, "").replace(/```[\s\S]*$/, "");
    return text
        .split("\n")
        .map((line) => line
            .replace(/^\s{0,3}#{1,6}\s+/, "")
            .replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "")
            .replace(/\*\*(.+?)\*\*/g, "$1")
            .replace(/__(.+?)__/g, "$1")
            .replace(/(^|[\s(])\*(\S(?:.*?\S)?)\*(?=[\s).,!?:;]|$)/g, "$1$2")
            .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
            .trimEnd())
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

/**
 * The reply as it goes into the lion's thread for "Keep talking": its own
 * markdown and mediums, which the chat draws, without the follow-ups.
 */
export function heroDemoThreadText(raw: string): string {
    const sentinel = raw.indexOf(HERO_DEMO_FOLLOW_UP_SENTINEL);
    return (sentinel >= 0 ? raw.slice(0, sentinel) : raw).trim();
}

/** The follow-up offers the `done` event carries, as the chat keeps them. */
export function heroDemoFollowUps(raw: unknown): string[] {
    if (!Array.isArray(raw)) return [];
    return raw.filter((prompt): prompt is string => typeof prompt === "string" && prompt.trim().length > 0).map((prompt) => prompt.trim()).slice(0, 3);
}

/** What the card says went wrong: the day's free messages, or the lion could not answer. */
export type HeroDemoFailure = "limit" | "unavailable";

export function heroDemoFailureFor(status: number): HeroDemoFailure {
    return status === 429 ? "limit" : "unavailable";
}
