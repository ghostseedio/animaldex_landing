/**
 * Signature rows held after their frames were looked at (`data/ark/signature-holds.json`, lane SIG2): never in the scene's
 * table and never told in the log. The tests of their mechanisms (micro acts, reptile variants, flights, mammals' nests)
 * put the held rows back into the imported table first, so the code that will show them stays checked until they are
 * released. Call before anything reads a species' recipes.
 */
import holds from "../../data/ark/signature-holds.json";
import table from "@/ark-scene/recipes.json";

export const HELD = new Set((holds as {held: Array<{slug: string; recipe: string}>}).held.map((h) => `${h.slug} ${h.recipe}`));

export const isHeld = (slug: string, recipe: string) => HELD.has(`${slug} ${recipe}`);

export function putHeldRowsBack(weight = 5): void {
    const rows = (table as {species: Record<string, string>}).species;
    for (const key of Array.from(HELD)) {
        const [slug, recipe] = key.split(" ");
        if (recipe.startsWith("sleep:") || rows[slug] === undefined) continue;
        const fields = rows[slug].split("|");
        const has = fields[0].split(",").filter(Boolean);
        if (has.some((r) => r.slice(0, r.lastIndexOf(".")) === recipe)) continue;
        fields[0] = [...has, `${recipe}.${weight}`].join(",");
        rows[slug] = fields.join("|");
    }
}
