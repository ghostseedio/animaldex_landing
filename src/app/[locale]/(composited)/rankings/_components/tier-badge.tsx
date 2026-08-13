type TierBadgeProps = {
    tier: string;
    /** "sm" suits inline chips beside a species name; "md" is the standalone tier-list badge. */
    size?: "sm" | "md";
};

const tierStyles: Record<string, string> = {
    S: "border-primary-200/50 bg-primary-500/20 text-primary-100",
    A: "border-emerald-300/40 bg-emerald-400/10 text-emerald-100",
    B: "border-sky-300/30 bg-sky-400/10 text-sky-100",
    C: "border-amber-200/30 bg-amber-300/10 text-amber-100",
    D: "border-orange-300/30 bg-orange-400/10 text-orange-100",
    E: "border-stone-300/25 bg-stone-300/10 text-stone-100"
};

const sizeStyles = {
    sm: "h-5 min-w-[1.25rem] px-1.5 text-xs",
    md: "h-8 min-w-[2rem] px-2.5 text-sm"
} as const;

export default function TierBadge({tier, size = "md"}: TierBadgeProps) {
    return (
        <span
            className={`inline-flex items-center justify-center rounded-md border font-bold ${sizeStyles[size]} ${tierStyles[tier] ?? tierStyles.E}`}
            title={`AnimalDex tier ${tier}`}
        >
            {tier}
        </span>
    );
}
