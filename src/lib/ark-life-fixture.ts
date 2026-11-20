/**
 * Development only (`/ark?fixture=1&lifespans=1`): the v2 fixture carries no lifespans, so its cards show no life bar
 * and no chance heart. This lays a lifespan on the kinds whose published field guide gives a number
 * (`src/data/published-seo-animal-pages.json`, `databaseSource.fieldGuide.lifespanEstimate`), in Ark days (1 year =
 * 365), low and high as the guide states them. Never used by a live read; the server's `lifespan_days` is the truth.
 */
const YEAR = 365;

/** slug: [low years, high years], each from its field guide's own words (quoted beside it). */
const FIELD_GUIDE_YEARS: Record<string, [number, number]> = {
    // "Usually 7 to 10 years in the wild, with a few reaching about 15."
    "roe-deer": [7, 10],
    // "Usually 6 to 8 years in the wild, with few passing 10 to 12"
    "eurasian-wolf": [6, 8],
    // "5 to 10 years in the wild when conditions are good."
    mallard: [5, 10],
    // "Goats may live 10 to 15 years or more with care"
    "domestic-goat": [10, 15],
    // "Many dogs live about 10 to 15 years depending on size and health"
    "domestic-dog": [10, 15],
    // "Many cats live 12 to 18 years or more with care"
    "domestic-cat": [12, 18],
    // "Commonly up to about 15 to 20 years"
    "atlantic-herring": [15, 20],
    // "Typically about 3 to 5 years"
    "acorn-barnacle": [3, 5]
};

type Raw = Record<string, unknown>;

export function withArkLifeFixture<T>(raw: T): T {
    const copy = JSON.parse(JSON.stringify(raw)) as Raw;
    const animals = Array.isArray(copy.animals) ? (copy.animals as Raw[]) : [];
    for (const animal of animals) {
        const years = FIELD_GUIDE_YEARS[String(animal.model_slug ?? "")];
        if (!years) continue;
        animal.lifespan_days = years[0] * YEAR;
        animal.lifespan_days_hi = years[1] * YEAR;
        animal.lifespan_estimate = false;
    }
    return copy as unknown as T;
}
