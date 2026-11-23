/**
 * Saved signature moves in the live log (AnimalDex lane SIG-EVENTS, owner 2026-11-23: "Save only the notable moves.
 * Tool use, food caching, hunting techniques, displays and courtship"). The engine saves a capped few per island per
 * hour as `signature` events; the public read sends each with `sig: {move, recipe}` (migration 20261230100000). Here:
 *
 * - the line, for everyone: in English the species' own sentence for that recipe (`signature-lines.json`, as the seen
 *   lines say it), else the generic "{aAnimal} is {activity}" line of the recipe's activity, in every language;
 * - the cue: the scene plays that recipe on that animal in its next fitting slots while it is in view
 *   (`behaviour-recipes.ts` setSignatureCues). The recipe names are the scene's own (`recipes.json`; SIG2's variants
 *   "recipe~variant" share the base name).
 *
 * With signature_caches (owner 2026-11-23, "saved food is real and stealable") two more kinds, said with their own words
 * in every language (`ark.live.cacheRehidden`, `ark.live.cacheStolen`): `cache_rehidden` (a corvid moved the cache it
 * was watched making; the scene plays its cache recipe again) and `cache_stolen` (another animal found and took a
 * cache; `other` is the cache's owner). The engine decides each from the species' odds; this only says it.
 *
 * Read from the server's rows as they come, with the scene: never in the Ark page's static JavaScript.
 */

import {signatureLineOf, isEnglish} from "@/ark-scene/live/signature-lines";
import {ARK_ACTIVITY_ENGLISH, arkRecipeActivity, type ArkActivityKey} from "@/lib/ark-animal-status";
import {arkWithArticle, type ArkLiveItem, type ArkLiveText} from "@/lib/ark-live-log";
import {fillArkWords} from "@/lib/ark-words";
import {pluralAnimalName} from "@/lib/ark-population";

export const SIGNATURE_MOVES = ["tool_use", "food_cache", "hunt_technique", "display", "courtship"] as const;
export type SignatureMove = (typeof SIGNATURE_MOVES)[number];

/** A recipe without an activity of its own says its move's. */
const MOVE_ACTIVITY: Record<SignatureMove, ArkActivityKey> = {tool_use: "food", food_cache: "food", hunt_technique: "hunting", display: "calling", courtship: "courting"};

/** How long (s) after its moment the scene keeps the cue: its next slots that suit the recipe play it. */
export const SIGNATURE_CUE_SECONDS = 15 * 60;

type Animal = {id?: unknown; name?: unknown; species_profile_id?: unknown; model_slug?: unknown; zone?: unknown};
type Row = {id?: unknown; kind?: unknown; at?: unknown; animal?: Animal | null; other?: Animal | null; sig?: {move?: unknown; recipe?: unknown} | null; cache?: {food?: unknown; recipe?: unknown} | null};

const CACHE_ENGLISH = {cacheRehidden: "{aAnimal} is re-hiding its food after being watched", cacheStolen: "{aThief} dug up food that {aOwner} had hidden"};

export type SignatureCue = {animalId: string; recipe: string; from: number; to: number};

function rowsOf(raw: unknown): Row[] {
    return Array.isArray(raw) ? raw : raw && typeof raw === "object" && Array.isArray((raw as {events?: unknown}).events) ? (raw as {events: Row[]}).events : [];
}

type Read = {id: string; at: number; animal: Animal & {name: string}; move: SignatureMove; recipe: string};

function read(row: Row): Read | null {
    if (!row || typeof row !== "object" || row.kind !== "signature") return null;
    const move = row.sig?.move, recipe = row.sig?.recipe;
    if (typeof move !== "string" || !(SIGNATURE_MOVES as readonly string[]).includes(move)) return null;
    if (typeof recipe !== "string" || !/^[a-z_]{1,32}$/.test(recipe)) return null;
    const at = typeof row.at === "string" ? Date.parse(row.at) : NaN;
    const a = row.animal;
    if (!a || typeof a.name !== "string" || !a.name || !Number.isFinite(at)) return null;
    return {id: `event:${String(row.id)}`, at, animal: {...a, name: a.name.slice(0, 120)}, move: move as SignatureMove, recipe};
}

/** The rows' saved moves as log items, oldest first. `from` (ms): none older; `said`: ids already said. */
export function signatureEventItems(raw: unknown, from: number, said: (key: string) => boolean): ArkLiveItem[] {
    const items: ArkLiveItem[] = [];
    for (const row of rowsOf(raw)) {
        const r = read(row);
        if (!r || r.at < from || said(r.id)) continue;
        const a = r.animal;
        const speciesId = typeof a.species_profile_id === "string" && a.species_profile_id ? a.species_profile_id : `slug:${String(a.model_slug ?? "")}`;
        const own = signatureLineOf(typeof a.model_slug === "string" ? a.model_slug : null, r.recipe);
        items.push({
            id: r.id, kind: "doing", say: "signature", source: "server", key: `sigmove:${speciesId}:${r.recipe}`, animal: a.name, other: null, count: 1, eggs: null,
            activity: arkRecipeActivity(r.recipe) ?? MOVE_ACTIVITY[r.move],
            ...(own ? {line: own} : {}),
            focus: {animalId: typeof a.id === "string" ? a.id : null, speciesId, zone: typeof a.zone === "string" ? (a.zone as ArkLiveItem["focus"]["zone"]) : null}
        });
    }
    return items;
}

const named = (a: Animal | null | undefined) => (a && typeof a.name === "string" && a.name ? a.name.slice(0, 120) : "");
const speciesOf = (a: Animal) => (typeof a.species_profile_id === "string" && a.species_profile_id ? a.species_profile_id : `slug:${String(a.model_slug ?? "")}`);

/** The rows' cache re-hidings and thefts as log items, oldest first. */
export function cacheEventItems(raw: unknown, from: number, said: (key: string) => boolean): ArkLiveItem[] {
    const items: ArkLiveItem[] = [];
    for (const row of rowsOf(raw)) {
        if (!row || typeof row !== "object" || (row.kind !== "cache_rehidden" && row.kind !== "cache_stolen")) continue;
        const id = `event:${String(row.id)}`;
        const at = typeof row.at === "string" ? Date.parse(row.at) : NaN;
        const who = named(row.animal);
        if (!who || !Number.isFinite(at) || at < from || said(id)) continue;
        const stolen = row.kind === "cache_stolen";
        const owner = stolen ? named(row.other) : "";
        if (stolen && !owner) continue;
        items.push({id, kind: "doing", say: stolen ? "cacheStolen" : "cacheRehidden", source: "server", key: `${row.kind}:${speciesOf(row.animal!)}${stolen ? `:${speciesOf(row.other!)}` : ""}`, animal: who, other: stolen ? owner : null, count: 1, eggs: null, focus: {animalId: typeof row.animal!.id === "string" ? row.animal!.id : null, speciesId: speciesOf(row.animal!), zone: typeof row.animal!.zone === "string" ? (row.animal!.zone as ArkLiveItem["focus"]["zone"]) : null}});
    }
    return items;
}

/** A cache line's words, or null for any other line. */
export function cacheEventText(line: Pick<ArkLiveItem, "animal" | "other"> & Partial<Pick<ArkLiveItem, "say">>, words: ArkLiveText): string | null {
    if (line.say !== "cacheRehidden" && line.say !== "cacheStolen") return null;
    const live = words.live as unknown as Partial<Record<"cacheRehidden" | "cacheStolen", string>>;
    const text = line.say === "cacheRehidden"
        ? fillArkWords(live.cacheRehidden ?? CACHE_ENGLISH.cacheRehidden, {aAnimal: arkWithArticle(line.animal, words)})
        : fillArkWords(live.cacheStolen ?? CACHE_ENGLISH.cacheStolen, {aThief: arkWithArticle(line.animal, words), aOwner: arkWithArticle(line.other ?? "", words)});
    return text ? text[0].toLocaleUpperCase() + text.slice(1) : text;
}

/** The scene's cues: each saved move's animal plays its recipe from the move's moment, for `SIGNATURE_CUE_SECONDS`. */
export function signatureCues(raw: unknown, from: number): SignatureCue[] {
    const cues: SignatureCue[] = [];
    for (const row of rowsOf(raw)) {
        if (row && row.kind === "cache_rehidden") {
            const at = typeof row.at === "string" ? Date.parse(row.at) : NaN;
            const recipe = row.cache?.recipe;
            if (typeof row.animal?.id === "string" && typeof recipe === "string" && /^[a-z_]{1,32}$/.test(recipe) && Number.isFinite(at) && at >= from) cues.push({animalId: row.animal.id, recipe, from: at / 1000, to: at / 1000 + SIGNATURE_CUE_SECONDS});
            continue;
        }
        const r = read(row);
        if (!r || r.at < from || typeof r.animal.id !== "string") continue;
        cues.push({animalId: r.animal.id, recipe: r.recipe, from: r.at / 1000, to: r.at / 1000 + SIGNATURE_CUE_SECONDS});
    }
    return cues;
}

/** A saved move's words, or null for any other line: the species' own sentence in English, else the generic one. */
export function signatureEventText(line: Pick<ArkLiveItem, "animal"> & Partial<Pick<ArkLiveItem, "say" | "line" | "activity">>, words: ArkLiveText, locale: string): string | null {
    if (line.say !== "signature") return null;
    const aAnimal = arkWithArticle(line.animal, words);
    let text: string;
    if (line.line && isEnglish(locale)) text = line.line.replace("{aAnimal}", aAnimal).replace("{animals}", pluralAnimalName(line.animal));
    else {
        const key = (line.activity ?? "food") as ArkActivityKey;
        const activity = words.activity?.[key] ?? ARK_ACTIVITY_ENGLISH[key];
        text = fillArkWords(words.activity?.log?.doing ?? ARK_ACTIVITY_ENGLISH.log.doing, {aAnimal, activity: String(activity)});
    }
    return text ? text[0].toLocaleUpperCase() + text.slice(1) : text;
}
