"use client";

import { FormEvent, useState } from "react";
import {
  generatedAdSpendTarget,
  splitMonthlyTargetsByCalendarWeeks,
  type GrowthTargets,
} from "@/lib/growth-command-center";
import {
  type GrowthPlan,
} from "./types";
import {
  growthMeta,
  defaultJobs,
  targetFields,
  monthLabel,
  shortDate,
  friendlyGrowthError,
  defaultTargetsForMonth,
  actionPlansFromText,
} from "./format";

export function PlanForm({
  month,
  source,
  generatedUsers,
  activeDay,
  onCancel,
  onSaved,
}: {
  month: string;
  source?: GrowthPlan | null;
  generatedUsers?: number | null;
  activeDay?: number;
  onCancel?: () => void;
  onSaved: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overrideUsers, setOverrideUsers] = useState(
    source?.usersTargetSource === "override",
  );
  const [overrideAdSpend, setOverrideAdSpend] = useState(
    source?.adSpendOverride === true,
  );
  const [adSpendCurrency, setAdSpendCurrency] = useState(
    source?.adSpendCurrency ?? "IDR",
  );
  const defaults = defaultTargetsForMonth(month, source);
  const generated = generatedUsers ?? source?.generatedUsers ?? defaults.users;
  const editingWeek =
    source?.weeklyTargets.find(
      (week) =>
        (activeDay ?? 1) >= week.startDay &&
        (activeDay ?? 1) <= week.endDay,
    ) ?? source?.weeklyTargets[0];
  const editingWeekPlan = source?.weeklyActionPlans.find(
    (plan) =>
      editingWeek &&
      (plan.startDay === editingWeek.startDay ||
        (plan.startDay <= editingWeek.endDay &&
          plan.endDay >= editingWeek.startDay)),
  );
  const editingJobItems = editingWeekPlan?.items?.length
    ? editingWeekPlan.items
    : source?.weeklyActionPlans.length
      ? []
      : defaultJobs;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const submittedAdSpendCurrency = String(
      form.get("adSpendCurrency") || source?.adSpendCurrency || "IDR",
    ).toUpperCase();
    const targets = Object.fromEntries(
      targetFields.map((key) => [key, Math.max(0, Number(form.get(key) ?? 0))]),
    ) as GrowthTargets;
    if (!overrideUsers) targets.users = generated;
    if (!overrideAdSpend) {
      targets.adSpend = generatedAdSpendTarget(
        targets.users,
        submittedAdSpendCurrency,
      );
    }
    const weeklyTargets = splitMonthlyTargetsByCalendarWeeks(month, targets);
    const weeklyActionPlans = actionPlansFromText(
      month,
      String(form.get("jobs") ?? ""),
      source?.weeklyActionPlans,
      activeDay,
    );
    try {
      setSaving(true);
      setError(null);
      const response = await fetch("/api/admin/growth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save-plan",
          month,
          targets: {
            ...targets,
            adSpendCurrency: submittedAdSpendCurrency,
            adSpendOverride: overrideAdSpend,
            usersOverride: overrideUsers,
          },
          weeklyTargets,
          weeklyActionPlans,
        }),
      });
      const body = await response.json();
      if (!response.ok || !body.ok)
        throw new Error(body.error || "Unable to save targets");
      await onSaved();
      onCancel?.();
    } catch (caught) {
      setError(
        friendlyGrowthError(
          caught instanceof Error ? caught.message : "Unable to save targets",
        ),
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <form
      onSubmit={submit}
      className="rounded-xl border border-line-300 bg-canvas-900 p-4"
    >
      <h3 className="font-display text-2xl text-white">
        Growth targets — {monthLabel(month)}
      </h3>
      <p className="mt-1 text-sm text-ink-400">
        These are targets, not actuals. Update today records what actually
        happened.
      </p>
      <label className="mt-4 flex items-center gap-2 text-sm text-ink-200">
        <input
          type="checkbox"
          checked={overrideUsers}
          onChange={(event) => setOverrideUsers(event.target.checked)}
        />{" "}
        Override this month’s generated user target
      </label>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {targetFields.map((key) => {
          const generatedUserField = key === "users";
          const badge =
            generatedUserField && !overrideUsers
              ? "AUTO-GENERATED"
              : key === "adSpend" && !overrideAdSpend
                ? "AUTO-GENERATED"
              : growthMeta[key].role === "Execution target"
                ? "EXECUTION TARGET"
                : "TARGET";
          if (key === "adSpend") {
            return (
              <label key={key} className="text-sm font-bold text-ink-300">
                Monthly ad budget
                <span className="ml-2 text-[10px] font-black text-primary-100">
                  {badge}
                </span>
                <div className="mt-1 grid grid-cols-[5.5rem_1fr] gap-2">
                  <select
                    name="adSpendCurrency"
                    value={adSpendCurrency}
                    onChange={(event) => setAdSpendCurrency(event.target.value)}
                    className="rounded-lg border border-line-300 bg-surface-900 px-2 py-2 text-white outline-none focus:border-primary-300"
                  >
                    <option value="IDR">IDR</option>
                    <option value="GBP">GBP</option>
                    <option value="USD">USD</option>
                  </select>
                  <input
                    key={`${adSpendCurrency}-${overrideAdSpend}`}
                    name={key}
                    type="number"
                    min="0"
                    step="0.01"
                    disabled={!overrideAdSpend}
                    defaultValue={
                      overrideAdSpend
                        ? defaults[key]
                        : generatedAdSpendTarget(
                            overrideUsers ? defaults.users : generated,
                            adSpendCurrency,
                          )
                    }
                    className="rounded-lg border border-line-300 bg-surface-900 px-3 py-2 text-white outline-none focus:border-primary-300"
                  />
                </div>
                <span className="mt-1 flex items-center gap-2 text-xs font-normal text-ink-400">
                  <input
                    type="checkbox"
                    checked={overrideAdSpend}
                    onChange={(event) =>
                      setOverrideAdSpend(event.target.checked)
                    }
                  />
                  Override autogenerated acquisition budget
                </span>
              </label>
            );
          }
          return (
            <label key={key} className="text-sm font-bold text-ink-300">
              {growthMeta[key].label}
              <span className="ml-2 text-[10px] font-black text-primary-100">
                {badge}
              </span>
              <input
                name={key}
                type="number"
                min="0"
                step="1"
                defaultValue={
                  generatedUserField && !overrideUsers
                    ? generated
                    : defaults[key]
                }
                readOnly={generatedUserField && !overrideUsers}
                className="mt-1 w-full rounded-lg border border-line-300 bg-surface-900 px-3 py-2 text-white outline-none focus:border-primary-300 read-only:opacity-70"
              />
              {generatedUserField ? (
                <span className="mt-1 block text-[11px] text-ink-500">
                  {overrideUsers
                    ? "Manual override for this month only."
                    : "Required for the long-term user goal. Not invented from TikTok or ads."}
                </span>
              ) : null}
            </label>
          );
        })}
      </div>
      <div className="mt-4 rounded-lg border border-line-300 bg-surface-900 p-3">
        <p className="text-sm font-black text-white">Weekly targets</p>
        <p className="mt-1 text-xs text-ink-400">
          Automatically split from the monthly targets. Input targets stay
          hypotheses until enough daily history exists to estimate conversion.
        </p>
      </div>
      <label className="mt-4 block text-sm font-bold text-ink-300">
        This week’s jobs
        {editingWeek
          ? ` · ${shortDate(month, editingWeek.startDay)}–${shortDate(month, editingWeek.endDay)}`
          : ""}
        <textarea
          name="jobs"
          rows={5}
          defaultValue={editingJobItems.join("\n")}
          className="mt-1 w-full rounded-lg border border-line-300 bg-surface-900 px-3 py-2 text-white outline-none focus:border-primary-300"
        />
      </label>
      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
      <div className="mt-5 flex gap-2">
        <button
          disabled={saving}
          className="rounded-lg bg-primary-400 px-4 py-2 text-sm font-black text-canvas-950"
        >
          {saving ? "Saving..." : `Save ${monthLabel(month)} targets`}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-line-300 px-4 py-2 text-sm font-black text-white"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}

