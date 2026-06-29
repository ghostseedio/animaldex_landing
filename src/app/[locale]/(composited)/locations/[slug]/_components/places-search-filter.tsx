"use client";

import {useMemo, useState} from "react";
import {WildlifePlace} from "@/data/location-places";
import PlaceCard, {PlaceCardLabels} from "./place-card";

export default function PlacesSearchFilter({places, fallbackImage, labels}: {
    places: WildlifePlace[];
    fallbackImage: {src: string; alt: string; width: number; height: number};
    labels: PlaceCardLabels & {
        searchLabel: string;
        searchPlaceholder: string;
        allTypes: string;
        allAnimals: string;
        allBestFor: string;
        resultCount: string;
        noResults: string;
        reset: string;
    };
}) {
    const [query, setQuery] = useState("");
    const [type, setType] = useState("");
    const [animal, setAnimal] = useState("");
    const [bestFor, setBestFor] = useState("");
    const types = Array.from(new Set(places.map((entry) => entry.type)));
    const animals = Array.from(new Set(places.flatMap((entry) => entry.animalsToSpot))).sort();
    const bestForOptions = Array.from(new Set(places.flatMap((entry) => entry.bestFor))).sort();

    const filtered = useMemo(() => {
        const normalized = query.trim().toLowerCase();
        return places.filter((entry) => {
            if (type && entry.type !== type) return false;
            if (animal && !entry.animalsToSpot.includes(animal)) return false;
            if (bestFor && !entry.bestFor.includes(bestFor)) return false;
            if (!normalized) return true;
            return [entry.name, entry.locationName, entry.region, entry.shortDescription, ...entry.animalsToSpot, ...entry.bestFor]
                .some((value) => value.toLowerCase().includes(normalized));
        });
    }, [animal, bestFor, places, query, type]);

    function reset() {
        setQuery(""); setType(""); setAnimal(""); setBestFor("");
    }

    return (
        <div>
            <div className="rounded-[1.75rem] bg-surface-900/60 p-4 md:p-6">
                <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-ink-100">{labels.searchLabel}</span>
                    <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={labels.searchPlaceholder} className="min-h-12 w-full rounded-2xl border border-white/10 bg-canvas-950/60 px-4 text-white outline-none placeholder:text-ink-300 focus:border-primary-400/60" />
                </label>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <select value={type} onChange={(event) => setType(event.target.value)} className="min-h-11 rounded-xl border border-white/10 bg-canvas-950 px-3 text-sm text-white">
                        <option value="">{labels.allTypes}</option>
                        {types.map((item) => <option key={item} value={item}>{labels.typeLabels[item]}</option>)}
                    </select>
                    <select value={animal} onChange={(event) => setAnimal(event.target.value)} className="min-h-11 rounded-xl border border-white/10 bg-canvas-950 px-3 text-sm text-white">
                        <option value="">{labels.allAnimals}</option>
                        {animals.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                    <select value={bestFor} onChange={(event) => setBestFor(event.target.value)} className="min-h-11 rounded-xl border border-white/10 bg-canvas-950 px-3 text-sm text-white">
                        <option value="">{labels.allBestFor}</option>
                        {bestForOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                </div>
            </div>
            <p className="mt-5 text-sm text-ink-300">{filtered.length} {labels.resultCount}</p>
            {filtered.length ? (
                <div className="mt-5 grid gap-5 lg:grid-cols-2">
                    {filtered.map((entry) => <PlaceCard key={`${entry.name}-${entry.locationName}`} place={entry} fallbackImage={fallbackImage} labels={labels} />)}
                </div>
            ) : (
                <div className="mt-5 rounded-[1.75rem] bg-surface-900/60 px-6 py-12 text-center">
                    <p className="text-lg text-ink-100">{labels.noResults}</p>
                    <button type="button" onClick={reset} className="mt-5 min-h-11 rounded-xl bg-primary-400 px-5 font-bold text-canvas-950">{labels.reset}</button>
                </div>
            )}
        </div>
    );
}
