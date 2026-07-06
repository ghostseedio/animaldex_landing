import {formatAnimalDexNumber, getAnimalDexNumberFromEntry} from "@/lib/animaldex-number";
import type {SpeciesEntry} from "@/data/species";

type AnimalDexNumberBadgeProps = {
    number?: number | null;
    entry?: Pick<SpeciesEntry, "databaseSource"> | null;
    compact?: boolean;
    showNewWhenMissing?: boolean;
    className?: string;
};

export default function AnimalDexNumberBadge({
    number,
    entry,
    compact = false,
    showNewWhenMissing = false,
    className = ""
}: AnimalDexNumberBadgeProps) {
    const resolvedNumber = number ?? getAnimalDexNumberFromEntry(entry);

    if (resolvedNumber) {
        return (
            <span
                className={`inline-flex items-center gap-1 rounded-full border border-primary-400/35 bg-black/70 font-black tabular-nums text-primary-200 ${
                    compact ? "px-2 py-0.5 text-[0.62rem] tracking-[0.08em]" : "px-2.5 py-1 text-xs tracking-[0.12em]"
                } ${className}`}
            >
                {formatAnimalDexNumber(resolvedNumber)}
            </span>
        );
    }

    if (!showNewWhenMissing) {
        return null;
    }

    return (
        <span
            className={`inline-flex items-center rounded-full border border-white/15 bg-black/55 font-black uppercase tracking-[0.14em] text-white/45 ${
                compact ? "px-2 py-0.5 text-[0.62rem]" : "px-2.5 py-1 text-xs"
            } ${className}`}
        >
            NEW
        </span>
    );
}
