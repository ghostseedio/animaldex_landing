"use client";

import {useMemo, useSyncExternalStore} from "react";
import {ARK_BROODS_OFF, arkBroodCardLine, arkBroodsByParent, type ArkBroodWords} from "@/lib/ark-broods";
import {arkBroodsStore} from "@/lib/ark-broods-store";

/**
 * BROODS (AnimalDex docs/ark/broods.md 7): a parent's brood on its card, from the engine's brood read: how many eggs
 * or young it started with and how many are left ("9 eggs · 7 left"), then what the record says became of the others:
 * who took them, how many did not survive, a nest that failed. The count is the record's whole count, also where the
 * world draws fewer (a clutch of 1,200 is a mass of spawn there). Nothing while the server's switch is off, or for an
 * animal with no brood. Loaded with the card, never with the page.
 */
export default function ArkCardBrood({animalId, words, locale, article}: {animalId: string; words: ArkBroodWords | null | undefined; locale: string; article: (name: string) => string}) {
    const read = useSyncExternalStore(arkBroodsStore.subscribe, arkBroodsStore.get, () => ARK_BROODS_OFF);
    const lines = useMemo(() => {
        if (!read.on) return [];
        // (Its live brood, and one that ended in the last day; the newest two.)
        return (arkBroodsByParent(read).get(animalId) ?? []).slice(0, 2).map((brood) => ({id: brood.id, ended: brood.outcome !== null, ...arkBroodCardLine(brood, words, locale, article)}));
    }, [read, animalId, words, locale, article]);
    if (!lines.length) return null;
    return (
        <div data-testid="ark-card-brood" className="min-w-0 space-y-0.5">
            {lines.map((line) => (
                <p key={line.id} data-ended={line.ended ? "1" : undefined} className="min-w-0 text-[12px] leading-snug text-ink-200">
                    <span className="font-bold tabular-nums text-ink-100">{line.head}</span>
                    {line.notes.length ? <span className="text-ink-300"> · {line.notes.join(" · ")}</span> : null}
                </p>
            ))}
        </div>
    );
}
