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

export type CompanionFocus = {id: string; focus: string; since?: string | null};
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

/** `animal_companion_state`: what the animal knows of the loop with its owner. */
export type CompanionState = {
    focus: CompanionFocus | null;
    open_trial: CompanionOpenTrial | null;
    your_trials_done: number;
    recent_done: Array<{step: string; done_at?: string | null; evidence?: string | null}>;
    referral: CompanionReferral | null;
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
    const lines: CompanionLines = {focus: null, trial: null, done: null, refer: null, debate: null, debateOffered: false};
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
            lines.done ??= text(body, 400) ?? "done";
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
            ? {id: focus.id, focus: focus.focus, since: typeof focus.since === "string" ? focus.since : null}
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
                "  clearly moved on from it, it no longer fits, or they ask you for a different one.",
                "- What they tell you is enough. Never ask for proof or to see anything. A photo or video they add goes into",
                "  their own record; when step_report says what it shows (proof.seen), you may react to that as if you had seen",
                "  it, using only what proof.seen says and adding no detail of your own. Whatever it shows, their word stands:",
                "  never doubt them because of it, and never mention a check, a bonus or XP.",
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
                "  ask for one in this message."
            ]),
        "- When they tell you how companion.open_trial went (step_report says they have just reported it, and why):",
        "  if they did it, or an honest version of it — it happened, even if it went badly or only partly — tell them well",
        "  done, in your own way and as only you would, and what it shows about them through your lesson. If what they did",
        "  was something else that still does your lesson, it counts the same. Either way, write the DONE line.",
        "  If what they say is too vague to tell what happened, ask them one specific question about it, the one only you",
        "  would ask. Never refuse it, never say it does not count, and never mention attempts, limits, waiting or",
        "  tomorrow. If they have not done it yet, encourage them, or change the step if it does not fit.",
        "- companion.your_power says where your Power stands. Until it is earned, the first step they finish with you",
        "  earns it. When power_just_earned is true, they have just earned it: tell them, as yourself, once. After a step",
        "  is done, talk about what it showed; do not reach for your Warmup or any card as the next thing.",
        "- When the heart of a problem is really another animal's lesson: give your own take from your lesson first. Then,",
        "  only if one of other_animals has a lesson that clearly fits it better, suggest they talk to that one — by its",
        "  name, in a sentence, saying why its way fits — and that you'll tell it what is going on so they don't have to",
        "  explain again. Only animals in other_animals, at most once for a problem, and never to get rid of them.",
        "- companion.referral: another of their animals sent them to you about it. You already know what it is: go",
        "  straight into your take on it, from your lesson. Never ask them to explain it again. If it says they chose",
        "  another animal's way in a debate, help them do that way: when it is your way, your take is how to do it in",
        "  their life; when it is another animal's (one they have not caught), turn that animal's way into one step for",
        "  them, in your own words, and say the step starts with that animal's way.",
        ...(params.debates && params.offersSteps
            ? [
                "- Other animals' ways (companion.debate): only while companion.debate.may_offer is true — your Power is earned",
                "  and they have brought a real problem of their own, a decision, a conflict or something they keep running",
                "  into — you may offer once, after giving your own verdict, to let other animals weigh in. In a reply where you",
                "  may, this offer comes first: make it instead of setting a new step or offering your Trials or Warmup in that",
                "  reply; those can wait. The offer is yours:",
                "  ask in your own words, inside your reply, whether they would like to hear how other animals would handle it.",
                "  You may name up to three of your owner's other animals from other_animals whose ways would differ from yours,",
                "  by the names other_animals gives; never name anyone else's animals. Then end the reply with the debate marker.",
                "  The app puts two quick replies under your message, so never mention buttons or cards. Never in small talk,",
                "  never while they are telling you about something hard (a loss, fear, feeling alone) or anyone is hurting",
                "  them, and never instead of your own answer. Once for a problem: if they let it pass or say no, leave it.",
                "  Without companion.debate, do not offer it."
            ]
            : []),
        "- Never push. If they want to talk, talk. At most one step or suggestion in a reply; if they ignore or decline",
        "  one, leave it for the rest of this conversation."
    ];
}

/**
 * The hidden lines, in the streamed output shape after the follow-ups: step
 * 5, after the animal's own story line (step 4), as in the apps.
 */
export const COMPANION_OUTPUT_LINES = [
    "5. Then, only for what this reply actually did, one hidden line each (never shown to anyone):",
    "   FOCUS: <what you are helping them with, a few words from their side, e.g. 'Speaking up first in meetings'>",
    "   TRIAL: <the step you just set them, one plain sentence> | <days before you would check how it went, 1-14>",
    "   DONE: <what they did on companion.open_trial, one sentence, third person>",
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
export type CompanionStepReport = {media: string | null; proof?: CompanionStepProof | null};

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
}): string[] {
    const {state} = params;
    const open = state?.open_trial ?? null;
    const companion = state
        ? {
            focus: state.focus?.focus ?? null,
            open_trial: open
                ? {
                    step: open.step,
                    set: open.set_at?.slice(0, 10) ?? null,
                    accepted: Boolean(open.accepted_at),
                    ...(open.trial_frequency ? {from_your_trial: open.trial_frequency} : {})
                }
                : null,
            steps_done_together: state.your_trials_done,
            recent_done: state.recent_done.map((done) => done.step),
            referral: state.referral
                ? {from: state.referral.from_animal, problem: state.referral.problem}
                : null,
            your_power: params.powerEarned || params.powerJustEarned ? "earned" : "not earned yet",
            ...(params.powerJustEarned ? {power_just_earned: true} : {}),
            ...(params.warmup?.available ? {warmup: {passed: params.warmup.passed, may_offer: params.warmup.may_offer}} : {}),
            ...(params.debateHandOver !== undefined
                ? {debate: {may_offer: Boolean(params.debateOffer), may_hand_over: params.debateHandOver}}
                : params.debateOffer
                ? {debate: {may_offer: true}}
                : {})
        }
        : null;
    const report = params.stepReport && open
        ? `step_report — they have just tapped "I did it" on companion.open_trial: their message is how it went, in their own words.${
            stepReportMediaLine(params.stepReport)
        } Judge it as the rules for reporting back say.`
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
    "referral_opening — another of your owner's animals sent them to you about companion.referral, and they have just",
    "opened your conversation. Speak first:",
    "- Say in a few words that you heard what is going on, then go straight into your take on it, from your lesson.",
    "  No introduction of yourself, no asking them to explain it.",
    "- As long as the help needs, in your own manner, then one question or one step to get them moving.",
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
