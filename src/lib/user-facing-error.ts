/**
 * One mapper for what goes wrong in the web app (UX pass, DECISIONS section 4;
 * WEB-40): a raw message never reaches the screen. Offline is said as
 * offline; a code the screen knows is said in its own words; everything else
 * is our side. The raw text goes to the console, for us.
 */

export type UserFacingErrorWords = {errorOffline: string; errorServer: string};

/**
 * A request the server answered with a refusal: its status, and its own
 * message when it sent one. A 4xx with a person's sentence (a route's own
 * validation copy, "That username is already taken.") is shown as it is; a
 * database's or a library's text never is.
 */
export class AppRequestError extends Error {
    constructor(readonly status: number, readonly serverMessage: string | null) {
        super(serverMessage ?? `http_${status}`);
    }
}

/** Text written for a person, not by a database or a stack: a sentence, short, with no technical tells. */
const TECHNICAL = /violates|constraint|duplicate key|jwt|pgrst|relation |column |function |schema|syntax|null value|failed to fetch|networkerror|load failed|typeerror|supabase|internal|unexpected token|econn|status code|\bat \w+ \(|undefined|null\b/i;

export function isHumanMessage(text: string | null | undefined): boolean {
    const value = text?.trim() ?? "";
    return value.length > 0 && value.length <= 180 && /^[A-Z"“]/.test(value) && !TECHNICAL.test(value);
}

export type UserFacingError = {kind: "offline" | "known" | "server"; message: string};

function rawText(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    if (error && typeof error === "object") {
        const row = error as Record<string, unknown>;
        for (const key of ["error", "message", "code", "detail"]) {
            if (typeof row[key] === "string") return row[key] as string;
        }
    }
    return "";
}

/** A code the server answered with, when it answered one: `{error: "insufficient_credits"}` → "insufficient_credits". */
export function userFacingErrorCode(error: unknown): string | null {
    if (error && typeof error === "object" && !(error instanceof Error)) {
        const row = error as Record<string, unknown>;
        const code = typeof row.error === "string" ? row.error : typeof row.code === "string" ? row.code : null;
        if (code && /^[a-z][a-z0-9_.-]{1,60}$/i.test(code)) return code;
    }
    if (error instanceof Error && /^[a-z][a-z0-9_]{2,60}$/.test(error.message)) return error.message;
    return null;
}

export function userFacingError(
    error: unknown,
    words: UserFacingErrorWords,
    options: {known?: Record<string, string>; online?: boolean; context?: string} = {}
): UserFacingError {
    const raw = rawText(error);
    if (raw && typeof console !== "undefined") console.warn(`[animaldex]${options.context ? ` ${options.context}` : ""}`, raw.slice(0, 300));
    const online = options.online ?? (typeof navigator === "undefined" ? true : navigator.onLine !== false);
    if (!online) return {kind: "offline", message: words.errorOffline};
    if (error instanceof AppRequestError && error.status >= 400 && error.status < 500 && error.status !== 401 && isHumanMessage(error.serverMessage)) {
        return {kind: "known", message: (error.serverMessage as string).trim()};
    }
    const code = userFacingErrorCode(error);
    if (code && options.known && Object.prototype.hasOwnProperty.call(options.known, code)) {
        return {kind: "known", message: options.known[code]};
    }
    return {kind: "server", message: words.errorServer};
}
