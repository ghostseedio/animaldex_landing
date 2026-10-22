/**
 * What the animals remember about a signed-in reader, across conversations
 * and across animals. The same row the apps' edge function keeps
 * (`animal_chat_user_memory`), so a fact told to the Wolf in the app is known
 * to the Cheetah on the website. Port of the memory half of the apps'
 * `_shared/animal-voice.ts`; the prompt text is carried across verbatim.
 */


export type AskMemoryFact = {
    /**
     * Stable id the database assigns (memory v2); absent on facts parsed from
     * an older payload. Forgetting and correcting go by it.
     */
    id?: string;
    fact: string;
    /**
     * context | goal | commitment | outcome | preference for chat facts; the
     * Wild Profile uses its own kinds (name, birth_date, ...).
     */
    kind?: string;
    /** The canonical species of the animal it was told to. */
    species_profile_id?: string;
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
        const id = clean(row?.id, 64);
        const kind = clean(row?.kind, 24);
        const speciesProfileId = clean(row?.species_profile_id, 64);
        facts.push({
            ...(id ? {id} : {}),
            fact,
            ...(kind ? {kind} : {}),
            ...(speciesProfileId ? {species_profile_id: speciesProfileId} : {}),
            animal: clean(row?.animal, 80) ?? "an animal",
            noted_at: clean(row?.noted_at, 10) ?? new Date().toISOString().slice(0, 10),
            ...(pinned ? {source: "wild_profile" as const, pinned: true} : {})
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

/** Facts this animal was told first, then the rest, then the Wild Profile. */
export function orderAskMemoryForAnimal(facts: AskMemoryFact[], speciesProfileId: string | null): AskMemoryFact[] {
    const toldHere = (fact: AskMemoryFact) => Boolean(speciesProfileId) && fact.species_profile_id === speciesProfileId;
    const told = facts.filter((fact) => !fact.pinned && toldHere(fact));
    const others = facts.filter((fact) => !fact.pinned && !toldHere(fact));
    const pinned = facts.filter((fact) => fact.pinned);
    return [...told, ...others, ...pinned];
}

/** How the person is described to the animal. Mirrors `memoryPromptSection` in the apps. */
export function askMemorySection(facts: AskMemoryFact[], speciesProfileId: string | null = null): string {
    if (facts.length === 0) {
        return "what_you_remember_about_them: nothing yet — this is the first thing any animal has learned about them.";
    }
    const lines = orderAskMemoryForAnimal(facts, speciesProfileId).map((fact) => {
        const kind = fact.kind && !fact.pinned ? ` [${fact.kind}]` : "";
        if (fact.pinned) return `- ${fact.fact} (from their Wild Profile, ${fact.noted_at})`;
        if (speciesProfileId && fact.species_profile_id === speciesProfileId) return `- ${fact.fact}${kind} (told to you, ${fact.noted_at})`;
        return `- ${fact.fact}${kind} (told to the ${fact.animal}, ${fact.noted_at})`;
    });
    return `what_you_remember_about_them — things they have told you and the other animals before:\n${lines.join("\n")}`;
}
