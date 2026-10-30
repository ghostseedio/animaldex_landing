"use client";

import {useCallback, useEffect, useMemo, useState} from "react";
import Link from "@/app/[locale]/_components/link";
import {AppEmpty} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import {
    type AnimalTrial,
    completedTrialHistory,
    earnedPowerName,
    earnedQualities,
    failedTrialHistory,
    frequencyAccent,
    isComplete,
    rewardXP,
    trialHistoryStatusLine,
    trialId
} from "@/lib/animal-trials";
import {discoverPostPath} from "@/lib/discover-post";
import {trialHistoryHref, type PlayJourneyCard} from "@/lib/power-history";
import AnimalPowerIcon from "@/components/animal-detail/animal-powers/animal-power-icon";

/**
 * Explore › Battles › History › Trials (iOS `MatchupsHubView`): what was
 * completed and what never succeeded, with the Power and Qualities a
 * completed Trial contributed.
 *
 * Since 3.2 the old full Trial screen is no place to start or submit
 * (docs/your-step/SPEC.md, section 5): a row that is a Discover post opens
 * the post; any other opens the animal on your newest card of it, its record
 * on the Bond tab for a completed Trial, else its chat.
 */

const NEON = "#A7F432";
const FAIL = "rgb(250,115,133)";

type ArenaTrialsPayload = {
    history: AnimalTrial[];
    /** `<species>:<frequency>` → Discover post id, for finished Trials that are posts. */
    postIds: Record<string, string>;
};

export function useArenaTrials(enabled: boolean) {
    const [history, setHistory] = useState<AnimalTrial[]>([]);
    const [postIds, setPostIds] = useState<Record<string, string>>({});
    const [didLoad, setDidLoad] = useState(false);

    const refresh = useCallback(async () => {
        if (!enabled) return;
        try {
            const response = await fetch("/api/app/animal-trials/arena", {cache: "no-store"});
            if (!response.ok) return;
            const payload = await response.json() as ArenaTrialsPayload;
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

    return {history, postIds, didLoad, refresh};
}

/** iOS `TrialHistoryRow`. */
function TrialHistoryRow({
    trial,
    postId,
    cards
}: {
    trial: AnimalTrial;
    postId: string | null;
    cards: PlayJourneyCard[];
}) {
    const complete = isComplete(trial);
    const accent = frequencyAccent(trial.frequency);
    const powerName = complete ? earnedPowerName(trial) : null;
    const qualities = complete ? earnedQualities(trial) : [];
    const href = postId ? discoverPostPath(`animal-trial-${postId}`) : trialHistoryHref(trial, cards);

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
                                <span className="min-w-0">
                                    <AnimalPowerIcon
                                        speciesProfileId={trial.speciesProfileId}
                                        fallback={<span aria-hidden="true" className="mr-1.5">⚡</span>}
                                    />
                                    {powerName}
                                </span>
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

    // A finished Trial that is a Discover post opens that card; otherwise the animal.
    return href ? (
        <Link href={href} className={className}>{body}</Link>
    ) : (
        <div className={className}>{body}</div>
    );
}

export function TrialHistoryList({
    history,
    postIds,
    didLoad,
    cards
}: {
    history: AnimalTrial[];
    postIds: Record<string, string>;
    didLoad: boolean;
    /** Your cards, for the animal a row opens on. */
    cards: PlayJourneyCard[];
}) {
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
            <div className="-mx-4 md:mx-0 md:overflow-hidden md:border md:border-white/[0.08]">
                {trials.map((trial) => (
                    <TrialHistoryRow
                        key={trialId(trial)}
                        trial={trial}
                        postId={postIds[`${trial.speciesProfileId}:${trial.frequency}`] ?? null}
                        cards={cards}
                    />
                ))}
            </div>
        </section>
    ) : null;

    return (
        <>
            {section("Completed", completed)}
            {section("Failed", failed)}
        </>
    );
}
