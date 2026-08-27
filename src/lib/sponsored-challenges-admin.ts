/** Internal /admin Sponsored Challenges helpers. No service-role values. */

export const CAMPAIGN_STATUSES = [
  "draft",
  "submitted",
  "approved",
  "scheduled",
  "live",
  "completed",
  "rejected",
  "archived",
] as const;

export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const OBJECTIVE_TYPES = [
  "unique_indexed_entries",
  "eligible_capture_count",
  "active_capture_days",
] as const;

export type ObjectiveType = (typeof OBJECTIVE_TYPES)[number];

export const GEO_MODES = ["unrestricted", "allowlist", "denylist"] as const;
export type GeoMode = (typeof GEO_MODES)[number];

export const LIFECYCLE_EDGES = [
  "draft → submitted → approved → scheduled → live → completed → archived",
  "submitted → rejected",
  "archive is an operational kill switch",
] as const;

export const APPLE_DISCLAIMER =
  "Apple is not a sponsor of this Challenge and is not involved in any way.";

export const DISCOVERY_GEOGRAPHY_COPY =
  "Country targeting controls discovery only. Participation in venue campaigns is validated from trusted capture GPS at the venue.";

export const NON_VENUE_COUNTRY_COPY =
  "Country cannot currently be used as authoritative participation eligibility without a trusted server-side country source. Publishing a non-venue allowlist or denylist fails with authoritative_country_unavailable.";

export const VENUE_SECURITY_COPY =
  "Venue-qualified captures require trusted device GPS, accepted location accuracy and fix freshness, and must fall inside the venue validation radius. External/imported captures do not qualify.";

export const ARCHIVE_COPY =
  "Archiving removes the campaign from discovery and prevents new joins and future qualifying progress. Previously granted deterministic achievements are not automatically removed.";

export const RULES_HISTORY_COPY =
  "Existing participants remain bound to the version they accepted.";

export const VENUE_CONSTRAINT_COPY =
  "A venue forces live_only = true and external_imports_allowed = false. The backend enforces this; the editor cannot weaken it.";

export const FORBIDDEN_ADMIN_DTO_KEYS = [
  "user_id",
  "email",
  "location_accuracy_m",
  "location_fix_at",
  "location_evidence_source",
  "capture_id",
  "observation_id",
  "participant_id",
  "eligibility_snapshot",
  "service_role",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SECRET_KEY",
] as const;

export const LIFECYCLE_RPC: Record<
  "submit" | "approve" | "reject" | "archive",
  {
    rpc: string;
    action?: "approve" | "reject";
  }
> = {
  submit: { rpc: "admin_submit_sponsored_campaign" },
  approve: { rpc: "admin_review_sponsored_campaign", action: "approve" },
  reject: { rpc: "admin_review_sponsored_campaign", action: "reject" },
  archive: { rpc: "admin_archive_sponsored_campaign" },
};

export type CampaignDraftInput = {
  id?: string | null;
  slug: string;
  title: string;
  publicSummary: string;
  description: string;
  presenterName?: string | null;
  sponsorOrganizationId?: string | null;
  startsAt: string;
  endsAt: string;
  timezoneIdentifier: string;
  objectiveType: string;
  targetCount: number;
  officialRules: string;
  rewardTerms: string;
  requiredTypeTag?: string | null;
  requiredSettingTag?: string | null;
  minimumCaptureGrade?: number | null;
  liveOnly: boolean;
  externalImportsAllowed: boolean;
  discoveryRadiusM?: number | null;
  geoMode: string;
  hasVenue: boolean;
};

export type VenueDraftInput = {
  displayName: string;
  latitude: number;
  longitude: number;
  validationRadiusM: number;
  googlePlaceId?: string | null;
  countryCode?: string | null;
};

export type AchievementDraftInput = {
  slug: string;
  title: string;
  detail: string;
};

export type CashRewardDraftInput = {
  amountMinor: number;
  currencyCode: string;
  maxRecipients: number;
  platformFeeMinor: number;
};

export type AdminCashReward = CashRewardDraftInput & {
  fundingStatus: "draft" | "pending" | "confirmed" | "cancelled" | "refunded";
  fundedAmountMinor: number;
  allocatedRecipients: number;
  remainingRecipients: number;
  rewardLiabilityMinor: number;
  campaignTotalMinor: number;
  fundedAt: string | null;
  fundingReference: string | null;
};

export type AdminCampaignListItem = {
  id: string;
  title: string;
  slug: string;
  authorship: "animaldex" | "sponsored";
  presenterName: string | null;
  sponsorOrganizationId: string | null;
  sponsorDisplayName: string | null;
  status: CampaignStatus;
  startsAt: string;
  endsAt: string;
  timezoneIdentifier: string;
  objectiveType: ObjectiveType;
  targetCount: number;
  venueName: string | null;
  rewardTitle: string | null;
  rulesVersion: number;
  updatedAt: string;
};

export type AdminRuleVersion = {
  rulesVersion: number;
  officialRules: string;
  rewardTerms: string;
  appleDisclaimer: string;
  createdAt: string;
};

export type AdminCampaignStats = {
  participantCount: number;
  completedCount: number;
  qualifyingCaptureCount: number;
};

export type AdminCampaignDetail = AdminCampaignListItem & {
  publicSummary: string;
  description: string;
  officialRules: string;
  rewardTerms: string;
  appleDisclaimer: string;
  requiredTypeTag: string | null;
  requiredSettingTag: string | null;
  minimumCaptureGrade: number | null;
  liveOnly: boolean;
  externalImportsAllowed: boolean;
  discoveryRadiusM: number | null;
  geoMode: GeoMode;
  discoveryCountries: string[];
  discoveryIsAuthoritative: false;
  venue: {
    displayName: string;
    googlePlaceId: string | null;
    latitude: number;
    longitude: number;
    validationRadiusM: number;
    countryCode: string | null;
  } | null;
  reward: {
    type: "achievement";
    slug: string | null;
    title: string | null;
    detail: string | null;
  } | null;
  cashReward: AdminCashReward | null;
  thumbnail: {
    storagePath: string;
    publicUrl: string;
    altText: string;
    updatedAt: string | null;
  } | null;
  ruleVersions: AdminRuleVersion[];
  stats: AdminCampaignStats | null;
  publishBlockedReason: string | null;
};

export function isCampaignStatus(value: string): value is CampaignStatus {
  return (CAMPAIGN_STATUSES as readonly string[]).includes(value);
}

export function isObjectiveType(value: string): value is ObjectiveType {
  return (OBJECTIVE_TYPES as readonly string[]).includes(value);
}

export function isGeoMode(value: string): value is GeoMode {
  return (GEO_MODES as readonly string[]).includes(value);
}

export function groupCampaignsByStatus<T extends { status: string }>(
  campaigns: T[],
) {
  const groups = Object.fromEntries(
    CAMPAIGN_STATUSES.map((status) => [status, [] as T[]]),
  ) as Record<CampaignStatus, T[]>;
  for (const campaign of campaigns) {
    if (isCampaignStatus(campaign.status)) {
      groups[campaign.status].push(campaign);
    }
  }
  return groups;
}

export function canEditCampaign(status: string) {
  return status === "draft" || status === "submitted" || status === "rejected";
}

export function canSubmitCampaign(status: string) {
  return status === "draft" || status === "rejected";
}

export function canReviewCampaign(status: string) {
  return status === "submitted";
}

export function canReviseRules(status: string) {
  return [
    "draft",
    "submitted",
    "rejected",
    "approved",
    "scheduled",
    "live",
  ].includes(status);
}

export function canArchiveCampaign(status: string) {
  return ["approved", "scheduled", "live", "completed"].includes(status);
}

export function isArchivedShownAsLive(status: string) {
  return status === "archived";
}

export function authorshipLabel(
  sponsorOrganizationId: string | null,
  presenterName: string | null,
) {
  if (sponsorOrganizationId) {
    return presenterName?.trim()
      ? `Sponsored · ${presenterName.trim()}`
      : "Sponsored";
  }
  return presenterName?.trim()
    ? `AnimalDex · ${presenterName.trim()}`
    : "AnimalDex-authored";
}

export function objectiveLabel(type: string) {
  if (type === "unique_indexed_entries") return "Unique indexed entries";
  if (type === "eligible_capture_count") return "Eligible capture count";
  if (type === "active_capture_days") return "Active capture days";
  return type;
}

export function lifecycleButtons(status: string) {
  return {
    submit: canSubmitCampaign(status) ? LIFECYCLE_RPC.submit : null,
    approve: canReviewCampaign(status) ? LIFECYCLE_RPC.approve : null,
    reject: canReviewCampaign(status) ? LIFECYCLE_RPC.reject : null,
    archive: canArchiveCampaign(status) ? LIFECYCLE_RPC.archive : null,
  };
}

export function nonVenueCountryRestrictionBlocked(
  geoMode: string,
  hasVenue: boolean,
) {
  return !hasVenue && geoMode !== "unrestricted";
}

export function publishBlockedReason(geoMode: string, hasVenue: boolean) {
  return nonVenueCountryRestrictionBlocked(geoMode, hasVenue)
    ? "authoritative_country_unavailable"
    : null;
}

export function applyVenueConstraints(
  input: CampaignDraftInput,
): CampaignDraftInput {
  if (!input.hasVenue) return input;
  return {
    ...input,
    liveOnly: true,
    externalImportsAllowed: false,
  };
}

/**
 * Canonical persisted values for campaign tags.
 *
 * Type tags: evaluator matches `lower(btrim(capture_tag)) = lower(btrim(required))`.
 * Capture `type_tags` and official SQL fixtures use title-case (`Bird`).
 *
 * Setting tags: evaluator compares
 * `sponsored_campaign_normalize_setting` on both sides, which calls
 * `capture_game_stats_setting_tag(value, NULL)` — a case-sensitive CASE.
 * `zoo` becomes `Unknown` and will not match a capture stored as `Zoo`.
 * Official fixtures and iOS `SettingTag` raw values are title-case (`Zoo`).
 *
 * Preferred lowercase stored values are therefore not compatible for settings.
 * Do not change the SQL helper; serialize title-case instead.
 */
export const CANONICAL_SETTING_TAGS = [
  "Wild",
  "Zoo",
  "Farm",
  "Domestic",
  "Unknown",
] as const;
export const CANONICAL_TYPE_TAGS = [
  "Big Cat",
  "Bird",
  "Reptile",
  "Mammal",
  "Rainforest",
  "Safari",
  "Herbivore",
  "Amphibian",
  "Domestic",
  "Pet",
  "Farm Animal",
  "Feline",
  "Canine",
  "Livestock",
  "Primate",
  "Aquatic",
  "Rodent",
  "Ungulate",
] as const;

function matchCanonical(
  value: string,
  known: readonly string[],
): string | undefined {
  const trimmed = value.trim();
  return known.find((item) => item.toLowerCase() === trimmed.toLowerCase());
}

export function canonicalizeSettingTag(value?: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return matchCanonical(trimmed, CANONICAL_SETTING_TAGS) ?? null;
}

export function canonicalizeTypeTag(value?: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return matchCanonical(trimmed, CANONICAL_TYPE_TAGS) ?? trimmed;
}

export function settingTagDisplayLabel(value?: string | null): string {
  return canonicalizeSettingTag(value) ?? value?.trim() ?? "";
}

export function typeTagDisplayLabel(value?: string | null): string {
  return canonicalizeTypeTag(value) ?? "";
}

/** Exact mirror of `capture_game_stats_setting_tag(p_setting, NULL)`. Not a second rules engine. */
export function backendNormalizeSetting(value?: string | null): string {
  switch ((value ?? "").trim()) {
    case "Zoo":
      return "Zoo";
    case "Farm":
      return "Farm";
    case "Domestic":
      return "Domestic";
    case "Wild":
      return "Wild";
    default:
      return "Unknown";
  }
}

export function backendTypeTagMatches(
  captureTag: string,
  requiredTag: string,
): boolean {
  return captureTag.trim().toLowerCase() === requiredTag.trim().toLowerCase();
}

export function backendSettingMatches(
  captureSetting: string,
  requiredSetting: string,
): boolean {
  return (
    backendNormalizeSetting(captureSetting) ===
    backendNormalizeSetting(requiredSetting)
  );
}

export function serializeCampaignUpsert(input: CampaignDraftInput) {
  const draft = applyVenueConstraints(input);
  if (!isObjectiveType(draft.objectiveType)) {
    throw new Error("unsupported_objective");
  }
  if (!isGeoMode(draft.geoMode)) {
    throw new Error("invalid_geo_mode");
  }
  if (!Number.isInteger(draft.targetCount) || draft.targetCount < 1) {
    throw new Error("invalid_target_count");
  }
  return {
    p_slug: draft.slug.trim(),
    p_title: draft.title.trim(),
    p_public_summary: draft.publicSummary.trim(),
    p_description: draft.description.trim(),
    p_starts_at: draft.startsAt,
    p_ends_at: draft.endsAt,
    p_objective_type: draft.objectiveType,
    p_target_count: draft.targetCount,
    p_official_rules: draft.officialRules.trim(),
    p_reward_terms: draft.rewardTerms.trim(),
    p_id: draft.id?.trim() || null,
    p_sponsor_organization_id: draft.sponsorOrganizationId?.trim() || null,
    p_presenter_name: draft.presenterName?.trim() || null,
    p_required_type_tag: canonicalizeTypeTag(draft.requiredTypeTag),
    p_required_setting_tag: canonicalizeSettingTag(draft.requiredSettingTag),
    p_minimum_capture_grade: draft.minimumCaptureGrade ?? null,
    p_live_only: draft.liveOnly,
    p_external_imports_allowed: draft.externalImportsAllowed,
    p_discovery_radius_m: draft.discoveryRadiusM ?? null,
    p_timezone_identifier: draft.timezoneIdentifier.trim() || "UTC",
    p_geo_mode: draft.geoMode,
  };
}

export function serializeVenueUpsert(
  campaignId: string,
  input: VenueDraftInput,
) {
  if (input.validationRadiusM < 25 || input.validationRadiusM > 50000) {
    throw new Error("invalid_validation_radius");
  }
  return {
    p_campaign_id: campaignId,
    p_display_name: input.displayName.trim(),
    p_latitude: input.latitude,
    p_longitude: input.longitude,
    p_validation_radius_m: input.validationRadiusM,
    p_google_place_id: input.googlePlaceId?.trim() || null,
    p_country_code: input.countryCode?.trim().toUpperCase() || null,
  };
}

export function serializeGeoCountries(
  campaignId: string,
  countryCodes: string[],
) {
  return {
    p_campaign_id: campaignId,
    p_country_codes: countryCodes
      .map((code) => code.trim().toUpperCase())
      .filter((code) => /^[A-Z]{2}$/.test(code)),
  };
}

export function serializeAchievementReward(
  campaignId: string,
  input: AchievementDraftInput,
) {
  if (!input.slug.trim() || !input.title.trim() || !input.detail.trim()) {
    throw new Error("achievement_required");
  }
  return {
    p_campaign_id: campaignId,
    p_achievement_slug: input.slug.trim(),
    p_achievement_title: input.title.trim(),
    p_achievement_detail: input.detail.trim(),
  };
}

export function cashRewardLiability(input: CashRewardDraftInput) {
  return input.amountMinor * input.maxRecipients;
}

export function cashCampaignTotal(input: CashRewardDraftInput) {
  return cashRewardLiability(input) + input.platformFeeMinor;
}

export function serializeCashReward(
  campaignId: string,
  input: CashRewardDraftInput,
) {
  const currencyCode = input.currencyCode.trim().toUpperCase();
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0)
    throw new Error("invalid_cash_reward");
  if (!Number.isSafeInteger(input.maxRecipients) || input.maxRecipients <= 0)
    throw new Error("invalid_cash_reward");
  if (
    !Number.isSafeInteger(input.platformFeeMinor) ||
    input.platformFeeMinor < 0
  )
    throw new Error("invalid_cash_reward");
  if (!/^[A-Z]{3}$/.test(currencyCode)) throw new Error("invalid_currency");
  return {
    p_campaign_id: campaignId,
    p_amount_minor: input.amountMinor,
    p_currency_code: currencyCode,
    p_max_recipients: input.maxRecipients,
    p_platform_fee_minor: input.platformFeeMinor,
  };
}

export function serializeCashFundingConfirmation(
  campaignId: string,
  input: CashRewardDraftInput,
  fundingReference: string,
) {
  if (!fundingReference.trim()) throw new Error("funding_reference_required");
  return {
    p_campaign_id: campaignId,
    p_funded_amount_minor: cashCampaignTotal(input),
    p_funding_reference: fundingReference.trim(),
  };
}

export function serializeRulesRevision(
  campaignId: string,
  officialRules: string,
  rewardTerms: string,
) {
  return {
    p_campaign_id: campaignId,
    p_official_rules: officialRules.trim(),
    p_reward_terms: rewardTerms.trim(),
  };
}

export function parseAdminRpcError(message: string) {
  const text = message.toLowerCase();
  if (text.includes("authoritative_country_unavailable")) {
    return {
      code: "authoritative_country_unavailable",
      message: NON_VENUE_COUNTRY_COPY,
    };
  }
  if (text.includes("apple_disclaimer_required")) {
    return {
      code: "apple_disclaimer_required",
      message: "Official rules must include the Apple disclaimer.",
    };
  }
  if (text.includes("reward_required")) {
    return {
      code: "reward_required",
      message: "An achievement reward is required before submit.",
    };
  }
  if (text.includes("venue_requires_live_only")) {
    return { code: "venue_requires_live_only", message: VENUE_CONSTRAINT_COPY };
  }
  if (text.includes("unsupported_reward_type")) {
    return {
      code: "unsupported_reward_type",
      message:
        "Supported rewards are Achievement only or fixed Cash + Achievement.",
    };
  }
  if (text.includes("cash_campaign_funding_not_confirmed")) {
    return {
      code: "cash_campaign_funding_not_confirmed",
      message:
        "Confirm the campaign's full cash funding before approval or publication.",
    };
  }
  if (text.includes("invalid_lifecycle")) {
    return {
      code: "invalid_lifecycle",
      message: "That lifecycle action is not available in the current status.",
    };
  }
  if (text.includes("campaign_not_editable")) {
    return {
      code: "campaign_not_editable",
      message:
        "This campaign can no longer be edited. Use a rules revision for copy changes, or archive and create a new campaign for eligibility changes.",
    };
  }
  return { code: "rpc_error", message };
}

export function currentRulesVersion(
  versions: AdminRuleVersion[],
  campaignVersion: number,
) {
  return versions.find((row) => row.rulesVersion === campaignVersion) ?? null;
}

export function historicalRulesVersions(
  versions: AdminRuleVersion[],
  campaignVersion: number,
) {
  return versions.filter((row) => row.rulesVersion !== campaignVersion);
}

export function containsForbiddenAdminDtoKeys(value: unknown): string[] {
  const found = new Set<string>();
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    for (const [key, child] of Object.entries(
      node as Record<string, unknown>,
    )) {
      if ((FORBIDDEN_ADMIN_DTO_KEYS as readonly string[]).includes(key)) {
        found.add(key);
      }
      walk(child);
    }
  };
  walk(value);
  return Array.from(found);
}

export function assertSafeAdminDto(value: unknown) {
  const forbidden = containsForbiddenAdminDtoKeys(value);
  if (forbidden.length) {
    throw new Error(`admin_dto_leaked:${forbidden.join(",")}`);
  }
  return value;
}

export function toListItem(row: {
  id: string;
  title: string;
  slug: string;
  presenter_name: string | null;
  sponsor_organization_id: string | null;
  sponsor_display_name?: string | null;
  status: string;
  starts_at: string;
  ends_at: string;
  timezone_identifier: string;
  objective_type: string;
  target_count: number;
  venue_name?: string | null;
  reward_title?: string | null;
  rules_version: number;
  updated_at: string;
}): AdminCampaignListItem {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    authorship: row.sponsor_organization_id ? "sponsored" : "animaldex",
    presenterName: row.presenter_name,
    sponsorOrganizationId: row.sponsor_organization_id,
    sponsorDisplayName: row.sponsor_display_name ?? null,
    status: isCampaignStatus(row.status) ? row.status : "draft",
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    timezoneIdentifier: row.timezone_identifier,
    objectiveType: isObjectiveType(row.objective_type)
      ? row.objective_type
      : "eligible_capture_count",
    targetCount: row.target_count,
    venueName: row.venue_name ?? null,
    rewardTitle: row.reward_title ?? null,
    rulesVersion: row.rules_version,
    updatedAt: row.updated_at,
  };
}

export const SUPPORTED_REWARD_TYPES = [
  "achievement",
  "cash_and_achievement",
] as const;

export function isUnsupportedRewardType(type: string) {
  return !(SUPPORTED_REWARD_TYPES as readonly string[]).includes(type);
}
