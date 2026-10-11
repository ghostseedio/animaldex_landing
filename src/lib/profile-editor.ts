/**
 * Edit Profile — the pure parts of iOS `ProfileEditorSupport`,
 * `ModerationTextFilter` and `SupabaseProfileService.updateCurrentProfile`.
 */

export const BIO_CHARACTER_LIMIT = 160;

export type ProfileChromePreset = "spirit" | "friend" | "professional" | "business";
export type ProfileCaptureGridSort = "recent" | "index";

export const PROFILE_STYLE_OPTIONS: Array<{id: ProfileChromePreset; title: string; detail: string}> = [
    {id: "spirit", title: "Spirit", detail: "Origin, Apex, and Active animals"},
    {id: "friend", title: "Friend", detail: "Your pets"},
    {id: "professional", title: "Professional", detail: "Bio, joined date, and Instagram"},
    {id: "business", title: "Business", detail: "Net worth, overall score, and catalog %"}
];

export const CAPTURE_GRID_OPTIONS: Array<{id: ProfileCaptureGridSort; title: string; detail: string}> = [
    {id: "recent", title: "Recently captured", detail: "Newest captures first"},
    {id: "index", title: "Index number", detail: "AnimalDex #, lowest to highest"}
];

export function normalizeUsername(value: string) {
    return value.trim().replace(/@/g, "").toLowerCase();
}

/** Null when the format is fine; otherwise why it is not (or "taken" for the reserved name). */
export function usernameFormatProblem(normalized: string): {kind: "invalid"; message: string} | {kind: "taken"} | null {
    if (!normalized) return {kind: "invalid", message: "Username is required."};
    if (!/^[\p{L}\p{N}_.]+$/u.test(normalized)) return {kind: "invalid", message: "Use letters, numbers, underscores, or dots."};
    if (normalized === "animaldex") return {kind: "taken"};
    return null;
}

const BLOCKED_PHRASES = ["kill yourself", "go die", "porn", "nude", "explicit sex", "terrorist threat", "racial slur", "hate speech"];

export function moderationRejection(text: string) {
    const normalized = text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
    return BLOCKED_PHRASES.some((phrase) => normalized.includes(phrase))
        ? "This text appears to contain objectionable or abusive content. Please revise it before posting."
        : null;
}

export function normalizeOptionalText(value: string | null | undefined) {
    const trimmed = (value ?? "").trim();
    return trimmed ? trimmed : null;
}

/** A bare handle becomes https://instagram.com/<handle>; a URL is kept. */
export function normalizeInstagramUrl(value: string | null | undefined) {
    const trimmed = (value ?? "").trim();
    if (!trimmed) return null;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    const handle = trimmed.replace(/@/g, "").trim();
    return handle ? `https://instagram.com/${handle}` : null;
}

export function clampBio(value: string) {
    return Array.from(value).slice(0, BIO_CHARACTER_LIMIT).join("");
}

export function isDuplicateUsernameError(message: string) {
    const text = message.toLowerCase();
    return text.includes("profiles_username_lower_unique_idx") || text.includes("duplicate key") || text.includes("already exists");
}
