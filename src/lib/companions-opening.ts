/**
 * Which animal the Companions tab opens on (the owner, 2026-11-06: the tab is
 * the chat, with the animal they were with most recently already open, and
 * the others a switch away, like a model switcher). "Most recently" counts a
 * message either way and a switch to it in this browser, so a switch sticks
 * until something newer happens with another one. Nobody talked to yet: the
 * roster's first row, which already puts what needs them first. Port of iOS
 * `CompanionsOpening`.
 */

export type CompanionsOpeningMemory = {speciesProfileId: string; at: number};

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
        return typeof parsed.speciesProfileId === "string" && typeof parsed.at === "number" ? {speciesProfileId: parsed.speciesProfileId, at: parsed.at} : null;
    } catch {
        return null;
    }
}

export function rememberCompanion(speciesProfileId: string, at = Date.now()) {
    try {
        window.localStorage.setItem(KEY, JSON.stringify({speciesProfileId, at}));
    } catch {
        // A browser with storage off keeps nothing; the newest conversation opens.
    }
}
