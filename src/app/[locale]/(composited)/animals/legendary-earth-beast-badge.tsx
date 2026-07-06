type LegendaryEarthBeastBadgeProps = {
    formName?: string | null;
    compact?: boolean;
    className?: string;
};

export default function LegendaryEarthBeastBadge({
    formName,
    compact = false,
    className = ""
}: LegendaryEarthBeastBadgeProps) {
    const label = formName ? `S · ${formName}` : "S-tier Legendary";

    return (
        <span
            className={[
                "inline-flex max-w-full items-center truncate rounded-full border border-amber-400/35 bg-amber-400/10 font-black uppercase tracking-[0.08em] text-amber-100",
                compact ? "px-2 py-0.5 text-[0.58rem]" : "px-3 py-1.5 text-xs sm:text-sm",
                className
            ].join(" ")}
        >
            {label}
        </span>
    );
}
