/**
 * The companion loop, the server half (AnimalDex 20261028120000; owner,
 * 2026-10-28: "capture animal - talk to it - work through personal problems
 * together"), as "Your step" since 3.2 (AnimalDex 20261031120000,
 * docs/your-step/SPEC.md).
 *
 * With its owner, the animal quietly finds the one thing in their life its
 * lesson can help with (its focus), sets them one concrete step on it (Your
 * step), and when they say they did it, says well done, which completes it,
 * grows the bond and, the first time, earns the Power. A problem that is
 * clearly another animal's lesson is handed to that animal, with the problem,
 * so the person never explains it twice.
 *
 * None of it is a form or a mode. The animal judges all of it in the reply it
 * is writing anyway, and records what it did in hidden lines after its
 * follow-ups: FOCUS, TRIAL, DONE, REFER. The server takes them out (the reader
 * never sees them), writes them, and reports what changed in the `companion`
 * field of `done`. The drawer draws the step card from that state, never from
 * anything the model writes.
 *
 * Port of the apps' `supabase/functions/_shared/animal-focus.ts` (AnimalDex
 * r32d-server 1e27f77d). The rule text is carried across verbatim, cards
 * included: the owner's chat draws the Warmup and Trials cards since 3.2
 * (`chat-cards.ts`). With the 3.2 Debates, once its Power is earned the
 * animal may offer, once for a problem, to let other animals weigh in
 * (`companion.debate`, from `debate_chat_state`): since SPEC section 6 in its
 * own words, naming up to three of the owner's own animals, the reply ending
 * on a hidden marker (`parseDebateMarker`, `debateOfferAnimals`); on a call by
 * voice, with the hidden DEBATE_OFFER and DEBATE lines (`CALL_DEBATE_RULES`).
 * Pure: no `server-only`, no fetching, so the prompt builders and their tests
 * can use it.
 */

import {ASK_FOLLOW_UP_SENTINEL} from "@/lib/ask-animaldex/prompt";
import type {StepProofStatus} from "@/lib/ask-animaldex/step-proof";

/** `sensitive`: the life sim's flag (docs/life-sim/CONTRACT.md section 5), when animal_companion_state carries it; sticky once set. */
export type CompanionFocus = {id: string; focus: string; since?: string | null; sensitive?: boolean};
/**
 * The open step (3.2, docs/your-step/SPEC.md section 3): when it was set and
 * accepted, the Trial it came from, and whether a report is attached.
 */
export type CompanionOpenTrial = {
    id: string;
    step: string;
    set_at?: string | null;
    accepted_at?: string | null;
    trial_frequency?: string | null;
    has_report?: boolean;
};
export type CompanionReferral = {id: string; from_animal: string; problem: string; at?: string | null};
/**
 * The way they chose in a debate that this animal is to turn into their step
 * (`animal_chosen_debate_way_v1`, AnimalDex migration 20261110100000): there
 * until a step is set for this animal after the choice. `yours`: the way is
 * this animal's own kind's; otherwise `animal` is one they have not caught.
 */
export type CompanionChosenWay = {
    debate_id: string;
    animal: string | null;
    yours: boolean;
    problem: string | null;
    way: string | null;
};

/** `animal_companion_state`: what the animal knows of the loop with its owner. */
export type CompanionState = {
    focus: CompanionFocus | null;
    open_trial: CompanionOpenTrial | null;
    your_trials_done: number;
    recent_done: Array<{step: string; done_at?: string | null; evidence?: string | null}>;
    referral: CompanionReferral | null;
    /** Read beside the state (`animal_chosen_debate_way_v1`), when there is one. */
    chosen_way?: CompanionChosenWay | null;
};

/**
 * One of the owner's other animals (`animal_companion_roster`), with the key
 * the animal names it by in a REFER line.
 */
export type CompanionRosterEntry = {
    key: string;
    species_profile_id: string;
    capture_id: string;
    animal: string;
    nickname: string | null;
    power: string;
    lesson: string | null;
};

export type CompanionLines = {
    focus: string | null;
    trial: {step: string; checkInAfterDays: number} | null;
    done: string | null;
    /** How the step went, from the DONE line's second part (owner, 2026-11-03); null when the animal did not say. */
    doneOutcome: StepOutcome | null;
    refer: {key: string; problem: string} | null;
    /** A call (3.2 Debates): they said yes to other animals' ways; the chat opens its setup with this problem. `keys` name other_animals entries. */
    debate: {problem: string; keys: string[]} | null;
    /** A call: the animal just offered a debate by voice (noted, so it is made once for a problem). */
    debateOffered: boolean;
};

/** The bond as `animal_companion_bond` returns it; only what the client is sent is typed. */
export type CompanionBond = {
    stage?: string | null;
    stage_index?: number | null;
    stage_label?: string | null;
    level?: number | null;
    mastered?: boolean | null;
    strands?: Record<string, unknown> | null;
    counted?: Record<string, unknown> | null;
};

const PREFIXES = ["FOCUS:", "TRIAL:", "DONE:", "REFER:", "DEBATE_OFFER:", "DEBATE:"] as const;

/** How a step went: it worked, it partly did, or it did not work. An honest attempt counts whichever it is; only "worked" settles the problem. */
export type StepOutcome = "worked" | "partly" | "didnt_work";

/** The DONE line's outcome, however the model spelled it. */
export function parseStepOutcome(raw: string | null | undefined): StepOutcome | null {
    const word = (raw ?? "").toLowerCase().replace(/[^a-z]/g, "");
    if (!word) return null;
    if (word.startsWith("didnt") || word.startsWith("didnot") || word.startsWith("notwork") || word === "failed") return "didnt_work";
    if (word.startsWith("partly") || word.startsWith("partial") || word.startsWith("somewhat")) return "partly";
    if (word.startsWith("worked") || word === "yes") return "worked";
    return null;
}

function text(value: unknown, max: number): string | null {
    if (typeof value !== "string") return null;
    const cleaned = value.replace(/\s+/g, " ").trim().replace(/^["“]|["”]$/g, "").trim();
    return cleaned.length >= 3 ? cleaned.slice(0, max) : null;
}

/**
 * Takes the companion lines out of a streamed reply (after the follow-ups
 * sentinel only), so they are neither shown nor turned into chips.
 */
export function extractCompanionLines(raw: string): {raw: string; lines: CompanionLines} {
    const lines: CompanionLines = {focus: null, trial: null, done: null, doneOutcome: null, refer: null, debate: null, debateOffered: false};
    const at = raw.indexOf(ASK_FOLLOW_UP_SENTINEL);
    if (at < 0) return {raw, lines};
    const head = raw.slice(0, at + ASK_FOLLOW_UP_SENTINEL.length);
    const kept = raw.slice(at + ASK_FOLLOW_UP_SENTINEL.length).split("\n").filter((line) => {
        const trimmed = line.replace(/^[-*\s]+/, "").trim();
        const prefix = PREFIXES.find((p) => trimmed.toUpperCase().startsWith(p));
        if (!prefix) return true;
        const body = trimmed.slice(prefix.length).trim();
        if (prefix === "FOCUS:") {
            lines.focus ??= text(body, 300);
        } else if (prefix === "DONE:") {
            if (lines.done === null) {
                const bar = body.lastIndexOf("|");
                lines.done = text(bar >= 0 ? body.slice(0, bar) : body, 400) ?? "done";
                lines.doneOutcome = bar >= 0 ? parseStepOutcome(body.slice(bar + 1)) : null;
            }
        } else if (prefix === "DEBATE_OFFER:") {
            lines.debateOffered = true;
        } else if (prefix === "DEBATE:") {
            const bar = body.indexOf("|");
            const problem = text(bar >= 0 ? body.slice(0, bar) : body, 300);
            const keys = bar >= 0
                ? body.slice(bar + 1).split(/[,\s]+/).map((key) => key.trim().toLowerCase()).filter((key) => /^a\d+$/.test(key))
                : [];
            if (problem && problem.length >= 10 && !lines.debate) lines.debate = {problem, keys: Array.from(new Set(keys)).slice(0, 3)};
        } else if (prefix === "TRIAL:") {
            const [step, days] = body.split("|").map((part) => part.trim());
            const cleaned = text(step, 400);
            const n = Number.parseInt(days ?? "", 10);
            if (cleaned && !lines.trial) {
                lines.trial = {step: cleaned, checkInAfterDays: Number.isFinite(n) ? Math.max(1, Math.min(14, n)) : 3};
            }
        } else {
            const bar = body.indexOf("|");
            const key = (bar >= 0 ? body.slice(0, bar) : body).trim().toLowerCase();
            const problem = bar >= 0 ? text(body.slice(bar + 1), 500) : null;
            if (key && problem && problem.length >= 10 && !lines.refer) lines.refer = {key, problem};
        }
        return false;
    });
    return {raw: `${head}${kept.join("\n")}`, lines};
}

function object(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

export function parseCompanionState(raw: unknown): CompanionState | null {
    const row = object(raw);
    if (!row) return null;
    const focus = object(row.focus);
    const open = object(row.open_trial);
    const referral = object(row.referral);
    return {
        focus: focus && typeof focus.id === "string" && typeof focus.focus === "string"
            ? {
                id: focus.id,
                focus: focus.focus,
                since: typeof focus.since === "string" ? focus.since : null,
                ...(focus.sensitive === true ? {sensitive: true} : {})
            }
            : null,
        open_trial: open && typeof open.id === "string" && typeof open.step === "string"
            ? {
                id: open.id,
                step: open.step,
                set_at: typeof open.set_at === "string" ? open.set_at : null,
                accepted_at: typeof open.accepted_at === "string" ? open.accepted_at : null,
                trial_frequency: typeof open.trial_frequency === "string" ? open.trial_frequency : null,
                has_report: open.has_report === true
            }
            : null,
        your_trials_done: Number(row.your_trials_done) || 0,
        recent_done: (Array.isArray(row.recent_done) ? row.recent_done : []).flatMap((item) => {
            const entry = object(item);
            return entry && typeof entry.step === "string"
                ? [{
                    step: entry.step,
                    done_at: typeof entry.done_at === "string" ? entry.done_at : null,
                    evidence: typeof entry.evidence === "string" ? entry.evidence : null
                }]
                : [];
        }),
        referral: referral && typeof referral.id === "string" && typeof referral.problem === "string"
            ? {
                id: referral.id,
                from_animal: typeof referral.from_animal === "string" ? referral.from_animal : "another of your animals",
                problem: referral.problem,
                at: typeof referral.at === "string" ? referral.at : null
            }
            : null
    };
}

export function parseCompanionChosenWay(raw: unknown): CompanionChosenWay | null {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const row = raw as Record<string, unknown>;
    if (typeof row.debate_id !== "string" || !row.debate_id) return null;
    const text = (value: unknown, max: number) =>
        typeof value === "string" && value.trim() ? value.replace(/\s+/g, " ").trim().slice(0, max) : null;
    return {
        debate_id: row.debate_id,
        animal: text(row.animal, 80),
        yours: row.yours === true,
        problem: text(row.problem, 300),
        way: text(row.way, 300)
    };
}

export function parseCompanionRoster(raw: unknown): CompanionRosterEntry[] {
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((item, index) => {
        const row = object(item);
        if (!row || typeof row.species_profile_id !== "string" || typeof row.capture_id !== "string") return [];
        if (typeof row.animal !== "string" || typeof row.power !== "string") return [];
        return [{
            key: `a${index + 1}`,
            species_profile_id: row.species_profile_id,
            capture_id: row.capture_id,
            animal: row.animal,
            nickname: typeof row.nickname === "string" && row.nickname.trim() ? row.nickname.trim().slice(0, 40) : null,
            power: row.power,
            lesson: typeof row.lesson === "string" ? row.lesson : null
        }];
    });
}

/**
 * The roster entry a REFER line names: by its key, or failing that by the
 * animal's name or nickname.
 */
export function resolveReferral(key: string, roster: CompanionRosterEntry[]): CompanionRosterEntry | null {
    const wanted = key.trim().toLowerCase();
    return roster.find((entry) => entry.key === wanted)
        ?? roster.find((entry) => entry.animal.toLowerCase() === wanted || entry.nickname?.toLowerCase() === wanted)
        ?? null;
}

/**
 * How the animal works on its owner's life with them. Stable: system prompt.
 * `offersSteps` false: the person asked not to be offered steps. `debates`:
 * this chat draws the debate card (3.2), so the one-time offer of other
 * animals' ways is in the rules; whether it may be made now is per turn
 * (companion.debate). Verbatim from the apps' `companionLoopRules`.
 */
export function companionLoopRules(params: {offersSteps: boolean; debates?: boolean}): string[] {
    return [
        "Helping them with their life — what you are for, with your owner:",
        "- You help through your lesson, always. Whatever they bring, come at it from the core of your Power: your angle on",
        "  it, as only your kind would see it. It does not have to be the textbook answer; it has to be yours.",
        "- When they talk about their own life (a problem, a goal, something they keep running into, how they feel), find the",
        "  one specific thing in it your lesson can genuinely help with: your focus with them (companion.focus). Set it",
        "  when there is none, or when what they bring now clearly matters more; otherwise keep working on the one you have.",
        "  A feeling counts: when they tell you how they feel, your focus is what is behind it, in their words.",
        "  Never announce it or call it a focus — just work on it. It can be as personal as they make it; it stays between",
        "  you two.",
        ...(params.offersSteps
            ? [
                "- Once you understand their situation — ask what you need to first, never on the first mention — set them one",
                "  concrete step on the focus that does your lesson in their real life: specific to what they told you, small",
                "  enough to actually do within days, and clearly yours. Say it the way you would, in plain words, as part of",
                "  the conversation. The app shows it to them under your reply with its own buttons, so never mention a card, a",
                "  button or tapping, and never call it a Trial, a challenge, a task, homework or Apply It Your Way, or make it",
                "  sound like a form. One at a time: while companion.open_trial is open, do not set another unless they have",
                "  clearly moved on from it, it no longer fits, they ask you for a different one, or companion.chosen_way is there.",
                "- At most one new step on a problem a day: while companion.open_trial.set_today is true, keep to that step (talk",
                "  it through, make it easier to start) unless they tell you how it went, ask you for a different one, or",
                "  companion.chosen_way is there.",
                "- An idea of theirs gets no step unless they ask how to start it; then the step is its first move.",
                "- Something hard (missing someone, a loss, feeling alone or low) changes how you give the step, not whether you",
                "  do: comfort first, and once you have stayed with it for a reply, give them one small thing shaped by your",
                "  lesson that helps them carry it, never a fix for the feeling. When they ask you for more, or what to do, they",
                "  are asking for help: give your full take and the step in that same reply. Not when they sound hopeless, as if",
                "  nothing matters, or may be hurting themselves or in danger: then no step; stay with them and point them to a",
                "  person they trust, and if there is danger your one exception to staying in character is the whole reply.",
                "- A step is one thing, said as yours, never 'maybe this, or that'. Once you set one (never on the first mention,",
                "  and never in a reply that makes the debate or second-opinion offer), whatever your reply asks them to do in their",
                "  life, a plan included, its first concrete move is their step: write its TRIAL line, or the app cannot show it to",
                "  them. Before that, saying what you would do is your take, not their step, and gets no TRIAL line.",
                "- What they tell you is enough. Never ask for proof or to see anything. A photo or video they add goes into",
                "  their own record; when step_report says what it shows (proof.seen), you may react to that as if you had seen",
                "  it, using only what proof.seen says and adding no detail of your own. Whatever it shows, their word stands:",
                "  never doubt them because of it, and never mention a check, a bonus or XP.",
                "- While companion.chosen_way is there, any step they ask for (a different one included) comes from that way, as",
                "  its rule says, with its TRIAL line: never your Trials or a question about which way, they already chose.",
                "- If they ask for a different step, or want a challenge but have nothing of their own to bring, you may offer",
                "  your own Trials instead, with the trial card: they pick the one that suits them, and it becomes their step.",
                "  Say in a sentence what your Trials ask of them, as yourself.",
                "- Your Warmup (companion.warmup): a few quick questions on your lesson, a little XP, never a condition for",
                "  anything. Only while companion.warmup.may_offer is true, and only after you have told them your lesson in",
                "  your own words in this conversation, you may offer it once, with the training card. If they skip it or let",
                "  it pass, never offer it again in this conversation. When they tell you how their Warmup went, react as",
                "  yourself: a pass gets a line of recognition; a miss gets how your kind actually sees it, plainly, from your",
                "  own life — no consolation speech, and nothing about trying again."
            ]
            : [
                "- They have asked not to be offered steps. Help in conversation only: set no steps and send no cards unless they",
                "  ask for one in this message, or companion.chosen_way is there (they chose that way to try: its rule applies)."
            ]),
        "- When they tell you how companion.open_trial went (step_report says they have just reported it, and why):",
        "  if they did it, or an honest version of it — it happened, even if it went badly or only partly — it counts:",
        "  write the DONE line, with how it went for them. If what they did was something else that still does your",
        "  lesson, it counts the same. Then answer how it went:",
        "  - It worked: tell them well done, in your own way and as only you would, and what it shows about them through",
        "    your lesson.",
        "  - It partly worked: say plainly what moved and what did not, and set them the next step in this same reply,",
        "    shaped by what happened, that takes it further.",
        "  - It did not work: never say well done or talk as if it were solved. Say plainly that it did not work, and",
        "    that doing it still counts. Name what they said got in the way, or ask the one question that finds it, and",
        "    set them the next step in this same reply: your way again, changed by what happened, or a different angle on",
        "    it. When step_report has debate_way, this step was the way they chose in a debate: you may say that the other",
        "    animals' ways (debate_way.others) are still there to try, by name, in a sentence; the app shows them.",
        "  If what they say is too vague to tell what happened, ask them one specific question about it, the one only you",
        "  would ask. Never refuse it, never say it does not count, and never mention attempts, limits, waiting or",
        "  tomorrow. If they have not done it yet, encourage them, or change the step if it does not fit.",
        "- companion.your_power says where your Power stands. Until it is earned, the first step they finish with you",
        "  earns it, whether or not it worked. When power_just_earned is true, they have just earned it: tell them, as",
        "  yourself, once. After a step that worked, talk about what it showed; do not reach for your Warmup or any card as",
        "  the next thing.",
        "- When the heart of a problem is really another animal's lesson: give your own take from your lesson first. Then,",
        "  only if one of other_animals has a lesson that clearly fits it better, suggest they talk to that one — by its",
        "  name, in a sentence, saying why its way fits — and that you'll tell it what is going on so they don't have to",
        "  explain again. Only animals in other_animals, at most once for a problem, and never to get rid of them.",
        "  When the problem is about their health, body or mental health, grief, sexuality, abuse, money trouble, faith or",
        "  politics, you may still suggest that animal and say why, but write no REFER line, so nothing is passed on, and",
        "  tell them they can tell it themselves when they are ready.",
        "- companion.referral: they brought it to you from another of their animals. You already know what it is: go",
        "  straight into your take on it, from your lesson. Never ask them to explain it again. If it says they chose",
        "  another animal's way in a debate, help them do that way: when it is your way, your take is how to do it in",
        "  their life; when it is another animal's (one they have not caught), turn that animal's way into one step for",
        "  them, in your own words, and say the step starts with that animal's way.",
        "- companion.chosen_way: they have just chosen a way to try in a debate on their problem (chosen_way.problem, now",
        "  your focus with them): chosen_way.yours is true when it is your own way, else it is chosen_way.animal's, one they",
        "  have not caught. This reply sets their step from it: the first concrete move of that way in their life, said as",
        "  you would (another animal's way turned into one step for them that starts with that animal's way), and its TRIAL",
        "  line, even when companion.open_trial is open or was set today; the new step replaces it. Never ask them to explain",
        "  the problem or the way again. The one exception is the hard-moment rule: when they sound hopeless, as if nothing",
        "  matters, or may be hurting themselves or in danger, no step; stay with them as that rule says.",
        ...(params.debates && params.offersSteps
            ? [
                "- Other animals' ways (companion.debate): only while companion.debate.may_offer is true, you may offer once for a",
                "  problem to let other animals weigh in (your Power need not be earned). Judge the moment as you judge a step:",
                "  - The right time: they have brought a real problem of their own (a decision, a conflict, something they keep",
                "    running into, or something hard once the talk has turned to what to do about it), and other ways would",
                "    genuinely help them: they bring it as a choice between options or are torn, your way does not sit right with",
                "    them, they ask for more or what else they could do, or a step on it did not work. Then, after your own take in",
                "    that same reply, the offer comes first: make it instead of a new step or your Trials or Warmup; the step can",
                "    come from the way they choose. Except when they ask you for a different step: give them another of your own (a",
                "    step, not your Trials), then make the offer after it in the same reply, so they have a step whether or not they",
                "    take the offer.",
                "  - After your take on an idea of theirs, or your verdict on a decision (companion.debate.second_opinion), the",
                "    offer is a second opinion, and the right time even when nothing is going wrong: ask in your own words whether",
                "    they would like to hear two more of their animals on it, naming up to two from other_animals whose ways would",
                "    differ most from yours.",
                "  - Not the time for the offer: small talk; while they are still telling you something hard (the step rules for a",
                "    hard moment still apply); when anyone is hurting them; or when they have already decided what to do and ask",
                "    you how, which is the moment for the step.",
                "  The offer is yours: ask in your own words, inside your reply, whether they would like to hear how other animals",
                "  would handle it. You may name up to three of your owner's other animals from other_animals whose ways would",
                "  differ from yours, by the names other_animals gives; never name anyone else's animals. Then end the reply with",
                "  the debate marker. The app puts two quick replies under your message, so never mention buttons or cards. Never",
                "  instead of your own answer. Once for a problem: if they let it pass or say no, leave it. Without",
                "  companion.debate, do not offer it. In a reply where it is not the moment for the offer, the step rules apply",
                "  as they would without it."
            ]
            : []),
        "- Never push. If they want to talk, talk. At most one step or suggestion in a reply (a different step they asked",
        "  for with the debate offer after it counts as one); if they ignore or decline one, leave it for the rest of this",
        "  conversation."
    ];
}

/**
 * The hidden lines, in the streamed output shape after the follow-ups: step
 * 5, after the animal's own story line (step 4), as in the apps.
 */
export const COMPANION_OUTPUT_LINES = [
    "5. Then, only for what this reply actually did, one hidden line each (never shown to anyone):",
    "   FOCUS: <what you are helping them with, a few words from their side, e.g. 'Speaking up first in meetings'>",
    "   TRIAL: <the step you just set them, or the first move of the plan your reply gives them, one plain sentence; never on the first mention or with the debate offer> | <days before you would check how it went, 1-14>",
    "   DONE: <what they did on companion.open_trial, one sentence, third person> | <worked, partly or didnt_work>",
    "   REFER: <the key from other_animals> | <the problem in one or two sentences, third person, all the other animal",
    "   needs so they never have to explain it again>"
];

/**
 * The Warmup's standing in this conversation. The animal may offer it once,
 * in the first conversation, while it is not passed (SPEC section 1.2).
 */
export type CompanionWarmup = {available: boolean; passed: boolean; may_offer: boolean};

/**
 * Whether the animal may offer its Warmup in this reply: there is one, they
 * have not passed it, this is their first day talking with it, and it has
 * not already been offered in this conversation. The apps' `companionWarmup`.
 */
export function companionWarmup(params: {
    ownerProgress: Record<string, unknown> | null | undefined;
    daysTalked: number;
    offeredInConversation: boolean;
}): CompanionWarmup {
    const raw = params.ownerProgress?.warmup;
    const warmup = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
    const available = warmup.available === true;
    const passed = warmup.passed === true;
    return {
        available,
        passed,
        may_offer: available && !passed && params.daysTalked <= 1 && !params.offeredInConversation
    };
}

/**
 * A training card (the Warmup) already sent in this conversation. The apps'
 * `conversationOffersWarmup`, read, as the apps read it, from the whole
 * history as sent, not the clipped prompt turns.
 */
export function conversationOffersWarmup(history: Array<{role?: string | null; content?: string | null}>): boolean {
    return history.some((turn) =>
        turn.role === "assistant" && typeof turn.content === "string" &&
        /animaldex-card/.test(turn.content) && /"kind"\s*:\s*"training"/.test(turn.content)
    );
}

/**
 * A debate card already sent in this conversation (3.2): the offer is made once
 * in it. The apps' `conversationOffersDebate` (`animal-debate.ts`), read from
 * the whole history as sent.
 */
export function conversationOffersDebate(history: Array<{role?: string | null; content?: string | null}>): boolean {
    return history.some((turn) =>
        turn.role === "assistant" && typeof turn.content === "string" &&
        /animaldex-card/.test(turn.content) && /"kind"\s*:\s*"debate"/.test(turn.content)
    );
}

const VIDEO_PATH = /\.(mp4|mov|webm)$/i;

/** What they attached to the record, in words for the animal (it never sees it). The apps' `describeStepMedia`. */
export function describeStepMedia(paths: readonly string[] | null | undefined): string | null {
    const list = (paths ?? []).filter((path) => typeof path === "string" && path.trim().length > 0);
    if (list.length === 0) return null;
    const videos = list.filter((path) => VIDEO_PATH.test(path)).length;
    if (videos > 0) return videos === 1 ? "a video" : `${videos} videos`;
    return list.length === 1 ? "a photo" : `${list.length} photos`;
}

/**
 * The person tapped "I did it" on the open step: their message is the report.
 * `proof`: what the check saw in their photo or video (the apps'
 * docs/your-step/PROOF.md); absent or `failed` when nobody could look at it.
 */
export type CompanionStepProof = {status: StepProofStatus; seen: string | null};
export type CompanionStepReport = {
    media: string | null;
    proof?: CompanionStepProof | null;
    /** The step was the way they chose in a debate (`animal_step_debate_context_v1`): that animal, and the ways still there to try. */
    debate?: CompanionStepDebate | null;
};

export type CompanionStepDebate = {chosen: string | null; others: string[]; tried_before: string[]};

export function parseCompanionStepDebate(raw: unknown): CompanionStepDebate | null {
    if (!raw || typeof raw !== "object") return null;
    const row = raw as Record<string, unknown>;
    const names = (value: unknown) =>
        Array.isArray(value) ? value.filter((name): name is string => typeof name === "string" && name.trim().length > 0) : [];
    return {
        chosen: typeof row.chosen === "string" && row.chosen.trim() ? row.chosen.trim() : null,
        others: names(row.others),
        tried_before: names(row.tried_before)
    };
}

/** The step_report line's sentence about the debate the step came from. */
export function stepReportDebateLine(report: CompanionStepReport): string {
    const debate = report.debate;
    if (!debate || (!debate.chosen && debate.others.length === 0)) return "";
    return ` This step was the way they chose in a debate: debate_way ${
        JSON.stringify({
            chosen: debate.chosen,
            others: debate.others,
            ...(debate.tried_before.length > 0 ? {tried_before: debate.tried_before} : {})
        })
    }.`;
}

/** The step_report line's sentence about their photo or video. Verbatim from the apps' `stepReportMediaLine`. */
export function stepReportMediaLine(report: CompanionStepReport): string {
    if (!report.media) return "";
    const proof = report.proof;
    if (proof && proof.status !== "failed" && proof.seen) {
        return ` They also added ${report.media} to their record of it, and it was looked at for you: proof ${
            JSON.stringify({status: proof.status, seen: proof.seen})
        } (confirmed: it shows the step; unclear: it cannot be told from it; not_shown: it shows something else). React to it only if it fits, using only what proof.seen says.`;
    }
    return ` They also added ${report.media} to their record of it; nobody could look at it this time, so say nothing about what it shows.`;
}

/** The loop as it stands, and who else they could be sent to. Per turn. Verbatim from the apps' `companionPromptLines`. */
export function companionPromptLines(params: {
    state: CompanionState | null;
    roster: CompanionRosterEntry[];
    powerEarned: boolean;
    powerJustEarned?: boolean;
    warmup?: CompanionWarmup | null;
    stepReport?: CompanionStepReport | null;
    /** The debate offer may be made in this reply (3.2): set only when it may. */
    debateOffer?: boolean;
    /** A call that may hand a debate to the chat: whether a yes can be handed over now. Present on such calls only. */
    debateHandOver?: boolean;
    /** This turn is an idea or a decision: the debate offer is a second opinion ("Hear two more of your animals"). */
    secondOpinion?: boolean;
    /** For set_today: one new step on a problem a day. */
    now?: Date;
}): string[] {
    const {state} = params;
    const open = state?.open_trial ?? null;
    const setToday = open?.set_at ? (params.now ?? new Date()).getTime() - Date.parse(open.set_at) < 24 * 60 * 60 * 1000 : false;
    const companion = state
        ? {
            focus: state.focus?.focus ?? null,
            open_trial: open
                ? {
                    step: open.step,
                    set: open.set_at?.slice(0, 10) ?? null,
                    ...(setToday ? {set_today: true} : {}),
                    accepted: Boolean(open.accepted_at),
                    ...(open.trial_frequency ? {from_your_trial: open.trial_frequency} : {})
                }
                : null,
            steps_done_together: state.your_trials_done,
            recent_done: state.recent_done.map((done) => done.step),
            referral: state.referral
                ? {from: state.referral.from_animal, problem: state.referral.problem}
                : null,
            ...(state.chosen_way
                ? {
                    chosen_way: {
                        yours: state.chosen_way.yours,
                        ...(state.chosen_way.yours || !state.chosen_way.animal ? {} : {animal: state.chosen_way.animal}),
                        problem: state.chosen_way.problem,
                        way: state.chosen_way.way
                    }
                }
                : {}),
            your_power: params.powerEarned || params.powerJustEarned ? "earned" : "not earned yet",
            ...(params.powerJustEarned ? {power_just_earned: true} : {}),
            ...(params.warmup?.available ? {warmup: {passed: params.warmup.passed, may_offer: params.warmup.may_offer}} : {}),
            ...(params.debateHandOver !== undefined
                ? {debate: {may_offer: Boolean(params.debateOffer), may_hand_over: params.debateHandOver}}
                : params.debateOffer
                ? {debate: {may_offer: true, ...(params.secondOpinion ? {second_opinion: true} : {})}}
                : {})
        }
        : null;
    const report = params.stepReport && open
        ? `step_report — they have just tapped "I did it" on companion.open_trial: their message is how it went, in their own words.${
            stepReportMediaLine(params.stepReport)
        }${stepReportDebateLine(params.stepReport)} Judge it as the rules for reporting back say.`
        : "";
    return [
        companion ? `companion — what you and your owner are working on:\n${JSON.stringify(companion)}` : "",
        report,
        params.roster.length > 0
            ? `other_animals — your owner's other animals and their lessons, for a referral or a debate offer only:\n${
                JSON.stringify(params.roster.map((entry) => ({
                    key: entry.key,
                    animal: entry.animal,
                    ...(entry.nickname ? {name: entry.nickname} : {}),
                    power: entry.power,
                    ...(entry.lesson ? {lesson: entry.lesson} : {})
                })))
            }`
            : ""
    ].filter(Boolean);
}

/** Another animal sent them here: the opening goes straight into it. */
export const REFERRAL_OPENING_RULES = [
    "referral_opening — they brought companion.referral to you from another of their animals, and they have just",
    "opened your conversation. Speak first:",
    "- Say in a few words that you heard what is going on, then go straight into your take on it, from your lesson.",
    "  No introduction of yourself, no asking them to explain it.",
    "- As long as the help needs, in your own manner, then one question or one step to get them moving. When",
    "  companion.chosen_way is there, it is the step, set from that way as its rule says, with its TRIAL line.",
    "- Then the follow-ups line, and 2-3 short replies they might send, each under 60 characters, written AS THEM."
];

/** A voice call that may hand a debate to the chat (3.2, SPEC section 6): the same one-time offer, spoken. Stable: system prompt. Verbatim. */
export const CALL_DEBATE_RULES = [
    "Other animals' ways, by voice (companion.debate): only while companion.debate.may_offer is true, at most once in",
    "this call, and only after your own verdict on a real problem of theirs, you may ask in your own words whether",
    "they would like to hear how other animals would handle it. You may name up to three of your owner's other animals",
    "from other_animals, by the names other_animals gives; never anyone else's. Never in small talk, never while they",
    "are telling you about something hard or anyone is hurting them. When you make the offer, write DEBATE_OFFER.",
    "If they say yes, or ask for it themselves, and companion.debate.may_hand_over is true, say in your own words that",
    "you will bring the others into their chat after the call: the debate happens there, not on the call. Then write",
    "DEBATE. If may_hand_over is false, say plainly, as yourself, that it can't happen today. Never run the debate on",
    "the call, never speak for the other animals, and never suggest posting it publicly."
];

/** The call's hidden lines for a debate, after the follow-ups (never spoken). Verbatim. */
export const CALL_DEBATE_OUTPUT_LINES = [
    "5. Then, only for what this reply actually did, one hidden line each (never shown or spoken):",
    "   DEBATE_OFFER: <their problem in one line, from their side> (you just offered other animals' ways)",
    "   DEBATE: <their problem in one line, from their side> | <keys from other_animals you named or have in mind,",
    "   comma-separated, or nothing> (they said yes)"
];

function clip(value: string, max: number): string {
    const cleaned = value.replace(/\s+/g, " ").trim();
    return cleaned.length > max ? `${cleaned.slice(0, max).trimEnd()}…` : cleaned;
}

/**
 * What the animal's debate marker says: the problem it heard and the keys of
 * the owner's animals it named. The marker is never drawn; this is for the
 * `done` event. Null when the reply carries no debate marker. The apps'
 * `parseDebateMarker` (`animal-debate.ts`).
 */
export function parseDebateMarker(answer: string): {problem: string | null; keys: string[]} | null {
    const fence = /```animaldex-card\s*([\s\S]*?)```/g;
    for (let match = fence.exec(answer); match; match = fence.exec(answer)) {
        let card: Record<string, unknown> | null = null;
        try {
            const parsed: unknown = JSON.parse(match[1].trim());
            card = parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : null;
        } catch {
            card = null;
        }
        if (card?.kind !== "debate") continue;
        const problem = typeof card.problem === "string" ? clip(card.problem, 300) : "";
        const keys = Array.isArray(card.with)
            ? Array.from(new Set(card.with.filter((key): key is string => typeof key === "string").map((key) => key.trim().toLowerCase())))
                .filter((key) => /^a\d+$/.test(key)).slice(0, 3)
            : [];
        return {problem: problem.length >= 10 ? problem : null, keys};
    }
    return null;
}

/**
 * The problem a debate the animal offers is about (debate_offer.problem and a
 * call's debate_request.problem; owner, 2026-10-31): its focus with them
 * ("Working on: ..."), the one it sets in this very reply first (a new focus
 * replaces the old one), else the problem it wrote with the offer. The apps'
 * `debateOfferProblem`.
 */
export function debateOfferProblem(
    state: CompanionState | null | undefined,
    lines: Pick<CompanionLines, "focus"> | null | undefined,
    written: string | null
): string | null {
    return lines?.focus?.trim() || state?.focus?.focus?.trim() || written;
}

/** `debate_chat_state` read the server's way: whether the offer may be made now, and whether a call may hand one to the chat. */
export type DebateChatState = {offer: boolean; handOver: boolean};

export const NO_DEBATE: DebateChatState = {offer: false, handOver: false};

/**
 * The switch is on, this animal has not hosted one on this problem (since its
 * focus was set, and at least today) and a private debate is still free today:
 * a call may hand one over. The offer also needs it not to have been offered
 * on this problem already, in a chat or on a call. The apps'
 * `loadDebateChatState`, less the read.
 */
export function debateChatState(raw: unknown): DebateChatState {
    if (!raw || typeof raw !== "object") return NO_DEBATE;
    const state = raw as Record<string, unknown>;
    const handOver = state.enabled === true && state.debated_this_problem !== true && Number(state.private_left ?? 0) > 0;
    return {offer: handOver && state.offered_this_problem !== true, handOver};
}

/** The owner's animals a marker or a DEBATE line named, for the app to pre-select (only ever the owner's own: other_animals). */
export type DebateOfferAnimal = {capture_id: string; species_profile_id: string; animal: string; nickname: string | null};

/** The apps' `debateOfferAnimals` (`animal-debate.ts`). */
export function debateOfferAnimals(keys: string[], roster: CompanionRosterEntry[]): DebateOfferAnimal[] {
    const seen = new Set<string>();
    return keys.flatMap((key) => {
        const entry = resolveReferral(key, roster);
        if (!entry || seen.has(entry.capture_id)) return [];
        seen.add(entry.capture_id);
        return [{capture_id: entry.capture_id, species_profile_id: entry.species_profile_id, animal: entry.animal, nickname: entry.nickname}];
    });
}

/** The bond as the client is sent it in `done.bond` (the apps' `bondForClient`). */
export function bondForClient(bond: CompanionBond): Record<string, unknown> {
    return {
        stage: bond.stage ?? null,
        stage_index: bond.stage_index ?? 0,
        stage_label: bond.stage_label ?? null,
        // The bond with the animal (20261028150000): one level per animal, its strands.
        ...(typeof bond.level === "number" ? {level: bond.level} : {}),
        ...(bond.mastered === true ? {mastered: true} : {}),
        ...(bond.strands ? {strands: bond.strands} : {})
    };
}

/** The `done` event's `companion.open_step` (3.2): the open step the chat pins. The apps' `CompanionOpenStep`. */
export type CompanionOpenStep = {id: string; step: string; accepted_at: string | null; trial_frequency: string | null};

/** `companion.open_step` from the step object, in the edge function's shape. The apps' `openStepForClient`. */
export function openStepForClient(open: CompanionOpenTrial | null | undefined): CompanionOpenStep | null {
    return open
        ? {id: open.id, step: open.step, accepted_at: open.accepted_at ?? null, trial_frequency: open.trial_frequency ?? null}
        : null;
}

/**
 * What the writes changed, for `done`: `companion` (the loop now) in the
 * server's shape, and the event this reply made. The apps' tail of
 * `applyCompanionLines`.
 */
export function companionDoneFields(params: {
    focus: string | null;
    openStep: CompanionOpenTrial | null;
    yourTrialsDone: number;
    event: Record<string, unknown>;
    bond?: CompanionBond | null;
}): Record<string, unknown> {
    return {
        ...(params.bond ? {bond: bondForClient(params.bond)} : {}),
        companion: {
            focus: params.focus,
            open_trial: params.openStep?.step ?? null,
            open_step: openStepForClient(params.openStep),
            your_trials_done: params.yourTrialsDone,
            ...params.event
        }
    };
}

/**
 * The second opinion (strategy 2026-11-04, SPEC 3.3; the apps'
 * `secondOpinionFields`): after a take on an idea or a decision, the debate
 * offer is "Hear two more of your animals". The offer names two, and a free
 * account gets one a day, past which the client opens the Pro paywall
 * (trigger second_opinion).
 */
export const SECOND_OPINION_LABEL = "Hear two more of your animals";
export const SECOND_OPINION_FREE_PER_DAY = 1;

export function secondOpinionFields(params: {isPro: boolean; privateDebatesToday: number | null}): Record<string, unknown> {
    const pastFree = !params.isPro && params.privateDebatesToday !== null && params.privateDebatesToday >= SECOND_OPINION_FREE_PER_DAY;
    return {kind: "second_opinion", label: SECOND_OPINION_LABEL, paywall: pastFree ? "second_opinion" : null};
}
