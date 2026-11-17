"use client";

import {useEffect, useId, useState} from "react";
import type {CaptureGradeBreakdown} from "@/lib/capture-grade";
import {CloseIconButton} from "@/components/ui/icon-buttons";

function gradeTint(grade: number) {
  if (grade >= 9) return {chip: "bg-orange-400/90 text-black ring-orange-200/40", bar: "bg-orange-400", soft: "border-orange-400/35"};
  if (grade >= 7) return {chip: "bg-cyan-400/90 text-black ring-cyan-200/40", bar: "bg-cyan-400", soft: "border-cyan-400/35"};
  if (grade >= 5) return {chip: "bg-primary-400 text-black ring-white/20", bar: "bg-primary-400", soft: "border-primary-400/35"};
  if (grade >= 3) return {chip: "bg-white/80 text-black ring-white/30", bar: "bg-white/80", soft: "border-white/25"};
  return {chip: "bg-red-500/90 text-white ring-red-300/40", bar: "bg-red-500", soft: "border-red-400/35"};
}

/**
 * What a grade is made of: the seven weighted factors of the server's grade
 * (supabase/functions/_shared/capture-grade.ts, the same on iOS and Android).
 * Static on purpose: the number on the card is the server's stored grade, so
 * this sheet explains how grades are built and never shows a total of its own.
 */
const GRADE_FACTORS: Array<{title: string; weight: number}> = [
  {title: "Identification confidence", weight: 24},
  {title: "Clarity and focus", weight: 20},
  {title: "Centering, proximity and framing", weight: 18},
  {title: "Shot quality", weight: 16},
  {title: "Body detail", weight: 8},
  {title: "The animal's condition", weight: 8},
  {title: "Habitat and setting", weight: 6},
];

export function CaptureGradeExplanationSheet({
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
      <div className="relative z-10 max-h-[92vh] w-full max-w-xl overflow-y-auto border border-white/10 bg-[#101010] p-5 shadow-2xl">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 id={titleId} className="text-lg font-bold text-white">
            Grade {breakdown.grade}
          </h2>
          <CloseIconButton onClick={onClose} />
        </div>

        <div className="space-y-5">
          <div className={`border bg-black/40 p-4 ${tint.soft}`}>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-5xl font-black text-white">{breakdown.grade}</span>
              <span className="text-lg font-bold text-white/45">/10</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-white/60">
              The grade AnimalDex gave this photo. Only the photo and its analysis count: endorsements and community star ratings never change a grade.
            </p>
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
                  <div key={item.id} className="bg-black/30 p-3">
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
            <h3 className="text-sm font-bold text-white">What a grade is made of</h3>
            <div className="space-y-2">
              {GRADE_FACTORS.map((factor) => (
                <div key={factor.title} className="bg-white/[0.04] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white">{factor.title}</p>
                    <p className="shrink-0 text-[0.68rem] font-bold text-white/40">{factor.weight}% weight</p>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                    <div className={`h-full rounded-full ${tint.bar}`} style={{width: `${factor.weight * 4}%`}} />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs leading-5 text-white/45">
              Deductions apply for a likely photo of a screen, poster or print (capped at grade 2), for heavy obstruction, and for an animal that could not be identified. A photo with no animal in it is grade 1.
            </p>
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
