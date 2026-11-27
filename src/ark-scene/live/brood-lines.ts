/**
 * BROODS in the live log (AnimalDex docs/ark/broods.md 7.2): the record's brood rows said in the reader's words:
 * eggs hatched or a litter born (`brood_stage`), eggs or young taken by a hunter (a `meal` with a `brood`, which has no
 * eaten animal), a raid the parent held off (an `escaped` with a `brood`), a nest that failed or a brood lost with its
 * parent (`brood_loss`; its census rows, "did not survive", are not in the log's read), and the young now on their own
 * or that did not settle (a `birth` with `recruit: true`, a `brood_loss` `unsettled`). A clutch laid keeps the log's own
 * `laid` line.
 *
 * The server decides every one; this only says it. A line names species only. Read from the server's rows as they
 * come, with their own words (as `escape-lines.ts`): with the scene, never in the Ark page's static JavaScript.
 */

import {arkWithArticle, type ArkLiveItem, type ArkLiveText} from "@/lib/ark-live-log";
import {arkBroodWords, type ArkBroodWordKey, type ArkBroodWords} from "@/lib/ark-broods";
import {fillArkWords} from "@/lib/ark-words";

type Animal = {id?: unknown; name?: unknown; species_profile_id?: unknown; model_slug?: unknown; zone?: unknown};
type BroodKey = {id?: unknown; taken?: unknown; left?: unknown; stage?: unknown; egg?: unknown; defended?: unknown; guard?: unknown; from?: unknown; cause?: unknown; count?: unknown; of?: unknown; survivors?: unknown; unguarded?: unknown};
type Row = {id?: unknown; kind?: unknown; at?: unknown; animal?: Animal | null; other?: Animal | null; prey?: Animal | null; brood?: BroodKey | null; recruit?: unknown; parents?: unknown; payload?: {brood?: unknown; recruit?: unknown} | null};

const rowsOf = (raw: unknown): Row[] => (Array.isArray(raw) ? raw : raw && typeof raw === "object" && Array.isArray((raw as {events?: unknown}).events) ? (raw as {events: Row[]}).events : []);
const named = (a: Animal | null | undefined) => (a && typeof a.name === "string" && a.name ? a.name.slice(0, 120) : "");
const speciesOf = (a: Animal | null | undefined) => (a && typeof a.species_profile_id === "string" && a.species_profile_id ? a.species_profile_id : a ? `slug:${String(a.model_slug ?? "")}` : "");
const n = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : null);
/** A row's brood key (the read's `brood` object; a bare id in the payload on an older shape), or null: not a brood's row. */
const broodOf = (row: Row): (BroodKey & {id: string}) | null => {
    const b = row.brood;
    if (b && typeof b === "object" && typeof b.id === "string" && b.id) return b as BroodKey & {id: string};
    return null;
};

/** Whether a row is one of a brood's (the layers that act a meal, a birth or a laying leave those to the brood layer). */
export function isBroodRow(row: unknown): boolean {
    return Boolean(row && typeof row === "object" && broodOf(row as Row));
}

/**
 * Whether a row is one the brood layer acts in the brood's own place (a take, a raid held off, a recruit's hand-over),
 * so the layers that act a meal, an escape or a birth leave it alone. A brood's `mated` and `laid` (docs/ark/broods.md
 * 7.2: each carries `brood: {id}`, the laying parent as `animal`) are a pair's own, acted and said as they always were.
 */
export function isBroodActedRow(row: unknown): boolean {
    if (!isBroodRow(row)) return false;
    const r = row as Row;
    return r.kind === "meal" || r.kind === "escaped" || (r.kind === "birth" && r.recruit === true);
}

/** The ids of the rows' recruit births (a `birth` with `recruit: true`): never said or acted as a birth. */
export function broodRecruitIds(raw: unknown): Set<string> {
    const out = new Set<string>();
    for (const row of rowsOf(raw)) if (row && typeof row === "object" && row.kind === "birth" && row.recruit === true) out.add(String(row.id));
    return out;
}

/** The rows' recruits by brood, for the scene (`noteRecruits`): the new animals and their parents. None older than `from`. */
export function broodRecruits(raw: unknown, from: number): Array<{brood: string; young: string[]; parents: string[]}> {
    const by = new Map<string, {brood: string; young: string[]; parents: string[]}>();
    for (const row of rowsOf(raw)) {
        if (!row || typeof row !== "object" || row.kind !== "birth" || row.recruit !== true) continue;
        const brood = broodOf(row);
        const id = row.animal?.id;
        const at = typeof row.at === "string" ? Date.parse(row.at) : NaN;
        if (!brood || typeof id !== "string" || !id || !Number.isFinite(at) || at < from) continue;
        const group = by.get(brood.id) ?? {brood: brood.id, young: [], parents: Array.isArray(row.parents) ? row.parents.filter((p): p is string => typeof p === "string") : []};
        group.young.push(id);
        by.set(brood.id, group);
    }
    return Array.from(by.values());
}

export type BroodLineContext = {
    /** The broods' words (`ark.broods`), and the log's own (articles). */
    words: ArkBroodWords | null | undefined;
    text: ArkLiveText;
    locale: string;
    /** A brood's kind name and stage, from the brood read, when the row itself does not say (null: not known). */
    brood: (id: string) => {name: string; species: string; zone: string | null; stage: "carried" | "egg" | "young"; carer: string | null} | null;
};

/**
 * The rows' brood lines as log items, oldest first. `from` (ms): none older; `said`: ids already said. Whether any
 * brood row was among them at all is `touched` (the brood read is then asked for again).
 */
export function broodItems(raw: unknown, from: number, said: (key: string) => boolean, ctx: BroodLineContext): {items: ArkLiveItem[]; touched: boolean} {
    const w = arkBroodWords(ctx.words);
    const items: ArkLiveItem[] = [];
    const num = (v: number) => v.toLocaleString(ctx.locale);
    let touched = false;
    const recruited = new Map<string, ArkLiveItem>();
    for (const row of rowsOf(raw)) {
        if (!row || typeof row !== "object") continue;
        const brood = broodOf(row);
        if (!brood) continue;
        touched = true;
        const id = `event:${String(row.id)}`;
        const at = typeof row.at === "string" ? Date.parse(row.at) : NaN;
        if (!Number.isFinite(at) || at < from || said(id)) continue;
        const known = ctx.brood(brood.id);
        const say = (kind: ArkLiveItem["kind"], key: ArkBroodWordKey, name: string, species: string, focus: ArkLiveItem["focus"], values: Record<string, string>, count = 1): ArkLiveItem => {
            const item: ArkLiveItem = {id, kind, source: "server", key: `brood:${key}:${brood.id}`, animal: name, other: null, count, eggs: null, line: fillArkWords(w[key], {animal: name, ...values}), focus};
            items.push(item);
            return item;
        };
        const zoneOf = (a: Animal | null | undefined) => (a && typeof a.zone === "string" ? (a.zone as ArkLiveItem["focus"]["zone"]) : ((known?.zone ?? null) as ArkLiveItem["focus"]["zone"]));
        if (row.kind === "meal") {
            // A take: the hunter is the row's animal; the brood's kind is the row's `prey`.
            const hunter = named(row.animal);
            const name = named(row.prey) || known?.name || "";
            const taken = n(brood.taken);
            if (!hunter || !name || taken === null) continue;
            const egg = brood.egg === true || brood.stage === "egg";
            say("meal", egg ? "logRaid" : "logTaken", name, speciesOf(row.prey) || known?.species || "", {animalId: typeof row.animal?.id === "string" ? row.animal.id : null, speciesId: speciesOf(row.animal), zone: zoneOf(row.animal)}, {count: num(taken), left: num(n(brood.left) ?? 0), aPredator: arkWithArticle(hunter, ctx.text)});
        } else if (row.kind === "escaped") {
            // A raid held off: the hunter is the row's `other`; nothing escaped, the parent stood.
            const hunter = named(row.other);
            const name = named(row.prey) || known?.name || "";
            if (!hunter || !name) continue;
            const guard = typeof brood.guard === "string" ? brood.guard : known?.carer ?? null;
            // (Its place in the queue and its dot are a return's: they live. As an escape's line.)
            say("revived", "logHeldOff", name, speciesOf(row.prey) || known?.species || "", {animalId: guard, speciesId: speciesOf(row.prey) || known?.species || null, zone: zoneOf(row.prey)}, {aPredator: arkWithArticle(hunter, ctx.text)});
        } else if (row.kind === "brood_stage") {
            // (Born out of the carrying parent, or hatched from the eggs. A stage the contract may yet add, past the young
            // (BROODS' floaters, coming): said by no line until its words are agreed.)
            if (brood.from !== "carried" && brood.from !== "egg") continue;
            const name = named(row.animal) || known?.name || "";
            const count = n(brood.count);
            if (!name || count === null || count < 1) continue;
            say(brood.from === "carried" ? "birth" : "hatched", brood.from === "carried" ? "logBorn" : "logHatched", name, speciesOf(row.animal) || known?.species || "", {animalId: typeof row.animal?.id === "string" ? row.animal.id : known?.carer ?? null, speciesId: speciesOf(row.animal) || known?.species || null, zone: zoneOf(row.animal)}, {count: num(count)});
        } else if (row.kind === "brood_loss") {
            const name = named(row.animal) || known?.name || "";
            const cause = brood.cause;
            if (!name || cause === "did_not_survive") continue;
            const focus = {animalId: typeof row.animal?.id === "string" ? row.animal.id : null, speciesId: speciesOf(row.animal) || known?.species || null, zone: zoneOf(row.animal)};
            const species = speciesOf(row.animal) || known?.species || "";
            if (cause === "unsettled") say("gone", "logUnsettled", name, species, focus, {count: num(n(brood.count) ?? 0)});
            // (`unguarded` with count 0, docs/ark/broods.md 7.2: its last carer is gone and the brood carries on. Nothing of
            // it was lost: it goes on without a parent, while any of it is left.)
            else if (cause === "parent_lost" && brood.unguarded === true) {
                if ((n(brood.left) ?? 1) > 0) say("gone", "logUnguarded", name, species, focus, {});
            } else if (cause === "parent_lost" && (n(brood.count) ?? 1) > 0) say("gone", "logParentLost", name, species, focus, {});
            else if (cause === "failed") say("gone", (brood.stage ?? known?.stage) === "egg" ? "logNestFailed" : "logFailed", name, species, focus, {});
        } else if (row.kind === "birth" && row.recruit === true) {
            // Recruits: one line a brood, its young counted.
            const name = named(row.animal);
            if (!name) continue;
            const before = recruited.get(brood.id);
            if (before) {
                before.count++;
                before.line = fillArkWords(w.logRecruited, {animal: name, count: num(before.count)});
                continue;
            }
            const item = say("birth", "logRecruited", name, speciesOf(row.animal), {animalId: typeof row.animal?.id === "string" ? row.animal.id : null, speciesId: speciesOf(row.animal), zone: zoneOf(row.animal)}, {count: num(1)});
            recruited.set(brood.id, item);
        }
    }
    // (A folded repeat says nothing more: each brood line is its own, its count already in its words.)
    for (const item of items) item.count = 1;
    return {items, touched};
}

/** A brood line's words (said as they are: the kind's name leads, nothing to fill), or null for any other line. */
export function broodText(line: Pick<ArkLiveItem, "key"> & Partial<Pick<ArkLiveItem, "line">>): string | null {
    return line.line && line.key.startsWith("brood:") ? line.line : null;
}
