// GRADING-2: the one battle power / tier formula, ported exactly from AnimalDex's
// supabase/functions/_shared/battle-tier.ts (decision 408).
//
// This is the SQL function public.capture_battle_power(dominance, speed, size,
// intelligence, rarity) and public.capture_tier_label(power), nothing else. The
// server's capture_tier_for_capture is capture_tier_label over the capture's
// effective battle power; a card's tier on the web must come from these, not from
// its own weights. capture-battle-tier.test.ts checks it against values taken from
// the SQL (the same vectors AnimalDex's battle-tier.test.ts uses).
//
// The arithmetic is done in hundredths with integers so it rounds exactly like
// Postgres numeric ROUND (half away from zero) and never hits a float edge such
// as 12.4999999.

export type CaptureBattleTier = "S" | "A" | "B" | "C" | "D" | "E";

export interface CaptureBattleStats {
    dominance: number;
    speed: number;
    size: number;
    intelligence: number;
    rarity: number;
}

function stat(value: number | null | undefined): number {
    // capture_battle_power takes integers and COALESCEs NULL to 0.
    return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : 0;
}

/** public.capture_battle_power */
export function captureBattlePower(stats: Partial<CaptureBattleStats>): number {
    const dominance = stat(stats.dominance);
    const speed = stat(stats.speed);
    const size = stat(stats.size);
    const intelligence = stat(stats.intelligence);
    const rarity = stat(stats.rarity);
    const top = Math.max(dominance, speed, size, intelligence);
    const hundredths = dominance * 27 + speed * 18 + size * 17 + intelligence * 18 + rarity * 20 +
        Math.max(0, top - 80) * 12;
    const sign = hundredths < 0 ? -1 : 1;
    const rounded = sign * Math.floor((Math.abs(hundredths) + 50) / 100);
    return Math.min(100, rounded);
}

/**
 * GRADING-3 (approved 2026-11-21): cut points of the active public.grading_tier_bands row (version 1, from
 * base-power percentiles of real cards). The server's capture_tier_label reads that row; a card's letter should
 * come from the server (`battle_tier` on discover_feed_v1 / owned_capture_manifest_v1). These constants are the
 * fallback for rows without it and for species (no capture), and must change with the table.
 */
export const GRADING_TIER_CUTS = {S: 57, A: 45, B: 36, C: 27, D: 14} as const;
const TIER_ORDER: CaptureBattleTier[] = ["E", "D", "C", "B", "A", "S"];

/** public.capture_tier_label (active grading_tier_bands row) */
export function captureBattleTierFromPower(power: number | null | undefined): CaptureBattleTier {
    const p = typeof power === "number" && Number.isFinite(power) ? power : 0;
    if (p >= GRADING_TIER_CUTS.S) return "S";
    if (p >= GRADING_TIER_CUTS.A) return "A";
    if (p >= GRADING_TIER_CUTS.B) return "B";
    if (p >= GRADING_TIER_CUTS.C) return "C";
    if (p >= GRADING_TIER_CUTS.D) return "D";
    return "E";
}

/** public.capture_game_stats_is_placeholder: the unidentified-animal vector is unrated (E). */
export function isPlaceholderBattleStats(stats: Partial<CaptureBattleStats> | null | undefined): boolean {
    const d = stat(stats?.dominance), s = stat(stats?.speed), z = stat(stats?.size), i = stat(stats?.intelligence);
    const r = stat(stats?.rarity);
    return (d === 0 && s === 0 && z === 0 && i === 0 && r === 0) || (d === 50 && s === 50 && z === 50 && i === 50);
}

export function parseCaptureBattleTier(value: unknown): CaptureBattleTier | null {
    const v = typeof value === "string" ? value.trim().toUpperCase() : "";
    return (TIER_ORDER as string[]).includes(v) ? v as CaptureBattleTier : null;
}

/**
 * The card's tier: the server's `battle_tier` when the row has it; otherwise public.grading_tier_for_powers on the
 * stats we have: placeholder -> E, else band(effective power) but at most one band above band(base power).
 * Rarity is never boosted, so the effective rarity is the base rarity.
 */
export function captureBattleTier(params: {
    serverTier?: unknown;
    baseStats: Partial<CaptureBattleStats> | null | undefined;
    effectiveStats?: Partial<CaptureBattleStats> | null;
}): CaptureBattleTier {
    const server = parseCaptureBattleTier(params.serverTier);
    if (server) return server;
    const base = params.baseStats ?? {};
    if (isPlaceholderBattleStats(base)) return "E";
    const effective = {...(params.effectiveStats ?? base), rarity: base.rarity};
    const effectiveRank = TIER_ORDER.indexOf(captureBattleTierFromPower(captureBattlePower(effective)));
    const baseRank = TIER_ORDER.indexOf(captureBattleTierFromPower(captureBattlePower(base)));
    return TIER_ORDER[Math.min(effectiveRank, baseRank + 1)];
}
