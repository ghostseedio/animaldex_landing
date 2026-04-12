import type {SpeciesEntry} from "@/data/species";

export type SpeciesSpottingContent = {
    summary: string;
    locations: string[];
    tips: string[];
};

function hasKeyword(value: string, pattern: RegExp) {
    return pattern.test(value.toLowerCase());
}

function sentenceCase(value: string) {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

function lowerFirst(value: string) {
    return value.charAt(0).toLowerCase() + value.slice(1);
}

function splitClauses(value: string) {
    return value
        .split(/,| and /gi)
        .map((item) => item.trim())
        .filter(Boolean);
}

function unique(items: string[]) {
    return Array.from(new Set(items));
}

function getLocationExamples(entry: SpeciesEntry) {
    const habitat = entry.analysis.habitat.toLowerCase();
    const category = entry.analysis.category.toLowerCase();
    const nameKey = `${entry.slug} ${entry.name} ${entry.analysis.summary} ${entry.analysis.identification.join(" ")}`.toLowerCase();
    const examples: string[] = [];

    if (hasKeyword(habitat, /(marsh|wetland|swamp|reedbed|floodplain|estuary|mangrove|river|lake|pond|lagoon)/)) {
        examples.push("quiet marsh edges, reedbeds, river bends, or shallow wetland margins");
    }

    if (hasKeyword(habitat, /(forest|rainforest|woodland|canopy|thicket|jungle|scrub forest|evergreen)/)) {
        examples.push("forest edge, canopy gaps, fruiting trees, or shaded trails where cover and food meet");
    }

    if (hasKeyword(habitat, /(mountain|alpine|cliff|ridge|highland|plateau|rocky slope|escarpment)/)) {
        examples.push("rocky slopes, ridge lines, cliff ledges, or open mountain meadows with a wide view");
    }

    if (hasKeyword(habitat, /(grassland|savannah|prairie|plain|steppe|meadow|veld|open country)/)) {
        examples.push("open grassland edges, lightly wooded plains, or raised ground where you can scan long distances");
    }

    if (hasKeyword(habitat, /(desert|arid|dune|wadi|semi-desert|thorn scrub|dry scrub)/)) {
        examples.push("water sources, dune bases, rocky wadis, or shaded scrub at first and last light");
    }

    if (hasKeyword(habitat, /(coast|coastal|ocean|sea|pelagic|reef|island|shore|seabed)/) || category.includes("marine")) {
        examples.push("headlands, reef edges, island colonies, tidal channels, or productive coastal water");
    }

    if (hasKeyword(nameKey, /(burrow|tunnel|hole|prairie dog colony|underground)/)) {
        examples.push("burrow systems, sandy banks, fallen logs, or ground with clear den entrances");
    }

    if (hasKeyword(nameKey, /(bask|sun|perch|branch|tree-trunk|log)/)) {
        examples.push("sunlit logs, exposed branches, warm rocks, or regular perch sites used for scanning");
    }

    if (examples.length === 0) {
        const habitatClauses = splitClauses(entry.analysis.habitat);

        if (habitatClauses.length > 0) {
            examples.push(`${habitatClauses.slice(0, 3).map(lowerFirst).join(", ")}`);
        }
    }

    examples.push(`protected habitat blocks within ${lowerFirst(entry.analysis.nativeRange)}`);

    return unique(examples).slice(0, 3);
}

function getTimingTip(entry: SpeciesEntry) {
    const text = `${entry.analysis.summary} ${entry.analysis.identification.join(" ")}`.toLowerCase();

    if (hasKeyword(text, /(night|nocturnal|after dark|dusk|twilight|moonlit)/)) {
        return "Go at dusk or after dark, move slowly, and listen before using a light or stepping into cover.";
    }

    if (hasKeyword(text, /(dawn|morning|sunrise|early light)/)) {
        return "Be in position before sunrise so you can catch early feeding or movement before disturbance builds.";
    }

    if (hasKeyword(text, /(bask|sun|warming|perch hunting|perch|soaring)/)) {
        return "Early sun and calm weather usually give the best chance of seeing normal basking, perched, or soaring behavior.";
    }

    if (hasKeyword(entry.analysis.habitat, /(wetland|marsh|river|lake|coast|estuary|shore)/)) {
        return "First light and late afternoon are often best, when animals come out to feed along the edge of water.";
    }

    return "Start early, pick one strong patch of habitat, and stay long enough for movement to return after you arrive.";
}

function getFieldTips(entry: SpeciesEntry) {
    const habitat = entry.analysis.habitat.toLowerCase();
    const category = entry.analysis.category.toLowerCase();
    const nameKey = `${entry.slug} ${entry.name} ${entry.analysis.summary} ${entry.analysis.identification.join(" ")}`.toLowerCase();
    const tips: string[] = [];

    tips.push(getTimingTip(entry));

    if (hasKeyword(habitat, /(forest|rainforest|woodland|canopy|thicket|jungle)/)) {
        tips.push("Work edges, clearings, fruiting trees, and stream crossings rather than walking randomly through dense cover.");
    } else if (hasKeyword(habitat, /(grassland|savannah|prairie|plain|steppe|meadow)/)) {
        tips.push("Use binoculars from a track, ridge, or vehicle stop and scan far ahead before you move closer.");
    } else if (hasKeyword(habitat, /(mountain|alpine|cliff|ridge|highland|plateau)/)) {
        tips.push("Scan from a stable vantage point first; in steep country, patient glassing usually beats constant hiking.");
    } else if (hasKeyword(habitat, /(marsh|wetland|swamp|reedbed|river|lake|pond|lagoon|estuary)/)) {
        tips.push("Watch the transition line between open water and cover, because feeding and movement often happen on that edge.");
    } else if (hasKeyword(habitat, /(desert|arid|dune|wadi|scrub)/)) {
        tips.push("Check shaded cover, water points, and cooler hours, because many dry-country animals avoid peak heat.");
    } else if (hasKeyword(habitat, /(coast|coastal|ocean|sea|reef|island|shore)/) || category.includes("marine")) {
        tips.push("Time your search around tide, wind, and visibility, then focus on feeding lines, reef edges, and known haul-out or nesting spots.");
    } else {
        tips.push("Look for food, cover, and movement routes in the same place, because the best sightings usually happen where those overlap.");
    }

    if (hasKeyword(nameKey, /(owl|cat|fox|lynx|leopard|jaguar|civet|mongoose|ferret|quoll|marten|sloth|frogmouth|potoo)/)) {
        tips.push("Slow down and scan shapes, outlines, and eye-level silhouettes; many good sightings come from noticing what does not move.");
    } else if (category.includes("bird") || category.includes("bird of prey")) {
        tips.push("Use sound, flight lines, and perch trees as clues; birds often reveal themselves before they sit in the open.");
    } else if (category.includes("reptile") || category.includes("amphibian")) {
        tips.push("Warm rocks, trail edges, fallen timber, and quiet water margins are usually better than heavily disturbed ground.");
    } else if (category.includes("fish") || category.includes("marine")) {
        tips.push("Choose a viewing point with clean light and water visibility, then watch for repeated surfacing, feeding, or current lines.");
    } else {
        tips.push("Move quietly, stop often, and give the habitat time to settle; many mammals and insects show themselves only after the first pause.");
    }

    return tips.slice(0, 3);
}

function buildDomesticSpotting(entry: SpeciesEntry): SpeciesSpottingContent {
    return {
        summary: `A truly wild ${entry.name} is uncommon. Your best real-world chance is to look for free-roaming, feral, or semi-wild populations in places where people, shelter, and food sources overlap.`,
        locations: [
            `farm edges, village margins, or working landscapes within ${lowerFirst(entry.analysis.nativeRange)}`,
            "ports, alleys, barns, or outbuildings where human food and cover are both available",
            "quiet early-morning or evening areas before regular activity pushes animals back into cover"
        ],
        tips: [
            "Search where food, water, and hiding cover all exist together instead of expecting truly remote wilderness sightings.",
            "Look for tracks, droppings, resting spots, and repeated movement routes before expecting a direct view.",
            "Keep distance and never bait, corner, or approach animals that are already used to human spaces."
        ]
    };
}

function buildFallbackSpotting(entry: SpeciesEntry): SpeciesSpottingContent {
    const locations = getLocationExamples(entry);

    return {
        summary: `To find ${entry.name} in the wild, focus on the exact habitat patches that match its body design and daily behavior, not just the broad country where it exists. You usually do better by working one good piece of habitat inside ${lowerFirst(entry.analysis.nativeRange)} than by covering too much ground.`,
        locations,
        tips: getFieldTips(entry)
    };
}

export function getSpeciesSpottingContent(entry: SpeciesEntry): SpeciesSpottingContent {
    if (entry.analysis.category.toLowerCase().includes("domestic breed")) {
        return buildDomesticSpotting(entry);
    }

    return buildFallbackSpotting(entry);
}
