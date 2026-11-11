/** Recipes from a species' behaviours (filled in with the engine, `src/ark-scene/behaviour-recipes.ts`). */
import type {Hit, Nest, Season, SexInfo, SpeciesText} from "./ark-behaviour-text.mts";

export const RECIPE_VERSION = "recipes-v0";
export type RecipeSource = {field: string; phrase: string} | {rule: string} | {default: string};
export type ComposedRecipe = {id: string; weight: number; src: RecipeSource};

export function composeRecipes(_s: SpeciesText, _b: Record<string, Hit[]>, _ctx: {sex: SexInfo; mating: Season; nesting: Season; nest: Nest | null}): {recipes: ComposedRecipe[]; defaults: string[]} {
    return {recipes: [], defaults: []};
}

export function compactRow(_r: ComposedRecipe[], _sex: SexInfo, _m: Season, _n: Season, _nest: Nest | null): string {
    return "";
}
