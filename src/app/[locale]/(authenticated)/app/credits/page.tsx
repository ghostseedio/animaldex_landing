import CreditsClient from "./credits-client";
import {getAuthenticatedSupabaseUser} from "@/data/authenticated-app";

export const dynamic = "force-dynamic";

const PROVIDER_LABELS: Record<string, string> = {apple: "Apple", google: "Google"};

export default async function CreditsPage() {
    // Purchases land on this account. Shown above the buy buttons so someone
    // signed in here with a different provider than in the app notices first.
    const session = await getAuthenticatedSupabaseUser();
    const provider = session?.user.app_metadata?.provider;
    return (
        <CreditsClient
            account={session?.user.email ? {
                email: session.user.email,
                provider: typeof provider === "string" ? PROVIDER_LABELS[provider] ?? null : null
            } : null}
        />
    );
}
