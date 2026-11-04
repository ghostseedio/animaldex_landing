// What AnimalDex's generated public content never says (Nov 2026 strategy):
// blog topics and articles, trend-radar ideas, carousels and text posts.
// - No other AI product by name: the take is shown against "the usual
//   answer", never against a named assistant (store rules bar them too).
// - Nothing clinical: AnimalDex is not therapy and never says so.
// - No "life advice" or "self-improvement" framing: the help is felt, not labelled.
// - No psychological labels for people ("overthinker", "people-pleaser", an
//   MBTI type): a trait is shown as an animal's behaviour instead.
// The prompts carry CONTENT_POLICY_RULES; policyProblems() is the check that
// holds a reply to them, so a slip is dropped rather than published.

export const CONTENT_POLICY_RULES = `Never name another AI product or assistant (no ChatGPT, Gemini, Claude, Copilot, Perplexity or any other): contrast the animal's take with "the usual answer". No clinical words, ever: therapy, anxiety, depression, trauma, heal or healing, mental health, diagnosis; AnimalDex is not therapy. No "life advice", "self-improvement" or "self-help" framing: show the idea through the animal and let the reader take it. Never put a psychological label on a person (overthinker, people-pleaser, perfectionist, procrastinator, introvert, extrovert, empath, narcissist, an MBTI type like INFJ): describe what the animal does instead.`;

export type PolicyKind = "ai_product" | "clinical" | "life_advice" | "label";

type Rule = {kind: PolicyKind; pattern: RegExp};

const RULES: Rule[] = [
    // "Gemini" and "Claude" alone are a star sign and a first name: only with an AI context.
    {kind: "ai_product", pattern: /\b(chat\s?gpt|openai|gpt-?[345](?:\.\d)?o?|copilot|perplexity(?:\s+ai)?|anthropic|claude(?:\.ai|\s+ai|\s+(?:opus|sonnet|haiku))|google\s+gemini|gemini\s+(?:ai|app|advanced|chat)|google\s+bard|character\.?\s?ai|replika|meta\s+ai|grok\s+ai|deepseek)\b/i},
    {kind: "clinical", pattern: /\b(therap(?:y|ies|ist|ists|eutic)|anxiety|anxious|depress(?:ion|ed|ive)|trauma(?:s|tic|tised|tized)?|ptsd|adhd|ocd|bipolar|mental[- ]health|mental illness|diagnos(?:e|es|is|ed)|psychiatr\w*|heal(?:s|ed|ing)?)\b/i},
    {kind: "life_advice", pattern: /\b(life[- ]advice|self[- ]improvement|self[- ]help|self[- ]care|life[- ]coach(?:es|ing)?|personal growth)\b/i},
    {kind: "label", pattern: /\b(over[- ]?think(?:er|ers|ing)|people[- ]pleas(?:er|ers|ing)|perfectionists?|procrastinators?|introvert(?:s|ed)?|extrovert(?:s|ed)?|ambiverts?|empaths?|narcissis(?:t|ts|tic|m)|codependen(?:t|cy|ce)|attachment styles?|[ie][ns][ft][jp])\b/i}
];

const LABELS: Record<PolicyKind, string> = {
    ai_product: "names another AI product",
    clinical: "clinical word",
    life_advice: "life-advice framing",
    label: "psychological label"
};

export type PolicyFinding = {kind: PolicyKind; word: string};

/** Each distinct word the text breaks a rule with, by rule. */
export function policyFindings(...texts: Array<string | null | undefined>): PolicyFinding[] {
    const text = texts.filter(Boolean).join("\n");
    const findings: PolicyFinding[] = [];
    for (const rule of RULES) {
        const match = new RegExp(rule.pattern.source, "gi");
        const found = new Set(Array.from(text.matchAll(match), (hit) => hit[0].toLowerCase()));
        for (const word of Array.from(found)) findings.push({kind: rule.kind, word});
    }
    return findings;
}

export function describeFinding(finding: PolicyFinding) {
    return `${LABELS[finding.kind]}: "${finding.word}"`;
}

/** Every rule the text breaks, e.g. `clinical word: "anxiety"`; empty when it is clean. */
export function policyProblems(...texts: Array<string | null | undefined>): string[] {
    return policyFindings(...texts).map(describeFinding);
}

/** True when the text breaks no rule. */
export function passesContentPolicy(...texts: Array<string | null | undefined>) {
    return policyProblems(...texts).length === 0;
}
