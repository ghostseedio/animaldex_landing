/** Deterministic campaign-readiness checks. UX only — backend validation remains authoritative. */

import {
  APPLE_DISCLAIMER,
  DISCOVERY_GEOGRAPHY_COPY,
  NON_VENUE_COUNTRY_COPY,
  RULES_HISTORY_COPY,
  VENUE_CONSTRAINT_COPY,
  isObjectiveType,
  publishBlockedReason,
} from "@/lib/sponsored-challenges-admin";
import {
  CAMPAIGN_TEMPLATES,
  isValidCampaignSlug,
  isValidDateRange,
  type CampaignTemplateId,
} from "@/lib/sponsored-challenge-builder";
import type { CampaignDraftInput } from "@/lib/sponsored-challenges-admin";

export const VENUE_VALIDATION_RADIUS_MIN = 25;
export const VENUE_VALIDATION_RADIUS_MAX = 50000;

export type ReadinessSeverity = "ready" | "warning" | "blocking";

export type ReadinessCheck = {
  id: string;
  label: string;
  severity: ReadinessSeverity;
  detail?: string;
};

export type FieldWarningKey =
  | "venue"
  | "dates"
  | "imports"
  | "geo"
  | "reward"
  | "sponsor"
  | "rulesHistory"
  | "liveOnly";

export type ReadinessInput = {
  draft: CampaignDraftInput;
  templateId: CampaignTemplateId;
  venueName: string;
  venueLat: string;
  venueLng: string;
  venueRadius: string;
  achievementSlug: string;
  achievementTitle: string;
  achievementDetail: string;
  cashEnabled?: boolean;
  cashFundingStatus?: string | null;
  hasPersistedDraft: boolean;
  persistedRulesVersion: number | null;
  hasHistoricalRules: boolean;
  discoveryCountries: string[];
};

export type ReadinessResult = {
  checks: ReadinessCheck[];
  passed: number;
  total: number;
  blocking: ReadinessCheck[];
  warnings: ReadinessCheck[];
  ready: boolean;
  fieldWarnings: Partial<Record<FieldWarningKey, string>>;
};

function present(value?: string | null): boolean {
  return Boolean(value && value.trim());
}

function venueExpected(input: ReadinessInput): boolean {
  return CAMPAIGN_TEMPLATES[input.templateId].expectsVenue;
}

function venueConfigured(input: ReadinessInput): boolean {
  return (
    present(input.venueName) ||
    present(input.venueLat) ||
    present(input.venueLng) ||
    input.draft.hasVenue
  );
}

function parseCoordinate(value: string): number | null {
  if (!value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function radiusValue(value: string): number | null {
  if (!value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function evaluateReadiness(input: ReadinessInput): ReadinessResult {
  const checks: ReadinessCheck[] = [];
  const fieldWarnings: Partial<Record<FieldWarningKey, string>> = {};
  const needsVenue = venueExpected(input) || venueConfigured(input);
  const hasVenueComplete =
    present(input.venueName) &&
    parseCoordinate(input.venueLat) != null &&
    parseCoordinate(input.venueLng) != null;
  const radius = radiusValue(input.venueRadius);
  const radiusValid =
    radius != null &&
    radius >= VENUE_VALIDATION_RADIUS_MIN &&
    radius <= VENUE_VALIDATION_RADIUS_MAX;
  const geoBlocked = publishBlockedReason(
    input.draft.geoMode,
    hasVenueComplete,
  );
  const sponsored = Boolean(input.draft.sponsorOrganizationId);
  const achievementConfigured =
    present(input.achievementSlug) &&
    present(input.achievementTitle) &&
    present(input.achievementDetail);
  const datesValid = isValidDateRange(input.draft.startsAt, input.draft.endsAt);
  const liveOnly = needsVenue ? true : input.draft.liveOnly;
  const importsAllowed = needsVenue
    ? false
    : input.draft.externalImportsAllowed;
  const cashFundingConfirmed =
    !input.cashEnabled || input.cashFundingStatus === "confirmed";
  const cashTermsCompatible =
    !input.cashEnabled || !/no cash/i.test(input.draft.rewardTerms);

  const required: Array<[string, string, boolean, string?]> = [
    ["title", "Title present", present(input.draft.title)],
    [
      "slug",
      "Valid slug",
      isValidCampaignSlug(input.draft.slug),
      "Use a lowercase hyphenated slug.",
    ],
    ["summary", "Summary present", present(input.draft.publicSummary)],
    ["description", "Description present", present(input.draft.description)],
    ["dates", "Valid start and end", datesValid, "End must be after start."],
    [
      "objective",
      "Objective present",
      isObjectiveType(input.draft.objectiveType),
    ],
    [
      "target",
      "Target greater than 0",
      Number.isInteger(input.draft.targetCount) && input.draft.targetCount > 0,
    ],
    ["timezone", "Timezone present", present(input.draft.timezoneIdentifier)],
    ["rules", "Official rules present", present(input.draft.officialRules)],
    ["reward_terms", "Reward terms present", present(input.draft.rewardTerms)],
    [
      "achievement",
      "Achievement reward configured",
      achievementConfigured,
      "Every campaign requires an achievement reward.",
    ],
  ];
  if (input.cashEnabled) {
    required.push([
      "cash_funding",
      "Cash reward fully funded",
      cashFundingConfirmed,
      "Save this reward configuration, then enter the funding reference and confirm the full campaign total before approval.",
    ]);
    required.push([
      "cash_reward_terms",
      "Reward terms describe the cash reward",
      cashTermsCompatible,
      "Replace the achievement-only ‘no cash’ terms with the fixed amount and inventory terms.",
    ]);
  }

  for (const [id, label, ok, detail] of required) {
    checks.push({
      id,
      label,
      severity: ok ? "ready" : "blocking",
      detail: ok ? undefined : detail,
    });
  }
  if (!datesValid) fieldWarnings.dates = "Challenge ends before it starts.";
  if (!achievementConfigured)
    fieldWarnings.reward = "No achievement reward configured.";

  if (needsVenue) {
    checks.push({
      id: "venue_name",
      label: "Venue name",
      severity: present(input.venueName) ? "ready" : "blocking",
      detail: present(input.venueName)
        ? undefined
        : "Venue campaign has no venue saved.",
    });
    checks.push({
      id: "venue_coords",
      label: "Venue latitude and longitude",
      severity:
        parseCoordinate(input.venueLat) != null &&
        parseCoordinate(input.venueLng) != null
          ? "ready"
          : "blocking",
    });
    checks.push({
      id: "venue_radius",
      label: "Valid validation radius",
      severity: radiusValid ? "ready" : "blocking",
      detail: radiusValid
        ? undefined
        : `Validation radius must be ${VENUE_VALIDATION_RADIUS_MIN}–${VENUE_VALIDATION_RADIUS_MAX} m.`,
    });
    checks.push({
      id: "venue_live",
      label: "Live captures only",
      severity: liveOnly ? "ready" : "blocking",
      detail: liveOnly ? undefined : VENUE_CONSTRAINT_COPY,
    });
    checks.push({
      id: "venue_imports",
      label: "Imports excluded",
      severity: importsAllowed ? "blocking" : "ready",
      detail: importsAllowed
        ? "Live venue campaigns cannot allow imports."
        : undefined,
    });
    if (!present(input.venueName) || !hasVenueComplete) {
      fieldWarnings.venue = "Venue campaign has no venue saved.";
    }
    if (importsAllowed)
      fieldWarnings.imports = "Live venue campaigns cannot allow imports.";
    if (!liveOnly) fieldWarnings.liveOnly = VENUE_CONSTRAINT_COPY;
  }

  if (geoBlocked) {
    checks.push({
      id: "geo_authority",
      label: "Geography is enforceable",
      severity: "blocking",
      detail: NON_VENUE_COUNTRY_COPY,
    });
    fieldWarnings.geo =
      "This non-venue country restriction cannot be enforced.";
  } else if (
    input.draft.geoMode !== "unrestricted" ||
    input.discoveryCountries.length > 0
  ) {
    checks.push({
      id: "geo_discovery",
      label: "Country targeting is discovery-only",
      severity: "warning",
      detail: DISCOVERY_GEOGRAPHY_COPY,
    });
    fieldWarnings.geo = "Country targeting is discovery-only.";
  } else {
    checks.push({
      id: "geo_unrestricted",
      label: "Geography unrestricted or venue-backed",
      severity: "ready",
    });
  }

  if (sponsored) {
    checks.push({
      id: "sponsor_org",
      label: "Sponsor organization selected",
      severity: present(input.draft.sponsorOrganizationId)
        ? "ready"
        : "blocking",
    });
    checks.push({
      id: "presenter",
      label: "Presenter name present",
      severity: present(input.draft.presenterName) ? "ready" : "blocking",
    });
    if (!present(input.draft.presenterName)) {
      fieldWarnings.sponsor =
        "Sponsored campaigns need a presenter display name.";
    }
  } else {
    checks.push({
      id: "authorship",
      label: "AnimalDex-authored or sponsored",
      severity: "ready",
    });
  }

  const hasDisclaimer =
    input.draft.officialRules.includes(APPLE_DISCLAIMER) ||
    /apple is not a sponsor/i.test(input.draft.officialRules);
  checks.push({
    id: "apple_disclaimer",
    label: "Apple disclaimer present",
    severity: hasDisclaimer ? "ready" : "blocking",
    detail: hasDisclaimer
      ? undefined
      : "Official rules must include the Apple disclaimer.",
  });

  if (input.hasPersistedDraft) {
    checks.push({
      id: "rules_version",
      label: "Current rules version exists",
      severity:
        input.persistedRulesVersion != null && input.persistedRulesVersion > 0
          ? "ready"
          : "blocking",
      detail: input.persistedRulesVersion
        ? undefined
        : "Save the campaign to persist rules version 1.",
    });
  } else {
    checks.push({
      id: "rules_version",
      label: "Rules version after first save",
      severity: "warning",
      detail: "Save the campaign to persist version 1.",
    });
  }

  if (input.hasHistoricalRules) {
    fieldWarnings.rulesHistory = RULES_HISTORY_COPY;
  }

  const passed = checks.filter((check) => check.severity === "ready").length;
  const blocking = checks.filter((check) => check.severity === "blocking");
  const warnings = checks.filter((check) => check.severity === "warning");
  return {
    checks,
    passed,
    total: checks.length,
    blocking,
    warnings,
    ready: blocking.length === 0,
    fieldWarnings,
  };
}
