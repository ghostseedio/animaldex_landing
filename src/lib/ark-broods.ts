/**
 * BROODS (AnimalDex docs/ark/broods.md section 7; owner 2026-11-27: "make sure it's drawn on the world and not just a
 * log"): the typed client of the engine's public brood read, `voyage_broods_v1`.
 *
 * A brood is one record of the engine: a clutch or a litter with a count, its parents, its stage (`carried`, `egg`,
 * `young`), its place (the copied home slot of the first parent), who attends it, and each loss as an event: a hunter's
 * take with its count, or a loss the engine records with no cause ("did not survive", "failed", "did not settle").
 * The scene draws all of it from this read and nothing else (`src/ark-scene/live-broods.ts`); nothing here decides
 * anything.
 *
 * With the engine's switch off the read says `{on: false}`: `decodeArkBroods` then gives `ARK_BROODS_OFF`, and no
 * brood code is loaded or run (the scene is today's). Anything that does not decode is off too.
 *
 * Privacy: the read carries no user ids, no bringers and no fate; a line names species only.
 *
 * Pure: no three.js, no DOM.
 */

export type ArkBroodStage = "carried" | "egg" | "young";
export type ArkBroodCare = "nest" | "follow" | "carry" | "guard" | "none";
export type ArkBroodHold = "sit" | "guard";
/** `taken`: a hunter's recorded meal. The others are the engine's losses with no hunter; none of them is a cause of death. */
export type ArkBroodCause = "taken" | "did_not_survive" | "failed" | "parent_lost" | "unsettled";
export type ArkBroodOutcome = "independent" | "failed" | "eaten" | "parent_lost" | "unsettled" | "closed";

export type ArkBroodHunter = {id: string; species_profile_id: string; name: string; model_slug: string};

/** Where a wild take happened (the engine's encounter step): the hunter's waypoint and the brood's spot. */
export type ArkBroodEncounter = {t?: number; predator: {x: number; z: number}; prey: {x: number; z: number; r: number}};

export type ArkBroodLoss = {
    /**
     * The event's id. A loss the engine records only on the brood (a census cut, "did not survive": no log row, so the
     * read sends no id, broods.md 7.1 as built) gets one made from what it is: its brood, day, cause and counts.
     */
    id: string;
    /** When it was recorded (ISO) and the same in ms. */
    at: string;
    atMs: number;
    ark_day: number | null;
    cause: ArkBroodCause;
    /** How many went, and how many were left after it. */
    count: number;
    left: number;
    /** The stage it fell in, when the read says (else `arkBroodLossStage` works it out from the days). */
    stage: "carried" | "egg" | "young" | null;
    hunter: ArkBroodHunter | null;
    encounter: ArkBroodEncounter | null;
};

export type ArkBrood = {
    id: string;
    /** The kind (a breed's parent species) and the look (the first parent's own species). */
    kind: string;
    species_profile_id: string;
    name: string;
    model_slug: string;
    parents: string[];
    /** The parent attending it now (present, in its place); null: unattended. */
    carer: string | null;
    care: ArkBroodCare;
    hold: ArkBroodHold | null;
    way: string | null;
    way_detail: string | null;
    stage: ArkBroodStage;
    /** Now, at the start, and at the start of the current stage. */
    count: number;
    start: number;
    stage_count: number;
    taken: number;
    lost: number;
    /** How many of it became animals of their own, and how many did not settle, when the read says. */
    recruited: number | null;
    unsettled: number | null;
    /** Its last carer is gone and it carries on (the read's `unguarded`). */
    unguarded: boolean;
    laid_ark_day: number | null;
    stage_ark_day: number | null;
    /** The hatch, or independence, due (Ark day). */
    next_ark_day: number | null;
    island: "wild" | "town" | null;
    zone: string;
    /** The nest: the same terms as an animal's slot, placed by the scene's own home function. */
    nest: {slot: number; slot_rank: number} | null;
    young_mass_g: number | null;
    /** Newest first, at most 12. */
    losses: ArkBroodLoss[];
    /** On an ended brood only (the read keeps those of the last real day). */
    outcome: ArkBroodOutcome | null;
    ended_ark_day: number | null;
};

export type ArkBroodsRead = {on: boolean; as_of: string | null; ark_day: number | null; broods: ArkBrood[]; ended: ArkBrood[]};

/** The switch off, or no read: nothing to draw, nothing loaded. Frozen: never mutated, safe to share. */
export const ARK_BROODS_OFF: ArkBroodsRead = Object.freeze({on: false, as_of: null, ark_day: null, broods: [], ended: []}) as ArkBroodsRead;

/** The engine's ceiling on a clutch (broods.md 3.2 `maxCount`): a count above it is not a count. */
const MAX_COUNT = 2_000_000;

const str = (v: unknown, max = 160): string => (typeof v === "string" ? v.slice(0, max) : "");
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const count = (v: unknown): number | null => {
    const n = num(v);
    return n === null || n < 0 || n > MAX_COUNT ? null : Math.floor(n);
};
const oneOf = <T extends string>(v: unknown, list: readonly T[]): T | null => (typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : null);

const STAGES = ["carried", "egg", "young"] as const;
const CARES = ["nest", "follow", "carry", "guard", "none"] as const;
const HOLDS = ["sit", "guard"] as const;
const CAUSES = ["taken", "did_not_survive", "failed", "parent_lost", "unsettled"] as const;
const OUTCOMES = ["independent", "failed", "eaten", "parent_lost", "unsettled", "closed"] as const;

function decodeEncounter(raw: unknown): ArkBroodEncounter | null {
    if (!raw || typeof raw !== "object") return null;
    const e = raw as {t?: unknown; predator?: {x?: unknown; z?: unknown} | null; prey?: {x?: unknown; z?: unknown; r?: unknown} | null};
    const px = num(e.predator?.x);
    const pz = num(e.predator?.z);
    const qx = num(e.prey?.x);
    const qz = num(e.prey?.z);
    if (px === null || pz === null || qx === null || qz === null) return null;
    const t = num(e.t);
    return {...(t !== null ? {t} : {}), predator: {x: px, z: pz}, prey: {x: qx, z: qz, r: Math.max(num(e.prey?.r) ?? 0, 0)}};
}

function decodeLoss(raw: unknown, broodId: string): ArkBroodLoss | null {
    if (!raw || typeof raw !== "object") return null;
    const row = raw as Record<string, unknown>;
    const given = typeof row.id === "number" || typeof row.id === "string" ? String(row.id).slice(0, 64) : "";
    const at = str(row.at, 40);
    const atMs = Date.parse(at);
    const cause = oneOf(row.cause, CAUSES);
    const n = count(row.count);
    const left = count(row.left);
    if (!Number.isFinite(atMs) || !cause || n === null || n < 1 || left === null) return null;
    // (A census loss has no id: the same loss in the next read gets the same one, so it is acted once.)
    const id = given || `census:${broodId}:${num(row.ark_day) ?? atMs}:${cause}:${n}:${left}`;
    const h = row.hunter as Record<string, unknown> | null | undefined;
    const hunter = cause === "taken" && h && typeof h === "object" && str(h.id) && str(h.model_slug) ? {id: str(h.id), species_profile_id: str(h.species_profile_id), name: str(h.name, 120), model_slug: str(h.model_slug)} : null;
    // (A nest raid says `egg: true`; its stage is the egg's whatever else it says.)
    const stage = row.egg === true ? "egg" : oneOf(row.stage, ["carried", "egg", "young"] as const);
    return {id, at, atMs, ark_day: num(row.ark_day), cause, count: n, left, stage, hunter, encounter: cause === "taken" ? decodeEncounter(row.encounter) : null};
}

/**
 * An ended brood's last stage: the read leaves `stage` out of an ended one (broods.md 7.1 as built), so it is the stage
 * of its last loss where it says (the engine's losses always do); else independence (or young that did not settle)
 * ended it young; else a stage change after its laying made it young; else it ended in its first stage (closed with no
 * loss): eggs, unless carried in a pouch.
 */
function endedStage(row: Record<string, unknown>, losses: ArkBroodLoss[]): ArkBroodStage {
    const said = oneOf(row.stage, STAGES);
    if (said) return said;
    const last = losses.find((loss) => loss.stage !== null)?.stage ?? null;
    if (last) return last;
    const outcome = oneOf(row.outcome, OUTCOMES);
    if (outcome === "independent" || outcome === "unsettled") return "young";
    const laid = num(row.laid_ark_day);
    const stageDay = num(row.stage_ark_day);
    if (laid !== null && stageDay !== null && stageDay > laid + 1e-6) return "young";
    return str(row.way, 40) === "male_pregnancy" ? "carried" : "egg";
}

function decodeBrood(raw: unknown, ended: boolean): ArkBrood | null {
    if (!raw || typeof raw !== "object") return null;
    const row = raw as Record<string, unknown>;
    const id = str(row.id, 64);
    const species = str(row.species_profile_id, 64);
    const model = str(row.model_slug);
    const now = count(row.count);
    const start = count(row.start);
    const losses = (Array.isArray(row.losses) ? row.losses : []).map((loss) => decodeLoss(loss, id)).filter((l): l is ArkBroodLoss => l !== null).sort((a, b) => b.atMs - a.atMs).slice(0, 12);
    const stage = ended ? endedStage(row, losses) : oneOf(row.stage, STAGES);
    if (!id || !model || !stage || now === null || start === null) return null;
    const nestRaw = row.nest as {slot?: unknown; slot_rank?: unknown} | null | undefined;
    const slot = num(nestRaw?.slot);
    const parents = Array.isArray(row.parents) ? row.parents.filter((p): p is string => typeof p === "string" && p.length > 0 && p.length <= 64).slice(0, 2) : [];
    const carer = str(row.carer, 64);
    const island = oneOf(row.island, ["wild", "town"] as const);
    return {
        id,
        kind: str(row.kind, 64) || species,
        species_profile_id: species,
        name: str(row.name, 120),
        model_slug: model,
        parents,
        // (Only one of its own parents can attend it.)
        carer: carer && parents.includes(carer) ? carer : null,
        care: oneOf(row.care, CARES) ?? "none",
        hold: oneOf(row.hold, HOLDS),
        way: str(row.way, 40) || null,
        way_detail: str(row.way_detail, 40) || null,
        stage,
        // (Never more than it started with: the scene never draws more than `count`.)
        count: Math.min(now, Math.max(start, 0)),
        start,
        stage_count: Math.max(count(row.stage_count) ?? start, Math.min(now, start)),
        taken: count(row.taken) ?? 0,
        lost: count(row.lost) ?? 0,
        recruited: count(row.recruited),
        unsettled: count(row.unsettled),
        unguarded: row.unguarded === true,
        laid_ark_day: num(row.laid_ark_day),
        stage_ark_day: num(row.stage_ark_day),
        next_ark_day: num(row.next_ark_day),
        island,
        zone: str(row.zone, 40),
        nest: slot !== null && slot >= 0 ? {slot: Math.floor(slot), slot_rank: Math.max(Math.floor(num(nestRaw?.slot_rank) ?? 0), 0)} : null,
        young_mass_g: num(row.young_mass_g),
        losses,
        outcome: ended ? oneOf(row.outcome, OUTCOMES) ?? "closed" : null,
        ended_ark_day: ended ? num(row.ended_ark_day) : null
    };
}

/** The read as the scene takes it. Anything but a well-formed `on: true` answer is `ARK_BROODS_OFF`. */
export function decodeArkBroods(raw: unknown): ArkBroodsRead {
    if (!raw || typeof raw !== "object") return ARK_BROODS_OFF;
    const body = raw as {on?: unknown; as_of?: unknown; ark_day?: unknown; broods?: unknown; ended?: unknown};
    if (body.on !== true || !Array.isArray(body.broods)) return ARK_BROODS_OFF;
    const seen = new Set<string>();
    const list = (rows: unknown, ended: boolean) =>
        (Array.isArray(rows) ? rows : [])
            .map((row) => decodeBrood(row, ended))
            .filter((b): b is ArkBrood => b !== null && !seen.has(b.id) && Boolean(seen.add(b.id)));
    return {on: true, as_of: str(body.as_of, 40) || null, ark_day: num(body.ark_day), broods: list(body.broods, false), ended: list(body.ended, true)};
}

/**
 * The stage a loss fell in: the read's own word where it sends one; else from the days (a loss before the current
 * stage began was in the stage before: the eggs of a brood that has since hatched). A `carried` brood has no losses.
 */
export function arkBroodLossStage(brood: Pick<ArkBrood, "stage" | "stage_ark_day" | "laid_ark_day">, loss: Pick<ArkBroodLoss, "stage" | "ark_day">): "egg" | "young" {
    // (A carried brood draws nothing; its loss is said as its young's.)
    if (loss.stage) return loss.stage === "carried" ? "young" : loss.stage;
    if (brood.stage === "egg") return "egg";
    // (A young-stage brood that was never an egg (a live birth) has no laying day apart from its stage's.)
    const wasEgg = brood.laid_ark_day !== null && brood.stage_ark_day !== null && brood.laid_ark_day < brood.stage_ark_day;
    return wasEgg && loss.ark_day !== null && brood.stage_ark_day !== null && loss.ark_day < brood.stage_ark_day ? "egg" : "young";
}

/** A stand-in's id: never an animal's (no uuid has a colon), stable for a brood's i-th member. */
export const ARK_BROOD_MEMBER_PREFIX = "brood:";
export function arkBroodMemberId(broodId: string, i: number): string {
    return `${ARK_BROOD_MEMBER_PREFIX}${broodId}:${i}`;
}
/** The brood a stand-in's id belongs to, or null for any other id. */
export function arkBroodOfMember(id: string | null | undefined): string | null {
    if (!id || !id.startsWith(ARK_BROOD_MEMBER_PREFIX)) return null;
    const end = id.lastIndexOf(":");
    return end > ARK_BROOD_MEMBER_PREFIX.length ? id.slice(ARK_BROOD_MEMBER_PREFIX.length, end) : null;
}

/** Every brood (live, then ended in the last day) by each of its parents, newest laid first: a parent's card reads these. */
export function arkBroodsByParent(read: ArkBroodsRead): Map<string, ArkBrood[]> {
    const out = new Map<string, ArkBrood[]>();
    if (!read.on) return out;
    for (const brood of [...read.broods, ...read.ended]) {
        for (const parent of Array.from(new Set(brood.parents))) out.set(parent, [...(out.get(parent) ?? []), brood]);
    }
    out.forEach((list) => list.sort((a, b) => Number(a.outcome !== null) - Number(b.outcome !== null) || (b.laid_ark_day ?? 0) - (a.laid_ark_day ?? 0)));
    return out;
}

// MARK: Words (a parent's card)

/**
 * The broods' words (`ark.broods.*` in the Ark's locale files; a bundle without one reads the English). The card's
 * lines are short and stand under the parent's name; the log's lines lead with the kind and a colon, with no verb that
 * agrees with the animal's sex or number (as the crisis layer's), so they hold in every language.
 */
export const ARK_BROOD_ENGLISH = {
    eggs: "{start} eggs · {left} left",
    eggsAll: "{start} eggs",
    eggOne: "1 egg",
    young: "{start} young · {left} left",
    youngAll: "{start} young",
    carried: "Carrying {start} young",
    takenBy: "{count} taken by {aPredator}",
    didNotSurvive: "{count} did not survive",
    nestFailed: "The nest failed",
    failed: "The brood did not survive",
    parentLost: "Lost with its parent",
    unsettled: "{count} did not settle",
    independent: "{count} now on their own",
    logHatched: "{animal}: {count} eggs hatched",
    logBorn: "{animal}: {count} young born",
    logRaid: "{animal}: {count} eggs taken by {aPredator} · {left} left",
    logTaken: "{animal}: {count} young taken by {aPredator} · {left} left",
    logHeldOff: "{animal}: the parent drove off {aPredator}",
    logNestFailed: "{animal}: the nest failed",
    logFailed: "{animal}: the brood did not survive",
    logParentLost: "{animal}: the brood was lost with its parent",
    logRecruited: "{animal}: {count} young now on their own",
    logUnsettled: "{animal}: {count} young did not settle"
} as const;
export type ArkBroodWordKey = keyof typeof ARK_BROOD_ENGLISH;
export type ArkBroodWords = Partial<Record<ArkBroodWordKey, string>>;

/** The words with English under what a bundle lacks. */
export function arkBroodWords(given: ArkBroodWords | null | undefined): Record<ArkBroodWordKey, string> {
    const out: Record<string, string> = {...ARK_BROOD_ENGLISH};
    for (const key of Object.keys(ARK_BROOD_ENGLISH)) {
        const own = (given as Record<string, unknown> | null | undefined)?.[key];
        if (typeof own === "string" && own) out[key] = own;
    }
    return out as Record<ArkBroodWordKey, string>;
}

const fill = (text: string, values: Record<string, string>) => text.replace(/\{(\w+)\}/g, (whole, key: string) => values[key] ?? whole);

export type ArkBroodCardLine = {
    /** "9 eggs · 7 left". */
    head: string;
    /** "2 taken by a Grey Heron", "1 did not survive", "The nest failed": newest first, at most three. */
    notes: string[];
};

/**
 * A brood's lines for its parents' cards: how many it started with and how many are left, then what the record says
 * became of the others (who took them; the losses with no cause said as the engine records them, never a cause made
 * up). `article`: "a Grey Heron" in the reader's language.
 */
export function arkBroodCardLine(brood: ArkBrood, words: ArkBroodWords | null | undefined, locale: string, article: (name: string) => string): ArkBroodCardLine {
    const w = arkBroodWords(words);
    const n = (v: number) => v.toLocaleString(locale);
    const egg = brood.stage === "egg";
    // (On its own now: the read's count of a brood that became animals is 0 as each recruit leaves it; its recruits are what is left of it.)
    const independent = brood.outcome === "independent" ? brood.recruited ?? brood.count : null;
    const left = independent ?? brood.count;
    const whole = left >= brood.start;
    const head =
        brood.stage === "carried"
            ? fill(w.carried, {start: n(brood.start)})
            : egg
              ? brood.start === 1 && whole
                  ? w.eggOne
                  : fill(whole ? w.eggsAll : w.eggs, {start: n(brood.start), left: n(left)})
              : fill(left >= brood.stage_count ? w.youngAll : w.young, {start: n(brood.stage_count), left: n(left)});
    const notes: string[] = [];
    if (brood.outcome === "failed" || brood.outcome === "eaten") notes.push(arkBroodLossStage(brood, brood.losses[0] ?? {stage: null, ark_day: null}) === "egg" ? w.nestFailed : w.failed);
    else if (brood.outcome === "parent_lost") notes.push(w.parentLost);
    // (Takes by the same hunter kind are one note; the losses with no cause one each kind.)
    const taken = new Map<string, number>();
    const quiet = new Map<ArkBroodCause, number>();
    for (const loss of brood.losses) {
        if (loss.cause === "taken" && loss.hunter) taken.set(loss.hunter.name, (taken.get(loss.hunter.name) ?? 0) + loss.count);
        else if (loss.cause === "did_not_survive" || loss.cause === "unsettled") quiet.set(loss.cause, (quiet.get(loss.cause) ?? 0) + loss.count);
    }
    taken.forEach((c, name) => notes.push(fill(w.takenBy, {count: n(c), aPredator: article(name)})));
    quiet.forEach((c, cause) => notes.push(fill(cause === "unsettled" ? w.unsettled : w.didNotSurvive, {count: n(c)})));
    if (independent !== null && independent > 0) notes.unshift(fill(w.independent, {count: n(independent)}));
    // (A line that begins with the hunter's name in its language begins with a capital all the same.)
    const cap = (text: string) => (text ? text.charAt(0).toLocaleUpperCase(locale) + text.slice(1) : text);
    return {head: cap(head), notes: notes.slice(0, 3).map(cap)};
}
