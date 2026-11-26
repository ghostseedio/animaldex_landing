/**
 * "Life so far" on the /ark card (lane BIO): one animal's recorded moments, newest first, from the engine's own record
 * only (`voyage_animal_moments_v1`, AnimalDex migration 20270102100000, through `/api/ark/moments/<id>`).
 *
 * - `decodeArkMoments`: the read's answer, every field checked; anything unknown is dropped, never guessed.
 * - `arkLifeSoFar`: the list the card shows: a repeated trip to the same mate on the same Ark day said once.
 * - `arkMomentText`: one moment in words (English for now; `words` lays a locale's keys over them).
 * - `arkLifeStoryOn`: the display switch, `?lifestory` (or `globalThis.__arkLifeStory`), off by default until the read
 *   is live.
 *
 * Nothing here is about a person: the read sends none. The card says who brought the animal (or whom it was born to)
 * with its own line, the same founders rules as its header (decision 483), on the "arrived" / "born" moment.
 */

export type ArkMomentRef = {id: string; name: string | null; status?: string | null};

export type ArkMoment = {
    id: string;
    kind: ArkMomentKind;
    /** When it happened, ms since the epoch (shown in the reader's own time, never Ark days). */
    at: number;
    arkDay: number | null;
    island: "wild" | "town" | null;
    area: "house" | "farm" | "zoo" | null;
    source?: "capture" | "step";
    fromEgg?: boolean;
    way?: string;
    partner?: ArkMomentRef;
    young?: number;
    eggs?: boolean;
    first?: boolean;
    distance?: number;
    prey?: string;
    preyId?: string;
    phrase?: string;
    trap?: "web";
    carcass?: boolean;
    egg?: boolean;
    predator?: string;
    predatorId?: string;
    shelter?: boolean;
    food?: "meat" | "seeds";
    role?: "thief" | "victim";
    other?: ArkMomentRef;
    move?: string;
    enclosure?: string;
    cause?: string;
    count?: number;
    ids?: string[];
};

export const ARK_MOMENT_KINDS = [
    "arrived", "born", "young", "mated", "dated", "moved_in", "parted", "went_to_mate", "meal", "ate_cache", "ate_dung",
    "cache_stolen", "cache_rehidden", "escaped", "signature", "eggs_collected", "grown_up", "grew_old", "returned_to_care",
    "moved_zoo", "rehomed", "revived", "died"
] as const;
export type ArkMomentKind = (typeof ARK_MOMENT_KINDS)[number];

export type ArkMoments = {moments: ArkMoment[]; total: number; more: boolean};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const WORD = /^[a-z_]{1,32}$/;
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown, max = 80): string | undefined => {
    if (typeof value !== "string") return undefined;
    const clean = value.replace(/\s+/g, " ").trim();
    return clean && clean.length <= max ? clean : undefined;
};
const uuid = (value: unknown): string | undefined => (typeof value === "string" && UUID.test(value) ? value : undefined);
const word = (value: unknown): string | undefined => (typeof value === "string" && WORD.test(value) ? value : undefined);
const count = (value: unknown): number | undefined => (typeof value === "number" && Number.isFinite(value) && value >= 0 && value < 1e6 ? Math.round(value) : undefined);
const yes = (value: unknown): true | undefined => (value === true ? true : undefined);

function ref(value: unknown): ArkMomentRef | undefined {
    if (!isRecord(value)) return undefined;
    const id = uuid(value.id);
    if (!id) return undefined;
    return {id, name: text(value.name) ?? null, status: word(value.status) ?? null};
}

/** One moment from the read, or null when it is not one the card knows how to say. */
function decodeMoment(value: unknown): ArkMoment | null {
    if (!isRecord(value)) return null;
    const kind = value.kind;
    if (typeof kind !== "string" || !(ARK_MOMENT_KINDS as readonly string[]).includes(kind)) return null;
    const id = text(value.id, 40);
    const at = typeof value.at === "string" ? Date.parse(value.at) : NaN;
    if (!id || !Number.isFinite(at)) return null;
    const place = isRecord(value.place) ? value.place : {};
    const moment: ArkMoment = {
        id,
        kind: kind as ArkMomentKind,
        at,
        arkDay: typeof value.ark_day === "number" && Number.isFinite(value.ark_day) ? value.ark_day : null,
        island: place.island === "wild" || place.island === "town" ? place.island : null,
        area: place.area === "house" || place.area === "farm" || place.area === "zoo" ? place.area : null
    };
    const fields: Partial<ArkMoment> = {
        source: value.source === "capture" || value.source === "step" ? value.source : undefined,
        fromEgg: yes(value.from_egg),
        way: word(value.way),
        partner: ref(value.partner),
        young: count(value.young),
        eggs: yes(value.eggs),
        first: yes(value.first),
        distance: count(value.distance),
        prey: text(value.prey),
        preyId: uuid(value.prey_id),
        phrase: text(value.phrase),
        trap: value.trap === "web" ? "web" : undefined,
        carcass: yes(value.carcass),
        egg: yes(value.egg),
        predator: text(value.predator),
        predatorId: uuid(value.predator_id),
        shelter: yes(value.shelter),
        food: value.food === "meat" || value.food === "seeds" ? value.food : undefined,
        role: value.role === "thief" || value.role === "victim" ? value.role : undefined,
        other: ref(value.other),
        move: word(value.move),
        enclosure: typeof value.enclosure === "string" && /^[a-z0-9_-]{1,32}$/.test(value.enclosure) ? value.enclosure : undefined,
        cause: word(value.cause),
        count: count(value.count),
        ids: Array.isArray(value.ids) ? value.ids.map(uuid).filter((x): x is string => Boolean(x)).slice(0, 12) : undefined
    };
    for (const [key, field] of Object.entries(fields)) if (field !== undefined) (moment as Record<string, unknown>)[key] = field;
    return moment;
}

/** The read's answer (`{moments, total, more}`), or null when it is not one. */
export function decodeArkMoments(value: unknown): ArkMoments | null {
    if (!isRecord(value) || !Array.isArray(value.moments)) return null;
    const moments = value.moments.map(decodeMoment).filter((m): m is ArkMoment => m !== null);
    moments.sort((a, b) => b.at - a.at);
    const total = typeof value.total === "number" && Number.isFinite(value.total) ? Math.max(Math.round(value.total), moments.length) : moments.length;
    return {moments, total, more: value.more === true};
}

/** The list the card shows, newest first: a second trip to the same mate on the same Ark day is the same journey. */
export function arkLifeSoFar(read: ArkMoments | null): ArkMoment[] {
    if (!read) return [];
    const out: ArkMoment[] = [];
    for (const moment of read.moments) {
        const last = out[out.length - 1];
        if (last && moment.kind === "went_to_mate" && last.kind === "went_to_mate" && last.partner?.id === moment.partner?.id
            && last.arkDay !== null && moment.arkDay !== null && Math.floor(last.arkDay) === Math.floor(moment.arkDay)) continue;
        out.push(moment);
    }
    return out;
}

export const ARK_LIFE_SO_FAR_ENGLISH = {
    title: "Life so far",
    more: "More ({n})",
    less: "Less",
    empty: "Nothing recorded yet",
    loading: "Reading its record…",
    arrivedCapture: "Came aboard with a capture",
    arrivedStep: "Came aboard after a step that worked",
    born: "Born on the Ark",
    hatched: "Hatched on the Ark",
    youngOne: "Had a young one",
    youngMany: "Had {n} young",
    hatchedOne: "One of its eggs hatched",
    hatchedMany: "{n} of its eggs hatched",
    mated: "Mated",
    matedWith: "Mated with {partner}",
    matedFirst: "First mating",
    expectingOne: "a young one on the way",
    expectingMany: "{n} young on the way",
    eggsOnTheWay: "eggs on the way",
    dated: "Found a partner",
    movedIn: "Moved in with its partner",
    parted: "Parted from its partner",
    wentToMate: "Travelled {m} m to find a mate",
    flewToMate: "Flew {m} m to find a mate",
    swamToMate: "Swam {m} m to find a mate",
    wentToMateNear: "Went to find a mate",
    caught: "Caught {prey}",
    caughtWeb: "Caught {prey} in its web",
    carcass: "Fed on a {prey} carcass",
    ateEgg: "Ate {prey} egg",
    meal: "Had a meal",
    ateCache: "Ate from its food store",
    ateDung: "Fed on fresh dung",
    stoleCache: "Raided {other} food store",
    cacheStolen: "Its food store was raided by {other}",
    cacheRehidden: "Hid its food store again",
    escaped: "Escaped {predator}",
    escapedShelter: "Escaped {predator} in a shelter",
    escapedSome: "Escaped a hunt",
    toolUse: "Used a tool",
    foodCache: "Stored food away",
    huntTechnique: "Hunted its own way",
    display: "Put on a display",
    courtship: "Courted",
    eggsCollected: "Its eggs were collected",
    grownUp: "Grew up",
    grewOld: "Grew old",
    returnedToCare: "Taken back into care",
    movedZoo: "Moved to a zoo",
    rehomed: "Rehomed",
    revived: "Came back for another life",
    diedOld: "Died of old age",
    diedOldPeaceful: "Died peacefully of old age",
    eatenBy: "Eaten by {predator}",
    eaten: "Was eaten",
    starved: "Starved",
    deforested: "Lost its home to logging",
    died: "Died",
    by: "by {name}"
};
export type ArkLifeSoFarWords = typeof ARK_LIFE_SO_FAR_ENGLISH;

const fill = (template: string, values: Record<string, string | number>): string => template.replace(/\{(\w+)\}/g, (all, key) => (key in values ? String(values[key]) : all));

/** "a Plains Zebra", "an Arctic Fox" (English); another language's words carry their own. */
export function arkWithArticle(name: string): string {
    const an = /^[aeiou]/i.test(name) && !/^(uni|eu|one|use|usu|ura)/i.test(name);
    return `${an ? "an" : "a"} ${name}`;
}
/** "a Plains Zebra's", for "Raided a Plains Zebra's food store". */
const possessive = (name: string) => `${arkWithArticle(name)}'s`;

/**
 * One moment in words. `self`: the animal's own kind's name (a mate of its own kind is "Mated", not "Mated with a Plains
 * Zebra"); `human`: a person aboard (old age is "peaceful", as the card's life story says it).
 */
export function arkMomentText(moment: ArkMoment, options: {self?: string | null; human?: boolean; words?: Partial<ArkLifeSoFarWords>} = {}): string {
    const w: ArkLifeSoFarWords = {...ARK_LIFE_SO_FAR_ENGLISH, ...(options.words ?? {})};
    const other = (r: ArkMomentRef | undefined) => (r?.name && r.name !== options.self ? arkWithArticle(r.name) : null);
    switch (moment.kind) {
        case "arrived":
            return moment.source === "step" ? w.arrivedStep : w.arrivedCapture;
        case "born":
            return moment.fromEgg ? w.hatched : w.born;
        case "young": {
            const n = moment.count ?? 1;
            if (moment.fromEgg) return n === 1 ? w.hatchedOne : fill(w.hatchedMany, {n});
            return n === 1 ? w.youngOne : fill(w.youngMany, {n});
        }
        case "mated": {
            const partner = other(moment.partner);
            const head = moment.first ? w.matedFirst : partner ? fill(w.matedWith, {partner}) : w.mated;
            const n = moment.young ?? 0;
            const tail = moment.eggs ? w.eggsOnTheWay : n === 1 ? w.expectingOne : n > 1 ? fill(w.expectingMany, {n}) : null;
            return tail ? `${head} · ${tail}` : head;
        }
        case "dated":
            return w.dated;
        case "moved_in":
            return w.movedIn;
        case "parted":
            return w.parted;
        case "went_to_mate": {
            const m = moment.distance;
            if (!m) return w.wentToMateNear;
            const way = moment.way === "fly" || moment.way === "air" ? w.flewToMate : moment.way === "water" || moment.way === "swim" ? w.swamToMate : w.wentToMate;
            return fill(way, {m: m.toLocaleString("en")});
        }
        case "meal": {
            if (!moment.prey) return w.meal;
            if (moment.carcass) return fill(w.carcass, {prey: moment.prey});
            if (moment.egg) return fill(w.ateEgg, {prey: arkWithArticle(moment.prey)});
            return fill(moment.trap === "web" ? w.caughtWeb : w.caught, {prey: arkWithArticle(moment.prey)});
        }
        case "ate_cache":
            return w.ateCache;
        case "ate_dung":
            return w.ateDung;
        case "cache_stolen": {
            const name = moment.other?.name ?? null;
            if (moment.role === "victim") return name ? fill(w.cacheStolen, {other: arkWithArticle(name)}) : w.cacheStolen.replace(" by {other}", "");
            return fill(w.stoleCache, {other: name ? possessive(name) : "a"});
        }
        case "cache_rehidden":
            return w.cacheRehidden;
        case "escaped":
            if (!moment.predator) return w.escapedSome;
            return fill(moment.shelter ? w.escapedShelter : w.escaped, {predator: arkWithArticle(moment.predator)});
        case "signature":
            return moment.move === "tool_use" ? w.toolUse : moment.move === "food_cache" ? w.foodCache : moment.move === "hunt_technique" ? w.huntTechnique
                : moment.move === "display" ? w.display : moment.move === "courtship" ? w.courtship : w.huntTechnique;
        case "eggs_collected":
            return w.eggsCollected;
        case "grown_up":
            return w.grownUp;
        case "grew_old":
            return w.grewOld;
        case "returned_to_care":
            return w.returnedToCare;
        case "moved_zoo":
            return w.movedZoo;
        case "rehomed":
            return w.rehomed;
        case "revived":
            return w.revived;
        case "died":
            if (moment.way === "death_old" || moment.way === "died_old") return options.human ? w.diedOldPeaceful : w.diedOld;
            if (moment.way === "eaten") return moment.predator ? fill(w.eatenBy, {predator: arkWithArticle(moment.predator)}) : w.eaten;
            if (moment.way === "starved") return w.starved;
            if (moment.way === "deforested") return w.deforested;
            return w.died;
    }
}

/** What sort of moment it is, for its dot: a beginning, family, food, danger, an end, or the rest. */
export function arkMomentTone(moment: ArkMoment): "start" | "family" | "food" | "danger" | "end" | "life" {
    switch (moment.kind) {
        case "arrived":
        case "born":
            return "start";
        case "young":
        case "mated":
        case "dated":
        case "moved_in":
        case "parted":
        case "went_to_mate":
            return "family";
        case "meal":
        case "ate_cache":
        case "ate_dung":
        case "cache_stolen":
        case "cache_rehidden":
            return "food";
        case "escaped":
            return "danger";
        case "died":
        case "rehomed":
        case "moved_zoo":
            return "end";
        default:
            return "life";
    }
}

/** The display switch: `?lifestory` on the page or the embed (any value but `0`), or `globalThis.__arkLifeStory`. Off by default. */
export function arkLifeStoryOn(): boolean {
    const g = globalThis as {__arkLifeStory?: boolean; location?: {search?: string}};
    if (g.__arkLifeStory === true) return true;
    try {
        const params = new URLSearchParams(g.location?.search ?? "");
        return params.has("lifestory") && params.get("lifestory") !== "0";
    } catch {
        return false;
    }
}
