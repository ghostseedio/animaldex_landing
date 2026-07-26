"use client";

import {useEffect, useId, useState} from "react";
import type {CaptureGradeBreakdown} from "@/lib/capture-grade";

function gradeTint(grade: number) {
  if (grade >= 9) return {chip: "bg-orange-400/90 text-black ring-orange-200/40", bar: "bg-orange-400", soft: "border-orange-400/35"};
  if (grade >= 7) return {chip: "bg-cyan-400/90 text-black ring-cyan-200/40", bar: "bg-cyan-400", soft: "border-cyan-400/35"};
  if (grade >= 5) return {chip: "bg-primary-400 text-black ring-white/20", bar: "bg-primary-400", soft: "border-primary-400/35"};
  if (grade >= 3) return {chip: "bg-white/80 text-black ring-white/30", bar: "bg-white/80", soft: "border-white/25"};
  return {chip: "bg-red-500/90 text-white ring-red-300/40", bar: "bg-red-500", soft: "border-red-400/35"};
}

function percentText(value: number) {
  return `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`;
}

function signedPercentText(value: number) {
  const sign = value >= 0 ? "+" : "-";
  return `${sign}${Math.round(Math.abs(value) * 100)}%`;
}

function weightText(value: number) {
  return `${Math.round(value * 100)}% weight`;
}

function CaptureGradeExplanationSheet({
  breakdown,
  onClose,
}: {
  breakdown: CaptureGradeBreakdown;
  onClose: () => void;
}) {
  const titleId = useId();
  const tint = gradeTint(breakdown.grade);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 md:items-center md:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button type="button" aria-label="Close grade details" className="absolute inset-0" onClick={onClose} />
      <div className="relative z-10 max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-[22px] border border-white/10 bg-[#101010] p-5 shadow-2xl md:rounded-[22px]">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 id={titleId} className="text-lg font-bold text-white">
            Grade {breakdown.grade}
          </h2>
          <button type="button" onClick={onClose} className="text-sm font-semibold text-primary-200">
            Close
          </button>
        </div>

        <div className="space-y-5">
          <div className={`rounded-2xl border bg-black/40 p-4 ${tint.soft}`}>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-5xl font-black text-white">{breakdown.grade}</span>
              <span className="text-lg font-bold text-white/45">/10</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-white/60">{breakdown.summary}</p>
          </div>

          {breakdown.checklist.length ? (
            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-bold text-white">Perfect 10 checklist</h3>
                <p className="mt-1 text-xs leading-5 text-white/45">
                  Top grades prioritize ID confidence, natural habitat, sharp focus, healthy appearance, centered framing, full body visibility, and an unobstructed view.
                </p>
              </div>
              <div className="space-y-2">
                {breakdown.checklist.map((item) => (
                  <div key={item.id} className="rounded-xl bg-black/30 p-3">
                    <div className="flex items-center gap-2">
                      <span className={`grid h-5 w-5 place-items-center rounded-full text-[0.65rem] font-black ${item.met ? "bg-primary-400 text-black" : "bg-red-500/80 text-white"}`}>
                        {item.met ? "✓" : "×"}
                      </span>
                      <p className="text-sm font-semibold text-white">{item.title}</p>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-white/50">{item.detail}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="space-y-3">
            <h3 className="text-sm font-bold text-white">Factors</h3>
            <div className="space-y-2">
              {breakdown.factors.map((factor) => (
                <div key={factor.id} className="rounded-xl bg-white/[0.04] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white">{factor.title}</p>
                    <p className="shrink-0 text-[0.68rem] font-bold text-white/40">
                      {percentText(factor.score)} · {weightText(factor.weight)}
                    </p>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                    <div className={`h-full rounded-full ${tint.bar}`} style={{width: `${Math.min(100, Math.max(0, factor.score * 100))}%`}} />
                  </div>
                  <p className="mt-2 text-xs leading-5 text-white/50">{factor.detail}</p>
                </div>
              ))}
            </div>
          </section>

          {breakdown.adjustments.length ? (
            <section className="space-y-3">
              <h3 className="text-sm font-bold text-white">Bonuses & Penalties</h3>
              <div className="space-y-2">
                {breakdown.adjustments.map((adjustment) => (
                  <div key={adjustment.id} className="rounded-xl bg-white/[0.04] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-black ${adjustment.value >= 0 ? "text-primary-200" : "text-orange-300"}`}>
                            {adjustment.value >= 0 ? "+" : "−"}
                          </span>
                          <p className="text-sm font-semibold text-white">{adjustment.title}</p>
                        </div>
                        <p className="mt-2 text-xs leading-5 text-white/50">{adjustment.detail}</p>
                      </div>
                      <p className="shrink-0 text-[0.68rem] font-bold text-white/40">{signedPercentText(adjustment.value)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="space-y-2">
            <h3 className="text-sm font-bold text-white">Score</h3>
            <div className="space-y-2 rounded-xl bg-white/[0.04] p-3">
              <div className="flex justify-between gap-3 text-sm">
                <span className="text-white/45">Weighted base</span>
                <span className="font-semibold text-white">{percentText(breakdown.weightedScore)}</span>
              </div>
              <div className="flex justify-between gap-3 text-sm">
                <span className="text-white/45">After bonuses / penalties</span>
                <span className="font-semibold text-white">{percentText(breakdown.adjustedScore)}</span>
              </div>
              <div className="flex justify-between gap-3 text-sm">
                <span className="text-white/45">Final grade curve</span>
                <span className="font-semibold text-white">{percentText(breakdown.contrastedScore)}</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default function CaptureGradeBadge({
  grade,
  breakdown,
  compact = false,
}: {
  grade: number;
  breakdown?: CaptureGradeBreakdown | null;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const tint = gradeTint(grade);
  const interactive = Boolean(breakdown);

  const chip = (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.68rem] font-black uppercase tracking-[0.08em] ring-1 ${tint.chip} ${compact ? "px-2 py-0.5 text-[0.62rem]" : ""}`}
    >
      <span>Grade</span>
      <span>{grade}</span>
      {interactive ? (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3 w-3 opacity-80" fill="none" stroke="currentColor" strokeWidth={2.2}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 10.5V16" strokeLinecap="round" />
          <circle cx="12" cy="7.75" r="0.9" fill="currentColor" stroke="none" />
        </svg>
      ) : null}
    </span>
  );

  return (
    <>
      {interactive ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-label={`Grade ${grade}. View grading specifics.`}
          className="shrink-0 rounded-full transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-300"
        >
          {chip}
        </button>
      ) : (
        chip
      )}
      {open && breakdown ? (
        <CaptureGradeExplanationSheet breakdown={breakdown} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}
