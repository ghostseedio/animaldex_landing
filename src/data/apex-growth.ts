const QUALITY_ALIASES: Record<string, string> = {
    attention: "focus",
    concentration: "focus",
    bravery: "courage",
    boldness: "courage",
    consistency: "discipline",
    "self-control": "self-regulation",
    "emotional-regulation": "self-regulation",
    calmness: "self-regulation",
    awareness: "observation",
    vigilance: "observation",
    restoration: "recovery",
    collaboration: "teamwork",
    cooperation: "teamwork",
    flexibility: "adaptability",
    persistence: "resilience",
    perseverance: "resilience",
    guardianship: "protection"
};

export type ApexGrowthMatchStrength =
    | "strong"
    | "partial"
    | "offPath"
    | "profileRequired"
    | "pathUnavailable"
    | "powerUnavailable"
    | "apexReached";

export type ApexGrowthQuality = {
    key: string;
    label: string;
    currentScore: number;
    targetScore: number;
    remaining: number;
};

export type ApexGrowthCaptureCandidate = {
    captureId: string;
    displayName: string;
    animalPowerName: string | null;
    animalPowerText: string;
    bestForUses: string[];
    level: number;
    rarity: number;
    lastGrowthUseAt: string | null;
};

export type ApexGrowthMatch = {
    captureId: string | null;
    captureDisplayName: string | null;
    strength: ApexGrowthMatchStrength;
    apexAnimalName: string | null;
    relevanceScore: number;
    selectionScore: number;
    matchedQualities: ApexGrowthQuality[];
    neededQualities: ApexGrowthQuality[];
    cardBestForUses: string[];
    reason: string;
};

export type WildProfileApexProgress = {
    profileId: string;
    apexAnimalName: string | null;
    targets: ApexGrowthQuality[];
};

export function apexQualityKey(value: string) {
    const raw = value
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

    return QUALITY_ALIASES[raw] ?? raw;
}

export function apexQualityMatchScore(left: string, right: string) {
    const normalizedLeft = apexQualityKey(left);
    const normalizedRight = apexQualityKey(right);

    if (!normalizedLeft || !normalizedRight) {
        return 0;
    }

    if (normalizedLeft === normalizedRight) {
        return 1;
    }

    if (QUALITY_ALIASES[normalizedLeft] === normalizedRight || QUALITY_ALIASES[normalizedRight] === normalizedLeft) {
        return 0.95;
    }

    if (normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)) {
        return 0.78;
    }

    const leftTokens = new Set(normalizedLeft.split("-").filter((token) => token.length > 2));
    const rightTokens = new Set(normalizedRight.split("-").filter((token) => token.length > 2));
    const union = new Set([...Array.from(leftTokens), ...Array.from(rightTokens)]);

    if (union.size === 0) {
        return 0;
    }

    let intersection = 0;

    leftTokens.forEach((token) => {
        if (rightTokens.has(token)) {
            intersection += 1;
        }
    });

    return intersection / union.size;
}

function unavailable(strength: ApexGrowthMatchStrength, reason: string): ApexGrowthMatch {
    return {
        captureId: null,
        captureDisplayName: null,
        strength,
        apexAnimalName: null,
        relevanceScore: 0,
        selectionScore: 0,
        matchedQualities: [],
        neededQualities: [],
        cardBestForUses: [],
        reason
    };
}

export function evaluateApexGrowth(
    profile: WildProfileApexProgress | null,
    candidate: ApexGrowthCaptureCandidate | null
): ApexGrowthMatch {
    if (!profile) {
        return unavailable("profileRequired", "Complete your Wild Profile to reveal the qualities on your Apex path.");
    }

    const missing = profile.targets.filter((target) => target.remaining > 0);

    if (profile.targets.length === 0) {
        return unavailable("pathUnavailable", "Refresh your Wild Profile to add the powers you want to train.");
    }

    if (missing.length === 0) {
        return {
            captureId: candidate?.captureId ?? null,
            captureDisplayName: candidate?.displayName ?? null,
            strength: "apexReached",
            apexAnimalName: profile.apexAnimalName,
            relevanceScore: 100,
            selectionScore: 100,
            matchedQualities: [],
            neededQualities: [],
            cardBestForUses: candidate?.bestForUses ?? [],
            reason: "Your current Apex quality targets are complete."
        };
    }

    if (!candidate) {
        return {
            captureId: null,
            captureDisplayName: null,
            strength: "powerUnavailable",
            apexAnimalName: profile.apexAnimalName,
            relevanceScore: 0,
            selectionScore: 0,
            matchedQualities: [],
            neededQualities: missing,
            cardBestForUses: [],
            reason: "This animal's power is still loading."
        };
    }

    const scoredTargets = missing.map((target) => {
        const tagScore = Math.max(
            0,
            ...candidate.bestForUses.map((tag) => apexQualityMatchScore(tag, target.key))
        );
        const powerScore = apexQualityMatchScore(candidate.animalPowerText, target.key);

        return {
            target,
            score: Math.min(1, (tagScore * 0.88) + (powerScore * 0.12))
        };
    });

    const bestRelevance = Math.max(0, ...scoredTargets.map((entry) => entry.score));
    const matched = scoredTargets
        .filter((entry) => entry.score >= 0.42)
        .sort((left, right) => {
            if (left.score !== right.score) {
                return right.score - left.score;
            }

            if (left.target.remaining !== right.target.remaining) {
                return right.target.remaining - left.target.remaining;
            }

            return left.target.key.localeCompare(right.target.key);
        })
        .map((entry) => entry.target);
    const relevanceScore = Math.round(bestRelevance * 100);
    const freshnessBonus = candidate.lastGrowthUseAt
        ? Math.min(8, Math.max(0, (Date.now() - Date.parse(candidate.lastGrowthUseAt)) / 86_400_000))
        : 8;
    const trainingPotential = Math.max(0, 1 - (candidate.level / 100)) * 5;
    const rarityBonus = Math.min(4, candidate.rarity / 25);
    const selectionScore = Math.min(100, Math.round((relevanceScore * 0.83) + freshnessBonus + trainingPotential + rarityBonus));
    const strength: ApexGrowthMatchStrength = bestRelevance >= 0.76
        ? "strong"
        : bestRelevance >= 0.42
            ? "partial"
            : "offPath";

    let reason = "This Animal Power does not strongly match your current Apex path.";

    if (strength === "strong") {
        reason = "This Animal Power strongly supports your current Apex path.";
    } else if (strength === "partial") {
        reason = "This Animal Power can support part of your current Apex path.";
    }

    return {
        captureId: candidate.captureId,
        captureDisplayName: candidate.displayName,
        strength,
        apexAnimalName: profile.apexAnimalName,
        relevanceScore,
        selectionScore,
        matchedQualities: matched,
        neededQualities: missing,
        cardBestForUses: candidate.bestForUses,
        reason
    };
}

export function apexGrowthPresentation(match: ApexGrowthMatch) {
    switch (match.strength) {
        case "strong":
        case "partial":
            return "useThisPower" as const;
        case "offPath":
            return "offPath" as const;
        case "profileRequired":
            return "profileRequired" as const;
        case "pathUnavailable":
            return "pathUnavailable" as const;
        case "powerUnavailable":
            return "powerUnavailable" as const;
        case "apexReached":
            return "apexReached" as const;
    }
}

export function apexGrowthMatchTitle(match: ApexGrowthMatch) {
    switch (match.strength) {
        case "strong":
            return "Strong Apex match";
        case "partial":
            return "Partial Apex match";
        case "offPath":
            return "Not on your Apex path";
        case "profileRequired":
            return "Reveal your Apex path";
        case "pathUnavailable":
            return "Refresh your Apex Path";
        case "powerUnavailable":
            return "Reading this Animal Power";
        case "apexReached":
            return "Apex targets complete";
    }
}

export function buildApexChallengeRequest(
    match: ApexGrowthMatch,
    captureId: string,
    wildProfileId: string
) {
    const target = match.matchedQualities[0];

    if (!target) {
        throw new Error("No trainable Apex quality was found for this animal.");
    }

    const matchedTags = Array.from(new Set(
        match.matchedQualities.map((quality) => apexQualityKey(quality.key)).filter(Boolean)
    )).sort();

    return {
        capture_id: captureId,
        wild_profile_id: wildProfileId,
        target_quality_tag: apexQualityKey(target.key),
        matched_quality_tags: matchedTags,
        source: "animal_card"
    };
}
