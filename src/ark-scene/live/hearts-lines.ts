/**
 * A heart is a survived attack, in the live log and the animals' own logs (AnimalDex docs/ark/hearts-escape.md, lane
 * HEARTS-CLIENTS; behind the server's `hearts_escape`). Two records say it:
 *
 * - a RESCUE: an animal about to starve that holds a heart is found weak and taken into care by the town's carers. The server
 *   writes a `fed` row (`source: care`, `rescued`, `lives`): no `starved` event, it never died. Said "{aAnimal} was found
 *   starving and taken into care · 2 ♥ left".
 * - a WOUNDED ESCAPE (`escaped` with `wounded`, `escape-lines.ts` says it in the log): here only the prey's own log line, so
 *   its card says what happened to it ("A Vole got away from a Fox, wounded, and is lying up · 2 ♥ left").
 *
 * Neither is a death, and neither plays one in the scene. The server decides every one; this only says it. With the switch
 * off the public read carries neither key and nothing here makes a line: the log is exactly what it was.
 *
 * Read here from the server's rows as they come, with their own words (`ark.live`, 45 languages), English under a missing
 * one; with the scene, never in the Ark page's static JavaScript.
 */

import {arkHeartsLeftText, arkWithArticle, type ArkLiveItem, type ArkLiveText} from "@/lib/ark-live-log";
import {ARK_LIVE_ENGLISH} from "@/lib/ark-live-words";
import type {ArkRecordNote} from "@/lib/ark-animal-status";
import {fillArkWords} from "@/lib/ark-words";
import {escapeHearts, escapeText, escapeWounded} from "@/ark-scene/live/escape-lines";

type Animal = {id?: unknown; name?: unknown; species_profile_id?: unknown; model_slug?: unknown; zone?: unknown};
type Row = {id?: unknown; kind?: unknown; at?: unknown; ark_day?: unknown; animal?: Animal | null; other?: Animal | null; reason?: unknown; rescued?: unknown; wounded?: unknown; lives?: {heartsLeft?: unknown} | null; payload?: {rescued?: unknown; wounded?: unknown; lives?: {heartsLeft?: unknown} | null} | null};

const named = (a: Animal | null | undefined) => (a && typeof a.name === "string" && a.name ? a.name.slice(0, 120) : "");
const speciesOf = (a: Animal) => (typeof a.species_profile_id === "string" && a.species_profile_id ? a.species_profile_id : `slug:${String(a.model_slug ?? "")}`);
const rowsOf = (raw: unknown): Row[] => (Array.isArray(raw) ? raw : raw && typeof raw === "object" && Array.isArray((raw as {events?: unknown}).events) ? (raw as {events: Row[]}).events : []);

/** A rescue: a `fed` row the server says is a heart spent on being found starving (`rescued`, from the read or the raw payload). */
export function isRescue(row: Row | null | undefined): boolean {
    return Boolean(row) && typeof row === "object" && row!.kind === "fed" && (row!.rescued === true || row!.payload?.rescued === true);
}

/** A survived close call (AGE-RISK, behind `age_risk` with `hearts_escape`): a `death_old` row with `closeCall`. Nothing died. */
export function closeCallRow(row: unknown): boolean {
    const r = row as {kind?: unknown; closeCall?: unknown; payload?: {closeCall?: unknown} | null} | null;
    return Boolean(r) && typeof r === "object" && r!.kind === "death_old" && (r!.closeCall === true || r!.payload?.closeCall === true);
}

/**
 * A close call's line (docs/ark/age-risk.md): "A Vole came close to dying. The cause is not known. It pulled through · 2 ♥ left". It
 * never says old age, and nothing dies and comes back: the heart was spent and the animal lies up.
 */
export function closeCallText(line: Pick<ArkLiveItem, "animal"> & Partial<Pick<ArkLiveItem, "say" | "hearts">>, words: ArkLiveText, locale = "en"): string | null {
    if (line.say !== "closeCall") return null;
    const said = fillArkWords(words.live.closeCall ?? ARK_LIVE_ENGLISH.closeCall!, {aAnimal: arkWithArticle(line.animal, words)});
    const text = said ? said[0].toLocaleUpperCase() + said.slice(1) : said;
    if (typeof line.hearts !== "number") return text;
    return fillArkWords(words.live.withHearts ?? "{line} · {hearts}", {line: text, hearts: arkHeartsLeftText(line.hearts, words, locale)});
}

/** The rescue's line, or null for any other line. The hearts left follow it as a death's do. */
export function rescueText(line: Pick<ArkLiveItem, "animal"> & Partial<Pick<ArkLiveItem, "say" | "hearts">>, words: ArkLiveText, locale = "en"): string | null {
    if (line.say !== "rescued") return null;
    const said = fillArkWords(words.live.rescued ?? ARK_LIVE_ENGLISH.rescued!, {aAnimal: arkWithArticle(line.animal, words)});
    const text = said ? said[0].toLocaleUpperCase() + said.slice(1) : said;
    if (typeof line.hearts !== "number") return text;
    return fillArkWords(words.live.withHearts ?? "{line} · {hearts}", {line: text, hearts: arkHeartsLeftText(line.hearts, words, locale)});
}

/** The rows' rescues as log items, oldest first. `from` (ms): none older; `said`: ids already said. */
export function rescueItems(raw: unknown, from: number, said: (key: string) => boolean): ArkLiveItem[] {
    const items: ArkLiveItem[] = [];
    for (const row of rowsOf(raw)) {
        if (!isRescue(row) || !named(row.animal)) continue;
        const id = `event:${String(row.id)}`;
        const at = typeof row.at === "string" ? Date.parse(row.at) : NaN;
        if (!Number.isFinite(at) || at < from || said(id)) continue;
        const a = row.animal!;
        const hearts = escapeHearts(row);
        // (Its place in the queue and its dot are a return's: it lives. Its own line, never folded: its hearts left are its own.)
        items.push({
            id, kind: "revived", say: "rescued", source: "server", key: `rescued:${speciesOf(a)}:${String(a.id)}`, animal: named(a), other: null, count: 1, eggs: null,
            ...(hearts !== undefined ? {hearts} : {}),
            focus: {animalId: typeof a.id === "string" ? a.id : null, speciesId: speciesOf(a), zone: typeof a.zone === "string" ? (a.zone as ArkLiveItem["focus"]["zone"]) : null}
        });
    }
    return items;
}

/**
 * The rows' rescues and wounded escapes for the animals they are about (their own logs on the tap card, and "Its day"): each
 * is a line already said in the reader's words. A wounded escape is the prey's (`animal`), the hunter's own log says nothing.
 */
export function heartsNotes(raw: unknown, words: ArkLiveText, locale = "en"): ArkRecordNote[] {
    const notes: ArkRecordNote[] = [];
    for (const row of rowsOf(raw)) {
        if (!row || typeof row !== "object") continue;
        const id = typeof row.animal?.id === "string" ? row.animal.id : null;
        const at = typeof row.at === "string" ? Date.parse(row.at) : NaN;
        if (!id || !Number.isFinite(at)) continue;
        const day = typeof row.ark_day === "number" ? Math.floor(row.ark_day) : null;
        let text: string | null = null;
        if (closeCallRow(row) && named(row.animal)) text = closeCallText({say: "closeCall", animal: named(row.animal), hearts: escapeHearts(row)}, words, locale);
        else if (isRescue(row) && named(row.animal)) text = rescueText({say: "rescued", animal: named(row.animal), hearts: escapeHearts(row)}, words, locale);
        else if (row.kind === "escaped" && row.reason !== "shelter" && escapeWounded(row) && named(row.animal) && named(row.other)) text = escapeText({say: "escaped", animal: named(row.animal), other: named(row.other), hurt: true, hearts: escapeHearts(row)}, words, locale);
        if (text) notes.push({animalId: id, id: `hearts:${String(row.id)}`, kind: "said", at, day, text});
    }
    return notes;
}
