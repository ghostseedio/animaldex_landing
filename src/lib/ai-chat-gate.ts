/**
 * Before the first chat on the web (SPEC 3.1, Nov 2026): a quick age check
 * for signed-in accounts and a one-time AI consent for everyone, plus the
 * inline notices every conversation carries.
 *
 * - Age: a birth year, asked once, kept by `set_birth_year` (the account's
 *   band: `under_13`, `teen` or `adult`). Under 13, Talk is closed.
 * - Consent: "Agree" calls `record_ai_consent` for an account and is kept in
 *   this browser for a guest. "Not now" keeps the chat locked.
 * - Notices: "Replies are AI-generated." at the top of each conversation,
 *   and again once a session runs past three hours (for a teen, with a
 *   suggestion to take a break).
 *
 * The backend half lands separately (WS-B); until its columns and RPCs exist
 * the web asks nothing it cannot keep (no age check) and keeps the consent
 * in the browser, so chat is never blocked by a missing migration.
 *
 * Pure, so the rules are tested; the browser half is components/ai-gate.
 */

export const AI_CONSENT_VERSION = "2026-11";

export type AgeBand = "unknown" | "under_13" | "teen" | "adult";

export const BIRTH_YEAR_MIN = 1900;

/**
 * `public.age_band` on the web: the calendar year minus the birth year, the
 * boundary year counting as the older band (born in 2013, in 2026: teen).
 */
export function ageBandFor(birthYear: number | null | undefined, now = new Date()): AgeBand {
    if (typeof birthYear !== "number" || !Number.isInteger(birthYear)) return "unknown";
    const age = now.getUTCFullYear() - birthYear;
    if (age < 13) return "under_13";
    if (age < 18) return "teen";
    return "adult";
}

export function isAgeBand(value: unknown): value is AgeBand {
    return value === "unknown" || value === "under_13" || value === "teen" || value === "adult";
}

export function isValidBirthYear(value: unknown, now = new Date()): value is number {
    return typeof value === "number" && Number.isInteger(value) && value >= BIRTH_YEAR_MIN && value <= now.getUTCFullYear();
}

/** The year picker's choices, newest first. */
export function birthYearOptions(now = new Date()): number[] {
    const years: number[] = [];
    for (let year = now.getUTCFullYear(); year >= BIRTH_YEAR_MIN; year -= 1) years.push(year);
    return years;
}

/** What the gate knows about the person about to chat. */
export type AiGateFacts = {
    signedIn: boolean;
    /** The account's birth year; null when not given (or not known yet). */
    birthYear: number | null;
    band: AgeBand;
    /** The server can keep a birth year (`set_birth_year` exists). */
    ageCheckAvailable: boolean;
    /** Consent given, on the account or in this browser. */
    consented: boolean;
};

export type AiGateStep = "blocked" | "age" | "consent" | "open";

/** What comes before the message: the block, the age check, the consent, or nothing. */
export function aiGateStep(facts: AiGateFacts): AiGateStep {
    if (facts.band === "under_13") return "blocked";
    if (facts.signedIn && facts.ageCheckAvailable && facts.birthYear === null && facts.band === "unknown") return "age";
    if (!facts.consented) return "consent";
    return "open";
}

/** The browser keys: the guest's consent, an account's (cached), and the chat session's clock. */
export const AI_CONSENT_GUEST_KEY = "animaldex:ai-consent:guest";
export const aiConsentAccountKey = (userId: string) => `animaldex:ai-consent:${userId}`;
export const AI_SESSION_KEY = "animaldex:ai-session";

/** A stored consent counts when it is for this version. */
export function isCurrentConsent(stored: string | null | undefined): boolean {
    return stored === AI_CONSENT_VERSION;
}

// MARK: - The long-session notice

export const AI_LONG_SESSION_MS = 3 * 60 * 60 * 1000;
/** A gap this long starts a new session. */
export const AI_SESSION_IDLE_MS = 30 * 60 * 1000;

export type AiSession = {startedAt: number; lastActiveAt: number};

export function parseAiSession(raw: string | null | undefined): AiSession | null {
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as Partial<AiSession>;
        if (typeof parsed.startedAt !== "number" || typeof parsed.lastActiveAt !== "number") return null;
        if (!Number.isFinite(parsed.startedAt) || !Number.isFinite(parsed.lastActiveAt) || parsed.startedAt > parsed.lastActiveAt) return null;
        return {startedAt: parsed.startedAt, lastActiveAt: parsed.lastActiveAt};
    } catch {
        return null;
    }
}

/** The session after activity now: the same one, or a new one after a long gap. */
export function touchAiSession(session: AiSession | null, now: number): AiSession {
    if (!session || now - session.lastActiveAt > AI_SESSION_IDLE_MS || now < session.startedAt) {
        return {startedAt: now, lastActiveAt: now};
    }
    return {startedAt: session.startedAt, lastActiveAt: Math.max(session.lastActiveAt, now)};
}

/** Whether the session has run past three hours (and is still going). */
export function longSessionNoticeDue(session: AiSession | null, now: number): boolean {
    if (!session || now - session.lastActiveAt > AI_SESSION_IDLE_MS) return false;
    return now - session.startedAt >= AI_LONG_SESSION_MS;
}
