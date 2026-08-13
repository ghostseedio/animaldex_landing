const SPECIES_STATS_KEYS = ["dominance", "speed", "size", "intelligence", "rarity"] as const;

export type SpeciesStats = Record<(typeof SPECIES_STATS_KEYS)[number], number>;
export type AnimalBattleTier = "E" | "D" | "C" | "B" | "A" | "S";

export function getBattlePower(stats: SpeciesStats) {
    const biologicalPeak = Math.max(
        stats.dominance,
        stats.speed,
        stats.size,
        stats.intelligence
    );
    const specialistBonus = Math.max(0, biologicalPeak - 80) * 0.12;

    return Math.min(100, Math.round(
        stats.dominance * 0.27
        + stats.speed * 0.18
        + stats.size * 0.17
        + stats.intelligence * 0.18
        + stats.rarity * 0.20
        + specialistBonus
    ));
}

export function getBattleTier(stats: SpeciesStats): AnimalBattleTier {
    const battlePower = getBattlePower(stats);

    if (battlePower < 25) {
        return "E";
    }

    if (battlePower < 40) {
        return "D";
    }

    if (battlePower < 52) {
        return "C";
    }

    if (battlePower < 60) {
        return "B";
    }

    if (battlePower < 78) {
        return "A";
    }

    return "S";
}
