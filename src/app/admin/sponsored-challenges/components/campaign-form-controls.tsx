"use client";
import { type ReactNode, useId } from "react";
import {
  type FieldOrigin,
} from "@/lib/sponsored-challenge-builder";
import {
  isArchivedShownAsLive,
  type CampaignStatus,
} from "@/lib/sponsored-challenges-admin";
import {
  STATUS_LABEL,
} from "../campaign-admin-shared";

export const inputClass =
  "w-full rounded-xl border border-line-300 bg-canvas-950 px-3 py-2 text-sm text-white outline-none focus:border-primary-300 disabled:opacity-60";
export const ghostButton =
  "rounded-xl border border-line-300 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50";

export const FIELD_HELP: Record<string, string> = {
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

export const REQUIRED_FIELDS = new Set([
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

export const RECOMMENDED_FIELDS = new Set([
  "Presenter / sponsor display",
  "Google Place ID",
  "Venue country code",
  "Discovery radius (m)",
  "Minimum capture grade",
]);

export function InfoTip({ label, help }: { label: string; help: string }) {
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

export function FilterChip({
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

export function StatusBadge({ status }: { status: CampaignStatus }) {
  const archived = isArchivedShownAsLive(status);
  return (
    <span
      className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[.12em] ${archived ? "border-rose-400/40 text-rose-100" : status === "live" ? "border-primary-300 text-primary-100" : "border-line-300 text-ink-300"}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

export function FieldGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 md:grid-cols-2">{children}</div>;
}

export function Field({
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

export function Block({
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

export function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-2xl border border-line-300 bg-canvas-950/70 p-4">
      <p className="font-display text-2xl text-white">{value}</p>
      <p className="mt-1 text-xs text-ink-500">{label}</p>
    </div>
  );
}
