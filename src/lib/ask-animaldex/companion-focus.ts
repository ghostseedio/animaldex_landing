/**
 * The companion loop, the server half (AnimalDex 20261028120000; owner,
 * 2026-10-28: "capture animal - talk to it - work through personal problems
 * together").
 *
 * With its owner, the animal quietly finds the one thing in their life its
 * lesson can help with (its focus), sets them a concrete step on it (Your
 * Trial: the personal route, never named as such), and when they say they did
 * it, says well done, which completes it, grows the bond and can earn the
 * Power. A problem that is clearly another animal's lesson is handed to that
 * animal, with the problem, so the person never explains it twice.
 *
 * None of it is a form or a mode. The animal judges all of it in the reply it
 * is writing anyway, and records what it did in hidden lines after its
 * follow-ups: FOCUS, TRIAL, DONE, REFER. The server takes them out (the reader
 * never sees them), writes them, and reports what changed in the `companion`
 * field of `done`.
 *
 * Port of the apps' `supabase/functions/_shared/animal-focus.ts`. The rule
 * text is carried across verbatim, less the step cards the website does not
 * have. Pure: no `server-only`, no fetching, so the prompt builders and their
 * tests can use it.
 */

import {ASK_FOLLOW_UP_SENTINEL} from "@/lib/ask-animaldex/prompt";

export type CompanionFocus = {id: string; focus: string; since?: string | null};
export type CompanionOpenTrial = {id: string; step: string; set_at?: string | null};
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

const PREFIXES = ["FOCUS:", "TRIAL:", "DONE:", "REFER:"] as const;

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
    const lines: CompanionLines = {focus: null, trial: null, done: null, refer: null};
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
            ? {id: open.id, step: open.step, set_at: typeof open.set_at === "string" ? open.set_at : null}
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
 * `offersSteps` false: the person asked not to be offered steps. The apps'
 * text, less "with its card" and owner_progress: the website has no step
 * cards.
 */
export function companionLoopRules(params: {offersSteps: boolean}): string[] {
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
                "  the conversation. Never call it a Trial, a challenge, a task, homework or Apply It Your Way, and never make",
                "  it sound like a form. One at a time: while companion.open_trial is open, do not set another unless they have",
                "  clearly moved on from it or it no longer fits.",
                "- Most steps need no proof: what they tell you is enough. Only when a step naturally leaves something they could",
                "  show you (something made, written, somewhere they went) may you ask to see it; never insist.",
                "- If they want a challenge but have not shared anything personal, or ask for one, offer your Animal Trial."
            ]
            : [
                "- They have asked not to be offered steps. Help in conversation only: set no steps unless they ask for one in",
                "  this message."
            ]),
        "- When they tell you how companion.open_trial went: if they really did it — it happened, they can say something",
        "  about how, even if it went badly — tell them well done, in your own way and as only you would, and what it",
        "  shows about them through your lesson. If they only say they did it, ask how it went first. If they have not",
        "  done it yet, or did something else, do not count it: encourage, or adjust the step.",
        "- companion.your_power says where your Power stands. Until it is earned, their first completed step earns it —",
        "  once they have passed your lesson check. So when you congratulate them and lesson_check_passed is false, say in",
        "  a line that your lesson check is all that stands between them and your Power, and offer it. When",
        "  power_just_earned is true, they have just earned it: tell them, as yourself, once.",
        "- When the heart of a problem is really another animal's lesson: give your own take from your lesson first. Then,",
        "  only if one of other_animals has a lesson that clearly fits it better, suggest they talk to that one — by its",
        "  name, in a sentence, saying why its way fits — and that you'll tell it what is going on so they don't have to",
        "  explain again. Only animals in other_animals, at most once for a problem, and never to get rid of them.",
        "- companion.referral: another of their animals sent them to you about it. You already know what it is: go",
        "  straight into your take on it, from your lesson. Never ask them to explain it again.",
        "- Never push. If they want to talk, talk. At most one step or suggestion in a reply; if they ignore or decline",
        "  one, leave it for the rest of this conversation."
    ];
}

/**
 * The hidden lines, in the streamed output shape after the follow-ups. Step 4
 * here: the website's output shape has no story line (the apps' step 4).
 */
export const COMPANION_OUTPUT_LINES = [
    "4. Then, only for what this reply actually did, one hidden line each (never shown to anyone):",
    "   FOCUS: <what you are helping them with, a few words from their side, e.g. 'Speaking up first in meetings'>",
    "   TRIAL: <the step you just set them, one plain sentence> | <days before you would check how it went, 1-14>",
    "   DONE: <what they did on companion.open_trial, one sentence, third person>",
    "   REFER: <the key from other_animals> | <the problem in one or two sentences, third person, all the other animal",
    "   needs so they never have to explain it again>"
];

/** The loop as it stands, and who else they could be sent to. Per turn. */
export function companionPromptLines(params: {
    state: CompanionState | null;
    roster: CompanionRosterEntry[];
    powerEarned: boolean;
    lessonCheckPassed: boolean;
    powerJustEarned?: boolean;
}): string[] {
    const {state} = params;
    const companion = state
        ? {
            focus: state.focus?.focus ?? null,
            open_trial: state.open_trial ? {step: state.open_trial.step, set: state.open_trial.set_at?.slice(0, 10) ?? null} : null,
            steps_done_together: state.your_trials_done,
            recent_done: state.recent_done.map((done) => done.step),
            referral: state.referral
                ? {from: state.referral.from_animal, problem: state.referral.problem}
                : null,
            your_power: params.powerEarned || params.powerJustEarned ? "earned" : "not earned yet",
            lesson_check_passed: params.lessonCheckPassed,
            ...(params.powerJustEarned ? {power_just_earned: true} : {})
        }
        : null;
    return [
        companion ? `companion — what you and your owner are working on:\n${JSON.stringify(companion)}` : "",
        params.roster.length > 0
            ? `other_animals — your owner's other animals and their lessons, for a referral only:\n${
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

/**
 * What the writes changed, for `done`: `companion` (the loop now) in the
 * server's shape, and the event this reply made. The apps' tail of
 * `applyCompanionLines`.
 */
export function companionDoneFields(params: {
    focus: string | null;
    openTrial: string | null;
    yourTrialsDone: number;
    event: Record<string, unknown>;
    bond?: CompanionBond | null;
}): Record<string, unknown> {
    return {
        ...(params.bond ? {bond: bondForClient(params.bond)} : {}),
        companion: {
            focus: params.focus,
            open_trial: params.openTrial,
            your_trials_done: params.yourTrialsDone,
            ...params.event
        }
    };
}
