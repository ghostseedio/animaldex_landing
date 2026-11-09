import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import {anthropicApiKey, anthropicClient} from "@/lib/anthropic-keys";

export const CLAUDE_MODEL = process.env.BLOG_GENERATOR_CLAUDE_MODEL?.trim() || "claude-opus-5-5";

let client: Anthropic | null = null;

export function claudeClient() {
    const apiKey = anthropicApiKey();
    if (!apiKey) throw new Error("CLAUDE_API_KEY is not set");
    client ??= anthropicClient({apiKey, timeout: 15 * 60_000});
    return client;
}

export function isClaudeConfigured() {
    return Boolean(anthropicApiKey());
}
