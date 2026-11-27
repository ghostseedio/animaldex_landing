/**
 * DEVELOPMENT ONLY: a brood read made by hand in the engine's contract shape (AnimalDex docs/ark/broods.md 7.1,
 * `voyage_broods_v1`), for tests and the broods harness's pictures (`broods-entry.ts`). Never shown as the real Ark:
 * nothing the site serves imports this file, and the page's own read comes only from `/api/ark/broods`.
 *
 * It is the raw answer, as the server would send it: every consumer still goes through `decodeArkBroods`.
 */

export type RawBroodLoss = {id: number; at: string; ark_day: number; cause: "taken" | "did_not_survive" | "failed" | "parent_lost" | "unsettled"; count: number; left: number; hunter: {id: string; species_profile_id: string; name: string; model_slug: string} | null; encounter?: {t: number; predator: {x: number; z: number}; prey: {x: number; z: number; r: number}}};

export type RawBrood = {
    id: string;
    kind: string;
    species_profile_id: string;
    name: string;
    model_slug: string;
    parents: string[];
    carer: string | null;
    care: "nest" | "follow" | "carry" | "guard" | "none";
    hold: "sit" | "guard" | null;
    way: string;
    way_detail: string | null;
    stage: "carried" | "egg" | "young";
    count: number;
    start: number;
    stage_count: number;
    taken: number;
    lost: number;
    laid_ark_day: number;
    stage_ark_day: number;
    next_ark_day: number;
    island: "wild" | "town";
    zone: string;
    nest: {slot: number; slot_rank: number};
    young_mass_g: number;
    losses: RawBroodLoss[];
    outcome?: "independent" | "failed" | "eaten" | "parent_lost" | "unsettled" | "closed";
    ended_ark_day?: number;
};

/** The Ark's day in real seconds (1 Ark year = 14 real days). */
export const FIXTURE_ARK_DAY_SECONDS = (14 * 86_400) / 365;

/** A brood with every field of the contract, from the few a scene cares about. */
export function rawBrood(given: Partial<RawBrood> & Pick<RawBrood, "id" | "name" | "model_slug" | "parents" | "stage" | "count" | "start" | "zone">): RawBrood {
    const laid = given.laid_ark_day ?? 470;
    return {
        kind: given.species_profile_id ?? "5bec1e50-0000-4000-8000-000000000000",
        species_profile_id: "5bec1e50-0000-4000-8000-000000000000",
        carer: given.parents[0] ?? null,
        care: "nest",
        hold: "sit",
        way: "mating",
        way_detail: null,
        stage_count: given.start,
        taken: 0,
        lost: 0,
        laid_ark_day: laid,
        stage_ark_day: laid,
        next_ark_day: laid + 20,
        island: "wild",
        nest: {slot: 90, slot_rank: 0},
        young_mass_g: 30,
        losses: [],
        ...given
    };
}

/** The read's envelope at a moment of the shared clock (epoch seconds) and its Ark day. */
export function rawBroodsRead(epoch: number, arkDay: number, broods: RawBrood[], ended: RawBrood[] = []): {on: true; as_of: string; ark_day: number; broods: RawBrood[]; ended: RawBrood[]} {
    return {on: true, as_of: new Date(epoch * 1000).toISOString(), ark_day: arkDay, broods, ended};
}

/** A loss row. `epoch`: when it was recorded; newest first in a brood's `losses`. */
export function rawLoss(id: number, epoch: number, arkDay: number, cause: RawBroodLoss["cause"], count: number, left: number, hunter: RawBroodLoss["hunter"] = null, encounter?: RawBroodLoss["encounter"]): RawBroodLoss {
    return {id, at: new Date(epoch * 1000).toISOString(), ark_day: arkDay, cause, count, left, hunter, ...(encounter ? {encounter} : {})};
}
