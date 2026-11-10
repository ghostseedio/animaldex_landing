"use client";

import {useEffect, useState} from "react";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import {arkSpeciesAboard, pluralAnimalName} from "@/lib/ark-population";
import {fillArkWords} from "@/lib/ark-words";

/**
 * The species page's count aboard: rendered on the server from the page's
 * daily snapshot, then brought up to date in the browser from the Ark's own
 * public read (`/api/ark/voyage`, the same the /ark page refreshes from).
 * A count, never who brought them.
 */

type Props = {
    speciesProfileId: string | null;
    slug: string;
    name: string;
    initial: number;
    words: {aboardOne: string; aboardOther: string; notAboard: string};
};

export function speciesArkCountLine(count: number, name: string, words: Props["words"]): string {
    if (count <= 0) return fillArkWords(words.notAboard, {animal: name});
    return count === 1
        ? fillArkWords(words.aboardOne, {animal: name})
        : fillArkWords(words.aboardOther, {count: count.toLocaleString("en"), animals: pluralAnimalName(name)});
}

export default function SpeciesArkCount({speciesProfileId, slug, name, initial, words}: Props) {
    const [count, setCount] = useState(initial);
    useEffect(() => {
        let live = true;
        fetch("/api/ark/voyage", {credentials: "same-origin"})
            .then((response) => (response.ok ? response.json() : null))
            .then((body: {snapshot?: unknown} | null) => {
                const snapshot = decodeArkSnapshot(body?.snapshot);
                if (live && snapshot) setCount(arkSpeciesAboard(snapshot, {speciesProfileId, slug}).count);
            })
            .catch(() => undefined);
        return () => {
            live = false;
        };
    }, [slug, speciesProfileId]);
    return <p className="mt-3 text-lg font-semibold text-white" aria-live="polite">{speciesArkCountLine(count, name, words)}</p>;
}
