"use client";
import {
  canonicalizeSettingTag,
  canonicalizeTypeTag,
  type AdminCampaignDetail,
  type AdminCampaignListItem,
  type CampaignDraftInput,
  type CampaignStatus,
} from "@/lib/sponsored-challenges-admin";

export type Organization = {
  id: string;
  displayName: string;
  slug: string;
  websiteUrl: string | null;
};

export type ListPayload = {
  ok: boolean;
  campaigns?: AdminCampaignListItem[];
  organizations?: Organization[];
  appleDisclaimer?: string;
  error?: string;
};

export type DetailPayload = {
  ok: boolean;
  campaign?: AdminCampaignDetail;
  organization?: Organization;
  code?: string;
  error?: string;
};

export type ThumbnailPayload = {
  storagePath: string;
  publicUrl: string;
  altText: string;
  updatedAt: string | null;
};

export const STATUS_LABEL: Record<CampaignStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
  scheduled: "Scheduled",
  live: "Live",
  completed: "Completed",
  rejected: "Rejected",
  archived: "Archived",
};

export function draftFromCampaign(campaign: AdminCampaignDetail): CampaignDraftInput {
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

export function toIso(local: string) {
  if (!local) return new Date().toISOString();
  return new Date(local).toISOString();
}

export function formatWindow(start: string, end: string, timezone: string) {
  const opts: Intl.DateTimeFormatOptions = {
    dateStyle: "medium",
    timeStyle: "short",
  };
  return `${new Date(start).toLocaleString(undefined, opts)} → ${new Date(end).toLocaleString(undefined, opts)} (${timezone})`;
}