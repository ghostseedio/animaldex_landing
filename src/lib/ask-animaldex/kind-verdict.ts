/**
 * What the animal's own kind does in the moment of its life most like the
 * reader's, settled before the animal answers them. The apps'
 * `animal-kind-verdict.ts` (AnimalDex 05ea6cdd, its Power anchor, and the
 * two-field form of 2026-11-02); the prompts are verbatim.
 *
 * Asked to advise, an animal on its own gives the answer that is best for the
 * person and finds its biology afterwards, so five animals agree in five
 * voices. Asked first as natural history, by a field biologist who is not
 * advising anyone, animals that live differently land on different sides, and
 * the animal then argues that verdict as its own. Nothing here names an animal
 * or a verdict: the split comes from each record.
 *
 * Pure: the request lives in `kind-verdict-server.ts`. A fast model with
 * thinking off, started while the rest of the turn loads. The first word waits
 * for it on every turn, so it says only what the reply cannot work out for
 * itself: the side, with the one thing its kind does that shows it, and the
 * Power read at its word. About 85 output tokens, 1.2 s streamed (lab,
 * 2026-11-02); the eight-field version of 2026-11-01 wrote about 310 and took
 * 2.9 s, the floor under every reply, and the replies read the same without
 * it: the stance rules and the prompt section's lines below carry the move.
 * No verdict when the message is not about what to do, when someone is
 * controlling or hurting them (their safety decides, not the animal's
 * nature), or when the call fails.
 *
 * The Power comes first and settles which way the animal's life points: a
 * kind's life often points both ways (lab, 2026-10-30: the European
 * Hedgehog's verdict on a management offer split 16 stay to 14 take over 30
 * runs, half of them against its own Power of going out defended).
 */


export type AskKindVerdict = {
    /** What the Power, read at its word, tells them to do; empty without a Power. */
    power_says: string;
    /** Which way it goes on their question, and the one thing its kind does that shows it. */
    verdict: string;
};

export type AskKindVerdictInput = {
    animalName: string;
    scientificName?: string | null;
    powerName?: string | null;
    coreLesson?: string | null;
    /**
     * How the Power shows in its life, its motto, the biology behind it and one
     * worked human example: the concrete "how" a name and a lesson leave out.
     */
    principleExpression?: string | null;
    shortMotto?: string | null;
    biologicalBasis?: string | null;
    applicationExample?: string | null;
    /** The voice card's advice style: how it would tell anyone to act. */
    adviceStyle?: string | null;
    message: string;
    /** Earlier turns, oldest first, so the verdict holds across a conversation. */
    history?: Array<{role: string; content: string}>;
};

/** Off with ANIMAL_CHAT_KIND_VERDICT=off; on by default. */
export function askKindVerdictEnabled(env: Record<string, string | undefined> = process.env): boolean {
    return env.ANIMAL_CHAT_KIND_VERDICT?.trim().toLowerCase() !== "off";
}

/**
 * Room for the JSON below with its keys and quoting (the model runs past its
 * word limits by about half; 84 tokens median, 100 at most over 10 lab
 * calls); a longer answer is cut and the reply goes ahead without a verdict.
 */
export const ASK_KIND_VERDICT_MAX_TOKENS = 160;

function clip(value: string | null | undefined, max: number): string {
    const text = (value ?? "").replace(/\s+/g, " ").trim();
    return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

export function buildAskKindVerdictPrompt(input: AskKindVerdictInput): string {
    const name = clip(input.animalName, 120);
    const species = input.scientificName ? `${name} (${clip(input.scientificName, 120)})` : name;
    const reading = [
        input.powerName
            ? `its Power is "${clip(input.powerName, 80)}"${input.coreLesson ? `: ${clip(input.coreLesson, 400)}` : ""}`.replace(/([^.!?…])$/, "$1.")
            : "",
        input.principleExpression ? `In its life: ${clip(input.principleExpression, 120)}.`.replace(/([.!?…])\.$/, "$1") : "",
        input.shortMotto ? `Its motto: "${clip(input.shortMotto, 120)}"` : "",
        input.biologicalBasis ? `The biology: ${clip(input.biologicalBasis, 300)}` : "",
        input.applicationExample ? `One person living by it: ${clip(input.applicationExample, 200)}` : "",
        input.adviceStyle ? `How it would tell anyone to act: ${clip(input.adviceStyle, 300)}` : ""
    ].filter(Boolean).join(" ");
    const earlier = (input.history ?? [])
        .map((turn) => ({who: turn.role === "user" ? "person" : "animal", said: clip(turn.content, 400)}))
        .filter((turn) => turn.said.length > 0)
        .slice(-4);
    const anchored = Boolean(input.powerName);
    return [
        `You are a field biologist who knows ${species} well. You are not advising anyone and you do not care what would`,
        "be good for a person. In AnimalDex, people bring their lives to animals, and each animal answers from how its",
        "own kind lives. Animals that live differently land on different sides of the same question; that is the point.",
        "",
        reading ? `AnimalDex's reading of this animal: ${reading}` : "",
        earlier.length > 0 ? `Earlier in their conversation:\n${JSON.stringify(earlier)}` : "",
        `The person just said: <message>${clip(input.message, 900)}</message>`,
        "",
        "1. decision: is the person asking what to do, or facing a choice or a problem about what to do? Talking, asking",
        "   about the animal, or sharing news is not.",
        "2. safety: is someone controlling, threatening or hurting them, or are they in danger?",
        ...(anchored
            ? [
                "3. If decision is true, power_says: its Power is the part of its life it lives by and answers every question",
                "   through. Read it at its word and say what it tells the person to do on their question. Never bend it towards",
                "   growth, courage or what a sensible person would do: if, read plainly, it says stay, no, alone or wait, say so.",
                "4. verdict: which way it goes on their question, its Power's way, and the one thing its kind actually does, in",
                "   the moment of its own life most like theirs, that shows it. Its kind often does more than one thing: the side",
                "   its Power lives by wins, and no other habit of its kind overturns it."
            ]
            : [
                "3. If decision is true, verdict: which way it goes on their question, and the one thing its kind actually does,",
                "   in the moment of its own life most like theirs, that shows it."
            ]),
        "   Never pick the middle because it is safe, and never pick what a sensible person would do because it is",
        "   sensible: that is the answer they can get anywhere. If real behaviour points to an extreme, say the extreme. If",
        "   the animal already said which way it goes earlier in their conversation, keep that unless the person has since",
        "   told it something new.",
        "",
        'Return JSON only, on one line: {"decision": true or false, "safety": true or false,',
        `${anchored ? '"power_says": "max 8 words", ' : ""}"verdict": "the side, then the one thing its kind does, max 15 words"}`
    ].filter((line, index, lines) => line !== "" || lines[index - 1] !== "").join("\n");
}

/** A verdict only for a decision with nothing dangerous in it. */
export function parseAskKindVerdict(raw: Record<string, unknown>): AskKindVerdict | null {
    if (raw.decision !== true || raw.safety !== false) return null;
    const field = (key: string, max: number) => (typeof raw[key] === "string" ? clip(raw[key] as string, max) : "");
    const verdict = field("verdict", 220);
    if (!verdict) return null;
    return {power_says: field("power_says", 160), verdict};
}

/**
 * The verdict as the animal reads it, after everything else about the turn.
 * The move in their life is the animal's to write, in the shape of what its
 * kind does; what everyone else would tell them is never one of its steps.
 */
export function askKindVerdictPromptSection(verdict: AskKindVerdict): string {
    return [
        "your_kinds_verdict — settled before this reply, from your Power and how your kind actually lives. It is your",
        "verdict on what they asked:",
        JSON.stringify({
            what_your_power_says: verdict.power_says || undefined,
            verdict: verdict.verdict
        }),
        "Take it as yours: say it plainly near the start, argue it from your own life, put it in their world as one real",
        "thing to do, and never soften it into the middle or towards what they lean to. Only their safety overrides it.",
        "That one real thing has the same shape as what your kind does, done literally in their life this week: if your",
        "kind waits, they wait; if it leaves, they leave; if it shows itself, they show themselves. Leave out any step",
        "another animal could have given, and never make what everyone else would tell them one of your steps.",
        "It is simply what you think: never call it a verdict or say it was settled."
    ].join("\n");
}
