"use client";

import {useEffect, useState} from "react";
import {ANIMAL_POWER_ICON_BATCH_LIMIT, isAnimalPowerIconId} from "@/lib/animal-power-icon";

/**
 * A species' Animal Power icon SVG on the client, or null while unknown and
 * when the species has none.
 *
 * Every icon asked for in the same tick goes out as ONE request, so a list of
 * forty Powers costs one read, not forty. Answers — "this svg" and "no icon" —
 * are kept for the life of the page; a failed read is not, so it can retry.
 */

const known = new Map<string, string | null>();
const inFlight = new Map<string, Promise<string | null>>();
let queued: Array<{id: string; resolve: (svg: string | null) => void}> = [];
let flushScheduled = false;

async function readBatch(batch: typeof queued) {
    const ids = Array.from(new Set(batch.map((item) => item.id)));
    let icons: Record<string, string> | null = null;
    try {
        const response = await fetch(`/api/animal-power-icons?ids=${ids.join(",")}`, {headers: {Accept: "application/json"}});
        const payload = response.ok ? await response.json() : null;
        icons = payload && typeof payload.icons === "object" && payload.icons ? payload.icons : null;
    } catch {
        icons = null;
    }
    for (const id of ids) {
        const svg = icons ? (typeof icons[id] === "string" ? icons[id] : null) : null;
        if (icons) known.set(id, svg);
        inFlight.delete(id);
    }
    for (const item of batch) {
        item.resolve(known.get(item.id) ?? null);
    }
}

function flush() {
    flushScheduled = false;
    const pending = queued;
    queued = [];
    for (let index = 0; index < pending.length; index += ANIMAL_POWER_ICON_BATCH_LIMIT) {
        void readBatch(pending.slice(index, index + ANIMAL_POWER_ICON_BATCH_LIMIT));
    }
}

export function loadAnimalPowerIcon(speciesProfileId: string): Promise<string | null> {
    const id = speciesProfileId.toLowerCase();
    if (known.has(id)) return Promise.resolve(known.get(id) ?? null);
    const existing = inFlight.get(id);
    if (existing) return existing;

    const promise = new Promise<string | null>((resolve) => {
        queued.push({id, resolve});
    });
    inFlight.set(id, promise);
    if (!flushScheduled) {
        flushScheduled = true;
        setTimeout(flush, 0);
    }
    return promise;
}

export function useAnimalPowerIcon(speciesProfileId: string | null | undefined): string | null {
    const id = isAnimalPowerIconId(speciesProfileId) ? speciesProfileId.toLowerCase() : null;
    const [svg, setSvg] = useState<string | null>(() => (id ? known.get(id) ?? null : null));

    useEffect(() => {
        if (!id) {
            setSvg(null);
            return;
        }
        if (known.has(id)) {
            setSvg(known.get(id) ?? null);
            return;
        }
        let isCurrent = true;
        setSvg(null);
        void loadAnimalPowerIcon(id).then((loaded) => {
            if (isCurrent) setSvg(loaded);
        });
        return () => {
            isCurrent = false;
        };
    }, [id]);

    return svg;
}
