export type MatchupResolutionRule =
    | "selected_stat"
    | "scenario_score"
    | "primary_edge_tiebreak"
    | "rarity_tiebreak"
    | "defender_hold"
    | "ai_judged"
    | "sql_fallback";

export type MatchupScenarioFamily =
    | "legacy"
    | "pursuit"
    | "ambush"
    | "endurance"
    | "control"
    | "terrain"
    | "visibility";

const RESOLUTION_RULES = new Set<string>([
    "selected_stat",
    "scenario_score",
    "primary_edge_tiebreak",
    "rarity_tiebreak",
    "defender_hold",
    "ai_judged",
    "sql_fallback"
]);

const SCENARIO_FAMILIES = new Set<string>([
    "legacy",
    "pursuit",
    "ambush",
    "endurance",
    "control",
    "terrain",
    "visibility"
]);

export function normalizeResolutionRule(value: string | null | undefined): MatchupResolutionRule | null {
    const normalized = value?.trim().toLowerCase();
    return normalized && RESOLUTION_RULES.has(normalized) ? normalized as MatchupResolutionRule : null;
}

export function normalizeScenarioFamily(value: string | null | undefined): MatchupScenarioFamily | null {
    const normalized = value?.trim().toLowerCase();
    return normalized && SCENARIO_FAMILIES.has(normalized) ? normalized as MatchupScenarioFamily : null;
}

export function isAnimalSurvivalScenario(domain: string | null | undefined) {
    return domain?.trim().toLowerCase() === "animal_survival";
}

export function formatScenarioDomainLabel(domain: string | null | undefined) {
    if (!domain) return null;
    return domain.replace(/_/g, " ");
}

export function formatScenarioFamilyLabel(family: string | null | undefined) {
    const normalized = normalizeScenarioFamily(family);
    if (!normalized) return null;
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function insightTitle(domain: string | null | undefined) {
    return isAnimalSurvivalScenario(domain) ? "Instinct advantage" : "Strategic insight";
}

export function scenarioScoreTitle(domain: string | null | undefined) {
    return isAnimalSurvivalScenario(domain) ? "Scenario fit" : "Scenario score";
}

export function payoutSummaryText(input: {
    scenarioDomain: string | null;
    payoutAmount: number;
    escrowAmount: number;
}) {
    if (isAnimalSurvivalScenario(input.scenarioDomain)) {
        return `Best adapted animal received ${input.payoutAmount} credits from a ${input.escrowAmount}-credit pot.`;
    }
    return `Best fit received ${input.payoutAmount} credits from a ${input.escrowAmount}-credit pot.`;
}

export function resolutionRevealSubtitle(input: {
    resolutionRule: MatchupResolutionRule | null;
    decidingEdgeLabel: string | null;
    scenarioDomain: string | null;
}) {
    if (!input.resolutionRule) {
        return input.decidingEdgeLabel ?? "Scenario fit decided the matchup.";
    }

    switch (input.resolutionRule) {
        case "selected_stat":
            return input.decidingEdgeLabel ?? "One deciding stat resolved this matchup.";
        case "scenario_score":
            return input.decidingEdgeLabel ?? "Scenario fit separated the two animals.";
        case "primary_edge_tiebreak":
            return `${input.decidingEdgeLabel ?? "Primary edge"} broke a close fit tie`;
        case "rarity_tiebreak":
            return "The fit stayed even. Rarity only broke the late tie.";
        case "defender_hold":
            return "Perfect deadlock. Defender kept the fit.";
        case "ai_judged":
            return isAnimalSurvivalScenario(input.scenarioDomain)
                ? "Best adapted pattern chosen"
                : "AI judged the best animal pattern";
        case "sql_fallback":
            return isAnimalSurvivalScenario(input.scenarioDomain)
                ? "Survival frame applied"
                : "Catalog scenario applied";
    }
}

export function resolutionOutcomeFootnote(input: {
    resolutionRule: MatchupResolutionRule | null;
    scenarioDomain: string | null;
}) {
    switch (input.resolutionRule) {
        case "selected_stat":
            return "This older result predates scenario comparisons and was resolved from one deciding stat.";
        case "scenario_score":
            return "Tier and power still keep matchups fair, but the result came from behavioral fit to the scenario.";
        case "primary_edge_tiebreak":
            return "The overall fit stayed even, so the primary scenario strength separated the two animal patterns.";
        case "rarity_tiebreak":
            return "The scenario fit and primary strength both stayed even, so rarity only entered as a late tie-break.";
        case "defender_hold":
            return "The scenario fit stayed fully even, so the defender kept the position and no score was awarded.";
        case "ai_judged":
            return isAnimalSurvivalScenario(input.scenarioDomain)
                ? "The AI judged the final survival fit using the scenario frame, stats, and both animal abilities."
                : "The AI judged the final fit using the scenario, stats, and both animal abilities.";
        case "sql_fallback":
            return isAnimalSurvivalScenario(input.scenarioDomain)
                ? "The server survival frame was used directly because AI generation was unavailable."
                : "The server catalog scenario was used directly because AI generation was unavailable.";
        default:
            return null;
    }
}

export function pointsRewardLabel(pointsAwarded: number, rewarded: boolean) {
    if (!rewarded || pointsAwarded <= 0) return "No points awarded";
    return `+${pointsAwarded} points`;
}
