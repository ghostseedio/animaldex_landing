/**
 * "Meet the {species}" captions: sentences taken word for word from the
 * species' stored field guide (`species_field_guide`), never written here.
 *
 * Only whole first sentences that fit on screen are used, and never one in
 * the Power's voice (principle, lesson, Power, teaches, rewards, "supports
 * the"): the clip shows the animal, not its lesson.
 */

/** The stored columns the captions may come from (read-only, as the database has them). */
export type ArkFieldGuide = {
    diet_summary: string | null;
    typical_habitat: string | null;
    sleep_pattern: string | null;
    lifespan_estimate: string | null;
    predators_summary: string | null;
    interesting_facts: string[] | null;
    signature_traits: string[] | null;
};

export const ARK_FIELD_GUIDE_COLUMNS = ["diet_summary", "typical_habitat", "sleep_pattern", "lifespan_estimate", "predators_summary", "interesting_facts", "signature_traits"] as const;

export type ArkFact = {label: string; text: string; source: (typeof ARK_FIELD_GUIDE_COLUMNS)[number]};

/** Longest caption kept (characters): about three lines at the caption size. */
export const MAX_FACT_LENGTH = 130;
const MIN_FACT_LENGTH = 12;

/** The Power's voice: a sentence about what the animal teaches, not what it is. */
const POWER_VOICE = /\b(principles?|lessons?|powers?|teach(?:es|ing)?|taught|rewards?|rewarded|rewarding)\b|\bsupports the\b/i;
/** Stored placeholders, not facts. */
const PLACEHOLDER = /^(unknown|n\/a|none|pending|tbd|not (?:known|recorded|available))\b/i;
/** Machine values stored in a text column ("Native range keys: sub_saharan_africa."): not for people. */
const MACHINE = /\b[a-z]+_[a-z_]+\b|\bkeys?:|[{}[\]<>|]|https?:\/\//i;

export function isPowerVoice(sentence: string): boolean {
    return POWER_VOICE.test(sentence);
}

/** Abbreviations whose full stop does not end a sentence. */
const ABBREVIATION = /\b(?:e\.g|i\.e|approx|ca|c|vs|etc|St|Mt|Dr|No|cm|mm|km|kg|in|ft|lb|oz|yr|yrs|sp|spp)\.$/i;

/** The first whole sentence, as stored (trimmed); null when it is too long, too short, a placeholder or in the Power's voice. */
export function firstSentence(text: string | null | undefined): string | null {
    const clean = (text ?? "").replace(/\s+/g, " ").trim();
    if (!clean || PLACEHOLDER.test(clean) || MACHINE.test(clean)) return null;
    let sentence = clean;
    for (const match of Array.from(clean.matchAll(/[.!?](?=\s+[A-Z\u201c"(])/g))) {
        const end = (match.index ?? 0) + 1;
        const head = clean.slice(0, end);
        if (ABBREVIATION.test(head)) continue;
        sentence = head;
        break;
    }
    if (!/[.!?]$/.test(sentence)) sentence = `${sentence}.`;
    if (sentence.length < MIN_FACT_LENGTH || sentence.length > MAX_FACT_LENGTH) return null;
    if (isPowerVoice(sentence)) return null;
    return sentence;
}

const LABELS: Record<ArkFact["source"], string> = {
    diet_summary: "Diet",
    typical_habitat: "Habitat",
    sleep_pattern: "Sleep",
    lifespan_estimate: "Lifespan",
    predators_summary: "Predators",
    interesting_facts: "Did you know?",
    signature_traits: "Look for"
};

/**
 * Up to `max` captions, in this order: diet, habitat, one interesting fact,
 * then sleep, lifespan, predators and signature traits as fallbacks. Each is
 * a stored sentence verbatim; nothing is reworded.
 */
export function pickArkFacts(guide: ArkFieldGuide | null, max = 3): ArkFact[] {
    if (!guide) return [];
    const facts: ArkFact[] = [];
    const seen = new Set<string>();
    const add = (source: ArkFact["source"], text: string | null | undefined) => {
        if (facts.length >= max) return;
        const sentence = firstSentence(text);
        if (!sentence) return;
        const key = sentence.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        facts.push({label: LABELS[source], text: sentence, source});
    };
    const list = (value: string[] | null | undefined) => (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);
    add("diet_summary", guide.diet_summary);
    add("typical_habitat", guide.typical_habitat);
    for (const fact of list(guide.interesting_facts)) {
        const before = facts.length;
        add("interesting_facts", fact);
        if (facts.length > before) break;
    }
    add("sleep_pattern", guide.sleep_pattern);
    add("lifespan_estimate", guide.lifespan_estimate);
    add("predators_summary", guide.predators_summary);
    for (const trait of list(guide.signature_traits)) add("signature_traits", trait);
    for (const fact of list(guide.interesting_facts)) add("interesting_facts", fact);
    return facts;
}
