/**
 * Ask AnimalDex about one Trial, ported from the iOS source of truth
 * (`TrialJournalAsk` and the Trial mode of `AnimalPowerAskChatView`).
 *
 * The assistant is grounded on the Trial the person is looking at — what it
 * asks, the rule, why this animal — and told to stay on it. A Trial
 * conversation is its own thread, keyed separately from the animal's Power
 * thread, so asking about the Trial never continues a chat about the species.
 */

import type {AnimalTrial} from "@/lib/animal-trials";
import type {AskSuggestion} from "@/lib/ask-animaldex/subject";

export const TRIAL_ASK_PLACEHOLDER = "Ask about this Trial…";
export const TRIAL_ASK_EMPTY_HEADING = "What do you want to know about this Trial?";
export const TRIAL_ASK_LOCKED_SUBTITLE = "Ask what this Trial means and for examples. Included with AnimalDex Pro.";
export const TRIAL_ASK_CAPTURE_REQUIRED = "Capture this animal before asking about its Trial.";

/** Openers for a blank Trial thread. All of them show, not the usual three. */
export const TRIAL_ASK_SUGGESTIONS: AskSuggestion[] = [
    {title: "What does this mean?", prompt: "What does this Trial mean, in plain language?"},
    {title: "Give me an example", prompt: "Give me a concrete example of doing this Trial well."},
    {title: "How do I start?", prompt: "How should I start this Trial today?"},
    {title: "What's the benefit?", prompt: "What's the benefit of doing this Trial?"}
];

/** Offered when the model returns none, so a Trial thread never dead-ends. */
export const TRIAL_ASK_FALLBACK_FOLLOW_UPS = [
    "Explain what this Trial is asking",
    "Give an example of doing it well",
    "Show what the evidence should look like"
];

/** The three waiting lines a Trial question shows, in order. */
export const TRIAL_ASK_THINKING_PHASES = [
    "Reading this Trial…",
    "Finding an example…",
    "Putting the answer together…"
];

function line(key: string, value: string | null | undefined) {
    const trimmed = value?.trim();
    return trimmed ? `${key}: ${trimmed}` : null;
}

/** What the model is told about the Trial. Newline-joined `key: value` lines. */
export function trialAskBrief(trial: AnimalTrial) {
    return [
        `frequency: ${trial.frequency}`,
        `title: ${trial.title}`,
        line("what_you_get", trial.userBenefit),
        line("what_to_do", trial.instructions),
        line("the_rule", trial.animalRule),
        line("why_this_trial", trial.principleLink),
        line("why_this_animal", trial.whyThisAnimal),
        line("evidence", trial.proofPrompt),
        trial.successCriteria.length ? `success: ${trial.successCriteria.join(" | ")}` : null
    ].filter((entry): entry is string => Boolean(entry)).join("\n");
}

/** The thread for one person's questions about one Trial. */
export function trialAskKey(trial: Pick<AnimalTrial, "speciesProfileId" | "frequency">) {
    return `${trial.speciesProfileId.toLowerCase()}:ASK:${trial.frequency}`;
}

// MARK: - Writing it instead (Apply It Your Way)

export function journalAskSuggestions(domainTitle: string, trial: AnimalTrial | null): AskSuggestion[] {
    const subject = trial ? "this Trial" : "this Power";
    return [
        {title: "How do I write this?", prompt: `How do I journal ${subject} in writing, instead of doing the challenge?`},
        {title: "What should I include?", prompt: `What should my written account include so it counts for ${subject}?`},
        {
            title: `Example in ${domainTitle}`,
            prompt: `Give me an example journal entry for ${subject} in ${domainTitle}. This is written evidence instead of doing the challenge.`
        }
    ];
}

/** The brief for the written route: either standing in for a Trial, or applying the Power itself. */
export function journalAskBrief(input: {
    power: {principleName: string; speciesDisplayName: string; coreLesson: string | null};
    trial: AnimalTrial | null;
    domainTitle: string;
}) {
    if (input.trial) {
        const trial = input.trial;
        return [
            "route: written journal",
            "intent: Help the person write a journal entry that stands in for doing this Trial. Explain how to write it, what to include, and give a concrete example in the named domain.",
            `domain: ${input.domainTitle}`,
            `frequency: ${trial.frequency}`,
            `title: ${trial.title}`,
            line("what_you_get", trial.userBenefit),
            line("what_to_do", trial.instructions),
            line("the_rule", trial.animalRule),
            line("why_this_trial", trial.principleLink)
        ].filter((entry): entry is string => Boolean(entry)).join("\n");
    }
    return [
        "route: written journal",
        "intent: Help the person write a journal entry that applies this Power, instead of doing a Trial. Explain how to write it, what to include, and give a concrete example in the named domain.",
        `domain: ${input.domainTitle}`,
        `power: ${input.power.principleName}`,
        `animal: ${input.power.speciesDisplayName}`,
        line("lesson", input.power.coreLesson)
    ].filter((entry): entry is string => Boolean(entry)).join("\n");
}

export function journalAskKey(speciesProfileId: string, trial: AnimalTrial | null) {
    return `${speciesProfileId.toLowerCase()}:${trial ? `JOURNAL:${trial.frequency}` : "JOURNAL"}`;
}
