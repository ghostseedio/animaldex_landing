import { NextRequest, NextResponse } from "next/server";
import {
  getSupabaseHeaders,
  getSupabaseServiceKey,
  getSupabaseUrl,
} from "@/lib/supabase-http";
import { isSupportAdminRequestAuthorized } from "@/lib/support-admin-auth";
import {
  APPLE_DISCLAIMER,
  assertSafeAdminDto,
  isGeoMode,
  parseAdminRpcError,
  publishBlockedReason,
  serializeAchievementReward,
  serializeCashFundingConfirmation,
  serializeCashReward,
  serializeCampaignUpsert,
  serializeGeoCountries,
  serializeRulesRevision,
  serializeVenueUpsert,
  toListItem,
  type AdminCampaignDetail,
  type AdminCampaignListItem,
  type AdminCampaignStats,
  type AdminRuleVersion,
  type CashRewardDraftInput,
  type CampaignDraftInput,
} from "@/lib/sponsored-challenges-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Row = Record<string, unknown>;

function config() {
  const url = getSupabaseUrl();
  const key = getSupabaseServiceKey();
  if (!url || !key) throw new Error("Supabase access is not configured");
  return { url, key };
}

async function rest<T>(path: string, init?: RequestInit): Promise<T> {
  const { url, key } = config();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: getSupabaseHeaders(key, {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers as Record<string, string> | undefined),
    }),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      typeof payload?.message === "string"
        ? payload.message
        : typeof payload?.error === "string"
          ? payload.error
          : `${path} failed (${response.status})`;
    const parsed = parseAdminRpcError(message);
    const error = new Error(parsed.message) as Error & {
      code?: string;
      status?: number;
    };
    error.code = parsed.code;
    error.status = response.status;
    throw error;
  }
  return payload as T;
}

async function rpc<T>(
  name: string,
  body: Record<string, unknown> = {},
): Promise<T> {
  return rest<T>(`rpc/${name}`, { method: "POST", body: JSON.stringify(body) });
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asStringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function asNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function mapRuleVersion(row: Row): AdminRuleVersion {
  return {
    rulesVersion: asNumber(row.rules_version),
    officialRules: asString(row.official_rules),
    rewardTerms: asString(row.reward_terms),
    appleDisclaimer: asString(row.apple_disclaimer) || APPLE_DISCLAIMER,
    createdAt: asString(row.created_at),
  };
}

function mapListItem(
  row: Row,
  extras: {
    sponsorName?: string | null;
    venueName?: string | null;
    rewardTitle?: string | null;
  },
): AdminCampaignListItem {
  return toListItem({
    id: asString(row.id),
    title: asString(row.title),
    slug: asString(row.slug),
    presenter_name: asStringOrNull(row.presenter_name),
    sponsor_organization_id: asStringOrNull(row.sponsor_organization_id),
    sponsor_display_name: extras.sponsorName ?? null,
    status: asString(row.status),
    starts_at: asString(row.starts_at),
    ends_at: asString(row.ends_at),
    timezone_identifier: asString(row.timezone_identifier) || "UTC",
    objective_type: asString(row.objective_type),
    target_count: asNumber(row.target_count, 1),
    venue_name: extras.venueName ?? null,
    reward_title: extras.rewardTitle ?? null,
    rules_version: asNumber(row.rules_version, 1),
    updated_at: asString(row.updated_at),
  });
}

async function loadLookups() {
  const [
    orgs,
    venues,
    rewards,
    achievements,
    countries,
    stats,
    cashRewards,
    assets,
  ] = await Promise.all([
    rest<Row[]>(
      "business_organizations?select=id,display_name,slug,website_url&order=display_name",
    ),
    rest<Row[]>(
      "campaign_venues?select=campaign_id,display_name,google_place_id,latitude,longitude,validation_radius_m,country_code",
    ),
    rest<Row[]>(
      "campaign_rewards?select=campaign_id,reward_type,achievement_definition_id",
    ),
    rest<Row[]>("achievement_definitions?select=id,slug,title,detail"),
    rest<Row[]>("campaign_geo_countries?select=campaign_id,country_code"),
    rest<Row[]>(
      "campaign_sponsor_stats_v1?select=campaign_id,participant_count,completed_count,qualifying_capture_count",
    ).catch(() => [] as Row[]),
    rest<Row[]>("campaign_cash_reward_inventory_v1?select=*").catch(
      () => [] as Row[],
    ),
    rest<Row[]>(
      "sponsored_campaigns?select=id,thumbnail_storage_path,thumbnail_alt_text,thumbnail_updated_at",
    ).catch(() => [] as Row[]),
  ]);
  return {
    orgs,
    venues,
    rewards,
    achievements,
    countries,
    stats,
    cashRewards,
    assets,
  };
}

function assembleDetail(
  row: Row,
  lookups: Awaited<ReturnType<typeof loadLookups>>,
  versions: AdminRuleVersion[],
): AdminCampaignDetail {
  const campaignId = asString(row.id);
  const org = lookups.orgs.find(
    (item) => item.id === row.sponsor_organization_id,
  );
  const venue = lookups.venues.find((item) => item.campaign_id === campaignId);
  const reward = lookups.rewards.find(
    (item) => item.campaign_id === campaignId,
  );
  const achievement = reward
    ? lookups.achievements.find(
        (item) => item.id === reward.achievement_definition_id,
      )
    : null;
  const discoveryCountries = lookups.countries
    .filter((item) => item.campaign_id === campaignId)
    .map((item) => asString(item.country_code))
    .filter(Boolean);
  const statRow = lookups.stats.find((item) => item.campaign_id === campaignId);
  const cash = lookups.cashRewards.find(
    (item) => item.campaign_id === campaignId,
  );
  const asset = lookups.assets.find((item) => item.id === campaignId);
  const storagePath = asStringOrNull(asset?.thumbnail_storage_path);
  const stats: AdminCampaignStats | null = statRow
    ? {
        participantCount: asNumber(statRow.participant_count),
        completedCount: asNumber(statRow.completed_count),
        qualifyingCaptureCount: asNumber(statRow.qualifying_capture_count),
      }
    : null;
  const listItem = mapListItem(row, {
    sponsorName: asStringOrNull(org?.display_name),
    venueName: asStringOrNull(venue?.display_name),
    rewardTitle: asStringOrNull(achievement?.title),
  });
  const hasVenue = Boolean(venue);
  return {
    ...listItem,
    publicSummary: asString(row.public_summary),
    description: asString(row.description),
    officialRules: asString(row.official_rules),
    rewardTerms: asString(row.reward_terms),
    appleDisclaimer: APPLE_DISCLAIMER,
    requiredTypeTag: asStringOrNull(row.required_type_tag),
    requiredSettingTag: asStringOrNull(row.required_setting_tag),
    minimumCaptureGrade:
      row.minimum_capture_grade == null
        ? null
        : asNumber(row.minimum_capture_grade),
    liveOnly: Boolean(row.live_only),
    externalImportsAllowed: Boolean(row.external_imports_allowed),
    discoveryRadiusM:
      row.discovery_radius_m == null ? null : asNumber(row.discovery_radius_m),
    geoMode: isGeoMode(asString(row.geo_mode))
      ? (row.geo_mode as "unrestricted" | "allowlist" | "denylist")
      : "unrestricted",
    discoveryCountries,
    discoveryIsAuthoritative: false,
    venue: venue
      ? {
          displayName: asString(venue.display_name),
          googlePlaceId: asStringOrNull(venue.google_place_id),
          latitude: asNumber(venue.latitude),
          longitude: asNumber(venue.longitude),
          validationRadiusM: asNumber(venue.validation_radius_m),
          countryCode: asStringOrNull(venue.country_code),
        }
      : null,
    reward: reward
      ? {
          type: "achievement",
          slug: asStringOrNull(achievement?.slug),
          title: asStringOrNull(achievement?.title),
          detail: asStringOrNull(achievement?.detail),
        }
      : null,
    cashReward: cash
      ? {
          amountMinor: asNumber(cash.amount_minor),
          currencyCode: asString(cash.currency_code),
          maxRecipients: asNumber(cash.max_recipients),
          platformFeeMinor: asNumber(cash.platform_fee_minor),
          fundingStatus: asString(cash.funding_status) as
            "draft" | "pending" | "confirmed" | "cancelled" | "refunded",
          fundedAmountMinor: asNumber(cash.funded_amount_minor),
          allocatedRecipients: asNumber(cash.allocated_recipients),
          remainingRecipients: asNumber(cash.remaining_recipients),
          rewardLiabilityMinor: asNumber(cash.reward_liability_minor),
          campaignTotalMinor: asNumber(cash.campaign_total_minor),
          fundedAt: asStringOrNull(cash.funded_at),
          fundingReference: asStringOrNull(cash.funding_reference),
        }
      : null,
    thumbnail: storagePath
      ? {
          storagePath,
          publicUrl: `${getSupabaseUrl()}/storage/v1/object/public/sponsored-challenges/${storagePath.split("/").map(encodeURIComponent).join("/")}`,
          altText: asString(asset?.thumbnail_alt_text),
          updatedAt: asStringOrNull(asset?.thumbnail_updated_at),
        }
      : null,
    ruleVersions: versions,
    stats,
    publishBlockedReason: publishBlockedReason(
      asString(row.geo_mode) || "unrestricted",
      hasVenue,
    ),
  };
}

async function loadCampaignRow(id: string) {
  const listed = await rpc<Row[]>("admin_list_sponsored_campaigns");
  return listed.find((row) => row.id === id) ?? null;
}

async function loadDetail(id: string): Promise<AdminCampaignDetail | null> {
  const row = await loadCampaignRow(id);
  if (!row) return null;
  const [lookups, versions] = await Promise.all([
    loadLookups(),
    rpc<Row[]>("admin_list_sponsored_campaign_rule_versions", {
      p_campaign_id: id,
    }).catch(() => [] as Row[]),
  ]);
  return assembleDetail(row, lookups, versions.map(mapRuleVersion));
}

export async function GET(request: NextRequest) {
  if (!(await isSupportAdminRequestAuthorized(request))) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    const id = request.nextUrl.searchParams.get("id")?.trim();
    if (id) {
      const campaign = await loadDetail(id);
      if (!campaign) {
        return NextResponse.json(
          { ok: false, error: "Campaign not found" },
          { status: 404 },
        );
      }
      return NextResponse.json(assertSafeAdminDto({ ok: true, campaign }));
    }

    const [rows, lookups] = await Promise.all([
      rpc<Row[]>("admin_list_sponsored_campaigns"),
      loadLookups(),
    ]);
    const campaigns = rows.map((row) => {
      const venue = lookups.venues.find((item) => item.campaign_id === row.id);
      const reward = lookups.rewards.find(
        (item) => item.campaign_id === row.id,
      );
      const achievement = reward
        ? lookups.achievements.find(
            (item) => item.id === reward.achievement_definition_id,
          )
        : null;
      const org = lookups.orgs.find(
        (item) => item.id === row.sponsor_organization_id,
      );
      return mapListItem(row, {
        sponsorName: asStringOrNull(org?.display_name),
        venueName: asStringOrNull(venue?.display_name),
        rewardTitle: asStringOrNull(achievement?.title),
      });
    });
    const organizations = lookups.orgs.map((org) => ({
      id: asString(org.id),
      displayName: asString(org.display_name),
      slug: asString(org.slug),
      websiteUrl: asStringOrNull(org.website_url),
    }));
    return NextResponse.json(
      assertSafeAdminDto({
        ok: true,
        campaigns,
        organizations,
        appleDisclaimer: APPLE_DISCLAIMER,
      }),
    );
  } catch (error) {
    console.error("[admin-sponsored-challenges]", error);
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Unable to load campaigns",
      },
      { status: 500 },
    );
  }
}

type ActionBody = {
  action?: string;
  campaignId?: string;
  draft?: CampaignDraftInput;
  venue?: {
    displayName: string;
    latitude: number;
    longitude: number;
    validationRadiusM: number;
    googlePlaceId?: string | null;
    countryCode?: string | null;
  };
  countryCodes?: string[];
  achievement?: { slug: string; title: string; detail: string };
  cashReward?: CashRewardDraftInput;
  fundingReference?: string;
  officialRules?: string;
  rewardTerms?: string;
  organization?: {
    id?: string | null;
    displayName: string;
    slug: string;
    websiteUrl?: string | null;
  };
  reviewAction?: "approve" | "reject";
};

export async function POST(request: NextRequest) {
  if (!(await isSupportAdminRequestAuthorized(request))) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as ActionBody;
  const action = body.action?.trim();

  try {
    if (action === "upsert_organization") {
      const org = body.organization;
      if (!org?.displayName?.trim() || !org.slug?.trim()) {
        return NextResponse.json(
          { ok: false, error: "Organization name and slug are required" },
          { status: 400 },
        );
      }
      const row = await rpc<Row>("admin_upsert_business_organization", {
        p_display_name: org.displayName,
        p_slug: org.slug,
        p_website_url: org.websiteUrl ?? null,
        p_id: org.id ?? null,
      });
      return NextResponse.json(
        assertSafeAdminDto({
          ok: true,
          organization: {
            id: asString(row.id),
            displayName: asString(row.display_name),
            slug: asString(row.slug),
            websiteUrl: asStringOrNull(row.website_url),
          },
        }),
      );
    }

    if (action === "upsert_campaign") {
      if (!body.draft) {
        return NextResponse.json(
          { ok: false, error: "Campaign draft is required" },
          { status: 400 },
        );
      }
      const row = await rpc<Row>(
        "admin_upsert_sponsored_campaign",
        serializeCampaignUpsert(body.draft),
      );
      const campaign = await loadDetail(asString(row.id));
      return NextResponse.json(assertSafeAdminDto({ ok: true, campaign }));
    }

    const campaignId = body.campaignId?.trim();
    if (!campaignId) {
      return NextResponse.json(
        { ok: false, error: "A campaign is required" },
        { status: 400 },
      );
    }

    if (action === "set_venue") {
      if (!body.venue) {
        return NextResponse.json(
          { ok: false, error: "Venue details are required" },
          { status: 400 },
        );
      }
      await rpc(
        "admin_set_campaign_venue",
        serializeVenueUpsert(campaignId, body.venue),
      );
    } else if (action === "set_geo") {
      await rpc(
        "admin_set_campaign_geo_countries",
        serializeGeoCountries(campaignId, body.countryCodes ?? []),
      );
    } else if (action === "set_reward") {
      if (!body.achievement) {
        return NextResponse.json(
          { ok: false, error: "An achievement reward is required" },
          { status: 400 },
        );
      }
      await rpc(
        "admin_set_campaign_achievement_reward",
        serializeAchievementReward(campaignId, body.achievement),
      );
    } else if (action === "set_cash_reward") {
      if (!body.cashReward) {
        return NextResponse.json(
          { ok: false, error: "Cash reward details are required" },
          { status: 400 },
        );
      }
      await rpc(
        "admin_set_campaign_cash_reward",
        serializeCashReward(campaignId, body.cashReward),
      );
    } else if (action === "confirm_cash_funding") {
      if (!body.cashReward) {
        return NextResponse.json(
          { ok: false, error: "Cash reward details are required" },
          { status: 400 },
        );
      }
      await rpc(
        "admin_confirm_campaign_cash_funding",
        serializeCashFundingConfirmation(
          campaignId,
          body.cashReward,
          body.fundingReference ?? "",
        ),
      );
    } else if (action === "revise_rules") {
      await rpc(
        "admin_revise_sponsored_campaign_rules",
        serializeRulesRevision(
          campaignId,
          body.officialRules ?? "",
          body.rewardTerms ?? "",
        ),
      );
    } else if (action === "submit") {
      await rpc("admin_submit_sponsored_campaign", {
        p_campaign_id: campaignId,
      });
    } else if (action === "review") {
      if (body.reviewAction !== "approve" && body.reviewAction !== "reject") {
        return NextResponse.json(
          { ok: false, error: "Choose approve or reject" },
          { status: 400 },
        );
      }
      await rpc("admin_review_sponsored_campaign", {
        p_campaign_id: campaignId,
        p_action: body.reviewAction,
      });
    } else if (action === "archive") {
      await rpc("admin_archive_sponsored_campaign", {
        p_campaign_id: campaignId,
      });
    } else {
      return NextResponse.json(
        { ok: false, error: "Unknown action" },
        { status: 400 },
      );
    }

    const campaign = await loadDetail(campaignId);
    return NextResponse.json(assertSafeAdminDto({ ok: true, campaign }));
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: string }).code)
        : "rpc_error";
    console.error("[admin-sponsored-challenges]", error);
    return NextResponse.json(
      {
        ok: false,
        code,
        error:
          error instanceof Error ? error.message : "Campaign action failed",
      },
      { status: 400 },
    );
  }
}
