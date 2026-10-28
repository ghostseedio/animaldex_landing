"use client";

/**
 * Your animals and their bonds, for the whole tab.
 *
 * One store, like iOS `AnimalCompanionsStore`: the Companions list, and the one
 * level every card of an animal shows on your own account. Loaded once and
 * shared by every screen that asks; `reload` refreshes it (a reply that moved
 * the bond, a new capture). A failed read leaves an empty list, never an
 * error, and every caller falls back to what it showed before.
 */

import {useCallback, useEffect, useState, useSyncExternalStore} from "react";
import {
    companionLevelsBySpecies,
    decodeAnimalBond,
    decodeCompanionSummaries,
    ownCardLevel,
    type CardSpeciesKey,
    type AnimalBond,
    type CompanionSummary
} from "@/lib/companion-bond";

type CompanionsSnapshot = {rows: CompanionSummary[]; didLoad: boolean; available: boolean};

let snapshot: CompanionsSnapshot = {rows: [], didLoad: false, available: false};
let inFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit(next: CompanionsSnapshot) {
    snapshot = next;
    listeners.forEach((listener) => listener());
}

export function reloadCompanions(): Promise<void> {
    if (inFlight) return inFlight;
    inFlight = fetch("/api/app/companions", {headers: {Accept: "application/json"}, cache: "no-store"})
        .then((response) => (response.ok ? response.json() : null))
        .then((payload: {companions?: unknown; available?: boolean} | null) => {
            emit({
                rows: decodeCompanionSummaries(payload?.companions),
                didLoad: true,
                available: payload?.available === true
            });
        })
        .catch(() => emit({...snapshot, didLoad: true}))
        .finally(() => {
            inFlight = null;
        });
    return inFlight;
}

const SERVER_SNAPSHOT: CompanionsSnapshot = {rows: [], didLoad: false, available: false};

/** Every animal you hold, in the server's order. `enabled` false reads nothing (a signed-out page, someone else's card). */
export function useCompanions(enabled = true) {
    const state = useSyncExternalStore(
        (listener) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        () => snapshot,
        () => SERVER_SNAPSHOT
    );
    useEffect(() => {
        if (enabled && !state.didLoad) void reloadCompanions();
    }, [enabled, state.didLoad]);
    return {...state, reload: reloadCompanions};
}

/** The bond for one of your animals, from the shared list: the level its cards show. */
export function useCompanionLevel(speciesProfileId: string | null | undefined, enabled = true): CompanionSummary | null {
    const {rows} = useCompanions(enabled && Boolean(speciesProfileId));
    if (!enabled || !speciesProfileId) return null;
    return companionLevelsBySpecies(rows).get(speciesProfileId.toLowerCase()) ?? null;
}

/**
 * The level a card shows: on one of your own cards (`isOwn`), its animal's
 * bond level, else the card's own. Other people's cards read nothing.
 */
export function useOwnCardLevel(card: CardSpeciesKey, cardLevel: number, isOwn: boolean): number {
    const {rows} = useCompanions(isOwn);
    return isOwn ? ownCardLevel(rows, card, cardLevel) : cardLevel;
}

/** `animal_bond_v1` for one animal: the bond screen. */
export function useAnimalBond(speciesProfileId: string | null | undefined) {
    const [bond, setBond] = useState<AnimalBond | null>(null);
    const [didLoad, setDidLoad] = useState(false);

    const reload = useCallback(async () => {
        if (!speciesProfileId) {
            setBond(null);
            setDidLoad(true);
            return;
        }
        try {
            const response = await fetch(`/api/app/companions?speciesProfileId=${encodeURIComponent(speciesProfileId)}`, {
                headers: {Accept: "application/json"},
                cache: "no-store"
            });
            const payload = response.ok ? await response.json() as {bond?: unknown} : null;
            setBond(decodeAnimalBond(payload?.bond));
        } catch {
            setBond(null);
        } finally {
            setDidLoad(true);
        }
    }, [speciesProfileId]);

    useEffect(() => {
        setDidLoad(false);
        void reload();
    }, [reload]);

    return {bond, didLoad, reload, setBond};
}
