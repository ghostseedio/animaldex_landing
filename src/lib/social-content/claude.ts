import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";
import {parseModelJson} from "@/lib/content-video/plan";

// One structured Claude call for carousels and text posts: the JSON schema is
// enforced by the API (output_config.format), the page's photos ride along as
// small JPEGs so the writer can pick the right one per slide, and refusals
// fall back server-side. Returns the parsed reply and what it cost.

/** Claude Opus 5.5 list prices, USD per token. */
const USD_PER_INPUT_TOKEN = 4 / 1_000_000;
const USD_PER_OUTPUT_TOKEN = 20 / 1_000_000;

export function isClaudeReady() {
    return Boolean(process.env.CLAUDE_API_KEY?.trim() || process.env.ANTHROPIC_API_KEY?.trim());
}

/** A page photo the writer sees, by its number. */
export type PromptImage = {index: number; bytes: Buffer};

async function photo(image: PromptImage) {
    try {
        const jpeg = await sharp(image.bytes).rotate().flatten({background: "#0E0F0E"}).resize(640, 640, {fit: "inside", withoutEnlargement: true}).jpeg({quality: 76}).toBuffer();
        return {index: image.index, data: jpeg.toString("base64")};
    } catch {
        return null;
    }
}

export type StructuredReply = {value: unknown; usd: number; loadedImages: number[]};

export async function structuredClaude(input: {system: string; user: string; schema: Record<string, unknown>; images?: PromptImage[]; effort?: "low" | "medium" | "high"}): Promise<StructuredReply> {
    const apiKey = process.env.CLAUDE_API_KEY?.trim() || process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey) throw new Error("CLAUDE_API_KEY is not set on the server");
    const photos = (await Promise.all((input.images ?? []).slice(0, 12).map(photo))).filter((entry): entry is {index: number; data: string} => entry !== null);
    const client = new Anthropic({apiKey});
    const response = await client.beta.messages.create({
        model: process.env.SOCIAL_CONTENT_CLAUDE_MODEL?.trim() || "claude-opus-5-5",
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: {effort: input.effort ?? "medium", format: {type: "json_schema", schema: input.schema}},
        system: input.system,
        messages: [{
            role: "user",
            content: [
                ...photos.flatMap((entry) => [
                    {type: "text" as const, text: `Photo ${entry.index}:`},
                    {type: "image" as const, source: {type: "base64" as const, media_type: "image/jpeg" as const, data: entry.data}}
                ]),
                {type: "text" as const, text: input.user}
            ]
        }]
    });
    if (response.stop_reason === "refusal") throw new Error("Claude declined to write this one");
    if (response.stop_reason === "max_tokens") throw new Error("Claude's reply was cut off");
    const text = response.content.map((block) => (block.type === "text" ? block.text : "")).join("");
    const value = parseModelJson(text);
    if (value === null) throw new Error("Claude did not return JSON");
    const usd = response.usage.input_tokens * USD_PER_INPUT_TOKEN + response.usage.output_tokens * USD_PER_OUTPUT_TOKEN;
    return {value, usd: Math.round(usd * 10_000) / 10_000, loadedImages: photos.map((entry) => entry.index)};
}
