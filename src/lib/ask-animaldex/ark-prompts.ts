/**
 * Life Sim's prompt side on the web's own chat (AnimalDex
 * docs/life-sim/CONTRACT.md, sections 4, 5, 6 and 7), mirrored from the
 * contract for the apps' edge lane to hold to the same words:
 *
 *   - section 5: the one fast JSON call that tags a step saved from a chat
 *     reply (size, costs, sensitive, story, reaction);
 *   - section 6: what the post-reply memory call adds (the person's revealed
 *     steps from every animal, `step_outcomes`, `focus_sensitive`);
 *   - section 4: the revisions the animal has not mentioned yet, fed into its
 *     next reply;
 *   - section 7: a visitor never hears about the owner's diary, stats or
 *     problems (only approved public summaries, when the diary is public).
 *
 * Pure: the server helpers (`ark-server.ts`) and the prompt builders use it,
 * and the tests read it. The model writes every word an animal says; these
 * only ask for it and read back what it returned, tolerantly.
 */

export type ArkTagCost = "money" | "relationships" | "energy" | "reputation";
export const ARK_TAG_COSTS: readonly ArkTagCost[] = ["money", "relationships", "energy", "reputation"];

/** Section 5's answer, as stored by `set_animal_step_sim_tags`. */
export type ArkStepTags = {
    size: "small" | "medium" | "large";
    costs: ArkTagCost[];
    sensitive: boolean;
    story: string[];
    reaction: string;
};

function clean(raw: unknown, max: number): string {
    return typeof raw === "string" ? raw.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

/**
 * The tag call (section 5): one fast JSON call when a step is saved, fire and
 * forget. A debate way's step sends that way's `costs` and `fits_when`.
 */
export function buildStepSimTagPrompts(params: {
    animalName: string;
    /** The animal's Power, the lesson the step comes from, when known. */
    power?: string | null;
    /** The problem the step is for (`animal_companion_focus`), in the owner's words as the animal noted it. */
    problem: string | null;
    step: string;
    /** A debate way's report fields, when the step came from a debate. */
    way?: {costs?: string | null; fitsWhen?: string | null} | null;
    /** Teen mode: the story stays light and everyday. */
    teen?: boolean;
}): {system: string; user: string} {
    return {
        system: [
            "You tag one step an animal in AnimalDex has just set a person, for the app's life simulation. Code works out",
            "every number from your tags; you never write a number for a stat.",
            "Return ONLY JSON:",
            '{"size":"small|medium|large","costs":["money"|"relationships"|"energy"|"reputation"],"sensitive":boolean,',
            ' "story":[string,string,string],"reaction":string}',
            "- size: how big the step is in their life. small = a quick, low-stakes thing (a message, ten minutes);",
            "  medium = a real effort or a real conversation; large = a big decision, real money or a lasting change.",
            "  When unsure, medium.",
            "- costs: what doing it is likely to cost them, from the step itself and, when given, the way's costs. Only",
            "  clear costs: spending or risking money → money; straining or risking a relationship → relationships; tiring",
            "  or time-consuming → energy; risking how others see them → reputation. Usually zero or one. Never all four.",
            "- sensitive: true when the problem involves bereavement or grief, serious illness (theirs or someone close),",
            "  abuse, self-harm or a crisis, or persistent hopelessness. Not for ordinary hard problems (a breakup, losing a",
            "  job, money stress, a bad day). When unsure, true. When true, story is [] and reaction is \"\".",
            "- story: two or three short beats (each under 140 characters) of what happens as they do it, in the animal's",
            "  own voice, speaking to them (\"you\"), present tense, no timeline (no 'a week later'), no numbers for stats,",
            "  no scores. A real amount from the problem ('£600') may appear in a beat; never a new one.",
            "- reaction: the animal's one line (under 120 characters) on hearing they will do it, in its own voice and",
            "  manner, from its kind's way of living. Not praise for its own sake, not 'Completed'.",
            ...(params.teen ? ["- They are 13 to 17: keep the story light, safe and everyday."] : []),
            "- Write story and reaction in the language the step is written in."
        ].join("\n"),
        user: [
            `animal: ${params.animalName}`,
            params.power ? `its_power: ${params.power}` : "",
            `problem: ${params.problem?.trim() || "(not noted)"}`,
            `step: ${params.step}`,
            params.way?.costs ? `way_costs: ${params.way.costs}` : "",
            params.way?.fitsWhen ? `way_fits_when: ${params.way.fitsWhen}` : ""
        ].filter(Boolean).join("\n")
    };
}

/** The tag call's JSON, or null when it does not read. Anything malformed is dropped; a sensitive answer carries no story. */
export function parseStepSimTags(raw: unknown): ArkStepTags | null {
    const row = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : null;
    if (!row) return null;
    const sizeWire = clean(row.size, 12).toLowerCase();
    const size = sizeWire === "small" || sizeWire === "large" ? sizeWire : "medium";
    const costs = Array.from(new Set((Array.isArray(row.costs) ? row.costs : [])
        .map((cost) => clean(cost, 20).toLowerCase())
        .filter((cost): cost is ArkTagCost => (ARK_TAG_COSTS as readonly string[]).includes(cost))))
        .slice(0, 3);
    // When unsure, sensitive: anything but a plain false counts.
    const sensitive = row.sensitive !== false;
    if (sensitive) return {size, costs, sensitive: true, story: [], reaction: ""};
    const story = (Array.isArray(row.story) ? row.story : []).map((beat) => clean(beat, 200)).filter(Boolean).slice(0, 3);
    return {size, costs, sensitive: false, story, reaction: clean(row.reaction, 200)};
}

// MARK: - Section 6: the post-reply memory call

/** A step they took on in the last 30 days, from any of their animals: what a later chat may be about. */
export type ArkRecentStep = {id: string; step: string; animal: string; kind: "earned" | "lesson"};

export type ArkStepOutcome = {step_id: string; direction: "better" | "worse"; statement: string};

/** The memory call's message floor while they have a revealed step (section 6): "sold out!!" counts. */
export const ARK_MEMORY_MIN_CHARACTERS = 3;
/** And without one, as before. */
export const MEMORY_MIN_CHARACTERS = 20;

export function memoryMinCharacters(recentSteps: readonly ArkRecentStep[]): number {
    return recentSteps.length > 0 ? ARK_MEMORY_MIN_CHARACTERS : MEMORY_MIN_CHARACTERS;
}

/** The memory call's JSON schema line for the Ark's two keys. */
export const ARK_MEMORY_SCHEMA_LINE =
    ' "step_outcomes":[{"step_id":string,"direction":"better|worse|none","statement":string}], "focus_sensitive":boolean}';

/** The memory call's rules for the Ark's two keys, after its own rules. */
export const ARK_MEMORY_RULES = [
    "- step_outcomes: only for a step in recent_steps (from any of their animals, not just this one) that THIS exchange",
    "  says clearly how it actually went: better than expected (\"I got them for £400\", \"sold out in a weekend\") or",
    "  worse (\"nobody is buying\"). A hope, a plan or a maybe (\"I might get them cheaper\") is not an outcome: leave it",
    "  out. statement = their own words about it, at most 200 characters. direction none, or nothing, when unsure.",
    "  Never invent a step_id.",
    "- focus_sensitive: true when what they are working on now involves bereavement or grief, serious illness (theirs",
    "  or someone close), abuse, self-harm or a crisis, or persistent hopelessness. Not for ordinary hard problems (a",
    "  breakup, losing a job, money stress, a bad day). When unsure, true."
];

/** The memory call's user-prompt section for the steps a later chat may revise. */
export function arkRecentStepsSection(recentSteps: readonly ArkRecentStep[]): string {
    return `recent_steps — steps they took on in the last 30 days, from every animal:\n${
        recentSteps.length > 0 ? JSON.stringify(recentSteps.map((step) => ({id: step.id, step: step.step, animal: step.animal, kind: step.kind}))) : "(none)"
    }`;
}

/** `step_outcomes` and `focus_sensitive`, read back: only steps that were sent, only better or worse, each once. */
export function parseArkMemoryOutcomes(raw: unknown, recentSteps: readonly ArkRecentStep[]): {stepOutcomes: ArkStepOutcome[]; focusSensitive: boolean} {
    const row = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
    const known = new Set(recentSteps.map((step) => step.id.toLowerCase()));
    const seen = new Set<string>();
    const stepOutcomes = (Array.isArray(row.step_outcomes) ? row.step_outcomes : []).flatMap((item) => {
        const outcome = item && typeof item === "object" ? item as Record<string, unknown> : {};
        const stepId = clean(outcome.step_id, 64).toLowerCase();
        const direction = clean(outcome.direction, 10).toLowerCase();
        const statement = clean(outcome.statement, 200);
        if (!known.has(stepId) || seen.has(stepId) || (direction !== "better" && direction !== "worse") || !statement) return [];
        seen.add(stepId);
        return [{step_id: stepId, direction, statement} as ArkStepOutcome];
    });
    return {stepOutcomes: stepOutcomes.slice(0, 5), focusSensitive: row.focus_sensitive === true};
}

// MARK: - Section 4: the revision the animal mentions in its next reply

/** A revision it has not mentioned yet (`ark_unmentioned_revisions`), as it is put to the animal. */
export type ArkMentionRevision = {id: string; step: string | null; animal: string; direction: "better" | "worse"; statement: string | null};

/** The loop's rule for `ark_revisions`, beside the companion lines. */
export const ARK_REVISION_MENTION_RULE =
    "ark_revisions — earlier steps of theirs whose result was re-weighed since your last reply, from what they said. " +
    "Mention each once, briefly, in your own words and manner, as part of this reply (the sense of it: that it went " +
    "better than feared, or that it cost more than hoped). Never a number, a score or a stat name. Then carry on.";

/** The line the companion context carries, or "" when there is nothing to mention. */
export function arkRevisionPromptLine(revisions: readonly ArkMentionRevision[]): string {
    if (revisions.length === 0) return "";
    return `${ARK_REVISION_MENTION_RULE}\n${JSON.stringify(revisions.slice(0, 3).map((revision) => ({
        ...(revision.step ? {step: revision.step} : {}),
        animal: revision.animal,
        went: revision.direction,
        ...(revision.statement ? {they_said: revision.statement} : {})
    })))}`;
}

// MARK: - Section 7: visitors

/** After the visitor's rules: the owner's life stays theirs. Stable: system prompt. */
export const ANIMAL_VISITOR_ARK_PRIVACY_RULES = [
    "Your owner's diary, life stats, scores and problems are theirs: never mention them to a visitor, never hint at",
    "them, and never say how your owner is doing in life. If your_owner.public_diary lists summaries your owner",
    "approved, you may refer to those, in their words, and nothing beyond them; without it, there is nothing to share."
];
