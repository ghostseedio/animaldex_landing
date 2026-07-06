"use client";

import {useEffect, useMemo, useState} from "react";
import AppIcon from "@/app/[locale]/(authenticated)/app/_components/app-icon";
import {AppBadge, AppProgress, AppSectionTitle, AppSurface} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import JournalHistoryCalendar from "@/app/[locale]/(authenticated)/app/train/daily-companion/journal-history-calendar";
import type {AppCapture} from "@/data/authenticated-app";
import type {
    DailyCompanionPageData,
    DailyJournalLog,
    DailyJournalProofSummary,
    NatureAlignmentProgress,
    NatureFormulaSlot
} from "@/data/daily-companion";
import {DailyCompanionCopy, dayQuickChips, journalSteps, type JournalStep} from "@/lib/daily-companion-copy";
import {
    companionRoleLabel,
    isAlignmentCompleted,
    journalTimelineSubtitle,
    moveTodayDisplayText,
    proofStatusLabel,
    statBoostRewardLabel
} from "@/lib/daily-companion-utils";
import {appStoreUrl} from "@/lib/store-links";

type DailyCompanionClientProps = DailyCompanionPageData & {locale?: string | null};

export default function DailyCompanionClient({
    today: initialToday,
    recentLogs: initialRecentLogs,
    proofsByLogId: initialProofs,
    progress: initialProgress,
    captures,
    localDate,
    locale
}: DailyCompanionClientProps) {
    const [today, setToday] = useState(initialToday);
    const [recentLogs, setRecentLogs] = useState(initialRecentLogs);
    const [proofsByLogId, setProofsByLogId] = useState(initialProofs);
    const [progress, setProgress] = useState(initialProgress);
    const [userProblem, setUserProblem] = useState(initialToday?.userProblem ?? "");
    const [selectedBySlot, setSelectedBySlot] = useState<Record<number, string>>({});
    const [currentStep, setCurrentStep] = useState<JournalStep>("problem");
    const [pickerSlot, setPickerSlot] = useState<number | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showHistory, setShowHistory] = useState(false);
    const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(initialToday?.id ?? initialRecentLogs[0]?.id ?? null);

    const formula = today?.requestedFormula ?? [];
    const slotLimit = Math.max(1, Math.min(3, formula.length || 3));
    const selectedCaptureIds = useMemo(
        () => Array.from({length: slotLimit}, (_, index) => selectedBySlot[index]).filter((id): id is string => Boolean(id)),
        [selectedBySlot, slotLimit]
    );
    const isCompletedToday = today?.completionState === "completed";
    const furthestStep = useMemo(() => resolveFurthestStep(today), [today]);

    useEffect(() => {
        setToday(initialToday);
        setRecentLogs(initialRecentLogs);
        setProofsByLogId(initialProofs);
        setProgress(initialProgress);
    }, [initialToday, initialRecentLogs, initialProofs, initialProgress]);

    useEffect(() => {
        if (!userProblem && today?.userProblem) {
            setUserProblem(today.userProblem);
        }
        syncStepWithToday(today, setCurrentStep);
        if (today?.slottedCaptureIds.length) {
            setSelectedBySlot(
                Object.fromEntries(today.slottedCaptureIds.slice(0, slotLimit).map((captureId, index) => [index, captureId]))
            );
        }
    }, [today, slotLimit, userProblem]);

    async function submitJournal(slottedCaptureIds: string[]) {
        const problem = userProblem.trim();
        if (problem.length < 3) return;
        setSubmitting(true);
        setError(null);
        try {
            const response = await fetch("/api/app/journal", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({userProblem: problem, slottedCaptureIds, logDate: localDate})
            });
            const body = await response.json().catch(() => ({}));
            if (!response.ok) {
                setError(typeof body.error === "string" ? body.error : "Could not update today’s companion.");
                return;
            }

            const nextToday = (body.today as DailyJournalLog | null) ?? null;
            if (nextToday) setToday(nextToday);
            if (Array.isArray(body.recentLogs)) setRecentLogs(body.recentLogs);
            if (body.proofsByLogId && typeof body.proofsByLogId === "object") setProofsByLogId(body.proofsByLogId);
            if (Array.isArray(body.progress)) setProgress(body.progress as NatureAlignmentProgress[]);

            if (slottedCaptureIds.length === 0) {
                setCurrentStep("formula");
            } else {
                setCurrentStep("results");
            }
        } finally {
            setSubmitting(false);
        }
    }

    async function handlePrimaryAction() {
        if (isCompletedToday && currentStep === "formula") return;
        switch (currentStep) {
            case "problem":
                if (formula.length === 0) {
                    await submitJournal([]);
                } else {
                    setCurrentStep("formula");
                }
                break;
            case "formula":
                if (selectedCaptureIds.length === 0) {
                    setCurrentStep("map");
                } else {
                    await submitJournal(selectedCaptureIds);
                }
                break;
            case "results":
                setCurrentStep("map");
                break;
            case "map":
                setShowHistory(true);
                break;
        }
    }

    function handleBack() {
        const index = journalSteps.findIndex((step) => step.id === currentStep);
        if (index > 0) setCurrentStep(journalSteps[index - 1].id);
    }

    const primaryTitle = getPrimaryTitle(currentStep, formula.length > 0, selectedCaptureIds.length > 0, isCompletedToday);
    const primaryDisabled =
        (currentStep === "problem" && userProblem.trim().length < 3) ||
        (currentStep === "formula" && (submitting || isCompletedToday));

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-end">
                <button
                    type="button"
                    onClick={() => setShowHistory((value) => !value)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-black text-primary-200 transition hover:border-white/20"
                >
                    <AppIcon name="calendar" className="h-4 w-4" />
                    {showHistory ? "Hide history" : "Companion history"}
                </button>
            </div>

            {isCompletedToday ? (
                <CompletedTodayView
                    today={today}
                    proofsByLogId={proofsByLogId}
                />
            ) : (
                <div className="space-y-6">
                    <StepProgress currentStep={currentStep} furthestStep={furthestStep} onStepChange={setCurrentStep} />

                    {currentStep === "problem" ? (
                        <ProblemStep problem={userProblem} onProblemChange={setUserProblem} />
                    ) : null}

                    {currentStep === "formula" ? (
                        formula.length > 0 ? (
                            <FormulaStep
                                formula={formula}
                                captures={captures}
                                selectedBySlot={selectedBySlot}
                                onOpenPicker={setPickerSlot}
                                disabled={isCompletedToday}
                            />
                        ) : (
                            <ProblemStep problem={userProblem} onProblemChange={setUserProblem} />
                        )
                    ) : null}

                    {currentStep === "results" && today ? (
                        <ResultsStep today={today} captures={captures} />
                    ) : null}

                    {currentStep === "map" ? <GrowthMapStep progress={progress} /> : null}

                    {error ? <p className="text-sm text-red-300">{error}</p> : null}

                    <StepActions
                        currentStep={currentStep}
                        submitting={submitting}
                        primaryTitle={primaryTitle}
                        primaryDisabled={primaryDisabled}
                        onBack={handleBack}
                        onPrimary={handlePrimaryAction}
                    />
                </div>
            )}

            <div id="companion-history">
                <JournalHistoryCalendar
                    logs={recentLogs}
                    captures={captures}
                    proofsByLogId={proofsByLogId}
                    locale={locale}
                    selectedLogId={selectedHistoryId}
                    onSelectLog={setSelectedHistoryId}
                />
            </div>

            {pickerSlot != null && formula[pickerSlot] ? (
                <CapturePickerModal
                    slot={formula[pickerSlot]}
                    captures={captures}
                    selectedCaptureId={selectedBySlot[pickerSlot] ?? null}
                    usedCaptureIds={new Set(Object.values(selectedBySlot))}
                    onClose={() => setPickerSlot(null)}
                    onSelect={(captureId) => {
                        setSelectedBySlot((current) => ({...current, [pickerSlot]: captureId}));
                        setPickerSlot(null);
                    }}
                />
            ) : null}
        </div>
    );
}

function StepProgress({
    currentStep,
    furthestStep,
    onStepChange
}: {
    currentStep: JournalStep;
    furthestStep: JournalStep;
    onStepChange: (step: JournalStep) => void;
}) {
    const currentIndex = journalSteps.findIndex((step) => step.id === currentStep);
    const furthestIndex = journalSteps.findIndex((step) => step.id === furthestStep);
    const progressWidth = currentIndex <= 0 ? 0 : (currentIndex / (journalSteps.length - 1)) * 100;

    return (
        <AppSurface className="space-y-4">
            <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]">
                <div className="h-full rounded-full bg-primary-400 transition-all duration-500" style={{width: `${progressWidth}%`}} />
            </div>
            <div className="grid grid-cols-4 gap-2">
                {journalSteps.map((step, index) => {
                    const enabled = index <= furthestIndex;
                    const active = step.id === currentStep;
                    return (
                        <button
                            key={step.id}
                            type="button"
                            disabled={!enabled}
                            onClick={() => enabled && onStepChange(step.id)}
                            className={`rounded-[0.95rem] px-2 py-3 text-center transition ${enabled ? "" : "opacity-40"} ${active ? "bg-primary-400/10 ring-1 ring-primary-400/25" : "bg-white/[0.03]"}`}
                        >
                            <div className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs font-black ${index <= currentIndex ? "bg-primary-400 text-black" : "bg-white/10 text-white/45"}`}>
                                {index + 1}
                            </div>
                            <p className={`mt-2 text-[0.62rem] font-black uppercase tracking-[0.08em] ${active ? "text-white" : "text-white/35"}`}>
                                {step.title}
                            </p>
                        </button>
                    );
                })}
            </div>
        </AppSurface>
    );
}

function ProblemStep({problem, onProblemChange}: {problem: string; onProblemChange: (value: string) => void}) {
    return (
        <AppSurface className="space-y-4">
            <AppSectionTitle icon="spark" title={DailyCompanionCopy.dayPrompt} detail={DailyCompanionCopy.dayHelper} />
            <textarea
                value={problem}
                onChange={(event) => onProblemChange(event.target.value)}
                maxLength={1200}
                rows={6}
                placeholder="Describe the challenge, decision, or habit you want to train..."
                className="w-full resize-none rounded-2xl border border-white/10 bg-black p-4 text-sm leading-7 text-white outline-none focus:border-primary-400"
            />
            <div className="flex flex-wrap gap-2">
                {dayQuickChips.map((chip) => (
                    <button
                        key={chip.id}
                        type="button"
                        onClick={() => onProblemChange(chip.insertText)}
                        className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-white/65 transition hover:border-primary-400/30 hover:text-white"
                    >
                        {chip.label}
                    </button>
                ))}
            </div>
        </AppSurface>
    );
}

function FormulaStep({
    formula,
    captures,
    selectedBySlot,
    onOpenPicker,
    disabled
}: {
    formula: NatureFormulaSlot[];
    captures: AppCapture[];
    selectedBySlot: Record<number, string>;
    onOpenPicker: (slotIndex: number) => void;
    disabled: boolean;
}) {
    return (
        <AppSurface className="space-y-4">
            <AppSectionTitle icon="collection" title={DailyCompanionCopy.animalPlan} detail="Match each role with an animal from your collection." />
            <div className="space-y-3">
                {formula.map((slot, index) => {
                    const selectedId = selectedBySlot[index];
                    const selectedCapture = captures.find((capture) => capture.captureId === selectedId) ?? null;
                    return (
                        <div key={`${slot.animal}-${slot.role}`} className="rounded-[1rem] border border-white/[0.08] bg-white/[0.03] p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="font-display text-lg font-bold text-white">{slot.animal}</p>
                                    <p className="mt-1 text-sm text-white/45">{companionRoleLabel(slot.role)}</p>
                                </div>
                                <AppIcon name="trade" className="h-4 w-4 text-primary-200" />
                            </div>
                            {slot.traits.length > 0 ? (
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {slot.traits.map((trait) => (
                                        <span key={trait} className="rounded-full bg-primary-400/10 px-2.5 py-1 text-[0.68rem] font-bold text-primary-100">
                                            {trait}
                                        </span>
                                    ))}
                                </div>
                            ) : null}
                            {slot.substitutes?.length ? (
                                <p className="mt-3 text-xs text-white/35">Best matches: {slot.substitutes.join(", ")}</p>
                            ) : null}
                            <button
                                type="button"
                                disabled={disabled}
                                onClick={() => onOpenPicker(index)}
                                className="mt-4 flex w-full items-center gap-3 rounded-2xl border border-dashed border-white/15 bg-black/40 px-4 py-3 text-left transition hover:border-primary-400/35 disabled:opacity-50"
                            >
                                {selectedCapture ? (
                                    <>
                                        <img src={selectedCapture.imageSrc} alt="" className="h-12 w-12 rounded-xl object-cover ring-1 ring-white/10" />
                                        <div className="min-w-0">
                                            <p className="truncate font-bold text-white">{selectedCapture.animalName}</p>
                                            <p className="text-xs text-white/45">Tap to change companion</p>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/5 text-white/35">
                                            <AppIcon name="plus" />
                                        </span>
                                        <div>
                                            <p className="font-bold text-white">Choose a companion</p>
                                            <p className="text-xs text-white/45">Pick an animal from your collection</p>
                                        </div>
                                    </>
                                )}
                            </button>
                        </div>
                    );
                })}
            </div>
        </AppSurface>
    );
}

function ResultsStep({today, captures}: {today: DailyJournalLog; captures: AppCapture[]}) {
    const moveToday = moveTodayDisplayText(today);
    const insight = today.generatedInsight?.trim();

    return (
        <div className="space-y-4">
            {today.usedFormula.length > 0 ? (
                <AppSurface className="space-y-4">
                    <AppSectionTitle icon="collection" title={DailyCompanionCopy.companionToday} />
                    {today.usedFormula.map((slot, index) => {
                        const capture = captures.find((entry) => entry.captureId === slot.captureId) ?? null;
                        return (
                            <div key={slot.captureId} className="flex items-center gap-3 rounded-[1rem] border border-white/[0.08] bg-white/[0.03] p-4">
                                {capture ? <img src={capture.imageSrc} alt="" className="h-14 w-14 rounded-xl object-cover ring-1 ring-white/10" /> : null}
                                <div>
                                    <p className="text-[0.65rem] font-black uppercase tracking-[0.12em] text-primary-200">{index === 0 ? "Lead Companion" : "Support"}</p>
                                    <p className="mt-1 font-display text-lg font-bold text-white">{slot.displayName || slot.animalName}</p>
                                    <p className="text-sm text-white/45">{companionRoleLabel(slot.bestMatchRole)}</p>
                                </div>
                            </div>
                        );
                    })}
                </AppSurface>
            ) : null}

            {moveToday ? (
                <AppSurface>
                    <AppSectionTitle icon="mission" title={DailyCompanionCopy.todaysTask} />
                    <p className="mt-4 text-sm leading-7 text-white/70">{moveToday}</p>
                </AppSurface>
            ) : null}

            {insight ? (
                <AppSurface className="bg-gradient-to-br from-violet-500/10 to-transparent">
                    <AppSectionTitle icon="spark" title={DailyCompanionCopy.companionAdvice} />
                    <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-white/70">{insight}</p>
                </AppSurface>
            ) : null}
        </div>
    );
}

function GrowthMapStep({progress}: {progress: NatureAlignmentProgress[]}) {
    const maxPoints = Math.max(...progress.map((entry) => entry.points), 1);
    return (
        <AppSurface className="space-y-4">
            <AppSectionTitle icon="train" title={DailyCompanionCopy.growthMap} detail="Complete daily companions to grow domains like Focus, Resilience, and Execution." />
            {progress.length === 0 ? (
                <p className="text-sm leading-7 text-white/45">Your growth map will appear after you complete companion plans.</p>
            ) : (
                <div className="space-y-4">
                    {progress.map((entry) => (
                        <div key={entry.domain}>
                            <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                                <span className="font-bold text-white">{entry.domain}</span>
                                <span className="text-white/40">Lv {entry.level} · {Math.round(entry.points)} pts</span>
                            </div>
                            <AppProgress value={(entry.points / maxPoints) * 100} accent="violet" />
                        </div>
                    ))}
                </div>
            )}
        </AppSurface>
    );
}

function CompletedTodayView({
    today,
    proofsByLogId
}: {
    today: DailyJournalLog | null;
    proofsByLogId: Record<string, DailyJournalProofSummary>;
}) {
    if (!today) return null;
    const proof = proofsByLogId[today.id] ?? null;
    const rewardLabel = statBoostRewardLabel(today.alignmentXpAwarded, today.proofStatBoostStat, today.proofRewardDomains);

    return (
        <div className="space-y-4">
            <AppSurface className="border-primary-300/20 bg-primary-400/[0.08]">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-primary-200">{DailyCompanionCopy.taskComplete}</p>
                <h2 className="mt-2 font-display text-2xl font-bold text-white">
                    {isAlignmentCompleted(today) ? "Your companion gained a boost." : "Today's companion is ready"}
                </h2>
                <p className="mt-2 text-sm leading-7 text-white/55">{DailyCompanionCopy.comeBackTomorrow}</p>
            </AppSurface>

            <AppSurface className="space-y-3">
                <AppSectionTitle icon="camera" title={DailyCompanionCopy.showYouDidIt} detail="Proof photos and timeline sharing are available in the AnimalDex app." />
                <AppBadge tone={today.alignmentProofStatus === "accepted" ? "success" : "neutral"}>
                    {proofStatusLabel(today.alignmentProofStatus)}
                </AppBadge>
                {proof?.verificationReason ? <p className="text-sm leading-6 text-white/55">{proof.verificationReason}</p> : null}
                {rewardLabel ? <p className="text-sm font-bold text-primary-200">{rewardLabel}</p> : null}
                {today.alignmentProofStatus !== "accepted" ? (
                    <a href={appStoreUrl} className="inline-flex rounded-2xl bg-primary-400 px-4 py-2.5 text-sm font-black text-black">
                        Complete proof in AnimalDex
                    </a>
                ) : null}
            </AppSurface>
        </div>
    );
}

function StepActions({
    currentStep,
    submitting,
    primaryTitle,
    primaryDisabled,
    onBack,
    onPrimary
}: {
    currentStep: JournalStep;
    submitting: boolean;
    primaryTitle: string;
    primaryDisabled: boolean;
    onBack: () => void;
    onPrimary: () => void;
}) {
    return (
        <div className="flex flex-col gap-3 sm:flex-row">
            {currentStep !== "problem" ? (
                <button
                    type="button"
                    onClick={onBack}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3.5 text-sm font-black text-white"
                >
                    <AppIcon name="back" className="h-4 w-4" />
                    Back
                </button>
            ) : null}
            <button
                type="button"
                disabled={primaryDisabled || submitting}
                onClick={onPrimary}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary-400 px-5 py-3.5 text-sm font-black text-black disabled:opacity-40"
            >
                <AppIcon name="spark" />
                {submitting ? "Working…" : primaryTitle}
            </button>
        </div>
    );
}

function CapturePickerModal({
    slot,
    captures,
    selectedCaptureId,
    usedCaptureIds,
    onClose,
    onSelect
}: {
    slot: NatureFormulaSlot;
    captures: AppCapture[];
    selectedCaptureId: string | null;
    usedCaptureIds: Set<string>;
    onClose: () => void;
    onSelect: (captureId: string) => void;
}) {
    const matches = useMemo(() => {
        const tokens = new Set(
            [slot.animal, ...(slot.substitutes ?? []), ...slot.traits]
                .map((value) => value.trim().toLowerCase())
                .filter(Boolean)
        );
        return captures
            .filter((capture) => !usedCaptureIds.has(capture.captureId) || capture.captureId === selectedCaptureId)
            .sort((left, right) => {
                const leftScore = tokens.has(left.animalName.toLowerCase()) ? 1 : 0;
                const rightScore = tokens.has(right.animalName.toLowerCase()) ? 1 : 0;
                return rightScore - leftScore || right.score - left.score;
            })
            .slice(0, 24);
    }, [captures, selectedCaptureId, slot, usedCaptureIds]);

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
            <div className="max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#121212] shadow-2xl">
                <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                    <div>
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-primary-200">Choose companion</p>
                        <h3 className="mt-1 font-display text-xl font-bold text-white">{slot.animal}</h3>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-xl border border-white/10 p-2 text-white/55">
                        <AppIcon name="close" />
                    </button>
                </div>
                <div className="grid max-h-[60vh] grid-cols-2 gap-2 overflow-y-auto p-4 sm:grid-cols-3">
                    {matches.map((capture) => {
                        const active = capture.captureId === selectedCaptureId;
                        return (
                            <button
                                key={capture.captureId}
                                type="button"
                                onClick={() => onSelect(capture.captureId)}
                                className={`rounded-2xl border p-3 text-left transition ${active ? "border-primary-400 bg-primary-400/10" : "border-white/[0.08] bg-white/[0.03] hover:border-white/18"}`}
                            >
                                <img src={capture.imageSrc} alt="" className="h-20 w-full rounded-xl object-cover" />
                                <p className="mt-2 truncate text-sm font-bold text-white">{capture.animalName}</p>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

function resolveFurthestStep(today: DailyJournalLog | null): JournalStep {
    if (today?.completionState === "completed") return "map";
    if ((today?.requestedFormula.length ?? 0) > 0) return "formula";
    return "problem";
}

function syncStepWithToday(today: DailyJournalLog | null, setCurrentStep: (step: JournalStep) => void) {
    if (!today) return;
    if (today.completionState === "completed") {
        setCurrentStep("map");
    } else if (today.completionState === "formula_ready") {
        setCurrentStep("formula");
    }
}

function getPrimaryTitle(
    currentStep: JournalStep,
    hasFormula: boolean,
    hasSelections: boolean,
    completedToday: boolean
) {
    if (completedToday && currentStep === "formula") return "Completed Today";
    switch (currentStep) {
        case "problem":
            return hasFormula ? DailyCompanionCopy.animalPlan : DailyCompanionCopy.findCompanion;
        case "formula":
            return hasSelections ? "Complete Plan" : DailyCompanionCopy.growthMap;
        case "results":
            return DailyCompanionCopy.growthMap;
        case "map":
            return "View History";
    }
}
