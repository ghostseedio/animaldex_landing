/**
 * Captures + thrive (owner, 2026-11-11; the frozen read contract,
 * AnimalDex `docs/ark/captures-thrive-design.md` sections 0 and 8): how well
 * kept an animal is, as the scene reads it.
 *
 * The server sends one band per animal, `thrive` (`ordinary | good | prime`):
 * its bringer's condition for its kind, raised by their steps that worked and
 * drifting back to ordinary without them (a young one inherits part of it,
 * at most `good`). Only the band is public, never the 0–100 value, and it is
 * separate from `condition` (hunger and age, `well_fed | hungry | old`).
 *
 * THE HOOK (for the animal-look and behaviour lanes). Every scene entry
 * carries `thrive` (`index.ts`, `Entry.thrive`), and every schedule animal
 * too (`behaviour-schedule.ts`, `ScheduleAnimal.thrive`), set from the
 * snapshot on every refresh. Nothing reads them yet: the scene draws and
 * moves every band the same. What they are for, realistic only (design
 * section 8):
 *
 *   | band     | coat / plumage (`animal-look`)             | energy (schedule)           | places (schedule)              |
 *   | prime    | fuller, glossier: a little lower roughness, | more time active, a wider   | first claim on the best spots: |
 *   |          | a little more sheen and saturation         | roam, brisker within speed  | water's edge, shade, the perch |
 *   | good     | the default look                           | the default                 | after prime                    |
 *   | ordinary | slightly duller and rougher, never ill     | more resting                | what is left                   |
 *
 * `arkThriveRank` orders a claim on a place (ties by id, the caller's), and
 * `arkThriveOf` is the band to act on (ordinary when the server sent none).
 *
 * NEVER: a glow, a halo, an aura, an outline, a badge, sparkles, a label
 * over an animal, a tint that reads as UI, or a turn to the camera. The tap
 * card says the band in words; that is the only place it shows as text.
 * Visual only and deterministic: the same for every viewer, never an outcome.
 */

import type {ArkAnimal, ArkArea, ArkArrivalSource, ArkThrive} from "@/ark-scene/types";

/** The server's band, or null for anything else. */
export function arkThrive(value: unknown): ArkThrive | null {
    return value === "ordinary" || value === "good" || value === "prime" ? value : null;
}

/** The server's area (`house | farm`), or null: the species' own zone. */
export function arkArea(value: unknown): ArkArea | null {
    return value === "house" || value === "farm" ? value : null;
}

/** How an arrived animal came aboard (`capture | step`), or null (born, or an older server). */
export function arkArrivalSource(value: unknown): ArkArrivalSource | null {
    return value === "capture" || value === "step" ? value : null;
}

/** The band the scene acts on: the server's, else ordinary (an older server, the chat's visitor, a former voyager's). */
export function arkThriveOf(animal: Pick<ArkAnimal, "thrive"> | null | undefined): ArkThrive {
    return arkThrive(animal?.thrive) ?? "ordinary";
}

/** A claim on a place: prime 2, good 1, ordinary 0 (higher first; the caller breaks ties by id). */
export function arkThriveRank(band: ArkThrive): 0 | 1 | 2 {
    return band === "prime" ? 2 : band === "good" ? 1 : 0;
}
