import "server-only";
import Anthropic from "@anthropic-ai/sdk";

export const CLAUDE_MODEL = process.env.BLOG_GENERATOR_CLAUDE_MODEL?.trim() || "claude-opus-5-5";

let client: Anthropic | null = null;

export function claudeClient() {
    const apiKey = process.env.CLAUDE_API_KEY?.trim() || process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey) throw new Error("CLAUDE_API_KEY is not set");
    client ??= new Anthropic({apiKey, timeout: 15 * 60_000});
    return client;
}

export function isClaudeConfigured() {
    return Boolean(process.env.CLAUDE_API_KEY?.trim() || process.env.ANTHROPIC_API_KEY?.trim());
}
