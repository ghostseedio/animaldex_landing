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

/** public.capture_tier_label */
export function captureBattleTierFromPower(power: number | null | undefined): CaptureBattleTier {
    const p = typeof power === "number" && Number.isFinite(power) ? power : 0;
    if (p < 25) return "E";
    if (p < 40) return "D";
    if (p < 52) return "C";
    if (p < 60) return "B";
    if (p < 78) return "A";
    return "S";
}
