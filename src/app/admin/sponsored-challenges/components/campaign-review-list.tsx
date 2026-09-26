"use client";
import {
  NON_VENUE_COUNTRY_COPY,
  authorshipLabel,
  objectiveLabel,
  type AdminCampaignDetail,
} from "@/lib/sponsored-challenges-admin";
import {
  formatWindow,
} from "../campaign-admin-shared";

export function ReviewList({
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
