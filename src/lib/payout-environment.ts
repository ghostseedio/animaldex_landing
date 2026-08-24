/**
 * Phase 7B environment compatibility for Wise sandbox payouts.
 * Hard refuse: production AnimalDex + sandbox fixtures; local/staging + Wise production.
 */

export type AnimaldexEnvironmentLabel = "production" | "staging" | "local" | "unknown";
export type ProviderEnvironment = "sandbox" | "production";

export class PayoutEnvironmentError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "PayoutEnvironmentError";
    }
}

export function assertPayoutEnvironmentCompatible(input: {
    animaldexEnvironment: string;
    providerEnvironment: ProviderEnvironment;
    allowFixtureGeneration?: boolean;
}) {
    const animaldex = (input.animaldexEnvironment || "unknown").toLowerCase();
    const provider = input.providerEnvironment;
    const fixtures = Boolean(input.allowFixtureGeneration);

    if (animaldex === "production" && provider === "sandbox" && fixtures) {
        throw new PayoutEnvironmentError("refuse_production_supabase_with_sandbox_fixtures");
    }
    if ((animaldex === "local" || animaldex === "staging") && provider === "production") {
        throw new PayoutEnvironmentError("refuse_nonprod_animaldex_with_wise_production");
    }
    if (animaldex === "production" && provider === "production" && fixtures) {
        throw new PayoutEnvironmentError("refuse_production_fixture_generation");
    }
}

export function isLocalOrStagingAnimaldex(label: string): boolean {
    return label === "local" || label === "staging";
}
