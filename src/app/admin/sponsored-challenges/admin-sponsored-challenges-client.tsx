"use client";

/* Dynamic Supabase and local asset URLs are selected at runtime. */
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { ReactNode, useCallback, useEffect, useId, useMemo, useState } from "react";
import { CampaignPreview } from "@/app/admin/sponsored-challenges/campaign-preview";
import { CampaignReadinessPanel } from "@/app/admin/sponsored-challenges/campaign-readiness-panel";
import { CampaignTemplatePicker } from "@/app/admin/sponsored-challenges/campaign-template-picker";
import {
  ADMIN_TIMEZONES,
  COPY_FIELDS,
  DATE_FIELDS,
  GENERATED_RULES_NOTICE,
  REGENERATE_CONFIRM,
  SETTING_TAGS,
  TEMPLATE_CHANGE_CONFIRM,
  applyTemplateDefaults,
  blankDraft,
  currentGeneratedCopy,
  emptyFieldOrigins,
  generateBuilderCopy,
  inferTemplateId,
  isFormSubstantiallyModified,
  markManual,
  mergeCopyIntoDraft,
  nextAutoValues,
  pickCopy,
  type CampaignTemplateId,
  type FieldOrigin,
  type FieldOrigins,
  type GeneratedCopy,
  type GeneratedField,
} from "@/lib/sponsored-challenge-builder";
import { toPreviewCampaign } from "@/lib/sponsored-challenge-preview";
import { evaluateReadiness } from "@/lib/sponsored-challenge-readiness";
import { formatEarningsMinor } from "@/lib/earnings";
import {
  APPLE_DISCLAIMER,
  ARCHIVE_COPY,
  CAMPAIGN_STATUSES,
  DISCOVERY_GEOGRAPHY_COPY,
  NON_VENUE_COUNTRY_COPY,
  canonicalizeSettingTag,
  canonicalizeTypeTag,
  OBJECTIVE_TYPES,
  RULES_HISTORY_COPY,
  settingTagDisplayLabel,
  VENUE_CONSTRAINT_COPY,
  VENUE_SECURITY_COPY,
  authorshipLabel,
  canArchiveCampaign,
  canEditCampaign,
  canReviewCampaign,
  canReviseRules,
  canSubmitCampaign,
  currentRulesVersion,
  historicalRulesVersions,
  isArchivedShownAsLive,
  lifecycleButtons,
  objectiveLabel,
  publishBlockedReason,
  type AdminCampaignDetail,
  type AdminCampaignListItem,
  type CampaignDraftInput,
  type CampaignStatus,
  type CashRewardDraftInput,
} from "@/lib/sponsored-challenges-admin";

type Organization = {
  id: string;
  displayName: string;
  slug: string;
  websiteUrl: string | null;
};

type ListPayload = {
  ok: boolean;
  campaigns?: AdminCampaignListItem[];
  organizations?: Organization[];
  appleDisclaimer?: string;
  error?: string;
};

type DetailPayload = {
  ok: boolean;
  campaign?: AdminCampaignDetail;
  organization?: Organization;
  code?: string;
  error?: string;
};

type ThumbnailPayload = {
  storagePath: string;
  publicUrl: string;
  altText: string;
  updatedAt: string | null;
};

const STATUS_LABEL: Record<CampaignStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
  scheduled: "Scheduled",
  live: "Live",
  completed: "Completed",
  rejected: "Rejected",
  archived: "Archived",
};

function draftFromCampaign(campaign: AdminCampaignDetail): CampaignDraftInput {
  return {
    id: campaign.id,
    slug: campaign.slug,
    title: campaign.title,
    publicSummary: campaign.publicSummary,
    description: campaign.description,
    presenterName: campaign.presenterName ?? "",
    sponsorOrganizationId: campaign.sponsorOrganizationId,
    startsAt: campaign.startsAt.slice(0, 16),
    endsAt: campaign.endsAt.slice(0, 16),
    timezoneIdentifier: campaign.timezoneIdentifier,
    objectiveType: campaign.objectiveType,
    targetCount: campaign.targetCount,
    officialRules: campaign.officialRules,
    rewardTerms: campaign.rewardTerms,
    requiredTypeTag: canonicalizeTypeTag(campaign.requiredTypeTag) ?? "",
    requiredSettingTag:
      canonicalizeSettingTag(campaign.requiredSettingTag) ?? "",
    minimumCaptureGrade: campaign.minimumCaptureGrade,
    liveOnly: campaign.liveOnly,
    externalImportsAllowed: campaign.externalImportsAllowed,
    discoveryRadiusM: campaign.discoveryRadiusM,
    geoMode: campaign.geoMode,
    hasVenue: Boolean(campaign.venue),
  };
}

function toIso(local: string) {
  if (!local) return new Date().toISOString();
  return new Date(local).toISOString();
}

function formatWindow(start: string, end: string, timezone: string) {
  const opts: Intl.DateTimeFormatOptions = {
    dateStyle: "medium",
    timeStyle: "short",
  };
  return `${new Date(start).toLocaleString(undefined, opts)} → ${new Date(end).toLocaleString(undefined, opts)} (${timezone})`;
}

export default function AdminSponsoredChallengesClient() {
  const [campaigns, setCampaigns] = useState<AdminCampaignListItem[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [filter, setFilter] = useState<CampaignStatus | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [campaign, setCampaign] = useState<AdminCampaignDetail | null>(null);
  const [draft, setDraft] = useState<CampaignDraftInput>(() => blankDraft());
  const [templateId, setTemplateId] = useState<CampaignTemplateId>("blank");
  const [origins, setOrigins] = useState<FieldOrigins>(() =>
    emptyFieldOrigins("auto"),
  );
  const [venueName, setVenueName] = useState("");
  const [venuePlaceId, setVenuePlaceId] = useState("");
  const [venueLat, setVenueLat] = useState("");
  const [venueLng, setVenueLng] = useState("");
  const [venueRadius, setVenueRadius] = useState("400");
  const [venueCountry, setVenueCountry] = useState("");
  const [countries, setCountries] = useState("");
  const [achievementSlug, setAchievementSlug] = useState("");
  const [achievementTitle, setAchievementTitle] = useState("");
  const [achievementDetail, setAchievementDetail] = useState("");
  const [cashEnabled, setCashEnabled] = useState(false);
  const [cashAmountMinor, setCashAmountMinor] = useState("500");
  const [cashCurrency, setCashCurrency] = useState("USD");
  const [cashRecipients, setCashRecipients] = useState("500");
  const [cashFeeMinor, setCashFeeMinor] = useState("0");
  const [fundingReference, setFundingReference] = useState("");
  const [thumbnailAlt, setThumbnailAlt] = useState("");
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploadingArtwork, setUploadingArtwork] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetailId, setLoadingDetailId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [draftStatus, setDraftStatus] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const draftStorageKey = "animaldex-admin-sponsored-challenge-draft";

  const steps = [
    { key: "basics", label: "Basics", description: "Name, timing, and public copy." },
    { key: "targeting", label: "Targeting", description: "Define what qualifies and where it is discovered." },
    { key: "venue", label: "Venue", description: "Add a physical venue only when the Challenge needs one." },
    { key: "rewards", label: "Rewards", description: "Configure the achievement and optional cash funding." },
    { key: "review", label: "Review", description: "Confirm rules, artwork, and publish readiness." },
  ] as const;

  type StepKey = (typeof steps)[number]["key"];

  function stepIndex(key: StepKey) {
    return steps.findIndex((step) => step.key === key);
  }

  function stepForField(field: keyof CampaignDraftInput): StepKey {
    if (
      field === "title" ||
      field === "slug" ||
      field === "publicSummary" ||
      field === "description" ||
      field === "presenterName" ||
      field === "startsAt" ||
      field === "endsAt" ||
      field === "timezoneIdentifier"
    ) {
      return "basics";
    }
    if (
      field === "objectiveType" ||
      field === "targetCount" ||
      field === "requiredTypeTag" ||
      field === "requiredSettingTag" ||
      field === "minimumCaptureGrade" ||
      field === "geoMode" ||
      field === "discoveryRadiusM"
    ) {
      return "targeting";
    }
    if (
      field === "liveOnly" ||
      field === "externalImportsAllowed" ||
      field === "hasVenue"
    ) {
      return "venue";
    }
    return "rewards";
  }

  const loadList = useCallback(async () => {
    setLoadingList(true);
    try {
      const response = await fetch("/api/admin/sponsored-challenges", {
        cache: "no-store",
      });
      const payload = (await response.json()) as ListPayload;
      if (!response.ok || !payload.ok)
        throw new Error(payload.error || "Unable to load campaigns");
      setCampaigns(payload.campaigns ?? []);
      setOrganizations(payload.organizations ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load campaigns");
    } finally {
      setLoadingList(false);
    }
  }, []);

  const applyDetail = useCallback(
    (detail: AdminCampaignDetail, resetOrigins = true) => {
      try {
        setCampaign(detail);
        setSelectedId(detail.id);
        setDraft(draftFromCampaign(detail));
        setVenueName(detail.venue?.displayName ?? "");
        setVenuePlaceId(detail.venue?.googlePlaceId ?? "");
        setVenueLat(detail.venue ? String(detail.venue.latitude) : "");
        setVenueLng(detail.venue ? String(detail.venue.longitude) : "");
        setVenueRadius(
          detail.venue ? String(detail.venue.validationRadiusM) : "400",
        );
        setVenueCountry(detail.venue?.countryCode ?? "");
        setCountries((detail.discoveryCountries ?? []).join(", "));
        setAchievementSlug(detail.reward?.slug ?? "");
        setAchievementTitle(detail.reward?.title ?? "");
        setAchievementDetail(detail.reward?.detail ?? "");
        setCashEnabled(Boolean(detail.cashReward));
        setCashAmountMinor(String(detail.cashReward?.amountMinor ?? 500));
        setCashCurrency(detail.cashReward?.currencyCode ?? "USD");
        setCashRecipients(String(detail.cashReward?.maxRecipients ?? 500));
        setCashFeeMinor(String(detail.cashReward?.platformFeeMinor ?? 0));
        setFundingReference(detail.cashReward?.fundingReference ?? "");
        setThumbnailAlt(detail.thumbnail?.altText ?? detail.title);
        setConfirmArchive(false);
        if (resetOrigins) {
          setOrigins(emptyFieldOrigins("manual"));
          setTemplateId(inferTemplateId(detail) ?? "blank");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load campaign details");
      }
    },
    [],
  );

  const loadDetail = useCallback(
    async (id: string) => {
      setLoadingDetailId(id);
      try {
        const response = await fetch(`/api/admin/sponsored-challenges?id=${id}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as DetailPayload;
        if (!response.ok || !payload.ok || !payload.campaign)
          throw new Error(payload.error || "Unable to load campaign");
        applyDetail(payload.campaign, true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load campaign");
      } finally {
        setLoadingDetailId(null);
      }
    },
    [applyDetail],
  );

  useEffect(() => {
    loadList().catch((err: Error) => setError(err.message));
  }, [loadList]);

  const act = useCallback(
    async (body: Record<string, unknown>, success: string) => {
      setBusy(true);
      setError(null);
      setNotice(null);
      try {
        const response = await fetch("/api/admin/sponsored-challenges", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const payload = (await response.json()) as DetailPayload;
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || payload.code || "Action failed");
        }
        if (payload.organization) {
          setOrganizations((current) => {
            const next = current.filter(
              (item) => item.id !== payload.organization!.id,
            );
            return [...next, payload.organization!].sort((a, b) =>
              a.displayName.localeCompare(b.displayName),
            );
          });
          setDraft((current) => ({
            ...current,
            sponsorOrganizationId: payload.organization!.id,
          }));
        }
        if (payload.campaign) applyDetail(payload.campaign, false);
        await loadList();
        setNotice(success);
        return payload;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Action failed");
        return null;
      } finally {
        setBusy(false);
      }
    },
    [applyDetail, loadList],
  );

  const sponsorDisplayName =
    organizations.find((org) => org.id === draft.sponsorOrganizationId)
      ?.displayName ??
    campaign?.sponsorDisplayName ??
    null;
  const hasVenue = Boolean(venueName.trim() && venueLat && venueLng);
  const builderSource = useMemo(
    () => ({
      templateId,
      draft: { ...draft, hasVenue: hasVenue || Boolean(campaign?.venue) },
      venueName,
      venueCountry,
      sponsorDisplayName,
      achievementSlug,
      achievementTitle,
      achievementDetail,
    }),
    [
      templateId,
      draft,
      hasVenue,
      campaign?.venue,
      venueName,
      venueCountry,
      sponsorDisplayName,
      achievementSlug,
      achievementTitle,
      achievementDetail,
    ],
  );

  useEffect(() => {
    if (!selectedId || !canMutate(campaign)) return;
    const generated = generateBuilderCopy(builderSource, origins);
    const current = currentGeneratedCopy(builderSource);
    const next = nextAutoValues(current, generated, origins);
    if (!next) return;
    applyGeneratedCopy(next);
  }, [builderSource, origins, campaign, selectedId]);

  function applyGeneratedCopy(copy: Partial<GeneratedCopy>) {
    setDraft((current) => mergeCopyIntoDraft(current, copy));
    if (copy.achievementSlug != null) setAchievementSlug(copy.achievementSlug);
    if (copy.achievementTitle != null)
      setAchievementTitle(copy.achievementTitle);
    if (copy.achievementDetail != null)
      setAchievementDetail(copy.achievementDetail);
  }

  function updateDraft<K extends keyof CampaignDraftInput>(
    key: K,
    value: CampaignDraftInput[K],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
    if (isGeneratedDraftKey(key)) {
      setOrigins((current) => markManual(current, key));
    }
    setCurrentStep((current) => Math.max(current, stepIndex(stepForField(key))));
    setDraftStatus("idle");
  }

  function applyTemplate(nextId: CampaignTemplateId, force = false) {
    if (nextId === templateId && !force) return;
    if (!force && isFormSubstantiallyModified(origins, { venueName })) {
      if (!window.confirm(TEMPLATE_CHANGE_CONFIRM)) return;
    }
    const nextDraft = applyTemplateDefaults(nextId, {
      ...draft,
      hasVenue: hasVenue || Boolean(campaign?.venue),
    });
    setTemplateId(nextId);
    setOrigins(emptyFieldOrigins("auto"));
    const generated = generateBuilderCopy(
      {
        templateId: nextId,
        draft: nextDraft,
        venueName,
        venueCountry,
        sponsorDisplayName,
        achievementSlug: "",
        achievementTitle: "",
        achievementDetail: "",
      },
      emptyFieldOrigins("auto"),
    );
    setDraft(mergeCopyIntoDraft(nextDraft, generated));
    setAchievementSlug(generated.achievementSlug);
    setAchievementTitle(generated.achievementTitle);
    setAchievementDetail(generated.achievementDetail);
    setCashEnabled(false);
    setCashAmountMinor("500");
    setCashCurrency("USD");
    setCashRecipients("500");
    setCashFeeMinor("0");
    setFundingReference("");
    setThumbnailAlt("");
  }

  function regenerate(fields: readonly GeneratedField[] | "all") {
    if (fields === "all" || fields === COPY_FIELDS) {
      if (
        isFormSubstantiallyModified(origins, { venueName }) &&
        !window.confirm(REGENERATE_CONFIRM)
      )
        return;
    }
    const generated = generateBuilderCopy(
      builderSource,
      emptyFieldOrigins("auto"),
    );
    const selected =
      fields === "all"
        ? generated
        : {
            ...currentGeneratedCopy(builderSource),
            ...pickCopy(generated, fields),
          };
    const nextOrigins = emptyFieldOrigins("manual");
    const touched =
      fields === "all" ? (Object.keys(generated) as GeneratedField[]) : fields;
    for (const field of touched) nextOrigins[field] = "auto";
    if (fields !== "all") {
      for (const field of Object.keys(origins) as GeneratedField[]) {
        if (!touched.includes(field)) nextOrigins[field] = origins[field];
      }
    }
    setOrigins(nextOrigins);
    applyGeneratedCopy(selected);
  }

  const filtered = useMemo(
    () =>
      campaigns.filter((item) => filter === "all" || item.status === filter),
    [campaigns, filter],
  );
  const counts = useMemo(() => {
    const next = Object.fromEntries(
      CAMPAIGN_STATUSES.map((status) => [status, 0]),
    ) as Record<CampaignStatus, number>;
    for (const item of campaigns) next[item.status] += 1;
    return next;
  }, [campaigns]);

  const discoveryCountries = countries
    .split(",")
    .map((code) => code.trim())
    .filter(Boolean);
  const blocked = publishBlockedReason(
    draft.geoMode,
    hasVenue || Boolean(campaign?.venue),
  );
  const buttons = lifecycleButtons(campaign?.status ?? "draft");
  const currentVersion = campaign
    ? currentRulesVersion(campaign.ruleVersions, campaign.rulesVersion)
    : null;
  const previousVersions = campaign
    ? historicalRulesVersions(campaign.ruleVersions, campaign.rulesVersion)
    : [];
  const readiness = evaluateReadiness({
    draft,
    templateId,
    venueName,
    venueLat,
    venueLng,
    venueRadius,
    achievementSlug,
    achievementTitle,
    achievementDetail,
    cashEnabled,
    cashFundingStatus: campaign?.cashReward?.fundingStatus ?? null,
    hasPersistedDraft: Boolean(campaign),
    persistedRulesVersion: campaign?.rulesVersion ?? null,
    hasHistoricalRules: previousVersions.length > 0,
    discoveryCountries,
  });
  const achievementSaved = Boolean(
    campaign?.reward &&
      campaign.reward.slug === achievementSlug.trim() &&
      campaign.reward.title === achievementTitle.trim() &&
      campaign.reward.detail === achievementDetail.trim(),
  );
  const cashRewardSaved = Boolean(
    campaign?.cashReward &&
      campaign.cashReward.amountMinor === Number(cashAmountMinor) &&
      campaign.cashReward.currencyCode === cashCurrency.trim().toUpperCase() &&
      campaign.cashReward.maxRecipients === Number(cashRecipients) &&
      campaign.cashReward.platformFeeMinor === Number(cashFeeMinor),
  );
  const preview = toPreviewCampaign({
    title: draft.title,
    publicSummary: draft.publicSummary,
    description: draft.description,
    presenterName: draft.presenterName,
    sponsorOrganizationId: draft.sponsorOrganizationId,
    sponsorDisplayName,
    startsAt: draft.startsAt,
    endsAt: draft.endsAt,
    timezoneIdentifier: draft.timezoneIdentifier,
    objectiveType: draft.objectiveType,
    targetCount: draft.targetCount,
    requiredTypeTag: draft.requiredTypeTag,
    requiredSettingTag: draft.requiredSettingTag,
    minimumCaptureGrade: draft.minimumCaptureGrade,
    liveOnly: hasVenue ? true : draft.liveOnly,
    externalImportsAllowed: hasVenue ? false : draft.externalImportsAllowed,
    venueName,
    rewardTitle: achievementTitle,
    cashAmountMinor: cashEnabled ? Number(cashAmountMinor) : null,
    cashCurrencyCode: cashEnabled ? cashCurrency : null,
    cashRemainingRecipients:
      campaign?.cashReward?.remainingRecipients ??
      (cashEnabled ? Number(cashRecipients) : null),
    thumbnailUrl: campaign?.thumbnail?.publicUrl ?? null,
    thumbnailAltText: campaign?.thumbnail?.altText ?? null,
    officialRules: draft.officialRules,
  });
  const timezoneOptions = ADMIN_TIMEZONES.includes(
    draft.timezoneIdentifier as (typeof ADMIN_TIMEZONES)[number],
  )
    ? ADMIN_TIMEZONES
    : [draft.timezoneIdentifier, ...ADMIN_TIMEZONES];

  function startCreate() {
    const next = blankDraft();
    const generated = generateBuilderCopy(
      {
        templateId: "blank",
        draft: next,
        venueName: "",
        venueCountry: "",
        sponsorDisplayName: null,
        achievementSlug: "",
        achievementTitle: "",
        achievementDetail: "",
      },
      emptyFieldOrigins("auto"),
    );
    setSelectedId("new");
    setCampaign(null);
    setTemplateId("blank");
    setOrigins(emptyFieldOrigins("auto"));
    setDraft(mergeCopyIntoDraft(next, generated));
    setVenueName("");
    setVenuePlaceId("");
    setVenueLat("");
    setVenueLng("");
    setVenueRadius("400");
    setVenueCountry("");
    setCountries("");
    setAchievementSlug(generated.achievementSlug);
    setAchievementTitle(generated.achievementTitle);
    setAchievementDetail(generated.achievementDetail);
    setConfirmArchive(false);
    setNotice(null);
    setError(null);
    setCurrentStep(0);
    setDraftStatus("idle");
  }

  async function saveDraftCampaign(): Promise<string | null> {
    setDraftStatus("saving");
    const payload: CampaignDraftInput = {
      ...draft,
      title: draft.title.trim() || draft.slug.trim().replace(/-/g, " "),
      startsAt: toIso(draft.startsAt),
      endsAt: toIso(draft.endsAt),
      hasVenue: hasVenue || Boolean(campaign?.venue),
    };
    const saved = await act({ action: "upsert_campaign", draft: payload }, "Campaign saved.");
    if (!saved) {
      setDraftStatus("idle");
      return null;
    }
    setDraftStatus("saved");
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(draftStorageKey);
    }
    return saved.campaign?.id ?? campaign?.id ?? null;
  }

  async function saveCurrentStep() {
    const campaignId = await saveDraftCampaign();
    if (!campaignId) return false;

    if (currentStep === 1) {
      return Boolean(
        await act(
          { action: "set_geo", campaignId, countryCodes: discoveryCountries },
          "Discovery targeting saved.",
        ),
      );
    }

    if (currentStep === 2 && hasVenue) {
      return Boolean(
        await act(
          {
            action: "set_venue",
            campaignId,
            venue: {
              displayName: venueName,
              latitude: Number(venueLat),
              longitude: Number(venueLng),
              validationRadiusM: Number(venueRadius),
              googlePlaceId: venuePlaceId || null,
              countryCode: venueCountry || null,
            },
          },
          "Venue saved.",
        ),
      );
    }

    if (currentStep === 3) {
      const achievementSaved = await act(
        {
          action: "set_reward",
          campaignId,
          achievement: {
            slug: achievementSlug,
            title: achievementTitle,
            detail: achievementDetail,
          },
        },
        cashEnabled ? "Achievement and cash reward saved." : "Achievement saved.",
      );
      if (!achievementSaved) return false;
      if (cashEnabled) {
        return Boolean(
          await act(
            { action: "set_cash_reward", campaignId, cashReward: cashRewardInput() },
            "Cash reward configuration saved.",
          ),
        );
      }
    }

    return true;
  }

  async function saveStepAndAdvance() {
    if (!(await saveCurrentStep())) return;
    setCurrentStep((current) => Math.min(current + 1, steps.length - 1));
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (campaign) return;
    const saved = window.localStorage.getItem(draftStorageKey);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as {
        draft: CampaignDraftInput;
        venueName?: string;
        venuePlaceId?: string;
        venueLat?: string;
        venueLng?: string;
        venueRadius?: string;
        venueCountry?: string;
        countries?: string;
        achievementSlug?: string;
        achievementTitle?: string;
        achievementDetail?: string;
        templateId?: CampaignTemplateId;
        currentStep?: number;
      };
      if (parsed.draft) {
        setDraft(parsed.draft);
        setVenueName(parsed.venueName ?? "");
        setVenuePlaceId(parsed.venuePlaceId ?? "");
        setVenueLat(parsed.venueLat ?? "");
        setVenueLng(parsed.venueLng ?? "");
        setVenueRadius(parsed.venueRadius ?? "400");
        setVenueCountry(parsed.venueCountry ?? "");
        setCountries(parsed.countries ?? "");
        setAchievementSlug(parsed.achievementSlug ?? "");
        setAchievementTitle(parsed.achievementTitle ?? "");
        setAchievementDetail(parsed.achievementDetail ?? "");
        setTemplateId(parsed.templateId ?? "blank");
        setCurrentStep(Math.min(parsed.currentStep ?? 0, steps.length - 1));
      }
    } catch {
      window.localStorage.removeItem(draftStorageKey);
    }
  }, [campaign, steps.length]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (campaign || !selectedId) return;
    const snapshot = {
      draft,
      venueName,
      venuePlaceId,
      venueLat,
      venueLng,
      venueRadius,
      venueCountry,
      countries,
      achievementSlug,
      achievementTitle,
      achievementDetail,
      templateId,
      currentStep,
    };
    const timer = window.setTimeout(() => {
      window.localStorage.setItem(draftStorageKey, JSON.stringify(snapshot));
      setDraftStatus("saved");
    }, 500);
    return () => window.clearTimeout(timer);
  }, [
    campaign,
    selectedId,
    draft,
    venueName,
    venuePlaceId,
    venueLat,
    venueLng,
    venueRadius,
    venueCountry,
    countries,
    achievementSlug,
    achievementTitle,
    achievementDetail,
    templateId,
    currentStep,
  ]);

  function cashRewardInput(): CashRewardDraftInput {
    return {
      amountMinor: Number(cashAmountMinor),
      currencyCode: cashCurrency,
      maxRecipients: Number(cashRecipients),
      platformFeeMinor: Number(cashFeeMinor),
    };
  }

  function generatedCashRewardTerms() {
    const reward = cashRewardInput();
    return [
      `Complete the Challenge to unlock the “${achievementTitle.trim() || draft.title.trim() || "Challenge"}” AnimalDex achievement.`,
      `Each qualifying participant receives ${formatEarningsMinor(reward.amountMinor, reward.currencyCode)} in AnimalDex Earnings while the funded inventory of ${reward.maxRecipients} rewards remains available.`,
      "Participation is free. Qualification is deterministic and verified server-side under the accepted official rules.",
      "No AnimalDex Credits, paid entry, wagering, random drawing, sweepstakes, lottery, or user-funded prize pool is involved.",
      "Earnings withdrawal availability is handled separately under the participant’s payout eligibility and available payout corridors.",
    ].join("\n\n");
  }

  async function uploadThumbnail(file: File | null, sourceUrl?: string) {
    if (!campaign || (!file && !sourceUrl)) return;
    setUploadingArtwork(true);
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("campaignId", campaign.id);
      form.set("altText", thumbnailAlt);
      if (file) form.set("file", file);
      if (sourceUrl) form.set("sourceUrl", sourceUrl);
      const response = await fetch("/api/admin/sponsored-challenges/image", {
        method: "POST",
        body: form,
      });
      const payload = (await response.json()) as DetailPayload & {
        thumbnail?: ThumbnailPayload;
      };
      if (!response.ok || !payload.ok)
        throw new Error(payload.error || "Image upload failed");
      if (payload.thumbnail) {
        setCampaign((current) =>
          current
            ? {
                ...current,
                thumbnail: {
                  ...payload.thumbnail!,
                  updatedAt: new Date().toISOString(),
                },
              }
            : current,
        );
      }
      if (!payload.thumbnail) await loadDetail(campaign.id);
      await loadList();
      setNotice("Challenge image uploaded.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image upload failed");
    } finally {
      setUploadingArtwork(false);
      setBusy(false);
    }
  }

  const editable = canMutate(campaign);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/admin" className="text-sm text-ink-400 hover:text-white">
            ← Admin
          </Link>
          <p className="mt-5 text-[10px] font-black uppercase tracking-[.18em] text-primary-200">
            Internal operations
          </p>
          <h1 className="mt-2 font-display text-4xl text-white">
            Sponsored Challenges
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-300">
            AnimalDex operator console for time-limited Challenges. Privileged
            mutations run server-side. This is not the public PvP /challenges
            route and not a /business portal.
          </p>
        </div>
        <button
          type="button"
          onClick={startCreate}
          disabled={loadingList || busy}
          className="rounded-xl bg-primary-500 px-4 py-2 text-sm font-black text-canvas-950 disabled:opacity-50"
        >
          {loadingList ? "Loading..." : "New campaign"}
        </button>
      </div>

      {error ? (
        <p className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="rounded-2xl border border-primary-400/30 bg-primary-500/10 px-4 py-3 text-sm text-primary-100">
          {notice}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <FilterChip
          active={filter === "all"}
          onClick={() => setFilter("all")}
          label={`All (${campaigns.length})`}
        />
        {CAMPAIGN_STATUSES.map((status) => (
          <FilterChip
            key={status}
            active={filter === status}
            onClick={() => setFilter(status)}
            label={`${STATUS_LABEL[status]} (${counts[status]})`}
          />
        ))}
      </div>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {loadingList ? (
          <p className="text-sm text-ink-500">Loading campaigns...</p>
        ) : null}
        {!loadingList ? filtered.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={loadingDetailId !== null || busy}
            onClick={() =>
              loadDetail(item.id).catch((err: Error) => setError(err.message))
            }
            className={`rounded-3xl border p-5 text-left transition disabled:cursor-wait disabled:opacity-60 ${selectedId === item.id ? "border-primary-300 bg-primary-500/10" : "border-line-300 bg-surface-900 hover:border-primary-400/40"}`}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="font-display text-xl text-white">{item.title}</p>
              <StatusBadge status={item.status} />
            </div>
            <p className="mt-2 text-xs font-bold text-ink-400">
              {authorshipLabel(
                item.sponsorOrganizationId,
                item.presenterName || item.sponsorDisplayName,
              )}
            </p>
            <p className="mt-3 text-sm text-ink-300">
              {formatWindow(
                item.startsAt,
                item.endsAt,
                item.timezoneIdentifier,
              )}
            </p>
            <p className="mt-2 text-sm text-ink-300">
              {objectiveLabel(item.objectiveType)} · target {item.targetCount}
            </p>
            <p className="mt-2 text-xs text-ink-500">
              {item.venueName ? `Venue: ${item.venueName}` : "No venue"}
              {item.rewardTitle ? ` · ${item.rewardTitle}` : " · No reward"}
              {` · rules v${item.rulesVersion}`}
            </p>
            <p className="mt-2 text-[11px] text-ink-500">
              {loadingDetailId === item.id
                ? "Loading campaign..."
                : `Updated ${new Date(item.updatedAt).toLocaleString()}`}
            </p>
          </button>
        )) : null}
        {!loadingList && filtered.length === 0 ? (
          <p className="text-sm text-ink-500">No campaigns in this status.</p>
        ) : null}
      </section>

      {selectedId ? (
        <section className="space-y-6 rounded-3xl border border-line-300 bg-surface-900/80 p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.18em] text-ink-500">
                {campaign ? "Campaign editor" : "New campaign"}
              </p>
              <h2 className="mt-1 font-display text-3xl text-white">
                {draft.title || "Untitled Challenge"}
              </h2>
            </div>
            {campaign ? <StatusBadge status={campaign.status} /> : null}
          </div>

          <p className="text-xs leading-5 text-ink-400">
            draft → submitted → approved → scheduled → live → completed →
            archived. submitted → rejected. Browser code never writes the status
            column.
          </p>

          <details className="group rounded-2xl border border-line-300 bg-canvas-950/40 p-4">
            <summary className="cursor-pointer list-none">
              <span className="flex flex-wrap items-center justify-between gap-3">
                <span>
                  <span className="block text-[10px] font-black uppercase tracking-[.18em] text-ink-500">
                    Campaign readiness
                  </span>
                  <span className="mt-1 block font-display text-2xl text-white">
                    {readiness.passed} / {readiness.total} checks passed
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[.12em] ${readiness.ready ? "border-primary-300 text-primary-100" : "border-rose-400/40 text-rose-100"}`}>
                    {readiness.ready ? "Ready" : "Needs fixes"}
                  </span>
                  <span className="text-lg text-ink-500 transition group-open:rotate-45">+</span>
                </span>
              </span>
            </summary>
            <div className="mt-4">
              <CampaignReadinessPanel result={readiness} compact />
            </div>
          </details>

          <div className="grid gap-6 lg:grid-cols-2">
            <OrgBox
              disabled={busy || !editable}
              loading={busy}
              name={orgName}
              slug={orgSlug}
              onName={setOrgName}
              onSlug={setOrgSlug}
              onCreate={() =>
                act(
                  {
                    action: "upsert_organization",
                    organization: { displayName: orgName, slug: orgSlug },
                  },
                  "Sponsor organization saved.",
                )
              }
            />
            {campaign?.stats ? (
              <Block title="Operational totals">
                <div className="grid grid-cols-3 gap-3">
                  <Stat
                    value={campaign.stats.participantCount}
                    label="Joined participants"
                  />
                  <Stat
                    value={campaign.stats.completedCount}
                    label="Completed / rewarded"
                  />
                  <Stat
                    value={campaign.stats.qualifyingCaptureCount}
                    label="Qualifying captures"
                  />
                </div>
                <p className="mt-3 text-xs text-ink-500">
                  Counts only. No user identities, emails, capture IDs, media,
                  or location evidence.
                </p>
              </Block>
            ) : null}
          </div>

          {campaign && canArchiveCampaign(campaign.status) ? (
            <Block title="Archive kill switch" note={ARCHIVE_COPY}>
              {!confirmArchive ? (
                <button
                  type="button"
                  disabled={busy}
                  className="rounded-xl border border-rose-400/40 px-4 py-2 text-sm font-bold text-rose-100 disabled:opacity-50"
                  onClick={() => setConfirmArchive(true)}
                >
                  Archive campaign
                </button>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    className="rounded-xl bg-rose-500 px-4 py-2 text-sm font-black text-white"
                    onClick={() =>
                      act(
                        { action: "archive", campaignId: campaign.id },
                        "Campaign archived.",
                      )
                    }
                  >
                    {busy ? "Archiving..." : "Confirm archive"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    className="rounded-xl border border-line-300 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                    onClick={() => setConfirmArchive(false)}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </Block>
          ) : null}

          <div className="space-y-4 rounded-2xl border border-line-300 bg-canvas-950/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                {steps.map((step, index) => (
                  <button
                    key={step.key}
                    type="button"
                    disabled={busy}
                    onClick={() => setCurrentStep(index)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-black uppercase tracking-[.12em] transition disabled:cursor-wait disabled:opacity-50 ${
                      currentStep === index
                        ? "border-primary-300 bg-primary-500/15 text-primary-100"
                        : currentStep > index
                          ? "border-primary-400/30 text-primary-100"
                          : "border-line-300 text-ink-400 hover:text-white"
                    }`}
                  >
                    {index + 1}. {step.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 text-[11px] text-ink-500">
                <span>
                  {draftStatus === "saving"
                    ? "Saving draft..."
                    : draftStatus === "saved"
                      ? "Draft saved"
                      : "Draft changes autosave locally"}
                </span>
                <button
                  type="button"
                  className={ghostButton}
                  onClick={() => void saveCurrentStep()}
                  disabled={busy}
                >
                  {busy ? "Saving..." : "Save draft"}
                </button>
                <button
                  type="button"
                  className="rounded-xl bg-primary-500 px-3 py-2 text-xs font-black text-canvas-950"
                  onClick={() => void saveStepAndAdvance()}
                  disabled={busy || currentStep >= steps.length - 1}
                >
                  {busy ? "Saving..." : "Save and next"}
                </button>
              </div>
            </div>
            {editable ? (
              <details className="group rounded-xl border border-line-300 bg-canvas-950/30 p-3">
                <summary className="cursor-pointer list-none text-xs font-black uppercase tracking-[.14em] text-primary-200">
                  <span className="flex items-center justify-between gap-3">
                    Start from a template
                    <span className="text-ink-500 transition group-open:rotate-180">+</span>
                  </span>
                </summary>
                <div className="pt-3">
                  <CampaignTemplatePicker
                    selected={templateId}
                    disabled={busy}
                    onSelect={(id) => applyTemplate(id)}
                  />
                </div>
              </details>
            ) : null}
            <p className="text-[11px] leading-4 text-ink-500">
              Section save buttons apply changes to this campaign only. They do
              not create reusable presets; use Start from a template for reusable
              defaults.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_26rem] lg:items-start">
            <div className="space-y-6">
              <div className="rounded-2xl border border-line-300 bg-surface-900/50 p-4 sm:p-5">
                <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[.18em] text-primary-200">
                      Step {currentStep + 1} of {steps.length}
                    </p>
                    <h3 className="mt-1 font-display text-2xl text-white">
                      {steps[currentStep].label}
                    </h3>
                  </div>
                  <p className="max-w-sm text-right text-xs leading-5 text-ink-400">
                    {steps[currentStep].description} Save your draft or continue
                    when ready.
                  </p>
                </div>
                <div className="mb-4 flex flex-wrap items-center gap-3 text-[10px] uppercase tracking-[.12em] text-ink-500">
                  <span><span className="text-primary-200">*</span> Required</span>
                  <span>Recommended fields are optional</span>
                  <span>Hover or focus the i for help</span>
                </div>
              {currentStep === 0 ? (
                <>
                  {editable ? (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={ghostButton}
                        onClick={() => regenerate("all")}
                      >
                        Use generated defaults
                      </button>
                      <button
                        type="button"
                        className={ghostButton}
                        onClick={() => regenerate(COPY_FIELDS)}
                      >
                        Regenerate copy
                      </button>
                      <button
                        type="button"
                        className={ghostButton}
                        onClick={() => regenerate(["slug"])}
                      >
                        Reset slug
                      </button>
                      <button
                        type="button"
                        className={ghostButton}
                        onClick={() => regenerate(DATE_FIELDS)}
                      >
                        Reset dates
                      </button>
                    </div>
                  ) : null}

                  <FieldGrid>
                <Field label="Title" origin={origins.title}>
                  <input
                    className={inputClass}
                    placeholder="e.g. Bird Challenge"
                    value={draft.title}
                    disabled={!editable}
                    onChange={(e) => updateDraft("title", e.target.value)}
                  />
                </Field>
                <Field
                  label="Slug"
                  origin={origins.slug}
                  action={
                    editable
                      ? {
                          label: "Reset slug",
                          onClick: () => regenerate(["slug"]),
                          disabled: busy,
                        }
                      : undefined
                  }
                >
                  <input
                    className={inputClass}
                    placeholder="e.g. bird-challenge"
                    value={draft.slug}
                    disabled={!editable}
                    onChange={(e) => updateDraft("slug", e.target.value)}
                  />
                </Field>
                <Field label="Authorship">
                  <select
                    className={inputClass}
                    disabled={!editable}
                    value={draft.sponsorOrganizationId ?? ""}
                    onChange={(e) =>
                      updateDraft(
                        "sponsorOrganizationId",
                        e.target.value || null,
                      )
                    }
                  >
                    <option value="">AnimalDex-authored</option>
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.displayName}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  label="Presenter / sponsor display"
                  origin={origins.presenterName}
                  warning={readiness.fieldWarnings.sponsor}
                >
                  <input
                    className={inputClass}
                    placeholder="e.g. National Geographic Indonesia; blank for AnimalDex"
                    value={draft.presenterName ?? ""}
                    disabled={!editable}
                    onChange={(e) =>
                      updateDraft("presenterName", e.target.value)
                    }
                  />
                </Field>
                <Field
                  label="Starts"
                  origin={origins.startsAt}
                  warning={readiness.fieldWarnings.dates}
                >
                  <input
                    type="datetime-local"
                    className={inputClass}
                    value={draft.startsAt}
                    disabled={!editable}
                    onChange={(e) => updateDraft("startsAt", e.target.value)}
                  />
                </Field>
                <Field
                  label="Ends"
                  origin={origins.endsAt}
                  warning={readiness.fieldWarnings.dates}
                  action={
                    editable
                      ? {
                          label: "Reset dates",
                          onClick: () => regenerate(DATE_FIELDS),
                          disabled: busy,
                        }
                      : undefined
                  }
                >
                  <input
                    type="datetime-local"
                    className={inputClass}
                    value={draft.endsAt}
                    disabled={!editable}
                    onChange={(e) => updateDraft("endsAt", e.target.value)}
                  />
                </Field>
                <Field label="Timezone" origin={origins.timezoneIdentifier}>
                  <select
                    className={inputClass}
                    value={draft.timezoneIdentifier}
                    disabled={!editable}
                    onChange={(e) =>
                      updateDraft("timezoneIdentifier", e.target.value)
                    }
                  >
                    {timezoneOptions.map((zone) => (
                      <option key={zone}>{zone}</option>
                    ))}
                  </select>
                </Field>
                  </FieldGrid>

                  <Field label="Public summary" origin={origins.publicSummary}>
                <textarea
                  className={inputClass}
                  rows={2}
                  placeholder="e.g. Capture 20 different bird species."
                  value={draft.publicSummary}
                  disabled={!editable}
                  onChange={(e) => updateDraft("publicSummary", e.target.value)}
                />
                  </Field>
                  <Field label="Description" origin={origins.description}>
                <textarea
                  className={inputClass}
                  rows={4}
                  placeholder="e.g. Explore the reserve and submit qualifying captures during the campaign window."
                  value={draft.description}
                  disabled={!editable}
                  onChange={(e) => updateDraft("description", e.target.value)}
                />
                  </Field>

                </>
              ) : null}

              {currentStep === 2 ? (
              <Block title="Venue" note={VENUE_SECURITY_COPY}>
                <p className="text-xs text-ink-400">
                  Validation radius is the qualification geofence. Discovery
                  radius is only used for nearby listing.
                </p>
                <VenuePlaceSearch
                  disabled={!editable}
                  initialValue={venueName}
                  onSelect={(place) => {
                    setVenueName(place.label);
                    setVenueLat(String(place.latitude));
                    setVenueLng(String(place.longitude));
                    setVenueCountry(place.countryCode ?? "");
                    setVenuePlaceId("");
                  }}
                />
                {readiness.fieldWarnings.venue ? (
                  <p className="text-sm text-amber-100">
                    {readiness.fieldWarnings.venue}
                  </p>
                ) : null}
                <FieldGrid>
                  <Field label="Google Place ID">
                    <input
                      className={inputClass}
                      placeholder="e.g. ChIJ123456789; blank if unavailable"
                      value={venuePlaceId}
                      disabled={!editable}
                      onChange={(e) => setVenuePlaceId(e.target.value)}
                    />
                  </Field>
                  <Field label="Validation radius (m)" required={hasVenue || templateId === "venue_collector"}>
                    <input
                      className={inputClass}
                      placeholder="e.g. 400; blank for no venue"
                      value={venueRadius}
                      disabled={!editable}
                      onChange={(e) => setVenueRadius(e.target.value)}
                    />
                  </Field>
                  <Field label="Venue country code">
                    <input
                      className={inputClass}
                      placeholder="e.g. ID; blank if not needed"
                      value={venueCountry}
                      disabled={!editable}
                      onChange={(e) => setVenueCountry(e.target.value)}
                    />
                  </Field>
                  <Field label="Discovery radius (m)">
                    <input
                      className={inputClass}
                      placeholder="e.g. 5000; blank for platform default"
                      value={draft.discoveryRadiusM ?? ""}
                      disabled={!editable}
                      onChange={(e) =>
                        updateDraft(
                          "discoveryRadiusM",
                          e.target.value ? Number(e.target.value) : null,
                        )
                      }
                    />
                  </Field>
                </FieldGrid>
                <details className="mt-3 rounded-xl border border-line-300/70 px-3 py-2">
                  <summary className="cursor-pointer text-xs font-bold text-ink-300">
                    Advanced: review coordinates
                  </summary>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Field label="Latitude" required={hasVenue || templateId === "venue_collector"}>
                      <input
                        className={inputClass}
                        placeholder="Filled from the place search"
                        value={venueLat}
                        disabled={!editable}
                        onChange={(e) => setVenueLat(e.target.value)}
                      />
                    </Field>
                    <Field label="Longitude" required={hasVenue || templateId === "venue_collector"}>
                      <input
                        className={inputClass}
                        placeholder="Filled from the place search"
                        value={venueLng}
                        disabled={!editable}
                        onChange={(e) => setVenueLng(e.target.value)}
                      />
                    </Field>
                  </div>
                </details>
                <div className="mt-3 space-y-2">
                  <label className="flex items-center gap-2 text-sm text-ink-200">
                    <input
                      type="checkbox"
                      checked={hasVenue ? true : draft.liveOnly}
                      disabled={!editable || hasVenue}
                      onChange={(e) => updateDraft("liveOnly", e.target.checked)}
                    />
                    Live captures only
                    <InfoTip
                      label="Live captures only"
                      help="Venue-backed campaigns must use live captures so the server can validate the venue visit."
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm text-ink-200">
                    <input
                      type="checkbox"
                      checked={hasVenue ? false : draft.externalImportsAllowed}
                      disabled={!editable || hasVenue}
                      onChange={(e) =>
                        updateDraft("externalImportsAllowed", e.target.checked)
                      }
                    />
                    Allow external imports
                    <InfoTip
                      label="Allow external imports"
                      help="Allows qualifying activity imported from outside the live capture flow. Venue-backed campaigns cannot use imports."
                    />
                  </label>
                  {hasVenue ? (
                    <p className="text-xs text-ink-400">{VENUE_CONSTRAINT_COPY}</p>
                  ) : null}
                  {readiness.fieldWarnings.imports ? (
                    <p className="text-xs text-amber-100">
                      {readiness.fieldWarnings.imports}
                    </p>
                  ) : null}
                  {readiness.fieldWarnings.liveOnly ? (
                    <p className="text-xs text-amber-100">
                      {readiness.fieldWarnings.liveOnly}
                    </p>
                  ) : null}
                </div>
              </Block>
              ) : null}

              {currentStep === 1 ? (
                <>
              <Block
                title="Discovery targeting"
                note={DISCOVERY_GEOGRAPHY_COPY}
              >
                <p className="text-xs font-black uppercase tracking-[.14em] text-amber-200">
                  Not participant eligibility
                </p>
                {readiness.fieldWarnings.geo ? (
                  <p className="text-sm text-amber-100">
                    {readiness.fieldWarnings.geo}
                  </p>
                ) : null}
                <FieldGrid>
                  <Field label="Objective">
                    <select
                      className={inputClass}
                      value={draft.objectiveType}
                      disabled={!editable}
                      onChange={(e) =>
                        updateDraft("objectiveType", e.target.value)
                      }
                    >
                      {OBJECTIVE_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {objectiveLabel(type)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Target count">
                    <input
                      type="number"
                      min={1}
                      className={inputClass}
                      placeholder="e.g. 20"
                      value={draft.targetCount}
                      disabled={!editable}
                      onChange={(e) =>
                        updateDraft("targetCount", Number(e.target.value))
                      }
                    />
                  </Field>
                  <Field label="Required type tag">
                    <input
                      className={inputClass}
                      placeholder="e.g. Bird; blank for any type"
                      value={draft.requiredTypeTag ?? ""}
                      disabled={!editable}
                      onChange={(e) =>
                        updateDraft("requiredTypeTag", e.target.value)
                      }
                      onBlur={(e) =>
                        updateDraft(
                          "requiredTypeTag",
                          canonicalizeTypeTag(e.target.value) ?? "",
                        )
                      }
                    />
                  </Field>
                  <Field label="Required setting">
                    <select
                      className={inputClass}
                      value={draft.requiredSettingTag ?? ""}
                      disabled={!editable}
                      onChange={(e) =>
                        updateDraft(
                          "requiredSettingTag",
                          canonicalizeSettingTag(e.target.value) ?? "",
                        )
                      }
                    >
                      {SETTING_TAGS.map((tag) => (
                        <option key={tag} value={tag}>
                          {tag ? settingTagDisplayLabel(tag) : "Any"}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Minimum capture grade">
                    <input
                      type="number"
                      min={1}
                      max={10}
                      className={inputClass}
                      placeholder="e.g. 7; blank for any grade"
                      value={draft.minimumCaptureGrade ?? ""}
                      disabled={!editable}
                      onChange={(e) =>
                        updateDraft(
                          "minimumCaptureGrade",
                          e.target.value ? Number(e.target.value) : null,
                        )
                      }
                    />
                  </Field>
                </FieldGrid>
                <FieldGrid>
                  <Field label="Discovery mode">
                    <select
                      className={inputClass}
                      value={draft.geoMode}
                      disabled={!editable}
                      onChange={(e) => updateDraft("geoMode", e.target.value)}
                    >
                      <option value="unrestricted">Unrestricted</option>
                      <option value="allowlist">Allowlist</option>
                      <option value="denylist">Denylist</option>
                    </select>
                  </Field>
                  <Field label="Country codes (comma separated)">
                    <input
                      className={inputClass}
                      placeholder="e.g. ID, SG; blank for unrestricted"
                      value={countries}
                      disabled={!editable}
                      onChange={(e) => setCountries(e.target.value)}
                    />
                  </Field>
                </FieldGrid>
                {blocked ? (
                  <p className="mt-3 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                    {NON_VENUE_COUNTRY_COPY}
                  </p>
                ) : null}
              </Block>

                </>
              ) : null}

              {currentStep === 4 ? (
                <>

              <Block title="Official rules & reward terms">
                <p className="text-xs text-ink-400">
                  Current rules version: {campaign?.rulesVersion ?? 1}. Apple
                  disclaimer is persisted with each immutable version.
                </p>
                <p className="text-xs text-primary-100">
                  {GENERATED_RULES_NOTICE}
                </p>
                {readiness.fieldWarnings.rulesHistory ? (
                  <p className="text-xs text-amber-100">
                    {readiness.fieldWarnings.rulesHistory}
                  </p>
                ) : null}
                  <Field label="Official rules" origin={origins.officialRules}>
                  <textarea
                    className={inputClass}
                    rows={7}
                    placeholder="e.g. Participants must submit qualifying live captures taken during the campaign dates."
                    value={draft.officialRules}
                    disabled={
                      campaign
                        ? !canReviseRules(campaign.status) && !editable
                        : false
                    }
                    onChange={(e) =>
                      updateDraft("officialRules", e.target.value)
                    }
                  />
                </Field>
                <Field label="Reward terms" origin={origins.rewardTerms}>
                  <textarea
                    className={inputClass}
                    rows={4}
                    placeholder="e.g. Each qualifying participant receives the Bird Challenge achievement."
                    value={draft.rewardTerms}
                    disabled={
                      campaign
                        ? !canReviseRules(campaign.status) && !editable
                        : false
                    }
                    onChange={(e) => updateDraft("rewardTerms", e.target.value)}
                  />
                </Field>
                <p className="text-xs text-ink-400">
                  Persisted Apple disclaimer: {APPLE_DISCLAIMER}
                </p>
                {campaign && canReviseRules(campaign.status) && !editable ? (
                  <button
                    type="button"
                    disabled={busy}
                    className="mt-3 rounded-xl border border-line-300 px-4 py-2 text-sm font-bold text-white"
                    onClick={() =>
                      act(
                        {
                          action: "revise_rules",
                          campaignId: campaign.id,
                          officialRules: draft.officialRules,
                          rewardTerms: draft.rewardTerms,
                        },
                        "New immutable rules version created. Existing participants stay on the version they accepted.",
                      )
                    }
                  >
                    {busy ? "Revising rules..." : "Revise rules (new version)"}
                  </button>
                ) : null}
              </Block>

              <details className="group rounded-2xl border border-line-300 bg-canvas-950/40 p-4">
                <summary className="cursor-pointer list-none">
                  <span className="flex items-center justify-between gap-3">
                    <span>
                      <span className="block font-display text-2xl text-white">
                        Rules history
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-ink-400">
                        {RULES_HISTORY_COPY}
                      </span>
                    </span>
                    <span className="text-lg text-ink-500 transition group-open:rotate-45">+</span>
                  </span>
                </summary>
                <div className="mt-3 space-y-3">
                {currentVersion ? (
                  <article className="rounded-2xl border border-primary-400/40 bg-primary-500/10 p-4">
                    <p className="text-xs font-black uppercase tracking-[.14em] text-primary-200">
                      Current · v{currentVersion.rulesVersion}
                    </p>
                    <p className="mt-1 text-xs text-ink-400">
                      {new Date(currentVersion.createdAt).toLocaleString()}
                    </p>
                    <pre className="mt-3 whitespace-pre-wrap text-sm text-ink-100">
                      {currentVersion.officialRules}
                    </pre>
                    <pre className="mt-3 whitespace-pre-wrap text-sm text-ink-300">
                      {currentVersion.rewardTerms}
                    </pre>
                    <p className="mt-3 text-xs text-ink-400">
                      {currentVersion.appleDisclaimer}
                    </p>
                  </article>
                ) : (
                  <p className="text-sm text-ink-500">
                    Save the campaign to persist version 1.
                  </p>
                )}
                {previousVersions.map((version) => (
                  <article
                    key={version.rulesVersion}
                    className="rounded-2xl border border-line-300 bg-canvas-950/60 p-4"
                  >
                    <p className="text-xs font-black uppercase tracking-[.14em] text-ink-500">
                      Accepted history · v{version.rulesVersion}
                    </p>
                    <p className="mt-1 text-xs text-ink-500">
                      {new Date(version.createdAt).toLocaleString()}
                    </p>
                    <pre className="mt-3 whitespace-pre-wrap text-sm text-ink-200">
                      {version.officialRules}
                    </pre>
                    <pre className="mt-3 whitespace-pre-wrap text-sm text-ink-400">
                      {version.rewardTerms}
                    </pre>
                    <p className="mt-3 text-xs text-ink-500">
                      {version.appleDisclaimer}
                    </p>
                  </article>
                ))}
                </div>
              </details>
                </>
              ) : null}

              {currentStep === 4 ? (
                <>
              <details className="group rounded-2xl border border-line-300 bg-canvas-950/40 p-4">
                <summary className="cursor-pointer list-none">
                  <span className="flex items-center justify-between gap-3">
                    <span>
                      <span className="block font-display text-2xl text-white">
                        Challenge artwork
                      </span>
                      <span className="mt-1 block text-xs text-ink-400">
                        Optional 16:9 image shown on the consumer card.
                      </span>
                    </span>
                    <span className="text-lg text-ink-500 transition group-open:rotate-45">+</span>
                  </span>
                </summary>
                <div className="mt-3 space-y-3">
                <p className="text-xs text-ink-400">
                  Primary 16:9 image. Recommended 1600 × 900 · JPG, PNG or WebP
                  · maximum 8 MB. Keep important content inside the safe center
                  crop.
                </p>
                {campaign?.thumbnail ? (
                  <img
                    src={campaign.thumbnail.publicUrl}
                    alt={campaign.thumbnail.altText}
                    className="mt-3 aspect-video w-full rounded-2xl object-cover"
                  />
                ) : null}
                <Field label="Image alt text" required={Boolean(campaign?.thumbnail)}>
                  <input
                    className={inputClass}
                    value={thumbnailAlt}
                    disabled={!campaign || !editable}
                    onChange={(event) => setThumbnailAlt(event.target.value)}
                    placeholder="e.g. Visitors exploring BXSea; blank if no artwork"
                  />
                </Field>
                {campaign && editable ? (
                  <div className="space-y-2">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={busy || !thumbnailAlt.trim()}
                      onChange={(event) =>
                        void uploadThumbnail(event.target.files?.[0] ?? null)
                      }
                      className="text-sm text-ink-300"
                    />
                    {uploadingArtwork ? (
                      <p className="text-xs text-primary-100">Uploading artwork...</p>
                    ) : null}
                    <CampaignAssetPicker
                      disabled={busy || !thumbnailAlt.trim()}
                      onSelect={(url) => void uploadThumbnail(null, url)}
                    />
                  </div>
                ) : (
                  <p className="text-xs text-ink-500">
                    Save the campaign before uploading artwork.
                  </p>
                )}
                </div>
              </details>

                </>
              ) : null}

              {currentStep === 3 ? (
                <>

              <Block title="Rewards">
                <p className="text-xs text-ink-400">
                  Every qualifying participant receives the same deterministic
                  reward while funded inventory remains. Participation is free.
                  Credits, wagering, random winners, sweepstakes, and
                  user-funded pools are not supported.
                </p>
                {readiness.fieldWarnings.reward ? (
                  <p className="text-sm text-amber-100">
                    {readiness.fieldWarnings.reward}
                  </p>
                ) : null}
                <Field label="Reward type">
                  <select
                    className={inputClass}
                    value={cashEnabled ? "cash_and_achievement" : "achievement"}
                    disabled={!editable && Boolean(campaign)}
                    onChange={(event) => {
                      const enabled =
                        event.target.value === "cash_and_achievement";
                      setCashEnabled(enabled);
                      if (enabled && /no cash/i.test(draft.rewardTerms)) {
                        setDraft((current) => ({
                          ...current,
                          rewardTerms: generatedCashRewardTerms(),
                        }));
                        setOrigins((current) =>
                          markManual(current, "rewardTerms"),
                        );
                      }
                    }}
                  >
                    <option value="achievement">Achievement only</option>
                    <option value="cash_and_achievement">
                      Cash + Achievement
                    </option>
                  </select>
                </Field>
                <FieldGrid>
                  <Field
                    label="Achievement key / slug"
                    required
                    origin={origins.achievementSlug}
                  >
                    <input
                      className={inputClass}
                      value={achievementSlug}
                      placeholder="e.g. bird-challenge-complete"
                      disabled={!editable && Boolean(campaign)}
                      onChange={(e) => {
                        setAchievementSlug(e.target.value);
                        setOrigins((current) =>
                          markManual(current, "achievementSlug"),
                        );
                      }}
                    />
                  </Field>
                  <Field
                    label="Achievement name"
                    required
                    origin={origins.achievementTitle}
                  >
                    <input
                      className={inputClass}
                      value={achievementTitle}
                      placeholder="e.g. Bird Challenge Complete"
                      disabled={!editable && Boolean(campaign)}
                      onChange={(e) => {
                        setAchievementTitle(e.target.value);
                        setOrigins((current) =>
                          markManual(current, "achievementTitle"),
                        );
                      }}
                    />
                  </Field>
                </FieldGrid>
                <Field
                  label="Description"
                  help="The detail shown with the achievement participants receive on completion."
                  required
                  origin={origins.achievementDetail}
                >
                  <textarea
                    className={inputClass}
                    rows={2}
                    placeholder="e.g. A completion badge for identifying 20 bird species."
                    value={achievementDetail}
                    disabled={!editable && Boolean(campaign)}
                    onChange={(e) => {
                      setAchievementDetail(e.target.value);
                      setOrigins((current) =>
                        markManual(current, "achievementDetail"),
                      );
                    }}
                  />
                </Field>
                <p className="mt-2 text-xs text-ink-400">
                  {achievementSaved
                    ? "Saved to this campaign. Use Save draft or Save and next to apply changes."
                    : campaign
                      ? "Changes will be saved with Save draft or Save and next."
                      : "Create the campaign first, then save this step."}
                </p>
                {cashEnabled ? (
                  <div className="mt-5 rounded-2xl border border-primary-400/25 bg-primary-500/[.06] p-4">
                    <p className="text-xs font-black uppercase tracking-[.14em] text-primary-100">
                      Sponsor-funded cash Earnings
                    </p>
                    <p className="mt-1 text-xs text-ink-300">
                      Enter amounts in minor units. Example: 500 USD = $5.00 per participant.
                    </p>
                    <FieldGrid>
                      <Field label="Reward per participant (minor units)" required={cashEnabled}>
                        <input
                          className={inputClass}
                          type="number"
                          min="1"
                          step="1"
                          value={cashAmountMinor}
                          placeholder="e.g. 50000"
                          disabled={!editable && Boolean(campaign)}
                          onChange={(event) =>
                            setCashAmountMinor(event.target.value)
                          }
                        />
                      </Field>
                      <Field label="Currency" required={cashEnabled}>
                        <input
                          className={inputClass}
                          maxLength={3}
                          value={cashCurrency}
                          placeholder="e.g. USD"
                          disabled={!editable && Boolean(campaign)}
                          onChange={(event) =>
                            setCashCurrency(event.target.value.toUpperCase())
                          }
                        />
                      </Field>
                      <Field label="Maximum recipients" required={cashEnabled}>
                        <input
                          className={inputClass}
                          type="number"
                          min="1"
                          step="1"
                          value={cashRecipients}
                          placeholder="e.g. 500"
                          disabled={!editable && Boolean(campaign)}
                          onChange={(event) =>
                            setCashRecipients(event.target.value)
                          }
                        />
                      </Field>
                      <Field label="AnimalDex service fee (minor units)" required={cashEnabled}>
                        <input
                          className={inputClass}
                          type="number"
                          min="0"
                          step="1"
                          value={cashFeeMinor}
                          placeholder="e.g. 0"
                          disabled={!editable && Boolean(campaign)}
                          onChange={(event) =>
                            setCashFeeMinor(event.target.value)
                          }
                        />
                      </Field>
                    </FieldGrid>
                    <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2 xl:grid-cols-4">
                      <p>
                        Per participant:{" "}
                        {formatEarningsMinor(
                          Number(cashAmountMinor || 0),
                          cashCurrency,
                        )}
                      </p>
                      <p>
                        Reward funding ({cashRecipients} recipients):{" "}
                        {formatEarningsMinor(
                          Number(cashAmountMinor || 0) *
                            Number(cashRecipients || 0),
                          cashCurrency,
                        )}
                      </p>
                      <p>
                        Service fee:{" "}
                        {formatEarningsMinor(
                          Number(cashFeeMinor || 0),
                          cashCurrency,
                        )}
                      </p>
                      <p className="font-black text-white">
                        Campaign total:{" "}
                        {formatEarningsMinor(
                          Number(cashAmountMinor || 0) *
                            Number(cashRecipients || 0) +
                            Number(cashFeeMinor || 0),
                          cashCurrency,
                        )}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="mt-3 text-xs font-bold text-primary-100"
                      onClick={() => {
                        setDraft((current) => ({
                          ...current,
                          rewardTerms: generatedCashRewardTerms(),
                        }));
                        setOrigins((current) =>
                          markManual(current, "rewardTerms"),
                        );
                      }}
                    >
                      Regenerate fixed cash reward terms
                    </button>
                    {campaign?.cashReward ? (
                      <p className="mt-3 text-xs text-ink-300">
                        Funding:{" "}
                        {campaign.cashReward.fundingStatus.toUpperCase()} ·{" "}
                        {campaign.cashReward.remainingRecipients} of{" "}
                        {campaign.cashReward.maxRecipients} rewards remaining.
                      </p>
                    ) : null}
                    {campaign?.cashReward &&
                    campaign.cashReward.fundingStatus !== "confirmed" ? (
                      <p className="mt-3 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                        <strong>One final action:</strong> confirm that the sponsor has funded the full campaign total shown above. Enter the transfer, invoice, or receipt reference below, then select <strong>Confirm full funding</strong>.
                      </p>
                    ) : null}
                    <p className="mt-2 text-xs text-ink-400">
                      {cashRewardSaved
                        ? `Saved to this campaign. Funding status: ${campaign?.cashReward?.fundingStatus.toUpperCase()}. Use Save draft or Save and next to apply changes.`
                        : campaign
                          ? "Changes will be saved with Save draft or Save and next."
                          : "Create the campaign first, then save this step."}
                    </p>
                    {campaign?.cashReward &&
                    campaign.cashReward.fundingStatus !== "confirmed" ? (
                      <div className="mt-4">
                          <Field label="Funding reference" required>
                          <input
                            className={inputClass}
                            value={fundingReference}
                            placeholder="e.g. INV-2026-0042 or bank transfer ID"
                            onChange={(event) =>
                              setFundingReference(event.target.value)
                            }
                          />
                        </Field>
                        <button
                          type="button"
                          disabled={busy || !fundingReference.trim()}
                          className="rounded-xl bg-primary-500 px-4 py-2 text-sm font-black text-canvas-950 disabled:opacity-50"
                          onClick={() =>
                            act(
                              {
                                action: "confirm_cash_funding",
                                campaignId: campaign.id,
                                cashReward: cashRewardInput(),
                                fundingReference,
                              },
                              "Full campaign funding confirmed.",
                            )
                          }
                        >
                          {busy ? "Confirming funding..." : "Confirm full funding"}
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </Block>

                </>
              ) : null}

              {currentStep === 4 ? (
                <>

              {campaign ? (
                <Block title="Operator review">
                  <ReviewList campaign={campaign} blocked={blocked} />
                  <div className="mt-4 flex flex-wrap gap-2">
                    {buttons.submit && canSubmitCampaign(campaign.status) ? (
                      <button
                        type="button"
                        disabled={busy || Boolean(blocked)}
                        className="rounded-xl bg-primary-500 px-4 py-2 text-sm font-black text-canvas-950 disabled:opacity-50"
                        onClick={() =>
                          act(
                            { action: "submit", campaignId: campaign.id },
                            "Submitted for review.",
                          )
                        }
                      >
                        {busy ? "Submitting..." : "Submit"}
                      </button>
                    ) : null}
                    {buttons.approve ? (
                      <button
                        type="button"
                        disabled={busy}
                        className="rounded-xl bg-primary-500 px-4 py-2 text-sm font-black text-canvas-950"
                        onClick={() =>
                          act(
                            {
                              action: "review",
                              campaignId: campaign.id,
                              reviewAction: "approve",
                            },
                            "Approved.",
                          )
                        }
                      >
                        {busy ? "Approving..." : "Approve"}
                      </button>
                    ) : null}
                    {buttons.reject ? (
                      <button
                        type="button"
                        disabled={busy}
                        className="rounded-xl border border-line-300 px-4 py-2 text-sm font-bold text-white"
                        onClick={() =>
                          act(
                            {
                              action: "review",
                              campaignId: campaign.id,
                              reviewAction: "reject",
                            },
                            "Rejected.",
                          )
                        }
                      >
                        {busy ? "Rejecting..." : "Reject"}
                      </button>
                    ) : null}
                  </div>
                  {canReviewCampaign(campaign.status) ? (
                    <p className="mt-2 text-xs text-ink-400">
                      Approval is backend-authoritative. If the RPC rejects the
                      configuration, this screen will show that error.
                    </p>
                  ) : null}
                </Block>
              ) : null}
                </>
              ) : null}

              </div>
            </div>
            <CampaignPreview campaign={preview} />
          </div>
        </section>
      ) : null}
    </div>
  );
}

  const DRAFT_GENERATED_KEYS: ReadonlyArray<keyof CampaignDraftInput> = [
    "title",
    "slug",
    "publicSummary",
    "description",
    "officialRules",
    "rewardTerms",
    "presenterName",
    "startsAt",
    "endsAt",
    "timezoneIdentifier",
  ];

  // Fix: Enhanced title validation
  function isTitleValid(title: string): boolean {
    return typeof title === "string" && title.trim().length >= 1 && title.trim().length <= 255;
  }

  function isGeneratedDraftKey(
    key: keyof CampaignDraftInput,
  ): key is Extract<GeneratedField, keyof CampaignDraftInput> {
    return DRAFT_GENERATED_KEYS.includes(key);
  }

  function canMutate(campaign: AdminCampaignDetail | null) {
    return !campaign || canEditCampaign(campaign.status);
  }

const inputClass =
  "w-full rounded-xl border border-line-300 bg-canvas-950 px-3 py-2 text-sm text-white outline-none focus:border-primary-300 disabled:opacity-60";
const ghostButton =
  "rounded-xl border border-line-300 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50";

const FIELD_HELP: Record<string, string> = {
  Title: "The public name shown to participants.",
  Slug: "The stable URL-safe identifier. Use lowercase words separated by hyphens.",
  Authorship: "Choose AnimalDex-authored, or link this Challenge to a sponsor organization.",
  "Presenter / sponsor display": "The sponsor name shown publicly on a sponsored Challenge. Example: National Geographic Indonesia. Leave blank for AnimalDex-authored campaigns.",
  Starts: "When participants can begin the Challenge. Example: Aug 27, 2026 at 09:00.",
  Ends: "When the Challenge stops accepting qualifying activity. Example: Sep 26, 2026 at 23:59.",
  Timezone: "The timezone used to interpret the start and end dates. Example: Asia/Jakarta or America/Los_Angeles.",
  "Public summary": "The short description used on Challenge cards and listings.",
  Description: "The longer explanation participants read before joining.",
  "Venue display name": "The physical place participants must visit or capture from.",
  "Google Place ID": "Optional stable Google location identifier for the venue. Example: ChIJ123456789. Leave blank if no Google Place ID is available.",
  Latitude: "The venue latitude used for server-side proximity validation. Example: -6.3123. Leave blank for a non-venue campaign.",
  Longitude: "The venue longitude used for server-side proximity validation. Example: 106.8206. Leave blank for a non-venue campaign.",
  "Validation radius (m)": "How close a capture must be to the venue to qualify. Example: 400. Leave blank for a non-venue campaign.",
  "Venue country code": "Optional ISO country code for the venue, such as ID or SG. Leave blank when venue country is not needed.",
  "Discovery radius (m)": "How far from the venue the Challenge may appear in discovery. Example: 5000. Leave blank to use the platform default.",
  Objective: "The action participants must complete to qualify. Examples: Unique indexed entries, eligible capture count, or active capture days.",
  "Target count": "How many qualifying actions are needed to complete the Challenge. Example: 20 entries.",
  "Required type tag": "Limits qualifying captures to an animal type, such as Bird, Reptile, or Mammal. Leave blank to accept any type.",
  "Required setting": "Limits qualifying captures to a setting. Examples: Wild, Zoo, Farm, Domestic, or Any.",
  "Minimum capture grade": "The minimum quality grade accepted for a qualifying capture. Example: 7. Leave blank to accept any grade.",
  "Discovery mode": "Controls whether discovery is unrestricted or uses a country list. Examples: Unrestricted, Allowlist, or Denylist.",
  "Country codes (comma separated)": "Countries used for discovery only, not participant eligibility. Use ISO 3166-1 alpha-2 codes, such as ID, SG, or US. Leave blank for unrestricted discovery.",
  "Official rules": "The authoritative rules participants accept. Keep them factual and deterministic.",
  "Reward terms": "The public terms explaining exactly what a qualifying participant receives.",
  "Image alt text": "Accessible text describing the artwork for people using assistive technology. Leave blank if no artwork is uploaded.",
  "Reward type": "Choose achievement-only, or add sponsor-funded cash Earnings. Example: Achievement only for a non-cash campaign.",
  "Achievement key / slug": "The stable AnimalDex achievement identifier granted on completion. Example: bird-challenge-complete.",
  "Achievement name": "The achievement name participants receive. Example: Bird Challenge Complete.",
  "Reward per participant (minor units)": "The cash amount per participant in the smallest currency unit, such as cents.",
  Currency: "The three-letter currency code for the cash reward, such as USD.",
  "Maximum recipients": "The fixed maximum number of participants who can receive cash. Example: 500.",
  "AnimalDex service fee (minor units)": "The fixed platform fee in the smallest currency unit. Example: 0 or 2500.",
  "Funding reference": "An invoice, transfer, or receipt reference used to confirm funding. Example: INV-2026-0042.",
  "New organization name": "The sponsor organization name displayed to participants. Leave blank to keep the campaign AnimalDex-authored.",
  "Organization slug": "A stable lowercase identifier for the sponsor organization. Leave blank when no sponsor organization is being created.",
};

const REQUIRED_FIELDS = new Set([
  "Title",
  "Slug",
  "Public summary",
  "Description",
  "Starts",
  "Ends",
  "Timezone",
  "Objective",
  "Target count",
  "Official rules",
  "Reward terms",
  "Reward type",
  "Achievement key / slug",
  "Achievement name",
]);

const RECOMMENDED_FIELDS = new Set([
  "Presenter / sponsor display",
  "Google Place ID",
  "Venue country code",
  "Discovery radius (m)",
  "Minimum capture grade",
]);

function InfoTip({ label, help }: { label: string; help: string }) {
  const tooltipId = useId();
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label={`Explain ${label}`}
        aria-describedby={tooltipId}
        title={help}
        className="grid h-4 w-4 place-items-center rounded-full border border-line-300 text-[10px] font-black normal-case text-ink-300 outline-none hover:border-primary-300 hover:text-primary-100 focus:border-primary-300 focus:text-primary-100"
      >
        i
      </button>
      <span
        id={tooltipId}
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-0 z-20 mb-2 w-56 rounded-lg border border-line-300 bg-canvas-950 px-2.5 py-2 text-[11px] normal-case leading-4 text-ink-100 opacity-0 shadow-xl transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {help}
      </span>
    </span>
  );
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-bold ${active ? "border-primary-300 bg-primary-500/15 text-primary-100" : "border-line-300 text-ink-400"}`}
    >
      {label}
    </button>
  );
}

type LibraryAsset = {
  path: string;
  url: string;
  filename: string;
  source?: string;
};

type VenuePlace = {
  label: string;
  latitude: number;
  longitude: number;
  countryCode: string | null;
};

function VenuePlaceSearch({
  disabled,
  initialValue,
  onSelect,
}: {
  disabled: boolean;
  initialValue: string;
  onSelect: (place: VenuePlace) => void;
}) {
  const [query, setQuery] = useState(initialValue);
  const [places, setPlaces] = useState<VenuePlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (!query.trim() || query.trim().length < 3) {
      setPlaces([]);
      setSearched(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/locations/geocode?q=${encodeURIComponent(query.trim())}`,
          { signal: controller.signal, cache: "no-store" },
        );
        const payload = (await response.json()) as { places?: VenuePlace[] };
        setPlaces(payload.places ?? []);
        setSearched(true);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setPlaces([]);
          setSearched(true);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 350);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  return (
    <div className="mb-4 rounded-xl border border-primary-500/30 bg-primary-500/5 p-3">
      <div className="mb-2 flex items-center gap-2">
        <p className="text-xs font-black uppercase tracking-[.14em] text-primary-100">
          Find a venue
        </p>
        <InfoTip
          label="Find a venue"
          help="Search by venue name, street address, postcode, city, or landmark. Selecting a result fills the location coordinates used for visit validation."
        />
      </div>
      <input
        className={inputClass}
        value={query}
        disabled={disabled}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="e.g. Ragunan Zoo, Jl. Harsono RM 1, Jakarta"
      />
      {loading ? <p className="mt-2 text-xs text-ink-400">Searching places...</p> : null}
      {!loading && searched && !places.length ? (
        <p className="mt-2 text-xs text-amber-100">
          No places found. Try a fuller address or open Advanced to enter coordinates manually.
        </p>
      ) : null}
      {places.length ? (
        <div className="mt-2 space-y-1">
          {places.map((place) => (
            <button
              key={`${place.label}-${place.latitude}-${place.longitude}`}
              type="button"
              disabled={disabled}
              onClick={() => {
                onSelect(place);
                setQuery(place.label);
                setPlaces([]);
                setSearched(false);
              }}
              className="block w-full rounded-lg border border-line-300 px-3 py-2 text-left text-xs text-ink-200 hover:border-primary-300 disabled:opacity-50"
            >
              {place.label}
            </button>
          ))}
        </div>
      ) : null}
      <p className="mt-2 text-[11px] text-ink-500">
        Search results provided by OpenStreetMap. Check the selected place before saving.
      </p>
    </div>
  );
}

function CampaignAssetPicker({
  disabled,
  onSelect,
}: {
  disabled: boolean;
  onSelect: (url: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [assets, setAssets] = useState<LibraryAsset[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || assets.length) return;
    setLoading(true);
    fetch("/api/admin/assets?limit=60", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json()) as {
          ok: boolean;
          assets?: LibraryAsset[];
          error?: string;
        };
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || "Unable to load assets");
        }
        setAssets(
          (payload.assets ?? []).filter((asset) => /\.(jpe?g|png|webp)$/i.test(asset.filename)),
        );
      })
      .catch((caught) =>
        setError(caught instanceof Error ? caught.message : "Unable to load assets"),
      )
      .finally(() => setLoading(false));
  }, [assets.length, open]);

  return (
    <div className="rounded-xl border border-line-300 bg-canvas-950/30 p-3">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className="text-xs font-bold text-primary-100 disabled:opacity-50"
      >
        {open ? "Hide asset library" : "Choose from /assets"}
      </button>
      {open ? (
        <div className="mt-3">
          {loading ? <p className="text-xs text-ink-400">Loading assets...</p> : null}
          {error ? <p className="text-xs text-rose-100">{error}</p> : null}
          {!loading && !error ? (
            assets.length ? (
              <div className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-5">
                {assets.map((asset) => (
                  <button
                    key={asset.path}
                    type="button"
                    disabled={disabled}
                    title={`Use ${asset.filename}`}
                    onClick={() => {
                      onSelect(asset.url);
                      setOpen(false);
                    }}
                    className="overflow-hidden rounded-lg border border-line-300 text-left disabled:opacity-50"
                  >
                    <img src={asset.url} alt="" className="aspect-square w-full object-cover" />
                    <span className="block truncate px-1.5 py-1 text-[9px] text-ink-300">
                      {asset.filename}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-ink-400">
                No JPG, PNG, or WebP images are available in /assets yet.
              </p>
            )
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function StatusBadge({ status }: { status: CampaignStatus }) {
  const archived = isArchivedShownAsLive(status);
  return (
    <span
      className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[.12em] ${archived ? "border-rose-400/40 text-rose-100" : status === "live" ? "border-primary-300 text-primary-100" : "border-line-300 text-ink-300"}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

function FieldGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 md:grid-cols-2">{children}</div>;
}

function Field({
  label,
  children,
  origin,
  warning,
  action,
  help,
  required,
  recommended,
}: {
  label: string;
  children: ReactNode;
  origin?: FieldOrigin;
  warning?: string;
  action?: { label: string; onClick: () => void; disabled?: boolean };
  help?: string;
  required?: boolean;
  recommended?: boolean;
}) {
  const helpText = help ?? FIELD_HELP[label];
  const isRequired = required ?? REQUIRED_FIELDS.has(label);
  const isRecommended = recommended ?? RECOMMENDED_FIELDS.has(label);

  return (
    <div className="block space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[.12em] text-ink-500">
          {label}{isRequired ? <span className="ml-1 text-primary-200" aria-label="required">*</span> : null}
        </span>
        {helpText ? <InfoTip label={label} help={helpText} /> : null}
        {isRequired ? (
          <span className="text-[10px] font-bold text-primary-200">Required</span>
        ) : isRecommended ? (
          <span className="text-[10px] font-bold text-ink-400">Recommended</span>
        ) : null}
        {origin === "auto" ? (
          <span className="rounded-full border border-primary-400/30 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[.12em] text-primary-100">
            Auto
          </span>
        ) : null}
        {action ? (
          <button
            type="button"
            disabled={action.disabled}
            className="text-[10px] font-bold text-primary-200"
            onClick={action.onClick}
          >
            {action.label}
          </button>
        ) : null}
      </div>
      {children}
      {warning ? <p className="text-xs text-amber-100">{warning}</p> : null}
    </div>
  );
}

function Block({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-2xl border border-line-300 bg-canvas-950/40 p-4">
      <div>
        <h3 className="font-display text-2xl text-white">{title}</h3>
        {note ? (
          <p className="mt-1 text-xs leading-5 text-ink-400">{note}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-2xl border border-line-300 bg-canvas-950/70 p-4">
      <p className="font-display text-2xl text-white">{value}</p>
      <p className="mt-1 text-xs text-ink-500">{label}</p>
    </div>
  );
}

function OrgBox({
  disabled,
  loading,
  name,
  slug,
  onName,
  onSlug,
  onCreate,
}: {
  disabled: boolean;
  loading: boolean;
  name: string;
  slug: string;
  onName: (value: string) => void;
  onSlug: (value: string) => void;
  onCreate: () => void;
}) {
  return (
    <details className="group rounded-2xl border border-line-300 bg-canvas-950/40 p-4">
      <summary className="cursor-pointer list-none">
        <span className="flex items-center justify-between gap-3">
          <span>
            <span className="block font-display text-2xl text-white">
              Sponsor organization
            </span>
            <span className="mt-1 block text-xs text-ink-400">
              Optional. Leave AnimalDex-authored for first-party Challenges.
            </span>
          </span>
          <span className="text-lg text-ink-500 transition group-open:rotate-45">+</span>
        </span>
      </summary>
      <div className="mt-3 space-y-3">
        <p className="text-xs text-ink-400">
          Create an organization here if this Challenge is presented by a sponsor.
          Business membership management is not included.
        </p>
        <FieldGrid>
          <Field label="New organization name">
            <input
              className={inputClass}
              value={name}
              placeholder="e.g. Nusantara Wildlife Foundation; blank for AnimalDex"
              disabled={disabled}
              onChange={(e) => onName(e.target.value)}
            />
          </Field>
          <Field label="Organization slug">
            <input
              className={inputClass}
              value={slug}
              placeholder="e.g. nusantara-wildlife-foundation; blank if no sponsor"
              disabled={disabled}
              onChange={(e) => onSlug(e.target.value)}
            />
          </Field>
        </FieldGrid>
        <button
          type="button"
          disabled={disabled || !name || !slug}
          className="rounded-xl border border-line-300 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          onClick={onCreate}
        >
          {loading ? "Saving organization..." : "Save organization"}
        </button>
      </div>
    </details>
  );
}

function ReviewList({
  campaign,
  blocked,
}: {
  campaign: AdminCampaignDetail;
  blocked: string | null;
}) {
  return (
    <dl className="grid gap-3 text-sm text-ink-200 md:grid-cols-2">
      <div>
        <dt className="text-xs uppercase tracking-[.12em] text-ink-500">
          Sponsor
        </dt>
        <dd>
          {authorshipLabel(
            campaign.sponsorOrganizationId,
            campaign.presenterName || campaign.sponsorDisplayName,
          )}
        </dd>
      </div>
      <div>
        <dt className="text-xs uppercase tracking-[.12em] text-ink-500">
          Timing
        </dt>
        <dd>
          {formatWindow(
            campaign.startsAt,
            campaign.endsAt,
            campaign.timezoneIdentifier,
          )}
        </dd>
      </div>
      <div>
        <dt className="text-xs uppercase tracking-[.12em] text-ink-500">
          Objective
        </dt>
        <dd>
          {objectiveLabel(campaign.objectiveType)} · target{" "}
          {campaign.targetCount}
        </dd>
      </div>
      <div>
        <dt className="text-xs uppercase tracking-[.12em] text-ink-500">
          Constraints
        </dt>
        <dd>
          {[
            campaign.requiredTypeTag,
            campaign.requiredSettingTag,
            campaign.minimumCaptureGrade
              ? `grade ≥ ${campaign.minimumCaptureGrade}`
              : null,
          ]
            .filter(Boolean)
            .join(" · ") || "None"}
        </dd>
      </div>
      <div>
        <dt className="text-xs uppercase tracking-[.12em] text-ink-500">
          Venue
        </dt>
        <dd>
          {campaign.venue
            ? `${campaign.venue.displayName} · validation ${campaign.venue.validationRadiusM} m · trusted GPS required · imports excluded`
            : "None"}
        </dd>
      </div>
      <div>
        <dt className="text-xs uppercase tracking-[.12em] text-ink-500">
          Discovery
        </dt>
        <dd>
          {campaign.geoMode}
          {campaign.discoveryCountries.length
            ? ` · ${campaign.discoveryCountries.join(", ")}`
            : ""}{" "}
          · discovery only
        </dd>
      </div>
      <div>
        <dt className="text-xs uppercase tracking-[.12em] text-ink-500">
          Rules
        </dt>
        <dd>v{campaign.rulesVersion}</dd>
      </div>
      <div>
        <dt className="text-xs uppercase tracking-[.12em] text-ink-500">
          Reward
        </dt>
        <dd>{campaign.reward?.title || "Missing achievement"}</dd>
      </div>
      {blocked ? (
        <div className="md:col-span-2 text-amber-100">
          {NON_VENUE_COUNTRY_COPY}
        </div>
      ) : null}
    </dl>
  );
}
