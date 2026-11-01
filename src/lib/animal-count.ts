import catalogCount from "@/data/catalog-animal-count.json";

/**
 * How many animals AnimalDex has: the catalog the Talk picker lists, from the
 * checked-in snapshot (scripts/refreshSpeciesPowerSnapshot.mts). The one count
 * every page quotes (WEB-29), so the home page, How it works, the share cards
 * and the comparisons hub never disagree.
 */
export const CATALOG_ANIMAL_COUNT: number = catalogCount.catalogAnimals;

/** Rounded down to the hundred, for copy: 2,615 → 2,600. */
export const ROUNDED_ANIMAL_COUNT = Math.floor(CATALOG_ANIMAL_COUNT / 100) * 100;

/** "2,600" in the reader's number format ("2.600" in Indonesian). */
export function formatAnimalCount(locale = "en"): string {
    return ROUNDED_ANIMAL_COUNT.toLocaleString(locale === "id" ? "id-ID" : "en-US");
}
