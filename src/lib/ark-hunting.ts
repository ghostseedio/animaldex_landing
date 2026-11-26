/**
 * Encounter hunting, as the scene reads it (AnimalDex docs/ark/encounter-hunting.md): `voyage_hunting_v1`, through
 * `/api/ark/hunting`. Under `hunting = 'encounter'` the server decides meals on 15-Ark-minute steps from the shared
 * position module; the scene walks every due predator's forays (`src/ark-scene/hunting.ts`) and acts each meal out from
 * its `encounter` (the events read carries it on the meal row). Under the pool, or with no read, nothing changes.
 *
 * Nothing here decides anything: it reads what the server wrote. No user id ever comes through it.
 */
import {ARK_DAY_MS} from "@/lib/ark-clock";
import {decodeArkMealEncounter, type ArkMealEncounter} from "@/lib/ark-life";

export type ArkHunting = {
    hunting: "pool" | "encounter";
    /** The voyage's clock start (epoch ms): the island's hour at an Ark day. */
    startedAtMs: number | null;
    /** The Ark day now, and how far the world has been worked out, by the server. */
    arkDay: number | null;
    tickedTo: number | null;
    /** Every living predator's next hunt (the Ark day from which it hunts; 0 = now), by animal id. */
    predators: Map<string, number>;
    /**
     * EATSOON (AnimalDex migration 20261231200000, `voyage_hunting_v1`'s tuple `[id, from, find, catch, dormant?]`): the share
     * of its recent due, awake steps in which the encounter test found prey it could take, its catch chance per attempt,
     * and whether it is dormant now. Only for the predators whose tuple carries them; an older read sends none.
     */
    odds?: Map<string, {find: number | null; catch: number | null; dormant: boolean}>;
    /**
     * Hunt geometry (AnimalDex decision 500, `voyage_config.hunt_geometry`): on, each hunter's foray follows its way of
     * hunting (`positions.ts` huntForayAt); `leans` are where the engine chose each one works ([x, z, fromStep, R] entries,
     * a day before it uses them; the read's own `leans` key, {predator id: entries}, since EATSOON took the tuple's [2]..[4]).
     * Absent or false: today's forays.
     */
    geometry?: boolean;
    leans?: Map<string, Array<Array<number | null>>>;
    meals: ArkHuntingMeal[];
};

export type ArkHuntingMeal = {id: string; arkDay: number | null; predator: string; prey: string; encounter: ArkMealEncounter};

const ID = /^[0-9a-f-]{8,64}$/i;

function finite(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) ? value : typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value)) ? Number(value) : null;
}

/** `voyage_hunting_v1`'s answer, checked (a malformed row is dropped, never the whole answer). Null: not a hunting answer. */
export function decodeArkHunting(raw: unknown): ArkHunting | null {
    const row = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : null;
    if (!row) return null;
    const mode = row.hunting === "encounter" ? "encounter" : row.hunting === "pool" ? "pool" : null;
    if (!mode) return null;
    const startedAtMs = typeof row.started_at === "string" ? Date.parse(row.started_at) : finite(row.startedAtMs);
    const predators = new Map<string, number>();
    const leans = new Map<string, Array<Array<number | null>>>();
    const odds = new Map<string, {find: number | null; catch: number | null; dormant: boolean}>();
    if (Array.isArray(row.predators)) {
        for (const item of row.predators) {
            if (!Array.isArray(item) || typeof item[0] !== "string" || !ID.test(item[0])) continue;
            const from = finite(item[1]);
            if (from === null || from < 0) continue;
            predators.set(item[0], from);
            // ([id, from, find, catch] when it has both, a fifth 1 while dormant: [id, from, null, null, 1] with none yet.)
            const find = finite(item[2]);
            const chance = finite(item[3]);
            const both = find !== null && chance !== null && find >= 0 && find <= 1 && chance >= 0 && chance <= 1;
            const dormant = item[4] === 1 || item[4] === true;
            if (both || dormant) odds.set(item[0], {find: both ? find : null, catch: both ? chance : null, dormant});
        }
    }
    // Hunt geometry (AnimalDex 20261231210000): {predator id: [[x|null, z|null, fromStep, R], ...]}, only for living predators.
    const leanRow = row.leans && typeof row.leans === "object" && !Array.isArray(row.leans) ? row.leans as Record<string, unknown> : null;
    if (leanRow) {
        for (const id of Object.keys(leanRow)) {
            if (!ID.test(id) || !predators.has(id)) continue;
            const lean = decodeLeans(leanRow[id]);
            if (lean) leans.set(id, lean);
        }
    }
    const meals: ArkHuntingMeal[] = [];
    if (Array.isArray(row.meals)) {
        for (const item of row.meals) {
            const m = item && typeof item === "object" && !Array.isArray(item) ? item as Record<string, unknown> : null;
            const encounter = decodeArkMealEncounter(m?.encounter);
            if (!m || !encounter || typeof m.predator !== "string" || typeof m.prey !== "string" || !ID.test(m.predator) || !ID.test(m.prey)) continue;
            const id = finite(m.id);
            meals.push({id: id !== null ? String(id) : `${m.predator}-${m.prey}`, arkDay: finite(m.ark_day), predator: m.predator, prey: m.prey, encounter});
        }
    }
    return {
        hunting: mode,
        startedAtMs: startedAtMs !== null && Number.isFinite(startedAtMs) ? startedAtMs : null,
        arkDay: finite(row.ark_day),
        tickedTo: finite(row.ticked_to),
        predators,
        odds,
        meals,
        ...(row.hunt_geometry === true ? {geometry: true, leans} : {})
    };
}

/** A predator's leans as the read sends them: [x|null, z|null, fromStep, R] entries, ascending; malformed ones dropped. */
function decodeLeans(raw: unknown): Array<Array<number | null>> | null {
    if (!Array.isArray(raw)) return null;
    const out: Array<Array<number | null>> = [];
    for (const e of raw) {
        if (!Array.isArray(e) || e.length < 4) continue;
        const x = e[0] === null ? null : finite(e[0]);
        const z = e[1] === null ? null : finite(e[1]);
        const k = finite(e[2]);
        const r = finite(e[3]);
        if ((e[0] !== null && x === null) || (e[1] !== null && z === null) || k === null || !Number.isInteger(k) || r === null) continue;
        out.push([x, z, k, r]);
    }
    out.sort((a, b) => (a[2] as number) - (b[2] as number));
    return out.length ? out : null;
}

/** `/api/ark/hunting`'s body (`{available, hunting: <answer>}`): the decoded answer, or null (pool, quietly). */
export function decodeArkHuntingResponse(body: unknown): ArkHunting | null {
    const row = body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : null;
    if (!row || row.available === false) return null;
    return decodeArkHunting(row.hunting);
}

/** Reads `/api/ark/hunting` (or the given url); null on any failure, a missing read, or the pool. */
export async function fetchArkHunting(url = "/api/ark/hunting"): Promise<ArkHunting | null> {
    try {
        const response = await fetch(url, {cache: "no-store"});
        if (!response.ok) return null;
        const decoded = decodeArkHuntingResponse(await response.json());
        return decoded && decoded.hunting === "encounter" ? decoded : null;
    } catch {
        return null;
    }
}

/**
 * What the home page's "meals, last 24 hours" can honestly say when it is 0 (owner 2026-11-15: never a bare 0 while
 * no predator has been due). `counting`: a 0 is a real count (the pool, no predators, or some predator is due now and
 * found nothing). `waiting`: no living predator is due before `at` (the soonest `hunt_from` as a real time), and `first`
 * when no encounter meal has happened yet. Null: no hunting read, or it lacks the clock (the figure is then hidden).
 */
export type ArkLandingHunt = {state: "counting"} | {state: "waiting"; at: string; first: boolean};

export function arkLandingHunt(hunting: ArkHunting | null, encounterMealSeen: boolean): ArkLandingHunt | null {
    if (!hunting) return null;
    if (hunting.hunting === "pool" || hunting.predators.size === 0) return {state: "counting"};
    if (hunting.arkDay === null || hunting.startedAtMs === null) return null;
    let soonest = Infinity;
    hunting.predators.forEach((from) => {
        soonest = Math.min(soonest, from);
    });
    if (soonest <= hunting.arkDay) return {state: "counting"};
    return {state: "waiting", at: new Date(hunting.startedAtMs + soonest * ARK_DAY_MS).toISOString(), first: !encounterMealSeen && hunting.meals.length === 0};
}
