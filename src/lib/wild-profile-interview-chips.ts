/**
 * Quick-answer chips for the Wild Profile interview.
 *
 * Verbatim port of WildProfileInterviewChips.swift in the iOS repo: the chip
 * row under the composer is chosen from keywords in the current question.
 */

export type WildProfileQuickChip = {
    id: string;
    label: string;
    insertText: string;
};

function chip(id: string, label: string, insertText: string): WildProfileQuickChip {
    return {id, label, insertText};
}

const habitat = [
    chip("forest", "Forest", "Forest"),
    chip("ocean", "Ocean", "Ocean"),
    chip("mountain", "Mountain", "Mountain"),
    chip("desert", "Desert", "Desert"),
    chip("grassland", "Grassland", "Grassland"),
    chip("snow", "Snow", "Snow"),
    chip("city", "City edge", "City edge"),
    chip("jungle", "Jungle", "Jungle")
];

const food = [
    chip("plants", "Plants", "Mostly plants — herbivore style"),
    chip("meat", "Meat", "Mostly meat — carnivore style"),
    chip("everything", "Everything", "Omnivore — a bit of everything"),
    chip("fruit", "Fruit", "Fruit and nectar style"),
    chip("fish", "Fish", "Fish and water food"),
    chip("insects", "Insects", "Small prey / insects")
];

const defense = [
    chip("speed", "Speed", "Speed"),
    chip("stealth", "Stealth", "Stealth"),
    chip("armor", "Armor", "Armor"),
    chip("group", "Group", "Group teamwork"),
    chip("intelligence", "Intelligence", "Intelligence"),
    chip("climb", "Climb", "Climb to safety"),
    chip("hide", "Hide", "Hide")
];

const social = [
    chip("solo", "Solo", "Solo wanderer"),
    chip("pair", "Pair", "Pair bond"),
    chip("small", "Small group", "Small group"),
    chip("big", "Big group", "Big group / pack")
];

const movement = [
    chip("run", "Run", "Run"),
    chip("swim", "Swim", "Swim"),
    chip("fly", "Fly", "Fly"),
    chip("climb", "Climb", "Climb"),
    chip("dig", "Dig", "Dig"),
    chip("wait", "Wait still", "Wait perfectly still")
];

const climate = [
    chip("hot", "Hot", "Hot countries"),
    chip("cold", "Cold", "Cold countries"),
    chip("any", "Any weather", "Any weather works")
];

const instinct = [
    chip("curious", "Curious", "Curious"),
    chip("loyal", "Loyal", "Loyal"),
    chip("playful", "Playful", "Playful"),
    chip("bold", "Bold", "Bold"),
    chip("patient", "Patient", "Patient"),
    chip("protective", "Protective", "Protective")
];

const timeOfDay = [
    chip("sunrise", "Sunrise", "Sunrise"),
    chip("midday", "Midday", "Midday"),
    chip("dusk", "Dusk", "Dusk"),
    chip("midnight", "Midnight", "Midnight"),
    chip("anytime", "Anytime", "Anytime")
];

const pressure = [
    chip("sharper", "Sharper", "Sharper under pressure"),
    chip("quieter", "Quieter", "Quieter under pressure"),
    chip("faster", "Faster", "Faster under pressure"),
    chip("tougher", "Tougher", "Tougher under pressure"),
    chip("social", "More social", "More social under pressure"),
    chip("solo", "More independent", "More independent under pressure")
];

export const wildProfileInterviewChips = {habitat, food, defense, social, movement, climate, instinct, timeOfDay, pressure};

function containsAny(text: string, needles: string[]) {
    return needles.some((needle) => text.includes(needle));
}

export function suggestedWildProfileChips(questionText: string): WildProfileQuickChip[] {
    const lower = questionText.toLowerCase();
    if (containsAny(lower, ["forest", "ocean", "mountain", "habitat", "wild place", "terrain", "grassland", "jungle", "snow"])) {
        return habitat;
    }
    if (containsAny(lower, ["herbivore", "carnivore", "omnivore", "food", "eat", "diet", "scavenger", "fruit", "nectar"])) {
        return food;
    }
    if (containsAny(lower, ["defense", "danger", "protect", "camouflage", "stealth", "armor"])) {
        return defense;
    }
    if (containsAny(lower, ["pack", "solo", "group", "herd", "pair", "social"])) {
        return social;
    }
    if (containsAny(lower, ["run", "swim", "fly", "climb", "dig", "move", "built to", "glide", "wait"])) {
        return movement;
    }
    if (containsAny(lower, ["hot", "cold", "climate", "weather", "tropical", "winter"])) {
        return climate;
    }
    if (containsAny(lower, ["curious", "loyal", "playful", "bold", "patient", "instinct", "gentle", "protective", "clever"])) {
        return instinct;
    }
    if (containsAny(lower, ["night", "day", "dusk", "sunrise", "midnight", "twilight"])) {
        return timeOfDay;
    }
    if (containsAny(lower, ["pressure", "hard day"])) {
        return pressure;
    }
    return [];
}

/** Mirrors the iOS chip tap: fill an empty composer, otherwise append once. */
export function applyWildProfileChip(current: string, selected: WildProfileQuickChip): string {
    if (!current.trim()) {
        return selected.insertText;
    }
    const prefix = selected.insertText.slice(0, 12).toLowerCase();
    if (current.toLowerCase().includes(prefix)) {
        return current;
    }
    return `${current}${current.endsWith(" ") ? "" : " "}${selected.insertText}`;
}
