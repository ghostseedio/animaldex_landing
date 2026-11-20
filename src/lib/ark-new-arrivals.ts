/**
 * The animals that came aboard between two snapshots: arrivals only, never the young born on the Ark (the
 * page's "new arrival" notice).
 */
export function arkNewArrivals<T extends {id: string; origin?: "arrived" | "born"}>(before: ReadonlyArray<{id: string}>, next: readonly T[]): T[] {
    const known = new Set(before.map((animal) => animal.id));
    return next.filter((animal) => !known.has(animal.id) && animal.origin !== "born");
}
