import battlesSnapshot from "@/data/published-comparison-battles.json";

export type ComparisonBattleSide = "attacker" | "defender";

export type ComparisonBattlePlayer = {
    displayName: string;
    username: string | null;
    avatarUrl: string | null;
    animalName: string | null;
    /** Which side of the comparison page this player's animal is. */
    comparisonSide: "animalA" | "animalB";
};

export type ComparisonBattleRound = {
    number: number;
    label: string;
    detail: string | null;
    winner: ComparisonBattleSide | "draw";
};

/** A completed user Arena battle between the two species of a comparison page. */
export type ComparisonBattle = {
    id: string;
    date: string;
    format: "best_of_3" | "single_round";
    attacker: ComparisonBattlePlayer;
    defender: ComparisonBattlePlayer;
    winner: ComparisonBattleSide | "draw";
    roundsWon: {attacker: number; defender: number};
    rounds: ComparisonBattleRound[];
    /** Credits the winner took from the pot. */
    payout: number;
    stake: number;
};

const battlesBySlug = (battlesSnapshot as unknown as {battles: Record<string, ComparisonBattle[]>}).battles;

/** Newest first; empty when no user has battled this pair. Build-time snapshot (scripts/refreshComparisonBattles.mts). */
export function getComparisonBattles(slug: string): ComparisonBattle[] {
    return battlesBySlug[slug] ?? [];
}

/** One battle from a species' point of view, for the Compare section on its /animals page. */
export type SpeciesBattle = ComparisonBattle & {
    /** Which player brought this species. */
    side: ComparisonBattleSide;
    opponentSpeciesName: string | null;
    /** The published comparison for this pair, when there is one. */
    comparisonSlug: string | null;
};

const battlesBySpecies = (battlesSnapshot as unknown as {bySpecies?: Record<string, SpeciesBattle[]>}).bySpecies ?? {};

/**
 * Newest first; every completed Arena battle this species was in, whether or
 * not the pair has a comparison page. Keyed by canonical species profile id.
 */
export function getSpeciesBattles(speciesProfileId: string | null | undefined): SpeciesBattle[] {
    return speciesProfileId ? battlesBySpecies[speciesProfileId.toLowerCase()] ?? [] : [];
}
