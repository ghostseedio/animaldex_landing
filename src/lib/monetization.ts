/**
 * Phase 7A monetization / payout eligibility decode helpers.
 * Clients render reason codes; they do not invent eligibility.
 */

export type PayoutEligibility = {
    eligible: boolean;
    payoutsEnabled: boolean;
    betaMember: boolean;
    countryState: string;
    countryCode?: string | null;
    legalCapacityState: string;
    identityState: string;
    taxState: string;
    payoutProfileState: string;
    accountStanding: string;
    payoutReadiness?: string;
    reasonCodes: string[];
    setupComplete?: boolean;
    maskedDestination?: string | null;
    destinationCurrency?: string | null;
    destinationCountry?: string | null;
    destinationType?: string | null;
    provider?: string | null;
    canWithdraw?: boolean;
};

export function mapPayoutEligibility(row: Record<string, unknown>): PayoutEligibility {
    const reasons = Array.isArray(row.reasonCodes)
        ? row.reasonCodes.map(String)
        : Array.isArray(row.reason_codes)
          ? (row.reason_codes as unknown[]).map(String)
          : [];
    return {
        eligible: Boolean(row.eligible),
        payoutsEnabled: Boolean(row.payoutsEnabled ?? row.payouts_enabled),
        betaMember: Boolean(row.betaMember ?? row.beta_member),
        countryState: String(row.countryState ?? row.country_state ?? "unknown"),
        countryCode:
            row.countryCode == null && row.country_code == null
                ? null
                : String(row.countryCode ?? row.country_code),
        legalCapacityState: String(row.legalCapacityState ?? row.legal_capacity_state ?? "unknown"),
        identityState: String(row.identityState ?? row.identity_state ?? "not_started"),
        taxState: String(row.taxState ?? row.tax_state ?? "not_started"),
        payoutProfileState: String(row.payoutProfileState ?? row.payout_profile_state ?? "missing"),
        accountStanding: String(row.accountStanding ?? row.account_standing ?? "good"),
        payoutReadiness: String(row.payoutReadiness ?? row.payout_readiness ?? "not_started"),
        reasonCodes: reasons,
        setupComplete: Boolean(row.setupComplete ?? row.setup_complete),
        maskedDestination:
            row.maskedDestination == null && row.masked_destination == null
                ? null
                : String(row.maskedDestination ?? row.masked_destination),
        destinationCurrency:
            row.destinationCurrency == null && row.destination_currency == null
                ? null
                : String(row.destinationCurrency ?? row.destination_currency),
        destinationCountry:
            row.destinationCountry == null && row.destination_country == null
                ? null
                : String(row.destinationCountry ?? row.destination_country),
        destinationType:
            row.destinationType == null && row.destination_type == null
                ? null
                : String(row.destinationType ?? row.destination_type),
        provider: row.provider == null ? null : String(row.provider),
        canWithdraw: Boolean(row.canWithdraw ?? row.can_withdraw ?? row.eligible)
    };
}

export function sharedPasswordMayApproveFinance(kind: string): boolean {
    return kind === "named_email";
}
