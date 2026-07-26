type SettingTag = "wild" | "farm" | "domestic" | "zoo" | "unknown";
type ImageQuality = "clear" | "usable" | "weak";
type ConfidenceTier = "high" | "medium" | "low";
type ShotAestheticTier = "striking" | "photogenic" | "neutral" | "plain" | "cluttered";
type BodyVisibilityAnatomy =
    | "standardVertebrate"
    | "bird"
    | "snake"
    | "fish"
    | "insect"
    | "radialSymmetry"
    | "cephalopod";

type VisibleBodyFeatures = {
    head_visible?: boolean;
    eyes_visible?: boolean | null;
    limbs_visible?: boolean;
    tail_visible?: boolean | null;
    full_body_visible?: boolean;
};

export type CaptureAnalysisSignals = {
    zoo_context_likely?: boolean;
    wild_habitat_likely?: boolean;
    domestic_context_likely?: boolean;
    farm_context_likely?: boolean;
    indoor_home_likely?: boolean;
    man_made_background_likely?: boolean;
    photo_originality_unknown?: boolean;
    behavior_tags?: string[];
    scene_tags?: string[];
    visible_body_features?: VisibleBodyFeatures | null;
    shot_aesthetic?: string | null;
};

type ObservedMarketModifiers = {
    color_appeal_delta_pct?: number;
    coat_quality_delta_pct?: number;
    symmetry_delta_pct?: number;
    visual_appeal_delta_pct?: number;
    visible_condition_delta_pct?: number;
    rarity_look_delta_pct?: number;
    documentation_quality_delta_pct?: number;
    rarity_context_delta_pct?: number;
    behavior_visibility_delta_pct?: number;
    health_visibility_delta_pct?: number;
    composition_delta_pct?: number;
    environment_context_delta_pct?: number;
    rationale?: string[];
};

type PremiumDetails = {
    reviewed_identity?: string | null;
    reviewed_scientific_name?: string | null;
    reviewed_identity_confidence?: number | null;
    visible_condition_notes?: string | null;
};

type CaptureGradeModel = {
    animal_name?: string | null;
    scientific_name?: string | null;
    breed_guess?: string | null;
    human_context?: string | null;
    zoo_or_wild?: string | null;
    setting_tag?: string | null;
    confidence?: number | null;
    breed_confidence?: number | null;
    image_quality?: string | null;
    authenticity_status?: string | null;
    capture_validity?: string | null;
    type_tags?: string[] | null;
    normalized_identity_key?: string | null;
    price_estimate?: {
        typical_price?: number | null;
        pricing_identity_type?: string | null;
    } | null;
};

export type CaptureGradeSource = {
    image_grade?: string | null;
    raw_json?: unknown;
    animal_name?: string | null;
    scientific_name?: string | null;
    breed_guess?: string | null;
    human_context?: string | null;
    zoo_or_wild?: string | null;
    confidence?: number | null;
    breed_confidence?: number | null;
    signals?: CaptureAnalysisSignals | null;
    premium_details?: PremiumDetails | null;
    observed_market_modifiers?: ObservedMarketModifiers | null;
    dominance_endorsements?: number | null;
    speed_endorsements?: number | null;
    size_endorsements?: number | null;
    intelligence_endorsements?: number | null;
    rarity_endorsements?: number | null;
};

export type CaptureGradeFactor = {
    id: string;
    title: string;
    score: number;
    weight: number;
    detail: string;
};

export type CaptureGradeAdjustment = {
    id: string;
    title: string;
    value: number;
    detail: string;
};

export type CaptureGradeChecklistItem = {
    id: string;
    title: string;
    met: boolean;
    detail: string;
    priority: number;
};

export type CaptureGradeBreakdown = {
    grade: number;
    weightedScore: number;
    adjustedScore: number;
    contrastedScore: number;
    factors: CaptureGradeFactor[];
    adjustments: CaptureGradeAdjustment[];
    checklist: CaptureGradeChecklistItem[];
    summary: string;
};

const ENDORSEMENT_PER_STAT_CAP = 30;
const ENDORSEMENT_STAT_COUNT = 5;
const WEAK_REFINED_IDENTITY_WORDS = new Set([
    "likely",
    "possible",
    "probably",
    "maybe",
    "unknown",
    "uncertain",
    "animal",
    "species"
]);

/**
 * Terminal breed/species/variant IDs, not refinable parent buckets.
 * Matches iOS AnalysisResult.isTerminalSpecificIdentity.
 */
const TERMINAL_SPECIFIC_IDENTITY_KINDS = new Set([
    "species",
    "subspecies",
    "breed",
    "variant",
    "cross_breed",
    "hybrid"
]);

function readTrimmedString(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}

export function isTerminalSpecificIdentityKind(raw: string | null | undefined) {
    const kind = raw?.trim().toLowerCase();
    return kind ? TERMINAL_SPECIFIC_IDENTITY_KINDS.has(kind) : false;
}

/**
 * A tight head/portrait crop that still documents the animal. The full body
 * being out of frame should not be treated as distant or unreadable.
 */
function hasReadableHeadPortrait(signals: CaptureAnalysisSignals | null | undefined) {
    const features = signals?.visible_body_features;
    return features?.head_visible === true && features?.full_body_visible !== true;
}

/**
 * Grade 1 alone should not mark a clear, terminal pet/breed ID as Uncertain.
 * Matches iOS AnalysisResult.shouldShowUncertaintyVisualWarning.
 */
export function shouldSuppressGradeOneUncertainty(input: {
    confidence: number | null | undefined;
    identityKind: string | null | undefined;
    signals: CaptureAnalysisSignals | null | undefined;
}) {
    return confidenceTier(input.confidence) === "high"
        && isTerminalSpecificIdentityKind(input.identityKind)
        && input.signals?.visible_body_features?.head_visible === true;
}

function asNumber(value: unknown, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function asRecord(value: unknown) {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value as Record<string, unknown>
        : null;
}

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

function normalizedIdentityTokens(value: string) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .split(/\s+/)
        .filter(Boolean);
}

function sanitizedDisplayValue(value: string | null | undefined) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
}

function isMeaningfullyMoreSpecificIdentity(candidate: string, animalName: string) {
    const candidateTokens = normalizedIdentityTokens(candidate);
    const animalTokens = normalizedIdentityTokens(animalName);

    if (candidateTokens.length === 0 || animalTokens.length === 0) {
        return true;
    }

    if (candidateTokens.join(" ") === animalTokens.join(" ")) {
        return false;
    }

    const reducedCandidate = candidateTokens.filter((token) => !WEAK_REFINED_IDENTITY_WORDS.has(token));
    const reducedAnimal = animalTokens.filter((token) => !WEAK_REFINED_IDENTITY_WORDS.has(token));

    if (reducedCandidate.length === 0 || reducedAnimal.length === 0) {
        return true;
    }

    return reducedCandidate.join(" ") !== reducedAnimal.join(" ");
}

function isSameIdentityDisplayValue(candidate: string, other: string | null | undefined) {
    if (!other) {
        return false;
    }

    const candidateTokens = normalizedIdentityTokens(candidate);
    const otherTokens = normalizedIdentityTokens(other);

    return candidateTokens.length > 0 && candidateTokens.join(" ") === otherTokens.join(" ");
}

function parseSettingTag(raw: string | null | undefined): SettingTag {
    const trimmed = raw?.trim() ?? "";

    if (!trimmed) {
        return "unknown";
    }

    const lower = trimmed.toLowerCase();

    if (lower.includes("zoo")) {
        return "zoo";
    }

    if (lower.includes("wild")) {
        return "wild";
    }

    if (lower.includes("domestic")) {
        return "domestic";
    }

    if (lower.includes("farm")) {
        return "farm";
    }

    if (lower.includes("unknown")) {
        return "unknown";
    }

    return "unknown";
}

function parseImageQuality(raw: string | null | undefined): ImageQuality {
    switch (raw?.trim().toLowerCase()) {
        case "clear":
            return "clear";
        case "weak":
        case "blurry":
        case "blur":
            return "weak";
        default:
            return "usable";
    }
}

function imageQualityGradeScore(quality: ImageQuality) {
    switch (quality) {
        case "clear":
            return 1;
        case "usable":
            return 0.72;
        case "weak":
            return 0.38;
    }
}

function confidenceTier(confidence: number | null | undefined): ConfidenceTier {
    const value = clamp(confidence ?? 0, 0, 1);

    if (value >= 0.75) {
        return "high";
    }

    if (value >= 0.5) {
        return "medium";
    }

    return "low";
}

function parseShotAesthetic(raw: string | null | undefined): ShotAestheticTier {
    switch (raw?.trim().toLowerCase()) {
        case "striking":
        case "exceptional":
        case "portfolio":
        case "stunning":
            return "striking";
        case "photogenic":
        case "aesthetic":
        case "pleasant":
        case "beautiful":
        case "artistic":
            return "photogenic";
        case "cluttered":
        case "busy":
        case "distracting":
        case "awkward":
        case "messy":
            return "cluttered";
        case "plain":
        case "unflattering":
        case "poor":
        case "flat":
        case "snapshot":
            return "plain";
        default:
            return "neutral";
    }
}

function shotAestheticGradeScore(tier: ShotAestheticTier) {
    switch (tier) {
        case "striking":
            return 1;
        case "photogenic":
            return 0.86;
        case "neutral":
            return 0.54;
        case "plain":
            return 0.34;
        case "cluttered":
            return 0.16;
    }
}

function marketHasMeaningfulAdjustment(market: ObservedMarketModifiers) {
    const values = [
        market.color_appeal_delta_pct,
        market.coat_quality_delta_pct,
        market.symmetry_delta_pct,
        market.visual_appeal_delta_pct,
        market.visible_condition_delta_pct,
        market.rarity_look_delta_pct,
        market.documentation_quality_delta_pct,
        market.rarity_context_delta_pct,
        market.behavior_visibility_delta_pct,
        market.health_visibility_delta_pct,
        market.composition_delta_pct,
        market.environment_context_delta_pct
    ];

    if (values.some((value) => Math.abs(asNumber(value)) > 0.0001)) {
        return true;
    }

    return Array.isArray(market.rationale) && market.rationale.some((entry) => readTrimmedString(entry));
}

function containsAny(haystack: string, words: string[]) {
    return words.some((word) => haystack.includes(word));
}

const RADIAL_WORDS = ["jellyfish", "anemone", "coral", "sea nettle", "man o war", "man-o-war", "hydra"];
const CEPHALOPOD_WORDS = ["octopus", "squid", "cuttlefish", "nautilus"];
const SNAKE_WORDS = ["snake", "python", "cobra", "viper", "boa", "serpent"];
const BIRD_WORDS = ["bird", "owl", "eagle", "hawk", "parrot", "duck", "goose", "swan", "penguin", "crow", "heron"];
const FISH_WORDS = ["fish", "shark", "ray", "salmon", "trout", "tuna", "whale", "dolphin", "octopus"];
const INSECT_WORDS = ["insect", "butterfly", "moth", "bee", "beetle", "dragonfly", "spider", "mantis", "ant"];

function resolveBodyVisibilityAnatomy(input: {
    typeTags: string[];
    identity: string;
}): BodyVisibilityAnatomy {
    const tags = new Set(input.typeTags.map((tag) => tag.toLowerCase()));
    const identity = input.identity.toLowerCase();

    if (containsAny(identity, RADIAL_WORDS) || (tags.has("aquatic") && containsAny(identity, ["jellyfish", "anemone", "coral"]))) {
        return "radialSymmetry";
    }

    if (containsAny(identity, CEPHALOPOD_WORDS)) {
        return "cephalopod";
    }

    if (containsAny(identity, SNAKE_WORDS)) {
        return "snake";
    }

    if (tags.has("bird") || containsAny(identity, BIRD_WORDS)) {
        return "bird";
    }

    if (tags.has("aquatic") || containsAny(identity, FISH_WORDS)) {
        return "fish";
    }

    if (containsAny(identity, INSECT_WORDS)) {
        return "insect";
    }

    return "standardVertebrate";
}

function hasBehaviorTag(signals: CaptureAnalysisSignals, tag: string) {
    return (signals.behavior_tags ?? []).some((entry) => entry.trim().toLowerCase() === tag.toLowerCase());
}

function scoreStructuredBodyVisibility(
    features: VisibleBodyFeatures,
    anatomy: BodyVisibilityAnatomy,
    lookingAtCamera: boolean
) {
    let weightedTotal = 0;
    let weightedVisible = 0;

    const add = (visible: boolean, weight: number) => {
        weightedTotal += weight;

        if (visible) {
            weightedVisible += weight;
        }
    };

    const addOptional = (visible: boolean | null | undefined, weight: number) => {
        if (typeof visible !== "boolean") {
            return;
        }

        add(visible, weight);
    };

    switch (anatomy) {
        case "standardVertebrate":
            add(Boolean(features.head_visible), 0.22);
            addOptional(features.eyes_visible, 0.18);
            add(Boolean(features.limbs_visible), 0.28);
            addOptional(features.tail_visible, 0.12);
            add(Boolean(features.full_body_visible), 0.2);
            break;
        case "bird":
            add(Boolean(features.head_visible), 0.18);
            addOptional(features.eyes_visible, 0.16);
            add(Boolean(features.limbs_visible), 0.26);
            addOptional(features.tail_visible, 0.14);
            add(Boolean(features.full_body_visible), 0.26);
            break;
        case "snake":
            add(Boolean(features.head_visible), 0.28);
            addOptional(features.eyes_visible, 0.2);
            add(Boolean(features.full_body_visible), 0.52);
            break;
        case "fish":
            add(Boolean(features.head_visible), 0.24);
            addOptional(features.eyes_visible, 0.14);
            add(Boolean(features.limbs_visible), 0.28);
            addOptional(features.tail_visible, 0.1);
            add(Boolean(features.full_body_visible), 0.24);
            break;
        case "insect":
            add(Boolean(features.head_visible), 0.2);
            addOptional(features.eyes_visible, 0.14);
            add(Boolean(features.limbs_visible), 0.3);
            add(Boolean(features.full_body_visible), 0.36);
            break;
        case "radialSymmetry":
            add(Boolean(features.head_visible) || Boolean(features.full_body_visible), 0.4);
            add(Boolean(features.limbs_visible), 0.35);
            add(Boolean(features.full_body_visible), 0.25);
            break;
        case "cephalopod":
            add(Boolean(features.head_visible), 0.3);
            addOptional(features.eyes_visible, 0.18);
            add(Boolean(features.limbs_visible), 0.32);
            add(Boolean(features.full_body_visible), 0.2);
            break;
    }

    if (weightedTotal <= 0) {
        return 0.35;
    }

    let ratio = weightedVisible / weightedTotal;

    if (anatomy !== "radialSymmetry" && lookingAtCamera && features.eyes_visible === true) {
        ratio = Math.min(1, ratio + 0.08);
    }

    return clamp(ratio, 0.08, 1);
}

function scoreInferredBodyVisibility(input: {
    imageQuality: ImageQuality;
    market: ObservedMarketModifiers;
    anatomyEyesMatter: boolean;
    lookingAtCamera: boolean;
}) {
    let score: number;

    switch (input.imageQuality) {
        case "clear":
            score = 0.7;
            break;
        case "usable":
            score = 0.46;
            break;
        case "weak":
            score = 0.2;
            break;
    }

    if (marketHasMeaningfulAdjustment(input.market)) {
        score += Math.max(0, asNumber(input.market.documentation_quality_delta_pct)) * 2.4;
        score += Math.max(0, asNumber(input.market.behavior_visibility_delta_pct)) * 2;
        score += Math.max(0, asNumber(input.market.composition_delta_pct)) * 1.6;
        score += Math.min(0, asNumber(input.market.documentation_quality_delta_pct)) * 1.8;
        score += Math.min(0, asNumber(input.market.composition_delta_pct)) * 1.4;
    }

    if (input.anatomyEyesMatter && input.lookingAtCamera) {
        score += 0.1;
    }

    return clamp(score, 0.08, 1);
}

function bodyVisibilityGradeScore(input: {
    imageQuality: ImageQuality;
    market: ObservedMarketModifiers;
    signals: CaptureAnalysisSignals;
    typeTags: string[];
    normalizedIdentityKey: string | null;
    animalName: string;
    scientificName: string | null;
    breedGuess: string | null;
}) {
    const identity = [
        input.normalizedIdentityKey,
        input.animalName,
        input.scientificName,
        input.breedGuess
    ]
        .map((value) => value?.trim().toLowerCase() ?? "")
        .filter(Boolean)
        .join(" ");
    const anatomy = resolveBodyVisibilityAnatomy({typeTags: input.typeTags, identity});
    const lookingAtCamera = hasBehaviorTag(input.signals, "looking_at_camera");
    const features = input.signals.visible_body_features ?? null;

    if (features) {
        return scoreStructuredBodyVisibility(features, anatomy, lookingAtCamera);
    }

    const eyesMatter = anatomy !== "radialSymmetry";

    return scoreInferredBodyVisibility({
        imageQuality: input.imageQuality,
        market: input.market,
        anatomyEyesMatter: eyesMatter,
        lookingAtCamera
    });
}

function marketAestheticAdjustment(market: ObservedMarketModifiers) {
    if (!marketHasMeaningfulAdjustment(market)) {
        return 0;
    }

    let adjustment = 0;
    adjustment += Math.max(0, asNumber(market.composition_delta_pct)) * 3.2;
    adjustment += Math.max(0, asNumber(market.visual_appeal_delta_pct)) * 3.5;
    adjustment += Math.max(0, asNumber(market.color_appeal_delta_pct)) * 2.8;
    adjustment += Math.max(0, asNumber(market.symmetry_delta_pct)) * 2.2;
    adjustment += Math.max(0, asNumber(market.environment_context_delta_pct)) * 2;
    adjustment += Math.max(0, asNumber(market.documentation_quality_delta_pct)) * 1.6;
    adjustment += Math.min(0, asNumber(market.composition_delta_pct)) * 2.4;
    adjustment += Math.min(0, asNumber(market.visual_appeal_delta_pct)) * 2.4;
    adjustment += Math.min(0, asNumber(market.color_appeal_delta_pct)) * 1.8;

    return adjustment;
}

function aestheticGradeScore(input: {
    imageQuality: ImageQuality;
    market: ObservedMarketModifiers;
    signals: CaptureAnalysisSignals;
}) {
    const shotAesthetic = input.signals.shot_aesthetic
        ? parseShotAesthetic(input.signals.shot_aesthetic)
        : null;
    let base = shotAesthetic
        ? shotAestheticGradeScore(shotAesthetic)
        : input.imageQuality === "clear"
            ? 0.6
            : input.imageQuality === "usable"
                ? 0.46
                : 0.2;

    base += marketAestheticAdjustment(input.market);

    if (hasBehaviorTag(input.signals, "looking_at_camera") && base >= 0.5) {
        base += 0.04;
    }

    if (input.imageQuality === "clear" && base >= 0.58) {
        base += 0.03;
    }

    return clamp(base, 0.08, 1);
}

function isDomesticBreedContext(input: {
    humanContext: string;
    settingTag: SettingTag;
}) {
    const human = input.humanContext.toLowerCase();

    return human === "pet"
        || human === "livestock"
        || input.settingTag === "domestic"
        || input.settingTag === "farm";
}

function shouldShowPriceEstimate(priceEstimate: CaptureGradeModel["price_estimate"]) {
    const typicalPrice = priceEstimate?.typical_price;
    return typeof typicalPrice === "number" && Number.isFinite(typicalPrice) && typicalPrice > 0;
}

function refinedIdentityDisplayThreshold(input: {
    isDomesticBreedContext: boolean;
    refinedIdentitySupportedByPriceEstimate: boolean;
}) {
    if (input.isDomesticBreedContext) {
        return input.refinedIdentitySupportedByPriceEstimate ? 0.3 : 0.42;
    }

    return input.refinedIdentitySupportedByPriceEstimate ? 0.45 : 0.58;
}

function displayRefinedIdentityGuess(input: {
    breedGuess: string | null;
    scientificName: string | null;
    animalName: string;
    refinedIdentityDisplayConfidence: number;
    refinedIdentityDisplayThreshold: number;
}) {
    const breed = sanitizedDisplayValue(input.breedGuess);

    if (!breed || isSameIdentityDisplayValue(breed, input.scientificName)) {
        return null;
    }

    if (input.refinedIdentityDisplayConfidence < input.refinedIdentityDisplayThreshold) {
        return null;
    }

    if (!isMeaningfullyMoreSpecificIdentity(breed, input.animalName)) {
        return null;
    }

    return breed;
}

function displayPremiumReviewedIdentityGuess(input: {
    premiumDetails: PremiumDetails;
    scientificName: string | null;
    animalName: string;
    confidence: number | null;
    refinedIdentityDisplayThreshold: number;
}) {
    const reviewedIdentity = sanitizedDisplayValue(input.premiumDetails.reviewed_identity);

    if (!reviewedIdentity) {
        return null;
    }

    const reviewedScientificName = input.premiumDetails.reviewed_scientific_name ?? input.scientificName;

    if (isSameIdentityDisplayValue(reviewedIdentity, reviewedScientificName)) {
        return null;
    }

    const threshold = Math.max(
        input.premiumDetails.reviewed_identity_confidence ?? 0,
        input.confidence ?? 0
    );

    if (threshold < input.refinedIdentityDisplayThreshold) {
        return null;
    }

    if (!isMeaningfullyMoreSpecificIdentity(reviewedIdentity, input.animalName)) {
        return null;
    }

    return reviewedIdentity;
}

function isScientificCatalogToken(token: string) {
    const parts = token.toLowerCase().split("_").filter(Boolean);
    // Binomial or trinomial scientific keys (e.g. panthera_leo, columba_livia_domestica).
    if (parts.length !== 2 && parts.length !== 3) return false;
    if (!parts.every((part) => part.length >= 3 && /^[a-z]+$/.test(part))) return false;
    const nonScientificLeading = new Set([
        "african", "american", "asian", "australian", "black", "blue", "british", "brown",
        "calico", "common", "crested", "dark", "domestic", "eastern", "european", "giant",
        "golden", "gray", "grey", "green", "hooded", "indian", "japanese", "juvenile",
        "lesser", "light", "little", "long", "masked", "mottled", "northern", "orange",
        "oriental", "pied", "pink", "purple", "red", "rough", "rusty", "short", "siamese",
        "silver", "smooth", "southern", "spotted", "striped", "western", "white", "yellow"
    ]);
    const commonNameHeads = new Set([
        "fantail", "finch", "sparrow", "swallow", "martin", "thrush", "warbler", "robin",
        "pigeon", "dove", "crow", "raven", "magpie", "starling", "owl", "hawk", "eagle",
        "heron", "parrot", "duck", "goose", "swan", "bird"
    ]);
    if (nonScientificLeading.has(parts[0])) return false;
    if (parts.some((part) => commonNameHeads.has(part))) return false;
    return true;
}

function displayCanonicalIdentityGuess(input: {
    normalizedIdentityKey: string | null;
    animalName: string;
}) {
    const token = sanitizedDisplayValue(input.normalizedIdentityKey)?.toLowerCase().replace(/-/g, "_");

    if (!token || token === "unknown" || token === "unknown_animal") {
        return null;
    }

    if (isScientificCatalogToken(token)) {
        return null;
    }

    const displayName = token
        .split("_")
        .map((part) => part ? part[0].toUpperCase() + part.slice(1) : "")
        .join(" ");

    if (!isMeaningfullyMoreSpecificIdentity(displayName, input.animalName)) {
        return null;
    }

    return displayName;
}

function shouldShowRefinedIdentityRetryHint(input: {
    preferredDisplayIdentityGuess: string | null;
    lowConfidenceRefinedIdentityGuess: string | null;
    shouldExplainMissingBreedConfirmation: boolean;
}) {
    return input.preferredDisplayIdentityGuess == null
        && (input.lowConfidenceRefinedIdentityGuess != null || input.shouldExplainMissingBreedConfirmation);
}

function mergeCaptureGradeSource(source: CaptureGradeSource | null | undefined) {
    const rawJson = asRecord(source?.raw_json);
    const model = asRecord(rawJson?.model) as CaptureGradeModel | null;

    return {
        animalName: readTrimmedString(source?.animal_name)
            || readTrimmedString(model?.animal_name)
            || "Unknown animal",
        scientificName: sanitizedDisplayValue(source?.scientific_name ?? model?.scientific_name),
        breedGuess: sanitizedDisplayValue(source?.breed_guess ?? model?.breed_guess),
        humanContext: readTrimmedString(source?.human_context ?? model?.human_context),
        settingTag: parseSettingTag(source?.zoo_or_wild ?? model?.zoo_or_wild ?? model?.setting_tag),
        confidence: source?.confidence ?? model?.confidence ?? null,
        breedConfidence: source?.breed_confidence ?? model?.breed_confidence ?? null,
        imageQuality: parseImageQuality(model?.image_quality),
        authenticityStatus: readTrimmedString(model?.authenticity_status).toLowerCase(),
        typeTags: Array.isArray(model?.type_tags)
            ? model?.type_tags.filter((tag): tag is string => typeof tag === "string") ?? []
            : [],
        normalizedIdentityKey: sanitizedDisplayValue(model?.normalized_identity_key),
        signals: (source?.signals && typeof source.signals === "object" ? source.signals : {}) as CaptureAnalysisSignals,
        premiumDetails: (source?.premium_details && typeof source.premium_details === "object"
            ? source.premium_details
            : {}) as PremiumDetails,
        market: (source?.observed_market_modifiers && typeof source.observed_market_modifiers === "object"
            ? source.observed_market_modifiers
            : {}) as ObservedMarketModifiers,
        priceEstimate: model?.price_estimate ?? null,
        totalEndorsements: asNumber(source?.dominance_endorsements)
            + asNumber(source?.speed_endorsements)
            + asNumber(source?.size_endorsements)
            + asNumber(source?.intelligence_endorsements)
            + asNumber(source?.rarity_endorsements)
    };
}

function computeCaptureGradeFromMergedSource(merged: ReturnType<typeof mergeCaptureGradeSource>): CaptureGradeBreakdown {
    const confidence = merged.confidence == null ? null : clamp(merged.confidence, 0, 1);
    const breedConfidence = merged.breedConfidence == null ? null : clamp(merged.breedConfidence, 0, 1);
    const domesticBreedContext = isDomesticBreedContext({
        humanContext: merged.humanContext,
        settingTag: merged.settingTag
    });
    const refinedIdentitySupportedByPriceEstimate = shouldShowPriceEstimate(merged.priceEstimate);
    const identityThreshold = refinedIdentityDisplayThreshold({
        isDomesticBreedContext: domesticBreedContext,
        refinedIdentitySupportedByPriceEstimate
    });
    const refinedIdentityDisplayConfidence = Math.max(breedConfidence ?? 0, confidence ?? 0);
    const preferredDisplayIdentityGuess = displayPremiumReviewedIdentityGuess({
        premiumDetails: merged.premiumDetails,
        scientificName: merged.scientificName,
        animalName: merged.animalName,
        confidence,
        refinedIdentityDisplayThreshold: identityThreshold
    })
        ?? displayRefinedIdentityGuess({
            breedGuess: merged.breedGuess,
            scientificName: merged.scientificName,
            animalName: merged.animalName,
            refinedIdentityDisplayConfidence,
            refinedIdentityDisplayThreshold: identityThreshold
        })
        ?? displayCanonicalIdentityGuess({
            normalizedIdentityKey: merged.normalizedIdentityKey,
            animalName: merged.animalName
        });
    const lowConfidenceRefinedIdentityGuess = (() => {
        const breed = sanitizedDisplayValue(merged.breedGuess);

        if (!breed) {
            return null;
        }

        const floor = domesticBreedContext
            ? (refinedIdentitySupportedByPriceEstimate ? 0.12 : 0.22)
            : (refinedIdentitySupportedByPriceEstimate ? 0.22 : 0.35);

        if (refinedIdentityDisplayConfidence < floor || refinedIdentityDisplayConfidence >= identityThreshold) {
            return null;
        }

        if (!isMeaningfullyMoreSpecificIdentity(breed, merged.animalName)) {
            return null;
        }

        return breed;
    })();
    const shouldExplainMissingBreedConfirmation = domesticBreedContext
        && preferredDisplayIdentityGuess == null
        && !refinedIdentitySupportedByPriceEstimate;
    const showRefinedIdentityRetryHint = shouldShowRefinedIdentityRetryHint({
        preferredDisplayIdentityGuess,
        lowConfidenceRefinedIdentityGuess,
        shouldExplainMissingBreedConfirmation
    });
    const shouldShowUncertaintyFallback = merged.animalName.localeCompare("Unknown animal", undefined, {sensitivity: "accent"}) === 0
        || (confidence ?? 0) < 0.4;
    const breedGradeConfidence = Math.max(
        merged.premiumDetails.reviewed_identity_confidence ?? 0,
        breedConfidence ?? 0,
        confidence ?? 0
    );
    const accuracyGradeScore = (() => {
        const value = clamp(breedGradeConfidence, 0, 1);

        switch (confidenceTier(confidence)) {
            case "high":
                return Math.max(value, 0.82);
            case "medium":
                return Math.max(value * 0.92, 0.58);
            case "low":
                return Math.max(value * 0.8, 0.24);
        }
    })();
    const framingGradeScore = (() => {
        const base = merged.imageQuality === "clear"
            ? 0.92
            : merged.imageQuality === "usable"
                ? 0.62
                : 0.24;
        const confidenceLift = clamp(confidence ?? 0, 0, 1) * 0.06;
        const specificityPenalty = showRefinedIdentityRetryHint ? 0.1 : 0;
        const uncertaintyPenalty = shouldShowUncertaintyFallback ? 0.08 : 0;

        return clamp(base + confidenceLift - specificityPenalty - uncertaintyPenalty, 0.08, 1);
    })();
    const conditionGradeScore = (() => {
        const notes = merged.premiumDetails.visible_condition_notes?.toLowerCase() ?? "";

        if (
            notes.includes("wound")
            || notes.includes("bleed")
            || notes.includes("injur")
            || notes.includes("limp")
            || notes.includes("skin")
            || notes.includes("patchy")
            || notes.includes("missing feather")
            || notes.includes("underweight")
            || notes.includes("overweight")
            || notes.includes("poor condition")
        ) {
            return 0.35;
        }

        const combined = asNumber(merged.market.coat_quality_delta_pct) + asNumber(merged.market.visible_condition_delta_pct);

        if (combined <= -0.08) return 0.26;
        if (combined <= -0.045) return 0.42;
        if (combined <= -0.02) return 0.62;
        if (combined >= 0.03) return 0.96;

        return 0.84;
    })();
    const habitatGradeScore = (() => {
        const wildHabitatLikely = Boolean(merged.signals.wild_habitat_likely);

        switch (merged.settingTag) {
            case "wild":
                return wildHabitatLikely ? 1 : 0.88;
            case "farm":
                return wildHabitatLikely ? 0.52 : 0.34;
            case "zoo":
                return wildHabitatLikely ? 0.34 : 0.18;
            case "domestic":
                return wildHabitatLikely ? 0.28 : 0.14;
            case "unknown":
                return wildHabitatLikely ? 0.62 : 0.24;
        }
    })();
    const settingGradePenalty = (() => {
        const wildHabitatLikely = Boolean(merged.signals.wild_habitat_likely);

        switch (merged.settingTag) {
            case "wild":
                return 0;
            case "farm":
                return wildHabitatLikely ? 0.06 : 0.1;
            case "zoo":
                return wildHabitatLikely ? 0.12 : 0.18;
            case "domestic":
                return wildHabitatLikely ? 0.14 : 0.2;
            case "unknown":
                return wildHabitatLikely ? 0.04 : 0.08;
        }
    })();
    const bodyVisibilityScore = bodyVisibilityGradeScore({
        imageQuality: merged.imageQuality,
        market: merged.market,
        signals: merged.signals,
        typeTags: merged.typeTags,
        normalizedIdentityKey: merged.normalizedIdentityKey,
        animalName: merged.animalName,
        scientificName: merged.scientificName,
        breedGuess: merged.breedGuess
    });
    const aestheticGradeScoreValue = aestheticGradeScore({
        imageQuality: merged.imageQuality,
        market: merged.market,
        signals: merged.signals
    });
    const imageQualityScore = imageQualityGradeScore(merged.imageQuality);
    const dynamicGradeAdjustment = (() => {
        let adjustment = 0;

        if (accuracyGradeScore >= 0.92 && imageQualityScore >= 0.95 && framingGradeScore >= 0.9) {
            adjustment += 0.08;
        } else if (accuracyGradeScore >= 0.84 && imageQualityScore >= 0.72) {
            adjustment += 0.04;
        }

        if (conditionGradeScore <= 0.42) {
            adjustment -= 0.1;
        } else if (conditionGradeScore <= 0.62) {
            adjustment -= 0.05;
        }

        if (merged.imageQuality === "weak" || framingGradeScore <= 0.32) {
            adjustment -= 0.12;
        } else if (merged.imageQuality === "usable" && framingGradeScore <= 0.58) {
            adjustment -= 0.05;
        }

        if (accuracyGradeScore <= 0.4) {
            adjustment -= 0.14;
        } else if (accuracyGradeScore <= 0.58) {
            adjustment -= 0.07;
        }

        if (bodyVisibilityScore >= 0.88) {
            adjustment += 0.06;
        } else if (bodyVisibilityScore >= 0.72) {
            adjustment += 0.03;
        } else if (bodyVisibilityScore <= 0.28) {
            adjustment -= 0.06;
        }

        if (aestheticGradeScoreValue >= 0.9) {
            adjustment += 0.05;
        } else if (aestheticGradeScoreValue >= 0.75) {
            adjustment += 0.03;
        } else if (aestheticGradeScoreValue <= 0.24) {
            adjustment -= 0.04;
        }

        return adjustment;
    })();
    const maximumEndorsements = ENDORSEMENT_PER_STAT_CAP * ENDORSEMENT_STAT_COUNT;
    const cappedEndorsements = clamp(merged.totalEndorsements, 0, maximumEndorsements);
    const endorsementLift = Math.sqrt(cappedEndorsements / maximumEndorsements) * 0.18;
    const authenticityPenalty = merged.authenticityStatus === "likely_non_live_source" ? 0.22 : 0;
    const uncertaintyPenalty = shouldShowUncertaintyFallback ? 0.14 : 0;
    const confidencePercent = confidence == null ? null : `${Math.round(confidence * 100)}%`;
    const tier = confidenceTier(confidence);
    const readablePortraitLift = tier === "high"
        && merged.imageQuality !== "weak"
        && hasReadableHeadPortrait(merged.signals)
        ? 0.1
        : 0;
    const factors: CaptureGradeFactor[] = [
        {
            id: "accuracy",
            title: "ID confidence",
            score: accuracyGradeScore,
            weight: 0.24,
            detail: tier === "high"
                ? `Identification confidence is high${confidencePercent ? ` at ${confidencePercent}` : ""}.`
                : tier === "medium"
                    ? `Identification confidence is moderate${confidencePercent ? ` at ${confidencePercent}` : ""}, so the grade is capped below top-tier certainty.`
                    : `Identification confidence is low${confidencePercent ? ` at ${confidencePercent}` : ""}, which strongly limits the grade.`
        },
        {
            id: "condition",
            title: "Condition",
            score: conditionGradeScore,
            weight: 0.24,
            detail: conditionGradeScore >= 0.9
                ? "Visible condition looks strong in this capture."
                : conditionGradeScore >= 0.62
                    ? "Visible condition looks acceptable, with no major penalty."
                    : "Visible condition notes or market modifiers suggest lower condition in this photo."
        },
        {
            id: "clarity",
            title: "Clarity & focus",
            score: imageQualityScore,
            weight: 0.13,
            detail: merged.imageQuality === "clear"
                ? "Overall clarity is strong."
                : merged.imageQuality === "usable"
                    ? "The image is usable but not fully sharp."
                    : "The image was classified as weak, blurry, or too unclear."
        },
        {
            id: "habitat",
            title: "Habitat & setting",
            score: habitatGradeScore,
            weight: 0.13,
            detail: merged.settingTag === "wild"
                ? (Boolean(merged.signals.wild_habitat_likely)
                    ? "Wild habitat signals support a strong environmental score."
                    : "Wild setting is recorded, with limited habitat evidence.")
                : merged.settingTag === "zoo"
                    ? "Zoo context receives less capture-grade credit than a strong wild habitat capture."
                    : merged.settingTag === "domestic"
                        ? "Domestic context receives less capture-grade credit than a strong wild habitat capture."
                        : merged.settingTag === "farm"
                            ? "Farm context receives less capture-grade credit than a strong wild habitat capture."
                            : "Unknown setting leaves less environmental evidence for the grade."
        },
        {
            id: "body_visibility",
            title: "Body detail",
            score: bodyVisibilityScore,
            weight: 0.11,
            detail: bodyVisibilityDetail(merged.signals.visible_body_features, bodyVisibilityScore)
        },
        {
            id: "aesthetic",
            title: "Shot quality",
            score: aestheticGradeScoreValue,
            weight: 0.08,
            detail: (() => {
                const shotAesthetic = merged.signals.shot_aesthetic?.trim();

                if (shotAesthetic) {
                    return `Shot aesthetic was classified as ${shotAesthetic}.`;
                }

                if (aestheticGradeScoreValue >= 0.75) {
                    return "Composition and visual appeal add a small lift.";
                }

                if (aestheticGradeScoreValue <= 0.24) {
                    return "Composition or background clutter lowers the shot quality.";
                }

                return "Shot quality is estimated from image clarity and visual modifiers.";
            })()
        },
        {
            id: "framing",
            title: "Centering, proximity & framing",
            score: framingGradeScore,
            weight: 0.07,
            detail: showRefinedIdentityRetryHint
                ? "The animal needs clearer breed/species-level detail for stronger framing credit."
                : shouldShowUncertaintyFallback
                    ? "The animal is not framed clearly enough for a reliable identification."
                    : framingGradeScore >= 0.8
                        ? "Framing looks strong enough for a clear identification card."
                        : framingGradeScore >= 0.5
                            ? "Framing is usable, with room to get closer or more centered."
                            : "Framing is weak — get closer, center the animal, and fill more of the frame."
        }
    ];
    const weighted = factors.reduce((sum, factor) => sum + factor.score * factor.weight, 0) + endorsementLift;
    const adjustments: CaptureGradeAdjustment[] = [];

    if (endorsementLift > 0) {
        adjustments.push({
            id: "endorsements",
            title: "Community endorsements",
            value: endorsementLift,
            detail: `${cappedEndorsements} endorsement points add a small lift.`
        });
    }

    if (dynamicGradeAdjustment !== 0) {
        adjustments.push({
            id: "dynamic_quality",
            title: dynamicGradeAdjustment > 0 ? "Quality synergy" : "Quality deductions",
            value: dynamicGradeAdjustment,
            detail: dynamicGradeAdjustment > 0
                ? "Strong confidence, clarity, body visibility, or aesthetics added a small lift."
                : "Weak clarity, low confidence, limited body visibility, condition concerns, or plain composition caused deductions."
        });
    }

    if (readablePortraitLift > 0) {
        adjustments.push({
            id: "readable_portrait",
            title: "Readable subject portrait",
            value: readablePortraitLift,
            detail: "A clear, high-confidence head/portrait view recovers documentation quality."
        });
    }

    if (settingGradePenalty > 0) {
        adjustments.push({
            id: "setting",
            title: "Setting penalty",
            value: -settingGradePenalty,
            detail: merged.settingTag === "farm"
                ? "Farm context receives less capture-grade credit than a strong wild habitat capture."
                : merged.settingTag === "zoo"
                    ? "Zoo context receives less capture-grade credit than a strong wild habitat capture."
                    : merged.settingTag === "domestic"
                        ? "Domestic context receives less capture-grade credit than a strong wild habitat capture."
                        : "Unknown setting leaves less environmental evidence for the grade."
        });
    }

    if (authenticityPenalty > 0) {
        adjustments.push({
            id: "authenticity",
            title: "Authenticity penalty",
            value: -authenticityPenalty,
            detail: "Possible poster, screen, print, artwork, or other non-live source lowers the grade."
        });
    }

    if (uncertaintyPenalty > 0) {
        adjustments.push({
            id: "uncertainty",
            title: "Uncertainty penalty",
            value: -uncertaintyPenalty,
            detail: "AnimalDex could not make a reliable enough identification from this image."
        });
    }

    const adjusted = clamp(
        weighted
            + dynamicGradeAdjustment
            + readablePortraitLift
            - authenticityPenalty
            - uncertaintyPenalty
            - settingGradePenalty,
        0.05,
        1
    );
    const contrasted = adjusted >= 0.5
        ? Math.min(1, 0.5 + ((adjusted - 0.5) / 0.5) ** 0.82 * 0.5)
        : Math.max(0.05, 0.5 - ((0.5 - adjusted) / 0.5) ** 1.18 * 0.5);
    const grade = Math.min(10, Math.max(1, Math.round(contrasted * 9)));
    const features = merged.signals.visible_body_features;
    const checklist: CaptureGradeChecklistItem[] = [
        {
            id: "id_confidence",
            title: "ID confidence",
            met: tier === "high",
            detail: tier === "high"
                ? "Identification confidence is strong."
                : "Identification is not confident enough for a perfect score.",
            priority: 1
        },
        {
            id: "natural_habitat",
            title: "Natural habitat",
            met: merged.settingTag === "wild" || Boolean(merged.signals.wild_habitat_likely),
            detail: merged.settingTag === "wild" || Boolean(merged.signals.wild_habitat_likely)
                ? "The setting supports a natural-habitat capture."
                : "Natural-habitat evidence is limited for a perfect score.",
            priority: 2
        },
        {
            id: "hd_focus",
            title: "HD and in focus",
            met: merged.imageQuality === "clear",
            detail: merged.imageQuality === "clear"
                ? "Clarity is strong enough for a top score."
                : "The photo needs sharper focus and clearer detail for a perfect score.",
            priority: 3
        },
        {
            id: "healthy_look",
            title: "Healthy looking",
            met: conditionGradeScore >= 0.75,
            detail: conditionGradeScore >= 0.75
                ? "No major visible condition concerns were noted."
                : "Visible condition notes or modifiers suggest room to improve.",
            priority: 4
        },
        {
            id: "centered",
            title: "Centered and composed",
            met: framingGradeScore >= 0.7,
            detail: framingGradeScore >= 0.7
                ? "Framing is centered and composed enough for a strong card."
                : "Get the animal more centered and fill more of the frame.",
            priority: 5
        },
        {
            id: "close_up",
            title: "Close enough for detail",
            met: framingGradeScore >= 0.7 && imageQualityScore >= 0.72,
            detail: framingGradeScore >= 0.7 && imageQualityScore >= 0.72
                ? "The subject is close enough for readable detail."
                : "Move closer so diagnostic detail fills more of the frame.",
            priority: 6
        },
        {
            id: "full_body",
            title: "Full body visible",
            met: features?.full_body_visible === true,
            detail: features?.full_body_visible === true
                ? "Most or all of the body is visible."
                : "The body is cropped or partially hidden.",
            priority: 7
        },
        {
            id: "no_obstructions",
            title: "No obstructions",
            met: aestheticGradeScoreValue >= 0.5 && merged.imageQuality !== "weak",
            detail: aestheticGradeScoreValue >= 0.5 && merged.imageQuality !== "weak"
                ? "The view looks clear enough without major obstruction."
                : "Foreground clutter, soft focus, or a blocked view limits the score.",
            priority: 8
        }
    ].sort((left, right) => left.priority - right.priority);
    const strongest = factors.reduce((best, factor) => (
        factor.score * factor.weight > best.score * best.weight ? factor : best
    ));
    const weakest = factors.reduce((worst, factor) => (
        factor.score < worst.score ? factor : worst
    ));
    const hasPenalty = adjustments.some((adjustment) => adjustment.value < 0);
    const summary = hasPenalty
        ? `Grade ${grade} is mainly driven by ${strongest.title.toLowerCase()}, with deductions from ${weakest.title.toLowerCase()} or capture reliability.`
        : `Grade ${grade} is mainly driven by ${strongest.title.toLowerCase()}, with ${weakest.title.toLowerCase()} leaving the most room to improve.`;

    return {
        grade,
        weightedScore: weighted,
        adjustedScore: adjusted,
        contrastedScore: contrasted,
        factors,
        adjustments,
        checklist,
        summary
    };
}

function bodyVisibilityDetail(features: VisibleBodyFeatures | null | undefined, score: number) {
    if (features) {
        const visible: string[] = [];
        const missing: string[] = [];

        const track = (name: string, value: boolean | null | undefined) => {
            if (value == null) return;
            if (value) visible.push(name);
            else missing.push(name);
        };

        track("head", features.head_visible);
        track("eyes", features.eyes_visible);
        track("limbs", features.limbs_visible);
        track("tail", features.tail_visible);
        track("full body", features.full_body_visible);

        if (missing.length) {
            return `Visible: ${visible.join(", ") || "none noted"}. Missing or unclear: ${missing.join(", ")}.`;
        }

        if (visible.length) {
            return `Key visible body features are present: ${visible.join(", ")}.`;
        }
    }

    if (score >= 0.72) {
        return "Enough body detail is visible for a stronger card.";
    }

    return "Important body detail is limited or inferred from the photo.";
}

export function computeCaptureGradeBreakdown(source: CaptureGradeSource | null | undefined): CaptureGradeBreakdown | null {
    const directGrade = source?.image_grade?.trim();
    const merged = mergeCaptureGradeSource(source);

    if (!merged.animalName.trim()) {
        return null;
    }

    const breakdown = computeCaptureGradeFromMergedSource(merged);

    if (directGrade && /^\d+$/.test(directGrade)) {
        return {
            ...breakdown,
            grade: Number(directGrade),
            summary: `Grade ${Number(directGrade)} is the stored capture grade for this photo.`
        };
    }

    return breakdown;
}

export function computeCaptureGrade(source: CaptureGradeSource | null | undefined): number | null {
    return computeCaptureGradeBreakdown(source)?.grade ?? null;
}

export function resolveCaptureImageGrade(source: CaptureGradeSource | null | undefined): string | null {
    const directGrade = source?.image_grade?.trim();

    if (directGrade) {
        return directGrade;
    }

    const computedGrade = computeCaptureGrade(source);

    return computedGrade == null ? null : String(computedGrade);
}
