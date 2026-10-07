import type {SpeciesEntry} from "@/data/species";
import type {SpeciesStats} from "@/lib/battle-tier";

/*
 * Pure, synchronous stat estimate from a species' own text. Kept apart from
 * species-stats.ts, which reaches the database, so static data modules such
 * as rankings.ts (and every blog post that quotes a tier list) stay free of
 * server-only imports.
 */

function clampStatValue(value: number) {
    return Math.max(1, Math.min(100, Math.round(value)));
}

export function buildDeterministicCanonicalStats(entry: SpeciesEntry): SpeciesStats {
    const category = entry.analysis.category.toLowerCase();
    const description = [
        entry.name,
        entry.analysis.summary,
        entry.analysis.habitat,
        entry.analysis.nativeRange,
        ...entry.analysis.identification
    ]
        .join(" ")
        .toLowerCase();
    const hash = Array.from(entry.slug).reduce((accumulator, character) => accumulator + character.charCodeAt(0), 0);
    const jitter = (offset: number) => ((hash + offset * 17) % 11) - 5;
    const hasKeyword = (pattern: RegExp) => pattern.test(description) || pattern.test(category);
    const rarity = clampStatValue(entry.analysis.rarityScore);

    let dominance = 42;
    let speed = 40;
    let size = 34;
    let intelligence = 32;

    if (hasKeyword(/primate/)) {
        dominance += 10;
        intelligence += 28;
        speed += 8;
        size += 8;
    } else if (hasKeyword(/bird of prey|raptor|eagle|falcon|owl/)) {
        dominance += 22;
        speed += 18;
        size += 10;
        intelligence += 10;
    } else if (hasKeyword(/bird|penguin|parrot|hummingbird/)) {
        dominance += 2;
        speed += 20;
        size -= 4;
        intelligence += 8;
    } else if (hasKeyword(/mammal|cat|dog|fox|wolf|bear|seal|whale|elephant|deer|antelope/)) {
        dominance += 14;
        speed += 8;
        size += 14;
        intelligence += 10;
    } else if (hasKeyword(/reptile|snake|lizard|crocodile|turtle|tortoise/)) {
        dominance += 16;
        speed -= 6;
        size += 10;
        intelligence -= 4;
    } else if (hasKeyword(/fish|shark|ray|eel|tuna/)) {
        dominance += 12;
        speed += 14;
        size += 4;
    } else if (hasKeyword(/amphibian|frog|toad|salamander|newt/)) {
        dominance -= 4;
        speed -= 6;
        size -= 10;
    } else if (hasKeyword(/insect|beetle|ant|wasp|moth|butterfly|spider|octopus|jellyfish|clam|crab/)) {
        dominance -= 10;
        speed -= 4;
        size -= 16;
        intelligence -= 4;
    }

    const isDiggingClaw = hasKeyword(/digging claw|burrowing claw|digging foreclaw|root-snuff|leaf-litter root/);
    const isGentleProfile = hasKeyword(/herbivore|insectivore|gentle|shy|timid|docile|burrow|browser|grazer|filter feed|flightless|glider|pangolin|bilby|kakapo|anteater|aardvark|bandicoot|quenda|tortoise|basking|manatee|sloth|koala|fruit-and-insect|root-snuff|insect-eating drill|armored curling|floating tree-shadow|bamboo-feed|bamboo stem|bamboo shoot|panda|peafowl|peacock|swan|pelican|condor|stork|butterfly|moth|dragonfly|whip scorpion|wheel bug|praying mantis|water bug|flying frog|sea turtle|domestic worldwide|felis catus|home, garden|companion|peaceful simple|slow deliberate|soft-footed ambush pouncer/);

    if (hasKeyword(/apex|predator|hunter|ambush|venom|fang|talon|stalk|kills/) && !isDiggingClaw && !isGentleProfile) {
        dominance += 18;
    } else if (hasKeyword(/claw|talon/) && !isDiggingClaw && !isGentleProfile) {
        dominance += 8;
    }

    if (isGentleProfile) {
        dominance -= 18;
        size -= 6;
    }

    if (isDiggingClaw) {
        dominance -= 10;
    }

    if (hasKeyword(/fast|swift|speed|quick|sprint|dart|dive|leap|glide|soar|arrow|torpedo/)) {
        speed += 18;
    }

    if (hasKeyword(/slow|patient|still|drift|bask|wait|gentle/)) {
        speed -= 12;
    }

    if (hasKeyword(/giant|huge|largest|massive|towering|enormous|biggest/)) {
        size += 28;
        dominance += 10;
        speed -= 4;
    }

    if (hasKeyword(/small|tiny|little|mini|compact|pocket-sized/)) {
        size -= 20;
        speed += 6;
        dominance -= 8;
    }

    if (hasKeyword(/smart|intelligent|problem|tool|memory|social|thinking|clever|learn/)) {
        intelligence += 22;
    }

    if (hasKeyword(/armor|armored|shield|shell|fortress/)) {
        dominance += 8;
        size += 4;
    }

    return {
        dominance: clampStatValue(dominance + jitter(1)),
        speed: clampStatValue(speed + jitter(2)),
        size: clampStatValue(size + jitter(3)),
        intelligence: clampStatValue(intelligence + jitter(4)),
        rarity
    };
}
