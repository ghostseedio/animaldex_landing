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

/**
 * DEVELOPMENT ONLY (the runtime measure's `--broods <n>`): up to `n` broods made from a snapshot's own free wildlife, one
 * a pair of a kind, at the first parent's home slot: eggs, young and (every seventh) a spawn of hundreds in turn, so a
 * measured run carries the nests, the stand-ins and the instanced young a switched-on Ark of that size would. Not a
 * forecast of the engine's numbers: only a load of the right order (the contract's estimate is a few hundred broods).
 */
export function rawBroodsFromSnapshot(animals: ReadonlyArray<{id: string; species_profile_id: string; kind_species_profile_id?: string | null; name: string; model_slug: string; zone: string; slot?: number | null; slot_rank?: number | null; area?: string | null; island?: string | null; origin?: string}>, n: number, epoch: number, arkDay: number): ReturnType<typeof rawBroodsRead> {
    const kinds = new Map<string, typeof animals[number][]>();
    for (const animal of animals) {
        if (animal.area || animal.model_slug === "human" || animal.slot == null || animal.origin === "born") continue;
        const key = `${animal.kind_species_profile_id || animal.species_profile_id}|${animal.zone}|${animal.island ?? ""}`;
        kinds.set(key, [...(kinds.get(key) ?? []), animal]);
    }
    const broods: RawBrood[] = [];
    let k = 0;
    for (const group of Array.from(kinds.values())) {
        if (broods.length >= n) break;
        if (group.length < 2) continue;
        const [a, b] = group;
        const young = k % 2 === 1;
        const many = k % 7 === 6;
        const start = many ? 800 : 3 + (k % 8);
        const count = Math.max(start - (k % 3), 1);
        broods.push(rawBrood({
            id: `b100d000-0000-4000-8000-${k.toString(16).padStart(12, "0")}`,
            species_profile_id: a.species_profile_id,
            kind: a.kind_species_profile_id || a.species_profile_id,
            name: a.name,
            model_slug: a.model_slug,
            parents: [a.id, b.id],
            carer: k % 5 === 4 ? null : a.id,
            care: (["nest", "follow", "none", "guard", "carry"] as const)[k % 5],
            hold: young || k % 5 === 2 ? null : k % 5 === 3 ? "guard" : "sit",
            stage: young ? "young" : "egg",
            count,
            start,
            stage_count: young ? count : start,
            zone: a.zone,
            island: a.island === "town" ? "town" : "wild",
            nest: {slot: a.slot ?? 0, slot_rank: a.slot_rank ?? 0},
            laid_ark_day: arkDay - 6,
            stage_ark_day: young ? arkDay - 2 : arkDay - 6,
            next_ark_day: arkDay + 8
        }));
        k++;
    }
    return rawBroodsRead(epoch, arkDay, broods);
}
