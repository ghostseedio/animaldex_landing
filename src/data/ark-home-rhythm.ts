import "server-only";

import days from "@/app/api/ark/sd-day/days.json";
import {readPublicArk} from "@/data/ark-public";
import {hash32} from "@/lib/ark-clock";
import type {HomeRhythmPick} from "@/app/[locale]/(composited)/(home)/_components/home-rhythm";
import type {SdRhythmState} from "@/lib/ark-sd-rhythm";

type Day = {slug: string; score: number; state: SdRhythmState; line: number[]; ordinary?: {line: number[]; state: SdRhythmState; score: number}};
const TABLE = (days as unknown as {species: Record<string, Day>}).species;

/**
 * The home page's rhythm animal (lane ark-sd-align): one real animal aboard, brought by a named founder, of a kind
 * whose day in the Ark follows its System Dynamics (a sample day in `/api/ark/sd-day`), the same for everyone on a day
 * and another the next (seeded by the UTC day). Null when none can be shown honestly: the section is then left out.
 */
export async function readHomeRhythmPick(now = Date.now()): Promise<HomeRhythmPick | null> {
    const snapshot = await readPublicArk(3600).catch(() => null);
    if (!snapshot) return null;
    const day = Math.floor(now / 86_400_000);
    let best: {score: number; pick: HomeRhythmPick} | null = null;
    for (const animal of snapshot.animals) {
        // (Not a kept one, a pet's, a farm's, a zoo's: its day is its keeper's place's, and the scene gives it no rhythm.)
        if (!animal.brought_by?.named || animal.placeholder || animal.area || (animal.island && animal.island !== "wild")) continue;
        const kind = TABLE[animal.species_profile_id?.toLowerCase() ?? ""];
        if (!kind) continue;
        const score = hash32("home-rhythm", day, animal.id);
        if (best && score >= best.score) continue;
        best = {
            score,
            pick: {
                animalId: animal.id,
                name: animal.name,
                latin: animal.scientific_name,
                bringer: animal.brought_by.label,
                speciesProfileId: animal.species_profile_id,
                kind: {line: kind.line, state: kind.state, score: kind.score},
                ordinary: kind.ordinary ?? null
            }
        };
    }
    return best?.pick ?? null;
}
