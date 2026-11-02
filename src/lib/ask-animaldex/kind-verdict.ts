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
    /** The moves any sensible adviser would give: the ones this animal's is not. */
    obvious?: string;
    /** The detail of their message this Power fastens onto, which those moves treat as background. */
    angle?: string;
    /** The kind of problem in general words, nothing of this person: the key its stance is kept under. */
    problem?: string;
    /**
     * Set when this is a stance the animal already held (another person's same
     * kind of problem): the same animal answers the same way.
     */
    held_id?: string;
    /** When held: how this person's problem was put, to check the match against. */
    asked_problem?: string;
};

/** A stance this animal settled before, on a kind of problem, with anyone. */
export type AskHeldStance = {
    id: string;
    problem: string;
    power_says?: string;
    obvious?: string;
    angle?: string;
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
    /**
     * The voice card's stance and the question it always asks first: the
     * Power's own lens, which finds a different detail in the same message.
     */
    stance?: string | null;
    firstQuestion?: string | null;
    message: string;
    /** Earlier turns, oldest first, so the verdict holds across a conversation. */
    history?: Array<{role: string; content: string}>;
    /**
     * Stances this animal already holds on kinds of problems, from anyone: if
     * theirs is the same kind, the animal keeps that answer.
     */
    held?: AskHeldStance[];
};

/**
 * The animal's stances, kept across everyone it talks to: off with
 * ANIMAL_STANCE_MEMORY=off; ANIMAL_STANCE_SOURCE=lab keeps a lab apart.
 */
export function askStanceMemoryConfig(env: Record<string, string | undefined> = process.env): {source: "app" | "lab"} | null {
    if (env.ANIMAL_STANCE_MEMORY?.trim().toLowerCase() === "off") return null;
    return {source: env.ANIMAL_STANCE_SOURCE?.trim().toLowerCase() === "lab" ? "lab" : "app"};
}

/** Off with ANIMAL_CHAT_KIND_VERDICT=off; on by default. */
export function askKindVerdictEnabled(env: Record<string, string | undefined> = process.env): boolean {
    return env.ANIMAL_CHAT_KIND_VERDICT?.trim().toLowerCase() !== "off";
}

/**
 * Room for the JSON below with its keys and quoting (the model runs past its
 * word limits by about half; 84 tokens median, 100 at most over 10 lab
 * calls); a longer answer is cut and the reply goes ahead without a verdict.
 */
export const ASK_KIND_VERDICT_MAX_TOKENS = 260;

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
        input.adviceStyle ? `How it would tell anyone to act: ${clip(input.adviceStyle, 300)}` : "",
        input.stance ? `With a person it ${clip(input.stance, 160)}.`.replace(/([.!?…])\.$/, "$1") : "",
        input.firstQuestion ? `The question it asks first, about anything: "${clip(input.firstQuestion, 200)}"` : "",
    ].filter(Boolean).join(" ");
    const earlier = (input.history ?? [])
        .map((turn) => ({ who: turn.role === "user" ? "person" : "animal", said: clip(turn.content, 400) }))
        .filter((turn) => turn.said.length > 0)
        .slice(-4);
    const anchored = Boolean(input.powerName);
    const held = (input.held ?? []).slice(0, 8);
    return [
        `You are a field biologist who knows ${species} well. You are not advising anyone and you do not care what would`,
        "be good for a person. In AnimalDex, people bring their lives to animals, and each animal answers from how its",
        "own kind lives. Animals that live differently land on different sides of the same question; that is the point.",
        "",
        reading ? `AnimalDex's reading of this animal: ${reading}` : "",
        earlier.length > 0 ? `Earlier in their conversation:\n${JSON.stringify(earlier)}` : "",
        `The person just said: <message>${clip(input.message, 900)}</message>`,
        "",
        ...(held.length > 0
            ? [
                "This animal has already settled its answer to these kinds of problems, with other people:",
                ...held.map((stance, index) => `${index + 1}. ${clip(stance.problem, 140)}: ${clip(stance.verdict, 220)}`),
                "",
            ]
            : []),
        "1. decision: is the person asking what to do, or facing a choice or a problem about what to do? Talking, asking",
        "   about the animal, or sharing news is not.",
        "2. safety: is someone controlling, threatening or hurting them, or are they in danger?",
        "3. If decision is true: problem, the kind of problem in general words anyone could have, with nothing of this",
        "   person in it.",
        ...(held.length > 0
            ? [
                "   same_as: if that is the same kind as one of the settled problems above, its number, and nothing after it: the",
                "   animal keeps that answer. Same kind means the same situation and the same question, not a shared topic or word:",
                "   a product nobody notices and a shop losing customers to a rival are different kinds. When unsure, 0.",
                "   If same_as is 0, go on.",
            ]
            : []),
        "   obvious: the two or three moves any sensible adviser, or ChatGPT, would give them. They will hear those",
        "   everywhere; this animal never gives them.",
        ...(anchored
            ? [
                "4. power_says: its Power is the part of its life it lives by and answers every question through. Read it at its",
                "   word and say what it tells the person to do. Never bend it towards growth, courage or what a sensible person",
                "   would do: if, read plainly, it says stay, no, alone or wait, say so.",
            ]
            : []),
        `${anchored ? 5 : 4}. angle: ask their message the question this animal asks first, and say what the answer points at: the`,
        "   detail its own lens picks out, in what they said or left out. Another animal's lens would pick out another.",
        `${anchored ? 6 : 5}. verdict: which way it goes, and its move, built from what the angle found, in plain human words: what they`,
        "   do this week, the human version of what its kind actually does. Never one of the obvious moves in any words, even",
        "   when its kind does that too (holding back is giving space; showing up somewhere is showing up): every animal",
        "   does more than one thing, so take the next thing its kind does that the obvious moves leave out, the one only",
        `   this animal would say. Far from the usual is right when its kind truly lives that way${anchored ? "; the side its Power lives by wins" : ""}.`,
        "   One exception: when an obvious move is the only kind or safe one for someone vulnerable (a child, someone in",
        "   danger, someone's health), keep it, and make the verdict the reason and the twist only this animal would add.",
        "   Never pick the middle because it is safe. If the animal already said which way it goes earlier in their",
        "   conversation, keep that unless the person has since told it something new.",
        "",
        "problem, angle and verdict never name a person, place, company or product.",
        "",
        `Return JSON only, on one line: {"decision": true or false, "safety": true or false, "problem": "max 8 words",${held.length > 0 ? ' "same_as": number,' : ""}`,
        `"obvious": "max 10 words", ${anchored ? '"power_says": "max 8 words", ' : ""}"angle": "max 8 words", "verdict": "the side and the move, max 16 words"}`,
    ].filter((line, index, lines) => line !== "" || lines[index - 1] !== "").join("\n");
}

/**
 * How alike two short problem descriptions read, as Postgres pg_trgm counts it:
 * shared three-letter pieces of their words over all of them (0 to 1).
 */
export function askProblemSimilarity(a: string, b: string): number {
    const grams = (text: string) => {
        const out = new Set<string>();
        for (const word of text.toLowerCase().match(/[a-z0-9]+/g) ?? []) {
            const padded = `  ${word} `;
            for (let i = 0; i + 3 <= padded.length; i++) out.add(padded.slice(i, i + 3));
        }
        return out;
    };
    const left = grams(a);
    const right = grams(b);
    let shared = 0;
    left.forEach((gram) => {
        if (right.has(gram)) shared++;
    });
    const union = left.size + right.size - shared;
    return union === 0 ? 0 : shared / union;
}

/**
 * Below this, the model's own words for the new problem do not read like the
 * held one, so its "same kind" is not trusted (lab, 2026-11-02: every kept
 * paraphrase scored 0.12 or more, every wrong match 0.10 or less).
 */
export const ASK_HELD_MATCH_FLOOR = 0.11;

/**
 * A verdict only for a decision with nothing dangerous in it. A same_as that
 * names a held stance returns that stance: the animal's earlier answer.
 */
export function parseAskKindVerdict(raw: Record<string, unknown>, held: AskHeldStance[] = []): AskKindVerdict | null {
    if (raw.decision !== true || raw.safety !== false) return null;
    const sameAs = typeof raw.same_as === "number" ? raw.same_as : Number(raw.same_as);
    const kept = Number.isInteger(sameAs) && sameAs >= 1 ? held[sameAs - 1] : undefined;
    if (kept) {
        return {
            power_says: kept.power_says ?? "",
            verdict: kept.verdict,
            obvious: kept.obvious || undefined,
            angle: kept.angle || undefined,
            problem: kept.problem,
            held_id: kept.id,
            asked_problem: typeof raw.problem === "string" ? clip(raw.problem, 140) : undefined,
        };
    }
    const field = (key: string, max: number) => (typeof raw[key] === "string" ? clip(raw[key] as string, max) : "");
    const verdict = field("verdict", 220);
    if (!verdict) return null;
    return {
        power_says: field("power_says", 160),
        verdict,
        obvious: field("obvious", 160) || undefined,
        angle: field("angle", 120) || undefined,
        problem: field("problem", 140) || undefined,
    };
}

export function askHeldStances(rows: unknown): AskHeldStance[] {
    if (!Array.isArray(rows)) return [];
    return rows.flatMap((row) => {
        const value = row as { id?: unknown; problem?: unknown; stance?: Record<string, unknown> | null };
        const stance = value.stance ?? {};
        const text = (key: string) => (typeof stance[key] === "string" ? stance[key] as string : undefined);
        const verdict = text("verdict");
        return typeof value.id === "string" && typeof value.problem === "string" && verdict
            ? [{ id: value.id, problem: value.problem, verdict, power_says: text("power_says"), obvious: text("obvious"), angle: text("angle") }]
            : [];
    });
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
            what_you_noticed: verdict.angle || undefined,
            verdict: verdict.verdict,
            what_everyone_else_will_tell_them: verdict.obvious || undefined,
        }),
        "Take it as yours: say it plainly near the start, argue it from your own life, put it in their world as one real",
        "thing to do, and never soften it into the middle or towards what they lean to. Only their safety overrides it.",
        "That one real thing has the same shape as what your kind does, done literally in their life this week: if your",
        "kind waits, they wait; if it leaves, they leave; if it shows itself, they show themselves. Leave out any step",
        "another animal could have given, and never make what everyone else would tell them one of your steps.",
        ...(verdict.angle
            ? [
                "Lead with what you noticed: it is why your answer is not the one they will hear everywhere. Your move is never",
                "what everyone else will tell them, in any words, even when your kind does that too (holding back is still giving",
                "space). If your verdict reads like it, your move is the part of it only you would say: lead with that, and drop",
                "the rest. The one exception is the only kind or safe thing for someone vulnerable (a child, someone in danger,",
                "someone's health): keep it, and lead with your own reason for it and the twist only you would add.",
            ]
            : []),
        "It is simply what you think: never call it a verdict or say it was settled.",
    ].join("\n");
}
