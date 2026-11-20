"use client";

import {arkPowerOf} from "@/ark-scene/power-table";
import type {ArkAnimal, ArkThrive} from "@/ark-scene/types";
import {ARK_POWER_ENGLISH, fillArkWords, type ArkPowerWords} from "@/lib/ark-words";

/**
 * Powers you can see (AnimalDex decision 420): the tap card's line for an animal whose kind has a survival Power
 * (`power-table.ts`), by its thrive band: prime "Its Power: camouflage — working", good "… partly working",
 * ordinary "Earn its Power to make it work". Lazy (the table and this line load with the first card that asks), so
 * /ark's static JavaScript stays inside its budget (`ark-page-weight.test.ts`). Nothing for a kind without one.
 */
export default function ArkCardPower({animal, band, words}: {animal: ArkAnimal; band: ArkThrive | null | undefined; words?: Partial<ArkPowerWords> | null}) {
    const power = arkPowerOf(animal);
    if (!power) return null;
    const w: ArkPowerWords = {...ARK_POWER_ENGLISH, ...(words ?? {})};
    const name = w[power.mechanism];
    const text = band === "prime" ? fillArkWords(w.working, {power: name}) : band === "good" ? fillArkWords(w.partly, {power: name}) : w.earn;
    return (
        <p data-testid="ark-card-power" data-power={power.mechanism} data-band={band ?? "ordinary"} className={`mt-1 text-[12px] leading-snug ${band === "prime" || band === "good" ? "font-semibold text-primary-200" : "text-ink-300"}`}>
            {text}
        </p>
    );
}
