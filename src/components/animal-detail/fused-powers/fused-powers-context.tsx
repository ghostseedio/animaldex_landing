"use client";

import {createContext, useContext} from "react";
import type {FusedPowersState} from "@/components/animal-detail/fused-powers/use-fused-powers";

/**
 * What the capture card hands the Play panel for its Fused Powers section. The
 * growth panel is built on the server and handed to the card as a node, so it
 * cannot take these as props. Null everywhere but the owner's own card, which
 * leaves every other surface exactly as it was.
 */
export type FusedPowersContextValue = {
    state: FusedPowersState;
    /** The receiving card's animal, for "{name} brings: …". */
    receiverName: string;
    /** A pass or an approval changed the card's XP and stats: re-read it. */
    onCardChanged: () => void;
};

export const FusedPowersContext = createContext<FusedPowersContextValue | null>(null);

export function useFusedPowersContext() {
    return useContext(FusedPowersContext);
}
