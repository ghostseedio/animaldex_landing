"use client";

import type { ReadinessResult, ReadinessCheck, ReadinessSeverity } from "@/lib/sponsored-challenge-readiness";

type StepKey = "basics" | "targeting" | "venue" | "rewards" | "review";

type StepCard = {
  key: StepKey;
  title: string;
  summary: string;
  checks: string[];
};

const STEP_CARDS: StepCard[] = [
  {
    key: "basics",
    title: "1. Basics",
    summary: "Name, timing, objective, and copy",
    checks: ["title", "slug", "summary", "description", "dates", "objective", "target", "timezone"],
  },
  {
    key: "targeting",
    title: "2. Targeting",
    summary: "Discovery geography and sponsor setup",
    checks: ["geo_authority", "geo_discovery", "sponsor"],
  },
  {
    key: "venue",
    title: "3. Venue",
    summary: "Only needed for venue-backed campaigns",
    checks: ["venue_name", "venue_coords", "venue_radius", "venue_live", "venue_imports"],
  },
  {
    key: "rewards",
    title: "4. Rewards",
    summary: "Achievement and optional cash funding",
    checks: ["reward", "achievement", "cash_funding", "cash_reward_terms"],
  },
  {
    key: "review",
    title: "5. Review",
    summary: "Rules history and publish readiness",
    checks: ["rules", "rules_history", "apple_disclaimer", "current_version"],
  },
];

export function CampaignReadinessPanel({
  result,
  compact = false,
}: {
  result: ReadinessResult;
  compact?: boolean;
}) {
  const checkMap = new Map(result.checks.map((check) => [check.id, check]));
  const primaryBlocking = result.blocking[0];

  return (
    <section className="space-y-4 rounded-2xl border border-line-300 bg-canvas-950/40 p-4">
      {!compact ? <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-ink-500">
            Campaign readiness
          </p>
          <h3 className="mt-1 font-display text-2xl text-white">
            {result.passed} / {result.total} checks passed
          </h3>
        </div>
        <span
          className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[.12em] ${
            result.ready
              ? "border-primary-300 text-primary-100"
              : "border-rose-400/40 text-rose-100"
          }`}
        >
          {result.ready ? "Ready" : "Not ready"}
        </span>
      </div> : null}

      {primaryBlocking ? (
        <p className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
          Next fix: {primaryBlocking.label}
          {primaryBlocking.detail ? ` · ${primaryBlocking.detail}` : ""}
        </p>
      ) : (
        <p className="rounded-2xl border border-primary-400/20 bg-primary-500/10 px-3 py-2 text-sm text-primary-100">
          Everything required for draft save is in place.
        </p>
      )}

      <div className="grid gap-3 xl:grid-cols-2">
        {STEP_CARDS.map((step) => {
          const stepChecks = step.checks
            .map((id) => checkMap.get(id))
            .filter(Boolean) as ReadinessCheck[];
          const stepPassed = stepChecks.filter((check) => check.severity === "ready").length;
          const stepBlocked = stepChecks.some((check) => check.severity === "blocking");
          const stepWarnings = stepChecks.some((check) => check.severity === "warning");
          return (
            <article
              key={step.key}
              className={`rounded-2xl border p-3 ${
                stepBlocked
                  ? "border-rose-400/30 bg-rose-500/[.04]"
                  : stepWarnings
                    ? "border-amber-400/30 bg-amber-500/[.04]"
                    : "border-primary-400/20 bg-primary-500/[.04]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black uppercase tracking-[.12em] text-white">
                    {step.title}
                  </p>
                  <p className="mt-1 text-xs text-ink-400">{step.summary}</p>
                </div>
                <StepBadge severity={stepBlocked ? "blocking" : stepWarnings ? "warning" : "ready"} />
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-ink-300">
                <span className="font-black text-white">{stepPassed} / {stepChecks.length}</span>
                <span>done</span>
              </div>
              <ul className="mt-3 space-y-2">
                {stepChecks.map((check) => (
                  <li key={check.id} className="flex items-start justify-between gap-3 text-sm">
                    <div>
                      <p className="text-ink-100">{check.label}</p>
                      {check.detail ? (
                        <p className="mt-0.5 text-xs text-ink-400">{check.detail}</p>
                      ) : null}
                    </div>
                    <StepBadge severity={check.severity} />
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>

      <p className="text-[11px] text-ink-500">
        These checks are a draft guide only. Save, submit, and approval still use backend validation.
      </p>
    </section>
  );
}

function StepBadge({ severity }: { severity: ReadinessSeverity }) {
  const className =
    severity === "ready"
      ? "border-primary-300/50 text-primary-100"
      : severity === "warning"
        ? "border-amber-400/40 text-amber-100"
        : "border-rose-400/40 text-rose-100";
  const label = severity === "ready" ? "Done" : severity === "warning" ? "Watch" : "Fix";
  return (
    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-[.12em] ${className}`}>
      {label}
    </span>
  );
}
