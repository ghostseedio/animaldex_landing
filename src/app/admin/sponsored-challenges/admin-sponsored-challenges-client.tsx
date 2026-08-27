"use client";

import Link from "next/link";
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
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
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);

  const loadList = useCallback(async () => {
    const response = await fetch("/api/admin/sponsored-challenges", {
      cache: "no-store",
    });
    const payload = (await response.json()) as ListPayload;
    if (!response.ok || !payload.ok)
      throw new Error(payload.error || "Unable to load campaigns");
    setCampaigns(payload.campaigns ?? []);
    setOrganizations(payload.organizations ?? []);
  }, []);

  const applyDetail = useCallback(
    (detail: AdminCampaignDetail, resetOrigins = true) => {
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
    },
    [],
  );

  const loadDetail = useCallback(
    async (id: string) => {
      const response = await fetch(`/api/admin/sponsored-challenges?id=${id}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as DetailPayload;
      if (!response.ok || !payload.ok || !payload.campaign)
        throw new Error(payload.error || "Unable to load campaign");
      applyDetail(payload.campaign, true);
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
      } catch (err) {
        setError(err instanceof Error ? err.message : "Action failed");
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
  }

  async function saveDraft() {
    const payload: CampaignDraftInput = {
      ...draft,
      startsAt: toIso(draft.startsAt),
      endsAt: toIso(draft.endsAt),
      hasVenue: hasVenue || Boolean(campaign?.venue),
    };
    await act({ action: "upsert_campaign", draft: payload }, "Campaign saved.");
  }

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

  async function uploadThumbnail(file: File | null) {
    if (!campaign || !file) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("campaignId", campaign.id);
      form.set("altText", thumbnailAlt);
      form.set("file", file);
      const response = await fetch("/api/admin/sponsored-challenges/image", {
        method: "POST",
        body: form,
      });
      const payload = (await response.json()) as DetailPayload;
      if (!response.ok || !payload.ok)
        throw new Error(payload.error || "Image upload failed");
      await loadDetail(campaign.id);
      await loadList();
      setNotice("Challenge image uploaded.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image upload failed");
    } finally {
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
          className="rounded-xl bg-primary-500 px-4 py-2 text-sm font-black text-canvas-950"
        >
          New campaign
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
        {filtered.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() =>
              loadDetail(item.id).catch((err: Error) => setError(err.message))
            }
            className={`rounded-3xl border p-5 text-left transition ${selectedId === item.id ? "border-primary-300 bg-primary-500/10" : "border-line-300 bg-surface-900 hover:border-primary-400/40"}`}
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
              Updated {new Date(item.updatedAt).toLocaleString()}
            </p>
          </button>
        ))}
        {filtered.length === 0 ? (
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

          {editable ? (
            <CampaignTemplatePicker
              selected={templateId}
              disabled={busy}
              onSelect={(id) => applyTemplate(id)}
            />
          ) : null}

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_26rem] lg:items-start">
            <div className="space-y-6">
              <CampaignReadinessPanel result={readiness} />

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
                        }
                      : undefined
                  }
                >
                  <input
                    className={inputClass}
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
                    placeholder="Bird"
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

              <Field label="Public summary" origin={origins.publicSummary}>
                <textarea
                  className={inputClass}
                  rows={2}
                  value={draft.publicSummary}
                  disabled={!editable}
                  onChange={(e) => updateDraft("publicSummary", e.target.value)}
                />
              </Field>
              <Field label="Description" origin={origins.description}>
                <textarea
                  className={inputClass}
                  rows={4}
                  value={draft.description}
                  disabled={!editable}
                  onChange={(e) => updateDraft("description", e.target.value)}
                />
              </Field>

              <label className="flex items-center gap-2 text-sm text-ink-200">
                <input
                  type="checkbox"
                  checked={hasVenue ? true : draft.liveOnly}
                  disabled={!editable || hasVenue}
                  onChange={(e) => updateDraft("liveOnly", e.target.checked)}
                />
                Live captures only
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

              {editable ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => saveDraft()}
                  className="rounded-xl bg-primary-500 px-4 py-2 text-sm font-black text-canvas-950 disabled:opacity-50"
                >
                  Save campaign
                </button>
              ) : (
                <p className="text-xs text-ink-500">
                  Eligibility fields are locked after approval. Use rules
                  revision for copy changes.
                </p>
              )}

              <OrgBox
                disabled={busy || !editable}
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

              <Block title="Venue" note={VENUE_SECURITY_COPY}>
                <p className="text-xs text-ink-400">
                  Validation radius is the qualification geofence. Discovery
                  radius is only used for nearby listing.
                </p>
                {readiness.fieldWarnings.venue ? (
                  <p className="text-sm text-amber-100">
                    {readiness.fieldWarnings.venue}
                  </p>
                ) : null}
                <FieldGrid>
                  <Field label="Venue display name">
                    <input
                      className={inputClass}
                      value={venueName}
                      disabled={!editable}
                      onChange={(e) => setVenueName(e.target.value)}
                    />
                  </Field>
                  <Field label="Google Place ID">
                    <input
                      className={inputClass}
                      value={venuePlaceId}
                      disabled={!editable}
                      onChange={(e) => setVenuePlaceId(e.target.value)}
                    />
                  </Field>
                  <Field label="Latitude">
                    <input
                      className={inputClass}
                      value={venueLat}
                      disabled={!editable}
                      onChange={(e) => setVenueLat(e.target.value)}
                    />
                  </Field>
                  <Field label="Longitude">
                    <input
                      className={inputClass}
                      value={venueLng}
                      disabled={!editable}
                      onChange={(e) => setVenueLng(e.target.value)}
                    />
                  </Field>
                  <Field label="Validation radius (m)">
                    <input
                      className={inputClass}
                      value={venueRadius}
                      disabled={!editable}
                      onChange={(e) => setVenueRadius(e.target.value)}
                    />
                  </Field>
                  <Field label="Venue country code">
                    <input
                      className={inputClass}
                      value={venueCountry}
                      disabled={!editable}
                      onChange={(e) => setVenueCountry(e.target.value)}
                    />
                  </Field>
                  <Field label="Discovery radius (m)">
                    <input
                      className={inputClass}
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
                {campaign && editable ? (
                  <button
                    type="button"
                    disabled={busy || !venueName || !venueLat || !venueLng}
                    className="mt-3 rounded-xl border border-line-300 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                    onClick={() =>
                      act(
                        {
                          action: "set_venue",
                          campaignId: campaign.id,
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
                      )
                    }
                  >
                    Save venue
                  </button>
                ) : null}
              </Block>

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
                      placeholder="ID, SG"
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
                {campaign && editable ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      className="rounded-xl border border-line-300 px-4 py-2 text-sm font-bold text-white"
                      onClick={() => saveDraft()}
                    >
                      Save discovery mode
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      className="rounded-xl border border-line-300 px-4 py-2 text-sm font-bold text-white"
                      onClick={() =>
                        act(
                          {
                            action: "set_geo",
                            campaignId: campaign.id,
                            countryCodes: discoveryCountries,
                          },
                          "Discovery countries saved.",
                        )
                      }
                    >
                      Save discovery countries
                    </button>
                  </div>
                ) : null}
              </Block>

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
                    Revise rules (new version)
                  </button>
                ) : null}
              </Block>

              <Block title="Rules history" note={RULES_HISTORY_COPY}>
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
              </Block>

              <Block title="Challenge artwork">
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
                <Field label="Image alt text">
                  <input
                    className={inputClass}
                    value={thumbnailAlt}
                    disabled={!campaign || !editable}
                    onChange={(event) => setThumbnailAlt(event.target.value)}
                    placeholder="Visitors exploring BXSea during the challenge"
                  />
                </Field>
                {campaign && editable ? (
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={busy || !thumbnailAlt.trim()}
                    onChange={(event) =>
                      void uploadThumbnail(event.target.files?.[0] ?? null)
                    }
                    className="text-sm text-ink-300"
                  />
                ) : (
                  <p className="text-xs text-ink-500">
                    Save the campaign before uploading artwork.
                  </p>
                )}
              </Block>

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
                    origin={origins.achievementSlug}
                  >
                    <input
                      className={inputClass}
                      value={achievementSlug}
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
                    origin={origins.achievementTitle}
                  >
                    <input
                      className={inputClass}
                      value={achievementTitle}
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
                <Field label="Description" origin={origins.achievementDetail}>
                  <textarea
                    className={inputClass}
                    rows={2}
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
                {campaign && editable ? (
                  <button
                    type="button"
                    disabled={busy}
                    className="mt-3 rounded-xl border border-line-300 px-4 py-2 text-sm font-bold text-white"
                    onClick={() =>
                      act(
                        {
                          action: "set_reward",
                          campaignId: campaign.id,
                          achievement: {
                            slug: achievementSlug,
                            title: achievementTitle,
                            detail: achievementDetail,
                          },
                        },
                        "Achievement reward saved.",
                      )
                    }
                  >
                    Save achievement
                  </button>
                ) : null}
                {cashEnabled ? (
                  <div className="mt-5 rounded-2xl border border-primary-400/25 bg-primary-500/[.06] p-4">
                    <p className="text-xs font-black uppercase tracking-[.14em] text-primary-100">
                      Sponsor-funded cash Earnings
                    </p>
                    <FieldGrid>
                      <Field label="Reward per participant (minor units)">
                        <input
                          className={inputClass}
                          type="number"
                          min="1"
                          step="1"
                          value={cashAmountMinor}
                          disabled={!editable && Boolean(campaign)}
                          onChange={(event) =>
                            setCashAmountMinor(event.target.value)
                          }
                        />
                      </Field>
                      <Field label="Currency">
                        <input
                          className={inputClass}
                          maxLength={3}
                          value={cashCurrency}
                          disabled={!editable && Boolean(campaign)}
                          onChange={(event) =>
                            setCashCurrency(event.target.value.toUpperCase())
                          }
                        />
                      </Field>
                      <Field label="Maximum recipients">
                        <input
                          className={inputClass}
                          type="number"
                          min="1"
                          step="1"
                          value={cashRecipients}
                          disabled={!editable && Boolean(campaign)}
                          onChange={(event) =>
                            setCashRecipients(event.target.value)
                          }
                        />
                      </Field>
                      <Field label="AnimalDex service fee (minor units)">
                        <input
                          className={inputClass}
                          type="number"
                          min="0"
                          step="1"
                          value={cashFeeMinor}
                          disabled={!editable && Boolean(campaign)}
                          onChange={(event) =>
                            setCashFeeMinor(event.target.value)
                          }
                        />
                      </Field>
                    </FieldGrid>
                    <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                      <p>
                        Reward funding:{" "}
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
                    {campaign && editable ? (
                      <button
                        type="button"
                        disabled={busy}
                        className="mt-3 rounded-xl border border-line-300 px-4 py-2 text-sm font-bold text-white"
                        onClick={() =>
                          act(
                            {
                              action: "set_cash_reward",
                              campaignId: campaign.id,
                              cashReward: cashRewardInput(),
                            },
                            "Cash reward configuration saved; funding confirmation is still required.",
                          )
                        }
                      >
                        Save cash reward
                      </button>
                    ) : null}
                    {campaign?.cashReward &&
                    campaign.cashReward.fundingStatus !== "confirmed" ? (
                      <div className="mt-4">
                        <Field label="Funding reference">
                          <input
                            className={inputClass}
                            value={fundingReference}
                            onChange={(event) =>
                              setFundingReference(event.target.value)
                            }
                            placeholder="Invoice or bank receipt reference"
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
                          Confirm full funding
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </Block>

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
                        Submit
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
                        Approve
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
                        Reject
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

              {campaign && canArchiveCampaign(campaign.status) ? (
                <Block title="Archive kill switch" note={ARCHIVE_COPY}>
                  {!confirmArchive ? (
                    <button
                      type="button"
                      className="rounded-xl border border-rose-400/40 px-4 py-2 text-sm font-bold text-rose-100"
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
                        Confirm archive
                      </button>
                      <button
                        type="button"
                        className="rounded-xl border border-line-300 px-4 py-2 text-sm font-bold text-white"
                        onClick={() => setConfirmArchive(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </Block>
              ) : null}

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
}: {
  label: string;
  children: ReactNode;
  origin?: FieldOrigin;
  warning?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="block space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[.12em] text-ink-500">
          {label}
        </span>
        {origin === "auto" ? (
          <span className="rounded-full border border-primary-400/30 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[.12em] text-primary-100">
            Auto
          </span>
        ) : null}
        {action ? (
          <button
            type="button"
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
  name,
  slug,
  onName,
  onSlug,
  onCreate,
}: {
  disabled: boolean;
  name: string;
  slug: string;
  onName: (value: string) => void;
  onSlug: (value: string) => void;
  onCreate: () => void;
}) {
  return (
    <Block title="Sponsor organization">
      <p className="text-xs text-ink-400">
        Optional. Leave authorship as AnimalDex-authored for first-party
        Challenges. Business membership management is not included.
      </p>
      <FieldGrid>
        <Field label="New organization name">
          <input
            className={inputClass}
            value={name}
            disabled={disabled}
            onChange={(e) => onName(e.target.value)}
          />
        </Field>
        <Field label="Organization slug">
          <input
            className={inputClass}
            value={slug}
            disabled={disabled}
            onChange={(e) => onSlug(e.target.value)}
          />
        </Field>
      </FieldGrid>
      <button
        type="button"
        disabled={disabled || !name || !slug}
        className="mt-3 rounded-xl border border-line-300 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        onClick={onCreate}
      >
        Save organization
      </button>
    </Block>
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
