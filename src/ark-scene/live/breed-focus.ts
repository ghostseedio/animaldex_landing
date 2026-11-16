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
/** How long (ms) the tap's own choice of the parent may take to land before a view off it counts as the viewer's. */
export const YOUNG_SETTLE_MS = 1500;
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

/**
 * A clutch tap's picture (coordinator, from the harness frames: the lizards were specks and the eggs lost in the
 * grass): the mother and her eggs filling about half the view's height (a quarter of the picture), from above enough
 * to look down past the blades. While she is still walking to her mate (more than four of her lengths off), the eggs
 * and a body length round them. Never closer than two and a half of her lengths, nor than 12 cm.
 */
export const CLUTCH_FRAME_POLAR = 0.85;
export function clutchFrame(mother: {x: number; y: number; z: number}, spot: {x: number; y: number; z: number}, length: number, fovDeg: number): {x: number; y: number; z: number; distance: number} {
    const apart = Math.hypot(mother.x - spot.x, mother.z - spot.z);
    const near = apart <= length * 4;
    const span = near ? apart + length * 1.2 : length * 2;
    const at = near ? {x: (mother.x + spot.x) / 2, y: (mother.y + spot.y) / 2, z: (mother.z + spot.z) / 2} : {...spot};
    const distance = Math.max(span / (0.5 * 2 * Math.tan((fovDeg * Math.PI) / 360)), length * 2.5, 0.12);
    return {...at, distance};
}

/**
 * Whether a young waited for (its line was tapped before a read brought it) is still to be chosen: only while the view
 * is still on the parent the tap chose (the viewer has not chosen, followed or closed anything since) and within
 * `YOUNG_WAIT_MS`.
 */
export function youngStillWanted(wait: {parent: string; since: number; until: number} | null, now: number, view: {selected: string | null; followed: string | null} | null): boolean {
    if (!wait || now > wait.until || !view) return false;
    // (The tap's own choice takes a moment to land when the scene is placing a read: `select` waits for it.)
    if (now - wait.since < YOUNG_SETTLE_MS && view.selected === null) return true;
    return view.selected === wait.parent && (view.followed === null || view.followed === wait.parent);
}
