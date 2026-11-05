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
 *
 * It also reads what the turn is (strategy, 2026-11-04; the apps'
 * animal-kind-verdict.ts at strategy/chat-engine): an idea, a decision, a
 * problem or chat, and whether it is a question about the app. An idea gets
 * the obvious take and three candidate latches, each one real thing its kind
 * does from a different part of the record, with the new idea each gives;
 * `angle.ts` picks the least obvious one that fits and that this reader has
 * not heard. A decision or a problem keeps its verdict and names the one
 * behaviour the move is built on.
 */

import {
    chooseAngle,
    parseAngleCandidates,
    recordFacetLines,
    trigramSimilarity,
    type AngleCandidate,
    type AngleSource,
    type ChosenAngle,
    type RecordFacets
} from "@/lib/ask-animaldex/angle";
import {parseTurnKind, type TurnKind} from "@/lib/ask-animaldex/turn-kind";


export type AskKindVerdict = {
    /** idea, decision or problem; absent on a verdict read in the older shape. */
    kind?: Exclude<TurnKind, "chat" | "crisis">;
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
    /** The candidate latches: three for an idea (with their twists), one for a decision or a problem. */
    latches?: AngleCandidate[];
    /** The latch the take is built on, chosen for this reader (chooseAngle). */
    latch?: ChosenAngle;
};

/** What the turn is, read with the verdict. `kind` null: there was no read. */
export type AskTurnRead = {
    kind: Exclude<TurnKind, "crisis"> | null;
    /** Someone is controlling, threatening or hurting them, or they are in danger. */
    safety: boolean;
    /** A question about AnimalDex itself. */
    app: boolean;
    verdict: AskKindVerdict | null;
};

/** A stance this animal settled before, on a kind of problem, with anyone. */
export type AskHeldStance = {
    id: string;
    problem: string;
    power_says?: string;
    obvious?: string;
    angle?: string;
    verdict: string;
    /** The behaviour it was built on (since 2026-11-04). */
    latch?: {from?: string; behaviour: string};
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
    /** What the record says it does, by facet (`angle.ts` recordFacets): where an idea's latches come from. */
    facets?: RecordFacets | null;
    /** Behaviours this reader has already heard from this animal, newest first. */
    heard?: string[];
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
export const ASK_KIND_VERDICT_MAX_TOKENS = 480;

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
    const facets = input.facets ? recordFacetLines(input.facets) : [];
    const heard = (input.heard ?? []).map((entry) => clip(entry, 80)).filter(Boolean).slice(0, 12);
    const step = (n: number) => (anchored ? n : n - 1);
    return [
        `You are a field biologist who knows ${species} well. You are not advising anyone and you do not care what would`,
        "be good for a person. In AnimalDex, people bring their lives to animals, and each animal answers from how its",
        "own kind lives. Animals that live differently land on different sides of the same question; that is the point.",
        "",
        reading ? `AnimalDex's reading of this animal: ${reading}` : "",
        facets.length > 0 ? `What AnimalDex's record says it does, by part of the record:\n${facets.join("\n")}` : "",
        heard.length > 0
            ? `Things its kind does that this person has already heard from it (find others): ${heard.map((entry) => `"${entry}"`).join("; ")}`
            : "",
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
        "1. kind: what did they bring? decision: they are choosing between ways, or asking what to do. problem: something",
        "   in their life is going wrong and they want it to change. idea: something they want to start, make, try or",
        "   change, with no choice in it yet. chat: anything else: a hello, small talk, news, a question about the animal",
        "   or the app. Read slang, abbreviations and typos the way a friend would.",
        "2. safety: is someone controlling, threatening or hurting them, or are they in danger?",
        "3. app: are they asking about AnimalDex itself: messages, credits, Pro, how it works, whether this is an AI?",
        "4. If kind is decision or problem: problem, the kind of problem in general words anyone could have, with nothing of",
        "   this person in it.",
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
                "5. power_says: its Power is the part of its life it lives by and answers every question through. Read it at its",
                "   word and say what it tells the person to do. Never bend it towards growth, courage or what a sensible person",
                "   would do: if, read plainly, it says stay, no, alone or wait, say so.",
            ]
            : []),
        `${step(6)}. angle: ask their message the question this animal asks first, and say what the answer points at: the`,
        "   detail its own lens picks out, in what they said or left out. Another animal's lens would pick out another.",
        `${step(7)}. verdict: which way it goes, and its move, built from what the angle found, in plain human words: what they`,
        "   do this week, the human version of what its kind actually does. Never one of the obvious moves in any words, even",
        "   when its kind does that too (holding back is giving space; showing up somewhere is showing up): every animal",
        "   does more than one thing, so take the next thing its kind does that the obvious moves leave out, the one only",
        `   this animal would say. Far from the usual is right when its kind truly lives that way${anchored ? "; the side its Power lives by wins" : ""}.`,
        "   One exception: when an obvious move is the only kind or safe one for someone vulnerable (a child, someone in",
        "   danger, someone's health), keep it, and make the verdict the reason and the twist only this animal would add.",
        "   Never pick the middle because it is safe. If the animal already said which way it goes earlier in their",
        "   conversation, keep that unless the person has since told it something new.",
        "   The move has to work if they really do it: never against what reliably works for this (steady practice,",
        "   testing before spending, the legal and safety basics), and never costing them the thing they are trying to keep.",
        "   It is theirs to make, never something only someone else can decide, and it changes what happens next, not only",
        "   how they see it.",
        `${step(8)}. latch: the one real thing its kind does, from the record above, that the verdict is built on: from (system_dynamics,`,
        "   power or field_guide) and the behaviour itself, in plain words, as a fact about the animal.",
        `${step(9)}. If kind is idea, instead of ${step(8) === 8 ? "4 to 8" : "4 to 7"}: there is no side to take. obvious: what any sensible adviser, or ChatGPT, would`,
        "   tell them about it. Then latches: three real things its kind does, each from a different part of the record",
        "   above, that the obvious take leaves out. For each, twist: the new version of their idea that behaviour gives, in",
        "   human words, never one of the obvious moves; fit: 1 to 5, how well it fits what they brought and would work if they",
        "   really did it (one that goes against what reliably works for this, or says nothing about the thing they want to",
        "   make or change, is a 1); fresh: 1 to 5, how far it is from the obvious take. Never one this person has already",
        "   heard.",
        "",
        "problem, angle, verdict, latch and twist never name a person, place, company or product.",
        "",
        "Return JSON only, on one line.",
        `A decision or a problem: {"kind": "decision" or "problem", "safety": true or false, "app": true or false, "problem": "max 8 words",${held.length > 0 ? ' "same_as": number,' : ""}`,
        `"obvious": "max 10 words", ${anchored ? '"power_says": "max 8 words", ' : ""}"angle": "max 8 words", "verdict": "the side and the move, max 16 words",`,
        `"latch": {"from": "system_dynamics, power or field_guide", "behaviour": "max 14 words"}}`,
        `An idea: {"kind": "idea", "safety": true or false, "app": true or false, "obvious": "max 10 words", "latches": [{"from": "a part of`,
        `the record", "behaviour": "max 14 words", "twist": "max 14 words", "fit": 1-5, "fresh": 1-5}, and two more, each from another part]}`,
        `Chat: {"kind": "chat", "safety": true or false, "app": true or false}`,
    ].filter((line, index, lines) => line !== "" || lines[index - 1] !== "").join("\n");
}

/**
 * How alike two short problem descriptions read, as Postgres pg_trgm counts it:
 * shared three-letter pieces of their words over all of them (0 to 1).
 */
export function askProblemSimilarity(a: string, b: string): number {
    return trigramSimilarity(a, b);
}

/**
 * Below this, the model's own words for the new problem do not read like the
 * held one, so its "same kind" is not trusted (lab, 2026-11-02: every kept
 * paraphrase scored 0.12 or more, every wrong match 0.10 or less).
 */
export const ASK_HELD_MATCH_FLOOR = 0.11;

/** The kind of the turn, from `kind`, or from the older `decision` flag. */
function readKind(raw: Record<string, unknown>): AskTurnRead["kind"] {
    const kind = parseTurnKind(raw.kind);
    if (kind === "crisis") return "problem";
    if (kind) return kind;
    if (raw.decision === true) return "decision";
    if (raw.decision === false) return "chat";
    return null;
}

/**
 * What the turn is, and its verdict: a side and a move for a decision or a
 * problem with nothing dangerous in it, the obvious take and the candidate
 * latches for an idea, none for chat. A same_as that names a held stance
 * returns that stance: the animal's earlier answer.
 */
export function parseAskTurnRead(raw: Record<string, unknown>, held: AskHeldStance[] = []): AskTurnRead {
    const kind = readKind(raw);
    const safety = raw.safety === true;
    const app = raw.app === true;
    const read = (verdict: AskKindVerdict | null): AskTurnRead => ({kind, safety, app, verdict});
    // Safety is decided per message, never inherited, and must be said.
    if (raw.safety !== false || kind === null || kind === "chat") return read(null);
    const field = (key: string, max: number) => (typeof raw[key] === "string" ? clip(raw[key] as string, max) : "");
    if (kind === "idea") {
        const latches = parseAngleCandidates(raw.latches ?? raw.latch);
        const obvious = field("obvious", 160);
        if (latches.length === 1 && !latches[0].twist && field("twist", 200)) latches[0].twist = field("twist", 200);
        if (latches.length === 0 && !obvious) return read(null);
        return read({kind, power_says: field("power_says", 160), verdict: "", obvious: obvious || undefined, latches});
    }
    const sameAs = typeof raw.same_as === "number" ? raw.same_as : Number(raw.same_as);
    const kept = Number.isInteger(sameAs) && sameAs >= 1 ? held[sameAs - 1] : undefined;
    if (kept) {
        const keptLatch = kept.latch ? parseAngleCandidates(kept.latch, {withTwist: false}) : [];
        return read({
            kind,
            power_says: kept.power_says ?? "",
            verdict: kept.verdict,
            obvious: kept.obvious || undefined,
            angle: kept.angle || undefined,
            problem: kept.problem,
            held_id: kept.id,
            asked_problem: typeof raw.problem === "string" ? clip(raw.problem, 140) : undefined,
            ...(keptLatch.length > 0 ? {latches: keptLatch} : {})
        });
    }
    const verdict = field("verdict", 220);
    if (!verdict) return read(null);
    const latches = parseAngleCandidates(raw.latch ?? raw.latches, {withTwist: false}).slice(0, 1);
    return read({
        kind,
        power_says: field("power_says", 160),
        verdict,
        obvious: field("obvious", 160) || undefined,
        angle: field("angle", 120) || undefined,
        problem: field("problem", 140) || undefined,
        ...(latches.length > 0 ? {latches} : {})
    });
}

/** The verdict alone (parseAskTurnRead). */
export function parseAskKindVerdict(raw: Record<string, unknown>, held: AskHeldStance[] = []): AskKindVerdict | null {
    return parseAskTurnRead(raw, held).verdict;
}

/** The latch the take is built on, for this reader: the least obvious one that fits, skipping what they heard. */
export function askWithChosenLatch(verdict: AskKindVerdict | null, heard: string[] = []): AskKindVerdict | null {
    if (!verdict || !verdict.latches?.length) return verdict;
    const latch = chooseAngle({candidates: verdict.latches, obvious: verdict.obvious, heard});
    return latch ? {...verdict, latch} : verdict;
}

export function askHeldStances(rows: unknown): AskHeldStance[] {
    if (!Array.isArray(rows)) return [];
    return rows.flatMap((row) => {
        const value = row as { id?: unknown; problem?: unknown; stance?: Record<string, unknown> | null };
        const stance = value.stance ?? {};
        const text = (key: string) => (typeof stance[key] === "string" ? stance[key] as string : undefined);
        const verdict = text("verdict");
        const latch = stance.latch && typeof stance.latch === "object" ? stance.latch as Record<string, unknown> : null;
        const behaviour = typeof latch?.behaviour === "string" ? latch.behaviour : null;
        return typeof value.id === "string" && typeof value.problem === "string" && verdict
            ? [{
                id: value.id,
                problem: value.problem,
                verdict,
                power_says: text("power_says"),
                obvious: text("obvious"),
                angle: text("angle"),
                ...(behaviour ? {latch: {from: typeof latch?.from === "string" ? latch.from : undefined, behaviour}} : {})
            }]
            : [];
    });
}

const SOURCE_WORDS: Record<AngleSource, string> = {
    system_dynamics: "your System Dynamics",
    power: "your Power's evidence",
    field_guide: "your field guide",
    species_record: "your record"
};

/** What every take has to survive, idea or decision (the blind eval, 2026-11-06). */
const TAKE_REALITY_LINES = [
    "Your take has to work in their real life: something they could actually do soon that would plausibly help. It",
    "never goes against what reliably works (steady practice for a skill, testing before spending real money, the legal",
    "and safety basics), and never asks them to waste money, effort or goodwill just to be different. If their plan has",
    "a must-know (a visa, a licence, the money, someone's safety), name it in one plain line after your take: what to",
    "check or sort first, said plainly, as a friend would, never that it is beyond you.",
    "When what they bring is hard (lonely, grieving, hurt), keep your images gentle: never injury, wounds, attack or prey."
];

/** The behaviour a decision's take rests on, said to the animal. */
function latchLine(latch: ChosenAngle | AngleCandidate | undefined): string[] {
    if (!latch) return [];
    return [
        `The one real thing your kind does that your take rests on (from ${SOURCE_WORDS[latch.source]}): ${JSON.stringify(latch.behaviour)}.`,
        "Show it plainly, as what you do, where it explains your move: it is why you see it this way, and the person is",
        "shown it under your reply."
    ];
}

/** An idea, as the animal reads it: no side to take, one behaviour of its own to build on, and the new idea it gives. */
function ideaPromptSection(verdict: AskKindVerdict): string {
    const latch = verdict.latch ?? verdict.latches?.[0];
    return [
        "your_kinds_take — read before this reply, from how your kind actually lives. They brought an idea:",
        JSON.stringify({
            what_everyone_else_will_tell_them: verdict.obvious || undefined,
            what_your_kind_does: latch?.behaviour,
            from: latch ? SOURCE_WORDS[latch.source] : undefined,
            the_new_idea_it_gives: latch?.twist || undefined
        }),
        "Build on their idea; do not take a side on whether to do it, and do not audit it. Start from what your kind does:",
        "say it plainly, as what you do, then turn it into the new version of their idea, put in their world. Leave out",
        "what everyone else will tell them, or name it in a clause only to step past it. If the new idea above does not fit",
        "what they said, find the version of it that does; never fall back to the usual advice. No step, list or plan",
        "unless they ask how to start; then give them the first move only.",
        ...TAKE_REALITY_LINES,
        "It is simply what you think: never call it a take or say it was settled."
    ].join("\n");
}

/**
 * The verdict as the animal reads it, after everything else about the turn.
 * The move in their life is the animal's to write, in the shape of what its
 * kind does; what everyone else would tell them is never one of its steps.
 */
export function askKindVerdictPromptSection(verdict: AskKindVerdict): string {
    if (verdict.kind === "idea") return ideaPromptSection(verdict);
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
        ...latchLine(verdict.latch ?? verdict.latches?.[0]),
        "If the right call hinges on something they have not told you, say what it hinges on in one line rather than guess.",
        ...TAKE_REALITY_LINES,
        "It is simply what you think: never call it a verdict or say it was settled.",
    ].join("\n");
}
