import {AppProgress} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import type {PowerSetTierName, PowerSetTierStatus} from "@/data/power-sets";
import {powerSetTierSubtitle} from "@/data/power-sets";

type PowerSetTierLadderProps = {
    statuses: PowerSetTierStatus[];
    catalogLinkedCount: number;
    activeTier: PowerSetTierName | null;
};

const tierStyles: Record<PowerSetTierName, {chip: string; border: string; text: string; progress: string}> = {
    bronze: {
        chip: "bg-orange-400/20 text-orange-100",
        border: "border-orange-400/45",
        text: "text-orange-100",
        progress: "bg-orange-400"
    },
    silver: {
        chip: "bg-white/15 text-white",
        border: "border-white/30",
        text: "text-white",
        progress: "bg-primary-400"
    },
    gold: {
        chip: "bg-amber-400/20 text-amber-100",
        border: "border-amber-400/45",
        text: "text-amber-100",
        progress: "bg-amber-400"
    }
};

function tierProgressPercent(status: PowerSetTierStatus) {
    if (status.targetCount <= 0) {
        return 0;
    }

    return Math.round((status.progressCount / status.targetCount) * 100);
}

export default function PowerSetTierLadder({statuses, catalogLinkedCount, activeTier}: PowerSetTierLadderProps) {
    return (
        <section className="rounded-[1.75rem] border border-white/10 bg-[#121212] p-5">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="text-[0.63rem] font-black uppercase tracking-[0.18em] text-primary-200">Collector tiers</p>
                    <p className="mt-2 text-sm text-white/45">Earn Bronze (15%), Silver (50%), then master Gold (100%).</p>
                </div>
                <div className="flex gap-2">
                    {statuses.map((status) => {
                        const style = tierStyles[status.tier];

                        return (
                            <div
                                key={status.tier}
                                className={`rounded-xl px-2 py-2 text-center ${status.isCompleted ? style.chip : "bg-white/[0.04] text-white/35"}`}
                            >
                                <p className="text-[0.62rem] font-black uppercase">{status.tier.slice(0, 1)}</p>
                                <p className="mt-1 text-xs font-bold">{status.targetCount}</p>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="mt-6 space-y-4">
                {statuses.map((status, index) => {
                    const style = tierStyles[status.tier];
                    const isActive = activeTier === status.tier && !status.isCompleted;
                    const progress = tierProgressPercent(status);

                    return (
                        <div key={status.tier} className="flex gap-4">
                            <div className="flex flex-col items-center">
                                <div className={`flex h-11 w-11 items-center justify-center rounded-full border ${isActive || status.isCompleted ? style.border : "border-white/10"} ${status.isCompleted ? style.chip : "bg-white/[0.03]"}`}>
                                    <span className={`text-sm font-black ${status.isCompleted ? style.text : "text-white/70"}`}>
                                        {status.isCompleted ? "✓" : status.tier.charAt(0).toUpperCase()}
                                    </span>
                                </div>
                                {index < statuses.length - 1 ? <div className="mt-2 h-7 w-px bg-white/10" /> : null}
                            </div>

                            <div className={`flex-1 rounded-[1.25rem] border p-4 ${isActive ? style.border : "border-white/8"} bg-white/[0.025]`}>
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-black uppercase tracking-[0.14em] text-white">{status.tier}</p>
                                        <p className="mt-1 text-xs leading-5 text-white/45">
                                            {powerSetTierSubtitle(status.tier, status.targetCount)}
                                        </p>
                                    </div>
                                    <p className="font-display text-lg font-bold text-white">
                                        {status.progressCount}/{status.targetCount}
                                    </p>
                                </div>

                                <div className="mt-4">
                                    <AppProgress value={progress} accent={status.tier === "gold" ? "gold" : status.tier === "silver" ? "green" : "violet"} />
                                </div>

                                <div className="mt-3 flex flex-wrap gap-2">
                                    {status.completionReward ? (
                                        <span className={`rounded-full px-3 py-1 text-[0.65rem] font-black uppercase tracking-[0.12em] ${style.chip}`}>
                                            +{status.completionReward} score
                                        </span>
                                    ) : null}
                                    {isActive ? (
                                        <span className="rounded-full bg-primary-400/10 px-3 py-1 text-[0.65rem] font-black uppercase tracking-[0.12em] text-primary-200">
                                            Active tier
                                        </span>
                                    ) : status.isCompleted ? (
                                        <span className="rounded-full bg-white/5 px-3 py-1 text-[0.65rem] font-black uppercase tracking-[0.12em] text-white/45">
                                            Unlocked
                                        </span>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {catalogLinkedCount > 0 ? (
                <p className="mt-4 text-xs text-white/35">{catalogLinkedCount} catalog animals carry this power.</p>
            ) : null}
        </section>
    );
}
