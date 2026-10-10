import Anthropic from "@anthropic-ai/sdk";
import publishedTrials from "@/data/published-animal-trials.json";
import {getSpeciesPageData} from "@/data/database-species-pages";
import {resolveSpeciesBehaviorProfileForPage} from "@/data/species-behavior-lessons";
import {getSystemsIntelligenceBySpeciesSlug} from "@/data/species-systems-intelligence";
import {buildAnimalDreamReading, isKeptAnimal} from "@/lib/animal-dream-reading";
import {getSiteUrl} from "@/lib/site";
import {speciesDisplayCategory} from "@/lib/species-breed";
import {
    buildShareCopyUserPrompt,
    buildTemplateCopy,
    normalizeShareCopy,
    parseShareCopy,
    SHARE_COPY_JSON_SCHEMA,
    SHARE_COPY_SYSTEM_PROMPT,
    type ShareCopy,
    type SpeciesShareContext
} from "@/lib/social/share-copy";

type TrialEntry = {slug: string; title: string; objective: string};

/** Everything the animal page knows that makes good copy: facts, meaning, dream reading, Trial, biomimicry. */
export async function buildSpeciesShareContext(
    pageSlug: string,
    fallbackName: string,
    video: {script: string | null; videoHook: string | null} | null
): Promise<SpeciesShareContext> {
    const pageUrl = `${getSiteUrl()}/animals/${pageSlug}`;
    const entry = await getSpeciesPageData(pageSlug).catch(() => null);
    const name = entry?.name ?? fallbackName;
    const profile = resolveSpeciesBehaviorProfileForPage(pageSlug);
    const systems = getSystemsIntelligenceBySpeciesSlug(pageSlug);
    const trial = (publishedTrials.entries as TrialEntry[]).find((candidate) => candidate.slug === pageSlug) ?? null;
    const dream = profile ? buildAnimalDreamReading({
        slug: pageSlug,
        name,
        principle: profile.principle,
        principleExpression: profile.principleExpression,
        coreLesson: profile.coreLesson,
        motto: profile.motto,
        bestFor: profile.bestFor,
        domesticated: entry ? isKeptAnimal(entry) : false
    }) : null;

    return {
        name,
        scientificName: entry?.analysis.scientificName ?? null,
        category: entry ? speciesDisplayCategory(entry) : null,
        pageUrl,
        summary: entry?.analysis.summary ?? null,
        facts: entry?.premiumDetails.whyInteresting ?? [],
        principle: profile?.principle ?? null,
        motto: profile?.motto ?? null,
        coreLesson: profile?.coreLesson ?? null,
        qualities: profile?.bestFor ?? [],
        dreamMeaning: dream?.answer ?? null,
        trial: trial ? {title: trial.title, objective: trial.objective.slice(0, 600)} : null,
        biomimicry: systems ? `${systems.specializedHardware} ${systems.strategicInsight}`.trim() : null,
        script: video?.script ?? null,
        videoHook: video?.videoHook ?? null
    };
}

export type GeneratedShareCopy = {copy: ShareCopy; source: "claude" | "template"; error?: string};

/** Claude's draft held to the rules, or the template when there is no key or the call fails. */
export async function generateShareCopy(context: SpeciesShareContext): Promise<GeneratedShareCopy> {
    const key = process.env.CLAUDE_API_KEY?.trim() || process.env.ANTHROPIC_API_KEY?.trim();
    if (!key) return {copy: buildTemplateCopy(context), source: "template", error: "CLAUDE_API_KEY is not configured"};
    try {
        const client = new Anthropic({apiKey: key});
        const response = await client.beta.messages.create({
            model: process.env.CLAUDE_SOCIAL_COPY_MODEL?.trim() || "claude-opus-5-5",
            max_tokens: 4000,
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default",
            output_config: {effort: "low", format: {type: "json_schema", schema: SHARE_COPY_JSON_SCHEMA}},
            system: SHARE_COPY_SYSTEM_PROMPT,
            messages: [{role: "user", content: buildShareCopyUserPrompt(context)}]
        });
        if (response.stop_reason === "refusal") throw new Error("Claude declined the request");
        const text = response.content.map((block) => (block.type === "text" ? block.text : "")).join("");
        const parsed = parseShareCopy(text);
        if (!parsed) throw new Error("Claude returned unusable copy");
        return {copy: normalizeShareCopy(parsed, context), source: "claude"};
    } catch (error) {
        return {copy: buildTemplateCopy(context), source: "template", error: error instanceof Error ? error.message : String(error)};
    }
}
