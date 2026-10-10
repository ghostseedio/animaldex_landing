/**
 * Animal level curve. Level L needs ceil((L-1)^2 / 4) XP, so
 * level = isqrt(4 * XP) + 1, capped at 100. Mirrors iOS AnimalProgressionCurve,
 * Android progressionLevelForXp and `send_capture_gift` exactly.
 */
export const MAX_ANIMAL_LEVEL = 100;

function integerSquareRoot(value: number) {
    let root = Math.floor(Math.sqrt(value));
    while (root * root > value) root -= 1;
    while ((root + 1) * (root + 1) <= value) root += 1;
    return root;
}

export function animalLevel(totalProgressionXP: number) {
    const xp = Math.max(0, Math.floor(Number.isFinite(totalProgressionXP) ? totalProgressionXP : 0));
    return Math.min(MAX_ANIMAL_LEVEL, integerSquareRoot(4 * xp) + 1);
}

export function xpForAnimalLevel(level: number) {
    const steps = Math.min(MAX_ANIMAL_LEVEL, Math.max(1, Math.floor(level))) - 1;
    return Math.floor((steps * steps + 3) / 4);
}

export const MAX_ANIMAL_LEVEL_XP = xpForAnimalLevel(MAX_ANIMAL_LEVEL);
