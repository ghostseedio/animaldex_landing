"use client";

import React, {useMemo} from "react";
import type {ArkAnimal, ArkIsland, ArkSnapshot} from "@/ark-scene/types";
import {arkPlaceGroups, type ArkPlace} from "@/lib/ark-islands";
import {ZOO_TYPES} from "@/ark-scene/islands/town/zoo-types";
import type {ArkWords} from "@/lib/ark-words";
import ArkSpeciesIcon from "@/app/[locale]/(composited)/ark/ark-species-icon";
import {arkIconUrl} from "@/ark-scene/placeholder";

/**
 * Part C, "My animals" across both islands (islands plan §6): the viewer's animals grouped by where they live ("Wild
 * island · Rainforest", "Town · at home", "Town · on the farm", "Zoo · Primate house"), each a button that flies to
 * it, crossing to its island first when it lives on the other one. Shown with the "My animals" switch on.
 */

type Props = {
    snapshot: ArkSnapshot;
    island: ArkIsland;
    words: ArkWords;
    locale: string;
    onAnimal: (animal: ArkAnimal) => void;
};

/** Rows shown per place before "+ n more". */
const PER_PLACE = 6;

function placeLabel(place: ArkPlace, words: ArkWords): string {
    const w = words.islands;
    const wild = w?.wild ?? "Wild island";
    const town = w?.town ?? "Town and zoo";
    if (place.kind === "zone") return `${wild} · ${words.zones?.[place.zone] ?? place.zone.replace(/_/g, " ")}`;
    if (place.kind === "house") return `${town} · ${w?.atHome ?? "at home"}`;
    if (place.kind === "farm") return `${town} · ${w?.onFarm ?? "on the farm"}`;
    if (place.kind === "wildlife") return `${town} · ${w?.inTown ?? "gardens and streets"}`;
    return `${w?.zoo ?? "Zoo"} · ${place.kind === "zoo" && place.enclosure ? ZOO_TYPES[place.enclosure].label : ""}`;
}

export default function ArkMyAnimals({snapshot, island, words, locale, onAnimal}: Props) {
    const groups = useMemo(() => arkPlaceGroups(snapshot.animals.filter((animal) => animal.mine), true), [snapshot]);
    if (!groups.length) return null;
    return (
        <div className="mt-3 flex max-w-full gap-2 overflow-x-auto pb-1" role="list" aria-label={words.myAnimals}>
            {groups.map((group) => (
                <div key={group.key} role="listitem" className={`min-w-[12rem] shrink-0 rounded-xl border px-3 py-2 ${group.place.island === island ? "border-primary-400/50" : "border-line-200"}`}>
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-300">
                        {placeLabel(group.place, words)} <span className="tabular-nums text-ink-400">{group.animals.length.toLocaleString(locale)}</span>
                    </p>
                    <ul className="mt-1.5 flex flex-col gap-1">
                        {group.animals.slice(0, PER_PLACE).map((animal) => (
                            <li key={animal.id}>
                                <button type="button" onClick={() => onAnimal(animal)} className="flex w-full items-center gap-2 rounded-lg px-1 py-0.5 text-left text-[13px] font-semibold text-ink-100 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-300">
                                    <ArkSpeciesIcon src={arkIconUrl(animal.model_slug)} size={20} className="h-5 w-5 shrink-0 rounded-full" />
                                    <span className="truncate">{animal.name}</span>
                                </button>
                            </li>
                        ))}
                        {group.animals.length > PER_PLACE ? (
                            <li>
                                <button type="button" onClick={() => onAnimal(group.animals[PER_PLACE])} className="px-1 text-[12px] font-semibold text-primary-300 hover:underline">
                                    +{(group.animals.length - PER_PLACE).toLocaleString(locale)}
                                </button>
                            </li>
                        ) : null}
                    </ul>
                </div>
            ))}
        </div>
    );
}
