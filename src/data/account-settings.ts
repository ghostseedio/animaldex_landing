import "server-only";

import {cookies, headers} from "next/headers";
import {loadAppFeatureFlags} from "@/data/app-feature-flags";
import {isAppFeatureOn} from "@/lib/app-feature-flags";
import {
    type AccountStanding,
    CURRENCY_PREFERENCE_COOKIE,
    EMPTY_ACCOUNT_STANDING,
    type LocationVisibility,
    PUSH_PREFERENCE_COLUMNS,
    type PushPreferences,
    decodeAccountStanding,
    decodeRecordPrivacy,
    normalizeLocationVisibility,
    RECORD_PRIVACY_SECTIONS,
    type RecordPrivacy,
    resolveDisplayCurrency,
    signInMethodLabels
} from "@/lib/account-settings";
import {createSupabaseServerClient} from "@/lib/supabase/server";

/**
 * Everything the Settings tab shows, read as the signed-in user — iOS
 * `SettingsActivitySections.task`: location visibility, push preferences,
 * account standing and the auth identity, plus the drawer rows' values
 * (credits, active missions).
 */
export type SettingsOverview = {
    userId: string;
    email: string | null;
    signInMethods: string[];
    canChangePassword: boolean;
    isPro: boolean;
    creditBalance: number;
    locationVisibility: LocationVisibility;
    recordPrivacy: RecordPrivacy;
    push: PushPreferences;
    /** iOS `drawerIsForNewAccount`: no capture and no offer yet, so Shop, Locations, Guides and Gifts wait for the first one. */
    isNewAccount: boolean;
    /** iOS `drawerShowsEarnings`: a balance still to be paid out, or (while earning is on) anything ever earned. */
    showsEarnings: boolean;
    /** iOS: Trades & offers only while trades are on and there is a trade to look at. */
    showsTrades: boolean;
    /** The Instagram row: only while the import is on (shared SPEC section 3.2). */
    instagramImportOn: boolean;
    standing: AccountStanding;
    currencyPreference: string;
    displayCurrency: string;
};

/** The locale's currency for "System", from Accept-Language (e.g. en-GB → GBP). */
function localeCurrency() {
    const language = headers().get("accept-language")?.split(",")[0]?.trim() ?? "";
    const region = language.split("-")[1]?.toUpperCase();
    const byRegion: Record<string, string> = {
        GB: "GBP", US: "USD", ID: "IDR", AU: "AUD", CA: "CAD", NZ: "NZD", IN: "INR", JP: "JPY", KR: "KRW",
        SG: "SGD", MY: "MYR", PH: "PHP", TH: "THB", ZA: "ZAR", BR: "BRL", MX: "MXN", CH: "CHF", SE: "SEK",
        NO: "NOK", DK: "DKK", PL: "PLN", CZ: "CZK", HU: "HUF", RO: "RON", TR: "TRY", IL: "ILS", IS: "ISK",
        HK: "HKD", CN: "CNY", DE: "EUR", FR: "EUR", ES: "EUR", IT: "EUR", NL: "EUR", IE: "EUR", PT: "EUR",
        BE: "EUR", AT: "EUR", FI: "EUR", GR: "EUR"
    };
    return region ? byRegion[region] ?? null : null;
}

export function getCurrencyPreference() {
    const preference = cookies().get(CURRENCY_PREFERENCE_COOKIE)?.value ?? "system";
    const system = localeCurrency();
    return {preference, currency: resolveDisplayCurrency(preference, system), systemCurrency: resolveDisplayCurrency("system", system)};
}

export async function getSettingsOverview(): Promise<SettingsOverview | null> {
    const supabase = createSupabaseServerClient();
    if (!supabase) return null;

    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return null;

    const pushColumns = Object.values(PUSH_PREFERENCE_COLUMNS).join(",");
    const recordColumns = RECORD_PRIVACY_SECTIONS.map((section) => section.column).join(",");
    const [profileResult, balanceResult, standingResult, flags, earningsResult, tradesResult, capturesResult] = await Promise.all([
        supabase.from("profiles").select(`is_pro,location_visibility,${recordColumns},${pushColumns}`).eq("id", user.id).maybeSingle(),
        supabase.from("credit_balances").select("balance").eq("user_id", user.id).maybeSingle(),
        supabase.rpc("my_account_standing"),
        loadAppFeatureFlags(),
        supabase.rpc("get_my_earnings_summary"),
        supabase.from("trade_offer_detail_v1").select("id").limit(1),
        supabase.from("captures").select("id", {count: "exact", head: true}).eq("user_id", user.id)
    ]);
    const earning = isAppFeatureOn(flags, "creator_earnings");
    const earningRows = (earningsResult.error || !Array.isArray(earningsResult.data) ? [] : earningsResult.data) as Array<Record<string, unknown>>;
    const showsEarnings = earningRows.some((row) => {
        const amount = (key: string) => Number(row[key] ?? 0) || 0;
        const holdsBalance = amount("pending_amount_minor") !== 0 || amount("available_amount_minor") !== 0 || amount("held_amount_minor") !== 0;
        if (!earning) return holdsBalance;
        return holdsBalance || amount("lifetime_earned_amount_minor") !== 0 || amount("paid_amount_minor") !== 0;
    });
    const hasTrades = !tradesResult.error && Array.isArray(tradesResult.data) && tradesResult.data.length > 0;
    const hasCaptures = capturesResult.error ? true : (capturesResult.count ?? 0) > 0;

    const profile = (profileResult.data ?? {}) as Record<string, unknown>;
    const providers = Array.from(new Set([
        ...(user.identities ?? []).map((identity) => identity.provider),
        ...((user.app_metadata?.providers as string[] | undefined) ?? [])
    ].filter((provider): provider is string => typeof provider === "string" && provider.length > 0)));
    const currency = getCurrencyPreference();

    return {
        userId: user.id,
        email: user.email?.trim() || null,
        signInMethods: signInMethodLabels(providers),
        // iOS: a password exists only with an `email` identity.
        canChangePassword: providers.includes("email") && Boolean(user.email),
        isPro: profile.is_pro === true,
        creditBalance: Number((balanceResult.data as {balance?: number} | null)?.balance ?? 0) || 0,
        locationVisibility: normalizeLocationVisibility(profile.location_visibility),
        recordPrivacy: decodeRecordPrivacy(profile),
        push: {
            captureUpdates: profile[PUSH_PREFERENCE_COLUMNS.captureUpdates] !== false,
            socialActivity: profile[PUSH_PREFERENCE_COLUMNS.socialActivity] !== false,
            directMessages: profile[PUSH_PREFERENCE_COLUMNS.directMessages] !== false,
            animalMessages: profile[PUSH_PREFERENCE_COLUMNS.animalMessages] !== false,
            creditBonuses: profile[PUSH_PREFERENCE_COLUMNS.creditBonuses] !== false
        },
        isNewAccount: !hasCaptures && !hasTrades,
        showsEarnings,
        showsTrades: isAppFeatureOn(flags, "trades") && hasTrades,
        instagramImportOn: isAppFeatureOn(flags, "instagram_import"),
        standing: standingResult.error ? EMPTY_ACCOUNT_STANDING : decodeAccountStanding(standingResult.data),
        currencyPreference: currency.preference,
        displayCurrency: currency.currency
    };
}
