/**
 * What the animal's own kind does in the moment of its life most like the
 * reader's, settled before the animal answers them. The apps'
 * `animal-kind-verdict.ts` (AnimalDex 05ea6cdd and its Power anchor); the
 * prompts are verbatim.
 *
 * Asked to advise, an animal on its own gives the answer that is best for the
 * person and finds its biology afterwards, so five animals agree in five
 * voices. Asked first as natural history, by a field biologist who is not
 * advising anyone, animals that live differently land on different sides, and
 * the animal then argues that verdict as its own. Nothing here names an animal
 * or a verdict: the split comes from each record.
 *
 * Pure: the request lives in `kind-verdict-server.ts`. A fast model with
 * thinking off (about 2 s), started while the rest of the turn loads. No verdict when the message is not about what to do, when
 * someone is controlling or hurting them (their safety decides, not the
 * animal's nature), or when the call fails.
 *
 * The Power comes first and settles which way the animal's life points: a
 * kind's life often points both ways (lab, 2026-10-30: the European
 * Hedgehog's verdict on a management offer split 16 stay to 14 take over 30
 * runs, half of them against its own Power of going out defended).
 *
 * The move is the Power's own shape, done in their life (lab, 2026-11-01: on
 * open problems the verdicts split but the replies turned each one into the
 * usual best practice, so 73% of 120 replies were ChatGPT's plan in costume).
 * The sensible answer is named first, as the one to depart from; the part of
 * the problem the Power goes to comes next; the move last.
 */


export type AskKindVerdict = {
    /** What the Power, read at its word, tells them to do; empty without a Power. */
    power_says: string;
    nearest_situation: string;
    what_it_does: string;
    verdict: string;
    /** How the animal's life reads their situation; their own diagnosis is a lean. */
    their_problem: string;
    /** The human version of what its kind does, the same shape, in their life. */
    their_move: string;
    /** What a sensible adviser would tell them: the move this animal's isn't. */
    usual_advice: string;
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
        "3. If decision is true, usual_advice: what a careful, sensible human adviser would tell them. That is the answer",
        "   they can get anywhere, and the one this animal must not simply repeat.",
        ...(anchored
            ? [
                "4. power_says: its Power is the part of its life it lives by and answers every question through. Read it at its",
                "   word and say what it tells the person to do on their question. Never bend it towards growth, courage or what",
                "   a sensible person would do: if, read plainly, it says stay, no, alone or wait, say so.",
                "5. their_problem: a problem has several parts (what they made, who sees it, money, time, who is with them, what",
                "   they assume, how they feel). Which part does this Power go to first, the part its life is built for? That is",
                "   what is really wrong, as this animal sees it, even if the person named another: what they think is wrong is",
                "   a lean like any other.",
                "6. Then find the moment in this animal's own life most like theirs, say what this animal actually does then,",
                "   from real behaviour of its kind, and which way that points on their question. Its kind often does more than",
                "   one thing: the side its Power lives by wins, and no other habit of its kind overturns it."
            ]
            : [
                "4. their_problem: a problem has several parts (what they made, who sees it, money, time, who is with them, what",
                "   they assume, how they feel). Which part does this animal's life go to first? That is what is really wrong,",
                "   as this animal sees it, even if the person named another: what they think is wrong is a lean like any other.",
                "5. Then find the moment in this animal's own life most like theirs, say what this animal actually does then,",
                "   from real behaviour of its kind, and which way that points on their question."
            ]),
        "   Never pick the middle because it is safe, and never pick what a sensible person would do because it is",
        "   sensible. If real behaviour points to an extreme, say the extreme. If the animal already said which way it goes",
        "   earlier in their conversation, keep that unless the person has since told it something new.",
        `${anchored ? 7 : 6}. their_move: ${anchored ? "the Power's own way, done literally" : "what this animal does, done literally"} in their life, on that part, in the same`,
        "   shape. If it waits, they wait; if it borrows, they borrow; if it copies, they copy; if it leaves, they leave; if",
        "   it shows itself, they show themselves. Say what they do this week, with whom or where. It is never usual_advice",
        `   or a step of it; if it comes out that way, ${anchored ? "the Power was bent towards good sense: read it at its word again" : "look again at what this animal does"}.`,
        "   The person asks many animals the same thing. Their move is worth hearing only if an animal that lives",
        `   differently could not have given it: if one could, make it more ${anchored ? "literally this Power's" : "literally this animal's"}.`,
        "",
        'Return JSON only: {"decision": true or false, "safety": true or false, "usual_advice": "max 15 words",',
        `${anchored ? '"power_says": "max 20 words", ' : ""}"their_problem": "max 15 words", "nearest_situation": "max 20 words",`,
        `"what_it_does": "max 25 words", "verdict": "which way it goes on their question${anchored ? ", its Power's way" : ""}, max 12 words",`,
        '"their_move": "max 30 words"}'
    ].filter((line, index, lines) => line !== "" || lines[index - 1] !== "").join("\n");
}

/** A verdict only for a decision with nothing dangerous in it. */
export function parseAskKindVerdict(raw: Record<string, unknown>): AskKindVerdict | null {
    if (raw.decision !== true || raw.safety !== false) return null;
    const field = (key: string, max: number) => (typeof raw[key] === "string" ? clip(raw[key] as string, max) : "");
    const verdict = field("verdict", 160);
    const whatItDoes = field("what_it_does", 260);
    if (!verdict || !whatItDoes) return null;
    return {
        power_says: field("power_says", 220),
        nearest_situation: field("nearest_situation", 220),
        what_it_does: whatItDoes,
        verdict,
        their_problem: field("their_problem", 180),
        their_move: field("their_move", 320),
        usual_advice: field("usual_advice", 180)
    };
}

/** The verdict as the animal reads it, after everything else about the turn. */
export function askKindVerdictPromptSection(verdict: AskKindVerdict): string {
    return [
        "your_kinds_verdict — settled before this reply, from your Power and how your kind actually lives. It is your",
        "verdict on what they asked:",
        JSON.stringify({
            what_your_power_says: verdict.power_says || undefined,
            the_moment_in_your_life_most_like_theirs: verdict.nearest_situation,
            what_your_kind_does: verdict.what_it_does,
            verdict: verdict.verdict,
            the_problem_as_you_see_it: verdict.their_problem || undefined,
            your_move_in_their_life: verdict.their_move || undefined,
            what_everyone_else_will_tell_them: verdict.usual_advice || undefined
        }),
        "Take it as yours: say it plainly near the start, argue it from your own life, put it in their world as one real",
        "thing to do, and never soften it into the middle or towards what they lean to. Only their safety overrides it.",
        ...(verdict.their_move
            ? [
                "Your move in their life has the same shape as what your kind does, and it leads: your first two sentences say",
                "what they do, in plain words, not only which way you go. Every step you give is part of that move; leave out any",
                "step another animal could have given. What everyone else will tell them they can get anywhere: it is never your",
                "move or one of your steps, though you may name it once to say why you would not. Before you finish, take your",
                "pictures out and read what is left: if it is what everyone else will tell them, rewrite it as your move."
            ]
            : []),
        "It is simply what you think: never call it a verdict or say it was settled."
    ].join("\n");
}
