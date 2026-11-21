/**
 * ARK-SEAT: the scene's way in (`index.ts` makes three calls: `begin` each frame, `offset` before an animal's matrix is
 * composed, `settle` once it is final). The rules are in `seat.ts`.
 */

export {SeatPass, SEAT_BUDGET_MS, type SeatHolder, type SeatInput, type SeatKind, type SeatState} from "@/ark-scene/seat/seat";
export {solidClass, solidLabel, ALL, HARD, ROCK, SOFT, TREE} from "@/ark-scene/seat/solids";
export type {RigPose} from "@/ark-scene/seat/support";

import type {SeatKind} from "@/ark-scene/seat/seat";

/** What the scene knows of an animal this frame, for the seat's kind. */
export type SeatFacts = {
    riding: boolean;
    carried: boolean;
    hanging: boolean;
    onWeb: boolean;
    /** In the air: its own flight, a flying clip, its schedule's leg. */
    flying: boolean;
    /** In or on the water, or sliding into it. */
    water: boolean;
    /** Off the ground by its pose's own rule with no surface under it (a burrow's mouth, a swarm, the sea floor). */
    afloat: boolean;
    den: boolean;
    growing: boolean;
    acting: boolean;
    swinging: boolean;
    hopping: boolean;
    /** The surface it is held on: its normal's height. */
    surfaceNy: number | null;
    lying: boolean;
};

/** The seat's kind for an animal: what it is left alone for, or how it is seated. */
export function seatKind(f: SeatFacts): SeatKind {
    if (f.riding) return "ride";
    if (f.carried) return "carried";
    if (f.hanging || f.onWeb) return "hang";
    if (f.flying) return "fly";
    if (f.water) return "swim";
    if (f.den) return "den";
    if (f.surfaceNy === null && f.afloat) return "afloat";
    if (f.growing) return "grow";
    if (f.acting) return "act";
    if (f.swinging) return "swing";
    if (f.hopping) return "hop";
    if (f.surfaceNy !== null) return f.surfaceNy < 0.5 ? "cling" : "perch";
    return f.lying ? "lie" : "stand";
}
