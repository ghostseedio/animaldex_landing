type CaptureArchetypeInput = {
    animalName: string;
    contextLabel: string | null;
    typeTags: string[];
    rarity: number;
};

const birdWords = ["bird", "owl", "eagle", "hawk", "falcon", "parrot", "duck", "goose", "swan", "penguin", "crow", "raven"];
const predatorWords = ["lion", "tiger", "leopard", "jaguar", "cheetah", "wolf", "fox", "bear", "shark", "orca", "python", "cobra"];

function containsAny(haystack: string, words: string[]) {
    return words.some((word) => haystack.includes(word));
}

function matchesArchetypes(capture: CaptureArchetypeInput): string[] {
    const identity = capture.animalName.toLowerCase();
    const matches: string[] = [];

    switch (capture.contextLabel) {
        case "Wild":
            matches.push("Wild One");
            break;
        case "Zoo":
            matches.push("Zoo Keeper");
            break;
        case "Farm":
            matches.push("Farmer");
            break;
        case "Domestic":
            matches.push("Homesteader");
            break;
        default:
            break;
    }

    if (capture.typeTags.includes("bird") || containsAny(identity, birdWords)) {
        matches.push("Bird Collector");
    }

    if (containsAny(identity, predatorWords)) {
        matches.push("Predator");
    }

    if (capture.rarity >= 45) {
        matches.push("Shiny Hunter");
    }

    return matches;
}

export function resolveCollectionArchetype(captures: CaptureArchetypeInput[]): string {
    if (captures.length < 8) {
        return "Curious Collector";
    }

    const scores = new Map<string, number>();

    for (const capture of captures) {
        for (const archetype of matchesArchetypes(capture)) {
            scores.set(archetype, (scores.get(archetype) ?? 0) + 1);
        }
    }

    const ranked = Array.from(scores.entries()).sort((left, right) => right[1] - left[1]);
    const top = ranked[0];

    if (!top || top[1] < 3) {
        return "Curious Collector";
    }

    const share = top[1] / captures.length;
    const secondScore = ranked[1]?.[1] ?? 0;
    const strongByShare = share >= 0.36;
    const strongByLead = secondScore <= 0 ? top[1] >= 3 : top[1] >= secondScore * 1.55;

    return strongByShare || strongByLead ? top[0] : "Curious Collector";
}
