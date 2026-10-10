import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";
import {
    buildPlanUserPrompt,
    normalizePlan,
    parseModelJson,
    PLAN_JSON_SCHEMA,
    PLAN_SYSTEM_PROMPT,
    type VideoPlan,
    type VideoSource
} from "@/lib/content-video/plan";
import {
    BATTLE_JSON_SCHEMA,
    BATTLE_SYSTEM_PROMPT,
    buildBattleUserPrompt,
    buildCreatureUserPrompt,
    CREATURE_JSON_SCHEMA,
    CREATURE_SYSTEM_PROMPT,
    normalizeBattlePlan,
    normalizeCreaturePlan
} from "@/lib/content-video/formats";
import {loadImageBytes} from "@/lib/content-video/source";

// Writes the script and shot plan: Claude first, then OpenAI, then Gemini.
// Each one SEES the photos, so the shots and motion prompts describe what is
// actually in them. Any reply is held to the format by normalizePlan.

type PlanImage = {index: number; base64: string};
type Prompt = {system: string; schema: Record<string, unknown>};
type Provider = {name: "claude" | "openai" | "gemini"; generate: (prompt: Prompt, user: string, images: PlanImage[]) => Promise<string>};

/** Small JPEGs for the model: enough to judge a photo, cheap in tokens. */
async function prepareImages(source: VideoSource): Promise<PlanImage[]> {
    const prepared = await Promise.all(source.images.map(async (image) => {
        try {
            const bytes = await loadImageBytes(image.src);
            const jpeg = await sharp(bytes).rotate().resize(768, 768, {fit: "inside", withoutEnlargement: true}).jpeg({quality: 78}).toBuffer();
            return {index: image.index, base64: jpeg.toString("base64")};
        } catch (error) {
            console.warn(`[content-video] skipping image ${image.src}: ${error instanceof Error ? error.message : error}`);
            return null;
        }
    }));
    return prepared.filter((image): image is PlanImage => image !== null);
}

function providers(): Provider[] {
    const list: Provider[] = [];
    const claudeKey = process.env.CLAUDE_API_KEY?.trim() || process.env.ANTHROPIC_API_KEY?.trim();
    if (claudeKey) {
        list.push({
            name: "claude",
            generate: async ({system, schema}, user, images) => {
                const client = new Anthropic({apiKey: claudeKey});
                const response = await client.beta.messages.create({
                    model: process.env.CONTENT_VIDEO_CLAUDE_MODEL?.trim() || "claude-opus-5-5",
                    max_tokens: 8000,
                    betas: ["server-side-fallback-2026-07-01"],
                    fallbacks: "default",
                    output_config: {effort: "medium", format: {type: "json_schema", schema}},
                    system,
                    messages: [{
                        role: "user",
                        content: [
                            ...images.flatMap((image) => [
                                {type: "text" as const, text: `Photo ${image.index}:`},
                                {type: "image" as const, source: {type: "base64" as const, media_type: "image/jpeg" as const, data: image.base64}}
                            ]),
                            {type: "text" as const, text: user}
                        ]
                    }]
                });
                if (response.stop_reason === "refusal") throw new Error("claude_refused");
                const text = response.content.map((block) => (block.type === "text" ? block.text : "")).join("");
                if (!text.trim()) throw new Error("claude_empty");
                return text;
            }
        });
    }
    const openaiKey = process.env.OPENAI_API_KEY?.trim();
    if (openaiKey) {
        list.push({
            name: "openai",
            generate: async ({system, schema}, user, images) => {
                const response = await fetch("https://api.openai.com/v1/chat/completions", {
                    method: "POST",
                    headers: {Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json"},
                    body: JSON.stringify({
                        model: process.env.CONTENT_VIDEO_OPENAI_MODEL?.trim() || "gpt-4o",
                        response_format: {type: "json_object"},
                        messages: [
                            {role: "system", content: `${system}\n\nJSON shape: ${JSON.stringify(schema)}`},
                            {
                                role: "user",
                                content: [
                                    ...images.flatMap((image) => [
                                        {type: "text", text: `Photo ${image.index}:`},
                                        {type: "image_url", image_url: {url: `data:image/jpeg;base64,${image.base64}`, detail: "low"}}
                                    ]),
                                    {type: "text", text: user}
                                ]
                            }
                        ]
                    }),
                    signal: AbortSignal.timeout(180_000)
                });
                if (!response.ok) throw new Error(`openai_${response.status}:${(await response.text()).slice(0, 300)}`);
                const body = await response.json() as {choices?: Array<{message?: {content?: string}}>};
                const content = body.choices?.[0]?.message?.content;
                if (!content?.trim()) throw new Error("openai_empty");
                return content;
            }
        });
    }
    const geminiKey = process.env.GEMINI_API_KEY?.trim();
    if (geminiKey) {
        list.push({
            name: "gemini",
            generate: async ({system, schema}, user, images) => {
                const model = process.env.CONTENT_VIDEO_GEMINI_MODEL?.trim() || "gemini-2.5-flash";
                const response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(geminiKey)}`,
                    {
                        method: "POST",
                        headers: {"Content-Type": "application/json"},
                        body: JSON.stringify({
                            systemInstruction: {parts: [{text: `${system}\n\nJSON shape: ${JSON.stringify(schema)}`}]},
                            contents: [{
                                role: "user",
                                parts: [
                                    ...images.flatMap((image) => [{text: `Photo ${image.index}:`}, {inline_data: {mime_type: "image/jpeg", data: image.base64}}]),
                                    {text: user}
                                ]
                            }],
                            generationConfig: {responseMimeType: "application/json", temperature: 0.8}
                        }),
                        signal: AbortSignal.timeout(180_000)
                    }
                );
                if (!response.ok) throw new Error(`gemini_${response.status}:${(await response.text()).slice(0, 300)}`);
                const body = await response.json() as {candidates?: Array<{content?: {parts?: Array<{text?: string}>}}>};
                const text = body.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
                if (!text.trim()) throw new Error("gemini_empty");
                return text;
            }
        });
    }
    return list;
}

export type GeneratedPlan = {plan: VideoPlan; provider: Provider["name"]; failures: string[]};

/** The planner for the source's format: its prompt, its schema and the check that holds the reply to it. */
function plannerFor(source: VideoSource): {prompt: Prompt; user: string; normalize: (value: unknown) => VideoPlan | null} {
    if (source.format === "battle") {
        return {prompt: {system: BATTLE_SYSTEM_PROMPT, schema: BATTLE_JSON_SCHEMA}, user: buildBattleUserPrompt(source), normalize: (value) => normalizeBattlePlan(value, source)};
    }
    if (source.format === "creature") {
        return {prompt: {system: CREATURE_SYSTEM_PROMPT, schema: CREATURE_JSON_SCHEMA}, user: buildCreatureUserPrompt(source), normalize: (value) => normalizeCreaturePlan(value, source)};
    }
    return {prompt: {system: PLAN_SYSTEM_PROMPT, schema: PLAN_JSON_SCHEMA}, user: buildPlanUserPrompt(source), normalize: (value) => normalizePlan(value, source.images.length)};
}

export async function generateVideoPlan(source: VideoSource): Promise<GeneratedPlan> {
    const list = providers();
    if (!list.length) throw new Error("No AI provider is configured (CLAUDE_API_KEY, OPENAI_API_KEY or GEMINI_API_KEY)");
    const images = await prepareImages(source);
    if (!images.length) throw new Error("None of the page's images could be loaded");
    // List only the photos that loaded; each keeps its number, labelled the same in the prompt and the attachments.
    const loaded = new Set(images.map((image) => image.index));
    const visible: VideoSource = {...source, images: source.images.filter((image) => loaded.has(image.index))};
    const planner = plannerFor(visible);

    const failures: string[] = [];
    for (const provider of list) {
        try {
            const raw = await provider.generate(planner.prompt, planner.user, images);
            const plan = planner.normalize(parseModelJson(raw));
            if (!plan) throw new Error("unusable plan");
            // A photo number the model used must be one it was shown.
            for (const scene of plan.scenes) {
                if (!loaded.has(scene.image)) scene.image = images[0].index;
            }
            return {plan, provider: provider.name, failures};
        } catch (error) {
            failures.push(`${provider.name}: ${(error instanceof Error ? error.message : String(error)).slice(0, 200)}`);
        }
    }
    throw new Error(`Every AI provider failed — ${failures.join("; ")}`);
}
