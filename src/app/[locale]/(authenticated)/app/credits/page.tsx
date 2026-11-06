import CreditsClient from "./credits-client";
import {getAuthenticatedSupabaseUser} from "@/data/authenticated-app";
import {loadProPlanPrices} from "@/lib/paddle-prices";
import {getScopedTranslator} from "@/loaders/translation";
import {getCreditsWords} from "@/loaders/credits-words";

export const dynamic = "force-dynamic";

const PROVIDER_LABELS: Record<string, string> = {apple: "Apple", google: "Google"};

export default async function CreditsPage({params}: {params: {locale: string}}) {
    // Purchases land on this account. Shown above the buy buttons so someone
    // signed in here with a different provider than in the app notices first.
    // Paddle's own price (and trial) for each Pro plan; the catalog's price stands in when Paddle can't be read.
    const [session, t, proPlans, words] = await Promise.all([getAuthenticatedSupabaseUser(), getScopedTranslator(params.locale, "appCredits"), loadProPlanPrices(), getCreditsWords(params.locale)]);
    const provider = session?.user.app_metadata?.provider;
    return (
        <CreditsClient
            proPlans={proPlans}
            words={words}
            packDetails={{purchase_25: t("packDetail25"), purchase_100: t("packDetail100")}}
            account={session?.user.email ? {
                email: session.user.email,
                provider: typeof provider === "string" ? PROVIDER_LABELS[provider] ?? null : null
            } : null}
        />
    );
}
