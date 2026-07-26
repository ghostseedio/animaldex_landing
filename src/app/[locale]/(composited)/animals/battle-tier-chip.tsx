import type {AnimalBattleTier} from "@/lib/battle-tier";

/** Matches iOS ChallengeTierBadgeView tint palette. */
const TIER_TINT: Record<AnimalBattleTier, {r: number; g: number; b: number; a: number}> = {
    S: {r: 56, g: 250, b: 71, a: 1},
    A: {r: 56, g: 250, b: 71, a: 0.92},
    B: {r: 34, g: 211, b: 238, a: 0.9},
    C: {r: 255, g: 255, b: 255, a: 0.82},
    D: {r: 251, g: 146, b: 60, a: 0.86},
    E: {r: 248, g: 113, b: 113, a: 0.82}
};

function rgba(tint: {r: number; g: number; b: number; a: number}, alpha = tint.a) {
    return `rgba(${tint.r}, ${tint.g}, ${tint.b}, ${alpha})`;
}

type BattleTierChipProps = {
    tier: AnimalBattleTier;
    compact?: boolean;
    className?: string;
};

export default function BattleTierChip({tier, compact = false, className = ""}: BattleTierChipProps) {
    const tint = TIER_TINT[tier];

    return (
        <span
            className={[
                "inline-flex shrink-0 items-center gap-1 rounded-full font-black uppercase",
                compact ? "h-[22px] px-2" : "h-[26px] px-2.5",
                className
            ].join(" ")}
            style={{
                color: "rgba(255,255,255,0.95)",
                backgroundImage: `linear-gradient(${rgba(tint, 0.18)}, ${rgba(tint, 0.18)}), linear-gradient(rgba(0,0,0,0.36), rgba(0,0,0,0.36))`,
                boxShadow: `inset 0 0 0 1px ${rgba(tint, 0.38)}`
            }}
            title={`Tier ${tier}`}
        >
            <span
                className={compact ? "text-[0.5rem] tracking-[0.12em]" : "text-[0.55rem] tracking-[0.12em]"}
                style={{color: rgba(tint, 0.78)}}
            >
                Tier
            </span>
            <span className={compact ? "text-[0.7rem] leading-none" : "text-[0.8rem] leading-none"}>
                {tier}
            </span>
        </span>
    );
}
