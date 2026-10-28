/**
 * An animal's own stories (AnimalDex migration 20261025120000).
 *
 * Now and then, when it fits, an animal tells a short, believable moment from
 * its own life in the wild that shows its advice instead of explaining it —
 * and remembers it happened. When is the animal's own judgement, from what
 * should decide it: its character (how readily its kind tells stories,
 * `nature.ts` `tells`), how well it knows them (relationship stage), how many
 * it has told them and how recently, and what they have said they like
 * (memory). No dice: the only hard rule is no story in a hello, a Trial
 * question or a crisis.
 *
 * The animal itself summarises a story it told, in one line after its
 * follow-ups ("STORY: …"). The route takes that line out (the reader never
 * sees it) and keeps it with the owner's animal of that species, so the
 * animal's life stays one life: the stories it told are given back to it as
 * your_own_life.
 *
 * Port of the apps' `supabase/functions/_shared/animal-stories.ts`, verbatim.
 * Pure: no `server-only`.
 */

import {ASK_FOLLOW_UP_SENTINEL} from "@/lib/ask-animaldex/prompt";

export type AskOwnStory = {story: string; told_at?: string | null};

export const OWN_STORY_PREFIX = "STORY:";
export const OWN_STORIES_IN_PROMPT = 8;

// How the animal tells a story, when one is invited. Stable: system prompt.
export const ANIMAL_STORY_RULES = [
    "Your own stories — your_storytelling says how readily you tell them and how many you have told:",
    "- A story is a gift, not a habit: most replies have none. Tell one when it would show your point better than saying",
    "  it, when they ask about your life, or when they ask for one. Never two replies running.",
    "- Stories are personal. With someone you have only just met (relationship 'met' or none) you keep them rarer; as",
    "  you get to know them you share more. If they have said they like your stories, tell more; if they want you to get",
    "  to the point, don't.",
    "- Tell one short story, three to five sentences, of something that happened to you in the wild, that shows your",
    "  advice instead of explaining it. A specific moment: a season, a place like the ones you live in, a hunt, a storm,",
    "  a rival, a young one, something you got wrong.",
    "- Believable for your kind: built from your record — where you live, what you eat, what hunts you, how you behave,",
    "  your senses. Nothing magical, no talking with people, no human things unless your kind lives alongside people.",
    "- In the past tense, in your own voice. Let the story carry the point; at most one short line ties it back to them.",
    "  Never call it a metaphor or a lesson.",
    "- It happened to you, so it never contradicts your_own_life. You can refer back to a story you told before instead",
    "  of telling a new one.",
    "- If no story truly fits, don't force one."
];

// The line after the follow-ups that lets the server remember the story.
export const ANIMAL_STORY_OUTPUT_LINE =
    `4. Only if this reply told a story of your own life: one last line, after the follow-ups, in the form "${OWN_STORY_PREFIX} <what happened, in one sentence, third person, past tense>". It is never shown.`;

// Takes the story line out of a streamed reply (after the follow-ups
// sentinel only), so it is neither shown nor turned into a chip.
export function extractAskOwnStory(raw: string): {raw: string; story: string | null} {
    const at = raw.indexOf(ASK_FOLLOW_UP_SENTINEL);
    if (at < 0) return {raw, story: null};
    const head = raw.slice(0, at + ASK_FOLLOW_UP_SENTINEL.length);
    let story: string | null = null;
    const lines = raw.slice(at + ASK_FOLLOW_UP_SENTINEL.length).split("\n").filter((line) => {
        const trimmed = line.replace(/^[-*\s]+/, "").trim();
        if (trimmed.toUpperCase().startsWith(OWN_STORY_PREFIX)) {
            story ??= cleanAskOwnStory(trimmed.slice(OWN_STORY_PREFIX.length));
            return false;
        }
        return true;
    });
    return {raw: `${head}${lines.join("\n")}`, story};
}

export function cleanAskOwnStory(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const story = value.replace(/\s+/g, " ").trim().replace(/^["“]|["”]$/g, "").trim().slice(0, 300);
    return story.length >= 20 ? story : null;
}

export function parseAskOwnStories(raw: unknown): AskOwnStory[] {
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((item) => {
        const row = item && typeof item === "object" ? item as Record<string, unknown> : null;
        const story = cleanAskOwnStory(row?.story);
        return story ? [{story, told_at: typeof row?.told_at === "string" ? row.told_at : null}] : [];
    });
}

// The stories it has told, given back to it.
export function askOwnLifePromptSection(stories: AskOwnStory[]): string {
    if (stories.length === 0) return "";
    const recent = stories.slice(-OWN_STORIES_IN_PROMPT).map((entry) => entry.story);
    return [
        "your_own_life — things that happened to you, which you have told before (oldest first):",
        JSON.stringify(recent),
        "They happened. Stay consistent with them; refer back when it fits; never retell one word for word."
    ].join("\n");
}

const TENDENCY_LINES = {
    often: "you love telling stories from your life — they are how you explain things",
    sometimes: "you tell a story from your life now and then, when one fits",
    rarely: "you rarely tell stories; when you do, it matters"} as const;

function ago(iso: string | null | undefined, now: Date): string | null {
    const at = iso ? Date.parse(iso) : NaN;
    if (!Number.isFinite(at)) return null;
    const minutes = Math.max(0, Math.round((now.getTime() - at) / 60_000));
    if (minutes < 2) return "just now";
    if (minutes < 60) return `${minutes} minutes ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 36) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    const days = Math.round(hours / 24);
    return `${days} days ago`;
}

// What the animal needs to decide for itself whether this reply carries a
// story: how readily its kind tells them, and how many it has told this
// person and when. `blocked` (a hello, a Trial question, a crisis): none.
export function askStorytellingLine(params: {
    tells: "often" | "sometimes" | "rarely";
    stories: AskOwnStory[];
    now?: Date;
    blocked?: boolean;
}): string {
    if (params.blocked) return "your_storytelling — no story in this reply.";
    const now = params.now ?? new Date();
    const count = params.stories.length;
    const last = ago(params.stories.at(-1)?.told_at, now);
    const told = count === 0
        ? "you have not told any stories of your life yet"
        : `you have told ${count} so far${last ? `, the last ${last}` : ""}`;
    return `your_storytelling — ${TENDENCY_LINES[params.tells]}; ${told}.`;
}
