type TierBadgeProps = {
    tier: string;
};

const tierStyles: Record<string, string> = {
    S: "border-primary-200/50 bg-primary-500/15 text-primary-100",
    A: "border-emerald-300/35 bg-emerald-400/10 text-emerald-100",
    B: "border-sky-300/30 bg-sky-400/10 text-sky-100",
    C: "border-amber-200/30 bg-amber-300/10 text-amber-100",
    D: "border-orange-300/30 bg-orange-400/10 text-orange-100",
    E: "border-stone-300/25 bg-stone-300/10 text-stone-100"
};

export default function TierBadge({tier}: TierBadgeProps) {
    return (
        <span className={`inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2.5 text-sm font-bold ${tierStyles[tier] ?? tierStyles.E}`}>
            {tier}
        </span>
    );
}
