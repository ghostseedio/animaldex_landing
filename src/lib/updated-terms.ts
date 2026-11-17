/**
 * The "Updated Terms" gate (owner, 2026-11-17: people captures are normal
 * captures, and the Terms that say so must be accepted to use the app).
 *
 * The server holds the agreement: `terms_status_v1()` says which version is
 * current and whether the signed-in person agreed to it, `accept_terms_v1`
 * records it (migration 20261130100000). The app blocks until it is agreed.
 * If the status cannot be read (offline, or the migration is not applied yet)
 * the app is not blocked; it asks again on the next load.
 */

import {COMMUNITY_TERMS_KEY} from "@/lib/community-terms";

export type TermsStatus = {version: string; accepted: boolean; acceptedAt: string | null};

export const UPDATED_TERMS_WORDS = {
    title: "Updated Terms",
    lead: "We've updated the AnimalDex Terms of Use. Please read them and agree to keep using AnimalDex.",
    rules: [
        "Captures can show people. A person is identified as Human, like any animal, and the card can be public like any other capture.",
        "Only capture or upload a person if you have their permission or the right to share the photo.",
        "Anyone pictured can ask for a capture to be removed: tap Report on it, or email support@animaldex.app.",
        "No objectionable, abusive, harassing, hateful, sexual, violent, or illegal content. Report it when you see it, and block abusive users."
    ],
    legalPrefix: "Read the full",
    termsOfUse: "Terms of Use",
    and: "and",
    privacyPolicy: "Privacy Policy",
    agree: "I Agree",
    agreeing: "Saving…",
    footnote: "You need to agree to keep using AnimalDex.",
    failed: "That didn't go through. Check your connection and try again."
} as const;

/** The status as the RPC returns it, or null when it is not a status. */
export function parseTermsStatus(raw: unknown): TermsStatus | null {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const row = raw as Record<string, unknown>;
    if (typeof row.version !== "string" || !row.version.trim() || typeof row.accepted !== "boolean") return null;
    return {
        version: row.version,
        accepted: row.accepted,
        acceptedAt: typeof row.accepted_at === "string" ? row.accepted_at : null
    };
}

/** Block only on a status that says "not agreed"; anything unreadable lets the person in. */
export function termsGateBlocks(status: TermsStatus | null): boolean {
    return status !== null && !status.accepted;
}

type TermsStorage = Pick<Storage, "getItem" | "setItem">;

export function acceptedTermsCacheKey(userId: string, version: string): string {
    return `animaldex.acceptedTerms.${userId}.${version}`;
}

/** Agreed on this browser before (so a reload does not flash the gate while the status loads). */
export function cachedTermsAccepted(storage: TermsStorage | null, userId: string, version: string): boolean {
    try {
        return storage?.getItem(acceptedTermsCacheKey(userId, version)) === "true";
    } catch {
        return false;
    }
}

/** Remember the agreement, and the older Community Terms flag it includes. */
export function rememberTermsAccepted(storage: TermsStorage | null, userId: string, version: string): void {
    try {
        storage?.setItem(acceptedTermsCacheKey(userId, version), "true");
        storage?.setItem(COMMUNITY_TERMS_KEY, "true");
    } catch {
        // The server row is the agreement; the cache is only a convenience.
    }
}
