import Link from "@/app/[locale]/_components/link";
import {POKEMON_ANIMAL_CANONICAL_BASE_PATH, PokemonAnimalEntry} from "@/data/pokemon-animal-counterparts";

type PokemonAnimalTableProps = {
    entries: PokemonAnimalEntry[];
    showGeneration?: boolean;
};

function confidenceLabel(confidence: PokemonAnimalEntry["confidence"]) {
    if (confidence === "none") {
        return "no clear animal";
    }

    return confidence;
}

export default function PokemonAnimalTable({entries, showGeneration}: PokemonAnimalTableProps) {
    return (
        <div className="overflow-x-auto rounded-3xl border border-line-300 bg-surface-900/80">
            <table className="w-full min-w-[48rem] border-collapse text-left">
                <thead className="bg-surface-800/80 text-xs uppercase tracking-[0.2em] text-ink-300">
                    <tr>
                        <th className="px-4 py-3 font-semibold">No.</th>
                        <th className="px-4 py-3 font-semibold">Pokemon</th>
                        {showGeneration ? <th className="px-4 py-3 font-semibold">Gen</th> : null}
                        <th className="px-4 py-3 font-semibold">Closest animal</th>
                        <th className="px-4 py-3 font-semibold">Basis</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-line-300">
                    {entries.map((entry) => (
                        <tr key={entry.slug} className="text-ink-100">
                            <td className="px-4 py-3 text-ink-300">#{String(entry.id).padStart(4, "0")}</td>
                            <td className="px-4 py-3">
                                <Link
                                    href={`${POKEMON_ANIMAL_CANONICAL_BASE_PATH}/${entry.slug}`}
                                    className="font-display text-xl font-bold text-white hover:text-primary-100"
                                >
                                    {entry.name}
                                </Link>
                            </td>
                            {showGeneration ? (
                                <td className="px-4 py-3 text-ink-200">
                                    <Link href={`${POKEMON_ANIMAL_CANONICAL_BASE_PATH}/${entry.generationSlug}`} className="hover:text-primary-100">
                                        Gen {entry.generation}
                                    </Link>
                                </td>
                            ) : null}
                            <td className="px-4 py-3 text-primary-100">{entry.animal}</td>
                            <td className="px-4 py-3 text-sm text-ink-300">{confidenceLabel(entry.confidence)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
