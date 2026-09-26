"use client";

import { FormEvent, useState } from "react";
import {
  type NorthStarGoal,
  type NorthStarTrajectory,
} from "@/lib/growth-command-center";
import {
  format,
  dateLabel,
  percentOf,
  friendlyGrowthError,
} from "./format";

export function NorthStarCard({
  goal,
  trajectory,
  totalUsers,
  onEdit,
}: {
  goal: NorthStarGoal | null | undefined;
  trajectory: NorthStarTrajectory | null | undefined;
  totalUsers: number;
  onEdit: () => void;
}) {
  if (!goal || !trajectory) {
    return (
      <div className="rounded-xl border border-line-300 bg-surface-900 p-5">
        <p className="text-xs font-black uppercase tracking-[.18em] text-primary-200">
          North Star
        </p>
        <h3 className="mt-2 font-display text-3xl text-white">
          Set a long-term user goal
        </h3>
        <p className="mt-2 text-sm text-ink-400">
          Monthly, weekly and daily user targets should come from one goal, not
          from inventing a number every month.
        </p>
        <button
          onClick={onEdit}
          className="mt-4 rounded-lg bg-primary-400 px-4 py-2 text-sm font-black text-canvas-950"
        >
          Set North Star
        </button>
      </div>
    );
  }
  const pct = percentOf(totalUsers, goal.targetUsers) ?? 0;
  return (
    <div className="rounded-xl border border-line-300 bg-surface-900 p-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <p className="text-xs font-black uppercase tracking-[.18em] text-primary-200">
            North Star
          </p>
          <h3 className="mt-2 font-display text-4xl text-white">
            {format(goal.targetUsers)} users
          </h3>
          <p className="mt-1 text-sm text-ink-300">
            by {dateLabel(goal.targetDate)}
          </p>
        </div>
        <button
          onClick={onEdit}
          className="rounded-lg border border-line-300 px-3 py-2 text-xs font-black text-white"
        >
          Edit goal
        </button>
      </div>
      <p className="mt-3 font-display text-2xl text-white">
        {format(totalUsers)} current · {pct}%
      </p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[.08]">
        <div
          className="h-full rounded-full bg-primary-400"
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <p className="mt-3 text-sm text-ink-300">
        {format(trajectory.remainingUsers)} to go ·{" "}
        {format(trajectory.remainingDays)} days · required average{" "}
        {trajectory.requiredAverage}/day
      </p>
      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-black text-primary-100">
          View calculation
        </summary>
        <p className="mt-2 text-xs text-ink-400">{trajectory.explanation}</p>
      </details>
    </div>
  );
}

export function NorthStarForm({
  source,
  onCancel,
  onSaved,
}: {
  source?: NorthStarGoal | null;
  onCancel: () => void;
  onSaved: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/admin/growth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save-north-star",
          northStar: {
            targetUsers: form.get("targetUsers"),
            targetDate: form.get("targetDate"),
            growthModel: form.get("growthModel"),
            rampPercent: form.get("rampPercent"),
          },
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.ok)
        throw new Error(body.error || "Unable to save North Star");
      await onSaved();
      onCancel();
    } catch (caught) {
      setError(
        friendlyGrowthError(
          caught instanceof Error
            ? caught.message
            : "Unable to save North Star",
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
      <h3 className="font-display text-2xl text-white">North Star goal</h3>
      <p className="mt-1 text-sm text-ink-400">
        This generates monthly user targets. It does not invent TikTok, Google
        or ad numbers.
      </p>
      <label className="mt-4 block text-sm font-bold text-ink-300">
        Total users
        <input
          name="targetUsers"
          type="number"
          min="1"
          defaultValue={source?.targetUsers ?? 10000}
          className="mt-1 w-full rounded-lg border border-line-300 bg-surface-900 px-3 py-2 text-white outline-none focus:border-primary-300"
        />
      </label>
      <label className="mt-3 block text-sm font-bold text-ink-300">
        By date
        <input
          name="targetDate"
          type="date"
          defaultValue={source?.targetDate ?? "2026-12-31"}
          className="mt-1 w-full rounded-lg border border-line-300 bg-surface-900 px-3 py-2 text-white outline-none focus:border-primary-300"
        />
      </label>
      <label className="mt-3 block text-sm font-bold text-ink-300">
        Growth model
        <select
          name="growthModel"
          defaultValue={source?.growthModel ?? "ramp"}
          className="mt-1 w-full rounded-lg border border-line-300 bg-surface-900 px-3 py-2 text-white outline-none focus:border-primary-300"
        >
          <option value="ramp">Compounding ramp</option>
          <option value="linear">Linear</option>
        </select>
      </label>
      <label className="mt-3 block text-sm font-bold text-ink-300">
        Monthly ramp %
        <input
          name="rampPercent"
          type="number"
          min="0"
          step="1"
          defaultValue={source?.rampPercent ?? 20}
          className="mt-1 w-full rounded-lg border border-line-300 bg-surface-900 px-3 py-2 text-white outline-none focus:border-primary-300"
        />
      </label>
      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
      <div className="mt-5 flex gap-2">
        <button
          disabled={saving}
          className="rounded-lg bg-primary-400 px-4 py-2 text-sm font-black text-canvas-950"
        >
          {saving ? "Saving..." : "Save goal and generate months"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-line-300 px-4 py-2 text-sm font-black text-white"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

