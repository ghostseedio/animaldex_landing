/**
 * Signature behaviours, wave 2, birds: the part of `ark-signature-recipes.mts` that handles the bird rows wave 1 held
 * (their recipe was written for another body plan: a pounce for a four-legged hunter, a crawling cluster of bugs, a
 * sea otter's stone). The rows are in `data/ark/signature-birds.json`, each with the catalogue's field, exact sentence and
 * log line (AnimalDex docs/ark/signature-behaviours.json). Applied idempotently to:
 *
 * - `src/ark-scene/recipes.json`: the bird recipe (`perch_drop`, `roost_gather`, `anvil_smash`, ...) on the species' row,
 *   a nest field where the row's sentence gives one (a cavity of twigs);
 * - `src/ark-scene/sleep.json` and `data/ark/sleep-styles.json`: a communal roost's species sleep together in a row;
 * - `src/ark-scene/signature-lines.json`: the species' own sentence in the live log, for the recipes that make an episode
 *   (not the flock-only roost, not a sentence that names a sex, a season or a time of day: those wait for the log to check).
 *
 * Nothing here is generated from a guess: a row is a species whose own stored text states the behaviour.
 */
import fs from "node:fs";
import path from "node:path";

export type BirdRow = {
    slug: string;
    name: string;
    was: string;
    recipe: string;
    behaviour: string;
    field: string;
    quote: string;
    catalogueId: string;
    when: string;
    line: string | null;
    note?: string;
    nest?: string;
    sleep?: string;
    maleSits?: boolean;
    already?: boolean;
};

/**
 * The templates new with this wave, for the guard of the wave-1 script (a recipe goes only on a body plan that already
 * uses it, or one stated here) and the weight they take (ninths: 6 is a bird's usual).
 */
export const BIRD_TEMPLATES: Record<string, {plans: string[]; weight: number}> = {
    perch_drop: {plans: ["flying_bird"], weight: 6},
    perch_drop_insect: {plans: ["flying_bird"], weight: 6},
    perch_drop_insect_feet: {plans: ["flying_bird"], weight: 6},
    anvil_smash: {plans: ["flying_bird"], weight: 6},
    snail_extract: {plans: ["flying_bird"], weight: 6},
    bank_burrow: {plans: ["flying_bird"], weight: 5},
    roost_gather: {plans: ["flying_bird"], weight: 6},
    dummy_nests: {plans: ["flying_bird"], weight: 6},
    // (A penguin lives in a burrow, its schedule's "burrow" stay: it digs at its entrance.)
    burrow_dig: {plans: ["flightless_bird"], weight: 5},
    groom_self: {plans: ["flying_bird"], weight: 9}
};

/** A species' recipe a bird wave-1 row was for, now shown by another (or the same, on a body plan it is written for): wave 1 must not list it as held. */
export function birdHandles(rows: readonly BirdRow[], slug: string, recipe: string): boolean {
    return rows.some((r) => r.slug === slug && r.was === recipe);
}

export function loadBirds(root: string): {rows: BirdRow[]; notShown: Array<{slug: string; was: string; why: string}>} {
    const file = JSON.parse(fs.readFileSync(path.join(root, "data/ark/signature-birds.json"), "utf8")) as {rows: BirdRow[]; notShown?: Array<{slug: string; was: string; why: string}>};
    return {rows: file.rows, notShown: file.notShown ?? []};
}

const recipesOf = (row: string) => row.split("|")[0].split(",").filter(Boolean);

/** Puts each bird row's recipe on the species' row (a recipe first in the list where the row says so), idempotent. Returns what it did. */
export function applyBirdRecipes(table: {species: Record<string, string>}, rows: readonly BirdRow[]): {added: string[]; already: string[]; missing: string[]} {
    const added: string[] = [];
    const already: string[] = [];
    const missing: string[] = [];
    for (const r of rows) {
        const row = table.species[r.slug];
        if (row === undefined) {
            missing.push(`${r.slug} ${r.recipe}: no row`);
            continue;
        }
        if (r.already) continue;
        const fields = row.split("|");
        while (fields.length < 8) fields.push("");
        // (Its male alone sits the eggs: flag "m", read by the props' nest sitter, `props/presence.ts`.)
        if (r.maleSits) {
            if (fields[7].includes("m")) {
                already.push(`${r.slug} male sits`);
            } else {
                fields[7] += "m";
                table.species[r.slug] = fields.join("|");
                added.push(`${r.slug} male sits`);
            }
            continue;
        }
        // (A nest the sentence gives: only where the row has none; the nest_build recipes need it.)
        if (r.nest && !fields[4]) fields[4] = r.nest;
        const has = recipesOf(fields[0]).some((id) => id.slice(0, id.lastIndexOf(".")) === r.recipe);
        if (has) {
            already.push(`${r.slug} ${r.recipe}`);
        } else {
            const spec = BIRD_TEMPLATES[r.recipe];
            const weight = spec ? spec.weight : 5;
            // The black swan's preening leads its row (its long preening is what its sentence is about).
            fields[0] = r.recipe === "groom_self" ? [`${r.recipe}.${weight}`, fields[0]].filter(Boolean).join(",") : [fields[0], `${r.recipe}.${weight}`].filter(Boolean).join(",");
            if (fields[7]) fields[7] = fields[7].replace("d", "");
            added.push(`${r.slug} ${r.recipe}`);
        }
        table.species[r.slug] = fields.join("|");
    }
    return {added, already, missing};
}

/** The communal roosts' species sleep together in a row (sleep.json's third field; sleep-styles.json's `social` and its source). */
export function applyBirdSleep(sleep: {species: Record<string, string>}, styles: {species: Array<Record<string, unknown>>}, rows: readonly BirdRow[]): number {
    let n = 0;
    const bySlug = new Map(styles.species.map((s) => [s.slug as string, s]));
    for (const r of rows) {
        if (r.sleep !== "row") continue;
        const row = sleep.species[r.slug];
        if (row === undefined) continue;
        const [posture = "", alts = "", social = "", ...rest] = row.split("|");
        if (social !== "row") {
            sleep.species[r.slug] = [posture, alts, "row", ...rest].join("|");
            n++;
        }
        const style = bySlug.get(r.slug) as {social?: string; src?: Record<string, unknown>} | undefined;
        if (style) {
            style.social = "row";
            style.src = {...(style.src ?? {}), social: {field: r.field, phrase: r.quote, signature: "wave 2 (birds): a communal roost, sleeping together in a row at its leader's roost"}};
        }
    }
    return n;
}

/** The species' own sentence for a recipe that makes an episode, in the live log. Sorted by species, like the file. */
export function applyBirdLines(lines: {species: Record<string, Record<string, string>>}, rows: readonly BirdRow[]): number {
    let n = 0;
    for (const r of rows) {
        if (!r.line) continue;
        const own = lines.species[r.slug] ?? (lines.species[r.slug] = {});
        if (own[r.recipe] !== r.line) {
            own[r.recipe] = r.line;
            n++;
        }
    }
    const sorted: Record<string, Record<string, string>> = {};
    for (const slug of Object.keys(lines.species).sort()) sorted[slug] = lines.species[slug];
    lines.species = sorted;
    return n;
}

