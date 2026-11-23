/**
 * Ant colonies in the live log (lane ARK-ANTS): what the colonies near the camera are doing, said once per episode in
 * the reader's words (`ark.live.ant*`, 45 languages; English under a missing one). The scene only reports a colony's
 * trail to food the record has (a body the record says died, real sap-sucking Ark animals) or its kind's own way of
 * foraging on a day the engine fed it (`src/ark-scene/ants/colony.ts`); never a visual-only find.
 *
 * With the scene, never in the Ark page's static JavaScript. Each line is sent pre-said in `line`.
 */

import {arkWithArticle, type ArkLiveItem, type ArkLiveText, type ArkSeenAct, type ArkSeenMemory} from "@/lib/ark-live-log";
import {ARK_LIVE_ENGLISH, type ArkLiveWords} from "@/lib/ark-live-words";
import {pluralAnimalName} from "@/lib/ark-population";
import {fillArkWords} from "@/lib/ark-words";

const KEYS = new Set(["antTrailFound", "antTend", "antLeaves", "antSeeds", "antRaid", "antBivouac", "antWeave"]);
const isEnglish = (locale: string) => /^en(\b|[-_])/i.test(locale) || locale.toLowerCase() === "en";

/** One colony line in the reader's words. */
export function antText(key: string, name: string, other: string | null, words: ArkLiveText, locale: string): string {
    const live = words.live as unknown as Partial<ArkLiveWords>;
    const k = key as keyof ArkLiveWords;
    const template = (live[k] as string | undefined) || (ARK_LIVE_ENGLISH[k] as string | undefined) || "";
    const text = fillArkWords(template, {animals: isEnglish(locale) ? pluralAnimalName(name) : name, other: other ?? "", aOther: other && template.includes("{aOther}") ? arkWithArticle(other, words) : other ?? ""});
    return text ? text[0].toLocaleUpperCase() + text.slice(1) : text;
}

/** New colony items from what the scene reports now: one per episode (sharing the seen lines' memory). */
export function antItems(acts: readonly ArkSeenAct[], memory: ArkSeenMemory, words: ArkLiveText, locale: string): ArkLiveItem[] {
    const items: ArkLiveItem[] = [];
    for (const act of acts) {
        if (!act.words || !KEYS.has(act.words.key)) continue;
        const id = `seen:${act.episode}`;
        if (memory.has(id)) continue;
        memory.add(id);
        items.push({id, kind: "doing", source: "seen", line: antText(act.words.key, act.name, act.words.other, words, locale), key: `ant:${act.speciesId}:${act.words.key}`, animal: act.name, other: null, count: 1, eggs: null, focus: {animalId: act.id, speciesId: act.speciesId, zone: act.zone}});
    }
    return items;
}
