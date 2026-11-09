import Anthropic from "@anthropic-ai/sdk";

// Every Claude key the server has, in the order they are tried, and a client
// that moves to the next key when the one it sent is refused. The same rules
// as the edge functions' supabase/functions/_shared/anthropic-keys.ts.
//
// Env: CLAUDE_API_KEY (or ANTHROPIC_API_KEY), then CLAUDE_API_KEY_2. The first
// is used; the second only answers when the first is refused for reasons that
// are about the key, not the request: authentication or permission refused,
// rate limited, or out of credit. Anything else (a bad request, an overloaded
// model, a refusal) comes back as it is, because a different key would get the
// same answer.
//
// The fallback lives in the client's fetch, below the SDK's own retries and
// every caller's provider fallback, so streams, JSON calls and tool loops keep
// their shape: the response the caller sees is the one the next key got.

type Env = (name: string) => string | undefined;

const defaultEnv: Env = (name) => process.env[name]?.trim() || undefined;

const KEY_NAMES = ["CLAUDE_API_KEY", "ANTHROPIC_API_KEY", "CLAUDE_API_KEY_2"] as const;

/** The configured keys, primary first, without blanks or repeats. */
export function anthropicApiKeys(env: Env = defaultEnv): string[] {
    const keys: string[] = [];
    for (const name of KEY_NAMES) {
        const key = env(name)?.trim();
        if (key && !keys.includes(key)) keys.push(key);
    }
    return keys;
}

/** The key a call starts with: CLAUDE_API_KEY, else ANTHROPIC_API_KEY, else CLAUDE_API_KEY_2. */
export function anthropicApiKey(env: Env = defaultEnv): string | undefined {
    return anthropicApiKeys(env)[0];
}

const KEY_ERROR_TYPES = new Set(["authentication_error", "permission_error", "rate_limit_error", "billing_error"]);

/** True when the response says the key was refused, so another key may succeed. */
export async function isKeyRefusal(response: Response): Promise<boolean> {
    if (response.ok) return false;
    if ([401, 402, 403, 429].includes(response.status)) return true;
    if (response.status !== 400) return false;
    // Out of credit comes back as a 400 invalid_request_error.
    try {
        const body = await response.clone().text();
        let type = "";
        let message = body;
        try {
            const parsed = JSON.parse(body) as {error?: {type?: unknown; message?: unknown}};
            type = typeof parsed.error?.type === "string" ? parsed.error.type : "";
            message = typeof parsed.error?.message === "string" ? parsed.error.message : body;
        } catch {
            // Not JSON: judge the text.
        }
        return KEY_ERROR_TYPES.has(type) || /credit balance|billing|purchase credits/i.test(message);
    } catch {
        return false;
    }
}

function release(responses: Response[]) {
    for (const response of responses) void response.body?.cancel().catch(() => {});
}

/**
 * A fetch for the Anthropic SDK (or a raw call that sends x-api-key) that
 * re-sends the same request with the next key when the key it sent is refused.
 */
export function anthropicKeyFallbackFetch(base: typeof fetch = (input, init) => fetch(input, init), env: Env = defaultEnv): typeof fetch {
    return async (input, init) => {
        const first = await base(input, init);
        // A body that is a stream cannot be sent twice.
        const body = init?.body;
        if (body != null && typeof body !== "string" && !(body instanceof Uint8Array) && !(body instanceof ArrayBuffer)) return first;
        if (!(await isKeyRefusal(first))) return first;

        const headers = new Headers(input instanceof Request ? input.headers : undefined);
        new Headers(init?.headers).forEach((value, name) => headers.set(name, value));
        const sent = headers.get("x-api-key");
        if (!sent) return first;
        const others = anthropicApiKeys(env).filter((key) => key !== sent);
        if (others.length === 0) return first;

        const refused = [first];
        for (let index = 0; index < others.length; index += 1) {
            const key = others[index];
            console.warn("anthropic key refused, trying the next key", {status: refused[refused.length - 1].status, next: index + 2});
            headers.set("x-api-key", key);
            const retry = await base(input instanceof Request ? input.url : input, {...init, headers});
            if (!(await isKeyRefusal(retry))) {
                release(refused);
                return retry;
            }
            refused.push(retry);
        }
        // Every key was refused: the caller sees the last refusal.
        const last = refused.pop()!;
        release(refused);
        return last;
    };
}

type ClientOptions = NonNullable<ConstructorParameters<typeof Anthropic>[0]>;

/** `new Anthropic(options)` with the key fallback in its fetch; starts on `options.apiKey`, else the primary key. */
export function anthropicClient(options: ClientOptions = {}): Anthropic {
    const base = (options.fetch ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init))) as typeof fetch;
    return new Anthropic({...options, apiKey: options.apiKey ?? anthropicApiKey(), fetch: anthropicKeyFallbackFetch(base)});
}
