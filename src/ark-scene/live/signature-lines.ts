/**
 * A species' own behaviours in the live log (AnimalDex decision 374; owner 2026-11-16: "shouldn't there be
 * thousands?"). Every showable behaviour of the catalogue (AnimalDex docs/ark/signature-behaviours.json) has a
 * sentence written from the species' own stored text; `signature-lines.json` holds the ones for behaviours the 3D
 * world shows today (a species and one of its recipes). A line is said once per episode, while that recipe's episode is
 * in view, in place of the generic line ("A heron is fishing" → "A Grey Heron is shooting out its neck to spear prey
 * with its sharp bill"). English first: in any other language the generic lines are said as before.
 *
 * With the scene, never in the Ark page's static JavaScript (`ark-page-weight.test.ts`).
 */

import table from "@/ark-scene/signature-lines.json";
import {arkWithArticle, type ArkLiveItem, type ArkLiveText, type ArkSeenAct, type ArkSeenMemory} from "@/lib/ark-live-log";
import {pluralAnimalName} from "@/lib/ark-population";

const LINES = (table as unknown as {species: Record<string, Record<string, string>>}).species;

/** The species' own sentence for what one of its recipes shows, or null. */
export function signatureLineOf(slug: string | null | undefined, recipe: string): string | null {
    return (slug && LINES[slug]?.[recipe]) || null;
}

/** The blocks that are only the way to the thing (the walk, the flight there): the line waits for the thing itself. */
const ON_THE_WAY = new Set(["walk", "run", "go", "follow", "fly", "swim", "crawl", "climb", "wade", "take_off", "land", "turn", "stalk"]);

export function isEnglish(locale: string): boolean {
    return /^en(\b|[-_])/i.test(locale) || locale.toLowerCase() === "en";
}

/**
 * New signature items from what the scene reports now: one per episode, once its recipe is past the way there. They
 * share the seen lines' memory (`seen:<episode>`), so an episode said in the species' words is not said again in the
 * generic ones.
 */
export function signatureItems(acts: readonly ArkSeenAct[], memory: ArkSeenMemory): ArkLiveItem[] {
    const items: ArkLiveItem[] = [];
    for (const act of acts) {
        if (!act.line || ON_THE_WAY.has(act.block)) continue;
        const id = `seen:${act.episode}`;
        if (memory.has(id)) continue;
        memory.add(id);
        items.push({id, kind: "doing", source: "seen", line: act.line, key: `sig:${act.speciesId}:${act.recipe}`, animal: act.name, other: null, count: 1, eggs: null, focus: {animalId: act.id, speciesId: act.speciesId, zone: act.zone}});
    }
    return items;
}

/** A signature line's words ("{aAnimal} …" one animal, "{animals} …" several of the kind), or null for any other line. */
export function signatureText(line: Pick<ArkLiveItem, "animal"> & Partial<Pick<ArkLiveItem, "line">>, words: ArkLiveText): string | null {
    if (!line.line) return null;
    const text = line.line.replace("{aAnimal}", arkWithArticle(line.animal, words)).replace("{animals}", pluralAnimalName(line.animal));
    return text ? text[0].toLocaleUpperCase() + text.slice(1) : text;
}
