"use client";

import {useEffect, useMemo, useState} from "react";
import {
    CAPTURE_GRADE_INPUTS,
    applyCaptureGradeInputs,
    gradeCaptureRow,
    type CaptureGradeEndorsements,
    type CaptureGradeInputs,
    type CaptureGradeRow
} from "@/lib/capture-grade-inputs";
import type {CaptureGradeBreakdown} from "@/lib/capture-grade";

/**
 * Fix a capture's grade by correcting the analysis it was graded from.
 *
 * The preview runs the real grading engine in the browser against the row the
 * API returned, so what the operator sees before saving is what the site will
 * show afterwards — no second implementation to drift.
 */

type Props = {
    captureId: string;
    animalName: string | null;
    imageUrl: string;
    onClose: () => void;
    onSaved: (grade: number) => void;
};

type LoadedState = {
    row: CaptureGradeRow;
    endorsements: CaptureGradeEndorsements;
    storedGrade: number | null;
    inputs: CaptureGradeInputs;
};

function gradeTone(grade: number) {
    if (grade >= 8) return "text-primary-100";
    if (grade >= 5) return "text-amber-200";
    return "text-red-200";
}

function FactorRows({breakdown}: {breakdown: CaptureGradeBreakdown | null}) {
    if (!breakdown) return <p className="text-sm text-ink-400">These inputs do not produce a grade.</p>;

    return (
        <table className="w-full text-left text-sm">
            <thead>
                <tr className="text-[11px] font-black uppercase tracking-[.14em] text-ink-500">
                    <th className="pb-2">Factor</th>
                    <th className="pb-2 text-right">Score</th>
                    <th className="pb-2 text-right">Weight</th>
                    <th className="pb-2 text-right">Contribution</th>
                </tr>
            </thead>
            <tbody>
                {breakdown.factors.map((factor) => (
                    <tr key={factor.id} className="border-t border-line-300/60">
                        <td className="py-2 pr-3 text-white">{factor.title}</td>
                        <td className="py-2 text-right tabular-nums text-ink-200">{factor.score.toFixed(2)}</td>
                        <td className="py-2 text-right tabular-nums text-ink-400">{factor.weight.toFixed(2)}</td>
                        <td className="py-2 text-right tabular-nums text-primary-100">
                            {(factor.score * factor.weight).toFixed(3)}
                        </td>
                    </tr>
                ))}
                {breakdown.adjustments.map((adjustment) => (
                    <tr key={adjustment.id} className="border-t border-line-300/60">
                        <td className="py-2 pr-3 text-ink-300">{adjustment.title}</td>
                        <td className="py-2" />
                        <td className="py-2" />
                        <td className={`py-2 text-right tabular-nums ${adjustment.value < 0 ? "text-red-200" : "text-primary-100"}`}>
                            {adjustment.value > 0 ? "+" : ""}{adjustment.value.toFixed(3)}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

export default function CaptureGradePanel({captureId, animalName, imageUrl, onClose, onSaved}: Props) {
    const [state, setState] = useState<LoadedState | null>(null);
    const [inputs, setInputs] = useState<CaptureGradeInputs>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);

        (async () => {
            try {
                const response = await fetch(`/api/admin/maintenance/capture-grade?captureId=${encodeURIComponent(captureId)}`, {cache: "no-store"});
                const payload = await response.json();
                if (cancelled) return;
                if (!response.ok || !payload.ok) throw new Error(payload.error || "Unable to load this capture's grade");
                setState({
                    row: payload.row ?? {},
                    endorsements: payload.endorsements,
                    storedGrade: payload.storedGrade ?? null,
                    inputs: payload.inputs
                });
                setInputs(payload.inputs);
            } catch (caught) {
                if (!cancelled) setError(caught instanceof Error ? caught.message : "Unable to load this capture's grade");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, [captureId]);

    // Graded in the browser with the same engine the server saves with, so the
    // number below the form is the number that will be stored.
    const preview = useMemo(() => {
        if (!state) return null;
        return gradeCaptureRow(applyCaptureGradeInputs(state.row, inputs), state.endorsements);
    }, [state, inputs]);

    const dirty = useMemo(() => {
        if (!state) return false;
        return CAPTURE_GRADE_INPUTS.some((field) => String(inputs[field.id] ?? "") !== String(state.inputs[field.id] ?? ""));
    }, [state, inputs]);

    async function save() {
        setSaving(true);
        setError(null);
        setNotice(null);
        try {
            const response = await fetch("/api/admin/maintenance/capture-grade", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({captureId, inputs})
            });
            const payload = await response.json();
            if (!response.ok || !payload.ok) throw new Error(payload.error || "Unable to save this capture's grade");
            setState((current) => current && {...current, storedGrade: payload.storedGrade, inputs: payload.inputs});
            setInputs(payload.inputs);
            setNotice(`Saved. Grade is now ${payload.storedGrade}.`);
            onSaved(payload.storedGrade);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Unable to save this capture's grade");
        } finally {
            setSaving(false);
        }
    }

    const grouped = CAPTURE_GRADE_INPUTS.reduce<Record<string, typeof CAPTURE_GRADE_INPUTS>>((groups, field) => {
        groups[field.factor] = [...(groups[field.factor] ?? []), field];
        return groups;
    }, {});
    const factorTitles = new Map((preview?.factors ?? []).map((factor) => [factor.id, factor.title]));

    return (
        <div role="dialog" aria-modal="true" aria-label={`Grade for ${animalName || captureId}`}
             className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/90 p-3 backdrop-blur-sm sm:p-8"
             onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
            <div className="w-full max-w-5xl overflow-hidden rounded-2xl border border-line-300 bg-canvas-950 shadow-2xl">
                <div className="flex items-center justify-between gap-4 border-b border-line-300 px-5 py-4">
                    <div className="min-w-0">
                        <p className="text-xs font-black uppercase tracking-[.16em] text-primary-200">Capture grade</p>
                        <h2 className="truncate font-display text-2xl text-white">{animalName || "Unidentified capture"}</h2>
                        <p className="truncate font-mono text-[11px] text-ink-500">{captureId}</p>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Close grade editor"
                            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line-300 text-xl text-white hover:border-primary-300">×</button>
                </div>

                {loading ? <p className="p-6 text-sm text-ink-400">Loading grade…</p> : (
                    <div className="grid gap-5 p-5 lg:grid-cols-[22rem_minmax(0,1fr)]">
                        <div className="space-y-4">
                            <img src={imageUrl} alt={animalName ? `${animalName} capture` : "Capture"}
                                 className="aspect-square w-full rounded-2xl border border-line-300 object-cover" />
                            <div className="rounded-2xl border border-line-300 bg-surface-900 p-4">
                                <p className="text-xs font-black uppercase tracking-[.14em] text-ink-500">Grade</p>
                                <div className="mt-1 flex items-end gap-3">
                                    <p className={`font-display text-5xl ${preview ? gradeTone(preview.grade) : "text-ink-400"}`}>
                                        {preview?.grade ?? "—"}
                                    </p>
                                    {state?.storedGrade != null && preview && state.storedGrade !== preview.grade && (
                                        <p className="pb-2 text-sm text-ink-400">was {state.storedGrade}</p>
                                    )}
                                </div>
                                <p className="mt-2 text-xs leading-5 text-ink-400">{preview?.summary}</p>
                            </div>
                            <div className="rounded-2xl border border-line-300 bg-surface-900 p-4">
                                <FactorRows breakdown={preview} />
                            </div>
                        </div>

                        <div className="space-y-4">
                            {error && <p className="rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
                            {notice && <p className="rounded-xl border border-primary-400/20 bg-primary-500/10 p-3 text-sm text-primary-100">{notice}</p>}

                            {Object.entries(grouped).map(([factor, fields]) => (
                                <section key={factor} className="rounded-2xl border border-line-300 bg-surface-900 p-4">
                                    <p className="text-xs font-black uppercase tracking-[.14em] text-primary-200">
                                        {factorTitles.get(factor) ?? factor}
                                    </p>
                                    <div className="mt-3 space-y-3">
                                        {fields.map((field) => (
                                            <label key={field.id} className="block">
                                                <span className="flex items-center justify-between gap-3 text-sm text-white">
                                                    {field.label}
                                                    {field.kind === "number" && (
                                                        <span className="tabular-nums text-ink-400">
                                                            {Number(inputs[field.id] ?? 0).toFixed(field.step < 1 ? 2 : 0)}
                                                        </span>
                                                    )}
                                                </span>
                                                {field.kind === "number" && (
                                                    <input type="range" min={field.min} max={field.max} step={field.step}
                                                           value={Number(inputs[field.id] ?? 0)}
                                                           onChange={(event) => setInputs((current) => ({...current, [field.id]: Number(event.target.value)}))}
                                                           className="mt-2 w-full accent-primary-500" />
                                                )}
                                                {field.kind === "select" && (
                                                    <select value={String(inputs[field.id] ?? "")}
                                                            onChange={(event) => setInputs((current) => ({...current, [field.id]: event.target.value}))}
                                                            className="mt-2 w-full rounded-xl border border-line-300 bg-canvas-900 px-3 py-2 text-sm text-white">
                                                        {field.options.map((option) => (
                                                            <option key={option.value} value={option.value}>{option.label}</option>
                                                        ))}
                                                    </select>
                                                )}
                                                {field.kind === "boolean" && (
                                                    <input type="checkbox" checked={Boolean(inputs[field.id])}
                                                           onChange={(event) => setInputs((current) => ({...current, [field.id]: event.target.checked}))}
                                                           className="mt-2 h-4 w-4 accent-primary-500" />
                                                )}
                                                <span className="mt-1 block text-xs leading-4 text-ink-500">{field.hint}</span>
                                            </label>
                                        ))}
                                    </div>
                                </section>
                            ))}

                            <div className="flex flex-wrap items-center gap-3">
                                <button type="button" onClick={() => void save()} disabled={!dirty || saving || !preview}
                                        className="rounded-xl bg-primary-500 px-5 py-3 text-sm font-black text-canvas-950 disabled:opacity-40">
                                    {saving ? "Saving…" : `Save grade ${preview?.grade ?? ""}`}
                                </button>
                                <button type="button" onClick={() => state && setInputs(state.inputs)} disabled={!dirty || saving}
                                        className="rounded-xl border border-line-300 px-4 py-3 text-sm font-bold text-white disabled:opacity-40">
                                    Reset
                                </button>
                                <p className="text-xs text-ink-500">
                                    Saving rewrites this capture&apos;s analysis fields and stores the recomputed grade.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
