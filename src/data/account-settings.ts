import "server-only";

import {cookies, headers} from "next/headers";
import {getAppProgression} from "@/data/authenticated-app";
import {
    type AccountStanding,
    CURRENCY_PREFERENCE_COOKIE,
    EMPTY_ACCOUNT_STANDING,
    type LocationVisibility,
    PUSH_PREFERENCE_COLUMNS,
    type PushPreferences,
    decodeAccountStanding,
    normalizeLocationVisibility,
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
    activeMissionCount: number;
    locationVisibility: LocationVisibility;
    push: PushPreferences;
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
    const [profileResult, balanceResult, standingResult, progression] = await Promise.all([
        supabase.from("profiles").select(`is_pro,location_visibility,${pushColumns}`).eq("id", user.id).maybeSingle(),
        supabase.from("credit_balances").select("balance").eq("user_id", user.id).maybeSingle(),
        supabase.rpc("my_account_standing"),
        getAppProgression().catch(() => null)
    ]);

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
        activeMissionCount: progression?.missions.filter((mission) => !mission.isLocked && mission.completedCount === 0).length ?? 0,
        locationVisibility: normalizeLocationVisibility(profile.location_visibility),
        push: {
            captureUpdates: profile[PUSH_PREFERENCE_COLUMNS.captureUpdates] !== false,
            socialActivity: profile[PUSH_PREFERENCE_COLUMNS.socialActivity] !== false,
            directMessages: profile[PUSH_PREFERENCE_COLUMNS.directMessages] !== false,
            creditBonuses: profile[PUSH_PREFERENCE_COLUMNS.creditBonuses] !== false
        },
        standing: standingResult.error ? EMPTY_ACCOUNT_STANDING : decodeAccountStanding(standingResult.data),
        currencyPreference: currency.preference,
        displayCurrency: currency.currency
    };
}
