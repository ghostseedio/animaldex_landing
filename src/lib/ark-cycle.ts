import type {ArkAnimal, ArkSnapshot} from "@/ark-scene/types";
import {arkIslandOf, arkTwoIslands} from "@/lib/ark-islands";
import {arkSpeciesKey} from "@/lib/ark-population";

/**
 * Toggle through a species (owner 2026-11-21: "if i click komodo dragon in the hud, it'll focus on a komodo dragon but
 * there are 2 in the wild island so there should be chevrons ... to focus on the other one"). The focused animal's kind
 * (`arkSpeciesKey`, as the HUD's rows count it: a breed counts as its kind) among the live animals the scene was given,
 * on both islands. The order never depends on which one is focused, so "‹ 1 of 2 ›" stays put while paging: the wild
 * island's first, then the town's, each in the order they came aboard (the oldest first), then by id.
 */
export type ArkCycle = {
    /** The focused animal's place in its kind, from 0. */
    index: number;
    count: number;
    /** Every one of its kind, in the cycle's order. */
    ids: string[];
};

type CycleAnimal = Pick<ArkAnimal, "id" | "species_profile_id" | "model_slug" | "kind_species_profile_id" | "arrived_at" | "island" | "area" | "mine">;

/** The focused animal's kind in cycle order, or null when it is the only one (no chevrons) or not in the snapshot. */
export function arkCycleOf(snapshot: Pick<ArkSnapshot, "animals" | "islands" | "island"> | null | undefined, selectedId: string | null | undefined, options: {mineOnly?: boolean} = {}): ArkCycle | null {
    if (!snapshot || !selectedId) return null;
    const selected = snapshot.animals.find((animal) => animal.id === selectedId);
    if (!selected) return null;
    const key = arkSpeciesKey(selected);
    const two = arkTwoIslands(snapshot);
    const kind = (snapshot.animals as CycleAnimal[]).filter((animal) => arkSpeciesKey(animal) === key && (!options.mineOnly || animal.mine || animal.id === selectedId));
    if (kind.length < 2) return null;
    const islandRank = (animal: CycleAnimal) => (arkIslandOf(animal, two) === "wild" ? 0 : 1);
    const at = (animal: CycleAnimal) => {
        const time = Date.parse(animal.arrived_at);
        return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY;
    };
    const ordered = kind.slice().sort((a, b) => islandRank(a) - islandRank(b) || at(a) - at(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const ids = ordered.map((animal) => animal.id);
    return {index: ids.indexOf(selectedId), count: ids.length, ids};
}

/** The next (+1) or previous (-1) of its kind, wrapping round at either end. */
export function arkCycleStep(cycle: ArkCycle, step: 1 | -1): string {
    return cycle.ids[(cycle.index + step + cycle.count) % cycle.count];
}

/** An arrow key the card should page with: not while typing, not with a modifier, not one something else took. */
export function arkCycleKey(event: Pick<KeyboardEvent, "key" | "altKey" | "ctrlKey" | "metaKey" | "shiftKey" | "defaultPrevented" | "target">, rtl = false): 1 | -1 | null {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return null;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return null;
    const target = event.target as {tagName?: string; isContentEditable?: boolean; getAttribute?: (name: string) => string | null} | null;
    const tag = target?.tagName?.toUpperCase();
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable) return null;
    // (A slider or a tab list keeps its own arrows.)
    const role = target?.getAttribute?.("role");
    if (role === "slider" || role === "tab" || role === "textbox" || role === "spinbutton") return null;
    const forward = event.key === "ArrowRight";
    return forward !== rtl ? 1 : -1;
}
