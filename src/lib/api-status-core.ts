// Pure half of /admin/api-status: reading each AI provider's reply to a
// one-token probe as ok / out of credit / bad key / rate limited / down.
// None of Claude, OpenAI, Gemini or Higgsfield lets an API key read the
// prepaid balance, so "out of credit" is detected from the error a request
// gets, and spend comes from the admin cost reports where a key is set.

export const API_PROVIDERS = ["claude", "openai", "gemini", "higgsfield"] as const;
export type ApiProvider = (typeof API_PROVIDERS)[number];

export type ApiHealth = "ok" | "no_credit" | "auth" | "rate_limited" | "down" | "not_configured";

export const API_PROVIDER_INFO: Record<ApiProvider, {label: string; billingUrl: string; usedFor: string}> = {
    claude: {label: "Claude (Anthropic)", billingUrl: "https://platform.claude.com/settings/billing", usedFor: "Share copy, video scripts, blog generator, identity review"},
    openai: {label: "OpenAI", billingUrl: "https://platform.openai.com/settings/organization/billing/overview", usedFor: "Fallback for scripts and fusions, TTS fallback"},
    gemini: {label: "Gemini (Google AI)", billingUrl: "https://aistudio.google.com/usage", usedFor: "Ask AnimalDex, fallbacks, music beds"},
    higgsfield: {label: "Higgsfield", billingUrl: "https://cloud.higgsfield.ai/", usedFor: "AI clips in page videos"}
};

const CREDIT_WORDS = /credit balance|insufficient[_ ](quota|credits?|balance|funds)|billing|payment required|out of credits|not enough credits|top up/i;

/** What an HTTP status plus error body from a provider means. */
export function classifyProviderReply(status: number, body: string): ApiHealth {
    if (status >= 200 && status < 300) return "ok";
    if (status === 402 || CREDIT_WORDS.test(body)) return "no_credit";
    if (status === 401 || status === 403) return "auth";
    if (status === 429) return "rate_limited";
    if (status >= 500) return "down";
    // A 400/404/422 to a well-formed probe still proves the key was accepted.
    return status === 400 || status === 404 || status === 422 ? "ok" : "down";
}

/** Sums Anthropic cost_report buckets: `amount` is a decimal string in cents. */
export function sumAnthropicCostReport(body: unknown) {
    const data = (body as {data?: Array<{results?: Array<{amount?: string}>}>})?.data ?? [];
    const cents = data.flatMap((bucket) => bucket.results ?? []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    return cents / 100;
}

/** Sums OpenAI organization/costs buckets: `amount.value` is in dollars. */
export function sumOpenAICosts(body: unknown) {
    const data = (body as {data?: Array<{results?: Array<{amount?: {value?: number | string}}>}>})?.data ?? [];
    return data.flatMap((bucket) => bucket.results ?? []).reduce((sum, item) => sum + (Number(item.amount?.value) || 0), 0);
}

export function monthStartUTC(now: Date) {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}
