const SPECIES_STATS_KEYS = ["dominance", "speed", "size", "intelligence", "rarity"] as const;

export type SpeciesStats = Record<(typeof SPECIES_STATS_KEYS)[number], number>;
export type AnimalBattleTier = "E" | "D" | "C" | "B" | "A" | "S";

export function getBattlePower(stats: SpeciesStats) {
    return Math.round(
        stats.dominance * 0.30
        + stats.speed * 0.15
        + stats.size * 0.15
        + stats.intelligence * 0.15
        + stats.rarity * 0.25
    );
}

export function getBattleTier(stats: SpeciesStats): AnimalBattleTier {
    const battlePower = getBattlePower(stats);

    if (battlePower < 25) {
        return "E";
    }

    if (battlePower < 40) {
        return "D";
    }

    if (battlePower < 55) {
        return "C";
    }

    if (battlePower < 70) {
        return "B";
    }

    if (battlePower < 85) {
        return "A";
    }

    return "S";
}
