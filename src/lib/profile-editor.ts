/**
 * Edit Profile — the pure parts of iOS `ProfileEditorSupport`,
 * `ModerationTextFilter` and `SupabaseProfileService.updateCurrentProfile`.
 */

export const BIO_CHARACTER_LIMIT = 160;

export type ProfileChromePreset = "spirit" | "friend" | "professional" | "business";
/** iOS `ProfileCaptureGridSort`: every value the apps can save. */
export type ProfileCaptureGridSort = "recent" | "index" | "stars" | "custom";

const CAPTURE_GRID_SORTS: readonly ProfileCaptureGridSort[] = ["recent", "index", "stars", "custom"];

/**
 * iOS `ProfileCaptureGridSort.parse`: trimmed and lowercased; anything else,
 * or nothing, is the default (recent).
 */
export function parseCaptureGridSort(raw: unknown): ProfileCaptureGridSort {
    const value = typeof raw === "string" ? raw.trim().toLowerCase() : "";
    return (CAPTURE_GRID_SORTS as readonly string[]).includes(value) ? value as ProfileCaptureGridSort : "recent";
}

/**
 * The grid sort an Edit profile save may write, or null to leave the stored
 * one alone. Only a value the apps know is written: a missing or unknown one
 * never turns someone's star or custom grid (chosen in the app) into recent.
 */
export function captureGridSortToSave(raw: unknown): ProfileCaptureGridSort | null {
    const value = typeof raw === "string" ? raw.trim().toLowerCase() : "";
    return (CAPTURE_GRID_SORTS as readonly string[]).includes(value) ? value as ProfileCaptureGridSort : null;
}

/**
 * The grid choices Edit profile offers, in iOS's order. Custom needs the
 * app's capture picker, which the web does not have: it is offered only
 * while it is the saved choice, so keeping it is always possible and
 * choosing it from nothing (an empty grid) is not.
 */
export function captureGridChoices(saved: ProfileCaptureGridSort): ProfileCaptureGridSort[] {
    return saved === "custom" ? ["recent", "index", "stars", "custom"] : ["recent", "index", "stars"];
}

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
