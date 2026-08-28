"use client";

import { ReactNode } from "react";
import { CampaignReadinessPanel } from "@/app/admin/sponsored-challenges/campaign-readiness-panel";
import { CampaignPreview } from "@/app/admin/sponsored-challenges/campaign-preview";
import {
  APPLE_DISCLAIMER,
  DISCOVERY_GEOGRAPHY_COPY,
  NON_VENUE_COUNTRY_COPY,
  RULES_HISTORY_COPY,
  VENUE_SECURITY_COPY,
  canReviseRules,
  type AdminCampaignDetail,
  type CampaignDraftInput,
  type CampaignStatus,
} from "@/lib/sponsored-challenges-admin";
import { GENERATED_RULES_NOTICE } from "@/lib/sponsored-challenge-builder";
import type { ReadinessResult } from "@/lib/sponsored-challenge-readiness";
import { formatEarningsMinor } from "@/lib/earnings";

export function CampaignBasicsStep(props: {
  editable: boolean;
  readiness: ReadinessResult;
  inputClass: string;
  ghostButton: string;
  draft: CampaignDraftInput;
  origins: Record<string, "auto" | "manual">;
  organizations: Array<{ id: string; displayName: string }>;
  timezoneOptions: string[];
  hasVenue: boolean;
  onUpdateDraft: <K extends keyof CampaignDraftInput>(key: K, value: CampaignDraftInput[K]) => void;
  onRegenerate: (fields: readonly string[] | "all") => void;
  onSaveDraft: () => void;
  onOrgName: (value: string) => void;
  onOrgSlug: (value: string) => void;
  orgName: string;
  orgSlug: string;
  onOrgCreate: () => void;
  venueWarnings?: { imports?: string; liveOnly?: string };
}) {
  const { readiness } = props;
  return (
    <>
      <CampaignReadinessPanel result={readiness} />
      <div className="flex flex-wrap gap-2">
        <button type="button" className={props.ghostButton} onClick={() => props.onRegenerate("all")}>Use generated defaults</button>
        <button type="button" className={props.ghostButton} onClick={() => props.onRegenerate(["slug"])}>Reset slug</button>
      </div>
      <FieldGrid>
        <Field label="Title" origin={props.origins.title}>
          <input className={props.inputClass} value={props.draft.title} onChange={(e) => props.onUpdateDraft("title", e.target.value)} />
        </Field>
        <Field label="Slug" origin={props.origins.slug}>
          <input className={props.inputClass} value={props.draft.slug} onChange={(e) => props.onUpdateDraft("slug", e.target.value)} />
        </Field>
      </FieldGrid>
      <p className="text-xs text-amber-100">
        Title is ready when filled. The remaining blocker is usually the achievement reward.
      </p>
    </>
  );
}

function FieldGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 md:grid-cols-2">{children}</div>;
}

function Field({
  label,
  children,
  origin,
}: {
  label: string;
  children: ReactNode;
  origin?: "auto" | "manual";
}) {
  return (
    <div className="block space-y-1.5">
      <span className="text-[11px] font-bold uppercase tracking-[.12em] text-ink-500">{label}</span>
      {origin === "auto" ? <span className="ml-2 rounded-full border border-primary-400/30 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[.12em] text-primary-100">Auto</span> : null}
      {children}
    </div>
  );
}
