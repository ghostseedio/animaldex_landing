import type {MatchupGameStats} from "@/lib/matchup-stats";
import {formatStatLabel} from "@/lib/matchup-stats";

export const MATCHUP_STAT_KEYS = ["dominance", "speed", "size", "intelligence", "rarity"] as const;
export type MatchupStatKey = typeof MATCHUP_STAT_KEYS[number];

export const MATCHUP_STAT_THEME: Record<MatchupStatKey, {label: string; short: string; color: string; glow: string}> = {
    dominance: {label: "Dominance", short: "DOM", color: "#ff7a4d", glow: "rgba(255,122,77,0.35)"},
    speed: {label: "Speed", short: "SPD", color: "#67e8f9", glow: "rgba(103,232,249,0.35)"},
    size: {label: "Size", short: "SIZ", color: "#f4f4f5", glow: "rgba(244,244,245,0.2)"},
    intelligence: {label: "Intelligence", short: "INT", color: "#b3e5ff", glow: "rgba(179,229,255,0.3)"},
    rarity: {label: "Rarity", short: "RAR", color: "#38fa47", glow: "rgba(56,250,71,0.35)"}
};

export function normalizeStatKey(value: string | null | undefined): MatchupStatKey {
    const key = value?.toLowerCase().trim();
    if (key && MATCHUP_STAT_KEYS.includes(key as MatchupStatKey)) {
        return key as MatchupStatKey;
    }
    return "dominance";
}

export function statValue(stats: MatchupGameStats, key: MatchupStatKey, resolvedValue?: number | null) {
    if (resolvedValue != null && Number.isFinite(resolvedValue)) {
        return resolvedValue;
    }
    return stats[key];
}

export function formatStatValue(key: MatchupStatKey, value: number) {
    return key === "rarity" ? `${value}%` : String(value);
}

export function statLabel(key: MatchupStatKey) {
    return MATCHUP_STAT_THEME[key]?.label ?? formatStatLabel(key);
}
