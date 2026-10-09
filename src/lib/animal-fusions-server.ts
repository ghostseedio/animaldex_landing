import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import type {SupabaseClient} from "@supabase/supabase-js";
import {
    buildAnimalFusionSlug,
    FUSION_STATS,
    type AnimalFusionEntry,
    type FusableSpecies,
    type FusionStat
} from "@/data/animal-fusions";
import {getPublishedSpeciesForContent} from "@/lib/static-species-overlay";

/**
 * Species-level port of the iOS `fuse-capture-principle` edge function
 * (~/AnimalDex/supabase/functions/fuse-capture-principle). The recipe lookup,
 * prompt, normalisation and storage match it so the app reuses web-made
 * recipes for the same species pair. Captures, cost and stat changes are not
 * involved. Tune the prompt in the iOS repo first, then mirror it here.
 *
 * Providers: Claude first, then OpenAI (the app's model), then Gemini, each
 * only when its key is set. Every answer passes the edge function's checks
 * before it is saved; a provider that fails or answers badly hands over to the
 * next.
 */
export const FUSION_PROMPT_VERSION = "principle-fusion-v2";
const VALID_STATS = new Set<string>(FUSION_STATS);
const RECIPE_COLUMNS = [
    "id",
    "receiver_species_profile_id",
    "donor_species_profile_id",
    "receiver_principle_name",
    "donor_principle_name",
    "learned_sub_principle_name",
    "learned_sub_principle_expression",
    "scenario_tags",
    "primary_stat",
    "secondary_stat",
    "stat_boost_primary",
    "stat_boost_secondary",
    "created_at"
].join(",");

export type FusionRecipeRow = {
    id?: string;
    receiver_species_profile_id: string;
    donor_species_profile_id: string;
    receiver_principle_name: string;
    donor_principle_name: string;
    learned_sub_principle_name: string;
    learned_sub_principle_expression: string;
    scenario_tags: string[] | null;
    primary_stat: string | null;
    secondary_stat: string | null;
    stat_boost_primary: number | null;
    stat_boost_secondary: number | null;
    created_at?: string;
};

type PrincipleContext = {
    species: FusableSpecies;
    scientific_name: string | null;
    principle_name: string;
    principle_expression: string | null;
    core_lesson: string | null;
    biological_basis: string | null;
    short_motto: string | null;
    best_use_cases: string[];
    ability_text: string | null;
};

type FusionRecipe = {
    learned_sub_principle_name: string;
    learned_sub_principle_expression: string;
    scenario_tags: string[];
    primary_stat: FusionStat | null;
    secondary_stat: FusionStat | null;
    stat_boost_primary: number;
    stat_boost_secondary: number;
};

function normalizedText(raw: unknown, maxLength = 1200): string | null {
    if (typeof raw !== "string") return null;
    const trimmed = raw.trim().replace(/\s+/g, " ");
    return trimmed ? trimmed.slice(0, maxLength).trim() : null;
}

function normalizedStringArray(raw: unknown, limit: number, maxLength: number): string[] {
    if (!Array.isArray(raw)) return [];
    const seen = new Set<string>();
    const result: string[] = [];
    for (const item of raw) {
        const text = normalizedText(item, maxLength);
        if (!text || seen.has(text.toLowerCase())) continue;
        seen.add(text.toLowerCase());
        result.push(text);
        if (result.length >= limit) break;
    }
    return result;
}

function normalizedStat(raw: unknown): FusionStat | null {
    const stat = normalizedText(raw, 40)?.toLowerCase().replace(/\s+/g, "_") ?? null;
    return stat && VALID_STATS.has(stat) ? stat as FusionStat : null;
}

function normalizeRecipe(raw: Record<string, unknown>): FusionRecipe {
    const name = normalizedText(raw.learned_sub_principle_name, 60);
    const expression = normalizedText(raw.learned_sub_principle_expression, 180);
    if (!name || !expression) throw new Error("fusion_recipe_missing_required_fields");
    const tags = normalizedStringArray(raw.scenario_tags, 5, 40);
    return {
        learned_sub_principle_name: name,
        learned_sub_principle_expression: expression,
        scenario_tags: tags.length > 0 ? tags : ["adaptation", "scenario_fit"],
        primary_stat: normalizedStat(raw.primary_stat),
        secondary_stat: normalizedStat(raw.secondary_stat),
        stat_boost_primary: Math.max(0, Math.min(2, Math.round(Number(raw.stat_boost_primary ?? 1)))),
        stat_boost_secondary: Math.max(0, Math.min(2, Math.round(Number(raw.stat_boost_secondary ?? 0))))
    };
}

export function fusionEntryFromRow(row: FusionRecipeRow, receiver: FusableSpecies, donor: FusableSpecies): AnimalFusionEntry {
    const recipe = normalizeRecipe(row as unknown as Record<string, unknown>);
    return {
        slug: buildAnimalFusionSlug(receiver.slug, donor.slug),
        receiverSlug: receiver.slug,
        donorSlug: donor.slug,
        receiverPrinciple: normalizedText(row.receiver_principle_name, 100) ?? receiver.principle,
        donorPrinciple: normalizedText(row.donor_principle_name, 100) ?? donor.principle,
        name: recipe.learned_sub_principle_name,
        expression: recipe.learned_sub_principle_expression,
        scenarioTags: recipe.scenario_tags,
        primaryStat: recipe.primary_stat,
        secondaryStat: recipe.secondary_stat,
        boostPrimary: recipe.primary_stat ? recipe.stat_boost_primary : 0,
        boostSecondary: recipe.secondary_stat ? recipe.stat_boost_secondary : 0,
        updatedAt: (row.created_at ?? new Date().toISOString()).slice(0, 10)
    };
}

export async function fetchSpeciesPairRecipe(admin: SupabaseClient, receiver: FusableSpecies, donor: FusableSpecies) {
    const {data, error} = await admin
        .from("species_principle_fusion_recipes")
        .select(RECIPE_COLUMNS)
        .eq("receiver_species_profile_id", receiver.speciesProfileId)
        .eq("donor_species_profile_id", donor.speciesProfileId)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

    if (error) throw new Error(`fusion_exact_recipe_lookup_failed:${error.message}`);
    return data ? data as unknown as FusionRecipeRow : null;
}

/** Every active species-pair recipe, for the build-time snapshot. */
export async function fetchAllSpeciesPairRecipes(admin: SupabaseClient) {
    const rows: FusionRecipeRow[] = [];
    for (let from = 0; ; from += 1000) {
        const {data, error} = await admin
            .from("species_principle_fusion_recipes")
            .select(RECIPE_COLUMNS)
            .not("receiver_species_profile_id", "is", null)
            .not("donor_species_profile_id", "is", null)
            .eq("is_active", true)
            .order("created_at", {ascending: true})
            .range(from, from + 999);
        if (error) throw new Error(`fusion_recipes_list_failed:${error.message}`);
        rows.push(...(data as unknown as FusionRecipeRow[]));
        if (!data || data.length < 1000) return rows;
    }
}

async function fetchEffectiveBestUseCases(admin: SupabaseClient, speciesProfileId: string, fallback: unknown): Promise<string[]> {
    const {data, error} = await admin
        .from("species_best_for_power_assignments")
        .select("assignment_rank, canonical_best_for_tags(tag_label)")
        .eq("species_profile_id", speciesProfileId)
        .order("assignment_rank", {ascending: true});
    if (error) throw new Error(`effective_best_use_cases_assignments_failed:${error.message}`);

    const assigned = (data ?? [])
        .map((row) => {
            const joined = (row as {canonical_best_for_tags: {tag_label: string} | {tag_label: string}[] | null}).canonical_best_for_tags;
            return (Array.isArray(joined) ? joined[0]?.tag_label : joined?.tag_label)?.trim();
        })
        .filter((label): label is string => Boolean(label));

    return assigned.length > 0 ? assigned : normalizedStringArray(fallback, 20, 100);
}

async function fetchPrincipleContext(admin: SupabaseClient, species: FusableSpecies): Promise<PrincipleContext | null> {
    const {data: principle, error} = await admin
        .from("species_behavior_principles")
        .select("principle_name,principle_expression,core_lesson,biological_basis,short_motto,best_use_cases")
        .eq("species_profile_id", species.speciesProfileId)
        .maybeSingle();
    if (error) throw new Error(`principle_context_behavior_failed:${error.message}`);

    const principleName = normalizedText(principle?.principle_name, 100);
    if (!principleName) return null;

    // The app reads ability text from the capture's analysis; at species level
    // the published field-guide summary plays that role.
    const content = getPublishedSpeciesForContent(species.slug);

    return {
        species,
        scientific_name: normalizedText(content?.analysis.scientificName, 160),
        principle_name: principleName,
        principle_expression: normalizedText(principle?.principle_expression, 220),
        core_lesson: normalizedText(principle?.core_lesson, 320),
        biological_basis: normalizedText(principle?.biological_basis, 400),
        short_motto: normalizedText(principle?.short_motto, 180),
        best_use_cases: normalizedStringArray(await fetchEffectiveBestUseCases(admin, species.speciesProfileId, principle?.best_use_cases), 6, 100),
        ability_text: normalizedText(content?.analysis.summary, 1400)
    };
}

function parseOpenAIJsonObject(raw: string): Record<string, unknown> {
    const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    return JSON.parse(firstBrace >= 0 && lastBrace > firstBrace ? trimmed.slice(firstBrace, lastBrace + 1) : trimmed) as Record<string, unknown>;
}

function promptAnimal(context: PrincipleContext) {
    return {
        animal_display_name: context.species.name,
        animal_name: context.species.name,
        breed_guess: null,
        scientific_name: context.scientific_name,
        species_profile_id: context.species.speciesProfileId,
        principle_name: context.principle_name,
        principle_expression: context.principle_expression,
        core_lesson: context.core_lesson,
        biological_basis: context.biological_basis,
        ability_text: context.ability_text,
        comparison_text: null
    };
}

function buildFusionPrompts(receiver: PrincipleContext, donor: PrincipleContext) {
    // Verbatim from fuse-capture-principle generateFallbackRecipe.
    const systemPrompt = [
        "You design AnimalDex Principle Fusion sub-principles.",
        "Return exactly one JSON object. No markdown.",
        "The receiver keeps its main species and main principle. Never replace or rename the receiver's main principle.",
        "The donor teaches one narrow animal-specific behavioral lesson that the receiver can borrow.",
        "This is asymmetric: receiver + donor can produce a different lesson than donor + receiver.",
        "Do not create a hybrid animal. Do not make the receiver universally stronger.",
        "The learned sub-principle helps only when scenario fit rewards that behavior. It should be irrelevant or weak in unrelated scenarios.",
        "Use the real receiver animal, donor animal, their principle details, and any ability/comparison text. Avoid generic life-advice language.",
        "learned_sub_principle_name: max 3 words.",
        "learned_sub_principle_expression: max 180 characters; explain how receiver principle learns from donor principle.",
        "scenario_tags: 2 to 5 short tags.",
        "primary_stat and secondary_stat must be one of speed, intelligence, rarity, dominance, size, or null.",
        "Use small boosts only: normally stat_boost_primary 1 and stat_boost_secondary 0 or 1.",
        "If secondary_stat is null, stat_boost_secondary must be 0."
    ].join("\n");

    const userPrompt = {
        prompt_version: FUSION_PROMPT_VERSION,
        receiver: promptAnimal(receiver),
        donor: promptAnimal(donor),
        allowed_stats: Array.from(VALID_STATS),
        output_schema: {
            learned_sub_principle_name: "string, max 3 words",
            learned_sub_principle_expression: "string, under 180 characters",
            scenario_tags: "array of 2 to 5 short strings",
            primary_stat: "speed | intelligence | rarity | dominance | size | null",
            secondary_stat: "speed | intelligence | rarity | dominance | size | null",
            stat_boost_primary: "integer 0 or 1, normally 1",
            stat_boost_secondary: "integer 0 or 1"
        },
        examples: [
            {
                receiver_principle_name: "Loyalty",
                donor_principle_name: "Boundary",
                learned_sub_principle_name: "Clear Boundary",
                learned_sub_principle_expression: "Loyalty learns to protect the bond without abandoning the self.",
                scenario_tags: ["control", "protection", "human_boundary", "respect"],
                primary_stat: "dominance",
                secondary_stat: "intelligence"
            },
            {
                receiver_principle_name: "Boundary",
                donor_principle_name: "Loyalty",
                learned_sub_principle_name: "Selective Trust",
                learned_sub_principle_expression: "Boundary learns that not every approach is a threat.",
                scenario_tags: ["social", "alliance", "protection", "trust"],
                primary_stat: "intelligence",
                secondary_stat: "dominance"
            }
        ]
    };

    return {systemPrompt, userPrompt: JSON.stringify(userPrompt)};
}

/** Same checks the edge function applies to the model's JSON. */
function validateGeneratedRecipe(raw: string): FusionRecipe {
    const parsed = parseOpenAIJsonObject(raw);
    // The app hard-cuts at 180 characters, mid-word; end on a word instead.
    const expression = normalizedText(parsed.learned_sub_principle_expression, 2000);
    if (expression && expression.length > 180) {
        parsed.learned_sub_principle_expression = `${expression.slice(0, 179).replace(/[\s,;:.-]+\S*$/, "")}…`;
    }
    const recipe = normalizeRecipe({...parsed, stat_boost_primary: parsed.stat_boost_primary ?? 1, stat_boost_secondary: parsed.stat_boost_secondary ?? 0});
    if (recipe.learned_sub_principle_name.split(/\s+/).length > 3) throw new Error("fusion_name_too_long");
    if (recipe.scenario_tags.length < 2 || recipe.scenario_tags.length > 5) throw new Error("fusion_invalid_tags");
    if (!recipe.primary_stat) recipe.stat_boost_primary = 0;
    if (!recipe.secondary_stat) recipe.stat_boost_secondary = 0;
    return recipe;
}

type FusionPrompts = ReturnType<typeof buildFusionPrompts>;
type FusionProvider = {name: "openai" | "gemini" | "claude"; generate: (prompts: FusionPrompts) => Promise<string>};

const nullableStat = {anyOf: [{type: "string", enum: [...FUSION_STATS]}, {type: "null"}]};
const RECIPE_JSON_SCHEMA = {
    type: "object",
    properties: {
        learned_sub_principle_name: {type: "string"},
        learned_sub_principle_expression: {type: "string"},
        scenario_tags: {type: "array", items: {type: "string"}},
        primary_stat: nullableStat,
        secondary_stat: nullableStat,
        stat_boost_primary: {type: "integer"},
        stat_boost_secondary: {type: "integer"}
    },
    required: ["learned_sub_principle_name", "learned_sub_principle_expression", "scenario_tags", "primary_stat", "secondary_stat", "stat_boost_primary", "stat_boost_secondary"],
    additionalProperties: false
};

/** Claude first, then OpenAI (the app's provider), then Gemini. Only providers with a key. */
function fusionProviders(): FusionProvider[] {
    const providers: FusionProvider[] = [];

    const claudeKey = process.env.CLAUDE_API_KEY?.trim() || process.env.ANTHROPIC_API_KEY?.trim();
    if (claudeKey) {
        providers.push({
            name: "claude",
            generate: async ({systemPrompt, userPrompt}) => {
                const client = new Anthropic({apiKey: claudeKey});
                const response = await client.beta.messages.create({
                    model: process.env.CLAUDE_PRINCIPLE_FUSION_MODEL?.trim() || "claude-opus-5-5",
                    max_tokens: 16000,
                    // A declined request is retried server-side on the recommended model.
                    betas: ["server-side-fallback-2026-07-01"],
                    fallbacks: "default",
                    output_config: {effort: "low", format: {type: "json_schema", schema: RECIPE_JSON_SCHEMA}},
                    system: systemPrompt,
                    messages: [{role: "user", content: userPrompt}]
                });
                if (response.stop_reason === "refusal") throw new Error(`claude_refusal:${response.stop_details?.category ?? "unknown"}`);
                const text = response.content.map((block) => (block.type === "text" ? block.text : "")).join("");
                if (!text.trim()) throw new Error(`claude_empty:${response.stop_reason}`);
                return text;
            }
        });
    }

    const openaiKey = process.env.OPENAI_API_KEY?.trim();
    if (openaiKey) {
        providers.push({
            name: "openai",
            generate: async ({systemPrompt, userPrompt}) => {
                const response = await fetch("https://api.openai.com/v1/chat/completions", {
                    method: "POST",
                    headers: {Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json"},
                    body: JSON.stringify({
                        model: process.env.OPENAI_PRINCIPLE_FUSION_MODEL?.trim() || "gpt-4o-mini",
                        temperature: 0.45,
                        max_completion_tokens: 600,
                        response_format: {type: "json_object"},
                        messages: [
                            {role: "system", content: systemPrompt},
                            {role: "user", content: userPrompt}
                        ]
                    })
                });
                if (!response.ok) throw new Error(`openai_${response.status}:${(await response.text()).slice(0, 300)}`);
                const content = (await response.json())?.choices?.[0]?.message?.content;
                if (typeof content !== "string" || !content.trim()) throw new Error("openai_empty");
                return content;
            }
        });
    }

    const geminiKey = process.env.GEMINI_API_KEY?.trim();
    if (geminiKey) {
        providers.push({
            name: "gemini",
            generate: async ({systemPrompt, userPrompt}) => {
                const model = process.env.GEMINI_PRINCIPLE_FUSION_MODEL?.trim() || "gemini-2.5-flash";
                const response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(geminiKey)}`,
                    {
                        method: "POST",
                        headers: {"Content-Type": "application/json"},
                        body: JSON.stringify({
                            systemInstruction: {parts: [{text: systemPrompt}]},
                            contents: [{role: "user", parts: [{text: userPrompt}]}],
                            generationConfig: {
                                temperature: 0.45,
                                maxOutputTokens: 600,
                                responseMimeType: "application/json",
                                // Thinking would eat the small output budget.
                                thinkingConfig: {thinkingBudget: 0}
                            }
                        })
                    }
                );
                if (!response.ok) throw new Error(`gemini_${response.status}:${(await response.text()).slice(0, 300)}`);
                const parts = (await response.json())?.candidates?.[0]?.content?.parts;
                const text = Array.isArray(parts) ? parts.map((part: {text?: unknown}) => (typeof part?.text === "string" ? part.text : "")).join("") : "";
                if (!text.trim()) throw new Error("gemini_empty");
                return text;
            }
        });
    }

    return providers;
}

async function generateRecipe(providers: FusionProvider[], receiver: PrincipleContext, donor: PrincipleContext) {
    const prompts = buildFusionPrompts(receiver, donor);
    const failures: string[] = [];
    for (const provider of providers) {
        try {
            return {recipe: validateGeneratedRecipe(await provider.generate(prompts)), provider: provider.name};
        } catch (error) {
            failures.push(`${provider.name}: ${(error as Error).message}`);
            console.warn("principle fusion provider failed; trying the next", {provider: provider.name, error: (error as Error).message});
        }
    }
    throw new Error(`fusion_generation_failed:${failures.join(" | ")}`);
}

export type FuseSpeciesResult =
    | {status: "ok"; entry: AnimalFusionEntry; source: "existing" | "generated"}
    | {status: "principle_missing"; species: FusableSpecies}
    | {status: "generation_unavailable"};

/**
 * Returns the stored recipe for the pair, or (when `allowGenerate`) creates it
 * with the app's prompt and saves it where the app looks first. Unlike the app
 * there is no deterministic fallback: a page is only made from a real recipe.
 */
export async function fuseSpecies(
    admin: SupabaseClient,
    receiver: FusableSpecies,
    donor: FusableSpecies,
    {allowGenerate}: {allowGenerate: boolean}
): Promise<FuseSpeciesResult | null> {
    const existing = await fetchSpeciesPairRecipe(admin, receiver, donor);
    if (existing) {
        return {status: "ok", entry: fusionEntryFromRow(existing, receiver, donor), source: "existing"};
    }
    if (!allowGenerate) {
        return null;
    }

    const providers = fusionProviders();
    if (providers.length === 0) {
        return {status: "generation_unavailable"};
    }

    const [receiverContext, donorContext] = await Promise.all([
        fetchPrincipleContext(admin, receiver),
        fetchPrincipleContext(admin, donor)
    ]);
    if (!receiverContext) return {status: "principle_missing", species: receiver};
    if (!donorContext) return {status: "principle_missing", species: donor};

    const {recipe, provider} = await generateRecipe(providers, receiverContext, donorContext);
    const {data, error} = await admin
        .from("species_principle_fusion_recipes")
        .insert({
            receiver_species_profile_id: receiver.speciesProfileId,
            donor_species_profile_id: donor.speciesProfileId,
            receiver_principle_name: receiverContext.principle_name,
            donor_principle_name: donorContext.principle_name,
            ...recipe,
            generation_source: "ai_generated",
            generated_prompt_version: FUSION_PROMPT_VERSION,
            is_active: true
        })
        .select(RECIPE_COLUMNS)
        .single();

    if (error) {
        // Two people fusing the same pair at once: keep whichever row landed first.
        const raced = error.code === "23505" ? await fetchSpeciesPairRecipe(admin, receiver, donor) : null;
        if (!raced) throw new Error(`fusion_recipe_save_failed:${error.message}`);
        return {status: "ok", entry: fusionEntryFromRow(raced, receiver, donor), source: "existing"};
    }

    console.info("principle fusion generated", {receiver: receiver.slug, donor: donor.slug, provider});
    return {status: "ok", entry: fusionEntryFromRow(data as unknown as FusionRecipeRow, receiver, donor), source: "generated"};
}
