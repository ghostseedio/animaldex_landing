"use client";

import {useCallback, useEffect, useMemo, useState} from "react";
import Link from "@/app/[locale]/_components/link";
import {AppEmpty} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import {TrialCard} from "@/components/animal-detail/animal-trials/animal-trials-section";
import AnimalTrialDetail from "@/components/animal-detail/animal-trials/animal-trial-detail";
import ApplyItYourWay from "@/components/animal-detail/animal-powers/apply-it-your-way";
import type {AnimalPower} from "@/lib/animal-powers";
import {
    type AnimalTrial,
    arenaTrialGroups,
    completedTrialHistory,
    earnedPowerName,
    earnedQualities,
    failedTrialHistory,
    frequencyAccent,
    isComplete,
    mergeOpenTrials,
    noteTrialUpdate,
    rewardXP,
    trialHistoryStatusLine,
    trialId
} from "@/lib/animal-trials";
import {discoverPostPath} from "@/lib/discover-post";

/**
 * Trials in the Play hub. Ported from iOS `MatchupsHubView` after Trials became
 * a first-class segment beside Comparisons.
 *
 * The Trials page lists every open Trial for an animal the person has caught,
 * grouped by animal; an animal leaves once every one of its Trials is
 * finished. The history page lists what was completed and what failed, with
 * the Power and Qualities a completed Trial contributed.
 */

const NEON = "#A7F432";
const FAIL = "rgb(250,115,133)";

type ArenaTrialsPayload = {
    openTrials: AnimalTrial[];
    history: AnimalTrial[];
    /** `<species>:<frequency>` → Discover post id, for finished Trials that are posts. */
    postIds: Record<string, string>;
};

export function useArenaTrials(enabled: boolean) {
    const [openTrials, setOpenTrials] = useState<AnimalTrial[]>([]);
    const [history, setHistory] = useState<AnimalTrial[]>([]);
    const [postIds, setPostIds] = useState<Record<string, string>>({});
    const [didLoad, setDidLoad] = useState(false);

    const refresh = useCallback(async () => {
        if (!enabled) return;
        try {
            const response = await fetch("/api/app/animal-trials/arena", {cache: "no-store"});
            if (!response.ok) return;
            const payload = await response.json() as ArenaTrialsPayload;
            setOpenTrials((previous) => mergeOpenTrials(previous, Array.isArray(payload.openTrials) ? payload.openTrials : []));
            // A failed read keeps what was there.
            if (Array.isArray(payload.history)) setHistory(payload.history);
            if (payload.postIds && typeof payload.postIds === "object") setPostIds(payload.postIds);
        } catch {
            // Keep the last known lists.
        } finally {
            setDidLoad(true);
        }
    }, [enabled]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const note = useCallback((updated: AnimalTrial) => {
        const next = noteTrialUpdate({openTrials, history}, updated);
        setOpenTrials(next.openTrials);
        setHistory(next.history);
    }, [history, openTrials]);

    return {openTrials, history, postIds, didLoad, refresh, note};
}

export function ArenaTrialsTab({
    openTrials,
    didLoad,
    onNote,
    onRefresh
}: {
    openTrials: AnimalTrial[];
    didLoad: boolean;
    onNote: (trial: AnimalTrial) => void;
    onRefresh: () => Promise<void>;
}) {
    const [selectedTrial, setSelectedTrial] = useState<AnimalTrial | null>(null);
    const [applyRoute, setApplyRoute] = useState<{trial: AnimalTrial; power: AnimalPower} | null>(null);
    const [applyLoadingTrialId, setApplyLoadingTrialId] = useState<string | null>(null);

    const groups = useMemo(() => arenaTrialGroups(openTrials), [openTrials]);

    /** The written route beside the Trial: the Power it stands in for is read first. */
    const presentApply = useCallback(async (trial: AnimalTrial) => {
        if (applyLoadingTrialId) return;
        setApplyLoadingTrialId(trialId(trial));
        try {
            const response = await fetch(`/api/app/animal-powers?speciesProfileId=${encodeURIComponent(trial.speciesProfileId)}`, {cache: "no-store"});
            const payload = response.ok ? await response.json() as {power?: AnimalPower | null} : null;
            if (payload?.power) setApplyRoute({trial, power: payload.power});
        } catch {
            // Without the Power there is nothing to apply; the Trial stays.
        } finally {
            setApplyLoadingTrialId(null);
        }
    }, [applyLoadingTrialId]);

    if (didLoad && groups.length === 0) {
        return (
            <AppEmpty
                icon="spark"
                title="No Trials left"
                detail="Trials for animals you've caught show up here, including ones you haven't started. An animal leaves once every one of its Trials is finished."
            />
        );
    }

    return (
        <>
            <div className="-mx-4 flex flex-col md:mx-0 md:overflow-hidden md:rounded-[1.35rem] md:border md:border-white/[0.08]">
                {groups.map((group) => (
                    <section key={group.id}>
                        <header className="flex items-center gap-3 px-5 pb-2 pt-[18px]">
                            <span aria-hidden="true" className="grid h-8 w-8 place-items-center rounded-lg bg-white/[0.06] text-sm">🐾</span>
                            <h3 className="min-w-0 flex-1 truncate text-base font-bold text-white">{group.name}</h3>
                            {group.trials.length > 1 ? (
                                <span className="text-[10px] font-bold text-white/40">{group.completedCount}/{group.trials.length} complete</span>
                            ) : null}
                        </header>
                        {group.remaining.map((trial) => (
                            <TrialCard
                                key={trialId(trial)}
                                trial={trial}
                                canAttempt
                                onOpen={() => setSelectedTrial(trial)}
                                onApplyYourWay={() => void presentApply(trial)}
                                isApplying={applyLoadingTrialId === trialId(trial)}
                            />
                        ))}
                    </section>
                ))}
            </div>

            {selectedTrial ? (
                <AnimalTrialDetail
                    trial={selectedTrial}
                    canAttempt
                    onChange={(updated) => {
                        setSelectedTrial(updated);
                        onNote(updated);
                    }}
                    onClose={() => {
                        setSelectedTrial(null);
                        void onRefresh();
                    }}
                />
            ) : null}

            {applyRoute ? (
                <ApplyItYourWay
                    power={applyRoute.power}
                    trial={applyRoute.trial}
                    onFinished={(result) => {
                        if (result.verdict === "approved") void onRefresh();
                    }}
                    onClose={() => setApplyRoute(null)}
                />
            ) : null}
        </>
    );
}

/** iOS `TrialHistoryRow`. */
function TrialHistoryRow({
    trial,
    postId,
    onOpen
}: {
    trial: AnimalTrial;
    postId: string | null;
    onOpen: () => void;
}) {
    const complete = isComplete(trial);
    const accent = frequencyAccent(trial.frequency);
    const powerName = complete ? earnedPowerName(trial) : null;
    const qualities = complete ? earnedQualities(trial) : [];
    const href = postId ? discoverPostPath(`animal-trial-${postId}`) : null;

    const body = (
        <>
            <span
                className="inline-flex h-6 shrink-0 items-center rounded-full px-2 text-[10px] font-black text-black/85"
                style={{backgroundColor: accent}}
            >
                {trial.frequency}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-sm font-extrabold text-white">{trial.speciesDisplayName}</span>
                <span className="truncate text-[10px] text-white/55">{trial.title}</span>
                {powerName || qualities.length ? (
                    <span className="mt-1 flex flex-col gap-1.5">
                        {powerName ? (
                            <span className="flex items-center gap-1.5 text-xs font-extrabold" style={{color: NEON}} aria-label={`Power, ${powerName}`}>
                                <span aria-hidden="true">⚡</span>{powerName}
                            </span>
                        ) : null}
                        {qualities.length ? (
                            <span className="flex flex-col gap-1" aria-label={`Qualities, ${qualities.join(", ")}`}>
                                <span className="text-[10px] font-black uppercase tracking-[0.1em] text-white/40">Qualities</span>
                                <span className="flex flex-wrap gap-1.5">
                                    {qualities.map((quality) => (
                                        <span key={quality} className="rounded-full border px-2 py-0.5 text-[11px] font-semibold text-white/85" style={{borderColor: `${NEON}38`, backgroundColor: "rgba(255,255,255,0.06)"}}>
                                            {quality}
                                        </span>
                                    ))}
                                </span>
                            </span>
                        ) : null}
                    </span>
                ) : null}
                <span className="text-[11px] font-bold" style={{color: complete ? NEON : FAIL}}>{trialHistoryStatusLine(trial)}</span>
            </span>
            <span className="shrink-0 self-start text-xs font-extrabold" style={{color: complete ? NEON : FAIL}}>
                {complete ? `+${rewardXP(trial)} XP` : "✕"}
            </span>
        </>
    );

    const className = "flex w-full items-start gap-3 border-b border-white/[0.08] bg-white/[0.02] px-4 py-3.5 text-left first:border-t";

    // A finished Trial that is a Discover post opens that card; otherwise the Trial itself.
    return href ? (
        <Link href={href} className={className}>{body}</Link>
    ) : (
        <button type="button" onClick={onOpen} className={className}>{body}</button>
    );
}

export function TrialHistoryList({
    history,
    postIds,
    didLoad,
    onNote
}: {
    history: AnimalTrial[];
    postIds: Record<string, string>;
    didLoad: boolean;
    onNote: (trial: AnimalTrial) => void;
}) {
    const [selectedTrial, setSelectedTrial] = useState<AnimalTrial | null>(null);
    const completed = useMemo(() => completedTrialHistory(history), [history]);
    const failed = useMemo(() => failedTrialHistory(history), [history]);

    if (didLoad && !completed.length && !failed.length) {
        return (
            <AppEmpty
                icon="spark"
                title="No Trial history yet"
                detail="Completed Trials and ones whose evidence didn't succeed show up here."
            />
        );
    }

    const section = (title: string, trials: AnimalTrial[]) => trials.length ? (
        <section key={title}>
            <h3 className="px-1 pb-2 pt-4 text-[0.62rem] font-black uppercase tracking-[0.14em] text-white/35">{title}</h3>
            <div className="-mx-4 md:mx-0 md:overflow-hidden md:rounded-[1.2rem] md:border md:border-white/[0.08]">
                {trials.map((trial) => (
                    <TrialHistoryRow
                        key={trialId(trial)}
                        trial={trial}
                        postId={postIds[`${trial.speciesProfileId}:${trial.frequency}`] ?? null}
                        onOpen={() => setSelectedTrial(trial)}
                    />
                ))}
            </div>
        </section>
    ) : null;

    return (
        <>
            {section("Completed", completed)}
            {section("Failed", failed)}
            {selectedTrial ? (
                <AnimalTrialDetail
                    trial={selectedTrial}
                    canAttempt
                    onChange={(updated) => {
                        setSelectedTrial(updated);
                        onNote(updated);
                    }}
                    onClose={() => setSelectedTrial(null)}
                />
            ) : null}
        </>
    );
}

/** The two figures over the Trial history: how many finished, how many did not. */
export function TrialStatsRow({history}: {history: AnimalTrial[]}) {
    const completed = completedTrialHistory(history).length;
    const failed = failedTrialHistory(history).length;
    return (
        <div className="grid grid-cols-2 gap-2.5">
            {[
                {label: "Completed", value: completed, tint: NEON},
                {label: "Failed", value: failed, tint: FAIL}
            ].map((metric) => (
                <div key={metric.label} className="min-w-0 rounded-[18px] border border-white/[0.06] bg-white/[0.04] p-3">
                    <p className="truncate text-[0.62rem] font-black uppercase tracking-[0.08em] text-white/30">{metric.label}</p>
                    <p className="mt-1.5 truncate font-display text-xl font-black tabular-nums text-white">{metric.value}</p>
                    <div className="mt-2 h-[3px] rounded-full" style={{backgroundColor: metric.tint}} />
                </div>
            ))}
        </div>
    );
}
