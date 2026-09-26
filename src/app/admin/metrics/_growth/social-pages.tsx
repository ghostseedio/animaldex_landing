"use client";

import { useEffect, useState } from "react";
import {
  type GrowthData,
} from "./types";
import {
  format,
} from "./format";

export type SocialPageDraft = {
  platform: string;
  pageName: string;
  description: string;
  active: boolean;
  notes: string;
};

export function SocialPagesPanel({
  pages,
  history,
  onSaved,
  ideaCount,
}: {
  pages: NonNullable<GrowthData["socialPages"]>;
  history: NonNullable<GrowthData["socialIdeaHistory"]>;
  onSaved: () => Promise<void>;
  ideaCount: number;
}) {
  const [drafts, setDrafts] = useState<SocialPageDraft[]>(
    pages.length
      ? pages.map((page) => ({
          platform: page.platform,
          pageName: page.page_name,
          description: page.description,
          active: page.active,
          notes: page.notes,
        }))
      : [
          {
            platform: "tiktok",
            pageName: "",
            description: "",
            active: true,
            notes: "",
          },
        ],
  );
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [error, setError] = useState("");
  const [editingPages, setEditingPages] = useState(false);
  const [viewDrafts, setViewDrafts] = useState<Record<string, string>>({});
  const [manualIdeaDraft, setManualIdeaDraft] = useState({
    pageName: "",
    platform: "",
    title: "",
    hook: "",
    lengthSeconds: "",
    tips: "",
    projectedViews24h: "",
    actualViews24h: "",
  });
  const suggestions = history.filter((item) => item.status !== "completed");
  const completedIdeas = history
    .filter((item) => item.status === "completed")
    .slice(0, 20);

  useEffect(() => {
    setDrafts(
      pages.length
        ? pages.map((page) => ({
            platform: page.platform,
            pageName: page.page_name,
            description: page.description,
            active: page.active,
            notes: page.notes,
          }))
        : [
            {
              platform: "tiktok",
              pageName: "",
              description: "",
              active: true,
              notes: "",
            },
          ],
    );
  }, [pages]);

  async function savePages() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/admin/growth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save-social-pages", pages: drafts }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.ok) throw new Error(body.error || "Unable to save pages");
      await onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save pages");
    } finally {
      setSaving(false);
    }
  }

  async function generateIdeas() {
    setGenerating(true);
    setError("");
    try {
      const response = await fetch("/api/admin/growth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate-social-ideas",
          totalIdeas: ideaCount,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.ok) throw new Error(body.error || "Unable to generate ideas");
      await onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to generate ideas");
    } finally {
      setGenerating(false);
    }
  }

  async function backfillProjections() {
    setBackfilling(true);
    setError("");
    try {
      const response = await fetch("/api/admin/growth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "backfill-social-idea-projections",
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.ok) {
        throw new Error(body.error || "Unable to backfill projections");
      }
      await onSaved();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to backfill projections",
      );
    } finally {
      setBackfilling(false);
    }
  }

  async function markComplete(idea: {
    page_name: string;
    title: string;
    idea_date: string;
  }) {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/admin/growth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "mark-social-idea-complete",
          date: idea.idea_date,
          pageName: idea.page_name,
          title: idea.title,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.ok) throw new Error(body.error || "Unable to mark complete");
      await onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to mark complete");
    } finally {
      setSaving(false);
    }
  }

  async function recordViews(idea: { id: string; actual_views_24h: number | null }) {
    const rawViews =
      viewDrafts[idea.id] ??
      (idea.actual_views_24h == null ? "" : String(idea.actual_views_24h));
    if (rawViews.trim() === "") {
      setError("Enter the views recorded 24 hours after publishing");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/admin/growth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "record-social-idea-views",
          ideaId: idea.id,
          actualViews24h: Number(rawViews),
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.ok)
        throw new Error(body.error || "Unable to save 24-hour views");
      setViewDrafts((current) => {
        const next = { ...current };
        delete next[idea.id];
        return next;
      });
      await onSaved();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to save 24-hour views",
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveManualIdea() {
    const pageName = manualIdeaDraft.pageName.trim();
    const platform = manualIdeaDraft.platform.trim();
    const title = manualIdeaDraft.title.trim();
    if (!pageName || !platform || !title) {
      setError("Page name, platform, and title are required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/admin/growth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save-custom-social-idea",
          customIdea: {
            ...manualIdeaDraft,
            pageName,
            platform,
            title,
            lengthSeconds: Number(manualIdeaDraft.lengthSeconds || 0),
            projectedViews24h: Number(manualIdeaDraft.projectedViews24h || 0),
            actualViews24h:
              manualIdeaDraft.actualViews24h.trim() === ""
                ? null
                : Number(manualIdeaDraft.actualViews24h),
            status:
              manualIdeaDraft.actualViews24h.trim() === ""
                ? "suggested"
                : "completed",
            ideaDate: new Date().toISOString().slice(0, 10),
          },
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.ok)
        throw new Error(body.error || "Unable to save manual idea");
      setManualIdeaDraft({
        pageName: "",
        platform: "",
        title: "",
        hook: "",
        lengthSeconds: "",
        tips: "",
        projectedViews24h: "",
        actualViews24h: "",
      });
      await onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save manual idea");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-line-300 bg-surface-900 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-2xl text-white">Social pages</h3>
          <p className="text-xs text-ink-500">
            Store your pages, descriptions, and daily posting targets here. The
            daily generation count follows the current short-video target.
          </p>
          <p className="mt-1 text-xs font-bold text-primary-100">
            Today&apos;s idea count: {ideaCount}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setEditingPages((current) => !current)}
            className="rounded-lg border border-line-300 px-4 py-2 text-sm font-black text-white"
          >
            {editingPages ? "Lock pages" : "Edit pages"}
          </button>
          <button
            onClick={() =>
              setDrafts((current) => [
                ...current,
                {
                  platform: "tiktok",
                  pageName: "",
                  description: "",
                  active: true,
                  notes: "",
                },
              ])
            }
            className="rounded-lg border border-line-300 px-4 py-2 text-sm font-black text-white"
          >
            Add page
          </button>
          <button
            onClick={savePages}
            disabled={saving}
            className="rounded-lg bg-primary-400 px-4 py-2 text-sm font-black text-canvas-950"
          >
            {saving ? "Saving..." : "Save pages"}
          </button>
          <button
            onClick={generateIdeas}
            disabled={generating}
            className="rounded-lg border border-line-300 px-4 py-2 text-sm font-black text-white"
          >
            {generating ? "Generating..." : "Generate ideas"}
          </button>
          <button
            onClick={backfillProjections}
            disabled={backfilling || !suggestions.length}
            className="rounded-lg border border-line-300 px-4 py-2 text-sm font-black text-white disabled:opacity-50"
          >
            {backfilling ? "Backfilling..." : "Backfill projections"}
          </button>
        </div>
      </div>
      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
      <div className="mt-4 space-y-3">
        {drafts.map((page, index) => (
          <div
            key={`social-page-${index}`}
            className="grid gap-2 rounded-lg border border-line-300 bg-canvas-900 p-3 md:grid-cols-[9rem_1fr_5rem_1fr]"
          >
            <input
              value={page.platform}
              readOnly={!editingPages}
              onChange={(event) => {
                const next = [...drafts];
                next[index] = {...page, platform: event.target.value};
                setDrafts(next);
              }}
              placeholder="platforms"
              className="rounded-lg border border-line-300 bg-surface-900 px-2 py-2 text-white outline-none read-only:opacity-60"
            />
            <input
              value={page.pageName}
              readOnly={!editingPages}
              onChange={(event) => {
                const next = [...drafts];
                next[index] = {...page, pageName: event.target.value};
                setDrafts(next);
              }}
              placeholder="page name"
              className="rounded-lg border border-line-300 bg-surface-900 px-2 py-2 text-white outline-none read-only:opacity-60"
            />
            <label className="flex items-center gap-2 text-xs font-bold text-ink-300">
              <input
                type="checkbox"
                checked={page.active}
                disabled={!editingPages}
                onChange={(event) => {
                  const next = [...drafts];
                  next[index] = {...page, active: event.target.checked};
                  setDrafts(next);
                }}
              />
              Active
            </label>
            <button
              type="button"
              onClick={() =>
                setDrafts((current) => current.filter((_, draftIndex) => draftIndex !== index))
              }
              disabled={drafts.length <= 1}
              className="text-left text-xs font-black text-red-300 disabled:opacity-40"
            >
              Remove
            </button>
            <textarea
              value={page.description}
              readOnly={!editingPages}
              onChange={(event) => {
                const next = [...drafts];
                next[index] = {...page, description: event.target.value};
                setDrafts(next);
              }}
              placeholder="description and audience"
              className="min-h-20 rounded-lg border border-line-300 bg-surface-900 px-2 py-2 text-white outline-none md:col-span-4 read-only:opacity-60"
            />
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-ink-500">
        Prior generated titles loaded for duplicate rejection: {history.length}
      </p>
      <div className="mt-4 space-y-2">
        <h4 className="text-sm font-black uppercase tracking-[.12em] text-primary-100">
          Suggestions
        </h4>
        {suggestions.length ? (
          suggestions.map((idea) => (
            <div
              key={idea.id}
              className="grid gap-2 rounded-lg border border-line-300 bg-canvas-900 p-3 md:grid-cols-[1fr_auto]"
            >
              <div>
                <p className="font-bold text-white">{idea.page_name} · {idea.title}</p>
                <p className="text-xs text-ink-400">{idea.platform} · {idea.idea_date} · {idea.length_seconds}s</p>
                <p className="mt-1 text-xs text-ink-300">{idea.hook}</p>
                <p className="mt-1 text-xs text-ink-500">{idea.tips}</p>
                <p className="mt-2 text-xs font-black text-primary-100">
                  Projected 24h views: ~{format(idea.projected_views_24h)} · {idea.projection_confidence} confidence
                </p>
                {idea.projection_reason ? (
                  <p className="mt-1 text-[11px] text-ink-500">
                    {idea.projection_reason}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => markComplete(idea)}
                className="h-fit rounded-lg border border-line-300 px-3 py-2 text-xs font-black text-white"
              >
                Mark complete
              </button>
            </div>
          ))
        ) : (
          <p className="text-sm text-ink-400">No pending suggestions yet.</p>
        )}
      </div>
      <div className="mt-6 space-y-3 rounded-lg border border-line-300 bg-canvas-900 p-3">
        <h4 className="text-sm font-black uppercase tracking-[.12em] text-primary-100">
          Add your own post
        </h4>
        <div className="grid gap-2 md:grid-cols-2">
          <input
            value={manualIdeaDraft.platform}
            onChange={(event) =>
              setManualIdeaDraft((current) => ({
                ...current,
                platform: event.target.value,
              }))
            }
            placeholder="platform"
            className="rounded-lg border border-line-300 bg-surface-900 px-3 py-2 text-sm text-white outline-none"
          />
          <input
            value={manualIdeaDraft.pageName}
            onChange={(event) =>
              setManualIdeaDraft((current) => ({
                ...current,
                pageName: event.target.value,
              }))
            }
            placeholder="page / account"
            className="rounded-lg border border-line-300 bg-surface-900 px-3 py-2 text-sm text-white outline-none"
          />
          <input
            value={manualIdeaDraft.title}
            onChange={(event) =>
              setManualIdeaDraft((current) => ({
                ...current,
                title: event.target.value,
              }))
            }
            placeholder="title"
            className="rounded-lg border border-line-300 bg-surface-900 px-3 py-2 text-sm text-white outline-none md:col-span-2"
          />
          <input
            value={manualIdeaDraft.hook}
            onChange={(event) =>
              setManualIdeaDraft((current) => ({
                ...current,
                hook: event.target.value,
              }))
            }
            placeholder="hook"
            className="rounded-lg border border-line-300 bg-surface-900 px-3 py-2 text-sm text-white outline-none md:col-span-2"
          />
          <input
            type="number"
            min="0"
            step="1"
            value={manualIdeaDraft.lengthSeconds}
            onChange={(event) =>
              setManualIdeaDraft((current) => ({
                ...current,
                lengthSeconds: event.target.value,
              }))
            }
            placeholder="duration seconds"
            className="rounded-lg border border-line-300 bg-surface-900 px-3 py-2 text-sm text-white outline-none"
          />
          <input
            type="number"
            min="0"
            step="1"
            value={manualIdeaDraft.projectedViews24h}
            onChange={(event) =>
              setManualIdeaDraft((current) => ({
                ...current,
                projectedViews24h: event.target.value,
              }))
            }
            placeholder="projected 24h views"
            className="rounded-lg border border-line-300 bg-surface-900 px-3 py-2 text-sm text-white outline-none"
          />
          <input
            type="number"
            min="0"
            step="1"
            value={manualIdeaDraft.actualViews24h}
            onChange={(event) =>
              setManualIdeaDraft((current) => ({
                ...current,
                actualViews24h: event.target.value,
              }))
            }
            placeholder="actual 24h views"
            className="rounded-lg border border-line-300 bg-surface-900 px-3 py-2 text-sm text-white outline-none"
          />
          <input
            value={manualIdeaDraft.tips}
            onChange={(event) =>
              setManualIdeaDraft((current) => ({
                ...current,
                tips: event.target.value,
              }))
            }
            placeholder="tips"
            className="rounded-lg border border-line-300 bg-surface-900 px-3 py-2 text-sm text-white outline-none md:col-span-2"
          />
        </div>
        <button
          type="button"
          onClick={saveManualIdea}
          disabled={saving}
          className="rounded-lg bg-primary-400 px-4 py-2 text-sm font-black text-canvas-950"
        >
          Save manual post
        </button>
      </div>
      <div className="mt-6 space-y-2">
        <h4 className="text-sm font-black uppercase tracking-[.12em] text-primary-100">
          Published feedback
        </h4>
        <p className="text-xs text-ink-500">
          Enter combined views 24 hours after publishing. Future ideas and
          projections use this measured history for the same page and platform.
        </p>
        {completedIdeas.length ? (
          completedIdeas.map((idea) => {
            const actualValue =
              viewDrafts[idea.id] ??
              (idea.actual_views_24h == null
                ? ""
                : String(idea.actual_views_24h));
            const projectionRatio =
              idea.actual_views_24h != null && idea.projected_views_24h > 0
                ? idea.actual_views_24h / idea.projected_views_24h
                : null;
            return (
              <div
                key={idea.id}
                className="rounded-lg border border-line-300 bg-canvas-900 p-3"
              >
                <p className="font-bold text-white">
                  {idea.page_name} · {idea.title}
                </p>
                <p className="mt-1 text-xs text-ink-400">
                  Projected ~{format(idea.projected_views_24h)} views in 24h
                  {projectionRatio == null
                    ? ""
                    : ` · actual was ${projectionRatio.toFixed(1)}× projection`}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={actualValue}
                    onChange={(event) =>
                      setViewDrafts((current) => ({
                        ...current,
                        [idea.id]: event.target.value,
                      }))
                    }
                    placeholder="actual views after 24h"
                    className="min-w-56 flex-1 rounded-lg border border-line-300 bg-surface-900 px-3 py-2 text-sm text-white outline-none focus:border-primary-300"
                  />
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => recordViews(idea)}
                    className="rounded-lg border border-line-300 px-3 py-2 text-xs font-black text-white disabled:opacity-60"
                  >
                    {idea.actual_views_24h == null
                      ? "Save 24h views"
                      : "Update 24h views"}
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-sm text-ink-400">
            Mark a suggestion complete to start measuring it.
          </p>
        )}
      </div>
    </section>
  );
}

