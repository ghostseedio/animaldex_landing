/**
 * Settings & Activity — the pure parts, word for word with iOS
 * `ProfileSettingsView`, `SettingsAccountStandingView`,
 * `SupabaseAuthSignInMethodDisplay` and `PriceDisplayCurrencyCatalog`.
 */

import {currencyForCountry, regionOfLanguageTag} from "@/lib/request-country";
import {fillSettingsWords, SETTINGS_WORDS_EN, type SettingsWords} from "@/lib/settings-words";

// MARK: - Location privacy (iOS `LocationVisibility`)

export type LocationVisibility = "everyone" | "following" | "friends" | "private";

export const LOCATION_VISIBILITY_OPTIONS: Array<{id: LocationVisibility; title: string}> = [
    {id: "everyone", title: "Everyone"},
    {id: "following", title: "People I follow"},
    {id: "friends", title: "Friends"},
    {id: "private", title: "Only me"}
];

export function normalizeLocationVisibility(value: unknown): LocationVisibility {
    return LOCATION_VISIBILITY_OPTIONS.some((option) => option.id === value) ? value as LocationVisibility : "everyone";
}

const VISIBILITY_WORD: Record<LocationVisibility, keyof SettingsWords> = {
    everyone: "visibilityEveryone",
    following: "visibilityFollowing",
    friends: "visibilityFriends",
    private: "visibilityPrivate"
};

export function locationVisibilityTitle(value: LocationVisibility, words: SettingsWords = SETTINGS_WORDS_EN) {
    return words[VISIBILITY_WORD[value] ?? "visibilityEveryone"];
}

/** A push row's title and subtitle in the reader's language (`PUSH_PREFERENCE_ROWS` is the English). */
export function pushPreferenceWords(id: keyof PushPreferences, words: SettingsWords = SETTINGS_WORDS_EN): {title: string; subtitle: string} {
    const english = PUSH_PREFERENCE_ROWS.find((row) => row.id === id);
    const key = `push${id.charAt(0).toUpperCase()}${id.slice(1)}` as keyof SettingsWords;
    const title = words[key] as string | undefined;
    const subtitle = words[`${key}Note` as keyof SettingsWords] as string | undefined;
    return {title: title ?? english?.title ?? id, subtitle: subtitle ?? english?.subtitle ?? ""};
}

// MARK: - Push alert types (profiles.push_*_enabled)

export type PushPreferences = {
    captureUpdates: boolean;
    socialActivity: boolean;
    directMessages: boolean;
    animalMessages: boolean;
    creditBonuses: boolean;
};

export const PUSH_PREFERENCE_COLUMNS: Record<keyof PushPreferences, string> = {
    captureUpdates: "push_capture_updates_enabled",
    socialActivity: "push_social_activity_enabled",
    directMessages: "push_direct_messages_enabled",
    // Migration 20261023200000 (animal messages), as iOS `SupabaseNotificationsService`.
    animalMessages: "push_animal_messages_enabled",
    creditBonuses: "push_credit_bonuses_enabled"
};

/** iOS `SettingsNotificationsView` alert types, word for word and in its order. */
export const PUSH_PREFERENCE_ROWS: Array<{id: keyof PushPreferences; title: string; subtitle: string}> = [
    {id: "captureUpdates", title: "Your captures", subtitle: "Merges and corrections to animals you have captured."},
    {id: "socialActivity", title: "Activity", subtitle: "New captures from people you follow."},
    {id: "directMessages", title: "Messages", subtitle: "New messages from collectors and AnimalDex Support."},
    {id: "animalMessages", title: "Animal messages", subtitle: "When an animal you talk with writes to you."}
    // No Credits row: Credit bonuses have been in-app only since 20261104162000
    // (AnimalDex docs/notifications-audit-2026-11.md), so a switch for their alert switched nothing.
    // The column stays in PushPreferences so a save never resets it.
];

// MARK: - Record privacy (iOS `PlayRecordSection`, migration 20261019170000)

export type RecordPrivacySection = "powers" | "trials" | "battles";
export type RecordPrivacy = Record<RecordPrivacySection, LocationVisibility>;

/**
 * Who can see each part of the Record: one audience per part, no per-item
 * hiding (iOS 8c570350). Debates replaced battles but keep the
 * `battles_visibility` column, so older apps still read and set it.
 */
export const RECORD_PRIVACY_SECTIONS: Array<{id: RecordPrivacySection; column: string; header: string; footer: string}> = [
    {id: "powers", column: "powers_visibility", header: "WHO CAN SEE MY POWERS", footer: "Covers the Powers on your profile and their posts on Explore."},
    {id: "trials", column: "trials_visibility", header: "WHO CAN SEE MY TRIALS", footer: "Covers Trials you completed earlier and their posts on Explore, including your proof. Failed attempts are never shown to anyone."},
    {id: "battles", column: "battles_visibility", header: "WHO CAN SEE MY DEBATES", footer: "Covers your debates and past battles on your profile. A public debate is on Explore while people vote."}
];

export function decodeRecordPrivacy(row: Record<string, unknown> | null | undefined): RecordPrivacy {
    return {
        powers: normalizeLocationVisibility(row?.powers_visibility),
        trials: normalizeLocationVisibility(row?.trials_visibility),
        battles: normalizeLocationVisibility(row?.battles_visibility)
    };
}

/** iOS `playRecordPrivacySummary`: one audience for all of them reads as that audience; a mix reads as Custom. */
export function recordPrivacySummary(privacy: RecordPrivacy, words: SettingsWords = SETTINGS_WORDS_EN): string {
    const audiences = new Set(RECORD_PRIVACY_SECTIONS.map((section) => privacy[section.id]));
    if (audiences.size !== 1) return words.visibilityCustom;
    return locationVisibilityTitle(Array.from(audiences)[0], words);
}

/** A Record section's header and footer in the reader's language. */
export function recordPrivacySectionWords(id: RecordPrivacySection, words: SettingsWords = SETTINGS_WORDS_EN): {header: string; footer: string} {
    const key = id === "powers" ? "recordPowers" : id === "trials" ? "recordTrials" : "recordBattles";
    return {header: words[`${key}Header`], footer: words[`${key}Footer`]};
}

// MARK: - Sign-in methods

export function signInMethodLabel(provider: string) {
    switch (provider.trim().toLowerCase()) {
        case "apple": return "Sign in with Apple";
        case "email": return "Email and password";
        case "google": return "Google";
        case "github": return "GitHub";
        case "facebook": return "Facebook";
        case "twitter":
        case "x": return "X";
        case "discord": return "Discord";
        case "azure":
        case "microsoft": return "Microsoft";
        default: {
            const trimmed = provider.trim();
            return trimmed ? trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase() : "Signed in";
        }
    }
}

export function signInMethodLabels(providers: string[]) {
    return Array.from(new Set(providers.map(signInMethodLabel)));
}

/** A sign-in method's label (`signInMethodLabel`, English) in the reader's language; provider names stay as they are. */
export function localizedSignInMethodLabel(label: string, words: SettingsWords = SETTINGS_WORDS_EN) {
    if (label === "Sign in with Apple") return words.methodApple;
    if (label === "Email and password") return words.methodEmail;
    if (label === "Signed in") return words.signedIn;
    return label;
}

/** Why "Change Password" is absent for a provider-managed account. `labels` are `signInMethodLabels`' English. */
export function passwordChangeFootnote(labels: string[], words: SettingsWords = SETTINGS_WORDS_EN) {
    if (labels.includes("Sign in with Apple") && labels.length === 1) return words.footnoteAppleOnly;
    if (labels.includes("Sign in with Apple")) return words.footnoteAppleMixed;
    return words.footnoteProvider;
}

export function noEmailFootnote(labels: string[], words: SettingsWords = SETTINGS_WORDS_EN) {
    return labels.includes("Sign in with Apple") ? words.noEmailApple : words.noEmailProvider;
}

/** iOS `ChangePasswordView` limits. */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export function passwordChangeProblem(input: {current: string; next: string; confirm: string}, words: SettingsWords = SETTINGS_WORDS_EN) {
    if (!input.current) return words.passwordEnterCurrent;
    if (input.next.length < PASSWORD_MIN_LENGTH || input.next.length > PASSWORD_MAX_LENGTH) {
        return fillSettingsWords(words.passwordRule, {min: PASSWORD_MIN_LENGTH, max: PASSWORD_MAX_LENGTH});
    }
    if (input.next !== input.confirm) return words.passwordMismatch;
    if (input.next === input.current) return words.passwordSame;
    return null;
}

// MARK: - Account standing (RPC `my_account_standing`)

export type AccountStanding = {
    standing: "good" | "at_risk" | "suspended";
    strikeCount: number;
    maxStrikes: number;
    suspendedAt: string | null;
    suspensionReason: string | null;
    strikes: Array<{id: string; reason: string; createdAt: string}>;
    /** Strikes a review overturned (iOS `removedStrikes`, a key of its own so old clients never count them). */
    removedStrikes: Array<{id: string; reason: string; createdAt: string}>;
};

export const EMPTY_ACCOUNT_STANDING: AccountStanding = {
    standing: "good",
    strikeCount: 0,
    maxStrikes: 3,
    suspendedAt: null,
    suspensionReason: null,
    strikes: [],
    removedStrikes: []
};

function decodeStrikes(value: unknown): AccountStanding["strikes"] {
    return (Array.isArray(value) ? value : [])
        .filter((strike: Record<string, unknown>) => typeof strike?.id === "string")
        .map((strike: Record<string, unknown>) => ({
            id: strike.id as string,
            reason: typeof strike.reason === "string" ? strike.reason : "",
            createdAt: typeof strike.createdAt === "string" ? strike.createdAt : ""
        }));
}

/**
 * iOS `AccountStandingStatusHeader.statusLine`. The web has no dispute flow
 * yet, so it never adds "Tap a strike to dispute it." (Contact Support is
 * the way, as the ladder's footnote says).
 */
export function accountStandingStatusLine(standing: AccountStanding, words: SettingsWords = SETTINGS_WORDS_EN) {
    switch (standing.standing) {
        case "at_risk":
            return Math.max(standing.maxStrikes - standing.strikeCount, 1) === 1 ? words.statusOneMore : words.statusTwoMore;
        case "suspended":
            return words.statusSuspended;
        default:
            return words.statusGood;
    }
}

/** iOS `StrikeLadderSection`, without disputes. */
export function strikeLadder(words: SettingsWords = SETTINGS_WORDS_EN) {
    return [
        {count: 1, title: words.strike1Title, detail: words.strike1Detail},
        {count: 2, title: words.strike2Title, detail: words.strike2Detail},
        {count: 3, title: words.strike3Title, detail: words.strike3Detail}
    ] as const;
}
export const STRIKE_LADDER = strikeLadder();
export const STRIKE_LADDER_FOOTNOTE = SETTINGS_WORDS_EN.strikeFootnote;

export function decodeAccountStanding(value: unknown): AccountStanding {
    const row = value as Record<string, unknown> | null;
    if (!row || typeof row !== "object") return EMPTY_ACCOUNT_STANDING;
    const standing = row.standing === "at_risk" || row.standing === "suspended" ? row.standing : "good";
    return {
        standing,
        strikeCount: Math.max(0, Number(row.strikeCount) || 0),
        maxStrikes: Math.max(1, Number(row.maxStrikes) || 3),
        suspendedAt: typeof row.suspendedAt === "string" ? row.suspendedAt : null,
        suspensionReason: typeof row.suspensionReason === "string" && row.suspensionReason.trim() ? row.suspensionReason : null,
        strikes: decodeStrikes(row.strikes),
        removedStrikes: decodeStrikes(row.removedStrikes)
    };
}

export function accountStandingValue(standing: AccountStanding, words: SettingsWords = SETTINGS_WORDS_EN) {
    switch (standing.standing) {
        case "at_risk": return fillSettingsWords(words.standingAtRisk, {count: standing.strikeCount, max: standing.maxStrikes});
        case "suspended": return words.standingSuspended;
        default: return words.standingGood;
    }
}

export function accountStandingFooter(standing: AccountStanding) {
    switch (standing.standing) {
        case "at_risk": return "False or misleading details can result in an account strike. Three strikes suspend the account.";
        case "suspended": return standing.suspensionReason ?? "This account is suspended.";
        default: return "Your account is in good standing.";
    }
}

// MARK: - Missions row

// MARK: - Display currency (iOS `PriceDisplayCurrencyCatalog`, ECB reference rates 2026-04-22)

export const CURRENCY_PREFERENCE_COOKIE = "animaldex-currency";
export const CURRENCY_SYSTEM_VALUE = "system";

const EUR_PER_USD = 1.1733;
const UNITS_PER_EUR: Record<string, number> = {
    USD: EUR_PER_USD, EUR: 1, AUD: 1.6404, BRL: 5.8333, CAD: 1.6034, CHF: 0.9175, CNY: 8.0071, CZK: 24.347,
    DKK: 7.4735, GBP: 0.86903, HKD: 9.1892, HUF: 365.54, IDR: 20179.88, ILS: 3.521, INR: 110.0605,
    ISK: 143.8, JPY: 186.81, KRW: 1734.2, MXN: 20.3207, MYR: 4.6375, NOK: 10.912, NZD: 1.9866,
    PHP: 70.578, PLN: 4.2468, RON: 5.0942, SEK: 10.776, SGD: 1.4945, THB: 37.786, TRY: 52.7102, ZAR: 19.323
};

/** Same order as iOS: USD, EUR, then alphabetical. */
export const DISPLAY_CURRENCY_CODES = Object.keys(UNITS_PER_EUR);

export function isSupportedCurrency(code: string | null | undefined): code is string {
    return Boolean(code && UNITS_PER_EUR[code.toUpperCase()] != null);
}

/** A language tag's currency by its region ("en-GB" → GBP), for "System"; null without a known region. */
export function currencyForLanguage(tag: string | null | undefined): string | null {
    return currencyForCountry(regionOfLanguageTag(tag));
}

/** "system" (or anything unknown) resolves to the locale's currency, else USD. */
export function resolveDisplayCurrency(preference: string | null | undefined, localeCurrency?: string | null) {
    const normalized = preference?.trim().toUpperCase();
    if (normalized && normalized !== CURRENCY_SYSTEM_VALUE.toUpperCase() && isSupportedCurrency(normalized)) return normalized;
    const system = localeCurrency?.trim().toUpperCase();
    return isSupportedCurrency(system) ? system! : "USD";
}

export function convertFromUsd(amountUsd: number, currency: string) {
    const units = UNITS_PER_EUR[currency.toUpperCase()];
    if (units == null) return null;
    return (amountUsd / EUR_PER_USD) * units;
}

export function formatDisplayMoney(amountUsd: number, currency: string, locale?: string) {
    const converted = convertFromUsd(amountUsd, currency) ?? amountUsd;
    const code = convertFromUsd(amountUsd, currency) == null ? "USD" : currency.toUpperCase();
    return new Intl.NumberFormat(locale, {
        style: "currency",
        currency: code,
        maximumFractionDigits: converted >= 100 ? 0 : 2
    }).format(converted);
}

export function currencyDisplayName(code: string, locale?: string) {
    try {
        return new Intl.DisplayNames(locale ? [locale] : undefined, {type: "currency"}).of(code) ?? code;
    } catch {
        return code;
    }
}

/** The Currency row's value and the System option's title. */
export function currencySelectionLabel(preference: string | null | undefined, resolved: string, words: SettingsWords = SETTINGS_WORDS_EN) {
    const isSystem = !preference || preference.trim().toLowerCase() === CURRENCY_SYSTEM_VALUE;
    return isSystem ? fillSettingsWords(words.currencySystem, {currency: resolved}) : resolved;
}
