/**
 * ARK-JUNGLE (coordinator 2026-11-20): a young one carried by its mother is never drawn without her. When the live
 * budget rests the mother out of sight (`runtime.outside`), her carried young rests with her: it leaves the drawn set.
 */
export function keepCarriedWithMothers(outside: Set<string>, carriedBy: (id: string) => string | null): Set<string> {
    for (const id of Array.from(outside)) {
        const mother = carriedBy(id);
        if (mother && !outside.has(mother)) outside.delete(id);
    }
    return outside;
}
