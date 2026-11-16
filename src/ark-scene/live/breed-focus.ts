/**
 * A breeding line's tap (owner 2026-11-16, on the live Ark: "some of the logs like '[animal] has mated' or 'laid a
 * clutch of eggs' or 'hatched' etc. don't show anything"). What the camera goes to, by the line's kind:
 *
 *   mated     the pair (the record's two parents), framed together while their mating is acted;
 *   laid      the mother, with the clutch drawn at her side (the record's own egg count);
 *   birth,
 *   hatched   the newborn with its mother; a newborn the viewer's roster does not hold yet (its read is still coming):
 *             the mother first, and the young chosen once it is aboard.
 *
 * The tap used to ask the scene to `locate` the line's animal first: only animals drawn one by one answer, and on a big
 * Ark most are not (the live budget, `live-budget.ts`: 1,200 drawn of 3,698 on a desktop, 200 to 400 on a phone, the
 * rest resting out of sight, and a herd's members beyond its representatives). The tap then fell to another of its kind
 * drawn somewhere, or to the zone's region view: "nothing". A `select` of any animal aboard brings it out (it is pinned,
 * `selection.ts`) and flies to it, so here "aboard" (in the snapshot) is what decides, never "drawn now".
 *
 * Pure: the controller gives what it remembers of the record (a mating's partner, a young's parents) and who is aboard.
 */

export type BreedKind = "mated" | "laid" | "birth" | "hatched";

export type BreedStep =
    /** Both chosen and framed (the first's card). */
    | {do: "pair"; a: string; b: string}
    /** One animal chosen. */
    | {do: "one"; id: string}
    /** The mother chosen now; `young` chosen once the viewer's roster holds it. */
    | {do: "parent"; id: string; young: string};

export function isBreedKind(kind: string | undefined | null): kind is BreedKind {
    return kind === "mated" || kind === "laid" || kind === "birth" || kind === "hatched";
}

/**
 * The tap's step, or null when none of the record's animals is aboard (the caller's old fallbacks: one of its kind, its
 * region). `animalId` is the line's focus: a mating's or a clutch's first parent, a birth's (first) young.
 */
export function breedFocus(kind: BreedKind, animalId: string | null, known: {partner?: string | null; parents?: readonly string[] | null}, aboard: (id: string) => boolean): BreedStep | null {
    if (!animalId) return null;
    if (kind === "mated" || kind === "laid") {
        const partner = known.partner && known.partner !== animalId ? known.partner : null;
        if (aboard(animalId)) return partner && aboard(partner) ? {do: "pair", a: animalId, b: partner} : {do: "one", id: animalId};
        return partner && aboard(partner) ? {do: "one", id: partner} : null;
    }
    const mother = (known.parents ?? []).find((id) => id !== animalId && aboard(id)) ?? null;
    if (aboard(animalId)) return mother ? {do: "pair", a: animalId, b: mother} : {do: "one", id: animalId};
    return mother ? {do: "parent", id: mother, young: animalId} : null;
}

/**
 * How far apart (m) a newborn and its mother may be and still be framed together: a few of the mother's lengths, at
 * least 1.5 m. Farther, the young alone (a picture wide enough for both would show neither: an aphid's mother 20 m off).
 */
export function kinFrameApart(length: number): number {
    return Math.max(length * 6, 1.5);
}

/** How long (ms) a young not yet aboard is waited for after its line's tap: the page reads the Ark every 45 s. */
export const YOUNG_WAIT_MS = 100_000;
/** How long (s) a clutch drawn for a laid line's tap stays beside its mother. */
export const CLUTCH_SHOWN_SECONDS = 150;

/**
 * The clutch's size across (m) beside a mother `length` long: about half her length (a scrape or a nest she could sit
 * on), at most 1.6 m; never a fixed floor that would make a fly's eggs as big as a hen's.
 */
export function clutchSize(length: number): number {
    return Math.min(Math.max(length * 0.55, 0.004), 1.6);
}

/**
 * Whether a body `length` long is still made out from `distance` away: at least `share` of the view's height (5%: a
 * wall lizard 11 cm long from 1.2 m). A pair of flies two metres apart framed together is two specks; then the tap
 * frames the first of them alone, close (seen on the live Ark: a Common Flesh Fly pair's tap showed a pavement).
 */
export function seenAt(length: number, distance: number, fovDeg: number, share = 0.05): boolean {
    const height = 2 * Math.max(distance, 1e-6) * Math.tan((fovDeg * Math.PI) / 360);
    return length / height >= share;
}
