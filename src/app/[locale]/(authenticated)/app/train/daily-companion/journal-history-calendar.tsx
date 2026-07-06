"use client";

import {useEffect, useMemo, useState} from "react";
import AppIcon from "@/app/[locale]/(authenticated)/app/_components/app-icon";
import {AppBadge, AppSectionTitle, AppSurface} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import type {AppCapture} from "@/data/authenticated-app";
import type {DailyJournalLog, DailyJournalProofSummary} from "@/data/daily-companion";
import {DailyCompanionCopy} from "@/lib/daily-companion-copy";
import {
    companionRoleLabel,
    completionDisplay,
    dayPart,
    isAlignmentCompleted,
    monthPart,
    moveTodayDisplayText,
    proofStatusLabel,
    statBoostRewardLabel
} from "@/lib/daily-companion-utils";
import {formatAppShortDateWithYear} from "@/lib/app-dates";

type JournalHistoryCalendarProps = {
    logs: DailyJournalLog[];
    captures: AppCapture[];
    proofsByLogId: Record<string, DailyJournalProofSummary>;
    locale?: string | null;
    selectedLogId?: string | null;
    onSelectLog?: (logId: string) => void;
};

export default function JournalHistoryCalendar({logs, captures, proofsByLogId, locale, selectedLogId, onSelectLog}: JournalHistoryCalendarProps) {
    const sortedLogs = useMemo(
        () => [...logs].sort((left, right) => right.logDate.localeCompare(left.logDate) || right.createdAt.localeCompare(left.createdAt)),
        [logs]
    );
    const [internalSelectedId, setInternalSelectedId] = useState<string | null>(selectedLogId ?? sortedLogs[0]?.id ?? null);
    const activeSelectedId = selectedLogId ?? internalSelectedId;
    const selectedLog = sortedLogs.find((log) => log.id === activeSelectedId) ?? sortedLogs[0] ?? null;

    useEffect(() => {
        if (selectedLogId) setInternalSelectedId(selectedLogId);
    }, [selectedLogId]);

    function selectLog(logId: string) {
        setInternalSelectedId(logId);
        onSelectLog?.(logId);
    }

    if (sortedLogs.length === 0) {
        return (
            <AppSurface>
                <AppSectionTitle icon="calendar" title={DailyCompanionCopy.historyTitle} />
                <div className="mt-5 rounded-[1.1rem] border border-white/[0.08] bg-white/[0.03] p-5">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-white/30">
                        <AppIcon name="calendar" />
                    </span>
                    <h3 className="mt-4 font-display text-xl font-bold text-white">{DailyCompanionCopy.noHistoryTitle}</h3>
                    <p className="mt-2 text-sm leading-6 text-white/45">{DailyCompanionCopy.noHistoryDetail}</p>
                </div>
            </AppSurface>
        );
    }

    return (
        <AppSurface className="space-y-5">
            <AppSectionTitle icon="calendar" title={DailyCompanionCopy.historyTitle} detail="Tap a date to review that day’s companion plan." />

            <div className="rounded-[1.1rem] border border-white/[0.08] bg-white/[0.03] p-4">
                <div className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.12em] text-white/55">
                    <AppIcon name="calendar" className="h-4 w-4 text-primary-200" />
                    {DailyCompanionCopy.selectDate}
                </div>
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {sortedLogs.map((log) => {
                        const selected = log.id === selectedLog?.id;
                        return (
                            <button
                                key={log.id}
                                type="button"
                                onClick={() => selectLog(log.id)}
                                className={`relative shrink-0 rounded-[0.9rem] border px-4 py-3 text-center transition ${
                                    selected
                                        ? "border-primary-400 bg-primary-400 text-black"
                                        : "border-white/[0.08] bg-white/[0.04] text-white hover:border-white/20"
                                }`}
                            >
                                <div className="text-base font-black tabular-nums">{dayPart(log.logDate)}</div>
                                <div className={`text-[0.65rem] font-black uppercase tracking-[0.12em] ${selected ? "text-black/55" : "text-white/35"}`}>
                                    {monthPart(log.logDate)}
                                </div>
                                {isAlignmentCompleted(log) ? (
                                    <span className={`absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full ${selected ? "bg-black text-primary-300" : "bg-primary-400 text-black"}`}>
                                        <AppIcon name="check" className="h-2.5 w-2.5" />
                                    </span>
                                ) : null}
                            </button>
                        );
                    })}
                </div>
            </div>

            {selectedLog ? <HistoryLogDetail log={selectedLog} captures={captures} proof={proofsByLogId[selectedLog.id] ?? null} locale={locale} /> : null}
        </AppSurface>
    );
}

function HistoryLogDetail({
    log,
    captures,
    proof,
    locale
}: {
    log: DailyJournalLog;
    captures: AppCapture[];
    proof: DailyJournalProofSummary | null;
    locale?: string | null;
}) {
    const insight = log.generatedInsight?.trim() || null;
    const moveToday = moveTodayDisplayText(log);
    const rewardLabel = statBoostRewardLabel(log.alignmentXpAwarded, log.proofStatBoostStat, log.proofRewardDomains);

    return (
        <article className="space-y-4 rounded-[1.2rem] border border-white/[0.08] bg-[#101010] p-5">
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <h3 className="font-display text-2xl font-bold text-white">{formatAppShortDateWithYear(log.logDate, locale)}</h3>
                    <p className="mt-1 text-[0.65rem] font-black uppercase tracking-[0.14em] text-white/35">{DailyCompanionCopy.yourDay}</p>
                    <p className="mt-3 text-sm leading-6 text-white/60">{log.userProblem}</p>
                </div>
                {log.alignmentScore != null ? (
                    <div className="shrink-0 text-right">
                        <div className="font-display text-3xl font-bold tabular-nums text-primary-200">{log.alignmentScore}</div>
                        <div className="text-[0.65rem] font-black uppercase tracking-[0.12em] text-white/35">score</div>
                    </div>
                ) : null}
            </div>

            <AppBadge tone="primary">{log.alignmentTier ?? completionDisplay(log.completionState)}</AppBadge>

            {insight ? (
                <section className="rounded-[1rem] border border-violet-400/15 bg-violet-500/10 p-4">
                    <p className="text-[0.65rem] font-black uppercase tracking-[0.14em] text-violet-200">{DailyCompanionCopy.companionAdvice}</p>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-white/70">{insight}</p>
                </section>
            ) : null}

            {log.requestedFormula.length > 0 ? (
                <section className="space-y-3">
                    <SectionHeading icon="spark" title={DailyCompanionCopy.animalPlan} />
                    {log.requestedFormula.map((slot) => (
                        <FormulaHistoryRow key={`${slot.animal}-${slot.role}`} slot={slot} />
                    ))}
                </section>
            ) : null}

            {log.usedFormula.length > 0 ? (
                <section className="space-y-3">
                    <SectionHeading icon="check" title="Chosen Companions" />
                    {log.usedFormula.map((slot) => (
                        <UsedFormulaHistoryRow key={slot.captureId} slot={slot} capture={captures.find((entry) => entry.captureId === slot.captureId) ?? null} />
                    ))}
                </section>
            ) : null}

            {moveToday ? (
                <section className="rounded-[1rem] border border-white/[0.08] bg-white/[0.03] p-4">
                    <SectionHeading icon="mission" title={DailyCompanionCopy.todaysTask} />
                    <p className="mt-3 text-sm leading-7 text-white/70">{moveToday}</p>
                </section>
            ) : null}

            {log.alignmentProofStatus !== "not_started" || proof ? (
                <section className="rounded-[1rem] border border-white/[0.08] bg-white/[0.03] p-4">
                    <SectionHeading icon="camera" title="Task Proof" />
                    <AppBadge tone={log.alignmentProofStatus === "accepted" ? "success" : log.alignmentProofStatus === "rejected" ? "warning" : "neutral"}>
                        {proofStatusLabel(log.alignmentProofStatus)}
                    </AppBadge>
                    {proof?.verificationReason ? <p className="mt-3 text-sm leading-6 text-white/55">{proof.verificationReason}</p> : null}
                    {rewardLabel ? <p className="mt-2 text-sm font-bold text-primary-200">{rewardLabel}</p> : null}
                </section>
            ) : null}

            {log.dominantTraits.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                    {log.dominantTraits.map((trait) => (
                        <span key={trait} className="rounded-full bg-white/5 px-2.5 py-1 text-xs font-bold text-white/55">
                            {trait}
                        </span>
                    ))}
                </div>
            ) : null}
        </article>
    );
}

function SectionHeading({icon, title}: {icon: "spark" | "check" | "mission" | "camera"; title: string}) {
    return (
        <div className="flex items-center gap-2">
            <AppIcon name={icon} className="h-4 w-4 text-primary-200" />
            <h4 className="text-sm font-black text-white">{title}</h4>
        </div>
    );
}

function FormulaHistoryRow({slot}: {slot: DailyJournalLog["requestedFormula"][number]}) {
    return (
        <div className="rounded-[0.95rem] border border-white/[0.08] bg-white/[0.03] p-3">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="font-display text-base font-bold text-white">{slot.animal}</p>
                    <p className="mt-1 text-xs text-white/45">{companionRoleLabel(slot.role)}</p>
                </div>
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
        </div>
    );
}

function UsedFormulaHistoryRow({slot, capture}: {slot: DailyJournalLog["usedFormula"][number]; capture: AppCapture | null}) {
    return (
        <div className="flex items-center gap-3 rounded-[0.95rem] border border-white/[0.08] bg-white/[0.03] p-3">
            {capture ? <img src={capture.imageSrc} alt="" className="h-12 w-12 rounded-xl object-cover ring-1 ring-white/10" /> : null}
            <div className="min-w-0">
                <p className="truncate font-display text-base font-bold text-white">{slot.displayName || slot.animalName}</p>
                <p className="mt-1 text-xs text-white/45">{companionRoleLabel(slot.bestMatchRole)} · Grade {slot.imageGrade}</p>
            </div>
        </div>
    );
}
