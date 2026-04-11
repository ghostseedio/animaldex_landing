import type {SpeciesEntry} from "@/data/species";

export type SpeciesDietContent = {
    summary: string;
    foods: string[];
    note: string;
};

const SPECIES_DIET_OVERRIDES: Record<string, SpeciesDietContent> = {
    "white-headed-vulture": {
        summary: "White-headed vultures mainly eat carrion. They feed on animal remains rather than hunting most live prey and often search widely for carcasses in open African landscapes.",
        foods: [
            "Carcasses of medium and large mammals",
            "Soft tissue and scraps at fresh kills",
            "Animal remains found before or alongside other scavengers"
        ],
        note: "Food access depends on carcass availability, competition, and healthy wild herbivore populations across large ranges."
    },
    "komodo-dragon": {
        summary: "Komodo dragons are carnivores that eat large prey, carrion, and smaller animals they can overpower. They are opportunistic feeders built for ambush and heavy meat consumption.",
        foods: [
            "Deer, wild pigs, and other sizable vertebrates",
            "Carrion from dead animals",
            "Eggs, smaller reptiles, and juvenile mammals when available"
        ],
        note: "Diet shifts with age and body size, with younger dragons taking smaller prey and adults handling much larger meals."
    },
    "maine-coon-cat": {
        summary: "Maine Coon cats do best on a protein-rich domestic cat diet. Like other cats, they are meat-focused and not adapted to thrive on plant-heavy food alone.",
        foods: [
            "Complete meat-based cat food",
            "Animal protein from poultry, fish, or other balanced cat-safe sources",
            "Occasional small prey in outdoor settings such as rodents or birds"
        ],
        note: "A pet Maine Coon's healthiest diet is managed by owners, while outdoor hunting behavior can still reflect natural feline instincts."
    },
    "bald-eagle": {
        summary: "Bald eagles mainly eat fish, but they are also opportunistic predators and scavengers. Their diet changes with season, local water access, and what prey is easiest to capture.",
        foods: [
            "Fish taken from lakes, rivers, estuaries, and coasts",
            "Waterbirds and small mammals",
            "Carrion and stolen prey when the opportunity is efficient"
        ],
        note: "The closer a bald eagle lives to productive water, the more fish usually dominates its diet."
    },
    "african-wild-dog": {
        summary: "African wild dogs are carnivores that rely on cooperative hunting. They mainly eat medium-sized mammals and use pack coordination to catch fast-moving prey.",
        foods: [
            "Antelope and other medium ungulates",
            "Young or vulnerable mammals caught during hunts",
            "Occasional smaller animals when larger prey is scarce"
        ],
        note: "Pack size, prey density, and open hunting ground strongly influence what an African wild dog pack eats."
    },
    "crow": {
        summary: "Crows are omnivores with a very flexible diet. They eat whatever reliable food sources are available across wild, rural, and urban habitats.",
        foods: [
            "Insects, larvae, and other invertebrates",
            "Seeds, grain, fruit, and nuts",
            "Eggs, scraps, carrion, and human food waste"
        ],
        note: "This dietary flexibility is one reason crows stay successful in both natural and human-shaped environments."
    },
    "barn-owl": {
        summary: "Barn owls mainly eat small mammals. They are specialized nocturnal hunters that use sound to find prey moving through grass, fields, and rough ground.",
        foods: [
            "Mice, voles, and rats",
            "Small shrews and similar mammals",
            "Occasional small birds, reptiles, or amphibians"
        ],
        note: "Local prey supply can change quickly with farming patterns, weather, and seasonal rodent abundance."
    },
    "chameleon": {
        summary: "Most chameleons are insect-eaters that hunt by waiting, aiming, and striking with a rapid tongue. Their diet centers on live prey small enough to swallow whole.",
        foods: [
            "Insects such as crickets, flies, beetles, and grasshoppers",
            "Spiders and other small invertebrates",
            "Occasional larger prey for bigger species"
        ],
        note: "Food choice depends on body size, habitat structure, and how much moving prey is available in the vegetation."
    },
    "crocodile": {
        summary: "Crocodiles are carnivores that eat whatever animal prey they can ambush and overpower. Larger individuals take larger prey, while younger crocodiles start with much smaller meals.",
        foods: [
            "Fish, amphibians, and aquatic animals",
            "Birds and mammals that approach the water's edge",
            "Carrion or larger prey items when size and opportunity allow"
        ],
        note: "Diet changes sharply with age, body size, and the kind of wetland or shoreline habitat the crocodile controls."
    }
};

function hasKeyword(value: string, pattern: RegExp) {
    return pattern.test(value.toLowerCase());
}

function buildCategoryFallback(entry: SpeciesEntry): SpeciesDietContent {
    const name = entry.name;
    const category = entry.analysis.category.toLowerCase();
    const habitat = entry.analysis.habitat.toLowerCase();
    const nameKey = `${entry.slug} ${entry.name}`.toLowerCase();

    if (hasKeyword(nameKey, /vulture/)) {
        return {
            summary: `${name} mainly eats carrion and other animal remains. It is built for scavenging rather than depending on frequent direct kills.`,
            foods: [
                "Carcasses of mammals and other vertebrates",
                "Soft tissue and scraps left at kills",
                "Animal remains found across open country"
            ],
            note: `Food access rises and falls with carcass availability and how easy it is to search ${entry.analysis.habitat.toLowerCase()}.`
        };
    }

    if (hasKeyword(nameKey, /eagle|hawk|falcon|owl|raptor/)) {
        const fishFirst = habitat.includes("river") || habitat.includes("lake") || habitat.includes("coast") || habitat.includes("water");

        return {
            summary: `${name} is a carnivorous bird of prey that feeds on animal food captured or scavenged in its hunting range.`,
            foods: fishFirst
                ? ["Fish and other aquatic prey", "Birds and small mammals", "Carrion when it is easy to access"]
                : ["Small mammals and birds", "Reptiles, amphibians, or insects depending on size", "Carrion when the opportunity is efficient"],
            note: "Prey choice changes with season, hunting habitat, and how much energy the bird spends to secure each meal."
        };
    }

    if (hasKeyword(nameKey, /crow|raven|rook|jackdaw|corvid/)) {
        return {
            summary: `${name} is an omnivore that eats a wide mix of animal and plant food. Its success comes partly from being able to switch food sources quickly.`,
            foods: [
                "Insects and other invertebrates",
                "Seeds, fruit, nuts, and grain",
                "Eggs, scraps, or carrion when available"
            ],
            note: "Urban access, season, and local competition all shape what this bird eats on a given day."
        };
    }

    if (category.includes("bird of prey")) {
        return {
            summary: `${name} mainly eats animal prey and uses vision, stealth, speed, or soaring to locate feeding opportunities.`,
            foods: [
                "Small mammals or birds",
                "Fish, reptiles, or amphibians depending on habitat",
                "Carrion when scavenging is efficient"
            ],
            note: "A raptor's diet usually tracks local prey density more than a fixed menu."
        };
    }

    if (category.includes("bird")) {
        return {
            summary: `${name} usually eats a mixed bird diet shaped by habitat, season, and bill function. Many birds combine animal protein with seeds, fruit, or other plant material.`,
            foods: [
                "Insects and other small invertebrates",
                "Seeds, grain, fruit, or nectar depending on species",
                "Occasional small vertebrates, eggs, or scavenged food"
            ],
            note: "Breeding season often increases the need for protein-rich prey even in birds that eat more plant material at other times."
        };
    }

    if (hasKeyword(nameKey, /komodo|dragon|monitor|crocodile|alligator|caiman/)) {
        return {
            summary: `${name} is a carnivorous reptile that eats animal prey it can overpower or scavenge. Larger individuals usually take larger meals.`,
            foods: [
                "Fish, reptiles, birds, or mammals depending on size",
                "Eggs and smaller vertebrates",
                "Carrion when available"
            ],
            note: "Reptile feeding frequency often depends on temperature, body size, and how much prey is present nearby."
        };
    }

    if (hasKeyword(nameKey, /chameleon|gecko|anole|lizard|iguana|skink/)) {
        return {
            summary: `${name} usually eats small live prey, especially invertebrates. Movement, size, and perch access strongly shape what it can catch.`,
            foods: [
                "Insects such as flies, beetles, crickets, and moths",
                "Spiders and other invertebrates",
                "Occasional larger prey for bigger species"
            ],
            note: "The best feeding areas are usually places with enough cover, warmth, and insect activity."
        };
    }

    if (category.includes("reptile")) {
        return {
            summary: `${name} follows a reptile diet shaped by body size and habitat. Many reptiles take animal prey, though exact feeding strategy varies widely by species.`,
            foods: [
                "Insects or other invertebrates",
                "Fish, amphibians, eggs, or small vertebrates",
                "Larger prey items when body size allows"
            ],
            note: "Because reptiles use environmental heat, feeding pace can rise or fall with temperature and season."
        };
    }

    if (hasKeyword(nameKey, /cat|lynx|tiger|lion|leopard|jaguar|cheetah/)) {
        return {
            summary: `${name} depends mostly on animal protein. Cats are meat-focused hunters, even when they live in domestic settings rather than wild ones.`,
            foods: [
                "Meat-based prey or complete meat-forward domestic food",
                "Small mammals and birds when hunting is possible",
                "Animal tissue rather than plant-heavy food sources"
            ],
            note: "Wild context, owner care, and access to outdoor prey all affect exactly what an individual cat eats."
        };
    }

    if (hasKeyword(nameKey, /dog|wolf|fox|jackal|wild dog|canid/)) {
        return {
            summary: `${name} leans heavily toward animal prey but can be opportunistic when needed. Canids often balance endurance, cooperation, and local food availability.`,
            foods: [
                "Mammals and other vertebrate prey",
                "Smaller animals that are easier to catch",
                "Occasional scavenged food depending on context"
            ],
            note: "Pack behavior, territory size, and competition shape how much energy a canid spends to secure food."
        };
    }

    if (category.includes("domestic breed")) {
        return {
            summary: `${name} usually eats a managed domestic diet rather than finding all food in the wild. The healthiest diet depends on the species and its body design.`,
            foods: [
                "Balanced domestic food appropriate to the species",
                "Protein, fat, and nutrients matched to age and health",
                "Occasional natural prey behavior if the animal roams outdoors"
            ],
            note: "Domestic feeding is driven more by human care than by the full wild food web."
        };
    }

    if (category.includes("mammal")) {
        return {
            summary: `${name} has a mammal diet shaped by anatomy, habitat, and competition. The exact food mix depends on whether the species is built more for hunting, grazing, browsing, or omnivory.`,
            foods: [
                "Plant material, prey, or both depending on species design",
                "Seasonally abundant foods in the local habitat",
                "Higher-value foods that match energy demands"
            ],
            note: `The food available in ${entry.analysis.habitat.toLowerCase()} often matters as much as the species' ideal diet.`
        };
    }

    return {
        summary: `${name} eats the foods its body design and habitat make easiest to access. Diet can shift across seasons, life stages, and local competition.`,
        foods: [
            "The most accessible prey or plant foods in its habitat",
            "Energy-rich foods that match its size and behavior",
            "Seasonal resources available in the local environment"
        ],
        note: `A practical answer for ${name} always depends on what food is actually available in ${habitat}.`
    };
}

export function getSpeciesDietContent(entry: SpeciesEntry): SpeciesDietContent {
    return SPECIES_DIET_OVERRIDES[entry.slug] ?? buildCategoryFallback(entry);
}
