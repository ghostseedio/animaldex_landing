import {buildComparisonSlug} from "@/lib/comparison-slug";
import {INSTAGRAM_IMPORT_PATH} from "@/lib/instagram-import";

/** Deterministic daily Ask entitlements. Do not invent extra tiers in UI copy. */
export const SPECIES_ASK_DAILY_LIMITS = {
    anonymous: 3,
    signedIn: 10,
    pro: 30
} as const;

export const SPECIES_ASK_ANONYMOUS_LIMIT = SPECIES_ASK_DAILY_LIMITS.anonymous;
export const SPECIES_ASK_SIGNED_IN_LIMIT = SPECIES_ASK_DAILY_LIMITS.signedIn;
export const SPECIES_ASK_PRO_LIMIT = SPECIES_ASK_DAILY_LIMITS.pro;
export const SPECIES_ASK_WINDOW_MS = 24 * 60 * 60 * 1000;
export const SPECIES_ASK_LAYER_BODY_MAX = 420;

export const SPECIES_ASK_FUNNEL_EVENTS = {
    pageViewed: "species_page_viewed",
    whyClicked: "species_ask_why_clicked",
    chipClicked: "species_ask_chip_clicked",
    submitted: "species_ask_submitted",
    answered: "species_ask_answered",
    followupClicked: "species_ask_followup_clicked",
    limitReached: "species_ask_limit_reached",
    collectClicked: "species_ask_collect_clicked"
} as const;

export type SpeciesAskLayerKind = "biology" | "why" | "lesson" | "symbolism";

export const SPECIES_ASK_LAYER_META: Record<SpeciesAskLayerKind, {title: string; caption: string}> = {
    biology: {
        title: "Biology",
        caption: "Established animal facts and behavior"
    },
    why: {
        title: "Why",
        caption: "Biological and evolutionary explanation"
    },
    lesson: {
        title: "AnimalDex Lesson",
        caption: "AnimalDex’s interpretation"
    },
    symbolism: {
        title: "Symbolism",
        caption: "Cultural and historical interpretation"
    }
};

export type SpeciesAskSuggestion = {
    label: string;
    prompt: string;
};

export type SpeciesAskRouteIntent =
    | "compare"
    | "power"
    | "locations"
    | "experiences"
    | "instagram"
    | "collect"
    | "lesson";

export type SpeciesAskRoute = {
    intent: SpeciesAskRouteIntent;
    label: string;
    href: string;
};

export type SpeciesAskLayer = {
    kind: SpeciesAskLayerKind;
    title: string;
    body: string;
};

export type SpeciesAskGrounding = {
    slug: string;
    name: string;
    scientificName: string;
    category: string;
    summary: string;
    identification: string[];
    habitat: string;
    nativeRange: string;
    diet: string | null;
    predators: string | null;
    sleepPattern: string | null;
    lifespan: string | null;
    reproduction: string | null;
    sexDifference: string | null;
    interestingFacts: string[];
    behaviorTraits: string[];
    spottingTips: string[];
    principleName: string | null;
    principleExpression: string | null;
    coreLesson: string | null;
    corePattern: string | null;
    biologicalBasis: string | null;
    shortMotto: string | null;
    relatedSpecies: Array<{slug: string; name: string}>;
    relatedLocations: Array<{slug: string; name: string}>;
};

function firstSentence(value: string, max = 140) {
    const trimmed = value.replace(/\s+/g, " ").trim();
    const sentence = trimmed.split(/(?<=[.!?])\s+/)[0] ?? trimmed;
    if (sentence.length <= max) return sentence;
    return `${sentence.slice(0, max).replace(/\s+\S*$/, "").trim()}…`;
}

function lower(value: string) {
    return value.toLowerCase();
}

function uniqueSuggestions(items: SpeciesAskSuggestion[]) {
    const seen = new Set<string>();
    const unique: SpeciesAskSuggestion[] = [];
    for (const item of items) {
        const key = item.prompt.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(item);
    }
    return unique;
}

export function buildSpeciesAskSuggestions(grounding: SpeciesAskGrounding): SpeciesAskSuggestion[] {
    const name = grounding.name;
    const blob = lower([
        grounding.summary,
        grounding.habitat,
        grounding.nativeRange,
        grounding.diet ?? "",
        grounding.sleepPattern ?? "",
        ...grounding.behaviorTraits,
        ...grounding.identification
    ].join(" "));

    const suggestions: SpeciesAskSuggestion[] = [];

    if (/(solitary|alone|independent|lone)/.test(blob)) {
        suggestions.push({label: "Why so solitary?", prompt: `Why are ${name} so solitary?`});
    } else if (/(pack|herd|troop|colony|pod|flock|social|group)/.test(blob)) {
        suggestions.push({label: "Why live in groups?", prompt: `Why do ${name} live in groups?`});
    }

    if (/(tree|canopy|arboreal|branch|climb)/.test(blob)) {
        suggestions.push({label: "Why live in trees?", prompt: `Why do ${name} live in trees?`});
    } else if (/(burrow|underground|den)/.test(blob)) {
        suggestions.push({label: "Why underground?", prompt: `Why do ${name} live underground?`});
    } else if (/(water|ocean|reef|river|aquatic|marine)/.test(blob)) {
        suggestions.push({label: "Why this water habitat?", prompt: `Why are ${name} adapted to water?`});
    } else {
        suggestions.push({
            label: "Why this habitat?",
            prompt: `Why do ${name} live in ${firstSentence(grounding.habitat, 60).replace(/\.$/, "")}?`
        });
    }

    if (/(intelligent|intelligence|brain|learn|tool|problem)/.test(blob)) {
        suggestions.push({label: "How intelligent?", prompt: `How intelligent are ${name}?`});
    }

    if (/(bite|jaw|shell|armor|aggressive|venom|sting|hide)/.test(blob)) {
        suggestions.push({label: "How does it defend itself?", prompt: `How do ${name} defend themselves?`});
    }

    if (/(filter feed|plankton|krill|tiny prey)/.test(blob)) {
        suggestions.push({label: "Why tiny prey?", prompt: `Why does such a large ${name} eat tiny prey?`});
    } else if (grounding.diet) {
        suggestions.push({label: "Why this diet?", prompt: `Why do ${name} eat this way?`});
    }

    suggestions.push({
        label: grounding.principleName ? "What can they teach us?" : "What can we learn?",
        prompt: grounding.principleName
            ? `What can ${name} teach us through ${grounding.principleName}?`
            : `What can ${name} teach us?`
    });

    const related = grounding.relatedSpecies[0];
    if (related) {
        suggestions.push({
            label: `${name} vs ${related.name}`,
            prompt: `${name} vs ${related.name}`
        });
    }

    suggestions.push({
        label: "Where can I see them?",
        prompt: `Where can I see ${name}?`
    });

    return uniqueSuggestions(suggestions).slice(0, 6);
}

function uniqueRoutes(routes: SpeciesAskRoute[], limit = 4) {
    const seen = new Set<string>();
    return routes.filter((route) => {
        if (seen.has(route.href)) return false;
        seen.add(route.href);
        return true;
    }).slice(0, limit);
}

export function inferAskProductRoutes(
    question: string,
    grounding: SpeciesAskGrounding
): SpeciesAskRoute[] {
    const q = lower(question);
    const related = grounding.relatedSpecies[0];
    const location = grounding.relatedLocations[0];
    const wantsWhere = /where|see them|spot|find one|visit|location|range|travel/.test(q);
    const wantsPhoto = /photo|instagram|i(?:'|’)ve (?:seen|photographed)|already (?:seen|captured)/.test(q);

    const routes: SpeciesAskRoute[] = [];

    if (wantsPhoto) {
        routes.push({
            intent: "instagram",
            label: "Check your Instagram wildlife archive",
            href: INSTAGRAM_IMPORT_PATH
        });
    }

    if (related) {
        routes.push({
            intent: "compare",
            label: `Compare ${grounding.name} vs ${related.name}`,
            href: `/comparisons/${buildComparisonSlug(grounding.slug, related.slug)}`
        });
    }

    if (grounding.principleName) {
        routes.push({
            intent: "power",
            label: `Explore ${grounding.name}’s Animal Power`,
            href: "#animal-power"
        });
    }

    routes.push({
        intent: "locations",
        label: location && wantsWhere ? `Explore ${location.name}` : `See where ${grounding.name} live`,
        href: location && wantsWhere ? `/locations/${location.slug}` : "#where"
    });

    routes.push({
        intent: "experiences",
        label: "Find wildlife experiences",
        href: "/wildlife-experiences"
    });

    return uniqueRoutes(routes);
}

export function buildCatalogFallbackAnswer(
    question: string,
    grounding: SpeciesAskGrounding
): {layers: SpeciesAskLayer[]; routes: SpeciesAskRoute[]} {
    const q = lower(question);
    const layers: SpeciesAskLayer[] = [];
    const wantsLesson = /teach|learn|lesson|wisdom|principle|power|apply|my life/.test(q);
    const wantsSymbolism = /symbol|spirit|meaning|totem|cultural/.test(q);
    const wantsWhere = /where|see them|spot|find one|visit|location/.test(q);
    const wantsDiet = /eat|diet|feed|prey|food/.test(q);
    const wantsCompare = /\bvs\b|versus|compar/.test(q);

    const biologyBits: string[] = [];
    if (wantsDiet && grounding.diet) {
        biologyBits.push(grounding.diet);
    } else if (wantsWhere) {
        biologyBits.push(`${grounding.name} is found in ${grounding.nativeRange}. Habitat: ${grounding.habitat}.`);
        if (grounding.spottingTips[0]) biologyBits.push(grounding.spottingTips[0]);
    } else if (wantsCompare && grounding.relatedSpecies[0]) {
        biologyBits.push(`${grounding.summary} Compared with ${grounding.relatedSpecies[0].name}, start from this species’ own biology rather than a generic ranking.`);
    } else {
        biologyBits.push(grounding.summary);
        if (grounding.identification[0]) biologyBits.push(grounding.identification[0]);
        if (grounding.diet) biologyBits.push(grounding.diet);
    }

    layers.push({
        kind: "biology",
        title: SPECIES_ASK_LAYER_META.biology.title,
        body: clampAskLayerBody(biologyBits.filter(Boolean).slice(0, 2).join(" "))
    });

    const whyBody = grounding.corePattern
        || grounding.biologicalBasis
        || `${grounding.name} lives this way because its body, habitat, and feeding strategy fit together.`;
    layers.push({
        kind: "why",
        title: SPECIES_ASK_LAYER_META.why.title,
        body: clampAskLayerBody(whyBody)
    });

    if (wantsLesson && (grounding.coreLesson || grounding.principleName)) {
        layers.push({
            kind: "lesson",
            title: SPECIES_ASK_LAYER_META.lesson.title,
            body: clampAskLayerBody([
                grounding.principleName ? `AnimalDex reads ${grounding.name} through ${grounding.principleName}.` : null,
                grounding.coreLesson
            ].filter(Boolean).join(" "))
        });
    }

    if (wantsSymbolism) {
        layers.push({
            kind: "symbolism",
            title: SPECIES_ASK_LAYER_META.symbolism.title,
            body: clampAskLayerBody(
                grounding.principleName
                    ? `People often attach cultural meaning to ${grounding.name}. AnimalDex keeps that separate from biology: any symbolism here is interpretation, grounded in the ${grounding.principleName} pattern rather than a mystical claim.`
                    : `People often attach cultural meaning to ${grounding.name}. AnimalDex treats symbolism as interpretation, not as a biological fact.`
            )
        });
    }

    return {
        layers,
        routes: inferAskProductRoutes(question, grounding)
    };
}

export function serializeGroundingForModel(grounding: SpeciesAskGrounding) {
    return {
        species: {
            name: grounding.name,
            slug: grounding.slug,
            scientificName: grounding.scientificName,
            category: grounding.category,
            summary: grounding.summary,
            identification: grounding.identification.slice(0, 6),
            habitat: grounding.habitat,
            nativeRange: grounding.nativeRange,
            diet: grounding.diet,
            predators: grounding.predators,
            sleepPattern: grounding.sleepPattern,
            lifespan: grounding.lifespan,
            reproduction: grounding.reproduction,
            sexDifference: grounding.sexDifference,
            interestingFacts: grounding.interestingFacts.slice(0, 5),
            behaviorTraits: grounding.behaviorTraits.slice(0, 6),
            spottingTips: grounding.spottingTips.slice(0, 4)
        },
        animalPower: grounding.principleName ? {
            principleName: grounding.principleName,
            principleExpression: grounding.principleExpression,
            coreLesson: grounding.coreLesson,
            corePattern: grounding.corePattern,
            biologicalBasis: grounding.biologicalBasis,
            shortMotto: grounding.shortMotto
        } : null,
        relatedSpecies: grounding.relatedSpecies.slice(0, 4),
        relatedLocations: grounding.relatedLocations.slice(0, 4)
    };
}

export function askLimitForViewer(viewer: {signedIn: boolean; isPro: boolean}) {
    if (viewer.isPro) return SPECIES_ASK_DAILY_LIMITS.pro;
    if (viewer.signedIn) return SPECIES_ASK_DAILY_LIMITS.signedIn;
    return SPECIES_ASK_DAILY_LIMITS.anonymous;
}

export function clampAskLayerBody(value: string) {
    const trimmed = value.replace(/\s+/g, " ").trim();
    if (trimmed.length <= SPECIES_ASK_LAYER_BODY_MAX) return trimmed;
    return `${trimmed.slice(0, SPECIES_ASK_LAYER_BODY_MAX).replace(/\s+\S*$/, "").trim()}…`;
}
