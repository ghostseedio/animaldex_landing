import type {CompanionTabRow} from "@/lib/companion-rows";
/**
 * Which animal the Companions tab opens on (the owner, 2026-11-06: the tab is
 * the chat, with the animal they were with most recently already open, and
 * the others a switch away, like a model switcher). "Most recently" counts a
 * message either way and a switch to it in this browser, so a switch sticks
 * until something newer happens with another one. Nobody talked to yet: the
 * roster's first row, which already puts what needs them first. Port of iOS
 * `CompanionsOpening`.
 */

export type CompanionsOpeningMemory = {speciesProfileId: string; at: number; row?: CompanionsOpeningRowSnapshot | null};

/**
 * Enough of the row to open its chat before anything has loaded (the owner,
 * 2026-11-07: a returning person goes splash → chat from what the browser
 * already knows). Older memories carry none.
 */
export type CompanionsOpeningRowSnapshot = {captureId: string | null; animal: string; displayName: string; slug: string | null};

/** The remembered animal as a row with nothing of its messages yet; null for an older memory. */
export function cachedCompanionRow(memory: CompanionsOpeningMemory | null): CompanionTabRow | null {
    const row = memory?.row;
    if (!memory || !row || !row.animal) return null;
    return {
        speciesProfileId: memory.speciesProfileId,
        captureId: row.captureId,
        animal: row.animal,
        displayName: row.displayName || row.animal,
        slug: row.slug,
        powerName: null,
        openStep: null,
        lastMessage: null,
        lastActivityAt: memory.at,
        unreadCount: 0,
        muted: false,
        referralWaiting: false,
        referralId: null,
        hasConversation: false
    };
}

export function pickCompanionToOpen<T extends {speciesProfileId: string}>(
    rows: readonly T[],
    lastAt: (row: T) => number | null,
    remembered: CompanionsOpeningMemory | null
): T | null {
    let best: {row: T; at: number} | null = null;
    for (const row of rows) {
        let at = lastAt(row);
        if (remembered && remembered.speciesProfileId.toLowerCase() === row.speciesProfileId.toLowerCase()) {
            at = Math.max(at ?? Number.NEGATIVE_INFINITY, remembered.at);
        }
        if (at === null || !Number.isFinite(at)) continue;
        if (!best || at > best.at) best = {row, at};
    }
    return best?.row ?? rows[0] ?? null;
}

const KEY = "animaldex:companions:open";

/** What this browser remembers; empty when storage is off or holds nothing. */
export function rememberedCompanion(): CompanionsOpeningMemory | null {
    try {
        const raw = window.localStorage.getItem(KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<CompanionsOpeningMemory>;
        if (typeof parsed.speciesProfileId !== "string" || typeof parsed.at !== "number") return null;
        const row = parsed.row && typeof parsed.row === "object" && typeof parsed.row.animal === "string"
            ? {
                captureId: typeof parsed.row.captureId === "string" ? parsed.row.captureId : null,
                animal: parsed.row.animal,
                displayName: typeof parsed.row.displayName === "string" ? parsed.row.displayName : parsed.row.animal,
                slug: typeof parsed.row.slug === "string" ? parsed.row.slug : null
            }
            : null;
        return {speciesProfileId: parsed.speciesProfileId, at: parsed.at, row};
    } catch {
        return null;
    }
}

export function rememberCompanion(speciesProfileId: string, at = Date.now(), row: CompanionsOpeningRowSnapshot | null = null) {
    try {
        // The id alone keeps whatever row was remembered for the same animal.
        const kept = row ?? (() => {
            const previous = rememberedCompanion();
            return previous && previous.speciesProfileId.toLowerCase() === speciesProfileId.toLowerCase() ? previous.row ?? null : null;
        })();
        window.localStorage.setItem(KEY, JSON.stringify({speciesProfileId, at, row: kept}));
    } catch {
        // A browser with storage off keeps nothing; the newest conversation opens.
    }
}
