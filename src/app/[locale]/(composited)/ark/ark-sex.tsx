"use client";

import React from "react";
import type {ArkAnimal} from "@/ark-scene/types";
import {arkSexView, type ArkSexWords} from "@/lib/ark-sex";

/**
 * ♂ / ♀ beside an animal's name in its panel, "♂3 ♀4" in a species row, or the kind's note when it keeps no males and females
 * (`lib/ark-sex.ts`); nothing while the server's `sexes` switch is off. An image to a screen reader, labelled "male" / "female".
 * Lazy (`ark-sex-lazy`): the page's first JavaScript is budgeted.
 */
export default function ArkSex({animals, words, locale, row}: {animals: ReadonlyArray<Pick<ArkAnimal, "sex" | "reproduction">>; words: Partial<ArkSexWords> | null | undefined; locale: string; row?: boolean}) {
    const view = arkSexView(animals, words, (n) => n.toLocaleString(locale));
    if (!view) return null;
    const size = row ? "text-[11px]" : "text-[13px]";
    return (
        <span role="img" aria-label={view.label} title={view.label} data-testid="ark-sex" className={`shrink-0 whitespace-nowrap tabular-nums ${view.note ? `${size} max-w-[7.5rem] truncate italic text-ink-400` : `${size} font-semibold text-primary-200`} ${row ? "self-center px-1.5" : ""}`}>
            {view.text}
        </span>
    );
}
