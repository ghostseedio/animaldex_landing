/**
 * Encounter hunting, as the scene reads it (AnimalDex docs/ark/encounter-hunting.md): `voyage_hunting_v1`, through
 * `/api/ark/hunting`. Under `hunting = 'encounter'` the server decides meals on 15-Ark-minute steps from the shared
 * position module; the scene walks every due predator's forays (`src/ark-scene/hunting.ts`) and acts each meal out from
 * its `encounter` (the events read carries it on the meal row). Under the pool, or with no read, nothing changes.
 *
 * Nothing here decides anything: it reads what the server wrote. No user id ever comes through it.
 */
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
     * Its last meal's Ark day, by animal id, where the read sends one (a third element in a predator's row: the meal
     * clock's start, so the tap card's fed bar shows the share of its meal still to run; card truth 2026-11-13). Empty from a
     * server that sends two.
     */
    lastMeals?: Map<string, number>;
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
    const lastMeals = new Map<string, number>();
    if (Array.isArray(row.predators)) {
        for (const item of row.predators) {
            if (!Array.isArray(item) || typeof item[0] !== "string" || !ID.test(item[0])) continue;
            const from = finite(item[1]);
            if (from === null || from < 0) continue;
            predators.set(item[0], from);
            const meal = finite(item[2]);
            if (meal !== null && meal >= 0 && meal <= from) lastMeals.set(item[0], meal);
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
        lastMeals,
        meals
    };
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
