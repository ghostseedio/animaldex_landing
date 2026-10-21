/**
 * What the animals remember about a signed-in reader, across conversations
 * and across animals. The same row the apps' edge function keeps
 * (`animal_chat_user_memory`), so a fact told to the Wolf in the app is known
 * to the Cheetah on the website. Port of the memory half of the apps'
 * `_shared/animal-voice.ts`; the prompt text is carried across verbatim.
 */


export type AskMemoryFact = {
    fact: string;
    /** The animal they told it to. */
    animal: string;
    /** ISO date. */
    noted_at: string;
    /**
     * "wild_profile" when the Wild Profile wrote it. Those facts are pinned:
     * chat never edits or drops them, only the person can forget them.
     */
    source?: "wild_profile";
    pinned?: boolean;
    /** What the Wild Profile learned (e.g. name, birthday), when it says. */
    kind?: string;
};

export const ASK_MEMORY_MAX_FACTS = 40;
const FACT_MAX_LENGTH = 160;

function clean(value: unknown, max: number): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.replace(/\s+/g, " ").trim();
    if (!trimmed) return null;
    return trimmed.length > max ? trimmed.slice(0, max).trimEnd() : trimmed;
}

export function parseAskMemoryFacts(raw: unknown, maxFacts = ASK_MEMORY_MAX_FACTS): AskMemoryFact[] {
    if (!Array.isArray(raw)) return [];
    const seen = new Set<string>();
    const facts: AskMemoryFact[] = [];
    for (const item of raw) {
        const row = item && typeof item === "object" ? item as Record<string, unknown> : null;
        const fact = clean(row?.fact, FACT_MAX_LENGTH);
        if (!fact) continue;
        const key = fact.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        const pinned = row?.pinned === true && row?.source === "wild_profile";
        const kind = pinned ? clean(row?.kind, 40) : null;
        facts.push({
            fact,
            animal: clean(row?.animal, 80) ?? "an animal",
            noted_at: clean(row?.noted_at, 10) ?? new Date().toISOString().slice(0, 10),
            ...(pinned ? {source: "wild_profile" as const, pinned: true, ...(kind ? {kind} : {})} : {})
        });
    }
    // Newest last; the oldest unpinned facts fall off past the cap.
    const pinnedCount = facts.filter((fact) => fact.pinned).length;
    let room = Math.max(0, maxFacts - pinnedCount);
    const keep = new Set<AskMemoryFact>();
    for (let index = facts.length - 1; index >= 0; index -= 1) {
        if (facts[index].pinned) keep.add(facts[index]);
        else if (room > 0) {
            keep.add(facts[index]);
            room -= 1;
        }
    }
    return facts.filter((fact) => keep.has(fact));
}

/** The lines in the species system prompt that say how memory is used. */
export const ASK_MEMORY_RULES = [
    "Memory — what_you_remember_about_them lists things this person has told you and the other animals before, with",
    "which animal they told and when. Animals share what they learn about a person, so you know it too.",
    "- Use it the way a friend would: bring a remembered thing in when it bears on what they are asking, naturally",
    "  ('you told the Wolf you run a bakery — so…'). Never recite the list, never prove you remember, never mention",
    "  something remembered when it has nothing to do with the question.",
    "- What they say now beats what is remembered. If they correct or contradict a remembered fact, go with them.",
    "- Never remember for them something they did not say, and never turn a remembered struggle into a label."
];

export function askMemorySection(facts: AskMemoryFact[]): string {
    if (facts.length === 0) {
        return "what_you_remember_about_them: nothing yet — this is the first thing any animal has learned about them.";
    }
    const lines = facts.map((fact) => fact.pinned
        ? `- ${fact.fact} (from their Wild Profile, ${fact.noted_at})`
        : `- ${fact.fact} (told to the ${fact.animal}, ${fact.noted_at})`);
    return `what_you_remember_about_them — things they have told you and the other animals before:\n${lines.join("\n")}`;
}

export function buildAskMemoryExtractionPrompts(params: {
    existing: AskMemoryFact[];
    animalName: string;
    userMessage: string;
    answer: string;
    maxFacts?: number;
}): {system: string; user: string} {
    const max = params.maxFacts ?? ASK_MEMORY_MAX_FACTS;
    const today = new Date().toISOString().slice(0, 10);
    return {
        system: [
            "You maintain what the animals in AnimalDex remember about one person, across all their conversations.",
            "You are given the current memory and the latest exchange between the person and one animal.",
            "Return the memory as it should be after this exchange: JSON only, {\"facts\":[{\"fact\":string,\"animal\":string,\"noted_at\":string}]}.",
            "Rules:",
            `- At most ${max} facts, each under ${FACT_MAX_LENGTH} characters, written as plain statements about the person`,
            "  in the third person ('Runs a small bakery in Leeds', 'Trying to stop starting projects they never finish').",
            "- Keep only durable things worth knowing next time: who they are, what they do, what they are working on, what",
            "  they struggle with, what they want, people and places that matter to them, how they like answers (short, simple).",
            "- Do NOT keep: one-off questions about the animal, anything the person did not say about themselves, health or",
            "  mental-health conditions, sexuality, religion, politics, exact addresses, financial figures, or passwords.",
            "- Merge: keep existing facts unless this exchange corrects, contradicts or supersedes them; then replace them.",
            "  Never duplicate. Prefer updating a fact over adding a near-copy.",
            "- New facts take the animal and today's date; kept facts keep their original animal and date.",
            "- Facts with \"pinned\":true come from the person's Wild Profile. Return them exactly as they are, with their",
            "  source and pinned fields; never edit, merge or drop them, and do not add a near-copy of one.",
            "- If this exchange taught nothing new about the person, return the existing facts unchanged."
        ].join("\n"),
        user: [
            `today: ${today}`,
            `animal_name: ${params.animalName}`,
            `current_memory:\n${JSON.stringify(params.existing)}`,
            `person_said:\n${params.userMessage}`,
            `animal_answered:\n${params.answer.slice(0, 2000)}`
        ].join("\n\n")
    };
}

