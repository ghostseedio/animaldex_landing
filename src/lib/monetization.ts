/**
 * Phase 7A monetization / payout eligibility decode helpers.
 * Clients render reason codes; they do not invent eligibility.
 */

export type PayoutEligibility = {
    eligible: boolean;
    payoutsEnabled: boolean;
    betaMember: boolean;
    countryState: string;
    legalCapacityState: string;
    identityState: string;
    taxState: string;
    payoutProfileState: string;
    accountStanding: string;
    reasonCodes: string[];
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
        legalCapacityState: String(row.legalCapacityState ?? row.legal_capacity_state ?? "unknown"),
        identityState: String(row.identityState ?? row.identity_state ?? "not_started"),
        taxState: String(row.taxState ?? row.tax_state ?? "not_started"),
        payoutProfileState: String(row.payoutProfileState ?? row.payout_profile_state ?? "missing"),
        accountStanding: String(row.accountStanding ?? row.account_standing ?? "good"),
        reasonCodes: reasons
    };
}

export function sharedPasswordMayApproveFinance(kind: string): boolean {
    return kind === "named_email";
}
