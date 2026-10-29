/**
 * The name an owner gives one of their cards (`captures.title`), as the apps
 * keep it: one line, trimmed, at most 40 characters (the name sheet's limit
 * on iOS, and what the server reads back for the animal's chat). Blank is no
 * name, and the card shows the animal's own.
 */

export const CAPTURE_NICKNAME_MAX = 40;

export function normalizeCaptureNickname(raw: unknown): string | null {
    if (typeof raw !== "string") return null;
    const name = Array.from(raw.replace(/\s+/g, " ").trim()).slice(0, CAPTURE_NICKNAME_MAX).join("").trim();
    return name.length > 0 ? name : null;
}

/** Sent on `window` once a card's name is saved, so its card and its chat say it at once. */
export const CAPTURE_NICKNAME_EVENT = "animaldex:capture-nickname";

export type CaptureNicknameDetail = {captureId: string; nickname: string | null};

/** Saves a card's name for its owner. Resolves the name as saved; rejects when it did not go through. */
export async function saveCaptureNickname(captureId: string, nickname: string | null): Promise<string | null> {
    const response = await fetch(`/api/app/captures/${encodeURIComponent(captureId)}/nickname`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({nickname})
    });
    if (!response.ok) throw new Error(String(response.status));
    const payload = await response.json() as {nickname?: unknown};
    const saved = normalizeCaptureNickname(payload.nickname);
    if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent<CaptureNicknameDetail>(CAPTURE_NICKNAME_EVENT, {detail: {captureId, nickname: saved}}));
    }
    return saved;
}
